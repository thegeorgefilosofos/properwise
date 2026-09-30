// ═══════════════════════════════════════════════════════════════════════════
// Η ΜΗΧΑΝΗ ΗΧΟΥ ΤΩΝ REELS
// ─────────────────────────────────────────────────────────────────────────
// Πρωτότυπη μουσική, συντεθειμένη δείγμα προς δείγμα: κανένα κομμάτι τρίτου,
// κανένα θέμα δικαιωμάτων. Ένας μίκτης με στερεοφωνικό, αποστολή σε αντήχηση
// και τα όργανα που χρειάζεται ένα reel: πατάκι, μπάσο, κρουστά, νότες,
// καμπάνες, περάσματα.
//
// ΓΙΑ ΤΟ ΗΧΕΙΟ ΤΟΥ ΚΙΝΗΤΟΥ. Κάτω από τα 100Hz δεν βγαίνει σχεδόν τίποτα,
// οπότε το μπάσο και τα χτυπήματα έχουν πάντα και μια αρμονική από πάνω.
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export const SR = 48000;
const TAU = 2 * Math.PI;

export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** «C3» → 48. */
export const n = (name: string) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if (!m) throw new Error(`Άγνωστη νότα: ${name}`);
  return 12 * (Number(m[3]) + 1) + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as Record<string, number>)[m[1]] + (m[2] ? 1 : 0);
};
export const ch = (...xs: string[]) => xs.map(n);

export class Mix {
  readonly N: number;
  readonly L: Float32Array;
  readonly R: Float32Array;
  readonly SEND: Float32Array;
  private seed = 0x2f6b1d;

  constructor(readonly dur: number) {
    this.N = Math.round(dur * SR);
    this.L = new Float32Array(this.N); this.R = new Float32Array(this.N); this.SEND = new Float32Array(this.N);
  }

  /** Θόρυβος με σπόρο: ίδιο αρχείο σε κάθε τρέξιμο. */
  noise = () => { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 2147483648 - 1; };
  idx = (t: number) => Math.max(0, Math.min(this.N, Math.round(t * SR)));

