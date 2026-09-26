export async function showGateOpening() {
  const image = new Image();
  image.src = new URL('../../assets/images/atlas/gate-opening.webp', import.meta.url).href;
  await image.decode().catch(() => {});
  const scene = document.createElement('div');
  scene.className = 'gate-transition';
  scene.setAttribute('role', 'status');
  scene.setAttribute('aria-label', 'The gate to the next town is opening');
  scene.innerHTML = '<div class="gate-transition-leaf left"></div><div class="gate-transition-leaf right"></div><p>The road ahead opens</p>';
  document.body.append(scene);
  const duration = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 300 : 1900;
  await new Promise(resolve => requestAnimationFrame(() => { scene.classList.add('opening'); setTimeout(resolve, duration); }));
  scene.remove();
}
