import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA,
  BallState,
  CarState,
  arenaWallSDF2D,
  checkGoalScored,
  computeBotInput,
  computeFreePlayDrill,
  computeSafeBallCamPose,
  createOfficialBoostPads,
  enforceArenaHardBounds,
  quatFromAxisAngle,
  quatFromYaw,
  resolveArenaSphereCollision,
  resolveCarBallCollision,
  rotateVecByQuat,
  stepBallPhysics,
  stepBoostPads,
  stepCarPhysics,
} from './physics';
import {
  createDefaultSaveData,
  equipItemOnTeam,
  getLevelInfo,
  openCrateTransaction,
  performTradeIn,
} from './storage';
import { ITEM_BY_ID } from './catalog';

function makeTestCar(overrides: Partial<CarState> = {}): CarState {
  return {
    id: 'car_1',
    name: 'Tester',
    team: 'blue',
    isPlayer: true,
    bodyId: 'body_octane',
    decalId: 'decal_standard',
    primaryColor: '#0088ff',
    secondaryColor: '#ffffff',
    wheelId: 'wheel_oem',
    boostId: 'boost_standard',
    explosionId: 'exp_classic',
    topperId: 'topper_none',
    pos: { x: 0, y: ARENA.carHalfHeight, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    quat: quatFromYaw(0),
    angVel: { x: 0, y: 0, z: 0 },
    boost: 33,
    grounded: true,
    surfaceNormal: { x: 0, y: 1, z: 0 },
    hasFlip: true,
    airTimeSinceJump: 0,
    flipTimer: 0,
    flipDir: { x: 0, y: 0, z: 0 },
    isSupersonic: false,
    isBoosting: false,
    demolishedTimer: 0,
    wheelSpin: 0,
    steerAngle: 0,
    bodyPitchTilt: 0,
    bodyRollTilt: 0,
    lastTouchTime: 0,
    stats: { goals: 0, shots: 0, saves: 0, demos: 0, score: 0 },
    ...overrides,
  };
}

function makeTestBall(overrides: Partial<BallState> = {}): BallState {
  return {
    pos: { x: 0, y: ARENA.ballRadius, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    angVel: { x: 0, y: 0, z: 0 },
    quat: { x: 0, y: 0, z: 0, w: 1 },
    radius: ARENA.ballRadius,
    lastTouchTeam: null,
    lastTouchCarId: null,
    lastTouchCarName: null,
    hitFlash: 0,
    ...overrides,
  };
}

test('official boost pads layout creates 6 big (100%) and 28 small (12%) pads', () => {
  const pads = createOfficialBoostPads();
  assert.equal(pads.length, 34);
  assert.equal(pads.filter((p) => p.isBig).length, 6);
  assert.equal(pads.filter((p) => !p.isBig).length, 28);
});

test('boost pad pickup grants +100 / +12 boost and starts respawn cooldown', () => {
  const pads = createOfficialBoostPads();
  const bigPad = pads.find((p) => p.isBig)!;
  const car = makeTestCar({ pos: { x: bigPad.x, y: bigPad.y, z: bigPad.z }, boost: 20 });
  const events: any[] = [];
  stepBoostPads(pads, [car], 1 / 60, events);
  assert.equal(car.boost, 100);
  assert.equal(bigPad.active, false);
  assert.equal(bigPad.cooldown, 10);
  assert.equal(events.length, 1);

  // Advance 10.1 seconds -> pad respawns
  stepBoostPads(pads, [car], 10.1, events);
  assert.equal(bigPad.active, true);
});

test('arena collision keeps sphere inside walls, floor, ceiling, and detects goals', () => {
  const pos = { x: ARENA.halfW + 10, y: 10, z: 0 };
  const vel = { x: 20, y: 0, z: 0 };
  const col = resolveArenaSphereCollision(pos, vel, 1.65, 0.72, false);
  assert.equal(col.collided, true);
  assert.ok(pos.x <= ARENA.halfW - 1.65 + 1e-4);
  assert.ok(vel.x < 0);

  // Goal scored into Orange (+Z) by Blue
  const ballBlueGoal = makeTestBall({ pos: { x: 0, y: 2, z: ARENA.halfL + 2 } });
  assert.equal(checkGoalScored(ballBlueGoal), 'blue');

  // Goal scored into Blue (-Z) by Orange
  const ballOrangeGoal = makeTestBall({ pos: { x: 0, y: 2, z: -(ARENA.halfL + 2) } });
  assert.equal(checkGoalScored(ballOrangeGoal), 'orange');
});

test('car jump and directional flip apply impulse and flip multiplier on ball', () => {
  const car = makeTestCar();
  const events: any[] = [];
  // Jump
  stepCarPhysics(
    car,
    {
      throttle: 1,
      steer: 0,
      pitch: 0,
      yaw: 0,
      roll: 0,
      jumpHeld: true,
      jumpJustPressed: true,
      boostHeld: false,
      driftHeld: false,
    },
    1 / 60,
    '1v1',
    events,
  );
  assert.ok(car.vel.y > 10);
  assert.equal(car.hasFlip, true);

  // Mid-air frontflip
  stepCarPhysics(
    car,
    {
      throttle: 1,
      steer: 0,
      pitch: 1,
      yaw: 0,
      roll: 0,
      jumpHeld: true,
      jumpJustPressed: true,
      boostHeld: false,
      driftHeld: false,
    },
    1 / 60,
    '1v1',
    events,
  );
  assert.equal(car.hasFlip, false);
  assert.ok(car.flipTimer > 0.3);
  assert.ok(car.vel.z > 15);
});

test('car-ball collision is proportional for gentle dribbles and powerful on boost/flip', () => {
  assert.ok(ARENA.ballRadius >= 1.89 && ARENA.ballRadius <= 1.91);

  // 1. Gentle dribble touch (3 m/s, no boost, no flip): ball stays close with low bounce
  const slowCar = makeTestCar({
    pos: { x: 0, y: ARENA.carHalfHeight, z: -3.2 },
    vel: { x: 0, y: 0, z: 3 },
  });
  const dribbleBall = makeTestBall({ pos: { x: 0, y: ARENA.ballRadius, z: 0 } });
  const events: any[] = [];
  const slowHit = resolveCarBallCollision(slowCar, dribbleBall, '1v1', events);
  assert.equal(slowHit, true);
  assert.equal(dribbleBall.lastTouchTeam, 'blue');
  assert.ok(dribbleBall.vel.z > 1.5 && dribbleBall.vel.z < 5.0, `Expected gentle dribble vel.z, got ${dribbleBall.vel.z}`);
  assert.ok(dribbleBall.vel.y < 1.5, `Expected low vertical pop on dribble, got ${dribbleBall.vel.y}`);

  // 2. Power shot with Boost + Flip: high velocity output
  const powerCar = makeTestCar({
    pos: { x: 0, y: ARENA.carHalfHeight, z: -3.2 },
    vel: { x: 0, y: 0, z: 34 },
    isBoosting: true,
    flipTimer: 0.3,
  });
  const boomBall = makeTestBall({ pos: { x: 0, y: ARENA.ballRadius, z: 0 } });
  const powerHit = resolveCarBallCollision(powerCar, boomBall, '1v1', events);
  assert.equal(powerHit, true);
  assert.ok(boomBall.vel.z > 40, `Expected booming shot vel.z > 40, got ${boomBall.vel.z}`);
});

test('ball bounce restitution is 0.60 and curved 45-degree corner + cove deflect smoothly', () => {
  // Floor bounce restitution = 0.60
  const ball = makeTestBall({ pos: { x: 0, y: ARENA.ballRadius - 0.05, z: 0 }, vel: { x: 0, y: -20, z: 0 } });
  const events: any[] = [];
  stepBallPhysics(ball, 1 / 120, '1v1', events);
  assert.ok(ball.vel.y > 11.2 && ball.vel.y < 12.6, `Expected ~12 m/s bounce (0.60 restitution), got ${ball.vel.y}`);

  // 45-degree corner SDF normal points inward diagonally (-1/sqrt2, -1/sqrt2)
  const cornerSdf = arenaWallSDF2D(76, 112);
  assert.ok(cornerSdf.nx < -0.5 && cornerSdf.nz < -0.5, `Expected diagonal corner normal, got (${cornerSdf.nx}, ${cornerSdf.nz})`);

  // Ball entering lower concave cove curves smoothly upward instead of bouncing straight back
  const covePos = { x: ARENA.halfW - 1.92, y: 2.0, z: 0 };
  const coveVel = { x: 20, y: 0, z: 0 };
  const col = resolveArenaSphereCollision(covePos, coveVel, ARENA.ballRadius, 0.6, false);
  assert.equal(col.collided, true);
  assert.ok(col.normal.y > 0.2, `Expected upward curved cove normal, got ny=${col.normal.y}`);
  assert.ok(coveVel.y > 4, `Expected ball to curve upward along cove ramp, got vy=${coveVel.y}`);
});

test('tactical AI rotates back toward own goal when ball is behind it', () => {
  const bot = makeTestCar({
    id: 'bot_blue',
    team: 'blue',
    isPlayer: false,
    pos: { x: 0, y: ARENA.carHalfHeight, z: 20 },
    quat: quatFromYaw(0), // Facing +Z (away from own goal at -70)
  });
  const ball = makeTestBall({ pos: { x: 0, y: ARENA.ballRadius, z: -20 } });
  const pads = createOfficialBoostPads();
  const input = computeBotInput(bot, ball, pads, 'estrella', false);
  // Bot needs to turn around toward -Z
  assert.ok(Math.abs(input.steer) > 0.5);
});

test('storage: crate purchase deducts credits and adds item, trade-in upgrades 5 items to next rarity', () => {
  let save = createDefaultSaveData();
  assert.equal(save.credits, 2500);
  assert.equal(getLevelInfo(save.xp).level, 14);

  const tx = openCrateTransaction(save, 'crate_rare', () => 0.1);
  assert.equal(tx.ok, true);
  assert.equal(tx.updated!.credits, 2350);
  assert.equal(tx.updated!.inventory.length, save.inventory.length + 1);

  // Give 5 Raro items and trade them in for Muy Raro
  save = tx.updated!;
  const extraRares = Array.from({ length: 5 }, (_, i) => ({
    instanceId: `rare_test_${i}`,
    itemId: 'decal_flames',
    acquiredAt: Date.now(),
  }));
  save = { ...save, inventory: [...extraRares, ...save.inventory] };
  const trade = performTradeIn(
    save,
    extraRares.map((e) => e.instanceId),
    () => 0.25,
  );
  assert.equal(trade.ok, true);
  assert.equal(trade.resultItem!.rarity, 'Muy Raro');
  assert.equal(trade.updated!.inventory.length, save.inventory.length - 4);

  // Equipping item updates only the chosen team
  const fennec = ITEM_BY_ID['body_fennec'];
  const equipped = equipItemOnTeam(trade.updated!, 'orange', fennec);
  assert.equal(equipped.loadouts.orange.bodyId, 'body_fennec');
  assert.equal(equipped.loadouts.blue.bodyId, 'body_octane');
});

test('single jump while holding W stays upright during takeoff and completes 360 flip upright', () => {
  const car = makeTestCar();
  const events: any[] = [];
  const dt = 1 / 60;

  // Single jump while holding W (throttle=1, pitch=1)
  stepCarPhysics(
    car,
    {
      throttle: 1,
      steer: 0,
      pitch: 1,
      yaw: 0,
      roll: 0,
      jumpHeld: true,
      jumpJustPressed: true,
      boostHeld: false,
      driftHeld: false,
    },
    dt,
    '1v1',
    events,
  );

  // Simulate 0.24s with W still held: car should stay upright thanks to 0.26s takeoff grace
  for (let i = 0; i < 14; i++) {
    stepCarPhysics(
      car,
      {
        throttle: 1,
        steer: 0,
        pitch: 1,
        yaw: 0,
        roll: 0,
        jumpHeld: false,
        jumpJustPressed: false,
        boostHeld: false,
        driftHeld: false,
      },
      dt,
      '1v1',
      events,
    );
  }
  const upAfterTakeoff = rotateVecByQuat({ x: 0, y: 1, z: 0 }, car.quat);
  assert.ok(upAfterTakeoff.y > 0.99, `Expected upright during takeoff, got up.y=${upAfterTakeoff.y}`);

  // Now trigger frontflip and step 0.45s (27 frames at 60Hz)
  stepCarPhysics(
    car,
    {
      throttle: 1,
      steer: 0,
      pitch: 1,
      yaw: 0,
      roll: 0,
      jumpHeld: true,
      jumpJustPressed: true,
      boostHeld: false,
      driftHeld: false,
    },
    dt,
    '1v1',
    events,
  );
  for (let i = 0; i < 27; i++) {
    stepCarPhysics(
      car,
      {
        throttle: 1,
        steer: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        jumpHeld: false,
        jumpJustPressed: false,
        boostHeld: false,
        driftHeld: false,
      },
      dt,
      '1v1',
      events,
    );
  }
  const upAfterFlip = rotateVecByQuat({ x: 0, y: 1, z: 0 }, car.quat);
  assert.ok(upAfterFlip.y > 0.98, `Expected upright after 360 flip, got up.y=${upAfterFlip.y}`);
});

test('turtle recovery jump rights an upside-down car on the ground', () => {
  const invertedQuat = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI);
  const car = makeTestCar({
    pos: { x: 0, y: ARENA.carHalfHeight, z: 0 },
    quat: invertedQuat,
    grounded: false,
  });
  const events: any[] = [];
  stepCarPhysics(
    car,
    {
      throttle: 0,
      steer: 0,
      pitch: 0,
      yaw: 0,
      roll: 0,
      jumpHeld: true,
      jumpJustPressed: true,
      boostHeld: false,
      driftHeld: false,
    },
    1 / 60,
    '1v1',
    events,
  );
  const upAfterJump = rotateVecByQuat({ x: 0, y: 1, z: 0 }, car.quat);
  assert.ok(upAfterJump.y > 0.99, `Expected turtle jump to right car, got up.y=${upAfterJump.y}`);
  assert.ok(car.vel.y > 10);
});

test('normal driving without boost caps at 115-125 km/h while boost reaches supersonic 230-250 km/h', () => {
  const car = makeTestCar({ pos: { x: 0, y: ARENA.carHalfHeight, z: -40 }, boost: 100 });
  const events: any[] = [];
  const dt = 1 / 60;

  // 1. Accelerate for 2.5 seconds WITHOUT boost (reset pos periodically to avoid hitting end wall)
  for (let i = 0; i < 150; i++) {
    car.pos.z = -40;
    stepCarPhysics(
      car,
      {
        throttle: 1,
        steer: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        jumpHeld: false,
        jumpJustPressed: false,
        boostHeld: false,
        driftHeld: false,
      },
      dt,
      'freeplay',
      events,
      false,
    );
  }
  const normalKmh = car.vel.z * 3.6;
  assert.ok(
    normalKmh >= 115 && normalKmh <= 125,
    `Expected normal driving speed in 115-125 km/h, got ${normalKmh.toFixed(1)} km/h`,
  );
  assert.equal(car.isSupersonic, false);

  // 2. Now hold Boost with infiniteBoost for 1.5 seconds -> reaches 230-250 km/h supersonic
  for (let i = 0; i < 90; i++) {
    car.pos.z = -40;
    stepCarPhysics(
      car,
      {
        throttle: 1,
        steer: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        jumpHeld: false,
        jumpJustPressed: false,
        boostHeld: true,
        driftHeld: false,
      },
      dt,
      'freeplay',
      events,
      true,
    );
  }
  const boostKmh = car.vel.z * 3.6;
  assert.ok(
    boostKmh >= 230 && boostKmh <= 250,
    `Expected boost supersonic speed in 230-250 km/h, got ${boostKmh.toFixed(1)} km/h`,
  );
  assert.equal(car.isSupersonic, true);
});

test('1.8x stadium scale, +35% wider/taller goals, and all 34 boost pads inside playable turf', () => {
  assert.equal(ARENA.halfW, 90);
  assert.equal(ARENA.halfL, 126);
  assert.equal(ARENA.height, 68);
  assert.ok(ARENA.goalHalfW >= 15.5 && ARENA.goalHeight >= 11.0);
  assert.equal(ARENA.ballRadius, 1.9);
  assert.equal(ARENA.carRadius, 1.75);

  const pads = createOfficialBoostPads();
  for (const pad of pads) {
    const sdf = arenaWallSDF2D(pad.x, pad.z);
    assert.ok(sdf.wallDist > 1.5, `Pad ${pad.id} at (${pad.x}, ${pad.z}) too close/outside wall (${sdf.wallDist})`);
  }
});

test('high lateral grip without drift and passive air auto-leveling stability assist', () => {
  // 1. Lateral slide without driftHeld quickly cancels sideways slip
  const car = makeTestCar({
    pos: { x: 0, y: ARENA.carHalfHeight, z: 0 },
    vel: { x: 18, y: 0, z: 18 },
    quat: quatFromYaw(0),
    grounded: true,
  });
  const events: any[] = [];
  for (let i = 0; i < 12; i++) {
    stepCarPhysics(
      car,
      {
        throttle: 1,
        steer: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        jumpHeld: false,
        jumpJustPressed: false,
        boostHeld: false,
        driftHeld: false,
      },
      1 / 60,
      'freeplay',
      events,
    );
  }
  assert.ok(Math.abs(car.vel.x) < 1.5, `Expected lateral slip damped to < 1.5, got ${car.vel.x}`);

  // 2. Tilted falling car near ground auto-levels smoothly toward upright
  const tiltedQuat = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.6);
  const airCar = makeTestCar({
    pos: { x: 0, y: 4.5, z: 0 },
    vel: { x: 0, y: -6, z: 10 },
    quat: tiltedQuat,
    grounded: false,
    airTimeSinceJump: 0.6,
  });
  const upBefore = rotateVecByQuat({ x: 0, y: 1, z: 0 }, airCar.quat).y;
  for (let i = 0; i < 15; i++) {
    stepCarPhysics(
      airCar,
      {
        throttle: 0,
        steer: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        jumpHeld: false,
        jumpJustPressed: false,
        boostHeld: false,
        driftHeld: false,
      },
      1 / 60,
      'freeplay',
      events,
    );
  }
  const upAfter = rotateVecByQuat({ x: 0, y: 1, z: 0 }, airCar.quat).y;
  assert.ok(upAfter > upBefore + 0.05, `Expected auto-leveling to increase uprightness (${upBefore} -> ${upAfter})`);
});

