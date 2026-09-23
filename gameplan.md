# Word Spirit Quest (字灵) — Game Plan

A Pokémon-style exploration RPG that teaches primary-school Chinese vocabulary and reading: meaning, pinyin, characters (hanzi), usage, writing and comprehension.
It supports several school **levels** as curriculum variants of the same world and storyline.
Primary 5 has the reference prototype and detailed campaign specification; Primary 2 source content is also present and will be the first proof that the rebuilt engine is level-independent.
This document is the full specification for building the game.
It is written so that a coding agent (Claude Code, Codex, etc.) can build it from scratch in a fresh repository without having seen the design conversation.

**Status:** a working P5 Region 1 prototype exists at `prototype/index.html`, and rebuild phases P0–P2 are complete under `game/`.
It already includes the level picker, encoded saves, the Reading Hall passage quests and the weekly Exam Day described below.
Treat it as a frozen reference for look and feel and for the already-tested writing and battle logic.
P2 and P5 source packs now live in `content/source/` and pass the structural validator.
The next development stage is the properly structured shared-engine rebuild described in sections 14–20.

---

## 0. How to use this document

- Sections 1–3 explain *what* the game is and the rules that must not be broken.
- Sections 4–12 specify every game system (battle, mastery, items, story, and so on).
- Section 13 is the storyline and region-by-region content plan.
- Sections 14–19 cover the technical architecture: file layout, data schemas, save format, build and tests.
- Section 20 is the build order, broken into phases, each with acceptance criteria.
- Section 21 is a list of known pitfalls found while building the prototype.
- Appendix A has a ready-to-paste kickoff prompt for a coding agent.

When this document and the prototype disagree, **this document wins**.

---

## 1. Vision and audience

- **Player:** a primary-school student (for P5, about 11 years old) in Singapore whose first language is English. They are learning Chinese as a school subject, with weekly 听写 (tingxie, spelling tests) and exam papers.
- **Parent:** sets limits, checks progress and sets real-world goals.
- **Core promise:** "Every monster is a word. Beat it by *knowing* the word." Exploring, collecting and the story are the wrapper; every meaningful action in the game is a learning action.
- **Session shape:** 30–60 minutes a day, most days of the week.
  This is an intended session range, not a required minimum or a countdown.
  Preserve the parent-controlled battle cap, the first-three-school-session coin limit, continuing school XP and current Reading Hall rewards.
  Do not add a shared progression-reward budget.

### Design pillars

1. **Learning is the verb.** Attacks, defence, spells, quests and unlocks are all powered by answering or writing Chinese. Nothing that counts as learning can be bought with coins.
2. **English world, Chinese learning.** All UI, menus, dialogue, story and instructions are in **English**. Chinese appears only where it is the thing being learned: vocabulary, example sentences, exam questions, story pages and idioms (shown with an English gloss).
3. **Spaced, not crammed.** Stars need correct answers on *different days*. Daily battle limits and resting Gold words stop grinding.
4. **Always fair, never shaming.** Wrong answers teach (show the answer, example and audio). Fainting costs nothing. Streaks have automatic forgiveness. No timers.
5. **Every item and villager has a job.** No decorative-only systems. Cosmetics are rewards for achievement, not the main use of coins.
6. **Built on real school content, one level at a time.** Each level (P2, P5 …) is a content pack built from that level's YAML folder.
   The engine, seven-region world, villagers, quests, bosses and main storyline are shared.
   A new level adds curriculum data and a small mapping/configuration file, not another world.

### Healthy-engagement rules (hard requirements)

- No random paid or random "loot box" rewards. Chests have fixed, visible contents or a small fixed pool shown in advance.
- No countdown timers on questions.
- Streaks: celebrate at milestones only; one automatic free miss per week; never use guilt messages.
- Rewards are phrased as feedback ("You wrote it all by yourself!"), not pressure ("Don't lose your streak!").
- Daily play cap is set by the parent (default 15 creature battles). After the cap, gentle, non-battle activities remain (stories, Spirit Book, writing practice).

---

## 2. Content source (existing data)

Each level's content lives in its own folder, for example `p5/`, copied into `content/source/<level>/` in the new repo. Every level uses the same YAML format, described here using P5 as the example.

```
p5/
  meta.yaml                  # label: Primary 5, lessonCount: 17
  tingxie/index.yaml         # list of {id, title}
  tingxie/1.yaml … 17.yaml   # per-lesson vocabulary
  stories/index.yaml
  stories/1.md … 17.md       # short 6-page stories using that lesson's words
  questions/index.yaml       # index of question groups
  questions/vocab.yaml       # choose the right character/word for a blank
  questions/pinyin.yaml      # choose pinyin of an underlined word
  questions/usage.yaml       # choose the sentence that uses a word correctly
  questions/phrase.yaml      # choose meaning closest to an underlined phrase
  questions/conjunction.yaml # choose a joining-word pair (不但……而且)
  questions/sentence.yaml
  questions/cloze.yaml       # passage with blanks (MCQ or word bank)
  questions/errorcorrect.yaml# passage with wrong characters to fix
  questions/dialogue.yaml
  questions/comprehension.yaml
  questions/practical.yaml   # read a notice/poster and answer
```

### 2.1 Tingxie lesson file (`tingxie/N.yaml`)

```yaml
title: 第一课 (Lesson 1)
vocab:
  - word: 露营
    pinyin: lù yíng
    meaning: Camping
    example: 我们全家去年去森林露营。
    sentenceBank:            # 5 sentences, each {zh, en}
      - zh: 我们打算周末去山里露营。
        en: We plan to go camping in the mountains this weekend.
sentences:                   # 5 longer model sentences per lesson
  - text: 听到喊声，他不管三七二十一，跳下水救人。
    segments: [听到, 喊声, "，", 他, 不管三七二十一, "，", 跳下水, 救人, "。"]
    icon: activity
    description: Regardless of consequences, jumping in to save someone.
```

About 15–25 words per lesson; about 330 words in total across 17 lessons.

### 2.2 Single questions (`vocab`, `pinyin`, `usage`, `phrase`, `conjunction`, `sentence`)

```yaml
- questionID: NH-Q6
  lessonIds: [1]             # may be [] (untagged)
  question: 每周的升旗礼，同学们必须在七点半前到礼堂 ___。
  options: [排列, 欣赏, 集合, 围观]
  correct: 集合
```

- `pinyin` and `phrase` questions mark the target word as `__word__` and end with an instruction in brackets, such as `（选出画线词语的汉语拼音）`.
- `usage` questions look like `以下哪一个句子是正确的？（词语：有限）`.
- Some questions are tagged `subject: Higher Chinese`; keep that flag.

### 2.3 Passage groups (`cloze`, `errorcorrect`, `comprehension`, `dialogue`, `practical`)

```yaml
- groupId: TN-G1
  subject: Chinese
  passage: { title: 外婆的红烧排骨, text: "… [Q16]___ …" }
  questions:
    - format: MCQ            # or Fill-in
      text: 我的心里感到很 ___ 。
      options: [充实, 新鲜, 精彩, 温暖]
      correct: 温暖
      # Fill-in uses: accepted: ["3", 建造, ...], displayAnswer: "3 建造"
```

- Error-correct passages mark wrong characters as `[Q6](兰)`, and each question has `accepted` answers.
- `questions/index.yaml` also contains group metadata (`category`, `lessonIds`, `questionCount`).
- About 220 questions have `lessonIds: []`. These go into region-level "mixed" pools and the final region.
- **Passage question formats:** `MCQ` (auto-marked), `Fill-in` (auto-marked against `accepted`), `Long-Answer` and `Writing-Constrained` (open written answers with a `displayAnswer` model answer, sometimes `marks` and a `context` marking guide; **cannot be auto-marked**).
- **P5 counts:** comprehension has 48 passages and 294 questions (80 MCQ, 48 Fill-in, 166 open answers); practical has 17 notices and posters; dialogue has 16; error-correction has 8; cloze has 24. Passages have 5–7 questions each. None of these passages are tagged to lessons.

### 2.4 Stories (`stories/N.md`)

The file starts with `# 《Title》`, followed by `## Page 1` … `## Page 6`, each page being 2–4 short Chinese paragraphs. Every story uses its lesson's words. Section 13 uses these stories as the backbone of each region's plot.

### 2.5 Levels (content packs)

- **A level is a curriculum version of the same adventure.** When the game first starts, the child picks a level on a **Choose your level** screen. Levels whose content isn't installed yet show as "Coming soon". After choosing, the child stays on that level until they finish it.
- **Each level has its own save** (section 18). Starting another level begins the same storyline with that level's learning content and never changes the first level's save.
- **Only a parent can switch levels,** from the parent panel (behind the PIN). Switching keeps every level's progress and loads the other level's save.
- **Finishing a level** (beating its final boss) shows a completion certificate and gives a trophy. The trophy is also shown in every other level's player room. Nothing else carries over: no stats, items or coins.
- **Shared by all levels:** the engine, seven regions, maps, buildings, villagers, quests, bosses, Great Forgetter storyline, creatures, items, gear, recipes, UI strings and visual assets.
- **Per level:** the source YAML and a small `level.json` containing lesson-to-region assignments, supported question types, age-appropriate text density and difficulty tuning.
  Level-specific lesson stories and passages appear inside the same Reading Halls and quest structure.
- The campaign always has seven regions.
  A level's lessons are distributed across those regions, usually as consecutive groups of two or three lessons.
  P5 uses the assignments in section 13; P2 should initially use `[1–3]`, `[4–6]`, `[7–9]`, `[10–12]`, `[13–15]`, `[16–17]`, `[18–19]`, subject to content review.
- **`level.json` switches learning features on or off** for levels that lack some content.
  For example, a lower-primary level might have too little conjunction or practical content for a recurring required activity.
  Boss phases, Reading Hall chains, Exam Day and daily quests only use question types the selected level actually has.
  The content validator warns when a shared campaign activity asks for content the level does not support.
- **Adding a level:** copy its YAML into `content/source/<level>/`, create one `content/authored/levels/<level>/level.json`, review the lesson-to-region mapping and tuning, set `"ready": true`, and run `npm run build:content`.
  Do not create new maps, villagers, quests or bosses for a school level.

### 2.6 Current source packs

- **P2:** 19 lessons, 460 words, 19 stories, 608 single questions, 39 passage groups and 153 passage questions.
  Its large pools are vocabulary, pinyin, usage and comprehension.
  Conjunction, sentence, phrase, dialogue, practical and error-correction currently have small pools, so P2 must use feature flags and must not make those categories recurring required gates until more content exists.
- **P5:** 17 lessons, 327 words, 17 stories, 414 single questions, 113 passage groups and 581 passage questions.
  It remains the reference campaign because Region 1 already has a playable prototype and detailed authored story plan.
- `npm run validate:content` checks every source pack for required lesson files, vocabulary fields, six-page stories, unique question IDs, valid lesson references and answer-option consistency.
- Source readiness and world-mapping readiness are separate.
  A level must not appear as playable merely because its curriculum source passes validation.

---

## 3. Learning model (the heart of the game)

### 3.1 Skills

Every vocabulary word has **five skills**:

| Key | Skill | What is tested | Example question |
|---|---|---|---|
| `m` | Meaning | recognise meaning from hanzi | 露营 → pick "Camping" |
| `p` | Pinyin | read it with correct tones | 露营 → pick "lù yíng" from tone variants |
| `h` | Hanzi | recognise the correct characters | "Camping · lù yíng" → pick 露营 from look-alikes; or real `vocab.yaml` blank question |
| `u` | Usage | use it in context | sentence with a blank → pick 露营; or real `usage.yaml` question |
| `w` | Writing | write each character stroke by stroke | trace, then guided, then from memory (Hanzi Writer) |

### 3.2 Stars, tiers and spacing

