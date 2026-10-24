/// <reference types="vite/client" />
import './style.css';
import { PianoSynth } from './audio';
import { Engine, type HandsSel, type Mode, type NoteState, type Results } from './engine';
import { MidiInput } from './midi-input';
import { midiFileName, songToMidi } from './midi-export';
import { parseMidiFile } from './midi-file';
import { formatTime, noteName, type Hand, type Notation, type Song, type SongNote } from './notes';
import { Renderer, type KeyFeedback, type TrailNote, type ViewState } from './renderer';
import { SONGS } from './songs';

// Morceaux personnels (fichier facultatif, non publié : œuvres protégées)
const PERSONAL_SONGS: Song[] =
  Object.values(import.meta.glob<{ PERSONAL_SONGS: Song[] }>('./songs-perso.ts', { eager: true }))[0]
    ?.PERSONAL_SONGS ?? [];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- Stockage local ----------
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage plein ou indisponible */
  }
}

const settings = load('piano.settings', {
  notation: 'latin' as Notation,
  noteNames: true,
  hints: true,
  pcKeys: true,
  autoShift: true,
  full: false,
  localSound: true,
  volume: 80,
  midiDevice: 'all',
  mode: 'wait' as Mode,
  hands: 'both' as HandsSel,
  tempo: 100,
  songId: SONGS[0].id,
});
const saveSettings = () => save('piano.settings', settings);

type BestScores = Record<string, Partial<Record<Mode, number>>>;
const best: BestScores = load('piano.best', {});

let imported: Song[] = (() => {
  try {
    return JSON.parse(localStorage.getItem('piano.imported') ?? '[]') as Song[];
  } catch {
    return [];
  }
})();
const allSongs = () => [...SONGS, ...PERSONAL_SONGS, ...imported];

// ---------- Moteur, son, rendu ----------
const synth = new PianoSynth();
synth.setVolume(settings.volume / 100);

const canvas = $<HTMLCanvasElement>('canvas');
const renderer = new Renderer(canvas);

const engine = new Engine({
  autoNoteOn: (midi) => synth.noteOn(midi, 0.6),
  autoNoteOff: (midi) => synth.noteOff(midi),
  missed: () => {},
  finished: (r) => showResults(r),
});

const view: ViewState = {
  pressed: new Map<number, KeyFeedback>(),
  notation: settings.notation,
  showNoteNames: settings.noteNames,
  showKeyHints: settings.hints,
  computerKeys: new Map(),
  keyForNote: () => null,
};

// ---------- Entrées utilisateur ----------
type Source = 'midi' | 'mouse' | 'kbd';

function userNoteOn(midi: number, velocity: number, source: Source) {
  synth.resume();
  if (source !== 'midi' || settings.localSound) synth.noteOn(midi, velocity);
  if (freeMode) freeNoteOn(midi);
  const res = engine.userNoteOn(midi);
  view.pressed.set(midi, res === 'correct' ? 'good' : res === 'wrong' ? 'bad' : 'free');
  if (res === 'correct') renderer.burst(midi, 'good');
  else if (res === 'wrong') renderer.burst(midi, 'bad');
}

function userNoteOff(midi: number, source: Source) {
  if (source !== 'midi' || settings.localSound) synth.noteOff(midi);
  if (freeMode) freeNoteOff(midi);
  view.pressed.delete(midi);
}

// Clavier MIDI
const midiInput = new MidiInput({
  noteOn: (m, v) => userNoteOn(m, v, 'midi'),
  noteOff: (m) => userNoteOff(m, 'midi'),
  sustain: (on) => settings.localSound && synth.setSustain(on),
  devicesChanged: (names) => updateMidiStatus(names),
});

let lastDevices = '';
function updateMidiStatus(names: string[]) {
  const changed = names.join('|') !== lastDevices;
  lastDevices = names.join('|');
  const el = $('midiStatus');
  const label = el.querySelector('.label')!;
  el.classList.toggle('on', names.length > 0);
  if (names.length) label.textContent = names.length === 1 ? names[0] : `${names.length} claviers MIDI`;
  else label.textContent = midiInput.error || 'Aucun clavier MIDI';
  el.title = names.length ? `Connecté : ${names.join(', ')}` : label.textContent ?? '';

  const sel = $<HTMLSelectElement>('setMidiDevice');
  sel.innerHTML = '';
  const opts = [['all', names.length ? 'Tous les claviers' : 'Aucun clavier détecté'], ...names.map((n) => [n, n])];
  for (const [v, t] of opts) sel.add(new Option(t, v, false, v === settings.midiDevice));
  if (names.length && changed) toast(`Clavier connecté : ${names.join(', ')}`);
}

