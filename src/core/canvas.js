export class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvas = document.getElementById('main-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.dpr = window.devicePixelRatio || 1;

        // Offscreen canvas for shapes layer (eraser won't affect grid)
        this.shapeCanvas = document.createElement('canvas');
        this.shapeCtx = this.shapeCanvas.getContext('2d');

        // Viewport state (Infinite Board)
        this.offset = { x: 0, y: 0 };
        this.scale = 1;

        // Pannable via Middle Mouse or Space+Drag
        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };
    }

    init() {
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.startRenderLoop();

        this.attachInputListeners();
        this.attachDropListeners();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Handle High DPI displays
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        // Resize offscreen shape canvas to match
        this.shapeCanvas.width = this.width * this.dpr;
        this.shapeCanvas.height = this.height * this.dpr;

        this.render();
    }

    attachInputListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            // Middle mouse or Space+Left = panning
            if (e.button === 1 || (e.button === 0 && e.getModifierState('Space'))) {
                this.isPanning = true;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                return;
            }
            // ONLY left click (button 0) should trigger tools
            if (e.button === 0) {
                this.app.tools.handleEvent('mousedown', e);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;
                this.offset.x += dx;
                this.offset.y += dy;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                return;
            }
            this.app.tools.handleEvent('mousemove', e);
        });

        window.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                return;
            }
            if (e.button === 0) {
                this.app.tools.handleEvent('mouseup', e);
            }
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const delta = -e.deltaY * zoomSensitivity;
            const newScale = Math.min(Math.max(0.1, this.scale + delta), 5);

            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const worldX = (mouseX - this.offset.x) / this.scale;
            const worldY = (mouseY - this.offset.y) / this.scale;

            this.scale = newScale;

            this.offset.x = mouseX - worldX * this.scale;
            this.offset.y = mouseY - worldY * this.scale;
        }, { passive: false });

        // Key events
        window.addEventListener('keydown', (e) => this.app.tools.handleEvent('keydown', e));
        window.addEventListener('keyup', (e) => this.app.tools.handleEvent('keyup', e));
    }

    attachDropListeners() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.canvas.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        this.canvas.addEventListener('drop', (e) => this.handleDrop(e), false);
    }

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.match('image.*')) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const img = new Image();
                    img.onload = () => {
                        const rect = this.canvas.getBoundingClientRect();
                        const screenX = e.clientX - rect.left;
                        const screenY = e.clientY - rect.top;

                        const worldX = (screenX - this.offset.x) / this.scale;
                        const worldY = (screenY - this.offset.y) / this.scale;

                        this.app.state.addShape({
                            type: 'image',
                            x: worldX - img.width / 2,
                            y: worldY - img.height / 2,
                            width: img.width,
                            height: img.height,
                            src: evt.target.result
                        });
                        this.app.state.uploadImage(file);
                    };
                    img.src = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        }
    }

    startRenderLoop() {
        const loop = () => {
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    render() {
        // === MAIN CANVAS: Clear and draw background grid ===
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // DPR + viewport transform for main canvas
        this.ctx.scale(this.dpr, this.dpr);
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.scale, this.scale);

        // Draw background grid on main canvas (protected from eraser)
        this.drawBackground();

        // === OFFSCREEN SHAPE CANVAS: Draw shapes here ===
        // This keeps eraser (destination-out) from affecting the grid
        this.shapeCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.shapeCtx.clearRect(0, 0, this.shapeCanvas.width, this.shapeCanvas.height);

        // Same DPR + viewport transform
        this.shapeCtx.scale(this.dpr, this.dpr);
        this.shapeCtx.translate(this.offset.x, this.offset.y);
        this.shapeCtx.scale(this.scale, this.scale);

        // Draw all shapes on offscreen canvas
        this.app.state.shapes.forEach(shape => {
            this.drawShape(this.shapeCtx, shape);
        });

        // Draw preview shape if any
        if (this.app.tools.currentTool && this.app.tools.currentTool.previewShape) {
            this.shapeCtx.save();
            this.shapeCtx.globalAlpha = 0.6;
            this.drawShape(this.shapeCtx, this.app.tools.currentTool.previewShape);
            this.shapeCtx.restore();
        }

        // === Composite offscreen shapes onto main canvas ===
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.drawImage(this.shapeCanvas, 0, 0);
    }

    drawBackground() {
        const theme = this.app.config.get('theme') || {};
        const step = 50;
        const color = theme.gridColor || 'rgba(0,0,0,0.1)';
        const boldColor = theme.gridBoldColor || 'rgba(0,0,0,0.2)';
        const bgColor = theme.background || '#ffffff';

        // Fill visible background area (screen coords)
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();

        // Calculate visible world bounds
        const startX = Math.floor((-this.offset.x / this.scale) / step) * step;
        const startY = Math.floor((-this.offset.y / this.scale) / step) * step;
        const endX = Math.floor(((this.width - this.offset.x) / this.scale) / step) * step + step;
        const endY = Math.floor(((this.height - this.offset.y) / this.scale) / step) * step + step;

        this.ctx.lineWidth = 1 / this.scale;

        for (let x = startX; x <= endX; x += step) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = (x % (step * 5) === 0) ? boldColor : color;
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }

        for (let y = startY; y <= endY; y += step) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = (y % (step * 5) === 0) ? boldColor : color;
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
    }

    drawShape(ctx, shape) {
        ctx.save();
        ctx.beginPath();

        // Handle Eraser Mode
        if (shape.composite) {
            ctx.globalCompositeOperation = shape.composite;
        }

        // Apply Styles
        ctx.strokeStyle = shape.stroke || '#000000';
        ctx.lineWidth = shape.strokeWidth || 2;
        ctx.fillStyle = shape.fill || 'transparent';

        if (shape.type === 'path') {
            if (shape.points && shape.points.length > 0) {
                ctx.moveTo(shape.points[0].x, shape.points[0].y);
                for (let i = 1; i < shape.points.length; i++) {
                    ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }
            }
        } else if (shape.type === 'rect' || shape.type === 'rectangle') {
            ctx.rect(shape.x, shape.y, shape.width, shape.height);
        } else if (shape.type === 'circle') {
            const radius = Math.sqrt(Math.pow(shape.width, 2) + Math.pow(shape.height, 2)) / 2;
            ctx.arc(shape.x + shape.width / 2, shape.y + shape.height / 2, Math.abs(radius), 0, 2 * Math.PI);
        } else if (shape.type === 'image') {
            const img = new Image();
            img.src = shape.src;
            if (img.complete) {
                ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
            }
        }

        if (shape.fill && shape.fill !== 'transparent') {
            ctx.fill();
        }
        ctx.stroke();
        ctx.restore();
    }
}
