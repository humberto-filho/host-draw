package core

// Viewport tracks the infinite-board camera: offset (CSS px), scale and
// canvas size. All pan/zoom math lives here (previously canvas.js).
type Viewport struct {
	OffsetX float64
	OffsetY float64
	Scale   float64
	Width   float64 // CSS px
	Height  float64 // CSS px
	DPR     float64
}

func NewViewport() *Viewport {
	return &Viewport{Scale: 1, DPR: 1}
}

// ScreenToWorld converts canvas-relative screen coords to world coords.
func (v *Viewport) ScreenToWorld(sx, sy float64) (float64, float64) {
	return (sx - v.OffsetX) / v.Scale, (sy - v.OffsetY) / v.Scale
}

// Pan shifts the viewport by a screen-space delta.
func (v *Viewport) Pan(dx, dy float64) {
	v.OffsetX += dx
	v.OffsetY += dy
}

// ZoomAt zooms around a screen point, clamped to [0.1, 5].
func (v *Viewport) ZoomAt(mx, my, deltaY float64) {
	const sensitivity = 0.001
	delta := -deltaY * sensitivity
	newScale := v.Scale + delta
	if newScale < 0.1 {
		newScale = 0.1
	} else if newScale > 5 {
		newScale = 5
	}

	worldX, worldY := v.ScreenToWorld(mx, my)
	v.Scale = newScale
	v.OffsetX = mx - worldX*v.Scale
	v.OffsetY = my - worldY*v.Scale
}

// Resize updates canvas size and pixel ratio.
func (v *Viewport) Resize(w, h, dpr float64) {
	v.Width = w
	v.Height = h
	if dpr > 0 {
		v.DPR = dpr
	}
}

// CenterWorld returns the world coords at the viewport center.
func (v *Viewport) CenterWorld() (float64, float64) {
	return v.ScreenToWorld(v.Width/2, v.Height/2)
}
