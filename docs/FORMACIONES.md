# Formaciones

Sistema para unir varias unidades en una sola ficha que se manda de golpe.
Inspirado en el agrupamiento de *Conflict of Nations*, pero más flexible: aquí la
formación es heterogénea (un carro con infantería), se nombra sola según lo que
lleva dentro y se deshace pieza a pieza.

Código: [`js/engine/formations.js`](../js/engine/formations.js).
Interfaz: sección del panel de unidad en [`js/ui/panels.js`](../js/ui/panels.js).
Dibujo: agrupación por formación en [`js/render/renderer.js`](../js/render/renderer.js).

---

## Qué sustituye

Antes existía una pila **implícita**: `stackFor()` agrupaba unidades del mismo
dueño, **mismo tipo**, misma provincia y quietas, solo para dibujarlas en una
ficha. No era persistente ni podía mezclar tipos.

La formación es **explícita y persistente**: se crea desde el panel, sobrevive al
guardado (`unit.formation` viaja dentro de la unidad en el JSON del estado) y
manda sobre la pila implícita — si una unidad pertenece a una formación,
`stackFor()` devuelve los miembros de esa formación y nada más.

---

## Modelo de datos

Solo hay un campo nuevo por unidad:

```js
unit.formation = "f3" | null
```

…más un contador `state.formationSeq` para no repetir identificadores.

**Todo lo demás se deriva cada vez que se consulta**: el nombre, quién manda, la
velocidad, si puede capturar. No se guarda ningún nombre en el estado. La razón
es que así el nombre nunca miente: al desacoplar una unidad la formación se
renombra sola, sin código de mantenimiento y sin riesgo de que el estado guardado
y la composición real se separen.

---

## Dominios

Tres, y no se mezclan nunca:

| Dominio | Categorías |
|---|---|
| **tierra** | infantería, motorizada, MBT, cazatanques, artillería, antiaéreo |
| **aire** | caza, bombardero, helicóptero, drone (los que tienen `air: true`) |
| **naval** | corbeta, fragata, destructor, submarino, portaviones, transporte |

No es una regla de equilibrio: una formación es una columna que se mueve junta, y
un caza no acompaña a una sección de infantería por carretera.

---

## Nombres

El nombre es **escalón + apellido**. El escalón sale del número de unidades y el
apellido de la composición.

### Escalón por número

| Unidades | Tierra | Aire | Naval |
|---|---|---|---|
| 2-3 | Pelotón | Patrulla | División Naval |
| 4-6 | Compañía | Escuadrón | Flotilla |
| 7-10 | Batallón | Grupo Aéreo | Escuadra |
| 11-15 | Regimiento | Ala | Grupo de Batalla |
| 16 | Brigada | — | — |

Cada escalón lleva marcado su género para que el apellido concuerde: *Compañía
Mecanizad**a***, *Batallón Mecanizad**o***.

### Apellido por composición

Un arma da nombre a la formación si pasa de **dos tercios** del total.

El umbral no es la mitad a propósito. Con la mitad, un carro con dos secciones de
infantería salía «Pelotón de Infantería» y el carro —que es la unidad que define
a ese grupo, y la que el mapa enseña— desaparecía del nombre.

| Categoría dominante | Apellido | Ejemplo |
|---|---|---|
| MBT | Acorazado / Acorazada | Regimiento Acorazado |
| Motorizada | Mecanizado / Mecanizada | Compañía Mecanizada |
| Infantería | de Infantería | Batallón de Infantería |
| Artillería | de Artillería | Compañía de Artillería |
| Cazatanques | Anticarro | Pelotón Anticarro |
| Antiaéreo | Antiaéreo / Antiaérea | Compañía Antiaérea |
| Caza | de Caza | Patrulla de Caza |
| Bombardero | de Bombardeo | Escuadrón de Bombardeo |
| Helicóptero | de Helicópteros | Patrulla de Helicópteros |
| Drone | de Reconocimiento | Escuadrón de Reconocimiento |

### Armas combinadas

Si ninguna categoría llega a dos tercios, no hay arma principal y el nombre lo
dice:

| Dominio | Nombre base |
|---|---|
| tierra | **Grupo Táctico** |
| aire | **Paquete Aéreo** |
| naval | **Agrupación Naval** |

Al nombre base se le añade el arma de **mayor rango presente** (no la más
numerosa), porque es la que define el carácter del grupo y la que se ve en el
mapa. Los apellidos invariables que empiezan por «de» no se añaden: «Grupo
Táctico de Infantería» se contradice a sí mismo.

Ejemplos reales del motor:

| Composición | Nombre |
|---|---|
| 1 carro + 2 infanterías | Grupo Táctico Acorazado |
| 1 carro + 5 infanterías | Compañía de Infantería |
| 11 carros + 1 infantería | Regimiento Acorazado |
| 2 artillerías + 2 infanterías | Grupo Táctico |
| 3 artillerías + 1 infantería | Compañía de Artillería |
| 2 cazatanques + 1 infantería | Grupo Táctico Anticarro |
| 2 cazas + 1 bombardero | Paquete Aéreo |

### Excepciones navales

En el mar manda el buque mayor, no cuántos son. Estas reglas pisan al conteo:

