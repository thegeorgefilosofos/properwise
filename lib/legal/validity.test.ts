// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΗΤΡΩΟ ΙΣΧΥΟΣ ΔΕΙΧΝΕΙ ΣΤΟ ΣΩΣΤΟ ΦΕΚ ΚΑΙ ΚΡΑΤΑ ΚΑΘΕ ΠΑΡΑΘΥΡΟ ΠΟΥ ΚΛΕΙΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Δύο κενά, μετρημένα στις 18/10/2026:
//   · η πηγή της κλίμακας ενοικίων ήταν το ΦΕΚ Α΄ 201/2025, προεδρικό διάταγμα
//     για το Πυροσβεστικό Σώμα· η κλίμακα είναι ο ν.5246/2025, ΦΕΚ Α΄ 198/2025
//   · τέσσερις ημερομηνίες λήξης δεν τις κρατούσε καμία εγγραφή: η αναστολή
//     νέων ΑΜΑ (Αθήνα, Θεσσαλονίκη), το παράθυρο της τριετούς απαλλαγής κενών
//     κατοικιών, το παράθυρο δαπανών του 39Β και ο επανέλεγχος του «Σπίτι μου
//     ΙΙΙ». Την 1η Ιανουαρίου κανένας φύλακας δεν θα έλεγε τίποτα.
// Κάθε νέα εγγραφή ελέγχεται απέναντι στη σταθερά που περιγράφει: μητρώο και
// κώδικας δεν επιτρέπεται να διαφωνούν για την ημερομηνία.
// ═══════════════════════════════════════════════════════════════════════════
import { REGULATED, WARN_DAYS, statusOf } from './validity';
import { THESS_STR_FREEZE } from '@/lib/market/greekMarket';
import { RENO_39B_FROM, RENO_39B_TO } from '@/lib/accounting/renovation39b';
import { SPITI_MOU_3 } from '@/lib/loans/recommend';
import { REGULATORY_UPDATES_2026 } from '@/lib/accounting/updates2026';

let pass = 0; const fail: string[] = [];
const ok = (what: string, cond: boolean) => { if (cond) pass++; else fail.push(what); };
const entry = (id: string) => REGULATED.find(r => r.id === id);
/** «31/12/2026» → «2026-12-31». */
const iso = (gr: string) => gr.split('/').reverse().join('-');
/** «2026-12-31» → «31/12/2026». */
const gr = (d: string) => d.split('-').reverse().join('/');

// ── Η πηγή της κλίμακας ενοικίων ──
{
  const r = entry('rental-brackets');
  ok('η κλίμακα ενοικίων δείχνει στο ΦΕΚ Α΄ 198/2025', !!r && /\/2025\/198\/|20250100198/.test(r.source));
  ok('...και όχι στο ΦΕΚ Α΄ 201/2025', !!r && !/\/2025\/201\/|20250100201/.test(r.source));
}

// ── Η αναστολή νέων ΑΜΑ ──
{
  const r = entry('str-freeze');
  ok('το μητρώο κρατά την αναστολή νέων ΑΜΑ', !!r);
  ok('...με λήξη ίδια με τη σταθερά της Θεσσαλονίκης', r?.validTo === THESS_STR_FREEZE.to);
  ok('...εκεί όπου ζει η σταθερά', r?.where === 'lib/market/greekMarket.ts');
}

// ── Το παράθυρο της τριετούς απαλλαγής κενών κατοικιών ──
{
  const r = entry('vacant-rental-exemption');
  const text = REGULATORY_UPDATES_2026.find(u => u.id === 'longterm-exemption-conditions')?.summary ?? '';
  ok('το μητρώο κρατά το παράθυρο της απαλλαγής', !!r);
  ok('...ίδιο με αυτό που γράφει η ενημέρωση 2026',
    !!r && !!r.validTo && text.includes(`${gr(r.validFrom)}–${gr(r.validTo)}`));
  ok('...με πηγή το ΦΕΚ του ν.5246/2025', !!r && /\/2025\/198\//.test(r.source));
}

// ── Το παράθυρο δαπανών του 39Β ──
{
  const r = entry('renovation-39b');
  ok('το μητρώο κρατά το παράθυρο δαπανών του 39Β', !!r);
  ok('...από τις σταθερές του', r?.validFrom === iso(RENO_39B_FROM) && r?.validTo === iso(RENO_39B_TO));
}

// ── Ο επανέλεγχος του «Σπίτι μου ΙΙΙ» ──
{
  const r = entry('spiti-mou-3');
  ok('το μητρώο θυμάται να ξανακοιτάξει το ΙΙΙ', !!r);
  ok('...με την πηγή της σταθεράς', r?.source === SPITI_MOU_3.sources.hdb);
  ok('...και τον ίδιο έλεγχο', r?.checkedAt === SPITI_MOU_3.checkedAt);
  ok('...ανακοινωμένο από τη ΔΕΘ', r?.validFrom === SPITI_MOU_3.announcedOn);
  // Η ημερομηνία της ίδιας της λήξης ΔΕΝ γράφεται εδώ: η εγγραφή λέει «αν δεν
  // βγήκε ΚΥΑ, μετάθεσε το validTo» και μια δοκιμή με ημερομηνία θα έκοβε
  // ακριβώς αυτή τη σωστή κίνηση. Μετρά να υπάρχει λήξη μετά τον έλεγχο.
  ok('...με λήξη μετά τον έλεγχο, ώστε ο φύλακας να ζητήσει επανέλεγχο', !!r?.validTo && r.validTo > r.checkedAt);
}

// ── Κοκκινίζουν πριν λήξουν, όχι μετά ──
// Μετρημένα από τη ΔΙΚΗ ΤΟΥΣ λήξη, όχι από ημερομηνία γραμμένη εδώ. Με
// «προειδοποιεί στις 20/11/2026» η δοκιμή κοκκίνιζε τη μέρα που το ΦΕΚ θα
// παρέτεινε ένα παράθυρο ως 31/12/2027 και κάποιος θα έγραφε σωστά το validTo.
/** «2026-12-31», ±ημέρες. */
const shift = (d: string, days: number) => new Date(Date.parse(`${d}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
for (const id of ['str-freeze', 'vacant-rental-exemption', 'renovation-39b', 'spiti-mou-3']) {
  const r = entry(id);
  ok(`${id}: σε ισχύ σήμερα`, !!r && statusOf(r, '2026-10-18') === 'ok');
  ok(`${id}: ο φύλακας προειδοποιεί πριν από τη λήξη`, !!r?.validTo && statusOf(r, shift(r.validTo, -(WARN_DAYS - 1))) === 'expiring');
  ok(`${id}: ...και κόβει την επομένη της`, !!r?.validTo && statusOf(r, shift(r.validTo, 1)) === 'expired');
  ok(`${id}: πηγή με σύνδεσμο https`, !!r && /^https:\/\//.test(r.source));
}

ok('κάθε αναγνωριστικό μία φορά', new Set(REGULATED.map(r => r.id)).size === REGULATED.length);

if (fail.length) { console.error(`\n✗ validity: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1); }
console.log(`✓ validity: ${pass} έλεγχοι πέρασαν`);
