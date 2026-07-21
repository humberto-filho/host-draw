package core

import (
	"strings"
	"testing"
)

func TestParseColor(t *testing.T) {
	cases := []struct {
		in   string
		want Color
	}{
		{"#000000", Color{0, 0, 0, 1}},
		{"#ffffff", Color{1, 1, 1, 1}},
		{"#ff0000", Color{1, 0, 0, 1}},
		{"#f00", Color{1, 0, 0, 1}},
		{"rgba(0,0,0,0.1)", Color{0, 0, 0, 0.1}},
		{"rgba(255, 255, 255, 0.2)", Color{1, 1, 1, 0.2}},
		{"rgb(10, 20, 30)", Color{10.0 / 255, 20.0 / 255, 30.0 / 255, 1}},
		{"transparent", Color{}},
		{"", Color{}},
	}
	for _, c := range cases {
		got := ParseColor(c.in)
		if got != c.want {
			t.Errorf("ParseColor(%q) = %+v, want %+v", c.in, got, c.want)
		}
	}
}

func TestShapeJSONRoundTrip(t *testing.T) {
	st := NewState(nil)
	st.AddShape(Shape{Type: "path", Points: []Point{{1, 2}, {3, 4}}, Stroke: "#ff0000", StrokeWidth: 2, Fill: "transparent"})
	st.AddShape(Shape{Type: "rectangle", X: 5, Y: 6, Width: 10, Height: 20, Stroke: "#00ff00", StrokeWidth: 4})
	st.AddShape(Shape{Type: "path", Points: []Point{{0, 0}, {9, 9}}, Composite: "destination-out", StrokeWidth: 40})

	out := st.ExportJSON()

	// Same schema as the JS app: points array, strokeWidth, composite.
	for _, frag := range []string{`"type":"path"`, `"points":[{"x":1,"y":2}`, `"strokeWidth":2`, `"composite":"destination-out"`} {
		if !strings.Contains(out, frag) {
			t.Errorf("ExportJSON missing %s: %s", frag, out)
		}
	}

	st2 := NewState(nil)
	if err := st2.ImportShapes(out); err != nil {
		t.Fatalf("ImportShapes: %v", err)
	}
	if len(st2.Shapes) != 3 {
		t.Fatalf("got %d shapes, want 3", len(st2.Shapes))
	}
	if st2.Shapes[0].Points[1] != (Point{3, 4}) {
		t.Errorf("point mismatch: %+v", st2.Shapes[0].Points[1])
	}
}

func TestImportShapesReleasesPreviousDocument(t *testing.T) {
	st := NewState(nil)
	st.AddShape(Shape{Type: "image", Src: "data:image/png;base64,old-image-data"})
	clip := Shape{Type: "image", Src: "data:image/png;base64,clipboard-image-data"}
	st.Clipboard = &clip

	if err := st.ImportShapes(`[{"type":"rectangle","width":10,"height":10}]`); err != nil {
		t.Fatalf("ImportShapes: %v", err)
	}
	if st.Clipboard != nil {
		t.Error("clipboard should be cleared when replacing the document")
	}
	if st.Undo() {
		t.Error("previous document should not be retained in undo history")
	}
}

func TestUndoOps(t *testing.T) {
	st := NewState(nil)
	id1 := st.AddShape(Shape{Type: "rectangle", X: 0, Y: 0, Width: 10, Height: 10})
	id2 := st.AddShape(Shape{Type: "circle", X: 20, Y: 20, Width: 10, Height: 10})

	st.TranslateShape(id1, 5, 7)
	st.RecordMove(id1, 5, 7)

	st.DeleteShape(id2)

	if len(st.Shapes) != 1 {
		t.Fatalf("after delete: %d shapes", len(st.Shapes))
	}

	st.Undo() // undelete
	if len(st.Shapes) != 2 {
		t.Fatalf("after undelete: %d shapes", len(st.Shapes))
	}

	st.Undo() // inverse move
	if sh := st.Get(id1); sh.X != 0 || sh.Y != 0 {
		t.Errorf("after undo move: (%v,%v), want (0,0)", sh.X, sh.Y)
	}

	st.Undo() // remove circle
	st.Undo() // remove rect
	if len(st.Shapes) != 0 {
		t.Fatalf("after full undo: %d shapes", len(st.Shapes))
	}
	if st.Undo() {
		t.Error("Undo should report false on empty stack")
	}
}

