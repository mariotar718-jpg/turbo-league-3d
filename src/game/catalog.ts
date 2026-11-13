export type Rarity =
  | 'Común'
  | 'Raro'
  | 'Muy Raro'
  | 'Importado'
  | 'Exótico'
  | 'Mercado Negro';

export type ItemCategory =
  | 'body'
  | 'decal'
  | 'wheel'
  | 'boost'
  | 'explosion'
  | 'topper';

export type TeamColor = 'blue' | 'orange';

export type GameModeId = '1v1' | '2v2' | '3v3' | 'freeplay' | 'rumble';
export type DifficultyId = 'novato' | 'profesional' | 'estrella' | 'gran_campeon';

export interface GameItem {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: Rarity;
  description: string;
  previewHex: string;
  accentHex?: string;
}

export interface CrateDef {
  id: string;
  name: string;
  price: number;
  accentHex: string;
  description: string;
  weights: Record<Rarity, number>;
}

export interface TeamLoadout {
  bodyId: string;
  decalId: string;
  primaryColor: string;
  secondaryColor: string;
  wheelId: string;
  boostId: string;
  explosionId: string;
  topperId: string;
}

export interface PlayerStats {
  matches: number;
  wins: number;
  goals: number;
  saves: number;
  demos: number;
}

export interface InventoryEntry {
  instanceId: string;
  itemId: string;
  acquiredAt: number;
}

export interface SaveData {
  version: number;
  playerName: string;
  avatarIndex: number;
  credits: number;
  xp: number;
  inventory: InventoryEntry[];
  loadouts: {
    blue: TeamLoadout;
    orange: TeamLoadout;
  };
  stats: PlayerStats;
}

export const RARITY_ORDER: Rarity[] = [
  'Común',
  'Raro',
  'Muy Raro',
  'Importado',
  'Exótico',
  'Mercado Negro',
];

export const RARITY_COLORS: Record<
  Rarity,
  { hex: string; bg: string; text: string; border: string }
> = {
  Común: {
    hex: '#9aa0a6',
    bg: 'rgba(154, 160, 166, 0.16)',
    text: '#d1d5db',
    border: '#9aa0a6',
  },
  Raro: {
    hex: '#2196f3',
    bg: 'rgba(33, 150, 243, 0.18)',
    text: '#60a5fa',
    border: '#2196f3',
  },
  'Muy Raro': {
    hex: '#9c27b0',
    bg: 'rgba(156, 39, 176, 0.2)',
    text: '#d8b4fe',
    border: '#9c27b0',
  },
  Importado: {
    hex: '#f44336',
    bg: 'rgba(244, 67, 54, 0.2)',
    text: '#fca5a5',
    border: '#f44336',
  },
  Exótico: {
    hex: '#ffeb3b',
    bg: 'rgba(255, 235, 59, 0.18)',
    text: '#fde047',
    border: '#ffeb3b',
  },
  'Mercado Negro': {
    hex: '#e040fb',
    bg: 'rgba(224, 64, 251, 0.22)',
    text: '#f5d0fe',
    border: '#e040fb',
  },
};

export const BLUE_PRIMARY_PALETTE: string[] = [
  '#0066ff',
  '#0088ff',
  '#00b4ff',
  '#00d4ff',
  '#0052cc',
  '#1e3a8a',
  '#0ea5e9',
  '#06b6d4',
  '#14b8a6',
  '#10b981',
  '#22c55e',
  '#4ade80',
  '#3b82f6',
  '#6366f1',
  '#4f46e5',
  '#7c3aed',
  '#8b5cf6',
  '#a855f7',
];

export const ORANGE_PRIMARY_PALETTE: string[] = [
  '#ff5500',
  '#ff6600',
  '#ff8800',
  '#ffaa00',
  '#f59e0b',
  '#eab308',
  '#ef4444',
  '#dc2626',
  '#b91c1c',
  '#f97316',
  '#ea580c',
  '#fb7185',
  '#f43f5e',
  '#e11d48',
  '#ec4899',
  '#db2777',
  '#d946ef',
  '#fbbf24',
];

export const SECONDARY_PALETTE: string[] = [
  '#ffffff',
  '#e2e8f0',
  '#94a3b8',
  '#334155',
  '#0f172a',
  '#00e5ff',
  '#0088ff',
  '#22c55e',
  '#a3e635',
  '#facc15',
  '#ff8800',
  '#ff4400',
  '#ef4444',
  '#ec4899',
  '#d946ef',
  '#a855f7',
  '#6366f1',
  '#fbbf24',
];

