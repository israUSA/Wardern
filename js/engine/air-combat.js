// Motor de combate aéreo (docs/AIR-COMBAT.md): radar, disparo guiado contra
// UNIDADES concretas, resolución probabilística, reacción antiaérea y rearme.
//
// Convive con js/engine/missiles.js sin mezclarse: aquel dispara contra la
// PROVINCIA con munición infinita y cooldown; este gasta misiles de una carga
// finita y apunta a una unidad. Los vuelos se meten en el MISMO `state.missiles`
// (marcados con `air: true`) para que el render y el tick de vuelo sean únicos.
import { S, unitDef, controller, atWar, distKm, log, visibleProvinces , hpFrac , maxHp } from "./state.js";
import { vetLevel } from "./combat.js";
import { canAfford, pay } from "./economy.js";
import { carrierBerths } from "./movement.js";
import * as C from "../data/constants.js";
import {
  AIR_WEAPONS, AIR_LOADOUTS, GROUND_EVASION, SAM_RANGE_KM, SAM_PK, SAM_DAMAGE,
  PK_RANGE_CURVE, PK_VET_BONUS, REARM_MIN_AEROBASE, AIR_RANGE_SCALE,
  SAM_RADAR, CARRIER_CAPACITY, CARRIER_CAPABLE, NAVAL_AA, NAVAL_AA_DAMAGE,
} from "../data/air-combat-data.js";

// ---------- Escala y distancias ----------

// Alcance efectivo de un arma sobre ESTE mapa (ver AIR_RANGE_SCALE: el dato del
// arma es el real, la escala lo lleva a la geografía del teatro).
export function effRange(w) {
  return Math.round((w?.rangoKm || 0) * AIR_RANGE_SCALE);
}

// Distancia táctica entre dos provincias. Dentro de la misma provincia la
// distancia es 0: los aparatos comparten sector, que es lo que hace utilizable
// un Sidewinder o un Hellfire sin inflarles el alcance.
function tacticalKm(from, to) {
  if (!from || !to) return Infinity;
  if (from.id === to.id) return 0;
  return distKm([from.cx, from.cy], [to.cx, to.cy]);
}

// ---------- Consultas básicas ----------

export function airLoadout(type) {
  return AIR_LOADOUTS[type] || null;
}

export function isAircraft(type) {
  return !!AIR_LOADOUTS[type];
}

export function radarRangeKm(u) {
  return Math.round((AIR_LOADOUTS[u?.type]?.radarKm || 0) * AIR_RANGE_SCALE);
}

// Munición actual del avión. Se crea PEREZOSAMENTE en vez de en spawnUnit para
// que las partidas guardadas antes de esta versión carguen con dotación completa
// (y para no meter una dependencia de datos de combate dentro de state.js).
export function ensureAmmo(u) {
  const L = AIR_LOADOUTS[u?.type];
  if (!L) return null;
  if (!u.ammo) u.ammo = { ...L.armas };
  return u.ammo;
}

// Armas del avión con su munición: [{ weapon, left, total }]
export function airWeapons(u) {
  const L = AIR_LOADOUTS[u?.type];
  if (!L) return [];
  const ammo = ensureAmmo(u);
  return Object.keys(L.armas).map((id) => ({
    weapon: AIR_WEAPONS[id],
    left: ammo[id] ?? 0,
    total: L.armas[id],
  }));
}

