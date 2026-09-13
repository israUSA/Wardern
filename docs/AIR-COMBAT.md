# Wardern — Combate aéreo: radar, cargas de misiles y disparo guiado

> **ESTADO: IMPLEMENTADO.** Datos en `js/data/air-combat-data.js`, motor en
> `js/engine/air-combat.js`, interfaz en `js/ui/panels.js` (`updateRadarPanel`).
> Convive con `docs/MISSILES.md` sin sustituirlo.

## 0. Qué añade y en qué se diferencia del arsenal existente

| | `missiles.js` (v1.2) | `air-combat.js` (este) |
|---|---|---|
| Blanco | La **provincia** entera | Una **unidad** concreta |
| Munición | Infinita, limitada por cooldown | **Carga finita** por avión |
| Resolución | Daño plano garantizado | **Probabilidad de impacto (Pk)** |
| Detección | `visibleProvinces` (drones) | **Radar** propio de cada aparato |
| Reposición | — | **Rearme en base aérea**, con coste y tiempo |

Los dos sistemas comparten el array `state.missiles` (los de aquí van marcados
con `air: true`) para que el vuelo y el render sean únicos.

## 1. Escala de teatro — la decisión menos obvia del sistema

Entre dos provincias contiguas de Wardern hay **324 km de mediana** (139 km en el
decil más apretado, medido sobre los 1.376 pares adyacentes del mapa). Con
alcances literales, un AIM-9 de 18 km no llegaría jamás a la provincia de al lado
y el radar del F-16A (75 km) no vería absolutamente nada: el sistema entero sería
inerte.

`AIR_RANGE_SCALE = 4` multiplica **todo** por igual —misiles, radares y
antiaéreos—, así que **las proporciones reales quedan intactas**: el AMRAAM sigue
alcanzando exactamente 5,8 veces más que el Sidewinder. Lo único que cambia es la
unidad de medida del teatro. Además, dos unidades en la **misma provincia** están
a distancia **0**: comparten sector.

El resultado coloca cada arma en su papel doctrinal real:

- **Sidewinder, Hellfire, Maverick, JDAM** → alcance de la propia provincia. Hay
  que meterse encima del enemigo: combate visual y apoyo cercano.
- **AMRAAM, R-77, HARM, Kh-31P** → alcanzan provincias vecinas. Son las armas de
  disparar desde casa: BVR y supresión de defensas a distancia.

Es el único parámetro a tocar si el combate aéreo se siente corto o largo.

### La velocidad de los aparatos va aparte

Mismo principio, distinta solución. `velocidadKmH` en `AIR_LOADOUTS` es la
velocidad máxima **real** del aparato y es la que se enseña en su ficha (F-16A a
2.120 km/h, Apache a 293). El ritmo con el que el motor lo mueve por el mapa es
`speed` en `js/data/units-data.js`, ajustado a mano por categoría, y la ficha lo
muestra debajo etiquetado como **"Ritmo en mapa"** — sin fingir que son lo mismo.

Aquí **no** vale un divisor único como en los alcances: el abanico real es
demasiado ancho. Un Su-27 vuela 8,5 veces más rápido que un Apache; dividiendo
ambos por la misma constante para que el caza quedara en su ritmo actual, el
helicóptero caería a ~18 km/h, más lento que la infantería a pie de este mapa
(12-60 km/h para las unidades de tierra). Por eso el ritmo de tablero se mantiene
comprimido a mano y el dato real vive solo en la ficha.

## 2. Radar — ver no es poder disparar

Cada variante tiene su `radarKm` (alcance de detección de **aeronaves**, no de
tropa terrestre) y **siempre supera al de su misil más largo**. Esa diferencia es
la mecánica central: ves al enemigo acercarse mucho antes de poder hacer nada.

