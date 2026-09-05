# Wardern — Misiles y reconocimiento con drones

> **ESTADO: IMPLEMENTADO (v1.2).** Motor en `js/engine/missiles.js`, datos en
> `js/data/missiles-data.js`, arsenal final de **5 armas** (§0). Las secciones 1-7
> describen el diseño; el ANEXO conserva el contrato original del MVP.

## 0. Arsenal final — cambios sobre el MVP de 3 armas

| Arma | Plataformas | Rango | Daño | Cooldown | Coste/disparo |
|---|---|---|---|---|---|
| Hellfire (batalla, pasivo) | helicóptero t2/t3 | — | +6/+10 atk vs blindados | — | 0 |
| **Tomahawk** | destructor t2/t3 | 1.200 km | 15 HP/unidad | 18 h | 12k$ + 1.5k fuel |
| **Harpoon** | fragata t3 | 450 km | 25 HP/barco | 12 h | 8k$ + 1k fuel |
| **Salva MLRS** (NUEVO) | artillería t2/t3 | 350 km | 8 HP/unidad | 8 h | 4k$ + 600 fuel |
| **Misil de crucero (bombardero)** (NUEVO) | bombardero t3 | 1.000 km | 12 HP/unidad | 14 h | 9k$ + 1.2k fuel |

Los dos añadidos siguen a CoN: la artillería de cohetes (HIMARS/Smerch) golpea
provincias cercanas con salva barata (presión de desgaste, prob. de dañar edificio
0.15) y el bombardero pesado t3 "al mejorarlo puede lanzar misiles" (JASSM/Kh-101),
que cubre el dominio aéreo con prob. de edificio 0.3. Escalado de tier ×1.25 igual
que el resto. UI: cada plataforma con arma muestra botón "🚀 Misil" (cooldown
visible), anillo de alcance punteado en modo objetivo y trazo del misil en vuelo.

## Reglas añadidas durante la implementación

- **Los drones NO combaten**: `groupByProvince` (combat.js) los excluye; pueden
  sobrevolar territorio enemigo sin desatar batallas ni morir (recon puro, UAV de CoN).
- `visibleProvinces` lleva caché por tick (WeakMap) para no reescanear por frame.
- Rechazos de lanzamiento informan el motivo exacto en el toast (rango, reconocimiento,
  recursos, cooldown, objetivo vacío); un disparo rechazado no se paga.

## 1. Arsenal (3 armas)

| Arma | Modo | Plataformas (ids EXACTAS) | Tier | Rango | Daño | Cooldown | Coste/disparo | Blanco |
|---|---|---|---|---|---|---|---|---|
| **Hellfire** | En batalla | `occ-2-helicoptero`, `ori-2-helicoptero`, `occ-3-helicoptero`, `ori-3-helicoptero` | 2 | — | +6 atk (t2) / +10 (t3) vs `mbt`/`cazatanques` | — (pasivo) | 0 | Blindados en combate |
| **Tomahawk** | Golpe manual | `occ-2-destructor`, `ori-2-destructor`, `occ-3-destructor`, `ori-3-destructor` | 2 | 1.200 km (t3: 1.500) | 15 HP planos por unidad enemiga (t3: 19) | 18 h | 12.000 $ + 1.500 fuel | Provincia terrestre |
| **Harpoon** | Golpe manual | `occ-3-fragata`, `ori-3-fragata` | 3 | 450 km | 25 HP planos por barco enemigo de la celda | 12 h | 8.000 $ + 1.000 fuel | Celda de mar |

Regla de tier: si `plataforma.tier > tierRequerido`, daño y rango ×1.25 (`Math.round`),
igual que el escalado del roster (por eso el destructor t3 dispara más lejos y más fuerte).
Los nombres de arma son agnósticos de doctrina (occ y oriental usan las mismas cifras).

## 2. Mecánica A — Golpe manual (Tomahawk/Harpoon)

Flujo: seleccionar la plataforma propia → botón **"Atacar con misiles"** (en su fila,
patrón `data-...` de `panels.js`) → clic en provincia/celda objetivo → el misil vuela
`minutos = distKm(centroide lanzador, centroide objetivo) / velocidadKmH × 60` → impacto.

Validaciones en `launchMissile` (todas antes de pagar):
1. Plataforma propia, **en posición** (`u.edgeLeft === null`: anclada/detenida).
2. Dentro de rango: `distKm ≤ rangoKm` entre centroides (el `pos` del destructor es
   su celda de mar, que también tiene `cx/cy`).
3. **Reconocimiento**: `visibleProvinces(state).has(objetivo)` — sin dron ni
   adyacencia propia no se dispara (golpear el interior enemigo exige dron).
