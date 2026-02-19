import { defaultConfig } from '../config.default.js';

export class ConfigManager {
    constructor() {
        this.settings = { ...defaultConfig };
    }

    async load() {
        try {
            // Try to load user config if it exists
            // Since this is client-side, we might need a specific conventions
            // For now, we'll check if a global 'userConfig' is defined or fetch a file

            const response = await fetch('/config.js');
            if (response.ok) {
                const text = await response.text();
                // This is a bit sketch for security but standard for "dotfile" apps
                // Better approach: dynamic import if browser supports it for local files
                // or just parsing JSON. 
                // For "Neovim-like" JS config, dynamic import is best.

                try {
                    const userModule = await import(/* @vite-ignore */ '/config.js');
                    if (userModule.default) {
                        this.mergeConfig(userModule.default);
                        console.log("User config loaded.");
                    }
                } catch (e) {
                    console.warn("Could not load user config module:", e);
                }
            }
        } catch (e) {
            console.log("No user config found, using defaults.");
        }
    }

    mergeConfig(userConfig) {
        // Deep merge logic would go here
        // For now, simple shallow merge of top-level keys
        this.settings = {
            ...this.settings,
            ...userConfig,
            keybindings: { ...this.settings.keybindings, ...userConfig.keybindings },
            tools: { ...this.settings.tools, ...userConfig.tools },
            theme: { ...this.settings.theme, ...userConfig.theme }
        };
    }

    get(key) {
        return key.split('.').reduce((o, i) => o[i], this.settings);
    }
}
