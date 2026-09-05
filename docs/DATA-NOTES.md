# DATA-NOTES — pipeline de datos del mapa (América)

Generado por `tools/build-map.mjs` (Node 25, sin dependencias). Fuentes:
Natural Earth 10m `ne_10m_admin_1_states_provinces.geojson` (40.7 MB) y
`ne_10m_admin_0_countries.geojson` (13.3 MB), cacheadas en `tools/cache/`.
Regenerar: `node tools/build-map.mjs`.

## Cifras finales (build verificado)

| Métrica | Valor |
|---|---|
| Provincias | **270** |
| Países jugables | **29** |
| Pares de vecinos | 678 (media 5.0 vecinos/provincia, máx 11) |
| Estrechos | 11 |
| Componentes conexas del grafo (neighbors+straits) | **1** (270/270 alcanzables) |
| Anillos almacenados | 1.067 (98.786 vértices; máx 400/anillo) |
| Tamaño `js/data/map-data.js` | 1.57 MB (< 6 MB objetivo) |
| Tamaño `js/data/countries-data.js` | ~3 KB |
| Aserciones de terreno | 15/15 OK (fallan el build si cambian) |
| Retención de área por país | ≥ 99.6% en todos (objetivo > 98%) |

Provincias por país: USA 30, CAN 13, MEX 30, GTM 4, BLZ 1, HND 3, SLV 1,
NIC 4, CRI 3, PAN 3, CUB 1, DOM 1, HTI 1, JAM 1, BHS 1, TTO 1, GRL 6,
COL 30, VEN 25, GUY 1, SUR 1, ECU 5, PER 26, BRA 27, BOL 9, PRY 1, CHL 16,
ARG 24, URY 1.

Histograma de terreno: llanura 110, selva 55, montaña 40, desierto 20,
urbano 19, bosque 14, tundra 12.

## Schema

`province.polygon` es un **array de anillos** `[[[lon,lat],…], …]`
(MultiPolygon): las provincias fusionadas conservan **todos** los anillos de
sus piezas y el motor dibuja cada anillo como polígono independiente. Los
anillos van cerrados (primer punto = último), 2 decimales, orden lon/lat.
Resto de campos según `docs/ARCHITECTURE.md` (`id, country, name, polygon,
terrain, pop, capital, prod{money,supplies,fuel,manpower}, vp`).

## Granularidad y fusiones

- Objetivos por país (`TARGET_PROV`): los grandes conservan sus admin-1
  fusionadas hasta el objetivo (USA 52 piezas→30, MEX 33→30, COL 34→30);
  GTM 22→4, HND 18→3, NIC 17→4, PAN 12→3, CRI 7→3, ECU 24→5;
  países pequeños/insulares = 1 provincia (admin-0). Total 270
  (≈ el "objetivo ~250": con los outliers corregidos y BHS/TTO restaurados
  con todo su territorio quedan 270).
- Método: aglomeración voraz, siempre entre piezas **adyacentes** (distancia
  entre polígonos < 0.3°); se absorbe la pieza de menor área en la vecina
  mayor más cercana por centroide. **Nunca se descarta territorio**: la
  fusión concatena todos los anillos (no hay dissolve que recorte).
- Nombre de la región resultante = su **pieza más poblada** (p.ej. la región
  Georgia+Florida se llama "Florida"; Kansas+Oklahoma se llama "Oklahoma";
  Intibucá+… se llama "Cortés"). Lista de fusiones impresa por el script.
- Protegidas contra absorción: capitales, Puerto Rico (estrecho con DOM) y
  Galápagos (provincia propia, estrecho con Guayas).
- Puerto Rico es admin-1 de USA (PRI) → provincia `usa-puerto-rico`.
- 105 fusiones en total; 14 regiones renombradas por pieza más poblada.

## Sin pérdida de territorio

