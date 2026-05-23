const vscode = require('vscode');
const tooltips = require('./tooltips');
const { NAMESPACE_PREFIX, commentStart } = require('./resolver');
const { builtinInfo } = require('./builtins');

const LOC_VARIANTS = ['_desc', '_desc_short', '_short', '_effect', '_tooltip', '_lore'];
const DOTTED_LOC_VARIANTS = ['.name', '.desc', '.title', '.flavor', '.tooltip'];
const EVENT_ID_RE = /^[A-Za-z_][\w]*\.\d+$/;
const INLINE_SCRIPT_LINE_RE = /^(\s*)(inline_script|script)\s*=\s*"?([^"\s{}#]+)"?/;
const LOCAL_VAR_DEF_RE = /^\s*@(\w+)\s*=\s*(.+?)\s*(?:#.*)?$/;

function findLocalScriptedVar(document, name, currentLine) {
    const max = document.lineCount;
    for (let i = 0; i < max; i++) {
        if (i === currentLine) continue;
        const text = document.lineAt(i).text;
        const m = text.match(LOCAL_VAR_DEF_RE);
        if (m && m[1] === name) {
            return { file: document.fileName, line: i + 1, value: m[2] };
        }
    }
    return null;
}

class StellarisHoverProvider {
    constructor(loader) { this.loader = loader; }

    provideHover(document, position) {
        const lineText = document.lineAt(position.line).text;
        const cStartFull = commentStart(lineText);

        const inlineScriptHover = this.tryInlineScriptHover(lineText, cStartFull, position);
        if (inlineScriptHover) return inlineScriptHover;

        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][\w.\-]*/);
        if (!wordRange) return null;
        const word = document.getText(wordRange);
        if (!word) return null;

        const scriptedVarHover = this.tryScriptedVariableHover(document, lineText, wordRange, word);
        if (scriptedVarHover) return scriptedVarHover;

        if (/^[A-Z][A-Z0-9_]*$/.test(word)) return null;

        const wordStart = wordRange.start.character;
        const wordEnd = wordRange.end.character;
        const cStart = cStartFull;
        if (cStart >= 0 && wordStart >= cStart) return null;
        const before = lineText.slice(0, wordStart);
        const after = lineText.slice(wordEnd);

        const inLocAssignment = /\b(title|desc|name|text|tooltip|effect|short|on_action|custom_tooltip|response_text|triggered_text|fail_text|optional_text|trigger_text|fire_only_once_for|log)\s*=\s*"$/.test(before)
            && after.startsWith('"');

        const fileName = document.fileName.toLowerCase();
        const isLocFile = fileName.endsWith('.yml') && /[\\/]localisation[\\/]/.test(fileName);
        if (isLocFile) return this.provideLocFileHover(word, wordRange);

        const collected = {
            word,
            entity: null,
            event: null,
            gfx: null,
            gfxConvention: false,
            locTitle: null,
            locDescVariants: []
        };
        const seenLocKeys = new Set();

        const pickEntity = (key) => {
            if (collected.entity) return;
            const entry = this.loader.entityDict.get(key);
            if (entry) collected.entity = Object.assign({ name: key }, entry);
        };
        const pickEvent = (key) => {
            if (collected.event) return;
            const entry = this.loader.eventDict.get(key);
            if (entry) collected.event = Object.assign({ id: key }, entry);
        };
        const pickGfx = (key) => {
            if (collected.gfx || collected.gfxConvention) return;
            const entry = this.loader.gfxDict.get(key);
            if (entry) { collected.gfx = Object.assign({ name: key }, entry); return; }
            if (key.startsWith('GFX_species_selected_background_')) collected.gfxConvention = true;
        };
        const pickLocTitle = (key) => {
            if (collected.locTitle || seenLocKeys.has(key)) return;
            const entry = this.loader.getLoc(key);
            if (entry) { collected.locTitle = { key, entry }; seenLocKeys.add(key); }
        };
        const pickLocDesc = (key) => {
            if (seenLocKeys.has(key)) return;
            const entry = this.loader.getLoc(key);
            if (entry) { collected.locDescVariants.push({ key, entry }); seenLocKeys.add(key); }
        };

        const nsMatch = before.match(/\[(\w+)\s*:\s*$/);
        if (nsMatch) {
            const prefix = NAMESPACE_PREFIX[nsMatch[1].toLowerCase()];
            if (prefix !== undefined) {
                pickEntity(prefix + word);
                pickEntity(word);
                pickLocTitle(prefix + word);
            }
        }

        if (word.startsWith('GFX_')) pickGfx(word);
        pickEntity(word);
        pickEvent(word);
        pickLocTitle(word);
        for (const sfx of LOC_VARIANTS) pickLocDesc(word + sfx);
        if (EVENT_ID_RE.test(word)) {
            for (const sfx of DOTTED_LOC_VARIANTS) {
                if (sfx === '.name' || sfx === '.title') {
                    if (!collected.locTitle) {
                        const entry = this.loader.getLoc(word + sfx);
                        if (entry && !seenLocKeys.has(word + sfx)) {
                            collected.locTitle = { key: word + sfx, entry };
                            seenLocKeys.add(word + sfx);
                            continue;
                        }
                    }
                }
                pickLocDesc(word + sfx);
            }
        }

        const dottedMatch = word.match(/^(.+)\.(name|title|desc|flavor|tooltip|short)$/);
        if (dottedMatch && !inLocAssignment) {
            const base = dottedMatch[1];
            for (const sfx of DOTTED_LOC_VARIANTS) {
                pickLocDesc(base + sfx);
            }
        }

        const builtin = builtinInfo(word);
        const hasAnything = collected.entity || collected.event || collected.gfx || collected.gfxConvention
            || collected.locTitle || collected.locDescVariants.length;

        if (!hasAnything && builtin) {
            return new vscode.Hover([tooltips.builtinTooltip(builtin)], wordRange);
        }
        if (!hasAnything) return null;

        const md = tooltips.compositeTooltip(collected, this.loader);
        if (builtin) {
            return new vscode.Hover([md, tooltips.builtinTooltip(builtin)], wordRange);
        }
        return new vscode.Hover([md], wordRange);
    }

    tryScriptedVariableHover(document, lineText, wordRange, word) {
        const wordStart = wordRange.start.character;
        if (wordStart === 0 || lineText.charAt(wordStart - 1) !== '@') return null;
        const localEntry = findLocalScriptedVar(document, word, wordRange.start.line);
        const globalEntry = this.loader.scriptedVariableDict && this.loader.scriptedVariableDict.get(word);
        if (!localEntry && !globalEntry) return null;
        const range = new vscode.Range(wordRange.start.line, wordStart - 1, wordRange.end.line, wordRange.end.character);
        return new vscode.Hover([tooltips.scriptedVariableTooltip(word, localEntry, globalEntry, document.fileName)], range);
    }

    tryInlineScriptHover(lineText, commentStartIdx, position) {
        const scanText = commentStartIdx >= 0 ? lineText.slice(0, commentStartIdx) : lineText;
        const m = scanText.match(INLINE_SCRIPT_LINE_RE);
        if (!m) return null;
        const pathStr = m[3];
        const pathStart = m[0].lastIndexOf(pathStr);
        const pathEnd = pathStart + pathStr.length;
        if (position.character < pathStart || position.character > pathEnd) return null;
        const entry = this.loader.inlineScriptDict && this.loader.inlineScriptDict.get(pathStr.toLowerCase());
        if (!entry) return null;
        const range = new vscode.Range(position.line, pathStart, position.line, pathEnd);
        return new vscode.Hover([tooltips.inlineScriptTooltip(pathStr, entry)], range);
    }

    provideLocFileHover(word, range) {
        const refs = this.loader.reverseLocDict.get(word);
        if (refs && refs.length) {
            const maxRefs = vscode.workspace.getConfiguration('stellarisHover').get('maxReverseRefs') || 25;
            return new vscode.Hover(tooltips.reverseLocTooltip(refs, maxRefs), range);
        }
        if (this.loader.getLoc(word)) {
            const md = new vscode.MarkdownString('_No script references found._');
            return new vscode.Hover(md, range);
        }
        return null;
    }
}

module.exports = { StellarisHoverProvider };
