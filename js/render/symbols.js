// symbols.js — Símbolos de unidades estilo OTAN y marcadores de juego,
// dibujados por código en Canvas 2D. Sin fuentes, sin imágenes, sin estado global.
// Los sprites ilustrados (docs/ARTE.md) se superponen vía sprite-cache.js cuando
// están cargados; el símbolo OTAN dibujado aquí queda como fallback.

import { spriteReady } from "./sprite-cache.js";

// Gris tenue para unidades destruidas
const DEAD_COLOR = '#6b7078';
const DEAD_ALPHA = 0.5;
// Halo de selección (blanco/amarillo)
const SELECT_COLOR = '#ffe9a0';
// Chevrons de veteranía (mismo tono que el halo de selección)
const LEVEL_COLOR = '#ffe9a0';

// Tipos navales: dibujan una silueta de casco en lugar del rectángulo OTAN
const NAVAL_TYPES = new Set([
  'corbeta', 'fragata', 'destructor', 'submarino', 'portaviones', 'transporte',
]);

// Redondeo de coordenadas para trazos nítidos
const rr = (v) => Math.round(v);

// Rellena la ruta actual al 35% y traza su contorno de 2px (siluetas navales)
function fillSilhouette(ctx) {
  ctx.save();
  ctx.globalAlpha *= 0.35;
  ctx.fill();
  ctx.restore();
  ctx.stroke();
}

/**
 * Dibuja un símbolo de unidad OTAN centrado en (x, y).
 * Rectángulo base: ancho = size, alto = size * 0.72, esquinas rectas, trazo 2px.
 * Los tipos navales sustituyen el rectángulo por una silueta de casco vista
 * desde arriba (proa a la derecha), rellena al 35% con contorno de 2px.
 * @param {CanvasRenderingContext2D} ctx contexto 2D
 * @param {"infanteria"|"motorizada"|"mbt"|"cazatanques"|"artilleria"|"caza"|
 *   "bombardero"|"helicoptero"|"drone"|"antiaereo"|"corbeta"|"fragata"|
 *   "destructor"|"submarino"|"portaviones"|"transporte"} type tipo de unidad
 * @param {number} x centro horizontal (px)
 * @param {number} y centro vertical (px)
 * @param {number} size ancho del símbolo (px)
 * @param {string} color color de trazo/relleno (teñible por país)
 * @param {{selected?:boolean, dead?:boolean, hp?:number, level?:number}} [opts]
 *   opciones visuales; level (0-3) dibuja chevrons de veteranía centrados
 *   justo encima del rect base
 */
