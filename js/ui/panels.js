// UI DOM: pantallas, barra superior, panel de provincia, registro y modales.
import { ICONS } from "./icons.js";
import * as C from "../data/constants.js";
import { UNIT_CATEGORIES } from "../data/units-data.js";
import { NAVAL_CATEGORIES } from "../data/naval-data.js";
import {
  S, unitDef, isNaval, controller, unitsIn, atWar, visibleProvinces, intel,
  availableVariants, doctrineVariants, TIERS, DOCTRINES,
} from "../engine/state.js";
import { vetLevel } from "../engine/combat.js";
import { strikeWeaponsFor } from "../engine/missiles.js";
import {
  airLoadout, airWeapons, radarContacts, groundContacts, pkFor, weaponCanTarget,
  rearmStatus, radarRangeKm, bearingDeg, effRange, rcsOf,
  isCarrier, carrierCapacity, aircraftAboard, landingOptions,
} from "../engine/air-combat.js";
import { AIR_WEAPONS } from "../data/air-combat-data.js";
import { buildingCost, canAfford } from "../engine/economy.js";
import { drawUnitSymbol } from "../render/symbols.js";
import { ANNEX_COST } from "../data/constants.js";

let hooks = null;
let lastLogLen = 0;
let toastTimer = null;

const $ = (id) => document.getElementById(id);

export function initUI(h) {
  hooks = h;

  document.querySelectorAll(".tb-speeds button").forEach((b) => {
    b.addEventListener("click", () => hooks.onSpeed(parseInt(b.dataset.speed, 10)));
  });
  $("btn-save").addEventListener("click", () => hooks.onSave());
  $("btn-export").addEventListener("click", () => hooks.onExport());
  $("btn-newgame").addEventListener("click", () => hooks.onNewGame());
  $("btn-import").addEventListener("click", () => $("file-import").click());
  $("file-import").addEventListener("change", (e) => {
    if (e.target.files[0]) hooks.onImport(e.target.files[0]);
    e.target.value = "";
  });
  $("btn-continue").addEventListener("click", () => hooks.onContinue());
  $("btn-research").addEventListener("click", () => hooks.openResearch());
  $("cc-play").addEventListener("click", () => {
    if (hooks.selCountry) hooks.onPlayCountry(hooks.selCountry);
  });
}

// ---------- Pantalla de inicio ----------

export function showStart(hasSave) {
  $("start-screen").classList.remove("hidden");
  $("game-ui").classList.add("hidden");
  $("country-card").classList.add("hidden");
  $("btn-continue").classList.toggle("hidden", !hasSave);
}

