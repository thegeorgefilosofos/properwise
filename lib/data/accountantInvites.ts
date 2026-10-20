// ═══════════════════════════════════════════════════════════════════════════
// Η ΜΑΖΙΚΗ ΠΡΟΣΚΛΗΣΗ ΠΕΛΑΤΩΝ: ΤΟ ΣΤΡΩΜΑ ΔΕΔΟΜΕΝΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Ο λογιστής επικολλά μια λίστα (ή ανεβάζει CSV) και η βάση στέλνει σε κάθε
// διεύθυνση το ίδιο μήνυμα από την ουρά των email. Οι κανόνες (όριο, διπλά,
// ξαναστάλσιμο, «ήδη πελάτης») ζουν στη βάση, στην `accountant_invite_clients`
// (20261021090000): εδώ μόνο διαβάζεται η λίστα και μεταφράζεται η απάντηση.
//
// ΤΙΠΟΤΑ ΔΕΝ ΦΑΙΝΕΤΑΙ ΠΡΙΝ ΤΗΝ ΑΠΟΔΟΧΗ. Ο λογιστής βλέπει τη διεύθυνση που
// έγραψε ο ίδιος και την κατάσταση της πρόσκλησης. Ο πελάτης βλέπει ποιος ρωτά
// και αποφασίζει· μόνο το «ναι» του ανοίγει τον φάκελο.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';

type Db = SupabaseClient;

/** Πόσες διευθύνσεις δέχεται η βάση στη μία φορά. Ίδιο με τη συνάρτηση. */
export const INVITE_BATCH = 100;

export type InviteStatus =
  | 'sent' | 'already_invited' | 'already_client' | 'declined' | 'accepted'
  | 'duplicate' | 'invalid' | 'self' | 'rate_limited' | 'over_limit';

/** Η κατάσταση με λόγια, ίδια στη λίστα αποτελεσμάτων και στο ιστορικό. */
export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  sent: 'Στάλθηκε',
  already_invited: 'Έχει σταλεί τις τελευταίες 7 ημέρες',
  already_client: 'Είναι ήδη πελάτης σου',
  declined: 'Ο πελάτης απάντησε «όχι»· δεν ξαναστέλνεται',
  accepted: 'Αποδέχτηκε',
  duplicate: 'Διπλή στη λίστα',
  invalid: 'Δεν είναι διεύθυνση email',
  self: 'Είναι η δική σου διεύθυνση',
  rate_limited: 'Όριο 50 προσκλήσεων ανά 24 ώρες· ξαναδοκίμασε αύριο',
  over_limit: `Πάνω από ${INVITE_BATCH} στη μία φορά· στείλ᾽ την σε δεύτερη λίστα`,
};

/** Μία γραμμή του αποτελέσματος, με τη σειρά που δόθηκε. */
export interface InviteResult { email: string; status: InviteStatus; sentAt: string | null }

/**
 * Οι διευθύνσεις μιας λίστας, όπως την επικόλλησε ή την εξήγαγε ο λογιστής.
 *
 * ΔΕΧΕΤΑΙ Ο,ΤΙ ΒΓΑΖΕΙ ΕΝΑ ΛΟΓΙΣΤΙΚΟ ΠΡΟΓΡΑΜΜΑ. Μία ανά γραμμή, χωρισμένες με
 * κόμμα ή ερωτηματικό, CSV με στήλες (ΑΦΜ, όνομα, email) ή «Όνομα
 * <x@y.gr>»: κρατά μόνο ό,τι μοιάζει με διεύθυνση και αγνοεί τα υπόλοιπα. Τα
 * διπλά και τα άκυρα τα κρίνει η βάση· εδώ δεν πετιέται τίποτα σιωπηλά, εκτός
 * από κελιά χωρίς «@», που δεν είναι διευθύνσεις με κανέναν τρόπο.
 */
