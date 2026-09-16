// =====================================================================
// Banco de pruebas NAVAL de Wardern.
//   node tools/test-naval.mjs
//
// Hermano de tools/test-variants.mjs, que cubre tierra y aire. Este no existía,
// y su ausencia se notó: el abanico de vida por buque (portaviones 450, corbeta
// 90) y la ventaja de doctrina se metieron sin nada que los midiera, y al
// medirlos por fin resultó que Oriente ganaba el 98 % de las batallas de flota
// justo cuando se quería lo contrario.
//
// Réplica EXACTA de la fórmula de combate de js/engine/combat.js: importa las
// constantes reales y las fichas reales, no reimplementa nada de memoria.
//
// Secciones:
//   [1] Schema de las 36 variantes navales
//   [2] Vida: escalado por tier y margen de doctrina
//   [3] Triángulo naval (quién gana a quién)
//   [4] Competitividad entre doctrinas
//   [5] Defensa antiaérea de los buques (NAVAL_AA)
//   [6] Los aviones contra los buques: furtividad e intercepción
//   [7] IA naval: quién recluta barcos, el carácter Almirante y la maniobra
// Sale con código 1 si alguna aserción obligatoria falla.
// =====================================================================
import * as C from "../js/data/constants.js";
import { NAVAL_UNITS, NAVAL_CATEGORIES } from "../js/data/naval-data.js";
import { NAVAL_AA, AIR_WEAPONS, AIR_LOADOUTS } from "../js/data/air-combat-data.js";
import { unitDef } from "../js/engine/state.js";
import { navalAA, navalAAPk } from "../js/engine/air-combat.js";

const CLASES = NAVAL_CATEGORIES.map((c) => c.id);
const SUPERFICIE = ["corbeta", "fragata", "destructor", "portaviones", "transporte"];
const id = (doc, tier, cat) => `${doc}-${tier}-${cat}`;

// ---------- Reportero ----------
let passCount = 0, failCount = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) { passCount++; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failCount++; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
  return ok;
}
function info(name, detail) { console.log(`  ....  ${name}${detail ? ` — ${detail}` : ""}`); }
function section(t) { console.log(`\n=== ${t} ===`); }

// ---------- Réplica de tickCombat (js/engine/combat.js) ----------
function vetLevel(u) {
  let lv = 0;
  for (const th of C.VET_LEVELS) if ((u.exp || 0) >= th) lv++;
  return lv;
}

