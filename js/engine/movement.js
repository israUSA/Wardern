// Movimiento: coste de aristas, pathfinding (Dijkstra) y avance por tick.
// Reglas por clase de unidad: terrestre solo tierra · naval solo mar · aéreo todo (vuelo).
import * as C from "../data/constants.js";
import { S, unitDef, isNaval, controller, atWar, log } from "./state.js";
// AIR_LOADOUTS se toma del módulo de DATOS, no de air-combat.js: ese importa
// movement.js y la dependencia circular dejaría la tabla sin inicializar.
import { CARRIER_CAPACITY, CARRIER_CAPABLE, AIR_LOADOUTS } from "../data/air-combat-data.js";
import { formationSpeedType } from "./formations.js";

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
  const def = unitDef(unit.type);
  if (cell?.isSea) return !!def?.air;                        // el mar abierto no tiene dueño
  // Territorio de otro país. Los aparatos que pueden sobrevolar —drones y
  // furtivos, ver canOverfly— entran sin permiso: nadie declara la guerra por
  // algo que no ha visto. Todo lo demás, tropa o aviación convencional,
  // necesita ser el dueño o estar ya en guerra.
  if (def?.air && canOverfly(unit.type)) return true;
  const ctrl = controller(state.provinces[pid]);
  return ctrl === unit.owner || atWar(state, unit.owner, ctrl);
}

// ¿Puede este aparato meterse en espacio aéreo (o aguas) de otro sin que cuente
// como declaración de guerra? Drones siempre; tripulados solo si su firma de
// radar está por debajo del umbral furtivo. Atacar sigue siendo guerra en todos
// los casos: esto es entrar y mirar, no disparar.
export function canOverfly(type) {
  const def = unitDef(type);
  if (!def?.air) return false;
  if (def.category === "drone") return true;
  return (AIR_LOADOUTS[type]?.rcs ?? 0) >= C.STEALTH_OVERFLIGHT_RCS;
}

// País neutral que impide entrar en `pid`, o null si se puede. Lo usa la interfaz
// para ofrecer la declaración de guerra en vez de un "sin ruta" seco. Solo aplica
// a fuerzas de superficie: `aereo` a true significa que no hay nada que declarar.
export function neutralBlocker(state, iso, pid, aereo = false) {
  if (aereo) return null;
  const cell = S.provinces.get(pid);
  if (!cell || cell.isSea) return null;
  const ctrl = controller(state.provinces[pid]);
  if (!ctrl || ctrl === iso || atWar(state, iso, ctrl)) return null;
  return ctrl;
}

// ---------------------------------------------------------------------------
// Radio de acción aéreo
// ---------------------------------------------------------------------------

// Radio de acción de ESTE aparato, en km. null si no es aéreo.
export function airRangeKm(unitType) {
  const def = unitDef(unitType);
  if (!def?.air) return null;
  return C.AIR_RANGE_KM_BY_TYPE[unitType]
    ?? C.AIR_RANGE_KM[def.category]?.[def.tier ?? 1]
    ?? null;
}

// Base de la que depende un aparato: el aeródromo propio (pista ≥ 1) o el
// portaviones propio más cercano. Es el centro del círculo de alcance que pinta
// el mapa y contra el que se mide cada orden. Devuelve { pid, cx, cy, carrier }.
//
// El aparato embarcado no busca nada: su base es el buque que lo lleva, y el
// radio le viaja con él. Es justo para lo que sirve un portaviones.
export function airBaseFor(state, unit) {
  const def = unitDef(unit.type);
  if (!def?.air) return null;
  if (unit.embarked) {
    const buque = state.units.find((x) => x.id === unit.embarked && !x.dead);
    const cel = buque && S.provinces.get(buque.pos);
    return cel ? { pid: buque.pos, cx: cel.cx, cy: cel.cy, carrier: buque.id } : null;
  }
  const from = S.provinces.get(unit.pos);
  if (!from) return null;
  let mejor = null;
  const probar = (pid, cx, cy, carrier) => {
    const km = distKm([from.cx, from.cy], [cx, cy]);
    if (!mejor || km < mejor.km) mejor = { pid, cx, cy, km, carrier };
  };
  for (const p of S.provinceList) {
    if (p.isSea) continue;
    const ps = state.provinces[p.id];
    if (!ps || controller(ps) !== unit.owner) continue;
    if ((ps.buildings?.aerobase || 0) < 1) continue;
    probar(p.id, p.cx, p.cy, null);
  }
  if (CARRIER_CAPABLE.has(unit.type)) {
    for (const c of state.units) {
      if (c.dead || c.embarked || c.owner !== unit.owner || !CARRIER_CAPACITY[c.type]) continue;
      const cel = S.provinces.get(c.pos);
      if (cel) probar(c.pos, cel.cx, cel.cy, c.id);
    }
  }
  return mejor;
}

