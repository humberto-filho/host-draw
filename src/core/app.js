export class App {
    constructor() {
        this.canvas = null;
        this.state = null;
        this.tools = null;
        this.ui = null;
    }

    async init() {
        console.log("Initializing Host-Draw...");

        // Dynamic imports to avoid circular dependency issues during early dev
        const { CanvasManager } = await import('./canvas.js');
        const { StateManager } = await import('./state.js');
        const { ToolManager } = await import('../tools/manager.js');
        const { UIManager } = await import('../ui/manager.js');
        const { ConfigManager } = await import('../utils/config.js');
        const { CommandRegistry } = await import('./commands.js');

        this.config = new ConfigManager();
        await this.config.load();

        this.commands = new CommandRegistry(this);
        this.state = new StateManager(this);
        this.canvas = new CanvasManager(this);
        this.tools = new ToolManager(this);
        this.ui = new UIManager(this);

        this.canvas.init();
        this.tools.init();
        this.ui.init();

        // Register Core Commands
        this.commands.register('tool.pencil', 'Select Pencil Tool', () => this.tools.setTool('pencil'));
        this.commands.register('tool.rectangle', 'Select Rectangle Tool', () => this.tools.setTool('rectangle'));
        this.commands.register('tool.circle', 'Select Circle Tool', () => this.tools.setTool('circle'));

        // Edit Commands
        this.commands.register('edit.undo', 'Undo Last Action', () => this.state.undo());
        // this.commands.register('edit.copy', 'Copy Selection', () => this.state.copy()); // Pending selection impl

        // Apply Config Keybindings
        const bindings = this.config.get('keybindings');
        if (bindings) {
            for (const [key, commandId] of Object.entries(bindings)) {
                this.commands.bind(key, commandId);
            }
        }

        // Listen for global keys
        window.addEventListener('keydown', (e) => this.commands.handleKey(e));

        console.log("Host-Draw initialized.");
    }
}

const app = new App();
window.app = app; // For debugging
app.init();