- `keepRings` conserva todos los anillos relevantes; solo descarta islotes
  diminutos (< ~7 km² o < 0.02% del anillo mayor, máx 80 anillos/provincia),
  p.ej. 143 islotes de Alaska, 143 de Nunavut, 63 de British Columbia, 44 de
  Bahamas fuera de sus 36 islas principales, cayeros de Cuba/Florida, etc.
  Cada descarte queda anotado en el log del script.
- 3 features "sin resolver" de NE (`MEX+99?`, `COL+99?`, `VEN+99?` = Arrecife
  Alacranes, Malpelo, Isla Aves) descartadas por islotes oceánicos sin
  población relevante.
- Retención de área medida por país (piezas originales vs anillos de salida):
  mínima CHL 99.6%, resto ≥ 99.7% (la pérdida es solo simplificación DP).

## Vecinos y conectividad

- Adyacencia por **distancia mínima segmento-a-segmento** entre anillos con
  prefilto por bounding box (tolerancia 0.3°, entre provincias de cualquier
  país, fronteras internacionales incluidas). Verificación en el script:
  el grafo neighbors+straits debe tener **una sola componente**; si hay
  varias, se enlaza el par más cercano (por centroide) entre fragmentos con
  un estrecho y se anota. Resultado: 1 componente, 0 provincias sin vecinos.
- Provincias sin vecinos (solo estrecho): `ven-dependencias-federales`
  (estrecho artificial con `ven-nueva-esparta`) y `ecu-galapagos` (con
  `ecu-guayas`). Ninguna otra.
- Estrechos fijos: Cuba↔Florida, Cuba↔Yucatán, Cuba↔Haití (la más cercana de
  La Española, distancia real mínima), DOM↔Puerto Rico, Jamaica↔Haití,
  Bahamas↔Florida, Trinidad↔Delta Amacuro (costera venezolana más cercana,
  0.14°), Terranova↔Nova Scotia, Groenlandia(Qaasuitsup)↔Nunavut.
- Fronteras terrestres obligatorias (34 pares, p.ej. PAN-COL, GTM-BLZ,
  HTI-DOM) verificadas; ninguna necesitó enlace artificial.

## Terreno

Heurística por centroide (cajas en el script), prioridad
`urbano > montaña > desierto > tundra > selva > bosque > llanura`:

- urbano: pop > 8M **y** densidad > 60 hab/km² (excluye a Texas, 44 hab/km²,
  que queda en llanura) y países multi-provincia.
- tundra: lat > 55 o lat < −48.
- desierto: Sonora/Mojave (incl. Nevada), Chihuahua (excluye Texas), Baja
  California, Atacama, Chaco seco, costa peruana.
- selva: Amazonia, Centroamérica tropical, Caribe insular, Chocó, Yucatán.
- montaña: Rocosas, Sierra Madre Occidental, Andes colombianos/venezolanos
  (Antioquia, Bogotá, Mérida), Andes patagónicos, Alaska, Santa Marta,
  Talamanca, Escudo Guayanés, Sierras Pampeanas.
- bosque: boreal (48–55), Apalaches, costa NO de EEUU, sur de Chile, Mata
  Atlántica.
- Aserciones obligatorias: Arizona→desierto, Kansas→llanura, Texas→llanura,
  Colorado→montaña, California→urbano, Nueva York→urbano, Nevada→desierto,
  Puerto Rico→selva, Ontario→bosque, Yukon→tundra, Pará→selva,
  Amazonas(BR)→selva, Antioquia→montaña, Atacama→desierto, Tierra del
  Fuego→tundra.

## Población, producción, VP

- Natural Earth admin-1 **no trae población**: el script lleva tablas reales
  por unidad (censos/estimaciones 2022-2024, ~375 entradas) claveadas por
  nombre NE normalizado; países de 1 provincia usan `POP_EST` de admin-0;
  fallback 300k + corrección si un país suma <20% de su población real
  (no hizo falta escalar ninguno). Sumas por país: USA 338M, MEX 132M,
  BRA 201M (censo 2022), CAN 41M, COL 52M, ARG 46M, VEN 34M, PER 31M…
