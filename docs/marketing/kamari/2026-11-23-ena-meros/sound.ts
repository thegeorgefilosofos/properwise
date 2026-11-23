// Ο ήχος της ταινίας, συντεθειμένος με το scripts/marketing/synth.ts.
// Οι χρόνοι έρχονται από το χρονολόγιο του film.html (μία πηγή): χτύποι, βυθίσεις, πατήματα.
//
//   npx tsx docs/marketing/kamari/2026-11-23-ena-meros/sound.ts <έξοδος.wav>
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mix, n, ch } from '../../../../scripts/marketing/synth';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'film.html'), 'utf8');
const json = /<script id="timeline" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
if (!json) throw new Error('Λείπει το χρονολόγιο από το film.html');
const TL = JSON.parse(json[1]) as {
  bpm: number; beats: number; scenes: number[]; turns: number[]; reveal: number; rowsOver: number[]; sheetUp: number;
  fill: [number, number]; ticks: number[]; rowsDocs: number[]; taps: number[]; packUp: number; rowsPack: number[];
  entries: number[]; bells: number[]; chords: [number, string[]][];
};
const BEAT = 60 / TL.bpm, B = (b: number) => b * BEAT, DUR = B(TL.beats);
const out = process.argv[2];
if (!out) throw new Error('Δώσε αρχείο εξόδου');

const m = new Mix(DUR);
const chords = TL.chords.map(([b, notes]) => [B(b), ch(...notes)] as [number, number[]]);
m.pad(chords, .022);
// Το μπάσο μπαίνει με την αποκάλυψη και φεύγει στο τελευταίο μέτρο.
m.bass(chords, B(TL.reveal), B(TL.beats - 2), .05);
// Μπάσο που αναπνέει στα όγδοα: ο παλμός του τέμπο.
for (let b = TL.reveal; b < TL.beats - 4; b++) { const notes = [...TL.chords].reverse().find(([cb]) => cb <= b)![1]; m.pluck(B(b) + BEAT / 2, n(notes[0]) + 12, .035, 0, .05); }

// Παλμός: κρουστό κάθε δύο χτύπους από την αποκάλυψη, πιο αραιό στο αγκίστρι· ελαφρύ μεταλλικό σε κάθε μισό χτύπο.
const kicks: number[] = [];
for (let b = 0; b < TL.beats - 2; b++) {
  const t = B(b), on = b >= TL.reveal;
  // Στο μήνυμα: κρουστό κάθε δύο χτύπους. Μετά: σε κάθε χτύπο, παλαμάκι στο 2 και στο 4, μεταλλικό στα όγδοα και στα δέκατα έκτα.
  if (on || b % 2 === 0) { m.kick(t, on ? .9 : .7); kicks.push(t); }
  m.hat(t + BEAT / 2, on ? .034 : .02, b % 2 ? .35 : -.35);
  if (on) { m.hat(t + BEAT / 4, .014, .5); m.hat(t + 3 * BEAT / 4, .014, -.5); }
  if (on && b % 2 === 1) m.clap(t, .06);
}
// Οι ήχοι της διεπαφής, στους χρόνους του film.html. Δύο πατήματα μόνο σε όλη την ταινία:
// το μήνυμα είναι ότι σχεδόν τίποτα δεν πατάς. Ο,τι γίνεται μόνο του ακούγεται απαλά.
m.whoosh(B(TL.reveal) - .1, .5, .045, true);
m.boom(B(TL.reveal) + .3, .14);
for (const b of TL.turns) m.whoosh(B(b) - .25, .45, .04, true);
m.whoosh(B(TL.scenes[4]) - .1, .45, .04, false);
for (const b of TL.taps) { m.click(B(b), 2200, .22, .15); m.click(B(b) + .03, 1100, .08, .15); }
for (const b of [TL.sheetUp, TL.packUp]) m.sweep(B(b), .4, 330, 700, .02);
// Γραμμές που εμφανίζονται μόνες τους: νότες της συγχορδίας, ανεβαίνοντας.
for (const list of [TL.rowsOver, TL.rowsDocs, TL.rowsPack]) list.forEach((b, i) => {
  const notes = [...TL.chords].reverse().find(([cb]) => cb <= b)![1];
  m.pluck(B(b), n(notes[i % notes.length]) + 12, .03, (i % 2 ? .25 : -.25));
});
m.sweep(B(TL.fill[0]), B(TL.fill[1]) - B(TL.fill[0]), 900, 1800, .012);
for (const b of TL.ticks) m.pluck(B(b), n('E5'), .045, .2);
for (const b of TL.entries) {
  const notes = [...TL.chords].reverse().find(([cb]) => cb <= b)![1];
  m.pluck(B(b), n(notes[notes.length - 1]) + 12, .04, -.2);
}
for (const b of TL.bells) m.bell(B(b), n('E5'), .06);

m.duck(kicks, .28);
m.reverb(.5);
m.write(out, 1.3);
console.log(`✓ ${out} · ${DUR.toFixed(2)}″`);
