// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΡΟΣΚΛΗΣΗ ΜΕΛΟΥΣ ΣΕ ΛΟΓΙΣΤΙΚΟ ΓΡΑΦΕΙΟ: ΤΟ ΜΗΝΥΜΑ ΚΑΙ ΠΟΙΟΣ ΤΟ ΣΤΕΛΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΛΕΙΠΕ. Η `firm_invite` (20261104120000) γράφει μόνο τη γραμμή στο
// `firm_members`. Κανένα μήνυμα δεν έφευγε: ο Υπεύθυνος πατούσε «Αποστολή»,
// διάβαζε «Η πρόσκληση στάλθηκε.» και ο προσκεκλημένος δεν μάθαινε ποτέ ότι
// τον περιμένει πρόσκληση, εκτός αν του το έλεγε κάποιος.
//
// Εδώ ζουν τα δύο καθαρά κομμάτια της συνάρτησης `send-firm-invite`, για να
// δοκιμάζονται στο Node χωρίς Deno και χωρίς δίκτυο (firmInvite.test.ts):
//   · `firmInviteVerdict`: ποιος δικαιούται να στείλει σε ποια διεύθυνση,
//     πάνω στην απάντηση της `my_firm()` με το JWT του καλούντος·
//   · `firmInviteEmail`: το μήνυμα, στο κοινό κέλυφος όλων των email.
// ═══════════════════════════════════════════════════════════════════════════
import { emailShell, eyebrow, h, p, button, note } from './emailTemplates.ts'
import { esc } from './emailCopy/kit.ts'
import { appUrl } from './site.ts'
import { ROLE_LABEL, type FirmRole } from '../../../lib/data/firmRoles.ts'

/**
 * Η είσοδος του λογιστή: η ίδια διεύθυνση με το «Σύνδεση» του χώρου του
 * γραφείου (app/accountant/workspace/page.tsx). Το `next` το διαβάζει το
 * lib/auth/continuation.ts και το κουβαλά και η «Δημιουργία λογαριασμού» της
 * σύνδεσης, οπότε ο νέος χρήστης προσγειώνεται στον χώρο όπου τον περιμένει η
 * πρόσκληση (`my_firm_invites`).
 */
export const FIRM_INVITE_ENTRY = '/login?next=/accountant/workspace'

/** Τα πεδία της `my_firm()` που χρειάζεται η κρίση. */
export interface MyFirmRow {
  name?: string | null
  role?: string | null
  members?: Array<{ email?: string | null; role?: string | null; status?: string | null; userId?: string | null; name?: string | null }> | null
}

export type FirmInviteVerdict =
  | { ok: true; firmName: string; role: FirmRole; inviterName: string | null }
  | { ok: false; status: 403 | 404; error: 'not_manager' | 'not_invited' }

const ROLES = Object.keys(ROLE_LABEL) as FirmRole[]

/**
 * ΔΙΚΑΙΟΥΤΑΙ Ο ΚΑΛΩΝ ΝΑ ΣΤΕΙΛΕΙ ΣΕ ΑΥΤΗ ΤΗ ΔΙΕΥΘΥΝΣΗ;
 *
 * Η απάντηση της `my_firm()` έρχεται από τη βάση με το JWT του καλούντος: το
 * γραφείο είναι το ενεργό γραφείο ΤΟΥ, ο ρόλος ο δικός του. Τίποτα από το
 * σώμα του αιτήματος δεν κρίνει δικαίωμα· το σώμα δίνει μόνο τη διεύθυνση.
 *
 *   · ενεργός Υπεύθυνος γραφείου, αλλιώς 403·
 *   · η διεύθυνση είναι ΕΚΚΡΕΜΗΣ πρόσκληση αυτού του γραφείου, αλλιώς 404.
 *     Ενεργό μέλος δεν ξαναπαίρνει πρόσκληση και ξένη διεύθυνση δεν παίρνει
 *     τίποτα: η συνάρτηση δεν γίνεται εργαλείο αποστολής σε όποιον θέλει ο
 *     καλών. Η απάντηση δεν λέει ποτέ αν η διεύθυνση έχει λογαριασμό.
 *
 * `inviterId` είναι ο συνδεδεμένος, για το όνομα που ο ίδιος έχει δηλώσει.
 */
