import React, { useState } from 'react';
import { Volume2, VolumeX, BarChart3, Edit3, Check, X } from 'lucide-react';
import { SaveData } from '../game/catalog';
import { getLevelInfo } from '../game/storage';
import { soundEngine } from '../game/sound';

interface ProfileBarProps {
  save: SaveData;
  muted: boolean;
  onToggleMute: () => void;
  onUpdateName: (name: string) => void;
  onCycleAvatar: () => void;
}

const AVATAR_COLORS = [
  '#0088ff',
  '#ff6600',
  '#a855f7',
  '#10b981',
  '#f59e0b',
  '#ef4444',
];

export const ProfileBar: React.FC<ProfileBarProps> = ({
  save,
  muted,
  onToggleMute,
  onUpdateName,
  onCycleAvatar,
}) => {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(save.playerName);
  const [showStats, setShowStats] = useState(false);

  const levelInfo = getLevelInfo(save.xp);
  const avatarHex = AVATAR_COLORS[save.avatarIndex % AVATAR_COLORS.length];

  const commitName = () => {
    const clean = draftName.trim().toUpperCase().slice(0, 14) || 'PILOTO';
    onUpdateName(clean);
    setDraftName(clean);
    setEditing(false);
    soundEngine.playUiClick();
  };

  return (
    <>
      <div className="pointer-events-auto flex items-center justify-between gap-4 px-5 py-2.5 bg-[#081020]/90 border-b border-white/10">
        {/* Left: Avatar + Name + Level + XP */}
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onCycleAvatar();
            }}
            title="Cambiar emblema"
            aria-label="Cambiar emblema de jugador"
            className="w-10 h-10 shrink-0 rounded-md flex items-center justify-center border border-white/20 transition-transform active:scale-95 cursor-pointer"
            style={{ backgroundColor: avatarHex }}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
              <path d="M12 2L4 7v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V7l-8-5zm0 3.2l5 3.1v4.4c0 3.5-2.1 6.3-5 7.4-2.9-1.1-5-3.9-5-7.4V8.3l5-3.1z" />
            </svg>
          </button>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              {editing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitName()}
                    maxLength={14}
                    autoFocus
                    aria-label="Nombre de jugador"
                    className="w-32 px-2 py-0.5 text-sm font-display font-bold italic tracking-wider bg-slate-900 border border-[#0088ff] text-white rounded outline-none"
                  />
                  <button
                    type="button"
                    onClick={commitName}
                    aria-label="Guardar nombre"
                    className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(save.playerName);
                    setEditing(true);
                  }}
                  className="flex items-center gap-1.5 group cursor-pointer"
                  aria-label="Editar nombre de jugador"
                >
                  <span className="font-display font-extrabold italic text-lg tracking-wide text-white uppercase whitespace-nowrap">
                    {save.playerName}
                  </span>
                  <Edit3 className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0088ff] transition-colors" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-display font-bold italic tracking-wider text-[#38bdf8] whitespace-nowrap">
                NIVEL {levelInfo.level} · {levelInfo.title}
              </span>
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                <div
                  className="h-full bg-[#0088ff]"
                  style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Credits + Stats + Mute */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/95 border border-amber-400/35 rl-bevel">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
            <span className="font-mono-num font-bold text-sm text-amber-300 whitespace-nowrap">
              {save.credits.toLocaleString('es-ES')} CR
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setShowStats(true);
            }}
            aria-label="Estadísticas de carrera"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 border border-white/15 text-xs font-display font-bold italic tracking-wider text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4 text-[#0088ff]" />
            <span className="hidden sm:inline">CARRERA</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleMute();
            }}
            aria-label={muted ? 'Activar audio' : 'Silenciar audio'}
            className="p-2 bg-slate-800/90 hover:bg-slate-700 border border-white/15 text-slate-200 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Career Stats Modal */}
      {showStats && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md bg-[#0a1326] border border-[#0088ff]/50 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-3">
              <h2 className="font-display font-extrabold italic text-2xl tracking-wide text-white uppercase">
                ESTADÍSTICAS DE CARRERA
              </h2>
              <button
                type="button"
                onClick={() => setShowStats(false)}
                aria-label="Cerrar estadísticas"
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'PARTIDOS', val: save.stats.matches },
                { label: 'VICTORIAS', val: save.stats.wins },
                { label: 'GOLES', val: save.stats.goals },
                { label: 'PARADAS', val: save.stats.saves },
                { label: 'DEMOLICIONES', val: save.stats.demos },
                {
                  label: '% VICTORIAS',
                  val:
                    save.stats.matches > 0
                      ? `${Math.round((save.stats.wins / save.stats.matches) * 100)}%`
                      : '0%',
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="bg-slate-900/90 border border-white/10 px-4 py-3"
                >
                  <div className="text-[11px] font-display font-bold tracking-wider text-slate-400">
                    {row.label}
                  </div>
                  <div className="font-mono-num text-2xl font-bold text-white mt-0.5">
                    {row.val}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowStats(false)}
              className="w-full py-2.5 bg-[#0088ff] hover:bg-[#0099ff] font-display font-extrabold italic text-lg tracking-wider text-white uppercase cursor-pointer"
            >
              CERRAR
            </button>
          </div>
        </div>
      )}
    </>
  );
};
