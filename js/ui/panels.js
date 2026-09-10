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
      const cost = key === "fortaleza" ? { ...b.cost, money: b.cost.money * (level + 1) } : b.cost;
      const r = state.countries[state.player].resources;
      const afford = r.money >= cost.money && r.supplies >= cost.supplies;
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
  const annex = panel.querySelector("#pp-annex");
  if (annex) annex.addEventListener("click", () => hooks.onAnnex(selId));
  const war = panel.querySelector("#pp-war");
  if (war) war.addEventListener("click", () => hooks.onWarDecl(ctrl));
  const peace = panel.querySelector("#pp-peace");
  if (peace) peace.addEventListener("click", () => hooks.onPeacePropose(ctrl));
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
