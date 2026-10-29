// ═══════════════════════════════════════════════════════════════════════════
// «Ε2: ΤΙ ΓΡΑΦΩ ΠΟΥ» — Η ΜΗΧΑΝΗ ΤΟΥ ΛΟΓΙΣΤΗ ΓΙΑ ΤΟΝ ΕΠΙΣΚΕΠΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Ο δημόσιος οδηγός ΔΕΝ ξαναγράφει το έντυπο. Φτιάχνει από τα λίγα πεδία του
// επισκέπτη ένα ακίνητο, μία μίσθωση και τις εισπράξεις της· τα περνά από
// τις ΙΔΙΕΣ συναρτήσεις που γεμίζουν το Ε2 της πύλης του λογιστή
// (lib/billing/e2.ts: `buildE2Row`, `e2OfficialRows`, `buildE1Summary`). Ετσι η
// στήλη 17, οι μήνες, το ακαθάριστο και ο κωδικός του Ε1 είναι ό,τι θα έβγαζε
// και η εφαρμογή για το ίδιο ακίνητο.
//
// ΤΙ ΔΕΝ ΚΑΝΕΙ. Βραχυχρόνια μίσθωση: το ακαθάριστο είναι το άθροισμα των
// διαμονών, που ο επισκέπτης δεν έχει περάσει εδώ. Ο οδηγός το λέει και
// στέλνει στον υπολογιστή της βραχυχρόνιας. Οι δαπάνες δεν έχουν στήλη στο Ε2:
// η τεκμαρτή έκπτωση εφαρμόζεται στην εκκαθάριση και ο οδηγός το εξηγεί.
// ═══════════════════════════════════════════════════════════════════════════
import {
  buildE2Row, e2OfficialRows, buildE1Summary, E2_COLUMNS,
  type E2Property, type E2Tenant, type E2Payment, type E1Summary,
} from '@/lib/billing/e2';

/**
 * Η ημέρα που ο οδηγός ελέγχθηκε πάνω στο έντυπο Ε2 Φ-01.002/Έκδοση 2026 και
 * στον πίνακα 4Δ2 του Ε1 (lib/accounting/e1Codes.ts). Είναι η «Τελευταία
 * ενημέρωση» της σελίδας και του χάρτη (app/pageUpdated.ts).
 */
export const E2_GUIDE_CHECKED = '2026-10-29';

/** Τι γίνεται το ακίνητο μέσα στο έτος. */
export type E2Use = 'lease' | 'own_use' | 'vacant';

export interface E2GuideInput {
  year: number;
  propType: string;
  use: E2Use;
  /** Μόνο για `lease`: κατοικία ή επαγγελματική μίσθωση. */
  leaseCategory?: 'residential' | 'commercial';
  /** Μηνιαίο μίσθωμα (στ. 11). */
  monthly?: number;
  /** «YYYY-MM-DD»· κενό = από πριν από το έτος / ως μετά το έτος. */
  from?: string;
  to?: string;
  /** Ποσοστό συνιδιοκτησίας, 0–100. */
  ownershipPct?: number;
  sqm?: number;
  floor?: string;
}

/** Μία στήλη του εντύπου: αριθμός, τίτλος, τι γράφεις. */
export interface E2GuideCell { no: number; label: string; value: string }

export interface E2Guide {
  cells: E2GuideCell[];
  e1: E1Summary;
  /** Ακαθάριστο του μεριδίου, μετά τα ανείσπρακτα. */
  gross: number;
  months: number;
}

const iso = (s: string | undefined): string | null => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/** Οι μήνες (1–12) του έτους μέσα στο διάστημα της μίσθωσης. */
function monthsInYear(from: string | null, to: string | null, year: number): number[] {
  const a = from && from > `${year}-01-01` ? Number(from.slice(5, 7)) : 1;
  const b = to && to < `${year}-12-31` ? Number(to.slice(5, 7)) : 12;
  if ((from && from > `${year}-12-31`) || (to && to < `${year}-01-01`) || b < a) return [];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

export function e2Guide(i: E2GuideInput): E2Guide {
  const status = i.use === 'lease' ? 'rented' : i.use;
  const property: E2Property = {
    id: 'p', name: null, ama: null, atak: null, address: null, postal_code: null,
    ownership: i.ownershipPct ?? 100, prop_type: i.propType, status_detail: status, rental_mode: i.use === 'lease' ? 'long_term' : null,
    target_rent: null, sqm: i.sqm ?? null, floor: i.floor ?? null, power_supply_no: null,
  };
  const from = iso(i.from), to = iso(i.to);
  const monthly = Math.max(0, i.monthly ?? 0);
  const tenants: E2Tenant[] = i.use === 'lease' ? [{
    id: 't', property_id: 'p', afm: null, monthly_rent: monthly, lease_start: from ?? `${i.year - 1}-01-01`, lease_end: to,
    lease_type: i.leaseCategory === 'commercial' ? 'commercial' : 'residential', full_name: null, status: 'active',
  }] : [];
  const months = i.use === 'lease' ? monthsInYear(from, to, i.year) : [];
  // Κάθε μήνας της μίσθωσης εισπράχθηκε: τα ανείσπρακτα (στ. 16) θέλουν
  // στοιχεία που ο δημόσιος οδηγός δεν ζητά και τα κρίνει ο λογιστής.
  const payments: E2Payment[] = months.map(m => ({
    property_id: 'p', tenant_id: 't', amount: monthly, base_rent: monthly, services_charge: 0,
    period_year: i.year, period_month: m, paid: true,
  }));
  const row = buildE2Row(property, tenants, payments, '', i.year, [], { hasLeaseHistory: i.use === 'lease' });
  const official = e2OfficialRows(property, row, 1)[0] ?? [];
  const cells = E2_COLUMNS.map((c, k) => ({ no: c.no, label: c.label, value: official[k] === undefined || official[k] === null ? '' : String(official[k]) }));
  return { cells, e1: buildE1Summary([row]), gross: row.grossIncome, months: row.months };
}

/** Οι στήλες που ο επισκέπτης συμπληρώνει από τα δικά του έγγραφα, όχι από εδώ. */
export const E2_OWN_PAPERS: Readonly<Record<number, string>> = {
  2: 'Η διεύθυνση του ακινήτου, όπως στο Ε9.',
  6: 'Το ονοματεπώνυμο του μισθωτή, από το μισθωτήριο.',
  7: 'Ο ΑΦΜ του μισθωτή, από το μισθωτήριο.',
  18: 'Οι πρώτοι αριθμοί της παροχής ρεύματος, από τον λογαριασμό.',
  19: 'Ο αριθμός της δήλωσης πληροφοριακών στοιχείων μίσθωσης στο myAADE.',
};
