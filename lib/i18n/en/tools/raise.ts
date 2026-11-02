// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΝΑΠΡΟΣΑΡΜΟΓΗ ΕΝΟΙΚΙΟΥ ΣΤΑ ΑΓΓΛΙΚΑ (app/anaprosarmogi-enoikiou, /en/rent-increase-calculator)
// ─────────────────────────────────────────────────────────────────────────
// Ο ίδιος υπολογισμός (lib/tools/anaprosarmogi.ts) και ο ίδιος πίνακας του ΔΤΚ
// (lib/market/cpi.ts)· εδώ μόνο λέξεις. Κάθε ποσοστό, όριο και ημερομηνία
// έρχεται ως όρισμα από τον κώδικα που το ορίζει, γραμμένο με fmtFor('en')
// από τον υπολογιστή ή τη σελίδα.
// ═══════════════════════════════════════════════════════════════════════════

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** «2026-07» → «July 2026». */
export const monthEn = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${y}` : ym;
};

/** Το δωδεκάμηνο του δείκτη ενός μήνα: «from July 2025 to June 2026» (ίδιος κανόνας με το indexPeriodLabel). */
export const periodEn = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  const endM = m === 1 ? 12 : m - 1, endY = m === 1 ? y - 1 : y;
  return `from ${MONTHS[m - 1]} ${y - 1} to ${MONTHS[endM - 1]} ${endY}`;
};

/** Η ΕΛΣΤΑΤ και ο ΔΤΚ εξηγούνται μία φορά, στην εισαγωγή της σελίδας. */
const CPI_EN = 'CPI';

export const RAISE_EN = {
  month: monthEn,
  lease: 'The lease',
  rent: 'Current rent', rentHint: 'The monthly rent before the increase.',
  type: 'Lease type', residential: 'Residential', commercial: 'Commercial',
  typeHintCommercial: (cap: string, year: number) => `The ${cap} cap for ${year} applies only to existing commercial leases.`,
  typeHintResidential: 'Residential leases have no state cap on increases: the clause in the lease applies.',
  signedBefore: (date: string) => `Signed before ${date}?`, yes: 'Yes', no: 'No',
  signedHint: (year: number) => `In a lease signed during ${year}, the rent is set freely.`,
  clause: 'The increase clause',
  basis: 'What the lease says', fixed: 'Fixed rate', cpi: `ELSTAT ${CPI_EN}`,
  share: `Which part of the ${CPI_EN}`, whole: 'The full change', share75: '75% of the change',
  shareHint: 'ELSTAT publishes both every month. Whatever the lease says applies.',
  rate: 'Rate per year', rateHint: 'As written in the lease clause.',
  monthField: 'Month of the increase', monthHint: 'The month the new rent starts. In later years, the same month.',
  years: 'Years', yearsUnit: 'yrs',
  cpiAssumed: `${CPI_EN} where not yet announced`,
  cpiHintKnown: (m: string, pct: string) => `For ${m}, ELSTAT announced ${pct}, and that applies. `,
  cpiHintUnknown: (m: string) => `For ${m}, ELSTAT has not announced an index yet. `,
  cpiHintRest: (m: string, pct: string) => `For any year not yet announced, the calculation uses this rate as an assumption. Latest published: ${m}, ${pct}.`,
  clampYears: (max: number) => `Up to ${max} years; calculated with ${max}.`,
  paper: 'Rent increase',
  paperLease: 'Lease', paperCommercialNew: (year: number) => `Commercial, new in ${year}`,
  paperClause: 'Clause', paperShare75: ', 75%', paperNoRate: 'not given', paperPerYear: (pct: string) => `${pct} a year`,
  paperFrom: 'From',
  emptyRent: 'Enter the current monthly rent to see the new one.',
  emptyRate: 'Enter the increase rate to see the new rent.',
  newRent: 'New rent', increase: 'Increase per month',
  inYears: (n: string) => `In ${n} years`, pct: 'Rate',
  say: (to: string, inc: string) => `New rent ${to}, an increase of ${inc} a month.`,
  capped: (uncapped: string, from: string, to: string, cap: string, capped: string) =>
    `The clause gives ${uncapped}. From ${from} to ${to}, an increase on an existing commercial lease cannot exceed ${cap} (Article 59, Law 5255/2025), so the rent stops at ${capped}. `,
  cappedLink: 'Who the cap covers',
  rowCurrent: 'Current rent',
  rowCpi: (m: string) => `${CPI_EN} ${m} (ELSTAT)`,
  rowCpiAssumed: `${CPI_EN} (assumed, not yet announced)`,
  row75: '75% of the change, to one decimal',
  rowClause: 'Lease clause',
  rowCap: (year: number) => `${year} cap, commercial lease`,
  rowIncrease: 'Increase per month',
  rowNew: (date: string) => `New rent from ${date}`,
  annual: 'Annual rent', extra: 'Extra per year',
  duty: (pct: string) => `Digital duty ${pct} per month`,
  taxLead: (to: string, year: string) => `At ${to} a month, the rent reaches ${year} a year. `,
  taxLink: 'What tax you will pay on the new rent',
  flagCap: (year: number) => `${year} cap`, flagAssumed: 'assumed', flagElstat: 'ELSTAT',
  table: 'Rent by year', from: 'From', rateCol: 'Rate', monthly: 'Monthly', yearly: 'Annual',
  firstYears: (n: number) => `Only the first ${n} years`, allYears: (n: number) => `All ${n} years`,
  assumedNote: (pct: string, share75: boolean) =>
    `“Assumed”: ELSTAT has not announced the index for this month yet. The row uses ${pct}${share75 ? ', at 75%' : ''}. The actual amount will follow the index once it is announced.`,
  scopeLead: 'What it covers and what it doesn’t.',
  scope: (year: number) => `One increase a year, in the same month, on the rent left by the previous one and rounded to the cent. It doesn’t know whether the landlord is among those exempt from the ${year} cap, and it doesn’t check the wording of the clause. It is `,
  scopeStrong: 'for information only',
  scopeEnd: ', not legal advice.',
};

export const RAISE_PAGE_EN = {
  title: 'Greek rent increase calculator: fixed rate or ELSTAT CPI',
  h1: 'Rent increase in Greece: a fixed rate or the CPI',
  description: (cap: string, year: number) =>
    `The new rent under your lease clause or ELSTAT’s consumer price index, year by year, and the ${cap} cap on commercial leases in ${year}.`,
  lede: (cap: string) => `The new rent under the lease clause, year by year, with the ${cap} cap where it applies. ELSTAT is Greece’s statistics authority; its consumer price index (${CPI_EN}) is what most Greek leases tie increases to.`,
  indexLabel: 'The ELSTAT index',
  indexBadge: `ELSTAT ${CPI_EN}`,
  indexFor: (m: string) => `For an increase in ${m}: `,
  indexChange: (period: string) => `, the change ${period}. `,
  indexChecked: (d: string) => `, checked ${d}.`,
  ctaTitle: 'Want the increase worked out every year?',
  ctaBody: 'PROPERWISE keeps the rent of every lease, reminds you when the increase is due and drafts the notice to the tenant with the right amount.',
};

export function raiseFaqEn(x: {
  year: number; cap: string; capFrom: string; capTo: string;
  com: { rent: string; pct: string; to: string; uncapped: string; next: string };
  latest: { month: string; pct: string; period: string; pct75: string };
  res: { rent: string; pct: string; years: number; rows: string; simple: string };
}) {
  return [
    {
      q: 'How much can a residential rent go up in Greece?',
      a: `For ${x.year} there is no general state cap on residential rents. The rent rises only under an explicit increase clause in the lease or a new agreement the tenant accepts. The calculator applies the clause as written: a fixed rate or the consumer price index published by ELSTAT.`,
    },
    {
      q: `What applies to commercial leases in ${x.year}?`,
      a: `For existing commercial leases under Presidential Decree 34/1995, an increase between ${x.capFrom} and ${x.capTo} cannot exceed ${x.cap} of the ${x.year - 1} rent. With a rent of ${x.com.rent} and a ${x.com.pct} clause, the new rent is ${x.com.to}, not ${x.com.uncapped}. The following year the clause applies to the rent that remained: ${x.com.next}. The cap does not apply to a new lease signed in ${x.year} or to landlords the law exempts.`,
    },
    {
      q: `Which ${CPI_EN} figure do I use?`,
      a: `The 12-month change in the consumer price index that ELSTAT announces every month for rent adjustments. For an increase in ${x.latest.month} it is ${x.latest.pct}, the change ${x.latest.period}. The same release gives 75% of it (${x.latest.pct75}) for leases that specify that. Eurostat’s Harmonized Index (HICP) is a different index.`,
    },
    {
      q: 'Why is the increase after a few years more than rate times years?',
      a: `Because each increase applies to the rent left by the previous one. With ${x.res.rent} and ${x.res.pct} a year, over ${x.res.years} years the rent becomes ${x.res.rows}. Simple addition would give ${x.res.simple}.`,
    },
    {
      q: 'When does the increase take effect?',
      a: 'As the lease says. The calculator assumes one increase a year in the same month and takes ELSTAT’s index for that month. If the clause is unclear, check with a lawyer or accountant before you send the tenant a notice.',
    },
  ];
}

