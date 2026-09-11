// Manifiesto de sprites ilustrados (SVG) estilo Conflict of Nations.
// - `unidades`: claves EXACTAS de categoria usadas por js/data/units-data.js y naval-data.js.
// - `edificios`: claves identicas a los edificios de js/data/constants.js (puerto, aerobase,
//   industria, reclutamiento, fortaleza).
// - `proyectiles`: municiones de apoyo/ataque.
// Los SVG usan clases CSS (.base/.shade/.light tintibles; .dark/.metal/.glass fijas) para que
// el motor aplique tinte por pais. Ver docs/ARTE.md.
export const SPRITES = {
  unidades: {
    infanteria: "assets/sprites/infanteria.svg",
    motorizada: "assets/sprites/motorizada.svg",
    mbt: "assets/sprites/mbt.svg",
    cazatanques: "assets/sprites/cazatanques.svg",
    artilleria: "assets/sprites/artilleria.svg",
    antiaereo: "assets/sprites/antiaereo.svg",
    caza: "assets/sprites/caza.svg",
    bombardero: "assets/sprites/bombardero.svg",
    helicoptero: "assets/sprites/helicoptero.svg",
    drone: "assets/sprites/drone.svg",
    corbeta: "assets/sprites/corbeta.svg",
    fragata: "assets/sprites/fragata.svg",
    destructor: "assets/sprites/destructor.svg",
    submarino: "assets/sprites/submarino.svg",
    portaviones: "assets/sprites/portaviones.svg",
    transporte: "assets/sprites/transporte.svg",
  },
  edificios: {
    puerto: "assets/sprites/b-puerto.svg",
    aerobase: "assets/sprites/b-aerobase.svg",
    industria: "assets/sprites/b-industria.svg",
    reclutamiento: "assets/sprites/b-reclutamiento.svg",
    fortaleza: "assets/sprites/b-fortaleza.svg",
  },
  // Sprite POR VARIANTE: cada unidad con el arte de su vehículo real
  // (F-16A, M1 Abrams, Arleigh Burke...). Si el archivo aún no existe, el
  // sprite-cache hace fallback al sprite de la categoría.
  variantes: {
    "occ-1-infanteria": "assets/sprites/v-occ-1-infanteria.svg",
    "occ-2-infanteria": "assets/sprites/v-occ-2-infanteria.svg",
    "occ-3-infanteria": "assets/sprites/v-occ-3-infanteria.svg",
    "ori-1-infanteria": "assets/sprites/v-ori-1-infanteria.svg",
    "ori-2-infanteria": "assets/sprites/v-ori-2-infanteria.svg",
    "ori-3-infanteria": "assets/sprites/v-ori-3-infanteria.svg",
    "occ-1-motorizada": "assets/sprites/v-occ-1-motorizada.svg",
    "occ-2-motorizada": "assets/sprites/v-occ-2-motorizada.svg",
    "occ-3-motorizada": "assets/sprites/v-occ-3-motorizada.svg",
    "ori-1-motorizada": "assets/sprites/v-ori-1-motorizada.svg",
    "ori-2-motorizada": "assets/sprites/v-ori-2-motorizada.svg",
    "ori-3-motorizada": "assets/sprites/v-ori-3-motorizada.svg",
    "occ-1-mbt": "assets/sprites/v-occ-1-mbt.svg",
    "occ-2-mbt": "assets/sprites/v-occ-2-mbt.svg",
    "occ-3-mbt": "assets/sprites/v-occ-3-mbt.svg",
    "ori-1-mbt": "assets/sprites/v-ori-1-mbt.svg",
    "ori-2-mbt": "assets/sprites/v-ori-2-mbt.svg",
    "ori-3-mbt": "assets/sprites/v-ori-3-mbt.svg",
    "occ-1-cazatanques": "assets/sprites/v-occ-1-cazatanques.svg",
    "occ-2-cazatanques": "assets/sprites/v-occ-2-cazatanques.svg",
    "occ-3-cazatanques": "assets/sprites/v-occ-3-cazatanques.svg",
    "ori-1-cazatanques": "assets/sprites/v-ori-1-cazatanques.svg",
    "ori-2-cazatanques": "assets/sprites/v-ori-2-cazatanques.svg",
    "ori-3-cazatanques": "assets/sprites/v-ori-3-cazatanques.svg",
    "occ-1-artilleria": "assets/sprites/v-occ-1-artilleria.svg",
    "occ-2-artilleria": "assets/sprites/v-occ-2-artilleria.svg",
    "occ-3-artilleria": "assets/sprites/v-occ-3-artilleria.svg",
    "ori-1-artilleria": "assets/sprites/v-ori-1-artilleria.svg",
    "ori-2-artilleria": "assets/sprites/v-ori-2-artilleria.svg",
    "ori-3-artilleria": "assets/sprites/v-ori-3-artilleria.svg",
    "occ-1-antiaereo": "assets/sprites/v-occ-1-antiaereo.svg",
    "occ-2-antiaereo": "assets/sprites/v-occ-2-antiaereo.svg",
    "occ-3-antiaereo": "assets/sprites/v-occ-3-antiaereo.svg",
    "ori-1-antiaereo": "assets/sprites/v-ori-1-antiaereo.svg",
    "ori-2-antiaereo": "assets/sprites/v-ori-2-antiaereo.svg",
    "ori-3-antiaereo": "assets/sprites/v-ori-3-antiaereo.svg",
    "occ-1-caza": "assets/sprites/v-occ-1-caza.svg",
    "occ-2-caza": "assets/sprites/v-occ-2-caza.svg",
    "occ-3-caza": "assets/sprites/v-occ-3-caza.svg",
    // PENDIENTE: el F-35 reutiliza el arte del F-22 (ambos delta furtivos, a
    // 27-46 px se leen igual). Cuando exista v-occ-3-caza-f35.svg, cambiar aquí.
    "occ-3-caza-f35": "assets/sprites/v-occ-3-caza.svg",
    "ori-1-caza": "assets/sprites/v-ori-1-caza.svg",
    "ori-2-caza": "assets/sprites/v-ori-2-caza.svg",
    "ori-3-caza": "assets/sprites/v-ori-3-caza.svg",
    "occ-1-bombardero": "assets/sprites/v-occ-1-bombardero.svg",
    "occ-2-bombardero": "assets/sprites/v-occ-2-bombardero.svg",
    "occ-3-bombardero": "assets/sprites/v-occ-3-bombardero.svg",
    "ori-1-bombardero": "assets/sprites/v-ori-1-bombardero.svg",
    "ori-2-bombardero": "assets/sprites/v-ori-2-bombardero.svg",
    "ori-3-bombardero": "assets/sprites/v-ori-3-bombardero.svg",
    "occ-1-helicoptero": "assets/sprites/v-occ-1-helicoptero.svg",
    "occ-2-helicoptero": "assets/sprites/v-occ-2-helicoptero.svg",
    "occ-3-helicoptero": "assets/sprites/v-occ-3-helicoptero.svg",
    "ori-1-helicoptero": "assets/sprites/v-ori-1-helicoptero.svg",
    "ori-2-helicoptero": "assets/sprites/v-ori-2-helicoptero.svg",
    "ori-3-helicoptero": "assets/sprites/v-ori-3-helicoptero.svg",
    "occ-1-drone": "assets/sprites/v-occ-1-drone.svg",
    "occ-2-drone": "assets/sprites/v-occ-2-drone.svg",
    "occ-3-drone": "assets/sprites/v-occ-3-drone.svg",
    // PENDIENTE: el RQ-190 reutiliza el arte del MQ-9 hasta tener el suyo.
    "occ-3-drone-rq190": "assets/sprites/v-occ-3-drone.svg",
    "ori-1-drone": "assets/sprites/v-ori-1-drone.svg",
    "ori-2-drone": "assets/sprites/v-ori-2-drone.svg",
    "ori-3-drone": "assets/sprites/v-ori-3-drone.svg",
    "occ-1-corbeta": "assets/sprites/v-occ-1-corbeta.svg",
    "occ-1-fragata": "assets/sprites/v-occ-1-fragata.svg",
    "occ-1-destructor": "assets/sprites/v-occ-1-destructor.svg",
    "occ-1-submarino": "assets/sprites/v-occ-1-submarino.svg",
    "occ-1-portaviones": "assets/sprites/v-occ-1-portaviones.svg",
    "occ-1-transporte": "assets/sprites/v-occ-1-transporte.svg",
    "occ-2-corbeta": "assets/sprites/v-occ-2-corbeta.svg",
    "occ-2-fragata": "assets/sprites/v-occ-2-fragata.svg",
    "occ-2-destructor": "assets/sprites/v-occ-2-destructor.svg",
    "occ-2-submarino": "assets/sprites/v-occ-2-submarino.svg",
    "occ-2-portaviones": "assets/sprites/v-occ-2-portaviones.svg",
    "occ-2-transporte": "assets/sprites/v-occ-2-transporte.svg",
    "occ-3-corbeta": "assets/sprites/v-occ-3-corbeta.svg",
    "occ-3-fragata": "assets/sprites/v-occ-3-fragata.svg",
    "occ-3-destructor": "assets/sprites/v-occ-3-destructor.svg",
    "occ-3-submarino": "assets/sprites/v-occ-3-submarino.svg",
    "occ-3-portaviones": "assets/sprites/v-occ-3-portaviones.svg",
    "occ-3-transporte": "assets/sprites/v-occ-3-transporte.svg",
    "ori-1-corbeta": "assets/sprites/v-ori-1-corbeta.svg",
    "ori-1-fragata": "assets/sprites/v-ori-1-fragata.svg",
    "ori-1-destructor": "assets/sprites/v-ori-1-destructor.svg",
    "ori-1-submarino": "assets/sprites/v-ori-1-submarino.svg",
    "ori-1-portaviones": "assets/sprites/v-ori-1-portaviones.svg",
    "ori-1-transporte": "assets/sprites/v-ori-1-transporte.svg",
    "ori-2-corbeta": "assets/sprites/v-ori-2-corbeta.svg",
    "ori-2-fragata": "assets/sprites/v-ori-2-fragata.svg",
    "ori-2-destructor": "assets/sprites/v-ori-2-destructor.svg",
    "ori-2-submarino": "assets/sprites/v-ori-2-submarino.svg",
    "ori-2-portaviones": "assets/sprites/v-ori-2-portaviones.svg",
    "ori-2-transporte": "assets/sprites/v-ori-2-transporte.svg",
    "ori-3-corbeta": "assets/sprites/v-ori-3-corbeta.svg",
    "ori-3-fragata": "assets/sprites/v-ori-3-fragata.svg",
    "ori-3-destructor": "assets/sprites/v-ori-3-destructor.svg",
    "ori-3-submarino": "assets/sprites/v-ori-3-submarino.svg",
    "ori-3-portaviones": "assets/sprites/v-ori-3-portaviones.svg",
    "ori-3-transporte": "assets/sprites/v-ori-3-transporte.svg",
  },
  // Proyectiles EN VUELO. La clave es el id del arma (missiles-data.js o
  // air-combat-data.js); lo que no esté aquí cae en `generico`.
  // CONVENCIÓN: morro hacia ARRIBA (norte), igual que los sprites de avión — el
  // render los gira al rumbo. El Tomahawk se dibujó apuntando a la derecha antes
  // de que existiera esta regla, así que lleva su corrección en `rotProyectil`.
  // Se agrupan por SILUETA, no por id: a 20 px de pantalla lo único que
  // distingue a un misil de otro es su forma. Un AIM-9L y un AIM-9X son el
  // mismo cuerpo con distinto buscador → mismo dibujo. Un AMRAAM (sin alas
  // grandes) o un R-77 (aletas de rejilla) no se parecen a nada → arte propio.
  // Así bastan 12 dibujos para las 21 armas del catálogo.
  proyectiles: {
    // --- respaldos (lo que no esté listado cae aquí) ---
    generico: "assets/sprites/m-misil.svg",
    aire: "assets/sprites/m-aire.svg",

    // --- aire-aire IR occidental: Sidewinder, mismo cuerpo ---
    aim9: "assets/sprites/m-aire.svg",
    aim9x: "assets/sprites/m-aire.svg",
    // --- aire-aire IR oriental: canards al morro, verde oliva ---
    r60: "assets/sprites/m-aa-archer.svg",
    r73: "assets/sprites/m-aa-archer.svg",
    // --- MANPADS: los más pequeños del juego ---
    stinger: "assets/sprites/m-manpads.svg",
    igla: "assets/sprites/m-manpads.svg",
    // --- radar semiactivo: alas delta grandes a media panza ---
    aim7: "assets/sprites/m-aa-radar.svg",
    r23: "assets/sprites/m-aa-radar.svg",
    r27: "assets/sprites/m-aa-radar.svg",
    // --- radar activo: cada uno con su seña, sin pareja ---
    aim120: "assets/sprites/m-amraam.svg",
    r77: "assets/sprites/m-r77.svg",

    // --- aire-suelo pesado de morro sensor: cuerpo gordo, alas en cruz ---
    agm65: "assets/sprites/m-as-pesado.svg",
    kh25: "assets/sprites/m-as-pesado.svg",
    // --- antirradar: dardo de morro afilado ---
    agm88: "assets/sprites/m-antirradar.svg",
    kh31p: "assets/sprites/m-antirradar.svg",
    // --- bombas guiadas: sin motor, cuerpo en gota con kit de cola ---
    gbu: "assets/sprites/m-bomba.svg",
    kab: "assets/sprites/m-bomba.svg",
    // --- anticarro ligero de helicóptero: todos tubos cortos iguales ---
    // OJO: `hellfireL` (air-combat-data.js) es el misil que VUELA. El `hellfire`
    // de missiles-data.js es el bonus pasivo del helicóptero y nunca llega a
    // dibujarse, así que con esa clave el sprite seguía siendo un asset muerto.
    hellfireL: "assets/sprites/m-hellfire.svg",
    tow: "assets/sprites/m-hellfire.svg",
    ataka: "assets/sprites/m-hellfire.svg",
    shturm: "assets/sprites/m-hellfire.svg",

    // --- crucero: fuselaje tubular con alas desplegables ---
    tomahawk: "assets/sprites/m-tomahawk.svg",
    harpoon: "assets/sprites/m-tomahawk.svg",
    jassm: "assets/sprites/m-tomahawk.svg",
    // --- cohete de saturación ---
    mlrs: "assets/sprites/m-cohete.svg",
  },
  // Grados a corregir para los que no siguen la convención de morro al norte.
  // Los tres de crucero comparten el dibujo del Tomahawk, así que comparten
  // también su corrección.
  rotProyectil: { tomahawk: -90, harpoon: -90, jassm: -90 },
  // Efectos: un fotograma que el render escala y desvanece
  efectos: {
    explosion: "assets/sprites/fx-explosion.svg",
  },
};
