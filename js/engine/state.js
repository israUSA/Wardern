// Estado del juego: índice estático del mapa + creación/consulta de partidas.
import * as C from "../data/constants.js";
import { UNITS as GROUND_UNITS } from "../data/units-data.js";
import { DOCTRINES, TIERS } from "../data/doctrines-data.js";
import { NAVAL_UNITS, NAVAL_CATEGORIES } from "../data/naval-data.js";
import { DRONE_VISION_KM } from "../data/missiles-data.js";
import { FUEL_REGIONS, FUEL_FALLBACK } from "../data/fuel-data.js";

export { DOCTRINES, TIERS };

// Roster combinado: variantes terrestres/aéreas + navales. Soporta legacy (sin doctrine).
export const ALL_UNITS = { ...GROUND_UNITS, ...NAVAL_UNITS };
export const NAVAL_IDS = new Set(Object.keys(NAVAL_UNITS));

export function unitDef(type) {
  return ALL_UNITS[type] || null;
}

export function isNaval(type) {
  return NAVAL_IDS.has(type);
}

// Variante por categoría disponible para un país (mayor tier desbloqueado con preferencia).
// `!u.legacy`: las ids planas legacy solo existen para cargar partidas viejas (unitDef),
// nunca se ofrecen como reclutables — las variantes doctrine×tier las sustituyen.
export function availableVariants(state, iso, category) {
  const def = state.countries[iso];
  return Object.values(ALL_UNITS).filter(
    (u) =>
      u.category === category &&
      !u.legacy &&
      (!u.doctrine || u.doctrine === def.doctrine) &&
      (u.tier ?? 1) <= (def.researchedTier ?? 1)
  );
}

// Todas las variantes de una categoría para la doctrina del país (incluye bloqueadas)
export function doctrineVariants(state, iso, category) {
  const d = state.countries[iso].doctrine;
  return Object.values(ALL_UNITS)
    .filter((u) => u.category === category && !u.legacy && (!u.doctrine || u.doctrine === d))
    .sort((a, b) => (a.tier ?? 1) - (b.tier ?? 1));
}

// Índice estático (no se serializa; el mapa se recarga del módulo de datos)
export const S = {
  map: null,
  countries: null,        // datos estáticos de países (color, nombre, capital…)
  provinces: new Map(),   // id → provincia estática enriquecida (centroides, bbox)
  provinceList: [],
  edges: new Map(),       // id → [{to, strait}]
  totalVP: 1,
};

const toRad = (d) => (d * Math.PI) / 180;

// Punto dentro de un anillo (ray casting)
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = true;
  }
  return inside;
}

// Distancia mínima de un punto a los segmentos de los anillos de una provincia
function ringDistance(px, py, rings) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const x1 = ring[j][0], y1 = ring[j][1];
      const x2 = ring[i][0], y2 = ring[i][1];
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const qx = x1 + t * dx, qy = y1 + t * dy;
      const d = Math.hypot(px - qx, py - qy);
      if (d < best) best = d;
    }
  }
  return best;
}

