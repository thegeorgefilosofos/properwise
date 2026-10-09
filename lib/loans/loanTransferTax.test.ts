// ═══════════════════════════════════════════════════════════════════════════
// Ο ΦΟΡΟΣ ΜΕΤΑΒΙΒΑΣΗΣ ΤΗΣ ΚΑΡΤΕΛΑΣ ΔΑΝΕΙΟ ΕΙΝΑΙ ΙΔΙΟΣ ΜΕ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Η καρτέλα Δάνειο είχε δικό της αντίγραφο του πίνακα απαλλαγής και άλλον
// κανόνα: «μέχρι το όριο τίποτα, πάνω από αυτό όλη η τιμή». Για άγαμο που
// αγοράζει πρώτη κατοικία 220.000€ έδειχνε 6.798€· η Λογιστική και ο νόμος
// 618€, φόρο μόνο για τις 20.000€ πάνω από το όριο. Βρέθηκε στην αξιολόγηση
// της 08/10/2026 (TabLoanCalculator.tsx:238).
// ═══════════════════════════════════════════════════════════════════════════
import { loanTransferTax, calcFmaExemption } from '@/app/dashboard/components/TabLoanData';
import { transferCosts, firstHomeExemption } from '@/lib/accounting/transfer';

let pass = 0; const fail: string[] = [];
const eq = (what: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail.push(`${what}\n    περίμενα: ${JSON.stringify(want)}\n    πήρα:     ${JSON.stringify(got)}`);
};
const accounting = (price: number, married: boolean, children: number) =>
  transferCosts({ side: 'buy', price, firstHome: true, married, children }).lines.find(l => l.key === 'transferTax')!.amount;

eq('άγαμος, 220.000€: 618€ και όχι 6.798€', loanTransferTax(220000, true, 'single', 0), 618);
eq('άγαμος, 200.000€: πλήρης απαλλαγή', loanTransferTax(200000, true, 'single', 0), 0);
eq('χωρίς πρώτη κατοικία: όλη η αξία', loanTransferTax(220000, false, 'single', 0), 6798);

// Η ίδια απάντηση με τη Λογιστική για κάθε οικογένεια και τιμή.
for (const [marital, children] of [['single', 0], ['married', 0], ['married', 1], ['married', 2], ['married', 4]] as const) {
  eq(`όριο ${marital}/${children} ίδιο με το transfer.ts`, calcFmaExemption(marital, children), firstHomeExemption({ married: marital === 'married', children }));
  for (const price of [150000, 250000, 300000, 420000]) {
    eq(`${marital}/${children} στα ${price}€: Δάνειο = Λογιστική`, loanTransferTax(price, true, marital, children), accounting(price, marital === 'married', children));
  }
}

if (fail.length) { console.error(`\n✗ loanTransferTax: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1); }
console.log(`✓ loanTransferTax: ${pass} έλεγχοι πέρασαν`);