export function showStartError(msg) {
  const el = $("start-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

export function updateCountryCard(iso) {
  const c = S.countries[iso];
  if (!c) return;
  const own = S.provinceList.filter((p) => p.country === iso);
  const pop = own.reduce((s, p) => s + (p.pop || 0), 0);
  const vp = own.reduce((s, p) => s + (p.vp || 0), 0);
  const totalVP = S.provinceList.reduce((s, p) => s + (p.vp || 0), 0) || 1;
  const capital = own.find((p) => p.capital);
  $("cc-flag").style.background = c.color;
  $("cc-name").textContent = c.name;
  $("cc-stats").innerHTML = `
    <div>Provincias: <b>${own.length}</b></div>
    <div>Población: <b>${(pop / 1e6).toFixed(1)} M</b></div>
    <div>Puntos de victoria: <b>${((vp / totalVP) * 100).toFixed(1)}%</b> del continente</div>
    <div>Capital: <b>${capital ? capital.name : "—"}</b></div>`;
  $("country-card").classList.remove("hidden");
}

export function hideStart() {
  $("start-screen").classList.add("hidden");
}

export function showGame() {
  $("game-ui").classList.remove("hidden");
  lastLogLen = 0;
  $("event-log").innerHTML = "";
}

// ---------- Barra superior ----------

export function updateTopBar(state) {
  const c = S.countries[state.player];
  $("tb-flag").style.background = c.color;
  $("tb-name").textContent = c.name;
  $("tb-date").textContent = C.fmtGameDate(state.time);

  const r = state.countries[state.player].resources;
  const flow = state.flow?.[state.player] || {};
  $("tb-resources").innerHTML = C.RES_INFO.map(({ key, name, icon }) => {
    const f = flow[key] || 0;
    const cls = f < 0 ? "delta neg" : "delta";
    const sign = f >= 0 ? "+" : "";
    return `<div class="res" title="${name}">${ICONS[key] || ""}<span>${C.fmtInt(r[key])}</span><span class="${cls}">${sign}${C.fmtInt(f)}/h</span></div>`;
  }).join("");

  document.querySelectorAll(".tb-speeds button").forEach((b) => {
    b.classList.toggle("active", parseInt(b.dataset.speed, 10) === state.speed);
  });
}

// ---------- Panel de provincia ----------

// Dibuja TODOS los canvas de icono del panel con nitidez: el canvas se rasteriza
// a devicePixelRatio (si no, el navegador lo estira y se ve pixelado en pantallas
// con escala 125-150%) y el sprite se centra según el tamaño lógico de cada uno.
function drawPanelIcons(panel) {
  const dpr = window.devicePixelRatio || 1;
  panel.querySelectorAll("canvas[data-symbol]").forEach((cv) => {
    const w = parseInt(cv.getAttribute("width"), 10) || 34;
    const h = parseInt(cv.getAttribute("height"), 10) || 28;
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    g.imageSmoothingQuality = "high";
    drawUnitSymbol(g, cv.dataset.symbol, w / 2, h / 2, Math.round(Math.min(w, h) * 0.74), cv.dataset.color, {
      variant: cv.dataset.variant,
    });
  });
}

// Botón de golpe con misiles en filas de unidad propia (docs/MISSILES.md)
function strikeButtonsFor(state, u) {
  const sws = strikeWeaponsFor(u.type);
  if (!sws.length) return "";
  return sws
    .map(({ weapon }) => {
      const cd = u.mslCd?.[weapon.id] || 0;
      if (cd > 0) {
        return `<button class="btn small" disabled title="${weapon.nombre} recargando (${Math.ceil(cd / 60)} h)">🚀 ${Math.ceil(cd / 60)}h</button>`;
      }
      return `<button class="btn small" data-strike="${u.id}" title="${weapon.nombre}: listo — ${C.fmtInt(weapon.coste.money)}$ + ${C.fmtInt(weapon.coste.fuel)} fuel. Clic y elige el objetivo">🚀 Misil</button>`;
    })
    .join("");
}

export function updateProvincePanel(state, selId, moveUnitId) {
  const panel = $("province-panel");
  // las celdas de mar no tienen entrada dinámica, pero sí panel (flota anclada)
  if (!selId || (!state.provinces[selId] && !S.provinces.get(selId)?.isSea)) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  const p = S.provinces.get(selId);
  const ps = state.provinces[selId];

  // Celda de mar: panel mínimo con las naves ancladas
  if (p.isSea) {
    const units = unitsIn(state, selId).filter((u) => !u.embarked);
    let html = `<div class="pp-head"><span class="pp-name">⚓ Alta mar</span></div>`;
    html += `<div class="pp-sub">Sector naval · las flotas viajan entre celdas de mar.</div>`;
    html += `<div class="pp-section"><h4>Flota (${units.length})</h4>`;
    if (!units.length) html += `<div class="garrison-note">Sin naves a la vista.</div>`;
    for (const u of units) {
      const un = unitDef(u.type);
      const isMine = u.owner === state.player;
      const strike = isMine && !u.edgeLeft ? strikeButtonsFor(state, u) : "";
      html += `<div class="unit-row" data-unit="${u.id}">
        <canvas width="56" height="45" style="flex-shrink:0" data-symbol="${un.icon}" data-variant="${u.type}" data-color="${S.countries[u.owner].color}"></canvas>
        <div>${un.name}${isMine ? "" : ` (${S.countries[u.owner].name})`}
          ${u.cargo?.length ? `<div class="cost">Carga: ${u.cargo.length} unidades</div>` : ""}
          <div class="hpbar"><div style="width:${Math.max(0, u.hp)}%"></div></div>
        </div>
        <span class="uhp">${Math.round(u.hp)} HP</span>
        ${isMine ? `<button class="btn small" data-move="${u.id}" ${moveUnitId === u.id ? "disabled" : ""}>Mover</button>
        <button class="btn small" data-embark="${u.id}">Embarcar</button>
        <button class="btn small" data-disembark="${u.id}" ${u.cargo?.length ? "" : "disabled"}>Desembarcar</button>${strike}` : ""}
      </div>`;
    }
    html += `</div>`;
    panel.innerHTML = html;
    drawPanelIcons(panel);
    panel.querySelectorAll("[data-move]").forEach((b) =>
      b.addEventListener("click", () => hooks.onMove(parseInt(b.dataset.move, 10)))
    );
    panel.querySelectorAll("[data-embark]").forEach((b) =>
      b.addEventListener("click", () => hooks.onEmbark(parseInt(b.dataset.embark, 10)))
    );
    panel.querySelectorAll("[data-disembark]").forEach((b) =>
      b.addEventListener("click", () => hooks.onDisembarkMode(parseInt(b.dataset.disembark, 10)))
    );
    panel.querySelectorAll("[data-strike]").forEach((b) =>
      b.addEventListener("click", () => hooks.onStrike(parseInt(b.dataset.strike, 10)))
    );
    panel.querySelectorAll(".unit-row[data-unit]").forEach((row) =>
      row.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        hooks.onSelectUnit(parseInt(row.dataset.unit, 10));
      })
    );
    return;
  }

  const ownerC = S.countries[ps.owner];
  const ctrl = controller(ps);
  const mine = ps.owner === state.player && (!ps.occupier || ps.occupier === state.player);
  const occupiedByMe = ps.occupier === state.player && ps.owner !== state.player;
  const vis = visibleProvinces(state);
  const it = intel(state); // niveles: strong = identifica unidades, union = al menos las cuenta
  const strongIntel = it.strong.has(selId);
  const anyIntel = it.union.has(selId);

  const prod = {
    money: Math.round((p.prod.money || 0) * (ps.occupier && ps.occupier !== ps.owner ? C.OCCUPY_SHARE : 1)),
    supplies: Math.round(((p.prod.supplies || 0) + ps.buildings.industria * C.INDUSTRY_SUPPLIES) * (ps.occupier && ps.occupier !== ps.owner ? C.OCCUPY_SHARE : 1)),
    fuel: Math.round((p.prod.fuel || 0) * (ps.occupier && ps.occupier !== ps.owner ? C.OCCUPY_SHARE : 1)),
    manpower: Math.round(((p.prod.manpower || 0) + ps.buildings.reclutamiento * C.RECRUIT_MANPOWER) * (ps.occupier && ps.occupier !== ps.owner ? C.OCCUPY_SHARE : 1)),
  };

  let html = `
    <div class="pp-head">
      <span class="pp-name">${p.name}</span>
      <span class="pp-owner" style="color:${ownerC.color}">${ownerC.name}</span>
    </div>
    <div class="pp-sub">
      ${C.TERRAIN_NAMES[p.terrain] || p.terrain}${p.capital ? " · ★ Capital" : ""} ·
      Pob. <b>${(p.pop / 1e6).toFixed(1)} M</b> · VP <b>${p.vp}</b><br>
      Producción/h: <b>${prod.money}</b>$ · <b>${prod.supplies}</b> sumin · <b>${prod.fuel}</b> comb · <b>${prod.manpower}</b> MO
      ${ps.occupier && ps.occupier !== ps.owner ? `<br><span style="color:var(--danger)">Ocupada por ${S.countries[ps.occupier].name} (25% producción)</span>` : ""}
    </div>`;

  // Cola en curso
  if (ps.queue) {
    const q = ps.queue;
    const label =
      q.kind === "unit" || q.kind === "naval"
        ? unitDef(q.type)?.name ?? q.type
        : q.kind === "annex"
          ? "Anexión"
          : C.BUILDINGS[q.type].name;
    const pct = Math.round((1 - q.minutesLeft / q.total) * 100);
    // miniatura del sprite de la unidad en construcción (variante real)
    const thumb =
      q.kind === "unit" || q.kind === "naval"
        ? `<canvas width="42" height="34" data-symbol="${unitDef(q.type)?.icon}" data-variant="${q.type}" data-color="${S.countries[state.player].color}"></canvas>`
        : "";
    html += `<div class="queue-box" style="display:flex;align-items:center;gap:8px">${thumb}<div>${label} — ${Math.ceil(q.minutesLeft / 60)} h restantes
      <div class="progress"><div style="width:${pct}%"></div></div></div></div>`;
  }

  // Construcción y reclutamiento (solo en provincias propias controladas)
  if (mine && !ps.queue) {
    html += `<div class="pp-section"><h4>Construir</h4>`;
    const hasCoast = (S.edges.get(selId) || []).some((e) => S.provinces.get(e.to)?.isSea);
    for (const [key, b] of Object.entries(C.BUILDINGS)) {
      if (key === "puerto" && !hasCoast) {
        html += `<div class="build-row"><div>${b.name} <span class="cost">(nv 0/${b.max}) · requiere costa</span></div>
          <button class="btn small" disabled title="🔒 ${b.name}: esta provincia no tiene salida al mar">Construir</button></div>`;
        continue;
      }
      const level = (ps.buildings[key] || 0);
      const maxed = level >= b.max;
      // El coste del SIGUIENTE nivel, con su `costGrowth`. Antes se pintaba el
      // coste base de nivel 0 para todo salvo la fortaleza (y a esa se le aplicaba
      // una fórmula lineal que tampoco era la del motor): el panel ofrecía un
      // puerto de nivel 3 por 30.000 $ cuando el motor cobraba 240.000, así que el
      // botón salía habilitado, el cobro fallaba y parecía que no se construía nada.
      const cost = buildingCost(key, level);
      const r = state.countries[state.player].resources;
      const afford = canAfford(state, state.player, cost);
      let why = "";
      if (maxed) why = "Nivel máximo alcanzado";
      else if (!afford) {
        const falta = [];
        if (r.money < cost.money) falta.push(`${C.fmtInt(cost.money - r.money)}$`);
        if (r.supplies < cost.supplies) falta.push(`${C.fmtInt(cost.supplies - r.supplies)} suministros`);
        why = "Recursos insuficientes: faltan " + falta.join(", ");
      }
      html += `<div class="build-row"><div>${b.name} <span class="cost">(nv ${level}/${b.max}) · ${C.fmtInt(cost.money)}$${cost.supplies ? " + " + C.fmtInt(cost.supplies) + " sumin" : ""} · ${b.desc}</span></div>
        <button class="btn small" data-build="${key}" ${maxed || !afford ? "disabled" : ""} ${why ? `title="${why}"` : ""}>${maxed ? "Máx" : "Construir"}</button></div>`;
    }
    html += `</div>${recruitSection(state, selId, ps)}`;
  }

  function recruitSection(state, selId, ps) {
    const iso = state.player;
    const r = state.countries[iso].resources;
    const researched = state.countries[iso].researchedTier ?? 1; // tier inicial de toda partida (newGame)
    let html = `<div class="pp-section"><h4>Reclutar</h4>`;
    const rowsFor = (variants) => {
      for (const u of variants) {
        const tier = u.tier ?? 1;
        const lockedTier = tier > researched;
        const lockedBase = u.air && (ps.buildings.aerobase || 0) < tier;
        const lockedPort = isNaval(u.id) && (ps.buildings.puerto || 0) < (u.minPortLevel ?? 1);
        const afford = r.money >= u.cost.money && r.supplies >= u.cost.supplies
          && r.manpower >= u.cost.manpower && r.fuel >= (u.cost.fuel || 0);
        let req = "";
        if (lockedTier) req = ` · 🔒 investigación T${tier}`;
        else if (lockedBase) req = ` · 🔒 Base aérea nivel ${tier}`;
        else if (lockedPort) req = ` · 🔒 Puerto nivel ${u.minPortLevel ?? 1}`;
        // Motivo(s) completo(s) para el tooltip al pasar el cursor
        const why = [];
        if (u.doctrine && u.doctrine !== state.countries[iso].doctrine) why.push("⚠ Doctrina incompatible con tu país");
        if (lockedTier) why.push(`🔒 Requiere investigación: ${TIERS.find((t) => t.id === tier)?.name ?? "nivel " + tier} (tier ${tier})`);
        if (lockedBase) why.push(`✈ Requiere Base aérea nivel ${tier} construida en ESTA provincia`);
        if (lockedPort) why.push(`⚓ Requiere Puerto nivel ${u.minPortLevel ?? 1} en esta provincia`);
        if (!afford) {
          const falta = [];
          if (r.money < u.cost.money) falta.push(`${C.fmtInt(u.cost.money - r.money)}$`);
          if (r.supplies < u.cost.supplies) falta.push(`${C.fmtInt(u.cost.supplies - r.supplies)} suministros`);
          if (r.manpower < u.cost.manpower) falta.push(`${C.fmtInt(u.cost.manpower - r.manpower)} MO`);
          if (r.fuel < (u.cost.fuel || 0)) falta.push(`${C.fmtInt(u.cost.fuel - r.fuel)} combustible`);
          why.push("Recursos insuficientes: faltan " + falta.join(", "));
        }
        html += `<div class="build-row"><canvas width="42" height="34" style="flex-shrink:0" data-symbol="${u.icon}" data-variant="${u.id}" data-color="${state.countries[iso].color}"></canvas><div>${u.name} <span class="cost">T${tier} · ${C.fmtInt(u.cost.money)}$ · ${C.fmtInt(u.cost.supplies)} sumin · ${C.fmtInt(u.cost.manpower)} MO · ${u.buildHours}h${req}</span></div>
          <button class="btn small" data-recruit="${u.id}" ${lockedTier || lockedBase || lockedPort || !afford ? "disabled" : ""} ${why.length ? `title="${why.join("&#10;")}"` : ""}>Reclutar</button></div>`;
      }
    };
    for (const cat of UNIT_CATEGORIES) {
      const variants = doctrineVariants(state, iso, cat.id);
      if (!variants.length) continue;
      html += `<div class="cost" style="margin-top:6px"><b>${cat.name}${cat.air ? " ✈" : ""}</b></div>`;
      rowsFor(variants);
    }
    const coastal = (S.edges.get(selId) || []).some((e) => S.provinces.get(e.to)?.isSea);
    if (coastal) {
      for (const cat of NAVAL_CATEGORIES) {
        const variants = doctrineVariants(state, iso, cat.id);
        if (!variants.length) continue;
        html += `<div class="cost" style="margin-top:6px"><b>⚓ ${cat.name}</b></div>`;
        rowsFor(variants);
      }
    }
    html += `</div>`;
    return html;
  }

  if (occupiedByMe && !ps.queue) {
    const cost = ANNEX_COST(p.pop);
    html += `<div class="pp-section"><h4>Integración</h4>
      <div class="build-row"><div>Anexionar <span class="cost">${C.fmtInt(cost)}$ · 5 días</span></div>
      <button class="btn small" id="pp-annex" ${state.countries[state.player].resources.money >= cost ? "" : "disabled"}>Anexionar</button></div></div>`;
  }

  // Guarnición con niveles de inteligencia (estilo CoN): con inteligencia fuerte
  // se ven las unidades exactas; débil (solo adyacencia) muestra contactos "?".
  const units = anyIntel ? unitsIn(state, selId).filter((u) => !u.embarked) : [];
  const shownUnits = strongIntel ? units : units.filter((u) => u.owner === state.player);
  const desconocidos = units.length - shownUnits.length;
  html += `<div class="pp-section"><h4>Guarnición (${units.length})</h4>`;
  if (!anyIntel) html += `<div class="garrison-note">Sin inteligencia: provincia fuera de tu zona de visión.</div>`;
  else if (desconocidos > 0) {
    html += `<div class="garrison-note">❓ Contactos sin identificar: ${desconocidos} unidad(es). Envía un dron o entra con tus tropas para identificarlas.</div>`;
  }
  if (anyIntel && !units.length) html += `<div class="garrison-note">Sin unidades.</div>`;
  for (const u of shownUnits) {
    const un = unitDef(u.type);
    if (!un) continue;
    const isMine = u.owner === state.player;
    const color = S.countries[u.owner].color;
    const vet = vetLevel(u);
    const cargo = u.cargo?.length ? ` <span class="cost">[carga: ${u.cargo.length}]</span>` : "";
    html += `<div class="unit-row" data-unit="${u.id}">
      <canvas width="56" height="45" style="flex-shrink:0" data-symbol="${un.icon}" data-variant="${u.type}" data-color="${color}"></canvas>
      <div>${un.name}${vet ? ` <span style="color:#ffe9a0">${"▲".repeat(vet)}</span>` : ""}${isMine ? "" : ` <span style="color:${color}">(${S.countries[u.owner].name})</span>`}${cargo}
        <div class="hpbar"><div style="width:${Math.max(0, u.hp)}%"></div></div>
      </div>
      <span class="uhp">${Math.round(u.hp)} HP · ${Math.round(u.morale * 100)}%</span>
      ${isMine && !u.edgeLeft ? `<button class="btn small" data-move="${u.id}" ${moveUnitId === u.id ? "disabled" : ""}>Mover</button>${strikeButtonsFor(state, u)}` : ""}
    </div>`;
  }
  html += `</div>`;

  // Flota en las celdas de mar adyacentes. Los barcos se botan AL MAR, no dentro
  // de la provincia, así que sin esto construías un portaviones, mirabas el puerto
  // y no veías nada: el barco estaba en el océano de al lado, sin que nada lo dijera.
  const seaEdges = (S.edges.get(selId) || []).map((e) => e.to).filter((id) => S.provinces.get(id)?.isSea);
  if (seaEdges.length) {
    const fleet = [];
    for (const seaId of seaEdges) {
      for (const u of unitsIn(state, seaId)) {
        if (u.embarked) continue;
        if (u.owner !== state.player && !vis.has(seaId)) continue;
        fleet.push(u);
      }
    }
    if (fleet.length) {
      html += `<div class="pp-section"><h4>Mar adyacente (${fleet.length})</h4>`;
      for (const u of fleet) {
        const un = unitDef(u.type);
        if (!un) continue;
        const color = S.countries[u.owner].color;
        const mine2 = u.owner === state.player;
        html += `<div class="unit-row" data-unit="${u.id}">
          <canvas width="56" height="45" style="flex-shrink:0" data-symbol="${un.icon}" data-variant="${u.type}" data-color="${color}"></canvas>
          <div>${un.name}${mine2 ? "" : ` <span style="color:${color}">(${S.countries[u.owner].name})</span>`}
            <div class="cost">⚓ ${S.provinces.get(u.pos)?.isSea ? "fondeado en alta mar" : ""}</div>
            <div class="hpbar"><div style="width:${Math.max(0, u.hp)}%"></div></div>
          </div>
          <span class="uhp">${Math.round(u.hp)} HP</span>
        </div>`;
      }
      html += `</div>`;
    }
  }

  // Diplomacia con el controlador extranjero
  if (ctrl !== state.player) {
    const war = atWar(state, state.player, ctrl);
    html += `<div class="pp-section"><h4>Diplomacia — ${S.countries[ctrl].name}</h4>
      <div class="diplo-row">
        ${war
          ? `<button class="btn small" id="pp-peace">Proponer paz</button>`
          : `<button class="btn small danger" id="pp-war">Declarar guerra</button>`}
      </div></div>`;
  }

  panel.innerHTML = html;

  // Iconos de unidad en los canvas del panel
  drawPanelIcons(panel);

  panel.querySelectorAll("[data-build]").forEach((b) =>
    b.addEventListener("click", () => hooks.onBuild(selId, b.dataset.build))
  );
  panel.querySelectorAll("[data-recruit]").forEach((b) =>
    b.addEventListener("click", () => hooks.onRecruit(selId, b.dataset.recruit))
  );
  panel.querySelectorAll("[data-move]").forEach((b) =>
    b.addEventListener("click", () => hooks.onMove(parseInt(b.dataset.move, 10)))
  );
  panel.querySelectorAll("[data-strike]").forEach((b) =>
    b.addEventListener("click", () => hooks.onStrike(parseInt(b.dataset.strike, 10)))
  );
  // La fila entera abre la ficha de la unidad; los botones internos conservan lo suyo.
  panel.querySelectorAll(".unit-row[data-unit]").forEach((row) =>
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      hooks.onSelectUnit(parseInt(row.dataset.unit, 10));
    })
  );
  const annex = panel.querySelector("#pp-annex");
  if (annex) annex.addEventListener("click", () => hooks.onAnnex(selId));
  const war = panel.querySelector("#pp-war");
  if (war) war.addEventListener("click", () => hooks.onWarDecl(ctrl));
  const peace = panel.querySelector("#pp-peace");
  if (peace) peace.addEventListener("click", () => hooks.onPeacePropose(ctrl));
}

