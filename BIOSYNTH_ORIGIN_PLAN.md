# Revive the Bio-Synth origin ("Children of Unit 04")

## Context

Planetary Diversity once shipped a **playable origin** where you *started* as a bio-synthetic civilization created by the rogue AI "Unit 04." It was a Dan favorite, dropped during the rewrite in favor of the current **discoverable** Bio-Synth world (`planetary_diversity_uniques`) with its Unit 04 redemption quest. The old origin's code survives only in `zz_OLD PD/planetary_diversity_uniques/`.

Goal: **recreate the playable Bio-Synth origin** as a parallel feature, reviving the species-identity layer the discoverable world never had, plus two new ideas from the author:
- A proper **Bio-Synthetic species type** (a species_class, the way Cryophiles are their own type).
- **Unit 04 as your immortal starting ruler**: government is locked at start, and completing a quest makes Unit 04 "let you off the leash" so you can reform to any government.

**Out of scope - do not touch:** the discoverable Bio-Synth world and its `situation_pd_biosynth_world`, the `pdbiosynth.*` found-world event chain, the Unit 04 leader-recruit arc there, `trait_unit_04_children`, `building_pd_biosynth_cauldron`, `tech_biosynth_*`. That feature is finished. The origin is separate but should *feel* consistent with it.

## Corrected design decisions (from author)

1. **Naming: Bio-Synth only.** Drop "Techno-Organic" entirely (planet name, origin name, keys). Origin key `origin_pd_biosynth`; use `origin_pd_*` / `pd_biosynth_*` conventions of the live submod.
2. **Homeworld stays the alpine `pc_pd_biosynth`.** No new planet class, no art change. The origin starts the player on the existing class with its existing entity/art.
3. **Bio-Synthetic species type** = a new **species_class** `BIOSYNTH` on the vanilla `BIOLOGICAL` archetype, mirroring `CRYO` in `planetary_diversity_exotics/common/species_classes/pd_exotic_species_classes.txt` (archetype = BIOLOGICAL, mandatory cost-0 base trait, custom graphical_culture/preference).
4. **Unit 04 starting ruler + locked government.** Mirror vanilla **Under One Rule** (`origin_legendary_leader`): immortal unique ruler at start, `set_government_cooldown` locks reform, a later event unlocks it. **Forced authority only** at start (ethics/civics free); on quest completion government reform unlocks. Reuse the submod's existing `leader_trait_unit_04` + `ethic_leader_creator` + `unit_04` portrait (already in `planetary_diversity_uniques`).
5. **Living Metal as an assembly cost, not upkeep (assembly-only).** Drop the old per-pop `sr_living_metal` upkeep (clunky). Bio-synths are **infertile** (no natural growth, like clone soldiers); new pops come **only** from a Bio-Synth assembler that consumes `sr_living_metal`. Pops carry **no ongoing upkeep**. A **Living Metal deficit zeroes pop creation**. Concrete verified mechanic (keys checked against `modifiers.log` / `triggers.log` and the old clone-vat code):
   - A Bio-Synth assembler **job/building** under economic category `planet_pop_assemblers`, with `upkeep = { sr_living_metal = N }` as the cost-to-make-more (scales with assembly activity, not with existing pop count).
   - `planet_modifier = { planet_pop_assembly_add = N }` for base assembly speed.
   - `triggered_planet_modifier = { potential = { owner = { has_deficit = sr_living_metal } } modifier = { planet_pop_assembly_mult = -1 } }` to zero creation in deficit (the old `building_techno_04_clone_vat` deficit-guard pattern, minus per-pop upkeep).
   - The modular trait pool also loses its old living-metal upkeep.
6. **The quest matches the existing events.** The found-world `pdbiosynth.*` events stay untouched, but the origin's own quest is authored in their voice/structure (the situation-stage cadence of `situation_pd_biosynth_world` and Unit 04's `§G...§!` dialogue tone in `pdbiosynth.300-370`).
7. **Unit 04's fate is a player choice** at quest end (branching, echoing the found-world's four fates): keep Unit 04 as immortal ruler, retire it to the council as a unique leader, or release it.

