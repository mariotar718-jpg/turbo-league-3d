import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import {
  BLUE_PRIMARY_PALETTE,
  GameItem,
  ITEM_BY_ID,
  ItemCategory,
  ORANGE_PRIMARY_PALETTE,
  RARITY_COLORS,
  SECONDARY_PALETTE,
  SaveData,
  TeamColor,
} from '../game/catalog';
import { GarageZoomTarget } from '../game/engine';
import { soundEngine } from '../game/sound';

type GarageTab = ItemCategory | 'paint';

interface GarageViewProps {
  save: SaveData;
  previewTeam: TeamColor;
  onChangePreviewTeam: (team: TeamColor) => void;
  onEquipItem: (team: TeamColor, item: GameItem) => void;
  onSetColors: (team: TeamColor, primary: string, secondary: string) => void;
  onChangeZoom: (target: GarageZoomTarget) => void;
  onOrbitDrag: (dx: number, dy: number) => void;
  onBack: () => void;
}

const TABS: { id: GarageTab; label: string; zoom: GarageZoomTarget }[] = [
  { id: 'body', label: 'CARROCERÍAS', zoom: 'body' },
  { id: 'decal', label: 'CALCOMANÍAS', zoom: 'body' },
  { id: 'paint', label: 'PINTURA', zoom: 'overview' },
  { id: 'wheel', label: 'RUEDAS', zoom: 'wheel' },
  { id: 'boost', label: 'TURBO', zoom: 'boost' },
  { id: 'explosion', label: 'EXPLOSIÓN', zoom: 'overview' },
  { id: 'topper', label: 'ADORNOS', zoom: 'topper' },
];

