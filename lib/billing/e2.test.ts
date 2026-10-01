// Αυστηρά τεστ για την Αναλυτική Κατάσταση Ε2 (e2.ts).
// Τρέξε: npx tsx lib/billing/e2.test.ts
import {
  monthsRentedInYear, e2LeaseKind, e2IncomeCategory,
  buildE2Row, e2RowToCells, buildE1Summary, e1LineToCells, E2_OFFICIAL_HEADERS, E2_NUM_COLS, e2OfficialRows,
  E2_SHORT_TERM_NOTE, E1_UNMAPPED_LABEL, E2_COLUMNS, E2_USE, e2SupplementaryRows, e2AcquiredRows,
  type E2Property, type E2Tenant, type E2Payment, type E2Row, type E2Stay,
} from './e2';
import { leasesInYear } from '@/lib/data/tenants';

/** Οι επίσημες γραμμές ενός ακινήτου, όπως τις χτίζει το βιβλίο: γραμμή ακινήτου, μετά Πίνακας I. */
const buildE2OfficialCells = (p: E2Property, t: E2Tenant | E2Tenant[] | null, pays: E2Payment[], afm: string, year: number, index: number, stays: E2Stay[] = []) =>
  e2OfficialRows(p, buildE2Row(p, t, pays, afm, year, stays), index);

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; if (fails.length < 60) fails.push(name); } };

// ── μήνες εκμίσθωσης (τομή μισθωτηρίου με το έτος) ───────────────────────────
ok('full year rented → 12', monthsRentedInYear('2025-01-01', '2025-12-31', 2025, 'rented').months === 12);
ok('mid-year open lease → 6 (Ιουλ..Δεκ)', monthsRentedInYear('2025-07-01', null, 2025, 'rented').months === 6);
ok('lease entirely before year → 0', monthsRentedInYear('2024-01-01', '2024-06-30', 2025, 'rented').months === 0);
{
  const r = monthsRentedInYear(null, null, 2025, 'rented');
  ok('no lease + rented → 12 estimated', r.months === 12 && r.estimated === true);
}
{
  const r = monthsRentedInYear(null, null, 2025, 'vacant');
  ok('no lease + vacant → 0 estimated', r.months === 0 && r.estimated === true);
}
ok('Μαρ..Σεπ inclusive → 7', monthsRentedInYear('2025-03-15', '2025-09-20', 2025, 'rented').months === 7);
ok('lease after year → 0', monthsRentedInYear('2026-01-01', '2026-12-31', 2025, 'rented').months === 0);
ok('open lease starting before year → 12', monthsRentedInYear('2023-05-01', null, 2025, 'rented').months === 12);
{
  // κατεστραμμένη ημερομηνία αντιμετωπίζεται σαν να λείπει (όχι σιωπηλά 12 μήνες)
  const r = monthsRentedInYear('not-a-date', null, 2025, 'rented');
  ok('invalid date → estimated fallback', r.estimated === true && r.months === 12);
  ok('invalid date + vacant → 0 estimated', monthsRentedInYear('not-a-date', null, 2025, 'vacant').months === 0);
}

// ── είδος μίσθωσης (κωδικοί Ε2) ──────────────────────────────────────────────
ok('rented code = 1', e2LeaseKind('rented').code === '1');
ok('seasonal code = 60', e2LeaseKind('seasonal').code === '60');
ok('own_use code = 17', e2LeaseKind('own_use').code === '17');
ok('vacant code = 39', e2LeaseKind('vacant').code === '39');
ok('for_sale code = "" (χειροκίνητο)', e2LeaseKind('for_sale').code === '');
ok('null code = ""', e2LeaseKind(null).code === '');

// ── κατηγορία εισοδήματος ────────────────────────────────────────────────────
ok('apartment → Κατοικία', e2IncomeCategory('apartment', null) === 'Κατοικία');
ok('office → Επαγγελματική στέγη', e2IncomeCategory('office', null) === 'Επαγγελματική στέγη');
ok('land → Γη / Αγρός', e2IncomeCategory('land', null) === 'Γη / Αγρός');
ok('parking → Βοηθητικός χώρος', e2IncomeCategory('parking', null) === 'Βοηθητικός χώρος');
ok('seasonal overrides type', e2IncomeCategory('apartment', 'seasonal') === 'Βραχυχρόνια μίσθωση');
ok('unknown type → Ακίνητο', e2IncomeCategory('spaceship', null) === 'Ακίνητο');

// ── buildE2Row ───────────────────────────────────────────────────────────────
const P = (o: Partial<E2Property> = {}): E2Property => ({ id: 'p1', atak: '01234567890', address: 'Οδός 1', postal_code: '10000', ownership: 100, prop_type: 'apartment', status_detail: 'rented', target_rent: 800, ...o });
const T = (o: Partial<E2Tenant> = {}): E2Tenant => ({ property_id: 'p1', afm: null, monthly_rent: 800, lease_start: null, lease_end: null, lease_type: null, ...o });

