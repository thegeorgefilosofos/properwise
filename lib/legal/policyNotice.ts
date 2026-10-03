// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΝΗΜΕΡΩΣΗ ΓΙΑ ΤΗΝ ΑΛΛΑΓΗ ΤΩΝ ΟΡΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Οι Όροι κρατούν το δικαίωμα να αλλάξουν όρια «με προηγούμενη ενημέρωση».
// Η αλλαγή της έκδοσης ξαναέδειχνε μόνο το πλαίσιο των cookies: κανείς δεν
// μάθαινε τι άλλαξε. Εδώ ζει η μία πρόταση που λέει τι άλλαξε στην τρέχουσα
// έκδοση και ο κανόνας για το ποιος τη βλέπει.
//
// ΠΟΙΟΣ ΤΗ ΒΛΕΠΕΙ. Όποιος δεν την έχει ήδη: ούτε έκλεισε το πλαίσιο αυτής της
// έκδοσης (`policy_notice_seen` στα στοιχεία του λογαριασμού, ή τοπικά), ούτε
// εγγράφηκε δεχόμενος ήδη αυτή την έκδοση (`consent_policy_version`).
// ═══════════════════════════════════════════════════════════════════════════
import { POLICY_VERSION } from './identity'
import { TRIAL_SCANS_PER_MONTH } from '@/lib/billing/aiLimits'

/** Τι άλλαξε στην τρέχουσα έκδοση, σε μία πρόταση. */
export const POLICY_CHANGE_SUMMARY =
  `Στη δοκιμή και στους μήνες χωρίς χρέωση η σάρωση εγγράφων έχει πλέον όριο ${TRIAL_SCANS_PER_MONTH} τον μήνα. Στις πληρωμένες συνδρομές δεν αλλάζει τίποτα.`

/** Το κλειδί του τοπικού αντιγράφου, για όσο η εγγραφή στον λογαριασμό δεν έχει φτάσει. */
export const POLICY_NOTICE_KEY = 'po_policy_notice_seen'

export interface PolicyMeta {
  consent_policy_version?: unknown
  policy_notice_seen?: unknown
}

/** Πρέπει να δει την ενημέρωση; `seenLocally` είναι η έκδοση που έκλεισε σε αυτή τη συσκευή. */
export function policyNoticeDue(meta: PolicyMeta | null | undefined, seenLocally: string | null, version = POLICY_VERSION): boolean {
  if (seenLocally === version) return false
  if (meta?.policy_notice_seen === version) return false
  if (meta?.consent_policy_version === version) return false
  return true
}
