// Arranque, bucle principal e interacción (pan/zoom/selección/órdenes).
import { initStatic, newGame, S, atWar, declareWar, makePeace, gameDay, unitDef } from "./engine/state.js";
import { tick } from "./engine/sim.js";
import { orderMove, orderStop, neutralBlocker, orderReturnToBase, carrierBerths, orderPatrol, orderAttack } from "./engine/movement.js";
import { startAnnex, startBuilding, startRecruit, startResearch, trade, disbandUnit } from "./engine/economy.js";
import { embark, disembark } from "./engine/naval.js";
import { launchMissile, strikeWeaponsFor } from "./engine/missiles.js";
import { canShell, shellUnit, artilleryRange, shellDistance } from "./engine/artillery.js";
import { fireAirWeapon, landOnCarrier, launchFromCarrier, isCarrierCapable } from "./engine/air-combat.js";
import { aiRespondPeace } from "./engine/ai.js";
import { MapRenderer, hitProvince, inverseMercY } from "./render/renderer.js";
import * as UI from "./ui/panels.js";
import * as Save from "./save.js";
import * as C from "./data/constants.js";

const canvas = document.getElementById("map");

let state = null;
let renderer = null;
let endShown = false;
const ui = {
  sel: null, hover: null, moveUnitId: null, moveIds: null, disembarkUnit: null,
  strike: null, mode: "start", selCountry: null,
  // Selección de ficha en el mapa: la unidad concreta y la pila en la que va
  // (mismas unidades del mismo tipo apiladas en la celda) o, si no hay
  // inteligencia para identificarla, la provincia del contacto "?" marcado.
  selUnit: null, selStackIds: null, selUnknownPid: null, selUnknownCount: 0,
  // Radar del avión seleccionado (docs/AIR-COMBAT.md): aparato, modo aire-aire /
  // aire-suelo, arma elegida y contacto enganchado.
  radarUnit: null, radarMode: "aa", radarWeapon: null, radarTarget: null,
};

// Cierra el radar y suelta el enganche
function clearRadar() {
  ui.radarUnit = null;
  ui.radarWeapon = null;
  ui.radarTarget = null;
  ui.radarMode = "aa";
}

// Deselecciona la ficha de unidad y cierra su panel
function clearUnitSel() {
  clearRadar(); // el radar pertenece al aparato seleccionado
  ui.selUnit = null;
  ui.selStackIds = null;
  ui.selUnknownPid = null;
  ui.selUnknownCount = 0;
}

// Unidades que el render dibuja en la MISMA ficha que la seleccionada: mismo
// dueño, tipo y celda, todas quietas (las que viajan se dibujan sueltas).
function stackFor(id) {
  const u = state?.units.find((x) => x.id === id && !x.dead);
  if (!u) return [];
  if (u.edgeLeft || u.embarked) return [u.id];
  return state.units
    .filter((x) => !x.dead && !x.embarked && !x.edgeLeft && x.pos === u.pos && x.owner === u.owner && x.type === u.type)
    .map((x) => x.id);
}

let acc = 0;          // ms REALES pendientes de convertir en ticks
let lastSimT = 0;     // reloj de pared del último avance de simulación
let lastUi = 0;
let lastAutosave = 0;
let simTimer = null;  // temporizador de respaldo: mantiene vivo el motor sin frames
let frozenMs = 0;     // tiempo real que hubo que descartar (pestaña congelada / equipo suspendido)

// Reinicia el reloj real al empezar o cargar una partida: sin esto el primer
// pump() vería como "transcurrido" todo el tiempo desde la partida anterior.
function resetClock() {
  acc = 0;
  frozenMs = 0;
  lastSimT = Date.now();
  lastAutosave = Date.now();
}

