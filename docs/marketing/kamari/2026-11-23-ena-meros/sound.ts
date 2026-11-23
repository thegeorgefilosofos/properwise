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
  bpm: number; beats: number; dips: number[]; taps: number[]; swipe: [number, number];
  entries: number[]; bells: number[]; reveal: number; chords: [number, string[]][];
};
const BEAT = 60 / TL.bpm, B = (b: number) => b * BEAT, DUR = B(TL.beats);
const out = process.argv[2];
if (!out) throw new Error('Δώσε αρχείο εξόδου');

const m = new Mix(DUR);
const chords = TL.chords.map(([b, notes]) => [B(b), ch(...notes)] as [number, number[]]);
m.pad(chords, .022);
// Το μπάσο μπαίνει με την αποκάλυψη και φεύγει στο τελευταίο μέτρο.
m.bass(chords, B(TL.reveal), B(TL.beats - 2), .045);

// Παλμός: κρουστό κάθε δύο χτύπους από την αποκάλυψη, πιο αραιό στο αγκίστρι· ελαφρύ μεταλλικό σε κάθε μισό χτύπο.
const kicks: number[] = [];
for (let b = 0; b < TL.beats - 1; b++) {
  const t = B(b);
  if (b < TL.reveal ? b % 4 === 0 : b % 2 === 0) { m.kick(t, b < TL.reveal ? .6 : .85); kicks.push(t); }
  m.hat(t + BEAT / 2, b < TL.reveal ? .018 : .028, b % 2 ? .35 : -.35);
  if (b >= TL.reveal && b % 4 === 2 && b < 63) m.clap(t, .05);
}
// Ο ήχος του σχήματος: σφύριγμα με κορυφή (μέση του) πάνω στο κέντρο κάθε βύθισης.
for (const b of TL.dips) { const len = .5; m.whoosh(B(b) - len / 2, len, .05, b !== 63); }
m.boom(B(TL.reveal), .22);
// Τα πατήματα του δρομέα: κλικ με την κορυφή στο πάτημα.
for (const b of TL.taps) { m.click(B(b), 1800, .32, .2); m.click(B(b) + .035, 900, .14, .2); }
// Το σύρσιμο.
m.sweep(B(TL.swipe[0]), B(TL.swipe[1]) - B(TL.swipe[0]), 700, 300, .03);
// Οταν μπαίνει νέο κείμενο: μια νότα από τη συγχορδία της στιγμής.
for (const b of TL.entries) {
  const notes = [...TL.chords].reverse().find(([cb]) => cb <= b)![1];
  m.pluck(B(b), n(notes[notes.length - 1]) + 12, .05, -.2);
}
for (const b of TL.bells) m.bell(B(b), n('E5'), .06);

m.duck(kicks, .28);
m.reverb(.5);
m.write(out, 1.3);
console.log(`✓ ${out} · ${DUR.toFixed(2)}″`);
