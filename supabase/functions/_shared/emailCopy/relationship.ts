import { emailShell, eyebrow, h, p, button, greeting, note } from '../emailTemplates.ts'
import { eur } from '../format.ts'
import { dash, esc, has, NOTE, type CopyFn } from './kit.ts'

// ── Φάση 14: Σχέσεις (ενοικιαστές & συνιδιοκτήτες) ────────────────────────────
// Two-sided αξία: επεκτείνει το προϊόν στη δεύτερη πλευρά. Ουδέτερο ως προς το φύλο.
export const RELATIONSHIP: Record<string, CopyFn> = {

  // 91. Καλωσόρισμα ενοικιαστή
  tenant_welcome: (c) => {
    const ref = c.propertyName ? ` στο «${esc(c.propertyName)}»` : '';
    const rent = has(c.amount) ? ` Το μηνιαίο μίσθωμα είναι <b>${eur(c.amount)}</b>.` : '';
    return { subject: 'Καλωσόρισες στο νέο σου σπίτι', html: emailShell({
      preheader: 'Τα βασικά για μια ξεκάθαρη αρχή.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Καλωσόρισμα') + h('Μια ξεκάθαρη αρχή') + greeting(c.name)
        + p(`Καλωσόρισες${ref}. Η διαχείριση του ακινήτου γίνεται μέσω PROPERWISE, ώστε οι πληρωμές, οι αποδείξεις και η επικοινωνία να είναι απλές και ξεκάθαρες για όλους.${rent}`)
        + p('Θα λαμβάνεις υπενθυμίσεις για το ενοίκιο και απόδειξη για κάθε πληρωμή σου, αυτόματα.')
        + button('Δες τις λεπτομέρειες', dash(c))
        + note('Έχεις μια απορία; Απάντησε σε αυτό το μήνυμα και θα φτάσει στον ιδιοκτήτη.'),
    }) };
  },

  // 92. Απόδειξη ενοικίου προς ενοικιαστή
  tenant_rent_receipt: (c) => {
    const per = c.period ? ` για ${esc(c.period)}` : '';
    const ref = c.propertyName ? ` του «${esc(c.propertyName)}»` : '';
    const amt = has(c.amount) ? `<b>${eur(c.amount)}</b>` : 'Η πληρωμή σου';
    return { subject: c.period ? `Απόδειξη ενοικίου ${esc(c.period)}` : 'Η απόδειξη του ενοικίου σου', html: emailShell({
      preheader: 'Η πληρωμή σου καταγράφηκε.',
      bodyHtml: eyebrow('Απόδειξη') + h('Λάβαμε την πληρωμή σου') + greeting(c.name)
        + p(`${amt} για το ενοίκιο${ref}${per} καταγράφηκε. Ευχαριστούμε για τη συνέπεια.`)
        + p('Κράτησε αυτό το μήνυμα ως επιβεβαίωση της πληρωμής σου.')
        + button('Δες την απόδειξη', dash(c))
        + note(NOTE.official),
    }) };
  },

  // 93. Κατάσταση προς συνιδιοκτήτη
  coowner_statement: (c) => {
    const per = c.period ? ` ${esc(c.period)}` : '';
    const ref = c.propertyName ? ` του «${esc(c.propertyName)}»` : '';
    const share = has(c.sharePct) ? ` (μερίδιο ${esc(String(c.sharePct))}%)` : '';
    const amt = has(c.amount) ? p(`Το καθαρό μερίδιό σου${share} για την περίοδο: <b>${eur(c.amount)}</b>.`) : '';
    return { subject: 'Η κατάσταση της συνιδιοκτησίας σου', html: emailShell({
      preheader: 'Το μερίδιό σου σε έσοδα και έξοδα, ξεκάθαρα.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Συνιδιοκτησία') + h(`Η εικόνα σου${per}`) + greeting(c.name)
        + p(`Να η κατάστασή σου για το ακίνητο${ref}${per}: έσοδα, έξοδα και το καθαρό αποτέλεσμα που σου αναλογεί.`)
        + amt
        + button('Δες την πλήρη κατάσταση', dash(c))
        + note(NOTE.official),
    }) };
  },
}
