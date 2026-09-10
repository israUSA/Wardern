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
- [ ] **Rotación al rumbo vs. sprites 3/4** — bloquea al punto de arriba. Los sprites de
      tierra y mar son 3/4: rotarlos al rumbo los deja boca abajo. Solo la familia de aire
      tolera rotación. Decidir: quitar la rotación a tierra y mar (marcando el rumbo con
      flecha o estela) y dejarla solo en aire
- [ ] **Tinte por país en los sprites por variante** — los 96 usan gradientes propios en vez
      de las clases CSS `.base/.shade/.light/.hi`, así que hoy no responden al tinte. La
      doctrina se lee por paleta, el país no. Opciones: reescribir los `stop-color` en el
      sprite-cache, o aplicar un filtro suave por país
- [ ] Misiones de aire (patrulla con radio, apoyo aéreo cercano), formaciones al
      mover, ciudades con red vial bajo las unidades (como la referencia)
