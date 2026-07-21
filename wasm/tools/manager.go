package tools

import "hostdraw/core"

// Manager owns the tool set and routes input events. Panning (middle mouse
// or Space+left drag) and wheel zoom live here, replacing the JS canvas.js
// input logic.
type Manager struct {
	env     *Env
	Tools   map[string]Tool
	Current Tool

	panning bool
	lastX   float64
	lastY   float64
}

func NewManager(env *Env) *Manager {
	m := &Manager{env: env, Tools: map[string]Tool{}}
	m.Register(NewPencilTool(env))
	m.Register(NewEraserTool(env))
	m.Register(NewLineTool(env))
	m.Register(NewRectangleTool(env))
	m.Register(NewCircleTool(env))
	m.Register(NewGrabTool(env))
	m.SetTool("pencil")
	return m
}

func (m *Manager) Register(t Tool) {
	m.Tools[t.Name()] = t
}

func (m *Manager) SetTool(name string) {
	if m.Current != nil {
		m.Current.Deactivate()
	}
	t, ok := m.Tools[name]
	if !ok {
		return
	}
	m.Current = t
	t.Activate()
}

func (m *Manager) pointerEvent(sx, sy float64, button int, space bool) *PointerEvent {
	wx, wy := m.env.View.ScreenToWorld(sx, sy)
	return &PointerEvent{X: wx, Y: wy, Button: button, Space: space}
}

// PointerDown handles a canvas mousedown (screen coords, canvas-relative).
func (m *Manager) PointerDown(sx, sy float64, button int, space bool) {
	// Middle mouse or Space+Left = panning
	if button == 1 || (button == 0 && space) {
		m.panning = true
		m.lastX, m.lastY = sx, sy
		return
	}
	if button == 0 && m.Current != nil {
		m.Current.OnPointerDown(m.pointerEvent(sx, sy, button, space))
	}
}

// PointerMove handles mousemove (window-level, like the JS app).
func (m *Manager) PointerMove(sx, sy float64) {
	if m.panning {
		m.env.View.Pan(sx-m.lastX, sy-m.lastY)
		m.lastX, m.lastY = sx, sy
		m.env.Hooks.MarkDirty()
		return
	}
	if m.Current != nil {
		m.Current.OnPointerMove(m.pointerEvent(sx, sy, 0, false))
	}
}

// PointerUp handles mouseup.
func (m *Manager) PointerUp(sx, sy float64, button int) {
	if m.panning {
		m.panning = false
		return
	}
	if button == 0 && m.Current != nil {
		m.Current.OnPointerUp(m.pointerEvent(sx, sy, button, false))
	}
}

// Cancel discards a pointer action that ended outside the canvas or was
// interrupted by UI interaction. It prevents an off-canvas coordinate from
// being committed as a long preview stroke.
func (m *Manager) Cancel() {
	m.panning = false
	if t, ok := m.Current.(interface{ Cancel() }); ok {
		t.Cancel()
	}
	m.env.Hooks.MarkDirty()
}

// Wheel zooms around the cursor.
func (m *Manager) Wheel(sx, sy, deltaY float64) {
	m.env.View.ZoomAt(sx, sy, deltaY)
	m.env.Hooks.MarkDirty()
}

// Key routes keydown/keyup to the active tool.
func (m *Manager) Key(kind, key string, ctrl, meta bool) {
	if m.Current == nil {
		return
	}
	e := &KeyEvent{Key: key, Ctrl: ctrl, Meta: meta}
	if kind == "keydown" {
		m.Current.OnKeyDown(e)
	} else {
		m.Current.OnKeyUp(e)
	}
}

// PreviewShape implements core.OverlayProvider: the in-progress shape, if any.
func (m *Manager) PreviewShape() *core.Shape {
	if m.Current == nil {
		return nil
	}
	return m.Current.PreviewShape()
}

// SelectedShapeID implements core.OverlayProvider: grab selection, or -1.
func (m *Manager) SelectedShapeID() int64 {
	if m.Current == nil {
		return -1
	}
	return m.Current.SelectedShapeID()
}
