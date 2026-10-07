// ═══════════════════════════════════════════════════════════════════════════
// ΟΔΗΓΟΣ-ΠΥΛΩΝΑΣ: ΚΑΘΑΡΗ ΑΠΟΔΟΣΗ ΑΚΙΝΗΤΟΥ — η δημόσια σελίδα
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο ιδιοκτήτης ρωτά «αξίζει το ακίνητο όσα μου κοστίζει;» και
// βρίσκει παντού τη ΜΕΙΚΤΗ απόδοση (ενοίκιο επί δώδεκα, διά την αξία), που είναι
// τα χρήματα ΠΡΙΝ τη ΔΟΥ, τον ΕΝΦΙΑ και τις δαπάνες. Ο οδηγός δείχνει το καθαρό
// νούμερο, με πηγές, δίπλα στον υπολογιστή καθαρής απόδοσης.
//
// ΚΑΘΕ ΑΡΙΘΜΟΣ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟΝ ΠΥΡΗΝΑ. Η κλίμακα (ν.5246/2025), η τεκμαρτή
// έκπτωση και η οριακή φύση του φόρου έρχονται από τα ίδια lib/billing/greekTax.ts
// και lib/tools/apodosi.ts που τρέχει ο πίνακας ελέγχου.
//
// 07/10/2026: ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΥΠΟΛΟΓΙΖΕΤΑΙ, ΔΕΝ ΑΝΤΙΓΡΑΦΕΤΑΙ. Ήταν γραμμένο με το
// χέρι (φόρος 1.197€ ως μόνο εισόδημα, 1.935€ όταν προϋπάρχουν 12.000€
// ακαθάριστα ενοίκια, καθαρά 5.903€), ως «αυτούσιο αποτέλεσμα» μιας εκτέλεσης.
// Τώρα οι υποθέσεις είναι σταθερές εδώ και κάθε ποσό το δίνει το
// `propertyYield`: αν αλλάξει η κλίμακα ή η έκπτωση, αλλάζει και ο οδηγός.
//
// Server Component για SEO/ταχύτητα. Καμία εξάρτηση από 'use client'.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl, PRODUCT_NAME } from '@/lib/core/site';
import { fp, fpRate, feWhole, fn, grDateOf } from '@/lib/core/format';
import {
  FIRST_YEAR_NEW_BRACKETS, FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT, rentalBracketsForYear,
  DEPOSIT_INTEREST_WITHHOLDING_RATE,
} from '@/lib/billing/greekTax';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/billing/presumptive';
import { propertyYield } from '@/lib/tools/apodosi';
import { ratePct } from '../taxText';
import { PublicHeader, PublicFooter, JsonLd } from '../../PublicChrome';
import { shareImage } from '../../og/share';
import { publicMetadata } from '../../publicMetadata';
import { guideAt } from '../guides';
import {
  GuideMain, GuideUpdated, GuideH2 as H2, GuideToc, GuideSources, GuideCta, GuideFaq,
  RelatedGuides, guideJsonLd, type GuideFaqItem,
} from '../GuideParts';

const H1 = 'Καθαρή απόδοση ακινήτου: τι μένει μετά τον φόρο';
const TITLE = H1;
// Κάτω από 160 χαρακτήρες: τόσα δείχνει η σελίδα αποτελεσμάτων πριν κόψει.
// Η επιφύλαξη «ενδεικτικός» μένει στο σώμα της σελίδας.
const DESC =
  'Καθαρή απόδοση ακινήτου: από τη μεικτή απόδοση αφαιρούνται ο φόρος στο δικό σου '
  + 'κλιμάκιο, ο ΕΝΦΙΑ και οι δαπάνες. Με παράδειγμα σε ευρώ και πηγές.';
const GUIDE = guideAt('/odigos/kathari-apodosi-akinitou');
const URL = siteUrl(GUIDE.href);

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL, type: 'article', image: shareImage('odigos-kathari-apodosi-akinitou') });

