// ═══════════════════════════════════════════════════════════════════════════
// Ο ΗΧΟΣ ΤΟΥ ΔΕΥΤΕΡΟΥ REEL, «ΒΑΛΕ ΤΟ ΑΚΙΝΗΤΟ ΣΟΥ ΣΕ ΤΑΞΗ»
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelTaxiSound.ts   (μετά το reelTaxi.ts)
//
// Η ΜΟΥΣΙΚΗ ΛΕΕΙ ΤΗΝ ΙΔΙΑ ΙΣΤΟΡΙΑ ΜΕ ΤΗΝ ΕΙΚΟΝΑ, ΣΤΟ ΙΔΙΟ ΠΛΕΓΜΑ.
//   Χάος      βουητό που ανεβαίνει, ένα ξερό χτύπημα χαρτιού σε κάθε λέξη.
//   Τάξη      χτύπημα και ανοιχτή μείζονα· οι επτά γραμμές κουμπώνουν με
//             επτά νότες που ανεβαίνουν.
//   Κεφάλαια  ρυθμός: μπότα, παλαμάκια, χάι-χατ, μπάσο. Κάθε κεφάλαιο έχει
//             τον δικό του ήχο: σάρωση, μήνυμα, ειδοποίηση, μετρητής, χαρτί.
//   Μάρκα     τα πλακίδια σε αρπίσματα, πλάγια πτώση (Φα → Ντο) και καμπάνα.
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Mix, ch, mux } from './synth';
import { TAXI, BEAT } from './reelTaxiTimeline';

const DIR = join(process.cwd(), 'docs/marketing/reels/reel-2');
const R = TAXI, CH = R.chapters;
const m = new Mix(R.dur);

// ── Αρμονία ──────────────────────────────────────────────────────────────
const BAR = 4 * BEAT;
const CHORDS: [number, number[]][] = [
  [0, ch('A2', 'E3', 'B3', 'C4')],                            // Am(add9): το χάος, χαμηλά
  [R.snap, ch('C3', 'G3', 'B3', 'D4', 'E4')],                 // Cmaj9: η τάξη
  [CH[0], ch('C3', 'G3', 'B3', 'E4')],                        // Cmaj7
  [CH[0] + 2 * BAR, ch('A2', 'E3', 'G3', 'C4')],              // Am7
  [CH[0] + 4 * BAR, ch('F2', 'C3', 'E3', 'A3')],              // Fmaj7
  [CH[0] + 6 * BAR, ch('G2', 'D3', 'E3', 'B3')],              // G6
];
for (let t = CH[0] + 8 * BAR, i = 0; t < R.recap - .01; t += 2 * BAR, i++) CHORDS.push([t, [ch('C3', 'G3', 'B3', 'E4'), ch('A2', 'E3', 'G3', 'C4')][i % 2]]);
CHORDS.push([R.recap, ch('F2', 'C3', 'E3', 'A3', 'G4')]);     // Fmaj9
CHORDS.push([R.end, ch('C3', 'G3', 'B3', 'D4', 'E4')]);       // Cmaj9 ως το τέλος
m.pad(CHORDS);
m.bass(CHORDS, CH[0], R.end);

// ── 0 · Χάος ─────────────────────────────────────────────────────────────
// Βουητό που ανεβαίνει ως το κούμπωμα.
m.add(0, R.snap, 0, .2, t => {
  const k = t / R.snap, f = 55 * (1 + .5 * k);
  return (Math.sin(2 * Math.PI * f * t) + .4 * Math.sin(2 * Math.PI * f * 2.01 * t) + .2 * Math.sin(2 * Math.PI * f * 3.02 * t)) * (.04 + .06 * k) * Math.min(1, t / .05);
});
R.words.forEach((w, i) => { m.click(w, 2600 + i * 200, .09, (i % 2 ? .3 : -.3)); m.kick(w, .55); });
m.click(R.scatter, 3000, .08); m.kick(R.scatter, .55);
m.whoosh(R.scatter, R.snap - R.scatter, .14, true);

