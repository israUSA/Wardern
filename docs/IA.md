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

### Lo que no hace (todavía)

- **No hay carácter naval.** Los bots no reclutan barcos: `chooseUnitType` solo
  reparte categorías terrestres y aéreas. Un "almirante" necesita antes una IA
  naval.
- **El carácter no cambia con la partida.** Un conquistador que pierde medio
  país sigue siendo conquistador; solo le frena `peacePower` / `peaceLand`.
- **No forma coaliciones.** Eso es v2.