// ── ΤΟ ΠΑΡΑΔΕΙΓΜΑ: ΥΠΟΘΕΣΕΙΣ ΕΔΩ, ΑΠΟΤΕΛΕΣΜΑΤΑ ΑΠΟ ΤΗ ΜΗΧΑΝΗ ─────────────────
const EX_VALUE = 200_000;
const EX_MONTHLY = 700;
const EX_ENFIA = 500;
const EX_EXPENSES = 800;
/** Ακαθάριστα ενοίκια από άλλα ακίνητα, για τον οριακό φόρο της σημείωσης. */
const EX_OTHER_GROSS = 12_000;
const EX_YEAR = FIRST_YEAR_NEW_BRACKETS;
const BRACKETS = rentalBracketsForYear(EX_YEAR);

const yieldWith = (otherRentalIncome: number) => propertyYield({
  value: EX_VALUE, monthlyRent: EX_MONTHLY, monthsRented: 12, enfia: EX_ENFIA, expenses: EX_EXPENSES,
  otherRentalIncome, year: EX_YEAR, viaBank: true,
});
/** Το διαμέρισμα ως μοναδικό εισόδημα από ακίνητα. */
const BASE = yieldWith(0);
/** Το ίδιο διαμέρισμα, πάνω σε άλλα ενοίκια. */
const STACKED = yieldWith(EX_OTHER_GROSS);
const OTHER_TAXABLE = EX_OTHER_GROSS * (1 - PRESUMPTIVE_DEDUCTION_RATE);
/** Πόσο από το φορολογητέο του ακινήτου πέφτει σε κάθε κλιμάκιο, πάνω στα άλλα ενοίκια. */
const STACKED_SLICES = BRACKETS
  .map(b => ({ rate: b.rate, width: Math.max(0, Math.min(OTHER_TAXABLE + STACKED.taxable, b.to) - Math.max(OTHER_TAXABLE, b.from)) }))
  .filter(x => x.width > 0);
