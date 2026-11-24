// Ο ήχος της ταινίας (v9), συντεθειμένος με το scripts/marketing/synth.ts.
// Οι χρόνοι έρχονται από το χρονολόγιο του film.html (μία πηγή), σε δευτερόλεπτα.
//
//   npx tsx docs/marketing/kamari/2026-11-23-ena-meros/sound.ts <έξοδος.wav>
//
// Δυναμική (LRA πάνω από 3): χτύπημα στο καρέ 0 και αγκίστρι χωρίς ρυθμό, ήπιος ρυθμός ως την κάμερα, πλήρης από τη φόρμα,
// κλείσιμο με ένα χτύπημα και μετά μόνο πατάκι, πιο χαμηλά. Τα πατήματα τονίζονται: η μουσική
// χαμηλώνει γύρω τους και το κλικ είναι 3,3 dB δυνατότερο από της v7 (0,38 αντί για 0,26).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mix, n, ch, SR } from '../../../../scripts/marketing/synth';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'film.html'), 'utf8');
const json = /<script id="timeline" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
if (!json) throw new Error('Λείπει το χρονολόγιο από το film.html');
const TL = JSON.parse(json[1]) as {
  dur: number; bpm: number; cuts: number[]; full: number; rowsOver: number[]; taps: number[]; fields: number[]; ticks: number[];
  dings: number[]; filed: number; packUp: number; rowsPack: number[]; close: number; chords: [number, string[]][];
};
const out = process.argv[2];
if (!out) throw new Error('Δώσε αρχείο εξόδου');
const BEAT = 60 / TL.bpm, START = TL.cuts[0], END = TL.close;

const m = new Mix(TL.dur);
const chords = TL.chords.map(([t, notes]) => [t, ch(...notes)] as [number, number[]]);
const chordAt = (t: number) => [...TL.chords].reverse().find(([ct]) => ct <= t)![1];
m.pad(chords, .02);
m.bass(chords, START, END, .05);

// Ρυθμός μόνο στο σώμα της ταινίας (από την πρώτη κοπή ως το κλείσιμο), στο πλέγμα των 120 BPM.
const kicks: number[] = [];
for (let t = START; t < END - 1e-6; t += BEAT) {
  const k = Math.round((t - START) / BEAT);
  // Πρώτο μέρος (προθεσμίες, σάρωση ως την κάμερα): μόνο κρουστό και μεταλλικό, πιο ήπια. Από τη φόρμα και μετά: πλήρης ρυθμός.
  const full = t >= TL.full - 1e-6;
  m.kick(t, full ? .9 : .5); kicks.push(t);
  m.hat(t + BEAT / 2, full ? .03 : .016, k % 2 ? .35 : -.35);
  if (full) { m.hat(t + BEAT / 4, .012, .5); m.hat(t + 3 * BEAT / 4, .012, -.5); }
  if (full && k % 2 === 1) m.clap(t, .055);
  if (full) m.pluck(t + BEAT / 2, n(chordAt(t)[0]) + 12, .03, 0, .05);
}
// Χτύπημα στο καρέ 0 και στο κλείσιμο. Κάθε κοπή μέσα στο σώμα: σύντομο φύσημα.
m.boom(0, .22); m.clap(0, .07);
m.boom(END, .16); m.clap(END, .05);
for (const c of TL.cuts.slice(0, -1)) m.whoosh(c - .12, .3, .028, true);
// Οι γραμμές που εμφανίζονται μόνες τους.
for (const list of [TL.rowsOver.map((t) => Math.max(t, START)), TL.rowsPack]) list.forEach((t, i) => {
  const notes = chordAt(t); m.pluck(t, n(notes[i % notes.length]) + 12, .024, i % 2 ? .25 : -.25);
});
// Τα πεδία που εμφανίζονται: ένα λεπτό κλικ το καθένα.
for (const t of TL.fields) m.click(t, 2600, .07, -.15);
m.sweep(TL.packUp, .35, 330, 700, .016);
// «Ding»: πεδία γεμάτα, φάκελος ενημερωμένος, zip έτοιμο.
for (const t of TL.dings) { m.bell(t, n('B5'), .05, .1); m.bell(t + .09, n('E6'), .035, -.1); }
m.bell(END + .05, n('E5'), .045);

m.duck(kicks, .28);
// Καμπύλη έντασης ανά μέρος: αγκίστρι −2,5 dB, πρώτο μέρος −4,4 dB, φόρμα ως zip πλήρες (ράμπες 0,15″).
const LEVELS: [number, number][] = [[0, .75], [START, .6], [TL.full, 1], [END, 1]];
const levelAt = (t: number) => {
  let g = LEVELS[0][1];
  for (let k = 1; k < LEVELS.length; k++) g += (LEVELS[k][1] - LEVELS[k - 1][1]) * Math.min(1, Math.max(0, (t - LEVELS[k][0]) / .15));
  return g;
};
for (let i = 0; i < m.idx(END); i++) { const g = levelAt(i / SR); m.L[i] *= g; m.R[i] *= g; }
// Τονισμός των πατημάτων: η μουσική χαμηλώνει γύρω τους, μετά γράφεται το κλικ, πιο δυνατά.
m.duck(TL.taps.map((t) => t - .02), .45);
for (const t of TL.taps) { m.click(t, 2200, .38, .1); m.click(t + .03, 1100, .14, .1); m.kick(t, .25); }

// Το κλείσιμο πιο χαμηλά από το σώμα: μείωση περίπου 12 dB μετά το πρώτο 0,4″ του.
for (let i = m.idx(END + .4); i < m.N; i++) { const g = 1 - .75 * Math.min(1, (i - m.idx(END + .4)) / m.idx(.5)); m.L[i] *= g; m.R[i] *= g; }
m.reverb(.5);
m.write(out, .6);
console.log(`✓ ${out} · ${TL.dur.toFixed(2)}″`);
