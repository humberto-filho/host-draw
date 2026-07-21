package tools

import "hostdraw/core"

// Style is the active visual style (mirrors ToolManager.style in JS).
type Style struct {
	StrokeColor string
	StrokeWidth float64
	FillColor   string
}

// Env gives tools access to the core without an import cycle.
type Env struct {
	State *core.State
	View  *core.Viewport
	Hooks core.Hooks
	Style Style
}

// PointerEvent carries world coords plus the raw button/modifier info.
type PointerEvent struct {
	X, Y   float64 // world coords
	Button int
	Space  bool
}

// KeyEvent carries a key plus modifiers.
type KeyEvent struct {
	Key  string
	Ctrl bool
	Meta bool
}

// Tool mirrors BaseTool in the JS app.
type Tool interface {
	Name() string
	Activate()
	Deactivate()
	OnPointerDown(e *PointerEvent)
	OnPointerMove(e *PointerEvent)
	OnPointerUp(e *PointerEvent)
	OnKeyDown(e *KeyEvent)
	OnKeyUp(e *KeyEvent)
	PreviewShape() *core.Shape
	SelectedShapeID() int64
}

// BaseTool provides default no-op behavior for embedding.
type BaseTool struct {
	env     *Env
	name    string
	active  bool
	preview *core.Shape
}

func newBase(env *Env, name string) BaseTool {
	return BaseTool{env: env, name: name}
}

func (t *BaseTool) Name() string                { return t.name }
func (t *BaseTool) Activate()                   { t.active = true }
func (t *BaseTool) Deactivate()                 { t.active = false; t.preview = nil }
func (t *BaseTool) OnPointerDown(*PointerEvent) {}
func (t *BaseTool) OnPointerMove(*PointerEvent) {}
func (t *BaseTool) OnPointerUp(*PointerEvent)   {}
func (t *BaseTool) OnKeyDown(*KeyEvent)         {}
func (t *BaseTool) OnKeyUp(*KeyEvent)           {}
func (t *BaseTool) PreviewShape() *core.Shape   { return t.preview }
func (t *BaseTool) SelectedShapeID() int64      { return -1 }
func (t *BaseTool) Cancel()                     { t.preview = nil }
