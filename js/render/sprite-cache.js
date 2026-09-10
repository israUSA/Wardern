// Caché de sprites ilustrados (SVG) teñidos por país — docs/ARTE.md.
// Cada SVG se DESCARGA UNA SOLA VEZ (textCache); las variantes teñidas por país
// se generan localmente inyectando un <style> que sobreescribe las clases
// tintables (.base/.shade/.light/.hi) y se rasterizan vía Blob → Image.
// Si un Blob falla, la entrada se libera para reintentar en el siguiente frame.
import { SPRITES } from "../data/sprites.js";

const textCache = new Map(); // ruta → Promise<string> (texto SVG crudo)
const failedAt = new Map(); // ruta → timestamp del último fallo de descarga
const RETRY_MS = 5000; // un SVG ausente (404) se reintenta como mucho cada 5 s
const cache = new Map(); // "icono|color" → Image | undefined (en carga)

function hexRgb(hex) {
  const h = String(hex || "").replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(v)) return null;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function tintStyle(color) {
  const rgb = hexRgb(color);
  if (!rgb) return "";
  const mix = (t, toWhite) => {
    const f = (c) => Math.round(toWhite ? c + (255 - c) * t : c * (1 - t));
    return `rgb(${f(rgb[0])},${f(rgb[1])},${f(rgb[2])})`;
  };
  return (
    `<style>.base{fill:${color}}.shade{fill:${mix(0.4, false)}}` +
    `.light{fill:${mix(0.28, true)}}.hi{fill:${mix(0.45, true)}}</style>`
  );
}

function svgText(path) {
  if (!textCache.has(path)) {
    if (Date.now() - (failedAt.get(path) || 0) < RETRY_MS) return Promise.resolve(null);
    const p = fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .catch(() => {
        failedAt.set(path, Date.now());
        textCache.delete(path); // reintento diferido (RETRY_MS)
        return null;
      });
    textCache.set(path, p);
  }
  return textCache.get(path);
}

export function spriteReady(icon, color, variant) {
  const key = (variant || icon) + "|" + (color || "");
  const img = cache.get(key);
  if (img && img.complete && img.naturalWidth > 0) return img;
  if (!img && !cache.has(key)) loadSprite(icon, color, key, variant);
  return null;
}

// Sprite de EDIFICIO teñido por país (SPRITES.edificios). El arte existía desde
// v1.3 pero nada lo consumía: los edificios no se dibujaban en el mapa.
export function buildingReady(key, color) {
  const ck = "b:" + key + "|" + (color || "");
  const img = cache.get(ck);
  if (img && img.complete && img.naturalWidth > 0) return img;
  if (!img && !cache.has(ck)) {
    const path = SPRITES.edificios?.[key];
    if (path) buildFromPath(path, ck, color);
  }
  return null;
}

async function loadSprite(icon, color, key, variant) {
  cache.set(key, undefined);
  // Prioridad: sprite POR VARIANTE (el vehículo real, p. ej. v-occ-1-caza = F-16A);
  // si el archivo aún no existe, fallback al sprite de la categoría.
  const vpath = variant ? SPRITES.variantes?.[variant] : null;
  let txt = vpath ? await svgText(vpath) : null;
  if (!txt) txt = await svgText(SPRITES.unidades[icon]);
  if (!txt) {
    cache.delete(key); // todo falló: se reintenta después
    return;
  }
  buildImage(txt, key, color);
}

// Tiñe el SVG, le fija tamaño intrínseco y lo rasteriza en una Image cacheada.
async function buildFromPath(path, key, color) {
  cache.set(key, undefined);
  const txt = await svgText(path);
  if (!txt) {
    cache.delete(key); // 404 o red: se reintenta pasado RETRY_MS
    return;
  }
  buildImage(txt, key, color);
}

function buildImage(txt, key, color) {
  const tint = tintStyle(color);
  let svg = txt.replace("</svg>", tint + "</svg>");
  // tamaño intrínseco explícito: drawImage lo necesita en todos los navegadores.
  // Se toma del propio viewBox (256x256 en el set v1.4) en vez de un valor fijo:
  // si se fuerza un tamaño menor al viewBox, el navegador rasteriza con menos
  // detalle del disponible y el sprite se ve borroso/pixelado al ampliarlo.
  const openTag = svg.match(/<svg[^>]*>/)?.[0] || "";
  if (!/\swidth=/.test(openTag)) {
    const vb = openTag.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/);
    const size = vb ? vb[1] : "128";
    const sizeH = vb ? vb[2] : "128";
    svg = svg.replace("<svg", `<svg width="${size}" height="${sizeH}"`);
  }
  const img = new Image();
  img.onerror = () => cache.delete(key); // reintento en el siguiente frame
  img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  cache.set(key, img);
}
