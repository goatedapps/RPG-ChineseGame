# Word Spirit Quest — Handoff Plan

## Product

Word Spirit Quest is a tablet-friendly exploration RPG for Singapore primary-school Chinese.
Every creature contains a collectible vocabulary word, and combat actions are powered by learning tasks.
Primary 2 and Primary 5 use the same engine, world, cast and campaign with separate curriculum packs and saves.
The intended session is 30–60 minutes, but the game has no mandatory timer.
The game opens with an illustrated, musical, typewriter-paced prologue that introduces the Dictionary Tree, Word Spirits, the Spirit Brush and the Great Forgetter.
The prologue remains skippable during testing and is intended to become mandatory after approval.

The current build contains all seven shared regions through Treehouse Summit and the Great Dictionary Tree, with curriculum-specific Lessons 1–19.
P0–P17 engineering and the earlier physical tablet pilot are complete.
The next development phase is P18 release polish.

Production URLs:

- P2: `https://goatedapps.github.io/RPG-ChineseGame/game/?level=p2`
- P5: `https://goatedapps.github.io/RPG-ChineseGame/game/?level=p5`

## Design rules

1. Learning is the main action.
Attacks, defense, quests and unlocks depend on answering, reading or writing Chinese.
Coins may buy support items and equipment, but never answers, mastery stars or progression gates.

2. The interface and campaign dialogue are in English.
Storyteller chapters use the original Chinese curriculum stories without English translation.
Chinese also appears as learning content, examples, source passages and idioms.
Introduce story-specific Chinese with an English gloss.

3. Practice is spaced and forgiving.
One correct unassisted answer fills a vocabulary skill circle.
Gold words rest before review.
Wrong answers reveal the answer, example and available audio without penalties or shame.
Questions have no countdown timer.

4. Engagement is healthy.
The parent sets the daily battle cap, which defaults to 30 for fresh saves while preserving an existing custom cap.
Only the first three School sessions per day award coins, but later sessions still award XP.
The weekly streak has one automatic silent freeze.
Avoid paid randomness, hidden loot odds and guilt-based prompts.

5. One campaign supports many school levels.
A new level adds source curriculum, lesson mappings, feature flags and tuning.
It must not duplicate the engine or shared world.
Unsupported or sparse question categories remain optional.
Higher Chinese is disabled by default and can only be made available by a parent from the Parent Panel.

## Learning and battle rules

Each Word Spirit tracks Meaning, Pinyin, Hanzi, Usage and Writing.
Writing has Trace, Guided and From memory stages using local Hanzi Writer data.
Keep the four-miss help threshold.
Open written answers are completed by comparing with a model and self-rating; they are never required to be auto-marked correct.
Every open response offers “I don’t know.”

Battle questions show only the information needed by the selected attack.
Dictation hides the target Hanzi and shows only its meaning and pinyin.
Writing-from-memory and dictation offer “Show me how” without a duplicate give-up button.
Battle Hanzi-selection questions show the English meaning without pinyin.
The creature art stays sealed with `？` until the answer is submitted or the spirit is won.
Boss question queues use only self-contained standalone questions and never require an unseen passage.
Each regional boss is one level above the region's strongest standard creature, uses stat-scaled HP, attack and defence, and counterattacks while still standing.
Pinyin, meaning and examples appear in answer feedback.
The battle arena places the player at lower left and the creature at upper right.
Show exact HP and relevant attack, defense and evasion values.
Damage uses attacker stats, defender stats, move bonuses and a small random roll.
Creature levels and stats rise across Lesson 1, Lesson 2 and Lesson 3 areas.
Battle XP and coins scale with the creature’s level relative to the player, sharply reducing rewards from weaker creatures.
All three areas remain accessible from the start so difficulty, rather than a lock, guides progression.

The shop includes consumables, gear and lesson bait.
Lesson bait lets the player select the exact missing spirit to attract.
The Muddle Cave gate requires the configured percentage of distinct Bronze-or-better regional words plus the Cave Lantern.
Onward region progression uses Silver-or-better words; Gold is an optional mastery bonus.

## Region 1 gameplay

