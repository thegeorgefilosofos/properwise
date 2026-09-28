'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΜΟΝΤΕΛΟ ΤΟΥ ΠΕΛΑΤΟΛΟΓΙΟΥ: ΠΕΛΑΤΕΣ, ΔΙΑΜΟΝΕΣ, ΕΓΓΡΑΦΑ, ΦΟΡΜΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Οι τύποι όσων διαβάζει η καρτέλα, οι κενές φόρμες, τα είδη εγγράφων και
// οι μικροί βοηθοί για ημερομηνίες, μέγεθος αρχείου και συνδέσμους μηνυμάτων.
// ═══════════════════════════════════════════════════════════════════════════
import {
  normalizePhone, STAY_CHANNELS, STAY_CHANNEL_LABELS, NOTE_KINDS, NOTE_KIND_LABELS,
} from '@/lib/clients/clients'
import type { AmountBasis } from '@/lib/clients/stayAmounts'
import { athensToday } from '@/lib/core/time'

// ── Τύποι εγγραφών (καθρέφτης πινάκων Supabase) ─────────────────────────────
// Τα πεδία CRM (rating/tags/do_not_rent/vip/address/id_number/nationality/source)
// ΔΕΝ δηλώνονται εδώ επίτηδες: παραμένουν στη βάση (κανένα καταστροφικό
// migration) αλλά καμία οθόνη δεν τα διαβάζει ούτε τα γράφει πλέον. Αν λείπουν
// από τον τύπο, δεν μπορεί κανείς να τα ξαναχρησιμοποιήσει κατά λάθος.
export interface Client {
  id: string; user_id: string; type: string; full_name: string;
  phone: string | null; email: string | null; notes: string | null;
  created_at: string; updated_at: string;
}
export interface Stay {
  id: string; user_id: string; client_id: string; property_id: string | null;
  check_in: string | null; check_out: string | null; nights: number | null; guests: number | null;
  nightly_rate: number | null; total: number | null; channel: string | null;
  damages: boolean | null; damage_cost: number | null; damage_note: string | null;
  damage_item_id: string | null;
  gross_guest_paid: number | null; platform_fee: number | null; climate_levy: number | null;
  amount_basis: string | null; declared_at: string | null;
  notes: string | null; created_at: string;
}
export interface Note { id: string; user_id: string; client_id: string; kind: string; body: string; created_at: string; }
export interface PropRow { id: string; name: string; prop_type: string | null; status_detail: string | null; client_id: string | null; sqm: number | null; }
export interface InvItem { id: string; name: string; property_id: string | null; current_value: number | null; }
export interface ClientDoc {
  id: string; user_id: string; client_id: string; name: string; file_path: string;
  mime: string | null; size: number | null; kind: string; created_at: string;
  signedUrl?: string;
}
export interface IcalFeed {
  id: string; user_id: string; property_id: string; channel: string; url: string;
  include_blocked: boolean; active: boolean; last_synced_at: string | null; last_status: string | null; created_at: string;
}
// Υποβολή προ-άφιξης του επισκέπτη (`guest_checkins`). Ακριβώς οι στήλες που
// ζητά το select() και διαβάζει η κάρτα — τίποτα άλλο: με `any[]` το `select('*')`
// κατέβαζε ΚΑΙ το `token` του δημόσιου συνδέσμου μαζί με τα στοιχεία ταυτότητας,
// χωρίς κανείς να το χρειάζεται. Όλα τα προαιρετικά πεδία είναι nullable στη
// βάση, όπως τα επιστρέφει το PostgREST.
export interface Checkin {
  id: string; full_name: string; created_at: string | null;
  id_number: string | null; nationality: string | null; birth_date: string | null;
  phone: string | null; arrival_date: string | null;
  guests_count: number | null; accepts_rules: boolean | null;
}

// Είδη εγγράφων πελάτη (ταυτότητα, συμβόλαιο, απόδειξη, άλλο).
export const DOC_KINDS = ['id', 'contract', 'receipt', 'other'] as const;
export const DOC_KIND_LABELS: Record<string, string> = { id: 'Ταυτότητα / Διαβατήριο', contract: 'Συμβόλαιο', receipt: 'Απόδειξη', other: 'Άλλο' };
export const fmtBytes = (n?: number | null) => {
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export const todayStr = () => athensToday();
/** «1 αδήλωτη διαμονή» / «3 αδήλωτες διαμονές»: το σήμα λέει τι μετρά. */
export const undeclaredLabel = (n: number) => `${n} ${n === 1 ? 'αδήλωτη διαμονή' : 'αδήλωτες διαμονές'}`;

// Φύλακας για ό,τι έρχεται απ' έξω (απόκριση HTTP, JSON.parse): αντικείμενο με
// άγνωστες τιμές. Τίποτα δεν διαβάζεται χωρίς να ελεγχθεί ο τύπος του πρώτα.
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

// Deep-links μηνυμάτων. Το normalizePhone αφαιρεί +30/0030· για 10ψήφιο κινητό
// προσθέτουμε ξανά τον κωδικό χώρας 30 ώστε τα wa.me/viber links να λειτουργούν.
export const msgDigits = (p?: string | null) => { const d = normalizePhone(p); return d.length === 10 ? '30' + d : d; };
export const waLink = (p?: string | null) => `https://wa.me/${msgDigits(p)}`;
export const viberLink = (p?: string | null) => `viber://chat?number=%2B${msgDigits(p)}`;

export const channelOptions = STAY_CHANNELS.map(c => ({ value: c, label: STAY_CHANNEL_LABELS[c] }));
export const noteKindOptions = NOTE_KINDS.map(k => ({ value: k, label: NOTE_KIND_LABELS[k] }));

// ── Κατάσταση φόρμας επισκέπτη ───────────────────────────────────────────────
// Μόνο ό,τι χρειάζεται για να επικοινωνήσεις μαζί του και να κρατήσεις σημείωση.
export interface FormState { full_name: string; phone: string; email: string; notes: string }
export const emptyForm = (): FormState => ({ full_name: '', phone: '', email: '', notes: '' });

export interface StayForm {
  id?: string; property_id: string; check_in: string; check_out: string; nights: string;
  guests: string; nightly_rate: string; channel: string;
  // Τα τρία ποσά που ΔΕΝ είναι ο ίδιος αριθμός.
  gross_guest_paid: string; platform_fee: string; climate_levy: string;
  /** Το ιστορικό `total`, όταν η γραμμή είναι ακόμη απροσδιόριστη. */
  legacyTotal: string; basis: AmountBasis;
  declared: boolean; declared_at: string;
  damages: boolean; damage_cost: string; damage_note: string; damage_item_id: string;
  notes: string;
}
export const emptyStay = (): StayForm => ({
  property_id: '', check_in: '', check_out: '', nights: '', guests: '', nightly_rate: '',
  channel: 'direct', gross_guest_paid: '', platform_fee: '', climate_levy: '',
  legacyTotal: '', basis: 'unknown', declared: false, declared_at: '',
  damages: false, damage_cost: '', damage_note: '', damage_item_id: '', notes: '',
});
