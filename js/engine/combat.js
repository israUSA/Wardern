// Combate: batallas por provincia, daño, moral, veteranía, retiradas, captura y eliminación.
import * as C from "../data/constants.js";
import { S, unitDef, controller, atWar, log, checkElimination } from "./state.js";
import { edgeMinutes } from "./movement.js";
import { MISSILES } from "../data/missiles-data.js";

// Nivel de veteranía 0-3 según la experiencia acumulada
export function vetLevel(u) {
  let lv = 0;
  for (const th of C.VET_LEVELS) if ((u.exp || 0) >= th) lv++;
  return lv;
}

// Provincias con unidades de países en guerra (para el motor y el render)
export function battleSet(state) {
  const byProv = groupByProvince(state);
  const out = new Set();
  for (const [pid, units] of byProv) {
    const owners = [...new Set(units.map((u) => u.owner))];
    for (let i = 0; i < owners.length && !out.has(pid); i++)
      for (let j = i + 1; j < owners.length; j++)
        if (atWar(state, owners[i], owners[j])) {
          out.add(pid);
          break;
        }
  }
  return out;
}

function groupByProvince(state) {
  const byProv = new Map();
  for (const u of state.units) {
    if (u.embarked) continue; // las unidades embarcadas no combaten
    // los drones de reconocimiento no combaten: sobrevuelan territorio enemigo
    if (unitDef(u.type)?.category === "drone") continue;
    let a = byProv.get(u.pos);
    if (!a) byProv.set(u.pos, (a = []));
    a.push(u);
  }
  return byProv;
}

