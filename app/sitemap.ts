import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/core/site'
import { LISTED_GUIDES, GUIDES_UPDATED } from './odigos/guides'
import { PAGE_UPDATED, TOOLS_UPDATED, type DatedPage } from './pageUpdated'
import { TOOLS_HUB } from '@/lib/core/publicTools'

// Χάρτης της δημόσιας σελίδας για τις μηχανές αναζήτησης. Μόνο δημόσιες
// διαδρομές: το dashboard, τα portals και οι σελίδες με token μένουν εκτός.
//
// ΚΑΘΕ ΓΡΑΜΜΗ ΜΕ ΗΜΕΡΟΜΗΝΙΑ ΠΟΥ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ (13.10.2026). Εδώ ζούσαν
// με το χέρι το `TOOLS_UPDATED`, το `PAGES_UPDATED` και τρεις ακόμη σταθερές.
// Οι υπολογιστές έγραφαν στη σελίδα «Τελευταία ενημέρωση 26/08/2026» και ο
// χάρτης 2026-09-25· το «Ποιοι είμαστε» «Έκδοση 04/10/2026» και ο χάρτης
// 2026-10-03. Η ημερομηνία κάθε σελίδας ζει πλέον σε ΕΝΑ σημείο, το ίδιο που
// διαβάζει και η σελίδα: app/pageUpdated.ts για τις σελίδες, app/odigos/guides.ts
// για τους οδηγούς. Το `lastModified` είναι το μόνο σήμα του χάρτη που διαβάζει
// η Google (`changeFrequency` και `priority` τα αγνοεί).
const at = (path: DatedPage) => ({ url: SITE + (path === '/' ? '' : path), lastModified: PAGE_UPDATED[path] })

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE
  return [
    { ...at('/'), changeFrequency: 'weekly', priority: 1 },
    // Δωρεάν εργαλείο χωρίς εγγραφή. Υψηλή προτεραιότητα επειδή είναι η μόνη
    // σελίδα που απαντά σε ερώτηση που ο ιδιοκτήτης ψάχνει ΠΡΙΝ μας ξέρει.
    { ...at('/ypologismos-forou-enoikion'), changeFrequency: 'monthly', priority: 0.9 },
    { ...at('/ypologismos-enfia'), changeFrequency: 'monthly', priority: 0.9 },
    { ...at('/vraxyxronia-i-makroxronia'), changeFrequency: 'monthly', priority: 0.9 },
    { ...at('/kathari-apodosi'), changeFrequency: 'monthly', priority: 0.9 },
    { ...at('/anaprosarmogi-enoikiou'), changeFrequency: 'monthly', priority: 0.9 },
    { ...at('/ypologismos-stegastikou-daneiou'), changeFrequency: 'monthly', priority: 0.9 },
    { ...at('/sygkrisi-timologion-revmatos'), changeFrequency: 'monthly', priority: 0.9 },
    // Κόμβος εργαλείων (27.10.2026): όλοι οι υπολογιστές ανά θέμα, ο μεσαίος
    // κρίκος της διαδρομής τους. Ημερομηνία η νεότερη των υπολογιστών του.
    { url: base + TOOLS_HUB.href, lastModified: TOOLS_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    // Κόμβος οδηγών: η μία σελίδα που μαζεύει όλους τους οδηγούς, συνδεδεμένη
    // από το υποσέλιδο κάθε δημόσιας σελίδας. Η ημερομηνία του είναι η πιο
    // πρόσφατη των οδηγών του, αφού αυτούς δείχνει.
    { url: `${base}/odigos`, lastModified: GUIDES_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    // Οδηγοί-πυλώνες: εξηγούν τον κανόνα και δένουν με τον υπολογιστή. Χτίζουν
    // topical authority (βλ. docs/marketing/seo-strategy). Η ΗΜΕΡΟΜΗΝΙΑ ΕΙΝΑΙ
    // ΤΟ ΜΟΝΟ ΣΗΜΑ ΠΟΥ ΔΙΑΒΑΖΕΙ Η GOOGLE: το `changeFrequency` και το
    // `priority` τα αγνοεί, το `lastModified` όχι. Έρχεται από τον ίδιο
    // κατάλογο που τυπώνει την ημερομηνία στον οδηγό.
    //
    // ΜΟΝΟ ΟΙ ΟΔΗΓΟΙ ΤΟΥ ΚΟΜΒΟΥ (27.10.2026). Ο χάρτης έπαιρνε το πλήρες `GUIDES`
    // και έδινε στη Google οδηγό που ο κόμβος έκρυβε, εν αναμονή νομικού
    // ελέγχου. Ο οδηγός εκτός καταλόγου λέει και `noindex` (app/publicMetadata.ts).
    ...LISTED_GUIDES.map(g => ({ url: base + g.href, lastModified: g.updated, changeFrequency: 'monthly' as const, priority: 0.8 })),
    // Τι περιλαμβάνει κάθε πακέτο: η ερώτηση που κάνει ο επισκέπτης ΠΡΙΝ
    // εγγραφεί, οπότε η απάντηση δεν ζει πίσω από τη σύνδεση.
    { ...at('/paketa'), changeFrequency: 'monthly', priority: 0.8 },
    // Για λογιστές: ο άλλος άνθρωπος του φακέλου. Απαντά σε αναζήτηση που κάνει
    // ο λογιστής, όχι ο ιδιοκτήτης, οπότε ζει ανοιχτή όπως τα πακέτα.
    { ...at('/logistes'), changeFrequency: 'monthly', priority: 0.7 },
    { ...at('/signup'), changeFrequency: 'monthly', priority: 0.8 },
    // Η ΣΥΝΔΕΣΗ ΒΓΗΚΕ. Ο χάρτης λέει «ευρετηρίασε αυτό» και η ίδια η σελίδα
    // λέει πλέον `noindex`: δύο αντικρουόμενα σήματα για το ίδιο πράγμα. Η
    // φόρμα εισόδου δεν είναι απάντηση σε καμία αναζήτηση — όποιος ψάχνει το
    // όνομα πρέπει να φτάνει στην αρχική.
    { ...at('/trust'), changeFrequency: 'monthly', priority: 0.6 },
    { ...at('/privacy'), changeFrequency: 'yearly', priority: 0.3 },
    { ...at('/terms'), changeFrequency: 'yearly', priority: 0.3 },
  ]
}