// ---------- Progresión offline ----------
// El mundo sigue corriendo con la pestaña cerrada. Al cargar una partida se mide
// el tiempo REAL transcurrido desde el guardado y se adelanta la simulación esos
// minutos de juego. Es lo que hace viable el reloj lento: sin esto, una
// construcción de 3 horas reales no terminaría nunca.
//
// Se avanza a pasos de OFFLINE_STEP_MINUTES en vez de tick a tick porque el
// número de ticks lo fija TICK_MS, no el reloj de juego: una noche fuera serían
// cientos de miles de ticks y la pestaña se quedaría colgada al abrir.
async function catchUpOffline(s) {
  if (!s?.savedAt || s.gameOver) return null;
  const realMin = (Date.now() - s.savedAt) / 60000;
  if (realMin <= 0) return null;
  const porMinutoReal = (60000 / C.TICK_MS) * C.MINUTES_PER_TICK_BASE;
  const pedidos = realMin * porMinutoReal;
  if (pedidos < C.OFFLINE_MIN_GAME_MINUTES) return null;

  const recuperados = Math.min(pedidos, C.OFFLINE_MAX_GAME_MINUTES);
  const diaAntes = gameDay(s);
  const unidadesAntes = s.units.length;
  const logAntes = s.log.length;
  // Siempre a 1×: la pausa es una comodidad de la interfaz, no detiene el mundo
  // mientras no estás (y con speed 0 guardado, tick() no avanzaría nada).
  const speedPrev = s.speed;
  s.speed = 1;
  // Recuperar el tope (14 días) cuesta ~20 s con una partida avanzada: sin ceder
  // el hilo cada pocos pasos, el juego arrancaría con la pestaña congelada y sin
  // pintar nada. Con el cartel se ve que está trabajando.
  const cartel = offlineOverlay();
  let hecho = 0;
  for (let left = recuperados; left > 0; left -= C.OFFLINE_STEP_MINUTES) {
    tick(s, Math.min(C.OFFLINE_STEP_MINUTES, left));
    hecho += C.OFFLINE_STEP_MINUTES;
    if (hecho % (C.OFFLINE_STEP_MINUTES * 10) === 0) {
      cartel.textContent = `Recuperando el tiempo transcurrido… ${Math.min(100, Math.round((hecho / recuperados) * 100))} %`;
      await new Promise((r) => setTimeout(r, 0)); // deja pintar
    }
  }
  cartel.remove();
  s.speed = speedPrev;

  return {
    dias: Math.max(1, Math.round(gameDay(s) - diaAntes)),
    unidades: s.units.length - unidadesAntes,
    eventos: s.log.slice(logAntes).filter((e) => e.kind === "war").length,
    topado: pedidos > C.OFFLINE_MAX_GAME_MINUTES,
  };
}

// Cartel de "recuperando", creado a mano para no depender del panel de modales
// (que es de botones y aquí no hay nada que pulsar).
function offlineOverlay() {
  const el = document.createElement("div");
  el.className = "offline-overlay";
  el.textContent = "Recuperando el tiempo transcurrido… 0 %";
  document.body.appendChild(el);
  return el;
}

// Resumen de lo que pasó mientras no estabas. Modal y no toast: si te han
// declarado una guerra en ese hueco, no puede pasar desapercibido.
function reportOffline(res) {
  if (!res) return;
  const partes = [`Han pasado <b>${res.dias} día(s)</b> de juego mientras no estabas.`];
  if (res.eventos) partes.push(`<b>${res.eventos}</b> movimiento(s) de guerra en el parte.`);
  if (res.unidades > 0) partes.push(`Se han incorporado <b>${res.unidades}</b> unidades nuevas al mapa.`);
  else if (res.unidades < 0) partes.push(`Se han perdido <b>${-res.unidades}</b> unidades.`);
  if (res.topado) {
    partes.push(`El mundo se detuvo al llegar al tope de ${C.OFFLINE_MAX_GAME_MINUTES / 1440} días: llevabas demasiado fuera.`);
  }
  UI.showModal("Mientras no estabas", partes.join(" "), [{ label: "Continuar" }]);
}