export function distKm(a, b) {
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Proyección Mercator simple; Y se niega para que el norte quede arriba en pantalla
export function mercY(lat) {
  const l = Math.max(-85, Math.min(85, lat));
  return Math.log(Math.tan(Math.PI / 4 + toRad(l) / 2)) * (180 / Math.PI);
}
export function proj(lon, lat) {
  return [lon, -mercY(lat)];
}

// Normaliza `polygon`: acepta un anillo [[lon,lat],…] o un array de anillos [[[lon,lat],…],…]
function normalizeRings(poly) {
  if (!Array.isArray(poly) || !poly.length) return [];
  if (Array.isArray(poly[0][0])) return poly;
  return [poly];
}

export function initStatic(MAP, COUNTRIES) {
  S.map = MAP;
  S.countries = COUNTRIES;
  S.provinces = new Map();
  S.provinceList = [];
  S.edges = new Map();

  for (const p of MAP.provinces) {
    const rings = normalizeRings(p.polygon);
    // centroide desde el anillo principal: las islas pequeñas arrastraban el
    // promedio de todos los vértices hacia el mar (iconos/etiquetas fuera de sitio)
    const mainRing = rings.reduce((a, r) => (!a || r.length > a.length ? r : a), null);
    if (!mainRing || !mainRing.length) continue;
    let cx = 0, cy = 0, n = 0;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const ring of rings) {
      for (const [lo, la] of ring) {
        if (lo < minx) minx = lo; if (lo > maxx) maxx = lo;
        if (la < miny) miny = la; if (la > maxy) maxy = la;
      }
    }
    for (const [lo, la] of mainRing) { cx += lo; cy += la; n++; }
    if (!n) continue;
    cx /= n; cy /= n;
    // provincias cóncavas: si el promedio cae fuera del anillo, busca el punto
    // interior más alejado del borde sobre una rejilla del bbox del anillo
    const pipLL = (x, y, poly) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    };
    if (!pipLL(cx, cy, mainRing)) {
      let best = null, bestD = -1;
      for (let sx = 1; sx < 14; sx++) {
        for (let sy = 1; sy < 14; sy++) {
          const x = minx + ((maxx - minx) * sx) / 14, y = miny + ((maxy - miny) * sy) / 14;
          if (!pipLL(x, y, mainRing)) continue;
          const d = ringDistance(x, y, [mainRing]);
          if (d > bestD) { bestD = d; best = [x, y]; }
        }
      }
      if (best) { cx = best[0]; cy = best[1]; }
    }
    const st = {
      ...p,
      rings,                        // todos los anillos exteriores (islas/territorios unidos)
      cx, cy,                       // centroide lon/lat (cálculo de distancias)
      bbox: [minx, miny, maxx, maxy],
      projRings: rings.map((ring) => ring.map(([lo, la]) => proj(lo, la))),
    };
    const pj = proj(cx, cy);
    st.pcx = pj[0];                 // centroide proyectado (render alineado al mapa)
    st.pcy = pj[1];
    S.provinces.set(p.id, st);
    S.provinceList.push(st);
  }

  for (const [id, list] of Object.entries(MAP.neighbors || {})) {
    if (!S.provinces.has(id)) continue;
    S.edges.set(id, list.filter((t) => S.provinces.has(t)).map((to) => ({ to, strait: false })));
  }
  for (const [a, b] of MAP.straits || []) {
    if (!S.provinces.has(a) || !S.provinces.has(b)) continue;
    if (!S.edges.has(a)) S.edges.set(a, []);
    if (!S.edges.has(b)) S.edges.set(b, []);
    if (!S.edges.get(a).some((e) => e.to === b)) S.edges.get(a).push({ to: b, strait: true });
    if (!S.edges.get(b).some((e) => e.to === a)) S.edges.get(b).push({ to: a, strait: true });
  }

  S.totalVP = S.provinceList.reduce((s, p) => s + (p.vp || 1), 0) || 1;

  // ---- Rejilla de celdas de mar (solo unidades navales; las aéreas la sobrevuelan) ----
  // Celdas pequeñas (~90 km): suficientes cerca de la costa para puertos e invasiones.
  const SEA_CELL = 0.8;
  const b = MAP.bounds;
  const inWater = (lo, la) => {
    for (const p of S.provinceList) {
      const bb = p.bbox;
      if (lo < bb[0] || lo > bb[2] || la < bb[1] || la > bb[3]) continue;
      for (const ring of p.rings) {
        if (pointInRing(lo, la, ring)) return false;
      }
    }
    return true;
  };
  const cols = Math.ceil((b.maxLon - b.minLon) / SEA_CELL);
  const rows = Math.ceil((b.maxLat - b.minLat) / SEA_CELL);
  const inset = SEA_CELL * 0.25;
  const cells = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = b.minLon + i * SEA_CELL;
      const y0 = b.minLat + j * SEA_CELL;
      const cx = x0 + SEA_CELL / 2, cy = y0 + SEA_CELL / 2;
      // centro en agua y al menos 3 de 4 esquinas (muestreo proporcional a la celda)
      if (!inWater(cx, cy)) continue;
      const corners = [
        inWater(x0 + inset, y0 + inset), inWater(x0 + SEA_CELL - inset, y0 + inset),
        inWater(x0 + inset, y0 + SEA_CELL - inset), inWater(x0 + SEA_CELL - inset, y0 + SEA_CELL - inset),
      ];
      if (corners.filter(Boolean).length < 3) continue;
      const ring = [[x0, y0], [x0 + SEA_CELL, y0], [x0 + SEA_CELL, y0 + SEA_CELL], [x0, y0 + SEA_CELL]];
      const st = {
        id: `sea-${i}-${j}`, i, j, isSea: true, country: null, name: "Mar", terrain: "mar",
        pop: 0, capital: false, vp: 0, prod: { money: 0, supplies: 0, fuel: 0, manpower: 0 },
        rings: [ring], cx, cy,
        bbox: [x0, y0, x0 + SEA_CELL, y0 + SEA_CELL],
        projRings: [ring.map(([lo, la]) => proj(lo, la))],
      };
      st.pcx = cx; st.pcy = -mercY(cy);
      cells.push(st);
    }
  }
  // Enlaces mar-mar (8 direcciones) y costa-mar (por distancia al polígono)
  const seaEdges = new Map();
  const byIJ = new Map(cells.map((c) => [`${c.i},${c.j}`, c]));
  for (const c of cells) {
    const list = [];
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const n = byIJ.get(`${c.i + di},${c.j + dj}`);
        if (n) list.push(n.id);
      }
    }
    seaEdges.set(c.id, list);
  }
  const coastEdges = new Map();
  for (const c of cells) {
    for (const p of S.provinceList) {
      const bb = p.bbox;
      if (c.cx < bb[0] - SEA_CELL || c.cx > bb[2] + SEA_CELL) continue;
      if (c.cy < bb[1] - SEA_CELL || c.cy > bb[3] + SEA_CELL) continue;
      if (ringDistance(c.cx, c.cy, p.rings) < SEA_CELL * 1.3) {
        if (!coastEdges.has(p.id)) coastEdges.set(p.id, []);
        coastEdges.get(p.id).push(c.id);
        seaEdges.get(c.id).push(p.id);
      }
    }
  }
  S.seaCells = cells;
  for (const c of cells) {
    S.provinces.set(c.id, c);
    S.provinceList.push(c);
    S.edges.set(c.id, seaEdges.get(c.id).map((to) => ({ to, strait: false })));
  }
  for (const [pid, list] of coastEdges) {
    for (const to of list) {
      if (!S.edges.get(pid).some((e) => e.to === to)) S.edges.get(pid).push({ to, strait: false });
    }
  }

  // Combustible: regiones petroleras reales (js/data/fuel-data.js) sustituyen al
  // valor genérico del mapa; todo país sin región petrolera recibe un productor
  // de red de seguridad en su capital (o provincia más poblada).
  for (const p of S.provinceList) {
    const rate = FUEL_REGIONS[p.id];
    if (rate != null) p.prod.fuel = rate;
  }
  const byCountry = new Map();
  for (const p of S.provinceList) {
    if (!p.country) continue;
    if (!byCountry.has(p.country)) byCountry.set(p.country, []);
    byCountry.get(p.country).push(p);
  }
  for (const [, list] of byCountry) {
    if (list.some((p) => p.prod.fuel > 0)) continue;
    const best = list.find((p) => p.capital) || list.reduce((a, b) => ((b.pop || 0) > (a.pop || 0) ? b : a));
    best.prod.fuel = FUEL_FALLBACK;
  }
}

