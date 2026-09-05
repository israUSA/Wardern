# Wardern — Arquitectura técnica

## Stack

- **Vanilla JS (ES modules) + Canvas 2D + HTML/CSS. Sin build, sin dependencias.**
  Corre en cualquier navegador moderno; se sirve con un servidor estático
  (`start.bat` → `python -m http.server 8080`). Los módulos ES requieren http(s),
  no `file://`.
- Node 25 solo para el **pipeline de datos** (`tools/build-map.mjs`), no en runtime.

## Estructura

```
wardern/
├── index.html
├── start.bat              # levanta servidor + abre navegador
├── css/style.css
├── js/
│   ├── main.js            # bootstrap, loop, input (pan/zoom/clic)
│   ├── save.js            # localStorage + export/import JSON
│   ├── data/
│   │   ├── constants.js   # tiempos, costes de edificios, multipliers de terreno
│   │   ├── map-data.js    # [AGENTE MAPA] MAP = {bounds, provinces, neighbors, straits}
│   │   ├── countries-data.js # [AGENTE MAPA] COUNTRIES = {ISO3: {name, color, ...}}
│   │   ├── units-data.js  # [AGENTE MILITAR] UNITS = {id: {...stats}}
│   │   └── icons.js       # [AGENTE ASSETS] ICONS = {money: '<svg…>', …}
│   ├── engine/
│   │   ├── state.js       # creación de partida nueva + serialización
│   │   ├── economy.js     # producción horaria, colas de construcción/anexión
│   │   ├── movement.js    # Dijkstra sobre vecinos+estrechos, avance de unidades
│   │   ├── combat.js      # batallas por tick, moral, retiradas, captura
│   │   ├── ai.js          # bots de país
│   │   └── sim.js         # orquesta el tick: tiempo→economía→movimiento→combate→IA
│   ├── render/
│   │   ├── renderer.js    # proyección Mercator, polígonos, unidades, órdenes
│   │   └── symbols.js     # [AGENTE ASSETS] símbolos OTAN en canvas
│   └── ui/
│       └── panels.js      # DOM: barra superior, paneles, log, modales, pantallas
├── tools/build-map.mjs    # [AGENTE MAPA] pipeline Natural Earth → js/data
└── docs/                  # GDD, ARCHITECTURE, ROADMAP, UNITS, DATA-NOTES
```

## Contratos de datos (lo que produce cada agente)

```js
// js/data/map-data.js
export const MAP = {
  bounds: {minLon, maxLon, minLat, maxLat},
  provinces: [{
    id: "usa-california", country: "USA", name: "California",
    polygon: [[[lon,lat],…], [[lon,lat],…]],  // ARRAY DE ANILLOS exteriores
                                              // (islas y piezas de fusiones; el motor
                                              // también acepta un anillo único plano)
    terrain: "llanura|bosque|selva|montaña|desierto|tundra|urbano",
    pop: 39000000, capital: false,
    prod: {money, supplies, fuel, manpower},   // por hora de juego
    vp: 120
  }, …],
  neighbors: { "usa-california": ["usa-nevada", …], … },
  straits: [["cub-cuba","mex-yucatan"], …]   // enlaces marítimos
};

// js/data/countries-data.js
export const COUNTRIES = {
  USA: { name: "Estados Unidos", color: "#3f6fb5", capital: "usa-distrito-columbia",
         aggression: 0.5 }   // 0..1 personalidad IA
};

// js/data/units-data.js — 60 variantes doctrine×tier (ids "occ/ori-{tier}-{cat}")
// + 10 alias legacy (ids planas marcadas legacy:true, solo para cargar partidas viejas).
// Las matrices attack/defense se indexan por CATEGORÍA (combat.js normaliza el id).
export const UNITS = {
  "occ-2-mbt": {
    id, doctrine: "occidental", tier: 2, category: "mbt", name: "M1 Abrams", icon: "mbt",
    cost: {money, supplies, manpower, fuel},
    buildHours: 36, hp: 100, speed: 50, captures: false,
    attack:  {infanteria: 14, motorizada: 15, mbt: 11, …},   // claves = categorías
    defense: {…}, terrainDefBonus: {montaña: 1.4, …}, terrainAtkPenalty: {…},
    rangedTicks: 0   // artillería: ticks con bono de bombardeo preparatorio
  }
};
```

Reglas de propiedad de archivos: los módulos marcados `[AGENTE …]` solo los
escribe su agente; el motor (que escribe el agente principal) los **lee**, nunca
los edita. Placeholders válidos viven ahí hasta la entrega.

## Modelo de simulación

- Estado mutable en `GameState` (ver `state.js`); el mapa estático no se serializa
  (se recarga del módulo; ids estables).
- Tick cada 250 ms: `speed ∈ {0,1,2,4}` → `gameMinutesPerTick = 15 × speed`.
  Orden del tick: tiempo → economía (cada hora de juego) → movimiento → combate →
  IA (cada 6 h de juego, países por turnos) → autoguardado (cada 2 min reales).
- Movimiento: Dijkstra por `neighbors + straits`; coste de arista =
  `distancia_km(haversine entre centroides) / speed × 60 × mult_terreno × (estrecho ? 2 : 1)`
  en minutos de juego. Unidad guarda `path[]` y `minutesLeft` de la arista actual.
- Combate: ver GDD §6. La captura la aplica `combat.js` al final del tick.

## Render

- Proyección Mercator simple: `x = lon`, `y = ln(tan(π/4 + lat·π/360))` (en grados);
  la vista es `{cx, cy, scale}` → transformación a píxeles. Pan con arrastre,
  zoom con rueda hacia el cursor.
- Selección/hover: ray casting punto-en-polígono con prefiltro por bbox.
- Unidades: icono OTAN por tipo (funciones de `symbols.js`) teñido del color del
  dueño, agrupado por tipo por provincia. Batalla: aspas rojas pulsantes.
- Redibujo continuo con rAF (cientos de polígonos son triviales para canvas).

## Guardado

`localStorage["wardern-save"]` + exportar `wardern-save.json`. Incluye: versión,
fecha de juego, velocidad, jugador, recursos y guerras por país, por provincia
`{owner, occupier, buildings, queue, annexing}`, todas las unidades, log reciente.
Migración: campo `version` con chequeo al cargar.
