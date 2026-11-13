// ═══════════════════════════════════════════════════════════════════════════
// Ο ΠΡΩΤΟΣ ΦΟΡΟΣ: ΤΟ ΠΟΣΟ ΠΟΥ ΒΛΕΠΕΙ Ο ΝΕΟΣ ΧΡΗΣΤΗΣ ΜΟΛΙΣ ΑΠΟΘΗΚΕΥΣΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΜΕΤΡΗΘΗΚΕ (13/11/2026). Ο νέος λογαριασμός περνούσε τέσσερις κάρτες
// υποδοχής και τον οδηγό, αποθήκευε και έβλεπε «Καθαρό 0,00€». Ο φόρος του
// ακινήτου υπήρχε, αλλά ως πλακίδιο 2.170 εικονοστοιχεία πιο κάτω σε
// υπολογιστή και 3.218 σε κινητό: τρεις με τέσσερις οθόνες κύλισης, χωρίς
// τίποτα να λέει ότι είναι εκεί.
//
// ΕΝΑΣ ΥΠΟΛΟΓΙΣΜΟΣ, Ο ΙΔΙΟΣ ΜΕ ΤΗΝ ΕΠΙΣΚΟΠΗΣΗ. Δεν υπάρχει εδώ κλίμακα ούτε
// συντελεστής: το ποσό βγαίνει από την `propertyRentTax` (lib/facts/rentTax.ts),
// την ίδια που γράφει το πλακίδιο «Φόρος ενοικίου». Αν γράφονταν δύο, η κάρτα
// του πρώτου ακινήτου θα έλεγε άλλο ποσό από την οθόνη που ανοίγει από κάτω.
//
// Για το ΠΡΩΤΟ ακίνητο τα έσοδα είναι μόνο ο στόχος ή το μίσθωμα του οδηγού:
// δεν υπάρχουν ακόμη εισπράξεις, διαμονές ή ενοικιαστής. Ο ίδιος δρόμος δίνει
// και την προεπισκόπηση μέσα στον οδηγό, πριν από την αποθήκευση.
// ═══════════════════════════════════════════════════════════════════════════
import { propertyRentTax } from '@/lib/facts/rentTax';
import { readStatus, type PropertyStatus, type StatusRow } from '@/lib/property/status';
import { upcomingTaxObligations, taxProfileOfStatus } from '@/lib/facts/deadlines';
import type { TaxObligation } from '@/lib/tax/greekTaxCalendar';
import { grDate } from '@/lib/core/format';

/** Οι στήλες του ακινήτου που χρειάζεται ο πρώτος φόρος. */
export interface FirstTaxProperty extends StatusRow {
  id: string;
  target_rent?: number | string | null;
  ownership?: number | string | null;
  enfia?: number | string | null;
}

export interface FirstTax {
  status: PropertyStatus;
  /** Νοικιάζεται, άρα έχει φόρο ενοικίων. */
  rented: boolean;
  /** Ο μηνιαίος στόχος ή το μίσθωμα που γράφτηκε· 0 χωρίς ποσό. */
  monthly: number;
  /** Τα ετήσια έσοδα για τον φόρο, όλου του ακινήτου. */
  annual: number;
  /** Ο φόρος ενοικίων της χρονιάς, όλου του ακινήτου, όπως στην Επισκόπηση. */
  tax: number;
  /** Ο ΕΝΦΙΑ που δήλωσε ο χρήστης, ανά έτος· `null` χωρίς τιμή. */
  enfia: number | null;
  year: number;
}

const positive = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Νοικιάζεται; Μόνο οι δύο μισθώσεις έχουν φόρο ενοικίων. */
export const isRented = (s: PropertyStatus): boolean => s === 'rent_long' || s === 'rent_short';

/**
 * Ο φόρος ενοικίων ενός ακινήτου χωρίς ακόμη εισπράξεις: ο ίδιος υπολογισμός με
 * την Επισκόπηση, για έναν ιδιώτη με αυτό το ένα ακίνητο.
 */
export function firstTaxOf(p: FirstTaxProperty, today: string): FirstTax {
  const status = readStatus(p);
  const year = Number(today.slice(0, 4));
  const monthly = positive(p.target_rent);
  const income = new Map([[p.id, { rents: [], stays: [], targetMonthly: monthly || null, viaBank: true }]]);
  const r = propertyRentTax({ props: [p], propertyId: p.id, ownerClientIds: null, income, year, today });
  const enfia = positive(p.enfia);
  return {
    status, rented: isRented(status), monthly,
    annual: r.income.annual, tax: r.tax,
    enfia: enfia > 0 ? enfia : null, year,
  };
}

/**
 * Η επόμενη προθεσμία ΤΟΥ ΙΔΙΟΥ ΦΟΡΟΥ με το ποσό: ο φόρος ενοικίων πληρώνεται
 * με τον φόρο εισοδήματος, οπότε δίπλα του στέκει η επόμενη δόση ή η δήλωσή
 * του, ποτέ ο ΕΝΦΙΑ (κριτική σχεδίασης, 13/11/2026: η ημερομηνία του ΕΝΦΙΑ
 * κάτω από τον φόρο ενοικίων διαβαζόταν σαν να ανήκε σε εκείνον).
 */
export function incomeTaxDeadline(status: PropertyStatus, today: string): TaxObligation | null {
  const income = new Set(['income-instalment', 'income-decl', 'income-autofile']);
  return upcomingTaxObligations(today, taxProfileOfStatus(status)).find(o => income.has(o.kind)) ?? null;
}

/** Η μία γραμμή κάτω από το ποσό: τίτλος και ημερομηνία σε μορφή ηη/μμ/εεεε. */
export interface TaxDeadlineRow { id: string; title: string; date: string }

/**
 * Η ΓΡΑΜΜΗ ΚΑΤΩ ΑΠΟ ΤΟΝ ΦΟΡΟ ΕΝΟΙΚΙΩΝ, ΓΡΑΜΜΕΝΗ ΜΙΑ ΦΟΡΑ (κριτική σχεδίασης
 * r2, 13/11/2026). Η υποδοχή έδειχνε τη δόση του φόρου εισοδήματος και ο
 * οδηγός, με άλλη συνάρτηση, δύο γραμμές με πρώτη τον ΕΝΦΙΑ. Τώρα και οι δύο
 * διαβάζουν αυτή: μία γραμμή, ίδιος φόρος, ίδια μορφή ημερομηνίας. Ο ΕΝΦΙΑ
 * ζει στο Ημερολόγιο, όπου δείχνει το πρώτο βήμα της περιήγησης.
 */
export function taxDeadlineRow(status: PropertyStatus, today: string): TaxDeadlineRow | null {
  const o = incomeTaxDeadline(status, today);
  return o ? { id: o.id, title: o.title, date: grDate(o.date) } : null;
}