- Each skill has a star made of **two ticks**. A tick is earned by a correct answer in that skill, **at most one tick per skill per calendar day**. So a full star needs correct answers on **two different days**. The first tick shows as a half-filled dot.
- The **Writing** tick only counts when every character was written in **From memory** mode (stored stage `2`, see 3.4) without help as defined below.
  Automatic stroke hints below the four-miss autofill threshold do not count as help; explicit demonstrations, autofill and giving up do.
- Hint items (section 7) let the child answer, but a hinted answer never earns a tick.
- **Tiers:**
  - **Bronze:** the word has been collected (a creature carrying it was beaten once).
  - **Silver:** any 3 of the 5 stars.
  - **Gold:** all 5 stars.
- **Resting and review:** when a word turns Gold it "rests" for 3 days (`REVIEW_DAYS`) and does not appear in battles. After that it can appear once as a **review creature**. Beating it resets the rest timer and doubles the next interval (3 → 6 → 12 → 24 days, capped at 30). If a review question is answered wrong, the word drops back to Silver: the star for that skill loses one tick.
  - On a failed due review, remove one tick from the failed skill, reset `revInterval` to 3 and make the word eligible for focused practice.
    Retain the collected flag, completed restoration rewards and earned milestones.
  - A successful due review encounter advances only its own word's interval, once at encounter completion, provided it stayed Gold and its scored review answers were unassisted under section 3.4.
    Running, fainting or an item-assisted answer cannot extend the interval.
  - Defensive spell questions affect the word actually tested.
    A wrong due-review answer for that word applies the same failed-skill rule; a correct incidental answer does not extend a different word's review interval.
  - Reaching Gold again starts a new three-day rest; milestones and collection rewards never repeat on re-mastery.
- **What tiers are for:**
  - Silver count opens each region's **boss gate**.
  - Gold percentage opens the **next region** (section 10).
  - Gold words can be equipped as **Partner Spirits** (section 8.2).
  - Themed **Spirit Sets** at Silver restore the village (section 8.3).

### 3.3 Word selection (spaced repetition)

When an encounter happens in a zone, pick a word from that zone's lesson(s) with weights:

| Word state | Weight |
|---|---|
| Not collected | 5 |
| Collected, not Gold | `max(0.5, 5 − stars) + min(misses, 4) × 0.8` |
| Gold, review due | 1.5 |
| Gold, resting | 0 (excluded) |

If every word in the zone is resting, the zone is **peaceful**: no encounters, and a toast says "All spirits here are Gold and resting."

**Recommended skill:** each encounter highlights one useful attack based on due review skills and missing ticks that can still be earned today.
The child may choose any attack.
A completed varied-skill objective can give a small authored coin or material reward, never an automatic tick or star.
The objective must require actual answers; merely selecting the recommended move gives no reward.

### 3.4 Writing (Hanzi Writer)