export function tickCombat(state, dt) {
  const byProv = groupByProvince(state);
  const dead = new Set();

  for (const [pid, units] of byProv) {
    const prov = S.provinces.get(pid);
    const ps = state.provinces[pid]; // undefined en celdas de mar
    const fighting = units.filter((u) => !u.edgeLeft); // las que viajan no combaten
    const owners = [...new Set(fighting.map((u) => u.owner))];
    const isBattle = owners.some((a, i) => owners.some((b, j) => i !== j && atWar(state, a, b)));

    if (!isBattle) {
      for (const u of units) {
        u.battleMinutes = 0;
        u.dmgInPerH = 0;
        u.dmgOutPerH = 0;
      }
      continue;
    }

    for (const u of fighting) u.battleMinutes = (u.battleMinutes || 0) + dt;

    // Log al comenzar una batalla (todos los presentes acaban de sumar su primer dt)
    if (fighting.every((u) => u.battleMinutes <= dt + 1e-9)) {
      log(state, `Batalla en ${prov.isSea ? "alta mar" : prov.name}`, "war");
    }

    const overstack =
      fighting.length > C.OVERSTACK_FREE
        ? Math.max(0.4, 1 - C.OVERSTACK_PENALTY * (fighting.length - C.OVERSTACK_FREE))
        : 1;

    const dmgMap = new Map();  // daño RECIBIDO por unidad en este paso
    const outMap = new Map();  // daño INFLIGIDO por unidad en este paso
    for (const u of fighting) {
      if (dead.has(u.id)) continue;
      const enemies = fighting.filter((e) => e.owner !== u.owner && atWar(state, u.owner, e.owner) && !dead.has(e.id));
      if (!enemies.length) continue;

      let target;
      // Las matrices attack/defense están indexadas por CATEGORÍA (10 terrestres/aéreas
      // + 6 navales), no por id de variante: se normaliza el id a su categoría
      // (las ids legacy ya son categorías, así que no cambian nada para ellas).
      if (Math.random() < 0.65) {
        target = enemies.reduce(
          (best, e) => {
            const ae = unitDef(e.type)?.category || e.type;
            const ab = unitDef(best.type)?.category || best.type;
            return ((unitDef(u.type)?.attack[ae] || 0) > (unitDef(u.type)?.attack[ab] || 0) ? e : best);
          },
          enemies[0]
        );
      } else {
        target = enemies[Math.floor(Math.random() * enemies.length)];
      }

      const A = unitDef(u.type);
      const T = unitDef(target.type);
      const atkKey = A.category || u.type;
      const tgtKey = T.category || target.type;
      const atkPen = A.terrainAtkPenalty?.[prov.terrain] ?? 1;
      const defBonus = T.terrainDefBonus?.[prov.terrain] ?? 1;
      const fortLevel = ps?.buildings?.fortaleza || 0;
      const fort = controller(ps) === target.owner ? 1 + C.FORT_DEF_PER_LEVEL * fortLevel : 1;
      // `rangedTicks` de units-data está en TICKS DE REFERENCIA (12 para la
      // artillería). Se convierte a minutos de juego con COMBAT_REF_MINUTES para
      // que el bombardeo preparatorio dure lo mismo en tiempo de JUEGO aunque
      // cambie el reloj, sin tener que reescribir las 96 fichas de unidad.
      const prepMin = (A.rangedTicks || 0) * C.COMBAT_REF_MINUTES;
      const prep = prepMin && u.battleMinutes <= prepMin ? C.ARTILLERY_PREP_MULT : 1;

      const vetA = 1 + vetLevel(u) * C.VET_BONUS_PER_LEVEL;
      const vetT = 1 + vetLevel(target) * C.VET_BONUS_PER_LEVEL;
      const defVal = T.defense[atkKey] * defBonus * fort * vetT;
      let atkVal = A.attack[tgtKey] || 0; // sin clave = no puede dañar (p.ej. tierra vs barco)
      // Hellfire (docs/MISSILES.md §3): helicóptero t2/t3 suma ataque pasivo contra blindados
      if (atkKey === "helicoptero" && MISSILES.hellfire.clasesBlanco.includes(tgtKey)) {
        const t = Math.min(A.tier ?? 1, 3);
        if (t >= MISSILES.hellfire.tierRequerido) atkVal += MISSILES.hellfire.bonusAtaque[t];
      }
      let dmg =
        atkVal *
        (u.hp / 100) *
        u.morale *
        atkPen *
        prep *
        overstack *
        vetA *
        C.COMBAT_SCALE;
      dmg *= C.DEF_SOFTENER / (C.DEF_SOFTENER + defVal);
      // El daño va por TIEMPO DE JUEGO, no por tick. Antes era por tick: el
      // combate corría a 4 rondas por segundo real pasara lo que pasara con el
      // reloj, así que cada vez que se tocaba MINUTES_PER_TICK_BASE el combate
      // cambiaba de velocidad respecto a todo lo demás sin que se notara (pasó
      // al bajar de 15 a 6: se volvió 2,5× más rápido que el movimiento).
      // Anclado a COMBAT_REF_MINUTES, el balance de combate queda expresado en
      // minutos de juego y es inmune a cualquier cambio de reloj o de tick.
      dmg *= dt / C.COMBAT_REF_MINUTES;

      // Experiencia por daño infligido (solo si sobrevive la unidad)
      if (u.hp > 0) u.exp = Math.min(C.VET_EXP_MAX, (u.exp || 0) + dmg * C.VET_EXP_PER_DAMAGE);

      dmgMap.set(target, (dmgMap.get(target) || 0) + dmg);
      outMap.set(u, (outMap.get(u) || 0) + dmg);
    }

    // Ritmo del combate en HP por HORA de juego, para la ficha de unidad. Se
    // MIDE lo que acaba de pasar en vez de rehacer la fórmula en la interfaz:
    // una segunda copia del cálculo se separaría de esta a la primera de cambio.
    // Media móvil porque el blanco se elige AL AZAR en cada paso: la cifra cruda
    // saltaba entre 0 y el pico cuatro veces por segundo y el "cae en" de la
    // ficha parpadeaba. Con 0,85 se asienta en kilo y medio de segundo real.
    for (const u of fighting) {
      const suave = (prev, v) => (prev || 0) * 0.85 + v * 0.15;
      u.dmgInPerH = suave(u.dmgInPerH, ((dmgMap.get(u) || 0) / dt) * 60);
      u.dmgOutPerH = suave(u.dmgOutPerH, ((outMap.get(u) || 0) / dt) * 60);
    }

    for (const [u, dmg] of dmgMap) {
      u.hp -= dmg;
      u.morale = Math.max(0, u.morale - dmg * C.MORALE_HIT);
      if (u.hp <= 0 && !dead.has(u.id)) {
        dead.add(u.id);
        state.stats.lost[u.owner] = (state.stats.lost[u.owner] || 0) + 1;
        // Sin esto, perder una unidad en combate no dejaba NINGUNA marca: se
        // avisaba de la retirada y de la rendición, pero no de la destrucción,
        // que es justo el desenlace que hay que ver.
        log(state, `${unitDef(u.type)?.name} de ${S.countries[u.owner].name} DESTRUIDA en ${prov.isSea ? "alta mar" : prov.name}`, "war");
      }
    }

    // Retiradas
    for (const u of fighting) {
      if (dead.has(u.id) || u.edgeLeft) continue;
      const stillFighting = fighting.some(
        (e) => e.owner !== u.owner && atWar(state, u.owner, e.owner) && !dead.has(e.id)
      );
      if (!stillFighting) continue;
      if (u.hp < C.RETREAT_HP || u.morale < C.RETREAT_MORALE) {
        const dest = retreatDest(state, u, pid);
        if (dest) {
          const e = (S.edges.get(pid) || []).find((x) => x.to === dest);
          const total =
            edgeMinutes(u.type, prov, S.provinces.get(dest), !!e?.strait) / C.RETREAT_SPEED_MULT;
          u.edgeLeft = { to: dest, strait: !!e?.strait, minutesLeft: total, total };
          u.path = [dest];
          u.battleMinutes = 0;
          log(state, `${unitDef(u.type)?.name} de ${S.countries[u.owner].name} se retira de ${prov.isSea ? "alta mar" : prov.name}`, "war");
        } else {
          dead.add(u.id); // sin retirada: se rinde
          state.stats.lost[u.owner] = (state.stats.lost[u.owner] || 0) + 1;
          log(state, `${unitDef(u.type)?.name} de ${S.countries[u.owner].name} se rinde en ${prov.isSea ? "alta mar" : prov.name}`, "war");
        }
      }
    }
  }

  if (dead.size) {
    // El hundimiento de un transporte se lleva su carga
    for (const u of [...dead].map((id) => state.units.find((x) => x.id === id))) {
      if (u && u.cargo?.length) {
        for (const cid of u.cargo) {
          const c = state.units.find((x) => x.id === cid);
          if (c) {
            c.dead = true;
            dead.add(c.id);
            state.stats.lost[c.owner] = (state.stats.lost[c.owner] || 0) + 1;
          }
        }
        u.cargo = [];
      }
    }
    state.units = state.units.filter((u) => !dead.has(u.id));
  }

  // Captura de provincias (nunca en el mar)
  for (const [pid, units] of byProv) {
    const ps = state.provinces[pid];
    if (!ps) continue;
    const alive = units.filter((u) => !dead.has(u.id) && !u.edgeLeft);
    if (!alive.length) continue;
    const ctrlOwner = controller(ps);
    if (alive.every((u) => atWar(state, ctrlOwner, u.owner))) {
      const capturer = alive.find((u) => unitDef(u.type)?.captures);
      if (capturer) captureProvince(state, pid, capturer.owner);
    }
  }
}