// ---- Panel de unidad (clic en una ficha del mapa, estilo CoN) ----

// Nombre legible de una categoría del motor ("caza" → "Caza", "destructor" → "Destructor")
const CAT_NAMES = Object.fromEntries(
  [...UNIT_CATEGORIES, ...NAVAL_CATEGORIES].map((c) => [c.id, c.name])
);

// Barra horizontal etiquetada (HP, moral, experiencia)
function meter(label, pct, text, color) {
  const w = Math.max(0, Math.min(100, pct));
  return `<div class="up-meter"><span class="up-mlabel">${label}</span>
    <span class="up-mbar"><i style="width:${w}%;background:${color}"></i></span>
    <span class="up-mval">${text}</span></div>`;
}

// Color de la barra de HP: verde → ámbar → rojo. Por debajo de RETREAT_HP la
// unidad se retira sola del combate, así que ese umbral ya se marca en rojo.
function hpColor(hp) {
  if (hp <= C.RETREAT_HP) return "var(--danger)";
  if (hp < 60) return "var(--accent)";
  return "var(--ok)";
}

function etaText(mins) {
  const m = Math.max(0, mins);
  return m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.max(1, Math.round(m))} min`;
}

function provName(pid) {
  const p = S.provinces.get(pid);
  if (!p) return "—";
  return p.isSea ? "Alta mar" : p.name;
}

// ¿Hay enemigos en guerra en la misma celda? Mismo criterio que el motor: las
// unidades en tránsito no combaten (ver tickCombat en js/engine/combat.js).
function inBattle(state, u) {
  if (u.edgeLeft) return false;
  return state.units.some(
    (e) => !e.dead && !e.embarked && !e.edgeLeft && e.pos === u.pos && e.owner !== u.owner && atWar(state, e.owner, u.owner)
  );
}

// Las 3 categorías contra las que esta unidad pega más fuerte: lectura rápida
// de "para qué sirve", como la ficha de unidad de CoN.
function topAttacks(T) {
  return Object.entries(T.attack || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${CAT_NAMES[k] || k} <b>${v}</b>`)
    .join(" · ");
}

