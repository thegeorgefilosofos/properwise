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
import { PublicHeader, PublicFooter, JsonLd, WRAP, WRAP_PAD } from '../PublicChrome';
import { BackLink } from '../BackLink';
import { publicMetadata } from '../publicMetadata';
import { GUIDES } from './guides';

const TITLE = 'Οδηγοί φορολογίας ακινήτων';
const DESC =
  'Οδηγοί για ιδιοκτήτες: φόρος ενοικίων 2026, ΕΝΦΙΑ, βραχυχρόνια μίσθωση με το ΤΑΚΚ '
  + 'και καθαρή απόδοση. Με παραδείγματα σε ευρώ και πηγές.';
const URL = siteUrl('/odigos');

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL });

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
    <div className="po-tool-page" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader />

      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <div className="lp-eyebrow">Οδηγοί</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          Οδηγοί φορολογίας ακινήτων
        </h1>
        {/* ΧΩΡΙΣ `hy()` ΕΔΩ ΚΑΙ ΣΤΙΣ ΚΑΡΤΕΣ. Το κείμενο στοιχίζεται αριστερά, άρα ο
            συλλαβισμός δεν έχει κενά να κλείσει· στα 1440 έκοβε μόνο λέξεις
            («υπο-λογίζει», «απαλλα-γές») σε γραμμές που χωρούσαν ολόκληρες. */}
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: '0 0 clamp(28px,4vw,40px)', maxWidth: 640, textWrap: 'pretty' }}>
          Οδηγοί για τη φορολογία των ακινήτων: κάθε κανόνας με τη νομική του βάση και κάθε ποσό με παράδειγμα σε ευρώ. Ο καθένας συνδέεται με τον υπολογισμό που εφαρμόζει τον κανόνα στα δικά σου νούμερα.
        </p>

        <div className="og-grid">
          {GUIDES.map(g => (
            <Link key={g.href} href={g.href} className="og-card lp-link"
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '22px 22px 20px', borderRadius: T.radius.modal,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', textDecoration: 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>{g.kicker}</span>
              <span style={{ fontSize: 18, fontWeight: 680, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.25 }}>{g.title}</span>
              <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{g.desc}</span>
              <span style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Διάβασε τον οδηγό</span>
            </Link>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
