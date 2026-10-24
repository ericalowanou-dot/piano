// Instruments synthétisés : chaque instrument est décrit par son timbre (harmoniques),
// son enveloppe (attaque, extinction), son filtre et ses effets (vibrato, souffle, attaque bruitée).

export interface InstrumentDef {
  id: string;
  name: string;
  group: 'Claviers' | 'Vents' | 'Cordes' | 'Percussions' | 'Voix';
  gm: number; // numéro d'instrument General MIDI (export / import .mid)
  harmonics: number[]; // amplitude de chaque harmonique (indice 1 = fondamentale)
  detune: number[]; // un oscillateur par valeur (cents) : léger désaccord = son plus riche
  gain: number;
  attack: number; // secondes
  drop: { level: number; tc: number }; // après l'attaque, descend vers level (constante de temps tc)
  /** Extinction naturelle (cordes frappées ou pincées) ; null = son tenu tant que la touche est enfoncée */
  tail: { low: number; high: number; at: number } | null;
  release: number; // secondes après le relâchement
  filter: { start: number; vel: number; peak?: number; peakTime?: number; sustain: number; tc: number; q?: number };
  vibrato?: { rate: number; depth: number; delay: number }; // Hz, cents, secondes
  scoop?: number; // la note commence quelques cents plus bas et glisse (cuivres, saxophone)
  breath?: number; // souffle continu (vents, voix)
  click?: number; // bruit d'attaque (marteau, plectre, mailloche)
}

const saw = (n: number) => [0, ...Array.from({ length: n }, (_, i) => 1 / (i + 1))];

