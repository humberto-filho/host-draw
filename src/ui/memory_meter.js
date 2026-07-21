export class MemoryMeter {
    constructor() {
        this.element = null;
        this.preciseMemoryAvailable = typeof performance.measureUserAgentSpecificMemory === 'function';
        this.updating = false;
        this.peakBytes = 0;
    }

    init() {
        this.element = document.createElement('div');
        this.element.id = 'memory-meter';
        this.element.className = 'panel';
        this.element.textContent = 'RAM -- MB';
        this.element.title = 'Approximate RAM used by Host-Draw';

        const uiLayer = document.getElementById('ui-layer');
        (uiLayer || document.body).appendChild(this.element);

        void this.update();
        this.timer = window.setInterval(() => void this.update(), 5000);
    }

    reset() {
        this.peakBytes = 0;
        if (this.element) this.element.textContent = 'RAM -- MB';
        void this.update();
    }

    async update() {
        if (!this.element || this.updating) return;
        this.updating = true;

        try {
            let bytes = 0;
            if (this.preciseMemoryAvailable) {
                try {
                    // Avoid overlapping or stalled browser measurements.
                    const measurement = await Promise.race([
                        performance.measureUserAgentSpecificMemory(),
                        new Promise((_, reject) => {
                            window.setTimeout(() => reject(new Error('Memory measurement timed out')), 2000);
                        })
                    ]);
                    bytes = measurement.bytes;
                } catch {
                    // This API requires cross-origin isolation in some browsers.
                    this.preciseMemoryAvailable = false;
                }
            }

            if (!bytes) {
                const heapBytes = performance.memory?.usedJSHeapSize || 0;
                const wasmBytes = window.hostdrawWasmMemory?.buffer?.byteLength || 0;
                bytes = heapBytes + wasmBytes;
            }

            if (!bytes) {
                this.element.textContent = 'RAM unavailable';
                return;
            }

            this.peakBytes = Math.max(this.peakBytes, bytes);
            const megabytes = bytes / (1024 * 1024);
            const peakMegabytes = this.peakBytes / (1024 * 1024);
            this.element.textContent = `RAM ${megabytes.toFixed(1)} MB`;
            this.element.title = `Updated every 5 seconds · Peak ${peakMegabytes.toFixed(1)} MB · Excludes GPU and browser-process memory`;
        } finally {
            this.updating = false;
        }
    }
}
