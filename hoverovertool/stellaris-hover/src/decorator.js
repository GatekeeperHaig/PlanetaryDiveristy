const vscode = require('vscode');
const { resolveHover, commentStart } = require('./resolver');

const TOKEN_RE = /[A-Za-z_][\w.\-]*/g;
const INLINE_SCRIPT_LINE_RE = /^(\s*)(inline_script|script)\s*=\s*"?([^"\s{}#]+)"?/;
const SCRIPTED_VAR_REF_RE = /@(\w+)/g;
const LOCAL_VAR_DEF_RE_DEC = /^\s*@(\w+)\s*=/;
const DEBOUNCE_MS = 200;
const MAX_LINES = 5000;

class Decorator {
    constructor(loader, output) {
        this.loader = loader;
        this.output = output;
        this.enabled = true;
        this.style = 'underline';
        this.decorationType = null;
        this.timers = new Map();
        this.rebuildDecorationType();
    }

    rebuildDecorationType() {
        if (this.decorationType) {
            this.decorationType.dispose();
            this.decorationType = null;
        }
        const css = this.style === 'underline-dotted' ? 'underline dotted'
            : this.style === 'underline-dashed' ? 'underline dashed'
            : 'underline';
        this.decorationType = vscode.window.createTextEditorDecorationType({
            textDecoration: `${css}`,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            for (const editor of vscode.window.visibleTextEditors) {
                editor.setDecorations(this.decorationType, []);
            }
        } else {
            this.refreshAll();
        }
    }

    setStyle(style) {
        if (style === this.style) return;
        this.style = style;
        this.rebuildDecorationType();
        this.refreshAll();
    }

    setLoader(loader) {
        this.loader = loader;
        this.refreshAll();
    }

    refreshAll() {
        if (!this.enabled) return;
        for (const editor of vscode.window.visibleTextEditors) {
            this.scheduleUpdate(editor);
        }
    }

    isApplicable(document) {
        const fn = document.fileName.toLowerCase();
        if (fn.endsWith('.txt') || fn.endsWith('.gfx') || fn.endsWith('.gui')) return true;
        return false;
    }

    scheduleUpdate(editor) {
        if (!editor || !this.enabled) return;
        if (!this.isApplicable(editor.document)) {
            editor.setDecorations(this.decorationType, []);
            return;
        }
        const uri = editor.document.uri.toString();
        const existing = this.timers.get(uri);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
            this.timers.delete(uri);
            this.update(editor);
        }, DEBOUNCE_MS);
        this.timers.set(uri, t);
    }

    update(editor) {
        if (!editor || !this.enabled) return;
        const doc = editor.document;
        if (!this.isApplicable(doc)) return;
        const ranges = this.computeRanges(doc);
        editor.setDecorations(this.decorationType, ranges);
    }

    computeRanges(doc) {
        const ranges = [];
        const lineCount = Math.min(doc.lineCount, MAX_LINES);

        const localVars = new Set();
        for (let i = 0; i < lineCount; i++) {
            const m = doc.lineAt(i).text.match(LOCAL_VAR_DEF_RE_DEC);
            if (m) localVars.add(m[1]);
        }

        for (let i = 0; i < lineCount; i++) {
            const text = doc.lineAt(i).text;
            if (!text) continue;
            const cStart = commentStart(text);
            const scanText = cStart >= 0 ? text.slice(0, cStart) : text;
            if (!scanText) continue;
            TOKEN_RE.lastIndex = 0;
            let m;
            while ((m = TOKEN_RE.exec(scanText)) !== null) {
                const start = m.index;
                const end = start + m[0].length;
                const word = m[0];
                if (!resolveHover(word, scanText, start, end, this.loader)) continue;
                ranges.push(new vscode.Range(i, start, i, end));
            }
            const isMatch = scanText.match(INLINE_SCRIPT_LINE_RE);
            if (isMatch && this.loader.inlineScriptDict) {
                const pathStr = isMatch[3];
                if (this.loader.inlineScriptDict.has(pathStr.toLowerCase())) {
                    const pathStart = isMatch[0].lastIndexOf(pathStr);
                    const pathEnd = pathStart + pathStr.length;
                    ranges.push(new vscode.Range(i, pathStart, i, pathEnd));
                }
            }
            const isLocalDef = LOCAL_VAR_DEF_RE_DEC.test(scanText);
            SCRIPTED_VAR_REF_RE.lastIndex = 0;
            let v;
            while ((v = SCRIPTED_VAR_REF_RE.exec(scanText)) !== null) {
                const name = v[1];
                const atStart = v.index;
                const refEnd = atStart + v[0].length;
                if (isLocalDef && atStart === scanText.search(/@/)) continue;
                const hasLocal = localVars.has(name);
                const hasGlobal = this.loader.scriptedVariableDict && this.loader.scriptedVariableDict.has(name);
                if (!hasLocal && !hasGlobal) continue;
                ranges.push(new vscode.Range(i, atStart, i, refEnd));
            }
        }
        return ranges;
    }

    dispose() {
        for (const t of this.timers.values()) clearTimeout(t);
        this.timers.clear();
        if (this.decorationType) this.decorationType.dispose();
    }
}

module.exports = { Decorator };
