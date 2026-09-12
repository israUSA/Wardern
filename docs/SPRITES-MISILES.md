# Sprites de misiles

Estado del arte de los **26 proyectiles que vuelan** en el mapa (25 armas del
arsenal + el obús de artillería). Una lista para ir tachando, no una
especificacion: el motor no depende de la forma de ningun dibujo, solo de que el
archivo exista con su nombre.

## Como va la cosa

**26 de 26 hechos.** Ya no hay ningun proyectil heredando la silueta de otro:
cada arma tiene su propio archivo dibujado.

Lo unico que queda es opcional: repasar las cuatro siluetas de la seccion 2, que
funcionan y se distinguen entre si, pero son arte base sin el nivel de detalle
de la seccion 1.

## Como funciona

- **Un archivo por arma**, siempre: `assets/sprites/m-<id>.svg`. El `<id>` es el
  del arma en [`js/data/air-combat-data.js`](../js/data/air-combat-data.js) o
  [`js/data/missiles-data.js`](../js/data/missiles-data.js); el `obus` lo genera
  la pieza al disparar ([`js/engine/artillery.js`](../js/engine/artillery.js)).
- Todo el mapeo vive en `proyectiles` de
  [`js/data/sprites.js`](../js/data/sprites.js). **Estan los 26 enganchados**:
  para mejorar uno basta con sobrescribir su SVG, no hay que tocar codigo.
- **Convencion: morro hacia ARRIBA (norte)**, lienzo `viewBox="0 0 32 64"`. El
  render gira el sprite al rumbo del misil.
- **Si dibujas uno apuntando a otro lado, hay que declararlo** en `rotProyectil`
  (`js/data/sprites.js`) con los grados que le faltan para mirar al norte. Es la
  situacion del Tomahawk: esta dibujado apuntando a la DERECHA, en lienzo
  apaisado `64x32`, y lleva `tomahawk: -90`. Funciona, pero es una excepcion que
  hay que recordar. **Lo comodo es dibujar siempre con el morro arriba.**
- La proporcion del lienzo si se respeta: el render mide el lado largo del
  sprite y saca el corto de la proporcion del propio SVG, asi que un dibujo
  apaisado no se aplasta.
- Sin tinte por pais — un misil es del color de su fabricante, no de quien lo
  dispara.
- `generico` y `aire` (`m-misil.svg` y `m-aire.svg`) siguen ahi como respaldo por
  si se anade un arma nueva sin archivo. Hoy no los usa nadie.

---

## 1. Hechos — arte propio del proyecto

| | Arma | `id` | Archivo | Ficha | Lo dispara |
|---|---|---|---|---|---|
| [x] | **AIM-9L Sidewinder** | `aim9` | `m-aim9.svg` | IR · 18 km · 55 dmg | F-16A |
| [x] | **AIM-9X Sidewinder** | `aim9x` | `m-aim9x.svg` | IR · 35 km · 55 dmg | F/A-18E, F-22 Raptor |
| [x] | **AIM-7M Sparrow** | `aim7` | `m-aim7.svg` | SARH · 45 km · 65 dmg | **nadie** — ver nota |
| [x] | **R-23 (AA-7 Apex)** | `r23` | `m-r23.svg` | SARH · 35 km · 60 dmg | MiG-23 |
| [x] | **R-27 (AA-10 Alamo)** | `r27` | `m-r27.svg` | SARH · 70 km · 65 dmg | Su-27 |
| [x] | **R-60 (AA-8 Aphid)** | `r60` | `m-r60.svg` | IR · 8 km · 40 dmg | MiG-23 |
| [x] | **R-73 (AA-11 Archer)** | `r73` | `m-r73.svg` | IR · 30 km · 55 dmg | Su-27, Su-57 |
| [x] | **AIM-92 Stinger** | `stinger` | `m-stinger.svg` | IR · 8 km · 40 dmg | AH-64E Guardian |
| [x] | **Igla-V** | `igla` | `m-igla.svg` | IR · 8 km · 40 dmg | Mi-28NM |
| [x] | **Kh-25ML** | `kh25` | `m-kh25.svg` | laser · 20 km · 45 dmg | Su-27, Tu-22M2, Tu-160M |
| [x] | **Kh-31P** | `kh31p` | `m-kh31p.svg` | antirradar · 110 km · 60 dmg | Su-57, Tu-22M3, Tu-160M |
| [x] | **AGM-65 Maverick** | `agm65` | `m-agm65.svg` | EO · 25 km · 45 dmg | F-16A, F/A-18E, B-52G, B-21 Raider |
| [x] | **AGM-88 HARM** | `agm88` | `m-agm88.svg` | antirradar · 100 km · 60 dmg | F/A-18E, B-2 Spirit, B-21 Raider |
| [x] | **AGM-114 Hellfire** | `hellfireL` | `m-hellfireL.svg` | laser · 8 km · 40 dmg | AH-64 Apache, AH-64E Guardian, MQ-9 Reaper |
| [x] | **Crucero naval (Tomahawk / Kalibr)** | `tomahawk` | `m-tomahawk.svg` | 1.200 km · 15 dmg | USS Arleigh Burke, Udaloy (Proy. 1155), USS Zumwalt, Lider (Proy. 23560) |
| [x] | **Antibuque (Harpoon / Kh-35)** | `harpoon` | `m-harpoon.svg` | 450 km · 25 dmg | USS Constellation, Proyecto 22350M |
| [x] | **Crucero aéreo (JASSM / Kh-101)** | `jassm` | `m-jassm.svg` | 1.000 km · 12 dmg | B-21 Raider, Tu-160M |
| [x] | **GBU-31 JDAM** | `gbu` | `m-gbu.svg` | GPS · 25 km · 35 dmg | F-22 Raptor, F-35A Lightning II, B-52G, B-2 Spirit, B-21 Raider |
| [x] | **KAB-500S** | `kab` | `m-kab.svg` | GPS · 20 km · 35 dmg | Tu-22M2, Tu-22M3, Tu-160M |
| [x] | **BGM-71 TOW** | `tow` | `m-tow.svg` | alambre · 4 km · 35 dmg | AH-1F Cobra |
| [x] | **9M120 Ataka** | `ataka` | `m-ataka.svg` | radio · 8 km · 40 dmg | Mi-28N, Mi-28NM, Orion |
| [x] | **9M114 Shturm** | `shturm` | `m-shturm.svg` | radio · 5 km · 35 dmg | Mi-24D |

