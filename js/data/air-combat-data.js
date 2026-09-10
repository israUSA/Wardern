// =====================================================================
// Combate aéreo de Wardern — radar, cargas de armamento y misiles guiados.
// Ver docs/AIR-COMBAT.md.
//
// A diferencia del arsenal de js/data/missiles-data.js (golpes contra la
// PROVINCIA, sin munición almacenada, solo cooldown), aquí cada avión lleva una
// CARGA FINITA de misiles y dispara contra una UNIDAD concreta:
//  - Aire-aire: el radar detecta aviones enemigos a más distancia de la que
//    alcanza cualquier misil, así que ver un contacto no significa poder tirarle.
//  - Aire-suelo: cada arma solo sirve contra ciertas categorías (un Maverick es
//    anticarro, un HARM es antirradar, una JDAM es contra tropa a pie).
//  - Todo disparo es probabilístico (Pk): por eso los aviones llevan varios.
//
// Las cifras son las reales del arma (alcance efectivo publicado) redondeadas;
// las cargas son configuraciones estándar documentadas de cada avión, no el
// máximo teórico de pilones. Pk y daño sí son valores de juego: están calibrados
// para que derribar un caza cueste ~2 impactos (hp = 100, retirada por debajo
// de 30 HP, ver docs/UNITS.md).
// =====================================================================

// ---- ESCALA DE TEATRO ----
// Las cifras de abajo son las REALES del arma, pero el mapa no está a escala de
// combate aéreo: entre dos provincias contiguas de Wardern hay 324 km de mediana
// (139 km en el decil más apretado, medido sobre los 1.376 pares adyacentes del
// mapa). Con alcances literales, un AIM-9 de 18 km no llegaría nunca a la
// provincia de al lado y el radar del F-16 no vería absolutamente nada.
//
// Se multiplica TODO por el mismo factor —misiles, radares y antiaéreos—, así que
// las proporciones entre armas quedan intactas: el AMRAAM sigue alcanzando
// exactamente 5,8 veces más que el Sidewinder. Lo que cambia es solo la unidad de
// medida del teatro. Con ×4 cada arma cae en su papel doctrinal real:
//   · Sidewinder / Hellfire / Maverick / JDAM → alcance de la propia provincia:
//     hay que meterse encima del enemigo (combate visual y apoyo cercano).
//   · AMRAAM / R-77 / HARM / Kh-31P → alcanzan provincias vecinas: son las armas
//     de disparar desde casa (BVR y supresión de defensas a distancia).
// Además, dos unidades en la MISMA provincia están a distancia 0: comparten sector.
export const AIR_RANGE_SCALE = 4;

