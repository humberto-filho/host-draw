const STORAGE_KEY = 'hostdraw_shapes';

export class StateManager {
    constructor(app) {
        this.app = app;
        this.shapes = [];
        this.history = [];
        this.historyIndex = -1;
        this.clipboard = null;
    }

    /** Load saved drawing from localStorage on startup */
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.shapes = JSON.parse(saved);
                this.saveState();
                console.log(`Restored ${this.shapes.length} shapes from cache`);
            }
        } catch (e) {
            console.warn('Failed to restore drawing from cache:', e);
        }
    }

    /** Persist current shapes to localStorage */
    persistToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.shapes));
        } catch (e) {
            // localStorage full (likely large images) — silently fail
            console.warn('Failed to save to cache (storage full?):', e);
        }
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

        // Auto-save to browser cache
        this.persistToStorage();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.shapes = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.persistToStorage();
            this.app.canvas.render();
            console.log("Undo");
        } else if (this.historyIndex === 0) {
            this.historyIndex = -1;
            this.shapes = [];
            this.persistToStorage();
            this.app.canvas.render();
            console.log("Undo to empty");
        }
    }

    copy() {
        console.log("Copy - use grab tool (g) then Ctrl+C");
    }

    paste() {
        console.log("Paste - use grab tool (g) then Ctrl+V");
    }

    deleteSelection() {
        console.log("Delete - use grab tool (g) then Delete key");
    }

    clear() {
        this.shapes = [];
        this.saveState();
    }

    uploadImage(file) {
        console.log("Image added to state (in-memory base64). Persistence pending.");
    }
}
