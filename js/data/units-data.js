// =====================================================================
// Roster terrestre/aéreo de Wardern — 60 variantes de doctrina × tier
// (10 categorías × 2 doctrinas × 3 tiers) + 10 alias legacy.
// Patrón heredado del roster naval (docs/NAVAL.md, js/data/naval-data.js):
//  - hp = 100 SIEMPRE: el motor instancia a 100 HP y retira con HP < 30;
//    la fragilidad se expresa con la matriz `defense` (daño ×= 20/(20+def)).
//  - Escalado por tier: t1 ≈ 0.9× stats (redondeo hacia abajo) / 0.7× coste ·
//    t2 = ANCLA (stats del roster legacy verificado) · t3 ≈ 1.25× stats / 1.5× coste.
//    buildHours: t1 ×0.9, t3 ×1.2. Velocidad y hp CONSTANTES por categoría
//    (el tier se nota en combate y coste, no en movimiento).
//  - `rangedTicks` (solo artillería, 12): bombardeo preparatorio ×1.5.
//  - Sabor de doctrina (verificado con tools/test-variants.mjs, no rompe R1-R12):
//      · OCCIDENTAL "supervivencia y aviónica": +1 defensa contra el AIRE en toda
//        unidad terrestre y +1 defensa del caza contra caza (BVR). Cero cambios de ataque.
//      · ORIENTAL "doctrina de contra-fuerza": +1 ataque en las claves que CAZAN:
//        cazatanques/helicóptero contra blindados, antiaéreo/caza contra el aire,
//        bombardero contra personal, artillería contra motorizada y drone contra
//        infantería. Las claves de línea (inf/mot/mbt/art entre sí) quedan
//        SIMÉTRICAS: los combates de desgaste no inclinan la báscula por doctrina
//        (verificado: un +1 del MBT oriental contra artillería le daba el 78% de
//        los combates mixtos al poder snipear el apoyo enemigo).
//    Costes IDÉNTICOS entre doctrinas (simetría de balance, como en naval).
//  - Compatibilidad de guardados: las ids planas legacy ("infanteria", "mbt", …)
//    siguen resolviendo en `unitDef()` vía LEGACY_UNITS (stats legado intactos, sin
//    doctrine/tier). NO aparecen en los listados de reclutamiento (el motor las
//    filtra con `u.legacy`) pero las partidas viejas que tienen unidades con esas
//    ids cargan y combaten exactamente igual que antes.
// =====================================================================

