module.exports = function(notes, conflicts) {
  function update(id, status, title, current, decision, acceptance) {
    const note=notes.find(n=>n[1]===id);
    if(title) note[2]=title;
    if(current) note[4]=current;
    note[5]=decision;
    note[6]=acceptance;
    note[7]=status;
  }
  update('01','Keep current','Keep the four-miss writing tolerance',null,
    'Your decision: retain the current threshold. Automatic hints below four misses do not set helped; imperfect tracing may not reflect the student’s intent. Autofill at four misses, Show me how and I don’t know still count as help. Keep the existing pinyin, meaning and audio clues.',
    'Updated acceptance: three misses followed by a completed stroke may still earn a From memory tick. Four-miss autofill or explicit help cannot. The stricter hint policy and audio-only change are withdrawn.');
  update('02','Accepted','Award the final fragment before entering the Tree',null,
    'Accepted and added to the plan: six lieutenants award fragments 1–6. A Region 7 treehouse restoration quest awards fragment 7 before the Tree opens; then the child faces the Great Forgetter. No seventh lieutenant is needed.',
    'Acceptance: the restoration quest has no prerequisite inside the Tree; every required item and boss is reachable without an override.');
  update('03','Updated','Use percentages for every level’s progression',
    'Your decision: replace fixed Silver and Gold counts with percentages so different vocabulary totals work correctly. The denominator is each region’s distinct vocabulary in the selected level; required counts are rounded up.',
    'The plan now stores silverPct and goldPct. Region 1 uses 22% Silver-or-better, preserving 12 of 54 in P5; the default for later regions is 35%. The existing Gold threshold remains 70%, giving 38 of 54 in this example. These are derived counts, never cross-level constants. Show both percentages and counts.',
    'Acceptance: test multiple region sizes, duplicate words and ceiling rounding. The 54-word example still requires 380 qualifying successes for 38 Gold; it is an illustration, not a fixed requirement or duration estimate.');
  update('04','Updated','Random same-level passages; Higher Chinese is optional',null,
    'Your clarification: same-level passages are roughly equivalent in difficulty. Keep random selection from the level’s standard-Chinese pool without regional matching or curated starter passages. Higher Chinese becomes a separate opt-in challenge and never gates required progress.',
    'Acceptance: required Reading Hall passages come from the chosen level’s standard pool; Higher Chinese appears only when opted into. Completion with help remains sufficient.');
  update('05','Keep current','Keep the existing self-marking and rewards',null,
    'Your decision: retain Got it / Partly / Not yet, the current 10 / 6 / 3 coin rewards and the existing Reading summary. Keep parent access to written answers and self-ratings. The equal-reward and separate-metric proposal is withdrawn.',
    'Interpretation remains explicit: Reading includes self-rated answers; it is not an independently marked assessment. No change to the current scoring policy.');
  update('06','Accepted',null,null,
    'Accepted and specified: implement the 3 → 6 → 12 → 24 → 30 day schedule and failed-skill tick loss. Failed review resets the interval to 3; re-mastery begins another three-day rest. Successful completed reviews update only their own word; running, fainting or item-assisted answers cannot extend it. Preserve completed collection rewards.',
    'Acceptance: simulate interval growth, wrong defensive reviews, assistance under the retained four-miss rule and re-mastery without duplicated rewards.');
  update('07','Keep current','Keep current reward rules; use 30–60 minute sessions',null,
    'Your decision: keep the parent battle cap, three paid school sessions, continuing school XP and current passage rewards. Do not add a shared daily reward budget. The intended session is now 30 minutes to one hour; it is not a required minimum or countdown.',
    'The proposed reward-budget restriction is withdrawn. Active-time reporting remains a separate observation for later review; no new tracking policy was approved in this annotation.');
  update('08','Accepted',null,null,
    'Accepted and added: preserve invalid payloads, suspend autosave pending recovery, retain a last-known-good backup and show storage failures. Exports use one JSON envelope containing format, schema version, level, content version and the encoded save with its checksum. Validate before replacing live state.',
    'Acceptance: corrupt, truncated, wrong-level and unsupported-version imports leave live progress intact; legacy saves migrate explicitly.');
  for(const id of ['09','10','11','12']) {
    const n=notes.find(n=>n[1]===id);
    n[7]='Accepted';
    n[5]='Accepted and added to gameplan.md: '+n[5];
  }
  notes.push(['high','13','Make XP visible and level-ups celebratory','Your annotation · §6.1 · prototype: gainXp(), refreshHud(), bWin()',
    'The prototype has an XP bar and increments levels, but the HUD updates bar width and the win screen appends a small Level up message. Your experience is that XP and level changes are not obvious.',
    'Show a numeric label such as Level 3 · XP 24 / 90, visible XP gain, and a dedicated Level up! panel showing the new level, HP increase and restored HP. Use a brief animation, optional sound and a Continue button. All XP sources share the flow; one reward crossing multiple levels gets one combined celebration.',
    'Acceptance: no missed or duplicated celebration across battle, school, reading and quests; respects reduced motion and sound settings. This is specified, not yet implemented in the prototype.','Added']);
  notes.push(['medium','14','Add Instant Noodles between the existing heals','Your annotation · §7.1',
    'Rice Ball restores 10 HP for 25 coins; Mooncake restores all HP for 80 coins.',
    'Added Instant Noodles 方便面: restore 20 HP, capped at the player’s maximum, for 50 coins. These initial balance values place it between Rice Ball and Mooncake in price and healing tier. At low max HP, it may already give a full heal.',
    'Acceptance: the item is usable wherever battle healing consumables are allowed, consumes one item and never raises HP above max. Balance values can be adjusted in authored data.','Added']);
  conflicts.splice(conflicts.findIndex(x=>x[0]==='Gate arithmetic'),1);
  conflicts.splice(conflicts.findIndex(x=>x[0]==='Writing stages'),1);
};
