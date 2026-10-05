// ═══════════════════════════════════════════════════════════════════════════
// Ο ΗΧΟΣ ΤΟΥ REEL «ΠΩΣ ΞΕΚΙΝΗΣΕ ΤΟ PROPERWISE»
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  npx tsx scripts/marketing/reelOriginSound.ts   (μετά το reelOrigin.ts)
//
// Η ΜΟΥΣΙΚΗ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΙΣΤΟΡΙΑ, ΣΤΟ ΙΔΙΟ ΠΛΕΓΜΑ ΜΕ ΤΗΝ ΕΙΚΟΝΑ.
//   Άγκιστρο     μόνο πατάκι και τέσσερα κλικ, ένα σε κάθε λέξη· η ταινία κολλά.
//   Απόδειξη     ο ρυθμός μπαίνει. Τα βηματάκια του εκτυπωτή, η σφραγίδα.
//   Τοίχος       το ρολό: θόρυβος που ανεβοκατεβαίνει με το χέρι.
//   Υποχρεώσεις  τέσσερις κάρτες, τέσσερα χτυπήματα στο τραπέζι.
//   Ειρωνεία     ο μετρητής, πέντε νότες για τα πέντε έτη, ένα φάλτσο στο ×.
//   Προϊόν       η δέσμη της σάρωσης, το κουμπί, το «έτοιμος».
//   Όραμα        ο ρυθμός φεύγει· μένουν πατάκι και καμπάνες ως τη μάρκα.
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Mix, ch, mux } from './synth';
import { ORIGIN, BEAT, SCENES } from './reelOriginTimeline';

const DIR = join(process.cwd(), 'docs/marketing/reels/reel-origin');
const O = ORIGIN, S = SCENES;
const m = new Mix(O.dur);
const BAR = 4 * BEAT;

// ── Αρμονία: Ρε ελάσσονα που ανοίγει σε Φα μείζονα στο όραμα ─────────────
const CHORDS: [number, number[]][] = [
  [0, ch('D3', 'A3', 'C4', 'F4')],                              // Dm7
  [O.receipt, ch('D3', 'A3', 'C4', 'F4')],
];
const PROG = [ch('D3', 'A3', 'C4', 'F4'), ch('A#2', 'F3', 'A3', 'D4'), ch('F2', 'C3', 'A3', 'E4'), ch('C3', 'G3', 'A#3', 'E4')];
for (let t = O.receipt, i = 0; t < O.vision - .01; t += BAR, i++) CHORDS.push([t, PROG[i % 4]]);
CHORDS.push([O.vision, ch('F2', 'C3', 'E3', 'A3', 'G4')]);      // Fmaj9: το όραμα
CHORDS.push([O.end, ch('F2', 'C3', 'A3', 'E4', 'G4')]);         // ως το τέλος
m.pad(CHORDS, .022);
m.bass(CHORDS, O.receipt, O.vision);

// ── 1 · Άγκιστρο ─────────────────────────────────────────────────────────
[.15, .27, .39, .62].forEach((s, i) => m.click(s, 2400 + i * 180, .08, (i - 1.5) * .2));
m.pluck(.62, 77, .05, 0, .6);
m.click(1.3, 1800, .05); m.click(1.85, 1800, .04);
m.whoosh(.9, 1.7, .05, true);                                    // η λάμψη στον τοίχο
m.click(2.5, 700, .14); m.kick(2.5, .35);                        // η ταινία κολλά
m.whoosh(O.receipt - 1.2, 1.2, .12, true);

// ── Ρυθμός, από την απόδειξη ως το όραμα ────────────────────────────────
const kicks: number[] = [];
for (let t = O.receipt, i = 0; t < O.vision - .01; t += BEAT, i++) {
  kicks.push(t);
  if (i % 2 === 1) m.clap(t, .07);
}
for (let t = O.receipt + BEAT / 2; t < O.vision - .01; t += BEAT / 2) m.hat(t, (Math.round(t / (BEAT / 2)) % 2 ? .026 : .036));
kicks.forEach(k => m.kick(k, .85));
m.duck(kicks, .3);
S.slice(1).forEach((s, i) => { m.whoosh(s - .35, .5, .06, true); m.pluck(s + .05, [81, 77, 84, 79, 81, 86][i], .045, 0, .5); });