// Souris / tactile sur le clavier dessiné
const pointerNotes = new Map<number, number>();
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const midi = renderer.hitTest(e.clientX - rect.left, e.clientY - rect.top);
  if (midi === null) return;
  canvas.setPointerCapture(e.pointerId);
  pointerNotes.set(e.pointerId, midi);
  userNoteOn(midi, 0.75, 'mouse');
});
canvas.addEventListener('pointermove', (e) => {
  const cur = pointerNotes.get(e.pointerId);
  if (cur === undefined) return;
  const rect = canvas.getBoundingClientRect();
  const midi = renderer.hitTest(e.clientX - rect.left, e.clientY - rect.top);
  if (midi !== null && midi !== cur) {
    userNoteOff(cur, 'mouse');
    pointerNotes.set(e.pointerId, midi);
    userNoteOn(midi, 0.7, 'mouse');
  }
});
const pointerEnd = (e: PointerEvent) => {
  const cur = pointerNotes.get(e.pointerId);
  if (cur === undefined) return;
  pointerNotes.delete(e.pointerId);
  userNoteOff(cur, 'mouse');
};
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);

// Clavier d'ordinateur : positions physiques (fonctionne en AZERTY comme en QWERTY), deux octaves et demie.
// Rangée du bas = octave grave (noires sur la rangée du milieu),
// rangée des lettres du haut = octave suivante (noires sur les chiffres).
// La rangée du haut est listée en premier : c'est elle qui est affichée quand deux touches donnent la même note.
const KEY_CODES: [string, number][] = [
  ['KeyQ', 12], ['Digit2', 13], ['KeyW', 14], ['Digit3', 15], ['KeyE', 16], ['KeyR', 17], ['Digit5', 18],
  ['KeyT', 19], ['Digit6', 20], ['KeyY', 21], ['Digit7', 22], ['KeyU', 23], ['KeyI', 24], ['Digit9', 25],
  ['KeyO', 26], ['Digit0', 27], ['KeyP', 28], ['BracketLeft', 29], ['Equal', 30], ['BracketRight', 31],
  ['KeyZ', 0], ['KeyS', 1], ['KeyX', 2], ['KeyD', 3], ['KeyC', 4], ['KeyV', 5], ['KeyG', 6], ['KeyB', 7],
  ['KeyH', 8], ['KeyN', 9], ['KeyJ', 10], ['KeyM', 11], ['Comma', 12], ['KeyL', 13], ['Period', 14],
  ['Semicolon', 15], ['Slash', 16],
];
const KEY_REACH = 31; // demi-tons couverts au-dessus de la note de base
const KEY_OFFSET = new Map(KEY_CODES);
const FALLBACK: Record<string, string> = {
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', BracketLeft: '[', BracketRight: ']', Equal: '=',
};
// Disposition AZERTY supposée pour un navigateur en français (hors Canada) quand le navigateur ne la donne pas
const AZERTY: Record<string, string> = {
  KeyQ: 'A', KeyW: 'Z', KeyZ: 'W', KeyM: ',', Comma: ';', Period: ':', Slash: '!', Semicolon: 'M',
  Digit2: 'É', Digit3: '"', Digit5: '(', Digit6: '-', Digit7: 'È', Digit9: 'Ç', Digit0: 'À',
  BracketLeft: '^', BracketRight: '$', Equal: '=',
};
const isAzerty = /^fr(-(FR|BE|LU|MC))?$/i.test(navigator.language);
const fallbackLabel = (code: string) =>
  (isAzerty ? AZERTY[code] : undefined) ?? FALLBACK[code] ?? code.replace(/^(Key|Digit)/, '');
let keyLabels = new Map<string, string>(KEY_CODES.map(([c]) => [c, fallbackLabel(c)]));
let kbdBase = 48;
const kbdHeld = new Map<string, number>();

