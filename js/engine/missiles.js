// Motor de misiles (docs/MISSILES.md): golpes manuales, cooldowns y vuelos.
// El daño es plano: ni terreno, ni fortaleza, ni defensa lo mitigan.
import { S, unitDef, controller, atWar, distKm, log, visibleProvinces } from "./state.js";
import { MISSILES } from "../data/missiles-data.js";
import * as C from "../data/constants.js";
import { canAfford, pay } from "./economy.js";

// Armas de golpe que puede disparar esta variante (con su escalado de tier:
// plataforma.tier > tierRequerido → rango y daño ×1.25, igual que el roster)
export function strikeWeaponsFor(type) {
  const T = unitDef(type);
  if (!T) return [];
  const tier = T.tier ?? 1;
  const out = [];
  for (const w of Object.values(MISSILES)) {
    if (w.modo !== "golpe" || !w.plataformaIds.includes(type)) continue;
    const scale = tier > w.tierRequerido ? 1.25 : 1;
    out.push({
      weapon: w,
      rangoKm: Math.round(w.rangoKm * scale),
      danio: Math.round(w.danio * scale),
    });
  }
  return out;
}

export function launchMissile(state, unitId, weaponId, targetPid) {
  const u = state.units.find((x) => x.id === unitId && !x.dead);
  const w = MISSILES[weaponId];
  if (!u || !w || w.modo !== "golpe") return { ok: false, msg: "Arma no disponible" };
  if (u.edgeLeft) return { ok: false, msg: "La plataforma debe estar detenida" };
  const from = S.provinces.get(u.pos);
  const to = S.provinces.get(targetPid);
  if (!from || !to) return { ok: false, msg: "Objetivo inválido" };
  if (to.isSea && w.objetivos !== "celda-mar") return { ok: false, msg: "Ese arma no ataca el mar" };
  if (!to.isSea && w.objetivos !== "provincia-terrestre") return { ok: false, msg: "Ese arma solo ataca barcos" };
  const ctrl = controller(state.provinces[targetPid]);
  if (!to.isSea && (!ctrl || !atWar(state, u.owner, ctrl))) {
    return { ok: false, msg: "No estás en guerra con esa provincia" };
  }
  const enemyUnits = state.units.filter(
    (x) => x.pos === targetPid && !x.embarked && !x.dead && x.owner !== u.owner && atWar(state, u.owner, x.owner)
  );
  const hasBuilding =
    !to.isSea && Object.values(state.provinces[targetPid]?.buildings || {}).some((v) => v > 0);
  if (!enemyUnits.length && !hasBuilding) {
    return { ok: false, msg: "Objetivo vacío: sin tropas ni edificios" };
  }
  // Reconocimiento: solo el jugador sufre niebla (la IA no comprueba visión, §6)
  if (u.owner === state.player && !visibleProvinces(state).has(targetPid)) {
    return { ok: false, msg: "Sin reconocimiento del objetivo (mándale un dron)" };
  }
  const sw = strikeWeaponsFor(u.type).find((x) => x.weapon.id === weaponId);
  if (!sw) return { ok: false, msg: "Esa plataforma no porta esa arma" };
  if ((u.mslCd?.[weaponId] || 0) > 0) {
    return { ok: false, msg: `${w.nombre} recargando (${Math.ceil(u.mslCd[weaponId] / 60)} h)` };
  }
  if (!canAfford(state, u.owner, w.coste)) return { ok: false, msg: "Recursos insuficientes para el misil" };
  const km = distKm([from.cx, from.cy], [to.cx, to.cy]);
  if (km > sw.rangoKm) {
    return { ok: false, msg: `Fuera de rango: ${Math.round(km)} km > ${sw.rangoKm} km` };
  }
  pay(state, u.owner, w.coste);
  u.mslCd = { ...(u.mslCd || {}), [weaponId]: w.cooldownH * 60 };
  if (!state.missiles) state.missiles = [];
  const minutes = (km / w.velocidadKmH) * 60;
  state.missiles.push({
    id: `msl-${state.time.toFixed(3)}-${Math.random().toString(36).slice(2, 6)}`,
    weaponId, owner: u.owner, fromId: u.pos, toId: targetPid,
    danio: sw.danio, minutesLeft: minutes, total: minutes,
  });
  log(state, `${S.countries[u.owner].name} lanza un ${w.nombre} desde ${from.isSea ? "alta mar" : from.name}`, "war");
  return { ok: true, msg: `${w.nombre} en vuelo: ${Math.round(km)} km, impacto en ~${Math.max(1, Math.round(minutes))} min` };
}

export function tickMissiles(state, dt) {
  for (const u of state.units) {
    if (!u.mslCd) continue;
    for (const k of Object.keys(u.mslCd)) {
      if (u.mslCd[k] > 0) u.mslCd[k] = Math.max(0, u.mslCd[k] - dt);
    }
  }
  if (!state.missiles?.length) return;
  const alive = [];
  for (const m of state.missiles) {
    m.minutesLeft -= dt;
    if (m.minutesLeft > 0) alive.push(m);
    else impact(state, m);
  }
  state.missiles = alive;
}

function impact(state, m) {
  const w = MISSILES[m.weaponId];
  const to = S.provinces.get(m.toId);
  if (!w || !to) return;
  // El blanco se revalida al impactar: si hubo paz en el trayecto, el misil se pierde
  const ctrl = to.isSea ? null : controller(state.provinces[m.toId]);
  if (ctrl && !atWar(state, m.owner, ctrl)) return;

  const enemies = state.units.filter(
    (x) => x.pos === m.toId && !x.embarked && !x.dead && atWar(state, m.owner, x.owner)
  );
  let hits = 0;
  for (const e of enemies) {
    e.hp -= m.danio;
    e.morale = Math.max(0, e.morale - m.danio * C.MORALE_HIT);
    hits++;
    if (e.hp <= 0) {
      e.dead = true;
      state.stats.lost[e.owner] = (state.stats.lost[e.owner] || 0) + 1;
    }
  }
  let bld = "";
  const ps = state.provinces[m.toId];
  if (ps && w.probEdificio > 0 && Math.random() < w.probEdificio) {
    const keys = Object.keys(ps.buildings || {}).filter((k) => ps.buildings[k] > 0);
    if (keys.length) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      ps.buildings[k] -= 1;
      bld = ` y daña ${C.BUILDINGS[k]?.name || k}`;
    }
  }
  const where = to.isSea ? "alta mar" : to.name;
  if (hits || bld) {
    log(state, `Impacto de ${w.nombre} en ${where}: ${hits || 0} unidad(es) dañada(s)${bld}`, "war");
  }
}
