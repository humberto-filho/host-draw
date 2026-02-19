export class StateManager {
    constructor(app) {
        this.app = app;
        this.shapes = [];
        this.history = [];
        this.historyIndex = -1;
        this.clipboard = null;
    }

    addShape(shape) {
        // If we are not at the end of history, truncate it
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.shapes.push(shape);
        this.saveState();
    }

    saveState() {
        // Deep copy shapes to history
        this.history.push(JSON.parse(JSON.stringify(this.shapes)));
        this.historyIndex++;

        // Limit history size to 50
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.shapes = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.app.canvas.render();
            console.log("Undo");
        } else if (this.historyIndex === 0) {
            this.historyIndex = -1;
            this.shapes = [];
            this.app.canvas.render();
            console.log("Undo to empty");
        }
    }

    // Basic clipboard implementation (in-memory for now)
    copy() {
        // Todo: implement selection. For now, copy last shape?
        // Real logic needs a "Selection tool" or explicit selection state
        // creating a simple stub for now
        console.log("Copy - needs selection implementation");
    }

    paste() {
        console.log("Paste - needs selection implementation");
    }

    deleteSelection() {
        // Needs selection logic
        console.log("Delete - needs selection implementation");
    }

    clear() {
        this.shapes = [];
        this.saveState();
    }

    uploadImage(file) {
        // Todo: Implement upload (POST /api/save)
        // this.app.api.upload(file)...
        console.log("Image added to state (in-memory base64). Persistence pending.");
    }
}