const hooks = {
  selCountry: null,
  difficulty: C.DEFAULT_DIFFICULTY,
  selectCountry(iso) {
    hooks.selCountry = iso;
    ui.selCountry = iso;
    UI.updateCountryCard(iso);
  },
  setDifficulty(id) {
    if (C.DIFFICULTIES[id]) hooks.difficulty = id;
  },
  onPlayCountry(iso) {
    state = newGame(iso, hooks.difficulty);
    window.__wardern = state; // hook de QA/pruebas automatizadas
    window.__wardernUI = { ui, renderer }; // hook de QA: vista y selecciones
    endShown = false;
    ui.mode = "game";
    ui.sel = null;
    ui.moveUnitId = null;
    ui.disembarkUnit = null;
    clearUnitSel();
    resetClock();
    UI.hideStart();
    UI.showGame();
    updateUI();
  },
  async onContinue() {
    const s = Save.loadSave();
    if (!s) {
      UI.toast("No hay partida guardada");
      return;
    }
    // Compatibilidad: el guardado debe corresponder al mapa actual
    const compatible =
      s.provinces && Object.keys(s.provinces).every((id) => S.provinces.has(id));
    if (!compatible) {
      Save.clearSave();
      UI.toast("El guardado es de una versión anterior del mapa; se descartó");
      UI.showStart(false);
      return;
    }
    state = s;
    const offline = await catchUpOffline(state);
    window.__wardern = state; // hook de QA/pruebas automatizadas
    window.__wardernUI = { ui, renderer }; // hook de QA: vista y selecciones
    endShown = false;
    ui.mode = "game";
    ui.sel = null;
    ui.moveUnitId = null;
    ui.disembarkUnit = null;
    clearUnitSel();
    resetClock();
    UI.hideStart();
    UI.showGame();
    updateUI();
    reportOffline(offline);
  },
  onSpeed(v) {
    if (state) state.speed = v;
    updateUI();
  },
  onSave() {
    if (state && Save.saveGame(state)) UI.toast("Partida guardada");
  },
  onExport() {
    if (state) Save.exportGame(state);
  },
  async onImport(file) {
    try {
      const s = await Save.importGame(file);
      state = s;
      const offline = await catchUpOffline(state);
      endShown = false;
      ui.mode = "game";
      ui.sel = null;
      ui.moveUnitId = null;
      ui.disembarkUnit = null;
      clearUnitSel();
      resetClock();
      UI.hideStart();
      UI.showGame();
      updateUI();
      UI.toast("Partida importada");
      reportOffline(offline);
    } catch (e) {
      UI.toast("Archivo no válido: " + e.message);
    }
  },
  onNewGame() {
    UI.showModal(
      "Volver al inicio",
      "Se descartará la partida actual (el guardado manual se conserva). ¿Continuar?",
      [
        { label: "Cancelar" },
        {
          label: "Sí, salir",
          cls: "danger",
          cb: () => {
            state = null;
            endShown = false;
            ui.mode = "start";
            ui.sel = null;
            ui.moveUnitId = null;
            ui.disembarkUnit = null;
            clearUnitSel();
            UI.showGame();
            UI.showStart(Save.hasSave());
            document.querySelector(".end-screen")?.remove();
          },
        },
      ]
    );
  },
  onRecruit(pid, type) {
    if (!startRecruit(state, pid, type)) UI.toast("Recursos insuficientes");
    updateUI();
  },
  onBuild(pid, type) {
    if (!startBuilding(state, pid, type)) UI.toast("No se puede construir (recursos o límite)");
    updateUI();
  },
  onMove(unitId, ids) {
    ui.moveUnitId = unitId;
    ui.moveIds = ids?.length ? [...ids] : [unitId];
    ui.orderKind = "move";
    UI.toast(
      ui.moveIds.length > 1
        ? `Destino para ${ui.moveIds.length} unidades: clic en la provincia (clic derecho cancela)`
        : "Haz clic en la provincia de destino (clic derecho para cancelar)"
    );
  },
  // Patrulla aérea: mismo mecanismo de "elige destino en el mapa" que Mover,
  // pero al llegar el avión se queda dando vueltas un tiempo fijo (ver
  // AIR_PATROL_MINUTES) y vuelve solo a base al agotarse.
  onPatrol(unitId, ids) {
    ui.moveUnitId = unitId;
    ui.moveIds = ids?.length ? [...ids] : [unitId];
    ui.orderKind = "patrol";
    UI.toast("Haz clic en la provincia a patrullar (clic derecho para cancelar)");
  },
  // Atacar: se elige la FICHA enemiga en el mapa, no la provincia. La unidad va
  // a por ella y la sigue si se mueve (ver tickHunt en movement.js).
  onAttack(unitId, ids) {
    ui.moveUnitId = unitId;
    ui.moveIds = ids?.length ? [...ids] : [unitId];
    ui.orderKind = "attack";
    UI.toast("Haz clic en la ficha enemiga a atacar (clic derecho para cancelar)");
  },
  onSelectUnit(unitId, stackIds) {
    if (!state?.units.some((x) => x.id === unitId && !x.dead)) return;
    clearUnitSel();
    ui.selUnit = unitId;
    ui.selStackIds = stackIds?.length ? [...stackIds] : stackFor(unitId);
    updateUI();
  },
  onCloseUnit() {
    clearUnitSel();
    updateUI();
  },
  onStop(unitId) {
    const u = state?.units.find((x) => x.id === unitId && !x.dead);
    if (!u) return;
    // Aeronaves: detenerse en el aire no existe. Vuelven a la base propia más cercana.
    if (unitDef(u.type)?.air && !u.embarked) {
      const dest = orderReturnToBase(state, u);
      if (dest === u.pos) UI.toast("Ya está en su base: ruta cancelada");
      else if (dest) UI.toast(`Regresando a base: ${S.provinces.get(dest)?.name}`);
      else {
        orderStop(state, u);
        UI.toast("Sin base aérea propia alcanzable: se detiene donde pueda");
      }
      updateUI();
      return;
    }
    if (orderStop(state, u)) UI.toast("Orden cancelada: se detendrá al final del tramo actual");
    updateUI();
  },
  onCenter(pid) {
    renderer?.centerOn(pid);
  },
  onLand(aircraftId, carrierId) {
    const res = landOnCarrier(state, aircraftId, carrierId);
    UI.toast(res.msg);
    if (res.ok) clearRadar(); // el aparato pasa a cubierta: su radar deja de tener sentido
    updateUI();
  },
  onLaunchAir(aircraftId) {
    const res = launchFromCarrier(state, aircraftId);
    UI.toast(res.msg);
    if (res.ok) {
      ui.selUnit = aircraftId;
      ui.selStackIds = [aircraftId];
    }
    updateUI();
  },
  onRadar(unitId) {
    clearRadar();
    ui.radarUnit = unitId;
    updateUI();
  },
  onCloseRadar() {
    clearRadar();
    updateUI();
  },
  onRadarMode(mode) {
    ui.radarMode = mode === "as" ? "as" : "aa";
    ui.radarWeapon = null; // cada modo tiene sus armas
    ui.radarTarget = null;
    updateUI();
  },
  onRadarWeapon(weaponId) {
    ui.radarWeapon = weaponId;
    updateUI();
  },
  onRadarTarget(unitId) {
    ui.radarTarget = ui.radarTarget === unitId ? null : unitId;
    updateUI();
  },
  onFireAir(weaponId, targetId) {
    const res = fireAirWeapon(state, ui.radarUnit, weaponId, targetId);
    UI.toast(res.msg);
    updateUI();
  },
  onEmbark(unitId) {
    const res = embark(state, unitId);
    UI.toast(res.msg);
    updateUI();
  },
  onDisembarkMode(unitId) {
    ui.disembarkUnit = unitId;
    UI.toast("Haz clic en una provincia costera adyacente para desembarcar");
  },
  onStrike(unitId) {
    const u = state.units.find((x) => x.id === unitId && !x.dead);
    if (!u) return;
    const sw = strikeWeaponsFor(u.type)[0];
    if (!sw) return;
    ui.strike = { unitId, weaponId: sw.weapon.id };
    UI.toast(`${sw.weapon.nombre}: clic en la provincia/celda objetivo (clic derecho cancela) · ${sw.rangoKm} km de alcance`);
  },
  openResearch() {
    UI.showResearchPanel(state, hooks.onResearch);
  },
  openMarket() {
    if (state) UI.showMarketPanel(state, hooks.onTrade);
  },
  onTrade(res, qty, dir) {
    const r = trade(state, state.player, res, qty, dir);
    UI.toast(r.msg);
    updateUI();
  },
  onDisband(unitId) {
    const u = state?.units.find((x) => x.id === unitId && !x.dead);
    if (!u) return;
    UI.showModal(
      "Desbandar unidad",
      `Vas a licenciar <b>${unitDef(u.type)?.name ?? u.type}</b>. Deja de consumir suministros y combustible, pero no hay reembolso. ¿Continuar?`,
      [
        { label: "Cancelar" },
        {
          label: "Desbandar",
          cls: "danger",
          cb: () => {
            const r = disbandUnit(state, state.player, unitId);
            UI.toast(r.msg);
            if (r.ok) clearUnitSel();
            updateUI();
          },
        },
      ]
    );
  },
  onCenterCountry(iso) {
    const cap = S.countries[iso]?.capital;
    // La capital puede estar en manos de otro: se va a cualquier provincia que aún controle
    const pid = cap && S.provinces.has(cap) ? cap : S.provinceList.find((p) => !p.isSea && (state.provinces[p.id]?.occupier || state.provinces[p.id]?.owner) === iso)?.id;
    if (pid) renderer?.centerOn(pid);
  },
  onResearch(tierId) {
    if (!startResearch(state, state.player, tierId)) UI.toast("No se puede iniciar esa investigación");
    updateUI();
  },
  onAnnex(pid) {
    if (!startAnnex(state, pid)) UI.toast("No se puede anexar ahora");
    updateUI();
  },
  onWarDecl(iso) {
    declareWar(state, state.player, iso);
    updateUI();
  },
  onPeacePropose(iso) {
    if (aiRespondPeace(state, iso)) {
      makePeace(state, state.player, iso);
      UI.toast(`${S.countries[iso].name} acepta la paz`);
    } else {
      UI.toast(`${S.countries[iso].name} rechaza la paz`);
    }
    updateUI();
  },
};

