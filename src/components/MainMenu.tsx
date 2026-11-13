import React, { useState } from 'react';
import { Play, Wrench, ShoppingBag, Package, ChevronRight, X } from 'lucide-react';
import { DifficultyId, GameModeId } from '../game/catalog';
import { soundEngine } from '../game/sound';

export type MenuScreen = 'home' | 'garage' | 'shop' | 'inventory';

interface MainMenuProps {
  onNavigate: (screen: MenuScreen) => void;
  onStartMatch: (opts: {
    mode: GameModeId;
    difficulty: DifficultyId;
    durationSeconds: number;
  }) => void;
}

const MODES: { id: GameModeId; title: string; subtitle: string; badge: string }[] = [
  { id: '1v1', title: 'DUELO 1v1', subtitle: 'Cara a cara contra un bot táctico', badge: 'COMPETITIVO' },
  { id: '2v2', title: 'DOBLES 2v2', subtitle: 'Tú + 1 Bot aliado contra 2 rivales', badge: 'POPULAR' },
  { id: '3v3', title: 'ESTÁNDAR 3v3', subtitle: 'Caos oficial 3 contra 3 en el estadio', badge: 'CLÁSICO' },
  { id: 'freeplay', title: 'ENTRENAMIENTO LIBRE', subtitle: 'Sin tiempo ni rivales · Turbo infinito', badge: 'PRÁCTICA' },
  { id: 'rumble', title: 'MODO RUMBLE / CAOS', subtitle: 'Balón gigante · Gravedad lunar · Golpe 1.5x', badge: 'CAOS' },
];

const DIFFICULTIES: { id: DifficultyId; label: string }[] = [
  { id: 'novato', label: 'Novato' },
  { id: 'profesional', label: 'Profesional' },
  { id: 'estrella', label: 'Estrella' },
  { id: 'gran_campeon', label: 'Gran Campeón' },
];

const DURATIONS = [
  { seconds: 120, label: '2 min' },
  { seconds: 180, label: '3 min' },
  { seconds: 300, label: '5 min' },
];