export function controller(ps) {
  return ps ? (ps.occupier || ps.owner) : null; // tolerante a celdas de mar (sin estado)
}

export function atWar(state, a, b) {
  return a !== b && !!state.countries[a]?.wars.includes(b);
}

export function unitsIn(state, pid) {
  return state.units.filter((u) => u.pos === pid);
}

export function gameDay(state) {
  return state.time / 1440;
}

export function declareWar(state, a, b) {
  if (a === b || atWar(state, a, b)) return false;
  state.countries[a].wars.push(b);
  state.countries[b].wars.push(a);
  // Día de inicio y provincias controladas al empezar, para AMBOS bandos: la IA
  // decide la paz con ellos. Antes solo se anotaban cuando declaraba un bot, así
  // que una guerra iniciada por el jugador nacía "larga" y la IA aceptaba la paz
  // de inmediato; y el conteo inicial quedaba en null, con lo que "perdí el 40 %
  // del territorio" no se cumplía jamás.
  const day = gameDay(state);
  for (const [x, y] of [[a, b], [b, a]]) {
    const c = state.countries[x];
    c.warStartDay = c.warStartDay || {};
    c.warControlStart = c.warControlStart || {};
    c.warStartDay[y] = day;
    c.warControlStart[y] = controlledCount(state, x);
  }
  log(state, `${S.countries[a].name} declara la guerra a ${S.countries[b].name}`, "war");
  return true;
}

