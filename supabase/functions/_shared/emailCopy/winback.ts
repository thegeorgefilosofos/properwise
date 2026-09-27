import { emailShell, eyebrow, h, p, button, greeting, note, heroStat } from '../emailTemplates.ts'
import { eur } from '../format.ts'
import { dash, esc, has, NOTE, type CopyFn, offer, codeLine } from './kit.ts'

// ── Φάση 7: Επανενεργοποίηση & Win-back ──────────────────────────────────────
export const WINBACK: Record<string, CopyFn> = {

  // 49. Αδράνεια 30 ημερών
  inactive_30: (c) => {
    const proof = has(c.collected)
      ? p(`Έχεις ήδη οργανώσει <b>${eur(c.collected)}</b> σε εισπράξεις εδώ. Θα ήταν κρίμα να μείνει στη μέση.`)
      : p('Ξεκίνησες κάτι καλό εδώ. Θα ήταν κρίμα να μείνει στη μέση.');
    return { subject: 'Πάει καιρός. Όλα σε περιμένουν', html: emailShell({
      preheader: 'Ο λογαριασμός σου είναι ακριβώς όπως τον άφησες.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Σε σκεφτήκαμε') + h('Πάει λίγος καιρός') + greeting(c.name)
        + p('Έχουμε να σε δούμε εδώ και μερικές εβδομάδες. Τα ακίνητα, οι εισπράξεις και το ιστορικό σου είναι όλα εκεί, ακριβώς όπως τα άφησες.')
        + proof
        + button('Συνέχισε από εκεί που έμεινες', dash(c))
        + note('Αν κάτι σε εμπόδισε, απάντησε και πες μας. Θέλουμε να βοηθήσουμε.'),
    }) };
  },

  // 50. Αδράνεια 60 ημερών
  inactive_60: (c) => ({
    subject: 'Να κρατήσουμε τα δεδομένα σου ασφαλή;',
    html: emailShell({
      preheader: 'Τίποτα δεν χάνεται. Είμαστε εδώ.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Ακόμη εδώ για σένα') + h('Δεν σε ξεχάσαμε') + greeting(c.name)
        + p('Πέρασαν κάποιοι μήνες από την τελευταία σου επίσκεψη. Τα δεδομένα σου παραμένουν ασφαλή και δικά σου, όποτε αποφασίσεις να επιστρέψεις.')
        + p('Αν κάτι δεν σε κάλυψε, πες μας το. Μας βοηθά να γίνουμε καλύτεροι.')
        + button('Ρίξε μια ματιά ξανά', dash(c))
        + note(NOTE.dataOwn),
    }),
  }),

  // 51. Προσφορά επιστροφής
  winback_offer: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: `Μια αφορμή για να γυρίσεις: ${o.pct}% έκπτωση`, html: emailShell({
      preheader: 'Ξεκίνα ξανά με το πλήρες PROPERWISE.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'έκπτωση'),
      bodyHtml: eyebrow('Καλωσόρισες πίσω') + h('Ένα δώρο για την επιστροφή σου') + greeting(c.name)
        + p(`Ξέρουμε ότι η καθημερινότητα τρέχει. Αν θέλεις να ξαναβάλεις τα ακίνητά σου σε τάξη, κρατάμε για σένα <b>${o.pct}%</b> έκπτωση στην αναβάθμιση.`)
        + codeLine(o)
        + p('Ο λογαριασμός σου είναι έτοιμος, με όλα όσα άφησες στη θέση τους.')
        + button(`Κλείσε το ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) };
  },

  // 52. Έρευνα αποχώρησης
  churn_survey: (c) => ({
    subject: 'Ένα λεπτό, για να γίνουμε καλύτεροι',
    html: emailShell({
      preheader: 'Η ειλικρινής σου γνώμη μετράει.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Η γνώμη σου') + h('Τι θα σε κρατούσε;') + greeting(c.name)
        + p('Δεν σε είδαμε για καιρό και το σεβόμαστε. Πριν φύγεις εντελώς, θα θέλαμε να μάθουμε ένα πράγμα: τι έλειψε ώστε να χρησιμοποιείς το PROPERWISE;')
        + p('Μία ειλικρινής απάντηση από εσένα αξίζει όσο δέκα συναντήσεις για εμάς. Απάντησε απευθείας σε αυτό το μήνυμα.')
        + button('Πες μας τη γνώμη σου', dash(c))
        + note(NOTE.reply),
    }),
  }),

  // 84. Χρονικά οριοθετημένη διατήρηση δεδομένων (βαθιά αδρανείς)
  data_retention_notice: (c) => {
    const when = c.deadlineDate ? ` έως τις <b>${esc(c.deadlineDate)}</b>` : ' σύντομα';
    return { subject: 'Κράτησε τον λογαριασμό σου ενεργό', html: emailShell({
      preheader: 'Μια κίνηση αρκεί για να μείνουν όλα ζωντανά.', unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Ο λογαριασμός σου') + h('Ας κρατήσουμε τα δεδομένα σου ζωντανά') + greeting(c.name)
        + p(`Έχεις καιρό να συνδεθείς. Για να κρατήσεις τον λογαριασμό και το ιστορικό σου ενεργά, μπες${when}. Ένα κλικ αρκεί.`)
        + p('Τα δεδομένα σου παραμένουν δικά σου. Θέλουμε απλώς να είναι εκεί όποτε τα χρειαστείς.')
        + button('Κράτησέ τα ενεργά', dash(c))
        + note(NOTE.dataOwn),
    }) };
  },
}
