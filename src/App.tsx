/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DifficultyId,
  GameItem,
  GameModeId,
  SaveData,
  TeamColor,
} from './game/catalog';
import {
  GarageZoomTarget,
  HudSnapshot,
  MatchConfig,
  TurboLeagueEngine,
} from './game/engine';
import { soundEngine } from './game/sound';
import {
  equipItemOnTeam,
  loadSaveData,
  openCrateTransaction,
  performTradeIn,
  persistSaveData,
} from './game/storage';
import { ProfileBar } from './components/ProfileBar';
import { MainMenu, MenuScreen } from './components/MainMenu';
import { GarageView } from './components/GarageView';
import { ShopView } from './components/ShopView';
import { InventoryView } from './components/InventoryView';
import { MatchHUD } from './components/MatchHUD';
import { TouchControls, TouchInputState } from './components/TouchControls';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TurboLeagueEngine | null>(null);

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<MenuScreen | 'match'>('home');
  const [previewTeam, setPreviewTeam] = useState<TeamColor>('blue');
  const [muted, setMuted] = useState(false);
  const [touchControlsVisible, setTouchControlsVisible] = useState(true);
  const [infiniteBoost, setInfiniteBoost] = useState(true);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [matchReward, setMatchReward] = useState<{ xp: number; credits: number } | null>(
    null,
  );

  const lastMatchOptsRef = useRef<{
    mode: GameModeId;
    difficulty: DifficultyId;
    durationSeconds: number;
  }>({ mode: '2v2', difficulty: 'profesional', durationSeconds: 180 });

  const saveRef = useRef(save);
  saveRef.current = save;

  const screenRef = useRef(screen);
  screenRef.current = screen;

  const hudRef = useRef(hud);
  hudRef.current = hud;

  const updateSave = useCallback((next: SaveData) => {
    setSave(next);
    persistSaveData(next);
  }, []);

  // Touch & Keyboard merged input state
  const keysHeld = useRef<Set<string>>(new Set());
  const touchInputRef = useRef<TouchInputState>({
    steer: 0,
    pitch: 0,
    throttle: 0,
    boostHeld: false,
    driftHeld: false,
  });

  const syncMergedInput = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const keys = keysHeld.current;
    const ti = touchInputRef.current;

    const kUp = keys.has('KeyW') || keys.has('ArrowUp');
    const kDown = keys.has('KeyS') || keys.has('ArrowDown');
    const kLeft = keys.has('KeyA') || keys.has('ArrowLeft');
    const kRight = keys.has('KeyD') || keys.has('ArrowRight');

    const kThrottle = (kUp ? 1 : 0) - (kDown ? 1 : 0);
    const kSteer = (kRight ? 1 : 0) - (kLeft ? 1 : 0);

    const throttle = Math.abs(ti.throttle) > 0.05 ? ti.throttle : kThrottle;
    const steer = Math.abs(ti.steer) > 0.05 ? ti.steer : kSteer;
    const pitch = Math.abs(ti.pitch) > 0.05 ? ti.pitch : kThrottle;
    const boostHeld =
      ti.boostHeld || keys.has('ShiftLeft');
    const driftHeld =
      ti.driftHeld || keys.has('KeyC') || keys.has('ShiftRight');

    engine.setPlayerInput({
      throttle,
      steer,
      pitch,
      yaw: steer,
      roll: steer,
      boostHeld,
      driftHeld,
    });
  }, []);

  const startMatch = useCallback(
    (opts: {
      mode: GameModeId;
      difficulty: DifficultyId;
      durationSeconds: number;
    }) => {
      const engine = engineRef.current;
      if (!engine) return;
      lastMatchOptsRef.current = opts;
      setMatchReward(null);
      setInfiniteBoost(opts.mode === 'freeplay');
      setScreen('match');
      document.body.dataset.state = 'playing';

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const cur = saveRef.current;
      const cfg: MatchConfig = {
        mode: opts.mode,
        difficulty: opts.difficulty,
        durationSeconds: opts.durationSeconds,
        playerName: cur.playerName,
        blueLoadout: cur.loadouts.blue,
        orangeLoadout: cur.loadouts.orange,
      };
      engine.startMatch(cfg);
    },
    [],
  );

  const handleMatchFinish = useCallback(
    (finalSnap: HudSnapshot) => {
      document.body.dataset.state = 'gameover';
      const cur = saveRef.current;
      const playerRow = finalSnap.scoreboardRows.find((r) => r.isPlayer);
      const won = finalSnap.winnerTeam === 'blue';
      const xpGain = 150 + (won ? 120 : 40) + (playerRow?.goals ?? 0) * 50;
      const crGain = (won ? 120 : 60) + (playerRow?.goals ?? 0) * 25;

      setMatchReward({ xp: xpGain, credits: crGain });
      const updated: SaveData = {
        ...cur,
        xp: cur.xp + xpGain,
        credits: cur.credits + crGain,
        stats: {
          matches: cur.stats.matches + 1,
          wins: cur.stats.wins + (won ? 1 : 0),
          goals: cur.stats.goals + (playerRow?.goals ?? 0),
          saves: cur.stats.saves + (playerRow?.saves ?? 0),
          demos: cur.stats.demos + (playerRow?.demos ?? 0),
        },
      };
      updateSave(updated);
    },
    [updateSave],
  );

  // Mount Three.js Engine once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new TurboLeagueEngine(
      mountEl,
      (snap) => {
        setHud(snap);
        if (screenRef.current === 'match') {
          if (snap.paused) document.body.dataset.state = 'paused';
          else if (snap.phase === 'podium') document.body.dataset.state = 'gameover';
          else document.body.dataset.state = 'playing';
        }
      },
      (finalSnap) => {
        handleMatchFinish(finalSnap);
      },
    );
    engineRef.current = engine;

    const loadout = saveRef.current.loadouts.blue;
    engine.updateShowcaseCar({
      bodyId: loadout.bodyId,
      decalId: loadout.decalId,
      primaryColor: loadout.primaryColor,
      secondaryColor: loadout.secondaryColor,
      wheelId: loadout.wheelId,
      topperId: loadout.topperId,
    });
    engine.setSceneMode('menu');
    document.body.dataset.state = 'title';

    // Support ?autostart=1 for instant gameplay
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1'
    ) {
      startMatch({ mode: '2v2', difficulty: 'profesional', durationSeconds: 180 });
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleMatchFinish, startMatch]);

  // Keep Showcase Car synced when editing Garage / Team Preview
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || screen === 'match') return;
    const loadout = save.loadouts[previewTeam];
    engine.updateShowcaseCar({
      bodyId: loadout.bodyId,
      decalId: loadout.decalId,
      primaryColor: loadout.primaryColor,
      secondaryColor: loadout.secondaryColor,
      wheelId: loadout.wheelId,
      topperId: loadout.topperId,
    });
  }, [save.loadouts, previewTeam, screen]);

  // Global iPad Safari Gesture Lock & Audio Unlock
  useEffect(() => {
    const unlockOnce = () => {
      soundEngine.unlock();
    };

    const isInteractiveOrScrollable = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(
        target.closest('.allow-scroll, button, input, select, textarea, a'),
      );
    };

    const onTouchStart = (e: TouchEvent) => {
      unlockOnce();
      if (!isInteractiveOrScrollable(e.target)) {
        e.preventDefault();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isInteractiveOrScrollable(e.target)) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isInteractiveOrScrollable(e.target)) {
        e.preventDefault();
      }
    };

    const onGestureStart = (e: Event) => {
      e.preventDefault();
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: false });
    document.addEventListener('gesturestart', onGestureStart, { passive: false });
    document.addEventListener('contextmenu', onContextMenu, { passive: false });

    return () => {
      window.removeEventListener('pointerdown', unlockOnce);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('gesturestart', onGestureStart);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  // Global Keyboard Controls (WASD / Arrows / Space / Shift / C / F / Tab / R / Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      soundEngine.unlock();

      if (screenRef.current !== 'match') {
        if (
          screenRef.current === 'home' &&
          (e.code === 'Enter' || e.code === 'Space')
        ) {
          // Only trigger quick start if no modal is already handling Enter
          const hasModal = document.querySelector('[data-start="true"]');
          if (hasModal && e.code === 'Enter') {
            e.preventDefault();
            startMatch(lastMatchOptsRef.current);
          }
        }
        return;
      }

      if (e.code === 'Tab' || e.code === 'KeyF') {
        e.preventDefault();
        if (!e.repeat) engineRef.current?.toggleBallCam();
        return;
      }
      if (e.code === 'KeyR') {
        if (!e.repeat) engineRef.current?.rightPlayerCar();
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (!e.repeat && hudRef.current) {
          engineRef.current?.setPaused(!hudRef.current.paused);
        }
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) engineRef.current?.triggerJump();
        return;
      }

      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'ShiftLeft',
          'ShiftRight',
          'KeyC',
        ].includes(e.code)
      ) {
        e.preventDefault();
        keysHeld.current.add(e.code);
        syncMergedInput();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        engineRef.current?.releaseJump();
        return;
      }
      if (keysHeld.current.has(e.code)) {
        keysHeld.current.delete(e.code);
        syncMergedInput();
      }
    };

    const clearAllInputs = () => {
      keysHeld.current.clear();
      engineRef.current?.releaseJump();
      syncMergedInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAllInputs);
    document.addEventListener('visibilitychange', clearAllInputs);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearAllInputs);
      document.removeEventListener('visibilitychange', clearAllInputs);
    };
  }, [startMatch, syncMergedInput]);

  const navigateMenu = (next: MenuScreen) => {
    setScreen(next);
    document.body.dataset.state = 'title';
    if (next === 'garage') {
      engineRef.current?.setSceneMode('garage');
      engineRef.current?.setGarageTarget('overview');
    } else {
      engineRef.current?.setSceneMode('menu');
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none">
      {/* Isolated WebGL Canvas Mount */}
      <div
        ref={canvasMountRef}
        data-testid="webgl-canvas-container"
        className="fixed inset-0 z-0"
      />

      {/* UI Overlay Layer */}
      <div
        id="ui-layer"
        className="pointer-events-none fixed inset-0 z-10 flex flex-col"
      >
        {screen !== 'match' && (
          <ProfileBar
            save={save}
            muted={muted}
            onToggleMute={() => {
              const next = !muted;
              setMuted(next);
              soundEngine.setMuted(next);
            }}
            onUpdateName={(name) => updateSave({ ...save, playerName: name })}
            onCycleAvatar={() =>
              updateSave({ ...save, avatarIndex: (save.avatarIndex + 1) % 6 })
            }
          />
        )}

        {screen === 'home' && (
          <MainMenu
            onNavigate={navigateMenu}
            onStartMatch={startMatch}
          />
        )}

        {screen === 'garage' && (
          <GarageView
            save={save}
            previewTeam={previewTeam}
            onChangePreviewTeam={setPreviewTeam}
            onEquipItem={(team, item) =>
              updateSave(equipItemOnTeam(save, team, item))
            }
            onSetColors={(team, primaryColor, secondaryColor) =>
              updateSave({
                ...save,
                loadouts: {
                  ...save.loadouts,
                  [team]: {
                    ...save.loadouts[team],
                    primaryColor,
                    secondaryColor,
                  },
                },
              })
            }
            onChangeZoom={(target: GarageZoomTarget) =>
              engineRef.current?.setGarageTarget(target)
            }
            onOrbitDrag={(dx, dy) => engineRef.current?.orbitShowcase(dx, dy)}
            onBack={() => navigateMenu('home')}
          />
        )}

        {screen === 'shop' && (
          <ShopView
            save={save}
            onBuyCrate={(crateId) => {
              const res = openCrateTransaction(save, crateId);
              if (res.ok && res.updated) {
                updateSave(res.updated);
              }
              return res;
            }}
            onCrateSceneActive={(active, accentHex) => {
              if (active) {
                engineRef.current?.setSceneMode('crate');
                if (accentHex) engineRef.current?.setCrateAccent(accentHex);
              } else {
                engineRef.current?.setSceneMode('menu');
              }
            }}
            onEquipWonItem={(item: GameItem) => {
              const blueUpdated = equipItemOnTeam(save, 'blue', item);
              const bothUpdated = equipItemOnTeam(blueUpdated, 'orange', item);
              updateSave(bothUpdated);
            }}
            onBack={() => navigateMenu('home')}
          />
        )}

        {screen === 'inventory' && (
          <InventoryView
            save={save}
            onTradeIn={(instanceIds) => {
              const res = performTradeIn(save, instanceIds);
              if (res.ok && res.updated) {
                updateSave(res.updated);
              }
              return res;
            }}
            onBack={() => navigateMenu('home')}
          />
        )}

        {screen === 'match' && hud && (
          <>
            <MatchHUD
              hud={hud}
              touchControlsVisible={touchControlsVisible}
              infiniteBoost={infiniteBoost}
              matchReward={matchReward}
              onResume={() => engineRef.current?.setPaused(false)}
              onRestart={() => startMatch(lastMatchOptsRef.current)}
              onExitToMenu={() => {
                setHud(null);
                navigateMenu('home');
              }}
              onSkipReplay={() => engineRef.current?.skipReplay()}
              onToggleInfiniteBoost={() => {
                const next = engineRef.current?.toggleInfiniteBoost() ?? false;
                setInfiniteBoost(next);
              }}
              onResetBall={() => engineRef.current?.resetFreePlayBall()}
              onFreePlayDrill={(drill) => engineRef.current?.triggerFreePlayDrill(drill)}
            />

            {!hud.paused && hud.phase !== 'podium' && hud.phase !== 'replay' && (
              <TouchControls
                visible={touchControlsVisible}
                ballCam={hud.ballCam}
                onToggleTouchControls={() => setTouchControlsVisible((v) => !v)}
                onTouchStateChange={(st) => {
                  touchInputRef.current = st;
                  syncMergedInput();
                }}
                onJumpPress={() => engineRef.current?.triggerJump()}
                onJumpRelease={() => engineRef.current?.releaseJump()}
                onToggleBallCam={() => engineRef.current?.toggleBallCam()}
                onRightCar={() => engineRef.current?.rightPlayerCar()}
                onPause={() => engineRef.current?.setPaused(true)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
