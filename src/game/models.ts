import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { ARENA, BoostPadState } from './physics';
import {
  DynamicDecalHandle,
  createBallTexture,
  createCarDecalTexture,
  createCarbonFiberTexture,
  createContactShadowTexture,
  createCrowdStandTexture,
  createGoalNetTexture,
  createHeadlightBeamTexture,
  createHexWallTexture,
  createLedAdBoardTexture,
  createStadiumTurfTextures,
} from './textures';

export interface CarMeshHandle {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: { pivot: THREE.Group; spinMesh: THREE.Group; isFront: boolean }[];
  headlightCones: THREE.Mesh[];
  exhaustPositions: THREE.Vector3[];
  zombaRings: THREE.MeshPhysicalMaterial[];
  decalHandle: DynamicDecalHandle;
  topperGroup: THREE.Group;
  shadowPlane: THREE.Mesh;
  dispose: () => void;
}

export interface CarBuildConfig {
  bodyId: string;
  decalId: string;
  primaryColor: string;
  secondaryColor: string;
  wheelId: string;
  topperId: string;
}

function buildWheelMesh(
  wheelId: string,
  zombaRings: THREE.MeshPhysicalMaterial[],
): THREE.Group {
  const g = new THREE.Group();

  // Tire tread (open-ended rubber band + inner barrel so spokes reveal brake rotor & caliper!)
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x14181f,
    roughness: 0.84,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.34, 24, 1, true),
    tireMat,
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);

  const sidewallGeo = new THREE.RingGeometry(0.28, 0.42, 24);
  for (const sx of [-0.17, 0.17]) {
    const sw = new THREE.Mesh(sidewallGeo, tireMat);
    sw.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    sw.position.x = sx;
    g.add(sw);
  }

  // Inner metallic grooved brake rotor disc visible behind open spokes
  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.94,
    roughness: 0.22,
  });
  const rotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.06, 20),
    rotorMat,
  );
  rotor.rotation.z = Math.PI / 2;
  g.add(rotor);

  // Rim base
  let rimColor = 0x94a3b8;
  let rimMetal = 0.88;
  let rimRough = 0.22;
  let emissive = 0x000000;
  let emissiveInt = 0;

  if (wheelId === 'wheel_oem') {
    rimColor = 0x334155;
    rimRough = 0.42;
  } else if (wheelId === 'wheel_cristiano') {
    rimColor = 0xe2e8f0;
    rimMetal = 0.78;
  } else if (wheelId === 'wheel_goldstone') {
    rimColor = 0xf59e0b;
    rimMetal = 0.95;
    rimRough = 0.12;
    emissive = 0x78350f;
    emissiveInt = 0.25;
  } else if (wheelId === 'wheel_draco') {
    rimColor = 0x1e293b;
    emissive = 0xff5500;
    emissiveInt = 1.4;
  } else if (wheelId === 'wheel_apex') {
    rimColor = 0x0f172a;
    emissive = 0x00d4ff;
    emissiveInt = 1.2;
  } else if (wheelId === 'wheel_zomba') {
    rimColor = 0x22d3ee;
    emissive = 0x22d3ee;
    emissiveInt = 1.1;
  }

  const rimMat = new THREE.MeshPhysicalMaterial({
    color: rimColor,
    metalness: rimMetal,
    roughness: rimRough,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    emissive,
    emissiveIntensity: emissiveInt,
  });
  if (wheelId === 'wheel_zomba') {
    zombaRings.push(rimMat);
  }

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.34, 16),
    rimMat,
  );
  hub.rotation.z = Math.PI / 2;
  g.add(hub);

  // Outer lip rings
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.032, 8, 24),
    rimMat,
  );
  lip.rotation.y = Math.PI / 2;
  lip.position.x = 0.15;
  g.add(lip);
  const lipIn = lip.clone();
  lipIn.position.x = -0.15;
  g.add(lipIn);

  // Thin outer-face spokes revealing rotor & brake caliper inside!
  const spokeCount = wheelId === 'wheel_cristiano' ? 5 : 6;
  const spokeMat = new THREE.MeshPhysicalMaterial({
    color: wheelId === 'wheel_cristiano' ? 0x0f172a : 0xf8fafc,
    metalness: 0.85,
    roughness: 0.18,
    clearcoat: 0.8,
  });
  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * Math.PI * 2;
    for (const sx of [-0.145, 0.145]) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.036, 0.18),
        spokeMat,
      );
      spoke.position.set(sx, Math.sin(a) * 0.16, Math.cos(a) * 0.16);
      spoke.rotation.x = a;
      g.add(spoke);
    }
  }

  // Glowing outer ring for Draco / Apex / Zomba
  if (
    wheelId === 'wheel_draco' ||
    wheelId === 'wheel_apex' ||
    wheelId === 'wheel_zomba'
  ) {
    const ringGeo = new THREE.TorusGeometry(0.32, 0.04, 8, 24);
    const ringMat = new THREE.MeshPhysicalMaterial({
      color: rimColor,
      emissive: wheelId === 'wheel_apex' ? 0xff6600 : emissive,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      clearcoat: 0.7,
    });
    if (wheelId === 'wheel_zomba') zombaRings.push(ringMat);
    for (const side of [-0.18, 0.18]) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = side;
      g.add(ring);
    }
  }

  return g;
}

function buildTopperMesh(topperId: string): THREE.Group {
  const g = new THREE.Group();
  if (topperId === 'topper_none') return g;

  if (topperId === 'topper_crown') {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.95,
      roughness: 0.16,
      emissive: 0x92400e,
      emissiveIntensity: 0.25,
    });
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.3, 0.16, 12),
      goldMat,
    );
    g.add(base);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), goldMat);
      spike.position.set(Math.cos(a) * 0.26, 0.16, Math.sin(a) * 0.26);
      g.add(spike);
    }
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.1),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 1.2,
      }),
    );
    gem.position.y = 0.12;
    g.add(gem);
  } else if (topperId === 'topper_halo') {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.055, 12, 32),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x00e5ff,
        emissiveIntensity: 2.2,
        roughness: 0.1,
      }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.28;
    g.add(halo);
  } else if (topperId === 'topper_cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      capMat,
    );
    g.add(dome);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.05, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    );
    visor.position.set(0, 0.02, 0.28);
    g.add(visor);
  } else if (topperId === 'topper_horns') {
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.35,
      metalness: 0.2,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.35,
    });
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.48, 10), hornMat);
      horn.position.set(side * 0.28, 0.18, 0);
      horn.rotation.z = -side * 0.45;
      horn.rotation.x = 0.2;
      g.add(horn);
    }
  } else if (topperId === 'topper_wizard') {
    const wizMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.65 });
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.48, 0.05, 18),
      wizMat,
    );
    g.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 16), wizMat);
    cone.position.y = 0.34;
    cone.rotation.x = -0.14;
    g.add(cone);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.28, 0.08, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.8,
      }),
    );
    band.position.y = 0.08;
    g.add(band);
  }

  return g;
}

