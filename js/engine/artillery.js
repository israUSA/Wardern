// Tiro a distancia de la artillería (docs/UNITS.md).
//
// Es lo contrario de una orden de ataque normal: la pieza NO se mueve. Elige una
// ficha enemiga que esté dentro de su alcance y le manda una salva por encima
// del terreno. Por eso la artillería es la única unidad que puede hacer daño sin
// entrar en combate —y la única a la que le sirve de algo quedarse detrás.
//
// El alcance es propio de cada variante (`rangoKm` en js/data/units-data.js):
// un D-30 no bate lo mismo que un 2S35. El ritmo, el daño y el coste salen de
// las constantes ARTY_* y escalan por tier de la pieza.
import { S, unitDef, distKm, atWar, log, visibleProvinces } from "./state.js";
import * as C from "../data/constants.js";
import { canAfford, pay } from "./economy.js";

// Alcance de tiro en km de mapa, 0 si la unidad no es artillería
export function artilleryRange(type) {
  const T = unitDef(type);
  return T?.category === "artilleria" ? T.rangoKm || 0 : 0;
}

export function canShell(type) {
  return artilleryRange(type) > 0;
}

// Distancia de la pieza a una provincia, en km de mapa
export function shellDistance(state, u, pid) {
  const from = S.provinces.get(u.pos);
  const to = S.provinces.get(pid);
  if (!from || !to) return Infinity;
  return distKm([from.cx, from.cy], [to.cx, to.cy]);
}

// Salva contra una ficha concreta. Devuelve { ok, msg } igual que launchMissile.
export function shellUnit(state, u, target) {
  const rango = artilleryRange(u.type);
  if (!rango) return { ok: false, msg: "Esta unidad no tiene tiro a distancia" };
  if (u.edgeLeft) return { ok: false, msg: "La pieza está en marcha: detenla para abrir fuego" };
  if (!target || target.dead) return { ok: false, msg: "Ese objetivo ya no existe" };
  if (target.owner === u.owner) return { ok: false, msg: "Esa unidad es tuya" };
  if (!atWar(state, u.owner, target.owner)) {
    return { ok: false, msg: `No estás en guerra con ${S.countries[target.owner].name}` };
  }
  if (target.embarked) return { ok: false, msg: "Va embarcada: no es un blanco batible" };
  const km = shellDistance(state, u, target.pos);
  if (km > rango) {
    return { ok: false, msg: `Fuera de alcance: ${Math.round(km)} km > ${rango} km de la pieza` };
  }
  // Mismo criterio que los misiles: sin ojos sobre el objetivo no hay tiro. La
  // IA no sufre niebla en este chequeo (ver docs/MISSILES.md §6).
  if (u.owner === state.player && !visibleProvinces(state).has(target.pos)) {
    return { ok: false, msg: "Sin observación del objetivo (mándale un dron o una unidad)" };
  }
  const cd = u.artyCd || 0;
  if (cd > 0) return { ok: false, msg: `Recargando: ${Math.ceil(cd)} min de juego` };
  const tier = unitDef(u.type)?.tier || 1;
  const coste = { supplies: C.ARTY_COST[tier] || 320 };
  if (!canAfford(state, u.owner, coste)) return { ok: false, msg: "Sin munición: faltan suministros" };

  pay(state, u.owner, coste);
  u.artyCd = C.ARTY_COOLDOWN_MIN;
  if (!state.missiles) state.missiles = [];
  const minutes = (km / C.ARTY_SHELL_KMH) * 60;
  state.missiles.push({
    id: `art-${state.time.toFixed(3)}-${Math.random().toString(36).slice(2, 6)}`,
    weaponId: "obus", owner: u.owner, fromId: u.pos, toId: target.pos,
    // arty: el proyectil NO persigue. Cae donde se apuntó, así que si el blanco
    // se mueve durante el vuelo, el impacto lo reparte quien quede en la celda.
    arty: true, targetUnitId: target.id,
    danio: C.ARTY_DAMAGE[tier] || 9, minutesLeft: minutes, total: minutes,
  });
  const donde = S.provinces.get(target.pos);
  log(state, `${S.countries[u.owner].name} abre fuego de artillería sobre ${donde?.isSea ? "alta mar" : donde?.name}`, "war");
  return { ok: true, msg: `Salva en el aire: ${Math.round(km)} km de ${rango} km de alcance` };
}

// Recarga. Se llama desde tickMissiles, que ya recorre las unidades por cooldown.
export function tickArtillery(state, dt) {
  for (const u of state.units) {
    if (u.artyCd > 0) u.artyCd = Math.max(0, u.artyCd - dt);
  }
}