{
  // πλήρες έτος, ενοίκιο 800, 100%, χωρίς πληρωμές → 9600 (εκτίμηση)
  const r = buildE2Row(P(), T(), [], '999999999', 2025);
  ok('gross full-year est = 9600', r.grossIncome === 9600);
  ok('leaseKind = "1 Εκμίσθωση"', r.leaseKind === '1 Εκμίσθωση');
  ok('months = 12', r.months === 12);
  ok('flag gross estimate', r.flags.includes('Ακαθάριστο εισόδημα: εκτίμηση (μηνιαίο × μήνες)'));
}
{
  // ίδιο αλλά 50% συνιδιοκτησία → 4800 + σχετικό flag
  const r = buildE2Row(P({ ownership: '50' }), T(), [], '999999999', 2025);
  ok('gross 50% = 4800', r.grossIncome === 4800);
  ok('flag co-ownership <100', r.flags.includes('Συνιδιοκτησία < 100%: πρόσθεσε ΑΦΜ λοιπών συνιδιοκτητών'));
}
{
  // πληρωμές υπερισχύουν του monthly_rent· η γραμμή 2024 αγνοείται
  const pays: E2Payment[] = [
    { property_id: 'p1', amount: 700, period_year: 2025, period_month: 1 },
    { property_id: 'p1', amount: 700, period_year: 2025, period_month: 2 },
    { property_id: 'p1', amount: 200, period_year: 2024, period_month: 12 },
  ];
  const r = buildE2Row(P(), T(), pays, '999999999', 2025);
  ok('gross from payments = 1400', r.grossIncome === 1400);
  ok('no gross-estimate flag when payments exist', !r.flags.some(f => f.startsWith('Ακαθάριστο εισόδημα: εκτίμηση')));
}
{
  // λείπει ΑΤΑΚ + λείπει ΑΦΜ ιδιοκτήτη
  const r = buildE2Row(P({ atak: null }), T(), [], '', 2025);
  ok('flag missing ΑΤΑΚ', r.flags.includes('Λείπει ΑΤΑΚ'));
  ok('flag missing ΑΦΜ', r.flags.includes('Λείπει ΑΦΜ ιδιοκτήτη'));
}
{
  // ownership null → 100% (grossIncome ίσο με grossFull)
  const r = buildE2Row(P({ ownership: null }), T(), [], '999999999', 2025);
  ok('ownership null defaults 100', r.ownershipPct === 100 && r.grossIncome === 9600);
}

// ── βραχυχρόνια: το ακαθάριστο βγαίνει από τις ΔΙΑΜΟΝΕΣ ─────────────────────
// ΤΑ ΝΟΥΜΕΡΑ ΣΤΟ ΧΕΡΙ. Δηλωτέο ακαθάριστο μιας διαμονής = τι πλήρωσε ο επισκέπτης
// − τέλος ανθεκτικότητας (δεν είναι έσοδο του ιδιοκτήτη). Η προμήθεια της
// πλατφόρμας ΔΕΝ αφαιρείται — είναι δαπάνη, όχι μείωση εσόδου.
//   Ιούλ 2025:  1000 − 32 =  968
//   Αύγ 2025:    700 − 20 =  680
//   Ιούλ 2024:  εκτός του έτους → δεν μετράει
//   σύνολο 2025 = 968 + 680 = 1648 · ποσοστό 100% → 1648
// ΠΡΙΝ ΤΗ ΔΙΟΡΘΩΣΗ: καμία διαμονή δεν διαβαζόταν· χωρίς μισθωτή και χωρίς
// εισπράξεις έβγαινε target_rent 800 × 12 μήνες = 9600, δηλαδή ένας στόχος
// δηλωμένος ως έσοδο.
const SEASONAL = P({ status_detail: 'seasonal', target_rent: 800 });
const STAYS: E2Stay[] = [
  { property_id: 'p1', check_in: '2025-07-01', check_out: '2025-07-08', nights: 7, gross_guest_paid: 1000, climate_levy: 32, platform_fee: 150 },
  { property_id: 'p1', check_in: '2025-08-10', check_out: '2025-08-15', nights: 5, gross_guest_paid: 700, climate_levy: 20, platform_fee: 100 },
  { property_id: 'p1', check_in: '2024-07-01', check_out: '2024-07-05', nights: 4, gross_guest_paid: 500, climate_levy: 10, platform_fee: 70 },
];
{
  const r = buildE2Row(SEASONAL, null, [], '999999999', 2025, STAYS);
  ok('βραχυχρόνια: ακαθάριστο από διαμονές = 1648', r.grossIncome === 1648);
  ok('βραχυχρόνια: ΔΕΝ είναι ο στόχος μισθώματος (9600)', r.grossIncome !== 9600);
  ok('βραχυχρόνια: με διαμονές δεν είναι εκτίμηση', !r.flags.some(f => f.startsWith('Ακαθάριστο')));
  ok('βραχυχρόνια: κωδικός 60', r.leaseKind === '60 Βραχυχρόνια μίσθωση');
}
{
  // ίδιες διαμονές, 50% συνιδιοκτησία → round(1648 × 50 / 100) = 824
  const r = buildE2Row(P({ status_detail: 'seasonal', target_rent: 800, ownership: 50 }), null, [], '999999999', 2025, STAYS);
  ok('βραχυχρόνια: μερίδιο 50% = 824', r.grossIncome === 824);
}
{
  // καμία διαμονή στο έτος → ο στόχος επιτρέπεται, αλλά ΡΗΤΑ σημασμένος
  const r = buildE2Row(SEASONAL, null, [], '999999999', 2025, []);
  ok('βραχυχρόνια χωρίς διαμονές: εκτίμηση 9600', r.grossIncome === 9600);
  ok('βραχυχρόνια χωρίς διαμονές: σημαίνεται ως εκτίμηση', r.flags.some(f => f.includes('εκτίμηση από τον στόχο μισθώματος')));
}
{
  // ιστορική γραμμή: ξέρουμε μόνο το `total` (ακαθάριστο ή payout;) → 500 με προειδοποίηση
  const legacy: E2Stay[] = [{ property_id: 'p1', check_in: '2025-09-01', check_out: '2025-09-04', nights: 3, total: 500 }];
  const r = buildE2Row(SEASONAL, null, [], '999999999', 2025, legacy);
  ok('βραχυχρόνια: ιστορικό ποσό δεν χάνεται (500)', r.grossIncome === 500);
  ok('βραχυχρόνια: σημαίνεται η απροσδιόριστη βάση', r.flags.some(f => f.includes('χωρίς ρητή βάση ποσού')));
}
{
  // μακροχρόνια: οι διαμονές ΔΕΝ αγγίζουν το ακαθάριστο (800 × 12 = 9600)
  const r = buildE2Row(P(), T(), [], '999999999', 2025, STAYS);
  ok('μακροχρόνια: αγνοεί τις διαμονές', r.grossIncome === 9600);
  ok('μακροχρόνια: κρατά το παλιό μήνυμα εκτίμησης', r.flags.includes('Ακαθάριστο εισόδημα: εκτίμηση (μηνιαίο × μήνες)'));
}

