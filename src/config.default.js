export const defaultConfig = {
    // Keybindings map keys to Command IDs
    keybindings: {
        'p': 'tool.pencil',
        'r': 'tool.rectangle',
        'c': 'tool.circle',
        'l': 'tool.line',
        'e': 'tool.eraser',
        'x': 'theme.toggle',
        'control+z': 'edit.undo',

        // Colors (1-6)
        '1': 'set.color.1',
        '2': 'set.color.2',
        '3': 'set.color.3',
        '4': 'set.color.4',
        '5': 'set.color.5',
        '6': 'set.color.6',
    },

    // Theme & Visuals
    theme: {
        background: '#ffffff',
        gridColor: 'rgba(0,0,0,0.1)',
        gridBoldColor: 'rgba(0,0,0,0.2)',
    },

    // Tool Defaults
    tools: {
        pencil: {
            lineWidth: 2,
            strokeStyle: '#ffffff', // White by default for dark theme
            smoothing: true
        },
        line: {
            lineWidth: 2,
            strokeStyle: '#ffffff',
            smoothing: false
        },
        rectangle: {
            lineWidth: 2,
            strokeStyle: '#000000',
            fillStyle: 'transparent'
        },
        circle: {
            lineWidth: 2,
            strokeStyle: '#000000',
            fillStyle: 'transparent'
        }
    },

    // Presets
    presets: {
        // Defined as arrays for Light (index 0) and Dark (index 1) modes logic
        // But here we just define the sets. App.js will handle the switching.
        themeColors: {
            light: [
                { name: 'Ink', hex: '#282828' },
                { name: 'Red', hex: '#cc241d' },
                { name: 'Green', hex: '#98971a' },
                { name: 'Yellow', hex: '#d79921' },
                { name: 'Blue', hex: '#458588' },
                { name: 'Purple', hex: '#b16286' }
            ],
            dark: [
                { name: 'Ink', hex: '#ebdbb2' }, // Cream/White
                { name: 'Red', hex: '#fb4934' },
                { name: 'Green', hex: '#b8bb26' },
                { name: 'Yellow', hex: '#fabd2f' },
                { name: 'Blue', hex: '#83a598' },
                { name: 'Purple', hex: '#d3869b' }
            ]
        },
        strokeWidths: {
            'thin': 2,
            'medium': 5,
            'thick': 10,
            'marker': 20
        },
        backgrounds: {
            'light': { background: '#ffffff', grid: 'rgba(0,0,0,0.1)', gridBold: 'rgba(0,0,0,0.2)' },
            'dark': { background: '#1e1e1e', grid: 'rgba(255,255,255,0.1)', gridBold: 'rgba(255,255,255,0.2)' }
        }
    }
};
