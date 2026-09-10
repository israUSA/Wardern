// Constantes de simulación de Wardern.
// Todas las magnitudes de tiempo están en MINUTOS DE JUEGO salvo que se indique.

export const TICK_MS = 250;               // duración real de un tick
// Minutos de juego por tick a 1×. A 4 ticks/s, con 15 el reloj corría a UNA HORA
// de juego por segundo real: no es que las unidades fueran rápidas, es que el
// tiempo volaba, y por eso un avión cruzaba una provincia antes de que te diera
// tiempo a mirarlo. Con 6 el ritmo baja a 24 min de juego por segundo (2,5× más
// lento) y TODO se ralentiza por igual —movimiento, economía, construcción,
// investigación y combate— sin tocar una sola cifra de balance. Quien quiera el
// ritmo anterior lo tiene en el botón 2×/4×.
export const MINUTES_PER_TICK_BASE = 6;
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

// Anexión
export const ANNEX_DAYS = 5 * 24 * 60;
export const ANNEX_COST = (pop) => Math.round(pop / 2000) + 2000;

// Combate
export const COMBAT_SCALE = 0.08;          // daño base por tick
export const DEF_SOFTENER = 20;            // dmg ×= DEF_SOFTENER/(DEF_SOFTENER+defTotal)
export const FORT_DEF_PER_LEVEL = 0.2;     // +20% defensa por nivel de fortaleza
export const OVERSTACK_FREE = 8;
export const OVERSTACK_PENALTY = 0.08;     // −8% potencia por unidad extra
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

// IA
export const AI_CHECK_HOURS = 6;
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
