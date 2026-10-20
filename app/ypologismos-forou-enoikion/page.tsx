// ═══════════════════════════════════════════════════════════════════════════
// ΔΩΡΕΑΝ ΥΠΟΛΟΓΙΣΤΗΣ ΦΟΡΟΥ ΕΝΟΙΚΙΩΝ — η δημόσια σελίδα
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ, ΩΣ ΑΠΟΦΑΣΗ ΠΡΟΪΟΝΤΟΣ
// Η δημόσια επιφάνεια του app ήταν: αρχική, σύνδεση, εγγραφή, νομικά. Δηλαδή
// κανένας λόγος να μας βρει κάποιος που δεν μας ξέρει ήδη. Ταυτόχρονα, μέσα στο
// lib/ υπάρχει σωστή και δοκιμασμένη ελληνική φορολογική λογική για το 2026 —
// το ακριβότερο κομμάτι του προϊόντος — κλειδωμένη πίσω από τη σύνδεση.
//
// Ο Έλληνας ιδιοκτήτης ψάχνει «πόσο φόρο θα πληρώσω για τα ενοίκια» ΠΡΙΝ ψάξει
// «εφαρμογή διαχείρισης ακινήτων». Αυτή η σελίδα απαντά σε εκείνη τη στιγμή,
// δωρεάν, χωρίς εγγραφή — και μόνο μετά προτείνει.
//
// ΚΟΣΤΟΣ: μηδέν. Στατική απόδοση, ο υπολογισμός γίνεται στη συσκευή, κανένα
// αίτημα σε βάση, κανένα AI, καμία εξωτερική υπηρεσία.
//
// Η σελίδα είναι Server Component (για SEO και ταχύτητα)· μόνο ο υπολογιστής
// είναι πελάτης. Οι εισαγωγές είναι από lib/ και components/tokens — ποτέ από
// module με 'use client', αλλιώς σπάει το SSR (βλ. components/tokens.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { athensToday } from '@/lib/core/time';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, ToolLede, ToolSources, ToolCta, TOOL_PRIVACY_FAQ, WRAP, WRAP_PAD } from '../PublicChrome';
import { ToolGuides } from '../odigos/ToolGuides';
import { hy } from '@/components/Hyphen';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { RentTaxCalculator } from './RentTaxCalculator';
import { PAGE_UPDATED, limitsChecked } from '../pageUpdated';
import { ToolLedger } from '../ToolParts';
import { fe, fn, feWhole, fpRate, feSigned, grDateOf } from '@/lib/core/format';
import { RENTAL_TAX_BRACKETS_2026, FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE, bankReceiptMatters } from '@/lib/billing/presumptive';
import { AADE_DESTINATIONS } from '@/lib/tax/aade';
import { ratePct } from '../odigos/taxText';
import { STR_MAX_PROPERTIES, STR_BUSINESS_PROPERTIES } from '../odigos/strText';
import { LAW_5222_PDF, LAW_5246_PDF } from '../odigos/fek';
import { toolJsonLd, ToolByline, ToolOnwardLinks } from '../toolSeo';
import { rentPageYear, rentH1, rentTitle, rentDesc, rentExample } from './seo';

// ΟΙ ΑΡΙΘΜΟΙ ΤΟΥ ΚΕΙΜΕΝΟΥ ΑΠΟ ΤΙΣ ΣΤΑΘΕΡΕΣ ΠΟΥ ΥΠΟΛΟΓΙΖΟΥΝ (07/10/2026). Η κλίμακα,
// το 5%, το 95% και η «01/07/2027» ήταν γραμμένα με το χέρι σε επτά σημεία, δίπλα
// στον υπολογιστή που τα παίρνει από το lib/billing.
const SCALE_2026 = RENTAL_TAX_BRACKETS_2026;
const DEDUCTION = ratePct(PRESUMPTIVE_DEDUCTION_RATE);
const TAXED_SHARE = fpRate((1 - PRESUMPTIVE_DEDUCTION_RATE) * 100);
const BANK_FROM = grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT);
/** «15% έως 12.000€, 25% από 12.000 έως 24.000€, … και 45% πάνω από 36.000€». */
const SCALE_WORDS = (() => {
  const parts = SCALE_2026.map(b => (b.from === 0 ? `${ratePct(b.rate)} έως ${feWhole(b.to)}`
    : b.to === Infinity ? `${ratePct(b.rate)} πάνω από ${feWhole(b.from)}`
    : `${ratePct(b.rate)} από ${fn(b.from)} έως ${feWhole(b.to)}`));
  return `${parts.slice(0, -1).join(', ')} και ${parts[parts.length - 1]}`;
})();

