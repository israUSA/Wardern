// Banco de fuego de la IA: cuántos misiles, salvas y bombas disparan los bots
// en una partida normal, por arma, y cuántos van a un blanco que el tirador NO
// veía (debe ser 0: la IA dispara con su niebla, docs/IA.md).
//   node tools/bench-fuego.mjs [días=16]
// Tarda ~5 min con 16 días.
import { MAP } from "../js/data/map-data.js";
import { COUNTRIES } from "../js/data/countries-data.js";
import { initStatic, newGame, intelFor } from "../js/engine/state.js";
import { tick } from "../js/engine/sim.js";
import { aiTickAll } from "../js/engine/ai.js";
initStatic(MAP, COUNTRIES);
const DAYS = +(process.argv[2] || 16);
const st = newGame("GRL");
const vistos = new Set();
const por = {};
let ciegos = 0;
const t0 = Date.now();
for (let t = 0; t < DAYS * 48; t++) {
  // la visión de cada país ANTES del tick, que es con la que decide su IA
  const antes = {};
  for (const iso in st.countries) antes[iso] = intelFor(st, iso).union;
  tick(st, 30);
  for (const m of st.missiles || []) {
    if (vistos.has(m.id)) continue;
    vistos.add(m.id);
    if (m.owner === "GRL") continue;
    const k = m.weaponId;
    por[k] = (por[k] || 0) + 1;
    if (!antes[m.owner].has(m.toId)) ciegos++;
  }
}
console.log(`${DAYS} dias, ${Date.now() - t0} ms`);
console.log("disparos por arma:", JSON.stringify(Object.fromEntries(Object.entries(por).sort((a, b) => b[1] - a[1]))));
console.log("disparos a un blanco que el tirador no veia:", ciegos);
const med = () => { const x = []; for (let i = 0; i < 6; i++) { const a = performance.now(); aiTickAll(st); x.push(performance.now() - a); } x.sort((p, q) => p - q); return x[3].toFixed(0); };
console.log("turno de IA al final, mediana:", med(), "ms con", st.units.length, "unidades");