| Aparato | Radar (efectivo) | Misil más largo | Margen de ceguera |
|---|---|---|---|
| F-16A (APG-66) | 300 km | AIM-9L, 72 km | 228 km |
| F/A-18E (APG-73) | 600 km | AIM-120C, 420 km | 180 km |
| F-22 (APG-77 AESA) | 1.000 km | AIM-120C, 420 km | 580 km |
| F-35A (APG-81 AESA) | 800 km | AIM-120C, 420 km | 380 km |
| MiG-23 (Sapfir-23) | 220 km | R-23, 140 km | 80 km |
| Su-27 (N001) | 440 km | R-27, 280 km | 160 km |
| Su-57 (N036) | 960 km | R-77, 440 km | 520 km |

Los helicópteros llevan radares de 32-64 km: no hacen BVR, ven lo que tienen
encima. Los drones conservan además su círculo de reconocimiento terrestre de
`docs/MISSILES.md §4`.

**Aire-suelo** no usa radar: exige reconocimiento de la provincia
(`visibleProvinces`), igual que el resto de misiles. La IA no sufre niebla.

## 3. Cargas estándar

Configuraciones documentadas de cada avión, no el máximo teórico de pilones.
Ejemplos (la tabla completa está en `AIR_LOADOUTS`):

| Aparato | Carga |
|---|---|
| F-16A | 4× AIM-9L + 2× AGM-65 |
| F/A-18E | 4× AIM-120C + 2× AIM-9X + 4× AGM-65 + 2× AGM-88 |
| F-22 Raptor | 6× AIM-120C + 2× AIM-9X + 2× GBU-31 (carga interna) |
| F-35A Lightning II | 4× AIM-120C + 2× GBU-31 (bahía interna, config. furtiva) |
| MiG-23 | 2× R-23 + 4× R-60 |
| Su-27 | 6× R-27 + 4× R-73 + 2× Kh-25 |
| Su-57 | 4× R-77 + 2× R-73 + 2× Kh-31P (carga interna) |
| AH-64 Apache | 16× Hellfire |
| AH-64E Guardian | 16× Hellfire + 2× Stinger |
| MQ-9 Reaper / Orion | 4× Hellfire / 4× Ataka |
| RQ-190 | sin armas (sensor puro, `rcs 0.96`) |

El F-35 y el F-22 conviven en el tier 3 occidental (`EXTRA_VARIANTS`, ver
`docs/UNITS.md`) y no son intercambiables: el Raptor lleva 10 misiles y domina el
aire; el F-35 solo 6, pero es el único caza furtivo occidental que entra a por
blindados y baterías **sin colgar nada por fuera**. El "modo bestia" con pilones
externos no se modela: rompería la furtividad, que es justo lo que se compra.

Los drones t1/t2 siguen siendo reconocimiento puro. Los t3 van armados —el Reaper
y el Orion lo están— y eso los convierte también en **blanco válido**: no combaten
en provincia, pero un caza enemigo puede derribarlos con un misil.

Cada arma aire-suelo solo sirve contra ciertas categorías: el Maverick es
anticarro, el HARM solo ataca antiaéreos, la JDAM va contra tropa a pie. Apuntar
con el arma equivocada se rechaza explicando por qué.

## 4. Resolución del disparo

```
Pk = pk_base(arma) × curva_distancia × (1 − evasión_blanco) + 0,05 × veteranía
```

- **Curva de distancia**: ×1,0 hasta el 35% de la envolvente, ×0,9 hasta el 60%,
  ×0,72 hasta el 80% y ×0,5 en el límite. A quemarropa no da tiempo a reaccionar;
  al máximo alcance el misil llega sin energía.
- **Evasión**: maniobra, contramedidas y firma radar. F-22 0,45 y B-21 0,50 (son
  furtivos); MiG-23 0,05. En superficie, la infantería dispersa evade 0,25 y el
  antiaéreo 0,35, porque se defiende solo.
- Resultado acotado entre 0,05 y 0,95: **nunca hay disparo seguro**.

Al impactar se revalida el enganche: si hubo paz, o el blanco huyó más allá del
115% de la envolvente, el misil se pierde. Daños de 35 a 70 HP, así que **derribar
un caza cuesta unos dos impactos** (retirada por debajo de 30 HP, `docs/UNITS.md`).

## 5. Reacción antiaérea — por qué existen los antirradar

