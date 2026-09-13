# Wardern — Unidades navales y mecánicas marítimas

> Fuente de verdad: `js/data/naval-data.js` — **36 variantes** (6 categorías × 2 doctrinas ×
> 3 tiers), leído por el motor tal cual (`ALL_UNITS` en `js/engine/state.js`). Números
> verificados con simulación de la **fórmula exacta** de `js/engine/combat.js` en el mar
> (sin terreno ni fortaleza): 135 duelos 1v1, escalado por tier y 5 reglas de stacks.

## Schema (decisiones de diseño)

- **`hp` = 100 en TODOS los barcos**, igual que el roster terrestre: el motor instancia a
  100 HP y retira con HP < 30. La fragilidad vive en la matriz `defense`
  (daño ×= `20/(20 + def)`; en el mar sin terreno ni fortaleza).
- **16 claves** en `attack`/`defense`: las 10 terrestres/aéreas + las 6 navales
  (`corbeta, fragata, destructor, submarino, portaviones, transporte`).
  - **AA naval 15–25** (ancla t2) vs `caza/bombardero/helicoptero/drone`: toda la flota
    dispara al aire. Como el AA suele ser el ataque más alto del barco, la selección del
    65% hace que las flotas **prioricen aéreos** en su celda: los escoltas protegen de
    verdad.
  - **Bombardeo de costa 8–18** vs las 6 claves terrestres (reserva para asaltos
    costeros futuros). Excepción a propósito: el **transporte** es ofensivamente
    inofensivo (3–5 vs tierra, 2–5 vs barcos).
- **`minPortLevel` = tier del barco** (t1=1, t2=2, t3=3): el nivel del edificio Puerto
  (`BUILDINGS.puerto`) que exige reclutarlo.
- **`capacity: 3`** solo en transportes: unidades terrestres que puede embarcar.
- **Escalado como el roster terrestre**: t1 ≈ 0.9× stats / 0.7× coste · t2 = ancla ·
  t3 ≈ 1.25× stats / 1.5× coste. `buildHours`: t1 ×0.9, t3 ×1.2 (los barcos tardan:
  corbeta 48 h → portaviones 120 h en el ancla).
- **Sin** `terrainDefBonus`, `terrainAtkPenalty` ni `rangedTicks`: el mar es neutral.
- **Sabor de doctrina** (pequeño, verificado que no rompe ningún duelo): occidental
  +1 AA, +2 velocidad, +1 defensa antisubmarina · oriental +1 ataque antibuque,
  −1 velocidad. **Costes idénticos entre doctrinas**: simetría de balance.

## Categorías y roles

| Categoría | t2 occidental / oriental | Rol | Counter de | Débil contra | Coste t2 | Vel occ/ori | Horas |
|---|---|---|---|---|---|---|---|
| **Corbeta** | USS Independence (LCS) / Gepard | Patrulla y caza-sub barata | Submarino (por coste) | Destructor, fragata, portaviones | 40k | 62/59 | 48 |
| **Fragata** | USS Oliver Hazard Perry / Almirante Gorshkov | Escolta polivalente | Corbeta, transporte | Submarino, portaviones, destructor | 70k | 57/54 | 60 |
| **Destructor** | USS Arleigh Burke / Udaloy | Cazador ASW y buque de superficie | Submarino, corbeta, fragata, transporte | Portaviones (1v1) | 110k | 57/54 | 72 |
| **Submarino** | USS Virginia / Akula | Asesino de grandes, ataque sorpresa | Portaviones, fragata | Destructor, corbeta | 130k | 47/44 | 84 |
| **Portaviones** | USS Nimitz / Kuznetsov | Dominio de superficie + proyección aérea | Fragata, corbeta, destructor, transporte (1v1) | Submarino, enjambres | 350k | 52/49 | 120 |
| **Transporte** | USS Whidbey Island / Ivan Rogov | Mueve 3 terrestres por mar (`capacity: 3`) | Nada | Todo (huye o va escoltado) | 60k | 47/44 | 60 |


## Puntos de vida por buque (v1.6)

Hasta v1.5 todos los buques tenían 100 HP. Ahora van por desplazamiento, y el
abanico está abierto de verdad porque los barcos solo se baten entre ellos (en
tierra no se pudo, ver la sección "Puntos de vida" de docs/UNITS.md).