- Capital: por nombre (pistas normalizadas, p.ej. "Distrito Federal") →
  point-in-polygon con coordenadas de la capital embebidas → fallback
  provincia más poblada (no se usó el fallback). La capital es la **pieza**
  (protegida de fusiones); la región que la contiene queda con
  `capital: true`.
- prod/hora: money = pop/20000, supplies = pop/100000 (+3 si capital),
  fuel = 8 si el centroide cae en zona petrolera (Texas/Golfo, Alaska N,
  Alberta, Golfo MX, Venezuela, Llanos COL, Ecuador Oriente, Perú N, Brasil
  offshore, Bolivia sur, Trinidad toda), 0 si no; manpower = pop/40000.
- vp = pop/300000 (+20 si capital), mínimo 1.

## Países (countries-data.js)

- Nombres en español, colores fijados (los 15 del diseño) + 14 elegidos a
  mano, distintos entre vecinos (COL #e0c040 vs BRA #d9b036 y ECU #d0a030 vs
  COL son los pares más próximos, valores fijados por diseño).
- `aggression`: fija para USA 0.6, MEX 0.35, VEN 0.7, BRA 0.45, CUB 0.6;
  resto 0.2 + hash(nombre)×0.5.
- `capital`: id de provincia-capital (p.ej. `usa-district-of-columbia`,
  `bra-distrito-federal`, `bol-la-paz` — La Paz, sede de gobierno).

## Notas menores

- `bounds`: lon −178.21…−11.38 (Groenlandia oriental incluida), lat
  −55.92…83.63.
- Anillos gigantes (área ≥ 5°² → 240 vértices, ≥ 25°² → 400) permiten más
  detalle para no perder costa (Alaska, Nunavut, Groenlandia, Quebec);
  el resto topa en 120.
- Douglas-Peucker **anclado al vértice más lejano** del anillo: el enfoque
  naïve sobre anillo cerrado colapsa a 2 puntos cuando el span < tolerancia
  (causa de las provincias que faltaban en entregas anteriores).
- BHS conserva 36 anillos (Andros, Abaco, Eleuthera…), TTO 2 (Trinidad y
  Tobago); Cuba 1 provincia con sus 24 anillos mayores (Isla de la Juventud
  incluida).

## Combustible por país (v1.2.1)

`js/data/fuel-data.js` define regiones petroleras reales (Cuenca Pérmica, Athabasca,
Ku-Maloob-Zaap, Maracaibo, Faja del Orinoco, pre-sal brasileño, Vaca Muerta, Stabroek...)
con tasas por hora que SUSTITUYEN al valor genérico del mapa; se aplican en
`initStatic`, así que afecta también a partidas guardadas. Todo país sin región
petrolera (Centroamérica, Caribe insular, Paraguay, Uruguay, Groenlandia) recibe un
productor de seguridad de 15/h en su capital. Los productores ≥10/h se marcan en el
mapa con una gota negra. Totales referenciales: USA ~540/h, CAN ~235/h, VEN ~250/h,
BRA ~240/h, MEX ~185/h, ARG ~160/h.

## Solape de polígonos en el mapa (v1.2.1)

El pipeline de datos dejó solapes (el anillo de `usa-texas` invadía el norte de
México y `can-ontario` llega al medio de los Grandes Lagos, legítimo). Defensas en
runtime, sin regenerar el mapa: `hitProvince` (renderer.js) devuelve el candidato de
MENOR área de bbox entre los que contienen el punto, y el render pinta en
`paintList` (provincias grandes primero, pequeñas encima). Verificado: clic en
Chihuahua/Coahuila ya no selecciona Texas; el color de frontera era correcto porque
México pintaba después.