const URL = siteUrl('/ypologismos-forou-enoikion');

// ΟΙ ΔΥΟ ΝΟΜΟΙ ΤΗΣ ΣΕΛΙΔΑΣ, ΣΕ ΣΥΝΔΕΣΜΟ. Ο ν.5222/2025 (ΦΕΚ Α΄ 134/2025) της
// τραπεζικής είσπραξης από 13.10.2026. Ο ν.5246/2025 της κλίμακας (ΦΕΚ Α΄
// 198/2025) έμενε χωρίς σύνδεσμο ώσπου να επαληθευτεί· επαληθεύτηκε 18.10.2026
// στο κείμενο του ΦΕΚ. Οι διευθύνσεις και η επαλήθευσή τους: app/odigos/fek.ts.
const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;
const PROSE = { fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 } as const;

// Ο τίτλος είναι απόλυτος και η εικόνα κοινοποίησης μπαίνει πάντα (publicMetadata).
// Η ΧΡΟΝΙΑ ΤΟΥ ΤΙΤΛΟΥ ΚΑΙ ΤΗΣ ΠΕΡΙΓΡΑΦΗΣ ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ (13.10.2026): ήταν «2026»
// με το χέρι. Είναι η χρονιά που ανοίγει ο υπολογιστής (seo.ts), όπως και η
// επικεφαλίδα.
export function generateMetadata(): Metadata {
  const year = rentPageYear(athensToday());
  return publicMetadata({ title: rentTitle(year), description: rentDesc(year), url: URL, image: shareImage('ypologismos-forou-enoikion') });
}

