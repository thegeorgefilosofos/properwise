import { emailShell, eyebrow, h, p, button, greeting, note, heroStat } from '../emailTemplates.ts'
import { dash, NOTE, type CopyFn, offer, codeLine } from './kit.ts'

// ── Φάση 4: Εποχικές καμπάνιες ───────────────────────────────────────────────
export const SEASONAL: Record<string, CopyFn> = {

  // 33. Black Friday
  black_friday: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: `Black Friday: ${o.pct}% στο PROPERWISE`, html: emailShell({
      preheader: 'Η προσφορά της Black Friday.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'έκπτωση'),
      bodyHtml: eyebrow('Black Friday') + h('Μία φορά τον χρόνο') + greeting(c.name)
        + p(`Για τη Black Friday, ξεκλείδωσε το πλήρες PROPERWISE με <b>${o.pct}%</b> έκπτωση και μπες στη νέα χρονιά με τα ακίνητά σου σε τάξη.`)
        + codeLine(o)
        + button(`Κλείσε το ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) };
  },

  // 34. Cyber Monday
  cyber_monday: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: `Cyber Monday: ${o.pct}% στο PROPERWISE`, html: emailShell({
      preheader: 'Η προσφορά της Cyber Monday.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'έκπτωση'),
      bodyHtml: eyebrow('Cyber Monday') + h('Μία μέρα, μία ευκαιρία') + greeting(c.name)
        + p(`Αν περίμενες την κατάλληλη στιγμή, αυτή είναι: το πλήρες PROPERWISE με <b>${o.pct}%</b> έκπτωση.`)
        + codeLine(o)
        + button(`Κλείσε το ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) };
  },

  // 35. Χριστούγεννα
  christmas: (c) => {
    const o = offer(c)
    return { subject: 'Κλείσε τη χρονιά με τα ακίνητά σου σε τάξη', html: emailShell({
      preheader: o ? 'Ένα δώρο για τη νέα σου χρονιά.' : 'Καλές γιορτές από το PROPERWISE.',
      unsubUrl: c.unsubUrl,
      ...(o ? { hero: heroStat(`${o.pct}%`, 'δώρο γιορτών') } : {}),
      bodyHtml: eyebrow('Χριστούγεννα') + h('Καλές γιορτές από το PROPERWISE') + greeting(c.name)
        + p('Ευχαριστούμε που μας εμπιστεύτηκες τα ακίνητά σου φέτος. Σου ευχόμαστε γιορτές με ηρεμία και μια νέα χρονιά με καθαρά βιβλία.')
        + (o ? p(`Ως δώρο, ξεκλείδωσε το πλήρες PROPERWISE με <b>${o.pct}%</b> έκπτωση και ξεκίνα τη χρονιά χωρίς εκκρεμότητες.`) + codeLine(o) : '')
        + button(o ? `Κλείσε το ${o.pct}%` : 'Άνοιξε το PROPERWISE', dash(c))
        + note(o ? NOTE.cancel : NOTE.dataOwn),
    }) };
  },

  // 36. Πρωτοχρονιά
  new_year: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: 'Νέα χρονιά, καθαρά βιβλία', html: emailShell({
      preheader: 'Ξεκίνα τη χρονιά με καθαρά βιβλία.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'έκπτωση'),
      bodyHtml: eyebrow('Πρωτοχρονιά') + h('Μια καθαρή αρχή για τα ακίνητά σου') + greeting(c.name)
        + p('Η αρχή της χρονιάς είναι καλή αφετηρία για τα ακίνητά σου. Έσοδα, έξοδα και φόροι, από την πρώτη μέρα στη θέση τους.')
        + p(`Για την αρχή, κρατάμε για σένα <b>${o.pct}%</b> έκπτωση στην αναβάθμιση.`)
        + codeLine(o)
        + button(`Ξεκίνα με ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) };
  },

  // 37. Φορολογική σεζόν
  tax_season: (c) => {
    const o = offer(c)
    return { subject: 'Μπες στη φορολογική σεζόν χωρίς άγχος', html: emailShell({
      preheader: 'Τα ενοίκιά σου, έτοιμα για το Ε2.',
      unsubUrl: c.unsubUrl,
      ...(o ? { hero: heroStat(`${o.pct}%`, 'έκπτωση') } : {}),
      bodyHtml: eyebrow('Φορολογική σεζόν') + h('Η δήλωση χωρίς τρέξιμο') + greeting(c.name)
        + p('Η περίοδος των δηλώσεων πλησιάζει. Με το PROPERWISE, τα ενοίκια ανά ακίνητο συγκεντρώνονται μόνα τους και το Ε2 ετοιμάζεται χωρίς άγχος τελευταίας στιγμής.')
        + (o ? p(`Για τη σεζόν, η συνδρομή έχει <b>${o.pct}%</b> έκπτωση.`) + codeLine(o) : '')
        + button(o ? `Ετοιμάσου με ${o.pct}%` : 'Δες το Ε2 σου', dash(c))
        + note(NOTE.aade),
    }) };
  },

  // 38. Σεζόν βραχυχρόνιων μισθώσεων
  summer_str: (c) => {
    const o = offer(c)
    if (!o) return null
    return { subject: 'Η σεζόν των βραχυχρόνιων ξεκινά', html: emailShell({
      preheader: 'Κρατήσεις, έσοδα και ημερολόγιο μαζί.',
      unsubUrl: c.unsubUrl,
      hero: heroStat(`${o.pct}%`, 'έκπτωση'),
      bodyHtml: eyebrow('Καλοκαιρινή σεζόν') + h('Η σεζόν ξεκινά. Πάμε μαζί') + greeting(c.name)
        + p('Το καλοκαίρι φέρνει κρατήσεις, εναλλαγές επισκεπτών και έξοδα που τρέχουν. Το PROPERWISE συγχρονίζει Airbnb και Booking, καταγράφει τα έσοδα και κρατά καθαρό το ημερολόγιό σου.')
        + p(`Μπες στη σεζόν οργανωμένα, με <b>${o.pct}%</b> έκπτωση στην αναβάθμιση.`)
        + codeLine(o)
        + button(`Ξεκίνα με ${o.pct}%`, dash(c))
        + note(NOTE.cancel),
    }) };
  },
}
