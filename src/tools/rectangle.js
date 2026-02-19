import { BaseTool } from './base.js';

export class RectangleTool extends BaseTool {
    constructor(app) {
        super(app, 'rectangle');
        this.isDrawing = false;
        this.startPos = { x: 0, y: 0 };
        this.currentRect = null;
    }

    onMouseDown(e) {
        this.isDrawing = true;
        this.startPos = { x: e.x, y: e.y };
        this.currentRect = {
            type: 'rect',
            x: e.x,
            y: e.y,
            width: 0,
            height: 0,
            stroke: null,
            strokeWidth: null,
            fill: 'transparent'
        };
        this.previewShape = this.currentRect;
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;

        this.currentRect.width = e.x - this.startPos.x;
        this.currentRect.height = e.y - this.startPos.y;
    }

    onMouseUp(e) {
        if (!this.isDrawing) return;

        this.isDrawing = false;
        if (this.currentRect && (Math.abs(this.currentRect.width) > 0 || Math.abs(this.currentRect.height) > 0)) {
            // Normalize rect (negative width/height handling)
            if (this.currentRect.width < 0) {
                this.currentRect.x += this.currentRect.width;
                this.currentRect.width = Math.abs(this.currentRect.width);
            }
            if (this.currentRect.height < 0) {
                this.currentRect.y += this.currentRect.height;
                this.currentRect.height = Math.abs(this.currentRect.height);
            }

            this.app.state.addShape(this.currentRect);
        }
        this.previewShape = null;
        this.currentRect = null;
    }
}
