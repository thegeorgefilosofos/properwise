import { emailShell, eyebrow, h, p, button, greeting, note, heroStat } from '../emailTemplates.ts'
import { eur } from '../format.ts'
import { dash, esc, has, plural, NOTE, type CopyFn } from './kit.ts'

// ── Φάση 9: Βραχυχρόνια μίσθωση (Short-term operations) ───────────────────────
export const SHORTTERM: Record<string, CopyFn> = {

  // 63. Άφιξη επισκέπτη σήμερα
  checkin_today: (c) => {
    const g = c.guestName ? esc(c.guestName) : '';
    const ref = c.propertyName ? ` στο «${esc(c.propertyName)}»` : '';
    const when = c.checkinDate ? ` (${esc(c.checkinDate)})` : '';
    return { subject: 'Άφιξη επισκέπτη σήμερα', html: emailShell({
      preheader: 'Όλα έτοιμα για την υποδοχή.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Βραχυχρόνια') + h('Έχεις άφιξη σήμερα') + greeting(c.name)
        + p(`${g ? `Άφιξη: <b>${g}</b>` : 'Έχεις άφιξη'}${ref}${when}. Βεβαιώσου ότι το ακίνητο είναι έτοιμο, τα κλειδιά ή ο κωδικός διαθέσιμα και οι οδηγίες σταλμένες.`)
        + button('Δες την κράτηση', dash(c))
        + note('Καλή φιλοξενία. Μια καλή υποδοχή φέρνει καλές αξιολογήσεις.'),
    }) };
  },

  // 64. Αναχώρηση επισκέπτη σήμερα
  checkout_today: (c) => {
    const g = c.guestName ? esc(c.guestName) : '';
    const ref = c.propertyName ? ` στο «${esc(c.propertyName)}»` : '';
    return { subject: 'Αναχώρηση επισκέπτη σήμερα', html: emailShell({
      preheader: 'Ώρα για καθαρισμό και επόμενη κράτηση.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Βραχυχρόνια') + h('Έχεις αναχώρηση σήμερα') + greeting(c.name)
        + p(`${g ? `Αναχώρηση: <b>${g}</b>` : 'Έχεις αναχώρηση'}${ref}. Καλή στιγμή να προγραμματίσεις τον καθαρισμό, να ελέγξεις το ακίνητο και να ζητήσεις αξιολόγηση.`)
        + button('Δες την κράτηση', dash(c))
        + note('Ένας γρήγορος έλεγχος τώρα κρατά το ακίνητο έτοιμο για την επόμενη άφιξη.'),
    }) };
  },

  // 65. Προγραμματισμένος καθαρισμός (turnover)
  cleaning_scheduled: (c) => {
    const ref = c.propertyName ? ` στο «${esc(c.propertyName)}»` : '';
    const when = c.cleaningDate ? ` στις <b>${esc(c.cleaningDate)}</b>` : '';
    return { subject: 'Προγραμματισμένος καθαρισμός', html: emailShell({
      preheader: 'Το ακίνητο έτοιμο για την επόμενη κράτηση.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Βραχυχρόνια') + h('Ο καθαρισμός είναι προγραμματισμένος') + greeting(c.name)
        + p(`Ο καθαρισμός${ref}${when} είναι στο πρόγραμμα. Θα σου θυμίσουμε λίγο πριν, ώστε το ακίνητο να είναι πάντα έτοιμο για την επόμενη άφιξη.`)
        + button('Δες το ημερολόγιο', dash(c))
        + note(NOTE.ahead),
    }) };
  },

  // 66. Κενές νύχτες, ευκαιρία πλήρωσης
  occupancy_gap: (c) => {
    const ref = c.propertyName ? ` στο «${esc(c.propertyName)}»` : '';
    const gap = has(c.gapNights) ? plural(c.gapNights, 'κενή νύχτα', 'κενές νύχτες') : 'κενές νύχτες';
    const span = [c.gapFrom && esc(c.gapFrom), c.gapTo && esc(c.gapTo)].filter(Boolean).join(' έως ');
    return { subject: 'Κενές νύχτες, ευκαιρία για πλήρωση', html: emailShell({
      preheader: 'Μια μικρή προσαρμογή τιμής μπορεί να τις γεμίσει.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Πληρότητα') + h('Υπάρχει χώρος για πλήρωση') + greeting(c.name)
        + p(`Εντοπίσαμε <b>${gap}</b>${ref}${span ? ` (${span})` : ''}. Μια στοχευμένη προσαρμογή τιμής ή μια μικρή προσφορά συχνά αρκεί για να γεμίσουν.`)
        + p('Το PROPERWISE σου προτείνει τιμή με βάση τη ζήτηση και τη σεζόν.')
        + button('Δες τις προτάσεις τιμής', dash(c))
        + note(NOTE.ahead),
    }) };
  },

  // 67. Αίτημα αξιολόγησης μετά τη διαμονή
  review_request: (c) => {
    const g = c.guestName ? ` (${esc(c.guestName)})` : '';
    const ref = c.propertyName ? ` στο «${esc(c.propertyName)}»` : '';
    return { subject: 'Ζήτα μια αξιολόγηση, όσο είναι φρέσκια', html: emailShell({
      preheader: 'Οι καλές κριτικές φέρνουν τις επόμενες κρατήσεις.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Αξιολογήσεις') + h('Μια καλή κριτική αξίζει') + greeting(c.name)
        + p(`Μια διαμονή${ref} μόλις ολοκληρώθηκε${g}. Όσο η εμπειρία είναι φρέσκια, μια ευγενική υπενθύμιση για αξιολόγηση φέρνει τα καλύτερα αποτελέσματα.`)
        + button('Στείλε το αίτημα', dash(c))
        + note('Οι αξιολογήσεις χτίζουν την κατάταξή σου και τις επόμενες κρατήσεις.'),
    }) };
  },

  // 68. Είσπραξη από πλατφόρμα (payout)
  payout_received: (c) => {
    const ref = c.propertyName ? ` για το «${esc(c.propertyName)}»` : '';
    const amt = has(c.amount) ? `<b>${eur(c.amount)}</b>` : 'Μια πληρωμή';
    return { subject: 'Μπήκε μια πληρωμή από κράτηση', html: emailShell({
      preheader: 'Καταγράφηκε στα έσοδά σου.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Εισπράξεις') + h('Μπήκε μια πληρωμή') + greeting(c.name)
        + p(`${amt}${ref} καταγράφηκε ως έσοδο από βραχυχρόνια μίσθωση. Η εικόνα των εσόδων σου ενημερώθηκε αυτόματα.`)
        + button('Δες τα έσοδα', dash(c))
        + note(NOTE.autolog),
    }) };
  },

  // 69. Απολογισμός σεζόν βραχυχρόνιων
  str_season_recap: (c) => {
    const bits: string[] = [];
    if (has(c.collected)) bits.push(`έσοδα <b>${eur(c.collected)}</b>`);
    if (has(c.occupancy)) bits.push(`πληρότητα <b>${esc(String(c.occupancy))}%</b>`);
    if (has(c.reviewsCount)) bits.push(`<b>${plural(c.reviewsCount, 'αξιολόγηση', 'αξιολογήσεις')}</b>`);
    const line = bits.length
      ? p(`Η σεζόν έκλεισε με ${bits.join(', ')}${has(c.rating) ? ` και μέση βαθμολογία <b>${c.rating!.toLocaleString('el-GR')}</b>` : ''}.`)
      : p('Η σεζόν σου σε βραχυχρόνιες έκλεισε. Δες τη συνολική εικόνα, ανά ακίνητο και ανά μήνα.');
    return { subject: 'Ο απολογισμός της σεζόν σου', html: emailShell({
      preheader: 'Έσοδα, πληρότητα και αξιολογήσεις με μια ματιά.', unsubUrl: c.unsubUrl,
      hero: has(c.occupancy) ? heroStat(`${esc(String(c.occupancy))}%`, 'πληρότητα σεζόν') : (has(c.collected) ? heroStat(eur(c.collected), 'έσοδα σεζόν') : ''),
      bodyHtml: eyebrow('Απολογισμός') + h('Πώς πήγε η σεζόν') + greeting(c.name)
        + line
        + p('Σύγκρινε με πέρσι, εντόπισε τους δυνατούς σου μήνες και προγραμμάτισε την επόμενη σεζόν από τώρα.')
        + button('Δες τον απολογισμό', dash(c))
        + note('Τα δεδομένα της σεζόν σε βοηθούν να τιμολογήσεις σωστά την επόμενη.'),
    }) };
  },
}