4. En guerra con el controlador; Tomahawk: provincia terrestre (`!isSea`), Harpoon: celda de mar.
5. Objetivo con contenido: unidades enemigas o algún edificio nivel > 0; si no,
   disparo **rechazado** con aviso (no se gasta).
6. Cooldown en 0 y `canAfford` → se paga con `pay()` y `u.mslCd[arma] = cooldownH × 60`.

Impacto (misma mecánica para ambas armas): cada unidad enemiga en el objetivo
(`!u.embarked`, dueño en guerra con el lanzador) recibe `hp -= daño`, `morale -= daño ×
MORALE_HIT` (0,018 por Tomahawk); `hp ≤ 0` → muere y cuenta en `stats.lost` (patrón de
`combat.js` líneas 122–129, incluida la carga de transportes hundidos). El daño es
**plano**: ni terreno, ni fortaleza, ni defensa lo mitigan (el misil castiga stacks,
no borra unidades). Edificios: si `probEdificio > Math.random()`, un edificio aleatorio
con nivel > 0 pierde 1 nivel. El misil vuela aunque el lanzador muera o haya paz en el
trayecto (dueño y blanco se revalidan solo al impactar).

## 3. Mecánica B — Arma en batalla (Hellfire)

En `tickCombat`, al calcular `atkVal` de un helicóptero cuya variante trae Hellfire
(tier ≥ 2), si la categoría del objetivo es `mbt` o `cazatanques`:
`atkVal += MISSILES.hellfire.bonusAtaque[tier]` (t2 +6, t3 +10). Bono pasivo: sin coste,
sin cooldown, sin cambios de selección de blanco (el 65 % funciona igual). Verificado
con la fórmula exacta: Apache t2 vs MBT t2 en llanura pasa de 1,231 a 1,600 daño/tick
(−23 % de tiempo de muerte: 20,3 h → 15,6 h); el MBT se retira (HP < 30) a las ~10,9 h
habiendo hecho solo 7,5 de daño al helicóptero. Es el "cazatanques volador" del GDD.

## 4. Drones de reconocimiento

- Radios por tier: **t1 = 120 km, t2 = 200 km, t3 = 300 km** (`DRONE_VISION_KM`);
  los vecinos distan 300–500 km entre centroides: t1 cubre su provincia y asoma al
  vecino, t3 mira 1–2 provincias dentro del enemigo. Aplica a las variantes
  existentes `occ/ori-{1,2,3}-drone` **sin unidades nuevas**; el alias legacy `drone`
  (sin `tier`) cuenta como t1 = 120 km.
- Regla EXACTA en `visibleProvinces`: tras añadir propias + adyacentes, para cada
  unidad del jugador con `category === "drone"`, `R = DRONE_VISION_KM[u.tier ?? 1]` y
  para cada `p` de `S.provinceList` (incluye celdas de mar): si
  `distKm([S.provinces.get(u.pos).cx, .cy], [p.cx, p.cy]) <= R` → `vis.add(p.id)`.
  Unión de todos los drones. `u.pos` no cambia durante el vuelo, así que un dron
  revela desde su provincia de origen mientras viaja. Las celdas de mar reveladas
  hacen visibles los barcos (sinergia con Harpoon).
- Coste O(drones × ~300 haversines) por llamada: trivial (cacheable por tick si se quiere).
- Render (`renderer.js`): círculo **punteado** alrededor de cada dron propio; radio
  proyectado = distancia en pantalla entre el centroide del dron y el punto a
  `Δlat = R/111` grados al norte (misma proyección Mercator).

## 5. Coste y economía

Cada disparo descuenta del tesoro del dueño al lanzar (`pay`), sin inventario: la
limitación es cooldown + coste + visión. País mediano (72k $/día) → ~1,3 Tomahawks/día;
el misil añade ~2k fuel/día al mantenimiento del destructor: disparar es económico.

## 6. IA de los bots (en cada `aiTickAll`, 6 h)

- Destructor con cooldown 0 y recursos: elegir la provincia enemiga en guerra con
  mayor ΣHP de unidades dentro de rango; si ΣHP ≥ 150 o tiene edificio de nivel ≥ 2,
  lanzar 1 Tomahawk (pagando coste). La IA no sufre niebla: no comprueba visión.
- Fragata t3: igual contra la celda de mar enemiga con más HP total a ≤ 450 km.
- Drones ociosos: `orderMove` a la provincia propia fronteriza con el país en guerra
  (la de mayor tropas enemigas adyacentes); en paz no se mueven.

## 7. Investigación

Sin árbol propio ni tecnología de misiles: un arma está disponible cuando el país
puede reclutar su plataforma, es decir `researchedTier ≥ tierRequerido` (t2 desbloquea
Hellfire/Tomahawk; Harpoon llega con la fragata t3). Añadir coste extra duplicaría el
gate del tier sin diseño nuevo — queda para fases posteriores (p. ej. misil de silo).

