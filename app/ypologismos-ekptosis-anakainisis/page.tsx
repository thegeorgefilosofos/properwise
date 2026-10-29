// ═══════════════════════════════════════════════════════════════════════════
// ΔΩΡΕΑΝ ΥΠΟΛΟΓΙΣΤΗΣ: ΕΚΠΤΩΣΗ ΦΟΡΟΥ ΑΝΑΚΑΙΝΙΣΗΣ (άρθρο 39Β ΚΦΕ)
// ─────────────────────────────────────────────────────────────────────────
// Πόσο μειώνεται ο φόρος εισοδήματος για υπηρεσίες ανακαίνισης: η μείωση ίση
// με την επιλέξιμη δαπάνη, έως το ανώτατο όριο, σε πέντε ίσα ετήσια μερίδια,
// όχι πάνω από τον φόρο κάθε έτους. Κανόνας, ποσά, παράθυρο και πηγές από το
// lib/accounting/renovation39b.ts· η ημερομηνία ελέγχου από το μητρώο ισχύος
// (lib/legal/validity.ts, `renovation-39b`). Τίποτα γραμμένο εδώ στο χέρι.
// ═══════════════════════════════════════════════════════════════════════════
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fe, feWhole, fn } from '@/lib/core/format';
import {
  renovationCredit, RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_PER_YEAR, RENO_39B_MATERIALS_SHARE,
  RENO_39B_FROM, RENO_39B_TO, RENO_39B_LAW, RENO_39B_KYA,
} from '@/lib/accounting/renovation39b';
import { regulated } from '@/lib/legal/validity';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, ToolLede, ToolSources, ToolCta, TOOL_PRIVACY_FAQ, WRAP, WRAP_PAD } from '../PublicChrome';
import { ToolGuides } from '../odigos/ToolGuides';
import { guideAt } from '../odigos/guides';
import { hy } from '@/components/Hyphen';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { PAGE_UPDATED } from '../pageUpdated';
import { toolJsonLd, ToolByline, ToolOnwardLinks } from '../toolSeo';
import { RenoCalculator } from './RenoCalculator';
import { PATH } from './spec';

const URL = siteUrl(PATH);
const CHECKED = regulated('renovation-39b').checkedAt;
const SHARE = `${fn(1)}/${fn(Math.round(1 / RENO_39B_MATERIALS_SHARE))}`;

const H1 = 'Έκπτωση φόρου ανακαίνισης: πόσο μειώνεται ο φόρος σου';
const TITLE = `Υπολογισμός έκπτωσης φόρου ανακαίνισης έως ${feWhole(RENO_39B_CAP)} (άρθρο 39Β)`;
const DESC = `Πόσο μειώνεται ο φόρος εισοδήματος για υπηρεσίες ανακαίνισης: έως ${feWhole(RENO_39B_CAP)} σε `
  + `${fn(RENO_39B_YEARS)} έτη, υλικά έως ${SHARE} των υπηρεσιών, όχι πάνω από τον φόρο κάθε έτους.`;

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL, image: shareImage('ypologismos-ekptosis-anakainisis') });

// ── ΤΑ ΠΑΡΑΔΕΙΓΜΑΤΑ, ΑΠΟ ΤΗ ΜΗΧΑΝΗ ─────────────────────────────────────────
const EX = { services: 9000, materials: 5000 } as const;
const R = renovationCredit(EX);
const EX_TAX = [1500, 3000, 3000, 0, 3000] as const;
const RT = renovationCredit({ ...EX, yearTaxes: EX_TAX });

