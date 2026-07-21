//go:build js && wasm

package core

import (
	"errors"
	"math"
	"syscall/js"
	"unsafe"
)

// WebGL1 constants (numeric to avoid per-call string lookups).
const (
	glTriangles         = 0x0004
	glBlend             = 0x0BE2
	glZero              = 0x0000
	glOne               = 0x0001
	glOneMinusSrcAlpha  = 0x0303
	glArrayBuffer       = 0x8892
	glStaticDraw        = 0x88E4
	glDynamicDraw       = 0x88E8
	glFloat             = 0x1406
	glColorBufferBit    = 0x4000
	glFramebuffer       = 0x8D40
	glColorAttachment0  = 0x8CE0
	glTexture2D         = 0x0DE1
	glRGBA              = 0x1908
	glUnsignedByte      = 0x1401
	glTextureMinFilter  = 0x2801
	glTextureMagFilter  = 0x2800
	glTextureWrapS      = 0x2802
	glTextureWrapT      = 0x2803
	glLinear            = 0x2601
	glClampToEdge       = 0x812F
	glCompileStatus     = 0x8B81
	glLinkStatus        = 0x8B82
	glVertexShader      = 0x8B31
	glFragmentShader    = 0x8B30
	glUnpackFlipY       = 0x9240
	glUnpackPremultiply = 0x9241
)

const flatVertSrc = `
attribute vec2 aPos;
uniform mat3 uView;
void main() {
	vec3 p = uView * vec3(aPos, 1.0);
	gl_Position = vec4(p.xy, 0.0, 1.0);
}`

// Flat shader outputs premultiplied alpha; the whole pipeline blends
// with (ONE, ONE_MINUS_SRC_ALPHA).
const flatFragSrc = `
precision mediump float;
uniform vec4 uColor;
void main() {
	gl_FragColor = vec4(uColor.rgb * uColor.a, uColor.a);
}`

const texVertSrc = `
attribute vec2 aPos;
attribute vec2 aUV;
uniform mat3 uView;
varying vec2 vUV;
void main() {
	vec3 p = uView * vec3(aPos, 1.0);
	gl_Position = vec4(p.xy, 0.0, 1.0);
	vUV = aUV;
}`

const texFragSrc = `
precision mediump float;
varying vec2 vUV;
uniform sampler2D uTex;
void main() {
	gl_FragColor = texture2D(uTex, vUV);
}`

var identityView = mat3{1, 0, 0, 0, 1, 0, 0, 0, 1}

type mat3 [9]float32 // column-major

// shapeVerts holds per-shape GPU buffers, uploaded once per shape version —
// frames can then render the whole scene without re-uploading vertices.
type shapeVerts struct {
	version    int64
	strokeBuf  js.Value
	strokeSize int
	fillBuf    js.Value
	fillSize   int
}

type texEntry struct {
	tex js.Value
	bad bool
}

// Renderer draws the scene as three explicit layers:
//  0. background + grid (screen)
//  1. images
//  2. vector drawings
//
// Vector drawings use an offscreen FBO so eraser strokes affect layer 2 only
// and can never hide images or erase the screen/grid beneath them.
type Renderer struct {
	gl     js.Value
	canvas js.Value

	progFlat   js.Value
	flatAPos   int
	flatUView  js.Value
	flatUColor js.Value
	progTex    js.Value
	texAPos    int
	texAUV     int
	texUView   js.Value
	texUTex    js.Value
	uvBuf      js.Value
	uvBufFBO   js.Value

	vbo     js.Value
	buf     js.Value // Uint8Array staging for vertex uploads
	bufCap  int
	matBuf  js.Value // Uint8Array(36)
	matView js.Value // Float32Array view over matBuf

	fbo    js.Value
	fboTex js.Value
	fboW   int
	fboH   int

	vertCache map[int64]*shapeVerts
	textures  map[int64]*texEntry
}

