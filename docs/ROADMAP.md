# Wardern — Roadmap

Estado: se actualiza al cerrar cada tarea. (v = versión jugable)

## v1 — MVP single-player ✓ COMPLETADO (2026-09-04)
- [x] Análisis del juego de referencia (Conflict of Nations WW3)
- [x] GDD + arquitectura + contratos de datos
- [x] Datos: mapa de América — 270 provincias resumidas estilo CoN, 29 países,
      1 sola componente conexa, terreno verificado con 15 aserciones, territorio ≥99.6%
- [x] Datos: roster de 10 unidades (5 terrestres + caza, bombardero, helicóptero,
      drone, antiaéreo) calibrado con 12 reglas de balance simuladas
- [x] Assets: símbolos OTAN canvas (10 tipos) + iconos UI
- [x] Motor: estado, economía, movimiento (con sobrevuelo aéreo), combate (moral,
      fortalezas, retiradas), ocupación/anexión
- [x] IA de países bot: economía, reclutamiento con counters, bases aéreas,
      guerras, operaciones, ofertas de paz
- [x] Render + UI en español: niebla de guerra, tooltip de provincia, órdenes de
      movimiento, modales
- [x] Guardado/carga + pantallas inicio/fin
- [x] Servidor sin caché (serve.py) y QA completa en navegador

## v1.1 — Marina + profundidad (en curso)
- [x] Naval completo (2026-09-05): 6 categorías × 2 doctrinas × 3 tiers
      (36 variantes, balance verificado en docs/NAVAL.md), edificios Puerto,
      embarque/desembarco, invasiones anfibias
- [x] QA naval E2E en navegador (2026-09-05): reclutar transporte → embarcar 2
      infanterías en Veracruz → travesía del Golfo (24 celdas, 68 h de juego) →
      desembarco en Cuba → batalla contra la guarnición (bajas, moral, retiradas)
- [x] Rejilla de mar reconstruida: celdas 0.8° (24.839 celdas), 132 provincias
      costeras correctamente enlazadas (antes solo 72; Veracruz sin salida al mar)
- [x] QA de regresión: 7 bugs corregidos — puerto construible en provincia sin
      costa (motor+UI), aristas mar-mar rotas (i/j), panel de flota invisible,
      movimiento naval de una sola celda, retirada hacia países neutrales,
      26 centroides fuera de su polígono (iconos en el mar), tooltip "Mar null"
- [x] Hook de QA (window.__wardern / __wardernUI) para pruebas automatizadas
- [x] Guardado/carga re-verificado tras los cambios
- [x] Doctrinas + 3 tiers del roster TERRESTRE/AÉREO (2026-09-05): 60 variantes con
      nombres reales (M60→M1 Abrams→M1A2 SEPv3 / T-62→T-72→T-90M), 25 países occidentales
      y 4 orientales, tier inicial "Años 80" con investigación progresiva, balance
      re-verificado (97 PASS / 0 FAIL en tools/test-variants.mjs)
- [x] QA regresión tras doctrinas (2026-09-05): 2 bugs latentes corregidos — matrices de
      combate indexadas por id (daño NaN con variantes: combate naval irresoluble) y IA
      inerte desde la capa naval (TypeError por tick tragado por try/catch). Bots verificados
      vivos: 141→391 unidades en 16 días, 19 construcciones activas
- [x] save.js: importGame aceptaba solo versión 1 (importar siempre fallaba); alineado
- [x] Jugabilidad (2026-09-10): **la IA no declaraba guerras nunca** (leía `aggression`
      del estado dinámico → NaN); ahora lee la de countries-data y declara. Reclutamiento
      de bots en varias provincias por chequeo (antes 1 por país: EEUU reclutaba como
      Belice), anexión de lo conquistado por la IA, inicio de guerra registrado para
      ambos bandos y mínimo de 3 días antes de que el débil pida la paz (antes se
      firmaba a las 6 h). Medido en 50 días Normal: guerras de 3–4 días, 38 provincias
      anexionadas, 5 países pequeños eliminados
