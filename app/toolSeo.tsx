// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΔΟΜΗΜΕΝΟ ΣΧΗΜΑ ΚΑΙ Η ΥΠΟΓΡΑΦΗ ΤΩΝ ΔΗΜΟΣΙΩΝ ΥΠΟΛΟΓΙΣΤΩΝ
// ─────────────────────────────────────────────────────────────────────────
// ΔΥΟ ΣΕΛΙΔΕΣ, ΤΟ ΙΔΙΟ ΣΧΗΜΑ ΓΡΑΜΜΕΝΟ ΔΥΟ ΦΟΡΕΣ (13.10.2026). Ο φόρος ενοικίων
// και ο ΕΝΦΙΑ έστηναν με το χέρι την εφαρμογή και τις συχνές ερωτήσεις, χωρίς
// συντάκτη. Τα δύο κείμενα των σελίδων (λυμένο παράδειγμα, «Πώς δηλώνεται στο
// Ε2», δύο παραδείγματα ΕΝΦΙΑ) θέλουν υπογραφή, ίδια ορατή και στο σχήμα.
//
// Η ΥΠΟΓΡΑΦΗ ΕΙΝΑΙ «Ομάδα Properwise» (απόφαση ιδιοκτήτη, 13.10.2026). Ο
// εκδότης μένει ο οργανισμός της αρχικής (ORG_ID), όπως στους οδηγούς: κανένα
// στοιχείο ταυτότητας δεν αλλάζει, μόνο δηλώνεται ποιος έγραψε το κείμενο.
//
// ΕΝΑ ΣΕΝΑΡΙΟ ΑΝΑ ΣΕΛΙΔΑ. Το scripts/e2e-public-tools.mjs μετρά ακριβώς ένα
// `application/ld+json`: εφαρμογή και ερωτήσεις μπαίνουν στο ίδιο `@graph`.
//
// ΟΙ ΕΡΩΤΗΣΕΙΣ ΤΟΥ ΣΧΗΜΑΤΟΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ ΠΙΝΑΚΑΣ ΠΟΥ ΑΠΟΔΙΔΕΙ Η ΣΕΛΙΔΑ.
// Η συνάρτηση δεν δέχεται άλλες: το `FAQPage` λέει μόνο ό,τι διαβάζει ο
// επισκέπτης στις «Συχνές ερωτήσεις» από κάτω.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { hy } from '@/components/Hyphen';
import { ORG_ID, PRODUCT_NAME, SITE } from '@/lib/core/site';
import { PUBLIC_TOOLS } from '@/lib/core/publicTools';
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumbs';

/** Η υπογραφή του περιεχομένου, ορατή στη σελίδα και ως `author` στο σχήμα. */
const CONTENT_AUTHOR = 'Ομάδα Properwise';

/** Μία ερώτηση με την απάντησή της, όπως την αποδίδει η σελίδα. */
interface ToolFaq { q: string; a: string }

/** Ο υπολογιστής στεγαστικού, στη διεύθυνση του καταλόγου των εργαλείων. */
const MORTGAGE_PATH = '/ypologismos-stegastikou-daneiou';
const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

/**
 * Η ΔΙΑΔΡΟΜΗ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ: «Αρχική › <υπολογιστής>» (27.10.2026). Το όνομα
 * είναι η ετικέτα του καταλόγου (lib/core/publicTools.ts), η ίδια με το
 * υποσέλιδο. Χωρίς ενδιάμεσο κρίκο «Υπολογισμοί»: δεν υπάρχει σελίδα-κόμβος
 * των υπολογιστών και κρίκος χωρίς σελίδα θα έδειχνε στο κενό
 * (lib/seo/breadcrumbs.ts). Άγνωστη διαδρομή είναι σφάλμα γραφής.
 */
export function toolBreadcrumb(path: string) {
  const tool = PUBLIC_TOOLS.find(t => t.href === path);
  if (!tool) throw new Error(`Άγνωστος δημόσιος υπολογιστής: ${path}`);
  return breadcrumbJsonLd([{ name: tool.label, path: tool.href }]);
}

/** Εφαρμογή, διαδρομή και συχνές ερωτήσεις ενός δημόσιου υπολογιστή, σε ένα `@graph`. */
export function toolJsonLd({ name, url, description, faq }: {
  name: string; url: string; description: string; faq: readonly ToolFaq[];
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name,
        url,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        inLanguage: 'el',
        description,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        author: { '@type': 'Organization', name: CONTENT_AUTHOR, url: SITE },
        publisher: { '@type': 'Organization', '@id': ORG_ID, name: PRODUCT_NAME, url: SITE },
      },
      toolBreadcrumb(url.slice(SITE.length)),
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}

/**
 * ΤΟ ΕΠΟΜΕΝΟ ΒΗΜΑ ΠΟΥ ΕΛΕΙΠΕ (13.10.2026). Ο φόρος ενοικίων και ο ΕΝΦΙΑ έστελναν
 * ο ένας στον άλλον, στη βραχυχρόνια και στην καθαρή απόδοση· όχι στον
 * υπολογιστή στεγαστικού. Μία παράγραφος για τις δύο σελίδες, ώστε να λένε το
 * ίδιο με τα ίδια λόγια. Ό,τι υπόσχεται ο σύνδεσμος είναι η περιγραφή του
 * εργαλείου στον κατάλογό του (lib/core/publicTools.ts).
 *
 * ΧΩΡΙΣ ΣΥΝΔΕΣΜΟ ΣΤΟΝ ΟΔΗΓΟ ΑΜΑ, ΕΠΙΤΗΔΕΣ. Ο ιδιοκτήτης τον ζήτησε μαζί με
 * τον στεγαστικό. Η απόφαση της 13/10/2026 όμως αφαιρεί κάθε σύνδεσμο προς
 * εκείνον τον οδηγό ώσπου να υπογράψει η Legal (άλλο PR, με φύλακα που
 * κοκκινίζει). Η απόφαση υπερισχύει: δεν προστίθεται εδώ.
 */
export function ToolOnwardLinks() {
  return (
    <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: '12px 0 0' }}>{hy(<>
      Αν σκέφτεσαι να αγοράσεις ακίνητο με δάνειο, ο{' '}
      <Link href={MORTGAGE_PATH} className="lp-link" style={LINK}>υπολογισμός στεγαστικού δανείου</Link>{' '}
      δείχνει τη δόση, τους τόκους και πόσο δάνειο επιτρέπει το εισόδημά σου.
    </>)}</p>
  );
}

/** Η ορατή υπογραφή κάτω από τα κείμενα της σελίδας: το ίδιο όνομα με το `author`. */
export function ToolByline() {
  return (
    <p style={{ margin: 'clamp(28px,4vw,40px) 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--text-tertiary)' }}>
      Κείμενα και παραδείγματα: {CONTENT_AUTHOR}.
    </p>
  );
}