Disparar **aire-suelo** desde dentro de la burbuja de un antiaéreo enemigo hace
que la batería responda: 35% de acertar, 45 HP al avión atacante. Un F-16 que
entre a por tanques sin haber callado antes las defensas vuelve a casa con medio
fuselaje, o no vuelve.

De ahí el bucle: **primero HARM / Kh-31P contra las baterías** (400-440 km, desde
fuera de su alcance), después la aviación de ataque. Alcances: Vulcan/Shilka
20 km (son cañones), Patriot 280 km, Buk 180 km, PAC-3 480 km, S-400 800 km.

Los disparos aire-aire no despiertan a las baterías: la abstracción asume que el
caza está ocupado con otro caza, no sobrevolando la posición.

## 6. Rearme

Automático mientras el avión está **detenido en provincia propia con base aérea**
(nivel ≥ 1). Cada misil tarda lo suyo (8-26 min) y se paga al reponerlo. Una
salida de F-22 con los seis AMRAAM gastados son horas de pista y 27.000 $ de
vuelta a la estantería.

Si falta dinero o suministros, el avión espera con el misil listo para cargar. En
tránsito, sobre el mar o en provincia no controlada, el rearme se detiene y la
ficha dice exactamente por qué.

## 7. Interfaz

Botón **📡 Abrir radar** en la ficha de cualquier aeronave propia. El panel trae:

- **Barrido panorámico (PPI)**: norte arriba, cuatro anillos de distancia
  etiquetados, un blip por contacto en su rumbo real (rombo = aeronave, cuadrado =
  superficie) con el color de su país, y la **burbuja del arma seleccionada** en
  amarillo punteado: dentro se puede disparar, fuera no.
- **Pestañas aire-aire / aire-suelo** con el número de contactos de cada tipo.
- **Selector de arma** con la munición restante de cada una.
- **Lista de contactos** con distancia, rumbo, HP y **Pk calculado en vivo**. El
  botón de disparo se deshabilita explicando el motivo: fuera de alcance, arma
  inadecuada, sin munición o avión en tránsito.

En el mapa: burbuja verde del radar del aparato con el panel abierto y línea
punteada al contacto enganchado.

## 8. La IA juega con las mismas reglas

`aiAirCombat` (llamado desde `aiTickAll`) usa exactamente las mismas funciones que
el jugador: detecta con su radar, respeta munición, alcance y tránsito, y elige la
combinación arma/blanco que maximiza `Pk × daño` —así no malgasta un AMRAAM en un
dron ni tira un Maverick contra infantería atrincherada—. Prioriza la amenaza
aérea sobre la terrestre y dispara un misil por aparato y ciclo.

## 9. Furtividad: dos cosas distintas

La furtividad se modela con **dos números separados**, porque en la realidad son
dos problemas distintos y un avión puede ser bueno en uno y malo en el otro:

| Campo | Qué hace | Dónde pega |
|---|---|---|
| `rcs` | **No ser visto.** Recorta el alcance al que te detectan: quien te busca con un radar de `R` km te ve a `R × (1 − rcs)` | `radarContacts` |
| `evasion` | **No ser tocado.** Resta efectividad al Pk del misil que ya te dispararon | `pkFor` |

| Aparato | `rcs` | Te ve un radar de caza puntero (1.000 km) a… | `evasion` |
|---|---|---|---|
| RQ-190 | 0,96 | **40 km** (o sea: encima) | 0,70 |
| B-21 Raider | 0,88 | 120 km | 0,68 |
| B-2 Spirit | 0,82 | 180 km | 0,62 |
| F-22 Raptor | 0,80 | 200 km | 0,65 |
| F-35A | 0,78 | 220 km | 0,60 |
| Su-57 | 0,62 | 380 km | 0,42 |
| MQ-9 / Orion | 0,25 | 750 km | 0,35 |
| F/A-18E | 0,15 | 850 km | 0,20 |
| B-52G, MiG-23, Su-27… | 0 | 1.000 km | 0,05–0,15 |

Los furtivos occidentales están deliberadamente por encima del Su-57 en ambos
ejes: es la ventaja tecnológica del bando, no un descuido de balance.

