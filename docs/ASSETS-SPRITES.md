# Inventario de sprites — Wardern

## Cómo se lee el nombre de un archivo

```
v-occ-3-caza.svg
│  │   │  └── categoría (una de las 16)
│  │   └───── tier: 1 = años 80 · 2 = años 2000 · 3 = ultra-moderno
│  └───────── doctrina: occ = Occidental (OTAN) · ori = Oriental (soviético/ruso)
└──────────── prefijo
```

| Prefijo | Qué es | Ejemplo |
|---|---|---|
| `v-` | Sprite **por variante**: el vehículo real concreto | `v-ori-2-mbt.svg` → T-72 |
| `b-` | **Edificio** | `b-aerobase.svg` → base aérea |
| *(ninguno)* | Sprite **genérico de categoría**, usado como respaldo si falta la variante | `caza.svg` |

Así, **`v-ori-2-portaviones.svg`** se lee «variante · oriental · tier 2 ·
portaviones» = el **Kuznetsov (Proyecto 11435)**, que es el portaaviones ruso de
época intermedia. Su equivalente occidental del mismo tier, `v-occ-2-portaviones`,
es el **USS Nimitz**.

Las categorías válidas son las 16 del final de este documento. Las variantes
especiales fuera de la rejilla llevan un sufijo extra (`v-occ-3-caza-f35`), ver
`docs/UNITS.md` → `EXTRA_VARIANTS`.

## Formato de los 21 sprites de categoría, edificios y proyectiles
- **Formato: SVG** (vector), `viewBox="0 0 128 128"`, vista superior con **morro/proa hacia ARRIBA (norte)**.
- Deben declarar clases CSS internas para el tinte por país:
  - Tintibles (cubren fuselaje/casco/chasis): `.base{fill:#7c8464}` `.shade{fill:#5b6349}` `.light{fill:#9aa378}` `.hi{fill:#b8bfa2}`
  - Fijas: `.dark{fill:#3d4232}`, aceros `.metal`/`.metalS`/`.metalL`, cristal `.glass{fill:#7fa8c9}`, caucho `.rubber{fill:#2b2e28}`
- Las capas de luz/sombra solo blanco/negro con opacity (nunca fill de color): el tinte por país sobreescribe las clases tintables.
- Sin `<text>`, sin fuentes, sin scripts, sin referencias externas. Ids de gradientes/filtros únicos por archivo.

## Formato de los 96 sprites por variante (v1.4 — distinto del anterior)
- `viewBox="0 0 256 256"`. Sombreado por **gradientes propios de cada archivo**, sin clases CSS
  tintables: estos 96 **no** responden al tinte por país. La doctrina se lee por paleta.
- Tres cámaras: **aire** cenital con el morro al norte; **tierra** 3/4 de cámara baja
  (acimut 28°, elevación 31°, escala común 20,9 px/m); **mar** 3/4 de cámara alta
  (acimut 28°, elevación 45°, escala por buque y manga exagerada un 40 %).
- Paletas: tierra arena CARC (occ) / verde ruso (ori); mar gris OTAN (occ) / gris ruso (ori);
  submarinos casco negro en ambas doctrinas.
- La cabecera de cada archivo nombra el vehículo real y enumera los rasgos que lo separan de
  sus vecinos de categoría. Ese comentario es la especificación del sprite.
- Detalle completo de proyecciones, paletas y pendientes: **docs/ARTE.md**, sección
  "Convención de los sprites por variante (v1.4)".
- Si se rehacen en otro formato (p. ej. PNG 512×512 con fondo transparente), avísame y adapto el cargador en un momento.

## Unidades — 96 sprites por variante
**Estado: los 96 existen.** Archivo = `assets/sprites/v-{id}.svg`. Si faltara alguno, el juego
usa el sprite de la categoría (fallback automático, reintento cada 5 s).

