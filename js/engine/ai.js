// IA de países bot: economía, operaciones militares y diplomacia.
import * as C from "../data/constants.js";
import { UNITS } from "../data/units-data.js";
import { S, unitDef, isNaval, controller, atWar, unitsIn, armyPower, controlledCount, declareWar, makePeace, gameDay, availableVariants, TIERS, distKm, difficulty, intelFor, hpFrac, personalityOf } from "./state.js";
import { startBuilding, startRecruitCategory, startResearch, startAnnex, canAfford, buildingCost } from "./economy.js";
import { orderMove, findPath } from "./movement.js";
import { battleSet } from "./combat.js";
import { strikeWeaponsFor, launchMissile } from "./missiles.js";
import { canShell, shellUnit, artilleryRange, shellDistance } from "./artillery.js";
import { aiAirCombat } from "./air-combat.js";
import { aiNaval, aiNavalRecruit, navalBase, wantedPortLevel, buyShortfall } from "./ai-naval.js";
import { aiLanding, landingUnitIds, seaNeighbors } from "./ai-landing.js";

export function aiTickAll(state) {
  const battles = battleSet(state);
  for (const iso in state.countries) {
    const c = state.countries[iso];
    if (iso === state.player || c.eliminated) continue;
    try {
      const vis = intelFor(state, iso); // su niebla de guerra, la misma que la tuya
      // Primero se dispara y luego se gasta. aiEconomy deja los suministros a
      // cero en cada turno, y la salva de obús se paga en suministros: con el
      // fuego detrás, la artillería de los bots no tenía munición casi nunca.
      aiMissiles(state, iso, vis);
      aiAirCombat(state, iso); // docs/AIR-COMBAT.md: mismas reglas que el jugador
      aiEconomy(state, iso, vis);
      aiResearch(state, iso);
      aiLanding(state, iso, vis, personalityOf(state, iso), battles); // antes: marca su tropa
      aiMilitary(state, iso, battles, vis);
      aiNaval(state, iso, vis, personalityOf(state, iso), battles); // docs/IA.md §Marina
      aiDiplomacy(state, iso, vis);
    } catch (e) {
      console.error("IA error:", iso, e);
    }
  }
}

// ---------- Economía ----------