// ── e2RowToCells (μορφοποίηση) ───────────────────────────────────────────────
{
  const r = buildE2Row(P({ ownership: 33.33, address: 'Οδός 1', postal_code: '10000' }), T(), [], '999999999', 2025);
  const cells = e2RowToCells(r, 1);
  ok('cell index = 1', cells[0] === 1);
  ok('ownership 33,33', cells[4] === '33,33');
  ok('address joined', cells[2] === 'Οδός 1, 10000');
  ok('gross is string integer', cells[8] === String(Math.round(r.grossIncome)));
}

// ── Σύνοψη Ε1 (κωδικοί) ──────────────────────────────────────────────────────
{
  const rows: E2Row[] = [
    buildE2Row(P({ id: 'a', prop_type: 'apartment' }), T({ property_id: 'a' }), [{ property_id: 'a', amount: 6000, period_year: 2025, period_month: 1 }], '999', 2025),
    buildE2Row(P({ id: 'b', prop_type: 'apartment' }), T({ property_id: 'b' }), [{ property_id: 'b', amount: 4000, period_year: 2025, period_month: 1 }], '999', 2025),
    buildE2Row(P({ id: 'c', prop_type: 'office' }), T({ property_id: 'c' }), [{ property_id: 'c', amount: 5000, period_year: 2025, period_month: 1 }], '999', 2025),
  ];
  const e1 = buildE1Summary(rows);
  ok('Ε1: κατοικίες αθροίζονται σε έναν κωδικό (103)', e1.lines.some(l => l.code === '103' && l.amount === 10000));
  ok('Ε1: επαγγελματική στέγη ξεχωριστός κωδικός (105)', e1.lines.some(l => l.code === '105' && l.amount === 5000));
  ok('Ε1: σύνολο ακαθάριστου = 15000', e1.totalGross === 15000);
  ok('Ε1: με τη σειρά του εντύπου (αύξων κωδικός)', e1.lines.map(l => l.code).join() === '103,105');
  ok('Ε1: η σημείωση λέει την πηγή, πίνακας 4Δ2', /4Δ2/.test(e1.note) && /Φ-01\.001/.test(e1.note));
  const cells = e1LineToCells(e1.lines[0]);
  ok('Ε1: κελιά [υπόχρεος, σύζυγος, περιγραφή, κατηγορία, ποσό]', cells.length === 5 && cells[0] === '103' && cells[1] === '104' && cells[4] === 10000);
  // Η ΓΗ ΕΙΝΑΙ 101, ΟΧΙ 109. Ο παλιός χάρτης τη δήλωνε στα βιομηχανοστάσια.
  const land = buildE1Summary([buildE2Row(P({ id: 'l', prop_type: 'land' }), T({ property_id: 'l' }), [{ property_id: 'l', amount: 900, period_year: 2025, period_month: 1 }], '999', 2025)]);
  ok('Ε1: γη → 101, όχι 109', land.lines.length === 1 && land.lines[0].code === '101');
  const park = buildE1Summary([buildE2Row(P({ id: 'k', prop_type: 'parking' }), T({ property_id: 'k' }), [{ property_id: 'k', amount: 600, period_year: 2025, period_month: 1 }], '999', 2025)]);
  ok('Ε1: θέση στάθμευσης → 105, όχι 103', park.lines[0].code === '105');
  // μηδενικά εισοδήματα δεν μπαίνουν
  const empty = buildE1Summary([buildE2Row(P({ id: 'z', status_detail: 'vacant', target_rent: 0 }), T({ property_id: 'z', monthly_rent: 0 }), [], '999', 2025)]);
  ok('Ε1: κενά ακίνητα εξαιρούνται', empty.lines.length === 0 && empty.totalGross === 0);
}

// ── ΑΝΑΜΕΙΞΗ ΑΚΙΝΗΤΩΝ: το φυσικό λάθος του καλούντος δεν πρέπει να περνά ─────
// Το ερώτημα φέρνει τις διαμονές ΟΛΟΥ του χαρτοφυλακίου μαζί. Αν κάποιος τις
// περάσει ενιαία, κάθε ακίνητο θα δήλωνε τα έσοδα όλων — σε φορολογικό έντυπο.
{
  const foreign: E2Stay[] = [
    ...STAYS,
    { property_id: 'ΑΛΛΟ-ΑΚΙΝΗΤΟ', check_in: '2025-07-20', check_out: '2025-07-27', nights: 7, gross_guest_paid: 5000, climate_levy: 56, platform_fee: 700 },
  ];
  const r = buildE2Row(SEASONAL, null, [], '999999999', 2025, foreign);
  ok('διαμονές άλλου ακινήτου ΔΕΝ προσμετρώνται', r.grossIncome === 1648);
  ok('…δηλαδή δεν φουσκώνει σε 6592', r.grossIncome !== 6592);
}
{
  // Ιστορική γραμμή χωρίς property_id θεωρείται του ακινήτου: ο καλών περνά ήδη
  // φιλτραρισμένο σύνολο και δεν θέλουμε να χαθεί έσοδο επειδή λείπει η στήλη.
  const legacy: E2Stay[] = [
    { check_in: '2025-07-01', check_out: '2025-07-08', nights: 7, gross_guest_paid: 1000, climate_levy: 32, platform_fee: 150 },
  ];
  const r = buildE2Row(SEASONAL, null, [], '999999999', 2025, legacy);
  ok('διαμονή χωρίς property_id μετράει (ιστορική γραμμή)', r.grossIncome === 968);
}

