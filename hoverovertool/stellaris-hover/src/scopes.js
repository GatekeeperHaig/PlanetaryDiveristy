const CATEGORY_SCOPES = {
    buildings: { root: 'Planet', this: 'Planet', supports: ['Planet'] },
    districts: { root: 'Planet', this: 'Planet', supports: ['Planet'] },
    decisions: { root: 'Planet', this: 'Planet', supports: ['Planet'] },
    edicts: { root: 'Country', this: 'Country', supports: ['Country', 'Planet'] },
    planet_modifiers: { root: 'Planet', this: 'Planet', supports: ['Planet'] },
    deposits: { root: 'Planet', this: 'Planet', supports: ['Planet'] },
    deposit_categories: { root: 'Planet', this: 'Planet', supports: ['Planet'] },
    planet_classes: { root: 'Planet', this: 'Planet', supports: ['Planet'] },
    anomalies: { root: 'Planet', this: 'Planet', supports: ['Planet'] },
    archaeological_site_types: { root: 'Planet', this: 'Planet', supports: ['Planet'] },
    section_templates: { root: 'Ship', this: 'Ship', supports: ['Ship'] },

    policies: { root: 'Country', this: 'Country', supports: ['Country'] },
    civics: { root: 'Country', this: 'Country', supports: ['Country'] },
    origins: { root: 'Country', this: 'Country', supports: ['Country'] },
    ascension_perks: { root: 'Country', this: 'Country', supports: ['Country'] },
    governments: { root: 'Country', this: 'Country', supports: ['Country'] },
    ethics: { root: 'Country', this: 'Country', supports: ['Country'] },
    casus_belli: { root: 'Country', this: 'Country', supports: ['Country'] },
    war_goals: { root: 'Country', this: 'Country', supports: ['Country'] },
    galactic_focuses: { root: 'Country', this: 'Country', supports: ['Country'] },
    technology: { root: 'Country', this: 'Country', supports: ['Country'] },
    relics: { root: 'Country', this: 'Country', supports: ['Country'] },
    diplomatic_actions: { root: 'Country', this: 'Country', supports: ['Country'] },
    intel_levels: { root: 'Country', this: 'Country', supports: ['Country'] },
    agendas: { root: 'Country', this: 'Leader', supports: ['Country', 'Leader'] },

    traits: { root: 'Species', this: 'Species', supports: ['Species'] },
    leader_traits: { root: 'Leader', this: 'Leader', supports: ['Leader'] },
    governor_traits: { root: 'Leader', this: 'Leader', supports: ['Leader'] },

    pop_categories: { root: 'Pop', this: 'Pop', supports: ['Pop'] },
    pop_jobs: { root: 'Pop', this: 'Pop', supports: ['Pop'] },
    jobs: { root: 'Pop', this: 'Pop', supports: ['Pop'] },
    pop_faction_types: { root: 'Pop_Faction', this: 'Pop_Faction', supports: ['Pop_Faction'] },

    special_projects: { root: 'Country', this: 'Fleet', supports: ['Country', 'Fleet', 'Planet'] },
    megastructures: { root: 'Megastructure', this: 'Megastructure', supports: ['Megastructure'] },
    component_templates: { root: 'Ship', this: 'Ship', supports: ['Ship'] },
    component_sets: { root: 'Ship', this: 'Ship', supports: ['Ship'] },
    ship_sizes: { root: 'Ship', this: 'Ship', supports: ['Ship'] },
    armies: { root: 'Army', this: 'Army', supports: ['Army'] },

    starbase_buildings: { root: 'Starbase', this: 'Starbase', supports: ['Starbase'] },
    starbase_modules: { root: 'Starbase', this: 'Starbase', supports: ['Starbase'] },
    starbase_types: { root: 'Starbase', this: 'Starbase', supports: ['Starbase'] },
    federation_types: { root: 'Federation', this: 'Federation', supports: ['Federation'] },
    federation_laws: { root: 'Federation', this: 'Federation', supports: ['Federation'] },
    federation_perks: { root: 'Federation', this: 'Federation', supports: ['Federation'] },

    static_modifiers: { root: null, this: null, supports: ['Country', 'Planet', 'Pop', 'Ship', 'Fleet', 'Leader', 'Species', 'Starbase'], note: 'context depends on attachment' },
    scripted_triggers: { root: null, this: null, supports: [], note: 'inherits from caller' },
    scripted_effects: { root: null, this: null, supports: [], note: 'inherits from caller' },
    script_values: { root: null, this: null, supports: [], note: 'inherits from caller' },

    on_actions: null,
    game_concepts: null,
    strategic_resources: null,
    species_classes: null,
    name_lists: null,
    button_effects: null
};

function scopeInfoForCategory(category) {
    if (!category) return null;
    if (!Object.prototype.hasOwnProperty.call(CATEGORY_SCOPES, category)) return null;
    return CATEGORY_SCOPES[category];
}

module.exports = { scopeInfoForCategory };
