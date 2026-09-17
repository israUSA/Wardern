// Desembarcos de los bots (docs/IA.md §Desembarcos).
//
// Un desembarco no es una orden sino una OPERACIÓN que dura días y pasa por
// fases. Se guarda en state.countries[iso].aiLanding —viaja con el guardado— y
// cada chequeo de IA la hace avanzar un paso:
//
//   planear   elegir la playa: provincia costera enemiga, al alcance de su base
//             naval, con la defensa más floja que conozca. Elegir la fuerza.
//   reunir    traer o construir los transportes al puerto, y la fuerza a la
//             provincia del puerto. Cuando están todos, embarcar.
//   navegar   transportes y escolta hacia la celda de la playa. Al llegar,
//             desembarcar: el combate lo resuelve el motor como cualquier otro.
//   cabeza    ya en tierra. La operación NO se cierra: vigila la cabeza de playa
//             y, si la aprietan más de lo que aguanta, vuelve a "reunir" con una
//             segunda oleada. Sin esto, un bot dejaba tres fichas en una isla y
//             se olvidaba de ellas.
//
// Cuándo se plantea: solo en guerra, solo con puerto, y solo si el enemigo NO
// tiene ninguna provincia pegada a su territorio —ni por tierra ni por
// estrecho, que la tropa cruza andando—. El Almirante es la excepción: lo
// intenta también de flanco, con frontera abierta (P.flank).
//
// Una operación que no termina en AI_LANDING_MAX_DAYS se cancela: la fuerza
// embarcada vuelve al puerto y desembarca en casa.
import * as C from "../data/constants.js";
import { S, unitDef, isNaval, controller, atWar, hpFrac, distKm, log } from "./state.js";
import { orderMove, findPath, edgeMinutes } from "./movement.js";
import { embark, disembark } from "./naval.js";
import { startRecruitCategory, canAfford } from "./economy.js";
import { coastalProvinces, buyShortfall, navalUnitsOf } from "./ai-naval.js";
import { NAVAL_UNITS } from "../data/naval-data.js";

const potencia = (u) => hpFrac(u) * ((unitDef(u.type)?.cost.money || 5000) / 5000);

// Poder que un bot SUPONE en una provincia que no ve: el mismo supuesto que
// guessPower (AI_GUESS_PER_PROVINCE unidades), a potencia de fusilero.
const DEFENSA_SUPUESTA = () => C.AI_GUESS_PER_PROVINCE * (14000 / 5000);

export const seaCellOf = (pid) =>
  (S.edges.get(pid) || []).map((e) => e.to).find((t) => S.provinces.get(t)?.isSea) || null;

const esTransporte = (u) => (unitDef(u.type)?.capacity || 0) > 0 && isNaval(u.type);
const libre = (u) => !u.dead && !u.edgeLeft && !u.path.length;

// Unidades comprometidas en la operación en curso: aiMilitary no debe tocarlas
export function landingUnitIds(state, iso) {
  const op = state.countries[iso]?.aiLanding;
  return new Set(op ? op.troops : []);
}

// ¿Tiene el enemigo alguna provincia pegada a mi territorio, por tierra o por
// estrecho? Si la tiene, mis tropas llegan andando y no hace falta barco.
export function landBorderWith(state, iso, enemy) {
  for (const p of S.provinceList) {
    if (p.isSea || controller(state.provinces[p.id]) !== iso) continue;
    for (const e of S.edges.get(p.id) || []) {
      if (controller(state.provinces[e.to]) === enemy) return true;
    }
  }
  return false;
}

// Puertos desde los que puede operar: costeras propias con puerto
export function landingPorts(state, iso) {
  return coastalProvinces(state, iso).filter(
    (p) => (state.provinces[p.id].buildings.puerto || 0) >= 1 && seaCellOf(p.id)
  );
}

const tipoTransporte = (state, iso) =>
  `${state.countries[iso].doctrine === "oriental" ? "ori" : "occ"}-1-transporte`;

// Horas de travesía de un transporte por la ruta real, o Infinity sin ruta
export function sailHours(state, iso, fromCell, toCell) {
  if (fromCell === toCell) return 0;
  const tipo = tipoTransporte(state, iso);
  const ruta = findPath(state, { type: tipo, owner: iso, pos: fromCell, path: [] }, toCell);
  if (!ruta) return Infinity;
  let min = 0;
  let prev = fromCell;
  for (const c of ruta) {
    min += edgeMinutes(tipo, S.provinces.get(prev), S.provinces.get(c), false);
    prev = c;
  }
  return min / 60;
}