export function buildCarMesh(
  config: CarBuildConfig,
  maxAnisotropy: number,
  shadowTex: THREE.Texture,
): CarMeshHandle {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const decalHandle = createCarDecalTexture(
    config.decalId,
    config.primaryColor,
    config.secondaryColor,
    maxAnisotropy,
  );

  const isAnodized = config.decalId === 'decal_anodized';
  const isPearlescent = config.decalId === 'decal_pearlescent';

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: decalHandle.texture,
    metalness: isAnodized ? 0.92 : isPearlescent ? 0.68 : 0.38,
    roughness: isAnodized ? 0.14 : isPearlescent ? 0.2 : 0.28,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.35,
    iridescence: isPearlescent ? 0.95 : 0,
    emissive: decalHandle.isAnimated ? new THREE.Color(config.secondaryColor) : new THREE.Color(0x000000),
    emissiveIntensity: decalHandle.isAnimated ? 0.22 : 0,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.68,
    metalness: 0.28,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1220,
    roughness: 0.06,
    metalness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.6,
    opacity: 0.92,
    transparent: true,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0xbae6fd,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff3300,
    emissive: 0xff2200,
    emissiveIntensity: 2.0,
    roughness: 0.1,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.92,
    roughness: 0.18,
  });

  let roofY = 0.72;
  let wheelbaseZ = 1.15;
  let trackX = 0.96;
  let exhaustPositions = [
    new THREE.Vector3(-0.34, 0.15, -1.78),
    new THREE.Vector3(0.34, 0.15, -1.78),
  ];

  const body = config.bodyId;

  if (body === 'body_octane') {
    // Iconic buggy silhouette + raised rear spoiler
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.52, 3.1), paintMat);
    chassis.position.set(0, 0.15, 0);
    chassis.castShadow = true;
    bodyGroup.add(chassis);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.34, 0.9), paintMat);
    nose.position.set(0, 0.08, 1.55);
    nose.rotation.x = 0.22;
    bodyGroup.add(nose);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.44, 1.38), glassMat);
    cabin.position.set(0, 0.56, -0.1);
    cabin.castShadow = true;
    bodyGroup.add(cabin);

    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.1), paintMat);
    roofCap.position.set(0, 0.78, -0.15);
    bodyGroup.add(roofCap);

    // Iconic tall rear wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 0.42), paintMat);
    wing.position.set(0, 0.88, -1.48);
    wing.rotation.x = -0.18;
    bodyGroup.add(wing);

    for (const sx of [-0.45, 0.45]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.22), trimMat);
      strut.position.set(sx, 0.62, -1.42);
      bodyGroup.add(strut);
    }
    roofY = 0.84;
  } else if (body === 'body_fennec') {
    // Boxy rally hatchback
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.56, 3.2), paintMat);
    chassis.position.set(0, 0.18, 0);
    chassis.castShadow = true;
    bodyGroup.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.5, 1.65), glassMat);
    cabin.position.set(0, 0.64, -0.22);
    bodyGroup.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.1, 1.48), paintMat);
    roof.position.set(0, 0.9, -0.25);
    bodyGroup.add(roof);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.1, 0.34), paintMat);
    spoiler.position.set(0, 0.95, -1.35);
    bodyGroup.add(spoiler);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.24, 0.25), trimMat);
    bumper.position.set(0, 0.0, 1.65);
    bodyGroup.add(bumper);
    roofY = 0.95;
  } else if (body === 'body_dominus') {
    // Long wide flat muscle car + hood scoop
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.44, 3.65), paintMat);
    chassis.position.set(0, 0.12, 0);
    chassis.castShadow = true;
    bodyGroup.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.34, 1.35), glassMat);
    cabin.position.set(0, 0.46, -0.28);
    bodyGroup.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.07, 1.1), paintMat);
    roof.position.set(0, 0.64, -0.32);
    bodyGroup.add(roof);

    // Chrome supercharger hood intake
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.72), chromeMat);
    scoop.position.set(0, 0.42, 0.92);
    bodyGroup.add(scoop);

    const lipSpoiler = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.12, 0.28), trimMat);
    lipSpoiler.position.set(0, 0.4, -1.74);
    bodyGroup.add(lipSpoiler);
    roofY = 0.68;
    wheelbaseZ = 1.28;
    exhaustPositions = [
      new THREE.Vector3(-0.42, 0.1, -1.9),
      new THREE.Vector3(0.42, 0.1, -1.9),
    ];
  } else if (body === 'body_breakout') {
    // Sleek low-profile wedge supercar
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.38, 3.55), paintMat);
    chassis.position.set(0, 0.08, 0);
    chassis.castShadow = true;
    bodyGroup.add(chassis);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.24, 1.15), paintMat);
    nose.position.set(0, 0.04, 1.35);
    nose.rotation.x = 0.16;
    bodyGroup.add(nose);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.32, 1.4), glassMat);
    canopy.position.set(0, 0.38, -0.15);
    bodyGroup.add(canopy);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.08, 0.44), paintMat);
    wing.position.set(0, 0.68, -1.65);
    bodyGroup.add(wing);

    for (const sx of [-0.52, 0.52]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.24), trimMat);
      strut.position.set(sx, 0.46, -1.62);
      bodyGroup.add(strut);
    }
    roofY = 0.55;
    wheelbaseZ = 1.24;
  } else if (body === 'body_merc') {
    // Tall armored van
    const vanBody = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.96, 3.3), paintMat);
    vanBody.position.set(0, 0.42, -0.05);
    vanBody.castShadow = true;
    bodyGroup.add(vanBody);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.42, 0.2), glassMat);
    windshield.position.set(0, 0.62, 1.56);
    windshield.rotation.x = -0.25;
    bodyGroup.add(windshield);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.32, 0.2), chromeMat);
    grille.position.set(0, 0.16, 1.62);
    bodyGroup.add(grille);
    roofY = 0.92;
  } else {
    // Batmóvil stealth ultra-low wedge + central turbine
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.28, 3.8), paintMat);
    hull.position.set(0, 0.06, 0);
    hull.castShadow = true;
    bodyGroup.add(hull);

    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.26, 1.35), glassMat);
    cockpit.position.set(0, 0.28, -0.1);
    bodyGroup.add(cockpit);

    for (const sx of [-0.82, 0.82]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 1.25), trimMat);
      fin.position.set(sx, 0.32, -1.22);
      fin.rotation.z = sx > 0 ? -0.22 : 0.22;
      bodyGroup.add(fin);
    }

    const turbine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.45, 16),
      chromeMat,
    );
    turbine.rotation.x = Math.PI / 2;
    turbine.position.set(0, 0.22, -1.85);
    bodyGroup.add(turbine);

    roofY = 0.43;
    wheelbaseZ = 1.35;
    trackX = 1.04;
    exhaustPositions = [new THREE.Vector3(0, 0.22, -2.08)];
  }

  // Headlights, Taillights & Soft Volumetric Headlight Cones (gradient fade, no hard edges)
  const headlightCones: THREE.Mesh[] = [];
  const beamTex = createHeadlightBeamTexture();
  const beamGeo = new THREE.CylinderGeometry(0.08, 0.56, 3.2, 16, 1, true);
  beamGeo.translate(0, -1.6, 0);
  beamGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTex,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  for (const sx of [-0.52, 0.52]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.1), headlightMat);
    hl.position.set(sx, 0.14, 1.68);
    bodyGroup.add(hl);

    const beamCone = new THREE.Mesh(beamGeo, beamMat);
    beamCone.position.set(sx, 0.14, 1.72);
    beamCone.rotation.x = 0.06;
    bodyGroup.add(beamCone);
    headlightCones.push(beamCone);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.1), taillightMat);
    tl.position.set(sx, 0.22, -1.68);
    bodyGroup.add(tl);
  }

  // Exhaust pipes
  for (const ep of exhaustPositions) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.32, 12),
      chromeMat,
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.copy(ep);
    bodyGroup.add(pipe);
  }

  // Topper
  const topperGroup = buildTopperMesh(config.topperId);
  topperGroup.position.set(0, roofY, -0.15);
  bodyGroup.add(topperGroup);

  // Ensure all car body parts cast & receive crisp shadows
  bodyGroup.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && !headlightCones.includes(obj as THREE.Mesh)) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  // 4 Wheels + stationary painted brake calipers clearly visible behind open spokes
  const zombaRings: THREE.MeshPhysicalMaterial[] = [];
  const wheels: CarMeshHandle['wheels'] = [];
  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xff2a2a,
    metalness: 0.45,
    roughness: 0.24,
    emissive: 0xb91c1c,
    emissiveIntensity: 0.45,
  });
  const caliperGeo = new THREE.BoxGeometry(0.08, 0.16, 0.14);
  const wheelPositions: [number, number, boolean][] = [
    [-trackX, wheelbaseZ, true],
    [trackX, wheelbaseZ, true],
    [-trackX, -wheelbaseZ, false],
    [trackX, -wheelbaseZ, false],
  ];

  for (const [wx, wz, isFront] of wheelPositions) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, -0.22, wz);
    const spinMesh = buildWheelMesh(config.wheelId, zombaRings);
    pivot.add(spinMesh);

    // Stationary red brake caliper gripping the rotor cleanly visible inside spokes
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(wx > 0 ? 0.085 : -0.085, 0.09, -0.13);
    pivot.add(caliper);

    root.add(pivot);
    wheels.push({ pivot, spinMesh, isFront });
  }

  // Contact shadow disc grounded under car
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 5.2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.62;
  root.add(shadowPlane);

  const dispose = () => {
    decalHandle.dispose();
    beamTex.dispose();
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
  };

  return {
    root,
    bodyGroup,
    wheels,
    headlightCones,
    exhaustPositions,
    zombaRings,
    decalHandle,
    topperGroup,
    shadowPlane,
    dispose,
  };
}

