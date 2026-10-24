// Écriture d'un morceau en fichier .mid (format 1 : une piste par main, lisible par parseMidiFile).
import { instrumentById } from './instruments';
import type { Hand, Song } from './notes';

const PPQ = 480; // ticks par noire
const TEMPO_US = 500000; // 120 noires par minute -> 1 seconde = 960 ticks
const ticks = (sec: number) => Math.round((sec * 1e6 * PPQ) / TEMPO_US);

function vlq(n: number): number[] {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}

function chunk(id: string, body: number[]): number[] {
  const len = body.length;
  return [...id].map((c) => c.charCodeAt(0)).concat([len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255], body);
}

function text(type: number, s: string): number[] {
  const bytes = [...new TextEncoder().encode(s)];
  return [0, 0xff, type, ...vlq(bytes.length), ...bytes];
}

function handTrack(song: Song, hand: Hand, channel: number): number[] {
  const events: { tick: number; on: boolean; midi: number }[] = [];
  for (const n of song.notes) {
    if (n.hand !== hand) continue;
    events.push({ tick: ticks(n.start), on: true, midi: n.midi });
    events.push({ tick: ticks(n.start + n.dur), on: false, midi: n.midi });
  }
  // à tick égal, on relâche avant d'enfoncer (notes répétées)
  events.sort((a, b) => a.tick - b.tick || Number(a.on) - Number(b.on));
  const body = text(0x03, hand === 'R' ? 'Main droite' : 'Main gauche');
  // instrument General MIDI (les autres logiciels de musique le reconnaissent)
  body.push(0, 0xc0 | channel, instrumentById(song.instrument ?? 'piano').gm);
  let last = 0;
  for (const e of events) {
    body.push(...vlq(e.tick - last), (e.on ? 0x90 : 0x80) | channel, e.midi, e.on ? 90 : 0);
    last = e.tick;
  }
  body.push(0, 0xff, 0x2f, 0);
  return chunk('MTrk', body);
}

export function songToMidi(song: Song): Uint8Array {
  const tempo = [...text(0x03, song.title), 0, 0xff, 0x51, 3, TEMPO_US >> 16, (TEMPO_US >> 8) & 255, TEMPO_US & 255,
    0, 0xff, 0x2f, 0];
  const hands = (['R', 'L'] as Hand[]).filter((h) => song.notes.some((n) => n.hand === h));
  const header = chunk('MThd', [0, 1, 0, 1 + hands.length, PPQ >> 8, PPQ & 255]);
  return new Uint8Array([...header, ...chunk('MTrk', tempo), ...hands.flatMap((h, i) => handTrack(song, h, i))]);
}

/** Nom de fichier sûr à partir du titre */
export function midiFileName(song: Song): string {
  const base = song.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-');
  return `${base.replace(/^-+|-+$/g, '').toLowerCase() || 'morceau'}.mid`;
}
