import { BaseTool } from './base.js';

export class CircleTool extends BaseTool {
    constructor(app) {
        super(app, 'circle');
        this.isDrawing = false;
        this.startPos = { x: 0, y: 0 };
        this.currentCircle = null;
    }

    onMouseDown(e) {
        this.isDrawing = true;
        this.startPos = { x: e.x, y: e.y };
        this.currentCircle = {
            type: 'circle',
            x: e.x,
            y: e.y,
            width: 0,
            height: 0,
            stroke: null,
            strokeWidth: null,
            fill: 'transparent'
        };
        this.previewShape = this.currentCircle;
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;

        this.currentCircle.width = e.x - this.startPos.x;
        this.currentCircle.height = e.y - this.startPos.y;
    }

    onMouseUp(e) {
        if (!this.isDrawing) return;

        this.isDrawing = false;
        if (this.currentCircle && (Math.abs(this.currentCircle.width) > 0 || Math.abs(this.currentCircle.height) > 0)) {
            // Standardize geometry if needed, for now width/height imply ellipse/bounding box
            // Canvas renderer handles the math

            this.app.state.addShape(this.currentCircle);
        }
        this.previewShape = null;
        this.currentCircle = null;
    }
}
