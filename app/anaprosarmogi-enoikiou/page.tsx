// ═══════════════════════════════════════════════════════════════════════════
// ΑΝΑΠΡΟΣΑΡΜΟΓΗ ΕΝΟΙΚΙΟΥ: η δημόσια σελίδα
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Κάθε χρόνο ο ιδιοκτήτης ρωτά «πόσο γίνεται το ενοίκιο με τον
// όρο της σύμβασης». Η εφαρμογή το απαντούσε ήδη, με την ειδοποίηση
// αναπροσαρμογής προς τον μισθωτή· εδώ ο ίδιος υπολογισμός ανοίγει χωρίς
// εγγραφή, μαζί με τον πίνακα ανά έτος και τη μετάβαση στον φόρο ενοικίων.
//
// ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ ΚΑΘΕ ΓΕΓΟΝΟΣ.
//   · Το όριο του 2026, η περίοδός του και ποιους αφορά: `COMMERCIAL_RENT_CAP_2026`
//     και `rentCapPct` (lib/documents/rentAdjustment.ts), όπως τα εφαρμόζει η
//     ειδοποίηση της εφαρμογής και τα εξηγεί ο οδηγός του πλαφόν. Νομική βάση
//     άρθρο 59 ν.5255/2025 · άρθρο 96 ν.5007/2022 (lib/accounting/updates2026.ts).
//   · Κατοικία χωρίς γενικό κρατικό πλαφόν το 2026, αύξηση μόνο με ρητό όρο ή
//     νέα συμφωνία: ο οδηγός του πλαφόν και το TabTenantCare.tsx, ίδια διατύπωση.
//   · Ο ΔΤΚ, το 75% και η στρογγυλοποίησή του: lib/market/cpi.ts (μηνιαίο
//     δελτίο ΕΛΣΤΑΤ, με την ημερομηνία επιβεβαίωσης του πίνακα).
//   · Το Ψηφιακό Τέλος Συναλλαγής: `COMMERCIAL_STAMP_DUTY` (lib/billing/commercialLease.ts).
// Τα παραδείγματα των συχνών ερωτήσεων τα βγάζει η μηχανή της σελίδας
// (lib/tools/anaprosarmogi.ts). Κανένα ποσό δεν γράφεται με το χέρι.
//
// Server Component για SEO/ταχύτητα· μόνο ο υπολογιστής είναι πελάτης.
// ═══════════════════════════════════════════════════════════════════════════
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { fe, feWhole, fpRate, grDate } from '@/lib/core/format';
import { COMMERCIAL_RENT_CAP_2026 as CAP } from '@/lib/documents/rentAdjustment';
import {
  RENT_INDEX, RENT_INDEX_LATEST, CPI_SOURCE_URL, CPI_CONFIRMED_AT, rentAdjustmentPct, indexMonthLabel, indexPeriodLabel,
} from '@/lib/market/cpi';
import { adjustPlan } from '@/lib/tools/anaprosarmogi';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, ToolLede, ToolSources, ToolCta, TOOL_PRIVACY_FAQ, WRAP, WRAP_PAD } from '../PublicChrome';
import { ToolGuides } from '../odigos/ToolGuides';
import { guideAt } from '../odigos/guides';
import { hy } from '@/components/Hyphen';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { PAGE_UPDATED } from '../pageUpdated';
import { toolJsonLd, ToolByline, ToolOnwardLinks } from '../toolSeo';
import { AdjustCalculator } from './AdjustCalculator';

const PATH = '/anaprosarmogi-enoikiou';
const URL = siteUrl(PATH);
const CAP_YEAR = Number(CAP.from.slice(0, 4));
const CAP_PCT = fpRate(CAP.pct);

const H1 = 'Αναπροσαρμογή ενοικίου: υπολογισμός με ποσοστό ή ΔΤΚ';
const TITLE = 'Υπολογισμός αναπροσαρμογής ενοικίου με ποσοστό ή ΔΤΚ ΕΛΣΤΑΤ';
// Κάτω από 160 χαρακτήρες: τόσα δείχνει η σελίδα αποτελεσμάτων πριν κόψει.
const DESC =
  `Το νέο μίσθωμα με τον όρο της σύμβασης ή τον ΔΤΚ της ΕΛΣΤΑΤ, ο πίνακας ανά έτος και το όριο ${CAP_PCT} `
  + `των επαγγελματικών μισθώσεων του ${CAP_YEAR}.`;

export const metadata: Metadata = publicMetadata({
  title: TITLE, description: DESC, url: URL, image: shareImage('anaprosarmogi-enoikiou'),
});

