// npx tsx lib/legal/subprocessors.test.ts
import { readFileSync } from 'node:fs';
import { subprocessors, activeSubprocessors, plannedSubprocessors, subprocessorLine, PUSH_SERVICES, BACKUP_RETENTION_DAYS } from './subprocessors';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };
const eq = (a: unknown, b: unknown, m: string) => ok(a === b, `${m}\n   πήρα:    ${JSON.stringify(a)}\n   περίμενα: ${JSON.stringify(b)}`);

const rowOf = (env: Record<string, string | undefined>, name: string) =>
  subprocessors(env).find(s => s.name === name)!;

// ── ΤΟ ΜΗΤΡΩΟ ΕΙΝΑΙ ΝΟΜΙΚΟ ΚΕΙΜΕΝΟ, ΟΧΙ ΚΑΤΑΛΟΓΟΣ ΠΡΟΘΕΣΕΩΝ ───────────────
// Το άρθρο 28 GDPR το θέλει επίκαιρο: ένα `active` που δεν ακολουθεί την
// πραγματικότητα είναι ψευδής δήλωση προς το υποκείμενο των δεδομένων.
ok(!!rowOf({}, PUSH_SERVICES), 'οι υπηρεσίες push είναι γραμμένες στο μητρώο');
eq(rowOf({}, PUSH_SERVICES).active, false,
  'χωρίς κλειδί VAPID δεν επεξεργάζεται κανείς τίποτα');
eq(rowOf({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: '   ' }, PUSH_SERVICES).active, false,
  'ούτε με κλειδί από κενά');
eq(rowOf({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BLc4xhmTsoFEGSRhL4YRLFCbfIxjkK5' }, PUSH_SERVICES).active, true,
  'με κλειδί, η επεξεργασία δηλώνεται την ίδια στιγμή που ξεκινά');

// ── ΟΙ ΔΥΟ ΚΑΤΑΛΟΓΟΙ ΜΟΙΡΑΖΟΝΤΑΙ ΤΟΝ ΙΔΙΟ ΚΑΝΟΝΑ ──────────────────────────
{
  const env = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BLc4' };
  ok(activeSubprocessors(env).some(s => s.name === PUSH_SERVICES), 'με κλειδί μπαίνει στους ενεργούς');
  ok(!plannedSubprocessors(env).some(s => s.name === PUSH_SERVICES), 'και φεύγει από τους σχεδιασμένους');
  ok(plannedSubprocessors({}).some(s => s.name === PUSH_SERVICES), 'χωρίς κλειδί μένει στους σχεδιασμένους');
  ok(!activeSubprocessors({}).some(s => s.name === PUSH_SERVICES), 'και δεν δηλώνεται ενεργός');
}

// ── ΤΟ ΚΕΙΜΕΝΟ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ ΓΙΑ ΤΟ ΤΙ ΒΛΕΠΟΥΝ ────────────────────────
{
  const row = rowOf({}, PUSH_SERVICES);
  ok(/κρυπτογραφ/.test(row.purpose), 'λέει ότι το περιεχόμενο ταξιδεύει κρυπτογραφημένο');
  ok(/δεν διαβάζουν/.test(row.purpose), 'και ότι δεν το διαβάζουν');
  ok(!row.name.includes(','), 'κανένα κόμμα μέσα σε όνομα παρόχου');
  ok(subprocessorLine(row).startsWith(PUSH_SERVICES), 'η γραμμή της Πολιτικής ξεκινά με το όνομα');
}

// ── Ο ΑΝΕΝΕΡΓΟΣ ΤΟ ΛΕΕΙ ΚΑΙ ΜΕ ΛΕΞΕΙΣ ──────────────────────────────────────
ok(/Δεν έχουν ενεργοποιηθεί/.test(rowOf({}, PUSH_SERVICES).purpose), 'χωρίς κλειδί η γραμμή λέει ότι δεν έχουν ενεργοποιηθεί');
ok(!/Δεν έχουν ενεργοποιηθεί/.test(rowOf({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BLc4' }, PUSH_SERVICES).purpose), 'με κλειδί δεν το λέει');

// ── Ο ΡΟΛΟΣ ΑΚΟΛΟΥΘΕΙ ΤΟ ΜΗΤΡΩΟ ΤΟΥ ΑΡΘΡΟΥ 28 ─────────────────────────────
// docs/compliance/subprocessors.md: η Google αυτοτελής υπεύθυνος, οι υπόλοιποι
// ενεργοί εκτελούντες, ο έμπορος υπεύθυνος για το ταμείο και εκτελών για τα άλλα.
eq(rowOf({}, 'Google').role, 'controller', 'η Google δεν είναι εκτελών');
for (const n of ['Supabase', 'Vercel', 'Resend', 'Anthropic', 'GitHub']) eq(rowOf({}, n).role, 'processor', `εκτελών: ${n}`);
ok(subprocessors({}).some(s => s.role === 'mixed'), 'ο έμπορος έχει μικτό ρόλο');
ok(/αυτοτελής υπεύθυνος/.test(subprocessorLine(rowOf({}, 'Google'))), 'η γραμμή της Πολιτικής γράφει τον ρόλο');
ok(subprocessorLine(rowOf({}, 'Anthropic')).includes('Anthropic Ireland, Limited'), 'και το νομικό πρόσωπο');

// ── ΤΟ ΑΝΤΙΓΡΑΦΟ ΖΕΙ ΟΣΟ ΛΕΕΙ Η ΡΟΗ ΠΟΥ ΤΟ ΦΤΙΑΧΝΕΙ ─────────────────────────
{
  const yml = readFileSync('.github/workflows/db-backup.yml', 'utf8');
  const days = Number(/retention-days:\s*(\d+)/.exec(yml)?.[1]);
  eq(BACKUP_RETENTION_DAYS, days, 'η Πολιτική απορρήτου λέει τις ίδιες ημέρες με το db-backup.yml');
}

// ── ΚΑΘΕ ΓΡΑΜΜΗ ΕΧΕΙ ΚΑΙ ΤΑ ΤΕΣΣΕΡΑ ───────────────────────────────────────
for (const s of subprocessors({})) {
  ok(!!s.name.trim() && !!s.purpose.trim() && !!s.where.trim(), `συμπληρωμένη γραμμή: ${s.name}`);
}

console.log(`\nlegal/subprocessors.ts — ${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
console.log('όλα πέρασαν');