| Clase | Occidente t1/t2/t3 | Oriente t1/t2/t3 | Ventaja occ. |
|---|---|---|---|
| Portaviones | 413/459/528 | 405/450/518 | +2 % |
| Destructor | 202/224/258 | 198/220/253 | +2 % |
| Fragata | 138/153/176 | 135/150/173 | +2 % |
| Corbeta | 83/92/106 | 81/90/103 | +2 % |
| Transporte | 147/163/188 | 144/160/184 | +2 % |
| Submarino | 108/120/138 | 117/130/149 | **−8 %** |

**En el mar aguanta más Occidente, al revés que en tierra.** La marina occidental se
construyó alrededor de cascos grandes y supervivientes.

El margen es de solo un **2 %** y no es poco: medido, por encima del 4 % la flota
occidental gana el 100 % de las batallas. Parece minúsculo porque va acompañado de
otra cosa — a Oriente se le quitó el +1 de ataque contra buques de superficie que
tenía, y con eso el reparto queda: **la superficie es de Occidente, el submarino es
de Oriente**.

El submarino oriental conserva las dos ventajas a la vez: **+8 % de vida Y el +1 de
ataque antibuque**. Es su arma naval fuerte de verdad —Akula, Alfa, hoy los Yasen—
y es la que hunde portaviones.

`hp` y `defense` dicen cosas distintas: **defense es cuánto cuesta acertarte, hp es
cuánto bulto tienes.** El transporte lo separa bien — mucho casco, ninguna
protección.

> Verificado por `node tools/test-naval.mjs` (32 aserciones). El margen de vida
> occidental está asertado a un máximo del 4 %: por encima, la flota occidental
> gana el 100 % de las batallas.

## Contrarreloj naval (verificado con `node tools/test-naval.mjs`)

El triángulo, ahora medido y asertado por el banco:

**destructor > submarino > portaviones > superficie > destructor**

Cada arma tiene a quien la mata. El destructor barre la superficie pero el
portaviones lo supera; al portaviones lo hunde el submarino; y al submarino lo
caza el destructor. Ninguna clase gana a todas.

| Duelo 1v1 (t2 occidental) | Ganador | Vida final | Duración |
|---|---|---|---|
| Destructor vs Submarino | Destructor | 95 % | 6,0 h |
| Destructor vs Corbeta | Destructor | 97 % | 5,0 h |
| Destructor vs Fragata | Destructor | 81 % | 17,6 h |
| Destructor vs Transporte | Destructor | 96 % | 9,6 h |
| Portaviones vs Destructor | Portaviones | 82 % | 23,1 h |
| Portaviones vs Fragata | Portaviones | 95 % | 8,9 h |
| Portaviones vs Corbeta | Portaviones | 98 % | 6,2 h |
| Submarino vs Portaviones | Submarino | 52 % | 26,4 h |
| Submarino vs Fragata | Submarino | 63 % | 11,8 h |
| Fragata vs Corbeta | Fragata | 89 % | 7,7 h |
| Corbeta vs Submarino | Corbeta | 58 % | 13,7 h |

La **vida final va en porcentaje**, no en puntos. Con un abanico de 90 a 495 HP
la suma bruta no compara nada: "gana con el 60 %" sí significa lo mismo para una
corbeta que para un portaviones.

Los dos duelos más largos —Portaviones vs Destructor (23 h) y Submarino vs
Portaviones (26 h)— son los que deciden una campaña naval, y los dos acaban con
el ganador maltrecho. Es lo que se busca: hundir un portaviones tiene que costar.

### Reparto de doctrina

| | Occidente | Oriente |
|---|---|---|
| Superficie | **gana las 5 clases** | — |
| Submarino | — | **gana** |
| Antiaéreo naval | acierta más (Aegis) | llega más lejos (S-300F) |
| Vida | +2 % en superficie | +8 % en submarino |

**Flota completa contra flota completa: Oriente gana el 24 %.** Dentro de la banda
que el banco exige (20-80 %), así que hay partida.

Ese equilibrio costó encontrarlo y conviene no romperlo a ojo. Medido:

| Configuración | Resultado |
|---|---|
| Oriente con su +1 antibuque original | Oriente gana el **98 %** de las flotas |
| Occidente +6 % de vida, +1 oriental intacto | Oriente gana el **97 %** |
| Sin el +1 oriental, Occidente +6 % | Occidente gana el **100 %** |
| **Sin el +1 oriental, Occidente +2 %** | **Oriente gana el 24 %** ✓ |

Dos lecciones que el banco dejó por escrito:

