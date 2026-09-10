// Arranque, bucle principal e interacción (pan/zoom/selección/órdenes).
import { initStatic, newGame, S, atWar, declareWar, makePeace, gameDay, unitDef } from "./engine/state.js";
import { tick } from "./engine/sim.js";
import { orderMove, orderStop } from "./engine/movement.js";
import { startAnnex, startBuilding, startRecruit, startResearch } from "./engine/economy.js";
import { embark, disembark } from "./engine/naval.js";
import { launchMissile, strikeWeaponsFor } from "./engine/missiles.js";
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
};

// Deselecciona la ficha de unidad y cierra su panel
function clearUnitSel() {
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

let acc = 0;
let lastT = 0;
let lastUi = 0;
let lastAutosave = 0;

const hooks = {
  selCountry: null,
  selectCountry(iso) {
    hooks.selCountry = iso;
    ui.selCountry = iso;
    UI.updateCountryCard(iso);
  },
  onPlayCountry(iso) {
    state = newGame(iso);
    window.__wardern = state; // hook de QA/pruebas automatizadas
    window.__wardernUI = { ui, renderer }; // hook de QA: vista y selecciones
    endShown = false;
    ui.mode = "game";
    ui.sel = null;
    ui.moveUnitId = null;
    ui.disembarkUnit = null;
    clearUnitSel();
    UI.hideStart();
    UI.showGame();
    updateUI();
  },
  onContinue() {
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
    window.__wardern = state; // hook de QA/pruebas automatizadas
    window.__wardernUI = { ui, renderer }; // hook de QA: vista y selecciones
    endShown = false;
    ui.mode = "game";
    ui.sel = null;
    ui.moveUnitId = null;
    ui.disembarkUnit = null;
    clearUnitSel();
    UI.hideStart();
    UI.showGame();
    updateUI();
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
      endShown = false;
      ui.mode = "game";
      ui.sel = null;
      ui.moveUnitId = null;
      ui.disembarkUnit = null;
      clearUnitSel();
      UI.hideStart();
      UI.showGame();
      updateUI();
      UI.toast("Partida importada");
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
    UI.toast(
      ui.moveIds.length > 1
        ? `Destino para ${ui.moveIds.length} unidades: clic en la provincia (clic derecho cancela)`
        : "Haz clic en la provincia de destino (clic derecho para cancelar)"
    );
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
    if (u && orderStop(state, u)) UI.toast("Orden cancelada: se detendrá al final del tramo actual");
    updateUI();
  },
  onCenter(pid) {
    renderer?.centerOn(pid);
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
  requestAnimationFrame(loop);
}

function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(100, t - lastT);
  lastT = t;
  if (state) {
    acc += dt;
    let steps = 0;
    while (acc >= C.TICK_MS && steps < 8) {
      tick(state);
      acc -= C.TICK_MS;
      steps++;
    }
    if (acc > C.TICK_MS) acc = 0;

    if (t - lastUi > 250) {
      lastUi = t;
      updateUI();
      pollEvents();
      checkEnd();
    }
    if (t - lastAutosave > 120000 && !state.gameOver) {
      lastAutosave = t;
      Save.saveGame(state);
    }
  }
  renderer?.draw(state, ui, t);
}

function updateUI() {
  if (!state) return;
  UI.updateTopBar(state);
  UI.updateProvincePanel(state, ui.sel, ui.moveUnitId);
  UI.updateUnitPanel(state, ui);
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
      ui.moveUnitId = null;
      ui.moveIds = null;
      ui.disembarkUnit = null;
      if (pid) {
        let ok = 0;
        for (const id of ids) {
          const u = state.units.find((x) => x.id === id && !x.dead);
          if (u && pid !== u.pos && orderMove(state, u, pid)) ok++;
        }
        UI.toast(
          ok === 0
            ? "Sin ruta hasta esa provincia"
            : ids.length > 1
              ? `Orden emitida a ${ok} de ${ids.length} unidades`
              : "Orden de movimiento emitida"
        );
      }
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
    UI.toast(orderMove(state, u, pid) ? "Orden de movimiento emitida" : "Sin ruta hasta esa provincia");
    updateUI();
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
      ui.disembarkUnit = null;
      ui.strike = null;
      clearUnitSel();
      ui.sel = null;
      updateUI();
    }
  });
}

boot();
