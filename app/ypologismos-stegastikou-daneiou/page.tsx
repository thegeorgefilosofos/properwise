// ═══════════════════════════════════════════════════════════════════════════
// ΥΠΟΛΟΓΙΣΜΟΣ ΔΟΣΗΣ ΣΤΕΓΑΣΤΙΚΟΥ: η δημόσια σελίδα
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΠΕΜΠΤΟ ΕΡΓΑΛΕΙΟ. Τα τέσσερα που υπήρχαν μιλούν σε όποιον ΕΧΕΙ ήδη
// ακίνητο. Η πιο συχνή ερώτηση πριν από αυτό είναι «πόση δόση θα πληρώνω» και
// «πόσο δάνειο μου δίνουν με τον μισθό μου». Η εφαρμογή απαντά ήδη και στις δύο
// μέσα στον πίνακα ελέγχου· εδώ οι ίδιες συναρτήσεις γίνονται προσβάσιμες
// χωρίς εγγραφή.
//
// ΤΟ ΜΕΣΟ ΕΠΙΤΟΚΙΟ ΕΧΕΙ ΗΜΕΡΟΜΗΝΙΑ Ή ΔΕΝ ΓΡΑΦΕΤΑΙ. Ο διακομιστής διαβάζει την
// ταυτότητα της τιμής από τον δημόσιο πίνακα `market_rates` (ΕΚΤ, στοιχεία
// Τράπεζας της Ελλάδος) και η απάντηση κρατιέται μία ημέρα, ώστε η βάση να μη
// ρωτιέται σε κάθε επίσκεψη. Όταν η βάση δεν απαντά, η σελίδα το λέει και ζητά
// το επιτόκιο της προσφοράς.
//
// ΤΡΕΙΣ ΣΕΙΡΕΣ, ΟΧΙ ΜΙΑ (P0, 13/10/2026). Η σελίδα έγραφε «Νέα στεγαστικά» με
// την τιμή της σειράς A2C.F (κυμαινόμενο ή σταθερό έως 1 έτος) και την ίδια
// τιμή έβαζε στο «Σταθερό επιτόκιο». Τώρα γράφει τον μέσο όρο (A2C.A),
// το κυμαινόμενο ή έως 1 έτος (A2C.F) και το σταθερό πάνω από 1 έτος (A2C.K),
// με τις ετικέτες του καταλόγου lib/market/ecb.ts. Το ίδιο κείμενο μπαίνει στην
// περιγραφή της σελίδας για τη μηχανή αναζήτησης (`generateMetadata`).
//
// ΟΧΙ ΥΠΟΣΧΕΣΗ ΕΓΚΡΙΣΗΣ. Το «πόσο δάνειο» είναι το ταβάνι του δείκτη δόσης
// προς εισόδημα και τίποτε άλλο· η σελίδα το γράφει δίπλα στο νούμερο.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { athensParts, athensToday } from '@/lib/core/time';
import { fe, feWhole, fp, fpRate } from '@/lib/core/format';
import { DSTI_LIMIT } from '@/lib/loans/affordability';
import { spitiMouOpen, spitiMouClosedSentence, SPITI_MOU, SPITI_MOU_3, spitiMou3Line } from '@/lib/loans/recommend';
import { programDateLabel } from '@/lib/loans/programStatus';
import {
  mortgagePlan, borrowingCapacity, housingNote, marketDescription, type MarketFact, type MortgageMarket,
} from '@/lib/tools/stegastiko';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, ToolLede, ToolSources, ToolCta, TOOL_PRIVACY_FAQ, WRAP, WRAP_PAD } from '../PublicChrome';
import { ToolGuides } from '../odigos/ToolGuides';
import { hy } from '@/components/Hyphen';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { toolBreadcrumb } from '../toolSeo';
import { guideAt } from '../odigos/guides';
import { MortgageCalculator } from './MortgageCalculator';
import { readMortgageMarket } from './marketRates';

// Μία ώρα το πολύ: η τροφοδοσία γράφει κάθε πρωί και η σελίδα δεν σερβίρει τη
// χθεσινή γραμμή (βλ. marketRates.ts). Η κατάσταση του «Σπίτι μου ΙΙ» στις
// Συχνές ερωτήσεις κρίνεται με την ημερομηνία της απόδοσης.
export const revalidate = 3600;

/** Ο οδηγός «τι ίσχυε, τι αλλάζει» για τα προγράμματα «Σπίτι μου», κάτω από την ερώτηση για το ΙΙΙ. */
const SPITI_GUIDE = guideAt('/odigos/spiti-mou-3-ti-allazei');

