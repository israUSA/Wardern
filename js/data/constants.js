// Constantes de simulación de Wardern.
// Todas las magnitudes de tiempo están en MINUTOS DE JUEGO salvo que se indique.

export const TICK_MS = 250;               // duración real de un tick
// Minutos de juego por tick a 1×. ESTE es el mando del ritmo de todo el juego:
//
//   minutos de juego por minuto real = (60000 / TICK_MS) × MINUTES_PER_TICK_BASE
//   con 0.4:  (60000/250) × 0.4 = 96   →  1 día de juego = 15 minutos reales
//
// Historia del valor: con 6 un día de juego pasaba en UN MINUTO real y ninguna
// decisión de construcción pesaba. Se bajó a 0.1, que dejaba el día de juego en
// una hora real entera: demasiado lento para una sesión corta. 0.4 es el punto
// medio, cuatro días de juego por hora real.
//
// A este ritmo (contando ya BUILD_TIME_MULT, que parte por la mitad las obras):
//   industria militar  36 h de juego → 22,5 min reales
//   base aérea         48 h de juego → 30 min reales
//   patrulla aérea      8 h de juego →  5 min reales
//
// No hay que retocar ninguna duración — están todas en días/horas de JUEGO y se
// estiran solas. Los botones 2× y 4× multiplican esto: a 4×, el día de juego
// baja a 3 min 45 s reales.
//
// Requisito para que esto funcione (ver js/main.js): el mundo tiene que avanzar
// también con la pestaña CERRADA, o no se terminaría nunca una construcción. De
// eso se encarga la recuperación offline al cargar.
export const MINUTES_PER_TICK_BASE = 0.4;

// Minutos de juego por tick con los que está CALIBRADO el combate. El daño se
// escala por dt/este valor, así que cambiar el reloj de arriba no altera lo que
// dura una batalla en tiempo de JUEGO. Antes el daño iba por tick a secas y el
// combate era el único sistema que ignoraba el reloj (ver js/engine/combat.js).
export const COMBAT_REF_MINUTES = 6;
export const SPEEDS = [0, 1, 2, 4];

// ---- Simulación en segundo plano ----
// El navegador PARA requestAnimationFrame en pestañas ocultas, así que el motor
// no puede colgar de los frames: avanza por reloj de pared (ver pump() en
// js/main.js). Como tick() es determinista y no lee el reloj real, recuperar N
// ticks de golpe deja el estado EXACTAMENTE igual que haberlos ejecutado uno a uno.
export const SIM_INTERVAL_MS = 250;          // temporizador de respaldo (sigue vivo sin frames)
export const MAX_CATCHUP_MS = 30 * 60 * 1000; // retraso real recuperable: 30 min
export const CATCHUP_BUDGET_MS = 12;          // ms de simulación por llamada con la pestaña visible
// Oculta no hay frames que proteger, pero SÍ hay que cubrir el tiempo transcurrido:
// el navegador estrangula el temporizador a 1 disparo/s en segundo plano y hasta
// 1 disparo/min tras unos minutos, así que ese disparo tiene que poder simular el
// minuto entero (~240 ticks) o el motor se quedaría atrás para siempre.
// 5 s (no 3): a final de partida un tick cuesta ~16 ms con 400+ unidades y varias
// guerras abiertas, así que cubrir el minuto entero de un disparo estrangulado
// exige 240 × 16 ≈ 3,9 s. Con 3 s el motor se iba quedando atrás en esas partidas.
export const CATCHUP_BUDGET_HIDDEN_MAX_MS = 5000;

export const START_DATE_MS = Date.UTC(2026, 0, 1);

// Efectos de impacto (explosiones). Duran en MINUTOS DE JUEGO para que el
// reloj los gobierne igual que a todo lo demás: 1 minuto de juego son ~2,5 s
// reales a 1×, y a 4× duran menos, que es lo coherente.
export const FX_MINUTES = 1;

// ---- Progresión offline ----
// El mundo avanza aunque la pestaña esté cerrada: al cargar se mira el reloj de
// pared y se adelanta la simulación. Sin esto, con el reloj lento no terminaría
// jamás una construcción de 3 horas, porque nadie deja el navegador abierto.
// Se avanza a PASOS GRANDES (no tick a tick): una noche entera son ~500 pasos en
// vez de 300.000 ticks. El combate resuelto a saltos de 30 min es más tosco que
// en vivo, pero es la diferencia entre que funcione y que bloquee la pestaña.
export const OFFLINE_STEP_MINUTES = 30;
// Tope de lo que se recupera: 14 días de juego = 14 horas reales fuera. Más allá
// el mundo "espera" — mejor que volver de un fin de semana y encontrar la
// partida decidida sin ti.
export const OFFLINE_MAX_GAME_MINUTES = 14 * 24 * 60;
// Por debajo de esto no se avisa: cerrar y abrir el juego no merece un modal.
export const OFFLINE_MIN_GAME_MINUTES = 30;

