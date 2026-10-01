'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΤΥΠΟΙ ΤΟΥ ΠΙΝΑΚΑ: ΑΚΙΝΗΤΟ, ΔΑΠΑΝΗ, ΛΟΓΑΡΙΑΣΜΟΣ, ΜΙΣΘΩΤΗΣ ΚΑΙ Η ΡΑΜΠΑ
// ΤΗΣ ΚΑΤΑΣΤΑΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Ό,τι διαβάζουν μαζί το κέλυφος του πίνακα (page.tsx) και η Επισκόπηση.
// ═══════════════════════════════════════════════════════════════════════════
import type { PropertyStatus } from '@/lib/property/status'

export interface Property {
  id: string; user_id: string; name: string; prop_type: string | null;
  address: string | null; postal_code: string | null; sqm: number | null; ownership: string | null;
  value: number | null; obj_value: number | null; purchase_price: number | null;
  purchase_date: string | null; target_rent: number | null; enfia: number | null;
  insurance_amount: number | null; insurance_company: string | null;
  insurance_expiry: string | null; pea_class: string | null; year_built: number | null;
  atak: string | null; floor: number | string | null; heating: string | null;
  parking_spaces: number | null; storage_sqm: number | null; bedrooms: number | null;
  rental_mode: string | null; client_id: string | null; co_owners: string[] | null;
  notes: string | null; status_detail: string | null; created_at: string;
}
// ΤΑ ΠΕΔΙΑ ΠΟΥ ΛΕΙΠΑΝ. Οι δύο τύποι περιέγραφαν λιγότερα από όσα διαβάζει η
// οθόνη, οπότε κάθε χρήση των υπολοίπων περνούσε από `as any` — δεκατέσσερα
// σημεία, το καθένα μια θέση όπου ένα λάθος όνομα στήλης δεν θα το έπιανε
// τίποτα. Ό,τι ζητά το ερώτημα, δηλώνεται εδώ.
export interface Expense  { id:string; amount:number; date:string; category:string; description:string;
                     paid?:boolean|null; expense_group?:string|null; payment_method?:string|null; }
// Το `avg_amount` έφυγε: ΔΕΝ είναι στήλη κανενός πίνακα. Επειδή το ερώτημα
// κάνει `select('*')`, καμία 42703 δεν έσκαγε — απλώς ήταν πάντα undefined και
// το `b.avg_amount || b.amount` έδειχνε το ποσό του ΤΕΛΕΥΤΑΙΟΥ λογαριασμού κάτω
// από τον τίτλο «Μέσοι λογαριασμοί». Ο ιδιοκτήτης έβλεπε τον Ιανουάριο του
// ρεύματος, με τη θέρμανση μέσα και έχτιζε πάνω του ετήσιο προϋπολογισμό.
export interface Bill     { id:string; type:string; amount:number; paid:boolean;
                     due_date?:string|null; name?:string|null; category?:string|null; }
export interface Task     { id:string; title:string; due_date:string|null; priority:string; completed:boolean; }
export interface Tenant   { monthly_rent:number|null; lease_end:string|null; }
/** Το ενοίκιο και ο τρόπος είσπραξης, ανά ακίνητο του χαρτοφυλακίου. */
export interface TenRow { property_id: string; monthly_rent: number | null; e_payment: boolean | null }
/** Ό,τι θέλει η Επισκόπηση από τον τρέχοντα μισθωτή, πέρα από το ενοίκιο. */
export interface TenantFull { id?:string; lease_start:string|null; lease_end:string|null; e_payment?:boolean|null }

// ── Η ΡΑΜΠΑ ΤΗΣ ΚΑΤΑΣΤΑΣΗΣ, ΠΑΡΑΓΩΓΗ ΑΠΟ ΤΟ ΘΕΜΑ ────────────────────────────
// Επτά ομοιογενείς αποχρώσεις, από γεμάτο προς σβησμένο, στη λογική σειρά των
// καταστάσεων. Μονοχρωματικό, όχι φανάρι πολλών χρωμάτων.
//
// ΗΤΑΝ ΕΠΤΑ ΚΑΡΦΩΜΕΝΑ ΜΠΛΕ, χτισμένα γύρω από το accent του ΦΩΤΕΙΝΟΥ θέματος
// (#1a73e8). Στο σκοτεινό, το accent είναι #8ab4f8 και η ράμπα δεν το
// ακολουθούσε: η «Μακροχρόνια» έμενε βαθύ μπλε πάνω σε σκούρο φόντο και ήταν το
// ΜΟΝΟ σημασιολογικό χρώμα της εφαρμογής που δεν γύριζε με το θέμα.
//
// Το `color-mix` λύνει και τη φορά: στο φωτεινό η ανάμειξη με το φόντο δίνει πιο
// ανοιχτό, στο σκοτεινό πιο βαθύ. Η ΣΕΙΡΑ μένει η ίδια και στα δύο — «γεμάτο»
// προς «σβησμένο» — γιατί αυτό είναι το νόημα, όχι η συγκεκριμένη απόχρωση.
//
// Το κατώφλι είναι 40%: πιο κάτω η κουκκίδα χάνεται μέσα στην κάρτα.
//
// Οι ετικέτες και οι κανόνες της κατάστασης ζουν στο lib/property/status.ts:
// υπήρχαν ΔΥΟ στήλες για το ίδιο πράγμα (status_detail και rental_mode) που
// μπορούσαν να διαφωνήσουν. Εδώ μένει μόνο η όψη.
const statusShade = (weight: number) =>
  `color-mix(in srgb, var(--accent) ${weight}%, var(--bg-base))`;
export const STATUS_COLORS: Record<PropertyStatus,string> = {
  rent_long: statusShade(100),
  rent_short:statusShade(90),
  vacant:    statusShade(80),
  own_use:   statusShade(70),
  renovation:statusShade(60),
  for_sale:  statusShade(50),
  disputed:  statusShade(40),
};