// ¿Puede pagar los transportes que le faltan, comprando en el mercado si hace
// falta? Sin esta cuenta, un país pobre planeaba, se quedaba días esperando un
// transporte que no iba a poder pagar y tenía la tropa reservada mientras tanto.
function puedeTransportes(state, iso, faltan) {
  if (faltan <= 0) return true;
  const r = state.countries[iso].resources;
  const cost = NAVAL_UNITS[tipoTransporte(state, iso)].cost;
  let dinero = (cost.money || 0) * faltan;
  for (const res of ["supplies", "fuel"]) {
    dinero += Math.max(0, (cost[res] || 0) * faltan - r[res]) * C.MARKET[res].buy;
  }
  return r.money >= dinero * C.AI_MARKET_MARGIN && r.manpower >= (cost.manpower || 0) * faltan;
}

// Tropa de tierra que se puede embarcar: ociosa, sin tarea, fuera de combate y
// lejos del frente. Con `cerca`, la más próxima a esa provincia primero: la
// operación tiene fecha de caducidad y una división en Alaska no llega a
// embarcar en Florida.
function fuerzaDisponible(state, iso, battles, cerca = null) {
  const out = state.units.filter(
    (u) =>
      u.owner === iso && !u.embarked && !u.task && libre(u) && !isNaval(u.type) &&
      !unitDef(u.type)?.air && !battles.has(u.pos) && !S.provinces.get(u.pos)?.isSea &&
      !enFrente(state, iso, u.pos)
  );
  return cerca ? out.sort((a, b) => dist(a.pos, cerca) - dist(b.pos, cerca)) : out;
}

// Provincia propia con enemigo al lado: su tropa no se lleva a ninguna parte
function enFrente(state, iso, pid) {
  for (const e of S.edges.get(pid) || []) {
    const ctrl = controller(state.provinces[e.to]);
    if (ctrl && ctrl !== iso && atWar(state, iso, ctrl)) return true;
  }
  return false;
}

// ---------- Planear ----------

export function planLanding(state, iso, vis, P, battles) {
  const c = state.countries[iso];
  const puertos = landingPorts(state, iso);
  if (!puertos.length) return null;

  // Fuerza disponible: tropa de tierra ociosa y lejos del frente
  const tropa = fuerzaDisponible(state, iso, battles);
  if (tropa.length < C.AI_LANDING_MIN) return null;

  const playas = [];
  // Playas posibles, cada una con el puerto propio más cercano. Se prueba
  // desde todos: el de más nivel puede estar en la otra punta del país (EEUU:
  // Washington queda fuera de alcance de Venezuela; Florida, no).
  for (const enemy of c.wars) {
    if (!P.flank && landBorderWith(state, iso, enemy)) continue;
    for (const p of S.provinceList) {
      if (p.isSea || controller(state.provinces[p.id]) !== enemy) continue;
      const celda = seaCellOf(p.id);
      if (!celda) continue;
      let puerto = null;
      let km = Infinity;
      for (const q of puertos) {
        const d = distKm([q.cx, q.cy], [p.cx, p.cy]);
        if (d < km) { km = d; puerto = q; }
      }
      if (km > C.AI_NAVAL_RANGE_KM) continue;
      let def;
      if (vis.strong.has(p.id)) {
        def = state.units
          .filter((u) => u.pos === p.id && !u.dead && !u.embarked && atWar(state, iso, u.owner))
          .reduce((s, u) => s + potencia(u), 0);
      } else {
        def = DEFENSA_SUPUESTA();
      }
      playas.push({ enemy, pid: p.id, celda, km, def, puerto });
    }
  }
  playas.sort((a, b) => a.def - b.def || a.km - b.km);

  const libresT = navalUnitsOf(state, iso).filter((u) => esTransporte(u) && !u.cargo?.length).length;
  let rutasProbadas = 0;
  for (const playa of playas) {
    // La fuerza mínima que supera la defensa con su margen de asalto, tomada
    // de lo más cercano al puerto.
    const cercanas = [...tropa].sort((a, b) => dist(a.pos, playa.puerto.id) - dist(b.pos, playa.puerto.id));
    const fuerza = [];
    let poder = 0;
    for (const u of cercanas) {
      if (fuerza.length >= C.AI_LANDING_MAX) break;
      fuerza.push(u);
      poder += potencia(u);
      if (fuerza.length >= C.AI_LANDING_MIN && poder > playa.def * P.attackRatio) break;
    }
    if (poder <= playa.def * P.attackRatio) continue; // ni con todo: siguiente playa
    if (!puedeTransportes(state, iso, Math.ceil(fuerza.length / 3) - libresT)) return null;
    // La ruta de verdad, solo para las mejores candidatas (findPath en el mar
    // no es gratis): un puerto en el otro océano no sirve aunque esté cerca
    // en línea recta.
    if (++rutasProbadas > 3) return null;
    if (sailHours(state, iso, seaCellOf(playa.puerto.id), playa.celda) > C.AI_LANDING_SAIL_HOURS) continue;
    return {
      phase: "reunir",
      enemy: playa.enemy,
      target: playa.pid,
      cell: playa.celda,
      port: playa.puerto.id,
      portCell: seaCellOf(playa.puerto.id),
      troops: fuerza.map((u) => u.id),
      transports: [],
      started: state.time,
      wave: 1,
    };
  }
  return null;
}