// ---- Armas guiadas (id → ficha) ----
// tipo: "aa" aire-aire · "as" aire-suelo
// rangoKm: alcance efectivo · pk: probabilidad base de impacto en el centro de
// la envolvente · danio: HP al blanco · velocidadKmH: para el tiempo de vuelo
// clases: categorías que puede atacar ("as"); las "aa" atacan cualquier aeronave
// coste/rearmeMin: lo que cuesta y tarda REPONER un misil en base aérea
export const AIR_WEAPONS = {
  // ---------- Aire-aire occidental ----------
  aim9: {
    id: "aim9", nombre: "AIM-9L Sidewinder", tipo: "aa", guia: "infrarroja",
    rangoKm: 18, pk: 0.7, danio: 55, velocidadKmH: 3000,
    coste: { money: 1200, supplies: 120 }, rearmeMin: 12,
  },
  aim7: {
    id: "aim7", nombre: "AIM-7M Sparrow", tipo: "aa", guia: "radar semiactivo",
    rangoKm: 45, pk: 0.45, danio: 65, velocidadKmH: 4400,
    coste: { money: 2200, supplies: 220 }, rearmeMin: 18,
  },
  aim120: {
    id: "aim120", nombre: "AIM-120C AMRAAM", tipo: "aa", guia: "radar activo",
    rangoKm: 105, pk: 0.6, danio: 70, velocidadKmH: 4900,
    coste: { money: 4500, supplies: 450 }, rearmeMin: 24,
  },
  aim9x: {
    id: "aim9x", nombre: "AIM-9X Sidewinder", tipo: "aa", guia: "infrarroja",
    rangoKm: 35, pk: 0.8, danio: 55, velocidadKmH: 3000,
    coste: { money: 2600, supplies: 260 }, rearmeMin: 14,
  },
  stinger: {
    id: "stinger", nombre: "AIM-92 Stinger", tipo: "aa", guia: "infrarroja",
    rangoKm: 8, pk: 0.55, danio: 40, velocidadKmH: 2400,
    coste: { money: 900, supplies: 90 }, rearmeMin: 10,
  },

  // ---------- Aire-aire oriental ----------
  r60: {
    id: "r60", nombre: "R-60 (AA-8 Aphid)", tipo: "aa", guia: "infrarroja",
    rangoKm: 8, pk: 0.55, danio: 40, velocidadKmH: 2900,
    coste: { money: 800, supplies: 80 }, rearmeMin: 10,
  },
  r23: {
    id: "r23", nombre: "R-23 (AA-7 Apex)", tipo: "aa", guia: "radar semiactivo",
    rangoKm: 35, pk: 0.4, danio: 60, velocidadKmH: 3000,
    coste: { money: 1900, supplies: 190 }, rearmeMin: 18,
  },
  r73: {
    id: "r73", nombre: "R-73 (AA-11 Archer)", tipo: "aa", guia: "infrarroja",
    rangoKm: 30, pk: 0.75, danio: 55, velocidadKmH: 3000,
    coste: { money: 2400, supplies: 240 }, rearmeMin: 14,
  },
  r27: {
    id: "r27", nombre: "R-27 (AA-10 Alamo)", tipo: "aa", guia: "radar semiactivo",
    rangoKm: 70, pk: 0.5, danio: 65, velocidadKmH: 4900,
    coste: { money: 3200, supplies: 320 }, rearmeMin: 20,
  },
  r77: {
    id: "r77", nombre: "R-77 (AA-12 Adder)", tipo: "aa", guia: "radar activo",
    rangoKm: 110, pk: 0.6, danio: 70, velocidadKmH: 4900,
    coste: { money: 4300, supplies: 430 }, rearmeMin: 24,
  },
  igla: {
    id: "igla", nombre: "Igla-V", tipo: "aa", guia: "infrarroja",
    rangoKm: 8, pk: 0.55, danio: 40, velocidadKmH: 2300,
    coste: { money: 800, supplies: 80 }, rearmeMin: 10,
  },

  // ---------- Aire-suelo occidental ----------
  agm65: {
    id: "agm65", nombre: "AGM-65 Maverick", tipo: "as", guia: "electroóptica",
    rangoKm: 25, pk: 0.8, danio: 45, velocidadKmH: 1150,
    clases: ["mbt", "cazatanques", "motorizada", "artilleria"],
    coste: { money: 2500, supplies: 250 }, rearmeMin: 20,
  },
  agm88: {
    id: "agm88", nombre: "AGM-88 HARM", tipo: "as", guia: "antirradar",
    rangoKm: 100, pk: 0.7, danio: 60, velocidadKmH: 2300,
    clases: ["antiaereo"],
    coste: { money: 5000, supplies: 500 }, rearmeMin: 26,
  },
  gbu: {
    id: "gbu", nombre: "GBU-31 JDAM", tipo: "as", guia: "GPS",
    rangoKm: 25, pk: 0.85, danio: 35, velocidadKmH: 900,
    clases: ["infanteria", "motorizada", "artilleria", "antiaereo"],
    coste: { money: 800, supplies: 160 }, rearmeMin: 12,
  },
  hellfireL: {
    id: "hellfireL", nombre: "AGM-114 Hellfire", tipo: "as", guia: "láser",
    rangoKm: 8, pk: 0.85, danio: 40, velocidadKmH: 1600,
    clases: ["mbt", "cazatanques", "motorizada", "artilleria", "infanteria"],
    coste: { money: 1500, supplies: 150 }, rearmeMin: 8,
  },
  tow: {
    id: "tow", nombre: "BGM-71 TOW", tipo: "as", guia: "alámbrica",
    rangoKm: 4, pk: 0.75, danio: 35, velocidadKmH: 1100,
    clases: ["mbt", "cazatanques", "motorizada"],
    coste: { money: 900, supplies: 90 }, rearmeMin: 8,
  },

  // ---------- Aire-suelo oriental ----------
  kh25: {
    id: "kh25", nombre: "Kh-25ML", tipo: "as", guia: "láser",
    rangoKm: 20, pk: 0.75, danio: 45, velocidadKmH: 1300,
    clases: ["mbt", "cazatanques", "motorizada", "artilleria"],
    coste: { money: 2200, supplies: 220 }, rearmeMin: 20,
  },
  kh31p: {
    id: "kh31p", nombre: "Kh-31P", tipo: "as", guia: "antirradar",
    rangoKm: 110, pk: 0.7, danio: 60, velocidadKmH: 3200,
    clases: ["antiaereo"],
    coste: { money: 4800, supplies: 480 }, rearmeMin: 26,
  },
  kab: {
    id: "kab", nombre: "KAB-500S", tipo: "as", guia: "GPS",
    rangoKm: 20, pk: 0.8, danio: 35, velocidadKmH: 900,
    clases: ["infanteria", "motorizada", "artilleria", "antiaereo"],
    coste: { money: 700, supplies: 140 }, rearmeMin: 12,
  },
  ataka: {
    id: "ataka", nombre: "9M120 Ataka", tipo: "as", guia: "radiocomando",
    rangoKm: 8, pk: 0.85, danio: 40, velocidadKmH: 1700,
    clases: ["mbt", "cazatanques", "motorizada", "artilleria", "infanteria"],
    coste: { money: 1400, supplies: 140 }, rearmeMin: 8,
  },
  shturm: {
    id: "shturm", nombre: "9M114 Shturm", tipo: "as", guia: "radiocomando",
    rangoKm: 5, pk: 0.7, danio: 35, velocidadKmH: 1300,
    clases: ["mbt", "cazatanques", "motorizada"],
    coste: { money: 800, supplies: 80 }, rearmeMin: 8,
  },
};