// NewRenderer grabs a WebGL context from the canvas and compiles shaders.
func NewRenderer(canvas js.Value) (*Renderer, error) {
	attrs := js.Global().Get("Object").New()
	attrs.Set("alpha", false)
	attrs.Set("antialias", true)
	attrs.Set("preserveDrawingBuffer", false)
	gl := canvas.Call("getContext", "webgl", attrs)
	if !gl.Truthy() {
		gl = canvas.Call("getContext", "experimental-webgl", attrs)
	}
	if !gl.Truthy() {
		return nil, errors.New("WebGL not available")
	}

	r := &Renderer{gl: gl, canvas: canvas, vertCache: map[int64]*shapeVerts{}, textures: map[int64]*texEntry{}}

	var err error
	if r.progFlat, err = r.buildProgram(flatVertSrc, flatFragSrc); err != nil {
		return nil, err
	}
	if r.progTex, err = r.buildProgram(texVertSrc, texFragSrc); err != nil {
		return nil, err
	}

	r.flatAPos = gl.Call("getAttribLocation", r.progFlat, "aPos").Int()
	r.flatUView = gl.Call("getUniformLocation", r.progFlat, "uView")
	r.flatUColor = gl.Call("getUniformLocation", r.progFlat, "uColor")
	r.texAPos = gl.Call("getAttribLocation", r.progTex, "aPos").Int()
	r.texAUV = gl.Call("getAttribLocation", r.progTex, "aUV").Int()
	r.texUView = gl.Call("getUniformLocation", r.progTex, "uView")
	r.texUTex = gl.Call("getUniformLocation", r.progTex, "uTex")

	r.vbo = gl.Call("createBuffer")

	// Static UV buffer for image textures (uploaded with UNPACK_FLIP_Y,
	// so v=1 is the image top). Vertex order: TL, TR, BL, TR, BR, BL.
	uvs := []float32{0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0}
	r.uvBuf = gl.Call("createBuffer")
	gl.Call("bindBuffer", glArrayBuffer, r.uvBuf)
	gl.Call("bufferData", glArrayBuffer, r.floatsToJS(uvs), glStaticDraw)

	// UV buffer for FBO composite quads: FBO textures are NOT flipped
	// (v=0 is the GL bottom row), so the bottom-left clip vertex (-1,-1)
	// must sample v=0 — otherwise the whole shapes layer draws mirrored.
	fboUVs := []float32{0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1}
	r.uvBufFBO = gl.Call("createBuffer")
	gl.Call("bindBuffer", glArrayBuffer, r.uvBufFBO)
	gl.Call("bufferData", glArrayBuffer, r.floatsToJS(fboUVs), glStaticDraw)

	r.buf = js.Global().Get("Uint8Array").New(1 << 20) // 1 MB initial
	r.bufCap = 1 << 20
	r.matBuf = js.Global().Get("Uint8Array").New(36)
	r.matView = js.Global().Get("Float32Array").New(r.matBuf.Get("buffer"))

	gl.Call("enable", glBlend)
	return r, nil
}

func (r *Renderer) buildProgram(vsrc, fsrc string) (js.Value, error) {
	gl := r.gl
	compile := func(kind int, src string) (js.Value, error) {
		sh := gl.Call("createShader", kind)
		gl.Call("shaderSource", sh, src)
		gl.Call("compileShader", sh)
		if !gl.Call("getShaderParameter", sh, glCompileStatus).Bool() {
			log := gl.Call("getShaderInfoLog", sh).String()
			return js.Value{}, errors.New("shader: " + log)
		}
		return sh, nil
	}
	vs, err := compile(glVertexShader, vsrc)
	if err != nil {
		return js.Value{}, err
	}
	fs, err := compile(glFragmentShader, fsrc)
	if err != nil {
		return js.Value{}, err
	}
	prog := gl.Call("createProgram")
	gl.Call("attachShader", prog, vs)
	gl.Call("attachShader", prog, fs)
	gl.Call("linkProgram", prog)
	if !gl.Call("getProgramParameter", prog, glLinkStatus).Bool() {
		log := gl.Call("getProgramInfoLog", prog).String()
		return js.Value{}, errors.New("link: " + log)
	}
	return prog, nil
}

// floatsToJS copies a float32 slice into a JS Uint8Array (zero-copy view via unsafe).
func (r *Renderer) floatsToJS(f []float32) js.Value {
	need := len(f) * 4
	if need > r.bufCap {
		r.buf = js.Global().Get("Uint8Array").New(need * 2)
		r.bufCap = need * 2
	}
	b := unsafe.Slice((*byte)(unsafe.Pointer(&f[0])), need)
	js.CopyBytesToJS(r.buf, b)
	return r.buf.Call("subarray", 0, need)
}

func (r *Renderer) setView(loc js.Value, m mat3) {
	b := unsafe.Slice((*byte)(unsafe.Pointer(&m[0])), 36)
	js.CopyBytesToJS(r.matBuf, b)
	r.gl.Call("uniformMatrix3fv", loc, false, r.matView)
}

