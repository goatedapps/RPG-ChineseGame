const warmedImages = new Map();

export function warmImage(url, { ImageClass = globalThis.Image } = {}) {
  if (!ImageClass) return Promise.resolve(null);
  if (warmedImages.has(url)) return warmedImages.get(url).ready;
  const image = new ImageClass();
  image.decoding = 'async';
  const loaded = typeof image.decode === 'function'
    ? (image.src = url, image.decode())
    : new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
  const ready = Promise.resolve(loaded).then(() => image).catch(error => {
    warmedImages.delete(url);
    throw error;
  });
  warmedImages.set(url, { image, ready });
  return ready;
}
