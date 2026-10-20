// ═══════════════════════════════════════════════════════════════════════════
// Ο ΦΟΡΟΣ ΕΝΟΙΚΙΩΝ ΕΝΟΣ ΑΚΙΝΗΤΟΥ: ΜΙΑ ΚΛΗΣΗ ΓΙΑ ΚΑΘΕ ΟΘΟΝΗ
// ─────────────────────────────────────────────────────────────────────────
// Η Επισκόπηση, η Σύγκριση και το Ενοικιαστής → Φόρος έστηναν μόνες τους την
// ενοποίηση με τρεις βάσεις και έβγαζαν τρεις φόρους για το ίδιο ακίνητο
// (έλεγχος 19/10/2026, #6). Τώρα καλούν αυτή τη συνάρτηση: η βάση είναι η
// `annualIncomeForTax` (lib/facts/taxIncome.ts) για το τρέχον ακίνητο ΚΑΙ για
// τα άλλα του ίδιου φορολογούμενου, η κλίμακα και η έκπτωση του
// lib/billing/consolidate.ts, το ποσοστό ιδιοκτησίας της `taxpayerRentSources`.
//
// Ο ΑΡΙΘΜΟΣ ΕΙΝΑΙ ΟΛΟΥ ΤΟΥ ΑΚΙΝΗΤΟΥ (`wholePropertyTax`), όπως τον έδειχναν ήδη
// η Επισκόπηση και η Σύγκριση: οι οθόνες δείχνουν ενοίκιο και απόδοση όλου του
// ακινήτου. Με 100% ιδιοκτησία είναι ο φόρος του ιδιοκτήτη.
// ═══════════════════════════════════════════════════════════════════════════
import { taxpayerRentSources, ownershipPctOf, wholePropertyTax, type TaxpayerPropInput, type OtherPropertyIncome } from '@/lib/accounting/taxpayerIncome';
import { consolidateRentTax, taxShareOf, type ConsolidatedRentTax } from '@/lib/billing/consolidate';
import { readStatus } from '@/lib/property/status';
import { taxIncomeOf, type TaxIncome } from './taxIncome';

export interface PropertyRentTaxInput {
  /** Όλα τα ακίνητα του λογαριασμού: η ενοποίηση κρατά όσα έχουν τον ίδιο φορολογούμενο. */
  props: readonly TaxpayerPropInput[];
  propertyId: string;
  /** Οι καρτέλες «Ιδιοκτήτης» (`taxpayerScope`)· `null` για ιδιώτη. */
  ownerClientIds: ReadonlySet<string> | null;
  /** Τα έσοδα κάθε ακινήτου, ΜΑΖΙ με του τρέχοντος. */
  income: ReadonlyMap<string, OtherPropertyIncome>;
  year: number;
  today: string;
}

export interface PropertyRentTax {
  /** Η βάση του τρέχοντος ακινήτου, όλου. */
  income: TaxIncome;
  /** Ο φόρος του ακινήτου, όλου, από τον ΕΝΑ φόρο του φορολογούμενου. */
  tax: number;
  /** Η ενοποίηση, για τις σημειώσεις της οθόνης (`consolidationSummary`). */
  consolidated: ConsolidatedRentTax;
}

export function propertyRentTax(i: PropertyRentTaxInput): PropertyRentTax {
  const p = i.props.find(x => x.id === i.propertyId);
  const row = i.income.get(i.propertyId);
  const status = readStatus(p);
  const income = taxIncomeOf(status, row, i.year, i.today);
  const consolidated = consolidateRentTax(taxpayerRentSources({
    props: p ? i.props : [{ id: i.propertyId }, ...i.props],
    current: {
      id: i.propertyId, annualRent: income.annual,
      shortTerm: status === 'rent_short' || income.basis === 'stays',
      rentsPaidViaBank: row?.viaBank ?? true,
    },
    ownerClientIds: i.ownerClientIds, income: i.income, year: i.year, today: i.today,
  }), undefined, i.year);
  return { income, tax: wholePropertyTax(taxShareOf(consolidated, i.propertyId), ownershipPctOf(p)), consolidated };
}
