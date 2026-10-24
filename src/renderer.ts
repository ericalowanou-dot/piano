// Dessin sur canvas : notes qui tombent + clavier.
import type { Engine, NoteState } from './engine';
import { isBlack, noteName, type Hand, type Notation } from './notes';

export interface KeyRect {
  midi: number;
  x: number;
  w: number;
  h: number;
  black: boolean;
}

export type KeyFeedback = 'good' | 'bad' | 'free';

/** Note jouée en jeu libre (temps en secondes, end = null tant que la touche est tenue) */
export interface TrailNote {
  midi: number;
  start: number;
  end: number | null;
}

export interface ViewState {
  pressed: Map<number, KeyFeedback>;
  notation: Notation;
  showNoteNames: boolean;
  showKeyHints: boolean;
  computerKeys: Map<number, string>; // midi -> touche du clavier d'ordinateur
  /** Touche d'ordinateur à afficher sur une note qui tombe (null = rien) */
  keyForNote: (s: NoteState) => string | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const COLORS = {
  R: { fill: '#4f9dff', glow: '#8fc2ff', dark: '#2b5fae' },
  L: { fill: '#ff9f43', glow: '#ffc58a', dark: '#b8661c' },
  good: '#3ddc84',
  bad: '#ff5c6c',
  free: '#b48cff',
};

const VISIBLE_SECONDS = 3.2;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  keys: KeyRect[] = [];
  private byMidi = new Map<number, KeyRect>();
  lo = 48;
  hi = 83;
  private particles: Particle[] = [];
  private flashes = new Map<number, number>(); // midi -> intensité du flash d'impact

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  get keyboardHeight() {
    return Math.min(190, Math.max(110, this.h * 0.24));
  }

  get hitY() {
    return this.h - this.keyboardHeight;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.layout();
  }

  setRange(lo: number, hi: number) {
    this.lo = lo;
    this.hi = hi;
    this.layout();
  }

  private layout() {
    this.keys = [];
    this.byMidi.clear();
    let whites = 0;
    for (let m = this.lo; m <= this.hi; m++) if (!isBlack(m)) whites++;
    const ww = this.w / whites;
    const kh = this.keyboardHeight;
    let x = 0;
    for (let m = this.lo; m <= this.hi; m++) {
      let k: KeyRect;
      if (isBlack(m)) {
        const bw = ww * 0.6;
        k = { midi: m, x: x - bw / 2, w: bw, h: kh * 0.62, black: true };
      } else {
        k = { midi: m, x, w: ww, h: kh, black: false };
        x += ww;
      }
      this.keys.push(k);
      this.byMidi.set(m, k);
    }
  }

  /** Touche sous le pointeur (coordonnées CSS), clavier uniquement */
  hitTest(px: number, py: number): number | null {
    const top = this.hitY;
    if (py < top) return null;
    const y = py - top;
    for (const k of this.keys) if (k.black && px >= k.x && px <= k.x + k.w && y <= k.h) return k.midi;
    for (const k of this.keys) if (!k.black && px >= k.x && px < k.x + k.w) return k.midi;
    return null;
  }