- Library: [Hanzi Writer](https://hanziwriter.org) 3.7.x (MIT), with stroke data from `hanzi-writer-data` (Make Me a Hanzi, Arphic licence). **Vendor both locally.** Do not load character data from a CDN at runtime; hosted or sandboxed pages often block it. The build step (section 18) extracts only the characters used in the content.
- Each **character** (not word) has a writing stage stored in `save.chars[ch].lv`:

| Stage | Name | Outline shown | Hint after misses |
|---|---|---|---|
| 0 | Trace | yes | 1 |
| 1 | Guided | no | 2 |
| 2 | From memory | no | 3 |

- After 4 misses on one stroke, the stroke is filled in automatically (`markStrokeCorrectAfterMisses: 4`). This counts as **needing help**.
- **Approved writing tolerance:** keep the prototype's four-miss threshold.
  A stroke hint after three misses in From memory mode does not by itself set `helped`; a learner's intended stroke may have been correct despite imperfect tracing.
  Explicit "Show me how", "I don't know" and an automatically filled stroke still count as help.
  Keep the current pinyin, meaning and audio clues; do not switch this task to audio-only dictation.
- **Pass or fail, no mistake counting.** A character is "written" if the child drew every stroke themselves: no auto-filled stroke, no "Show me how", no "I don't know". Wobbly attempts don't matter.
- **Stage changes:** a clean write in a different battle or session moves the character up one stage; needing help moves it down one stage (not below 0).
- **UI must include:**
  - pinyin, English meaning and a "Hear it" button
  - the example sentence with the word blanked out, as a clue
  - a 米字格 practice grid
  - slots showing each character's progress
  - "Show me how" (stages 0–1): animates the strokes, then the child retries; counts as help
  - "I don't know" (all stages): animates the character, shows the whole word, moves on as a fail and schedules the word sooner
- **Parent setting:** Gentle (`leniency 1.4`, `acceptBackwardsStrokes: true`, the default) or Strict (`leniency 1.0`). Stroke order is always enforced; tell the parent this.

### 3.5 Question generation rules

- **Meaning:** the correct meaning plus 3 distinct distractor meanings from other words, preferably the same region.
- **Pinyin:**
  - 50% chance of using a real `pinyin.yaml` question if one exists for the word.
  - Otherwise generate tone variants: change the tone of one syllable, sometimes two. Place tone marks with the standard rule (a > o > e; for `iu`/`ui`, mark the second vowel).
  - Top up with other words' pinyin that has the same number of syllables.
- **Hanzi:** 60% real `vocab.yaml` question if one exists. Otherwise pick words of the same length. Later improvement: add a look-alike and homophone table (恨/很/狠, 扮/办/般) for character-level distractors.
- **Usage:**
  - 40% chance of using a real `usage.yaml` or `phrase.yaml` question if one exists.
  - `sentence.yaml` (complete the sentence, all tagged to lessons) goes into the School quiz and Exam Day pools, with the English line "Pick the best way to complete the sentence." 
  - Otherwise take a `sentenceBank` sentence containing the word, blank the word and offer 3 same-length words from the same lesson as distractors.
  - Show the English translation after answering.
- **Idiom casting:** pick the sentence that uses the idiom correctly. Build the wrong options by putting the idiom into other words' sentences in place of their own word.
- **Exam questions:** show the Chinese stem, but replace bracketed Chinese instructions with a one-line English instruction:
  - vocab: "Pick the word or character that fits the blank."
  - pinyin: "Pick the correct pinyin for the underlined word."
  - usage: "Which sentence uses **X** correctly?"
  - phrase: "Pick the meaning closest to the underlined word."
  - conjunction: "Pick the pair of joining words that fits."
- **Mapping exam questions to words:** match `correct` to a word (vocab); match `（词语：X）` (usage); match `__X__` (pinyin, phrase).
- **Language quality:** required gate questions and idiom options must have a content-review status and reviewed alternatives with one defensible answer.
  Tag generated vocabulary distractors by part of speech and semantic family, as well as length.
  A Chinese-proficient reviewer checks required content; uniqueness alone does not establish correctness.
  Maintain fixtures for previously ambiguous questions.
- **After every answer:**
  - Show correct or wrong, the correct answer, and the word card (hanzi, pinyin, meaning, example sentence).
  - Offer a "Hear it" button, and play the audio automatically when the answer was wrong.
  - Continue only when the child taps "Next".

### 3.6 Audio

Use the browser's built-in speech (`speechSynthesis`) with `lang: zh-CN` and `rate: 0.85`. Always guard for missing support. A later improvement could add recorded audio files under `assets/audio/` keyed by word; the audio module should allow that without other code changes.

When no usable Chinese voice is available, show a clear audio-unavailable state and a parent-facing setup tip.
Check voice availability asynchronously and keep text-based activities usable.
An audio-dependent activity must explain the limitation rather than silently playing nothing.

---

## 4. World and exploration

- Top-down tile map drawn on a `<canvas>`, 32 px tiles. The viewport is 15×11 tiles and scales to fit the screen, with the camera following the player.
- Each **region** has:
  - one **hub town**
  - 2–3 **wild zones**, each mapped to one lesson, with tall grass that triggers encounters
  - one **boss lair** behind a gate
  - optional **secret areas** opened by key items
- Maps are authored as data (section 15.4). Do not hard-code maps in JS.
- **Tiles:** grass, path, tall grass (tinted per zone), tree, water, rock, building footprint, door, NPC, sign, gate, lair entrance, bridge, chest, scroll-spot, warp.
- **Controls:**
  - Keyboard: arrow keys or WASD.
  - On-screen D-pad, always visible on touch devices, with pointer capture.
  - Walking into a door, NPC, sign or chest interacts with it.
  - Grid-based movement with smooth tweening.
  - Hold to keep walking; Running Shoes (a milestone reward) doubles speed.
- **Encounters:** each step in tall grass has a 16% chance of an encounter, with a cooldown of at least 3 steps between encounters.
- **Encounter blocks:**
  - Daily cap reached: toast "The creatures are asleep. Come back tomorrow!", plus a one-time explanatory dialogue.
  - Zone peaceful: toast only.
- **Zone toasts:** entering a zone shows its name and lesson, e.g. "Camping Forest · Lesson 1".
- **Atmosphere per zone:** tint, particles (fog, leaves, sparkles) and a short ambient tag. Keep it light.
- **Region travel:** a signpost or gate on the region edge leads to the next region once it is unlocked. A **Travel Map** screen, unlocked after Region 2, lets the child jump between unlocked hub towns.

---

## 5. Battle system

### 5.1 Turn structure

1. **Intro:** "A wild **Fogling** appeared! It has a word spirit sealed inside." A review creature says "…woke up one of your Gold spirits for a review!"
2. **Player turn:** choose one of:
   - **Attacks (5):** Meaning Strike (`m`), Sound Blast (`p`), Precision Jab (`h`), Heavy Slam (`u`), Brush Finisher (`w`).
   - **Idiom move:** any collected idiom spirit, once per battle.
   - **Item:** consumables (section 7).
   - **Partner skill:** once per battle (section 8.2).
   - **Run away.**
3. **Resolve the player action** (a question or writing task). A correct answer deals damage; a wrong one misses.
4. **Enemy turn** (if the enemy still has HP): see 5.3.
5. Repeat until the enemy HP reaches 0 (win) or the player HP reaches 0 (faint).

All attacks are about the **creature's word**. The creature's spells (5.3) use *other* words from the same lesson, preferring collected ones, so they also act as review.

### 5.2 Player damage

- Base damage: 1 for `m`, `p`, `h` and `u`; 2 for Brush Finisher.
- +1 if the attack matches the creature's **weakness**.
- +1 for a streak of 3 or more correct answers in a row within the battle. Show a visible streak meter.
- Gear and partner bonuses apply (sections 7 and 8).
- A "double" effect (the idiom 齐心协力) multiplies the total by 2 for the next hit.
- **Creature HP:**
  - normal: 3
  - elite: 5
  - golden (rare, 5%): 4, and it flees after 4 turns if not beaten
  - boss: see 5.6

### 5.3 Enemy turn

After each player action, the creature acts:

- **40% spell attack:** "Fogling casts **Fog Cloud**! Answer correctly to block it." The child answers a question of the creature's attack type (`atk`) about another word from the same lesson.
  - Correct: blocked, no damage.
  - Wrong: take `3 + regionTier` damage. The answer counts for that word's skill tick as normal.
- **60% physical attack:** damage = `2 + rand(0..2) + (regionTier − 1)`.
  - If the player's last action was correct: 30% dodge chance (50% with a streak of 3 or more).
  - If the player's last action was wrong: damage × 1.5, rounded up ("caught you off guard").
- The shield effect (抛到脑后) cancels the next damage from a wrong answer.
- A low-HP warning appears at 6 HP or less.

### 5.4 Creature types

| Type | Weak to | Attacks with | Spell name | Notes |
|---|---|---|---|---|
| Fogling | Meaning | Meaning | Fog Cloud | common in misty zones |
| Echo Bat | Pinyin | Pinyin | Screech | |
| Twin Shade | Hanzi | Hanzi | Mirror Trick | look-alike theme |
| Jumble Bug | Usage | Usage | Word Scramble | |
| Ink Imp | Writing | Hanzi | Ink Splash | |
| *Region specials* | varies | varies | varies | 1–2 new looks per region (e.g. Tide Crab in Region 3) reusing the same 5 weakness types |

Zones have a **type mix** defined in data, so each zone feels different. Creature art is procedural SVG, one function per type, in the prototype style. Region specials are new SVG functions or sprite files.

### 5.5 Winning, losing and running

- **Win:**
  - The seal breaks and the spirit card appears with its tier and star changes.
  - Rewards: +12 XP, +8 coins, a creature **material drop** (section 7.5) and quest progress.
  - Show "half-stars earned today" so the child knows to come back tomorrow.
- **Faint:**
  - "Grandma Wang carried you back to the inn." HP is restored at the hub's inn.
  - **No loss** of coins, items or progress.
  - The battle still counts towards the daily cap.
- **Run:** always succeeds, gives no rewards, and still counts towards the daily cap.

### 5.6 Bosses

- Each region has one boss with 10–14 HP and **phases** built from that region's lesson content.
- **Phase types:**

| Phase | Content | Source |
|---|---|---|
| Chain Spell | joining words | `conjunction.yaml` tagged to the region's lessons |
| Scramble Spell | rebuild a sentence from shuffled segments | lesson `sentences[].segments` (merge punctuation into the previous segment) |
| Ink Spell | tingxie of 2 words, written from memory | region words, preferring collected ones |
| Muddle Scroll | cloze passage | `cloze.yaml` group chosen for the region |
| Error Spell | fix the wrongly written characters | `errorcorrect.yaml` group (typed answer or choose from 4) |
| Riddle | read a short passage and answer | `comprehension.yaml` group |
| Notice Board | read a poster or notice and answer | `practical.yaml` group |
| Talk-down | choose the right dialogue lines | `dialogue.yaml` group |

- A correct answer deals 1 damage. After a correct answer, the boss has a 30% chance of a counter-attack for 3 damage.
- A wrong answer: the boss hits for 5–6 damage, and the question goes back to the end of the queue.
- Potions, idioms and partner skills are allowed between questions.
- **Faint:** the boss resets and the player wakes at the inn.
- **Win:**
  - Rewards: a Brush Fragment (key item, section 7.3), a region badge, a cutscene, and a big coin and XP reward.
  - The boss's minions around the region calm down, so tall-grass encounters in that region's zones switch to "review mode": lower encounter rate, more review creatures.

---

## 6. Player progression, HP and balance

| Stat | Formula / value |
|---|---|
| Level up at | `level × 30` XP |
| Max HP | `18 + 2 × level + gear bonus + partner bonus` |
| XP per win | 12 (elite 20, golden 30, boss 80) |
| Coins per win | 8 (elite 15, golden 40, boss 100) |
| School quiz or tingxie | +5 coins per correct answer, for the first 3 sessions per day |
| School XP | quiz: 4 XP per correct answer; tingxie: 5 XP per correct answer, including after the coin limit |
| Region tier (`regionTier`) | 1 to 7, scales enemy damage |
| Daily battle cap | parent setting: 10 / 15 / 20 / 30 / no limit (default 15) |

**Target feel:** a child who answers about 80% correctly needs to rest at the inn roughly every 3–4 battles in their current region. Tune enemy damage to hit this; log it in a debug overlay (section 19).

### 6.1 XP visibility and level-up celebration

- Show a labelled numeric XP readout beside the bar, for example **Level 3 · XP 24 / 90**.
  Keep it visible at tablet and phone widths.
- Every XP reward shows how much was earned and visibly advances the XP bar.
- When the player levels up, finish the current answer feedback, then show a dedicated **Level up!** panel with the new level, max HP increase and restored HP.
  Use a brief celebratory animation and optional sound, plus a **Continue** button.
  Respect reduced motion, sound settings and the no-timer rule.
- Use the same level-up flow for battle, school, story, passage and quest XP.
  If one reward advances multiple levels, show one celebration summarising all gained levels.
  Persist the reward once before presentation so reloads and double taps cannot grant it twice.

**Resting:**
- The **Inn** gives a free full heal after a "Bedtime Review" of the 3 weakest collected words (any skill, including writing).
- Potions and food heal during battle.

---

## 7. Items, gear and economy

Every item must *do* something. Cosmetics exist, but they come from achievements and milestones, not only the shop.

### 7.1 Consumables (usable in battle; the shop sells them)

| Item | Effect | Price |
|---|---|---|
| Rice Ball 饭团 | +10 HP | 25 |
| Instant Noodles 方便面 | +20 HP, capped at max HP | 50 |
| Mooncake 月饼 | full HP | 80 |
| Scholar's Lantern | remove one wrong option (once per question); **no tick** for that answer | 30 |
| Ink Pot | retry a failed writing attempt with no penalty (the retry can still earn a tick) | 40 |
| Smoke Ball | escape a boss fight without fainting (boss resets) | 20 |
| Lucky Knot 中国结 | next battle gives double coins | 50 |

### 7.2 Gear (3 slots: Brush, Charm, Hat; permanent; bought, crafted or rewarded)

| Gear | Slot | Effect | Source |
|---|---|---|---|
| Bamboo Brush | Brush | starter | start |
| Jade Brush | Brush | Brush Finisher +1 damage | craft (Region 1) |
| Echo Bell | Charm | Sound Blast +1 damage | craft |
| Mirror Charm | Charm | Precision Jab +1 damage | craft |
| Fog Lantern Charm | Charm | spell-attack damage −2 | shop (Region 2) |
| Red Cap | Hat | max HP +3 | shop |
| Bamboo Hat | Hat | dodge +10% | 20-spirit milestone |
| Scholar's Cap | Hat | +10% XP | Region 2 boss |
| Gold Crown | Hat | cosmetic, shows mastery | 50 Gold words |

Gear is visible on the player sprite (hat and brush) and in a Character screen.

### 7.3 Key items (story; open areas; never sold)

- **Brush Fragments:** 7 in total.
  The six regional lieutenants award fragments 1–6; a Region 7 restoration quest awards fragment 7 before the final boss.
  Together they restore the **Spirit Brush**.
  Each fragment grants a map ability (this is the game's "HM" system):

| Fragment | Ability | Opens |
|---|---|---|
| 1 Dawn Stroke | Light: clears thick fog | Misty Path's hidden grove (Region 1 post-game), Region 2 fog forest |
| 2 Bridge Stroke | Draws plank bridges over marked gaps | Region 3 coast |
| 3 Wave Stroke | Ride a paper boat on marked water | Region 3 islands, whale lagoon |
| 4 Wind Stroke | Clears fallen-leaf piles and cuts vines | Region 4 fields |
| 5 Spark Stroke | Lights festival lanterns and gates | Region 5 city |
| 6 Root Stroke | Makes roots into ladders | Region 6 ancient grove |
| 7 Complete Brush | Enter the Great Dictionary Tree | Final area |

- **Reading key item (required, one per region):** earned by finishing the region's first Reading Hall passage chain (section 11.4). It is needed to reach the boss. Region 1: the **Cave Lantern** (the Muddle Cave is dark). Later regions: for example the Serpent's Den Map, Tide Chart, Theatre Pass, Festival Pass, Oracle Rubbing and Treehouse Rope.
- Other key items per region, given by villagers after requests: Grandma's Lantern, S.S. Paper Boat Ticket, Museum Key and so on (see section 13).

### 7.4 Coins

- **Earned from:** battles, school, daily chest, villager requests and milestones.
- **Spent on:** consumables, some gear, cosmetics and decorations for the player's room (section 9.5).
- Coins can never buy stars, ticks, answers or region unlocks.

### 7.5 Materials and crafting (light)

- Each creature type drops a material:
  - Fogling → Mist Drop
  - Echo Bat → Echo Feather
  - Twin Shade → Mirror Shard
  - Jumble Bug → Jumble Silk
  - Ink Imp → Ink Bead
- The **Blacksmith / Craft Table** in each hub turns materials into gear (a recipe needs 3–6 materials plus coins).
- This gives a reason to hunt different creature types and to use every attack type.

---

## 8. Collection systems

### 8.1 Spirit Book (字灵图鉴)

- Tabs by region, then lesson. Card grid; uncollected cards show "?".
- **Card:** hanzi (brush font), pinyin, 5 star dots (half or full), tier seal (B / S / G), and a "resting" tag.
- **Card detail:**
  - big card and the skill rows with 2 dots each
  - writing stage per character
  - "Hear it" and "Practise writing" (practice changes no stars)
  - example sentence plus 3 `sentenceBank` sentences with English
  - the idiom move description, if the word is an idiom
- **Fun fact line:** a curator-style comment on each card, such as "露 means dew. 营 means camp."
  - Optional content; add it later to `content/authored/word-notes.json`.
  - Only show a note once it has been written. Missing notes are simply hidden.

### 8.2 Partner Spirits (party of up to 3)

- Only **Silver or Gold** spirits can be partners. The lead partner follows the player on the map as a small floating glyph.
- **Passive bonus by tier:** Silver gives +1 max HP; Gold gives +2 max HP and a **partner skill** decided by the word's lesson "element":

| Lesson element | Partner skill (once per battle) |
|---|---|
| Outdoors / nature | Heal 5 HP |
| Food | Heal 3 HP and cure "muddled" status (future) |
| Feelings | Shield: next spell attack blocked |
| Actions | +1 damage on the next hit |
| Time / thinking | Reveal the creature's weakness and add +1 to the streak |

- Each word's element is set in `content/authored/word-tags.json`, a hand-tagged list. Default: "Actions".
- Idiom words (成语) are special: collected idioms also give the **idiom moves** from the prototype. Each region adds 2–4 idioms, following the same pattern:
  - 狼吞虎咽: full heal
  - 齐心协力: next hit ×2
  - 抛到脑后: next wrong answer does no damage
  - 异口同声: 1 damage
  - Later regions, for example: 光阴似箭 (take an extra turn), 恍然大悟 (reveal the answer to a spell attack, no tick), 依依不舍 (a fleeing golden creature stays 2 more turns).

### 8.3 Spirit Sets (like Stardew's bundles)

- Each hub has a **Restoration Board** listing 4–6 themed sets of 3–5 words, drawn from different lessons in the region.
- When every word in a set reaches **Silver**, the child "offers" the set. It then **restores something visible in the town**:
  - lanterns relit
  - a stall reopens, and a new shop item appears
  - a bridge is repaired, opening a shortcut
  - a fountain flows
  - a villager's house is fixed, and that villager moves in
- Completing **all** sets in a region gives a region trophy placed in the player's room, plus a special cosmetic.
- Region 1 example sets:
  - **Campfire:** 露营, 探险, 集合, 绑 → relight the village campfire (a new story scene at night)
  - **Kitchen:** 黄瓜, 紫菜, 调味料, 炒, 材料 → reopen the noodle stall (sells Rice Balls at a discount)
  - **Healthy Eyes:** 电脑, 眼圈, 模糊, 距离, 保持 → fix the optician's sign (a villager request unlocks)
  - **Kind Words:** 祝福, 安慰, 贺卡, 异口同声 → decorate the town square for Grandma's birthday (cutscene)
  - **Team Spirit:** 齐心协力, 配合, 冠军, 轮 → repair the race track and unlock the rival rematch

### 8.4 Collection milestones (like Oak's aides)

- Rewards at total spirits collected. They come from a "Spirit Scholar" NPC who travels to each hub.

| Spirits | Reward |
|---|---|
| 10 | Running Shoes (hold to run) |
| 20 | Bamboo Hat |
| 30 | Creature Radar (shows which types live in each zone) |
| 50 | Material Pouch (+1 material per drop) |
| 80 | Travel Map fast travel |
| 120 | Echo Bell |
| 200 | Golden Lure (golden creature chance ×2) |
| all | Title "Word Sage" and the Gold Crown |

- There are also milestones for Gold count (10 / 30 / 60 / 100 …) with decorations for the player's room.

---

## 9. Daily return loops

### 9.1 Daily Quest Board (in every hub)

- 3 small quests per day, generated from templates. They reset at local midnight.
- **Example quests:**
  - "Write 3 words from memory."
  - "Beat an Echo Bat using Sound Blast."
  - "Read 2 story pages."
  - "Block 2 spells."
  - "Complete a tingxie at the School."
  - "Help a villager."
- Finishing all 3 opens the **Daily Chest**:
  - fixed contents: 30 coins, 1 consumable, 2 random materials from a visible pool
  - on streak milestone days, a small bonus is added
- Quests only pick activities that are possible with the child's current unlocks and daily cap.

### 9.2 Lantern Streak

- Each day with at least one completed daily quest lights one lantern along the village main street. The lanterns stay lit, and there is a visible count.
- **Milestones at 3, 7, 14, 30, 60 and 100 days:** a small celebration (fireworks over the town) plus a decoration or cosmetic.
- **Forgiveness:** one automatic "free miss" per week (Duolingo-style freeze). It is applied silently; the next day the child sees "Grandma kept your lantern lit while you were away."
- There is **never** a guilt message.

### 9.3 Daily Scroll (like Animal Crossing's fossils)

- Each day one **Mystery Scroll** appears somewhere in the current region, at a random scroll-spot tile.
- The Storyteller "reads" it, and it unlocks one extra content item:
  - an untagged exam question as a mini-challenge, or
  - a lesson model sentence with English, or
  - an idiom story line
- Unlocked scrolls go into a **Scroll Library**, a collection with its own completion count and reward.

### 9.4 Energy / daily cap

- The HUD shows "Battles left today".
- When the cap is reached, battles stop, but these stay open: stories, the Scroll Library, writing practice, crafting, room decoration and the quest board (quests that need battles are shown greyed out).
- The parent can add +5 battles from the parent panel.

### 9.5 Player room (home base)

- The player's room is in Grandma Wang's house in the Region 1 hub, with a portal to it from every hub.
- It displays trophies, region badges, decorations bought with coins or earned, the Lantern Streak count and the Partner Spirits resting.
- Its purpose is to be a quiet space to show off achievements, giving the child a sense of pride and ownership.

---

## 10. Gates and region progression

- **Percentage denominator:** use the distinct vocabulary words assigned to the region's lessons in the selected level.
  Count duplicate words once; untagged exam questions do not increase the denominator.
  Threshold counts are always computed as `Math.ceil(regionWordCount * requiredPct)`, never hard-coded across levels.
- **Boss gate:** a configurable percentage of **Silver-or-better** spirits **and** the region's reading key item (section 11.4).
  Use a 35% default; Region 1 uses 22% to preserve its gentler existing pacing.
  For the 54-word P5 Region 1 example, `ceil(54 * 0.22) = 12`.
  The gatekeeper shows actual percentage, required percentage, derived counts and the key-item status, for example "Silver or better: 9/54 (17%) · Need 22% (12 spirits) · Cave Lantern: not yet".
- **Next region gate:** after the boss is beaten, require **70% of the region's words at Gold** by default, configurable per region.
  Show percentage and derived counts, for example "Gold: 21/54 (39%) · Need 70% (38 spirits)".
  - This makes Gold matter and ensures words are properly learned before moving on.
  - It also stops the game from running ahead of what the child is learning at school.
- **Parent override:** in the parent panel, "Unlock region N" skips these gates. Use it for testing, or if school is ahead of the game.
- **Region order:** linear 1 → 7. Regions stay open after clearing, and their creatures shift to review mode (section 5.6).

---

## 11. Towns, buildings and villagers

### 11.1 Standard hub buildings (every region)

| Building | Function |
|---|---|
| School | Exam Quiz (5 real exam questions from the region's lessons); Tingxie (5 words, written from memory; say the word, then the example sentence); **Exam Day** once a week (see 11.6) |
| Reading Hall | one passage at a time; its questions are spread across villagers (11.4) |
| Inn | Bedtime Review, then full heal |
| Shop | consumables and some gear; stock expands as sets are restored |
| Craft Table | materials into gear |
| Restoration Board | Spirit Sets (8.3) |
| Quest Board | Daily Quests (9.1) |
| Storyteller | the region's lesson stories with tap-to-see words; first read gives coins and XP |

### 11.2 Villagers (3–5 per region, each with a job)

- Villagers are characters from that region's lesson stories. At first they are **muddled**: their English dialogue has scrambled words. For example, Dad from Lesson 2 says: "I can't find my… my… where are the things on my head?"
- Each villager gives a **request chain** of 2–3 steps:
  - "Bring me a Silver 贺卡 and 祝福."
  - "Beat 3 Twin Shades in the Kitchen Garden."
  - "Write 眼圈 from memory for me."
- **Rewards:** a key item, gear or a story scene. The villager also becomes **un-muddled**: their dialogue becomes clear and they give a helpful tip.
- **Do not** add houses or villagers without a job. Prefer restoring existing broken buildings (through sets) over adding new ones.

### 11.3 Rival: Ah Dong (阿东)

- A friendly rival from the Lesson 5 story who is also collecting spirits. He appears 2–3 times per region.
- His **quiz duel** is 5 quick questions from the region's words, alternating turns with a fake opponent "answer" animation. Winning gives coins and a material.
- He grows from teasing ("Bet you can't read 模糊!") to friendship (Region 2 arc, echoing Lesson 5's quarrel and make-up story). Later he helps in a boss fight.

### 11.4 Reading Hall: passage quests spread across villagers

Comprehension passages are daunting in one go, so the questions are handed out one at a time by different villagers.

- **One passage at a time.**
  Pick any random standard-Chinese comprehension passage from the selected level, with no region matching, difficulty tiers or curated starter passage.
  Same-level passages are treated as roughly equivalent in difficulty.
  Do not repeat a passage until that eligible pool has been completed.
  **Higher Chinese is an opt-in challenge pool**, available separately and never required for the reading key or a progression gate.
  Completing a standard passage with help remains sufficient for required progression.
- **Read first.** The child reads the passage in the hall. Tapping a highlighted vocabulary word shows its pinyin and meaning, and "Read aloud" uses speech. Pressing "I've read it" gives a **Passage Scroll**.
- **Questions go to villagers.** Question 1 goes to the first villager in the region's `passageVillagers` list, question 2 to the second, and so on (at most 7 questions per passage, so each region lists 7 villagers). Villagers with a waiting question show a **?** bubble on the map. The child can answer them in any order.
- **Answering at a villager:** "I heard you read *<title>*. Can I ask you a question about it?" → Answer / Later. The question screen always has the passage scroll available (collapsible), so the child never answers from memory.
- **Marking:**

| Format | How it's answered | Marking |
|---|---|---|
| MCQ | tap an option | auto; a wrong first try means "Look at the passage again" and one retry; a second wrong answer shows the answer |
| Fill-in | type in Chinese (pinyin input) | auto against `accepted` (ignoring spaces and punctuation); same retry rule |
| Long-Answer, Writing-Constrained | type in the box or write on paper, then "Show the model answer" | **self-check:** Got it / Partly / Not yet. "Not yet" the first time sends the child back to re-read, then return; the second time it counts as done with help |

- **"I don't know"** is always available. It shows the answer and marks the question done with help, so a child can never get stuck.
- **Rewards per question:** right first time or "Got it": 10 coins and 5 XP; Partly: 6 coins; done with help: 3 coins. Passage questions don't affect word stars. Accuracy is tracked as the **Reading** skill in the parent panel.
- **Finishing the passage** (every question answered, with or without help):
  - The **first** passage in each region gives that region's **reading key item**, which is required to reach the boss (section 10).
  - Later passages give 30 coins and a consumable, plus a Scroll Library entry.
  - The hall then offers a new random passage.
- **Parent review:** written answers (the child's text, the model answer and the self-rating) are listed in the parent panel, so a parent can check self-marking. This is on by default and can be turned off.
- **Data:** `villagers/<region>.json` gets a `passageVillagers` array. Each passage villager also needs a one-line lead-in (optional; a default line is used otherwise).

### 11.5 Other passage types

- **Practical (notices and posters):** the same villager-chain format, run from the town's **Notice Board**. For example, a villager asks "When does the lantern walk start?" about a poster. These chains are optional and give coins and materials.
- **Dialogue:** a "help two villagers make up" scene. The child fills each blank line from the option bank, one line per turn. Optional.
- **Cloze and error-correction:** done in one sitting, because the blanks depend on each other. Used in boss phases and on Exam Day.

### 11.6 Exam Day (weekly)

- Once a week (resets on Monday), the School offers **Exam Day**: a short mixed paper of 8 questions.
- Contents: 3 single exam questions, 2 sentence-completion, 1 conjunction and 2 cloze blanks from one random cloze passage (shown with the passage).
- Reward: 8 coins per correct answer, plus a consumable for 6 or more correct. Results appear in the parent panel.

---

## 12. Parent panel

- **Access:** the "Parents" button, with an optional 4-digit PIN set on first open.
- **Level:** shows the current level, with **Switch level** (section 2.5).
- **Save warning:** if the save failed its checksum (section 18.3), a notice says the save was changed outside the game, with Dismiss and Reset options.
- **Written answers:** the latest Reading Hall written answers with the child's text, the model answer and the self-rating (section 11.4).
- **Summary tiles:**
  - spirits collected
  - Bronze / Silver / Gold counts
  - time played today and this week
  - battles today out of the cap
  - Lantern Streak
- **Accuracy by skill** (m, p, h, u, w, Reading, and exam/boss) as bars with question counts.
- **Tables:**
  - words missed most often
  - characters that needed help in writing
  - words due for review
- **Settings:**
  - battles per day
  - writing check (Gentle / Strict)
  - speech speed
  - unlock region N
  - test mode (open all gates)
  - reset progress (confirm twice)
- **Real-world goal:** the parent types a goal, such as "20 Gold words → ice-cream trip", and picks a target (Gold count, streak days or a region cleared). The game shows a progress bar in the player's room and a celebration when it is reached.
- **Weekly summary:** a view summarising the last 7 days, which the parent can screenshot.
- **Export / import save:** download or upload the versioned JSON export envelope in section 18.3 so progress can move to another device.

---

## 13. Storyline

### 13.1 Premise

Long ago, every word in the land lived as a **Word Spirit (字灵)** in the **Great Dictionary Tree (字典树)** at the centre of the world. People could speak, read and write clearly because the spirits helped them. The villain, **The Great Forgetter (遗忘大王)**, hates remembering. He wants everyone to forget their words so that nobody can tell stories, write letters or keep promises. He shattered the **Spirit Brush** that guarded the Tree. The Word Spirits scattered and were sealed inside wild creatures, and whole towns have become *muddled*: people use the wrong words, forget names and mix up salt and sugar.

The player is a kid spending the school holidays with **Grandma Wang (王奶奶)** in Scholar Village. On the first night they find the handle of the Spirit Brush in Grandma's attic. It glows when they read a Chinese word aloud. Grandma explains that anyone who truly *knows* a word can free its spirit. The goal:

1. Free the spirits, region by region.
2. Defeat the Forgetter's six lieutenants to recover the first six **Brush Fragments**.
3. Complete the Region 7 treehouse restoration quest to recover the seventh fragment and restore the Spirit Brush.
4. Enter the Great Dictionary Tree to face the Forgetter.

**Tone:** warm and funny, like the lesson stories themselves. Each lieutenant embodies a bad habit or feeling that the lesson stories teach against: muddle, selfishness, wasted time, vanity, misunderstanding, giving up, carelessness with the world. Winning always ends with the lieutenant being *reformed*, not destroyed. They become a friendly NPC in the post-game. This keeps it kind for a young player.

**Recurring cast:**
- **Grandma Wang:** guide, heals you when you faint, and runs the room portal.
- **Ah Dong (阿东):** the rival who becomes a friend.
- **The Storyteller (说书爷爷):** reads lesson stories and identifies Daily Scrolls.
- **The Spirit Scholar:** gives collection milestone rewards.
- **Each region's villagers:** drawn from the lesson stories.

### 13.2 Region map for P5 (17 lessons → 7 regions)

Other levels follow the same pattern with their own regions, stories and lieutenants, grouped from that level's lessons (section 2.5).

| # | Region (English name) | Lessons | Story themes used | Lieutenant (boss) | Fragment |
|---|---|---|---|---|---|
| 1 | Scholar Village | 1, 2, 3 | camping "treasure", Dad's lost glasses, sugar-for-salt birthday | **Muddle King 糊涂大王** | Dawn Stroke |
| 2 | Harvest Crossing | 4, 5, 6 | food donation and the humble stranger, forest treasure and a quarrel, honest breakfast and the lost wallet | **Doubt Serpent 猜疑蛇** (makes friends suspect each other and hoard food) | Bridge Stroke |
| 3 | Tidewater Bay & Clock Tower | 7, 8 | stranded baby whale, robot from the future and wasted time | **Idle Clock 懒惰钟** (freezes time so nobody plans or helps) | Wave Stroke |
| 4 | Lantern Theatre & Farm Fields | 9, 10 | Mulan opera at the community club, pimples, phone addiction and the farmer grandpa | **Mocking Mirror 嘲笑镜** (makes people judge looks and forget what matters) | Wind Stroke |
| 5 | Festival City | 11, 12 | martial-arts class misunderstanding, National Day night at Marina Bay | **Grudge Dragon 误会龙** (turns small bumps into big fights; tries to ruin the fireworks) | Spark Stroke |
| 6 | Ancient Grove | 13, 14, 15 | oracle bones and the history of hanzi, the team quiz where a teammate makes a mistake, the magic cannonball tree | **Give-Up Ghost 放弃鬼** (whispers "you'll never learn this") | Root Stroke |
| 7 | Treehouse Summit & the Dictionary Tree | 16, 17 (+ untagged mixed pool) | museum painting of a polluted spring, ancestors' treehouse after the earthquake | **The Great Forgetter 遗忘大王** (final boss, multi-phase) | Complete Brush |

### 13.3 Region 1: Scholar Village (fully specified; build this first)

**Hub:** Scholar Village.
- **Buildings:** School, Inn, Shop, Craft Table, Grandma Wang's house (player room), Storyteller's bench, Restoration Board and Quest Board.
- **Broken at the start:** the noodle stall, the race track, the optician's sign and the unlit campfire. Spirit Sets repair them.

**Zones:**
- **Camping Forest:** Lesson 1. Mostly Foglings and Jumble Bugs. Hidden grove behind thick fog opens after the boss (Dawn Stroke).
- **Misty Path:** Lesson 2. Echo Bats and Twin Shades, with a light fog overlay.
- **Kitchen Garden:** Lesson 3. Jumble Bugs and Ink Imps; cucumber-vine tall grass.
- **Muddle Cave:** the boss lair, north of the gate.

**Villagers and request chains:**

| Villager | From story | Muddled symptom | Request chain | Reward |
|---|---|---|---|---|
| Xiaoqiang 小强 | L1 消失的"宝物" | Thinks a pork rib is his treasure; keeps losing things | 1) Collect 贵重 and 探险. 2) Find his "treasure box" in Camping Forest (a chest tile). 3) Silver 狼吞虎咽 (he laughs: "I ate it!") | Jade Brush recipe, and 小强 joins the Campfire scene |
| Dad (Mr Lin) 林爸爸 | L2 爸爸"看不见"了 | Searches for the glasses sitting on his head | 1) Bring Silver 模糊 and 眼圈. 2) Beat 3 Twin Shades on Misty Path. 3) Write 距离 from memory. | Grandma's Lantern: Misty Path shows creature weakness icons; fixes the optician's sign |
| Chef Mei 梅厨师 | L3 最特别的生日礼物 | Put sugar in everything | 1) Silver 调味料 and 材料. 2) Beat 2 Ink Imps in the Kitchen Garden. 3) Tingxie at the School with 3 Lesson 3 words written well. | Mooncake recipe; the noodle stall reopens |
| Ah Dong 阿东 (rival) | L5 (preview) | Brags | Quiz duel ×2 (after 5 and 20 spirits collected) | coins, Echo Bell materials |
| Grandma Wang | — | — | Kind Words set (birthday) | Birthday cutscene and a room decoration |