// ── ΤΑ ΠΑΡΑΔΕΙΓΜΑΤΑ ΤΩΝ ΑΠΑΝΤΗΣΕΩΝ, ΑΠΟ ΤΗ ΜΗΧΑΝΗ ─────────────────────────────
// Οι υποθέσεις γράφονται εδώ· τα ποσά τα βγάζει η `adjustPlan`.
const EX_RES = { rent: 600, pct: 3, years: 3 } as const;
const RES = adjustPlan({
  rent: EX_RES.rent, lease: 'residential', basis: 'percent', pct: EX_RES.pct, share75: false,
  startYm: `${CAP_YEAR + 1}-01`, years: EX_RES.years, existingLease: true,
});
const SIMPLE = EX_RES.rent * (1 + (EX_RES.pct / 100) * EX_RES.years);
const EX_COM = { rent: 1_500, pct: 5 } as const;
const COM = adjustPlan({
  rent: EX_COM.rent, lease: 'commercial', basis: 'percent', pct: EX_COM.pct, share75: false,
  startYm: CAP.from.slice(0, 7), years: 2, existingLease: true,
});
const LATEST = RENT_INDEX[RENT_INDEX_LATEST];
const LATEST_75 = rentAdjustmentPct(LATEST, true);

type FaqItem = { q: string; a: string; link?: { href: string; label: string } };
const PLAFON = guideAt('/odigos/plafon-3-emporikes-misthoseis-2026');

const FAQ: FaqItem[] = [
  {
    q: 'Πόσο μπορεί να αυξηθεί το ενοίκιο κατοικίας;',
    a: `Για το ${CAP_YEAR} δεν υπάρχει γενικό κρατικό πλαφόν στα ενοίκια κατοικίας. Το ενοίκιο αυξάνεται μόνο `
     + 'με ρητό όρο αναπροσαρμογής στη σύμβαση ή με νέα συμφωνία που αποδέχεται ο μισθωτής. Ο υπολογιστής '
     + 'εφαρμόζει τον όρο όπως είναι γραμμένος: σταθερό ποσοστό ή τον Δείκτη Τιμών Καταναλωτή της ΕΛΣΤΑΤ.',
  },
  {
    q: `Τι ισχύει στην επαγγελματική μίσθωση το ${CAP_YEAR};`,
    a: `Στις υφιστάμενες επαγγελματικές μισθώσεις του ΠΔ 34/1995 η αναπροσαρμογή από ${grDate(CAP.from)} έως `
     + `${grDate(CAP.to)} δεν ξεπερνά το ${CAP_PCT} επί του μισθώματος του ${CAP_YEAR - 1}. Με μίσθωμα ${feWhole(EX_COM.rent)} `
     + `και όρο ${fpRate(EX_COM.pct)}, το νέο μίσθωμα είναι ${fe(COM.rows[0].to)} και όχι ${fe(COM.rows[0].uncapped)}. `
     + `Την επόμενη χρονιά ο όρος εφαρμόζεται πάνω στο μίσθωμα που έμεινε: ${fe(COM.rows[1].to)}. Το όριο δεν ισχύει `
     + `σε νέα μίσθωση του ${CAP_YEAR} ούτε για τους εκμισθωτές που εξαιρεί ο νόμος.`,
    link: { href: PLAFON.href, label: `Οδηγός: ${PLAFON.title}` },
  },
  {
    q: 'Ποιον ΔΤΚ χρησιμοποιώ;',
    a: 'Τη δωδεκάμηνη μεταβολή του Δείκτη Τιμών Καταναλωτή που ανακοινώνει κάθε μήνα η ΕΛΣΤΑΤ για την '
     + `αναπροσαρμογή των μισθωμάτων. Για αναπροσαρμογή τον μήνα ${indexMonthLabel(RENT_INDEX_LATEST)} είναι ${fpRate(LATEST)}, `
     + `δηλαδή η μεταβολή ${indexPeriodLabel(RENT_INDEX_LATEST)}. Το ίδιο δελτίο δίνει και το 75% της (${fpRate(LATEST_75)}) `
     + 'για συμβάσεις που ορίζουν αυτό. Ο Εναρμονισμένος Δείκτης (ΕνΔΤΚ) της Eurostat είναι άλλος δείκτης.',
  },
  {
    q: 'Γιατί μετά από χρόνια η αύξηση είναι πάνω από ποσοστό επί έτη;',
    a: 'Γιατί κάθε αναπροσαρμογή γίνεται πάνω στο μίσθωμα που άφησε η προηγούμενη. Με '
     + `${feWhole(EX_RES.rent)} και ${fpRate(EX_RES.pct)} τον χρόνο, σε ${EX_RES.years} χρόνια το μίσθωμα γίνεται `
     + `${RES.rows.map(r => fe(r.to)).join(', ')}. Με απλή πρόσθεση θα ήταν ${fe(SIMPLE)}.`,
  },
  {
    q: 'Πότε γίνεται η αναπροσαρμογή;',
    a: 'Όπως ορίζει η σύμβαση. Ο υπολογιστής υποθέτει μία αναπροσαρμογή τον χρόνο τον ίδιο μήνα '
     + 'και παίρνει τον δείκτη της ΕΛΣΤΑΤ για εκείνον τον μήνα. Αν ο όρος είναι διατυπωμένος ασαφώς, '
     + 'επιβεβαίωσε με δικηγόρο ή λογιστή πριν στείλεις ειδοποίηση στον μισθωτή.',
  },
  TOOL_PRIVACY_FAQ,
];