- [x] Mercado de recursos (botón 💱 en la barra): suministros 8$/3$ y combustible 6$/2$
      por unidad, lotes de 1k y 5k — válvula para el dinero sobrante, no sustituto de industria
- [x] Desbandar unidades (ficha de unidad, con confirmación; sin reembolso; no en combate)
- [x] Dificultad seleccionable (Fácil / Normal / Difícil) en la ficha de país: escala la
      producción bruta y la agresividad de los bots (`DIFFICULTIES` en constants.js).
      Personalidades IA diferenciadas → pendiente
- [x] "Mover todas (N)" en la guarnición e indicador ⚔ de guerras abiertas en la barra
      superior (clic en la bandera = ir a la capital enemiga)
- [x] **Niebla de guerra para los bots** (2026-09-10): `intelFor(state, iso)` generaliza la
      inteligencia del jugador a cualquier país, y la IA mira por esa ventana. Ya no puede
      contar un ejército que no ha visto: la composición enemiga que usa para reclutar sale
      solo de inteligencia FUERTE, los misiles no apuntan fuera de lo observado y el poder
      del rival se ESTIMA (visto + provincias × AI_GUESS_PER_PROVINCE, con sesgo fijo por
      pareja) en vez de leerse exacto. Los edificios quedan fuera de la niebla —obra
      pública— y disparan contramedidas con un dado (AI_COUNTER_CHANCE)
- [x] **Etiquetas de países en el mapa** (2026-09-11): el nombre escrito sobre su
      territorio, con el del jugador en claro y el resto apagado. El ancla y el tamaño
      salen del territorio que CONTROLA, no del que posee, así que al conquistar se
      mueven y crecen solos. Se omiten los países que ocupan menos de 70 px de ancho en
      pantalla: es lo que evita el amasijo de nombres con el mapa alejado
- [x] Agrupación visual de stacks: hecha con las pilas en abanico + insignia de recuento
      y la chapa "+N" de desbordamiento (ver v1.3 más abajo)
- [x] ~~Puerto Rico como provincia~~ — **ya estaba**: `usa-puerto-rico` existe en el mapa
      (3,2 M hab., 11 VP), unido a República Dominicana por estrecho y a 12 celdas de mar.
      La entrada del roadmap estaba obsoleta; verificado en partida (2026-09-11)

## v1.2 — Misiles y reconocimiento (COMPLETADO)
- [x] Especificación completa en docs/MISSILES.md (Hellfire en batalla, Tomahawk/Harpoon
      golpe manual con vuelo/cooldown/coste, drones con radio de visión por tier 120/200/300 km,
      reglas de IA, ejemplos verificados a mano, contrato de integración)
- [x] Arsenal ampliado a 5 armas estilo CoN: + Salva MLRS (artillería t2/t3, 350 km) y
      misil de crucero desde bombardero t3 (1.000 km) — docs/MISSILES.md §0
- [x] Motor: js/engine/missiles.js (launchMissile/tickMissiles/impact) + visibleProvinces
      con círculos de dron y caché por tick + gancho Hellfire en combat.js + drones no combaten
- [x] UI: botón "🚀 Misil" por plataforma con cooldown, modo objetivo con anillo de
      alcance punteado, trazo del misil en vuelo, tooltips con el motivo exacto de cada
      botón de Construir/Reclutar bloqueado (hover)
- [x] IA: bots lanzan misiles al mejor blanco a rango (ΣHP ≥ 150 o edificio nv ≥ 2) y
      mueven drones ociosos al frente con más tropas enemigas
- [x] QA E2E: F-16A desbloqueado con Base aérea nv1 y reclutado por UI; Tomahawk lanzado
      por UI con impacto verificado (3 unidades dañadas); rechazos por reconocimiento y
      recursos sin gastar; 97/97 aserciones de balance (tools/test-variants.mjs)
- [x] Sprites ilustrados estilo CoN integrados (25 SVG del artista) con tinte por país,
      fallback OTAN, barras de HP y chevrons de veteranía (sprite-cache.js + symbols.js)

## v2 — Guerra total
- [ ] Misiles y armas estratégicas (nukes + disuasión)
- [ ] Coaliciones IA, guerras mundiales dinámicas

