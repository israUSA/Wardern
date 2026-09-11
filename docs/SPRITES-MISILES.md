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
- **Convencion: morro hacia ARRIBA (norte).** El render gira el sprite al rumbo
  del misil. La unica excepcion es el Tomahawk, dibujado apuntando a la derecha
  antes de que existiera la regla; lleva su correccion en `rotProyectil`. Si lo
  redibujas con el morro al norte, **borra su linea de `rotProyectil`**.
- Lienzo de referencia: `viewBox="0 0 32 64"`. Sin tinte por pais — un misil es
  del color de su fabricante, no de quien lo dispara.
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
| [x] | **AIM-120C AMRAAM** | `aim120` | `m-aim120.svg` | activo · 105 km · 70 dmg | F/A-18E, F-22 |
| [x] | **R-77 (AA-12 Adder)** | `r77` | `m-r77.svg` | activo · 110 km · 70 dmg | Su-57 |
| [x] | **Salva MLRS** | `mlrs` | `m-mlrs.svg` | 350 km · 8 dmg | Artilleria t2/t3 |

## 2. Pendientes — los que vas a hacer distintos

Los marcaste tu. Tienen archivo propio desde ya, asi que mejorar uno **no toca
a los demas** aunque hoy compartan silueta de partida.

| | Arma | `id` | Archivo | Ficha | Lo dispara |
|---|---|---|---|---|---|
| [ ] | **AGM-65 Maverick** | `agm65` | `m-agm65.svg` | EO · 25 km · 45 dmg | F-16A, F/A-18E |
| [ ] | **AGM-114 Hellfire** | `hellfireL` | `m-hellfireL.svg` | laser · 8 km · 40 dmg | Apache |
| [ ] | **BGM-109 Tomahawk** | `tomahawk` | `m-tomahawk.svg` | 1.200 km · 15 dmg | Destructor t2/t3 |
| [ ] | **Harpoon** | `harpoon` | `m-harpoon.svg` | 450 km · 25 dmg | Fragata t3 |
| [ ] | **Misil de crucero** | `jassm` | `m-jassm.svg` | 1.000 km · 12 dmg | Bombardero t3 |

## 3. Pendientes — heredan silueta de familia

Nacieron con el cuerpo de su familia. Se ven bien en el mapa y se distinguen
entre familias, pero dentro de cada familia todavia son gemelos.

| | Arma | `id` | Archivo | Hereda de | Ficha |
|---|---|---|---|---|---|
| [ ] | **AIM-9L Sidewinder** | `aim9` | `m-aim9.svg` | Sidewinder | IR · 18 km · 55 dmg |
| [ ] | **AIM-9X Sidewinder** | `aim9x` | `m-aim9x.svg` | Sidewinder | IR · 35 km · 55 dmg |
| [ ] | **R-60 (AA-8 Aphid)** | `r60` | `m-r60.svg` | IR oriental | IR · 8 km · 40 dmg |
| [ ] | **R-73 (AA-11 Archer)** | `r73` | `m-r73.svg` | IR oriental | IR · 30 km · 55 dmg |
| [ ] | **AIM-92 Stinger** | `stinger` | `m-stinger.svg` | MANPADS | IR · 8 km · 40 dmg |
| [ ] | **Igla-V** | `igla` | `m-igla.svg` | MANPADS | IR · 8 km · 40 dmg |
| [ ] | **AIM-7M Sparrow** | `aim7` | `m-aim7.svg` | radar semiactivo | SARH · 45 km · 65 dmg |
| [ ] | **R-23 (AA-7 Apex)** | `r23` | `m-r23.svg` | radar semiactivo | SARH · 35 km · 60 dmg |
| [ ] | **R-27 (AA-10 Alamo)** | `r27` | `m-r27.svg` | radar semiactivo | SARH · 70 km · 65 dmg |
| [ ] | **Kh-25ML** | `kh25` | `m-kh25.svg` | aire-suelo pesado | laser · 20 km · 45 dmg |
| [ ] | **AGM-88 HARM** | `agm88` | `m-agm88.svg` | antirradar | antirradar · 100 km · 60 dmg |
| [ ] | **Kh-31P** | `kh31p` | `m-kh31p.svg` | antirradar | antirradar · 110 km · 60 dmg |
| [ ] | **GBU-31 JDAM** | `gbu` | `m-gbu.svg` | bomba guiada | GPS · 25 km · 35 dmg |
| [ ] | **KAB-500S** | `kab` | `m-kab.svg` | bomba guiada | GPS · 20 km · 35 dmg |
| [ ] | **BGM-71 TOW** | `tow` | `m-tow.svg` | anticarro ligero | alambre · 4 km · 35 dmg |
| [ ] | **9M120 Ataka** | `ataka` | `m-ataka.svg` | anticarro ligero | radio · 8 km · 40 dmg |
| [ ] | **9M114 Shturm** | `shturm` | `m-shturm.svg` | anticarro ligero | radio · 5 km · 35 dmg |

---

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

## Efectos

| | Que es | Archivo |
|---|---|---|
| `[x]` | Explosion de impacto (un fotograma que el render escala y desvanece) | `fx-explosion.svg` |
