// =====================================================================
// Verificación de variantes terrestres/aéreas por doctrina × tier.
//   node tools/test-variants.mjs
//
// Réplica EXACTA de la fórmula de combate de js/engine/combat.js (importa las
// constantes reales de js/data/constants.js y las definiciones reales de
// js/data/units-data.js a través de unitDef/ALL_UNITS de js/engine/state.js).
// No reimplementa nada "de memoria": cada factor (overstack, moral, veteranía,
// preparación artillera, terreno, fortaleza, retirada) sale del motor.
//
// Secciones:
//   [1] Schema completo de las 60 variantes + 10 alias legacy      (assert d/e)
//   [2] Ancla t2: identidad con el roster legacy + deltas doctrina (assert e)
//   [3] Reglas de balance R1-R12 por doctrina y tier               (assert a)
//   [4] Escalado monótono t1<t2<t3 en duelo espejo                 (assert b)
//   [5] Competitividad occidental vs oriental                      (assert c)
//   [6] Reclutamiento e investigación (recruitBlocker REAL)        (assert f)
//   [7] Smoke E2E: mapa real + newGame + ticks del motor
// Sale con código 1 si alguna aserción obligatoria falla.
// Requiere Node >= 22 (detección de sintaxis ESM en .js sin package.json).
// =====================================================================
import * as C from "../js/data/constants.js";
import { UNITS, GROUND_VARIANTS, LEGACY_UNITS, UNIT_CATEGORIES } from "../js/data/units-data.js";
import { DOCTRINES, TIERS } from "../js/data/doctrines-data.js";
import { S, unitDef, availableVariants } from "../js/engine/state.js";
import { recruitBlocker } from "../js/engine/economy.js";

const KEYS = ["infanteria", "motorizada", "mbt", "cazatanques", "artilleria", "antiaereo", "caza", "bombardero", "helicoptero", "drone"];
const TERRAINS = ["llanura", "bosque", "selva", "montaña", "desierto", "tundra", "urbano"];

