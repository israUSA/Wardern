# Wardern — Unidades y balance militar

> Fuente de verdad: `js/data/units-data.js` — **60 variantes de doctrina × tier**
> (10 categorías × occidental/oriental × 3 tiers) **+ 1 variante especial
> (`EXTRA_VARIANTS`) + 10 alias legacy**, leído por el
> motor tal cual (`ALL_UNITS` en `js/engine/state.js`). Números verificados con
> `node tools/test-variants.mjs`, una réplica EXACTA de la fórmula de
> `js/engine/combat.js` (97 aserciones: R1–R12 en las 6 combinaciones doctrina×tier,
> escalado monótono, competitividad entre doctrinas y smoke E2E del mapa real).

## Variantes: ids, doctrinas y tiers (decisión de diseño)

- **Id de variante**: `occ-{tier}-{categoría}` / `ori-{tier}-{categoría}` (ej.
  `occ-2-mbt` = M1 Abrams, `ori-3-mbt` = T-90M), mismo patrón que el roster naval.
- **Tiers**: 1 = Años 80 · 2 = Años 2000 (ANCLA de balance) · 3 = Ultra-moderno.
- **Escalado como el naval** (`naval-data.js`): t1 ≈ 0.9× stats (redondeo hacia abajo,
  para que ninguna clave IgUALE al ancla) / 0.7× coste · t2 = ancla · t3 ≈ 1.25× stats /
  1.5× coste. `buildHours` ×0.9 (t1) y ×1.2 (t3). `hp` y `speed` CONSTANTES: el tier se
  nota en combate y coste, no en movimiento (mantiene intactos los tiempos verificados
  de marcha, retirada y refuerzos).
- **Tier inicial de los países: 1 (Años 80)**. Razones:
  1. El motor ya inicializaba `researchedTier: 1` en `newGame` — cero cambios de motor.
  2. Progresión completa: 1 día de juego ≈ 24 s a 1×, así que la investigación de t2
     (7 días, 140k$) llega hacia el día 8–12 y la de t3 (10 días, 320k$) hacia el día
     20 de una campaña tipo GDD (sesiones de 30–90 min = decenas de días de juego).
     Empezar en t2 mataría el tier "Años 80" (30 variantes que nunca se verían).
  3. El balance está verificado en los tres tiers (R1–R12 pasan en t1, t2 y t3 para las
     dos doctrinas), así que el arranque en Años 80 no desprotege ningún emparejamiento.
  - Fallbacks alineados: `panels.js` usaba `researchedTier ?? 2` (y `u.tier ?? 2`); ahora
    ambos son `?? 1`, igual que `state.js`, `economy.js` y `ai.js`. Los guardados viejos
    que ya traen `researchedTier` no cambian de comportamiento.
- **Compatibilidad con partidas guardadas (alias legacy)**: las ids planas
  (`"infanteria"`, `"mbt"`, `"caza"`…) siguen resolviendo en `unitDef()` vía
  `LEGACY_UNITS`: copias con los stats legado INTACTOS, sin `doctrine`/`tier` y marcadas
  `legacy: true`. El motor las excluye de `availableVariants`/`doctrineVariants`, así que
  nunca se ofrecen a reclutar (las variantes doctrine×tier las sustituyen), pero las
  unidades de guardados viejos cargan, combaten y pagan mantenimiento exactamente igual.
- **Las matrices `attack`/`defense` se indexan por CATEGORÍA** (las 10 claves
  terrestres/aéreas; las navales añaden las 6 suyas en `naval-data.js`), no por id de
  variante. `combat.js` normaliza el id a `def.category` (las ids legacy ya eran
  categorías: para el roster viejo el comportamiento es bit a bit el mismo). Sin esta
  normalización, cualquier unidad con id de variante recibía daño `NaN`.

## Variantes especiales (`EXTRA_VARIANTS`)

