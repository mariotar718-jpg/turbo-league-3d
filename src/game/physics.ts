import { DifficultyId, GameModeId, TeamColor } from './catalog';

export const ARENA = {
  halfW: 90, // X in [-90, 90] -> 180m wide (1.8x scale)
  halfL: 126, // Z in [-126, 126] -> 252m long (1.8x scale)
  height: 68, // Y in [0, 68] -> 68m tall (1.8x scale)
  cornerChamfer: 36, // 45-degree corner chamfer cut (1.8x)
  cornerFillet: 14.4, // horizontal fillet radius smoothing 45° corner transitions (1.8x)
  coveRadius: 11.7, // concave quarter-cylinder floor-wall & wall-ceiling radius (1.8x)
  goalHalfW: 15.7, // +35% wider goals (31.4m wide)
  goalHeight: 11.1, // +35% taller goals (11.1m tall)
  goalDepth: 14.2, // scaled deep goal pocket
  ballRadius: 1.9, // kept at current ball size per spec
  carRadius: 1.75, // kept at current car size per spec
  carHalfHeight: 0.65,
} as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface ControlInput {
  throttle: number; // -1..1
  steer: number; // -1..1 (right positive, left negative)
  pitch: number; // -1..1 (nose down positive, nose up negative)
  yaw: number; // -1..1
  roll: number; // -1..1
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  boostHeld: boolean;
  driftHeld: boolean; // powerslide + air roll
}

export interface BoostPadState {
  id: number;
  x: number;
  y: number;
  z: number;
  isBig: boolean;
  active: boolean;
  cooldown: number;
}

export interface CarState {
  id: string;
  name: string;
  team: TeamColor;
  isPlayer: boolean;
  bodyId: string;
  decalId: string;
  primaryColor: string;
  secondaryColor: string;
  wheelId: string;
  boostId: string;
  explosionId: string;
  topperId: string;
  pos: Vec3;
  vel: Vec3;
  quat: Quat;
  angVel: Vec3;
  boost: number; // 0..100
  grounded: boolean;
  surfaceNormal: Vec3;
  hasFlip: boolean;
  airTimeSinceJump: number;
  flipTimer: number;
  flipDir: Vec3; // local x/z
  isSupersonic: boolean;
  isBoosting: boolean;
  demolishedTimer: number;
  wheelSpin: number;
  steerAngle: number;
  bodyPitchTilt: number;
  bodyRollTilt: number;
  lastTouchTime: number;
  unlimitedFlip?: boolean;
  fromWallJump?: boolean;
  lastFlipResetTime?: number;
  stats: {
    goals: number;
    shots: number;
    saves: number;
    demos: number;
    score: number;
  };
  aiRole?: 'attacker' | 'defender' | 'mid';
}

export interface BallState {
  pos: Vec3;
  vel: Vec3;
  angVel: Vec3;
  quat: Quat;
  radius: number;
  lastTouchTeam: TeamColor | null;
  lastTouchCarId: string | null;
  lastTouchCarName: string | null;
  hitFlash: number;
}

export interface PhysicsEvent {
  type:
    | 'ball_hit'
    | 'jump'
    | 'flip'
    | 'boost_pad'
    | 'demo'
    | 'goal'
    | 'wall_impact'
    | 'flip_reset'
    | 'pinch'
    | 'wave_dash'
    | 'musty_flick';
  pos: Vec3;
  intensity: number;
  team?: TeamColor;
  carId?: string;
  carName?: string;
  victimName?: string;
  speedKmh?: number;
}