async function loadKeyboardLayout() {
  const kb = (navigator as unknown as { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard;
  if (!kb?.getLayoutMap) return;
  try {
    const map = await kb.getLayoutMap();
    keyLabels = new Map(KEY_CODES.map(([c]) => [c, (map.get(c) ?? fallbackLabel(c)).toUpperCase()]));
    updateComputerKeys();
  } catch {
    /* non supporté */
  }
}

function updateComputerKeys() {
  view.computerKeys.clear();
  offsetLabel.clear();
  for (const [code, off] of KEY_CODES) if (!offsetLabel.has(off)) offsetLabel.set(off, keyLabels.get(code)!);
  if (settings.pcKeys) {
    for (const [code, off] of KEY_CODES) {
      if (!view.computerKeys.has(kbdBase + off)) view.computerKeys.set(kbdBase + off, keyLabels.get(code)!);
    }
  }
  const row = (codes: string[]) => codes.map((c) => keyLabels.get(c)).join(' ');
  $('kbdHelp').textContent =
    `${row(['KeyZ', 'KeyX', 'KeyC'])}… = ${noteName(kbdBase, settings.notation)}, ` +
    `${row(['KeyQ', 'KeyW', 'KeyE'])}… = ${noteName(kbdBase + 12, settings.notation)}`;
}

function setKbdBase(base: number, announce: boolean) {
  base = Math.max(24, Math.min(72, base));
  if (base === kbdBase) return;
  kbdBase = base;
  updateComputerKeys();
  if (announce) {
    toast(`Clavier d'ordinateur : ${keyLabels.get('KeyZ')} = ${noteName(kbdBase, settings.notation)}, ` +
      `${keyLabels.get('KeyQ')} = ${noteName(kbdBase + 12, settings.notation)}`);
  }
}

const reachable = (base: number, midi: number) => midi >= base && midi <= base + KEY_REACH;

/** Octave de base qui rend jouables le plus de notes possible (à égalité : la plus proche de `current`) */
function bestBase(midis: number[], mustReach: number[], current: number): number {
  let best = current;
  let bestCount = -1;
  for (let b = 24; b <= 72; b += 12) {
    if (!mustReach.every((m) => reachable(b, m))) continue;
    const count = midis.filter((m) => reachable(b, m)).length;
    if (count > bestCount || (count === bestCount && Math.abs(b - current) < Math.abs(best - current))) {
      best = b;
      bestCount = count;
    }
  }
  return bestCount < 0 ? bestBase(midis, [], current) : best;
}

// Décalage automatique : on planifie à l'avance la position du clavier d'ordinateur pour chaque note,
// pour que la lettre écrite sur une note qui tombe soit toujours celle à taper quand elle arrive.
const offsetLabel = new Map<number, string>(); // écart à la note de base -> lettre
const plannedBase = new Map<NoteState, number>();

function planKeyboard() {
  plannedBase.clear();
  if (!settings.autoShift) return;
  const active = engine.states.filter((s) => engine.isActive(s.note));
  let base = bestBase(active.map((s) => s.note.midi), [], 48);
  for (let i = 0; i < active.length; ) {
    const t0 = active[i].note.start;
    let j = i;
    while (j < active.length && active[j].note.start - t0 < 0.06) j++;
    const group = active.slice(i, j).map((s) => s.note.midi);
    if (!group.every((m) => reachable(base, m))) {
      const soon = active.filter((s) => s.note.start >= t0 && s.note.start <= t0 + 4).map((s) => s.note.midi);
      base = bestBase(soon, group, base);
    }
    for (let k = i; k < j; k++) plannedBase.set(active[k], base);
    i = j;
  }
  followPlannedBase();
}

/** Place le clavier d'ordinateur sur l'octave prévue pour la prochaine note à jouer */
function followPlannedBase() {
  if (!plannedBase.size) return;
  const next = engine.states.find((s) => s.status === 'pending' && plannedBase.has(s));
  if (next) setKbdBase(plannedBase.get(next)!, false);
}

view.keyForNote = (s) => {
  if (!settings.pcKeys) return null;
  const base = plannedBase.get(s) ?? kbdBase;
  return offsetLabel.get(s.note.midi - base) ?? (s.note.midi < base ? '◀' : '▶');
};

const modalOpen = () => document.querySelector('.modal.open') !== null;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return closeModals();
  if (modalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.target as HTMLElement).matches?.('input, select, textarea')) {
    if (e.code !== 'Space') return;
  }
  synth.resume();

  const off = KEY_OFFSET.get(e.code);
  if (off !== undefined) {
    e.preventDefault();
    // Apprend la vraie lettre de la touche (utile si la disposition n'a pas pu être détectée)
    if (e.key.length === 1 && !e.shiftKey && keyLabels.get(e.code) !== e.key.toUpperCase()) {
      keyLabels.set(e.code, e.key.toUpperCase());
      updateComputerKeys();
    }
    if (e.repeat || kbdHeld.has(e.code)) return;
    const midi = kbdBase + off;
    kbdHeld.set(e.code, midi);
    userNoteOn(midi, 0.75, 'kbd');
    return;
  }
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (!e.repeat) {
        if (freeMode) toggleRecording();
        else togglePlay();
      }
      break;
    case 'Backspace':
      e.preventDefault();
      if (!freeMode) restart();
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      e.preventDefault();
      if (settings.autoShift && !freeMode) {
        settings.autoShift = false;
        $<HTMLInputElement>('setAutoShift').checked = false;
        saveSettings();
        planKeyboard();
        toast('Décalage automatique désactivé (réactivable dans les réglages)');
      }
      setKbdBase(kbdBase + (e.code === 'ArrowLeft' ? -12 : 12), true);
      break;
    case 'ArrowUp':
    case 'ArrowDown':
      e.preventDefault();
      setTempo(settings.tempo + (e.code === 'ArrowUp' ? 5 : -5));
      break;
  }
});
window.addEventListener('keyup', (e) => {
  const midi = kbdHeld.get(e.code);
  if (midi === undefined) return;
  kbdHeld.delete(e.code);
  userNoteOff(midi, 'kbd');
});
window.addEventListener('blur', () => {
  for (const [code, midi] of kbdHeld) {
    kbdHeld.delete(code);
    userNoteOff(midi, 'kbd');
  }
});
window.addEventListener('pointerdown', () => synth.resume(), { capture: true });