// viewMatrix maps world coords to clip space for the given viewport.
func viewMatrix(v *Viewport) mat3 {
	devW := float32(v.Width * v.DPR)
	devH := float32(v.Height * v.DPR)
	a := float32(2*v.Scale*v.DPR) / devW
	d := float32(-2*v.Scale*v.DPR) / devH
	tx := float32(2*v.OffsetX*v.DPR)/devW - 1
	ty := 1 - float32(2*v.OffsetY*v.DPR)/devH
	return mat3{a, 0, 0, 0, d, 0, tx, ty, 1}
}

// regionMatrix maps a world rect to clip space (PDF export).
func regionMatrix(minX, minY, w, h float64) mat3 {
	a := float32(2 / w)
	d := float32(-2 / h)
	tx := float32(-1 - 2*minX/w)
	ty := float32(1 + 2*minY/h)
	return mat3{a, 0, 0, 0, d, 0, tx, ty, 1}
}

// ── Tessellation (world-space triangles) ─────────────────────────────

func appendSeg(dst []float32, x0, y0, x1, y1, w float64) []float32 {
	dx, dy := x1-x0, y1-y0
	l := math.Hypot(dx, dy)
	if l == 0 {
		return dst
	}
	nx := -dy / l * w / 2
	ny := dx / l * w / 2
	return append(dst,
		float32(x0+nx), float32(y0+ny),
		float32(x0-nx), float32(y0-ny),
		float32(x1+nx), float32(y1+ny),
		float32(x1+nx), float32(y1+ny),
		float32(x0-nx), float32(y0-ny),
		float32(x1-nx), float32(y1-ny),
	)
}

func tessellate(s *Shape) (stroke, fill []float32) {
	w := s.StrokeWidth
	if w <= 0 {
		w = 2
	}
	switch s.Type {
	case "path":
		for i := 1; i < len(s.Points); i++ {
			stroke = appendSeg(stroke, s.Points[i-1].X, s.Points[i-1].Y, s.Points[i].X, s.Points[i].Y, w)
		}
	case "rect", "rectangle":
		x, y, rw, rh := s.X, s.Y, s.Width, s.Height
		stroke = appendSeg(stroke, x, y, x+rw, y, w)
		stroke = appendSeg(stroke, x+rw, y, x+rw, y+rh, w)
		stroke = appendSeg(stroke, x+rw, y+rh, x, y+rh, w)
		stroke = appendSeg(stroke, x, y+rh, x, y, w)
		if s.Fill != "" && s.Fill != "transparent" {
			fill = append(fill,
				float32(x), float32(y), float32(x+rw), float32(y), float32(x), float32(y+rh),
				float32(x+rw), float32(y), float32(x+rw), float32(y+rh), float32(x), float32(y+rh),
			)
		}
	case "circle":
		cx := s.X + s.Width/2
		cy := s.Y + s.Height/2
		r := math.Abs(math.Sqrt(s.Width*s.Width+s.Height*s.Height) / 2)
		const segs = 64
		ro := r + w/2
		ri := r - w/2
		if ri < 0 {
			ri = 0
		}
		for i := 0; i < segs; i++ {
			a0 := 2 * math.Pi * float64(i) / segs
			a1 := 2 * math.Pi * float64(i+1) / segs
			c0, s0 := math.Cos(a0), math.Sin(a0)
			c1, s1 := math.Cos(a1), math.Sin(a1)
			stroke = append(stroke,
				float32(cx+c0*ro), float32(cy+s0*ro),
				float32(cx+c0*ri), float32(cy+s0*ri),
				float32(cx+c1*ro), float32(cy+s1*ro),
				float32(cx+c1*ro), float32(cy+s1*ro),
				float32(cx+c0*ri), float32(cy+s0*ri),
				float32(cx+c1*ri), float32(cy+s1*ri),
			)
			if s.Fill != "" && s.Fill != "transparent" {
				fill = append(fill,
					float32(cx), float32(cy),
					float32(cx+c0*r), float32(cy+s0*r),
					float32(cx+c1*r), float32(cy+s1*r),
				)
			}
		}
	}
	return stroke, fill
}

