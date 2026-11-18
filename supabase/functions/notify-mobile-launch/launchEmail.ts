// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ EMAIL ΤΗΣ ΚΥΚΛΟΦΟΡΙΑΣ, ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Δίπλα στη συνάρτηση και ΟΧΙ στο _shared: λέει ότι η εφαρμογή «μόλις
// κυκλοφόρησε» και στέλνεται μόνο τη μέρα που βγαίνει (index.ts). Ο φύλακας
// email-app-claims φυλάει το _shared από ακριβώς αυτή τη δήλωση. Εδώ ο
// έλεγχος messageLang.test.ts το αποδίδει: ελληνικά ίδια ως το byte, αγγλικά
// χωρίς ελληνικό γράμμα. Η γλώσσα είναι αυτή του λογαριασμού στη λίστα.
// ═══════════════════════════════════════════════════════════════════════════
import { emailShell, eyebrow, h, p, buttonPair, linkLine, type Lang } from '../_shared/emailTemplates.ts'

export function launchEmail(urls: { ios: string; android: string; app: string }, lang: Lang = 'el'): { subject: string; html: string } {
  if (lang === 'en') return {
    subject: 'The PROPERWISE mobile app is out',
    html: emailShell({
      preheader: 'The mobile app is available.',
      footerNote: 'You’re receiving this email because you asked to be told about the app. It is the only message on this list. · properwise.gr',
      lang,
      bodyHtml: eyebrow('Just released')
        + h('The mobile app is here')
        + p('You asked to be the first to know. The mobile app is now available: all the management of your properties on your phone, with a few taps or with your voice.')
        + buttonPair({ label: 'App Store', url: urls.ios }, { label: 'Google Play', url: urls.android })
        + linkLine('or carry on from your computer', urls.app),
    }),
  }
  const subject = 'Η εφαρμογή PROPERWISE για κινητά κυκλοφόρησε'
  const html = emailShell({
    preheader: 'Η εφαρμογή για κινητό είναι διαθέσιμη.',
    footerNote: 'Λαμβάνεις αυτό το email επειδή ζήτησες ειδοποίηση για την εφαρμογή. Είναι το μόνο μήνυμα αυτής της λίστας. · properwise.gr',
    bodyHtml: eyebrow('Μόλις κυκλοφόρησε')
      + h('Η εφαρμογή για κινητά είναι εδώ')
      + p('Ζήτησες να μάθεις πρώτος. Η εφαρμογή για κινητό είναι πλέον διαθέσιμη: όλη η διαχείριση των ακινήτων σου στο κινητό, με λίγα πατήματα ή με τη φωνή σου.')
      + buttonPair({ label: 'App Store', url: urls.ios }, { label: 'Google Play', url: urls.android })
      + linkLine('ή συνέχισε από τον υπολογιστή', urls.app),
  })
  return { subject, html }
}
