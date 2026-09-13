# Índice de documentación

Mapa de toda la documentación del proyecto: qué hay en cada archivo y dónde
buscar un tema concreto **sin tener que releerlo todo**.

Si añades o renombras un documento, actualiza este índice.

---

## Los documentos, de un vistazo

| Documento | De qué va | Cuándo abrirlo |
|---|---|---|
| [`../README.md`](../README.md) | Puesta en marcha, cómo jugar, estructura de carpetas, verificaciones | Al empezar, o para levantar el servidor |
| [`GDD.md`](GDD.md) | Documento de diseño: visión, alcance, economía, victoria, ritmo | Para entender **por qué** el juego es como es |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Stack, estructura de módulos, contratos de datos, modelo de simulación, render, guardado | Antes de tocar código nuevo |
| [`UNITS.md`](UNITS.md) | Unidades terrestres y aéreas: ids, doctrinas, tiers, balance, counters, costes | Para tocar balance o añadir una unidad |
| [`NAVAL.md`](NAVAL.md) | Marina: categorías, roles, costes, roster de 36 variantes, mecánicas marítimas | Cualquier cosa de barcos |
| [`AIR-COMBAT.md`](AIR-COMBAT.md) | Radar, cargas de misiles, disparo guiado, furtividad, aviación embarcada, **espacio aéreo y radio de acción** | Cualquier cosa de aviones |
| [`MISSILES.md`](MISSILES.md) | Arsenal de misiles, golpe manual, arma en batalla, drones de reconocimiento | Misiles y drones |
| [`FORMACIONES.md`](FORMACIONES.md) | Unir tropas: dominios, nombres por composición, reglas de mando, tiro a distancia en grupo | Formaciones y pilas |
| [`RECONOCIMIENTO.md`](RECONOCIMIENTO.md) | Quién ve qué: inteligencia fuerte y débil, radios de drones y de vehículos de exploración, por qué las cifras son grandes | Niebla de guerra, visión, descubrir enemigos |
| [`DATA-NOTES.md`](DATA-NOTES.md) | Pipeline del mapa: provincias, vecinos, terreno, población, VP, países | Datos del mapa |
| [`ARTE.md`](ARTE.md) | Guía de estilo de los sprites: paleta, tinte por país, legibilidad, cámaras | Antes de dibujar nada |
| [`ASSETS-SPRITES.md`](ASSETS-SPRITES.md) | Inventario de sprites: convención de nombres, formatos, los 96 por variante | Buscar o añadir un archivo de sprite |
| [`SPRITES-MISILES.md`](SPRITES-MISILES.md) | Arte específico de misiles: familias, rasgos, efectos | Sprites de proyectiles |
| [`ROADMAP.md`](ROADMAP.md) | Qué se ha hecho por versión y qué queda | Estado del proyecto |

---

## Por tema — dónde está cada cosa

### Reglas de juego

| Busco… | Documento | Sección |
|---|---|---|
| Economía, ingresos, mantenimiento | `GDD.md` | 4. Economía |
| Reloj, velocidades, ritmo | `GDD.md` | 9. Tiempo y ritmo |
| Condiciones de victoria | `GDD.md` | 8. Victoria / derrota |
| Niebla de guerra e inteligencia | `RECONOCIMIENTO.md` · `GDD.md` | todo · 6. Niebla de guerra |
| Radio de visión de una unidad | `RECONOCIMIENTO.md` | Radios |
| Ver al enemigo sin declarar la guerra | `RECONOCIMIENTO.md` | Las cuatro fuentes |
| Alcance de tiro de la artillería | `UNITS.md` · `FORMACIONES.md` | Roster · Reglas mecánicas §4 |
| Combate terrestre | `GDD.md` · `UNITS.md` | 6. Combate · Counters |
| IA de los bots | `GDD.md` · `MISSILES.md` · `AIR-COMBAT.md` | cada uno tiene su sección de IA |
| Capturar provincias | `FORMACIONES.md` | Reglas mecánicas §4 |

### Unidades

| Busco… | Documento | Sección |
|---|---|---|
| Ids de unidad (`occ-3-mbt`…) | `UNITS.md` | Variantes: ids, doctrinas y tiers |
| Variantes especiales (RQ-190…) | `UNITS.md` | Variantes especiales |
| Tabla de costes | `UNITS.md` · `NAVAL.md` | Roster / Tabla de costes |
| Quién gana a quién | `UNITS.md` | Counters |
| Puntos de vida de una unidad | `UNITS.md` | Puntos de vida |
| Ventajas de cada doctrina | `UNITS.md` | Sabor de doctrina |
| Nombres reales de los vehículos | `UNITS.md` | Nombres reales por doctrina y época |
| Doctrinas y qué país usa cuál | `UNITS.md` | Doctrinas y países |

