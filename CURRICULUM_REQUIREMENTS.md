# Curriculum requirements

Use this checklist before adding a curriculum to the playable level registry.
The shared engine and seven-region campaign stay the same; each curriculum supplies its own source pack, lesson mapping, question pools, and Restoration Sets.
Alert the user if content / questions provided do not meet requirements needed for the game (e.g. insufficient lessons, questions in a particular category is not supplied)

## Source pack

- Give the level a stable lowercase ID and display label in `content/source/<id>/meta.yaml` and `content/authored/levels/<id>/level.json`.
- Provide `tingxie/index.yaml`, one `tingxie/<lesson>.yaml` file, and one original Chinese `stories/<lesson>.md` file for every lesson numbered from 1 through `lessonCount`.
- Give every vocabulary entry a Hanzi word, Hanyu Pinyin, English meaning, example sentence, and a nonempty sentence bank containing a usable target-word sentence.
- Keep stories in the original Chinese and mark their pages with `## Page N`; do not add English translations to the Storyteller.
- Check that each lesson has enough distinct vocabulary for encounters and that local Hanzi stroke data builds for every required character.
- Repeated Hanzi may occur across lessons, but they represent one Word Spirit and count only once for a regional boss gate or gate dictation.

## Questions and reading

- Author standalone Chinese questions with stable unique IDs and explicit `lessonIds` for every question intended for School, battle Usage, or a regional boss.
- Supply usable `vocab`, `pinyin`, and `usage` questions for the relevant lessons; list every enabled question kind in `coreQuestionKinds` or `optionalQuestionKinds` only when its source file contains playable records.
- Give lesson-bound standalone multiple-choice questions four distinct options with exactly one correct answer among them.
- Keep every boss question independent of an unseen passage; each region needs ten distinct eligible standalone questions plus two regional writing prompts, and its boss pool must represent every mapped lesson.
- Provide ordinary Chinese reading passage groups with answerable questions for the Reading Hall and its reading key; Higher Chinese groups are optional and remain parent-controlled.
- Keep passage-dependent questions inside their passage groups, with a valid answer or accepted fill-in response for every question.
- Give pinyin choices distinct spellings or tones; duplicate options make a question unfair even when the correct answer appears twice.

## Seven-region mapping

- Map every lesson exactly once in `regionLessons`, across `r1` through `r7`, in story order.
- Give Region 1 exactly three lessons and each later region at least two, unless a shorter curriculum explicitly lists single-lesson later regions in `singleLessonRegions`.
  Single-lesson regions must still meet every word, boss-question, chapter-task and default 15-word gate requirement.
- Check each route zone, neighbour request, and chapter task against the region's lesson slots; a slot beyond the mapped lesson count intentionally uses that region's last lesson.
- Keep chapter dictation groups large enough for separate three-word tests when tasks share a lesson.
- Add curriculum-specific Restoration Sets in every region; each set needs an ID, name, restoration reward, and at least three distinct words from that region's mapped lessons.
- Bind Region 1 tutorial words and neighbour requests to words in that curriculum so Jun's guide, My Room, and the optional requests remain reachable.

## Release gate

1. Add the level to `content/authored/shared/levels.json` only when the source and world mapping are ready.
2. Run `npm run build:content` and resolve all validation errors before using generated files.
3. Run `npm run check:curricula` to verify all seven boss pools, region gates, save isolation, and the complete test suite.
4. Review the code-rendered walkthrough for every region and selected curriculum, including lesson labels and chapter clues.
5. Bump the service-worker cache version when changed source, runtime, or walkthrough files must reach installed and offline players.

`content/generated/` is build output and must not be edited by hand.