// El mar no tiene terreno ni fortalezas: la batalla naval es la fórmula desnuda,
// sin bonificadores de provincia. Eso hace el banco naval más limpio que el
// terrestre — lo que mide es el roster, sin ruido.
function battle(sideA, sideB, maxTicks = 8000) {
  const units = [];
  let nid = 1;
  const mk = (owner, type) => {
    const def = unitDef(type);
    if (!def) throw new Error(`unitDef(${type}) es null`);
    const hpMax = def.hp || 100;
    units.push({ id: nid++, owner, type, def, hpMax, hp: hpMax, morale: 1, exp: 0, fuera: null });
  };
  sideA.forEach((t) => mk("A", t));
  sideB.forEach((t) => mk("B", t));
  const dead = new Set();
  let ticks = 0;

  for (ticks = 1; ticks <= maxTicks; ticks++) {
    const fighting = units.filter((u) => !u.fuera && !dead.has(u.id));
    if (new Set(fighting.map((u) => u.owner)).size < 2) break;
    const overstack = fighting.length > C.OVERSTACK_FREE
      ? Math.max(0.4, 1 - C.OVERSTACK_PENALTY * (fighting.length - C.OVERSTACK_FREE))
      : 1;

    const dmgMap = new Map();
    for (const u of fighting) {
      if (dead.has(u.id)) continue;
      const enemies = fighting.filter((e) => e.owner !== u.owner && !dead.has(e.id));
      if (!enemies.length) continue;
      const target = Math.random() < 0.65
        ? enemies.reduce((b, e) => (u.def.attack[e.def.category] > u.def.attack[b.def.category] ? e : b), enemies[0])
        : enemies[Math.floor(Math.random() * enemies.length)];
      const A = u.def, T = target.def;
      const defVal = T.defense[A.category] * (1 + vetLevel(target) * C.VET_BONUS_PER_LEVEL);
      let dmg = (A.attack[T.category] || 0) * (u.hp / u.hpMax) * u.morale * overstack
        * (1 + vetLevel(u) * C.VET_BONUS_PER_LEVEL) * C.COMBAT_SCALE;
      dmg *= C.DEF_SOFTENER / (C.DEF_SOFTENER + defVal);
      if (u.hp > 0) u.exp = Math.min(C.VET_EXP_MAX, (u.exp || 0) + dmg * C.VET_EXP_PER_DAMAGE);
      dmgMap.set(target, (dmgMap.get(target) || 0) + dmg);
    }
    for (const [u, dmg] of dmgMap) {
      u.hp -= dmg;
      u.morale = Math.max(0, u.morale - (dmg / u.hpMax) * 100 * C.MORALE_HIT);
      if (u.hp <= 0) dead.add(u.id);
    }
    for (const u of fighting) {
      if (dead.has(u.id) || u.fuera) continue;
      if (!fighting.some((e) => e.owner !== u.owner && !dead.has(e.id))) continue;
      if ((u.hp / u.hpMax) * 100 < C.RETREAT_HP || u.morale < C.RETREAT_MORALE) u.fuera = "retirada";
    }
  }

  const vivos = (s) => units.filter((u) => u.owner === s && !dead.has(u.id) && !u.fuera);
  // Vida final en PORCENTAJE medio: con un abanico de 90 a 495 HP, la suma bruta
  // no compara nada. "Gana con el 60 % de vida" sí significa lo mismo para una
  // corbeta que para un portaviones.
  const pct = (s) => {
    const a = vivos(s);
    return a.length ? (a.reduce((x, u) => x + u.hp / u.hpMax, 0) / a.length) * 100 : 0;
  };
  const pA = pct("A"), pB = pct("B");
  return { winner: pA > 0 && pB <= 0 ? "A" : pB > 0 && pA <= 0 ? "B" : "draw", pA, pB, ticks };
}

// Monte Carlo: el objetivo se elige al azar el 35 % de las veces, así que un solo
// combate no dice nada.
function mc(sideA, sideB, n = 60) {
  let wA = 0, wB = 0, draw = 0, hpA = 0;
  for (let i = 0; i < n; i++) {
    const r = battle(sideA, sideB);
    if (r.winner === "A") { wA++; hpA += r.pA; }
    else if (r.winner === "B") wB++;
    else draw++;
  }
  return { wA, wB, draw, n, hpA: wA ? hpA / wA : 0 };
}

// ---------------------------------------------------------------------
section("[1] Schema de las 36 variantes navales");
{
  const bad = [];
  let n = 0;
  for (const doc of ["occ", "ori"]) {
    for (let t = 1; t <= 3; t++) {
      for (const cat of CLASES) {
        const v = NAVAL_UNITS[id(doc, t, cat)];
        n++;
        if (!v) { bad.push(`falta ${id(doc, t, cat)}`); continue; }
        const errs = [];
        for (const f of ["name", "icon", "cost", "buildHours", "hp", "speed", "attack", "defense", "minPortLevel"]) {
          if (v[f] === undefined) errs.push(`falta ${f}`);
        }
        if (!Number.isFinite(v.hp) || v.hp <= 0) errs.push("hp inválido");
        if (!(v.speed > 0)) errs.push("speed");
        if (v.minPortLevel !== t) errs.push(`minPortLevel ${v.minPortLevel} ≠ tier ${t}`);
        // Las 16 claves: 10 terrestres/aéreas + 6 navales
        for (const m of ["attack", "defense"]) {
          if (Object.keys(v[m]).length !== 16) errs.push(`${m} no tiene 16 claves`);
        }
        if (errs.length) bad.push(`${v.id}: ${errs.join(", ")}`);
      }
    }
  }
  check("las 36 variantes navales existen y tienen campos completos", bad.length === 0 && n === 36, bad.slice(0, 3).join(" | ") || `${n} variantes`);

  // Costes idénticos entre doctrinas: es la simetría que declara docs/NAVAL.md
  const costBad = [];
  for (let t = 1; t <= 3; t++) {
    for (const cat of CLASES) {
      const o = NAVAL_UNITS[id("occ", t, cat)], r = NAVAL_UNITS[id("ori", t, cat)];
      for (const k of ["money", "supplies", "manpower", "fuel"]) {
        if (o.cost[k] !== r.cost[k]) costBad.push(`${cat} t${t}.${k}`);
      }
    }
  }
  check("costes idénticos entre doctrinas (simetría declarada)", costBad.length === 0, costBad.slice(0, 3).join(" | "));
}

