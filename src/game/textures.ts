import * as THREE from 'three';

export function createStadiumTurfTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const W = 1536;
  const H = 1536;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 1. Alternating rich stadium mowing stripes + subtle radial stadium sheen
  const stripes = 22;
  const stripeH = H / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#185929' : '#227236';
    ctx.fillRect(0, i * stripeH, W, stripeH);
  }

  // Subtle cross-stripe weave for realism
  for (let x = 0; x < W; x += 96) {
    ctx.fillStyle = (x / 96) % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.025)';
    ctx.fillRect(x, 0, 96, H);
  }

  // 2. Thousands of organic micro grass blades (dark/light/emerald)
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 18000; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const tone = rand();
    ctx.fillStyle =
      tone < 0.34
        ? 'rgba(14, 52, 22, 0.36)'
        : tone < 0.72
          ? 'rgba(56, 152, 74, 0.28)'
          : 'rgba(130, 210, 110, 0.16)';
    ctx.fillRect(x, y, 1.8, 4.5 + rand() * 3.5);
  }

  // 3. Subtle wear & dirt scuffs near both goal mouths & center kickoff spot
  const drawWearPatch = (cx: number, cy: number, rx: number, ry: number, alpha: number) => {
    const grad = ctx.createRadialGradient(cx, cy, rx * 0.12, cx, cy, rx);
    grad.addColorStop(0, `rgba(92, 68, 42, ${alpha})`);
    grad.addColorStop(0.55, `rgba(74, 62, 38, ${alpha * 0.55})`);
    grad.addColorStop(1, 'rgba(74, 62, 38, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  drawWearPatch(W / 2, 108, 280, 125, 0.34);
  drawWearPatch(W / 2, H - 108, 280, 125, 0.34);
  drawWearPatch(W / 2, H / 2, 125, 125, 0.14);

  // 4. Crisp official pitch lines following rounded octagonal arena footprint
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 10;

  const mx = 62;
  const mz = 44;
  const cutX = 278;
  const cutZ = 198;

  ctx.beginPath();
  ctx.moveTo(mx + cutX, mz);
  ctx.lineTo(W - mx - cutX, mz);
  ctx.quadraticCurveTo(W - mx - cutX * 0.4, mz, W - mx, mz + cutZ);
  ctx.lineTo(W - mx, H - mz - cutZ);
  ctx.quadraticCurveTo(W - mx - cutX * 0.4, H - mz, W - mx - cutX, H - mz);
  ctx.lineTo(mx + cutX, H - mz);
  ctx.quadraticCurveTo(mx + cutX * 0.4, H - mz, mx, H - mz - cutZ);
  ctx.lineTo(mx, mz + cutZ);
  ctx.quadraticCurveTo(mx + cutX * 0.4, mz, mx + cutX, mz);
  ctx.closePath();
  ctx.stroke();

  // Midfield line & circle
  ctx.beginPath();
  ctx.moveTo(mx, H / 2);
  ctx.lineTo(W - mx, H / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 165, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 14, 0, Math.PI * 2);
  ctx.fill();

  // Blue half (-Z = top of UV) & Orange half (+Z = bottom) widened for +35% wider 31.4m goals
  ctx.strokeStyle = 'rgba(0, 152, 255, 0.94)';
  ctx.lineWidth = 11;
  ctx.strokeRect(W / 2 - 420, mz, 840, 320);
  ctx.strokeRect(W / 2 - 240, mz, 480, 145);

  ctx.strokeStyle = 'rgba(255, 112, 0, 0.94)';
  ctx.strokeRect(W / 2 - 420, H - mz - 320, 840, 320);
  ctx.strokeRect(W / 2 - 240, H - mz - 145, 480, 145);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  // 5. Matching linear RoughnessMap so floodlights shimmer across mowing stripes & worn patches
  const rW = 1024;
  const rH = 1024;
  const rCanvas = document.createElement('canvas');
  rCanvas.width = rW;
  rCanvas.height = rH;
  const rCtx = rCanvas.getContext('2d')!;
  const rStripeH = rH / stripes;
  for (let i = 0; i < stripes; i++) {
    const val = i % 2 === 0 ? 186 : 220; // 0.73 vs 0.86 roughness
    rCtx.fillStyle = `rgb(${val},${val},${val})`;
    rCtx.fillRect(0, i * rStripeH, rW, rStripeH);
  }
  for (let i = 0; i < 9000; i++) {
    const rx = rand() * rW;
    const ry = rand() * rH;
    const v = rand() > 0.5 ? 236 : 162;
    rCtx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    rCtx.fillRect(rx, ry, 2, 4);
  }
  // Slightly smoother worn dirt near goal mouths
  const rGoalGradTop = rCtx.createRadialGradient(rW / 2, 64, 15, rW / 2, 64, 160);
  rGoalGradTop.addColorStop(0, 'rgba(135,135,135,0.55)');
  rGoalGradTop.addColorStop(1, 'rgba(135,135,135,0)');
  rCtx.fillStyle = rGoalGradTop;
  rCtx.fillRect(0, 0, rW, 240);

  const rGoalGradBot = rCtx.createRadialGradient(rW / 2, rH - 64, 15, rW / 2, rH - 64, 160);
  rGoalGradBot.addColorStop(0, 'rgba(135,135,135,0.55)');
  rGoalGradBot.addColorStop(1, 'rgba(135,135,135,0)');
  rCtx.fillStyle = rGoalGradBot;
  rCtx.fillRect(0, rH - 240, rW, 240);

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap };
}