export function parseEmailList(text: string): string[] {
  return String(text ?? '')
    .split(/[\s,;<>"'\t]+/)
    .map(t => t.trim().replace(/^mailto:/i, '').replace(/[.)\]]+$/, ''))
    .filter(t => t.includes('@'));
}

/** Πόσες μοναδικές διευθύνσεις έχει η λίστα, για το κουμπί πριν σταλεί. */
export function uniqueCount(emails: readonly string[]): number {
  return new Set(emails.map(e => e.toLowerCase())).size;
}

/** Στέλνει τις προσκλήσεις. Το `failed` ξεχωρίζει «δεν απάντησε η βάση» από «καμία γραμμή». */
export async function inviteClients(db: Db, emails: readonly string[]): Promise<{ rows: InviteResult[]; failed: boolean }> {
  const { data, error } = await db.rpc('accountant_invite_clients', { p_emails: emails.slice(0, INVITE_BATCH * 2) });
  if (error) return { rows: [], failed: true };
  return { rows: Array.isArray(data) ? (data as InviteResult[]) : [], failed: false };
}

/** Μία πρόσκληση όπως τη θυμάται ο λογιστής. */
export interface SentInvite { id: string; email: string; status: 'sent' | 'accepted' | 'declined'; sentAt: string; answeredAt: string | null }

/** Οι προσκλήσεις του λογιστή, νεότερες πρώτες. Η RLS κρατά μόνο τις δικές του. */
export async function myInvitesSent(db: Db): Promise<{ rows: SentInvite[]; failed: boolean }> {
  const { data, error } = await db.from('accountant_invites')
    .select('id,email,status,sent_at,answered_at')
    .order('sent_at', { ascending: false })
    .limit(500);
  if (error) return { rows: [], failed: true };
  return {
    rows: (data ?? []).map(r => ({
      id: r.id as string, email: r.email as string, status: r.status as SentInvite['status'],
      sentAt: r.sent_at as string, answeredAt: (r.answered_at ?? null) as string | null,
    })),
    failed: false,
  };
}

/** Παίρνει πίσω πρόσκληση που δεν απαντήθηκε. */
export async function withdrawInvite(db: Db, id: string): Promise<boolean> {
  const { error } = await db.from('accountant_invites').delete().eq('id', id);
  return !error;
}

// ── Η ΠΛΕΥΡΑ ΤΟΥ ΠΕΛΑΤΗ ─────────────────────────────────────────────────────

export interface ReceivedInvite { id: string; name: string; email: string; sentAt: string }

/** Ποιοι λογιστές ζήτησαν πρόσβαση στη δική μου διεύθυνση. */
export async function invitesForMe(db: Db): Promise<ReceivedInvite[]> {
  // ΣΙΩΠΗΛΟ ΜΟΝΟ ΕΔΩ ΚΑΙ ΜΕ ΛΟΓΟ. Η ενότητα κάθεται στη Λογιστική κάθε
  // ιδιοκτήτη και δεν έχει τίποτα να πει όταν δεν υπάρχει πρόσκληση· μια
  // αποτυχία ανάγνωσης δεν αξίζει μήνυμα λάθους σε οθόνη που δεν τη ζήτησε. Η
  // πρόσκληση δεν χάνεται: ξαναφαίνεται στο επόμενο άνοιγμα.
  try {
    const { data, error } = await db.rpc('my_accountant_invites');
    if (error || !Array.isArray(data)) return [];
    return data as ReceivedInvite[];
  } catch {
    return [];
  }
}

/** «Αποδοχή» ή «Όχι». `no_link` σημαίνει ότι πρέπει πρώτα να βγει σύνδεσμος. */
export async function answerInvite(db: Db, id: string, accept: boolean): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await db.rpc('accountant_invite_answer', { p_id: id, p_accept: accept });
  if (error) return { ok: false, reason: 'error' };
  return (data ?? { ok: false, reason: 'error' }) as { ok: boolean; reason?: string };
}
