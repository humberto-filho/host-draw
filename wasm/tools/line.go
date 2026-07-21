package tools

import "hostdraw/core"

// LineTool draws straight two-point paths (port of line.js).
type LineTool struct {
	BaseTool
	drawing bool
	start   core.Point
	current *core.Shape
}

func NewLineTool(env *Env) *LineTool {
	return &LineTool{BaseTool: newBase(env, "line")}
}

func (t *LineTool) Cancel() {
	t.drawing = false
	t.current = nil
	t.BaseTool.Cancel()
}

func (t *LineTool) Deactivate() {
	t.Cancel()
	t.BaseTool.Deactivate()
}

func (t *LineTool) OnPointerDown(e *PointerEvent) {
	t.drawing = true
	t.start = core.Point{X: e.X, Y: e.Y}
	t.current = &core.Shape{
		Type:        "path",
		Points:      []core.Point{t.start, t.start},
		Stroke:      t.env.Style.StrokeColor,
		StrokeWidth: t.env.Style.StrokeWidth,
		Fill:        "transparent",
	}
	t.preview = t.current
	t.env.Hooks.MarkDirty()
}

func (t *LineTool) OnPointerMove(e *PointerEvent) {
	if !t.drawing {
		return
	}
	t.current.Points = []core.Point{t.start, {X: e.X, Y: e.Y}}
	t.env.Hooks.MarkDirty()
}

func (t *LineTool) OnPointerUp(e *PointerEvent) {
	if !t.drawing {
		return
	}
	t.drawing = false
	if t.current != nil {
		t.current.Points = []core.Point{t.start, {X: e.X, Y: e.Y}}
		t.env.State.AddShape(*t.current)
		t.preview = nil
		t.current = nil
	}
}
