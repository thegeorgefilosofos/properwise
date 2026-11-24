// npx tsx lib/inbound/bulk.test.ts
//
// «ΚΑΤΑΧΩΡΗΣΗ ΟΛΩΝ» ΣΤΑ ΕΙΣΕΡΧΟΜΕΝΑ (αξιολόγηση σχεδίασης 3). Πέντε λογαριασμοί
// ήθελαν δέκα πατήματα: άνοιγμα και «Καταχώρηση» ο καθένας. Τώρα ένα για όσους
// έχουν ό,τι χρειάζεται η καταχώρηση· μόνοι μένουν όσοι θέλουν χέρι.
import { bulkReady, bulkLabel, billMonth } from './bulk';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const row = (id: string, vendor: string | null) => ({ id, vendor });
const draft = (amount: string, date: string) => ({ amount, date });

{
  const rows = [row('a', 'ΔΕΗ'), row('b', 'ΔΕΗ'), row('c', 'ΕΥΔΑΠ'), row('d', null), row('e', 'Cosmote'), row('f', 'ΔΕΗ')];
  const drafts = {
    a: draft('97,50', '2026-09-10'),
    b: draft('', '2026-09-10'),          // χωρίς ποσό: θέλει χέρι
    c: draft('36.2', '2026-09-12'),
    d: draft('20', '2026-09-12'),        // χωρίς πάροχο: θέλει χέρι
    e: draft('0', '2026-09-12'),         // μηδέν δεν είναι δαπάνη
    f: draft('12', ''),                  // χωρίς ημερομηνία
  };
  const ready = bulkReady(rows, drafts).map(r => r.id);
  ok('μόνο όσοι έχουν πάροχο, ποσό και ημερομηνία', ready.join() === 'a,c');
  ok('το ποσό με κόμμα μετρά', ready.includes('a'));
  ok('χωρίς προσχέδιο δεν είναι έτοιμος', bulkReady([row('z', 'ΔΕΗ')], {}).length === 0);
  ok('άδεια ουρά', bulkReady([], {}).length === 0);
}
{
  ok('το λεκτικό λέει πόσοι', bulkLabel(4) === 'Καταχώρηση όλων (4)');
  ok('με έναν δεν υπάρχει «όλων»', bulkLabel(1) === null && bulkLabel(0) === null);
}

// ── Ο μήνας του λογαριασμού στη γραμμή ──────────────────────────────────
// Πέντε «ΔΕΗ 10/09» δεν ξεχώριζαν· το θέμα ήξερε «Ιανουαρίου 2026».
{
  ok('γενική από το θέμα', billMonth('Λογαριασμός ρεύματος Ιανουαρίου 2026 · παροχή 1234567890') === 'Ιαν 2026')
  ok('ονομαστική', billMonth('Ο λογαριασμός σου για Μάιος 2026') === 'Μαΐ 2026')
  ok('χωρίς τόνους και κεφαλαία', billMonth('ΛΟΓΑΡΙΑΣΜΟΣ ΦΕΒΡΟΥΑΡΙΟΥ 2027') === 'Φεβ 2027')
  ok('χωρίς χρονιά δεν μαντεύει', billMonth('Λογαριασμός Ιανουαρίου') === null)
  ok('χωρίς θέμα', billMonth(null) === null && billMonth('') === null)
}

console.log(`inbound/bulk.test.ts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
