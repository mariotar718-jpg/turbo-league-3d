import {
  CATALOG_ITEMS,
  CRATES,
  CrateDef,
  GameItem,
  ITEM_BY_ID,
  RARITY_ORDER,
  Rarity,
  STARTER_ITEM_IDS,
  SaveData,
  TeamColor,
  TeamLoadout,
} from './catalog';

export const SAVE_STORAGE_KEY = 'rl_web_pro_save_v1';

export const LEVEL_TITLES = [
  'NOVATO',
  'SEMI-PRO',
  'PRO',
  'VETERANO',
  'EXPERTO',
  'MAESTRO',
  'LEYENDA',
  'ROCKETEER',
  'CAMPEÓN',
  'GRAN CAMPEÓN',
  'SUPERSÓNICO',
];

export function getLevelInfo(xp: number): {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
} {
  const safeXp = Math.max(0, Math.floor(xp));
  const xpPerLevel = 500;
  const level = Math.floor(safeXp / xpPerLevel) + 1;
  const currentLevelXp = safeXp % xpPerLevel;
  const titleIdx = Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3));
  return {
    level,
    title: LEVEL_TITLES[titleIdx],
    currentLevelXp,
    nextLevelXp: xpPerLevel,
    progress: currentLevelXp / xpPerLevel,
  };
}