const SRC_LINK = { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 } as const;
const NUM = { color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' } as const;
const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

/** Ο τελευταίος δείκτης της ΕΛΣΤΑΤ, πάνω από τη φόρμα, στο HTML της σελίδας. */
function IndexNote() {
  return (
    <aside className="po-tool-sources" aria-label="Ο δείκτης της ΕΛΣΤΑΤ" style={{ margin: '0 0 clamp(20px,3vw,28px)' }}>
      <span className="po-src-badge">ΔΤΚ ΕΛΣΤΑΤ</span>
      <span className="po-src-txt">
        Για αναπροσαρμογή τον μήνα {indexMonthLabel(RENT_INDEX_LATEST)}:{' '}
        <strong style={NUM}>{fpRate(LATEST)}</strong> (75%: <strong style={NUM}>{fpRate(LATEST_75)}</strong>),
        {' '}μεταβολή {indexPeriodLabel(RENT_INDEX_LATEST)}.{' '}
        <a href={CPI_SOURCE_URL} rel="noopener noreferrer" className="lp-link" style={SRC_LINK}>ΕΛΣΤΑΤ</a>,
        {' '}ελέγχθηκε {grDate(CPI_CONFIRMED_AT)}.
      </span>
    </aside>
  );
}

export default function Page() {
  const today = athensToday();
  const yieldGuide = guideAt('/odigos/kathari-apodosi-akinitou');
  const jsonLd = toolJsonLd({ name: 'Υπολογισμός αναπροσαρμογής ενοικίου', url: URL, description: DESC, faq: FAQ });

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />

      <PublicHeader />

      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <div className="lp-eyebrow">Υπολογιστής</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: T.weight.bold, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {H1}
        </h1>
        <ToolLede>Το νέο μίσθωμα με τον όρο της σύμβασης, ο πίνακας ανά έτος και το όριο {CAP_PCT} όπου ισχύει.</ToolLede>

        <IndexNote />

        {/* Ο υπολογιστής διαβάζει τη διεύθυνση, άρα θέλει όριο αναμονής: χωρίς
            αυτό ολόκληρη η σελίδα βγαίνει από τη στατική απόδοση. */}
        <Suspense fallback={<div style={{ minHeight: 640 }} aria-hidden/>}>
          <AdjustCalculator today={today} cta={
            <ToolCta
              title="Θέλεις την αναπροσαρμογή έτοιμη κάθε χρόνο;"
              body="Το PROPERWISE κρατά το μίσθωμα κάθε μίσθωσης, θυμίζει πότε έρχεται η αναπροσαρμογή και ετοιμάζει την ειδοποίηση προς τον μισθωτή με το σωστό ποσό."
            />
          }/>
        </Suspense>

        <ToolSources kind="adjust" checked={CPI_CONFIRMED_AT} updated={PAGE_UPDATED[PATH]} />

        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Συχνές ερωτήσεις" title="Ό,τι ρωτούν πριν αυξήσουν το ενοίκιο" />
          <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {FAQ.map(f => (
              <details key={f.q} className="lp-faq">
                <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15,
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  {f.q}
                  <span className="lp-plus" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: T.weight.body,
                    lineHeight: 1, transition: 'transform .2s', flexShrink: 0 }}>+</span>
                </summary>
                <p className="po-just" style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                  {hy(f.a)}
                </p>
                {f.link && (
                  <p style={{ margin: '-6px 0 16px', fontSize: 14 }}>
                    <Link href={f.link.href} className="lp-link" style={LINK}>{f.link.label}</Link>
                  </p>
                )}
              </details>
            ))}
          </div>
        </section>

        {/* ΤΟ ΝΕΟ ΜΙΣΘΩΜΑ ΕΧΕΙ ΣΥΝΕΧΕΙΑ: φόρο και καθαρή απόδοση. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Και μετά" title="Με το νέο μίσθωμα: φόρος και απόδοση" />
          <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{hy(<>
            Το νέο ενοίκιο ανεβάζει και τον φόρο: ο{' '}
            <Link href="/ypologismos-forou-enoikion" className="lp-link" style={LINK}>υπολογισμός φόρου ενοικίων</Link>
            {' '}δείχνει πόσο, με την κλίμακα της χρονιάς. Τι μένει μετά τον φόρο, τον ΕΝΦΙΑ και τις δαπάνες το
            βγάζει η{' '}
            <Link href="/kathari-apodosi" className="lp-link" style={LINK}>καθαρή απόδοση</Link>
            · ο οδηγός{' '}
            <Link href={yieldGuide.href} className="lp-link" style={LINK}>{yieldGuide.title}</Link>
            {' '}εξηγεί τη διαφορά από τη μεικτή.
          </>)}</p>
          <ToolOnwardLinks />
        </section>
        <ToolByline />
        <ToolGuides tool="/anaprosarmogi-enoikiou" />
      </main>

      <PublicFooter />
    </div>
  );
}
