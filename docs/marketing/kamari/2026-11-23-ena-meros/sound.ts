// Ο ήχος της ταινίας (v8), συντεθειμένος με το scripts/marketing/synth.ts.
// Οι χρόνοι έρχονται από το χρονολόγιο του film.html (μία πηγή), σε δευτερόλεπτα.
//
//   npx tsx docs/marketing/kamari/2026-11-23-ena-meros/sound.ts <έξοδος.wav>
//
// Δυναμική (LRA πάνω από 3): το αγκίστρι με χτύπημα και χωρίς ρυθμό, το σώμα με πλήρη ρυθμό,
// το κλείσιμο μόνο με πατάκι και καμπάνα, πιο χαμηλά. Τα πατήματα τονίζονται: η μουσική
// χαμηλώνει 0,12″ γύρω τους και το κλικ είναι 3,3 dB δυνατότερο από της v7 (0,38 αντί για 0,26).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mix, n, ch } from '../../../../scripts/marketing/synth';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'film.html'), 'utf8');
const json = /<script id="timeline" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
if (!json) throw new Error('Λείπει το χρονολόγιο από το film.html');
const TL = JSON.parse(json[1]) as {
  dur: number; bpm: number; cuts: number[]; rowsOver: number[]; taps: number[]; fill: [number, number]; ticks: number[];
  dates: number; dings: number[]; filed: number; packUp: number; rowsPack: number[]; close: number; msgClose: number[]; url: number;
  chords: [number, string[]][];
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
  m.kick(t, .9); kicks.push(t);
  m.hat(t + BEAT / 2, .03, k % 2 ? .35 : -.35);
  m.hat(t + BEAT / 4, .012, .5); m.hat(t + 3 * BEAT / 4, .012, -.5);
  if (k % 2 === 1) m.clap(t, .055);
  m.pluck(t + BEAT / 2, n(chordAt(t)[0]) + 12, .03, 0, .05);
}
// Αγκίστρι: χτύπημα στο καρέ 0. Κάθε κοπή: σύντομο φύσημα.
m.boom(0, .22); m.clap(0, .07);
for (const c of TL.cuts.slice(0, -1)) m.whoosh(c - .12, .3, .028, true);
m.whoosh(END - .1, .4, .03, false);
// Οι γραμμές που εμφανίζονται μόνες τους.
for (const list of [TL.rowsOver, TL.rowsPack]) list.forEach((t, i) => {
  const notes = chordAt(t); m.pluck(t, n(notes[i % notes.length]) + 12, .024, i % 2 ? .25 : -.25);
});
// Τα πεδία που γεμίζουν: λεπτά κλικ πληκτρολόγησης στον Πάροχο, ένα για κάθε ✓.
for (let t = TL.fill[0]; t < TL.fill[1]; t += (TL.fill[1] - TL.fill[0]) / 11) m.click(t, 3200, .045, .2);
for (const t of [...TL.ticks, TL.dates]) m.click(t, 2600, .07, -.15);
m.sweep(TL.packUp, .35, 330, 700, .016);
// «Ding»: πεδία γεμάτα, φάκελος ενημερωμένος, zip έτοιμο.
for (const t of TL.dings) { m.bell(t, n('B5'), .05, .1); m.bell(t + .09, n('E6'), .035, -.1); }
// Κλείσιμο: πιο χαμηλά, χωρίς ρυθμό.
m.bell(END, n('E5'), .045);
TL.msgClose.forEach((t, i) => m.pluck(t, n(chordAt(t)[2 + i % 3]) + 12, .022, -.2 + .2 * i));

m.duck(kicks, .28);
// Τονισμός των πατημάτων: η μουσική χαμηλώνει γύρω τους, μετά γράφεται το κλικ, πιο δυνατά.
m.duck(TL.taps.map((t) => t - .02), .45);
for (const t of TL.taps) { m.click(t, 2200, .38, .1); m.click(t + .03, 1100, .14, .1); m.kick(t, .25); }

// Το κλείσιμο πιο χαμηλά από το σώμα: μείωση περίπου 8 dB μετά το END.
for (let i = m.idx(END); i < m.N; i++) { const g = 1 - .62 * Math.min(1, (i - m.idx(END)) / m.idx(.6)); m.L[i] *= g; m.R[i] *= g; }
m.reverb(.5);
m.write(out, .8);
console.log(`✓ ${out} · ${TL.dur.toFixed(2)}″`);
