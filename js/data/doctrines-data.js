// Doctrinas militares y tiers de investigación de Wardern.
// Cada país (ISO de countries-data.js) queda asignado a una doctrina según el
// origen real de su equipamiento; la doctrina decide qué variantes terrestres,
// aéreas y navales puede reclutar (availableVariants en js/engine/state.js).
//
// Criterio histórico-geográfico (América, años 80 → ultra-moderno):
//  - OCCIDENTAL: órbita OTAN/occidente — EEUU y Canadá; México, Centroamérica y
//    Caribe (esfera de influencia de EEUU y programas FMS); Colombia, Ecuador y
//    Perú (cooperación militar con occidente); y el Cono Sur
//    (Brasil, Argentina, Chile, Uruguay, Paraguay): aunque con industria y compras
//    propias, su material es de procedencia occidental (Leopard 2 chilenos, F-16
//    y Gripen brasileños, TAM/M109 argentinos). No hay tercera doctrina: el motor
//    soporta dos y el "sabor propio" sureño vive en el roster occidental.
//  - ORIENTAL: bloque soviético/ruso o herencia de él — Cuba (T-62, BMP, MiG-23),
//    Venezuela (T-72B3, BMP-3, Buk, Su-30), Nicaragua (herencia sandinista:
//    T-55, Mi-24) y Bolivia (material chino/ruso: HJ-8, FN-6, K-8).
export const DOCTRINES = {
  occidental: {
    name: "Doctrina Occidental",
    desc: "Equipamiento OTAN y aliados: superioridad técnica, blindaje y aviónica. Variantes +defensa.",
    countries: [
      "USA", "CAN", "MEX", "GTM", "BLZ", "HND", "SLV", "CRI", "PAN",
      "DOM", "HTI", "JAM", "BHS", "TTO", "GRL",
      "COL", "ECU", "PER", "GUY", "SUR",
      "BRA", "ARG", "CHL", "URY", "PRY",
    ],
  },
  oriental: {
    name: "Doctrina Oriental",
    desc: "Equipamiento del bloque soviético/ruso: masa de fuego y presión artillera. Variantes +ataque.",
    countries: ["CUB", "VEN", "NIC", "BOL"],
  },
};

// Tiers de investigación (secuenciales; el ancla de balance es el tier 2 "Años 2000")
export const TIERS = [
  { id: 1, name: "Años 80", researchCost: { money: 60000, supplies: 6000 }, researchDays: 4 },
  { id: 2, name: "Años 2000", researchCost: { money: 140000, supplies: 14000 }, researchDays: 7 },
  { id: 3, name: "Ultra-moderno", researchCost: { money: 320000, supplies: 32000 }, researchDays: 10 },
];
