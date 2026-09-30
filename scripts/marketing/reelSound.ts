// ═══════════════════════════════════════════════════════════════════════════
// Ο ΗΧΟΣ ΤΟΥ ΠΡΩΤΟΥ REEL
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelSound.ts
// (μετά το reelEnoikio.ts· θέλει ffmpeg στο PATH ή στη μεταβλητή FFMPEG)
//
// Πρωτότυπη μουσική, συντεθειμένη εδώ δείγμα προς δείγμα: κανένα κομμάτι
// τρίτου, κανένα θέμα δικαιωμάτων, τίποτα που θα κατέβαζε το Instagram.
//
// Η ΜΟΥΣΙΚΗ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΕΙΚΟΝΑ, ΣΤΟ ΙΔΙΟ ΠΛΕΓΜΑ (reelTimeline.ts).
//   Ερώτηση    ήσυχο πατάκι, πλήκτρα που γράφουν, ένα φωτεινό σήμα στην αποστολή.
//   Μετρητής   παλμός, τικ όσο κυλά ο αριθμός, μία νότα που κατεβαίνει σε
//              κάθε λωρίδα που φεύγει: τα χρήματα φεύγουν.
//   Γεγονός    ο παλμός σωπαίνει· χτύπημα όταν το γέμισμα σκεπάζει την
//              οθόνη, κοφτή συγχορδία στο πέρασμα στο σκούρο.
//   Εφαρμογή   μείζονα, αρπίσματα, ο ρυθμός ανοίγει.
//   Μάρκα      πλάγια πτώση (Φα → Ντο) και καμπάνα: ζεστό, οριστικό τέλος.
//
// ΓΙΑ ΤΟ ΗΧΕΙΟ ΤΟΥ ΚΙΝΗΤΟΥ. Κάτω από τα 100Hz δεν βγαίνει σχεδόν τίποτα,
// οπότε το μπάσο και τα χτυπήματα έχουν πάντα και μια αρμονική από πάνω.
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { REEL, BEAT, DETACH, ROLL, QUESTION } from './reelTimeline';

const SR = 48000;
const N = Math.round(REEL.dur * SR);
const L = new Float32Array(N), R = new Float32Array(N), SEND = new Float32Array(N);
const DIR = join(process.cwd(), 'docs/marketing/reels/reel-1');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const TAU = 2 * Math.PI;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const idx = (t: number) => Math.max(0, Math.min(N, Math.round(t * SR)));
/** Θόρυβος με σπόρο: ίδιο αρχείο σε κάθε τρέξιμο. */
let seed = 0x2f6b1d;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };

/** Γράφει έναν ήχο στη μίξη: θέση στο στερεοφωνικό και πόσο πάει στην αντήχηση. */
function add(t0: number, len: number, pan: number, send: number, fn: (t: number) => number) {
  const a = idx(t0), b = idx(Math.min(REEL.dur, t0 + len));
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (let i = a; i < b; i++) { const v = fn((i - a) / SR); L[i] += v * gl; R[i] += v * gr; SEND[i] += v * send; }
}

// ── Αρμονία ──────────────────────────────────────────────────────────────
// Λα ελάσσονα όσο λιώνει το ενοίκιο, Ντο μείζονα όταν έρχεται η εφαρμογή.
const n = (name: string) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name)!;
  return 12 * (Number(m[3]) + 1) + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as Record<string, number>)[m[1]] + (m[2] ? 1 : 0);
};
const ch = (...xs: string[]) => xs.map(n);
const [b0, b1, b2] = REEL.beats;
const CHORDS: [number, number[]][] = [
  [0, ch('A2', 'E3', 'G3', 'B3', 'C4')],                       // Am9: η ερώτηση
  [REEL.answer, ch('F2', 'C3', 'E3', 'A3')],                   // Fmaj7: Νόα γράφει
  [REEL.fill, ch('A2', 'E3', 'G3', 'B3', 'C4')],               // Am9: το ενοίκιο
  [b0, ch('F2', 'C3', 'E3', 'A3')],                            // Fmaj7
  [b1, ch('C3', 'G3', 'B3', 'E4')],                            // Cmaj7
  [b2, ch('G2', 'D3', 'E3', 'B3')],                            // G6
  [REEL.result - BEAT, ch('E2', 'B2', 'D3', 'A3')],            // E7sus4: η αναμονή
  [REEL.result, ch('A2', 'E3', 'G3', 'B3', 'C4')],             // Am9
  [REEL.surge, ch('D3', 'F3', 'A3', 'C4', 'E4')],              // Dm9
  [REEL.cut, ch('F2', 'C3', 'E3', 'A3', 'B3')],                // Fmaj7#11
  [REEL.product - BEAT, ch('G2', 'D3', 'F3', 'C4')],           // G7sus4
  [REEL.product, ch('C3', 'G3', 'B3', 'D4', 'E4')],            // Cmaj9
  [REEL.product + 4 * BEAT, ch('A2', 'E3', 'G3', 'C4')],       // Am7
  [REEL.end - 4 * BEAT, ch('G2', 'D3', 'E3', 'B3')],           // G6
  [REEL.end, ch('F2', 'C3', 'E3', 'A3', 'G4')],                // Fmaj9
  [REEL.end + 2 * BEAT, ch('C3', 'G3', 'B3', 'D4', 'E4')],     // Cmaj9 ως το τέλος
];
const chordAt = (t: number) => { let c = CHORDS[0][1]; for (const [s, xs] of CHORDS) if (t >= s) c = xs; return c; };

