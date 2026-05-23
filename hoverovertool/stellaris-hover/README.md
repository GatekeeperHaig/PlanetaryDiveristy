# stellaris-hover

VS Code hover tooltips and YAML-loc syntax highlighting for Stellaris script and localisation files.

## What it shows

When hovering inside a `.txt` script file (or `.gfx`, `.gui`):

- **Localisation key** — resolves to the preferred-language string (English fallback), with a clickable jump-to-source link to the `.yml` file.
- **Inline namespace refs** — `[concept:foo]`, `[trait:foo]`, `[building:foo]`, `[tech:foo]`, etc. resolve the contextual prefix (`concept_foo`, `trait_foo`, `building_foo`, `tech_foo`, and so on) and look up the matching loc.
- **`$variable$` loc interpolation** — words wrapped in `$...$` are resolved against the loc index.
- **Common entities** — top-level keys defined in any `common/<category>/*.txt` (traits, civics, buildings, deposits, planet_classes, scripted_effects/triggers, static_modifiers, etc.) show their definition body and source file. The originating category is shown in the tooltip header.
- **Events** — IDs matching `namespace.NNNN` are linked to their event block.
- **GFX sprites** — `GFX_xxx` resolves to the `spriteType` definition in `interface/*.gfx`, surfacing the `texturefile` path. For trait icons, the implicit `GFX_species_selected_background_<trait_key>` convention is recognised even without an explicit sprite definition.

When hovering inside a localisation `.yml` file, the tooltip flips to a **reverse-loc** view listing every script file that references the key, capped by `stellarisHover.maxReverseRefs`.

## Syntax highlighting for `.yml` loc files

The extension injects a TextMate grammar into `source.yaml` that colours the Stellaris-specific tokens CWTools leaves untouched. No language switch required; opens as plain YAML and the loc tokens light up on top.

Tokenised:

- **Loc key + version** — `holding_foo_desc:2` splits into key, separator, and version number. Fires only on lines that have a quoted value, so plain YAML keys are untouched.
- **Colour codes** — `§R`, `§G`, `§Y`, `§B`, `§M`, `§P`, `§O`, `§H`, `§L`, `§W`, `§T`, `§S`, `§E`, `§!`, plus indexed `§0`–`§9` and a fallback for any other letter. Each colour has its own scope so themes can match in-game tints.
- **Variable refs** — `$pop$`, `$r_energy$`, `$district_pd_aw_necro$`. Engine all-caps tokens (`$TRIGGER_FAIL$`, `$NEW_LINE$`, `$MOD_POP_GROWTH_SPEED_REDUCTION$`) get a distinct scope from user loc-key refs. `|format` suffixes (`$PLANET|Y$`) are split out.
- **Icon embeds** — `£unity£`, `£alloys|G£`, with `|frame` suffix highlighted separately.
- **Scope/script refs** — `[Root.Owner.GetName]`, `[Planet.foo]`, `['concept:foo']`, `['civic:bar']`. Scope roots, accessors, and call segments each get their own scope. The opening `[` requires a known scope root or a quoted namespace prefix in lookahead, so YAML flow sequences like `[1, 2, 3]` are not affected.
- **`\n` escapes** — visible newline markers inside quoted values.

Default colours are contributed via `editor.tokenColorCustomizations` defaults and will not override anything you have set yourself. To re-theme, copy the rules out of `package.json` and edit `editor.tokenColorCustomizations.textMateRules` in your user settings.

## Indexing

On activation the extension walks:

1. The vanilla Stellaris install (auto-detected at the default Steam location, or `stellarisHover.vanillaPath` if set).
2. Every workspace folder.
3. Any extra paths in `stellarisHover.modRoots`.

Vanilla is indexed first; workspace and mod-root entries override on collision, mirroring the engine load order. Counts per root appear in the **Stellaris Hover** output channel after the first load.

## Install

```powershell
$src = "<path to the folder containing this stellaris-hover folder>"
$dest = "$env:USERPROFILE\.vscode\extensions\stellaris-hover"
if (Test-Path $dest) { Remove-Item -Recurse -Force -LiteralPath $dest }
Copy-Item -Recurse -LiteralPath "$src\stellaris-hover" -Destination $dest
```

Then `Ctrl+Shift+P` -> **Developer: Reload Window**.

## Settings

| Key | Default | Description |
| --- | --- | --- |
| `stellarisHover.vanillaPath` | `""` | Absolute path to vanilla Stellaris. Empty = auto-detect Steam install. |
| `stellarisHover.includeVanilla` | `true` | Index vanilla in addition to the workspace. |
| `stellarisHover.modRoots` | `[]` | Extra mod folders to index beyond the open workspace. |
| `stellarisHover.preferredLanguage` | `"english"` | Loc language surfaced in tooltips. English is always loaded as fallback. |
| `stellarisHover.scanScriptReverse` | `true` | Build the reverse-loc index for `.yml` hover. |
| `stellarisHover.maxReverseRefs` | `25` | Max references shown per tooltip before collapsing. |
| `stellarisHover.underlineHoverable` | `true` | Underline every token in `.txt`/`.gfx`/`.gui` that has a hover tooltip available. |
| `stellarisHover.underlineStyle` | `"underline"` | One of `underline`, `underline-dotted`, `underline-dashed`. |

## Commands

- `Stellaris Hover: Reload index` — rebuild the in-memory index without reloading the window.
- `Stellaris Hover: Open file at line` — internal, fired by tooltip links.

## Notes

- Pair with [CWTools](https://marketplace.visualstudio.com/items?itemName=tboby.cwtools-vscode) for `.txt` script highlighting. This extension only contributes a grammar for `.yml` loc files, which CWTools does not cover.
- Vanilla indexing on a full install takes a couple of seconds. Disable `includeVanilla` if you only ever resolve keys defined inside the workspace.
- The reverse-loc index is built from workspace roots only (not vanilla), so hovering a vanilla loc key in a mod `.yml` shows the mod files that reuse it, not every vanilla file.