export function v3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function v3Len(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function v3Normalize(a: Vec3): Vec3 {
  const len = v3Len(a);
  if (len < 1e-6) return { x: 0, y: 1, z: 0 };
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

export function v3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function v3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const n = v3Normalize(axis);
  return { x: n.x * s, y: n.y * s, z: n.z * s, w: Math.cos(half) };
}

export function quatMul(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function quatNormalize(q: Quat): Quat {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}

export function rotateVecByQuat(v: Vec3, q: Quat): Vec3 {
  const qx = q.x;
  const qy = q.y;
  const qz = q.z;
  const qw = q.w;
  const ix = qw * v.x + qy * v.z - qz * v.y;
  const iy = qw * v.y + qz * v.x - qx * v.z;
  const iz = qw * v.z + qx * v.y - qy * v.x;
  const iw = -qx * v.x - qy * v.y - qz * v.z;
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

export function quatFromYaw(yaw: number): Quat {
  return quatFromAxisAngle({ x: 0, y: 1, z: 0 }, yaw);
}

function closestPointOnSeg2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { cx: number; cz: number; distSq: number } {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  let t = 0;
  if (lenSq > 1e-8) {
    t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / lenSq));
  }
  const cx = ax + abx * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return { cx, cz, distSq: dx * dx + dz * dz };
}

/**
 * Computes signed inward distance to the rounded-octagon 2D wall perimeter
 * (straight side/end walls + 45-degree chamfered corners with smooth horizontal fillets)
 * and the inward 2D normal.
 */
export function arenaWallSDF2D(
  x: number,
  z: number,
): { wallDist: number; nx: number; nz: number } {
  const { halfW, halfL, cornerChamfer, cornerFillet } = ARENA;
  const sx = x >= 0 ? 1 : -1;
  const sz = z >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const az = Math.abs(z);

  const wCore = halfW - cornerFillet;
  const lCore = halfL - cornerFillet;
  const cCore = halfW + halfL - cornerChamfer - cornerFillet * Math.SQRT2;
  const zCornerCore = cCore - wCore;
  const xCornerCore = cCore - lCore;

  // Inside the inner core octagon (well away from horizontal walls and coves)
  if (ax <= wCore && az <= lCore && ax + az <= cCore) {
    const dSide = halfW - ax;
    const dEnd = halfL - az;
    const dDiag = (halfW + halfL - cornerChamfer - (ax + az)) * Math.SQRT1_2;
    if (dSide <= dEnd && dSide <= dDiag) {
      return { wallDist: dSide, nx: -sx, nz: 0 };
    }
    if (dEnd <= dDiag) {
      return { wallDist: dEnd, nx: 0, nz: -sz };
    }
    return { wallDist: dDiag, nx: -sx * Math.SQRT1_2, nz: -sz * Math.SQRT1_2 };
  }

  // Outside core octagon: exact closest point across the 3 quadrant boundary segments
  const s1 = closestPointOnSeg2D(ax, az, wCore, 0, wCore, zCornerCore);
  const s2 = closestPointOnSeg2D(ax, az, wCore, zCornerCore, xCornerCore, lCore);
  const s3 = closestPointOnSeg2D(ax, az, xCornerCore, lCore, 0, lCore);

  let best = s1;
  if (s2.distSq < best.distSq) best = s2;
  if (s3.distSq < best.distSq) best = s3;

  const dOut = Math.sqrt(best.distSq);
  const wallDist = cornerFillet - dOut;
  if (dOut < 1e-6) {
    return { wallDist, nx: -sx, nz: 0 };
  }
  return {
    wallDist,
    nx: -sx * ((ax - best.cx) / dOut),
    nz: -sz * ((az - best.cz) / dOut),
  };
}

/**
 * Absolute hard containment inside DFH Stadium perimeter, ceiling, floor, 45-degree corners,
 * and goal pockets. Guarantees zero cars or balls can ever pass outside walls into stands.
 */
export function enforceArenaHardBounds(
  pos: Vec3,
  vel: Vec3,
  radius: number,
  bounce = 0.0,
): boolean {
  const { halfW, halfL, height, cornerChamfer, goalHalfW, goalHeight, goalDepth } = ARENA;
  let clamped = false;

  const dampPlane = (nx: number, ny: number, nz: number, pen: number) => {
    if (pen <= 0) return;
    clamped = true;
    pos.x += nx * pen;
    pos.y += ny * pen;
    pos.z += nz * pen;
    const vn = vel.x * nx + vel.y * ny + vel.z * nz;
    if (vn < 0) {
      vel.x -= (1 + bounce) * vn * nx;
      vel.y -= (1 + bounce) * vn * ny;
      vel.z -= (1 + bounce) * vn * nz;
    }
  };

  // Floor & ceiling hard clamp
  dampPlane(0, 1, 0, radius - pos.y);
  dampPlane(0, -1, 0, pos.y + radius - height);

  const inGoalOpening =
    Math.abs(pos.x) <= goalHalfW - radius * 0.2 &&
    pos.y <= goalHeight - radius * 0.2;

  if (Math.abs(pos.z) > halfL - radius && inGoalOpening) {
    // Strictly inside goal pocket: clamp side nets, crossbar top, and back net
    dampPlane(1, 0, 0, -goalHalfW + radius - pos.x);
    dampPlane(-1, 0, 0, pos.x + radius - goalHalfW);
    dampPlane(0, -1, 0, pos.y + radius - goalHeight);
    if (pos.z < 0) {
      dampPlane(0, 0, 1, -(halfL + goalDepth - radius) - pos.z);
    } else {
      dampPlane(0, 0, -1, pos.z - (halfL + goalDepth - radius));
    }
    return clamped;
  }

  // Main arena containment (non-goal regions cannot cross ±halfL)
  dampPlane(1, 0, 0, -halfW + radius - pos.x);
  dampPlane(-1, 0, 0, pos.x + radius - halfW);

  if (!inGoalOpening) {
    dampPlane(0, 0, 1, -halfL + radius - pos.z);
    dampPlane(0, 0, -1, pos.z + radius - halfL);
  }

  // Exact 45-degree corner chamfer plane clamp
  const maxChamfer = halfW + halfL - cornerChamfer - radius * Math.SQRT2;
  const ax = Math.abs(pos.x);
  const az = Math.abs(pos.z);
  if (ax + az > maxChamfer) {
    const pen = (ax + az - maxChamfer) * Math.SQRT1_2;
    const nx = -(pos.x >= 0 ? 1 : -1) * Math.SQRT1_2;
    const nz = -(pos.z >= 0 ? 1 : -1) * Math.SQRT1_2;
    dampPlane(nx, 0, nz, pen);
  }

  // Rounded-octagon wall SDF clamp (never skipped unless strictly inside goal mouth opening)
  if (!inGoalOpening) {
    const wall = arenaWallSDF2D(pos.x, pos.z);
    if (wall.wallDist < radius) {
      dampPlane(wall.nx, 0, wall.nz, radius - wall.wallDist);
    }
  }

  return clamped;
}

/**
 * Computes collision & surface contact against the official DFH Stadium shell:
 * rounded-octagon perimeter (45-degree curved corners), continuous concave quarter-cylinder
 * floor-to-wall and wall-to-ceiling coves, ceiling, and both wide/deep goal pockets.
 */
export function resolveArenaSphereCollision(
  pos: Vec3,
  vel: Vec3,
  radius: number,
  restitution: number,
  isCar = false,
): { collided: boolean; normal: Vec3; impactSpeed: number; nearSurface: boolean } {
  const { halfL, height, coveRadius, goalHalfW, goalHeight, goalDepth } = ARENA;

  let collided = false;
  let nearSurface = false;
  let bestNormal: Vec3 = { x: 0, y: 1, z: 0 };
  let maxImpact = 0;

  const inGoalX = Math.abs(pos.x) < goalHalfW - radius * 0.2;
  const inGoalY = pos.y < goalHeight - radius * 0.2;
  const insideBlueGoalPocket = pos.z < -halfL && inGoalX && inGoalY;
  const insideOrangeGoalPocket = pos.z > halfL && inGoalX && inGoalY;
  const inGoalMouthChannel =
    inGoalX &&
    inGoalY &&
    Math.abs(pos.z) > halfL - coveRadius - radius;

  const applyPlane = (nx: number, ny: number, nz: number, penetration: number) => {
    if (penetration > -0.22) {
      nearSurface = true;
      bestNormal = { x: nx, y: ny, z: nz };
    }
    if (penetration > 0) {
      pos.x += nx * penetration;
      pos.y += ny * penetration;
      pos.z += nz * penetration;
      const vn = vel.x * nx + vel.y * ny + vel.z * nz;
      if (vn < 0) {
        const impact = -vn;
        if (impact > maxImpact) maxImpact = impact;

        let bounce: number;
        if (isCar) {
          bounce = impact < 14 ? 0.04 : restitution;
        } else if (impact < 1.1) {
          bounce = 0.0;
        } else if (ny < -0.55) {
          // Ceiling / upper cove: low vertical rebound so ball falls naturally
          bounce = Math.min(restitution, 0.2);
        } else if (Math.abs(ny) > 0.05 && ny < 0.85) {
          // Curved ramp / cove: minimal normal bounce so ball hugs & climbs the wall
          bounce = 0.14;
        } else if (Math.abs(ny) <= 0.05) {
          // Vertical side/end walls: moderate horizontal rebound, damp vertical float
          bounce = Math.min(restitution, 0.52);
          if (vel.y > 0) vel.y *= 0.86;
        } else {
          // Flat turf floor
          bounce = restitution;
        }

        vel.x -= (1 + bounce) * vn * nx;
        vel.y -= (1 + bounce) * vn * ny;
        vel.z -= (1 + bounce) * vn * nz;
        collided = true;
        bestNormal = { x: nx, y: ny, z: nz };
      }
    }
  };

  // Floor (y >= radius)
  applyPlane(0, 1, 0, radius - pos.y);

  // Ceiling (y <= height - radius)
  applyPlane(0, -1, 0, pos.y + radius - height);

  if (insideBlueGoalPocket) {
    // Inside Blue goal (-Z)
    applyPlane(0, 0, 1, -halfL - goalDepth + radius - pos.z);
    applyPlane(1, 0, 0, -goalHalfW + radius - pos.x);
    applyPlane(-1, 0, 0, pos.x + radius - goalHalfW);
    applyPlane(0, -1, 0, pos.y + radius - goalHeight);
    enforceArenaHardBounds(pos, vel, radius, isCar ? 0.04 : 0.25);
    return { collided, normal: bestNormal, impactSpeed: maxImpact, nearSurface };
  }

  if (insideOrangeGoalPocket) {
    // Inside Orange goal (+Z)
    applyPlane(0, 0, -1, pos.z + radius - (halfL + goalDepth));
    applyPlane(1, 0, 0, -goalHalfW + radius - pos.x);
    applyPlane(-1, 0, 0, pos.x + radius - goalHalfW);
    applyPlane(0, -1, 0, pos.y + radius - goalHeight);
    enforceArenaHardBounds(pos, vel, radius, isCar ? 0.04 : 0.25);
    return { collided, normal: bestNormal, impactSpeed: maxImpact, nearSurface };
  }

  // Goalposts & crossbar collision (cylindrical posts at Z = ±halfL)
  if (Math.abs(pos.z) > halfL - radius - 1.0 && Math.abs(pos.x) <= goalHalfW + radius + 1.0) {
    const sz = pos.z >= 0 ? 1 : -1;
    const gz = sz * halfL;
    const postR = 0.5;
    if (pos.y <= goalHeight + postR) {
      for (const sx of [-1, 1]) {
        const px = sx * goalHalfW;
        const dx = pos.x - px;
        const dz = pos.z - gz;
        const d = Math.hypot(dx, dz);
        const minD = radius + postR;
        if (d > 1e-4 && d < minD) {
          applyPlane(dx / d, 0, dz / d, minD - d);
        }
      }
    }
    if (Math.abs(pos.x) <= goalHalfW + postR) {
      const dy = pos.y - goalHeight;
      const dz = pos.z - gz;
      const d = Math.hypot(dy, dz);
      const minD = radius + postR;
      if (d > 1e-4 && d < minD) {
        applyPlane(0, dy / d, dz / d, minD - d);
      }
    }
  }

  // Unified rounded-octagon wall + continuous floor/ceiling concave coves
  if (!inGoalMouthChannel) {
    const wall = arenaWallSDF2D(pos.x, pos.z);
    const rCove = coveRadius;

    if (pos.y < rCove && wall.wallDist < rCove) {
      const u = rCove - wall.wallDist;
      const v = rCove - pos.y;
      const d = Math.hypot(u, v);
      if (d > 1e-4 && d > rCove - radius - 0.25) {
        const uw = u / d;
        const vw = v / d;
        applyPlane(uw * wall.nx, vw, uw * wall.nz, d - (rCove - radius));
      }
    } else if (pos.y > height - rCove && wall.wallDist < rCove) {
      const u = rCove - wall.wallDist;
      const v = pos.y - (height - rCove);
      const d = Math.hypot(u, v);
      if (d > 1e-4 && d > rCove - radius - 0.25) {
        const uw = u / d;
        const vw = -v / d;
        applyPlane(uw * wall.nx, vw, uw * wall.nz, d - (rCove - radius));
      }
    } else if (wall.wallDist < radius + 0.25) {
      applyPlane(wall.nx, 0, wall.nz, radius - wall.wallDist);
    }
  }

  // Absolute safety hard clamp so nothing ever leaves the stadium shell
  if (enforceArenaHardBounds(pos, vel, radius, isCar ? 0.04 : 0.22)) {
    collided = true;
  }

  return { collided, normal: bestNormal, impactSpeed: maxImpact, nearSurface };
}

export function checkGoalScored(ball: BallState): TeamColor | null {
  if (Math.abs(ball.pos.x) > ARENA.goalHalfW) return null;
  if (ball.pos.y > ARENA.goalHeight) return null;
  // Crossed completely into Blue goal (-Z) -> Orange scores!
  if (ball.pos.z < -(ARENA.halfL + ball.radius * 0.65)) return 'orange';
  // Crossed completely into Orange goal (+Z) -> Blue scores!
  if (ball.pos.z > ARENA.halfL + ball.radius * 0.65) return 'blue';
  return null;
}

export function createOfficialBoostPads(): BoostPadState[] {
  const pads: BoostPadState[] = [];
  let id = 0;

  // 6 Orbes Grandes (100% Boost): 4 esquinas (sobre césped plano) + 2 centros laterales (escala 1.8x)
  const bigCoords: [number, number][] = [
    [-64.8, -93.6],
    [64.8, -93.6],
    [-64.8, 93.6],
    [64.8, 93.6],
    [-77.4, 0],
    [77.4, 0],
  ];
  for (const [x, z] of bigCoords) {
    pads.push({ id: id++, x, y: 1.15, z, isBig: true, active: true, cooldown: 0 });
  }

  // 28 Almohadillas Pequeñas (12% Boost) distribuidas por todo el campo ampliado (escala 1.8x)
  const smallCoords: [number, number][] = [
    // Línea central
    [-39.6, 0],
    [-19.8, 0],
    [19.8, 0],
    [39.6, 0],
    // Diamantes lado Azul (-Z)
    [0, -32.4],
    [-28.8, -43.2],
    [28.8, -43.2],
    [-54, -57.6],
    [0, -64.8],
    [54, -57.6],
    [-32.4, -82.8],
    [32.4, -82.8],
    [-16.2, -100.8],
    [16.2, -100.8],
    // Diamantes lado Naranja (+Z)
    [0, 32.4],
    [-28.8, 43.2],
    [28.8, 43.2],
    [-54, 57.6],
    [0, 64.8],
    [54, 57.6],
    [-32.4, 82.8],
    [32.4, 82.8],
    [-16.2, 100.8],
    [16.2, 100.8],
    // Laterales intermedios
    [-61.2, -21.6],
    [61.2, -21.6],
    [-61.2, 21.6],
    [61.2, 21.6],
  ];
  for (const [x, z] of smallCoords) {
    pads.push({ id: id++, x, y: 0.45, z, isBig: false, active: true, cooldown: 0 });
  }

  return pads;
}

export function getKickoffSpawns(
  team: TeamColor,
  count: number,
): { pos: Vec3; yaw: number }[] {
  const dir = team === 'blue' ? 1 : -1;
  // Blue is at -Z facing +Z (yaw = 0); Orange is at +Z facing -Z (yaw = PI)
  const yaw = team === 'blue' ? 0 : Math.PI;
  const presets: { x: number; z: number }[] = [
    { x: -30, z: -50 * dir }, // Diagonal izquierda
    { x: 30, z: -50 * dir }, // Diagonal derecha
    { x: 0, z: -86 * dir }, // Portero central
    { x: -12, z: -66 * dir },
    { x: 12, z: -66 * dir },
  ];
  const out: { pos: Vec3; yaw: number }[] = [];
  for (let i = 0; i < count; i++) {
    const p = presets[i % presets.length];
    out.push({ pos: { x: p.x, y: ARENA.carHalfHeight, z: p.z }, yaw });
  }
  return out;
}

export function stepCarPhysics(
  car: CarState,
  input: ControlInput,
  dt: number,
  mode: GameModeId,
  events: PhysicsEvent[],
  infiniteBoost = false,
  ball?: BallState,
): void {
  if (car.demolishedTimer > 0) {
    car.demolishedTimer = Math.max(0, car.demolishedTimer - dt);
    if (car.demolishedTimer === 0) {
      // Respawn in corner of own half with 33% boost
      const zSign = car.team === 'blue' ? -1 : 1;
      const xSign = Math.random() > 0.5 ? 1 : -1;
      car.pos = { x: xSign * 56, y: ARENA.carHalfHeight + 0.2, z: zSign * 96 };
      car.vel = { x: 0, y: 0, z: 0 };
      car.angVel = { x: 0, y: 0, z: 0 };
      car.quat = quatFromYaw(car.team === 'blue' ? 0 : Math.PI);
      car.boost = 33;
      car.isSupersonic = false;
      car.unlimitedFlip = false;
      car.fromWallJump = false;
    }
    return;
  }

  const gravityMag = mode === 'rumble' ? 21 : 32; // RL feels snappy & responsive
  const maxNormalSpeed = 33.3; // ~120 km/h max normal throttle speed (115-125 km/h)
  const maxSupersonicSpeed = 67.0; // ~241 km/h supersonic top speed with Boost/Flips (230-250 km/h)
  const supersonicThreshold = 60.0; // ~216 km/h supersonic threshold

  const forward = rotateVecByQuat({ x: 0, y: 0, z: 1 }, car.quat);
  const right = rotateVecByQuat({ x: 1, y: 0, z: 0 }, car.quat);
  const up = rotateVecByQuat({ x: 0, y: 1, z: 0 }, car.quat);

  const usingBoost = input.boostHeld && (car.boost > 0.2 || infiniteBoost);
  car.isBoosting = usingBoost;
  if (usingBoost && !infiniteBoost) {
    car.boost = Math.max(0, car.boost - 33.3 * dt);
  }

  // Flip timer progression
  const prevFlipTimer = car.flipTimer;
  if (car.flipTimer > 0) {
    car.flipTimer = Math.max(0, car.flipTimer - dt);
  }

  const wasGrounded = car.grounded;
  const prevSurfaceNormal = { ...car.surfaceNormal };

  // Check surface proximity & collision (low bounce 0.04 on cars so landings stick cleanly!)
  const col = resolveArenaSphereCollision(
    car.pos,
    car.vel,
    ARENA.carHalfHeight,
    0.04,
    true,
  );
  car.grounded =
    col.nearSurface &&
    v3Dot(up, col.normal) > 0.35 &&
    v3Dot(car.vel, col.normal) < 4.5;
  car.surfaceNormal = col.normal;

  if (car.grounded) {
    car.hasFlip = true;
    car.unlimitedFlip = false;
    car.fromWallJump = false;
    car.airTimeSinceJump = 0;
    car.flipTimer = 0;
  } else {
    // Ceiling Shot: dropping off the ceiling on all 4 wheels without pressing Jump grants infinite flip time
    if (wasGrounded && prevSurfaceNormal.y < -0.7 && !input.jumpJustPressed) {
      car.hasFlip = true;
      car.unlimitedFlip = true;
    }
    car.airTimeSinceJump += dt;
  }

  // Jump & Dodge / Flip / Wave Dash / Musty Flick
  if (input.jumpJustPressed) {
    const isTurtled = col.nearSurface && v3Dot(up, col.normal) < 0.25;
    if (car.grounded || isTurtled) {
      if (isTurtled) {
        const yaw = Math.atan2(forward.x, forward.z);
        car.quat = quatFromYaw(yaw);
      }
      const jumpImp = 15.5;
      car.vel.x += col.normal.x * jumpImp;
      car.vel.y += col.normal.y * jumpImp;
      car.vel.z += col.normal.z * jumpImp;
      car.pos.x += col.normal.x * 0.15;
      car.pos.y += col.normal.y * 0.15;
      car.pos.z += col.normal.z * 0.15;
      car.grounded = false;
      car.hasFlip = true;
      car.unlimitedFlip = false;
      car.fromWallJump = col.normal.y < 0.55;
      car.airTimeSinceJump = 0;
      events.push({ type: 'jump', pos: { ...car.pos }, intensity: 0.7, carId: car.id });
    } else if (car.hasFlip && (car.airTimeSinceJump < 1.5 || Boolean(car.unlimitedFlip))) {
      car.hasFlip = false;
      car.unlimitedFlip = false;
      const stickMag = Math.hypot(input.steer, input.pitch);
      if (stickMag < 0.18) {
        // Double jump
        car.vel.y += 14.5;
        events.push({ type: 'jump', pos: { ...car.pos }, intensity: 0.9, carId: car.id });
      } else {
        // Directional Dodge / Flip!
        const horizFwd = v3Normalize({ x: forward.x, y: 0, z: forward.z });
        const horizRight = v3Normalize({ x: right.x, y: 0, z: right.z });
        // Note: pitch > 0 means nose down (forward), steer > 0 means right
        const flipFwdAmount = input.pitch;
        const flipSideAmount = -input.steer;
        const dodgeVec = v3Normalize({
          x: horizFwd.x * flipFwdAmount + horizRight.x * flipSideAmount,
          y: 0,
          z: horizFwd.z * flipFwdAmount + horizRight.z * flipSideAmount,
        });

        // Wave Dash check: executing a flip right before wheels touch floor/wall while falling
        const floorClearance = car.pos.y - ARENA.carHalfHeight;
        const wallSdf = arenaWallSDF2D(car.pos.x, car.pos.z);
        const nearFloorForWaveDash =
          floorClearance < 1.55 && car.vel.y <= 4.5 && car.airTimeSinceJump > 0.08;
        const nearWallForWaveDash =
          wallSdf.wallDist < ARENA.carHalfHeight + 1.55 &&
          car.airTimeSinceJump > 0.08 &&
          (car.vel.x * wallSdf.nx + car.vel.z * wallSdf.nz) <= 4.5;

        if (nearFloorForWaveDash || nearWallForWaveDash) {
          const surfNorm = nearFloorForWaveDash
            ? { x: 0, y: 1, z: 0 }
            : { x: wallSdf.nx, y: 0, z: wallSdf.nz };
          const burstSpeed = 27.5;
          // Project dodge burst tangentially along surface for an explosive Wave Dash slide
          const dotSurf = v3Dot(dodgeVec, surfNorm);
          const tangDodge = v3Normalize({
            x: dodgeVec.x - surfNorm.x * dotSurf,
            y: dodgeVec.y - surfNorm.y * dotSurf,
            z: dodgeVec.z - surfNorm.z * dotSurf,
          });
          car.vel.x += tangDodge.x * burstSpeed;
          car.vel.y = nearFloorForWaveDash
            ? Math.min(car.vel.y, -3.5)
            : car.vel.y + tangDodge.y * burstSpeed;
          car.vel.z += tangDodge.z * burstSpeed;

          // Cancel upside-down flip rotation and snap wheels smoothly toward surface
          car.flipTimer = 0;
          const alignCross = v3Cross(up, surfNorm);
          if (v3Len(alignCross) > 1e-4) {
            const angle = Math.asin(Math.min(1, v3Len(alignCross)));
            car.quat = quatNormalize(quatMul(quatFromAxisAngle(alignCross, angle * 0.85), car.quat));
          }
          events.push({
            type: 'wave_dash',
            pos: { ...car.pos },
            intensity: 1.0,
            team: car.team,
            carId: car.id,
          });
        } else {
          const boostImpulse = 26;
          car.vel.x += dodgeVec.x * boostImpulse;
          car.vel.z += dodgeVec.z * boostImpulse;
          car.vel.y = Math.max(car.vel.y * 0.35, 0) + 3.5;
          car.flipTimer = 0.45;
          car.flipDir = { x: flipFwdAmount, y: 0, z: -flipSideAmount };
          events.push({ type: 'flip', pos: { ...car.pos }, intensity: 1.0, carId: car.id });

          // Musty Flick: scooping the ball from the roof/hood during a pitch flip
          if (ball && Math.abs(input.pitch) >= 0.22) {
            const bdx = ball.pos.x - car.pos.x;
            const bdy = ball.pos.y - car.pos.y;
            const bdz = ball.pos.z - car.pos.z;
            const bDist = Math.hypot(bdx, bdy, bdz);
            const roofRange = ARENA.carRadius + ball.radius + 2.1;
            const horizBallDist = Math.hypot(bdx, bdz);
            if (bDist <= roofRange && bdy >= 0.3 && horizBallDist <= roofRange) {
              const scoopDir = v3Normalize({
                x: horizFwd.x * 0.88 + (bdx / (horizBallDist || 1)) * 0.12,
                y: 0,
                z: horizFwd.z * 0.88 + (bdz / (horizBallDist || 1)) * 0.12,
              });
              const forwardSpeed = Math.max(36, v3Len({ x: car.vel.x, y: 0, z: car.vel.z }) * 0.85 + 24);
              ball.vel.x = scoopDir.x * forwardSpeed;
              ball.vel.y = Math.max(ball.vel.y, 0) * 0.35 + 16.5;
              ball.vel.z = scoopDir.z * forwardSpeed;
              ball.lastTouchTeam = car.team;
              ball.lastTouchCarId = car.id;
              ball.lastTouchCarName = car.name;
              ball.hitFlash = 1;
              events.push({
                type: 'musty_flick',
                pos: { ...ball.pos },
                intensity: 1.0,
                team: car.team,
                carId: car.id,
              });
            }
          }
        }
      }
    }
  }

  // Gravity (aligned partially to wall normal while grounded on walls/ceiling for smooth wall-driving!)
  if (car.grounded && col.normal.y < 0.95) {
    // Magnetic tire adherence on walls/ceiling when moving
    const speed = v3Len(car.vel);
    const stickForce = speed > 6 ? 26 : 12;
    car.vel.x -= col.normal.x * stickForce * dt;
    car.vel.y -= col.normal.y * stickForce * dt;
    car.vel.z -= col.normal.z * stickForce * dt;
    car.vel.y -= gravityMag * 0.35 * dt;
  } else {
    car.vel.y -= gravityMag * dt;
  }

  // Driving on ground / walls
  if (car.grounded) {
    const fwdSpeed = v3Dot(car.vel, forward);
    const rightSpeed = v3Dot(car.vel, right);

    // Throttle acceleration (capped cleanly at ~120 km/h without boost)
    const accelForce = 34;
    const brakeForce = 56;
    if (Math.abs(input.throttle) > 0.05) {
      const opposing = input.throttle * fwdSpeed < -0.5;
      if (opposing) {
        car.vel.x += forward.x * input.throttle * brakeForce * dt;
        car.vel.y += forward.y * input.throttle * brakeForce * dt;
        car.vel.z += forward.z * input.throttle * brakeForce * dt;
      } else {
        const targetNormal = input.throttle * maxNormalSpeed;
        const dir = Math.sign(input.throttle);
        if (dir * fwdSpeed < dir * targetNormal) {
          const delta = Math.min(accelForce * dt, Math.abs(targetNormal - fwdSpeed));
          car.vel.x += forward.x * dir * delta;
          car.vel.y += forward.y * dir * delta;
          car.vel.z += forward.z * dir * delta;
        }
      }
    } else if (!usingBoost) {
      // Rolling resistance
      const drag = Math.exp(-1.4 * dt);
      car.vel.x *= drag;
      car.vel.z *= drag;
    }

    // Gentle aerodynamic bleed back toward normal max speed once boost & flips end
    if (!usingBoost && car.flipTimer === 0 && Math.abs(fwdSpeed) > maxNormalSpeed) {
      const excess = Math.abs(fwdSpeed) - maxNormalSpeed;
      const bleed = excess * (1 - Math.exp(-1.15 * dt));
      const sign = Math.sign(fwdSpeed);
      car.vel.x -= forward.x * sign * bleed;
      car.vel.y -= forward.y * sign * bleed;
      car.vel.z -= forward.z * sign * bleed;
    }

    // Boost thrust (propels powerfully up to ~240 km/h supersonic)
    if (usingBoost) {
      const boostAccel = 66;
      car.vel.x += forward.x * boostAccel * dt;
      car.vel.y += forward.y * boostAccel * dt;
      car.vel.z += forward.z * boostAccel * dt;
    }

    // High lateral tire grip when not powersliding -> tracks joystick direction cleanly with zero ice-skating!
    const latGrip = input.driftHeld ? 2.4 : 26.0;
    const latKill = rightSpeed * (1 - Math.exp(-latGrip * dt));
    car.vel.x -= right.x * latKill;
    car.vel.y -= right.y * latKill;
    car.vel.z -= right.z * latKill;

    // Smooth steering yaw around local surface normal
    const speedFactor = Math.min(1, Math.abs(fwdSpeed) / 9 + 0.25);
    const reverseSign = fwdSpeed < -1.5 ? -1 : 1;
    const turnRate = input.driftHeld ? 3.85 : 2.75;
    const yawDelta = -input.steer * turnRate * speedFactor * reverseSign * dt;
    if (Math.abs(yawDelta) > 1e-5) {
      const qYaw = quatFromAxisAngle(col.normal, yawDelta);
      car.quat = quatNormalize(quatMul(qYaw, car.quat));
    }

    // Strong automatic stability alignment to surface normal (prevents landing tipped sideways)
    const alignCross = v3Cross(up, col.normal);
    const alignLen = v3Len(alignCross);
    if (alignLen > 1e-4) {
      const angle = Math.asin(Math.min(1, alignLen));
      const qAlign = quatFromAxisAngle(alignCross, Math.min(1, 20 * dt) * angle);
      car.quat = quatNormalize(quatMul(qAlign, car.quat));
    }

    car.steerAngle = car.steerAngle * 0.8 + -input.steer * 0.45 * 0.2;
    car.wheelSpin += fwdSpeed * dt * 1.8;

    // Suspension visual tilt
    const targetPitchTilt =
      (usingBoost ? -0.09 : input.throttle > 0.1 ? -0.05 : input.throttle < -0.1 ? 0.06 : 0);
    const targetRollTilt = input.steer * Math.min(1, Math.abs(fwdSpeed) / 25) * 0.09;
    car.bodyPitchTilt += (targetPitchTilt - car.bodyPitchTilt) * Math.min(1, 10 * dt);
    car.bodyRollTilt += (targetRollTilt - car.bodyRollTilt) * Math.min(1, 10 * dt);
  } else {
    // Airborne physics: Pitch, Yaw, Air Roll, Flip spin, Aerial Boost, Wall-Jump Auto-Air-Roll, and Soft Auto-Leveling
    if (prevFlipTimer > 0) {
      const flipStep = Math.min(dt, prevFlipTimer);
      const spinRate = (Math.PI * 2) / 0.45;
      const qSpin = quatFromAxisAngle(
        v3Normalize({ x: car.flipDir.x, y: 0, z: car.flipDir.z }),
        spinRate * flipStep,
      );
      car.quat = quatNormalize(quatMul(car.quat, qSpin));
    } else {
      const pitchSpeed = 2.45;
      const yawSpeed = 3.0;
      const rollSpeed = 4.0;

      // Takeoff grace (0.26s) so accelerating with W during a single jump keeps the car level
      const pitchActive = car.airTimeSinceJump > 0.26 ? input.pitch : 0;
      const pitchDelta = pitchActive * pitchSpeed * dt;
      const qPitch = quatFromAxisAngle(right, pitchDelta);
      car.quat = quatNormalize(quatMul(qPitch, car.quat));

      if (input.driftHeld) {
        // Air roll using steer/left-right
        const rollInput = Math.abs(input.roll) > 0.05 ? input.roll : input.steer;
        const qRoll = quatFromAxisAngle(forward, rollInput * rollSpeed * dt);
        car.quat = quatNormalize(quatMul(qRoll, car.quat));
      } else {
        const qYaw = quatFromAxisAngle(up, -input.steer * yawSpeed * dt);
        car.quat = quatNormalize(quatMul(qYaw, car.quat));
      }

      // iPad Freestyle Assist: after jumping off a wall and holding Boost in midair,
      // softly auto-air-roll the car around its longitudinal axis so the wheels/belly face the ball
      if (
        car.fromWallJump &&
        usingBoost &&
        !input.driftHeld &&
        ball &&
        car.airTimeSinceJump > 0.1
      ) {
        const toBall = v3Normalize({
          x: ball.pos.x - car.pos.x,
          y: ball.pos.y - car.pos.y,
          z: ball.pos.z - car.pos.z,
        });
        // Project desired target direction onto the plane perpendicular to car forward
        const fwdComp = v3Dot(toBall, forward);
        const perp = {
          x: toBall.x - forward.x * fwdComp,
          y: toBall.y - forward.y * fwdComp,
          z: toBall.z - forward.z * fwdComp,
        };
        const perpLen = v3Len(perp);
        if (perpLen > 0.15) {
          const desiredBellyDir = {
            x: perp.x / perpLen,
            y: perp.y / perpLen,
            z: perp.z / perpLen,
          };
          const belly = { x: -up.x, y: -up.y, z: -up.z };
          const rollErrAngle = Math.atan2(
            v3Dot(v3Cross(belly, desiredBellyDir), forward),
            v3Dot(belly, desiredBellyDir),
          );
          const maxRollStep = 3.2 * dt;
          const rollStep = THREE_CLAMP(rollErrAngle * 3.0 * dt, -maxRollStep, maxRollStep);
          if (Math.abs(rollStep) > 1e-5) {
            car.quat = quatNormalize(quatMul(quatFromAxisAngle(forward, rollStep), car.quat));
          }
        }
      } else {
        // Passive soft auto-leveling when descending or low without manual pitch/roll
        const nearLanding = car.pos.y < 7.5 || car.vel.y < -3.0;
        if (
          car.airTimeSinceJump > 0.35 &&
          nearLanding &&
          Math.abs(pitchActive) < 0.08 &&
          !input.driftHeld
        ) {
          const worldUp = { x: 0, y: 1, z: 0 };
          const levelCross = v3Cross(up, worldUp);
          const levelLen = v3Len(levelCross);
          if (levelLen > 1e-4) {
            const angle = Math.asin(Math.min(1, levelLen));
            const qLevel = quatFromAxisAngle(levelCross, Math.min(1, 3.2 * dt) * angle);
            car.quat = quatNormalize(quatMul(qLevel, car.quat));
          }
        }
      }
    }

    if (usingBoost) {
      const airBoost = 52;
      car.vel.x += forward.x * airBoost * dt;
      car.vel.y += forward.y * airBoost * dt;
      car.vel.z += forward.z * airBoost * dt;
    }

    car.wheelSpin += (input.throttle * 18) * dt;
    car.bodyPitchTilt *= 0.9;
    car.bodyRollTilt *= 0.9;
  }

  // Clamp max supersonic speed
  const totalSpeed = v3Len(car.vel);
  if (totalSpeed > maxSupersonicSpeed) {
    const scale = maxSupersonicSpeed / totalSpeed;
    car.vel.x *= scale;
    car.vel.y *= scale;
    car.vel.z *= scale;
  }

  car.isSupersonic = totalSpeed >= supersonicThreshold;

  // Integrate position
  car.pos.x += car.vel.x * dt;
  car.pos.y += car.vel.y * dt;
  car.pos.z += car.vel.z * dt;

  // Final shell resolve
  const postCol = resolveArenaSphereCollision(
    car.pos,
    car.vel,
    ARENA.carHalfHeight,
    0.04,
    true,
  );
  if (postCol.collided && postCol.impactSpeed > 18) {
    events.push({
      type: 'wall_impact',
      pos: { ...car.pos },
      intensity: Math.min(1, postCol.impactSpeed / 40),
      team: car.team,
    });
  }
}

export function stepBallPhysics(
  ball: BallState,
  dt: number,
  mode: GameModeId,
  events: PhysicsEvent[],
): void {
  const gravity = mode === 'rumble' ? 21.0 : 32.65; // +45% heavier football gravity (no floating balloon arc)
  ball.vel.y -= gravity * dt;

  // Aerodynamic air drag + natural turf rolling friction
  const isOnGround = ball.pos.y <= ball.radius + 0.14 && Math.abs(ball.vel.y) < 1.25;
  const airDrag = Math.exp(-0.15 * dt);
  ball.vel.x *= airDrag;
  ball.vel.y *= airDrag;
  ball.vel.z *= airDrag;

  if (isOnGround) {
    const groundFriction = Math.exp(-0.48 * dt);
    ball.vel.x *= groundFriction;
    ball.vel.z *= groundFriction;
    ball.angVel.x *= groundFriction;
    ball.angVel.y *= groundFriction;
    ball.angVel.z *= groundFriction;
  }

  const magnus = v3Cross(ball.angVel, ball.vel);
  ball.vel.x += magnus.x * 0.012 * dt;
  ball.vel.y += magnus.y * 0.012 * dt;
  ball.vel.z += magnus.z * 0.012 * dt;

  const maxBallSpeed = 76;
  const spd = v3Len(ball.vel);
  if (spd > maxBallSpeed) {
    const s = maxBallSpeed / spd;
    ball.vel.x *= s;
    ball.vel.y *= s;
    ball.vel.z *= s;
  }

  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;
  ball.pos.z += ball.vel.z * dt;

  // Spin integration
  const spinSpeed = v3Len(ball.angVel);
  if (spinSpeed > 1e-4) {
    const qSpin = quatFromAxisAngle(ball.angVel, spinSpeed * dt);
    ball.quat = quatNormalize(quatMul(qSpin, ball.quat));
  }

  // Exact 0.60 restitution for weighty, predictable Rocket League bounces
  const col = resolveArenaSphereCollision(ball.pos, ball.vel, ball.radius, 0.6, false);
  if (col.collided) {
    // Update rolling spin on surface contact
    const tangentVel = {
      x: ball.vel.x - col.normal.x * v3Dot(ball.vel, col.normal),
      y: ball.vel.y - col.normal.y * v3Dot(ball.vel, col.normal),
      z: ball.vel.z - col.normal.z * v3Dot(ball.vel, col.normal),
    };
    const rollAxis = v3Cross(col.normal, tangentVel);
    const tSpeed = v3Len(tangentVel);
    if (v3Len(rollAxis) > 1e-4) {
      const nAxis = v3Normalize(rollAxis);
      ball.angVel.x = nAxis.x * (tSpeed / ball.radius);
      ball.angVel.y = nAxis.y * (tSpeed / ball.radius);
      ball.angVel.z = nAxis.z * (tSpeed / ball.radius);
    }

    if (col.impactSpeed > 7) {
      events.push({
        type: 'wall_impact',
        pos: { ...ball.pos },
        intensity: Math.min(1, col.impactSpeed / 45),
        team: ball.lastTouchTeam ?? undefined,
      });
    }
  }

  ball.hitFlash = Math.max(0, ball.hitFlash - dt * 3);
}

export function resolveCarBallCollision(
  car: CarState,
  ball: BallState,
  mode: GameModeId,
  events: PhysicsEvent[],
): boolean {
  if (car.demolishedTimer > 0) return false;
  const dx = ball.pos.x - car.pos.x;
  const dy = ball.pos.y - car.pos.y;
  const dz = ball.pos.z - car.pos.z;
  const dist = Math.hypot(dx, dy, dz);
  const minDist = ARENA.carRadius + ball.radius;
  if (dist >= minDist || dist < 1e-5) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;
  const overlap = minDist - dist;

  ball.pos.x += nx * overlap * 0.85;
  ball.pos.y += ny * overlap * 0.85;
  ball.pos.z += nz * overlap * 0.85;
  car.pos.x -= nx * overlap * 0.15;
  car.pos.y -= ny * overlap * 0.15;
  car.pos.z -= nz * overlap * 0.15;

  const relVx = car.vel.x - ball.vel.x;
  const relVy = car.vel.y - ball.vel.y;
  const relVz = car.vel.z - ball.vel.z;
  const relApproach = relVx * nx + relVy * ny + relVz * nz;

  const carFwd = rotateVecByQuat({ x: 0, y: 0, z: 1 }, car.quat);
  const carUp = rotateVecByQuat({ x: 0, y: 1, z: 0 }, car.quat);
  const isWheelBottomTouch = !car.grounded && v3Dot(carUp, { x: nx, y: ny, z: nz }) < -0.45;

  // 1. Flip Reset check: 4 wheels (car bottom) contact the ball in mid-air -> infinite flip saved!
  if (isWheelBottomTouch) {
    car.hasFlip = true;
    car.unlimitedFlip = true;
    const now = Date.now();
    if (now - (car.lastFlipResetTime ?? 0) > 420) {
      car.lastFlipResetTime = now;
      events.push({
        type: 'flip_reset',
        pos: {
          x: car.pos.x - carUp.x * 0.65,
          y: car.pos.y - carUp.y * 0.65,
          z: car.pos.z - carUp.z * 0.65,
        },
        intensity: 1.0,
        team: car.team,
        carId: car.id,
      });
    }
  }

  // 2. Pinch detection: ball is squeezed within 0.45m of arena wall/floor/ceiling/corner while hit by car
  let pinchSurfNormal: Vec3 | null = null;
  if (ball.pos.y <= ball.radius + 0.45) {
    pinchSurfNormal = { x: 0, y: 1, z: 0 };
  } else if (ball.pos.y >= ARENA.height - ball.radius - 0.45) {
    pinchSurfNormal = { x: 0, y: -1, z: 0 };
  } else {
    const sdf = arenaWallSDF2D(ball.pos.x, ball.pos.z);
    if (sdf.wallDist <= ball.radius + 0.45) {
      pinchSurfNormal = { x: sdf.nx, y: 0, z: sdf.nz };
    }
  }

  const isPinchSqueeze =
    pinchSurfNormal !== null &&
    relApproach > 2.2 &&
    v3Dot({ x: nx, y: ny, z: nz }, pinchSurfNormal) < -0.22;

  if (isPinchSqueeze && pinchSurfNormal) {
    // Launch ball explosively at 170 - 220 km/h (47.5 - 61.0 m/s) parallel to surface!
    const aimVec = v3Len(car.vel) > 4 ? car.vel : carFwd;
    const dotSurf = v3Dot(aimVec, pinchSurfNormal);
    let tang = {
      x: aimVec.x - pinchSurfNormal.x * dotSurf,
      y: aimVec.y - pinchSurfNormal.y * dotSurf + 0.12,
      z: aimVec.z - pinchSurfNormal.z * dotSurf,
    };
    if (v3Len(tang) < 0.1) {
      tang = {
        x: carFwd.x - pinchSurfNormal.x * v3Dot(carFwd, pinchSurfNormal),
        y: carFwd.y - pinchSurfNormal.y * v3Dot(carFwd, pinchSurfNormal) + 0.15,
        z: carFwd.z - pinchSurfNormal.z * v3Dot(carFwd, pinchSurfNormal),
      };
    }
    const tangDir = v3Normalize(tang);
    const pinchSpeed = THREE_CLAMP(
      48.0 + Math.min(12.5, relApproach * 0.35),
      47.5,
      61.0,
    ); // ~171 - 220 km/h
    ball.vel.x = tangDir.x * pinchSpeed + pinchSurfNormal.x * 5.0;
    ball.vel.y = tangDir.y * pinchSpeed + pinchSurfNormal.y * 5.0;
    ball.vel.z = tangDir.z * pinchSpeed + pinchSurfNormal.z * 5.0;
    ball.pos.x += pinchSurfNormal.x * 0.38;
    ball.pos.y += pinchSurfNormal.y * 0.38;
    ball.pos.z += pinchSurfNormal.z * 0.38;

    events.push({
      type: 'pinch',
      pos: { ...ball.pos },
      intensity: 1.0,
      team: car.team,
      carId: car.id,
      speedKmh: Math.round(pinchSpeed * 3.6),
    });
  } else if (relApproach > 0) {
    const isAirDribbleTouch =
      !car.grounded &&
      !isWheelBottomTouch &&
      v3Dot(carFwd, { x: nx, y: ny, z: nz }) > 0.5 &&
      relApproach < 23;
    const isRoofDribbleTouch =
      car.grounded &&
      ny > 0.55 &&
      relApproach < 16 &&
      !car.isBoosting &&
      car.flipTimer === 0;

    if (isWheelBottomTouch) {
      // Cushion wheel reset touch so ball doesn't blast away from follow-up flip!
      const cushionImp = Math.min(6.0, relApproach * 0.25);
      ball.vel.x = ball.vel.x * 0.72 + car.vel.x * 0.28 + nx * cushionImp;
      ball.vel.y = ball.vel.y * 0.72 + car.vel.y * 0.28 + ny * cushionImp;
      ball.vel.z = ball.vel.z * 0.72 + car.vel.z * 0.28 + nz * cushionImp;
    } else if (isAirDribbleTouch) {
      // Air Dribble cushion (rebound = 0.25) keeps ball softly glued near car nose
      const cushionImp = relApproach * 0.25;
      ball.vel.x += nx * cushionImp + (car.vel.x - ball.vel.x) * 0.32;
      ball.vel.y += ny * cushionImp + (car.vel.y - ball.vel.y) * 0.32;
      ball.vel.z += nz * cushionImp + (car.vel.z - ball.vel.z) * 0.32;
      if (relApproach > 3.5) {
        events.push({
          type: 'ball_hit',
          pos: { ...ball.pos },
          intensity: 0.28,
          team: car.team,
          carId: car.id,
        });
      }
    } else if (isRoofDribbleTouch) {
      // Soft roof dribble cradle so the ball balances cleanly on the car roof
      ball.vel.x = ball.vel.x * 0.55 + car.vel.x * 0.45;
      ball.vel.y = Math.max(0, ball.vel.y * 0.15 + relApproach * 0.16);
      ball.vel.z = ball.vel.z * 0.55 + car.vel.z * 0.45;
    } else {
      const isPowerHit = car.isBoosting || car.flipTimer > 0;
      const boostMult = car.isBoosting ? 1.32 : 1.0;
      const flipMult = car.flipTimer > 0 ? 1.55 : 1.0;
      const rumbleMult = mode === 'rumble' ? 1.35 : 1.0;
      const restitutionFactor = isPowerHit ? 1.05 : 0.88;

      // Strictly proportional to real relative closing speed — gentle touches stay close for dribbling!
      const normalImpulse =
        relApproach * restitutionFactor * boostMult * flipMult * rumbleMult;

      // Subtle magnetic shot assist when executing a Flip near the ball:
      // gently biases horizontal launch vector toward opponent goal (only when already hitting forward!)
      let launchNx = nx;
      let launchNz = nz;
      if (car.flipTimer > 0) {
        const enemyGoalZ = car.team === 'blue' ? ARENA.halfL : -ARENA.halfL;
        const toGoalX = 0 - ball.pos.x;
        const toGoalZ = enemyGoalZ - ball.pos.z;
        const gLen = Math.hypot(toGoalX, toGoalZ) || 1;
        const gx = toGoalX / gLen;
        const gz = toGoalZ / gLen;
        const hLen = Math.hypot(nx, nz) || 1;
        const hNx = nx / hLen;
        const hNz = nz / hLen;
        const align = hNx * gx + hNz * gz;
        if (align > 0.15) {
          const assist = 0.24;
          const bx = hNx * (1 - assist) + gx * assist;
          const bz = hNz * (1 - assist) + gz * assist;
          const bLen = Math.hypot(bx, bz) || 1;
          launchNx = (bx / bLen) * hLen;
          launchNz = (bz / bLen) * hLen;
        }
      }

      // Weighty forward impulse without exaggerated vertical balloon launch
      const effNy = car.grounded && Math.abs(ny) < 0.55 ? ny * 0.42 : ny * 0.72;
      const hBase = Math.hypot(launchNx, launchNz);
      const hScale =
        hBase > 1e-4
          ? Math.sqrt(Math.max(0.28, 1 - effNy * effNy)) / hBase
          : 1;

      ball.vel.x += launchNx * hScale * normalImpulse;
      ball.vel.y += effNy * normalImpulse;
      ball.vel.z += launchNz * hScale * normalImpulse;

      // Tangential carry coupling for smooth dribbles & angled cuts
      const relTx = relVx - relApproach * nx;
      const relTy = relVy - relApproach * ny;
      const relTz = relVz - relApproach * nz;
      ball.vel.x += relTx * 0.24;
      ball.vel.y += relTy * 0.15;
      ball.vel.z += relTz * 0.24;

      // Spin from off-center velocity
      const spinCross = v3Cross({ x: nx, y: ny, z: nz }, carFwd);
      const spinScale = Math.min(4.5, relApproach * 0.18);
      ball.angVel.x += spinCross.x * spinScale;
      ball.angVel.y += spinCross.y * spinScale;
      ball.angVel.z += spinCross.z * spinScale;

      if (relApproach > 2.2) {
        events.push({
          type: 'ball_hit',
          pos: { ...ball.pos },
          intensity: Math.min(1, normalImpulse / 42),
          team: car.team,
          carId: car.id,
        });
      }
    }
  }

  // Save detection: rival shot heading to own goal deflected away
  const ownGoalZ = car.team === 'blue' ? -ARENA.halfL : ARENA.halfL;
  if (Math.abs(car.pos.z - ownGoalZ) < 22 && Math.abs(car.pos.x) < 16) {
    car.stats.saves += 1;
    car.stats.score += 50;
  } else {
    car.stats.score += 10;
  }

  ball.lastTouchTeam = car.team;
  ball.lastTouchCarId = car.id;
  ball.lastTouchCarName = car.name;
  ball.hitFlash = 1;
  car.lastTouchTime = Date.now();

  return true;
}

export function resolveCarCarCollisions(
  cars: CarState[],
  events: PhysicsEvent[],
): void {
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.demolishedTimer > 0) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.demolishedTimer > 0) continue;

      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const dz = b.pos.z - a.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      const minDist = ARENA.carRadius * 1.9;
      if (dist >= minDist || dist < 1e-5) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;

      // Supersonic Demolition check between opposing teams
      if (a.team !== b.team) {
        const aFwd = rotateVecByQuat({ x: 0, y: 0, z: 1 }, a.quat);
        const bFwd = rotateVecByQuat({ x: 0, y: 0, z: 1 }, b.quat);
        const aHeadOn = a.isSupersonic && v3Dot(aFwd, { x: nx, y: ny, z: nz }) > 0.55;
        const bHeadOn = b.isSupersonic && v3Dot(bFwd, { x: -nx, y: -ny, z: -nz }) > 0.55;

        if (aHeadOn && !bHeadOn) {
          b.demolishedTimer = 3.0;
          a.stats.demos += 1;
          a.stats.score += 40;
          events.push({
            type: 'demo',
            pos: { ...b.pos },
            intensity: 1,
            team: a.team,
            carId: a.id,
            carName: a.name,
            victimName: b.name,
          });
          continue;
        }
        if (bHeadOn && !aHeadOn) {
          a.demolishedTimer = 3.0;
          b.stats.demos += 1;
          b.stats.score += 40;
          events.push({
            type: 'demo',
            pos: { ...a.pos },
            intensity: 1,
            team: b.team,
            carId: b.id,
            carName: b.name,
            victimName: a.name,
          });
          continue;
        }
      }

      // Elastic bump
      const overlap = (minDist - dist) * 0.5;
      a.pos.x -= nx * overlap;
      a.pos.y -= ny * overlap;
      a.pos.z -= nz * overlap;
      b.pos.x += nx * overlap;
      b.pos.y += ny * overlap;
      b.pos.z += nz * overlap;

      const relVx = a.vel.x - b.vel.x;
      const relVz = a.vel.z - b.vel.z;
      const vn = relVx * nx + relVz * nz;
      if (vn > 0) {
        a.vel.x -= nx * vn * 0.65;
        a.vel.z -= nz * vn * 0.65;
        b.vel.x += nx * vn * 0.65;
        b.vel.z += nz * vn * 0.65;
      }
    }
  }
}

