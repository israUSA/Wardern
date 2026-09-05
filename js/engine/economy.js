// Economía: producción horaria, mantenimiento, construcción, reclutamiento e investigación.
import * as C from "../data/constants.js";
import { S, unitDef, isNaval, availableVariants, log, checkElimination, controller, spawnUnit, TIERS } from "./state.js";
import { battleSet } from "./combat.js";

export function economyHour(state) {
  const acc = {};
  for (const iso in state.countries) {
    if (!state.countries[iso].eliminated) acc[iso] = { money: 0, supplies: 0, fuel: 0, manpower: 0 };
  }

  for (const p of S.provinceList) {
    if (p.isSea) continue;
    const ps = state.provinces[p.id];
    const ctrl = controller(ps);
    if (!acc[ctrl]) continue;
    const share = ps.occupier && ps.occupier !== ps.owner ? C.OCCUPY_SHARE : 1;
    const b = ps.buildings;
    acc[ctrl].money += (p.prod.money || 0) * share;
    acc[ctrl].supplies += ((p.prod.supplies || 0) + (b.industria || 0) * C.INDUSTRY_SUPPLIES) * share;
    acc[ctrl].fuel += ((p.prod.fuel || 0) + 0.5) * share; // piso base por provincia
    acc[ctrl].manpower += ((p.prod.manpower || 0) + (b.reclutamiento || 0) * C.RECRUIT_MANPOWER) * share;
  }

  // Mantenimiento de unidades (se descuenta del stock y del flujo visible en la UI)
  const upkeep = {};
  for (const u of state.units) {
    const def = unitDef(u.type);
    if (!def) continue;
    const cost = def.cost;
    let up = upkeep[u.owner];
    if (!up) up = upkeep[u.owner] = { supplies: 0, fuel: 0 };
    const s = (cost.money * C.UPKEEP_MONEY_AS_SUPPLIES) / 24;
    const f = ((cost.fuel || 0) * C.UPKEEP_FUEL_FACTOR) / 24;
    up.supplies += s;
    up.fuel += f;
    const r = state.countries[u.owner]?.resources;
    if (!r) continue;
    r.supplies -= s;
    r.fuel -= f;
  }
  for (const iso in acc) {
    const up = upkeep[iso];
    if (up) {
      acc[iso].supplies -= up.supplies;
      acc[iso].fuel -= up.fuel;
    }
  }

  for (const iso in acc) {
    const r = state.countries[iso].resources;
    r.money += acc[iso].money;
    r.supplies += acc[iso].supplies;
    r.fuel += acc[iso].fuel;
    r.manpower += acc[iso].manpower;
    for (const k of ["money", "supplies", "fuel", "manpower"]) {
      if (r[k] < 0) r[k] = 0;
    }
    state.countries[iso].shortSupplies = r.supplies <= 0.01;
  }
  state.flow = acc; // producción neta por hora (para la UI, después de mantenimiento)
}

export function canAfford(state, iso, cost) {
  const r = state.countries[iso].resources;
  return (
    r.money >= (cost.money || 0) &&
    r.supplies >= (cost.supplies || 0) &&
    r.fuel >= (cost.fuel || 0) &&
    r.manpower >= (cost.manpower || 0)
  );
}

export function pay(state, iso, cost) {
  if (!canAfford(state, iso, cost)) return false;
  const r = state.countries[iso].resources;
  r.money -= cost.money || 0;
  r.supplies -= cost.supplies || 0;
  r.fuel -= cost.fuel || 0;
  r.manpower -= cost.manpower || 0;
  return true;
}

export function buildingCost(type, level) {
  const b = C.BUILDINGS[type];
  const growth = b.costGrowth || 1;
  const mult = Math.pow(growth, level);
  return {
    money: Math.round((b.cost.money || 0) * mult),
    supplies: Math.round((b.cost.supplies || 0) * mult),
    manpower: Math.round((b.cost.manpower || 0) * mult),
    fuel: Math.round((b.cost.fuel || 0) * mult),
  };
}

export function startBuilding(state, pid, type) {
  const ps = state.provinces[pid];
  if (!ps) return false;
  const p = S.provinces.get(pid);
  if (!p || p.isSea) return false;
  // el puerto exige costa: provincia con salida a celda de mar
  if (type === "puerto" && !(S.edges.get(pid) || []).some((e) => S.provinces.get(e.to)?.isSea)) return false;
  const level = ps.buildings[type] || 0;
  if (level >= C.BUILDINGS[type].max) return false;
  const cost = buildingCost(type, level);
  if (!pay(state, ps.owner, cost)) return false;
  ps.queue = { kind: "building", type, minutesLeft: C.BUILDINGS[type].minutes, total: C.BUILDINGS[type].minutes };
  return true;
}

// ¿Puede este país reclutar esta variante aquí? Devuelve null o un motivo de bloqueo
export function recruitBlocker(state, pid, unitType) {
  const ps = state.provinces[pid];
  const p = S.provinces.get(pid);
  if (!ps || !p || p.isSea) return "provincia";
  const u = unitDef(unitType);
  if (!u) return "desconocida";
  const c = state.countries[ps.owner];
  if (u.doctrine && u.doctrine !== c.doctrine) return "doctrina";
  if ((u.tier ?? 1) > (c.researchedTier ?? 1)) return "investigación";
  if (u.air && (ps.buildings.aerobase || 0) < (u.tier ?? 1)) return "base aérea";
  if (isNaval(unitType)) {
    if ((ps.buildings.puerto || 0) < (u.minPortLevel ?? 1)) return "puerto";
    if (!(S.edges.get(pid) || []).some((e) => S.provinces.get(e.to)?.isSea)) return "costa";
  }
  return null;
}

