#!/usr/bin/env node
/* ============================================================================
   Wardern — pipeline de datos del mapa (América)
   Fuente: Natural Earth 10m (admin-1 states/provinces + admin-0 countries).
   Sin dependencias npm: solo fetch/fs nativos de Node 25.

   Uso:  node tools/build-map.mjs
   Cachea los GeoJSON crudos en tools/cache/ y genera:
     - js/data/map-data.js        (MAP: bounds, provinces, neighbors, straits)
     - js/data/countries-data.js  (COUNTRIES)

   Decisiones clave (ver docs/DATA-NOTES.md):
   - Solo América (ISO3 de la lista); anillos con bbox al este de lon -25 se
     descartan (Europa/África); latitudes hasta 84 (Groenlandia incluida).
   - Granularidad resumida estilo CoN: países grandes conservan sus admin-1
     (fusionadas hasta el objetivo por país, TARGET_PROV); países pequeños/
     insulares = 1 provincia (polígono admin-0).
   - FUSIONES SIN PÉRDIDA DE TERRITORIO: polygon es un ARRAY DE ANILLOS
     [[[lon,lat],…], …]; la provincia fusionada conserva TODOS los anillos de
     sus piezas (solo se descartan islotes diminutos, se anotan).
   - Simplificación Douglas-Peucker por anillo (anclada al vértice más lejano,
     para anillos cerrados), redondeo a 2 decimales, tope de vértices según
     área del anillo (120 / 240 / 400).
   - VECINOS: distancia mínima segmento-a-segmento entre anillos con prefilto
     por bounding box (tolerancia 0.3°, entre provincias de CUALQUIER país).
     Verificación: el grafo neighbors+straits debe tener UNA sola componente.
   - Aserciones de terreno obligatorias (fallan el build si no se cumplen).
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CACHE = path.join(HERE, 'cache');
const OUT_DIR = path.join(ROOT, 'js', 'data');

const URL_ADMIN1 =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';
const URL_ADMIN0 =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';

/* ============================== CONFIGURACIÓN ============================= */

// Países jugables: nombre en español, color, agresión fija (opcional),
// single = 1 provincia con el polígono admin-0.
const COUNTRY_CFG = {
  USA: { name: 'Estados Unidos', color: '#3f6fb5', aggression: 0.6 },
  CAN: { name: 'Canadá', color: '#b04a3a' },
  MEX: { name: 'México', color: '#3f8f5f', aggression: 0.35 },
  GTM: { name: 'Guatemala', color: '#b5651d' },
  BLZ: { name: 'Belice', color: '#5a8a8a', single: true },
  HND: { name: 'Honduras', color: '#7a5aa0' },
  SLV: { name: 'El Salvador', color: '#c0c090', single: true },
  NIC: { name: 'Nicaragua', color: '#2a8a7a' },
  CRI: { name: 'Costa Rica', color: '#d07850' },
  PAN: { name: 'Panamá', color: '#8a7a40' },
  CUB: { name: 'Cuba', color: '#c25a7a', aggression: 0.6, single: true },
  DOM: { name: 'República Dominicana', color: '#b5442a', single: true },
  HTI: { name: 'Haití', color: '#4a4a8a', single: true },
  JAM: { name: 'Jamaica', color: '#5a9a3a', single: true },
  BHS: { name: 'Bahamas', color: '#35a0b0', single: true },
  TTO: { name: 'Trinidad y Tobago', color: '#7a9a30', single: true },
  GRL: { name: 'Groenlandia', color: '#c8d0e0' },
  COL: { name: 'Colombia', color: '#e0c040' },
  VEN: { name: 'Venezuela', color: '#a04040', aggression: 0.7 },
  GUY: { name: 'Guyana', color: '#3a8a5a', single: true },
  SUR: { name: 'Surinam', color: '#6a4a8a', single: true },
  ECU: { name: 'Ecuador', color: '#d0a030' },
  PER: { name: 'Perú', color: '#c96a4a' },
  BRA: { name: 'Brasil', color: '#d9b036', aggression: 0.45 },
  BOL: { name: 'Bolivia', color: '#c0c050' },
  PRY: { name: 'Paraguay', color: '#a05050', single: true },
  CHL: { name: 'Chile', color: '#b06a9a' },
  ARG: { name: 'Argentina', color: '#6aa8d8' },
  URY: { name: 'Uruguay', color: '#7090c0', single: true },
};

// ISO3 del dataset -> país jugable. PRI (Puerto Rico) son provincias de USA.
const ADM0_ALIAS = { PRI: 'USA' };

// Objetivo de provincias por país (granularidad resumida estilo CoN).
// Los no listados con admin-1 quedan tal cual (GRL 6). Países "single" = 1.
const TARGET_PROV = {
  USA: 30, CAN: 13, MEX: 30, BRA: 27, ARG: 24, COL: 30, VEN: 25, PER: 26,
  CHL: 16, BOL: 9, GRL: 6, ECU: 5, GTM: 4, NIC: 4, HND: 3, CRI: 3, PAN: 3,
};

// Provincias que nunca son absorbidas en fusiones (además de las capitales).
const MERGE_PROTECTED = {
  USA: ['district of columbia', 'puerto rico'], // capital + estrecho DOM<->PR
  COL: ['bogota'], // capital
  ECU: ['galapagos'], // isla propia enlazada por estrecho
};

// Población real aproximada por país (para la corrección del <20%).
const REAL_POP = {
  USA: 335_000_000, BRA: 216_000_000, MEX: 129_000_000, COL: 52_000_000,
  ARG: 46_000_000, CAN: 40_000_000, PER: 34_000_000, VEN: 28_000_000,
  CHL: 20_000_000, ECU: 18_000_000, GTM: 18_000_000, BOL: 12_000_000,
  HTI: 12_000_000, DOM: 11_000_000, CUB: 11_000_000, HND: 10_600_000,
  PRY: 7_000_000, NIC: 7_000_000, URY: 3_500_000, SLV: 6_300_000,
  CRI: 5_200_000, PAN: 4_500_000, JAM: 2_800_000, TTO: 1_500_000,
  GUY: 820_000, SUR: 620_000, BLZ: 410_000, BHS: 410_000, GRL: 57_000,
};

// Coordenadas de las capitales [lat, lon] (para point-in-polygon).
const CAPITAL_COORDS = {
  USA: [38.895, -77.036], CAN: [45.421, -75.697], MEX: [19.433, -99.133],
  GTM: [14.628, -90.523], BLZ: [17.251, -88.759], HND: [14.072, -87.192],
  SLV: [13.699, -89.191], NIC: [12.115, -86.236], CRI: [9.928, -84.091],
  PAN: [8.983, -79.519], CUB: [23.113, -82.366], DOM: [18.486, -69.931],
  HTI: [18.545, -72.337], JAM: [17.971, -76.789], BHS: [25.048, -77.350],
  TTO: [10.655, -61.509], GRL: [64.184, -51.722], COL: [4.711, -74.072],
  VEN: [10.491, -66.878], GUY: [6.802, -58.155], SUR: [5.852, -55.204],
  ECU: [-0.180, -78.468], PER: [-12.046, -77.043], BRA: [-15.794, -47.882],
  BOL: [-16.496, -68.133], PRY: [-25.264, -57.576], CHL: [-33.449, -70.669],
  ARG: [-34.604, -58.382], URY: [-34.902, -56.164],
};

// Pistas de nombre (normalizadas) para resolver la capital por nombre.
const CAPITAL_HINTS = {
  USA: 'district of columbia', CAN: 'ontario', MEX: 'distrito federal',
  GTM: 'guatemala', HND: 'francisco morazan', NIC: 'managua',
  CRI: 'san jose', PAN: 'panama', GRL: 'sermersooq', COL: 'bogota',
  VEN: 'distrito capital', ECU: 'pichincha', PER: 'lima province',
  BRA: 'distrito federal', BOL: 'la paz', CHL: 'region metropolitana de santiago',
  ARG: 'ciudad de buenos aires',
};

