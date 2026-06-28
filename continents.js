// Configuración de continentes disponibles en el menú.
// Para añadir un nuevo continente en el futuro: añadir una entrada aquí
// y un archivo data/<id>.geojson con properties.name_es y properties.capital.
const CONTINENTS = [
  {
    id: "africa",
    name: "África",
    enabled: true,
    getData: () => AFRICA_GEOJSON,
  },
  {
    id: "europa",
    name: "Europa",
    enabled: true,
    getData: () => EUROPE_GEOJSON,
  },
  {
    id: "asia",
    name: "Asia",
    enabled: true,
    getData: () => ASIA_GEOJSON,
  },
  {
    id: "america",
    name: "América",
    enabled: true,
    getData: () => AMERICA_GEOJSON,
  },
  {
    id: "oceania",
    name: "Oceanía",
    enabled: true,
    getData: () => OCEANIA_GEOJSON,
  },
];

// Zonas/regiones predefinidas por continente para el modo "Practicar por zonas".
// Un mismo país (ISO 3166-1 alpha-3) puede aparecer en varias zonas a la vez.
const REGIONS = {
  africa: [
    {
      id: "norte",
      name: "Norte de África",
      isos: ["DZA", "EGY", "LBY", "MAR", "TUN", "ESH", "SDN"],
    },
    {
      id: "occidental",
      name: "África Occidental",
      isos: ["BEN", "BFA", "CPV", "CIV", "GMB", "GHA", "GIN", "GNB", "LBR", "MLI", "MRT", "NER", "NGA", "SEN", "SLE", "TGO", "SHN"],
    },
    {
      id: "oriental",
      name: "África Oriental",
      isos: ["BDI", "COM", "DJI", "ERI", "ETH", "KEN", "MDG", "MWI", "MUS", "MOZ", "RWA", "SYC", "SOM", "SSD", "TZA", "UGA", "SDN", "REU", "MYT"],
    },
    {
      id: "central",
      name: "África Central",
      isos: ["AGO", "CMR", "CAF", "TCD", "COG", "COD", "GNQ", "GAB", "STP"],
    },
    {
      id: "austral",
      name: "África Austral",
      isos: ["BWA", "LSO", "NAM", "ZAF", "SWZ", "ZMB", "ZWE"],
    },
  ],
  europa: [
    {
      id: "norte",
      name: "Norte de Europa",
      isos: ["DNK", "EST", "FIN", "ISL", "IRL", "LVA", "LTU", "NOR", "SWE", "GBR", "JEY", "GGY", "IMN", "ALA", "FRO", "SJM"],
    },
    {
      id: "occidental",
      name: "Europa Occidental",
      isos: ["AUT", "BEL", "FRA", "DEU", "LIE", "LUX", "MCO", "NLD", "CHE"],
    },
    {
      id: "este",
      name: "Europa del Este",
      isos: ["BLR", "BGR", "CZE", "HUN", "POL", "MDA", "ROU", "RUS", "SVK", "UKR"],
    },
    {
      id: "sur",
      name: "Europa del Sur",
      isos: ["ALB", "AND", "BIH", "HRV", "GRC", "VAT", "ITA", "MLT", "MNE", "MKD", "PRT", "SMR", "SRB", "SVN", "ESP", "GIB"],
    },
  ],
  asia: [
    {
      id: "central",
      name: "Asia Central",
      isos: ["KAZ", "KGZ", "TJK", "TKM", "UZB"],
    },
    {
      id: "oriental",
      name: "Asia Oriental",
      isos: ["CHN", "PRK", "KOR", "JPN", "MNG", "TWN", "HKG", "MAC"],
    },
    {
      id: "sudoriental",
      name: "Sudeste Asiático",
      isos: ["BRN", "KHM", "IDN", "LAO", "MYS", "MMR", "PHL", "SGP", "THA", "TLS", "VNM", "CCK", "CXR"],
    },
    {
      id: "meridional",
      name: "Sur de Asia",
      isos: ["AFG", "BGD", "BTN", "IND", "IRN", "MDV", "NPL", "PAK", "LKA"],
    },
    {
      id: "occidental",
      name: "Asia Occidental y Oriente Medio",
      isos: ["ARM", "AZE", "BHR", "CYP", "GEO", "IRQ", "ISR", "JOR", "KWT", "LBN", "OMN", "PSE", "QAT", "SAU", "SYR", "TUR", "ARE", "YEM"],
    },
  ],
  america: [
    {
      id: "norte",
      name: "Norteamérica",
      isos: ["CAN", "USA", "GRL", "BMU", "SPM"],
    },
    {
      id: "centro",
      name: "América Central",
      isos: ["BLZ", "CRI", "SLV", "GTM", "HND", "MEX", "NIC", "PAN"],
    },
    {
      id: "caribe",
      name: "El Caribe",
      isos: ["ATG", "BHS", "BRB", "CUB", "DMA", "DOM", "GRD", "HTI", "JAM", "KNA", "LCA", "VCT", "TTO", "AIA", "ABW", "BES", "VGB", "CYM", "CUW", "GLP", "MTQ", "MSR", "PRI", "BLM", "MAF", "SXM", "TCA", "VIR"],
    },
    {
      id: "sur",
      name: "América del Sur",
      isos: ["ARG", "BOL", "BRA", "CHL", "COL", "ECU", "GUY", "PRY", "PER", "SUR", "URY", "VEN", "FLK", "GUF"],
    },
  ],
  oceania: [
    {
      id: "australia_nz",
      name: "Australia y Nueva Zelanda",
      isos: ["AUS", "NZL", "NFK"],
    },
    {
      id: "melanesia",
      name: "Melanesia",
      isos: ["PNG", "SLB", "VUT", "FJI", "NCL"],
    },
    {
      id: "micronesia",
      name: "Micronesia",
      isos: ["FSM", "MHL", "NRU", "PLW", "GUM", "MNP"],
    },
    {
      id: "polinesia",
      name: "Polinesia",
      isos: ["WSM", "TON", "TUV", "KIR", "COK", "PYF", "NIU", "PCN", "TKL", "ASM", "WLF"],
    },
  ],
};

// Algunos países tienen territorios tan extensos o alejados (p.ej. Rusia)
// que si se usan para calcular el encuadre automático del mapa, empequeñecen
// demasiado al resto de países del continente. Se siguen dibujando y se
// pueden seguir pulsando con normalidad: solo se ignoran al calcular el zoom.
const FIT_BOUNDS_EXCLUDE = {
  europa: ["RUS"],
};

// Algunos continentes contienen países que cruzan el antimeridiano de forma
// real (p.ej. Fiyi, Kiribati o las islas Chatham de Nueva Zelanda en Oceanía).
// Sin rotar la proyección, esos países "se rompen" visualmente porque sus
// coordenadas saltan de +180 a -180. Rotar el mapa para que la costura caiga
// en el Atlántico (donde no hay países de ese continente) lo soluciona.
const PROJECTION_ROTATE = {
  oceania: [-180, 0],
};