La rejilla genera **una** variante por doctrina y tier, pero la doctrina real no
funciona así: hay tiers donde conviven dos aparatos con papeles distintos y una
fuerza aérea compra los dos. Para eso existe `EXTRA_VARIANTS`, un mapa escrito a
mano que se fusiona en `UNITS` **sin tocar el generador**: `availableVariants`
filtra por categoría, doctrina y tier investigado, no exige unicidad, así que las
variantes extra aparecen junto a la de la rejilla en el reclutamiento.

| Variante | Rejilla | Papel |
|---|---|---|
| `occ-3-caza-f35` — F-35A Lightning II | convive con `occ-3-caza` (F-22 Raptor) | Multirol furtivo: más barato (0,82×), peor contra el aire, mejor contra el suelo, y bahía interna mixta aire-aire + aire-suelo que el Raptor no tiene (ver `docs/AIR-COMBAT.md`) |

Requisitos para añadir una: `id` único, `category` existente, `doctrine`, `tier`,
y el bloque completo de stats (`cost`, `attack`, `defense`, `terrainDefBonus`,
`terrainAtkPenalty`, `buildHours`, `hp: 100`, `speed`, `captures`). Si además es
aeronave, necesita entrada en `AIR_LOADOUTS` y en `SPRITES.variantes`.

## Sabor de doctrina (verificado que no rompe R1–R12)

**Costes idénticos entre doctrinas** (simetría de balance, como en naval). El sabor vive
solo en la matriz de stats, con ±1 sobre el ancla:

- **OCCIDENTAL — "supervivencia y aviónica"** (+defensa, cero cambios de ataque):
  +1 defensa contra el AIRE (caza/bombardero/helicóptero/drone) en las 6 categorías
  terrestres y +1 defensa del caza contra caza (ventaja BVR).
- **ORIENTAL — "contra-fuerza"** (+ataque, cero cambios de defensa): +1 ataque del
  cazatanques y del helicóptero contra blindados, del antiaéreo y del caza contra el
  aire, del bombardero contra personal, de la artillería contra motorizada y del drone
  contra infantería. Las claves de línea (infantería/motorizada/MBT/artillería entre sí)
  quedan SIMÉTRICAS a propósito: los combates de desgaste no los decide la doctrina.
  ⚠️ Lección medida: un +1 del MBT oriental contra artillería le daba el **78%** de los
  combates mixtos (podía snipear el apoyo enemigo, el DPS del stack); se descartó.

**Competitividad medida (t2, réplica exacta del motor)**: en el duelo 1v1 por categoría
entre doctrinas, 9 de 10 acaban en EMPATE técnico y solo `caza` cae del lado oriental
(13 vs 12 con +1 defensa occidental: 0,67 contra 0,64 daño/tick). En los 8 contadores
clásicos, los 4 emparejamientos de doctrina (occ/occ, occ/ori, ori/occ, ori/ori) dan el
mismo ganador: la doctrina no invierte contadores. Stack mixto (4 inf + 2 MBT + 1 art +
1 AA por bando): oriental gana el 52% — paridad.

## Roster del ancla t2 (10 categorías; costes idénticos para ambas doctrinas)

| Categoría | Coste ($/sumin/MO/fuel) | Rel | Horas | Vel | Captura | Rol |
|---|---|---|---|---|---|---|
| Infantería | 20k/1.8k/1.6k/0 | 1 | 12 | 12 | Sí | Línea y captura; aguante en terreno difícil |
| Motorizada | 30k/2.7k/1.2k/0.8k | 1.5 | 18 | 60 | Sí | Explota huecos; pierde todo choque 1v1 |
| Tanque (MBT) | 80k/7.2k/1k/4k | 4 | 36 | 50 | No | Rompe frentes en campo abierto |
| Cazatanques | 50k/4.5k/0.7k/2.5k | 2.5 | 24 | 40 | No | Embosca y destruye blindados |
| Artillería | 60k/5.4k/0.9k/2k | 3 | 24 | 35 | No | Castiga stacks; ×1.5 primeros 12 ticks |
| Antiaéreo | 30k/2.5k/0.4k/1k | 1.5 | 18 | 30 | No | Negación aérea; casi inútil en tierra |
| Caza | 45k/4k/0.3k/3k | 2.25 | 30 | 400 | No | Superioridad aérea |
| Bombardero | 90k/8k/0.5k/6k | 4.5 | 40 | 300 | No | Castigo masivo a tierra sin AA |
| Helicóptero | 55k/5k/0.4k/2.5k | 2.75 | 30 | 120 | No | Cazatanques volador |
| Drone (UAV) | 12k/1k/0.1k/0.5k | 0.6 | 12 | 150 | No | Reconocimiento y hostigamiento barato |

