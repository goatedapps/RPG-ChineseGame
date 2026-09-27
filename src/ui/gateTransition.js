export async function showGateOpening(onTravel = () => {}) {
  const image = new Image();
  image.src = new URL('../../assets/images/atlas/gate-opening.webp', import.meta.url).href;
  await image.decode().catch(() => {});
  const scene = document.createElement('div');
  scene.className = 'gate-transition';
  scene.setAttribute('role', 'status');
  scene.setAttribute('aria-label', 'The gate to the next town is opening');
  scene.innerHTML = '<div class="gate-transition-leaf left"></div><div class="gate-transition-leaf right"></div>';
  document.body.append(scene);
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  try {
    await new Promise(resolve => requestAnimationFrame(() => { scene.classList.add('opening'); setTimeout(resolve, reduced ? 100 : 1650); }));
    await onTravel();
    scene.classList.add('arrived');
    await new Promise(resolve => setTimeout(resolve, reduced ? 100 : 1100));
  } finally { scene.remove(); }
}