export const INSTRUMENTS: InstrumentDef[] = [
  // ---- Claviers
  {
    id: 'piano', name: 'Piano', group: 'Claviers', gm: 0,
    harmonics: [0, 1, 0.55, 0.3, 0.22, 0.12, 0.09, 0.05, 0.035, 0.02, 0.012], detune: [-2.5, 2.5],
    gain: 0.28, attack: 0.004, drop: { level: 0.4, tc: 0.12 }, tail: { low: 3.2, high: 0.6, at: 0.35 }, release: 0.09,
    filter: { start: 4, vel: 10, sustain: 2.5, tc: 0.9 }, click: 0.05,
  },
  {
    id: 'epiano', name: 'Piano électrique', group: 'Claviers', gm: 4,
    harmonics: [0, 1, 0.12, 0.25, 0.05, 0.08, 0.02], detune: [-3, 3],
    gain: 0.3, attack: 0.003, drop: { level: 0.55, tc: 0.25 }, tail: { low: 3, high: 0.8, at: 0.3 }, release: 0.12,
    filter: { start: 3, vel: 8, sustain: 2, tc: 0.5 }, vibrato: { rate: 4.5, depth: 4, delay: 0 }, click: 0.02,
  },
  {
    id: 'organ', name: 'Orgue', group: 'Claviers', gm: 16,
    harmonics: [0, 1, 0.9, 0.5, 0.7, 0.1, 0.45, 0.05, 0.5, 0, 0.2, 0, 0.25], detune: [-1.5, 1.5],
    gain: 0.13, attack: 0.008, drop: { level: 0.9, tc: 0.05 }, tail: null, release: 0.05,
    filter: { start: 12, vel: 0, sustain: 12, tc: 0.1 }, vibrato: { rate: 6.5, depth: 7, delay: 0 }, click: 0.02,
  },
  {
    id: 'accordion', name: 'Accordéon', group: 'Claviers', gm: 21,
    harmonics: [0, 1, 0.85, 0.65, 0.55, 0.45, 0.35, 0.25, 0.2, 0.15], detune: [-10, 10],
    gain: 0.12, attack: 0.05, drop: { level: 0.85, tc: 0.1 }, tail: null, release: 0.07,
    filter: { start: 5, vel: 1, sustain: 6, tc: 0.2 }, breath: 0.015,
  },
  {
    id: 'synth', name: 'Synthé', group: 'Claviers', gm: 81,
    harmonics: saw(14), detune: [-9, 9],
    gain: 0.12, attack: 0.01, drop: { level: 0.75, tc: 0.2 }, tail: null, release: 0.18,
    filter: { start: 2, vel: 2, peak: 10, peakTime: 0.03, sustain: 4, tc: 0.3, q: 3 },
    vibrato: { rate: 5.5, depth: 6, delay: 0.5 },
  },

  // ---- Vents
  {
    id: 'flute', name: 'Flûte', group: 'Vents', gm: 73,
    harmonics: [0, 1, 0.25, 0.1, 0.04, 0.02], detune: [0, 1],
    gain: 0.17, attack: 0.07, drop: { level: 0.85, tc: 0.15 }, tail: null, release: 0.12,
    filter: { start: 4, vel: 2, sustain: 4, tc: 0.2 }, vibrato: { rate: 5, depth: 14, delay: 0.25 },
    scoop: -15, breath: 0.05,
  },
  {
    id: 'trumpet', name: 'Trompette', group: 'Vents', gm: 56,
    harmonics: [0, 1, 0.9, 0.75, 0.62, 0.5, 0.4, 0.32, 0.25, 0.2, 0.15, 0.1, 0.07], detune: [-2, 2],
    gain: 0.14, attack: 0.035, drop: { level: 0.8, tc: 0.12 }, tail: null, release: 0.08,
    filter: { start: 1.5, vel: 1, peak: 8, peakTime: 0.07, sustain: 5, tc: 0.25, q: 1.2 },
    vibrato: { rate: 5.5, depth: 10, delay: 0.3 }, scoop: -35, breath: 0.01,
  },
  {
    id: 'sax', name: 'Saxophone', group: 'Vents', gm: 65,
    harmonics: [0, 1, 0.65, 0.75, 0.45, 0.5, 0.3, 0.25, 0.15, 0.12, 0.08], detune: [-3, 3],
    gain: 0.14, attack: 0.04, drop: { level: 0.8, tc: 0.15 }, tail: null, release: 0.1,
    filter: { start: 2, vel: 1, peak: 6, peakTime: 0.06, sustain: 4, tc: 0.3, q: 1.5 },
    vibrato: { rate: 5, depth: 16, delay: 0.35 }, scoop: -45, breath: 0.035,
  },

  // ---- Cordes
  {
    id: 'strings', name: 'Cordes (violons)', group: 'Cordes', gm: 48,
    harmonics: saw(16), detune: [-7, 0, 7],
    gain: 0.1, attack: 0.14, drop: { level: 0.85, tc: 0.3 }, tail: null, release: 0.3,
    filter: { start: 3, vel: 1, sustain: 5, tc: 0.4 }, vibrato: { rate: 5.5, depth: 14, delay: 0.2 },
  },
  {
    id: 'guitar', name: 'Guitare', group: 'Cordes', gm: 24,
    harmonics: [0, 1, 0.75, 0.45, 0.32, 0.25, 0.16, 0.1, 0.07, 0.04], detune: [-1.5, 1.5],
    gain: 0.3, attack: 0.002, drop: { level: 0.5, tc: 0.08 }, tail: { low: 2.2, high: 0.5, at: 0.15 }, release: 0.12,
    filter: { start: 9, vel: 6, sustain: 2.2, tc: 0.25 }, click: 0.06,
  },
  {
    id: 'harp', name: 'Harpe', group: 'Cordes', gm: 46,
    harmonics: [0, 1, 0.3, 0.12, 0.05, 0.02], detune: [-1, 1],
    gain: 0.3, attack: 0.003, drop: { level: 0.6, tc: 0.15 }, tail: { low: 3.5, high: 1, at: 0.2 }, release: 0.4,
    filter: { start: 6, vel: 4, sustain: 2, tc: 0.4 }, click: 0.02,
  },
  {
    id: 'kora', name: 'Kora', group: 'Cordes', gm: 107,
    harmonics: [0, 1, 0.6, 0.42, 0.28, 0.2, 0.12, 0.08], detune: [-2, 2],
    gain: 0.28, attack: 0.002, drop: { level: 0.55, tc: 0.1 }, tail: { low: 2.4, high: 0.8, at: 0.15 }, release: 0.3,
    filter: { start: 12, vel: 6, sustain: 3, tc: 0.3, q: 1.5 }, click: 0.05,
  },
  {
    id: 'bass', name: 'Basse', group: 'Cordes', gm: 33,
    harmonics: [0, 1, 0.5, 0.25, 0.12, 0.06], detune: [-1, 1],
    gain: 0.4, attack: 0.004, drop: { level: 0.6, tc: 0.12 }, tail: { low: 2.5, high: 1, at: 0.2 }, release: 0.08,
    filter: { start: 5, vel: 3, sustain: 1.6, tc: 0.25 }, click: 0.03,
  },

  // ---- Percussions mélodiques
  {
    id: 'balafon', name: 'Balafon / Marimba', group: 'Percussions', gm: 12,
    harmonics: [0, 1, 0, 0, 0.35, 0, 0, 0, 0, 0.12], detune: [-2, 2],
    gain: 0.32, attack: 0.002, drop: { level: 0.35, tc: 0.05 }, tail: { low: 1, high: 0.3, at: 0.06 }, release: 0.1,
    filter: { start: 10, vel: 6, sustain: 4, tc: 0.1 }, click: 0.1,
  },

  // ---- Voix
  {
    id: 'choir', name: 'Chœur (« aah »)', group: 'Voix', gm: 52,
    harmonics: [0, 1, 0.75, 0.9, 0.55, 0.3, 0.35, 0.2, 0.12, 0.08, 0.05], detune: [-9, 0, 9],
    gain: 0.1, attack: 0.2, drop: { level: 0.85, tc: 0.3 }, tail: null, release: 0.35,
    filter: { start: 3, vel: 1, sustain: 4.5, tc: 0.4, q: 1 }, vibrato: { rate: 5, depth: 12, delay: 0.2 },
    breath: 0.02,
  },
];

export const INSTRUMENT_GROUPS: InstrumentDef['group'][] = ['Claviers', 'Vents', 'Cordes', 'Percussions', 'Voix'];

export const instrumentById = (id: string) => INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];

// Instrument le plus proche pour chaque famille General MIDI (les familles vont par 8 numéros)
const GM_FAMILIES = [
  'piano', 'balafon', 'organ', 'guitar', 'bass', 'strings', 'strings', 'trumpet',
  'sax', 'flute', 'synth', 'synth', 'synth', 'kora', 'balafon', 'piano',
];

/** Instrument correspondant à un numéro General MIDI (à défaut : le plus proche de sa famille) */
export function instrumentFromGm(program: number): InstrumentDef {
  const exact = INSTRUMENTS.find((i) => i.gm === program);
  if (exact) return exact;
  if (program >= 52 && program <= 54) return instrumentById('choir'); // voix
  return instrumentById(GM_FAMILIES[Math.floor(program / 8)] ?? 'piano');
}