- con **portaviones** → **Grupo de Batalla**, sean los que sean
- **solo submarinos** → **Manada de Submarinos**
- con **transporte** → escalón + **Anfibia/Anfibio** (p. ej. *División Naval Anfibia*)

---

## Quién manda

La unidad líder decide **el sprite del mapa** y el apellido en los nombres
mixtos. Se elige por **prioridad, no por cantidad**: una compañía de ocho
fusileros con un carro enseña el carro.

```
naval:   portaviones > destructor > submarino > fragata > transporte > corbeta
aire:    bombardero > caza > helicóptero > drone
tierra:  MBT > artillería > cazatanques > motorizada > antiaéreo > infantería
```

---

## Reglas mecánicas

### 1. Una formación NO suma ataque ni defensa

Es un **envoltorio de mando**. Las unidades siguen combatiendo una a una
exactamente igual que sueltas; lo único que cambia es que reciben las órdenes
juntas y se dibujan juntas.

Si unir multiplicase el daño, juntar diez carros sería la única jugada del juego
y el resto del diseño sobraría.

### 2. Va a la velocidad del más lento

Un carro a 50 km/h con infantería a 12 km/h avanza a 12. Lo aplica
`startEdgeFor()` en `movement.js`, que usa `formationSpeedType()` en lugar del
tipo de cada unidad.

Además de ser el precio justo de mezclar armas, es **necesario**: si cada unidad
calculase su propio tramo, el carro llegaría antes que la infantería y la
formación se desparramaría por media docena de provincias.

### 3. Tope de 16 unidades

Sin un techo aparece el apilamiento infinito: una única ficha con cuarenta
unidades que decide la partida entera.

### 4. Tira a distancia quien tiene alcance, y la columna no se parte

Dentro de una formación cada unidad conserva lo suyo. Al dar la orden **⚔
Atacar**:

1. **Todos los miembros con alcance abren fuego sin moverse.** El obús bate; el
   fusilero que va al lado no bate nada, porque no tiene con qué. Lo decide
   `artilleryRange(type) > 0`, que lee `rangoKm` de la unidad — hoy solo lo trae
   la artillería, pero la regla es genérica: dispara desde lejos quien tiene
   alcance, y nadie más.
2. **Si alguien ha disparado, el resto se queda.** Mandar a la infantería sola a
   por el blanco mientras el obús se queda atrás dejaría media columna en una
   provincia y media en otra, las dos con el mismo nombre de formación.
3. **Si no ha disparado nadie**, la formación entera avanza sobre el objetivo.

El panel enseña el **alcance de tiro del grupo**: el de la pieza que más lejos
bate. No es una suma, es «hasta aquí llega alguien de los míos sin moverse».

En el mapa, seleccionar la formación dibuja ese alcance como un **anillo rojo**
centrado en la pieza (rojo porque es un anillo de amenaza, a diferencia de los
discos de movilidad aérea).

### 5. Capturar exige quien capture

Solo la infantería y la motorizada tienen `captures: true`. Una formación puede
tomar provincia **solo si lleva al menos una de las dos**, así que un regimiento
acorazado puro arrasa pero no ocupa.

Es un motivo mecánico para mezclar armas que sale de los datos que ya existían,
sin inventar bonificaciones.

---

## Condiciones para formar

`mergeBlocker()` devuelve el motivo en texto, o `null` si se puede. La interfaz
enseña ese texto en vez de desactivar un botón sin explicar nada.

- al menos dos unidades
- mismo país
- misma provincia
- ninguna embarcada
- todas quietas (sin tramo en curso ni ruta pendiente)
- mismo dominio
- sin pasar de 16 miembros contando las formaciones que ya existan

Al unir, si alguna de las unidades ya pertenecía a una formación se **reaprovecha
la más grande** en vez de crear una nueva, para que meter un refuerzo en un
regimiento no lo refunde ni lo renumere.

---

## Deshacer

- **`detachUnit(state, unitId)`** saca **una** unidad. Si al hacerlo queda un solo
  miembro, la formación se deshace entera: una formación de uno no es una
  formación, es una unidad con un nombre raro.
- **`dissolveFormation(state, fid)`** las suelta todas.
- **`pruneFormations(state)`** lo llama `sim.js` después de retirar las bajas: una
  formación diezmada hasta quedar en uno se deshace sola, para que el mapa no
  siga enseñando un «Batallón» que ya es un camión suelto.

---

## Interfaz

En el panel de la unidad:

- **Sin formación** — lista de unidades compatibles en la provincia, con un botón
  `⊞` por cada una, más un botón para unirlas todas de golpe. Si no hay ninguna,
  se explica por qué.
- **Con formación** — nombre y número, HP del conjunto, ritmo de la columna (con
  el nombre del miembro que lo impone), si puede capturar, las fichas de cada
  miembro, un botón `⊟` por miembro para desacoplar y «Deshacer formación».

En el mapa la formación es **una sola ficha**: el sprite del que manda y la
insignia con el recuento total. En marcha también: todos los miembros comparten
tramo y minutos, así que solo se dibuja el líder.

---

## Pendiente

- La IA no forma ni deshace formaciones; es una herramienta solo del jugador.
- El combate sigue resolviéndose unidad por unidad, sin ninguna noción de que
  pertenecen a la misma formación (por diseño, ver regla 1 — pero si algún día se
  quiere un bono de armas combinadas, este es el sitio).
