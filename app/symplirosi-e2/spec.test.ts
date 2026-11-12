// npx tsx app/symplirosi-e2/spec.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ Ε2 ΑΝΟΙΓΕΙ ΣΤΗ ΧΡΗΣΗ ΠΟΥ ΔΗΛΩΝΕΤΑΙ ΣΗΜΕΡΑ (έλεγχος 12/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Ο υπολογιστής «Ε2: τι γράφω πού» άνοιγε πάντα στο πρώτο προσφερόμενο έτος,
// δηλαδή στο περσινό· και η σελίδα για λογιστές έδειχνε φάκελο της περσινής
// χρήσης όλο τον χρόνο. Ο υπολογιστής φόρου ενοικίων και η πύλη του λογιστή
// ανοίγουν στο `declarationYear`: η περσινή ως τον Ιούλιο, η φετινή μετά.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { openingYear } from './spec';
import { declarationYear, offeredIncomeYears } from '@/lib/core/declarationYear';
import { FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

const yearsOn = (d: string) => offeredIncomeYears(d, FIRST_YEAR_NEW_BRACKETS - 1);
for (const [today, want] of [['2026-03-15', 2025], ['2026-07-31', 2025], ['2026-08-01', 2026], ['2026-11-12', 2026], ['2027-01-10', 2026]] as const) {
  ok(openingYear(today, yearsOn(today)) === want, `${today}: ανοίγει στο ${want} (βγήκε ${openingYear(today, yearsOn(today))})`);
  ok(openingYear(today, yearsOn(today)) === declarationYear(today), `${today}: ίδιο με το declarationYear`);
}
ok(openingYear('2026-11-12', [2025]) === 2025, 'εκτός προσφερόμενων: η πιο πρόσφατη διαθέσιμη');

// Η οθόνη ρωτά τη συνάρτηση και όχι το πρώτο στοιχείο του πίνακα.
const calc = readFileSync('app/symplirosi-e2/E2Calculator.tsx', 'utf8');
ok(calc.includes('String(openingYear(today, years))') && !calc.includes('String(years[0])'), 'το E2Calculator ανοίγει με το openingYear');
const logistes = readFileSync('app/logistes/page.tsx', 'utf8');
ok(/const PACK_YEAR = declarationYear\(athensToday\(\)\);/.test(logistes) && !/athensParts\(\)\.year - 1/.test(logistes), 'η σελίδα για λογιστές δείχνει τη χρήση της πύλης');

console.log(`\nsymplirosi-e2/spec.ts — ${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
