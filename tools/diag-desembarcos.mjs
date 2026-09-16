// Diagnóstico de desembarcos de la IA (docs/IA.md §Desembarcos).
// Partida de 16 días con la mitad de los países costeros forzados a Almirante;
// imprime cada operación al empezar y una vez al día: fase, playa, tropa en
// puerto y a bordo, transportes, lo que hay en grada y los recursos.
//   node tools/diag-desembarcos.mjs
// Tarda ~5 min. Sirve para ver DÓNDE se atasca una operación.
import { MAP } from "../js/data/map-data.js";
import { COUNTRIES } from "../js/data/countries-data.js";
import { initStatic, newGame, isCoastalCountry } from "../js/engine/state.js";
import { tick } from "../js/engine/sim.js";
initStatic(MAP, COUNTRIES);
const st = newGame("GRL");
// más almirantes para que haya operaciones que mirar
for (const i in st.countries) if (i !== "GRL" && isCoastalCountry(i) && Math.random() < 0.5) st.countries[i].personality = "almirante";
const last = {};
for (let t = 0; t < 16 * 48; t++) {
  tick(st, 30);
  for (const [iso, c] of Object.entries(st.countries)) {
    const op = c.aiLanding;
    if (!op) { if (last[iso]) { console.log(`h${(t+1)/2} ${iso} FIN (${last[iso]})`); last[iso] = null; } continue; }
    const tropa = op.troops.map(id => st.units.find(u => u.id === id)).filter(Boolean);
    const barcos = op.transports.map(id => st.units.find(u => u.id === id)).filter(Boolean);
    const enPuerto = tropa.filter(u => u.pos === op.port && !u.path.length).length;
    const emb = tropa.filter(u => u.embarked).length;
    const bEn = barcos.filter(b => b.pos === op.portCell && !b.path.length).length;
    const grada = (st.provinces[op.port].recruits || []).map(r => r.type.split("-")[2]).join("+") || "-";
    const r = c.resources;
    const s = `${op.phase} ${op.target} tropa ${tropa.length} (puerto ${enPuerto}, a bordo ${emb}) transp ${barcos.length} (en puerto ${bEn}) grada ${grada} $${Math.round(r.money/1000)}k sum ${Math.round(r.supplies)} fuel ${Math.round(r.fuel)}`;
    if ((t + 1) % 48 === 0 || !last[iso]) console.log(`h${(t+1)/2} ${iso} ${s}`);
    last[iso] = op.phase;
  }
}
