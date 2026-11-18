// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΜΙΚΡΑ ΜΗΝΥΜΑΤΑ ΤΩΝ ΣΥΝΑΡΤΗΣΕΩΝ ΑΚΡΗΣ, ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Πρόσκληση σε ομάδα (send-org-invite), δοκιμαστική ειδοποίηση και επιβεβαίωση
// διεύθυνσης (send-test-notification)
// και το πλαίσιο του ενημερωτικού (send-newsletter).
// Ζούσαν μέσα στα index.ts, δίπλα στο `Deno.serve`, όπου κανένας έλεγχος δεν
// τα αποδίδει. Τα ελληνικά μένουν ίδια ως το byte (messageLang.test.ts).
//
// ΣΕ ΠΟΙΑ ΓΛΩΣΣΑ ΦΕΥΓΟΥΝ. Σε αυτήν του λογαριασμού που τα προκαλεί: ο
// διαχειριστής που προσκαλεί, ο κάτοχος που ζητά δοκιμή ή επιβεβαίωση, ο
// χρήστης του ενημερωτικού. Ο παραλήπτης μιας πρόσκλησης δεν έχει ακόμη
// λογαριασμό, άρα ούτε δική του επιλογή.
// ═══════════════════════════════════════════════════════════════════════════
import { emailShell, eyebrow, h, p, button, note, linkLine, type Lang } from './emailTemplates.ts'
import { EMAIL_LIGHT as C } from './emailPalette.ts'

const en = (lang: Lang) => (lang === 'en' ? { lang } : {})

// ── Πρόσκληση σε ομάδα ──────────────────────────────────────────────────
const escO = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string))
const ROLE = { el: { admin: 'Διαχειριστής', member: 'Μέλος' }, en: { admin: 'Administrator', member: 'Member' } }

export function orgInviteEmail(orgName: string, inviter: string, role: string, signupUrl: string, lang: Lang = 'el'): { subject: string; html: string } {
  const label = role === 'admin' ? ROLE[lang].admin : ROLE[lang].member
  if (lang === 'en') {
    const org = orgName ? `to ${escO(orgName)}` : 'to a team on PROPERWISE'
    const who = inviter ? escO(inviter) : 'The team administrator'
    return {
      subject: orgName ? `Invitation to the team “${orgName}”` : 'Invitation to PROPERWISE',
      html: emailShell({
        preheader: `${who} invited you ${org}.`,
        footerNote: 'You received this email because you were added to a team. If you weren’t expecting it, ignore it. · properwise.gr',
        lang,
        bodyHtml: eyebrow('Team invitation')
          + h(`You’ve been invited ${org}`)
          + p(`${who} invited you to work together on PROPERWISE with the role <strong class="ink" style="color:${C.ink};">${label}</strong>. Create an account with this email and you will find the team waiting for you.`)
          + button('Create an account', signupUrl),
      }),
    }
  }
  // «στο Χ» με όνομα, «σε μια ομάδα στο PROPERWISE» χωρίς: το άρθρο αλλάζει με το ουσιαστικό.
  const org = orgName ? `στο ${escO(orgName)}` : 'σε μια ομάδα στο PROPERWISE'
  const who = inviter ? escO(inviter) : 'Ο διαχειριστής της ομάδας'
  // Το θέμα είναι απλό κείμενο: το esc() εκεί θα έγραφε «&amp;» αυτούσιο.
  const subject = orgName ? `Πρόσκληση στην ομάδα «${orgName}»` : 'Πρόσκληση στο PROPERWISE'
  const html = emailShell({
    preheader: `${who} σε προσκάλεσε ${org}.`,
    footerNote: 'Έλαβες αυτό το email επειδή προστέθηκες σε ομάδα. Αν δεν το περίμενες, αγνόησέ το. · properwise.gr',
    bodyHtml: eyebrow('Πρόσκληση σε ομάδα')
      + h(`Προσκλήθηκες ${org}`)
      + p(`${who} σε προσκάλεσε να συνεργαστείς στο PROPERWISE με ρόλο <strong class="ink" style="color:${C.ink};">${label}</strong>. Δημιούργησε λογαριασμό με αυτό το email και θα βρεις την ομάδα να σε περιμένει.`)
      + button('Δημιουργία λογαριασμού', signupUrl),
  })
  return { subject, html }
}

// ── Δοκιμαστική ειδοποίηση ──────────────────────────────────────────────
export function testEmailHtml(lang: Lang = 'el'): { subject: string; html: string } {
  if (lang === 'en') return {
    subject: 'Test notification from PROPERWISE',
    html: emailShell({
      preheader: 'Your address works.',
      footerNote: 'A test message you requested from your settings. · properwise.gr',
      lang,
      bodyHtml: eyebrow('Test')
        + h('Your notifications work')
        + p('This is a test email. If you can see it, your address is correct and you will receive your reminders for rents, bills and calendar events as normal.'),
    }),
  }
  const subject = 'Δοκιμαστική ειδοποίηση από το PROPERWISE'
  const html = emailShell({
    preheader: 'Η διεύθυνσή σου δουλεύει.',
    footerNote: 'Δοκιμαστικό μήνυμα που ζήτησες από τις ρυθμίσεις. · properwise.gr',
    bodyHtml: eyebrow('Δοκιμή')
      + h('Οι ειδοποιήσεις σου δουλεύουν')
      + p('Αυτό είναι ένα δοκιμαστικό email. Αν το βλέπεις, η διεύθυνσή σου είναι σωστή και θα λαμβάνεις κανονικά τις υπενθυμίσεις για ενοίκια, λογαριασμούς και γεγονότα του ημερολογίου σου.'),
  })
  return { subject, html }
}

