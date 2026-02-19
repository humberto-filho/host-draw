import { BaseTool } from './base.js';

export class LineTool extends BaseTool {
    constructor(app) {
        super(app, 'line');
        this.isDrawing = false;
        this.startPoint = null;
    }

    onMouseDown(e) {
        this.isDrawing = true;
        this.startPoint = { x: e.x, y: e.y };
        this.currentPath = {
            type: 'path',
            points: [this.startPoint, this.startPoint],
            stroke: this.app.tools.style.strokeColor,
            strokeWidth: this.app.tools.style.strokeWidth,
            fill: 'transparent'
        };
        this.previewShape = this.currentPath;
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;
        // Update the second point to be the current mouse position
        // This creates a straight line from start to current
        this.currentPath.points = [this.startPoint, { x: e.x, y: e.y }];
    }

    onMouseUp(e) {
        if (!this.isDrawing) return;

        this.isDrawing = false;
        if (this.currentPath) {
            // Finalize the line
            this.currentPath.points = [this.startPoint, { x: e.x, y: e.y }];
            this.app.state.addShape(this.currentPath);
            this.previewShape = null;
            this.currentPath = null;
        }
    }
}
