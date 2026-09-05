# Wardern — Documento de Diseño de Juego (GDD)

> RTS de gran estrategia en tiempo real, single-player contra bots, inspirado en
> Conflict of Nations: WW3. Escenario: **mundo real moderno, mapa de toda América**.
> UI en español.

## 1. Visión

El jugador elige cualquier país americano y compite contra el resto (bots) por el
control del continente. Partidas de sesión (30–90 min reales con controles de
velocidad), economía provincial, reclutamiento de unidades, guerra y paz,
ocupación y anexión de territorio. Victoria por puntos de victoria (VP).

## 2. Alcance MVP (v1)

| Sistema | MVP v1 | Fases posteriores |
|---|---|---|
| Mapa | Toda América, provincias resumidas estilo CoN (~250-300), ~27 países jugables | Detalles costeros |
| Unidades | 5 terrestres (Infantería, Motorizada, MBT, Cazatanques, Artillería) + 5 aéreas (Caza, Bombardero, Helicóptero, Drone, Antiaéreo) | Naval, misiles/nukes |
| Economía | 4 recursos: Dinero, Suministros, Combustible, Mano de obra | Electrónica, materiales raros, mercado global |
| Edificios | Industria militar, Oficina de reclutamiento, Fortaleza, Base aérea | Puertos, radares |
| Visión | Niebla de guerra: solo se ven unidades en provincias propias y adyacentes | Inteligencia con drones/radares |
| Diplomacia | Declarar guerra, proponer paz, guerras IA↔IA | Coaliciones, relaciones, tratados |
| IA | Económica + militar + paz (ver §7) | Personalidades diferenciadas, desembarcos |
| Progreso | Ocupación→anexión, edificios | Doctrinas, investigación por tiers |
| Meta | Ninguna | Rangos, escenarios, dificultad |

## 3. Mapa

- Provincias = divisiones administrativas de primer nivel reales (estados,
  provincias, departamentos). Países pequeños/insulares = 1 provincia por país.
- Vecindad por frontera terrestre + **estrechos** (enlaces marítimos autorizados):
  Cuba↔Florida, Cuba↔Yucatán, La Española↔Cuba/Puerto Rico, Trinidad↔Venezuela,
  islas árticas↔mainland, Terranova↔Canadá, Groenlandia↔Canadá, Bahamas↔Florida.
- Terreno por provincia: `llanura, bosque, selva, montaña, desierto, tundra, urbano`.
  Afecta defensa, velocidad de movimiento y (menor) producción.
- Cada provincia: población, capital de país (sí/no), VP = población ponderada con
  bonus de capital. Los estrechos cuestan el doble de tiempo.

## 4. Economía

Producción por hora de juego por provincia (base, modificada por ocupación 25%):

| Recurso | Fórmula base | Uso |
|---|---|---|
| Dinero | `población / 20.000` | Todo: construir, reclutar, anexionar |
| Suministros | `población / 100.000 + industria × 3` | Reclutar y mantener unidades |
| Combustible | Regiones petroleras (tabla fija) + base 0.2 | Unidades motorizadas, mantenimiento |
| Mano de obra | `población / 40.000 + reclutamiento × 2` | Reclutar cualquier unidad |

Mantenimiento: cada unidad consume `0.5% de su coste` en suministros/combustible por
día de juego. Si los suministros llegan a 0, las unidades pierden moral y HP
(desgaste). Edificios (coste y tiempo en días de juego):

- **Industria militar**: +3 suministros/h. Coste 20k$ + 5k sumin.
- **Oficina de reclutamiento**: +2 mano de obra/h. Coste 15k$.
- **Fortaleza** (niveles 1–3): +25% defensa por nivel. Coste 10k$ × nivel.

Anexión de provincia ocupada: coste en dinero ∝ población, 5 días de juego;
mientras se anexa la provincia sigue produciendo al 25%.

## 5. Unidades (MVP)

Identidad: piedra-papel-tijera legible. Costes relativos (Infantería = 1):

| Unidad | Rol | Counter de | Débil contra | Coste rel. | Velocidad |
|---|---|---|---|---|---|
| **Infantería** | Línea y captura; fuerte defendiendo terreno difícil | — (grapa la línea) | Aire/arte laterales | 1 | 12 km/h |
| **Motorizada** | Rápida, captura y explota huecos | — | Todo en choque | 1.5 | 60 km/h |
| **Tanque (MBT)** | Rompe frentes en campo abierto | Infantería en llano | Cazatanques, montaña/urbano | 4 | 50 km/h |
| **Cazatanques** | Embosca y destruye blindados | Tanques | Infantería | 2.5 | 50 km/h |
| **Artillería** | Castiga stacks antes/durante el asalto | Stacks estáticos | Choque directo | 3 | 35 km/h |

