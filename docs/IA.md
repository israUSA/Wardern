# IA de los bots

Cómo deciden los países que no maneja el jugador. Código en
[`js/engine/ai.js`](../js/engine/ai.js); perfiles en
[`js/data/personalities-data.js`](../js/data/personalities-data.js).

## El ciclo

Cada `AI_CHECK_HOURS` horas de juego, cada bot pasa por seis decisiones, siempre
en este orden y siempre mirando por **su propia niebla de guerra**
(`intelFor`, ver `RECONOCIMIENTO.md`):

| Paso | Función | Qué decide |
|---|---|---|
| 1 | `aiEconomy` | edificios, anexiones y cuántas tropas reclutar |
| 2 | `aiResearch` | cuándo investigar el siguiente tier |
| 3 | `aiMilitary` | guarniciones de frontera y asaltos |
| 4 | `aiMissiles` | golpes con misiles |
| 5 | `aiAirCombat` | disparos guiados de su aviación |
| 6 | `aiDiplomacy` | declarar la guerra y pedir la paz |

Entre el 3 y el 4 va `aiNaval` ([`js/engine/ai-naval.js`](../js/engine/ai-naval.js)),
que mueve la flota; y al final de `aiEconomy`, `aiNavalRecruit`, que la recluta.
Ver **Marina** más abajo.

## Personalidades

Cada bot recibe **un carácter al azar al empezar la partida**. Venezuela puede
salir conquistadora en una partida y tortuga en la siguiente: el carácter no va
atado a la bandera. Se guarda en `state.countries[iso].personality`, viaja con
el guardado y no cambia a mitad de partida. Las partidas guardadas antes de que
existiera lo sortean al cargarse, la primera vez que la IA lo consulta.

El jugador lo ve en el panel de **Diplomacia** de cualquier provincia extranjera.
Es su postura pública, no un secreto militar, y saber quién tienes al lado es
parte de la partida.

| Carácter | Probabilidad | Cómo juega |
|---|---|---|
| ⚖ Equilibrado | 28 % | La IA de siempre, sin manías |
| ⚔ Conquistador | 18 % | Ejército grande y acorazado, guerras tempranas, no firma la paz |
| 🛡 Tortuga | 18 % | Fortifica la frontera **también en paz**, casi nunca ataca, pide la paz enseguida; mucho antiaéreo y artillería |
| 🏭 Industrial | 18 % | Industria a nivel 3, investiga antes, ejército corto en paz que crece mucho en guerra; mucha aviación |
| 🦊 Oportunista | 18 % | Ve más débil al vecino que ya está en otra guerra y se le echa encima; tropas rápidas; firma si se tuerce |
| ⚓ Almirante | 18 % **solo con costa** | Puerto nivel 3, flota grande de destructores y submarinos, portaviones si puede pagarlos |

El Almirante solo entra en el sorteo de los países con salida al mar
(`coastalOnly`). Bolivia y Paraguay no pueden sacarlo nunca: para ellos las
probabilidades son las de la tabla sin esa fila (Equilibrado 28/100 = 28 %, el
resto 18 %); para un país con costa, cada peso sobre 1,18 (Almirante ≈ 15 %).

### Qué toca cada peso

| Peso | Dónde se lee | Efecto |
|---|---|---|
| `aggression` | `aiDiplomacy` | probabilidad de buscar guerra en cada chequeo (× dificultad × 0,12) |
| `warRatio` | `aiDiplomacy` | cuánto más fuerte tiene que **creerse** para declararla |
| `preyOnWar` | `aiDiplomacy` | multiplica ese ratio contra un vecino que ya está en guerra |
| `attackRatio` | `aiMilitary` | superioridad local que exige para asaltar una provincia |
| `armyPeace` / `armyWar` | `aiEconomy` | tamaño del ejército objetivo |
| `industry` | `aiEconomy` | nivel de industria al que lleva cada provincia |
| `fortWar` / `fortPeace` | `aiEconomy` | nivel de fortaleza en el frente / en la frontera en paz |
| `research` | `aiResearch` | colchón de dinero que exige para investigar |
| `counter` | `chooseUnitType` | probabilidad de reaccionar a la obra enemiga vista |
| `peacePower` / `peaceLand` / `longWarDays` | `aiDiplomacy`, `aiRespondPeace` | cuándo se rinde a la evidencia |
| `mix` | `chooseUnitType` | multiplicadores sobre el reparto de tropas por categoría |
| `navy` | `aiNavalRecruit` | probabilidad de intentar un barco en cada chequeo; también fija el tope de flota |
| `portLevel` | `aiEconomy` | nivel de puerto al que aspira (nunca por encima de su tier) |
| `navyMix` | `pickNavalCategory` | multiplicadores sobre el reparto de barcos por clase |

