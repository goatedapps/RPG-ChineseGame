import { migrateState } from './state.js?p8';

const SAVE_PREFIX = 'WSQ2';
const SAVE_SALT = 'word-spirit-quest|modular|v2|';
const LEGACY_SALT = 'wsq·字灵·v1';
export const PROFILE_KEY = 'wsq-next-profile';
export const saveKey = level => `wsq-next-save-${level}`;
export const recoveryKey = level => `${saveKey(level)}-recovery`;

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

export function loadLevelState(storage, levelPackage) {
  const key = saveKey(levelPackage.id);
  const current = storage.getItem(key);
  if (current) {
    try {
      return { state: migrateState(decodeSave(current), levelPackage), migrated: false, warning: '' };
    } catch (error) {
      storage.setItem(recoveryKey(levelPackage.id), current);
      return { state: migrateState(null, levelPackage), migrated: false, warning: error.message, blocked: true };
    }
  }

  const legacy = storage.getItem(`wsq-save-${levelPackage.id}`)
    || (levelPackage.id === 'p5' ? storage.getItem('zilin-save-v1') : null);
  if (legacy) {
    try {
      const state = migrateState(decodeSave(legacy), levelPackage);
      storage.setItem(key, encodeSave(state));
      return { state, migrated: true, warning: '' };
    } catch (error) {
      storage.setItem(recoveryKey(levelPackage.id), legacy);
      return { state: migrateState(null, levelPackage), migrated: false, warning: error.message, blocked: true };
    }
  }
  return { state: migrateState(null, levelPackage), migrated: false, warning: '' };
}

export function saveLevelState(storage, state) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  storage.setItem(saveKey(state.level), encodeSave(next));
  return next;
}

export function loadProfile(storage) {
  try {
    return JSON.parse(storage.getItem(PROFILE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveProfile(storage, level) {
  storage.setItem(PROFILE_KEY, JSON.stringify({ level }));
}

export function exportSaveEnvelope(state) {
  return { format: 'word-spirit-quest-save', version: 1, level: state.level, exportedAt: new Date().toISOString(), encodedSave: encodeSave(state) };
}

export function importSaveEnvelope(envelope, levelPackage) {
  if (!envelope || envelope.format !== 'word-spirit-quest-save' || envelope.version !== 1) throw new Error('This is not a supported Word Spirit Quest export.');
  if (envelope.level !== levelPackage.id) throw new Error(`Choose a ${levelPackage.id.toUpperCase()} Word Spirit Quest export.`);
  return migrateState(decodeSave(envelope.encodedSave), levelPackage);
}
