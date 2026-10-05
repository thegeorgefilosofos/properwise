// npx tsx lib/facts/completeness.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑΣ ΜΕΤΡΗΤΗΣ ΠΛΗΡΟΤΗΤΑΣ: ΟΘΟΝΗ, ΑΡΧΕΙΟ ΑΚΙΝΗΤΟΥ, ΦΑΚΕΛΟΣ ΣΥΝΑΝΤΗΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Δύο ακίνητα του ίδιου ιδιοκτήτη: Παγκράτι (μακροχρόνια, με ΑΤΑΚ) και Κουκάκι
// (βραχυχρόνια, χωρίς ΑΤΑΚ και χωρίς ΑΜΑ). Ο χρήστης έχει τσεκάρει το ΑΤΑΚ και
// τον ΑΜΑ στον κατάλογο, χωρίς να τα γράψει στα στοιχεία.
// ═══════════════════════════════════════════════════════════════════════════
import { dossierCompleteness, appItemReady, type CompletenessInput } from './completeness';
import { missingItems, type MeetingPackInput } from '@/lib/accounting/meetingPack';
import { reconcilePrefilled } from '@/lib/billing/e2Reconcile';
import { WHO_LABEL } from '@/lib/accounting/dossier';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.error(`✗ ${name}`, extra ?? ''); }
};

const PANGRATI = { id: 'p1', name: 'Παγκράτι', status: 'rent_long' as const, atak: '01234567890', ama: null };
const KOUKAKI = { id: 'p2', name: 'Κουκάκι', status: 'rent_short' as const, atak: '', ama: '' };
const base: CompletenessInput = {
  form: 'individual', books: 'none',
  properties: [PANGRATI, KOUKAKI],
  ticked: ['atak', 'ama', 'enfia'],
  data: { rent: true, stays: true, costs: true },
};
const item = (c: ReturnType<typeof dossierCompleteness>, id: string) => c.items.find(i => i.id === id);

// ── Τα στοιχεία κρίνουν, όχι το κουτάκι ─────────────────────────────────────
const c = dossierCompleteness(base);
ok('ΑΤΑΚ: κρίνουν τα στοιχεία', item(c, 'atak')?.by === 'data');
ok('ΑΤΑΚ: λείπει παρά το τσεκ', item(c, 'atak')?.done === false);
ok('ΑΤΑΚ: λείπει από το Κουκάκι μόνο', JSON.stringify(item(c, 'atak')?.missingFor) === JSON.stringify(['Κουκάκι']));
ok('ΑΜΑ: μόνο για τη βραχυχρόνια, λείπει', item(c, 'ama')?.by === 'data' && item(c, 'ama')?.done === false
  && JSON.stringify(item(c, 'ama')?.missingFor) === JSON.stringify(['Κουκάκι']));
ok('ΕΝΦΙΑ: χωρίς στοιχεία, κρίνει το τσεκ', item(c, 'enfia')?.by === 'tick' && item(c, 'enfia')?.done === true);

const filled = dossierCompleteness({ ...base, properties: [PANGRATI, { ...KOUKAKI, atak: '09876543210', ama: '00012345678' }], ticked: [] });
ok('με ΑΤΑΚ σε όλα: έγινε χωρίς τσεκ', item(filled, 'atak')?.done === true);
ok('με ΑΜΑ: έγινε χωρίς τσεκ', item(filled, 'ama')?.done === true);

const unknown = dossierCompleteness({ ...base, properties: [{ id: 'p1', name: 'Παγκράτι', status: 'rent_long' }] });
ok('ΑΤΑΚ που δεν διαβάστηκε: κρίνει το τσεκ', item(unknown, 'atak')?.by === 'tick' && item(unknown, 'atak')?.done === true);

// ── Το προσυμπληρωμένο Ε2 ───────────────────────────────────────────────────
ok('ανεβασμένο: έγινε', item(dossierCompleteness({ ...base, prefilled: 'uploaded' }), 'e2_prefilled')?.done === true);
ok('μη ανεβασμένο: λείπει ακόμη κι αν τσεκαρίστηκε',
  item(dossierCompleteness({ ...base, ticked: [...base.ticked, 'e2_prefilled'], prefilled: 'not_uploaded' }), 'e2_prefilled')?.done === false);
ok('η οθόνη που δεν το ξέρει: κρίνει το τσεκ',
  item(dossierCompleteness({ ...base, ticked: [...base.ticked, 'e2_prefilled'] }), 'e2_prefilled')?.done === true);