export function makePeace(state, a, b) {
  state.countries[a].wars = state.countries[a].wars.filter((w) => w !== b);
  state.countries[b].wars = state.countries[b].wars.filter((w) => w !== a);
  const until = gameDay(state) + 5;
  state.countries[a].peaceUntil[b] = until;
  state.countries[b].peaceUntil[a] = until;
  log(state, `${S.countries[a].name} y ${S.countries[b].name} firman la paz`, "good");
}

export function log(state, msg, kind = "info") {
  state.log.push({ t: state.time, msg, kind });
  if (state.log.length > 200) state.log.shift();
}

export function checkElimination(state, iso) {
  const c = state.countries[iso];
  if (!c || c.eliminated) return;
  const stillControls = S.provinceList.some((p) => controller(state.provinces[p.id]) === iso);
  if (stillControls) return;
  c.eliminated = true;
  // Sus unidades se rinden
  state.units = state.units.filter((u) => {
    if (u.owner !== iso) return true;
    state.stats.lost[iso] = (state.stats.lost[iso] || 0) + 1;
    return false;
  });
  for (const other in state.countries) {
    state.countries[other].wars = state.countries[other].wars.filter((w) => w !== iso);
  }
  c.wars = [];
  if (iso === state.player) {
    state.gameOver = { win: false };
  } else {
    log(state, `${c.name ?? S.countries[iso].name} ha sido eliminado de la partida`, "war");
  }
}

// Perfil de dificultad de la partida (los guardados anteriores no lo traen → normal)
export function difficulty(state) {
  return C.DIFFICULTIES[state?.difficulty] || C.DIFFICULTIES[C.DEFAULT_DIFFICULTY];
}

export function newGame(playerISO, difficultyId = C.DEFAULT_DIFFICULTY) {
  const state = {
    version: 2,
    time: 0,
    speed: 1,
    player: playerISO,
    difficulty: C.DIFFICULTIES[difficultyId] ? difficultyId : C.DEFAULT_DIFFICULTY,
    nextUnitId: 1,
    gameOver: null,
    countries: {},
    provinces: {},
    units: [],
    log: [],
    events: [],
    stats: { lost: {}, taken: {} },
    flow: null,
  };

  // Doctrina por país (desde doctrines-data; fallback occidental)
  const doctrineByCountry = {};
  for (const [did, d] of Object.entries(DOCTRINES)) {
    for (const iso of d.countries || []) doctrineByCountry[iso] = did;
  }

  for (const [iso, c] of Object.entries(S.countries)) {
    const own = S.provinceList.filter((p) => p.country === iso);
    const p0 = { money: 0, supplies: 0, fuel: 0, manpower: 0 };
    for (const p of own) {
      p0.money += p.prod.money || 0;
      p0.supplies += p.prod.supplies || 0;
      p0.fuel += p.prod.fuel || 0;
      p0.manpower += p.prod.manpower || 0;
    }
    state.countries[iso] = {
      doctrine: doctrineByCountry[iso] || "occidental",
      researchedTier: 1,
      researchQueue: null,
      resources: {
        money: Math.round(p0.money * 48 + 2000),
        supplies: Math.round(p0.supplies * 24 + 400),
        fuel: Math.round(p0.fuel * 24 + 150),
        manpower: Math.round(p0.manpower * 12 + 250),
      },
      wars: [],
      peaceUntil: {},
      eliminated: false,
    };
  }

  for (const p of S.provinceList) {
    if (p.isSea) continue;
    state.provinces[p.id] = {
      owner: p.country,
      occupier: null,
      buildings: { industria: 0, reclutamiento: 0, fortaleza: 0, aerobase: 0, puerto: 0 },
      queue: null,
    };
  }

  // Ejércitos iniciales: variantes de la doctrina de cada país, en sus provincias
  const START_CATS = ["infanteria", "infanteria", "infanteria", "motorizada", "motorizada", "mbt", "cazatanques", "artilleria"];
  for (const iso of Object.keys(S.countries)) {
    const own = S.provinceList.filter((p) => p.country === iso);
    if (!own.length) continue;
    own.sort((a, b) => (b.capital ? 1 : 0) - (a.capital ? 1 : 0) || b.pop - a.pop);
    const n = Math.max(3, Math.min(24, Math.round(own.length * 1.2)));
    for (let i = 0; i < n; i++) {
      const variants = availableVariants(state, iso, START_CATS[i % START_CATS.length]);
      const def = variants[variants.length - 1];
      if (def) spawnUnit(state, iso, def.id, own[i % own.length].id);
    }
  }

  log(state, `Comienza la campaña. Lideras ${S.countries[playerISO].name}.`, "info");
  return state;
}

