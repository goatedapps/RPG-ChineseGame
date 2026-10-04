import { createFreshState, migrateState } from './state.js?p14';

const SAVE_PREFIX = 'WSQ2';
const SAVE_SALT = 'word-spirit-quest|modular|v2|';
const LEGACY_SALT = 'wsq·字灵·v1';
export const PROFILE_KEY = 'wsq-next-profile';
export const PLAYERS_KEY = 'wsq-next-players';
export const LEGACY_PLAYER_ID = 'legacy';
export const saveKey = (level, playerId = LEGACY_PLAYER_ID) => playerId === LEGACY_PLAYER_ID ? `wsq-next-save-${level}` : `wsq-next-save-${playerId}-${level}`;
export const recoveryKey = (level, playerId = LEGACY_PLAYER_ID) => `${saveKey(level, playerId)}-recovery`;
export const backupKey = (level, playerId = LEGACY_PLAYER_ID) => `${saveKey(level, playerId)}-backup`;

export function listPlayers(storage, levelIds = ['p2', 'p5']) {
  const raw = storage.getItem(PLAYERS_KEY);
  let players = [];
  if (raw !== null) {
    try { players = JSON.parse(raw); }
    catch { throw new Error('The saved player list is unreadable. Its original data has been left in place.'); }
    if (!Array.isArray(players) || players.some(player => !player || (player.id !== LEGACY_PLAYER_ID && !/^player-[a-z0-9]+$/.test(player.id)) || typeof player.name !== 'string' || !player.name.trim()) || new Set(players.map(player => player.id)).size !== players.length) {
      throw new Error('The saved player list is unreadable. Its original data has been left in place.');
    }
  }
  const lastProfile = loadProfile(storage);
  const legacySave = levelIds.some(level => storage.getItem(saveKey(level)) || storage.getItem(`wsq-save-${level}`))
    || storage.getItem('zilin-save-v1') || (lastProfile && (!lastProfile.playerId || lastProfile.playerId === LEGACY_PLAYER_ID));
  if (legacySave && !players.some(player => player.id === LEGACY_PLAYER_ID)) return [{ id: LEGACY_PLAYER_ID, name: 'Player 1' }, ...players];
  return players;
}

export function createPlayer(storage, name, levelIds) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > 32 || /[\p{Cc}\p{Cf}]/u.test(clean)) throw new Error('Enter a name of 1–32 characters.');
  const players = listPlayers(storage, levelIds);
  if (players.some(player => player.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error('That name is already in use. Choose it above or enter another name.');
  let id;
  do { id = `player-${Math.random().toString(36).slice(2, 10)}`; } while (players.some(player => player.id === id));
  const player = { id, name: clean };
  storage.setItem(PLAYERS_KEY, JSON.stringify([...players, player]));
  return player;
}

export function renamePlayer(storage, playerId, name, levelIds) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > 32 || /[\p{Cc}\p{Cf}]/u.test(clean)) throw new Error('Enter a name of 1–32 characters.');
  const players = listPlayers(storage, levelIds);
  if (!players.some(player => player.id === playerId)) throw new Error('Choose an existing player first.');
  if (players.some(player => player.id !== playerId && player.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error('That name is already in use.');
  const updated = players.map(player => player.id === playerId ? { ...player, name: clean } : player);
  storage.setItem(PLAYERS_KEY, JSON.stringify(updated));
  return updated.find(player => player.id === playerId);
}

export function checksum(text, salt = SAVE_SALT) {
  let hash = 0x811c9dc5;
  const input = `${salt}${text}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(text) {
  const bytes = typeof Buffer !== 'undefined'
    ? Uint8Array.from(Buffer.from(text, 'base64'))
    : Uint8Array.from(atob(text), character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSave(state) {
  const body = encodeBase64(JSON.stringify(state));
  return `${SAVE_PREFIX}.${body}.${checksum(body)}`;
}

export function decodeSave(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.startsWith(`${SAVE_PREFIX}.`)) {
    const [, body, signature] = raw.split('.');
    const state = JSON.parse(decodeBase64(body));
    if (checksum(body) !== signature) state.tampered = true;
    return state;
  }
  if (raw.startsWith('WSQ1.')) {
    const [, body, signature] = raw.split('.');
    const state = JSON.parse(decodeBase64(body));
    if (checksum(body, LEGACY_SALT) !== signature) state.tampered = true;
    return state;
  }
  if (raw.trim().startsWith('{')) return JSON.parse(raw);
  throw new Error('Unsupported save format.');
}

export function loadLevelState(storage, levelPackage, playerId = LEGACY_PLAYER_ID) {
  const key = saveKey(levelPackage.id, playerId);
  const current = storage.getItem(key);
  if (current) {
    try {
      return { state: migrateState(decodeSave(current), levelPackage), migrated: false, warning: '' };
    } catch (error) {
      storage.setItem(recoveryKey(levelPackage.id, playerId), current);
      const backup = storage.getItem(backupKey(levelPackage.id, playerId));
      if (backup) {
        try {
          const state = migrateState(decodeSave(backup), levelPackage);
          storage.setItem(key, backup);
          return { state, migrated: false, recovered: true, warning: `The latest save was unreadable. The last known-good backup was restored. ${error.message}` };
        } catch {
          // Preserve both payloads and require an explicit recovery choice below.
        }
      }
      return { state: migrateState(null, levelPackage), migrated: false, warning: error.message, blocked: true };
    }
  }

  const legacy = playerId === LEGACY_PLAYER_ID ? storage.getItem(`wsq-save-${levelPackage.id}`)
    || (levelPackage.id === 'p5' ? storage.getItem('zilin-save-v1') : null) : null;
  if (legacy) {
    try {
      const state = migrateState(decodeSave(legacy), levelPackage);
      storage.setItem(key, encodeSave(state));
      return { state, migrated: true, warning: '' };
    } catch (error) {
      storage.setItem(recoveryKey(levelPackage.id, playerId), legacy);
      return { state: migrateState(null, levelPackage), migrated: false, warning: error.message, blocked: true };
    }
  }
  return { state: migrateState(null, levelPackage), migrated: false, warning: '' };
}

export function saveLevelState(storage, state, playerId = LEGACY_PLAYER_ID) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  const key = saveKey(state.level, playerId);
  const previous = storage.getItem(key);
  if (previous) storage.setItem(backupKey(state.level, playerId), previous);
  storage.setItem(key, encodeSave(next));
  return next;
}

export function startFreshLevelState(storage, levelPackage, playerId = LEGACY_PLAYER_ID) {
  const state = createFreshState(levelPackage);
  storage.setItem(saveKey(levelPackage.id, playerId), encodeSave(state));
  storage.removeItem(backupKey(levelPackage.id, playerId));
  return state;
}

export function loadProfile(storage) {
  try {
    return JSON.parse(storage.getItem(PROFILE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveProfile(storage, level, playerId = LEGACY_PLAYER_ID) {
  storage.setItem(PROFILE_KEY, JSON.stringify({ level, playerId }));
}

export function exportSaveEnvelope(state) {
  return { format: 'word-spirit-quest-save', version: 1, level: state.level, exportedAt: new Date().toISOString(), encodedSave: encodeSave(state) };
}

export function importSaveEnvelope(envelope, levelPackage) {
  if (!envelope || envelope.format !== 'word-spirit-quest-save' || envelope.version !== 1) throw new Error('This is not a supported Word Spirit Quest export.');
  if (envelope.level !== levelPackage.id) throw new Error(`Choose a ${levelPackage.id.toUpperCase()} Word Spirit Quest export.`);
  return migrateState(decodeSave(envelope.encodedSave), levelPackage);
}
