import React, { useMemo, useState } from 'react';
import { ArrowLeft, Repeat, Check, Sparkles } from 'lucide-react';
import {
  GameItem,
  ITEM_BY_ID,
  ItemCategory,
  RARITY_COLORS,
  RARITY_ORDER,
  Rarity,
  SaveData,
} from '../game/catalog';
import { getNextRarity } from '../game/storage';
import { soundEngine } from '../game/sound';

interface InventoryViewProps {
  save: SaveData;
  onTradeIn: (instanceIds: string[]) => {
    ok: boolean;
    error?: string;
    resultItem?: GameItem;
  };
  onBack: () => void;
}

const CATEGORY_FILTERS: { id: 'all' | ItemCategory; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'body', label: 'Carrocerías' },
  { id: 'decal', label: 'Calcomanías' },
  { id: 'wheel', label: 'Ruedas' },
  { id: 'boost', label: 'Turbo' },
  { id: 'explosion', label: 'Explosiones' },
  { id: 'topper', label: 'Adornos' },
];

export const InventoryView: React.FC<InventoryViewProps> = ({
  save,
  onTradeIn,
  onBack,
}) => {
  const [catFilter, setCatFilter] = useState<'all' | ItemCategory>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | Rarity>('all');
  const [tradeMode, setTradeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tradeResult, setTradeResult] = useState<GameItem | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const selectedRarity: Rarity | null = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const entry = save.inventory.find((e) => e.instanceId === selectedIds[0]);
    if (!entry) return null;
    return ITEM_BY_ID[entry.itemId]?.rarity ?? null;
  }, [selectedIds, save.inventory]);

  const filteredEntries = useMemo(() => {
    return save.inventory.filter((entry) => {
      const item = ITEM_BY_ID[entry.itemId];
      if (!item) return false;
      if (catFilter !== 'all' && item.category !== catFilter) return false;
      if (rarityFilter !== 'all' && item.rarity !== rarityFilter) return false;
      if (tradeMode && item.rarity === 'Mercado Negro') return false;
      return true;
    });
  }, [save.inventory, catFilter, rarityFilter, tradeMode]);

  const toggleSelect = (instanceId: string, item: GameItem) => {
    soundEngine.playUiClick();
    setTradeError(null);
    if (selectedIds.includes(instanceId)) {
      setSelectedIds((prev) => prev.filter((id) => id !== instanceId));
      return;
    }
    if (selectedIds.length >= 5) return;
    if (selectedRarity && item.rarity !== selectedRarity) {
      setTradeError(`Solo puedes combinar objetos de rareza ${selectedRarity}.`);
      return;
    }
    setSelectedIds((prev) => [...prev, instanceId]);
  };

  const executeTradeIn = () => {
    soundEngine.playUiClick();
    const res = onTradeIn(selectedIds);
    if (!res.ok || !res.resultItem) {
      setTradeError(res.error ?? 'Error al intercambiar');
      return;
    }
    soundEngine.playCrateReveal(res.resultItem.rarity);
    setSelectedIds([]);
    setTradeResult(res.resultItem);
  };

  return (
    <div className="pointer-events-auto flex-1 flex flex-col bg-[#060d1c]/92">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onBack();
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/15 text-white font-display font-bold italic tracking-wider uppercase cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            VOLVER
          </button>
          <h2 className="font-display font-extrabold italic text-2xl sm:text-3xl text-white uppercase tracking-wide">
            INVENTARIO ({save.inventory.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            setTradeMode((v) => !v);
            setSelectedIds([]);
            setTradeError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 font-display font-extrabold italic text-sm tracking-wider uppercase rl-bevel cursor-pointer transition-colors ${
            tradeMode
              ? 'bg-[#ff6600] text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15'
          }`}
        >
          <Repeat className="w-4 h-4" />
          {tradeMode ? 'SALIR DE TRADE-IN' : 'INTERCAMBIAR (TRADE-IN 5x1)'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#091328] border-b border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setCatFilter(c.id);
              }}
              className={`px-3 py-1 text-xs font-bold uppercase whitespace-nowrap cursor-pointer ${
                catFilter === c.id
                  ? 'bg-[#0088ff] text-white'
                  : 'bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Filtrar por rareza"
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value as 'all' | Rarity)}
          className="px-3 py-1.5 bg-slate-900 border border-white/15 text-xs font-bold text-white outline-none"
        >
          <option value="all">Todas las rarezas</option>
          {RARITY_ORDER.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Trade-In Banner */}
      {tradeMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-[#17112b] border-b border-purple-500/40">
          <div>
            <div className="font-display font-extrabold italic text-lg text-white uppercase">
              FUSIÓN TRADE-IN: SELECCIONA 5 OBJETOS DE LA MISMA RAREZA ({selectedIds.length}/5)
            </div>
            <div className="text-xs text-purple-200">
              {selectedRarity
                ? `Fusionando 5× ${selectedRarity} → 1× ${getNextRarity(selectedRarity) ?? 'Máximo'}`
                : 'Elige 5 copias repetidas para subir al siguiente nivel de rareza.'}
            </div>
            {tradeError && (
              <div className="text-xs font-bold text-rose-400 mt-1">{tradeError}</div>
            )}
          </div>

          <button
            type="button"
            disabled={selectedIds.length !== 5}
            onClick={executeTradeIn}
            className={`px-5 py-2 font-display font-extrabold italic text-base tracking-wider uppercase rl-bevel cursor-pointer ${
              selectedIds.length === 5
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            FUSIONAR 5 → 1
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 allow-scroll p-5">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {filteredEntries.map((entry) => {
            const item = ITEM_BY_ID[entry.itemId];
            if (!item) return null;
            const rc = RARITY_COLORS[item.rarity];
            const isSelected = selectedIds.includes(entry.instanceId);

            return (
              <button
                key={entry.instanceId}
                type="button"
                disabled={!tradeMode}
                onClick={() => tradeMode && toggleSelect(entry.instanceId, item)}
                className={`relative text-left p-3 border transition-transform ${
                  item.rarity === 'Mercado Negro' ? 'bm-rainbow-card' : ''
                } ${
                  isSelected
                    ? 'bg-purple-900/45 border-emerald-400 scale-[0.98]'
                    : 'bg-[#0b1529] border-white/10'
                } ${tradeMode ? 'cursor-pointer hover:border-white/40' : 'cursor-default'}`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 text-slate-950 flex items-center justify-center rounded-full">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
                <div
                  className="h-14 w-full mb-2.5 border border-white/10"
                  style={{
                    background: item.accentHex
                      ? `linear-gradient(135deg, ${item.previewHex}, ${item.accentHex})`
                      : item.previewHex,
                  }}
                />
                <div
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: rc.text }}
                >
                  {item.rarity}
                </div>
                <div className="font-display font-bold italic text-base text-white truncate">
                  {item.name}
                </div>
                <div className="text-[11px] text-slate-400 capitalize mt-0.5">
                  {item.category}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Trade-In Result Modal */}
      {tradeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div
            className="w-full max-w-sm bg-[#0a1428] border-2 p-6 text-center"
            style={{ borderColor: RARITY_COLORS[tradeResult.rarity].border }}
          >
            <div
              className="inline-flex items-center gap-1.5 text-xs font-display font-extrabold italic uppercase mb-2"
              style={{ color: RARITY_COLORS[tradeResult.rarity].text }}
            >
              <Sparkles className="w-4 h-4" />
              INTERCAMBIO COMPLETADO · {tradeResult.rarity}
            </div>
            <div
              className="w-28 h-28 mx-auto my-3 border border-white/25"
              style={{
                background: tradeResult.accentHex
                  ? `linear-gradient(135deg, ${tradeResult.previewHex}, ${tradeResult.accentHex})`
                  : tradeResult.previewHex,
              }}
            />
            <h3 className="font-display font-extrabold italic text-3xl text-white uppercase">
              {tradeResult.name}
            </h3>
            <p className="text-xs text-slate-300 mt-1 mb-5">{tradeResult.description}</p>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setTradeResult(null);
              }}
              className="w-full py-2.5 bg-[#0088ff] hover:bg-[#1a96ff] text-white font-display font-extrabold italic text-lg uppercase cursor-pointer"
            >
              ACEPTAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
