export class ColorPalette {
    constructor(app) {
        this.app = app;
        this.element = null;
    }

    init() {
        try {
            this.element = document.createElement('div');
            this.element.id = 'color-palette';

            const uiLayer = document.getElementById('ui-layer');
            if (uiLayer) {
                uiLayer.appendChild(this.element);
            } else {
                document.body.appendChild(this.element);
            }

            this.render();
        } catch (e) {
            console.error("Palette Error:", e);
            alert("Palette Error: " + e.message);
        }
    }

    render() {
        if (!this.element) return;
        this.element.innerHTML = '';

        // Get colors from config (theme-aware)
        const themeColors = this.app.config.get('presets.themeColors');
        if (!themeColors) return;

        const isDark = this.app.ui.toolbar.isDark;
        const colorMap = isDark ? themeColors.dark : themeColors.light;

        const currentColor = this.app.tools.style.strokeColor;
        const isActive = (hex) => currentColor && currentColor.toLowerCase() === hex.toLowerCase();

        colorMap.forEach((c, index) => {
            const key = index + 1;
            const item = document.createElement('div');
            item.className = 'color-item';

            if (isActive(c.hex)) {
                item.classList.add('active');
                item.style.outline = '2px solid var(--accent-color)';
                item.style.outlineOffset = '2px';
                item.style.borderRadius = '6px';
            }

            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = c.hex;

            // Border for light colors on light bg or dark colors on dark bg
            if (!isDark && c.name === 'Ink') {
                swatch.style.border = '1px solid rgba(0,0,0,0.2)';
            }

            const label = document.createElement('span');
            label.className = 'color-label';
            label.textContent = key;

            item.onclick = () => {
                // Use the numbered command which is theme-aware
                this.app.commands.execute(`set.color.${key}`);
            };

            item.appendChild(swatch);
            item.appendChild(label);
            this.element.appendChild(item);
        });
    }
}
