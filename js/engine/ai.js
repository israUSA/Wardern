// IA de países bot: economía, operaciones militares y diplomacia.
import * as C from "../data/constants.js";
import { UNITS } from "../data/units-data.js";
import { S, unitDef, isNaval, controller, atWar, unitsIn, armyPower, controlledCount, declareWar, makePeace, gameDay, availableVariants, TIERS, distKm } from "./state.js";
import { startBuilding, startRecruitCategory, startResearch, canAfford } from "./economy.js";
import { orderMove, findPath } from "./movement.js";
import { battleSet } from "./combat.js";
import { strikeWeaponsFor, launchMissile } from "./missiles.js";

export function aiTickAll(state) {
  const battles = battleSet(state);
  for (const iso in state.countries) {
    const c = state.countries[iso];
    if (iso === state.player || c.eliminated) continue;
    try {
      aiEconomy(state, iso);
      aiResearch(state, iso);
      aiMilitary(state, iso, battles);
      aiMissiles(state, iso);
      aiDiplomacy(state, iso);
    } catch (e) {
      console.error("IA error:", iso, e);
    }
  }
}

// ---------- Economía ----------

function aiEconomy(state, iso) {
  const c = state.countries[iso];
  const r = c.resources;
  // (las celdas de mar están en provinceList pero no tienen entrada en
  // state.provinces: sin este filtro la IA completa moría en el try/catch)
  const own = S.provinceList.filter((p) => {
    if (p.isSea) return false;
    const ps = state.provinces[p.id];
    return ps.owner === iso && !ps.occupier;
  });
  if (!own.length) return;

  const units = state.units.filter((u) => u.owner === iso);
  const upkeepPerH = units.reduce(
    (s, u) => s + ((unitDef(u.type)?.cost.money || 5000) * C.UPKEEP_MONEY_AS_SUPPLIES) / 24,
    0
  );
  let hasAir = S.provinceList.some(
    (p) => state.provinces[p.id]?.owner === iso && state.provinces[p.id].buildings.aerobase > 0
  );

  for (const p of own) {
    const ps = state.provinces[p.id];
    if (ps.queue) continue;
    const coastal = (S.edges.get(p.id) || []).some((e) => S.provinces.get(e.to)?.isSea);
    if (r.supplies < upkeepPerH * 48 && ps.buildings.industria < C.BUILDINGS.industria.max) {
      if (startBuilding(state, p.id, "industria")) continue;
    }
    if (r.manpower < 800 && ps.buildings.reclutamiento < C.BUILDINGS.reclutamiento.max) {
      if (startBuilding(state, p.id, "reclutamiento")) continue;
    }
    if (!hasAir && ps.buildings.industria >= 1 && r.money > 30000 && ps.buildings.aerobase < 1) {
      if (startBuilding(state, p.id, "aerobase")) { hasAir = true; continue; }
    }
    if (coastal && ps.buildings.puerto < 1 && r.money > 60000 && units.length > own.length * 1.5) {
      if (startBuilding(state, p.id, "puerto")) continue;
    }
    if (c.wars.length && isBorder(state, p.id, iso, false) && ps.buildings.fortaleza < 2) {
      if (startBuilding(state, p.id, "fortaleza")) continue;
    }
    if (ps.buildings.industria < 1) {
      if (startBuilding(state, p.id, "industria")) continue;
    }
    if (ps.buildings.fortaleza < 1 && (p.capital || units.length > 10)) {
      startBuilding(state, p.id, "fortaleza");
    }
  }

  // Reclutamiento: mantener un ejército objetivo (elige variantes de su doctrina)
  const target = own.length * 2 + (c.wars.length ? 6 : 0);
  if (units.length < target) {
    const cands = own
      .filter((p) => !state.provinces[p.id].queue)
      .sort(
        (a, b) =>
          (b.capital ? 1 : 0) - (a.capital ? 1 : 0) || (b.prod.manpower || 0) - (a.prod.manpower || 0)
      );
    if (cands.length) startRecruitCategory(state, cands[0].id, chooseUnitType(state, iso));
  }
}

// La IA invierte en investigación cuando su economía sobra
function aiResearch(state, iso) {
  const c = state.countries[iso];
  if (c.researchQueue || (c.researchedTier ?? 1) >= 3) return;
  const next = TIERS.find((t) => t.id === (c.researchedTier ?? 1) + 1);
  if (!next) return;
  if (c.resources.money > next.researchCost.money * 1.3) startResearch(state, iso, next.id);
}