export const MainMenu: React.FC<MainMenuProps> = ({
  onNavigate,
  onStartMatch,
}) => {
  const [playOpen, setPlayOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameModeId>('2v2');
  const [difficulty, setDifficulty] = useState<DifficultyId>('profesional');
  const [duration, setDuration] = useState<number>(180);

  return (
    <div className="pointer-events-none flex-1 flex flex-col justify-between p-5 sm:p-8">
      {/* Left Navigation Column (keeps 3D car centerpiece completely clear) */}
      <div className="pointer-events-auto max-w-xs sm:max-w-sm flex flex-col gap-5">
        {/* Custom Inline SVG Emblem Lockup */}
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 48 48" className="w-12 h-12 shrink-0" aria-hidden="true">
            <polygon points="24,2 45,14 45,34 24,46 3,34 3,14" fill="#0b162d" stroke="#0088ff" strokeWidth="3" />
            <path d="M14 29 L22 15 L35 19 L27 33 Z" fill="#ff6600" />
            <circle cx="24" cy="24" r="5" fill="#ffffff" />
          </svg>
          <div>
            <h1 className="font-display font-extrabold italic text-4xl sm:text-5xl tracking-tight text-white leading-none uppercase">
              TURBO <span className="text-[#0088ff]">LEAGUE</span>
            </h1>
            <p className="text-xs font-display font-bold italic tracking-widest text-[#ff6600] uppercase mt-0.5">
              DFH STADIUM · ARENA 3D
            </p>
          </div>
        </div>

        {/* Rocket League Angled Menu Stack */}
        <nav aria-label="Menú principal" className="flex flex-col gap-2.5 mt-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setPlayOpen(true);
            }}
            className="group flex items-center justify-between px-5 py-3.5 bg-[#0088ff] hover:bg-[#1a96ff] text-white rl-bevel-lg shadow-lg transition-transform active:scale-98 cursor-pointer"
          >
            <span className="flex items-center gap-3 font-display font-extrabold italic text-2xl tracking-wide uppercase">
              <Play className="w-6 h-6 fill-current" />
              JUGAR
            </span>
            <ChevronRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onNavigate('garage');
            }}
            className="group flex items-center justify-between px-5 py-3 bg-[#0c162c]/90 hover:bg-[#142344] border border-white/15 hover:border-[#0088ff]/70 text-white rl-bevel transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-3 font-display font-bold italic text-xl tracking-wide uppercase">
              <Wrench className="w-5 h-5 text-[#38bdf8]" />
              GARAJE
            </span>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onNavigate('shop');
            }}
            className="group flex items-center justify-between px-5 py-3 bg-[#0c162c]/90 hover:bg-[#142344] border border-white/15 hover:border-[#ff6600]/70 text-white rl-bevel transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-3 font-display font-bold italic text-xl tracking-wide uppercase">
              <ShoppingBag className="w-5 h-5 text-[#ff6600]" />
              TIENDA Y CAJAS
            </span>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onNavigate('inventory');
            }}
            className="group flex items-center justify-between px-5 py-3 bg-[#0c162c]/90 hover:bg-[#142344] border border-white/15 hover:border-purple-400/70 text-white rl-bevel transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-3 font-display font-bold italic text-xl tracking-wide uppercase">
              <Package className="w-5 h-5 text-purple-400" />
              INVENTARIO Y TRADE-IN
            </span>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white" />
          </button>
        </nav>

        {/* Quick 1-click Play button for instant action */}
        <button
          type="button"
          data-start="true"
          onClick={() => {
            soundEngine.unlock();
            soundEngine.playUiClick();
            onStartMatch({
              mode: selectedMode,
              difficulty,
              durationSeconds: duration,
            });
          }}
          className="px-4 py-2 bg-[#ff6600] hover:bg-[#ff771a] text-white font-display font-extrabold italic text-base tracking-wider uppercase rl-bevel cursor-pointer text-center"
        >
          PARTIDO RÁPIDO ({selectedMode.toUpperCase()})
        </button>
      </div>

      {/* Bottom single-line control hint */}
      <div className="text-xs text-slate-300/85 font-medium tracking-wide">
        WASD / Flechas Conducir · Espacio Salto / Flip · Shift Turbo · C Derrape / Air Roll · F Ball Cam · R Enderezar
      </div>

      {/* Mode Selection Modal */}
      {playOpen && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-2xl bg-[#091224] border border-[#0088ff]/50 p-6 shadow-2xl max-h-[90vh] allow-scroll">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <h2 className="font-display font-extrabold italic text-3xl text-white uppercase tracking-wide">
                SELECCIONAR MODO DE JUEGO
              </h2>
              <button
                type="button"
                onClick={() => setPlayOpen(false)}
                aria-label="Cerrar selector de modo"
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
              {MODES.map((m) => {
                const active = selectedMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setSelectedMode(m.id);
                    }}
                    className={`text-left p-3.5 border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0088ff]/25 border-[#0088ff] text-white'
                        : 'bg-slate-900/90 border-white/10 text-slate-200 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-extrabold italic text-xl tracking-wide uppercase">
                        {m.title}
                      </span>
                      <span className="text-[10px] font-display font-bold tracking-widest text-[#ff6600]">
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{m.subtitle}</p>
                  </button>
                );
              })}
            </div>

            {selectedMode !== 'freeplay' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-xs font-display font-bold italic tracking-wider text-slate-400 uppercase mb-2">
                    DIFICULTAD DE IA
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setDifficulty(d.id);
                        }}
                        className={`py-2 px-2 text-xs font-bold border cursor-pointer ${
                          difficulty === d.id
                            ? 'bg-[#ff6600] border-[#ff8833] text-white'
                            : 'bg-slate-900 border-white/10 text-slate-300 hover:border-white/30'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-display font-bold italic tracking-wider text-slate-400 uppercase mb-2">
                    DURACIÓN DEL PARTIDO
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DURATIONS.map((dur) => (
                      <button
                        key={dur.seconds}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setDuration(dur.seconds);
                        }}
                        className={`py-2 px-2 text-xs font-bold border cursor-pointer ${
                          duration === dur.seconds
                            ? 'bg-[#0088ff] border-[#38bdf8] text-white'
                            : 'bg-slate-900 border-white/10 text-slate-300 hover:border-white/30'
                        }`}
                      >
                        {dur.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              data-start="true"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playUiClick();
                setPlayOpen(false);
                onStartMatch({
                  mode: selectedMode,
                  difficulty,
                  durationSeconds: duration,
                });
              }}
              className="w-full py-3.5 bg-[#0088ff] hover:bg-[#1a96ff] text-white font-display font-extrabold italic text-2xl tracking-wider uppercase rl-bevel-lg cursor-pointer"
            >
              INICIAR PARTIDO
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
