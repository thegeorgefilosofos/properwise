import { emailShell, eyebrow, h, p, button, greeting, note } from '../emailTemplates.ts'
import { dash, esc, type CopyFn } from './kit.ts'

// ── Φάση 5: Συστάσεις (Referral) ─────────────────────────────────────────────
export const REFERRAL: Record<string, CopyFn> = {

  // 39. Πρόσκληση στο πρόγραμμα πρόσκλησης
  referral_invite: (c) => {
    const code = c.referralCode ? p(`Ο προσωπικός σου κωδικός: <b>${esc(c.referralCode)}</b>. Μοιράσου τον με όποιον διαχειρίζεται ακίνητα.`) : '';
    const reward = c.rewardLabel ? esc(c.rewardLabel) : 'μια ανταμοιβή';
    return { subject: 'Σύστησε το PROPERWISE σε έναν ιδιοκτήτη', html: emailShell({
      preheader: 'Με κάθε ενεργή σύσταση κερδίζεις κι εσύ.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Πρόγραμμα πρόσκλησης') + h('Μοιράσου κάτι που σε βοηθά') + greeting(c.name)
        + p(`Ξέρεις κάποιον με ακίνητα που ακόμη παλεύει με σημειώσεις και αποδείξεις; Πρότεινέ του το PROPERWISE. Όταν ξεκινήσει, κερδίζεις ${reward}· εκείνος ξεκινά με τη δοκιμή, όπως κάθε νέος λογαριασμός.`)
        + code
        + button('Δες το πρόγραμμα πρόσκλησης', dash(c))
        + note('Η ανταμοιβή κατοχυρώνεται μόλις ο νέος ιδιοκτήτης προσθέσει ακίνητο και σαρώσει το πρώτο του έγγραφο. Πιστώνεται στη συνδρομή σου.'),
    }) };
  },

  // 40. Υπενθύμιση συστάσεων
  referral_reminder: (c) => {
    const code = c.referralCode ? p(`Ο κωδικός σου είναι πάντα εδώ: <b>${esc(c.referralCode)}</b>.`) : '';
    return { subject: 'Ο σύνδεσμος πρόσκλησής σου περιμένει', html: emailShell({
      preheader: 'Με κάθε ενεργή σύσταση κερδίζεις κι εσύ.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Πρόγραμμα πρόσκλησης') + h('Κάποιος θα σε ευγνωμονεί') + greeting(c.name)
        + p('Οι καλύτερες συστάσεις έρχονται από ανθρώπους που εμπιστευόμαστε. Αν το PROPERWISE σου έκανε τη ζωή πιο εύκολη, ίσως κάνει το ίδιο και σε κάποιον δικό σου.')
        + code
        + button('Στείλε μια πρόσκληση', dash(c))
        + note('Κρατάμε για σένα την ανταμοιβή κάθε ενεργής σύστασης.'),
    }) };
  },

  // 41. Η ανταμοιβή σου είναι έτοιμη
  referral_reward: (c) => {
    const reward = c.rewardLabel ? `<b>${esc(c.rewardLabel)}</b>` : 'Η ανταμοιβή σου';
    const who = c.friendName ? ` Χάρη στη σύστασή σου, ${esc(c.friendName)} ξεκίνησε με το PROPERWISE.` : '';
    return { subject: 'Η ανταμοιβή σου είναι έτοιμη', html: emailShell({
      preheader: 'Ευχαριστούμε που μας συστήνεις.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Ανταμοιβή') + h('Κέρδισες και σε ευχαριστούμε') + greeting(c.name)
        + p(`${reward} μόλις προστέθηκε στον λογαριασμό σου.${who}`)
        + p('Κάθε σύσταση χτίζει μια κοινότητα ανθρώπων που θέλουν τα ακίνητά τους σε τάξη. Χαιρόμαστε που είσαι μέρος της.')
        + button('Δες την ανταμοιβή σου', dash(c))
        + note('Θες να συνεχίσεις; Ο σύνδεσμός σου είναι πάντα διαθέσιμος.'),
    }) };
  },

  // 42. Ο προσκεκλημένος σου ενεργοποιήθηκε
  referral_friend_activated: (c) => {
    const who = c.friendName ? esc(c.friendName) : 'Ένα άτομο';
    const reward = c.rewardLabel ? ` Η ανταμοιβή σου, ${esc(c.rewardLabel)}, έρχεται.` : '';
    return { subject: 'Η σύστασή σου μόλις ενεργοποιήθηκε', html: emailShell({
      preheader: 'Καλά νέα από την πρόσκλησή σου.',
      unsubUrl: c.unsubUrl,
      bodyHtml: eyebrow('Πρόγραμμα πρόσκλησης') + h('Μια καλή είδηση') + greeting(c.name)
        + p(`${who} ξεκίνησε ενεργά με το PROPERWISE χάρη σε σένα.${reward}`)
        + p('Μια σύσταση σαν τη δική σου αξίζει πολλά για εμάς. Ευχαριστούμε που μοιράζεσαι κάτι που σε βοηθά.')
        + button('Δες τις συστάσεις σου', dash(c))
        + note('Μπορείς να προτείνεις το PROPERWISE σε όσους θέλεις.'),
    }) };
  },
}