test('flip shot magnetic assist slightly bends off-center shots toward opponent goal', () => {
  // Compare normal hit vs flip hit slightly offset laterally
  const normalCar = makeTestCar({
    pos: { x: -1.6, y: ARENA.carHalfHeight, z: -3.0 },
    vel: { x: 0, y: 0, z: 28 },
    flipTimer: 0,
  });
  const normalBall = makeTestBall({ pos: { x: 0, y: ARENA.ballRadius, z: 0 } });
  const events: any[] = [];
  resolveCarBallCollision(normalCar, normalBall, '1v1', events);

  const flipCar = makeTestCar({
    pos: { x: -1.6, y: ARENA.carHalfHeight, z: -3.0 },
    vel: { x: 0, y: 0, z: 28 },
    flipTimer: 0.28,
  });
  const flipBall = makeTestBall({ pos: { x: 0, y: ARENA.ballRadius, z: 0 } });
  resolveCarBallCollision(flipCar, flipBall, '1v1', events);

  // Blue aims for +Z goal at x=0, ball at x=0 -> pure contact pushes ball toward +X,
  // while flip assist keeps shot tighter toward center/goal (smaller |vel.x / vel.z| ratio)
  const normalAngle = Math.abs(normalBall.vel.x / (normalBall.vel.z || 1));
  const flipAngle = Math.abs(flipBall.vel.x / (flipBall.vel.z || 1));
  assert.ok(
    flipAngle < normalAngle,
    `Expected flip magnetic assist to aim closer to goal (${flipAngle.toFixed(3)} < ${normalAngle.toFixed(3)})`,
  );
});

