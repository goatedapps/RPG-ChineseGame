# Word Spirit Quest

The current playable game starts at `prototype/index.html`; styles, game logic, generated audio, curriculum data, character data, and the Hanzi Writer vendor build live in separate files under `prototype/`.
Keep the external vocabulary and Hanzi Writer character data intact when changing prototype logic.
Run `npm test` for the prototype's DOM and save/progression regression checks.

## Approved review decisions

Keep the four-miss handwriting help threshold, current self-marking rewards and continuing school XP.
Gates use percentages of distinct regional vocabulary; Higher Chinese reading is opt-in.
Preserve old saves through validated migrations and recovery rather than resetting invalid data automatically.
The intended session is 30–60 minutes, with numeric XP and a shared level-up celebration.
All three lesson areas are open from the start, with sharply increasing creature difficulty guiding progression.
Tablet movement uses an in-map directional pad, and the shop offers targeted bait for each unlocked lesson.
The Lavish review and pre-feedback plan snapshot are in `.lavish/`.
Never end an active annotation session until the user finishes or requests it.