export function stepBoostPads(
  pads: BoostPadState[],
  cars: CarState[],
  dt: number,
  events: PhysicsEvent[],
): void {
  for (const pad of pads) {
    if (!pad.active) {
      pad.cooldown -= dt;
      if (pad.cooldown <= 0) {
        pad.active = true;
        pad.cooldown = 0;
      }
      continue;
    }

    for (const car of cars) {
      if (car.demolishedTimer > 0 || car.boost >= 99.5) continue;
      const dx = car.pos.x - pad.x;
      const dy = car.pos.y - pad.y;
      const dz = car.pos.z - pad.z;
      const pickupR = pad.isBig ? 3.2 : 2.3;
      if (dx * dx + dy * dy + dz * dz <= pickupR * pickupR) {
        car.boost = Math.min(100, car.boost + (pad.isBig ? 100 : 12));
        pad.active = false;
        pad.cooldown = pad.isBig ? 10 : 4;
        events.push({
          type: 'boost_pad',
          pos: { x: pad.x, y: pad.y, z: pad.z },
          intensity: pad.isBig ? 1 : 0.4,
          carId: car.id,
        });
        break;
      }
    }
  }
}

/**
 * Realistic Rocket League Bot AI:
 * - Smooth car-like steering (no instant spinning or wall-stuck loops)
 * - Strict own-goal prevention (wide lateral bypass arc if wrong side of ball)
 * - Dynamic 2v2 / 3v3 roles: Attacker, Mid/Support, and Goalkeeper/Defender
 * - Distinct Novice / Pro / Star / Grand Champion skill behavior
 */