test('bot AI prevents own goals via lateral bypass, rotates 3v3 roles, and scales by difficulty', () => {
  const pads = createOfficialBoostPads();

  // 1. Bot ahead of ball facing own goal must NOT boost straight into ball (own goal prevention)
  const wrongSideBot = makeTestCar({
    id: 'bot_wrong',
    team: 'blue',
    isPlayer: false,
    pos: { x: 0, y: ARENA.carHalfHeight, z: 30 },
    quat: quatFromYaw(Math.PI), // facing -Z (toward own goal and ball!)
    boost: 80,
  });
  const dangerBall = makeTestBall({ pos: { x: 0, y: ARENA.ballRadius, z: 10 } });
  const wrongInput = computeBotInput(wrongSideBot, dangerBall, pads, 'estrella', false, [wrongSideBot]);
  assert.equal(wrongInput.boostHeld, false);
  assert.ok(Math.abs(wrongInput.steer) > 0.25, `Expected lateral bypass steer away from own goal, got ${wrongInput.steer}`);

  // 2. In 2v2/3v3, trailing defender bot stays back to protect goal rather than double-committing
  const frontAttacker = makeTestCar({
    id: 'blue_front',
    team: 'blue',
    isPlayer: false,
    pos: { x: 0, y: ARENA.carHalfHeight, z: 22 },
    quat: quatFromYaw(0),
  });
  const backDefender = makeTestCar({
    id: 'blue_back',
    team: 'blue',
    isPlayer: false,
    pos: { x: 4, y: ARENA.carHalfHeight, z: -72 },
    quat: quatFromYaw(0),
  });
  const midBall = makeTestBall({ pos: { x: 0, y: ARENA.ballRadius, z: 32 } });
  const defInput = computeBotInput(backDefender, midBall, pads, 'estrella', false, [
    frontAttacker,
    backDefender,
  ]);
  // Defender positioned near own goal stays steady / waits in shadow position without full-throttle double commit
  assert.ok(defInput.throttle < 0.5, `Expected defender to hold shadow position, got throttle=${defInput.throttle}`);

  // 3. Novato drives slower and avoids flips compared to Gran Campeon
  const novatoBot = makeTestCar({
    id: 'novato',
    team: 'orange',
    isPlayer: false,
    pos: { x: 0, y: ARENA.carHalfHeight, z: 10 },
    quat: quatFromYaw(Math.PI),
    boost: 50,
  });
  const closeBall = makeTestBall({ pos: { x: 0, y: ARENA.ballRadius, z: 3 } });
  const novInput = computeBotInput(novatoBot, closeBall, pads, 'novato', false, [novatoBot]);
  const gcInput = computeBotInput(novatoBot, closeBall, pads, 'gran_campeon', false, [novatoBot]);
  assert.ok(novInput.throttle < gcInput.throttle);
  assert.equal(novInput.jumpJustPressed, false);
});

