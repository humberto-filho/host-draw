package core

import (
	"strconv"
	"strings"
)

// Color is a parsed RGBA color with float components in [0, 1].
type Color struct {
	R, G, B, A float32
}

// ParseColor parses "#rgb", "#rrggbb", "rgb(...)", "rgba(...)" and
// "transparent" (also the empty string). Unknown formats yield opaque black.
func ParseColor(s string) Color {
	s = strings.TrimSpace(s)
	if s == "" || s == "transparent" {
		return Color{}
	}
	if strings.HasPrefix(s, "#") {
		hex := s[1:]
		if len(hex) == 3 {
			hex = string([]byte{hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]})
		}
		if len(hex) == 6 {
			if v, err := strconv.ParseUint(hex, 16, 32); err == nil {
				return Color{
					R: float32(v>>16&0xff) / 255,
					G: float32(v>>8&0xff) / 255,
					B: float32(v&0xff) / 255,
					A: 1,
				}
			}
		}
		return Color{A: 1}
	}
	if strings.HasPrefix(s, "rgb") {
		open := strings.Index(s, "(")
		close := strings.LastIndex(s, ")")
		if open >= 0 && close > open {
			parts := strings.Split(s[open+1:close], ",")
			vals := make([]float64, 0, 4)
			for _, p := range parts {
				v, err := strconv.ParseFloat(strings.TrimSpace(p), 64)
				if err != nil {
					return Color{A: 1}
				}
				vals = append(vals, v)
			}
			if len(vals) >= 3 {
				c := Color{
					R: float32(vals[0]) / 255,
					G: float32(vals[1]) / 255,
					B: float32(vals[2]) / 255,
					A: 1,
				}
				if len(vals) >= 4 {
					c.A = float32(vals[3])
				}
				return c
			}
		}
	}
	return Color{A: 1}
}
