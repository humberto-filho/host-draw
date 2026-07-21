// ToolManager is now a JS facade: the actual tools live in the Go/WASM core.
// It keeps the style state (owned by the UI) and the custom cursors.
export class ToolManager {
    constructor(app) {
        this.app = app;
        this.tools = {};
        this.currentTool = null;
        this.pencilCursor = null;
        this.pencilCursorPath = null;
        this.pencilCursorSize = 32;
        this.eraserCursor = null;
        this.eraserCursorSize = 24;
        this.shapeCursors = {};

        // Active visual style
        this.style = {
            strokeColor: '#000000',
            strokeWidth: 2,
            fillColor: 'transparent'
        };
    }

    init() {
        this.setTool('pencil');
    }

    setTool(name) {
        const previousTool = this.currentTool ? this.currentTool.name : null;
        this.currentTool = { name };
        document.documentElement.classList.add('tool-cursor-active');
        if (name === 'eraser' && previousTool !== 'eraser') {
            // Eraser width is multiplied by four in the drawing core.
            this.style.strokeWidth = 9; // 36px erase area: Small
            this.app.eraserSizeIndex = 0;
        }
        window.hostdraw.setTool(name);
        this.updateCursor();

        // Re-render toolbar to update active state
        if (this.app.ui && this.app.ui.toolbar) {
            this.app.ui.toolbar.render();
        }
    }

    // Push the JS-owned style into the core (called before strokes start)
    syncStyle() {
        window.hostdraw.setStyle(this.style.strokeColor, this.style.strokeWidth);
    }

    ensurePencilCursor() {
        if (this.pencilCursor) return;

        const svgNS = 'http://www.w3.org/2000/svg';
        const cursor = document.createElementNS(svgNS, 'svg');
        cursor.setAttribute('viewBox', '0 0 24 24');
        cursor.setAttribute('aria-hidden', 'true');
        cursor.style.cssText = [
            'position: fixed',
            'display: none',
            'pointer-events: none',
            'z-index: 2147483647',
            'overflow: visible'
        ].join(';');

        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M4 17.4V20h2.6L18.7 7.9l-2.6-2.6L4 17.4Zm15.3-11L17.1 4.2l1-1a1.55 1.55 0 0 1 2.2 2.2l-1 1Z');
        cursor.appendChild(path);
        document.body.appendChild(cursor);

        this.pencilCursor = cursor;
        this.pencilCursorPath = path;

        const canvas = this.app.canvas.canvas;
        canvas.addEventListener('mousemove', (event) => {
            if (!this.currentTool || this.currentTool.name !== 'pencil') return;

            const size = this.pencilCursorSize;
            // The pencil point is at (4, 20) in the 24×24 viewBox.
            cursor.style.left = `${event.clientX - size * (4 / 24)}px`;
            cursor.style.top = `${event.clientY - size * (20 / 24)}px`;
            cursor.style.display = 'block';
        });
        canvas.addEventListener('mouseleave', () => {
            cursor.style.display = 'none';
        });
    }

    ensureEraserCursor() {
        if (this.eraserCursor) return;

        const svgNS = 'http://www.w3.org/2000/svg';
        const cursor = document.createElementNS(svgNS, 'svg');
        cursor.setAttribute('viewBox', '0 0 100 100');
        cursor.setAttribute('aria-hidden', 'true');
        cursor.style.cssText = [
            'position: fixed',
            'display: none',
            'pointer-events: none',
            'z-index: 2147483647',
            'overflow: visible'
        ].join(';');

        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', '50');
        circle.setAttribute('cy', '50');
        circle.setAttribute('r', '48');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', 'var(--fg-color)');
        circle.setAttribute('stroke-width', '4');
        cursor.appendChild(circle);
        document.body.appendChild(cursor);

        this.eraserCursor = cursor;

        const canvas = this.app.canvas.canvas;
        canvas.addEventListener('mousemove', (event) => {
            if (!this.currentTool || this.currentTool.name !== 'eraser') return;

            const size = this.eraserCursorSize;
            cursor.style.left = `${event.clientX - size / 2}px`;
            cursor.style.top = `${event.clientY - size / 2}px`;
            cursor.style.display = 'block';
        });
        canvas.addEventListener('mouseleave', () => {
            cursor.style.display = 'none';
        });
    }

