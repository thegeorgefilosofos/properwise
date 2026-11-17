// ═══════════════════════════════════════════════════════════════════════════
// /methodologia: ΑΠΟ ΠΟΥ ΒΓΑΙΝΕΙ ΚΑΘΕ ΑΡΙΘΜΟΣ (17/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Κάθε οδηγός και υπολογιστής γράφει τη νομική του βάση, αλλά
// καμία σελίδα δεν έλεγε ΠΩΣ φτάνει ένας συντελεστής από το ΦΕΚ στην οθόνη και
// τι σημαίνουν οι δύο ημερομηνίες που διαβάζει ο αναγνώστης («Τελευταία
// ενημέρωση», «Έλεγχος»). Εδώ λέγεται μία φορά: η μηχανή, το μητρώο ισχύος με
// όλους τους κανόνες του και οι αυτόματοι έλεγχοι που κρατούν το κείμενο πιστό.
//
// ΤΟ ΜΗΤΡΩΟ ΕΙΝΑΙ ΖΩΝΤΑΝΟ. Ο πίνακας διαβάζει το lib/legal/validity.ts τη
// στιγμή της απόδοσης: νέος κανόνας ή νέος έλεγχος φαίνεται εδώ χωρίς αλλαγή
// της σελίδας. Ό,τι διάβασε μόνο εργαλείο γράφεται ως τέτοιο.
//
// ΧΩΡΙΣ ΔΙΚΗ ΤΗΣ ΣΥΝΑΡΤΗΣΗ, όπως το /xartis: το next.config.ts την ξαναγράφει
// στο `METHOD_INTERNAL` του διανομέα του /en (app/thema/hubs.ts).
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { IDENTITY } from '@/lib/legal/identity';
import { RECHECK_MONTHS, WARN_DAYS } from '@/lib/legal/validity';
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumbs';
import { organizationNode, ORG_REF } from '@/lib/seo/organization';
import { PublicHeader, PublicFooter, JsonLd, WRAP, WRAP_PAD, READING } from '../PublicChrome';
import { HubCards, HubLink } from '../HubParts';
import { LINK_STYLE } from '../linkStyle';
import { publicMetadata } from '../publicMetadata';
import { shareImage } from '../og/share';
import { RENT_SCALE } from '../thema/HubPage';
import { RuleTable } from '../thema/RuleTable';
import { allRuleRows } from '../thema/rules';
import { Crumbs, Section, Byline, AUTHOR } from '../thema/parts';
import { METHOD_UPDATED } from '../thema/hubDates';
import { HUBS, hubPath, METHOD_PATH, METHOD_LABEL } from '../thema/hubs';

const TITLE = 'Πώς υπολογίζουμε: η μηχανή, οι πηγές και ο έλεγχος';
const DESC = 'Από πού βγαίνει κάθε συντελεστής, όριο και προθεσμία του PROPERWISE: μία πηγή στον κώδικα, '
  + 'το μητρώο ισχύος με τον νόμο και η ημέρα ελέγχου από άνθρωπο.';
const URL = siteUrl(METHOD_PATH);

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL, image: shareImage('methodologia') });

/** «1 μήνα», «12 μήνες». */
const months = (n: number) => `${n} ${n === 1 ? 'μήνα' : 'μήνες'}`;
const days = (n: number) => `${n} ${n === 1 ? 'ημέρα' : 'ημέρες'}`;

const P = { fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: `0 0 ${T.sp.lg}px`, textWrap: 'pretty' } as const;

