import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../game/sound';

export interface TouchInputState {
  steer: number;
  pitch: number;
  throttle: number;
  boostHeld: boolean;
  driftHeld: boolean;
}

interface TouchControlsProps {
  visible: boolean;
  ballCam: boolean;
  onToggleTouchControls: () => void;
  onTouchStateChange: (state: TouchInputState) => void;
  onJumpPress: () => void;
  onJumpRelease: () => void;
  onToggleBallCam: () => void;
  onRightCar: () => void;
  onPause: () => void;
}

type ButtonId = 'brake' | 'boost' | 'jump' | 'drift';

export const TouchControls: React.FC<TouchControlsProps> = ({
  visible,
  ballCam,
  onToggleTouchControls,
  onTouchStateChange,
  onJumpPress,
  onJumpRelease,
  onToggleBallCam,
  onRightCar,
  onPause,
}) => {
  const [stickPos, setStickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeBtns, setActiveBtns] = useState<Record<ButtonId, boolean>>({
    brake: false,
    boost: false,
    jump: false,
    drift: false,
  });

  const joystickRef = useRef<HTMLDivElement | null>(null);
  const joystickTouchId = useRef<number | null>(null);
  const btnTouches = useRef<Map<number, ButtonId>>(new Map());
  const stickVecRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeBtnsRef = useRef<Record<ButtonId, boolean>>({
    brake: false,
    boost: false,
    jump: false,
    drift: false,
  });

  const mouseDraggingStick = useRef(false);

  const emitState = () => {
    const b = activeBtnsRef.current;
    const stickY = Math.abs(stickVecRef.current.y) > 0.04 ? stickVecRef.current.y : 0;
    const throttle = b.brake ? -1 : stickY;
    onTouchStateChange({
      steer: stickVecRef.current.x,
      pitch: stickVecRef.current.y,
      throttle,
      boostHeld: b.boost,
      driftHeld: b.drift,
    });
  };

  const syncButtonsFromMap = () => {
    const prevJump = activeBtnsRef.current.jump;
    const next: Record<ButtonId, boolean> = {
      brake: false,
      boost: false,
      jump: false,
      drift: false,
    };
    btnTouches.current.forEach((btnId) => {
      next[btnId] = true;
    });
    activeBtnsRef.current = next;
    setActiveBtns(next);

    if (!prevJump && next.jump) onJumpPress();
    if (prevJump && !next.jump) onJumpRelease();
    emitState();
  };

  const updateJoystickFromPoint = (clientX: number, clientY: number) => {
    const el = joystickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    const normX = dx / maxR;
    const normY = dy / maxR;
    const mag = Math.hypot(normX, normY);
    // 10% deadzone
    if (mag < 0.1) {
      stickVecRef.current = { x: 0, y: 0 };
      setStickPos({ x: 0, y: 0 });
    } else {
      const scaled = Math.min(1, (mag - 0.1) / 0.9);
      const rawX = (normX / mag) * scaled;
      const rawY = -(normY / mag) * scaled; // Up on stick = proportional forward throttle / nose down in air
      // Smooth steering curve: gentle precision near center, full turn at rim
      const smoothX = Math.sign(rawX) * (0.52 * Math.abs(rawX) + 0.48 * rawX * rawX);
      stickVecRef.current = {
        x: smoothX,
        y: rawY,
      };
      setStickPos({ x: dx, y: dy });
    }
    emitState();
  };

  useEffect(() => {
    const onWinMouseMove = (e: MouseEvent) => {
      if (!mouseDraggingStick.current) return;
      updateJoystickFromPoint(e.clientX, e.clientY);
    };
    const onWinMouseUp = () => {
      if (!mouseDraggingStick.current) return;
      mouseDraggingStick.current = false;
      stickVecRef.current = { x: 0, y: 0 };
      setStickPos({ x: 0, y: 0 });
      emitState();
    };
    window.addEventListener('mousemove', onWinMouseMove);
    window.addEventListener('mouseup', onWinMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('mouseup', onWinMouseUp);
      btnTouches.current.clear();
      joystickTouchId.current = null;
      mouseDraggingStick.current = false;
    };
  }, []);

  const handleBtnTouchStart = (btnId: ButtonId, e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    soundEngine.unlock();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      btnTouches.current.set(t.identifier, btnId);
    }
    syncButtonsFromMap();
  };

  const handleBtnTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      btnTouches.current.delete(e.changedTouches[i].identifier);
    }
    syncButtonsFromMap();
  };

  // Mouse fallback for desktop click testing on touch buttons
  const handleBtnMouseDown = (btnId: ButtonId, e: React.MouseEvent) => {
    e.preventDefault();
    soundEngine.unlock();
    btnTouches.current.set(-100, btnId);
    syncButtonsFromMap();
  };

  const handleBtnMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    btnTouches.current.delete(-100);
    syncButtonsFromMap();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {/* Top Quick Bar: Right Car + Pause + Touch Toggle */}
      <div className="pointer-events-auto fixed top-3 left-3 right-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onRightCar();
            }}
            className="px-3 py-1.5 bg-[#0a1326]/90 hover:bg-slate-800 border border-white/20 text-[11px] font-display font-bold italic tracking-wider text-white uppercase cursor-pointer"
          >
            ENDEREZAR COCHE
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onPause();
            }}
            className="px-3 py-1.5 bg-[#0a1326]/90 hover:bg-slate-800 border border-white/20 text-[11px] font-display font-bold italic tracking-wider text-white uppercase cursor-pointer"
          >
            PAUSA / MENÚ
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onToggleTouchControls();
          }}
          className="px-3 py-1.5 bg-[#0a1326]/90 hover:bg-slate-800 border border-[#0088ff]/60 text-[11px] font-display font-extrabold italic tracking-wider text-white uppercase cursor-pointer"
        >
          CONTROLES TÁCTILES: {visible ? 'ON' : 'OFF'}
        </button>
      </div>

      {!visible ? null : (
        <>
          {/* Upper-Mid-Right: Ball Cam Pill (+15% larger) with LED */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              soundEngine.unlock();
              onToggleBallCam();
            }}
            onClick={(e) => {
              e.preventDefault();
              onToggleBallCam();
            }}
            className="pointer-events-auto fixed right-5 top-16 flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0a1428]/90 border border-white/25 text-sm font-display font-extrabold italic tracking-wider text-white uppercase cursor-pointer shadow-lg"
          >
            <span
              className={`w-3 h-3 rounded-full ${
                ballCam
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : 'bg-slate-600'
              }`}
            />
            BALL CAM: {ballCam ? 'ON' : 'OFF'}
          </button>

          {/* Left Zone: Dynamic 140px Analog Joystick */}
          <div
            ref={joystickRef}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              soundEngine.unlock();
              if (joystickTouchId.current === null && e.changedTouches.length > 0) {
                const t = e.changedTouches[0];
                joystickTouchId.current = t.identifier;
                updateJoystickFromPoint(t.clientX, t.clientY);
              }
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              e.stopPropagation();
              for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === joystickTouchId.current) {
                  updateJoystickFromPoint(t.clientX, t.clientY);
                }
              }
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId.current) {
                  joystickTouchId.current = null;
                  stickVecRef.current = { x: 0, y: 0 };
                  setStickPos({ x: 0, y: 0 });
                  emitState();
                }
              }
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              joystickTouchId.current = null;
              stickVecRef.current = { x: 0, y: 0 };
              setStickPos({ x: 0, y: 0 });
              emitState();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              soundEngine.unlock();
              mouseDraggingStick.current = true;
              updateJoystickFromPoint(e.clientX, e.clientY);
            }}
            className="pointer-events-auto fixed bottom-6 left-6 w-[140px] h-[140px] rounded-full bg-[#081224]/55 border-2 border-[#0088ff] shadow-[0_0_18px_rgba(0,136,255,0.4)] flex items-center justify-center"
            aria-label="Joystick analógico"
          >
            <div className="w-[116px] h-[116px] rounded-full border border-[#ff6600]/35 flex items-center justify-center">
              <div
                className="w-14 h-14 rounded-full bg-[#0088ff]/80 border-2 border-white shadow-[0_0_14px_rgba(0,136,255,0.75)]"
                style={{
                  transform: `translate3d(${stickPos.x}px, ${stickPos.y}px, 0)`,
                }}
              />
            </div>
          </div>

          {/* Right Zone: Enlarged (+15%) Ergonomic Thumb Cluster (No Acelerar button) */}
          <div className="pointer-events-none fixed bottom-5 right-5 w-[236px] h-[196px]">
            {/* SALTO / FLIP (98px cyan circular top-left of cluster) */}
            <button
              type="button"
              onTouchStart={(e) => handleBtnTouchStart('jump', e)}
              onTouchEnd={handleBtnTouchEnd}
              onTouchCancel={handleBtnTouchEnd}
              onMouseDown={(e) => handleBtnMouseDown('jump', e)}
              onMouseUp={handleBtnMouseUp}
              onMouseLeave={handleBtnMouseUp}
              className={`pointer-events-auto absolute right-[118px] bottom-[90px] w-[98px] h-[98px] rounded-full border-2 flex items-center justify-center font-display font-extrabold italic text-base uppercase cursor-pointer transition-transform ${
                activeBtns.jump
                  ? 'bg-cyan-400 border-white text-slate-950 scale-95 shadow-[0_0_26px_#22d3ee]'
                  : 'bg-[#07263a]/85 border-cyan-400 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.35)]'
              }`}
            >
              SALTO
              <br />
              FLIP
            </button>

            {/* TURBO / BOOST (98px bright orange circular top-right of cluster) */}
            <button
              type="button"
              onTouchStart={(e) => handleBtnTouchStart('boost', e)}
              onTouchEnd={handleBtnTouchEnd}
              onTouchCancel={handleBtnTouchEnd}
              onMouseDown={(e) => handleBtnMouseDown('boost', e)}
              onMouseUp={handleBtnMouseUp}
              onMouseLeave={handleBtnMouseUp}
              className={`pointer-events-auto absolute right-0 bottom-[90px] w-[98px] h-[98px] rounded-full border-2 flex items-center justify-center font-display font-extrabold italic text-lg uppercase cursor-pointer transition-transform ${
                activeBtns.boost
                  ? 'bg-[#ff7700] border-white text-white scale-95 shadow-[0_0_28px_#ff6600]'
                  : 'bg-[#ff6600]/90 border-amber-300 text-white shadow-[0_0_16px_rgba(255,102,0,0.5)]'
              }`}
            >
              TURBO
            </button>

            {/* DERRAPE / AIR ROLL (76px purple circular bottom-left of cluster) */}
            <button
              type="button"
              onTouchStart={(e) => handleBtnTouchStart('drift', e)}
              onTouchEnd={handleBtnTouchEnd}
              onTouchCancel={handleBtnTouchEnd}
              onMouseDown={(e) => handleBtnMouseDown('drift', e)}
              onMouseUp={handleBtnMouseUp}
              onMouseLeave={handleBtnMouseUp}
              className={`pointer-events-auto absolute right-[128px] bottom-0 w-[76px] h-[76px] rounded-full border-2 flex items-center justify-center text-center leading-tight font-display font-extrabold italic text-xs uppercase cursor-pointer transition-transform ${
                activeBtns.drift
                  ? 'bg-purple-500 border-white text-white scale-95 shadow-[0_0_22px_#a855f7]'
                  : 'bg-[#0b162c]/80 border-purple-400/80 text-purple-100'
              }`}
            >
              DERRAPE
              <br />
              ROLL
            </button>

            {/* FRENO / REVERSA (104x74px rose rounded button bottom-right) */}
            <button
              type="button"
              onTouchStart={(e) => handleBtnTouchStart('brake', e)}
              onTouchEnd={handleBtnTouchEnd}
              onTouchCancel={handleBtnTouchEnd}
              onMouseDown={(e) => handleBtnMouseDown('brake', e)}
              onMouseUp={handleBtnMouseUp}
              onMouseLeave={handleBtnMouseUp}
              className={`pointer-events-auto absolute right-0 bottom-0 w-[104px] h-[74px] rounded-2xl border-2 flex items-center justify-center font-display font-extrabold italic text-sm uppercase cursor-pointer transition-transform ${
                activeBtns.brake
                  ? 'bg-rose-600 border-white text-white scale-95 shadow-[0_0_20px_#f43f5e]'
                  : 'bg-[#1f0c18]/85 border-rose-400/80 text-rose-100'
              }`}
            >
              FRENO
              <br />
              REVERSA
            </button>
          </div>
        </>
      )}
    </div>
  );
};
