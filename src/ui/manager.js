import { Toolbar } from './toolbar.js?v=8';
import { HUD } from './hud.js?v=8';
import { ColorPalette } from './palette.js?v=8';

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
