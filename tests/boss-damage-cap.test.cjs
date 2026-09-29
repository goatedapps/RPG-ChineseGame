const test = require('node:test');
const assert = require('node:assert/strict');

test('boss damage requires at least ten successful attacks regardless of player level', async () => {
  const { capBossDamage } = await import('../src/battle/damage.js');
  for (const maxHp of [31, 40, 97, 250]) {
    let hp = maxHp;
    for (let answer = 1; answer <= 9; answer += 1) hp -= capBossDamage(9999, maxHp);
    assert.ok(hp > 0, `${maxHp} HP boss survived nine attacks`);
    assert.ok(capBossDamage(9999, maxHp) <= Math.max(1, Math.floor(maxHp / 10)));
  }
});
