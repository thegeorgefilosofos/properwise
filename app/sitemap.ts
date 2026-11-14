import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/core/site'
import { LISTED_GUIDES, GUIDES_UPDATED } from './odigos/guides'
import { PAGE_UPDATED, TOOLS_UPDATED, type DatedPage } from './pageUpdated'
import { PUBLIC_TOOLS, TOOLS_HUB } from '@/lib/core/publicTools'
import { PROTHESMIES_PATH, PROTHESMIES_UPDATED, monthPath, upcomingMonths } from '@/lib/seo/prothesmies'
import { athensToday } from '@/lib/core/time'
import { languageAlternates } from '@/lib/i18n/paths'

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

/** Υπολογιστής του καταλόγου χωρίς ημερομηνία στο pageUpdated.ts σπάει το χτίσιμο, δεν μπαίνει «σήμερα». */
function toolPage(href: string): DatedPage {
  if (!(href in PAGE_UPDATED)) throw new Error(`${href}: ο υπολογιστής δεν έχει ημερομηνία στο app/pageUpdated.ts`)
  return href as DatedPage
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE
  const rows: MetadataRoute.Sitemap = [
    { ...at('/'), changeFrequency: 'weekly', priority: 1 },
    // ΟΙ ΥΠΟΛΟΓΙΣΤΕΣ ΑΠΟ ΤΟΝ ΚΑΤΑΛΟΓΟ (14/11/2026). Ως τώρα ήταν δέκα γραμμές με
    // το χέρι: νέος υπολογιστής στο PUBLIC_TOOLS έμπαινε στο μενού, στο
    // υποσέλιδο και στον κόμβο, αλλά όχι στον χάρτη, ώσπου να το θυμηθεί
    // κάποιος. Υψηλή προτεραιότητα επειδή απαντούν σε ερώτηση που ο ιδιοκτήτης
    // ψάχνει ΠΡΙΝ μας ξέρει. Η ημερομηνία του καθενός από το app/pageUpdated.ts.
    ...PUBLIC_TOOLS.map(t => ({ ...at(toolPage(t.href)), changeFrequency: 'monthly' as const, priority: 0.9 })),
    // Κόμβος εργαλείων (27.10.2026): όλοι οι υπολογιστές ανά θέμα, ο μεσαίος
    // κρίκος της διαδρομής τους. Ημερομηνία η νεότερη των υπολογιστών του.
    { url: base + TOOLS_HUB.href, lastModified: TOOLS_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    // Κόμβος οδηγών: η μία σελίδα που μαζεύει όλους τους οδηγούς, συνδεδεμένη
    // από το υποσέλιδο κάθε δημόσιας σελίδας. Η ημερομηνία του είναι η πιο
    // πρόσφατη των οδηγών του, αφού αυτούς δείχνει.
    { url: `${base}/odigos`, lastModified: GUIDES_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    // Οι προθεσμίες: ο κόμβος και οι δώδεκα επόμενοι μήνες με προθεσμία (lib/seo/prothesmies.ts).
    { url: base + PROTHESMIES_PATH, lastModified: PROTHESMIES_UPDATED, changeFrequency: 'daily', priority: 0.7 },
    ...upcomingMonths(athensToday()).map(m => ({ url: base + monthPath(m), lastModified: PROTHESMIES_UPDATED, changeFrequency: 'monthly' as const, priority: 0.6 })),
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
  // ── ΚΑΙ ΟΙ ΑΓΓΛΙΚΕΣ, ΖΕΥΓΑΡΙΑ ΜΕ ΤΙΣ ΕΛΛΗΝΙΚΕΣ (lib/i18n/paths.ts) ─────────
  // Κάθε σελίδα με ζεύγος δηλώνει και τις δύο γλώσσες της (hreflang στον
  // χάρτη, όπως και στο <head>) και η αγγλική μπαίνει ως δική της γραμμή, με
  // την ημερομηνία και την προτεραιότητα της ελληνικής. Ο χάρτης δεν κρατά
  // δεύτερο κατάλογο: ό,τι μπει στο PAGE_PAIRS μπαίνει και εδώ.
  const withLanguages = rows.map(r => {
    const languages = languageAlternates(r.url.slice(base.length) || '/')
    return languages ? { ...r, alternates: { languages } } : r
  })
  const english = withLanguages.flatMap(r => {
    const en = r.alternates?.languages?.en
    return en && en !== r.url ? [{ ...r, url: en }] : []
  })
  return [...withLanguages, ...english]
}