// ---- ANCLA TIER 2 (stats del roster plano original, verificado R1-R12) ----
const LEGACY_BASE = {
  infanteria: {
    cost: { money: 20000, supplies: 1800, manpower: 1600, fuel: 0 },
    buildHours: 12, speed: 12, captures: true,
    attack: { infanteria: 10, motorizada: 10, mbt: 10, cazatanques: 10, artilleria: 10, antiaereo: 10, caza: 2, bombardero: 2, helicoptero: 4, drone: 6 },
    defense: { infanteria: 12, motorizada: 12, mbt: 11, cazatanques: 12, artilleria: 10, antiaereo: 12, caza: 6, bombardero: 6, helicoptero: 6, drone: 6 },
    terrainDefBonus: { llanura: 1, bosque: 1.3, selva: 1.35, montaña: 1.5, desierto: 0.95, tundra: 1.1, urbano: 1.6 },
    terrainAtkPenalty: {},
    rangedTicks: 0,
  },
  motorizada: {
    cost: { money: 30000, supplies: 2700, manpower: 1200, fuel: 800 },
    buildHours: 18, speed: 60, captures: true,
    attack: { infanteria: 9, motorizada: 9, mbt: 8, cazatanques: 8, artilleria: 9, antiaereo: 8, caza: 2, bombardero: 2, helicoptero: 4, drone: 4 },
    defense: { infanteria: 7, motorizada: 7, mbt: 7, cazatanques: 7, artilleria: 6, antiaereo: 7, caza: 5, bombardero: 5, helicoptero: 5, drone: 5 },
    terrainDefBonus: { llanura: 1, bosque: 1.1, selva: 1.1, montaña: 1.2, desierto: 0.9, tundra: 1, urbano: 1.2 },
    terrainAtkPenalty: {},
    rangedTicks: 0,
  },
  mbt: {
    cost: { money: 80000, supplies: 7200, manpower: 1000, fuel: 4000 },
    buildHours: 36, speed: 50, captures: false,
    attack: { infanteria: 14, motorizada: 15, mbt: 11, cazatanques: 7, artilleria: 13, antiaereo: 12, caza: 2, bombardero: 2, helicoptero: 3, drone: 4 },
    defense: { infanteria: 11, motorizada: 12, mbt: 11, cazatanques: 12, artilleria: 11, antiaereo: 11, caza: 8, bombardero: 7, helicoptero: 6, drone: 8 },
    terrainDefBonus: { llanura: 1, bosque: 1.1, selva: 1.05, montaña: 1.1, desierto: 0.95, tundra: 1, urbano: 1.15 },
    terrainAtkPenalty: { montaña: 0.5, urbano: 0.5, bosque: 0.75, selva: 0.7 },
    rangedTicks: 0,
  },
  cazatanques: {
    cost: { money: 50000, supplies: 4500, manpower: 700, fuel: 2500 },
    buildHours: 24, speed: 40, captures: false,
    attack: { infanteria: 6, motorizada: 10, mbt: 20, cazatanques: 10, artilleria: 10, antiaereo: 10, caza: 2, bombardero: 2, helicoptero: 3, drone: 4 },
    defense: { infanteria: 8, motorizada: 8, mbt: 9, cazatanques: 9, artilleria: 8, antiaereo: 8, caza: 7, bombardero: 7, helicoptero: 6, drone: 7 },
    terrainDefBonus: { llanura: 1, bosque: 1.25, selva: 1.2, montaña: 1.3, desierto: 1, tundra: 1, urbano: 1.3 },
    terrainAtkPenalty: { montaña: 0.6, urbano: 0.6 },
    rangedTicks: 0,
  },
  artilleria: {
    cost: { money: 60000, supplies: 5400, manpower: 900, fuel: 2000 },
    buildHours: 24, speed: 35, captures: false,
    attack: { infanteria: 16, motorizada: 12, mbt: 8, cazatanques: 8, artilleria: 10, antiaereo: 8, caza: 0, bombardero: 0, helicoptero: 0, drone: 0 },
    defense: { infanteria: 8, motorizada: 8, mbt: 6, cazatanques: 6, artilleria: 8, antiaereo: 8, caza: 6, bombardero: 5, helicoptero: 6, drone: 6 },
    terrainDefBonus: { llanura: 1, bosque: 1.2, selva: 1.1, montaña: 1.3, desierto: 1, tundra: 1, urbano: 1.2 },
    terrainAtkPenalty: { montaña: 0.7 },
    rangedTicks: 12,
  },
  antiaereo: {
    cost: { money: 30000, supplies: 2500, manpower: 400, fuel: 1000 },
    buildHours: 18, speed: 30, captures: false,
    attack: { infanteria: 3, motorizada: 9, mbt: 2, cazatanques: 2, artilleria: 3, antiaereo: 3, caza: 26, bombardero: 26, helicoptero: 24, drone: 22 },
    defense: { infanteria: 6, motorizada: 6, mbt: 5, cazatanques: 5, artilleria: 6, antiaereo: 6, caza: 9, bombardero: 9, helicoptero: 8, drone: 8 },
    terrainDefBonus: { llanura: 1, bosque: 1.1, selva: 1.05, montaña: 1, desierto: 1, tundra: 1, urbano: 1.15 },
    terrainAtkPenalty: {},
    rangedTicks: 0,
  },
  caza: {
    cost: { money: 45000, supplies: 4000, manpower: 300, fuel: 3000 },
    buildHours: 30, speed: 135, captures: false, air: true,
    attack: { infanteria: 4, motorizada: 4, mbt: 3, cazatanques: 3, artilleria: 8, antiaereo: 6, caza: 12, bombardero: 25, helicoptero: 20, drone: 22 },
    defense: { infanteria: 8, motorizada: 8, mbt: 8, cazatanques: 8, artilleria: 8, antiaereo: 6, caza: 10, bombardero: 10, helicoptero: 10, drone: 10 },
    terrainDefBonus: { llanura: 1, bosque: 1, selva: 1, montaña: 1, desierto: 1, tundra: 1, urbano: 1 },
    terrainAtkPenalty: {},
    rangedTicks: 0,
  },
  bombardero: {
    cost: { money: 90000, supplies: 8000, manpower: 500, fuel: 6000 },
    buildHours: 40, speed: 105, captures: false, air: true,
    attack: { infanteria: 24, motorizada: 24, mbt: 14, cazatanques: 12, artilleria: 16, antiaereo: 8, caza: 6, bombardero: 8, helicoptero: 10, drone: 10 },
    defense: { infanteria: 9, motorizada: 9, mbt: 8, cazatanques: 8, artilleria: 7, antiaereo: 5, caza: 5, bombardero: 8, helicoptero: 8, drone: 8 },
    terrainDefBonus: { llanura: 1, bosque: 1, selva: 1, montaña: 1, desierto: 1, tundra: 1, urbano: 1 },
    terrainAtkPenalty: {},
    rangedTicks: 0,
  },
  helicoptero: {
    cost: { money: 55000, supplies: 5000, manpower: 400, fuel: 2500 },
    buildHours: 30, speed: 80, captures: false, air: true,
    attack: { infanteria: 12, motorizada: 12, mbt: 20, cazatanques: 14, artilleria: 12, antiaereo: 4, caza: 4, bombardero: 8, helicoptero: 10, drone: 10 },
    defense: { infanteria: 7, motorizada: 7, mbt: 8, cazatanques: 8, artilleria: 7, antiaereo: 5, caza: 5, bombardero: 8, helicoptero: 8, drone: 8 },
    terrainDefBonus: { llanura: 1, bosque: 1, selva: 1, montaña: 1, desierto: 1, tundra: 1, urbano: 1 },
    terrainAtkPenalty: {},
    rangedTicks: 0,
  },
  drone: {
    cost: { money: 12000, supplies: 1000, manpower: 100, fuel: 500 },
    buildHours: 12, speed: 90, captures: false, air: true,
    attack: { infanteria: 5, motorizada: 5, mbt: 3, cazatanques: 3, artilleria: 5, antiaereo: 2, caza: 2, bombardero: 4, helicoptero: 4, drone: 4 },
    defense: { infanteria: 6, motorizada: 6, mbt: 6, cazatanques: 6, artilleria: 6, antiaereo: 4, caza: 4, bombardero: 6, helicoptero: 6, drone: 6 },
    terrainDefBonus: { llanura: 1, bosque: 1, selva: 1, montaña: 1, desierto: 1, tundra: 1, urbano: 1 },
    terrainAtkPenalty: {},
    rangedTicks: 0,
  },
};

