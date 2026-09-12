// Formaciones: unir varias unidades en una sola ficha que se manda de golpe.
//
// La idea, y lo que la separa de la pila implícita que ya había (mismo tipo,
// misma casilla, agrupadas solo para dibujar): una formación es HETEROGÉNEA,
// PERSISTENTE y se nombra sola según lo que lleva dentro. Un tanque con dos
// secciones de infantería es un "Pelotón Acorazado" y viaja como uno.
//
// ---------------------------------------------------------------------------
// Tres decisiones de diseño que conviene no deshacer sin pensarlo
// ---------------------------------------------------------------------------
//
// 1. Una formación NO suma ataque ni defensa. Es un envoltorio de MANDO: las
//    unidades siguen combatiendo una a una exactamente igual que sueltas, y lo
//    único que cambia es que reciben las órdenes juntas y se dibujan juntas. Si
//    unir multiplicase el daño, juntar diez tanques sería la única jugada del
//    juego y el resto del diseño sobraría.
//
// 2. La formación va a la velocidad del MÁS LENTO. Ese es el precio real de
//    mezclar: un carro a 50 km/h con infantería a 12 km/h avanza a 12. Sin este
//    coste mezclar saldría gratis y todo el mundo jugaría con una sola bola.
//    (Lo aplica edgeMinutes a través de formationSpeedType.)
//
// 3. Tope de MAX_MEMBERS. Sin un techo aparece el clásico apilamiento infinito:
//    una única ficha con cuarenta unidades que decide la partida entera.
//
// Y una consecuencia bonita de los datos que ya existían: solo la infantería y
// la motorizada tienen `captures`. Una formación puede tomar provincia solo si
// lleva al menos una de las dos, así que un regimiento acorazado puro arrasa
// pero no ocupa. Es un motivo mecánico para mezclar armas sin inventar bonos.

import { S, unitDef, isNaval } from "./state.js";

export const MAX_MEMBERS = 16;

// --- Dominios -------------------------------------------------------------
// Tierra, aire y mar no se mezclan jamás. No es una regla de equilibrio, es que
// una formación es una columna que se mueve junta, y un caza no acompaña a una
// sección de infantería por carretera.
export function domainOf(type) {
  if (isNaval(type)) return "naval";
  return unitDef(type)?.air ? "aire" : "tierra";
}

const DOMAIN_NAME = { tierra: "terrestre", aire: "aérea", naval: "naval" };

// --- Escalones por número de unidades -------------------------------------
// Cada dominio usa su propia escala porque los nombres reales no se comparten:
// nadie llama "regimiento" a un grupo de barcos.
// `g` es el género del sustantivo: hace falta para que el apellido concuerde
// ("Compañía Mecanizada", no "Compañía Mecanizado").
const ECHELONS = {
  tierra: [
    { min: 2, name: "Pelotón", g: "m" },
    { min: 4, name: "Compañía", g: "f" },
    { min: 7, name: "Batallón", g: "m" },
    { min: 11, name: "Regimiento", g: "m" },
    { min: 16, name: "Brigada", g: "f" },
  ],
  aire: [
    { min: 2, name: "Patrulla", g: "f" },
    { min: 4, name: "Escuadrón", g: "m" },
    { min: 7, name: "Grupo Aéreo", g: "m" },
    { min: 11, name: "Ala", g: "f" },
  ],
  naval: [
    { min: 2, name: "División Naval", g: "f" },
    { min: 4, name: "Flotilla", g: "f" },
    { min: 7, name: "Escuadra", g: "f" },
    { min: 11, name: "Grupo de Batalla", g: "m" },
  ],
};

// --- Apellido por composición ---------------------------------------------
// Lo pone la categoría DOMINANTE, entendiendo por tal la que pasa del 50 % de la
// formación. Si ninguna llega, no hay arma principal: es un grupo de armas
// combinadas y se llama así, que es justo el caso de artillería con infantería a
// partes iguales —ni "de Infantería" ni "de Artillería" lo describirían bien—.
// [masculino, femenino]. Los que empiezan por "de " son invariables y se repiten.
const SUFFIX = {
  mbt: ["Acorazado", "Acorazada"],
  motorizada: ["Mecanizado", "Mecanizada"],
  infanteria: ["de Infantería", "de Infantería"],
  artilleria: ["de Artillería", "de Artillería"],
  cazatanques: ["Anticarro", "Anticarro"],
  antiaereo: ["Antiaéreo", "Antiaérea"],
  caza: ["de Caza", "de Caza"],
  bombardero: ["de Bombardeo", "de Bombardeo"],
  helicoptero: ["de Helicópteros", "de Helicópteros"],
  drone: ["de Reconocimiento", "de Reconocimiento"],
  corbeta: ["de Patrulla", "de Patrulla"],
  fragata: ["de Escolta", "de Escolta"],
  destructor: ["de Escolta", "de Escolta"],
  submarino: ["Submarino", "Submarina"],
  transporte: ["Anfibio", "Anfibia"],
};