// ---- Cargas y sensores por variante ----
// radarKm: alcance de DETECCIÓN de aeronaves (siempre > que sus misiles: ves
//   antes de poder disparar, que es la tensión del combate BVR).
// rcs: firma radar inversa, 0 = avión normal, 1 = invisible. RECORTA el alcance
//   al que TE detectan: quien te busca con radarKm te ve a radarKm × (1 − rcs).
//   Es la furtividad "de no ser visto", distinta de la de abajo.
// evasion: 0-1, resta efectividad al Pk de los misiles que ya te dispararon
//   (maniobra, contramedidas, señuelos). Es la furtividad "de no ser tocado".
// armas: { idArma: unidades } — configuración estándar del avión.
export const AIR_LOADOUTS = {
  // ---------- Cazas ----------
  "occ-1-caza": { // F-16A Block 15 — radar APG-66
    radarKm: 75, rcs: 0, evasion: 0.1,
    armas: { aim9: 4, agm65: 2 },
  },
  "occ-2-caza": { // F/A-18E Super Hornet — radar APG-73, firma algo reducida
    radarKm: 150, rcs: 0.15, evasion: 0.2,
    armas: { aim120: 4, aim9x: 2, agm65: 4, agm88: 2 },
  },
  "occ-3-caza": { // F-22 Raptor — APG-77 AESA, carga interna
    radarKm: 250, rcs: 0.8, evasion: 0.65,
    armas: { aim120: 6, aim9x: 2, gbu: 2 },
  },
  "occ-3-caza-f35": { // F-35A Lightning II — APG-81 AESA, configuración furtiva
    // Bahía INTERNA: 4 AMRAAM + 2 JDAM. Menos disparos que el Raptor (6 frente a
    // 10), pero es el único caza furtivo occidental que entra a por blindados y
    // baterías sin colgar nada por fuera. El "modo bestia" con pilones externos
    // no se modela: rompe la furtividad, que es justo lo que se compra aquí.
    radarKm: 200, rcs: 0.78, evasion: 0.6,
    armas: { aim120: 4, gbu: 2 },
  },
  "ori-1-caza": { // MiG-23ML — radar Sapfir-23
    radarKm: 55, rcs: 0, evasion: 0.05,
    armas: { r23: 2, r60: 4 },
  },
  "ori-2-caza": { // Su-27 — radar N001 (el Su-33 es su hermano embarcado)
    radarKm: 110, rcs: 0, evasion: 0.15,
    armas: { r27: 6, r73: 4, kh25: 2 },
  },
  "ori-3-caza": { // Su-57 — N036 Belka, carga interna
    radarKm: 240, rcs: 0.62, evasion: 0.42,
    armas: { r77: 4, r73: 2, kh31p: 2 },
  },

  // ---------- Bombarderos ----------
  "occ-1-bombardero": { radarKm: 60, rcs: 0, evasion: 0.05, armas: { gbu: 12, agm65: 4 } }, // B-52G
  "occ-2-bombardero": { radarKm: 80, rcs: 0.82, evasion: 0.62, armas: { gbu: 16, agm88: 2 } }, // B-2 Spirit
  "occ-3-bombardero": { radarKm: 120, rcs: 0.88, evasion: 0.68, armas: { gbu: 16, agm88: 4, agm65: 4 } }, // B-21 Raider
  "ori-1-bombardero": { radarKm: 60, rcs: 0, evasion: 0.05, armas: { kab: 12, kh25: 4 } }, // Tu-22M2
  "ori-2-bombardero": { radarKm: 90, rcs: 0, evasion: 0.1, armas: { kab: 16, kh31p: 2 } }, // Tu-22M3
  "ori-3-bombardero": { radarKm: 130, rcs: 0.15, evasion: 0.22, armas: { kab: 16, kh31p: 4, kh25: 4 } }, // Tu-160M

  // ---------- Helicópteros de ataque ----------
  // Radar cortísimo: el mástil del Longbow ve blindados a ~8 km, no hace BVR.
  "occ-1-helicoptero": { radarKm: 10, rcs: 0, evasion: 0.1, armas: { tow: 8 } },
  "occ-2-helicoptero": { radarKm: 12, rcs: 0, evasion: 0.15, armas: { hellfireL: 16 } },
  "occ-3-helicoptero": { radarKm: 16, rcs: 0.1, evasion: 0.25, armas: { hellfireL: 16, stinger: 2 } },
  "ori-1-helicoptero": { radarKm: 8, rcs: 0, evasion: 0.1, armas: { shturm: 4 } },
  "ori-2-helicoptero": { radarKm: 12, rcs: 0, evasion: 0.15, armas: { ataka: 16 } },
  "ori-3-helicoptero": { radarKm: 16, rcs: 0.1, evasion: 0.25, armas: { ataka: 16, igla: 2 } },

  // ---------- Drones ----------
  // Los t1/t2 son recon puro (ver docs/MISSILES.md §4). Los t3 sí van armados
  // —MQ-9 Reaper y Orion lo están— y eso los hace también BLANCO válido: no
  // combaten en provincia, pero un caza enemigo puede derribarlos con misiles.
  "occ-1-drone": { radarKm: 120, rcs: 0.2, evasion: 0.3, armas: {} },
  "occ-2-drone": { radarKm: 200, rcs: 0.2, evasion: 0.3, armas: {} },
  "occ-3-drone": { radarKm: 300, rcs: 0.25, evasion: 0.35, armas: { hellfireL: 4 } },
  "occ-3-drone-rq190": { // RQ-190 — UAV furtivo de penetración profunda
    // rcs 0.96: para un radar de caza es sencillamente invisible (el APG-77 del
    // Raptor lo cogería a 40 km, o sea encima). Solo las redes antiaéreas de
    // última generación con banda métrica lo ven, y aun así muy tarde: un S-400
    // lo detecta a ~260 km de los 1.400 km a los que ve un avión normal.
    // Sin armas: es un ojo, no un cazador.
    radarKm: 420, rcs: 0.96, evasion: 0.7,
    armas: {},
  },
  "ori-1-drone": { radarKm: 120, rcs: 0.2, evasion: 0.3, armas: {} },
  "ori-2-drone": { radarKm: 200, rcs: 0.2, evasion: 0.3, armas: {} },
  "ori-3-drone": { radarKm: 300, rcs: 0.25, evasion: 0.35, armas: { ataka: 4 } },

  // ---------- Alias legacy ----------
  // Ids planas de las partidas guardadas antes del roster de variantes
  // (docs/UNITS.md). Sin esto, un caza cargado de un guardado viejo se quedaría
  // sin radar ni armamento y el jugador no entendería por qué. Se les da la
  // dotación t1 occidental, coherente con su tier efectivo 1.
  caza: { radarKm: 75, rcs: 0, evasion: 0.1, armas: { aim9: 4, agm65: 2 } },
  bombardero: { radarKm: 60, rcs: 0, evasion: 0.05, armas: { gbu: 12, agm65: 4 } },
  helicoptero: { radarKm: 10, rcs: 0, evasion: 0.1, armas: { tow: 8 } },
  drone: { radarKm: 120, rcs: 0.2, evasion: 0.3, armas: {} },
};

