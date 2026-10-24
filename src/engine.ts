// Moteur de jeu : avance du temps, mode attente, temps réel, écoute, score.
import type { Hand, Song, SongNote } from './notes';

export type Mode = 'wait' | 'realtime' | 'demo';
export type HandsSel = 'both' | 'R' | 'L';
export type NoteStatus = 'pending' | 'hit' | 'missed' | 'skipped';
export type InputResult = 'correct' | 'wrong' | 'free';

export interface NoteState {
  note: SongNote;
  status: NoteStatus;
  quality?: 'perfect' | 'good';
}

export interface Stats {
  correct: number;
  wrong: number;
  missed: number;
  perfect: number;
  streak: number;
  bestStreak: number;
  total: number; // notes à jouer par l'utilisateur
}

export interface Results extends Stats {
  score: number; // 0..100
  stars: number;
  mode: Mode;
}

export interface EngineEvents {
  autoNoteOn: (midi: number, hand: Hand) => void;
  autoNoteOff: (midi: number) => void;
  missed: (midi: number) => void;
  finished: (r: Results) => void;
}

const LEAD_IN = 2.5; // secondes avant la première note
const CHORD_TOL = 0.06; // notes d'un même accord
const WAIT_EARLY = 0.35; // on peut jouer un peu en avance en mode attente
const RT_WINDOW = 0.22; // fenêtre de tolérance en temps réel (secondes réelles)
const RT_PERFECT = 0.08;

export class Engine {
  song!: Song;
  states: NoteState[] = [];
  mode: Mode = 'wait';
  hands: HandsSel = 'both';
  speed = 1;
  time = -LEAD_IN;
  playing = false;
  waiting = false;
  finished = false;
  stats: Stats = this.emptyStats();
  /** notes jouées automatiquement en cours : midi -> fin (temps morceau) */
  autoSounding = new Map<number, { end: number; hand: Hand }>();
  private autoIdx = 0;

  constructor(private ev: EngineEvents) {}

  private emptyStats(): Stats {
    return { correct: 0, wrong: 0, missed: 0, perfect: 0, streak: 0, bestStreak: 0, total: 0 };
  }

  load(song: Song) {
    this.song = song;
    this.states = song.notes.map((note) => ({ note, status: 'pending' }));
    this.restart();
  }

  isActive(n: SongNote) {
    if (this.mode === 'demo') return false;
    return this.hands === 'both' || this.hands === n.hand;
  }

  restart() {
    this.seek(0);
    this.playing = false;
  }

  seek(songTime: number) {
    this.releaseAuto();
    const from = Math.max(0, songTime);
    this.time = from === 0 ? -LEAD_IN : from - 1.5;
    for (const s of this.states) {
      s.status = s.note.start + 0.001 < from ? 'skipped' : 'pending';
      s.quality = undefined;
    }
    this.autoIdx = this.states.findIndex((s) => s.note.start >= this.time);
    if (this.autoIdx < 0) this.autoIdx = this.states.length;
    this.stats = this.emptyStats();
    this.stats.total = this.states.filter((s) => s.status === 'pending' && this.isActive(s.note)).length;
    this.waiting = false;
    this.finished = false;
  }

  /** Changement de mode / main : on garde la position */
  reconfigure() {
    const wasPlaying = this.playing;
    this.seek(Math.max(0, this.time + 1.5));
    this.playing = wasPlaying;
  }

  play() {
    if (this.finished) this.restart();
    this.playing = true;
  }

  pause() {
    this.playing = false;
    this.releaseAuto();
  }

  get progress() {
    return Math.max(0, Math.min(1, this.time / this.song.duration));
  }

  /** Accord actuellement attendu en mode attente */
  currentGroup(): NoteState[] {
    let first: NoteState | undefined;
    for (const s of this.states) {
      if (s.status === 'pending' && this.isActive(s.note)) {
        first = s;
        break;
      }
    }
    if (!first) return [];
    const t0 = first.note.start;
    return this.states.filter(
      (s) => s.status === 'pending' && this.isActive(s.note) && Math.abs(s.note.start - t0) <= CHORD_TOL,
    );
  }

