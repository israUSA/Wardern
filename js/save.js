// Guardado en localStorage + exportar/importar JSON.
const KEY = "wardern-save";

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  return !!localStorage.getItem(KEY);
}

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s && s.version === 2 ? s : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(KEY);
}

export function exportGame(state) {
  const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "wardern-guardado.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importGame(file) {
  const text = await file.text();
  const s = JSON.parse(text);
  // v1 = guardados previos a doctrinas; la compatibilidad de mapa la valida main.js
  if (!s || (s.version !== 1 && s.version !== 2)) throw new Error("Archivo de guardado no válido");
  return s;
}
