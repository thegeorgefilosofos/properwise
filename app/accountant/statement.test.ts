// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
// ─────────────────────────────────────────────────────────────────────────
// Η πρόταση «Κανένα ακίνητο χωρίς καταχωρημένη είσπραξη: Α, Β» έφτασε ζωντανή
// σε οθόνη που τη διαβάζει επαγγελματίας. Λέει το ΑΝΤΙΘΕΤΟ από ό,τι εννοεί και
// από κάτω παραθέτει τη λίστα που την αναιρεί. Κανένας τύπος και κανένας
// φύλακας δεν πιάνει πρόταση που διαβάζεται ανάποδα — μόνο ένας έλεγχος που τη
// γράφει ολόκληρη και τη συγκρίνει.
//
// Και δεύτερο: το ποσό της οθόνης και το ποσό του αρχείου βγαίνουν από την ΙΔΙΑ
// συνάρτηση. Ο έλεγχος το κρατά έτσι, γιατί η απόκλιση δεν θα φαινόταν πουθενά
// μέχρι να την υποβάλει κάποιος.
// ═══════════════════════════════════════════════════════════════════════════
import {
  propertyLines, statementTotals, statementGaps, statementSheets, shareOf, hasCoOwnership,
  indicativeTax, deductionNote,
  type PortalProperty,
} from './statement';
import { rentalIncomeTax, rentalBracketsForYear } from '@/lib/billing/greekTax';

/** Οι παλιοί έλεγχοι είναι όλοι στη χρήση 2025. */
const linesOf = (ps: PortalProperty[]) => propertyLines(ps, 2025);

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => {
  if (cond) passed++; else { failed++; fails.push(name); }
};
const eq = <T>(name: string, got: T, want: T) =>
  ok(`${name} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`, JSON.stringify(got) === JSON.stringify(want));

const prop = (over: Partial<PortalProperty> = {}): PortalProperty => ({
  name: 'Ακίνητο', atak: '01234567890', address: 'Οδός 1, Αθήνα', prop_type: 'Κατοικία',
  sqm: 60, ownership: 100,
  rent_collected: 0, rent_months: 0, rent_monthly: null,
  expenses: [], stays: [], ...over,
});

// ── Η ΠΡΟΤΑΣΗ ΠΟΥ ΔΙΑΒΑΖΟΤΑΝ ΑΝΑΠΟΔΑ ─────────────────────────────────────
{
  const lines = linesOf([prop({ name: 'Παγκράτι' }), prop({ name: 'Κουκάκι' })]);
  const g = statementGaps(lines).find(x => x.key === 'income');
  eq('όλα χωρίς είσπραξη', g?.text, 'Κανένα ακίνητο δεν έχει καταχωρημένη είσπραξη: Παγκράτι, Κουκάκι');
  ok('η παλιά, ανάποδη διατύπωση δεν επανέρχεται', !(g?.text || '').startsWith('Κανένα ακίνητο χωρίς'));
}
{
  const lines = linesOf([
    prop({ name: 'Παγκράτι', rent_collected: 4800, rent_months: 12 }),
    prop({ name: 'Κουκάκι' }),
  ]);
  const g = statementGaps(lines).find(x => x.key === 'income');
  eq('μερικά χωρίς είσπραξη', g?.text, '1 από 2 ακίνητα χωρίς καταχωρημένη είσπραξη: Κουκάκι');
}

// ── ΤΙ ΕΜΠΟΔΙΖΕΙ ΤΟ ΚΛΕΙΣΙΜΟ ──────────────────────────────────────────────
{
  const lines = linesOf([prop({
    sqm: 0, rent_collected: 1200, rent_months: 3,
    expenses: [{ category: 'ΔΕΗ', amount: 90, date: '2025-03-04' }],
  })]);
  const g = statementGaps(lines).find(x => x.key === 'sqm');
  ok('το εμβαδόν που λείπει εμποδίζει τη γραμμή του Ε2', g?.blocking === true);
  ok('όσα ακίνητα έχουν ΑΤΑΚ δεν παράγουν εκκρεμότητα', !statementGaps(lines).some(x => x.key === 'atak'));
}
{
  // Παλιά `get_accountant_data`, χωρίς εμβαδόν στην απάντηση: η οθόνη δεν
  // επιτρέπεται να κατηγορήσει τον ιδιοκτήτη για κάτι που έχει καταχωρήσει.
  const old = { ...prop({ rent_collected: 1200, rent_months: 3 }) } as unknown as Record<string, unknown>;
  delete old.sqm;
  const lines = linesOf([old as unknown as PortalProperty]);
  ok('πεδίο που δεν στέλνει η βάση δεν γίνεται εκκρεμότητα', !statementGaps(lines).some(x => x.key === 'sqm'));
}

