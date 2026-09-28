# Word Spirit Quest

Word Spirit Quest is a tablet-friendly Chinese vocabulary RPG set across seven shared story regions.
Primary 2 and Primary 5 use the same world and engine with separate curriculum content and saves.

## Play locally

Serve this repository over HTTP and open its root URL, such as `http://127.0.0.1:4173/?level=p5`.
The homepage is `index.html`; the old `game/` address redirects to it for existing bookmarks.
The separate player walkthrough starts at `walkthrough/index.html` and is also linked from Parent Mode.

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

The test suite covers generated multi-level content, the shared game engine, seven-region progression and collection systems.

## Project references

- `gameplan.md` is the full product and technical specification.
- `AGENTS.md` is the concise working guide for contributors and coding agents.