## Reference templates
- Working 4.4 origin end-to-end: `origin_pd_crystal_world` + `pd_origin_init_crystal` (`planetary_diversity_uniques/common/governments/civics/pd_origins_unique.txt`, `planetary_diversity_uniques/common/solar_system_initializers/pd_unique_origins.txt`).
- Species type: `CRYO` species_class + `trait_cryophile` (exotics submod).
- Immortal ruler + locked/unlocked government: vanilla `origin_legendary_leader` (`00_origins.txt`), events `paragon.5000` (lock: `set_government_cooldown = default`) -> `paragon.5213` (unlock: `set_government_cooldown = no`); `ethic_leader_creator` in vanilla `paragon_effects.txt`.
- Port from `zz_OLD PD/planetary_diversity_uniques/`: trait pool (`pd_biosynth_traits.txt`), traditions (`pd_biosynth.txt`), ascension (`pd_unique_perks.txt`), gating triggers (`unique_ow_scripted_triggers.txt`).

All work lands in `planetary_diversity_uniques/`. Verify every effect/trigger/modifier against `Stellaris/logs/script_documentation/` before writing (per CLAUDE.md). 4.4 compliance: add `is_nomadic = no` to the origin `possible`; keep `possible` to the fixed key set (`ethics`/`civics`/`species_class`, `NOT`/`NOR` nested only).

## Implementation

