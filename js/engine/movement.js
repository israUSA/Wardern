// Movimiento: coste de aristas, pathfinding (Dijkstra) y avance por tick.
// Reglas por clase de unidad: terrestre solo tierra · naval solo mar · aéreo todo (vuelo).
import * as C from "../data/constants.js";
import { S, unitDef, isNaval, controller, atWar } from "./state.js";

export function edgeMinutes(unitType, fromP, toP, strait) {
  const d = distKm([fromP.cx, fromP.cy], [toP.cx, toP.cy]);
  const u = unitDef(unitType);
  const hours = d / (u?.speed || 20);
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
  if (cell?.isSea) return !!unitDef(unit.type)?.air;         // el mar solo lo cruzan aéreos
  if (unitDef(unit.type)?.air) return true;                  // sobrevuelo libre
  const ctrl = controller(state.provinces[pid]);
  return ctrl === unit.owner || atWar(state, unit.owner, ctrl);
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

export function orderMove(state, unit, targetId) {
  const cell = S.provinces.get(targetId);
  // Barcos terminan en el mar; terrestres/aéreos nunca terminan en el mar
  if (cell?.isSea && !isNaval(unit.type)) return false;
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

export function tickMovement(state, dt) {
  for (const u of state.units) {
    if (!u.edgeLeft) continue;
    u.edgeLeft.minutesLeft -= dt;
    if (u.edgeLeft.minutesLeft > 0) continue;

    u.pos = u.edgeLeft.to;
    u.edgeLeft = null;
    u.path.shift();
    u.task = null;

    const cell = S.provinces.get(u.pos);
    if (cell?.isSea) {
      // navegando: sin interacción con fronteras, pero encadena el siguiente tramo
      if (u.path.length) u.edgeLeft = startEdgeFor(state, u, u.path[0]);
      continue;
    }
    const ctrl = controller(state.provinces[u.pos]);
    if (atWar(state, u.owner, ctrl)) {
      u.path = []; // llega a territorio hostil: se detiene y combate
    } else if (u.path.length) {
      u.edgeLeft = startEdgeFor(state, u, u.path[0]);
    }
  }
}