function aiEconomy(state, iso, vis) {
  const c = state.countries[iso];
  const r = c.resources;
  const P = personalityOf(state, iso);
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

  const base = navalBase(state, iso);
  const portLevel = wantedPortLevel(state, iso, P);
  for (const p of own) {
    const ps = state.provinces[p.id];
    if (ps.queue) continue;
    const coastal = (S.edges.get(p.id) || []).some((e) => S.provinces.get(e.to)?.isSea);
    // Puerto: uno solo, en su base naval, al nivel que pida su carácter. Cuanto
    // más marino, antes se lo permite (umbral de caja más bajo). Para el
    // almirante va lo PRIMERO de la lista: su base suele ser la capital, que es
    // la provincia con más obras, y detrás de la industria y la fortaleza el
    // puerto no llegaba a empezarse (medido: 1 barco en 8 días).
    const quierePuerto =
      coastal && p.id === base?.id && ps.buildings.puerto < portLevel && r.money > 60000 * (1 - P.navy);
    if (quierePuerto && P.navy >= C.AI_NAVY_PRIORITY) {
      // El almirante compra los suministros que falten para la obra: sin
      // puerto no hay marina, y es lo primero que se le acaba a un bot.
      buyShortfall(state, iso, buildingCost("puerto", ps.buildings.puerto));
      if (startBuilding(state, p.id, "puerto")) continue;
    }
    if (r.supplies < upkeepPerH * 48 && ps.buildings.industria < C.BUILDINGS.industria.max) {
      if (startBuilding(state, p.id, "industria")) continue;
    }
    if (r.manpower < 800 && ps.buildings.reclutamiento < C.BUILDINGS.reclutamiento.max) {
      if (startBuilding(state, p.id, "reclutamiento")) continue;
    }
    // El industrial sube industria antes que nada que no sea urgente
    if (P.industry > 1 && ps.buildings.industria < P.industry && r.money > 25000) {
      if (startBuilding(state, p.id, "industria")) continue;
    }
    if (!hasAir && ps.buildings.industria >= 1 && r.money > 30000 && ps.buildings.aerobase < 1) {
      if (startBuilding(state, p.id, "aerobase")) { hasAir = true; continue; }
    }
    if (quierePuerto) {
      if (startBuilding(state, p.id, "puerto")) continue;
    }
    if (c.wars.length && isBorder(state, p.id, iso, false) && ps.buildings.fortaleza < P.fortWar) {
      if (startBuilding(state, p.id, "fortaleza")) continue;
    }
    // La tortuga fortifica la raya también en paz: no espera a que le ataquen
    if (P.fortPeace && ps.buildings.fortaleza < P.fortPeace && foreignBorder(state, p.id, iso)) {
      if (startBuilding(state, p.id, "fortaleza")) continue;
    }
    if (ps.buildings.industria < 1) {
      if (startBuilding(state, p.id, "industria")) continue;
    }
    if (ps.buildings.fortaleza < 1 && (p.capital || units.length > 10)) {
      startBuilding(state, p.id, "fortaleza");
    }
  }

  // Anexión de lo conquistado: sin esto la IA se quedaba para siempre con el 25 %
  // de producción de las provincias ocupadas. Guarda el doble del coste para no
  // dejar la tesorería a cero cuando aún hay guerra que pagar.
  for (const p of S.provinceList) {
    if (p.isSea) continue;
    const ps = state.provinces[p.id];
    if (ps.occupier !== iso || ps.owner === iso || ps.queue) continue;
    if (r.money > C.ANNEX_COST(p.pop) * 2) startAnnex(state, p.id, iso);
  }

  // Reclutamiento: mantener un ejército objetivo (elige variantes de su doctrina).
  // Se reclutan varias unidades por chequeo, en varias provincias a la vez: con
  // una sola por país, un bot de 30 provincias reclutaba igual que uno de 1 y el
  // jugador (que sí recluta en todas) lo desbordaba sin esfuerzo.
  const target = Math.round(
    c.wars.length ? (own.length * 2 + 6) * P.armyWar : own.length * 2 * P.armyPeace
  );
  const queued = own.reduce((n, p) => n + (state.provinces[p.id].recruits?.length || 0), 0);
  let slots = Math.min(C.AI_RECRUITS_PER_CHECK(own.length), target - units.length - queued);
  if (slots > 0) {
    const cands = own.sort(
      (a, b) =>
        (b.capital ? 1 : 0) - (a.capital ? 1 : 0) || (b.prod.manpower || 0) - (a.prod.manpower || 0)
    );
    const libre = (p) => (state.provinces[p.id].recruits?.length || 0) < C.RECRUIT_SLOTS;
    // Primero la categoría, luego DÓNDE puede hacerse. Antes era al revés: se
    // tomaba la provincia de la lista y, si la categoría era aérea y esa
    // provincia no tenía pista, el fallo cortaba el reclutamiento del chequeo
    // entero aunque sobrara dinero. Eso castigaba justo al bot que más
    // aviación pide. Ahora solo corta la falta de recursos.
    //
    // Y si lo elegido no se puede pagar, el bot AHORRA para eso en vez de
    // gastarse el dinero en lo barato. Sin ahorro, un carro (56k) no salía casi
    // nunca: antes de juntar para él ya se había ido todo en infantería (14k), y
    // el reparto real acababa en un 80 % de fusileros dijera lo que dijera el
    // carácter. El ahorro caduca a los AI_SAVE_CHECKS chequeos para que una
    // elección imposible —sin combustible, sin pista del nivel— no le congele.
    for (; slots > 0; slots--) {
      const guardado = c.aiSaving && c.aiSaving.until > state.time ? c.aiSaving.cat : null;
      const cat = guardado || chooseUnitType(state, iso, vis);
      const aereo = AIR_TYPES.includes(cat);
      const donde = cands.find((p) => libre(p) && (!aereo || state.provinces[p.id].buildings.aerobase > 0));
      if (!donde) { c.aiSaving = null; break; } // gradas llenas o sin pista: no hay nada que ahorrar
      if (startRecruitCategory(state, donde.id, cat)) {
        c.aiSaving = null;
        continue;
      }
      if (!guardado) c.aiSaving = { cat, until: state.time + C.AI_SAVE_CHECKS * C.AI_CHECK_HOURS * 60 };
      break; // sin recursos para más esta vez
    }
  }

  // La flota va aparte, con su propio tope: si compitiera por los mismos
  // turnos, un bot que ya tiene el ejército de tierra que quiere no reclutaría
  // nada, tampoco barcos (medido: EEUU almirante con 649k en caja y 0 barcos).
  aiNavalRecruit(state, iso, P, own.length);
}

