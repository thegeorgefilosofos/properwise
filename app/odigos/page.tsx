// ═══════════════════════════════════════════════════════════════════════════
// ΚΟΜΒΟΣ ΟΔΗΓΩΝ — /odigos — η μία, ορατή πόρτα για όλους τους οδηγούς
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Οι οδηγοί ζούσαν σε τέσσερις χωριστές διευθύνσεις και ο χρήστης
// τους έβρισκε μόνο (α) μέσα από το αντίστοιχο εργαλείο ή (β) από μηχανή
// αναζήτησης. Καμία σελίδα δεν τους μάζευε σε ένα σημείο που να δείχνει το
// υποσέλιδο. Αυτός ο κόμβος είναι εκείνο το σημείο: ένας σύνδεσμος «Οδηγοί»
// στο υποσέλιδο φτάνει εδώ· εδώ φαίνονται και οι τέσσερις με μια ματιά.
//
// Είναι και SEO κέρδος: CollectionPage/ItemList που δένει τους τέσσερις οδηγούς
// σε μία οικογένεια. Server Component, καμία εξάρτηση από 'use client'.
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import type { ReactNode } from 'react';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, READING, WRAP, WRAP_PAD } from '../PublicChrome';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { LISTED_GUIDES, GUIDE_TOPICS, type Guide, type GuideTopic } from './guides';
import { PUBLIC_TOOLS } from '@/lib/core/publicTools';
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumbs';

// Ο ΚΟΜΒΟΣ ΔΕΝ ΕΙΝΑΙ ΜΟΝΟ ΦΟΡΟΙ (απόφαση ιδιοκτήτη 20/10/2026): έχει πια στεγαστικό,
// μισθώσεις και βραχυχρόνια. 55 χαρακτήρες, ο τίτλος είναι απόλυτος (publicMetadata).
// Ίδιος στο H1, στο CollectionPage και στην κάρτα κοινοποίησης (app/og/share.ts).
const TITLE = 'Οδηγοί για ιδιοκτήτες ακινήτων: φόροι, ενοίκια, στέγαση';
// ΕΛΕΓΕ ΤΕΣΣΕΡΑ ΘΕΜΑΤΑ ΕΝΩ ΟΙ ΟΔΗΓΟΙ ΕΙΝΑΙ ΠΕΡΙΣΣΟΤΕΡΟΙ. Η περιγραφή γράφτηκε
// για τους πρώτους τέσσερις και έμεινε ίδια όσο ο κατάλογος μεγάλωνε· στα
// αποτελέσματα αναζήτησης ο κόμβος έκρυβε τους μισούς. Το πλήθος έρχεται από
// τον κατάλογο και τα θέματα λέγονται ως οικογένειες, όχι ως λίστα τίτλων που
// θα ξέφευγε από το μήκος της περιγραφής. Μετρά όσους δείχνει ο κόμβος
// (`LISTED_GUIDES`): ο οδηγός εκτός καταλόγου (`unlisted`, guides.ts) δεν
// μπαίνει ούτε στις κάρτες ούτε στο ItemList.
const DESC =
  `${LISTED_GUIDES.length} οδηγοί για ιδιοκτήτες: φόροι ενοικίων και ΕΝΦΙΑ, βραχυχρόνια, μισθώσεις, `
  + 'στεγαστικό, ανακαίνιση, απόδοση και προθεσμίες. Με παραδείγματα σε ευρώ και πηγές.';
const URL = siteUrl('/odigos');