Costes por tier: t1 = 0.7× y t3 = 1.5× de esta tabla (cada componente se redondea:
dinero a 500, sumin/fuel a 100, MO a 50). Ej.: infantería t1 14k/1.3k/1.1k/0, t3
30k/2.7k/2.4k/0.

## Nombres reales por doctrina y época

| Categoría | T1 occ / ori | T2 occ / ori | T3 occ / ori |
|---|---|---|---|
| Infantería | Infantería M16 / Infantería AKM | Infantería M4 / Infantería AK-74 | Infantería NGSW / Infantería Ratnik |
| Motorizada | M113 / BMP-1 | M2 Bradley / BMP-2 | M2A4 Bradley / BMP-3 |
| Tanque (MBT) | M60 Patton / T-62 | M1 Abrams / T-72 | M1A2 SEPv3 / T-90M |
| Cazatanques | M901 ITV / BRDM-2 Konkurs | M3 Bradley / Shturm-S | M3A3 Bradley / Kornet-D |
| Artillería | M109A2 / D-30 | M109A6 Paladin / 2S19 Msta-S | M1299 ERCA / 2S35 Koalitsiya |
| Antiaéreo | M163 Vulcan / ZSU-23-4 Shilka | MIM-104 Patriot / 9K37 Buk | Patriot PAC-3 / S-400 Triumf |
| Caza | F-16A / MiG-23 | F/A-18E / Su-27 | F-22 Raptor / Su-57 |
| Bombardero | B-52G / Tu-22M2 | B-2 Spirit / Tu-22M3 | B-21 Raider / Tu-160M |
| Helicóptero | AH-1F Cobra / Mi-24D | AH-64 Apache / Mi-28N | AH-64E Guardian / Mi-28NM |
| Drone | RQ-2 Pioneer / Pchela-1T | RQ-1 Predator / Orlan-10 | MQ-9 Reaper / Orion |

La UI los muestra con su tier (`T2 · 80.000$ · …`) en el panel de Reclutar; los alias
legacy conservan los nombres genéricos ("Infantería", "Tanque (MBT)") para guardados viejos.

## Counters (duelos 1v1 en llanura, sin fortaleza, verificados por doctrina y tier)

- **Triángulo terrestre**: MBT > Infantería > Cazatanques > MBT.
- **El terreno voltea MBT ↔ Infantería**: la infantería gana en montaña, urbano, bosque y
  selva (bonus defensivo + penalizador del MBT); el MBT gana en llanura, desierto y tundra.
- **Artillería**: gana el duelo de fuego a infantería (×1.5 inicial), motorizada y AA;
  muere contra MBT, cazatanques y cualquier aéreo (atk 0 vs aire). En stacks su valor es
  el fuego concentrado más el bombardeo preparatorio (ver R5).
- **Antiaéreo**: barre el aire — 1 AA vence a 2 cazas (R10) — pero pierde con todo lo
  terrestre salvo la motorizada. Es EL counter de coste del aire; jamás debe quedar solo
  frente a blindados.