Los pesos de `equilibrado` son los valores fijos que usaba la IA antes. La
única diferencia es la agresión, que antes era un número por país en
`countries-data.js` —repartido sin criterio: Canadá 0,63, Haití 0,63, EEUU
0,60— y que ya no se lee.

### Medido

Con `tools/bench-ia.mjs`: todos los bots forzados al mismo carácter, 20 días de
juego, 2 semillas, contando lo **reclutado** (no lo que sobrevive).

| Carácter | Guerras | Tropas reclutadas | Fortaleza media | Industria media | Infantería | Carros | Motorizada | Aviación |
|---|---|---|---|---|---|---|---|---|
| ⚖ Equilibrado | 16 | 203 | 1,34 | 0,94 | 57 % | 7 % | 17 % | 8 % |
| ⚔ Conquistador | **20** | **284** | 0,99 | 0,79 | 47 % | **11 %** | 20 % | 11 % |
| 🛡 Tortuga | **6** | 209 | **1,65** | 0,69 | 71 % | 3 % | 8 % | 5 % |
| 🏭 Industrial | 11,5 | **150** | 1,17 | **1,07** | 44 % | 11 % | 16 % | **13 %** |
| 🦊 Oportunista | 16,5 | 208 | 0,99 | 0,83 | 51 % | 5 % | **26 %** | 6 % |

Cómo leerla:

- El oportunista declara tantas guerras como el equilibrado **porque en el banco
  todos son oportunistas**: su ventaja es relativa (se lanza sobre el que ya está
  ocupado) y solo se ve en una partida mezclada.
- El industrial recluta poco porque en paz mantiene un ejército corto
  (`armyPeace` 0,75); a cambio es el que más industria y aviación tiene.
- **La investigación no se diferencia en 20 días**: ningún carácter pasa en
  promedio de tier 1,1. El colchón del industrial (`research` 0,9) solo se
  notará en partidas largas.

### El ahorro, y por qué hizo falta

La primera medición salió con **todos** los caracteres reclutando un 64–80 % de
infantería: el conquistador pedía carros con peso ~30 % y le salía un 3 %. Los
bots no ahorraban. Un carro cuesta 56.000 y un fusilero 14.000: antes de juntar
para el carro, el dinero ya se había ido en infantería.

Ahora, si la tropa elegida no se puede pagar, el bot la guarda en
`c.aiSaving` y la intenta primero en el chequeo siguiente, sin gastar en otra
cosa mientras tanto. Caduca a los `AI_SAVE_CHECKS` (12) chequeos para que una
elección imposible no le congele.

Consecuencia para **todos** los bots, equilibrados incluidos: menos unidades y
más pesadas (equilibrado: 220 → 203 tropas, carros 1 % → 7 %).

De paso se arregló otro corte: si salía un avión y la primera provincia de la
lista no tenía pista, se cancelaba el reclutamiento de todo el chequeo. Ahora se
busca una provincia que sí la tenga.

## Marina

[`js/engine/ai-naval.js`](../js/engine/ai-naval.js). Solo actúa en países con
salida al mar: sin provincia costera no hay puerto, y sin puerto no hay barcos.

### Puerto

Uno solo, en su **base naval**: la capital si da al mar, si no la costera más
poblada. Un puerto grande en vez de muchos pequeños, porque el nivel es lo que
desbloquea los barcos de tier 2 y 3. Nivel objetivo `portLevel`, limitado por su
tier. Umbral de caja `60.000 × (1 − navy)`: cuanto más marino, antes lo empieza.

Con `navy ≥ AI_NAVY_PRIORITY` (0,2, solo el Almirante) el puerto va **el primero**
de la lista de obras, y si le faltan suministros para la obra **los compra**
(ver Mercado). Medido sin lo primero: 1 barco en 8 días, porque la base suele
ser la capital, que es la provincia con más obras en cola. Sin lo segundo,
Venezuela, Chile y Perú no llegaban a tener puerto: les sobraba dinero y el
mantenimiento les dejaba sin los 2.000 de suministros de la obra.