### El contrapeso: radares de vigilancia terrestres

Si la furtividad solo recortase la detección, un F-22 sería invencible y aburrido.
El contrapeso es que **el antiaéreo no solo dispara: vigila**, y su radar alimenta
la imagen táctica de todo su bando por enlace de datos (`SAM_RADAR`). Un radar
terrestre grande en banda métrica ve lo que ningún radar de caza puede.

| Batería | Vigilancia | `antiStealth` | Coge al F-22 a… | Coge al RQ-190 a… |
|---|---|---|---|---|
| Vulcan / Shilka (t1) | 120 km | 0 | 24 km | 5 km |
| Patriot (t2) | 600 km | 0,05 | 144 km | 53 km |
| Buk (t2) | 640 km | 0,05 | 154 km | 56 km |
| PAC-3 (t3) | 1.000 km | 0,14 | 312 km | 174 km |
| **S-400 (t3)** | 1.400 km | 0,15 | **448 km** | **258 km** |

En el radar del avión, esos contactos aparecen marcados **ENLACE**: los ve tu
batería, no tu aparato. Puedes dispararles igual si están dentro del alcance de
tu misil, y ahí está la jugada — tu Patriot ilumina al furtivo y tu caza lo mata.

Verificado en partida: un B-52 a 1.125 km lo coge el S-400 por enlace pero no el
caza; el F-22 y el F-35 a 508 km **no los ve nadie**; y el RQ-190 solo aparece
cuando comparte sector o cuando la geografía aprieta (detectado a 69 km entre
Idaho y Montana, que son provincias inusualmente juntas).

**Sigue sin modelarse**: la furtividad no afecta a la niebla estratégica (`intel`),
solo al radar aéreo. Un bombardero furtivo parado en una provincia que tengas
reconocida se ve en el mapa como cualquier otra unidad.

## 10. Aviación embarcada

Los portaviones llevan su ala aérea consigo. Plazas por buque —el básico lleva
menos que el avanzado, y la asimetría entre bandos es real: los portaaeronaves
soviéticos nunca tuvieron un ala comparable a la estadounidense—:

| Occidental | Plazas | Oriental | Plazas |
|---|---|---|---|
| USS Kitty Hawk (t1) | 3 | Kiev, Proy. 1143 (t1) | 2 |
| USS Nimitz (t2) | 4 | Kuznetsov (t2) | 3 |
| USS Gerald R. Ford (t3) | 6 | Shtorm, Proy. 23000 (t3) | 5 |

**Solo operan desde cubierta** los aparatos con gancho y alas plegables
(`CARRIER_CAPABLE`): F/A-18E, F-35 y RQ-190 en occidente; Su-27 (→ Su-33),
Su-57 y Orion en oriente. Un F-22 o un F-16 lo rechazan explicando por qué.
*Concesión de juego*: el Su-57 no tiene variante naval real —el caza embarcado
ruso es el MiG-29K— pero se admite para que el bando oriental tenga un furtivo
embarcado.

Flujo, sin teletransportes:

1. El avión **vuela** hasta la celda de mar del portaviones: se le ordena el
   movimiento como a cualquier unidad, haciendo clic en el sector donde está el
   buque. Un destino marítimo solo se acepta si allí hay un portaviones propio,
   parado y con plaza libre (`carrierBerths` en `movement.js`); en cualquier otro
   caso la orden se rechaza, porque un avión no puede quedarse sobre el agua.
2. Al llegar **aponta solo** (`landIfCarrier` en `tickMovement`): si ha podido
   pedir ese destino es porque había cubierta, y obligar a un segundo clic sobre
   un avión flotando en mitad del océano no aportaba nada. El botón **🛬
   Aterrizar** de su ficha sigue estando para el caso manual: un aparato que ya
   comparte sector con el buque —recién despegado, o de vuelta de una misión—.
3. A bordo pasa a `embarked = idBuque`, así que hereda todas las exclusiones que
   ya existían: no combate, no se dibuja, no lo detecta ningún radar.
