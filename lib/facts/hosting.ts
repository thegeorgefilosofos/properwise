// ═══════════════════════════════════════════════════════════════════════════
// ΕΙΣΠΡΑΞΕΙΣ ΦΙΛΟΞΕΝΙΑΣ: PAYOUT ΚΑΙ ΔΗΛΩΤΕΟ, ΔΥΟ ΠΟΣΑ ΜΕ ΔΥΟ ΟΝΟΜΑΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Η Επισκόπηση άθροιζε το payout (ό,τι μπήκε στον λογαριασμό) των διαμονών με
// άφιξη ως σήμερα· τα έσοδα της ίδιας οθόνης και του Χαρτοφυλακίου έπαιρναν το
// δηλωτέο ακαθάριστο, με κάθε διαμονή κομμένη στις νύχτες του έτους. Για
// κράτηση 30/12 – 03/01 οι δύο αριθμοί μετρούσαν άλλες νύχτες.
//
// Εδώ και τα δύο βγαίνουν από τις ΙΔΙΕΣ διαμονές με το ΙΔΙΟ κλάσμα νυχτών:
//   · payout: ακαθάριστο μείον τέλος ανθεκτικότητας μείον προμήθεια·
//   · δηλωτέο: ακαθάριστο μείον τέλος ανθεκτικότητας (η προμήθεια είναι δαπάνη).
// Διαμονή χωρίς ανάλυση μετρά με το ποσό που καταχωρήθηκε και μετριέται στο
// `unresolved`, ώστε η οθόνη να το λέει.
// ═══════════════════════════════════════════════════════════════════════════
import { declarableGross, hostPayout, type StayAmountLike } from '@/lib/clients/stayAmounts';
import { stayTotal } from '@/lib/clients/clients';
import { nightsSplit, type TaxStay } from '@/lib/tax/shortTermTax';
import { roundHalfUp } from '@/lib/core/money';
import { HOSTING_LABELS, HOSTING_SHORT_LABELS } from './labels';

export interface HostingReceipts {
  /** Μπήκαν στον λογαριασμό. */
  payout: number;
  /** Δηλώνονται ως ακαθάριστο. */
  declarable: number;
  /** Νύχτες μέσα στο έτος, ως σήμερα. */
  nights: number;
  /** Διαμονές που μέτρησαν. */
  stays: number;
  /** Διαμονές χωρίς ρητή βάση ποσού. */
  unresolved: number;
}

const iso = (d: string | null | undefined) => (d || '').slice(0, 10);

/** Το μέρος της διαμονής που ανήκει στο έτος (νύχτες μέσα στο έτος / όλες). */
export function yearShare(s: StayAmountLike, year: number): { share: number; nights: number } {
  const { inYear, total } = nightsSplit(s as unknown as TaxStay, year);
  if (total > 0) return { share: inYear / total, nights: inYear };
  return { share: iso(s.check_in || s.check_out).slice(0, 4) === String(year) ? 1 : 0, nights: 0 };
}

export function hostingReceipts(stays: readonly StayAmountLike[], year: number, today: string): HostingReceipts {
  const t = iso(today);
  let payout = 0, declarable = 0, nights = 0, count = 0, unresolved = 0;
  for (const s of stays) {
    if (iso(s.check_in || s.check_out) > t) continue;
    const { share, nights: n } = yearShare(s, year);
    if (share <= 0) continue;
    const total = stayTotal(s);
    const d = declarableGross(s), p = hostPayout(s);
    if (d == null || p == null) { if (total > 0) unresolved++; }
    declarable += (d ?? total) * share;
    payout += (p ?? total) * share;
    nights += n;
    count++;
  }
  return {
    payout: roundHalfUp(payout, 2), declarable: roundHalfUp(declarable, 2),
    nights, stays: count, unresolved,
  };
}

/**
 * Τα μέρη του πλακιδίου «Εισπράξεις φιλοξενίας» ως κείμενο, με τις ίδιες λέξεις
 * σε κάθε οθόνη. Τα ποσά και τις ημερομηνίες τα μορφοποιεί ο καλών.
 */
export function hostingParts(
  h: Pick<HostingReceipts, 'declarable' | 'nights'>, nextArrival: string | null,
  fmt: (n: number) => string, fmtDate: (d: string) => string,
): string {
  return [
    `${HOSTING_LABELS.declarable}: ${fmt(h.declarable)}`,
    h.nights > 0 ? `${h.nights} ${HOSTING_LABELS.nights}` : null,
    nextArrival ? `${HOSTING_LABELS.next} ${fmtDate(nextArrival)}` : null,
  ].filter(Boolean).join(' · ');
}

/**
 * Τα ίδια σε μισό πλακίδιο: πρώτα το ποσό, μετά η σύντομη λέξη, χωρίς την
 * επόμενη άφιξη. Το ίδιο μοτίβο με το `expensePartsShort` των δαπανών.
 */
export function hostingPartsShort(h: Pick<HostingReceipts, 'declarable' | 'nights'>, fmt: (n: number) => string): string {
  return [
    `${fmt(h.declarable)} ${HOSTING_SHORT_LABELS.declarable}`,
    h.nights > 0 ? `${h.nights} ${HOSTING_SHORT_LABELS.nights}` : null,
  ].filter(Boolean).join(' · ');
}