  /** Γράφει έναν ήχο: θέση στο στερεοφωνικό και πόσο πάει στην αντήχηση. */
  add(t0: number, len: number, pan: number, send: number, fn: (t: number) => number) {
    const a = this.idx(t0), b = this.idx(Math.min(this.dur, t0 + len));
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = a; i < b; i++) { const v = fn((i - a) / SR); this.L[i] += v * gl; this.R[i] += v * gr; this.SEND[i] += v * send; }
  }

  // ── Όργανα ─────────────────────────────────────────────────────────────
  /** Πατάκι: δύο ελαφρά ξεκούρδιστοι ταλαντωτές με λίγες αρμονικές, αργή είσοδος. */
  pad(chords: [number, number[]][], gain = .024) {
    chords.forEach(([start, notes], ci) => {
      const end = ci + 1 < chords.length ? chords[ci + 1][0] : this.dur;
      const len = end - start + .9;
      notes.forEach((m, ni) => {
        const f = hz(m), pan = (ni % 2 ? .4 : -.4) * (ni ? 1 : 0), ph = ni * 1.7;
        this.add(start, len, pan, .35, t => {
          const env = Math.min(1, t / .5) * Math.min(1, Math.max(0, (len - t) / .9));
          let v = 0;
          for (let h = 1; h <= 6; h++) {
            const g = 1 / Math.pow(h, 1.8);
            v += g * (Math.sin(TAU * f * h * t + ph) + Math.sin(TAU * f * 1.0021 * h * t + ph * 2) + .6 * Math.sin(TAU * f * .9983 * h * t));
          }
          return v * env * gain * (1 + .07 * Math.sin(TAU * .3 * t + ni));
        });
      });
    });
  }
  /** Μπάσο: η θεμελιώδης κάθε συγχορδίας με την οκτάβα της, μέσα σε [from, to). */
  bass(chords: [number, number[]][], from: number, to: number, gain = .05) {
    chords.forEach(([start, notes], ci) => {
      const end = Math.min(to, ci + 1 < chords.length ? chords[ci + 1][0] : this.dur);
      const s = Math.max(from, start);
      if (s >= end) return;
      const f = hz(notes[0]), len = end - s + .05;
      this.add(s, len, 0, 0, t => (Math.sin(TAU * f * t) + .5 * Math.sin(TAU * f * 2 * t) + .15 * Math.sin(TAU * f * 3 * t))
        * gain * Math.min(1, t / .03) * Math.min(1, Math.max(0, (len - t) / .05)));
    });
  }
  kick(at: number, g = 1) {
    this.add(at, .5, 0, .05, t => {
      const f = 52 + 110 * Math.exp(-t * 28);
      return (Math.sin(TAU * f * t) * .32 + Math.sin(TAU * 2 * f * t) * .06) * Math.exp(-t * 8.5) * g
        + Math.sin(TAU * 2100 * t) * Math.exp(-t * 220) * .04 * g;
    });
  }
  hat(at: number, g = .04, pan = .35) {
    let prev = 0;
    this.add(at, .09, pan, .1, t => { const x = this.noise(); const y = x - prev; prev = x; return y * Math.exp(-t * 65) * g; });
  }
  /** Παλαμάκι: τρία κοντά χτυπήματα θορύβου και μια ουρά, στη μέση του φάσματος. */
  clap(at: number, g = .09) {
    let y = 0;
    this.add(at, .35, 0, .3, t => {
      const a = 1 - Math.exp(-TAU * 1800 / SR); y += a * (this.noise() - y);
      const env = (t < .03 ? Math.exp(-((t % .01) * 400)) : 0) + Math.exp(-t * 16) * .8;
      return (this.noise() - y) * env * g;
    });
  }
  pluck(at: number, m: number, gain: number, pan = 0, send = .3) {
    this.add(at, 1.2, pan, send, t => {
      const f = hz(m);
      return (Math.sin(TAU * f * t) + .4 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 4) + .15 * Math.sin(TAU * f * 3.01 * t) * Math.exp(-t * 8))
        * Math.exp(-t * 4.2) * Math.min(1, t / .002) * gain;
    });
  }
  whoosh(at: number, len: number, gain: number, up = true) {
    let y = 0, z = 0;
    this.add(at, len, 0, .25, t => {
      const k = t / len, shape = Math.sin(Math.PI * k), fc = up ? 300 + 5200 * k * k : 5500 - 5000 * k;
      const a = 1 - Math.exp(-TAU * fc / SR);
      y += a * (this.noise() - y); z += a * (y - z);
      return (y - z * .5) * shape * gain;
    });
  }
  boom(at: number, gain: number) {
    this.add(at, 2, 0, .2, t =>
      (Math.sin(TAU * (48 + 60 * Math.exp(-t * 7)) * t) + .55 * Math.sin(TAU * (96 + 120 * Math.exp(-t * 7)) * t)) * Math.exp(-t * 2.4) * gain);
  }
  bell(at: number, m: number, gain: number, pan = 0) {
    this.add(at, 3.2, pan, .55, t => {
      const f = hz(m);
      return (Math.sin(TAU * f * t) * Math.exp(-t * 1.4) + .4 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 3.6)
        + .16 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 7)) * gain * Math.min(1, t / .002);
    });
  }
  /** Ένα κοντό κλικ: πλήκτρο, μετρητής, χαρτί που ακουμπά. */
  click(at: number, tone: number, g: number, pan = 0) {
    let prev = 0;
    this.add(Math.max(0, at), .03, pan, .05, t => { const x = this.noise(); const y = x - prev; prev = x; return (y * .6 + Math.sin(TAU * tone * t)) * Math.exp(-t * 260) * g; });
  }
  /** Γλίστρημα τόνου: η δέσμη της σάρωσης. */
  sweep(at: number, len: number, f0: number, f1: number, g: number) {
    this.add(at, len, 0, .3, t => { const k = t / len; return Math.sin(TAU * (f0 + (f1 - f0) * k * k / 2) * t) * Math.sin(Math.PI * k) * g; });
  }

  // ── Μίξη ───────────────────────────────────────────────────────────────
  /** Πλευρική συμπίεση: ό,τι έχει ήδη γραφτεί «αναπνέει» γύρω από κάθε χτύπο. */
  duck(kicks: number[], depth = .34) {
    const d = new Float32Array(this.N).fill(1);
    for (const k of kicks) for (let i = this.idx(k); i < this.idx(k + .4); i++) d[i] = Math.min(d[i], 1 - depth * Math.exp(-((i / SR) - k) / .12));
    for (let i = 0; i < this.N; i++) { this.L[i] *= d[i]; this.R[i] *= d[i]; }
  }
  /** Αντήχηση: μια μικρή αίθουσα (Schroeder), για βάθος χωρίς θολούρα. */
  reverb(wet = .55) {
    const comb = (d: number, fb: number, damp: number) => { const buf = new Float32Array(d); let i = 0, lp = 0; return (x: number) => { const y = buf[i]; lp = y * (1 - damp) + lp * damp; buf[i] = x + lp * fb; i = (i + 1) % d; return y; }; };
    const allp = (d: number, g: number) => { const buf = new Float32Array(d); let i = 0; return (x: number) => { const b = buf[i]; const y = -x + b; buf[i] = x + b * g; i = (i + 1) % d; return y; }; };
    const scale = SR / 44100;
    const mk = (off: number) => ({
      combs: [1557, 1617, 1491, 1422, 1277, 1356].map(d => comb(Math.round((d + off) * scale), .8, .32)),
      aps: [556, 441, 341].map(d => allp(Math.round((d + off) * scale), .5)),
    });
    const rl = mk(0), rr = mk(23), pre = Math.round(.018 * SR);
    for (let i = 0; i < this.N; i++) {
      const x = i >= pre ? this.SEND[i - pre] * .15 : 0;
      let yl = 0, yr = 0;
      for (const c of rl.combs) yl += c(x);
      for (const c of rr.combs) yr += c(x);
      for (const a of rl.aps) yl = a(yl);
      for (const a of rr.aps) yr = a(yr);
      this.L[i] += yl * wet; this.R[i] += yr * wet;
    }
  }
  /** Ένταση, μαλακό όριο, σβήσιμο και WAV 16 bit. */
  write(path: string, fadeOut = 1.3) {
    let sum = 0;
    for (let i = 0; i < this.N; i++) sum += this.L[i] * this.L[i] + this.R[i] * this.R[i];
    const gain = Math.pow(10, -15 / 20) / Math.sqrt(sum / (2 * this.N));   // περίπου −15 dBFS RMS
    const fi = this.idx(.02), fo = this.idx(this.dur - fadeOut);
    const pcm = Buffer.alloc(this.N * 4);
    for (let i = 0; i < this.N; i++) {
      const env = Math.min(1, i / fi) * (i > fo ? Math.pow((this.N - i) / (this.N - fo), 1.5) : 1);
      pcm.writeInt16LE(Math.round(Math.tanh(this.L[i] * gain * 1.1) * .94 * env * 32767), i * 4);
      pcm.writeInt16LE(Math.round(Math.tanh(this.R[i] * gain * 1.1) * .94 * env * 32767), i * 4 + 2);
    }
    const head = Buffer.alloc(44);
    head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8);
    head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22);
    head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
    head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
    writeFileSync(path, Buffer.concat([head, pcm]));
  }
}

/** Εικόνα και ήχος σε ένα αρχείο, έτοιμο για ανέβασμα. */
export function mux(video: string, wav: string, out: string) {
  const r = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', wav,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', String(SR), '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Το ffmpeg απέτυχε.');
}