func (r *Renderer) vertsFor(s *Shape) *shapeVerts {
	if c, ok := r.vertCache[s.ID]; ok && c.version == s.Version {
		return c
	}
	stroke, fill := tessellate(s)
	c, ok := r.vertCache[s.ID]
	if !ok {
		c = &shapeVerts{}
		r.vertCache[s.ID] = c
	}
	c.version = s.Version
	c.strokeSize = len(stroke) / 2
	c.fillSize = len(fill) / 2
	c.strokeBuf = r.uploadBuf(c.strokeBuf, stroke)
	c.fillBuf = r.uploadBuf(c.fillBuf, fill)
	return c
}

// uploadBuf (re)creates a GL buffer holding verts.
func (r *Renderer) uploadBuf(buf js.Value, verts []float32) js.Value {
	gl := r.gl
	if !buf.Truthy() {
		buf = gl.Call("createBuffer")
	}
	gl.Call("bindBuffer", glArrayBuffer, buf)
	if len(verts) > 0 {
		gl.Call("bufferData", glArrayBuffer, r.floatsToJS(verts), glStaticDraw)
	} else {
		gl.Call("bufferData", glArrayBuffer, 0, glStaticDraw)
	}
	return buf
}

// ── GL draw helpers ──────────────────────────────────────────────────

func (r *Renderer) drawFlat(verts []float32, count int, c Color, view mat3) {
	if count == 0 {
		return
	}
	gl := r.gl
	gl.Call("useProgram", r.progFlat)
	r.setView(r.flatUView, view)
	gl.Call("uniform4f", r.flatUColor, c.R, c.G, c.B, c.A)
	gl.Call("bindBuffer", glArrayBuffer, r.vbo)
	gl.Call("bufferData", glArrayBuffer, r.floatsToJS(verts[:count*2]), glDynamicDraw)
	gl.Call("vertexAttribPointer", r.flatAPos, 2, glFloat, false, 0, 0)
	gl.Call("enableVertexAttribArray", r.flatAPos)
	gl.Call("drawArrays", glTriangles, 0, count)
}

// drawBuf draws from a per-shape GPU buffer (no per-frame upload).
func (r *Renderer) drawBuf(buf js.Value, count int, c Color, view mat3) {
	if count == 0 {
		return
	}
	gl := r.gl
	gl.Call("useProgram", r.progFlat)
	r.setView(r.flatUView, view)
	gl.Call("uniform4f", r.flatUColor, c.R, c.G, c.B, c.A)
	gl.Call("bindBuffer", glArrayBuffer, buf)
	gl.Call("vertexAttribPointer", r.flatAPos, 2, glFloat, false, 0, 0)
	gl.Call("enableVertexAttribArray", r.flatAPos)
	gl.Call("drawArrays", glTriangles, 0, count)
}

func (r *Renderer) drawTextured(pos []float32, tex js.Value, uvBuf js.Value, view mat3) {
	gl := r.gl
	gl.Call("useProgram", r.progTex)
	r.setView(r.texUView, view)
	gl.Call("bindBuffer", glArrayBuffer, r.vbo)
	gl.Call("bufferData", glArrayBuffer, r.floatsToJS(pos), glDynamicDraw)
	gl.Call("vertexAttribPointer", r.texAPos, 2, glFloat, false, 0, 0)
	gl.Call("enableVertexAttribArray", r.texAPos)
	gl.Call("bindBuffer", glArrayBuffer, uvBuf)
	gl.Call("vertexAttribPointer", r.texAUV, 2, glFloat, false, 0, 0)
	gl.Call("enableVertexAttribArray", r.texAUV)
	gl.Call("bindTexture", glTexture2D, tex)
	gl.Call("uniform1i", r.texUTex, 0)
	gl.Call("drawArrays", glTriangles, 0, 6)
}

func (r *Renderer) createFBO(w, h int) (js.Value, js.Value) {
	gl := r.gl
	tex := gl.Call("createTexture")
	gl.Call("bindTexture", glTexture2D, tex)
	gl.Call("texImage2D", glTexture2D, 0, glRGBA, w, h, 0, glRGBA, glUnsignedByte, nil)
	gl.Call("texParameteri", glTexture2D, glTextureMinFilter, glLinear)
	gl.Call("texParameteri", glTexture2D, glTextureMagFilter, glLinear)
	gl.Call("texParameteri", glTexture2D, glTextureWrapS, glClampToEdge)
	gl.Call("texParameteri", glTexture2D, glTextureWrapT, glClampToEdge)
	fbo := gl.Call("createFramebuffer")
	gl.Call("bindFramebuffer", glFramebuffer, fbo)
	gl.Call("framebufferTexture2D", glFramebuffer, glColorAttachment0, glTexture2D, tex, 0)
	return fbo, tex
}