export function computeBotInput(
  bot: CarState,
  ball: BallState,
  pads: BoostPadState[],
  difficulty: DifficultyId,
  kickoffFreeze: boolean,
  allCars: CarState[] = [],
): ControlInput {
  if (kickoffFreeze || bot.demolishedTimer > 0) {
    return {
      throttle: 0,
      steer: 0,
      pitch: 0,
      yaw: 0,
      roll: 0,
      jumpHeld: false,
      jumpJustPressed: false,
      boostHeld: false,
      driftHeld: false,
    };
  }

  const ownGoalZ = bot.team === 'blue' ? -ARENA.halfL : ARENA.halfL;
  const enemyGoalZ = bot.team === 'blue' ? ARENA.halfL : -ARENA.halfL;
  const attackDirZ = bot.team === 'blue' ? 1 : -1;

  const isNovato = difficulty === 'novato';
  const isPro = difficulty === 'profesional';
  const isHigh = difficulty === 'estrella' || difficulty === 'gran_campeon';

  // Trajectory lookahead scales with difficulty (using +45% realistic gravity 32.65)
  const lookAhead = isNovato ? 0.35 : isPro ? 0.55 : difficulty === 'estrella' ? 0.78 : 0.95;
  let predY = ball.pos.y + ball.vel.y * lookAhead - 0.5 * 32.65 * lookAhead * lookAhead;
  if (predY < ball.radius) {
    predY = ball.radius + Math.abs(predY - ball.radius) * 0.6;
  }
  const predBall: Vec3 = {
    x: THREE_CLAMP(ball.pos.x + ball.vel.x * lookAhead, -ARENA.halfW + 14, ARENA.halfW - 14),
    y: THREE_CLAMP(predY, ball.radius, ARENA.height - 6),
    z: THREE_CLAMP(ball.pos.z + ball.vel.z * lookAhead, -ARENA.halfL + 14, ARENA.halfL - 14),
  };

  // Strict own-goal check: am I ahead of the ball facing or pushing toward my own goal?
  const isWrongSideOf = (c: CarState) => {
    const aheadZ =
      c.team === 'blue'
        ? c.pos.z > predBall.z + 1.5
        : c.pos.z < predBall.z - 1.5;
    if (aheadZ) return true;
    const bx = predBall.x - c.pos.x;
    const bz = predBall.z - c.pos.z;
    const gx = 0 - predBall.x;
    const gz = ownGoalZ - predBall.z;
    const bLen = Math.hypot(bx, bz) || 1;
    const gLen = Math.hypot(gx, gz) || 1;
    const toOwnDot = (bx / bLen) * (gx / gLen) + (bz / bLen) * (gz / gLen);
    return toOwnDot > 0.32 && Math.hypot(bx, bz) < 28;
  };

  const botWrongSide = isWrongSideOf(bot);

  // Dynamic Team Role Assignment (Attacker / Support / Defender)
  let assignedRole: 'attacker' | 'mid' | 'defender' = bot.aiRole ?? 'attacker';
  const activeTeammates = allCars.filter(
    (c) => c.team === bot.team && c.demolishedTimer <= 0,
  );
  if (activeTeammates.length >= 2) {
    const scored = activeTeammates
      .map((c) => {
        const d = Math.hypot(predBall.x - c.pos.x, predBall.z - c.pos.z);
        const penalty = isWrongSideOf(c) ? 65 : 0;
        const humanBias = c.isPlayer ? -18 : 0; // Let human player take point if similarly close
        return { id: c.id, cost: d + penalty + humanBias };
      })
      .sort((a, b) => a.cost - b.cost);

    const myRank = scored.findIndex((s) => s.id === bot.id);
    if (myRank === 0) assignedRole = 'attacker';
    else if (myRank === scored.length - 1) assignedRole = 'defender';
    else assignedRole = 'mid';
  } else {
    assignedRole = 'attacker';
  }

  const distToBall = Math.hypot(predBall.x - bot.pos.x, predBall.z - bot.pos.z);
  const ballDangerouslyCloseToOwnGoal = (predBall.z - ownGoalZ) * attackDirZ < 52;

  let targetX = predBall.x;
  let targetZ = predBall.z;
  let wantSlowWait = false;

  if (botWrongSide) {
    // STRICT OWN-GOAL PREVENTION: Never drive straight into ball toward own goal!
    // Take a wide lateral bypass arc around the ball to get back behind it.
    const sideSign = bot.pos.x >= predBall.x ? 1 : -1;
    targetX = THREE_CLAMP(predBall.x + sideSign * 22, -ARENA.halfW + 18, ARENA.halfW - 18);
    targetZ = THREE_CLAMP(
      predBall.z - attackDirZ * 24,
      -ARENA.halfL + 16,
      ARENA.halfL - 16,
    );
  } else if (assignedRole === 'defender' && !ballDangerouslyCloseToOwnGoal) {
    // Goalkeeper / Last-man shadow position protecting own goal
    const inOwnHalf = predBall.z * attackDirZ < 18;
    targetX = THREE_CLAMP(predBall.x * 0.35, -16, 16);
    targetZ = inOwnHalf
      ? ownGoalZ + attackDirZ * 18
      : ownGoalZ + attackDirZ * 56;
    if (Math.hypot(targetX - bot.pos.x, targetZ - bot.pos.z) < 8) {
      wantSlowWait = true;
      // Face the ball while waiting in goal
      targetX = predBall.x;
      targetZ = predBall.z;
    }
  } else if (assignedRole === 'mid' && distToBall > 26) {
    // Support player waits in center/opposite lane for centers & rebounds
    const oppSide = predBall.x >= 0 ? -20 : 20;
    targetX = THREE_CLAMP(oppSide, -ARENA.halfW + 20, ARENA.halfW - 20);
    targetZ = THREE_CLAMP(
      predBall.z - attackDirZ * 32,
      -ARENA.halfL + 22,
      ARENA.halfL - 22,
    );
    if (Math.hypot(targetX - bot.pos.x, targetZ - bot.pos.z) < 9) {
      wantSlowWait = true;
    }
  } else if (bot.boost < 26 && distToBall > 55 && !ballDangerouslyCloseToOwnGoal) {
    // Seek nearest active boost pad when low on boost and far from play
    let bestPad: BoostPadState | null = null;
    let bestDist = Infinity;
    for (const p of pads) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - bot.pos.x, p.z - bot.pos.z) - (p.isBig ? 22 : 0);
      if (d < bestDist) {
        bestDist = d;
        bestPad = p;
      }
    }
    if (bestPad) {
      targetX = bestPad.x;
      targetZ = bestPad.z;
    }
  } else {
    // Attack / Clear: line up cleanly behind ball toward opponent goal
    const toGoalX = 0 - predBall.x;
    const toGoalZ = enemyGoalZ - predBall.z;
    const len = Math.hypot(toGoalX, toGoalZ) || 1;
    const backDist = Math.min(9.5, distToBall * 0.25);
    // Novato misses slightly on shots so beginners enjoy fair matches
    const novatoJitter = isNovato ? Math.sin(bot.pos.z * 0.17 + predBall.x * 0.13) * 4.5 : 0;
    targetX = predBall.x - (toGoalX / len) * backDist + novatoJitter;
    targetZ = predBall.z - (toGoalZ / len) * backDist;
  }

  // Keep waypoint safely inside playable turf away from steep wall traps
  const wallInfo = arenaWallSDF2D(bot.pos.x, bot.pos.z);
  const targetWall = arenaWallSDF2D(targetX, targetZ);
  if (targetWall.wallDist < 12) {
    const push = 12 - targetWall.wallDist;
    targetX += targetWall.nx * push;
    targetZ += targetWall.nz * push;
  }

  const fwd = rotateVecByQuat({ x: 0, y: 0, z: 1 }, bot.quat);
  const right = rotateVecByQuat({ x: 1, y: 0, z: 0 }, bot.quat);

  const toTarget = v3Normalize({
    x: targetX - bot.pos.x,
    y: 0,
    z: targetZ - bot.pos.z,
  });

  const dotFwd = toTarget.x * fwd.x + toTarget.z * fwd.z;
  const dotRight = toTarget.x * right.x + toTarget.z * right.z;
  const distToTarget = Math.hypot(targetX - bot.pos.x, targetZ - bot.pos.z);

  // Smooth limited steering angle like a real vehicle (never instant snap or spin-in-place)
  const angleErr = Math.atan2(dotRight, dotFwd); // -PI..PI
  let steer = THREE_CLAMP(angleErr * 1.35, -0.95, 0.95);
  let throttle = wantSlowWait ? 0.12 : isNovato ? 0.68 : isPro ? 0.92 : 1.0;

  // If target is directly behind at short range, reverse smoothly instead of endless donuts!
  if (dotFwd < -0.35 && distToTarget < 18) {
    throttle = -0.75;
    steer = dotRight >= 0 ? -0.75 : 0.75;
  }

  // Anti wall-stuck recovery: if pressed against wall with low speed, steer inward & reverse
  const speed = v3Len(bot.vel);
  if (wallInfo.wallDist < 4.5 && speed < 3.5 && bot.grounded) {
    const toCenterDotRight =
      (-bot.pos.x * right.x + -bot.pos.z * right.z) /
      (Math.hypot(bot.pos.x, bot.pos.z) || 1);
    throttle = -0.8;
    steer = toCenterDotRight >= 0 ? -0.8 : 0.8;
  }

  const driftHeld = !wantSlowWait && Math.abs(angleErr) > 1.25 && speed > 14 && !isNovato;

  // Boost usage per difficulty
  let boostHeld = false;
  if (!wantSlowWait && !botWrongSide && bot.boost > 8 && throttle > 0.5) {
    if (isNovato) {
      boostHeld = dotFwd > 0.96 && distToTarget > 48 && bot.boost > 65;
    } else if (isPro) {
      boostHeld = dotFwd > 0.88 && distToTarget > 20;
    } else {
      boostHeld = dotFwd > 0.84 && (distToTarget > 14 || distToBall < 14);
    }
  }

  // Jumps, Flips & Aerial Clears per difficulty
  let jumpJustPressed = false;
  let pitch = 0;

  if (!botWrongSide && !wantSlowWait && !isNovato) {
    const canShootFlip =
      isHigh &&
      distToBall < 9.5 &&
      Math.abs(ball.pos.y - bot.pos.y) < 4.2 &&
      dotFwd > 0.86;
    const canAerialJump =
      (isPro || isHigh) &&
      distToBall < 10.5 &&
      predBall.y > 2.4 &&
      predBall.y < (isHigh ? 10.5 : 5.5) &&
      dotFwd > 0.84;

    if (bot.grounded && (canShootFlip || canAerialJump)) {
      jumpJustPressed = true;
    } else if (
      !bot.grounded &&
      bot.hasFlip &&
      bot.airTimeSinceJump > 0.16 &&
      distToBall < 8.5 &&
      dotFwd > 0.72 &&
      (isHigh || predBall.y < 4.0)
    ) {
      jumpJustPressed = true;
      pitch = 1; // Frontflip shot toward enemy goal!
    }
  }

  // Stabilize upright in air
  if (!bot.grounded && !jumpJustPressed) {
    pitch = THREE_CLAMP(-fwd.y * 1.4, -0.8, 0.8);
  }

  return {
    throttle,
    steer,
    pitch,
    yaw: steer,
    roll: 0,
    jumpHeld: jumpJustPressed,
    jumpJustPressed,
    boostHeld,
    driftHeld,
  };
}

