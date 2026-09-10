// ═══════════════════════════════════════════════════════════════════════════
// ownerSplit — Κατανομή εσόδων/εξόδων σε συνιδιοκτήτες + διαχειριστική αμοιβή.
//
// Για την persona «διαχειριστής ακινήτων»: ένα ακίνητο μπορεί να ανήκει σε
// πολλούς ιδιοκτήτες (ποσοστά) και ο διαχειριστής κρατά αμοιβή (% επί των
// εισπραγμένων ενοικίων). Υπολογίζει το ΚΑΘΑΡΟ κάθε ιδιοκτήτη μετά τα κοινά
// έξοδα και την αμοιβή, με ακριβή στρογγυλοποίηση (το άθροισμα «κλείνει»).
//
// Καθαρό & δοκιμάσιμο — καμία εξάρτηση.
// ═══════════════════════════════════════════════════════════════════════════

export interface OwnerShare { name: string; pct: number; afm?: string }

export interface SplitInput {
  grossIncome: number;         // εισπραγμένα ενοίκια περιόδου
  expenses: number;            // κοινά έξοδα περιόδου (βαρύνουν τους ιδιοκτήτες pro-rata)
  owners: OwnerShare[];        // ποσοστά ιδιοκτησίας (0-100, άθροισμα ~100)
  managementFeePct?: number;   // αμοιβή διαχειριστή, % επί των εισπραγμένων (default 0)
  managerName?: string;
}

export interface OwnerResult {
  name: string; pct: number; afm?: string;
  incomeShare: number; expenseShare: number; feeShare: number; net: number;
}