func (r *Renderer) ensureFBO(w, h int) {
	if r.fbo.Truthy() && r.fboW == w && r.fboH == h {
		return
	}
	if r.fbo.Truthy() {
		r.gl.Call("deleteFramebuffer", r.fbo)
		r.gl.Call("deleteTexture", r.fboTex)
	}
	r.fbo, r.fboTex = r.createFBO(w, h)
	r.fboW, r.fboH = w, h
}

// textureFor returns (and lazily creates) the GL texture for an image shape.
func (r *Renderer) textureFor(s *Shape) js.Value {
	if e, ok := r.textures[s.ID]; ok {
		if e.bad {
			return js.Value{}
		}
		return e.tex
	}
	e := &texEntry{}
	r.textures[s.ID] = e
	img, err := DecodeDataURL(s.Src)
	if err != nil {
		e.bad = true
		return js.Value{}
	}
	gl := r.gl
	ua := js.Global().Get("Uint8Array").New(len(img.Pix))
	js.CopyBytesToJS(ua, img.Pix)
	tex := gl.Call("createTexture")
	gl.Call("bindTexture", glTexture2D, tex)
	gl.Call("pixelStorei", glUnpackFlipY, 1)
	gl.Call("pixelStorei", glUnpackPremultiply, 1)
	gl.Call("texImage2D", glTexture2D, 0, glRGBA, img.Rect.Dx(), img.Rect.Dy(), 0, glRGBA, glUnsignedByte, ua)
	gl.Call("pixelStorei", glUnpackFlipY, 0)
	gl.Call("pixelStorei", glUnpackPremultiply, 0)
	gl.Call("texParameteri", glTexture2D, glTextureMinFilter, glLinear)
	gl.Call("texParameteri", glTexture2D, glTextureMagFilter, glLinear)
	gl.Call("texParameteri", glTexture2D, glTextureWrapS, glClampToEdge)
	gl.Call("texParameteri", glTexture2D, glTextureWrapT, glClampToEdge)
	e.tex = tex
	return tex
}

// prune drops vertex/texture cache entries for shapes that no longer exist.
func (r *Renderer) prune(st *State) {
	valid := make(map[int64]bool, len(st.Shapes))
	for i := range st.Shapes {
		valid[st.Shapes[i].ID] = true
	}
	for id, c := range r.vertCache {
		if !valid[id] {
			if c.strokeBuf.Truthy() {
				r.gl.Call("deleteBuffer", c.strokeBuf)
			}
			if c.fillBuf.Truthy() {
				r.gl.Call("deleteBuffer", c.fillBuf)
			}
			delete(r.vertCache, id)
		}
	}
	for id, e := range r.textures {
		if !valid[id] {
			if !e.bad {
				r.gl.Call("deleteTexture", e.tex)
			}
			delete(r.textures, id)
		}
	}
}

// ── Scene rendering ──────────────────────────────────────────────────

// drawImages draws layer 1 into the currently bound framebuffer.
func (r *Renderer) drawImages(st *State, view mat3) {
	gl := r.gl

	for i := range st.Shapes {
		s := &st.Shapes[i]
		if s.Type != "image" {
			continue
		}
		tex := r.textureFor(s)
		if !tex.Truthy() {
			continue
		}
		gl.Call("blendFunc", glOne, glOneMinusSrcAlpha)
		pos := []float32{
			float32(s.X), float32(s.Y),
			float32(s.X + s.Width), float32(s.Y),
			float32(s.X), float32(s.Y + s.Height),
			float32(s.X + s.Width), float32(s.Y),
			float32(s.X + s.Width), float32(s.Y + s.Height),
			float32(s.X), float32(s.Y + s.Height),
		}
		r.drawTextured(pos, tex, r.uvBuf, view)
	}
}

// drawDrawings draws layer 2 into the currently bound framebuffer. Eraser
// strokes use destination-out here, so they can only remove other drawings.
func (r *Renderer) drawDrawings(st *State, overlay OverlayProvider, view mat3) {
	for i := range st.Shapes {
		s := &st.Shapes[i]
		if s.Type == "image" {
			continue
		}
		r.drawVector(s, 1, view)
	}

	// In-progress preview shape (60% alpha, like the JS app)
	if overlay != nil {
		if pv := overlay.PreviewShape(); pv != nil {
			r.drawVector(pv, 0.6, view)
		}
	}
}

