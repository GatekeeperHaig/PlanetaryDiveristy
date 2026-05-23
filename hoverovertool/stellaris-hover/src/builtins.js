const EVENT_KEYWORDS = {
    planet_event: { scope: 'Planet', desc: 'Event fired with a planet as ROOT/THIS. Use this for events about colonies, terraforming, planet modifiers, deposit changes, etc.' },
    country_event: { scope: 'Country', desc: 'Event fired with a country (empire) as ROOT/THIS. The default for most policy, diplomacy, and empire-wide situations.' },
    ship_event: { scope: 'Ship', desc: 'Event fired with a ship as ROOT/THIS.' },
    fleet_event: { scope: 'Fleet', desc: 'Event fired with a fleet as ROOT/THIS. Common for survey, combat, anomaly investigation.' },
    pop_event: { scope: 'Pop', desc: 'Event fired with a pop as ROOT/THIS.' },
    pop_faction_event: { scope: 'Pop_Faction', desc: 'Event fired with a pop faction as ROOT/THIS.' },
    leader_event: { scope: 'Leader', desc: 'Event fired with a leader as ROOT/THIS. Use for leader traits, agendas, retirement, death.' },
    species_event: { scope: 'Species', desc: 'Event fired with a species as ROOT/THIS.' },
    starbase_event: { scope: 'Starbase', desc: 'Event fired with a starbase as ROOT/THIS.' },
    situation_event: { scope: 'Situation', desc: 'Event fired with a situation as ROOT/THIS.' },
    event: { scope: 'Generic', desc: 'Generic event with no inherent scope. The "event" type is rarely used directly; prefer a scoped variant.' }
};

const BLOCK_KEYWORDS = {
    trigger: { desc: 'Conditions that must be true. Block of triggers checked in the current scope.' },
    limit: { desc: 'Scope-filtering conditions inside an effect (especially inside every_/random_/any_ iterators).' },
    allow: { desc: 'Player-facing requirement block. Distinct from `potential` which hides the option entirely if false.' },
    potential: { desc: 'Visibility/availability check. If false, the option is hidden rather than shown as locked.' },
    prerequisites: { desc: 'Required technologies (used in tech, buildings, etc).' },
    immediate: { desc: 'Effect block that runs as soon as the event fires (before any option is shown).' },
    after: { desc: 'Effect block that runs after an option is chosen.' },
    before: { desc: 'Effect block that runs before evaluation.' },
    option: { desc: 'A response option presented to the player. Multiple options stack in display order.' },
    modifier: { desc: 'Bonus/penalty block. Inside a weight/factor context, modifies the parent value.' },
    hidden_effect: { desc: 'Effect block whose contents are not surfaced in tooltips.' },
    hidden_trigger: { desc: 'Trigger block whose contents are not surfaced in tooltips.' }
};

const SCOPE_KEYWORDS = {
    root: { desc: 'The original scope at the start of the current execution chain.' },
    this: { desc: 'The current scope.' },
    prev: { desc: 'The previous scope (one level up from `this`).' },
    prevprev: { desc: 'Two scopes up from `this`.' },
    from: { desc: 'A context-dependent companion scope (e.g. attacker in a war goal, origin country in a diplomatic action).' },
    fromfrom: { desc: 'One level deeper than `from`.' },
    owner: { desc: 'The country that owns the current scoped object.' },
    controller: { desc: 'The country currently in control of the scoped object.' },
    event_target: { desc: 'Reference a previously saved scope by name. Use `save_event_target_as = X` to set, `event_target:X` to read.' },
    global_event_target: { desc: 'Globally-scoped saved scope. Persists across all events until cleared.' }
};

const FIELD_KEYWORDS = {
    namespace: { desc: 'Event namespace prefix for IDs in this file (e.g. `namespace = plant` -> ids like `plant.100`). Must match the prefix used in `id = <namespace>.<n>`.' },
    is_triggered_only: { desc: 'If yes, the event does not fire on its own; another script must call `country_event = { id = X }` or similar.' },
    hide_window: { desc: 'If yes, the event has no UI window; only its immediate/effect runs. Used for invisible scripted logic.' },
    mean_time_to_happen: { desc: 'Expected time before this event fires under given conditions. Used with `random` events.' },
    fire_only_once: { desc: 'Event will only ever fire once per game.' },
    title: { desc: 'Localisation key for the event window title.' },
    desc: { desc: 'Localisation key (or block of conditional keys) for the event description body.' },
    picture: { desc: 'GFX sprite shown in the event window header.' },
    location: { desc: 'Scope reference used as the camera target / location indicator.' },
    show_sound: { desc: 'Audio asset played when the event window opens.' }
};

const BUILTINS = Object.assign({}, EVENT_KEYWORDS, BLOCK_KEYWORDS, SCOPE_KEYWORDS, FIELD_KEYWORDS);

const EVENT_KIND_SET = new Set(Object.keys(EVENT_KEYWORDS));
const BLOCK_KIND_SET = new Set(Object.keys(BLOCK_KEYWORDS));
const SCOPE_KIND_SET = new Set(Object.keys(SCOPE_KEYWORDS));
const FIELD_KIND_SET = new Set(Object.keys(FIELD_KEYWORDS));

function builtinInfo(word) {
    const info = BUILTINS[word];
    if (!info) return null;
    let kind;
    if (EVENT_KIND_SET.has(word)) kind = 'event-keyword';
    else if (BLOCK_KIND_SET.has(word)) kind = 'block-keyword';
    else if (SCOPE_KIND_SET.has(word)) kind = 'scope-keyword';
    else if (FIELD_KIND_SET.has(word)) kind = 'field-keyword';
    return { word, kind, ...info };
}

module.exports = { builtinInfo };
