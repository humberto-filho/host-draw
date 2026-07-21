export class App {
    constructor() {
        this.canvas = null;
        this.tools = null;
        this.ui = null;
    }

    async init() {
        try {
            console.log("Initializing Host-Draw...");

            const v = '?v=54';
            const { CanvasManager } = await import(`./canvas.js${v}`);
            const { ToolManager } = await import(`../tools/manager.js${v}`);
            const { UIManager } = await import(`../ui/manager.js${v}`);
            const { ConfigManager } = await import(`../utils/config.js${v}`);
            const { CommandRegistry } = await import(`./commands.js${v}`);
            const { loadWasmCore } = await import('./wasm_loader.js?v=38');

            this.config = new ConfigManager();
            await this.config.load();

            this.applyThemeFromConfig();

            this.commands = new CommandRegistry(this);
            this.canvas = new CanvasManager(this);
            this.tools = new ToolManager(this);
            this.ui = new UIManager(this);

            // Boot the Go/WASM drawing core (owns scene, tools, rendering)
            await loadWasmCore();
            const theme = this.config.get('theme') || {};
            const wasmErr = window.hostdraw.init('main-canvas', JSON.stringify(theme), {
                stateChanged: (json) => this.persistShapes(json),
                popup: (msg) => this.showPopup(msg),
                selectionChanged: () => { }
            });
            if (wasmErr) throw new Error(wasmErr);

            // A drawing selected before reload replaces the cached document.
            const pendingDrawing = sessionStorage.getItem('hostdraw_pending_drawing');
            if (pendingDrawing) sessionStorage.removeItem('hostdraw_pending_drawing');

            if (!pendingDrawing) {
                const saved = localStorage.getItem('hostdraw_shapes');
                if (saved) window.hostdraw.importShapes(saved);
            }

            this.canvas.init();
            this.tools.init();

            // Register commands
            this.commands.register('tool.pencil', 'Select Pencil Tool', () => this.tools.setTool('pencil'));
            this.commands.register('tool.eraser', 'Select Eraser Tool', () => this.tools.setTool('eraser'));
            this.commands.register('tool.line', 'Select Line Tool', () => this.tools.setTool('line'));
            this.commands.register('tool.rectangle', 'Select Rectangle Tool', () => this.tools.setTool('rectangle'));
            this.commands.register('tool.circle', 'Select Circle Tool', () => this.tools.setTool('circle'));
            this.commands.register('tool.grab', 'Select Grab Tool', () => this.tools.setTool('grab'));
            this.commands.register('edit.undo', 'Undo Last Action', () => window.hostdraw.undo());
            this.commands.register('file.save', 'Save as PDF', () => this.saveAsPDF());
            this.commands.register('file.load', 'Load Drawing', () => this.showLoadPopup());
            this.commands.register('file.add-color', 'Add Custom Color', () => this.openColorPicker());
            this.commands.register('color.delete', 'Delete Custom Color', () => this.showDeleteColorPopup());
            this.commands.register('image.insert', 'Insert Image', () => this.openImagePicker());

            this.registerConfigCommands();

            this.commands.register('theme.toggle', 'Toggle Light/Dark Theme', () => {
                if (this.ui && this.ui.toolbar) {
                    this.ui.toolbar.toggleTheme();
                }
            });

            const bindings = this.config.get('keybindings');
            if (bindings) {
                for (const [key, commandId] of Object.entries(bindings)) {
                    this.commands.bind(key, commandId);
                }
            }

            // Reset to the default color state: theme Ink (palette swatch 1),
            // so the pencil matches the active palette color from the start
            this.commands.execute('set.color.1');
            this.tools.syncStyle();

            this.ui.init();

            window.addEventListener('keydown', (e) => this.commands.handleKey(e));

            // Right Click: toggle stroke OR eraser size
            this.eraserSizeIndex = 0;
            // The eraser tool applies a 4× multiplier, yielding 36, 80 and
            // 192px erasing circles: 50%, 100% and 200% larger respectively.
            const eraserSizes = [9, 20, 48];
            window.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const toolName = this.tools.currentTool ? this.tools.currentTool.name : '';

                if (toolName === 'eraser') {
                    this.eraserSizeIndex = (this.eraserSizeIndex + 1) % eraserSizes.length;
                    const size = eraserSizes[this.eraserSizeIndex];
                    this.tools.style.strokeWidth = size;
                } else {
                    const current = this.tools.style.strokeWidth;
                    const next = current > 3 ? 2 : 4;
                    this.tools.style.strokeWidth = next;
                }
                this.tools.syncStyle();
                this.tools.updateCursor();
                if (this.ui && this.ui.hud) this.ui.hud.render();
            });

            // Ctrl+V paste — images from clipboard
            window.addEventListener('paste', (e) => this.handlePaste(e));

            if (pendingDrawing) await this.loadDrawing(pendingDrawing);

            console.log("Host-Draw initialized.");
        } catch (e) {
            console.error("Initialization Failed:", e);
            alert(`App Init Failed: ${e.message}\n${e.stack}`);
        }
    }

    // ========== COLOR PICKER ==========
    openColorPicker() {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = '#ff0000';
        input.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;';
        document.body.appendChild(input);

        input.addEventListener('change', async () => {
            const hex = input.value;
            input.remove();
            await this.addCustomColor(hex);
        });

        // Also handle if user cancels (blur without change)
        input.addEventListener('blur', () => {
            setTimeout(() => input.remove(), 200);
        });

        input.click();
    }

    // ========== IMAGE INSERT ==========
    handlePaste(e) {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) this.insertImageFromFile(file);
                return;
            }
        }
    }

    openImagePicker() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;';
        document.body.appendChild(input);

        input.addEventListener('change', () => {
            const file = input.files[0];
            if (file) this.insertImageFromFile(file);
            input.remove();
        });

        input.addEventListener('blur', () => {
            setTimeout(() => input.remove(), 500);
        });

        input.click();
    }

    insertImageFromFile(file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                // Cap image to max 800px so it doesn't overwhelm the canvas
                const MAX = 800;
                let w = img.width, h = img.height;
                if (w > MAX || h > MAX) {
                    const ratio = Math.min(MAX / w, MAX / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }

                // Place at center of current viewport
                const [cx, cy] = window.hostdraw.centerWorld();

                window.hostdraw.addImage(evt.target.result, cx - w / 2, cy - h / 2, w, h);
                this.showPopup('Image added');
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }

    async addCustomColor(hex) {
        const themeColors = this.config.get('presets.themeColors');
        if (!themeColors) return;

        // Add the same hex to both light and dark themes
        const colorName = 'Custom';
        themeColors.light.push({ name: colorName, hex });
        themeColors.dark.push({ name: colorName, hex });

        const newIndex = themeColors.light.length; // 1-based
        const cmdId = `set.color.${newIndex}`;

        // Register new command if not already registered
        if (!this.commands.commands[cmdId]) {
            this.commands.register(cmdId, `Set Color ${newIndex}`, () => {
                const bg = this.config.settings.theme.background;
                const isDark = bg.startsWith('#1') || bg.startsWith('#2') || bg === '#000000';
                const colors = isDark ? themeColors.dark : themeColors.light;
                const colorObj = colors[newIndex - 1];
                if (colorObj) {
                    this.tools.style.strokeColor = colorObj.hex;
                    this.tools.updateCursor();
                    if (this.ui.palette) this.ui.palette.render();
                }
            });
        }

        // Register keybinding only for single-digit keys (up to 9)
        if (newIndex <= 9) {
            const key = String(newIndex);
            this.config.settings.keybindings[key] = cmdId;
            this.commands.bind(key, cmdId);
        }

        // Re-render palette & HUD
        if (this.ui.palette) this.ui.palette.render();
        if (this.ui.hud) this.ui.hud.render();

        // Select the new color immediately
        this.tools.style.strokeColor = hex;
        this.tools.updateCursor();

        // Persist to server
        const saved = await this.saveConfigToServer();
        if (saved) {
            this.showPopup(`Color added: ${hex}`);
        } else {
            this.showPopup(`Color added (not saved to disk)`);
        }
    }

    async saveConfigToServer() {
        try {
            const resp = await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: this.config.settings })
            });
            return resp.ok;
        } catch (e) {
            console.error('Config save error:', e);
            return false;
        }
    }

    showDeleteColorPopup() {
        const BUILTIN_COUNT = 6;
        const themeColors = this.config.get('presets.themeColors');
        const isDark = this.ui.toolbar.isDark;
        const allColors = isDark ? themeColors.dark : themeColors.light;
        const customColors = allColors.slice(BUILTIN_COUNT).map((c, i) => ({
            ...c, index: BUILTIN_COUNT + i
        }));

        // Build overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            display: flex; align-items: center; justify-content: center; z-index: 9999;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            background: var(--panel-bg); border: 1px solid var(--panel-border);
            border-radius: 8px; padding: 16px; min-width: 220px; max-width: 300px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 8px;
        `;

        const title = document.createElement('div');
        title.textContent = 'Delete Custom Color';
        title.style.cssText = 'font-weight:bold; font-size:13px; color:var(--fg-color); margin-bottom:4px;';
        panel.appendChild(title);

        const hint = document.createElement('div');
        hint.textContent = '↑↓ Navigate • Enter Delete • Esc Close';
        hint.style.cssText = 'font-size:10px; color:var(--fg-color); opacity:0.6;';
        panel.appendChild(hint);

        if (customColors.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No custom colors to delete.';
            empty.style.cssText = 'font-size: 12px; color: var(--fg-color); opacity: 0.6; padding: 8px 0;';
            panel.appendChild(empty);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            const closeEmpty = (e) => {
                overlay.remove();
                window.removeEventListener('keydown', closeEmpty, true);
            };
            window.addEventListener('keydown', closeEmpty, true);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeEmpty(e); });
            return;
        }

        let selectedIndex = 0;
        const list = document.createElement('div');
        list.style.cssText = 'display:flex; flex-direction:column; gap:2px; overflow-y:auto; max-height:260px;';

        const items = customColors.map((c, i) => {
            const item = document.createElement('div');
            item.style.cssText = `
                display:flex; align-items:center; gap:8px; padding:7px 10px;
                border-radius:4px; cursor:pointer; transition:background 0.1s;
            `;

            const dot = document.createElement('div');
            dot.style.cssText = `width:16px;height:16px;border-radius:50%;background:${c.hex};flex-shrink:0;border:1px solid rgba(128,128,128,0.3);`;

            const name = document.createElement('span');
            name.textContent = c.name === 'Custom' ? c.hex : c.name;
            name.style.cssText = 'font-size:12px;color:var(--fg-color);flex:1;';

            const badge = document.createElement('span');
            badge.textContent = c.index + 1 <= 9 ? `key ${c.index + 1}` : 'click only';
            badge.style.cssText = 'font-size:10px;opacity:0.4;color:var(--fg-color);';

            item.appendChild(dot);
            item.appendChild(name);
            item.appendChild(badge);

            item.addEventListener('click', () => {
                overlay.remove();
                window.removeEventListener('keydown', handleKey, true);
                this.deleteCustomColor(c.index);
            });
            item.addEventListener('mouseenter', () => {
                selectedIndex = i;
                updateSelection();
            });

            list.appendChild(item);
            return item;
        });

        const updateSelection = () => {
            items.forEach((item, i) => {
                if (i === selectedIndex) {
                    item.style.background = '#e06c75';
                    item.querySelectorAll('span, div').forEach(el => {
                        if (el.tagName === 'SPAN') el.style.color = '#fff';
                    });
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.style.background = 'transparent';
                    item.querySelectorAll('span').forEach(el => el.style.color = 'var(--fg-color)');
                }
            });
        };
        updateSelection();

        panel.appendChild(list);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        const handleKey = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                window.removeEventListener('keydown', handleKey, true);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelection();
            } else if (e.key === 'Enter') {
                overlay.remove();
                window.removeEventListener('keydown', handleKey, true);
                this.deleteCustomColor(customColors[selectedIndex].index);
            }
            e.stopPropagation();
        };
        window.addEventListener('keydown', handleKey, true);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                window.removeEventListener('keydown', handleKey, true);
            }
        });
    }

    async deleteCustomColor(index) {
        const BUILTIN_COUNT = 6;
        if (!Number.isInteger(index) || index < BUILTIN_COUNT) return;

        const themeColors = this.config.get('presets.themeColors');
        if (!themeColors) return;
        if (index >= Math.min(themeColors.light.length, themeColors.dark.length)) return;

        themeColors.light.splice(index, 1);
        themeColors.dark.splice(index, 1);

        // Rebuild the custom-color number shortcuts because colors after the
        // removed entry shift down by one position.
        for (let colorNumber = BUILTIN_COUNT + 1; colorNumber <= 9; colorNumber++) {
            const key = String(colorNumber);
            const commandId = `set.color.${colorNumber}`;
            delete this.config.settings.keybindings[key];
            delete this.commands.keybindings[key];

            if (colorNumber <= themeColors.light.length) {
                this.config.settings.keybindings[key] = commandId;
                this.commands.bind(key, commandId);
            }
        }

        const isDark = this.ui.toolbar.isDark;
        const firstColor = (isDark ? themeColors.dark : themeColors.light)[0];
        if (firstColor) {
            this.tools.style.strokeColor = firstColor.hex;
            this.tools.updateCursor();
        }

        if (this.ui.palette) this.ui.palette.render();
        if (this.ui.hud) this.ui.hud.render();

        await this.saveConfigToServer();
        this.showPopup('Color removed');
    }

    // ========== SAVE ==========
    async saveAsPDF() {
        try {
            const b = window.hostdraw.bounds();
            if (!b) {
                this.showPopup('Nothing to save!');
                return;
            }

            // Bounding box
            let [minX, minY, maxX, maxY] = b;
            const pad = 40;
            minX -= pad; minY -= pad; maxX += pad; maxY += pad;
            const w = maxX - minX;
            const h = maxY - minY;

            // Render the region in the WASM core (eraser applied, like on screen)
            const scale = 2;
            const pixels = window.hostdraw.exportRegion(minX, minY, w, h, scale);
            if (typeof pixels === 'string') throw new Error(pixels);

            const devW = Math.floor(w * scale);
            const devH = Math.floor(h * scale);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = devW;
            tempCanvas.height = devH;
            const ctx = tempCanvas.getContext('2d');
            ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), devW, devH), 0, 0);

            const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);

            const { jsPDF } = window.jspdf;
            const orientation = w > h ? 'landscape' : 'portrait';
            const pdf = new jsPDF({ orientation, unit: 'px', format: [w, h] });
            pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
            const pdfBase64 = pdf.output('datauristring');

            const now = new Date();
            const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const pdfFilename = `drawing-${ts}.pdf`;
            const jsonFilename = `drawing-${ts}.json`;

            // Save PDF
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: pdfFilename, content: pdfBase64 })
            });

            // Save shapes as JSON using raw_json (no base64 needed)
            const jsonResp = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: jsonFilename, raw_json: JSON.parse(window.hostdraw.exportShapes()) })
            });

            if (jsonResp.ok) {
                this.showPopup(`Saved on data/${pdfFilename}`);
            } else {
                this.showPopup('Save failed!');
            }
        } catch (e) {
            console.error('PDF export error:', e);
            this.showPopup(`Error: ${e.message}`);
        }
    }

    // ========== LOAD ==========
    async showLoadPopup() {
        // Close existing popup
        const existing = document.getElementById('load-popup');
        if (existing) {
            if (typeof existing.closeLoadPopup === 'function') existing.closeLoadPopup();
            else existing.remove();
            return;
        }

        try {
            const resp = await fetch('/api/list');
            const data = await resp.json();
            const files = data.files || [];

            if (files.length === 0) {
                this.showPopup('No saved drawings found!');
                return;
            }

            // Create popup overlay
            const overlay = document.createElement('div');
            overlay.id = 'load-popup';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 200;
                display: flex; align-items: center; justify-content: center;
                pointer-events: auto;
            `;

            const panel = document.createElement('div');
            panel.style.cssText = `
                background: var(--panel-bg); border: 1px solid var(--panel-border);
                border-radius: 8px; padding: 16px; min-width: 350px; max-width: 500px;
                max-height: 400px; display: flex; flex-direction: column;
                font-family: var(--font-mono, monospace);
            `;

            const title = document.createElement('div');
            title.textContent = '📂 Load Drawing';
            title.style.cssText = `
                font-size: 16px; font-weight: bold; color: var(--accent-color);
                margin-bottom: 12px;
            `;
            panel.appendChild(title);

            const hint = document.createElement('div');
            hint.textContent = '↑↓ Navigate • Enter Select • Esc Close';
            hint.style.cssText = `
                font-size: 10px; color: var(--fg-color); opacity: 0.6;
                margin-bottom: 8px;
            `;
            panel.appendChild(hint);

            const list = document.createElement('div');
            list.style.cssText = `
                overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 2px;
            `;

            let selectedIndex = 0;

            const returnToCanvas = () => {
                const canvas = this.canvas?.canvas;
                if (!canvas) return;
                canvas.tabIndex = -1;
                requestAnimationFrame(() => canvas.focus({ preventScroll: true }));
            };

            let handleKey;
            const closePopup = () => {
                overlay.remove();
                window.removeEventListener('keydown', handleKey, true);
                returnToCanvas();
            };
            overlay.closeLoadPopup = closePopup;

            const selectDrawing = (filename) => {
                closePopup();
                // A fresh page creates a new WASM instance, returning its
                // non-shrinkable linear memory to the baseline allocation.
                sessionStorage.setItem('hostdraw_pending_drawing', filename);
                window.location.reload();
            };

            const items = files.map((file, index) => {
                const item = document.createElement('div');
                const displayName = file.filename.replace('.json', '');
                const date = new Date(file.modified * 1000);
                const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

                item.innerHTML = `
                    <span style="color: var(--fg-color); font-size: 13px;">${displayName}</span>
                    <span style="color: var(--fg-color); opacity: 0.5; font-size: 10px; margin-left: auto;">${dateStr}</span>
                `;
                item.style.cssText = `
                    padding: 8px 12px; border-radius: 4px; cursor: pointer;
                    display: flex; align-items: center; gap: 8px;
                    transition: background 0.1s;
                `;

                item.addEventListener('click', () => {
                    selectDrawing(file.filename);
                });

                item.addEventListener('mouseenter', () => {
                    selectedIndex = index;
                    updateSelection();
                });

                list.appendChild(item);
                return item;
            });

            const updateSelection = () => {
                items.forEach((item, i) => {
                    if (i === selectedIndex) {
                        item.style.background = 'var(--accent-color)';
                        item.querySelector('span').style.color = '#282828';
                        item.scrollIntoView({ block: 'nearest' });
                    } else {
                        item.style.background = 'transparent';
                        item.querySelector('span').style.color = 'var(--fg-color)';
                    }
                });
            };

            updateSelection();

            panel.appendChild(list);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            // Keyboard navigation
            handleKey = (e) => {
                if (e.key === 'Escape') {
                    closePopup();
                    e.stopPropagation();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                    updateSelection();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, 0);
                    updateSelection();
                } else if (e.key === 'Enter') {
                    selectDrawing(files[selectedIndex].filename);
                }
                e.stopPropagation();
            };

            window.addEventListener('keydown', handleKey, true);

            // Close on overlay click (not panel)
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closePopup();
                }
            });

        } catch (e) {
            console.error('Load error:', e);
            this.showPopup(`Load error: ${e.message}`);
        }
    }

    async loadDrawing(filename) {
        try {
            const resp = await fetch(`/api/load?file=${encodeURIComponent(filename)}`);
            if (!resp.ok) {
                throw new Error(`Server error: ${resp.status} ${resp.statusText}`);
            }
            const shapes = await resp.json();

            const err = window.hostdraw.importShapes(JSON.stringify(shapes));
            if (err) throw new Error(err);
            this.ui?.memoryMeter?.reset();

            const displayName = filename.replace('.json', '');
            this.showPopup(`Loaded: ${displayName}`);
        } catch (e) {
            console.error('Load error:', e);
            this.showPopup(`Load error: ${e.message}`);
        }
    }

    // ========== POPUP ==========
    showPopup(message) {
        const old = document.getElementById('save-popup');
        if (old) old.remove();

        const popup = document.createElement('div');
        popup.id = 'save-popup';
        popup.textContent = message;
        popup.style.cssText = `
            position: fixed; bottom: 50px; left: 50%; transform: translateX(-50%);
            background: var(--accent-color); color: #282828;
            padding: 12px 24px; border-radius: 8px;
            font-family: var(--font-mono, monospace); font-size: 14px; font-weight: bold;
            z-index: 100; pointer-events: none; opacity: 1; transition: opacity 0.5s ease;
        `;
        document.body.appendChild(popup);
        setTimeout(() => {
            popup.style.opacity = '0';
            setTimeout(() => popup.remove(), 500);
        }, 3000);
    }

    // ========== THEME ==========
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

    remapShapeColors(fromTheme, toTheme) {
        const mapping = this.getColorMapping(fromTheme, toTheme);
        window.hostdraw.remapColors(JSON.stringify(mapping));
    }

    // Persist the scene (exported by the WASM core) to the browser cache
    persistShapes(json) {
        try {
            localStorage.setItem('hostdraw_shapes', json);
        } catch (e) {
            // localStorage full (likely large images) — silently fail
            console.warn('Failed to save to cache (storage full?):', e);
        }
    }

    registerConfigCommands() {
        const themeColors = this.config.get('presets.themeColors');
        const getColors = () => {
            const bg = this.config.settings.theme.background;
            const isDark = bg.startsWith('#1') || bg.startsWith('#2') || bg === '#000000';
            return isDark ? themeColors.dark : themeColors.light;
        };

        if (themeColors) {
            const total = Math.max(themeColors.light.length, themeColors.dark.length);
            for (let i = 1; i <= total; i++) {
                const idx = i; // capture for closure
                this.commands.register(`set.color.${idx}`, `Set Color ${idx}`, () => {
                    const colors = getColors();
                    const colorObj = colors[idx - 1];
                    if (colorObj) {
                        this.tools.style.strokeColor = colorObj.hex;
                        this.tools.updateCursor();
                        if (this.ui.palette) this.ui.palette.render();
                    }
                });
            }
        }

        const widths = this.config.get('presets.strokeWidths');
        if (widths) {
            for (const [name, value] of Object.entries(widths)) {
                this.commands.register(`set.stroke.${name}`, `Set Stroke ${name}`, () => {
                    this.tools.style.strokeWidth = value;
                });
            }
        }

        const bgs = this.config.get('presets.backgrounds');
        if (bgs) {
            for (const [name, theme] of Object.entries(bgs)) {
                this.commands.register(`set.theme.${name}`, `Set Theme ${name}`, () => {
                    const prevBg = this.config.settings.theme.background;
                    const wasDark = prevBg.startsWith('#1') || prevBg.startsWith('#2') || prevBg === '#000000';
                    const prevTheme = wasDark ? 'dark' : 'light';

                    this.config.settings.theme.background = theme.background;
                    this.config.settings.theme.gridColor = theme.grid;
                    this.config.settings.theme.gridBoldColor = theme.gridBold;

                    this.applyThemeFromConfig();
                    window.hostdraw.setTheme(JSON.stringify(this.config.settings.theme));
                    this.remapShapeColors(prevTheme, name);
                    this.commands.execute('set.color.1');

                    if (this.ui.toolbar) {
                        this.ui.toolbar.isDark = (name === 'dark');
                        this.ui.toolbar.render();
                    }
                    if (this.ui.palette) this.ui.palette.render();
                    if (this.ui.hud) this.ui.hud.render();
                });
            }
        }
    }
}

const app = new App();
window.app = app;
app.init();
