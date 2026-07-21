package tools

import "hostdraw/core"

// PencilTool draws freehand paths (port of pencil.js).
type PencilTool struct {
	BaseTool
	drawing bool
	current *core.Shape
}

func NewPencilTool(env *Env) *PencilTool {
	return &PencilTool{BaseTool: newBase(env, "pencil")}
}

// Cancel discards an interrupted stroke instead of leaving it as a preview.
func (t *PencilTool) Cancel() {
	t.drawing = false
	t.current = nil
	t.BaseTool.Cancel()
}

func (t *PencilTool) Deactivate() {
	t.Cancel()
	t.BaseTool.Deactivate()
}

func (t *PencilTool) OnPointerDown(e *PointerEvent) {
	t.drawing = true
	t.current = &core.Shape{
		Type:        "path",
		Points:      []core.Point{{X: e.X, Y: e.Y}},
		Stroke:      t.env.Style.StrokeColor,
		StrokeWidth: t.env.Style.StrokeWidth,
		Fill:        "transparent",
	}
	t.preview = t.current
	t.env.Hooks.MarkDirty()
}

func (t *PencilTool) OnPointerMove(e *PointerEvent) {
	if !t.drawing {
		return
	}
	t.current.Points = append(t.current.Points, core.Point{X: e.X, Y: e.Y})
	t.env.Hooks.MarkDirty()
}

func (t *PencilTool) OnPointerUp(e *PointerEvent) {
	if !t.drawing {
		return
	}
	t.drawing = false
	if t.current != nil {
		t.env.State.AddShape(*t.current)
		t.preview = nil
		t.current = nil
	}
}
