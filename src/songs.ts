// Morceaux intégrés (domaine public).
// Notation : "C4" = noire, "C4:2" = blanche, "C4+E4+G4:2" = accord, "R:1" = silence, "|" = barre de mesure.
import { parseNoteName, type Hand, type Song, type SongNote } from './notes';

function voice(src: string, hand: Hand, unitSec: number): SongNote[] {
  const out: SongNote[] = [];
  let beat = 0;
  for (const tok of src.trim().split(/\s+/)) {
    if (tok === '|') continue;
    const [pitch, durStr] = tok.split(':');
    const dur = durStr ? parseFloat(durStr) : 1;
    if (pitch !== 'R') {
      for (const p of pitch.split('+')) {
        out.push({
          midi: parseNoteName(p),
          start: Math.round(beat * unitSec * 1000) / 1000,
          dur: dur * unitSec * 0.92,
          hand,
        });
      }
    }
    beat += dur;
  }
  return out;
}

export interface Def {
  id: string;
  title: string;
  composer: string;
  level: number;
  bpm: number; // pulsations de l'unité de durée par minute
  right?: string;
  left?: string;
}

export function build(d: Def): Song {
  const unit = 60 / d.bpm;
  const notes = [
    ...(d.right ? voice(d.right, 'R', unit) : []),
    ...(d.left ? voice(d.left, 'L', unit) : []),
  ].sort((a, b) => a.start - b.start || a.midi - b.midi);
  return {
    id: d.id,
    title: d.title,
    composer: d.composer,
    level: d.level,
    notes,
    duration: Math.max(...notes.map((n) => n.start + n.dur)),
  };
}

const auClair = 'C4 C4 C4 D4 | E4:2 D4:2 | C4 E4 D4 D4 | C4:4 |';
const odeA = 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 |';
const odeLA = 'C3:2 E3:2 | G2:2 G3:2 | A2:2 C3:2 |';
const minuetA = 'D5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 | D5 G4 G4 | E5 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 | G5 G4 G4 | C5 D5:0.5 C5:0.5 B4:0.5 A4:0.5 | B4 C5:0.5 B4:0.5 A4:0.5 G4:0.5 |';
const minuetLA = 'G3+B3:3 | B3:3 | C4:3 | B3:3 | A3:3 | G3:3 |';

