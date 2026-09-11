// Movimiento: coste de aristas, pathfinding (Dijkstra) y avance por tick.
// Reglas por clase de unidad: terrestre solo tierra · naval solo mar · aéreo todo (vuelo).
import * as C from "../data/constants.js";
import { S, unitDef, isNaval, controller, atWar, log } from "./state.js";
import { CARRIER_CAPACITY, CARRIER_CAPABLE } from "../data/air-combat-data.js";

export function edgeMinutes(unitType, fromP, toP, strait) {
  const d = distKm([fromP.cx, fromP.cy], [toP.cx, toP.cy]);
  const u = unitDef(unitType);
  const hours = d / ((u?.speed || 20) * C.MOVE_SPEED_MULT);
  const mult = u?.air
    ? 1 // los aéreos ignoran terreno y estrechos
    : (C.TERRAIN_MOVE_MULT[toP.terrain] || 1) * (strait ? C.STRAIT_COST_MULT : 1);
  return hours * 60 * mult;
}

// Distancia por tierra (haversine) entre dos puntos [lon,lat]
function distKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function edgeInfo(fromId, toId) {
  const e = (S.edges.get(fromId) || []).find((x) => x.to === toId);
  return e || null;
}

function canEnter(state, unit, pid) {
  const cell = S.provinces.get(pid);
  if (isNaval(unit.type)) return !!cell?.isSea;              // barcos: solo mar
  if (cell?.isSea) return !!unitDef(unit.type)?.air;         // el mar no tiene dueño
  // Territorio de otro país: hay que ser su dueño o estar en guerra. Antes los
  // aéreos tenían sobrevuelo LIBRE y podías pasear un caza por un país neutral
  // sin consecuencia diplomática ninguna; ahora el espacio aéreo también se
  // respeta y entrar exige declarar la guerra (la UI lo ofrece al intentarlo).
  const ctrl = controller(state.provinces[pid]);
  return ctrl === unit.owner || atWar(state, unit.owner, ctrl);
}

// País neutral que impide entrar en `pid`, o null si se puede. Lo usa la interfaz
// para ofrecer la declaración de guerra en vez de un "sin ruta" seco.
export function neutralBlocker(state, iso, pid) {
  const cell = S.provinces.get(pid);
  if (!cell || cell.isSea) return null;
  const ctrl = controller(state.provinces[pid]);
  if (!ctrl || ctrl === iso || atWar(state, iso, ctrl)) return null;
  return ctrl;
}

export function findPath(state, unit, targetId) {
  const start = unit.pos;
  if (start === targetId) return null;
  if (!S.provinces.has(targetId)) return null;

  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const visited = new Set();
  const pq = [[0, start]];

  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, cur] = pq.shift();
    if (visited.has(cur)) continue;
    visited.add(cur);
    if (cur === targetId) break;
    for (const e of S.edges.get(cur) || []) {
      if (visited.has(e.to)) continue;
      if (!canEnter(state, unit, e.to)) continue;
      const nd = d + edgeMinutes(unit.type, S.provinces.get(cur), S.provinces.get(e.to), e.strait);
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, cur);
        pq.push([nd, e.to]);
      }
    }
  }
  if (!prev.has(targetId)) return null;

  const path = [];
  let cur = targetId;
  while (cur !== start) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path;
}

// Portaviones propios con plaza libre en `pid` donde ESTA aeronave puede apontar.
// Vive aquí, y no en air-combat.js, porque es una regla de DESTINO: sin ella el
// pathfinding rechazaba cualquier sector de mar para un avión y la aviación
// embarcada era inalcanzable (el avión nunca podía volar hasta el buque).
export function carrierBerths(state, unit, pid) {
  if (!unit || unit.embarked || !CARRIER_CAPABLE.has(unit.type)) return [];
  return state.units.filter(
    (c) =>
      !c.dead && !c.embarked && c.owner === unit.owner && CARRIER_CAPACITY[c.type] &&
      c.pos === pid && !c.edgeLeft &&
      state.units.filter((x) => !x.dead && x.embarked === c.id).length < CARRIER_CAPACITY[c.type]
  );
}

