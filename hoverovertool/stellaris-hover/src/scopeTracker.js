const SCOPE_CHANGERS = {
    owner: 'Country',
    controller: 'Country',
    founder: 'Country',
    space_owner: 'Country',
    overlord: 'Country',
    capital_country: 'Country',

    planet: 'Planet',
    capital_scope: 'Planet',
    best_capital: 'Planet',
    home_planet: 'Planet',
    orbit: 'Planet',

    leader: 'Leader',
    ruler: 'Leader',
    last_added_leader: 'Leader',
    heir: 'Leader',

    species: 'Species',
    founder_species: 'Species',
    last_created_species: 'Species',

    solar_system: 'System',
    space: 'System',
    starbase: 'Starbase',

    pop: 'Pop',
    country: 'Country',

    federation: 'Federation',
    federation_leader: 'Country',

    fleet: 'Fleet',
    ship: 'Ship',
    army: 'Army',

    spynetwork: 'SpyNetwork',
    operation: 'Operation'
};

const ITERATOR_PREFIXES = ['every_', 'any_', 'random_', 'count_', 'ordered_'];

const ITERATOR_SUFFIX_SCOPES = {
    country: 'Country', countries: 'Country',
    played_country: 'Country', war_participant: 'Country',
    neighbor_country: 'Country', subject: 'Country', subjects: 'Country',
    rival_country: 'Country', other_country: 'Country',
    relation: 'Country', communications: 'Country',
    bordering_country: 'Country', galactic_community_member: 'Country',

    planet: 'Planet', planets: 'Planet',
    owned_planet: 'Planet', controlled_planet: 'Planet',
    system_planet: 'Planet', galaxy_planet: 'Planet',

    pop: 'Pop', pops: 'Pop',
    owned_pop: 'Pop', pop_in_system: 'Pop',
    species_pop: 'Pop',

    pop_species: 'Species', species: 'Species',

    fleet: 'Fleet', fleets: 'Fleet',
    owned_fleet: 'Fleet', war_target_fleet: 'Fleet',

    ship: 'Ship', ships: 'Ship', owned_ship: 'Ship',

    leader: 'Leader', leaders: 'Leader',
    pool_leader: 'Leader', owned_leader: 'Leader',
    governor: 'Leader', admiral: 'Leader',
    scientist: 'Leader', envoy: 'Leader',

    system: 'System', systems: 'System',
    neighbor_system: 'System', system_in_cluster: 'System',

    starbase: 'Starbase', starbases: 'Starbase', owned_starbase: 'Starbase',

    war: 'War', wars: 'War',
    federation: 'Federation', federations: 'Federation',

    megastructure: 'Megastructure', megastructures: 'Megastructure',

    district: 'District', districts: 'District',
    deposit: 'Deposit', deposits: 'Deposit',
    building: 'Building', buildings: 'Building',
    archaeological_site: 'ArcheologicalSite',
    job: 'Job', jobs: 'Job',

    army: 'Army', armies: 'Army', owned_army: 'Army',

    relic: 'Relic',
    spynetwork: 'SpyNetwork',
    operation: 'Operation',
    situation: 'Situation', active_situation: 'Situation'
};

const SCOPE_NAVIGATION = new Set(['from', 'prev', 'root', 'this', 'fromfrom', 'prevprev', 'fromfromfrom', 'fromfromfromfrom']);
const STRUCTURAL = new Set([
    'if', 'else', 'else_if', 'limit', 'trigger', 'effect', 'immediate', 'after', 'before',
    'option', 'hidden_effect', 'hidden_trigger', 'modifier', 'allow', 'potential',
    'prerequisites', 'desc', 'text', 'response_text', 'tooltip', 'custom_tooltip',
    'fail_text', 'trigger_text', 'show_sound', 'picture', 'location', 'title',
    'while', 'switch', 'and', 'or', 'not', 'nor', 'nand', 'show_sound'
]);

function resolveScope(keyword) {
    const lower = keyword.toLowerCase();
    if (SCOPE_CHANGERS[lower]) return SCOPE_CHANGERS[lower];

    for (const prefix of ITERATOR_PREFIXES) {
        if (!lower.startsWith(prefix)) continue;
        const suffix = lower.slice(prefix.length);
        if (ITERATOR_SUFFIX_SCOPES[suffix]) return ITERATOR_SUFFIX_SCOPES[suffix];
        const parts = suffix.split('_');
        for (let i = 0; i < parts.length; i++) {
            const candidate = parts.slice(i).join('_');
            if (ITERATOR_SUFFIX_SCOPES[candidate]) return ITERATOR_SUFFIX_SCOPES[candidate];
        }
    }

    if (lower.startsWith('event_target:')) return 'EventTarget';
    if (/^[a-z_]+_event$/.test(lower)) return null;
    return null;
}

function trackScopes(lines, entryScope) {
    if (!entryScope) return { scopes: new Set(), transitions: [] };
    const scopes = new Set([entryScope]);
    const transitions = [];
    const stack = [entryScope];

    const TOKEN_BLOCK_RE = /(\b[a-z_][\w:]*)\s*=\s*\{/gi;
    let lineNum = 0;
    for (const raw of lines) {
        lineNum++;
        const hash = raw.indexOf('#');
        const cleaned = hash >= 0 ? raw.slice(0, hash) : raw;
        TOKEN_BLOCK_RE.lastIndex = 0;
        let m;
        while ((m = TOKEN_BLOCK_RE.exec(cleaned)) !== null) {
            const keyword = m[1];
            const lower = keyword.toLowerCase();
            if (SCOPE_NAVIGATION.has(lower) || STRUCTURAL.has(lower)) {
                stack.push(stack[stack.length - 1]);
                continue;
            }
            const target = resolveScope(keyword);
            if (target) {
                if (!scopes.has(target)) {
                    transitions.push({ from: stack[stack.length - 1], to: target, via: keyword, line: lineNum });
                }
                scopes.add(target);
                stack.push(target);
            } else {
                stack.push(stack[stack.length - 1]);
            }
        }
        const closes = (cleaned.match(/\}/g) || []).length;
        for (let i = 0; i < closes; i++) {
            if (stack.length > 1) stack.pop();
        }
    }
    return { scopes, transitions };
}

module.exports = { trackScopes, resolveScope };