export interface ShowcasePedestalHandle {
  group: THREE.Group;
  dispose: () => void;
}

export function buildShowcasePedestal(
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): ShowcasePedestalHandle {
  const group = new THREE.Group();
  const carbonTex = createCarbonFiberTexture(maxAnisotropy);

  // Outer brushed metallic chamfered base
  const outerMetal = new THREE.Mesh(
    new THREE.CylinderGeometry(4.05, 4.45, 0.24, 48),
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.22,
    }),
  );
  outerMetal.position.y = 0.12;
  outerMetal.receiveShadow = true;
  group.add(outerMetal);

  // Woven carbon fiber upper ring deck
  const carbonDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(3.75, 3.92, 0.14, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: carbonTex,
      metalness: 0.45,
      roughness: 0.34,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    }),
  );
  carbonDeck.position.y = 0.29;
  carbonDeck.receiveShadow = true;
  group.add(carbonDeck);

  // Dual neon LED edge rings (electric blue upper + warm orange base)
  const blueLed = new THREE.Mesh(
    new THREE.TorusGeometry(3.78, 0.055, 10, 64),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0088ff,
      emissiveIntensity: 2.4,
      roughness: 0.15,
    }),
  );
  blueLed.rotation.x = Math.PI / 2;
  blueLed.position.y = 0.36;
  group.add(blueLed);

  const orangeLed = new THREE.Mesh(
    new THREE.TorusGeometry(4.24, 0.05, 10, 64),
    new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xff6600,
      emissiveIntensity: 2.0,
      roughness: 0.15,
    }),
  );
  orangeLed.rotation.x = Math.PI / 2;
  orangeLed.position.y = 0.08;
  group.add(orangeLed);

  // Real floor reflection mirror inlay (live Reflector on GPU, glossy clearcoat on software WebGL)
  const mirrorGeo = new THREE.CircleGeometry(3.25, 48);
  if (!isSoftwareGl) {
    const reflector = new Reflector(mirrorGeo, {
      clipBias: 0.003,
      textureWidth: 512,
      textureHeight: 512,
      color: 0x3a4a66,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = 0.368;
    group.add(reflector);
  } else {
    const glossyDisc = new THREE.Mesh(
      mirrorGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0x0b1220,
        metalness: 0.85,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      }),
    );
    glossyDisc.rotation.x = -Math.PI / 2;
    glossyDisc.position.y = 0.368;
    glossyDisc.receiveShadow = true;
    group.add(glossyDisc);
  }

  // Recessed floor under-glow halo
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(4.2, 5.1, 48),
    new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.025;
  group.add(halo);

  const dispose = () => {
    carbonTex.dispose();
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
        else m.material?.dispose();
      }
    });
  };

  return { group, dispose };
}