function avgDefense(T) {
  const vals = Object.values(T.defense || {});
  if (!vals.length) return "—";
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

export function updateUnitPanel(state, ui) {
  const panel = $("unit-panel");
  if (!state || (!ui.selUnit && !ui.selUnknownPid)) {
    panel.classList.add("hidden");
    return;
  }

  // Contacto sin identificar: se puede seleccionar, pero no revela nada
  if (!ui.selUnit) {
    panel.classList.remove("hidden");
    panel.innerHTML = `<div class="up-head">
        <div class="up-title"><span class="up-name">Contacto sin identificar</span>
        <span class="up-sub">${provName(ui.selUnknownPid)} · ${ui.selUnknownCount || 1} unidad(es)</span></div>
        <button class="up-close" id="up-close" title="Cerrar">✕</button>
      </div>
      <div class="garrison-note">Inteligencia insuficiente: solo detectas su presencia. Envía un dron o acerca tus tropas para identificar el material.</div>`;
    panel.querySelector("#up-close").addEventListener("click", () => hooks.onCloseUnit());
    return;
  }

  const u = state.units.find((x) => x.id === ui.selUnit && !x.dead);
  const T = u && unitDef(u.type);
  if (!T) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  const mine = u.owner === state.player;
  const color = S.countries[u.owner].color;
  const vet = vetLevel(u);
  const exp = Math.round(u.exp || 0);
  const nextVet = C.VET_LEVELS[vet]; // undefined en el nivel máximo
  const hp = Math.max(0, u.hp);
  const morale = Math.round((u.morale ?? 1) * 100);

  // Estado operativo: en marcha (con destino y llegada) > en combate > embarcada > lista
  let estado, estadoCls;
  if (u.embarked) {
    estado = "Embarcada en un transporte";
    estadoCls = "up-st-sea";
  } else if (u.edgeLeft) {
    const dest = u.path?.length ? u.path[u.path.length - 1] : u.edgeLeft.to;
    estado = `En marcha → <b>${provName(dest)}</b> · llega en ${etaText(u.edgeLeft.minutesLeft)}`;
    estadoCls = "up-st-move";
  } else if (inBattle(state, u)) {
    estado = "⚔ En combate";
    estadoCls = "up-st-fight";
  } else {
    estado = "Lista · sin órdenes";
    estadoCls = "up-st-idle";
  }

  const doc = T.doctrine ? DOCTRINES[T.doctrine]?.name.replace("Doctrina ", "") : null;
  const meta = [CAT_NAMES[T.category] || T.category, T.tier ? `T${T.tier}` : null, doc].filter(Boolean).join(" · ");

  let html = `<div class="up-head">
      <canvas width="60" height="52" data-symbol="${T.icon}" data-variant="${u.type}" data-color="${color}"></canvas>
      <div class="up-title">
        <span class="up-name">${T.name}${T.air ? " ✈" : ""}${isNaval(u.type) ? " ⚓" : ""}</span>
        <span class="up-sub" style="color:${color}">${S.countries[u.owner].name}</span>
        <span class="up-sub">${meta}</span>
      </div>
      <button class="up-close" id="up-close" title="Cerrar (Esc)">✕</button>
    </div>
    <div class="up-status ${estadoCls}">${estado}</div>
    <div class="up-where">Posición: <b>${provName(u.pos)}</b></div>`;

  html += meter("HP", hp, `${Math.round(hp)} / 100`, hpColor(hp));
  html += meter("Moral", morale, `${morale} %`, morale < 30 ? "var(--danger)" : "#6fa8d9");
  html += meter("Exp", nextVet ? (exp / nextVet) * 100 : 100, nextVet ? `${exp} / ${nextVet}` : "máx", "#c9a227");
  html += `<div class="up-vet">Veteranía: ${
    vet
      ? `<span class="up-chev">${"▲".repeat(vet)}</span> nivel ${vet} <span class="cost">(+${vet * Math.round(C.VET_BONUS_PER_LEVEL * 100)}% ataque y defensa)</span>`
      : "sin experiencia"
  }</div>`;

  html += `<div class="up-stats">
      <div><span>Velocidad</span><b>${T.speed} km/h</b></div>
      <div><span>Captura provincias</span><b>${T.captures ? "sí" : "no"}</b></div>
      <div><span>Defensa media</span><b>${avgDefense(T)}</b></div>
      ${T.capacity ? `<div><span>Bodega</span><b>${u.cargo?.length || 0} / ${T.capacity}</b></div>` : ""}
    </div>
    <div class="up-atk"><span class="up-mlabel">Mejor ataque</span> ${topAttacks(T)}</div>`;

  // Aeronaves: sensores y carga de misiles (docs/AIR-COMBAT.md)
  if (airLoadout(u.type)) html += airSection(state, u, mine);
  // Portaviones: cubierta de vuelo con su ala embarcada
  if (isCarrier(u.type)) html += carrierSection(state, u, mine);

  // Órdenes: solo sobre unidades propias (las enemigas son ficha informativa)
  if (mine) {
    const moving = !!u.edgeLeft || !!u.path?.length;
    const transport = (T.capacity || 0) > 0;
    html += `<div class="up-actions">
      <button class="btn small primary" data-up-move="${u.id}" ${u.embarked ? 'disabled title="Está embarcada: desembárcala primero"' : ""}>Mover</button>
      <button class="btn small" data-up-stop="${u.id}" ${moving || airLoadout(u.type) ? "" : "disabled"}
        title="${airLoadout(u.type) ? "Cancela la misión y vuelve al aeródromo propio más cercano" : "Termina el tramo actual y se detiene"}">${airLoadout(u.type) ? "🛬 Volver a base" : "Detener"}</button>
      <button class="btn small" data-up-center="${u.pos}">Centrar</button>
      ${transport ? `<button class="btn small" data-up-embark="${u.id}">Embarcar</button>
      <button class="btn small" data-up-disembark="${u.id}" ${u.cargo?.length ? "" : "disabled"}>Desembarcar</button>` : ""}
      ${u.edgeLeft ? "" : strikeButtonsFor(state, u)}
    </div>
    <div class="up-hint">Con la unidad seleccionada, <b>clic derecho</b> en una provincia la envía allí.</div>`;
  }

  // Resto de la pila: las demás unidades del mismo tipo apiladas en la celda
  const stack = (ui.selStackIds || []).filter((id) => id !== u.id);
  if (stack.length) {
    html += `<div class="up-stack"><span class="up-mlabel">Pila (${stack.length + 1})</span><div class="up-chips">`;
    html += `<button class="up-chip active" data-up-pick="${u.id}" title="${T.name} · ${Math.round(hp)} HP">${Math.round(hp)}</button>`;
    for (const id of stack) {
      const o = state.units.find((x) => x.id === id && !x.dead);
      if (!o) continue;
      html += `<button class="up-chip" data-up-pick="${id}" title="${unitDef(o.type)?.name} · ${Math.round(o.hp)} HP">${Math.round(o.hp)}</button>`;
    }
    html += `</div>`;
    if (mine) html += `<button class="btn small" id="up-move-all">Mover toda la pila (${stack.length + 1})</button>`;
    html += `</div>`;
  }

  panel.innerHTML = html;
  drawPanelIcons(panel);

  panel.querySelector("#up-close").addEventListener("click", () => hooks.onCloseUnit());
  panel.querySelectorAll("[data-up-move]").forEach((b) =>
    b.addEventListener("click", () => hooks.onMove(parseInt(b.dataset.upMove, 10)))
  );
  panel.querySelectorAll("[data-up-stop]").forEach((b) =>
    b.addEventListener("click", () => hooks.onStop(parseInt(b.dataset.upStop, 10)))
  );
  panel.querySelectorAll("[data-up-center]").forEach((b) =>
    b.addEventListener("click", () => hooks.onCenter(b.dataset.upCenter))
  );
  panel.querySelectorAll("[data-up-embark]").forEach((b) =>
    b.addEventListener("click", () => hooks.onEmbark(parseInt(b.dataset.upEmbark, 10)))
  );
  panel.querySelectorAll("[data-up-disembark]").forEach((b) =>
    b.addEventListener("click", () => hooks.onDisembarkMode(parseInt(b.dataset.upDisembark, 10)))
  );
  panel.querySelectorAll("[data-strike]").forEach((b) =>
    b.addEventListener("click", () => hooks.onStrike(parseInt(b.dataset.strike, 10)))
  );
  panel.querySelectorAll("[data-up-pick]").forEach((b) =>
    b.addEventListener("click", () => hooks.onSelectUnit(parseInt(b.dataset.upPick, 10)))
  );
  panel.querySelectorAll("[data-up-radar]").forEach((b) =>
    b.addEventListener("click", () => hooks.onRadar(parseInt(b.dataset.upRadar, 10)))
  );
  panel.querySelectorAll("[data-up-land]").forEach((b) =>
    b.addEventListener("click", () =>
      hooks.onLand(parseInt(b.dataset.upLand, 10), parseInt(b.dataset.upCarrier, 10))
    )
  );
  panel.querySelectorAll("[data-up-launch]").forEach((b) =>
    b.addEventListener("click", () => hooks.onLaunchAir(parseInt(b.dataset.upLaunch, 10)))
  );
  panel.querySelector("#up-move-all")?.addEventListener("click", () => hooks.onMove(u.id, ui.selStackIds));
}

// ---- Aeronaves: sensores, armamento y radar (docs/AIR-COMBAT.md) ----

// Bloque de la ficha de unidad: alcance del radar, munición por arma y rearme.
function airSection(state, u, mine) {
  const armas = airWeapons(u);
  const radar = radarRangeKm(u);
  const rcs = rcsOf(u);
  let html = `<div class="pp-section"><h4>Sensores y armamento</h4>
    <div class="up-radarline">📡 Radar de detección: <b>${radar} km</b></div>`;
  if (rcs > 0) {
    // Lo que de verdad importa del furtivo: a qué distancia lo cogen. Se ilustra
    // con un radar de caza moderno (1.000 km, el del F-22) como vara de medir.
    html += `<div class="up-radarline">🛡 Firma radar: <b>−${Math.round(rcs * 100)}%</b>
      <span class="cost">· un radar de caza puntero (1.000 km) te vería a ${Math.round(1000 * (1 - rcs))} km</span></div>`;
  }

  if (!armas.length) {
    html += `<div class="garrison-note">Aparato de reconocimiento puro: sin armamento.</div></div>`;
    return html;
  }

  for (const { weapon: w, left, total } of armas) {
    const vacio = left <= 0;
    html += `<div class="up-wrow${vacio ? " vacio" : ""}" title="${w.nombre} · guía ${w.guia} · ${Math.round(w.pk * 100)}% de impacto base · alcance real ${w.rangoKm} km (${effRange(w)} en escala de teatro)">
      <span class="up-wname">${w.nombre}</span>
      <span class="up-wtag">${w.tipo === "aa" ? "aire-aire" : "aire-suelo"} · ${effRange(w)} km</span>
      <span class="up-wammo">${left}<span class="cost">/${total}</span></span>
    </div>`;
  }

  if (mine) {
    const st = rearmStatus(state, u);
    if (st && !st.completo) {
      if (st.blocker) {
        html += `<div class="up-rearm warn">Rearme detenido: ${st.blocker}</div>`;
      } else if (st.sinRecursos) {
        html += `<div class="up-rearm warn">Sin recursos para reponer ${st.weapon.nombre}</div>`;
      } else {
        html += `<div class="up-rearm">Rearmando ${st.weapon.nombre} · ${Math.ceil(st.minutosRestantes)} min</div>`;
      }
    } else if (st?.completo) {
      html += `<div class="up-rearm ok">Carga completa</div>`;
    }
    html += `<button class="btn small primary" data-up-radar="${u.id}" style="margin-top:8px">📡 Abrir radar</button>`;
    // Apontaje: solo si hay un portaviones propio con plaza en ESTE sector de mar
    for (const c of landingOptions(state, u)) {
      const libre = carrierCapacity(c) - aircraftAboard(state, c).length;
      html += `<button class="btn small" data-up-land="${u.id}" data-up-carrier="${c.id}" style="margin-top:6px">
        🛬 Aterrizar en ${unitDef(c.type)?.name} <span class="cost">(${libre} ${libre === 1 ? "libre" : "libres"})</span></button>`;
    }
  }
  html += `</div>`;
  return html;
}

// Cubierta de vuelo de un portaviones: plazas y ala embarcada. El buque mueve
// su aviación con él, así que esta lista viaja con el grupo de combate.
function carrierSection(state, u, mine) {
  const cap = carrierCapacity(u);
  const aboard = aircraftAboard(state, u);
  let html = `<div class="pp-section"><h4>Cubierta de vuelo</h4>
    <div class="up-radarline">🛩 Plazas ocupadas: <b>${aboard.length} / ${cap}</b></div>`;

  if (!aboard.length) {
    html += `<div class="garrison-note">Cubierta vacía. Vuela hasta este sector un aparato apto para cubierta y aterriza desde su ficha.</div>`;
  }
  for (const a of aboard) {
    const T = unitDef(a.type);
    const municion = airWeapons(a).reduce((s, x) => s + x.left, 0);
    const st = rearmStatus(state, a);
    const nota = st && !st.completo && !st.blocker
      ? ` · rearmando ${st.weapon.nombre}`
      : "";
    html += `<div class="up-wrow">
      <span class="up-wname">${T?.name || a.type}</span>
      <span class="up-wtag">${Math.round(a.hp)} HP · ${municion} misiles${nota}</span>
      ${mine ? `<button class="btn small" data-up-launch="${a.id}" ${u.edgeLeft ? 'disabled title="El portaviones navega: no hay ciclo de vuelo"' : ""}>Lanzar</button>` : ""}
    </div>`;
  }
  html += `</div>`;
  return html;
}

// Panel de radar: barrido con los contactos, selector de arma y disparo.
// Se refresca con el resto de la UI, así que los contactos se mueven en vivo.
// El armazón del panel (cabecera, barrido, contenedores) se construye UNA vez por
// aparato; después solo se refrescan las partes que cambian. Reconstruir todo el
// innerHTML cada 250 ms creaba un `.rp-sweep` nuevo en cada refresco y la
// animación CSS volvía a empezar: la aguja del radar llegaba a las 2 en punto y
// saltaba de vuelta a las 12 en vez de dar la vuelta completa.
let radarShellUnit = null;

export function updateRadarPanel(state, ui) {
  const panel = $("radar-panel");
  const u = state?.units.find((x) => x.id === ui.radarUnit && !x.dead);
  if (!u || !airLoadout(u.type) || u.owner !== state.player) {
    panel.classList.add("hidden");
    $("game-ui").classList.remove("radar-open");
    radarShellUnit = null;
    return;
  }
  panel.classList.remove("hidden");
  $("game-ui").classList.add("radar-open"); // el panel de provincia le hace sitio

  const T = unitDef(u.type);
  const armas = airWeapons(u);
  const radar = radarRangeKm(u);
  const modo = ui.radarMode === "as" ? "as" : "aa";

  if (radarShellUnit !== u.id) {
    radarShellUnit = u.id;
    panel.innerHTML = `<div class="rp-head">
        <span class="rp-title">📡 ${T?.name || u.type}<span class="cost"> · radar ${radar} km</span></span>
        <button class="up-close" id="rp-close" title="Cerrar">✕</button>
      </div>
      <div class="rp-modes" id="rp-modes"></div>
      <div class="rp-scope"><canvas id="rp-canvas" width="208" height="208"></canvas><div class="rp-sweep"></div></div>
      <div class="rp-weapons" id="rp-weapons"></div>
      <div id="rp-note"></div>
      <div class="rp-contacts" id="rp-contacts"></div>`;
    panel.querySelector("#rp-close").addEventListener("click", () => hooks.onCloseRadar());
  }

  // Arma activa: la elegida si sigue siendo válida, si no la primera del modo con munición
  const delModo = armas.filter((a) => a.weapon.tipo === modo);
  const sel = delModo.find((a) => a.weapon.id === ui.radarWeapon) || delModo.find((a) => a.left > 0) || delModo[0];

  const contactosAA = radarContacts(state, u);
  const contactosAS = armas.some((a) => a.weapon.tipo === "as") ? groundContacts(state, u) : [];
  const contactos = modo === "aa" ? contactosAA : contactosAS;
  const enTransito = !!u.edgeLeft;

  $("rp-modes").innerHTML =
    `<button class="rp-mode${modo === "aa" ? " active" : ""}" data-rmode="aa">Aire-aire <b>${contactosAA.length}</b></button>
     <button class="rp-mode${modo === "as" ? " active" : ""}" data-rmode="as">Aire-suelo <b>${contactosAS.length}</b></button>`;

  let wHtml = "";
  if (!delModo.length) {
    wHtml = `<div class="garrison-note">Este aparato no lleva armas ${modo === "aa" ? "aire-aire" : "aire-suelo"}.</div>`;
  }
  for (const a of delModo) {
    const act = sel && a.weapon.id === sel.weapon.id;
    wHtml += `<button class="rp-wchip${act ? " active" : ""}${a.left <= 0 ? " vacio" : ""}" data-rweapon="${a.weapon.id}"
      title="${a.weapon.nombre} · guía ${a.weapon.guia} · ${effRange(a.weapon)} km · ${Math.round(a.weapon.pk * 100)}% base">
      ${a.weapon.nombre.split(" ")[0]} <b>${a.left}</b></button>`;
  }
  $("rp-weapons").innerHTML = wHtml;

  $("rp-note").innerHTML = enTransito
    ? `<div class="up-rearm warn">En tránsito: el avión debe estar en su sector para disparar.</div>`
    : "";

  // Lista de contactos
  let cHtml = "";
  if (!contactos.length) {
    cHtml = `<div class="garrison-note">${emptyRadarReason(state, u, modo)}</div>`;
  }
  for (const c of contactos.slice(0, 12)) {
    const e = c.unit;
    const eT = unitDef(e.type);
    const color = S.countries[e.owner].color;
    const enAlcance = sel && c.km <= effRange(sel.weapon) && sel.left > 0;
    const veto = sel ? weaponCanTarget(sel.weapon, e) : "sin arma seleccionada";
    const pk = sel && !veto ? Math.round(pkFor(sel.weapon, u, e, c.km) * 100) : null;
    const activo = ui.radarTarget === e.id;
    let motivo = "";
    if (!sel) motivo = "Elige un arma";
    else if (veto) motivo = veto;
    else if (sel.left <= 0) motivo = `Sin ${sel.weapon.nombre}`;
    else if (!enAlcance) motivo = `Fuera de alcance (${Math.round(c.km)} > ${effRange(sel.weapon)} km)`;
    else if (enTransito) motivo = "El avión está en tránsito";

    cHtml += `<div class="rp-contact${activo ? " sel" : ""}${enAlcance && !veto ? " tiro" : ""}" data-rtarget="${e.id}">
      <span class="rp-blip${c.datalink ? " dl" : ""}" style="background:${c.datalink ? "transparent" : color};border-color:${color}"></span>
      <div class="rp-cinfo">
        <b>${eT?.name || e.type}</b> <span class="cost">${S.countries[e.owner].name}</span>${c.datalink ? ` <span class="rp-dl" title="Fuera del alcance de tu radar: lo marca una batería antiaérea propia">ENLACE</span>` : ""}
        <div class="cost">${Math.round(c.km)} km · rumbo ${Math.round(c.bearing)}° · ${Math.round(e.hp)} HP${pk !== null ? ` · <span class="rp-pk">Pk ${pk}%</span>` : ""}</div>
      </div>
      <button class="btn small" data-rfire="${e.id}" ${motivo ? `disabled title="${motivo}"` : ""}>Disparar</button>
    </div>`;
  }
  $("rp-contacts").innerHTML = cHtml;

  drawRadarScope(panel, state, ui, u, contactos, sel, radar);

  // Los listeners viven en los bloques que se reescriben, así que se reenganchan
  panel.querySelectorAll("[data-rmode]").forEach((b) =>
    b.addEventListener("click", () => hooks.onRadarMode(b.dataset.rmode))
  );
  panel.querySelectorAll("[data-rweapon]").forEach((b) =>
    b.addEventListener("click", () => hooks.onRadarWeapon(b.dataset.rweapon))
  );
  panel.querySelectorAll("[data-rtarget]").forEach((row) =>
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      hooks.onRadarTarget(parseInt(row.dataset.rtarget, 10));
    })
  );
  panel.querySelectorAll("[data-rfire]").forEach((b) =>
    b.addEventListener("click", () => hooks.onFireAir(sel.weapon.id, parseInt(b.dataset.rfire, 10)))
  );
}

