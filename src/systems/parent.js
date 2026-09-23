const PIN_KEY = 'wsq-next-parent-pin';
const PIN_SALT = 'word-spirit-parent|modular|v1|';

function hash(value) {
  let output = 0x811c9dc5;
  for (const character of `${PIN_SALT}${value}`) {
    output ^= character.charCodeAt(0);
    output = Math.imul(output, 0x01000193) >>> 0;
  }
  return output.toString(16).padStart(8, '0');
}

export function ensureParentPin(storage, defaultPin = '1056') {
  if (!storage.getItem(PIN_KEY)) storage.setItem(PIN_KEY, `PIN1.${hash(defaultPin)}`);
}

export function parentPinMatches(storage, pin) {
  ensureParentPin(storage);
  return storage.getItem(PIN_KEY) === `PIN1.${hash(pin)}`;
}