4. El buque navega y **el ala viaja con él**.
5. **Lanzar** desde la ficha del portaviones lo devuelve al vuelo en el sector
   donde el buque esté AHORA — que es justo lo que hace útil embarcarlo.

**Rearme a bordo**: un portaviones tiene pañoles, así que hace de base aérea
flotante. Solo con el buque detenido: si está navegando no hay ciclo de vuelo.

La lista a bordo se resuelve recorriendo `embarked` (`aircraftAboard`) en vez de
guardar un array en el buque: una sola fuente de verdad, imposible que se
desincronicen, y los guardados viejos no necesitan campo nuevo.

## 10. Compatibilidad con guardados

`ammo` se crea **perezosamente** (`ensureAmmo`) la primera vez que se consulta,
así que las partidas guardadas antes de esta versión cargan con la dotación
completa sin migración. `spawnUnit` no se tocó, para no meter datos de combate
dentro de `state.js`.

## 11. Espacio aéreo libre y radio de acción

Antes, entrar en territorio de un país neutral exigía declararle la guerra, y la
regla valía igual para tanques que para aviones. Era una frontera política
aplicada a algo que en la realidad no la respeta: el reconocimiento aéreo entra
donde le hace falta.

Ahora la regla es física en vez de diplomática.

### Sobrevuelo libre

No lo tiene toda la aviación, solo la que **no se ve**. La regla es: nadie
declara la guerra por algo que no ha detectado.

Lo decide `canOverfly()` en `movement.js`:

- **Todos los drones**, sea cual sea su firma. Su perfil de vuelo —lento,
  pequeño, alto— y su condición de no tripulado es justo lo que en la realidad
  permite negar la incursión.
- **Los tripulados furtivos**, con `rcs ≥ 0.6` (`STEALTH_OVERFLIGHT_RCS`).

| Aparato | `rcs` | ¿Sobrevuela sin guerra? |
|---|---|---|
| B-21 Raider | 0.88 | sí |
| B-2 Spirit | 0.82 | sí |
| F-22 Raptor | 0.80 | sí |
| F-35A | 0.78 | sí |
| Su-57 | — | sí |
| Drones (todos) | — | sí |
| Tu-160M | 0.15 | **no** |
| B-52G, Tu-22M2/M3, cazas convencionales, helicópteros | 0-0.15 | **no** |

El Tu-160M es el caso que mejor explica la regla: tiene el mayor alcance del
juego y aun así no puede colarse, porque en el radar es enorme.

`neutralBlocker()` acepta un parámetro `aereo` y devuelve `null` cuando **toda**
la selección puede sobrevolar; basta con un caza convencional en el grupo para
que el aviso diplomático vuelva a aparecer.

Atacar a una unidad de un país con el que no estás en guerra **sigue siendo** una
declaración de guerra, furtivo o no: lo que dejó de serlo es pasar por encima de
su territorio y mirar.

### Radio de acción

Lo que sustituye a la frontera cerrada. Cada aparato solo puede plantarse a
cierta distancia **de su base**, medida en línea recta.

| Categoría | T1 | T2 | T3 |
|---|---|---|---|
| Drone | 2400 km | 4400 km | 6400 km |
| Bombardero | 2000 km | 2800 km | 3600 km |
| Caza | 1000 km | 1400 km | 1800 km |
| Helicóptero | 500 km | 700 km | 900 km |

El orden drone > bombardero > caza > helicóptero es deliberado. El dron manda
porque su papel es ser los ojos del jugador muy por delante del frente: con un
radio de caza no vería nada que no viera ya la inteligencia de frontera. El
helicóptero cierra la tabla porque es apoyo de la tropa, no un aparato de
alcance.

#### Excepciones por tipo

Aparatos cuyo alcance no lo explica su categoría (`AIR_RANGE_KM_BY_TYPE`):

| Aparato | Alcance | Por qué |
|---|---|---|
| B-21 Raider | 9600 km | Bombardero estratégico furtivo |
| B-2 Spirit | 9000 km | Bombardero estratégico furtivo |
| Tu-160M | 9000 km | El único ruso de la plantilla que de verdad es intercontinental |
| RQ-190 | 8400 km | Penetración profunda, desarmado a propósito |