async function boot() {
  try {
    await bootInner();
  } catch (e) {
    console.error("Error de arranque:", e);
    UI.showStartError("Error de arranque: " + (e?.stack || e?.message || e));
  }
}

async function bootInner() {
  let mapData, countriesData;
  try {
    [mapData, countriesData] = await Promise.all([
      import("./data/map-data.js"),
      import("./data/countries-data.js"),
    ]);
  } catch (e) {
    console.error(e);
    UI.showStartError("Error cargando datos: " + e.message);
    return;
  }
  initStatic(mapData.MAP, countriesData.COUNTRIES);
  if (!S.provinceList.length) {
    UI.showStartError("El mapa no tiene provincias (datos del mapa pendientes de generar).");
    return;
  }
  renderer = new MapRenderer(canvas);
  renderer.setMap();
  UI.initUI(hooks);
  UI.showStart(Save.hasSave());
  bindInput();
  bindClock();
  requestAnimationFrame(loop);
}

// Fuentes de tiempo del motor, aparte del bucle de dibujo.
function bindClock() {
  // Respaldo que sobrevive a la pestaña oculta. El navegador lo estrangula a
  // 1 vez/s en segundo plano (y a ~1 vez/min tras unos minutos), pero da igual:
  // cada disparo recupera TODO el tiempo real transcurrido de una vez.
  clearInterval(simTimer);
  simTimer = setInterval(() => pump(), C.SIM_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pump(); // cerrar la cuenta con el tiempo visible antes de irse
      return;
    }
    pump();
    if (state) updateUI();
    if (frozenMs > 60000) {
      UI.toast(`La pestaña estuvo congelada: se descartaron ${Math.round(frozenMs / 60000)} min de partida`);
    }
    frozenMs = 0;
  });
}