function THREE_CLAMP(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Computes an airtight, horizon-stable Ball Cam pose:
 * - Always keeps camera inside stadium perimeter walls, corners, and below ceiling
 * - Stays behind and slightly above the car (dropping slightly when ball is high)
 * - Caps vertical look pitch angle so high/overhead balls never flip the camera or look straight down
 */
export function computeSafeBallCamPose(
  carPos: Vec3,
  ballPos: Vec3,
  prevDir: Vec3,
  speedRatio: number,
  dt: number,
): { camPos: Vec3; lookTarget: Vec3; nextDir: Vec3 } {
  const dx = ballPos.x - carPos.x;
  const dz = ballPos.z - carPos.z;
  const horizDist = Math.hypot(dx, dz);

  let nextDirX = prevDir.x;
  let nextDirZ = prevDir.z;
  if (horizDist > 4.0) {
    const tx = dx / horizDist;
    const tz = dz / horizDist;
    const alpha = 1 - Math.exp(-9 * dt);
    nextDirX = prevDir.x + (tx - prevDir.x) * alpha;
    nextDirZ = prevDir.z + (tz - prevDir.z) * alpha;
  } else if (horizDist > 0.25) {
    const tx = dx / horizDist;
    const tz = dz / horizDist;
    const alpha = 1 - Math.exp(-1.5 * dt);
    nextDirX = prevDir.x + (tx - prevDir.x) * alpha;
    nextDirZ = prevDir.z + (tz - prevDir.z) * alpha;
  }
  const dLen = Math.hypot(nextDirX, nextDirZ) || 1;
  nextDirX /= dLen;
  nextDirZ /= dLen;

  const camDist = 11.2 + speedRatio * 1.8;
  // When ball is high overhead, camera drops slightly behind car so player looks UP cleanly
  const heightDiff = Math.max(0, ballPos.y - carPos.y);
  const camHeight = THREE_CLAMP(3.9 - heightDiff * 0.045, 2.2, 4.1);

  const camPos: Vec3 = {
    x: carPos.x - nextDirX * camDist,
    y: THREE_CLAMP(carPos.y + camHeight, 1.8, ARENA.height - 4.5),
    z: carPos.z - nextDirZ * camDist,
  };

  // Strict stadium containment for camera (zero wall/corner/ceiling clipping into stands)
  const zeroVel: Vec3 = { x: 0, y: 0, z: 0 };
  enforceArenaHardBounds(camPos, zeroVel, 3.2, 0);
  camPos.y = THREE_CLAMP(camPos.y, 1.8, ARENA.height - 4.5);

  const rawTargetX = carPos.x * 0.35 + ballPos.x * 0.65;
  const rawTargetY = carPos.y * 0.45 + ballPos.y * 0.55 + 0.9;
  const rawTargetZ = carPos.z * 0.35 + ballPos.z * 0.65;

  // Enforce comfortable vertical pitch limits [-20 deg, +34 deg] to preserve horizon & control
  const targetHorizDist = Math.max(
    4.5,
    Math.hypot(rawTargetX - camPos.x, rawTargetZ - camPos.z),
  );
  const rawPitch = Math.atan2(rawTargetY - camPos.y, targetHorizDist);
  const clampedPitch = THREE_CLAMP(rawPitch, -0.35, 0.59);
  const clampedTargetY = THREE_CLAMP(
    camPos.y + Math.tan(clampedPitch) * targetHorizDist,
    0.8,
    ARENA.height - 2.0,
  );

  return {
    camPos,
    lookTarget: { x: rawTargetX, y: clampedTargetY, z: rawTargetZ },
    nextDir: { x: nextDirX, y: 0, z: nextDirZ },
  };
}

export type FreePlayDrillId = 'roof' | 'wall_pass' | 'high_ball' | 'goal_shot';

/**
 * Computes ball placement & launch velocity for Free Play pro training drills.
 */
export function computeFreePlayDrill(
  drill: FreePlayDrillId,
  car: CarState,
  ballRadius: number = ARENA.ballRadius,
): { ballPos: Vec3; ballVel: Vec3 } {
  const fwd = rotateVecByQuat({ x: 0, y: 0, z: 1 }, car.quat);
  const up = rotateVecByQuat({ x: 0, y: 1, z: 0 }, car.quat);
  const horizFwd = v3Normalize({ x: fwd.x, y: 0, z: fwd.z });

  if (drill === 'roof') {
    const ballPos: Vec3 = {
      x: car.pos.x + up.x * (ARENA.carHalfHeight + ballRadius + 0.14) + horizFwd.x * 0.25,
      y: car.pos.y + up.y * (ARENA.carHalfHeight + ballRadius + 0.14),
      z: car.pos.z + up.z * (ARENA.carHalfHeight + ballRadius + 0.14) + horizFwd.z * 0.25,
    };
    const ballVel: Vec3 = {
      x: car.vel.x,
      y: Math.max(0, car.vel.y) + 0.8,
      z: car.vel.z,
    };
    return { ballPos, ballVel };
  }

  if (drill === 'wall_pass') {
    const wallSign = car.pos.x >= 0 ? 1 : -1;
    const ballPos: Vec3 = {
      x: THREE_CLAMP(car.pos.x + wallSign * 14, -ARENA.halfW + 12, ARENA.halfW - 12),
      y: ballRadius + 0.2,
      z: THREE_CLAMP(car.pos.z + horizFwd.z * 16, -ARENA.halfL + 22, ARENA.halfL - 22),
    };
    const ballVel: Vec3 = {
      x: wallSign * 31,
      y: 2.5,
      z: horizFwd.z * 11,
    };
    return { ballPos, ballVel };
  }

  if (drill === 'high_ball') {
    const ballPos: Vec3 = {
      x: THREE_CLAMP(car.pos.x * 0.35, -24, 24),
      y: 11.5,
      z: THREE_CLAMP(car.pos.z + horizFwd.z * 26, -ARENA.halfL + 34, ARENA.halfL - 34),
    };
    const ballVel: Vec3 = {
      x: 0,
      y: 28,
      z: 0,
    };
    return { ballPos, ballVel };
  }

  // 'goal_shot': shoots ball toward player's Blue goal (-Z) for Save practice
  const ballPos: Vec3 = {
    x: THREE_CLAMP((car.pos.x >= 0 ? -1 : 1) * 18, -32, 32),
    y: 5.5,
    z: 16,
  };
  const targetGoalX = THREE_CLAMP(-ballPos.x * 0.25, -ARENA.goalHalfW * 0.55, ARENA.goalHalfW * 0.55);
  const targetGoalZ = -ARENA.halfL + 2;
  const dir = v3Normalize({
    x: targetGoalX - ballPos.x,
    y: 4.0 - ballPos.y,
    z: targetGoalZ - ballPos.z,
  });
  const shotSpeed = 44;
  return {
    ballPos,
    ballVel: {
      x: dir.x * shotSpeed,
      y: dir.y * shotSpeed + 14.5,
      z: dir.z * shotSpeed,
    },
  };
}
