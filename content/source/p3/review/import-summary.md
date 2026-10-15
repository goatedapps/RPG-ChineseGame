# P3 question bank — all-paper review

All 35 supplied PDFs have been processed.
The exam papers contribute **691 questions**, including the 20 questions from the approved first paper.
The remaining 34 PDFs contribute 671 questions.
An initial **134 original vocabulary questions** brought the imported bank to **825 questions**.
The RPG adds **387 standalone Usage questions**, bringing the complete P3 bank to **1,212 questions**; see the [authored Usage review](authored-usage.md).
All 17 lessons now have at least 20 distinct Vocabulary questions; see the [lesson coverage review](vocabulary-coverage.md).
P3 is selectable in the app, with all 1,212 questions and 17 Tingxie lessons connected.

## Included content

| Category | Questions |
| --- | ---: |
| 汉语拼音 (pinyin) | 46 |
| 词语运用 (vocab) | 425 |
| 词语释义 (phrase) | 22 |
| 正确运用选择 (usage) | 419 |
| 关联词 (conjunction) | 2 |
| 句子填空 (sentence) | 0 |
| 完形填空 (cloze) | 54 |
| 改错 (errorcorrect) | 40 |
| 阅读理解 (comprehension) | 187 |
| 完成对话 (dialogue) | 5 |
| 应用文阅读 (practical) | 12 |

Each paper review below contains the passages, question text, original choices, answers, PDF page references and exclusions.
The question files are stored in [questions](../questions/).

## Exclusions

Picture-dependent questions, picture composition and listening sections are excluded.
Unsupported formats are also excluded: sentence rewriting, expansion, combining and creation; paragraph and word ordering; line matching; writing Chinese from pinyin; writing pinyin; stroke-order tasks; and table completion.
No replacement exam question stems or answers have been invented.
The RPG integration adapts 70 lesson-linked vocabulary choice lists to four options and preserves the exam choices in `originalOptions`; see the [game integration audit](game-integration.md).

## Questions held for clearer scans

**13 questions** are omitted because the supplied scans do not allow reliable transcription.

| Paper | Questions | Reason |
| --- | --- | --- |
| Henry Park SA2 | Q1–4 | Choices obscured by overprinting |
| Henry Park SA2 | Q10–14 | Shared word bank obscured by overprinting |
| Henry Park SA2 | Q28–30 | Reading passage has unreadable wording |
| Rosyth SA2 | Q6 | Wording obscured by overprinting |

## Source conventions

Source filenames and original question numbers are preserved.
The Catholic WA3 filename contains CHIJ St Nicholas Higher Chinese revisions（三）and（四）.
Tao Nan WA3 also contains two exercises.
Both PDFs use S3/S4 in their record IDs to distinguish repeated question numbers.
Other cover/filename discrepancies are recorded in the individual reviews.
Intentionally incorrect characters remain in error-correction questions.
Shared vocabulary banks are repeated in full to match the existing standalone MCQ format.
Original multi-part written answers use the existing self-check format.
Vocabulary questions are tagged to lessons using their tested target word and the supplied P3 vocabulary.
Questions whose target word is outside the lesson lists retain empty lesson tags.
The [new-question review](authored-vocabulary.md) lists all original additions separately from the exam papers.

Flat questions retain their original subject in sourceSubject and their printed marks in sourceMarks.
P3 flat exam questions also supply runtime subject and marks fields, so practice uses the original paper subject and printed marks.
Where individual marks are absent in the PDF, sourceMarks is omitted and passage questions use the parser’s existing 2-mark default.
The question index is generated using the same parser as the app, including the P3 subject overrides.
Lesson totals combine Chinese and Higher Chinese; choosing one subject narrows the available questions.

## Paper reviews