// Evasión de las unidades de SUPERFICIE frente a un misil aire-suelo. La
// infantería dispersa y camuflada es sorprendentemente difícil de acertar; el
// antiaéreo lo es porque se defiende solo (y por eso existen los antirradar).
export const GROUND_EVASION = {
  infanteria: 0.25,
  motorizada: 0.15,
  mbt: 0.1,
  cazatanques: 0.15,
  artilleria: 0.1,
  antiaereo: 0.35,
  // Navales: blancos grandes pero con defensa antiaérea propia
  corbeta: 0.2, fragata: 0.25, destructor: 0.3, submarino: 0.15,
  portaviones: 0.3, transporte: 0.1,
};

// Alcance de reacción del ANTIAÉREO enemigo (km). Si disparas aire-suelo desde
// dentro de esta burbuja, la batería te dispara de vuelta: es lo que obliga a
// suprimir las defensas con HARM/Kh-31P antes de meter la aviación de ataque.
// Cifras del sistema real de cada variante (Vulcan/Shilka son cañones, de ahí
// los 5 km; el S-400 se recorta respecto a su cifra teórica por jugabilidad).
export const SAM_RANGE_KM = {
  "occ-1-antiaereo": 5, // M163 Vulcan
  "occ-2-antiaereo": 70, // MIM-104 Patriot
  "occ-3-antiaereo": 120, // Patriot PAC-3
  "ori-1-antiaereo": 5, // ZSU-23-4 Shilka
  "ori-2-antiaereo": 45, // 9K37 Buk
  "ori-3-antiaereo": 200, // S-400 Triumf
  antiaereo: 5, // alias legacy
};

