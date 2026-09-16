// IA naval de los bots (docs/IA.md §Marina).
//
// Tres decisiones, las mismas que haría un jugador con costa:
//   1. PUERTO    — uno, en su mejor provincia costera, al nivel que su carácter
//                  pida y su tecnología permita.
//   2. FLOTA     — cuántos barcos y de qué clase (lo pide aiEconomy por turno).
//   3. MANIOBRA  — en guerra, buscar la flota enemiga que pueda batir; si no ve
//                  ninguna, acercar los destructores a la costa enemiga para que
//                  sus Tomahawks lleguen (los dispara aiMissiles, no esto).
//
// Todo lo que decide lo decide mirando por SU niebla (intelFor): una flota solo
// persigue a los barcos que ve. Como las celdas de mar son pequeñas, eso casi
// siempre significa barcos pegados a su costa o a su propia flota.
//
// Lo que NO hace: desembarcos. Los transportes existen, pero una invasión
// anfibia bien hecha (embarcar, escoltar, elegir playa, desembarcar con
// superioridad) es otra IA entera; hasta entonces no se reclutan.
import * as C from "../data/constants.js";
import { NAVAL_UNITS } from "../data/naval-data.js";
import { S, unitDef, isNaval, controller, atWar, hpFrac, distKm } from "./state.js";
import { orderMove } from "./movement.js";
import { strikeWeaponsFor } from "./missiles.js";
import { canAfford, startRecruitCategory, trade } from "./economy.js";

// Reparto base por clase. El transporte va a 0 a propósito (ver cabecera).
const BASE_MIX = { corbeta: 0.3, fragata: 0.3, destructor: 0.25, submarino: 0.1, portaviones: 0.05, transporte: 0 };

// ¿Tiene esta provincia salida al mar?
export function isCoastal(pid) {
  return (S.edges.get(pid) || []).some((e) => S.provinces.get(e.to)?.isSea);
}

// Provincias costeras que el país posee y controla
export function coastalProvinces(state, iso) {
  return S.provinceList.filter((p) => {
    if (p.isSea) return false;
    const ps = state.provinces[p.id];
    return ps?.owner === iso && !ps.occupier && isCoastal(p.id);
  });
}

// La provincia donde el bot concentra su marina: la capital si da al mar; si
// no, la costera más poblada. Un solo puerto grande en vez de muchos pequeños:
// el nivel del puerto es lo que desbloquea los barcos de tier 2 y 3.
export function navalBase(state, iso) {
  const costa = coastalProvinces(state, iso);
  if (!costa.length) return null;
  return costa.find((p) => p.capital) || costa.reduce((a, b) => ((b.pop || 0) > (a.pop || 0) ? b : a));
}

// Nivel de puerto al que aspira: el que pide su carácter, pero nunca por
// encima de su tecnología (un puerto nivel 3 sin tier 3 no sirve de nada).
export function wantedPortLevel(state, iso, P) {
  if (!P.navy) return 0;
  return Math.min(P.portLevel || 1, state.countries[iso].researchedTier ?? 1, C.BUILDINGS.puerto.max);
}

export function navalUnitsOf(state, iso) {
  return state.units.filter((u) => u.owner === iso && !u.dead && isNaval(u.type));
}

// Tope de flota: crece con el tamaño del país y con las ganas de mar.
export function fleetCap(state, iso, P, ownCount) {
  if (!P.navy) return 0;
  return Math.ceil(ownCount * P.navy * 1.5) + 1;
}

// Barcos ya en grada (aún no botados): cuentan para el tope
function navalQueued(state, iso) {
  let n = 0;
  for (const pid in state.provinces) {
    const ps = state.provinces[pid];
    if (ps.owner !== iso) continue;
    for (const r of ps.recruits || []) if (r.kind === "naval") n++;
  }
  return n;
}

