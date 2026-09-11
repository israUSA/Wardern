# Sprites de misiles

Estado del arte de los **25 proyectiles que vuelan** en el mapa. Una lista para
ir tachando, no una especificacion: el motor no depende de la forma de ningun
dibujo, solo de que el archivo exista con su nombre.

## Como funciona

- **Un archivo por arma**, siempre: `assets/sprites/m-<id>.svg`. El `<id>` es el
  del arma en [`js/data/air-combat-data.js`](../js/data/air-combat-data.js) o
  [`js/data/missiles-data.js`](../js/data/missiles-data.js).
- Todo el mapeo vive en `proyectiles` de
  [`js/data/sprites.js`](../js/data/sprites.js). **Ya estan los 25 enganchados**:
  para mejorar uno basta con sobrescribir su SVG, no hay que tocar codigo.
- **Convencion: morro hacia ARRIBA (norte)**, lienzo `viewBox="0 0 32 64"`. El
  render gira el sprite al rumbo del misil.
- **Si dibujas uno apuntando a otro lado, hay que declararlo** en `rotProyectil`
  (`js/data/sprites.js`) con los grados que le faltan para mirar al norte. Es la
  situacion del Tomahawk: esta dibujado apuntando a la DERECHA, en lienzo
  apaisado `64x32`, y lleva `tomahawk: -90`. Funciona, pero es una excepcion que
  hay que recordar. **Lo comodo es dibujar siempre con el morro arriba**: asi no
  se toca codigo. Si redibujas el Tomahawk al norte, borra su linea.
- La proporcion del lienzo si se respeta: el render mide el lado largo del
  sprite y saca el corto de la proporcion del propio SVG, asi que un dibujo
  apaisado no se aplasta. Pero cuanto mas se parezca a `32x64`, mas parecido
  sera el tamano en pantalla al del resto.
- Sin tinte por pais — un misil es del color de su fabricante, no de quien lo
  dispara.
- `generico` y `aire` (`m-misil.svg` y `m-aire.svg`) siguen ahi como respaldo por
  si se anade un arma nueva sin archivo. Hoy no los usa nadie.

## Estados

| | Significa |
|---|---|
| `[x]` | Tiene arte propio ya diferenciado. No urge tocarlo. |
| `[ ]` | Pendiente. El archivo existe y se dibuja, pero la silueta es prestada o toca rehacerla. |

---

## El plan corto: 13 dibujos

Pendientes hay **22 archivos**, pero solo **13 dibujos**: 9 de esos 22 son
gemelos dentro de su familia y pueden seguir heredando para siempre sin que se
note (un AIM-9L y un AIM-9X son el mismo tubo en la vida real).

| # | Dibujo | Archivo | Le sirve tambien a |
|---|---|---|---|
| 1 | Sidewinder | `m-aim9.svg` | `aim9x` |
| 2 | IR oriental | `m-r60.svg` | `r73` |
| 3 | MANPADS | `m-stinger.svg` | `igla` |
| 4 | Radar semiactivo | `m-aim7.svg` | `r23`, `r27` |
| 5 | **Maverick** | `m-agm65.svg` | — |
| 6 | Kh-25 | `m-kh25.svg` | — |
| 7 | Antirradar | `m-agm88.svg` | `kh31p` |
| 8 | Bomba guiada | `m-gbu.svg` | `kab` |
| 9 | **Hellfire** | `m-hellfireL.svg` | — |
| 10 | Anticarro ligero | `m-tow.svg` | `ataka`, `shturm` |
| 11 | **Tomahawk** | `m-tomahawk.svg` | — |
| 12 | **Harpoon** | `m-harpoon.svg` | — |
| 13 | **JASSM** | `m-jassm.svg` | — |

En negrita los cinco que van aparte por decision propia. El Maverick y el Kh-25
salen los dos porque al sacar el Maverick de su familia el Kh-25 se queda solo.

**Los 9 gemelos que pueden quedarse asi:** `aim9x` · `r73` · `igla` · `r23` ·
`r27` · `kh31p` · `kab` · `ataka` · `shturm`. Tienen su archivo creado y
funcionando; si algun dia apetece diferenciarlos, ya esta ahi esperando.

Las tablas de abajo son el detalle arma por arma.

---

## 1. Listos

Arte propio, cada uno con un rasgo que no comparte con nadie.

| | Arma | `id` | Archivo | Ficha | Lo dispara |
|---|---|---|---|---|---|
| [x] | **AIM-120C AMRAAM** | `aim120` | `m-aim120.svg` | activo · 105 km · 70 dmg | F/A-18E, F-22 Raptor, F-35A Lightning II |
| [x] | **R-77 (AA-12 Adder)** | `r77` | `m-r77.svg` | activo · 110 km · 70 dmg | Su-57 |
| [x] | **Salva MLRS** | `mlrs` | `m-mlrs.svg` | 350 km · 8 dmg | M109A6 Paladin, 2S19 Msta-S, M1299 ERCA, 2S35 Koalitsiya |

## 2. Pendientes — los que vas a hacer distintos

Los marcaste tu. Tienen archivo propio desde ya, asi que mejorar uno **no toca
a los demas** aunque hoy compartan silueta de partida.

