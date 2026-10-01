// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΥ ΒΡΙΣΚΕΤΑΙ ΣΗΜΕΡΑ ΤΟ ΔΑΝΕΙΟ
// ─────────────────────────────────────────────────────────────────────────
// Η οθόνη του δανείου έδειχνε πέντε πλακίδια ίδιου βάρους: Ποσό, Επιτόκιο, Δόση,
// Συνολικοί τόκοι, Δάνειο προς αξία. Το «Ποσό» είναι το ΑΡΧΙΚΟ κεφάλαιο — ο
// αριθμός που ίσχυε την ημέρα της υπογραφής και ποτέ ξανά. Ο ιδιοκτήτης που
// πληρώνει οκτώ χρόνια διάβαζε ακόμη το ποσό της πρώτης μέρας σαν να ήταν το
// χρέος του.
//
// Ο αριθμός που ΛΕΙΠΕ ήταν το υπόλοιπο: πόσα χρωστάω ακόμη. Είναι ο λόγος που
// ανοίγει κανείς αυτή την οθόνη και δεν υπήρχε πουθενά.
//
// ΓΙΑΤΙ ΟΧΙ 30,44 ΗΜΕΡΕΣ ΤΟΝ ΜΗΝΑ
//
// Η οθόνη μετρούσε τους περασμένους μήνες ως `ημέρες / 30.44`. Η προσέγγιση
// χάνει περίπου τέσσερις ημέρες τον χρόνο· σε εικοσαετές δάνειο είναι σχεδόν
// τρεις ολόκληρες δόσεις λάθος — και το λάθος πέφτει πάνω στο υπόλοιπο, δηλαδή
// στον έναν αριθμό που πρέπει να είναι σωστός. Εδώ οι μήνες μετρώνται ΗΜΕΡΟΛΟΓΙΑΚΑ.
//
// ΤΙ ΔΕΝ ΞΕΡΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΤΟ ΛΕΕΙ
//
// Υπολογίζει το θεωρητικό υπόλοιπο ενός δανείου που πληρώνεται κανονικά, με
// σταθερή δόση. ΔΕΝ ξέρει έκτακτες καταβολές, ρυθμίσεις, περιόδους χάριτος ή
// αλλαγές επιτοκίου σε κυμαινόμενο. Γι' αυτό το αποτέλεσμα φέρει `estimated:
// true` — η οθόνη οφείλει να το παρουσιάζει ως εκτίμηση, όχι ως βεβαίωση
// τράπεζας. Ένας αριθμός που παριστάνει τον επίσημο είναι χειρότερος από κανέναν.
// ═══════════════════════════════════════════════════════════════════════════

/** Πόσοι ΗΜΕΡΟΛΟΓΙΑΚΟΙ μήνες πέρασαν από το `from` ως το `to`. */
export function monthsBetween(from: string | null | undefined, to: string): number | null {
  const a = parseIso(from), b = parseIso(to);
  if (!a || !b) return null;
  let m = (b.y - a.y) * 12 + (b.m - a.m);
  // Η δόση της τρέχουσας περιόδου δεν έχει πληρωθεί όσο δεν έφτασε η ημέρα.
  if (b.d < a.d) m -= 1;
  return m;
}

