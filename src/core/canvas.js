export class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvas = document.getElementById('main-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.dpr = window.devicePixelRatio || 1;

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

        // Reset transform to identity for clearRect to work on full screen
        // render() will handle the app transforms

        this.render(); // Force re-render
    }

    attachInputListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.getModifierState('Space'))) {
                this.isPanning = true;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                return;
            }
            this.app.tools.handleEvent('mousedown', e);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;
                this.offset.x += dx;
                this.offset.y += dy;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                // Render will happen in loop
                return;
            }
            this.app.tools.handleEvent('mousemove', e);
        });

        window.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                return;
            }
            this.app.tools.handleEvent('mouseup', e);
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const delta = -e.deltaY * zoomSensitivity;
            const newScale = Math.min(Math.max(0.1, this.scale + delta), 5);

            // Zoom towards mouse pointer
            // 1. Mouse pos relative to viewport
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // 2. Mouse pos in world coords before zoom
            const worldX = (mouseX - this.offset.x) / this.scale;
            const worldY = (mouseY - this.offset.y) / this.scale;

            // 3. Update scale
            this.scale = newScale;

            // 4. Calculate new offset to keep world point under mouse
            this.offset.x = mouseX - worldX * this.scale;
            this.offset.y = mouseY - worldY * this.scale;
        }, { passive: false });

        // Key events
        window.addEventListener('keydown', (e) => this.app.tools.handleEvent('keydown', e));
        window.addEventListener('keyup', (e) => this.app.tools.handleEvent('keyup', e));
    }

    attachDropListeners() {
        // Prevent default browser behavior for drag/drop
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
                        // Calculate world coordinates for drop
                        const rect = this.canvas.getBoundingClientRect();
                        const screenX = e.clientX - rect.left;
                        const screenY = e.clientY - rect.top;

                        const worldX = (screenX - this.offset.x) / this.scale;
                        const worldY = (screenY - this.offset.y) / this.scale;

                        // Add image shape
                        this.app.state.addShape({
                            type: 'image',
                            x: worldX - img.width / 2, // Center on mouse
                            y: worldY - img.height / 2,
                            width: img.width,
                            height: img.height,
                            src: evt.target.result // Base64
                        });
                        this.app.state.uploadImage(file); // Optional: upload to server
                    };
                    img.src = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        }
    }

    // ... existing startRenderLoop ...
    startRenderLoop() {
        const loop = () => {
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    render() {
        // Clear canvas (reset transform first)
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply DPR scaling
        this.ctx.scale(this.dpr, this.dpr);

        // Apply Viewport Transform
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.scale, this.scale);

        // Draw background template
        this.drawBackground();

        // Draw all shapes in state
        this.app.state.shapes.forEach(shape => {
            this.drawShape(shape);
        });

        // Draw generic temporary shape (preview)
        if (this.app.tools.currentTool && this.app.tools.currentTool.previewShape) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.6; // Preview opacity
            this.drawShape(this.app.tools.currentTool.previewShape);
            this.ctx.restore();
        }
    }

    drawBackground() {
        // Dynamic Grid
        const step = 50;
        const color = 'rgba(0,0,0,0.1)';
        const boldColor = 'rgba(0,0,0,0.2)';

        // Calculate visible world bounds
        // Viewport TopLeft (in world coords) = -offset / scale
        const startX = Math.floor((-this.offset.x / this.scale) / step) * step;
        const startY = Math.floor((-this.offset.y / this.scale) / step) * step;

        // Viewport BottomRight (in world coords) = (screenSize - offset) / scale
        const endX = Math.floor(((this.width - this.offset.x) / this.scale) / step) * step + step;
        const endY = Math.floor(((this.height - this.offset.y) / this.scale) / step) * step + step;

        this.ctx.lineWidth = 1 / this.scale; // Keep lines 1px screen width

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

    drawShape(shape) {
        this.ctx.save();
        this.ctx.beginPath();

        // Apply Styles
        this.ctx.strokeStyle = shape.stroke || getComputedStyle(document.body).getPropertyValue('--shape-stroke-default').trim();
        this.ctx.lineWidth = shape.strokeWidth || parseInt(getComputedStyle(document.body).getPropertyValue('--shape-stroke-width-default').trim());
        this.ctx.fillStyle = shape.fill || getComputedStyle(document.body).getPropertyValue('--shape-fill-default').trim();

        if (shape.type === 'path') {
            if (shape.points && shape.points.length > 0) {
                this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
                for (let i = 1; i < shape.points.length; i++) {
                    this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }
            }
        } else if (shape.type === 'rect') {
            this.ctx.rect(shape.x, shape.y, shape.width, shape.height);
        } else if (shape.type === 'circle') {
            const radius = Math.sqrt(Math.pow(shape.width, 2) + Math.pow(shape.height, 2)) / 2;
            this.ctx.arc(shape.x + shape.width / 2, shape.y + shape.height / 2, Math.abs(radius), 0, 2 * Math.PI);
        } else if (shape.type === 'image') {
            const img = new Image();
            img.src = shape.src;
            // Note: In a real app, we should cache the Image object in the shape to avoid creating it every frame
            // For now, browser cache might help, but it's not optimal.
            // Better: 'warm up' images in StateManager or a Resource cache.
            if (img.complete) {
                this.ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
            } else {
                // Blink issue: if not cached, it won't draw until loaded.
            }
        }

        if (shape.fill && shape.fill !== 'transparent') {
            this.ctx.fill();
        }
        this.ctx.stroke();
        this.ctx.restore();
    }
}
