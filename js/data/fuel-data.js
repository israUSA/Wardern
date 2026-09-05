// Regiones petroleras y gasíferas reales de América: producción de combustible
// por hora de cada provincia (sustituye al valor genérico del mapa base).
// Todo país sin región petrolera recibe un productor de red de seguridad
// (FUEL_FALLBACK en su capital o provincia más poblada) — se aplica en
// state.js initStatic, así que afecta también a partidas ya guardadas.
export const FUEL_REGIONS = {
  // Estados Unidos
  "usa-texas": 150, // Cuenca Pérmica + Golfo de México
  "usa-alaska": 90, // North Slope
  "usa-north-dakota": 60, // Bakken
  "usa-louisiana": 45,
  "usa-california": 40, // Kern County
  "usa-new-mexico": 40,
  "usa-oklahoma": 35,
  "usa-wyoming": 30,
  "usa-colorado": 25,
  "usa-utah": 15,
  "usa-pennsylvania": 10,
  // Canadá
  "can-alberta": 120, // arenas bituminosas de Athabasca
  "can-saskatchewan": 45,
  "can-newfoundland-and-labrador": 30, // Hibernia
  "can-british-columbia": 25,
  "can-northwest-territories": 15,
  // México
  "mex-campeche": 65, // Ku-Maloob-Zaap / Cantarell (offshore)
  "mex-tabasco": 60, // Ciudad Pemex
  "mex-veracruz": 25,
  "mex-chiapas": 20,
  "mex-tamaulipas": 15, // Burgos
  // Venezuela
  "ven-zulia": 80, // lago de Maracaibo
  "ven-monagas": 70, // Faja del Orinoco
  "ven-anzoategui": 40,
  "ven-barinas": 20,
  "ven-delta-amacuro": 25,
  "ven-apure": 15,
  // Brasil
  "bra-rio-de-janeiro": 80, // pre-sal / cuenca de Campos
  "bra-sao-paulo": 60, // pre-sal / cuenca de Santos
  "bra-espirito-santo": 25,
  "bra-amazonas": 15,
  "bra-bahia": 15,
  "bra-rio-grande-do-norte": 15,
  "bra-sergipe": 12,
  "bra-ceara": 10,
  "bra-maranhao": 10,
  // Colombia
  "col-casanare": 50,
  "col-meta": 45,
  "col-arauca": 40,
  "col-santander": 15,
  "col-bolivar": 15,
  "col-putumayo": 15,
  // Argentina
  "arg-neuquen": 60, // Vaca Muerta
  "arg-chubut": 25,
  "arg-santa-cruz": 20,
  "arg-salta": 20,
  "arg-tierra-del-fuego": 15,
  "arg-mendoza": 15,
  "arg-rio-negro": 12,
  // Bolivia, Ecuador, Perú, Chile
  "bol-santa-cruz": 35,
  "bol-tarija": 30,
  "bol-chuquisaca": 18,
  "ecu-guayas": 20,
  "ecu-azuay": 10,
  "per-piura": 20,
  "per-loreto": 12,
  "per-ucayali": 10,
  "chl-magallanes-y-antartica-chilena": 18,
  // Caribe y Guayanas
  "tto-trinidad-y-tobago": 55, // Trinidad, productora histórica
  "guy-guyana": 45, // bloque Stabroek (offshore)
  "sur-surinam": 25,
  "cub-cuba": 12,
};

// Producción mínima de seguridad para países sin ninguna región petrolera
export const FUEL_FALLBACK = 15;