// Avance de la simulación. Se mide el tiempo REAL transcurrido desde la última
// llamada y se convierte en ticks, en vez de contar frames: así la partida sigue
// corriendo con la pestaña en segundo plano, donde no hay frames que contar.
//
// Lo llaman dos fuentes a la vez —el bucle de dibujo (mientras se ve) y un
// setInterval de respaldo (siempre)—; es seguro porque el que llega primero
// consume el tiempo transcurrido y el otro se encuentra con ~0.
function pump(now = Date.now()) {
  if (!state) {
    lastSimT = now;
    return;
  }
  const hidden = document.hidden;
  let elapsed = now - lastSimT;
  lastSimT = now;
  if (elapsed < 0) elapsed = 0; // el reloj del sistema puede ir hacia atrás

  // En pausa el reloj de juego no corre: se tira el tiempo real para que
  // reanudar no dispare de golpe la ráfaga de ticks acumulados.
  if (!state.speed || state.gameOver) {
    acc = 0;
  } else {
    acc += elapsed;
  }

  // Hueco descomunal: el equipo se suspendió o el navegador congeló la pestaña
  // del todo. Se recupera hasta el tope y el resto se da por perdido; sin este
  // corte, volver tras una noche bloquearía la pestaña recuperando horas.
  if (acc > C.MAX_CATCHUP_MS) {
    frozenMs += acc - C.MAX_CATCHUP_MS;
    acc = C.MAX_CATCHUP_MS;
  }

  // Presupuesto de trabajo por llamada: evita la "spiral of death". Lo que no
  // quepa se queda en `acc` y se sigue recuperando en las llamadas siguientes.
  // Visible se protege el frame; oculta se escala con el tiempo transcurrido,
  // porque un temporizador estrangulado a 1 disparo/min tiene que cubrir en esa
  // única llamada el minuto entero de simulación.
  const budget = hidden
    ? Math.min(C.CATCHUP_BUDGET_HIDDEN_MAX_MS, Math.max(250, elapsed * 0.35))
    : C.CATCHUP_BUDGET_MS;
  const t0 = performance.now();
  while (acc >= C.TICK_MS) {
    tick(state);
    acc -= C.TICK_MS;
    if (performance.now() - t0 > budget) break;
  }

  // Oculta no se toca el DOM: no hay nadie mirando y los eventos con modal deben
  // esperar a que el jugador vuelva para que no se pisen entre ellos.
  if (!hidden && now - lastUi > 250) {
    lastUi = now;
    updateUI();
    pollEvents();
  }
  checkEnd();

  // El autoguardado también pasa a reloj real: sigue funcionando en segundo plano
  if (now - lastAutosave > 120000 && !state.gameOver) {
    lastAutosave = now;
    Save.saveGame(state);
  }
}

// El bucle de animación ya SOLO dibuja: que el navegador lo pare con la pestaña
// oculta es lo correcto, no hay nada que mirar. La simulación va por su cuenta.
function loop(t) {
  requestAnimationFrame(loop);
  pump();
  renderer?.draw(state, ui, t);
}

function updateUI() {
  if (!state) return;
  UI.updateTopBar(state);
  UI.updateProvincePanel(state, ui.sel, ui.moveUnitId);
  UI.updateUnitPanel(state, ui);
  UI.updateRadarPanel(state, ui);
  UI.updateLog(state);
}

function pollEvents() {
  if (!state?.events?.length) return;
  const ev = state.events.shift();
  if (ev.type === "peace_offer") {
    const from = ev.from;
    UI.showModal(
      "Propuesta de paz",
      `${S.countries[from].name} propone firmar la paz contigo.`,
      [
        { label: "Rechazar" },
        { label: "Aceptar la paz", cls: "primary", cb: () => makePeace(state, state.player, from) },
      ]
    );
  }
}