export function orderMove(state, unit, targetId) {
  const cell = S.provinces.get(targetId);
  // Barcos terminan en el mar; terrestres y aéreos no... salvo una aeronave de
  // cubierta cuyo destino es un portaviones propio parado en ese sector: eso no
  // es "quedarse sobre el agua", es ir a aterrizar.
  if (cell?.isSea && !isNaval(unit.type) && !carrierBerths(state, unit, targetId).length) return false;
  if (!cell?.isSea && isNaval(unit.type)) return false;
  const path = findPath(state, unit, targetId);
  if (!path || !path.length) return false;
  unit.path = path;
  unit.edgeLeft = startEdgeFor(state, unit, path[0]);
  unit.task = null;
  return true;
}

function startEdgeFor(state, unit, toId) {
  const e = edgeInfo(unit.pos, toId);
  const total = edgeMinutes(unit.type, S.provinces.get(unit.pos), S.provinces.get(toId), !!e?.strait);
  return { to: toId, strait: !!e?.strait, minutesLeft: total, total };
}

// Cancela la ruta pendiente. La unidad NO se teletransporta: termina el tramo que
// ya está recorriendo (media provincia a medio cruzar no existe en el motor) y se
// queda ahí, porque tickMovement solo encadena el siguiente tramo si queda ruta.
export function orderStop(state, unit) {
  if (!unit.edgeLeft && !unit.path.length) return false;
  unit.path = unit.edgeLeft ? [unit.edgeLeft.to] : [];
  unit.task = null;
  return true;
}

// Regreso a base. Un avión no se queda flotando en el aire: "Detener" en vuelo
// lo manda al aeródromo propio más cercano con pista (aerobase ≥ 1). Devuelve la
// provincia de destino, o null si no hay ninguna alcanzable.
// Se prueban las candidatas por cercanía en línea recta y se acepta la primera con
// ruta real, en vez de calcular Dijkstra contra todas las bases del país.
export function orderReturnToBase(state, unit) {
  const from = S.provinces.get(unit.pos);
  if (!from) return null;
  const bases = [];
  for (const p of S.provinceList) {
    if (p.isSea) continue;
    const ps = state.provinces[p.id];
    if (!ps || controller(ps) !== unit.owner) continue;
    if ((ps.buildings.aerobase || 0) < 1) continue;
    bases.push({ id: p.id, km: distKm([from.cx, from.cy], [p.cx, p.cy]) });
  }
  if (!bases.length) return null;
  bases.sort((a, b) => a.km - b.km);
  if (bases[0].id === unit.pos) {
    // Ya está sobre su propia base: aterriza aquí mismo. Se cancela también el
    // tramo en curso —a diferencia de orderStop, que dejaría al avión terminando
    // el salto y posándose en la provincia siguiente, no en su base—. Es la misma
    // semántica que ya tiene orderMove, que al reordenar reinicia el tramo desde
    // la provincia de origen.
    unit.path = [];
    unit.edgeLeft = null;
    unit.task = null;
    return unit.pos;
  }
  for (const b of bases.slice(0, 8)) {
    if (orderMove(state, unit, b.id)) return b.id;
  }
  return null;
}

// Apontaje al final de la ruta. Si una aeronave termina su viaje sobre un sector
// de mar es porque pidió ir a un portaviones (orderMove no admite otro destino
// marítimo), así que toma cubierta sola en cuanto llega: obligar a un segundo
// clic sobre un avión flotando en mitad del océano no aporta nada.
// El buque puede haber zarpado durante el vuelo; en ese caso el aparato queda
// en el aire y el jugador decide (aterrizar a mano si vuelve, o volver a base).
function landIfCarrier(state, unit) {
  const c = carrierBerths(state, unit, unit.pos)[0];
  if (!c) {
    if (CARRIER_CAPABLE.has(unit.type)) {
      log(state, `${unitDef(unit.type)?.name} llega al sector y no encuentra cubierta libre`, "info");
    }
    return;
  }
  unit.embarked = c.id;
  unit.path = [];
  unit.edgeLeft = null;
  unit.task = null;
  log(state, `${unitDef(unit.type)?.name} toma cubierta en ${unitDef(c.type)?.name}`, "info");
}

