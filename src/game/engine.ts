import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  DifficultyId,
  GameModeId,
  TeamColor,
  TeamLoadout,
} from './catalog';
import {
  CarBuildConfig,
  CarMeshHandle,
  ShowcasePedestalHandle,
  StadiumHandle,
  buildBallMesh,
  buildCarMesh,
  buildDFHStadium,
  buildShowcasePedestal,
  createContactShadowTexture,
} from './models';
import {
  ARENA,
  BallState,
  BoostPadState,
  CarState,
  ControlInput,
  FreePlayDrillId,
  PhysicsEvent,
  checkGoalScored,
  computeBotInput,
  computeFreePlayDrill,
  computeSafeBallCamPose,
  createOfficialBoostPads,
  enforceArenaHardBounds,
  getKickoffSpawns,
  quatFromYaw,
  resolveCarBallCollision,
  resolveCarCarCollisions,
  rotateVecByQuat,
  stepBallPhysics,
  stepBoostPads,
  stepCarPhysics,
  v3Dot,
  v3Len,
} from './physics';
import { soundEngine } from './sound';

export type EngineSceneMode = 'menu' | 'garage' | 'crate' | 'match';
export type GarageZoomTarget =
  | 'overview'
  | 'body'
  | 'wheel'
  | 'boost'
  | 'topper';

export type MatchPhase =
  | 'countdown'
  | 'playing'
  | 'goal_slowmo'
  | 'replay'
  | 'podium';

export interface HudSnapshot {
  phase: MatchPhase;
  blueScore: number;
  orangeScore: number;
  timeRemaining: number;
  isOvertime: boolean;
  countdownText: string;
  boost: number;
  speedKmh: number;
  isSupersonic: boolean;
  ballCam: boolean;
  goalBanner: {
    scorerName: string;
    team: TeamColor;
    speedKmh: number;
    explosionId: string;
  } | null;
  demoBanner: string | null;
  mechanicBanner: {
    label: string;
    tone: 'blue' | 'amber' | 'violet' | 'emerald';
  } | null;
  paused: boolean;
  scoreboardRows: {
    id: string;
    name: string;
    team: TeamColor;
    isPlayer: boolean;
    goals: number;
    shots: number;
    saves: number;
    demos: number;
    score: number;
  }[];
  mode: GameModeId;
  winnerTeam: TeamColor | null;
}

export interface MatchConfig {
  mode: GameModeId;
  difficulty: DifficultyId;
  durationSeconds: number;
  playerName: string;
  blueLoadout: TeamLoadout;
  orangeLoadout: TeamLoadout;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  gravity: number;
}

interface ReplayFrame {
  ballPos: [number, number, number];
  ballQuat: [number, number, number, number];
  ballTeam: TeamColor | null;
  cars: {
    id: string;
    pos: [number, number, number];
    quat: [number, number, number, number];
    wheelSpin: number;
    steerAngle: number;
    boosting: boolean;
    demolished: boolean;
  }[];
}

const MAX_PARTICLES = 480;
const REPLAY_MAX_FRAMES = 270; // 4.5s at 60Hz

// Reusable scratch math objects (Zero GC inside frame loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _m4 = new THREE.Matrix4();
const _scaleVec = new THREE.Vector3();
const _color = new THREE.Color();

