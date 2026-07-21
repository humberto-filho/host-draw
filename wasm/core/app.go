//go:build js && wasm

package core

import (
	"encoding/json"
	"syscall/js"
)

// Theme holds the renderer-facing theme colors (subset of the JS config).
type Theme struct {
	Background    string `json:"background"`
	GridColor     string `json:"gridColor"`
	GridBoldColor string `json:"gridBoldColor"`
}

// OverlayProvider supplies the in-progress preview shape and the current
// selection (implemented by the tools Manager, avoids an import cycle).
type OverlayProvider interface {
	PreviewShape() *Shape
	SelectedShapeID() int64
}

// App wires state, viewport and renderer; it also implements Hooks so the
// js-free core can reach the JS callbacks.
type App struct {
	State   *State
	View    *Viewport
	Theme   Theme
	Overlay OverlayProvider

	rend  *Renderer
	cb    js.Value
	dirty bool
}

func NewApp() *App {
	a := &App{
		View: NewViewport(),
		Theme: Theme{
			Background:    "#ffffff",
			GridColor:     "rgba(0,0,0,0.1)",
			GridBoldColor: "rgba(0,0,0,0.2)",
		},
	}
	a.State = NewState(a)
	return a
}

// ── Hooks implementation ─────────────────────────────────────────────

func (a *App) MarkDirty() { a.dirty = true }

func (a *App) StateChanged() {
	if a.cb.Truthy() {
		a.cb.Call("stateChanged", a.State.ExportJSON())
	}
}

func (a *App) Popup(msg string) {
	if a.cb.Truthy() {
		a.cb.Call("popup", msg)
	}
}

func (a *App) SelectionChanged(selected bool) {
	if a.cb.Truthy() {
		a.cb.Call("selectionChanged", selected)
	}
}

// ── Lifecycle ────────────────────────────────────────────────────────

func (a *App) SetCallbacks(cb js.Value) { a.cb = cb }

// InitRenderer grabs the GL context from the canvas element.
func (a *App) InitRenderer(canvasID string) error {
	doc := js.Global().Get("document")
	canvas := doc.Call("getElementById", canvasID)
	if !canvas.Truthy() {
		return &initError{"canvas not found: " + canvasID}
	}
	r, err := NewRenderer(canvas)
	if err != nil {
		return err
	}
	a.rend = r
	a.MarkDirty()
	return nil
}

type initError struct{ msg string }

func (e *initError) Error() string { return e.msg }

// Frame renders every rAF tick, like the original JS render loop.
// Presenting continuously avoids compositors that drop or delay a frame
// produced without accompanying pointer activity (async image inserts were
// only showing up after the next mouse move). Frames stay cheap because
// shapes live in per-shape GPU buffers (see vertsFor).
func (a *App) Frame() {
	if a.rend == nil {
		return
	}
	a.dirty = false
	a.rend.Render(a.State, a.Overlay, a.View, &a.Theme)
}

// Resize updates the viewport and canvas backing store size.
func (a *App) Resize(w, h, dpr float64) {
	a.View.Resize(w, h, dpr)
	a.MarkDirty()
}

// SetTheme applies renderer theme colors from JSON.
func (a *App) SetTheme(jsonStr string) {
	if jsonStr == "" {
		return
	}
	var t Theme
	if err := json.Unmarshal([]byte(jsonStr), &t); err != nil {
		return
	}
	if t.Background != "" {
		a.Theme.Background = t.Background
	}
	if t.GridColor != "" {
		a.Theme.GridColor = t.GridColor
	}
	if t.GridBoldColor != "" {
		a.Theme.GridBoldColor = t.GridBoldColor
	}
	a.MarkDirty()
}

// RemapColors rewrites stroke colors for a theme switch (JSON string map).
func (a *App) RemapColors(jsonStr string) {
	var mapping map[string]string
	if err := json.Unmarshal([]byte(jsonStr), &mapping); err != nil {
		return
	}
	a.State.RemapColors(mapping)
}

// AddImage registers an image shape; the texture is decoded lazily by the
// renderer (Go-native PNG/JPEG/GIF decoding from the data URL).
func (a *App) AddImage(dataURL string, x, y, w, h float64) {
	a.State.AddShape(Shape{
		Type:   "image",
		X:      x,
		Y:      y,
		Width:  w,
		Height: h,
		Src:    dataURL,
	})
}

// ExportRegion renders a world rect at scale and returns RGBA pixels
// (row-flipped for ImageData) as a JS Uint8Array.
func (a *App) ExportRegion(minX, minY, w, h, scale float64) (js.Value, error) {
	if a.rend == nil {
		return js.Value{}, &initError{"renderer not initialized"}
	}
	return a.rend.ExportRegion(a.State, &a.Theme, minX, minY, w, h, scale)
}
