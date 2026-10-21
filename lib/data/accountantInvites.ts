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
import { isPlanRequired } from '@/lib/core/dbError';

type Db = SupabaseClient;

/** Πόσες διευθύνσεις δέχεται η βάση στη μία φορά. Ίδιο με τη συνάρτηση. */
export const INVITE_BATCH = 100;

/**
 * ΤΑ ΟΡΙΑ ΑΠΟΣΤΟΛΗΣ, ΟΠΩΣ ΤΑ ΟΡΙΖΕΙ Η ΒΑΣΗ (`send_quota_rule`, 20261021120000).
 * Η βάση τα επιβάλλει· εδώ επαναλαμβάνονται για τα κείμενα της οθόνης και το
 * accountantInvites.test.ts απαιτεί να είναι ίδια. Η δοκιμή στέλνει με
 * μικρότερα όρια (έγκριση George 21/10/2026).
 */
export const INVITE_LIMITS = {
  /** Βαθμός «Επαγγελματίας»: ανά 24 ώρες. */
  paidPerDay: 50,
  /** Δοκιμή: ανά 24 ώρες. */
  trialPerDay: 10,
  /** Δοκιμή: σε όλη τη διάρκειά της. */
  trialTotal: 25,
} as const;

/** Τι μπορεί να στείλει ακόμη ο συνδεδεμένος, από τη `my_accountant_invite_allowance`. */
export interface InviteAllowance {
  mode: 'paid' | 'trial' | null;
  perDay: number | null;
  usedToday: number;
  total: number | null;
  usedTotal: number | null;
}

/** Πόσες απομένουν: η μικρότερη από ημέρα και σύνολο. Καθαρή συνάρτηση. */
export function invitesLeft(a: InviteAllowance): number {
  if (!a.mode || a.perDay == null) return 0;
  const day = Math.max(a.perDay - a.usedToday, 0);
  if (a.mode !== 'trial' || a.total == null) return day;
  return Math.min(day, Math.max(a.total - (a.usedTotal ?? 0), 0));
}

/** Η γραμμή που λέει τα όρια και πόσα έμειναν, στα ελληνικά. Καθαρή συνάρτηση. */
export function allowanceLine(a: InviteAllowance): string {
  const left = invitesLeft(a);
  const today = a.perDay == null ? 0 : Math.max(a.perDay - a.usedToday, 0);
  if (a.mode === 'trial') {
    const total = Math.max((a.total ?? INVITE_LIMITS.trialTotal) - (a.usedTotal ?? 0), 0);
    return `Στη δοκιμή: έως ${a.perDay ?? INVITE_LIMITS.trialPerDay} προσκλήσεις τη μέρα και ${a.total ?? INVITE_LIMITS.trialTotal} συνολικά. Απομένουν ${today} σήμερα και ${total} συνολικά, άρα μπορείς να στείλεις ακόμη ${left}.`;
  }
  if (a.mode === 'paid') return `Έως ${a.perDay ?? INVITE_LIMITS.paidPerDay} προσκλήσεις ανά 24 ώρες. Απομένουν ${left}.`;
  return '';
}

/** Διαβάζει τι μπορεί να στείλει ακόμη. `null` όταν η ανάγνωση απέτυχε. */
export async function myAllowance(db: Db): Promise<InviteAllowance | null> {
  const { data, error } = await db.rpc('my_accountant_invite_allowance');
  if (error || !data || typeof data !== 'object') return null;
  const d = data as Partial<InviteAllowance>;
  return {
    mode: d.mode === 'paid' || d.mode === 'trial' ? d.mode : null,
    perDay: typeof d.perDay === 'number' ? d.perDay : null,
    usedToday: typeof d.usedToday === 'number' ? d.usedToday : 0,
    total: typeof d.total === 'number' ? d.total : null,
    usedTotal: typeof d.usedTotal === 'number' ? d.usedTotal : null,
  };
}

export type InviteStatus =
  | 'sent' | 'already_invited' | 'already_client' | 'declined' | 'accepted' | 'withdrawn'
  | 'duplicate' | 'invalid' | 'self' | 'rate_limited' | 'over_limit';

