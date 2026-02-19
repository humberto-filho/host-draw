export class CommandRegistry {
    constructor(app) {
        this.app = app;
        this.commands = {};
        this.keybindings = {};
    }

    register(id, description, callback) {
        this.commands[id] = {
            id,
            description,
            callback
        };
    }

    execute(id) {
        const command = this.commands[id];
        if (command) {
            console.log(`Executing command: ${id}`);
            command.callback();
        } else {
            console.warn(`Command not found: ${id}`);
        }
    }

    // Bind a key combo to a command ID
    bind(key, commandId) {
        this.keybindings[key] = commandId;
    }

    // Handle key presses from the standardized handler
    handleKey(e) {
        // Robust key parser
        // 1. Identify base key (always lowercase for consistent matching)
        let baseKey = e.key.toLowerCase();

        // Ignore modifier keys themselves
        if (['control', 'shift', 'alt', 'meta'].includes(baseKey)) return;

        // 2. Build chord string
        let chord = [];
        if (e.ctrlKey) chord.push('control');
        if (e.altKey) chord.push('alt');
        if (e.shiftKey) chord.push('shift');
        chord.push(baseKey);

        const keyString = chord.join('+');

        console.log(`Key pressed: ${keyString}`); // Debugging

        const commandId = this.keybindings[keyString];
        if (commandId) {
            e.preventDefault();
            this.execute(commandId);
        }
    }
}