test('airtight stadium bounds: cars and ball can never escape walls, corners, ceiling, or goal edges', () => {
  const events: any[] = [];
  const probes: { x: number; y: number; z: number; vx: number; vy: number; vz: number }[] = [
    { x: 140, y: 12, z: 0, vx: 70, vy: 0, vz: 0 }, // outside side wall
    { x: -120, y: 80, z: -160, vx: -60, vy: 50, vz: -60 }, // outside corner + ceiling
    { x: ARENA.goalHalfW + 1, y: 4, z: ARENA.halfL + 4, vx: 20, vy: 0, vz: 30 }, // outside goal post edge behind end wall
    { x: 0, y: ARENA.goalHeight + 3, z: ARENA.halfL + 3, vx: 0, vy: 15, vz: 25 }, // above crossbar behind end wall
    { x: 0, y: 2, z: ARENA.halfL + ARENA.goalDepth + 8, vx: 0, vy: 0, vz: 50 }, // past back of net
  ];

  for (const p of probes) {
    const pos = { x: p.x, y: p.y, z: p.z };
    const vel = { x: p.vx, y: p.vy, z: p.vz };
    resolveArenaSphereCollision(pos, vel, ARENA.ballRadius, 0.6, false);
    assert.ok(Math.abs(pos.x) <= ARENA.halfW - ARENA.ballRadius + 1e-4, `Escaped X: ${pos.x}`);
    assert.ok(pos.y >= ARENA.ballRadius - 1e-4 && pos.y <= ARENA.height - ARENA.ballRadius + 1e-4, `Escaped Y: ${pos.y}`);
    assert.ok(Math.abs(pos.z) <= ARENA.halfL + ARENA.goalDepth - ARENA.ballRadius + 1e-4, `Escaped Z: ${pos.z}`);
    if (Math.abs(pos.x) >= ARENA.goalHalfW || pos.y >= ARENA.goalHeight) {
      assert.ok(Math.abs(pos.z) <= ARENA.halfL - ARENA.ballRadius + 0.1, `Escaped behind endwall outside goal: ${pos.z}`);
    }
  }

  // Post-car-ball squeeze near corner wall stays strictly inside
  const car = makeTestCar({ pos: { x: ARENA.halfW - 3.5, y: 1.5, z: 0 }, vel: { x: 40, y: 0, z: 0 } });
  const ball = makeTestBall({ pos: { x: ARENA.halfW - 1.9, y: 1.9, z: 0 }, vel: { x: 0, y: 0, z: 0 } });
  resolveCarBallCollision(car, ball, '1v1', events);
  enforceArenaHardBounds(ball.pos, ball.vel, ball.radius, 0.4);
  assert.ok(ball.pos.x <= ARENA.halfW - ball.radius + 1e-4);
});