**Passage villagers (Reading Hall question order):** Grandma Wang, the Storyteller, Xiaoqiang, Mr Lin, Chef Mei, Ah Dong, the Gatekeeper.

**Story beats (cutscenes are short dialogue sequences, 3–6 lines each):**

1. **Arrival:** a bus drops the player off. Grandma greets them, and the village is oddly muddled.
2. **Attic:** find the Spirit Brush handle. First scripted battle (tutorial): a Fogling carrying 露营, with forced Meaning Strike. The spirit is freed and the Spirit Book is given.
3. **The Storyteller** tells Story 1. It unlocks the Camping Forest sign.
4. **After 5 spirits:** Ah Dong appears ("You collect spirits too?"). First quiz duel.
5. **Each villager solved:** that villager turns clear-spoken and says one line about their story's lesson (for example, Dad: "Rest your eyes every 30 minutes!").
6. **Reading Hall:** the librarian gives the first passage. After the villagers' questions are all answered, they present the **Cave Lantern**.
7. **At the configured Silver-or-better percentage and with the Cave Lantern:** the gatekeeper opens the gate to Muddle Cave.
   For P5 Region 1, 22% of 54 rounds up to 12 spirits.
8. **Boss: Muddle King.**
   - Phases: Chain Spell (3 conjunctions tagged L1–3), then Scramble Spell (2 lesson sentences), then Ink Spell (2 words), then Muddle Scroll (cloze TN-G1 外婆的红烧排骨, 5 blanks).
   - After defeat, he confesses the Forgetter made him muddle everyone. He is reformed and becomes the village's cheerful "Mistake Museum" keeper, who shows the funniest wrong answers the child has fixed (a fun review view).
   - The player gets **Brush Fragment 1: Dawn Stroke**.