// ── 2 · Απόδειξη: εκτυπωτής, μαρκαδόρος, σφραγίδα ───────────────────────
{
  const a = O.receipt;
  // Ίδια βήματα με την εικόνα: 26 βηματάκια ανάμεσα στο .45 και στο 2.55.
  for (let k = 0; k < 26; k++) {
    const x = k / 26, eio = x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    m.click(a + .45 + 2.1 * eio, 3200 + (k % 3) * 300, .035, .15);
  }
  m.sweep(a + 2.75, .4, 1800, 2600, .015);                       // ο μαρκαδόρος
  m.boom(a + 3.55, .22); m.clap(a + 3.55, .12); m.click(a + 3.55, 500, .2);
  m.sweep(a + 3.85, .6, 1400, 1900, .012);                       // «+ ένα χέρι στον γύψο»
}

// ── 3 · Τοίχος: το ρολό ─────────────────────────────────────────────────
{
  const a = O.wall + .55, len = 2.2;
  let y = 0;
  m.add(a, len, -.1, .15, t => {
    const k = t / len, stroke = Math.abs(Math.cos(t * 7.5)), fc = 900 + 1400 * stroke;
    const al = 1 - Math.exp(-2 * Math.PI * fc / 48000);
    y += al * (m.noise() - y);
    return y * (.25 + .75 * stroke) * Math.sin(Math.PI * k) * .16;
  });
  m.bell(O.wall + 2.6, 84, .035, .3);
}

// ── 4 · Υποχρεώσεις: τέσσερις κάρτες στο τραπέζι ────────────────────────
for (let k = 0; k < 4; k++) {
  const s = O.dues + .5 + k * .42 + .28;
  m.click(s, 600, .12, (k % 2 ? .25 : -.25)); m.kick(s, .3);
  m.pluck(s + .12, [74, 72, 70, 69][k], .04, (k % 2 ? .3 : -.3), .4);
}

// ── 5 · Ειρωνεία: μετρητής, πέντε έτη, το × ─────────────────────────────
for (let s = .55; s < 1.7; s += 1 / 18) m.click(O.irony + s, 3600, .025, -.2);
for (let k = 0; k < 5; k++) m.pluck(O.irony + .96 + k * .13 + .15, [77, 81, 84, 88, 89][k], .045, (k - 2) * .2, .5);
[0, 1, 2].forEach(k => m.pluck(O.irony + 2.45 + k * .22 + .1, 84 + k * 4, .04, .2, .4));
m.pluck(O.irony + 3.45, 61, .07, 0, .3); m.pluck(O.irony + 3.46, 62, .06, 0, .3);   // φάλτσο: η δουλειά που κάνεις μόνος

// ── 6 · Προϊόν ───────────────────────────────────────────────────────────
m.whoosh(O.product + .05, .9, .06, true);
m.sweep(O.product + .75, .85, 700, 2400, .03);
m.pluck(O.product + 1.7, 88, .05, .2, .5);
m.click(O.product + 2.6, 1500, .1); m.pluck(O.product + 2.65, 91, .05, 0, .5);
for (let k = 0; k < 3; k++) m.pluck(O.product + 3.1 + k * .17, [84, 88, 91][k], .035, .3, .4);
m.bell(O.product + 3.75, 96, .03, .2);

// ── 7 · Όραμα και μάρκα ─────────────────────────────────────────────────
m.boom(O.vision, .18);
ch('F5', 'A5', 'C6', 'E6', 'G6').forEach((x, i) => m.bell(O.vision + .25 + i * .32, x, .03, (i - 2) * .25));
m.whoosh(O.end - .7, .7, .1, true);
m.boom(O.end, .24);
ch('F5', 'A5', 'C6', 'E6', 'A6').forEach((x, i) => m.bell(O.end + .05 + i * .07, x, .05, (i - 2) * .22));
m.bell(O.end + .8, 77, .035);

m.reverb();
const wav = join(DIR, 'sound.wav');
m.write(wav, 1.8);
const video = join(DIR, 'reel.mp4');
if (!existsSync(video)) throw new Error('Λείπει το reel.mp4· τρέξε πρώτα το reelOrigin.ts.');
const out = join(DIR, 'PROPERWISE-pos-xekinise.mp4');
mux(video, wav, out);
console.log(`✓ ${out}`);
