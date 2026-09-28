import {
  emailShell, eyebrow, h, p, bullets, button, greeting, note, heroStat, PACKAGE_NAME,
  PACKAGE_MAX_PROPERTIES,
} from '../emailTemplates.ts'
import { eur } from '../format.ts'
import { dash, esc, has, plural, NOTE, type CopyFn } from './kit.ts'

// ── Φάση 11: Ενίσχυση μετατροπής (Conversion, value-led) ──────────────────────
export const CONVERSION: Record<string, CopyFn> = {

  // 79. Απόδειξη αξίας (ROI)
  roi_proof: (c) => {
    // ΧΩΡΙΣ «ΩΡΕΣ ΠΟΥ ΚΕΡΔΙΣΕΣ». Καμία συνάρτηση δεν τις μετρά· ήταν στατιστικό
    // χωρίς πηγή που περίμενε να γεμίσει. Μένει μόνο ό,τι καταγράφηκε.
    const money = has(c.collected) ? p(`Παράλληλα, οργάνωσε <b>${eur(c.collected)}</b> σε εισπράξεις χωρίς να χαθεί τίποτα στη διαδρομή.`) : '';
    const fallback = !has(c.collected) ? p('Κάθε αυτόματη υπενθύμιση, κάθε έτοιμη αναφορά και κάθε καταχώρηση που δεν χρειάστηκε να κάνεις με το χέρι, είναι χρόνος που κέρδισες.') : '';
    return { subject: 'Πόσο σου απέδωσε το PROPERWISE', html: emailShell({
      preheader: 'Ο χρόνος που κέρδισες, σε δεδομένα.', unsubUrl: c.unsubUrl,
      hero: has(c.collected) ? heroStat(eur(c.collected), 'οργανωμένες εισπράξεις') : '',
      bodyHtml: eyebrow('Η αξία σου') + h('Ας δούμε τι κέρδισες') + greeting(c.name)
        + money + fallback
        + p('Με μια αναβάθμιση, αυτός ο χρόνος μεγαλώνει: περισσότεροι αυτοματισμοί, βαθύτερη ανάλυση, λιγότερος κόπος.')
        + button('Δες τι κερδίζεις παραπάνω', dash(c))
        + note(NOTE.cancel),
    }) };
  },

  // 80. Σύγκριση πακέτων για τη χρήση του χρήστη
  plan_comparison: (c) => {
    const use = has(c.properties) ? `Έχεις <b>${plural(c.properties, 'ακίνητο', 'ακίνητα')}</b> στο χαρτοφυλάκιό σου. ` : '';
    return { subject: 'Ποιο πακέτο συμφέρει για τη δική σου χρήση', html: emailShell({
      preheader: 'Μια καθαρή σύγκριση, χωρίς μικρά γράμματα.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Σύγκριση πακέτων') + h('Ας βρούμε το σωστό πακέτο για σένα') + greeting(c.name)
        + p(`${use}Αξίζει να δεις τι προσφέρει κάθε πακέτο σε σχέση με το πώς χρησιμοποιείς σήμερα το PROPERWISE.`)
        + bullets([
            'Ιδιοκτήτης: δωρεάν, 1 ακίνητο με τα φορολογικά, υπενθυμίσεις και αναφορές PDF με QR επαλήθευσης.',
            `${PACKAGE_NAME.solo}: ο ίδιος, με τη Νόα και σάρωση χωρίς όριο.`,
            `${PACKAGE_NAME.owner}: έως ${PACKAGE_MAX_PROPERTIES.owner} ακίνητα και σύγκριση ακινήτων.`,
            `${PACKAGE_NAME.agency}: έως ${PACKAGE_MAX_PROPERTIES.agency} ακίνητα, αναφορές με την επωνυμία σου, κατανομή σε συνιδιοκτήτες.`,
            `${PACKAGE_NAME.office}: απεριόριστα ακίνητα και ομάδα χωρίς όριο χρηστών.`,
          ])
        + button('Σύγκρινε τα πακέτα', dash(c))
        + note(NOTE.cancel),
    }) };
  },

  // 81. Κοινωνική απόδειξη
  social_proof: (c) => ({
    subject: 'Τι κάνει το PROPERWISE για τα ακίνητά σου',
    html: emailShell({
      preheader: 'Η δουλειά ρουτίνας, στον αυτόματο.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Γιατί PROPERWISE') + h('Φτιαγμένο για την ελληνική πραγματικότητα') + greeting(c.name)
        + p('Ενοίκια, δαπάνες, φόροι και υπενθυμίσεις, με τα δικά σου στοιχεία.')
        + bullets([
            'Ελληνικοί φόροι, ΕΝΦΙΑ και Ε2, με ενδεικτικό υπολογισμό βάσει των ισχυόντων κανόνων.',
            'Αυτόματες υπενθυμίσεις που κρατούν τις υποχρεώσεις σου μπροστά σου.',
            'Νόα, που απαντά με τα δικά σου δεδομένα.',
          ])
        + button('Δες γιατί', dash(c))
        + note(`${NOTE.aade} ${NOTE.cancel}`),
    }),
  }),

  // 85. Σύγκριση ενοικίου με την αγορά (benchmark)
  rent_benchmark_alert: (c) => {
    const ref = c.propertyName ? ` του «${esc(c.propertyName)}»` : '';
    const cmp = (has(c.amount) && has(c.marketRent))
      ? p(`Το ενοίκιο${ref} είναι <b>${eur(c.amount)}</b>, ενώ ο μέσος όρος της περιοχής κινείται γύρω στα <b>${eur(c.marketRent)}</b>. Ίσως αφήνεις έσοδα στο τραπέζι.`)
      : p(`Τα ενοίκια στην περιοχή του ακινήτου${ref} κινήθηκαν. Αξίζει να δεις αν το δικό σου παρακολουθεί την αγορά.`);
    return { subject: 'Το ενοίκιό σου σε σχέση με την αγορά', html: emailShell({
      preheader: 'Μια ματιά που μπορεί να σου αποδώσει.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Δεδομένα αγοράς') + h('Πώς στέκεται το ενοίκιό σου') + greeting(c.name)
        + cmp
        + p('Το PROPERWISE συγκρίνει το ενοίκιό σου με την αγορά και σου δείχνει πότε αξίζει μια αναπροσαρμογή, πάντα μέσα στα νόμιμα όρια.')
        + button('Δες τη σύγκριση', dash(c))
        + note(NOTE.legal),
    }) };
  },
}