// ---------------------------------------------------------------------
section("[2] Vida: escalado por tier y margen de doctrina");
{
  const noMono = [];
  for (const doc of ["occ", "ori"]) {
    for (const cat of CLASES) {
      const h = [1, 2, 3].map((t) => NAVAL_UNITS[id(doc, t, cat)].hp);
      if (!(h[0] < h[1] && h[1] < h[2])) noMono.push(`${doc}-${cat}: ${h.join("/")}`);
    }
  }
  check("la vida crece estrictamente con el tier en las 12 series", noMono.length === 0, noMono.slice(0, 3).join(" | "));

  // El abanico por desplazamiento es la razón de ser de todo esto: si se
  // aplanara, volveríamos al portaviones que encaja lo mismo que una corbeta.
  const port = NAVAL_UNITS[id("occ", 2, "portaviones")].hp;
  const corb = NAVAL_UNITS[id("occ", 2, "corbeta")].hp;
  check("el portaviones aguanta al menos 4× lo que una corbeta", port / corb >= 4, `${port} vs ${corb} = ×${(port / corb).toFixed(1)}`);

  const ordenEsperado = ["portaviones", "destructor", "transporte", "fragata", "submarino", "corbeta"];
  const orden = [...CLASES].sort((a, b) => NAVAL_UNITS[id("occ", 2, b)].hp - NAVAL_UNITS[id("occ", 2, a)].hp);
  check("orden de vida por desplazamiento", orden.join(">") === ordenEsperado.join(">"), orden.join(" > "));

  // Occidente aguanta más en superficie; Oriente, solo en el submarino.
  const supBad = SUPERFICIE.filter((c) => NAVAL_UNITS[id("occ", 2, c)].hp <= NAVAL_UNITS[id("ori", 2, c)].hp);
  check("Occidente tiene más vida en las 5 clases de superficie", supBad.length === 0, supBad.join(", "));
  const so = NAVAL_UNITS[id("occ", 2, "submarino")].hp, sr = NAVAL_UNITS[id("ori", 2, "submarino")].hp;
  check("el submarino ORIENTAL tiene más vida que el occidental", sr > so, `ori ${sr} vs occ ${so}`);

  // El margen no puede dispararse: medido, por encima del 4 % la flota
  // occidental gana el 100 % de las batallas y deja de haber partida.
  const margenes = SUPERFICIE.map((c) => NAVAL_UNITS[id("occ", 2, c)].hp / NAVAL_UNITS[id("ori", 2, c)].hp);
  const peor = Math.max(...margenes);
  check("el margen de vida occidental no pasa del 4 %", peor <= 1.04, `máximo ×${peor.toFixed(3)}`);
}

// ---------------------------------------------------------------------
section("[3] Triángulo naval (duelos 1v1, t2 occidental)");
{
  const duelo = (a, b) => {
    const r = mc([id("occ", 2, a)], [id("occ", 2, b)], 40);
    return { gana: r.wA > r.wB ? a : r.wB > r.wA ? b : "empate", r };
  };
  const reglas = [
    ["destructor", "corbeta", "el destructor barre a la corbeta"],
    ["destructor", "fragata", "el destructor gana a la fragata"],
    ["destructor", "submarino", "el destructor caza al submarino"],
    ["destructor", "transporte", "el destructor hunde al transporte"],
    ["submarino", "portaviones", "el submarino hunde al portaviones"],
    ["fragata", "corbeta", "la fragata gana a la corbeta"],
    ["fragata", "transporte", "la fragata hunde al transporte"],
    ["portaviones", "transporte", "el portaviones hunde al transporte"],
  ];
  for (const [a, b, label] of reglas) {
    const d = duelo(a, b);
    check(label, d.gana === a, `${d.r.wA}-${d.r.wB} de ${d.r.n}`);
  }
  // Informativo: el resto de la matriz, para ver el mapa completo sin asertar
  for (const [a, b] of [["corbeta", "submarino"], ["portaviones", "destructor"], ["portaviones", "fragata"]]) {
    const d = duelo(a, b);
    info(`${a} vs ${b}`, `gana ${d.gana} (${d.r.wA}-${d.r.wB})`);
  }
}

