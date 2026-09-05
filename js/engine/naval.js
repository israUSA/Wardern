// Operaciones navales: embarcar y desembarcar tropas con transportes.
// Reglas: embarcar requiere provincia costera con puerto controlado por el dueño del
// transporte; desembarcar en cualquier provincia costera adyacente (propia, neutral
// prohibida salvo propia, o enemiga en guerra = invasión).
import { S, unitDef, controller, atWar, log } from "./state.js";

export function transportCapacity(u) {
  return unitDef(u.type)?.capacity || 3;
}

// Carga unidades terrestres del propio país desde una provincia costera adyacente con puerto
export function embark(state, transportId) {
  const t = state.units.find((u) => u.id === transportId);
  if (!t || !isTransport(t) || t.edgeLeft) return { ok: false, msg: "El transporte debe estar anclado" };

  const capacity = transportCapacity(t) - (t.cargo?.length || 0);
  if (capacity <= 0) return { ok: false, msg: "Transporte lleno" };

  // provincia costera adyacente con puerto propio
  const candidates = (S.edges.get(t.pos) || [])
    .map((e) => S.provinces.get(e.to))
    .filter((p) => p && !p.isSea)
    .filter((p) => {
      const ps = state.provinces[p.id];
      return controller(ps) === t.owner && (ps.buildings.puerto || 0) >= 1;
    });
  if (!candidates.length) return { ok: false, msg: "No hay puerto propio adyacente" };

  let loaded = 0;
  for (const p of candidates) {
    const troops = state.units.filter(
      (u) => u.pos === p.id && u.owner === t.owner && !u.embarked && !u.edgeLeft && !unitDef(u.type)?.air && !isTransport(u)
    );
    for (const g of troops) {
      if (loaded >= capacity) break;
      g.embarked = t.id;
      t.cargo = t.cargo || [];
      t.cargo.push(g.id);
      loaded++;
    }
    if (loaded >= capacity) break;
  }
  if (!loaded) return { ok: false, msg: "No hay tropas terrestres que embarcar" };
  log(state, `${unitDef(t.type)?.name} embarca ${loaded} unidades en ${S.countries[t.owner].name}`, "info");
  return { ok: true, msg: `Embarcadas ${loaded} unidades` };
}

// Desembarca la carga en una provincia costera adyacente a la celda de mar del transporte
export function disembark(state, transportId, targetPid) {
  const t = state.units.find((u) => u.id === transportId);
  if (!t || !isTransport(t) || t.edgeLeft) return { ok: false, msg: "El transporte debe estar anclado" };
  if (!t.cargo?.length) return { ok: false, msg: "Sin carga" };

  const target = S.provinces.get(targetPid);
  const ps = state.provinces[targetPid];
  if (!target || target.isSea || !ps) return { ok: false, msg: "Destino inválido" };
  if (!(S.edges.get(t.pos) || []).some((e) => e.to === targetPid)) {
    return { ok: false, msg: "El destino no es adyacente al transporte" };
  }
  const ctrl = controller(ps);
  if (ctrl !== t.owner && !atWar(state, t.owner, ctrl)) {
    return { ok: false, msg: "No puedes desembarcar en un país neutral" };
  }
  for (const cid of t.cargo) {
    const g = state.units.find((x) => x.id === cid);
    if (g) {
      g.embarked = null;
      g.pos = targetPid;
      g.path = [];
      g.battleTicks = 0;
    }
  }
  log(state, `${S.countries[t.owner].name} desembarca ${t.cargo.length} unidades en ${target.name}`, "info");
  t.cargo = [];
  return { ok: true, msg: "Desembarco completado" };
}

function isTransport(u) {
  return unitDef(u.type)?.capacity > 0;
}
