const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

test('phone detection excludes tablets and narrow desktop windows', async () => {
  const { isPhoneDevice } = await import('../src/ui/phoneNotice.js');
  const device = (userAgent, width, coarse = false, mobile) => ({
    navigator: { userAgent, userAgentData: { mobile } },
    screen: { width },
    matchMedia: () => ({ matches: coarse })
  });
  assert.equal(isPhoneDevice(device('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 390)), true);
  assert.equal(isPhoneDevice(device('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36', 412)), true);
  assert.equal(isPhoneDevice(device('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Mobile Safari/604.1', 768, true)), false);
  assert.equal(isPhoneDevice(device('Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 Safari/537.36', 800, true)), false);
  assert.equal(isPhoneDevice(device('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 390)), false);
  assert.equal(isPhoneDevice(device('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 390, true)), true);
  assert.equal(isPhoneDevice(device('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 1024, true)), false);
});

test('the phone notice is dismissible before the prologue starts', async () => {
  const { PHONE_NOTICE_MESSAGE, showPhoneNotice } = await import('../src/ui/phoneNotice.js');
  const dom = new JSDOM('<div id="prologue" hidden></div>');
  const root = dom.window.document.getElementById('prologue');
  const dismissed = showPhoneNotice(root);
  assert.equal(root.hidden, false);
  assert.equal(root.querySelector('[role="dialog"]').getAttribute('aria-modal'), 'true');
  assert.equal(root.querySelector('#phone-notice-message').textContent, PHONE_NOTICE_MESSAGE);
  assert.equal(dom.window.document.activeElement.textContent, 'Continue');
  root.querySelector('button').click();
  await dismissed;
  assert.equal(root.hidden, true);
  assert.equal(root.innerHTML, '');
});
