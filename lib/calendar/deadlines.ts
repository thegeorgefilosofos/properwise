// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΜΠΑΙΝΕΙ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ ΚΑΙ ΤΙ ΔΕΝ ΜΠΑΙΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΕΣΣΕΡΙΣ ΠΗΓΕΣ, ΜΙΑ ΑΠΟΦΑΣΗ: ό,τι έχει ΗΜΕΡΟΜΗΝΙΑ και ΔΕΝ ΕΧΕΙ ΤΕΛΕΙΩΣΕΙ.
//
//   γεγονότα ημερολογίου  ό,τι έγραψε ο ίδιος ή άλλη καρτέλα
//   εκκρεμότητες          όσες έχουν προθεσμία
//   λογαριασμοί           οι ΑΠΛΗΡΩΤΟΙ, στη λήξη τους
//   δόσεις ενοικίου       οι ΑΝΕΙΣΠΡΑΚΤΕΣ, στη λήξη τους
//
// ── ΓΙΑΤΙ ΦΕΥΓΟΥΝ ΤΑ ΤΕΛΕΙΩΜΕΝΑ ──────────────────────────────────────────
// Ενας πληρωμένος λογαριασμός στο ημερολόγιο του Σεπτεμβρίου δεν είναι
// υπενθύμιση, είναι θόρυβος — και ο θόρυβος σε ξένο ημερολόγιο δεν
// «αγνοείται», διαγράφεται ΟΛΟΚΛΗΡΗ η συνδρομή. Το ίδιο και η εκκρεμότητα που
// έκλεισε.
//
// ── ΓΙΑΤΙ ΤΟ ΟΝΟΜΑ ΤΟΥ ΑΚΙΝΗΤΟΥ ΜΠΑΙΝΕΙ ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΠΟΛΛΑ ────────────
// Με ένα ακίνητο, το «Λογαριασμός ΔΕΗ · Αλεξάνδρας 12» λέει δύο φορές το ίδιο
// πράγμα σε γραμμή που στο κινητό κόβεται στους σαράντα χαρακτήρες. Με τρία
// ακίνητα, χωρίς το όνομα δεν ξέρεις ΠΟΙΟΥ σπιτιού είναι ο λογαριασμός.
//
// ── ΤΟ UID ΕΙΝΑΙ ΤΟ ΑΝΑΓΝΩΡΙΣΤΙΚΟ ΤΗΣ ΓΡΑΜΜΗΣ, ΟΧΙ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ────────
// Ο ίδιος λογαριασμός πρέπει να δίνει το ίδιο uid ακόμη κι όταν αλλάξει ποσό
// ή ημερομηνία: το ημερολόγιο τότε ΜΕΤΑΚΙΝΕΙ το γεγονός. Με uid από το
// περιεχόμενο, κάθε διόρθωση θα άφηνε ένα φάντασμα στην παλιά μέρα.
// ═══════════════════════════════════════════════════════════════════════════

import { fe } from '@/lib/core/format';
import { isClosedStatus, taskNoteOf } from '@/lib/facts/deadlines';
import type { FeedItem } from './feed';

export interface DeadlineProperty { id: string; name?: string | null }

export interface DeadlineEvent {
  id: string; property_id?: string | null;
  title?: string | null; event_date?: string | null;
  amount?: number | null; notes?: string | null; status?: string | null;
  /** Ποιος το έγραψε (`tax:<id>`, `bills`, `tenant:<id>:rent_due`…). */
  source?: string | null;
}

export interface DeadlineTask {
  id: string; property_id?: string | null;
  description?: string | null; due_date?: string | null; note?: string | null;
}

export interface DeadlineBill {
  id: string; property_id?: string | null;
  name?: string | null; type?: string | null;
  amount?: number | null; due_date?: string | null; paid?: boolean | null;
}

export interface DeadlineRent {
  id: string; property_id?: string | null;
  amount?: number | null; due_date?: string | null; paid?: boolean | null;
  period_year?: number | null; period_month?: number | null;
}

export interface DeadlineSources {
  properties: readonly DeadlineProperty[];
  events: readonly DeadlineEvent[];
  tasks: readonly DeadlineTask[];
  bills: readonly DeadlineBill[];
  rent: readonly DeadlineRent[];
  /** Το παράθυρο, «YYYY-MM-DD» και τα δύο. */
  from: string;
  to: string;
}

