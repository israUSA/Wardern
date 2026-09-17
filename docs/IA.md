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

Entre el 2 y el 3 va `aiLanding` ([`js/engine/ai-landing.js`](../js/engine/ai-landing.js)),
que avanza los desembarcos y reserva su tropa antes de que `aiMilitary` la
reparta. Entre el 3 y el 4, `aiNaval` ([`js/engine/ai-naval.js`](../js/engine/ai-naval.js)),
que mueve la flota; y al final de `aiEconomy`, `aiNavalRecruit`, que la recluta.
Ver **Marina** y **Desembarcos** más abajo.

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
| `landings` | `aiLanding` | probabilidad, por chequeo en guerra, de planear un desembarco (tortuga 0, almirante 0,6) |
| `flank` | `planLanding` | desembarca también contra quien tiene frontera con él (solo el almirante) |
| `seaWars` | `aiDiplomacy` | declara la guerra también a países con costa al alcance de sus puertos (solo el almirante) |

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

## Fuego

Los bots disparan **antes** de gastar: el orden del turno es `aiMissiles` y
`aiAirCombat` primero, `aiEconomy` después. Al revés, la economía dejaba los
suministros a cero en cada turno y la salva de obús (que se paga en suministros)
no salía casi nunca.

- **Golpes** (`aiMissiles`): Tomahawk, Harpoon, salva de cohetes y crucero de
  bombardero, contra lo que el bot ve (`vis.union`).
- **Artillería a distancia** (`artilleryTarget` + `shellUnit`): la ficha enemiga de
  tierra más valiosa que tenga **identificada** (`vis.strong`) y a tiro. Una pieza
  con blanco no cuenta como ociosa: `aiMilitary` ni la manda a guarnecer ni al
  asalto (antes hacía las dos cosas y la pieza, en marcha, no disparaba nunca).
- **Aviación** (`aiAirCombat`): aire-aire por radar; aire-suelo solo contra lo que
  su país ve. Antes `groundContacts` solo aplicaba la niebla al jugador y un bot
  disparaba HARM a 400 km contra baterías que no había detectado.

Probado en `tools/test-variants.mjs` §8. `tools/bench-fuego.mjs` cuenta los
disparos de una partida por arma y cuántos fueron a ciegas (debe ser 0).

### Medido

| Partida de 16 días | Antes del reordenado | Ahora |
|---|---|---|
| Salvas de obús | 109 | **208** |
| Maverick | 10 | 2 |
| Disparos a ciegas | 0 | **0** |

El obús casi dobla su fuego: disparar antes de gastar es toda la diferencia,
porque la salva se paga en suministros y la economía los dejaba a cero. Los
Tomahawk no aparecen en ninguna de las dos: en 16 días ningún bot llega a tier 2.
El turno de IA al final de esa partida, con 457 unidades en juego, tiene una
mediana de **216 ms**.

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

- **Patrullas.** En paz la flota no sale de casa.

## Desembarcos

[`js/engine/ai-landing.js`](../js/engine/ai-landing.js). Un desembarco es una
**operación** de varios días guardada en `c.aiLanding`; cada chequeo la avanza
una fase.

### Cuándo

En guerra, con al menos un puerto, con transporte disponible o dinero para él,
con probabilidad `landings` por chequeo, y
solo contra un enemigo **sin ninguna provincia pegada** a su territorio. Pegada
incluye los **estrechos**: el mapa une Cuba con EEUU, México y Haití, y la tropa
los cruza andando, así que "no tener frontera" no es "ser isla" sino estar lejos
(EEUU contra Venezuela, o un bot contra un jugador al otro lado del mar). El
almirante (`flank`) lo intenta también con frontera abierta.

El almirante además **declara la guerra por mar** (`seaWars`): a los candidatos de
siempre —vecinos de tierra— suma los países con costa a menos de
`AI_NAVAL_RANGE_KM` de alguno de sus puertos. Sin esto los bots solo guerrean con
vecinos de tierra y un desembarco casi nunca tendría sentido.

### Fases

| Fase | Qué hace |
|---|---|
| **planear** | Para cada provincia costera enemiga, el puerto propio más cercano (se prueban todos: el de más nivel puede estar en la otra punta). Defensa: la que ve, o `AI_GUESS_PER_PROVINCE` fusileros si no la ve. Se elige la playa más floja y la fuerza mínima que la supere × `attackRatio`, entre `AI_LANDING_MIN` y `AI_LANDING_MAX` (2–6) unidades, **las más cercanas al puerto** y nunca de una provincia en el frente |
| **reunir** | Transportes (uno por cada 3): reutiliza los libres y construye los que falten en el puerto, comprando en el mercado si hace falta. Todos a la celda del puerto; la fuerza, a la provincia del puerto. Cuando están todos, **embarca solo a la fuerza elegida** (`embark(…, soloIds)`), no a la guarnición |
| **navegar** | Transportes a la celda de la playa, con hasta `AI_LANDING_ESCORTS` (3) barcos de guerra de escolta, que llegan antes porque son más rápidos. Al llegar, **desembarca**; el combate lo resuelve el motor |
| **cabeza** | Ya en tierra. La operación **no se cierra**: vigila la cabeza de playa durante `AI_BEACHHEAD_DAYS` (6). Si lo que la rodea la supera × `attackRatio`, sale una **segunda oleada** desde el puerto y se vuelve a "reunir" |
| **regresar** | Si llega la paz, se pasa de `AI_LANDING_MAX_DAYS` (8) o se queda sin tropa, la operación se cancela: lo que va a bordo vuelve al puerto y desembarca en casa |