const AIR_TYPES = ["caza", "bombardero", "helicoptero", "drone"];

function chooseUnitType(state, iso) {
  const c = state.countries[iso];
  // (?. por las celdas de mar: no tienen entrada en state.provinces)
  const hasAir = S.provinceList.some(
    (p) => state.provinces[p.id]?.owner === iso && state.provinces[p.id].buildings.aerobase > 0
  );
  // Sin base aérea no puede reclutar aéreos
  const ok = (pairs) => pairs.filter(([t]) => hasAir || !AIR_TYPES.includes(t));

  // Composición enemiga (compartida por todas las ramas)
  let mbt = 0, air = 0, total = 0;
  for (const u of state.units) {
    if (atWar(state, iso, u.owner)) {
      total++;
      if (unitDef(u.type)?.category === "mbt") mbt++; // por categoría: cuenta variantes doctrina×tier
      if (unitDef(u.type)?.air) air++;
    }
  }

  // Enemigo con muchos aéreos → antiaéreos y cazas
  if (total >= 4 && air / total > 0.15) {
    return weighted(ok([
      ["antiaereo", 0.35], ["infanteria", 0.25], ["caza", 0.2], ["mbt", 0.1],
      ["motorizada", 0.05], ["artilleria", 0.05],
    ]));
  }

  if (!c.wars.length) {
    return weighted(ok([
      ["infanteria", 0.43], ["motorizada", 0.15], ["mbt", 0.12], ["cazatanques", 0.05], ["artilleria", 0.05],
      ["antiaereo", 0.02], ["caza", 0.06], ["bombardero", 0.04], ["drone", 0.05], ["helicoptero", 0.03],
    ]));
  }
  // Muchos MBT enemigos → cazatanques/helicópteros; mucha infantería → MBT
  if (total >= 4 && mbt / total > 0.25) {
    return weighted(ok([
      ["cazatanques", 0.38], ["infanteria", 0.24], ["motorizada", 0.08], ["artilleria", 0.12],
      ["antiaereo", 0.04], ["helicoptero", 0.1], ["caza", 0.04],
    ]));
  }
  return weighted(ok([
    ["infanteria", 0.33], ["mbt", 0.19], ["motorizada", 0.11], ["artilleria", 0.1], ["cazatanques", 0.06],
    ["antiaereo", 0.04], ["caza", 0.06], ["bombardero", 0.05], ["drone", 0.04], ["helicoptero", 0.02],
  ]));
}

function weighted(pairs) {
  let r = Math.random();
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[0][0];
}

// ---------- Militar ----------

function isBorder(state, pid, iso, includeStraits = true) {
  for (const e of S.edges.get(pid) || []) {
    if (!includeStraits && e.strait) continue;
    const ctrl = controller(state.provinces[e.to]);
    if (ctrl !== iso && atWar(state, iso, ctrl)) return true;
  }
  return false;
}

function inBattle(u, battles) {
  return battles.has(u.pos);
}