// ---------- Avanzar la operación ----------

export function aiLanding(state, iso, vis, P, battles) {
  const c = state.countries[iso];
  let op = c.aiLanding;

  if (!op) {
    if (!P.landings || !c.wars.length) return;
    if (state.time < (c.aiLandingNext || 0)) return;
    if (Math.random() >= P.landings) return;
    op = planLanding(state, iso, vis, P, battles);
    if (!op) {
      c.aiLandingNext = state.time + C.AI_CHECK_HOURS * 60 * 6; // nada que hacer: medio día sin mirar
      return;
    }
    c.aiLanding = op;
  }

  const vivas = (ids) => ids.map((id) => state.units.find((u) => u.id === id && !u.dead)).filter(Boolean);
  const tropa = vivas(op.troops);
  const barcos = vivas(op.transports);
  op.troops = tropa.map((u) => u.id);
  op.transports = barcos.map((u) => u.id);

  // La cabeza de playa lleva su propio reloj —desde que se puso el pie en
  // tierra— y no tiene tropa embarcada que valga: sus plazos son otros.
  const tarde = op.phase === "cabeza"
    ? state.time - op.beachAt > C.AI_BEACHHEAD_DAYS * 1440
    : state.time - op.started > C.AI_LANDING_MAX_DAYS * 1440 ||
      (op.phase === "reunir" && state.time - op.started > C.AI_LANDING_GATHER_DAYS * 1440);
  const sinGuerra = !atWar(state, iso, op.enemy);
  const sinTropa = op.phase !== "cabeza" && !tropa.length;
  if (op.phase !== "regresar" && (tarde || sinGuerra || sinTropa)) {
    abortar(state, iso, op, barcos);
    return;
  }

  if (op.phase === "reunir") reunir(state, iso, op, tropa, barcos);
  else if (op.phase === "navegar") navegar(state, iso, op, barcos);
  else if (op.phase === "cabeza") cabeza(state, iso, op, vis, P, battles);
  else if (op.phase === "regresar") regresar(state, iso, op, barcos);
}