### Phase 1 - Bio-Synthetic species type
- New species_class `BIOSYNTH` mirroring `CRYO`, in a new `planetary_diversity_uniques/common/species_classes/pd_biosynth_species_classes.txt`. Archetype `BIOLOGICAL`, mandatory `trait = trait_biosynth`, graphical_culture + climate preference.
- `trait_biosynth` (cost 0, mandatory, `allowed_archetypes = { BIOLOGICAL }`): carries the identity; set `infertile = yes` so the species never grows naturally (assembly-only per #5). Decide `immortal_leaders`. Mirrors the old `trait_organic_fourschildren`.
- Loc + species-type icon/background (register `GFX_species_selected_background_*`).

### Phase 2 - Origin shell
- `origin_pd_biosynth` in `pd_origins_unique.txt`, mirroring `origin_pd_crystal_world`: `starting_colony = pc_pd_biosynth`, `initializers = { pd_origin_init_biosynth }`, `possible` (require `species_class = BIOSYNTH`, NOT gestalt, `is_nomadic = no`), forced authority lock, `flags = { custom_start_screen }` optional, `max_once_global = yes`.
- `pd_origin_init_biosynth` system initializer (new block in `pd_unique_origins.txt`): alpine `pc_pd_biosynth` homeworld, `usage = origin`, `flags = { empire_home_system }`, `starting_planet = yes`, set the existing biosynth entity/art + a starting modifier; reuse the found-world's planet-setup pattern but as an origin start (do not reference the galaxy-spawn `pd_init_biosynth`).
- Origin icon + `GFX_origin_pd_biosynth` picture + loc (name/desc/tooltip, system name/desc). English first; ES/FR/PT translated, English text for other languages.

### Phase 3 - Unit 04 ruler + locked-then-freed government + quest
- `on_game_start_country` (in the submod on_actions) fires an origin event that: spawns Unit 04 as immortal ruler via `ethic_leader_creator` (`IMMORTAL = yes`, `IMMORTAL_SPECIES = yes`, portrait `unit_04`, `leader_trait_unit_04`), and `set_government_cooldown = default` to lock reform. Mirror `paragon.5000`.
- New origin quest: a Situation mirroring `situation_pd_biosynth_world`'s stage cadence + new events in a fresh namespace (e.g. `pdbsorigin.*`) written in the existing Unit 04 voice. Do **not** edit the found-world events.
- Quest completion event: `set_government_cooldown = no` (unlock reform) + branching choice for Unit 04's fate (keep ruler / retire to council / release), echoing `pdbiosynth.330`'s four-fate structure. Mirror `paragon.5213` for the unlock.
- Reuse existing `leader_trait_unit_04` / `unit_04` portrait assets (already in submod).

### Phase 4 - Trait pool + tradition tree + ascension perk
- Restore the ~12 modular `pd_trait_*` enhancement traits (new `pd_biosynth_traits.txt`), **without** Living-Metal upkeep; available to the BIOSYNTH type, gated by tradition `pd_tr_biosynth_perk_1` via restored `can_add_biosynth_traits` / `can_remove_biosynth_traits` triggers. Re-verify every modifier key in `modifiers.log`.
- Restore `pd_tradition_biosynth` category + `pd_tr_biosynth_*` traditions (un-comment `planetary_diversity_uniques/common/traditions/pd_biosynth.txt` + category file); gate `potential` to `origin_pd_biosynth`; finisher grants the AP slot + trait upgrade.
- Restore the ascension perk (rename to `ap_pd_biosynth_perfection`), gated on `origin_pd_biosynth` + prior AP + a tech.
- Tradition grant/finisher events (new namespace), icons, tiles, loc.

### Phase 5 - Living Metal assembler (assembly-only pop creation)
- Build the Bio-Synth assembler per #5: a pop-assembly building + assembler job under `planet_pop_assemblers` with `sr_living_metal` upkeep, `planet_pop_assembly_add` for speed, and the `has_deficit = sr_living_metal` -> `planet_pop_assembly_mult = -1` deficit guard. Reframes the old `building_techno_04_clone_vat` (drop its per-pop upkeep). Confirm `infertile = yes` on `trait_biosynth` leaves assembly as the sole pop source.
- Verify against the logs that an infertile species with no other assembly source produces zero pops in a Living Metal deficit (the intended behavior).

## Open items to confirm during implementation
- Origin display name (Bio-Synth themed; old "Children of Unit 04" subtitle still fits the lore).
- Which authority Unit 04 imposes at start (the forced-authority lock).
- Whether any old economy buildings (Living Metal refinery / workshop) return alongside the assembler, or the single found-world Cauldron concept is enough.

## Effort estimate (implementation + in-game testing)

| Phase | Work | Rough |
|---|---|---|
| 1. Species type | new `BIOSYNTH` class + base trait (mirror CRYO) | ~0.5 day |
| 2. Origin shell | origin + initializer + loc (mirror Crystal) | ~0.5 day |
| 3. Unit 04 ruler + locked/freed government + quest | new + most complex: situation + branching events + government lock/unlock | ~1.5-2 days |
| 4. Trait pool + traditions + ascension | mostly un-comment/port + re-verify keys + loc | ~1 day |
| 5. Living Metal assembler | building/job + deficit guard | ~0.5 day |
| Loc (EN + ES/FR/PT) + testing/iteration | across all phases | ~1-1.5 days |

**Total: ~5-6 working days**, front-loaded on the Unit 04 quest. Much of phases 4-5 is porting from `zz_OLD PD`, so it trends to ~5 if flavor/balance tuning stays light, ~6+ if new narrative writing is heavy.

## New icons needed

Almost all art already exists (the live submod kept the trait-pool, tradition, ascension, building/job, and Unit 04 portrait/leader-trait icons even though the code was commented out). Genuinely net-new artwork:

| New icon | Why |
|---|---|
| Origin slot icon (`origins_pd_biosynth`) | only a placeholder / old `origins_pdtechno` exists |
| Origin selection picture | a typo'd `origin_pd_biosnyth.dds` exists, verify or replace |
| Species-type selected background (`GFX_species_selected_background_*`) | new `BIOSYNTH` species_class |
| `trait_biosynth` base-type icon | new mandatory species-type trait |
| (0-2) situation/quest icon | only if the quest needs its own |

**Net-new: 4 certain, up to ~6 with quest art.** Everything else is reused or ported.

## Verification
1. **Clean load**: launch with the mod; `error.log` clear of undefined refs (loc, GFX, species_class, traits, modifiers, origin/initializer/`has_origin` links).
2. **Empire creator**: `BIOSYNTH` selectable as a species type; `origin_pd_biosynth` shows with correct icon/tooltip; restrictions hold (gestalt/nomadic blocked).
3. **Start state**: homeworld is the alpine `pc_pd_biosynth`; ruler is immortal Unit 04; government reform is locked.
4. **Living Metal assembly**: with positive Living Metal income the assembler produces pops; force a deficit and confirm pop creation drops to zero (infertile species, no other source); confirm no per-pop upkeep.
5. **Quest -> freedom**: complete the origin quest; government reform unlocks; the Unit 04 fate choice resolves correctly per branch.
6. **Trait pool / traditions**: after the tradition gate, `pd_trait_*` are addable to bio-synths; `pd_tradition_biosynth` shows for this origin only; finisher grants the AP slot.
7. Diff against `zz_OLD PD` to confirm no revived mechanic was silently dropped.
