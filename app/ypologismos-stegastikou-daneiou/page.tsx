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
import { fe, feWhole, fn, fp, fpRate } from '@/lib/core/format';
import { DSTI_LIMIT } from '@/lib/loans/affordability';
import { spitiMouOpen, spitiMouClosedSentence, SPITI_MOU, SPITI_MOU_3, spitiMou3Line } from '@/lib/loans/recommend';
import { programDateLabel } from '@/lib/loans/programStatus';
import {
  mortgagePlan, borrowingCapacity, housingNote, marketDescription, rateField, RATE_SHOCK, type MarketFact, type MortgageMarket,
} from '@/lib/tools/stegastiko';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, ToolLede, ToolSources, ToolCta, TOOL_PRIVACY_FAQ, WRAP, WRAP_PAD } from '../PublicChrome';
import { ToolGuides } from '../odigos/ToolGuides';
import { hy } from '@/components/Hyphen';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { toolJsonLd, ToolByline } from '../toolSeo';
import { ToolLedger } from '../ToolParts';
import { PAGE_UPDATED } from '../pageUpdated';
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
// CTR 13.11.2026: 0,9% σε θέση 15,4 (Search Console, τρίμηνο) με τίτλο 69
// χαρακτήρων, κομμένο. Τώρα κάτω από 60, με την αναζήτηση μπροστά· το «πόσο
// δάνειο παίρνω» μένει στην περιγραφή.
const titleFor = (year: number) => `Υπολογισμός στεγαστικού δανείου ${year}: δόση και τόκοι`;
const PATH = '/ypologismos-stegastikou-daneiou';
const URL = siteUrl(PATH);

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
// Τα κείμενα κάτω από τη φόρμα (13/11/2026) παίρνουν από εδώ και τις
// παραλλαγές τους: συντομότερη και μακρύτερη διάρκεια, ένα βήμα ποσού και το
// έτος στο οποίο γράφεται το υπόλοιπο. Κανένα ψηφίο δεν γράφεται στο κείμενο.
const EX = { amount: 150_000, rate: 3.5, years: 25, income: 2_000, shorter: 20, longer: 30, step: 10_000, checkpoint: 10 };
const EX_PLAN = mortgagePlan(EX.amount, EX.rate, EX.years);
/** Ο τύπος της δόσης, κομμάτι κομμάτι: μηνιαίο επιτόκιο, δόσεις, συντελεστής ανατοκισμού. */
const EX_R = EX.rate / 100 / 12;
const EX_Q = Math.pow(1 + EX_R, EX_PLAN.months);
/** Το ίδιο δάνειο με το Euribor ψηλότερα κατά `RATE_SHOCK`, όπως το σενάριο της κάρτας. */
const EX_SHOCK = mortgagePlan(EX.amount, EX.rate + RATE_SHOCK, EX.years);
const EX_SHORT = mortgagePlan(EX.amount, EX.rate, EX.shorter);
const EX_LONG = mortgagePlan(EX.amount, EX.rate, EX.longer);
const EX_STEP = mortgagePlan(EX.step, EX.rate, EX.years);
const EX_LEFT = EX_PLAN.schedule[EX.checkpoint - 1]?.balance ?? 0;
/** Το παράδειγμα ανοιχτό στη φόρμα, με τα πεδία της διεύθυνσης του υπολογιστή. */
const EX_HREF = `${PATH}?${new URLSearchParams({
  poso: String(EX.amount), eti: String(EX.years), typos: 'stathero', epitokio: rateField(EX.rate),
})}`;
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
       + `είναι κυρίως τόκος. Για παράδειγμα, με επιτόκιο ${fp(EX.rate)} ένα δάνειο ${feWhole(EX.amount)} για ${EX.years} χρόνια `
       + `έχει δόση ${fe(EX_PLAN.monthly)} και τόκους ${fe(EX_PLAN.totalInterest)} συνολικά. Τον πρώτο χρόνο `
       + `πληρώνεις ${fe(EX_PLAN.firstYear.interest)} τόκους και μόλις ${fe(EX_PLAN.firstYear.principal)} κεφάλαιο.`,
    },
    {
      q: 'Πόσο δάνειο μπορώ να πάρω με τον μισθό μου;',
      a: 'Η Τράπεζα της Ελλάδος βάζει όριο στη δόση: όλες οι δόσεις μαζί έως '
       + `${FIRST} του καθαρού εισοδήματος για όσους δανείζονται πρώτη φορά και ${OTHER} για τους υπόλοιπους `
       + '(ΠΕΕ 227/1/08.03.2024, από 01/01/2025). Το κριτήριο είναι αν δανείζεσαι πρώτη φορά, όχι αν είναι η '
       + `πρώτη σου κατοικία. Με καθαρό ${feWhole(EX.income)} τον μήνα, την πρώτη φορά, η δόση φτάνει ως `
       + `${feWhole(EX_CAP.maxMonthly)}: με ${fp(EX.rate)} σε ${EX.years} χρόνια αυτό είναι δάνειο έως ${feWhole(EX_CAP.maxLoan)}. `
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
const PROSE = { fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 } as const;

export default async function Page() {
  const today = athensToday();
  const market = await readMortgageMarket(today);
  const FAQ = faq(today);
  const yieldGuide = guideAt('/odigos/kathari-apodosi-akinitou');
  const enfiaGuide = guideAt('/odigos/pos-ypologizetai-o-enfia');

  // Το ίδιο σχήμα με τους άλλους υπολογιστές (app/toolSeo.tsx): εφαρμογή με
  // συντάκτη και εκδότη, διαδρομή και οι ερωτήσεις που αποδίδει η σελίδα.
  const jsonLd = toolJsonLd({ name: 'Υπολογισμός δόσης στεγαστικού δανείου', url: URL, description: marketDescription(market), faq: FAQ });
  const hasMarket = housingNote(market).length > 0 || !!market.euribor;

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
          <MortgageCalculator market={market} today={today} exampleRate={EX.rate} cta={
            <ToolCta
              title="Θέλεις να βλέπεις τι χρωστάς ακόμη, κάθε μήνα;"
              body="Το PROPERWISE κρατά το δάνειο μαζί με το ακίνητο: τη δόση, το υπόλοιπο και τους τόκους κάθε χρονιάς. Δεν εγκρίνει δάνεια και δεν μιλά για λογαριασμό καμίας τράπεζας."
            />
          }/>
        </Suspense>

        <ToolSources kind="loan" checked={null} updated={PAGE_UPDATED[PATH]} />

        {/* ── ΤΑ ΚΕΙΜΕΝΑ ΚΑΤΩ ΑΠΟ ΤΗ ΦΟΡΜΑ (13/11/2026) ─────────────────────────
            Ο έλεγχος SEO βρήκε τη σελίδα σχεδόν χωρίς κείμενο σε σχέση με τους
            άλλους υπολογιστές. Τέσσερα κομμάτια: ο τύπος, ένα λυμένο
            παράδειγμα, σταθερό ή κυμαινόμενο και τι κινεί τη δόση. Κάθε ποσό
            βγαίνει από τη μηχανή της φόρμας (`mortgagePlan`) με το παράδειγμα
            του `EX`· το επιτόκιο του παραδείγματος δεν παρουσιάζεται ως τρέχον. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Ο τύπος" title="Πώς υπολογίζεται η μηνιαία δόση" />
          <p className="po-just" style={{ ...PROSE, marginBottom: 12 }}>{hy(
            'Το στεγαστικό αποπληρώνεται τοκοχρεολυτικά: πληρώνεις την ίδια δόση κάθε μήνα και κάθε δόση έχει δύο κομμάτια. '
            + 'Το ένα είναι ο τόκος του μήνα πάνω στο υπόλοιπο που χρωστάς. Το άλλο είναι κεφάλαιο, που μειώνει το υπόλοιπο. '
            + 'Επειδή το υπόλοιπο πέφτει, ο τόκος μικραίνει από μήνα σε μήνα ενώ το κομμάτι του κεφαλαίου μεγαλώνει.')}</p>
          <p className="po-just" style={PROSE}>{hy(
            'Η δόση βγαίνει από τρία στοιχεία: το κεφάλαιο, το μηνιαίο επιτόκιο r (το ετήσιο διά δώδεκα) και τον αριθμό των δόσεων n (τα έτη επί δώδεκα). '
            + 'Με q τον συντελεστή ανατοκισμού όλης της διάρκειας, δηλαδή το «ένα συν r» υψωμένο στη δύναμη n, '
            + 'η δόση είναι το κεφάλαιο επί r επί q, διά το q μειωμένο κατά ένα. Είναι ο τύπος της σταθερής δόσης (annuity) που χρησιμοποιεί και ο υπολογιστής.')}</p>
        </section>

        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Λυμένο παράδειγμα" title={`${feWhole(EX.amount)} για ${EX.years} χρόνια με ${fp(EX.rate)}: δόση ${fe(EX_PLAN.monthly)}`} />
          <p className="po-just" style={{ ...PROSE, marginBottom: 16 }}>{hy(
            'Το επιτόκιο είναι παράδειγμα, όχι η τιμή της αγοράς σήμερα. Τη μέση τιμή της αγοράς τη γράφει το πλαίσιο πάνω από τη φόρμα.')}</p>
          <ToolLedger rows={[
            { k: 'Κεφάλαιο', v: feWhole(EX.amount) },
            { k: `Μηνιαίο επιτόκιο r: ${fp(EX.rate)} διά δώδεκα`, v: `${fn(EX_R * 100, 4)}%`, kind: 'param' },
            { k: `Δόσεις n: ${EX.years} έτη επί δώδεκα`, v: fn(EX_PLAN.months), kind: 'param' },
            { k: 'Συντελεστής ανατοκισμού q', v: fn(EX_Q, 4), kind: 'param' },
            { k: 'Δόση του παραδείγματος', v: fe(EX_PLAN.monthly), kind: 'total' },
          ]}/>
          <p className="po-just" style={{ ...PROSE, marginTop: 16 }}>{hy(<>
            Σε {fn(EX_PLAN.months)} δόσεις πληρώνεις συνολικά {fe(EX_PLAN.totalPaid)}: τα {feWhole(EX.amount)} είναι το κεφάλαιο
            {' '}και τα {fe(EX_PLAN.totalInterest)} τόκοι. Τον πρώτο χρόνο πληρώνεις {fe(EX_PLAN.firstYear.interest)} τόκους
            {' '}και μόλις {fe(EX_PLAN.firstYear.principal)} κεφάλαιο. Μετά από {EX.checkpoint} χρόνια χρωστάς ακόμη {fe(EX_LEFT)}.{' '}
            <Link href={EX_HREF} className="lp-link" style={LINK}>Άνοιξε το παράδειγμα στον υπολογιστή</Link>.
          </>)}</p>
        </section>

        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Τύπος επιτοκίου" title="Σταθερό ή κυμαινόμενο επιτόκιο" />
          <p className="po-just" style={{ ...PROSE, marginBottom: 12 }}>{hy(
            'Με σταθερό επιτόκιο η δόση δεν αλλάζει όσο διαρκεί η σταθερή περίοδος της σύμβασης, που μπορεί να είναι μερικά χρόνια ή ολόκληρο το δάνειο. '
            + 'Για αυτό το διάστημα ξέρεις από την αρχή τι θα πληρώνεις, όπου κι αν πάνε τα επιτόκια της αγοράς. Στο τέλος της σταθερής περιόδου η σύμβαση ορίζει με ποιο επιτόκιο συνεχίζει το δάνειο.')}</p>
          <p className="po-just" style={{ ...PROSE, marginBottom: 12 }}>{hy(
            'Με κυμαινόμενο το επιτόκιο έχει δύο κομμάτια: το Euribor, που αλλάζει με την αγορά, συν το περιθώριο της τράπεζας, που ορίζει η σύμβαση. '
            + 'Όταν αλλάζει το Euribor, η δόση υπολογίζεται ξανά με τον ίδιο τύπο πάνω στο υπόλοιπο που απομένει.')}</p>
          <p className="po-just" style={PROSE}>{hy(
            `Στο παράδειγμα από πάνω, αν το επιτόκιο ήταν κυμαινόμενο και ανέβαινε κατά ${fn(RATE_SHOCK)} ποσοστιαία μονάδα, στο ${fp(EX.rate + RATE_SHOCK)} για όλη τη διάρκεια, `
            + `η δόση θα γινόταν ${fe(EX_SHOCK.monthly)} αντί για ${fe(EX_PLAN.monthly)}: ${fe(EX_SHOCK.monthly - EX_PLAN.monthly)} περισσότερα τον μήνα `
            + `και ${fe(EX_SHOCK.totalInterest - EX_PLAN.totalInterest)} περισσότεροι τόκοι συνολικά. Όταν διαλέξεις κυμαινόμενο, ο υπολογιστής δείχνει το ίδιο σενάριο για το δικό σου δάνειο.`
            + (hasMarket ? ' Τα μέσα επιτόκια των νέων στεγαστικών και το Euribor τριμήνου, με τον μήνα και την πηγή τους, είναι στο πλαίσιο πάνω από τη φόρμα.' : ''))}</p>
        </section>

        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Τι αλλάζει τη δόση" title="Επιτόκιο, διάρκεια και ποσό" />
          <ul className="lg-ul">
            <li>{hy(<>
              <strong style={{ color: 'var(--text-primary)' }}>Το επιτόκιο.</strong>{' '}
              Με {fp(EX.rate)} το δάνειο του παραδείγματος έχει δόση {fe(EX_PLAN.monthly)}. Με {fp(EX.rate + RATE_SHOCK)} έχει {fe(EX_SHOCK.monthly)}.
            </>)}</li>
            <li>{hy(<>
              <strong style={{ color: 'var(--text-primary)' }}>Η διάρκεια.</strong>{' '}
              Τα ίδια {feWhole(EX.amount)} σε {EX.shorter} χρόνια έχουν δόση {fe(EX_SHORT.monthly)} και {fe(EX_SHORT.totalInterest)} τόκους.
              {' '}Σε {EX.longer} χρόνια η δόση πέφτει στα {fe(EX_LONG.monthly)} αλλά οι τόκοι ανεβαίνουν στα {fe(EX_LONG.totalInterest)}.
              {' '}Μεγαλύτερη διάρκεια σημαίνει μικρότερη δόση και περισσότερους τόκους.
            </>)}</li>
            <li>{hy(<>
              <strong style={{ color: 'var(--text-primary)' }}>Το ποσό.</strong>{' '}
              Η δόση ακολουθεί το κεφάλαιο αναλογικά: με τους ίδιους όρους κάθε {feWhole(EX.step)} δανείου προσθέτουν {fe(EX_STEP.monthly)} στη μηνιαία δόση.
            </>)}</li>
          </ul>
          <p className="po-just" style={{ ...PROSE, marginTop: 12 }}>{hy(
            `Πόσο ψηλά μπορεί να φτάσει η δόση το ορίζει ο δείκτης δόσης προς εισόδημα: όλες οι δόσεις μαζί έως ${FIRST} του καθαρού εισοδήματος `
            + `για όσους δανείζονται πρώτη φορά και ${OTHER} για τους υπόλοιπους. Ο υπολογιστής τον εφαρμόζει στο εισόδημα που γράφεις.`)}</p>
        </section>

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
          {/* ΤΑ ΕΞΟΔΑ ΑΓΟΡΑΣ ΠΡΙΝ ΑΠΟ ΤΗ ΔΟΣΗ (27/10/2026). Η δόση απαντά πόσο
              πληρώνεις τον μήνα· πόσα μετρητά θέλεις πέρα από το δάνειο το λένε
              τα έξοδα αγοράς, με το ίδιο ποσό δανείου στη διεύθυνση. */}
          <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: '0 0 12px' }}>{hy(<>
            Πέρα από το δάνειο θα χρειαστείς την ίδια συμμετοχή και τα έξοδα της αγοράς: τα{' '}
            <Link href="/exoda-agoras-akinitou" className="lp-link" style={LINK}>έξοδα αγοράς ακινήτου</Link>
            {' '}δείχνουν τον φόρο μεταβίβασης και πόσα μετρητά χρειάζεσαι εκτός δανείου.
          </>)}</p>
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
        <ToolByline />
        <ToolGuides tool="/ypologismos-stegastikou-daneiou" />
      </main>

      <PublicFooter />
    </div>
  );
}
