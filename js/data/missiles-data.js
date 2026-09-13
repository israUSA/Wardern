// Arsenal de misiles (docs/MISSILES.md). 5 armas: 1 pasiva de batalla y 4 golpes
// manuales que cubren los 4 dominios estilo CoN: naval, antibuque, artillería
// cohete y crucero aéreo.
//
// OJO, a diferencia de js/data/air-combat-data.js: estas 5 NO están separadas
// por doctrina. Cada una es un ROL que las dos cumplen con su propio material,
// así que sus `plataformaIds` incluyen barcos y aviones de ambos bandos. Por eso
// el nombre lleva los dos ejemplos reales entre paréntesis: un Tu-160M no
// dispara un JASSM estadounidense, dispara su Kh-101 — es la misma entrada de
// datos porque hacen exactamente lo mismo.
// Sin munición almacenada: cada disparo paga su coste; cooldown por plataforma.
export const MISSILES = {
  hellfire: {
    id: "hellfire", nombre: "Anticarro de helicóptero (Hellfire / Ataka)", modo: "batalla", tierRequerido: 2,
    plataformaIds: ["occ-2-helicoptero", "ori-2-helicoptero", "occ-3-helicoptero", "ori-3-helicoptero"],
    bonusAtaque: { 2: 6, 3: 10 }, clasesBlanco: ["mbt", "cazatanques"], coste: null,
  },
  tomahawk: {
    id: "tomahawk", nombre: "Crucero naval (Tomahawk / Kalibr)", modo: "golpe", tierRequerido: 2,
    plataformaIds: ["occ-2-destructor", "ori-2-destructor", "occ-3-destructor", "ori-3-destructor"],
    rangoKm: 1200, danio: 15, cooldownH: 18, velocidadKmH: 880,
    coste: { money: 12000, fuel: 1500 }, objetivos: "provincia-terrestre", probEdificio: 0.3,
  },
  harpoon: {
    id: "harpoon", nombre: "Antibuque (Harpoon / Kh-35)", modo: "golpe", tierRequerido: 3,
    plataformaIds: ["occ-3-fragata", "ori-3-fragata"],
    rangoKm: 450, danio: 25, cooldownH: 12, velocidadKmH: 900,
    coste: { money: 8000, fuel: 1000 }, objetivos: "celda-mar", probEdificio: 0,
  },
  mlrs: {
    id: "mlrs", nombre: "Salva de cohetes (HIMARS / Smerch)", etiqueta: "💥 Artillería", modo: "golpe", tierRequerido: 2,
    plataformaIds: ["occ-2-artilleria", "ori-2-artilleria", "occ-3-artilleria", "ori-3-artilleria"],
    rangoKm: 800, danio: 8, cooldownH: 8, velocidadKmH: 250,
    coste: { money: 4000, fuel: 600 }, objetivos: "provincia-terrestre", probEdificio: 0.15,
  },
  jassm: {
    id: "jassm", nombre: "Crucero aéreo (JASSM / Kh-101)", modo: "golpe", tierRequerido: 3,
    plataformaIds: ["occ-3-bombardero", "ori-3-bombardero"],
    rangoKm: 1000, danio: 12, cooldownH: 14, velocidadKmH: 900,
    coste: { money: 9000, fuel: 1200 }, objetivos: "provincia-terrestre", probEdificio: 0.3,
  },
};

// Radio de visión de los drones de reconocimiento por tier (km).
//
// Subido de 120/200/300 al añadir el reconocimiento terrestre (`scoutRangeKm` en
// state.js). Con las cifras viejas un dron no llegaba ni a la provincia de al
// lado —la distancia mediana entre vecinas son 324 km— y un Bradley de
// exploración habría visto más que un MQ-9, que es absurdo. Estas dejan al dron
// en torno al doble y medio de lo que ve el mejor vehículo terrestre (610 km).
//
// Medido desde Arizona, contando solo provincias de TIERRA ajenas: 700 km asoma
// a 2, 1100 km a 4 y 1500 km a 8. El radio barre además los sectores de mar que
// abarca, que es lo que permite descubrir barcos sin tener flota cerca.
export const DRONE_VISION_KM = { 1: 700, 2: 1100, 3: 1500 };