Scholar Village is the intentionally small tutorial town.
Its surrounding areas are Camping Forest, Misty Path, Kitchen Garden and Muddle Cave.
The map includes School, Reading Hall, Inn, Shop, Storyteller, quest villagers, lore villagers and wandering flavor villagers.
Tablet movement uses the D-pad over the play area.
The Next step banner rotates among incomplete tasks every 60 seconds.
Wild encounters are random, use a staged transition and play scene music and hit effects.

The Region 1 story begins automatically with Grandma Wang's welcome and includes the tutorial battle, Storyteller chapters, Xiaoqiang, Mr Lin and Chef Mei requests, rival duels, the Cave Lantern, the four-phase Muddle King battle, Dawn Stroke, the hidden grove and the next-region gate.
Storyteller chapters use a two-page illustrated book with page dictation controls.
Daily systems include the quest board, fixed chest rewards, Lantern Streak, weekly freeze and Mystery Scroll.
Collection systems include mastery tiers, partners, Restoration Sets, milestones, gear, crafting and the player room.
Parent tools include the PIN, goals, lesson-filtered multi-card gifting from the current region, weekly summary, save transfer, curriculum switching, region/test controls, speech speed and sound.

## Architecture

The app uses plain HTML, CSS and browser ES modules.
`game/index.html` is a small shell.
`src/main.js` loads a level package and wires the runtime.
`src/gameplay.js`, `src/adventure.js` and `src/collection.js` coordinate major flows.
`src/core/` owns state, saves, dates, events, safety and audio.
`src/content/` loads and merges curriculum, level configuration and campaign data.
`src/learning/` owns questions, mastery, selection, speech, pinyin and writing.
`src/battle/` owns combat math, creatures and creature art.
`src/systems/` owns independent progression systems.
`src/ui/` owns DOM overlays, questions, writing, HUD and toasts.
`src/world/` owns maps, movement, encounters, NPC movement and canvas rendering.

`content/source/<level>/` contains the source YAML and Markdown curriculum.
`content/generated/` contains normalized build output and local character data.
Never hand-edit generated files.
`content/authored/shared/` contains shared balance, items, gear, recipes, milestones, strings and tags.
`content/authored/levels/<level>/level.json` contains readiness, lesson mappings, features and tuning.
`content/authored/campaign/` contains shared maps, regions, story, daily quests and sets.

The frozen reference prototype is under `prototype/`.
Use it to resolve visual or behavioral parity questions, but implement changes in the modular game.
The completed annotated review is under `.lavish/`.

## Content pipeline

Run `npm run validate:content` for validation only.
Run `npm run build:content` to validate and regenerate normalized curriculum and Hanzi data.
Run `npm test` for the complete Node and JSDOM regression suite.

Validation must ensure referenced words exist, maps are rectangular and reachable, question answers are valid, required pools are large enough, lesson mappings do not overlap, and every vocabulary character has local stroke data.
Playable level configuration must enable only supported question types and rewards.

P5 has 17 lessons and 327 generated words.
P2 has 19 lessons and 460 generated words.
The existing P5 story 9 source has four pages while the campaign convention expects six; this is a known non-blocking build warning.

## Save, offline and accessibility requirements

The profile and each curriculum save use separate local-storage keys.
Encoded saves include a checksum for casual tamper detection, but this is not security.
Validate and migrate a save before replacing live state.
Keep a last-known-good backup.
Preserve corrupt, truncated, wrong-level and unsupported-future payloads for recovery.
Suspend autosave when recovery is blocked.
Starting fresh requires a second deliberate action.
Imports must validate their envelope and level before replacing progress.

The service worker caches both curricula, the shared Region 1 runtime, local Hanzi data and packaged audio after the first online load.
Cache version changes must reach updated module URLs and must not ignore URL search parameters.
Verify both online upgrade behavior and offline restart after service-worker changes.

Dialogs trap focus, restore focus on close and support Escape only when dismissible.
Controls must retain 44-pixel touch targets.
Status changes use live regions.
Reduced-motion mode disables gameplay animations.
Speech and scene audio stop when their activity ends or the document becomes hidden.

## Save and runtime pitfalls