// Probabilidad de que una batería antiaérea acierte al avión que la ataca, y
// daño que le hace. Es la penalización por volar sobre defensas activas.
export const SAM_PK = 0.35;
export const SAM_DAMAGE = 45;

// Un blanco a quemarropa no da tiempo de reacción; al límite de la envolvente el
// misil llega sin energía. Multiplicadores sobre el Pk base según la distancia
// normalizada al alcance del arma (0 = pegado, 1 = alcance máximo).
export const PK_RANGE_CURVE = [
  { hasta: 0.35, mult: 1.0 },
  { hasta: 0.6, mult: 0.9 },
  { hasta: 0.8, mult: 0.72 },
  { hasta: 1.0, mult: 0.5 },
];

// Bonus de Pk por nivel de veteranía del piloto (docs/UNITS.md)
export const PK_VET_BONUS = 0.05;

// ---- Radares de VIGILANCIA terrestres (distinto del alcance de tiro) ----
// El antiaéreo no solo dispara: vigila, y su radar alimenta la imagen táctica de
// todo su bando (enlace de datos). Es el contrapeso a la furtividad, porque un
// radar terrestre grande en banda métrica ve lo que ningún radar de caza puede.
//   km: alcance de detección contra un avión SIN furtividad.
//   antiStealth: cuánto anula la furtividad del blanco, 0 = nada (como un caza),
//     1 = la ignora por completo. Alcance real = km × (1 − rcs × (1 − antiStealth)).
// Los t1 son cañones con mira óptica: ni radar de vigilancia ni nada parecido.
export const SAM_RADAR = {
  "occ-1-antiaereo": { km: 30, antiStealth: 0 }, // M163 Vulcan
  "occ-2-antiaereo": { km: 150, antiStealth: 0.05 }, // MIM-104 Patriot
  "occ-3-antiaereo": { km: 250, antiStealth: 0.14 }, // Patriot PAC-3 + red de sensores
  "ori-1-antiaereo": { km: 30, antiStealth: 0 }, // ZSU-23-4 Shilka
  "ori-2-antiaereo": { km: 160, antiStealth: 0.05 }, // 9K37 Buk
  "ori-3-antiaereo": { km: 350, antiStealth: 0.15 }, // S-400 con acompañamiento métrico
  antiaereo: { km: 30, antiStealth: 0 }, // alias legacy
};

