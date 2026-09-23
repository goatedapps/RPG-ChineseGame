const KEY_DIRECTIONS = new Map([
  ['ArrowUp', 'up'], ['w', 'up'], ['W', 'up'],
  ['ArrowDown', 'down'], ['s', 'down'], ['S', 'down'],
  ['ArrowLeft', 'left'], ['a', 'left'], ['A', 'left'],
  ['ArrowRight', 'right'], ['d', 'right'], ['D', 'right']
]);

export function bindInput({ target = window, dpad, onMove }) {
  let lastMove = 0;
  const move = direction => {
    const now = performance.now();
    if (now - lastMove < 95) return;
    lastMove = now;
    onMove(direction);
  };
  const onKeyDown = event => {
    const direction = KEY_DIRECTIONS.get(event.key);
    if (!direction) return;
    event.preventDefault();
    move(direction);
  };
  target.addEventListener('keydown', onKeyDown);
  const cleanups = [];
  for (const button of dpad.querySelectorAll('[data-direction]')) {
    const onPointer = event => {
      event.preventDefault();
      button.classList.add('is-active');
      move(button.dataset.direction);
    };
    const release = () => button.classList.remove('is-active');
    button.addEventListener('pointerdown', onPointer);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    cleanups.push(() => {
      button.removeEventListener('pointerdown', onPointer);
      button.removeEventListener('pointerup', release);
      button.removeEventListener('pointercancel', release);
      button.removeEventListener('pointerleave', release);
    });
  }
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    cleanups.forEach(cleanup => cleanup());
  };
}
