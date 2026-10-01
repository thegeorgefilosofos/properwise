import {
  emailShell, eyebrow, h, p, bullets, button, greeting, note, type Personal,
} from '../emailTemplates.ts'
import { dash, esc, NOTE, type CopyFn } from './kit.ts'
import { EMAIL_LIGHT as C } from '../emailPalette.ts'

// ── Ενοποιημένα μηνύματα (digests) ───────────────────────────────────────────
// Δεν είναι καμπάνιες: τα παράγει ο scheduler (emailPolicy.planDeliveries) όταν
// πολλά μηνύματα της ίδιας μέρας θα κατέληγαν μαζί. Αντί για πέντε χωριστά email,
// ο χρήστης λαμβάνει ΕΝΑ, με καθαρή λίστα. Ο scheduler περνά τα θέματα στο
// c.digestItems. Μεταδοτικά (transactional): χωρίς footer απεγγραφής.
const digestList = (items?: Personal['digestItems']) =>
  bullets((items && items.length ? items : [{ title: 'Δες τις λεπτομέρειες στον πίνακά σου' }])
    .map(it => `<b>${esc(it.title)}</b>${it.detail ? ` <span class="mu" style="color:${C.mute};">${esc(it.detail)}</span>` : ''}`))

export const DIGESTS: Record<string, CopyFn> = {

  // Ενοποίηση υποχρεώσεων της ημέρας (dunning ήπιο, λήξεις, ραντεβού, λογαριασμοί)
  digest_obligations: (c) => {
    const n = c.digestItems?.length || 0
    return { subject: n > 1 ? `${n} θέματα χρειάζονται την προσοχή σου` : 'Ένα θέμα χρειάζεται την προσοχή σου', html: emailShell({
      preheader: 'Όλα όσα λήγουν σήμερα, μαζεμένα σε ένα μήνυμα.',
      bodyHtml: eyebrow('Υπενθύμιση') + h('Τι χρειάζεται η προσοχή σου') + greeting(c.name)
        + p('Για να μη γεμίζει το inbox σου, τα μαζέψαμε όλα εδώ:')
        + digestList(c.digestItems)
        + button('Άνοιξε τον πίνακά σου', dash(c))
        + note('Ένα μήνυμα την ημέρα για ό,τι λήγει. Τα δεδομένα σου είναι δικά σου.'),
    }) }
  },

  // Ενοποίηση φορολογικών προθεσμιών
  digest_tax: (c) => ({
    subject: 'Οι φορολογικές σου προθεσμίες', html: emailShell({
      preheader: 'Ε2, ΕΝΦΙΑ και δόσεις, σε μία ματιά.',
      bodyHtml: eyebrow('Φορολογικό ημερολόγιο') + h('Οι προθεσμίες σου, μαζεμένες') + greeting(c.name)
        + p('Οι φορολογικές υποχρεώσεις που πλησιάζουν, σε ένα μήνυμα:')
        + digestList(c.digestItems)
        + button('Δες το ημερολόγιο', dash(c))
        + note(NOTE.aade),
    }),
  }),

  // Ενοποίηση προγράμματος ημέρας για βραχυχρόνια (αφίξεις, αναχωρήσεις, καθαρισμοί)
  digest_str_today: (c) => ({
    subject: 'Το πρόγραμμα της ημέρας', html: emailShell({
      preheader: 'Αφίξεις, αναχωρήσεις και καθαρισμοί για σήμερα.',
      bodyHtml: eyebrow('Βραχυχρόνια') + h('Η σημερινή σου ημέρα') + greeting(c.name)
        + p('Ό,τι τρέχει σήμερα στα καταλύματά σου:')
        + digestList(c.digestItems)
        + button('Άνοιξε το ημερολόγιο', dash(c))
        + note('Ένα μήνυμα το πρωί για όλη τη μέρα, χωρίς διακοπές.'),
    }),
  }),
}
