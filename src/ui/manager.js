import { Toolbar } from './toolbar.js?v=30';
import { HUD } from './hud.js?v=30';
import { ColorPalette } from './palette.js?v=30';

export class UIManager {
    constructor(app) {
        this.app = app;
        this.toolbar = new Toolbar(app);
        this.hud = new HUD(app);
        this.palette = new ColorPalette(app);
    }

    init() {
        this.toolbar.init();
        this.palette.init();
        this.hud.init();
    }
}