1. **El margen de vida no puede pasar del 4 %.** Por encima, la flota occidental
   gana el 100 % de las batallas y deja de haber juego. El banco lo asierta.
2. **Un +1 de ataque pesa más que un +2 % de vida** en el mar, al revés que en
   tierra (ver docs/UNITS.md). El motivo es que los ataques navales son grandes
   —12 a 18 puntos— así que un +1 es un +6 a +8 %, mientras que en tierra los
   ataques base son la mitad y la vida compone más.


## Tabla de costes (idéntica para ambas doctrinas)

| Categoría | Tier | Dinero | Sumin. | M.Obra | Combust. | Horas | Puerto | Captura |
|---|---|---|---|---|---|---|---|---|
| Corbeta | 1 | 28k | 2,8k | 350 | 7k | 43 | 1 | No |
| Corbeta | 2 | 40k | 4k | 500 | 10k | 48 | 2 | No |
| Corbeta | 3 | 60k | 6k | 750 | 15k | 58 | 3 | No |
| Fragata | 1 | 49k | 4,9k | 550 | 12,5k | 54 | 1 | No |
| Fragata | 2 | 70k | 7k | 800 | 17,5k | 60 | 2 | No |
| Fragata | 3 | 105k | 10,5k | 1,2k | 26k | 72 | 3 | No |
| Destructor | 1 | 77k | 7,7k | 700 | 19,5k | 65 | 1 | No |
| Destructor | 2 | 110k | 11k | 1k | 27,5k | 72 | 2 | No |
| Destructor | 3 | 165k | 16,5k | 1,5k | 41k | 86 | 3 | No |
| Submarino | 1 | 91k | 9,1k | 500 | 23k | 76 | 1 | No |
| Submarino | 2 | 130k | 13k | 700 | 32,5k | 84 | 2 | No |
| Submarino | 3 | 195k | 19,5k | 1,05k | 49k | 101 | 3 | No |
| Portaviones | 1 | 245k | 24,5k | 2,1k | 61k | 108 | 1 | No |
| Portaviones | 2 | 350k | 35k | 3k | 87,5k | 120 | 2 | No |
| Portaviones | 3 | 525k | 52,5k | 4,5k | 131k | 144 | 3 | No |
| Transporte | 1 | 42k | 4,2k | 850 | 10,5k | 54 | 1 | No |
| Transporte | 2 | 60k | 6k | 1,2k | 15k | 60 | 2 | No |
| Transporte | 3 | 90k | 9k | 1,8k | 22,5k | 72 | 3 | No |

Suministros = 10% del dinero, combustible = 25% (los barcos beben). Mano de obra
proporcional a la tripulación (portaviones 3k). Ningún barco captura: la conquista
exige terrestres, el mar niega, bombardea (futuro) y transporta.

## Roster y nombres (36 variantes, ids `occ/ori-{tier}-{categoría}`)

| Categoría | T1 | T2 | T3 |
|---|---|---|---|
| Corbeta occ | USS Cyclone | USS Independence (LCS) | HMS Visby |
| Corbeta ori | Pauk (Proy. 1331) | Gepard (Proy. 11661) | Steregushchiy (Proy. 20380) |
| Fragata occ | USS Knox | USS Oliver Hazard Perry | USS Constellation |
| Fragata ori | Krivak (Proy. 1135) | Almirante Gorshkov | Proyecto 22350M |
| Destructor occ | USS Spruance | USS Arleigh Burke | USS Zumwalt |
| Destructor ori | Kashin (Proy. 61) | Udaloy (Proy. 1155) | Lider (Proy. 23560) |
| Submarino occ | USS Los Angeles | USS Virginia | USS Columbia |
| Submarino ori | Kilo (Proy. 877) | Akula (Proy. 971) | Yasen (Proy. 885) |
| Portaviones occ | USS Kitty Hawk | USS Nimitz | USS Gerald R. Ford |
| Portaviones ori | Kiev (Proy. 1143) | Kuznetsov (Proy. 11435) | Shtorm (Proy. 23000) |
| Transporte occ | USS Newport | USS Whidbey Island | USS San Antonio |
| Transporte ori | Alligator (Proy. 1171) | Ivan Rogov | Ivan Gren (Proy. 11711) |