func (r *Renderer) drawVector(s *Shape, alphaMul float64, view mat3) {
	gl := r.gl
	if s.IsEraser() {
		gl.Call("blendFunc", glZero, glOneMinusSrcAlpha)
	} else {
		gl.Call("blendFunc", glOne, glOneMinusSrcAlpha)
	}

	fillColor := ParseColor(s.Fill)
	fillColor.A *= float32(alphaMul)
	strokeColor := ParseColor(s.Stroke)
	if strokeColor.A == 0 && s.Stroke == "" {
		strokeColor = Color{A: 1} // default stroke, matches ctx default
	}
	strokeColor.A *= float32(alphaMul)

	if s.ID == 0 {
		// Preview shapes are not cached: tessellate + upload via staging
		stroke, fill := tessellate(s)
		if len(fill) > 0 && !s.IsEraser() {
			r.drawFlat(fill, len(fill)/2, fillColor, view)
		}
		if len(stroke) > 0 {
			r.drawFlat(stroke, len(stroke)/2, strokeColor, view)
		}
		return
	}

	sv := r.vertsFor(s)
	if sv.fillSize > 0 && !s.IsEraser() {
		r.drawBuf(sv.fillBuf, sv.fillSize, fillColor, view)
	}
	if sv.strokeSize > 0 {
		r.drawBuf(sv.strokeBuf, sv.strokeSize, strokeColor, view)
	}
}

// gridVerts builds the background grid for the visible world region.
// Returns separate slices for normal and bold lines.
func gridVerts(v *Viewport) (normal, bold []float32) {
	const step = 50.0
	startX := math.Floor((-v.OffsetX/v.Scale)/step) * step
	startY := math.Floor((-v.OffsetY/v.Scale)/step) * step
	endX := math.Floor(((v.Width-v.OffsetX)/v.Scale)/step)*step + step
	endY := math.Floor(((v.Height-v.OffsetY)/v.Scale)/step)*step + step
	w := 1 / v.Scale

	for x := startX; x <= endX; x += step {
		dst := &normal
		if math.Mod(x, step*5) == 0 {
			dst = &bold
		}
		*dst = appendSeg(*dst, x, startY, x, endY, w)
	}
	for y := startY; y <= endY; y += step {
		dst := &normal
		if math.Mod(y, step*5) == 0 {
			dst = &bold
		}
		*dst = appendSeg(*dst, startX, y, endX, y, w)
	}
	return normal, bold
}

// selectionVerts builds the dashed selection outline.
func selectionVerts(s *Shape, scale float64) []float32 {
	minX, minY, maxX, maxY := s.Bounds()
	pad := 4.0
	if s.Type != "path" {
		pad = 2
	}
	x0, y0 := minX-pad, minY-pad
	x1, y1 := maxX+pad, maxY+pad
	w := 2 / scale
	dash := 6 / scale
	gap := 4 / scale

	var out []float32
	edges := [][4]float64{
		{x0, y0, x1, y0},
		{x1, y0, x1, y1},
		{x1, y1, x0, y1},
		{x0, y1, x0, y0},
	}
	for _, e := range edges {
		dx, dy := e[2]-e[0], e[3]-e[1]
		l := math.Hypot(dx, dy)
		if l == 0 {
			continue
		}
		ux, uy := dx/l, dy/l
		for t := 0.0; t < l; t += dash + gap {
			t2 := math.Min(t+dash, l)
			out = appendSeg(out, e[0]+ux*t, e[1]+uy*t, e[0]+ux*t2, e[1]+uy*t2, w)
		}
	}
	return out
}

var fullscreenQuad = []float32{-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1}

