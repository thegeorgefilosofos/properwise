// Κάθε ορατή συμβολοσειρά της ταινίας και κάθε ενότητα του share-copy.md από το
// copyFails του scripts/marketing/shorts/qa.ts, συν οι κανόνες του kamari που δεν
// καλύπτει (μεγάλη παύλα, «δωρεάν», ψηφία χωρίς γραμμή στον πίνακα του plan.md).
//
//   npx tsx docs/marketing/kamari/2026-11-23-ena-meros/qa-copy.ts; echo "κωδικός: $?"
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFails, LIMITS } from '../../../../scripts/marketing/shorts/qa';

const here = dirname(fileURLToPath(import.meta.url));
const film = readFileSync(join(here, 'film.html'), 'utf8');
const copy = readFileSync(join(here, 'share-copy.md'), 'utf8');
const plan = readFileSync(join(here, 'plan.md'), 'utf8');

// Οι ορατές συμβολοσειρές: ό,τι περνά στο text(…), οι λεζάντες, η ετικέτα και ο δρομέας.
const visible: string[] = [];
for (const m of film.matchAll(/text\('[^']*',\s*'([^']+)'/g)) visible.push(m[1]);
for (const m of film.matchAll(/\[\d+, \d+, '([^']+)'\]/g)) visible.push(m[1]);
for (const m of film.matchAll(/<div id="(?:badge|who)">([^<]+)<\/div>/g)) visible.push(m[1]);
visible.push('16.000€');

const sections = copy.split(/^## /m).slice(1).map((s) => ({ where: s.split('\n')[0], text: s.slice(s.indexOf('\n') + 1).trim() }));
const fails: string[] = [];
for (const v of visible) fails.push(...copyFails(v, 'ταινία'));
for (const s of sections) fails.push(...copyFails(s.text, s.where));
for (const s of [...visible.map((text) => ({ where: 'ταινία', text })), ...sections]) {
  if (/—/.test(s.text)) fails.push(`${s.where}: μεγάλη παύλα`);
  if (/δωρεάν/i.test(s.text)) fails.push(`${s.where}: «δωρεάν»`);
  if (/βοηθ/i.test(s.text)) fails.push(`${s.where}: «βοηθός»`);
}
// Κάθε ψηφίο αυτούσιο στον πίνακα αριθμών (εκτός από τους συνδέσμους και τα ονόματα αρχείων).
const table = plan.slice(plan.indexOf('## Αριθμοί'), plan.indexOf('## Αποφάσεις'));
const all = [...visible, ...sections.map((s) => s.text.replace(/https?:\S+/g, '').replace(/`[^`]*`/g, ''))].join('\n');
for (const tok of new Set(all.match(/[\dΑ-Ωα-ω]*\d[\d.,/€]*/g) ?? [])) {
  const t = tok.replace(/[.,]$/, '');
  if (!table.includes(t)) fails.push(`ψηφίο χωρίς γραμμή στον πίνακα: «${t}»`);
}
// Μήκη.
const ig = sections.find((s) => s.where === 'Instagram')!.text;
const firstLine = /Πρώτη γραμμή[^:]*:\s*(.+)/.exec(ig)![1];
if ([...firstLine].length > LIMITS.firstLine) fails.push(`Instagram πρώτη γραμμή: ${[...firstLine].length}`);
const tags = ig.match(/#\S+/g) ?? [];
if (tags.length > LIMITS.igHashtags) fails.push(`Instagram: ${tags.length} hashtags`);
const x = sections.find((s) => s.where === 'X')!.text;
if ([...x].length > 280) fails.push(`X: ${[...x].length} χαρακτήρες`);
const yt = /Τίτλος:\s*(.+)/.exec(sections.find((s) => s.where === 'YouTube Shorts')!.text)![1];
if ([...yt].length > LIMITS.ytTitle) fails.push(`YouTube τίτλος: ${[...yt].length}`);
if ([...yt.replace(/\s*#Shorts$/, '')].length > LIMITS.ytTitleVisible) fails.push('YouTube τίτλος, ορατό μέρος');
const pinned = sections.find((s) => s.where === 'Καρφιτσωμένο σχόλιο')!.text;
if ([...pinned].length > LIMITS.pinned) fails.push(`καρφιτσωμένο: ${[...pinned].length}`);

console.log(`ορατές συμβολοσειρές ταινίας: ${visible.length} · ενότητες: ${sections.length}`);
for (const v of visible) console.log('  ·', v);
if (fails.length) { console.log('ΑΠΟΤΥΧΙΕΣ:\n' + fails.join('\n')); process.exit(1); }
console.log('✓ καμία αποτυχία');