// Η ΦΡΑΣΗ ΠΟΥ ΓΡΑΦΕΙ Ο ΚΟΣΜΟΣ (Bing, 03.10.2026): στο σκέτο «στεγαστικό δάνειο»
// την πρώτη δεκάδα την έχουν οι τράπεζες. Οι ουδέτεροι υπολογιστές μπαίνουν με
// τη μακρύτερη αναζήτηση: δόση, τόκοι, πόσο δάνειο.
// Το έτος του τίτλου είναι το τρέχον, όπως στον ΕΝΦΙΑ: γραμμένο «2026» με το
// χέρι, την 01/01/2027 θα έλεγε άλλη χρονιά από τη σελίδα (20.10.2026).
const titleFor = (year: number) => `Υπολογιστής στεγαστικού δανείου ${year}: δόση, τόκοι, πόσο δάνειο παίρνω`;
const URL = siteUrl('/ypologismos-stegastikou-daneiou');

// Η ΠΕΡΙΓΡΑΦΗ ΞΕΚΙΝΑ ΜΕ ΤΙΣ ΤΙΜΕΣ ΤΗΣ ΑΓΟΡΑΣ, ΑΠΟ ΤΙΣ ΣΕΙΡΕΣ. Ήταν στατική και η
// μηχανή αναζήτησης έπαιρνε το απόσπασμα από τη σημείωση της σελίδας, που έγραφε
// το κυμαινόμενο ως μέσο όρο. Η ανάγνωση της βάσης είναι η ίδια με της σελίδας
// (`readMortgageMarket`, μία φορά ανά αίτημα). Χωρίς τιμές, μένει η στατική.
// Από 27.10.2026 μόνο το μέσο επιτόκιο και σύντομη ουρά, κάτω από τους 160
// χαρακτήρες (lib/tools/stegastiko.ts, `marketDescription`).
export async function generateMetadata(): Promise<Metadata> {
  const market = await readMortgageMarket(athensToday());
  return publicMetadata({
    title: titleFor(athensParts().year), description: marketDescription(market), url: URL,
    image: shareImage('ypologismos-stegastikou-daneiou'),
  });
}

// ΤΑ ΠΑΡΑΔΕΙΓΜΑΤΑ ΤΩΝ ΑΠΑΝΤΗΣΕΩΝ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΗ ΜΗΧΑΝΗ. Το επιτόκιο τους είναι
// παράδειγμα και το λένε· δεν παρουσιάζεται ως τρέχον.
const EX = { amount: 150_000, rate: 3.5, years: 25, income: 2_000 };
const EX_PLAN = mortgagePlan(EX.amount, EX.rate, EX.years);
const EX_CAP = borrowingCapacity({
  incomeMonthly: EX.income, firstTimeBuyer: true, existingMonthlyDebt: 0,
  desiredAmount: EX.amount, ratePct: EX.rate, years: EX.years,
});
const FIRST = fpRate(DSTI_LIMIT.firstTimeBuyer * 100);
const OTHER = fpRate(DSTI_LIMIT.other * 100);

/** Οι ερωτήσεις, με την κατάσταση του προγράμματος όπως είναι σήμερα. */
/** Μια ερώτηση με προαιρετικό σύνδεσμο κάτω από την απάντηση (όχι στο FAQPage). */
type FaqItem = { q: string; a: string; link?: { href: string; label: string } };

