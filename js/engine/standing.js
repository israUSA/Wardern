// Órdenes permanentes: lo que una unidad sigue haciendo SOLA hasta que le mandes
// otra cosa (docs/UNITS.md §Órdenes permanentes).
//
// Es la diferencia entre dar una orden y dar una misión. Antes, una patrulla se
// agotaba y el aparato se quedaba aparcado en la pista hasta que el jugador se
// acordaba de él; y una batería disparaba una salva y callaba durante el resto
// de la partida aunque el blanco siguiera delante. Las dos cosas obligaban a
// vigilar el reloj en vez de jugar.
//
// La orden permanente vive en `u.standing` y solo la borra una orden NUEVA
// (orderMove, orderStop, "Volver a base"…, ver js/engine/movement.js). El ciclo
// de repostaje no cuenta como orden nueva: por eso tickAirPatrol se la guarda
// mientras el avión vuelve a casa.
import * as C from "../data/constants.js";
import { S, unitDef, atWar, log } from "./state.js";
import { orderPatrol } from "./movement.js";
import { shellUnit, artilleryRange, shellDistance } from "./artillery.js";
import { rearmBlocker, rearmStatus, autoEngage, airLoadout } from "./air-combat.js";

export function tickStanding(state, dt) {
  for (const u of state.units) {
    if (u.dead || !u.standing) continue;
    if (u.standing.kind === "patrol") tickPatrolStanding(state, u, dt);
    else if (u.standing.kind === "fire") tickFireStanding(state, u);
  }
}

// Patrulla en bucle: despegar, dar vueltas las horas que dé el depósito, volver
// a repostar y salir otra vez al MISMO sector, sin que el jugador toque nada.
function tickPatrolStanding(state, u, dt) {
  const s = u.standing;
  // Apontar en un portaviones es una decisión del jugador, no parte del ciclo:
  // el aparato cambia de casa y la misión anterior deja de tener sentido.
  if (u.embarked) {
    u.standing = null;
    return;
  }
  if (u.edgeLeft || u.path.length || u.task) return; // en el aire, a lo suyo
  // Parada y sin misión: o está en su base (rearmBlocker lo confirma) o se quedó
  // colgada sin base alcanzable, y entonces no hay ciclo que reanudar.
  if (rearmBlocker(state, u)) return;
  s.wait = (s.wait ?? C.PATROL_TURNAROUND_MIN) - dt;
  if (s.wait > 0) return;
  // Repostada no es solo combustible: si quedan raíles vacíos, se espera a que
  // tickRearm los complete. Salir sin misiles es regalar el aparato.
  const r = rearmStatus(state, u);
  if (r && !r.completo) return;

  const nombre = unitDef(u.type)?.name;
  const donde = S.provinces.get(s.pid);
  const pid = s.pid;
  if (!orderPatrol(state, u, pid)) { // éxito → deja una orden permanente nueva
    u.standing = null;
    log(state, `${nombre} no puede volver a ${donde?.isSea ? "el sector" : donde?.name}: patrulla cancelada`, "info");
    return;
  }
  log(state, `${nombre} vuelve a patrullar ${donde?.isSea ? "el sector" : donde?.name}`, "info");
}

// Fuego constante: la pieza machaca al mismo blanco salva tras salva, cada vez
// que termina de recargar, sin volver a pulsar nada.
function tickFireStanding(state, u) {
  const s = u.standing;
  const nombre = unitDef(u.type)?.name;
  const parar = (msg) => {
    u.standing = null;
    if (msg) log(state, msg, "info");
  };
  const t = state.units.find((x) => x.id === s.targetId && !x.dead);
  if (!t) return parar(`${nombre} deja de tirar: el blanco ha desaparecido`);
  // Si la pieza se pone en marcha por cualquier vía que no sea una orden (una
  // formación arrastrada, por ejemplo), el tiro se corta sin aviso: ya no está
  // en batería.
  if (u.edgeLeft || u.path.length) return parar(null);
  if (t.embarked || !atWar(state, u.owner, t.owner)) return parar(`${nombre} alto el fuego`);
  if (shellDistance(state, u, t.pos) > artilleryRange(u.type)) {
    return parar(`${nombre} deja de tirar: el blanco sale de su alcance`);
  }
  if ((u.artyCd || 0) > 0) return;
  // Un fallo aquí es casi siempre munición o falta de observación: no se cancela
  // la orden, se reintenta en el siguiente ciclo (shellUnit ya avisa del disparo).
  shellUnit(state, u, t);
}

// Las patrullas del JUGADOR disparan solas, con las mismas reglas que las de los
// bots (js/engine/air-combat.js §IA). Solo las que llevan orden de patrulla: un
// aparato aparcado en su base no gasta misiles por su cuenta, y uno en tránsito
// tampoco. Se llama al ritmo del turno de IA, así que es un misil por aparato y
// por ciclo, igual que para los bots.
export function patrolAutoFire(state) {
  for (const u of state.units) {
    if (u.owner !== state.player || u.dead) continue;
    if (u.task?.kind !== "patrol" || !airLoadout(u.type)) continue;
    autoEngage(state, u);
  }
}