test('heavier +45% ball gravity, low ceiling/wall rebound, and realistic non-balloon car hits', () => {
  const events: any[] = [];
  // 1. +45% gravity (~32.65 m/s^2) drops airborne ball crisply instead of floating
  const airBall = makeTestBall({ pos: { x: 0, y: 30, z: 0 }, vel: { x: 0, y: 0, z: 0 } });
  for (let i = 0; i < 60; i++) {
    stepBallPhysics(airBall, 1 / 60, '1v1', events);
  }
  assert.ok(airBall.pos.y < 16.5, `Expected heavier gravity drop below 16.5m in 1s, got ${airBall.pos.y}`);

  // 2. Ceiling bounce is low (<= 0.25 restitution), not bouncy
  const ceilBall = makeTestBall({ pos: { x: 0, y: ARENA.height - ARENA.ballRadius + 0.05, z: 0 }, vel: { x: 0, y: 20, z: 0 } });
  resolveArenaSphereCollision(ceilBall.pos, ceilBall.vel, ceilBall.radius, 0.6, false);
  assert.ok(ceilBall.vel.y < 0 && Math.abs(ceilBall.vel.y) <= 5.0, `Expected low ceiling rebound, got ${ceilBall.vel.y}`);

  // 3. Grounded power shot drives strongly forward without skyrocketing vertically like a balloon
  const striker = makeTestCar({
    pos: { x: 0, y: ARENA.carHalfHeight, z: -3.2 },
    vel: { x: 0, y: 0, z: 34 },
    grounded: true,
    isBoosting: true,
  });
  const shotBall = makeTestBall({ pos: { x: 0, y: ARENA.ballRadius, z: 0 } });
  resolveCarBallCollision(striker, shotBall, '1v1', events);
  assert.ok(shotBall.vel.z > 40, `Expected strong forward drive > 40, got ${shotBall.vel.z}`);
  assert.ok(shotBall.vel.y < 12, `Expected realistic controlled loft < 12 m/s, got ${shotBall.vel.y}`);
});

