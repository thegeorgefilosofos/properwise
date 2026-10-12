// npx tsx lib/energy/fixedCharge.test.ts
//
// ΤΟ ΠΑΓΙΟ ΣΕ ΔΥΟ ΚΛΙΜΑΚΕΣ ΛΕΓΕΤΑΙ ΟΠΩΣ ΧΡΕΩΝΕΤΑΙ
//
// Η κάρτα και η κατάταξη της καρτέλας «Ρεύμα» και η δημόσια σύγκριση έγραφαν
// μόνο το κάτω πάγιο, ενώ το `monthlyCost` χρεώνει το πάνω όταν η κατανάλωση
// του μήνα ξεπερνά το όριο. Εδώ φυλάγεται ότι η πρόταση του lib/energy/
// fixedCharge.ts λέει το ποσό που χρεώνει ο υπολογισμός με το ίδιο όριο και
// ότι οι δύο οθόνες τη γράφουν από εκεί.
import { readFileSync } from 'node:fs';
import { fixedBase, fixedTier2, fixedChargeText } from './fixedCharge';
import { monthlyCost } from './tariff';
import { ALL_TARIFFS } from './catalogue';
import { RAAEY_COLUMNS, RAAEY_ROWS } from './raaeyCatalogue';
import { parseRaaeyFixed } from './raaey';
import { fe, fn } from '@/lib/core/format';
import { facts } from '@/app/sygkrisi-timologion-revmatos/PowerCompare';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

const all = ALL_TARIFFS();
const tiered = all.filter(t => t.fixed_tier2 != null);

// ── ΠΟΙΑ ΤΙΜΟΛΟΓΙΑ: ΟΣΑ ΓΡΑΦΕΙ Η ΡΑΑΕΥ ΜΕ ΔΥΟ ΚΛΙΜΑΚΕΣ ───────────────────────
{
  const col = (name: string) => (RAAEY_COLUMNS as readonly string[]).indexOf(name);
  const refs = Object.entries(RAAEY_ROWS).flatMap(([sheet, rows]) => sheet.startsWith('power-')
    ? rows.filter(r => parseRaaeyFixed(String(r[col('fixedDiscounted')])).tier2).map(r => `${sheet}:${r[col('row')]}`)
    : []);
  ok('ο πίνακας της ΡΑΑΕΥ έχει πάγιο σε δύο κλίμακες', refs.length > 0);
  eq('κάθε τέτοια γραμμή που είναι στον κατάλογο κρατά και τις δύο κλίμακες',
    refs.filter(ref => all.some(t => t.raaey === ref) && !tiered.some(t => t.raaey === ref)), []);
  eq('και κάθε τιμολόγιο της ΡΑΑΕΥ με δύο κλίμακες έχει τέτοια γραμμή',
    tiered.filter(t => t.raaey && !refs.includes(t.raaey)).map(t => t.id), []);
}

// ── ΤΟ ΠΟΣΟ ΚΑΙ ΤΟ ΟΡΙΟ ΕΙΝΑΙ ΤΟΥ `monthlyCost` ──────────────────────────────
// Με μηδενική τιμή ενέργειας η χρέωση προμήθειας του μήνα είναι μόνο το πάγιο.
{
  ok('ο κατάλογος έχει τιμολόγια με πάγιο σε δύο κλίμακες', tiered.length > 0);
  const fixedOf = (t: (typeof all)[number], ebill: boolean, kwhMonthly: number) =>
    monthlyCost({ ...t, type: 'fixed', priceStatus: 'verified', kwh_day: 0, kwh_night: null, kwh_tier2: 0 },
      { kwhMonthly, nightPct: 0, ebill }).supply;
  for (const t of tiered) {
    for (const ebill of [true, false]) {
      const tier = fixedTier2(t, ebill);
      ok(`${t.id}: η δεύτερη κλίμακα αλλάζει το πάγιο`, !!tier);
      if (!tier) continue;
      eq(`${t.id} (e-bill ${ebill}): ως το όριο χρεώνεται το κάτω πάγιο`, fixedOf(t, ebill, tier.threshold), fixedBase(t, ebill));
      eq(`${t.id} (e-bill ${ebill}): μία κιλοβατώρα πάνω, το πάνω`, fixedOf(t, ebill, tier.threshold + 1), tier.fixed);
      const text = fixedChargeText(t, ebill);
      ok(`${t.id}: η πρόταση αρχίζει από το κάτω πάγιο`, text.startsWith(`${fe(fixedBase(t, ebill))} `));
      ok(`${t.id}: λέει το όριο ανά μήνα, όπως το μετρά ο υπολογισμός`, text.includes(`έως ${fn(tier.threshold)} kWh τον μήνα`));
      ok(`${t.id}: και το πάνω πάγιο`, text.includes(`${fe(tier.fixed)} πάνω από αυτές`));
    }
  }
}

