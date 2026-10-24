// Boîte à rythmes : sons de batterie synthétisés (Web Audio) et styles de rythmes.

export type DrumSound = 'kick' | 'snare' | 'clap' | 'rim' | 'hat' | 'openhat' | 'shaker' | 'click';

export interface RhythmPattern {
  id: string;
  name: string;
  beats: number; // temps par mesure
  steps: number; // pas par mesure (4 par temps)
  bpm: number; // tempo conseillé
  // une chaîne par son, un caractère par pas : 'x' = coup, 'X' = coup accentué, '.' = rien
  tracks: Partial<Record<DrumSound, string>>;
}

export const PATTERNS: RhythmPattern[] = [
  {
    id: 'metronome', name: 'Métronome', beats: 4, steps: 16, bpm: 90,
    tracks: { click: 'X...x...x...x...' },
  },
  {
    id: 'pop', name: 'Pop', beats: 4, steps: 16, bpm: 100,
    tracks: { kick: 'X......xx.x.....', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' },
  },
  {
    id: 'rock', name: 'Rock', beats: 4, steps: 16, bpm: 116,
    tracks: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hat: 'X.x.X.x.X.x.X.x.' },
  },
  {
    id: 'ballade', name: 'Ballade', beats: 4, steps: 16, bpm: 72,
    tracks: { kick: 'X.........x.....', rim: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  },
  {
    id: 'afro', name: 'Afro / Gospel', beats: 4, steps: 16, bpm: 104,
    tracks: {
      kick: 'X..x...xx..x....',
      clap: '....X.......X...',
      rim: '..x..x....x..x..',
      shaker: 'XxxxXxxxXxxxXxxx',
    },
  },
  {
    id: 'reggae', name: 'Reggae', beats: 4, steps: 16, bpm: 76,
    tracks: { kick: '........X.......', rim: '........x.......', hat: '..x...x...x...x.' },
  },
  {
    id: 'bossa', name: 'Bossa nova', beats: 4, steps: 16, bpm: 120,
    tracks: { kick: 'X..xx..xX..xx..x', rim: 'x..x..x...x..x..', hat: 'x.x.x.x.x.x.x.x.' },
  },
  {
    id: 'valse', name: 'Valse (3 temps)', beats: 3, steps: 12, bpm: 96,
    tracks: { kick: 'X...........', hat: '....x...x...', rim: '....x...x...' },
  },
  {
    id: 'disco', name: 'Disco', beats: 4, steps: 16, bpm: 118,
    tracks: { kick: 'X...X...X...X...', clap: '....X.......X...', openhat: '..x...x...x...x.' },
  },
];

export const patternById = (id: string) => PATTERNS.find((p) => p.id === id);

/** Durée d'un pas (secondes) */
export const stepDuration = (p: RhythmPattern, bpm: number) => ((60 / bpm) * p.beats) / p.steps;

export class DrumMachine {
  private out: GainNode;
  private noise: AudioBuffer;
  pattern: RhythmPattern = PATTERNS[0];
  bpm = 90;
  running = false;
  private step = 0;
  private nextTime = 0;
  /** Heure audio du début de la dernière mesure programmée (repère pour caler un enregistrement) */
  barStart = 0;
  /** Appelé pour chaque pas programmé (heure audio où il sonnera) */
  onStep?: (step: number, when: number) => void;

  constructor(private ctx: AudioContext, destination: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.7;
    this.out.connect(destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number) {
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setPattern(p: RhythmPattern) {
    if (p.steps !== this.pattern.steps) this.step = 0;
    this.pattern = p;
  }

  start() {
    this.running = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.barStart = this.nextTime;
  }

  stop() {
    this.running = false;
  }

  /** À appeler souvent (boucle d'animation) : programme les pas des ~120 prochaines ms */
  tick() {
    if (!this.running) return;
    const p = this.pattern;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      if (this.step === 0) this.barStart = this.nextTime;
      this.playStep(p, this.step, this.nextTime);
      this.onStep?.(this.step, this.nextTime);
      this.nextTime += stepDuration(p, this.bpm);
      this.step = (this.step + 1) % p.steps;
    }
  }

  /** Joue un pas d'un rythme à l'heure audio `when` */
  playStep(p: RhythmPattern, step: number, when: number) {
    for (const [sound, line] of Object.entries(p.tracks) as [DrumSound, string][]) {
      const c = line[step % line.length];
      if (c === 'x' || c === 'X') this.hit(sound, when, c === 'X' ? 1 : 0.65);
    }
  }

  private env(when: number, peak: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    g.connect(this.out);
    return g;
  }

  private noiseHit(when: number, peak: number, decay: number, type: BiquadFilterType, freq: number, q = 0.7) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(this.env(when, peak, decay));
    src.start(when, Math.random() * 0.5);
    src.stop(when + decay + 0.02);
  }

  private toneHit(when: number, peak: number, decay: number, type: OscillatorType, f0: number, f1 = f0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + decay * 0.6);
    o.connect(this.env(when, peak, decay));
    o.start(when);
    o.stop(when + decay + 0.02);
  }

  hit(sound: DrumSound, when: number, vel: number) {
    switch (sound) {
      case 'kick':
        this.toneHit(when, 0.9 * vel, 0.32, 'sine', 140, 42);
        this.noiseHit(when, 0.08 * vel, 0.015, 'lowpass', 2000);
        break;
      case 'snare':
        this.noiseHit(when, 0.42 * vel, 0.17, 'highpass', 1200);
        this.toneHit(when, 0.25 * vel, 0.08, 'triangle', 190, 160);
        break;
      case 'clap':
        for (const d of [0, 0.011, 0.023]) this.noiseHit(when + d, 0.32 * vel, 0.06, 'bandpass', 1400, 1.2);
        this.noiseHit(when + 0.03, 0.22 * vel, 0.16, 'bandpass', 1300, 1);
        break;
      case 'rim':
        this.toneHit(when, 0.3 * vel, 0.035, 'square', 1750);
        this.noiseHit(when, 0.12 * vel, 0.02, 'bandpass', 3000, 2);
        break;
      case 'hat':
        this.noiseHit(when, 0.16 * vel, 0.045, 'highpass', 7500);
        break;
      case 'openhat':
        this.noiseHit(when, 0.15 * vel, 0.28, 'highpass', 7000);
        break;
      case 'shaker':
        this.noiseHit(when, 0.09 * vel, 0.05, 'bandpass', 6500, 1.5);
        break;
      case 'click':
        this.toneHit(when, 0.3 * vel, 0.05, 'sine', vel > 0.9 ? 1760 : 1100);
        break;
    }
  }
}