/*
  Población real por unidad admin-1 (censos/estimaciones ~2022-2024).
  Natural Earth NO trae población en admin-1; la incorporamos aquí
  (clave = nombre NE normalizado). Lo que falte cae al fallback (300k) y
  luego se escala por país si suma <20% de REAL_POP.
*/
const POP_ADMIN1 = {
  USA: {
    alabama: 5108468, alaska: 733406, arizona: 7431344, arkansas: 3067732,
    california: 38965193, colorado: 5877610, connecticut: 3617176,
    delaware: 1031890, 'district of columbia': 678972, florida: 22610726,
    georgia: 11029227, hawaii: 1435138, idaho: 1964007, illinois: 12549689,
    indiana: 6862199, iowa: 3207004, kansas: 2940546, kentucky: 4526654,
    louisiana: 4573749, maine: 1395427, maryland: 6181254,
    massachusetts: 7001399, michigan: 10037261, minnesota: 5737915,
    mississippi: 2939690, missouri: 6196439, montana: 1143121,
    nebraska: 1983431, nevada: 3194176, 'new hampshire': 1402554,
    'new jersey': 9290841, 'new mexico': 2114371, 'new york': 19571216,
    'north carolina': 10835491, 'north dakota': 783926, ohio: 11785935,
    oklahoma: 4053824, oregon: 4233358, pennsylvania: 12961168,
    'rhode island': 1114745, 'south carolina': 5373246, 'south dakota': 924669,
    tennessee: 7126489, texas: 30503301, utah: 3417734, vermont: 647464,
    virginia: 8715101, washington: 7812880, 'west virginia': 1770015,
    wisconsin: 5910955, wyoming: 584057, 'puerto rico': 3193694,
  },
  CAN: {
    ontario: 15989000, quebec: 9031000, 'british columbia': 5827000,
    alberta: 4956000, manitoba: 1474000, saskatchewan: 1282000,
    'nova scotia': 1081000, 'new brunswick': 875000,
    'newfoundland and labrador': 546000, 'prince edward island': 179000,
    'northwest territories': 44870, yukon: 46600, nunavut: 41220,
  },
  MEX: {
    sonora: 3066000, 'baja california': 3973000, chihuahua: 3801000,
    coahuila: 3267000, tamaulipas: 3574000, 'nuevo leon': 5984000,
    'quintana roo': 1993000, campeche: 990000, tabasco: 2575000,
    chiapas: 5694000, colima: 774000, nayarit: 1283000,
    'baja california sur': 870000, sinaloa: 3197000, yucatan: 2407000,
    veracruz: 8349000, jalisco: 9072000, michoacan: 4923000,
    guerrero: 3926000, oaxaca: 4184000, mexico: 17929000, puebla: 6781000,
    morelos: 2062000, queretaro: 2563000, hidalgo: 3281000,
    guanajuato: 6365000, 'san luis potosi': 3099000, zacatecas: 1672000,
    aguascalientes: 1483000, durango: 1905000, tlaxcala: 1453000,
    'distrito federal': 9209944,
  },
  GTM: {
    jutiapa: 545000, chiquimula: 411000, peten: 1130000, 'san marcos': 1112000,
    huehuetenango: 1356000, quiche: 1161000, 'alta verapaz': 1526000,
    izabal: 544000, zacapa: 272000, retalhuleu: 355000,
    suchitepequez: 594000, escuintla: 882000, 'santa rosa': 400000,
    chimaltenango: 694000, sacatepequez: 379000, guatemala: 3848000,
    jalapa: 383000, 'el progreso': 199000, solola: 503000,
    quezaltenango: 891000, 'baja verapaz': 338000, totonicapan: 478000,
  },
  HND: {
    ocotepeque: 165000, lempira: 357000, intibuca: 266000, 'la paz': 219000,
    valle: 204000, olancho: 592000, 'gracias a dios': 110000,
    'el paraiso': 502000, choluteca: 491000, cortes: 1926000,
    'santa barbara': 468000, copan: 421000, colon: 373000,
    atlantida: 484000, 'islas de la bahia': 68000, comayagua: 596000,
    yoro: 663000, 'francisco morazan': 1665000,
  },
  NIC: {
    'rio san juan': 163000, 'atlantico norte': 530000, jinotega: 520000,
    'nueva segovia': 283000, chinandega: 465000, madriz: 183000,
    rivas: 209000, 'atlantico sur': 470000, leon: 440000, managua: 1650000,
    carazo: 210000, matagalpa: 635000, boaco: 200000, chontales: 207000,
    esteli: 252000, granada: 142000, masaya: 420000,
  },
  CRI: {
    alajuela: 1043000, guanacaste: 425000, limon: 464000, puntarenas: 472000,
    heredia: 516000, 'san jose': 1531000, cartago: 562000,
  },
  PAN: {
    'bocas del toro': 199000, chiriqui: 622000, 'kuna yala': 69000,
    embera: 14000, darien: 130000, panama: 2018000, cocle: 298000,
    veraguas: 260000, colon: 310000, 'ngobe bugle': 225000,
    'los santos': 108000, herrera: 128000,
  },
  COL: {
    narino: 1654540, putumayo: 384446, choco: 562781, guainia: 52616,
    vaupes: 47140, amazonas: 88519, 'la guajira': 963939, cesar: 1274952,
    'norte de santander': 1507283, arauca: 301060, boyaca: 1273278,
    vichada: 119398, cauca: 1474312, 'valle del cauca': 4574804,
    antioquia: 7037308, cordoba: 1894193, sucre: 953974, bolivar: 2314896,
    atlantico: 2915185, magdalena: 1429282, 'san andres y providencia': 68646,
    caqueta: 503709, huila: 1188335, guaviare: 98765, caldas: 998255,
    casanare: 452614, meta: 1169121, bogota: 7835863, santander: 2262045,
    tolima: 1394146, quindio: 522419, cundinamarca: 3518895, risaralda: 984868,
  },
  VEN: {
    'delta amacuro': 215000, bolivar: 2185000, amazonas: 218000, zulia: 4578000,
    tachira: 1392000, apure: 575000, merida: 1013000, trujillo: 862000,
    falcon: 1145000, yaracuy: 735000, carabobo: 2615000, aragua: 1985000,
    vargas: 425000, miranda: 3663000, anzoategui: 1785000, sucre: 988000,
    monagas: 1056000, 'nueva esparta': 575000,
    'dependencias federales': 3000, guarico: 901000, cojedes: 410000,
    'distrito capital': 2363000, barinas: 1015000, lara: 2213000,
    portuguesa: 1136000,
  },
  ECU: {
    esmeraldas: 635011, carchi: 194518, sucumbios: 208632, orellana: 190487,
    pastaza: 125204, 'morona santiago': 195428, 'zamora chinchipe': 132795,
    loja: 525174, 'el oro': 715356, guayas: 4531068, galapagos: 33042,
    'santa elena': 404937, manabi: 1578407, azuay: 881732, canar: 281396,
    napo: 143015, tungurahua: 604323, chimborazo: 536174, bolivar: 228525,
    imbabura: 478095, cotopaxi: 509878, 'los rios': 921269,
    pichincha: 3517317, 'santo domingo de los tsachilas': 523434,
  },
  PER: {
    tacna: 370699, 'madre de dios': 173811, loreto: 883510, amazonas: 426800,
    cajamarca: 1341012, tumbes: 240744, piura: 2047954, ucayali: 589110,
    puno: 1178476, moquegua: 192740, arequipa: 1559221, ica: 911857,
    lima: 364000, 'lima province': 9485405, callao: 1129549, ancash: 1145511,
    'la libertad': 2016621, lambayeque: 1274459, cusco: 1357075,
    ayacucho: 616176, apurimac: 405761, huancavelica: 347280,
    'san martin': 892370, huanuco: 760267, pasco: 271904, junin: 1246038,
  },
  BRA: {
    'rio grande do sul': 10694000, roraima: 636000, para: 7266000,
    acre: 730000, amapa: 734000, 'mato grosso do sul': 2746000,
    parana: 11434000, 'santa catarina': 7609000, amazonas: 3642000,
    rondonia: 1581000, 'mato grosso': 3635000, maranhao: 6800000,
    piaui: 3265000, ceara: 8792000, 'rio grande do norte': 3315000,
    paraiba: 3908000, pernambuco: 9051000, alagoas: 3035000, sergipe: 2209000,
    bahia: 14136000, 'espirito santo': 3834000, 'rio de janeiro': 16055000,
    'sao paulo': 44420000, goias: 7065000, 'distrito federal': 2817000,
    'minas gerais': 20320000, tocantins: 1479000,
  },
  BOL: {
    'la paz': 3216000, oruro: 586000, potosi: 930000, tarija: 577000,
    'santa cruz': 3815000, chuquisaca: 677000, pando: 137000,
    'el beni': 489000, cochabamba: 2285000,
  },
  CHL: {
    'arica y parinacota': 252725, tarapaca: 382000, antofagasta: 707000,
    atacama: 310000, coquimbo: 870000,
    'region metropolitana de santiago': 8520000, valparaiso: 1035000,
    maule: 1138000, 'libertador general bernardo o higgins': 1005000,
    nuble: 510000, 'la araucania': 1035000, 'bio bio': 1682000,
    'los rios': 419000, 'los lagos': 921000,
    'aisen del general carlos ibanez del campo': 111000,
    'magallanes y antartica chilena': 172000,
  },
  ARG: {
    'entre rios': 1426426, salta: 1441131, jujuy: 797955, formosa: 606041,
    misiones: 1282936, chaco: 1142883, corrientes: 1214441, catamarca: 429556,
    'la rioja': 384607, 'san juan': 818234, mendoza: 2010628, neuquen: 726590,
    chubut: 603120, 'rio negro': 762067, 'santa cruz': 333473,
    'tierra del fuego': 190641, 'buenos aires': 17594428,
    'ciudad de buenos aires': 3120612, 'santa fe': 3556522, tucuman: 1738479,
    'santiago del estero': 1059496, 'san luis': 540905, 'la pampa': 366022,
    cordoba: 3928644,
  },
  GRL: {
    'kommuneqarfik sermersooq': 24300, nationalparken: 35,
    'qaasuitsup kommunia': 17400, pituffik: 200, 'qeqqata kommunia': 9400,
    'kommune kujalleq': 5700,
  },
};

/* ======================= TERRENO (cajas [lonMin, lonMax, latMin, latMax]) ==== */

