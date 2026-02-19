export class Toolbar {
    constructor(app) {
        this.app = app;
        this.container = document.getElementById('toolbar');
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.gap = '8px';
        this.container.style.position = 'absolute';
        this.container.style.top = '10px';
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';

        const tools = ['pencil', 'rectangle', 'circle'];

        tools.forEach(toolName => {
            const btn = document.createElement('button');
            btn.textContent = toolName.charAt(0).toUpperCase() + toolName.slice(1);
            btn.style.padding = '8px 12px';
            btn.style.background = this.app.tools.currentTool?.name === toolName ? 'var(--accent-color)' : 'transparent';
            btn.style.color = this.app.tools.currentTool?.name === toolName ? '#282828' : 'var(--fg-color)';
            btn.style.border = '1px solid var(--panel-border)';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';

            btn.onclick = () => {
                this.app.tools.setTool(toolName);
                this.render(); // Re-render to update active state
            };

            this.container.appendChild(btn);
        });
    }
}
