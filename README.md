# Host-Draw

Host-Draw is a local-first drawing board that runs in the browser. Its interface is written in vanilla JavaScript, while drawing state, tools, viewport math, undo operations, image handling, and WebGL rendering run in Go compiled to WebAssembly.

There is no JavaScript package installation or bundling step. A small Python server serves the application and stores exported drawings locally.

## Features

- Pencil, line, rectangle, circle, eraser, and grab tools
- Go/WASM drawing engine with a WebGL renderer
- Operation-based undo history
- Zooming and panning on an infinite grid
- Shape selection, movement, deletion, copy, and paste
- Image insertion by file picker, clipboard, or drag and drop
- Light and dark themes with automatic stroke-color remapping
- Six fixed palette colors plus removable custom colors
- Automatic browser persistence through `localStorage`
- PDF and JSON export to the local `data/` directory
- WASM memory usage indicator

## Requirements

- Python 3
- Go 1.26 or newer
- A browser with WebAssembly and WebGL support

The build script uses `.toolchain/go/bin/go` when a local toolchain exists; otherwise it uses `go` from `PATH`.

## Build and run

From the repository root:

```bash
./build.sh
python3 run_server.py
```

Then open [http://localhost:8000](http://localhost:8000).

`build.sh` creates two generated runtime files:

- `web/main.wasm`
- `web/wasm_exec.js`

Both files are intentionally ignored by Git. Run the build again whenever code under `wasm/` changes.

## Architecture

```text
Browser UI and DOM events (src/)
              |
              | window.hostdraw bridge
              v
Go WebAssembly entry point (wasm/main.go)
              |
       +------+------+
       |             |
       v             v
 state + viewport   drawing tools
 WebGL renderer     input handling
   (wasm/core/)      (wasm/tools/)
```

The JavaScript layer owns the DOM, toolbar, palette, custom cursors, file dialogs, browser storage, and server requests. It forwards input and style changes through `window.hostdraw`.

The Go/WASM layer owns the scene and all drawing behavior. It sends state-change and notification callbacks to JavaScript, which keeps browser persistence and the UI synchronized.

## Controls

### Drawing and editing

| Input | Action |
| --- | --- |
| `p` | Pencil |
| `l` | Line |
| `r` | Rectangle |
| `c` | Circle |
| `e` | Eraser |
| `g` | Grab/select |
| `Ctrl+Z` | Undo |
| Right click | Cycle stroke width or eraser size |
| Mouse wheel | Zoom around the pointer |
| Middle-mouse drag | Pan the canvas |

### Grab tool

| Input | Action |
| --- | --- |
| Click | Select a shape |
| Drag | Move the selected shape |
| `Delete` / `Backspace` | Delete the selected shape |
| `Ctrl+C` / `Cmd+C` | Copy the selected shape |
| `Ctrl+V` / `Cmd+V` | Paste a copied shape with an offset |

Eraser strokes are not selectable.

### Colors, files, and theme

| Input | Action |
| --- | --- |
| `1`-`6` | Select a fixed palette color |
| `7`-`9` | Select a custom color when present |
| `d` | Open the custom-color deletion dialog |
| Hover a custom color | Reveal its red `×` delete control |
| `x` | Toggle light/dark theme |
| `s` | Save PDF and JSON files into `data/` |
| `o` | Open a saved JSON drawing |

The first six palette colors are built in and cannot be edited or removed. Custom colors can be added with the picker below the palette.

### Images

- Use the **Image (+)** toolbar button to choose an image.
- Paste an image from the clipboard with `Ctrl+V` / `Cmd+V`.
- Drop an image file directly onto the canvas.

Images selected with the file picker are limited to 800 pixels on their longest side.

## Persistence and exports

Every scene change is serialized by the Go core and cached in browser `localStorage`. Reloading the application restores the latest cached scene.

The Python server exposes local endpoints for saving and loading drawings. Pressing `s` writes a PDF and its JSON scene representation into `data/`. That directory contains user-generated content and is ignored by Git.

Custom palette changes are saved through the local server into `src/config.default.js`. Review that file before committing if you added colors while testing.

## Development

Run the Go tests:

```bash
cd wasm
go test ./...
```

Build the WebAssembly target:

```bash
./build.sh
```

After building and starting the server, the browser bridge smoke test is available at [http://localhost:8000/web/test-bridge.html](http://localhost:8000/web/test-bridge.html). It exercises bridge initialization, scene import/export, bounds, pixel export, pencil, undo, grab, and image orientation.

Before committing:

```bash
git status --short
git add -A
git diff --cached --check
git diff --cached --stat
```

The repository ignores the local Go toolchain, generated WASM runtime files, Python caches, exported drawings, and local backup files.

## Repository layout

```text
host-draw/
├── index.html                  Browser entry point
├── style.css                  Application and palette styles
├── build.sh                   Go-to-WASM build script
├── run_server.py              Static server and save/load API
├── src/
│   ├── config.default.js       Keybindings, themes, and presets
│   ├── core/
│   │   ├── app.js              Browser application orchestration
│   │   ├── canvas.js           DOM input forwarding and render loop
│   │   ├── commands.js         Command and shortcut registry
│   │   └── wasm_loader.js      Go/WASM loader
│   ├── tools/
│   │   └── manager.js          UI style state and custom cursors
│   ├── ui/                     Toolbar, palette, HUD, and memory meter
│   └── utils/config.js         Configuration loader
├── wasm/
│   ├── main.go                  JavaScript bridge registration
│   ├── core/                    State, shapes, viewport, and WebGL renderer
│   ├── tools/                   Native drawing tool implementations
│   └── go.mod
├── web/
│   ├── test-bridge.html         Browser bridge smoke test
│   ├── main.wasm                Generated; ignored
│   └── wasm_exec.js             Generated; ignored
└── data/                       Saved drawings; generated and ignored
```

## License

This project is released under [CC0 1.0 Universal](LICENSE).
