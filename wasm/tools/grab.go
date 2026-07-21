package tools

// GrabTool selects, moves, deletes and copy/pastes shapes (port of grab.js).
type GrabTool struct {
	BaseTool
	dragging   bool
	dragID     int64
	selectedID int64
	offsetX    float64
	offsetY    float64
	totalDX    float64
	totalDY    float64
}

func NewGrabTool(env *Env) *GrabTool {
	return &GrabTool{BaseTool: newBase(env, "grab"), dragID: -1, selectedID: -1}
}

func (t *GrabTool) SelectedShapeID() int64 { return t.selectedID }

func (t *GrabTool) Deactivate() {
	t.Cancel()
	t.BaseTool.Deactivate()
	t.selectedID = -1
	t.env.Hooks.SelectionChanged(false)
}

func (t *GrabTool) Cancel() {
	t.dragging = false
	t.dragID = -1
	t.totalDX, t.totalDY = 0, 0
	t.BaseTool.Cancel()
}

func (t *GrabTool) OnPointerDown(e *PointerEvent) {
	id := t.env.State.HitTest(e.X, e.Y)
	t.selectedID = -1
	if id >= 0 {
		sh := t.env.State.Get(id)
		t.dragging = true
		t.dragID = id
		t.selectedID = id
		origin := sh.Origin()
		t.offsetX = e.X - origin.X
		t.offsetY = e.Y - origin.Y
		t.totalDX, t.totalDY = 0, 0
	}
	t.env.Hooks.SelectionChanged(t.selectedID >= 0)
	t.env.Hooks.MarkDirty()
}

func (t *GrabTool) OnPointerMove(e *PointerEvent) {
	if !t.dragging || t.dragID < 0 {
		return
	}
	sh := t.env.State.Get(t.dragID)
	if sh == nil {
		return
	}
	newOriginX := e.X - t.offsetX
	newOriginY := e.Y - t.offsetY
	old := sh.Origin()
	dx := newOriginX - old.X
	dy := newOriginY - old.Y
	t.env.State.TranslateShape(t.dragID, dx, dy)
	t.totalDX += dx
	t.totalDY += dy
}

func (t *GrabTool) OnPointerUp(e *PointerEvent) {
	if t.dragging && t.dragID >= 0 {
		t.env.State.RecordMove(t.dragID, t.totalDX, t.totalDY)
	}
	t.dragging = false
	t.dragID = -1
}

func (t *GrabTool) OnKeyDown(e *KeyEvent) {
	// Delete / Backspace — remove selected shape
	if (e.Key == "Delete" || e.Key == "Backspace") && t.selectedID >= 0 {
		t.env.State.DeleteShape(t.selectedID)
		t.selectedID = -1
		t.env.Hooks.SelectionChanged(false)
		return
	}

	// Ctrl+C — copy selected shape
	if e.Key == "c" && (e.Ctrl || e.Meta) && t.selectedID >= 0 {
		if sh := t.env.State.Get(t.selectedID); sh != nil {
			clone := sh.Clone()
			t.env.State.Clipboard = &clone
			t.env.Hooks.Popup("Copied")
		}
		return
	}

	// Ctrl+V — paste shape at +20 offset (cascades like the JS app)
	if e.Key == "v" && (e.Ctrl || e.Meta) && t.env.State.Clipboard != nil {
		clone := t.env.State.Clipboard.Clone()
		clone.Translate(20, 20)
		newID := t.env.State.AddShape(clone)
		t.selectedID = newID
		cascaded := clone.Clone()
		cascaded.ID = 0
		t.env.State.Clipboard = &cascaded
		t.env.Hooks.SelectionChanged(true)
		return
	}
}