## ANEXO — Contrato de datos e integración (para el agente de motor)

```js
// js/data/missiles-data.js
export const MISSILES = {
  hellfire: { id: "hellfire", nombre: "Hellfire", modo: "batalla", tierRequerido: 2,
    plataformaIds: ["occ-2-helicoptero","ori-2-helicoptero","occ-3-helicoptero","ori-3-helicoptero"],
    bonusAtaque: { 2: 6, 3: 10 }, clasesBlanco: ["mbt","cazatanques"], coste: null },
  tomahawk: { id: "tomahawk", nombre: "Tomahawk", modo: "golpe", tierRequerido: 2,
    plataformaIds: ["occ-2-destructor","ori-2-destructor","occ-3-destructor","ori-3-destructor"],
    rangoKm: 1200, danio: 15, cooldownH: 18, velocidadKmH: 880,
    coste: { money: 12000, fuel: 1500 }, objetivos: "provincia-terrestre", probEdificio: 0.3 },
  harpoon: { id: "harpoon", nombre: "Harpoon", modo: "golpe", tierRequerido: 3,
    plataformaIds: ["occ-3-fragata","ori-3-fragata"],
    rangoKm: 450, danio: 25, cooldownH: 12, velocidadKmH: 900,
    coste: { money: 8000, fuel: 1000 }, objetivos: "celda-mar", probEdificio: 0 },
};
export const DRONE_VISION_KM = { 1: 120, 2: 200, 3: 300 };
// Estado nuevo (se serializa solo: save.js hace JSON.stringify de todo el estado;
// en cargas viejas `state.missiles === undefined` → tratar como [] y `u.mslCd` como {}):
// state.missiles = [{ id, weaponId, owner, fromId, toId, minutesLeft }]
// u.mslCd = { tomahawk: 1080 }   // minutos de juego restantes por arma
```

Toques al motor: **state.js** `visibleProvinces` → escaneo de drones (§4); **combat.js**
`tickCombat` → suma Hellfire a `atkVal` (§3; replicar en `tools/test-variants.mjs` para
mantener la réplica exacta); **js/engine/missiles.js** (nuevo) → `launchMissile` +
`tickMissiles` (validaciones §2, cooldowns y vuelos), invocado en `sim.js` `tick()`
tras `tickCombat`; **economy.js** → reusar `canAfford`/`pay` sin cambios; **panels.js** →
botón "Atacar con misiles" en la fila de unidad propia cuando su variante aparece en
algún `plataformaIds` de modo "golpe", con modo de selección análogo a `moveUnitId`
(`ui.strike = { unitId, weaponId }` en `main.js`, avisos como los de ruta imposible);
**renderer.js** → círculo punteado de visión y trazo opcional del misil en vuelo.

## Ejemplos resueltos (cifras verificadas a mano)

1. **Destructor t2 (Arleigh Burke) dispara 1 Tomahawk a 800 km** contra provincia
   enemiga con 3× infantería t1 y fortaleza n1: vuelo 54,5 min (~4 ticks); cada infante
   −15 HP (quedan 85) y −0,018 moral; 30 % de que la fortaleza baje a n0; coste
   12k $ + 1,5k fuel; destructor sin disparar durante 18 h. Daño total 45 HP ≈ 6,3k $
   de valor (3 inf t1 = 42k $/100 HP): el Tomahawk no compensa contra 3 unidades,
   sí contra stacks y edificios (ver ejemplo 2).
2. **2 destructores t2 disparan 1 Tomahawk cada uno a provincia con 8× infantería t2**
   (stack lleno, 160k $): cada misil 15 HP × 8 unidades = 120 HP; los dos, 240 HP
   (1,2 inf equivalentes ≈ 24k $ de valor) por 24k $ + 3k fuel. Todas quedan a 70 HP,
   moral −0,036 c/u. Harían falta ~7 misiles para matar UNA unidad a 100 HP: presión
   de desgaste, no botón de borrado. Un destructor solo no puede duplicar: cooldown
   18 h por plataforma.
3. **Harpoon: fragata occ-3 (Constellation) a 300 km de un transporte t2** en celda de
   mar visible por dron: vuelo 20 min, 25 HP al transporte (queda en 75), coste
   8k $ + 1k fuel, cooldown 12 h; hundido en 4 disparos ≈ 48 h de juego (36k $ + 4k
   fuel para hundir 60k $) si nadie lo interrumpe.

## Puntos abiertos

- Tomahawk débil en vivo → subir `danio` 15→18 antes que tocar cooldown/coste.
- Interceptación por AA/radares y misiles de silo: fuera del MVP (el schema lo admite
  después con un campo `contramedida`).
