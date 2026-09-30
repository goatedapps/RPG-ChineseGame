export const PHONE_NOTICE_MESSAGE = 'The game is best played on a computer or tablet. Some features may not display correctly on a phone';

export function isPhoneDevice(device) {
  const userAgent = device.navigator?.userAgent || '';
  if (/iPhone|iPod|Android.+Mobile|Windows Phone|Mobile.+Firefox/i.test(userAgent)) return true;
  return device.navigator?.userAgentData?.mobile === true
    || (device.screen?.width <= 600 && device.matchMedia?.('(pointer: coarse)').matches === true);
}

export function showPhoneNotice(root) {
  root.innerHTML = `
    <div class="phone-notice-screen">
      <section class="phone-notice-card" role="dialog" aria-modal="true" aria-labelledby="phone-notice-title" aria-describedby="phone-notice-message">
        <span class="phone-notice-mark" aria-hidden="true">字灵</span>
        <h1 id="phone-notice-title">A note about your screen</h1>
        <p id="phone-notice-message">${PHONE_NOTICE_MESSAGE}</p>
        <button class="prologue-begin" type="button">Continue</button>
      </section>
    </div>`;
  root.hidden = false;
  const button = root.querySelector('button');
  button.focus();
  return new Promise(resolve => {
    button.addEventListener('click', () => {
      root.hidden = true;
      root.innerHTML = '';
      resolve();
    }, { once: true });
  });
}
