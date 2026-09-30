// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΤΟΥ ΕΝΟΙΚΙΟΥ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Carousel και reel λένε την ίδια ιστορία με τα ίδια ποσά. Γραμμένα δύο
// φορές, το πρώτο που θα άλλαζε θα έλεγε άλλα από το δεύτερο, στον ίδιο
// λογαριασμό, την ίδια εβδομάδα.
//
// ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Όλα από το ακίνητο επίδειξης, μέσα από την
// incomeStatement και την κλίμακα της χρονιάς του.
// ═══════════════════════════════════════════════════════════════════════════
import { rentalBracketsForYear } from '../../lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE, incomeStatement } from '../../lib/accounting/statement';
import { DEMO_PROPERTY, demoLedger, demoSummary } from '../../lib/demo/sample';
import { fe } from '../../lib/core/format';
import { athensToday } from '../../lib/core/time';
import { C } from './igKit';

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
export const S = demoSummary(athensToday());
const L = (key: string) => {
  const l = S.statement.lines.find(x => x.key === key);
  if (!l) throw new Error(`Η κατάσταση αποτελεσμάτων δεν έχει γραμμή «${key}».`);
  return l.amount;
};
export const GROSS = L('gross'), PRESUMPTIVE = L('presumptive'), TAXABLE = L('taxable');
export const TAX = L('incomeTax'), ENFIA = L('enfia'), OTHER = L('otherCash'), NET = L('netCash');
export const BR = rentalBracketsForYear(S.year);
// «Φόρος 15%» στέκει μόνο αν όλο το φορολογητέο πέφτει στο πρώτο κλιμάκιο.
if (TAXABLE > BR[0].to) throw new Error('Το φορολογητέο περνά το πρώτο κλιμάκιο· η κάρτα του φόρου θέλει άλλη διατύπωση.');
export const pct = (r: number) => `${Math.round(r * 100)}%`;
export const RATE = pct(BR[0].rate), PRES = pct(PRESUMPTIVE_DEDUCTION_RATE), TAXED_SHARE = pct(1 - PRESUMPTIVE_DEDUCTION_RATE);
// Ο μακρύς δρόμος προς το ίδιο ποσό: αν δεν συμφωνούν, κάτι άλλαξε στη μηχανή.
if (Math.abs(GROSS - TAX - ENFIA - OTHER - NET) > 0.01) throw new Error('Τα κομμάτια της μπάρας δεν αθροίζουν στο ενοίκιο.');

const [propKind, propArea] = DEMO_PROPERTY.name.split(/,\s*/);
export const PROP_SPOKEN = propArea ? `${propKind.toLocaleLowerCase('el')} στο ${propArea}` : DEMO_PROPERTY.name;
export const PROP_CAP = PROP_SPOKEN.charAt(0).toLocaleUpperCase('el') + PROP_SPOKEN.slice(1);
// Κεφαλαία χωρίς τόνους, όπως γράφονται στα ελληνικά.
export const UP = (t: string) => t.toLocaleUpperCase('el').normalize('NFD').replace(/\u0301/g, '').normalize('NFC');
// Ό,τι φεύγει μέσα στη χρονιά: φόρος, ΕΝΦΙΑ και έξοδα μαζί.
export const LOST = Math.round((GROSS - NET) * 100) / 100;

// Στρογγυλά ποσά χωρίς «,00»: στη μεγάλη γραφή τα μηδενικά δεκαδικά διαβάζονται
// ως λογιστικό φύλλο. Τα υπόλοιπα όπως τα γράφει η εφαρμογή.
export const eur = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? fe(Math.round(n)).replace(/,00(?=€)/, '') : fe(n));

// Τα έξοδα πλην ΕΝΦΙΑ: οι δύο μεγαλύτερες κατηγορίες και οι υπόλοιπες μαζί.
export const EXP = demoLedger(S.year).filter(r => r.category !== 'enfia');
export const TOP = EXP.slice(0, 2);
export const REST = EXP.slice(2);
export const REST_SUM = Math.round(REST.reduce((s, r) => s + r.amount, 0) * 100) / 100;

// Από κάθε 100€: μερίδια με μέγιστο υπόλοιπο, ώστε να αθροίζουν ακριβώς 100.
export function shares(parts: number[], total = GROSS): number[] {
  const raw = parts.map(p => (p / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) out[i]++; });
  return out;
}
export const [P_TAX, P_ENFIA, P_OTHER, P_NET] = shares([TAX, ENFIA, OTHER, NET]);

export const SEG = { tax: '#ef8f7f', enfia: '#f0c27a', other: '#b9a6f5', net: C.accent };

export const PARTS = [
  { k: 'tax', label: 'Φόρος εισοδήματος', v: TAX, c: SEG.tax, p: P_TAX },
  { k: 'enfia', label: 'ΕΝΦΙΑ', v: ENFIA, c: SEG.enfia, p: P_ENFIA },
  { k: 'other', label: 'Επισκευές και άλλα έξοδα', v: OTHER, c: SEG.other, p: P_OTHER },
  { k: 'net', label: 'Καθαρά στην τσέπη', v: NET, c: SEG.net, p: P_NET },
];

// ── Μια ολόκληρη χρονιά μπροστά ──────────────────────────────────────────
// Η ερώτηση «πόσα θα μου μείνουν αν το νοικιάσω» ζητά πρόβλεψη: δώδεκα
// ενοίκια, όχι όσα εισπράχθηκαν μέσα στην κλεισμένη χρονιά (εκεί ο Δεκέμβριος
// πέφτει στην επόμενη). Ίδια έξοδα και ίδια κλίμακα με το παράδειγμα, ίδια
// incomeStatement με την εφαρμογή.
export function yearAhead() {
  const monthly = DEMO_PROPERTY.monthlyRent;
  const st = incomeStatement({
    regime: 'individual_longterm',
    grossIncome: 12 * monthly,
    enfia: S.enfia,
    otherCashExpenses: S.otherCash,
    brackets: BR,
  });
  const get = (key: string) => {
    const l = st.lines.find(x => x.key === key);
    if (!l) throw new Error(`Η πρόβλεψη δεν έχει γραμμή «${key}».`);
    return l.amount;
  };
  const gross = get('gross'), taxable = get('taxable'), tax = get('incomeTax'), enfia = get('enfia'), other = get('otherCash'), net = get('netCash');
  if (taxable > BR[0].to) throw new Error('Η πρόβλεψη περνά το πρώτο κλιμάκιο· το «φόρος 15%» δεν στέκει.');
  if (Math.abs(gross - tax - enfia - other - net) > 0.01) throw new Error('Η πρόβλεψη δεν αθροίζει στο ενοίκιο.');
  const [pTax, pEnfia, pOther, pNet] = shares([tax, enfia, other, net], gross);
  return { monthly, gross, taxable, tax, enfia, other, net, lost: Math.round((gross - net) * 100) / 100, pTax, pEnfia, pOther, pNet };
}
