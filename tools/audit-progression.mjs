import fs from 'node:fs';
import { battleRewardAmounts, enemyAttack } from '../src/battle/battle.js';
import { createBoss } from '../src/battle/creatures.js';
import { calculateDamage, heroStats } from '../src/battle/damage.js';
import { xpToNextLevel } from '../src/core/progression.js';
import { gateStatus } from '../src/systems/story.js';

const readJson = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const shared = readJson('content/authored/shared/balance.json');

function addXp(player, amount) {
  player.xp += amount;
  while (player.xp >= xpToNextLevel(player.level)) {
    player.xp -= xpToNextLevel(player.level);
    player.level += 1;
    player.maxHp = 18 + player.level * 2;
  }
  player.hp = player.maxHp;
}

function bossOutcome(player, boss) {
  let hp = boss.maxHp;
  let hero = { ...player };
  let turns = 0;
  while (hp > 0 && hero.hp > 0 && turns < 12) {
    turns += 1;
    hp -= calculateDamage({ attack: heroStats(hero.level).attack, defense: boss.defense, moveBonus: 2, roll: 1.5 });
    if (hp > 0) hero = enemyAttack({ creature: boss }, hero, () => 1, { damageMultiplier: 0.8 }).player;
  }
  return { turns, won: hp <= 0 && hero.hp > 0, remainingHp: hero.hp };
}

export function auditLevel(levelId, { battlesPerCard = 1, practiceAnswersPerCard = 2 } = {}) {
  const config = readJson(`content/authored/levels/${levelId}/level.json`);
  const content = readJson(`content/generated/${levelId}.content.json`);
  const balance = { ...shared, combat: { ...shared.combat, ...(config.tuning?.balance?.combat || {}) } };
  const player = { level: 1, xp: 0, hp: 20, maxHp: 20, coins: 0 };
  const rows = [];

  for (let regionNumber = 1; regionNumber <= 7; regionNumber += 1) {
    const regionId = `r${regionNumber}`;
    const lessons = config.regionLessons[regionId];
    const words = content.words.filter(word => lessons.includes(word.lesson));
    const selected = words.slice(0, Math.ceil(words.length * 0.7));
    const progress = { words: {} };
    for (const word of selected) {
      const [minimum, maximum] = balance.combat.lessonLevels[String(word.lesson)];
      const creatureLevel = Math.floor((minimum + maximum) / 2);
      for (let battle = 0; battle < battlesPerCard; battle += 1) {
        const reward = battleRewardAmounts(player.level, creatureLevel, balance);
        addXp(player, reward.xp);
        player.coins += reward.coins;
      }
      addXp(player, practiceAnswersPerCard * balance.school.xpPerCorrect);
      progress.words[word.w] = { collected: true, ticks: { m: 1, p: 1, h: 1 } };
    }
    const story = readJson(`content/authored/campaign/${regionId}-story.json`);
    const gate = gateStatus({ content, config, region: { id: regionId }, regionStory: story }, progress, { keyItems: [story.readingKeyItem || 'cave-lantern'] }, story.gateBronzePct);
    const boss = createBoss(balance, lessons);
    const nextLessons = config.regionLessons[`r${regionNumber + 1}`];
    const nextMinimum = nextLessons ? Math.min(...nextLessons.map(lesson => balance.combat.lessonLevels[String(lesson)][0])) : null;
    rows.push({ region: regionId, cards: `${selected.length}/${words.length}`, gate: gate.open, hero: player.level, boss: boss.level, bossOutcome: bossOutcome(player, boss), nextMinimum, nextGap: nextMinimum == null ? null : nextMinimum - player.level, coins: player.coins });
  }
  return rows;
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('audit-progression.mjs')) {
  for (const levelId of ['p2', 'p5']) {
    console.log(`\n${levelId.toUpperCase()} · one battle/card and two correct practice answers/card`);
    console.table(auditLevel(levelId));
  }
}