// ── ΤΟ ΩΜΟ TOTAL ΔΕΝ ΑΘΡΟΙΖΕΤΑΙ ───────────────────────────────────────────
{
  const lines = linesOf([prop({
    stays: [{ check_in: '2025-07-01', check_out: '2025-07-05', nights: 4, total: 500,
              gross_guest_paid: 500, climate_levy: 40, platform_fee: 75, amount_basis: 'gross' }],
  })]);
  // 500 πλήρωσε ο επισκέπτης· τα 40 είναι τέλος ανθεκτικότητας του Δημοσίου.
  eq('δηλωτέο ακαθάριστο χωρίς το τέλος', lines[0].shortGross, 460);
  eq('η γραμμή δηλώνει βάση, άρα δεν είναι εκκρεμής', lines[0].staysUnresolved, 0);
}
{
  const lines = linesOf([prop({
    stays: [{ check_in: '2025-07-01', check_out: '2025-07-05', nights: 4, total: 300 }],
  })]);
  eq('χωρίς ανάλυση μπαίνει το total', lines[0].shortGross, 300);
  eq('και μετριέται ως εκκρεμές', lines[0].staysUnresolved, 1);
}

// ── ΚΕΝΗ ΧΡΗΣΗ ────────────────────────────────────────────────────────────
{
  const t = statementTotals(linesOf([prop(), prop()]));
  eq('κενή χρήση δεν έχει καταχωρήσεις', t.hasEntries, false);
  eq('και κανένα έσοδο', t.income, 0);
}

// ── ΟΘΟΝΗ ΚΑΙ ΑΡΧΕΙΟ ΛΕΝΕ ΤΟ ΙΔΙΟ ─────────────────────────────────────────
{
  const lines = linesOf([
    prop({ name: 'Α', rent_collected: 4800, rent_months: 12, expenses: [{ category: 'ΔΕΗ', amount: 120, date: '2025-02-01' }] }),
    prop({ name: 'Β', stays: [{ check_in: '2025-08-01', check_out: '2025-08-04', nights: 3, total: 400, gross_guest_paid: 400, climate_levy: 30, amount_basis: 'gross' }] }),
  ]);
  const t = statementTotals(lines);
  const sheets = statementSheets({ owner: 'Ιδιοκτήτης', year: 2025, issued: '18/08/2026', lines });
  const cols = sheets[0].columns.map(c => c.header);
  const fromFile = sheets[0].rows.reduce((s, r) => s + Number(r[cols.indexOf('Σύνολο εσόδων')] || 0), 0);
  eq('το σύνολο του αρχείου ισούται με το σύνολο της οθόνης', fromFile, t.income);
  eq('και είναι το σωστό σύνολο', t.income, 4800 + 370);
}
// ── ΤΟ ΠΟΣΟΣΤΟ ΙΣΧΥΕΙ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ ───────────────────────────────
// Η στήλη των εσόδων περνούσε από το ποσοστό συνιδιοκτησίας· η στήλη των
// δαπανών όχι. Δίπλα δίπλα, ο λογιστής διάβαζε έσοδα στο 50% και δαπάνες στο
// 100% για το ίδιο ακίνητο, χωρίς τίποτα να το λέει.
{
  const lines = linesOf([prop({
    ownership: 50, rent_collected: 4800, rent_months: 12,
    expenses: [{ category: 'ΔΕΗ', amount: 1200, date: '2025-02-01' }],
  })]);
  const sheets = statementSheets({ owner: 'Ιδιοκτήτης', year: 2025, issued: '18/08/2026', lines });
  const cols = sheets[0].columns.map(c => c.header);
  const cell = (h: string) => sheets[0].rows[0][cols.indexOf(h)];
  eq('η αναλογία εσόδων ακολουθεί το ποσοστό συνιδιοκτησίας', cell('Αναλογία εσόδων ιδιοκτήτη'), 2400);
  eq('και οι δαπάνες με το ΙΔΙΟ ποσοστό', cell('Αναλογία δαπανών ιδιοκτήτη'), 600);
  eq('ενώ η ολόκληρη δαπάνη μένει ορατή', cell('Δαπάνες χρήσης'), 1200);
  ok('και το φύλλο εξηγεί τι δείχνουν οι δύο στήλες',
    (sheets[0].notes || []).some(n => n.includes('στα έσοδα ΚΑΙ στις δαπάνες')));
}

