// Boîte à rythmes : sons de batterie synthétisés (Web Audio) et styles de rythmes.

export type DrumSound =
  | 'kick' | 'snare' | 'clap' | 'rim' | 'hat' | 'openhat' | 'ride' | 'shaker' | 'tamb'
  | 'tom' | 'congaHi' | 'congaLo' | 'cowbell' | 'bell' | 'log' | 'click';

export type RhythmGroup = 'Bases' | 'Afrique' | 'Gospel' | 'Caraïbes & Amérique latine' | 'Pop & urbain';

export interface RhythmPattern {
  id: string;
  name: string;
  group: RhythmGroup;
  beats: number; // temps par mesure (ou sur les 2 mesures du motif)
  steps: number; // pas sur la durée du motif (4 par temps, 3 pour un rythme ternaire)
  bpm: number; // tempo conseillé
  // une chaîne par son, un caractère par pas : 'x' = coup, 'X' = coup accentué, '.' = rien
  tracks: Partial<Record<DrumSound, string>>;
}

/** Les espaces dans les motifs ne servent qu'à la lisibilité (un groupe = un temps) */
function rhythm(
  id: string, name: string, group: RhythmGroup, bpm: number,
  tracks: Partial<Record<DrumSound, string>>, beats = 4,
): RhythmPattern {
  const clean = Object.fromEntries(Object.entries(tracks).map(([k, v]) => [k, v.replace(/\s/g, '')]));
  const steps = Object.values(clean)[0].length;
  return { id, name, group, beats, steps, bpm, tracks: clean };
}