/** Η κατάσταση με λόγια, ίδια στη λίστα αποτελεσμάτων και στο ιστορικό. */
export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  sent: 'Στάλθηκε',
  already_invited: 'Έχει σταλεί τις τελευταίες 7 ημέρες',
  already_client: 'Είναι ήδη πελάτης σου',
  declined: 'Ο πελάτης απάντησε «όχι»· δεν ξαναστέλνεται',
  accepted: 'Αποδέχτηκε',
  withdrawn: 'Την πήρες πίσω',
  duplicate: 'Διπλή στη λίστα',
  invalid: 'Δεν είναι διεύθυνση email',
  self: 'Είναι η δική σου διεύθυνση',
  rate_limited: `Έφτασες το όριο (${INVITE_LIMITS.paidPerDay} ανά 24 ώρες· στη δοκιμή ${INVITE_LIMITS.trialPerDay} τη μέρα και ${INVITE_LIMITS.trialTotal} συνολικά)`,
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

/**
 * Γιατί η βάση αρνήθηκε ολόκληρη τη λίστα.
 *   plan        η πρόσκληση με email ανοίγει στο πακέτο του επαγγελματία
 *               (20261021120000, ίδια πύλη με την πρόσκληση μέλους ομάδας)·
 *   unverified  η διεύθυνση του αποστολέα δεν έχει επιβεβαιωθεί: αυτή είναι
 *               που βλέπει ο πελάτης, οπότε χωρίς αυτήν δεν φεύγει τίποτα·
 *   error       οτιδήποτε άλλο.
 */
export type InviteRefusal = 'plan' | 'unverified' | 'error';

/** Το σφάλμα της βάσης ως λόγος άρνησης. Καθαρή συνάρτηση. */
export function refusalOf(e: unknown): InviteRefusal {
  if (isPlanRequired(e)) return 'plan';
  const m = String((e as { message?: unknown } | null)?.message ?? '');
  return /\bemail_unverified\b/.test(m) ? 'unverified' : 'error';
}

/** Στέλνει τις προσκλήσεις. Το `failed` ξεχωρίζει «δεν απάντησε η βάση» από «καμία γραμμή». */
export async function inviteClients(db: Db, emails: readonly string[]): Promise<{ rows: InviteResult[]; failed: boolean; refusal?: InviteRefusal }> {
  const { data, error } = await db.rpc('accountant_invite_clients', { p_emails: emails.slice(0, INVITE_BATCH * 2) });
  if (error) return { rows: [], failed: true, refusal: refusalOf(error) };
  return { rows: Array.isArray(data) ? (data as InviteResult[]) : [], failed: false };
}

/** Μία πρόσκληση όπως τη θυμάται ο λογιστής. */
export interface SentInvite { id: string; email: string; status: 'sent' | 'accepted' | 'declined' | 'withdrawn'; sentAt: string; answeredAt: string | null }

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

/**
 * Παίρνει πίσω πρόσκληση που δεν απαντήθηκε.
 *
 * ΔΕΝ ΣΒΗΝΕΙ ΓΡΑΜΜΗ. Η απευθείας διαγραφή άφηνε τον λογιστή να σβήσει το «όχι»
 * του πελάτη και να ξαναστείλει αμέσως (20261021120000). Η συνάρτηση σημαδεύει
 * «withdrawn», κρατά την ώρα αποστολής για τις 7 ημέρες και ακυρώνει το
 * μήνυμα που δεν έφυγε ακόμη.
 */
export async function withdrawInvite(db: Db, id: string): Promise<boolean> {
  const { data, error } = await db.rpc('accountant_invite_withdraw', { p_id: id });
  return !error && (data as { ok?: boolean } | null)?.ok === true;
}

// ── Η ΠΛΕΥΡΑ ΤΟΥ ΠΕΛΑΤΗ ─────────────────────────────────────────────────────

/**
 * Μία πρόσκληση προς εμένα. Το `email` είναι η επιβεβαιωμένη διεύθυνση του
 * λογαριασμού που τη στέλνει· το `name` το έγραψε ο ίδιος (μπορεί να λείπει)
 * και δεν αποδεικνύει τίποτα.
 */
export interface ReceivedInvite { id: string; name: string; email: string; sentAt: string }

/**
 * Ποιος ρωτά, όπως τον δείχνει η οθόνη: πρώτα η διεύθυνση (δεν επινοείται)
 * και δίπλα το όνομα ως «δηλώνει». Καθαρή συνάρτηση.
 */
export function inviteSender(inv: Pick<ReceivedInvite, 'name' | 'email'>): { who: string; claimed: string } {
  const name = String(inv.name ?? '').trim();
  const email = String(inv.email ?? '').trim();
  return { who: email || 'Άγνωστος αποστολέας', claimed: name && name.toLowerCase() !== email.toLowerCase() ? name : '' };
}

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