const MOUNTAINS = [
  [-116, -104, 36, 60],   // Rocosas (recortada: no tapa los desiertos del SW)
  [-108, -103, 16, 30],   // Sierra Madre Occidental (Chihuahua/Durango/Sinaloa)
  [-77.6, -73.8, 1.3, 8.2], // Andes de Colombia occidental (Antioquia, Bogotá, Huila)
  [-74.5, -72.5, 5.5, 8],   // Cordillera Oriental de Colombia (Boyacá, Santanderes)
  [-72.5, -70.5, 7.5, 9.2], // Andes venezolanos (Mérida, Táchira)
  [-75, -71, -48, -40],   // Andes patagónicos
  [-155, -140, 60, 70],   // Alaska
  [-74, -72.5, 10, 11.5], // Sierra Nevada de Santa Marta
  [-84, -82.5, 8.5, 9.8], // Cordillera Talamanca
  [-63, -57.5, 2, 6],     // Escudo Guayanés (Roraima, Guyana)
  [-69.5, -64, -34, -24], // Sierras Pampeanas + Mendoza/San Juan andinos
];
const DESERTS = [
  [-118, -107, 26, 42],   // Sonora / Mojave / Gran Cuenca (Arizona, Nevada)
  [-106, -100.2, 24, 32], // Chihuahua (excluye a Texas, que es llanura)
  [-115, -109, 22, 32],   // Baja California
  [-71, -67, -28, -17],   // Atacama
  [-63, -58, -30, -22],   // Gran Chaco seco
  [-78, -76, -18, -6],    // desierto costero peruano
];
const JUNGLES = [
  [-79, -47, -13, 6],     // Amazonia
  [-92, -78, 6, 18],      // Centroamérica tropical
  [-85, -60, 15, 25],     // Caribe insular
  [-78, -76.2, 2, 9],     // Chocó colombiano
  [-91, -86.5, 17.5, 21.8], // Yucatán
];
const FORESTS = [
  [-180, 180, 48, 55],    // boreal canadiense
  [-86, -75, 33, 43],     // Apalaches
  [-125, -117, 40, 50],   // costa NO de EEUU
  [-75, -71, -46, -36],   // sur de Chile (Valdivia/Chiloé/Nahuelbuta)
  [-50, -38, -30, -16],   // Mata Atlántica
];
// tundra: lat > 55 (Canadá/Alaska/Groenlandia) o lat < -48 (Patagonia austral)

/* Zonas petroleras para fuel (mismo formato [lonMin, lonMax, latMin, latMax]) */
const OIL_ZONES = [
  [-102, -88, 26, 36],    // Texas / Golfo de México (EEUU)
  [-160, -146, 68, 71],   // Alaska Norte
  [-118, -108, 52, 60],   // Alberta
  [-98, -90, 17, 22],     // Golfo de México costero mexicano
  [-72, -60, 8, 12],      // Venezuela Maracaibo / oriente
  [-74, -68, 3, 7],       // Colombia, Llanos
  [-77, -75, -2, 1],      // Ecuador Oriente
  [-81, -78, -8, -2],     // Perú norte
  [-48, -38, -26, -20],   // Brasil offshore Santos/Campos
  [-67, -62, -22, -18],   // Bolivia sur
];

// Aserciones obligatorias de terreno (falla el build si no se cumplen).
const TERRAIN_ASSERTIONS = [
  ['USA', 'arizona', 'desierto'],
  ['USA', 'kansas', 'llanura'],
  ['USA', 'texas', 'llanura'],
  ['USA', 'colorado', 'montaña'],
  ['USA', 'california', 'urbano'],
  ['USA', 'new york', 'urbano'],
  ['USA', 'nevada', 'desierto'],
  ['USA', 'puerto rico', 'selva'],
  ['CAN', 'ontario', 'bosque'],
  ['CAN', 'yukon', 'tundra'],
  ['BRA', 'para', 'selva'],
  ['BRA', 'amazonas', 'selva'],
  ['COL', 'antioquia', 'montaña'],
  ['CHL', 'atacama', 'desierto'],
  ['ARG', 'tierra del fuego', 'tundra'],
];

// Fronteras terrestres que DEBEN existir en el grafo (garantía de jugabilidad).
const EXPECTED_LAND_BORDERS = [
  ['USA', 'CAN'], ['USA', 'MEX'], ['MEX', 'GTM'], ['GTM', 'BLZ'],
  ['GTM', 'HND'], ['GTM', 'SLV'], ['HND', 'NIC'], ['NIC', 'CRI'],
  ['CRI', 'PAN'], ['PAN', 'COL'], ['COL', 'VEN'], ['COL', 'ECU'],
  ['COL', 'PER'], ['COL', 'BRA'], ['VEN', 'BRA'], ['VEN', 'GUY'],
  ['GUY', 'SUR'], ['GUY', 'BRA'], ['SUR', 'BRA'], ['ECU', 'PER'],
  ['PER', 'BRA'], ['PER', 'BOL'], ['PER', 'CHL'], ['BRA', 'BOL'],
  ['BRA', 'PRY'], ['BRA', 'ARG'], ['BRA', 'URY'], ['BOL', 'ARG'],
  ['BOL', 'CHL'], ['BOL', 'PRY'], ['PRY', 'ARG'], ['ARG', 'CHL'],
  ['ARG', 'URY'], ['HTI', 'DOM'],
];

/* ============================== UTILIDADES ================================ */

const log = (...a) => console.log(...a);
const notes = {
  merges: [], artificial: [], capitals: [], scaled: [], dropped: [],
  warnings: [], terrainFixes: [], islets: [],
};

const normName = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => normName(s).replace(/\s+/g, '-');

function signedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
const ringArea = (ring) => Math.abs(signedArea(ring));

// Área aproximada en km² (grados² corregidos por latitud media del anillo).
function ringAreaKm2(ring) {
  const bb = ringBbox(ring);
  const cosLat = Math.max(0.05, Math.cos((((bb.minLat + bb.maxLat) / 2) * Math.PI) / 180));
  return ringArea(ring) * 111.32 * 111.32 * cosLat;
}

function ringBbox(ring) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [x, y] of ring) {
    if (x < minLon) minLon = x; if (x > maxLon) maxLon = x;
    if (y < minLat) minLat = y; if (y > maxLat) maxLat = y;
  }
  return { minLon, maxLon, minLat, maxLat };
}
const bboxOverlap = (a, b, pad = 0) =>
  a.minLon - pad <= b.maxLon && a.maxLon + pad >= b.minLon &&
  a.minLat - pad <= b.maxLat && a.maxLat + pad >= b.minLat;

// Centroide del anillo (poligonal). Devuelve { lon, lat } (¡orden explícito!).
function ringCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    const cross = p[0] * q[1] - q[0] * p[1];
    a += cross; cx += (p[0] + q[0]) * cross; cy += (p[1] + q[1]) * cross;
  }
  if (Math.abs(a) < 1e-12) {
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x; sy += y; }
    return { lon: sx / ring.length, lat: sy / ring.length };
  }
  return { lon: cx / (3 * a), lat: cy / (3 * a) };
}