export const CATALOG_ITEMS: GameItem[] = [
  // Carrocerias (6)
  {
    id: 'body_octane',
    name: 'Octane',
    category: 'body',
    rarity: 'Común',
    description: 'Chasis buggy icónico con alerón elevado y agilidad equilibrada.',
    previewHex: '#0088ff',
    accentHex: '#ff6600',
  },
  {
    id: 'body_fennec',
    name: 'Fennec',
    category: 'body',
    rarity: 'Importado',
    description: 'Compacto hatchback de rally con líneas cuadradas y hitbox precisa.',
    previewHex: '#38bdf8',
    accentHex: '#f8fafc',
  },
  {
    id: 'body_dominus',
    name: 'Dominus',
    category: 'body',
    rarity: 'Muy Raro',
    description: 'Muscle car largo, ancho y plano con toma de aire en el capó.',
    previewHex: '#f97316',
    accentHex: '#fbbf24',
  },
  {
    id: 'body_breakout',
    name: 'Breakout',
    category: 'body',
    rarity: 'Raro',
    description: 'Deportivo afilado de perfil bajo diseñado para disparos potentes.',
    previewHex: '#3b82f6',
    accentHex: '#93c5fd',
  },
  {
    id: 'body_merc',
    name: 'Merc',
    category: 'body',
    rarity: 'Raro',
    description: 'Furgoneta blindada de gran volumen para bloqueos sólidos.',
    previewHex: '#10b981',
    accentHex: '#e2e8f0',
  },
  {
    id: 'body_batmobile',
    name: 'Batmóvil',
    category: 'body',
    rarity: 'Exótico',
    description: 'Prototipo furtivo ultra bajo con alerones divididos y turbina trasera.',
    previewHex: '#1e293b',
    accentHex: '#f59e0b',
  },

  // Calcomanías y Pinturas (8)
  {
    id: 'decal_standard',
    name: 'Estándar',
    category: 'decal',
    rarity: 'Común',
    description: 'Acabado de pintura uniforme con barniz deportivo.',
    previewHex: '#64748b',
  },
  {
    id: 'decal_stripes',
    name: 'Rayas Racing',
    category: 'decal',
    rarity: 'Común',
    description: 'Doble franja central de competición sobre todo el chasis.',
    previewHex: '#38bdf8',
    accentHex: '#ffffff',
  },
  {
    id: 'decal_flames',
    name: 'Fuego / Llamas',
    category: 'decal',
    rarity: 'Raro',
    description: 'Llamas aerodinámicas envolviendo el morro y los laterales.',
    previewHex: '#ff6600',
    accentHex: '#fde047',
  },
  {
    id: 'decal_anodized',
    name: 'Metálico Anodizado',
    category: 'decal',
    rarity: 'Muy Raro',
    description: 'Brillo especular metálico de alta reflectividad bajo los focos.',
    previewHex: '#94a3b8',
    accentHex: '#ffffff',
  },
  {
    id: 'decal_pearlescent',
    name: 'Perla Nacarado',
    category: 'decal',
    rarity: 'Importado',
    description: 'Reflejo bicolor iridiscente que cambia según el ángulo de cámara.',
    previewHex: '#06b6d4',
    accentHex: '#e879f9',
  },
  {
    id: 'decal_interstellar',
    name: 'Interestelar',
    category: 'decal',
    rarity: 'Mercado Negro',
    description: 'Textura animada en tiempo real con nebulosas y estrellas en movimiento.',
    previewHex: '#312e81',
    accentHex: '#e040fb',
  },
  {
    id: 'decal_dissolver',
    name: 'Disolvente',
    category: 'decal',
    rarity: 'Mercado Negro',
    description: 'Ondas de energía líquida brillante recorriendo la carrocería.',
    previewHex: '#0f766e',
    accentHex: '#2dd4bf',
  },
  {
    id: 'decal_shockwave',
    name: 'Onda de Choque',
    category: 'decal',
    rarity: 'Mercado Negro',
    description: 'Pulsos de neón sincronizados viajando del morro al alerón.',
    previewHex: '#1d4ed8',
    accentHex: '#00e5ff',
  },

  // Ruedas (6)
  {
    id: 'wheel_oem',
    name: 'OEM',
    category: 'wheel',
    rarity: 'Común',
    description: 'Llantas negras deportivas de cinco radios estándar.',
    previewHex: '#334155',
    accentHex: '#94a3b8',
  },
  {
    id: 'wheel_cristiano',
    name: 'Cristiano',
    category: 'wheel',
    rarity: 'Muy Raro',
    description: 'Clásicas llantas inspiradas en balón de fútbol con pentágonos.',
    previewHex: '#1e293b',
    accentHex: '#e2e8f0',
  },
  {
    id: 'wheel_zomba',
    name: 'Zomba',
    category: 'wheel',
    rarity: 'Exótico',
    description: 'Núcleo hipnótico que cicla suavemente por todo el espectro RGB.',
    previewHex: '#22d3ee',
    accentHex: '#f472b6',
  },
  {
    id: 'wheel_draco',
    name: 'Draco',
    category: 'wheel',
    rarity: 'Exótico',
    description: 'Aro de fuego naranja ardiente alrededor de la llanta.',
    previewHex: '#ff5500',
    accentHex: '#fde047',
  },
  {
    id: 'wheel_apex',
    name: 'Apex',
    category: 'wheel',
    rarity: 'Importado',
    description: 'Anillo luminoso dual cian/naranja de competición profesional.',
    previewHex: '#0088ff',
    accentHex: '#ff6600',
  },
  {
    id: 'wheel_goldstone',
    name: 'Goldstone Alpha',
    category: 'wheel',
    rarity: 'Exótico',
    description: 'Llantas de oro macizo pulido edición campeonato Alpha.',
    previewHex: '#f59e0b',
    accentHex: '#fef08a',
  },

  // Estelas de Turbo (7)
  {
    id: 'boost_standard',
    name: 'Estándar',
    category: 'boost',
    rarity: 'Común',
    description: 'Chispas clásicas naranja y amarillo saliendo de los escapes.',
    previewHex: '#ff7700',
    accentHex: '#fde047',
  },
  {
    id: 'boost_blueflame',
    name: 'Llamas Azules',
    category: 'boost',
    rarity: 'Raro',
    description: 'Combustión de plasma azul eléctrico de alta temperatura.',
    previewHex: '#0088ff',
    accentHex: '#7dd3fc',
  },
  {
    id: 'boost_purple',
    name: 'Rayo Púrpura',
    category: 'boost',
    rarity: 'Muy Raro',
    description: 'Destellos eléctricos violeta de alto voltaje.',
    previewHex: '#a855f7',
    accentHex: '#f0abfc',
  },
  {
    id: 'boost_stardust',
    name: 'Polvo Estelar',
    category: 'boost',
    rarity: 'Importado',
    description: 'Estrellas cristalinas blancas y cian en suspensión.',
    previewHex: '#38bdf8',
    accentHex: '#ffffff',
  },
  {
    id: 'boost_plasma',
    name: 'Plasma Verde',
    category: 'boost',
    rarity: 'Importado',
    description: 'Esferas de energía tóxica esmeralda en cascada.',
    previewHex: '#22c55e',
    accentHex: '#bef264',
  },
  {
    id: 'boost_rainbow',
    name: 'Arcoíris',
    category: 'boost',
    rarity: 'Exótico',
    description: 'Estela prismática multicolor continua.',
    previewHex: '#ec4899',
    accentHex: '#22d3ee',
  },
  {
    id: 'boost_alphaboost',
    name: 'Alpha Boost (Fiebre del Oro)',
    category: 'boost',
    rarity: 'Mercado Negro',
    description: 'Partículas doradas brillantes con estela intensa legendaria.',
    previewHex: '#fbbf24',
    accentHex: '#fffbeb',
  },

  // Explosiones de Gol (5)
  {
    id: 'exp_classic',
    name: 'Clásica',
    category: 'explosion',
    rarity: 'Común',
    description: 'Onda expansiva energética del color de tu equipo.',
    previewHex: '#0088ff',
    accentHex: '#ff6600',
  },
  {
    id: 'exp_dueling_dragons',
    name: 'Duelo de Dragones',
    category: 'explosion',
    rarity: 'Mercado Negro',
    description: 'Dos espirales ascendentes azul y naranja entrelazándose al anotar.',
    previewHex: '#e040fb',
    accentHex: '#00e5ff',
  },
  {
    id: 'exp_black_hole',
    name: 'Agujero Negro',
    category: 'explosion',
    rarity: 'Mercado Negro',
    description: 'Singularidad gravitacional que atrae los coches y luego detona.',
    previewHex: '#1e1b4b',
    accentHex: '#c084fc',
  },
  {
    id: 'exp_nuclear',
    name: 'Explosión Nuclear',
    category: 'explosion',
    rarity: 'Exótico',
    description: 'Destello blanco cegador y onda de choque expansiva masiva.',
    previewHex: '#bef264',
    accentHex: '#ffffff',
  },
  {
    id: 'exp_confetti',
    name: 'Fiesta de Confeti',
    category: 'explosion',
    rarity: 'Importado',
    description: 'Cientos de papeles festivos multicolor inundando la portería.',
    previewHex: '#f43f5e',
    accentHex: '#facc15',
  },

  // Adornos / Toppers (6)
  {
    id: 'topper_none',
    name: 'Ninguno',
    category: 'topper',
    rarity: 'Común',
    description: 'Techo despejado sin adornos.',
    previewHex: '#475569',
  },
  {
    id: 'topper_crown',
    name: 'Corona Real Dorada',
    category: 'topper',
    rarity: 'Importado',
    description: 'Corona real de oro macizo con gemas incrustadas.',
    previewHex: '#fbbf24',
    accentHex: '#ef4444',
  },
  {
    id: 'topper_halo',
    name: 'Halo Luminoso Flotante',
    category: 'topper',
    rarity: 'Exótico',
    description: 'Anillo de energía pura flotando suavemente sobre la cabina.',
    previewHex: '#00e5ff',
    accentHex: '#ffffff',
  },
  {
    id: 'topper_cap',
    name: 'Gorra Deportiva',
    category: 'topper',
    rarity: 'Raro',
    description: 'Gorra urbana con visera orientada hacia adelante.',
    previewHex: '#ef4444',
    accentHex: '#ffffff',
  },
  {
    id: 'topper_horns',
    name: 'Cuernos de Diablo',
    category: 'topper',
    rarity: 'Muy Raro',
    description: 'Par de cuernos carmesí curvados para intimidar en los saques.',
    previewHex: '#dc2626',
    accentHex: '#7f1d1d',
  },
  {
    id: 'topper_wizard',
    name: 'Sombrero de Mago',
    category: 'topper',
    rarity: 'Muy Raro',
    description: 'Sombrero puntiagudo arcano con banda estelar dorada.',
    previewHex: '#6366f1',
    accentHex: '#fde047',
  },
];

