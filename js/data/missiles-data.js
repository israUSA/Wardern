// Arsenal de misiles (docs/MISSILES.md). 5 armas: 1 pasiva de batalla (Hellfire)
// y 4 golpes manuales que cubren los 4 dominios estilo CoN: naval (Tomahawk,
// Harpoon), artillería cohetes (MLRS: HIMARS occidental / Smerch oriental) y
// aire (misil de crucero lanzado desde bombardero t3, JASSM/Kh-101).
// Sin munición almacenada: cada disparo paga su coste; cooldown por plataforma.
export const MISSILES = {
  hellfire: {
    id: "hellfire", nombre: "Hellfire", modo: "batalla", tierRequerido: 2,
    plataformaIds: ["occ-2-helicoptero", "ori-2-helicoptero", "occ-3-helicoptero", "ori-3-helicoptero"],
    bonusAtaque: { 2: 6, 3: 10 }, clasesBlanco: ["mbt", "cazatanques"], coste: null,
  },
  tomahawk: {
    id: "tomahawk", nombre: "Tomahawk", modo: "golpe", tierRequerido: 2,
    plataformaIds: ["occ-2-destructor", "ori-2-destructor", "occ-3-destructor", "ori-3-destructor"],
    rangoKm: 1200, danio: 15, cooldownH: 18, velocidadKmH: 880,
    coste: { money: 12000, fuel: 1500 }, objetivos: "provincia-terrestre", probEdificio: 0.3,
  },
  harpoon: {
    id: "harpoon", nombre: "Harpoon", modo: "golpe", tierRequerido: 3,
    plataformaIds: ["occ-3-fragata", "ori-3-fragata"],
    rangoKm: 450, danio: 25, cooldownH: 12, velocidadKmH: 900,
    coste: { money: 8000, fuel: 1000 }, objetivos: "celda-mar", probEdificio: 0,
  },
  mlrs: {
    id: "mlrs", nombre: "Salva MLRS", modo: "golpe", tierRequerido: 2,
    plataformaIds: ["occ-2-artilleria", "ori-2-artilleria", "occ-3-artilleria", "ori-3-artilleria"],
    rangoKm: 350, danio: 8, cooldownH: 8, velocidadKmH: 250,
    coste: { money: 4000, fuel: 600 }, objetivos: "provincia-terrestre", probEdificio: 0.15,
  },
  jassm: {
    id: "jassm", nombre: "Misil de crucero (bombardero)", modo: "golpe", tierRequerido: 3,
    plataformaIds: ["occ-3-bombardero", "ori-3-bombardero"],
    rangoKm: 1000, danio: 12, cooldownH: 14, velocidadKmH: 900,
    coste: { money: 9000, fuel: 1200 }, objetivos: "provincia-terrestre", probEdificio: 0.3,
  },
};

// Radio de visión de los drones de reconocimiento por tier (km)
export const DRONE_VISION_KM = { 1: 120, 2: 200, 3: 300 };