export function drawUnitSymbol(ctx, type, x, y, size, color, opts = {}) {
  if (!ctx || !(size > 0)) return;

  const dead = opts.dead === true;
  const ink = dead ? DEAD_COLOR : (color || '#d8dee6');

  const w = Math.max(2, rr(size));
  const h = Math.max(2, rr(w * 0.72));
  const left = rr(x - w / 2);
  const top = rr(y - h / 2);
  const right = left + w;
  const bottom = top + h;
  const cx = left + w / 2;
  const cy = top + h / 2;
  const inset = Math.max(3, rr(size * 0.09)); // margen interior del símbolo

  // Barra fina de HP bajo el símbolo (verde → rojo) y chevrons de veteranía:
  // comunes al sprite ilustrado y al fallback OTAN
  const drawBars = () => {
    if (typeof opts.hp === 'number') {
      const hp = Math.max(0, Math.min(1, opts.hp));
      const barY = bottom + 4;
      ctx.fillStyle = 'rgba(10,12,14,0.55)';
      ctx.fillRect(left, barY, w, 3);
      if (hp > 0) {
        const hue = Math.round(hp * 115); // 115 ≈ verde, 0 = rojo
        ctx.fillStyle = 'hsl(' + hue + ',75%,48%)';
        ctx.fillRect(left, barY, Math.max(1, rr(w * hp)), 3);
      }
    }
    const lvl = Math.max(0, Math.min(3, Math.floor(opts.level || 0)));
    if (lvl > 0) {
      const cw = Math.max(6, rr(w * 0.5));    // ancho del chevron
      const drop = Math.max(3, rr(cw * 0.45)); // caída de las puntas
      ctx.save();
      ctx.strokeStyle = LEVEL_COLOR;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let i = 0; i < lvl; i++) {
        const armY = top - 2 - i * (drop + 2); // puntas del chevron i
        ctx.beginPath();
        ctx.moveTo(cx - cw / 2, armY);
        ctx.lineTo(cx, armY - drop);
        ctx.lineTo(cx + cw / 2, armY);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  // Sprite ilustrado cargado: reemplaza al símbolo OTAN (fallback), conservando
  // barra de HP y chevrons de veteranía. opts.variant prioriza el sprite POR
  // VARIANTE (el vehículo real); opts.angle rota SOLO el sprite (miran al norte).
  if (!dead) {
    const sprite = spriteReady(type, color, opts.variant);
    if (sprite) {
      const sw = Math.max(w, h) * 1.3;
      if (opts.angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(opts.angle);
        ctx.drawImage(sprite, -sw / 2, -sw / 2, sw, sw);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, cx - sw / 2, cy - sw / 2, sw, sw);
      }
      drawBars();
      return;
    }
  }

  // Fallback OTAN: con rumbo rota el símbolo (marco + glifo); el halo y las
  // barras de HP/chevrons permanecen sin rotar
  ctx.save();
  if (dead) ctx.globalAlpha *= DEAD_ALPHA;

  // Halo de selección detrás del rectángulo
  if (opts.selected) {
    ctx.save();
    ctx.strokeStyle = SELECT_COLOR;
    ctx.lineWidth = 5;
    ctx.globalAlpha *= 0.35;
    ctx.strokeRect(rr(left - 3) + 0.5, rr(top - 3) + 0.5, rr(w + 6), rr(h + 6));
    ctx.restore();
  }

  if (opts.angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(opts.angle);
    ctx.translate(-x, -y);
  }

  // Rectángulo base OTAN (los tipos navales dibujan su silueta de casco)
  ctx.lineWidth = 2;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  if (!NAVAL_TYPES.has(type)) ctx.strokeRect(left, top, w, h);

  // Símbolo interior según tipo
  ctx.beginPath();
  switch (type) {
    case 'infanteria': // saltire (X) de esquina a esquina
      ctx.moveTo(left + inset, top + inset);
      ctx.lineTo(right - inset, bottom - inset);
      ctx.moveTo(right - inset, top + inset);
      ctx.lineTo(left + inset, bottom - inset);
      ctx.stroke();
      break;

    case 'motorizada': // saltire + un punto relleno (blindada ligera / caballería)
      ctx.moveTo(left + inset, top + inset);
      ctx.lineTo(right - inset, bottom - inset);
      ctx.moveTo(right - inset, top + inset);
      ctx.lineTo(left + inset, bottom - inset);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2.5, size * 0.09), 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'mbt': // elipse rellena (blindados)
      ctx.ellipse(cx, cy, w * 0.28, h * 0.33, 0, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'cazatanques': { // triángulo invertido con relleno semitransparente
      const ty = top + inset;
      ctx.moveTo(left + inset, ty);
      ctx.lineTo(right - inset, ty);
      ctx.lineTo(cx, bottom - inset);
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha *= 0.38; // relleno tenue
      ctx.fill();
      ctx.restore();
      ctx.stroke(); // contorno sólido (la ruta se conserva)
      break;
    }

    case 'artilleria': // punto relleno sólido (grueso)
      ctx.arc(cx, cy, Math.max(3, size * 0.14), 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'caza': // rombo (ala fija OTAN), solo contorno
      ctx.moveTo(cx, top + inset);
      ctx.lineTo(right - inset, cy);
      ctx.lineTo(cx, bottom - inset);
      ctx.lineTo(left + inset, cy);
      ctx.closePath();
      ctx.stroke();
      break;

    case 'bombardero': { // rombo relleno con doble contorno (más pesado que el caza)
      const k = 0.5; // escala del rombo interior (segundo contorno)
      const dTop = cy - (top + inset);
      const dSide = (right - inset) - cx;
      // rombo exterior: relleno tenue + contorno
      ctx.moveTo(cx, top + inset);
      ctx.lineTo(right - inset, cy);
      ctx.lineTo(cx, bottom - inset);
      ctx.lineTo(left + inset, cy);
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha *= 0.5; // más cargado que el triángulo del cazatanques
      ctx.fill();
      ctx.restore();
      ctx.stroke();
      // rombo interior
      ctx.beginPath();
      ctx.moveTo(cx, cy - dTop * k);
      ctx.lineTo(cx + dSide * k, cy);
      ctx.lineTo(cx, cy + dTop * k);
      ctx.lineTo(cx - dSide * k, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'helicoptero': { // círculo (ala rotatoria OTAN) con línea corta de cola
      const rad = Math.max(3, h * 0.30);
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
      // cola: tramo horizontal desde el borde derecho del círculo
      ctx.beginPath();
      ctx.moveTo(cx + rad, cy);
      ctx.lineTo(right - inset, cy);
      ctx.stroke();
      break;
    }

    case 'drone': { // rombo pequeño con punto central (distingue del caza)
      const k = 0.55; // rombo más pequeño dentro del rect
      const dTop = (cy - (top + inset)) * k;
      const dSide = ((right - inset) - cx) * k;
      ctx.moveTo(cx, cy - dTop);
      ctx.lineTo(cx + dSide, cy);
      ctx.lineTo(cx, cy + dTop);
      ctx.lineTo(cx - dSide, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, size * 0.05), 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'antiaereo': { // chevron grueso apuntando hacia ARRIBA (defensa antiaérea)
      const apexY = top + inset;
      const armY = bottom - inset;
      const band = Math.max(1, Math.min(Math.max(3, h * 0.22), (armY - apexY) * 0.6));
      // hexágono del chevron: contorno exterior + retorno interior paralelo
      ctx.moveTo(cx, apexY);                   // vértice superior exterior
      ctx.lineTo(right - inset, armY);         // punta derecha exterior
      ctx.lineTo(right - inset, armY - band);  // punta derecha interior
      ctx.lineTo(cx, apexY + band);            // vértice superior interior
      ctx.lineTo(left + inset, armY - band);   // punta izquierda interior
      ctx.lineTo(left + inset, armY);          // punta izquierda exterior
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha *= 0.38; // relleno tenue, mismo patrón que cazatanques
      ctx.fill();
      ctx.restore();
      ctx.stroke();
      break;
    }

    case 'corbeta':
    case 'fragata':
    case 'destructor':
    case 'submarino':
    case 'portaviones':
    case 'transporte': {
      // Silueta naval en vista superior, proa hacia la derecha, en vez del
      // marco: casco relleno al 35% + contorno 2px, con antenas y extras.
      const hl = left + inset;
      const hr = right - inset;
      const ht = top + inset;
      const hb = bottom - inset;
      const hh = (hb - ht) / 2;                  // semialtura útil del casco
      const mastLen = Math.max(2, rr(hh * 0.5)); // media longitud de antena
      const supW = Math.max(3, rr(w * 0.14));    // superestructura (fragata)
      const supH = Math.max(2, rr(h * 0.26));

      // Antena: tick vertical sobre el eje longitudinal del casco
      const mast = (mx) => {
        ctx.beginPath();
        ctx.moveTo(mx, cy - mastLen);
        ctx.lineTo(mx, cy + mastLen);
        ctx.stroke();
      };

      if (type === 'corbeta') {
        // Trapecio alargado: popa plana ancha, proa estrecha; una antena
        ctx.beginPath();
        ctx.moveTo(hl, ht);
        ctx.lineTo(hr, cy - hh * 0.55);
        ctx.lineTo(hr, cy + hh * 0.55);
        ctx.lineTo(hl, hb);
        ctx.closePath();
        fillSilhouette(ctx);
        mast(cx);
      } else if (type === 'fragata') {
        // Casco con proa en cuña, superestructura central y dos antenas
        const bowCut = Math.max(2, rr(w * 0.1));
        ctx.beginPath();
        ctx.moveTo(hl, ht);
        ctx.lineTo(hr - bowCut, ht);
        ctx.lineTo(hr, cy);
        ctx.lineTo(hr - bowCut, hb);
        ctx.lineTo(hl, hb);
        ctx.closePath();
        fillSilhouette(ctx);
        ctx.fillRect(cx - supW / 2, cy - supH / 2, supW, supH);
        mast(cx - w * 0.22);
        mast(cx + w * 0.2);
      } else if (type === 'destructor') {
        // El más grande: casco lleno con proa puntiaguda y tres antenas
        const di = Math.max(2, rr(inset * 0.55)); // margen reducido: casco mayor
        const dt = top + di;
        const db = bottom - di;
        const dh = (db - dt) / 2;
        ctx.beginPath();
        ctx.moveTo(left + di, dt);
        ctx.lineTo(right - di - dh, dt);
        ctx.lineTo(right - di, cy);
        ctx.lineTo(right - di - dh, db);
        ctx.lineTo(left + di, db);
        ctx.closePath();
        fillSilhouette(ctx);
        mast(cx - w * 0.26);
        mast(cx);
        mast(cx + w * 0.16);
      } else if (type === 'submarino') {
        // Cigarro horizontal con extremos redondeados y torreta hacia proa
        const r = Math.max(2.5, rr(hh * 0.62));
        ctx.beginPath();
        ctx.moveTo(hl + r, cy - r);
        ctx.lineTo(hr - r, cy - r);
        ctx.arc(hr - r, cy, r, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(hl + r, cy + r);
        ctx.arc(hl + r, cy, r, Math.PI / 2, Math.PI * 1.5);
        ctx.closePath();
        fillSilhouette(ctx);
        const sailW = Math.max(3.5, rr(w * 0.18));
        const sailH = Math.max(2.5, rr(h * 0.2));
        ctx.fillRect(cx + rr(w * 0.06), cy - r - sailH, sailW, sailH);
      } else if (type === 'portaviones') {
        // Cubierta plana casi tan ancha como el marco, proa corta e isla lateral
        const deckInset = Math.max(1, rr(inset * 0.35));
        const dt = top + deckInset;
        const db = bottom - deckInset;
        const bowCut = Math.max(3, rr(w * 0.14));
        ctx.beginPath();
        ctx.moveTo(left + inset, dt);
        ctx.lineTo(right - inset - bowCut, dt);
        ctx.lineTo(right - inset, cy);
        ctx.lineTo(right - inset - bowCut, db);
        ctx.lineTo(left + inset, db);
        ctx.closePath();
        fillSilhouette(ctx);
        // isla: bloque sólido sobre el borde superior de babor, a popa del centro
        const iW = Math.max(3, rr(w * 0.16));
        const iH = Math.max(2, rr(h * 0.18));
        ctx.fillRect(cx - rr(w * 0.16), dt + 1, iW, iH);
      } else { // transporte
        // Casco ro-ro: proa plana vertical, popa achaflanada y carga en cubierta
        const ch = Math.max(2, rr(w * 0.12)); // chaflán de popa
        ctx.beginPath();
        ctx.moveTo(hl + ch, ht);
        ctx.lineTo(hr, ht);
        ctx.lineTo(hr, hb);
        ctx.lineTo(hl + ch, hb);
        ctx.lineTo(hl, cy);
        ctx.closePath();
        fillSilhouette(ctx);
        // símbolo de carga: dos bloques sólidos en cubierta
        const cs = Math.max(2.5, rr(h * 0.24));
        ctx.fillRect(cx - cs - 1.5, cy - cs / 2, cs, cs);
        ctx.fillRect(cx + 1.5, cy - cs / 2, cs, cs);
      }
      break;
    }

    default: // tipo desconocido: solo el marco
      break;
  }

  if (opts.angle) ctx.restore(); // fin de la rotación del símbolo

  drawBars();

  ctx.restore();
}

/**
 * Marcador de batalla: aspas de sable cruzadas + círculo central, en rojo,
 * con pulso sinusoidal según el timestamp t (ms): escala = 1 + 0.15*sin(t/300).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x centro (px)
 * @param {number} y centro (px)
 * @param {number} t timestamp en ms
 */
export function drawBattleMarker(ctx, x, y, t = 0) {
  if (!ctx) return;
  const s = 1 + 0.15 * Math.sin((t || 0) / 300); // factor de pulso
  const L = 7 * s; // semidiagonal de las aspas

  ctx.save();
  ctx.strokeStyle = '#e05545';
  ctx.fillStyle = '#e05545';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  // Dos líneas cruzadas (aspas de sable)
  ctx.beginPath();
  ctx.moveTo(x - L, y - L);
  ctx.lineTo(x + L, y + L);
  ctx.moveTo(x + L, y - L);
  ctx.lineTo(x - L, y + L);
  ctx.stroke();

  // Pequeño círculo central
  ctx.beginPath();
  ctx.arc(x, y, 2.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Longitud total de una polilínea [[x,y], ...]
function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

// Trunca la polilínea a una fracción p (0..1) de su longitud, interpolando el tramo final
function truncatePath(points, p) {
  if (p >= 1) return points.map((pt) => [rr(pt[0]), rr(pt[1])]);
  const target = pathLength(points) * p;
  const out = [[points[0][0], points[0][1]]];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const x0 = points[i - 1][0];
    const y0 = points[i - 1][1];
    const x1 = points[i][0];
    const y1 = points[i][1];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (acc + seg >= target) {
      const k = seg > 0 ? (target - acc) / seg : 0;
      out.push([x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]);
      break;
    }
    acc += seg;
    out.push([x1, y1]);
  }
  return out.map((pt) => [rr(pt[0]), rr(pt[1])]);
}

// Flecha rellena apuntando en la dirección del último tramo útil
function drawArrowHead(ctx, pts) {
  let i = pts.length - 1;
  while (i > 0 && Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) < 0.01) i--;
  if (i === 0) return;
  const ax = pts[i - 1][0];
  const ay = pts[i - 1][1];
  const bx = pts[i][0];
  const by = pts[i][1];
  const ang = Math.atan2(by - ay, bx - ax);
  const len = 9;
  const spread = 0.45;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - len * Math.cos(ang - spread), by - len * Math.sin(ang - spread));
  ctx.lineTo(bx - len * Math.cos(ang + spread), by - len * Math.sin(ang + spread));
  ctx.closePath();
  ctx.fill();
}

/**
 * Dibuja una orden de movimiento: polilínea discontinua blanca semitransparente
 * con flecha al final. progress (0..1) trunca el trazado según el avance.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<[number,number]>} points puntos en píxeles [[x,y], ...]
 * @param {number} [progress] fracción del trazado dibujada (por defecto 1)
 */
export function drawOrderPath(ctx, points, progress = 1) {
  if (!ctx || !Array.isArray(points) || points.length < 2) return;
  const p = progress == null ? 1 : Math.max(0, Math.min(1, progress));
  const pts = truncatePath(points, p);
  if (pts.length < 2) return;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.setLineDash([6, 6]);

  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();

  ctx.setLineDash([]);
  drawArrowHead(ctx, pts);
  ctx.restore();
}