// ═══ ΟΙ ΟΜΑΔΕΣ ΤΟΥ ΚΟΜΒΟΥ (27.10.2026) ════════════════════════════════════
// Ο ΚΟΜΒΟΣ ΗΤΑΝ ΛΕΠΤΟΣ: μία πρόταση εισαγωγής και κάρτες, περίπου 470 λέξεις
// μαζί με την κεφαλίδα και το υποσέλιδο (έλεγχος 27/10/2026). Ο αναγνώστης
// δεν έβλεπε πώς δένονται οι οδηγοί μεταξύ τους ούτε με ποιον υπολογιστή και
// η μηχανή αναζήτησης έβλεπε σελίδα-πυλώνα χωρίς δικό της περιεχόμενο. Τώρα
// κάθε οδηγός ανήκει σε ένα θέμα (`topic`, guides.ts) και κάθε θέμα έχει μια
// παράγραφο που λέει τι απαντούν οι οδηγοί του και ποιος υπολογιστής κάνει
// τον λογαριασμό στα δικά σου ποσά.
//
// ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ ΓΡΑΜΜΕΝΟΣ ΕΔΩ. Συντελεστές, όρια και ημερομηνίες ζουν στους
// οδηγούς, με την πηγή τους· το πλήθος κάθε ομάδας βγαίνει από τον κατάλογο.
// Οι σύνδεσμοι στους υπολογιστές περνούν από τον κατάλογο PUBLIC_TOOLS: διαδρομή
// που δεν υπάρχει εκεί σταματά το build, αντί να γίνει σύνδεσμος στο 404.
const tool = (href: string, text: string) => {
  const t = PUBLIC_TOOLS.find(x => x.href === href);
  if (!t) throw new Error(`Άγνωστος υπολογιστής: ${href}`);
  return <Link href={t.href} className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{text}</Link>;
};

const TOPICS: Record<GuideTopic, { title: string; lede: ReactNode }> = {
  enoikia: {
    title: 'Ενοίκια, μισθώσεις και βραχυχρόνια',
    lede: <>
      Πώς φορολογείται το ενοίκιο, τι χρειάζεται για να μη χαθεί η τεκμαρτή έκπτωση, πού σταματά η
      αναπροσαρμογή στις επαγγελματικές μισθώσεις και τι αλλάζει όταν το ακίνητο νοικιάζεται για λίγες
      νύχτες. Τον φόρο στο δικό σου ενοίκιο τον βγάζει ο {tool('/ypologismos-forou-enoikion', 'υπολογισμός φόρου ενοικίων')}.
      Τη βραχυχρόνια δίπλα στη μακροχρόνια, με φόρο, τέλος ανθεκτικότητας και προμήθεια, τη βάζει ο
      υπολογιστής {tool('/vraxyxronia-i-makroxronia', 'βραχυχρόνια ή μακροχρόνια')}.
    </>,
  },
  enfia: {
    title: 'ΕΝΦΙΑ, προθεσμίες και ανακαίνιση',
    lede: <>
      Από πού βγαίνει ο ΕΝΦΙΑ, πότε λήγει κάθε δόση και πώς εκδίδεται το πιστοποιητικό του, ποιες
      προθεσμίες έχει ο ιδιοκτήτης μέσα στη χρονιά και πότε η δαπάνη ανακαίνισης μειώνει τον φόρο. Το
      ποσό για το δικό σου ακίνητο, από τα τετραγωνικά, την τιμή ζώνης, τον όροφο και την παλαιότητα, το
      δίνει ο {tool('/ypologismos-enfia', 'υπολογισμός ΕΝΦΙΑ')}.
    </>,
  },
  agora: {
    title: 'Αγορά, δάνειο και απόδοση',
    lede: <>
      Πριν από την αγορά μετρούν η δόση, οι όροι των προγραμμάτων «Σπίτι μου» και το τι μένει καθαρό
      μετά τον φόρο, τον ΕΝΦΙΑ και τις δαπάνες. Τη δόση και πόσο δάνειο επιτρέπει το εισόδημα τα δείχνει
      ο {tool('/ypologismos-stegastikou-daneiou', 'υπολογισμός στεγαστικού δανείου')}. Την καθαρή απόδοση
      τη μετρά ο υπολογιστής {tool('/kathari-apodosi', 'καθαρής απόδοσης')} και το ρεύμα του ακινήτου η{' '}
      {tool('/sygkrisi-timologion-revmatos', 'σύγκριση τιμολογίων ρεύματος')}.
    </>,
  },
};