// ¿Es `pid` una base propia donde este aparato puede quedarse? Un aeródromo
// propio con pista, o un portaviones propio con plaza libre si es de cubierta.
function esBasePropia(state, unit, pid) {
  const cel = S.provinces.get(pid);
  if (!cel) return false;
  if (cel.isSea) return carrierBerths(state, unit, pid).length > 0;
  const ps = state.provinces[pid];
  return !!ps && controller(ps) === unit.owner && (ps.buildings?.aerobase || 0) >= 1;
}

// ¿Le da el combustible para plantarse en `pid`? Sin ninguna base propia el
// límite no se aplica: dejar a toda la aviación clavada en el sitio por no tener
// aeródromo sería castigar al jugador por algo que no puede arreglar en el
// momento. Devuelve el detalle para que la interfaz diga cuánto se pasa en vez
// de un "no" seco.
//
// Hay DOS límites, y la diferencia es la que separa una misión de una mudanza:
//
//   · RADIO DE COMBATE (airRangeKm) para cualquier destino normal. Es ida Y
//     vuelta: el aparato tiene que poder volver a casa.
//   · RADIO DE TRASLADO (×FERRY_MULT) cuando el destino es OTRA BASE PROPIA.
//     Ahí no vuelve —se queda a vivir allí— así que el mismo depósito le cunde
//     el doble. Es lo que en aviación se llama un vuelo de ferry.
//
// Sin esta distinción, llevar un escuadrón al aeródromo que acabas de construir
// al otro lado del país era imposible, aunque fuera exactamente para eso para lo
// que lo habías construido.
export function airRangeInfo(state, unit, pid) {
  const radioKm = airRangeKm(unit.type);
  const destino = S.provinces.get(pid);
  if (radioKm == null || !destino) return { ok: true };

  // Apontar en un portaviones propio NO tiene límite de alcance. Un portaviones
  // es una base que se mueve, y suele estar en mitad de un océano lejísimos de
  // cualquier aeródromo: si el avión no pudiera llegar nunca hasta él, el ala
  // embarcada sería inservible y el buque, un adorno carísimo. El freno ya está
  // en otro sitio —solo la aviación de cubierta (CARRIER_CAPABLE) puede, y el
  // buque tiene que tener plaza libre—, así que no hace falta uno más.
  if (carrierBerths(state, unit, pid).length) return { ok: true, apontaje: true, radioKm };

  const base = airBaseFor(state, unit);
  if (!base) return { ok: true, sinBase: true, radioKm };
  const km = distKm([base.cx, base.cy], [destino.cx, destino.cy]);
  const traslado = esBasePropia(state, unit, pid);
  const tope = traslado ? radioKm * C.FERRY_MULT : radioKm;
  return { ok: km <= tope, km: Math.round(km), radioKm, tope: Math.round(tope), traslado, base };
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
  if (!airRangeInfo(state, unit, targetId).ok) return false;
  const path = findPath(state, unit, targetId);
  if (!path || !path.length) return false;
  unit.path = path;
  unit.edgeLeft = startEdgeFor(state, unit, path[0]);
  unit.task = null;
  return true;
}