// Πατάκι: δύο ελαφρά ξεκούρδιστοι ταλαντωτές με λίγες αρμονικές, αργή είσοδος.
CHORDS.forEach(([start, notes], ci) => {
  const end = ci + 1 < CHORDS.length ? CHORDS[ci + 1][0] : REEL.dur;
  const len = end - start + .9;
  const inB = start >= REEL.surge && start < REEL.product - BEAT;
  notes.forEach((m, ni) => {
    const f = hz(m), pan = (ni % 2 ? .4 : -.4) * (ni ? 1 : 0), ph = ni * 1.7;
    add(start, len, pan, .35, t => {
      const env = Math.min(1, t / .5) * Math.min(1, Math.max(0, (len - t) / .9));
      let v = 0;
      for (let h = 1; h <= 6; h++) {
        const g = 1 / Math.pow(h, 1.8);
        v += g * (Math.sin(TAU * f * h * t + ph) + Math.sin(TAU * f * 1.0021 * h * t + ph * 2) + .6 * Math.sin(TAU * f * .9983 * h * t));
      }
      return v * env * (inB ? .03 : .024) * (1 + .07 * Math.sin(TAU * .3 * t + ni));
    });
  });
  // Μπάσο: η θεμελιώδης με την οκτάβα της, όσο παίζει ο παλμός.
  const pulse = (start >= REEL.fill - .01 && start < REEL.surge) || start >= REEL.product - .01;
  if (pulse) {
    const f = hz(notes[0]);
    add(start, Math.min(len, end - start + .05), 0, 0, t =>
      (Math.sin(TAU * f * t) + .5 * Math.sin(TAU * f * 2 * t) + .15 * Math.sin(TAU * f * 3 * t))
      * .05 * Math.min(1, t / .03) * Math.min(1, Math.max(0, (end - start + .05 - t) / .05)));
  }
});

// ── Ρυθμός: 100 χτύποι το λεπτό ──────────────────────────────────────────
const kicks: number[] = [];
const grid = (from: number, to: number) => { for (let t = from; t < to - .01; t += BEAT) kicks.push(t); };
grid(REEL.fill, REEL.surge);
grid(REEL.product, REEL.end);
const kick = (k: number, g = 1) => add(k, .5, 0, .05, t => {
  const f = 52 + 110 * Math.exp(-t * 28);
  return (Math.sin(TAU * f * t) * .32 + Math.sin(TAU * 2 * f * t) * .06) * Math.exp(-t * 8.5) * g
    + Math.sin(TAU * 2100 * t) * Math.exp(-t * 220) * .04 * g;
});
kicks.forEach(k => kick(k));
// Χάι-χατ: από το τρίτο χτύπημα του μετρητή η ένταση ανεβαίνει· στην εφαρμογή ανοίγει.
const hats: number[] = [];
for (let t = b2 + BEAT / 2; t < REEL.surge - .1; t += BEAT) hats.push(t);
for (let t = REEL.product + BEAT / 2; t < REEL.end; t += BEAT / 2) hats.push(t);
hats.forEach((h, i) => {
  let prev = 0;
  const g = h >= REEL.product ? (i % 2 ? .03 : .045) : .035;
  add(h, .09, .35, .1, t => { const x = noise(); const y = x - prev; prev = x; return y * Math.exp(-t * 65) * g; });
});
// Πλευρική συμπίεση: το πατάκι «αναπνέει» γύρω από κάθε χτύπο.
{
  const duck = new Float32Array(N).fill(1);
  for (const k of kicks) for (let i = idx(k); i < idx(k + .4); i++) duck[i] = Math.min(duck[i], 1 - .34 * Math.exp(-((i / SR) - k) / .12));
  for (let i = 0; i < N; i++) { L[i] *= duck[i]; R[i] *= duck[i]; }
}

