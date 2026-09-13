# Reconocimiento e inteligencia

Quién ve qué, y por qué. Todo lo resuelve `intelFor()` en
[`js/engine/state.js`](../js/engine/state.js), que devuelve tres conjuntos de
provincias por país:

| Conjunto | Qué significa |
|---|---|
| `strong` | Inteligencia **fuerte**: se ven las fichas enemigas identificadas |
| `weak` | Inteligencia **débil**: solo aparece un contacto «?» con el recuento |
| `union` | Todo lo anterior — es lo que dibuja el mapa |

---

## Las cuatro fuentes de inteligencia fuerte

1. **Tus provincias.** Toda provincia que controlas es `strong`, y sus vecinas
   pasan a `weak`. Esa es la inteligencia de frontera de base.
2. **Tus unidades.** Donde hay una ficha tuya hay inteligencia fuerte.
3. **Drones de reconocimiento.** Círculo alrededor del aparato.
4. **Vehículos de exploración terrestres.** Lo mismo, con radio mucho menor.

Las fuentes 3 y 4 son **el mismo código**: `scoutRangeKm(type)` devuelve el radio
y el resto es idéntico. Lo único que las separa es la cifra.

**Nada de esto mira de quién es la provincia.** Un dron o un vehículo parado en
tu lado de la frontera ve lo que hay al otro lado sin entrar y sin declarar la
guerra. El radio barre también los sectores de mar que abarca, así que descubre
barcos sin necesidad de tener flota cerca.

---

## Radios

### Drones (`DRONE_VISION_KM`, en `missiles-data.js`)

| Tier | Radio |
|---|---|
| T1 | 700 km |
| T2 | 1100 km |
| T3 | 1500 km |

### Terrestres (`SCOUT_VISION_KM`, en `state.js`)

| Categoría | T1 | T2 | T3 |
|---|---|---|---|
| Cazatanques | 430 km | 520 km | 610 km |
| Motorizada | 380 km | 470 km | 560 km |

**Ninguna otra unidad explora.** La infantería, los carros, la artillería y los
antiaéreos ven su provincia y las de al lado, como siempre.

La motorizada explora porque es la que va por delante de la columna. El
cazatanques explora —y un poco más— porque en ambas doctrinas es literalmente un
vehículo de caballería: el M3 Bradley es el de exploración del Ejército de EE.
UU., y el BRDM-2 es un coche blindado de reconocimiento.

---

## Por qué las cifras son tan grandes

Porque están atadas a la **escala del mapa**, no a la óptica real del vehículo.

Medido sobre los datos del juego, la distancia entre dos provincias terrestres
vecinas es:

| Percentil | Distancia |
|---|---|
| p25 | 206 km |
| **mediana** | **324 km** |
| p75 | 544 km |
| p90 | 877 km |

Un radio «realista» de 30 km para un M113 no llegaría ni a la provincia de al
lado: el reconocimiento terrestre sencillamente no existiría. 380 km asoma justo
al otro lado de la frontera y 610 km ve la segunda línea, que es el efecto que se
busca.

Es el mismo ajuste de teatro que ya se hizo con los alcances de misil
(ver [AIR-COMBAT.md §1](AIR-COMBAT.md)).

Por el mismo motivo hubo que **subir la visión de los drones**, que estaba en
120 / 200 / 300 km: con esas cifras un dron no alcanzaba la provincia vecina y un
Bradley de exploración habría visto más que un MQ-9. Ahora el dron queda en torno
al doble y medio del mejor vehículo terrestre.

Medido desde Arizona, contando solo provincias de tierra que no son tuyas:

| Radio | Provincias ajenas reveladas |
|---|---|
| 380 km (M113) | 0 |
| 610 km (M3A3 Bradley) | 1 |
| 700 km (RQ-2) | 2 |
| 1100 km (RQ-1) | 4 |
| 1500 km (MQ-9) | 7 |

Arizona es un caso duro a propósito: su centro está a 616 km del de Sonora. Desde
una provincia realmente pegada a la frontera, un vehículo de exploración asoma
bastante más.

---

## En el mapa

- **Drones propios**: círculo azul, **siempre visible**. Son pocos y ver su
  cobertura es su razón de ser.
- **Vehículos de exploración**: círculo verde, **solo con la unidad
  seleccionada**. Pintar el de cada motorizada del frente llenaría el mapa de
  círculos y no se vería nada.

El panel de unidad enseña la cifra en la fila **Reconocimiento**.

---

## Lo que NO da el reconocimiento

- **No da permiso para entrar.** Ver a través de la frontera y cruzarla son cosas
  distintas: lo segundo lo decide `canEnter()`
  (ver [AIR-COMBAT.md §11](AIR-COMBAT.md)).
- **No da permiso para disparar.** La artillería exige observación sobre el
  blanco —de ahí que mandar un dron delante sirva de algo— pero el tiro sigue
  necesitando estar en guerra y en alcance.
- **No es simétrico con la IA.** Los bots no sufren niebla en los chequeos de
  tiro (ver [MISSILES.md §6](MISSILES.md)).
