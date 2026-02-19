export const defaultConfig = {
    // Keybindings map keys to Command IDs
    keybindings: {
        'p': 'tool.pencil',
        'r': 'tool.rectangle',
        'c': 'tool.circle',
        'control+z': 'edit.undo',
        'z': 'edit.undo', // For testing ease
        'u': 'edit.undo', // Vim-like
        'x': 'edit.delete',       // Vim-like delete
    },

    // Visual settings
    theme: {
        background: '#282828',
        accent: '#fe8019',
    },

    tools: {
        pencil: { color: '#ebdbb2', width: 2 },
        rectangle: { color: '#ebdbb2', width: 2, fill: 'transparent' }
    }
};