/**
 * ΤΟ ΜΗΝΥΜΑ ΕΠΙΒΕΒΑΙΩΣΗΣ, ΟΤΑΝ Η ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΕΙΝΑΙ Η ΔΙΚΗ ΣΟΥ.
 *
 * Ο παραλήπτης μπορεί να μην έχει ιδέα ποιοι είμαστε: το μήνυμα λέει ΠΟΙΟΣ το
 * ζήτησε, ΤΙ θα λαμβάνει και ότι αν δεν το περίμενε, δεν χρειάζεται να κάνει
 * τίποτα. Ένα «αγνόησέ το» είναι πιο σεβαστικό από ένα κουμπί απόρριψης, γιατί
 * χωρίς το πάτημα δεν στέλνεται ούτως ή άλλως τίποτα.
 */
export function confirmEmailHtml(link: string, owner: string, lang: Lang = 'el'): { subject: string; html: string } {
  if (lang === 'en') return {
    subject: 'Confirm your address for PROPERWISE reminders',
    html: emailShell({
      preheader: 'Confirm this address for the reminders.',
      footerNote: 'This message was sent because confirmation of this address was requested. · properwise.gr',
      lang,
      bodyHtml: eyebrow('Confirmation')
        + h('Shall we send the reminders here?')
        + p(`The holder of the account ${owner} set this address for PROPERWISE reminders: bills, rents and calendar events.`)
        + p(`If you’re expecting this, confirm it. <strong class="ink" style="color:${C.ink};">If not, ignore this message</strong>: without confirmation nothing else is sent to this address.`)
        + button('Confirm the address', link)
        + note('The link expires in 48 hours.'),
    }),
  }
  const subject = 'Επιβεβαίωση διεύθυνσης για υπενθυμίσεις PROPERWISE'
  const html = emailShell({
    preheader: 'Επιβεβαίωσε αυτή τη διεύθυνση για τις υπενθυμίσεις.',
    footerNote: 'Το μήνυμα στάλθηκε επειδή ζητήθηκε επιβεβαίωση αυτής της διεύθυνσης. · properwise.gr',
    bodyHtml: eyebrow('Επιβεβαίωση')
      + h('Να στέλνουμε τις υπενθυμίσεις εδώ;')
      + p(`Ο κάτοχος του λογαριασμού ${owner} όρισε αυτή τη διεύθυνση για τις υπενθυμίσεις του PROPERWISE: λογαριασμοί, ενοίκια και γεγονότα ημερολογίου.`)
      + p(`Αν το περιμένεις, επιβεβαίωσέ το. <strong class="ink" style="color:${C.ink};">Αν όχι, αγνόησε αυτό το μήνυμα</strong>: χωρίς επιβεβαίωση δεν στέλνεται τίποτα άλλο σε αυτή τη διεύθυνση.`)
      + button('Επιβεβαίωση διεύθυνσης', link)
      + note('Ο σύνδεσμος λήγει σε 48 ώρες.'),
  })
  return { subject, html }
}

// ── Το πλαίσιο του ενημερωτικού ─────────────────────────────────────────
// Ο τίτλος και το σώμα κάθε ανακοίνωσης (product_updates) τα γράφει άνθρωπος,
// στα ελληνικά, και φεύγουν όπως γράφτηκαν. Στα αγγλικά αλλάζει μόνο ό,τι
// γράφουμε εμείς γύρω τους.
const escN = (v: unknown) => String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c))
export interface ProductUpdate { id: string; title: string; body_html: string; cta_label?: string; cta_url?: string }

export function newsLayout(inner: string, unsubUrl: string, lang: Lang = 'el'): string {
  return emailShell({
    unsubUrl,
    ...en(lang),
    bodyHtml: eyebrow(lang === 'en' ? 'New features' : 'Νέες δυνατότητες') + inner,
  })
}

export function updateBlock(u: ProductUpdate, lang: Lang = 'el'): string {
  const cta = u.cta_url ? linkLine(u.cta_label || (lang === 'en' ? 'See more' : 'Δες περισσότερα'), u.cta_url) : ''
  return `<div class="rule-t" style="padding:20px 0 4px;border-top:1px solid ${C.rule};">
    <h2 class="ink" style="margin:0 0 7px;font-size:17px;color:${C.ink};font-weight:600;letter-spacing:-0.2px;mso-line-height-rule:exactly;line-height:24px;">${escN(u.title)}</h2>
    <div class="tx" style="font-size:15px;color:${C.text};mso-line-height-rule:exactly;line-height:25px;">${u.body_html || ''}</div>${cta}
  </div>`
}

/** Το θέμα: ο τίτλος της μίας ανακοίνωσης, αλλιώς το πλήθος τους. */
export const newsSubject = (updates: readonly ProductUpdate[], lang: Lang = 'el'): string =>
  updates.length === 1 ? updates[0].title : (lang === 'en' ? `${updates.length} new features` : `${updates.length} νέες δυνατότητες`)