// Χωρίς συνιδιοκτησία δεν λέγεται τίποτα: η σημείωση θα ήταν θόρυβος.
{
  const sheets = statementSheets({ owner: 'Ι', year: 2025, issued: '18/08/2026',
    lines: linesOf([prop({ rent_collected: 1000, rent_months: 12 })]) });
  ok('χωρίς συνιδιοκτησία καμία σημείωση αναλογίας',
    !(sheets[0].notes || []).some(n => n.includes('στα έσοδα ΚΑΙ στις δαπάνες')));
}

// ── ΚΑΝΕΝΑ ΑΔΕΙΟ ΦΥΛΛΟ ────────────────────────────────────────────────────
{
  const bare = statementSheets({ owner: 'Ι', year: 2025, issued: '18/08/2026', lines: linesOf([prop()]) });
  eq('χωρίς δαπάνες και διαμονές μένουν δύο φύλλα', bare.map(s => s.name).join('|'), 'Ανά ακίνητο|Τι λείπει');

  const full = statementSheets({ owner: 'Ι', year: 2025, issued: '18/08/2026', lines: linesOf([prop({
    expenses: [{ category: 'ΔΕΗ', amount: 10, date: '2025-01-01' }],
    stays: [{ check_in: '2025-01-01', check_out: '2025-01-02', nights: 1, total: 80 }],
  })]) });
  eq('με δεδομένα μπαίνουν και τα τέσσερα', full.map(s => s.name).join('|'), 'Ανά ακίνητο|Δαπάνες|Διαμονές|Τι λείπει');
}