/** «600€ φορολογούνται με 15% και 7.380€ με 25%». */
const STACKED_SPLIT = (() => {
  const parts = STACKED_SLICES.map((x, i) => `${feWhole(x.width)}${i === 0 ? ' φορολογούνται' : ''} με ${ratePct(x.rate)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} και ${parts[parts.length - 1]}` : parts.join('');
})();
/** Το κλιμάκιο όπου πέφτει το μεγαλύτερο μέρος. */
const STACKED_MAIN = STACKED_SLICES.reduce((a, b) => (b.width > a.width ? b : a));

const DEDUCTION = ratePct(PRESUMPTIVE_DEDUCTION_RATE);
const BANK_FROM = grDateOf(FIRST_YEAR_BANK_RECEIPT, FIRST_MONTH_BANK_RECEIPT);
/** Απόδοση σε ποσοστιαίες μονάδες, με δύο δεκαδικά: 0.042 → «4,20%». */
const pctOf = (r: number | null) => fp((r ?? 0) * 100);
const GAP = fn((BASE.yieldGap ?? 0) * 100, 2);

// ── Η ΣΥΓΚΡΙΣΗ ΜΕ ΤΗΝ ΚΑΤΑΘΕΣΗ: ΠΑΡΑΔΕΙΓΜΑ, ΟΧΙ ΝΟΜΟΣ ────────────────────────
// Το επιτόκιο είναι ΥΠΟΘΕΣΗ του παραδείγματος, όχι τιμή αγοράς ή του νόμου. Ο
// συντελεστής της παρακράτησης είναι του νόμου και έρχεται με την πηγή του από
// το lib/billing/greekTax.ts. Το καθαρό βγαίνει από τα δύο.
/** Επιτόκιο προθεσμιακής κατάθεσης του παραδείγματος. */
const EX_DEPOSIT_RATE = 0.02;
const DEPOSIT_TAX = ratePct(DEPOSIT_INTEREST_WITHHOLDING_RATE);
const DEPOSIT_GROSS = ratePct(EX_DEPOSIT_RATE);
const DEPOSIT_NET = pctOf(EX_DEPOSIT_RATE * (1 - DEPOSIT_INTEREST_WITHHOLDING_RATE));
const PAYBACK = fn(BASE.paybackYears ?? 0);

// Οι ερωτήσεις τροφοδοτούν ΚΑΙ την ορατή λίστα ΚΑΙ το δομημένο σχήμα — μία πηγή.
const FAQ: GuideFaqItem[] = [
  {
    q: 'Τι διαφορά έχει η μεικτή από την καθαρή απόδοση;',
    a: 'Η μεικτή απόδοση είναι το ετήσιο μίσθωμα προς την αξία του ακινήτου, πριν από '
     + 'οποιαδήποτε επιβάρυνση. Η καθαρή είναι ό,τι μένει αφού αφαιρεθούν ο φόρος '
     + `εισοδήματος, ο ΕΝΦΙΑ και οι δαπάνες. Στο παράδειγμα του οδηγού η διαφορά είναι ${GAP} ποσοστιαίες μονάδες.`,
  },
  {
    // Ο ΜΙΣΘΟΣ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟΝ ΛΟΓΑΡΙΑΣΜΟ. Η ερώτηση έλεγε «τα άλλα μου
    // εισοδήματα» και υπονοούσε μισθό και σύνταξη, ενώ τα ενοίκια έχουν δική
    // τους κλίμακα (βλ. τον οδηγό φορολογίας ενοικίων).
    q: 'Γιατί ο φόρος εξαρτάται από τα άλλα μου ενοίκια;',
    a: 'Η κλίμακα των ενοικίων είναι προοδευτική και εφαρμόζεται στο σύνολο των ενοικίων '
     + 'σου, όχι στον μισθό ή στη σύνταξη. Ο φόρος που φέρνει ένα ακίνητο είναι επομένως ο '
     + 'φόρος με αυτό μείον τον φόρο χωρίς αυτό, δηλαδή στο δικό σου οριακό κλιμάκιο, '
     + 'όχι σαν να ήταν το μόνο σου εισόδημα.',
  },
  {
    q: 'Μπαίνει ο ΕΝΦΙΑ στον υπολογισμό;',
    a: 'Ναι. Ο ΕΝΦΙΑ είναι φόρος κατοχής: τον πληρώνεις κάθε χρόνο, ακόμη και με το '
     + 'ακίνητο κενό, χωρίς να εκπίπτει από το εισόδημα. Μειώνει άμεσα την καθαρή απόδοση.',
  },
  {
    q: 'Τι δαπάνες μετράνε;',
    a: 'Οι λειτουργικές δαπάνες που βαραίνουν τον ιδιοκτήτη: συντήρηση και επισκευές, '
     + 'ασφάλιση, τα κοινόχρηστα που δεν βαραίνουν τον ενοικιαστή. Οι μήνες που το '
     + 'ακίνητο μένει κενό μειώνουν επίσης το ετήσιο μίσθωμα.',
  },
  {
    q: 'Σε πόσα χρόνια αποσβένεται το ακίνητο;',
    a: `Χοντρικά, η αξία διά τα καθαρά ετήσια έσοδα. Με καθαρά ${feWhole(BASE.net)} σε ακίνητο `
     + `${feWhole(EX_VALUE)}, περίπου ${PAYBACK} χρόνια, χωρίς να υπολογιστούν ανατίμηση ή πληθωρισμός. `
     + 'Είναι δείκτης σύγκρισης και δεν προβλέπει τιμές.',
  },
];

// Οι πηγές/νομική βάση, ορατές όπως στα εργαλεία (E-E-A-T).
const SOURCES: string[] = [
  `Φόρος εισοδήματος: κλίμακα ενοικίων ${FIRST_YEAR_NEW_BRACKETS} (ν.5246/2025) · τεκμαρτή έκπτωση ${DEDUCTION} (άρθρο 39 ΚΦΕ) · η προϋπόθεση τραπεζικής είσπραξης (άρθρο 210 ν.5222/2025) ξεκινά την ${BANK_FROM} (απόφαση ΑΑΔΕ Α.1187/2026, ΦΕΚ Β΄ 5590/17.09.2026).`,
  `Τόκοι καταθέσεων: παρακράτηση φόρου ${DEPOSIT_TAX} στην πηγή (άρθρο 64 ν.4172/2013)· το ${DEPOSIT_NET} είναι ${DEPOSIT_GROSS} × (1 − ${DEPOSIT_TAX}).`,
  'ΕΝΦΙΑ: φόρος κατοχής, ανεξάρτητος από το εισόδημα · άρθρο 4 ν.4223/2013, όπως ισχύει με τον ν.4916/2022.',
  // Μόνο η διάταξη: η λίστα κάθεται κάτω από τον τίτλο «Νομική βάση και πηγές».
  // Η πρόταση για το πώς υπολογίζει ο πίνακας ελέγχου πήγε στο «Υπολόγισε».
  'Ο φόρος του ακινήτου υπολογίζεται οριακά, ως η διαφορά που προσθέτει στον φόρο του συνολικού σου εισοδήματος από ακίνητα (άρθρο 40 παρ. 4 ν.4172/2013).',
];

// Οι ενότητες τροφοδοτούν ΚΑΙ τις κεφαλίδες ΚΑΙ τα περιεχόμενα — μία πηγή.
const S = {
  gap: { id: 'meikti-kathari', over: '1. Η διαφορά', title: 'Μεικτή και καθαρή απόδοση' },
  costs: { id: 'epivarynseis', over: '2. Τι τη μικραίνει', title: 'Φόρος, ΕΝΦΙΑ, δαπάνες' },
  example: { id: 'paradeigma', over: '3. Παράδειγμα', title: 'Ένα διαμέρισμα, βήμα βήμα' },
  payback: { id: 'aposvesi', over: '4. Απόσβεση', title: 'Σε πόσα χρόνια γυρίζει η αξία' },
} as const;

export default function Page() {
  const jsonLd = guideJsonLd({
    guide: GUIDE, headline: H1, description: DESC, faq: FAQ,
    about: 'Καθαρή απόδοση ακινήτου: μεικτή απόδοση, φόρος εισοδήματος, ΕΝΦΙΑ και δαπάνες',
  });

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader current="odigos" />

      <GuideMain rail={{ sections: Object.values(S), cta: { href: '/kathari-apodosi', action: 'Υπολόγισε την καθαρή απόδοσή σου' } }}>
        <div className="lp-eyebrow">Οδηγός</div>
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {H1}
        </h1>
        <GuideUpdated guide={GUIDE} />
        {/* Το ευρετήριο ακριβώς κάτω από τη γραμμή της ημερομηνίας: στο κινητό
            ερχόταν μετά από δύο παραγράφους εισαγωγής, μισή οθόνη πιο κάτω. */}
        <GuideToc sections={Object.values(S)} />

        {/* Εισαγωγή */}
        <p className="lg-p">
          {`«Απόδοση ${fpRate((BASE.grossYield ?? 0) * 100)}»: ενοίκιο επί δώδεκα, διά την αξία. Αυτή είναι η μεικτή απόδοση, δηλαδή τα χρήματα πριν περάσουν από τη ΔΟΥ, πριν πληρωθεί ο ΕΝΦΙΑ και πριν αλλάξει ο θερμοσίφωνας. Είναι το νούμερο που ο ιδιοκτήτης συγκρίνει, λανθασμένα, με το επιτόκιο μιας προθεσμιακής κατάθεσης. Εκεί η τράπεζα παρακρατά ${DEPOSIT_TAX} φόρο στην πηγή, οπότε ένα ${DEPOSIT_GROSS} φτάνει στον λογαριασμό ως ${DEPOSIT_NET}· στο ενοίκιο τον φόρο, τον ΕΝΦΙΑ και τα έξοδα τα αφαιρείς εσύ, αργότερα.`}
        </p>
        <p className="lg-p">
          {'Ο οδηγός δείχνει, με πηγές, τι μένει πραγματικά καθαρό: τη μεικτή απόδοση μείον τον φόρο στο δικό σου κλιμάκιο, τον ΕΝΦΙΑ και τις δαπάνες.'}
        </p>

        {/* 1. Μεικτή και καθαρή */}
        <H2 {...S.gap} />
        <p className="lg-p">
          {'Η μεικτή απόδοση αγνοεί κάθε επιβάρυνση, γι’ αυτό δείχνει πάντα μεγαλύτερη. Ο ιδιοκτήτης που τη συγκρίνει με έναν τόκο κατάθεσης βγάζει λάθος συμπέρασμα: τον φόρο του τόκου τον κρατά η τράπεζα πριν πιστώσει τον λογαριασμό, ενώ το ενοίκιο έρχεται ολόκληρο και τα βάρη του φαίνονται μήνες μετά.'}
        </p>

        {/* 2. Τι τη μικραίνει */}
        <H2 {...S.costs} />
        <ul className="lg-ul">
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Ο φόρος, στο δικό σου κλιμάκιο.'}</strong>{' Το ακίνητο φορολογείται με τον συντελεστή που αφήνουν τα ενοίκια που ήδη δηλώνεις.'}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Ο ΕΝΦΙΑ. Φόρος κατοχής:'}</strong>{' τον πληρώνεις κάθε χρόνο, ακόμη και με το ακίνητο κενό.'}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Οι δαπάνες.'}</strong>{' Συντήρηση, ασφάλιση, κοινόχρηστα του ιδιοκτήτη. Και οι μήνες που το ακίνητο μένει κενό, που μειώνουν το ενοίκιο.'}</li>
        </ul>

        {/* 3. Παράδειγμα */}
        <H2 {...S.example} />
        <p className="lg-p">
          {`Διαμέρισμα αξίας ${feWhole(EX_VALUE)}, με μηνιαίο μίσθωμα ${feWhole(EX_MONTHLY)} όλο τον χρόνο, ΕΝΦΙΑ ${feWhole(EX_ENFIA)} και δαπάνες ${feWhole(EX_EXPENSES)}. Πρώτα ο φόρος:`}
        </p>
        <ul className="lg-ul">
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Μεικτά ενοίκια:'}</strong>{` ${feWhole(EX_MONTHLY)} × 12 = ${feWhole(BASE.gross)}.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{`Τεκμαρτή έκπτωση ${DEDUCTION}:`}</strong>{` −${feWhole(BASE.deduction)}, οπότε φορολογητέο ${feWhole(BASE.taxable)}.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{`Φόρος, ως μοναδικό εισόδημα από ακίνητα (κλιμάκιο ${ratePct(BASE.marginal)}):`}</strong>{` ${fn(BASE.taxable)} × ${ratePct(BASE.marginal)} = ${feWhole(BASE.tax)}.`}</li>
        </ul>
        <p className="lg-p">{'Μετά τα καθαρά:'}</p>
        <ul className="lg-ul">
          <li>{`${feWhole(BASE.gross)} − ${feWhole(BASE.tax)} (φόρος) − ${feWhole(BASE.enfia)} (ΕΝΦΙΑ) − ${feWhole(BASE.expenses)} (δαπάνες) = `}<strong style={{ color: 'var(--text-primary)' }}>{`${feWhole(BASE.net)} καθαρά.`}</strong></li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Μεικτή απόδοση:'}</strong>{` ${fn(BASE.gross)} / ${fn(EX_VALUE)} = ${pctOf(BASE.grossYield)}.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{`Καθαρή απόδοση: ${fn(BASE.net)} / ${fn(EX_VALUE)} = ${pctOf(BASE.netYield)}.`}</strong>{` Χάσμα ${GAP} ποσοστιαίες μονάδες.`}</li>
        </ul>

        {/* Οριακός φόρος. ΑΚΑΘΑΡΙΣΤΑ ΚΑΙ ΦΟΡΟΛΟΓΗΤΕΑ, ΡΗΤΑ. Το «12.000€ από άλλα
            ακίνητα» δεν έλεγε ποιο από τα δύο· όποιος το διάβαζε ως φορολογητέο
            και έβαζε όλα τα 7.980€ στο 25% έβγαζε 1.995€ αντί για 1.935€. */}
        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>
          {`Ο φόρος ενός ακινήτου εξαρτάται από τα υπόλοιπα ενοίκιά σου: μετριέται στο οριακό σου κλιμάκιο. Το ίδιο διαμέρισμα, αν εισπράττεις ήδη ${feWhole(EX_OTHER_GROSS)} ακαθάριστα από άλλα ακίνητα (${feWhole(OTHER_TAXABLE)} φορολογητέα), περνά κυρίως στο κλιμάκιο ${ratePct(STACKED_MAIN.rate)}: ${STACKED_SPLIT}, δηλαδή ${feWhole(STACKED.tax)} φόρος αντί για ${feWhole(BASE.tax)}. Τα καθαρά πέφτουν στα ${feWhole(STACKED.net)} και η καθαρή απόδοση στο ${pctOf(STACKED.netYield)}. Γι’ αυτό δύο ιδιοκτήτες με πανομοιότυπο ακίνητο κρατούν διαφορετικά.`}
        </div>

        {/* 4. Απόσβεση */}
        <H2 {...S.payback} />
        <p className="lg-p">
          {`Χοντρικός δείκτης σύγκρισης: η αξία διά τα καθαρά ετήσια έσοδα. Στο παράδειγμα, ${fn(EX_VALUE)} / ${fn(BASE.net)} ≈ ${PAYBACK} χρόνια, με τα σημερινά καθαρά και χωρίς να υπολογιστούν ανατίμηση ή πληθωρισμός. Είναι μέτρο σύγκρισης: βάζει το ακίνητο δίπλα σε άλλες επιλογές, στην ίδια μονάδα. Δεν προβλέπει τιμές.`}
        </p>

        {/* 5. Πηγές / νομική βάση */}
        <GuideSources over="5. Τεκμηρίωση" sources={SOURCES} />

        <GuideCta title="Η καθαρή απόδοση του δικού σου ακινήτου" href="/kathari-apodosi" action="Υπολόγισε την καθαρή απόδοσή σου">
          {`Στον υπολογισμό καθαρής απόδοσης βάζεις τα δικά σου νούμερα, με τον φόρο στο δικό σου κλιμάκιο. Με τον ίδιο τρόπο υπολογίζει και ο πίνακας ελέγχου του ${PRODUCT_NAME}.`}
        </GuideCta>

        {/* Συχνές ερωτήσεις */}
        <GuideFaq title="Ό,τι ρωτούν για την απόδοση" faq={FAQ} />

        <RelatedGuides current={GUIDE} />

        {/* Αποποίηση */}
        <div className="lg-note lg-note-fine" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          {'Ο παρών οδηγός, όπως και κάθε συνδεδεμένος υπολογισμός, είναι ενδεικτικός. Η καθαρή απόδοση εξαρτάται από τα δικά σου δεδομένα και από το σύνολο του εισοδήματός σου. Δεν αποτελεί επίσημο εκκαθαριστικό ούτε υποκαθιστά λογιστή ή φοροτεχνικό.'}
        </div>
      </GuideMain>

      <PublicFooter />
    </div>
  );
}
