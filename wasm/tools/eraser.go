package tools

// EraserTool is a pencil stroke rendered with destination-out blending
// (port of eraser.js).
type EraserTool struct {
	PencilTool
}

func NewEraserTool(env *Env) *EraserTool {
	t := &EraserTool{PencilTool: PencilTool{BaseTool: newBase(env, "eraser")}}
	return t
}

func (t *EraserTool) OnPointerDown(e *PointerEvent) {
	t.PencilTool.OnPointerDown(e)
	if t.current != nil {
		t.current.Stroke = "#000000" // placeholder, erased by blend mode
		t.current.Composite = "destination-out"
		// Eraser is 4x the current stroke, at least 10px
		w := t.env.Style.StrokeWidth
		if w <= 0 {
			w = 2
		}
		if w*4 > 10 {
			t.current.StrokeWidth = w * 4
		} else {
			t.current.StrokeWidth = 10
		}
	}
}