export function spawnUnit(state, iso, type, pos, hp = 100) {
  const u = {
    id: state.nextUnitId++,
    owner: iso,
    type,
    hp,
    morale: 1,
    battleTicks: 0,
    pos,
    path: [],
    edgeLeft: null,
    task: null,
  };
  state.units.push(u);
  return u;
}

export function controlledCount(state, iso) {
  let n = 0;
  for (const p of S.provinceList) if (controller(state.provinces[p.id]) === iso) n++;
  return n;
}

export function armyPower(state, iso) {
  // Peso ∝ coste de la unidad, escalado por estado (HP)
  let power = 0;
  for (const u of state.units) {
    if (u.owner !== iso) continue;
    power += (u.hp / 100) * ((unitDef(u.type)?.cost.money || 5000) / 5000);
  }
  return power;
}

export function countryVP(state, iso) {
  let vp = 0;
  for (const p of S.provinceList) if (controller(state.provinces[p.id]) === iso) vp += p.vp || 1;
  return vp;
}

// Niebla de guerra con DOS niveles de inteligencia (estilo CoN):
// - fuerte: provincia controlada, con unidad propia presente o dentro del círculo
//   de un dron propio → se ven las unidades enemigas con su tipo exacto.
// - débil: solo adyacente a lo fuerte → las unidades enemigas se ven como
//   "desconocidas" (sin identificar).
// visibleProvinces() conserva su firma: unión de ambos niveles.
const intelCache = new WeakMap(); // state → { time, strong, weak, union }

export function intel(state) {
  const cached = intelCache.get(state);
  if (cached && cached.time === state.time) return cached;
  const strong = new Set();
  const weak = new Set();
  for (const p of S.provinceList) {
    if (controller(state.provinces[p.id]) === state.player) {
      strong.add(p.id);
      for (const e of S.edges.get(p.id) || []) weak.add(e.to);
    }
  }
  // Unidad propia presente → inteligencia fuerte de esa provincia
  for (const u of state.units) {
    if (u.dead || u.owner !== state.player || u.embarked) continue;
    strong.add(u.pos);
  }
  // Drones de reconocimiento (docs/MISSILES.md §4): círculo = inteligencia fuerte
  for (const u of state.units) {
    if (u.dead || u.owner !== state.player || u.embarked) continue;
    const T = unitDef(u.type);
    if (T?.category !== "drone") continue;
    const from = S.provinces.get(u.pos);
    if (!from) continue;
    const R = DRONE_VISION_KM[T.tier ?? 1];
    for (const p of S.provinceList) {
      if (distKm([from.cx, from.cy], [p.cx, p.cy]) <= R) strong.add(p.id);
    }
  }
  const union = new Set(strong);
  for (const id of strong) {
    for (const e of S.edges.get(id) || []) if (!strong.has(e.to)) weak.add(e.to);
  }
  for (const id of weak) union.add(id);
  const out = { time: state.time, strong, weak, union };
  intelCache.set(state, out);
  return out;
}

export function visibleProvinces(state) {
  return intel(state).union;
}