function suffixOf(cat, g) {
  const s = SUFFIX[cat];
  return s ? (g === "f" ? s[1] : s[0]) : null;
}

// Cuánto tiene que pesar un arma para dar nombre a la formación. Dos tercios, no
// la mitad: con la mitad, un carro con dos secciones de infantería salía
// "Pelotón de Infantería" y el carro —que es la unidad que de verdad define a ese
// grupo, y la que enseña el mapa— desaparecía del nombre. Por encima de dos
// tercios ya es honesto decir que el grupo ES de esa arma; por debajo, son armas
// combinadas y se llaman así.
const DOMINANCE = 2 / 3;

// Quién manda en el dibujo y en el nombre mixto. Por PRIORIDAD, no por cantidad:
// una compañía de ocho fusileros con un carro enseña el carro, porque es lo que
// define a esa unidad sobre el mapa. Número más bajo = manda más.
const LEAD_PRIORITY = {
  portaviones: 0, destructor: 1, submarino: 2, fragata: 3, transporte: 4, corbeta: 5,
  bombardero: 0, caza: 1, helicoptero: 2, drone: 3,
  mbt: 0, artilleria: 1, cazatanques: 2, motorizada: 3, antiaereo: 4, infanteria: 5,
};

function catRank(cat) {
  return LEAD_PRIORITY[cat] ?? 99;
}
// Exportada porque el mapa también la necesita: al dibujar una formación tiene
// que decidir de quién es el sprite sin rehacer la cuenta.
export function leadRank(type) {
  return catRank(unitDef(type)?.category);
}

// --- Consultas ------------------------------------------------------------

export function formationMembers(state, fid) {
  if (!fid) return [];
  return state.units.filter((u) => !u.dead && u.formation === fid);
}

// Unidad que da la cara: sprite en el mapa y nombre propio en el panel.
export function formationLead(state, fid) {
  const m = formationMembers(state, fid);
  if (!m.length) return null;
  return m.reduce((a, b) => (leadRank(b.type) < leadRank(a.type) ? b : a));
}

// Tipo cuya velocidad manda: la del miembro MÁS LENTO (decisión 2 de arriba).
export function formationSpeedType(state, fid) {
  const m = formationMembers(state, fid);
  if (!m.length) return null;
  return m.reduce((a, b) => ((unitDef(b.type)?.speed ?? 99) < (unitDef(a.type)?.speed ?? 99) ? b : a)).type;
}

export function formationCaptures(state, fid) {
  return formationMembers(state, fid).some((u) => unitDef(u.type)?.captures);
}

// Nombre completo, calculado cada vez en vez de guardado: así al desacoplar una
// unidad el nombre se corrige solo y nunca miente sobre lo que queda dentro.
export function formationName(state, fid) {
  const m = formationMembers(state, fid);
  if (m.length < 2) return null;
  const dom = domainOf(m[0].type);

  let esc = ECHELONS[dom][0];
  for (const e of ECHELONS[dom]) if (m.length >= e.min) esc = e;
  const escalon = esc.name;

  // Reglas navales que pisan al conteo: en el mar manda el buque mayor, no
  // cuántos son. Dos barcos con un portaviones son un grupo de batalla; ocho
  // corbetas, no.
  if (dom === "naval") {
    if (m.some((u) => unitDef(u.type)?.category === "portaviones")) return "Grupo de Batalla";
    if (m.every((u) => unitDef(u.type)?.category === "submarino")) return "Manada de Submarinos";
    if (m.some((u) => unitDef(u.type)?.category === "transporte")) {
      return `${escalon} ${suffixOf("transporte", esc.g)}`;
    }
  }

  const cuenta = new Map();
  for (const u of m) {
    const c = unitDef(u.type)?.category;
    cuenta.set(c, (cuenta.get(c) || 0) + 1);
  }
  let dom1 = null;
  for (const [c, n] of cuenta) if (n / m.length > DOMINANCE) dom1 = c;

  if (dom1) return `${escalon} ${suffixOf(dom1, esc.g) || DOMAIN_NAME[dom]}`;

  // Armas combinadas. El apellido lo pone el arma de MAYOR rango presente, no la
  // más numerosa: es la que define el carácter del grupo y la que el mapa enseña.
  // Un grupo táctico con carros es acorazado aunque los carros sean minoría.
  const mayor = [...cuenta.keys()].sort((a, b) => catRank(a) - catRank(b))[0];
  // "Grupo Táctico" (tierra) y "Paquete Aéreo" son los términos reales para una
  // agrupación de armas combinadas; en el mar, "Agrupación Naval".
  const base = dom === "naval"
    ? { name: "Agrupación Naval", g: "f" }
    : dom === "aire"
      ? { name: "Paquete Aéreo", g: "m" }
      : { name: "Grupo Táctico", g: "m" };
  const ap = suffixOf(mayor, base.g);
  // Los apellidos invariables ("de Infantería") no pegan detrás de un nombre que
  // ya dice que es mixto: "Grupo Táctico de Infantería" se contradice.
  return !ap || ap.startsWith("de ") ? base.name : `${base.name} ${ap}`;
}

