import { emailShell, eyebrow, h, p, bullets, button, greeting, note, heroStat } from '../emailTemplates.ts'
import { eur } from '../format.ts'
import { dash, esc, has, plural, NOTE, type CopyFn } from './kit.ts'
import { EMAIL_LIGHT as C } from '../emailPalette.ts'

// ── Φάση 2: Engagement & Retention ───────────────────────────────────────────
export const ENGAGEMENT: Record<string, CopyFn> = {

  // 13. Μηνιαία κατάσταση εισπράξεων (1η του μήνα)
  monthly_statement: (c) => {
    const line = (has(c.collected) && has(c.expected))
      ? p(`${c.period ? `<b>${esc(c.period)}</b>. ` : ''}Εισπράχθηκαν <b>${eur(c.collected)}</b> από ${eur(c.expected)}.${has(c.outstanding) ? ` Παραμένουν <b>${eur(c.outstanding)}</b> ανείσπρακτα.` : ' Όλα εισπράχθηκαν.'}`)
      : p('Η συνολική εικόνα των εισπράξεων του μήνα σε περιμένει, τακτοποιημένη ανά ακίνητο.');
    return { subject: 'Η μηνιαία σου κατάσταση', html: emailShell({
      preheader: 'Οι εισπράξεις του μήνα, συνοπτικά.', unsubUrl: c.unsubUrl,
      hero: has(c.collected) ? heroStat(eur(c.collected), 'εισπράχθηκαν τον μήνα') : '',
      bodyHtml: eyebrow('Μηνιαία κατάσταση') + h('Ο μήνας σου, συνοπτικά') + greeting(c.name)
        + line
        + p('Δες την πλήρη ανάλυση ανά ακίνητο και κατέβασε την επίσημη κατάσταση όποτε τη χρειαστείς.')
        + button('Δες τη μηνιαία κατάσταση', dash(c))
        + note(NOTE.official),
    }) };
  },

  // 14. Εβδομαδιαία ενημέρωση επιτοκίων
  market_digest: (c) => ({
    subject: 'Τα επιτόκια αυτή την εβδομάδα',
    html: emailShell({
      preheader: 'Ο δείκτης Euribor, η ΕΚΤ και τα στεγαστικά, με μια ματιά.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Δεδομένα αγοράς') + h('Πού κινούνται τα επιτόκια') + greeting(c.name)
        + p('Κάθε εβδομάδα βλέπεις πού βρίσκεται <b>ο δείκτης Euribor</b>, το <b>επιτόκιο της ΕΚΤ</b> και τα <b>στεγαστικά επιτόκια</b>, για να αξιολογείς δανεισμό ή αναχρηματοδότηση όποτε θες.')
        + p('Η εικόνα αλλάζει γρήγορα. Μια ματιά την εβδομάδα σε κρατά μπροστά.')
        + button('Δες τα επιτόκια', dash(c))
        + note('Χρήσιμο για την αξιολόγηση δανείων και αποδόσεων στο PROPERWISE.'),
    }),
  }),

  // 15. Newsletter «Νέες δυνατότητες»
  product_update: (c) => {
    const detail = c.summaryText
      ? p(esc(c.summaryText))
      : bullets([
          'Πιο γρήγορες αναφορές και εξαγωγές, έτοιμες για λογιστή ή τράπεζα.',
          'Πιο ακριβείς απαντήσεις από τη Νόα, με τα δικά σου δεδομένα.',
          'Λιγότερα βήματα στην καθημερινή καταχώρηση, με φωνητικές εντολές.',
        ])
    return { subject: 'Τι νέο έχει το PROPERWISE', html: emailShell({
      preheader: 'Οι τελευταίες προσθήκες, φτιαγμένες με βάση τη γνώμη σου.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Νέες δυνατότητες') + h('Φτιάξαμε κάτι για σένα') + greeting(c.name)
        + p('Δουλεύουμε συνεχώς πάνω στο PROPERWISE, με βάση αυτά που μας ζητάς. Να οι τελευταίες προσθήκες που κάνουν τη δουλειά σου πιο εύκολη:')
        + detail
        + button('Δες τι νέο υπάρχει', dash(c))
        + note('Λαμβάνεις αυτή την ενημέρωση ως χρήστης του PROPERWISE.'),
    }) }
  },

  // 16. Τριμηνιαία ανασκόπηση χαρτοφυλακίου (Επαγγελματίας)
  quarterly_review: (c) => {
    const bits: string[] = [];
    if (has(c.collected)) bits.push(`έσοδα <b>${eur(c.collected)}</b>`);
    if (has(c.net)) bits.push(`καθαρό αποτέλεσμα <b>${eur(c.net)}</b>`);
    const line = bits.length
      ? p(`${c.period ? `<b>${esc(c.period)}</b>. ` : ''}Το τρίμηνο έκλεισε με ${bits.join(' και ')}.`)
      : p('Η εικόνα του τριμήνου σε περιμένει: έσοδα, έξοδα και καθαρό αποτέλεσμα, ανά ακίνητο.');
    return { subject: 'Το τρίμηνό σου σε μία ματιά', html: emailShell({
      preheader: 'Έσοδα, έξοδα και απόδοση χαρτοφυλακίου.', unsubUrl: c.unsubUrl,
      hero: has(c.collected) ? heroStat(eur(c.collected), 'έσοδα τριμήνου') : '',
      bodyHtml: eyebrow('Ανασκόπηση') + h('Τι έδειξε το τρίμηνο') + greeting(c.name)
        + line
        + p('Δες την πλήρη ανάλυση και σύγκρινε τα ακίνητά σου μεταξύ τους.')
        + button('Δες την ανασκόπηση', dash(c))
        + note('Ιδανικό για να ξεχωρίσεις ποιο ακίνητο αποδίδει και ποιο θέλει προσοχή.'),
    }) };
  },

  // 17. Φορολογική δήλωση, Ε2 (Ιδιώτης και Επαγγελματίας)
  tax_e2: (c) => ({
    subject: 'Πλησιάζει η φορολογική δήλωση',
    html: emailShell({
      preheader: 'Το Ε2 σου ετοιμάζεται από τα δικά σου δεδομένα.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Φορολογικό ημερολόγιο') + h('Ώρα για το Ε2') + greeting(c.name)
        + p(`Η προθεσμία για τη δήλωση εισοδήματος${c.deadlineDate ? ` (έως ${esc(c.deadlineDate)})` : ''} πλησιάζει. Το PROPERWISE συγκεντρώνει τα ενοίκιά σου ανά ακίνητο και ετοιμάζει το Ε2 σου προσυμπληρωμένο, με τα ποσά στη σχετική στήλη, έτοιμο για τον λογιστή σου ή για το myAADE.`)
        + p('Επισημαίνει και όσα λείπουν, ώστε να μην τρέχεις την τελευταία στιγμή. Τα δεδομένα είναι ήδη στη θέση τους.')
        + button('Ετοίμασε το Ε2', dash(c))
        + note(NOTE.aade),
    }),
  }),

  // 18. ΕΝΦΙΑ (όλοι)
  tax_enfia: (c) => ({
    subject: 'ΕΝΦΙΑ: εκτίμηση και προθεσμίες',
    html: emailShell({
      preheader: 'Δες τι αναλογεί σε κάθε ακίνητο, χωρίς εκπλήξεις.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Φορολογικό ημερολόγιο') + h('Ο ΕΝΦΙΑ, χωρίς εκπλήξεις') + greeting(c.name)
        + p('Το PROPERWISE σου δίνει μια ενδεικτική εκτίμηση του ΕΝΦΙΑ για κάθε ακίνητό σου και σου θυμίζει τις δόσεις, ώστε να μην έρχονται ξαφνικά.')
        + button('Δες τον ΕΝΦΙΑ', dash(c))
        + note(NOTE.aade),
    }),
  }),

  // 19. Υπενθύμιση δόσης φόρου (Επαγγελματίας)
  tax_installment: (c) => ({
    subject: 'Υπενθύμιση: δόση φόρου αυτόν τον μήνα',
    html: emailShell({
      preheader: 'Μια ματιά στο φορολογικό σου ημερολόγιο.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Φορολογικό ημερολόγιο') + h('Μια δόση σε περιμένει') + greeting(c.name)
        + p(`${c.deadlineDate ? `Έως τις <b>${esc(c.deadlineDate)}</b>` : 'Μέσα στον μήνα'} λήγει δόση φόρου. Δες το φορολογικό σου ημερολόγιο για να μη σου ξεφύγει τίποτα.`)
        + button('Δες το ημερολόγιο', dash(c))
        + note(NOTE.aade),
    }),
  }),

  // 20. Κλείσιμο χρήσης (τέλος έτους)
  year_end: (c) => ({
    subject: 'Κλείσε τη χρονιά με τα βιβλία σου σε τάξη',
    html: emailShell({
      preheader: 'Ένα καθαρό κλείσιμο σήμερα, ήσυχος Μάρτιος.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Τέλος χρήσης') + h('Λίγο πριν αλλάξει ο χρόνος') + greeting(c.name)
        + p('Πριν κλείσει η χρονιά, οριστικοποίησε τα βιβλία σου: έσοδα, έξοδα και αποτέλεσμα κλειδωμένα, έτοιμα για τη φορολογική δήλωση.')
        + p('Ένα καθαρό κλείσιμο σήμερα σου γλιτώνει ώρες τον Μάρτιο.')
        + button('Κλείδωσε τη χρήση', dash(c))
        + note('Μπορείς να ξεκλειδώσεις ανά πάσα στιγμή, αν χρειαστεί διόρθωση.'),
    }),
  }),

  // 21. Υπενθύμιση μη καταγεγραμμένης είσπραξης (όλοι)
  rent_pending: (c) => {
    const ref = c.propertyName ? ` για το «${esc(c.propertyName)}»` : '';
    const per = c.period ? ` της περιόδου ${esc(c.period)}` : '';
    const amt = has(c.amount) ? `, ύψους <b>${eur(c.amount)}</b>,` : '';
    return { subject: 'Εκκρεμεί μια είσπραξη ενοικίου', html: emailShell({
      preheader: 'Μια πληρωμή δεν έχει καταγραφεί ακόμη.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Εισπράξεις') + h('Μια πληρωμή δεν έχει καταγραφεί') + greeting(c.name)
        + p(`Το ενοίκιο${ref}${per}${amt} δεν έχει σημειωθεί ως εισπραγμένο. Αν το έλαβες, κατέγραψέ το ώστε η εικόνα σου να μένει ακριβής.`)
        + button('Δες τις εισπράξεις', dash(c))
        + note('Αν δεν το έλαβες ακόμη, μπορείς να στείλεις μια ευγενική υπενθύμιση από την καρτέλα του ενοικιαστή.'),
    }) };
  },

  // 22. Πρώτη υπενθύμιση ληξιπρόθεσμου (όλοι)
  dunning_1: (c) => {
    const ref = c.propertyName ? ` για το «${esc(c.propertyName)}»` : '';
    const amt = has(c.amount) ? `, ύψους <b>${eur(c.amount)}</b>,` : '';
    const od = has(c.daysOverdue) ? ` εδώ και ${plural(c.daysOverdue, 'μέρα', 'μέρες')}` : '';
    return { subject: 'Υπενθύμιση: ληξιπρόθεσμο ενοίκιο', html: emailShell({
      preheader: 'Ένα ενοίκιο καθυστερεί.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Υπενθύμιση') + h('Ένα ενοίκιο καθυστερεί') + greeting(c.name)
        + p(`Το ενοίκιο${ref}${amt} εκκρεμεί${od}. Δες τη δόση και, αν θέλεις, στείλε μια ευγενική υπενθύμιση με ένα κλικ.`)
        + button('Δες τη δόση', dash(c))
        + note('Την υπενθύμιση προς τον ενοικιαστή τη στέλνεις εσύ· εμείς δεν γράφουμε στη διεύθυνσή του.'),
    }) };
  },

  // 23. Δεύτερη υπενθύμιση ληξιπρόθεσμου (όλοι)
  dunning_2: (c) => {
    const ref = c.propertyName ? ` για το «${esc(c.propertyName)}»` : '';
    const od = has(c.daysOverdue) ? plural(c.daysOverdue, 'μέρα', 'μέρες') : 'αρκετές μέρες';
    return { subject: 'Δεύτερη υπενθύμιση: το ενοίκιο εκκρεμεί ακόμη', html: emailShell({
      preheader: 'Ίσως ήρθε η ώρα για πιο άμεση υπενθύμιση.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Υπενθύμιση') + h('Το ενοίκιο εκκρεμεί ακόμη') + greeting(c.name)
        + p(`Πέρασαν ${od} και το ενοίκιο${ref} παραμένει ανείσπρακτο. Ίσως ήρθε η ώρα για μια πιο άμεση, αλλά πάντα ευγενική, υπενθύμιση.`)
        + button('Δες τις επιλογές σου', dash(c))
        + note('Το κείμενο της υπενθύμισης είναι έτοιμο· η αποστολή στον ενοικιαστή γίνεται από εσένα.'),
    }) };
  },

  // 24. Τελική υπόμνηση ληξιπρόθεσμου (όλοι)
  dunning_final: (c) => {
    const ref = c.propertyName ? ` για το «${esc(c.propertyName)}»` : '';
    const amt = has(c.amount) ? ` (${eur(c.amount)})` : '';
    const od = has(c.daysOverdue) ? ` εδώ και ${plural(c.daysOverdue, 'μέρα', 'μέρες')}` : '';
    return { subject: 'Τελική υπόμνηση για ληξιπρόθεσμο ενοίκιο', html: emailShell({
      preheader: 'Δες τα επόμενα βήματα.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Τελική υπόμνηση') + h('Χρειάζεται δράση') + greeting(c.name)
        + p(`Το ενοίκιο${ref}${amt} παραμένει ανείσπρακτο${od}. Δες τη δόση και τα επόμενα βήματα που έχεις στη διάθεσή σου.`)
        + button('Δες τη δόση', dash(c))
        + note('Είμαστε δίπλα σου. Αν χρειάζεσαι βοήθεια με τη διαδικασία, απάντησε εδώ.'),
    }) };
  },

  // 110. ΕΝΦΙΑ · υπενθύμιση δόσης (T-2) με ποσό ΑΝΑ ακίνητο — front-run της ΑΑΔΕ
  enfia_installment_reminder: (c) => {
    const frac = (has(c.installmentNo) && has(c.installmentsTotal)) ? `${c.installmentNo}/${c.installmentsTotal}` : ''
    const lead = frac ? `Η δόση ${frac} του ΕΝΦΙΑ` : 'Η επόμενη δόση του ΕΝΦΙΑ'
    const when = c.deadlineDate ? ` λήγει στις <b>${esc(c.deadlineDate)}</b>` : ' λήγει σύντομα'
    const perProp = (c.digestItems && c.digestItems.length)
      ? bullets(c.digestItems.map(it => `<b>${esc(it.title)}</b>${it.detail ? ` <span class="mu" style="color:${C.mute};">${esc(it.detail)}</span>` : ''}`))
      : ''
    const total = has(c.amount) ? p(`Σύνολο αυτού του μήνα: <b>${eur(c.amount)}</b>.`) : ''
    return { subject: frac ? `ΕΝΦΙΑ · η δόση ${frac} λήγει σύντομα` : 'ΕΝΦΙΑ · δόση που λήγει σύντομα', html: emailShell({
      preheader: 'Το ποσό ανά ακίνητο, υπολογισμένο εγκαίρως.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Φορολογικό ημερολόγιο · ΕΝΦΙΑ') + h(frac ? `Η δόση ${frac} του ΕΝΦΙΑ` : 'Πλησιάζει δόση ΕΝΦΙΑ') + greeting(c.name)
        + p(`${lead}${when}. Υπολογίσαμε ενδεικτικά το ποσό για κάθε ακίνητό σου ξεχωριστά, ώστε να δεις με μια ματιά τι αντιστοιχεί σε καθένα και πόσο πληρώνεις συνολικά αυτόν τον μήνα.`)
        + perProp
        + total
        + p('Σου το θυμίσαμε νωρίς επίτηδες, για να το τακτοποιήσεις με την ησυχία σου και όχι στο παρά πέντε.')
        + button('Δες τις δόσεις σου', dash(c))
        + note(NOTE.aade),
    }) }
  },

  // 111. Μηνιαία σύνοψη χαρτοφυλακίου (nudge· τα ακριβή ποσά μένουν πίσω από το login)
  portfolio_digest_nudge: (c) => {
    const per = c.period ? ` (${esc(c.period)})` : ''
    return { subject: 'Ο μηνιαίος απολογισμός σου είναι έτοιμος', html: emailShell({
      preheader: 'Ο μήνας σου, σε μία καθαρή εικόνα.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Μηνιαία σύνοψη χαρτοφυλακίου') + h('Ο μήνας σου, σε μία καθαρή εικόνα') + greeting(c.name)
        + p(`Συγκεντρώσαμε όσα συνέβησαν τον τελευταίο μήνα${per} στο χαρτοφυλάκιό σου: εισπράξεις, πληρότητα, υποχρεώσεις που έρχονται και ευκαιρίες για εξοικονόμηση. Τα ακριβή ποσά τα κρατάμε ασφαλή μέσα στην εφαρμογή· με ένα κλικ τα βλέπεις όλα μαζί.`)
        + bullets([
            'Τα ενοίκια που εισπράχθηκαν και όσα εκκρεμούν, ανά ακίνητο.',
            'Η πληρότητα του χαρτοφυλακίου σου και πώς κινήθηκε μέσα στον μήνα.',
            'Οι επερχόμενες υποχρεώσεις, για να μη σε προλάβει καμία προθεσμία.',
            'Πιθανές εξοικονομήσεις που εντοπίσαμε στα έξοδά σου.',
          ])
        + button('Δες τον μηνιαίο απολογισμό', dash(c))
        + note('Στέλνουμε αυτή τη σύνοψη μία φορά τον μήνα και σεβόμαστε τις ώρες ησυχίας σου. Μπορείς να αλλάξεις τη συχνότητα όποτε θες από τις ρυθμίσεις.'),
    }) }
  },
}