const AIR_CATS = new Set(["caza", "bombardero", "helicoptero", "drone"]);
const KEYS = ["infanteria", "motorizada", "mbt", "cazatanques", "artilleria", "antiaereo", "caza", "bombardero", "helicoptero", "drone"];

// ---- Sabor de doctrina (deltas sobre el ancla t2; se heredan a t1 y t3) ----
const DOCTRINE_DELTAS = {
  occidental: {
    infanteria:  { defense: { caza: 1, bombardero: 1, helicoptero: 1, drone: 1 } },
    motorizada:  { defense: { caza: 1, bombardero: 1, helicoptero: 1, drone: 1 } },
    mbt:         { defense: { caza: 1, bombardero: 1, helicoptero: 1, drone: 1 } },
    cazatanques: { defense: { caza: 1, bombardero: 1, helicoptero: 1, drone: 1 } },
    artilleria:  { defense: { caza: 1, bombardero: 1, helicoptero: 1, drone: 1 } },
    antiaereo:   { defense: { caza: 1, bombardero: 1, helicoptero: 1, drone: 1 } },
    caza:        { defense: { caza: 1 } },
    bombardero:  {},
    helicoptero: {},
    drone:       {},
  },
  oriental: {
    infanteria:  {},
    motorizada:  {},
    mbt:         {},
    cazatanques: { attack: { mbt: 1 } },
    artilleria:  { attack: { motorizada: 1 } },
    antiaereo:   { attack: { caza: 1, bombardero: 1, helicoptero: 1, drone: 1 } },
    caza:        { attack: { caza: 1 } },
    bombardero:  { attack: { infanteria: 1, motorizada: 1 } },
    helicoptero: { attack: { mbt: 1 } },
    drone:       { attack: { infanteria: 1 } },
  },
};

