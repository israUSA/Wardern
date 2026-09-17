// Diagnóstico de desembarcos de la IA (docs/IA.md §Desembarcos).
// Partida de 16 días con la mitad de los países costeros forzados a Almirante;
// imprime cada operación al empezar y una vez al día: fase, playa, tropa en
// puerto y a bordo, transportes, lo que hay en grada y los recursos.
//   node tools/diag-desembarcos.mjs
// Tarda ~5 min. Sirve para ver DÓNDE se atasca una operación.
import { MAP } from "../js/data/map-data.js";
import { COUNTRIES } from "../js/data/countries-data.js";
import { initStatic, newGame, isCoastalCountry, S } from "../js/engine/state.js";
import { tick } from "../js/engine/sim.js";
initStatic(MAP, COUNTRIES);
const st = newGame("GRL");
// más almirantes para que haya operaciones que mirar
for (const i in st.countries) if (i !== "GRL" && isCoastalCountry(i) && Math.random() < 0.5) st.countries[i].personality = "almirante";
const last = {};
const previa = {};   // la última operación vista de cada país, para saber cómo acabó
const cuenta = { planeadas: 0, navegaron: 0, desembarcaron: 0, canceladas: 0 };
for (let t = 0; t < 16 * 48; t++) {
  tick(st, 30);
  for (const [iso, c] of Object.entries(st.countries)) {
    const op = c.aiLanding;
    if (!op) {
      if (last[iso]) {
        // ¿Acabó en la playa o se canceló? Se mira si queda tropa suya, a pie,
        // en territorio del enemigo al que iba.
        const o = previa[iso];
        const enPlaya = o.troops
          .map((id) => st.units.find((u) => u.id === id && !u.dead))
          .filter((u) => u && !u.embarked && S.provinces.get(u.pos)?.country === o.enemy).length;
        if (enPlaya) cuenta.desembarcaron++; else cuenta.canceladas++;
        console.log(`h${(t+1)/2} ${iso} FIN en ${last[iso]}: ${enPlaya ? `DESEMBARCÓ ${enPlaya} en ${o.target}` : "cancelada"}`);
        last[iso] = null;
      }
      continue;
    }
    const tropa = op.troops.map(id => st.units.find(u => u.id === id)).filter(Boolean);
    const barcos = op.transports.map(id => st.units.find(u => u.id === id)).filter(Boolean);
    const enPuerto = tropa.filter(u => u.pos === op.port && !u.path.length).length;
    const emb = tropa.filter(u => u.embarked).length;
    const bEn = barcos.filter(b => b.pos === op.portCell && !b.path.length).length;
    const grada = (st.provinces[op.port].recruits || []).map(r => r.type.split("-")[2]).join("+") || "-";
    const r = c.resources;
    const s = `${op.phase} ${op.target} tropa ${tropa.length} (puerto ${enPuerto}, a bordo ${emb}) transp ${barcos.length} (en puerto ${bEn}) grada ${grada} $${Math.round(r.money/1000)}k sum ${Math.round(r.supplies)} fuel ${Math.round(r.fuel)}`;
    if ((t + 1) % 48 === 0 || !last[iso]) console.log(`h${(t+1)/2} ${iso} ${s}`);
    if (!last[iso]) cuenta.planeadas++;
    if (op.phase === "navegar" && last[iso] !== "navegar") cuenta.navegaron++;
    last[iso] = op.phase;
    previa[iso] = { ...op, troops: [...op.troops] };
  }
}
const vivas = Object.values(last).filter(Boolean).length;
console.log(`
RESUMEN 16 días: ${cuenta.planeadas} operaciones planeadas · ${cuenta.navegaron} llegaron a navegar · ` +
  `${cuenta.desembarcaron} desembarcaron · ${cuenta.canceladas} canceladas · ${vivas} aún en curso al acabar`);