type FaqItem = { q: string; a: string };
const FAQ: FaqItem[] = [
  {
    q: 'Πόση είναι η έκπτωση φόρου για ανακαίνιση;',
    a: `Η μείωση του φόρου είναι ίση με την επιλέξιμη δαπάνη, έως ${fe(RENO_39B_CAP)} συνολικά για όλα τα έτη, `
     + `σε ${fn(RENO_39B_YEARS)} ίσα ετήσια μερίδια, δηλαδή έως ${fe(RENO_39B_PER_YEAR)} τον χρόνο. Με υπηρεσίες `
     + `${feWhole(EX.services)} και υλικά ${feWhole(EX.materials)}, μετρούν υλικά ${fe(R.materialsCounted)}, η επιλέξιμη `
     + `δαπάνη είναι ${fe(R.eligible)} και ο φόρος μειώνεται κατά ${fe(R.perYear)} τον χρόνο.`,
  },
  {
    q: 'Τι γίνεται αν ο φόρος μου είναι μικρότερος από το ετήσιο μερίδιο;',
    a: 'Η μείωση κάθε έτους δεν ξεπερνά τον φόρο του έτους και ό,τι περισσεύει δεν επιστρέφεται ούτε μεταφέρεται. '
     + `Στο ίδιο παράδειγμα, με φόρους ${EX_TAX.map(t => feWhole(t)).join(', ')} στα πέντε έτη, η μείωση είναι `
     + `${(RT.byYear ?? []).map(x => fe(x)).join(', ')}: συνολικά ${fe(RT.applied ?? 0)} αντί για ${fe(RT.total)}.`,
  },
  {
    q: 'Πόσα υλικά μετρούν;',
    a: `Τα υλικά μετρούν έως ${SHARE} της αξίας των υπηρεσιών. Με υπηρεσίες ${feWhole(EX.services)}, μετρούν υλικά έως `
     + `${fe(R.materialsCounted)}, όσα κι αν αγόρασες.`,
  },
  {
    q: 'Για ποιες δαπάνες ισχύει;',
    a: `Για δαπάνες από ${RENO_39B_FROM} έως ${RENO_39B_TO}, με τιμολόγιο στο ΑΦΜ του ιδιοκτήτη, ηλεκτρονική πληρωμή `
     + `και πάροχο με φορολογική κατοικία ή μόνιμη εγκατάσταση στην Ελλάδα (${RENO_39B_KYA}). Η ίδια δαπάνη δεν `
     + 'εκπίπτει ταυτόχρονα ως επιχειρηματική δαπάνη.',
  },
  TOOL_PRIVACY_FAQ,
];

const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

export default function Page() {
  const today = athensToday();
  const guide = guideAt('/odigos/ekptosi-forou-anakainisis');
  const jsonLd = toolJsonLd({ name: 'Υπολογισμός έκπτωσης φόρου ανακαίνισης', url: URL, description: DESC, faq: FAQ });
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader />
      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <div className="lp-eyebrow">Υπολογιστής</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em', lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {H1}
        </h1>
        <ToolLede>{`Η μείωση του φόρου εισοδήματος για υπηρεσίες ανακαίνισης, ανά έτος και συνολικά, όπως ορίζει το ${RENO_39B_LAW.replace(/ \(.*$/, '')}.`}</ToolLede>

        <Suspense fallback={<div style={{ minHeight: 560 }} aria-hidden/>}>
          <RenoCalculator today={today} cta={
            <ToolCta title="Θέλεις να τη βλέπεις κάθε χρόνο στη δήλωσή σου;"
              body="Το PROPERWISE κρατά τα τιμολόγια της ανακαίνισης στο ακίνητο, ελέγχει αν πληρώθηκαν ηλεκτρονικά και τα δίνει έτοιμα στον λογιστή σου κάθε χρόνο."/>
          }/>
        </Suspense>

        <ToolSources kind="reno" checked={CHECKED} updated={PAGE_UPDATED[PATH]} />

        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Συχνές ερωτήσεις" title="Ό,τι ρωτούν πριν ξεκινήσουν την ανακαίνιση" />
          <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {FAQ.map(f => (
              <details key={f.q} className="lp-faq">
                <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  {f.q}
                  <span className="lp-plus" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: T.weight.body, lineHeight: 1, transition: 'transform .2s', flexShrink: 0 }}>+</span>
                </summary>
                <p className="po-just" style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{hy(f.a)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Ο αναλυτικός οδηγός" title="Ποιες δαπάνες μετρούν και πώς δηλώνονται" />
          <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{hy(<>
            Ο υπολογιστής δίνει το ποσό· ο οδηγός{' '}
            <Link href={guide.href} className="lp-link" style={LINK}>{guide.title}</Link>{' '}
            εξηγεί ποιες εργασίες είναι επιλέξιμες, τι ζητά η ΑΑΔΕ για τα τιμολόγια και πώς συνδυάζεται με το
            πρόγραμμα επιδότησης. Τι μένει από το ενοίκιο μετά τον φόρο το δείχνει ο{' '}
            <Link href="/ypologismos-forou-enoikion" className="lp-link" style={LINK}>υπολογισμός φόρου ενοικίων</Link>.
          </>)}</p>
          <ToolOnwardLinks />
        </section>
        <ToolByline />
        <ToolGuides tool="/ypologismos-ekptosis-anakainisis" />
      </main>
      <PublicFooter />
    </div>
  );
}