/** Οι οδηγοί κάθε θέματος, με τη σειρά του καταλόγου· θέμα χωρίς οδηγό δεν εμφανίζεται. */
const GROUPS = GUIDE_TOPICS
  .map(id => ({ id, ...TOPICS[id], guides: LISTED_GUIDES.filter(g => g.topic === id) }))
  .filter(t => t.guides.length > 0);

/** «1 οδηγός», «4 οδηγοί»: το πλήθος από τον κατάλογο. */
const countLabel = (n: number) => `${n} ${n === 1 ? 'οδηγός' : 'οδηγοί'}`;

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL, image: shareImage('odigos') });

// Η διαδρομή «Αρχική › Οδηγοί» μπαίνει στο ίδιο `@graph`, από την κοινή
// συνάρτηση (lib/seo/breadcrumbs.ts) που διαβάζουν και οι οδηγοί του κόμβου.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: TITLE,
      description: DESC,
      url: URL,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: LISTED_GUIDES.map((g, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: siteUrl(g.href),
          name: g.title,
        })),
      },
    },
    breadcrumbJsonLd([{ name: 'Οδηγοί', path: '/odigos' }]),
  ],
};

export default function Page() {
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader current="odigos" />

      {/* `data-nohy`: κανένα μαλακό ενωτικό ούτε από τον στοιχειοθέτη της σελίδας
          (lib/ui/typeset.ts), όπως στους οδηγούς (GuideParts, `GuideMain`). */}
      <main data-nohy="" style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        {/* Χωρίς ετικέτα «Οδηγοί» από πάνω: ο τίτλος ξεκινά με την ίδια λέξη και
            η εισαγωγή την έλεγε τρίτη φορά. */}
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {TITLE}
        </h1>
        {/* Η ΕΙΣΑΓΩΓΗ: ΣΤΟ ΠΛΑΤΟΣ ΤΩΝ ΚΑΡΤΩΝ. Ενα μέτρο 640 την έκοβε στο μισό
            της σειράς των καρτών (01.10.2026). Από 06.10.2026 το `.po-just`
            στοιχίζεται αριστερά (globals.css, «ΠΕΡΑ ΠΕΡΑ ΜΟΝΟ ΣΤΙΣ ΣΤΗΛΕΣ
            ΑΝΑΓΝΩΣΗΣ») και από 13.10.2026 χωρίς `hy()`: τα μαλακά ενωτικά του
            δεν έκοβαν πια τίποτα, έμεναν μόνο στο κείμενο που αντιγράφεται.

            ΟΙ ΚΑΡΤΕΣ ΟΧΙ. Η περιγραφή κάθε κάρτας είναι τρεις γραμμές σε στήλη
            τριακοσίων: αριστερά, χωρίς `hy()`, με `pretty`. Ο στοιχειοθέτης
            (lib/ui/typeset.ts) δεν μπαίνει πια μέσα σε σύνδεσμο, οπότε δεν τις
            ξαναστοιχίζει («διανυκτέρευ-ση», «απαλλα-γές» στα 1440). */}
        <p className="po-just" style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
          Κάθε κανόνας με τη νομική του βάση και, όπου μετρούν ποσά, παράδειγμα σε ευρώ. Κάθε οδηγός γράφει
          πότε ενημερώθηκε, παραπέμπει στις πηγές του και συνδέεται με τον υπολογισμό που εφαρμόζει τον κανόνα
          στα δικά σου ποσά.
        </p>

        {/* ΚΑΘΕ ΘΕΜΑ ΜΕ ΤΗΝ ΕΙΣΑΓΩΓΗ ΤΟΥ, ΜΕΤΑ ΟΙ ΚΑΡΤΕΣ ΤΟΥ (27.10.2026). Ο τίτλος
            του θέματος είναι H2 και ο τίτλος κάθε κάρτας H3, ώστε το διάγραμμα
            επικεφαλίδων να λέει θέμα και οδηγό. */}
        {GROUPS.map(t => (
          <section key={t.id} aria-labelledby={`thema-${t.id}`} style={{ marginTop: 'clamp(32px,4.4vw,48px)' }}>
            {/* Η εισαγωγή ΟΧΙ ως `sub` του SectionHead: εκείνο περνά από το `hy()`
                και ο κόμβος δεν έχει μαλακά ενωτικά (softHyphens.test.ts). */}
            <div id={`thema-${t.id}`}>
              <SectionHead over={countLabel(t.guides.length)} title={t.title} />
            </div>
            <p className="po-just" style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)', margin: '-6px 0 clamp(18px,2.4vw,24px)', maxWidth: READING }}>
              {t.lede}
            </p>
            <GuideCards guides={t.guides} />
          </section>
        ))}
      </main>

      <PublicFooter />
    </div>
  );
}

