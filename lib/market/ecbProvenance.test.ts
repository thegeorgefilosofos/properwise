// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΜΙΑ ΣΦΡΑΓΙΔΑ ΔΕΝ ΜΕΤΑΚΙΝΕΙΤΑΙ ΧΩΡΙΣ ΝΕΑ ΠΑΡΑΤΗΡΗΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Αυτό το αρχείο κλειδώνει το λάθος που πλήρωσε η εφαρμογή: η πρωινή εργασία
// ξανάγραφε τις παλιές τιμές με σημερινή ημερομηνία όταν η πηγή δεν απαντούσε.
// Η οθόνη έλεγε «σήμερα» για νούμερα εβδομάδων και ο δείκτης παλαιότητας δεν
// μπορούσε να χτυπήσει ποτέ.
// ═══════════════════════════════════════════════════════════════════════════
import { nextProvenance, rateColumns, ageDays, isStale, staleKeys, greekDay, greekWhen, weeklyDigest, digestCutoff,
  ECB_SERIES, seriesPage, type MarketKey, type Provenance, type RateProvenance } from '@/lib/market/ecb';
import { readFileSync } from 'node:fs';

let pass = 0; const fail: string[] = [];
/** Ο κώδικας ενός αρχείου χωρίς τα σχόλια γραμμής: το σχόλιο που εξηγεί το παλιό λάθος δεν είναι κώδικας. */
const code = (f: string): string => readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '');
const eq = (what: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail.push(`${what}\n    περίμενα: ${JSON.stringify(want)}\n    πήρα:     ${JSON.stringify(got)}`);
};

const p = (value: number, asOf: string, fetchedAt = '2026-09-01T08:00:00Z'): RateProvenance =>
  ({ value, asOf, source: 'Ευρωπαϊκή Κεντρική Τράπεζα', basis: 'ημερήσιο κλείσιμο',
     url: 'https://data.ecb.europa.eu/', fetchedAt });
/** Η σελίδα της σειράς που ορίζει ο κατάλογος για το κλειδί. */
const page = (key: MarketKey): string => seriesPage(ECB_SERIES.find(s => s.key === key)!.candidates[0]);
/** Τιμή με ταυτότητα από τη σειρά του καταλόγου της. */
const at = (key: MarketKey, r: RateProvenance): RateProvenance => ({ ...r, url: page(key) });

const previous: Provenance = {
  euribor_3m: at('euribor_3m', p(2.324, '2026-06-30', '2026-06-30T08:00:00Z')),
  ecb_rate:   at('ecb_rate',   p(2.15,  '2026-06-05', '2026-06-30T08:00:00Z')),
};

// ── Ο ΚΑΝΟΝΑΣ ────────────────────────────────────────────────────────────
const merged = nextProvenance(previous, { euribor_3m: p(2.301, '2026-08-31') });
eq('η φρέσκια τιμή γράφεται',        merged.euribor_3m?.value, 2.301);
eq('με τη δική της ημερομηνία',      merged.euribor_3m?.asOf, '2026-08-31');
eq('η τιμή που δεν ήρθε κρατά την ΠΑΛΙΑ της ημερομηνία', merged.ecb_rate?.asOf, '2026-06-05');
eq('και την παλιά της τιμή',         merged.ecb_rate?.value, 2.15);
eq('και τη στιγμή που όντως κατέβηκε', merged.ecb_rate?.fetchedAt, '2026-06-30T08:00:00Z');

// Ενα άδειο πέρασμα (η πηγή έπεσε ολόκληρη) δεν αγγίζει τίποτα.
eq('πέρασμα χωρίς καμία απάντηση αφήνει τα πάντα ανέπαφα',
  nextProvenance(previous, {}), previous);

// Νέο κλειδί που δεν υπήρχε προστίθεται.
eq('νέο κλειδί μπαίνει', nextProvenance(previous, { ecb_dfl: p(2.00, '2026-06-05') }).ecb_dfl?.value, 2.00);

{
  const cols = rateColumns(previous, merged, null);
  eq('οι στήλες του πίνακα παίρνουν μόνο τους αριθμούς', [cols.euribor_3m, cols.ecb_rate], [2.301, 2.15]);
  eq('στήλη χωρίς τιμή μένει κενή', cols.bog_housing_stock, null);
}