export const ITEM_BY_ID: Record<string, GameItem> = Object.fromEntries(
  CATALOG_ITEMS.map((item) => [item.id, item]),
);

export const CRATES: CrateDef[] = [
  {
    id: 'crate_rare',
    name: 'Caja Rara',
    price: 150,
    accentHex: '#2196f3',
    description: 'Contiene piezas Raras con probabilidad de Muy Raro o superior.',
    weights: {
      Común: 0,
      Raro: 60,
      'Muy Raro': 26,
      Importado: 10,
      Exótico: 3,
      'Mercado Negro': 1,
    },
  },
  {
    id: 'crate_very_rare',
    name: 'Caja Muy Rara',
    price: 300,
    accentHex: '#9c27b0',
    description: 'Alta probabilidad de objetos Muy Raros e Importados.',
    weights: {
      Común: 0,
      Raro: 20,
      'Muy Raro': 48,
      Importado: 22,
      Exótico: 8,
      'Mercado Negro': 2,
    },
  },
  {
    id: 'crate_import',
    name: 'Caja Importada',
    price: 500,
    accentHex: '#f44336',
    description: 'Carrocerías Fennec, turborreactores Importados y Exóticos.',
    weights: {
      Común: 0,
      Raro: 0,
      'Muy Raro': 28,
      Importado: 48,
      Exótico: 18,
      'Mercado Negro': 6,
    },
  },
  {
    id: 'crate_exotic',
    name: 'Caja Exótica',
    price: 800,
    accentHex: '#ffeb3b',
    description: 'Llantas Zomba, Draco, Batmóvil y probabilidad aumentada de Mercado Negro.',
    weights: {
      Común: 0,
      Raro: 0,
      'Muy Raro': 0,
      Importado: 30,
      Exótico: 52,
      'Mercado Negro': 18,
    },
  },
  {
    id: 'crate_bm',
    name: 'Caja Mercado Negro',
    price: 1500,
    accentHex: '#e040fb',
    description: 'Drop de élite garantizado Exótico o Mercado Negro (Interestelar, Dragones, Alpha Boost).',
    weights: {
      Común: 0,
      Raro: 0,
      'Muy Raro': 0,
      Importado: 0,
      Exótico: 45,
      'Mercado Negro': 55,
    },
  },
];

export const STARTER_ITEM_IDS = [
  'body_octane',
  'decal_standard',
  'decal_stripes',
  'wheel_oem',
  'boost_standard',
  'exp_classic',
  'topper_none',
];
