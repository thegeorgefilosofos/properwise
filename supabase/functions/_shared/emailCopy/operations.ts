import { emailShell, eyebrow, h, p, bullets, button, greeting, note, gv } from '../emailTemplates.ts'
import { eur } from '../format.ts'
import { dash, esc, has, NOTE, type CopyFn } from './kit.ts'

// ── Φάση 8: Λειτουργικά ακινήτου (Operations) ────────────────────────────────
// Ειδοποιήσεις που ενεργοποιούνται από τα δεδομένα του χρήστη: λήξεις, εγγυήσεις,
// ραντεβού, συντήρηση, λογαριασμοί. Αποδεικνύουν ότι «το app δουλεύει για σένα».
export const OPERATIONS: Record<string, CopyFn> = {

  // 53. Πλησιάζει λήξη μίσθωσης
  lease_ending: (c) => {
    const ref = c.propertyName ? ` του «${esc(c.propertyName)}»` : '';
    const when = c.leaseEndDate ? ` στις <b>${esc(c.leaseEndDate)}</b>` : ' σύντομα';
    return { subject: c.propertyName ? `Λήγει η μίσθωση του «${esc(c.propertyName)}»` : 'Πλησιάζει λήξη μίσθωσης', html: emailShell({
      preheader: 'Ώρα να αποφασίσεις ανανέωση ή αλλαγή.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Μίσθωση') + h('Μια μίσθωση πλησιάζει στη λήξη της') + greeting(c.name)
        + p(`Η μίσθωση${ref} λήγει${when}. Είναι η κατάλληλη στιγμή να αποφασίσεις: ανανέωση με τους ίδιους όρους, αναπροσαρμογή ενοικίου ή αναζήτηση νέου ενοικιαστή.`)
        + p('Το PROPERWISE κρατά τους όρους, τις ημερομηνίες και το ιστορικό έτοιμα, ώστε να κινηθείς χωρίς τρέξιμο.')
        + button('Δες τη μίσθωση', dash(c))
        + note(NOTE.ahead),
    }) };
  },

  // 54. Προτροπή ανανέωσης μίσθωσης
  lease_renewal_prompt: (c) => {
    const ref = c.propertyName ? ` για το «${esc(c.propertyName)}»` : '';
    return { subject: 'Ώρα για ανανέωση μίσθωσης;', html: emailShell({
      preheader: 'Αναπροσάρμοσε το ενοίκιο όπως ορίζει το μισθωτήριο.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Ανανέωση') + h('Ανανέωσε με σιγουριά') + greeting(c.name)
        + p(`Αν σκέφτεσαι να ανανεώσεις τη μίσθωση${ref}, το PROPERWISE σε βοηθά να υπολογίσεις την αναπροσαρμογή του ενοικίου με βάση τον όρο αναπροσαρμογής του μισθωτηρίου σου (π.χ. ΔΤΚ) και ετοιμάζει ένα σχέδιο ειδοποίησης προς ${gv(c.tenantGender, { m: 'τον ενοικιαστή', f: 'την ενοικιάστρια', n: 'τον μισθωτή' })}, έτοιμο να το προσαρμόσεις και να το στείλεις.`)
        + button('Ετοίμασε την ανανέωση', dash(c))
        + note(NOTE.legal),
    }) };
  },

  // 55. Τακτοποίηση εγγύησης (λήξη μίσθωσης)
  deposit_reminder: (c) => {
    const ref = c.propertyName ? ` του «${esc(c.propertyName)}»` : '';
    const amt = has(c.amount) ? ` (<b>${eur(c.amount)}</b>)` : '';
    return { subject: 'Η εγγύηση θέλει τακτοποίηση', html: emailShell({
      preheader: 'Μια εκκρεμότητα που θέλει καθαρό κλείσιμο.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Εγγύηση') + h('Ας κλείσουμε καθαρά την εγγύηση') + greeting(c.name)
        + p(`Με τη λήξη της μίσθωσης${ref}, η εγγύηση${amt} περνά στο τελευταίο της στάδιο: επιστρέφεται ολόκληρη ή συμψηφίζεται με τυχόν οφειλές και ζημιές που έχουν καταγραφεί.`)
        + p('Κατάγραψε την κίνηση στο PROPERWISE, ώστε τα βιβλία σου να μένουν καθαρά και το κλείσιμο της μίσθωσης ξεκάθαρο για κάθε πλευρά. Η απόδειξη μένει στο ιστορικό του ακινήτου, έτοιμη όποτε χρειαστεί.')
        + bullets([
            'Σημείωσε το ποσό της εγγύησης και την ημερομηνία επιστροφής ή συμψηφισμού.',
            'Παρακράτησε τεκμηριωμένα μόνο ό,τι προβλέπει το μισθωτήριο: ανεξόφλητα ενοίκια, εκκρεμείς λογαριασμούς ή ζημιές πέρα από τη φυσιολογική φθορά.',
            'Κράτησε φωτογραφίες και αποδείξεις στο ιστορικό, ώστε κάθε παρακράτηση να στέκει.',
          ])
        + button('Τακτοποίησε την εγγύηση', dash(c))
        + note(NOTE.legal),
    }) };
  },

  // 56. Λήξη ασφαλιστηρίου ακινήτου
  insurance_expiring: (c) => {
    const ref = c.propertyName ? ` του «${esc(c.propertyName)}»` : '';
    const who = c.insurerName ? ` με την ${esc(c.insurerName)}` : '';
    const when = c.policyEndDate ? ` στις <b>${esc(c.policyEndDate)}</b>` : ' σύντομα';
    return { subject: 'Λήγει η ασφάλεια του ακινήτου', html: emailShell({
      preheader: 'Μην αφήσεις κενό στην κάλυψη.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Ασφάλεια') + h('Η κάλυψή σου πλησιάζει στη λήξη') + greeting(c.name)
        + p(`Το ασφαλιστήριο${ref}${who} λήγει${when}. Μια έγκαιρη ανανέωση κρατά το ακίνητό σου προστατευμένο, χωρίς κενό στην κάλυψη.`)
        + button('Δες τη λήξη', dash(c))
        + note(NOTE.ahead),
    }) };
  },

  // 57. Λήξη πιστοποιητικού (π.χ. ΠΕΑ)
  certificate_expiring: (c) => {
    // Anchor every article on the neuter «πιστοποιητικό»; the specific name (which
    // may be feminine, π.χ. «η άδεια») follows after a colon, so no gender mis-agreement.
    const named = c.certificateName ? `: ${esc(c.certificateName)}` : '';
    const ref = c.propertyName ? ` για το «${esc(c.propertyName)}»` : '';
    const when = c.certificateEndDate ? ` στις <b>${esc(c.certificateEndDate)}</b>` : ' σύντομα';
    return { subject: `Λήγει πιστοποιητικό${named}`, html: emailShell({
      preheader: 'Ένα χαρτί που καλό είναι να ανανεωθεί εγκαίρως.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Πιστοποιητικά') + h('Ένα πιστοποιητικό θέλει ανανέωση') + greeting(c.name)
        + p(`Ένα πιστοποιητικό${c.certificateName ? ` (${esc(c.certificateName)})` : ''}${ref} λήγει${when}. Αν σχεδιάζεις μίσθωση, πώληση ή ενεργειακή αναβάθμιση, καλό είναι να το ανανεώσεις εγκαίρως, ώστε να μη σε καθυστερήσει.`)
        + button('Δες το ακίνητο', dash(c))
        + note(NOTE.ahead),
    }) };
  },

  // 58. Υπενθύμιση ραντεβού
  appointment_reminder: (c) => {
    const title = c.appointmentTitle ? esc(c.appointmentTitle) : 'ραντεβού';
    const when = [c.appointmentDate && esc(c.appointmentDate), c.appointmentTime && esc(c.appointmentTime)].filter(Boolean).join(', ');
    return { subject: `Υπενθύμιση: ${title}`, html: emailShell({
      preheader: when ? `${when}.` : 'Ένα ραντεβού σε περιμένει.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Ημερολόγιο') + h('Ένα ραντεβού πλησιάζει') + greeting(c.name)
        + p(`<b>${title}</b>${when ? `, ${when}` : ''}. Το κρατάμε στο ημερολόγιό σου, ώστε να μη σου ξεφύγει.`)
        + button('Δες το ημερολόγιο', dash(c))
        + note('Χρειάζεσαι αλλαγή; Μπορείς να το μεταθέσεις με ένα κλικ.'),
    }) };
  },

  // 59. Προγραμματισμένη συντήρηση
  maintenance_scheduled: (c) => {
    const title = c.maintenanceTitle ? esc(c.maintenanceTitle) : 'εργασία συντήρησης';
    const ref = c.propertyName ? ` στο «${esc(c.propertyName)}»` : '';
    const when = c.maintenanceDate ? ` στις <b>${esc(c.maintenanceDate)}</b>` : '';
    const who = c.contractorName ? ` Συνεργάτης: ${esc(c.contractorName)}.` : '';
    return { subject: 'Προγραμματισμένη συντήρηση', html: emailShell({
      preheader: 'Μια εργασία μπήκε στο ημερολόγιό σου.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Συντήρηση') + h('Μια εργασία είναι προγραμματισμένη') + greeting(c.name)
        + p(`<b>${title}</b>${ref}${when}.${who}`)
        + p('Θα σου θυμίσουμε λίγο πριν, ώστε να είναι όλα έτοιμα.')
        + button('Δες τη συντήρηση', dash(c))
        + note(NOTE.ahead),
    }) };
  },

  // 60. Ολοκλήρωση συντήρησης
  maintenance_completed: (c) => {
    const title = c.maintenanceTitle ? esc(c.maintenanceTitle) : 'Η εργασία συντήρησης';
    const ref = c.propertyName ? ` στο «${esc(c.propertyName)}»` : '';
    const amt = has(c.amount) ? ` Το κόστος, <b>${eur(c.amount)}</b>, καταγράφηκε ως έξοδο.` : '';
    return { subject: 'Ολοκληρώθηκε η συντήρηση', html: emailShell({
      preheader: 'Καταγράφηκε στο ιστορικό του ακινήτου.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Συντήρηση') + h('Η εργασία ολοκληρώθηκε') + greeting(c.name)
        + p(`${title}${ref} ολοκληρώθηκε.${amt}`)
        + p('Έμεινε καταγεγραμμένη στο ιστορικό του ακινήτου, για να έχεις πλήρη εικόνα όποτε τη χρειαστείς.')
        + button('Δες το ιστορικό', dash(c))
        + note(NOTE.autolog),
    }) };
  },

  // 61. Ετήσιος έλεγχος ακινήτου
  inspection_due: (c) => {
    const ref = c.propertyName ? ` του «${esc(c.propertyName)}»` : ' των ακινήτων σου';
    return { subject: 'Ώρα για τον ετήσιο έλεγχο του ακινήτου', html: emailShell({
      preheader: 'Μια ματιά σήμερα, λιγότερες εκπλήξεις αύριο.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Έλεγχος') + h('Ένας έλεγχος αξίζει τον κόπο') + greeting(c.name)
        + p(`Πέρασε ένας χρόνος. Ένας σύντομος έλεγχος${ref}, για φθορές, ασφάλεια και μικροεπισκευές, προλαμβάνει μεγαλύτερα έξοδα και κρατά την αξία ψηλά.`)
        + button('Προγραμμάτισε έλεγχο', dash(c))
        + note(NOTE.ahead),
    }) };
  },

  // 62. Προθεσμία λογαριασμού κοινής ωφέλειας
  utility_bill_due: (c) => {
    const type = c.billType ? esc(c.billType) : '';
    const ref = c.propertyName ? ` του «${esc(c.propertyName)}»` : '';
    const amt = has(c.amount) ? ` ύψους <b>${eur(c.amount)}</b>` : '';
    const when = c.billDueDate ? ` έως <b>${esc(c.billDueDate)}</b>` : '';
    const lead = type ? `Ο λογαριασμός «${type}»` : 'Ο λογαριασμός';
    return { subject: type ? `Πληρωμή: ${type}` : 'Υπενθύμιση πληρωμής λογαριασμού', html: emailShell({
      preheader: 'Μια πληρωμή που καλό είναι να μη μείνει πίσω.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Λογαριασμοί') + h('Ένας λογαριασμός θέλει πληρωμή') + greeting(c.name)
        + p(`${lead}${ref}${amt} λήγει${when}. Πλήρωσέ τον εγκαίρως και κατάγραψε το έξοδο, ώστε η εικόνα του ακινήτου να μένει ακριβής.`)
        + button('Δες τον λογαριασμό', dash(c))
        + note(NOTE.dataOwn),
    }) };
  },

  // 82. Χαμένο ραντεβού (no-show)
  appointment_missed: (c) => {
    const title = c.appointmentTitle ? esc(c.appointmentTitle) : 'ραντεβού';
    return { subject: 'Χαμένο ραντεβού. Ας το ξανακλείσουμε', html: emailShell({
      preheader: 'Ένα κλικ για νέα ημερομηνία.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Ημερολόγιο') + h('Ένα ραντεβού έμεινε στη μέση') + greeting(c.name)
        + p(`Το ραντεβού «${title}» δεν πραγματοποιήθηκε. Δεν πειράζει. Κλείσε νέα ημερομηνία με ένα κλικ, ώστε να μη χαθεί η ευκαιρία.`)
        + button('Κλείσε νέο ραντεβού', dash(c))
        + note('Το κρατάμε στο ημερολόγιό σου μέχρι να βρεις χρόνο.'),
    }) };
  },

  // 113. Νέο αίτημα επισκευής από ενοικιαστή (event· ειδοποίηση ιδιοκτήτη)
  maintenance_requested: (c) => {
    const ref = c.propertyName ? ` στο «${esc(c.propertyName)}»` : '';
    const what = c.maintenanceTitle ? ` «${esc(c.maintenanceTitle)}»` : '';
    return { subject: 'Νέο αίτημα επισκευής από το ακίνητό σου', html: emailShell({
      preheader: 'Ένα αίτημα περιμένει την απάντησή σου.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Συντήρηση') + h('Μπήκε ένα νέο αίτημα επισκευής') + greeting(c.name)
        + p(`Καταχωρήθηκε ένα νέο αίτημα επισκευής${ref}${what} και περιμένει την απάντησή σου. Όσο πιο νωρίς το δεις, τόσο πιο εύκολα λύνεται· τα μικρά θέματα σπάνια μένουν μικρά όταν αργούν.`)
        + p('Δες τι χρειάζεται, ανάθεσε συνεργείο αν θέλεις και κράτησε το ιστορικό καθαρό, όλα από ένα σημείο.')
        + button('Δες και απάντησε', dash(c))
        + note(NOTE.ahead),
    }) };
  },
}