// Un intento de barco por chequeo, con probabilidad P.navy.
//
// Si el barco elegido no se puede pagar, el bot COMPRA en el mercado lo que le
// falta, siempre que le sobre dinero para ello. Medido sin esto: a los diez
// días EEUU tenía 670.000$ parados y 11.978 de suministros, de modo que ni una
// corbeta (2.800) le salía tras pagar su ejército, y la flota de todos los
// almirantes fue un 96 % de corbetas. Los bots se quedan sin suministros (se
// los come el mantenimiento) mientras el dinero se les acumula.
// La compra solo se hace para pagar ESE barco: no cambia la economía del resto.
// Si ni así llega, espera (salvo para sus primeros barcos, ver abajo).
export function aiNavalRecruit(state, iso, P, ownCount) {
  if (!P.navy || Math.random() >= P.navy) return false;
  if (navalUnitsOf(state, iso).length + navalQueued(state, iso) >= fleetCap(state, iso, P, ownCount)) return false;
  const puerto = coastalProvinces(state, iso).find((p) => {
    const ps = state.provinces[p.id];
    return ps.buildings.puerto > 0 && (ps.recruits?.length || 0) < C.RECRUIT_SLOTS;
  });
  if (!puerto) return false;
  const nivel = state.provinces[puerto.id].buildings.puerto;
  let cat = pickNavalCategory(state, iso, P, nivel, false);
  if (cat && !canAfford(state, iso, navalDef(state, iso, cat, nivel).cost)) {
    if (!buyShortfall(state, iso, navalDef(state, iso, cat, nivel).cost)) {
      // Sin flota todavía, se conforma con lo que pueda pagar. Con flota,
      // espera: conformarse siempre llenaba el puerto de corbetas, que es lo
      // único que un bot puede pagar casi siempre (medido: 26 de 33 barcos).
      if (navalUnitsOf(state, iso).length >= C.AI_NAVY_STARTER) return false;
      // Sus primeros barcos: lo más barato que pueda pagar, comprando también
      // si hace falta. Sin la compra, un país con dinero y sin suministros no
      // botaba nunca el primero (medido: Venezuela, 170k en caja y 499 de
      // suministros, cero barcos en 16 días).
      cat = pickNavalCategory(state, iso, P, nivel, true);
      if (!cat && buyShortfall(state, iso, navalDef(state, iso, "corbeta", nivel).cost)) cat = "corbeta";
    }
  }
  return !!cat && startRecruitCategory(state, puerto.id, cat);
}

// Variante que se reclutaría: la más moderna que admiten su tecnología y el
// puerto (la que startRecruitCategory prefiere).
function navalDef(state, iso, cat, portLevel) {
  const c = state.countries[iso];
  const tier = Math.min(c.researchedTier ?? 1, portLevel);
  return NAVAL_UNITS[`${c.doctrine === "oriental" ? "ori" : "occ"}-${tier}-${cat}`];
}

// Compra en el mercado los suministros y el combustible que faltan para
// `cost`, en lotes, si el dinero alcanza para eso Y para el propio gasto con un
// colchón. Devuelve true si tras la compra ya se puede pagar. La usa también el
// puerto (ai.js): el suministro que le falta a un bot para el barco es el mismo
// que le falta para la obra.
export function buyShortfall(state, iso, cost) {
  const r = state.countries[iso].resources;
  if ((cost.manpower || 0) > r.manpower) return false; // la gente no se compra
  const lote = Math.min(...C.MARKET_LOTS);
  const falta = {};
  let gasto = 0;
  for (const res of ["supplies", "fuel"]) {
    const n = Math.max(0, (cost[res] || 0) - r[res]);
    if (!n) continue;
    falta[res] = Math.ceil(n / lote) * lote;
    gasto += falta[res] * C.MARKET[res].buy;
  }
  if (!gasto) return canAfford(state, iso, cost);
  if (r.money < (gasto + (cost.money || 0)) * C.AI_MARKET_MARGIN) return false;
  for (const [res, qty] of Object.entries(falta)) {
    if (!trade(state, iso, res, qty, "buy").ok) return false;
  }
  return canAfford(state, iso, cost);
}

// Clase de barco a reclutar según el carácter. Con `soloPagable`, solo entre
// las que puede pagar ya.
export function pickNavalCategory(state, iso, P, portLevel = 1, soloPagable = false) {
  const oriental = state.countries[iso].doctrine === "oriental";
  const pairs = [];
  for (const [cat, base] of Object.entries(BASE_MIX)) {
    if (!base) continue;
    const def = navalDef(state, iso, cat, portLevel);
    if (!def) continue;
    if (soloPagable && !canAfford(state, iso, def.cost)) continue;
    let w = base * (P.navyMix?.[cat] ?? 1);
    // El submarino es el arma naval fuerte de Oriente (docs/NAVAL.md)
    if (oriental && cat === "submarino") w *= 1.5;
    if (w > 0) pairs.push([cat, w]);
  }
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  if (!total) return null;
  let r = Math.random() * total;
  for (const [cat, w] of pairs) {
    r -= w;
    if (r <= 0) return cat;
  }
  return pairs[0][0];
}