9. **Post-boss:**
   - The hidden grove in Camping Forest opens. It holds 3 elite creatures and a chest with the first idiom scroll.
   - The Region 2 gate shows its Gold progress bar.

### 13.4 Regions 2–7 (outline; flesh out when building each region)

For each region, the builder should create:

- a hub, 2–3 zones (one per lesson) and a lair
- a Reading Hall with 7 `passageVillagers` and a reading key item that gates the boss
- 3–4 villagers from the lesson stories with 2–3-step requests
- 4–6 Spirit Sets
- 2–4 idiom moves from that region's 成语
- 1–2 region-special creature looks
- a boss with 4 phases drawn from that region's tagged exam content, plus any untagged passages
- one Brush Fragment ability, and a secret area that uses the *previous* fragment
  - Regions 2–6 award their fragment from the lieutenant; Region 7 awards its fragment from the pre-boss restoration quest.

**Region 2: Harvest Crossing (L4–6)**
- A market village with a hawker centre, and a remote hill village that lacks shops.
- Villagers: the Teacher running the food drive (L4); the humble Stranger Uncle who takes only a little (L4, a lesson in not being 自私); Xiaoming and Ah Dong who quarrel over a broken vase (L5); the Old Lady who lost her silver wallet (L6).
- Plot: the **Doubt Serpent** makes villagers suspect each other and hoard food. Ah Dong and the player fall out after a misunderstanding (echoing L5) and make up. Ah Dong becomes a friend.
- Boss phases: conjunction, error-correct passage, dialogue talk-down, Ink Spell.
- Fragment: **Bridge Stroke**.
- Idioms: 一溜烟, 一分一秒, 争先恐后, 不约而同.

**Region 3: Tidewater Bay & Clock Tower (L7–8)**
- The coast: fishermen and a baby whale stuck in the shallows (L7). Bridge Stroke reaches the sandbar.
- Rescue quest: keep the whale wet by answering Lesson 7 questions in a mini-sequence, then wait for the tide.
- Clock Tower: a robot from the future (L8) shows the player a gloomy "future self" who wasted time.
- Boss: **Idle Clock**, fought across timed-feel phases with *no real timer*: "each correct answer moves the clock hands".
- Fragment: **Wave Stroke** (paper boat).
- Idioms: 依依不舍, 光阴似箭, 井井有条, 一眨眼.

**Region 4: Lantern Theatre & Farm Fields (L9–10)**
- The community club puts on a Mulan opera (L9). The player helps the actress, who has lost her costume pieces (requests).
- The farm: the phone-addicted boy Xiaole and his farmer grandpa (L10).
- Boss: **Mocking Mirror**, which mocks your looks. The winning theme is gratitude and health.
- Fragment: **Wind Stroke**.
- Idioms: from L9–10 plus untagged ones where suitable.

**Region 5: Festival City (L11–12)**
- A martial-arts school, where two boys fight after a bump (L11), and National Day at the bay with fighter jets and fireworks (L12). The player gets separated from their family in the crowd; a finding-your-family quest.
- Boss: **Grudge Dragon**, fought on the night of the fireworks.
- Fragment: **Spark Stroke** (lights the festival).
- Idioms: 五彩缤纷 and others.

**Region 6: Ancient Grove (L13–15)**
- An archaeologist's camp with oracle bones (L13). Its **Hanzi History** mini-feature shows 3–5 characters evolving from oracle-bone script to modern form (static images; optional).
- The school team quiz where a teammate makes a mistake (L14). The cannonball tree needing care (L15).
- Boss: **Give-Up Ghost**. The final phase is a tingxie of the child's *weakest* words, framed as "prove you can learn anything".
- Fragment: **Root Stroke**.
- Idioms: 恍然大悟, 涌上心头 and others.

**Region 7: Treehouse Summit & the Great Dictionary Tree (L16–17 + mixed pool)**
- A museum painting that pulls you into a polluted spring (L16). The ancestors' treehouse village rebuilt after an earthquake (L17).
- **Pre-boss restoration quest:** restore the ancestors' treehouse using the configured Region 7 learning objectives and reading key.
  Its reward is the seventh fragment, which completes the Brush.
  The quest must not require entering the Dictionary Tree or defeating the Great Forgetter.
- The Complete Brush then opens the Dictionary Tree.
- Final boss: **The Great Forgetter**, 5 phases mixing every question type, drawing from all regions' words (weighted to the child's weak words) and the untagged question pool.
- Ending: the spirits return to the Tree. Every lieutenant appears reformed. Credits roll over the child's Spirit Book stats.
- **Post-game:** all regions stay in review mode.
  Optional **Higher Chinese Challenge Scrolls** remain available through the opt-in challenge pool.

### 13.5 Dialogue style guide

- **English**, short sentences (at most 20 words), friendly and a little funny. Aim for a reading age of about 9–11.
- Chinese appears inline only for words being learned, always with meaning nearby the first time in a scene. Example: "I'm so 烦恼 (worried)!"
- **Muddled** villager lines swap or scramble 1–2 English words, never Chinese. Example: "Where did I put my… my… sugar? No, SALT!"
- Bosses are theatrical but never scary. No violence beyond cartoon "bonks". The endings are about redemption.

---

## 14. Technical architecture

### 14.1 Constraints