function faq(today: string): FaqItem[] {
  return [
    {
      q: 'Πώς υπολογίζεται η μηνιαία δόση στεγαστικού;',
      a: 'Με τον τύπο του τοκοχρεολυτικού δανείου: η δόση μένει ίδια κάθε μήνα και στην αρχή '
       + `είναι κυρίως τόκος. Για παράδειγμα, με επιτόκιο ${fp(EX.rate)} ένα δάνειο ${feWhole(EX.amount)} για ${EX.years} χρόνια `
       + `έχει δόση ${fe(EX_PLAN.monthly)} και τόκους ${fe(EX_PLAN.totalInterest)} συνολικά. Τον πρώτο χρόνο `
       + `πληρώνεις ${fe(EX_PLAN.firstYear.interest)} τόκους και μόλις ${fe(EX_PLAN.firstYear.principal)} κεφάλαιο.`,
    },
    {
      q: 'Πόσο δάνειο μπορώ να πάρω με τον μισθό μου;',
      a: 'Η Τράπεζα της Ελλάδος βάζει όριο στη δόση: όλες οι δόσεις μαζί έως '
       + `${FIRST} του καθαρού εισοδήματος για όσους δανείζονται πρώτη φορά και ${OTHER} για τους υπόλοιπους `
       + '(ΠΕΕ 227/1/08.03.2024, από 01/01/2025). Το κριτήριο είναι αν δανείζεσαι πρώτη φορά, όχι αν είναι η '
       + `πρώτη σου κατοικία. Με καθαρό ${feWhole(EX.income)} τον μήνα, την πρώτη φορά, η δόση φτάνει ως `
       + `${feWhole(EX_CAP.maxMonthly)}: με ${fp(EX.rate)} σε ${EX.years} χρόνια αυτό είναι δάνειο έως ${feWhole(EX_CAP.maxLoan)}. `
       + 'Είναι ταβάνι, όχι έγκριση. Η τράπεζα κρίνει και την ίδια συμμετοχή, τη σταθερότητα του '
       + 'εισοδήματος και το ιστορικό πληρωμών.',
    },
    {
      q: 'Σταθερό ή κυμαινόμενο επιτόκιο;',
      a: 'Στο σταθερό η δόση δεν αλλάζει όσο διαρκεί η σταθερή περίοδος της σύμβασης. Στο κυμαινόμενο '
       + 'το επιτόκιο είναι Euribor συν το περιθώριο της τράπεζας και η δόση αναπροσαρμόζεται όταν '
       + 'αλλάζει το Euribor, προς τα πάνω ή προς τα κάτω. Ο υπολογιστής δείχνει πόσο θα ήταν η δόση '
       + 'αν το Euribor ανέβει μία μονάδα.',
    },
    {
      q: 'Ισχύει το «Σπίτι μου ΙΙ»;',
      a: spitiMouOpen(today)
        ? `Το πρόγραμμα δέχεται αιτήσεις έως ${programDateLabel(SPITI_MOU.applicationDeadline)}, με τους όρους του `
          + 'φορέα του. Ο υπολογιστής λογαριάζει το δάνειο της τράπεζας όπως είναι, χωρίς το πρόγραμμα.'
        : `${spitiMouClosedSentence(today)} Ο υπολογιστής λογαριάζει το δάνειο της τράπεζας όπως είναι, `
          + 'χωρίς κρατικό πρόγραμμα.',
    },
    // Ο ΚΟΣΜΟΣ ΨΑΧΝΕΙ «ΣΠΙΤΙ ΜΟΥ 3». Η σελίδα απαντούσε μόνο για το ΙΙ, οπότε η
    // απάντηση ερχόταν από τον Τύπο, με όρια σαν να ήταν κλειδωμένα. Η πρόταση
    // είναι η ίδια με του καταλόγου και της Νόας (`spitiMou3Line`) και περνά και
    // στο FAQPage από κάτω.
    {
      q: `Πότε ανοίγει το «${SPITI_MOU_3.name}»;`,
      a: `${spitiMou3Line()} Όρια εισοδήματος, αξίας ή δανείου που κυκλοφορούν σε δημοσιεύματα `
        + 'δεν είναι όροι του προγράμματος. Ο υπολογιστής λογαριάζει το δάνειο της τράπεζας όπως είναι.',
      // Ο οδηγός βάζει δίπλα δίπλα τα όρια του Ι και του ΙΙ και τα επίσημα του ΙΙΙ.
      link: { href: SPITI_GUIDE.href, label: `Οδηγός: ${SPITI_GUIDE.title}` },
    },
    TOOL_PRIVACY_FAQ,
  ];
}

/** Μία τιμή αγοράς με την ημερομηνία και την πηγή της. */
function Fact({ label, f }: { label: string; f: MarketFact }) {
  return (
    <>
      {label} <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fp(f.value)}</strong>
      {' '}({f.basis ? `${f.basis} ` : ''}{f.period}, {f.url
        ? <a href={f.url} rel="noopener noreferrer" className="lp-link" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>{f.source}</a>
        : f.source}){f.stale ? ', η πηγή δεν έχει δώσει νεότερη τιμή' : ''}.
    </>
  );
}