// ── Ό,τι βγάζει η εφαρμογή: έτοιμο μόνο με δεδομένα ────────────────────────
const empty = dossierCompleteness({ ...base, data: { rent: false, stays: false, costs: false } });
ok('άδεια χρονιά: καμία γραμμή της εφαρμογής έτοιμη', empty.items.filter(i => i.by === 'app').every(i => !i.done));
ok('με δαπάνες: οι δαπάνες έτοιμες', appItemReady('expenses', { rent: false, stays: false, costs: true }));
ok('το Ε2 θέλει μισθώματα', !appItemReady('e2', { rent: false, stays: true, costs: true }) && appItemReady('e2', { rent: true, stays: false, costs: false }));

// ── Πλήρης σημαίνει και χωρίς κενά δεδομένων ────────────────────────────────
const FULL = [PANGRATI, { ...KOUKAKI, atak: '09876543210', ama: '00012345678' }];
const everyId = dossierCompleteness({ ...base, properties: FULL, prefilled: 'uploaded' }).items.map(i => i.id);
const allDone = dossierCompleteness({ ...base, properties: FULL, prefilled: 'uploaded', ticked: everyId });
ok('όλα: πλήρης', allDone.complete && /πλήρης/.test(allDone.message), allDone.message);
const withGaps = dossierCompleteness({ ...base, properties: FULL, prefilled: 'uploaded', ticked: everyId, gaps: ['Δεν έχει καταχωρηθεί ΑΦΜ μισθωτή.'] });
ok('με κενό δεδομένων: όχι πλήρης', !withGaps.complete);
ok('η φράση λέει το κενό, όχι «πλήρης»', !/φάκελος είναι πλήρης/.test(withGaps.message) && /Μένει ένα κενό/.test(withGaps.message), withGaps.message);
ok('το Χ / Υ μετρά μόνο τον κατάλογο', withGaps.done === withGaps.total);

// ── Οθόνη και φάκελος συνάντησης: ίδιο πλήθος, χωρίς διπλό ΑΤΑΚ ─────────────
// Ό,τι στέλνει ο φάκελος της συνάντησης στο «Τι λείπει» από τον κατάλογο είναι
// ακριβώς όσα λείπουν στον μετρητή της οθόνης.
const screen = dossierCompleteness({ ...base, prefilled: 'not_uploaded' });
const requirements = screen.items.filter(q => !q.done).map(q => ({
  title: q.title, who: WHO_LABEL[q.who], source: q.source, blocking: !!q.blocking, forProperties: q.missingFor ?? q.forProperties,
}));
const pack = missingItems({
  year: 2026, ownerAfm: '123456789', ownerName: 'Δοκιμή',
  properties: [
    { id: 'p1', name: 'Παγκράτι', address: '', atak: PANGRATI.atak, category: '', ownershipPct: 100, yearStatus: '', months: 12, gross: 7800, unpaid: 0, servicesExcluded: 0, flags: [], tenantWithoutAfm: false, papers: 0, shortTerm: null },
    { id: 'p2', name: 'Κουκάκι', address: '', atak: null, category: '', ownershipPct: 100, yearStatus: '', months: 12, gross: 5600, unpaid: 0, servicesExcluded: 0, flags: [], tenantWithoutAfm: false, papers: 0,
      shortTerm: { ama: null, stays: 8, nights: 32, gross: 5600, platformFees: 0, levyDue: 0, levyCollected: 0, staysWithoutFee: 0 } },
  ],
  reconciliation: reconcilePrefilled([], []),
  aade: null, requirements, paperNotes: [],
} as MeetingPackInput);
ok('ο φάκελος της συνάντησης λέει όσα λείπουν και στην οθόνη', pack.length === screen.blocking.length + screen.pending.length, { pack: pack.map(p => p.what), screen: screen.blocking.length + screen.pending.length });
ok('το ΑΤΑΚ μία φορά, για το Κουκάκι', pack.filter(p => /ΑΤΑΚ/.test(p.what)).length === 1 && pack.find(p => /ΑΤΑΚ/.test(p.what))?.scope === 'Κουκάκι', pack.filter(p => /ΑΤΑΚ/.test(p.what)));
ok('ο ΑΜΑ μία φορά', pack.filter(p => /ΑΜΑ/.test(p.what)).length === 1);
ok('το προσυμπληρωμένο μία φορά', pack.filter(p => /προσυμπληρωμένο/i.test(p.what)).length === 1, pack.map(p => p.what));

console.log(fail ? `✗ completeness: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ completeness: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