- Números exactos y matriz de ataque/defensa por tipo: `js/data/units-data.js`
  (generado por el agente de diseño militar, contrato en ARCHITECTURE.md).
- Solo la **Infantería y la Motorizada capturan** provincias (como CoN).
- Máx. 8 unidades sin penalización por provincia; encima: −8% potencia por unidad extra.
- **Capa aérea**: caza, bombardero, helicóptero y drone (`air: true`) sobrevuelan
  cualquier provincia (ignoran fronteras neutrales, terreno y estrechos), no capturan
  y solo se reclutan en provincias con **Base aérea**. El **Antiaéreo** (terrestre)
  es su contramedida: alto ataque vs aéreos, débil vs tierra.

## 6. Niebla de guerra

- El jugador ve unidades propias en todo momento y unidades extranjeras solo en
  provincias que controla o adyacentes a ellas (los estrechos cuentan).
- Sin visión, el panel de provincia muestra "Sin inteligencia" en la guarnición.
- La IA no sufre niebla (simplificación estándar del género).

## 6. Combate

- Resolución continua por tick (no instantáneo). Por provincia con unidades de
  países en guerra:
  - Daño/s = `Σ ataque_vs_tipo × HP × moral × terreno × fortaleza × (1 / (1 + overstack))`
  - El daño se reparte entre enemigos ∝ `1 / defensa_vs_tipo`.
  - Artillería: su ataque aplica ×1.5 los primeros 12 ticks de una batalla (bombardeo preparatorio).
- Moral: −0.02/daño fuerte recibido, +regen fuera de combate en territorio propio.
- Ruptura: HP < 30% o moral < 20% → retirada a provincia amiga adyacente (la de
  menor guarnición); si no hay ruta → unidad destruida.
- Captura: si solo queda un bando y tiene unidad con `captures` → provincia ocupada
  (producción 25% para el ocupante, dueño original conserva reclamación).

## 7. IA de los bots (cada país no-jugador, evaluada cada 6 h de juego)

1. **Economía**: 1 edificio a la vez por provincia; prioridad: reclutamiento si
   le falta mano de obra, industria si sus suministros < 48h de consumo, fortaleza
   en provincias fronterizas en guerra.
2. **Ejército**: objetivo de tamaño = `3 × provincias + amenaza`; elige tipo según
   composición enemiga (anti-tanque si el enemigo tiene MBTs, etc.).
3. **Guerra**: declara al vecino más débil si `poder propio > 1.4 × suyo` con
   probabilidad `agresión` (0.2–0.7 por personalidad), máx. 1 guerra activa y
   cooldown de 3 días. No declara al jugador en los primeros 2 días de partida.
4. **Operaciones**: defiende provincias fronterizas en guerra (1–2 unidades);
   concentra en el punto más débil del enemigo y ataca con superioridad local ≥ 1.3.
5. **Paz**: si perdió > 40% de sus provincias o su poder < 40% del enemigo,
   propone/acepta paz. El jugador puede proponer paz (la IA responde según war-score).

## 8. Victoria / derrota

- **Victoria**: controlar ≥ 55% de los VP totales de América.
- **Derrota**: perder todas las provincias.
- Pantalla final con estadísticas (provincias, unidades perdidas, días de guerra).

## 9. Tiempo y ritmo

- Tick de simulación cada 250 ms reales. Velocidades: pausa / 1× / 2× / 4×.
- 1× = 15 minutos de juego por tick → 1 día de juego ≈ 96 s reales.
- Movimiento por provincia: horas de juego según distancia real y velocidad de la
  unidad (estrechos ×2). Batallas: 1–2 días de juego. Reclutamiento: 12–36 h.
- Fecha de juego arranca 2026-01-01.

## 10. UX (en español)

- **Inicio**: título + mapa neutro; clic en país → ficha (provincias, población,
  ejército, agresión de vecinos) → botón "Jugar como X". Botón "Continuar" si hay guardado.
- **Partida**: barra superior (país, recursos con flujo/h, fecha, velocidad, menú);
  panel izquierdo de provincia (dueño, terreno, población, VP, producción,
  edificios con botones, guarnición con fila por unidad y botón Mover);
  clic en provincia objetivo para trazar ruta (se dibuja con flechas);
  registro de eventos a la derecha; modales de paz y fin de partida.
- Seleccionar provincia extranjera muestra su país + botones Declarar guerra /
  Proponer paz (si en guerra).
- Guardado: automático cada 2 min + manual (localStorage) + exportar/importar JSON.