const SRC_LINK = { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 } as const;
const NUM = { color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' } as const;

/**
 * ΤΟ ΜΕΣΟ ΕΠΙΤΟΚΙΟ ΤΗΣ ΑΓΟΡΑΣ, ΠΑΝΩ ΑΠΟ ΤΗ ΦΟΡΜΑ. Στο HTML της σελίδας, ώστε να
 * το διαβάζει και η μηχανή αναζήτησης. Χωρίς τιμή, η ίδια θέση λέει ότι δεν
 * υπάρχει και τι να κάνει ο επισκέπτης.
 *
 * Τα στεγαστικά γράφονται από τα κομμάτια της `housingNote`, τα ίδια που δίνουν
 * και την περιγραφή της σελίδας: εδώ μόνο γίνονται έντονα και σύνδεσμοι.
 */
function MarketNote({ market }: { market: MortgageMarket }) {
  const { euribor } = market;
  const housing = housingNote(market);
  return (
    <aside className="po-tool-sources" aria-label="Μέσο επιτόκιο αγοράς" style={{ margin: '0 0 clamp(20px,3vw,28px)' }}>
      <span className="po-src-badge">Μέσο επιτόκιο αγοράς</span>
      <span className="po-src-txt">
        {housing.length || euribor ? <>
          {housing.map((x, i) => {
            const text = x.strong ? <strong style={NUM}>{x.text}</strong> : x.text;
            return x.href
              ? <a key={i} href={x.href} rel="noopener noreferrer" className="lp-link" style={SRC_LINK}>{text}</a>
              : <Fragment key={i}>{text}</Fragment>;
          })}
          {housing.length > 0 && euribor && ' '}
          {euribor && <Fact label="Euribor τριμήνου:" f={euribor}/>}
          {' '}Η προσφορά της τράπεζάς σου μπορεί να διαφέρει.
        </> : (
          'Το μέσο επιτόκιο της αγοράς δεν είναι διαθέσιμο αυτή τη στιγμή. Γράψε το επιτόκιο της προσφοράς σου.'
        )}
      </span>
    </aside>
  );
}

const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;

export default async function Page() {
  const today = athensToday();
  const market = await readMortgageMarket(today);
  const FAQ = faq(today);
  const yieldGuide = guideAt('/odigos/kathari-apodosi-akinitou');
  const enfiaGuide = guideAt('/odigos/pos-ypologizetai-o-enfia');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Υπολογισμός δόσης στεγαστικού δανείου',
        url: URL,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        inLanguage: 'el',
        description: marketDescription(market),
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
      toolBreadcrumb('/ypologismos-stegastikou-daneiou'),
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map(f => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />

      <PublicHeader />

      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <div className="lp-eyebrow">Υπολογιστής</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          Υπολογισμός δόσης στεγαστικού δανείου
        </h1>
        <ToolLede>Η μηνιαία δόση με σταθερό ή κυμαινόμενο επιτόκιο, οι τόκοι ανά έτος και πόσο δάνειο μπορείς να πάρεις με το εισόδημά σου.</ToolLede>

        <MarketNote market={market}/>

        {/* Ο υπολογιστής διαβάζει τη διεύθυνση, άρα θέλει όριο αναμονής: χωρίς
            αυτό ολόκληρη η σελίδα βγαίνει από τη στατική απόδοση. */}
        <Suspense fallback={<div style={{ minHeight: 560 }} aria-hidden/>}>
          <MortgageCalculator market={market} today={today} cta={
            <ToolCta
              title="Θέλεις να βλέπεις τι χρωστάς ακόμη, κάθε μήνα;"
              body="Το PROPERWISE κρατά το δάνειο μαζί με το ακίνητο: τη δόση, το υπόλοιπο και τους τόκους κάθε χρονιάς. Δεν εγκρίνει δάνεια και δεν μιλά για λογαριασμό καμίας τράπεζας."
            />
          }/>
        </Suspense>

        <ToolSources kind="loan" checked={null} />

        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Συχνές ερωτήσεις" title="Ό,τι ρωτούν πριν ζητήσουν δάνειο" />
          <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {FAQ.map(f => (
              <details key={f.q} className="lp-faq">
                <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '17px 0', fontSize: 15,
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  {f.q}
                  <span className="lp-plus" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 450,
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

        {/* ΤΟ ΔΑΝΕΙΟ ΕΙΝΑΙ Η ΑΡΧΗ ΤΗΣ ΑΛΥΣΙΔΑΣ. Μετά την αγορά έρχονται ο φόρος
            κατοχής και, αν το ακίνητο νοικιαστεί, η απόδοση. Οι δύο υπολογιστές
            και οι δύο οδηγοί τους απαντούν στην επόμενη ερώτηση. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Και μετά" title="Μετά την αγορά: ΕΝΦΙΑ και απόδοση" />
          <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{hy(<>
            Κάθε χρόνο θα πληρώνεις{' '}
            <Link href="/ypologismos-enfia" className="lp-link" style={LINK}>ΕΝΦΙΑ</Link>
            {' '}για το ακίνητο· ο οδηγός{' '}
            <Link href={enfiaGuide.href} className="lp-link" style={LINK}>{enfiaGuide.title}</Link>
            {' '}εξηγεί από τι εξαρτάται. Αν θα το νοικιάσεις, η{' '}
            <Link href="/kathari-apodosi" className="lp-link" style={LINK}>καθαρή απόδοση</Link>
            {' '}δείχνει τι μένει μετά τον φόρο και τα έξοδα, πριν από τη δόση· ο οδηγός{' '}
            <Link href={yieldGuide.href} className="lp-link" style={LINK}>{yieldGuide.title}</Link>
            {' '}εξηγεί γιατί η μεικτή απόδοση των αγγελιών δείχνει πάντα περισσότερα.
          </>)}</p>
        </section>
        <ToolGuides tool="/ypologismos-stegastikou-daneiou" />
      </main>

      <PublicFooter />
    </div>
  );
}
