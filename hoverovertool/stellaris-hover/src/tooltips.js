const vscode = require('vscode');
const path = require('path');
const { scopeInfoForCategory } = require('./scopes');
const { trackScopes } = require('./scopeTracker');

function makeFileLink(file, line) {
    const args = encodeURIComponent(JSON.stringify({ file, line }));
    const name = path.basename(file);
    return `[${name}:${line}](command:stellarisHover.openFileAt?${args})`;
}

function cleanLocValue(value) {
    let s = value;
    s = s.replace(/§!/g, '');
    s = s.replace(/§[A-Za-z]/g, '');
    s = s.replace(/\\n/g, '  \n');
    return s;
}

const LOC_REF_RE = /\$([A-Za-z_][\w.\-]*)\$/g;
const CONCEPT_REF_RE = /\[(concept|trait|building|district|edict|tech|technology|civic|origin|ascension_perk|planet_class|resource|job|policy|decision|deposit)\s*:\s*([A-Za-z_][\w.\-]*)/g;

const NS_PREFIX_FOR_INLINE = {
    concept: 'concept_', trait: 'trait_', building: 'building_', district: 'district_',
    edict: 'edict_', tech: 'tech_', technology: 'tech_', civic: 'civic_',
    origin: 'origin_', ascension_perk: 'ap_', planet_class: 'pc_', job: 'job_',
    policy: 'policy_', decision: 'decision_', deposit: '', resource: ''
};

const MAX_DEPTH = 3;
const MAX_EXPANSIONS = 8;
const BODY_LINE_LIMIT = 40;
const SEP = '\n\n---\n\n';
const SCRIPT_SEP = '\n\n---\n\n<br>\n\n';
const SOFT_BREAK = '  \n';

const EVENT_KIND_SCOPE = {
    planet_event: 'Planet', country_event: 'Country', ship_event: 'Ship',
    fleet_event: 'Fleet', pop_event: 'Pop', pop_faction_event: 'Pop_Faction',
    leader_event: 'Leader', species_event: 'Species', starbase_event: 'Starbase',
    situation_event: 'Situation', event: 'Generic'
};

function extractLocRefs(value) {
    const refs = [];
    LOC_REF_RE.lastIndex = 0;
    let m;
    while ((m = LOC_REF_RE.exec(value)) !== null) refs.push(m[1]);
    CONCEPT_REF_RE.lastIndex = 0;
    while ((m = CONCEPT_REF_RE.exec(value)) !== null) {
        const prefix = NS_PREFIX_FOR_INLINE[m[1].toLowerCase()];
        if (prefix !== undefined) refs.push(prefix + m[2]);
    }
    return refs;
}

function appendLocLine(md, key, entry, loader, depth, visited, counter) {
    const arrow = depth > 0 ? '↳ ' : '';
    const langTag = entry.lang ? ` _${entry.lang}_` : '';
    md.appendMarkdown(`${arrow}**${key}**${langTag} · *${makeFileLink(entry.file, entry.line)}*${SOFT_BREAK}`);
    md.appendMarkdown(cleanLocValue(entry.value));
    if (!loader || depth >= MAX_DEPTH) return;
    const refs = extractLocRefs(entry.value);
    for (const ref of refs) {
        if (counter.n >= MAX_EXPANSIONS) {
            md.appendMarkdown(`${SOFT_BREAK}_(further $-refs truncated)_`);
            return;
        }
        if (visited.has(ref)) continue;
        visited.add(ref);
        const subEntry = loader.getLoc(ref);
        if (!subEntry) continue;
        counter.n++;
        md.appendMarkdown('\n\n');
        appendLocLine(md, ref, subEntry, loader, depth + 1, visited, counter);
    }
}

function appendScope(md, scope) {
    const parts = [];
    if (scope.root || scope.this) {
        if (scope.root && scope.this && scope.root === scope.this) {
            parts.push(`ROOT/THIS = ${scope.root}`);
        } else {
            parts.push(`ROOT = ${scope.root || '?'}, THIS = ${scope.this || '?'}`);
        }
    }
    if (scope.supports && scope.supports.length) {
        parts.push(`Supports: ${scope.supports.join(', ')}`);
    }
    if (!parts.length && !scope.note) return false;
    if (parts.length) md.appendMarkdown(`${SOFT_BREAK}**Scope** · ${parts.join(' · ')}`);
    if (scope.note) md.appendMarkdown(`${SOFT_BREAK}_${scope.note}_`);
    return true;
}

function compositeTooltip(c, loader) {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    const tags = [];
    if (c.entity && c.entity.category) tags.push(`common/${c.entity.category}`);
    if (c.event && c.event.kind) tags.push(`event:${c.event.kind}`);
    if (c.gfx) tags.push('gfx sprite');
    if (c.gfxConvention) tags.push('implicit trait icon');
    const tagStr = tags.length ? ` _(${tags.join(', ')})_` : '';

    const primary = c.entity || c.event || c.gfx
        || (c.locTitle && c.locTitle.entry)
        || (c.locDescVariants[0] && c.locDescVariants[0].entry);
    let header = `**${c.word}**${tagStr}`;
    if (primary && primary.file) header += ` · *${makeFileLink(primary.file, primary.line)}*`;
    md.appendMarkdown(header);

    let scope = null;
    if (c.entity) scope = scopeInfoForCategory(c.entity.category);
    else if (c.event && c.event.kind && EVENT_KIND_SCOPE[c.event.kind]) {
        const s = EVENT_KIND_SCOPE[c.event.kind];
        scope = { root: s, this: s, supports: [s] };
    }
    if (scope) appendScope(md, scope);

    const bodyLinesForScope = (c.entity && c.entity.lines) || (c.event && c.event.lines);
    const entryScope = scope && (scope.this || scope.root);
    if (bodyLinesForScope && bodyLinesForScope.length && entryScope) {
        const { scopes } = trackScopes(bodyLinesForScope, entryScope);
        if (scopes.size > 1) {
            md.appendMarkdown(`${SOFT_BREAK}**Scopes traversed** · ${[...scopes].join(', ')}`);
        }
    }

    if (c.gfx && c.gfx.texture) {
        md.appendMarkdown(`${SOFT_BREAK}\`${c.gfx.texture}\``);
    }
    if (c.gfxConvention) {
        const traitKey = c.word.slice('GFX_species_selected_background_'.length);
        md.appendMarkdown(`${SOFT_BREAK}Auto-resolves to \`gfx/interface/icons/traits/${traitKey}.dds\``);
    }

    const hasLoc = c.locTitle || (c.locDescVariants && c.locDescVariants.length);
    if (hasLoc) {
        md.appendMarkdown(SEP);
        const visited = new Set();
        const counter = { n: 0 };
        let first = true;
        if (c.locTitle) {
            visited.add(c.locTitle.key);
            appendLocLine(md, c.locTitle.key, c.locTitle.entry, loader, 0, visited, counter);
            first = false;
        }
        for (const v of c.locDescVariants) {
            if (!first) md.appendMarkdown('\n\n');
            first = false;
            visited.add(v.key);
            appendLocLine(md, v.key, v.entry, loader, 0, visited, counter);
        }
    }

    const bodyLines = (c.entity && c.entity.lines) || (c.event && c.event.lines);
    if (bodyLines && bodyLines.length) {
        md.appendMarkdown('\n\n');
        const body = bodyLines.slice(0, BODY_LINE_LIMIT).join('\n');
        md.appendCodeblock(body, 'stellaris');
        if (bodyLines.length > BODY_LINE_LIMIT) {
            md.appendMarkdown(`${SOFT_BREAK}_(${bodyLines.length - BODY_LINE_LIMIT} more lines truncated)_`);
        }
    }

    return md;
}

function builtinTooltip(info) {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    const kindLabel = info.kind ? ` _(${info.kind.replace('-', ' ')})_` : '';
    md.appendMarkdown(`**${info.word}**${kindLabel}`);
    if (info.scope) md.appendMarkdown(`${SOFT_BREAK}**Scope** · ROOT/THIS = ${info.scope}`);
    if (info.desc) md.appendMarkdown(`${SOFT_BREAK}${info.desc}`);
    return md;
}

function scriptedVariableTooltip(name, localEntry, globalEntry, currentFile) {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    const primary = localEntry || globalEntry;
    const tag = localEntry ? 'file-local scripted variable' : 'scripted variable';
    md.appendMarkdown(`**@${name}** _(${tag})_ · *${makeFileLink(primary.file, primary.line)}*`);
    md.appendMarkdown(`${SOFT_BREAK}\`= ${primary.value}\``);
    if (localEntry && globalEntry && globalEntry.file !== localEntry.file) {
        md.appendMarkdown(`${SOFT_BREAK}_Shadows global definition · ${makeFileLink(globalEntry.file, globalEntry.line)} (\`= ${globalEntry.value}\`)_`);
    }
    return md;
}

function inlineScriptTooltip(key, entry) {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`**${key}** _(inline_script)_ · *${makeFileLink(entry.file, 1)}*`);
    if (entry.overrides && entry.overrides.length) {
        md.appendMarkdown(`${SOFT_BREAK}_Overridden by ${entry.overrides.length} later root(s):_`);
        for (const o of entry.overrides) {
            md.appendMarkdown(`${SOFT_BREAK}↳ *${makeFileLink(o.file, 1)}*`);
        }
    }
    if (entry.lines && entry.lines.length) {
        md.appendMarkdown('\n\n');
        const body = entry.lines.slice(0, BODY_LINE_LIMIT).join('\n');
        md.appendCodeblock(body, 'stellaris');
        if (entry.lines.length > BODY_LINE_LIMIT) {
            md.appendMarkdown(`${SOFT_BREAK}_(${entry.lines.length - BODY_LINE_LIMIT} more lines truncated)_`);
        }
    }
    return md;
}

function reverseLocTooltip(entries, maxRefs) {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`**References (${entries.length}):**\n\n`);
    const limit = maxRefs || 25;
    for (const e of entries.slice(0, limit)) {
        const snippet = e.text.trim().replace(/`/g, "'").slice(0, 140);
        md.appendMarkdown(`- *${makeFileLink(e.file, e.line)}*: \`${snippet}\`\n`);
    }
    if (entries.length > limit) {
        md.appendMarkdown(`\n_(and ${entries.length - limit} more)_`);
    }
    return md;
}

module.exports = { compositeTooltip, builtinTooltip, reverseLocTooltip, inlineScriptTooltip, scriptedVariableTooltip, EVENT_KIND_SCOPE };