function reunir(state, iso, op, tropa, barcos) {
  // Transportes: los que ya hay y estén libres, y los que falten, a la grada
  const hacen = Math.ceil(tropa.length / 3);
  if (barcos.length < hacen) {
    const enUso = new Set(op.transports);
    for (const u of navalUnitsOf(state, iso)) {
      if (barcos.length >= hacen) break;
      if (!esTransporte(u) || enUso.has(u.id) || u.cargo?.length) continue;
      barcos.push(u);
      op.transports.push(u.id);
    }
  }
  const ps = state.provinces[op.port];
  const enGrada = (ps.recruits || []).filter((r) => r.kind === "naval" && NAVAL_UNITS[r.type]?.capacity > 0).length;
  if (barcos.length + enGrada < hacen && (ps.recruits?.length || 0) < C.RECRUIT_SLOTS) {
    const def = NAVAL_UNITS[`${state.countries[iso].doctrine === "oriental" ? "ori" : "occ"}-1-transporte`];
    buyShortfall(state, iso, def.cost);
    startRecruitCategory(state, op.port, "transporte");
  }
  // Los transportes recién botados aparecen en la celda del puerto: se
  // incorporan en cuanto existen.
  if (barcos.length < hacen) {
    for (const u of navalUnitsOf(state, iso)) {
      if (barcos.length >= hacen) break;
      if (esTransporte(u) && u.pos === op.portCell && !op.transports.includes(u.id) && !u.cargo?.length) {
        barcos.push(u);
        op.transports.push(u.id);
      }
    }
  }

  // Todos al puerto. La tarea se borra en cada salto (movement.js), así que se
  // vuelve a dar en cada chequeo a quien esté parado fuera de su sitio.
  for (const u of barcos) if (libre(u) && u.pos !== op.portCell) orderMove(state, u, op.portCell);
  for (const u of tropa) {
    if (u.embarked || !libre(u) || u.pos === op.port) continue;
    if (!orderMove(state, u, op.port)) op.troops = op.troops.filter((id) => id !== u.id); // no llega: fuera
  }

  const listos =
    barcos.length >= hacen &&
    barcos.every((u) => libre(u) && u.pos === op.portCell) &&
    tropa.every((u) => u.embarked || (libre(u) && u.pos === op.port));
  if (!listos) return;

  const ids = new Set(op.troops);
  for (const t of barcos) embark(state, t.id, ids);
  const cargados = barcos.filter((t) => t.cargo?.length);
  if (!cargados.length) return;
  op.transports = cargados.map((t) => t.id);
  op.phase = "navegar";
  for (const t of cargados) orderMove(state, t, op.cell);

  // Escolta: los barcos de guerra libres más cercanos al puerto, a la playa.
  // Son más rápidos que el transporte (47 km/h), así que llegan antes y se
  // baten con lo que haya en la celda.
  const escolta = navalUnitsOf(state, iso)
    .filter((u) => !esTransporte(u) && libre(u) && !u.task)
    .sort((a, b) => dist(a.pos, op.portCell) - dist(b.pos, op.portCell))
    .slice(0, C.AI_LANDING_ESCORTS);
  for (const u of escolta) {
    if (u.pos !== op.cell && orderMove(state, u, op.cell)) u.task = { kind: "naval", mode: "escolta", pid: op.cell };
  }
}

function navegar(state, iso, op, barcos) {
  if (!barcos.length) {
    // Hundidos con la tropa dentro: la operación se acaba sola
    terminar(state, iso);
    return;
  }
  const ctrl = controller(state.provinces[op.target]);
  const valida = ctrl === iso || atWar(state, iso, ctrl);
  for (const t of barcos) {
    if (!t.cargo?.length) continue;
    if (!libre(t)) continue;
    if (t.pos !== op.cell) {
      orderMove(state, t, op.cell); // se paró antes (retirada, ruta rota): otra vez
      continue;
    }
    if (valida) disembark(state, t.id, op.target);
  }
  if (barcos.every((t) => !t.cargo?.length)) enTierra(state, iso, op);
}

// Tropa ya en la playa. La operación pasa a vigilarla en vez de cerrarse, salvo
// que no quede nadie —no hay cabeza que reforzar— o que esa fuera la última
// oleada permitida.
function enTierra(state, iso, op) {
  const vivos = op.troops
    .map((id) => state.units.find((u) => u.id === id && !u.dead))
    .filter((u) => u && !u.embarked);
  if (!vivos.length || (op.wave || 1) >= C.AI_LANDING_WAVES) {
    terminar(state, iso);
    return;
  }
  op.phase = "cabeza";
  op.landed = vivos.map((u) => u.id);
  op.troops = []; // dejan de estar reservados: pelean como cualquier tropa (aiMilitary)
  op.beachAt = state.time;
}

// Vigilancia de la cabeza de playa. Mientras aguante sola no se hace nada: la
// segunda oleada sale cuando la aprietan de verdad, con la misma cuenta de
// fuerzas que decide cualquier asalto (P.attackRatio).
function cabeza(state, iso, op, vis, P, battles) {
  const vivos = op.landed
    .map((id) => state.units.find((u) => u.id === id && !u.dead))
    .filter((u) => u && !u.embarked);
  op.landed = vivos.map((u) => u.id);
  if (!vivos.length) { // barrida del mapa: ya no hay nada que reforzar
    terminar(state, iso);
    return;
  }
  const mio = vivos.reduce((s, u) => s + potencia(u), 0);
  if (amenaza(state, iso, op, vis, vivos) <= mio * P.attackRatio) return; // aguanta sola

  const refuerzo = fuerzaDisponible(state, iso, battles, op.port).slice(0, C.AI_LANDING_MAX);
  if (refuerzo.length < C.AI_LANDING_MIN) return; // hoy no hay tropa suelta: se mira luego
  const libresT = op.transports
    .map((id) => state.units.find((u) => u.id === id && !u.dead))
    .filter((u) => u && !u.cargo?.length).length;
  if (!puedeTransportes(state, iso, Math.ceil(refuerzo.length / 3) - libresT)) return;

  op.wave = (op.wave || 1) + 1;
  op.phase = "reunir";
  op.started = state.time; // la oleada nueva estrena plazos
  op.troops = refuerzo.map((u) => u.id);
  delete op.landed;
  log(state, `${S.countries[iso].name} manda una segunda oleada a ${S.provinces.get(op.target)?.name}`, "war");
}