test('Ball Cam clamps vertical pitch on high/overhead balls and stays inside stadium walls', () => {
  // High ball at 62m ceiling almost directly above player near corner wall
  const cornerCarPos = { x: ARENA.halfW - 4, y: 1.5, z: ARENA.halfL - 28 };
  const highBallPos = { x: ARENA.halfW - 6, y: 62, z: ARENA.halfL - 25 };
  const pose = computeSafeBallCamPose(cornerCarPos, highBallPos, { x: 0, y: 0, z: 1 }, 0.5, 1 / 60);

  // Camera strictly inside arena shell and well below ceiling
  const sdf = arenaWallSDF2D(pose.camPos.x, pose.camPos.z);
  assert.ok(sdf.wallDist >= 2.8, `Camera clipped too close/outside wall (${sdf.wallDist})`);
  assert.ok(pose.camPos.y <= ARENA.height - 4.5, `Camera rose too close to ceiling (${pose.camPos.y})`);
  assert.ok(pose.camPos.y <= cornerCarPos.y + 4.2, `Camera floated high above car (${pose.camPos.y})`);

  // Look vertical pitch stays bounded [-21 deg, +35 deg]
  const hDist = Math.hypot(pose.lookTarget.x - pose.camPos.x, pose.lookTarget.z - pose.camPos.z);
  const pitchRad = Math.atan2(pose.lookTarget.y - pose.camPos.y, hDist);
  assert.ok(pitchRad <= 0.62 && pitchRad >= -0.38, `Camera pitch out of safe range: ${pitchRad} rad`);
});