- **Aire**: caza > bombardero/drone/helicóptero y todo lo terrestre salvo el AA;
  bombardero arrasa stacks sin AA (R11) pero es presa del caza y del AA; helicóptero >
  MBT/CT (el tanque apenas le hace daño); drone = molestia y ojos. **Un stack terrestre
  puro sin AA es comida del aire.**
- **Motorizada** (R7): pierde los 9 duelos 1v1 a propósito; su valor es velocidad 60 y
  capturar. Nunca la uses como fuerza de choque.
- **Dominancia** (R6): récord de duelos — caza 8/9, bombardero 7/9, helicóptero 6/9,
  MBT, CT y AA 5/9, infantería 4/9, artillería 3/9, drone 2/9, motorizada 0/9.
  Nadie gana a todos: el aire es contraado por AA + caza rival; el MBT por cazatanques;
  la infantería por MBT y artillería.

## Reglas de balance verificadas (`node tools/test-variants.mjs`, réplica exacta de combat.js)

R1–R12 pasan para OCCIDENTAL y ORIENTAL en t1, t2 y t3. Valores medidos en el ancla t2
(occ/ori cuando difieren):

| # | Regla | Resultado |
|---|---|---|
| R1 | MBT vence a infantería en llanura con ≥50% HP | 59,7 HP (ambas doctrinas) ✓ |
| R2 | Infantería vence a MBT en montaña | gana 30/30 con 66,9 HP ✓ |
| R3 | Cazatanques vence a MBT en llanura con ≥50% HP | 80,9 / 81,9 HP ✓ |
| R4 | Infantería vence claramente al cazatanques | 72,8 HP ✓ |
| R5 | 2 art + 4 inf > 6 inf con ventaja clara | 100% victorias; 2,5 vs 0 supervivientes ✓ |
| R6 | Coste ∝ potencia; sin unidad dominante absoluta | máx. caza 8/9; nadie 9/9 ✓ |
| R7 | Motorizada pierde todo choque 1v1 prolongado | 0/9 duelos ✓ |
| R8 | País mediano recluta 2–4 inf/día tras mantenimiento | 2,80/día (suministros limitan) ✓ |
| R9 | 1 caza vs 1 bombardero: caza gana claramente | 90,6 de 100 HP ✓ |
| R10 | 1 antiaéreo ≥ 2 cazas con ventaja de coste | AA gana 100%; 30k vs 90k ✓ |
| R11 | Bombardero vs 5 inf sin AA: castigo claro | 1,93 / 2,13 : 1 en batalla completa ✓ |
| R12 | 5 inf + AA vs 1 bombardero: gana el bando con AA | 100%; pierde 28 de 600 HP ✓ |

Notas de re-medición (mismo motor, harness exacto):
- R11 se acredita con umbral ≥ 1,7:1 en batalla completa hasta la retirada del stack.
  El 2,02:1 publicado antes correspondía a la "ventana de salida" del bombardero (hasta
  que él cae por debajo de 30 HP); ambas lecturas dan castigo aéreo dominante sin AA.
  El ratio BAJA con el tier (t1 ≈ 5,4–6,3:1 → t3 ≈ 1,5–1,7:1) porque la defensa del
  infante escala redondeando al alza: el aire t3 castiga, pero menos.
- R5 deja 2,5 supervivientes (antes se publicaron 3,6 con un harness menos fiel); la
  regla (100% de victorias del bando con artillería) se mantiene holgada.
- R8: 4,38 inf/día en t1 (equipamiento barato) y 1,47 en t3 (élite caro, a propósito).

## Economía y ritmo

- País mediano de referencia: 3.000 $/h, 300 suministros/h, 250 MO/h → 72k$/día.
- Mantenimiento (constantes del motor): 0.6% del coste en $/día en suministros + 2% del
  coste en fuel/día. Stack inicial de 10 unidades ≈ 2.100 suministros/día.
- Con costes t2, tras mantenimiento quedan ~2,8 infanterías/día (los suministros limitan).
  El MBT (80k) equivale a ~1,1 días de dinero: activo de élite.