// ---------- Morceau & contrôles ----------
let currentSong: Song;

function loadSong(song: Song) {
  currentSong = song;
  settings.songId = song.id;
  saveSettings();
  engine.load(song);
  setKbdBase(bestBase(song.notes.map((n) => n.midi), [], kbdBase), false);
  planKeyboard();
  applyRange();
  $('songTitle').textContent = song.title;
  const hands = new Set(song.notes.map((n) => n.hand));
  $('songSub').textContent = `${song.composer} · ${song.notes.length} notes · ${
    hands.size === 2 ? 'deux mains' : hands.has('R') ? 'main droite' : 'main gauche'
  }`;
  $('timeTotal').textContent = formatTime(song.duration);
  updatePlayState();
}

function applyRange() {
  let lo = 21;
  let hi = 108;
  if (!settings.full && currentSong) {
    const ms = currentSong.notes.map((n) => n.midi);
    lo = Math.min(...ms);
    hi = Math.max(...ms);
    lo -= lo % 12; // commencer sur un Do
    hi = hi + (11 - (hi % 12)); // finir sur un Si
    while (hi - lo + 1 < 36) {
      if (lo - 12 >= 21) lo -= 12;
      else hi += 12;
    }
    hi = Math.min(108, hi + 1); // Do final
    lo = Math.max(21, lo);
  }
  renderer.setRange(lo, hi);
}

function togglePlay() {
  synth.resume();
  if (engine.playing) engine.pause();
  else {
    closeModals();
    engine.play();
  }
  updatePlayState();
}

function restart() {
  engine.restart();
  synth.allOff();
  updatePlayState();
}

function updatePlayState() {
  document.body.classList.toggle('playing', engine.playing);
  $('startHint').classList.toggle('hidden', engine.playing || engine.time > -2);
  $('hudMissedBox').style.display = engine.mode === 'realtime' ? '' : 'none';
  $('hud').style.visibility = engine.mode === 'demo' ? 'hidden' : '';
}

function setTempo(v: number) {
  settings.tempo = Math.max(25, Math.min(150, v));
  engine.speed = settings.tempo / 100;
  $<HTMLInputElement>('tempo').value = String(settings.tempo);
  $('tempoVal').textContent = `${settings.tempo} %`;
  saveSettings();
}