function checkEnd() {
  if (state?.gameOver && !endShown) {
    endShown = true;
    state.speed = 0;
    UI.showEnd(state.gameOver.win, state, hooks.onNewGame);
  }
}

// Emite la orden a todas las unidades de la selección y resume el resultado
// Por qué no salió la orden. El caso que más despista es pedirle a un avión un
// sector de mar: sobre el agua no hay dónde posarse salvo la cubierta de un
// portaviones propio, parado y con plaza libre.
function moveFailMsg(ids, pid) {
  const u = state.units.find((x) => x.id === ids[0] && !x.dead);
  if (!S.provinces.get(pid)?.isSea || !u || !unitDef(u.type)?.air) {
    return "Sin ruta hasta esa provincia";
  }
  return isCarrierCapable(u.type)
    ? "Ahí no tienes ningún portaviones parado con plaza libre: un avión no puede quedarse sobre el mar"
    : `${unitDef(u.type)?.name} no opera desde portaviones: sobre el mar no tiene dónde aterrizar`;
}

function issueMove(ids, pid) {
  let ok = 0;
  for (const id of ids) {
    const u = state.units.find((x) => x.id === id && !x.dead);
    if (u && pid !== u.pos && orderMove(state, u, pid)) ok++;
  }
  // Rumbo a un portaviones: el apontaje es automático al llegar, conviene decirlo
  const buque = ok && S.provinces.get(pid)?.isSea
    ? carrierBerths(state, state.units.find((x) => x.id === ids[0]), pid)[0]
    : null;
  UI.toast(
    ok === 0
      ? moveFailMsg(ids, pid)
      : buque
        ? `Rumbo al ${unitDef(buque.type)?.name}: apontará al llegar`
        : ids.length > 1
          ? `Orden emitida a ${ok} de ${ids.length} unidades`
          : "Orden de movimiento emitida"
  );
  updateUI();
}

// Emite la orden de patrulla y resume el resultado (mismo patrón que issueMove)
function issuePatrol(ids, pid) {
  let ok = 0;
  for (const id of ids) {
    const u = state.units.find((x) => x.id === id && !x.dead);
    if (u && orderPatrol(state, u, pid)) ok++;
  }
  UI.toast(
    ok === 0
      ? "Solo los aviones sin embarcar pueden patrullar"
      : ids.length > 1
        ? `Patrulla ordenada a ${ok} de ${ids.length} aparatos`
        : `Patrullando ${S.provinces.get(pid)?.name}: vuelve a base sola al agotarse el tiempo`
  );
  updateUI();
}

// Movimiento/patrulla con aviso diplomático. Entrar en país neutral —por tierra
// o por aire— exige declararle la guerra, así que en vez de fallar con un "sin
// ruta" que no explica nada, se ofrece declararla ahí mismo. `issue` es
// issueMove o issuePatrol: mismo aviso, orden distinta al confirmar.
function tryOrderTo(ids, pid, issue) {
  if (!pid || !state) return;
  const iso = neutralBlocker(state, state.player, pid);
  if (!iso) {
    issue(ids, pid);
    return;
  }
  const nombre = S.countries[iso].name;
  const aereo = ids.some((id) => unitDef(state.units.find((x) => x.id === id)?.type)?.air);
  UI.showModal(
    "Territorio neutral",
    `No estás en guerra con <b>${nombre}</b>: ${aereo ? "su espacio aéreo y sus fronteras están cerrados" : "sus fronteras están cerradas"}.
     Para entrar tienes que declararle la guerra.`,
    [
      { label: "Cancelar" },
      {
        label: `Declarar guerra a ${nombre}`,
        cls: "danger",
        cb: () => {
          declareWar(state, state.player, iso);
          issue(ids, pid);
        },
      },
    ]
  );
}
function tryOrderMove(ids, pid) { tryOrderTo(ids, pid, issueMove); }