// Economía
export const OCCUPY_SHARE = 0.25;         // producción que recibe el ocupante
export const INDUSTRY_SUPPLIES = 3;       // +suministros/h por industria militar
export const RECRUIT_MANPOWER = 2;        // +mano de obra/h por oficina

// Mantenimiento por unidad: fracción DIARIA del coste (se divide por 24 para la hora)
export const UPKEEP_MONEY_AS_SUPPLIES = 0.006; // coste en $ → suministros por día
export const UPKEEP_FUEL_FACTOR = 0.02;        // coste en combustible → combustible por día

// Desgaste sin suministros
export const ATTRITION_EVERY_H = 6;
export const ATTRITION_HP = 1;      // % HP
export const ATTRITION_MORALE = 2;  // % moral

// Edificios: coste y duración. costGrowth multiplica el coste por nivel.
export const BUILDINGS = {
  industria: {
    name: "Industria militar",
    desc: "+3 suministros/h por nivel",
    max: 5,
    cost: { money: 20000, supplies: 5000, manpower: 0, fuel: 0 },
    costGrowth: 1.6,
    minutes: 3 * 24 * 60,
  },
  reclutamiento: {
    name: "Oficina de reclutamiento",
    desc: "+2 mano de obra/h por nivel",
    max: 5,
    cost: { money: 15000, supplies: 0, manpower: 0, fuel: 0 },
    costGrowth: 1.6,
    minutes: 2 * 24 * 60,
  },
  aerobase: {
    name: "Base aérea",
    desc: "Nivel 1: aviones T1 · nivel 2: T2 · nivel 3: T3",
    max: 3,
    cost: { money: 25000, supplies: 3000, manpower: 0, fuel: 0 },
    costGrowth: 2.0,
    minutes: 4 * 24 * 60,
  },
  puerto: {
    name: "Puerto",
    desc: "Nivel 1: barcos T1 · nivel 2: T2 · nivel 3: T3 · permite embarcar tropas",
    max: 3,
    cost: { money: 30000, supplies: 2000, manpower: 0, fuel: 0 },
    costGrowth: 2.0,
    minutes: 5 * 24 * 60,
  },
  fortaleza: {
    name: "Fortaleza",
    desc: "+20% defensa por nivel",
    max: 5,
    cost: { money: 10000, supplies: 0, manpower: 0, fuel: 0 },
    costGrowth: 1.6,
    minutes: 2 * 24 * 60,
  },
};

// Multiplicador GLOBAL de lo que TARDAN edificios y unidades. Igual que
// MOVE_SPEED_MULT con el movimiento: una sola cifra mueve las 96 fichas y los 5
// edificios a la vez, sin tocar sus duraciones ni cambiar las proporciones entre
// ellos (un tanque sigue costando el triple que una infantería).
// 0,5 = la mitad de espera.
export const BUILD_TIME_MULT = 0.5;

// Gradas de reclutamiento por provincia. La OBRA (edificios y anexión) va por su
// cuenta en ps.queue: construir un cuartel no debería impedir reclutar en él, que
// son dos cosas distintas y antes compartían la única ranura que había.
export const RECRUIT_SLOTS = 2;

// Anexión
export const ANNEX_DAYS = 5 * 24 * 60;
export const ANNEX_COST = (pop) => Math.round(pop / 2000) + 2000;

// Combate
export const COMBAT_SCALE = 0.08;          // daño base por tick
export const DEF_SOFTENER = 20;            // dmg ×= DEF_SOFTENER/(DEF_SOFTENER+defTotal)
export const FORT_DEF_PER_LEVEL = 0.2;     // +20% defensa por nivel de fortaleza
export const OVERSTACK_FREE = 8;
export const OVERSTACK_PENALTY = 0.08;     // −8% potencia por unidad extra
// ---- Tiro a distancia de la artillería (js/engine/artillery.js) ----
// El alcance vive en la variante (units-data.js): cada obús tiene el suyo. Aquí
// solo el ritmo y el castigo, por tier de la pieza.
export const ARTY_COOLDOWN_MIN = 45;                 // minutos de juego entre salvas
export const ARTY_DAMAGE = { 1: 9, 2: 13, 3: 18 };   // HP al blanco por salva
export const ARTY_SPLASH = 0.35;                     // parte del daño al resto de la celda
export const ARTY_COST = { 1: 320, 2: 480, 3: 700 }; // supplies por salva
export const ARTY_SHELL_KMH = 3000;                  // velocidad del proyectil en vuelo