export interface StadiumHandle {
  group: THREE.Group;
  scoreboardCanvas: HTMLCanvasElement;
  scoreboardCtx: CanvasRenderingContext2D;
  scoreboardTex: THREE.CanvasTexture;
  updateScoreboard: (
    blueScore: number,
    orangeScore: number,
    timeSeconds: number,
    isOvertime: boolean,
  ) => void;
  boostPadMeshes: {
    padId: number;
    orbMesh?: THREE.Mesh;
    ringMat: THREE.MeshStandardMaterial;
  }[];
  wallImpactMat: THREE.MeshBasicMaterial;
  wallImpactMesh: THREE.Mesh;
  dispose: () => void;
}

interface PerimeterPoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
  arcLen: number;
}

function buildHalfPerimeterPoints(sideSign: 1 | -1): PerimeterPoint[] {
  const { halfW, halfL, cornerChamfer, cornerFillet, goalHalfW } = ARENA;
  const wCore = halfW - cornerFillet;
  const lCore = halfL - cornerFillet;
  const cCore = halfW + halfL - cornerChamfer - cornerFillet * Math.SQRT2;
  const zCornerCore = cCore - wCore;
  const xCornerCore = cCore - lCore;

  const raw: { x: number; z: number; nx: number; nz: number }[] = [];
  const pushPt = (x: number, z: number, nx: number, nz: number) => {
    raw.push({ x: sideSign * x, z, nx: sideSign * nx, nz });
  };

  // Start at Blue end wall right next to goal post (z = -halfL)
  pushPt(goalHalfW, -halfL, 0, 1);
  pushPt(xCornerCore, -halfL, 0, 1);

  // Fillet 1: Blue end wall -> Blue 45° corner
  const filletSteps = 5;
  for (let i = 1; i <= filletSteps; i++) {
    const a = -Math.PI / 2 + (i / filletSteps) * (Math.PI / 4);
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    pushPt(xCornerCore + ox * cornerFillet, -lCore + oz * cornerFillet, -ox, -oz);
  }

  // Straight 45° Blue corner -> start of Fillet 2
  pushPt(
    wCore + Math.SQRT1_2 * cornerFillet,
    -zCornerCore - Math.SQRT1_2 * cornerFillet,
    -Math.SQRT1_2,
    Math.SQRT1_2,
  );

  // Fillet 2: Blue 45° corner -> Side wall
  for (let i = 1; i <= filletSteps; i++) {
    const a = -Math.PI / 4 + (i / filletSteps) * (Math.PI / 4);
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    pushPt(wCore + ox * cornerFillet, -zCornerCore + oz * cornerFillet, -ox, -oz);
  }

  // Straight Side wall (midfield segments for crisp UVs)
  pushPt(halfW, 0, -1, 0);
  pushPt(halfW, zCornerCore, -1, 0);

  // Fillet 3: Side wall -> Orange 45° corner
  for (let i = 1; i <= filletSteps; i++) {
    const a = (i / filletSteps) * (Math.PI / 4);
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    pushPt(wCore + ox * cornerFillet, zCornerCore + oz * cornerFillet, -ox, -oz);
  }

  // Straight 45° Orange corner -> start of Fillet 4
  pushPt(
    xCornerCore + Math.SQRT1_2 * cornerFillet,
    lCore + Math.SQRT1_2 * cornerFillet,
    -Math.SQRT1_2,
    -Math.SQRT1_2,
  );

  // Fillet 4: Orange 45° corner -> Orange end wall
  for (let i = 1; i <= filletSteps; i++) {
    const a = Math.PI / 4 + (i / filletSteps) * (Math.PI / 4);
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    pushPt(xCornerCore + ox * cornerFillet, lCore + oz * cornerFillet, -ox, -oz);
  }

  pushPt(goalHalfW, halfL, 0, -1);

  // Compute cumulative arc length
  const out: PerimeterPoint[] = [];
  let acc = 0;
  for (let i = 0; i < raw.length; i++) {
    if (i > 0) {
      acc += Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z);
    }
    out.push({ ...raw[i], arcLen: acc });
  }
  return out;
}

