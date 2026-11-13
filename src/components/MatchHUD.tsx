import React from 'react';
import { FastForward, Play, RotateCcw, Home, Flame } from 'lucide-react';
import { HudSnapshot } from '../game/engine';
import { FreePlayDrillId } from '../game/physics';
import { soundEngine } from '../game/sound';

interface MatchHUDProps {
  hud: HudSnapshot;
  touchControlsVisible: boolean;
  infiniteBoost: boolean;
  matchReward: { xp: number; credits: number } | null;
  onResume: () => void;
  onRestart: () => void;
  onExitToMenu: () => void;
  onSkipReplay: () => void;
  onToggleInfiniteBoost: () => void;
  onResetBall: () => void;
  onFreePlayDrill: (drill: FreePlayDrillId) => void;
}

export const MatchHUD: React.FC<MatchHUDProps> = ({
  hud,
  touchControlsVisible,
  infiniteBoost,
  matchReward,
  onResume,
  onRestart,
  onExitToMenu,
  onSkipReplay,
  onToggleInfiniteBoost,
  onResetBall,
  onFreePlayDrill,
}) => {
  const mins = Math.floor(Math.max(0, hud.timeRemaining) / 60);
  const secs = Math.floor(Math.max(0, hud.timeRemaining) % 60);
  const clockStr =
    hud.mode === 'freeplay'
      ? 'LIBRE'
      : `${hud.isOvertime ? '+' : ''}${mins.toString().padStart(2, '0')}:${secs
          .toString()
          .padStart(2, '0')}`;

  // Circular Boost Gauge math
  const boostPct = Math.max(0, Math.min(100, hud.boost));
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - (boostPct / 100) * 0.78);

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* Supersonic Wind / Speed Vignette */}
      {hud.isSupersonic && hud.phase === 'playing' && (
        <div className="supersonic-vignette fixed inset-0 pointer-events-none" />
      )}

      {/* Top Rocket League Scoreboard */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="flex items-stretch shadow-2xl">
          <div className="w-16 sm:w-20 py-1.5 bg-[#0077ee] border-b-2 border-[#60a5fa] text-center rl-bevel">
            <span className="font-display font-extrabold italic text-3xl text-white font-mono-num">
              {hud.blueScore}
            </span>
          </div>

          <div className="px-5 py-1.5 bg-[#070e1d]/95 border-y border-white/20 flex items-center justify-center min-w-[106px]">
            <span
              className={`font-mono-num font-bold text-2xl ${
                hud.isOvertime ? 'text-amber-300' : 'text-white'
              }`}
            >
              {clockStr}
            </span>
          </div>

          <div className="w-16 sm:w-20 py-1.5 bg-[#ea580c] border-b-2 border-[#fb923c] text-center rl-bevel">
            <span className="font-display font-extrabold italic text-3xl text-white font-mono-num">
              {hud.orangeScore}
            </span>
          </div>
        </div>

        {hud.isOvertime && (
          <div className="mt-1 px-3 py-0.5 bg-amber-500 text-slate-950 font-display font-extrabold italic text-xs tracking-widest uppercase">
            PRÓRROGA · GOL DE ORO
          </div>
        )}
      </div>

      {/* Free Play Quick Utility & Pro Training Bar */}
      {hud.mode === 'freeplay' && hud.phase === 'playing' && !hud.paused && (
        <div className="pointer-events-auto fixed top-16 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1.5 max-w-[92vw]">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onToggleInfiniteBoost();
            }}
            className={`px-2.5 py-1 text-[11px] font-display font-bold italic uppercase border cursor-pointer ${
              infiniteBoost
                ? 'bg-[#ff6600] border-amber-300 text-white'
                : 'bg-slate-900/90 border-white/20 text-slate-300'
            }`}
          >
            TURBO INFINITO: {infiniteBoost ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onResetBall();
            }}
            className="px-2.5 py-1 bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-[11px] font-display font-bold italic uppercase text-white cursor-pointer"
          >
            REINICIAR BALÓN
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onFreePlayDrill('roof');
            }}
            className="px-2.5 py-1 bg-sky-950/90 hover:bg-sky-900 border border-sky-400/50 text-[11px] font-display font-bold italic uppercase text-sky-100 cursor-pointer"
          >
            BALÓN AL TECHO
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onFreePlayDrill('wall_pass');
            }}
            className="px-2.5 py-1 bg-sky-950/90 hover:bg-sky-900 border border-sky-400/50 text-[11px] font-display font-bold italic uppercase text-sky-100 cursor-pointer"
          >
            PASE A PARED
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onFreePlayDrill('high_ball');
            }}
            className="px-2.5 py-1 bg-sky-950/90 hover:bg-sky-900 border border-sky-400/50 text-[11px] font-display font-bold italic uppercase text-sky-100 cursor-pointer"
          >
            BALÓN ALTO
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onFreePlayDrill('goal_shot');
            }}
            className="px-2.5 py-1 bg-amber-950/90 hover:bg-amber-900 border border-amber-400/50 text-[11px] font-display font-bold italic uppercase text-amber-100 cursor-pointer"
          >
            TIRO A TU PORTERÍA
          </button>
        </div>
      )}

      {/* Kickoff Countdown */}
      {hud.phase === 'countdown' && hud.countdownText && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="font-display font-extrabold italic text-8xl sm:text-9xl text-white drop-shadow-[0_6px_24px_rgba(0,136,255,0.85)] tracking-wider">
            {hud.countdownText}
          </div>
        </div>
      )}

      {/* Subtle Freestyle Mechanic Toast */}
      {hud.mechanicBanner && hud.phase === 'playing' && !hud.paused && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 px-4 py-1 border font-display font-extrabold italic text-sm tracking-widest uppercase shadow-lg pointer-events-none ${
            hud.mode === 'freeplay' ? 'top-28' : 'top-20'
          } ${
            hud.mechanicBanner.tone === 'blue'
              ? 'bg-sky-600/90 border-sky-300 text-white'
              : hud.mechanicBanner.tone === 'amber'
                ? 'bg-amber-600/90 border-amber-300 text-white'
                : hud.mechanicBanner.tone === 'violet'
                  ? 'bg-violet-600/90 border-violet-300 text-white'
                  : 'bg-emerald-600/90 border-emerald-300 text-white'
          }`}
        >
          {hud.mechanicBanner.label}
        </div>
      )}

      {/* Demolition Toast */}
      {hud.demoBanner && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 px-5 py-2 bg-[#ff4400]/95 border border-amber-300 text-white font-display font-extrabold italic text-xl tracking-wider uppercase rl-bevel shadow-xl">
          {hud.demoBanner}
        </div>
      )}

      {/* Goal Celebration Banner */}
      {(hud.phase === 'goal_slowmo' || hud.phase === 'replay') && hud.goalBanner && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-[92vw] max-w-xl text-center pointer-events-none">
          <div
            className={`px-6 py-4 border-2 rl-bevel-lg shadow-2xl ${
              hud.goalBanner.team === 'blue'
                ? 'bg-[#0044aa]/90 border-[#38bdf8]'
                : 'bg-[#b43c00]/90 border-[#fbbf24]'
            }`}
          >
            <div className="font-display font-extrabold italic text-4xl sm:text-5xl text-white uppercase tracking-wide">
              ¡GOL DE {hud.goalBanner.scorerName}!
            </div>
            <div className="font-mono-num text-sm font-bold text-amber-200 mt-1">
              VELOCIDAD DEL DISPARO: {hud.goalBanner.speedKmh} KM/H
            </div>
          </div>
        </div>
      )}

      {/* Instant Replay Overlay */}
      {hud.phase === 'replay' && (
        <div className="pointer-events-auto fixed top-16 left-4 right-4 flex items-center justify-between">
          <div className="px-4 py-1.5 bg-rose-600/95 text-white font-display font-extrabold italic text-lg tracking-widest uppercase rl-bevel">
            REPETICIÓN INSTANTÁNEA
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onSkipReplay();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900/95 hover:bg-slate-800 border border-white/30 text-white font-display font-bold italic text-sm uppercase cursor-pointer"
          >
            <FastForward className="w-4 h-4" />
            SALTAR REPETICIÓN
          </button>
        </div>
      )}

      {/* Circular Boost Meter (Bottom-Right when touch off, or cleanly positioned above gamepad on iPad) */}
      {hud.phase !== 'podium' && hud.phase !== 'replay' && (
        <div
          className={`fixed pointer-events-none transition-all ${
            touchControlsVisible
              ? 'right-4 bottom-[228px] scale-90'
              : 'right-6 bottom-6'
          }`}
        >
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg viewBox="0 0 110 110" className="w-full h-full -rotate-[220deg]">
              <circle
                cx="55"
                cy="55"
                r={r}
                fill="rgba(7, 14, 29, 0.86)"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="10"
                strokeDasharray={`${circ * 0.78} ${circ}`}
                strokeLinecap="round"
              />
              <circle
                cx="55"
                cy="55"
                r={r}
                fill="none"
                stroke={boostPct > 65 ? '#facc15' : '#ff6600'}
                strokeWidth="10"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono-num font-bold text-3xl text-white leading-none">
                {hud.mode === 'freeplay' && infiniteBoost ? '∞' : boostPct}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-display font-bold italic tracking-wider text-amber-400 mt-1">
                <Flame className="w-3 h-3" />
                TURBO
              </div>
              <div className="font-mono-num text-[10px] text-slate-300 mt-0.5">
                {hud.speedKmh} km/h
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {hud.paused && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm bg-[#091224] border border-[#0088ff]/60 p-6 shadow-2xl">
            <h2 className="font-display font-extrabold italic text-3xl text-white uppercase tracking-wide mb-5 text-center">
              PARTIDO EN PAUSA
            </h2>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onResume();
                }}
                className="flex items-center justify-center gap-2 py-3 bg-[#0088ff] hover:bg-[#1a96ff] text-white font-display font-extrabold italic text-xl uppercase rl-bevel cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                REANUDAR
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onRestart();
                }}
                className="flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-display font-bold italic text-lg uppercase rl-bevel cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                REINICIAR PARTIDO
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onExitToMenu();
                }}
                className="flex items-center justify-center gap-2 py-3 bg-rose-950/90 hover:bg-rose-900 border border-rose-500/40 text-rose-100 font-display font-bold italic text-lg uppercase rl-bevel cursor-pointer"
              >
                <Home className="w-5 h-5" />
                MENÚ PRINCIPAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Match Podium & Scoreboard Screen */}
      {hud.phase === 'podium' && (
        <div className="pointer-events-auto fixed inset-x-0 bottom-0 top-14 flex flex-col justify-end p-4 sm:p-8 bg-gradient-to-t from-[#050a14] via-[#050a14]/70 to-transparent">
          <div className="max-w-3xl w-full mx-auto bg-[#091224]/95 border border-white/15 p-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 mb-4">
              <div>
                <div className="text-xs font-display font-bold italic tracking-widest text-amber-400 uppercase">
                  FINAL DEL PARTIDO · {hud.blueScore} - {hud.orangeScore}
                </div>
                <h2 className="font-display font-extrabold italic text-4xl text-white uppercase">
                  {hud.winnerTeam === 'blue'
                    ? '¡VICTORIA EQUIPO AZUL!'
                    : 'VICTORIA EQUIPO NARANJA'}
                </h2>
              </div>

              {matchReward && (
                <div className="flex items-center gap-4 bg-slate-900 border border-amber-400/30 px-4 py-2">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold">XP GANADA</div>
                    <div className="font-mono-num text-lg font-bold text-[#38bdf8]">
                      +{matchReward.xp} XP
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold">CRÉDITOS</div>
                    <div className="font-mono-num text-lg font-bold text-amber-300">
                      +{matchReward.credits} CR
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto mb-5">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] font-display font-bold tracking-wider text-slate-400 border-b border-white/10">
                    <th className="py-2">JUGADOR</th>
                    <th className="py-2 text-right">PUNTOS</th>
                    <th className="py-2 text-right">GOLES</th>
                    <th className="py-2 text-right">PARADAS</th>
                    <th className="py-2 text-right">DEMOS</th>
                  </tr>
                </thead>
                <tbody>
                  {hud.scoreboardRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-white/5 ${
                        row.isPlayer ? 'bg-[#0088ff]/15 font-bold' : ''
                      }`}
                    >
                      <td className="py-2 flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 inline-block ${
                            row.team === 'blue' ? 'bg-[#0088ff]' : 'bg-[#ff6600]'
                          }`}
                        />
                        <span className="text-white">{row.name}</span>
                      </td>
                      <td className="py-2 text-right font-mono-num text-white">
                        {row.score}
                      </td>
                      <td className="py-2 text-right font-mono-num text-slate-200">
                        {row.goals}
                      </td>
                      <td className="py-2 text-right font-mono-num text-slate-200">
                        {row.saves}
                      </td>
                      <td className="py-2 text-right font-mono-num text-slate-200">
                        {row.demos}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onRestart();
                }}
                className="py-3 bg-[#0088ff] hover:bg-[#1a96ff] text-white font-display font-extrabold italic text-xl uppercase rl-bevel cursor-pointer"
              >
                REVANCHA
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onExitToMenu();
                }}
                className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-display font-extrabold italic text-xl uppercase rl-bevel cursor-pointer"
              >
                MENÚ PRINCIPAL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