function makeInstanceId(itemId: string, index = 0): string {
  return `${itemId}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultSaveData(): SaveData {
  return {
    version: 1,
    playerName: 'PILOTO',
    avatarIndex: 0,
    credits: 2500,
    xp: 6500, // Inicia en Nivel 14 - VETERANO como referencia
    inventory: STARTER_ITEM_IDS.map((itemId, idx) => ({
      instanceId: makeInstanceId(itemId, idx),
      itemId,
      acquiredAt: Date.now() - (STARTER_ITEM_IDS.length - idx) * 1000,
    })),
    loadouts: {
      blue: {
        bodyId: 'body_octane',
        decalId: 'decal_stripes',
        primaryColor: '#0088ff',
        secondaryColor: '#ffffff',
        wheelId: 'wheel_oem',
        boostId: 'boost_standard',
        explosionId: 'exp_classic',
        topperId: 'topper_none',
      },
      orange: {
        bodyId: 'body_octane',
        decalId: 'decal_stripes',
        primaryColor: '#ff6600',
        secondaryColor: '#ffffff',
        wheelId: 'wheel_oem',
        boostId: 'boost_standard',
        explosionId: 'exp_classic',
        topperId: 'topper_none',
      },
    },
    stats: {
      matches: 0,
      wins: 0,
      goals: 0,
      saves: 0,
      demos: 0,
    },
  };
}

export function loadSaveData(): SaveData {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultSaveData();
  }
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      const fresh = createDefaultSaveData();
      persistSaveData(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const defaults = createDefaultSaveData();
    const merged: SaveData = {
      version: 1,
      playerName:
        typeof parsed.playerName === 'string' && parsed.playerName.trim()
          ? parsed.playerName.trim().slice(0, 16)
          : defaults.playerName,
      avatarIndex:
        typeof parsed.avatarIndex === 'number' ? parsed.avatarIndex : 0,
      credits:
        typeof parsed.credits === 'number' && parsed.credits >= 0
          ? parsed.credits
          : defaults.credits,
      xp: typeof parsed.xp === 'number' && parsed.xp >= 0 ? parsed.xp : defaults.xp,
      inventory:
        Array.isArray(parsed.inventory) && parsed.inventory.length > 0
          ? parsed.inventory.filter((e) => e && ITEM_BY_ID[e.itemId])
          : defaults.inventory,
      loadouts: {
        blue: { ...defaults.loadouts.blue, ...(parsed.loadouts?.blue ?? {}) },
        orange: { ...defaults.loadouts.orange, ...(parsed.loadouts?.orange ?? {}) },
      },
      stats: { ...defaults.stats, ...(parsed.stats ?? {}) },
    };
    return merged;
  } catch {
    return createDefaultSaveData();
  }
}

export function persistSaveData(data: SaveData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function rollRarityFromCrate(crate: CrateDef, rng = Math.random): Rarity {
  const entries = Object.entries(crate.weights) as [Rarity, number][];
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let r = rng() * total;
  for (const [rarity, weight] of entries) {
    if (weight <= 0) continue;
    r -= weight;
    if (r <= 0) return rarity;
  }
  return 'Raro';
}

export function pickRandomItemByRarity(rarity: Rarity, rng = Math.random): GameItem {
  const pool = CATALOG_ITEMS.filter(
    (item) => item.rarity === rarity && item.id !== 'topper_none',
  );
  if (pool.length === 0) {
    const fallback = CATALOG_ITEMS.filter((i) => i.id !== 'topper_none');
    return fallback[Math.floor(rng() * fallback.length)];
  }
  return pool[Math.floor(rng() * pool.length)];
}

export function openCrateTransaction(
  save: SaveData,
  crateId: string,
  rng = Math.random,
): {
  ok: boolean;
  error?: string;
  updated?: SaveData;
  wonItem?: GameItem;
  rouletteStrip?: GameItem[];
  winningIndex?: number;
} {
  const crate = CRATES.find((c) => c.id === crateId);
  if (!crate) return { ok: false, error: 'Caja no encontrada' };
  if (save.credits < crate.price) {
    return { ok: false, error: 'Créditos insuficientes' };
  }

  const winningRarity = rollRarityFromCrate(crate, rng);
  const wonItem = pickRandomItemByRarity(winningRarity, rng);

  const stripLength = 36;
  const winningIndex = 28;
  const rouletteStrip: GameItem[] = [];
  for (let i = 0; i < stripLength; i++) {
    if (i === winningIndex) {
      rouletteStrip.push(wonItem);
    } else {
      const r = rollRarityFromCrate(crate, rng);
      rouletteStrip.push(pickRandomItemByRarity(r, rng));
    }
  }

  const updated: SaveData = {
    ...save,
    credits: save.credits - crate.price,
    inventory: [
      {
        instanceId: makeInstanceId(wonItem.id, 0),
        itemId: wonItem.id,
        acquiredAt: Date.now(),
      },
      ...save.inventory,
    ],
  };

  return {
    ok: true,
    updated,
    wonItem,
    rouletteStrip,
    winningIndex,
  };
}

export function getNextRarity(rarity: Rarity): Rarity | null {
  const idx = RARITY_ORDER.indexOf(rarity);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[idx + 1];
}

export function performTradeIn(
  save: SaveData,
  selectedInstanceIds: string[],
  rng = Math.random,
): {
  ok: boolean;
  error?: string;
  updated?: SaveData;
  resultItem?: GameItem;
} {
  if (selectedInstanceIds.length !== 5) {
    return { ok: false, error: 'Debes seleccionar exactamente 5 objetos.' };
  }
  const uniqueIds = new Set(selectedInstanceIds);
  if (uniqueIds.size !== 5) {
    return { ok: false, error: 'Los 5 objetos deben ser instancias distintas.' };
  }

  const entries = selectedInstanceIds
    .map((id) => save.inventory.find((e) => e.instanceId === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (entries.length !== 5) {
    return { ok: false, error: 'Alguno de los objetos no está en tu inventario.' };
  }

  const firstItem = ITEM_BY_ID[entries[0].itemId];
  if (!firstItem) return { ok: false, error: 'Objeto inválido.' };

  const rarity = firstItem.rarity;
  const allSameRarity = entries.every(
    (e) => ITEM_BY_ID[e.itemId]?.rarity === rarity,
  );
  if (!allSameRarity) {
    return { ok: false, error: 'Los 5 objetos deben ser de la misma rareza.' };
  }

  const nextRarity = getNextRarity(rarity);
  if (!nextRarity) {
    return {
      ok: false,
      error: 'Los objetos de Mercado Negro son la rareza máxima.',
    };
  }

  const resultItem = pickRandomItemByRarity(nextRarity, rng);

  const remainingInventory = save.inventory.filter(
    (e) => !uniqueIds.has(e.instanceId),
  );

  // Ensure equipped items fall back to starter if last copy was traded in
  const stillHasItem = (itemId: string) =>
    remainingInventory.some((e) => e.itemId === itemId);

  const sanitizeLoadout = (l: TeamLoadout): TeamLoadout => ({
    ...l,
    bodyId: stillHasItem(l.bodyId) ? l.bodyId : 'body_octane',
    decalId: stillHasItem(l.decalId) ? l.decalId : 'decal_standard',
    wheelId: stillHasItem(l.wheelId) ? l.wheelId : 'wheel_oem',
    boostId: stillHasItem(l.boostId) ? l.boostId : 'boost_standard',
    explosionId: stillHasItem(l.explosionId) ? l.explosionId : 'exp_classic',
    topperId: stillHasItem(l.topperId) ? l.topperId : 'topper_none',
  });

  const updated: SaveData = {
    ...save,
    inventory: [
      {
        instanceId: makeInstanceId(resultItem.id, 99),
        itemId: resultItem.id,
        acquiredAt: Date.now(),
      },
      ...remainingInventory,
    ],
    loadouts: {
      blue: sanitizeLoadout(save.loadouts.blue),
      orange: sanitizeLoadout(save.loadouts.orange),
    },
  };

  return { ok: true, updated, resultItem };
}

export function equipItemOnTeam(
  save: SaveData,
  team: TeamColor,
  item: GameItem,
): SaveData {
  const current = save.loadouts[team];
  const next: TeamLoadout = { ...current };
  switch (item.category) {
    case 'body':
      next.bodyId = item.id;
      break;
    case 'decal':
      next.decalId = item.id;
      break;
    case 'wheel':
      next.wheelId = item.id;
      break;
    case 'boost':
      next.boostId = item.id;
      break;
    case 'explosion':
      next.explosionId = item.id;
      break;
    case 'topper':
      next.topperId = item.id;
      break;
  }
  return {
    ...save,
    loadouts: {
      ...save.loadouts,
      [team]: next,
    },
  };
}