// Lo que amenaza a la cabeza: fuerza enemiga en la playa, donde esté la tropa
// desembarcada, y en todo lo que tengan pegado. Con la misma regla de niebla que
// al planear: lo que no ve, lo supone.
function amenaza(state, iso, op, vis, vivos) {
  const zona = new Set([op.target, ...vivos.map((u) => u.pos)]);
  for (const pid of [...zona]) {
    for (const e of S.edges.get(pid) || []) if (!S.provinces.get(e.to)?.isSea) zona.add(e.to);
  }
  let total = 0;
  for (const pid of zona) {
    const ctrl = controller(state.provinces[pid]);
    if (!ctrl || !atWar(state, iso, ctrl)) continue;
    if (!vis.strong.has(pid)) { total += DEFENSA_SUPUESTA(); continue; }
    total += state.units
      .filter((u) => u.pos === pid && !u.dead && !u.embarked && atWar(state, iso, u.owner))
      .reduce((s, u) => s + potencia(u), 0);
  }
  return total;
}

// Vuelta a casa: a la costa PROPIA más cercana, no necesariamente al puerto de
// salida (desembarcar en casa no exige puerto). Si ya hay una pegada, ahí mismo.
function regresar(state, iso, op, barcos) {
  for (const t of barcos) {
    if (!t.cargo?.length || !libre(t)) continue;
    const pegada = (S.edges.get(t.pos) || [])
      .map((e) => e.to)
      .find((pid) => controller(state.provinces[pid]) === iso);
    if (pegada) {
      disembark(state, t.id, pegada);
      continue;
    }
    if (!t.home) t.home = costaPropiaCercana(state, iso, t.pos) || op.portCell;
    if (!orderMove(state, t, t.home)) t.home = op.portCell;
  }
  if (barcos.every((t) => !t.cargo?.length)) {
    for (const t of barcos) delete t.home;
    terminar(state, iso);
  }
}

function costaPropiaCercana(state, iso, cell) {
  let mejor = null;
  let km = Infinity;
  for (const p of coastalProvinces(state, iso)) {
    const d = dist(cell, p.id);
    if (d < km) { km = d; mejor = seaCellOf(p.id); }
  }
  return mejor;
}

function abortar(state, iso, op, barcos) {
  if (barcos.some((t) => t.cargo?.length)) {
    op.phase = "regresar";
    regresar(state, iso, op, barcos);
    return;
  }
  terminar(state, iso);
}

function terminar(state, iso) {
  const c = state.countries[iso];
  c.aiLanding = null;
  c.aiLandingNext = state.time + C.AI_LANDING_COOLDOWN_DAYS * 1440;
}

function dist(a, b) {
  const p = S.provinces.get(a);
  const q = S.provinces.get(b);
  return p && q ? distKm([p.cx, p.cy], [q.cx, q.cy]) : Infinity;
}

// Países costeros que un almirante puede atacar por mar: su costa está al
// alcance de su puerto. Solo con puerto: sin él no hay forma de llegar.
export function seaNeighbors(state, iso) {
  const puertos = landingPorts(state, iso);
  if (!puertos.length) return [];
  const out = new Set();
  for (const p of S.provinceList) {
    if (p.isSea) continue;
    const ctrl = controller(state.provinces[p.id]);
    if (!ctrl || ctrl === iso || out.has(ctrl) || !seaCellOf(p.id)) continue;
    if (puertos.some((q) => distKm([q.cx, q.cy], [p.cx, p.cy]) <= C.AI_NAVAL_RANGE_KM)) out.add(ctrl);
  }
  return [...out];
}

