export class ConfigManager {
    constructor() {
        this.settings = {};
    }

    async load() {
        try {
            // Load default config dynamically with cache busting
            const v = '?v=8';
            const defaultModule = await import(`../config.default.js${v}`);
            this.settings = { ...defaultModule.defaultConfig };
        } catch (e) {
            console.error("Failed to load config:", e);
        }
    }

    get(path) {
        if (!path) return this.settings;
        try {
            return path.split('.').reduce((obj, key) => {
                if (obj === undefined || obj === null) return undefined;
                return obj[key];
            }, this.settings);
        } catch (e) {
            console.error(`Config Get Error for path ${path}:`, e);
            return undefined;
        }
    }
}