// ── Τάξη ─────────────────────────────────────────────────────────────────
m.boom(R.snap, .3);
ch('C4', 'G4', 'E5').forEach((x, i) => m.pluck(R.snap + i * .01, x, .07, (i - 1) * .4, .6));
ch('C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6').forEach((x, i) => m.pluck(R.snap + .55 + i * .06, x, .045, (i - 3) * .12, .5));

// ── Ρυθμός των κεφαλαίων ─────────────────────────────────────────────────
const kicks: number[] = [];
for (let t = R.snap + 2 * BEAT, i = 0; t < R.recap - .01; t += BEAT, i++) {
  kicks.push(t);
  if (t >= CH[0] && i % 2 === 1) m.clap(t);
}
for (let t = CH[0] + BEAT / 2; t < R.recap - .01; t += BEAT / 2) m.hat(t, (Math.round(t / (BEAT / 2)) % 2 ? .03 : .042));
kicks.forEach(k => m.kick(k));
m.duck(kicks);
// Κάθε κεφάλαιο μπαίνει με ένα πέρασμα και μια νότα.
CH.forEach((c, i) => { m.whoosh(c - .35, .5, .07, true); m.pluck(c + .05, [79, 81, 84, 83, 79, 84][i], .05, 0, .5); });

// 01 · Σάρωση: η δέσμη, τρία σήματα στα πεδία, ένα «καταχωρήθηκε».
m.sweep(CH[0] + .5, .75, 700, 2400, .035);
[.8, .8 + .15, 1.1].forEach((s, i) => m.pluck(CH[0] + s, [84, 88, 91][i], .035, .2, .4));
m.pluck(CH[0] + 1.5, 88, .07); m.pluck(CH[0] + 1.57, 96, .05);
// 02 · Νόα: αποστολή, απάντηση.
m.pluck(CH[1] + .15, 88, .06, .3, .5); m.pluck(CH[1] + .2, 93, .04, .3, .5);
m.bell(CH[1] + 1.05, 84, .03); m.bell(CH[1] + 1.12, 88, .025, .3);
// 03 · Προθεσμίες: η ειδοποίηση.
m.bell(CH[2] + 1.2, 88, .05, -.2); m.bell(CH[2] + 1.36, 84, .045, .2);
// 04 · Σύγκριση: οι μετρητές.
for (let s = .35; s < 1.5; s += 1 / 16) m.click(CH[3] + s, 3400, .03, s < 1.2 ? -.25 : .25);
// 05 · Λογιστής: τρία χαρτιά στον φάκελο και το «έτοιμο».
// Τα χαρτιά ξεκινούν στο .4, .7, 1.0 και κάθονται περίπου .3 αργότερα.
[.4, .7, 1.0].forEach(s => { m.click(CH[4] + s + .3, 900, .08); m.kick(CH[4] + s + .3, .25); });
m.pluck(CH[4] + 1.8, 84, .06); m.pluck(CH[4] + 1.86, 91, .045);
// 06 · Ταμπλό: το κινητό ανεβαίνει, τα κουμπάκια.
m.whoosh(CH[5] + .05, .7, .06, true);
[1.1, 1.5].forEach((s, i) => m.pluck(CH[5] + s, [88, 91][i], .05, (i ? -1 : 1) * .3, .5));

// ── Ανακεφαλαίωση και μάρκα ──────────────────────────────────────────────
ch('C5', 'E5', 'G5', 'A5', 'C6', 'E6').forEach((x, i) => m.pluck(R.recap + .1 + i * .15, x, .05, (i % 3 - 1) * .4, .5));
m.whoosh(R.end - .6, .6, .1, true);
m.boom(R.end, .24);
ch('C5', 'E5', 'G5', 'B5', 'E6').forEach((x, i) => m.bell(R.end + .05 + i * .07, x, .05, (i - 2) * .22));
m.bell(R.end + .8, 84, .035);

m.reverb();
const wav = join(DIR, 'sound.wav');
m.write(wav, 1.6);
const video = join(DIR, 'reel.mp4');
if (!existsSync(video)) throw new Error('Λείπει το reel.mp4· τρέξε πρώτα το reelTaxi.ts.');
const out = join(DIR, 'PROPERWISE-reel-2.mp4');
mux(video, wav, out);
console.log(`✓ ${out}`);