test('Flip Reset grants infinite flip timer and soft wheel touch keeps ball close', () => {
  const car = makeTestCar({
    pos: { x: 0, y: 20, z: 0 },
    vel: { x: 0, y: -6, z: 12 },
    quat: quatFromYaw(0),
    grounded: false,
    hasFlip: false,
    airTimeSinceJump: 3.2,
  });
  // Ball directly underneath the car's 4 wheels
  const ball = makeTestBall({
    pos: { x: 0, y: 17.2, z: 0 },
    vel: { x: 0, y: 2, z: 10 },
  });
  const events: any[] = [];
  const hit = resolveCarBallCollision(car, ball, 'freeplay', events);
  assert.equal(hit, true);
  assert.equal(car.hasFlip, true);
  assert.equal(car.unlimitedFlip, true);
  assert.ok(events.some((e) => e.type === 'flip_reset'), 'Expected flip_reset event');
  // Wheel reset touch does not blast ball away
  assert.ok(Math.abs(ball.vel.y) < 12, `Expected gentle wheel touch, got vel.y=${ball.vel.y}`);

  // Even 2.5 seconds later (> 1.5s standard flip expiry), saved flip can still execute!
  car.airTimeSinceJump = 2.5;
  car.pos.y = 14;
  stepCarPhysics(
    car,
    {
      throttle: 1,
      steer: 0,
      pitch: 1,
      yaw: 0,
      roll: 0,
      jumpHeld: true,
      jumpJustPressed: true,
      boostHeld: false,
      driftHeld: false,
    },
    1 / 60,
    'freeplay',
    events,
  );
  assert.equal(car.hasFlip, false);
  assert.ok(car.flipTimer > 0.3, 'Expected saved Flip Reset flip to fire past 1.5s limit');
});

test('Ceiling Shot preserves infinite flip during entire fall without jumping', () => {
  const invertedQuat = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI);
  const car = makeTestCar({
    pos: { x: 0, y: ARENA.height - ARENA.carHalfHeight - 0.05, z: 0 },
    vel: { x: 0, y: 0, z: 18 },
    quat: invertedQuat,
    grounded: true,
    surfaceNormal: { x: 0, y: -1, z: 0 },
    hasFlip: true,
  });
  const events: any[] = [];
  // Drop away from ceiling without pressing jump
  car.pos.y = ARENA.height - ARENA.carHalfHeight - 2.0;
  car.vel.y = -6;
  stepCarPhysics(
    car,
    {
      throttle: 0,
      steer: 0,
      pitch: 0,
      yaw: 0,
      roll: 0,
      jumpHeld: false,
      jumpJustPressed: false,
      boostHeld: false,
      driftHeld: false,
    },
    1 / 60,
    'freeplay',
    events,
  );
  assert.equal(car.grounded, false);
  assert.equal(car.hasFlip, true);
  assert.equal(car.unlimitedFlip, true);

  // Fall for 1.65 seconds (99 frames > 1.5s normal timeout, still airborne at ~12m) and still flip!
  for (let i = 0; i < 99; i++) {
    stepCarPhysics(
      car,
      {
        throttle: 0,
        steer: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        jumpHeld: false,
        jumpJustPressed: false,
        boostHeld: false,
        driftHeld: false,
      },
      1 / 60,
      'freeplay',
      events,
    );
  }
  assert.equal(car.grounded, false);
  assert.equal(car.hasFlip, true);
  assert.equal(car.unlimitedFlip, true);

  stepCarPhysics(
    car,
    {
      throttle: 1,
      steer: 0,
      pitch: 1,
      yaw: 0,
      roll: 0,
      jumpHeld: true,
      jumpJustPressed: true,
      boostHeld: false,
      driftHeld: false,
    },
    1 / 60,
    'freeplay',
    events,
  );
  assert.equal(car.hasFlip, false);
  assert.ok(car.flipTimer > 0.3);
});

test('Air Dribble cushion, Roof Dribble balance, and Musty Flick catapult work smoothly', () => {
  const events: any[] = [];
  // 1. Air Dribble cushion (rebound ~0.25 keeps ball near car nose)
  const airCar = makeTestCar({
    pos: { x: 0, y: 15, z: -2.8 },
    vel: { x: 0, y: 8, z: 20 },
    quat: quatFromYaw(0),
    grounded: false,
  });
  const airBall = makeTestBall({
    pos: { x: 0, y: 15, z: 0 },
    vel: { x: 0, y: 6, z: 12 },
  });
  resolveCarBallCollision(airCar, airBall, 'freeplay', events);
  assert.ok(
    Math.abs(airBall.vel.z - airCar.vel.z) < 7.0,
    `Expected air dribble ball velocity close to car, got ball=${airBall.vel.z}, car=${airCar.vel.z}`,
  );

  // 2. Roof Dribble + Musty Flick catapult
  const dribbler = makeTestCar({
    pos: { x: 0, y: 2.2, z: 0 },
    vel: { x: 0, y: 1.5, z: 22 },
    quat: quatFromYaw(0),
    grounded: false,
    hasFlip: true,
    airTimeSinceJump: 0.35,
  });
  const roofBall = makeTestBall({
    pos: { x: 0, y: 4.5, z: 0.5 },
    vel: { x: 0, y: 1.0, z: 22 },
  });
  stepCarPhysics(
    dribbler,
    {
      throttle: 1,
      steer: 0,
      pitch: -1, // classic Musty backflip scoop!
      yaw: 0,
      roll: 0,
      jumpHeld: true,
      jumpJustPressed: true,
      boostHeld: false,
      driftHeld: false,
    },
    1 / 60,
    'freeplay',
    events,
    true,
    roofBall,
  );
  assert.ok(events.some((e) => e.type === 'musty_flick'), 'Expected musty_flick event');
  assert.ok(roofBall.vel.z > 35 && roofBall.vel.y > 14, `Expected Musty Flick forward+up launch, got (${roofBall.vel.z}, ${roofBall.vel.y})`);
});