// Motifs simplifiés, inspirés des rythmes typiques de chaque style.
// Les identifiants ne doivent pas changer : ils sont enregistrés avec les morceaux.
export const PATTERNS: RhythmPattern[] = [
  // ---- Bases
  rhythm('metronome', 'Métronome (4 temps)', 'Bases', 90, { click: 'X... x... x... x...' }),
  rhythm('metronome3', 'Métronome (3 temps)', 'Bases', 90, { click: 'X... x... x...' }, 3),
  rhythm('ballade', 'Ballade', 'Bases', 72, {
    kick: 'X... .... ..x. ....', rim: '.... x... .... x...', hat: 'x.x. x.x. x.x. x.x.',
  }),
  rhythm('valse', 'Valse (3 temps)', 'Bases', 96, {
    kick: 'X... .... ....', hat: '.... x... x...', rim: '.... x... x...',
  }, 3),

  // ---- Afrique
  rhythm('seben', 'Seben (soukous)', 'Afrique', 138, {
    kick: 'X... x... X... x...', snare: '.... X..x .... X.x.', hat: 'x.xx x.xx x.xx x.xx',
    congaHi: '..x. .... ..x. ..x.',
  }),
  rhythm('rumba', 'Rumba congolaise', 'Afrique', 112, {
    kick: 'X... .... X... ....', rim: 'x..x ..x. ..x. x...', hat: 'x.x. x.x. x.x. x.x.',
    congaHi: '..x. .... ..x. ....', congaLo: '.... ..x. .... ..x.',
  }),
  rhythm('ndombolo', 'Ndombolo', 'Afrique', 124, {
    kick: 'X... X... X... X...', snare: '.... X... .... X..x', hat: 'xxxx xxxx xxxx xxxx',
    tamb: '..x. ..x. ..x. ..x.',
  }),
  rhythm('coupe-decale', 'Coupé-décalé', 'Afrique', 128, {
    kick: 'X... X... X... X...', clap: '.... X... .... X...', hat: 'x.xx x.xx x.xx x.xx',
    congaHi: '..x. .x.. ..x. .x..', congaLo: '...x .... ...x ..x.',
  }),
  rhythm('zouglou', 'Zouglou', 'Afrique', 100, {
    kick: 'X... ..x. X... ....', rim: '..x. ..x. ..x. ..x.', congaLo: 'x..x .... x..x ....',
    tamb: '.... X... .... X...',
  }),
  rhythm('makossa', 'Makossa', 'Afrique', 118, {
    kick: 'X... X... X... X...', snare: '.... X... .... X...', openhat: '..X. ..X. ..X. ..X.',
    rim: 'x.x. .x.x ..x. x..x',
  }),
  rhythm('highlife', 'Highlife', 'Afrique', 120, {
    kick: 'X... .... X.x. ....', rim: '.... x... .... x...', bell: 'x..x ..x. ..x. x...',
    hat: 'x.x. x.x. x.x. x.x.', congaHi: '...x ...x ...x ..x.',
  }),
  rhythm('afro', 'Afrobeats', 'Afrique', 104, {
    kick: 'X..x ...x x..x ....', clap: '.... X... .... X...', rim: '..x. .x.. ..x. .x..',
    shaker: 'Xxxx Xxxx Xxxx Xxxx',
  }),
  rhythm('afrobeat', 'Afrobeat (Fela)', 'Afrique', 112, {
    kick: 'X..x .... X.x. ....', snare: '.... x..x .x.. x...', hat: 'xxxx xxxx xxxx xxxx',
    cowbell: 'x.x. .x.x .x.. x.x.',
  }),
  rhythm('amapiano', 'Amapiano', 'Afrique', 112, {
    kick: 'X... X... X... X...', shaker: 'x.xx x.xx x.xx x.xx', log: 'X..x ..x. ..x. x...',
    clap: '.... X... .... X...',
  }),
  rhythm('bikutsi', 'Bikutsi (6/8)', 'Afrique', 140, {
    kick: 'X..... X.....', hat: 'xxxxxx xxxxxx', snare: '...x.. ...x..', rim: 'x.x.x. x.x.x.',
  }, 2),
  rhythm('mbalax', 'Mbalax', 'Afrique', 122, {
    kick: 'X..x ..x. X..x ..x.', congaHi: 'x.xx .x.x x.xx .x.x', congaLo: '...x .... ...x ....',
    tamb: '.... x... .... x...',
  }),

  // ---- Gospel
  rhythm('louange', 'Louange (rapide)', 'Gospel', 120, {
    kick: 'X... X... X... X...', clap: '.... X... .... X...', tamb: 'x.x. x.x. x.x. x.x.',
  }),
  rhythm('adoration', 'Adoration (lente, 12/8)', 'Gospel', 66, {
    kick: 'X.. ... x.. ...', snare: '... X.. ... X..', hat: 'x.x x.x x.x x.x',
  }),

  // ---- Caraïbes & Amérique latine
  rhythm('zouk', 'Zouk', 'Caraïbes & Amérique latine', 92, {
    kick: 'X... ...x X... ....', snare: '.... X... .... X...', rim: 'x..x ..x. x..x ..x.',
    hat: 'x.x. x.x. x.x. x.x.',
  }),
  rhythm('kompa', 'Kompa', 'Caraïbes & Amérique latine', 118, {
    kick: 'X..x .... X..x ....', snare: '.... X... .... X...', cowbell: '..x. ..x. ..x. ..x.',
    hat: 'x.x. x.x. x.x. x.x.',
  }),
  rhythm('reggae', 'Reggae', 'Caraïbes & Amérique latine', 76, {
    kick: '.... .... X... ....', rim: '.... .... x... ....', hat: '..x. ..x. ..x. ..x.',
  }),
  rhythm('dancehall', 'Dancehall', 'Caraïbes & Amérique latine', 98, {
    kick: 'X..x ..x. X..x ..x.', snare: '.... X... .... X...', hat: 'x.x. x.x. x.x. x.x.',
  }),
  rhythm('salsa', 'Salsa (clave 3-2)', 'Caraïbes & Amérique latine', 180, {
    rim: 'x... ..x. .... x... .... x... x... ....',
    cowbell: 'X... x... x... x... X... x... x... x...',
    congaHi: '.... .... .... ..xx .... .... .... ..xx',
    congaLo: '.... x... .... x... .... x... .... x...',
    kick: '.... .... ..x. .... .... .... ..x. ....',
  }, 8),
  rhythm('bossa', 'Bossa nova', 'Caraïbes & Amérique latine', 120, {
    kick: 'X..x x..x X..x x..x', rim: 'x..x ..x. ..x. .x..', hat: 'x.x. x.x. x.x. x.x.',
  }),
  rhythm('samba', 'Samba', 'Caraïbes & Amérique latine', 100, {
    kick: 'X..x X..x X..x X..x', tamb: 'Xxxx Xxxx Xxxx Xxxx', rim: 'x.x. .x.x .x.x .x..',
  }),
  rhythm('cumbia', 'Cumbia', 'Caraïbes & Amérique latine', 96, {
    kick: 'X... .... X... ....', shaker: 'x.xx x.xx x.xx x.xx', congaHi: '..x. ..x. ..x. ..x.',
    rim: '.... x... .... x...',
  }),
  rhythm('merengue', 'Merengue', 'Caraïbes & Amérique latine', 128, {
    kick: 'X... X... X... X...', tamb: 'xxxx xxxx xxxx xxxx', congaHi: 'x.x. x.xx x.x. x.xx',
  }),
  rhythm('bachata', 'Bachata', 'Caraïbes & Amérique latine', 126, {
    kick: 'X... .... X... ....', congaHi: 'x.xx x.xx x.xx x.xx', rim: '..x. ..x. ..x. ..x.',
  }),

  // ---- Pop & urbain
  rhythm('pop', 'Pop', 'Pop & urbain', 100, {
    kick: 'X... ...x x.x. ....', snare: '.... X... .... X...', hat: 'x.x. x.x. x.x. x.x.',
  }),
  rhythm('rock', 'Rock', 'Pop & urbain', 116, {
    kick: 'X... ..x. X.x. ....', snare: '.... X... .... X...', hat: 'X.x. X.x. X.x. X.x.',
  }),
  rhythm('hiphop', 'Hip-hop', 'Pop & urbain', 90, {
    kick: 'X... ...x ..X. ....', snare: '.... X... .... X...', hat: 'x.x. x.x. x.x. x.x.',
  }),
  rhythm('rnb', 'R&B', 'Pop & urbain', 72, {
    kick: 'X... ..x. .x.. ....', snare: '.... X... .... X...', hat: 'xxxx xxxx xxxx xxxx',
  }),
  rhythm('trap', 'Trap', 'Pop & urbain', 140, {
    kick: 'X... .... .... .... .... ..x. X... ....',
    snare: '.... .... .... .... X... .... .... ....',
    hat: 'x.x. x.x. x.x. x.x. x.x. xxxx x.x. xxxx',
  }),
  rhythm('funk', 'Funk', 'Pop & urbain', 100, {
    kick: 'X.x. ...x ..x. .x..', snare: '.... X..x .x.. X...', hat: 'xxxx xxxx xxxx xxxx',
  }),
  rhythm('disco', 'Disco', 'Pop & urbain', 118, {
    kick: 'X... X... X... X...', clap: '.... X... .... X...', openhat: '..x. ..x. ..x. ..x.',
  }),
  rhythm('afrohouse', 'Afro house', 'Pop & urbain', 122, {
    kick: 'X... X... X... X...', clap: '.... X... .... X...', openhat: '..x. ..x. ..x. ..x.',
    congaHi: '...x ..x. ...x .x..', shaker: 'xxxx xxxx xxxx xxxx',
  }),
  rhythm('blues', 'Blues (shuffle)', 'Pop & urbain', 90, {
    kick: 'X.. ... X.. ...', snare: '... X.. ... X..', hat: 'x.x x.x x.x x.x',
  }),
  rhythm('jazz', 'Jazz (swing)', 'Pop & urbain', 130, {
    ride: 'X.. x.x X.. x.x', hat: '... x.. ... x..', kick: 'x.. ... ... ...',
  }),
];

