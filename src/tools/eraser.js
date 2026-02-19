import { PencilTool } from './pencil.js';

export class EraserTool extends PencilTool {
    constructor(app) {
        super(app);
        this.name = 'eraser';
    }

    onMouseDown(e) {
        super.onMouseDown(e);
        if (this.currentPath) {
            this.currentPath.strokeColor = '#000000'; // Placeholder
            this.currentPath.composite = 'destination-out';
            // Make eraser 4x thicker than current stroke, or at least 10px
            const currentWidth = this.app.tools.style.strokeWidth || 2;
            this.currentPath.strokeWidth = Math.max(currentWidth * 4, 10);
        }
    }
}