| Archivo | Categoría | Tier | Vehículo real | Doctrina |
|---|---|---|---|---|
| v-occ-1-infanteria.svg | Infantería | T1 | Infantería M16 | Occ |
| v-occ-2-infanteria.svg | Infantería | T2 | Infantería M4 | Occ |
| v-occ-3-infanteria.svg | Infantería | T3 | Infantería NGSW | Occ |
| v-ori-1-infanteria.svg | Infantería | T1 | Infantería AKM | Ori |
| v-ori-2-infanteria.svg | Infantería | T2 | Infantería AK-74 | Ori |
| v-ori-3-infanteria.svg | Infantería | T3 | Infantería Ratnik | Ori |
| v-occ-1-motorizada.svg | Motorizada | T1 | M113 | Occ |
| v-occ-2-motorizada.svg | Motorizada | T2 | M2 Bradley | Occ |
| v-occ-3-motorizada.svg | Motorizada | T3 | M2A4 Bradley | Occ |
| v-ori-1-motorizada.svg | Motorizada | T1 | BMP-1 | Ori |
| v-ori-2-motorizada.svg | Motorizada | T2 | BMP-2 | Ori |
| v-ori-3-motorizada.svg | Motorizada | T3 | BMP-3 | Ori |
| v-occ-1-mbt.svg | MBT | T1 | M60 Patton | Occ |
| v-occ-2-mbt.svg | MBT | T2 | M1 Abrams | Occ |
| v-occ-3-mbt.svg | MBT | T3 | M1A2 SEPv3 | Occ |
| v-ori-1-mbt.svg | MBT | T1 | T-62 | Ori |
| v-ori-2-mbt.svg | MBT | T2 | T-72 | Ori |
| v-ori-3-mbt.svg | MBT | T3 | T-90M | Ori |
| v-occ-1-cazatanques.svg | Cazatanques | T1 | M901 ITV | Occ |
| v-occ-2-cazatanques.svg | Cazatanques | T2 | M3 Bradley | Occ |
| v-occ-3-cazatanques.svg | Cazatanques | T3 | M3A3 Bradley | Occ |
| v-ori-1-cazatanques.svg | Cazatanques | T1 | BRDM-2 Konkurs | Ori |
| v-ori-2-cazatanques.svg | Cazatanques | T2 | Shturm-S | Ori |
| v-ori-3-cazatanques.svg | Cazatanques | T3 | Kornet-D | Ori |
| v-occ-1-artilleria.svg | Artillería | T1 | M109A2 | Occ |
| v-occ-2-artilleria.svg | Artillería | T2 | M109A6 Paladin | Occ |
| v-occ-3-artilleria.svg | Artillería | T3 | M1299 ERCA | Occ |
| v-ori-1-artilleria.svg | Artillería | T1 | D-30 | Ori |
| v-ori-2-artilleria.svg | Artillería | T2 | 2S19 Msta-S | Ori |
| v-ori-3-artilleria.svg | Artillería | T3 | 2S35 Koalitsiya | Ori |
| v-occ-1-antiaereo.svg | Antiaéreo | T1 | M163 Vulcan | Occ |
| v-occ-2-antiaereo.svg | Antiaéreo | T2 | MIM-104 Patriot | Occ |
| v-occ-3-antiaereo.svg | Antiaéreo | T3 | Patriot PAC-3 | Occ |
| v-ori-1-antiaereo.svg | Antiaéreo | T1 | ZSU-23-4 Shilka | Ori |
| v-ori-2-antiaereo.svg | Antiaéreo | T2 | 9K37 Buk | Ori |
| v-ori-3-antiaereo.svg | Antiaéreo | T3 | S-400 Triumf | Ori |
| v-occ-1-caza.svg | Caza | T1 | F-16A | Occ |
| v-occ-2-caza.svg | Caza | T2 | F/A-18E | Occ |
| v-occ-3-caza.svg | Caza | T3 | F-22 Raptor | Occ |
| v-occ-3-caza-f35.svg | Caza | T3 | F-35A Lightning II | Occ | *PENDIENTE — usa el arte del F-22* |
| v-ori-1-caza.svg | Caza | T1 | MiG-23 | Ori |
| v-ori-2-caza.svg | Caza | T2 | Su-27 | Ori |
| v-ori-3-caza.svg | Caza | T3 | Su-57 | Ori |
| v-occ-1-bombardero.svg | Bombardero | T1 | B-52G | Occ |
| v-occ-2-bombardero.svg | Bombardero | T2 | B-2 Spirit | Occ |
| v-occ-3-bombardero.svg | Bombardero | T3 | B-21 Raider | Occ |
| v-ori-1-bombardero.svg | Bombardero | T1 | Tu-22M2 | Ori |
| v-ori-2-bombardero.svg | Bombardero | T2 | Tu-22M3 | Ori |
| v-ori-3-bombardero.svg | Bombardero | T3 | Tu-160M | Ori |
| v-occ-1-helicoptero.svg | Helicóptero | T1 | AH-1F Cobra | Occ |
| v-occ-2-helicoptero.svg | Helicóptero | T2 | AH-64 Apache | Occ |
| v-occ-3-helicoptero.svg | Helicóptero | T3 | AH-64E Guardian | Occ |
| v-ori-1-helicoptero.svg | Helicóptero | T1 | Mi-24D | Ori |
| v-ori-2-helicoptero.svg | Helicóptero | T2 | Mi-28N | Ori |
| v-ori-3-helicoptero.svg | Helicóptero | T3 | Mi-28NM | Ori |
| v-occ-1-drone.svg | Dron | T1 | RQ-2 Pioneer | Occ |
| v-occ-2-drone.svg | Dron | T2 | RQ-1 Predator | Occ |
| v-occ-3-drone.svg | Dron | T3 | MQ-9 Reaper | Occ |
| v-occ-3-drone-rq190.svg | Dron | T3 | RQ-190 | Occ | *PENDIENTE — usa el arte del MQ-9* |
| v-ori-1-drone.svg | Dron | T1 | Pchela-1T | Ori |
| v-ori-2-drone.svg | Dron | T2 | Orlan-10 | Ori |
| v-ori-3-drone.svg | Dron | T3 | Orion | Ori |
| v-occ-1-corbeta.svg | Corbeta | T1 | USS Cyclone | Occ |
| v-occ-1-fragata.svg | Fragata | T1 | USS Knox | Occ |
| v-occ-1-destructor.svg | Destructor | T1 | USS Spruance | Occ |
| v-occ-1-submarino.svg | Submarino | T1 | USS Los Angeles | Occ |
| v-occ-1-portaviones.svg | Portaviones | T1 | USS Kitty Hawk | Occ |
| v-occ-1-transporte.svg | Transporte | T1 | USS Newport | Occ |
| v-occ-2-corbeta.svg | Corbeta | T2 | USS Independence (LCS) | Occ |
| v-occ-2-fragata.svg | Fragata | T2 | USS Oliver Hazard Perry | Occ |
| v-occ-2-destructor.svg | Destructor | T2 | USS Arleigh Burke | Occ |
| v-occ-2-submarino.svg | Submarino | T2 | USS Virginia | Occ |
| v-occ-2-portaviones.svg | Portaviones | T2 | USS Nimitz | Occ |
| v-occ-2-transporte.svg | Transporte | T2 | USS Whidbey Island | Occ |
| v-occ-3-corbeta.svg | Corbeta | T3 | HMS Visby | Occ |
| v-occ-3-fragata.svg | Fragata | T3 | USS Constellation | Occ |
| v-occ-3-destructor.svg | Destructor | T3 | USS Zumwalt | Occ |
| v-occ-3-submarino.svg | Submarino | T3 | USS Columbia | Occ |
| v-occ-3-portaviones.svg | Portaviones | T3 | USS Gerald R. Ford | Occ |
| v-occ-3-transporte.svg | Transporte | T3 | USS San Antonio | Occ |
| v-ori-1-corbeta.svg | Corbeta | T1 | Pauk (Proy. 1331) | Ori |
| v-ori-1-fragata.svg | Fragata | T1 | Krivak (Proy. 1135) | Ori |
| v-ori-1-destructor.svg | Destructor | T1 | Kashin (Proy. 61) | Ori |
| v-ori-1-submarino.svg | Submarino | T1 | Kilo (Proy. 877) | Ori |
| v-ori-1-portaviones.svg | Portaviones | T1 | Kiev (Proy. 1143) | Ori |
| v-ori-1-transporte.svg | Transporte | T1 | Alligator (Proy. 1171) | Ori |
| v-ori-2-corbeta.svg | Corbeta | T2 | Gepard (Proy. 11661) | Ori |
| v-ori-2-fragata.svg | Fragata | T2 | Almirante Gorshkov | Ori |
| v-ori-2-destructor.svg | Destructor | T2 | Udaloy (Proy. 1155) | Ori |
| v-ori-2-submarino.svg | Submarino | T2 | Akula (Proy. 971) | Ori |
| v-ori-2-portaviones.svg | Portaviones | T2 | Kuznetsov (Proy. 11435) | Ori |
| v-ori-2-transporte.svg | Transporte | T2 | Ivan Rogov | Ori |
| v-ori-3-corbeta.svg | Corbeta | T3 | Steregushchiy (Proy. 20380) | Ori |
| v-ori-3-fragata.svg | Fragata | T3 | Proyecto 22350M | Ori |
| v-ori-3-destructor.svg | Destructor | T3 | Lider (Proy. 23560) | Ori |
| v-ori-3-submarino.svg | Submarino | T3 | Yasen (Proy. 885) | Ori |
| v-ori-3-portaviones.svg | Portaviones | T3 | Shtorm (Proy. 23000) | Ori |
| v-ori-3-transporte.svg | Transporte | T3 | Ivan Gren (Proy. 11711) | Ori |
## 16 sprites de categoría (fallback): assets/sprites/{categoria}.svg
infanteria · motorizada · mbt · cazatanques · artilleria · antiaereo · caza · bombardero · helicoptero · drone · corbeta · fragata · destructor · submarino · portaviones · transporte

## Edificios (5): assets/sprites/b-*.svg
b-puerto · b-aerobase · b-industria · b-reclutamiento · b-fortaleza (mismas clases de tinte)

## Proyectiles (2): assets/sprites/m-*.svg
m-tomahawk · m-hellfire (materiales fijos, SIN clases de tinte: llama y metal)
