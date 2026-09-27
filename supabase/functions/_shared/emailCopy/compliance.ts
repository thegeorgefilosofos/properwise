import { emailShell, eyebrow, h, p, button, greeting, note } from '../emailTemplates.ts'
import { eur } from '../format.ts'
import { dash, esc, has, NOTE, type CopyFn } from './kit.ts'

// ── Φάση 12: Συμμόρφωση (ελληνικές νομικές/φορολογικές υποχρεώσεις) ───────────
// Ενεργοποιούνται από δεδομένα του χρήστη. Αποδεικνύουν βαθιά ελληνική εξειδίκευση
// και ότι το προϊόν προστατεύει τον χρήστη νομικά. Πάντα με ενημερωτική επισήμανση.
export const COMPLIANCE: Record<string, CopyFn> = {

  // 86. Δήλωση μίσθωσης στο myAADE
  lease_declaration_reminder: (c) => {
    const ref = c.propertyName ? ` για το «${esc(c.propertyName)}»` : '';
    const when = c.deadlineDate ? ` έως <b>${esc(c.deadlineDate)}</b>` : ' εντός της προθεσμίας';
    return { subject: 'Δήλωσε τη μίσθωση στο myAADE', html: emailShell({
      preheader: 'Μια υποχρέωση που καλό είναι να μη σου ξεφύγει.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Συμμόρφωση') + h('Μια δήλωση μίσθωσης εκκρεμεί') + greeting(c.name)
        + p(`Για κάθε νέα ή τροποποιημένη μίσθωση${ref}, υποβάλλεται η Δήλωση Πληροφοριακών Στοιχείων Μίσθωσης στο myAADE${when}. Το PROPERWISE κρατά έτοιμα τα στοιχεία, ώστε η υποβολή να γίνει γρήγορα και χωρίς λάθη.`)
        + button('Δες τα στοιχεία της μίσθωσης', dash(c))
        + note(NOTE.aade),
    }) };
  },

  // 87. Ανάρτηση ΑΜΑ βραχυχρόνιας μίσθωσης
  str_registration_reminder: (c) => {
    const ref = c.propertyName ? ` του «${esc(c.propertyName)}»` : '';
    return { subject: 'Ανάρτησε τον Αριθμό Μητρώου Ακινήτου', html: emailShell({
      preheader: 'Ο ΑΜΑ πρέπει να φαίνεται σε κάθε αγγελία.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Συμμόρφωση') + h('Ο ΑΜΑ θέλει ανάρτηση') + greeting(c.name)
        + p(`Για τη βραχυχρόνια μίσθωση${ref}, το ακίνητο εγγράφεται στο Μητρώο Ακινήτων Βραχυχρόνιας Διαμονής και ο Αριθμός Μητρώου Ακινήτου αναρτάται σε κάθε αγγελία σε Airbnb και Booking. Δες αν είναι όλα σε τάξη, ώστε να αποφύγεις πρόστιμα.`)
        + button('Δες το ακίνητο', dash(c))
        + note(NOTE.aade),
    }) };
  },

  // 88. Απόδοση τέλους ανθεκτικότητας (βραχυχρόνιες)
  str_stay_tax: (c) => {
    const per = c.period ? ` της περιόδου ${esc(c.period)}` : '';
    const amt = has(c.amount) ? ` Το ποσό προς απόδοση: <b>${eur(c.amount)}</b>.` : '';
    return { subject: 'Απόδοση τέλους ανθεκτικότητας', html: emailShell({
      preheader: 'Εισπράττεται από τον επισκέπτη, αποδίδεται στο κράτος.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Συμμόρφωση') + h('Ώρα για το τέλος ανθεκτικότητας') + greeting(c.name)
        + p(`Το <b>τέλος ανθεκτικότητας στην κλιματική κρίση</b> για τις βραχυχρόνιες μισθώσεις${per} εισπράττεται από τον επισκέπτη και αποδίδεται στην εφορία.${amt} Το PROPERWISE υπολογίζει ενδεικτικά τι αναλογεί ανά κράτηση, ώστε να έχεις μια καθαρή εικόνα.`)
        + button('Δες τα ποσά', dash(c))
        + note(NOTE.aade),
    }) };
  },

  // 114. Εποχική αλλαγή τέλους ανθεκτικότητας (1 Απρ ↑ / 1 Νοε ↓) — STR heads-up
  takk_seasonal_rate_switch: (c) => ({
    subject: 'Αλλάζει το τέλος ανθεκτικότητας',
    html: emailShell({
      preheader: 'Ενημέρωσε τις χρεώσεις των κρατήσεών σου.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Συμμόρφωση · Βραχυχρόνια') + h('Νέα εποχική χρέωση από σήμερα') + greeting(c.name)
        + p('Το τέλος ανθεκτικότητας στην κλιματική κρίση για τις βραχυχρόνιες μισθώσεις αλλάζει εποχικά. Από σήμερα ισχύει η νέα χρέωση, οπότε ενημέρωσε τις χρεώσεις των κρατήσεών σου ώστε να εισπράττεις ακριβώς το σωστό ποσό σε κάθε αναχώρηση.')
        + p('Το τέλος εισπράττεται από τον επισκέπτη και αποδίδεται στην εφορία. Το PROPERWISE υπολογίζει ενδεικτικά τι αναλογεί ανά κράτηση με τη νέα τιμή.')
        + button('Δες τις νέες χρεώσεις', dash(c))
        + note(NOTE.aade),
    }),
  }),
}