### Aire

| Busco… | Documento | Sección |
|---|---|---|
| Alcance de radar, detección | `AIR-COMBAT.md` | 2. Radar |
| Misiles aire-aire y aire-tierra | `AIR-COMBAT.md` | 3. Cargas estándar |
| Probabilidad de derribo | `AIR-COMBAT.md` | 4. Resolución del disparo |
| Furtividad, RCS | `AIR-COMBAT.md` | 9. Furtividad |
| Portaviones y apontaje | `AIR-COMBAT.md` | 10. Aviación embarcada |
| Atacar barcos desde el aire | `AIR-COMBAT.md` | 12. Atacar buques |
| Defensa antiaérea de un buque, CIWS | `AIR-COMBAT.md` | 12. Atacar buques |
| **Radio de acción, sobrevuelo de neutrales** | `AIR-COMBAT.md` | **11. Espacio aéreo libre y radio de acción** |
| Patrulla aérea | `AIR-COMBAT.md` | 11 (patrullar el mar) |
| Visión de los drones | `RECONOCIMIENTO.md` | Radios |
| Qué aparatos entran sin declarar guerra | `AIR-COMBAT.md` | 11 (sobrevuelo libre) |

### Mar

| Busco… | Documento | Sección |
|---|---|---|
| Categorías de buque | `NAVAL.md` | Categorías y roles |
| Balance naval verificado | `NAVAL.md` | Contrarreloj naval |
| Triángulo naval (quién gana a quién) | `NAVAL.md` | Contrarreloj naval |
| Bancos de pruebas | `../README.md` | Verificaciones |
| Reglas de movimiento marítimo | `NAVAL.md` | Mecánicas para el motor |
| Puntos de vida de un buque | `NAVAL.md` | Puntos de vida por buque |
| Antiaéreo e intercepción de misiles | `AIR-COMBAT.md` | 12. Atacar buques |

### Formaciones

| Busco… | Documento | Sección |
|---|---|---|
| Qué se puede unir con qué | `FORMACIONES.md` | Dominios · Condiciones para formar |
| Cómo se llama una formación | `FORMACIONES.md` | Nombres |
| Velocidad, tope, si suma ataque | `FORMACIONES.md` | Reglas mecánicas |
| Desacoplar | `FORMACIONES.md` | Deshacer |

### Mapa y datos

| Busco… | Documento | Sección |
|---|---|---|
| Cuántas provincias hay | `DATA-NOTES.md` | Cifras finales |
| Schema de una provincia | `DATA-NOTES.md` | Schema |
| Terreno y sus efectos | `DATA-NOTES.md` | Terreno |
| Vecinos, estrechos | `DATA-NOTES.md` | Vecinos y conectividad |
| Combustible por país | `DATA-NOTES.md` | Combustible por país |

### Arte

| Busco… | Documento | Sección |
|---|---|---|
| Paleta y tinte por país | `ARTE.md` | Paleta base · Tinte por país |
| Las tres cámaras (aire/tierra/mar) | `ARTE.md` | Convención de los sprites por variante (v1.4) |
| Nombre de archivo de un sprite | `ASSETS-SPRITES.md` | Cómo se lee el nombre |
| Lista de los 96 sprites | `ASSETS-SPRITES.md` | Unidades — 96 sprites por variante |
| Sprites de misiles | `SPRITES-MISILES.md` | todo el documento |

---

## Dónde vive cada sistema en el código

| Sistema | Archivo | Documento |
|---|---|---|
| Orquestador del tick | `js/engine/sim.js` | `ARCHITECTURE.md` |
| Movimiento, pathfinding, radio aéreo | `js/engine/movement.js` | `AIR-COMBAT.md` §11 |
| Combate terrestre y veteranía | `js/engine/combat.js` | `UNITS.md` |
| Radar y disparo aéreo | `js/engine/air-combat.js` | `AIR-COMBAT.md` |
| Misiles | `js/engine/missiles.js` | `MISSILES.md` |
| Formaciones | `js/engine/formations.js` | `FORMACIONES.md` |
| Economía y colas | `js/engine/economy.js` | `GDD.md` §4 |
| Tiro a distancia (artillería) | `js/engine/artillery.js` | `FORMACIONES.md` §4 |
| Estado, inteligencia, reconocimiento | `js/engine/state.js` | `RECONOCIMIENTO.md` |
| IA de los bots | `js/engine/ai.js` | `GDD.md` §7 |
| Constantes de reloj y balance | `js/data/constants.js` | `GDD.md` §9 |
| Dibujo del mapa | `js/render/renderer.js` | `ARCHITECTURE.md` |
| Etiquetas y papel de cada unidad | `js/data/roles-data.js` | — |
| Paneles de interfaz | `js/ui/panels.js` | — |
