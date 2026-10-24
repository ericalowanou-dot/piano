// Connexion à un clavier MIDI via l'API Web MIDI (Chrome / Edge).

export interface MidiHandlers {
  noteOn: (midi: number, velocity: number) => void;
  noteOff: (midi: number) => void;
  sustain: (on: boolean) => void;
  devicesChanged: (names: string[]) => void;
}

export class MidiInput {
  private access: MIDIAccess | null = null;
  private selected = 'all';
  supported = 'requestMIDIAccess' in navigator;
  error = '';

  constructor(private handlers: MidiHandlers) {}

  async init() {
    if (!this.supported) {
      this.error = 'Navigateur sans Web MIDI (utilise Chrome ou Edge)';
      this.handlers.devicesChanged([]);
      return;
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.access.onstatechange = () => this.bind();
      this.bind();
    } catch {
      this.error = 'Accès MIDI refusé';
      this.handlers.devicesChanged([]);
    }
  }

  get deviceNames(): string[] {
    if (!this.access) return [];
    return [...this.access.inputs.values()].map((i) => i.name ?? 'Clavier MIDI');
  }

  select(name: string) {
    this.selected = name;
    this.bind();
  }

  private bind() {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      const use = this.selected === 'all' || input.name === this.selected;
      input.onmidimessage = use ? (e) => this.onMessage(e) : null;
    }
    this.handlers.devicesChanged(this.deviceNames);
  }

  private onMessage(e: MIDIMessageEvent) {
    const d = e.data;
    if (!d || d.length < 2) return;
    const type = d[0] & 0xf0;
    const a = d[1];
    const b = d.length > 2 ? d[2] : 0;
    if (type === 0x90 && b > 0) this.handlers.noteOn(a, b / 127);
    else if (type === 0x80 || (type === 0x90 && b === 0)) this.handlers.noteOff(a);
    else if (type === 0xb0 && a === 64) this.handlers.sustain(b >= 64);
  }
}