// ---- Nombres reales por doctrina y época [t1 años 80, t2 años 2000, t3 ultra-moderno] ----
const NAMES = {
  occidental: {
    infanteria:  ["Infantería M16", "Infantería M4", "Infantería NGSW"],
    motorizada:  ["M113", "M2 Bradley", "M2A4 Bradley"],
    mbt:         ["M60 Patton", "M1 Abrams", "M1A2 SEPv3"],
    cazatanques: ["M901 ITV", "M3 Bradley", "M3A3 Bradley"],
    artilleria:  ["M109A2", "M109A6 Paladin", "M1299 ERCA"],
    antiaereo:   ["M163 Vulcan", "MIM-104 Patriot", "Patriot PAC-3"],
    caza:        ["F-16A", "F/A-18E", "F-22 Raptor"],
    bombardero:  ["B-52G", "B-2 Spirit", "B-21 Raider"],
    helicoptero: ["AH-1F Cobra", "AH-64 Apache", "AH-64E Guardian"],
    drone:       ["RQ-2 Pioneer", "RQ-1 Predator", "MQ-9 Reaper"],
  },
  oriental: {
    infanteria:  ["Infantería AKM", "Infantería AK-74", "Infantería Ratnik"],
    motorizada:  ["BMP-1", "BMP-2", "BMP-3"],
    mbt:         ["T-62", "T-72", "T-90M"],
    cazatanques: ["BRDM-2 Konkurs", "Shturm-S", "Kornet-D"],
    artilleria:  ["D-30", "2S19 Msta-S", "2S35 Koalitsiya"],
    antiaereo:   ["ZSU-23-4 Shilka", "9K37 Buk", "S-400 Triumf"],
    caza:        ["MiG-23", "Su-27", "Su-57"],
    bombardero:  ["Tu-22M2", "Tu-22M3", "Tu-160M"],
    helicoptero: ["Mi-24D", "Mi-28N", "Mi-28NM"],
    drone:       ["Pchela-1T", "Orlan-10", "Orion"],
  },
};

const ICONS = {
  infanteria: "infanteria", motorizada: "motorizada", mbt: "mbt", cazatanques: "cazatanques",
  artilleria: "artilleria", antiaereo: "antiaereo", caza: "caza", bombardero: "bombardero",
  helicoptero: "helicoptero", drone: "drone",
};

const round500 = (v) => Math.round(v / 500) * 500;
const round100 = (v) => Math.round(v / 100) * 100;
const round50 = (v) => Math.round(v / 50) * 50;

// Escala las matrices attack/defense: t1 redondea hacia ABAJO (0.9×) para que
// ninguna clave IgUALE al ancla; t3 redondea estándar (1.25×). Garantiza
// escalado estrictamente monótono y órdenes de selección de objetivo intactos.
function scaleMatrix(m, factor, floorIt) {
  const out = {};
  for (const k of KEYS) out[k] = floorIt ? Math.floor(m[k] * factor) : Math.round(m[k] * factor);
  return out;
}

function cloneDef(base) {
  return {
    cost: { ...base.cost },
    attack: { ...base.attack },
    defense: { ...base.defense },
    terrainDefBonus: { ...base.terrainDefBonus },
    terrainAtkPenalty: { ...base.terrainAtkPenalty },
    buildHours: base.buildHours,
    hp: 100, // contrato del motor: todas las unidades a 100 HP (docs/UNITS.md)
    speed: base.speed,
    captures: base.captures,
    air: !!base.air,
    rangedTicks: base.rangedTicks,
  };
}

function applyDeltas(def, deltas) {
  if (deltas.attack) for (const [k, v] of Object.entries(deltas.attack)) def.attack[k] += v;
  if (deltas.defense) for (const [k, v] of Object.entries(deltas.defense)) def.defense[k] += v;
  return def;
}

