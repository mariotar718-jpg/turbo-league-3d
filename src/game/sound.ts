import { Rarity } from './catalog';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  // Continuous vehicle loops
  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private boostNoiseSrc: AudioBufferSourceNode | null = null;
  private boostFilter: BiquadFilterNode | null = null;
  private boostSubOsc: OscillatorNode | null = null;
  private boostGain: GainNode | null = null;

  private driftNoiseSrc: AudioBufferSourceNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;
  private driftLfo: OscillatorNode | null = null;
  private driftGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.72;
      this.masterGain.connect(this.ctx.destination);
      this.buildNoiseBuffer();
      this.initContinuousLoops();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : 0.72,
        this.ctx.currentTime,
        0.04,
      );
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private buildNoiseBuffer(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    // Pink-tinted white noise
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }
    this.noiseBuffer = buffer;
  }

  private initContinuousLoops(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    // 1. Engine Sawtooth + Dynamic Lowpass
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(60, t);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(220, t);
    this.engineFilter.Q.setValueAtTime(3.2, t);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0, t);

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();

    // 2. Boost Noise + Sub Oscillator
    this.boostNoiseSrc = this.ctx.createBufferSource();
    this.boostNoiseSrc.buffer = this.noiseBuffer;
    this.boostNoiseSrc.loop = true;

    this.boostFilter = this.ctx.createBiquadFilter();
    this.boostFilter.type = 'bandpass';
    this.boostFilter.frequency.setValueAtTime(280, t);
    this.boostFilter.Q.setValueAtTime(1.4, t);

    this.boostSubOsc = this.ctx.createOscillator();
    this.boostSubOsc.type = 'triangle';
    this.boostSubOsc.frequency.setValueAtTime(92, t);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.4, t);

    this.boostGain = this.ctx.createGain();
    this.boostGain.gain.setValueAtTime(0, t);

    this.boostNoiseSrc.connect(this.boostFilter);
    this.boostFilter.connect(this.boostGain);
    this.boostSubOsc.connect(subGain);
    subGain.connect(this.boostGain);
    this.boostGain.connect(this.masterGain);
    this.boostNoiseSrc.start();
    this.boostSubOsc.start();

    // 3. Powerslide Screech (Modulated Bandpass)
    this.driftNoiseSrc = this.ctx.createBufferSource();
    this.driftNoiseSrc.buffer = this.noiseBuffer;
    this.driftNoiseSrc.loop = true;

    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.setValueAtTime(1650, t);
    this.driftFilter.Q.setValueAtTime(6.0, t);

    this.driftLfo = this.ctx.createOscillator();
    this.driftLfo.frequency.setValueAtTime(28, t);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(260, t);
    this.driftLfo.connect(lfoGain);
    lfoGain.connect(this.driftFilter.frequency);

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.setValueAtTime(0, t);

    this.driftNoiseSrc.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.masterGain);
    this.driftNoiseSrc.start();
    this.driftLfo.start();
  }

  public updateVehicleAudio(params: {
    active: boolean;
    speedRatio: number; // 0..1
    grounded: boolean;
    boosting: boolean;
    drifting: boolean;
  }): void {
    if (!this.ctx || !this.engineOsc || !this.engineFilter || !this.engineGain) return;
    const t = this.ctx.currentTime;

    if (!params.active) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.06);
      this.boostGain?.gain.setTargetAtTime(0, t, 0.05);
      this.driftGain?.gain.setTargetAtTime(0, t, 0.04);
      return;
    }

    const r = Math.max(0, Math.min(1, params.speedRatio));
    const freq = 55 + r * 185 + (params.grounded ? 0 : 18);
    const cutoff = 180 + r * 720;
    const engVol = 0.06 + r * 0.09;

    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.04);
    this.engineFilter.frequency.setTargetAtTime(cutoff, t, 0.05);
    this.engineGain.gain.setTargetAtTime(engVol, t, 0.06);

    if (this.boostGain && this.boostFilter && this.boostSubOsc) {
      this.boostGain.gain.setTargetAtTime(params.boosting ? 0.34 : 0, t, 0.04);
      this.boostFilter.frequency.setTargetAtTime(
        params.boosting ? 240 + r * 260 : 200,
        t,
        0.05,
      );
      this.boostSubOsc.frequency.setTargetAtTime(85 + r * 45, t, 0.05);
    }

    if (this.driftGain) {
      const screech = params.drifting && params.grounded && r > 0.18 ? 0.14 * r : 0;
      this.driftGain.gain.setTargetAtTime(screech, t, 0.04);
    }
  }

  public silenceMatchLoops(): void {
    this.updateVehicleAudio({
      active: false,
      speedRatio: 0,
      grounded: true,
      boosting: false,
      drifting: false,
    });
  }

  public playBallHit(intensity: number): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const gainVal = Math.max(0.12, Math.min(0.85, intensity));

    // Low bass thump 180Hz -> 35Hz
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.16);
    g.gain.setValueAtTime(gainVal * 0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.23);

    // Metallic click transient
    const click = this.ctx.createOscillator();
    const cg = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(920 + intensity * 400, t);
    click.frequency.exponentialRampToValueAtTime(240, t + 0.05);
    cg.gain.setValueAtTime(gainVal * 0.28, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    click.connect(cg);
    cg.connect(this.masterGain);
    click.start(t);
    click.stop(t + 0.07);
  }

  public playJump(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(310, t + 0.11);
    g.gain.setValueAtTime(0.26, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  public playFlip(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, t);
    filter.frequency.exponentialRampToValueAtTime(160, t + 0.25);
    filter.Q.setValueAtTime(1.8, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.27);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.28);
  }

  public playFlipReset(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    // Crystalline electric chime triad confirming infinite flip reset
    [880, 1174.66, 1567.98].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.032);
      g.gain.setValueAtTime(0.24, t + i * 0.032);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.032 + 0.28);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + i * 0.032);
      osc.stop(t + i * 0.032 + 0.3);
    });
  }

  public playPinch(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    // Punchy metallic crack + low boom
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.24);
    og.gain.setValueAtTime(0.55, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.26);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1900, t);
    hp.Q.setValueAtTime(1.5, t);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.45, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(hp);
    hp.connect(ng);
    ng.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.24);
  }

  public playWaveDash(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.14);
    og.gain.setValueAtTime(0.28, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  public playMustyFlick(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(640, t + 0.18);
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  public playBoostPickup(isBig: boolean): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const notes = isBig ? [587.33, 880, 1174.66] : [523.25, 783.99];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.055);
      g.gain.setValueAtTime(0.18, t + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.055 + 0.2);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + i * 0.055);
      osc.stop(t + i * 0.055 + 0.22);
    });
  }

  public playCountdownBeep(isGo: boolean): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = isGo ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, t);
    g.gain.setValueAtTime(isGo ? 0.28 : 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (isGo ? 0.42 : 0.18));
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + (isGo ? 0.45 : 0.2));
  }

  public playGoalExplosion(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    // Stadium horn chord
    [130.81, 196.0, 261.63].forEach((freq) => {
      if (!this.ctx || !this.masterGain) return;
      const horn = this.ctx.createOscillator();
      const hg = this.ctx.createGain();
      horn.type = 'sawtooth';
      horn.frequency.setValueAtTime(freq, t);
      hg.gain.setValueAtTime(0.001, t);
      hg.gain.linearRampToValueAtTime(0.16, t + 0.06);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 1.45);
      horn.connect(hg);
      hg.connect(this.masterGain);
      horn.start(t);
      horn.stop(t + 1.5);
    });

    // Multi-frequency explosion with simulated reverb tail
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(950, t);
    lp.frequency.exponentialRampToValueAtTime(110, t + 1.2);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.65, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(this.masterGain);
    src.start(t);
    src.stop(t + 1.35);
  }

  public playDemoBoom(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.45);
    sg.gain.setValueAtTime(0.7, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    sub.connect(sg);
    sg.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.52);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + 0.65);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.55, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.68);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(this.masterGain);
    src.start(t);
    src.stop(t + 0.7);
  }

  public playUiClick(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.045);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  public playCrateTick(pitchScale = 1): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 * pitchScale, t);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  public playCrateReveal(rarity: Rarity): void {
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const chordMap: Record<Rarity, number[]> = {
      Común: [261.63, 329.63, 392.0],
      Raro: [293.66, 369.99, 440.0],
      'Muy Raro': [329.63, 415.3, 493.88, 659.25],
      Importado: [349.23, 440.0, 523.25, 698.46],
      Exótico: [392.0, 493.88, 587.33, 783.99, 987.77],
      'Mercado Negro': [261.63, 392.0, 523.25, 659.25, 783.99, 1046.5],
    };
    const notes = chordMap[rarity] ?? chordMap.Raro;
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = rarity === 'Mercado Negro' || rarity === 'Exótico' ? 'sawtooth' : 'triangle';
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2200, t);
      const start = t + idx * 0.05;
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.12, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.95);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 1.0);
    });
  }
}

export const soundEngine = new SoundEngine();