export function startRecruit(state, pid, unitType) {
  const ps = state.provinces[pid];
  if (!ps) return false;
  const blocker = recruitBlocker(state, pid, unitType);
  if (blocker) return false;
  const u = unitDef(unitType);
  if (!pay(state, ps.owner, u.cost)) return false;
  if (isNaval(unitType)) {
    const seaEdge = (S.edges.get(pid) || []).find((e) => S.provinces.get(e.to)?.isSea);
    ps.queue = { kind: "naval", type: unitType, minutesLeft: u.buildHours * 60, total: u.buildHours * 60, seaCell: seaEdge.to };
  } else {
    ps.queue = { kind: "unit", type: unitType, minutesLeft: u.buildHours * 60, total: u.buildHours * 60 };
  }
  return true;
}

// Recluta por categoría eligiendo variante (para la IA): respeta requisitos
export function startRecruitCategory(state, pid, category) {
  const ps = state.provinces[pid];
  if (!ps) return false;
  const viable = availableVariants(state, ps.owner, category).filter((u) => !recruitBlocker(state, pid, u.id));
  if (!viable.length) return false;
  const def = Math.random() < 0.7 ? viable[viable.length - 1] : viable[Math.floor(Math.random() * viable.length)];
  return startRecruit(state, pid, def.id);
}

export function startAnnex(state, pid) {
  const ps = state.provinces[pid];
  if (!ps || !ps.occupier || ps.occupier !== state.player || ps.owner === state.player) return false;
  if (ps.queue) return false;
  const cost = { money: C.ANNEX_COST(S.provinces.get(pid).pop) };
  if (!pay(state, state.player, cost)) return false;
  ps.queue = { kind: "annex", minutesLeft: C.ANNEX_DAYS, total: C.ANNEX_DAYS };
  return true;
}

// Investigación: un proyecto por país, tiers secuenciales
export function startResearch(state, iso, tierId) {
  const c = state.countries[iso];
  if (c.researchQueue || tierId !== (c.researchedTier ?? 1) + 1) return false;
  const tier = TIERS.find((t) => t.id === tierId);
  if (!tier) return false;
  if (!pay(state, iso, tier.researchCost)) return false;
  c.researchQueue = { tier: tierId, minutesLeft: tier.researchDays * 1440, total: tier.researchDays * 1440 };
  log(state, `Investigación iniciada: ${tier.name} (${S.countries[iso].name})`, "info");
  return true;
}

export function tickResearch(state, dt) {
  for (const iso in state.countries) {
    const c = state.countries[iso];
    if (!c.researchQueue) continue;
    c.researchQueue.minutesLeft -= dt;
    if (c.researchQueue.minutesLeft <= 0) {
      c.researchedTier = c.researchQueue.tier;
      const tier = TIERS.find((t) => t.id === c.researchedTier);
      log(state, `${S.countries[iso].name} completa la investigación: ${tier?.name ?? c.researchedTier}`, "good");
      c.researchQueue = null;
    }
  }
}

export function tickQueues(state, dt) {
  for (const p of S.provinceList) {
    if (p.isSea) continue;
    const ps = state.provinces[p.id];
    if (!ps.queue) continue;
    ps.queue.minutesLeft -= dt;
    if (ps.queue.minutesLeft > 0) continue;

    const q = ps.queue;
    ps.queue = null;
    if (q.kind === "unit") {
      spawnUnit(state, ps.owner, q.type, p.id, 50);
      log(state, `${unitDef(q.type)?.name ?? q.type} movilizado en ${p.name}`, "info");
    } else if (q.kind === "naval") {
      spawnUnit(state, ps.owner, q.type, q.seaCell, 50);
      log(state, `${unitDef(q.type)?.name ?? q.type} botado en ${p.name}`, "info");
    } else if (q.kind === "building") {
      ps.buildings[q.type] = (ps.buildings[q.type] || 0) + 1;
      log(state, `Construcción finalizada: ${C.BUILDINGS[q.type].name} (nivel ${ps.buildings[q.type]}) en ${p.name}`, "good");
    } else if (q.kind === "annex") {
      const oldOwner = ps.owner;
      ps.owner = ps.occupier;
      ps.occupier = null;
      log(state, `${S.countries[ps.owner].name} anexiona ${p.name}`, "info");
      checkElimination(state, oldOwner);
    }
  }
}

export function attritionTick(state) {
  for (const u of state.units) {
    const c = state.countries[u.owner];
    if (!c || c.eliminated || !c.shortSupplies) continue;
    u.hp -= C.ATTRITION_HP;
    u.morale = Math.max(0, u.morale - C.ATTRITION_MORALE / 100);
    if (u.hp <= 0) {
      state.stats.lost[u.owner] = (state.stats.lost[u.owner] || 0) + 1;
      u.dead = true; // filtrado en sim.js
    }
  }
}

// Recuperación de HP y moral fuera de combate, en territorio controlado por el dueño
export function regenTick(state) {
  const battles = battleSet(state);
  for (const u of state.units) {
    if (battles.has(u.pos) || u.edgeLeft || u.embarked) continue;
    const ps = state.provinces[u.pos];
    if (ps) {
      const p = S.provinces.get(u.pos);
      if (!controller(ps) || controller(ps) !== u.owner) continue;
    } else {
      // celda de mar: recupera igualmente (regreso a puerto lo arregla de todas formas)
      if (u.morale < 1) u.morale = Math.min(1, u.morale + C.MORALE_REGEN_PER_H * 6);
      continue;
    }
    if (u.hp < 100) u.hp = Math.min(100, u.hp + 1.5);
    if (u.morale < 1) u.morale = Math.min(1, u.morale + C.MORALE_REGEN_PER_H * 6);
  }
}
