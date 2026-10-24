// Utilitaires autour des numéros de notes MIDI (60 = Do central = C4).

export type Hand = 'L' | 'R';

export interface SongNote {
  midi: number;
  start: number; // secondes à vitesse 100 %
  dur: number; // secondes à vitesse 100 %
  hand: Hand;
}

export interface Song {
  id: string;
  title: string;
  composer: string;
  level: number; // 1 à 5
  notes: SongNote[];
  duration: number;
  imported?: boolean;
  /** Accompagnement de batterie enregistré avec le morceau (start = début d'une mesure, en secondes) */
  rhythm?: { pattern: string; bpm: number; start: number };
}

export type Notation = 'latin' | 'english';

// Altérations les plus courantes sur les partitions : Mi♭ et Si♭ plutôt que Ré# et La#
const LATIN = ['Do', 'Do#', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Si♭', 'Si'];
const ENGLISH = ['C', 'C#', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B♭', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);

export const isBlack = (midi: number) => BLACK.has(((midi % 12) + 12) % 12);

export function noteName(midi: number, notation: Notation, withOctave = true): string {
  const pc = ((midi % 12) + 12) % 12;
  const name = (notation === 'latin' ? LATIN : ENGLISH)[pc];
  return withOctave ? `${name}${Math.floor(midi / 12) - 1}` : name;
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4", "F#3", "Bb2" -> numéro MIDI */
export function parseNoteName(s: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error(`Note invalide : ${s}`);
  let pc = PC[m[1]];
  if (m[2] === '#') pc++;
  if (m[2] === 'b') pc--;
  return 12 * (parseInt(m[3], 10) + 1) + pc;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