// La IA invierte en investigación cuando su economía sobra
function aiResearch(state, iso) {
  const c = state.countries[iso];
  if (c.researchQueue || (c.researchedTier ?? 1) >= 3) return;
  const next = TIERS.find((t) => t.id === (c.researchedTier ?? 1) + 1);
  if (!next) return;
  const colchon = personalityOf(state, iso).research;
  if (c.resources.money > next.researchCost.money * colchon) startResearch(state, iso, next.id);
}

const AIR_TYPES = ["caza", "bombardero", "helicoptero", "drone"];

function chooseUnitType(state, iso, vis) {
  const c = state.countries[iso];
  // (?. por las celdas de mar: no tienen entrada en state.provinces)
  const hasAir = S.provinceList.some(
    (p) => state.provinces[p.id]?.owner === iso && state.provinces[p.id].buildings.aerobase > 0
  );
  // Sin base aérea no puede reclutar aéreos. Encima del reparto de cada
  // situación, el carácter del bot tira de unas categorías y aparta otras; se
  // renormaliza para que los pesos vuelvan a sumar 1 (antes, al quitar los
  // aéreos, la probabilidad sobrante caía siempre en la primera entrada).
  const P = personalityOf(state, iso);
  const ok = (pairs) => {
    const out = pairs
      .filter(([t]) => hasAir || !AIR_TYPES.includes(t))
      .map(([t, w]) => [t, w * (P.mix[t] ?? 1)]);
    const total = out.reduce((a, [, w]) => a + w, 0) || 1;
    return out.map(([t, w]) => [t, w / total]);
  };

  // Contramedidas por la OBRA vista. Los edificios no se ocultan —son obra
  // pública, visible por satélite y por prensa— así que es lo único del enemigo
  // que un bot conoce sin haberlo pisado. Reacciona con un dado, no siempre: si
  // respondiera al 100 % sería un espejo de lo que construyes y te bastaría con
  // fintar una base aérea para vaciarle la fábrica de tanques.
  if (c.wars.length && Math.random() < P.counter) {
    const obra = enemyBuildings(state, iso);
    if (obra.aerobase >= 2) {
      return weighted(ok([["antiaereo", 0.45], ["caza", 0.2], ["infanteria", 0.25], ["mbt", 0.1]]));
    }
    if (obra.fortaleza >= 3) {
      return weighted(ok([["artilleria", 0.45], ["mbt", 0.2], ["infanteria", 0.25], ["bombardero", 0.1]]));
    }
  }

  // Composición enemiga, SOLO con lo que ha detectado. Antes se recorría
  // state.units entero: un bot sabía cuántos cazas tenías aunque no hubiera
  // pisado tu país en la vida. Ahora hace falta inteligencia FUERTE de la
  // provincia (propia, con tropa suya encima o dentro del círculo de un dron
  // suyo) para identificar el tipo de una unidad; la adyacencia solo da bulto.
  let mbt = 0, air = 0, total = 0;
  for (const u of state.units) {
    if (u.dead || u.embarked || !atWar(state, iso, u.owner)) continue;
    if (!vis.strong.has(u.pos)) continue;
    total++;
    if (unitDef(u.type)?.category === "mbt") mbt++; // por categoría: cuenta variantes doctrina×tier
    if (unitDef(u.type)?.air) air++;
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

// Niveles de edificio de los países con los que está en guerra. Es información
// pública: no pasa por la niebla, a diferencia de las unidades.
function enemyBuildings(state, iso) {
  const out = { aerobase: 0, puerto: 0, fortaleza: 0, industria: 0 };
  for (const p of S.provinceList) {
    if (p.isSea) continue;
    const ps = state.provinces[p.id];
    if (!ps || !atWar(state, iso, controller(ps))) continue;
    for (const k in out) out[k] += ps.buildings[k] || 0;
  }
  return out;
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

// Provincia que toca a otro país, esté o no en guerra con él
function foreignBorder(state, pid, iso) {
  for (const e of S.edges.get(pid) || []) {
    if (e.strait) continue;
    const ctrl = controller(state.provinces[e.to]);
    if (ctrl && ctrl !== iso) return true;
  }
  return false;
}

function inBattle(u, battles) {
  return battles.has(u.pos);
}

function aiMilitary(state, iso, battles, vis) {
  const c = state.countries[iso];
  if (!c.wars.length) return;
  const P = personalityOf(state, iso);

  // Sin barcos: esto es la guerra en tierra. Además un findPath de un barco a
  // una provincia de tierra falla, pero solo después de recorrer las 25.000
  // celdas de mar; con flota, las guarniciones costarían segundos por turno.
  // La flota la mueve aiNaval.
  // Tampoco la tropa embarcada ni la reservada para un desembarco en curso:
  // si no, la guarnición se la llevaba de vuelta a la frontera a medio reunir.
  const reservada = landingUnitIds(state, iso);
  const myUnits = state.units.filter(
    (u) => u.owner === iso && !isNaval(u.type) && !u.embarked && !reservada.has(u.id)
  );

  // Liberar tareas que ya no tienen sentido
  for (const u of myUnits) {
    if (!u.task) continue;
    if (u.task.kind === "defend" && !isBorder(state, u.task.pid, iso)) u.task = null;
    // else: la rama de arriba puede haber dejado la tarea en null. Antes nunca
    // llegaba aquí una `defend` —se perdía al ordenar el movimiento— y el fallo
    // no se veía; con la tarea ya viva, sin el else esto revienta el turno.
    else if (u.task.kind === "attack") {
      const ctrl = controller(state.provinces[u.task.pid]);
      if (!atWar(state, iso, ctrl)) u.task = null;
    }
  }

  // Una pieza con un blanco a tiro está ocupada disparando (aiMissiles): ni
  // guarnece otra provincia ni va al asalto. Si la guarnición la movía antes de
  // que le tocara disparar, la artillería del bot no abría fuego nunca.
  const idle = myUnits.filter(
    (u) => !u.edgeLeft && !u.path.length && !u.task && !inBattle(u, battles) && !artilleryTarget(state, iso, u, vis)
  );

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
      // La tarea se marca DESPUÉS de mover: orderMove borra u.task, así que
      // asignarla antes la perdía siempre. Y como nearestIdle salta a las
      // unidades con tarea, sin esto la misma ficha se repartía entre varias
      // provincias en el mismo turno y solo valía el último destino.
      if (orderMove(state, u, p.id)) u.task = { kind: "defend", pid: p.id };
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
    // La artillería con esa provincia a tiro no va al asalto: dispara desde donde
    // está (aiMissiles). Antes el bot la mandaba a pelear cuerpo a cuerpo y la
    // pieza, en marcha, ya no podía abrir fuego.
    const ready = idle.filter(
      (u) => myAdj.includes(u.pos) && !(canShell(u.type) && shellDistance(state, u, p.id) <= artilleryRange(u.type))
    );
    if (ready.length) candidates.set(p.id, ready);
  }

  for (const [pid, ready] of candidates) {
    const defenders = unitsIn(state, pid).filter((u) => atWar(state, iso, u.owner));
    const powerOf = (list) =>
      list.reduce((s, u) => s + hpFrac(u) * ((unitDef(u.type)?.cost.money || 5000) / 5000), 0);
    const defPower = powerOf(defenders);
    const atkPower = powerOf(ready);

    let send = 0;
    if (!defenders.length) send = 1; // provincia vacía: ocuparla
    else if (atkPower > defPower * P.attackRatio) send = Math.min(4, ready.length);
    if (!send) continue;

    ready.sort((a, b) => (b.hp - a.hp));
    let enviadas = 0;
    for (const u of ready) {
      if (enviadas >= send) break;
      if (u.task) continue; // ya tiene destino de este turno (guarnición u otro asalto)
      if (!orderMove(state, u, pid)) continue;
      u.task = { kind: "attack", pid }; // después de mover, por lo mismo que arriba
      enviadas++;
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

function aiMissiles(state, iso, vis) {
  // Golpes: plataforma anclada con arma lista → mejor blanco enemigo a rango,
  // DENTRO de lo que ve. Antes la IA no sufría niebla y barría el mapa entero
  // buscando el mayor ΣHP: te caían Tomahawks encima de una concentración que
  // ella no tenía forma de conocer. Un edificio de nivel ≥ 2 sigue siendo blanco
  // válido aunque no vea tropas: la obra es pública.
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
        if (!vis.union.has(p.id)) continue; // sin contacto no hay blanco
        if (!p.isSea) {
          const ctrl = controller(state.provinces[p.id]);
          if (!ctrl || !atWar(state, iso, ctrl)) continue;
        }
        const d = distKm([from.cx, from.cy], [p.cx, p.cy]);
        if (d > sw.rangoKm) continue;
        // Con inteligencia débil (solo adyacencia) ve bulto, no fichas: cuenta
        // los HP a la mitad para que priorice lo que sí tiene identificado.
        const fiable = vis.strong.has(p.id) ? 1 : 0.5;
        const hp = state.units
          .filter((x) => x.pos === p.id && !x.embarked && !x.dead && x.owner !== iso && atWar(state, iso, x.owner))
          .reduce((s, x) => s + x.hp, 0) * fiable;
        const bld = p.isSea ? 0 : Math.max(0, ...Object.values(state.provinces[p.id]?.buildings || {}));
        if ((hp >= 150 || bld >= 2) && hp > bestHp) {
          bestHp = hp;
          best = p.id;
        }
      }
      if (best) launchMissile(state, u.id, sw.weapon.id, best);
    }
  }

  // Tiro a distancia de la artillería (js/engine/artillery.js), el mismo que el
  // jugador tiene en ⚔ Atacar. Hasta ahora los bots solo usaban la salva de
  // cohetes: sus obuses no disparaban nunca a distancia y solo servían cuando el
  // enemigo entraba en su provincia. Blanco: la ficha enemiga de tierra más
  // valiosa que tenga IDENTIFICADA (inteligencia fuerte) y a tiro. Sin ver la
  // ficha no se apunta a ella.
  for (const u of state.units) {
    if (u.dead || u.owner !== iso || u.edgeLeft || u.embarked) continue;
    if ((u.artyCd || 0) > 0) continue;
    const blanco = artilleryTarget(state, iso, u, vis);
    if (blanco) shellUnit(state, u, blanco);
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

// Blanco de una pieza de artillería del bot, o null: la ficha enemiga de tierra
// más valiosa que tenga identificada y a tiro. Aunque esté recargando, tener
// blanco la mantiene en su sitio (aiMilitary no la mueve).
function artilleryTarget(state, iso, u, vis) {
  if (!canShell(u.type) || u.embarked) return null;
  const alcance = artilleryRange(u.type);
  let blanco = null;
  let mejor = 0;
  for (const e of state.units) {
    if (e.dead || e.embarked || e.owner === iso || !vis.strong.has(e.pos)) continue;
    if (unitDef(e.type)?.air || isNaval(e.type) || !atWar(state, iso, e.owner)) continue;
    if (shellDistance(state, u, e.pos) > alcance) continue;
    const valor = hpFrac(e) * (unitDef(e.type)?.cost.money || 5000);
    if (valor > mejor) { mejor = valor; blanco = e; }
  }
  return blanco;
}

// ---------- Diplomacia ----------

function aiDiplomacy(state, iso, vis) {
  const c = state.countries[iso];
  const day = gameDay(state);
  const P = personalityOf(state, iso);

  // Buscar paz si la guerra va mal
  for (const enemy of [...c.wars]) {
    const ec = state.countries[enemy];
    if (!ec || ec.eliminated) continue;
    const myPower = armyPower(state, iso); // el suyo sí lo conoce exacto
    const enemyPower = guessPower(state, iso, enemy, vis);
    const startControlled = c.warControlStart?.[enemy] ?? controlledCount(state, iso);
    const losing =
      myPower < enemyPower * P.peacePower || controlledCount(state, iso) < startControlled * P.peaceLand;
    const warDays = day - (c.warStartDay?.[enemy] ?? day);
    const longWar = warDays > P.longWarDays;
    // Una guerra tiene que durar algo antes de que el débil pida la paz: sin este
    // mínimo, el bot declaraba la guerra al vecino pequeño y ese vecino firmaba la
    // paz en el chequeo siguiente (6 h), sin que nadie llegara a moverse.
    if (warDays < 3) continue;

    if (enemy === state.player) {
      if (losing && Math.random() < 0.5 && !state.events.some((e) => e.type === "peace_offer" && e.from === iso)) {
        state.events.push({ type: "peace_offer", from: iso });
      }
    } else if (losing || (longWar && Math.random() < 0.3)) {
      makePeace(state, iso, enemy);
    }
  }

  // Declarar guerra al vecino más débil. La agresión la pone el carácter
  // sorteado (personalities-data.js) y la dificultad la escala.
  const aggression = P.aggression * difficulty(state).aiAggression;
  if (c.wars.length === 0 && day >= Math.max(C.AI_MIN_WAR_DAY, c.nextWarDay ?? 0)) {
    if (Math.random() < aggression * 0.12) {
      // El almirante mira también al otro lado del mar: países con costa a su
      // alcance, a los que solo puede llegar desembarcando.
      const neighbors = P.seaWars
        ? [...new Set([...neighborCountries(state, iso, false), ...seaNeighbors(state, iso)])]
        : neighborCountries(state, iso, false);
      let best = null, bestRatio = 0;
      for (const nb of neighbors) {
        const nbc = state.countries[nb];
        if (!nbc || nbc.eliminated) continue;
        if ((nbc.peaceUntil?.[iso] ?? 0) > day) continue;
        let ratio = armyPower(state, iso) / Math.max(1, guessPower(state, iso, nb, vis));
        // El oportunista ve más débil al que ya está peleando con otro. Las
        // guerras de los demás son públicas: no pasa por la niebla.
        if (nbc.wars.length) ratio *= P.preyOnWar;
        if (ratio >= P.warRatio && ratio > bestRatio) { best = nb; bestRatio = ratio; }
      }
      if (best) {
        declareWar(state, iso, best); // anota inicio y territorio de ambos bandos
        c.nextWarDay = day + C.AI_WAR_COOLDOWN_DAYS + 3;
      } else {
        c.nextWarDay = day + 1;
      }
    } else {
      c.nextWarDay = day + 0.5;
    }
  }
}

// Poder que ESTE país le SUPONE a otro. Nadie puede contar un ejército que no
// ha visto: se suma lo detectado y el resto se extrapola de datos públicos —las
// provincias que controla, a razón de AI_GUESS_PER_PROVINCE unidades— con un
// sesgo fijo por pareja para que unos sobrestimen al vecino y otros lo
// subestimen, y esa opinión no cambie de un chequeo al siguiente.
// Consecuencia buscada: la IA puede equivocarse. Puede declararte la guerra
// creyéndote débil y encontrarse un ejército escondido, o no atreverse contra un
// país vacío. Eso es la niebla haciendo su trabajo.
function guessPower(state, iso, enemy, vis) {
  let visto = 0;
  for (const u of state.units) {
    if (u.dead || u.embarked || u.owner !== enemy) continue;
    if (!vis.union.has(u.pos)) continue;
    visto += hpFrac(u) * ((unitDef(u.type)?.cost.money || 5000) / 5000);
  }
  const publico = controlledCount(state, enemy) * C.AI_GUESS_PER_PROVINCE;
  return Math.max(visto, publico) * guessBias(state, iso, enemy);
}

// Sesgo de inteligencia de iso sobre enemy: se sortea una vez y se guarda, para
// que la opinión sea estable (y viaje en el guardado como cualquier otro dato).
function guessBias(state, iso, enemy) {
  const c = state.countries[iso];
  c.intelBias = c.intelBias || {};
  if (c.intelBias[enemy] == null) {
    const [lo, hi] = C.AI_GUESS_BIAS;
    c.intelBias[enemy] = lo + Math.random() * (hi - lo);
  }
  return c.intelBias[enemy];
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
  // También aquí decide con lo que CREE, no con lo que hay: si has escondido el
  // ejército, la IA puede aceptar una paz que no le hacía falta (o rechazarla).
  const playerPower = guessPower(state, aiIso, state.player, intelFor(state, aiIso));
  const c = state.countries[aiIso];
  const day = gameDay(state);
  const startControlled = c.warControlStart?.[state.player] ?? controlledCount(state, aiIso);
  // Mismos umbrales que cuando es él quien pide la paz, con un poco más de
  // margen: aceptar lo que te ofrecen cuesta menos que pedirlo.
  const P = personalityOf(state, aiIso);
  const losing =
    controlledCount(state, aiIso) < startControlled * Math.min(0.95, P.peaceLand + 0.1) ||
    myPower < playerPower * Math.min(0.95, P.peacePower + 0.2);
  const longWar = day - (c.warStartDay?.[state.player] ?? 0) > P.longWarDays;
  return losing || longWar;
}
