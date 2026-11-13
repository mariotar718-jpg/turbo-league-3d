import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import {
  CRATES,
  CrateDef,
  GameItem,
  RARITY_COLORS,
  SaveData,
} from '../game/catalog';
import { soundEngine } from '../game/sound';

interface ShopViewProps {
  save: SaveData;
  onBuyCrate: (crateId: string) => {
    ok: boolean;
    error?: string;
    wonItem?: GameItem;
    rouletteStrip?: GameItem[];
    winningIndex?: number;
  };
  onCrateSceneActive: (active: boolean, accentHex?: string) => void;
  onEquipWonItem: (item: GameItem) => void;
  onBack: () => void;
}

type CratePhase = 'catalog' | 'pod_spin' | 'roulette' | 'reveal';

const CARD_W = 148;
const CARD_GAP = 10;
const CARD_STEP = CARD_W + CARD_GAP;

export const ShopView: React.FC<ShopViewProps> = ({
  save,
  onBuyCrate,
  onCrateSceneActive,
  onEquipWonItem,
  onBack,
}) => {
  const [phase, setPhase] = useState<CratePhase>('catalog');
  const [activeCrate, setActiveCrate] = useState<CrateDef | null>(null);
  const [strip, setStrip] = useState<GameItem[]>([]);
  const [wonItem, setWonItem] = useState<GameItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [equippedDone, setEquippedDone] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<number>(0);
  const onCrateSceneActiveRef = useRef(onCrateSceneActive);
  onCrateSceneActiveRef.current = onCrateSceneActive;

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
      onCrateSceneActiveRef.current(false);
    };
  }, []);

  const startOpening = (crate: CrateDef) => {
    soundEngine.unlock();
    soundEngine.playUiClick();
    setErrorMsg(null);
    const res = onBuyCrate(crate.id);
    if (!res.ok || !res.wonItem || !res.rouletteStrip || res.winningIndex === undefined) {
      setErrorMsg(res.error ?? 'No se pudo abrir la caja');
      return;
    }

    setActiveCrate(crate);
    setStrip(res.rouletteStrip);
    setWonItem(res.wonItem);
    setEquippedDone(false);
    setPhase('pod_spin');
    onCrateSceneActive(true, crate.accentHex);

    const winIdx = res.winningIndex;
    const item = res.wonItem;

    timerRef.current = window.setTimeout(() => {
      setPhase('roulette');
      // Animate horizontal roulette from 0 to target offset
      const startTime = performance.now();
      const durationMs = 4200;
      // Add slight random jitter inside the winning card
      const jitter = (Math.random() - 0.5) * (CARD_W * 0.45);
      const targetOffset = winIdx * CARD_STEP + CARD_W / 2 + jitter;
      let lastTickStep = -1;

      const animateStrip = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        // Smooth quartic ease-out for suspenseful slowdown
        const ease = 1 - Math.pow(1 - t, 4);
        const currentX = ease * targetOffset;

        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${-currentX}px, 0, 0)`;
        }

        const currentCard = Math.floor(currentX / CARD_STEP);
        if (currentCard !== lastTickStep) {
          lastTickStep = currentCard;
          soundEngine.playCrateTick(1.15 - ease * 0.35);
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(animateStrip);
        } else {
          setPhase('reveal');
          soundEngine.playCrateReveal(item.rarity);
        }
      };

      rafRef.current = requestAnimationFrame(animateStrip);
    }, 1150);
  };

  const closeOpening = () => {
    soundEngine.playUiClick();
    onCrateSceneActive(false);
    setPhase('catalog');
    setActiveCrate(null);
    setWonItem(null);
  };

  return (
    <div className="pointer-events-none flex-1 flex flex-col">
      {phase === 'catalog' && (
        <div className="pointer-events-auto flex-1 flex flex-col bg-[#060d1c]/88">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
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
                TIENDA Y CAJAS (DROPS)
              </h2>
            </div>

            <div className="font-mono-num text-sm font-bold text-amber-300">
              SALDO: {save.credits.toLocaleString('es-ES')} CR
            </div>
          </div>

          {errorMsg && (
            <div className="mx-6 mt-4 px-4 py-2.5 bg-rose-950/90 border border-rose-500 text-rose-200 text-sm font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="flex-1 allow-scroll p-5 sm:p-8">
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {CRATES.map((crate) => {
                const canAfford = save.credits >= crate.price;
                return (
                  <div
                    key={crate.id}
                    className="flex flex-col justify-between bg-[#0c162c] border border-white/15 p-4 shadow-xl"
                    style={{ borderTop: `4px solid ${crate.accentHex}` }}
                  >
                    <div>
                      {/* Hexagonal Drop Crate Emblem */}
                      <div className="h-32 flex items-center justify-center mb-3 bg-slate-950/70 border border-white/5">
                        <svg viewBox="0 0 80 80" className="w-20 h-20">
                          <polygon
                            points="40,6 70,23 70,57 40,74 10,57 10,23"
                            fill="#0f172a"
                            stroke={crate.accentHex}
                            strokeWidth="4"
                          />
                          <polygon
                            points="40,18 58,28 58,52 40,62 22,52 22,28"
                            fill={crate.accentHex}
                            fillOpacity="0.28"
                            stroke={crate.accentHex}
                            strokeWidth="2"
                          />
                          <circle cx="40" cy="40" r="8" fill={crate.accentHex} />
                        </svg>
                      </div>

                      <h3 className="font-display font-extrabold italic text-2xl text-white uppercase tracking-wide">
                        {crate.name}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed min-h-[3.2rem]">
                        {crate.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-display font-bold tracking-wider text-slate-400">
                          PRECIO
                        </span>
                        <span className="font-mono-num text-lg font-bold text-amber-300">
                          {crate.price} CR
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => startOpening(crate)}
                        className={`w-full py-2.5 font-display font-extrabold italic text-lg tracking-wider uppercase rl-bevel cursor-pointer transition-colors ${
                          canAfford
                            ? 'bg-[#ff6600] hover:bg-[#ff771a] text-white'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {canAfford ? 'ABRIR CAJA' : 'SIN CRÉDITOS'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3D Pod Spin Overlay */}
      {phase === 'pod_spin' && activeCrate && (
        <div className="pointer-events-auto flex-1 flex flex-col items-center justify-end pb-16 bg-black/35">
          <div className="text-center">
            <div
              className="font-display font-extrabold italic text-4xl tracking-wider uppercase"
              style={{ color: activeCrate.accentHex }}
            >
              ABRIENDO {activeCrate.name}...
            </div>
            <p className="text-sm text-slate-200 mt-1">
              Desbloqueando cápsula de suministro
            </p>
          </div>
        </div>
      )}

      {/* Horizontal Roulette Strip */}
      {phase === 'roulette' && (
        <div className="pointer-events-auto flex-1 flex flex-col items-center justify-center bg-black/75 p-4">
          <div className="font-display font-extrabold italic text-3xl text-white uppercase tracking-wider mb-6">
            {activeCrate?.name}
          </div>

          <div className="relative w-full max-w-3xl h-44 bg-[#070e1d] border-y-2 border-[#0088ff] overflow-hidden">
            {/* Red Center Target Needle */}
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-rose-500 z-20 -translate-x-1/2 shadow-[0_0_12px_#f43f5e]" />

            <div
              ref={trackRef}
              className="absolute top-4 left-1/2 flex items-center"
              style={{ gap: `${CARD_GAP}px`, willChange: 'transform' }}
            >
              {strip.map((item, idx) => {
                const rc = RARITY_COLORS[item.rarity];
                return (
                  <div
                    key={`${item.id}_${idx}`}
                    className="shrink-0 h-36 p-3 flex flex-col justify-between border-2 bg-slate-900"
                    style={{
                      width: `${CARD_W}px`,
                      borderColor: rc.border,
                      backgroundColor: '#0c162c',
                    }}
                  >
                    <div
                      className="h-14 w-full border border-white/10"
                      style={{
                        background: item.accentHex
                          ? `linear-gradient(135deg, ${item.previewHex}, ${item.accentHex})`
                          : item.previewHex,
                      }}
                    />
                    <div>
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: rc.text }}
                      >
                        {item.rarity}
                      </div>
                      <div className="font-display font-bold italic text-base text-white truncate">
                        {item.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Celebration Reveal Screen */}
      {phase === 'reveal' && wonItem && (
        <div className="pointer-events-auto flex-1 flex items-center justify-center bg-black/82 p-4">
          <div
            className={`w-full max-w-md bg-[#0a1428] border-2 p-6 text-center shadow-2xl ${
              wonItem.rarity === 'Mercado Negro' ? 'bm-rainbow-card' : ''
            }`}
            style={{ borderColor: RARITY_COLORS[wonItem.rarity].border }}
          >
            <div className="inline-flex items-center gap-2 text-xs font-display font-extrabold italic tracking-widest uppercase mb-2"
              style={{ color: RARITY_COLORS[wonItem.rarity].text }}
            >
              <Sparkles className="w-4 h-4" />
              OBJETO OBTENIDO · {wonItem.rarity}
            </div>

            <div
              className="w-36 h-36 mx-auto my-4 border-2 border-white/25 shadow-inner"
              style={{
                background: wonItem.accentHex
                  ? `linear-gradient(135deg, ${wonItem.previewHex}, ${wonItem.accentHex})`
                  : wonItem.previewHex,
              }}
            />

            <h3 className="font-display font-extrabold italic text-4xl text-white uppercase tracking-wide">
              {wonItem.name}
            </h3>
            <p className="text-xs text-slate-300 mt-2 mb-6">{wonItem.description}</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={equippedDone}
                onClick={() => {
                  soundEngine.playUiClick();
                  onEquipWonItem(wonItem);
                  setEquippedDone(true);
                }}
                className={`py-3 font-display font-extrabold italic text-lg tracking-wider uppercase rl-bevel cursor-pointer ${
                  equippedDone
                    ? 'bg-emerald-700 text-white cursor-default'
                    : 'bg-[#0088ff] hover:bg-[#1a96ff] text-white'
                }`}
              >
                {equippedDone ? 'EQUIPADO' : 'EQUIPAR AHORA'}
              </button>
              <button
                type="button"
                onClick={closeOpening}
                className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-display font-extrabold italic text-lg tracking-wider uppercase rl-bevel cursor-pointer"
              >
                ACEPTAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