// La artillería ataca SIN moverse: si el blanco le entra en el alcance, dispara
// desde donde está. Solo las piezas fuera de alcance (y el resto de unidades)
// salen a por él. Así una batería no pierde su ventaja por pulsar "Atacar".
function issueAttack(ids, target) {
  let ok = 0;
  const salvas = [];
  const fallos = [];
  const aPie = [];
  for (const id of ids) {
    const u = state.units.find((x) => x.id === id && !x.dead);
    if (!u) continue;
    if (!canShell(u.type)) { aPie.push(u); continue; }
    const r = shellUnit(state, u, target);
    if (r.ok) salvas.push(u);
    else if (shellDistance(state, u, target.pos) > artilleryRange(u.type)) aPie.push(u); // lejos: que se acerque
    else fallos.push(r.msg); // en alcance pero no puede: recarga, munición, sin vista
  }
  for (const u of aPie) {
    if (orderAttack(state, u, target)) ok++;
  }
  const nombre = unitDef(target.type)?.name ?? target.type;
  const partes = [];
  if (salvas.length) {
    const km = Math.round(shellDistance(state, salvas[0], target.pos));
    partes.push(salvas.length > 1
      ? `${salvas.length} piezas abren fuego sobre ${nombre}`
      : `Fuego sobre ${nombre} a ${km} km, sin moverse`);
  }
  if (ok) partes.push(ok > 1 ? `${ok} unidades van a por él` : `Una unidad va a por él`);
  if (!partes.length) partes.push(fallos[0] || `No hay forma de llegar hasta ${nombre}`);
  UI.toast(partes.join(" · "));
  updateUI();
}

// Ataque a una FICHA concreta. Puede hacer falta declarar dos guerras a la vez:
// una al dueño de la unidad y otra a quien controle el suelo que hay que pisar
// para llegar (no siempre son el mismo país).
function tryOrderAttack(ids, hit, pid) {
  if (!state) return;
  if (!hit) {
    UI.toast("Ahí no hay ninguna ficha: haz clic justo encima de la unidad enemiga");
    return;
  }
  // Contacto sin identificar: no se sabe a QUIÉN se persigue, así que lo que se
  // ordena es avanzar sobre la provincia y que el combate salte al llegar.
  if (hit.unknown) {
    UI.toast("Contacto sin identificar: se ordena avanzar sobre su provincia");
    tryOrderMove(ids, hit.pid || pid);
    return;
  }
  const target = state.units.find((x) => x.id === hit.ids[0] && !x.dead);
  if (!target) return;
  if (target.owner === state.player) {
    UI.toast("Esa unidad es tuya");
    return;
  }
  const isos = new Set();
  if (!atWar(state, state.player, target.owner)) isos.add(target.owner);
  const suelo = neutralBlocker(state, state.player, target.pos);
  if (suelo) isos.add(suelo);
  if (!isos.size) {
    issueAttack(ids, target);
    return;
  }
  const nombres = [...isos].map((x) => S.countries[x].name).join(" y ");
  UI.showModal(
    "Declaración de guerra",
    `Para atacar a esa unidad tienes que declarar la guerra a <b>${nombres}</b>.`,
    [
      { label: "Cancelar" },
      {
        label: `Declarar guerra a ${nombres}`,
        cls: "danger",
        cb: () => {
          for (const x of isos) declareWar(state, state.player, x);
          issueAttack(ids, target);
        },
      },
    ]
  );
}
function tryOrderPatrol(ids, pid) { tryOrderTo(ids, pid, issuePatrol); }

// Tooltip de una ficha del mapa: nombre, país y HP (o el contacto sin identificar)
function unitTooltip(hit) {
  if (hit.unknown) {
    return `<b>Contacto sin identificar</b><div class="tt-country">${hit.unknown} unidad(es) · sin inteligencia</div>`;
  }
  const u = state.units.find((x) => x.id === hit.ids[0] && !x.dead);
  if (!u) return "";
  const T = unitDef(u.type);
  const c = S.countries[u.owner];
  const n = hit.ids.length;
  return `<b>${T?.name || u.type}${n > 1 ? ` ×${n}` : ""}</b>
    <div class="tt-country" style="color:${c?.color}">${c?.name || u.owner} · ${Math.round(u.hp)} HP</div>`;
}

// ---------- Entrada (ratón / teclado) ----------