export class TurboLeagueEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;
  private shadowTex: THREE.Texture;

  private stadium: StadiumHandle;
  private pads: BoostPadState[] = [];
  private ballMesh: ReturnType<typeof buildBallMesh>;
  private pedestal: ShowcasePedestalHandle;
  private showcaseLightGroup: THREE.Group;
  private crateMeshGroup: THREE.Group;
  private crateLightBeam: THREE.Mesh;
  private blackHoleMesh: THREE.Mesh;
  private explosionFlashMesh: THREE.Mesh;

  // Particle instanced ring buffer
  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  // Ambient dust
  private dustPoints: THREE.Points;

  // Scene mode & Showcase Car
  private sceneMode: EngineSceneMode = 'menu';
  private garageTarget: GarageZoomTarget = 'overview';
  private showcaseCarMesh: CarMeshHandle | null = null;
  private showcaseOrbitYaw = 0.65;
  private showcaseOrbitPitch = 0.24;
  private showcaseConfigKey = '';
  private showcaseSmokeTimer = 0;

  // Grounding & wheel particle tracking
  private carPrevGrounded: Map<string, boolean> = new Map();
  private carPrevVy: Map<string, number> = new Map();

  // Match state
  private matchConfig: MatchConfig | null = null;
  private matchCars: CarState[] = [];
  private matchCarMeshes: Map<string, CarMeshHandle> = new Map();
  private ballState: BallState;
  private matchPhase: MatchPhase = 'countdown';
  private blueScore = 0;
  private orangeScore = 0;
  private timeRemaining = 180;
  private isOvertime = false;
  private countdownTimer = 3.2;
  private lastCountdownStep = 4;
  private goalTimer = 0;
  private goalExplosionPos = new THREE.Vector3();
  private goalExplosionId = 'exp_classic';
  private goalExplosionTeam: TeamColor = 'blue';
  private goalBlackHoleDetonated = false;
  private goalBanner: HudSnapshot['goalBanner'] = null;
  private demoBanner: string | null = null;
  private demoBannerTimer = 0;
  private mechanicBanner: HudSnapshot['mechanicBanner'] = null;
  private mechanicBannerTimer = 0;
  private paused = false;
  private infiniteBoost = true;
  private ballCam = true;
  private ballCamDir = new THREE.Vector3(0, 0, 1);
  private ballCamLookTarget = new THREE.Vector3(0, 2, 0);
  private cameraTrauma = 0;
  private wallFlashTimer = 0;

  // Input state
  private playerInput: ControlInput = {
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
  private replayFrames: ReplayFrame[] = [];
  private replayPlaybackIdx = 0;
  private replayTimer = 0;

  // Loop & callbacks
  private frameId = 0;
  private disposed = false;
  private lastTimeMs = 0;
  private elapsed = 0;
  private accumulator = 0;
  private hudSyncTimer = 0;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onMatchFinish: (snap: HudSnapshot) => void;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    onMatchFinish: (snap: HudSnapshot) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onMatchFinish = onMatchFinish;

    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060b16);
    this.scene.fog = new THREE.FogExp2(0x060b16, 0.0022);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      66,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.2,
      750,
    );
    this.camera.position.set(5, 3, 7);

    // 3-point warm/cool lighting rig scaled to 1.8x stadium
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.9);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.85);
    keyLight.position.set(55, 110, 40);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(
      this.isSoftwareGl ? 1024 : 2048,
      this.isSoftwareGl ? 1024 : 2048,
    );
    keyLight.shadow.camera.left = -110;
    keyLight.shadow.camera.right = 110;
    keyLight.shadow.camera.top = 135;
    keyLight.shadow.camera.bottom = -135;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 260;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rimLight.position.set(-72, 48, -90);
    this.scene.add(rimLight);

    // Stadium & Ball
    this.shadowTex = createContactShadowTexture();
    this.pads = createOfficialBoostPads();
    this.stadium = buildDFHStadium(
      this.maxAnisotropy,
      this.pads,
      this.isSoftwareGl,
    );
    this.scene.add(this.stadium.group);

    this.ballMesh = buildBallMesh(this.maxAnisotropy, this.shadowTex);
    this.scene.add(this.ballMesh.root);
    this.scene.add(this.ballMesh.shadowPlane);
    this.scene.add(this.ballMesh.groundRingOuter);
    this.scene.add(this.ballMesh.groundRingInner);

    this.ballState = {
      pos: { x: 0, y: ARENA.ballRadius, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      angVel: { x: 0, y: 0, z: 0 },
      quat: { x: 0, y: 0, z: 0, w: 1 },
      radius: ARENA.ballRadius,
      lastTouchTeam: null,
      lastTouchCarId: null,
      lastTouchCarName: null,
      hitFlash: 0,
    };

    // Hyper-realistic Showcase Pedestal (Carbon fiber + Neon LEDs + Mirror Reflection)
    this.pedestal = buildShowcasePedestal(this.maxAnisotropy, this.isSoftwareGl);
    this.scene.add(this.pedestal.group);

    // Dedicated Studio Lighting Rig for Menu & Garage (Overhead soft SpotLight + Electric Blue & Warm Orange Rim Lights)
    this.showcaseLightGroup = new THREE.Group();
    const overheadSpot = new THREE.SpotLight(
      0xf8fafc,
      92,
      26,
      Math.PI / 4.2,
      0.55,
      1.35,
    );
    overheadSpot.position.set(0.6, 8.2, 1.4);
    overheadSpot.target.position.set(0, 0.9, 0);
    overheadSpot.castShadow = !this.isSoftwareGl;
    overheadSpot.shadow.mapSize.set(1024, 1024);
    overheadSpot.shadow.bias = -0.0004;
    this.showcaseLightGroup.add(overheadSpot);
    this.showcaseLightGroup.add(overheadSpot.target);

    const blueRim = new THREE.PointLight(0x0099ff, 38, 16, 1.35);
    blueRim.position.set(-4.5, 2.2, -1.8);
    this.showcaseLightGroup.add(blueRim);

    const orangeRim = new THREE.PointLight(0xff6600, 38, 16, 1.35);
    orangeRim.position.set(4.5, 2.0, 1.8);
    this.showcaseLightGroup.add(orangeRim);

    this.scene.add(this.showcaseLightGroup);

    // 3D Hexagonal Crate Drop Pod
    this.crateMeshGroup = new THREE.Group();
    const crateCore = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 1.9, 6),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.85,
        roughness: 0.22,
      }),
    );
    this.crateMeshGroup.add(crateCore);
    const crateSeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.34, 1.34, 0.3, 6),
      new THREE.MeshStandardMaterial({
        color: 0xe040fb,
        emissive: 0xe040fb,
        emissiveIntensity: 2.5,
      }),
    );
    this.crateMeshGroup.add(crateSeam);
    this.crateLightBeam = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 12, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xe040fb,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.crateLightBeam.position.y = 5.5;
    this.crateLightBeam.rotation.x = Math.PI;
    this.crateMeshGroup.add(this.crateLightBeam);
    this.crateMeshGroup.position.set(0, 2.2, 0);
    this.crateMeshGroup.visible = false;
    this.scene.add(this.crateMeshGroup);

    // Goal Explosion Special Meshes (Black Hole + Flash Sphere)
    this.blackHoleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0x030014 }),
    );
    const bhRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.35, 12, 36),
      new THREE.MeshBasicMaterial({ color: 0xc084fc }),
    );
    bhRing.rotation.x = Math.PI / 2.6;
    this.blackHoleMesh.add(bhRing);
    this.blackHoleMesh.visible = false;
    this.scene.add(this.blackHoleMesh);

    this.explosionFlashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.explosionFlashMesh.visible = false;
    this.scene.add(this.explosionFlashMesh);

    // Pooled InstancedMesh Particle Ring Buffer
    const pGeo = new THREE.SphereGeometry(0.32, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        r: 1,
        g: 1,
        b: 1,
        gravity: 0,
      });
      _m4.makeTranslation(0, -999, 0);
      this.particleMesh.setMatrixAt(i, _m4);
      this.particleMesh.setColorAt(i, _color.setRGB(1, 1, 1));
    }
    this.scene.add(this.particleMesh);

    // Ambient floating stadium dust particles scaled to 1.8x arena
    const dustCount = 160;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 160;
      dustPos[i * 3 + 1] = Math.random() * 55 + 1;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dustPoints = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xbae6fd,
        size: 0.35,
        transparent: true,
        opacity: 0.45,
      }),
    );
    this.scene.add(this.dustPoints);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.camera.lookAt(-1.5, 1.5, 0);
    this.renderer.render(this.scene, this.camera);
    this.lastTimeMs = performance.now();
    this.startLoop();
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  }

  public setSceneMode(mode: EngineSceneMode): void {
    this.sceneMode = mode;
    if (mode !== 'match') {
      soundEngine.silenceMatchLoops();
      this.clearMatchCarMeshes();
      const showPedestal = mode === 'menu' || mode === 'garage';
      this.pedestal.group.visible = showPedestal;
      this.showcaseLightGroup.visible = showPedestal;
      this.crateMeshGroup.visible = mode === 'crate';
      this.ballMesh.root.visible = mode === 'menu';
      this.ballMesh.shadowPlane.visible = mode === 'menu';
      this.ballMesh.groundRingOuter.visible = false;
      this.ballMesh.groundRingInner.visible = false;
      this.blackHoleMesh.visible = false;
      this.explosionFlashMesh.visible = false;
      if (mode === 'menu') {
        this.ballMesh.root.position.set(-7, ARENA.ballRadius, -9);
        this.ballMesh.shadowPlane.position.set(-7, 0.02, -9);
      }
      if (this.showcaseCarMesh) {
        this.showcaseCarMesh.root.visible = showPedestal;
      }
    } else {
      this.pedestal.group.visible = false;
      this.showcaseLightGroup.visible = false;
      this.crateMeshGroup.visible = false;
      if (this.showcaseCarMesh) this.showcaseCarMesh.root.visible = false;
      this.ballMesh.root.visible = true;
      this.ballMesh.shadowPlane.visible = true;
      this.ballMesh.groundRingOuter.visible = true;
      this.ballMesh.groundRingInner.visible = true;
    }
  }

  public setGarageTarget(target: GarageZoomTarget): void {
    this.garageTarget = target;
  }

  public setCrateAccent(hexColor: string): void {
    const seam = this.crateMeshGroup.children[1] as THREE.Mesh;
    const mat = seam.material as THREE.MeshStandardMaterial;
    mat.color.set(hexColor);
    mat.emissive.set(hexColor);
    (this.crateLightBeam.material as THREE.MeshBasicMaterial).color.set(hexColor);
  }

  public orbitShowcase(deltaX: number, deltaY: number): void {
    this.showcaseOrbitYaw -= deltaX * 0.009;
    this.showcaseOrbitPitch = THREE.MathUtils.clamp(
      this.showcaseOrbitPitch + deltaY * 0.006,
      0.08,
      0.85,
    );
  }

  public updateShowcaseCar(config: CarBuildConfig): void {
    const key = JSON.stringify(config);
    if (key === this.showcaseConfigKey && this.showcaseCarMesh) return;
    this.showcaseConfigKey = key;

    if (this.showcaseCarMesh) {
      this.scene.remove(this.showcaseCarMesh.root);
      this.showcaseCarMesh.dispose();
    }
    this.showcaseCarMesh = buildCarMesh(
      config,
      this.maxAnisotropy,
      this.shadowTex,
    );
    this.showcaseCarMesh.root.position.set(0, 0.98, 0);
    this.showcaseCarMesh.root.visible =
      this.sceneMode === 'menu' || this.sceneMode === 'garage';
    this.scene.add(this.showcaseCarMesh.root);
  }

  public startMatch(config: MatchConfig): void {
    this.matchConfig = config;
    this.setSceneMode('match');
    this.paused = false;
    this.blueScore = 0;
    this.orangeScore = 0;
    this.isOvertime = false;
    this.timeRemaining = config.mode === 'freeplay' ? 0 : config.durationSeconds;
    this.infiniteBoost = config.mode === 'freeplay';
    this.ballCam = true;
    this.goalBanner = null;
    this.demoBanner = null;
    this.mechanicBanner = null;
    this.mechanicBannerTimer = 0;
    this.replayFrames = [];

    this.createMatchCars(config);
    this.resetKickoff(true);
    this.emitHud();
  }

  private clearMatchCarMeshes(): void {
    this.matchCarMeshes.forEach((handle) => {
      this.scene.remove(handle.root);
      handle.dispose();
    });
    this.matchCarMeshes.clear();
    this.matchCars = [];
    this.carPrevGrounded.clear();
    this.carPrevVy.clear();
  }

  private createMatchCars(config: MatchConfig): void {
    this.clearMatchCarMeshes();

    const teamSize =
      config.mode === '1v1'
        ? 1
        : config.mode === '2v2'
          ? 2
          : config.mode === '3v3'
            ? 3
            : config.mode === 'rumble'
              ? 2
              : 1; // freeplay has 1 player car

    const botNames = ['CHIP', 'MERLIN', 'VIPER', 'BOOMER', 'BANDIT', 'HOUND'];
    const botBodies = [
      'body_octane',
      'body_fennec',
      'body_dominus',
      'body_breakout',
      'body_merc',
    ];

    const addCar = (
      id: string,
      name: string,
      team: TeamColor,
      isPlayer: boolean,
      loadout: TeamLoadout,
      role: CarState['aiRole'],
    ) => {
      const car: CarState = {
        id,
        name,
        team,
        isPlayer,
        bodyId: loadout.bodyId,
        decalId: loadout.decalId,
        primaryColor: loadout.primaryColor,
        secondaryColor: loadout.secondaryColor,
        wheelId: loadout.wheelId,
        boostId: loadout.boostId,
        explosionId: loadout.explosionId,
        topperId: loadout.topperId,
        pos: { x: 0, y: ARENA.carHalfHeight, z: 0 },
        vel: { x: 0, y: 0, z: 0 },
        quat: quatFromYaw(team === 'blue' ? 0 : Math.PI),
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
        aiRole: role,
      };
      this.matchCars.push(car);

      const meshHandle = buildCarMesh(
        {
          bodyId: car.bodyId,
          decalId: car.decalId,
          primaryColor: car.primaryColor,
          secondaryColor: car.secondaryColor,
          wheelId: car.wheelId,
          topperId: car.topperId,
        },
        this.maxAnisotropy,
        this.shadowTex,
      );
      this.scene.add(meshHandle.root);
      this.matchCarMeshes.set(id, meshHandle);
    };

    // Player on Blue team
    addCar('player', config.playerName, 'blue', true, config.blueLoadout, 'attacker');

    // Blue bot teammates
    for (let i = 1; i < teamSize; i++) {
      addCar(
        `blue_bot_${i}`,
        botNames[i - 1],
        'blue',
        false,
        {
          ...config.blueLoadout,
          bodyId: botBodies[i % botBodies.length],
          primaryColor: '#0066ff',
          secondaryColor: '#e2e8f0',
          topperId: 'topper_none',
        },
        i === teamSize - 1 ? 'defender' : 'mid',
      );
    }

    // Orange bots (0 in Free Play)
    if (config.mode !== 'freeplay') {
      for (let i = 0; i < teamSize; i++) {
        addCar(
          `orange_bot_${i}`,
          botNames[(i + 2) % botNames.length],
          'orange',
          false,
          {
            ...config.orangeLoadout,
            bodyId: botBodies[(i + 1) % botBodies.length],
            primaryColor: i % 2 === 0 ? '#ff6600' : '#ef4444',
            secondaryColor: '#fde047',
            topperId: i === 0 ? 'topper_horns' : 'topper_none',
          },
          i === teamSize - 1 && teamSize > 1 ? 'defender' : 'attacker',
        );
      }
    }
  }

  private resetKickoff(playCountdown: boolean): void {
    const ballScale = this.matchConfig?.mode === 'rumble' ? 1.6 : 1.0;
    this.ballState.radius = ARENA.ballRadius * ballScale;
    this.ballMesh.sphere.scale.setScalar(ballScale);
    this.ballState.pos = { x: 0, y: this.ballState.radius, z: 0 };
    this.ballState.vel = { x: 0, y: 0, z: 0 };
    this.ballState.angVel = { x: 0, y: 0, z: 0 };
    this.ballState.quat = { x: 0, y: 0, z: 0, w: 1 };
    this.ballState.lastTouchTeam = null;
    this.ballState.lastTouchCarId = null;
    this.ballState.lastTouchCarName = null;
    this.ballState.hitFlash = 0;

    // Reset all boost pads
    for (const p of this.pads) {
      p.active = true;
      p.cooldown = 0;
    }

    const blueCars = this.matchCars.filter((c) => c.team === 'blue');
    const orangeCars = this.matchCars.filter((c) => c.team === 'orange');
    const blueSpawns = getKickoffSpawns('blue', blueCars.length);
    const orangeSpawns = getKickoffSpawns('orange', orangeCars.length);

    blueCars.forEach((c, idx) => {
      c.pos = { ...blueSpawns[idx].pos };
      c.vel = { x: 0, y: 0, z: 0 };
      c.quat = quatFromYaw(blueSpawns[idx].yaw);
      c.boost = 33;
      c.demolishedTimer = 0;
      c.isSupersonic = false;
      c.flipTimer = 0;
      c.unlimitedFlip = false;
      c.fromWallJump = false;
    });

    orangeCars.forEach((c, idx) => {
      c.pos = { ...orangeSpawns[idx].pos };
      c.vel = { x: 0, y: 0, z: 0 };
      c.quat = quatFromYaw(orangeSpawns[idx].yaw);
      c.boost = 33;
      c.demolishedTimer = 0;
      c.isSupersonic = false;
      c.flipTimer = 0;
      c.unlimitedFlip = false;
      c.fromWallJump = false;
    });

    this.blackHoleMesh.visible = false;
    this.explosionFlashMesh.visible = false;
    this.goalBanner = null;
    this.mechanicBanner = null;
    this.mechanicBannerTimer = 0;

    const player = this.matchCars.find((c) => c.isPlayer);
    if (player) {
      const dx = -player.pos.x;
      const dz = -player.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      this.ballCamDir.set(dx / d, 0, dz / d);
      this.ballCamLookTarget.set(
        player.pos.x * 0.35,
        ARENA.ballRadius + 0.9,
        player.pos.z * 0.35,
      );
      this.camera.position.set(
        player.pos.x - this.ballCamDir.x * 11.2,
        player.pos.y + 4.4,
        player.pos.z - this.ballCamDir.z * 11.2,
      );
      this.camera.lookAt(this.ballCamLookTarget);
    }

    if (playCountdown && this.matchConfig?.mode !== 'freeplay') {
      this.matchPhase = 'countdown';
      this.countdownTimer = 3.1;
      this.lastCountdownStep = 4;
    } else {
      this.matchPhase = 'playing';
      this.countdownTimer = 0;
    }
  }

  public setPlayerInput(partial: Partial<ControlInput>): void {
    Object.assign(this.playerInput, partial);
  }

  public triggerJump(): void {
    this.playerInput.jumpJustPressed = true;
    this.playerInput.jumpHeld = true;
  }

  public releaseJump(): void {
    this.playerInput.jumpHeld = false;
  }

  public toggleBallCam(): boolean {
    this.ballCam = !this.ballCam;
    this.emitHud();
    return this.ballCam;
  }

  public toggleInfiniteBoost(): boolean {
    this.infiniteBoost = !this.infiniteBoost;
    return this.infiniteBoost;
  }

  public rightPlayerCar(): void {
    const player = this.matchCars.find((c) => c.isPlayer);
    if (!player) return;
    const forward = rotateVecByQuat({ x: 0, y: 0, z: 1 }, player.quat);
    const yaw = Math.atan2(forward.x, forward.z);
    player.quat = quatFromYaw(yaw);
    player.pos.y = Math.max(player.pos.y, ARENA.carHalfHeight + 0.35);
    player.vel = { x: 0, y: 0, z: 0 };
    player.flipTimer = 0;
  }

  public setPaused(p: boolean): void {
    this.paused = p;
    if (p) soundEngine.silenceMatchLoops();
    this.emitHud();
  }

  public skipReplay(): void {
    if (this.matchPhase === 'replay') {
      this.resetKickoff(true);
      this.emitHud();
    }
  }

  public resetFreePlayBall(): void {
    if (this.matchConfig?.mode === 'freeplay') {
      this.resetKickoff(false);
    }
  }

  public triggerFreePlayDrill(drill: FreePlayDrillId): void {
    if (this.matchConfig?.mode !== 'freeplay') return;
    const player = this.matchCars.find((c) => c.isPlayer);
    if (!player) return;

    const { ballPos, ballVel } = computeFreePlayDrill(
      drill,
      player,
      this.ballState.radius,
    );
    this.ballState.pos = ballPos;
    this.ballState.vel = ballVel;
    this.ballState.angVel = { x: 0, y: 0, z: 0 };
    this.ballState.hitFlash = 1;
    enforceArenaHardBounds(
      this.ballState.pos,
      this.ballState.vel,
      this.ballState.radius,
      0.4,
    );

    // Emit crisp cyan training placement burst around the ball
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.spawnParticle(
        this.ballState.pos.x,
        this.ballState.pos.y,
        this.ballState.pos.z,
        Math.cos(a) * 8,
        (Math.random() - 0.3) * 6,
        Math.sin(a) * 8,
        0.55,
        0.38,
        0.2,
        0.8,
        1.0,
      );
    }
    this.emitHud();
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    maxLife: number,
    r: number,
    g: number,
    b: number,
    gravity = 0,
  ): void {
    const slot = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.size = size;
    slot.life = maxLife;
    slot.maxLife = maxLife;
    slot.r = r;
    slot.g = g;
    slot.b = b;
    slot.gravity = gravity;
  }

  private emitBoostTrail(car: CarState, mesh: CarMeshHandle): void {
    const id = car.boostId;
    const fwd = rotateVecByQuat({ x: 0, y: 0, z: -1 }, car.quat);
    const qThree = _q1.set(car.quat.x, car.quat.y, car.quat.z, car.quat.w);

    for (const ex of mesh.exhaustPositions) {
      _v1.copy(ex).applyQuaternion(qThree);
      const px = car.pos.x + _v1.x;
      const py = car.pos.y + _v1.y;
      const pz = car.pos.z + _v1.z;

      let r = 1;
      let g = 0.55;
      let b = 0.1;
      let size = 0.85;
      if (id === 'boost_blueflame') {
        r = 0.1;
        g = 0.65;
        b = 1.0;
      } else if (id === 'boost_purple') {
        r = 0.75;
        g = 0.25;
        b = 1.0;
      } else if (id === 'boost_stardust') {
        r = 0.75;
        g = 0.95;
        b = 1.0;
        size = 0.7;
      } else if (id === 'boost_plasma') {
        r = 0.2;
        g = 0.95;
        b = 0.45;
      } else if (id === 'boost_rainbow') {
        _color.setHSL((this.elapsed * 0.9) % 1, 1, 0.58);
        r = _color.r;
        g = _color.g;
        b = _color.b;
      } else if (id === 'boost_alphaboost') {
        r = 1.0;
        g = 0.82;
        b = 0.18;
        size = 1.15;
      }

      this.spawnParticle(
        px,
        py,
        pz,
        fwd.x * 12 + (Math.random() - 0.5) * 3,
        fwd.y * 12 + (Math.random() - 0.5) * 3,
        fwd.z * 12 + (Math.random() - 0.5) * 3,
        size,
        0.28 + Math.random() * 0.12,
        r,
        g,
        b,
        0,
      );
    }
  }

  private triggerGoalExplosionBurst(
    pos: THREE.Vector3,
    explosionId: string,
    team: TeamColor,
  ): void {
    const count = explosionId === 'exp_confetti' ? 140 : 100;
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = 14 + Math.random() * 28;
      let vx = Math.sin(phi) * Math.cos(theta) * spd;
      let vy = Math.abs(Math.cos(phi)) * spd + 4;
      let vz = Math.sin(phi) * Math.sin(theta) * spd;
      let r = team === 'blue' ? 0.1 : 1.0;
      let g = team === 'blue' ? 0.6 : 0.45;
      let b = team === 'blue' ? 1.0 : 0.08;
      let size = 1.4;
      let grav = 8;

      if (explosionId === 'exp_dueling_dragons') {
        const isBlue = i % 2 === 0;
        const spiralAngle = (i / count) * Math.PI * 8;
        vx = Math.cos(spiralAngle + (isBlue ? 0 : Math.PI)) * 18;
        vz = Math.sin(spiralAngle + (isBlue ? 0 : Math.PI)) * 18;
        vy = 16 + (i / count) * 22;
        r = isBlue ? 0.05 : 1.0;
        g = isBlue ? 0.65 : 0.42;
        b = isBlue ? 1.0 : 0.05;
        size = 1.6;
      } else if (explosionId === 'exp_nuclear') {
        r = 0.85;
        g = 1.0;
        b = 0.45;
        size = 2.1;
      } else if (explosionId === 'exp_confetti') {
        _color.setHSL(Math.random(), 0.95, 0.6);
        r = _color.r;
        g = _color.g;
        b = _color.b;
        size = 0.95;
        grav = 14;
      } else if (explosionId === 'exp_black_hole') {
        r = 0.68;
        g = 0.3;
        b = 1.0;
        size = 1.5;
      }

      this.spawnParticle(
        pos.x,
        pos.y + 1,
        pos.z,
        vx,
        vy,
        vz,
        size,
        1.1 + Math.random() * 0.6,
        r,
        g,
        b,
        grav,
      );
    }

    this.explosionFlashMesh.position.copy(pos);
    this.explosionFlashMesh.scale.setScalar(1);
    this.explosionFlashMesh.visible = true;
    const fMat = this.explosionFlashMesh.material as THREE.MeshBasicMaterial;
    fMat.color.set(
      explosionId === 'exp_nuclear'
        ? 0xffffff
        : team === 'blue'
          ? 0x00aaff
          : 0xff6600,
    );
    fMat.opacity = 0.85;
  }

  private startLoop(): void {
    const tick = (nowMs: number) => {
      if (this.disposed) return;
      const maxStep = this.isSoftwareGl ? 0.2 : 0.05;
      const rawDt = Math.min(maxStep, Math.max(0.001, (nowMs - this.lastTimeMs) / 1000));
      this.lastTimeMs = nowMs;
      this.elapsed += rawDt;

      this.update(rawDt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(() => {
          if (!this.disposed) this.frameId = requestAnimationFrame(tick);
        });
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };
    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        window.setTimeout(cb, 80);
      }
    };
    window.setTimeout(poll, 5);
  }

  private emitShowcaseExhaustSmoke(dt: number): void {
    if (!this.showcaseCarMesh || !this.showcaseCarMesh.root.visible) return;
    this.showcaseSmokeTimer += dt;
    if (this.showcaseSmokeTimer < 0.11) return;
    this.showcaseSmokeTimer = 0;

    const carRoot = this.showcaseCarMesh.root;
    for (const ex of this.showcaseCarMesh.exhaustPositions) {
      _v1.copy(ex).applyQuaternion(carRoot.quaternion).add(carRoot.position);
      this.spawnParticle(
        _v1.x + (Math.random() - 0.5) * 0.08,
        _v1.y + 0.02,
        _v1.z + (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.35,
        0.75 + Math.random() * 0.45,
        (Math.random() - 0.5) * 0.35,
        0.26 + Math.random() * 0.14,
        0.85 + Math.random() * 0.4,
        0.65,
        0.72,
        0.82,
        -0.4,
      );
    }
  }

  private update(dt: number): void {
    // Animate showcase car decals & Zomba wheels
    if (this.showcaseCarMesh && this.showcaseCarMesh.root.visible) {
      this.showcaseCarMesh.decalHandle.update(this.elapsed);
      if (this.showcaseCarMesh.zombaRings.length > 0) {
        _color.setHSL((this.elapsed * 0.25) % 1, 0.95, 0.55);
        for (const m of this.showcaseCarMesh.zombaRings) {
          m.color.copy(_color);
          m.emissive.copy(_color);
        }
      }
    }

    // Rotate dust subtly
    this.dustPoints.rotation.y += dt * 0.015;

    if (this.sceneMode === 'menu') {
      this.pedestal.group.rotation.y += dt * 0.35;
      if (this.showcaseCarMesh) {
        this.showcaseCarMesh.root.rotation.y = this.pedestal.group.rotation.y;
        this.emitShowcaseExhaustSmoke(dt);
      }
      const camX = Math.sin(this.elapsed * 0.22) * 8.2;
      const camZ = Math.cos(this.elapsed * 0.22) * 8.2;
      _v1.set(camX, 3.6 + Math.sin(this.elapsed * 0.4) * 0.35, camZ);
      this.camera.position.lerp(_v1, 1 - Math.exp(-4 * dt));
      this.camera.lookAt(-1.4, 1.4, 0);
      this.updateParticles(dt);
      return;
    }

    if (this.sceneMode === 'garage') {
      this.pedestal.group.rotation.y += dt * 0.12;
      if (this.showcaseCarMesh) {
        this.showcaseCarMesh.root.rotation.y = this.pedestal.group.rotation.y;
        this.emitShowcaseExhaustSmoke(dt);
      }
      let dist = 6.2;
      let targetY = 1.4;
      let targetX = 0;
      let targetZ = 0;
      if (this.garageTarget === 'wheel') {
        dist = 3.8;
        targetY = 0.85;
        targetX = 0.8;
      } else if (this.garageTarget === 'topper') {
        dist = 4.0;
        targetY = 2.05;
      } else if (this.garageTarget === 'boost') {
        dist = 4.6;
        targetY = 1.2;
        targetZ = -0.6;
      }
      const cx =
        targetX +
        Math.sin(this.showcaseOrbitYaw) * Math.cos(this.showcaseOrbitPitch) * dist;
      const cy = targetY + Math.sin(this.showcaseOrbitPitch) * dist;
      const cz =
        targetZ +
        Math.cos(this.showcaseOrbitYaw) * Math.cos(this.showcaseOrbitPitch) * dist;
      _v1.set(cx, cy, cz);
      this.camera.position.lerp(_v1, 1 - Math.exp(-8 * dt));
      this.camera.lookAt(targetX, targetY, targetZ);
      this.updateParticles(dt);
      return;
    }

    if (this.sceneMode === 'crate') {
      this.crateMeshGroup.rotation.y += dt * 2.4;
      this.crateMeshGroup.position.y = 2.2 + Math.sin(this.elapsed * 6) * 0.12;
      _v1.set(0, 3.1, 6.2);
      this.camera.position.lerp(_v1, 1 - Math.exp(-6 * dt));
      this.camera.lookAt(0, 2.2, 0);
      this.updateParticles(dt);
      return;
    }

    // MATCH MODE
    if (!this.matchConfig || this.paused) {
      this.updateParticles(dt * 0.25);
      return;
    }

    if (this.demoBannerTimer > 0) {
      this.demoBannerTimer -= dt;
      if (this.demoBannerTimer <= 0) {
        this.demoBanner = null;
      }
    }

    if (this.mechanicBannerTimer > 0) {
      this.mechanicBannerTimer -= dt;
      if (this.mechanicBannerTimer <= 0) {
        this.mechanicBanner = null;
      }
    }

    if (this.wallFlashTimer > 0) {
      this.wallFlashTimer = Math.max(0, this.wallFlashTimer - dt * 2.5);
      this.stadium.wallImpactMat.opacity = this.wallFlashTimer * 0.7;
    }

    if (this.explosionFlashMesh.visible) {
      const fMat = this.explosionFlashMesh.material as THREE.MeshBasicMaterial;
      fMat.opacity = Math.max(0, fMat.opacity - dt * 1.1);
      this.explosionFlashMesh.scale.addScalar(dt * 26);
      if (fMat.opacity <= 0.01) this.explosionFlashMesh.visible = false;
    }

    if (this.matchPhase === 'countdown') {
      this.countdownTimer -= dt;
      const step = Math.ceil(this.countdownTimer);
      if (step !== this.lastCountdownStep && step >= 0 && step <= 3) {
        this.lastCountdownStep = step;
        soundEngine.playCountdownBeep(step === 0);
      }
      if (this.countdownTimer <= 0) {
        this.matchPhase = 'playing';
        soundEngine.playCountdownBeep(true);
        this.emitHud();
      }
      this.syncMatchMeshes(dt);
      this.updateMatchCamera(dt);
      this.updateParticles(dt);
      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.08) {
        this.hudSyncTimer = 0;
        this.emitHud();
      }
      return;
    }

    if (this.matchPhase === 'goal_slowmo') {
      this.goalTimer -= dt;
      // Black hole pulls cars for 1.5s then detonates!
      if (this.goalExplosionId === 'exp_black_hole') {
        if (this.goalTimer > 0.7 && !this.goalBlackHoleDetonated) {
          this.blackHoleMesh.visible = true;
          this.blackHoleMesh.position.copy(this.goalExplosionPos);
          this.blackHoleMesh.rotation.y += dt * 4;
          for (const car of this.matchCars) {
            const dx = this.goalExplosionPos.x - car.pos.x;
            const dy = this.goalExplosionPos.y + 1.5 - car.pos.y;
            const dz = this.goalExplosionPos.z - car.pos.z;
            const d = Math.hypot(dx, dy, dz) || 1;
            car.vel.x += (dx / d) * 60 * dt;
            car.vel.y += (dy / d) * 60 * dt;
            car.vel.z += (dz / d) * 60 * dt;
          }
        } else if (!this.goalBlackHoleDetonated) {
          this.goalBlackHoleDetonated = true;
          this.blackHoleMesh.visible = false;
          this.applyExplosionShockwave(this.goalExplosionPos, 55);
          this.triggerGoalExplosionBurst(
            this.goalExplosionPos,
            'exp_black_hole',
            this.goalExplosionTeam,
          );
        }
      }

      const slowDt = dt * 0.25;
      const events: PhysicsEvent[] = [];
      for (const car of this.matchCars) {
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
          slowDt,
          this.matchConfig.mode,
          events,
        );
      }
      this.syncMatchMeshes(dt);
      this.updateMatchCamera(dt);
      this.updateParticles(dt);

      if (this.goalTimer <= 0) {
        if (this.matchConfig.mode === 'freeplay' || this.replayFrames.length < 20) {
          this.resetKickoff(this.matchConfig.mode !== 'freeplay');
        } else {
          this.matchPhase = 'replay';
          this.replayPlaybackIdx = 0;
          this.replayTimer = 0;
        }
        this.emitHud();
      }
      return;
    }

    if (this.matchPhase === 'replay') {
      this.replayTimer += dt;
      const frameRate = 60;
      this.replayPlaybackIdx = Math.floor(this.replayTimer * frameRate);
      if (this.replayPlaybackIdx >= this.replayFrames.length) {
        this.resetKickoff(true);
        this.emitHud();
        return;
      }
      const rf = this.replayFrames[this.replayPlaybackIdx];
      this.ballState.pos = { x: rf.ballPos[0], y: rf.ballPos[1], z: rf.ballPos[2] };
      this.ballState.quat = {
        x: rf.ballQuat[0],
        y: rf.ballQuat[1],
        z: rf.ballQuat[2],
        w: rf.ballQuat[3],
      };
      this.ballState.lastTouchTeam = rf.ballTeam;

      for (const rc of rf.cars) {
        const car = this.matchCars.find((c) => c.id === rc.id);
        if (!car) continue;
        car.pos = { x: rc.pos[0], y: rc.pos[1], z: rc.pos[2] };
        car.quat = { x: rc.quat[0], y: rc.quat[1], z: rc.quat[2], w: rc.quat[3] };
        car.wheelSpin = rc.wheelSpin;
        car.steerAngle = rc.steerAngle;
        car.demolishedTimer = rc.demolished ? 1 : 0;
        const mesh = this.matchCarMeshes.get(car.id);
        if (rc.boosting && mesh) this.emitBoostTrail(car, mesh);
      }
      this.syncMatchMeshes(dt);
      // Dynamic TV broadcast camera tracking the ball during replay across 1.8x stadium
      _v1.set(
        THREE.MathUtils.clamp(this.ballState.pos.x * 0.45 + 34, -82, 82),
        20 + Math.max(0, this.ballState.pos.y * 0.4),
        THREE.MathUtils.clamp(this.ballState.pos.z * 0.55 - 28, -114, 114),
      );
      this.camera.position.lerp(_v1, 1 - Math.exp(-5 * dt));
      this.camera.lookAt(
        this.ballState.pos.x,
        this.ballState.pos.y,
        this.ballState.pos.z,
      );
      this.updateParticles(dt);
      return;
    }

    if (this.matchPhase === 'podium') {
      soundEngine.silenceMatchLoops();
      const winnerTeam: TeamColor =
        this.blueScore >= this.orangeScore ? 'blue' : 'orange';
      const winners = this.matchCars.filter((c) => c.team === winnerTeam);
      winners.forEach((c, idx) => {
        const mesh = this.matchCarMeshes.get(c.id);
        if (!mesh) return;
        const offset = (idx - (winners.length - 1) / 2) * 6;
        const hop = Math.abs(Math.sin(this.elapsed * 4.5 + idx)) * 1.4;
        mesh.root.visible = true;
        mesh.root.position.set(offset, ARENA.carHalfHeight + hop, 0);
        mesh.root.rotation.set(0, 0, Math.sin(this.elapsed * 6 + idx) * 0.15);
        c.pos = { x: offset, y: ARENA.carHalfHeight + hop, z: 0 };
        c.quat = quatFromYaw(0);
        if (Math.random() < 0.35) this.emitBoostTrail(c, mesh);
      });
      this.matchCars
        .filter((c) => c.team !== winnerTeam)
        .forEach((c) => {
          const m = this.matchCarMeshes.get(c.id);
          if (m) m.root.visible = false;
        });
      _v1.set(0, 4.2, 13.5);
      this.camera.position.lerp(_v1, 1 - Math.exp(-4 * dt));
      this.camera.lookAt(0, 1.8, 0);
      this.updateParticles(dt);
      return;
    }

    // PLAYING PHASE: Fixed 60Hz Physics Step
    if (this.matchConfig.mode !== 'freeplay') {
      if (this.isOvertime) {
        this.timeRemaining += dt;
      } else {
        this.timeRemaining = Math.max(0, this.timeRemaining - dt);
        if (this.timeRemaining === 0 && Math.abs(this.ballState.pos.y - this.ballState.radius) < 0.35) {
          // Ball touches ground at 0:00!
          if (this.blueScore === this.orangeScore) {
            this.isOvertime = true;
            this.resetKickoff(true);
            this.emitHud();
            return;
          } else {
            this.finishMatch();
            return;
          }
        }
      }
    }

    this.accumulator += dt;
    const fixedDt = 1 / 60;
    const events: PhysicsEvent[] = [];

    while (this.accumulator >= fixedDt) {
      this.accumulator -= fixedDt;

      // Step cars (Player + AI)
      for (const car of this.matchCars) {
        const input = car.isPlayer
          ? this.playerInput
          : computeBotInput(
              car,
              this.ballState,
              this.pads,
              this.matchConfig.difficulty,
              false,
              this.matchCars,
            );
        stepCarPhysics(
          car,
          input,
          fixedDt,
          this.matchConfig.mode,
          events,
          this.infiniteBoost,
          this.ballState,
        );
        // Consume one-shot jump after first physics substep
        if (car.isPlayer) {
          this.playerInput.jumpJustPressed = false;
        }
      }

      // Ball physics (2 substeps for zero wall tunneling)
      for (let s = 0; s < 2; s++) {
        stepBallPhysics(
          this.ballState,
          fixedDt * 0.5,
          this.matchConfig.mode,
          events,
        );
        for (const car of this.matchCars) {
          if (resolveCarBallCollision(car, this.ballState, this.matchConfig.mode, events)) {
            enforceArenaHardBounds(car.pos, car.vel, ARENA.carHalfHeight, 0.04);
            enforceArenaHardBounds(this.ballState.pos, this.ballState.vel, this.ballState.radius, 0.4);
          }
        }
      }

      resolveCarCarCollisions(this.matchCars, events);
      for (const car of this.matchCars) {
        enforceArenaHardBounds(car.pos, car.vel, ARENA.carHalfHeight, 0.04);
      }
      stepBoostPads(this.pads, this.matchCars, fixedDt, events);

      // Record Replay frame
      this.replayFrames.push({
        ballPos: [this.ballState.pos.x, this.ballState.pos.y, this.ballState.pos.z],
        ballQuat: [
          this.ballState.quat.x,
          this.ballState.quat.y,
          this.ballState.quat.z,
          this.ballState.quat.w,
        ],
        ballTeam: this.ballState.lastTouchTeam,
        cars: this.matchCars.map((c) => ({
          id: c.id,
          pos: [c.pos.x, c.pos.y, c.pos.z],
          quat: [c.quat.x, c.quat.y, c.quat.z, c.quat.w],
          wheelSpin: c.wheelSpin,
          steerAngle: c.steerAngle,
          boosting:
            (c.isPlayer ? this.playerInput.boostHeld : false) &&
            (c.boost > 0.2 || this.infiniteBoost),
          demolished: c.demolishedTimer > 0,
        })),
      });
      if (this.replayFrames.length > REPLAY_MAX_FRAMES) {
        this.replayFrames.shift();
      }

      // Check Goal!
      const scoringTeam = checkGoalScored(this.ballState);
      if (scoringTeam) {
        this.handleGoalScored(scoringTeam);
        break;
      }
    }

    // Handle physics audio & visual events
    this.processPhysicsEvents(events);

    // Emit car boost trails, supersonic sparks, grass/dirt wheel spray & ball high-speed trail
    for (const car of this.matchCars) {
      if (car.demolishedTimer > 0) continue;
      const mesh = this.matchCarMeshes.get(car.id);
      if (!mesh) continue;
      const isBoosting =
        car.isPlayer
          ? this.playerInput.boostHeld && (car.boost > 0.2 || this.infiniteBoost)
          : v3Len(car.vel) > 30 && car.boost > 5;
      if (isBoosting) this.emitBoostTrail(car, mesh);
      if (car.isSupersonic && Math.random() < 0.65) {
        this.spawnParticle(
          car.pos.x + (Math.random() - 0.5) * 1.4,
          car.pos.y - 0.3,
          car.pos.z + (Math.random() - 0.5) * 1.4,
          0,
          1.5,
          0,
          0.45,
          0.22,
          0.85,
          0.5,
          1.0,
        );
      }

      // Grass/dirt wheel spray when drifting/sliding or landing hard on turf
      const wasGrounded = this.carPrevGrounded.get(car.id) ?? true;
      const prevVy = this.carPrevVy.get(car.id) ?? 0;
      const onTurf = car.grounded && car.surfaceNormal.y > 0.7 && car.pos.y < 1.6;
      if (!wasGrounded && onTurf && prevVy < -7) {
        for (let k = 0; k < 7; k++) {
          this.spawnParticle(
            car.pos.x + (Math.random() - 0.5) * 1.8,
            0.15,
            car.pos.z + (Math.random() - 0.5) * 2.2,
            (Math.random() - 0.5) * 7,
            2.5 + Math.random() * 4.5,
            (Math.random() - 0.5) * 7,
            0.35 + Math.random() * 0.22,
            0.42,
            0.22,
            0.55,
            0.22,
            16,
          );
        }
      } else if (onTurf) {
        const right = rotateVecByQuat({ x: 1, y: 0, z: 0 }, car.quat);
        const lateralSlip = Math.abs(v3Dot(car.vel, right));
        const isDrifting =
          (car.isPlayer && this.playerInput.driftHeld && v3Len(car.vel) > 7) ||
          lateralSlip > 5.5;
        if (isDrifting && Math.random() < 0.6) {
          const back = rotateVecByQuat({ x: 0, y: 0, z: -1 }, car.quat);
          for (const sx of [-0.95, 0.95]) {
            const isDirt = Math.random() < 0.45;
            this.spawnParticle(
              car.pos.x + right.x * sx + back.x * 1.15,
              0.15,
              car.pos.z + right.z * sx + back.z * 1.15,
              back.x * 4 + (Math.random() - 0.5) * 3.5,
              2.2 + Math.random() * 2.8,
              back.z * 4 + (Math.random() - 0.5) * 3.5,
              0.32 + Math.random() * 0.18,
              0.36,
              isDirt ? 0.42 : 0.22,
              isDirt ? 0.31 : 0.62,
              isDirt ? 0.18 : 0.24,
              15,
            );
          }
        }
      }
      this.carPrevGrounded.set(car.id, car.grounded);
      this.carPrevVy.set(car.id, car.vel.y);
    }

    const ballSpeed = v3Len(this.ballState.vel);
    const ballSpeedKmh = ballSpeed * 3.6;
    if (ballSpeedKmh > 80) {
      const tColor =
        this.ballState.lastTouchTeam === 'blue'
          ? [0.1, 0.6, 1.0]
          : this.ballState.lastTouchTeam === 'orange'
            ? [1.0, 0.45, 0.08]
            : [0.95, 0.95, 1.0];
      this.spawnParticle(
        this.ballState.pos.x + (Math.random() - 0.5) * 0.8,
        this.ballState.pos.y + (Math.random() - 0.5) * 0.8,
        this.ballState.pos.z + (Math.random() - 0.5) * 0.8,
        0,
        0,
        0,
        1.1,
        0.24,
        tColor[0],
        tColor[1],
        tColor[2],
      );
    }

    // Update continuous Web Audio for player car
    const player = this.matchCars.find((c) => c.isPlayer);
    if (player) {
      soundEngine.updateVehicleAudio({
        active: player.demolishedTimer === 0,
        speedRatio: Math.min(1, v3Len(player.vel) / 67),
        grounded: player.grounded,
        boosting:
          this.playerInput.boostHeld &&
          (player.boost > 0.2 || this.infiniteBoost),
        drifting: this.playerInput.driftHeld,
      });
    }

    this.syncMatchMeshes(dt);
    this.updateMatchCamera(dt);
    this.updateParticles(dt);

    // Throttle React HUD sync to ~12 Hz
    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.08) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private processPhysicsEvents(events: PhysicsEvent[]): void {
    const player = this.matchCars.find((c) => c.isPlayer);
    for (const ev of events) {
      if (ev.type === 'ball_hit') {
        soundEngine.playBallHit(ev.intensity);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + ev.intensity * 0.32);
      } else if (ev.type === 'jump' && ev.carId === player?.id) {
        soundEngine.playJump();
      } else if (ev.type === 'flip' && ev.carId === player?.id) {
        soundEngine.playFlip();
      } else if (ev.type === 'boost_pad' && ev.carId === player?.id) {
        soundEngine.playBoostPickup(ev.intensity > 0.8);
      } else if (ev.type === 'wall_impact') {
        this.wallFlashTimer = 1.0;
        this.stadium.wallImpactMesh.position.set(ev.pos.x, ev.pos.y, ev.pos.z);
        this.stadium.wallImpactMesh.lookAt(0, ev.pos.y, 0);
        this.stadium.wallImpactMat.color.set(
          ev.team === 'orange' ? 0xff6600 : 0x0088ff,
        );
      } else if (ev.type === 'flip_reset') {
        if (ev.carId === player?.id) {
          soundEngine.playFlipReset();
          this.mechanicBanner = { label: '¡FLIP RESET!', tone: 'blue' };
          this.mechanicBannerTimer = 1.45;
          this.emitHud();
        }
        // Electric blue flash underneath the 4 wheels
        for (let i = 0; i < 24; i++) {
          const ang = (i / 24) * Math.PI * 2;
          const spd = 7 + Math.random() * 8;
          this.spawnParticle(
            ev.pos.x,
            ev.pos.y,
            ev.pos.z,
            Math.cos(ang) * spd,
            (Math.random() - 0.5) * 4,
            Math.sin(ang) * spd,
            0.75,
            0.35 + Math.random() * 0.15,
            0.15,
            0.72,
            1.0,
          );
        }
      } else if (ev.type === 'pinch') {
        soundEngine.playPinch();
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.72);
        if (ev.carId === player?.id) {
          this.mechanicBanner = {
            label: ev.speedKmh ? `¡PINCH! ${ev.speedKmh} KM/H` : '¡PINCH!',
            tone: 'amber',
          };
          this.mechanicBannerTimer = 1.6;
          this.emitHud();
        }
        for (let i = 0; i < 34; i++) {
          this.spawnParticle(
            ev.pos.x,
            ev.pos.y,
            ev.pos.z,
            (Math.random() - 0.5) * 34,
            Math.random() * 20 + 2,
            (Math.random() - 0.5) * 34,
            0.72,
            0.45 + Math.random() * 0.25,
            1.0,
            0.68 + Math.random() * 0.3,
            0.15,
            18,
          );
        }
      } else if (ev.type === 'wave_dash') {
        if (ev.carId === player?.id) {
          soundEngine.playWaveDash();
          this.mechanicBanner = { label: '¡WAVE DASH!', tone: 'emerald' };
          this.mechanicBannerTimer = 1.25;
          this.emitHud();
        }
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2;
          this.spawnParticle(
            ev.pos.x,
            Math.max(0.15, ev.pos.y - 0.35),
            ev.pos.z,
            Math.cos(ang) * 11,
            1.8,
            Math.sin(ang) * 11,
            0.55,
            0.32,
            0.2,
            0.95,
            0.85,
          );
        }
      } else if (ev.type === 'musty_flick') {
        if (ev.carId === player?.id) {
          soundEngine.playMustyFlick();
          this.mechanicBanner = { label: '¡MUSTY FLICK!', tone: 'violet' };
          this.mechanicBannerTimer = 1.45;
          this.emitHud();
        }
        for (let i = 0; i < 20; i++) {
          this.spawnParticle(
            ev.pos.x,
            ev.pos.y,
            ev.pos.z,
            (Math.random() - 0.5) * 18,
            Math.random() * 14,
            (Math.random() - 0.5) * 18,
            0.7,
            0.42,
            0.75,
            0.35,
            1.0,
            6,
          );
        }
      } else if (ev.type === 'demo') {
        soundEngine.playDemoBoom();
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.65);
        this.demoBanner = `¡BOOM! DEMOLICIÓN — ${ev.victimName ?? 'RIVAL'}`;
        this.demoBannerTimer = 2.6;
        for (let i = 0; i < 42; i++) {
          this.spawnParticle(
            ev.pos.x,
            ev.pos.y + 0.5,
            ev.pos.z,
            (Math.random() - 0.5) * 28,
            Math.random() * 20 + 4,
            (Math.random() - 0.5) * 28,
            1.4,
            0.75 + Math.random() * 0.35,
            1.0,
            Math.random() * 0.45,
            0.05,
            15,
          );
        }
      }
    }
  }

  private applyExplosionShockwave(origin: THREE.Vector3, strength: number): void {
    for (const car of this.matchCars) {
      const dx = car.pos.x - origin.x;
      const dy = car.pos.y + 1.5 - origin.y;
      const dz = car.pos.z - origin.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const force = strength / Math.max(8, d * 0.35);
      car.vel.x += (dx / d) * force * 24;
      car.vel.y += Math.max(0.35, dy / d) * force * 24;
      car.vel.z += (dz / d) * force * 24;
    }
  }

  private handleGoalScored(scoringTeam: TeamColor): void {
    soundEngine.playGoalExplosion();
    soundEngine.silenceMatchLoops();
    this.cameraTrauma = 1.0;

    if (scoringTeam === 'blue') this.blueScore += 1;
    else this.orangeScore += 1;

    // Attribute goal to last touching player on scoring team or team captain
    let scorer = this.matchCars.find(
      (c) => c.id === this.ballState.lastTouchCarId && c.team === scoringTeam,
    );
    if (!scorer) {
      scorer = this.matchCars.find((c) => c.team === scoringTeam);
    }
    if (scorer) {
      scorer.stats.goals += 1;
      scorer.stats.score += 100;
    }

    const explosionId = scorer?.explosionId ?? 'exp_classic';
    this.goalExplosionId = explosionId;
    this.goalExplosionTeam = scoringTeam;
    this.goalExplosionPos.set(
      this.ballState.pos.x,
      this.ballState.pos.y,
      this.ballState.pos.z,
    );
    this.goalBlackHoleDetonated = false;

    if (explosionId !== 'exp_black_hole') {
      this.applyExplosionShockwave(this.goalExplosionPos, 48);
      this.triggerGoalExplosionBurst(
        this.goalExplosionPos,
        explosionId,
        scoringTeam,
      );
    }

    const speedKmh = Math.round(v3Len(this.ballState.vel) * 3.6);
    this.goalBanner = {
      scorerName: scorer?.name ?? (scoringTeam === 'blue' ? 'AZUL' : 'NARANJA'),
      team: scoringTeam,
      speedKmh,
      explosionId,
    };

    if (this.isOvertime) {
      // Golden goal ends match right after slowmo
      this.matchPhase = 'goal_slowmo';
      this.goalTimer = 2.0;
      window.setTimeout(() => {
        if (!this.disposed && this.sceneMode === 'match') {
          this.finishMatch();
        }
      }, 2100);
    } else {
      this.matchPhase = 'goal_slowmo';
      this.goalTimer = 2.0;
    }

    this.stadium.updateScoreboard(
      this.blueScore,
      this.orangeScore,
      this.timeRemaining,
      this.isOvertime,
    );
    this.emitHud();
  }

  private finishMatch(): void {
    this.matchPhase = 'podium';
    const snap = this.buildHudSnapshot();
    this.emitHud();
    this.onMatchFinish(snap);
  }

  private syncMatchMeshes(dt: number): void {
    // Update stadium scoreboard every ~0.5s
    this.stadium.updateScoreboard(
      this.blueScore,
      this.orangeScore,
      this.timeRemaining,
      this.isOvertime,
    );

    // Ball mesh & ground indicator rings
    this.ballMesh.root.position.set(
      this.ballState.pos.x,
      this.ballState.pos.y,
      this.ballState.pos.z,
    );
    this.ballMesh.sphere.quaternion.set(
      this.ballState.quat.x,
      this.ballState.quat.y,
      this.ballState.quat.z,
      this.ballState.quat.w,
    );
    this.ballMesh.ledMat.emissive.set(
      this.ballState.lastTouchTeam === 'blue'
        ? 0x0088ff
        : this.ballState.lastTouchTeam === 'orange'
          ? 0xff6600
          : 0x94a3b8,
    );
    this.ballMesh.ledMat.emissiveIntensity = 1.4 + this.ballState.hitFlash * 2.0;

    // Ground indicator projected under ball
    const heightRatio = THREE.MathUtils.clamp(
      1 - (this.ballState.pos.y - this.ballState.radius) / 26,
      0.22,
      1,
    );
    this.ballMesh.shadowPlane.position.set(
      this.ballState.pos.x,
      0.025,
      this.ballState.pos.z,
    );
    (this.ballMesh.shadowPlane.material as THREE.MeshBasicMaterial).opacity =
      heightRatio * 0.55;
    this.ballMesh.groundRingOuter.position.set(
      this.ballState.pos.x,
      0.03,
      this.ballState.pos.z,
    );
    this.ballMesh.groundRingOuter.scale.setScalar(heightRatio);
    this.ballMesh.groundRingInner.position.set(
      this.ballState.pos.x,
      0.032,
      this.ballState.pos.z,
    );

    // Boost pad visuals
    for (const pm of this.stadium.boostPadMeshes) {
      const pad = this.pads[pm.padId];
      if (!pad) continue;
      if (pm.orbMesh) {
        pm.orbMesh.visible = pad.active;
        if (pad.active) {
          pm.orbMesh.rotation.y += dt * 2.2;
          pm.orbMesh.position.y = pad.y + Math.sin(this.elapsed * 4 + pad.id) * 0.18;
        }
      }
      pm.ringMat.emissiveIntensity = pad.active ? 1.8 : 0.15;
      pm.ringMat.color.setHex(pad.active ? 0xf59e0b : 0x334155);
    }

    // Car meshes
    for (const car of this.matchCars) {
      const mesh = this.matchCarMeshes.get(car.id);
      if (!mesh) continue;
      mesh.root.visible = car.demolishedTimer <= 0;
      if (!mesh.root.visible) continue;

      mesh.root.position.set(car.pos.x, car.pos.y, car.pos.z);
      mesh.root.quaternion.set(car.quat.x, car.quat.y, car.quat.z, car.quat.w);

      // Suspension tilt
      mesh.bodyGroup.rotation.x = car.bodyPitchTilt;
      mesh.bodyGroup.rotation.z = car.bodyRollTilt;

      // Wheel spin & front wheel steer
      for (const w of mesh.wheels) {
        w.pivot.rotation.y = w.isFront ? car.steerAngle : 0;
        w.spinMesh.rotation.x = car.wheelSpin;
      }

      // Dynamic animated decals & Zomba wheels
      mesh.decalHandle.update(this.elapsed);
      if (mesh.zombaRings.length > 0) {
        _color.setHSL((this.elapsed * 0.25) % 1, 0.95, 0.55);
        for (const rm of mesh.zombaRings) {
          rm.color.copy(_color);
          rm.emissive.copy(_color);
        }
      }

      // Ground contact shadow opacity fades with height
      const sOpacity = THREE.MathUtils.clamp(1 - car.pos.y / 14, 0, 0.45);
      (mesh.shadowPlane.material as THREE.MeshBasicMaterial).opacity = sOpacity;
    }
  }

  private updateMatchCamera(dt: number): void {
    const player = this.matchCars.find((c) => c.isPlayer);
    if (!player) return;

    const pPos = _v1.set(player.pos.x, player.pos.y, player.pos.z);
    const speedRatio = Math.min(1, v3Len(player.vel) / 67);

    // Wide cinematic FOV & distance tuned for 1.8x stadium scale
    const targetFov = 68 + speedRatio * 14 + (player.isSupersonic ? 4 : 0);
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      targetFov,
      1 - Math.exp(-6 * dt),
    );
    this.camera.updateProjectionMatrix();

    if (this.ballCam) {
      // Airtight, pitch-clamped Ball Cam: stays behind & slightly above car, never clips walls/ceiling
      const pose = computeSafeBallCamPose(
        player.pos,
        this.ballState.pos,
        { x: this.ballCamDir.x, y: 0, z: this.ballCamDir.z },
        speedRatio,
        dt,
      );
      this.ballCamDir.set(pose.nextDir.x, 0, pose.nextDir.z);

      this.camera.position.lerp(
        _v3.set(pose.camPos.x, pose.camPos.y, pose.camPos.z),
        1 - Math.exp(-9.5 * dt),
      );
      // Guarantee interpolated camera position never drifts outside arena walls/ceiling
      const camVec = {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      };
      const zeroVel = { x: 0, y: 0, z: 0 };
      enforceArenaHardBounds(camVec, zeroVel, 2.8, 0);
      this.camera.position.set(
        camVec.x,
        THREE.MathUtils.clamp(camVec.y, 1.6, ARENA.height - 4.0),
        camVec.z,
      );

      this.ballCamLookTarget.lerp(
        _v3.set(pose.lookTarget.x, pose.lookTarget.y, pose.lookTarget.z),
        1 - Math.exp(-12 * dt),
      );
      this.camera.lookAt(this.ballCamLookTarget);
    } else {
      // Car Cam: smooth follow behind car's nose, strictly contained inside arena
      const fwd = rotateVecByQuat({ x: 0, y: 0, z: 1 }, player.quat);
      const camDist = 10.8 + speedRatio * 1.4;
      const camVec = {
        x: pPos.x - fwd.x * camDist,
        y: THREE.MathUtils.clamp(pPos.y + 3.9, 1.6, ARENA.height - 4.0),
        z: pPos.z - fwd.z * camDist,
      };
      const zeroVel = { x: 0, y: 0, z: 0 };
      enforceArenaHardBounds(camVec, zeroVel, 3.0, 0);

      this.camera.position.lerp(
        _v2.set(camVec.x, camVec.y, camVec.z),
        1 - Math.exp(-10 * dt),
      );
      _v3.set(pPos.x + fwd.x * 12, pPos.y + 1.4, pPos.z + fwd.z * 12);
      this.ballCamLookTarget.lerp(_v3, 1 - Math.exp(-14 * dt));
      this.camera.lookAt(this.ballCamLookTarget);
    }

    // Trauma camera shake
    if (this.cameraTrauma > 0) {
      const shake = this.cameraTrauma * this.cameraTrauma * 0.65;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.4);
    }
  }

  private updateParticles(dt: number): void {
    let anyUpdated = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyUpdated = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _m4.makeTranslation(0, -999, 0);
        this.particleMesh.setMatrixAt(i, _m4);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.1) {
        p.y = 0.1;
        p.vy = Math.abs(p.vy) * 0.4;
      }
      const lifeRatio = p.life / p.maxLife;
      const sc = p.size * lifeRatio;
      _m4.makeTranslation(p.x, p.y, p.z);
      _scaleVec.set(sc, sc, sc);
      _m4.scale(_scaleVec);
      this.particleMesh.setMatrixAt(i, _m4);
      this.particleMesh.setColorAt(i, _color.setRGB(p.r, p.g, p.b));
    }
    if (anyUpdated) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private buildHudSnapshot(): HudSnapshot {
    const player = this.matchCars.find((c) => c.isPlayer);
    const step = Math.ceil(this.countdownTimer);
    const countdownText =
      this.matchPhase === 'countdown'
        ? step > 0
          ? String(step)
          : '¡YA!'
        : '';

    return {
      phase: this.matchPhase,
      blueScore: this.blueScore,
      orangeScore: this.orangeScore,
      timeRemaining: this.timeRemaining,
      isOvertime: this.isOvertime,
      countdownText,
      boost: Math.round(player?.boost ?? 0),
      speedKmh: Math.round(player ? v3Len(player.vel) * 3.6 : 0),
      isSupersonic: Boolean(player?.isSupersonic),
      ballCam: this.ballCam,
      goalBanner: this.goalBanner,
      demoBanner: this.demoBanner,
      mechanicBanner: this.mechanicBanner,
      paused: this.paused,
      mode: this.matchConfig?.mode ?? '1v1',
      winnerTeam:
        this.matchPhase === 'podium'
          ? this.blueScore >= this.orangeScore
            ? 'blue'
            : 'orange'
          : null,
      scoreboardRows: this.matchCars.map((c) => ({
        id: c.id,
        name: c.name,
        team: c.team,
        isPlayer: c.isPlayer,
        goals: c.stats.goals,
        shots: c.stats.shots,
        saves: c.stats.saves,
        demos: c.stats.demos,
        score: c.stats.score,
      })),
    };
  }

  private emitHud(): void {
    this.onHudUpdate(this.buildHudSnapshot());
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    soundEngine.silenceMatchLoops();
    this.resizeObserver.disconnect();
    this.clearMatchCarMeshes();
    this.showcaseCarMesh?.dispose();
    this.pedestal.dispose();
    this.stadium.dispose();
    this.ballMesh.dispose();
    this.shadowTex.dispose();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