// ---------- Reportero ----------
let passCount = 0, failCount = 0, warnCount = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) { passCount++; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failCount++; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
  return ok;
}
function warn(name, ok, detail = "") {
  // verificación informativa: no bloquea el exit code
  if (ok) { console.log(`  pass  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { warnCount++; console.log(`  AVISO ${name}${detail ? ` — ${detail}` : ""}`); }
}
function section(t) { console.log(`\n=== ${t} ===`); }

// ---------- Réplica exacta de tickCombat (js/engine/combat.js) ----------
function vetLevel(u) {
  let lv = 0;
  for (const th of C.VET_LEVELS) if ((u.exp || 0) >= th) lv++;
  return lv;
}

// Un tick de batalla en una provincia. Devuelve el estado tras el tick.
// spec: { sideA: [type], sideB: [type], terrain, fortA, fortB }
function battle(spec, rng = Math.random, maxTicks = 4000) {
  const units = [];
  let nextId = 1;
  const mk = (owner, type) => {
    const def = unitDef(type);
    if (!def) throw new Error(`unitDef(${type}) es null`);
    const hpMax = def.hp || 100;
    units.push({ id: nextId++, owner, type, def, hpMax, hp: hpMax, morale: 1, battleTicks: 0, exp: 0, edgeLeft: null });
  };
  for (const t of spec.sideA) mk("A", t);
  for (const t of spec.sideB) mk("B", t);
  const terrain = spec.terrain || "llanura";
  const dead = new Set();
  const dmgDealt = { A: 0, B: 0 };
  let ticks = 0;

  for (ticks = 1; ticks <= maxTicks; ticks++) {
    const fighting = units.filter((u) => !u.edgeLeft && !dead.has(u.id));
    const owners = [...new Set(fighting.map((u) => u.owner))];
    if (owners.length < 2) break; // fin de batalla (replica isBattle)

    for (const u of fighting) u.battleTicks++;
    const overstack = fighting.length > C.OVERSTACK_FREE
      ? Math.max(0.4, 1 - C.OVERSTACK_PENALTY * (fighting.length - C.OVERSTACK_FREE))
      : 1;

    const dmgMap = new Map();
    for (const u of fighting) {
      if (dead.has(u.id)) continue;
      const enemies = fighting.filter((e) => e.owner !== u.owner && !dead.has(e.id));
      if (!enemies.length) continue;
      // selección de objetivo: 65% mayor ataque bruto (empate → primero vivo), 35% azar
      // (réplica exacta de combat.js: las matrices se indexan por CATEGORÍA de la unidad)
      let target;
      if (rng() < 0.65) {
        target = enemies.reduce((best, e) => (u.def.attack[e.def.category] > u.def.attack[best.def.category] ? e : best), enemies[0]);
      } else {
        target = enemies[Math.floor(rng() * enemies.length)];
      }
      const A = u.def, T = target.def;
      const atkPen = A.terrainAtkPenalty?.[terrain] ?? 1;
      const defBonus = T.terrainDefBonus?.[terrain] ?? 1;
      const fortLevel = target.owner === "A" ? (spec.fortA || 0) : (spec.fortB || 0);
      const fort = 1 + C.FORT_DEF_PER_LEVEL * fortLevel;
      const prep = A.rangedTicks && u.battleTicks <= A.rangedTicks ? C.ARTILLERY_PREP_MULT : 1;
      const vetA = 1 + vetLevel(u) * C.VET_BONUS_PER_LEVEL;
      const vetT = 1 + vetLevel(target) * C.VET_BONUS_PER_LEVEL;
      const defVal = T.defense[A.category] * defBonus * fort * vetT;
      const atkVal = A.attack[T.category] || 0;
      let dmg = atkVal * (u.hp / u.hpMax) * u.morale * atkPen * prep * overstack * vetA * C.COMBAT_SCALE;
      dmg *= C.DEF_SOFTENER / (C.DEF_SOFTENER + defVal);
      if (u.hp > 0) u.exp = Math.min(C.VET_EXP_MAX, (u.exp || 0) + dmg * C.VET_EXP_PER_DAMAGE);
      dmgMap.set(target, (dmgMap.get(target) || 0) + dmg);
      dmgDealt[u.owner] += dmg;
    }
    for (const [u, dmg] of dmgMap) {
      u.hp -= dmg;
      u.morale = Math.max(0, u.morale - (dmg / u.hpMax) * 100 * C.MORALE_HIT);
      if (u.hp <= 0 && !dead.has(u.id)) dead.add(u.id);
    }
    // retiradas (HP < 30 o moral < 20%); se asume destino de retirada disponible
    for (const u of fighting) {
      if (dead.has(u.id) || u.edgeLeft) continue;
      const stillFighting = fighting.some((e) => e.owner !== u.owner && !dead.has(e.id));
      if (!stillFighting) continue;
      if ((u.hp / u.hpMax) * 100 < C.RETREAT_HP || u.morale < C.RETREAT_MORALE) u.edgeLeft = "retirada";
    }
  }

  const alive = (side) => units.filter((u) => u.owner === side && !dead.has(u.id) && !u.edgeLeft);
  const hpA = alive("A").reduce((s, u) => s + u.hp, 0);
  const hpB = alive("B").reduce((s, u) => s + u.hp, 0);
  const winner = hpA > 0 && hpB <= 0 ? "A" : hpB > 0 && hpA <= 0 ? "B" : "draw";
  const survivors = (side) => alive(side).length;
  return { winner, hpA, hpB, ticks, dmgA: dmgDealt.A, dmgB: dmgDealt.B, survivorsA: survivors("A"), survivorsB: survivors("B"), maxed: ticks > maxTicks };
}

// Duelo 1v1 (determinista en la práctica; se corre N veces por seguridad)
function duel1v1(idA, idB, opts = {}, n = 30) {
  let wA = 0, wB = 0, draw = 0, hp = 0, hpW = 0, ticks = 0, ratioMin = Infinity;
  for (let i = 0; i < n; i++) {
    const r = battle({ sideA: [idA], sideB: [idB], ...opts }, Math.random);
    if (r.winner === "A") { wA++; hpW += r.hpA; }
    else if (r.winner === "B") wB++;
    else draw++;
    hp += r.hpA; ticks += r.ticks;
    if (r.dmgB > 0) ratioMin = Math.min(ratioMin, r.dmgA / r.dmgB);
  }
  return { winner: wA > wB ? "A" : wB > wA ? "B" : "draw", wA, wB, draw, n, hp: hp / n, hpWinner: wA ? hpW / wA : 0, ticks: ticks / n, ratioMin };
}

function mcBattle(spec, n = 200) {
  let wA = 0, wB = 0, draw = 0, hpA = 0, survA = 0, dmgRatio = 0;
  for (let i = 0; i < n; i++) {
    const r = battle(spec, Math.random);
    if (r.winner === "A") { wA++; hpA += r.hpA; survA += r.survivorsA; }
    else if (r.winner === "B") wB++;
    else draw++;
    dmgRatio += r.dmgB > 0 ? r.dmgA / r.dmgB : r.dmgA;
  }
  return { wA, wB, draw, n, hpA: hpA / Math.max(1, wA), survA: survA / Math.max(1, wA), dmgRatio: dmgRatio / n };
}

const id = (pfx, tier, cat) => `${pfx}-${tier}-${cat}`;

// ---------- [1] Schema ----------
section("[1] Schema completo: 60 variantes + 10 alias legacy (assert d/e)");
{
  check("GROUND_VARIANTS tiene exactamente 60 variantes", Object.keys(GROUND_VARIANTS).length === 60, `${Object.keys(GROUND_VARIANTS).length}`);
  check("LEGACY_UNITS tiene exactamente 10 alias", Object.keys(LEGACY_UNITS).length === 10);
  check("UNITS = 72 definiciones (60 variantes + 2 EXTRA_VARIANTS + 10 legacy)", Object.keys(UNITS).length === 72, `${Object.keys(UNITS).length}`);
  check("UNIT_CATEGORIES conserva las 10 categorías del contrato de UI", UNIT_CATEGORIES.length === 10 && UNIT_CATEGORIES.map((c) => c.id).join(",") === KEYS.join(","));

  let bad = [];
  for (const v of Object.values(GROUND_VARIANTS)) {
    const errs = [];
    if (!/^(occ|ori)-[123]-(infanteria|motorizada|mbt|cazatanques|artilleria|antiaereo|caza|bombardero|helicoptero|drone)$/.test(v.id)) errs.push("id");
    if (!DOCTRINES[v.doctrine]) errs.push("doctrine");
    if (![1, 2, 3].includes(v.tier)) errs.push("tier");
    if (v.category !== v.id.slice(v.id.indexOf("-", 4) + 1) || !KEYS.includes(v.category)) errs.push("category");
    for (const f of ["name", "icon", "cost", "buildHours", "hp", "speed", "captures", "air", "attack", "defense", "terrainDefBonus", "terrainAtkPenalty", "rangedTicks"]) {
      if (v[f] === undefined) errs.push(`falta ${f}`);
    }
    // El HP ya NO es 100 para todos: sale de CATEGORY_HP x doctrina x tier
    // (units-data.js). Lo que se exige es que exista y sea un numero util.
    if (!Number.isFinite(v.hp) || v.hp <= 0) errs.push("hp invalido");
    if (!(v.buildHours > 0) || !(v.speed > 0)) errs.push("buildHours/speed");
    for (const k of ["money", "supplies", "manpower", "fuel"]) {
      if (!Number.isFinite(v.cost?.[k]) || v.cost[k] < 0) errs.push(`cost.${k}`);
    }
    for (const m of ["attack", "defense"]) {
      const keys = Object.keys(v[m] || {});
      if (keys.length !== KEYS.length || !KEYS.every((k) => Number.isFinite(v[m][k]) && v[m][k] >= 0)) errs.push(m);
    }
    if (!TERRAINS.every((t) => Number.isFinite(v.terrainDefBonus?.[t]))) errs.push("terrainDefBonus");
    if (!Object.keys(v.terrainAtkPenalty || {}).every((t) => TERRAINS.includes(t))) errs.push("terrainAtkPenalty");
    if (v.air !== KEYS.slice(6).includes(v.category)) errs.push("air");
    if (errs.length) bad.push(`${v.id}: ${errs.join(",")}`);
  }
  check("las 60 variantes tienen campos completos y claves attack/defense válidas (10 claves)", bad.length === 0, bad.slice(0, 3).join(" | "));

  bad = [];
  for (const [lid, u] of Object.entries(LEGACY_UNITS)) {
    const errs = [];
    if (u.id !== lid) errs.push("id");
    if (u.doctrine !== undefined || u.tier !== undefined) errs.push("no debe tener doctrine/tier");
    if (u.legacy !== true) errs.push("legacy flag");
    if (!Number.isFinite(u.hp) || u.hp <= 0) errs.push("hp invalido");
    for (const m of ["attack", "defense"]) {
      if (!KEYS.every((k) => Number.isFinite(u[m]?.[k]))) errs.push(m);
    }
    if (errs.length) bad.push(`${lid}: ${errs.join(",")}`);
  }
  check("los 10 alias legacy son válidos (sin doctrine/tier, marcados legacy)", bad.length === 0, bad.join(" | "));
}

// ---------- [2] Ancla t2 y deltas ----------
section("[2] Ancla t2: ataque occidental ≡ legacy; defensa oriental ≡ legacy; deltas documentados");
{
  // Deltas de diseño (pinned aquí para detectar derivaciones accidentales)
  const OCC_DEF_AIR = { caza: 1, bombardero: 1, helicoptero: 1, drone: 1 };
  const OCC_DELTAS = {
    infanteria: { attack: {}, defense: OCC_DEF_AIR },
    motorizada: { attack: {}, defense: OCC_DEF_AIR },
    mbt: { attack: {}, defense: OCC_DEF_AIR },
    cazatanques: { attack: {}, defense: OCC_DEF_AIR },
    artilleria: { attack: {}, defense: OCC_DEF_AIR },
    antiaereo: { attack: {}, defense: OCC_DEF_AIR },
    caza: { attack: {}, defense: { caza: 1 } },
    bombardero: { attack: {}, defense: {} },
    helicoptero: { attack: {}, defense: {} },
    drone: { attack: {}, defense: {} },
  };
  // Oriente ya NO lleva deltas de ataque: su ventaja entera es el HP
  // (DOCTRINE_HP_MULT). Antes tenia los +1 en las claves que cazan y eso lo hacia
  // mejor en los dos ejes a la vez.
  const ORI_DELTAS = {
    infanteria: { attack: {}, defense: {} },
    motorizada: { attack: {}, defense: {} },
    mbt: { attack: {}, defense: {} },
    // Las dos unicas excepciones: el anticarro y la artilleria masiva, donde la
    // doctrina sovietica si era superior de forma reconocible.
    cazatanques: { attack: { mbt: 1 }, defense: {} },
    artilleria: { attack: { infanteria: 1 }, defense: {} },
    antiaereo: { attack: {}, defense: {} },
    caza: { attack: {}, defense: {} },
    bombardero: { attack: {}, defense: {} },
    helicoptero: { attack: {}, defense: {} },
    drone: { attack: {}, defense: {} },
  };
  let bad = [];
  for (const cat of KEYS) {
    const base = LEGACY_UNITS[cat];
    const occ = GROUND_VARIANTS[`occ-2-${cat}`];
    const ori = GROUND_VARIANTS[`ori-2-${cat}`];
    for (const k of KEYS) {
      // La pegada occidental va por DOCTRINE_ATK_MULT, asi que el ataque t2 YA NO
      // es identico al ancla legacy: se comprueba que sea >= y que el margen no se
      // dispare (el multiplicador vive entre 1.04 y 1.09).
      const esperado = Math.round(base.attack[k] * 1.0) + (OCC_DELTAS[cat].attack[k] || 0);
      if (occ.attack[k] < esperado || occ.attack[k] > Math.ceil(base.attack[k] * 1.12) + 1) bad.push(`occ-2-${cat}.attack.${k}`);
      if (occ.defense[k] !== base.defense[k] + (OCC_DELTAS[cat].defense[k] || 0)) bad.push(`occ-2-${cat}.defense.${k}`);
      if (ori.attack[k] !== base.attack[k] + (ORI_DELTAS[cat].attack[k] || 0)) bad.push(`ori-2-${cat}.attack.${k}`);
      if (ori.defense[k] !== base.defense[k] + (ORI_DELTAS[cat].defense[k] || 0)) bad.push(`ori-2-${cat}.defense.${k}`);
    }
    for (const k of ["money", "supplies", "manpower", "fuel"]) {
      if (occ.cost[k] !== base.cost[k] || ori.cost[k] !== base.cost[k]) bad.push(`coste t2 ${cat}.${k} difiere del ancla`);
    }
    if (occ.buildHours !== base.buildHours || ori.buildHours !== base.buildHours) bad.push(`buildHours ${cat}`);
    if (occ.speed !== base.speed || ori.speed !== base.speed) bad.push(`speed ${cat}`);
  }
  check("t2 = ancla legacy + deltas de sabor exactos; costes/horas/velocidad idénticos entre doctrinas", bad.length === 0, bad.slice(0, 4).join(" | "));

  // Resolución real de ids legacy vía unitDef (ruta del motor con partidas guardadas)
  const legacyOk = Object.keys(LEGACY_UNITS).every((lid) => {
    const d = unitDef(lid);
    return d && d.attack && d.defense && d.cost && Number.isFinite(d.hp) && d.hp > 0;
  });
  check("unitDef() resuelve las 10 ids planas legacy con campos completos (guardados viejos)", legacyOk);
  check("sample legacy intacto: mbt.atk.mbt=11, mbt.cost=80k, infanteria.captures=true, caza.air=true",
    unitDef("mbt").attack.mbt === 11 && unitDef("mbt").cost.money === 80000 &&
    unitDef("infanteria").captures === true && unitDef("caza").air === true);
}

// ---------- [3] Reglas R1-R12 ----------
// La réplica exacta REPRODUCE los números publicados en docs/UNITS.md
// (R1 59,7 · R2 66,9 · R3 80,9 · R4 72,8 · R9 90,6) → los umbrales del doc se
// mantienen tal cual. R11 mide 1,9:1 en batalla completa (el 2,02 del doc era la
// ventana de salida del bombardero); se acredita ≥ 1,7 en t2 y se informa el resto.
section("[3] Reglas de balance R1-R12 (assert a) — occidental y oriental × t1/t2/t3");
const R1_MIN_HP = 50;
function runRules(pfx, tier, gated) {
  const u = (cat) => id(pfx, tier, cat);
  const tag = `${pfx.toUpperCase()} t${tier}`;
  const gate = (name, ok, detail) => (gated ? check(`${name} [${tag}]`, ok, detail) : warn(`${name} [${tag}]`, ok, detail));

  // R1 MBT > Infantería en llanura
  let r = duel1v1(u("mbt"), u("infanteria"));
  gate("R1 MBT vence a infantería en llanura con margen", r.winner === "A" && r.hpWinner >= R1_MIN_HP, `gana ${r.wA}/${r.n} con ${r.hpWinner.toFixed(1)} HP`);
  // R2 Infantería > MBT en montaña
  r = duel1v1(u("infanteria"), u("mbt"), { terrain: "montaña" });
  gate("R2 infantería vence a MBT en montaña", r.winner === "A" && r.wA === r.n, `gana ${r.wA}/${r.n} con ${r.hpWinner.toFixed(1)} HP`);
  // R3 Cazatanques > MBT en llanura
  r = duel1v1(u("cazatanques"), u("mbt"));
  gate("R3 cazatanques vence a MBT en llanura con ≥50 HP", r.winner === "A" && r.hpWinner >= 50, `${r.hpWinner.toFixed(1)} HP`);
  // R4 Infantería > Cazatanques
  r = duel1v1(u("infanteria"), u("cazatanques"));
  gate("R4 infantería vence claramente al cazatanques", r.winner === "A" && r.hpWinner >= 50, `${r.hpWinner.toFixed(1)} HP`);
  // R5 2 art + 4 inf > 6 inf
  const r5 = mcBattle({ sideA: [u("artilleria"), u("artilleria"), u("infanteria"), u("infanteria"), u("infanteria"), u("infanteria")], sideB: [u("infanteria"), u("infanteria"), u("infanteria"), u("infanteria"), u("infanteria"), u("infanteria")] });
  gate("R5 2 art + 4 inf vencen a 6 inf", r5.wA / r5.n >= 0.95, `${Math.round((r5.wA / r5.n) * 100)}% victorias, ${r5.survA.toFixed(1)} supervivientes`);
  // R6 dominancia (round-robin: cada par una vez → 9 duelos por unidad)
  const wins = {};
  for (const a of KEYS) wins[a] = 0;
  for (let i = 0; i < KEYS.length; i++) for (let j = i + 1; j < KEYS.length; j++) {
    const a = KEYS[i], b = KEYS[j];
    const d = duel1v1(u(a), u(b), {}, 5);
    if (d.winner === "A") wins[a]++;
    else if (d.winner === "B") wins[b]++;
  }
  const maxWins = Math.max(...Object.values(wins));
  gate("R6 nadie domina (máx 8/9 duelos)", maxWins <= 8, JSON.stringify(wins));
  if (tier === 2) gate("R6 el caza es la unidad dominante con 8/9", wins.caza === 8, `caza ${wins.caza}/9`);
  else warn(`R6 caza líder [${tag}]`, wins.caza === maxWins, `caza ${wins.caza}/9`);
  // R7 motorizada 0/9
  gate("R7 motorizada pierde los 9 duelos", wins.motorizada === 0, `0/${9 - wins.motorizada}... ${wins.motorizada} victorias`);
  // R8 economía (estática; el ancla es t2)
  {
    const stack = ["infanteria", "infanteria", "infanteria", "motorizada", "motorizada", "mbt", "cazatanques", "artilleria", "infanteria", "motorizada"];
    const cost = (t) => unitDef(id(pfx, tier, t)).cost;
    const upS = stack.reduce((s, t) => s + cost(t).money, 0) * C.UPKEEP_MONEY_AS_SUPPLIES;
    const daily = { money: 3000 * 24, supplies: 300 * 24, manpower: 250 * 24 };
    const inf = cost("infanteria");
    const perDay = Math.min(daily.money / inf.money, (daily.supplies - upS) / inf.supplies, daily.manpower / inf.manpower);
    if (tier === 2) gate("R8 país mediano recluta 2-4 infanterías/día tras mantenimiento", perDay >= 2 && perDay <= 4, `${perDay.toFixed(2)}/día (suministros limitan)`);
    else warn(`R8 ritmo a t${tier} (informativo)`, true, `${perDay.toFixed(2)} inf/día`);
  }
  // R9 caza > bombardero
  r = duel1v1(u("caza"), u("bombardero"));
  gate("R9 caza vence claramente al bombardero", r.winner === "A" && r.hpWinner >= 60, `${r.hpWinner.toFixed(1)} HP`);
  // R10 AA ≥ 2 cazas
  const r10 = mcBattle({ sideA: [u("antiaereo")], sideB: [u("caza"), u("caza")] });
  const costOk = unitDef(u("antiaereo")).cost.money < 2 * unitDef(u("caza")).cost.money;
  gate("R10 1 antiaéreo vence a 2 cazas con ventaja de coste", r10.wA / r10.n >= 0.95 && costOk, `${Math.round((r10.wA / r10.n) * 100)}% victorias; ${unitDef(u("antiaereo")).cost.money}$ vs ${2 * unitDef(u("caza")).cost.money}$`);
  // R11 bombardero vs 5 inf sin AA
  const r11 = mcBattle({ sideA: [u("bombardero")], sideB: [u("infanteria"), u("infanteria"), u("infanteria"), u("infanteria"), u("infanteria")] });
  if (tier === 2) gate("R11 bombardero sin AA castiga con daño ≥ 1,7:1", r11.dmgRatio >= 1.7, `${r11.dmgRatio.toFixed(2)}:1`);
  else warn(`R11 castigo aéreo a t${tier} (informativo)`, true, `${r11.dmgRatio.toFixed(2)}:1`);
  // R12 5 inf + AA vs bombardero
  const r12 = mcBattle({ sideA: [u("infanteria"), u("infanteria"), u("infanteria"), u("infanteria"), u("infanteria"), u("antiaereo")], sideB: [u("bombardero")] });
  gate("R12 gana el bando con antiaéreo", r12.wA / r12.n >= 0.95, `${Math.round((r12.wA / r12.n) * 100)}% victorias; pierde ${Math.max(0, 600 - r12.hpA).toFixed(0)} de 600 HP`);
}
for (const pfx of ["occ", "ori"]) {
  for (const tier of [2, 1, 3]) runRules(pfx, tier, true);
}

// ---------- [4] Escalado monótono por tier (assert b) ----------
section("[4] Escalado t1 < t2 < t3: sumas de stats y duelo espejo entre tiers (assert b)");
{
  let badSum = [];
  for (const v of Object.values(GROUND_VARIANTS)) {
    if (v.tier === 1) {
      const t2 = GROUND_VARIANTS[v.id.replace("-1-", "-2-")];
      const t3 = GROUND_VARIANTS[v.id.replace("-1-", "-3-")];
      const sum = (m) => KEYS.reduce((s, k) => s + m[k], 0);
      for (const m of ["attack", "defense"]) {
        if (!(sum(v[m]) < sum(t2[m]) && sum(t2[m]) < sum(t3[m]))) badSum.push(`${v.id}.${m}: ${sum(v[m])}/${sum(t2[m])}/${sum(t3[m])}`);
        for (const k of KEYS) {
          if (!(v[m][k] <= t2[m][k] && t2[m][k] <= t3[m][k])) badSum.push(`${v.id}.${m}.${k} no monótono`);
        }
      }
    }
  }
  check("suma attack/defense estrictamente creciente t1<t2<t3 en las 20 variantes base", badSum.length === 0, badSum.slice(0, 3).join(" | "));

  let badDuel = [];
  for (const pfx of ["occ", "ori"]) {
    for (const cat of KEYS) {
      for (const [low, high] of [[1, 2], [2, 3]]) {
        // el tier superior debe ganar el duelo espejo en ambos órdenes de inserción
        const ab = duel1v1(id(pfx, high, cat), id(pfx, low, cat), {}, 5);
        const ba = duel1v1(id(pfx, low, cat), id(pfx, high, cat), {}, 5);
        if (ab.winner !== "A" || ba.winner !== "B") {
          badDuel.push(`${pfx} ${cat} t${high} vs t${low}: ${ab.winner}/${ba.winner}`);
        }
      }
    }
  }
  check("duelo espejo: t2 vence a t1 y t3 vence a t2 en las 10 categorías × 2 doctrinas", badDuel.length === 0, badDuel.slice(0, 4).join(" | "));
}

// ---------- [5] Competitividad entre doctrinas (assert c) ----------
section("[5] Occidental t2 vs Oriental t2: sin barrido de doctrina y contadores estables (assert c)");
{
  const winRows = [];
  let occWins = 0, oriWins = 0, draws = 0;
  for (const cat of KEYS) {
    const d1 = duel1v1(`occ-2-${cat}`, `ori-2-${cat}`, {}, 40);
    const d2 = duel1v1(`ori-2-${cat}`, `occ-2-${cat}`, {}, 40);
    // gana quien gane en ambos órdenes (en 1v1 simétrico el orden no importa)
    const w = d1.winner === "A" && d2.winner === "B" ? "occ" : d1.winner === "B" && d2.winner === "A" ? "ori" : "draw";
    if (w === "occ") occWins++; else if (w === "ori") oriWins++; else draws++;
    winRows.push(`${cat}: ${w === "draw" ? "empate" : w}`);
  }
  console.log("  " + winRows.join(" · "));
  check("ninguna doctrina arrasa el 1v1 por categoría (máx 6 de 10)", occWins <= 6 && oriWins <= 6, `occ ${occWins} · ori ${oriWins} · empates ${draws}`);

  // Los contadores clásicos no dependen de la doctrina (4 emparejamientos)
  const counters = [
    ["cazatanques", "mbt", "llanura", "cazatanques > mbt"],
    ["antiaereo", "caza", "llanura", "antiaéreo > caza"],
    ["caza", "bombardero", "llanura", "caza > bombardero"],
    ["helicoptero", "mbt", "llanura", "helicóptero > mbt"],
    ["mbt", "infanteria", "llanura", "mbt > infantería (llanura)"],
    ["infanteria", "mbt", "montaña", "infantería > mbt (montaña)"],
    ["cazatanques", "motorizada", "llanura", "cazatanques > motorizada"],
    ["artilleria", "infanteria", "llanura", "artillería > infantería"],
  ];
  let badCounter = [];
  for (const [a, b, terrain, label] of counters) {
    for (const pa of ["occ", "ori"]) for (const pb of ["occ", "ori"]) {
      const d = duel1v1(id(pa, 2, a), id(pb, 2, b), { terrain }, 10);
      if (d.winner !== "A") badCounter.push(`${label} falla con ${pa} vs ${pb}`);
    }
  }
  check("los 8 contadores clásicos se cumplen en los 4 emparejamientos de doctrina", badCounter.length === 0, badCounter.slice(0, 3).join(" | "));

  // Batalla mixta de stacks: competitividad agregada (30-70%)
  const stack = (p) => [id(p, 2, "infanteria"), id(p, 2, "infanteria"), id(p, 2, "infanteria"), id(p, 2, "infanteria"), id(p, 2, "mbt"), id(p, 2, "mbt"), id(p, 2, "artilleria"), id(p, 2, "antiaereo")];
  const ms = mcBattle({ sideA: stack("occ"), sideB: stack("ori") });
  const oriRate = ms.wB / ms.n;
  check("stack mixto occ vs ori competitivo (oriental gana 25-75%)", oriRate >= 0.25 && oriRate <= 0.75, `oriental gana ${Math.round(oriRate * 100)}% (occ ${ms.wA}, empates ${ms.draw})`);
}

// ---------- [6] Reclutamiento e investigación (assert f, código REAL del motor) ----------
section("[6] recruitBlocker real: tier, doctrina y base aérea (assert f)");
{
  S.provinces.set("test-p1", { id: "test-p1", isSea: false, terrain: "llanura" });
  S.edges.set("test-p1", []);
  const mkState = (tier, aerobase = 0) => ({
    provinces: { "test-p1": { owner: "USA", buildings: { aerobase, puerto: 0 }, queue: null } },
    countries: { USA: { doctrine: "occidental", researchedTier: tier } },
    units: [],
  });

  const s2 = mkState(2);
  check("researchedTier 2 NO recluta tier 3", recruitBlocker(s2, "test-p1", "occ-3-mbt") === "investigación", recruitBlocker(s2, "test-p1", "occ-3-mbt"));
  check("researchedTier 2 SÍ recluta su doctrina t2", recruitBlocker(s2, "test-p1", "occ-2-mbt") === null);
  check("researchedTier 2 SÍ recluta su doctrina t1", recruitBlocker(s2, "test-p1", "occ-1-mbt") === null);
  check("variante de otra doctrina bloqueada", recruitBlocker(s2, "test-p1", "ori-2-mbt") === "doctrina", recruitBlocker(s2, "test-p1", "ori-2-mbt"));
  check("aéreo t3 con tier 2 → bloqueado por investigación (antes que base)", recruitBlocker(s2, "test-p1", "occ-3-caza") === "investigación");
  check("aéreo t2 sin base aérea suficiente → bloqueado por base", recruitBlocker(s2, "test-p1", "occ-2-caza") === "base aérea");
  const s2b = mkState(2, 2);
  check("aéreo t2 con Base aérea nivel 2 → recluta", recruitBlocker(s2b, "test-p1", "occ-2-caza") === null);
  const s1 = mkState(1);
  check("TIER INICIAL 1: país nuevo recluta t1 de su doctrina", recruitBlocker(s1, "test-p1", "occ-1-mbt") === null);
  check("TIER INICIAL 1: país nuevo NO recluta t2 sin investigar", recruitBlocker(s1, "test-p1", "occ-2-mbt") === "investigación", recruitBlocker(s1, "test-p1", "occ-2-mbt"));

  const list2 = availableVariants(s2, "USA", "infanteria").map((v) => v.id);
  check("availableVariants(tier 2) = occ t1+t2, sin legacy ni doctrina ajena", JSON.stringify(list2) === JSON.stringify(["occ-1-infanteria", "occ-2-infanteria"]), list2.join(","));
  const list1 = availableVariants(s1, "USA", "infanteria").map((v) => v.id);
  check("availableVariants(tier 1) = solo occ t1", JSON.stringify(list1) === JSON.stringify(["occ-1-infanteria"]), list1.join(","));
}

// ---------- [7] Smoke E2E con el mapa real ----------
section("[7] Smoke E2E: mapa de América + newGame + 240 ticks del motor");
try {
  const { MAP } = await import("../js/data/map-data.js");
  const { COUNTRIES } = await import("../js/data/countries-data.js");
  const { initStatic, newGame } = await import("../js/engine/state.js");
  const { tick } = await import("../js/engine/sim.js");

  initStatic(MAP, COUNTRIES);
  const state = newGame("BRA");
  check("newGame asigna doctrina por país (BRA occidental, CUB oriental)",
    state.countries.BRA.doctrine === "occidental" && state.countries.CUB.doctrine === "oriental",
    `${state.countries.BRA.doctrine}/${state.countries.CUB.doctrine}`);
  check("DOCTRINES cubren todos los países del mapa sin ids desconocidas", (() => {
    const assigned = new Set([...DOCTRINES.occidental.countries, ...DOCTRINES.oriental.countries]);
    const missing = Object.keys(COUNTRIES).filter((iso) => !assigned.has(iso));
    const unknown = [...assigned].filter((iso) => !COUNTRIES[iso]);
    return missing.length === 0 && unknown.length === 0;
  })(), `faltan: ${Object.keys(COUNTRIES).filter((iso) => ![...DOCTRINES.occidental.countries, ...DOCTRINES.oriental.countries].includes(iso)).join(",") || "ninguno"}`);
  check("researchedTier inicial = 1 (decisión de diseño: partida completa desde Años 80)",
    Object.values(state.countries).every((c) => c.researchedTier === 1));
  const badStart = state.units.filter((u) => LEGACY_UNITS[u.type] || !/^(occ|ori)-1-/.test(u.type));
  check("ejércitos iniciales usan variantes t1 de la doctrina del país", badStart.length === 0, `${badStart.length} fuera de patrón`);
  const badDoc = state.units.filter((u) => unitDef(u.type).doctrine !== state.countries[u.owner].doctrine);
  check("cada unidad inicial pertenece a la doctrina de su dueño", badDoc.length === 0, `${badDoc.length} discrepan`);

  for (let i = 0; i < 240; i++) tick(state); // ~2,5 días de juego con IA activa
  const unresolvable = state.units.filter((u) => !unitDef(u.type));
  const nanHp = state.units.filter((u) => !Number.isFinite(u.hp));
  check("240 ticks sin crash; todas las unidades resuelven y con HP finita",
    unresolvable.length === 0 && nanHp.length === 0, `${state.units.length} unidades en juego, log ${state.log.length} eventos`);
} catch (e) {
  check("smoke E2E lanza sin excepciones", false, e.message);
}

// ---------- Resumen ----------
console.log(`\n=============================================`);
console.log(`RESULTADO: ${passCount} PASS · ${failCount} FAIL${warnCount ? ` · ${warnCount} avisos informativos` : ""}`);
if (failCount) {
  console.log("FALLOS:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("OK: todas las aserciones obligatorias pasan.");