// ---------------------------------------------------------------------
section("[4] Competitividad entre doctrinas");
{
  const porClase = CLASES.map((c) => {
    const r = mc([id("occ", 2, c)], [id("ori", 2, c)], 40);
    return { c, occ: r.wA, ori: r.wB };
  });
  const occGana = porClase.filter((x) => x.occ > x.ori).map((x) => x.c);
  const oriGana = porClase.filter((x) => x.ori > x.occ).map((x) => x.c);
  info("duelos espejo por clase", porClase.map((x) => `${x.c} ${x.occ}-${x.ori}`).join(" · "));

  check("Occidente domina la superficie (gana al menos 4 de las 5 clases)",
    SUPERFICIE.filter((c) => occGana.includes(c)).length >= 4,
    `gana ${occGana.join(", ") || "ninguna"}`);
  check("Oriente conserva el submarino como su clase", oriGana.includes("submarino"),
    `Oriente gana ${oriGana.join(", ") || "ninguna"}`);

  // La prueba que de verdad importa: una flota completa contra otra. Si una
  // doctrina gana siempre, no hay partida naval. La flota lleva submarino a
  // propósito — sin él se mide solo la superficie, que es el terreno occidental.
  const flota = (p) => [id(p, 2, "destructor"), id(p, 2, "destructor"), id(p, 2, "fragata"), id(p, 2, "submarino"), id(p, 2, "portaviones")];
  // 400 muestras, no 120. Con 120 la estimación oscilaba entre el 26 % y el 37 %
  // en tandas consecutivas —medido— y de vez en cuando cruzaba el límite inferior
  // de la banda, así que el banco fallaba sin que nada hubiera cambiado. Un banco
  // que falla al azar es peor que no tenerlo: enseña a ignorarlo.
  const f = mc(flota("occ"), flota("ori"), 400);
  const oriPct = Math.round((f.wB / f.n) * 100);
  check("flota mixta competitiva (oriental gana entre el 20 % y el 80 %)",
    oriPct >= 20 && oriPct <= 80, `oriental gana ${oriPct}% (occ ${f.wA}, empates ${f.draw})`);
}

// ---------------------------------------------------------------------
section("[5] Defensa antiaérea de los buques");
{
  // El submarino no dispara a aeronaves. Es su gran vulnerabilidad y el motivo
  // de que exista la aviación antisubmarina: si esto deja de ser cero, esa
  // pieza del diseño desaparece sin que nadie se entere.
  const subs = [1, 2, 3].flatMap((t) => ["occ", "ori"].map((d) => id(d, t, "submarino")));
  check("el submarino NO tiene defensa antiaérea en ninguna variante",
    subs.every((s) => navalAA(s) === null), subs.filter((s) => navalAA(s)).join(", "));

  const noMono = [];
  for (const doc of ["occ", "ori"]) {
    for (const cat of CLASES.filter((c) => c !== "submarino")) {
      const km = [1, 2, 3].map((t) => NAVAL_AA[id(doc, t, cat)].km);
      const pk = [1, 2, 3].map((t) => NAVAL_AA[id(doc, t, cat)].pk);
      if (!(km[0] < km[1] && km[1] < km[2])) noMono.push(`km ${doc}-${cat}: ${km.join("/")}`);
      if (!(pk[0] < pk[1] && pk[1] < pk[2])) noMono.push(`pk ${doc}-${cat}: ${pk.join("/")}`);
    }
  }
  check("alcance y acierto crecen con el tier", noMono.length === 0, noMono.slice(0, 3).join(" | "));

  const dest = NAVAL_AA[id("occ", 2, "destructor")];
  const otras = CLASES.filter((c) => c !== "destructor" && c !== "submarino");
  check("el destructor es el mejor paraguas antiaéreo de la flota",
    otras.every((c) => NAVAL_AA[id("occ", 2, c)].km < dest.km),
    `destructor ${dest.km} km · ${otras.map((c) => `${c} ${NAVAL_AA[id("occ", 2, c)].km}`).join(", ")}`);

  // El portaviones se defiende POCO solo: es la lección central del sistema.
  const port = NAVAL_AA[id("occ", 2, "portaviones")];
  check("el portaviones se defiende poco solo (menos de un tercio del destructor)",
    port.km < dest.km / 3, `${port.km} km frente a ${dest.km} km`);

  // Doctrina: Occidente acierta más (Aegis), Oriente llega más lejos (S-300F)
  const pkBad = [], kmBad = [];
  for (const cat of CLASES.filter((c) => c !== "submarino")) {
    if (NAVAL_AA[id("occ", 2, cat)].pk <= NAVAL_AA[id("ori", 2, cat)].pk) pkBad.push(cat);
    if (NAVAL_AA[id("ori", 2, cat)].km <= NAVAL_AA[id("occ", 2, cat)].km) kmBad.push(cat);
  }
  check("Occidente acierta más con su antiaéreo naval (Aegis)", pkBad.length === 0, pkBad.join(", "));
  check("Oriente llega más lejos con el suyo (S-300F)", kmBad.length === 0, kmBad.join(", "));

  const fuera = Object.entries(NAVAL_AA).filter(([, a]) => a.pk > 0.85 || a.ciws > 0.85 || a.pk < 0 || a.ciws < 0);
  check("ningún buque supera el tope del 85 % de acierto ni de intercepción", fuera.length === 0, fuera.slice(0, 3).map(([k]) => k).join(", "));
}