## v3 — Escenarios y pulido
- [ ] Escenarios (Carrera armamentística, Doctrina Monroe, etc.)
- [ ] Partidas con objetivo por tiempo
- [ ] Sonidos y efectos

## v1.3 — Look & feel CoN (en curso)
- [x] Inteligencia en DOS niveles (state.intel): fuerte (provincia propia, con unidad
      propia o círculo de dron) identifica unidades; débil (adyacencia) muestra
      contactos "?" sin identificar en el mapa y "❓ Contactos sin identificar: N" en el panel
- [x] Pilas de unidades DISPERSAS en abanico alrededor del centro de la provincia
      (ya no apiladas en la misma posición) con insignia de recuento en color del país
- [x] SIN panel oscuro tras los sprites: sombra suave + insignia; aéreos elevados con
      sombra en el suelo
- [x] Aviones en PATRULLA visual: órbita permanente alrededor de su base (cada grupo
      con fase propia); misión de patrulla con radio como mecánica → pendiente
- [x] Unidades en marcha ORIENTADAS a su rumbo (sprites rotan; sprites miran al norte)
      + etiqueta "Llega en Xh Ym" para unidades propias (estilo "Arrives in" de CoN)
- [x] Sprites nivel CoN (pintorescos semi-3D con rim light y sombras): **los 96 sprites
      por variante están hechos**. Aire cenital (sin tocar); los 36 terrestres en 3/4 de
      cámara baja a escala común 20,9 px/m con paleta arena (occ) / verde ruso (ori); los
      36 navales en 3/4 de cámara alta con gris OTAN / gris ruso y casco negro para
      submarinos. Convención completa en docs/ARTE.md
- [x] **Rotación al rumbo: solo aire** (2026-09-10). Tierra y mar están dibujados en 3/4 y
      rotarlos los dejaba tumbados; ahora llevan una punta de flecha por delante que marca
      el rumbo y el sprite se queda derecho. El giro interpolado sigue solo en los aéreos
- [ ] **Tinte por país en los sprites por variante** — los 96 usan gradientes propios en vez
      de las clases CSS `.base/.shade/.light/.hi`, así que hoy no responden al tinte. La
      doctrina se lee por paleta, el país no. Opciones: reescribir los `stop-color` en el
      sprite-cache, o aplicar un filtro suave por país
- [x] **Misión de patrulla aérea** (2026-09-11): botón 🎯 en la ficha del avión, mismo
      mecanismo de "elige destino en el mapa" que Mover (incluido el aviso de territorio
      neutral). Al llegar se queda dando vueltas sobre el punto durante `AIR_PATROL_MINUTES`
      (8 h de juego) y, al agotarse, vuelve SOLA a la base propia más cercana
      (`orderReturnToBase`) sin que el jugador tenga que vigilar el reloj. La cuenta atrás
      vive en `unit.task = { kind: "patrol", minutesLeft }`; arreglado de paso un bug
      latente que la habría dejado inútil en cualquier destino a más de un salto:
      `tickMovement` borraba `task` en CADA tramo intermedio de la ruta, no solo al llegar.
      Verificado con un tick real de 3 saltos en el navegador: llega, cuenta atrás en la
      ficha, log de "agota su patrulla" y aterriza sola
- [x] **Ritmo CoN y progresión offline** (2026-09-11): el reloj baja de 1440 a 24 minutos
      de juego por minuto real — **1 hora real = 1 día de juego**. Patrulla 20 min,
      industria 3 h, base aérea 4 h. No se tocó ninguna duración: todas estaban ya en
      días de juego y se estiran solas con `MINUTES_PER_TICK_BASE`.
      Prerrequisito resuelto: el **combate era el único sistema por TICK** y no por
      tiempo de juego (`tickCombat` recibía `dt` y no lo usaba), así que corría a 4
      rondas por segundo real pasara lo que pasara con el reloj — de ahí una deriva
      silenciosa al bajar de 15 a 6. Ahora el daño va por `dt/COMBAT_REF_MINUTES` y
      `battleTicks` pasa a `battleMinutes`. Medido: la misma batalla dura 880 min de
      juego con pasos de 0,1 y de 6 min, con HP final idéntico.
      **Progresión offline** (`catchUpOffline` en main.js): al cargar se mide el reloj de
      pared y se adelanta la simulación a pasos de 30 min de juego, con cartel de
      progreso y resumen de lo ocurrido. Tope de 14 días de juego. Sin esto el reloj
      lento dejaba el juego muerto: nadie deja el navegador abierto 3 horas