### Reclutamiento

- **Presupuesto propio.** Un intento por chequeo con probabilidad `navy`, fuera de
  los turnos del ejército de tierra. Si compitiera por ellos, un bot que ya tiene
  los soldados que quiere no reclutaría nada (medido: EEUU almirante con 649.000 en
  caja y ningún barco).
- **Tope** `ceil(provincias × navy × 1,5) + 1`, contando los que están en grada.
- **Clase** por `BASE_MIX` × `navyMix` (corbeta 0,3 · fragata 0,3 · destructor 0,25
  · submarino 0,1 · portaviones 0,05). El submarino pesa ×1,5 en Oriente, que es su
  arma naval fuerte. **Sin transportes**: no hay IA de desembarco.
- **Mercado.** Si el barco elegido no se puede pagar, compra en el mercado los
  suministros y el combustible que faltan, siempre que le quede
  `AI_MARKET_MARGIN` (1,5) veces el gasto en caja. Los bots se quedan sin
  suministros —se los come el mantenimiento— mientras el dinero se les acumula:
  sin esto el 96 % de sus barcos eran corbetas. La compra es solo para ESE barco.
- **Esperar.** Si ni comprando le llega: con menos de `AI_NAVY_STARTER` (2) barcos
  se conforma con lo más barato (comprando también si hace falta); con más,
  espera al que quiere. Conformarse siempre llenaba los puertos de corbetas.

### Maniobra (solo en guerra)

1. **Flota enemiga a la vista** (su niebla) a menos de `AI_NAVAL_RANGE_KM`
   (3.000 km) y más débil que la suya × `attackRatio` → van todas las libres, hasta
   `AI_NAVAL_GROUP` (8), a la más cercana.
2. **Si no ve ninguna** y lleva destructores con misil de crucero (tier 2+), se
   acerca a la celda de mar pegada a la costa enemiga más cercana, salvo que ya la
   tenga a tiro (80 % del alcance) o esté fuera de los 3.000 km. Los Tomahawk los
   dispara `aiMissiles`, no esto.
3. Una flota de corbetas sin misil no se acerca a ninguna costa: solo se ofrecería a
   la aviación enemiga.

`aiMilitary` ya no ve los barcos: un `findPath` de un barco a una provincia de
tierra falla, pero después de recorrer las 25.000 celdas de mar.

Probado en `tools/test-naval.mjs` §7 (18 aserciones).

### Medido

Los nueve países grandes con costa, 16 días de juego, dos partidas; el resto de
bots con costa del mismo carácter. Una letra por barco: **c**orbeta,
**f**ragata, **d**estructor, **s**ubmarino.

| País | ⚖ Equilibrado | ⚓ Almirante |
|---|---|---|
| EEUU | `csfddc` · `ccfcfff` | `cfcsfdcdfffdf` · `cccfddcfcff` |
| Brasil | `cccfcc` · `ccdcff` | `cccfccfcccfff` · `cccccdcdcfc` |
| México | `fcf` · `dcdf` | `cccfccff` · `ccfc` |
| Argentina | `cfc` · `cccc` | `cccccc` · `cccfcc` |
| Canadá | `cc` · — | `ccfc` · `cccc` |
| Colombia | `ff` · `c` | `ccf` · `fc` |
| Venezuela | — · `ffc` | `ccccc` · `cccf` |
| Chile | — · — | `cc` · `c` |
| Perú | — · `c` | `cccc` · `ccc` |

El almirante saca **entre 1,5 y 2 veces más barcos** y ningún país grande se queda
sin flota. Lo que **no** consigue en 16 días es una flota pesada: con tier 1 y la
economía de un bot, la mayoría siguen siendo corbetas y fragatas; los
destructores aparecen en EEUU y Brasil, y los portaviones no salen en ninguno.
Los países pequeños (Jamaica, Belice, Bahamas…) apenas tienen barcos sea cual
sea su carácter: no les da la caja, y es lo razonable.

### Lo que no hace (todavía)

- **Desembarcos.** Los transportes existen para el jugador; una invasión anfibia
  bien hecha es otra IA entera.
- **Escoltas y patrullas.** La flota va en bloque y en paz no sale de casa.
- **El carácter no cambia con la partida.** Un conquistador que pierde medio
  país sigue siendo conquistador; solo le frena `peacePower` / `peaceLand`.
- **No forma coaliciones.** Eso es v2.
