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
- [ ] Mercado de recursos
- [ ] Desbandar unidades / gestión de excedente de ejército
- [ ] Personalidades IA diferenciadas + dificultad seleccionable
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
- [ ] Sprites nivel CoN (pintorescos semi-3D con oclusión ambiental, rim light y
      sombras suaves): agente en curso con la nueva referencia
- [ ] Misiones de aire (patrulla con radio, apoyo aéreo cercano), formaciones al
      mover, ciudades con red vial bajo las unidades (como la referencia)