export const GarageView: React.FC<GarageViewProps> = ({
  save,
  previewTeam,
  onChangePreviewTeam,
  onEquipItem,
  onSetColors,
  onChangeZoom,
  onOrbitDrag,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<GarageTab>('body');
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  const activeLoadout = save.loadouts[previewTeam];

  const ownedItemsForTab = useMemo(() => {
    if (activeTab === 'paint') return [];
    const seen = new Set<string>();
    const list: GameItem[] = [];
    for (const entry of save.inventory) {
      if (seen.has(entry.itemId)) continue;
      const item = ITEM_BY_ID[entry.itemId];
      if (item && item.category === activeTab) {
        seen.add(entry.itemId);
        list.push(item);
      }
    }
    return list;
  }, [save.inventory, activeTab]);

  const isEquipped = (item: GameItem): boolean => {
    switch (item.category) {
      case 'body':
        return activeLoadout.bodyId === item.id;
      case 'decal':
        return activeLoadout.decalId === item.id;
      case 'wheel':
        return activeLoadout.wheelId === item.id;
      case 'boost':
        return activeLoadout.boostId === item.id;
      case 'explosion':
        return activeLoadout.explosionId === item.id;
      case 'topper':
        return activeLoadout.topperId === item.id;
    }
  };

  const primaryPalette =
    previewTeam === 'blue' ? BLUE_PRIMARY_PALETTE : ORANGE_PRIMARY_PALETTE;

  return (
    <div className="pointer-events-none flex-1 flex flex-col justify-between">
      {/* Top Header Row inside Garage */}
      <div className="pointer-events-auto flex items-center justify-between px-5 py-3 bg-[#091224]/85 border-b border-white/10">
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
          <h2 className="font-display font-extrabold italic text-2xl text-white uppercase tracking-wide">
            GARAJE
          </h2>
        </div>

        {/* Team Blue / Orange Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onChangePreviewTeam('blue');
            }}
            className={`px-3.5 py-1.5 text-xs font-display font-extrabold italic tracking-wider uppercase cursor-pointer transition-colors ${
              previewTeam === 'blue'
                ? 'bg-[#0088ff] text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            COCHE AZUL
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onChangePreviewTeam('orange');
            }}
            className={`px-3.5 py-1.5 text-xs font-display font-extrabold italic tracking-wider uppercase cursor-pointer transition-colors ${
              previewTeam === 'orange'
                ? 'bg-[#ff6600] text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            COCHE NARANJA
          </button>
        </div>
      </div>

      {/* Interactive 3D Orbit Drag Area (center viewport unobstructed) */}
      <div
        className="pointer-events-auto flex-1 cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          dragRef.current = { active: true, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.x;
          const dy = e.clientY - dragRef.current.y;
          dragRef.current.x = e.clientX;
          dragRef.current.y = e.clientY;
          onOrbitDrag(dx, dy);
        }}
        onPointerUp={() => {
          dragRef.current.active = false;
        }}
        onPointerCancel={() => {
          dragRef.current.active = false;
        }}
      />

      {/* Bottom Dock for Categories & Items */}
      <div className="pointer-events-auto bg-[#081122]/95 border-t border-white/15 px-4 pt-3 pb-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-3 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveTab(t.id);
                onChangeZoom(t.zoom);
              }}
              className={`px-3.5 py-1.5 font-display font-extrabold italic text-sm tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer transition-colors rl-bevel ${
                activeTab === t.id
                  ? 'bg-[#0088ff] text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Item Grid or Color Palettes */}
        {activeTab === 'paint' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-48 allow-scroll pr-1">
            <div>
              <div className="text-xs font-display font-bold italic tracking-wider text-slate-300 uppercase mb-2">
                COLOR PRIMARIO ({previewTeam === 'blue' ? 'EQUIPO AZUL' : 'EQUIPO NARANJA'})
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {primaryPalette.map((hex) => {
                  const selected = activeLoadout.primaryColor === hex;
                  return (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Color primario ${hex}`}
                      onClick={() => {
                        soundEngine.playUiClick();
                        onSetColors(previewTeam, hex, activeLoadout.secondaryColor);
                      }}
                      className={`h-8 border-2 cursor-pointer flex items-center justify-center ${
                        selected ? 'border-white scale-105' : 'border-black/40'
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {selected && <Check className="w-4 h-4 text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-xs font-display font-bold italic tracking-wider text-slate-300 uppercase mb-2">
                COLOR SECUNDARIO (ACENTO / CALCOMANÍA)
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {SECONDARY_PALETTE.map((hex) => {
                  const selected = activeLoadout.secondaryColor === hex;
                  return (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Color secundario ${hex}`}
                      onClick={() => {
                        soundEngine.playUiClick();
                        onSetColors(previewTeam, activeLoadout.primaryColor, hex);
                      }}
                      className={`h-8 border-2 cursor-pointer flex items-center justify-center ${
                        selected ? 'border-[#0088ff] scale-105' : 'border-black/40'
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {selected && (
                        <Check
                          className={`w-4 h-4 ${
                            hex === '#ffffff' || hex === '#e2e8f0'
                              ? 'text-slate-900'
                              : 'text-white'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-48 allow-scroll pr-1">
            {ownedItemsForTab.map((item) => {
              const equipped = isEquipped(item);
              const rc = RARITY_COLORS[item.rarity];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onEquipItem(previewTeam, item);
                  }}
                  className={`text-left p-2.5 border transition-colors cursor-pointer ${
                    item.rarity === 'Mercado Negro' ? 'bm-rainbow-card' : ''
                  } ${
                    equipped
                      ? 'bg-[#0088ff]/25 border-[#0088ff]'
                      : 'bg-slate-900/90 border-white/10 hover:border-white/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <span
                      className="w-4 h-4 rounded-sm shrink-0 border border-white/25"
                      style={{
                        background: item.accentHex
                          ? `linear-gradient(135deg, ${item.previewHex}, ${item.accentHex})`
                          : item.previewHex,
                      }}
                    />
                    <span
                      className="text-[10px] font-bold uppercase truncate"
                      style={{ color: rc.text }}
                    >
                      {item.rarity}
                    </span>
                  </div>
                  <div className="font-display font-bold italic text-base text-white truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {equipped ? 'EQUIPADO' : 'Click para equipar'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
