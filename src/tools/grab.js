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
        this.selectedShape = null;
    }

    /**
     * Hit-test shapes in reverse order (top-first), return the first match.
     * Supports: image, rect/rectangle, circle, path (bounding box).
     */
    hitTest(wx, wy) {
        const shapes = this.app.state.shapes;
        // Walk backwards so topmost shape wins
        for (let i = shapes.length - 1; i >= 0; i--) {
            const s = shapes[i];
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
            // Bounding box hit test for paths
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of s.points) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
            // Add a small padding for thin strokes
            const pad = Math.max((s.strokeWidth || 2) * 2, 8);
            return wx >= minX - pad && wx <= maxX + pad &&
                wy >= minY - pad && wy <= maxY + pad;
        }
        return false;
    }

    onMouseDown(e) {
        const target = this.hitTest(e.x, e.y);
        if (target) {
            this.isDragging = true;
            this.dragTarget = target;
            this.selectedShape = target;
            // Mark selected for highlight
            target._selected = true;
            // Offset so the shape doesn't jump to cursor
            this.dragOffset.x = e.x - (target.x !== undefined ? target.x : 0);
            this.dragOffset.y = e.y - (target.y !== undefined ? target.y : 0);
        } else {
            // Clicked empty space — deselect
            if (this.selectedShape) {
                delete this.selectedShape._selected;
                this.selectedShape = null;
            }
        }
    }

    onMouseMove(e) {
        if (!this.isDragging || !this.dragTarget) return;

        const s = this.dragTarget;
        const newX = e.x - this.dragOffset.x;
        const newY = e.y - this.dragOffset.y;

        if (s.type === 'path' && s.points) {
            // For paths, use stored x/y or first point as reference
            if (s.x === undefined) {
                s.x = s.points[0].x;
                s.y = s.points[0].y;
            }

            const ddx = newX - s.x;
            const ddy = newY - s.y;
            for (const p of s.points) {
                p.x += ddx;
                p.y += ddy;
            }
            s.x = newX;
            s.y = newY;
        } else {
            s.x = newX;
            s.y = newY;
        }
    }

    onMouseUp(e) {
        if (this.isDragging && this.dragTarget) {
            // Save state for undo
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
            // Deep-clone the shape (strip internal _selected flag)
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
            // Offset so the copy doesn't land exactly on top
            if (clone.x !== undefined) { clone.x += 20; clone.y += 20; }
            if (clone.points) {
                for (const p of clone.points) { p.x += 20; p.y += 20; }
            }
            // Deselect old
            if (this.selectedShape) delete this.selectedShape._selected;
            // Add and select new
            this.app.state.addShape(clone);
            clone._selected = true;
            this.selectedShape = clone;
            // Update clipboard offset so next paste goes further
            this.app.state.clipboard = JSON.parse(JSON.stringify(clone));
            delete this.app.state.clipboard._selected;
            return;
        }
    }
}