export const ARTILLERY_PREP_TICKS = 12;
export const ARTILLERY_PREP_MULT = 1.5;
export const MORALE_HIT = 0.0012;          // por punto de daño recibido
export const MORALE_REGEN_PER_H = 0.004;   // fuera de combate, territorio propio/ocupado
export const RETREAT_HP = 30;              // % HP
export const RETREAT_MORALE = 0.2;
export const RETREAT_SPEED_MULT = 2;       // huir es más rápido

// Veteranía
export const VET_EXP_PER_DAMAGE = 0.02;    // exp por punto de daño infligido
export const VET_EXP_MAX = 100;
export const VET_LEVELS = [34, 67, 100];   // umbrales de exp para nivel 1/2/3
export const VET_BONUS_PER_LEVEL = 0.08;   // +8% ataque y defensa por nivel

// Movimiento
export const STRAIT_COST_MULT = 2;
// Multiplicador GLOBAL de la velocidad de todas las unidades. Se aplica en
// edgeMinutes, así que una sola cifra frena (o acelera) a las 96 variantes a la
// vez y las proporciones entre ellas quedan intactas: un tanque sigue siendo
// exactamente el doble de rápido que la infantería. Tocar los `speed` uno a uno
// habría sido 96 ediciones y un balance distinto.
// 1,5 = todas un 50 % más rápidas que su `speed` de ficha (el doble de rápidas
// que con el 0,75 anterior). Cruzar el continente seguía costando horas reales
// con el reloj nuevo, y esperar por una columna no es la parte divertida.
export const MOVE_SPEED_MULT = 1.5;

// Patrulla aérea (docs/AIR-COMBAT.md): tiempo que un avión aguanta dando vueltas
// sobre el punto elegido antes de volver solo a base. 8 h de juego: a 1× con el
// reloj actual (96 min de juego por minuto real, ver MINUTES_PER_TICK_BASE) son
// 5 min reales de margen para reaccionar antes de que se retire por su cuenta.
export const AIR_PATROL_MINUTES = 8 * 60;

// Radio de acción aéreo, en km, medido en línea recta desde la base de la que
// sale el aparato (aeródromo propio con pista, o portaviones propio para la
// aviación embarcada). Es lo que sustituye a la vieja regla de "el espacio aéreo
// neutral está cerrado": un avión ya puede sobrevolar a quien le dé la gana —eso
// es lo que hace la aviación de verdad— pero no puede plantarse en la otra punta
// del continente porque el combustible no da. La frontera deja de ser política y
// pasa a ser física, que es mucho más interesante de jugar: para llegar más
// lejos hay que construir aeródromos más adelantados o mover un portaviones.
//
// Orden deliberado drone > bombardero > caza > helicóptero. El dron manda porque
// su papel es ser los ojos del jugador muy por delante del frente, y con un radio
// de caza no llegaría a ver nada que no viera ya la inteligencia de frontera. El
// helicóptero cierra la tabla: es apoyo de la tropa, no un aparato de alcance.
export const AIR_RANGE_KM = {
  drone:       { 1: 2400, 2: 4400, 3: 6400 },
  bombardero:  { 1: 2000, 2: 2800, 3: 3600 },
  caza:        { 1: 1000, 2: 1400, 3: 1800 },
  helicoptero: { 1:  500, 2:  700, 3:  900 },
};

// Excepciones por tipo: aparatos cuyo alcance no lo explica su categoría.
//
// Los tres bombarderos de abajo son los únicos de la plantilla que de verdad son
// estratégicos —pensados para cruzar un océano, soltar y volver— y por eso pasan
// por encima incluso del dron de T3. Los demás bombarderos del juego (B-52G,
// Tu-22M2, Tu-22M3) se quedan con la cifra de su categoría: el Backfire es un
// bombardero de teatro, no intercontinental, y el B-52 solo alcanza lo que dicen
// sus cifras reales con reabastecimiento en vuelo, que aquí no se modela.
//
// El RQ-190 va desarmado a propósito (ver air-combat-data.js) y a cambio llega
// donde no llega nada más que tenga tripulación.
export const AIR_RANGE_KM_BY_TYPE = {
  "occ-3-drone-rq190": 8400, // RQ-190 — penetración profunda, sin armas
  "occ-2-bombardero": 9000,  // B-2 Spirit
  "occ-3-bombardero": 9600,  // B-21 Raider
  "ori-3-bombardero": 9000,  // Tu-160M — el único ruso que lo merece
};