/**
 * ΟΙ ΚΑΡΤΕΣ ΕΝΟΣ ΘΕΜΑΤΟΣ.
 *
 * ΚΑΘΕ ΚΑΡΤΑ ΕΧΕΙ ΕΠΙΚΕΦΑΛΙΔΑ ΚΑΙ ΣΥΝΤΟΜΟ ΟΝΟΜΑ ΣΥΝΔΕΣΜΟΥ. Ο τίτλος ήταν
 * `<span>`, οπότε η σελίδα είχε μόνο το H1 στο διάγραμμα επικεφαλίδων και ο
 * σύνδεσμος που τύλιγε όλη την κάρτα ανακοινωνόταν με σαράντα λέξεις. Ο τίτλος
 * δίνει το όνομα του συνδέσμου· το «Διάβασε τον οδηγό» είναι οπτική ένδειξη και
 * κάθεται στη βάση της κάρτας, στο ίδιο ύψος σε όλη τη σειρά.
 *
 * ΜΟΝΟΣ ΑΡΙΘΜΟΣ ΚΑΡΤΩΝ ΣΕ ΔΥΟ ΣΤΗΛΕΣ ΑΦΗΝΕΙ ΤΗΝ ΤΕΛΕΥΤΑΙΑ ΜΟΝΗ ΤΗΣ, με μισή
 * σειρά άδεια. Τότε η πρώτη του θέματος γίνεται προβεβλημένη, σε όλο το πλάτος,
 * και οι υπόλοιπες κλείνουν σε γεμάτες σειρές.
 */
function GuideCards({ guides }: { guides: readonly Guide[] }) {
  return (
    <div className="og-grid">
      {guides.map((g, i) => {
        const id = `odigos-${g.href.split('/').at(-1)}`;
        const featured = i === 0 && guides.length % 2 === 1;
        return (
          <Link key={g.href} href={g.href} aria-labelledby={id} className={featured ? 'og-card og-featured lp-link' : 'og-card lp-link'}
            style={{ padding: featured ? '26px 26px 22px' : '22px 22px 20px', borderRadius: T.radius.modal,
              border: featured ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' : '1px solid var(--border-subtle)',
              background: featured ? 'color-mix(in srgb, var(--accent) 6%, var(--bg-surface))' : 'var(--bg-surface)', textDecoration: 'none' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>{g.kicker}</span>
            <h3 id={id} style={{ margin: 0, fontSize: featured ? 22 : 18, fontWeight: 680, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.25 }}>{g.title}</h3>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{g.desc}</span>
            <span aria-hidden="true" style={{ marginTop: 'auto', paddingTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Διάβασε τον οδηγό</span>
          </Link>
        );
      })}
    </div>
  );
}
