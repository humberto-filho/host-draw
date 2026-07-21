package core

import (
	"encoding/json"
	"math"
	"strings"
)

// Hooks lets the js-free core notify the wasm/JS shell about changes.
type Hooks interface {
	MarkDirty()
	StateChanged()
	Popup(msg string)
	SelectionChanged(selected bool)
}

// NopHooks is a Hooks implementation that does nothing (tests, headless use).
type NopHooks struct{}

func (NopHooks) MarkDirty()            {}
func (NopHooks) StateChanged()         {}
func (NopHooks) Popup(string)          {}
func (NopHooks) SelectionChanged(bool) {}

const maxUndo = 50

type opKind int

const (
	opAdd opKind = iota
	opDelete
	opMove
	opReplaceAll
)

// undoOp stores the inverse of a mutation — no full-scene snapshots.
type undoOp struct {
	kind   opKind
	id     int64
	index  int
	shape  Shape   // payload for opDelete (reinsert)
	shapes []Shape // payload for opReplaceAll (restore)
	dx, dy float64 // payload for opMove (inverse translate)
}

// State holds the scene shapes plus an operation-based undo stack.
type State struct {
	Shapes    []Shape
	Clipboard *Shape

	hooks  Hooks
	nextID int64
	undo   []undoOp
}

func NewState(h Hooks) *State {
	if h == nil {
		h = NopHooks{}
	}
	return &State{hooks: h, nextID: 1}
}

// AddShape appends a shape and records it for undo. Returns the new ID.
func (s *State) AddShape(sh Shape) int64 {
	sh.ID = s.nextID
	s.nextID++
	sh.Version = 1
	s.Shapes = append(s.Shapes, sh)
	s.push(undoOp{kind: opAdd, id: sh.ID})
	s.hooks.MarkDirty()
	s.hooks.StateChanged()
	return sh.ID
}

// Get returns a pointer to the shape with the given ID, or nil.
func (s *State) Get(id int64) *Shape {
	if i := s.find(id); i >= 0 {
		return &s.Shapes[i]
	}
	return nil
}

// TranslateShape moves a shape without recording undo (live drag);
// call RecordMove once the gesture ends.
func (s *State) TranslateShape(id int64, dx, dy float64) {
	sh := s.Get(id)
	if sh == nil {
		return
	}
	sh.Translate(dx, dy)
	sh.Version++
	s.hooks.MarkDirty()
}

// RecordMove pushes the accumulated drag delta onto the undo stack.
func (s *State) RecordMove(id int64, dx, dy float64) {
	if dx == 0 && dy == 0 {
		return
	}
	s.push(undoOp{kind: opMove, id: id, dx: dx, dy: dy})
	s.hooks.StateChanged()
}

// DeleteShape removes a shape, recording it for undo.
func (s *State) DeleteShape(id int64) bool {
	i := s.find(id)
	if i < 0 {
		return false
	}
	sh := s.Shapes[i]
	s.Shapes = append(s.Shapes[:i], s.Shapes[i+1:]...)
	s.push(undoOp{kind: opDelete, index: i, shape: sh})
	s.hooks.MarkDirty()
	s.hooks.StateChanged()
	return true
}

// Clear removes all shapes (undoable).
func (s *State) Clear() {
	if len(s.Shapes) == 0 {
		return
	}
	old := s.Shapes
	s.Shapes = nil
	s.push(undoOp{kind: opReplaceAll, shapes: old})
	s.hooks.MarkDirty()
	s.hooks.StateChanged()
}

// Undo reverts the most recent operation. Returns false when nothing is left.
func (s *State) Undo() bool {
	if len(s.undo) == 0 {
		return false
	}
	op := s.undo[len(s.undo)-1]
	s.undo = s.undo[:len(s.undo)-1]
	switch op.kind {
	case opAdd:
		if i := s.find(op.id); i >= 0 {
			s.Shapes = append(s.Shapes[:i], s.Shapes[i+1:]...)
		}
	case opDelete:
		i := op.index
		if i > len(s.Shapes) {
			i = len(s.Shapes)
		}
		s.Shapes = append(s.Shapes, Shape{})
		copy(s.Shapes[i+1:], s.Shapes[i:])
		s.Shapes[i] = op.shape
	case opMove:
		if sh := s.Get(op.id); sh != nil {
			sh.Translate(-op.dx, -op.dy)
			sh.Version++
		}
	case opReplaceAll:
		s.Shapes = op.shapes
	}
	s.hooks.MarkDirty()
	s.hooks.StateChanged()
	return true
}

