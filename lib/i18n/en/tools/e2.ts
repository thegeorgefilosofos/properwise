// ═══════════════════════════════════════════════════════════════════════════
// «Ε2: ΤΙ ΓΡΑΦΩ ΠΟΥ» ΣΤΑ ΑΓΓΛΙΚΑ (app/symplirosi-e2, /en/form-e2-guide)
// ─────────────────────────────────────────────────────────────────────────
// Η ίδια μηχανή (lib/tools/e2Odigos.ts → lib/billing/e2.ts). Το έντυπο είναι
// ελληνικό και συμπληρώνεται στα ελληνικά: οι τιμές που γράφει ο επισκέπτης
// στο Ε2 (κατηγορία, στήλη 17, «ΚΕΝΟ») μένουν ΟΠΩΣ ΤΙΣ ΔΕΧΕΤΑΙ η ΑΑΔΕ και
// παίρνουν δίπλα τους αγγλική εξήγηση. Οι τίτλοι των στηλών μεταφράζονται
// ανά αριθμό στήλης· κανένα ελληνικό δεδομένο δεν αλλάζει.
// ═══════════════════════════════════════════════════════════════════════════
import { E2_USE, e2CategoryLabel } from '@/lib/billing/e2';

/** Οι στήλες του Ε2 ανά αριθμό, στα αγγλικά (lib/billing/e2.ts, `E2_COLUMNS`). */
const COLUMN_EN: Readonly<Record<number, string>> = {
  1: 'Row number',
  2: 'Location: street, number, town or village, postcode',
  3: 'Floor (ground, 1st floor, etc.)',
  4: 'Category (home, shop, office, parking, land, etc.)',
  5: 'Floor area in m²',
  6: 'Tenant’s name',
  7: 'Tenant’s tax number (AFM)',
  8: 'From',
  9: 'To',
  10: 'Months',
  11: 'Actual or deemed monthly rent',
  12: 'Co-ownership share (%)',
  13: 'Letting or subletting of property',
  14: 'Property given for free use',
  15: 'Own use of property',
  16: 'Uncollected rental income',
  17: 'Lease type / use of the property',
  18: 'Electricity supply number (first digits)',
  19: 'Lease declaration number',
};

/**
 * Οι ελληνικές τιμές που γράφονται στο έντυπο, με την αγγλική τους εξήγηση.
 * Τα κλειδιά ΔΙΑΒΑΖΟΝΤΑΙ από το lib/billing/e2.ts, δεν ξαναγράφονται εδώ: αν
 * αλλάξει η διατύπωση εκεί, η εξήγηση την ακολουθεί.
 */
const VALUE_EN: Readonly<Record<string, string>> = {
  [e2CategoryLabel('apartment')]: 'apartment', [e2CategoryLabel('house')]: 'detached house',
  [e2CategoryLabel('maisonette')]: 'maisonette', [e2CategoryLabel('office')]: 'office', [e2CategoryLabel('shop')]: 'shop',
  [e2CategoryLabel('warehouse')]: 'storage', [e2CategoryLabel('land')]: 'plot of land', [e2CategoryLabel('parking')]: 'parking space',
  [E2_USE.homeLease]: 'long-term residential lease', [E2_USE.businessLease]: 'commercial lease',
  [E2_USE.landLease]: 'land lease', [E2_USE.anyLease]: 'property lease', [E2_USE.shortTerm]: 'short-term rental',
  [E2_USE.free]: 'free use', [E2_USE.ownUse]: 'own use', [E2_USE.vacant]: 'vacant',
};

/** Ο κωδικός του Ε1 ανά αριθμό (lib/accounting/e1Codes.ts), στα αγγλικά. */
const E1_CODE_EN: Readonly<Record<string, string>> = {
  '101': 'gross income from letting land, installations or structures',
  '103': 'gross income from letting homes',
  '105': 'gross income from letting shops, offices, storage, parking and similar',
  '107': 'gross income from letting advertising space',
  '109': 'gross income from letting industrial buildings and VAT-registered shopping centers',
};

/** Η τιμή του κελιού όπως γράφεται στο έντυπο και, αν είναι ελληνική λέξη, τι σημαίνει. */
const cellEn = (v: string): string => (VALUE_EN[v] ? `${v} (${VALUE_EN[v]})` : v);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const PROP_TYPE_EN: Readonly<Record<string, string>> = {
  apartment: 'Apartment', house: 'Detached house', maisonette: 'Maisonette', shop: 'Shop', office: 'Office',
  warehouse: 'Storage', parking: 'Parking space', land: 'Plot or farmland',
};