// ═══ Ο ΠΙΝΑΚΑΣ I ΕΧΕΙ ΑΡΙΘΜΗΜΕΝΕΣ ΣΤΗΛΕΣ ΚΑΙ Η ΑΡΙΘΜΗΣΗ ΕΙΝΑΙ ΤΟΥ ΕΝΤΥΠΟΥ ═══
// Το ΑΤΑΚ είναι το μόνο κλειδί που δένει το ακίνητο του Ε2 με τη γραμμή του στο
// Ε9 και ο λογιστής το χρειάζεται. ΔΕΝ υπάρχει όμως στο επίσημο έντυπο: μια
// στήλη παραπάνω μετατοπίζει όσες ακολουθούν και το φύλλο παύει να αντιστοιχεί
// σε αυτό που ζητά το myAADE. Μπαίνει σε ΔΙΚΟ ΜΑΣ φύλλο ελέγχου, δίπλα στο ίδιο
// α/α — το έντυπο μένει ακέραιο.
//
// Ο έλεγχος φυλάει και τα δύο: ότι το πλήθος και η σειρά των επίσημων στηλών δεν
// μετακινούνται και ότι καμία δεν λέγεται «ΑΤΑΚ».
{
  ok('ο Πίνακας I έχει ακριβώς δεκαεννέα στήλες', E2_OFFICIAL_HEADERS.length === 19);
  ok('καμία επίσημη στήλη δεν είναι το ΑΤΑΚ',
     E2_OFFICIAL_HEADERS.every(h => !/ΑΤΑΚ/i.test(h)));
  // Οι δείκτες των αριθμητικών στηλών είναι θέσεις μέσα στη σειρά. Αν προστεθεί
  // στήλη πριν από αυτές, δείχνουν σε λάθος κελί και τα ποσά μορφοποιούνται ως
  // κείμενο ή αθροίζονται λάθος — χωρίς κανένα σφάλμα να εμφανιστεί.
  ok('οι αριθμητικές στήλες δείχνουν μέσα στο εύρος',
     Object.values(E2_NUM_COLS).every(i => i >= 0 && i < E2_OFFICIAL_HEADERS.length));
  ok('η επιφάνεια είναι η πέμπτη στήλη, όπως στο έντυπο', E2_NUM_COLS.sqm === 4);
  ok('τα τέσσερα ακαθάριστα είναι οι τέσσερις τελευταίες',
     E2_NUM_COLS.gross16 === E2_OFFICIAL_HEADERS.length - 1
     && E2_NUM_COLS.gross13 === E2_OFFICIAL_HEADERS.length - 4);
  // Κάθε γραμμή που παράγουμε πρέπει να έχει ΑΚΡΙΒΩΣ όσα κελιά και οι επικεφαλίδες.
  // ΠΡΟΣΟΧΗ ΣΤΟ ΠΟΙΑ ΣΥΝΑΡΤΗΣΗ: η `e2RowToCells` είναι η ΠΑΛΙΑ, εννιάστηλη
  // αναπαράσταση (και έχει ΑΤΑΚ, γιατί δεν είναι το επίσημο έντυπο). Το φύλλο
  // που πάει στο myAADE το χτίζει η `buildE2OfficialCells`.
  const cells = buildE2OfficialCells(SEASONAL, null, [], '999999999', 2025, 1, []);
  ok('η επίσημη γραμμή έχει όσα κελιά και οι επικεφαλίδες', cells.length === 1 && cells[0].length === E2_OFFICIAL_HEADERS.length);
  const legacy = e2RowToCells(buildE2Row(SEASONAL, null, [], '999999999', 2025, []), 1);
  ok('η παλιά αναπαράσταση δεν συγχέεται με την επίσημη', legacy.length !== E2_OFFICIAL_HEADERS.length);
}