- Aire: la Base aérea (25k, 4 días) es la puerta de entrada y su NIVEL sigue al tier del
  aparato (nivel 1 = T1, nivel 2 = T2, nivel 3 = T3); el bombardero es la unidad más cara
  de su tier y el drone la más barata.
- Investigación (TIERS, sin cambios): t2 = 140k$ + 14k sumin, 7 días; t3 = 320k$ + 32k
  sumin, 10 días. La IA investiga cuando su tesorería supera 1,3× el coste.

## Doctrinas y países (js/data/doctrines-data.js)

- **Occidental (25 países)**: EEUU, Canadá, México, Centroamérica y Caribe (esfera FMS
  de EEUU), Colombia/Ecuador/Perú/Guyana/Surinam y el Cono Sur (Brasil, Argentina,
  Chile, Uruguay, Paraguay, + Groenlandia). El Cono Sur compra y fabrica occidente
  (Leopard 2 chilenos, Gripen y F-16 brasileños, TAM argentinos): no se inventa una
  tercera doctrina porque el motor soporta dos y su sabor cabe en la occidental.
- **Oriental (4 países)**: Cuba (T-62/BMP/MiG-23), Venezuela (T-72B3, BMP-3, Buk, Su-30),
  Nicaragua (herencia sandinista: T-55, Mi-24) y Bolivia (material chino/ruso).
- Asignación aplicada en `newGame` con fallback "occidental"; verificada en el smoke E2E.

## Rationale de los números clave

- **Artillería**: atk 16 vs infantería (su blanco), 8 vs blindados (no perfora), defense
  6 contra MBT/CT (la aplastan en choque) y 8 vs infantería; atk 0 vs el aire: cualquier
  aéreo la destruye si está desprotegida. `rangedTicks 12` modela el bombardeo preparatorio.
- **Antiaéreo**: atk 26/26/24/22 vs caza/bombardero/helicóptero/drone y 2–9 vs tierra
  (solo incomoda a la motorizada). Defense 9/9/8/8 contra el aire frente a 5–6 terrestre:
  vive para el duelo aéreo y muere en el terrestre.
- **Aire vs tierra**: ataques 3–8 (caza), 12–24 (bombardero), 12–20 (helicóptero), 3–5
  (drone); defensas terrestres contra ellos 4–12 (+1 occidental). El 65% de selección
  hace que en stacks mixtos el terreno se ignore entre sí y el aire se concentre en su blanco.
- **El aire no captura**: el ciclo de conquista exige terrestres; el aire niega, castiga
  y escolta.
- **Por qué los deltas de doctrina son ±1 y solo en claves "cazadoras"**: la defensa
  entra en el suavizado `20/(20+def)` y el ataque en el 65% de focalización; un +1 sobre
  una clave que ya es el blanco preferido es un buff de daño puro (seguro), mientras que
  +1 sobre claves de línea compone ventajas de desgaste (medido: 78% de stacks).

## Perillas de reajuste (si el juego en vivo lo pide)

- Aire abusivo → subir coste de caza/bombardero o bajar su atk terrestre (4 / 24).
- AA intrascendente → subir el `attack` del AA contra el tipo que esté abusando.
- Stacks de infantería eternos → subir artillería.atk vs infantería (16).
- R11 es la regla más ajustada (≈1,9:1): para más castigo aéreo, subir
  bombardero.atk vs infantería/motorizada de 24 a 26–28.
- Una doctrina se siente plana → mover SU delta ±1 en la clave de su identidad
  (occ: defensa contra aire; ori: ataque cazador) y re-correr `tools/test-variants.mjs`.
  NO añadir ataques de línea (inf/MBT/art): comparten matrices a propósito.
- Los deltas de doctrina viven en `DOCTRINE_DELTAS` dentro de `units-data.js`; el test
  los tiene "pinned" en su sección [2] y falla si alguien los cambia sin replicarlos ahí.