export interface SplitResult {
  owners: OwnerResult[];
  gross: number; expenses: number; managementFee: number; distributable: number;
  managerName?: string;
  pctSum: number; valid: boolean; warning?: string;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function computeSplit(input: SplitInput): SplitResult {
  const gross = r2(input.grossIncome);
  const expenses = r2(input.expenses);
  const feePct = Math.max(0, Number(input.managementFeePct) || 0);
  const managementFee = r2(gross * feePct / 100);
  const distributable = r2(gross - expenses - managementFee);

  const owners = (input.owners || []).filter(o => o && o.name?.trim());
  const pctSum = r2(owners.reduce((s, o) => s + (Number(o.pct) || 0), 0));
  const valid = Math.abs(pctSum - 100) < 0.01 && owners.length > 0;

  // Raw υπολογισμοί ανά ιδιοκτήτη (με βάση το ποσοστό).
  const results: OwnerResult[] = owners.map(o => {
    const pct = Number(o.pct) || 0;
    const f = pct / 100;
    return {
      name: o.name.trim(), pct, afm: o.afm,
      incomeShare: r2(gross * f), expenseShare: r2(expenses * f), feeShare: r2(managementFee * f),
      net: r2(distributable * f),
    };
  });

  // Στρογγυλοποίηση: το άθροισμα των net πρέπει να ισούται ακριβώς με το distributable.
  // Το υπόλοιπο (λόγω 2 δεκαδικών) πάει στον ιδιοκτήτη με το μεγαλύτερο ποσοστό.
  //
  // ΤΟ `valid &&` ΔΕΝ ΕΙΝΑΙ ΠΡΟΦΥΛΑΞΗ — ΔΙΟΡΘΩΝΕΙ ΣΦΑΛΜΑ ΠΟΥ ΜΕΤΡΗΘΗΚΕ.
  // Χωρίς αυτό, όταν τα ποσοστά ΔΕΝ αθροίζουν 100 (τυπογραφικό: 50 + 30),
  // η «διαφορά στρογγυλοποίησης» δεν ήταν λεπτά — ήταν ΟΛΟ το αδιάθετο ποσοστό.
  // Σε διανεμητέο 1.000,00€: ο Α με 50% έπαιρνε 700,00€ αντί για 500,00€,
  // δηλαδή τα 500,00€ του συν ολόκληρα τα 200,00€ του αδιάθετου 20%.
  // Και το άθροισμα έβγαινε 1.000,00€ ακριβώς, οπότε ο έλεγχος «κλείνει;»
  // περνούσε — το λάθος ήταν αόρατο ακριβώς επειδή το σύνολο φαινόταν σωστό.
  // Όταν τα ποσοστά είναι άκυρα, τα μερίδια μένουν αναλογικά προς το ποσοστό
  // του καθενός· η ασυμφωνία τη δείχνει το `valid`, δεν τη σκεπάζει ο πρώτος.
  //
  // ── ΙΣΟΣΚΕΛΙΖΟΝΤΑΙ ΟΛΕΣ ΟΙ ΣΤΗΛΕΣ, ΟΧΙ ΜΟΝΟ ΤΟ ΚΑΘΑΡΟ ──────────────────────
  // Η διόρθωση εφαρμοζόταν μόνο στο `net`, ενώ το ίδιο PDF τυπώνει και τις
  // στήλες Εσόδων, Δαπανών και Αμοιβής μαζί με τα ολικά τους. Σε μεικτό
  // 1.234,55€ με 50/50, η στήλη Εσόδων έβγαζε 617,28 + 617,28 = 1.234,56€
  // απέναντι σε σύνολο 1.234,55€. Ενα λεπτό — αλλά σε χαρτί που παραδίδεται σε
  // λογιστή με αριθμό εγγράφου και QR επαλήθευσης, η στήλη που δεν κλείνει
  // είναι η πρώτη ένσταση και μετά από αυτήν αμφισβητούνται και οι υπόλοιπες.
  if (valid && results.length) {
    // Ο ιδιοκτήτης με το μεγαλύτερο ποσοστό σηκώνει το υπόλοιπο: το λεπτό
    // βαραίνει αναλογικά λιγότερο εκεί και η επιλογή είναι ίδια για κάθε στήλη
    // ώστε δύο στήλες να μη διορθώνονται σε διαφορετικό πρόσωπο.
    let idx = 0;
    for (let i = 1; i < results.length; i++) if (results[i].pct > results[idx].pct) idx = i;

    const balance = (key: 'incomeShare' | 'expenseShare' | 'feeShare' | 'net', total: number) => {
      const sum = r2(results.reduce((s, r) => s + r[key], 0));
      const diff = r2(total - sum);
      if (Math.abs(diff) >= 0.01) results[idx][key] = r2(results[idx][key] + diff);
    };
    balance('incomeShare', gross);
    balance('expenseShare', expenses);
    balance('feeShare', managementFee);
    balance('net', distributable);
  }

  return {
    owners: results, gross, expenses, managementFee, distributable,
    managerName: input.managerName?.trim() || undefined,
    pctSum, valid,
    warning: valid ? undefined : (owners.length === 0 ? 'Δεν έχουν οριστεί ιδιοκτήτες.' : `Τα ποσοστά αθροίζουν ${pctSum}% (πρέπει 100%).`),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΝΟΙΚΙΑΣΤΗΣ ΠΛΗΡΩΝΕΙ, ΟΙ ΙΔΙΟΚΤΗΤΕΣ ΧΡΕΩΝΟΝΤΑΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Η οθόνη κατανομής ζητούσε από τη βάση σκέτα `amount,date` κι
// άθροιζε ΚΑΘΕ δαπάνη του ακινήτου. Ομως η εφαρμογή ξέρει ήδη ποιος πλήρωσε:
// το `paid_by` δηλώνεται στη φόρμα δαπάνης («Ποιος πληρώνει») κι στον
// λογαριασμό. Η τιμή `tenant` σημαίνει ότι το ποσό ΔΕΝ βγήκε από την τσέπη
// των ιδιοκτητών. Το κοινόχρηστο ρεύμα που πληρώνει ο ενοικιαστής, εκατό ευρώ
// τον μήνα, αφαιρούνταν από το διανεμητέο: 1.200,00€ τον χρόνο που ο κάθε
// συνιδιοκτήτης δεν έπαιρνε ποτέ — τυπωμένα σε χαρτί με αριθμό εγγράφου κι
// QR επαλήθευσης.
//
// ΓΙΑΤΙ ΔΕΝ ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ Η `ownerShareAmount` ΤΟΥ lib/expenses/sharing.
// Εκείνη λύνει ΑΛΛΟ ερώτημα —«πόσα βαρύνουν ΕΜΕΝΑ»— κι γι' αυτό κόβει τις
// μοιρασμένες δαπάνες στο `share_percent`. Εδώ το ερώτημα είναι «πόσα
// βαρύνουν ΟΛΗ ΤΗΝ ΠΛΕΥΡΑ ΤΩΝ ΙΔΙΟΚΤΗΤΩΝ», γιατί ο πίνακας από κάτω τα
// μοιράζει ο ίδιος στα ποσοστά. Δαπάνη 100,00€ δηλωμένη «με συνιδιοκτήτη 50%»
// σε ακίνητο 50/50 σημαίνει ότι ο ένας έβαλε 50,00€ κι ο άλλος 50,00€: το
// διανεμητέο πρέπει να πέσει κατά 100,00€ κι ο καθένας να χρεωθεί 50,00€.
// Με την `ownerShareAmount` θα έπεφτε κατά 50,00€ κι ο καθένας θα χρεωνόταν
// 25,00€ — δηλαδή θα διορθώναμε ένα σφάλμα φτιάχνοντας το αντίστροφό του.
// Οι μοιρασμένες τιμές εξετάστηκαν κι μένουν ολόκληρες, με αυτόν τον λόγο.
// ═══════════════════════════════════════════════════════════════════════════

/** Δαπάνη όπως τη διαβάζει η κατανομή: ποσό κι ποιος την πλήρωσε. */
export interface BorneExpense { amount?: number | string | null; paid_by?: string | null }

/** Το σύνολο των δαπανών που βάρυναν πράγματι τους ιδιοκτήτες. */
export function ownersExpenseTotal(rows: BorneExpense[] | null): number {
  return r2((rows || []).reduce(
    (s, e) => e?.paid_by === 'tenant' ? s : s + (Number(e?.amount) || 0), 0));
}