// ¿Hay tropa enemiga DETENIDA en la celda de esta unidad? Solo cuenta lo que
// puede combatir: los drones no pelean (js/engine/combat.js los excluye) y una
// unidad de paso tampoco, así que ninguno de los dos frena a nadie.
// Los aéreos no se detienen por esto: un caza no se queda clavado sobre una
// columna de tanques, la sobrevuela.
function enemyPresent(state, unit) {
  if (unitDef(unit.type)?.air) return false;
  return state.units.some(
    (e) =>
      !e.dead && !e.embarked && !e.edgeLeft && e.pos === unit.pos &&
      unitDef(e.type)?.category !== "drone" && !unitDef(e.type)?.air &&
      atWar(state, unit.owner, e.owner)
  );
}

// Patrulla: el avión vuela a `pid` y se queda dando vueltas ahí (visualmente ya
// orbita cualquier aeronave parada fuera de su base — ver renderer.js) durante
// AIR_PATROL_MINUTES; al agotarse, tickAirPatrol la manda sola de vuelta.
// Si ya está exactamente en `pid` y sin nada pendiente, patrulla in situ.
export function orderPatrol(state, unit, pid) {
  if (!unitDef(unit.type)?.air || unit.embarked) return false;
  const yaAhi = pid === unit.pos && !unit.edgeLeft && !unit.path.length;
  if (!yaAhi && !orderMove(state, unit, pid)) return false;
  unit.task = { kind: "patrol", minutesLeft: C.AIR_PATROL_MINUTES };
  return true;
}

// Cuenta atrás de la patrulla. Solo corre con el avión YA EN SITIO (sin tramo en
// curso): encadenar los saltos del viaje de ida no gasta horas de patrulla, esas
// empiezan a correr al llegar. Al agotarse, vuelve a base sola —la misma orden
// que el botón "Volver a base"— sin que el jugador tenga que vigilar el reloj.
export function tickAirPatrol(state, dt) {
  for (const u of state.units) {
    if (u.dead || u.embarked || u.edgeLeft || u.path.length) continue;
    if (u.task?.kind !== "patrol") continue;
    u.task.minutesLeft -= dt;
    if (u.task.minutesLeft > 0) continue;
    const dest = orderReturnToBase(state, u); // éxito → limpia el task por su cuenta
    if (dest) log(state, `${unitDef(u.type)?.name} agota su patrulla y regresa a base`, "info");
    else u.task = null; // sin base propia alcanzable: se queda, pero sin repetir el aviso cada tick
  }
}

export function tickMovement(state, dt) {
  for (const u of state.units) {
    if (!u.edgeLeft) continue;
    u.edgeLeft.minutesLeft -= dt;
    if (u.edgeLeft.minutesLeft > 0) continue;

    u.pos = u.edgeLeft.to;
    u.edgeLeft = null;
    u.path.shift();
    // Se limpia la tarea de la IA (defend/attack) en CADA salto, no solo al
    // llegar — así vuelve a evaluar la situación en la provincia intermedia.
    // La patrulla es la excepción: su cuenta atrás vive en la MISMA tarea, así
    // que un destino a más de un salto la perdía antes de completar la ruta.
    if (u.task?.kind !== "patrol") u.task = null;

    const cell = S.provinces.get(u.pos);
    if (cell?.isSea) {
      // navegando: sin interacción con fronteras, pero encadena el siguiente tramo
      if (u.path.length) u.edgeLeft = startEdgeFor(state, u, u.path[0]);
      else if (unitDef(u.type)?.air) landIfCarrier(state, u);
      continue;
    }
    const ctrl = controller(state.provinces[u.pos]);
    if (atWar(state, u.owner, ctrl) || enemyPresent(state, u)) {
      // Territorio hostil O tropa enemiga plantada aquí: se detiene y combate.
      // Lo segundo faltaba: si el enemigo estaba dentro de una provincia MÍA
      // (invadiéndola, aún sin conquistarla), el controlador seguía siendo yo y
      // mis columnas le pasaban por al lado sin pegar un tiro.
      u.path = [];
    } else if (u.path.length) {
      u.edgeLeft = startEdgeFor(state, u, u.path[0]);
    }
  }
}