- [x] **Edificios en el mapa rediseñados** (2026-09-11): sin el panel negro semitransparente
      (y sin sombra de canvas, medida en ×2,4 el coste de la fila), un 60 % más grandes,
      en columna A UN LADO para dejar el centro a las unidades. El **puerto** se planta
      hacia la costa (`seaDirFor`, cacheado) y los **aviones en base se posan en fila
      junto a la pista** del aeródromo en vez de junto al centro de la provincia
- [x] **Parte de combate en la ficha** (2026-09-11): al hacer clic en una unidad en
      combate se ve contra quién pelea, la vida de cada bando y el ritmo al que se
      desgastan, con pronóstico ("el enemigo cae en 12 h"). El ritmo lo MIDE el motor
      (`dmgInPerH`/`dmgOutPerH` en combat.js) en vez de rehacer la fórmula en la UI
- [x] **Obra y reclutamiento en paralelo** (2026-09-11): `ps.queue` se queda con la obra
      (un edificio o una anexión) y aparece `ps.recruits`, hasta `RECRUIT_SLOTS` = 2
      unidades a la vez. Antes una sola ranura servía para todo: levantar una fábrica
      dejaba la provincia sin reclutar durante días. De paso, `startBuilding` no
      comprobaba la cola y podía borrar una anexión en curso con lo pagado dentro
- [ ] Apoyo aéreo cercano, formaciones al mover, ciudades con red vial bajo las
      unidades (como la referencia)

## v1.4 — Combate aéreo y aviación embarcada (2026-09-10)

Especificación completa en **docs/AIR-COMBAT.md**. Todo lo de abajo está hecho y verificado.

- [x] **Tiempo real de verdad** (`1eccf1f`): la partida avanza con la pestaña oculta.
      `requestAnimationFrame` se para del todo en segundo plano, así que la simulación
      pasa a ir por RELOJ DE PARED (`pump()` en main.js + `setInterval` de respaldo) y el
      bucle de frames solo dibuja. La recuperación al volver está acotada por presupuesto
      (`CATCHUP_BUDGET_MS`) para no colgar la pestaña tras horas fuera
- [x] **Ficha de unidad** (`db4d241`): clic en una tropa del mapa abre su hoja (HP, nivel,
      estado, armas) y sus órdenes. Hit-test contra lo REALMENTE dibujado (`unitHits`),
      incluidas órbitas aéreas y unidades interpoladas en marcha
- [x] **Combate aéreo** (`d0e7853`): 22 armas guiadas con cifras reales, cargas por avión
      (`AIR_LOADOUTS`, 26 aparatos), radar con alcance mayor que el misil, disparo contra
      UNIDAD concreta, probabilidad de derribo (Pk por curva de alcance, evasión y
      veteranía), reacción antiaérea, rearme en base y IA simétrica.
      `AIR_RANGE_SCALE = 4` lleva las cifras reales a la geografía del teatro (la distancia
      mediana entre provincias adyacentes son 324 km); misma provincia = distancia 0
- [x] **Furtividad de dos ejes** (`c45b738`, `1d16619`): `rcs` (que no te VEAN, recorta el
      alcance de detección) y `evasion` (que no te ACIERTEN, recorta la Pk). F-35A y dron
      RQ-190 añadidos. Contrapeso: radares de vigilancia terrestres con `antiStealth` que
      reparten contactos a todo el bando por datalink
