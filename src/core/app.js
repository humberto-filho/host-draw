export class App {
    constructor() {
        this.canvas = null;
        this.state = null;
        this.tools = null;
        this.ui = null;
    }

    async init() {
        try {
            console.log("Initializing Host-Draw...");

            const v = '?v=8';
            const { CanvasManager } = await import(`./canvas.js${v}`);
            const { StateManager } = await import(`./state.js${v}`);
            const { ToolManager } = await import(`../tools/manager.js${v}`);
            const { UIManager } = await import(`../ui/manager.js${v}`);
            const { ConfigManager } = await import(`../utils/config.js${v}`);
            const { CommandRegistry } = await import(`./commands.js${v}`);

            this.config = new ConfigManager();
            await this.config.load();

            // Apply loaded theme to CSS immediately
            this.applyThemeFromConfig();

            this.commands = new CommandRegistry(this);
            this.state = new StateManager(this);
            this.canvas = new CanvasManager(this);
            this.tools = new ToolManager(this);
            this.ui = new UIManager(this);

            // Initialize canvas and tools first
            this.canvas.init();
            this.tools.init();

            // Register all commands
            this.commands.register('tool.pencil', 'Select Pencil Tool', () => this.tools.setTool('pencil'));
            this.commands.register('tool.eraser', 'Select Eraser Tool', () => this.tools.setTool('eraser'));
            this.commands.register('tool.line', 'Select Line Tool', () => this.tools.setTool('line'));
            this.commands.register('tool.rectangle', 'Select Rectangle Tool', () => this.tools.setTool('rectangle'));
            this.commands.register('tool.circle', 'Select Circle Tool', () => this.tools.setTool('circle'));
            this.commands.register('edit.undo', 'Undo Last Action', () => this.state.undo());

            this.registerConfigCommands();

            // Theme toggle command
            this.commands.register('theme.toggle', 'Toggle Light/Dark Theme', () => {
                if (this.ui && this.ui.toolbar) {
                    this.ui.toolbar.toggleTheme();
                }
            });

            // Bind keys from config
            const bindings = this.config.get('keybindings');
            if (bindings) {
                for (const [key, commandId] of Object.entries(bindings)) {
                    this.commands.bind(key, commandId);
                }
            }

            // Now init UI
            this.ui.init();

            // Listen for global keys
            window.addEventListener('keydown', (e) => this.commands.handleKey(e));

            // Right Click: toggle stroke OR eraser size
            this.eraserSizeIndex = 0;
            const eraserSizes = [10, 20, 40]; // Small, Medium, Big
            window.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const toolName = this.tools.currentTool ? this.tools.currentTool.name : '';

                if (toolName === 'eraser') {
                    // Cycle through eraser sizes: Small → Medium → Big → Small
                    this.eraserSizeIndex = (this.eraserSizeIndex + 1) % eraserSizes.length;
                    const size = eraserSizes[this.eraserSizeIndex];
                    this.tools.style.strokeWidth = size;
                    const label = ['Small', 'Medium', 'Big'][this.eraserSizeIndex];
                    console.log(`Eraser size: ${label} (${size}px)`);
                } else {
                    // Toggle stroke: thin ↔ thick
                    const current = this.tools.style.strokeWidth;
                    const next = current > 5 ? 2 : 8;
                    this.tools.style.strokeWidth = next;
                    console.log(`Stroke: ${next > 5 ? 'Thick' : 'Thin'} (${next}px)`);
                }
                this.tools.updateCursor();
                if (this.ui && this.ui.hud) this.ui.hud.render();
            });

            console.log("Host-Draw initialized.");
        } catch (e) {
            console.error("Initialization Failed:", e);
            alert(`App Init Failed: ${e.message}\n${e.stack}`);
        }
    }

    applyThemeFromConfig() {
        const theme = this.config.get('theme');
        if (theme) {
            const bg = theme.background || '#282828';
            document.documentElement.style.setProperty('--bg-color', bg);

            const isDark = bg.startsWith('#1') || bg.startsWith('#2') || bg === '#000000';

            if (!isDark) {
                document.documentElement.style.setProperty('--fg-color', '#282828');
                document.documentElement.style.setProperty('--panel-bg', '#fbf1c7');
                document.documentElement.style.setProperty('--panel-border', '#d5c4a1');
            } else {
                document.documentElement.style.setProperty('--fg-color', '#ebdbb2');
                document.documentElement.style.setProperty('--panel-bg', '#3c3836');
                document.documentElement.style.setProperty('--panel-border', '#504945');
            }
        }
    }

    // Build a color mapping from one theme palette to another
    getColorMapping(fromTheme, toTheme) {
        const themeColors = this.config.get('presets.themeColors');
        if (!themeColors) return {};
        const from = themeColors[fromTheme];
        const to = themeColors[toTheme];
        const mapping = {};
        for (let i = 0; i < from.length && i < to.length; i++) {
            mapping[from[i].hex.toLowerCase()] = to[i].hex;
        }
        return mapping;
    }

    // Remap all shape colors when switching themes
    remapShapeColors(fromTheme, toTheme) {
        const mapping = this.getColorMapping(fromTheme, toTheme);
        for (const shape of this.state.shapes) {
            if (shape.stroke) {
                const key = shape.stroke.toLowerCase();
                if (mapping[key]) {
                    shape.stroke = mapping[key];
                }
            }
        }
    }

    registerConfigCommands() {
        // Theme-Aware Color Commands (1-6)
        const themeColors = this.config.get('presets.themeColors');

        const getColors = () => {
            const bg = this.config.settings.theme.background;
            const isDark = bg.startsWith('#1') || bg.startsWith('#2') || bg === '#000000';
            return isDark ? themeColors.dark : themeColors.light;
        };

        if (themeColors) {
            for (let i = 1; i <= 6; i++) {
                this.commands.register(`set.color.${i}`, `Set Color ${i}`, () => {
                    const colors = getColors();
                    const colorObj = colors[i - 1];
                    if (colorObj) {
                        this.tools.style.strokeColor = colorObj.hex;
                        this.tools.updateCursor();
                        if (this.ui.palette) this.ui.palette.render();
                        console.log(`Color set to ${colorObj.name} (${colorObj.hex})`);
                    }
                });
            }
        }

        // Strokes
        const widths = this.config.get('presets.strokeWidths');
        if (widths) {
            for (const [name, value] of Object.entries(widths)) {
                this.commands.register(`set.stroke.${name}`, `Set Stroke ${name}`, () => {
                    this.tools.style.strokeWidth = value;
                    console.log(`Stroke set to ${name}`);
                });
            }
        }

        // Backgrounds / Themes
        const bgs = this.config.get('presets.backgrounds');
        if (bgs) {
            for (const [name, theme] of Object.entries(bgs)) {
                this.commands.register(`set.theme.${name}`, `Set Theme ${name}`, () => {
                    // Determine previous theme before switching
                    const prevBg = this.config.settings.theme.background;
                    const wasDark = prevBg.startsWith('#1') || prevBg.startsWith('#2') || prevBg === '#000000';
                    const prevTheme = wasDark ? 'dark' : 'light';

                    // Update config
                    this.config.settings.theme.background = theme.background;
                    this.config.settings.theme.gridColor = theme.grid;
                    this.config.settings.theme.gridBoldColor = theme.gridBold;

                    this.applyThemeFromConfig();

                    // Remap existing shape colors for contrast
                    this.remapShapeColors(prevTheme, name);

                    // Auto-switch drawing color to Ink
                    this.commands.execute('set.color.1');

                    this.canvas.render();

                    if (this.ui.toolbar) {
                        this.ui.toolbar.isDark = (name === 'dark');
                        this.ui.toolbar.render();
                    }
                    if (this.ui.palette) this.ui.palette.render();
                    if (this.ui.hud) this.ui.hud.render();

                    console.log(`Theme set to ${name}`);
                });
            }
        }
    }
}

const app = new App();
window.app = app;
app.init();
