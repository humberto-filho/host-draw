# Host-Draw

A lightweight, browser-based drawing app inspired by Miro and Excalidraw. Runs locally via a Python server with no dependencies.

## How to Run

```powershell
python run_server.py
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## Drawing Tools

| Key | Tool | Description |
|-----|------|-------------|
| `p` | Pencil | Freehand drawing |
| `l` | Line | Straight lines |
| `r` | Rectangle | Rectangles |
| `c` | Circle | Circles / ellipses |
| `e` | Eraser | Erase strokes (size matches cursor) |
| `g` | Grab | Select, move, copy, and delete shapes |

## Image Support

| Action | How |
|--------|-----|
| Insert image | Click **➕** button in toolbar |
| Paste image | **Ctrl+V** (from clipboard) |
| Drag & drop | Drop an image file onto the canvas |

- Images render at the **bottommost layer** (drawings appear on top)
- Large images are auto-scaled to max 800px

## Grab Tool (`g`)

- **Click** a shape to select it (blue dashed outline)
- **Drag** to move it
- **Ctrl+C** → copy selected shape
- **Ctrl+V** → paste duplicate (offset 20px each time)
- **Delete / Backspace** → remove selected shape
- Eraser strokes are excluded from selection

## Editing

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Right click` | Toggle thick / thin stroke |
| `d` | Delete a custom color |
| `1–6` | Switch between palette colors (You can add more if you want) |

## Themes & Colors

- **`x`** → toggle light / dark theme
- Built-in color palette with light and dark presets
- Add custom colors via the **color picker** button
- Delete custom colors with **`d`** key

## Navigation

- **Scroll wheel** → zoom in / out
- **Middle mouse drag** → pan the canvas

## Persistence

- Drawings are **auto-saved to browser localStorage** on every change
- Reloading the page restores your last drawing
- **`s`** → export as PDF
- **`o`** → load a saved drawing from file

## File Structure

```
host-draw/
├── index.html          # Entry point
├── style.css           # Styling and theme variables
├── run_server.py       # Local Python HTTP server
├── src/
│   ├── core/
│   │   ├── app.js      # App orchestrator, commands, init
│   │   ├── canvas.js   # Canvas rendering, pan/zoom, events
│   │   └── state.js    # State management, history, localStorage
│   ├── tools/
│   │   ├── base.js     # Base tool class
│   │   ├── pencil.js   # Freehand drawing
│   │   ├── line.js     # Straight lines
│   │   ├── rectangle.js# Rectangles
│   │   ├── circle.js   # Circles
│   │   ├── eraser.js   # Eraser (destination-out)
│   │   ├── grab.js     # Select, move, copy, delete
│   │   └── manager.js  # Tool registry and event dispatch
│   ├── ui/
│   │   ├── toolbar.js  # Top toolbar buttons
│   │   ├── hud.js      # Bottom-left keybinding info bar
│   │   ├── palette.js  # Left-side color palette
│   │   └── manager.js  # UI orchestrator
│   ├── utils/
│   │   └── config.js   # Config loader
│   └── config.default.js # Default keybindings, colors, themes
└── data/               # Server-side file storage
```