- [x] **Aviación embarcada** (`1d16619`, `52019a3`, `bbaf727`): capacidad por portaviones
      (Kitty Hawk 3 · Nimitz 4 · Ford 6 · Kiev 2 · Kuznetsov 3 · Shtorm 5), solo aparatos
      de cubierta (`CARRIER_CAPABLE`), rearme a bordo y el ala viaja con el buque.
      El apontaje era INALCANZABLE: `orderMove` rechazaba todo destino marítimo para una
      unidad no naval, así que el avión nunca podía llegar al buque. Ahora `carrierBerths`
      (movement.js) autoriza el destino si allí hay portaviones propio parado con plaza, y
      al llegar aponta solo. Chapa de cubierta en el mapa con plazas ocupadas ("2/4")
- [x] **Ritmo global** (`175907b`, `455e709`): `MINUTES_PER_TICK_BASE` 15 → 6. La palanca
      real de "todo va rápido" era el RELOJ, no las velocidades: a 4 ticks/s, 15 daba una
      hora de juego por segundo real. Con 6 todo se ralentiza por igual sin tocar balance.
      Las fichas muestran la velocidad REAL del aparato (`velocidadKmH`) y aparte el ritmo
      en el mapa: no se pueden derivar una de otra con un divisor único (un Apache vuela a
      293 km/h y un Su-27 a 2.500)
- [x] **Espacio aéreo neutral cerrado** (`175907b`): los aéreos ya no tienen sobrevuelo
      libre. Entrar en país neutral exige declararle la guerra y la UI lo ofrece en el
      momento en vez de fallar con un "sin ruta" seco
- [x] **Regreso a base** (`175907b`, `161081f`): "Detener" en vuelo manda al aeródromo
      propio más cercano, y al llegar el avión se posa en pista en vez de orbitar eternamente
- [x] **Banderas reales de los 29 países** (`9704197`): gradientes CSS, no emoji (Windows
      pinta los indicadores regionales como las dos letras) ni 29 SVG. Leyenda de la
      nomenclatura de sprites añadida a docs/ASSETS-SPRITES.md
- [x] Bugs corregidos por el camino (`5df4bc2`, `6c3cd68`): coste de edificio en el panel
      (mostraba siempre el de nivel 1), edificios sin dibujar en el mapa, barrido del radar
      que se reiniciaba a las 2 en punto (el `innerHTML` completo cada 250 ms recreaba el
      elemento y reiniciaba la animación CSS → armazón estable), aviones demasiado rápidos
      y girando sobre su propio eje

## v1.5 — Formaciones, espacio aéreo y ritmo (2026-09-12)

- [x] **Formaciones** (docs/FORMACIONES.md): unir tropas en una sola ficha, heterogénea y
      persistente. Tres dominios que no se mezclan (tierra / aire / mar), nombre derivado
      de la composición (Regimiento Acorazado, Grupo Táctico, Manada de Submarinos…),
      escalones por número, sprite del miembro que manda, velocidad del más lento, tope de
      16 y desacople de una en una. NO suma ataque ni defensa: es un envoltorio de mando.
      Sustituye a la pila implícita de `stackFor()`, que solo agrupaba el MISMO tipo
- [x] **Espacio aéreo libre** (revierte la decisión de v1.4): los aéreos vuelven a
      sobrevolar territorio neutral sin declarar la guerra. La frontera del avión pasa a
      ser física en vez de política
- [x] **Radio de acción aéreo**: cada aparato solo alcanza cierta distancia de su base
      (aeródromo propio o portaviones). Drone 1200/2200/3200 km · bombardero 1000/1400/1800 ·
      caza 500/700/900 · helicóptero 250/350/450 · RQ-190 4200. Disco semitransparente en
      el mapa centrado EN LA BASE al seleccionar el aparato. Sin ninguna base propia el
      límite no se aplica
- [x] **Patrulla sobre el mar**: un avión ya puede patrullar un sector marítimo sin
      portaviones debajo y revelar barcos enemigos; al agotarse la patrulla vuelve a base.
      Quedarse en el mar sigue exigiendo portaviones
- [x] **Reloj a 15 min reales = 1 día de juego**: `MINUTES_PER_TICK_BASE` 0.1 → 0.4
- [x] **Botones que necesitaban varias pulsaciones** (y parpadeo al pasar por encima): los
      paneles se reescribían enteros con `innerHTML` cada 250 ms, así que el `mousedown` y
      el `mouseup` caían en nodos distintos y el `click` nunca se emitía. `setPanelHTML`
      solo reescribe si el contenido cambió, y nunca mientras el puntero está sobre un botón