// Οι ερωτήσεις που κάνει πραγματικά ο ιδιοκτήτης, με απαντήσεις που στέκουν.
// Το ίδιο περιεχόμενο τροφοδοτεί και το δομημένο σχήμα παρακάτω — μία πηγή, ώστε
// να μη διαφωνήσουν ποτέ η σελίδα και ό,τι διαβάζει η μηχανή αναζήτησης.
const FAQ: { q: string; a: string }[] = [
  {
    q: `Πώς φορολογούνται τα ενοίκια από το ${FIRST_YEAR_NEW_BRACKETS};`,
    a: `Με δική τους προοδευτική κλίμακα, ξεχωριστή από τους μισθούς: ${SCALE_WORDS}. `
     + 'Φορολογείται το πλάτος κάθε κλιμακίου, όχι όλο το εισόδημα με τον ανώτερο συντελεστή.',
  },
  {
    q: `Τι είναι η τεκμαρτή έκπτωση ${DEDUCTION};`,
    a: `Ο νόμος αναγνωρίζει τεκμαρτή δαπάνη ${DEDUCTION} επί του ακαθάριστου εισοδήματος από ακίνητα, `
     + `χωρίς να χρειάζεται να προσκομίσεις δικαιολογητικά. Ο φόρος υπολογίζεται στο υπόλοιπο ${TAXED_SHARE}.`,
  },
  {
    q: 'Τι αλλάζει αν εισπράττω το ενοίκιο σε μετρητά;',
    // ΟΡΟΣ ΓΙΑ ΤΗΝ ΕΚΠΤΩΣΗ, ΟΧΙ ΑΠΑΓΟΡΕΥΣΗ ΤΩΝ ΜΕΤΡΗΤΩΝ (20.10.2026), όπως ο
    // οδηγός «Ενοίκιο μέσω τράπεζας» και το lib/billing/greekTax.ts.
    a: `Κατά τον ν.5222/2025 (άρθρο 210), η τεκμαρτή έκπτωση ${DEDUCTION} δίνεται μόνο αν τα μισθώματα εξοφλούνται `
     + `με ηλεκτρονικό ή τραπεζικό μέσο· με μετρητά ο φόρος υπολογίζεται στο 100% αντί για το ${TAXED_SHARE}. `
     + `Η κύρωση αυτή ξεκινά την ${BANK_FROM} (απόφαση ΑΑΔΕ Α.1187/2026): για τα εισοδήματα του ${FIRST_YEAR_BANK_RECEIPT - 2} και `
     + `του ${FIRST_YEAR_BANK_RECEIPT - 1} η έκπτωση δίνεται ανεξάρτητα από τον τρόπο είσπραξης.`,
  },
  {
    q: 'Περιλαμβάνεται ο ΕΝΦΙΑ;',
    a: 'Όχι. Ο ΕΝΦΙΑ είναι φόρος κατοχής και υπολογίζεται χωριστά, με βάση την αντικειμενική '
     + 'αξία, τη ζώνη, τον όροφο και την παλαιότητα του ακινήτου. Δεν αφαιρείται από το '
     + 'εισόδημα από ενοίκια.',
  },
  {
    q: 'Ισχύει και για βραχυχρόνια μίσθωση;',
    // ΗΤΑΝ «Όχι απευθείας» ΚΑΙ ΗΤΑΝ ΛΑΘΟΣ. Για φυσικό πρόσωπο με έως δύο ακίνητα
    // η βραχυχρόνια φορολογείται ως εισόδημα από ακίνητα, με την ίδια κλίμακα
    // και την ίδια έκπτωση (lib/tax/shortTermTax.ts, lib/tools/shortVsLong.ts).
    // Ο αριθμός από τη σταθερά και ο δεύτερος όρος, οι υπηρεσίες, όπως στον
    // οδηγό Airbnb (20.10.2026): χωρίς αυτόν η απάντηση ήταν ελλιπής.
    a: `Ναι, για φυσικό πρόσωπο με ${STR_MAX_PROPERTIES} που δεν παρέχει υπηρεσίες πέρα από τα κλινοσκεπάσματα: `
     + `το εισόδημα φορολογείται με την ίδια κλίμακα και την ίδια τεκμαρτή έκπτωση ${DEDUCTION}. Η βραχυχρόνια `
     + `έχει επιπλέον το τέλος ανθεκτικότητας ανά διανυκτέρευση. Από ${STR_BUSINESS_PROPERTIES} ή με `
     + 'παροχή άλλων υπηρεσιών η δραστηριότητα γίνεται επιχειρηματική.',
  },
  TOOL_PRIVACY_FAQ,
];

// Η ΔΗΛΩΣΗ ΣΤΟ myAADE, ΑΠΟ ΤΟ ΜΗΤΡΩΟ (lib/tax/aade.ts). Πύλη και διαδρομή σε
// λέξεις, ποτέ βαθύς σύνδεσμος γραμμένος εδώ (guard-official-links).
const INCOME = AADE_DESTINATIONS.income;

