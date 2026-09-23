# Word Spirit Quest

Word Spirit Quest is a tablet-friendly exploration RPG for learning primary-school Chinese.
The current playable reference is the Primary 5 Region 1 prototype under `prototype/`.
The modular rebuild is being developed alongside it.

## Run the reference prototype

Serve the repository with any static HTTP server and open `prototype/`.
The published reference remains available through GitHub Pages while the rebuild reaches parity.

The current modular engine preview is served from `game/`.
It covers shared-world loading, movement, interactions, isolated saves and the reusable Learning Core.
The content lab at `game/lab.html` runs P2 and P5 questions, speech and local handwriting tasks against real curriculum data.
On GitHub Pages it is available at `/RPG-ChineseGame/game/`; the main project URL continues to open the stable prototype.

## Build curriculum content

Install the development dependencies, then build both school-level packs.

```sh
npm install
npm run build:content
```

The build validates every folder under `content/source/`, writes normalized curriculum JSON to `content/generated/`, and extracts only the required Hanzi Writer stroke data.
P2 and P5 share the same seven-region world, cast, quests, bosses and main storyline.
Each level supplies its own lesson mapping, supported question types and tuning under `content/authored/levels/`.

## Test

```sh
npm test
```

The test suite covers the playable prototype, generated multi-level content, modular engine and Learning Core.

## Project references

- `gameplan.md` is the full product and technical specification.
- `AGENTS.md` is the concise working guide for contributors and coding agents.
- `.lavish/next-stage-plan.html` records the approved rebuild sequence.
