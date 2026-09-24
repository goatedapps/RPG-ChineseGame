# Word Spirit Quest

Word Spirit Quest is a tablet-friendly exploration RPG for learning primary-school Chinese vocabulary and reading.
The deployed playable build is the modular Primary 2 and Primary 5 Region 1 game under `game/`.
`gameplan.md` is the detailed product and rebuild specification.
Primary 2 and Primary 5 curriculum sources live under `content/source/`.
Run `npm run validate:content` after changing either source pack.

## Reference prototype and modular game

The frozen reference prototype starts at `prototype/index.html`.
The deployed modular game starts at `game/index.html` and uses the runtime modules under `src/`, styles under `css/`, and authored/generated content under `content/`.
`prototype/index.html` contains the HUD, objective banner, canvas, touch D-pad and overlay root.
`prototype/styles.css` contains the complete visual system and responsive layout.
`prototype/app.js` currently contains world generation, rendering, movement, dialogue, battles, mastery, quests, shops, stories, school activities, saves and UI flows.
`prototype/audio.js` manages scene music and packaged sound effects.
`prototype/data/content.js` contains normalized vocabulary, questions, passages and stories.
`prototype/data/hanzi.js` contains the local Hanzi Writer character data.
`prototype/vendor/hanzi-writer.min.js` is the vendored writing library.
`prototype/sounds/` contains external music and sound assets.
`prototype/assets/` contains generated visual assets such as the shop item icon atlas.
`tests/prototype.test.cjs` contains DOM, startup, save, content and progression regression checks.
`.lavish/` contains the annotated review and its pre-feedback plan snapshot.
The Region 1 parity baseline includes random encounters, packaged scene audio, held D-pad input, rotating objectives, wandering villagers, distributed passage questions, enemy spell turns, battle streaks and visible level-ups.
The service worker caches both curricula and the Region 1 runtime for offline play after the first online load.

The current world is one 52×38 map containing Scholar Village, Camping Forest, Misty Path, Kitchen Garden and Muddle Cave.
Scholar Village is intentionally the smallest and simplest hub because it teaches the core loop.
All three lesson areas are accessible from the start.
Creature levels and combat difficulty guide the intended order: Lesson 1, then Lesson 2, then Lesson 3.
Tablet movement uses a D-pad overlaid on the play area.
The objective banner rotates through incomplete activities every 60 seconds.
Selected flavor villagers wander within the town while quest and passage villagers remain fixed.
Wild battles use a staged encounter transition, and creature damage plays a packaged impact sound.

## Current gameplay rules

Keep the five vocabulary skills: Meaning, Pinyin, Hanzi, Usage and Writing.
Keep the four-miss handwriting help threshold.
A full skill star requires correct work on two different days.
Keep the current self-marking rewards and continuing School XP.
Keep Higher Chinese reading optional and outside required progression.
Keep the parent battle cap and the first three rewarded School sessions per day.
Preserve the 30–60 minute intended session range without adding a mandatory timer.
Preserve old saves through validated migrations and recovery.
Do not silently reset invalid saves.
Protect the Parent Panel with a changeable PIN stored as a salted code rather than plain text.
Keep player and creature HP, attack, defense and evasion visible where relevant.
Damage must use attacker stats, defender stats, move bonuses and a small random roll.
The shop offers lesson-specific bait that targets an exact selected word spirit.
The Muddle Cave gate uses a percentage of distinct Silver-or-better spirits plus the Cave Lantern.

## Content and world rules

Keep the embedded vocabulary and Hanzi character coverage intact when changing prototype logic.
English is the world and interface language.
Chinese appears when it is the learning content and should receive an English gloss when first introduced in dialogue.
Dialogue should be warm, concise and suitable for readers aged roughly 9–11.
Villagers may provide gameplay advice, local gossip, world lore, story updates or a concrete request.
Important villager dialogue should change as the story progresses.
Flavor villagers should still help orientation, teaching or world-building.
Buildings should have a gameplay or story purpose.
Later towns should use more space, buildings, residents, optional interiors and shortcuts than Scholar Village.
Each later town needs a distinct visual identity and a local problem tied to its lessons.

## Future campaign