// ── Εργαλεία ─────────────────────────────────────────────────────────────
const pluck = (at: number, m: number, gain: number, pan = 0, send = .3) => add(at, 1.2, pan, send, t => {
  const f = hz(m);
  return (Math.sin(TAU * f * t) + .4 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 4) + .15 * Math.sin(TAU * f * 3.01 * t) * Math.exp(-t * 8))
    * Math.exp(-t * 4.2) * Math.min(1, t / .002) * gain;
});
const whoosh = (at: number, len: number, gain: number, up = true) => {
  let y = 0, z = 0;
  add(at, len, 0, .25, t => {
    const k = t / len, shape = Math.sin(Math.PI * k), fc = up ? 300 + 5200 * k * k : 5500 - 5000 * k;
    const a = 1 - Math.exp(-TAU * fc / SR);
    y += a * (noise() - y); z += a * (y - z);
    return (y - z * .5) * shape * gain;
  });
};
const boom = (at: number, gain: number) => add(at, 2, 0, .2, t =>
  (Math.sin(TAU * (48 + 60 * Math.exp(-t * 7)) * t) + .55 * Math.sin(TAU * (96 + 120 * Math.exp(-t * 7)) * t)) * Math.exp(-t * 2.4) * gain);
const bell = (at: number, m: number, gain: number, pan = 0) => add(at, 3.2, pan, .55, t => {
  const f = hz(m);
  return (Math.sin(TAU * f * t) * Math.exp(-t * 1.4) + .4 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 3.6)
    + .16 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 7)) * gain * Math.min(1, t / .002);
});

// ── 1 · Η ερώτηση ─────────────────────────────────────────────────────────
// Πλήκτρα: ένα μαλακό κλικ για κάθε γράμμα που γράφεται, με μικρές διαφορές
// στο ύψος ώστε να μην ακούγεται μηχανή.
{
  // Όσα γράμματα γράφονται μετά την πρώτη λέξη, που φαίνεται ήδη στο πρώτο καρέ.
  const chars = QUESTION.length - QUESTION.indexOf(' '), [t0, t1] = REEL.type;
  for (let i = 0; i < chars; i++) {
    const at = t0 + (t1 - t0) * (i / chars) + noise() * .012, tone = 1500 + 500 * Math.abs(noise());
    let prev = 0;
    add(Math.max(0, at), .03, noise() * .3, .05, t => { const x = noise(); const y = x - prev; prev = x; return (y * .6 + Math.sin(TAU * tone * t)) * Math.exp(-t * 260) * .035; });
  }
}
pluck(REEL.send, 88, .07, .2, .5); pluck(REEL.send + .05, 93, .045, .2, .5);        // αποστολή
pluck(REEL.stream, 84, .03, -.3, .6); pluck(REEL.stream + .12, 88, .025, .3, .6);  // η απάντηση αρχίζει

// ── 2 · Ο μετρητής ───────────────────────────────────────────────────────
REEL.beats.forEach((b, i) => {
  pluck(b, [88, 84, 81][i], .045, .3, .5);                       // το χρώμα: ένα φωτεινό σήμα
  whoosh(b + DETACH - .05, .5, .07, false);                       // η λωρίδα φεύγει
  pluck(b + DETACH, [76, 72, 69][i], .17);                        // Μι, Ντο, Λα: κατεβαίνει
  for (let t = b + ROLL.from; t < b + ROLL.to; t += 1 / 18) {     // το κοντέρ
    add(t, .012, (i - 1) * .25, 0, x => Math.sin(TAU * 3400 * x) * Math.exp(-x * 520) * .045);
  }
});
// Το γέμισμα ανεβαίνει: όλο το ενοίκιο, με ένα βαθύ φούσκωμα.
whoosh(REEL.fill - .35, .6, .09, true);
boom(REEL.fill + .1, .14);
// Κρεσέντο και χτύπημα στο αποτέλεσμα.
whoosh(REEL.result - .8, .8, .1, true);
boom(REEL.result, .22);
bell(REEL.result, 81, .06); bell(REEL.result + .08, 76, .045, .3);