- **Plain HTML, CSS and JavaScript** (ES2020+ modules). No framework and no TypeScript required. The only runtime library is Hanzi Writer.
- **Content is separate from code.** The HTML file is a shell. All text, vocabulary, maps, dialogue, items and balance numbers live in JSON under `content/`. The JS modules contain logic only.
- Works on a **tablet** (touch, stylus) and a desktop browser. Target: latest Chrome, Safari (iPad) and Edge.
- **Offline-capable.** The game runs from a local static server during development. A bundle step also produces a **single-file `dist/index.html`** that runs by double-clicking or as a Claude artifact, like the prototype.
- **No backend.** Progress is saved in `localStorage`, one save per level, encoded (section 18.3), with export and import for moving devices.

### 14.2 Running

```
npm install              # dev dependencies only
npm run build:content    # for every level in content/source/: YAML → content/generated/<level>.*.json, extracts Hanzi Writer data, validates
npm run dev              # static server at http://localhost:5173 (ES modules and fetch need http, not file://)
npm test                 # unit tests (node --test)
npm run e2e              # Playwright smoke tests
npm run bundle           # dist/index.html: one file with JS, CSS and JSON inlined
```

`npm run dev` can be as simple as `npx http-server -c-1 -p 5173 .` or `python -m http.server 5173`.

### 14.3 Module layering

```
ui/  ─────▶ systems/, battle/, world/, learning/   (UI calls game logic; logic never touches the DOM directly
                                                    except through ui/ callbacks or events)
battle/, systems/, world/ ─▶ learning/, core/
learning/ ─▶ core/                                  (pure, unit-testable: no DOM, no canvas)
core/     = state, save, events, time, rng, config
```

- The logic modules in `learning/`, `systems/` and `battle/` must be **pure or state-only**, so that `node --test` can exercise them without a browser.
- A tiny event bus (`core/events.js`) carries events like `answer:correct`, `battle:won`, `word:tierChanged` and `day:changed`. Quests, streaks and milestones subscribe to it instead of being called from everywhere.

---

## 15. Repository layout

```
/
├─ index.html                 # shell: HUD, <canvas>, overlay root, D-pad; loads css/* and src/main.js
├─ gameplan.md                # this document
├─ README.md                  # how to run, build and add content
├─ package.json
├─ prototype/index.html       # original single-file prototype (reference only)
│
├─ css/
│  ├─ tokens.css              # colours, fonts, spacing, radii (section 16)
│  ├─ base.css                # reset, [hidden] rule, buttons, focus styles
│  ├─ hud.css  stage.css  overlay.css  dialog.css
│  ├─ battle.css  question.css  writing.css
│  ├─ book.css  town.css  room.css  parent.css
│
├─ src/
│  ├─ main.js                 # boot: load content → load or migrate save → init systems → start loop
│  ├─ config.js               # imports content/authored/balance.json and exposes tunables
│  ├─ core/        state.js  save.js  migrations.js  events.js  time.js  rng.js  safe.js
│  ├─ content/     loader.js  indexes.js           # fetch JSON; build words-by-lesson, exam-by-word, etc.
│  ├─ learning/    mastery.js  selection.js  questions.js  examAdapters.js  pinyin.js
│  │               writing.js  audio.js
│  ├─ world/       map.js  renderer.js  sprites.js  movement.js  input.js  interactions.js
│  │               encounters.js  camera.js
│  ├─ battle/      battle.js  enemy.js  boss.js  bossPhases.js  creatures.js  effects.js  damage.js
│  ├─ systems/     inventory.js  gear.js  crafting.js  economy.js  energy.js  gates.js
│  │               quests.js  streak.js  scrolls.js  sets.js  milestones.js  partners.js
│  │               villagers.js  dialogue.js  rival.js  room.js  parent.js
│  └─ ui/          dom.js  hud.js  overlay.js  toast.js  dialogView.js  questionView.js
│                  writingView.js  battleView.js  bossView.js  spiritBook.js  cardView.js
│                  shopView.js  craftView.js  boardView.js  questView.js  storyView.js
│                  roomView.js  travelView.js  parentView.js  characterView.js
│
├─ content/
│  ├─ source/                 # ORIGINAL YAML per level: copy as-is, never edit by hand
│  │  ├─ p2/                  # 19 lessons; source-ready, campaign not yet authored
│  │  ├─ p5/                  # 17 lessons; source-ready, Region 1 prototype exists
│  │  └─ p6/ …                # future levels
│  ├─ authored/               # hand-written game data (JSON), edited by humans
│  │  ├─ shared/              # used by every level
│  │  │  ├─ balance.json      # every tunable number (section 6)
│  │  │  ├─ strings.json      # UI strings in English
│  │  │  ├─ creatures.json  items.json  gear.json  recipes.json  materials.json
│  │  │  ├─ milestones.json  quest-templates.json
│  │  │  └─ levels.json       # list of levels: id, label, ready
│  │  ├─ campaign/             # shared seven-region world and Great Forgetter story
│  │  │  ├─ regions.json  maps/  villagers/  dialogue/  bosses.json
│  │  │  └─ sets/  idioms.json  word-tags.json  word-notes.json
│  │  └─ levels/
│  │     ├─ p2/level.json      # lesson mapping, feature flags and younger-player tuning
│  │     └─ p5/level.json      # lesson mapping, feature flags and tuning
│  └─ generated/              # written by tools/*; git-ignored or committed, never hand-edited
│     ├─ p5.content.json      # normalised words, sentences, stories, questions for P5
│     └─ p5.chars.json        # Hanzi Writer stroke data for P5's characters only
│
├─ vendor/hanzi-writer/       # hanzi-writer.min.js + LICENSE
├─ assets/                    # optional images, sprites, audio (none required for MVP)
├─ tools/
│  ├─ build-content.mjs       # for each level: parse YAML with js-yaml → <level>.content.json
│  ├─ build-chars.mjs         # read hanzi-writer-data/<char>.json → <level>.chars.json (strip radStrokes)
│  ├─ validate-content.mjs    # referential checks (section 17.3)
│  └─ bundle.mjs              # esbuild bundle + inline CSS/JSON → dist/index.html
└─ tests/
   ├─ unit/                   # mastery, selection, questions, pinyin, damage, quests, streak, migrations
   └─ e2e/                    # boot, walk, battle, writing (simulated strokes), save/reload
```

**Rule:** if something is text a person could want to change (dialogue, names, prices, numbers, map layout, word tags), it belongs in `content/authored/`, not in `src/`.
Nothing in `src/` may mention a specific level: the loader combines the shared campaign with the chosen level's curriculum and configuration.

---

## 16. Visual design system (keep the prototype's look)

- **Palette tokens (`css/tokens.css`):**
  - `--ink: #1B2430` (frame and text), `--ink2: #273445`, `--ink3: #3A4B60`
  - `--paper: #F4EFE2` (dialogue boxes and panels), `--paper2: #E9E1CC`, `--line: #CBBF9F`
  - `--jade: #2F8A66` (correct, HP), `--seal: #C63F2B` (seal stamps, wrong, weakness)
  - `--gold: #D9A62E`, `--silver: #8E9BAA`, `--bronze: #B06C35`
  - `--mist: #7F7AA6`
- **Fonts (Google Fonts, each with a fallback stack):**
  - UI and display: **Baloo 2** (500/700/800)
  - hanzi display (cards, big words, 米字格 results): **Ma Shan Zheng**, fallback KaiTi
  - Chinese body text: **Noto Sans SC**
- **Look:** a dark ink game frame around a canvas world; paper-textured panels with ink borders; cinnabar **seal stamps** for tiers (B / S / G) and on the creatures' sealed scrolls. It is deliberately a single theme; it doesn't need light and dark variants.
- **Layout:** HUD on top (level, XP bar, HP bar, coins, spirits, battles left, and the Spirit Book, Bag and Parents buttons). A 480:352 stage with overlays on top of it. D-pad and help text below.
- Minimum touch target 44 px. Must work at 400 px wide (phone) and on an iPad.
- Apply the 44 px minimum to close, back, audio and icon-only buttons as well as primary actions.
- **One useful objective at a time:** display a compact objective with purpose, destination, progress and a direct action.
  Example: "Help Mr Lin: practise 距离 (distance) from memory" with a "Practise with Mr Lin" action.
  Explain the first half-star when earned: "One half-star earned today; return another day to finish it."
  First use reveals a guided encounter, the first card and one villager request before introducing additional systems.
- The XP bar must also have the numeric label and shared celebration flow from section 6.1.
- **CSS naming:** prefix component classes (`.bt-…` battle, `.wr-…` writing, `.bk-…` book) to avoid collisions. The prototype had a bug where a `.stage` helper class collided with the game stage.
- Global rule: `[hidden]{display:none!important}`. Toggle visibility with `el.hidden`.
- Respect `prefers-reduced-motion`. Show visible focus rings. Never use colour alone for state: weakness also shows as text ("Weak to: Pinyin").

---

## 17. Data schemas (authored content)

Examples are illustrative; keep field names consistent. All IDs are kebab-case strings.

### 17.1 Generated content (`content/generated/<level>.content.json`, P5 example)

```json
{
  "level": "p5",
  "lessons": [{ "id": 1, "title": "第一课 (Lesson 1)" }],
  "words": [{
    "id": "p5-1-露营", "w": "露营", "p": "lù yíng", "m": "Camping", "lesson": 1,
    "ex": "我们全家去年去森林露营。",
    "sb": [["我们打算周末去山里露营。", "We plan to go camping in the mountains this weekend."]],
    "isIdiom": false
  }],
  "sentences": [{ "lesson": 1, "t": "…", "seg": ["…"], "en": "…" }],
  "stories": [{ "lesson": 1, "title": "《消失的“宝物”》", "pages": ["…", "…"] }],
  "questions": {
    "single": [{ "id": "NH-Q6", "kind": "vocab", "lessons": [1], "q": "…", "o": ["…"], "c": "集合",
                 "subject": "Chinese", "word": "集合" }],
    "groups": [{ "id": "TN-G1", "kind": "cloze", "lessons": [], "subject": "Chinese",
                 "passage": { "title": "…", "text": "…" }, "items": [{ "format": "MCQ", "q": "…", "o": [], "c": "…" }] }]
  }
}
```

- `word` on single questions is filled in by the build script using the mapping rules in 3.5.
- `isIdiom` means a four-character word listed in `idioms.json`.

### 17.2 Authored files (examples)

**`levels.json`** (shared) and **`levels/p5/level.json`**
```json
[{ "id": "p3", "label": "Primary 3", "ready": false },
 { "id": "p5", "label": "Primary 5", "ready": true }]
```
```json
{ "id": "p5", "label": "Primary 5", "book": "The Scholar Lands",
  "features": { "idioms": true, "comprehension": true, "practical": true, "dialogue": true,
                "cloze": true, "errorcorrect": true, "writing": true },
  "firstRegion": "r1", "finalBoss": "great-forgetter" }
```

**`regions.json`**
```json
[{ "id": "r1", "name": "Scholar Village", "lessons": [1,2,3], "tier": 1,
   "hubMap": "r1-hub", "zones": ["r1-camping","r1-misty","r1-garden"], "lairMap": "r1-lair",
   "bossId": "muddle-king", "bossGate": { "silverPct": 0.22, "keyItem": "cave-lantern" }, "nextGate": { "goldPct": 0.7 },
   "readingKeyItem": "cave-lantern",
   "fragment": "dawn-stroke" }]
```

