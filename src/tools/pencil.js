import { BaseTool } from './base.js';

export class PencilTool extends BaseTool {
    constructor(app) {
        super(app, 'pencil');
        this.isDrawing = false;
        this.currentPath = null;
    }

    onMouseDown(e) {
        this.isDrawing = true;
        this.currentPath = {
            type: 'path',
            points: [{ x: e.x, y: e.y }],
            stroke: null, // Use defaults/CSS
            strokeWidth: null,
            fill: 'transparent'
        };
        this.previewShape = this.currentPath;
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;

        this.currentPath.points.push({ x: e.x, y: e.y });
        // Render loop will pick up previewShape
    }

    onMouseUp(e) {
        if (!this.isDrawing) return;

        this.isDrawing = false;
        if (this.currentPath) {
            this.app.state.addShape(this.currentPath);
            this.previewShape = null;
            this.currentPath = null;
        }
    }
}