function ringsCentroid(rings) {
  // ponderado por área: usa el anillo mayor
  let best = null, ba = -1;
  for (const r of rings) { const a = ringArea(r); if (a > ba) { ba = a; best = r; } }
  return ringCentroid(best);
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inBox(lon, lat, boxes) {
  for (const [lo1, lo2, la1, la2] of boxes)
    if (lon >= lo1 && lon <= lo2 && lat >= la1 && lat <= la2) return true;
  return false;
}

/* Distancia² entre dos segmentos 2D (0 si se cruzan). */
function segSegDist2(a1, a2, b1, b2) {
  const d1x = a2[0] - a1[0], d1y = a2[1] - a1[1];
  const d2x = b2[0] - b1[0], d2y = b2[1] - b1[1];
  const rx = a1[0] - b1[0], ry = a1[1] - b1[1];
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;
  let s, t;
  if (a <= 1e-24 && e <= 1e-24) { s = 0; t = 0; }
  else if (a <= 1e-24) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = d1x * rx + d1y * ry;
    if (e <= 1e-24) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = d1x * d2x + d1y * d2y;
      const denom = a * e - b * b;
      s = denom !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  const dx = a1[0] + s * d1x - (b1[0] + t * d2x);
  const dy = a1[1] + s * d1y - (b1[1] + t * d2y);
  return dx * dx + dy * dy;
}

/*
  Distancia² mínima entre los anillos de dos provincias (solo segmentos dentro
  de la intersección de bboxes expandidos cutoff). Salida temprana si < cutoff².
  exact=true: sin salida temprana (mínimo real; cutoff actúa solo como radio
  de búsqueda, debe superar holgadamente la distancia esperada).
*/
function ringsPairDist2(provA, provB, cutoff, exact = false) {
  const bbA = provA.bbox, bbB = provB.bbox;
  if (!bboxOverlap(bbA, bbB, cutoff)) return Infinity;
  const clip = {
    minLon: Math.max(bbA.minLon, bbB.minLon) - cutoff,
    maxLon: Math.min(bbA.maxLon, bbB.maxLon) + cutoff,
    minLat: Math.max(bbA.minLat, bbB.minLat) - cutoff,
    maxLat: Math.min(bbA.maxLat, bbB.maxLat) + cutoff,
  };
  const segsA = collectSegs(provA, clip);
  const segsB = collectSegs(provB, clip);
  if (!segsA.length || !segsB.length) return Infinity;
  // hash del lado más pequeño
  const [hash, probe] = segsA.length <= segsB.length ? [segsA, segsB] : [segsB, segsA];
  const grid = new Map();
  const CS = 1; // celdas de 1°
  for (const s of hash) {
    const x0 = Math.floor(Math.min(s[0][0], s[1][0]) / CS);
    const x1 = Math.floor(Math.max(s[0][0], s[1][0]) / CS);
    const y0 = Math.floor(Math.min(s[0][1], s[1][1]) / CS);
    const y1 = Math.floor(Math.max(s[0][1], s[1][1]) / CS);
    for (let gx = x0; gx <= x1; gx++)
      for (let gy = y0; gy <= y1; gy++) {
        const k = gx + ':' + gy;
        let arr = grid.get(k);
        if (!arr) { arr = []; grid.set(k, arr); }
        arr.push(s);
      }
  }
  const cut2 = cutoff * cutoff;
  let min2 = Infinity;
  for (const s of probe) {
    const x0 = Math.floor((Math.min(s[0][0], s[1][0]) - cutoff) / CS);
    const x1 = Math.floor((Math.max(s[0][0], s[1][0]) + cutoff) / CS);
    const y0 = Math.floor((Math.min(s[0][1], s[1][1]) - cutoff) / CS);
    const y1 = Math.floor((Math.max(s[0][1], s[1][1]) + cutoff) / CS);
    for (let gx = x0; gx <= x1; gx++)
      for (let gy = y0; gy <= y1; gy++) {
        const arr = grid.get(gx + ':' + gy);
        if (!arr) continue;
        for (const t of arr) {
          const d2 = segSegDist2(s[0], s[1], t[0], t[1]);
          if (d2 < min2) {
            min2 = d2;
            if (!exact && min2 < cut2) return min2; // salida temprana
          }
        }
      }
  }
  return min2;
}

function collectSegs(prov, clip) {
  const out = [];
  for (let ri = 0; ri < prov.rings.length; ri++) {
    const bb = prov.ringBboxes[ri];
    if (bb.maxLon < clip.minLon || bb.minLon > clip.maxLon ||
        bb.maxLat < clip.minLat || bb.minLat > clip.maxLat) continue;
    const r = prov.rings[ri];
    for (let i = 0; i + 1 < r.length; i++) out.push([r[i], r[i + 1]]);
  }
  return out;
}

function provBbox(rings) {
  const bbs = rings.map(ringBbox);
  const all = {
    minLon: Math.min(...bbs.map((b) => b.minLon)),
    maxLon: Math.max(...bbs.map((b) => b.maxLon)),
    minLat: Math.min(...bbs.map((b) => b.minLat)),
    maxLat: Math.max(...bbs.map((b) => b.maxLat)),
  };
  return { bbox: all, ringBboxes: bbs };
}

/* Adyacencia por distancia entre polígonos (cualquier país). */
function computeAdjacency(list, cutoff = 0.3) {
  const pairs = new Set();
  const n = list.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d2 = ringsPairDist2(list[i], list[j], cutoff);
      if (d2 < cutoff * cutoff) pairs.add(i + '|' + j);
    }
  return pairs;
}

/* ======================= SIMPLIFICACIÓN (Douglas-Peucker) ================= */

function dpMark(pts, a, b, eps2, keep) {
  const stack = [[a, b]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (y <= x + 1) continue;
    const ax = pts[x][0], ay = pts[x][1];
    const dx = pts[y][0] - ax, dy = pts[y][1] - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1, idx = -1;
    for (let i = x + 1; i < y; i++) {
      const px = pts[i][0], py = pts[i][1];
      let d;
      if (len2 === 0) {
        const ex = px - ax, ey = py - ay; d = ex * ex + ey * ey;
      } else {
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - (ax + t * dx), ey = py - (ay + t * dy);
        d = ex * ex + ey * ey;
      }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps2) { keep[idx] = 1; stack.push([x, idx], [idx, y]); }
  }
}

