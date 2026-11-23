// Από πού βγαίνουν τα 17,83€ της «ΕΝΦΙΑ, 9η δόση» στην Επισκόπηση της ταινίας.
//   npx tsx docs/marketing/kamari/2026-11-23-ena-meros/enfia-check.ts
// Ο ίδιος υπολογισμός με το app/dashboard/components/OverviewTab.tsx (γραμμές 426 έως 435):
// ρυθμίσεις ΕΝΦΙΑ του ακινήτου (bills_settings, ενότητα services, πάνω στο ENFIA_DEFAULTS) και
// στοιχεία του ακινήτου, στο `enfiaYear` του lib/facts/enfia.ts. Η ατζέντα παίρνει το ποσό της
// δόσης από τις ίδιες γραμμές (lib/home/forecast12.ts → attachAmounts του lib/home/agenda.ts).
import { enfiaYear, ENFIA_DEFAULTS } from '../../../../lib/facts/enfia';
import { portfolio } from '../../../../scripts/perf-bench/data';

const bench = portfolio(6);
const services = (bench.rows.bills_settings as Array<{ property_id: string; section: string; data: Record<string, unknown> }>)
  .find((r) => r.property_id === 'p0' && r.section === 'services');
const p0 = (bench.rows.user_properties as Array<Record<string, unknown>>).find((p) => p.id === 'p0')!;
// Το OVERVIEW_PROPERTY του scripts/perf-bench/mobile.tsx: enfia 214, έτος κατασκευής 1972, όροφος 3,
// και από τη γραμμή p0 του πάγκου αξία, αντικειμενική και τετραγωνικά.
const prop = { enfia: 214, year_built: 1972, floor: 3, prop_type: 'Διαμέρισμα', ownership: '100', postal_code: '11741',
  value: p0.value, obj_value: p0.obj_value, sqm: p0.sqm };
const s = { ...ENFIA_DEFAULTS, ...(services?.data ?? {}) } as typeof ENFIA_DEFAULTS;
const e = enfiaYear(s, 2026, {
  stored: prop.enfia, value: Number(prop.value), objValue: prop.obj_value == null ? null : Number(prop.obj_value),
  sqm: Number(prop.sqm), yearBuilt: prop.year_built, floor: prop.floor, propType: prop.prop_type,
  ownershipPct: Number(prop.ownership), postalCode: prop.postal_code,
} as never);
const nine = e.instalments.find((i) => i.no === 9);
console.log(`πηγή: ${e.inUse.source} · έτος: ${e.annual}€ · δόσεις: ${e.instalments.length} · 9η: ${nine?.amount}€ στις ${nine?.date}`);
if (!nine || Math.abs(nine.amount - 17.83) > 0.005) { console.log('ΔΕΝ επιβεβαιώνεται το 17,83€'); process.exit(1); }
console.log('✓ 17,83€ από το enfiaYear');