test('Pinch against wall launches ball explosively between 170 and 220 km/h', () => {
  const car = makeTestCar({
    pos: { x: ARENA.halfW - ARENA.ballRadius - 2.6, y: 12, z: -2 },
    vel: { x: 35, y: 0, z: 28 },
    quat: quatFromYaw(0.45),
    grounded: false,
  });
  const ball = makeTestBall({
    pos: { x: ARENA.halfW - ARENA.ballRadius - 0.1, y: 12, z: 0 },
    vel: { x: 4, y: 0, z: 4 },
  });
  const events: any[] = [];
  const hit = resolveCarBallCollision(car, ball, 'freeplay', events);
  assert.equal(hit, true);
  assert.ok(events.some((e) => e.type === 'pinch'), 'Expected pinch event');
  const speedKmh = Math.hypot(ball.vel.x, ball.vel.y, ball.vel.z) * 3.6;
  assert.ok(
    speedKmh >= 170 && speedKmh <= 222,
    `Expected Pinch speed in 170-220 km/h range, got ${speedKmh.toFixed(1)} km/h`,
  );
});

test('Wave Dash near ground cancels spin and grants instant horizontal burst', () => {
  const car = makeTestCar({
    pos: { x: 0, y: ARENA.carHalfHeight + 0.55, z: 0 },
    vel: { x: 0, y: -5.5, z: 18 },
    quat: quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.18),
    grounded: false,
    hasFlip: true,
    airTimeSinceJump: 0.25,
  });
  const events: any[] = [];
  stepCarPhysics(
    car,
    {
      throttle: 1,
      steer: 0,
      pitch: 1,
      yaw: 0,
      roll: 0,
      jumpHeld: true,
      jumpJustPressed: true,
      boostHeld: false,
      driftHeld: false,
    },
    1 / 60,
    'freeplay',
    events,
  );
  assert.ok(events.some((e) => e.type === 'wave_dash'), 'Expected wave_dash event');
  assert.equal(car.flipTimer, 0, 'Wave Dash should cancel mid-air flip rotation');
  assert.ok(car.vel.z > 40, `Expected instant Wave Dash forward burst > 40 m/s, got ${car.vel.z}`);
});

test('iPad freestyle assist auto-air-rolls belly toward ball after wall jump and drills compute valid trajectories', () => {
  // 1. Wall-jump auto-air-roll while boosting toward ball
  const wallCar = makeTestCar({
    pos: { x: 60, y: 18, z: 0 },
    vel: { x: -12, y: 8, z: 12 },
    quat: quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI * 0.48), // rotated sideways off wall
    grounded: false,
    fromWallJump: true,
    airTimeSinceJump: 0.25,
    boost: 100,
  });
  const targetBall = makeTestBall({ pos: { x: 20, y: 20, z: 20 } });
  const events: any[] = [];
  const upBefore = rotateVecByQuat({ x: 0, y: 1, z: 0 }, wallCar.quat);
  for (let i = 0; i < 15; i++) {
    stepCarPhysics(
      wallCar,
      {
        throttle: 1,
        steer: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        jumpHeld: false,
        jumpJustPressed: false,
        boostHeld: true,
        driftHeld: false,
      },
      1 / 60,
      'freeplay',
      events,
      true,
      targetBall,
    );
  }
  const upAfter = rotateVecByQuat({ x: 0, y: 1, z: 0 }, wallCar.quat);
  assert.ok(
    Math.hypot(upAfter.x - upBefore.x, upAfter.y - upBefore.y, upAfter.z - upBefore.z) > 0.08,
    'Expected wall-jump boost assist to roll car orientation toward ball',
  );

  // 2. All 4 Free Play Pro Training Drills
  const player = makeTestCar({ pos: { x: 10, y: ARENA.carHalfHeight, z: -20 }, vel: { x: 0, y: 0, z: 15 } });
  const roof = computeFreePlayDrill('roof', player);
  assert.ok(roof.ballPos.y > player.pos.y + ARENA.ballRadius && Math.abs(roof.ballVel.z - 15) < 0.1);

  const wallPass = computeFreePlayDrill('wall_pass', player);
  assert.ok(Math.abs(wallPass.ballVel.x) > 20);

  const highBall = computeFreePlayDrill('high_ball', player);
  assert.ok(highBall.ballVel.y > 20 && highBall.ballPos.y > 8);

  const goalShot = computeFreePlayDrill('goal_shot', player);
  assert.ok(goalShot.ballVel.z < -20);
});