// ---------------------------------------------------------------------
section("[6] Los aviones contra los buques");
{
  // Sin esto el sistema entero es inerte: hasta v1.6 NINGÚN arma aire-suelo
  // llevaba categorías navales y un avión no podía atacar a un barco.
  const antibuque = Object.values(AIR_WEAPONS).filter(
    (w) => w.tipo === "as" && w.clases?.some((c) => CLASES.includes(c))
  );
  check("hay armas aire-suelo capaces de atacar buques", antibuque.length >= 6, `${antibuque.length} armas`);

  const pesadas = ["gbu", "kab", "agm65", "kh25"];
  check("las bombas pesadas y los Maverick alcanzan cualquier casco",
    pesadas.every((k) => CLASES.every((c) => AIR_WEAPONS[k].clases.includes(c))),
    pesadas.filter((k) => !CLASES.every((c) => AIR_WEAPONS[k].clases.includes(c))).join(", "));

  const ligeras = ["tow", "shturm"];
  check("el anticarro ligero de helicóptero NO hunde un destructor",
    ligeras.every((k) => !AIR_WEAPONS[k].clases.includes("destructor")),
    ligeras.filter((k) => AIR_WEAPONS[k].clases.includes("destructor")).join(", "));

  // La furtividad es la llave del grupo de combate: el orden de vulnerabilidad
  // tiene que respetar la firma radar de cada aparato.
  const buque = { type: id("occ", 2, "destructor") };
  const pk = (a) => navalAAPk(buque, { type: a });
  const orden = [
    ["occ-1-bombardero", "B-52G"],
    ["occ-2-caza", "F/A-18E"],
    ["occ-3-caza-f35", "F-35A"],
    ["occ-2-bombardero", "B-2 Spirit"],
    ["occ-3-bombardero", "B-21 Raider"],
    ["occ-3-drone-rq190", "RQ-190"],
  ];
  const pks = orden.map(([t, n]) => ({ n, p: pk(t) }));
  info("acierto del destructor t2 contra cada aparato", pks.map((x) => `${x.n} ${Math.round(x.p * 100)}%`).join(" · "));
  let decreciente = true;
  for (let i = 1; i < pks.length; i++) if (pks[i].p > pks[i - 1].p) decreciente = false;
  check("cuanto más furtivo, menos le acierta el buque", decreciente,
    pks.map((x) => `${x.n} ${Math.round(x.p * 100)}%`).join(" > "));

  check("un bombardero furtivo es al menos 3× más difícil de tocar que uno normal",
    pk("occ-1-bombardero") / pk("occ-3-bombardero") >= 3,
    `B-52 ${Math.round(pk("occ-1-bombardero") * 100)}% vs B-21 ${Math.round(pk("occ-3-bombardero") * 100)}%`);

  // Contra un aparato sin furtividad, el pk es el del buque tal cual.
  const base = NAVAL_AA[buque.type].pk;
  check("sin furtividad, el buque dispara con su probabilidad íntegra",
    Math.abs(pk("occ-1-bombardero") - base) < 1e-9, `${pk("occ-1-bombardero").toFixed(3)} vs ${base}`);
}

