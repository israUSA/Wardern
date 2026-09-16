// Personalidades de los bots (docs/IA.md).
//
// Cada país bot recibe UNA al empezar la partida, AL AZAR (el Almirante, solo
// si el país tiene costa): Venezuela puede salir
// conquistadora en una partida y tortuga en la siguiente. Se guarda en
// state.countries[iso].personality, así que viaja con el guardado y no cambia a
// mitad de partida.
//
// Cada perfil es un juego de pesos que ai.js lee en lugar de sus valores fijos.
// Los de `equilibrado` son los valores que usaba la IA antes de que hubiera
// personalidades: ese perfil es la IA de siempre. La única excepción es la
// agresión, que antes era un número fijo por país en countries-data.js (y ya no
// se lee: lo que decide ahora es el carácter sorteado, no la bandera).
//
//  aggression   ganas de declarar guerra (x dificultad x 0,12 por chequeo)
//  warRatio     cuánto más fuerte tiene que creerse para declararla
//  preyOnWar    multiplicador del ratio contra un vecino que YA está en guerra
//               con otro (el oportunista se lanza sobre el que está ocupado)
//  attackRatio  superioridad local que exige para asaltar una provincia
//  armyPeace    tamaño del ejército objetivo en paz (x provincias x 2)
//  armyWar      ídem en guerra
//  industry     nivel de industria al que lleva cada provincia
//  fortWar      nivel de fortaleza en provincias con frente abierto
//  fortPeace    nivel de fortaleza en provincias con frontera extranjera, en paz
//               (todos los bots ponen ya nivel 1 en casi todo: por debajo de 2
//               no se nota)
//  research     colchón de dinero que exige para investigar (x coste)
//  counter      probabilidad de reaccionar a la obra enemiga vista
//  peacePower   pide la paz si su ejército cae por debajo de este x el enemigo
//  peaceLand    ... o si conserva menos de esta parte de su territorio inicial
//  longWarDays  días a partir de los cuales una guerra le cansa
//  mix          multiplicadores sobre el reparto de tropas por categoría
//  navy         parte de los reclutamientos que van a barcos (0 = ninguno).
//               Solo cuenta si el país tiene costa: sin puerto no hay barcos.
//  portLevel    nivel de puerto al que aspira (limitado por su tier)
//  navyMix      multiplicadores sobre el reparto de barcos por clase
//  coastalOnly  el carácter solo se sortea entre países con salida al mar
export const PERSONALITIES = {
  equilibrado: {
    name: "Equilibrado", icon: "⚖",
    desc: "Sin manías: construye, se arma y combate con sensatez.",
    weight: 0.28,
    aggression: 0.45, warRatio: 1.4, preyOnWar: 1, attackRatio: 1.25,
    armyPeace: 1, armyWar: 1, industry: 1, fortWar: 2, fortPeace: 0,
    research: 1.3, counter: 0.5,
    peacePower: 0.5, peaceLand: 0.6, longWarDays: 7,
    navy: 0.1, portLevel: 1,
    navyMix: {},
    mix: {},
  },
  conquistador: {
    name: "Conquistador", icon: "⚔",
    desc: "Ejército grande y acorazado. Declara guerras pronto y no firma la paz fácilmente.",
    weight: 0.18,
    aggression: 0.8, warRatio: 1.15, preyOnWar: 1, attackRatio: 1.05,
    armyPeace: 1.4, armyWar: 1.5, industry: 1, fortWar: 1, fortPeace: 0,
    research: 1.7, counter: 0.35,
    peacePower: 0.3, peaceLand: 0.4, longWarDays: 14,
    navy: 0.06, portLevel: 1,
    navyMix: { destructor: 1.3, corbeta: 0.7 },
    mix: { mbt: 1.6, motorizada: 1.3, artilleria: 1.2, bombardero: 1.2, antiaereo: 0.6, infanteria: 0.8 },
  },
  tortuga: {
    name: "Tortuga", icon: "🛡",
    desc: "Fortifica sus fronteras incluso en paz. Casi nunca empieza una guerra y busca la paz enseguida.",
    weight: 0.18,
    aggression: 0.12, warRatio: 2.2, preyOnWar: 1, attackRatio: 1.7,
    armyPeace: 1.15, armyWar: 1.2, industry: 1, fortWar: 3, fortPeace: 2,
    research: 1.3, counter: 0.75,
    peacePower: 0.7, peaceLand: 0.8, longWarDays: 5,
    navy: 0.08, portLevel: 1,
    navyMix: { corbeta: 1.5, submarino: 1.3, portaviones: 0.3 },
    mix: { antiaereo: 2, artilleria: 1.6, infanteria: 1.25, cazatanques: 1.2, mbt: 0.6, bombardero: 0.4, motorizada: 0.7 },
  },
  industrial: {
    name: "Industrial", icon: "🏭",
    desc: "Economía y tecnología primero: ejército corto en paz, pero moderno y con mucha aviación cuando llega la guerra.",
    weight: 0.18,
    aggression: 0.3, warRatio: 1.6, preyOnWar: 1, attackRatio: 1.3,
    armyPeace: 0.75, armyWar: 1.35, industry: 3, fortWar: 2, fortPeace: 0,
    research: 0.9, counter: 0.5,
    peacePower: 0.5, peaceLand: 0.6, longWarDays: 9,
    navy: 0.12, portLevel: 2,
    navyMix: { portaviones: 1.8, destructor: 1.2 },
    mix: { caza: 1.6, bombardero: 1.5, drone: 1.6, helicoptero: 1.3, mbt: 1.15, infanteria: 0.7 },
  },
  oportunista: {
    name: "Oportunista", icon: "🦊",
    desc: "Espera a que el vecino esté ocupado en otra guerra para caerle encima. Rápido y móvil; si la cosa se tuerce, firma.",
    weight: 0.18,
    aggression: 0.55, warRatio: 1.5, preyOnWar: 1.7, attackRatio: 1.2,
    armyPeace: 1, armyWar: 1.1, industry: 1, fortWar: 1, fortPeace: 0,
    research: 1.3, counter: 0.5,
    peacePower: 0.65, peaceLand: 0.75, longWarDays: 5,
    navy: 0.08, portLevel: 1,
    navyMix: { corbeta: 1.4, submarino: 1.2 },
    mix: { motorizada: 1.6, helicoptero: 1.6, cazatanques: 1.3, drone: 1.3, artilleria: 0.7, antiaereo: 0.7 },
  },
  almirante: {
    name: "Almirante", icon: "⚓",
    desc: "Potencia marítima: puerto grande, flota de destructores y submarinos, y la guerra la busca en el mar.",
    weight: 0.18, coastalOnly: true,
    aggression: 0.45, warRatio: 1.35, preyOnWar: 1, attackRatio: 1.2,
    armyPeace: 0.9, armyWar: 1.1, industry: 2, fortWar: 1, fortPeace: 0,
    research: 1.1, counter: 0.5,
    peacePower: 0.5, peaceLand: 0.6, longWarDays: 9,
    navy: 0.4, portLevel: 3,
    navyMix: { destructor: 1.6, submarino: 1.5, portaviones: 3, corbeta: 0.6 },
    mix: { antiaereo: 1.2, caza: 1.3, infanteria: 0.9 },
  },
};

export const DEFAULT_PERSONALITY = "equilibrado";

// Sorteo ponderado. `coastal` dice si el país tiene salida al mar: sin ella,
// los caracteres marítimos no entran en el bombo. `rand` se inyecta para poder
// probarlo con una semilla.
export function rollPersonality(coastal = true, rand = Math.random) {
  const ids = Object.keys(PERSONALITIES).filter((id) => coastal || !PERSONALITIES[id].coastalOnly);
  const total = ids.reduce((s, id) => s + PERSONALITIES[id].weight, 0);
  let r = rand() * total;
  for (const id of ids) {
    r -= PERSONALITIES[id].weight;
    if (r <= 0) return id;
  }
  return DEFAULT_PERSONALITY;
}