// Render draws one frame in strict layer order: screen, images, drawings.
func (r *Renderer) Render(st *State, overlay OverlayProvider, v *Viewport, theme *Theme) {
	gl := r.gl
	r.prune(st)

	devW := int(v.Width * v.DPR)
	devH := int(v.Height * v.DPR)
	if devW < 1 || devH < 1 {
		return
	}
	r.ensureFBO(devW, devH)
	view := viewMatrix(v)

	// Pass 1: drawing layer (2) into its own transparent FBO.
	gl.Call("bindFramebuffer", glFramebuffer, r.fbo)
	gl.Call("viewport", 0, 0, devW, devH)
	gl.Call("clearColor", 0, 0, 0, 0)
	gl.Call("clear", glColorBufferBit)
	r.drawDrawings(st, overlay, view)

	// Pass 2: default framebuffer — screen (0), images (1), drawings (2).
	gl.Call("bindFramebuffer", glFramebuffer, nil)
	gl.Call("viewport", 0, 0, devW, devH)
	bg := ParseColor(theme.Background)
	gl.Call("clearColor", bg.R, bg.G, bg.B, 1)
	gl.Call("clear", glColorBufferBit)

	gl.Call("blendFunc", glOne, glOneMinusSrcAlpha)
	normal, bold := gridVerts(v)
	r.drawFlat(normal, len(normal)/2, ParseColor(theme.GridColor), view)
	r.drawFlat(bold, len(bold)/2, ParseColor(theme.GridBoldColor), view)

	gl.Call("blendFunc", glOne, glOneMinusSrcAlpha)
	r.drawImages(st, view)

	gl.Call("blendFunc", glOne, glOneMinusSrcAlpha)
	r.drawTextured(fullscreenQuad, r.fboTex, r.uvBufFBO, identityView)

	if overlay != nil {
		if id := overlay.SelectedShapeID(); id >= 0 {
			if s := st.Get(id); s != nil {
				verts := selectionVerts(s, v.Scale)
				sel := ParseColor("#4a9eff")
				r.drawFlat(verts, len(verts)/2, sel, view)
			}
		}
	}
}

// ExportRegion renders the scene region into a temporary FBO at the given
// scale and returns premultiplied RGBA pixels, row-flipped for ImageData.
// The export uses the same screen → image → drawing layer order as Render.
func (r *Renderer) ExportRegion(st *State, theme *Theme, minX, minY, w, h, scale float64) (js.Value, error) {
	gl := r.gl
	devW := int(w * scale)
	devH := int(h * scale)
	if devW < 1 || devH < 1 || devW > 16384 || devH > 16384 {
		return js.Value{}, errors.New("invalid export size")
	}
	view := regionMatrix(minX, minY, w, h)

	// Pass 1: drawings into a temp layer (eraser applies only here).
	layerFBO, layerTex := r.createFBO(devW, devH)
	gl.Call("bindFramebuffer", glFramebuffer, layerFBO)
	gl.Call("viewport", 0, 0, devW, devH)
	gl.Call("clearColor", 0, 0, 0, 0)
	gl.Call("clear", glColorBufferBit)
	r.drawDrawings(st, nil, view)

	// Pass 2: screen (0), images (1), drawings (2).
	expFBO, expTex := r.createFBO(devW, devH)
	gl.Call("bindFramebuffer", glFramebuffer, expFBO)
	gl.Call("viewport", 0, 0, devW, devH)
	bg := ParseColor(theme.Background)
	gl.Call("clearColor", bg.R, bg.G, bg.B, 1)
	gl.Call("clear", glColorBufferBit)
	gl.Call("blendFunc", glOne, glOneMinusSrcAlpha)
	r.drawImages(st, view)
	gl.Call("blendFunc", glOne, glOneMinusSrcAlpha)
	r.drawTextured(fullscreenQuad, layerTex, r.uvBufFBO, identityView)

	// Read back + flip rows (readPixels starts at the bottom row)
	n := devW * devH * 4
	pixels := js.Global().Get("Uint8Array").New(n)
	gl.Call("readPixels", 0, 0, devW, devH, glRGBA, glUnsignedByte, pixels)

	goBuf := make([]byte, n)
	js.CopyBytesToGo(goBuf, pixels)
	row := devW * 4
	for y := 0; y < devH/2; y++ {
		top := y * row
		bot := (devH - 1 - y) * row
		for x := 0; x < row; x++ {
			goBuf[top+x], goBuf[bot+x] = goBuf[bot+x], goBuf[top+x]
		}
	}
	js.CopyBytesToJS(pixels, goBuf)

	// Cleanup temp GL objects and restore the main FBO binding
	gl.Call("deleteFramebuffer", layerFBO)
	gl.Call("deleteTexture", layerTex)
	gl.Call("deleteFramebuffer", expFBO)
	gl.Call("deleteTexture", expTex)
	gl.Call("bindFramebuffer", glFramebuffer, nil)

	return pixels, nil
}
