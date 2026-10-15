# P3 game integration audit

P3 is enabled in the local app with 17 lessons, 399 vocabulary records, 540 handwriting characters and all seven campaign regions.
Open the app with `?level=p3` or choose Primary 3 in the curriculum picker.
The question bank contains 914 standalone questions and 298 passage questions in 76 groups: 1,212 questions altogether.
Higher Chinese stays disabled until a parent enables it.

## Integration checks and repairs

- Mapped Lessons 1–3, 4–6, 7–8, 9–10, 11–12, 13–15 and 16–17 to Regions 1–7.
- Bound the tutorial, neighbour requests and Restoration Sets to P3 words.
- Verified ten different ordinary Chinese standalone boss questions and two writing prompts in each region, with every mapped lesson represented.
- Verified the default 15-word gate tests, chapter dictation word counts, usable sentence banks and offline strokes.
- Adapted 70 lesson-linked vocabulary questions to four choices, retaining each original answer and storing the exam choices in `originalOptions`.
  Three-choice questions gained a distractor; larger shared banks became standalone four-choice questions.
  These game adaptations should receive a parent language review before release.
- Fixed shared-bank loading for 54 cloze and five dialogue questions that otherwise had no playable choices.
- Preserved explicit target-word links so matching authored vocabulary and usage questions can be selected in battles.
- Tuned route encounters for the larger P3 word pools and added the curriculum to offline installation through the shared registry.

## Heavy Slam Usage coverage

Added 387 standalone ordinary Chinese usage questions, preserving the 12 existing ordinary Chinese usage questions.
Every one of the 399 lesson vocabulary entries now has a dedicated Usage question that Heavy Slam selects before vocab questions or generated practice.
Repeated words have separate questions for their lessons.
The 10 user-approved samples are preserved unchanged; the remaining 377 new questions are authored additions and have not been parent-reviewed.
See [all new questions and answers](authored-usage.md).
The 419 total usage records include 399 ordinary Chinese questions and 20 optional Higher Chinese questions.

## Additional questions to prioritise

No additional questions are required to make the campaign completable.
The existing boss fallback uses regional standalone questions, and vocabulary data supplies meaning, pinyin, Hanzi, usage and writing practice.
The following additions would improve the variety and lesson coverage of authored questions.

1. **Sentence completion:** zero questions are supplied, so this category remains disabled.
   Add four-choice, standalone questions with explicit lesson IDs if this activity should appear.
2. **Ordinary Chinese pinyin:** Lessons 1, 3, 6 and 10 have none.
   Two to four questions per missing lesson would be a useful starting point.
   Higher Chinese supplies one each for Lessons 1, 3 and 6, but those are unavailable by default.
3. **Conjunctions:** only two standalone questions exist and both have empty lesson tags.
   They are excluded from regional School and boss pools.
   Add lesson tags only where justified by the curriculum and supply more questions for wider coverage.

The Reading Hall has 28 ordinary Chinese comprehension groups, two cloze groups and one practical-reading group, plus 45 optional Higher Chinese groups.
There is no reading-key shortage.
All passage questions were checked for answer choices or a usable answer/model.
Thirteen source questions remain omitted for unreadable scans, as recorded in the import summary.

## Ordinary Chinese lesson coverage

Counts exclude Higher Chinese and untagged exam questions.
“Battle targets” counts lesson vocabulary records with at least one matching authored vocab/usage question.

| Lesson | Words | Vocab | Pinyin | Usage | Phrase | Battle targets |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 25 | 6 | 0 | 25 | 0 | 25 |
| 2 | 25 | 9 | 2 | 25 | 2 | 25 |
| 3 | 25 | 12 | 0 | 25 | 0 | 25 |
| 4 | 28 | 11 | 2 | 28 | 1 | 28 |
| 5 | 21 | 12 | 2 | 21 | 1 | 21 |
| 6 | 25 | 11 | 0 | 25 | 0 | 25 |
| 7 | 22 | 10 | 2 | 22 | 2 | 22 |
| 8 | 27 | 9 | 2 | 27 | 2 | 27 |
| 9 | 24 | 11 | 4 | 24 | 2 | 24 |
| 10 | 24 | 13 | 0 | 24 | 0 | 24 |
| 11 | 22 | 13 | 3 | 22 | 2 | 22 |
| 12 | 21 | 12 | 3 | 21 | 1 | 21 |
| 13 | 23 | 10 | 1 | 23 | 1 | 23 |
| 14 | 24 | 11 | 4 | 24 | 2 | 24 |
| 15 | 22 | 16 | 2 | 22 | 1 | 22 |
| 16 | 20 | 10 | 4 | 20 | 3 | 20 |
| 17 | 21 | 11 | 3 | 21 | 2 | 21 |

## Story presentation

Thirteen stories have four or five pages instead of the preferred six.
These are build warnings rather than blocked content; the original Chinese text and page divisions are preserved.
No replacement story text was added.

## Verification

`npm run check:curricula` passed: content validation reported zero errors and all 298 regression tests passed.
The 26 page-count warnings include 13 for P3 and 13 already present in P5/P6.
An HTTP browser smoke check loaded a fresh P3 save and all seven P3 walkthrough pages, confirming lesson labels and regional gate counts without console errors.
