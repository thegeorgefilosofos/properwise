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
import { PLANS, PRIORITY_SUPPORT_LINE, firstPlanWith } from '@/lib/billing/plans'
import { INBOUND_DOMAIN } from '@/lib/inbound/address'

/**
 * Τι άλλαξε στην τρέχουσα έκδοση (2026-10-04), σε δύο προτάσεις: μία για τους
 * Όρους, μία για την Πολιτική απορρήτου. Τιμές, πακέτα και όρια δεν άλλαξαν.
 *
 * ΛΕΕΙ ΜΟΝΟ Ο,ΤΙ ΙΣΧΥΕΙ ΣΤΗΝ ΕΓΚΑΤΑΣΤΑΣΗ. Η πρόταση διαβάζεται στον περιηγητή,
 * που δεν ξέρει αν το ταμείο είναι ανοιχτό· γι' αυτό ο πωλητής λέγεται γενικά
 * («όταν αγοράζεις στο ταμείο»). Η παραλαβή email γράφεται μόνο όταν υπάρχει
 * τομέας παραλαβής, με τον ίδιο κανόνα που την προσθέτει στο μητρώο
 * υπεργολάβων (lib/legal/subprocessors.ts).
 */
export function policyChangeSummary(inboundDomain: string = INBOUND_DOMAIN): string {
  const inbound = inboundDomain ? ', την παραλαβή των email που προωθείς στη διεύθυνση παραλαβής' : ''
  return `Οι Όροι δεν χαρακτηρίζουν πια την Υπηρεσία ως έκδοση Beta, λένε τι ισχύει όταν αλλάζει μια δυνατότητα, ορίζουν τι σημαίνει η «${PRIORITY_SUPPORT_LINE}» στο πακέτο «${PLANS[firstPlanWith(PRIORITY_SUPPORT_LINE)].name}» και λένε ποιος πουλά τη συνδρομή όταν την αγοράζεις στο ταμείο. Η Πολιτική απορρήτου λέει το όριο σάρωσης της δοκιμής (${TRIAL_SCANS_PER_MONTH} τον μήνα), προσθέτει τον σύνδεσμο ημερολογίου, τη Microsoft στις ειδοποιήσεις περιηγητή${inbound} και την καταγραφή σφαλμάτων όταν ενεργοποιείται, ενώ αφαιρεί το τηλέφωνο από τα στοιχεία για ειδοποιήσεις.`
}

export const POLICY_CHANGE_SUMMARY = policyChangeSummary()

/**
 * Η ΓΡΑΜΜΗ ΠΟΥ ΦΑΙΝΕΤΑΙ (05.10.2026). Η πλήρης περίληψη έπιανε πέντε σειρές
 * νομικού κειμένου πάνω από την Επισκόπηση και δεν τη διάβαζε κανείς. Η
 * ειδοποίηση λέει πλέον σε μία γραμμή τι έγινε και τι ΔΕΝ άλλαξε· η περίληψη
 * ανοίγει με το «Τι άλλαξε». Το «τιμές και πακέτα δεν αλλάζουν» ισχύει για
 * την έκδοση 2026-10-04 (βλ. την κεφαλή του `policyChangeSummary`)· σε νέα
 * έκδοση που αλλάζει τιμή, η πρόταση αλλάζει μαζί με το POLICY_VERSION.
 */
export const POLICY_NOTICE_HEADLINE = 'Ενημερώσαμε τους Όρους και την Πολιτική απορρήτου.'
export const POLICY_NOTICE_LEDE = 'Τιμές και πακέτα δεν αλλάζουν.'

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
