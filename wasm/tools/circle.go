package tools

import (
	"math"

	"hostdraw/core"
)

// CircleTool draws circles from a drag bounding box (port of circle.js).
type CircleTool struct {
	BaseTool
	drawing bool
	start   core.Point
	current *core.Shape
}

func NewCircleTool(env *Env) *CircleTool {
	return &CircleTool{BaseTool: newBase(env, "circle")}
}

func (t *CircleTool) Cancel() {
	t.drawing = false
	t.current = nil
	t.BaseTool.Cancel()
}

func (t *CircleTool) Deactivate() {
	t.Cancel()
	t.BaseTool.Deactivate()
}

func (t *CircleTool) OnPointerDown(e *PointerEvent) {
	t.drawing = true
	t.start = core.Point{X: e.X, Y: e.Y}
	t.current = &core.Shape{
		Type:        "circle",
		X:           e.X,
		Y:           e.Y,
		Stroke:      t.env.Style.StrokeColor,
		StrokeWidth: t.env.Style.StrokeWidth,
		Fill:        t.env.Style.FillColor,
	}
	t.preview = t.current
	t.env.Hooks.MarkDirty()
}

func (t *CircleTool) OnPointerMove(e *PointerEvent) {
	if !t.drawing {
		return
	}
	t.current.Width = e.X - t.start.X
	t.current.Height = e.Y - t.start.Y
	t.env.Hooks.MarkDirty()
}

func (t *CircleTool) OnPointerUp(e *PointerEvent) {
	if !t.drawing {
		return
	}
	t.drawing = false
	if t.current != nil && (math.Abs(t.current.Width) > 0 || math.Abs(t.current.Height) > 0) {
		t.env.State.AddShape(*t.current)
	}
	t.preview = nil
	t.current = nil
}
