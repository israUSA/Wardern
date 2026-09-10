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

## 2. Radar — ver no es poder disparar

Cada variante tiene su `radarKm` (alcance de detección de **aeronaves**, no de
tropa terrestre) y **siempre supera al de su misil más largo**. Esa diferencia es
la mecánica central: ves al enemigo acercarse mucho antes de poder hacer nada.

| Aparato | Radar (efectivo) | Misil más largo | Margen de ceguera |
|---|---|---|---|
| F-16A (APG-66) | 300 km | AIM-9L, 72 km | 228 km |
| F/A-18E (APG-73) | 600 km | AIM-120C, 420 km | 180 km |
| F-22 (APG-77 AESA) | 1.000 km | AIM-120C, 420 km | 580 km |
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
| MiG-23 | 2× R-23 + 4× R-60 |
| Su-27 | 6× R-27 + 4× R-73 + 2× Kh-25 |
| Su-57 | 4× R-77 + 2× R-73 + 2× Kh-31P (carga interna) |
| AH-64 Apache | 16× Hellfire |
| AH-64E Guardian | 16× Hellfire + 2× Stinger |
| MQ-9 Reaper / Orion | 4× Hellfire / 4× Ataka |

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

## 9. Compatibilidad con guardados

`ammo` se crea **perezosamente** (`ensureAmmo`) la primera vez que se consulta,
así que las partidas guardadas antes de esta versión cargan con la dotación
completa sin migración. `spawnUnit` no se tocó, para no meter datos de combate
dentro de `state.js`.