// ── 3 · Το γεγονός ───────────────────────────────────────────────────────
whoosh(REEL.surge - .6, .7, .13, true);
boom(REEL.surge, .3);
pluck(REEL.surge + .3, 74, .1, -.2, .6); pluck(REEL.surge + .45, 77, .09, .2, .6);
// Το πέρασμα στο σκούρο: κοφτή, φωτεινή συγχορδία πάνω σε βαθύ χτύπημα.
boom(REEL.cut, .26);
ch('F4', 'A4', 'C5', 'E5').forEach((m, i) => pluck(REEL.cut + i * .012, m, .07, (i - 1.5) * .3, .7));

// ── 4 · Η εφαρμογή ───────────────────────────────────────────────────────
whoosh(REEL.product - .45, .6, .1, true);
// Αρπίσματα σε όγδοα πάνω στις συγχορδίες: η μουσική ανοίγει μαζί με την εικόνα.
for (let t = REEL.product, i = 0; t < REEL.end - .05; t += BEAT / 2, i++) {
  const c = chordAt(t), notes = [...c.slice(1), c[1] + 12, c[2] + 12];
  pluck(t, notes[i % notes.length] + 12, .045, i % 2 ? .45 : -.45, .45);
}
for (let i = 0; i < 4; i++) pluck(REEL.product + 1.2 + i * BEAT, [84, 86, 88, 91][i], .05, (i % 2 ? -1 : 1) * .3, .5); // τα κουμπάκια

// ── 5 · Η μάρκα ──────────────────────────────────────────────────────────
whoosh(REEL.end - .3, .55, .08, false);
[72, 76, 79, 83, 88].forEach((m, i) => bell(REEL.end + .15 + i * .07, m, .05, (i - 2) * .22));
bell(REEL.end + .85, 84, .035);

// ── Αντήχηση: μια μικρή αίθουσα (Schroeder), για βάθος χωρίς θολούρα ─────
{
  const comb = (d: number, fb: number, damp: number) => { const buf = new Float32Array(d); let i = 0, lp = 0; return (x: number) => { const y = buf[i]; lp = y * (1 - damp) + lp * damp; buf[i] = x + lp * fb; i = (i + 1) % d; return y; }; };
  const allp = (d: number, g: number) => { const buf = new Float32Array(d); let i = 0; return (x: number) => { const b = buf[i]; const y = -x + b; buf[i] = x + b * g; i = (i + 1) % d; return y; }; };
  const scale = SR / 44100;
  const mk = (off: number) => ({
    combs: [1557, 1617, 1491, 1422, 1277, 1356].map(d => comb(Math.round((d + off) * scale), .8, .32)),
    aps: [556, 441, 341].map(d => allp(Math.round((d + off) * scale), .5)),
  });
  const rl = mk(0), rr = mk(23);
  const pre = Math.round(.018 * SR);
  for (let i = 0; i < N; i++) {
    const x = i >= pre ? SEND[i - pre] * .15 : 0;
    let yl = 0, yr = 0;
    for (const c of rl.combs) yl += c(x);
    for (const c of rr.combs) yr += c(x);
    for (const a of rl.aps) yl = a(yl);
    for (const a of rr.aps) yr = a(yr);
    L[i] += yl * .55; R[i] += yr * .55;
  }
}

// ── Τελικό: ένταση, μαλακό όριο, σβήσιμο ─────────────────────────────────
{
  let sum = 0;
  for (let i = 0; i < N; i++) sum += L[i] * L[i] + R[i] * R[i];
  const gain = Math.pow(10, -15 / 20) / Math.sqrt(sum / (2 * N));   // περίπου −15 dBFS RMS
  const fadeIn = idx(.02), fadeOut = idx(REEL.dur - 1.3);
  const pcm = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const env = Math.min(1, i / fadeIn) * (i > fadeOut ? Math.pow((N - i) / (N - fadeOut), 1.5) : 1);
    const l = Math.tanh(L[i] * gain * 1.1) * .94 * env, r = Math.tanh(R[i] * gain * 1.1) * .94 * env;
    pcm.writeInt16LE(Math.round(l * 32767), i * 4);
    pcm.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22);
  head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  writeFileSync(join(DIR, 'sound.wav'), Buffer.concat([head, pcm]));
}

// ── Εικόνα και ήχος σε ένα αρχείο ────────────────────────────────────────
const video = join(DIR, 'reel.mp4');
if (!existsSync(video)) throw new Error('Λείπει το reel.mp4· τρέξε πρώτα το reelEnoikio.ts.');
const out = join(DIR, 'PROPERWISE-reel-1.mp4');
const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', video, '-i', join(DIR, 'sound.wav'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', String(SR), '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('Το ffmpeg απέτυχε.');
console.log(`✓ ${out}`);