function setupSeg(id: string, value: string, onChange: (v: string) => void) {
  const root = $(id);
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
  const mark = (v: string) => buttons.forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  mark(value);
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      mark(b.dataset.v!);
      onChange(b.dataset.v!);
      b.blur();
    }),
  );
}

setupSeg('segMode', settings.mode, (v) => {
  settings.mode = v as Mode;
  engine.mode = settings.mode;
  engine.reconfigure();
  planKeyboard();
  saveSettings();
  updatePlayState();
});
setupSeg('segHands', settings.hands, (v) => {
  settings.hands = v as HandsSel;
  engine.hands = settings.hands;
  engine.reconfigure();
  planKeyboard();
  saveSettings();
});

$('btnPlay').addEventListener('click', (e) => {
  togglePlay();
  (e.currentTarget as HTMLElement).blur();
});
$('btnRestart').addEventListener('click', (e) => {
  restart();
  (e.currentTarget as HTMLElement).blur();
});
$<HTMLInputElement>('tempo').addEventListener('input', (e) => setTempo(+(e.target as HTMLInputElement).value));

$('progress').addEventListener('click', (e) => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = (e.clientX - r.left) / r.width;
  const wasPlaying = engine.playing;
  synth.allOff();
  engine.seek(ratio * currentSong.duration);
  engine.playing = wasPlaying;
  updatePlayState();
});

// ---------- Modales ----------
function openModal(id: string) {
  closeModals();
  if (engine.playing) togglePlay();
  $(id).classList.add('open');
}
function closeModals() {
  document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
}
document.querySelectorAll('.modal').forEach((m) =>
  m.addEventListener('click', (e) => {
    if (e.target === m || (e.target as HTMLElement).closest('[data-close]')) closeModals();
  }),
);

