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
import { hy } from '@/components/Hyphen';
import Link from 'next/link';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { PublicHeader, PublicFooter, JsonLd, WRAP, WRAP_PAD } from '../PublicChrome';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { GUIDES } from './guides';

const TITLE = 'Οδηγοί φορολογίας ακινήτων';
// ΕΛΕΓΕ ΤΕΣΣΕΡΑ ΘΕΜΑΤΑ ΕΝΩ ΟΙ ΟΔΗΓΟΙ ΕΙΝΑΙ ΠΕΡΙΣΣΟΤΕΡΟΙ. Η περιγραφή γράφτηκε
// για τους πρώτους τέσσερις και έμεινε ίδια όσο ο κατάλογος μεγάλωνε· στα
// αποτελέσματα αναζήτησης ο κόμβος έκρυβε τους μισούς. Το πλήθος έρχεται από
// το GUIDES και τα θέματα λέγονται ως οικογένειες, όχι ως λίστα τίτλων που
// θα ξέφευγε από το μήκος της περιγραφής.
const DESC =
  `${GUIDES.length} οδηγοί για ιδιοκτήτες: φόροι ενοικίων και ΕΝΦΙΑ, βραχυχρόνια μίσθωση, `
  + 'προθεσμίες, μισθώσεις, ανακαίνιση και απόδοση. Με παραδείγματα σε ευρώ και πηγές.';
const URL = siteUrl('/odigos');

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL, image: shareImage('odigos') });

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: TITLE,
  description: DESC,
  url: URL,
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: GUIDES.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: siteUrl(g.href),
      name: g.title,
    })),
  },
};

export default function Page() {
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader current="odigos" />

      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        {/* Χωρίς ετικέτα «Οδηγοί» από πάνω: ο τίτλος ξεκινά με την ίδια λέξη και
            η εισαγωγή την έλεγε τρίτη φορά. */}
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {TITLE}
        </h1>
        {/* Η ΕΙΣΑΓΩΓΗ: ΠΕΡΑ ΠΕΡΑ, ΣΤΟ ΠΛΑΤΟΣ ΤΩΝ ΚΑΡΤΩΝ. Στοιχίζεται όπως κάθε
            παράγραφος (απόφαση ιδιοκτήτη, 26.09.2026), άρα συλλαβίζεται. Ενα
            μέτρο 640 την έκοβε στο μισό της σειράς των καρτών (01.10.2026).

            ΟΙ ΚΑΡΤΕΣ ΟΧΙ. Η περιγραφή κάθε κάρτας είναι τρεις γραμμές σε στήλη
            τριακοσίων: αριστερά, χωρίς `hy()`, με `pretty`. Ο στοιχειοθέτης
            (lib/ui/typeset.ts) δεν μπαίνει πια μέσα σε σύνδεσμο, οπότε δεν τις
            ξαναστοιχίζει («διανυκτέρευ-ση», «απαλλα-γές» στα 1440). */}
        <p className="po-just" style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: '0 0 clamp(28px,4vw,40px)' }}>{hy(<>
          Κάθε κανόνας με τη νομική του βάση και κάθε ποσό με παράδειγμα σε ευρώ. Κάθε οδηγός δένει με τον υπολογισμό που εφαρμόζει τον κανόνα στα δικά σου νούμερα.
        </>)}</p>

        {/* ΚΑΘΕ ΚΑΡΤΑ ΕΧΕΙ ΕΠΙΚΕΦΑΛΙΔΑ ΚΑΙ ΣΥΝΤΟΜΟ ΟΝΟΜΑ ΣΥΝΔΕΣΜΟΥ. Ο τίτλος ήταν
            `<span>`, οπότε η σελίδα είχε μόνο το H1 στο διάγραμμα επικεφαλίδων
            και ο σύνδεσμος που τύλιγε όλη την κάρτα ανακοινωνόταν με σαράντα
            λέξεις. Τώρα ο τίτλος είναι H2 και δίνει το όνομα του συνδέσμου· το
            «Διάβασε τον οδηγό» είναι οπτική ένδειξη και κάθεται στη βάση της
            κάρτας, στο ίδιο ύψος σε όλη τη σειρά. */}
        <div className="og-grid">
          {/* ΕΝΝΙΑ ΚΑΡΤΕΣ ΣΕ ΔΥΟ ΣΤΗΛΕΣ ΑΦΗΝΑΝ ΤΗΝ ΕΝΑΤΗ ΜΟΝΗ ΤΗΣ, με μισή σειρά
              άδεια στο τέλος του καταλόγου. Η πρώτη γίνεται προβεβλημένη, σε όλο
              το πλάτος· οι υπόλοιπες οκτώ κλείνουν σε τέσσερις γεμάτες σειρές.
              Ο κανόνας ισχύει μόνο όσο το πλήθος είναι μονό. */}
          {GUIDES.map((g, i) => {
            const id = `odigos-${g.href.split('/').at(-1)}`;
            const featured = i === 0 && GUIDES.length % 2 === 1;
            return (
              <Link key={g.href} href={g.href} aria-labelledby={id} className={featured ? 'og-card og-featured lp-link' : 'og-card lp-link'}
                style={{ padding: featured ? '26px 26px 22px' : '22px 22px 20px', borderRadius: T.radius.modal,
                  border: featured ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' : '1px solid var(--border-subtle)',
                  background: featured ? 'color-mix(in srgb, var(--accent) 6%, var(--bg-surface))' : 'var(--bg-surface)', textDecoration: 'none' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>{g.kicker}</span>
                <h2 id={id} style={{ margin: 0, fontSize: featured ? 22 : 18, fontWeight: 680, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.25 }}>{g.title}</h2>
                <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{g.desc}</span>
                <span aria-hidden="true" style={{ marginTop: 'auto', paddingTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Διάβασε τον οδηγό</span>
              </Link>
            );
          })}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
