import { BaseTool } from './base.js';

export class GrabTool extends BaseTool {
    constructor(app) {
        super(app, 'grab');
        this.isDragging = false;
        this.dragTarget = null;   // reference to the shape being moved
        this.dragOffset = { x: 0, y: 0 };
        this.selectedShape = null; // currently selected shape (for delete)
    }

    deactivate() {
        super.deactivate();
        if (this.selectedShape) delete this.selectedShape._selected;
        this.selectedShape = null;
    }

    /**
     * Hit-test shapes in reverse order (top-first), return the first match.
     * Skips eraser strokes (composite: destination-out) since they shouldn't be movable.
     */
    hitTest(wx, wy) {
        const shapes = this.app.state.shapes;
        for (let i = shapes.length - 1; i >= 0; i--) {
            const s = shapes[i];
            // Skip eraser strokes — they use destination-out and should not be grabbed
            if (s.composite) continue;
            if (this._shapeContains(s, wx, wy)) return s;
        }
        return null;
    }

    _shapeContains(s, wx, wy) {
        if (s.type === 'image' || s.type === 'rect' || s.type === 'rectangle') {
            return wx >= s.x && wx <= s.x + s.width &&
                wy >= s.y && wy <= s.y + s.height;
        }
        if (s.type === 'circle') {
            const cx = s.x + s.width / 2;
            const cy = s.y + s.height / 2;
            const r = Math.sqrt(s.width ** 2 + s.height ** 2) / 2;
            return (wx - cx) ** 2 + (wy - cy) ** 2 <= r ** 2;
        }
        if (s.type === 'path' && s.points && s.points.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of s.points) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
            const pad = Math.max((s.strokeWidth || 2) * 2, 8);
            return wx >= minX - pad && wx <= maxX + pad &&
                wy >= minY - pad && wy <= maxY + pad;
        }
        return false;
    }

    /** Get reference origin for a shape (for computing drag offset) */
    _getOrigin(s) {
        if (s.type === 'path' && s.points && s.points.length > 0) {
            // Use bounding box top-left as origin for paths
            let minX = Infinity, minY = Infinity;
            for (const p of s.points) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
            }
            return { x: minX, y: minY };
        }
        return { x: s.x || 0, y: s.y || 0 };
    }

    onMouseDown(e) {
        // Deselect previous
        if (this.selectedShape) delete this.selectedShape._selected;

        const target = this.hitTest(e.x, e.y);
        if (target) {
            this.isDragging = true;
            this.dragTarget = target;
            this.selectedShape = target;
            target._selected = true;

            // Compute offset from cursor to shape origin so it doesn't jump
            const origin = this._getOrigin(target);
            this.dragOffset.x = e.x - origin.x;
            this.dragOffset.y = e.y - origin.y;
        } else {
            this.selectedShape = null;
        }
    }

    onMouseMove(e) {
        if (!this.isDragging || !this.dragTarget) return;

        const s = this.dragTarget;
        const newOriginX = e.x - this.dragOffset.x;
        const newOriginY = e.y - this.dragOffset.y;

        if (s.type === 'path' && s.points && s.points.length > 0) {
            // Get current bounding box origin
            const oldOrigin = this._getOrigin(s);
            const dx = newOriginX - oldOrigin.x;
            const dy = newOriginY - oldOrigin.y;
            // Move all points
            for (const p of s.points) {
                p.x += dx;
                p.y += dy;
            }
            // Update stored x/y if present
            if (s.x !== undefined) { s.x += dx; s.y += dy; }
        } else {
            s.x = newOriginX;
            s.y = newOriginY;
        }
    }

    onMouseUp(e) {
        if (this.isDragging && this.dragTarget) {
            this.app.state.saveState();
        }
        this.isDragging = false;
        this.dragTarget = null;
    }

    onKeyDown(e) {
        const evt = e.originalEvent || e;
        const key = evt.key;

        // Delete / Backspace — remove selected shape
        if ((key === 'Delete' || key === 'Backspace') && this.selectedShape) {
            const shapes = this.app.state.shapes;
            const idx = shapes.indexOf(this.selectedShape);
            if (idx !== -1) {
                shapes.splice(idx, 1);
                this.app.state.saveState();
                this.selectedShape = null;
            }
            return;
        }

        // Ctrl+C — copy selected shape to clipboard
        if (key === 'c' && (evt.ctrlKey || evt.metaKey) && this.selectedShape) {
            evt.preventDefault();
            const clone = JSON.parse(JSON.stringify(this.selectedShape));
            delete clone._selected;
            this.app.state.clipboard = clone;
            this.app.showPopup('Copied');
            return;
        }

        // Ctrl+V — paste shape from clipboard
        if (key === 'v' && (evt.ctrlKey || evt.metaKey) && this.app.state.clipboard) {
            evt.preventDefault();
            const clone = JSON.parse(JSON.stringify(this.app.state.clipboard));
            if (clone.x !== undefined) { clone.x += 20; clone.y += 20; }
            if (clone.points) {
                for (const p of clone.points) { p.x += 20; p.y += 20; }
            }
            if (this.selectedShape) delete this.selectedShape._selected;
            this.app.state.addShape(clone);
            clone._selected = true;
            this.selectedShape = clone;
            this.app.state.clipboard = JSON.parse(JSON.stringify(clone));
            delete this.app.state.clipboard._selected;
            return;
        }
    }
}
