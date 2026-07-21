package tools

import (
	"math"

	"hostdraw/core"
)

// RectangleTool draws rectangles, normalized on mouse-up (port of rectangle.js).
type RectangleTool struct {
	BaseTool
	drawing bool
	start   core.Point
	current *core.Shape
}

func NewRectangleTool(env *Env) *RectangleTool {
	return &RectangleTool{BaseTool: newBase(env, "rectangle")}
}

func (t *RectangleTool) Cancel() {
	t.drawing = false
	t.current = nil
	t.BaseTool.Cancel()
}

func (t *RectangleTool) Deactivate() {
	t.Cancel()
	t.BaseTool.Deactivate()
}

func (t *RectangleTool) OnPointerDown(e *PointerEvent) {
	t.drawing = true
	t.start = core.Point{X: e.X, Y: e.Y}
	t.current = &core.Shape{
		Type:        "rectangle",
		X:           e.X,
		Y:           e.Y,
		Stroke:      t.env.Style.StrokeColor,
		StrokeWidth: t.env.Style.StrokeWidth,
		Fill:        t.env.Style.FillColor,
	}
	t.preview = t.current
	t.env.Hooks.MarkDirty()
}

func (t *RectangleTool) OnPointerMove(e *PointerEvent) {
	if !t.drawing {
		return
	}
	t.current.Width = e.X - t.start.X
	t.current.Height = e.Y - t.start.Y
	t.env.Hooks.MarkDirty()
}

func (t *RectangleTool) OnPointerUp(e *PointerEvent) {
	if !t.drawing {
		return
	}
	t.drawing = false
	if t.current != nil && (math.Abs(t.current.Width) > 0 || math.Abs(t.current.Height) > 0) {
		// Normalize negative width/height
		if t.current.Width < 0 {
			t.current.X += t.current.Width
			t.current.Width = math.Abs(t.current.Width)
		}
		if t.current.Height < 0 {
			t.current.Y += t.current.Height
			t.current.Height = math.Abs(t.current.Height)
		}
		t.env.State.AddShape(*t.current)
	}
	t.preview = nil
	t.current = nil
}
