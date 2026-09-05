// icons.js — Iconos DOM como SVG inline (strings listos para innerHTML).
// Estilo común: viewBox 24x24, trazo 2px #d8dee6, sin relleno, esquinas redondeadas.
// Legibles a 16px (width/height por defecto; CSS puede sobreescribirlos).

const STROKE = '#d8dee6';

// Envoltura SVG compartida por todos los iconos
function svg(inner) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"' +
    ' fill="none" stroke="' + STROKE + '" stroke-width="2" stroke-linecap="round"' +
    ' stroke-linejoin="round" aria-hidden="true">' +
    inner +
    '</svg>'
  );
}

// Dígito monoespaciado para los iconos de velocidad
function digit(d) {
  return (
    '<text x="19" y="15.5" font-family="monospace" font-size="10" text-anchor="middle"' +
    ' fill="' + STROKE + '" stroke="none">' + d + '</text>'
  );
}

export const ICONS = {
  // Dinero: círculo con símbolo $ (barra vertical + curva S)
  money: svg(
    '<circle cx="12" cy="12" r="9"/>' +
    '<path d="M12 4.5v15"/>' +
    '<path d="M15 9c0-1.5-1.3-2.5-3-2.5S9 8.5 9 10s1.3 2 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5-3-1-3-2.5"/>'
  ),

  // Suministros: caja con tapa y cinta en cruz
  supplies: svg(
    '<path d="M4 7l2-3h12l2 3"/>' +
    '<rect x="4" y="7" width="16" height="13"/>' +
    '<path d="M12 7v13M4 13.5h16"/>'
  ),

  // Combustible: gota
  fuel: svg(
    '<path d="M12 3.5c3.8 4.6 6 7.9 6 10.8a6 6 0 0 1-12 0c0-2.9 2.2-6.2 6-10.8z"/>'
  ),

  // Mano de obra: persona (cabeza + hombros)
  manpower: svg(
    '<circle cx="12" cy="8" r="3.5"/>' +
    '<path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/>'
  ),

  // Construcción: muro de ladrillos
  build: svg(
    '<rect x="3.5" y="13" width="8" height="5.5"/>' +
    '<rect x="12.5" y="13" width="8" height="5.5"/>' +
    '<rect x="8" y="6.5" width="8" height="5.5"/>'
  ),

  // Fortificación: torre con almenas y puerta
  fort: svg(
    '<path d="M5 21V8h3v2h2.5V8h3v2H16V8h3v13"/>' +
    '<path d="M10 21v-4.5h4V21"/>'
  ),

  // Guerra: espadas cruzadas con guardamano
  war: svg(
    '<path d="M4.5 4.5 17 17M19.5 4.5 7 17"/>' +
    '<path d="M13 19l6-6M7 13l4 4"/>'
  ),

  // Paz: símbolo de paz (círculo con líneas)
  peace: svg(
    '<circle cx="12" cy="12" r="9"/>' +
    '<path d="M12 3v18M12 12l-6.4 6.4M12 12l6.4 6.4"/>'
  ),

  // Velocidad: pausa (dos barras)
  speed_pause: svg('<path d="M9 5.5v13M15 5.5v13"/>'),

  // Velocidad 1x: play + dígito
  speed_1: svg('<path d="M4.5 5.5v13l9.5-6.5z"/>' + digit('1')),

  // Velocidad 2x: play + dígito
  speed_2: svg('<path d="M4.5 5.5v13l9.5-6.5z"/>' + digit('2')),

  // Velocidad 4x: play + dígito
  speed_4: svg('<path d="M4.5 5.5v13l9.5-6.5z"/>' + digit('4')),

  // Guardar: disquete
  save: svg(
    '<path d="M4.5 4.5h11.5l3.5 3.5v11.5h-15z"/>' +
    '<path d="M8 4.5v4h7v-4"/>' +
    '<rect x="8" y="13" width="8" height="6.5"/>'
  ),

  // Cargar: carpeta con flecha entrando
  load: svg(
    '<path d="M3.5 18.5V5.5h5.2l2 2h9.8v11z"/>' +
    '<path d="M12 10.5v6M9.5 14l2.5 2.5L14.5 14"/>'
  ),

  // Exportar: flecha saliendo de una bandeja
  export: svg(
    '<path d="M12 14.5v-10M8 8l4-4 4 4"/>' +
    '<path d="M4 14.5V19h16v-4.5"/>'
  ),

  // Unidad: soldado simplificado (casco + hombros)
  unit: svg(
    '<path d="M7.5 10a4.5 4.5 0 0 1 9 0"/>' +
    '<path d="M6 10h12"/>' +
    '<path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>'
  ),

  // Bandera: asta con banderín
  flag: svg(
    '<path d="M6 21V4"/>' +
    '<path d="M6 4.5h11.5L15 8l2.5 3.5H6"/>'
  ),

  // Cerrar: X
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),

  // Atacar: mira de objetivo (círculo + cruz + punto)
  attack: svg(
    '<circle cx="12" cy="12" r="7"/>' +
    '<path d="M12 2.5V7M12 17v4.5M2.5 12H7M17 12h4.5"/>' +
    '<circle cx="12" cy="12" r="1" fill="' + STROKE + '" stroke="none"/>'
  ),

  // Marina: ancla estilizada (arganeo, cruz y uñas)
  navy: svg(
    '<circle cx="12" cy="5" r="3"/>' +
    '<path d="M12 8v14"/>' +
    '<path d="M7.5 11h9"/>' +
    '<path d="M5 13H2a10 10 0 0 0 20 0h-3"/>'
  ),

  // Investigación: matraz Erlenmeyer con línea de líquido
  research: svg(
    '<path d="M9 3h6"/>' +
    '<path d="M10 3v5.2L4.6 19.3a1.1 1.1 0 0 0 1 1.7h12.8a1.1 1.1 0 0 0 1-1.7L14 8.2V3"/>' +
    '<path d="M7 15h10"/>'
  ),

  // Subir de nivel: doble chevron hacia arriba
  levelup: svg('<path d="M5 12.5 12 6l7 6.5M5 19.5 12 13l7 6.5"/>'),
};