function buildSweepStripGeometry(
  points: PerimeterPoint[],
  profileSteps: { offsetIn: number; y: number; ny: number; nIn: number; v: number }[],
  uvScaleU = 0.04,
): THREE.BufferGeometry {
  const numPts = points.length;
  const numRows = profileSteps.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < numRows; r++) {
    const prof = profileSteps[r];
    for (let i = 0; i < numPts; i++) {
      const p = points[i];
      positions.push(p.x + p.nx * prof.offsetIn, prof.y, p.z + p.nz * prof.offsetIn);
      normals.push(p.nx * prof.nIn, prof.ny, p.nz * prof.nIn);
      uvs.push(p.arcLen * uvScaleU, prof.v);
    }
  }

  for (let r = 0; r < numRows - 1; r++) {
    for (let i = 0; i < numPts - 1; i++) {
      const a = r * numPts + i;
      const b = r * numPts + (i + 1);
      const c = (r + 1) * numPts + i;
      const d = (r + 1) * numPts + (i + 1);
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function buildDFHStadium(
  maxAnisotropy: number,
  pads: BoostPadState[],
  isSoftwareGl: boolean,
): StadiumHandle {
  const group = new THREE.Group();
  const { halfW, halfL, height, coveRadius, goalHalfW, goalHeight, goalDepth } = ARENA;

  const rightArc = buildHalfPerimeterPoints(1);
  const leftArc = buildHalfPerimeterPoints(-1);

  // Closed perimeter loop for floor & ceiling (Blue goal -> +X -> Orange goal -> -X -> Blue goal)
  const fullLoop: PerimeterPoint[] = [
    ...rightArc,
    ...leftArc.slice().reverse(),
    rightArc[0],
  ];
  let loopArc = 0;
  for (let i = 0; i < fullLoop.length; i++) {
    if (i > 0) {
      loopArc += Math.hypot(
        fullLoop[i].x - fullLoop[i - 1].x,
        fullLoop[i].z - fullLoop[i - 1].z,
      );
    }
    fullLoop[i] = { ...fullLoop[i], arcLen: loopArc };
  }

  // 1. Octagonal Rounded Pitch Floor (hyper-realistic turf + roughnessMap for floodlight shimmer)
  const { map: turfMap, roughnessMap: turfRoughness } =
    createStadiumTurfTextures(maxAnisotropy);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: turfMap,
    roughnessMap: turfRoughness,
    roughness: 0.96,
    metalness: 0.04,
  });

  const floorPositions: number[] = [0, 0, 0];
  const floorNormals: number[] = [0, 1, 0];
  const floorUvs: number[] = [0.5, 0.5];
  const floorIndices: number[] = [];

  for (let i = 0; i < fullLoop.length; i++) {
    const p = fullLoop[i];
    // Inset slightly inside wall base (wallDist = coveRadius) so curved ramp sits flush on turf
    const fx = p.x + p.nx * (coveRadius - 0.15);
    const fz = p.z + p.nz * (coveRadius - 0.15);
    floorPositions.push(fx, 0, fz);
    floorNormals.push(0, 1, 0);
    floorUvs.push(fx / (halfW * 2) + 0.5, 0.5 - fz / (halfL * 2));
    if (i > 0) {
      floorIndices.push(0, i + 1, i);
    }
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(floorPositions, 3));
  floorGeo.setAttribute('normal', new THREE.Float32BufferAttribute(floorNormals, 3));
  floorGeo.setAttribute('uv', new THREE.Float32BufferAttribute(floorUvs, 2));
  floorGeo.setIndex(floorIndices);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  group.add(floor);

  // Flat turf wedges connecting center pitch directly into both goal mouths
  for (const sz of [-1, 1]) {
    const mouthTurf = new THREE.Mesh(
      new THREE.PlaneGeometry(goalHalfW * 2, coveRadius + 1.0),
      new THREE.MeshStandardMaterial({ color: 0x1b622f, roughness: 0.84, metalness: 0.04 }),
    );
    mouthTurf.rotation.x = -Math.PI / 2;
    mouthTurf.position.set(0, 0.004, sz * (halfL - (coveRadius + 1.0) * 0.5 + 0.4));
    mouthTurf.receiveShadow = true;
    group.add(mouthTurf);
  }

  // Outer dark stadium apron around octagonal arena (1.8x)
  const apron = new THREE.Mesh(
    new THREE.RingGeometry(150, 320, 36),
    new THREE.MeshStandardMaterial({ color: 0x080f1d, roughness: 0.92 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.15;
  group.add(apron);

  // 2. Concave Quarter-Cylinder Floor-to-Wall Ramps (continuous around 45° corners!)
  const rampMat = new THREE.MeshStandardMaterial({
    color: 0x164e36,
    roughness: 0.48,
    metalness: 0.22,
    side: THREE.DoubleSide,
  });
  const lowerCoveSteps: { offsetIn: number; y: number; ny: number; nIn: number; v: number }[] = [];
  const lowerSegs = 6;
  for (let k = 0; k <= lowerSegs; k++) {
    const a = (k / lowerSegs) * (Math.PI / 2);
    lowerCoveSteps.push({
      offsetIn: coveRadius * (1 - Math.sin(a)),
      y: coveRadius * (1 - Math.cos(a)),
      ny: Math.cos(a),
      nIn: Math.sin(a),
      v: k / lowerSegs,
    });
  }
  for (const arc of [rightArc, leftArc]) {
    const rampMesh = new THREE.Mesh(buildSweepStripGeometry(arc, lowerCoveSteps, 0.03), rampMat);
    rampMesh.receiveShadow = true;
    group.add(rampMesh);
  }

  // 3. Translucent Hexagonal Glass Walls + Upper Concave Wall-to-Ceiling Coves
  const hexTex = createHexWallTexture(maxAnisotropy);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    map: hexTex,
    transparent: true,
    opacity: 0.36,
    roughness: 0.2,
    metalness: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.82,
    roughness: 0.28,
  });

  // Lower curved ramp hex-glass inner energy layer (covers y: 0 -> coveRadius seamlessly)
  const lowerGlassSteps = lowerCoveSteps.map((s) => ({
    ...s,
    offsetIn: s.offsetIn + 0.05,
    y: s.y + 0.05,
  }));
  for (const arc of [rightArc, leftArc]) {
    group.add(new THREE.Mesh(buildSweepStripGeometry(arc, lowerGlassSteps, 0.025), wallMat));
  }

  // Vertical glass walls along both side/corner arcs (y: coveRadius -> height - coveRadius)
  const vertSteps = [
    { offsetIn: 0, y: coveRadius, ny: 0, nIn: 1, v: 0 },
    { offsetIn: 0, y: height - coveRadius, ny: 0, nIn: 1, v: 1 },
  ];
  for (const arc of [rightArc, leftArc]) {
    group.add(new THREE.Mesh(buildSweepStripGeometry(arc, vertSteps, 0.025), wallMat));
  }

  // Vertical glass walls above both goal mouths (y: goalHeight -> height - coveRadius)
  for (const sz of [-1, 1]) {
    const aboveH = height - coveRadius - goalHeight;
    const aboveMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(goalHalfW * 2, aboveH),
      wallMat,
    );
    aboveMesh.position.set(0, goalHeight + aboveH / 2, sz * halfL);
    if (sz > 0) aboveMesh.rotation.y = Math.PI;
    group.add(aboveMesh);

    // Exact concave quarter-circle cove cheeks sealing behind the curved ramp right at x = ±goalHalfW
    const cheekShape = new THREE.Shape();
    cheekShape.moveTo(0, 0);
    for (let k = 0; k <= lowerSegs; k++) {
      const a = (k / lowerSegs) * (Math.PI / 2);
      const cz = coveRadius * (1 - Math.sin(a)); // distance inward from end wall
      const cy = coveRadius * (1 - Math.cos(a)); // height above floor
      cheekShape.lineTo(cz, cy);
    }
    cheekShape.lineTo(0, coveRadius);
    cheekShape.closePath();
    const cheekGeo = new THREE.ShapeGeometry(cheekShape);
    const cheekMat = frameMat.clone();
    cheekMat.side = THREE.DoubleSide;

    for (const sx of [-1, 1]) {
      const cheek = new THREE.Mesh(cheekGeo, cheekMat);
      cheek.position.set(sx * (goalHalfW + 0.04), 0, sz * halfL);
      // Local +X of shape points inward toward field center (-sz along Z)
      cheek.rotation.y = sz > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(cheek);
    }
  }

  // Upper concave wall-to-ceiling cove (entire closed octagonal loop!)
  const upperCoveSteps: { offsetIn: number; y: number; ny: number; nIn: number; v: number }[] = [];
  const upperSegs = 5;
  for (let k = 0; k <= upperSegs; k++) {
    const a = (k / upperSegs) * (Math.PI / 2);
    upperCoveSteps.push({
      offsetIn: coveRadius * (1 - Math.cos(a)),
      y: height - coveRadius + coveRadius * Math.sin(a),
      ny: -Math.sin(a),
      nIn: Math.cos(a),
      v: k / upperSegs,
    });
  }
  group.add(new THREE.Mesh(buildSweepStripGeometry(fullLoop, upperCoveSteps, 0.025), wallMat));

  // Glowing horizontal LED trim strip along the wall/ramp seam (y = coveRadius)
  const trimNeonMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.4,
    roughness: 0.25,
  });
  const seamSteps = [
    { offsetIn: 0.05, y: coveRadius - 0.12, ny: 0, nIn: 1, v: 0 },
    { offsetIn: 0.05, y: coveRadius + 0.12, ny: 0, nIn: 1, v: 1 },
  ];
  for (const arc of [rightArc, leftArc]) {
    group.add(new THREE.Mesh(buildSweepStripGeometry(arc, seamSteps, 0.04), trimNeonMat));
  }

  // 4. Curved Vaulted Ceiling Glass + Arched Metallic Stadium Roof Beams & Floodlights
  const ceilPositions: number[] = [0, height, 0];
  const ceilNormals: number[] = [0, -1, 0];
  const ceilUvs: number[] = [0.5, 0.5];
  const ceilIndices: number[] = [];
  for (let i = 0; i < fullLoop.length; i++) {
    const p = fullLoop[i];
    const cx = p.x + p.nx * coveRadius;
    const cz = p.z + p.nz * coveRadius;
    ceilPositions.push(cx, height, cz);
    ceilNormals.push(0, -1, 0);
    ceilUvs.push(cx / (halfW * 2) + 0.5, 0.5 - cz / (halfL * 2));
    if (i > 0) {
      ceilIndices.push(0, i, i + 1);
    }
  }
  const ceilGeo = new THREE.BufferGeometry();
  ceilGeo.setAttribute('position', new THREE.Float32BufferAttribute(ceilPositions, 3));
  ceilGeo.setAttribute('normal', new THREE.Float32BufferAttribute(ceilNormals, 3));
  ceilGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ceilUvs, 2));
  ceilGeo.setIndex(ceilIndices);
  group.add(new THREE.Mesh(ceilGeo, wallMat));

  // Curved Arched Metallic Roof Trusses (spanning X with graceful dome curve above y = height)
  const archZCoords = [-94, -62, -31, 0, 31, 62, 94];
  const archCurvePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * 2 - 1; // -1..1
    const ax = t * (halfW + 5);
    const ay = height + 0.8 + (1 - t * t) * 13.5;
    archCurvePts.push(new THREE.Vector3(ax, ay, 0));
  }
  const archCurve = new THREE.CatmullRomCurve3(archCurvePts);
  const archBeamGeo = new THREE.TubeGeometry(archCurve, 28, 0.95, 8, false);
  for (const az of archZCoords) {
    const beam = new THREE.Mesh(archBeamGeo, frameMat);
    beam.position.z = az;
    group.add(beam);
  }
  // Longitudinal steel spine beams connecting the arches
  for (const sx of [-50, 0, 50]) {
    const t = sx / (halfW + 5);
    const ay = height + 0.8 + (1 - t * t) * 13.5;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, halfL * 1.65), frameMat);
    spine.position.set(sx, ay, 0);
    group.add(spine);
  }

  // Realistic Stadium Overhead Floodlight Banks & Volumetric Cones
  const floodLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 3.0,
    roughness: 0.1,
  });
  for (const sx of [-1, 1]) {
    for (const fz of [-78, -28, 28, 78]) {
      const bank = new THREE.Group();
      bank.position.set(sx * (halfW - 6), height + 1.8, fz);
      bank.lookAt(0, 0, fz * 0.4);

      const housing = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.0, 1.6), frameMat);
      bank.add(housing);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.4), floodLightMat);
      lens.position.z = 0.82;
      bank.add(lens);
      group.add(bank);
    }
  }

  if (!isSoftwareGl) {
    const coneGeo = new THREE.ConeGeometry(26, 78, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.045,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(sx * (halfW - 6), height + 1.5, sz * 78);
        cone.lookAt(0, 0, 0);
        cone.rotateX(Math.PI / 2);
        group.add(cone);
      }
    }
  }

  // 5. Wider, Deeper Illuminated Goals + Bright Interior Nets
  const netTextures: THREE.CanvasTexture[] = [];
  for (const sz of [-1, 1]) {
    const teamColor = sz < 0 ? 0x0088ff : 0xff6600;
    const teamHex = sz < 0 ? '#38bdf8' : '#fb923c';
    const goalLightMat = new THREE.MeshStandardMaterial({
      color: teamColor,
      emissive: teamColor,
      emissiveIntensity: 2.1,
      roughness: 0.18,
    });

    // Thick glowing cylindrical goalposts + crossbar + corner joints
    const postGeo = new THREE.CylinderGeometry(0.48, 0.48, goalHeight, 14);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, goalLightMat);
      post.position.set(sx * goalHalfW, goalHeight / 2, sz * halfL);
      group.add(post);

      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.56, 12, 12), goalLightMat);
      joint.position.set(sx * goalHalfW, goalHeight, sz * halfL);
      group.add(joint);

      // Outer dark steel collar framing the goal opening
      const collar = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, goalHeight + 0.8, 1.3),
        frameMat,
      );
      collar.position.set(sx * (goalHalfW + 0.65), goalHeight / 2, sz * (halfL + 0.35));
      group.add(collar);
    }

    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, goalHalfW * 2, 14),
      goalLightMat,
    );
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, goalHeight, sz * halfL);
    group.add(crossbar);

    const topCollar = new THREE.Mesh(
      new THREE.BoxGeometry(goalHalfW * 2 + 2.2, 0.9, 1.3),
      frameMat,
    );
    topCollar.position.set(0, goalHeight + 0.65, sz * (halfL + 0.35));
    group.add(topCollar);

    // Illuminated Goal Line strip
    const goalLine = new THREE.Mesh(
      new THREE.PlaneGeometry(goalHalfW * 2, 0.42),
      new THREE.MeshBasicMaterial({ color: teamColor }),
    );
    goalLine.rotation.x = -Math.PI / 2;
    goalLine.position.set(0, 0.025, sz * halfL);
    group.add(goalLine);

    // Bright Glowing Interior Net (back, left, right, top panels)
    const netTex = createGoalNetTexture(teamHex, maxAnisotropy);
    netTextures.push(netTex);
    const netMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: netTex,
      emissive: teamColor,
      emissiveMap: netTex,
      emissiveIntensity: 1.35,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const netCenterZ = sz * (halfL + goalDepth / 2);
    const backNet = new THREE.Mesh(
      new THREE.PlaneGeometry(goalHalfW * 2, goalHeight),
      netMat,
    );
    backNet.position.set(0, goalHeight / 2, sz * (halfL + goalDepth));
    if (sz < 0) backNet.rotation.y = Math.PI;
    group.add(backNet);

    for (const sx of [-1, 1]) {
      const sideNet = new THREE.Mesh(
        new THREE.PlaneGeometry(goalDepth, goalHeight),
        netMat,
      );
      sideNet.position.set(sx * goalHalfW, goalHeight / 2, netCenterZ);
      sideNet.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      group.add(sideNet);
    }

    const topNet = new THREE.Mesh(
      new THREE.PlaneGeometry(goalHalfW * 2, goalDepth),
      netMat,
    );
    topNet.rotation.x = Math.PI / 2;
    topNet.position.set(0, goalHeight, netCenterZ);
    group.add(topNet);

    const goalFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(goalHalfW * 2, goalDepth),
      new THREE.MeshStandardMaterial({
        color: sz < 0 ? 0x071e38 : 0x331404,
        roughness: 0.55,
      }),
    );
    goalFloor.rotation.x = -Math.PI / 2;
    goalFloor.position.set(0, 0.015, netCenterZ);
    group.add(goalFloor);
  }

  // Glowing Perimeter LED Advertising Boards right above the curved ramp rim
  const ledAdTex = createLedAdBoardTexture(maxAnisotropy);
  const ledAdMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: ledAdTex,
    emissive: 0xffffff,
    emissiveMap: ledAdTex,
    emissiveIntensity: 1.05,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  const adSteps = [
    { offsetIn: -0.7, y: coveRadius + 0.2, ny: 0, nIn: 1, v: 0 },
    { offsetIn: -0.7, y: coveRadius + 4.4, ny: 0, nIn: 1, v: 1 },
  ];
  for (const arc of [rightArc, leftArc]) {
    group.add(new THREE.Mesh(buildSweepStripGeometry(arc, adSteps, 0.018), ledAdMat));
  }

  // Outer perimeter metallic structural pillars & illuminated multi-tier spectator grandstands
  for (const sx of [-1, 1]) {
    for (const pz of [-76, -28, 28, 76]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(1.25, 1.45, height + 6, 8),
        frameMat,
      );
      pillar.position.set(sx * (halfW + 2.2), height / 2, pz);
      group.add(pillar);
    }
  }

  const crowdTex = createCrowdStandTexture(maxAnisotropy);
  const standMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: crowdTex,
    emissive: 0xffffff,
    emissiveMap: crowdTex,
    emissiveIntensity: 0.78,
    roughness: 0.8,
    metalness: 0.15,
  });
  // Stepped side grandstands (3 ascending tiers on each side, scaled 1.8x)
  for (const sx of [-1, 1]) {
    for (let tier = 0; tier < 3; tier++) {
      const tierMesh = new THREE.Mesh(
        new THREE.BoxGeometry(11, 10 + tier * 3.5, halfL * 1.48),
        standMat,
      );
      tierMesh.position.set(
        sx * (halfW + 13 + tier * 10.5),
        7 + tier * 10.5,
        0,
      );
      group.add(tierMesh);
    }
  }
  // Wide corner grandstands seated flush outside the 45-degree corners for continuous bowl
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cornerStand = new THREE.Mesh(
        new THREE.BoxGeometry(68, 22, 15),
        standMat,
      );
      cornerStand.position.set(sx * (halfW - 3), 15, sz * (halfL - 3));
      cornerStand.rotation.y = sx * sz * (Math.PI / 4);
      group.add(cornerStand);
    }
  }

  // Instanced glowing crowd spectators in team colors along bleachers
  const crowdCount = 480;
  const specGeo = new THREE.BoxGeometry(0.95, 1.6, 0.8);
  const specMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const crowdInst = new THREE.InstancedMesh(specGeo, specMat, crowdCount);
  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();
  for (let i = 0; i < crowdCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const tier = Math.floor(i / 2) % 3;
    const rowT = ((i * 37) % 100) / 100;
    const zPos = (rowT - 0.5) * halfL * 1.4;
    dummy.position.set(
      side * (halfW + 11 + tier * 10.5 + ((i % 5) - 2) * 0.7),
      12.6 + tier * 10.5,
      zPos,
    );
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    crowdInst.setMatrixAt(i, dummy.matrix);
    const pick = i % 5;
    cColor.setHex(
      pick === 0
        ? 0x38bdf8
        : pick === 1
          ? 0xfb923c
          : pick === 2
            ? 0xf8fafc
            : pick === 3
              ? 0x0088ff
              : 0xfacc15,
    );
    crowdInst.setColorAt(i, cColor);
  }
  crowdInst.instanceMatrix.needsUpdate = true;
  if (crowdInst.instanceColor) crowdInst.instanceColor.needsUpdate = true;
  group.add(crowdInst);

  // Giant Scoreboard Screens at both ends
  const scoreboardCanvas = document.createElement('canvas');
  scoreboardCanvas.width = 512;
  scoreboardCanvas.height = 192;
  const scoreboardCtx = scoreboardCanvas.getContext('2d')!;
  const scoreboardTex = new THREE.CanvasTexture(scoreboardCanvas);
  scoreboardTex.colorSpace = THREE.SRGBColorSpace;
  scoreboardTex.anisotropy = maxAnisotropy;

  const screenMat = new THREE.MeshBasicMaterial({ map: scoreboardTex });
  for (const sz of [-1, 1]) {
    const backing = new THREE.Mesh(new THREE.BoxGeometry(46, 17, 2.0), frameMat);
    backing.position.set(0, 38, sz * (halfL + 7.2));
    group.add(backing);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(43, 15), screenMat);
    screen.position.set(0, 38, sz * (halfL + 6.0));
    if (sz > 0) screen.rotation.y = Math.PI;
    group.add(screen);
  }

  const updateScoreboard = (
    blueScore: number,
    orangeScore: number,
    timeSeconds: number,
    isOvertime: boolean,
  ) => {
    const ctx = scoreboardCtx;
    ctx.fillStyle = '#070d1b';
    ctx.fillRect(0, 0, 512, 192);

    ctx.fillStyle = '#0066dd';
    ctx.fillRect(16, 20, 140, 152);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(356, 20, 140, 152);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 92px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(blueScore), 86, 102);
    ctx.fillText(String(orangeScore), 426, 102);

    const mins = Math.floor(Math.max(0, timeSeconds) / 60);
    const secs = Math.floor(Math.max(0, timeSeconds) % 60);
    const timeStr = `${isOvertime ? '+' : ''}${mins}:${secs.toString().padStart(2, '0')}`;
    ctx.fillStyle = isOvertime ? '#facc15' : '#f8fafc';
    ctx.font = 'bold 54px monospace';
    ctx.fillText(timeStr, 256, 98);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isOvertime ? 'PRÓRROGA' : 'DFH STADIUM', 256, 148);

    scoreboardTex.needsUpdate = true;
  };
  updateScoreboard(0, 0, 180, false);

  // Boost Pads (6 big + 28 small)
  const boostPadMeshes: StadiumHandle['boostPadMeshes'] = [];
  const padBaseGeoBig = new THREE.CylinderGeometry(1.5, 1.8, 0.16, 18);
  const padBaseGeoSmall = new THREE.CylinderGeometry(0.95, 1.15, 0.12, 14);
  const orbGeo = new THREE.SphereGeometry(0.75, 14, 14);
  const padBaseMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.3,
  });

  for (const pad of pads) {
    const base = new THREE.Mesh(
      pad.isBig ? padBaseGeoBig : padBaseGeoSmall,
      padBaseMat,
    );
    base.position.set(pad.x, 0.08, pad.z);
    group.add(base);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(pad.isBig ? 0.95 : 0.52, pad.isBig ? 1.32 : 0.82, 18),
      ringMat,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pad.x, 0.17, pad.z);
    group.add(ring);

    let orbMesh: THREE.Mesh | undefined;
    if (pad.isBig) {
      orbMesh = new THREE.Mesh(
        orbGeo,
        new THREE.MeshStandardMaterial({
          color: 0xfde047,
          emissive: 0xff8800,
          emissiveIntensity: 2.0,
          roughness: 0.15,
        }),
      );
      orbMesh.position.set(pad.x, pad.y, pad.z);
      group.add(orbMesh);
    }

    boostPadMeshes.push({ padId: pad.id, orbMesh, ringMat });
  }

  // Dynamic Wall Impact Hex Flash Ring
  const wallImpactMat = new THREE.MeshBasicMaterial({
    color: 0x0088ff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const wallImpactMesh = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 5.5, 6),
    wallImpactMat,
  );
  group.add(wallImpactMesh);

  const dispose = () => {
    turfMap.dispose();
    turfRoughness.dispose();
    ledAdTex.dispose();
    crowdTex.dispose();
    hexTex.dispose();
    scoreboardTex.dispose();
    netTextures.forEach((t) => t.dispose());
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
        else m.material?.dispose();
      }
    });
  };

  return {
    group,
    scoreboardCanvas,
    scoreboardCtx,
    scoreboardTex,
    updateScoreboard,
    boostPadMeshes,
    wallImpactMat,
    wallImpactMesh,
    dispose,
  };
}

