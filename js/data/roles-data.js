// Etiquetas y descripción de combate de cada unidad.
//
// Es la capa que le dice al jugador PARA QUÉ sirve una ficha sin obligarle a leer
// tres matrices de números. Las etiquetas son la lectura de un vistazo y la frase
// es el resumen táctico: qué hace bien y qué la mata.
//
// Todo se deriva de la CATEGORÍA, no se escribe unidad por unidad: son 96
// variantes, y mantener 96 fichas de texto a mano garantizaría que se quedaran
// desfasadas al primer reajuste de balance. Lo único que varía por variante es el
// matiz de doctrina y de tier, que se añade al final.
//
// Cada etiqueta lleva un TONO, que es lo que le da color en pantalla:
//   fuerte  en lo que destaca
//   debil   su vulnerabilidad — lo que hay que saber para no perderla tonta
//   util    capacidad que otras no tienen
//   neutro  rasgo descriptivo, sin juicio

const ROLES = {
  infanteria: {
    papel: "Línea y ocupación",
    tags: [
      ["Captura provincias", "util"],
      ["Aguanta en ciudad y montaña", "fuerte"],
      ["Lenta: 12 km/h", "debil"],
      ["Indefensa ante el aire", "debil"],
    ],
    desc: "La única que toma terreno junto a la motorizada. En urbano, bosque y montaña gana hasta al carro; en llanura abierta es la que peor lo pasa. Nunca la dejes sin cobertura antiaérea.",
  },
  motorizada: {
    papel: "Explorador y ocupación rápida",
    tags: [
      ["Captura provincias", "util"],
      ["Reconocimiento", "util"],
      ["La más rápida en tierra", "fuerte"],
      ["Pierde todos los duelos", "debil"],
    ],
    desc: "No es fuerza de choque: pierde los nueve duelos a propósito. Su valor es llegar antes, ver lo que hay delante y ocupar lo que el carro ya ha roto.",
  },
  mbt: {
    papel: "Fuerza de choque",
    tags: [
      ["Rompe líneas en llanura", "fuerte"],
      ["El que más aguanta en tierra", "fuerte"],
      ["Torpe en montaña y ciudad", "debil"],
      ["Presa del cazatanques", "debil"],
      ["No captura", "debil"],
    ],
    desc: "Gana en campo abierto y arrasa infantería, pero pierde la mitad de su ataque en montaña y urbano, y el cazatanques lo mata. Rompe terreno pero no lo ocupa: llévalo con infantería.",
  },
  cazatanques: {
    papel: "Anticarro",
    tags: [
      ["Mata blindados", "fuerte"],
      ["Reconocimiento", "util"],
      ["Frágil a cambio", "debil"],
      ["Malo contra infantería", "debil"],
    ],
    desc: "Especialista puro: el doble de daño contra carros que cualquier otra cosa. Fuera de eso es débil, y la infantería se lo come. Ponlo donde vengan los blindados, no en la línea.",
  },
  artilleria: {
    papel: "Fuego a distancia",
    tags: [
      ["Dispara sin moverse", "util"],
      ["Bombardeo preparatorio", "fuerte"],
      ["Arrasa infantería", "fuerte"],
      ["Muere si la alcanzan", "debil"],
      ["No toca al aire", "debil"],
    ],
    desc: "Bate fichas enemigas a distancia sin entrar en combate, y abre la batalla con un ×1,5 de daño. Necesita ojos sobre el blanco. Si la caballería le llega encima, está muerta.",
  },
  antiaereo: {
    papel: "Escudo antiaéreo",
    tags: [
      ["Barre el cielo", "fuerte"],
      ["Reparte contactos a todo el bando", "util"],
      ["Dispara de vuelta al atacante", "util"],
      ["Indefenso ante blindados", "debil"],
    ],
    desc: "Un solo antiaéreo vence a dos cazas, y su radar da contactos a todas tus unidades por enlace de datos. Jamás lo dejes solo frente a tierra: cualquier carro lo aplasta.",
  },
  caza: {
    papel: "Superioridad aérea",
    tags: [
      ["Domina el aire", "fuerte"],
      ["Caza bombarderos y drones", "fuerte"],
      ["Radar propio", "util"],
      ["Cae ante el antiaéreo", "debil"],
    ],
    desc: "La unidad más dominante del juego: gana 8 de 9 duelos. Su trabajo es limpiar el cielo antes de que entre el ataque. Lo único que lo para es una batería antiaérea.",
  },
  bombardero: {
    papel: "Ataque a la superficie",
    tags: [
      ["Arrasa concentraciones", "fuerte"],
      ["El de más alcance", "fuerte"],
      ["Hunde buques", "util"],
      ["Indefenso ante el caza", "debil"],
      ["Cae ante el antiaéreo", "debil"],
    ],
    desc: "Devasta un apilamiento sin antiaéreo y es el que más lejos llega. No sabe defenderse: mándalo con el cielo ya limpio, o con escolta.",
  },
  helicoptero: {
    papel: "Apoyo anticarro",
    tags: [
      ["Mata carros", "fuerte"],
      ["El blindado apenas le hace daño", "fuerte"],
      ["Poco alcance", "debil"],
      ["Cae ante el caza y el antiaéreo", "debil"],
    ],
    desc: "Cazador de blindados: el carro casi no puede responderle. A cambio tiene el radio de acción más corto del aire, así que trabaja pegado al frente.",
  },
  drone: {
    papel: "Ojos del frente",
    tags: [
      ["Ve muy lejos", "fuerte"],
      ["Entra sin declarar guerra", "util"],
      ["El de más radio de acción", "fuerte"],
      ["Casi no pelea", "debil"],
      ["Cualquier cosa lo derriba", "debil"],
    ],
    desc: "No es un arma, es la vista. Descubre unidades enemigas dentro de su radio aunque el territorio no sea tuyo, y sobrevuela países neutrales sin consecuencias. Solo el de tier 3 lleva misiles.",
  },
  corbeta: {
    papel: "Patrulla costera",
    tags: [
      ["Barata y rápida", "fuerte"],
      ["Caza submarinos", "util"],
      ["Poca defensa antiaérea", "debil"],
      ["Frágil en línea", "debil"],
    ],
    desc: "El buque de número: vigila la costa y persigue submarinos sin hipotecar el presupuesto. En un combate de superficie contra algo mayor no tiene nada que hacer.",
  },
  fragata: {
    papel: "Escolta de zona",
    tags: [
      ["Protege al grupo", "fuerte"],
      ["Antiaérea media", "util"],
      ["Caza submarinos", "util"],
      ["Pierde con el destructor", "debil"],
    ],
    desc: "El escudo del convoy: cubre a los buques grandes de aviones y submarinos. Contra un destructor enemigo pierde, así que no la mandes sola a un combate de superficie.",
  },
  destructor: {
    papel: "Buque de línea",
    tags: [
      ["El mejor paraguas antiaéreo", "fuerte"],
      ["Domina la superficie", "fuerte"],
      ["Derriba misiles entrantes", "util"],
      ["Lanza cruceros a tierra", "util"],
      ["Caro", "debil"],
    ],
    desc: "La columna vertebral de la flota. Engancha aviones a cientos de kilómetros, intercepta más de la mitad de los misiles que le lanzan y gana casi cualquier duelo de superficie.",
  },
  submarino: {
    papel: "Cazador silencioso",
    tags: [
      ["Mata portaviones", "fuerte"],
      ["Difícil de encontrar", "fuerte"],
      ["CERO defensa antiaérea", "debil"],
      ["Presa del destructor", "debil"],
    ],
    desc: "La pesadilla de los buques grandes: hunde portaviones que no pueden responderle. No dispara a aviones en absoluto, y un destructor con sonar lo caza.",
  },
  portaviones: {
    papel: "Base aérea flotante",
    tags: [
      ["Lleva aviación a cualquier mar", "util"],
      ["El que más aguanta del juego", "fuerte"],
      ["Mueve el radio de acción aéreo", "util"],
      ["Se defiende poco solo", "debil"],
      ["Presa del submarino", "debil"],
      ["Carísimo", "debil"],
    ],
    desc: "Proyecta tu aviación donde no llegan tus aeródromos: los aparatos embarcados miden su alcance desde él. Solo se defiende a 25 km, así que sin escolta es un blanco enorme.",
  },
  transporte: {
    papel: "Desembarco",
    tags: [
      ["Lleva tropa por mar", "util"],
      ["Casco grande", "fuerte"],
      ["Inofensivo", "debil"],
      ["Casi indefenso ante el aire", "debil"],
      ["Si se hunde, se lleva la carga", "debil"],
    ],
    desc: "La única forma de meter ejército en otro continente. No pelea, y si lo hunden se va al fondo con todo lo que llevaba dentro. Nunca lo muevas sin escolta.",
  },
};

// Matices que se añaden a las etiquetas de la categoría. Ni el tier ni la
// doctrina cambian el papel de la unidad, pero sí conviene que se lean en la
// ficha: son la diferencia entre un T-62 y un T-90M.
const TIER_TAG = {
  1: ["Generación de los 80", "neutro"],
  2: ["Generación de los 2000", "neutro"],
  3: ["Última generación", "fuerte"],
};

const DOCTRINE_TAG = {
  occidental: ["Occidental: pega más", "neutro"],
  oriental: ["Oriental: aguanta más", "neutro"],
};

// Papel y descripción de un tipo. null si la categoría no se reconoce.
export function roleOf(def) {
  return def ? ROLES[def.category] || null : null;
}

// Etiquetas completas de una variante: las de su categoría, más el matiz de
// doctrina y de tier. Cada una es [texto, tono].
export function tagsFor(def) {
  const r = roleOf(def);
  if (!r) return [];
  const out = [...r.tags];
  if (def.doctrine && DOCTRINE_TAG[def.doctrine]) out.push(DOCTRINE_TAG[def.doctrine]);
  if (def.tier && TIER_TAG[def.tier]) out.push(TIER_TAG[def.tier]);
  return out;
}