- [x] **Iconos del mapa**: insignia de recuento legible (plato oscuro, borde del país, texto
      blanco de 14 px, escala con el zoom) y tamaño por categoría aérea — bombardero ×1.22,
      helicóptero ×0.92, drone ×0.78
- [x] **docs/INDICE.md**: índice de toda la documentación por tema, para no releerla entera

### v1.5.1 — Ajustes sobre la marcha

- [x] **Alcance aéreo duplicado** y bombarderos estratégicos aparte: B-21 9600 km, B-2 y
      Tu-160M 9000, RQ-190 8400. Los tres pasan por encima del dron de T3
- [x] **Sobrevuelo restringido a quien no se ve**: drones siempre, tripulados solo con
      `rcs ≥ 0.6` (B-2, B-21, F-22, F-35, Su-57). El Tu-160M queda fuera pese a su alcance:
      en el radar es enorme. Un caza convencional vuelve a necesitar declarar la guerra
- [x] **Anillo de alcance de tiro** en el mapa para artillería y cualquier unidad con
      `rangoKm`, centrado en la pieza. Rojo, para distinguirlo de los discos aéreos
- [x] **Tiro a distancia dentro de una formación**: las piezas con alcance abren fuego y el
      resto de la columna mantiene posición, en vez de partirse en dos provincias
- [x] **Reconocimiento terrestre**: la motorizada (380/470/560 km) y el cazatanques
      (430/520/610 km) descubren enemigos en su radio, como los drones pero mucho más
      cerca. Círculo verde solo con la unidad seleccionada. Documentado en
      docs/RECONOCIMIENTO.md
- [x] **Visión de los drones subida** a 700/1100/1500 km (era 120/200/300). Con las cifras
      viejas no llegaban ni a la provincia vecina —la mediana entre vecinas son 324 km— y
      un Bradley habría visto más que un MQ-9

## v1.6 — Puntos de vida por unidad y doctrinas asimétricas (2026-09-12)

- [x] **HP por unidad**: sale de `CATEGORY_HP × doctrina × tier` y el panel lo muestra
      sobre el máximo real ("56 / 90", no "56 / 100"). Antes TODO tenía 100 y un
      portaviones encajaba lo mismo que un pelotón de fusileros
- [x] **Abanico naval abierto**: portaviones 450 · destructor 220 · transporte 160 ·
      fragata 150 · submarino 120 · corbeta 90. Es donde estaba el problema que se
      quería resolver y donde se pudo resolver
- [x] **Abanico terrestre NO abierto, y medido**: `tools/test-variants.mjs` demostró que
      el sistema de counters está calibrado con HP uniforme. Con infantería 87 y MBT 107
      —un 23 % de diferencia— ya se rompe R7; con 63/126 se caen R2, R4, R6, R7 y R10.
      El HP compone al cuadrado y desborda cualquier ventaja de ataque o terreno.
      Abrirlo exige reescribir las matrices de ataque enteras: proyecto aparte
- [x] **Doctrinas invertidas**: ORIENTE AGUANTA (+2-5 % HP), OCCIDENTE PEGA (+4-9 %
      ataque). Antes era al revés y no se correspondía con nada reconocible. Los
      márgenes son pequeños porque están MEDIDOS: un +10 % de vida con ataque igual
      daba el 100 % de las batallas de stack. Equilibrio final: occ 4 · ori 6 duelos por
      categoría, 68 % de victorias orientales en stack mixto
- [x] **Unidades nuevas a vida completa**: nacían con 50 HP y tardaban 200 horas de
      juego en curarse. Se pagaban 350.000 por un portaviones y salía a mitad de vida
- [x] **El daño escala con la vida en los tres caminos a distancia**: ya lo hacía el
      combate por provincia, pero el tiro de artillería y la probabilidad de acierto de
      los misiles aire-aire lo ignoraban — un caza con 5 HP disparaba igual que uno
      intacto