export const E2_EN = {
  column: (no: number, el: string) => COLUMN_EN[no] ?? el,
  cell: cellEn,
  months: MONTHS,
  propType: (value: string, el: string) => PROP_TYPE_EN[value] ?? el,
  property: 'The property', incomeYear: 'Income year', type: 'Type', area: 'Floor area', sqm: 'm²',
  share: 'Co-ownership share', shareHint: 'Your share, as on form E9 (your property register). The whole property: 100.',
  during: 'What happened during the year', use: 'Use', leased: 'Leased', ownUse: 'I use it', vacant: 'Vacant',
  lease: 'Lease', residential: 'Residential', commercial: 'Commercial',
  rent: 'Monthly rent', rentHint: 'The full rent for the property, not just your share.',
  from: 'From', to: 'To',
  paper: 'Form E2: what goes where', year: 'Year', rentShort: 'Rent', period: 'Period',
  periodOf: (a: string, b: string) => `${a} to ${b}`,
  gross: 'Gross income on E2', monthsLabel: 'Months', code: 'E1 code', none: 'none',
  say: (gross: string, months: string, code?: string) => `Gross ${gross}, ${months} months${code ? `, E1 code ${code}` : ''}.`,
  caption: 'The columns of form E2, in the order of the form',
  colHead: 'Column', valueHead: 'What you enter', empty: 'blank',
  ownPapers: {
    2: 'The property’s address, as on form E9.',
    6: 'The tenant’s name, from the lease.',
    7: 'The tenant’s tax number, from the lease.',
    18: 'The first digits of the electricity supply number, from the bill.',
    19: 'The number of the lease declaration filed on myAADE, AADE’s online portal.',
  } as Readonly<Record<number, string>>,
  codeNote: (code: string, spouse: string) => `The amount in column 13 carries over to form E1, table 4D2, code ${code} (${spouse} for a spouse): ${E1_CODE_EN[code] ?? 'gross rental income'}.`,
  ownUseNote: 'Own use of a home has no gross income and no code in table 4D2: it is declared only in column 17.',
  vacantNote: `A vacant property is declared as “${E2_USE.vacant}” (vacant) in column 17, with no amount and no code on form E1.`,
  expenses: ' Expenses have no column on E2: the standard deduction is applied automatically when the tax is assessed.',
  e1Note: 'Source: form E1, table 4D2. The first code is the taxpayer’s, the second the spouse’s. Your accountant checks the amounts before filing.',
};

export const E2_PAGE_EN = {
  title: 'How to fill in Greek form E2, column by column, and which E1 code it feeds',
  h1: 'Form E2: what goes where',
  description: 'Enter the property type, use, rent and months: see what goes in each column of form E2 and which E1 code the amount feeds.',
  lede: 'Form E2 is the annex to the Greek income tax return (form E1) where you list each property and its rent. This shows what goes in every column for one property, and which E1 code the amount feeds, with the same engine that fills in E2 for accountants.',
  ctaTitle: 'Want the whole E2 ready for your accountant?',
  ctaBody: 'PROPERWISE fills in E2 for all your properties from your leases and rent received, with every tenant and period, and hands it to your accountant ready.',
};

export function e2FaqEn(x: { rent: string; months: string; gross: string; home: { code?: string; spouse?: string }; shop: { code?: string; spouse?: string };
  vacant: string; ownUse: string; shortTerm: string }) {
  return [
    {
      q: 'What goes in column 13?',
      a: `The gross income for your own share: monthly rent times months times your share. An apartment let at ${x.rent} from March, half yours: ${x.months} months, and ${x.gross} in column 13.`,
    },
    {
      q: 'Which E1 code does the rent go to?',
      a: `It depends on the type: a home goes to code ${x.home.code} (${x.home.spouse} for a spouse), a shop or office to ${x.shop.code} (${x.shop.spouse}). The first code is the taxpayer’s, the second the spouse’s; your accountant checks the amounts before filing.`,
    },
    {
      q: 'What do I enter for a vacant property or one I use myself?',
      a: `In column 17, “${x.vacant}” (vacant) for an empty property or “${x.ownUse}” (own use) for the time you use it yourself, with no rent and no code on E1.`,
    },
    {
      q: 'What about short-term rentals?',
      a: `Column 17 says “${x.shortTerm}” (short-term rental), and the gross income is the total of the stays, not a monthly rent. This guide doesn’t ask for them; the short-term vs long-term calculator shows what they leave you with.`,
    },
    {
      q: 'Where do I enter the property’s expenses?',
      a: 'Nowhere on E2. The standard deduction for expenses is applied automatically when the tax is assessed. Renovation costs that reduce your tax are declared separately, under their own E1 codes.',
    },
  ];
}
