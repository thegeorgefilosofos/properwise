import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/core/site'

// Οι μηχανές αναζήτησης βλέπουν μόνο τις δημόσιες σελίδες. Οι ιδιωτικές
// περιοχές (πίνακας, portals ενοικιαστών/κρατήσεων, σελίδες με token,
// επαναφορά κωδικού) μένουν εκτός ευρετηρίου.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Μόνο ο πίνακας μένει στο disallow. Οι σελίδες με token ΔΕΝ μπαίνουν
      // εδώ: μια διεύθυνση που απαγορεύεται στο robots.txt δεν διαβάζεται ποτέ,
      // άρα η Google δεν βλέπει ούτε το noindex της και μπορεί να την κρατήσει
      // στο ευρετήριο από εξωτερικό σύνδεσμο. Τις κρατά έξω η κεφαλίδα
      // X-Robots-Tag του next.config.ts (NOINDEX_PATHS), που η μηχανή διαβάζει.
      disallow: ['/dashboard'],
    },
    sitemap: siteUrl('/sitemap.xml'),
  }
}
