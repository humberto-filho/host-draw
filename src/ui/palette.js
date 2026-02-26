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

        const themeColors = this.app.config.get('presets.themeColors');
        if (!themeColors) return;

        const isDark = this.app.ui.toolbar.isDark;
        const colorMap = isDark ? themeColors.dark : themeColors.light;

        const currentColor = this.app.tools.style.strokeColor;
        const isActive = (hex) => currentColor && currentColor.toLowerCase() === hex.toLowerCase();
        const MAX_COLORS = 15;
        const BUILTIN_COUNT = 6;

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

            if (!isDark && c.name === 'Ink') {
                swatch.style.border = '1px solid rgba(0,0,0,0.2)';
            }

            const label = document.createElement('span');
            label.className = 'color-label';
            label.textContent = key <= 9 ? key : '';

            item.onclick = () => {
                if (key <= 9) {
                    this.app.commands.execute(`set.color.${key}`);
                } else {
                    this.app.tools.style.strokeColor = c.hex;
                    this.app.tools.updateCursor();
                    this.render();
                }
            };

            item.appendChild(swatch);
            item.appendChild(label);
            this.element.appendChild(item);
        });

        // ── Color picker section ──
        const pickerRow = document.createElement('div');
        pickerRow.style.cssText = `
            display: flex; flex-direction: column; align-items: center;
            gap: 4px; margin-top: 6px; padding-top: 6px;
            border-top: 1px solid var(--panel-border);
        `;

        // Hidden real color input
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#e06c75';
        colorInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';

        // Visible full-circle swatch
        let pickedColor = '#e06c75';
        const pickerSwatch = document.createElement('div');
        pickerSwatch.title = 'Click to pick a color';
        pickerSwatch.style.cssText = `
            width: 28px; height: 28px; border-radius: 50%;
            background: ${pickedColor};
            border: 2px solid var(--panel-border);
            cursor: pointer; transition: transform 0.1s;
        `;
        pickerSwatch.onmouseenter = () => pickerSwatch.style.transform = 'scale(1.1)';
        pickerSwatch.onmouseleave = () => pickerSwatch.style.transform = 'scale(1)';
        pickerSwatch.onclick = () => colorInput.click();

        colorInput.addEventListener('input', () => {
            pickedColor = colorInput.value;
            pickerSwatch.style.background = pickedColor;
        });

        // "Add" button — rounded rectangle; disabled at max
        const addBtn = document.createElement('button');
        const atMax = colorMap.length >= MAX_COLORS;
        addBtn.textContent = atMax ? `Max (${MAX_COLORS})` : 'Add';
        addBtn.title = atMax ? `Maximum ${MAX_COLORS} colors` : 'Add picked color to palette';
        addBtn.disabled = atMax;
        addBtn.style.cssText = `
            width: 100%; padding: 4px 0; border-radius: 6px;
            background: ${atMax ? 'var(--panel-border)' : 'var(--accent-color)'};
            color: ${atMax ? 'var(--fg-color)' : '#282828'};
            border: none; cursor: ${atMax ? 'not-allowed' : 'pointer'};
            font-family: var(--font-mono, monospace);
            font-size: 11px; font-weight: bold; transition: opacity 0.15s;
            opacity: ${atMax ? '0.5' : '1'};
        `;
        if (!atMax) {
            addBtn.onmouseenter = () => addBtn.style.opacity = '0.85';
            addBtn.onmouseleave = () => addBtn.style.opacity = '1';
            addBtn.onclick = () => this.app.addCustomColor(pickedColor);
        }

        pickerRow.appendChild(colorInput);
        pickerRow.appendChild(pickerSwatch);
        pickerRow.appendChild(addBtn);
        this.element.appendChild(pickerRow);
    }
}