// Rumbo geográfico en grados (0 = norte, 90 = este) para el indicador de radar
export function bearingDeg(a, b) {
  const dy = b.cy - a.cy;
  const dx = (b.cx - a.cx) * Math.cos((a.cy * Math.PI) / 180);
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

// ---------- Furtividad y detección ----------

// Firma radar del blanco: 0 = avión normal, 1 = invisible.
export function rcsOf(u) {
  return AIR_LOADOUTS[u?.type]?.rcs || 0;
}

// A qué distancia ve ESTE sensor a ESE blanco. La furtividad recorta el alcance
// de detección, no el del radar: el mismo S-400 que ve un Tu-22M2 a 1.400 km
// coge al RQ-190 a 260. `antiStealth` es cuánto anula el sensor esa ventaja
// (0 en cualquier radar de caza; solo las redes antiaéreas modernas suben de ahí).
function detectionKm(sensorKm, target, antiStealth = 0) {
  const rcs = rcsOf(target);
  if (!rcs) return sensorKm;
  return sensorKm * Math.max(0, 1 - rcs * (1 - antiStealth));
}

// Radares de vigilancia propios: cada antiaéreo aporta cobertura a TODO su bando
// (enlace de datos). Es el contrapeso a la furtividad — tu batería ve al furtivo
// que tu caza no puede ver, y tu caza lo mata con ese dato.
function groundRadars(state, iso) {
  const out = [];
  for (const u of state.units) {
    if (u.dead || u.embarked || u.owner !== iso) continue;
    if ((unitDef(u.type)?.category || u.type) !== "antiaereo") continue;
    const R = SAM_RADAR[u.type] || SAM_RADAR.antiaereo;
    const p = S.provinces.get(u.pos);
    if (!p || !R) continue;
    out.push({ prov: p, km: R.km * AIR_RANGE_SCALE, antiStealth: R.antiStealth });
  }
  return out;
}

// ---------- Detección ----------

// Aeronaves enemigas dentro del alcance del radar. Detectar NO es poder disparar:
// el radar siempre ve más lejos que el misil más largo del avión, y esa
// diferencia es la que da la tensión del combate más allá del alcance visual.
export function radarContacts(state, u) {
  const L = AIR_LOADOUTS[u?.type];
  const from = S.provinces.get(u?.pos);
  if (!L || !from) return [];
  const radar = radarRangeKm(u);
  const radares = groundRadars(state, u.owner);
  const out = [];
  for (const e of state.units) {
    if (e.dead || e.embarked || e.id === u.id || e.owner === u.owner) continue;
    if (!AIR_LOADOUTS[e.type]) continue; // solo aeronaves
    if (!atWar(state, u.owner, e.owner)) continue;
    const p = S.provinces.get(e.pos);
    if (!p) continue;
    const km = tacticalKm(from, p);
    // El radar propio ve al blanco a `radar × (1 − rcs)`: contra un furtivo, casi nada
    if (km <= detectionKm(radar, e)) {
      out.push({ unit: e, km, bearing: bearingDeg(from, p) });
      continue;
    }
    // Enlace de datos: si una batería antiaérea propia lo tiene marcado, el
    // contacto aparece igual aunque este avión no lo vea con su radar.
    const visto = radares.some(
      (r) => tacticalKm(r.prov, p) <= detectionKm(r.km, e, r.antiStealth)
    );
    if (visto) out.push({ unit: e, km, bearing: bearingDeg(from, p), datalink: true });
  }
  return out.sort((a, b) => a.km - b.km);
}

// Blancos de superficie al alcance de alguna de sus armas aire-suelo. El jugador
// solo ve los que tiene reconocidos (misma regla que docs/MISSILES.md §3); la IA
// no sufre niebla, igual que en el resto del motor.
export function groundContacts(state, u) {
  const L = AIR_LOADOUTS[u?.type];
  const from = S.provinces.get(u?.pos);
  if (!L || !from) return [];
  const rangos = Object.keys(L.armas)
    .map((id) => AIR_WEAPONS[id])
    .filter((w) => w?.tipo === "as")
    .map((w) => effRange(w));
  if (!rangos.length) return [];
  const maxKm = Math.max(...rangos);
  const fog = u.owner === state.player ? visibleProvinces(state) : null;

  const out = [];
  for (const e of state.units) {
    if (e.dead || e.embarked || e.owner === u.owner) continue;
    if (AIR_LOADOUTS[e.type]) continue; // las aeronaves van por radar
    if (!atWar(state, u.owner, e.owner)) continue;
    if (fog && !fog.has(e.pos)) continue;
    const p = S.provinces.get(e.pos);
    if (!p) continue;
    const km = tacticalKm(from, p);
    if (km > maxKm) continue;
    out.push({ unit: e, km, bearing: bearingDeg(from, p) });
  }
  return out.sort((a, b) => a.km - b.km);
}

// ---------- Probabilidad de impacto ----------

function targetEvasion(t) {
  const L = AIR_LOADOUTS[t.type];
  if (L) return L.evasion;
  const cat = unitDef(t.type)?.category || t.type;
  return GROUND_EVASION[cat] ?? 0.15;
}

// Pk = base del arma × curva de distancia × (1 − evasión del blanco) + veteranía.
// A quemarropa el blanco no tiene tiempo de reaccionar; al límite de la
// envolvente el misil llega sin energía y falla la mitad de las veces.
export function pkFor(w, shooter, target, km) {
  const norm = Math.min(1, km / Math.max(1, effRange(w)));
  let mult = PK_RANGE_CURVE[PK_RANGE_CURVE.length - 1].mult;
  for (const step of PK_RANGE_CURVE) {
    if (norm <= step.hasta) {
      mult = step.mult;
      break;
    }
  }
  const vet = vetLevel(shooter) * PK_VET_BONUS;
  // Un escuadrón maltrecho acierta menos. Se degrada la PROBABILIDAD, no el
  // daño: el misil explota igual de fuerte, lo que falla es el aparato dañado
  // colocándose para tirar. Hasta ahora un caza con 5 HP disparaba exactamente
  // igual que uno intacto, que era el único sitio del motor donde el estado de
  // la unidad no contaba para nada.
  const est = hpFrac(shooter);
  return Math.max(0.05, Math.min(0.95, (w.pk * mult * (1 - targetEvasion(target)) + vet) * est));
}

// ¿Puede esta arma atacar a ese blanco? Devuelve el motivo si no.
export function weaponCanTarget(w, target) {
  const air = !!AIR_LOADOUTS[target.type];
  if (w.tipo === "aa") {
    return air ? null : `${w.nombre} es aire-aire: no ataca blancos de superficie`;
  }
  if (air) return `${w.nombre} es aire-suelo: no ataca aeronaves`;
  const cat = unitDef(target.type)?.category || target.type;
  if (!w.clases?.includes(cat)) {
    return `${w.nombre} no sirve contra ${cat} (solo ${w.clases?.join(", ")})`;
  }
  return null;
}

// ---------- Disparo ----------

export function fireAirWeapon(state, unitId, weaponId, targetUnitId) {
  const u = state.units.find((x) => x.id === unitId && !x.dead);
  const w = AIR_WEAPONS[weaponId];
  if (!u || !w) return { ok: false, msg: "Arma no disponible" };
  const L = AIR_LOADOUTS[u.type];
  if (!L || !(weaponId in L.armas)) return { ok: false, msg: "Este avión no porta esa arma" };
  if (u.edgeLeft) return { ok: false, msg: "El avión está en tránsito: debe estar en su sector para disparar" };

  const ammo = ensureAmmo(u);
  if ((ammo[weaponId] || 0) <= 0) {
    return { ok: false, msg: `Sin ${w.nombre}: hay que rearmar en una base aérea` };
  }

  const t = state.units.find((x) => x.id === targetUnitId && !x.dead);
  if (!t || t.embarked) return { ok: false, msg: "El blanco ya no existe" };
  if (t.owner === u.owner) return { ok: false, msg: "Ese blanco es tuyo" };
  if (!atWar(state, u.owner, t.owner)) return { ok: false, msg: "No estás en guerra con ese país" };

  const veto = weaponCanTarget(w, t);
  if (veto) return { ok: false, msg: veto };

  const from = S.provinces.get(u.pos);
  const to = S.provinces.get(t.pos);
  if (!from || !to) return { ok: false, msg: "Posición inválida" };

  // Reconocimiento: el radar basta para las aeronaves; contra superficie hace
  // falta ver la provincia (dron o tropas propias cerca), como el resto de misiles.
  if (u.owner === state.player && w.tipo === "as" && !visibleProvinces(state).has(t.pos)) {
    return { ok: false, msg: "Sin reconocimiento del objetivo (mándale un dron)" };
  }

  const km = tacticalKm(from, to);
  const alcance = effRange(w);
  if (km > alcance) {
    return { ok: false, msg: `Fuera de alcance: ${Math.round(km)} km > ${alcance} km del ${w.nombre}` };
  }

  // El misil ya está en el raíl: disparar es gratis, lo que cuesta es REPONERLO
  ammo[weaponId] = (ammo[weaponId] || 0) - 1;

  const pk = pkFor(w, u, t, km);
  const minutes = Math.max(0.2, (km / w.velocidadKmH) * 60);
  if (!state.missiles) state.missiles = [];
  state.missiles.push({
    id: `air-${state.time.toFixed(3)}-${Math.random().toString(36).slice(2, 6)}`,
    air: true, weaponId, owner: u.owner, shooterId: u.id, targetUnitId: t.id,
    fromId: u.pos, toId: t.pos, pk, minutesLeft: minutes, total: minutes,
  });

  const tn = unitDef(t.type)?.name || t.type;
  log(state, `${S.countries[u.owner].name} lanza ${w.nombre} contra ${tn}`, "war");

  // Suprimir defensas antes de atacar tierra no es opcional: la batería responde
  const sam = w.tipo === "as" ? samReaction(state, u) : null;

  return {
    ok: true,
    msg: `${w.nombre} en vuelo: ${Math.round(km)} km · ${Math.round(pk * 100)}% de impacto${sam ? ` · ${sam}` : ""}`,
  };
}

// Defensa antiaérea de un buque, o null si no la tiene (submarinos) o no es nave.
export function navalAA(type) {
  const aa = NAVAL_AA[type];
  return aa && aa.km > 0 ? aa : null;
}

// Probabilidad REAL de que ese buque toque a ESTE avión, ya descontada su
// furtividad. Es la misma regla que usan los radares terrestres: el furtivo no
// anula el arma, anula que le vean venir. Por eso un B-2 cruza un grupo de
// combate y un B-52 no.
export function navalAAPk(ship, aircraft) {
  const aa = navalAA(ship.type);
  if (!aa) return 0;
  const rcs = rcsOf(aircraft);
  return Math.max(0, aa.pk * (1 - rcs * (1 - aa.antiStealth)));
}

// ¿Derriban el misil que viene hacia el buque? La última barrera, y depende del
// buque: un destructor moderno para más de la mitad, un transporte casi nada.
// Los antirradar son más difíciles de interceptar —vienen rápidos y bajos, y el
// buque tiene que elegir entre apagar el radar o seguir viéndolos—, así que se
// les aplica un descuento.
export function ciwsIntercept(state, ship, weaponId) {
  const aa = NAVAL_AA[ship.type];
  if (!aa || !aa.ciws) return false;
  const w = AIR_WEAPONS[weaponId];
  const dificil = w?.guia === "antirradar" ? 0.6 : 1;
  return Math.random() < aa.ciws * dificil;
}

// El antiaéreo enemigo que cubre al avión atacante le dispara de vuelta. Es el
// motivo de existir de los antirradar (HARM / Kh-31P): callar las baterías antes
// de meter la aviación de ataque.
//
// Dispara la batería TERRESTRE y también cualquier BUQUE con defensa propia.
// Entre todos los que llegan se elige al que más probabilidad tiene de acertar,
// que es como funciona de verdad: el enlace de datos reparte el blanco al que
// mejor tiro tiene, no al primero de la lista.
function samReaction(state, shooter) {
  const from = S.provinces.get(shooter.pos);
  if (!from) return null;
  let mejor = null;
  for (const e of state.units) {
    if (e.dead || e.embarked || e.owner === shooter.owner) continue;
    if (!atWar(state, shooter.owner, e.owner)) continue;
    const p = S.provinces.get(e.pos);
    if (!p) continue;
    const cat = unitDef(e.type)?.category || e.type;
    let R, pk, dmg;
    if (cat === "antiaereo") {
      R = (SAM_RANGE_KM[e.type] ?? SAM_RANGE_KM.antiaereo) * AIR_RANGE_SCALE;
      const rad = SAM_RADAR[e.type] || SAM_RADAR.antiaereo;
      pk = SAM_PK * (1 - rcsOf(shooter) * (1 - (rad?.antiStealth || 0)));
      dmg = SAM_DAMAGE;
    } else {
      const aa = navalAA(e.type);
      if (!aa) continue;
      R = aa.km * AIR_RANGE_SCALE;
      pk = navalAAPk(e, shooter);
      dmg = NAVAL_AA_DAMAGE;
    }
    if (!pk || tacticalKm(from, p) > R) continue;
    if (!mejor || pk > mejor.pk) mejor = { unidad: e, pk, dmg, naval: cat !== "antiaereo" };
  }
  if (!mejor) return null;

  const quien = mejor.naval
    ? `${unitDef(mejor.unidad.type)?.name} de ${S.countries[mejor.unidad.owner].name}`
    : `Antiaéreo de ${S.countries[mejor.unidad.owner].name}`;
  if (Math.random() >= mejor.pk) {
    log(state, `${quien} falla contra el atacante`, "war");
    return `${mejor.naval ? "la defensa del buque" : "el antiaéreo enemigo"} falló el disparo de respuesta`;
  }
  shooter.hp -= mejor.dmg;
  shooter.morale = Math.max(0, shooter.morale - (mejor.dmg / maxHp(shooter.type)) * 100 * C.MORALE_HIT);
  const sn = unitDef(shooter.type)?.name || shooter.type;
  if (shooter.hp <= 0) {
    shooter.dead = true;
    state.stats.lost[shooter.owner] = (state.stats.lost[shooter.owner] || 0) + 1;
    log(state, `${sn} DERRIBADO por ${quien}`, "war");
    return `¡tu avión fue derribado por ${mejor.naval ? "la defensa del buque" : "el antiaéreo"}!`;
  }
  log(state, `${sn} alcanzado por ${quien} (−${mejor.dmg} HP)`, "war");
  return `tu avión recibió ${mejor.dmg} HP de ${mejor.naval ? "la defensa del buque" : "el antiaéreo"}`;
}

// ---------- Impacto ----------

// La llama js/engine/missiles.js cuando expira el vuelo de un misil `air`.
export function resolveAirImpact(state, m) {
  const w = AIR_WEAPONS[m.weaponId];
  const t = state.units.find((x) => x.id === m.targetUnitId && !x.dead);
  if (!w) return;
  if (!t) return; // el blanco murió antes: el misil se pierde sin ruido

  // El enganche se revalida al llegar: si hubo paz o el blanco se salió de la
  // envolvente huyendo, el misil llega sin energía y falla.
  if (!atWar(state, m.owner, t.owner)) return;
  const from = S.provinces.get(m.fromId);
  const to = S.provinces.get(t.pos);
  const tn = unitDef(t.type)?.name || t.type;
  if (from && to && tacticalKm(from, to) > effRange(w) * 1.15) {
    log(state, `${w.nombre} pierde el enganche: ${tn} salió de la envolvente`, "war");
    return;
  }

  // Última barrera del buque: el CIWS intenta derribar el misil en el tramo
  // final. Va DESPUÉS de comprobar el enganche y ANTES de la tirada de impacto,
  // porque interceptar y fallar son cosas distintas y el parte debe distinguirlas.
  if (ciwsIntercept(state, t, m.weaponId)) {
    log(state, `${tn} DERRIBA el ${w.nombre} con su defensa de punto`, "war");
    return;
  }

  if (Math.random() >= m.pk) {
    log(state, `${w.nombre} FALLA contra ${tn}`, "war");
    return;
  }

  t.hp -= w.danio;
  // Porcentaje de vida perdida, no puntos: 45 de daño es media infantería y un
  // arañazo para un portaviones de 495.
  t.morale = Math.max(0, t.morale - (w.danio / maxHp(t.type)) * 100 * C.MORALE_HIT);
  if (t.hp <= 0) {
    t.dead = true;
    state.stats.lost[t.owner] = (state.stats.lost[t.owner] || 0) + 1;
    const verbo = AIR_LOADOUTS[t.type] ? "DERRIBADO" : "destruido";
    log(state, `${w.nombre} impacta: ${tn} de ${S.countries[t.owner].name} ${verbo}`, "war");
  } else {
    log(state, `${w.nombre} impacta en ${tn} (−${w.danio} HP, quedan ${Math.round(t.hp)})`, "war");
  }
}

// ---------- Rearme ----------

// Motivo por el que un avión NO puede rearmarse, o null si sí puede.
export function rearmBlocker(state, u) {
  if (!AIR_LOADOUTS[u.type]) return "No es una aeronave";
  // A bordo de un portaviones propio: los pañoles del buque hacen de base aérea
  if (u.embarked) {
    const nave = state.units.find((x) => x.id === u.embarked && !x.dead);
    if (nave && CARRIER_CAPACITY[nave.type]) {
      return nave.edgeLeft ? "El portaviones está navegando: no hay ciclo de vuelo" : null;
    }
    return "Embarcada en un transporte, no en un portaviones";
  }
  if (u.edgeLeft) return "En tránsito: debe aterrizar en la base";
  const ps = state.provinces[u.pos];
  if (!ps) return "Sobre el mar: no hay base donde rearmar";
  if (controller(ps) !== u.owner) return "La provincia no está bajo tu control";
  if ((ps.buildings.aerobase || 0) < REARM_MIN_AEROBASE) return "La provincia no tiene base aérea";
  return null;
}

// Estado de rearme para la interfaz: qué arma se está reponiendo y cuánto falta.
export function rearmStatus(state, u) {
  const L = AIR_LOADOUTS[u?.type];
  if (!L) return null;
  const ammo = ensureAmmo(u);
  const falta = Object.keys(L.armas).find((id) => (ammo[id] || 0) < L.armas[id]);
  if (!falta) return { completo: true };
  const blocker = rearmBlocker(state, u);
  const w = AIR_WEAPONS[falta];
  if (blocker) return { completo: false, blocker, weapon: w };
  const restante = Math.max(0, w.rearmeMin - (u.rearmT || 0));
  return {
    completo: false,
    weapon: w,
    minutosRestantes: restante,
    sinRecursos: !canAfford(state, u.owner, w.coste),
  };
}

// Repone munición mientras el avión está parado en una base aérea propia. Cada
// misil tarda lo suyo y se paga al reponerlo: una salida de F-22 con seis AMRAAM
// gastados son horas de pista y 27.000 $ de vuelta a la estantería.
export function tickRearm(state, dt) {
  for (const u of state.units) {
    if (u.dead) continue;
    const L = AIR_LOADOUTS[u.type];
    if (!L) continue; // los embarcados en portaviones SÍ rearman (rearmBlocker decide)
    const ammo = ensureAmmo(u);
    const falta = Object.keys(L.armas).find((id) => (ammo[id] || 0) < L.armas[id]);
    if (!falta) {
      u.rearmT = 0;
      continue;
    }
    if (rearmBlocker(state, u)) {
      u.rearmT = 0;
      continue;
    }
    const w = AIR_WEAPONS[falta];
    u.rearmT = (u.rearmT || 0) + dt;
    if (u.rearmT < w.rearmeMin) continue;
    if (!pay(state, u.owner, w.coste)) {
      u.rearmT = w.rearmeMin; // listo para cargar en cuanto haya recursos
      continue;
    }
    ammo[falta] = (ammo[falta] || 0) + 1;
    u.rearmT -= w.rearmeMin;
  }
}

// ---------- Aviación embarcada ----------

export function isCarrier(type) {
  return !!CARRIER_CAPACITY[type];
}

export function carrierCapacity(u) {
  return CARRIER_CAPACITY[u?.type] || 0;
}

export function isCarrierCapable(type) {
  return CARRIER_CAPABLE.has(type);
}

// Aeronaves a bordo. Se resuelve recorriendo `embarked` en vez de guardar una
// lista en el buque: una sola fuente de verdad, imposible que se desincronicen
// (y los guardados viejos no necesitan campo nuevo).
export function aircraftAboard(state, carrier) {
  if (!carrier || !CARRIER_CAPACITY[carrier.type]) return [];
  return state.units.filter((x) => !x.dead && x.embarked === carrier.id && AIR_LOADOUTS[x.type]);
}

// Portaviones propios en los que ESTE avión puede tomar cubierta ahora mismo:
// mismo sector de mar, buque parado, plaza libre y aparato apto para cubierta.
// La condición de plaza la define `carrierBerths` (movement.js), que es la misma
// que autoriza el destino al ordenar el vuelo: si el pathfinding te dejó llegar,
// aquí hay botón, sin dos listas de requisitos que se puedan desincronizar.
export function landingOptions(state, u) {
  if (!AIR_LOADOUTS[u?.type] || u.edgeLeft) return [];
  return carrierBerths(state, u, u.pos);
}

// Toma de cubierta. El avión tiene que haber VOLADO hasta la celda de mar del
// portaviones (los aéreos pueden entrar en el mar, ver canEnter en movement.js):
// no hay teletransporte desde tierra.
export function landOnCarrier(state, aircraftId, carrierId) {
  const u = state.units.find((x) => x.id === aircraftId && !x.dead);
  const c = state.units.find((x) => x.id === carrierId && !x.dead);
  if (!u || !c) return { ok: false, msg: "Unidad no encontrada" };
  if (!AIR_LOADOUTS[u.type]) return { ok: false, msg: "No es una aeronave" };
  if (!CARRIER_CAPACITY[c.type]) return { ok: false, msg: "Ese buque no es un portaviones" };
  if (c.owner !== u.owner) return { ok: false, msg: "El portaviones no es tuyo" };
  if (!CARRIER_CAPABLE.has(u.type)) {
    return { ok: false, msg: `${unitDef(u.type)?.name} no está preparado para cubierta (sin gancho ni alas plegables)` };
  }
  if (u.embarked) return { ok: false, msg: "Ya está embarcada" };
  if (u.edgeLeft || c.edgeLeft) return { ok: false, msg: "Avión y portaviones deben estar detenidos" };
  if (u.pos !== c.pos) return { ok: false, msg: "El avión debe volar hasta el sector del portaviones" };
  const aboard = aircraftAboard(state, c).length;
  const cap = CARRIER_CAPACITY[c.type];
  if (aboard >= cap) return { ok: false, msg: `Cubierta llena (${aboard}/${cap})` };

  u.embarked = c.id;
  u.path = [];
  u.edgeLeft = null;
  log(state, `${unitDef(u.type)?.name} toma cubierta en ${unitDef(c.type)?.name}`, "info");
  return { ok: true, msg: `Apontaje completado (${aboard + 1}/${cap})` };
}

// Despegue: el aparato aparece en el sector donde esté el buque AHORA, que es lo
// que hace útil llevarlo — el portaviones mueve su aviación con él.
export function launchFromCarrier(state, aircraftId) {
  const u = state.units.find((x) => x.id === aircraftId && !x.dead);
  if (!u || !u.embarked) return { ok: false, msg: "No está embarcada" };
  const c = state.units.find((x) => x.id === u.embarked && !x.dead);
  if (!c || !CARRIER_CAPACITY[c.type]) return { ok: false, msg: "No está en un portaviones" };
  if (c.edgeLeft) return { ok: false, msg: "El portaviones navega: no hay ciclo de vuelo" };
  u.embarked = null;
  u.pos = c.pos;
  u.path = [];
  u.edgeLeft = null;
  u.battleMinutes = 0;
  log(state, `${unitDef(u.type)?.name} despega de ${unitDef(c.type)?.name}`, "info");
  return { ok: true, msg: `${unitDef(u.type)?.name} en vuelo desde cubierta` };
}

// ---------- IA ----------

// La IA usa exactamente las mismas reglas: detecta con su radar, prioriza el
// blanco donde su mejor arma tiene más Pk y respeta munición, alcance y tránsito.
export function aiAirCombat(state, iso) {
  for (const u of state.units) {
    if (u.dead || u.owner !== iso || u.edgeLeft || u.embarked) continue;
    const L = AIR_LOADOUTS[u.type];
    if (!L) continue;
    const ammo = ensureAmmo(u);

    // 1) Amenaza aérea primero: un caza enemigo cerca es lo más urgente.
    // El alcance se calcula ANTES de escanear: un avión con los raíles vacíos no
    // recorre la lista de unidades (barato ahora, imprescindible a 400 unidades).
    const rAA = maxRange(L, ammo, "aa");
    if (rAA > 0) {
      const aire = radarContacts(state, u).filter((c) => c.km <= rAA);
      const disparo = aire.length ? mejorDisparo(state, u, ammo, aire, "aa") : null;
      if (disparo) {
        fireAirWeapon(state, u.id, disparo.weaponId, disparo.targetId);
        continue; // un misil por avión y por ciclo de IA
      }
    }

    // 2) Si no hay aire, castigar superficie
    const rAS = maxRange(L, ammo, "as");
    if (rAS > 0) {
      const suelo = groundContacts(state, u).filter((c) => c.km <= rAS);
      const disparo = suelo.length ? mejorDisparo(state, u, ammo, suelo, "as") : null;
      if (disparo) fireAirWeapon(state, u.id, disparo.weaponId, disparo.targetId);
    }
  }
}

function maxRange(L, ammo, tipo) {
  let max = 0;
  for (const id of Object.keys(L.armas)) {
    const w = AIR_WEAPONS[id];
    if (!w || w.tipo !== tipo || (ammo[id] || 0) <= 0) continue;
    if (effRange(w) > max) max = effRange(w);
  }
  return max;
}

// Mejor combinación arma/blanco: se maximiza Pk × daño, así el bot no malgasta
// un AMRAAM en un dron ni tira un Maverick contra infantería atrincherada.
function mejorDisparo(state, u, ammo, contactos, tipo) {
  let best = null;
  let bestScore = 0;
  for (const c of contactos) {
    for (const id of Object.keys(AIR_LOADOUTS[u.type].armas)) {
      const w = AIR_WEAPONS[id];
      if (!w || w.tipo !== tipo || (ammo[id] || 0) <= 0) continue;
      if (c.km > effRange(w)) continue;
      if (weaponCanTarget(w, c.unit)) continue;
      const score = pkFor(w, u, c.unit, c.km) * w.danio;
      if (score > bestScore) {
        bestScore = score;
        best = { weaponId: id, targetId: c.unit.id };
      }
    }
  }
  return best;
}