// ── Η ΥΠΟΣΧΕΣΗ ΠΡΟΣ ΤΟΝ ΙΔΙΟΚΤΗΤΗ ─────────────────────────────────────────
// «Ο λογιστής δεν βλέπει πελατολόγιο ούτε στοιχεία τρίτων». Το αρχείο που
// φεύγει από την πύλη είναι ο ευκολότερος τρόπος να σπάσει αυτή η πρόταση
// χωρίς να το προσέξει κανείς.
{
  const sheets = statementSheets({ owner: 'Ι', year: 2025, issued: '18/08/2026', lines: linesOf([prop({
    expenses: [{ category: 'ΔΕΗ', amount: 10, date: '2025-01-01' }],
    stays: [{ check_in: '2025-01-01', check_out: '2025-01-02', nights: 1, total: 80 }],
  })]) });
  const headers = sheets.flatMap(s => s.columns.map(c => c.header)).join(' ');
  for (const forbidden of ['ΑΦΜ', 'Μισθωτ', 'Επισκέπτ', 'Προμηθευτ', 'Ονοματεπώνυμο']) {
    ok(`το αρχείο δεν μεταφέρει «${forbidden}»`, !headers.includes(forbidden));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Η ΟΘΟΝΗ ΚΑΙ ΤΟ ΑΡΧΕΙΟ ΤΗΣ ΙΔΙΑΣ ΣΕΛΙΔΑΣ ΕΛΕΓΑΝ ΔΙΑΦΟΡΕΤΙΚΑ ΠΟΣΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Η πύλη του λογιστή έδειχνε τα σύνολα στο 100% του ακινήτου κι
// υπολόγιζε τον ενδεικτικό φόρο πάνω τους. Το .xlsx που κατεβαίνει από ΤΗΝ
// ΙΔΙΑ σελίδα είχε στήλες «Αναλογία» κομμένες στο ποσοστό, με σημείωση που το
// εξηγεί. Ο συνιδιοκτήτης στο 50% διάβαζε 12.000€ στην οθόνη κι 6.000€ στο
// αρχείο — κι η οθόνη τύπωνε από πάνω «συνιδιοκτησία 50%».
//
// ΤΑ ΔΥΟ ΜΕΓΕΘΗ ΒΓΑΙΝΟΥΝ ΠΛΕΟΝ ΑΠΟ ΤΗΝ ΙΔΙΑ `shareOf`, ΜΕΣΑ ΣΤΑ ΙΔΙΑ ΣΥΝΟΛΑ:
// δεν υπάρχει τρόπος να αποκλίνουν, γιατί δεν υπάρχουν δύο υπολογισμοί.
// ═══════════════════════════════════════════════════════════════════════════
{
  const lines = linesOf([prop({
    ownership: 50, rent_collected: 12000, rent_months: 12,
    expenses: [{ category: 'ΔΕΗ', amount: 2000, date: '2025-02-01' }],
  })]);
  const t = statementTotals(lines);
  eq('το ολικό μένει ορατό, για τη γραμμή του Ε2', t.income, 12000);
  eq('ΚΑΙ Η ΑΝΑΛΟΓΙΑ ΥΠΑΡΧΕΙ ΔΙΠΛΑ ΤΟΥ', t.incomeShare, 6000);
  eq('το ίδιο και στις δαπάνες', t.expenses, 2000);
  eq('με το ΙΔΙΟ ποσοστό', t.expensesShare, 1000);
  ok('κι η σελίδα ξέρει ότι πρέπει να τα πει και τα δύο', t.hasShare === true);

  // Η ΑΝΑΛΟΓΙΑ ΤΩΝ ΣΥΝΟΛΩΝ ΣΥΜΦΩΝΕΙ ΜΕ ΤΙΣ ΣΤΗΛΕΣ ΤΟΥ ΑΡΧΕΙΟΥ, ΚΕΛΙ ΜΕ ΚΕΛΙ.
  const sheets = statementSheets({ owner: 'Ιδιοκτήτης', year: 2025, issued: '18/08/2026', lines });
  const cols = sheets[0].columns.map(c => c.header);
  const cell = (h: string) => sheets[0].rows[0][cols.indexOf(h)];
  eq('οθόνη και αρχείο λένε το ΙΔΙΟ για τα έσοδα', cell('Αναλογία εσόδων ιδιοκτήτη'), t.incomeShare);
  eq('και το ίδιο για τις δαπάνες', cell('Αναλογία δαπανών ιδιοκτήτη'), t.expensesShare);
}

// ── ΧΩΡΙΣ ΣΥΝΙΔΙΟΚΤΗΣΙΑ ΤΙΠΟΤΑ ΔΕΝ ΑΛΛΑΖΕΙ ─────────────────────────────────
{
  const lines = linesOf([prop({ ownership: 100, rent_collected: 9000, rent_months: 12 })]);
  const t = statementTotals(lines);
  eq('η αναλογία ΕΙΝΑΙ το σύνολο', t.incomeShare, t.income);
  ok('κι δεν λέγεται δεύτερη φορά', t.hasShare === false);
}

// ── ΤΟ ΠΟΣΟΣΤΟ ΠΟΥ ΛΕΙΠΕΙ ΔΕΝ ΕΙΝΑΙ ΜΗΔΕΝ ─────────────────────────────────
// Ακίνητο χωρίς καταχωρημένο ποσοστό ανήκει ΟΛΟΚΛΗΡΟ σε αυτόν που το έγραψε:
// το κενό είναι «δεν το συμπλήρωσε», όχι «κατέχει το μηδέν».
{
  eq('κενό ποσοστό → όλο το ποσό', shareOf(500, null), 500);
  eq('μηδέν → όλο το ποσό', shareOf(500, 0), 500);
  eq('πάνω από 100 → όλο το ποσό', shareOf(500, 150), 500);
  eq('σκουπίδι → όλο το ποσό', shareOf(500, Number.NaN), 500);
  eq('τριάντα τρία τοις εκατό', Math.round(shareOf(900, 33.33)), 300);
  ok('κι δεν θεωρείται συνιδιοκτησία όταν λείπει',
    !hasCoOwnership(linesOf([prop({ ownership: null, rent_collected: 100, rent_months: 1 })])));
}

// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΥΛΗ ΕΛΕΓΕ «ΕΙΣΠΡΑΞΕΙΣ» ΓΙΑ ΤΟ ΔΕΔΟΥΛΕΥΜΕΝΟ
// ─────────────────────────────────────────────────────────────────────────
// Η βάση στέλνει πλέον χωριστά το δεδουλευμένο (`rent_due`, η βάση του Ε2) και
// όσα εισπράχθηκαν (`rent_collected`). Τα έσοδα της κατάστασης ακολουθούν το
// Ε2· η είσπραξη λέγεται δίπλα, ποτέ στη θέση του.
// ═══════════════════════════════════════════════════════════════════════════
{
  const [l] = linesOf([prop({ rent_due: 9600, rent_collected: 7200, rent_months: 12 })]);
  eq('τα έσοδα είναι το δεδουλευμένο του Ε2', l.rentAnnual, 9600);
  eq('η είσπραξη μένει χωριστή', l.rentCollected, 7200);
  eq('και στο σύνολο μπαίνει το δεδουλευμένο', l.income, 9600);
  const sheets = statementSheets({ owner: 'Ι', year: 2025, issued: '01/10/2026', lines: [l] });
  const cols = sheets[0].columns.map(c => c.header);
  eq('το αρχείο έχει στήλη είσπραξης', sheets[0].rows[0][cols.indexOf('Από αυτά εισπράχθηκαν')], 7200);
  eq('και οι μήνες λέγονται μήνες', sheets[0].rows[0][cols.indexOf('Μήνες μίσθωσης')], 12);
}
{
  // Βάση πριν τη μετανάστευση: το `rent_collected` ήταν το δεδουλευμένο. Δεν
  // το βαφτίζουμε είσπραξη, ούτε το μηδενίζουμε.
  const [l] = linesOf([prop({ rent_collected: 4800, rent_months: 12 })]);
  eq('παλιά βάση: το ποσό κρατιέται ως δεδουλευμένο', l.rentAnnual, 4800);
  eq('παλιά βάση: η είσπραξη μένει άγνωστη', l.rentCollected, null);
}

// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΙΑΜΟΝΗ ΠΟΥ ΠΕΡΝΑ ΤΗΝ ΠΡΩΤΟΧΡΟΝΙΑ ΜΟΙΡΑΖΕΤΑΙ ΜΕ ΤΙΣ ΝΥΧΤΕΣ, ΟΠΩΣ ΣΤΟ Ε2
// ─────────────────────────────────────────────────────────────────────────
// 28/12/2025 έως 05/01/2026: οκτώ νύχτες, τέσσερις σε κάθε χρονιά. Ηταν
// ολόκληρη στο 2025 και καθόλου στο 2026.
// ═══════════════════════════════════════════════════════════════════════════
{
  const stay = { check_in: '2025-12-28', check_out: '2026-01-05', nights: 8, total: 800,
    gross_guest_paid: 800, climate_levy: 16, platform_fee: 120, amount_basis: 'gross' };
  const p = prop({ stays: [stay] });
  const y25 = propertyLines([p], 2025)[0];
  const y26 = propertyLines([p], 2026)[0];
  eq('2025: τέσσερις από τις οκτώ νύχτες', y25.shortGross, 392);
  eq('2026: οι άλλες τέσσερις', y26.shortGross, 392);
  eq('και τα δύο μισά κάνουν το δηλωτέο ακαθάριστο', y25.shortGross + y26.shortGross, 784);

  const sheets = statementSheets({ owner: 'Ι', year: 2026, issued: '01/10/2026', lines: [y26] });
  const st = sheets.find(s => s.name === 'Διαμονές')!;
  const cols = st.columns.map(c => c.header);
  eq('το φύλλο γράφει τις νύχτες της χρήσης', st.rows[0][cols.indexOf('Νύχτες στη χρήση')], 4);
  eq('και το μερίδιο του ποσού', st.rows[0][cols.indexOf('Δηλωτέο ακαθάριστο')], 392);
  eq('και της προμήθειας', st.rows[0][cols.indexOf('Προμήθεια πλατφόρμας')], 60);
  ok('και εξηγεί γιατί', (st.notes || []).some(n => n.includes('αλλαγή του έτους')));
}
{
  // Διαμονή άλλης χρονιάς που έφτασε από τη βάση δεν μετρά καθόλου.
  const p = prop({ stays: [{ check_in: '2024-07-01', check_out: '2024-07-03', nights: 2, total: 200 }] });
  const [l] = propertyLines([p], 2025);
  eq('διαμονή εκτός χρήσης: μηδέν', l.shortGross, 0);
  eq('και δεν μετρά ως εκκρεμής', l.staysUnresolved, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Η ΤΕΚΜΑΡΤΗ ΕΚΠΤΩΣΗ ΑΚΟΛΟΥΘΕΙ ΤΟΝ ΤΡΟΠΟ ΕΙΣΠΡΑΞΗΣ ΑΠΟ ΤΗ ΧΡΗΣΗ 2027
// ─────────────────────────────────────────────────────────────────────────
// Η οθόνη εφάρμοζε πάντα 5%. Ως και το 2026 αυτό ισχύει· από το 2027 κρίνεται
// ανά ακίνητο με τον κανόνα της Λογιστικής.
// ═══════════════════════════════════════════════════════════════════════════
{
  const cashy = prop({ name: 'Μετρητά', rent_due: 10000, rent_collected: 10000, rent_months: 12,
    rent_paid_with_method: 12, rent_paid_cash: 3, lease_via_bank: true });
  const banky = prop({ name: 'Τράπεζα', rent_due: 10000, rent_collected: 10000, rent_months: 12,
    rent_paid_with_method: 12, rent_paid_cash: 0, lease_via_bank: false });

  const t26 = indicativeTax(propertyLines([cashy], 2026), 2026);
  eq('2026: η έκπτωση δίνεται ό,τι κι αν έγινε', t26.taxable, 9500);
  eq('2026: ο φόρος στο 95%', t26.tax, rentalIncomeTax(9500, rentalBracketsForYear(2026)));
  eq('2026: η σημείωση δεν μιλά για τράπεζα', deductionNote(t26, 2026), 'Με τεκμαρτή έκπτωση 5%.');

  const t27 = indicativeTax(propertyLines([cashy, banky], 2027), 2027);
  eq('2027: μετρητά χωρίς έκπτωση, τράπεζα με', t27.taxable, 10000 + 9500);
  eq('2027: η απόδειξη νικά την πρόθεση της μίσθωσης', t27.withoutDeduction.map(w => w.name), ['Μετρητά']);
  eq('2027: η σημείωση λέει ποιο και γιατί', deductionNote(t27, 2027),
    'Τεκμαρτή έκπτωση 5% μόνο όπου η είσπραξη έγινε μέσω τραπέζης. Χωρίς έκπτωση: Μετρητά (3 από 12 εισπράξεις σε μετρητά).');

  // Χωρίς καμία είσπραξη με τρόπο, μιλά η μίσθωση.
  const lease = prop({ name: 'Μίσθωση', rent_due: 6000, rent_collected: 0, rent_months: 12,
    rent_paid_with_method: 0, rent_paid_cash: 0, lease_via_bank: true });
  eq('2027: η μίσθωση μέσω τραπέζης δίνει την έκπτωση',
    indicativeTax(propertyLines([lease], 2027), 2027).taxable, 5700);
  eq('2027: όλα μέσω τραπέζης και λέγεται',
    deductionNote(indicativeTax(propertyLines([lease], 2027), 2027), 2027),
    'Με τεκμαρτή έκπτωση 5%: οι εισπράξεις της χρήσης έγιναν μέσω τραπέζης.');

  // Παλιά βάση, χωρίς τα πλήθη: δεν μαντεύουμε την κερδοφόρα εκδοχή.
  const old = prop({ name: 'Παλιά', rent_collected: 6000, rent_months: 12 });
  const tOld = indicativeTax(propertyLines([old], 2027), 2027);
  eq('2027 χωρίς δεδομένα: καμία έκπτωση', tOld.taxable, 6000);
  ok('2027 χωρίς δεδομένα: λέγεται ότι δεν φαίνεται',
    deductionNote(tOld, 2027).includes('δεν φαίνεται από αυτόν τον σύνδεσμο'));

  // Συνιδιοκτησία: ο φόρος στο μερίδιο, όπως πριν.
  const half = prop({ ownership: 50, rent_due: 12000, rent_collected: 12000, rent_months: 12 });
  eq('το φορολογητέο είναι στο μερίδιο', indicativeTax(propertyLines([half], 2025), 2025).taxable, 5700);
}

console.log(`\nstatement.ts — ${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
console.log('✓ όλα πέρασαν');