function aiMilitary(state, iso, battles) {
  const c = state.countries[iso];
  if (!c.wars.length) return;

  const myUnits = state.units.filter((u) => u.owner === iso);

  // Liberar tareas que ya no tienen sentido
  for (const u of myUnits) {
    if (!u.task) continue;
    if (u.task.kind === "defend" && !isBorder(state, u.task.pid, iso)) u.task = null;
    if (u.task.kind === "attack") {
      const ctrl = controller(state.provinces[u.task.pid]);
      if (!atWar(state, iso, ctrl)) u.task = null;
    }
  }

  const idle = myUnits.filter((u) => !u.edgeLeft && !u.path.length && !u.task && !inBattle(u, battles));

  // Defensa: guarnecer mis provincias fronterizas con 2 unidades
  const myBorder = S.provinceList.filter(
    (p) => controller(state.provinces[p.id]) === iso && isBorder(state, p.id, iso, false)
  );
  for (const p of myBorder) {
    const garrison = unitsIn(state, p.id).filter((u) => u.owner === iso && !u.edgeLeft).length;
    const need = 2 - garrison;
    for (let k = 0; k < need; k++) {
      const u = nearestIdle(state, iso, idle, p.id);
      if (!u) break;
      u.task = { kind: "defend", pid: p.id };
      if (!orderMove(state, u, p.id)) u.task = null;
    }
  }

  // Ataque: provincias enemigas adyacentes a unidades ociosas
  const enemyIsos = c.wars;
  const candidates = new Map();
  for (const p of S.provinceList) {
    if (p.isSea) continue;
    const ctrl = controller(state.provinces[p.id]);
    if (!enemyIsos.includes(ctrl)) continue;
    const myAdj = (S.edges.get(p.id) || [])
      .filter((e) => controller(state.provinces[e.to]) === iso)
      .map((e) => e.to);
    if (!myAdj.length) continue;
    const ready = idle.filter((u) => myAdj.includes(u.pos));
    if (ready.length) candidates.set(p.id, ready);
  }

  for (const [pid, ready] of candidates) {
    const defenders = unitsIn(state, pid).filter((u) => atWar(state, iso, u.owner));
    const powerOf = (list) =>
      list.reduce((s, u) => s + (u.hp / 100) * ((unitDef(u.type)?.cost.money || 5000) / 5000), 0);
    const defPower = powerOf(defenders);
    const atkPower = powerOf(ready);

    let send = 0;
    if (!defenders.length) send = 1; // provincia vacía: ocuparla
    else if (atkPower > defPower * C.AI_ATTACK_RATIO) send = Math.min(4, ready.length);
    if (!send) continue;

    ready.sort((a, b) => (b.hp - a.hp));
    for (let i = 0; i < send; i++) {
      const u = ready[i];
      if (!u) break;
      u.task = { kind: "attack", pid };
      if (!orderMove(state, u, pid)) u.task = null;
    }
  }
}

function nearestIdle(state, iso, idle, targetPid) {
  const target = S.provinces.get(targetPid);
  let best = null, bestD = Infinity;
  for (const u of idle) {
    if (u.task) continue;
    const p = S.provinces.get(u.pos);
    const d = Math.hypot(p.cx - target.cx, p.cy - target.cy);
    if (d < bestD) {
      if (findPath(state, u, targetPid)) { best = u; bestD = d; }
    }
  }
  return best;
}

// ---------- Misiles (docs/MISSILES.md §6) ----------

function aiMissiles(state, iso) {
  // Golpes: plataforma anclada con arma lista → mejor blanco enemigo a rango.
  // La IA no sufre niebla: elige por ΣHP (o edificio niv ≥ 2) dentro del rango.
  for (const u of state.units) {
    if (u.dead || u.owner !== iso || u.edgeLeft) continue;
    const from = S.provinces.get(u.pos);
    if (!from) continue;
    for (const sw of strikeWeaponsFor(u.type)) {
      if ((u.mslCd?.[sw.weapon.id] || 0) > 0) continue;
      if (!canAfford(state, iso, sw.weapon.coste)) continue;
      let best = null;
      let bestHp = 0;
      for (const p of S.provinceList) {
        if (p.isSea !== (sw.weapon.objetivos === "celda-mar")) continue;
        if (!p.isSea) {
          const ctrl = controller(state.provinces[p.id]);
          if (!ctrl || !atWar(state, iso, ctrl)) continue;
        }
        const d = distKm([from.cx, from.cy], [p.cx, p.cy]);
        if (d > sw.rangoKm) continue;
        const hp = state.units
          .filter((x) => x.pos === p.id && !x.embarked && !x.dead && x.owner !== iso && atWar(state, iso, x.owner))
          .reduce((s, x) => s + x.hp, 0);
        const bld = p.isSea ? 0 : Math.max(0, ...Object.values(state.provinces[p.id]?.buildings || {}));
        if ((hp >= 150 || bld >= 2) && hp > bestHp) {
          bestHp = hp;
          best = p.id;
        }
      }
      if (best) launchMissile(state, u.id, sw.weapon.id, best);
    }
  }

  // Drones ociosos en retaguardia: reubicarlos junto al frente con más tropas enemigas
  for (const u of state.units) {
    if (u.dead || u.owner !== iso || u.edgeLeft || u.path.length) continue;
    if (unitDef(u.type)?.category !== "drone") continue;
    let atFront = false;
    let target = null;
    let bestHp = 0;
    for (const e of S.edges.get(u.pos) || []) {
      const np = S.provinces.get(e.to);
      if (!np || np.isSea) continue;
      const nctrl = controller(state.provinces[e.to]);
      if (nctrl && atWar(state, iso, nctrl)) { atFront = true; break; }
    }
    if (atFront) continue;
    for (const p of S.provinceList) {
      if (p.isSea) continue;
      const ps = state.provinces[p.id];
      if (!ps || controller(ps) !== iso) continue;
      let enemyHp = 0;
      for (const e of S.edges.get(p.id) || []) {
        const np = S.provinces.get(e.to);
        if (!np || np.isSea) continue;
        const nctrl = controller(state.provinces[e.to]);
        if (nctrl && atWar(state, iso, nctrl)) {
          enemyHp += state.units.filter((x) => x.pos === e.to && !x.dead).reduce((s, x) => s + x.hp, 0);
        }
      }
      if (enemyHp > bestHp) { bestHp = enemyHp; target = p.id; }
    }
    if (target && target !== u.pos) orderMove(state, u, target);
  }
}