| Source PDF | Included questions | Review |
| --- | ---: | --- |
| P3_Chinese_2025_SA2_acs.pdf | 20 | [Open review](acs-2025-sa2.md) |
| P3_Chinese_2025_SA2_acsjunior.pdf | 20 | [Open review](SA2_acsjunior.md) |
| P3_Chinese_2025_SA2_aitong.pdf | 15 | [Open review](SA2_aitong.md) |
| P3_Chinese_2025_SA2_chij.pdf | 31 | [Open review](SA2_chij.md) |
| P3_Chinese_2025_SA2_henrypark.pdf | 8 | [Open review](SA2_henrypark.md) |
| P3_Chinese_2025_SA2_mahabodhi.pdf | 19 | [Open review](SA2_mahabodhi.md) |
| P3_Chinese_2025_SA2_methodist.pdf | 26 | [Open review](SA2_methodist.md) |
| P3_Chinese_2025_SA2_nanhua.pdf | 23 | [Open review](SA2_nanhua.md) |
| P3_Chinese_2025_SA2_nanyang.pdf | 27 | [Open review](SA2_nanyang.md) |
| P3_Chinese_2025_SA2_northland.pdf | 20 | [Open review](SA2_northland.md) |
| P3_Chinese_2025_SA2_raffles.pdf | 20 | [Open review](SA2_raffles.md) |
| P3_Chinese_2025_SA2_rosyth.pdf | 19 | [Open review](SA2_rosyth.md) |
| P3_Chinese_2025_SA2_sthildas.pdf | 20 | [Open review](SA2_sthildas.md) |
| P3_Chinese_2025_SA2_taonan.pdf | 29 | [Open review](SA2_taonan.md) |
| P3_Chinese_2025_WA1_acsprimary.pdf | 12 | [Open review](WA1_acsprimary.md) |
| P3_Chinese_2025_WA1_aitong.pdf | 13 | [Open review](WA1_aitong.md) |
| P3_Chinese_2025_WA1_chij.pdf | 17 | [Open review](WA1_chij.md) |
| P3_Chinese_2025_WA1_henrypark.pdf | 14 | [Open review](WA1_henrypark.md) |
| P3_Chinese_2025_WA1_nanyang.pdf | 24 | [Open review](WA1_nanyang.md) |
| P3_Chinese_2025_WA1_rosyth.pdf | 13 | [Open review](WA1_rosyth.md) |
| P3_Chinese_2025_WA1_taonan.pdf | 29 | [Open review](WA1_taonan.md) |
| P3_Chinese_2025_WA2_catholic.pdf | 24 | [Open review](WA2_catholic.md) |
| P3_Chinese_2025_WA2_chij.pdf | 17 | [Open review](WA2_chij.md) |
| P3_Chinese_2025_WA2_henrypark.pdf | 14 | [Open review](WA2_henrypark.md) |
| P3_Chinese_2025_WA2_mahabodhi.pdf | 17 | [Open review](WA2_mahabodhi.md) |
| P3_Chinese_2025_WA2_methodist.pdf | 15 | [Open review](WA2_methodist.md) |
| P3_Chinese_2025_WA2_nanhua.pdf | 14 | [Open review](WA2_nanhua.md) |
| P3_Chinese_2025_WA2_peihwa.pdf | 10 | [Open review](WA2_peihwa.md) |
| P3_Chinese_2025_WA2_raffles.pdf | 10 | [Open review](WA2_raffles.md) |
| P3_Chinese_2025_WA2_rosyth.pdf | 13 | [Open review](WA2_rosyth.md) |
| P3_Chinese_2025_WA2_sthildas.pdf | 3 | [Open review](WA2_sthildas.md) |
| P3_Chinese_2025_WA2_taonan.pdf | 29 | [Open review](WA2_taonan.md) |
| P3_Chinese_2025_WA3_catholic.pdf | 34 | [Open review](WA3_catholic.md) |
| P3_Chinese_2025_WA3_henrypark.pdf | 14 | [Open review](WA3_henrypark.md) |
| P3_Chinese_2025_WA3_taonan.pdf | 58 | [Open review](WA3_taonan.md) |

The [import manifest](import-manifest.yaml) lists every source paper, included question ID, exclusion and source note.