Los tres bombarderos pasan por encima incluso del dron de T3: son los únicos
pensados para cruzar un océano, soltar y volver. El resto —B-52G, Tu-22M2,
Tu-22M3— se queda con la cifra de su categoría: el Backfire es un bombardero de
teatro, y el B-52 solo alcanza sus cifras reales con reabastecimiento en vuelo,
que aquí no se modela.

Las cifras están en `AIR_RANGE_KM` y `AIR_RANGE_KM_BY_TYPE` (`constants.js`).


### Traslado entre bases: el radio de ida

Hay **dos** límites, y la diferencia es la que separa una misión de una mudanza:

| | Límite | Cuándo |
|---|---|---|
| **Radio de combate** | `AIR_RANGE_KM` | cualquier destino normal — es ida **y vuelta** |
| **Radio de traslado** | ×2 (`FERRY_MULT`) | el destino es **otra base propia** — solo ida |

Cuando el aparato se muda a otro aeródromo propio (o a un portaviones propio con
plaza) no tiene que volver: se queda a vivir allí. Sin viaje de vuelta, la mitad
del depósito que se guardaba para regresar pasa a ser autonomía, así que el
alcance se dobla. Es el vuelo de ferry de la aviación real.

Ejemplo medido, F-16A con 1.000 km de radio de combate, destino a 1.506 km:

| Destino | Permitido | Tope aplicado |
|---|---|---|
| Provincia propia **con aeródromo** | sí | 2.000 km |
| La misma provincia **sin aeródromo** | no | 1.000 km |

Al llegar, el aparato pasa a medir su alcance desde la base nueva: `airBaseFor`
devuelve siempre el aeródromo propio más cercano, así que la mudanza es efectiva
sin guardar nada en la unidad.

Si ni el radio de traslado llega, el aviso propone lo correcto: **mover por
etapas, saltando de base en base**.

En el mapa se ven los dos: el disco relleno es donde puede **combatir**, y el
anillo exterior tenue y punteado hasta dónde puede **mudarse**. El segundo va sin
relleno a propósito — con el mismo peso visual se leería como el doble de alcance
operativo, que es justo lo contrario de lo que significa.


#### Apontar no tiene límite

Volar a un **portaviones propio con plaza libre** está exento del radio de acción,
sea cual sea la distancia. Un portaviones es una base que se mueve y suele estar
en mitad de un océano lejísimos de cualquier aeródromo: si el avión no pudiera
llegar nunca hasta él, el ala embarcada sería inservible y el buque un adorno
carísimo.

El freno ya está en otro sitio y no hace falta uno más: solo la aviación de
cubierta (`CARRIER_CAPABLE`) puede apontar, y el buque tiene que tener plaza.

Medido: un F/A-18E con 1.400 km de radio llega a un portaviones propio a
**12.492 km**. Un B-2, que no es de cubierta, se rechaza igual que siempre.

### Qué cuenta como base

`airBaseFor()` devuelve la más cercana entre:

- provincias propias con **aeródromo** (`buildings.aerobase ≥ 1`)
- **portaviones** propios, para la aviación embarcada o capaz de apontar

Un aparato ya embarcado no busca nada: su base es el buque que lo lleva, y el
radio le viaja con él. Es justo para lo que sirve un portaviones — y, junto con
construir aeródromos más adelantados, es la única forma de llegar más lejos.

**Sin ninguna base propia el límite no se aplica.** Dejar a toda la aviación
clavada en el sitio por no tener aeródromo sería castigar al jugador por algo que
no puede arreglar en ese momento.

### Patrullar el mar

`orderPatrol()` admite un sector de mar aunque no haya portaviones debajo:
patrullar es dar vueltas un rato y volverse a casa, no quedarse a vivir sobre el
agua (la cuenta atrás termina en regreso a base). Eso permite barrer el mar en
busca de barcos enemigos sin tener flota allí.

Moverse a un sector de mar **para quedarse** sigue exigiendo un portaviones
propio parado con plaza libre: eso no ha cambiado.