// DP para anillo CERRADO: ancla en el vértice más lejano al primero y simplifica
// los dos arcos. (Evita el colapso a 2 puntos de la cuerda de cierre.)
function dpSimplifyRing(pts, eps) {
  const n = pts.length;
  if (n <= 3) return pts.slice();
  let k = 1, best = -1;
  for (let i = 1; i < n; i++) {
    const dx = pts[i][0] - pts[0][0], dy = pts[i][1] - pts[0][1];
    const d = dx * dx + dy * dy;
    if (d > best) { best = d; k = i; }
  }
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[k] = 1;
  // arco 1: 0..k
  dpMark(pts, 0, k, eps * eps, keep);
  // arco 2: k..n-1 y cierre hacia 0
  if (k < n - 1) {
    const arc = [];
    const idxMap = [];
    for (let i = k; i < n; i++) { arc.push(pts[i]); idxMap.push(i); }
    arc.push(pts[0]); idxMap.push(0);
    const keep2 = new Uint8Array(arc.length);
    keep2[0] = keep2[arc.length - 1] = 1;
    // vértice más lejano a la cuerda pk->p0 (garantiza >=3 puntos)
    const bx = arc[0][0], by = arc[0][1];
    const dx = arc[arc.length - 1][0] - bx, dy = arc[arc.length - 1][1] - by;
    const len2 = dx * dx + dy * dy;
    let mi = -1, md = -1;
    for (let i = 1; i < arc.length - 1; i++) {
      const px = arc[i][0], py = arc[i][1];
      let t = len2 > 0 ? ((px - bx) * dx + (py - by) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - (bx + t * dx), ey = py - (by + t * dy);
      const d = ex * ex + ey * ey;
      if (d > md) { md = d; mi = i; }
    }
    if (mi > 0) keep2[mi] = 1;
    dpMark(arc, 0, arc.length - 1, eps * eps, keep2);
    for (let i = 0; i < arc.length; i++) if (keep2[i]) keep[idxMap[i]] = 1;
  } else {
    // k == n-1: el anillo depende del arco 0..n-1 directamente
    dpMark(pts, 0, n - 1, eps * eps, keep);
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

function roundRing(open) {
  const out = [];
  for (const p of open) {
    const q = [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
    const last = out[out.length - 1];
    if (!out.length || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  while (out.length > 1) {
    const f = out[0], l = out[out.length - 1];
    if (f[0] === l[0] && f[1] === l[1]) out.pop(); else break;
  }
  if (out.length < 3) return null;
  out.push([out[0][0], out[0][1]]); // cerrar
  return out;
}

// Tope de vértices según área del anillo (los continentales gigantes permiten
// más detalle para no perder territorio).
function maxPtsForArea(areaDeg2) {
  if (areaDeg2 >= 25) return 400;
  if (areaDeg2 >= 5) return 240;
  return 120;
}

// Devuelve anillo cerrado, 2 decimales, <= maxPts vértices únicos.
function simplifyRing(ringRaw, maxPts = 120) {
  let open = ringRaw.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (open.length > 1) {
    const f = open[0], l = open[open.length - 1];
    if (f[0] === l[0] && f[1] === l[1]) open = open.slice(0, -1);
  }
  if (open.length < 3) return null;
  let ring = roundRing(open);
  if (ring && ring.length - 1 <= maxPts) return ring;
  const span = Math.max(
    ringBbox(open).maxLon - ringBbox(open).minLon,
    ringBbox(open).maxLat - ringBbox(open).minLat
  );
  let lo = 0.0005, hi = Math.max(0.02, Math.min(2.5, span)), best = null;
  for (let i = 0; i < 60 && hi - lo > 1e-6; i++) {
    const mid = (lo + hi) / 2;
    const s = roundRing(dpSimplifyRing(open, mid));
    if (s && s.length - 1 <= maxPts) { best = s; hi = mid; } else { lo = mid; }
  }
  if (!best) best = roundRing(dpSimplifyRing(open, hi));
  return best;
}

/* ============================ ANILLOS / PIEZAS ============================ */

// Filtra anillos: descarta los totalmente al este de lon -25 (Europa/África)
// o por encima de lat 84.5 (ártico absurdo).
function ringUsable(ring) {
  const bb = ringBbox(ring);
  if (bb.minLon > -25) return false;
  if (bb.maxLat > 84.5 || bb.minLat < -90) return false;
  if (bb.maxLon > 180 || bb.minLon < -180) return false;
  return true;
}

function* outerRings(geom) {
  if (!geom) return;
  if (geom.type === 'Polygon') { if (geom.coordinates?.[0]) yield geom.coordinates[0]; }
  else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) if (poly?.[0]) yield poly[0];
  }
}

/*
  Conserva TODOS los anillos relevantes de una geometría (sin pérdida de
  territorio): solo descarta islotes diminutos (área < umbral absoluto o
  proporción mínima del mayor), con tope de cantidad. Devuelve { rings, dropped }.
*/
const ISLET_MIN_DEG2 = 0.0006;   // ~7 km² en el ecuador
const ISLET_MIN_REL = 0.0002;    // 0.02% del anillo mayor
const RINGS_CAP = 80;

function keepRings(geom) {
  const all = [];
  for (const r of outerRings(geom)) {
    if (r.length < 4) continue;
    if (!ringUsable(r)) continue;
    all.push(r);
  }
  all.sort((a, b) => ringArea(b) - ringArea(a));
  if (!all.length) return { rings: [], dropped: 0, droppedArea: 0 };
  const minAbs = Math.max(ISLET_MIN_DEG2, ISLET_MIN_REL * ringArea(all[0]));
  const kept = [];
  let dropped = 0, droppedArea = 0;
  for (let i = 0; i < all.length; i++) {
    const a = ringArea(all[i]);
    if (i < RINGS_CAP && a >= minAbs) kept.push(all[i]);
    else { dropped++; droppedArea += a; }
  }
  return { rings: kept, dropped, droppedArea };
}

// Variante para fusiones: recibe un array de anillos ya extraídos.
function keepMergedRings(rings) {
  const all = [...rings].sort((a, b) => ringArea(b) - ringArea(a));
  if (!all.length) return [];
  const minAbs = Math.max(ISLET_MIN_DEG2, ISLET_MIN_REL * ringArea(all[0]));
  const kept = [];
  let dropped = 0;
  for (let i = 0; i < all.length; i++) {
    const a = ringArea(all[i]);
    if (i < RINGS_CAP && a >= minAbs) kept.push(all[i]);
    else dropped++;
  }
  if (dropped) notes.islets.push(`fusión: ${dropped} islote(s) diminuto(s) descartado(s)`);
  return kept;
}

/* ============================== DESCARGA ================================== */

async function ensureFile(url, file) {
  const fp = path.join(CACHE, file);
  if (fs.existsSync(fp) && fs.statSync(fp).size > 1_000_000) {
    log(`· cache ${file} (${(fs.statSync(fp).size / 1e6).toFixed(1)} MB)`);
    return fp;
  }
  fs.mkdirSync(CACHE, { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      log(`↓ descargando ${file} (intento ${attempt})…`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(fp, buf);
      log(`  ok (${(buf.length / 1e6).toFixed(1)} MB)`);
      return fp;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/* =============================== MAIN ===================================== */

const provs = [];
const byCountry = new Map();

function newProvince(country, name, rings, pop, extra = {}) {
  const p = {
    country, name, rings, pop,
    pieces: [[country, name]], // trazabilidad (país, nombre de pieza)
    absorbed: [], capitalPiece: false,
    ...provBbox(rings),
    ...extra,
  };
  p.idx = provs.length;
  provs.push(p);
  if (!byCountry.has(country)) byCountry.set(country, []);
  byCountry.get(country).push(p);
  return p;
}

function assignIds() {
  const used = new Map();
  for (const p of provs) {
    let id = `${p.country.toLowerCase()}-${slug(p.name) || 'sin-nombre'}`;
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
      notes.warnings.push(`id duplicado -> ${id} (${p.country} "${p.name}")`);
    }
    used.set(id, true);
    p.id = id;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fpA1 = await ensureFile(URL_ADMIN1, 'ne_10m_admin_1_states_provinces.geojson');
  const fpA0 = await ensureFile(URL_ADMIN0, 'ne_10m_admin_0_countries.geojson');

  /* ---- 1) admin-1: piezas de países multi-provincia ---- */
  log('· leyendo admin-1…');
  const a1 = JSON.parse(fs.readFileSync(fpA1, 'utf8'));
  const multiIso = new Set(
    Object.keys(COUNTRY_CFG).filter((k) => !COUNTRY_CFG[k].single)
  );
  const a1ByIso = new Map();
  for (const f of a1.features) {
    const props = f.properties || {};
    let iso = props.adm0_a3 || props.gu_a3 || null;
    if (iso && ADM0_ALIAS[iso]) iso = ADM0_ALIAS[iso];
    if (!iso || !multiIso.has(iso)) continue;
    if (props.adm1_code && String(props.adm1_code).includes('+99')) {
      notes.dropped.push(`${iso}: feature sin resolver "${props.adm1_code}" (islote oceánico sin población) descartada`);
      continue;
    }
    if (!a1ByIso.has(iso)) a1ByIso.set(iso, []);
    a1ByIso.get(iso).push(f);
  }
  a1.features.length = 0; // liberar memoria

  for (const iso of multiIso) {
    const feats = a1ByIso.get(iso) || [];
    if (feats.length < 2) {
      COUNTRY_CFG[iso].single = true;
      notes.warnings.push(`${iso}: sin admin-1 útil en NE; se tratará como 1 provincia (admin-0)`);
      continue;
    }
    for (const f of feats) {
      const props = f.properties;
      const name = (props.name || '').trim() || props.name_en || props.admin || iso;
      const kr = keepRings(f.geometry);
      if (!kr.rings.length) { notes.dropped.push(`${iso}: "${name}" sin anillos útiles`); continue; }
      if (kr.dropped) notes.islets.push(`${iso}/${name}: ${kr.dropped} islote(s) descartado(s)`);
      let pop = 0;
      const table = POP_ADMIN1[iso] || {};
      const nn = normName(name);
      if (table[nn]) pop = table[nn];
      if (!pop || pop <= 0) {
        notes.warnings.push(`${iso}: sin población en tabla para "${name}" -> fallback 300000`);
        pop = 300000;
      }
      newProvince(iso, name, kr.rings, pop);
    }
  }

  /* ---- 2) admin-0: países de una sola provincia (y fallbacks) ---- */
  log('· leyendo admin-0…');
  const a0 = JSON.parse(fs.readFileSync(fpA0, 'utf8'));
  const singleIso = Object.keys(COUNTRY_CFG).filter(
    (iso) => COUNTRY_CFG[iso].single || !byCountry.has(iso)
  );
  for (const iso of singleIso) {
    if (byCountry.has(iso)) continue; // ya tiene admin-1
    const f = a0.features.find(
      (x) => x.properties.ADM0_A3 === iso || x.properties.ISO_A3 === iso
    );
    if (!f) {
      notes.warnings.push(`${iso}: NO encontrado en admin-0`);
      COUNTRY_CFG[iso].missing = true;
      continue;
    }
    const props = f.properties;
    const name = props.NAME_ES || props.NAME || props.ADMIN || iso;
    const kr = keepRings(f.geometry);
    if (!kr.rings.length) { notes.warnings.push(`${iso}: sin anillos útiles en admin-0`); COUNTRY_CFG[iso].missing = true; continue; }
    if (kr.dropped) notes.islets.push(`${iso}: ${kr.dropped} islote(s) descartado(s)`);
    let pop = Number(props.POP_EST) || 0;
    if (pop <= 0) { notes.warnings.push(`${iso}: POP_EST=0 -> fallback 300000`); pop = 300000; }
    newProvince(iso, name, kr.rings, pop, { singleCountry: true });
  }
  a0.features.length = 0;

  for (const [, list] of byCountry) if (list.length === 1) list[0].singleCountry = true;
  for (const p of provs) p.c = ringsCentroid(p.rings); // centroide cacheado
  log(`· piezas iniciales: ${provs.length} en ${byCountry.size} países`);

  /* ---- 3) capitales (sobre piezas, para protegerlas) ---- */
  for (const [iso, list] of byCountry) {
    let cap = null, method = null;
    const hint = CAPITAL_HINTS[iso];
    if (list.length === 1) {
      cap = list[0]; method = 'país de 1 provincia';
    } else if (hint) {
      cap = list.find((p) => {
        const nn = normName(p.name);
        return nn === hint || nn.includes(hint) || hint.includes(nn);
      });
      if (cap) method = `nombre (${hint})`;
    }
    if (!cap && CAPITAL_COORDS[iso]) {
      const [cy, cx] = CAPITAL_COORDS[iso];
      cap = list.find((p) => p.rings.some((r) => pointInRing(cx, cy, r)));
      if (cap) method = 'point-in-polygon';
    }
    if (!cap) {
      cap = list.reduce((a, b) => (b.pop > a.pop ? b : a));
      method = 'fallback: provincia más poblada';
      notes.warnings.push(`${iso}: capital resuelta por fallback (${cap.name})`);
    }
    cap.capitalPiece = true;
    notes.capitals.push(`${iso} -> ${cap.name} [${method}]`);
  }

  /* ---- 4) fusiones hasta el objetivo por país (sin perder territorio) ---- */
  log('· adyacencia entre piezas (para fusionar)…');
  const pieceAdj = new Map(); // idx -> Set<idx>
  for (const [iso, list] of byCountry) {
    if (list.length <= (TARGET_PROV[iso] || 1)) continue;
    const pairs = computeAdjacency(list, 0.3);
    for (const k of pairs) {
      const [i, j] = k.split('|').map(Number);
      const a = list[i], b = list[j];
      if (!pieceAdj.has(a.idx)) pieceAdj.set(a.idx, new Set());
      if (!pieceAdj.has(b.idx)) pieceAdj.set(b.idx, new Set());
      pieceAdj.get(a.idx).add(b.idx);
      pieceAdj.get(b.idx).add(a.idx);
    }
  }

  for (const [iso, list] of byCountry) {
    const target = TARGET_PROV[iso] || list.length;
    let guard = 0;
    while (list.length > target && guard++ < 2000) {
      const protectedNames = new Set(MERGE_PROTECTED[iso] || []);
      const mergeable = list.filter(
        (p) => !p.capitalPiece && !protectedNames.has(normName(p.name))
      );
      if (!mergeable.length) break;
      // la más pequeña por área total
      mergeable.sort((a, b) => provArea(a) - provArea(b));
      const src = mergeable[0];
      const srcArea = provArea(src);
      // destino: vecina adyacente de mayor área, más cercana por centroide
      const adj = [...(pieceAdj.get(src.idx) || [])]
        .map((idx) => provs[idx])
        .filter((c) => c && !c.dead && c !== src && list.includes(c));
      const near = (p, q) => (p.c.lon - q.c.lon) ** 2 + (p.c.lat - q.c.lat) ** 2;
      let dst = null;
      const biggerAdj = adj.filter((c) => provArea(c) > srcArea);
      if (biggerAdj.length) {
        biggerAdj.sort((a, b) => near(src, a) - near(src, b));
        dst = biggerAdj[0];
      } else {
        // sin vecina mayor (p.ej. isla): la más cercana de mayor área del país
        let bd = Infinity;
        for (const c of list) {
          if (c === src || provArea(c) <= srcArea) continue;
          const d = near(src, c);
          if (d < bd) { bd = d; dst = c; }
        }
        if (!dst && adj.length) {
          adj.sort((a, b) => provArea(b) - provArea(a));
          dst = adj[0];
        }
      }
      if (!dst) break;
      // UNIR piezas: conserva TODOS los anillos de ambas (re-filtrando islotes)
      const mergedRings = keepMergedRings([...dst.rings, ...src.rings]);
      dst.rings = mergedRings;
      Object.assign(dst, provBbox(dst.rings));
      dst.c = ringsCentroid(dst.rings);
      dst.pop += src.pop;
      dst.pieces.push(...src.pieces);
      dst.absorbed.push(src.name, ...src.absorbed);
      // adyacencia de la fusión
      const sadj = pieceAdj.get(src.idx) || new Set();
      if (!pieceAdj.has(dst.idx)) pieceAdj.set(dst.idx, new Set());
      for (const other of sadj) {
        if (other === dst.idx || other === src.idx) continue;
        pieceAdj.get(dst.idx).add(other);
        pieceAdj.get(other)?.add(dst.idx);
      }
      pieceAdj.get(dst.idx)?.delete(src.idx);
      src.dead = true;
      list.splice(list.indexOf(src), 1);
      notes.merges.push(
        `${iso}: "${src.name}" absorbida por "${dst.name}" (${dst.absorbed.length + 1} piezas ahora)`
      );
    }
  }
  // eliminar piezas absorbidas y reindexar (los índices de adyacencia
  // permanecieron válidos durante las fusiones: no se hizo splice de provs)
  for (let i = provs.length - 1; i >= 0; i--) if (provs[i].dead) provs.splice(i, 1);
  provs.forEach((p, i) => (p.idx = i));
  for (const p of provs) {
    if (p.pieces.length > 1) {
      const table = POP_ADMIN1[p.country] || {};
      let bestName = p.name, bestPop = -1;
      for (const [, pieceName] of p.pieces) {
        const pop = table[normName(pieceName)] || 0;
        if (pop > bestPop) { bestPop = pop; bestName = pieceName; }
      }
      if (bestName !== p.name) {
        notes.merges.push(`${p.country}: región "${p.name}+…" renombrada a "${bestName}" (pieza más poblada)`);
        p.name = bestName;
      }
    }
  }

  function provArea(p) {
    let a = 0;
    for (const r of p.rings) a += ringArea(r);
    return a;
  }

  /* ---- 5) ids únicos ---- */
  assignIds();

  /* ---- 6) corrección de población por país (<20% del real) ---- */
  for (const [iso, list] of byCountry) {
    const real = REAL_POP[iso];
    if (!real) continue;
    const sum = list.reduce((a, p) => a + p.pop, 0);
    if (sum < real * 0.2) {
      const factor = real / sum;
      for (const p of list) p.pop = Math.round(p.pop * factor);
      notes.scaled.push(
        `${iso}: suma ${Math.round(sum / 1e6)}M < 20% de ${Math.round(real / 1e6)}M -> escalado x${factor.toFixed(2)}`
      );
    }
  }

  /* ---- 7) terreno, producción, VP ---- */
  const areaKm2 = (p) => p.rings.reduce((a, r) => a + ringAreaKm2(r), 0);
  const terrainOf = (p) => {
    const c = ringsCentroid(p.rings); // { lon, lat }
    const density = p.pop / Math.max(1, areaKm2(p));
    if (p.pop > 8_000_000 && !p.singleCountry && density > 60) return 'urbano';
    if (inBox(c.lon, c.lat, MOUNTAINS)) return 'montaña';
    if (inBox(c.lon, c.lat, DESERTS)) return 'desierto';
    if (c.lat > 55 || c.lat < -48) return 'tundra';
    if (inBox(c.lon, c.lat, JUNGLES)) return 'selva';
    if (inBox(c.lon, c.lat, FORESTS)) return 'bosque';
    return 'llanura';
  };
  const fuelBonus = (p) => {
    if (p.country === 'TTO') return true; // Trinidad: toda la zona
    const c = ringsCentroid(p.rings);
    return inBox(c.lon, c.lat, OIL_ZONES);
  };
  for (const p of provs) {
    p.centroid = ringsCentroid(p.rings);
    p.terrain = terrainOf(p);
    const cap = p.capitalPiece ? 3 : 0;
    p.prod = {
      money: Math.round(p.pop / 20000),
      supplies: Math.round(p.pop / 100000) + cap,
      fuel: Math.round(0.2 + (fuelBonus(p) ? 8.0 : 0)),
      manpower: Math.round(p.pop / 40000),
    };
    p.vp = Math.max(1, Math.round(p.pop / 300000) + (p.capitalPiece ? 20 : 0));
  }

  // Aserciones de terreno (obligatorias): buscan por PIEZA, no por nombre de
  // región (p.ej. Kansas puede vivir dentro de la región "Oklahoma").
  const assertionErrors = [];
  for (const [iso, name, expected] of TERRAIN_ASSERTIONS) {
    const p = provs.find((x) =>
      x.country === iso && x.pieces.some(([, pn]) => normName(pn) === name)
    );
    if (!p) assertionErrors.push(`no existe provincia con pieza ${iso}:${name}`);
    else if (p.terrain !== expected)
      assertionErrors.push(`${iso}:${name} (región "${p.name}") = ${p.terrain}, esperado ${expected}`);
  }
  if (assertionErrors.length) {
    log('\nASERCIONES DE TERRENO FALLIDAS:');
    assertionErrors.forEach((e) => log('  ✗ ' + e));
    process.exitCode = 1;
  } else {
    log(`\nASERCIONES DE TERRENO: ${TERRAIN_ASSERTIONS.length}/${TERRAIN_ASSERTIONS.length} OK`);
  }

  /* ---- 8) salida: anillos simplificados ---- */
  const bounds = { minLon: 180, maxLon: -180, minLat: 90, maxLat: -90 };
  const provincesOut = [];
  const order = Object.keys(COUNTRY_CFG).filter((iso) => byCountry.has(iso));
  for (const iso of order) {
    const list = [...byCountry.get(iso)].sort((a, b) =>
      normName(a.name).localeCompare(normName(b.name))
    );
    for (const p of list) {
      const polygon = [];
      for (const raw of p.rings) {
        const ring = simplifyRing(raw, maxPtsForArea(ringArea(raw)));
        if (!ring) { notes.warnings.push(`${p.id}: anillo no simplificable (omitido ese anillo)`); continue; }
        polygon.push(ring);
        for (const [x, y] of ring) {
          if (x < bounds.minLon) bounds.minLon = x;
          if (x > bounds.maxLon) bounds.maxLon = x;
          if (y < bounds.minLat) bounds.minLat = y;
          if (y > bounds.maxLat) bounds.maxLat = y;
        }
      }
      if (!polygon.length) { notes.warnings.push(`${p.id}: sin anillos de salida`); continue; }
      p.outPolygon = polygon;
      provincesOut.push({
        id: p.id,
        country: p.country,
        name: p.name,
        polygon,
        terrain: p.terrain,
        pop: p.pop,
        capital: p.capitalPiece,
        prod: { money: p.prod.money, supplies: p.prod.supplies, fuel: p.prod.fuel, manpower: p.prod.manpower },
        vp: p.vp,
      });
    }
  }

  /* ---- 9) vecinos: distancia mínima entre polígonos (0.3°, cualquier país) ---- */
  log('· vecinos: distancia entre polígonos (0.3°)…');
  const neighborSet = computeAdjacency(provs, 0.3);
  log(`  pares vecinos: ${neighborSet.size}`);
  const neighborOut = {};
  for (const p of provincesOut) neighborOut[p.id] = [];
  for (const k of neighborSet) {
    const [a, b] = k.split('|').map(Number);
    const ia = provs[a].id, ib = provs[b].id;
    if (!neighborOut[ia] || !neighborOut[ib]) continue;
    neighborOut[ia].push(ib); neighborOut[ib].push(ia);
  }

  /* ---- 10) estrechos ---- */
  const byId = new Map(provs.map((p) => [p.id, p]));
  const findRegionByPiece = (iso, pieceNorm) => {
    const list = byCountry.get(iso) || [];
    return (
      list.find((p) => p.pieces.some(([, pn]) => normName(pn) === pieceNorm)) ||
      (list.length === 1 ? list[0] : null)
    );
  };
  const nearestTo = (p, pool) => {
    let best = null, bd = Infinity;
    for (const q of pool) {
      if (!q || q.id === p.id) continue;
      // cutoff ~90°: sin salida temprana -> distancia mínima REAL
      const d = ringsPairDist2(p, q, 10, true);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  };
  const straits = [];
  const seenStrait = new Set();
  const addStrait = (a, b, why) => {
    if (!a || !b || a.id === b.id) return;
    const k = [a.id, b.id].sort().join('|');
    if (seenStrait.has(k)) return;
    seenStrait.add(k);
    straits.push([a.id, b.id].sort());
    if (why) notes.artificial.push(`estrecho ${a.id} <-> ${b.id} (${why})`);
  };

  const cub = findRegionByPiece('CUB');
  const usaFlorida = findRegionByPiece('USA', 'florida');
  const hti = findRegionByPiece('HTI');
  const dom = findRegionByPiece('DOM');
  const jamaica = findRegionByPiece('JAM');
  const bhs = findRegionByPiece('BHS');
  const tto = findRegionByPiece('TTO');
  const nunavut = findRegionByPiece('CAN', 'nunavut');
  const usaPR = findRegionByPiece('USA', 'puerto rico');

  addStrait(usaFlorida, cub);
  addStrait(findRegionByPiece('MEX', 'yucatan'), cub);
  if (cub && hti && dom) {
    const dH = ringsPairDist2(cub, hti, 10, true);
    const dD = ringsPairDist2(cub, dom, 10, true);
    addStrait(cub, dH <= dD ? hti : dom, 'la más cercana de La Española a Cuba');
  }
  addStrait(dom, usaPR, 'DOM <-> Puerto Rico');
  addStrait(jamaica, hti, 'Jamaica <-> Haití');
  addStrait(bhs, usaFlorida, 'Bahamas <-> Florida');
  if (tto && byCountry.get('VEN')) {
    const best = nearestTo(tto, byCountry.get('VEN'));
    addStrait(tto, best, `costera venezolana más cercana (${Math.sqrt(nearestD(tto, best)).toFixed(2)}°)`);
  }
  function nearestD(a, b) { return a && b ? ringsPairDist2(a, b, 10, true) : Infinity; }
  addStrait(findRegionByPiece('CAN', 'newfoundland and labrador'), findRegionByPiece('CAN', 'nova scotia'), 'Terranova <-> Nova Scotia');
  if (nunavut && !(neighborOut[nunavut.id] || []).length) {
    const opt = [findRegionByPiece('CAN', 'manitoba'), findRegionByPiece('CAN', 'ontario')].filter(Boolean);
    opt.sort((a, b) => {
      const ca = ringsCentroid(a.rings), cb = ringsCentroid(b.rings), cn = ringsCentroid(nunavut.rings);
      return (ca.lon - cn.lon) ** 2 + (ca.lat - cn.lat) ** 2 - ((cb.lon - cn.lon) ** 2 + (cb.lat - cn.lat) ** 2);
    });
    addStrait(nunavut, opt[0], 'Nunavut aislado');
  }
  if (nunavut && byCountry.get('GRL')) {
    const best = nearestTo(nunavut, byCountry.get('GRL'));
    addStrait(best, nunavut, 'Groenlandia <-> Nunavut');
  }

  /* ---- 11) garantía de fronteras terrestres + huérfanos + 1 componente ---- */
  const hasLink = (a, b) =>
    neighborSet.has(Math.min(a.idx, b.idx) + '|' + Math.max(a.idx, b.idx)) ||
    seenStrait.has([a.id, b.id].sort().join('|'));
  for (const [isoA, isoB] of EXPECTED_LAND_BORDERS) {
    const la = byCountry.get(isoA), lb = byCountry.get(isoB);
    if (!la || !lb) continue;
    if (la.some((p) => lb.some((q) => hasLink(p, q)))) continue;
    let best = null, bq = null, bd = Infinity;
    for (const p of la)
      for (const q of lb) {
        const d = (p.centroid.lon - q.centroid.lon) ** 2 + (p.centroid.lat - q.centroid.lat) ** 2;
        if (d < bd) { bd = d; best = p; bq = q; }
      }
    if (best && Math.sqrt(bd) < 2.0) {
      addStrait(best, bq, `frontera garantizada ${isoA}-${isoB} (${Math.sqrt(bd).toFixed(2)}°)`);
      notes.warnings.push(`${isoA}-${isoB}: sin enlace por geometría; unidos "${best.id}" <-> "${bq.id}"`);
    } else {
      notes.warnings.push(`${isoA}-${isoB}: SIN ENLACE (distancia ${Math.sqrt(bd).toFixed(2)}°)`);
    }
  }

  const adjMap = () => {
    const m = new Map(provs.map((p) => [p.idx, new Set()]));
    for (const k of neighborSet) {
      const [a, b] = k.split('|').map(Number);
      m.get(a)?.add(b); m.get(b)?.add(a);
    }
    for (const [aid, bid] of straits) {
      const ia = byId.get(aid)?.idx, ib = byId.get(bid)?.idx;
      if (ia == null || ib == null) continue;
      m.get(ia)?.add(ib); m.get(ib)?.add(ia);
    }
    return m;
  };
  const reachableFrom = (m, from) => {
    const seen = new Set([from]);
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const nb of m.get(cur) || []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
    }
    return seen;
  };
  let m = adjMap();
  // huérfanos: sin vecinos ni estrechos
  for (const p of [...provs]) {
    if (m.get(p.idx).size > 0) continue;
    const same = provs.filter((q) => q.country === p.country && q.idx !== p.idx);
    const pool = same.length ? same : provs.filter((q) => q.idx !== p.idx);
    pool.sort((a, b) =>
      (a.centroid.lon - p.centroid.lon) ** 2 + (a.centroid.lat - p.centroid.lat) ** 2 -
      ((b.centroid.lon - p.centroid.lon) ** 2 + (b.centroid.lat - p.centroid.lat) ** 2)
    );
    addStrait(p, pool[0], `isla huérfana conectada a ${pool[0].id}`);
    notes.warnings.push(`sin vecinos: ${p.id} -> estrecho con ${pool[0].id}`);
    m = adjMap();
  }
  // componentes: enlaza el par más cercano entre fragmentos hasta 1 componente
  let guard = 0;
  while (guard++ < 200) {
    const seen = reachableFrom(m, provs[0].idx);
    if (seen.size >= provs.length) break;
    let best = null, bq = null, bd = Infinity;
    for (const p of provs) {
      if (seen.has(p.idx)) continue;
      for (const q of provs) {
        if (!seen.has(q.idx)) continue;
        const d = (p.centroid.lon - q.centroid.lon) ** 2 + (p.centroid.lat - q.centroid.lat) ** 2;
        if (d < bd) { bd = d; best = p; bq = q; }
      }
    }
    addStrait(best, bq, `componente aislada unida a ${bq.id} (${Math.sqrt(bd).toFixed(1)}°)`);
    notes.warnings.push(`componente aislada: ${best.id} -> estrecho con ${bq.id}`);
    m = adjMap();
  }

  /* ---- 12) países ---- */
  const COUNTRIES = {};
  for (const iso of order) {
    const cfg = COUNTRY_CFG[iso];
    if (cfg.missing) continue;
    const capRegion = (byCountry.get(iso) || []).find((p) => p.capitalPiece);
    let aggression = cfg.aggression;
    if (aggression == null) {
      let h = 2166136261;
      for (const c of cfg.name) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
      aggression = Math.round((0.2 + ((h >>> 0) / 4294967296) * 0.5) * 100) / 100;
    }
    COUNTRIES[iso] = {
      name: cfg.name,
      color: cfg.color,
      capital: capRegion ? capRegion.id : null,
      aggression,
    };
  }
  // capitales -> regiones: el flag capital ya está en la región que contiene la pieza
  for (const p of provs) p.capital = p.capitalPiece;

  const mapJS =
    '// =====================================================================\n' +
    '// Wardern — datos del mapa de América (GENERADO — no editar a mano)\n' +
    '// Fuente: Natural Earth 10m vía tools/build-map.mjs\n' +
    '// NOTA: province.polygon es un ARRAY DE ANILLOS [[[lon,lat],…],…]\n' +
    '// (provincias fusionadas conservan todos los anillos de sus piezas;\n' +
    '// el motor dibuja cada anillo como polígono independiente).\n' +
    '// =====================================================================\n' +
    'export const MAP = ' + JSON.stringify({ bounds, provinces: provincesOut, neighbors: neighborOut, straits }) + ';\n';

  const countriesJS =
    '// =====================================================================\n' +
    '// Wardern — países jugables (GENERADO — no editar a mano)\n' +
    '// =====================================================================\n' +
    'export const COUNTRIES = ' + JSON.stringify(COUNTRIES) + ';\n';

  fs.writeFileSync(path.join(OUT_DIR, 'map-data.js'), mapJS, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'countries-data.js'), countriesJS, 'utf8');

  /* ---- 13) informe ---- */
  const mb = (n) => (n / 1e6).toFixed(2) + ' MB';
  log('\n========== INFORME ==========');
  log(`provincias: ${provincesOut.length}`);
  log(`países: ${Object.keys(COUNTRIES).length}`);
  log(`pares vecinos: ${neighborSet.size}; estrechos: ${straits.length}`);
  for (const iso of order) {
    const list = byCountry.get(iso) || [];
    if (!list.length) continue;
    const pop = list.reduce((a, p) => a + p.pop, 0);
    log(`  ${iso}: ${list.length} prov, ${Math.round(pop / 1e6)}M hab`);
  }
  log('\n-- fusiones y renombres --');
  notes.merges.forEach((s) => log('  ' + s));
  log('\n-- enlaces artificiales / estrechos añadidos --');
  notes.artificial.forEach((s) => log('  ' + s));
  if (notes.dropped.length) { log('\n-- features descartadas --'); notes.dropped.forEach((s) => log('  ' + s)); }
  if (notes.islets.length) { log('\n-- islotes descartados --'); notes.islets.forEach((s) => log('  ' + s)); }
  if (notes.scaled.length) { log('\n-- escalado de población --'); notes.scaled.forEach((s) => log('  ' + s)); }
  log('\n-- capitales --');
  notes.capitals.forEach((s) => log('  ' + s));
  if (notes.warnings.length) { log('\n-- avisos --'); notes.warnings.forEach((s) => log('  ! ' + s)); }

  // retención de área por país (piezas originales vs salida)
  log('\n-- retención de área por país (objetivo > 98%) --');
  for (const iso of order) {
    const list = byCountry.get(iso) || [];
    if (!list.length) continue;
    let before = 0, after = 0;
    for (const p of list) {
      for (const r of p.rings) before += ringAreaKm2(r);
      for (const r of (p.outPolygon || [])) after += ringAreaKm2(r);
    }
    const pct = before > 0 ? (after / before) * 100 : 100;
    log(`  ${iso}: ${pct.toFixed(1)}% (${Math.round(before).toLocaleString()} -> ${Math.round(after).toLocaleString()} km²)`);
    if (pct < 98) notes.warnings.push(`${iso}: retención de área ${pct.toFixed(1)}% < 98%`);
  }

  // histograma de terreno
  const hist = {};
  for (const p of provincesOut) hist[p.terrain] = (hist[p.terrain] || 0) + 1;
  log('\n-- histograma de terreno --');
  for (const t of ['llanura', 'selva', 'bosque', 'montaña', 'desierto', 'tundra', 'urbano'])
    log(`  ${t}: ${hist[t] || 0}`);

  /* ---- 14) verificación (reimportando los módulos) ---- */
  log('\n========== VERIFICACIÓN ==========');
  const { MAP: M2 } = await import(pathToFileURL(path.join(OUT_DIR, 'map-data.js')).href);
  const { COUNTRIES: C2 } = await import(pathToFileURL(path.join(OUT_DIR, 'countries-data.js')).href);
  const errors = [];
  const TERRAINS = new Set(['llanura', 'bosque', 'selva', 'montaña', 'desierto', 'tundra', 'urbano']);
  const ids = new Set();
  for (const p of M2.provinces) {
    if (ids.has(p.id)) errors.push(`id duplicado ${p.id}`);
    ids.add(p.id);
    if (!/^[a-z]{3}-[a-z0-9-]+$/.test(p.id)) errors.push(`id inválido ${p.id}`);
    if (!C2[p.country]) errors.push(`país desconocido ${p.country} en ${p.id}`);
    if (!TERRAINS.has(p.terrain)) errors.push(`terreno inválido ${p.terrain} en ${p.id}`);
    if (!Array.isArray(p.polygon) || !p.polygon.length) errors.push(`polygon no es array de anillos ${p.id}`);
    else
      for (const ring of p.polygon) {
        if (ring.length < 4) errors.push(`anillo corto ${p.id}`);
        const f = ring[0], l = ring[ring.length - 1];
        if (f[0] !== l[0] || f[1] !== l[1]) errors.push(`anillo no cerrado ${p.id}`);
        const capMax = maxPtsForArea(ringArea(ring));
        if (ring.length - 1 > capMax) errors.push(`anillo excede ${capMax} vértices (${ring.length - 1}) ${p.id}`);
        for (const [x, y] of ring)
          if (Math.abs(Math.round(x * 100) - x * 100) > 1e-9 ||
              Math.abs(Math.round(y * 100) - y * 100) > 1e-9)
            { errors.push(`coordenadas no redondeadas a 2 decimales ${p.id}`); break; }
      }
    if (!(p.pop > 0)) errors.push(`pop inválida ${p.id}`);
    if (!Number.isInteger(p.vp) || p.vp < 1) errors.push(`vp inválida ${p.id}`);
    for (const k of ['money', 'supplies', 'fuel', 'manpower'])
      if (!Number.isInteger(p.prod[k]) || p.prod[k] < 0) errors.push(`prod.${k} inválida ${p.id}`);
  }
  for (const [iso, c] of Object.entries(C2)) {
    if (!M2.provinces.some((p) => p.country === iso)) errors.push(`país sin provincias ${iso}`);
    if (!c.capital || !ids.has(c.capital)) errors.push(`capital inválida ${iso}: ${c.capital}`);
    else {
      const cp = M2.provinces.find((p) => p.id === c.capital);
      if (!cp.capital) errors.push(`capital sin flag ${iso}`);
    }
    if (typeof c.name !== 'string' || !/^#[0-9a-f]{6}$/i.test(c.color)) errors.push(`nombre/color inválido ${iso}`);
    if (!(c.aggression >= 0.2 && c.aggression <= 0.7)) errors.push(`aggression fuera de rango ${iso}`);
  }
  const nKeys = Object.keys(M2.neighbors).sort().join(',');
  if (nKeys !== [...ids].sort().join(',')) errors.push('neighbors: claves != ids de provincias');
  for (const [id, arr] of Object.entries(M2.neighbors)) {
    for (const nb of arr) {
      if (!ids.has(nb)) errors.push(`vecino inexistente ${nb} de ${id}`);
      if (!M2.neighbors[nb]?.includes(id)) errors.push(`asimetría ${id}->${nb}`);
      if (nb === id) errors.push(`auto-vecino ${id}`);
    }
  }
  for (const [a, b] of M2.straits) {
    if (!ids.has(a) || !ids.has(b)) errors.push(`estrecho inválido ${a}-${b}`);
    if (a === b) errors.push(`estrecho consigo mismo ${a}`);
  }
  // conectividad: UNA sola componente sobre neighbors+straits
  const g = new Map([...ids].map((i) => [i, new Set(M2.neighbors[i] || [])]));
  for (const [a, b] of M2.straits) { g.get(a)?.add(b); g.get(b)?.add(a); }
  const first = M2.provinces[0].id;
  const seen = new Set([first]);
  const qq = [first];
  while (qq.length) {
    const cur = qq.shift();
    for (const nb of g.get(cur) || []) if (!seen.has(nb)) { seen.add(nb); qq.push(nb); }
  }
  if (seen.size !== ids.size) {
    const orphan = [...ids].filter((i) => !seen.has(i));
    errors.push(`grafo NO conexo: ${orphan.length} provincias inalcanzables (p.ej. ${orphan.slice(0, 5).join(', ')})`);
  }
  // sin vecinos solo con estrecho
  let lonely = 0;
  for (const [id, arr] of Object.entries(M2.neighbors)) {
    if (!arr.length && !M2.straits.some(([a, b]) => a === id || b === id)) {
      lonely++;
      errors.push(`provincia sin vecinos ni estrecho: ${id}`);
    }
  }
  for (const [iso, n] of Object.entries(
    M2.provinces.reduce((acc, p) => ((acc[p.country] = (acc[p.country] || 0) + 1), acc), {})
  ))
    if (n > (TARGET_PROV[iso] || 30)) errors.push(`${iso} tiene ${n} provincias (objetivo ${TARGET_PROV[iso] || 30})`);

  const sizeMap = fs.statSync(path.join(OUT_DIR, 'map-data.js')).size;
  log(`map-data.js: ${mb(sizeMap)}; countries-data.js: ${mb(fs.statSync(path.join(OUT_DIR, 'countries-data.js')).size)}`);
  log(`provincias con vecinos y sin estrecho: ok (revisadas ${Object.keys(M2.neighbors).length}; aisladas reales: ${lonely})`);

  if (errors.length) {
    log('ERRORES:');
    errors.forEach((e) => log('  ✗ ' + e));
    process.exitCode = 1;
  } else {
    log(`OK: ${M2.provinces.length} provincias, ${Object.keys(C2).length} países, ${M2.straits.length} estrechos`);
    log(`OK: UNA componente conexa (${seen.size}/${ids.size} alcanzables desde ${first})`);
    log('VERIFICACIÓN COMPLETA SIN ERRORES');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