// ═══ ΔΥΟ ΜΙΣΘΩΣΕΙΣ ΣΤΟ ΙΔΙΟ ΕΤΟΣ: ΔΥΟ ΓΡΑΜΜΕΣ, ΔΥΟ ΑΦΜ ═══════════════════════
// Παλιός μισθωτής Ιαν έως Ιουν με 700€, νέος από 15/07 με 900€. Πριν: μία
// γραμμή με τον «τρέχοντα» μισθωτή δίπλα στο ενοίκιο και των δύο.
//   γραμμή 1: 6 × 700 = 4200, 01/01/2025 έως 30/06/2025, 6 μήνες
//   γραμμή 2: 5 × 900 = 4500 (Αύγ έως Δεκ), 15/07/2025 έως 31/12/2025, 6 μήνες (Ιούλ έως Δεκ)
const L1: E2Tenant = { id: 't1', property_id: 'p1', afm: '111111111', full_name: 'Άννα Παλιά', monthly_rent: 700, lease_start: '2023-02-01', lease_end: '2025-06-30', lease_type: null };
const L2: E2Tenant = { id: 't2', property_id: 'p1', afm: '222222222', full_name: 'Βασίλης Νέος', monthly_rent: 900, lease_start: '2025-07-15', lease_end: null, lease_type: null };
const pay = (month: number, amount: number, o: Partial<E2Payment> = {}): E2Payment => ({ property_id: 'p1', amount, period_year: 2025, period_month: month, ...o });
const TWO_LEASE_PAYS: E2Payment[] = [
  ...[1, 2, 3, 4, 5, 6].map(m => pay(m, 700, { tenant_id: 't1' })),
  ...[8, 9, 10, 11, 12].map(m => pay(m, 900, { tenant_id: 't2' })),
];
{
  const r = buildE2Row(P(), [L1, L2], TWO_LEASE_PAYS, '999999999', 2025);
  ok('δύο μισθώσεις → δύο γραμμές', r.lines.length === 2);
  const [a, b] = r.lines;
  ok('γραμμή 1: ΑΦΜ του παλιού μισθωτή', a.tenantAfm === '111111111' && a.tenantName === 'Άννα Παλιά');
  ok('γραμμή 1: ημερομηνίες μέσα στο έτος', a.from === '01/01/2025' && a.to === '30/06/2025');
  ok('γραμμή 1: 6 μήνες, 4200', a.months === 6 && a.gross === 4200);
  ok('γραμμή 2: ΑΦΜ του νέου μισθωτή', b.tenantAfm === '222222222');
  ok('γραμμή 2: 15/07 έως 31/12', b.from === '15/07/2025' && b.to === '31/12/2025');
  ok('γραμμή 2: 6 μήνες, 4500 από τις δικές του δόσεις', b.months === 6 && b.gross === 4500);
  ok('σύνολο ακινήτου 8700, 12 μήνες', r.grossIncome === 8700 && r.months === 12);
  ok('με εισπράξεις δεν είναι εκτίμηση', !r.flags.some(f => f.includes('εκτίμηση')));
  const cells = buildE2OfficialCells(P(), [L1, L2], TWO_LEASE_PAYS, '999999999', 2025, 3);
  ok('επίσημες γραμμές: δύο, α/α 3 και 4', cells.length === 2 && cells[0][0] === 3 && cells[1][0] === 4);
  ok('επίσημες γραμμές: ΑΦΜ στη στ. 7', cells[0][8] === '111111111' && cells[1][8] === '222222222');
  ok('επίσημες γραμμές: στ. 13 ανά μίσθωση', cells[0][E2_NUM_COLS.gross13] === 4200 && cells[1][E2_NUM_COLS.gross13] === 4500);
  ok('επίσημες γραμμές: μηνιαίο ανά μίσθωση', cells[0][E2_NUM_COLS.monthly] === 700 && cells[1][E2_NUM_COLS.monthly] === 900);
}
{
  // Χωρίς `tenant_id` (παλιές δόσεις) το μοίρασμα γίνεται με τον μήνα.
  const noIds = TWO_LEASE_PAYS.map(x => ({ ...x, tenant_id: null }));
  const r = buildE2Row(P(), [L1, L2], noIds, '999999999', 2025);
  ok('χωρίς tenant_id: μοίρασμα κατά μήνα', r.lines[0].gross === 4200 && r.lines[1].gross === 4500);
}
{
  // Δόση με tenant_id μισθωτή που δεν καλύπτει το έτος: ΔΕΝ φορτώνεται σε άλλον.
  const r = buildE2Row(P(), [L1], [pay(1, 700, { tenant_id: 't1' }), pay(9, 950, { tenant_id: 'x9' })], '999999999', 2025);
  ok('ξένη δόση: χωριστή γραμμή χωρίς μισθωτή', r.lines.length === 2 && r.lines[1].tenantAfm === '' && r.lines[1].gross === 950);
  ok('ξένη δόση: σημαίνεται', r.flags.some(f => f.startsWith('Εισπράξεις') && f.includes('χωρίς μίσθωση')));
}

// ═══ ΠΑΛΙΟ ΕΤΟΣ ΜΕΤΑ ΑΠΟ ΑΛΛΑΓΗ ΜΙΣΘΩΤΗ ═══════════════════════════════════
// Ε2 του 2025 βγαλμένο το 2026, αφού ήρθε νέος μισθωτής. Πριν: ο ΣΗΜΕΡΙΝΟΣ
// μισθωτής έμπαινε στη γραμμή του 2025, μήνες 0, ημερομηνίες κενές, δίπλα
// στο ενοίκιο του παλιού.
{
  const tenants = [
    { id: 'old', property_id: 'p1', afm: '111111111', full_name: 'Παλιός', monthly_rent: 800, lease_start: '2024-03-01', lease_end: '2027-02-28', lease_type: null, move_out_date: '2026-02-28', status: 'past', created_at: '2024-03-01' },
    { id: 'new', property_id: 'p1', afm: '333333333', full_name: 'Νέος', monthly_rent: 950, lease_start: '2026-03-01', lease_end: null, lease_type: null, move_out_date: null, status: 'active', created_at: '2026-02-20' },
  ];
  const leases = leasesInYear(tenants, 2025);
  ok('μισθώσεις του 2025: μόνο ο παλιός', leases.length === 1 && leases[0].id === 'old');
  const pays = Array.from({ length: 12 }, (_, i) => pay(i + 1, 800, { tenant_id: 'old' }));
  const r = buildE2Row(P(), leases, pays, '999999999', 2025);
  ok('παλιό έτος: ΑΦΜ του μισθωτή εκείνου του έτους', r.lines[0].tenantAfm === '111111111');
  ok('παλιό έτος: ΟΧΙ το ΑΦΜ του σημερινού', !r.lines.some(l => l.tenantAfm === '333333333'));
  ok('παλιό έτος: 12 μήνες, όχι 0', r.lines[0].months === 12 && r.months === 12);
  ok('παλιό έτος: ημερομηνίες κομμένες στο έτος', r.lines[0].from === '01/01/2025' && r.lines[0].to === '31/12/2025');
  ok('παλιό έτος: 9600', r.grossIncome === 9600);
  // Και ο νέος χωρίς ημερομηνία έναρξης δεν μπαίνει σε παλιό έτος όταν
  // υπάρχει χρονολογημένη μίσθωση που το καλύπτει.
  const undated = tenants.map(t => (t.id === 'new' ? { ...t, lease_start: null } : t));
  ok('ο νέος χωρίς έναρξη δεν μπαίνει στο 2025', leasesInYear(undated, 2025).every(t => t.id === 'old'));
  // Έτος χωρίς καμία μίσθωση, με ιστορικό μισθωτών: ΚΕΝΟ, ρητά.
  const r24 = buildE2Row(P(), leasesInYear(tenants, 2023), [], '999999999', 2023, [], { hasLeaseHistory: true });
  ok('χωρίς μίσθωση στο έτος, με ιστορικό: ΚΕΝΟ (39)', r24.lines.length === 1 && r24.lines[0].kind.code === '39' && r24.grossIncome === 0);
  ok('…όχι εκτίμηση από τον στόχο', !r24.flags.some(f => f.includes('εκτίμηση')));
  ok('…και το λέει', r24.flags.some(f => f.includes('ΚΕΝΟ')));
}
{
  // Η κατάσταση περιγράφει το σήμερα: «Κενό» σήμερα, μίσθωση Ιαν έως Ιουν.
  // Η γραμμή είναι εκμίσθωση χωρίς επισήμανση αντίφασης.
  const lease: E2Tenant = { id: 'a', property_id: 'p1', afm: '444444444', monthly_rent: 700, lease_start: '2025-01-01', lease_end: '2025-06-30', lease_type: null };
  const r = buildE2Row(P({ status_detail: 'vacant' }), [lease], [1, 2, 3, 4, 5, 6].map(m => pay(m, 700, { tenant_id: 'a' })), '999999999', 2025);
  ok('σημερινό «Κενό», μίσθωση μέσα στο έτος: εκμίσθωση', r.lines[0].kind.code === '1' && r.grossIncome === 4200);
  ok('…χωρίς επισήμανση αντίφασης', !r.flags.some(f => f.startsWith('Η κατάσταση λέει')));
}