- [x] **Reglas derivadas pasadas a porcentaje**: retirada (30 % del máximo, no 30
      puntos), desgaste, regeneración y caída de moral
- [x] **Migración de guardados** (`migrateHp`): conserva el porcentaje exacto y es
      idempotente
- [x] **Banco de pruebas actualizado** para replicar el motor nuevo (HP por unidad,
      daño por fracción, retirada y HP final en porcentaje): **97 PASS · 0 FAIL**
- [x] **Ventaja naval occidental**: en el mar aguanta más Occidente, al revés que en
      tierra. Portaviones +10 %, destructor +5 %, fragata +4 %, corbeta y transporte
      +3 %. El submarino es la única clase donde manda Oriente (−2 %): es su arma naval
      fuerte de verdad. El contrapeso occidental sigue siendo el +1 de ataque antibuque
      oriental que ya estaba en los datos
- [ ] **Pendiente**: no hay banco de pruebas NAVAL. El contrarreloj de docs/NAVAL.md
      quedó marcado como no revalidado, y el +10 % del portaviones es el número a
      vigilar — en tierra se midió que un 10 % de vida decide el 100 % de los combates

## v1.7 — Guerra aeronaval y fichas con papel (2026-09-12)

- [x] **Los aviones ya pueden atacar buques**: hasta ahora NINGÚN arma aire-suelo
      llevaba categorías navales en su lista de blancos, así que era literalmente
      imposible. Las bombas pesadas y los Maverick alcanzan cualquier casco; el
      anticarro ligero de helicóptero, solo corbetas y transportes
- [x] **Defensa antiaérea propia de cada buque** (NAVAL_AA): alcance, probabilidad de
      acierto, intercepción de misiles y anulación de furtividad, por clase, doctrina y
      tier. Destructor t2 occidental: 126 km, 52 % de acierto, 66 % de intercepción.
      El portaviones se defiende poco solo (23 km) y el submarino NADA en absoluto
- [x] **La furtividad es la llave del grupo de combate**: un destructor t2 toca a un
      B-52 el 52 % de las veces y a un B-21 el 9 %. Ese es el motivo de existir del
      bombardero furtivo
- [x] **CIWS**: los misiles que van hacia un buque pueden ser derribados antes de la
      tirada de impacto. Los antirradar son un 40 % más difíciles de interceptar
- [x] **Etiquetas y papel por unidad** (js/data/roles-data.js): cada ficha abre con su
      papel, una fila de etiquetas de colores (verde lo que destaca, rojo su
      vulnerabilidad, azul lo que solo ella hace) y una frase de para qué sirve en
      batalla. Se deriva de la categoría, no se escribe unidad por unidad: con 96
      variantes, mantener 96 textos a mano se habría desfasado al primer reajuste

## v1.8 — Banco de pruebas naval (2026-09-12)

- [x] **tools/test-naval.mjs**: 32 aserciones que cubren el schema de las 36 variantes,
      el escalado de vida por tier, el triángulo naval, la competitividad entre
      doctrinas, la defensa antiaérea de los buques y el ataque aéreo contra ellos.
      Era la deuda más clara del sistema naval y al saldarla apareció un problema real
- [x] **Corregido el desequilibrio naval que nadie veía**: con el +1 de ataque antibuque
      oriental intacto, ORIENTE ganaba el 98 % de las batallas de flota — lo contrario de
      lo que se había pedido. Se le quita ese +1 a la superficie oriental y el margen de
      vida occidental baja del 10 % al 2 %. Reparto final: la superficie es de Occidente
      (gana las 5 clases), el submarino es de Oriente (+8 % de vida y conserva su +1).
      Flota contra flota: Oriente gana el 24 %, dentro de la banda sana
- [x] **Triángulo naval verificado**: destructor > submarino > portaviones > superficie >
      destructor. Ninguna clase gana a todas
- [x] **La vida final se mide en PORCENTAJE**, no en puntos: con un abanico de 90 a 528
      HP, la suma bruta no compara nada