// ══ ΤΙΜΗ ΑΛΛΗΣ ΣΕΙΡΑΣ ΔΕΝ ΜΕΝΕΙ ΜΕ ΤΟ ΙΔΙΟ ΟΝΟΜΑ (19/10/2026) ════════════════
// Η γραμμή της παραγωγής 18/10/2026 08:00 UTC: κάτω από το `bog_housing_new`
// η σειρά F, 3,39, asOf 2026-08-01. Το ίδιο και η 17/10. Αν η A δεν απαντήσει,
// η παλιά συγχώνευση την κρατούσε για πάντα και η στήλη έγραφε 3,39 κάθε πρωί.
{
  const F = 'https://data.ecb.europa.eu/data/datasets/MIR/MIR.M.GR.B.A2C.F.R.A.2250.EUR.N';
  const prod: Provenance = {
    ...previous,
    bog_housing_new:   { ...p(3.39, '2026-08-01', '2026-10-18T08:00:01.894Z'), url: F, basis: 'νέες χορηγήσεις' },
    bog_housing_stock: at('bog_housing_stock', p(2.9, '2026-08-01', '2026-10-18T08:00:01.894Z')),
  };
  const lastRow = { bog_housing_new: 3.39, bog_housing_stock: 2.9, euribor_3m: 2.324, ecb_rate: 2.15 };
  const noA = nextProvenance(prod, { euribor_3m: at('euribor_3m', p(2.6350455, '2026-09-01')) });
  eq('η A δεν ήρθε: η τιμή της F φεύγει από το bog_housing_new', noA.bog_housing_new, undefined);
  eq('τα υπόλοιπα κλειδιά μένουν όπως ήταν', [noA.bog_housing_stock?.value, noA.ecb_rate?.value], [2.9, 2.15]);
  const cols = rateColumns(prod, noA, lastRow);
  eq('και η στήλη μένει κενή αντί να ξαναπάρει το 3,39 της χθεσινής γραμμής', cols.bog_housing_new, null);
  eq('η στήλη κλειδιού με ταυτότητα παίρνει την τιμή της ταυτότητας', cols.bog_housing_stock, 2.9);
  const withA = nextProvenance(prod, { bog_housing_new: at('bog_housing_new', p(3.21, '2026-08-01')) });
  eq('η A ήρθε: γράφεται κανονικά', rateColumns(prod, withA, lastRow).bog_housing_new, 3.21);
  // Γραμμή από πριν από την ταυτότητα: η προηγούμενη στήλη μένει, όπως πάντα.
  eq('κλειδί χωρίς ποτέ ταυτότητα κρατά την προηγούμενη στήλη',
    rateColumns({}, {}, { euribor_6m: 2.9 }).euribor_6m, 2.9);
  eq('και αριθμός-κείμενο από τη βάση διαβάζεται', rateColumns({}, {}, { euribor_6m: '2.9' }).euribor_6m, 2.9);
  const updater = code('supabase/functions/market-data-updater/index.ts');
  eq('η τροφοδοσία γράφει τις στήλες με τη rateColumns', /\.\.\.rateColumns\(previous, provenance, last/.test(updater), true);
  eq('και όχι με «?? προηγούμενη στήλη»', /\?\? fb\./.test(updater), false);
}

// ── ΠΑΛΑΙΟΤΗΤΑ ΑΝΑ ΕΙΔΟΣ ─────────────────────────────────────────────────
eq('η διαφορά ημερών μετριέται σε ημέρες', ageDays('2026-08-31', '2026-09-01'), 1);
eq('ίδια ημέρα, μηδέν',                    ageDays('2026-09-01', '2026-09-01'), 0);
eq('ακατάληπτη ημερομηνία θεωρείται άπειρα παλιά', ageDays('χθες', '2026-09-01'), Number.POSITIVE_INFINITY);

// ══ ΤΟ ΟΡΙΟ ΤΟΥ EURIBOR ΒΓΑΙΝΕΙ ΑΠΟ ΤΗΝ ΠΗΓΗ, ΟΧΙ ΑΠΟ ΕΙΚΑΣΙΑ ═══════════════
// Η ΕΚΤ δημοσιεύει το Euribor ΜΟΝΟ μηνιαία (ρωτήθηκε ο κατάλογος: «A | M | Q»).
// Με το προηγούμενο όριο των πέντε ημερών, ο μέσος όρος Αυγούστου θα σημαδευόταν
// ως παλιός την 1η Σεπτεμβρίου — δηλαδή κάθε φυσιολογική τιμή, κάθε μέρα. Μια
// προειδοποίηση που ανάβει πάντα δεν προειδοποιεί για τίποτα.
eq('ο μέσος όρος του περασμένου μήνα ΔΕΝ είναι παλιός', isStale('euribor_3m', '2026-08-01', '2026-09-01'), false);
eq('ούτε στα μέσα του επόμενου μήνα',                   isStale('euribor_3m', '2026-08-01', '2026-09-14'), false);
// ΜΕΤΡΑ ΑΠΟ ΤΟ ΤΕΛΟΣ ΤΟΥ ΜΗΝΑ, ΟΧΙ ΑΠΟ ΤΗΝ ΑΡΧΗ (18/10/2026). Ο μέσος όρος
// Σεπτεμβρίου ζει ως «2026-09-01» από την 01/10 ως την 31/10. Με ηλικία από την
// 1η του μήνα, στις 16/10 είχε 45 ημέρες και λεγόταν παλιός ως το τέλος του
// μήνα: η ζωντανή σελίδα της 18/10 έγραφε «η πηγή δεν έχει δώσει νεότερη τιμή».
eq('η αναπαραγωγή της 18/10/2026: ο Σεπτέμβριος ΔΕΝ είναι παλιός', isStale('euribor_3m', '2026-09-01', '2026-10-18'), false);
eq('ούτε την 1η του επόμενου μήνα',                        isStale('euribor_3m', '2026-09-01', '2026-10-01'), false);
eq('ούτε την τελευταία μέρα του επόμενου μήνα',            isStale('euribor_3m', '2026-09-01', '2026-10-31'), false);
eq('ο Αύγουστος στις 30/09 δεν είναι παλιός (60 ημέρες από την 1η)', isStale('euribor_3m', '2026-08-01', '2026-09-30'), false);
eq('το ίδιο για όλα τα Euribor', staleKeys({
  euribor_1m: p(2.41, '2026-09-01'), euribor_3m: p(2.64, '2026-09-01'),
  euribor_6m: p(2.92, '2026-09-01'), euribor_12m: p(3.25, '2026-09-01'),
}, '2026-10-18'), []);
eq('ο Δεκέμβριος κλείνει την 01/01 του επόμενου έτους', isStale('euribor_3m', '2026-12-01', '2027-01-31'), false);
// Οταν ο νέος μήνας δεν έρθει, το όριο χτυπά δύο εβδομάδες μετά.
eq('ο Αύγουστος στις 16/10, ενώ έπρεπε να υπάρχει ο Σεπτέμβριος: όχι ακόμη', isStale('euribor_3m', '2026-08-01', '2026-10-16'), false);
eq('ο Αύγουστος στις 17/10: παλιό',                       isStale('euribor_3m', '2026-08-01', '2026-10-17'), true);
eq('δύο μήνες χωρίς νέα τιμή είναι παλιό',              isStale('euribor_3m', '2026-07-01', '2026-09-17'), true);
// ΤΟ ΕΠΙΤΟΚΙΟ ΠΟΛΙΤΙΚΗΣ ΕΧΕΙ ΑΛΛΟ ΟΡΙΟ. Αλλάζει λίγες φορές τον χρόνο: μια
// ημερομηνία τριών μηνών πίσω σημαίνει «δεν άλλαξε», όχι «ξεχάστηκε». Με κοινό
// όριο 48 ωρών η οθόνη θα φώναζε «παλιό» για κάτι απολύτως τρέχον.
eq('το επιτόκιο ΕΚΤ τριών μηνών δεν είναι παλιό', isStale('ecb_rate', '2026-06-05', '2026-09-01'), false);
// Μετρημένο: την 01/09/2026 ο τελευταίος διαθέσιμος μήνας ήταν ο Ιούνιος.
eq('το ελληνικό μέσο τριών μηνών δεν είναι παλιό', isStale('bog_housing_new', '2026-06-01', '2026-09-01'), false);
eq('το ελληνικό μέσο ενός έτους είναι παλιό',      isStale('bog_housing_new', '2025-09-01', '2026-09-01'), true);

eq('βρίσκει ποια ακριβώς παλιά, όχι «κάτι»', staleKeys(previous, '2026-10-15'), ['euribor_3m']);
eq('χωρίς παλιά, κενή λίστα',                staleKeys({ euribor_3m: p(2.3, '2026-08-01') }, '2026-09-01'), []);

// ══ Η ΜΗΝΙΑΙΑ ΤΙΜΗ ΓΡΑΦΕΤΑΙ ΩΣ ΜΗΝΑΣ ═══════════════════════════════════════
// Ο μέσος όρος Αυγούστου αποθηκεύεται «2026-08-01» γιατί κάπου πρέπει να
// καθίσει. Γραμμένο «01/08/2026» διαβάζεται ως «η τιμή την 1η Αυγούστου», που
// είναι ΑΛΛΟ νούμερο από τον μέσο όρο του μήνα.
eq('μηνιαία τιμή γράφεται ως μήνας', greekWhen('2026-08-01', 'μέσος όρος μήνα'), 'Αυγ 2026');
eq('ημερήσια τιμή κρατά την ημέρα της', greekWhen('2026-09-01', 'ισχύει από την τελευταία μεταβολή'), '01/09/2026');

eq('η ημερομηνία γράφεται ελληνικά', greekDay('2026-08-31'), '31/08/2026');
eq('σκουπίδι δεν γίνεται ημερομηνία', greekDay('2026-8-3'), '');

// ══ ΜΕΤΑΒΟΛΗ ΜΟΝΟ ΜΕΣΑ ΣΤΗΝ ΙΔΙΑ ΣΕΙΡΑ (13.10.2026) ══════════════════════════
// Η στήλη bog_housing_new πέρασε από τη σειρά F στην A. Η διαφορά των δύο
// γραμμών την ημέρα της αλλαγής είναι αλλαγή ορισμού, όχι κίνηση επιτοκίου·
// το εβδομαδιαίο email δεν πρέπει να τη στείλει ως μεταβολή.
{
  const F = 'https://data.ecb.europa.eu/data/datasets/MIR/MIR.M.GR.B.A2C.F.R.A.2250.EUR.N';
  const row = (v: number, url = page('bog_housing_new')) =>
    ({ provenance: { bog_housing_new: { ...p(v, '2026-08-01'), url } } as Provenance });
  const one = (cur: { provenance: Provenance }, base: { provenance: Provenance }) =>
    weeklyDigest(cur, base, ['bog_housing_new']).lines[0];
  eq('ίδια σειρά: συγκρίνεται', one(row(3.3), row(3.2)).prev, 3.2);
  eq('F → A: ΔΕΝ συγκρίνεται', one(row(3.3), row(3.4, F)).prev, null);
  eq('και η αλλαγή ορισμού δεν στέλνει email', weeklyDigest(row(3.3), row(3.4, F), ['bog_housing_new']).changed, false);
  eq('ταυτότητα στη μία γραμμή μόνο: δεν συγκρίνεται', one(row(3.3), { provenance: {} }).prev, null);
  // Η γραμμή της 18/10/2026: F κάτω από το όνομα του μέσου όρου, στις δύο γραμμές.
  eq('τιμή της F δεν γράφεται ως «Επιτόκιο νέων στεγαστικών»', one(row(3.39, F), row(3.39, F)).cur, null);
  const cur = { provenance: { ...previous, ...row(3.3).provenance } };
  const base = { provenance: { ...previous, ecb_rate: at('ecb_rate', p(2.40, '2026-06-05')), ...row(3.4, F).provenance } };
  eq('η αλλαγή σειράς του ενός κλειδιού δεν κόβει τη σύγκριση των άλλων',
    weeklyDigest(cur, base, ['ecb_rate', 'bog_housing_new']).lines.map(l => [l.key, l.prev]),
    [['ecb_rate', 2.40], ['bog_housing_new', null]]);
}

// ══ Η ΕΒΔΟΜΑΔΑ, ΟΧΙ Η ΧΘΕΣΙΝΗ ΜΕΡΑ (19/10/2026) ═════════════════════════════
// Το email τρέχει Δευτέρα 07:00 UTC και η τροφοδοσία κάθε μέρα 08:00 UTC. Οι
// γραμμές από κάτω είναι η εβδομάδα της απόφασης της ΕΚΤ, όπως στην παραγωγή:
// επιτόκιο 2,40 ως την Τρίτη 15/09 και 2,65 από την Τετάρτη 16/09. Το email
// σύγκρινε τις δύο τελευταίες γραμμές (Κυριακή 20/09 και Σάββατο 19/09), που
// είχαν και οι δύο 2,65: «no_change» και η αύξηση δεν έφτασε σε κανέναν.
{
  const days = ['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'];
  const rows = days.map(d => ({
    updated_at: `${d}T08:00:01.000Z`,
    provenance: {
      ecb_rate:   at('ecb_rate',   p(d < '2026-09-16' ? 2.40 : 2.65, d)),
      euribor_3m: at('euribor_3m', p(2.5131, '2026-08-01')),
    } as Provenance,
  })).reverse();                                  // νεότερη πρώτη, όπως το order by updated_at desc
  /** Το ίδιο ερώτημα με τη συνάρτηση άκρου: η νεότερη γραμμή ως το όριο. */
  const baseOf = (nowIso: string) => rows.find(r => r.updated_at <= digestCutoff(nowIso)) ?? null;
  const monday = '2026-09-21T07:00:00.000Z';
  eq('το όριο είναι επτά ημέρες πίσω', digestCutoff(monday), '2026-09-14T07:00:00.000Z');
  eq('η γραμμή σύγκρισης είναι η προηγούμενη Κυριακή', baseOf(monday)?.updated_at, '2026-09-13T08:00:01.000Z');
  const week = weeklyDigest(rows[0], baseOf(monday), ['ecb_rate', 'euribor_3m']);
  eq('η αύξηση της Τετάρτης φτάνει στο email της Δευτέρας', week.changed, true);
  eq('με την τιμή πριν και μετά', week.lines.map(l => [l.key, l.cur, l.prev]),
    [['ecb_rate', 2.65, 2.40], ['euribor_3m', 2.5131, 2.5131]]);
  eq('Κυριακή με Σάββατο δεν τη βλέπει: αυτό έκανε το .limit(2)', weeklyDigest(rows[0], rows[1], ['ecb_rate']).changed, false);
  // Η επόμενη Δευτέρα συγκρίνει με την Κυριακή που ήταν «τρέχουσα» σήμερα:
  // οι εβδομάδες κολλούν χωρίς κενό και χωρίς επικάλυψη.
  eq('η επόμενη εβδομάδα ξεκινά εκεί που τελείωσε αυτή',
    rows.find(r => r.updated_at <= digestCutoff('2026-09-28T07:00:00.000Z'))?.updated_at, rows[0].updated_at);
  eq('χωρίς γραμμή εβδομάδας πίσω: τίποτα να συγκριθεί', weeklyDigest(rows[0], null, ['ecb_rate']).changed, false);

  // Η συνάρτηση άκρου ρωτά τη γραμμή της εβδομάδας, όχι τη χθεσινή.
  const digest = code('supabase/functions/send-market-digest/index.ts');
  eq('το email ζητά την ταυτότητα από τη βάση', /\.select\('[^']*\bprovenance\b/.test(digest), true);
  eq('δεν συγκρίνει πια τις δύο τελευταίες γραμμές', /\.limit\(2\)/.test(digest), false);
  eq('η γραμμή σύγκρισης είναι η τελευταία ως επτά ημέρες πίσω', /\.lte\('updated_at', digestCutoff\(nowIso\)\)/.test(digest), true);
  eq('και η σύγκριση περνά από τη weeklyDigest', /weeklyDigest\(curRow/.test(digest), true);
}

if (fail.length) { console.error(`\n✗ ecb ταυτότητα: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1); }
console.log(`✓ ecb ταυτότητα: ${pass} έλεγχοι πέρασαν`);