function captureProvince(state, pid, iso) {
  const ps = state.provinces[pid];
  if (controller(ps) === iso) return;
  const prevCtrl = controller(ps);
  ps.occupier = iso;
  state.stats.taken[iso] = (state.stats.taken[iso] || 0) + 1;
  log(state, `${S.countries[iso].name} ocupa ${S.provinces.get(pid).name}`, "war");
  for (const u of state.units) if (u.pos === pid) u.battleMinutes = 0;
  if (prevCtrl !== ps.owner) checkElimination(state, prevCtrl);
  checkElimination(state, ps.owner);
}

function retreatDest(state, u, pid) {
  const opts = (S.edges.get(pid) || [])
    .map((e) => S.provinces.get(e.to))
    .filter((p) => {
      if (p.isSea) return isNavalLike(u);
      const ctrl = controller(state.provinces[p.id]);
      // retirada solo a territorio propio o enemigo (nunca a neutrales)
      return ctrl === u.owner || atWar(state, u.owner, ctrl);
    });
  if (!opts.length) return null;
  let best = opts[0], bestN = Infinity;
  for (const p of opts) {
    const n = state.units.filter((x) => x.pos === p.id).length;
    if (n < bestN) { bestN = n; best = p; }
  }
  return best.id;
}

import { isNaval } from "./state.js";
function isNavalLike(u) {
  return isNaval(u.type);
}