// ---- Aviación embarcada ----
// Plazas de aeronave por portaviones. La asimetría es real: los portaviones
// soviéticos/rusos nunca llevaron un ala aérea comparable a la estadounidense
// (el Kiev era un crucero portaaeronaves de despegue vertical).
export const CARRIER_CAPACITY = {
  "occ-1-portaviones": 3, // USS Kitty Hawk
  "occ-2-portaviones": 4, // USS Nimitz
  "occ-3-portaviones": 6, // USS Gerald R. Ford
  "ori-1-portaviones": 2, // Kiev (Proy. 1143)
  "ori-2-portaviones": 3, // Kuznetsov (Proy. 11435)
  "ori-3-portaviones": 5, // Shtorm (Proy. 23000)
  portaviones: 3, // alias legacy
};

// Aparatos con tren, gancho y plegado de alas para operar desde cubierta.
// Occidente: el Super Hornet ES el caza embarcado de la US Navy y el F-35 tiene
// su variante C de portaviones. Oriente: el Su-33 es el Su-27 navalizado que
// voló desde el Kuznetsov, y el Orion es el UAV de la casa.
// CONCESIÓN DE JUEGO: el Su-57 no tiene variante naval real (el caza embarcado
// ruso es el MiG-29K); se admite para que el bando oriental tenga un furtivo
// embarcado y la simetría del sistema se sostenga.
export const CARRIER_CAPABLE = new Set([
  "occ-2-caza", // F/A-18E Super Hornet
  "occ-3-caza-f35", // F-35 (variante C)
  "occ-3-drone-rq190", // RQ-190
  "ori-2-caza", // Su-27 → Su-33
  "ori-3-caza", // Su-57 (concesión, ver arriba)
  "ori-3-drone", // Orion
]);

// Rearme: en provincia propia con base aérea, o a bordo de un portaviones propio
// (para eso lleva pañoles). En ambos casos, con el aparato detenido.
export const REARM_MIN_AEROBASE = 1;
