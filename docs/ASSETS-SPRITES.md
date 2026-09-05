# Inventario de sprites — Wardern

## Formato (importante si se rehacen fuera)
- **Formato: SVG** (vector), `viewBox="0 0 128 128"`, vista superior con **morro/proa hacia ARRIBA (norte)**.
- Deben declarar clases CSS internas para el tinte por país:
  - Tintibles (cubren fuselaje/casco/chasis): `.base{fill:#7c8464}` `.shade{fill:#5b6349}` `.light{fill:#9aa378}` `.hi{fill:#b8bfa2}`
  - Fijas: `.dark{fill:#3d4232}`, aceros `.metal`/`.metalS`/`.metalL`, cristal `.glass{fill:#7fa8c9}`, caucho `.rubber{fill:#2b2e28}`
- Las capas de luz/sombra solo blanco/negro con opacity (nunca fill de color): el tinte por país sobreescribe las clases tintables.
- Sin `<text>`, sin fuentes, sin scripts, sin referencias externas. Ids de gradientes/filtros únicos por archivo.
- Si se rehacen en otro formato (p. ej. PNG 512×512 con fondo transparente), avísame y adapto el cargador en un momento.

## Unidades — 96 sprites por variante
Archivo = `assets/sprites/v-{id}.svg`. Si falta, el juego usa el sprite de la categoría (fallback automático).

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
