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
- [ ] Etiquetas de países en el mapa y agrupación visual de stacks
- [ ] Puerto Rico como provincia (falta en el mapa; agregar en build-map.mjs)

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