// Construye la variante de `tier` a partir del ancla t2 ya ajustada por doctrina
function buildTier(anchor, cat, doctrine, tier, name) {
  const def = cloneDef(anchor);
  if (tier === 1) {
    def.cost = {
      money: round500(anchor.cost.money * 0.7),
      supplies: round100(anchor.cost.supplies * 0.7),
      manpower: round50(anchor.cost.manpower * 0.7),
      fuel: round100((anchor.cost.fuel || 0) * 0.7),
    };
    def.buildHours = Math.round(anchor.buildHours * 0.9);
    def.attack = scaleMatrix(anchor.attack, 0.9, true);
    def.defense = scaleMatrix(anchor.defense, 0.9, true);
  } else if (tier === 3) {
    def.cost = {
      money: round500(anchor.cost.money * 1.5),
      supplies: round100(anchor.cost.supplies * 1.5),
      manpower: round50(anchor.cost.manpower * 1.5),
      fuel: round100((anchor.cost.fuel || 0) * 1.5),
    };
    def.buildHours = Math.round(anchor.buildHours * 1.2);
    def.attack = scaleMatrix(anchor.attack, 1.25, false);
    def.defense = scaleMatrix(anchor.defense, 1.25, false);
  }
  return {
    id: `${doctrine === "occidental" ? "occ" : "ori"}-${tier}-${cat}`,
    doctrine, tier, category: cat,
    name, icon: ICONS[cat],
    ...def,
  };
}

export const GROUND_VARIANTS = {};
for (const cat of KEYS) {
  for (const doctrine of ["occidental", "oriental"]) {
    // ancla t2 = base legacy + deltas de doctrina (se propagan escalados a t1/t3)
    const anchor = applyDeltas(cloneDef(LEGACY_BASE[cat]), DOCTRINE_DELTAS[doctrine][cat]);
    for (let tier = 1; tier <= 3; tier++) {
      const v = buildTier(anchor, cat, doctrine, tier, NAMES[doctrine][cat][tier - 1]);
      GROUND_VARIANTS[v.id] = v;
    }
  }
}

// ---- Alcance de tiro de la artillería (km de MAPA) ----
// Mismo criterio que AIR_RANGE_SCALE en air-combat-data.js: el dato real no
// sirve tal cual porque entre dos provincias contiguas hay 324 km de mediana y
// un M109 real alcanza 24 km, así que no llegaría nunca a la de al lado.
//
// Aquí la proporción real NO se conserva, y es deliberado: el abanico real va de
// 15 km (D-30) a 70 km (ERCA), casi ×5, y al escalarlo el tier 3 acabaría
// disparando más lejos que un misil de crucero. Se comprime a un salto por tier
// medido contra esa mediana de 324 km:
//   · t1 → no alcanza la provincia vecina media; bate la suya y las pegadas.
//   · t2 → alcanza la vecina con holgura: es el salto que se nota al investigar.
//   · t3 → llega a vecinas de segundo salto en las zonas apretadas del mapa.
// La salva de cohetes (missiles-data.js) sigue por encima de las tres: un
// lanzacohetes supera en alcance a un obús, igual que en la realidad.
const ARTILLERY_RANGE_KM = { 1: 300, 2: 420, 3: 620 };
for (const v of Object.values(GROUND_VARIANTS)) {
  if (v.category === "artilleria") v.rangoKm = ARTILLERY_RANGE_KM[v.tier];
}