export default function Page() {
  const rows = allRuleRows();
  const human = rows.filter(r => r.checkedAt).length;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      {
        '@type': 'Article',
        '@id': `${URL}#article`,
        headline: TITLE,
        description: DESC,
        inLanguage: 'el',
        image: siteUrl('/og/methodologia'),
        datePublished: METHOD_UPDATED,
        dateModified: METHOD_UPDATED,
        mainEntityOfPage: URL,
        author: ORG_REF,
        publisher: ORG_REF,
        about: { '@type': 'Thing', name: 'Μεθοδολογία υπολογισμών και πηγές' },
      },
      { '@id': `${URL}#breadcrumb`, ...breadcrumbJsonLd([{ name: METHOD_LABEL, path: METHOD_PATH }]) },
    ],
  };

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader />
      <main data-nohy="" style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <Crumbs trail={[]} current={METHOD_LABEL} />
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance', maxWidth: 880 }}>
          {TITLE}
        </h1>
        <Byline updated={METHOD_UPDATED} anchor={{ href: '#mitroo', label: 'Το μητρώο' }} />

        <div style={{ maxWidth: READING }}>
          <p style={{ ...P, fontSize: 18, color: 'var(--text-primary)' }}>
            Κάθε αριθμός που διαβάζεις στο PROPERWISE βγαίνει από τον ίδιο κώδικα που υπολογίζει στην εφαρμογή και κάθε
            κανόνας έχει γραμμένη δίπλα του την επίσημη πηγή του και, όπου τον έχει ελέγξει άνθρωπος, την ημέρα του ελέγχου.
          </p>
        </div>

        <Section id="mia-pigi" over="Η μηχανή" title="Μία πηγή για κάθε αριθμό">
          <div style={{ maxWidth: READING }}>
            <p style={P}>
              Κάθε συντελεστής, όριο, τέλος και προθεσμία ζει μία φορά στη μηχανή της εφαρμογής: η κλίμακα των ενοικίων, οι
              συντελεστές του ΕΝΦΙΑ, το τέλος ανθεκτικότητας, οι δόσεις και οι ημερομηνίες του φορολογικού ημερολογίου. Οι
              υπολογιστές, οι οδηγοί, οι σελίδες θέματος και η ίδια η εφαρμογή διαβάζουν από εκεί. Όταν αλλάζει ο νόμος,
              αλλάζει ένα σημείο και η αλλαγή φαίνεται παντού μαζί.
            </p>
            <p style={P}>
              {`Για παράδειγμα, η κλίμακα των ενοικίων που γράφουν οι οδηγοί δεν είναι αντίγραφο αλλά ο ίδιος πίνακας που υπολογίζει τον φόρο: ${RENT_SCALE}.`}
            </p>
            <p style={{ ...P, margin: 0 }}>
              Κανένας αριθμός φόρου, ΕΝΦΙΑ, προθεσμίας ή τιμής δεν γράφεται με το χέρι στο κείμενο μιας σελίδας. Αυτόματοι
              έλεγχοι τρέχουν σε κάθε αλλαγή του κώδικα και τη σταματούν όταν ένα ψηφίο δεν βγαίνει από τη μηχανή ή όταν μια
              σελίδα γράφει άλλη ημερομηνία από τον χάρτη του ιστότοπου.
            </p>
          </div>
        </Section>

        <Section id="mitroo" over="Το μητρώο ισχύος" title="Ως πότε ισχύει κάθε κανόνας και ποιος τον έλεγξε"
          lede={`Οι κλίμακες, τα όρια και τα τέλη ισχύουν για ορισμένο διάστημα. Για κάθε ρυθμιζόμενο μέγεθος η εφαρμογή κρατά ως πότε ισχύει, πού ζει στη μηχανή, την επίσημη πηγή του (ΦΕΚ, νόμο ή απόφαση της ΑΑΔΕ) και την ημέρα που το έλεγξε άνθρωπος. Αυτόματος έλεγχος ειδοποιεί ${days(WARN_DAYS)} πριν λήξει ένας κανόνας και όταν περάσουν ${months(RECHECK_MONTHS)} χωρίς ανθρώπινο έλεγχο.`}>
          <div style={{ maxWidth: READING }}>
            <RuleTable caption={`Το μητρώο ισχύος: ${rows.length} κανόνες, οι ${human} με έλεγχο από άνθρωπο`} rows={rows} />
          </div>
        </Section>

        <Section id="imerominies" over="Οι ημερομηνίες" title="Τι σημαίνει κάθε ημερομηνία">
          <ul className="lg-ul" style={{ maxWidth: READING, margin: 0 }}>
            <li style={{ ...P, margin: `0 0 ${T.sp.md}px` }}>
              <strong style={{ color: 'var(--text-primary)' }}>Τελευταία ενημέρωση.</strong> Η τελευταία ουσιαστική αλλαγή στο
              κείμενο ή στους αριθμούς της σελίδας. Είναι η ίδια ημερομηνία που διαβάζουν οι μηχανές αναζήτησης στον χάρτη του
              ιστότοπου και δεν αλλάζει για διορθώσεις ύφους.
            </li>
            <li style={{ ...P, margin: `0 0 ${T.sp.md}px` }}>
              <strong style={{ color: 'var(--text-primary)' }}>Έλεγχος.</strong> Η ημέρα που άνθρωπος άνοιξε την επίσημη πηγή
              και επιβεβαίωσε τον κανόνα. Όταν τον έχει διαβάσει μόνο εργαλείο, η σελίδα γράφει «Χωρίς ανθρώπινο έλεγχο» και
              την ημέρα της ανάγνωσης.
            </li>
            <li style={{ ...P, margin: 0 }}>
              Καμία από τις δύο δεν είναι έλεγχος από δικηγόρο ή λογιστή. Δεν έχει γίνει τέτοιος έλεγχος και η σελίδα δεν το
              υπονοεί.
            </li>
          </ul>
        </Section>

        <Section id="ti-den-einai" over="Τα όρια" title="Τι δεν είναι οι υπολογισμοί">
          <div style={{ maxWidth: READING }}>
            <p style={{ ...P, margin: 0 }}>
              Τα ποσά είναι ενδεικτικά. Επίσημο έγγραφο είναι το εκκαθαριστικό της ΑΑΔΕ και τη δήλωση την κρίνει ο λογιστής
              σου. Όπου ο νόμος αφήνει περιθώριο ή μια ημερομηνία δεν έχει ανακοινωθεί ακόμη, η σελίδα το λέει και δείχνει
              την επίσημη πηγή αντί για εκτίμηση χωρίς σημείωση.
            </p>
          </div>
        </Section>

        <Section id="diorthoseis" over="Ποιος γράφει" title="Υπογραφή και διορθώσεις">
          <div style={{ maxWidth: READING }}>
            <p style={{ ...P, margin: 0 }}>
              {`Τους οδηγούς, τους υπολογιστές και αυτή τη σελίδα τους γράφει η ${AUTHOR}. Αν βρεις λάθος σε αριθμό ή σε πηγή, γράψε στο `}
              <a href={`mailto:${IDENTITY.supportEmail}`} className="lp-link" style={LINK_STYLE}>{IDENTITY.supportEmail}</a>
              {' με τη διεύθυνση της σελίδας. Η διόρθωση αλλάζει και την ημερομηνία ενημέρωσής της. Για την ομάδα και για το πού φυλάσσονται τα δεδομένα σου, δες το '}
              <HubLink href="/trust">Ποιοι είμαστε</HubLink>.
            </p>
          </div>
        </Section>

        <Section id="themata" over="Θέματα" title="Οι κανόνες στην πράξη">
          <HubCards items={HUBS.map(h => ({ href: hubPath(h), kicker: 'Θέμα', title: h.label, desc: h.desc }))} cta="Άνοιξε το θέμα" />
        </Section>
      </main>
      <PublicFooter />
    </div>
  );
}