Al terminar, `AI_LANDING_COOLDOWN_DAYS` (2) días hasta planear otra. Si no
encuentra playa, medio día sin volver a mirar.

### La segunda oleada

Desembarcar y olvidarse era lo que hacía que un desembarco de bot se viera tonto:
tres fichas en una isla, sin nadie detrás, muriéndose solas. Ahora la operación
sigue viva después de pisar la playa.

- La tropa desembarcada **deja de estar reservada** (pasa a `op.landed`): pelea
  como cualquier otra unidad, la manda `aiMilitary`. Lo que sigue vivo es la
  operación, no una correa.
- En cada chequeo se compara lo que queda en la cabeza con lo que la amenaza: la
  fuerza enemiga **en la playa, donde esté la tropa y en todo lo que tengan
  pegado**, con la misma regla de niebla que al planear (lo que no ve, lo supone).
- Mientras aguante sola, no se manda nada. Si no aguanta, la operación vuelve a
  "reunir" con tropa nueva del puerto y estrena plazos.
- **Dos oleadas como mucho** (`AI_LANDING_WAVES`). Sin tope, un bot con puerto se
  pasaba la partida alimentando una isla mientras su frente de tierra se quedaba
  sin tropa.
- Si barren la cabeza antes de que llegue el refuerzo, la operación se cierra: no
  hay nada que reforzar, y volver a asaltar es decisión de un plan nuevo.

La fuerza reservada queda fuera de `aiMilitary`: si no, las guarniciones se la
llevaban de vuelta al frente a medio reunir.

### Medido

Escenario de `tools/test-naval.mjs` §8: EEUU (almirante, puerto en Florida) en
guerra con Venezuela. Planea a las 2 h, construye el transporte y reúne la fuerza
a las 30 h (el transporte tarda 27), navega 48 h y **desembarca en Zulia a las
78 h**.

Partida mixta de 16 días (dos semillas, **antes** de los arreglos de abajo): 22
guerras, 2 de ellas por mar; 3 desembarcos planeados y **ninguno terminado**. La
traza (`tools/diag-desembarcos.mjs`) enseñó cinco atascos, ya corregidos:

- Países sin dinero para el transporte (Guatemala, Dominicana) esperaban días en
  "reunir" con la tropa reservada → ahora solo se planea si el transporte se
  puede pagar (comprando en el mercado si hace falta), y "reunir" caduca a los
  `AI_LANDING_GATHER_DAYS` (3).
- Puertos en el otro océano: la línea recta engañaba → ahora se mide la ruta
  navegada real (`sailHours`, tope `AI_LANDING_SAIL_HOURS` = 72 h), solo para las
  3 mejores playas.
- La vuelta tras cancelar iba siempre al puerto de salida (EEUU tardó 7 días) →
  ahora va a la costa propia más cercana.
- **Las gradas del puerto, ocupadas por el programa naval**: Colombia esperaba en
  "reunir" con dos corbetas en grada y el transporte sin encargar, hasta caducar
  → mientras una operación reúne, `aiNavalRecruit` no toca las gradas de SU
  puerto (ai-naval.js). Es la razón de que en la medición siguiente el transporte
  entre en grada a las pocas horas de planear.
- **`AI_LANDING_GATHER_DAYS` = 3 se quedaba corto**: la operación caducaba con el
  barco recién botado y la columna aún de camino → 5 días.

### Medido tras los arreglos

Cuatro partidas de 16 días (`tools/diag-desembarcos.mjs`, mitad de los costeros
forzados a Almirante): **3 operaciones planeadas, 2 zarparon, 1 desembarcó**, 1 se
canceló al llegar la paz y 1 seguía en curso al acabar la partida. Ningún error de
IA en las cuatro.

La que salió bien, paso a paso: Venezuela planea sobre Jamaica a las **304 h**,
encarga el transporte a las 312, embarca y zarpa a las **336** y **desembarca 3
unidades en Jamaica a las 362 h** — 58 h de principio a fin. La que se canceló
(Colombia sobre Galápagos) hizo lo que debía: firmada la paz a media travesía,
dio media vuelta y desembarcó en casa.

Que solo haya 3 operaciones en 64 días de juego es lo esperado, no un fallo: casi
todas las guerras son con vecinos, y ahí la tropa llega andando. El desembarco es
para el enemigo al que no se puede llegar de otra forma.

**La segunda oleada**, en un escenario a propósito (EEUU almirante contra una
playa venezolana defendida por 4 carros, con la paz bloqueada para que se vea el
ciclo entero): desembarca 2 unidades a las **78 h**, pide refuerzo a las **80 h**
—la playa no aguanta—, zarpa la segunda oleada a las 130 y a las **178 h hay 6
unidades de EEUU en suelo venezolano**. Con las dos oleadas gastadas la operación
se cierra y la guerra sigue por tierra; tras el descanso, el mismo país planeó
otro desembarco en otra provincia. Sin este cambio, la cuenta se quedaba en las 2
primeras y nadie iba detrás.

En partida normal la paz suele llegar antes: en cinco pasadas del mismo escenario
sin bloquearla, Venezuela pidió la paz entre 20 y 50 h después del desembarco y el
refuerzo se canceló a medio camino, que es justo lo que debe pasar.

### Lo que no hace (todavía)

- **Una operación a la vez** por país, de 6 unidades como mucho.
- **No elige la playa por su valor** (capital, puntos de victoria): solo por lo
  floja que está y lo cerca que queda.
- **El carácter no cambia con la partida.** Un conquistador que pierde medio
  país sigue siendo conquistador; solo le frena `peacePower` / `peaceLand`.
- **No forma coaliciones.** Eso es v2.