// ═══ ΕΝΟΙΚΙΟ ΚΑΙ ΥΠΗΡΕΣΙΕΣ ΣΤΗΝ ΙΔΙΑ ΔΟΣΗ ═════════════════════════════════
// Δόση 1100 = ενοίκιο 1000 + υπηρεσίες 100 (ίντερνετ, Netflix, καθαρισμός).
// Πριν: στ. 13 = 12 × 1100 = 13200. Σωστό: 12 × 1000 = 12000· οι 1200 των
// υπηρεσιών βγαίνουν στο φύλλο ελέγχου.
{
  const lease: E2Tenant = { id: 's', property_id: 'p1', afm: '555555555', monthly_rent: 1000, lease_start: '2024-01-01', lease_end: null, lease_type: null };
  const pays = Array.from({ length: 12 }, (_, i) => pay(i + 1, 1100, { tenant_id: 's', base_rent: 1000, services_charge: 100, paid: true }));
  const r = buildE2Row(P(), [lease], pays, '999999999', 2025);
  ok('στ. 13 = μόνο το ενοίκιο (12000)', r.grossIncome === 12000);
  ok('ΟΧΙ 13200', r.grossIncome !== 13200);
  ok('οι υπηρεσίες μετρήθηκαν χωριστά (1200)', r.servicesExcluded === 1200);
  ok('οι υπηρεσίες λέγονται στις επισημάνσεις', r.flags.some(f => f.startsWith('Υπηρεσίες') && f.includes('ΔΕΝ μπήκαν στη στ. 13')));
  ok('χωρίς επισήμανση παλιών γραμμών', !r.flags.some(f => f.includes('χωρίς χωριστό ενοίκιο')));
  // Μερίδιο 50%: και οι υπηρεσίες στο μερίδιο.
  const half = buildE2Row(P({ ownership: 50 }), [lease], pays, '999999999', 2025);
  ok('μερίδιο 50%: 6000 και υπηρεσίες 600', half.grossIncome === 6000 && half.servicesExcluded === 600);
  // Χωρίς services_charge: υπηρεσίες = ποσό μείον ενοίκιο.
  const noSvc = buildE2Row(P(), [lease], [pay(1, 1100, { tenant_id: 's', base_rent: 1000 })], '999999999', 2025);
  ok('υπηρεσίες από τη διαφορά όταν λείπει η στήλη', noSvc.grossIncome === 1000 && noSvc.servicesExcluded === 100);
  // Παλιά γραμμή χωρίς base_rent: μετρά ολόκληρη, αλλά σημαίνεται.
  const legacy = buildE2Row(P(), [lease], [pay(1, 1100, { tenant_id: 's' }), pay(2, 1100, { tenant_id: 's', base_rent: 1000, services_charge: 100 })], '999999999', 2025);
  ok('παλιά γραμμή: ολόκληρο το ποσό (1100 + 1000)', legacy.grossIncome === 2100);
  ok('παλιά γραμμή: σημαίνεται', legacy.flags.some(f => f.startsWith('1 δόση χωρίς χωριστό ενοίκιο')));
}

// ═══ ΣΤΗΛΗ 16: ΑΝΕΙΣΠΡΑΚΤΑ ═══════════════════════════════════════════════
// Η νομική διεκδίκηση δεν αποθηκεύεται, οπότε η 16 μένει κενή και το ποσό
// μένει στη 13, με ρητή επισήμανση.
{
  const lease: E2Tenant = { id: 'u', property_id: 'p1', afm: '666666666', monthly_rent: 1000, lease_start: '2024-01-01', lease_end: null, lease_type: null };
  const pays = Array.from({ length: 12 }, (_, i) => pay(i + 1, 1000, { tenant_id: 'u', base_rent: 1000, services_charge: 0, paid: i < 10 ? true : (i === 10 ? false : null) }));
  const r = buildE2Row(P(), [lease], pays, '999999999', 2025);
  ok('ανείσπρακτα: 2 δόσεις (false και null) = 2000', r.unpaidRent === 2000);
  ok('ανείσπρακτα: μένουν στη στ. 13', r.grossIncome === 12000);
  ok('ανείσπρακτα: επισήμανση για στ. 16 και άρθρο 39', r.flags.some(f => f.includes('στ. 16') && f.includes('άρθρο 39')));
  ok('ανείσπρακτα: όχι «εκτίμηση» (δεν μπερδεύει τον έλεγχο)', !r.flags.some(f => f.includes('εκτίμηση')));
  const cells = buildE2OfficialCells(P(), [lease], pays, '999999999', 2025, 1);
  ok('στ. 16 κενή', cells[0][E2_NUM_COLS.gross16] === '');
  // Το `paid` που δεν ζητήθηκε δεν είναι «απλήρωτο».
  const unknown = buildE2Row(P(), [lease], [pay(1, 1000, { tenant_id: 'u' })], '999999999', 2025);
  ok('χωρίς στήλη paid: κανένα ανείσπρακτο', unknown.unpaidRent === 0);
}