// ---------------------------------------------------------------------
section("[7] IA naval (js/engine/ai-naval.js, docs/IA.md §Marina)");
{
  const { MAP } = await import("../js/data/map-data.js");
  const { COUNTRIES } = await import("../js/data/countries-data.js");
  const { initStatic, newGame, spawnUnit, isCoastalCountry, declareWar, intelFor, S } =
    await import("../js/engine/state.js");
  const { PERSONALITIES, rollPersonality } = await import("../js/data/personalities-data.js");
  const AN = await import("../js/engine/ai-naval.js");
  const { battleSet } = await import("../js/engine/combat.js");
  const { aiTickAll } = await import("../js/engine/ai.js");
  initStatic(MAP, COUNTRIES);

  // --- quién tiene costa ---
  const sinCosta = Object.keys(COUNTRIES).filter((i) => !isCoastalCountry(i)).sort();
  check("los países sin salida al mar son exactamente Bolivia y Paraguay",
    sinCosta.join(",") === "BOL,PRY", sinCosta.join(","));

  // --- el sorteo del carácter ---
  let alm = 0;
  for (let i = 0; i < 5000; i++) if (rollPersonality(false) === "almirante") alm++;
  check("un país sin costa NUNCA saca el carácter Almirante (5.000 sorteos)", alm === 0, `${alm}`);
  alm = 0;
  for (let i = 0; i < 5000; i++) if (rollPersonality(true) === "almirante") alm++;
  const esperado = PERSONALITIES.almirante.weight /
    Object.values(PERSONALITIES).reduce((a, p) => a + p.weight, 0);
  check("un país con costa lo saca en la proporción de su peso",
    Math.abs(alm / 5000 - esperado) < 0.03,
    `${(alm / 50).toFixed(1)} % (esperado ${(esperado * 100).toFixed(1)} %)`);
  let malos = 0;
  for (let g = 0; g < 30; g++) {
    const st = newGame("GRL");
    for (const i of sinCosta) if (st.countries[i].personality === "almirante") malos++;
  }
  check("en 30 partidas nuevas, Bolivia y Paraguay no son almirantes nunca", malos === 0, `${malos}`);

  // --- reclutamiento ---
  const rico = (st, iso) => Object.assign(st.countries[iso].resources,
    { money: 2e6, supplies: 2e5, fuel: 2e5, manpower: 2e5 });
  const conPuerto = (st, iso) => {
    const p = AN.coastalProvinces(st, iso)[0];
    st.provinces[p.id].buildings.puerto = 1;
    return p;
  };
  // navy = 1: el intento de barco se hace en cada llamada, sin dado
  const siempre = (base, extra = {}) => ({ ...base, navy: 1, ...extra });
  const enGrada = (st) => Object.values(st.provinces).flatMap((p) => p.recruits || []).filter((r) => r.kind === "naval");
  const celdaDe = (pid) => (S.edges.get(pid) || []).map((e) => e.to).find((t) => S.provinces.get(t)?.isSea);

  {
    const st = newGame("GRL");
    rico(st, "BOL");
    let n = 0;
    for (let i = 0; i < 50; i++) if (AN.aiNavalRecruit(st, "BOL", siempre(PERSONALITIES.almirante), 10)) n++;
    check("un país sin costa no recluta barcos aunque le sobre de todo",
      n === 0 && AN.navalBase(st, "BOL") === null, `${n} barcos, base naval ${AN.navalBase(st, "BOL")}`);
  }
  {
    const st = newGame("GRL");
    rico(st, "MEX");
    conPuerto(st, "MEX");
    const ok = AN.aiNavalRecruit(st, "MEX", siempre(PERSONALITIES.almirante), 30);
    check("un país con costa y puerto recluta barcos", ok && enGrada(st).length === 1,
      `en grada: ${enGrada(st).map((r) => r.type).join(",")}`);
    const sin = { ...PERSONALITIES.almirante, navy: 0 };
    let n = 0;
    for (let i = 0; i < 50; i++) if (AN.aiNavalRecruit(st, "MEX", sin, 30)) n++;
    check("con navy = 0 no recluta ni un barco", n === 0, `${n}`);
  }
  {
    const st = newGame("GRL");
    rico(st, "MEX");
    const p = conPuerto(st, "MEX");
    // Con 2 provincias el tope es pequeño (4): así lo que frena es el tope y no
    // los recursos, que además se reponen en cada vuelta.
    const P = siempre(PERSONALITIES.equilibrado);
    const tope = AN.fleetCap(st, "MEX", P, 2);
    for (let i = 0; i < 200; i++) {
      rico(st, "MEX");
      if (!AN.aiNavalRecruit(st, "MEX", P, 2)) continue;
      // se bota al momento y se vacía la grada: así solo frena el tope
      for (const q of Object.values(st.provinces)) q.recruits = [];
      spawnUnit(st, "MEX", "occ-1-corbeta", celdaDe(p.id));
    }
    check("la flota respeta su tope", AN.navalUnitsOf(st, "MEX").length === tope,
      `${AN.navalUnitsOf(st, "MEX").length} barcos, tope ${tope}`);
  }

  // --- el mercado: comprar lo que falta para el barco elegido ---
  const soloDestructor = siempre(PERSONALITIES.almirante,
    { navyMix: { corbeta: 0, fragata: 0, submarino: 0, portaviones: 0 } });
  {
    const st = newGame("GRL");
    const r = st.countries.MEX.resources;
    Object.assign(r, { money: 600000, supplies: 20000, fuel: 0, manpower: 5000 });
    conPuerto(st, "MEX");
    const ok = AN.aiNavalRecruit(st, "MEX", soloDestructor, 30);
    const tipo = enGrada(st)[0]?.type || "";
    check("sin combustible pero con dinero, compra lo que falta y bota el destructor",
      ok && tipo.endsWith("destructor") && r.money < 600000 - 77000,
      `${tipo} · dinero ${Math.round(r.money)} · fuel ${Math.round(r.fuel)}`);
  }
  {
    const st = newGame("GRL");
    const r = st.countries.MEX.resources;
    Object.assign(r, { money: 90000, supplies: 20000, fuel: 0, manpower: 5000 });
    const p = conPuerto(st, "MEX");
    spawnUnit(st, "MEX", "occ-1-corbeta", celdaDe(p.id));
    spawnUnit(st, "MEX", "occ-1-corbeta", celdaDe(p.id));
    const antes = { ...r };
    const ok = AN.aiNavalRecruit(st, "MEX", soloDestructor, 30);
    check("si ni comprando le llega y ya tiene flota, ESPERA: no gasta ni se conforma",
      !ok && r.money === antes.money && r.fuel === antes.fuel && !enGrada(st).length,
      `dinero ${r.money}, fuel ${r.fuel}, en grada ${enGrada(st).length}`);
  }

  {
    // Con dinero y SIN suministros: su primer barco lo compra igual
    const st = newGame("GRL");
    const r = st.countries.MEX.resources;
    Object.assign(r, { money: 300000, supplies: 0, fuel: 0, manpower: 5000 });
    conPuerto(st, "MEX");
    const ok = AN.aiNavalRecruit(st, "MEX", soloDestructor, 30);
    check("sin suministros ni flota, compra lo necesario y bota su primer barco",
      ok && enGrada(st).length === 1, `${enGrada(st)[0]?.type} · dinero ${Math.round(r.money)}`);
  }
  {
    // Y el puerto: un almirante sin suministros los compra para la obra
    const st = newGame("GRL");
    for (const i in st.countries) if (i !== "GRL") st.countries[i].personality = "equilibrado";
    st.countries.MEX.personality = "almirante";
    Object.assign(st.countries.MEX.resources, { money: 500000, supplies: 0 });
    const base = AN.navalBase(st, "MEX");
    aiTickAll(st);
    const obra = st.provinces[base.id].queue;
    check("un almirante sin suministros los compra y empieza su puerto",
      obra?.type === "puerto", `${base.id}: ${obra ? obra.type : "sin obra"}`);
  }

  // --- maniobra en guerra ---
  // Celda de mar pegada a la costa mexicana y una vecina suya, también de mar
  const costaMex = AN.coastalProvinces(newGame("GRL"), "MEX")[0].id;
  const celdaA = celdaDe(costaMex);
  const celdaB = (S.edges.get(celdaA) || []).map((e) => e.to)
    .find((t) => S.provinces.get(t)?.isSea && t !== celdaA);
  const P = PERSONALITIES.almirante;
  {
    const st = newGame("GRL");
    declareWar(st, "MEX", "CUB");
    const mios = [0, 1, 2].map(() => spawnUnit(st, "MEX", "occ-1-destructor", celdaA));
    spawnUnit(st, "CUB", "ori-1-corbeta", celdaB);
    AN.aiNaval(st, "MEX", intelFor(st, "MEX"), P, battleSet(st));
    const van = mios.filter((u) => u.path.at(-1) === celdaB).length;
    check("una flota más fuerte sale a por la flota enemiga que ve", van === 3, `${van} de 3 en ruta a ${celdaB}`);
  }
  {
    const st = newGame("GRL");
    declareWar(st, "MEX", "CUB");
    const mio = spawnUnit(st, "MEX", "occ-1-corbeta", celdaA);
    for (let i = 0; i < 4; i++) spawnUnit(st, "CUB", "ori-1-destructor", celdaB);
    AN.aiNaval(st, "MEX", intelFor(st, "MEX"), P, battleSet(st));
    check("ante una flota más fuerte, no se lanza", mio.path.length === 0, `ruta de ${mio.path.length} celdas`);
  }
  {
    const st = newGame("GRL");
    const mio = spawnUnit(st, "MEX", "occ-1-destructor", celdaA);
    spawnUnit(st, "CUB", "ori-1-corbeta", celdaB);
    AN.aiNaval(st, "MEX", intelFor(st, "MEX"), P, battleSet(st));
    check("en paz, la flota no se mueve", mio.path.length === 0, `ruta de ${mio.path.length} celdas`);
  }
  {
    // Destructores t2 (con misil de crucero) frente a Florida, en guerra con
    // Venezuela: su costa está a 2.621 km, fuera del Tomahawk (1.200) pero
    // dentro de AI_NAVAL_RANGE_KM. Sin barcos enemigos a la vista, se acercan.
    const st = newGame("GRL");
    declareWar(st, "USA", "VEN");
    const florida = celdaDe("usa-florida");
    const mios = [0, 1].map(() => spawnUnit(st, "USA", "occ-2-destructor", florida));
    AN.aiNaval(st, "USA", intelFor(st, "USA"), P, battleSet(st));
    const destino = mios[0].path.at(-1);
    const junto = !!destino && (S.edges.get(destino) || []).some((e) => st.provinces[e.to]?.owner === "VEN");
    check("sin flota a la vista, los destructores con misil se acercan a la costa enemiga",
      junto && mios[1].path.at(-1) === destino, `destino ${destino}, pegado a Venezuela: ${junto}`);
  }
  {
    // Y al revés: la costa enemiga más cercana, fuera de AI_NAVAL_RANGE_KM
    // (México en el Pacífico contra Venezuela), no justifica cruzar el océano.
    const st = newGame("GRL");
    declareWar(st, "MEX", "VEN");
    const mio = spawnUnit(st, "MEX", "occ-2-destructor", celdaA);
    AN.aiNaval(st, "MEX", intelFor(st, "MEX"), P, battleSet(st));
    check("una costa enemiga fuera de su radio de maniobra no le hace zarpar",
      mio.path.length === 0, `desde ${costaMex}: ruta de ${mio.path.length} celdas`);
  }
  {
    const st = newGame("GRL");
    declareWar(st, "MEX", "GTM");
    const barco = spawnUnit(st, "MEX", "occ-1-corbeta", celdaA);
    const t0 = Date.now();
    aiTickAll(st);
    const ms = Date.now() - t0;
    check("la guerra en tierra no asigna guarniciones a los barcos",
      barco.task?.kind !== "defend" && barco.task?.kind !== "attack",
      `tarea ${barco.task?.kind ?? "ninguna"} · turno completo de IA en ${ms} ms`);
  }
}

// ---------------------------------------------------------------------
console.log("\n=============================================");
console.log(`RESULTADO: ${passCount} PASS · ${failCount} FAIL`);
if (failCount) {
  console.log("\nFALLOS:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("OK: todas las aserciones obligatorias pasan.");