Notas de naming: la **Constellation (FFG-62) es una fragata**, así que es la fragata
occidental t3 (no corbeta); la corbeta occidental t3 es la furtiva sueca **Visby**.
En los proyectos rusos se usa el buque líder cuando existe (Steregushchiy = Proy.
20380, Lider = Proy. 23560, Yasen = Proy. 885, Shtorm = Proy. 23000, Ivan Gren =
Proy. 11711) para que el nombre sea legible en UI.

## Mecánicas para el motor (especificación)

1. **Reclutamiento**: en provincia **costera con edificio Puerto** de nivel ≥
   `minPortLevel` de la variante (`recruitBlocker` ya lo aplica). Las variantes
   disponibles salen de `availableVariants` (doctrina del país + tier investigado).
   Cola `kind: "naval"` con `minutes = buildHours × 60`; al completar el barco
   aparece en la **celda de mar adyacente** (`seaCell` de la cola). Los barcos no
   ocupan plaza de la provincia ni participan en su defensa.
2. **Movimiento**: los barcos **solo entran y están en celdas de mar**
   (`isNaval` en `movement.js`); terrestres nunca y los aéreos sobrevuelan.
   Coste de arista = `distancia_km / speed × 60` (sin multiplicadores de terreno ni
   estrechos). Los puertos son la única interfaz tierra–mar.
3. **Combate**: barco contra barco **en la misma celda de mar** con la fórmula
   estándar (`combat.js`) vía `unitDef`/`ALL_UNITS`, sin terreno ni fortaleza
   (factores = 1); moral, overstack (máx. 8 sin penalización), retirada (HP < 30 o
   moral < 20%) y veteranía idénticos al resto. **Retirada naval**: hacia la celda
   de mar adyacente de un país propio/neutro con ruta; sin ruta posible → hundido.
4. **AA naval y aéreos**: los aéreos sí pueden entrar en celdas de mar
   (`movement.js`), así que el combate aire–mar existe: las flotas disparan con sus
   claves AA (15–25) y el 65% de selección les da prioridad. ⚠️ Contrato con
   `units-data.js`: las unidades terrestres/aéreas aún no traen claves navales en
   sus matrices — el motor debe tratar `attack[tipoNaval]` indefinido como **0**
   (hasta que la ampliación de doctrinas las añada, el aire no daña barcos).
5. **Transporte (`capacity: 3`)**:
   - **Embarcar**: transporte en celda de mar adyacente a una provincia costera
     propia/aliada **con puerto** (cualquier nivel) → carga hasta 3 unidades
     terrestres situadas en esa provincia.
   - **Embarcadas**: las unidades salen del tablero de provincias — no cuentan para
     el overstack, no son atacables ni capturan; si el transporte muere, mueren las 3.
     Siguen pagando mantenimiento.
   - **Desembarcar**: transporte en celda de mar adyacente a **cualquier provincia
     costera** (propia, neutral o enemiga: asalto anfibio). Las unidades aterrizan en
     la provincia; si es enemiga, comienza combate normal al tick siguiente. El
     desembarco no exige puerto (la playa basta); el embarque sí.
6. **Los barcos jamás capturan** provincias ni celdas de mar: ocupar es de
   infantería. El mar es un espacio de maniobra, negación y transporte.
7. **Mantenimiento**: mismas constantes que cualquier unidad (0,6% del coste en
   suministros/día). Un portaviones t2 quema ~2.100 suministros/día: caro de
   mantener a propósito; la flota es un activo de países con costa y economía.
8. **IA (fase 2)**: los bots pueden construir un puerto en su mejor provincia costera
   y transportes para desembarcos cuando no hay frontera terrestre explotable;
   escoltar transportes con la corbeta más barata disponible.

## Perillas de reajuste (si el juego en vivo lo pide)

- **Submarinos abusivos** → subir `destructor.attack.submarino` (24) o bajar
  `submarino.attack.portaviones` (30).
- **Portaviones intrascendente** → el problema será el enjambre de fragatas: bajar
  `fragata.attack.portaviones` (8) o subir `portaviones.defense.fragata/corbeta`
  (14/15). No subir su ataque: el snowball no lo compensa.
- **Corbeta demasiado buena contra subs** → bajar `corbeta.attack.submarino` (16) a 14.
- **Flotas eternas** → los duelos duran 10–32 h; para acelerar, subir `COMBAT_SCALE`
  (afecta a todo el juego) o subir ~2 puntos los attack navales clave.
- **Economía** → suministros y fuel son % fijos del money en la tabla: mover un
  coste mueve los cuatro recursos a la vez.