// Bibliothèque
function renderLibrary() {
  const grid = $('libraryGrid');
  grid.innerHTML = '';
  const sorted = allSongs().sort((a, b) => (a.level || 99) - (b.level || 99));
  for (const song of sorted) {
    const card = document.createElement('button');
    card.className = 'song-card' + (song.id === currentSong?.id ? ' current' : '');
    const b = best[song.id] ?? {};
    const top = Math.max(b.wait ?? -1, b.realtime ?? -1);
    const stars = top < 0 ? '' : '★'.repeat(top >= 95 ? 3 : top >= 80 ? 2 : top >= 60 ? 1 : 0) || '☆';
    const level = song.level
      ? `<span class="level">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= song.level ? 'on' : ''}"></i>`).join('')}</span>`
      : `<span>${song.id.startsWith('rec-') ? 'Mon enregistrement' : 'Importé'}</span>`;
    card.innerHTML = `
      <div class="t"></div>
      <div class="c"></div>
      <div class="meta">${level}<span>${formatTime(song.duration)}</span><span class="best" title="Meilleur score">${
        top >= 0 ? `${stars} ${top}%` : ''
      }</span></div>`;
    card.querySelector('.t')!.textContent = song.title;
    card.querySelector('.c')!.textContent = song.composer;
    const actions = document.createElement('span');
    actions.className = 'card-actions';
    const exp = document.createElement('span');
    exp.textContent = '⬇';
    exp.title = 'Exporter en fichier .mid (pour l\'importer sur un autre appareil)';
    exp.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadMidi(song);
    });
    actions.appendChild(exp);
    if (song.imported) {
      const del = document.createElement('span');
      del.className = 'del';
      del.textContent = '✕';
      del.title = 'Retirer de la bibliothèque';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        imported = imported.filter((s) => s.id !== song.id);
        save('piano.imported', imported);
        if (currentSong.id === song.id) loadSong(SONGS[0]);
        renderLibrary();
      });
      actions.appendChild(del);
    }
    card.appendChild(actions);
    card.addEventListener('click', () => {
      if (freeMode) exitFreeMode();
      loadSong(song);
      closeModals();
    });
    grid.appendChild(card);
  }
}

function downloadMidi(song: Song) {
  const url = URL.createObjectURL(new Blob([songToMidi(song)], { type: 'audio/midi' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = midiFileName(song);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`« ${song.title} » exporté en ${a.download}`);
}

$('btnLibrary').addEventListener('click', () => {
  renderLibrary();
  openModal('libraryModal');
});

async function importFile(file: File) {
  try {
    const song = parseMidiFile(await file.arrayBuffer(), file.name);
    imported.push(song);
    save('piano.imported', imported);
    if (freeMode) exitFreeMode();
    loadSong(song);
    closeModals();
    toast(`« ${song.title} » importé (${song.notes.length} notes)`);
  } catch (err) {
    toast(`Import impossible : ${(err as Error).message}`);
  }
}

$<HTMLInputElement>('fileInput').addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files?.[0]) void importFile(input.files[0]);
  input.value = '';
});
const dz = $('dropzone');
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  dz.classList.add('drag');
});
window.addEventListener('dragleave', () => dz.classList.remove('drag'));
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dz.classList.remove('drag');
  const f = e.dataTransfer?.files?.[0];
  if (f) void importFile(f);
});

// Réglages
function bindCheck(
  id: string,
  key: 'noteNames' | 'hints' | 'pcKeys' | 'autoShift' | 'full' | 'localSound',
  after: () => void,
) {
  const el = $<HTMLInputElement>(id);
  el.checked = settings[key];
  el.addEventListener('change', () => {
    settings[key] = el.checked;
    saveSettings();
    after();
  });
}
bindCheck('setNoteNames', 'noteNames', () => (view.showNoteNames = settings.noteNames));
bindCheck('setHints', 'hints', () => (view.showKeyHints = settings.hints));
bindCheck('setPcKeys', 'pcKeys', updateComputerKeys);
bindCheck('setAutoShift', 'autoShift', planKeyboard);
bindCheck('setFull', 'full', applyRange);
bindCheck('setLocalSound', 'localSound', () => synth.allOff());

const notationSel = $<HTMLSelectElement>('setNotation');
notationSel.value = settings.notation;
notationSel.addEventListener('change', () => {
  settings.notation = notationSel.value as Notation;
  view.notation = settings.notation;
  updateComputerKeys();
  saveSettings();
});
const volume = $<HTMLInputElement>('setVolume');
volume.value = String(settings.volume);
volume.addEventListener('input', () => {
  settings.volume = +volume.value;
  synth.setVolume(settings.volume / 100);
  saveSettings();
});
$<HTMLSelectElement>('setMidiDevice').addEventListener('change', (e) => {
  settings.midiDevice = (e.target as HTMLSelectElement).value;
  midiInput.select(settings.midiDevice);
  saveSettings();
});
$('btnSettings').addEventListener('click', () => openModal('settingsModal'));
$('midiStatus').addEventListener('click', () => openModal('settingsModal'));

// Résultats
function showResults(r: Results) {
  synth.allOff();
  updatePlayState();
  if (r.mode === 'demo') {
    toast('Fin de l\'écoute — à toi de jouer !');
    return;
  }
  const prev = best[currentSong.id]?.[r.mode] ?? -1;
  const record = r.score > prev;
  if (record) {
    best[currentSong.id] = { ...best[currentSong.id], [r.mode]: r.score };
    save('piano.best', best);
  }
  $('resStars').innerHTML = [1, 2, 3].map((i) => `<span class="${i <= r.stars ? 'on' : ''}">★</span>`).join('');
  $('resScore').textContent = String(r.score);
  const msgs = ['Continue, ça va venir !', 'Pas mal du tout !', 'Très bien joué !', 'Parfait, bravo !'];
  $('resMsg').textContent =
    msgs[r.stars] + (record && prev >= 0 ? ' Nouveau record !' : '') +
    (r.stars === 3 && settings.tempo < 100 ? ' Essaie un tempo plus rapide.' : '');
  const cells: [string, number][] = [
    ['justes', r.correct],
    ['erreurs', r.wrong],
    ...(r.mode === 'realtime' ? ([['ratées', r.missed], ['parfaites', r.perfect]] as [string, number][]) : []),
    ['meilleure série', r.bestStreak],
  ];
  $('resGrid').innerHTML = cells.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
  openModal('resultsModal');
}
$('resReplay').addEventListener('click', () => {
  closeModals();
  restart();
  togglePlay();
});
$('resLibrary').addEventListener('click', () => {
  renderLibrary();
  openModal('libraryModal');
});

// ---------- Jeu libre & enregistrement ----------
let freeMode = false;
const trail: TrailNote[] = [];
let recording: { t0: number; open: Map<number, number>; notes: SongNote[] } | null = null;
let pendingRecording: SongNote[] | null = null;
const nowSec = () => performance.now() / 1000;

function freeNoteOn(midi: number) {
  trail.push({ midi, start: nowSec(), end: null });
  recording?.open.set(midi, nowSec() - recording.t0);
  $('freeHint').classList.add('hidden');
}

function freeNoteOff(midi: number) {
  for (let i = trail.length - 1; i >= 0; i--) {
    if (trail[i].midi === midi && trail[i].end === null) {
      trail[i].end = nowSec();
      break;
    }
  }
  if (!recording) return;
  const start = recording.open.get(midi);
  if (start === undefined) return;
  recording.open.delete(midi);
  const dur = Math.max(0.05, nowSec() - recording.t0 - start);
  recording.notes.push({ midi, start, dur, hand: 'R' });
}

function enterFreeMode() {
  if (freeMode) return;
  if (engine.playing) togglePlay();
  closeModals();
  synth.allOff();
  freeMode = true;
  document.body.classList.add('free');
  renderer.setRange(settings.full ? 21 : 36, settings.full ? 108 : 96);
  $('freeHint').classList.remove('hidden');
}

function exitFreeMode() {
  if (!freeMode) return;
  if (recording) stopRecording();
  setMetronome(false);
  freeMode = false;
  trail.length = 0;
  document.body.classList.remove('free');
  synth.allOff();
  applyRange();
  followPlannedBase();
  updatePlayState();
}

function toggleRecording() {
  if (recording) stopRecording();
  else {
    synth.resume();
    recording = { t0: nowSec(), open: new Map(), notes: [] };
    // les touches déjà enfoncées comptent à partir de maintenant
    for (const midi of view.pressed.keys()) recording.open.set(midi, 0);
    document.body.classList.add('recording');
    $('recLabel').textContent = 'Enregistrement…';
    $('freeHint').classList.add('hidden');
  }
}

function stopRecording() {
  if (!recording) return;
  const rec = recording;
  for (const midi of [...rec.open.keys()]) {
    const start = rec.open.get(midi)!;
    rec.notes.push({ midi, start, dur: Math.max(0.05, nowSec() - rec.t0 - start), hand: 'R' });
  }
  recording = null;
  document.body.classList.remove('recording');
  $('recLabel').textContent = 'Enregistrer';
  $('recTime').textContent = 'Joue ce que tu veux';
  if (!rec.notes.length) {
    toast("Aucune note jouée : rien n'a été enregistré");
    return;
  }
  pendingRecording = rec.notes;
  const recorded = imported.filter((s) => s.id.startsWith('rec-')).length;
  $<HTMLInputElement>('saveName').value = `Mon morceau ${recorded + 1}`;
  const first = Math.min(...rec.notes.map((n) => n.start));
  const end = Math.max(...rec.notes.map((n) => n.start + n.dur));
  $('saveInfo').textContent = `${rec.notes.length} notes · ${formatTime(end - first)}`;
  openModal('saveModal');
  $<HTMLInputElement>('saveName').select();
}

function saveRecording(practice: boolean) {
  if (!pendingRecording) return closeModals();
  const split = $<HTMLInputElement>('saveSplit').checked;
  const first = Math.min(...pendingRecording.map((n) => n.start));
  const notes: SongNote[] = pendingRecording
    .map((n) => ({
      ...n,
      start: Math.round((n.start - first) * 1000) / 1000,
      hand: (split && n.midi < 60 ? 'L' : 'R') as Hand,
    }))
    .sort((a, b) => a.start - b.start || a.midi - b.midi);
  const song: Song = {
    id: `rec-${Date.now()}`,
    title: $<HTMLInputElement>('saveName').value.trim() || 'Mon morceau',
    composer: 'Mon enregistrement',
    level: 0,
    notes,
    duration: Math.max(...notes.map((n) => n.start + n.dur)),
    imported: true,
  };
  imported.push(song);
  save('piano.imported', imported);
  pendingRecording = null;
  closeModals();
  if (practice) {
    exitFreeMode();
    loadSong(song);
    toast(`« ${song.title} » est prêt : appuie sur Espace pour t'entraîner`);
  } else toast(`« ${song.title} » ajouté à la bibliothèque`);
}

