const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_VANILLA_CANDIDATES = [
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stellaris',
    'C:\\Program Files\\Steam\\steamapps\\common\\Stellaris',
    path.join(os.homedir(), '.steam', 'steam', 'steamapps', 'common', 'Stellaris'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Steam', 'steamapps', 'common', 'Stellaris')
];

const LOC_LINE_RE = /^\s*([A-Za-z_][\w.\-]*)\s*:\s*\d*\s*"([\s\S]*?)"\s*$/;

class Loader {
    constructor({ workspaceFolders, vanillaPath, includeVanilla, modRoots, preferredLanguage, scanScriptReverse, output }) {
        this.workspaceFolders = workspaceFolders || [];
        this.vanillaPath = vanillaPath || null;
        this.includeVanilla = includeVanilla !== false;
        this.modRoots = modRoots || [];
        this.preferredLanguage = (preferredLanguage || 'english').toLowerCase();
        this.scanScriptReverse = scanScriptReverse !== false;
        this.output = output;
        this.reset();
    }

    reset() {
        this.locDict = new Map();
        this.locFallbackDict = new Map();
        this.entityDict = new Map();
        this.eventDict = new Map();
        this.gfxDict = new Map();
        this.inlineScriptDict = new Map();
        this.scriptedVariableDict = new Map();
        this.reverseLocDict = new Map();
        this.rootStats = [];
    }

    log(msg) { if (this.output) this.output.appendLine(`[stellaris-hover] ${msg}`); }

    resolveVanilla() {
        if (this.vanillaPath && fs.existsSync(this.vanillaPath)) return this.vanillaPath;
        for (const c of DEFAULT_VANILLA_CANDIDATES) {
            try { if (fs.existsSync(c) && fs.existsSync(path.join(c, 'common'))) return c; } catch {}
        }
        return null;
    }

    collectRoots() {
        const roots = [];
        if (this.includeVanilla) {
            const v = this.resolveVanilla();
            if (v) roots.push({ path: v, label: 'vanilla', isMod: false });
            else this.log('vanilla path not found; set "stellarisHover.vanillaPath" to enable vanilla indexing');
        }
        for (const f of this.workspaceFolders) {
            roots.push({ path: f, label: `workspace:${path.basename(f)}`, isMod: true });
        }
        for (const m of this.modRoots) {
            if (fs.existsSync(m)) roots.push({ path: m, label: `mod:${path.basename(m)}`, isMod: true });
        }
        return roots;
    }

    async load() {
        const t0 = Date.now();
        const roots = this.collectRoots();
        if (!roots.length) {
            this.log('no roots to index — open a Stellaris mod folder or set stellarisHover.vanillaPath');
            return;
        }

        for (const root of roots) {
            const stats = { label: root.label, files: 0, loc: 0, entities: 0, events: 0, gfx: 0 };
            const files = await this.walk(root.path);
            stats.files = files.length;

            const rootPrefix = root.path.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
            const relOf = (file) => {
                const norm = file.toLowerCase().replace(/\\/g, '/');
                if (!norm.startsWith(rootPrefix)) return null;
                const rest = norm.slice(rootPrefix.length);
                return rest.startsWith('/') ? rest : '/' + rest;
            };

            const locFiles = [];
            const commonFiles = [];
            const eventFiles = [];
            const gfxFiles = [];
            const inlineScriptFiles = [];
            const scriptedVarFiles = [];
            for (const f of files) {
                const rel = relOf(f);
                if (!rel) continue;
                const lower = f.toLowerCase();
                if (lower.endsWith('.yml') && /\/(localisation|localization)\//.test(rel)) {
                    locFiles.push(f);
                } else if (lower.endsWith('.txt')) {
                    const inlineMatch = rel.match(/\/common\/inline_scripts\/(.+)\.txt$/);
                    if (inlineMatch) {
                        inlineScriptFiles.push({ file: f, key: inlineMatch[1] });
                    } else if (rel.match(/\/common\/scripted_variables\//)) {
                        scriptedVarFiles.push(f);
                    } else {
                        const cm = rel.match(/\/common\/([^/]+)\//);
                        if (cm) commonFiles.push({ file: f, category: cm[1] });
                        else if (rel.includes('/events/')) eventFiles.push(f);
                        else if (rel.includes('/prescripted_countries/')) commonFiles.push({ file: f, category: 'prescripted_countries' });
                    }
                } else if (lower.endsWith('.gfx') && rel.includes('/interface/')) {
                    gfxFiles.push(f);
                }
            }

            stats.locFiles = locFiles.length;
            stats.eventFiles = eventFiles.length;
            stats.commonFiles = commonFiles.length;
            stats.gfxFiles = gfxFiles.length;
            stats.inlineScriptFiles = inlineScriptFiles.length;
            stats.inlineScripts = 0;
            stats.scriptedVarFiles = scriptedVarFiles.length;
            stats.scriptedVars = 0;

            for (const f of locFiles) stats.loc += await this.parseLoc(f);
            for (const c of commonFiles) stats.entities += await this.parseEntities(c.file, c.category);
            for (const f of eventFiles) stats.events += await this.parseEvents(f);
            for (const f of gfxFiles) stats.gfx += await this.parseGfx(f);
            for (const s of inlineScriptFiles) stats.inlineScripts += await this.parseInlineScript(s.file, s.key);
            for (const f of scriptedVarFiles) stats.scriptedVars += await this.parseScriptedVariables(f);

            this.rootStats.push(stats);
        }

        let reverseEntries = 0;
        if (this.scanScriptReverse) {
            for (const root of roots) {
                if (!root.isMod) continue;
                const files = await this.walk(root.path);
                for (const f of files) {
                    const lower = f.toLowerCase();
                    if (lower.endsWith('.txt') || lower.endsWith('.gui') || lower.endsWith('.gfx')) {
                        reverseEntries += await this.scanReverseLoc(f);
                    }
                }
            }
        }

        const elapsed = Date.now() - t0;
        this.log(`Loaded in ${elapsed}ms across ${roots.length} root(s).`);
        for (const s of this.rootStats) {
            this.log(`  ${s.label}: ${s.files} files total`);
            this.log(`    classified: ${s.locFiles} loc files, ${s.commonFiles} common files, ${s.eventFiles} event files, ${s.gfxFiles} gfx files, ${s.inlineScriptFiles} inline_script files, ${s.scriptedVarFiles} scripted_variables files`);
            this.log(`    parsed:     ${s.loc} loc entries, ${s.entities} entities, ${s.events} events, ${s.gfx} gfx sprites, ${s.inlineScripts} inline scripts, ${s.scriptedVars} scripted vars`);
        }
        this.log(`  totals: ${this.locDict.size} preferred-loc keys, ${this.locFallbackDict.size} fallback-loc keys, ${this.entityDict.size} entities, ${this.eventDict.size} events, ${this.gfxDict.size} gfx, ${this.inlineScriptDict.size} inline scripts, ${this.scriptedVariableDict.size} scripted vars, ${reverseEntries} reverse-loc refs`);
        const sampleEvents = [...this.eventDict.keys()].slice(0, 5);
        if (sampleEvents.length) this.log(`  sample events indexed: ${sampleEvents.join(', ')}`);
    }

    async walk(dir) {
        const result = [];
        const stack = [dir];
        while (stack.length) {
            const d = stack.pop();
            let entries;
            try { entries = await fs.promises.readdir(d, { withFileTypes: true }); }
            catch { continue; }
            for (const e of entries) {
                if (e.name === '.git' || e.name === 'node_modules' || e.name === '.vscode') continue;
                const full = path.join(d, e.name);
                if (e.isDirectory()) stack.push(full);
                else if (e.isFile()) result.push(full);
            }
        }
        return result;
    }

    async readText(file) {
        try {
            let text = await fs.promises.readFile(file, 'utf8');
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            return text;
        } catch {
            try { return await fs.promises.readFile(file, 'latin1'); }
            catch { return null; }
        }
    }

    detectLocLanguage(file) {
        const lower = path.basename(file).toLowerCase();
        const m = lower.match(/_l_([a-z_]+)\.yml$/);
        if (m) return m[1];
        return null;
    }

    async parseLoc(file) {
        const text = await this.readText(file);
        if (text === null) return 0;
        const lang = this.detectLocLanguage(file);
        const targetMap = (lang === this.preferredLanguage) ? this.locDict
            : (lang === 'english' ? this.locFallbackDict : null);
        if (!targetMap && lang !== this.preferredLanguage) return 0;
        const map = targetMap || this.locDict;

        const lines = text.split(/\r?\n/);
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const stripped = raw.replace(/^\s+/, '');
            if (!stripped || stripped.startsWith('#')) continue;
            if (/^l_[a-z_]+\s*:/i.test(stripped)) continue;
            const m = raw.match(LOC_LINE_RE);
            if (!m) continue;
            const key = m[1];
            const value = m[2];
            map.set(key, { value, file, line: i + 1, lang });
            count++;
        }
        return count;
    }

    async parseEntities(file, category) {
        const text = await this.readText(file);
        if (text === null) return 0;
        const lines = text.split(/\r?\n/);
        let curly = 0;
        let currentName = null;
        let cache = [];
        let startLine = 0;
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const hash = raw.indexOf('#');
            const cleaned = hash >= 0 ? raw.slice(0, hash) : raw;
            if (curly > 0) {
                cache.push(raw);
                const open = (cleaned.match(/\{/g) || []).length;
                const close = (cleaned.match(/\}/g) || []).length;
                curly += open - close;
                if (curly <= 0 && currentName) {
                    this.entityDict.set(currentName, { lines: cache, file, line: startLine, category });
                    count++;
                    cache = [];
                    currentName = null;
                    curly = 0;
                }
            } else {
                const eq = cleaned.indexOf('=');
                if (eq < 0) continue;
                const name = cleaned.slice(0, eq).trim();
                if (!name || /\s|"/.test(name) || name.startsWith('@')) continue;
                const open = (cleaned.match(/\{/g) || []).length;
                const close = (cleaned.match(/\}/g) || []).length;
                if (open > 0) {
                    curly = open - close;
                    if (curly > 0) {
                        currentName = name;
                        cache = [raw];
                        startLine = i + 1;
                    } else if (curly === 0) {
                        this.entityDict.set(name, { lines: [raw], file, line: i + 1, category });
                        count++;
                    }
                }
            }
        }
        return count;
    }

    async parseEvents(file) {
        const text = await this.readText(file);
        if (text === null) return 0;
        const lines = text.split(/\r?\n/);
        const EVENT_TYPE_RE = /^\s*(planet_event|country_event|ship_event|fleet_event|pop_event|pop_faction_event|leader_event|species_event|starbase_event|situation_event|event)\s*=\s*\{/;
        const ID_INLINE_RE = /^\s*([A-Za-z_][\w]*\.\d+)\s*=\s*\{/;
        const ID_FIELD_RE = /^\s*id\s*=\s*([A-Za-z_][\w]*\.\d+)\b/;
        let curly = 0;
        let count = 0;
        let inEvent = false;
        let pendingId = null;
        let eventStartLine = 0;
        let eventKind = null;
        let cache = [];
        const commit = () => {
            if (!pendingId) return;
            this.eventDict.set(pendingId, { file, line: eventStartLine, lines: cache.slice(), kind: eventKind });
            count++;
        };
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const hash = raw.indexOf('#');
            const cleaned = hash >= 0 ? raw.slice(0, hash) : raw;
            const open = (cleaned.match(/\{/g) || []).length;
            const close = (cleaned.match(/\}/g) || []).length;
            if (!inEvent && curly === 0) {
                const mInline = cleaned.match(ID_INLINE_RE);
                const mType = cleaned.match(EVENT_TYPE_RE);
                if (mInline) {
                    pendingId = mInline[1];
                    eventStartLine = i + 1;
                    eventKind = null;
                    cache = [raw];
                    inEvent = true;
                } else if (mType) {
                    pendingId = null;
                    eventStartLine = i + 1;
                    eventKind = mType[1];
                    cache = [raw];
                    inEvent = true;
                }
            } else if (inEvent) {
                cache.push(raw);
                if (!pendingId) {
                    const mId = cleaned.match(ID_FIELD_RE);
                    if (mId) pendingId = mId[1];
                }
            }
            curly += open - close;
            if (curly <= 0 && inEvent) {
                commit();
                pendingId = null;
                cache = [];
                eventKind = null;
                inEvent = false;
                curly = 0;
            }
        }
        return count;
    }

    async parseGfx(file) {
        const text = await this.readText(file);
        if (text === null) return 0;
        const lines = text.split(/\r?\n/);
        let count = 0;
        let inSprite = false;
        let curly = 0;
        let name = null;
        let texture = null;
        let startLine = 0;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const hash = raw.indexOf('#');
            const cleaned = hash >= 0 ? raw.slice(0, hash) : raw;
            const open = (cleaned.match(/\{/g) || []).length;
            const close = (cleaned.match(/\}/g) || []).length;
            if (!inSprite) {
                if (/spriteType\s*=\s*\{/i.test(cleaned) || /corneredTileSpriteType\s*=\s*\{/i.test(cleaned) || /flagSpriteType\s*=\s*\{/i.test(cleaned)) {
                    inSprite = true;
                    curly = open - close;
                    name = null;
                    texture = null;
                    startLine = i + 1;
                    continue;
                }
            } else {
                const nm = cleaned.match(/\bname\s*=\s*"([^"]+)"/);
                if (nm) name = nm[1];
                const tx = cleaned.match(/\btexturefile\s*=\s*"([^"]+)"/i);
                if (tx) texture = tx[1];
                curly += open - close;
                if (curly <= 0) {
                    if (name) {
                        this.gfxDict.set(name, { file, line: startLine, texture });
                        count++;
                    }
                    inSprite = false;
                    curly = 0;
                }
            }
        }
        return count;
    }

    async parseScriptedVariables(file) {
        const text = await this.readText(file);
        if (text === null) return 0;
        const lines = text.split(/\r?\n/);
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const hash = raw.indexOf('#');
            const cleaned = hash >= 0 ? raw.slice(0, hash) : raw;
            const m = cleaned.match(/^\s*@(\w+)\s*=\s*(.+?)\s*$/);
            if (!m) continue;
            this.scriptedVariableDict.set(m[1], { file, line: i + 1, value: m[2] });
            count++;
        }
        return count;
    }

    async parseInlineScript(file, key) {
        const text = await this.readText(file);
        if (text === null) return 0;
        const lines = text.split(/\r?\n/);
        const normKey = key.toLowerCase().replace(/\\/g, '/');
        const existing = this.inlineScriptDict.get(normKey);
        if (existing) existing.overrides = (existing.overrides || []).concat([{ file, lines }]);
        else this.inlineScriptDict.set(normKey, { file, line: 1, lines });
        return 1;
    }

    async scanReverseLoc(file) {
        const text = await this.readText(file);
        if (text === null) return 0;
        const lines = text.split(/\r?\n/);
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const words = line.split(/["'+={}:\s#\[\]\$]+/);
            for (const word of words) {
                if (!word || word.length < 3) continue;
                if (this.locDict.has(word) || this.locFallbackDict.has(word)) {
                    let arr = this.reverseLocDict.get(word);
                    if (!arr) { arr = []; this.reverseLocDict.set(word, arr); }
                    arr.push({ file, line: i + 1, text: line });
                    count++;
                }
            }
        }
        return count;
    }

    getLoc(key) {
        return this.locDict.get(key) || this.locFallbackDict.get(key) || null;
    }
}

module.exports = { Loader };
