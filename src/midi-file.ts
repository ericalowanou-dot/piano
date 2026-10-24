// Lecture de fichiers .mid (Standard MIDI File, formats 0 et 1).
import type { Hand, Song, SongNote } from './notes';

interface RawNote {
  tick: number;
  endTick: number;
  midi: number;
  velocity: number;
  track: number;
}

class Reader {
  pos = 0;
  constructor(private v: DataView) {}
  get eof() {
    return this.pos >= this.v.byteLength;
  }
  u8() {
    return this.v.getUint8(this.pos++);
  }
  u16() {
    const x = this.v.getUint16(this.pos);
    this.pos += 2;
    return x;
  }
  u32() {
    const x = this.v.getUint32(this.pos);
    this.pos += 4;
    return x;
  }
  str(n: number) {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8());
    return s;
  }
  vlq() {
    let x = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8();
      x = (x << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return x;
  }
}

export function parseMidiFile(buffer: ArrayBuffer, fileName: string): Song {
  const r = new Reader(new DataView(buffer));
  if (r.str(4) !== 'MThd') throw new Error("Ce fichier n'est pas un fichier MIDI");
  const headerLen = r.u32();
  r.u16(); // format
  const nTracks = r.u16();
  const division = r.u16();
  r.pos = 8 + headerLen;

  const tempos: { tick: number; usPerQuarter: number }[] = [];
  const raw: RawNote[] = [];
  let title = '';

  for (let t = 0; t < nTracks && !r.eof; t++) {
    const id = r.str(4);
    const len = r.u32();
    const end = r.pos + len;
    if (id !== 'MTrk') {
      r.pos = end;
      continue;
    }
    let tick = 0;
    let status = 0;
    const open = new Map<number, { tick: number; velocity: number }[]>();
    while (r.pos < end) {
      tick += r.vlq();
      let b = r.u8();
      if (b === 0xff) {
        const type = r.u8();
        const l = r.vlq();
        if (type === 0x51 && l === 3) {
          tempos.push({ tick, usPerQuarter: (r.u8() << 16) | (r.u8() << 8) | r.u8() });
        } else if (type === 0x03 && !title && t === 0) {
          title = r.str(l).trim();
        } else r.pos += l;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        r.pos += r.vlq();
        continue;
      }
      let data1: number;
      if (b & 0x80) {
        status = b;
        data1 = r.u8();
      } else {
        data1 = b; // running status
        b = status;
      }
      const type = status & 0xf0;
      const channel = status & 0x0f;
      if (type === 0xc0 || type === 0xd0) continue; // 1 octet de données
      const data2 = r.u8();
      if (channel === 9) continue; // batterie
      const key = data1;
      if (type === 0x90 && data2 > 0) {
        const list = open.get(key) ?? [];
        list.push({ tick, velocity: data2 / 127 });
        open.set(key, list);
      } else if (type === 0x80 || (type === 0x90 && data2 === 0)) {
        const on = open.get(key)?.shift();
        if (on) raw.push({ tick: on.tick, endTick: tick, midi: key, velocity: on.velocity, track: t });
      }
    }
    r.pos = end;
  }

  if (!raw.length) throw new Error('Aucune note trouvée dans ce fichier');

  // Conversion ticks -> secondes avec la carte des tempos
  tempos.sort((a, b) => a.tick - b.tick);
  const toSeconds = (() => {
    if (division & 0x8000) {
      const fps = 256 - (division >> 8);
      const tpf = division & 0xff;
      return (tick: number) => tick / (fps * tpf);
    }
    const segs: { tick: number; sec: number; spt: number }[] = [];
    let sec = 0;
    let lastTick = 0;
    let spt = 0.5 / division;
    for (const tp of tempos) {
      sec += (tp.tick - lastTick) * spt;
      lastTick = tp.tick;
      spt = tp.usPerQuarter / 1e6 / division;
      segs.push({ tick: tp.tick, sec, spt });
    }
    if (!segs.length || segs[0].tick > 0) segs.unshift({ tick: 0, sec: 0, spt: 0.5 / division });
    return (tick: number) => {
      let s = segs[0];
      for (const x of segs) {
        if (x.tick <= tick) s = x;
        else break;
      }
      return s.sec + (tick - s.tick) * s.spt;
    };
  })();

  // Attribution des mains : 2 pistes -> piste la plus aiguë = main droite, sinon partage au Do central
  const byTrack = new Map<number, RawNote[]>();
  for (const n of raw) byTrack.set(n.track, [...(byTrack.get(n.track) ?? []), n]);
  const tracks = [...byTrack.entries()].map(([track, notes]) => ({
    track,
    avg: notes.reduce((s, n) => s + n.midi, 0) / notes.length,
  }));
  const handOf = (n: RawNote): Hand => {
    if (tracks.length === 2) {
      const high = tracks[0].avg >= tracks[1].avg ? tracks[0].track : tracks[1].track;
      return n.track === high ? 'R' : 'L';
    }
    return n.midi >= 60 ? 'R' : 'L';
  };

  const first = Math.min(...raw.map((n) => toSeconds(n.tick)));
  const notes: SongNote[] = raw
    .map((n) => {
      const start = toSeconds(n.tick) - first;
      return {
        midi: n.midi,
        start: Math.round(start * 1000) / 1000,
        dur: Math.max(0.05, toSeconds(n.endTick) - first - start),
        hand: handOf(n),
      };
    })
    .sort((a, b) => a.start - b.start || a.midi - b.midi);

  return {
    id: `import-${Date.now()}`,
    title: title || fileName.replace(/\.midi?$/i, ''),
    composer: 'Fichier importé',
    level: 0,
    notes,
    duration: Math.max(...notes.map((n) => n.start + n.dur)),
    imported: true,
  };
}
