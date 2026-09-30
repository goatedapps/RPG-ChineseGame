export async function readSaveFile(file, FileReaderClass = globalThis.FileReader) {
  if (!file) throw new Error('Choose a Word Spirit Quest save file.');
  if (typeof file.text === 'function') {
    try { return await file.text(); } catch { /* Older tablet browsers can fall back to FileReader. */ }
  }
  if (!FileReaderClass) throw new Error('This browser cannot read the selected file.');
  return new Promise((resolve, reject) => {
    const reader = new FileReaderClass();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The selected file could not be read. Try choosing it again.'));
    reader.readAsText(file);
  });
}

export function downloadSaveFile(state, day, exportSaveEnvelope, documentObject = document, urlApi = URL, playerName = '') {
  const blob = new Blob([JSON.stringify(exportSaveEnvelope(state), null, 2)], { type: 'application/json' });
  const link = documentObject.createElement('a');
  link.href = urlApi.createObjectURL(blob);
  const safeName = playerName.trim().replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '').slice(0, 32);
  link.download = `word-spirit-quest-${safeName ? `${safeName}-` : ''}${state.level}-${day}.json`;
  documentObject.body.append(link);
  link.click();
  setTimeout(() => { link.remove(); urlApi.revokeObjectURL(link.href); }, 30000);
}