export function createCarbonFiberTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c111a';
  ctx.fillRect(0, 0, size, size);

  const cell = 8;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const diag = ((x / cell + y / cell) % 4 + 4) % 4;
      const g = ctx.createLinearGradient(x, y, x + cell, y + cell);
      if (diag < 2) {
        g.addColorStop(0, '#202938');
        g.addColorStop(0.5, '#121822');
        g.addColorStop(1, '#0b0f17');
      } else {
        g.addColorStop(0, '#10151f');
        g.addColorStop(0.5, '#263142');
        g.addColorStop(1, '#141b26');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cell - 0.5, cell - 0.5);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createLedAdBoardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#04142c');
  grad.addColorStop(0.25, '#072a54');
  grad.addColorStop(0.5, '#0a162a');
  grad.addColorStop(0.75, '#461a05');
  grad.addColorStop(1, '#04142c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 128);

  // Top & bottom neon accent borders
  ctx.fillStyle = '#00aaff';
  ctx.fillRect(0, 4, 512, 6);
  ctx.fillStyle = '#ff6600';
  ctx.fillRect(512, 4, 512, 6);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, 118, 1024, 6);

  const panels = [
    { text: 'TURBO LEAGUE', color: '#38bdf8' },
    { text: 'DFH STADIUM', color: '#ffffff' },
    { text: 'NITRO PRO', color: '#fb923c' },
    { text: 'SUPERSONIC', color: '#facc15' },
  ];
  ctx.font = 'italic 900 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  panels.forEach((p, idx) => {
    const cx = idx * 256 + 128;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(idx * 256 + 8, 16, 240, 96);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, cx, 66);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(3, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCrowdStandTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070d19';
  ctx.fillRect(0, 0, 512, 256);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Tiered bleacher steps + illuminated crowd bokeh dots
  for (let row = 0; row < 16; row++) {
    const ry = row * 16;
    ctx.fillStyle = row % 2 === 0 ? '#0d172b' : '#111e36';
    ctx.fillRect(0, ry, 512, 14);
    for (let c = 0; c < 46; c++) {
      const cx = c * 11 + rand() * 6;
      const pick = rand();
      ctx.fillStyle =
        pick < 0.34
          ? 'rgba(56, 189, 248, 0.78)'
          : pick < 0.68
            ? 'rgba(251, 146, 60, 0.78)'
            : pick < 0.9
              ? 'rgba(226, 232, 240, 0.65)'
              : 'rgba(250, 204, 21, 0.85)';
      ctx.beginPath();
      ctx.arc(cx, ry + 7, 2.2 + rand() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(4, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createHeadlightBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(219, 234, 254, 0.85)');
  grad.addColorStop(0.35, 'rgba(186, 230, 253, 0.35)');
  grad.addColorStop(0.75, 'rgba(147, 197, 253, 0.08)');
  grad.addColorStop(1, 'rgba(147, 197, 253, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGoalNetTexture(
  glowHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(6, 12, 24, 0.35)';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = glowHex;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.85;
  const step = 32;
  for (let i = -256; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i, 256);
    ctx.lineTo(i + 256, 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createHexWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(8, 18, 36, 0.25)';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(148, 210, 255, 0.35)';
  ctx.lineWidth = 2.5;

  const r = 32;
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);

  for (let col = -1; col < 14; col++) {
    for (let row = -1; row < 14; row++) {
      const cx = col * dx;
      const cy = row * dy + (col % 2 === 0 ? 0 : dy * 0.5);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 4);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, '#cbd5e1');
  grad.addColorStop(0.5, '#64748b');
  grad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Geometric tech panels
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 6;
  for (let x = 0; x < 512; x += 64) {
    for (let y = 0; y < 256; y += 64) {
      ctx.strokeRect(x + 4, y + 4, 56, 56);
      ctx.fillStyle = (x / 64 + y / 64) % 2 === 0 ? '#1e293b' : '#475569';
      ctx.fillRect(x + 14, y + 14, 36, 36);
    }
  }

  // Glowing equatorial LED stripe
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 120, 512, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface DynamicDecalHandle {
  texture: THREE.CanvasTexture;
  isAnimated: boolean;
  update: (time: number) => void;
  dispose: () => void;
}

export function createCarDecalTexture(
  decalId: string,
  primaryHex: string,
  secondaryHex: string,
  maxAnisotropy: number,
): DynamicDecalHandle {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  const isAnimated =
    decalId === 'decal_interstellar' ||
    decalId === 'decal_dissolver' ||
    decalId === 'decal_shockwave';

  const drawStatic = () => {
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 256, 256);

    if (decalId === 'decal_stripes') {
      ctx.fillStyle = secondaryHex;
      ctx.fillRect(92, 0, 24, 256);
      ctx.fillRect(140, 0, 24, 256);
    } else if (decalId === 'decal_flames') {
      ctx.fillStyle = secondaryHex;
      for (let i = 0; i < 6; i++) {
        const bx = i * 44;
        ctx.beginPath();
        ctx.moveTo(bx, 256);
        ctx.quadraticCurveTo(bx + 12, 130, bx + 22, 50 + (i % 2) * 35);
        ctx.quadraticCurveTo(bx + 32, 130, bx + 44, 256);
        ctx.fill();
      }
    } else if (decalId === 'decal_pearlescent') {
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, primaryHex);
      grad.addColorStop(0.5, secondaryHex);
      grad.addColorStop(1, primaryHex);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    texture.needsUpdate = true;
  };

  drawStatic();

  const update = (time: number) => {
    if (!isAnimated) return;
    if (decalId === 'decal_interstellar') {
      const grad = ctx.createLinearGradient(
        Math.sin(time * 0.6) * 128 + 128,
        0,
        Math.cos(time * 0.5) * 128 + 128,
        256,
      );
      grad.addColorStop(0, '#090d26');
      grad.addColorStop(0.45, primaryHex);
      grad.addColorStop(0.75, secondaryHex);
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 36; i++) {
        const sx = ((i * 73 + time * 35) % 256 + 256) % 256;
        const sy = ((i * 41 + time * 18) % 256 + 256) % 256;
        const size = (i % 3) + 1;
        ctx.fillRect(sx, sy, size, size);
      }
    } else if (decalId === 'decal_dissolver') {
      ctx.fillStyle = primaryHex;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = secondaryHex;
      for (let y = 0; y < 256; y += 18) {
        const offset = Math.sin(y * 0.06 + time * 3.8) * 32;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(0, y, 256, 7);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(64 + offset, y + 4, 128, 5);
      }
      ctx.globalAlpha = 1;
    } else if (decalId === 'decal_shockwave') {
      ctx.fillStyle = primaryHex;
      ctx.fillRect(0, 0, 256, 256);
      const pulseY = ((time * 160) % 256 + 256) % 256;
      const grad = ctx.createLinearGradient(0, pulseY - 40, 0, pulseY + 40);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, secondaryHex);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, pulseY - 40, 256, 80);
    }
    texture.needsUpdate = true;
  };

  return {
    texture,
    isAnimated,
    update,
    dispose: () => texture.dispose(),
  };
}