Primary 5 is planned as seven regions around the Great Dictionary Tree.
Region 1 is Scholar Village for Lessons 1–3 and the Muddle King.
Region 2 is Harvest Crossing for Lessons 4–6, with a market, hawker centre, hill village and Doubt Serpent.
Region 3 is Tidewater Bay and Clock Tower for Lessons 7–8, with a whale rescue and Idle Clock.
Region 4 is Lantern Theatre and Farm Fields for Lessons 9–10, with performance spaces, farming systems and Mocking Mirror.
Region 5 is Festival City for Lessons 11–12, with martial arts, a crowded celebration and Grudge Dragon.
Region 6 is Ancient Grove for Lessons 13–15, with an archaeology camp, Hanzi history and Give-Up Ghost.
Region 7 is Treehouse Summit and the Great Dictionary Tree for Lessons 16–17, restoration and the Great Forgetter.

Every later hub should include the core School, Reading Hall, Inn and Shop services.
Use larger hubs to add story-specific facilities such as markets, docks, theatres, farms, museums, workshops or transit points.
Optional buildings should contain useful dialogue, a request, a fixed reward, a collectible or a learning activity.
Avoid empty interiors and decorative systems with no player-facing purpose.
Reuse earlier locations when new abilities open a shortcut, secret room or review activity.

## Planned rebuild

The long-term app should remain plain HTML, CSS and JavaScript with ES modules.
The HTML should remain a small shell.
Move editable text, maps, dialogue, items, prices, encounters and balance values into authored JSON.
Keep curriculum source data separate from authored campaign data.
Generate normalized level content and local Hanzi data during the build.
Use one shared engine with separate content packs and saves for each school level.
Use one shared seven-region world, cast, quest line, boss sequence and Great Forgetter story for every school level.
A new school level adds curriculum, lesson-to-region mapping, feature flags and tuning; it does not add another world.
Treat source readiness and world-mapping readiness as separate states.
Do not expose P2 as playable until its mapping, feature flags and tuning are ready.

Organize runtime code into `core`, `content`, `learning`, `world`, `battle`, `systems` and `ui` modules.
Keep learning, battle and progression logic pure or state-only wherever possible.
Use events for cross-system changes such as battle wins, tier changes, quest progress and day changes.
Keep DOM and canvas work inside the UI and world-rendering layers.
Put shared tuning values in authored balance data rather than scattering constants through code.

The target repository structure is described in Sections 14–19 of `gameplan.md`.
Begin the structured rebuild before implementing the later regions at full scale.
Treat the current prototype as the behavioral and visual reference during migration.
Migrate one working system at a time while preserving save compatibility.
After P5 Region 1 parity, run P2 Lessons 1–3 through the same Region 1 before building shared Region 2.

P0 is complete: both source packs validate and generate normalized content plus local Hanzi data.
P1 is complete under `game/`: the modular preview loads shared Region 1 data, supports movement and interactions, and keeps isolated encoded preview saves.
P2 is complete under `game/lab.html`: both content packs can run generated questions, supported exam questions, speech and local three-stage handwriting through shared learning modules.
P3 is complete: the modular Region 1 has stat-based wild battles, School activities, Reading Hall passage chains, Spirit Book, Inn, Shop, daily energy and a PIN-protected parent summary.
P4 and P5 are complete: the modular build has consumables, gear, crafting, partner skills, Restoration Sets, milestones and the player room.
P6 is complete: daily quests, the chest, Lantern Streak, weekly freeze, Mystery Scrolls and the Scroll Library use local dates.
P7 is complete: Region 1 has its authored story, tutorial, Storyteller, villager requests, rival duels, gate, four-phase boss, Dawn Stroke, hidden grove and next-region progress gate.
The Region 1 parity correction is complete: random encounters, packaged scene audio, held D-pad input, rotating objectives, wandering lore villagers, distributed passage questions, optional Higher Chinese, enemy spell turns, battle streaks, rare variants and visible level-ups match the reference behavior.
P8 is complete: the parent panel includes goals, weekly summaries, save transfer, region and test controls, speech speed, sound and PIN changes.
P9 is complete: P2 Lessons 1–3 use the shared Region 1 with separate saves, younger tuning, P2 story words and feature-aware activities.
P10 engineering hardening is complete, but `PILOT.md` keeps Region 2 blocked until the physical child-and-parent tablet session is recorded.

## Development workflow

Run `npm test` after modifying prototype behavior, content wiring or save logic.
Add focused regression coverage for new permanent systems and previously reported failures.
Do not add tests that only repeat an implementation detail without checking behavior or required wiring.
Keep `AGENTS.md` below 200 lines and remove stale decisions when requirements change.
When substantially changing architecture or permanent product rules, update this file concisely.
Never end an active Lavish annotation session until the user finishes or explicitly requests it.
