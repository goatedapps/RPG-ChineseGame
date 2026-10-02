# Word Spirit Quest

## Start here

The deployed app opens from the repository root `index.html`.
Each playable curriculum in the level registry shares Regions 1–7 and keeps a separate save for each named local player.
P0–P17 engineering and the earlier physical child-and-parent tablet pilot are complete.
P18 release polish is in progress; browser smoke checks and local Lighthouse accessibility passed, while older-iPad verification remains outstanding.
Fresh saves have a two-part Apprentice Jun tutorial after Grandma Wang: five village steps summon his typed, closable guide dialogue, then six first-day actions and a level-3 return; existing saves are not retroactively enrolled.
Read `gameplan.md` for product rules, architecture and the remaining roadmap.
Read `CURRICULUM_REQUIREMENTS.md` before adding or changing a playable curriculum or its lesson content.

Production URLs:

- P2: `https://goatedapps.github.io/RPG-ChineseGame/?level=p2`
- P5: `https://goatedapps.github.io/RPG-ChineseGame/?level=p5`

## Repository map

- `index.html` is the playable shell; `game/` redirects old bookmarks.
- `walkthrough/index.html` introduces the separate seven-region walkthrough linked from Parent Mode.
- `src/` contains the ES-module runtime.
- `css/` contains the modular visual system.
- `content/source/<level>/` contains curriculum source material.
- `content/generated/` is build output and must not be hand-edited.
- `content/authored/shared/` contains shared rules and tuning.
- `content/authored/levels/` contains curriculum configuration and mappings.
- `content/authored/campaign/` contains the shared world, story, quests and sets.
- `assets/audio/` contains packaged music and effects.
- `tests/` contains regression coverage.
- `src/systems/ending.js` owns the post-game portal and optional-discovery ledger; `src/ui/ending.js` presents the finale.

## Product invariants

- Keep one shared engine, world and campaign with separate curriculum packs and saves.
- Keep the illustrated, typewriter-paced startup prologue skippable as a permanent feature.
- Keep the child tutorial one-time and action-gated, with a confirmed Parent Mode skip; preserve its exact step across saves.
- Keep Jun's teaching in short green conversations with visible arrow handoffs and a completion comment before each new action.
- Keep English for interface and campaign dialogue; present Storyteller chapters from the original Chinese curriculum stories without English translation.
- Keep Meaning, Pinyin, Hanzi, Usage and Writing as the five vocabulary skills.
- Keep the four-miss handwriting help threshold; one correct unassisted answer fills a skill circle.
- Keep Higher Chinese disabled by default and make its Reading Hall availability parent-controlled.
- Keep School XP after the first three rewarded daily runs.
- Keep School Quiz and Exam Day questions within the current region, and prefer matching vetted vocabulary or usage questions for battle Usage.
- Keep the parent battle cap and the intended 30–60 minute session without a mandatory timer.
- Keep fog-route entry closed at zero remaining battles and return the player to the Inn after the final allowed battle.
- Keep fresh saves at the 30-battle daily default while preserving a parent's saved custom cap.
- Keep stat-based combat with visible HP, attack, defense and evasion.
- Keep the Muddle King challenge visually framed as a boss battle, including its question and writing phases.
- Keep Tidewater Bay's three collected-word rescue dictations, Keeper Lan's clue comparison, and the post-boss whale rescue distinct from optional neighbour requests.
- Keep Lantern Theatre's three cue dictations, earlier-region revision journey through Scholar Village, rehearsal and post-boss performance distinct from optional requests.
- Keep Ancient Grove's three evidence dictations, Curator Wen's evidence board and post-boss account display distinct from optional requests.
- Keep the Great Forgetter's finishing strike and story ending full-screen, followed by auto-rolling credits with a reduced-motion alternative.
- Set each regional boss one level above that region's strongest standard creature and let it counterattack until defeated.
- Use only standalone questions in boss battles; never use questions that depend on an unseen passage.
- Keep battle vocabulary sealed until the child answers; reveal pinyin and meaning in feedback.
- Keep sidebar panels from replacing live battles or other locked activities.
- Use target-word tone variants as Sound Blast pinyin distractors before unrelated words.
- Keep writing-from-memory prompts free of the target Hanzi; show only meaning, Hanyu Pinyin and a blanked example sentence.
- For writing-from-memory and dictation, offer “Show me how” without a redundant “I don’t know” action.
- Hide target Hanzi during dictation, and omit pinyin from battle Hanzi-selection prompts.
- Keep every regional lesson area open, with difficulty and the Journal guiding a suggested route.
- Keep exact-word lesson bait in the shop.
- Keep battle boosts consumable in battle; Forest Repellent blocks encounters, while Scholar's Lantern filters Silver/Gold spirits for 40 encounter-grass steps.
- Require 80% Bronze-or-better regional spirits plus the reading key for each boss, then a parent-configurable from-memory dictation pass to reach the next region.
- Preserve old saves through validated migrations, last-known-good recovery and explicit fresh-start confirmation.
- Keep legacy curriculum saves under the selectable Player 1 profile; scope new saves and recovery copies to the selected player.
- Never silently discard an invalid or future-version save.
- Default the changeable parent PIN to 0000, migrate the former default, and store it as a salted code rather than plain text.
- Avoid timers, guilt messages, paid randomness and purchasable learning progress.