| | Arma | `id` | Archivo | Ficha | Lo dispara |
|---|---|---|---|---|---|
| [ ] | **AGM-65 Maverick** | `agm65` | `m-agm65.svg` | EO · 25 km · 45 dmg | F-16A, F/A-18E, B-52G, B-21 Raider |
| [ ] | **AGM-114 Hellfire** | `hellfireL` | `m-hellfireL.svg` | laser · 8 km · 40 dmg | AH-64 Apache, AH-64E Guardian, MQ-9 Reaper |
| [ ] | **BGM-109 Tomahawk** | `tomahawk` | `m-tomahawk.svg` | 1.200 km · 15 dmg | USS Arleigh Burke, Udaloy (Proy. 1155), USS Zumwalt, Lider (Proy. 23560) |
| [ ] | **Harpoon** | `harpoon` | `m-harpoon.svg` | 450 km · 25 dmg | USS Constellation, Proyecto 22350M |
| [ ] | **Misil de crucero** | `jassm` | `m-jassm.svg` | 1.000 km · 12 dmg | B-21 Raider, Tu-160M |

## 3. Pendientes — heredan silueta de familia

Nacieron con el cuerpo de su familia. Se ven bien en el mapa y se distinguen
entre familias, pero dentro de cada familia todavia son gemelos.

| | Arma | `id` | Archivo | Hereda de | Lo dispara |
|---|---|---|---|---|---|
| [ ] | **AIM-9L Sidewinder** | `aim9` | `m-aim9.svg` | Sidewinder | F-16A |
| [ ] | **AIM-9X Sidewinder** | `aim9x` | `m-aim9x.svg` | Sidewinder | F/A-18E, F-22 Raptor |
| [ ] | **R-60 (AA-8 Aphid)** | `r60` | `m-r60.svg` | IR oriental | MiG-23 |
| [ ] | **R-73 (AA-11 Archer)** | `r73` | `m-r73.svg` | IR oriental | Su-27, Su-57 |
| [ ] | **AIM-92 Stinger** | `stinger` | `m-stinger.svg` | MANPADS | AH-64E Guardian |
| [ ] | **Igla-V** | `igla` | `m-igla.svg` | MANPADS | Mi-28NM |
| [ ] | **AIM-7M Sparrow** | `aim7` | `m-aim7.svg` | radar semiactivo | **nadie** — ver nota |
| [ ] | **R-23 (AA-7 Apex)** | `r23` | `m-r23.svg` | radar semiactivo | MiG-23 |
| [ ] | **R-27 (AA-10 Alamo)** | `r27` | `m-r27.svg` | radar semiactivo | Su-27 |
| [ ] | **Kh-25ML** | `kh25` | `m-kh25.svg` | aire-suelo pesado | Su-27, Tu-22M2, Tu-160M |
| [ ] | **AGM-88 HARM** | `agm88` | `m-agm88.svg` | antirradar | F/A-18E, B-2 Spirit, B-21 Raider |
| [ ] | **Kh-31P** | `kh31p` | `m-kh31p.svg` | antirradar | Su-57, Tu-22M3, Tu-160M |
| [ ] | **GBU-31 JDAM** | `gbu` | `m-gbu.svg` | bomba guiada | F-22 Raptor, F-35A Lightning II, B-52G, B-2 Spirit, B-21 Raider |
| [ ] | **KAB-500S** | `kab` | `m-kab.svg` | bomba guiada | Tu-22M2, Tu-22M3, Tu-160M |
| [ ] | **BGM-71 TOW** | `tow` | `m-tow.svg` | anticarro ligero | AH-1F Cobra |
| [ ] | **9M120 Ataka** | `ataka` | `m-ataka.svg` | anticarro ligero | Mi-28N, Mi-28NM, Orion |
| [ ] | **9M114 Shturm** | `shturm` | `m-shturm.svg` | anticarro ligero | Mi-24D |

---

> **`aim7` (AIM-7M Sparrow) no lo lleva ningun avion.** Esta definido en
> `air-combat-data.js` y tiene su archivo, pero ningun `AIR_LOADOUTS` lo incluye,
> asi que hoy no se dispara nunca y su sprite no llega a verse. O se le da un
> portador (el hueco natural es el MiG-23, que ya lleva su equivalente R-23), o
> se puede dejar como esta a la espera de un avion futuro. Dibujarlo no corre
> ninguna prisa.

## Orden sugerido

Por cuanto se ven en pantalla, no por importancia militar:

1. **`aim9` / `r73`** — los IR cortos son los que mas se disparan en todo el juego.
2. **`aim120` / `r77`** — ya tienen arte propio, pero son los que mas vuelan.
3. **`agm65` / `kh25`** — anticarro: se ven justo donde miras el mapa.
4. **`gbu` / `kab`** — bombas guiadas, silueta muy distinta, se nota mucho.
5. El resto, a gusto.

## Rasgo de cada familia

Por si quieres respetar la diferencia visual al redibujar:

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

## Fuera del arsenal: el obús

No es un arma de `missiles-data.js` ni de `air-combat-data.js`: lo genera la
propia pieza de artillería al disparar con ⚔ Atacar
(`js/engine/artillery.js`). Vuela y se dibuja como cualquier proyectil.

| | Que es | Archivo | Lo dispara |
|---|---|---|---|
| [ ] | Salva de obus | `m-obus.svg` | M109A2, Paladin, ERCA, D-30, Msta-S, Koalitsiya |

Silueta a proposito distinta de un misil: corto, gordo, **sin aletas ni llama**
—no se guia ni se propulsa— con la banda de cobre del culote como seña.

## Efectos

| | Que es | Archivo |
|---|---|---|
| `[x]` | Explosion de impacto (un fotograma que el render escala y desvanece) | `fx-explosion.svg` |
