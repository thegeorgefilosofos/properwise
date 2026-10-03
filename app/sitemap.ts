import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/core/site'
import { GUIDES, GUIDES_UPDATED } from './odigos/guides'

// Χάρτης της δημόσιας σελίδας για τις μηχανές αναζήτησης. Μόνο δημόσιες
// διαδρομές: το dashboard, τα portals και οι σελίδες με token μένουν εκτός.
// ΚΑΙ ΟΙ ΥΠΟΛΟΓΙΣΤΕΣ ΕΧΟΥΝ ΗΜΕΡΟΜΗΝΙΑ. Οι οδηγοί την είχαν, οι τέσσερις
// υπολογιστές όχι: για τη μηχανή αναζήτησης ήταν οι μόνες σελίδες του χάρτη
// χωρίς ένδειξη φρεσκάδας, ενώ είναι αυτές που αλλάζουν με κάθε νόμο. Η
// ημερομηνία είναι της τελευταίας ουσιαστικής αλλαγής σε κάποιον από αυτούς
// (κλίμακα, κανόνες ή πίνακες) και αλλάζει με το χέρι μαζί της, όπως το
// `updated` των οδηγών.
const TOOLS_UPDATED = '2026-09-25'
// ΚΑΙ ΟΙ ΥΠΟΛΟΙΠΕΣ ΣΕΛΙΔΕΣ. Αρχική, πακέτα, εγγραφή, εμπιστοσύνη και νομικά
// κείμενα ήταν χωρίς ημερομηνία: η μηχανή αναζήτησης δεν είχε τρόπο να ξέρει
// πότε άλλαξαν. Ίδιος κανόνας με τα παραπάνω: η μέρα που η ουσιαστική αλλαγή
// βγήκε στον αέρα, γραμμένη με το χέρι μαζί της. Όχι η σημερινή σε κάθε
// χτίσιμο: μια ημερομηνία που αλλάζει χωρίς να αλλάξει η σελίδα μαθαίνει στη
// μηχανή να την αγνοεί.
const PAGES_UPDATED = {
  home: '2026-10-03',
  paketa: '2026-10-03',
  signup: '2026-10-03',
  trust: '2026-10-03',
  privacy: '2026-10-02',
  terms: '2026-10-03',
} as const
// Ο υπολογιστής δόσης στεγαστικού δεν ακολουθεί τους φόρους: αλλάζει όταν
// αλλάξει ο ίδιος, όχι όταν αλλάξει κλίμακα. Δική του ημερομηνία, με το χέρι.
// Το μέσο επιτόκιο που δείχνει έχει δική του ημερομηνία πάνω στη σελίδα.
const MORTGAGE_TOOL_UPDATED = '2026-10-03'
// Η ΣΥΓΚΡΙΣΗ ΡΕΥΜΑΤΟΣ ΕΧΕΙ ΔΙΚΗ ΤΗΣ. Αλλάζει με τον κατάλογο τιμολογίων, όχι με
// τον νόμο, οπότε η κοινή ημερομηνία των τεσσάρων θα έλεγε άλλη μέρα από την
// πραγματική. Είναι η μέρα της τελευταίας αλλαγής της σελίδας ή του καταλόγου
// που δείχνει (όποια είναι νεότερη), ISO, ποτέ μελλοντική· αλλάζει με το χέρι
// μαζί τους. Το app/publicMetadata.test.ts φυλάει και τα δύο.
const POWER_UPDATED = '2026-10-03'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE
  return [
    { url: base, lastModified: PAGES_UPDATED.home, changeFrequency: 'weekly', priority: 1 },
    // Δωρεάν εργαλείο χωρίς εγγραφή. Υψηλή προτεραιότητα επειδή είναι η μόνη
    // σελίδα που απαντά σε ερώτηση που ο ιδιοκτήτης ψάχνει ΠΡΙΝ μας ξέρει.
    { url: `${base}/ypologismos-forou-enoikion`, lastModified: TOOLS_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/ypologismos-enfia`, lastModified: TOOLS_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/vraxyxronia-i-makroxronia`, lastModified: TOOLS_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/kathari-apodosi`, lastModified: TOOLS_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/ypologismos-stegastikou-daneiou`, lastModified: MORTGAGE_TOOL_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/sygkrisi-timologion-revmatos`, lastModified: POWER_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    // Κόμβος οδηγών: η μία σελίδα που μαζεύει όλους τους οδηγούς, συνδεδεμένη
    // από το υποσέλιδο κάθε δημόσιας σελίδας. Η ημερομηνία του είναι η πιο
    // πρόσφατη των οδηγών του, αφού αυτούς δείχνει.
    { url: `${base}/odigos`, lastModified: GUIDES_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    // Οδηγοί-πυλώνες: εξηγούν τον κανόνα και δένουν με τον υπολογιστή. Χτίζουν
    // topical authority (βλ. docs/marketing/seo-strategy). Η ΗΜΕΡΟΜΗΝΙΑ ΕΙΝΑΙ
    // ΤΟ ΜΟΝΟ ΣΗΜΑ ΠΟΥ ΔΙΑΒΑΖΕΙ Η GOOGLE: το `changeFrequency` και το
    // `priority` τα αγνοεί, το `lastModified` όχι. Έρχεται από τον ίδιο
    // κατάλογο που τυπώνει την ημερομηνία στον οδηγό.
    ...GUIDES.map(g => ({ url: base + g.href, lastModified: g.updated, changeFrequency: 'monthly' as const, priority: 0.8 })),
    // Τι περιλαμβάνει κάθε πακέτο: η ερώτηση που κάνει ο επισκέπτης ΠΡΙΝ
    // εγγραφεί, οπότε η απάντηση δεν ζει πίσω από τη σύνδεση.
    { url: `${base}/paketa`, lastModified: PAGES_UPDATED.paketa, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/signup`, lastModified: PAGES_UPDATED.signup, changeFrequency: 'monthly', priority: 0.8 },
    // Η ΣΥΝΔΕΣΗ ΒΓΗΚΕ. Ο χάρτης λέει «ευρετηρίασε αυτό» και η ίδια η σελίδα
    // λέει πλέον `noindex`: δύο αντικρουόμενα σήματα για το ίδιο πράγμα. Η
    // φόρμα εισόδου δεν είναι απάντηση σε καμία αναζήτηση — όποιος ψάχνει το
    // όνομα πρέπει να φτάνει στην αρχική.
    { url: `${base}/trust`, lastModified: PAGES_UPDATED.trust, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, lastModified: PAGES_UPDATED.privacy, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: PAGES_UPDATED.terms, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