// A partir de qué `rcs` un aparato puede meterse en espacio aéreo ajeno sin que
// eso sea una declaración de guerra. La idea: nadie declara la guerra por algo
// que no ha visto. Los drones pueden SIEMPRE, sea cual sea su firma, porque su
// perfil de vuelo (lento, pequeño, alto) y su condición de no tripulado es
// justo lo que en la realidad permite negarlo. Los tripulados necesitan ser
// furtivos de verdad: 0,6 deja dentro al B-2 (0,82), al B-21 (0,88), al F-22
// (0,80) y al F-35 (0,78), y deja fuera al Tu-160M (0,15), que es enorme en el
// radar por mucho alcance que tenga.
export const STEALTH_OVERFLIGHT_RCS = 0.6;

// Dificultad (se elige en la pantalla de inicio y viaja en state.difficulty).
// Solo toca a los bots: producción bruta de sus provincias y ganas de declarar
// guerras. El balance de unidades no cambia con la dificultad.
export const DIFFICULTIES = {
  facil: { name: "Fácil", desc: "Los bots producen un 30 % menos y declaran menos guerras", aiIncome: 0.7, aiAggression: 0.6 },
  normal: { name: "Normal", desc: "Economía y agresividad estándar", aiIncome: 1.0, aiAggression: 1.0 },
  dificil: { name: "Difícil", desc: "Los bots producen un 35 % más y son mucho más belicosos", aiIncome: 1.35, aiAggression: 1.7 },
};
export const DEFAULT_DIFFICULTY = "normal";

// Mercado de recursos: $ por unidad. Comprar sale caro a propósito (la infantería
// t2 pasa de 20k$ a ~34k$ si compras todos sus suministros): el mercado es una
// válvula para el dinero que sobra, no un sustituto de la industria.
export const MARKET = {
  supplies: { buy: 8, sell: 3 },
  fuel: { buy: 6, sell: 2 },
};
export const MARKET_LOTS = [1000, 5000];

// IA
// Cada cuántas horas de JUEGO decide un bot. Con el reloj a 1 día = 1 hora real,
// 6 h de juego eran 15 minutos reales sin que los bots movieran ficha: parecían
// congelados. Con 2 h reaccionan cada 5 minutos reales.
export const AI_CHECK_HOURS = 2;
// Reclutamientos que un bot puede iniciar por chequeo (antes era 1 para todo el
// país: EEUU con 30 provincias reclutaba igual que Belice con 1).
export const AI_RECRUITS_PER_CHECK = (provinces) => Math.max(1, Math.min(4, Math.ceil(provinces / 6)));
// Niebla de guerra de los bots. Ven lo mismo que tú: provincias propias, donde
// tienen tropas y el círculo de sus drones (fuerte), más las adyacentes (débil,
// solo bulto). Los EDIFICIOS son la excepción: son obra pública, se ven siempre.
export const AI_COUNTER_CHANCE = 0.5;      // probabilidad de reaccionar a la obra enemiga vista
export const AI_GUESS_PER_PROVINCE = 2;    // unidades que un bot SUPONE por provincia enemiga
export const AI_GUESS_BIAS = [0.7, 1.45];  // sesgo fijo por pareja: unos sobrestiman, otros no
export const AI_WAR_COOLDOWN_DAYS = 3;
export const AI_MIN_WAR_DAY = 2;           // día mínimo de partida para declarar guerra
export const AI_WAR_RATIO = 1.4;           // ratio de poder para declarar guerra
export const AI_ATTACK_RATIO = 1.25;       // superioridad local para atacar
export const AI_PEACE_LOST_SHARE = 0.4;    // % provincias perdidas → busca paz

// Victoria
export const VICTORY_VP_SHARE = 0.55;
export const VICTORY_CHECK_DAYS = 1;

// Movimiento: multiplicador de velocidad del terreno (entrada a la provincia)
export const TERRAIN_MOVE_MULT = {
  llanura: 1, bosque: 1.25, selva: 1.5, montaña: 1.6, desierto: 1.2, tundra: 1.4, urbano: 1,
};

export const TERRAIN_NAMES = {
  llanura: "Llanura", bosque: "Bosque", selva: "Selva", montaña: "Montaña",
  desierto: "Desierto", tundra: "Tundra", urbano: "Urbano",
};

export const RES_INFO = [
  { key: "money", name: "Dinero", icon: "money", fmt: (v) => fmtInt(v) },
  { key: "supplies", name: "Suministros", icon: "supplies", fmt: (v) => fmtInt(v) },
  { key: "fuel", name: "Combustible", icon: "fuel", fmt: (v) => fmtInt(v) },
  { key: "manpower", name: "Mano de obra", icon: "manpower", fmt: (v) => fmtInt(v) },
];

export function fmtInt(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e4) return (v / 1e3).toFixed(1) + "k";
  return Math.floor(v).toLocaleString("es");
}

export function fmtGameDate(timeMinutes) {
  const d = new Date(START_DATE_MS + timeMinutes * 60000);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getUTCDate()} ${meses[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${String(d.getUTCHours()).padStart(2, "0")}:00`;
}
