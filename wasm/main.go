//go:build js && wasm

package main

import (
	"syscall/js"

	"hostdraw/core"
	"hostdraw/tools"
)

// Bridge: everything exported to JS lives on the global `hostdraw` object.
// The JS shell (canvas.js / app.js) owns DOM events and UI; this program
// owns the scene, tools and rendering.
func main() {
	app := core.NewApp()
	env := &tools.Env{
		State: app.State,
		View:  app.View,
		Hooks: app,
		Style: tools.Style{StrokeColor: "#000000", StrokeWidth: 2, FillColor: "transparent"},
	}
	mgr := tools.NewManager(env)
	app.Overlay = mgr

	hd := js.Global().Get("Object").New()

	// init(canvasId, themeJSON, callbacks) -> error string | null
	hd.Set("init", js.FuncOf(func(this js.Value, args []js.Value) any {
		app.SetCallbacks(args[2])
		app.SetTheme(args[1].String())
		if err := app.InitRenderer(args[0].String()); err != nil {
			return err.Error()
		}
		return nil
	}))

	// frame() — called from the JS rAF loop; no-op when not dirty
	hd.Set("frame", js.FuncOf(func(this js.Value, args []js.Value) any {
		app.Frame()
		return nil
	}))

	// resize(widthCSS, heightCSS, dpr)
	hd.Set("resize", js.FuncOf(func(this js.Value, args []js.Value) any {
		app.Resize(args[0].Float(), args[1].Float(), args[2].Float())
		return nil
	}))

	// Pointer input (canvas-relative screen coords)
	hd.Set("pointerDown", js.FuncOf(func(this js.Value, args []js.Value) any {
		mgr.PointerDown(args[0].Float(), args[1].Float(), args[2].Int(), args[3].Bool())
		return nil
	}))
	hd.Set("pointerMove", js.FuncOf(func(this js.Value, args []js.Value) any {
		mgr.PointerMove(args[0].Float(), args[1].Float())
		return nil
	}))
	hd.Set("pointerUp", js.FuncOf(func(this js.Value, args []js.Value) any {
		mgr.PointerUp(args[0].Float(), args[1].Float(), args[2].Int())
		return nil
	}))
	hd.Set("cancelPointer", js.FuncOf(func(this js.Value, args []js.Value) any {
		mgr.Cancel()
		return nil
	}))
	hd.Set("wheel", js.FuncOf(func(this js.Value, args []js.Value) any {
		mgr.Wheel(args[0].Float(), args[1].Float(), args[2].Float())
		return nil
	}))

	// key(kind, key, ctrl, meta) — kind: keydown | keyup
	hd.Set("key", js.FuncOf(func(this js.Value, args []js.Value) any {
		mgr.Key(args[0].String(), args[1].String(), args[2].Bool(), args[3].Bool())
		return nil
	}))

	// Tools & style
	hd.Set("setTool", js.FuncOf(func(this js.Value, args []js.Value) any {
		mgr.SetTool(args[0].String())
		app.MarkDirty()
		return nil
	}))
	hd.Set("setStyle", js.FuncOf(func(this js.Value, args []js.Value) any {
		env.Style.StrokeColor = args[0].String()
		env.Style.StrokeWidth = args[1].Float()
		return nil
	}))

	// State
	hd.Set("undo", js.FuncOf(func(this js.Value, args []js.Value) any {
		app.State.Undo()
		return nil
	}))
	hd.Set("clear", js.FuncOf(func(this js.Value, args []js.Value) any {
		app.State.Clear()
		return nil
	}))
	hd.Set("importShapes", js.FuncOf(func(this js.Value, args []js.Value) any {
		if err := app.State.ImportShapes(args[0].String()); err != nil {
			return err.Error()
		}
		return nil
	}))
	hd.Set("exportShapes", js.FuncOf(func(this js.Value, args []js.Value) any {
		return app.State.ExportJSON()
	}))

	// Images & theme
	hd.Set("addImage", js.FuncOf(func(this js.Value, args []js.Value) any {
		app.AddImage(args[0].String(), args[1].Float(), args[2].Float(), args[3].Float(), args[4].Float())
		return nil
	}))
	hd.Set("setTheme", js.FuncOf(func(this js.Value, args []js.Value) any {
		app.SetTheme(args[0].String())
		return nil
	}))
	hd.Set("remapColors", js.FuncOf(func(this js.Value, args []js.Value) any {
		app.RemapColors(args[0].String())
		return nil
	}))

	// Geometry helpers for the JS shell
	hd.Set("screenToWorld", js.FuncOf(func(this js.Value, args []js.Value) any {
		x, y := app.View.ScreenToWorld(args[0].Float(), args[1].Float())
		return []any{x, y}
	}))
	hd.Set("centerWorld", js.FuncOf(func(this js.Value, args []js.Value) any {
		x, y := app.View.CenterWorld()
		return []any{x, y}
	}))
	hd.Set("bounds", js.FuncOf(func(this js.Value, args []js.Value) any {
		minX, minY, maxX, maxY, ok := app.State.Bounds()
		if !ok {
			return nil
		}
		return []any{minX, minY, maxX, maxY}
	}))

	// exportRegion(minX, minY, w, h, scale) -> Uint8Array (RGBA, top-down)
	hd.Set("exportRegion", js.FuncOf(func(this js.Value, args []js.Value) any {
		pixels, err := app.ExportRegion(args[0].Float(), args[1].Float(), args[2].Float(), args[3].Float(), args[4].Float())
		if err != nil {
			return err.Error()
		}
		return pixels
	}))

	js.Global().Set("hostdraw", hd)
	select {} // keep the Go runtime alive
}
