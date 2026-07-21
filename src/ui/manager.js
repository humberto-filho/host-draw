import { Toolbar } from './toolbar.js?v=32';
import { HUD } from './hud.js?v=32';
import { ColorPalette } from './palette.js?v=33';
import { MemoryMeter } from './memory_meter.js?v=3';

export class UIManager {
    constructor(app) {
        this.app = app;
        this.toolbar = new Toolbar(app);
        this.hud = new HUD(app);
        this.palette = new ColorPalette(app);
        this.memoryMeter = new MemoryMeter();
    }

    init() {
        this.toolbar.init();
        this.palette.init();
        this.hud.init();
        this.memoryMeter.init();
    }
}