// ImportShapes replaces the entire document. Previous shapes, image data,
// clipboard contents and undo history are released rather than retained.
func (s *State) ImportShapes(data string) error {
	var shapes []Shape
	if err := json.Unmarshal([]byte(data), &shapes); err != nil {
		return err
	}
	for i := range shapes {
		shapes[i].ID = s.nextID
		s.nextID++
		shapes[i].Version = 1
	}
	s.Shapes = shapes
	s.Clipboard = nil
	s.undo = nil
	s.hooks.MarkDirty()
	s.hooks.StateChanged()
	return nil
}

// ExportJSON serializes the scene in the original JS schema.
func (s *State) ExportJSON() string {
	b, err := json.Marshal(s.Shapes)
	if err != nil {
		return "[]"
	}
	return string(b)
}

// RemapColors rewrites stroke colors using a lower-case-hex keyed mapping
// (theme switch), mirroring the old remapShapeColors.
func (s *State) RemapColors(mapping map[string]string) {
	for i := range s.Shapes {
		if s.Shapes[i].Stroke == "" {
			continue
		}
		key := strings.ToLower(s.Shapes[i].Stroke)
		if to, ok := mapping[key]; ok {
			s.Shapes[i].Stroke = to
			s.Shapes[i].Version++
		}
	}
	s.hooks.MarkDirty()
	s.hooks.StateChanged()
}

// Bounds returns the bounding box of the whole scene.
func (s *State) Bounds() (minX, minY, maxX, maxY float64, ok bool) {
	if len(s.Shapes) == 0 {
		return 0, 0, 0, 0, false
	}
	minX, minY = math.Inf(1), math.Inf(1)
	maxX, maxY = math.Inf(-1), math.Inf(-1)
	for i := range s.Shapes {
		x0, y0, x1, y1 := s.Shapes[i].Bounds()
		minX = math.Min(minX, x0)
		minY = math.Min(minY, y0)
		maxX = math.Max(maxX, x1)
		maxY = math.Max(maxY, y1)
	}
	return minX, minY, maxX, maxY, true
}

// HitTest returns the ID of the topmost shape containing (wx, wy), or -1.
// Eraser strokes are skipped (they are not grab-able), as in the JS grab tool.
func (s *State) HitTest(wx, wy float64) int64 {
	for i := len(s.Shapes) - 1; i >= 0; i-- {
		sh := &s.Shapes[i]
		if sh.IsEraser() {
			continue
		}
		if shapeContains(sh, wx, wy) {
			return sh.ID
		}
	}
	return -1
}

func shapeContains(s *Shape, wx, wy float64) bool {
	switch s.Type {
	case "image", "rect", "rectangle":
		return wx >= s.X && wx <= s.X+s.Width && wy >= s.Y && wy <= s.Y+s.Height
	case "circle":
		cx := s.X + s.Width/2
		cy := s.Y + s.Height/2
		r := math.Sqrt(s.Width*s.Width+s.Height*s.Height) / 2
		dx, dy := wx-cx, wy-cy
		return dx*dx+dy*dy <= r*r
	case "path":
		if len(s.Points) == 0 {
			return false
		}
		minX, minY, maxX, maxY := s.Bounds()
		pad := math.Max(s.StrokeWidth*2, 8)
		return wx >= minX-pad && wx <= maxX+pad && wy >= minY-pad && wy <= maxY+pad
	}
	return false
}

func (s *State) push(op undoOp) {
	s.undo = append(s.undo, op)
	if len(s.undo) > maxUndo {
		s.undo = s.undo[1:]
	}
}

func (s *State) find(id int64) int {
	for i := range s.Shapes {
		if s.Shapes[i].ID == id {
			return i
		}
	}
	return -1
}
