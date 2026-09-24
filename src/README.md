# Modular engine source

The deployed modular game engine lives here while `prototype/` remains the frozen behavioral reference.

The intended module boundaries are:

- `core/` for state, saves, migrations, events, time and deterministic randomness.
- `content/` for loading generated curriculum, shared campaign data and level configuration.
- `learning/` for mastery, review scheduling, questions, writing and audio.
- `world/` for maps, movement, encounters and canvas rendering.
- `battle/` for combat state, damage, creatures and bosses.
- `systems/` for inventory, economy, quests, gates, villagers and parent controls.
- `ui/` for DOM, overlays, HUD and screen-specific views.

Engine modules must not contain P2 or P5 constants.
The content loader combines one shared campaign with the selected level package.

Primary 2 and Primary 5 share the Region 1 runtime with separate saves, level-specific story bindings, feature flags and tuning.
`game/lab.html?debug=1` exercises generated Meaning, Pinyin, Hanzi and Usage questions, enabled real-exam adapters, speech and all three local Hanzi Writer stages for either curriculum.