export default function Page() {
  const today = athensToday();
  const year = rentPageYear(today);
  const ex = rentExample(year);
  // Μία πηγή για σελίδα και σχήμα: το `FAQPage` είναι ο ίδιος πίνακας που
  // αποδίδουν οι «Συχνές ερωτήσεις» από κάτω (app/toolSeo.tsx).
  const jsonLd = toolJsonLd({ name: `Υπολογισμός φόρου ενοικίων ${year}`, url: URL, description: rentDesc(year), faq: FAQ });

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      {/* Το δομημένο σχήμα δίνει στη Google τις ερωτήσεις/απαντήσεις αυτούσιες.
          Παράγεται από τον ΙΔΙΟ πίνακα FAQ που αποδίδεται παρακάτω, ώστε να μην
          μπορεί ποτέ να πει άλλα η σελίδα και άλλα το σχήμα. */}
      <JsonLd data={jsonLd} />

      <PublicHeader />

      {/* ΤΡΙΑ ΜΕΤΡΑ ΣΕ ΜΙΑ ΣΕΛΙΔΑ: η κεφαλίδα κρατούσε 860, το κυρίως 760 και
          το υποσέλιδο ακολουθούσε το δεύτερο. Το λογότυπο δηλαδή ξεκινούσε
          πενήντα εικονοστοιχεία αριστερότερα από τον τίτλο, σε κάθε οθόνη.
          Ένα μέτρο και κάθε γραμμή της σελίδας ξεκινά από τον ίδιο άξονα. */}
      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <div className="lp-eyebrow">Υπολογιστής</div>
        {/* Η ΕΠΙΚΕΦΑΛΙΔΑ ΛΕΕΙ ΤΗ ΦΡΑΣΗ ΠΟΥ ΨΑΧΝΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ (13.10.2026): «φόρος
            ενοικίων {χρονιά} υπολογισμός». Η χρονιά είναι αυτή που ανοίγει η
            φόρμα από κάτω (seo.ts), άρα δεν διαψεύδει τον επιλογέα της. */}
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {rentH1(year)}
        </h1>
        {/* ═══ ΔΥΟ ΣΕΙΡΕΣ ΚΑΙ Η ΥΠΟΣΗΜΕΙΩΣΗ ΣΤΟ ΤΕΛΟΣ ΤΗΣ ΔΕΥΤΕΡΗΣ ═══════════
            Η εισαγωγή ήταν στο `lg-lede`, δηλαδή σε πλέγμα με δεξιά στήλη 250
            εικονοστοιχείων. Εκεί μέσα η σημείωση έσπαγε στα δύο και καθόταν
            ΨΗΛΟΤΕΡΑ από την πρόταση που σχολιάζει: ο αναγνώστης τη διάβαζε
            πρώτη, χωρίς να ξέρει σε τι αναφέρεται.
            Τώρα η υπόσχεση κλείνει με την άνω τελεία της, η εγγύηση απορρήτου
            πιάνει δική της σειρά και η σημείωση ακολουθεί στο τέλος της — μικρότερη, ουδέτερη, εκεί που ανήκει μια υποσημείωση.

            ΧΩΡΙΣ nowrap, ΕΠΙΤΗΔΕΣ. Θα κρατούσε τη σημείωση σε μία γραμμή και σε
            οθόνη 360 εικονοστοιχείων, όπου θα ξεχείλιζε οριζόντια ολόκληρη τη
            σελίδα. Το κείμενο κόπηκε αντ' αυτού: σε επιφάνεια εργασίας τελειώνει
            άνετα μέσα στη σειρά, σε κινητό αναδιπλώνεται καθαρά. */}
        {/* ΤΟ ΕΤΟΣ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Ο υπολογιστής ρωτά πλέον ποιας χρονιάς είναι
            το εισόδημα και εφαρμόζει την αντίστοιχη κλίμακα· ένας υπότιτλος που
            λέει «κλίμακα του 2026» θα διέψευδε τον ίδιο του τον επιλογέα όταν
            δείχνει το 2025. Η χρονιά λέγεται μία φορά, δίπλα στην επιλογή. */}
        <ToolLede>Με την κλίμακα της χρονιάς που θα διαλέξεις και την τεκμαρτή έκπτωση {DEDUCTION}.</ToolLede>

        {/* Ο ΥΠΟΛΟΓΙΣΤΗΣ ΔΙΑΒΑΖΕΙ ΤΗ ΔΙΕΥΘΥΝΣΗ, ΑΡΑ ΘΕΛΕΙ ΟΡΙΟ ΑΝΑΜΟΝΗΣ. Το
            `useSearchParams` σε προαποδοσμένη διαδρομή αναγκάζει απόδοση στον
            πελάτη μέχρι το πλησιέστερο <Suspense>· χωρίς αυτό, ολόκληρη η
            σελίδα —τίτλος, κείμενο, συχνές ερωτήσεις— θα έβγαινε από τη
            στατική απόδοση και θα έχανε το SEO για το οποίο υπάρχει. Με το
            όριο εδώ, μόνο η φόρμα περιμένει τον πελάτη.
            Η εφεδρεία έχει το ΙΔΙΟ ύψος με τη φόρμα, ώστε το κείμενο από κάτω
            να μην αναπηδήσει μόλις φορτώσει. */}
        <Suspense fallback={<div style={{ minHeight: 420 }} aria-hidden/>}>
          <RentTaxCalculator today={today} cta={
            <ToolCta
              title="Θέλεις να μη χρειαστεί να το ξαναϋπολογίσεις;"
              body="Το PROPERWISE κρατά οργανωμένα ενοίκια, λογαριασμούς και δαπάνες όλη τη χρονιά και εξάγει με ένα κλικ όσα ζητά ο λογιστής σου."
            />
          }/>
        </Suspense>

        <ToolSources kind="rent" checked={limitsChecked('/ypologismos-forou-enoikion')} updated={PAGE_UPDATED['/ypologismos-forou-enoikion']} />

        {/* ── ΛΥΜΕΝΟ ΠΑΡΑΔΕΙΓΜΑ (13.10.2026) ───────────────────────────────────
            Ο ιδιοκτήτης ζήτησε 12.000€ ενοίκιο τον χρόνο, από τον υπολογιστή.
            Τα ποσά βγαίνουν από τη μηχανή του (seo.ts) και γράφονται με τους
            ίδιους μορφοποιητές και την ίδια ανάλυση (`ToolLedger`): ο φόρος που
            διαβάζεται εδώ είναι ο φόρος που δείχνει η φόρμα όταν ανοίξει το
            παράδειγμα. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over={`Λυμένο παράδειγμα ${year}`} title={`${fe(ex.gross)} ενοίκιο τον χρόνο, ${fe(ex.tax)} φόρος`} />
          <p className="po-just" style={{ ...PROSE, marginBottom: 16 }}>{hy(
            `Μηνιαίο ενοίκιο ${fe(ex.monthly)} για ${fn(ex.months)} μήνες, εισόδημα του ${year}, με την κλίμακα της χρονιάς και την τεκμαρτή έκπτωση ${ratePct(ex.rate)}.`)}</p>
          <ToolLedger rows={[
            { k: 'Ετήσιο ενοίκιο', v: fe(ex.gross) },
            { k: `Τεκμαρτή έκπτωση ${ratePct(ex.rate)}`, v: feSigned(-ex.deduction) },
            { k: 'Φορολογητέο', v: fe(ex.taxable) },
            ...ex.slices.map(s => ({
              k: `${fe(s.width)} με ${ratePct(s.rate)}${s.to === Infinity ? '' : ` (κλιμάκιο έως ${feWhole(s.to)})`}`,
              v: fe(s.tax), kind: 'param' as const,
            })),
            { k: 'Φόρος εισοδήματος', v: fe(ex.tax), kind: 'total' },
          ]}/>
          {/* Η ΠΗΓΗ ΚΑΘΕ ΜΙΣΟΥ ΤΗΣ ΠΡΟΤΑΣΗΣ ΣΤΗ ΘΕΣΗ ΤΟΥ. Η προϋπόθεση της
              τράπεζας είναι το άρθρο 210 του ν.5222/2025· η ημερομηνία από την
              οποία κόβει είναι της απόφασης Α.1187/2026, όπως στις συχνές
              ερωτήσεις από κάτω. */}
          <p className="po-just" style={{ ...PROSE, marginTop: 16 }}>{hy(<>
            Σου μένουν {fe(ex.net)} τον χρόνο.{' '}
            {bankReceiptMatters(year)
              ? 'Το παράδειγμα υποθέτει είσπραξη μέσω τράπεζας. '
              : `Για τα ενοίκια του ${year} η έκπτωση δίνεται όπως κι αν εισπράττεται το ενοίκιο. `}
            Η προϋπόθεση της τράπεζας (άρθρο 210{' '}
            <a href={LAW_5222_PDF} target="_blank" rel="noopener noreferrer" className="lp-link" style={LINK}>ν.5222/2025, ΦΕΚ Α΄ 134/28.07.2025</a>
            ) ισχύει από {BANK_FROM} (απόφαση ΑΑΔΕ Α.1187/2026){bankReceiptMatters(year) ? ': με μετρητά η τεκμαρτή έκπτωση χάνεται.' : '.'}{' '}
            <Link href={ex.href} className="lp-link" style={LINK}>Άνοιξε το παράδειγμα στον υπολογιστή</Link>.
          </>)}</p>
        </section>

        {/* ── ΠΩΣ ΔΗΛΩΝΕΤΑΙ ΣΤΟ Ε2 (13.10.2026) ────────────────────────────────
            Μόνο ό,τι τεκμηριώνει ήδη ο κώδικας: η διαδρομή του myAADE από το
            lib/tax/aade.ts· το προσυμπληρωμένο Ε2 από τις δηλώσεις μίσθωσης και
            τις πλατφόρμες (lib/tax/aadeE2.ts, οδηγός προθεσμιών)· μία γραμμή ανά
            μίσθωση και μόνο το ποσοστό κάθε συνιδιοκτήτη (lib/billing/e2.ts)·
            τα ενοίκια μιας χρονιάς δηλώνονται την επόμενη (οδηγός φορολογίας
            ενοικίων). Καμία προθεσμία δεν γράφεται εδώ: ζουν στο
            lib/tax/greekTaxCalendar.ts και τις τυπώνει ο οδηγός προθεσμιών. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Η δήλωση" title="Πώς δηλώνεται στο Ε2" />
          <p className="po-just" style={{ ...PROSE, marginBottom: 12 }}>{hy(
            `Το ενοίκιο δηλώνεται στο έντυπο Ε2, που συμπληρώνεται μέσα από τη δήλωση φορολογίας εισοδήματος (Ε1) της επόμενης χρονιάς: τα ενοίκια του ${year} δηλώνονται το ${year + 1}.`)}</p>
          <ol className="lg-ul">
            <li>{hy(<>
              Στο{' '}
              <a href={INCOME.url} target="_blank" rel="noopener noreferrer" className="lp-link" style={LINK}>{INCOME.portal}</a>
              {INCOME.login ? ', με τους κωδικούς TAXISnet' : ''}: {INCOME.steps.join(' · ')}.
            </>)}</li>
            <li>{hy('Ο πίνακας των μισθώσεων του Ε2 έρχεται προσυμπληρωμένος από τις δηλώσεις μίσθωσης και τα στοιχεία των πλατφορμών. Έλεγξε κάθε γραμμή: διεύθυνση, μισθωτή, μήνες, μηνιαίο μίσθωμα και ακαθάριστο.')}</li>
            <li>{hy('Κάθε μίσθωση της χρονιάς είναι μία γραμμή. Σε συνιδιόκτητο ακίνητο ο καθένας δηλώνει στο δικό του Ε2 μόνο το ποσοστό του: το ακαθάριστο είναι το μίσθωμα επί το ποσοστό.')}</li>
          </ol>
          <p className="po-just" style={{ ...PROSE, marginTop: 12 }}>{hy(<>
            Οι προθεσμίες της δήλωσης και της αυτόματης οριστικοποίησης είναι στον οδηγό{' '}
            <Link href="/odigos/forologikes-prothesmies-idioktiton#dilosi" className="lp-link" style={LINK}>φορολογικές προθεσμίες ιδιοκτήτη</Link>.
          </>)}</p>
        </section>

        {/* ── Συχνές ερωτήσεις ──────────────────────────────────────────────
               ΗΤΑΝ ΠΕΝΤΕ ΚΟΥΤΙΑ ΜΕ ΠΕΡΙΓΡΑΜΜΑ ΚΑΙ ΤΟ ΒΕΛΑΚΙ ΤΟΥ ΠΕΡΙΗΓΗΤΗ. Η
               αρχική σελίδα λύνει το ίδιο πρόβλημα με λεπτές γραμμές και έναν
               σταυρό που γυρίζει: πέντε πλαίσια το ένα κάτω από το άλλο
               διαβάζονται ως πέντε αντικείμενα, ενώ είναι μία λίστα. Ίδιο
               σχήμα, ίδια συμπεριφορά, ίδιο περιθώριο. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over="Συχνές ερωτήσεις" title="Ό,τι ρωτούν πριν υπολογίσουν" />
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
              </details>
            ))}
          </div>
        </section>

        {/* Ο ΟΔΗΓΟΣ ΕΙΝΑΙ Η ΕΠΟΜΕΝΗ ΑΝΑΓΝΩΣΗ, ΟΧΙ ΥΠΟΣΗΜΕΙΩΣΗ. Ο υπολογιστής
            δίνει τον φόρο· όποιος θέλει το πλήρες πλαίσιο (κλίμακα, τεκμαρτή
            έκπτωση, κανόνας τραπεζικής είσπραξης) έχει έναν αναλυτικό οδηγό. Ο
            σύνδεσμος στέκει εδώ ώστε να τον βρίσκει τη στιγμή της ερώτησης. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Ο αναλυτικός οδηγός" title="Η φορολογία των ενοικίων, ολόκληρη" />
          <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{hy(<>
            Ο υπολογιστής δίνει τον φόρο· ο οδηγός{' '}
            <Link href="/odigos/forologia-enoikion-2026" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              φορολογία ενοικίων 2026
            </Link>{' '}εξηγεί την κλίμακα, την τεκμαρτή έκπτωση {DEDUCTION}, τον κανόνα της τραπεζικής είσπραξης (από {BANK_FROM}) και τις εξαιρέσεις, με παραδείγματα σε ευρώ.
            {' '}Η κλίμακα από το φορολογικό έτος {FIRST_YEAR_NEW_BRACKETS} είναι του άρθρου 8 του{' '}
            <a href={LAW_5246_PDF} target="_blank" rel="noopener noreferrer" className="lp-link" style={LINK}>ν.5246/2025, ΦΕΚ Α΄ 198/2025</a>.
          </>)}</p>
        </section>

        {/* Ο ΕΠΙΣΚΕΠΤΗΣ ΠΟΥ ΒΡΗΚΕ ΤΟΝ ΦΟΡΟ ΤΟΥ ΕΧΕΙ ΔΥΟ ΑΚΟΜΗ ΕΡΩΤΗΣΕΙΣ ΚΑΙ ΤΙΣ
            ΑΠΑΝΤΟΥΝ ΟΙ ΔΙΠΛΑΝΕΣ ΣΕΛΙΔΕΣ. Τα τρία εργαλεία είναι μια αλυσίδα, όχι
            τρεις άσχετες σελίδες που τυχαίνει να ζουν στο ίδιο domain. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Και μετά" title="Ο φόρος δεν είναι το μόνο που πληρώνεις" />
          <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{hy(<>
            Ο ΕΝΦΙΑ είναι φόρος <strong style={{ color: 'var(--text-primary)' }}>κατοχής</strong> και
            υπολογίζεται χωριστά: δες τον{' '}
            <Link href="/ypologismos-enfia" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              υπολογισμό ΕΝΦΙΑ
            </Link>. Και αν σκέφτεσαι να διαθέσεις το ακίνητο σε βραχυχρόνια μίσθωση, η{' '}
            <Link href="/vraxyxronia-i-makroxronia" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              σύγκριση βραχυχρόνιας και μακροχρόνιας
            </Link>{' '}δείχνει από ποια πληρότητα και πάνω συμφέρει. Τον φόρο, τον ΕΝΦΙΑ και τις δαπάνες μαζί,
            ως ποσοστό της αξίας του ακινήτου, τα βγάζει η{' '}
            <Link href="/kathari-apodosi" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              καθαρή απόδοση
            </Link>.
          </>)}</p>
          <ToolOnwardLinks />
        </section>
        <ToolByline />
        <ToolGuides tool="/ypologismos-forou-enoikion" />
      </main>

      <PublicFooter />
    </div>
  );
}