## Engineering rules

- Prefer authored JSON for editable text, maps, prices, encounters and balance values.
- Keep curriculum source separate from shared campaign data.
- Keep learning, combat and progression logic pure or state-only where practical.
- Keep DOM and canvas work in UI and world-rendering modules.
- Add migrations for save-shape changes.
- Preserve local Hanzi data and the vendored Hanzi Writer runtime.
- Keep runtime illustration assets sized for their displayed use, and update image references, offline cache and asset tests together.
- Keep the Scholar Atlas shell consistent from curriculum selection through all seven regions, and reuse illustrated buildings and terrain detail across safe villages.
- Keep village signs and guide dialogue aligned with the routes; all seven villages are safe, including Treehouse Summit.
- Keep Parent Mode actions in place with a clear confirmation instead of resetting its scroll position.
- Keep the Spirit Book, Bag, Daily Board and equipment art lightweight and available offline.
- Reuse the Atlas panel treatment across navigation and building windows, and use the shared building/gate sprites on both towns and fog routes.
- Reuse the same optimized Word Spirit emblem for the game header, favicon and install icons.
- Use compact, full-body character sprites across villages and keep villagers dispersed near reachable buildings and paths.
- Six roughly double-area inter-town routes and one final summit trail carry encounters, persistent fog and a boss pavilion; only inter-town routes have onward gates.
- Keep a compatibility gate coordinate on the terminal route for older cached clients, but never render an onward gate there.
- Tune normal full-route exploration to sample about two thirds of regional spirits, and verify P2 and P5 pacing in route tests.
- Keep route discovery, gate-opening flags and saved on-route positions persistent; entering from a village starts at that route's entrance.
- After the Dictionary Heart, return to Scholar Village and keep Word Portals in all villages available for optional discoveries.
- Keep touch targets at least 44 pixels and support reduced motion.
- Stop speech and scene audio when leaving their activity, and pause music while the page is hidden.
- Keep character dialogue typewriter-paced, with the first Next press revealing the line and reduced-motion users seeing it immediately.
- Play question feedback audio when the result appears and the earn cue when gameplay awards XP or coins.
- Do not reveal an answer elsewhere on an active question screen.
- A villager's passage question clears only after a correct answer; answer review or “I don’t know” leaves its question mark available.

## Workflow

- Run `npm run build:content` after curriculum or authored-content changes.
- Register a playable curriculum in `levels.json`, then run `npm run check:curricula`; the validator and readiness tests must cover its regional gates and boss pools.
- Run `npm test` after behavior, content wiring, progression or save changes.
- Add focused regression coverage for permanent systems and reported failures.
- Test through HTTP because ES modules and content loading do not work from `file://`.
- Use `?debug=1` to expose the Learning Lab and build-status controls.
- Update `gameplan.md`, `PILOT.md` and this file only when their durable facts change.
- Keep this file below 120 lines and remove stale guidance instead of appending history.
- For long Markdown edits, place each full sentence on its own physical line.
- Prefer quality, simplicity, robustness and maintainability over short-term development cost.
