import { Toolbar } from './toolbar.js';

export class UIManager {
    constructor(app) {
        this.app = app;
    }

    init() {
        console.log("UI Initialized");
        this.toolbar = new Toolbar(this.app);
        this.toolbar.render();
    }
}
