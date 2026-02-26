export class HUD {
    constructor(app) {
        this.app = app;
        this.element = null;
    }

    init() {
        this.element = document.createElement('div');
        this.element.id = 'hud';
        this.element.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: var(--panel-bg);
            color: var(--fg-color);
            border: 1px solid var(--panel-border);
            padding: 15px;
            border-radius: 8px;
            font-family: var(--font-mono, monospace);
            font-size: 12px;
            pointer-events: none;
            user-select: none;
            max-width: 200px;
        `;
        document.body.appendChild(this.element);
        this.render();
    }

    render() {
        const bindings = this.app.config.get('keybindings') || {};

        let html = '<strong>Info-bar</strong><br/><br/>';

        const groups = {
            'Tools': [],
            'Colors': [],
            'Strokes': [],
            'Theme': [],
            'Edit': [],
            'File': []
        };

        const colorNames = {
            '1': 'Ink',
            '2': 'Red',
            '3': 'Green',
            '4': 'Yellow',
            '5': 'Blue',
            '6': 'Purple'
        };

        for (const [key, cmd] of Object.entries(bindings)) {
            if (cmd.startsWith('tool.')) groups['Tools'].push(`${key}: ${cmd.split('.')[1]}`);
            else if (cmd.startsWith('set.color.')) {
                const id = cmd.split('.')[2];
                const name = colorNames[id] || id;
                groups['Colors'].push(`${key}: ${name}`);
            }
            else if (cmd.startsWith('set.stroke.')) groups['Strokes'].push(`${key}: ${cmd.split('.')[2]}`);
            else if (cmd === 'theme.toggle') {
                const isDark = this.app.ui && this.app.ui.toolbar ? this.app.ui.toolbar.isDark : false;
                const label = isDark ? 'light mode' : 'dark mode';
                groups['Theme'].push(`${key}: ${label}`);
            }
            else if (cmd.startsWith('set.theme.')) groups['Theme'].push(`${key}: ${cmd.split('.')[2]}`);
            else if (cmd.startsWith('edit.')) groups['Edit'].push(`${key}: ${cmd.split('.')[1]}`);
            else if (cmd === 'file.save') groups['File'].push(`${key}: save PDF`);
            else if (cmd === 'file.load') groups['File'].push(`${key}: open`);
            else if (cmd === 'color.delete') groups['File'].push(`${key}: delete color`);
        }

        // Static hints for paste/image
        groups['File'].push('ctrl+v: paste image');
        groups['File'].push('+: insert image');

        // Grab tool hints
        groups['Edit'].push('ctrl+c: copy (grab)');
        groups['Edit'].push('del: delete (grab)');

        // Dynamic right-click stroke indicator
        const currentWidth = this.app.tools ? this.app.tools.style.strokeWidth : 2;
        const rightClickLabel = currentWidth > 3 ? 'thin' : 'thick';
        groups['Strokes'].push(`right click: ${rightClickLabel}`);

        for (const [group, items] of Object.entries(groups)) {
            if (items.length > 0) {
                html += `<u>${group}</u><br/>`;
                items.forEach(item => html += `${item}<br/>`);
                html += '<br/>';
            }
        }

        this.element.innerHTML = html;
    }
}