// --- Comprobaciones -------------------------------------------------------

// Por qué NO se pueden unir estas unidades, o null si sí. Devuelve el motivo en
// texto para que la interfaz pueda decirlo en vez de desactivar un botón sin
// explicación, que es lo que más frustra.
export function mergeBlocker(state, ids) {
  const us = ids.map((id) => state.units.find((x) => x.id === id && !x.dead)).filter(Boolean);
  if (us.length < 2) return "Hacen falta al menos dos unidades";
  const a = us[0];
  if (us.some((u) => u.owner !== a.owner)) return "No son todas del mismo país";
  if (us.some((u) => u.pos !== a.pos)) return "Tienen que estar en la misma provincia";
  if (us.some((u) => u.embarked)) return "Una unidad embarcada no puede formar";
  if (us.some((u) => u.edgeLeft || u.path?.length)) return "Tienen que estar quietas";

  const dom = domainOf(a.type);
  if (us.some((u) => domainOf(u.type) !== dom)) {
    return "No se pueden mezclar unidades de tierra, aire y mar en la misma formación";
  }

  // Los miembros que YA estaban formados cuentan para el tope.
  const total = new Set();
  for (const u of us) {
    if (u.formation) for (const m of formationMembers(state, u.formation)) total.add(m.id);
    else total.add(u.id);
  }
  if (total.size > MAX_MEMBERS) return `Una formación no puede pasar de ${MAX_MEMBERS} unidades`;
  return null;
}

// --- Órdenes --------------------------------------------------------------

function nextId(state) {
  state.formationSeq = (state.formationSeq || 0) + 1;
  return `f${state.formationSeq}`;
}

// Une las unidades (y las formaciones a las que ya pertenezcan) en una sola.
// Devuelve el id de formación, o null si la comprobación lo impide.
export function mergeUnits(state, ids) {
  if (mergeBlocker(state, ids)) return null;
  const us = ids.map((id) => state.units.find((x) => x.id === id && !x.dead)).filter(Boolean);

  // Se reaprovecha la formación existente más grande en vez de crear una nueva:
  // así unir un refuerzo a un regimiento no lo renumera ni lo "refunda".
  const previas = [...new Set(us.map((u) => u.formation).filter(Boolean))];
  let fid = null;
  let mayor = 0;
  for (const f of previas) {
    const n = formationMembers(state, f).length;
    if (n > mayor) { mayor = n; fid = f; }
  }
  if (!fid) fid = nextId(state);

  for (const u of us) {
    if (u.formation && u.formation !== fid) {
      for (const m of formationMembers(state, u.formation)) m.formation = fid;
    }
    u.formation = fid;
  }
  return fid;
}

// Saca UNA unidad de su formación. Si al hacerlo queda un solo miembro, la
// formación se deshace: una formación de uno no es una formación, es una unidad
// con un nombre raro.
export function detachUnit(state, unitId) {
  const u = state.units.find((x) => x.id === unitId && !x.dead);
  if (!u?.formation) return false;
  const fid = u.formation;
  u.formation = null;
  u.path = [];
  u.edgeLeft = null;
  const quedan = formationMembers(state, fid);
  if (quedan.length < 2) for (const m of quedan) m.formation = null;
  return true;
}

export function dissolveFormation(state, fid) {
  const m = formationMembers(state, fid);
  if (!m.length) return false;
  for (const u of m) u.formation = null;
  return true;
}

// Limpieza de bajas: una formación cuyos miembros han caído hasta quedar uno se
// deshace sola. Lo llama el motor después de resolver el combate, para que el
// mapa no enseñe un "Batallón" que ya es un camión solo.
export function pruneFormations(state) {
  const cuenta = new Map();
  for (const u of state.units) {
    if (u.dead || !u.formation) continue;
    cuenta.set(u.formation, (cuenta.get(u.formation) || 0) + 1);
  }
  for (const u of state.units) {
    if (u.formation && (cuenta.get(u.formation) || 0) < 2) u.formation = null;
  }
}

// Resumen para el panel: totales de la formación entera y desglose por unidad.
export function formationSummary(state, fid) {
  const m = formationMembers(state, fid);
  if (m.length < 2) return null;
  const lead = formationLead(state, fid);
  const lento = formationSpeedType(state, fid);
  return {
    id: fid,
    name: formationName(state, fid),
    dominio: domainOf(m[0].type),
    n: m.length,
    lead,
    hp: m.reduce((s, u) => s + u.hp, 0),
    hpMax: m.length * 100,
    speed: unitDef(lento)?.speed ?? 0,
    speedType: lento,
    captures: formationCaptures(state, fid),
    // Alcance de tiro del grupo: el de la pieza que más lejos bate. Dentro de
    // una formación cada unidad dispara por su cuenta, así que esto no es una
    // suma, es "hasta aquí llega alguien de los míos sin moverse".
    rangoKm: m.reduce((r, u) => Math.max(r, unitDef(u.type)?.rangoKm || 0), 0),
    members: m,
  };
}
