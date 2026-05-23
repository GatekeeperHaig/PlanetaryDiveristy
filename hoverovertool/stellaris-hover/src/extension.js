const vscode = require('vscode');
const { Loader } = require('./loader');
const { StellarisHoverProvider } = require('./hoverProvider');
const { Decorator } = require('./decorator');

function collectWorkspaceFolders() {
    const folders = vscode.workspace.workspaceFolders || [];
    return folders.map(f => f.uri.fsPath);
}

async function activate(context) {
    const output = vscode.window.createOutputChannel('Stellaris Hover');
    context.subscriptions.push(output);

    const buildLoader = () => {
        const config = vscode.workspace.getConfiguration('stellarisHover');
        return new Loader({
            workspaceFolders: collectWorkspaceFolders(),
            vanillaPath: config.get('vanillaPath') || '',
            includeVanilla: config.get('includeVanilla'),
            modRoots: config.get('modRoots') || [],
            preferredLanguage: config.get('preferredLanguage') || 'english',
            scanScriptReverse: config.get('scanScriptReverse'),
            output
        });
    };

    let loader = buildLoader();

    const provider = new StellarisHoverProvider(loader);
    const selectors = [
        { language: 'stellaris' },
        { language: 'paradox' },
        { language: 'paradox-yaml' },
        { language: 'yaml' },
        { language: 'plaintext' },
        { pattern: '**/common/**/*.txt' },
        { pattern: '**/events/**/*.txt' },
        { pattern: '**/localisation/**/*.yml' },
        { pattern: '**/interface/**/*.gfx' },
        { pattern: '**/prescripted_countries/**/*.txt' }
    ];
    context.subscriptions.push(vscode.languages.registerHoverProvider(selectors, provider));

    const decorator = new Decorator(loader, output);
    context.subscriptions.push({ dispose: () => decorator.dispose() });

    const applyConfigToDecorator = () => {
        const config = vscode.workspace.getConfiguration('stellarisHover');
        decorator.setStyle(config.get('underlineStyle') || 'underline');
        decorator.setEnabled(config.get('underlineHoverable') !== false);
    };
    applyConfigToDecorator();

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) decorator.scheduleUpdate(editor);
    }));
    context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors((editors) => {
        for (const e of editors) decorator.scheduleUpdate(e);
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document === e.document) decorator.scheduleUpdate(editor);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('stellarisHover.openFileAt', async (args) => {
        const { file, line } = args || {};
        if (!file) return;
        try {
            const doc = await vscode.workspace.openTextDocument(file);
            const editor = await vscode.window.showTextDocument(doc);
            const lineIdx = Math.max(0, (line || 1) - 1);
            const pos = new vscode.Position(lineIdx, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        } catch (e) {
            vscode.window.showErrorMessage(`Stellaris Hover: could not open ${file}: ${e.message}`);
        }
    }));

    const reload = async () => {
        output.appendLine('[stellaris-hover] Reloading index...');
        loader = buildLoader();
        provider.loader = loader;
        decorator.setLoader(loader);
        await loader.load();
        decorator.refreshAll();
    };

    context.subscriptions.push(vscode.commands.registerCommand('stellarisHover.reload', reload));

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (!e.affectsConfiguration('stellarisHover')) return;
        if (e.affectsConfiguration('stellarisHover.underlineHoverable')
            || e.affectsConfiguration('stellarisHover.underlineStyle')) {
            applyConfigToDecorator();
        }
        if (e.affectsConfiguration('stellarisHover.vanillaPath')
            || e.affectsConfiguration('stellarisHover.includeVanilla')
            || e.affectsConfiguration('stellarisHover.modRoots')
            || e.affectsConfiguration('stellarisHover.preferredLanguage')
            || e.affectsConfiguration('stellarisHover.scanScriptReverse')) {
            await reload();
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(reload));

    await loader.load();
    decorator.refreshAll();
}

function deactivate() {}

module.exports = { activate, deactivate };