// ═══ ΒΡΑΧΥΧΡΟΝΙΑ ΜΕ ΔΙΑΜΟΝΕΣ ΣΕ ΤΡΕΙΣ ΜΗΝΕΣ ═════════════════════════════
// Πριν: 12 μήνες, 01/01 έως 31/12 και μηνιαίο = στόχος, δίπλα σε ακαθάριστο
// από διαμονές. Σωστό: μήνες με διανυκτερεύσεις (3), πρώτη και τελευταία
// διαμονή, μηνιαίο κενό. Ακαθάριστο 500 + 300 + 700 = 1500.
{
  const st: E2Stay[] = [
    { property_id: 'p1', check_in: '2025-03-10', check_out: '2025-03-15', nights: 5, gross_guest_paid: 500, climate_levy: 0, platform_fee: 50 },
    { property_id: 'p1', check_in: '2025-06-01', check_out: '2025-06-04', nights: 3, gross_guest_paid: 300, climate_levy: 0, platform_fee: 30 },
    { property_id: 'p1', check_in: '2025-08-20', check_out: '2025-08-27', nights: 7, gross_guest_paid: 700, climate_levy: 0, platform_fee: 70 },
  ];
  const prop = P({ status_detail: 'rented', rental_mode: 'short_term', target_rent: 800 });
  const r = buildE2Row(prop, null, [], '999999999', 2025, st);
  ok('βραχυχρόνια: μία γραμμή', r.lines.length === 1);
  ok('βραχυχρόνια: 3 μήνες, όχι 12', r.lines[0].months === 3 && r.months === 3);
  ok('βραχυχρόνια: από την πρώτη διαμονή', r.lines[0].from === '10/03/2025');
  ok('βραχυχρόνια: ως την τελευταία', r.lines[0].to === '27/08/2025');
  ok('βραχυχρόνια: χωρίς μηνιαίο μίσθωμα', r.lines[0].monthly === '');
  ok('βραχυχρόνια: ακαθάριστο από διαμονές (1500)', r.grossIncome === 1500);
  ok('βραχυχρόνια: εξήγηση στις επισημάνσεις', r.flags.includes(E2_SHORT_TERM_NOTE));
  const cells = buildE2OfficialCells(prop, null, [], '999999999', 2025, 1, st)[0];
  ok('βραχυχρόνια στο έντυπο: στ. 10 = 3, στ. 11 κενή', cells[E2_NUM_COLS.months] === 3 && cells[E2_NUM_COLS.monthly] === '');
  ok('βραχυχρόνια στο έντυπο: στ. 17 του άρθρου 39Α', cells[5] === E2_USE.shortTerm && cells[5] === 'Βραχυχρόνια μίσθωση (άρθρο 39Α ΚΦΕ)');
  // Διαμονή που περνά την αλλαγή του χρόνου κόβεται στο έτος.
  const cross: E2Stay[] = [{ property_id: 'p1', check_in: '2024-12-30', check_out: '2025-01-02', nights: 3, gross_guest_paid: 300, climate_levy: 0 }];
  const rc = buildE2Row(prop, null, [], '999999999', 2025, cross);
  ok('διαμονή αλλαγής χρόνου: από 01/01', rc.lines[0].from === '01/01/2025' && rc.lines[0].to === '02/01/2025' && rc.lines[0].months === 1);
  // Χωρίς καμία διαμονή: το ακαθάριστο μένει ρητή εκτίμηση, μήνες και μηνιαίο κενά.
  const est = buildE2OfficialCells(prop, null, [], '999999999', 2025, 1, [])[0];
  ok('βραχυχρόνια χωρίς διαμονές: κανένα πλασματικό μηνιαίο', est[E2_NUM_COLS.monthly] === '' && est[E2_NUM_COLS.months] === '' && est[10] === '' && est[11] === '');
}

// ═══ Ε1: ΙΔΙΟΧΡΗΣΙΜΟΠΟΙΗΣΗ ΕΚΤΟΣ, ΑΝΤΙΣΤΟΙΧΙΣΗ ΡΗΤΗ ═══════════════════════
{
  const base: E2Row = { atak: '1', address: 'Α', ownerAfm: '9', ownershipPct: 100, leaseKind: '', months: 12, incomeCategory: 'Κατοικία', grossIncome: 6000, incomeSource: 'rent', flags: [] };
  const e1 = buildE1Summary([
    base,
    { ...base, grossIncome: 3000, incomeSource: 'own_use' },
    { ...base, grossIncome: 2000, incomeCategory: 'Ακίνητο' },
  ]);
  ok('Ε1: η ιδιοχρησιμοποίηση ΔΕΝ μπαίνει στο 103', e1.lines.find(l => l.code === '103')?.amount === 6000);
  ok('Ε1: η ιδιοχρησιμοποίηση φαίνεται χωριστά', e1.ownUse === 3000);
  const un = e1.lines.find(l => l.unmapped);
  ok('Ε1: κατηγορία χωρίς κωδικό ΔΕΝ γίνεται σιωπηλά 103', !!un && un.code === '' && un.amount === 2000 && un.label === E1_UNMAPPED_LABEL);
  ok('Ε1: σύνολο εκμίσθωσης 8000 (χωρίς την ιδιοχρησιμοποίηση)', e1.totalGross === 8000);
  ok('Ε1: η σημείωση ζητά επιβεβαίωση από τον λογιστή', /λογιστή/.test(e1.note));
}