// ---------- Diplomacia ----------

function aiDiplomacy(state, iso) {
  const c = state.countries[iso];
  const day = gameDay(state);

  // Buscar paz si la guerra va mal
  for (const enemy of [...c.wars]) {
    const ec = state.countries[enemy];
    if (!ec || ec.eliminated) continue;
    const myPower = armyPower(state, iso);
    const enemyPower = armyPower(state, enemy);
    const startControlled = c.warControlStart?.[enemy] ?? controlledCount(state, iso);
    const losing =
      myPower < enemyPower * 0.5 || controlledCount(state, iso) < startControlled * 0.6;
    const longWar = day - (c.warStartDay?.[enemy] ?? 0) > 7;

    if (enemy === state.player) {
      if (losing && Math.random() < 0.5 && !state.events.some((e) => e.type === "peace_offer" && e.from === iso)) {
        state.events.push({ type: "peace_offer", from: iso });
      }
    } else if (losing || (longWar && Math.random() < 0.3)) {
      makePeace(state, iso, enemy);
    }
  }

  // Declarar guerra al vecino más débil
  if (c.wars.length === 0 && day >= Math.max(C.AI_MIN_WAR_DAY, c.nextWarDay ?? 0)) {
    if (Math.random() < c.aggression * 0.12) {
      const neighbors = neighborCountries(state, iso, false);
      let best = null, bestRatio = 0;
      for (const nb of neighbors) {
        const nbc = state.countries[nb];
        if (!nbc || nbc.eliminated) continue;
        if ((nbc.peaceUntil?.[iso] ?? 0) > day) continue;
        const ratio = armyPower(state, iso) / Math.max(1, armyPower(state, nb));
        if (ratio >= C.AI_WAR_RATIO && ratio > bestRatio) { best = nb; bestRatio = ratio; }
      }
      if (best) {
        declareWar(state, iso, best);
        c.nextWarDay = day + C.AI_WAR_COOLDOWN_DAYS + 3;
        trackWar(c, best, day);
        trackWar(state.countries[best], iso, day);
      } else {
        c.nextWarDay = day + 1;
      }
    } else {
      c.nextWarDay = day + 0.5;
    }
  }
}

function trackWar(c, enemy, day) {
  c.warStartDay = c.warStartDay || {};
  c.warControlStart = c.warControlStart || {};
  c.warStartDay[enemy] = day;
  c.warControlStart[enemy] = null; // se llena al leerse si falta
}

// Países con frontera terrestre (o estrechos si includeStraits) conmigo
function neighborCountries(state, iso, includeStraits = true) {
  const out = new Set();
  for (const p of S.provinceList) {
    if (controller(state.provinces[p.id]) !== iso) continue;
    for (const e of S.edges.get(p.id) || []) {
      if (!includeStraits && e.strait) continue;
      const ctrl = controller(state.provinces[e.to]);
      if (ctrl !== iso) out.add(ctrl);
    }
  }
  return [...out];
}

// Respuesta de la IA a una oferta de paz del jugador
export function aiRespondPeace(state, aiIso) {
  const myPower = armyPower(state, aiIso);
  const playerPower = armyPower(state, state.player);
  const c = state.countries[aiIso];
  const day = gameDay(state);
  const startControlled = c.warControlStart?.[state.player] ?? controlledCount(state, aiIso);
  const losing = controlledCount(state, aiIso) < startControlled * 0.7 || myPower < playerPower * 0.7;
  const longWar = day - (c.warStartDay?.[state.player] ?? 0) > 7;
  return losing || longWar;
}
