// ═══════════════════════════════════════════════════════════════════════════
// issue — καταχώρηση εγγράφου (true PDF) στο μητρώο & δημόσιο URL επαλήθευσης.
// Η αποτυχία καταχώρησης ΔΕΝ μπλοκάρει την παραγωγή του PDF, αλλά ΑΦΑΙΡΕΙ τη
// διεύθυνση επαλήθευσης: χωρίς γραμμή στο μητρώο, ο κωδικός QR οδηγούσε σε
// σελίδα που δεν βρίσκει τίποτα. Ένα έγγραφο που υπόσχεται επαλήθευση την
// οποία δεν μπορεί να δώσει είναι χειρότερο από ένα έγγραφο που δεν την
// υπόσχεται.
//
// ══ ΑΡΙΘΜΟΣ, ΩΡΑ ΚΑΙ ΑΠΟΤΥΠΩΜΑ ΤΑ ΓΡΑΦΕΙ ΠΛΕΟΝ Ο ΔΙΑΚΟΜΙΣΤΗΣ ═════════════
// Εδώ ο περιηγητής έφτιαχνε τον αριθμό, την ώρα έκδοσης και ένα checksum
// djb2 και έγραφε τη γραμμή με `insert` στο `issued_documents`. Δηλαδή
// οποιοσδήποτε συνδεδεμένος μπορούσε να γράψει στο μητρώο ό,τι τύπο και
// ημερομηνία ήθελε και να το αλλάξει αφού τυπώσει. Από την 20261007100000 ο
// περιηγητής δεν έχει δικαίωμα εγγραφής: καλεί την `issue_document`, που
// παίρνει τον χρήστη από τη συνεδρία, ελέγχει τον τύπο σε κλειστό κατάλογο,
// γράφει αριθμό, `now()`, εκδότη και sha256 και επιστρέφει τα τρία πρώτα.
// ═══════════════════════════════════════════════════════════════════════════
import type { createClient } from '@/lib/supabase/client';
import { savedData } from '@/components/dbWrite';
import { siteUrl } from '@/lib/core/site';

type SB = ReturnType<typeof createClient>;

/**
 * Οι τύποι που εκδίδει η εφαρμογή. Ο ΙΔΙΟΣ κατάλογος ζει μέσα στην
 * `issue_document` (supabase/migrations/20261007100000_…): η βάση αρνείται κάθε
 * άλλον. Η δοκιμή του αρχείου ελέγχει ότι οι δύο λίστες είναι ίδιες, οπότε
 * νέος τύπος σημαίνει ΚΑΙ νέα μετανάστευση.
 */
export const ISSUED_DOC_TYPES = [
  'Αναφορά απόδοσης',
  'Αναφορά χαρτοφυλακίου',
  'Βεβαίωση ενοικίου',
  'Ειδοποίηση αναπροσαρμογής μισθώματος',
  'Ιδιωτικό συμφωνητικό μίσθωσης',
  'Κατάσταση ιδιοκτήτη',
  'Κατάσταση κατανομής',
  'Λογιστική αναφορά',
  'Πίνακας τοκοχρεολυσίου',
  'Φάκελος για τον λογιστή',
] as const;
export type IssuedDocType = typeof ISSUED_DOC_TYPES[number];

/** Κενά `id`, `verifyUrl` και `checksum` σημαίνουν ότι το έγγραφο δεν μπήκε στο μητρώο. */
export interface IssuedDoc { id: string; issuedAt: string; verifyUrl: string; checksum: string }
export interface IssueInput {
  docType: IssuedDocType;
  subject?: string;              // ακίνητο / αποδέκτης — ΔΗΜΟΣΙΟ μέσω /verify
  period?: string;               // «Χρήση 2025» / «Ιούλιος 2026» — ΔΗΜΟΣΙΟ μέσω /verify
  summary?: Record<string, unknown>; // ιδιωτικό στιγμιότυπο, δεμένο στο αποτύπωμα (δεν εκτίθεται)
}

/** Η απάντηση της `issue_document`, ελεγμένη πριν τυπωθεί σε χαρτί. */
function registered(data: unknown): { id: string; issuedAt: string; checksum: string } | null {
  const r = data as { id?: unknown; issued_at?: unknown; checksum?: unknown } | null;
  if (!r || typeof r.id !== 'string' || typeof r.issued_at !== 'string' || typeof r.checksum !== 'string') return null;
  if (!r.id || !r.checksum) return null;
  return { id: r.id, issuedAt: r.issued_at, checksum: r.checksum };
}

export async function issueDocument(supabase: SB, input: IssueInput): Promise<IssuedDoc> {
  const data = await savedData('Το έγγραφο δεν καταχωρήθηκε στο μητρώο, οπότε εκδίδεται χωρίς επαλήθευση',
    supabase.rpc('issue_document', {
      p_doc_type: input.docType,
      p_subject: input.subject || '',
      p_period: input.period || '',
      p_summary: input.summary || {},
    }));
  const reg = registered(data);
  // Χωρίς γραμμή στο μητρώο δεν υπάρχει αριθμός να τυπωθεί: το PDF βγαίνει
  // με ημερομηνία, χωρίς αριθμό, χωρίς QR και χωρίς υπόσχεση επαλήθευσης.
  if (!reg) return { id: '', issuedAt: new Date().toISOString(), verifyUrl: '', checksum: '' };
  // ══ Ο ΚΩΔΙΚΟΣ QR ΕΔΕΙΧΝΕ ΕΚΕΙ ΑΠ' ΟΠΟΥ ΕΤΥΧΕ ΝΑ ΠΑΤΗΘΕΙ ΤΟ ΚΟΥΜΠΙ ═════════
  // Εδώ έγραφε `window.location.origin`. Δηλαδή η διεύθυνση επαλήθευσης —που
  // τυπώνεται σε χαρτί, μπαίνει σε κωδικό QR κι φεύγει σε λογιστή ή σε
  // συνιδιοκτήτη— γεννιόταν από τη διεύθυνση της ΣΤΙΓΜΗΣ:
  //
  //   · `http://localhost:3000/verify/PO-…` όταν εκδοθεί από ανάπτυξη
  //   · `https://properwise-9x2k…vercel.app/verify/…` από προεπισκόπηση
  //
  // Οι προεπισκοπήσεις σβήνονται. Το χαρτί όχι. Ο παραλήπτης σκανάρει έναν
  // κωδικό που δεν ανοίγει πουθενά.
  //
  // Κι μια δεύτερη, ήσυχη περίπτωση: όταν το προϊόν αποκτήσει το domain του,
  // κάθε παλιός σύνδεσμος του Vercel συνεχίζει να δουλεύει — αλλά κάθε ΝΕΟ
  // έγγραφο θα γεννιόταν με τη διεύθυνση από την οποία μπήκε ο χρήστης, όχι με
  // την κανονική. Η `siteUrl` είναι η μία δηλωμένη πηγή, ίδια με αυτήν που
  // χρησιμοποιούν ήδη η πύλη μισθωτή, η πύλη λογιστή κι το ημερολόγιο.
  return { id: reg.id, issuedAt: reg.issuedAt, verifyUrl: siteUrl(`/verify/${reg.id}`), checksum: reg.checksum };
}
