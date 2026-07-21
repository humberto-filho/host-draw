package core

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"strings"
)

// Point is a single vertex of a path shape.
type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Shape mirrors the JSON schema used by the original JS app
// (data/*.json files and the localStorage cache), so old saves keep loading.
type Shape struct {
	ID          int64   `json:"-"`
	Type        string  `json:"type"` // path | rect | rectangle | circle | image
	Points      []Point `json:"points,omitempty"`
	X           float64 `json:"x,omitempty"`
	Y           float64 `json:"y,omitempty"`
	Width       float64 `json:"width,omitempty"`
	Height      float64 `json:"height,omitempty"`
	Stroke      string  `json:"stroke,omitempty"`
	StrokeWidth float64 `json:"strokeWidth,omitempty"`
	Fill        string  `json:"fill,omitempty"`
	Composite   string  `json:"composite,omitempty"` // "destination-out" = eraser stroke
	Src         string  `json:"src,omitempty"`       // data URL, images only

	Version int64 `json:"-"` // bumped on every mutation (render cache invalidation)
}

// IsEraser reports whether the shape is an eraser stroke.
func (s *Shape) IsEraser() bool { return s.Composite != "" }

// Clone returns a deep copy of the shape.
func (s *Shape) Clone() Shape {
	c := *s
	if s.Points != nil {
		c.Points = make([]Point, len(s.Points))
		copy(c.Points, s.Points)
	}
	return c
}

// Translate moves the shape by (dx, dy).
func (s *Shape) Translate(dx, dy float64) {
	if s.Type == "path" {
		for i := range s.Points {
			s.Points[i].X += dx
			s.Points[i].Y += dy
		}
	}
	s.X += dx
	s.Y += dy
}

// Bounds returns the shape's bounding box (minX, minY, maxX, maxY).
func (s *Shape) Bounds() (minX, minY, maxX, maxY float64) {
	if s.Type == "path" && len(s.Points) > 0 {
		minX, minY = math.Inf(1), math.Inf(1)
		maxX, maxY = math.Inf(-1), math.Inf(-1)
		for _, p := range s.Points {
			minX = math.Min(minX, p.X)
			minY = math.Min(minY, p.Y)
			maxX = math.Max(maxX, p.X)
			maxY = math.Max(maxY, p.Y)
		}
		return
	}
	return s.X, s.Y, s.X + s.Width, s.Y + s.Height
}

// Origin is the reference point used for drag offsets:
// bounding-box top-left for paths, (x, y) otherwise.
func (s *Shape) Origin() Point {
	if s.Type == "path" && len(s.Points) > 0 {
		minX, minY, _, _ := s.Bounds()
		return Point{X: minX, Y: minY}
	}
	return Point{X: s.X, Y: s.Y}
}

// DecodeDataURL decodes a "data:<mime>;base64,..." image into RGBA pixels.
func DecodeDataURL(src string) (*image.RGBA, error) {
	comma := strings.Index(src, ",")
	if comma < 0 {
		return nil, fmt.Errorf("invalid data URL")
	}
	raw, err := base64.StdEncoding.DecodeString(src[comma+1:])
	if err != nil {
		return nil, fmt.Errorf("base64: %w", err)
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	rgba, ok := img.(*image.RGBA)
	if !ok {
		b := img.Bounds()
		rgba = image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
		draw.Draw(rgba, rgba.Bounds(), img, b.Min, draw.Src)
	}
	return rgba, nil
}