- [x] docs/NAVAL.md con la tabla de duelos regenerada y el histórico de configuraciones
      medidas, para que nadie vuelva a tocar el margen a ojo

### v1.8.1 — Retirada de las etiquetas y patrulla sobre base propia

- [x] **Quitado el bloque de etiquetas de la ficha** (js/data/roles-data.js, el bloque del
      panel y sus estilos). Las píldoras de colores no encajaban con el resto de la
      interfaz. La información sigue en las matrices y en los documentos
- [x] **Los aparatos con misión de patrulla ya orbitan aunque estén sobre su propio
      aeródromo.** La regla de dibujo solo miraba el suelo —"¿hay pista aquí?"— y nunca
      si el aparato tenía misión, así que mandar un dron a patrullar su propia base
      aceptaba la orden (la cuenta atrás corría) pero el mapa lo pintaba aparcado, y
      parecía que el botón no hubiera hecho nada. Venía de la v1.4

### v1.8.2 — Traslado de aviación entre bases

- [x] **Mover un aparato a otro aeródromo propio ya no lo frena el radio de combate.**
      Un traslado es solo de ida —el avión se queda en la base nueva— así que el
      depósito cunde el doble: `FERRY_MULT = 2`. Antes, llevar un escuadrón al
      aeródromo recién construido al otro lado del país era imposible, aunque fuera
      exactamente para eso para lo que se había construido
- [x] Vale también para apontar en un portaviones propio con plaza libre
- [x] Si ni el radio doble llega, el aviso propone mover **por etapas, saltando de base
      en base**, en vez de un "fuera de alcance" seco
- [x] El mapa pinta los dos: disco relleno = donde puede combatir · anillo exterior
      tenue = hasta dónde puede mudarse

### v1.8.3 — El dron descubre mientras vuela, y otros arreglos

- [x] **El reconocimiento sigue a la unidad en movimiento.** La inteligencia se calculaba
      desde `u.pos`, que es la provincia de ORIGEN hasta que el viaje termina, así que un
      dron cruzando medio continente no revelaba nada por el camino: su burbuja se
      quedaba clavada en el aeródromo del que salió y solo daba el salto al aterrizar.
      Ahora se interpola el tramo en curso (`unitGeoPos`), en el motor y en el mapa
- [x] **El botón ⚔ Atacar se desactiva en los drones.** `combat.js` los excluye del
      combate de provincia, así que la orden no hacía nada: el aparato volaba hasta el
      enemigo y se quedaba mirando. El RQ-2 Pioneer llegaba a ofrecer atacar sin llevar
      un solo arma. Los drones armados sí disparan, pero desde el panel de radar
- [x] **Apontar en portaviones propio queda exento del radio de acción.** Un portaviones
      está en mitad del océano; si el avión no puede llegar, el ala embarcada es
      inservible. Solo la aviación de cubierta y solo con plaza libre
- [x] **Mejor aviso al mover dentro de la propia provincia.** Decía "esa unidad ya está
      ahí" sin explicar nada; ahora nombra la provincia y dice la regla — las unidades se
      mueven entre provincias enteras, no a un punto dentro de una

### v1.8.4 — Apontar en un portaviones en movimiento

- [x] **Un portaviones ya recoge aviación navegando.** Se exigía que estuviera parado, y
      eso dejaba a todo el ala embarcada sin poder volver a casa en cuanto el grupo
      zarpaba
- [x] **Tarea `board`**: la orden de ir a un portaviones propio lo PERSIGUE — reencamina
      cada tick hacia su posición actual y aponta al coincidir. Sin ella, el avión volaba
      al sector del que el buque ya había zarpado y se quedaba flotando sobre el mar.
      Misma mecánica que `tickHunt`, con apontaje en vez de disparo
- [x] Si el buque se hunde o la cubierta se llena durante el vuelo, el aparato **vuelve
      solo a base** en vez de quedarse sobre el agua
- [x] Vale para los drones de cubierta (RQ-190, Orion), no solo para los cazas
- [x] Verificado que el reconocimiento **NO es persistente**: al alejarse el dron, las
      provincias vuelven a ocultarse. `intelFor` se recalcula entera cada tick