### En el mapa

Al seleccionar un aparato propio se dibuja un disco semitransparente con su radio
de acción, centrado **en su base, no en él**. Si siguiera a la ficha, el jugador
nunca podría ver hasta dónde le da. El color va por categoría —azul dron, verde
caza, naranja bombardero, amarillo helicóptero— para no confundirlo con los otros
anillos que ya pinta el mapa (visión del dron, burbuja de radar, alcance del
misil). Lo dibuja `drawAirRange()` en `renderer.js`.

### Ver sin entrar

Independiente de todo lo anterior: `intelFor()` concede inteligencia **fuerte** a
toda provincia dentro del radio de reconocimiento, **sin mirar de quién es**. Un
dron parado en territorio propio ve unidades enemigas al otro lado de la frontera
sin entrar y sin declarar nada. Detalle completo, incluido el reconocimiento
terrestre, en [RECONOCIMIENTO.md](RECONOCIMIENTO.md).

## 12. Atacar buques y la defensa antiaérea naval

Hasta aquí **un avión no podía atacar a un barco en absoluto**: ningún arma
aire-suelo llevaba categorías navales en su lista de blancos. Ahora sí, y cada
buque se defiende solo.

### Qué arma hunde qué

| Arma | Alcanza |
|---|---|
| GBU-31 JDAM · KAB-500S | todos los buques |
| AGM-65 Maverick · Kh-25ML | todos los buques |
| Hellfire · 9M120 Ataka | corbeta y transporte |
| BGM-71 TOW · 9M114 Shturm | solo corbeta |

El anticarro ligero de helicóptero no hunde un destructor, que es lo razonable.

### La defensa del buque: cuatro cifras

| | Qué hace |
|---|---|
| `km` | alcance al que engancha al avión atacante |
| `pk` | probabilidad de tocarlo con su misil de zona |
| `ciws` | probabilidad de **derribar un misil que ya viene** — Phalanx, Kashtan, ESSM |
| `antiStealth` | cuánto anula la furtividad del atacante |

Valores t2 occidentales:

| Clase | Alcance | Acierto | Intercepta |
|---|---|---|---|
| Destructor | 126 km | 52 % | 66 % |
| Fragata | 50 km | 37 % | 48 % |
| Portaviones | 23 km | 23 % | 60 % |
| Corbeta | 6 km | 18 % | 25 % |
| Transporte | 7 km | 11 % | 14 % |
| **Submarino** | **0** | **0** | **0** |

**El portaviones se defiende poco solo** (23 km) y **el submarino nada en
absoluto**. No son errores: son las dos lecciones que el sistema tiene que
enseñar. Un portaviones sin escolta es un blanco enorme, y un submarino
descubierto por la aviación no tiene respuesta.

### La furtividad es la llave

El `pk` se recorta con la firma radar del atacante, igual que en los radares
terrestres. Probabilidad de que un destructor t2 toque a cada aparato:

| Aparato | Le acierta |
|---|---|
| B-52G | 52 % |
| F/A-18E | 44 % |
| F-35A | 14 % |
| F-22 Raptor | 13 % |
| B-2 Spirit | 12 % |
| B-21 Raider | 9 % |
| RQ-190 | 5 % |

Ahí está el motivo de existir del bombardero furtivo: cruza un grupo de combate
que derribaría a cualquier otra cosa.

### Doctrina

Occidente acierta más (Aegis y enlace de datos entre buques: `pk` ×1,15,
`ciws` ×1,2); Oriente llega más lejos (S-300F: `km` ×1,25). Distinto carácter, no
"uno mejor".

### Interceptar el misil

Al llegar el misil al buque, el CIWS tira **antes** de la tirada de impacto. El
parte distingue las dos cosas: "DERRIBA el AGM-65 con su defensa de punto" no es
lo mismo que "AGM-65 FALLA".

Los antirradar (HARM, Kh-31P) son un 40 % más difíciles de interceptar: vienen
rápidos y bajos, y el buque tiene que elegir entre apagar el radar o seguir
viéndolos.