**`maps/r1-camping.json`** (tile grid plus objects; the legend is shared)
```json
{ "id": "r1-camping", "name": "Camping Forest", "lesson": 1, "zone": true, "tint": "forest",
  "encounter": { "rate": 0.16, "types": { "fog": 3, "jumble": 2, "echo": 1 }, "eliteChance": 0.08, "goldenChance": 0.05 },
  "tiles": ["TTTTTTTT…", "T..,,,,.…"],
  "legend": { "T": "tree", ".": "grass", ",": "tallgrass", "=": "path", "~": "water", "F": "thickfog" },
  "objects": [
    { "type": "sign", "x": 3, "y": 2, "text": "Camping Forest · Lesson 1 words" },
    { "type": "chest", "x": 12, "y": 9, "id": "xiaoqiang-box", "requiresFlag": "q-xiaoqiang-2" },
    { "type": "warp", "x": 0, "y": 8, "to": "r1-hub", "tx": 38, "ty": 16 },
    { "type": "scrollSpot", "x": 7, "y": 14 }
  ] }
```

**`creatures.json`**
```json
[{ "id": "fog", "name": "Fogling", "weak": "m", "atk": "m", "spell": "Fog Cloud",
   "color": "#9C97BF", "art": "fog", "drop": "mist-drop" }]
```

**`items.json`**
```json
[{ "id": "rice-ball", "name": "Rice Ball", "zh": "饭团", "kind": "consumable", "price": 25,
   "effect": { "type": "heal", "amount": 10 }, "usableIn": ["battle","boss"] },
 { "id": "scholar-lantern", "name": "Scholar's Lantern", "kind": "consumable", "price": 30,
   "effect": { "type": "removeOption", "count": 1 }, "noTick": true }]
```

**`gear.json`** and **`recipes.json`**
```json
[{ "id": "jade-brush", "name": "Jade Brush", "slot": "brush", "mods": { "dmg.w": 1 } }]
[{ "id": "r-jade-brush", "makes": "jade-brush", "needs": { "ink-bead": 4, "mirror-shard": 2 }, "coins": 40,
   "unlockFlag": "q-xiaoqiang-done" }]
```

**`sets/r1.json`**
```json
[{ "id": "r1-campfire", "name": "Campfire", "words": ["露营","探险","集合","绑"], "tier": "silver",
   "restores": { "flag": "campfire-lit", "mapPatch": { "map": "r1-hub", "x": 20, "y": 18, "tile": "campfire" } },
   "reward": { "coins": 50, "dialogue": "r1-campfire-scene" } }]
```

**`villagers/r1.json`**
```json
[{ "id": "dad-lin", "name": "Mr Lin", "map": "r1-hub", "x": 26, "y": 14, "sprite": { "shirt": "#C9804B" },
   "muddledLines": ["Have you seen my… my… face windows? GLASSES!"],
   "clearLines": ["Rest your eyes every 30 minutes, like the doctor said!"],
   "requests": [
     { "id": "q-dad-1", "text": "Bring me Silver spirits of 模糊 and 眼圈.",
       "goal": { "type": "wordsTier", "words": ["模糊","眼圈"], "tier": "silver" } },
     { "id": "q-dad-2", "text": "Beat 3 Twin Shades on Misty Path.",
       "goal": { "type": "defeat", "creature": "twin", "map": "r1-misty", "count": 3 } },
     { "id": "q-dad-3", "text": "Write 距离 from memory for me.",
       "goal": { "type": "writeFromMemory", "word": "距离" } }],
   "reward": { "keyItem": "grandmas-lantern", "flag": "optician-fixed", "dialogue": "r1-dad-clear" } }]
```
The same file also lists the passage villagers for the Reading Hall:
```json
{ "passageVillagers": ["grandma","teller","xiaoqiang","dad-lin","chef-mei","ah-dong","gatekeeper"],
  "passageLeadIn": { "dad-lin": "Reading makes my eyes tired… but I loved that passage! Tell me:" } }
```

**Request goal types:**
- `wordsTier` (words reach a tier)
- `collect` (collect N spirits in a zone)
- `defeat` (beat N creatures of a type, optionally in a map)
- `writeFromMemory` (write a word from memory)
- `tingxie` (write N words well in a School tingxie)
- `readStory` (finish a story)
- `talk` (talk to a villager)
- `bring` (hand over an item)
- `flag` (a story flag is set)

**`dialogue/r1.json`** (a small script language)
```json
{ "r1-intro": [
    { "say": "Welcome to <b>Scholar Village</b>!", "who": "grandma" },
    { "say": "Everyone here has gone a bit… muddled.", "who": "grandma" },
    { "choice": [{ "text": "What happened?", "goto": "r1-intro-why" }, { "text": "Let's explore!", "end": true }] }
  ],
  "r1-intro-why": [
    { "say": "Come up to the attic. I'll show you.", "who": "grandma" },
    { "setFlag": "attic-open" }, { "give": { "keyItem": "spirit-brush-handle" } }
  ] }
```

**Script commands:**
- `say` (with `who`)
- `choice` (with `goto` or `end`)
- `setFlag`
- `if` (`flag` or `hasItem`, then a `then`/`else` script id)
- `give` (coins, item, gear or key item)
- `battle` (a scripted creature and word)
- `startBoss`
- `wait`
- `sfx`

**`bosses.json`**
```json
[{ "id": "muddle-king", "name": "Muddle King", "zh": "糊涂大王", "hp": 12, "art": "muddle-king",
   "introDialogue": "r1-boss-intro", "outroDialogue": "r1-boss-outro",
   "counterChance": 0.3, "counterDmg": 3, "wrongDmg": 5,
   "phases": [
     { "type": "chain", "count": 3, "source": { "kind": "conjunction", "lessons": [1,2,3] } },
     { "type": "scramble", "count": 2, "source": { "kind": "sentences", "lessons": [1,2,3] } },
     { "type": "ink", "count": 2, "source": { "words": "regionCollected" } },
     { "type": "scroll", "source": { "group": "TN-G1" } } ],
   "rewards": { "fragment": "dawn-stroke", "coins": 100, "xp": 80, "badge": "r1-badge" } }]
```

**`milestones.json`**, **`quest-templates.json`** and **`balance.json`** hold the tables from sections 6, 8.4 and 9.1 as data.

### 17.3 Content validation (`tools/validate-content.mjs`, run by `build:content`)

Fail the build if any of these is not true:

- Every word referenced in sets, villagers, idioms and word tags exists in the generated words.
- Every map warp points to an existing map and a walkable tile. Every map row has the same length.
- Every dialogue `goto` and every `dialogue` reference exists.
- Every recipe's materials and outputs exist. Every creature has a valid `weak`/`atk` skill and `art` function.
- Every boss phase source has enough questions for its `count`.
- Every character in every word exists in `<level>.chars.json`. If one doesn't, list the missing characters.
- Every level marked `ready` has a campaign folder. Every campaign region has 7 existing `passageVillagers`. Boss phases, Exam Day and chains only use types that `level.json` enables and that the level's content actually has.
- Every single question has 4 unique options, and `correct` is one of them.
- Gate percentages are in `[0, 1]`, and every playable region has at least one vocabulary word in its denominator.
- Required items and boss areas are reachable without circular prerequisites, including the seventh fragment before the Dictionary Tree.
- Required gate and idiom questions have reviewed options and a content-review status.

---

## 18. Save data

### 18.1 Schema (version 1)

`localStorage` keys:
- `wsq-profile`: `{"level":"p5"}`, the chosen level (plain JSON).
- `wsq-save-<level>`: that level's save, encoded (18.3). One per level.

The decoded save looks like this:

```json
{
  "version": 1, "level": "p5", "contentVersion": "1",
  "createdAt": "2026-09-22",
  "player": { "name": "", "level": 1, "xp": 0, "hp": 20, "coins": 20, "map": "r1-hub", "x": 20, "y": 14, "dir": "down",
              "gear": { "brush": "bamboo-brush", "charm": null, "hat": null } },
  "words": { "露营": { "c": 1, "st": { "m": 2, "p": 1, "h": 0, "u": 0, "w": 0 }, "ld": { "m": "2026-9-21" },
                        "r": 3, "x": 1, "rev": null, "revInterval": 3 } },
  "chars": { "露": { "lv": 1, "n": 2, "help": 1, "lb": 17 } },
  "inventory": { "rice-ball": 2 }, "materials": { "mist-drop": 3 }, "keyItems": ["spirit-brush-handle"],
  "ownedGear": ["bamboo-brush"], "partners": ["露营", null, null],
  "flags": { "attic-open": true }, "requests": { "q-dad-1": "done", "q-dad-2": 1 },
  "sets": { "r1-campfire": "done" }, "milestones": ["spirits-10"],
  "regions": { "r1": { "bossBeaten": false, "unlocked": true } },
  "daily": { "day": "2026-9-22", "battles": 3, "quests": [ { "tpl": "write-3", "progress": 1 } ], "chestOpened": false,
             "schoolRuns": 1, "scrollFound": false },
  "streak": { "count": 5, "lastDay": "2026-9-21", "freezesUsedWeek": "2026-W38" },
  "scrolls": ["scroll-12"], "stories": [1, 2],
  "reading": { "active": "HC-G3", "scroll": true, "done": ["CH-G2"], "results": { "0": { "how": "right" } }, "tries": { "2": 1 } },
  "written": [{ "day": "2026-9-22", "title": "大卫的成长", "q": "…", "a": "…", "ans": "…", "rating": "partly" }],
  "school": { "day": "2026-9-22", "runs": 1, "examWeek": "2026-9-21" }, "tampered": false,
  "stats": { "m": [10, 12], "p": [5, 9], "h": [7, 8], "u": [4, 6], "w": [3, 5], "c": [6, 8], "x": [2, 5] },
  "settings": { "daily": 15, "lenient": true, "speechRate": 0.85, "pin": null, "goal": null },
  "battleCounter": 17, "playMs": 0
}
```

### 18.2 Rules

- **Always migrate on load.** `migrations.js` exports an ordered list, e.g. `[v0→v1, v1→v2]`. After migrating, **fill in any missing fields from `freshState()`**, deeply for known objects.
  - The prototype froze on "Next" because an older save, carried over from the previous version of the page, was missing new fields.
- Save after every battle, request, purchase and dialogue end, and every 5 seconds while playing.
- **Recovery before autosave:** validate and migrate into temporary state before replacing live state.
  Preserve an unreadable or invalid payload unchanged and suspend autosave until the user chooses recovery or explicitly confirms a fresh start.
  Maintain a last-known-good backup separately from the active save.
  A failed storage write shows a persistent warning and offers export; it must not be silently ignored.
- Use local calendar dates (not UTC) for `day` keys. A `day:changed` event resets `daily`.
- Offer export and import using the envelope in section 18.3.
  Validate schema version, level identifier, content version, required field types and value ranges before committing an import.
  Reject unsupported future versions or wrong-level data without changing active progress.
  Back up the current valid save before a successful replacement.
- The first prototype's save key was `zilin-save-v1` (plain JSON). When there's no `wsq-save-p5`, load it into P5 once and migrate it.
- A save always belongs to one level. Never load one level's save while another level is active.

### 18.3 Save encoding (anti-tampering)

- Store each save as `WSQ1.<base64 of the UTF-8 JSON>.<checksum>`. The checksum is FNV-1a (32-bit, hex) of a fixed salt string plus the base64 text.
- On load: decode it, then recompute the checksum. If it doesn't match, **still load the save**, but set `tampered: true`. The parent panel then shows a notice (section 12). Never delete or reset automatically.
- Also accept plain JSON (older saves and imports) and re-save it in the encoded format.
- **Canonical export format:** a JSON envelope `{ "format": "wsq-export", "version": 1, "level": "p5", "contentVersion": "1", "save": "WSQ1.<body>.<checksum>" }`.
  The encoded save body also records its schema `version`, `level` and `contentVersion`; validate agreement with the envelope.
  The checksum remains in the encoded save string.
  Accept legacy encoded strings and plain-JSON saves through explicit migration; use the active selected level only for recognised legacy saves that lack a level field.
  New exports always use the envelope.