// Una formación avanza a la velocidad de su miembro MÁS LENTO. No es solo una
// regla de equilibrio: si cada unidad calculase su propio tramo, el carro
// llegaría antes que la infantería y la formación se desparramaría por media
// docena de provincias. Usando el mismo tipo para todos, llegan juntos.
function startEdgeFor(state, unit, toId) {
  const e = edgeInfo(unit.pos, toId);
  const tipo = (unit.formation && formationSpeedType(state, unit.formation)) || unit.type;
  const total = edgeMinutes(tipo, S.provinces.get(unit.pos), S.provinces.get(toId), !!e?.strait);
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
// Patrullar. A diferencia de moverse, aquí SÍ vale un sector de mar aunque no
// haya portaviones debajo: patrullar es dar vueltas un rato y volverse a casa, no
// quedarse a vivir sobre el agua —la cuenta atrás acaba en regreso a base—. Es lo
// que permite barrer el mar buscando barcos enemigos sin tener flota allí.
export function orderPatrol(state, unit, pid) {
  if (!unitDef(unit.type)?.air || unit.embarked) return false;
  const yaAhi = pid === unit.pos && !unit.edgeLeft && !unit.path.length;
  if (!yaAhi && !orderMoveAereo(state, unit, pid)) return false;
  unit.task = { kind: "patrol", minutesLeft: C.AIR_PATROL_MINUTES };
  return true;
}

// orderMove sin la regla de "sobre el mar no hay dónde posarse", solo para la ida
// de una patrulla. El radio de acción sí se sigue respetando.
function orderMoveAereo(state, unit, targetId) {
  if (!S.provinces.get(targetId)) return false;
  if (!airRangeInfo(state, unit, targetId).ok) return false;
  const path = findPath(state, unit, targetId);
  if (!path || !path.length) return false;
  unit.path = path;
  unit.edgeLeft = startEdgeFor(state, unit, path[0]);
  unit.task = null;
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

// Atacar a una unidad CONCRETA: se va a por ella donde esté. No hay "botón de
// atacar" en el motor —el combate salta solo cuando dos enemigos comparten
// provincia y están parados, ver combat.js— así que esto es una orden de
// movimiento que además recuerda a quién persigue, para volver a salir tras ella
// si se mueve o se retira.
export function orderAttack(state, unit, target) {
  if (!target || target.dead || target.embarked) return false;
  if (!atWar(state, unit.owner, target.owner)) return false;
  if (target.pos !== unit.pos && !orderMove(state, unit, target.pos)) return false;
  unit.task = { kind: "hunt", targetId: target.id };
  return true;
}

// Persecución. Solo actúa con la unidad PARADA: replantear la ruta a medio salto
// reiniciaría el tramo en curso (orderMove recalcula desde unit.pos) y la unidad
// se quedaría dando tumbos sin avanzar nunca.
export function tickHunt(state) {
  for (const u of state.units) {
    if (u.dead || u.embarked) continue;
    if (u.task?.kind !== "hunt") continue;
    const t = state.units.find((x) => x.id === u.task.targetId && !x.dead);
    if (!t || t.embarked) {
      // Muerta, embarcada o desaparecida: la caza termina aquí. Esto se mira
      // también con la unidad EN MARCHA, para no seguir persiguiendo a un
      // fantasma hasta el final del trayecto (termina el tramo y se queda).
      u.task = null;
      continue;
    }
    if (u.edgeLeft || u.path.length) continue; // reencaminar a medio salto lo reiniciaría
    if (t.pos === u.pos) continue; // ya comparten celda: de esto se ocupa el combate
    // Si hay enemigo plantado aquí, primero se pelea lo que se tiene delante: sin
    // esto la caza reordenaba la marcha en cuanto el combate la detenía y la
    // unidad se iba sin disparar, porque en tránsito no combate.
    if (enemyPresent(state, u)) continue;
    // orderMove BORRA la tarea (es una orden nueva), así que hay que devolverla:
    // si no, la caza se cancelaba a sí misma en el primer reencaminamiento.
    const tarea = u.task;
    if (orderMove(state, u, t.pos)) {
      u.task = tarea;
    } else {
      log(state, `${unitDef(u.type)?.name} pierde el rastro de su objetivo`, "info");
      u.task = null;
    }
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
    // Las órdenes del jugador que duran varios saltos son la excepción: la
    // patrulla lleva su cuenta atrás dentro y la caza lleva a quién persigue.
    if (u.task && u.task.kind !== "patrol" && u.task.kind !== "hunt") u.task = null;

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
