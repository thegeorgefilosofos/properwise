import { emailShell, eyebrow, h, p, bullets, button, greeting, note, heroStat } from '../emailTemplates.ts'
import { eur } from '../format.ts'
import { dash, esc, has, plural, NOTE, type CopyFn } from './kit.ts'

// ── Φάση 10: Προϊόν & Εξέλιξη (Product, evolution, value) ─────────────────────
// Ο πυρήνας της αφοσίωσης: δείχνουν έναν ζωντανό οργανισμό που δεν σταματά να
// βελτιώνεται, ώστε ο χρήστης να νιώθει ότι διάλεξε προϊόν που εξελίσσεται.
export const PRODUCT: Record<string, CopyFn> = {

  // 70. Κυκλοφορία νέας δυνατότητας
  feature_launch: (c) => {
    const name = c.featureName ? esc(c.featureName) : 'Μια νέα δυνατότητα';
    const benefit = c.featureBenefit ? p(esc(c.featureBenefit)) : '';
    return { subject: c.featureName ? `Νέο: ${esc(c.featureName)}` : 'Κάτι νέο σε περιμένει', html: emailShell({
      preheader: 'Φτιαγμένο για να σου γλιτώνει χρόνο.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Νέα δυνατότητα') + h(name) + greeting(c.name)
        + p('Δεν σταματάμε να βελτιώνουμε το PROPERWISE. Να η τελευταία προσθήκη, φτιαγμένη πάνω σε αυτά που ζητάς.')
        + benefit
        + button('Δοκίμασέ το τώρα', dash(c))
        + note('Κάθε βελτίωση έρχεται χωρίς επιπλέον κόστος, ως μέρος του PROPERWISE.'),
    }) };
  },

  // 71. Αναβάθμιση της Νόας
  // ΜΟΝΟ ΜΕ ΣΥΓΚΕΚΡΙΜΕΝΗ ΙΚΑΝΟΤΗΤΑ. Το «καταλαβαίνει καλύτερα, πιο ακριβείς
  // απαντήσεις» δεν μετριέται από πουθενά· χωρίς `assistantSkill` δεν στέλνεται.
  assistant_upgraded: (c) => {
    if (!c.assistantSkill) return null;
    return { subject: 'Νέα ικανότητα για τη Νόα', html: emailShell({
      preheader: 'Τι νέο μπορείς να ρωτήσεις.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Νόα') + h('Έμαθε κάτι καινούριο') + greeting(c.name)
        + p(`Νόα απαντά πλέον και σε αυτό: ${esc(c.assistantSkill)}.`)
        + button('Ρώτα τη Νόα', dash(c))
        + note('Όσο περισσότερα στοιχεία καταχωρείς, τόσο πιο συγκεκριμένες γίνονται οι απαντήσεις.'),
    }) };
  },

  // 71β. Νόα σε δράση (φωνή, δεδομένα, ενέργειες)
  assistant_showcase: (c) => {
    return { subject: 'Νόα κάνει τη δουλειά', html: emailShell({
      preheader: 'Ρώτα, καταχώρησε, προγραμμάτισε, όλα με τη φωνή.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Νόα') + h('Πες τι θες και γίνεται') + greeting(c.name)
        + p('Νόα απαντά, καταχωρεί, υπολογίζει και προγραμματίζει για σένα, με τα δικά σου δεδομένα, στα ελληνικά, με τη φωνή σου.')
        + bullets([
            '«Πόσο φόρο θα πληρώσω φέτος;» και απαντά με τα δικά σου δεδομένα.',
            '«Κλείσε ραντεβού με τον υδραυλικό την Τρίτη στις 6» και μπαίνει στο ημερολόγιο.',
            '«Καταχώρησε την είσπραξη του Κολωνακίου» και γίνεται στη στιγμή.',
          ])
        + button('Μίλα στη Νόα', dash(c))
        + note('Ξέρει τα ακίνητά σου και είναι εκεί όποτε το χρειαστείς.'),
    }) };
  },

  // 72. Μηνιαίο changelog βελτιώσεων
  changelog_monthly: (c) => {
    const body = c.summaryText ? p(esc(c.summaryText)) : p('Αυτόν τον μήνα προσθέσαμε νέες δυνατότητες, φτιάξαμε λεπτομέρειες και κάναμε το PROPERWISE πιο γρήγορο. Όλα με έναν στόχο: να σου γλιτώνουμε χρόνο.');
    return { subject: 'Τι φτιάξαμε αυτόν τον μήνα', html: emailShell({
      preheader: 'Οι βελτιώσεις του μήνα, με μια ματιά.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Ενημέρωση προϊόντος') + h('Ένας μήνας βελτιώσεων') + greeting(c.name)
        + p('Δουλεύουμε κάθε μέρα ώστε το PROPERWISE να γίνεται καλύτερο. Να τι άλλαξε τον τελευταίο μήνα:')
        + body
        + button('Δες τι νέο υπάρχει', dash(c))
        + note('Κάθε βελτίωση είναι ήδη διαθέσιμη, χωρίς επιπλέον κόστος.'),
    }) };
  },

  // 73. Προεπισκόπηση roadmap
  roadmap_preview: (c) => {
    const body = c.summaryText ? p(esc(c.summaryText)) : p('Ετοιμάζουμε νέες δυνατότητες για τη διαχείριση, τη λογιστική και τη Νόα. Θέλουμε τη γνώμη σου, ώστε να χτίσουμε πρώτα αυτά που σε βοηθούν περισσότερο.');
    return { subject: 'Τι ετοιμάζουμε στη συνέχεια', html: emailShell({
      preheader: 'Μια ματιά σε αυτά που έρχονται.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Τι έρχεται') + h('Μια ματιά στο μέλλον του PROPERWISE') + greeting(c.name)
        + body
        + p('Ποιο θα σε βοηθούσε πιο πολύ; Απάντησε σε αυτό το μήνυμα και θα το λάβουμε σοβαρά υπόψη.')
        + button('Πες μας τη γνώμη σου', dash(c))
        + note(NOTE.reply),
    }) };
  },

  // 74. Επέτειος συνεργασίας
  anniversary: (c) => {
    const yrs = has(c.anniversaryYears) ? plural(c.anniversaryYears, 'χρόνο', 'χρόνια') : 'έναν χρόνο';
    const proof = has(c.collected) ? p(`Μαζί οργανώσαμε <b>${eur(c.collected)}</b> σε εισπράξεις και αμέτρητες εκκρεμότητες που δεν χρειάστηκε να σε απασχολήσουν.`) : '';
    return { subject: (has(c.anniversaryYears) && c.anniversaryYears > 1) ? `Κλείνουμε ${c.anniversaryYears} χρόνια μαζί` : 'Κλείνουμε έναν χρόνο μαζί', html: emailShell({
      preheader: 'Ευχαριστούμε που μας εμπιστεύεσαι.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Επέτειος') + h((has(c.anniversaryYears) && c.anniversaryYears > 1) ? `${c.anniversaryYears} χρόνια μαζί` : 'Ένας χρόνος μαζί') + greeting(c.name)
        + p(`Συμπληρώνεις ${yrs} με το PROPERWISE και θέλουμε απλώς να πούμε ένα ειλικρινές ευχαριστώ.`)
        + proof
        + p('Δεσμευόμαστε να συνεχίσουμε να βελτιωνόμαστε, ώστε τα ακίνητά σου να είναι πάντα υπό έλεγχο.')
        + button('Δες τη χρονιά σου', dash(c))
        + note('Είμαστε εδώ για τα επόμενα πολλά.'),
    }) };
  },

  // 75. Επίτευξη οροσήμου
  milestone_reached: (c) => {
    const what = has(c.collected)
      ? `<b>${eur(c.collected)}</b> σε οργανωμένες εισπράξεις`
      : (has(c.properties) ? `<b>${plural(c.properties, 'ακίνητο', 'ακίνητα')}</b> υπό διαχείριση` : 'ένα σημαντικό ορόσημο');
    return { subject: 'Ένα ορόσημο που αξίζει αναγνώριση', html: emailShell({
      preheader: 'Μικρές κινήσεις, μεγάλα αποτελέσματα.', unsubUrl: c.unsubUrl,
      hero: has(c.collected) ? heroStat(eur(c.collected), 'οργανωμένες εισπράξεις') : (has(c.properties) ? heroStat(`${c.properties}`, c.properties === 1 ? 'ακίνητο υπό διαχείριση' : 'ακίνητα υπό διαχείριση') : ''),
      bodyHtml: eyebrow('Ορόσημο') + h('Έφτασες κάπου που μετράει') + greeting(c.name)
        + p(`Μόλις πέρασες ${what} μέσα από το PROPERWISE. Πίσω από αυτό το δεδομένο κρύβονται ώρες που κέρδισες και εκκρεμότητες που δεν σε απασχόλησαν.`)
        + button('Δες την πρόοδό σου', dash(c))
        + note('Κάθε καταχώρηση μετράει. Συνέχισε έτσι.'),
    }) };
  },

  // 76. Έρευνα NPS
  nps_survey: (c) => ({
    subject: 'Θα μας πρότεινες σε έναν φίλο;',
    html: emailShell({
      preheader: 'Μισό λεπτό, μεγάλη αξία για εμάς.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Η γνώμη σου') + h('Μια ερώτηση, ειλικρινά') + greeting(c.name)
        + p('Σε μια κλίμακα από το 0 ως το 10, πόσο πιθανό είναι να πρότεινες το PROPERWISE σε κάποιον με ακίνητα;')
        + p('Η απάντησή σου μας δείχνει πού τα πάμε καλά και πού έχουμε δρόμο ακόμη. Τη διαβάζουμε, μία μία.')
        + button('Δώσε την απάντησή σου', dash(c))
        + note(NOTE.reply),
    }),
  }),

  // 77. Συμβουλή της εβδομάδας (αξία)
  // 76β. Μηνιαία παρότρυνση feedback (ήπια υπενθύμιση)
  // ΧΩΡΙΣ ΚΛΗΡΩΣΗ. Υποσχόταν «έναν χρόνο δωρεάν πακέτο» χωρίς δημοσιευμένους
  // όρους, χωρίς διοργανωτή με ταυτότητα και χωρίς ενεργή χρέωση. Κλήρωση
  // ξαναμπαίνει μόνο με όρους και ταυτότητα· το κλειδί του μηνύματος μένει.
  feedback_lottery: (c) => ({
    subject: 'Ένα λεπτό για τη γνώμη σου',
    html: emailShell({
      preheader: 'Τρεις ερωτήσεις, ένα λεπτό.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Η γνώμη σου') + h('Πες μας τη γνώμη σου') + greeting(c.name)
        + p('Είδαμε ότι δεν έχεις μοιραστεί ακόμη τη γνώμη σου. Αφιέρωσε μόλις ένα λεπτό να μας πεις τις σκέψεις, τις ιδέες και την άποψή σου για το PROPERWISE.')
        + bullets([
            'Τι θεωρείς ότι κάνουμε καλά;',
            'Πού χρειάζεται να βελτιωθούμε;',
            'Τι θα πρότεινες να προσθέσουμε;',
          ])
        + p('Κάθε απάντηση τη διαβάζει άνθρωπος.')
        + button('Πες μας τη γνώμη σου', dash(c))
        + note(NOTE.reply),
    }),
  }),

  // 77. Συμβουλή της εβδομάδας (αξία)
  best_practice_tip: (c) => {
    const tip = c.summaryText ? p(esc(c.summaryText)) : p('Κράτα ξεχωριστό λογαριασμό για κάθε ακίνητο. Έτσι, τα έσοδα και τα έξοδα ξεκαθαρίζουν μόνα τους και η φορολογική εικόνα βγαίνει με ακρίβεια.');
    return { subject: c.headline ? esc(c.headline) : 'Η συμβουλή της εβδομάδας', html: emailShell({
      preheader: 'Μια μικρή κίνηση με μεγάλη διαφορά.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Συμβουλή') + h(c.headline ? esc(c.headline) : 'Μια συμβουλή που πιάνει τόπο') + greeting(c.name)
        + tip
        + button('Εφάρμοσέ το στο PROPERWISE', dash(c))
        + note('Κάθε εβδομάδα, μια πρακτική ιδέα για να αξιοποιείς καλύτερα τα ακίνητά σου.'),
    }) };
  },

  // 78. Πρόσκληση σε webinar
  // ΜΟΝΟ ΜΕ ΗΜΕΡΟΜΗΝΙΑ. Πρόσκληση χωρίς εκδήλωση ήταν υπόσχεση χωρίς αντίκρισμα.
  webinar_invite: (c) => {
    if (!c.appointmentDate) return null;
    const title = c.headline ? esc(c.headline) : 'Συνάντηση για ιδιοκτήτες ακινήτων';
    const when = [esc(c.appointmentDate), c.appointmentTime && esc(c.appointmentTime)].filter(Boolean).join(', ');
    return { subject: 'Πρόσκληση σε συνάντηση για ιδιοκτήτες', html: emailShell({
      preheader: `${when}. Κράτησε τη θέση σου.`, unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Εκδήλωση') + h(title) + greeting(c.name)
        + p(`Σε προσκαλούμε σε μια πρακτική συνάντηση για ιδιοκτήτες και διαχειριστές ακινήτων, ${when}. Η συμμετοχή δεν κοστίζει.`)
        + button('Κράτησε τη θέση σου', dash(c))
        + note('Θα λάβεις τον σύνδεσμο με την εγγραφή σου.'),
    }) };
  },
}