$('btnFree').addEventListener('click', (e) => {
  if (freeMode) exitFreeMode();
  else enterFreeMode();
  (e.currentTarget as HTMLElement).blur();
});
$('btnExitFree').addEventListener('click', exitFreeMode);
$('btnRec').addEventListener('click', (e) => {
  toggleRecording();
  (e.currentTarget as HTMLElement).blur();
});
$('saveOnly').addEventListener('click', () => saveRecording(false));
$('savePlay').addEventListener('click', () => saveRecording(true));
$('saveDiscard').addEventListener('click', () => {
  pendingRecording = null;
  closeModals();
  toast('Enregistrement supprimé');
});
$<HTMLInputElement>('saveName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveRecording(true);
});

// Métronome (programmé à l'avance sur l'horloge audio pour rester régulier)
let metroOn = false;
let metroNext = 0;
let metroBeat = 0;
const metroBpm = () => Math.max(40, Math.min(220, +$<HTMLInputElement>('metroBpm').value || 90));

function setMetronome(on: boolean) {
  metroOn = on;
  const btn = $('btnMetro');
  btn.classList.toggle('on', on);
  btn.textContent = on ? 'On' : 'Off';
  if (on) {
    synth.resume();
    metroNext = synth.ctx.currentTime + 0.05;
    metroBeat = 0;
  }
}