// ═══ ΤΟ ΕΠΙΣΗΜΟ ΕΝΤΥΠΟ, ΣΤΗΛΗ ΠΡΟΣ ΣΤΗΛΗ (Φ-01.002/Έκδοση 2026) ═══════════════
{
  // Η αρίθμηση όπως τυπώνεται από αριστερά προς τα δεξιά στο έντυπο.
  ok('οι αριθμοί των στηλών με τη σειρά του εντύπου',
     E2_COLUMNS.map(c => c.no).join(',') === '1,2,3,4,5,17,18,6,7,19,8,9,10,11,12,13,14,15,16');
  ok('η στήλη 18 ζητά 9 ψηφία', E2_COLUMNS[6].label.includes('9 πρώτα ψηφία'));

  // Στ. 17 ανά είδος: κατοικία, επαγγελματικός χώρος, γη, ιδιοχρησιμοποίηση, ΚΕΝΟ.
  const home = buildE2Row(P(), T({ lease_start: '2025-01-01', lease_category: 'residential' }), [], '999', 2025);
  ok('στ. 17: μακροχρόνια μίσθωση κατοικίας', home.lines[0].use === 'Μακροχρόνια μίσθωση κατοικίας');
  const shopCommercial = buildE2Row(P({ prop_type: 'shop' }), T({ lease_start: '2025-01-01', lease_category: 'commercial' }), [], '999', 2025);
  ok('στ. 17: μίσθωση επαγγελματικού χώρου', shopCommercial.lines[0].use === E2_USE.businessLease);
  const homeAsOffice = buildE2Row(P(), T({ lease_start: '2025-01-01', lease_category: 'commercial' }), [], '999', 2025);
  ok('στ. 17: διαμέρισμα με επαγγελματικό μισθωτήριο', homeAsOffice.lines[0].use === E2_USE.businessLease);
  const own = buildE2Row(P({ status_detail: 'own_use' }), null, [], '999', 2025);
  ok('στ. 17: ιδιοχρησιμοποίηση', own.lines[0].use === 'Ιδιοχρησιμοποίηση');
  const vacant = buildE2Row(P({ status_detail: 'vacant', target_rent: null }), null, [], '999', 2025);
  ok('οδηγία 2: κενό όλο τον χρόνο, γραμμή με ΚΕΝΟ', vacant.lines.length === 1 && vacant.lines[0].use === 'ΚΕΝΟ' && vacant.grossIncome === 0);
  const reno = buildE2Row(P({ status_detail: 'renovation', target_rent: null }), null, [], '999', 2025);
  ok('ανακαίνιση χωρίς μίσθωση: ΚΕΝΟ και όχι κενή στήλη 17', reno.lines[0].use === 'ΚΕΝΟ' && !reno.flags.some(f => f.includes('χειροκίνητος')) && reno.flags.some(f => f.includes('Ανακαίνιση')));
  const vacantCells = e2OfficialRows(P({ status_detail: 'vacant', power_supply_no: '123456789017' }), vacant, 1)[0];
  ok('ΚΕΝΟ: η στήλη 18 γράφεται κι εδώ (οδηγία 8)', vacantCells[6] === '123456789');

  // Στ. 19 ανά μίσθωση: δύο μισθωτές στο έτος, δύο αριθμοί δήλωσης.
  const two = buildE2Row(P(), [
    T({ id: 'a', afm: '111111111', lease_start: '2024-01-01', lease_end: '2025-05-31', aade_lease_decl_ref: '1234 5678' }),
    T({ id: 'b', afm: '222222222', lease_start: '2025-06-01', lease_end: null, aade_lease_decl_ref: '87654321' }),
  ], [], '999', 2025);
  const twoCells = e2OfficialRows(P(), two, 1);
  ok('στ. 19: ο αριθμός κάθε μίσθωσης στη γραμμή της, μόνο ψηφία', twoCells[0][9] === '12345678' && twoCells[1][9] === '87654321');

  // Συμπληρωματικά I: ένας συνιδιοκτήτης χωρίς ποσοστό παίρνει το υπόλοιπο.
  const shared = P({ ownership: 60, co_owners: [{ name: 'Νίκος Π.', afm: '987654321', address: 'Πατησίων 5' }], power_supply_no: '123456789' });
  const sr = buildE2Row(shared, T({ lease_start: '2025-01-01', lease_category: 'residential' }), [], '999', 2025);
  const sup = e2SupplementaryRows(shared, sr);
  ok('Συμπληρωματικά I: μία γραμμή ανά συνιδιοκτήτη', sup.length === 1 && sup[0][7] === 'Νίκος Π.' && sup[0][8] === '987654321' && sup[0][9] === 'Πατησίων 5');
  ok('Συμπληρωματικά I: ποσοστό 100 μείον το μερίδιο', sup[0][10] === 40);
  ok('Συμπληρωματικά I: παροχή ρεύματος', sup[0][6] === '123456789');
  ok('Συμπληρωματικά I: χωρίς συνιδιοκτήτες τίποτα', e2SupplementaryRows(P(), home).length === 0);

  // Συμπληρωματικά II: κτήση μέσα στο έτος.
  ok('Συμπληρωματικά II: αγορά του έτους', e2AcquiredRows(P({ purchase_date: '2025-04-10' }), 2025)[0]?.[3].toString().startsWith('Αγορά 10/04/2025'));
  ok('Συμπληρωματικά II: παλιότερη αγορά δεν μπαίνει', e2AcquiredRows(P({ purchase_date: '2019-04-10' }), 2025).length === 0);
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\ne2.ts — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`);
if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
console.log('όλα πέρασαν');
