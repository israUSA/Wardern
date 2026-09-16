// Banco de personalidades de la IA (docs/IA.md §Medido).
//
// Fuerza a TODOS los bots a un mismo carácter, simula DAYS días a pasos de 30
// min y cuenta guerras, paces, tropas reclutadas (no supervivientes: el que
// pelea más pierde más, y eso falsearía el reparto), edificios y tier.
//
//   node tools/bench-ia.mjs conquistador
//
// Tarda ~5 min por carácter. Para los cinco a la vez, en paralelo:
//   for p in equilibrado conquistador tortuga industrial oportunista; do
//     node tools/bench-ia.mjs $p & done; wait
//
// No lleva aserciones: la IA es aleatoria y con 2 semillas la dispersión es
// grande. Sirve para comparar caracteres entre sí, no para dar PASS/FAIL.
import { MAP } from "../js/data/map-data.js";
import { COUNTRIES } from "../js/data/countries-data.js";
import { initStatic, newGame, unitDef } from "../js/engine/state.js";
import { tick } from "../js/engine/sim.js";
initStatic(MAP, COUNTRIES);
const pid = process.argv[2], DAYS = 20, SEEDS = 2;
const acc = { wars: 0, peace: 0, rec: 0, fort: 0, fortPaz: 0, ind: 0, tier: 0, cat: {} };
for (let s = 0; s < SEEDS; s++) {
  const st = newGame("GRL");
  for (const iso in st.countries) if (iso !== "GRL") st.countries[iso].personality = pid;
  const vistos = new Set(st.units.map(u => u.id));
  const key = () => new Set(Object.entries(st.countries).flatMap(([a, c]) => c.wars.filter(b => a < b).map(b => a + b)));
  let prev = key();
  let fortDia3 = null;
  for (let t = 0; t < DAYS * 48; t++) {
    tick(st, 30);
    for (const u of st.units) if (!vistos.has(u.id)) {
      vistos.add(u.id);
      if (u.owner === "GRL") continue;
      acc.rec++;
      const c = unitDef(u.type)?.category;
      acc.cat[c] = (acc.cat[c] || 0) + 1;
    }
    const cur = key();
    for (const k of cur) if (!prev.has(k)) acc.wars++;
    for (const k of prev) if (!cur.has(k)) acc.peace++;
    prev = cur;
    // fortaleza al final del dia 2: antes de las primeras guerras (AI_MIN_WAR_DAY)
    if (t === 2 * 48 - 1) fortDia3 = Object.values(st.provinces).filter(p => p.owner !== "GRL").reduce((a, p) => a + p.buildings.fortaleza, 0);
  }
  const bots = Object.keys(st.countries).filter(i => i !== "GRL" && !st.countries[i].eliminated);
  const provs = Object.values(st.provinces).filter(p => p.owner !== "GRL");
  acc.fortPaz += fortDia3 / provs.length;
  acc.fort += provs.reduce((a, p) => a + p.buildings.fortaleza, 0) / provs.length;
  acc.ind += provs.reduce((a, p) => a + p.buildings.industria, 0) / provs.length;
  acc.tier += bots.reduce((a, i) => a + (st.countries[i].researchedTier || 1), 0) / bots.length;
}
const n = SEEDS, pc = c => Math.round(100 * (acc.cat[c] || 0) / acc.rec);
const aire = ["caza", "bombardero", "helicoptero", "drone"].reduce((a, c) => a + (acc.cat[c] || 0), 0);
console.log(JSON.stringify({
  pid, guerras: acc.wars / n, paces: acc.peace / n, reclutadas: acc.rec / n,
  fortDia2: +(acc.fortPaz / n).toFixed(2), fortFinal: +(acc.fort / n).toFixed(2), industria: +(acc.ind / n).toFixed(2), tier: +(acc.tier / n).toFixed(2),
  mbt: pc("mbt"), aa: pc("antiaereo"), art: pc("artilleria"), moto: pc("motorizada"), inf: pc("infanteria"), aire: Math.round(100 * aire / acc.rec),
}));
