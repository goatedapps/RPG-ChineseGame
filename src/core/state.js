export const SAVE_SCHEMA_VERSION = 2;

export function createFreshState(levelPackage) {
  const spawn = levelPackage.map.spawn;
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    level: levelPackage.id,
    contentVersion: levelPackage.content.contentVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tampered: false,
    player: {
      name: '',
      level: 1,
      xp: 0,
      hp: 20,
      maxHp: 20,
      coins: 20,
      map: levelPackage.map.id,
      x: spawn.x,
      y: spawn.y,
      direction: spawn.direction || 'down'
    },
    progress: {
      words: {},
      characters: {},
      flags: {},
      quests: {},
      stories: [],
      battles: 0
    },
    settings: {
      dailyBattles: 15,
      lenientWriting: true,
      sound: true
    },
    session: {
      playMs: 0,
      seenWelcome: false
    }
  };
}

function numberOr(value, fallback, minimum = 0) {
  return Number.isFinite(value) && value >= minimum ? value : fallback;
}

export function migrateState(candidate, levelPackage) {
  const fresh = createFreshState(levelPackage);
  if (!candidate || typeof candidate !== 'object') return fresh;

  if (candidate.schemaVersion === SAVE_SCHEMA_VERSION) {
    if (candidate.level !== levelPackage.id) throw new Error(`This save belongs to ${candidate.level}, not ${levelPackage.id}.`);
    const player = candidate.player || {};
    return {
      ...fresh,
      ...candidate,
      schemaVersion: SAVE_SCHEMA_VERSION,
      level: levelPackage.id,
      contentVersion: levelPackage.content.contentVersion,
      player: {
        ...fresh.player,
        ...player,
        level: numberOr(player.level, 1, 1),
        xp: numberOr(player.xp, 0),
        hp: numberOr(player.hp, 20),
        maxHp: numberOr(player.maxHp, 20, 1),
        coins: numberOr(player.coins, 20),
        x: numberOr(player.x, fresh.player.x),
        y: numberOr(player.y, fresh.player.y)
      },
      progress: { ...fresh.progress, ...(candidate.progress || {}) },
      settings: { ...fresh.settings, ...(candidate.settings || {}) },
      session: { ...fresh.session, ...(candidate.session || {}) }
    };
  }

  const legacyLevel = candidate.level || levelPackage.id;
  if (legacyLevel !== levelPackage.id) throw new Error(`This save belongs to ${legacyLevel}, not ${levelPackage.id}.`);
  const maxX = levelPackage.map.width - 2;
  const maxY = levelPackage.map.height - 2;
  return {
    ...fresh,
    tampered: Boolean(candidate.tampered),
    player: {
      ...fresh.player,
      level: numberOr(candidate.lvl, 1, 1),
      xp: numberOr(candidate.xp, 0),
      hp: numberOr(candidate.hp, 20),
      maxHp: Math.max(20, 18 + numberOr(candidate.lvl, 1, 1) * 2, numberOr(candidate.hp, 20)),
      coins: numberOr(candidate.coins, 20),
      x: Math.min(maxX, numberOr(candidate.x, fresh.player.x)),
      y: Math.min(maxY, numberOr(candidate.y, fresh.player.y)),
      direction: candidate.dir || fresh.player.direction
    },
    progress: {
      ...fresh.progress,
      words: candidate.words || {},
      characters: candidate.chars || {},
      stories: candidate.stories || [],
      battles: numberOr(candidate.battles, 0),
      legacySnapshot: {
        boss: Boolean(candidate.boss),
        keyItems: candidate.keyItems || [],
        reading: candidate.reading || null
      }
    },
    settings: {
      ...fresh.settings,
      dailyBattles: candidate.settings?.daily ?? fresh.settings.dailyBattles,
      lenientWriting: candidate.settings?.lenient ?? fresh.settings.lenientWriting
    },
    session: {
      ...fresh.session,
      playMs: numberOr(candidate.playMs, 0),
      migratedFromPrototype: true
    }
  };
}