// ---- Variantes especiales fuera de la rejilla doctrina × tier ----
// La rejilla genera UNA variante por doctrina y tier, pero la doctrina real no
// funciona así: el F-35 no sustituye al F-22, conviven. Uno es superioridad aérea
// pura y el otro el multirol furtivo de ataque, y las fuerzas aéreas compran
// ambos. Se añade como SEGUNDA variante occidental de tier 3 sin tocar el
// generador: availableVariants filtra por categoría, doctrina y tier investigado,
// no exige unicidad, así que ambos aparecen juntos en el reclutamiento.
//
// Deltas frente al F-22 (occ-3-caza), todos deliberados:
//  - Más barato (0,82×) y algo más rápido de construir: es el avión "de número".
//  - Más lento (360 vs 400 km/h de escala): supercrucero solo lo tiene el Raptor.
//  - PEOR contra el aire (caza 13 vs 15, bombardero 27 vs 31) y MEJOR contra el
//    suelo (infantería 8 vs 5, artillería 12 vs 10, antiaéreo 11 vs 8).
//  - Defensa casi idéntica; cede 1 punto en caza.
// Su verdadera diferencia está en el armamento y los sensores, en
// js/data/air-combat-data.js: menos misiles que el Raptor pero bahía interna
// mixta aire-aire + aire-suelo, que es justo lo que el F-22 no tiene.
export const EXTRA_VARIANTS = {
  "occ-3-caza-f35": {
    id: "occ-3-caza-f35", doctrine: "occidental", tier: 3, category: "caza",
    name: "F-35A Lightning II", icon: "caza",
    cost: { money: 55000, supplies: 5000, manpower: 400, fuel: 3800 },
    buildHours: 32, hp: 100, speed: 120, captures: false, air: true,
    attack: { infanteria: 8, motorizada: 8, mbt: 6, cazatanques: 6, artilleria: 12, antiaereo: 11, caza: 13, bombardero: 27, helicoptero: 22, drone: 25 },
    defense: { infanteria: 10, motorizada: 10, mbt: 10, cazatanques: 10, artilleria: 10, antiaereo: 9, caza: 13, bombardero: 13, helicoptero: 13, drone: 13 },
    terrainDefBonus: { llanura: 1, bosque: 1, selva: 1, montaña: 1, desierto: 1, tundra: 1, urbano: 1 },
    terrainAtkPenalty: {},
    rangedTicks: 0,
  },
  // Convive con el MQ-9 (occ-3-drone) igual que el F-35 con el F-22. No es un
  // Reaper mejor: es otra cosa. Cuesta el triple, no lleva armas y vuela más
  // lento, pero su firma radar (rcs 0.96 en air-combat-data.js) lo vuelve
  // invisible para cualquier radar de caza. Se compra para VER, no para pegar.
  "occ-3-drone-rq190": {
    id: "occ-3-drone-rq190", doctrine: "occidental", tier: 3, category: "drone",
    name: "RQ-190", icon: "drone",
    cost: { money: 45000, supplies: 3800, manpower: 150, fuel: 2200 },
    buildHours: 26, hp: 100, speed: 85, captures: false, air: true,
    attack: { infanteria: 0, motorizada: 0, mbt: 0, cazatanques: 0, artilleria: 0, antiaereo: 0, caza: 0, bombardero: 0, helicoptero: 0, drone: 0 },
    defense: { infanteria: 8, motorizada: 8, mbt: 8, cazatanques: 8, artilleria: 8, antiaereo: 6, caza: 6, bombardero: 8, helicoptero: 8, drone: 8 },
    terrainDefBonus: { llanura: 1, bosque: 1, selva: 1, montaña: 1, desierto: 1, tundra: 1, urbano: 1 },
    terrainAtkPenalty: {},
    rangedTicks: 0,
  },
};

// ---- Alias legacy: ids planas de las partidas guardadas (stats intachables) ----
// Sin `doctrine` ni `tier`: se comportan exactamente como antes (tier efectivo 1,
// reclutables por cualquier doctrina si algún día se listaran). `legacy: true` le
// dice al motor que NO las ofrezca en availableVariants/doctrineVariants.
export const LEGACY_UNITS = {};
for (const [cat, base] of Object.entries(LEGACY_BASE)) {
  LEGACY_UNITS[cat] = {
    id: cat, name: { infanteria: "Infantería", motorizada: "Motorizada", mbt: "Tanque (MBT)",
      cazatanques: "Cazatanques", artilleria: "Artillería", antiaereo: "Antiaéreo", caza: "Caza",
      bombardero: "Bombardero", helicoptero: "Helicóptero de ataque", drone: "Drone (UAV)" }[cat],
    category: cat, icon: ICONS[cat],
    ...cloneDef(base),
    legacy: true,
  };
}

// Mapa consumido por el motor: variantes nuevas + especiales + alias legacy
// (unitDef resuelve las tres familias)
export const UNITS = { ...GROUND_VARIANTS, ...EXTRA_VARIANTS, ...LEGACY_UNITS };

// Categorías de unidades (contrato del motor para la UI y el reclutamiento)
export const UNIT_CATEGORIES = [
  { id: "infanteria", name: "Infantería", icon: "infanteria" },
  { id: "motorizada", name: "Motorizada", icon: "motorizada" },
  { id: "mbt", name: "Tanque (MBT)", icon: "mbt" },
  { id: "cazatanques", name: "Cazatanques", icon: "cazatanques" },
  { id: "artilleria", name: "Artillería", icon: "artilleria" },
  { id: "antiaereo", name: "Antiaéreo", icon: "antiaereo" },
  { id: "caza", name: "Caza", icon: "caza", air: true },
  { id: "bombardero", name: "Bombardero", icon: "bombardero", air: true },
  { id: "helicoptero", name: "Helicóptero", icon: "helicoptero", air: true },
  { id: "drone", name: "Drone", icon: "drone", air: true },
];