function tickMetronome() {
  if (!metroOn) return;
  const spb = 60 / metroBpm();
  while (metroNext < synth.ctx.currentTime + 0.12) {
    synth.click(metroNext, metroBeat % 4 === 0);
    metroNext += spb;
    metroBeat++;
  }
}

$('btnMetro').addEventListener('click', (e) => {
  setMetronome(!metroOn);
  (e.currentTarget as HTMLElement).blur();
});

// ---------- Toast ----------
let toastTimer = 0;
function toast(msg: string) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- Boucle d'animation ----------
const hud = {
  score: $('hudScore'),
  correct: $('hudCorrect'),
  wrong: $('hudWrong'),
  missed: $('hudMissed'),
  streak: $('hudStreak'),
  wait: $('waitHint'),
  fill: $('progressFill'),
  cur: $('timeCur'),
};

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (freeMode) {
    tickMetronome();
    const t = nowSec();
    // on oublie les notes sorties de l'écran
    for (let i = trail.length - 1; i >= 0; i--) {
      const end = trail[i].end;
      if (end !== null && t - end > 5) trail.splice(i, 1);
    }
    if (recording) $('recTime').textContent = formatTime(t - recording.t0);
    renderer.draw(engine, view, dt, { trail, now: t });
    requestAnimationFrame(frame);
    return;
  }
  engine.update(dt);
  followPlannedBase();
  renderer.draw(engine, view, dt);

  const s = engine.stats;
  hud.score.textContent = String(engine.liveScore);
  hud.correct.textContent = String(s.correct);
  hud.wrong.textContent = String(s.wrong);
  hud.missed.textContent = String(s.missed);
  hud.streak.textContent = String(s.streak);
  hud.fill.style.width = `${engine.progress * 100}%`;
  hud.cur.textContent = formatTime(engine.time);

  if (engine.waiting) {
    const names = engine
      .currentGroup()
      .map((g) => noteName(g.note.midi, settings.notation))
      .join(' + ');
    hud.wait.textContent = `À toi : ${names}`;
    hud.wait.classList.add('show');
  } else hud.wait.classList.remove('show');

  requestAnimationFrame(frame);
}

// ---------- Démarrage ----------
engine.mode = settings.mode;
engine.hands = settings.hands;
setTempo(settings.tempo);
loadSong(allSongs().find((s) => s.id === settings.songId) ?? SONGS[0]);
updateComputerKeys();
void loadKeyboardLayout();
// La disposition n'est lisible que quand la page est visible : on réessaie au retour sur la page
window.addEventListener('focus', () => void loadKeyboardLayout());
document.addEventListener('visibilitychange', () => document.hidden || void loadKeyboardLayout());
void midiInput.init().then(() => midiInput.select(settings.midiDevice));

// Accès de test (développement uniquement) : faire avancer le jeu sans animation
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__piano = {
    engine,
    step(dt: number) {
      engine.update(dt);
      followPlannedBase();
    },
  };
}

new ResizeObserver(() => renderer.resize()).observe($('stage'));
renderer.resize();
requestAnimationFrame(frame);