export const RHYTHM_GROUPS: RhythmGroup[] = ['Bases', 'Afrique', 'Gospel', 'Caraïbes & Amérique latine', 'Pop & urbain'];

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
      case 'ride':
        this.noiseHit(when, 0.1 * vel, 0.45, 'bandpass', 5200, 1.5);
        this.toneHit(when, 0.05 * vel, 0.35, 'sine', 3100);
        break;
      case 'tamb':
        this.noiseHit(when, 0.13 * vel, 0.11, 'highpass', 8500);
        this.noiseHit(when + 0.012, 0.07 * vel, 0.08, 'bandpass', 6000, 3);
        break;
      case 'tom':
        this.toneHit(when, 0.55 * vel, 0.3, 'sine', 170, 110);
        break;
      case 'congaHi':
        this.toneHit(when, 0.42 * vel, 0.17, 'sine', 400, 340);
        this.noiseHit(when, 0.06 * vel, 0.02, 'bandpass', 2500);
        break;
      case 'congaLo':
        this.toneHit(when, 0.48 * vel, 0.22, 'sine', 260, 210);
        this.noiseHit(when, 0.05 * vel, 0.02, 'bandpass', 1800);
        break;
      case 'cowbell':
        for (const f of [545, 815]) this.toneHit(when, 0.12 * vel, 0.25, 'square', f);
        break;
      case 'bell': // cloche africaine (gankogui, agogo)
        this.toneHit(when, 0.22 * vel, 0.32, 'sine', 1240);
        this.toneHit(when, 0.08 * vel, 0.18, 'sine', 3310);
        break;
      case 'log': // log drum de l'amapiano : basse percussive grave
        this.toneHit(when, 0.75 * vel, 0.45, 'triangle', 98, 62);
        this.toneHit(when, 0.3 * vel, 0.3, 'sine', 196, 124);
        break;
    }
  }
}