  update(dt: number) {
    if (!this.playing) return;
    let next = this.time + dt * this.speed;
    let autoLimit = next;

    if (this.mode === 'wait') {
      const group = this.currentGroup();
      this.waiting = false;
      if (group.length) {
        const t0 = Math.min(...group.map((s) => s.note.start));
        if (next >= t0) {
          next = t0;
          // l'autre main attend aussi que l'accord soit joué
          autoLimit = t0 - CHORD_TOL - 0.001;
          this.waiting = true;
        }
      }
    } else if (this.mode === 'realtime') {
      const window = RT_WINDOW * this.speed;
      for (const s of this.states) {
        if (s.note.start > next) break;
        if (s.status === 'pending' && this.isActive(s.note) && s.note.start < next - window) {
          s.status = 'missed';
          this.stats.missed++;
          this.stats.streak = 0;
          this.ev.missed(s.note.midi);
        }
      }
    }

    // Notes jouées automatiquement (autre main ou mode écoute)
    while (this.autoIdx < this.states.length && this.states[this.autoIdx].note.start <= autoLimit) {
      const s = this.states[this.autoIdx++];
      if (s.status === 'pending' && !this.isActive(s.note)) {
        s.status = 'hit';
        this.autoSounding.set(s.note.midi, { end: s.note.start + s.note.dur, hand: s.note.hand });
        this.ev.autoNoteOn(s.note.midi, s.note.hand);
      }
    }
    for (const [midi, a] of this.autoSounding) {
      if (a.end <= next) {
        this.autoSounding.delete(midi);
        this.ev.autoNoteOff(midi);
      }
    }

    this.time = next;
    if (this.time > this.song.duration + 1) this.finish();
  }

  userNoteOn(midi: number): InputResult {
    if (!this.playing || this.mode === 'demo') return 'free';

    if (this.mode === 'wait') {
      const group = this.currentGroup();
      if (group.length && this.time >= group[0].note.start - WAIT_EARLY) {
        const target = group.find((s) => s.note.midi === midi);
        if (target) {
          target.status = 'hit';
          target.quality = 'perfect';
          this.registerHit(true);
          return 'correct';
        }
      }
      return this.registerWrong();
    }

    // Temps réel : note de même hauteur la plus proche dans la fenêtre
    const window = RT_WINDOW * this.speed;
    let best: NoteState | undefined;
    let bestDelta = Infinity;
    for (const s of this.states) {
      if (s.note.start > this.time + window) break;
      if (s.status !== 'pending' || s.note.midi !== midi || !this.isActive(s.note)) continue;
      const d = Math.abs(s.note.start - this.time);
      if (d <= window && d < bestDelta) {
        best = s;
        bestDelta = d;
      }
    }
    if (best) {
      const perfect = bestDelta <= RT_PERFECT * this.speed;
      best.status = 'hit';
      best.quality = perfect ? 'perfect' : 'good';
      this.registerHit(perfect);
      return 'correct';
    }
    return this.registerWrong();
  }

  private registerHit(perfect: boolean) {
    this.stats.correct++;
    if (perfect) this.stats.perfect++;
    this.stats.streak++;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
  }

  private registerWrong(): InputResult {
    this.stats.wrong++;
    this.stats.streak = 0;
    return 'wrong';
  }

  get liveScore(): number {
    const s = this.stats;
    if (this.mode === 'realtime') {
      const done = s.correct + s.missed;
      if (!done) return 100;
      const pts = s.perfect + (s.correct - s.perfect) * 0.7;
      return Math.max(0, Math.round((100 * pts) / (done + s.wrong * 0.5)));
    }
    const tries = s.correct + s.wrong;
    return tries ? Math.round((100 * s.correct) / tries) : 100;
  }

  private finish() {
    this.playing = false;
    this.finished = true;
    this.waiting = false;
    this.releaseAuto();
    const score = this.mode === 'demo' ? 0 : this.liveScore;
    const stars = score >= 95 ? 3 : score >= 80 ? 2 : score >= 60 ? 1 : 0;
    this.ev.finished({ ...this.stats, score, stars, mode: this.mode });
  }

  private releaseAuto() {
    for (const midi of this.autoSounding.keys()) this.ev.autoNoteOff(midi);
    this.autoSounding.clear();
  }
}