  burst(midi: number, kind: 'good' | 'bad') {
    const k = this.byMidi.get(midi);
    if (!k) return;
    this.flashes.set(midi, 1);
    const color = kind === 'good' ? COLORS.good : COLORS.bad;
    const n = kind === 'good' ? 14 : 6;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: k.x + k.w / 2 + (Math.random() - 0.5) * k.w * 0.6,
        y: this.hitY,
        vx: (Math.random() - 0.5) * 140,
        vy: -60 - Math.random() * 220,
        life: 1,
        color,
      });
    }
  }

  /** `free` : jeu libre, on dessine les notes jouées qui montent au lieu du morceau */
  draw(engine: Engine, view: ViewState, dt: number, free?: { trail: TrailNote[]; now: number }) {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackground();
    if (free) this.drawRising(free.trail, free.now);
    else {
      this.drawNotes(engine, view);
      this.drawHitLine(engine);
    }
    this.drawParticles(dt);
    this.drawKeyboard(engine, view, !free);
  }

  private drawRising(trail: TrailNote[], now: number) {
    const { ctx } = this;
    const pps = this.hitY / VISIBLE_SECONDS;
    for (const n of trail) {
      const k = this.byMidi.get(n.midi);
      if (!k) continue;
      const top = this.hitY - (now - n.start) * pps;
      const bottom = n.end === null ? this.hitY : this.hitY - (now - n.end) * pps;
      if (bottom < 0) continue;
      const pad = k.black ? 1 : 2;
      const x = k.x + pad;
      const w = k.w - pad * 2;
      const c = COLORS[n.midi < 60 ? 'L' : 'R'];
      ctx.globalAlpha = n.end === null ? 1 : 0.75;
      if (n.end === null) {
        ctx.shadowColor = c.glow;
        ctx.shadowBlur = 16;
      }
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, c.dark);
      g.addColorStop(1, c.fill);
      ctx.fillStyle = g;
      roundRect(ctx, x, Math.max(top, -10), w, Math.max(4, bottom - Math.max(top, -10)), Math.min(6, w / 3));
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  private drawBackground() {
    const { ctx, w } = this;
    const hy = this.hitY;
    const g = ctx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, '#0d1020');
    g.addColorStop(1, '#151a33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, hy);

    // couloirs : un léger fond sous chaque touche noire, ligne à chaque Do et Fa
    for (const k of this.keys) {
      if (k.black) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(k.x, 0, k.w, hy);
      }
      const pc = k.midi % 12;
      if (!k.black && (pc === 0 || pc === 5)) {
        ctx.fillStyle = pc === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(Math.round(k.x), 0, 1, hy);
      }
    }
  }

  private noteRect(engine: Engine, start: number, dur: number) {
    const pps = this.hitY / VISIBLE_SECONDS;
    const bottom = this.hitY - (start - engine.time) * pps;
    const top = bottom - Math.max(dur * pps, 8);
    return { top, bottom };
  }

  private drawNotes(engine: Engine, view: ViewState) {
    const { ctx } = this;
    const tMax = engine.time + VISIBLE_SECONDS + 0.2;
    const group = engine.mode === 'wait' && engine.waiting ? new Set(engine.currentGroup()) : null;

    for (const s of engine.states) {
      const n = s.note;
      if (n.start > tMax) break;
      if (n.start + n.dur < engine.time - 0.6) continue;
      const k = this.byMidi.get(n.midi);
      if (!k) continue;
      const { top, bottom } = this.noteRect(engine, n.start, n.dur);
      const pad = k.black ? 1 : 2;
      const x = k.x + pad;
      const w = k.w - pad * 2;
      const active = engine.isActive(n);
      const c = COLORS[n.hand as Hand];

      let fill = c.fill;
      let alpha = active ? 1 : 0.45;
      if (s.status === 'hit') {
        fill = active ? COLORS.good : c.fill;
        alpha = active ? 0.55 : 0.35;
      } else if (s.status === 'missed') {
        fill = COLORS.bad;
        alpha = 0.45;
      } else if (s.status === 'skipped') alpha = 0.15;

      ctx.globalAlpha = alpha;
      if (group?.has(s)) {
        ctx.shadowColor = c.glow;
        ctx.shadowBlur = 18;
      }
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, fill);
      g.addColorStop(1, s.status === 'pending' ? c.dark : fill);
      ctx.fillStyle = g;
      roundRect(ctx, x, top, w, bottom - top, Math.min(6, w / 3));
      ctx.fill();
      ctx.shadowBlur = 0;
      if (active && s.status === 'pending') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Touche du clavier d'ordinateur à taper (ou flèche si hors de portée)
      let labelBottom = bottom - 3;
      const badgeH = Math.min(18, w * 0.8);
      const text = active && s.status === 'pending' ? view.keyForNote(s) : null;
      if (text && w >= 12 && bottom - top >= badgeH + 4) {
        const key = text !== '◀' && text !== '▶';
        const bw = Math.min(w - 4, Math.max(badgeH, text.length * badgeH * 0.6));
        const by = bottom - badgeH - 3;
        ctx.globalAlpha = 1;
        ctx.fillStyle = key ? '#ffffff' : '#ffd166';
        roundRect(ctx, x + (w - bw) / 2, by, bw, badgeH, 4);
        ctx.fill();
        ctx.fillStyle = '#1b1d2e';
        ctx.font = `800 ${Math.round(badgeH * 0.62)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, by + badgeH / 2 + 1);
        labelBottom = by - 2;
      }

      if (view.showNoteNames && w >= 16 && labelBottom - top >= 14) {
        ctx.globalAlpha = Math.min(1, alpha + 0.3);
        ctx.fillStyle = '#fff';
        ctx.font = `600 ${Math.min(12, w * 0.42)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(noteName(n.midi, view.notation, false), x + w / 2, labelBottom);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawHitLine(engine: Engine) {
    const { ctx, w } = this;
    const y = this.hitY;
    const color = engine.waiting ? '#ffd166' : '#7aa2ff';
    const g = ctx.createLinearGradient(0, y - 24, 0, y);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, engine.waiting ? 'rgba(255,209,102,0.22)' : 'rgba(122,162,255,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 24, w, 24);
    ctx.fillStyle = color;
    ctx.fillRect(0, y - 2, w, 2);
  }

  private drawParticles(dt: number) {
    const { ctx } = this;
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.life -= dt * 1.6;
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private keyColor(engine: Engine, view: ViewState, midi: number, hints: Map<number, Hand>): string | null {
    const fb = view.pressed.get(midi);
    if (fb) return COLORS[fb];
    const auto = engine.autoSounding.get(midi);
    if (auto) return COLORS[auto.hand].fill;
    const hint = hints.get(midi);
    if (hint && view.showKeyHints) return COLORS[hint].glow;
    return null;
  }

  private drawKeyboard(engine: Engine, view: ViewState, withHints: boolean) {
    const { ctx, w } = this;
    const top = this.hitY;
    const kh = this.keyboardHeight;
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, top, w, kh);

    // touches à jouer bientôt (aide visuelle)
    const hints = new Map<number, Hand>();
    if (withHints && engine.mode !== 'demo') {
      const horizon = engine.mode === 'wait' ? 0.6 : 0.15;
      for (const s of engine.states) {
        if (s.note.start > engine.time + horizon) break;
        if (s.status === 'pending' && engine.isActive(s.note) && s.note.start + s.note.dur > engine.time - 0.2)
          hints.set(s.note.midi, s.note.hand);
      }
    }

    for (const pass of [false, true]) {
      for (const k of this.keys) {
        if (k.black !== pass) continue;
        const color = this.keyColor(engine, view, k.midi, hints);
        const flash = this.flashes.get(k.midi) ?? 0;
        if (flash > 0) this.flashes.set(k.midi, Math.max(0, flash - 0.08));
        const isHint = color && !view.pressed.has(k.midi) && !engine.autoSounding.has(k.midi);

        if (!k.black) {
          const g = ctx.createLinearGradient(0, top, 0, top + k.h);
          g.addColorStop(0, color && !isHint ? color : '#f4f4f6');
          g.addColorStop(1, color && !isHint ? color : '#dcdde3');
          ctx.fillStyle = g;
          roundRect(ctx, k.x + 1, top + 1, k.w - 2, k.h - 3, 4);
          ctx.fill();
          if (isHint) {
            ctx.fillStyle = color!;
            ctx.globalAlpha = 0.55;
            roundRect(ctx, k.x + 1, top + k.h * 0.55, k.w - 2, k.h * 0.45 - 3, 4);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        } else {
          const g = ctx.createLinearGradient(0, top, 0, top + k.h);
          g.addColorStop(0, color && !isHint ? color : '#2a2b33');
          g.addColorStop(1, color && !isHint ? color : '#0c0c10');
          ctx.fillStyle = g;
          roundRect(ctx, k.x, top, k.w, k.h, 3);
          ctx.fill();
          if (isHint) {
            ctx.fillStyle = color!;
            ctx.globalAlpha = 0.7;
            roundRect(ctx, k.x + 2, top + k.h * 0.5, k.w - 4, k.h * 0.5 - 3, 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
        if (flash > 0) {
          ctx.globalAlpha = flash * 0.5;
          ctx.fillStyle = '#fff';
          ctx.fillRect(k.x, top, k.w, k.h);
          ctx.globalAlpha = 1;
        }

        // libellés
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        if (!k.black && k.midi % 12 === 0) {
          ctx.fillStyle = '#6b6f80';
          ctx.font = `600 ${Math.min(11, k.w * 0.45)}px Inter, system-ui, sans-serif`;
          ctx.fillText(noteName(k.midi, view.notation), k.x + k.w / 2, top + k.h - 6);
        }
        const ck = view.computerKeys.get(k.midi);
        if (ck && k.w >= 14) {
          ctx.font = `700 ${Math.min(11, k.w * 0.5)}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = k.black ? '#c9cbe0' : '#7a5cff';
          const y = k.black ? top + k.h - 5 : top + k.h - 22;
          ctx.fillText(ck, k.x + k.w / 2, y);
        }
      }
    }
    // ombre sous la ligne
    const g = ctx.createLinearGradient(0, top, 0, top + 8);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, w, 8);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