// Por qué el radar no marca nada. "Sin contactos" a secas es engañoso cuando hay
// un blindado enemigo debajo del avión y lo único que falta es declarar la guerra.
function emptyRadarReason(state, u, modo) {
  const paises = new Set();
  for (const e of state.units) {
    if (e.dead || e.embarked || e.owner === u.owner) continue;
    if (e.pos !== u.pos) continue;
    if (atWar(state, u.owner, e.owner)) continue;
    const esAire = !!airLoadout(e.type);
    if ((modo === "aa") !== esAire) continue;
    paises.add(S.countries[e.owner].name);
  }
  if (paises.size) {
    return `Hay fuerzas de ${[...paises].join(", ")} en este sector, pero NO estás en guerra con ${paises.size > 1 ? "esos países" : "ese país"}: el radar solo marca objetivos hostiles.`;
  }
  return modo === "aa"
    ? "Sin aeronaves hostiles en el radar."
    : "Sin blancos de superficie hostiles reconocidos. El aire-suelo exige además tener la provincia reconocida (dron o tropas propias cerca).";
}

// Indicador panorámico (PPI): norte arriba, anillos de distancia, burbuja del
// arma seleccionada y un blip por contacto en su rumbo real.
function drawRadarScope(panel, state, ui, u, contactos, sel, radarKm) {
  const cv = panel.querySelector("#rp-canvas");
  if (!cv) return;
  const size = 208;
  const dpr = window.devicePixelRatio || 1;
  cv.style.width = size + "px";
  cv.style.height = size + "px";
  cv.width = Math.round(size * dpr);
  cv.height = Math.round(size * dpr);
  const g = cv.getContext("2d");
  g.scale(dpr, dpr);
  const c = size / 2;
  const R = c - 14;

  g.fillStyle = "#08130d";
  g.fillRect(0, 0, size, size);

  // Anillos de distancia con su etiqueta en km
  g.font = "9px monospace";
  g.textAlign = "center";
  for (let i = 1; i <= 4; i++) {
    const r = (R * i) / 4;
    g.strokeStyle = i === 4 ? "rgba(90,220,140,0.55)" : "rgba(90,220,140,0.22)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(120,220,160,0.55)";
    g.fillText(Math.round((radarKm * i) / 4) + "", c, c - r + 10);
  }
  // Cruz de rumbos
  g.strokeStyle = "rgba(90,220,140,0.18)";
  g.beginPath();
  g.moveTo(c - R, c); g.lineTo(c + R, c);
  g.moveTo(c, c - R); g.lineTo(c, c + R);
  g.stroke();
  g.fillStyle = "rgba(120,220,160,0.7)";
  g.fillText("N", c, 10);

  // Burbuja del arma seleccionada: dentro de ella SÍ se puede disparar
  if (sel) {
    const rr = Math.min(R, (effRange(sel.weapon) / Math.max(1, radarKm)) * R);
    g.fillStyle = "rgba(90,220,140,0.09)";
    g.beginPath();
    g.arc(c, c, rr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,233,160,0.75)";
    g.setLineDash([4, 3]);
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(c, c, rr, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }

  // Contactos
  for (const ct of contactos) {
    const d = Math.min(1, ct.km / radarKm);
    const ang = (ct.bearing * Math.PI) / 180;
    const x = c + Math.sin(ang) * d * R;
    const y = c - Math.cos(ang) * d * R;
    const color = S.countries[ct.unit.owner]?.color || "#e05545";
    const esAire = !!airLoadout(ct.unit.type);
    g.fillStyle = color;
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 1;
    g.beginPath();
    if (esAire) {
      // Aeronave: rombo
      g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y);
      g.closePath();
    } else {
      g.rect(x - 4, y - 4, 8, 8); // superficie: cuadrado
    }
    // Contacto por enlace de datos (lo ve un antiaéreo propio, no este radar):
    // se dibuja hueco para distinguirlo de lo que el aparato ve por sí mismo.
    if (ct.datalink) {
      g.strokeStyle = color;
      g.lineWidth = 1.6;
      g.stroke();
      g.setLineDash([2, 2]);
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.stroke();
      g.setLineDash([]);
    } else {
      g.fill();
      g.stroke();
    }
    if (ui.radarTarget === ct.unit.id) {
      g.strokeStyle = "#ffe9a0";
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x, y, 9, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // Aparato propio en el centro
  g.fillStyle = "#eaffe9";
  g.beginPath();
  g.moveTo(c, c - 6); g.lineTo(c + 4, c + 5); g.lineTo(c, c + 2); g.lineTo(c - 4, c + 5);
  g.closePath();
  g.fill();
}

// ---------- Registro de eventos ----------

export function updateLog(state) {
  const el = $("event-log");
  for (let i = lastLogLen; i < state.log.length; i++) {
    const e = state.log[i];
    const div = document.createElement("div");
    div.className = "log-entry " + (e.kind || "info");
    div.innerHTML = `<span class="t">${C.fmtGameDate(e.t).split("·")[0]}</span>${e.msg}`;
    el.appendChild(div);
  }
  lastLogLen = state.log.length;
  el.scrollTop = el.scrollHeight;
}

// Panel de investigación y doctrina (estilo CoN: tiers ordenados)
export function showResearchPanel(state, onResearch) {
  const iso = state.player;
  const c = state.countries[iso];
  const doc = DOCTRINES[c.doctrine];
  let body = `<p>Doctrina: <b style="color:var(--accent)">${doc?.name ?? c.doctrine}</b> — define las variantes de tus unidades. Cada tier desbloquea equipos más modernos.</p>`;
  for (const tier of TIERS) {
    const done = c.researchedTier >= tier.id;
    const active = c.researchQueue?.tier === tier.id;
    const next = tier.id === (c.researchedTier ?? 1) + 1;
    let status;
    if (done) status = `✔ Investigado`;
    else if (active) status = `En curso: ${Math.ceil(c.researchQueue.minutesLeft / 1440)} días restantes`;
    else status = `${C.fmtInt(tier.researchCost.money)}$ · ${C.fmtInt(tier.researchCost.supplies)} sumin · ${tier.researchDays} días`;
    body += `<div class="build-row"><div><b>T${tier.id} · ${tier.name}</b><div class="cost">${status}</div></div>
      <button class="btn small" data-research="${tier.id}" ${done || active || !next ? "disabled" : ""}>${done ? "✔" : active ? "…" : next ? "Investigar" : "🔒"}</button></div>`;
  }
  showModal("Investigación y doctrina", body, [{ label: "Cerrar" }]);
  document.querySelectorAll("[data-research]").forEach((b) =>
    b.addEventListener("click", () => {
      hideModal();
      onResearch(parseInt(b.dataset.research, 10));
    })
  );
}

// ---------- Toast y modales ----------

export function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}

export function showModal(title, bodyHTML, buttons) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = bodyHTML;
  const box = $("modal-buttons");
  box.innerHTML = "";
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.className = "btn " + (b.cls || "");
    btn.textContent = b.label;
    btn.addEventListener("click", () => {
      hideModal();
      b.cb?.();
    });
    box.appendChild(btn);
  }
  $("modal").classList.remove("hidden");
}

export function hideModal() {
  $("modal").classList.add("hidden");
}

export function showEnd(win, state, onRestart) {
  const st = state.stats;
  const days = Math.floor(state.time / 1440);
  const div = document.createElement("div");
  div.className = "end-screen";
  div.innerHTML = `
    <h1 class="${win ? "win" : "lose"}">${win ? "VICTORIA" : "DERROTA"}</h1>
    <div class="stats">
      ${win ? `Controlas el continente tras <b>${days}</b> días de campaña.` : `Tu país ha sido eliminado tras <b>${days}</b> días de campaña.`}<br>
      Provincias tomadas: <b>${st.taken[state.player] || 0}</b> · Unidades perdidas: <b>${st.lost[state.player] || 0}</b>
    </div>`;
  const btn = document.createElement("button");
  btn.className = "btn primary";
  btn.textContent = "Volver al inicio";
  btn.addEventListener("click", onRestart);
  div.appendChild(btn);
  document.getElementById("app").appendChild(div);
}