function bindInput() {
  let dragging = false;
  let moved = false;
  let last = null;

  canvas.addEventListener("mousedown", (e) => {
    dragging = true;
    moved = false;
    last = [e.clientX, e.clientY];
    canvas.classList.add("dragging");
  });

  window.addEventListener("mousemove", (e) => {
    const tooltip = document.getElementById("tooltip");
    if (dragging) {
      const dx = e.clientX - last[0];
      const dy = e.clientY - last[1];
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      renderer.view.cx -= dx / renderer.view.scale;
      renderer.view.cy -= dy / renderer.view.scale;
      last = [e.clientX, e.clientY];
      tooltip.classList.add("hidden");
    } else if (renderer) {
      const w = renderer.s2w(e.clientX, e.clientY);
      const pid = hitProvince(w[0], inverseMercY(w[1]));
      if (!ui.moveUnitId) ui.hover = pid;

      // Ficha de unidad bajo el cursor: manda sobre el tooltip de la provincia
      const hit = state && !ui.moveUnitId && !ui.strike ? renderer.pickUnit(e.clientX, e.clientY) : null;
      canvas.classList.toggle("unit-hover", !!hit);
      if (hit) {
        tooltip.innerHTML = unitTooltip(hit);
        tooltip.style.left = Math.min(e.clientX + 14, window.innerWidth - 210) + "px";
        tooltip.style.top = (e.clientY + 16) + "px";
        tooltip.classList.remove("hidden");
        return;
      }
      if (pid) {
        const p = S.provinces.get(pid);
        const c = S.countries[p.country];
        tooltip.innerHTML = `<b>${p.name}</b>${p.country ? `<div class="tt-country" style="color:${c?.color}">${c?.name || p.country}</div>` : ""}`;
        tooltip.style.left = Math.min(e.clientX + 14, window.innerWidth - 160) + "px";
        tooltip.style.top = (e.clientY + 16) + "px";
        tooltip.classList.remove("hidden");
      } else {
        tooltip.classList.add("hidden");
      }
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove("dragging");
    if (moved) return;

    const w = renderer.s2w(e.clientX, e.clientY);
    const pid = hitProvince(w[0], inverseMercY(w[1]));

    if (ui.mode === "start") {
      if (pid) hooks.selectCountry(S.provinces.get(pid).country);
      return;
    }
    if (!state) return;

    if (ui.moveUnitId) {
      const ids = ui.moveIds?.length ? ui.moveIds : [ui.moveUnitId];
      const kind = ui.orderKind;
      ui.moveUnitId = null;
      ui.moveIds = null;
      ui.orderKind = null;
      ui.disembarkUnit = null;
      if (kind === "attack") tryOrderAttack(ids, renderer.pickUnit(e.clientX, e.clientY), pid);
      else if (pid) (kind === "patrol" ? tryOrderPatrol : tryOrderMove)(ids, pid);
      updateUI();
      return;
    }

    if (ui.strike) {
      const st = ui.strike;
      ui.strike = null;
      if (pid) {
        const res = launchMissile(state, st.unitId, st.weaponId, pid);
        UI.toast(res.msg);
      }
      updateUI();
      return;
    }

    if (ui.disembarkUnit) {
      const tid = ui.disembarkUnit;
      ui.disembarkUnit = null;
      if (pid) {
        const res = disembark(state, tid, pid);
        UI.toast(res.msg);
      }
      updateUI();
      return;
    }

    // Clic sobre una ficha de unidad: abre su hoja de datos (y de paso el panel de
    // la provincia, para tener a la vista el terreno y el resto de la guarnición).
    const hit = renderer.pickUnit(e.clientX, e.clientY);
    clearUnitSel();
    if (hit) {
      if (hit.unknown) {
        ui.selUnknownPid = hit.pid;
        ui.selUnknownCount = hit.unknown;
      } else {
        ui.selUnit = hit.ids[0];
        ui.selStackIds = [...hit.ids];
      }
      ui.sel = hit.pid;
      updateUI();
      return;
    }

    ui.sel = pid;
    updateUI();
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (!renderer) return;
    const [wx, wy] = renderer.s2w(e.clientX, e.clientY);
    const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    renderer.view.scale = Math.max(0.5, Math.min(200, renderer.view.scale * f));
    renderer.view.cx = wx - (e.clientX - renderer.w / 2) / renderer.view.scale;
    renderer.view.cy = wy - (e.clientY - renderer.h / 2) / renderer.view.scale;
  }, { passive: false });

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    // Con un modo de orden abierto, el clic derecho solo lo cancela
    if (ui.moveUnitId || ui.strike || ui.disembarkUnit) {
      if (ui.strike) UI.toast("Lanzamiento de misil cancelado");
      ui.moveUnitId = null;
      ui.moveIds = null;
      ui.orderKind = null;
      ui.disembarkUnit = null;
      ui.strike = null;
      updateUI();
      return;
    }
    // Con una unidad propia seleccionada: orden de movimiento directa al destino
    if (!state || !ui.selUnit) return;
    const u = state.units.find((x) => x.id === ui.selUnit && !x.dead);
    if (!u || u.owner !== state.player || u.embarked) return;
    const w = renderer.s2w(e.clientX, e.clientY);
    const pid = hitProvince(w[0], inverseMercY(w[1]));
    if (!pid || pid === u.pos) return;
    tryOrderMove([u.id], pid);
  });

  window.addEventListener("keydown", (e) => {
    if (!state) return;
    if (e.code === "Space") {
      e.preventDefault();
      state.speed = state.speed ? 0 : 1;
      updateUI();
    }
    if (e.key === "Escape") {
      ui.moveUnitId = null;
      ui.moveIds = null;
      ui.orderKind = null;
      ui.disembarkUnit = null;
      ui.strike = null;
      clearUnitSel();
      ui.sel = null;
      updateUI();
    }
  });
}

boot();