// ── ΤΙ ΔΕΝ ΤΑΞΙΔΕΥΕΙ (05.10.2026) ─────────────────────────────────────────
// · ΤΟ ΚΛΕΙΣΤΟ, με τον ΕΝΑΝ κανόνα της εφαρμογής (lib/facts/deadlines). Εδώ
//   ζούσε δικό του σύνολο χωρίς το `paid`, που είναι ακριβώς η κατάσταση με την
//   οποία κλείνει το Ημερολόγιο: πληρωμένοι φόροι, λογαριασμοί και δόσεις
//   δανείου ταξίδευαν στη συνδρομή και στις ειδοποιήσεις.
// · ΤΟ ΑΝΤΙΓΡΑΦΟ. Η ίδια θεσμική προθεσμία ως γεγονός (`tax:<id>`) και ως
//   εκκρεμότητα με την ίδια ταυτότητα έβγαινε δύο φορές· μένει το γεγονός. Τα
//   γεγονότα που ο συγχρονισμός παράγει από τον πίνακα λογαριασμών (`bills`)
//   είναι αντίγραφα των γραμμών που διαβάζουμε ήδη εδώ, με ημερομηνία
//   μετακινημένη στον τρέχοντα μήνα· δεν ταξιδεύουν. Η υπενθύμιση ενοικίου
//   (`tenant:<id>:rent_due`) δεν ταξιδεύει όταν το ακίνητο έχει δικές του
//   γραμμές ενοικίου στο παράθυρο, που λένε το ίδιο με ακριβές ποσό.
// · Η ΣΗΜΕΙΩΣΗ ΩΣ JSON. Οι εκκρεμότητες κρατούν τη σημείωσή τους μέσα σε
//   `{"__cv":2,…}` και αυτό το κείμενο έφτανε αυτούσιο στην περιγραφή του
//   γεγονότος. Τώρα διαβάζεται μόνο η σημείωση.
const RENT_DUE = /^tenant:[^:]+:rent_due$/;

const day = (v: string | null | undefined): string => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

const text = (v: string | null | undefined): string => String(v ?? '').trim();

/** Το ποσό ως σημείωση, όταν υπάρχει ποσό. */
const money = (v: number | null | undefined): string =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? fe(v) : '';

/**
 * Οι προθεσμίες ενός λογαριασμού, έτοιμες για ημερολόγιο.
 *
 * Καθαρή συνάρτηση: παίρνει γραμμές, δίνει γεγονότα. Καμία ανάγνωση, καμία
 * ώρα συστήματος — το παράθυρο έρχεται από τον καλούντα, ώστε ο έλεγχος να
 * μπορεί να ρωτήσει «τι θα έβλεπε κάποιος τον Αύγουστο».
 */
export function deadlineItems(s: DeadlineSources): FeedItem[] {
  const names = new Map<string, string>();
  for (const p of s.properties) {
    const n = text(p.name);
    if (p.id && n) names.set(p.id, n);
  }
  // Με ΕΝΑ ακίνητο το όνομα δεν προσθέτει τίποτα· με πολλά είναι απαραίτητο.
  const many = names.size > 1;
  const at = (propertyId: string | null | undefined): string => {
    const n = many ? names.get(String(propertyId || '')) : '';
    return n ? ` · ${n}` : '';
  };

  const inWindow = (d: string): boolean => !!d && d >= s.from && d <= s.to;
  const out: FeedItem[] = [];
  const push = (uid: string, date: string, title: string, note: string) => {
    if (!inWindow(date) || !title) return;
    out.push({ uid, date, title, note: note || null });
  };

  const eventTax = new Set<string>();
  const closedTax = new Set<string>();
  for (const e of s.events) {
    const src = text(e.source);
    if (!src.startsWith('tax:')) continue;
    (isClosedStatus(e.status) ? closedTax : eventTax).add(src);
  }
  const rentProps = new Set(s.rent.filter(r => !r.paid && inWindow(day(r.due_date))).map(r => String(r.property_id || '')));

  for (const e of s.events) {
    if (isClosedStatus(e.status)) continue;
    const src = text(e.source);
    if (src === 'bills') continue;
    if (RENT_DUE.test(src) && rentProps.has(String(e.property_id || ''))) continue;
  // ΤΑ ΕΠΙΘΕΜΑΤΑ ΤΩΝ UID ΜΕΝΟΥΝ ΜΕ ΤΟ ΠΑΛΙΟ ΟΝΟΜΑ ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ.
  // Το UID ταυτίζει το γεγονός στο ημερολόγιο του χρήστη. Μια αλλαγή εδώ δεν
  // μετονομάζει τίποτα: δημιουργεί διπλότυπα σε κάθε συνδρομητή, γιατί το
  // πρόγραμμα ημερολογίου βλέπει καινούρια γεγονότα και κρατά και τα παλιά.
    push(`event-${e.id}@properwise`, day(e.event_date),
      text(e.title) + at(e.property_id),
      [money(e.amount), text(e.notes)].filter(Boolean).join(' · '));
  }

  for (const t of s.tasks) {
    const { note, ref } = taskNoteOf(t.note);
    if (ref && (eventTax.has(ref) || closedTax.has(ref))) continue;
    push(`task-${t.id}@properwise`, day(t.due_date),
      text(t.description) + at(t.property_id), note);
  }

  for (const b of s.bills) {
    if (b.paid) continue;
    const what = text(b.name) || text(b.type);
    push(`bill-${b.id}@properwise`, day(b.due_date),
      what ? `${what}${at(b.property_id)}` : '', money(b.amount));
  }

  for (const r of s.rent) {
    if (r.paid) continue;
    push(`rent-${r.id}@properwise`, day(r.due_date),
      `Ενοίκιο${at(r.property_id)}`, money(r.amount));
  }

  // Σταθερή σειρά: ημερομηνία και μετά uid ώστε δύο εκτελέσεις να δίνουν
  // ΤΟ ΙΔΙΟ αρχείο — αλλιώς κάθε ανανέωση μοιάζει αλλαγμένη.
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.uid.localeCompare(b.uid));
}