function parseIso(s: string | null | undefined): { y: number; m: number; d: number } | null {
  const t = (s || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

export interface LoanProgress {
  /** Δόσεις που έχουν πληρωθεί, ημερολογιακά. */
  paidMonths: number;
  /** Δόσεις που απομένουν. */
  remainingMonths: number;
  totalMonths: number;
  monthly: number;
  /** Πόσα χρωστάει ακόμη — Ο αριθμός της οθόνης. */
  balance: number;
  /** Κεφάλαιο που έχει ήδη εξοφληθεί. */
  principalPaid: number;
  /** Τόκοι που έχουν ήδη πληρωθεί. */
  interestPaid: number;
  /** Τόκοι που απομένουν, αν το δάνειο τρέξει ως το τέλος. */
  interestRemaining: number;
  /** 0–100. Πόσο του κεφαλαίου έχει εξοφληθεί. */
  percentRepaid: number;
  /** Μήνας/έτος τελευταίας δόσης, σε ISO (πρώτη του μήνα). */
  endDate: string | null;
  /** Πάντα true: θεωρητικός πίνακας, όχι κατάσταση τράπεζας. Βλ. κεφαλίδα. */
  estimated: true;
}

const finite = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/** Η μηνιαία δόση τοκοχρεολυτικού δανείου. */
export function monthlyPayment(amount: number, annualRatePct: number, years: number): number {
  const a = finite(amount), y = finite(years), rate = finite(annualRatePct);
  if (a <= 0 || y <= 0) return 0;
  const n = Math.round(y * 12);
  if (rate === 0) return a / n;
  const r = rate / 100 / 12;
  return (a * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Η θέση του δανείου σήμερα.
 *
 * Επιστρέφει `null` όταν λείπει ό,τι χρειάζεται για να βγει ΑΛΗΘΙΝΟΣ αριθμός
 * (ποσό, διάρκεια ή ημερομηνία έναρξης). Δεν επιστρέφει μηδενικά: ένα «0€
 * υπόλοιπο» σε δάνειο χωρίς καταχωρημένη έναρξη θα διαβαζόταν ως εξοφλημένο.
 */
export function loanProgress(input: {
  amount: number; annualRatePct: number; years: number;
  startDate: string | null | undefined; today: string;
}): LoanProgress | null {
  const amount = finite(input.amount);
  const years = finite(input.years);
  if (amount <= 0 || years <= 0) return null;

  const elapsed = monthsBetween(input.startDate, input.today);
  if (elapsed == null) return null;

  const totalMonths = Math.round(years * 12);
  // Πριν την έναρξη: τίποτα δεν έχει πληρωθεί. Μετά το τέλος: όλα.
  const paidMonths = Math.min(totalMonths, Math.max(0, elapsed));
  const monthly = monthlyPayment(amount, input.annualRatePct, years);
  const r = finite(input.annualRatePct) / 100 / 12;

  let balance = amount, interestPaid = 0;
  for (let i = 0; i < paidMonths; i++) {
    const interest = balance * r;
    // Η δόση δεν μπορεί να αποπληρώσει περισσότερα από όσα απομένουν: στον
    // τελευταίο μήνα το υπόλοιπο είναι μικρότερο από το κεφάλαιο της δόσης και
    // χωρίς το clamp το υπόλοιπο θα γινόταν αρνητικό — δηλαδή «η τράπεζα σου
    // χρωστάει».
    const principal = Math.min(balance, monthly - interest);
    interestPaid += interest;
    balance = Math.max(0, balance - principal);
  }

  // Οι τόκοι που απομένουν βγαίνουν από τις υπόλοιπες δόσεις, όχι με αφαίρεση
  // από ένα «συνολικό» — η αφαίρεση θα κουβαλούσε κάθε σφάλμα στρογγυλοποίησης.
  const remainingMonths = totalMonths - paidMonths;
  const interestRemaining = Math.max(0, monthly * remainingMonths - balance);

  return {
    paidMonths, remainingMonths, totalMonths, monthly,
    balance,
    principalPaid: amount - balance,
    interestPaid,
    interestRemaining,
    percentRepaid: amount > 0 ? ((amount - balance) / amount) * 100 : 0,
    endDate: addMonths(input.startDate, totalMonths),
    estimated: true,
  };
}

/** Η ημερομηνία της τελευταίας δόσης. */
export function addMonths(iso: string | null | undefined, months: number): string | null {
  const a = parseIso(iso);
  if (!a) return null;
  const total = a.y * 12 + (a.m - 1) + Math.round(months);
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  // Η ημέρα κρατιέται, αλλά δεν επιτρέπεται να ξεφύγει από τον μήνα: 31 Ιανουαρίου
  // + 1 μήνας δεν είναι 31 Φεβρουαρίου.
  const d = Math.min(a.d, daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// ═══════════════════════════════════════════════════════════════════════════
// Ο ΤΟΚΟΣ ΜΙΑΣ ΗΜΕΡΟΛΟΓΙΑΚΗΣ ΧΡΗΣΗΣ, ΟΧΙ ΕΝΟΣ ΕΤΟΥΣ ΤΟΥ ΔΑΝΕΙΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Η Λογιστική και η Νόα ζητούσαν τον τόκο της χρήσης Y ως `interestForYear(…,
// Y − έτος έναρξης + 1)`, δηλαδή τους μήνες 1 έως 12 του ΔΑΝΕΙΟΥ. Ένα δάνειο που
// ξεκινά 1 Σεπτεμβρίου έχει μέσα στην πρώτη χρήση τρεις δόσεις (Οκτώβριο,
// Νοέμβριο, Δεκέμβριο), όχι δώδεκα. Σε 150.000€ με 4% για 25 χρόνια η χρήση της
// έναρξης έγραφε τόκους 5.935,10€ αντί για 1.497,08€ και οι «δόσεις του έτους»
// έβγαιναν δώδεκα. Σε επιχειρηματικό καθεστώς ο τόκος εκπίπτει: τετραπλάσιος
// τόκος είναι τετραπλάσια έκπτωση που δεν υπάρχει.
//
// Η ΣΥΜΒΑΣΗ ΕΙΝΑΙ ΤΟΥ `loanProgress`. Η δόση k πέφτει στο `addMonths(έναρξη, k)`:
// η πρώτη έναν μήνα μετά την έναρξη, η τελευταία στο `endDate`. Έτσι το άθροισμα
// των χρήσεων ισούται με το σύνολο των τόκων και η τελευταία χρήση παίρνει μόνο
// τους μήνες που απομένουν.
//
// ΧΩΡΙΣ ΗΜΕΡΟΜΗΝΙΑ ΕΝΑΡΞΗΣ η χρήση λογίζεται ως το πρώτο πλήρες έτος του
// δανείου, όπως έκαναν ως τώρα οι καλούντες: δώδεκα δόσεις από το αρχικό κεφάλαιο.
// ═══════════════════════════════════════════════════════════════════════════

export interface LoanCalendarYear {
  /** Πόσες δόσεις πέφτουν μέσα στη χρήση. */
  payments: number;
  /** Τι πληρώθηκε συνολικά: δόσεις × δόση (η τελευταία ίσως μικρότερη). */
  paid: number;
  /** Ο τόκος αυτών των δόσεων. */
  interest: number;
  /** Το κεφάλαιο αυτών των δόσεων. */
  principal: number;
}

/** Δόσεις, τόκος και κεφάλαιο που πέφτουν στο ημερολογιακό έτος `year`. */
export function loanCalendarYear(input: {
  amount: number; annualRatePct: number; years: number; startDate: string | null | undefined;
}, year: number): LoanCalendarYear {
  const none: LoanCalendarYear = { payments: 0, paid: 0, interest: 0, principal: 0 };
  const amount = finite(input.amount);
  const totalMonths = Math.round(finite(input.years) * 12);
  if (amount <= 0 || totalMonths <= 0 || !Number.isFinite(year)) return none;
  // Ο απόλυτος μήνας της έναρξης. Χωρίς ημερομηνία: Δεκέμβριος του προηγούμενου
  // έτους, ώστε οι δόσεις 1 έως 12 να πέφτουν Ιανουάριο ως Δεκέμβριο της χρήσης.
  const a = parseIso(input.startDate);
  const start = a ? a.y * 12 + (a.m - 1) : (year - 1) * 12 + 11;
  const first = Math.max(1, year * 12 - start);
  const last = Math.min(totalMonths, year * 12 + 11 - start);
  if (last < first) return none;

  const monthly = monthlyPayment(amount, input.annualRatePct, input.years);
  const r = finite(input.annualRatePct) / 100 / 12;
  let balance = amount, interest = 0, principal = 0;
  for (let k = 1; k <= last && balance > 0; k++) {
    const i = balance * r;
    const p = Math.min(balance, monthly - i);
    if (k >= first) { interest += i; principal += p; }
    balance = Math.max(0, balance - p);
  }
  return { payments: last - first + 1, paid: interest + principal, interest, principal };
}
