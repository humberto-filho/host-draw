// CanvasManager is now a thin event forwarder: the Go/WASM core owns the
// viewport, tools and all rendering. This file only keeps DOM listeners,
// canvas sizing and the rAF pump.
export class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvas = document.getElementById('main-canvas');
        this.width = 0;
        this.height = 0;
        this.dpr = window.devicePixelRatio || 1;
        this.pointerActive = false;
        this.drawing = false;
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
        this.dpr = window.devicePixelRatio || 1;

        // Handle High DPI displays
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        window.hostdraw.resize(this.width, this.height, this.dpr);
    }

    startRenderLoop() {
        const loop = () => {
            // Renders only when the scene is dirty (no idle redraws)
            window.hostdraw.frame();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    eventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    attachInputListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            const { x, y } = this.eventPos(e);
            // Style lives in JS (UI); make sure the core has it before strokes start
            this.app.tools.syncStyle();
            // Track active drawing strokes (left button, not panning)
            this.pointerActive = true;
            this.drawing = (e.button === 0 && !e.getModifierState('Space'));
            window.hostdraw.pointerDown(x, y, e.button, e.getModifierState('Space'));
        });

        window.addEventListener('mousemove', (e) => {
            // While a stroke is in progress, ignore positions over UI panels
            // (toolbar, palette, HUD, popups) so strokes and erasures don't
            // continue underneath the buttons. Panning is unaffected.
            if (this.drawing && e.target !== this.canvas) return;
            const { x, y } = this.eventPos(e);
            window.hostdraw.pointerMove(x, y);
        });

        window.addEventListener('mouseup', (e) => {
            if (!this.pointerActive) return;

            const endedOnCanvas = e.target === this.canvas;
            this.pointerActive = false;
            this.drawing = false;

            // A release on the toolbar, palette or popup must never supply
            // UI coordinates to a drawing tool as the end of a stroke.
            if (!endedOnCanvas) {
                window.hostdraw.cancelPointer();
                return;
            }

            const { x, y } = this.eventPos(e);
            window.hostdraw.pointerUp(x, y, e.button);
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const { x, y } = this.eventPos(e);
            window.hostdraw.wheel(x, y, e.deltaY);
        }, { passive: false });

        // Key events: grab tool (delete/copy/paste) inside the core
        window.addEventListener('keydown', (e) => window.hostdraw.key('keydown', e.key, e.ctrlKey, e.metaKey));
        window.addEventListener('keyup', (e) => window.hostdraw.key('keyup', e.key, e.ctrlKey, e.metaKey));
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
                        const { x, y } = this.eventPos(e);
                        const [worldX, worldY] = window.hostdraw.screenToWorld(x, y);

                        window.hostdraw.addImage(
                            evt.target.result,
                            worldX - img.width / 2,
                            worldY - img.height / 2,
                            img.width,
                            img.height
                        );
                    };
                    img.src = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        }
    }
}