export function buildBallMesh(
  maxAnisotropy: number,
  shadowTex: THREE.Texture,
): {
  root: THREE.Group;
  sphere: THREE.Mesh;
  ledMat: THREE.MeshStandardMaterial;
  shadowPlane: THREE.Mesh;
  groundRingOuter: THREE.Mesh;
  groundRingInner: THREE.Mesh;
  dispose: () => void;
} {
  const root = new THREE.Group();
  const ballTex = createBallTexture(maxAnisotropy);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: ballTex,
    metalness: 0.62,
    roughness: 0.28,
  });
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(ARENA.ballRadius, 28, 20),
    sphereMat,
  );
  sphere.castShadow = true;
  root.add(sphere);

  // Team-reactive glowing equatorial ring
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x94a3b8,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const eqRing = new THREE.Mesh(
    new THREE.TorusGeometry(ARENA.ballRadius * 0.99, 0.08, 8, 32),
    ledMat,
  );
  sphere.add(eqRing);

  // Ground indicator concentric rings projected vertically onto turf
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const groundRingOuter = new THREE.Mesh(
    new THREE.RingGeometry(ARENA.ballRadius * 0.85, ARENA.ballRadius * 1.05, 32),
    ringMat,
  );
  groundRingOuter.rotation.x = -Math.PI / 2;

  const groundRingInner = new THREE.Mesh(
    new THREE.RingGeometry(0.25, 0.55, 24),
    ringMat.clone(),
  );
  groundRingInner.rotation.x = -Math.PI / 2;

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA.ballRadius * 3.2, ARENA.ballRadius * 3.2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;

  const dispose = () => {
    ballTex.dispose();
    sphere.geometry.dispose();
    sphereMat.dispose();
    ledMat.dispose();
    groundRingOuter.geometry.dispose();
    groundRingInner.geometry.dispose();
    shadowPlane.geometry.dispose();
  };

  return {
    root,
    sphere,
    ledMat,
    shadowPlane,
    groundRingOuter,
    groundRingInner,
    dispose,
  };
}

export { createContactShadowTexture };
