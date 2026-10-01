// npx tsx lib/property/powerSupply.test.ts
import { cleanDigits, e2PowerSupply, powerSupplyFromNote, E2_POWER_SUPPLY_DIGITS } from './powerSupply';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

// ── Αποθήκευση: ό,τι έγραψε ο χρήστης, χωρίς τα διαχωριστικά ──────────────
eq('ολόκληρος αριθμός μένει ολόκληρος', cleanDigits('1 23456789 01 7'), { value: '123456789017', error: null });
eq('τελείες και παύλες φεύγουν', cleanDigits('123.456-789'), { value: '123456789', error: null });
eq('γράμματα απορρίπτονται', cleanDigits('12A456789'), { value: null, error: 'Μόνο ψηφία.' });
eq('κενό → τίποτα', cleanDigits('  '), { value: null, error: null });

// ── Εξαγωγή: τα εννιά πρώτα της στήλης 18 ───────────────────────────────
eq('η στήλη θέλει εννιά ψηφία', E2_POWER_SUPPLY_DIGITS, 9);
eq('τα πρώτα εννιά', e2PowerSupply('123456789017'), '123456789');
eq('λιγότερα από εννιά μένουν ως έχουν', e2PowerSupply('12345'), '12345');
eq('χωρίς παροχή, κενό', e2PowerSupply(null), '');

// ── Από τη σημείωση σαρωμένου λογαριασμού ───────────────────────────────
eq('σημείωση σάρωσης', powerSupplyFromNote('AI σάρωση · 320 kWh · Παροχή: 1 23456789 01'), '12345678901');
eq('λογαριασμός πελάτη με λίγα ψηφία δεν είναι παροχή', powerSupplyFromNote('Παροχή: 4521'), null);
eq('χωρίς παροχή', powerSupplyFromNote('AI σάρωση'), null);

console.log(fail === 0 ? `✓ powerSupply: ${pass} έλεγχοι πέρασαν` : `✗ powerSupply: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