    ensureShapeCursor(name) {
        if (this.shapeCursors[name]) return this.shapeCursors[name];

        const svgNS = 'http://www.w3.org/2000/svg';
        const cursor = document.createElementNS(svgNS, 'svg');
        cursor.setAttribute('viewBox', '0 0 24 24');
        cursor.setAttribute('width', '28');
        cursor.setAttribute('height', '28');
        cursor.setAttribute('aria-hidden', 'true');
        cursor.style.cssText = [
            'position: fixed',
            'display: none',
            'pointer-events: none',
            'z-index: 2147483647',
            'overflow: visible'
        ].join(';');

        let shape;
        if (name === 'line') {
            shape = document.createElementNS(svgNS, 'line');
            shape.setAttribute('x1', '5');
            shape.setAttribute('y1', '19');
            shape.setAttribute('x2', '19');
            shape.setAttribute('y2', '5');
            shape.setAttribute('stroke-linecap', 'round');
            shape.setAttribute('stroke-width', '2.5');
        } else if (name === 'rectangle') {
            shape = document.createElementNS(svgNS, 'rect');
            shape.setAttribute('x', '4');
            shape.setAttribute('y', '5');
            shape.setAttribute('width', '16');
            shape.setAttribute('height', '14');
            shape.setAttribute('rx', '1');
            shape.setAttribute('fill', 'none');
            shape.setAttribute('stroke-width', '2');
        } else if (name === 'circle') {
            shape = document.createElementNS(svgNS, 'circle');
            shape.setAttribute('cx', '12');
            shape.setAttribute('cy', '12');
            shape.setAttribute('r', '8');
            shape.setAttribute('fill', 'none');
            shape.setAttribute('stroke-width', '2');
        } else {
            shape = document.createElementNS(svgNS, 'path');
            shape.setAttribute('d', 'M12 2l3.5 3.5H13V11h5.5V8.5L22 12l-3.5 3.5V13H13v5.5h2.5L12 22l-3.5-3.5H11V13H5.5v2.5L2 12l3.5-3.5V11H11V5.5H8.5L12 2Z');
        }

        cursor.appendChild(shape);
        document.body.appendChild(cursor);
        const entry = { cursor, shape, size: 28 };
        this.shapeCursors[name] = entry;

        const canvas = this.app.canvas.canvas;
        canvas.addEventListener('mousemove', (event) => {
            if (!this.currentTool || this.currentTool.name !== name) return;

            cursor.style.left = `${event.clientX - entry.size / 2}px`;
            cursor.style.top = `${event.clientY - entry.size / 2}px`;
            cursor.style.display = 'block';
        });
        canvas.addEventListener('mouseleave', () => {
            cursor.style.display = 'none';
        });

        return entry;
    }

    updateCursor() {
        const canvas = this.app.canvas.canvas;
        const name = this.currentTool ? this.currentTool.name : null;
        const strokeW = this.style.strokeWidth;

        // Remove old classes
        canvas.classList.remove('cursor-pencil');
        canvas.style.removeProperty('cursor');
        canvas.style.cursor = 'default';
        if (this.pencilCursor) this.pencilCursor.style.display = 'none';
        if (this.eraserCursor) this.eraserCursor.style.display = 'none';
        Object.values(this.shapeCursors).forEach(({ cursor }) => {
            cursor.style.display = 'none';
        });

        if (name === 'pencil') {
            const color = this.style.strokeColor;
            const size = strokeW > 3 ? 44 : 32;

            // Render as a normal DOM SVG instead of an OS cursor bitmap. Some
            // Linux cursor pipelines swap red/blue channels in colored cursors.
            this.ensurePencilCursor();
            this.pencilCursorSize = size;
            this.pencilCursor.setAttribute('width', size);
            this.pencilCursor.setAttribute('height', size);
            this.pencilCursorPath.setAttribute('fill', color);
            canvas.style.setProperty('cursor', 'none', 'important');
        } else if (name === 'line') {
            const entry = this.ensureShapeCursor('line');
            const { cursor, shape } = entry;
            entry.size = strokeW > 3 ? 44 : 28;
            cursor.setAttribute('width', entry.size);
            cursor.setAttribute('height', entry.size);
            shape.setAttribute('stroke', this.style.strokeColor);
            shape.setAttribute('stroke-width', strokeW > 3 ? '3.5' : '2.5');
            canvas.style.setProperty('cursor', 'none', 'important');
        } else if (name === 'eraser') {
            // The simple circle shows the exact area that will be erased.
            this.ensureEraserCursor();
            this.eraserCursorSize = strokeW * 4;
            this.eraserCursor.setAttribute('width', this.eraserCursorSize);
            this.eraserCursor.setAttribute('height', this.eraserCursorSize);
            // Override any previous native cursor image (such as the line
            // cursor) so only this eraser indicator is visible.
            canvas.style.setProperty('cursor', 'none', 'important');
        } else if (name === 'rectangle' || name === 'circle') {
            const entry = this.ensureShapeCursor(name);
            const { cursor, shape } = entry;
            entry.size = strokeW > 3 ? 44 : 28;
            cursor.setAttribute('width', entry.size);
            cursor.setAttribute('height', entry.size);
            shape.setAttribute('stroke', this.style.strokeColor);
            shape.setAttribute('stroke-width', strokeW > 3 ? '3' : '2');
            canvas.style.setProperty('cursor', 'none', 'important');
        } else if (name === 'grab') {
            const entry = this.ensureShapeCursor('grab');
            entry.size = 28;
            entry.cursor.setAttribute('width', entry.size);
            entry.cursor.setAttribute('height', entry.size);
            entry.shape.setAttribute('fill', 'var(--fg-color)');
            canvas.style.setProperty('cursor', 'none', 'important');
        }
    }

    // Input events flow straight to the WASM core via canvas.js now.
    handleEvent() { }
}