// Poder de una lista de unidades: el mismo criterio que aiMilitary
function powerOf(list) {
  return list.reduce((s, u) => s + hpFrac(u) * ((unitDef(u.type)?.cost.money || 5000) / 5000), 0);
}

const geo = (pid) => {
  const p = S.provinces.get(pid);
  return p ? [p.cx, p.cy] : null;
};

// Maniobra de la flota en guerra
export function aiNaval(state, iso, vis, P, battles) {
  const c = state.countries[iso];
  if (!c.wars.length) return;
  const flota = navalUnitsOf(state, iso).filter((u) => unitDef(u.type)?.category !== "transporte");
  if (!flota.length) return;

  // Soltar órdenes que ya no tienen sentido: el blanco se fue o ya no hay guerra
  for (const u of flota) {
    if (u.task?.kind !== "naval") continue;
    const sigue = state.units.some(
      (x) => !x.dead && x.pos === u.task.pid && atWar(state, iso, x.owner)
    );
    if (u.task.mode === "flota" && !sigue) u.task = null;
    else if (u.task.mode === "costa" && !atWar(state, iso, u.task.enemy)) u.task = null;
  }

  const libres = flota.filter((u) => !u.edgeLeft && !u.path.length && !u.task && !battles.has(u.pos));
  if (!libres.length) return;
  const miPoder = powerOf(libres);
  const centro = geo(libres[0].pos);
  if (!centro) return;

  // 1) Flotas enemigas que VE y puede batir, la más cercana primero
  const porCelda = new Map();
  for (const x of state.units) {
    if (x.dead || x.embarked || !isNaval(x.type) || !atWar(state, iso, x.owner)) continue;
    if (!vis.union.has(x.pos)) continue;
    if (!porCelda.has(x.pos)) porCelda.set(x.pos, []);
    porCelda.get(x.pos).push(x);
  }
  let blanco = null;
  let mejor = Infinity;
  for (const [pid, enemigos] of porCelda) {
    const km = distKm(centro, geo(pid));
    if (km > C.AI_NAVAL_RANGE_KM || km >= mejor) continue;
    if (miPoder <= powerOf(enemigos) * P.attackRatio) continue;
    blanco = pid;
    mejor = km;
  }
  if (blanco) {
    mandar(state, libres, blanco, { kind: "naval", mode: "flota", pid: blanco });
    return;
  }

  // 2) Sin flota a la vista: acercar el grupo a la costa enemiga, pero solo si
  //    lleva destructores con misil de crucero. Una flota de corbetas junto a
  //    una costa enemiga no hace nada más que ofrecerse a la aviación.
  const conMisil = libres.filter((u) => strikeWeaponsFor(u.type).some((s) => s.weapon.objetivos === "provincia-terrestre"));
  if (!conMisil.length) return;
  const alcance = Math.min(...conMisil.map((u) => strikeWeaponsFor(u.type)[0].rangoKm));
  let costa = null;
  let enemigo = null;
  mejor = Infinity;
  for (const p of S.provinceList) {
    if (p.isSea) continue;
    const ctrl = controller(state.provinces[p.id]);
    if (!ctrl || !atWar(state, iso, ctrl) || !isCoastal(p.id)) continue;
    const km = distKm(centro, [p.cx, p.cy]);
    if (km < mejor) { mejor = km; costa = p; enemigo = ctrl; }
  }
  // Ya está a tiro: quedarse quieto es lo correcto, aiMissiles dispara solo
  if (!costa || mejor <= alcance * 0.8 || mejor > C.AI_NAVAL_RANGE_KM) return;
  const celda = (S.edges.get(costa.id) || []).map((e) => e.to).find((t) => S.provinces.get(t)?.isSea);
  if (!celda) return;
  mandar(state, libres, celda, { kind: "naval", mode: "costa", pid: celda, enemy: enemigo });
}

// La flota va junta: se ordena a todas las libres, hasta el máximo sin
// penalización de apilamiento. orderMove borra la tarea (es una orden nueva),
// así que se asigna después.
function mandar(state, barcos, pid, tarea) {
  for (const u of barcos.slice(0, C.AI_NAVAL_GROUP)) {
    if (u.pos === pid) continue;
    if (orderMove(state, u, pid)) u.task = { ...tarea };
  }
}
