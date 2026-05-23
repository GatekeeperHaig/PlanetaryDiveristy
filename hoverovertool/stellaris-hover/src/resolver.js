const { builtinInfo } = require('./builtins');

const NAMESPACE_PREFIX = {
    concept: 'concept_',
    trait: 'trait_',
    building: 'building_',
    district: 'district_',
    edict: 'edict_',
    ethic: 'ethic_',
    leader_class: '',
    planet_class: 'pc_',
    pop_category: 'pop_cat_',
    job: 'job_',
    resource: '',
    technology: 'tech_',
    tech: 'tech_',
    civic: 'civic_',
    origin: 'origin_',
    ascension_perk: 'ap_',
    megastructure: '',
    deposit: '',
    relic: 'r_',
    governor_trait: 'leader_trait_',
    leader_trait: 'leader_trait_',
    species_class: '',
    policy: 'policy_',
    decision: 'decision_',
    casus_belli: 'cb_',
    war_goal: 'wg_',
    starbase_building: 'sb_',
    starbase_module: 'sm_'
};

const SKIP_WORDS = new Set([
    'yes', 'no', 'if', 'else', 'else_if', 'limit', 'or', 'and', 'not', 'nor', 'nand',
    'random', 'random_list', 'hidden_effect', 'hidden_trigger', 'trigger', 'effect',
    'add', 'set', 'remove', 'change', 'every', 'any', 'count', 'while', 'switch',
    'on', 'off', 'true', 'false', 'this', 'root', 'prev', 'from', 'fromfrom', 'prevprev',
    'global_event_target', 'event_target', 'owner', 'controller', 'planet', 'country',
    'value', 'min', 'max', 'factor', 'modifier', 'weight', 'base',
    'fire_only_once', 'is_triggered_only', 'mean_time_to_happen', 'months', 'days', 'years',
    'name', 'desc', 'description', 'picture', 'icon', 'icon_frame', 'sound',
    'type', 'id', 'title', 'option', 'immediate', 'after', 'before',
    'common', 'localisation', 'localization', 'events', 'interface', 'gfx',
    'namespace', 'hide_window', 'is_advanced_event', 'auto_opens', 'show_sound',
    'is_random_event', 'pre_triggers', 'location', 'potential', 'allow',
    'prerequisites', 'category', 'text', 'response_text', 'triggered_text',
    'tooltip', 'custom_tooltip', 'localization_key', 'use_random_sound', 'force_open'
]);

function detectNamespacePrefix(before) {
    const m = before.match(/\[(\w+)\s*:\s*$/);
    if (!m) return undefined;
    return NAMESPACE_PREFIX[m[1].toLowerCase()];
}

function isInLocVar(before, after) {
    if (before.endsWith('$') && after.startsWith('$')) return true;
    if (/\$[A-Za-z_][\w.\-]*$/.test(before)) return true;
    return false;
}

function isAfterGfxAssign(before) {
    return /\b(?:icon|icon_frame|sprite|texture|name|background)\s*=\s*"?$/i.test(before);
}

function resolveHover(word, lineText, wordStart, wordEnd, loader) {
    if (!word) return null;
    if (/^\d+$/.test(word)) return null;
    if (/^[A-Z][A-Z0-9_]*$/.test(word)) return null;

    const builtin = builtinInfo(word);
    if (builtin && builtin.kind === 'event-keyword') {
        return { kind: 'builtin', key: word, info: builtin };
    }

    if (SKIP_WORDS.has(word.toLowerCase())) return null;

    const before = lineText.slice(0, wordStart);
    const after = lineText.slice(wordEnd);

    const nsPrefix = detectNamespacePrefix(before);
    if (nsPrefix !== undefined) {
        const cand = nsPrefix + word;
        if (loader.getLoc(cand)) return { kind: 'loc', key: cand };
        if (loader.getLoc(word)) return { kind: 'loc', key: word };
        if (loader.entityDict.has(cand)) return { kind: 'entity', key: cand };
        if (loader.entityDict.has(word)) return { kind: 'entity', key: word };
    }

    if (isInLocVar(before, after) && loader.getLoc(word)) {
        return { kind: 'loc', key: word };
    }

    if (word.startsWith('GFX_') || isAfterGfxAssign(before)) {
        if (loader.gfxDict.has(word)) return { kind: 'gfx', key: word };
        if (word.startsWith('GFX_species_selected_background_')) return { kind: 'gfx-convention', key: word };
    }

    if (loader.entityDict.has(word)) return { kind: 'entity', key: word };
    if (loader.eventDict.has(word)) return { kind: 'event', key: word };
    if (loader.getLoc(word)) return { kind: 'loc', key: word };

    return null;
}

function commentStart(lineText) {
    let inQuote = false;
    for (let i = 0; i < lineText.length; i++) {
        const c = lineText[i];
        if (c === '"') inQuote = !inQuote;
        else if (c === '#' && !inQuote) return i;
    }
    return -1;
}

module.exports = { resolveHover, NAMESPACE_PREFIX, SKIP_WORDS, commentStart };
