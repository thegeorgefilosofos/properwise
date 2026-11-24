// Οι ημερομηνίες και οι μέρες του plan.md, από τον κώδικα και μόνο.
//   npx tsx docs/marketing/kamari/2026-11-23-ena-meros/facts.ts [εεεε-μμ-ηη]
// Τυπώνει τις φορολογικές υποχρεώσεις των επόμενων 45 ημερών ανά προφίλ και την
// προθεσμία της έκπτωσης ανακαίνισης με τις μέρες που μένουν.
import { taxObligationsHorizon } from '../../../../lib/tax/greekTaxCalendar';
import { RENO_39B_TO, RENO_39B_FROM, RENO_39B_CAP, RENO_39B_YEARS } from '../../../../lib/accounting/renovation39b';
import { consolidateIndividual, incomeStatement, type StatementInput } from '../../../../lib/accounting/statement';
import { rentalBracketsForYear } from '../../../../lib/billing/greekTax';
import { bankReceiptMatters, presumptiveDeductionRateForYear } from '../../../../lib/billing/presumptive';
import { shortTermYearSummary, isHouseType, type TaxStay } from '../../../../lib/tax/shortTermTax';
import { collectionViaBankOf } from '../../../../lib/tax/rentCollectionMode';
import { rentIncomeOf } from '../../../../lib/rent/split';
import { portfolio, YEAR } from '../../../../scripts/perf-bench/data';
import { fe, feSigned } from '../../../../lib/core/format';

const today = process.argv[2] ?? '2026-11-23';
const DAY = 86400000;
const days = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / DAY);
const end = new Date(Date.parse(today + 'T00:00:00Z') + 45 * DAY).toISOString().slice(0, 10);
for (const p of ['owner', 'long_term', 'short_term'] as const) {
  console.log(p);
  for (const o of taxObligationsHorizon(today, p).filter((o) => o.date >= today && o.date <= end)) console.log(`  ${o.date} · ${o.title} · ${days(o.date)} ημέρες · ${o.confidence}`);
}
const [d, m, y] = RENO_39B_TO.split('/');
console.log(`ανακαίνιση: ${RENO_39B_FROM} έως ${RENO_39B_TO} · ${days(`${y}-${m}-${d}`)} ημέρες · έως ${RENO_39B_CAP}€ σε ${RENO_39B_YEARS} έτη`);

// ── Η κάρτα «Κατάσταση αποτελεσμάτων» της ταινίας (v16) ──────────────────────
// Ο πάγκος της λήψης (scripts/perf-bench/data.ts, 6 ακίνητα) με τις ίδιες συναρτήσεις που καλεί η
// ενοποίηση της εφαρμογής (app/dashboard/components/accounting/useAccounting.ts:653): μεικτά ανά
// ακίνητο, τεκμαρτή έκπτωση, consolidateIndividual με την κλίμακα του έτους και μετά το
// incomeStatement του p0 με τον φόρο του ως μερίδιο (overrideIncomeTax, useAccounting.ts:722).
// Ιδιοκτησία 100% σε κάθε ακίνητο του πάγκου.
const bench = portfolio(6);
const stays = bench.rows.client_stays as (TaxStay & { property_id: string })[];
const rents = bench.rows.rent_payments as { property_id: string; period_year: number; period_month: number; amount: number; paid: boolean }[];
const owners = bench.rows.user_properties as { id: string; rental_mode: string; sqm: number; prop_type: string }[];
const byMonth = (rows: typeof rents) => { const w = new Array(12).fill(0); for (const r of rows) if (r.period_year === YEAR) w[r.period_month - 1] += r.amount; return w; };
const items = owners.map((p) => {
  const short = p.rental_mode === 'short_term';
  const pRent = rents.filter((r) => r.property_id === p.id);
  const viaBank = bankReceiptMatters(YEAR) ? collectionViaBankOf(pRent, YEAR, true) : true;
  const sum = shortTermYearSummary(stays.filter((x) => x.property_id === p.id), YEAR, { sqm: p.sqm, isHouse: isHouseType(p.prop_type), propertyCount: owners.length, individual: true, rentsPaidViaBank: viaBank });
  const gross = short ? sum.grossRevenue : pRent.filter((r) => r.period_year === YEAR).reduce((t, r) => t + rentIncomeOf(r), 0);
  const input: StatementInput = { regime: short ? 'individual_shortterm' : 'individual_longterm', grossIncome: gross,
    presumptiveRate: presumptiveDeductionRateForYear(YEAR, viaBank, short ? sum.nightsByMonth : byMonth(pRent)) };
  return { id: p.id, input };
}).filter((x) => x.input.grossIncome > 0);
const con = consolidateIndividual(items, rentalBracketsForYear(YEAR));
const share = con.perProperty.find((x) => x.id === 'p0')!.taxShare;
const p0 = incomeStatement({ ...items.find((x) => x.id === 'p0')!.input, overrideIncomeTax: share, brackets: rentalBracketsForYear(YEAR) });
console.log(`ενοποίηση ${YEAR}: μεικτά ${fe(con.grossIncome)} · φορολογητέο ${fe(con.taxableIncome)} · φόρος ${fe(con.incomeTax)}`);
for (const l of p0.lines.slice(0, p0.lines.findIndex((l) => l.key === 'netProfit') + 1)) console.log(`  p0 · ${l.label} · ${feSigned(l.negative && l.amount ? -l.amount : l.amount)}`);