// ── E-BILL, ΜΙΑ ΚΛΙΜΑΚΑ, ΙΔΙΟ ΠΟΣΟ ───────────────────────────────────────────
{
  const synth = { fixed: 10, fixed_ebill: 8, fixed_tier2: 16, fixed_tier2_threshold: 150 };
  ok('το κάτω πάγιο ακολουθεί τον διακόπτη e-bill', fixedChargeText(synth, true).startsWith(`${fe(8)} `) && fixedChargeText(synth, false).startsWith(`${fe(10)} `));
  ok('το πάνω όχι', fixedChargeText(synth, true).includes(`${fe(16)} πάνω`) && fixedChargeText(synth, false).includes(`${fe(16)} πάνω`));
  const one = all.find(t => t.fixed_tier2 == null && t.fixed > 0)!;
  eq('μία κλίμακα: μόνο το ποσό', fixedChargeText(one, false), fe(one.fixed));
  eq('δεύτερη κλίμακα με ίδιο ποσό: σαν μία', fixedChargeText({ ...synth, fixed_tier2: 10 }, false), fe(10));
}

// ── ΟΙ ΔΥΟ ΟΘΟΝΕΣ ΓΡΑΦΟΥΝ ΤΟ ΠΑΓΙΟ ΑΠΟ ΕΔΩ ──────────────────────────────────
{
  // Η δημόσια σύγκριση έγραφε «Πάγιο 7,95€» και σε 300 κιλοβατώρες.
  for (const t of tiered.filter(x => x.type !== 'fixed_monthly' && !x.no_fixed)) {
    for (const ebill of [true, false]) {
      ok(`δημόσια σύγκριση, ${t.id}: λέει και τις δύο κλίμακες`, facts(t, ebill).includes(`Πάγιο ${fixedChargeText(t, ebill)}`));
    }
  }
  // Κανένα αρχείο οθόνης δεν ξαναβγάζει το πάγιο μόνο του: αλλιώς οι δύο
  // προτάσεις αποκλίνουν με την πρώτη αλλαγή. Το BillsElectricity.tsx γράφει
  // το πάγιο σε δύο σημεία, στην κάρτα και στην κατάταξη: μία κλήση μόνο θα
  // άφηνε το άλλο σημείο να γυρίσει στο σκέτο `fixed` χωρίς να το δει κανείς.
  for (const f of ['app/dashboard/components/BillsElectricity.tsx', 'app/sygkrisi-timologion-revmatos/PowerCompare.tsx']) {
    const src = readFileSync(f, 'utf8');
    const calls = (src.match(/\bfixedChargeText\(/g) ?? []).length;
    ok(`${f}: γράφει το πάγιο με το fixedChargeText σε κάθε σημείο`, calls >= (f.endsWith('BillsElectricity.tsx') ? 2 : 1));
    ok(`${f}: κανένα «Πάγιο» δεν γράφει σκέτο το \`fixed\``,
      !/Πάγιο[\s\S]{0,160}?\bfe\(\s*(t|tariff)\.fixed\b/.test(src));
    ok(`${f}: δεν διαλέγει μόνο του ανάμεσα σε fixed και fixed_ebill`,
      !/fixed_ebill\s*!=\s*null\)?\s*\?\s*[\w.]*fixed_ebill\s*:\s*[\w.]*\bfixed\b/.test(src));
  }
}

console.log(fail === 0 ? `✓ πάγιο ρεύματος: ${pass} έλεγχοι πέρασαν` : `✗ πάγιο ρεύματος: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
