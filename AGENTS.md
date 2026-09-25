# Word Spirit Quest

## Start here

The deployed app is the modular game under `game/`.
Primary 2 and Primary 5 share Regions 1–4 and keep separate saves.
P0–P13 and the physical child-and-parent tablet pilot are complete.
The next development phase is P14 Festival City.
Read `gameplan.md` for product rules, architecture and the remaining roadmap.
Use `prototype/` only as the frozen visual and behavioral reference when parity is unclear.

Production URLs:

- P2: `https://goatedapps.github.io/RPG-ChineseGame/game/?level=p2`
- P5: `https://goatedapps.github.io/RPG-ChineseGame/game/?level=p5`

## Repository map

- `game/index.html` is the playable shell.
- `src/` contains the ES-module runtime.
- `css/` contains the modular visual system.
- `content/source/<level>/` contains curriculum source material.
- `content/generated/` is build output and must not be hand-edited.
- `content/authored/shared/` contains shared rules and tuning.
- `content/authored/levels/` contains curriculum configuration and mappings.
- `content/authored/campaign/` contains the shared world, story, quests and sets.
- `assets/audio/` contains packaged music and effects.
- `tests/` contains regression coverage.
- `prototype/` is the frozen reference implementation.
- `.lavish/` contains the completed annotated review.

## Product invariants

- Keep one shared engine, world and campaign with separate curriculum packs and saves.
- Keep the illustrated, typewriter-paced startup prologue skippable until testing approves mandatory playback.
- Keep English for interface and campaign dialogue; present Storyteller chapters from the original Chinese curriculum stories without English translation.
- Keep Meaning, Pinyin, Hanzi, Usage and Writing as the five vocabulary skills.
- Keep the four-miss handwriting help threshold; one correct unassisted answer fills a skill circle.
- Keep Higher Chinese disabled by default and make its Reading Hall availability parent-controlled.
- Keep School XP after the first three rewarded daily runs.
- Keep the parent battle cap and the intended 30–60 minute session without a mandatory timer.
- Keep fresh saves at the 30-battle daily default while preserving a parent's saved custom cap.
- Keep stat-based combat with visible HP, attack, defense and evasion.
- Keep the Muddle King challenge visually framed as a boss battle, including its question and writing phases.
- Set each regional boss one level above that region's strongest standard creature and let it counterattack until defeated.
- Use only standalone questions in boss battles; never use questions that depend on an unseen passage.
- Keep battle vocabulary sealed until the child answers; reveal pinyin and meaning in feedback.
- Keep writing-from-memory prompts free of the target Hanzi; show only meaning, Hanyu Pinyin and a blanked example sentence.
- For writing-from-memory and dictation, offer “Show me how” without a redundant “I don’t know” action.
- Hide target Hanzi during dictation, and omit pinyin from battle Hanzi-selection prompts.
- Keep all three Region 1 lesson areas open, with difficulty guiding the intended order.
- Keep exact-word lesson bait in the shop.
- Keep battle boosts consumable in battle and forest repellent active only while walking through encounter grass.
- Keep the percentage-based Bronze Muddle Cave gate plus Cave Lantern requirement, and use Silver rather than Gold for onward region progression.
- Preserve old saves through validated migrations, last-known-good recovery and explicit fresh-start confirmation.
- Never silently discard an invalid or future-version save.
- Store the changeable parent PIN as a salted code rather than plain text.
- Avoid timers, guilt messages, paid randomness and purchasable learning progress.

## Engineering rules

- Prefer authored JSON for editable text, maps, prices, encounters and balance values.
- Keep curriculum source separate from shared campaign data.
- Keep learning, combat and progression logic pure or state-only where practical.
- Keep DOM and canvas work in UI and world-rendering modules.
- Add migrations for save-shape changes.
- Preserve local Hanzi data and the vendored Hanzi Writer runtime.
- Keep touch targets at least 44 pixels and support reduced motion.
- Stop speech and scene audio when leaving their activity.
- Do not reveal an answer elsewhere on an active question screen.
- Do not end an active Lavish annotation session until the user finishes or explicitly requests it.

## Workflow

- Run `npm run build:content` after curriculum or authored-content changes.
- Run `npm test` after behavior, content wiring, progression or save changes.
- Add focused regression coverage for permanent systems and reported failures.
- Test through HTTP because ES modules and content loading do not work from `file://`.
- Use `?debug=1` to expose the Learning Lab and build-status controls.
- Update `gameplan.md`, `PILOT.md` and this file only when their durable facts change.
- Keep this file below 120 lines and remove stale guidance instead of appending history.
- For long Markdown edits, place each full sentence on its own physical line.
- Prefer quality, simplicity, robustness and maintainability over short-term development cost.
