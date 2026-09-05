# Wardern

RTS de gran estrategia en tiempo real, single-player contra bots. Mapa de toda
América (Canadá → Argentina + Caribe), países reales modernos, estilo
Conflict of Nations: WW3. UI en español. Sin dependencias: JavaScript vanilla +
Canvas 2D, corre en cualquier navegador.

---

## Ejecutar el juego (pasos específicos)

### Windows (lo más rápido)
1. Doble clic en **`start.bat`** — arranca el servidor y abre el navegador.
2. Si no se abre solo: entra a **http://localhost:8099**.
3. Haz clic en un país del mapa → **Jugar como…** → a jugar.

### Manual (Windows / macOS / Linux)
```bash
cd wardern
python serve.py            # servidor estático SIN caché, puerto 8099
# opción: python serve.py --port 8080   (otro puerto)
# alternativa sin Python: npx serve -l 8099 .
```
2. Abre **http://localhost:8099** en Chrome/Edge/Firefox.
3. Elige país → **Jugar como…**

> El servidor sin caché es importante: garantiza que los cambios de código y de
> sprites aparezcan al refrescar (F5).

### Requisitos
- Navegador moderno (Chrome/Edge/Firefox). Nada más para jugar.
- Python 3 (solo como servidor estático; vale cualquier servidor sin caché).
- Node ≥ 22 SOLO para las herramientas: regenerar el mapa (`tools/build-map.mjs`)
  y correr los tests de balance (`tools/test-variants.mjs`).

### La partida se guarda sola
Autoguardado en `localStorage` del navegador cada 2 min + botones **Guardar /
Exportar / Importar** en la barra superior. Mismo navegador + mismo puerto =
misma partida.

---

## Cómo jugar

- **Objetivo:** controlar ≥ 55 % de los puntos de victoria del continente.
- **Cámara:** arrastrar = mover · rueda = zoom · clic = seleccionar provincia/celda de mar.
- **Construir** (provincia propia): Industria (+suministros), Oficina de reclutamiento
  (+mano de obra), **Base aérea** (nivel 1 = aviones T1; nivel 2 = T2; nivel 3 = T3),
  **Puerto** (provincia costera; nivel = tier de barcos reclutables), Fortaleza (+defensa).
  Los botones bloqueados dicen el motivo exacto al pasar el cursor.
- **Reclutar:** cada fila muestra el sprite de la unidad real. Las aeronaves exigen
  Base aérea en ESA provincia; los barcos, Puerto del tier correspondiente.
- **Mover:** botón **Mover** → clic en destino (clic derecho cancela). Las unidades
  viajan orientadas a su rumbo y muestran "Llega en Xh Ym".
- **Aviones** orbitan su base en patrulla visual; los **drones** (MQ-9, Orlan…) revelan
  un círculo de visión (120/200/300 km según tier).
- **Marina:** el transporte **Embarca** hasta 3 unidades desde costa con puerto,
  cruza el mar celda a celda y **Desembarca** para invadir costas.
- **Misiles (botón 🚀 Misil):** destructores (Tomahawk, 1.200 km), fragatas T3
  (Harpoon antibuque), artillería t2+ (salva MLRS, 350 km) y bombardero T3 (misil de
  crucero, 1.000 km). Clic en el objetivo → vuela → impacto. Sin reconocimiento del
  objetivo el disparo se rechaza (mándale un dron).
- **Inteligencia de guerra (2 niveles):** en tus provincias, con tus tropas dentro o
  bajo círculo de dron ves las unidades enemigas exactas; solo con frontera las ves
  como contactos **"?"** sin identificar.
- **Combate:** automático al compartir provincia con enemigo en guerra; retirada
  automática con HP < 30 o moral baja; veteranía ▲▲▲ por experiencia.
- **Combustible:** las regiones petroleras se marcan con una gota negra (Texas,
  Alberta, Campeche/Tabasco, Maracaibo, pre-sal, Vaca Muerta…). Sin región petrolera
  tu capital produce una base mínima. Las flotas y el mantenimiento consumen fuel.

---

## Trabajar los assets (sprites)

Todo vive en **`assets/sprites/`** — el inventario completo con nombres de archivo,
vehículo real de cada variante y especificaciones está en
[docs/ASSETS-SPRITES.md](docs/ASSETS-SPRITES.md).

- **Formato:** SVG, `viewBox="0 0 128 128"`, vista superior con morro/proa al norte.
- **Tinte por país:** cada SVG declara clases CSS — tintibles `.base/.shade/.light/.hi`
  (fuselaje/casco/chasis) y fijas `.dark/.metal/.metalS/.metalL/.glass/.rubber`.
  Las capas de luz/sombra solo blanco/negro con opacidad. Sin `<text>` ni scripts.
- **Nombres:** `v-occ-2-mbt.svg` = M1 Abrams · `v-ori-3-mbt.svg` = T-90M ·
  `v-occ-2-destructor.svg` = Arleigh Burke… (tabla completa en ASSETS-SPRITES.md).
- **Recarga:** el juego reintenta cada 5 s los archivos que faltaban; si editas un
  SVG basta refrescar (F5). Si falta una variante, cae al sprite de su categoría.
- Los 96 sprites usan el campo `name` de `js/data/units-data.js` y
  `js/data/naval-data.js` como guía de silueta real (F-16A, Arleigh Burke, T-90M…).

---

## Estructura del proyecto

```
assets/sprites/     119 SVG: 96 variantes + 16 categorías + 5 edificios + 2 proyectiles
css/                estilos de UI
js/data/            datos: mapa (270 provincias), unidades, navales, doctrinas,
                    misiles, fuel, sprites, constantes
js/engine/          motor: sim (tick 250 ms), state, combat, movement, economy,
                    missiles, naval, ai
js/render/          renderer canvas, symbols OTAN (fallback), sprite-cache con tinte
js/ui/              paneles, pantalla de inicio, registro
tools/              build-map.mjs (Natural Earth → 270 provincias) y
                    test-variants.mjs (97 aserciones de balance)
docs/               GDD, arquitectura, roadmap, arte, inventario de assets…
serve.py            servidor estático sin caché (puerto 8099)
start.bat           arranque de un clic en Windows
```

## Verificaciones

```bash
node tools/test-variants.mjs   # 97 aserciones de balance (deben pasar 97/97)
```

## Documentación

- [docs/GDD.md](docs/GDD.md) — diseño de juego (alcance, economía, combate, IA)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura y contratos de datos
- [docs/ROADMAP.md](docs/ROADMAP.md) — fases y estado
- [docs/UNITS.md](docs/UNITS.md) — roster y rationale de balance
- [docs/NAVAL.md](docs/NAVAL.md) — sistema naval
- [docs/MISSILES.md](docs/MISSILES.md) — misiles y drones de reconocimiento
- [docs/ARTE.md](docs/ARTE.md) — guía de estilo de sprites
- [docs/ASSETS-SPRITES.md](docs/ASSETS-SPRITES.md) — inventario completo de assets
- [docs/DATA-NOTES.md](docs/DATA-NOTES.md) — pipeline de datos del mapa
