import { PencilTool } from './pencil.js?v=31';
import { RectangleTool } from './rectangle.js?v=31';
import { CircleTool } from './circle.js?v=31';
import { EraserTool } from './eraser.js?v=31';
import { LineTool } from './line.js?v=31';
import { GrabTool } from './grab.js?v=31';

export class ToolManager {
    constructor(app) {
        this.app = app;
        this.tools = {};
        this.currentTool = null;

        // Active visual style
        this.style = {
            strokeColor: '#000000',
            strokeWidth: 2,
            fillColor: 'transparent'
        };
    }

    init() {
        // Register Tools
        this.registerTool(new PencilTool(this.app));
        this.registerTool(new EraserTool(this.app));
        this.registerTool(new LineTool(this.app));
        this.registerTool(new RectangleTool(this.app));
        this.registerTool(new CircleTool(this.app));
        this.registerTool(new GrabTool(this.app));

        this.setTool('pencil');
    }

    registerTool(tool) {
        this.tools[tool.name] = tool;
    }

    setTool(name) {
        if (this.currentTool) {
            this.currentTool.deactivate();
        }

        const tool = this.tools[name];
        if (tool) {
            this.currentTool = tool;
            this.currentTool.activate();
            this.updateCursor();

            // Re-render toolbar to update active state
            if (this.app.ui && this.app.ui.toolbar) {
                this.app.ui.toolbar.render();
            }
        } else {
            console.error(`Tool not found: ${name}`);
        }
    }

    updateCursor() {
        const canvas = this.app.canvas.canvas;
        const name = this.currentTool ? this.currentTool.name : null;
        const strokeW = this.style.strokeWidth;

        // Remove old classes
        canvas.classList.remove('cursor-pencil');
        canvas.style.cursor = 'default';

        if (name === 'pencil') {
            // Encode color for SVG
            let color = this.style.strokeColor;
            if (color.startsWith('#')) {
                color = encodeURIComponent(color);
            }

            const size = strokeW > 5 ? 40 : 32;

            const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="white" flood-opacity="0.8"/>
    </filter>
  </defs>
  <path d="M18 3L21 6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
  <path d="M3 21H6L19.5 7.5L16.5 4.5L3 18V21Z" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
  
  <path d="M18 3L21 6" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 21H6L19.5 7.5L16.5 4.5L3 18V21Z" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 21L6 24L9 21" fill="${color}"/>
</svg>`;

            const url = `data:image/svg+xml;utf8,${svg.replace(/\n/g, '')}`;
            canvas.style.cursor = `url('${url}') 0 ${size - 8}, auto`;
        } else if (name === 'line') {
            let color = this.style.strokeColor;
            if (color.startsWith('#')) {
                color = encodeURIComponent(color);
            }

            const size = 32;
            const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="4" y1="20" x2="20" y2="4" stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.8"/><line x1="4" y1="20" x2="20" y2="4" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/><circle cx="4" cy="20" r="2" fill="${color}"/><circle cx="20" cy="4" r="2" fill="${color}"/></svg>`;

            const url = `data:image/svg+xml;utf8,${svg}`;
            canvas.style.cursor = `url('${url}') 4 20, crosshair`;
        } else if (name === 'eraser') {
            // Eraser draws at strokeWidth * 4 — cursor reflects that circle
            // Browser max cursor size is 128×128px, so cap radius at 58 (dim = 124)
            const eraserDraw = strokeW * 4;
            const r = Math.min(Math.round(eraserDraw / 2), 58);
            const pad = 4;
            const dim = (r + pad) * 2;
            const cx = r + pad;
            const svg = `<svg width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="${cx}" cy="${cx}" r="${r}" stroke="white" stroke-width="3" opacity="0.8"/><circle cx="${cx}" cy="${cx}" r="${r}" stroke="black" stroke-width="1.5"/></svg>`;
            const url = `data:image/svg+xml;utf8,${svg}`;
            canvas.style.cursor = `url('${url}') ${cx} ${cx}, auto`;
        } else if (name === 'grab') {
            canvas.style.cursor = 'grab';
        }
    }

    handleEvent(type, e) {
        if (!this.currentTool) return;

        const { x, y } = this.getPointerPos(e);
        const event = { originalEvent: e, x, y };

        switch (type) {
            case 'mousedown': this.currentTool.onMouseDown(event); break;
            case 'mousemove': this.currentTool.onMouseMove(event); break;
            case 'mouseup': this.currentTool.onMouseUp(event); break;
            case 'keydown': this.currentTool.onKeyDown(event); break;
            case 'keyup': this.currentTool.onKeyUp(event); break;
        }
    }

    getPointerPos(e) {
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        const rect = this.app.canvas.canvas.getBoundingClientRect();

        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;

        const worldX = (screenX - this.app.canvas.offset.x) / this.app.canvas.scale;
        const worldY = (screenY - this.app.canvas.offset.y) / this.app.canvas.scale;

        return { x: worldX, y: worldY };
    }
}
