// Render del mapa en canvas: proyección Mercator, provincias, unidades, órdenes y batallas.
import { S, atWar, visibleProvinces, intel, unitDef } from "../engine/state.js";
import { DRONE_VISION_KM } from "../data/missiles-data.js";
import { strikeWeaponsFor } from "../engine/missiles.js";
import { radarRangeKm } from "../engine/air-combat.js";
import { vetLevel } from "../engine/combat.js";
import { drawUnitSymbol, drawBattleMarker, drawOrderPath } from "./symbols.js";

export class MapRenderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.view = { cx: 0, cy: 0, scale: 1 };
    this.paths = new Map();
    this.patterns = new Map();
    this.mapBounds = null;
    this.resize();
    window.addEventListener("resize", () => {
      this.resize();
      if (this.mapBounds) this.fit();
    });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.w = this.cv.clientWidth || window.innerWidth;
    this.h = this.cv.clientHeight || window.innerHeight;
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.dpr = dpr;
  }

  setMap() {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of S.provinceList) {
      for (const ring of p.projRings) {
        for (const [x, y] of ring) {
          if (x < minx) minx = x;
          if (x > maxx) maxx = x;
          if (y < miny) miny = y;
          if (y > maxy) maxy = y;
        }
      }
    }
    this.mapBounds = { minx, miny, maxx, maxy };
    this.paths.clear();
    // Orden de pintado: provincias grandes primero, pequeñas encima. Los
    // solapes del pipeline de datos (p. ej. el anillo de Texas invadía México)
    // quedan tapados por la provincia precisa que corresponde.
    this.paintList = [...S.provinceList]
      .filter((p) => !p.isSea)
      .sort(
        (a, b) =>
          (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]) -
          (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1])
      );
    this.fit();
  }

  fit() {
    const b = this.mapBounds;
    const dx = Math.max(1, b.maxx - b.minx);
    const dy = Math.max(1, b.maxy - b.miny);
    this.view.scale = Math.min(this.w / dx, this.h / dy) * 0.95;
    this.view.cx = (b.minx + b.maxx) / 2;
    this.view.cy = (b.miny + b.maxy) / 2;
    this.baseScale = this.view.scale; // referencia del "zoom 1x" (mapa completo)
  }

  // Tamaño en px de pantalla de los iconos de unidad: crece con el zoom de la
  // cámara (antes quedaba fijo y, al acercar el mapa, se veían relativamente
  // más chicos) pero acotado para no rebasar el detalle real de los sprites
  // (256x256, ver sprite-cache.js) ni saturar la vista al alejar del todo.
  unitIconSize() {
    const ratio = this.view.scale / (this.baseScale || this.view.scale);
    return Math.max(16, Math.min(46, 27 * Math.sqrt(ratio)));
  }

  w2s(x, y) {
    return [
      (x - this.view.cx) * this.view.scale + this.w / 2,
      (y - this.view.cy) * this.view.scale + this.h / 2,
    ];
  }

  s2w(px, py) {
    return [
      (px - this.w / 2) / this.view.scale + this.view.cx,
      (py - this.h / 2) / this.view.scale + this.view.cy,
    ];
  }

  pathFor(p) {
    let path = this.paths.get(p.id);
    if (!path) {
      path = new Path2D();
      for (const ring of p.projRings) {
        ring.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
        path.closePath();
      }
      this.paths.set(p.id, path);
    }
    return path;
  }

  countryColor(iso) {
    return S.countries[iso]?.color || "#7a8088";
  }

  hatchPattern(color) {
    let pat = this.patterns.get(color);
    if (!pat) {
      const c = document.createElement("canvas");
      c.width = c.height = 8;
      const g = c.getContext("2d");
      g.strokeStyle = color;
      g.globalAlpha = 0.55;
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(-2, 10); g.lineTo(10, -2);
      g.moveTo(-2, 4); g.lineTo(4, -2);
      g.moveTo(4, 10); g.lineTo(10, 4);
      g.stroke();
      pat = this.ctx.createPattern(c, "repeat");
      this.patterns.set(color, pat);
    }
    return pat;
  }

  draw(state, ui, timeMs = performance.now()) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const v = this.view;
    const unitSize = this.unitIconSize();
    // Registro de zonas clicables de unidad de ESTE frame (lo consume pickUnit):
    // el hit-test va contra lo que realmente se ve, incluidas las órbitas aéreas
    // y las unidades interpoladas en marcha, que no están en el centro de su provincia.
    this.unitHits = [];
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#2e5f8a"; // azul de mar más claro (estilo CoN)
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);

    const mapT = () =>
      ctx.setTransform(dpr * v.scale, 0, 0, dpr * v.scale, dpr * (this.w / 2 - v.cx * v.scale), dpr * (this.h / 2 - v.cy * v.scale));
    const screenT = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ---- Capas en coordenadas de mundo ----
    mapT();
    for (const p of this.paintList || S.provinceList) {
      if (p.isSea) continue; // el mar lo pinta el fondo
      const ps = state?.provinces[p.id];
      const path = this.pathFor(p);
      ctx.fillStyle = this.countryColor(ps ? ps.occupier || ps.owner : p.country);
      ctx.fill(path);
      if (ps?.occupier && ps.occupier !== ps.owner) {
        ctx.fillStyle = this.hatchPattern(this.countryColor(ps.owner));
        ctx.fill(path);
      }
    }
    ctx.strokeStyle = "rgba(8,12,16,0.55)";
    ctx.lineWidth = 1 / v.scale;
    for (const p of this.paintList || S.provinceList) {
      ctx.stroke(this.pathFor(p));
    }

    if (state && ui.sel && state.provinces[ui.sel]) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.2 / v.scale;
      ctx.stroke(this.pathFor(S.provinces.get(ui.sel)));
    }
    if (state && ui.hover && ui.hover !== ui.sel && S.provinces.get(ui.hover)) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.4 / v.scale;
      ctx.stroke(this.pathFor(S.provinces.get(ui.hover)));
    }
    if (!state && ui.selCountry) {
      ctx.strokeStyle = "#ffe9a0";
      ctx.lineWidth = 2.5 / v.scale;
      for (const p of S.provinceList) {
        if (p.country === ui.selCountry) ctx.stroke(this.pathFor(p));
      }
    }

    // Capitales y grandes ciudades
    for (const p of S.provinceList) {
      if (!p.capital && (p.pop || 0) < 5000000) continue;
      ctx.fillStyle = p.capital ? "#f0d488" : "rgba(240,212,136,0.6)";
      const r = (p.capital ? 3.2 : 2) / v.scale;
      ctx.beginPath();
      ctx.arc(p.pcx, p.pcy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Productores de combustible (js/data/fuel-data.js): gota negra con borde claro
    if (v.scale > 3) {
      for (const p of this.paintList || S.provinceList) {
        if ((p.prod?.fuel || 0) < 10) continue;
        const r = 2.8 / v.scale;
        ctx.beginPath();
        ctx.moveTo(p.pcx, p.pcy - r * 1.9); // punta de la gota
        ctx.arc(p.pcx, p.pcy, r, 0.8 * Math.PI, 0.2 * Math.PI, true); // bulbo por abajo
        ctx.closePath();
        ctx.fillStyle = "#14181d";
        ctx.strokeStyle = "rgba(240,240,220,0.85)";
        ctx.lineWidth = 0.8 / v.scale;
        ctx.fill();
        ctx.stroke();
      }
    }

    // ---- Capas en píxeles de pantalla ----
    screenT();

    if (state) {
      // Niebla de guerra: solo se ven unidades propias y las de provincias visibles
      const vis = visibleProvinces(state);

      // Círculos de visión de drones propios y anillo de alcance del misil seleccionado
      for (const u of state.units) {
        if (u.dead || u.embarked) continue;
        let rDeg = 0;
        let color = "rgba(255,140,80,0.55)";
        const T = unitDef(u.type);
        if (ui.radarUnit === u.id) {
          // Burbuja del radar del avión con el panel abierto (docs/AIR-COMBAT.md)
          rDeg = radarRangeKm(u) / 111;
          color = "rgba(90,220,140,0.55)";
        } else if (u.owner === state.player && T?.category === "drone") {
          rDeg = DRONE_VISION_KM[T.tier ?? 1] / 111;
          color = "rgba(140,200,255,0.4)";
        } else if (ui.strike?.unitId === u.id) {
          const sw = strikeWeaponsFor(u.type).find((x) => x.weapon.id === ui.strike.weaponId);
          rDeg = sw ? sw.rangoKm / 111 : 0;
        }
        if (!rDeg) continue;
        const p = S.provinces.get(u.pos);
        if (!p) continue;
        const [cx0, cy0] = this.w2s(p.pcx, p.pcy);
        const [, cy1] = this.w2s(p.pcx, p.pcy - rDeg); // punto al norte: radio proyectado
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(cx0, cy0, Math.abs(cy0 - cy1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ruta de la unidad en modo movimiento
      if (ui.moveUnitId) {
        const u = state.units.find((x) => x.id === ui.moveUnitId);
        if (u && (u.path.length || u.edgeLeft)) {
          const ids = [u.pos, ...u.path];
          const pts = ids.map((id) => S.provinces.get(id)).filter(Boolean).map((p) => this.w2s(p.pcx, p.pcy));
          if (pts.length >= 2) drawOrderPath(ctx, pts);
        }
      }

      // Unidades estilo CoN: pilas dispersas alrededor del centro de la provincia
      // (sin panel oscuro), aéreos patrullando en órbita propia, enemigos con
      // inteligencia débil como contactos "?" sin identificar.
      const it = intel(state);
      const AIR_CATS = new Set(["caza", "bombardero", "helicoptero", "drone"]);
      const groups = new Map(); // pid → [unidades]
      const movingUnits = [];
      for (const u of state.units) {
        if (u.owner !== state.player && !vis.has(u.pos)) continue;
        if (u.embarked) continue;
        if (u.edgeLeft) { movingUnits.push(u); continue; }
        let a = groups.get(u.pos);
        if (!a) groups.set(u.pos, (a = []));
        a.push(u);
      }

      for (const [pid, units] of groups) {
        const p = S.provinces.get(pid);
        if (!p) continue;
        const [cx, cy] = this.w2s(p.pcx, p.pcy);
        const strongIntel = it.strong.has(pid);

        const byType = new Map();
        for (const u of units) {
          const T = unitDef(u.type);
          const k = u.owner + "|" + u.type;
          let g = byType.get(k);
          if (!g) {
            byType.set(k, (g = { owner: u.owner, type: u.type, n: 0, hp: 0, level: 0, ids: [], air: AIR_CATS.has(T?.category || u.type) }));
          }
          g.ids.push(u.id);
          g.n++;
          g.hp += u.hp;
          g.level = Math.max(g.level, vetLevel(u));
        }
        const all = [...byType.values()];

        // Contacto enemigo sin inteligencia fuerte: insignia "?" con el total
        if (!strongIntel && !all.some((g) => g.owner === state.player)) {
          let total = 0;
          for (const g of all) total += g.n;
          this.drawUnknownContact(ctx, cx, cy, total);
          this.unitHits.push({ x: cx, y: cy, r: 15, ids: [], pid, unknown: total });
          continue;
        }

        const ground = all.filter((g) => !g.air);
        const air = all.filter((g) => g.air);

        // Terrestres y navales: abanico alrededor del centro de la provincia
        const shownG = ground.slice(0, 5);
        shownG.forEach((g, i) => {
          const n = shownG.length;
          const ang = n > 1 ? -Math.PI / 2 + (i * 2 * Math.PI) / n : 0;
          const rad = n > 1 ? 18 : 0;
          const gx = cx + Math.cos(ang) * rad;
          const gy = cy + Math.sin(ang) * rad;
          this.drawUnitGroup(ctx, g, gx, gy);
          this.unitHits.push({ x: gx, y: gy, r: hitRadius(unitSize), ids: g.ids, pid });
        });
        if (ground.length > 5) {
          this.drawOverflowChip(ctx, cx + 24, cy + 12, ground.length - 5);
        }

        // Aéreos: órbita de patrulla permanente (cada grupo con su propia fase)
        air.slice(0, 4).forEach((g, i) => {
          const phase = hashStr(g.owner + "|" + g.type) % 628 / 100;
          const ang = timeMs / 2400 + phase + (i * Math.PI) / 2;
          const bx = cx + Math.cos(ang) * 27;
          const by = cy + Math.sin(ang) * 16 - 12; // elipse elevada sobre la pila
          this.drawUnitGroup(ctx, g, bx, by, { airborne: true });
          this.unitHits.push({ x: bx, y: by - 7, r: hitRadius(unitSize), ids: g.ids, pid });
        });
        if (air.length > 4) {
          this.drawOverflowChip(ctx, cx + 30, cy - 20, air.length - 4);
        }
      }

      // Unidades en marcha: viajan interpoladas, ORIENTADAS hacia su rumbo,
      // con sombra y (las propias) etiqueta de llegada estilo CoN
      for (const u of movingUnits) {
        const from = S.provinces.get(u.pos);
        const to = S.provinces.get(u.edgeLeft.to);
        if (!from || !to) continue;
        const t = Math.max(0, Math.min(1, 1 - u.edgeLeft.minutesLeft / (u.edgeLeft.total || 1)));
        const wx = from.pcx + (to.pcx - from.pcx) * t;
        const wy = from.pcy + (to.pcy - from.pcy) * t;
        const [sx, sy] = this.w2s(wx, wy);
        const ang = Math.atan2(to.pcy - from.pcy, to.pcx - from.pcx);
        const T = unitDef(u.type);
        const air = AIR_CATS.has(T?.category || u.type);
        const mine = u.owner === state.player;

        // Enemigo en zona de inteligencia débil: solo un contacto "?"
        if (!mine && !it.strong.has(u.pos)) {
          this.drawUnknownContact(ctx, sx, sy, 1);
          this.unitHits.push({ x: sx, y: sy, r: 15, ids: [], pid: u.pos, unknown: 1 });
          continue;
        }

        if (air) {
          // sombra en el suelo: la unidad "vuela" por encima
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.beginPath();
          ctx.ellipse(sx + 5, sy + 9, 11, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        drawUnitSymbol(ctx, T?.icon || "infanteria", sx, sy - (air ? 7 : 0), unitSize, this.countryColor(u.owner), {
          hp: Math.max(0, Math.min(1, u.hp / 100)),
          level: vetLevel(u),
          angle: ang + Math.PI / 2, // los sprites miran al norte: +90° alinea el morro con el rumbo
          variant: u.type,
        });
        this.unitHits.push({ x: sx, y: sy - (air ? 7 : 0), r: hitRadius(unitSize), ids: [u.id], pid: u.pos });
        this.drawFlagBadge(ctx, sx + 12, sy - (air ? 7 : 0) + 8, this.countryColor(u.owner), u.cargo?.length ? "+" + u.cargo.length : null);
        if (mine) {
          const mins = Math.max(0, u.edgeLeft.minutesLeft);
          const eta = mins >= 60 ? `${Math.floor(mins / 60)} h ${Math.round(mins % 60)} min` : `${Math.max(1, Math.round(mins))} min`;
          this.drawEtaLabel(ctx, sx, sy + 22, "Llega en " + eta);
        }
      }

      // Línea de enganche del radar: del avión al contacto marcado
      if (ui.radarUnit && ui.radarTarget) {
        const shooter = state.units.find((x) => x.id === ui.radarUnit && !x.dead);
        const target = state.units.find((x) => x.id === ui.radarTarget && !x.dead);
        const pa = shooter && S.provinces.get(shooter.pos);
        const pb = target && S.provinces.get(target.pos);
        if (pa && pb) {
          const [ax, ay] = this.w2s(pa.pcx, pa.pcy);
          const [bx, by] = this.w2s(pb.pcx, pb.pcy);
          ctx.strokeStyle = "rgba(255,233,160,0.8)";
          ctx.lineWidth = 1.4;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Anillo de la unidad/pila seleccionada (se dibuja al final: nunca lo tapa otra ficha)
      if (ui.selUnit || ui.selUnknownPid) {
        const h = ui.selUnit
          ? this.unitHits.find((x) => x.ids.includes(ui.selUnit))
          : this.unitHits.find((x) => x.unknown && x.pid === ui.selUnknownPid);
        if (h) {
          ctx.strokeStyle = "#ffe9a0";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.lineDashOffset = -((timeMs / 55) % 9); // giro lento: marca la selección viva
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.r + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
        }
      }

      // Marcadores de batalla (solo en zonas visibles)
      for (const pid of battleProvinces(state)) {
        if (vis && !vis.has(pid)) continue;
        const p = S.provinces.get(pid);
        if (!p) continue;
        const [sx, sy] = this.w2s(p.pcx, p.pcy);
        drawBattleMarker(ctx, sx, sy - 20, timeMs);
      }

      // Misiles en vuelo: estela punteada desde el lanzador y cabeza brillante
      if (state.missiles?.length) {
        for (const m of state.missiles) {
          const a = S.provinces.get(m.fromId);
          const b = S.provinces.get(m.toId);
          if (!a || !b) continue;
          const t = Math.max(0, Math.min(1, 1 - m.minutesLeft / (m.total || 1)));
          const [ax, ay] = this.w2s(a.pcx, a.pcy);
          const [bx, by] = this.w2s(b.pcx, b.pcy);
          const sx = ax + (bx - ax) * t;
          const sy = ay + (by - ay) * t;
          ctx.strokeStyle = "rgba(255,150,70,0.65)";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(sx, sy);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#ffb060";
          ctx.beginPath();
          ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Ficha de unidad bajo el cursor (px de pantalla), o null. Recorre el registro
  // del último frame en orden INVERSO: gana la última dibujada, que es la que se
  // ve encima cuando dos fichas se solapan.
  pickUnit(px, py) {
    const hits = this.unitHits || [];
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if ((px - h.x) ** 2 + (py - h.y) ** 2 <= h.r * h.r) return h;
    }
    return null;
  }

  // Centra la cámara en una provincia (botón "Centrar" del panel de unidad)
  centerOn(pid) {
    const p = S.provinces.get(pid);
    if (!p) return;
    this.view.cx = p.pcx;
    this.view.cy = p.pcy;
  }

  // ---- Ayudas de dibujo de unidades (estilo CoN) ----

  // Unidad estacionaria: sprite con sombra suave, SIN panel oscuro; barra de HP
  // y chevrons las pinta drawUnitSymbol. Los aéreos van elevados con sombra en el suelo.
  drawUnitGroup(ctx, g, x, y, opts = {}) {
    const lift = opts.airborne ? 7 : 0;
    if (opts.airborne) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(x + 5, y + 9, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawUnitSymbol(ctx, unitDef(g.type)?.icon || "infanteria", x, y - lift, this.unitIconSize(), this.countryColor(g.owner), {
      hp: Math.max(0, Math.min(1, g.hp / (g.n * 100))),
      level: g.level,
      variant: g.type, // sprite del vehículo real (F-16A, Abrams, Arleigh Burke...)
    });
    if (g.n > 1) this.drawFlagBadge(ctx, x + 13, y - lift + 9, this.countryColor(g.owner), "×" + g.n);
  }

  // Insignia pequeña con el color del país y un texto (recuento/carga)
  drawFlagBadge(ctx, x, y, color, text) {
    if (!text) return;
    rrect(ctx, x - 11, y - 6, 22, 12, 3);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#0c1014";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, x, y + 3.5);
  }

  // Contacto enemigo sin identificar: insignia "?" gris con el total
  drawUnknownContact(ctx, x, y, total) {
    rrect(ctx, x - 12, y - 10, 24, 20, 5);
    ctx.fillStyle = "rgba(28,34,42,0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(159,176,192,0.8)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = "#cfd9e4";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText("?", x, y + 1);
    if (total > 1) {
      ctx.font = "bold 9px monospace";
      ctx.fillText("×" + total, x, y + 9);
    }
  }

  drawOverflowChip(ctx, x, y, n) {
    rrect(ctx, x - 9, y - 7, 18, 14, 4);
    ctx.fillStyle = "rgba(12,16,20,0.7)";
    ctx.fill();
    ctx.fillStyle = "#c9d2dc";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("+" + n, x, y + 3.5);
  }

  // Etiqueta de llegada ("Llega en 3 h 20 min") con contorno oscuro
  drawEtaLabel(ctx, x, y, text) {
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(8,12,16,0.8)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(text, x, y);
  }
}

// Radio clicable de una ficha: la mitad del sprite, con un mínimo cómodo para
// que las fichas sigan siendo fáciles de acertar con el mapa alejado del todo.
function hitRadius(size) {
  return Math.max(15, size * 0.5);
}

// Rectángulo redondeado (ruta) compatible con todos los navegadores
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Hash estable para fases de órbita por grupo
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Provincias con combate (duplicado ligero de combat.battleSet para no importar el motor aquí)
function battleProvinces(state) {
  const byProv = new Map();
  for (const u of state.units) {
    let a = byProv.get(u.pos);
    if (!a) byProv.set(u.pos, (a = []));
    a.push(u);
  }
  const out = new Set();
  for (const [pid, units] of byProv) {
    const owners = [...new Set(units.map((u) => u.owner))];
    for (let i = 0; i < owners.length && !out.has(pid); i++)
      for (let j = i + 1; j < owners.length; j++)
        if (atWar(state, owners[i], owners[j])) {
          out.add(pid);
          break;
        }
  }
  return out;
}

// Punto-en-polígono (ray casting) sobre el polígono lon/lat original
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = true;
  }
  return inside;
}

export function hitProvince(lon, lat) {
  // Varios polígonos pueden contener el punto (solapes del pipeline de datos,
  // p. ej. el anillo de Texas invadía el norte de México): gana el candidato de
  // MENOR área de bbox — las provincias pequeñas son siempre las precisas.
  let best = null;
  let bestArea = Infinity;
  for (const p of S.provinceList) {
    const b = p.bbox;
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
    let hit = false;
    for (const ring of p.rings) {
      if (pointInPolygon(lon, lat, ring)) { hit = true; break; }
    }
    if (!hit) continue;
    const area = (b[2] - b[0]) * (b[3] - b[1]);
    if (area < bestArea) { bestArea = area; best = p.id; }
  }
  return best;
}

// Inversa de la proyección Mercator (y en "grados proyectados" negados → latitud)
export function inverseMercY(y) {
  const a = Math.exp((-y * Math.PI) / 180);
  return ((2 * Math.atan(a) - Math.PI / 2) * 180) / Math.PI;
}
