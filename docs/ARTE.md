# ARTE — Guía de sprites ilustrados (estilo Conflict of Nations)

Los iconos esquemáticos OTAN se reemplazan por **sprites SVG ilustrados** dibujados a mano
(en código, sin binarios): miniaturas semi-realistas del equipo real, como en Conflict of
Nations. Si la unidad es un F-16, el sprite debe verse como un F-16.

## Convenciones generales

- **Formato**: SVG de código, sin `<text>` ni fuentes. Fondo transparente.
- **viewBox**: unidades y edificios `0 0 128 128`; proyectiles `0 0 64 32` (Tomahawk,
  horizontal, avanza hacia la derecha) y `0 0 32 64` (Hellfire, vertical, punta hacia arriba).
- **Orientación**: vehículos, aviones y barcos en **vista superior (o 3/4 superior) con el
  morro/proa hacia el norte** (arriba del viewBox), para que el motor pueda rotarlos según el
  rumbo. La infantería y los edificios van en vista frontal/3/4 (no rotan).
- **Sombreado**: 2–3 tonos + luz y contorno sutil oscuro (`stroke #3d4232`). Detalles
  reconocibles: misiles bajo las alas del caza, cañón y canastilla del MBT, cubierta angular
  del portaviones, alas del Tomahawk, etc.

## Paleta base (neutra de doctrina)

Gama **gris-verde / oliva / metal**. El motor teñirá por país (ver más abajo); el sprite base
es deliberadamente neutro "occidental".

| Clase CSS  | Color     | Uso                                                      | ¿Tintible? |
|------------|-----------|----------------------------------------------------------|------------|
| `.base`    | `#7c8464` | Superficie principal (fuselaje, casco, carrocería, muro) | Sí         |
| `.shade`   | `#5b6349` | Sombras del mismo tono (panzas, alas inferiores, patios) | Sí         |
| `.light`   | `#9aa378` | Luces del mismo tono (lomos, bordes de ataque)           | Sí         |
| `.hi`      | `#b8bfa2` | Brillos puntuales (líneas de cubierta, cornisas)         | Sí (opc.)  |
| `.dark`    | `#3d4232` | Detalles fijos oscuros, contornos                        | No         |
| `.metal`   | `#6f767c` | Acero (cañones, cubierta del portaviones, submarino)     | No         |
| `.metalS`  | `#54595e` | Acero en sombra                                          | No         |
| `.metalL`  | `#939aa0` | Acero iluminado (misiles, radares)                       | No         |
| `.glass`   | `#3e607a` | Cabinas, cristales, ventanas                             | No         |
| `.glassL`  | `#7fa3ba` | Reflejo de cristales                                     | No         |
| `.rubber`  | `#2b2e28` | Neumáticos, orugas, llamas de humo                       | No         |

Fijos a propósito (no se tiñen): piel de la infantería (`#c8a17b`), llamas de proyectiles
(`#e8a33d` / `#f6d47c`), acero, cristal y caucho. Así el tinte de país solo afecta al
uniforme/equipo y todos los países comparten la misma lectura de materiales.

## Tinte por país (cómo lo aplicará el motor)

Los sprites declaran un `<style>` interno con las clases de la tabla. Para teñir por país:

1. **Vía CSS (recomendado si el SVG se inlinea o se pinta a canvas tras `fetch`)**: tras
   descargar el texto del SVG, inyectar reglas que sobreescriban `.base`, `.shade`, `.light`
   (y opcionalmente `.hi`) con la variante del país antes de rasterizar. Ejemplos de variantes:
   occidental = gris-verde base (`#7c8464`), oriental = verde más saturado/oscuro, etc.
2. **Vía filtro (si el SVG va en un `<img>`)**: aplicar `filter: hue-rotate(...) saturate(...)
   brightness(...)` al elemento. Es aproximado pero no requiere reescritura.

En los comentarios de cabecera de cada SVG se indica qué clases tintables y qué partes fijas
tiene ese sprite. El submarino y el portaviones usan acero (`.metal`) como superficie
principal: para diferenciar países conviene un filtro suave (brightness/hue) en vez de
reescribir `.base`.

## Regla de legibilidad

- Todo sprite debe **leerse y distinguirse a 40 px** (tamaño mínimo en el mapa). Prueba en el
  navegador con zoom 40/48/56 px: la silueta debe identificar la categoría (caza vs
  bombardero, MBT vs artillería) incluso en monocromo.
- Los detalles finos (misiles, troneras, líneas de panel) son premio a zoom mayor; nunca
  cargan la silueta base.
- Categorías con silueta deliberadamente contrastada entre sí: caza (delta corta + punta de
  aguja) vs bombardero (ala en flecha ancha) vs drone (ala recta larga + V-tail); MBT (orugas
  + torreta) vs cazatanques (ruedas + lanzador) vs artillería (cañón larguísimo).

## Inventario

- **Unidades (16)**: `assets/sprites/{infanteria,motorizada,mbt,cazatanques,artilleria,
  antiaereo,caza,bombardero,helicoptero,drone,corbeta,fragata,destructor,submarino,
  portaviones,transporte}.svg` — claves = categorías del motor.
- **Edificios (5)**: `assets/sprites/b-{puerto,aerobase,industria,reclutamiento,fortaleza}.svg`
  — claves = edificios de `js/data/constants.js`.
- **Proyectiles (2)**: `assets/sprites/m-tomahawk.svg`, `assets/sprites/m-hellfire.svg`.
- **Manifiesto**: `js/data/sprites.js` (`export const SPRITES = { unidades, edificios,
  proyectiles }`). Única fuente de rutas; el render no debe hardcodear paths.

## Sprites por variante (v1.3): cada unidad = su vehículo real

`SPRITES.variantes` (js/data/sprites.js) mapea los 96 ids de variante a
`assets/sprites/v-{id}.svg` — el F-16A dibuja un F-16 real, el M1 Abrams un Abrams,
el Arleigh Burke su superestructura SPY-1, el T-90M su cúpula con Shtora. El
sprite-cache hace fallback automático al sprite de la categoría si el archivo de la
variante aún no existe (reintento cada 5 s: los nuevos aparecen solos). Los 10 alias
legacy usan directamente el sprite de categoría. Guía de fidelidad para el artista:
lee el campo `nombre` de units-data.js/naval-data.js — es el vehículo real a
representar, con su silueta distintiva (cañón, alas, radares, propulsión).
