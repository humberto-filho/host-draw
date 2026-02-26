export class Toolbar {
    constructor(app) {
        this.app = app;
        this.container = document.getElementById('toolbar');
        this.isDark = false;
    }

    init() {
        try {
            console.log("Toolbar initializing...");
            this.render();
        } catch (e) {
            console.error("Toolbar init failed:", e);
            alert("Toolbar Error: " + e.message);
        }
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = '';

        // LEFT: Theme + Load + Save (side by side)
        const themeBtn = document.createElement('button');
        themeBtn.textContent = this.isDark ? '🌙' : '☀️';
        themeBtn.title = this.isDark ? 'Switch to Light (x)' : 'Switch to Dark (x)';
        themeBtn.style.fontSize = '16px';
        themeBtn.onclick = () => this.toggleTheme();
        this.container.appendChild(themeBtn);

        const loadBtn = document.createElement('button');
        loadBtn.textContent = '📂';
        loadBtn.title = 'Load Drawing (o)';
        loadBtn.style.fontSize = '16px';
        loadBtn.onclick = () => {
            if (this.app.commands) this.app.commands.execute('file.load');
        };
        this.container.appendChild(loadBtn);

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾';
        saveBtn.title = 'Save as PDF (s)';
        saveBtn.style.fontSize = '16px';
        saveBtn.onclick = () => {
            if (this.app.commands) this.app.commands.execute('file.save');
        };
        this.container.appendChild(saveBtn);

        // Separator
        const sep = document.createElement('div');
        sep.style.cssText = 'width: 1px; height: 20px; background: var(--panel-border); margin: 0 4px;';
        this.container.appendChild(sep);

        // TOOLS
        this.createToolBtn('pencil', 'Pencil (p)');
        this.createToolBtn('line', 'Line (l)');
        this.createToolBtn('eraser', 'Eraser (e)');
        this.createToolBtn('rectangle', 'Rectangle (r)');
        this.createToolBtn('circle', 'Circle (c)');
        this.createToolBtn('grab', 'Grab (g)');

        // Separator
        const sep2 = document.createElement('div');
        sep2.style.cssText = 'width: 1px; height: 20px; background: var(--panel-border); margin: 0 4px;';
        this.container.appendChild(sep2);

        // Insert Image button
        const imgBtn = document.createElement('button');
        imgBtn.textContent = 'Image (+)';
        imgBtn.className = 'tool-btn';
        imgBtn.title = 'Insert Image (Ctrl+V to paste)';
        imgBtn.onclick = () => {
            if (this.app.commands) this.app.commands.execute('image.insert');
        };
        this.container.appendChild(imgBtn);
    }

    toggleTheme() {
        this.isDark = !this.isDark;
        const themeName = this.isDark ? 'dark' : 'light';
        if (this.app.commands) {
            this.app.commands.execute(`set.theme.${themeName}`);
        }
    }

    createToolBtn(id, label) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = 'tool-btn';
        const isActive = this.app.tools && this.app.tools.currentTool && this.app.tools.currentTool.name === id;

        if (isActive) {
            btn.style.background = 'var(--accent-color)';
            btn.style.color = '#282828';
        }
        btn.onclick = () => {
            if (this.app.tools) {
                this.app.tools.setTool(id);
                this.render();
            }
        };
        this.container.appendChild(btn);
    }
}