## 2. Hechos — arte base diferenciado

Siluetas con un rasgo que no comparten con nadie (el AMRAAM sin alas grandes, la
rejilla del R-77). Funcionan; repasarlas es opcional.

| | Arma | `id` | Archivo | Ficha | Lo dispara |
|---|---|---|---|---|---|
| [x] | **AIM-120C AMRAAM** | `aim120` | `m-aim120.svg` | activo · 105 km · 70 dmg | F/A-18E, F-22 Raptor, F-35A Lightning II |
| [x] | **R-77 (AA-12 Adder)** | `r77` | `m-r77.svg` | activo · 110 km · 70 dmg | Su-57 |
| [x] | **Salva de cohetes (HIMARS / Smerch)** | `mlrs` | `m-mlrs.svg` | 800 km · 8 dmg | M109A6 Paladin, 2S19 Msta-S, M1299 ERCA, 2S35 Koalitsiya |
| [x] | **Salva de obús** | `obus` | `m-obus.svg` | artillería · 9/13/18 dmg | M109A2, Paladin, ERCA, D-30, Msta-S, Koalitsiya |

> El `obus` esta en esta seccion, y no en la 1, porque su archivo sigue siendo el
> dibujo corto original (34 lineas frente a las ~140 de los demas). La silueta es
> suya y no la comparte con nadie —corto, gordo, sin aletas ni llama, banda de
> cobre al culote—, asi que cumple y se distingue de un misil de un vistazo. Si
> alguna vez se repasa el arte, es el candidato obvio.

> **`aim7` (AIM-7M Sparrow) no lo lleva ningun avion.** Esta definido en
> `air-combat-data.js` y tiene su arte, pero ningun `AIR_LOADOUTS` lo incluye,
> asi que hoy no se dispara nunca y su sprite no llega a verse. El hueco natural
> es el MiG-23, que ya lleva su equivalente R-23; tambien le daria al F-16A el
> alcance medio que le falta frente al MiG.

## Rasgo de cada familia

Por si se quiere respetar la diferencia visual al redibujar:

| Familia | Rasgo que la separa del resto |
|---|---|
| Sidewinder | delgado, aletas en cruz, morro de cristal |
| IR oriental | canards pegados al morro, tono verde oliva |
| MANPADS | el mas pequeno del juego, tubo corto y romo |
| Radar semiactivo | **alas delta grandes** a media panza |
| AMRAAM | largo y limpio, **sin** alas grandes |
| R-77 | **aletas de rejilla** traseras |
| Aire-suelo pesado | cuerpo gordo, morro romo con ventana del buscador |
| Antirradar | dardo de morro afiladisimo, tomas de aire laterales |
| Bomba guiada | **sin motor** (sin llama), cuerpo en gota, kit de cola |
| Anticarro ligero | tubo corto de helicoptero |
| Crucero | fuselaje tubular con alas desplegables |
| Obus | corto y gordo, **sin aletas ni llama**, banda de cobre al culote |

## Efectos

| | Que es | Archivo |
|---|---|---|
| `[x]` | Explosion de impacto (un fotograma que el render escala y desvanece) | `fx-explosion.svg` |
