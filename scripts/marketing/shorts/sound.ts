// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · Η ΜΟΥΣΙΚΗ
// ─────────────────────────────────────────────────────────────────────────
// Πρωτότυπη, από το synth.ts (κανένα κομμάτι τρίτου). Κάθε σειρά έχει δικό
// της μοτίβο: οι προθεσμίες ένα ρολόι σε ελάσσονα, η βραχυχρόνια νότες που
// τσιμπιούνται, η μακροχρόνια παλμό. Ο ρυθμός είναι το πλέγμα της εικόνας:
// κάθε κόψιμο πέφτει σε χτύπο. Έναν χτύπο πριν από κάθε πέρασμα τα τύμπανα
// σωπαίνουν και ανεβαίνει ένα σάρωμα· στο κόψιμο χτυπά. Στους αριθμούς,
// κρούση.
//
// ΤΟ ΤΑΒΑΝΙ. Το synth.Mix.write φτάνει τα −0,5 dBFS και δεν αλλάζει (το
// χρησιμοποιούν άλλα reels). Εδώ γράφεται δικό μας WAV: ένταση γύρω στα
// −14,5 dBFS RMS και μαλακός περιοριστής με ταβάνι −2 dBFS, ώστε μετά το AAC
// η κορυφή να μένει κάτω από −1 dB (ο έλεγχος `gateAudio` το μετρά στο mp4).
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs';
import { Mix, SR, n } from '../synth';
import type { Built } from './spec';
import { TRANSITIONS, accentMidi } from './transitions';
import type { Page } from './engine';

export function score(b: Built, pg: Page): Mix {
  const { s, beat, dur, at } = b;
  const m = new Mix(dur);
  const bar = 4 * beat;
  const prog = s.motif.prog.map(c => c.map(n));
  const chords: [number, number[]][] = [];
  for (let t = 0, i = 0; t < dur - .01; t += bar, i++) chords.push([t, prog[i % prog.length]]);
  m.pad(chords, .02);
  m.bass(chords, 0, dur, .05);
  const cuts = pg.trs.map(x => x.B);
  // Σιωπή πριν από κάθε κόψιμο και όπου μια σκηνή ζητά να μείνει μόνο το χαλί (`hush`).
  const hush = pg.outs.flatMap(o => o.hush ?? []);
  const quiet = (t: number) => cuts.some(B => t >= B - beat - .01 && t < B - .01) || hush.some(([a, z]) => t >= a - .01 && t < z - .01);
  const kicks: number[] = [];
  // Ο σφυγμός: από το καρέ 0, για να μη χαθεί το πρώτο δευτερόλεπτο.
  for (let t = 0, i = 0; t < dur - .05; t += beat, i++) {
    if (quiet(t)) continue;
    const down = i % 4 === 0;
    if (s.motif.feel === 'pluck') { if (i % 2 === 0) { m.kick(t, down ? .94 : .7); kicks.push(t); } }
    else { m.kick(t, down ? 1 : .8); kicks.push(t); }
    if (i % 4 === 2) m.clap(t, .06);
    m.hat(t + beat / 2, .03, i % 2 ? .35 : -.35);
    if (s.motif.feel === 'tick') m.click(t + beat / 4, 3800, .018, .5);
  }
  // Το μοτίβο: ογδοα πάνω στη συγχορδία, φράση της σειράς.
  const root = n(`${s.motif.root}5`);
  for (let t = 0, i = 0; t < dur - .2; t += beat / 2, i++) {
    if (quiet(t)) continue;
    const ch = chords[Math.min(chords.length - 1, Math.floor(t / bar))][1];
    const lead = s.motif.lead[i % s.motif.lead.length];
    if (s.motif.feel === 'tick') m.pluck(t, (i % 2 ? ch[(i >> 1) % ch.length] + 12 : root + lead - 12), .014, i % 2 ? .4 : -.4, .35);
    else m.pluck(t, ch[i % ch.length] + 12 + (i % 8 >= 4 ? 12 : 0), .016, i % 2 ? .4 : -.4, .45);
    if (i % 8 === 0) m.pluck(t, root + lead, .022, 0, .5);
  }
  // Περάσματα: σάρωμα πριν, χτύπημα πάνω στο κόψιμο, ήχος του περάσματος.
  const am = accentMidi(s.motif.root);
  for (const tr of pg.trs) { m.sweep(tr.B - 1.2, 1.2, 220, 1300, .012); TRANSITIONS[tr.name as keyof typeof TRANSITIONS].sfx(m, tr.B, am); }
  // Αγκίστρι: χτύπημα στο καρέ 0.
  m.boom(0, .45); m.kick(0, 1); m.clap(0, .08);
  pg.outs.forEach(o => o.sfx?.(m));
  pg.hits.forEach(h => { m.boom(h, .12); m.click(h, 700, .07); });
  m.duck(kicks, .3);
  // Κλείσιμο που δένει με την αρχή: η πρώτη συγχορδία, για να ξαναρχίσει ομαλά.
  ch0(m, prog[0], dur - bar / 2);
  m.reverb(.5);
  void at;
  return m;
}
const ch0 = (m: Mix, chord: number[], t: number) => chord.forEach((x, i) => m.bell(t + i * .04, x + 24, .018, (i - 1.5) * .25));

/**
 * WAV 16 bit με ταβάνι: ένταση σε `rmsDb` dBFS και μαλακός περιοριστής στο
 * `ceilDb`, που η κορυφή του δεν τον περνά ποτέ (c·tanh(x/c) < c).
 */
export function writeWav(m: Mix, path: string, o: { rmsDb?: number; ceilDb?: number; fadeIn?: number; fadeOut?: number } = {}) {
  const rmsDb = o.rmsDb ?? -14.5, c = Math.pow(10, (o.ceilDb ?? -2) / 20);
  let sum = 0;
  for (let i = 0; i < m.N; i++) sum += m.L[i] * m.L[i] + m.R[i] * m.R[i];
  const gain = Math.pow(10, rmsDb / 20) / Math.sqrt(sum / (2 * m.N));
  const fi = Math.max(1, Math.round((o.fadeIn ?? .004) * SR)), fo = Math.round((o.fadeOut ?? .25) * SR);
  const pcm = Buffer.alloc(m.N * 4);
  let peak = 0;
  for (let i = 0; i < m.N; i++) {
    const env = Math.min(1, i / fi) * Math.min(1, (m.N - i) / fo);
    const l = c * Math.tanh(m.L[i] * gain / c) * env, r = c * Math.tanh(m.R[i] * gain / c) * env;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    pcm.writeInt16LE(Math.round(l * 32767), i * 4);
    pcm.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22);
  head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  writeFileSync(path, Buffer.concat([head, pcm]));
  return { peakDb: 20 * Math.log10(peak) };
}
