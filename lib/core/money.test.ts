// Τεστ για τη στρογγυλοποίηση στο λεπτό (lib/core/money.ts).
// Το μισό λεπτό ανεβαίνει, όπως το έγραψε ο άνθρωπος, όχι όπως το αποθηκεύει
// το δυαδικό: 180,285 × 100 = 18028,499999999996 στη μηχανή.
import { cents, centsOr0 } from './money'

let passed = 0, failed = 0
function eq(name: string, a: unknown, b: unknown) {
  if (Object.is(a, b) || a === b) { passed++ } else { failed++; console.log(`  ✗ ${name}: περίμενα ${String(b)}, πήρα ${String(a)}`) }
}

// ── Το μισό λεπτό ────────────────────────────────────────────────────────────
eq('ΕΝΦΙΑ 180,285 → 180,29', cents(180.285), 180.29)
eq('1,005 → 1,01', cents(1.005), 1.01)
eq('2,675 → 2,68', cents(2.675), 2.68)
eq('1.234,565 → 1.234,57', cents(1234.565), 1234.57)
eq('centsOr0 ακολουθεί τον ίδιο κανόνα', centsOr0(180.285), 180.29)

// ── Τα απλά μένουν απλά ──────────────────────────────────────────────────────
eq('0,1 + 0,2 → 0,30', cents(0.1 + 0.2), 0.3)
eq('κάτω από το μισό: 123,454999 → 123,45', cents(123.454999), 123.45)
eq('ακέραιο', cents(250), 250)
eq('μεγάλο ποσό', cents(1234567.895), 1234567.9)

// ── Η συμπεριφορά στο άκυρο δεν αλλάζει ─────────────────────────────────────
eq('NaN ταξιδεύει', Number.isNaN(cents(NaN)), true)
eq('centsOr0(NaN) → 0', centsOr0(NaN), 0)
eq('centsOr0(null) → 0', centsOr0(null), 0)
eq('centsOr0(undefined) → 0', centsOr0(undefined), 0)

console.log(`money.ts — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`)
if (failed > 0) { process.exit(1) }
console.log('όλα πέρασαν')