func TestUndoCap(t *testing.T) {
	st := NewState(nil)
	for i := 0; i < maxUndo+10; i++ {
		st.AddShape(Shape{Type: "rectangle", X: float64(i)})
	}
	if len(st.undo) != maxUndo {
		t.Fatalf("undo stack = %d, want cap %d", len(st.undo), maxUndo)
	}
	// 50 undos leave the 10 oldest shapes.
	for i := 0; i < maxUndo; i++ {
		st.Undo()
	}
	if len(st.Shapes) != 10 {
		t.Fatalf("after %d undos: %d shapes, want 10", maxUndo, len(st.Shapes))
	}
}

func TestClearUndoable(t *testing.T) {
	st := NewState(nil)
	st.AddShape(Shape{Type: "rectangle", Width: 1, Height: 1})
	st.Clear()
	if len(st.Shapes) != 0 {
		t.Fatal("clear should empty the scene")
	}
	st.Undo()
	if len(st.Shapes) != 1 {
		t.Fatal("undo of clear should restore shapes")
	}
}

func TestHitTest(t *testing.T) {
	st := NewState(nil)
	st.AddShape(Shape{Type: "rectangle", X: 0, Y: 0, Width: 100, Height: 100})
	st.AddShape(Shape{Type: "circle", X: 200, Y: 200, Width: 40, Height: 0}) // r = 20*sqrt2/... matches JS formula
	eraserID := st.AddShape(Shape{Type: "path", Points: []Point{{50, 50}, {60, 60}}, Composite: "destination-out", StrokeWidth: 40})

	if got := st.HitTest(50, 50); got == eraserID {
		t.Error("eraser strokes must not be hit-testable")
	}
	if got := st.HitTest(10, 10); got == -1 {
		t.Error("expected hit on rectangle")
	}
	if got := st.HitTest(500, 500); got != -1 {
		t.Error("expected miss far away")
	}
}

func TestRemapColors(t *testing.T) {
	st := NewState(nil)
	id := st.AddShape(Shape{Type: "rectangle", Stroke: "#282828", StrokeWidth: 2})
	st.RemapColors(map[string]string{"#282828": "#ebdbb2"})
	if sh := st.Get(id); sh.Stroke != "#ebdbb2" {
		t.Errorf("stroke = %q, want #ebdbb2", sh.Stroke)
	}
}

func TestViewportZoomClamp(t *testing.T) {
	v := NewViewport()
	v.Resize(800, 600, 1)
	for i := 0; i < 100; i++ {
		v.ZoomAt(400, 300, -1000) // zoom in hard
	}
	if v.Scale > 5 {
		t.Errorf("scale = %v, want <= 5", v.Scale)
	}
	for i := 0; i < 1000; i++ {
		v.ZoomAt(400, 300, 1000)
	}
	if v.Scale < 0.1 {
		t.Errorf("scale = %v, want >= 0.1", v.Scale)
	}
}

func TestViewportZoomAnchor(t *testing.T) {
	v := NewViewport()
	v.Resize(800, 600, 1)
	beforeX, beforeY := v.ScreenToWorld(400, 300)
	v.ZoomAt(400, 300, -120)
	afterX, afterY := v.ScreenToWorld(400, 300)
	if beforeX != afterX || beforeY != afterY {
		t.Errorf("zoom anchor moved: (%v,%v) -> (%v,%v)", beforeX, beforeY, afterX, afterY)
	}
}