- Deep-fill migrated saves from fresh state because missing nested fields can freeze later actions.
- Disable one-shot Continue buttons to prevent double taps.
- Ensure `[hidden]` wins over overlay display rules.
- Let mastery update accuracy once; do not also update it at callers.
- Normalize quiz results to `{ ok, ... }` instead of testing an object as a boolean.
- Reuse Hanzi Writer where possible and call `cancelQuiz()` before animation.
- Keep the writing grid at `touch-action: none`.
- Encode Chinese JSON as UTF-8 bytes before base64 conversion.
- Deduplicate question options and verify that the correct answer remains present.
- Strip bracketed Chinese exam instructions and provide an English instruction.
- Detect missing `zh-CN` speech voices and show one parent-facing setup tip.
- Stop read-aloud speech when the activity closes or when Stop is pressed.
- Never display a word’s pinyin or meaning before an attack question is answered.

## Completed phases

| Phase | Delivered |
|---|---|
| P0 | Content validation, normalized P2/P5 data and local Hanzi builds. |
| P1 | Modular shell, level picker, shared map, movement, interactions and isolated encoded saves. |
| P2 | Shared questions, mastery, selection, speech and three-stage writing lab. |
| P3 | Region 1 battles, School, Reading Hall, Inn, Shop, Spirit Book, energy and parent summary. |
| P4 | Consumables, equipment, materials, crafting, a unified Bag and the Hero Status screen. |
| P5 | Partners, Restoration Sets, milestones and player room. |
| P6 | Daily quests, chest, streak, freeze and Scroll Library. |
| P7 | Complete Region 1 story, requests, rival, gate, boss, fragment and hidden grove. |
| P8 | Parent goals, weekly summary, save transfer, controls and PIN changes. |
| Parity | Random encounters, audio, D-pad, rotating goals, wandering villagers, passage distribution, enemy spells, streak combat, rare variants and level-up presentation. |
| P9 | P2 Lessons 1–3 in the shared world with younger tuning, compatible story words and separate progress. |
| P10 engineering | Recovery, offline cache, accessibility, responsive checks and pilot checklist. |
| P11 | Harvest Crossing, regional travel saves, Lessons 4–6, five creatures, Doubt Serpent, Truth Stroke and Truth Terrace. |
| P12 | Tidewater Bay and Clock Tower, curriculum-specific Lessons 7–9, whale rescue, five creatures, Idle Clock, Current Stroke and Tide Vault. |
| P13 | Lantern Theatre and Farm Fields, curriculum-specific Lessons 9–12, performance and farming requests, five creatures, Mocking Mirror, Courage Stroke and Courage Loft. |
| P14 | Festival City, curriculum-specific Lessons 11–15, martial arts and celebration requests, five creatures, Grudge Dragon, Harmony Stroke and Harmony Pavilion. |
| P15 | Ancient Grove, curriculum-specific Lessons 13–17, archaeology and Hanzi-history requests, five creatures, Give-Up Ghost, Memory Stroke and Memory Vault. |
| P16 | Treehouse Summit and Great Dictionary Tree, curriculum-specific P2 Lessons 18–19 and P5 Lessons 16–17, final requests, five creatures, Great Forgetter, Final Stroke and Dictionary Heart. |
| P17 | Seven-region curriculum and boss-pool audit, late-level balance smoothing, twelve reviewed P5 final-lesson questions and Daily Quest Board polish. |

## Remaining roadmap

### P18 release polish

Run performance and accessibility checks on an older target iPad.
Proofread audio and content.
Verify offline restart, update behavior, save migration, export/import and curriculum switching.
Reach at least 90 Lighthouse accessibility on menu screens.
Produce the final distributable only after deciding whether double-click `file://` support still justifies a single-file bundle.

## Definition of done for every phase

- The phase has a reviewable playable build.
- Both curricula remain functional unless the phase is explicitly curriculum-specific.
- Content validation and all tests pass.
- Existing saves migrate without loss.
- Tablet controls, focus, sound and offline behavior are checked when affected.
- Permanent behavior receives focused regression coverage.
- Durable architecture or product changes are reflected briefly in `AGENTS.md`, this file and `PILOT.md` when relevant.