export const SONGS: Song[] = [
  build({
    id: 'gamme-do',
    title: 'Gamme de Do majeur',
    composer: 'Exercice',
    level: 1,
    bpm: 80,
    right: 'C4 D4 E4 F4 G4 A4 B4 C5 | C5 B4 A4 G4 F4 E4 D4 C4:2',
    left: 'C3 D3 E3 F3 G3 A3 B3 C4 | C4 B3 A3 G3 F3 E3 D3 C3:2',
  }),
  build({
    id: 'au-clair',
    title: 'Au clair de la lune',
    composer: 'Chanson traditionnelle',
    level: 1,
    bpm: 90,
    right: `${auClair} ${auClair} D4 D4 D4 D4 | A3:2 A3:2 | D4 C4 B3 A3 | G3:4 | ${auClair}`,
  }),
  build({
    id: 'frere-jacques',
    title: 'Frère Jacques',
    composer: 'Chanson traditionnelle',
    level: 1,
    bpm: 100,
    right:
      'C4 D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4:2 | E4 F4 G4:2 | ' +
      'G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 | G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 | C4 G3 C4:2 | C4 G3 C4:2',
    left: 'C3:4 | C3:4 | C3:4 | C3:4 | C3:4 | C3:4 | C3:2 G2:2 | C3:4',
  }),
  build({
    id: 'ah-vous-dirai-je',
    title: 'Ah ! vous dirai-je, maman',
    composer: 'Mozart (thème)',
    level: 2,
    bpm: 100,
    right:
      'C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | ' +
      'G4 G4 F4 F4 | E4 E4 D4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | ' +
      'C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2',
    left:
      'C3:4 | F3:2 C3:2 | F3:2 C3:2 | G2:2 C3:2 | ' +
      'C3:2 G2:2 | C3:2 G2:2 | C3:2 G2:2 | C3:2 G2:2 | ' +
      'C3:4 | F3:2 C3:2 | F3:2 C3:2 | G2:2 C3:2',
  }),
  build({
    id: 'ode-joie',
    title: 'Ode à la joie',
    composer: 'Beethoven',
    level: 2,
    bpm: 100,
    right:
      `${odeA} E4:1.5 D4:0.5 D4:2 | ${odeA} D4:1.5 C4:0.5 C4:2 | ` +
      'D4 D4 E4 C4 | D4 E4:0.5 F4:0.5 E4 C4 | D4 E4:0.5 F4:0.5 E4 D4 | C4 D4 G3:2 | ' +
      `${odeA} D4:1.5 C4:0.5 C4:2`,
    left:
      `${odeLA} G2:4 | ${odeLA} G2:2 C3:2 | ` +
      'G2:2 C3:2 | G2:2 C3:2 | G2:2 C3:2 | C3:2 G2:2 | ' +
      `${odeLA} G2:2 C3:2`,
  }),
  build({
    id: 'bella-ciao',
    title: 'Bella ciao',
    composer: 'Chanson populaire italienne',
    level: 2,
    bpm: 120,
    // 2 couplets ; phrases : « Una mattina… » / « o bella ciao… » / « una mattina… » / « e ho trovato l'invasor »
    right: [1, 2]
      .map(
        () =>
          'E4:0.5 A4:0.5 B4:0.5 C5:0.5 A4:2 | E4:0.5 A4:0.5 B4:0.5 C5:0.5 A4:2 | ' +
          'E4:0.5 A4:0.5 B4:0.5 C5 B4:0.5 A4:0.5 C5 B4:0.5 A4:0.5 E5 E5:0.5 D5:0.5 E5:0.5 F5:0.5 F5:2 | ' +
          'F5:0.5 E5:0.5 D5:0.5 F5:0.5 E5:2 | E5:0.5 D5:0.5 C5:0.5 E5:0.5 D5:2 | ' +
          'D5:0.5 C5:0.5 B4:0.5 E5:0.5 C5 B4 A4:2 |',
      )
      .join(' '),
    left: [1, 2].map(() => 'A2:4 A2:4 | A2:6.5 D3:4 | D3:4 A2:4 | E2:4 A2:2 |').join(' '),
  }),
  build({
    id: 'menuet-sol',
    title: 'Menuet en Sol',
    composer: 'Petzold (attr. Bach)',
    level: 3,
    bpm: 110,
    right:
      `${minuetA} F#4 G4:0.5 A4:0.5 B4:0.5 G4:0.5 | A4:3 | ` +
      `${minuetA} A4 B4:0.5 A4:0.5 G4:0.5 F#4:0.5 | G4:3`,
    left: `${minuetLA} D3+C4:3 | D3:3 | ${minuetLA} D3:3 | G2:3`,
  }),
  build({
    id: 'joyeux-anniversaire',
    title: 'Joyeux anniversaire',
    composer: 'Chanson traditionnelle',
    level: 1,
    bpm: 100,
    right:
      'G3:0.75 G3:0.25 | A3 G3 C4 | B3:2 G3:0.75 G3:0.25 | A3 G3 D4 | C4:2 G3:0.75 G3:0.25 | ' +
      'G4 E4 C4 | B3 A3 F4:0.75 F4:0.25 | E4 C4 D4 | C4:3',
    left: 'R:1 | C3:3 | G2:3 | G2:3 | C3:3 | C3:3 | F2:3 | C3:2 G2:1 | C3:3',
  }),
  build({
    id: 'vive-le-vent',
    title: 'Vive le vent (Jingle Bells)',
    composer: 'J. Pierpont',
    level: 2,
    bpm: 140,
    right:
      'E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4 D4 | E4:4 | F4 F4 F4 F4 | F4 E4 E4 E4:0.5 E4:0.5 | ' +
      'E4 D4 D4 E4 | D4:2 G4:2 | E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4 D4 | E4:4 | ' +
      'F4 F4 F4 F4 | F4 E4 E4 E4:0.5 E4:0.5 | G4 G4 F4 D4 | C4:4',
    left:
      'C3:4 | C3:4 | C3:4 | C3:4 | F2:4 | C3:4 | D3:4 | G2:4 | ' +
      'C3:4 | C3:4 | C3:4 | C3:4 | F2:4 | C3:4 | G2:4 | C3:4',
  }),
  build({
    id: 'douce-nuit',
    title: 'Douce nuit',
    composer: 'F. Gruber',
    level: 2,
    bpm: 90,
    right:
      'G4:1.5 A4:0.5 G4 | E4:3 | G4:1.5 A4:0.5 G4 | E4:3 | D5:2 D5 | B4:3 | C5:2 C5 | G4:3 | ' +
      'A4:2 A4 | C5:1.5 B4:0.5 A4 | G4:1.5 A4:0.5 G4 | E4:3 | A4:2 A4 | C5:1.5 B4:0.5 A4 | ' +
      'G4:1.5 A4:0.5 G4 | E4:3 | D5:2 D5 | F5:1.5 D5:0.5 B4 | C5:3 | E5:3 | ' +
      'C5:1.5 G4:0.5 E4 | G4:1.5 F4:0.5 D4 | C4:3',
    left:
      'C3:3 | C3:3 | C3:3 | C3:3 | G2:3 | G2:3 | C3:3 | C3:3 | F2:3 | F2:3 | C3:3 | C3:3 | ' +
      'F2:3 | F2:3 | C3:3 | C3:3 | G2:3 | G2:3 | C3:3 | C3:3 | C3:3 | G2:3 | C3:3',
  }),
  build({
    id: 'berceuse-brahms',
    title: 'Berceuse',
    composer: 'Brahms',
    level: 2,
    bpm: 90,
    right:
      'E4:0.5 E4:0.5 | G4:2 E4:0.5 E4:0.5 | G4:2 E4:0.5 G4:0.5 | C5 B4:1.5 A4:0.5 | A4 G4 D4:0.5 E4:0.5 | ' +
      'F4 D4 D4:0.5 E4:0.5 | F4:2 D4:0.5 F4:0.5 | B4 A4 G4 | B4 C5:2',
    left: 'R:1 | C3:3 | C3:3 | F2:3 | C3:3 | G2:3 | G2:3 | G2:3 | C3:3',
  }),
  build({
    id: 'petite-musique-nuit',
    title: 'Petite musique de nuit',
    composer: 'Mozart',
    level: 3,
    bpm: 120,
    right:
      'G4 R:0.5 D4:0.5 G4 R:0.5 D4:0.5 | G4:0.5 D4:0.5 G4:0.5 B4:0.5 D5:2 | ' +
      'C5 R:0.5 A4:0.5 C5 R:0.5 A4:0.5 | C5:0.5 A4:0.5 F#4:0.5 A4:0.5 D4:2',
    left: 'G2+G3:4 | G2+G3:2 G3+B3:2 | D3+F#3:4 | D3+F#3:2 D3:2',
  }),
  build({
    id: 'lettre-elise',
    title: 'Lettre à Élise (début)',
    composer: 'Beethoven',
    level: 3,
    bpm: 200, // unité = double croche
    right:
      'E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4:3 C4 E4 A4 | B4:3 E4 G#4 B4 | C5:3 E4 E5 D#5 | ' +
      'E5 D#5 E5 B4 D5 C5 | A4:3 C4 E4 A4 | B4:3 E4 C5 B4 | A4:4',
    left:
      'R:2 | R:6 | A2 E3 A3 R:3 | E2 E3 G#3 R:3 | A2 E3 A3 R:3 | ' +
      'R:6 | A2 E3 A3 R:3 | E2 E3 G#3 R:3 | A2 E3 A3',
  }),
];
