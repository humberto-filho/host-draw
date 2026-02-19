import { PencilTool } from './pencil.js';
import { RectangleTool } from './rectangle.js';
import { CircleTool } from './circle.js';

export class ToolManager {
    constructor(app) {
        this.app = app;
        this.tools = {};
        this.currentTool = null;
    }

    init() {
        // Register Tools
        this.registerTool(new PencilTool(this.app));
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

            // Update Cursor
            const canvas = this.app.canvas.canvas;
            if (name === 'pencil') {
                canvas.classList.add('cursor-pencil');
            } else {
                canvas.classList.remove('cursor-pencil');
            }
        } else {
            console.error(`Tool not found: ${name}`);
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
        // Screen to World Coordinate Transformation

        // 1. Get client coordinates
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        // 2. Get canvas rect
        const rect = this.app.canvas.canvas.getBoundingClientRect();

        // 3. Screen relative to canvas
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;

        // 4. Apply Viewport Transform (Inverse)
        // World = (Screen - Offset) / Scale
        const worldX = (screenX - this.app.canvas.offset.x) / this.app.canvas.scale;
        const worldY = (screenY - this.app.canvas.offset.y) / this.app.canvas.scale;

        return { x: worldX, y: worldY };
    }
}
