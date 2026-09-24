export const SAVE_SCHEMA_VERSION = 5;

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
      battles: 0,
      energy: { day: '', used: 0 },
      school: { day: '', runs: 0, examWeek: '' },
      inventory: { 'rice-ball': 1, keyItems: [] },
      equipment: { owned: ['bamboo-brush'], equipped: { brush: 'bamboo-brush', charm: null, hat: null } },
      materials: {},
      baits: [],
      encounter: { cooldown: 3, zone: null, capNoticeDay: '' },
      activity: {},
      parent: { goal: null },
      partners: [],
      sets: {},
      milestones: [],
      room: { decorations: [], trophies: [] },
      daily: { day: '', quests: [], chestClaimed: false, completedToday: false },
      streak: { count: 0, lastDay: '', freezeWeek: '' },
      scrolls: { day: '', found: false, unlocked: [] },
      story: {
        flags: {}, bossDefeated: false, fragment: null, rivalDuels: 0,
        requests: { xiaoqiang: 0, 'mr-lin': 0, 'chef-mei': 0 },
        counters: { creatures: {}, writing: {}, tingxieLesson3: 0 }, storiesRead: []
      },
      reading: { completed: [], active: null, index: 0, results: {}, written: [] },
      accuracy: {}
    },
    settings: {
      dailyBattles: 15,
      lenientWriting: true,
      sound: true,
      speechRate: 0.85,
      unlockedRegions: 1,
      testMode: false,
      sendWrittenAnswers: true
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

  if (candidate.schemaVersion >= 2) {
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
      progress: {
        ...fresh.progress,
        ...(candidate.progress || {}),
        energy: { ...fresh.progress.energy, ...(candidate.progress?.energy || {}) },
        school: { ...fresh.progress.school, ...(candidate.progress?.school || {}) },
        inventory: { ...fresh.progress.inventory, ...(candidate.progress?.inventory || {}) },
        equipment: { ...fresh.progress.equipment, ...(candidate.progress?.equipment || {}) },
        materials: { ...fresh.progress.materials, ...(candidate.progress?.materials || {}) },
        baits: Array.isArray(candidate.progress?.baits) ? candidate.progress.baits : [],
        encounter: { ...fresh.progress.encounter, ...(candidate.progress?.encounter || {}) },
        activity: { ...fresh.progress.activity, ...(candidate.progress?.activity || {}) },
        parent: { ...fresh.progress.parent, ...(candidate.progress?.parent || {}) },
        partners: Array.isArray(candidate.progress?.partners) ? candidate.progress.partners : [],
        sets: { ...fresh.progress.sets, ...(candidate.progress?.sets || {}) },
        milestones: Array.isArray(candidate.progress?.milestones) ? candidate.progress.milestones : [],
        room: { ...fresh.progress.room, ...(candidate.progress?.room || {}) },
        daily: { ...fresh.progress.daily, ...(candidate.progress?.daily || {}) },
        streak: { ...fresh.progress.streak, ...(candidate.progress?.streak || {}) },
        scrolls: { ...fresh.progress.scrolls, ...(candidate.progress?.scrolls || {}) },
        story: {
          ...fresh.progress.story,
          ...(candidate.progress?.story || {}),
          flags: { ...fresh.progress.story.flags, ...(candidate.progress?.story?.flags || {}) },
          requests: { ...fresh.progress.story.requests, ...(candidate.progress?.story?.requests || {}) },
          counters: {
            ...fresh.progress.story.counters,
            ...(candidate.progress?.story?.counters || {}),
            creatures: { ...fresh.progress.story.counters.creatures, ...(candidate.progress?.story?.counters?.creatures || {}) },
            writing: { ...fresh.progress.story.counters.writing, ...(candidate.progress?.story?.counters?.writing || {}) }
          },
          storiesRead: Array.isArray(candidate.progress?.story?.storiesRead) ? candidate.progress.story.storiesRead : []
        },
        reading: { ...fresh.progress.reading, ...(candidate.progress?.reading || {}) },
        accuracy: { ...fresh.progress.accuracy, ...(candidate.progress?.accuracy || {}) }
      },
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
      energy: candidate.energy || fresh.progress.energy,
      school: candidate.school || fresh.progress.school,
      inventory: {
        ...fresh.progress.inventory,
        'rice-ball': numberOr(candidate.potions, 1),
        keyItems: candidate.keyItems || []
      },
      reading: {
        ...fresh.progress.reading,
        ...(candidate.reading || {}),
        written: candidate.written || []
      },
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
