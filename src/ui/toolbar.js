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

        this.createToolBtn('pencil', 'Pencil (p)');
        this.createToolBtn('line', 'Line (l)');
        this.createToolBtn('eraser', 'Eraser (e)');

        // Theme toggle emoji button
        const themeBtn = document.createElement('button');
        themeBtn.textContent = this.isDark ? '🌙' : '☀️';
        themeBtn.title = this.isDark ? 'Switch to Light (x)' : 'Switch to Dark (x)';
        themeBtn.style.fontSize = '16px';
        themeBtn.onclick = () => this.toggleTheme();
        this.container.appendChild(themeBtn);

        this.createToolBtn('rectangle', 'Rectangle (r)');
        this.createToolBtn('circle', 'Circle (c)');
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