- **Be honest about the limits:** this stops casual editing (the text is unreadable in dev tools and any edit breaks the checksum), but it is **not** real security. The salt and code are visible to anyone who reads the page source. That is acceptable for a family game with no backend.

---

## 19. Testing and debug

### 19.1 Unit tests (`node --test`, no browser)

- **mastery:** a tick only once per day per skill; a star needs 2 days; tier thresholds; Writing ticks only for recall; review interval doubling and the demotion rule.
- **selection:** resting words excluded; the weights match the table; a peaceful zone returns `null`.
- **questions:**
  - for every word × skill (seeded random), the correct answer is among the options
  - there are 4 unique options, none `undefined`
  - exam-to-word mapping regexes
- **pinyin:** tone placement for `iu`, `ui` and `ü`; variants never equal the original.
- **damage and enemy turn:** formulas against a seeded random source.
- **quests, streak and freeze:** across simulated days.
- **migrations:** v0 (prototype) → v1 fills every field.
- **save encoding:** round-trips Chinese text; a changed character in the body sets `tampered`; plain JSON still loads.
- **levels:** saves are isolated per level; switching levels loads the right save; features switched off in `level.json` never appear.
- **Reading Hall:** questions map to villagers in order; retry and "I don't know" rules; finishing the first passage gives the key item exactly once.
- **content validation:** runs as a test too.
- **Approved tolerance:** three misses followed by a completed stroke can still earn a From memory tick; four-miss autofill, an explicit demonstration or giving up cannot.
- **Percentage gates:** use different region sizes and duplicate vocabulary references; verify ceiling rounding, Silver-or-better counting and level isolation.
- **Save recovery:** corrupt, truncated, unsupported-version and wrong-level imports cannot overwrite working progress; failed writes leave the previous good payload intact.
- **XP presentation:** one reward crossing several level thresholds grants progression once and queues one celebration containing every gained level.

### 19.2 End-to-end smoke tests (Playwright)

- Boot, dismiss the intro, walk into tall grass, then force a battle.
- Answer by clicking the correct option (read it from exposed test hooks), and see the enemy turn.
- **Writing:** simulate strokes by dragging the mouse along the Hanzi Writer `medians` from `chars.json`:
  - Convert with `x = left + pad + mx·s` and `y = top + pad + (900 − my)·s`, where `s = (size − 2·pad) / 1024`.
  - Assert the result is "Well done!", then tap Next and the battle continues. (This exact test caught the hang bug.)
- "I don't know" moves on and marks a fail.
- Reload and check the save persists; an old save migrates cleanly.
- Before expanding beyond Region 1, complete a multi-character write and a passage on a real target iPad, including the Chinese keyboard, stylus, scrolling and focus.
- Check repeated writing-screen entry and exit for leaked callbacks or stuck Next actions.
- Test the offline bundle, missing Chinese speech voices, local font fallbacks and 44 px touch targets during Region 1 work.
- Verify the numeric XP label and level-up celebration for battle and non-battle XP, with reduced motion and sound disabled.

### 19.3 Debug overlay (dev only, `?debug=1`)

- Shows the current word weights, the day (with the ability to fake the date: +1 day button), the daily counters and an HP log.
- Buttons: grant spirits, set tiers and open gates.

---

## 20. Build phases (in order, with acceptance criteria)

Each phase ends with a reviewable build and passing tests.
Do not start a phase before the previous phase's acceptance criteria are met.

The recommended sequence is shared foundation, P5 Region 1 parity, a P2 Lessons 1–3 vertical slice, real-device pilots, and only then broad campaign expansion.
The P2 slice deliberately happens before P5 Region 2 so that level-specific assumptions are found while the architecture is still easy to correct.

| Phase | Scope | Acceptance criteria |
|---|---|---|
| **P0 Setup — complete** | repo layout (15), `package.json`, vendor Hanzi Writer, `build-content`, `build-chars`, `validate-content` | `npm run build:content` produces normalized P2 and P5 JSON; validation passes; the missing-character lists are empty |
| **P1 Engine — complete** | modular shell under `game/`, CSS tokens, state/save/migrations/events, **level picker and per-level encoded preview saves**, shared map loading and rendering, movement, D-pad, interactions, overlay, dialogue box, toasts, HUD | P5 loads from data; the player can walk around `r1-hub`, talk to villagers and signs, and reload at the saved position; edited saves carry the tamper flag; prototype saves are copied without being overwritten |
| **P2 Learning core — complete** | questions (all 4 MCQ skills plus exam adapters), mastery, selection, audio, writing module (3 stages, pass/fail, Show me how, I don't know) | unit tests pass; `game/lab.html` can run any supported question or writing task for any P2 or P5 word; disabled question types never appear |
| **P3 Region 1 parity** | wild battles (5.1–5.5), enemy turn, creatures, Spirit Book, School (quiz, tingxie, Exam Day), Inn, Shop (Rice Ball), Storyteller, **Reading Hall passage quests (11.4)**, energy cap, parent panel (basic, with written answers) | everything the prototype does works, split into modules; the e2e writing test passes; a full passage chain can be finished and gives the Cave Lantern |
| **P4 Items and gear** | consumables, gear slots, materials drops, Craft Table, Character screen, player sprite shows gear | each item in 7.1 and 7.2 has a working effect; hint items suppress ticks |
| **P5 Collection** | partners (8.2), Spirit Sets and map patches (8.3), milestones (8.4), player room (9.5) | completing the Campfire set visibly lights the campfire; partner bonuses apply; milestones grant rewards once |
| **P6 Daily loops** | quest board and chest, Lantern Streak with freeze, Daily Scroll and Scroll Library | with a faked date: quests reset at midnight, the streak counts, a freeze applies silently once a week |
| **P7 Region 1 story** | dialogue engine (script commands), villagers and requests (Xiaoqiang, Mr Lin, Chef Mei), rival duel, tutorial battle, gate, Muddle King boss with 4 phases, reform scene, Dawn Stroke, hidden grove, next-region Gold gate | Region 1 can be played start to finish as a story; all requests complete; the boss is beatable and gives the fragment |
| **P8 Parent** | PIN, goals, weekly summary, export/import, unlock region, speech rate | a parent can set a goal and see progress in the room; import restores the save |
| **P9 P2 vertical slice** | run P2 Lessons 1–3 through the same Scholar Village, villagers, quests and Muddle King storyline; tune text density, battle difficulty and feature flags for younger children | P2 starts a separate save in the shared world, teaches its first words, completes one story and one battle loop, and never exposes unavailable content types; switching back to P5 restores the P5 save |
| **P10 Pilot and hardening** | child-and-parent sessions on the target tablet with both P2 and P5; accessibility, recovery, offline and performance fixes | observed blockers are resolved; save recovery is tested; a child can identify the next action without explanation; the team records a go/no-go decision for campaign expansion |
| **P11–P16 Shared Regions 2–7** | build each world region once, following 13.4, including new creature looks, sets, villagers, relevant passage chains, boss and fragment ability; map both levels' lessons into it | each region is completable with P2 and P5 content; the previous fragment opens that region's secret area; every required question type has enough reviewed content for the selected level |
| **P17 Multi-level completion** | finish and review every P2 and P5 lesson-to-region mapping, story insertion and level-specific tuning across the shared campaign | both levels can complete the same seven-region storyline; every lesson belongs to one region; sparse content types remain optional unless their pools are expanded and reviewed |
| **P18 Release polish** | bundle to `dist/index.html`, performance on an older iPad, accessibility pass, audio and content proofreading | a single file runs offline by double-click; Lighthouse accessibility is at least 90 on menu screens; P2 and P5 saves remain isolated through export, import and level switching |

**Scope guard:** complete P0–P10 before adding Region 2 to the shared world.

**Adding another level:** copy the YAML, create its lesson mapping, feature flags and tuning file, set it `ready`, and run the validator.
Do not duplicate or replace the shared world data.
No engine or campaign changes should be needed; if any are, the dependency should be moved into shared data or the level configuration.

---

## 21. Known pitfalls (learned from the prototype)

1. **Old save missing fields** makes the game freeze silently on "Next". Always migrate and deep-fill defaults (18.2). Wrap every "Next" and continue handler in `safe()`, which logs the error and returns to the map instead of freezing. Disable a button after it is clicked, so a double tap can't advance twice.
2. `display:flex` on an overlay overrides the `hidden` attribute. Add `[hidden]{display:none!important}`.
3. **CSS class collisions** (`.stage`). Prefix component classes.
4. **Double-counting stats:** only `mastery.record()` should update accuracy stats. Don't also increment them at the call site.
5. **Treating a result object as a boolean:** a quiz runner received `{ok:false}`, which is truthy, and counted it as correct. Normalise results to `{ ok, ... }` everywhere.
6. **Hanzi Writer:**
   - Don't rely on the CDN for character data; vendor a subset.
   - It adds `mouseup` and `touchend` listeners on the whole document each time a writer is created. Reuse one writer per writing screen with `setCharacter()` rather than creating many.
   - Call `cancelQuiz()` before animating.
   - The grid box must have `touch-action: none`.
7. **`file://`** blocks ES modules and `fetch`. Use the dev server, or the bundled single file.
8. **speechSynthesis:** the list of voices loads asynchronously, and some Windows machines have no zh-CN voice. Detect this and show a one-time tip to the parent: "Install the Chinese (Simplified) speech pack in Windows settings".
9. **Scramble phase:** merge punctuation segments into the previous segment. If a shuffle comes out already in order, reshuffle.
10. **Option lists:** remove duplicates and `undefined`, and always check that `correct` is among the options.
11. **Exam text:** strip bracketed Chinese instructions and add an English instruction line (3.5). Some `usage` stems don't match the regex; fall back to a generic English line.
12. **Stars per day** confuse children the first time. Show "Half-star today, finish it tomorrow!" on the win screen, and explain it in the Spirit Book header.
13. **Open written answers can't be auto-marked.** Never make a required step depend on a written answer being *right*: completion (answered, compared with the model answer, rated) is what counts. "I don't know" must always be available.
14. **Base64 saves:** `btoa` fails on Chinese text. Encode the JSON to UTF-8 bytes first (`TextEncoder`), then base64, and reverse with `TextDecoder`.

---

## Appendix A: Kickoff prompt for a coding agent

> You are building **Word Spirit Quest**, an educational RPG in plain HTML, CSS and ES-module JavaScript.
> Read `gameplan.md` fully before writing code; it is the spec, and it overrides the reference prototype in `prototype/index.html`.
> The P2 and P5 school content is in `content/source/<level>/` as YAML, and nothing in `src/` may be specific to either level.
> Work phase by phase from section 20, starting with **P0**.
> For each phase: list the files you will create or change, implement, add or extend the tests named in section 19, run `npm run build:content && npm test`, and summarise what works and what remains.
> Hard rules: all UI and dialogue is in English, with Chinese only for learning content; all game text, numbers, maps and dialogue belongs in `content/authored/*.json`, never in `src/`; no answers, stars or unlocks are purchasable with coins; there are no timers or guilt-based streak messages.
> Ask before changing any rule in sections 1, 3 or 10.

## Appendix B: Glossary

- **字灵 (Word Spirit):** a collectible vocabulary word.
- **Tick / star / tier:** see 3.2.
- **听写 (tingxie):** dictation; the child hears a word and writes it.
- **米字格:** a practice grid with diagonal guide lines.
- **成语 (chengyu):** four-character idiom; these become special moves.
- **Brush Fragment:** a key item from each boss that grants a map ability.
- **Review mode:** a cleared region's state, with fewer, mostly review, encounters.
- **Level:** a school year's curriculum pack (P2, P5 …) played through the shared campaign with its own save.
- **Passage Scroll / passage villagers:** the Reading Hall's current passage and the villagers who each ask one of its questions.
