export class BaseTool {
    constructor(app, name) {
        this.app = app;
        this.name = name;
        this.active = false;
        this.previewShape = null;
    }

    activate() {
        this.active = true;
        console.log(`Tool activated: ${this.name}`);
    }

    deactivate() {
        this.active = false;
        this.previewShape = null;
    }

    // Default event handlers (to be overridden)
    onMouseDown(e) { }
    onMouseMove(e) { }
    onMouseUp(e) { }
    onKeyDown(e) { }
    onKeyUp(e) { }
}
