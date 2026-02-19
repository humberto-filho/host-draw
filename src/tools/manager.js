import { PencilTool } from './pencil.js?v=8';
import { RectangleTool } from './rectangle.js?v=8';
import { CircleTool } from './circle.js?v=8';
import { EraserTool } from './eraser.js?v=8';
import { LineTool } from './line.js?v=8';

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

        if (name === 'pencil' || name === 'line') {
            // Encode color for SVG
            let color = this.style.strokeColor;
            if (color.startsWith('#')) {
                color = encodeURIComponent(color);
            }

            // Scale pencil icon based on stroke width
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
        } else if (name === 'eraser') {
            const svg = `
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="8" stroke="white" stroke-width="3" opacity="0.8"/>
  <circle cx="16" cy="16" r="8" stroke="black" stroke-width="1.5"/>
</svg>`;
            const url = `data:image/svg+xml;utf8,${svg.replace(/\n/g, '')}`;
            canvas.style.cursor = `url('${url}') 16 16, auto`;
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
