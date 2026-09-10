// =====================================================================
// Banderas de los 29 países jugables, como valor CSS de `background`.
//
// POR QUÉ NO SON IMÁGENES NI EMOJI:
//  - Los emoji de bandera (🇺🇸) NO funcionan en Windows: la fuente del sistema
//    dibuja el par de indicadores regionales como las dos letras del país, así
//    que se vería "US" en vez de la bandera. Descartado para un juego de
//    escritorio que corre ahí.
//  - Archivos SVG serían 29 assets más que descargar y cachear para pintar algo
//    de 22×15 px, donde ningún escudo ni estrella llega a distinguirse.
//
// A ese tamaño la identidad de una bandera vive en sus FRANJAS y COLORES, y eso
// un gradiente lo da exacto y gratis. Los emblemas centrales (el águila mexicana,
// el escudo ecuatoriano, la hoja de arce) se omiten a propósito: a 15 px de alto
// serían tres píxeles de barro. Los colores son los oficiales de cada bandera.
//
// Las capas de `background` van de ARRIBA a ABAJO: la primera tapa a las demás.
// =====================================================================

const vert = (a, b, c) =>
  `linear-gradient(90deg,${a} 0 33.34%,${b} 33.34% 66.67%,${c} 66.67%)`;
const horiz = (a, b, c) =>
  `linear-gradient(${a} 0 33.34%,${b} 33.34% 66.67%,${c} 66.67%)`;
// Triángulo apoyado en el asta (Cuba, Bahamas): dos medias diagonales opuestas
const triangulo = (color, ancho) =>
  `linear-gradient(to bottom right,${color} 0 49%,transparent 49%) 0 0/${ancho} 50% no-repeat,` +
  `linear-gradient(to top right,${color} 0 49%,transparent 49%) 0 100%/${ancho} 50% no-repeat`;

export const FLAGS = {
  // ---- Norteamérica ----
  USA: // 13 franjas + cantón azul (7 franjas de alto, 40% de ancho)
    `linear-gradient(#3c3b6e,#3c3b6e) 0 0/40% 53.85% no-repeat,` +
    `repeating-linear-gradient(#b22234 0 7.69%,#fff 7.69% 15.38%)`,
  CAN: `linear-gradient(90deg,#d80621 0 25%,#fff 25% 75%,#d80621 75%)`,
  MEX: vert("#006847", "#fff", "#ce1126"),
  GRL: // blanco sobre rojo con el disco desplazado al asta
    `radial-gradient(circle at 33% 50%,#d00c33 0 27%,transparent 27%),` +
    `linear-gradient(#fff 0 50%,#d00c33 50%)`,

  // ---- Centroamérica ----
  GTM: vert("#4997d0", "#fff", "#4997d0"),
  BLZ: `linear-gradient(#ce1126 0 13%,#003f87 13% 87%,#ce1126 87%)`,
  HND: horiz("#0073cf", "#fff", "#0073cf"),
  SLV: horiz("#0f47af", "#fff", "#0f47af"),
  NIC: horiz("#0067c6", "#fff", "#0067c6"),
  CRI: // azul/blanco/rojo doble/blanco/azul
    `linear-gradient(#002b7f 0 16.7%,#fff 16.7% 33.3%,#ce1126 33.3% 66.7%,#fff 66.7% 83.3%,#002b7f 83.3%)`,
  PAN: // cuartelada: blanco/rojo arriba, azul/blanco abajo
    `linear-gradient(90deg,#fff 0 50%,#da121a 50%) 0 0/100% 50% no-repeat,` +
    `linear-gradient(90deg,#072357 0 50%,#fff 50%) 0 100%/100% 50% no-repeat`,

  // ---- Caribe ----
  CUB: `${triangulo("#cf142b", "42%")},repeating-linear-gradient(#002a8f 0 20%,#fff 20% 40%)`,
  DOM: // cruz blanca partiendo cuatro cuarteles
    `linear-gradient(#fff,#fff) 0 50%/100% 14% no-repeat,` +
    `linear-gradient(90deg,#002d62 0 43%,#fff 43% 57%,#ce1126 57%) 0 0/100% 43% no-repeat,` +
    `linear-gradient(90deg,#ce1126 0 43%,#fff 43% 57%,#002d62 57%) 0 100%/100% 43% no-repeat`,
  HTI: `linear-gradient(#00209f 0 50%,#d21034 50%)`,
  JAM: // aspa dorada entre verde (arriba/abajo) y negro (asta/batiente)
    `linear-gradient(to bottom right,transparent 44%,#fed100 44% 56%,transparent 56%),` +
    `linear-gradient(to top right,transparent 44%,#fed100 44% 56%,transparent 56%),` +
    `linear-gradient(90deg,#000 0 26%,#009b3a 26% 74%,#000 74%)`,
  BHS: `${triangulo("#000", "31%")},${horiz("#00abc9", "#fae042", "#00abc9")}`,
  TTO: // banda negra ribeteada de blanco en diagonal sobre rojo
    `linear-gradient(to bottom right,transparent 37%,#fff 37% 43%,#000 43% 58%,#fff 58% 64%,transparent 64%),` +
    `linear-gradient(#da1a35,#da1a35)`,

  // ---- Sudamérica ----
  COL: `linear-gradient(#fcd116 0 50%,#003893 50% 75%,#ce1126 75%)`,
  ECU: `linear-gradient(#ffdd00 0 50%,#034ea2 50% 75%,#ed1c24 75%)`,
  VEN: horiz("#ffcc00", "#00247d", "#cf0821"),
  GUY: // flecha roja sobre flecha dorada, campo verde
    `${triangulo("#ce1126", "42%")},${triangulo("#fcd116", "72%")},linear-gradient(#009e49,#009e49)`,
  SUR: `linear-gradient(#377e3f 0 20%,#fff 20% 30%,#b40a2d 30% 70%,#fff 70% 80%,#377e3f 80%)`,
  PER: vert("#d91023", "#fff", "#d91023"),
  BRA: // rombo amarillo (elipse a este tamaño) y disco azul sobre verde
    `radial-gradient(circle at 50% 50%,#002776 0 17%,transparent 17%),` +
    `radial-gradient(ellipse 42% 70% at 50% 50%,#fedf00 0 100%,transparent 100%),` +
    `linear-gradient(#009c3b,#009c3b)`,
  BOL: horiz("#d52b1e", "#f9e300", "#007934"),
  PRY: horiz("#d52b1e", "#fff", "#0038a8"),
  CHL: // cantón azul sobre la mitad superior, blanco arriba y rojo abajo
    `linear-gradient(#0039a6,#0039a6) 0 0/34% 50% no-repeat,` +
    `linear-gradient(#fff 0 50%,#d52b1e 50%)`,
  ARG: horiz("#74acdf", "#fff", "#74acdf"),
  URY: // nueve franjas y cantón blanco del Sol de Mayo
    `linear-gradient(#fff,#fff) 0 0/40% 55.5% no-repeat,` +
    `repeating-linear-gradient(#fff 0 11.11%,#0038a8 11.11% 22.22%)`,
};

// Valor de `background` para un país. Si no tuviera bandera definida cae al color
// plano con el que se pinta en el mapa, que es lo que había antes.
export function flagCss(iso, fallbackColor) {
  return FLAGS[iso] || fallbackColor || "#7a8088";
}