export function firmInviteVerdict(firm: MyFirmRow | null | undefined, email: string, inviterId: string): FirmInviteVerdict {
  if (!firm || firm.role !== 'manager') return { ok: false, status: 403, error: 'not_manager' }
  const want = email.trim().toLowerCase()
  const members = Array.isArray(firm.members) ? firm.members : []
  const row = members.find(m => (m.email ?? '').trim().toLowerCase() === want && m.status === 'invited')
  if (!want || !row) return { ok: false, status: 404, error: 'not_invited' }
  const role = ROLES.includes(row.role as FirmRole) ? row.role as FirmRole : 'accountant'
  const me = members.find(m => m.userId === inviterId && m.status === 'active')
  return { ok: true, firmName: (firm.name ?? '').trim(), role, inviterName: me?.name?.trim() || null }
}

/**
 * ΤΟ ΜΗΝΥΜΑ. Ποιος, σε ποιο γραφείο, με ποιον ρόλο, τι είναι η πύλη και με
 * ποια διεύθυνση μπαίνει.
 *
 * ΤΟ ΟΝΟΜΑ ΤΟΥ ΓΡΑΦΕΙΟΥ ΕΙΝΑΙ ΥΠΟΚΕΙΜΕΝΟ, ΟΧΙ ΣΥΜΠΛΗΡΩΜΑ. «Στο Παπαδόπουλος &
 * Συνεργάτες» θέλει άλλο άρθρο από «στο Λογιστικό Γραφείο Χ» και «στο γραφείο
 * «Λογιστικό Γραφείο Χ»» λέει τη λέξη δύο φορές (βλ. `daySentence` στο
 * lib/data/firms.ts). Σε εισαγωγικά και ως υποκείμενο δεν θέλει άρθρο.
 *
 * ΑΠΟΣΤΟΛΕΑΣ ΕΙΝΑΙ Η ΕΠΙΒΕΒΑΙΩΜΕΝΗ ΔΙΕΥΘΥΝΣΗ. Το όνομα που έχει δηλώσει ο
 * Υπεύθυνος φαίνεται δίπλα της, ποτέ στη θέση της, όπως στην πρόσκληση πελάτη (emailCopy/lifecycle.ts).
 */
export function firmInviteEmail(o: {
  firmName: string; role: FirmRole; inviterEmail: string; inviterName?: string | null; inviteeEmail: string
}): { subject: string; html: string } {
  const firm = o.firmName.trim()
  const who = o.inviterEmail
    ? `Ο λογαριασμός <b>${esc(o.inviterEmail)}</b>${o.inviterName && o.inviterName !== o.inviterEmail ? ` (${esc(o.inviterName)})` : ''}`
    : 'Ο Υπεύθυνος ενός γραφείου'
  const team = firm ? `της ομάδας «${esc(firm)}»` : 'της ομάδας ενός γραφείου'
  const role = ROLE_LABEL[o.role] ?? ROLE_LABEL.accountant
  // Το θέμα είναι απλό κείμενο: το esc() εκεί θα έγραφε «&amp;» αυτούσιο.
  const subject = firm ? `«${firm}» σε προσκαλεί στο PROPERWISE` : 'Πρόσκληση σε γραφείο στο PROPERWISE'
  const html = emailShell({
    preheader: firm ? `Πρόσκληση από «${firm}» με ρόλο ${role}.` : `Πρόσκληση σε γραφείο με ρόλο ${role}.`,
    footerNote: 'Έλαβες αυτό το μήνυμα επειδή ο Υπεύθυνος ενός γραφείου στο PROPERWISE έγραψε αυτή τη διεύθυνση στα μέλη του. Αν δεν το περίμενες, αγνόησέ το. · properwise.gr',
    bodyHtml: eyebrow('Πρόσκληση σε γραφείο')
      + h(firm ? `Πρόσκληση από «${esc(firm)}»` : 'Πρόσκληση σε γραφείο')
      + p(`${who} σε προσκάλεσε να γίνεις μέλος ${team} στο PROPERWISE με ρόλο <b>${esc(role)}</b>.`)
      + p('Η πύλη του λογιστή είναι ο χώρος του γραφείου στο PROPERWISE, όπου το γραφείο βλέπει τους πελάτες που του έδωσαν πρόσβαση στον φάκελό τους.')
      + button('Σύνδεση στην πύλη', appUrl(FIRM_INVITE_ENTRY))
      + note(`Μπες ή δημιούργησε λογαριασμό με αυτή τη διεύθυνση, <b>${esc(o.inviteeEmail)}</b>: η πρόσκληση σε περιμένει μόνο σε αυτήν.`),
  })
  return { subject, html }
}
