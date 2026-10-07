// ═══════════════════════════════════════════════════════════════════════════
// ΓΙΑ ΛΟΓΙΣΤΕΣ: /logistes, Η ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ ΤΟΥ ΑΛΛΟΥ ΑΝΘΡΩΠΟΥ ΤΟΥ ΦΑΚΕΛΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Η πύλη του λογιστή, ο χώρος με όλους τους πελάτες του και ο
// φάκελος ανά ΑΦΜ υπάρχουν στον κώδικα, αλλά ο λογιστής τα μάθαινε μόνο αν
// ένας πελάτης του έστελνε σύνδεσμο. Ο λογιστής που ψάχνει «πρόγραμμα για
// λογιστές με ενοίκια» δεν έβρισκε καμία σελίδα να του απαντά.
//
// ΚΑΝΟΝΑΣ ΣΥΝΤΑΞΗΣ, ΙΔΙΟΣ ΜΕ ΤΟ «ΠΟΙΟΙ ΕΙΜΑΣΤΕ»: κάθε πρόταση αντιστοιχεί σε
// κάτι που κάνει ήδη ο κώδικας και οι αριθμοί διαβάζονται από την πηγή τους.
// Η διάρκεια του συνδέσμου από το lib/data/accountantLink.ts, τα ονόματα των
// αρχείων του φακέλου από το lib/accounting/meetingPack.ts, οι εκκρεμότητες
// της λίστας από το lib/data/accountant.ts, οι στόχοι του προγράμματος από το
// lib/referral/referral.ts με τη διατύπωση των Όρων. Ό,τι δεν υπάρχει ακόμη
// δεν γράφεται, ούτε σε μέλλοντα.
//
// ΧΩΡΙΣ ΠΡΟΣΩΠΙΚΑ ΣΤΟΙΧΕΙΑ. Μόνο το όνομα του προϊόντος και η διεύθυνση της
// υποστήριξης από το μητρώο ταυτότητας· το παράδειγμα της λίστας δεν έχει
// όνομα πελάτη, γιατί κάθε όνομα εκεί θα έμοιαζε με αληθινό πελάτη.
//
// Server Component· το μόνο κομμάτι πελάτη είναι το κοινό BackLink.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next';
import Link from 'next/link';
import { T } from '@/components/tokens';
import { hy } from '@/components/Hyphen';
import { SITE, siteUrl, PRODUCT_NAME, ORG_ID } from '@/lib/core/site';
import { athensParts } from '@/lib/core/time';
import { IDENTITY } from '@/lib/legal/identity';
import { billingWords } from '@/lib/legal/billingWords';
import { ASSISTANT_NAME, ASSISTANT_ACC } from '@/lib/assistant/identity';
import { PLANS, TRIAL_DAYS } from '@/lib/billing/plans';
import { FEATURE_MIN_PLAN } from '@/lib/billing/entitlements';
import { signupCta } from '@/lib/billing/trialOffer';
import {
  PRO_PAID_TARGET, PRO_PAID_BONUS_MONTHS, STREAK_TARGET_MONTHS,
  PARTNER_WELCOME_MONTHS, PARTNER_MONTHLY_FREE_MONTHS, partnerWelcomeTier,
} from '@/lib/referral/referral';
import { ACCOUNTANT_LINK_DAYS } from '@/lib/data/accountantLink';
import { gapsOf, readinessOf, type ClientCounts } from '@/lib/data/accountant';
import { PACK_FILES } from '@/lib/accounting/meetingPack';
import { PublicHeader, PublicFooter, JsonLd, WRAP, WRAP_PAD } from '../PublicChrome';
import { BackLink } from '../BackLink';
import { LINK_STYLE } from '../linkStyle';
import { MailLink } from '../legal-shell';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { GuideH2 as H2, GuideFaq, type GuideFaqItem } from '../odigos/GuideParts';

const PATH = '/logistes';
const URL = siteUrl(PATH);
const H1 = 'Πρόγραμμα για λογιστές: ενοίκια και Ε2 των πελατών σου σε Excel';
// Κάτω από 60 χαρακτήρες πριν από το όνομα: τόσα δείχνει η σελίδα αποτελεσμάτων.
const TITLE = `Πρόγραμμα για λογιστές: ενοίκια και Ε2 σε Excel · ${PRODUCT_NAME}`;
// Κάτω από 160 χαρακτήρες. Λέει τι βλέπει ο λογιστής, όχι τι είμαστε.
const DESC =
  'Ο ιδιοκτήτης σού στέλνει έναν σύνδεσμο: ενοίκια, δαπάνες, βραχυχρόνια και Ε2 ανά ΑΦΜ σε Excel. '
  + 'Όλοι οι πελάτες σου σε μία λίστα, με ό,τι λείπει.';

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL, image: shareImage('logistes') });

/** Μήνες σε αιτιατική, όπως στους Όρους: «έναν μήνα», «2 μήνες». */
const monthsAcc = (n: number): string => (n === 1 ? 'έναν μήνα' : `${n} μήνες`);

// ΤΟ ΠΑΚΕΤΟ ΠΟΥ ΑΝΟΙΓΕΙ ΤΟΝ ΣΥΝΔΕΣΜΟ ΔΙΑΒΑΖΕΤΑΙ, ΔΕΝ ΓΡΑΦΕΤΑΙ. Η πύλη και η
// εξαγωγή Ε2 κρίνονται από το ίδιο δικαίωμα (`e2_export`) στη Λογιστική.
const LINK_PLAN = PLANS[FEATURE_MIN_PLAN.e2_export].name;
// Οι τρεις ανταμοιβές του Συνεργάτη, όπως τις ονομάζουν οι Όροι.
const PARTNER = {
  fromOwner: PLANS[partnerWelcomeTier('owner')].name,
  otherwise: PLANS[partnerWelcomeTier('office')].name,
};

// ═══ ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΤΗΣ ΛΙΣΤΑΣ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΙΔΙΟ ΚΡΙΤΗ ΜΕ ΤΗΝ ΑΛΗΘΙΝΗ ═══════
// Οι φράσεις και η ετικέτα ετοιμότητας βγαίνουν από τα `gapsOf` και
// `readinessOf`, που τρέχουν και στη λίστα του λογιστή. Αν αλλάξει η
// διατύπωση εκεί, αλλάζει και εδώ· η σελίδα δεν μπορεί να δείξει έλλειψη που
// η εφαρμογή δεν αναγνωρίζει. Οι αριθμοί είναι του παραδείγματος.
const SAMPLE: ClientCounts = {
  ownerId: 'paradeigma', name: 'Παράδειγμα', afm: 'paradeigma', linkedAt: '', token: null,
  lastActivity: null, requests: [], properties: 2, expenses: 18, uncategorised: 2,
  noSupplierAfm: 3, rentsUnpaid: 0, stays: 24, staysNoFee: 1, openRequests: 0,
  e2: { aadeRows: 0, aadeChangedAt: null, packs: [] },
};
const SAMPLE_GAPS = gapsOf(SAMPLE);
const SAMPLE_READY = readinessOf(SAMPLE_GAPS);

/** Η χρήση του παραδείγματος του φακέλου: η τελευταία κλεισμένη, όπως στην πύλη. */
const PACK_YEAR = athensParts().year - 1;

/** Τα αρχεία του φακέλου με τη σειρά τους, με τα ονόματα που γράφει το zip. */
const PACK_TREE: { name: string; what: string; depth?: 1 }[] = [
  { name: PACK_FILES.cover, what: 'Μία σελίδα: ποιος, τι, πόσα και τι λείπει.' },
  { name: PACK_FILES.e2(PACK_YEAR), what: 'Το έντυπο Ε2 του ΑΦΜ, στήλη προς στήλη με την αρίθμηση του εντύπου, μαζί με τα Συμπληρωματικά Ι και ΙΙ.' },
  { name: PACK_FILES.review, what: 'Σύγκριση με το προσυμπληρωμένο της ΑΑΔΕ ανά ακίνητο, βραχυχρόνια και τι λείπει.' },
  { name: `${PACK_FILES.papers}/`, what: 'Τα παραστατικά της χρήσης.' },
  { name: '«ακίνητο»/', what: 'Ένας υποφάκελος για κάθε ακίνητο του ΑΦΜ.', depth: 1 },
  { name: `${PACK_FILES.aade}/`, what: 'Το πρωτότυπο προσυμπληρωμένο, όταν έχει ανέβει.' },
];

// Οι ερωτήσεις τροφοδοτούν ΚΑΙ την ορατή λίστα ΚΑΙ το δομημένο σχήμα.
const FAQ: GuideFaqItem[] = [
  {
    q: 'Χρειάζομαι λογαριασμό για να δω τα στοιχεία ενός πελάτη;',
    a: 'Όχι. Ο σύνδεσμος που σου στέλνει ο ιδιοκτήτης ανοίγει χωρίς λογαριασμό και χωρίς κωδικό, μόνο για ανάγνωση. '
     + 'Λογαριασμό χρειάζεσαι μία φορά, για να βλέπεις όλους τους πελάτες σου μαζί, να ζητάς ό,τι λείπει και να '
     + 'κατεβάζεις τον φάκελο που σου στέλνουν.',
  },
  {
    q: 'Πόσο ισχύει ο σύνδεσμος;',
    a: `${ACCOUNTANT_LINK_DAYS} ημέρες από τη στιγμή που τον βγάζει ο ιδιοκτήτης. Μπορεί να τον ανακαλέσει οποτεδήποτε: `
     + 'ο παλιός σταματά αμέσως να λειτουργεί και βγαίνει καινούριος.',
  },
  {
    q: 'Μπορώ να αλλάξω στοιχεία του πελάτη;',
    a: 'Όχι. Ό,τι λείπει το ζητάς από τον ιδιοκτήτη με αίτημα και το καταχωρεί εκείνος. Για λογαριασμό του ανεβάζεις '
     + 'μόνο το προσυμπληρωμένο Ε2 της ΑΑΔΕ, για να γίνει η σύγκριση.',
  },
  {
    q: 'Βλέπω μισθωτές ή επισκέπτες από τον σύνδεσμο;',
    a: 'Όχι. Ο σύνδεσμος μεταφέρει ποσά και στοιχεία ακινήτων, καμία ταυτότητα τρίτου: ούτε μισθωτή, ούτε επισκέπτη, '
     + 'ούτε προμηθευτή. Μισθωτές, ΑΦΜ και παραστατικά υπάρχουν μόνο στον φάκελο που σου στέλνει ο ίδιος ο ιδιοκτήτης.',
  },
  {
    q: 'Το Ε2 σε Excel ακολουθεί το έντυπο;',
    a: 'Ναι. Οι στήλες ακολουθούν το έντυπο Ε2 με την αρίθμησή του, ένα φύλλο ανά ΑΦΜ, με τα Συμπληρωματικά Ι και ΙΙ. '
     + 'Ό,τι η εφαρμογή δεν καταγράφει, όπως μεταβιβάσεις ή διαταγή πληρωμής για ανείσπρακτα, το γράφει στο φύλλο '
     + 'ελέγχου για να το συμπληρώσεις εσύ.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: PRODUCT_NAME,
      url: SITE,
      email: IDENTITY.supportEmail,
      logo: { '@type': 'ImageObject', url: siteUrl('/icons/icon-512.png'), width: 512, height: 512 },
    },
    {
      '@type': 'WebPage',
      '@id': `${URL}#webpage`,
      url: URL,
      name: H1,
      description: DESC,
      inLanguage: 'el',
      isPartOf: { '@id': `${SITE}/#website` },
      publisher: { '@id': ORG_ID },
      audience: { '@type': 'Audience', audienceType: 'Λογιστές και φοροτεχνικοί' },
      about: { '@type': 'Thing', name: 'Ενοίκια, δαπάνες και έντυπο Ε2 πελατών σε Excel για λογιστές' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Αρχική', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Για λογιστές', item: URL },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ],
};

// Οι ενότητες τροφοδοτούν τις κεφαλίδες και τις άγκυρες: μία πηγή.
const S = {
  link: { id: 'syndesmos', over: '1. Ο σύνδεσμος', title: 'Πώς φτάνει σε εσένα ο πελάτης' },
  portal: { id: 'pyli', over: '2. Η χρήση του πελάτη', title: 'Τι βλέπεις για κάθε πελάτη' },
  folder: { id: 'fakelos', over: '3. Ο φάκελος', title: 'Ε2 σε Excel, ένας φάκελος ανά ΑΦΜ' },
  list: { id: 'pelates', over: '4. Οι πελάτες σου', title: 'Όλοι οι πελάτες σε μία λίστα' },
  ask: { id: 'aitimata', over: '5. Αιτήματα', title: 'Ζητάς ό,τι λείπει, χωρίς τηλέφωνο' },
  noa: { id: 'noa', over: `6. ${ASSISTANT_NAME}`, title: 'Τα απλά στον ιδιοκτήτη, τα λογιστικά σε εσένα' },
  partner: { id: 'synergasia', over: '7. Συνεργασία', title: 'Πρόγραμμα συνεργατών για λογιστικά γραφεία' },
} as const;

const strong = { color: 'var(--text-primary)' } as const;
const box = {
  padding: 'clamp(16px, 4vw, 22px)', borderRadius: T.radius.card,
  border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
} as const;
const cta = {
  display: 'inline-flex', alignItems: 'center', minHeight: T.h.lg, padding: '0 24px',
  borderRadius: T.radius.pill, fontSize: 14, fontWeight: 700, textDecoration: 'none',
} as const;

export default function Page() {
  const words = billingWords();
  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader />

      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        {/* Η ΣΤΗΛΗ ΤΩΝ ΟΔΗΓΩΝ (`.gd`, 720): σελίδα κειμένου, με το ίδιο μέτρο
            ανάγνωσης και την ίδια δεξιά άκρη. Όλο το σώμα συλλαβίζεται μία φορά. */}
        <div className="gd">
          <BackLink />
          {hy(<>
            <div className="lp-eyebrow">Για λογιστές</div>
            <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
              lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
              {H1}
            </h1>
            <p className="lg-p">
              {`Ο ιδιοκτήτης κρατά στο ${PRODUCT_NAME} ενοίκια, δαπάνες, διαμονές και παραστατικά όλο τον χρόνο. Εσύ παίρνεις έναν σύνδεσμο μόνο για ανάγνωση και βλέπεις τη χρήση του όπως θα τη δηλώσεις: γραμμή ανά ακίνητο, ό,τι λείπει γραμμένο πρώτο και αρχείο Excel που ανοίγει στο πρόγραμμά σου.`}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '22px 0 0' }}>
              <a href={`#${S.folder.id}`} className="lp-cta lp-primary lp-press" style={cta}>Δες πώς φαίνεται ο φάκελος</a>
              <Link href="/signup" className="lp-cta lp-press" style={{ ...cta, border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>{signupCta()}</Link>
            </div>

            {/* 1. Ο σύνδεσμος */}
            <H2 {...S.link} />
            <ol className="lg-ul">
              <li><strong style={strong}>{'Ο ιδιοκτήτης τον βγάζει από τη Λογιστική του'}</strong>{` και σου τον στέλνει. Καλύπτει όλα τα ακίνητά του, ισχύει ${ACCOUNTANT_LINK_DAYS} ημέρες και ανακαλείται οποτεδήποτε: ο παλιός σταματά αμέσως. Υπάρχει από το πακέτο «${LINK_PLAN}».`}</li>
              <li><strong style={strong}>{'Τον ανοίγεις χωρίς λογαριασμό.'}</strong>{' Χωρίς κωδικό και χωρίς email. Διαλέγεις χρήση· η προεπιλογή είναι η προηγούμενη χρονιά, εκεί που δουλεύεις τον περισσότερο καιρό.'}</li>
              <li><strong style={strong}>{'Με δικό σου λογαριασμό τον κρατάς.'}</strong>{' Επικολλάς τον σύνδεσμο στους πελάτες σου και τον βρίσκεις μαζί με τους υπόλοιπους, χωρίς σελιδοδείκτες.'}</li>
            </ol>

            {/* 2. Η πύλη */}
            <H2 {...S.portal} />
            <ul className="lg-ul">
              <li><strong style={strong}>{'Τι λείπει, πριν από κάθε αριθμό.'}</strong>{' Όσα εμποδίζουν το κλείσιμο της χρήσης γράφονται πρώτα.'}</li>
              <li><strong style={strong}>{'Ενοίκια της χρήσης όπως στο Ε2.'}</strong>{' Δεδουλευμένα, με τους μήνες μίσθωσης και δίπλα πόσα από αυτά εισπράχθηκαν.'}</li>
              <li><strong style={strong}>{'Βραχυχρόνια με το δηλωτέο ακαθάριστο.'}</strong>{' Χωρίς το τέλος ανθεκτικότητας, που δεν είναι έσοδο· η διαμονή που περνά την αλλαγή του έτους μοιράζεται με τις νύχτες της.'}</li>
              <li><strong style={strong}>{'Δαπάνες της χρήσης ανά κατηγορία.'}</strong>{' Με ημερομηνία και ποσό στο αρχείο.'}</li>
              <li><strong style={strong}>{'Η ταυτότητα της γραμμής.'}</strong>{' Διεύθυνση, ΑΤΑΚ, τετραγωνικά και ποσοστό συνιδιοκτησίας. Όπου υπάρχει συνιδιοκτησία, έσοδα και δαπάνες γράφονται και στην αναλογία του ιδιοκτήτη.'}</li>
              <li><strong style={strong}>{'Ενδεικτικός φόρος, με το όνομά του.'}</strong>{' Κάτω από τα μετρημένα ποσά, ως διασταύρωση· τον φόρο τον βγάζεις εσύ.'}</li>
            </ul>
            <p className="lg-p">
              {'Η «Λήψη κατάστασης» κατεβάζει .xlsx με αριθμητικά κελιά, στα φύλλα «Ανά ακίνητο», «Δαπάνες», «Διαμονές» και «Τι λείπει». Στις διαμονές γράφονται νύχτες της χρήσης, δηλωτέο ακαθάριστο, τέλος ανθεκτικότητας, προμήθεια πλατφόρμας και βάση ποσού. Ο υπολογισμός είναι ο ίδιος με της οθόνης, οπότε αρχείο και οθόνη δεν διαφωνούν.'}
            </p>
            <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>
              {'Ο σύνδεσμος δεν μεταφέρει καμία ταυτότητα τρίτου: ούτε μισθωτή, ούτε επισκέπτη, ούτε προμηθευτή. Το ΑΦΜ του μισθωτή, που ζητά το Ε2, το έχει ο ιδιοκτήτης και μπαίνει στον φάκελο που σου στέλνει.'}
            </div>

            {/* 3. Ο φάκελος: εδώ οδηγεί το «Δες πώς φαίνεται ο φάκελος». */}
            <H2 {...S.folder} />
            <p className="lg-p">
              {'Ο ιδιοκτήτης φτιάχνει από τη Λογιστική του έναν φάκελο για κάθε ΑΦΜ και χρήση και τον στέλνει στον λογιστή του. Ακίνητα δύο συζύγων δεν μπαίνουν στο ίδιο έντυπο: κάθε υπόχρεος έχει το δικό του Ε2. Ο φάκελος της χρήσης ' + PACK_YEAR + ' έχει αυτά τα αρχεία:'}
            </p>
            {/* ΤΑ ΟΝΟΜΑΤΑ ΕΙΝΑΙ ΤΟΥ ZIP. Έρχονται από το `PACK_FILES`, το ίδιο που
                ονομάζει τα αρχεία όταν φτιάχνεται ο φάκελος· η προεπισκόπηση δεν
                μπορεί να υποσχεθεί αρχείο που δεν υπάρχει. */}
            <ul aria-label="Τα αρχεία του φακέλου" style={{ ...box, margin: '14px 0 0', listStyle: 'none', display: 'grid', gap: 12 }}>
              {PACK_TREE.map(f => (
                <li key={f.name} style={{ paddingLeft: f.depth ? 20 : 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</span>
                  <span style={{ display: 'block', fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{f.what}</span>
                </li>
              ))}
            </ul>
            <p className="lg-p" style={{ marginTop: 16 }}>
              {'Τον κατεβάζεις από τη λίστα των πελατών σου, μόνο όσο ισχύει η σύνδεση. Δεν φτιάχνεις φάκελο από τα δεδομένα του πελάτη: βλέπεις ό,τι σου έστειλε ο ίδιος. Το προσυμπληρωμένο Ε2 της ΑΑΔΕ μπορείς να το ανεβάσεις εσύ για λογαριασμό του· η σύγκριση γίνεται στη συσκευή του ιδιοκτήτη όταν το ανοίξει και η λίστα σου γράφει μόνο αν συμφωνεί ή πόσες διαφορές βρέθηκαν.'}
            </p>
            <p className="lg-p">
              {'Το ίδιο έντυπο Ε2 σε Excel ο ιδιοκτήτης το κατεβάζει και μόνος του, με ένα φύλλο ανά ΑΦΜ, φύλλο ελέγχου με τα ΑΤΑΚ για τη διασταύρωση με το Ε9, οδηγίες συμπλήρωσης και τον πίνακα 4Δ2 του Ε1.'}
            </p>

            {/* 4. Η λίστα των πελατών */}
            <H2 {...S.list} />
            <ul className="lg-ul">
              <li><strong style={strong}>{'Πρώτα όσοι δεν κλείνουν.'}</strong>{' Κάθε πελάτης γράφει σε μία λέξη πόσο έτοιμος είναι για τη χρήση που διάλεξες, όπως στο παράδειγμα πιο κάτω.'}</li>
              <li><strong style={strong}>{'Τι λείπει από τον καθένα, σε φράσεις.'}</strong>{' Δαπάνες χωρίς κατηγορία, δαπάνες χωρίς ΑΦΜ προμηθευτή, κρατήσεις πλατφόρμας χωρίς προμήθεια, ανείσπρακτα μισθώματα, προσυμπληρωμένο που δεν ανέβηκε ή που διαφωνεί, φάκελος που δεν στάλθηκε.'}</li>
              <li><strong style={strong}>{'Πότε κινήθηκε τελευταία φορά.'}</strong>{' Δύο πελάτες με τα ίδια κενά είναι άλλη δουλειά όταν ο ένας καταχώρησε χθες.'}</li>
              <li><strong style={strong}>{'Αναζήτηση με όνομα ή ΑΦΜ'}</strong>{' όταν οι πελάτες γίνουν πολλοί.'}</li>
              <li><strong style={strong}>{'Ποσά με ένα πάτημα.'}</strong>{' Έσοδα και δαπάνες κάθε πελάτη και «Κατέβασε τα όλα»: ένα βιβλίο Excel ανά πελάτη, σε έναν φάκελο.'}</li>
            </ul>
            {/* ΤΟ ΠΑΡΑΔΕΙΓΜΑ: ίδια κάρτα, ίδιες φράσεις με τη λίστα. */}
            <figure style={{ ...box, margin: '16px 0 0' }}>
              <figcaption style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {`Παράδειγμα πελάτη · ${SAMPLE.properties} ακίνητα`}
                </span>
                <span style={{ fontSize: 13, fontWeight: SAMPLE_READY.blocking > 0 ? 700 : 500, color: 'var(--text-primary)' }}>{SAMPLE_READY.label}</span>
              </figcaption>
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
                {SAMPLE_GAPS.map(g => (
                  <li key={g.key} style={{ fontSize: 14, lineHeight: 1.5, padding: '8px 0', borderTop: '1px solid var(--border-subtle)',
                    color: g.blocking ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: g.blocking ? 600 : 400 }}>
                    {g.item}
                  </li>
                ))}
              </ul>
            </figure>
            <p className="lg-p" style={{ marginTop: 16 }}>
              {'Τον πελάτη που έφυγε τον αφαιρείς από τη λίστα σου. Δεν είναι ανάκληση: η ανάκληση ανήκει στον ιδιοκτήτη και δεν σβήνεται τίποτα δικό του.'}
            </p>

            {/* 5. Αιτήματα */}
            <H2 {...S.ask} />
            <ul className="lg-ul">
              <li><strong style={strong}>{'«Ζήτησέ το» δίπλα σε κάθε έλλειψη,'}</strong>{' με προαιρετική σημείωση: ποια δαπάνη, από πότε, γιατί τη θέλεις τώρα.'}</li>
              <li><strong style={strong}>{'Ο ιδιοκτήτης το βλέπει στη Λογιστική του'}</strong>{' με το όνομά σου και το κλείνει με «Το έστειλα» ή «Δεν ισχύει».'}</li>
              <li><strong style={strong}>{'Στη λίστα σου μένει «Σε εκκρεμότητα»'}</strong>{' με την ημερομηνία αποστολής. Αν το έστειλες κατά λάθος, το παίρνεις πίσω.'}</li>
            </ul>

            {/* 6. Νόα. ΚΑΜΙΑ ΥΠΟΣΧΕΣΗ ΠΕΡΑ ΑΠΟ ΤΟ ΠΡΟΣΩΠΟ ΤΟΥ ΠΡΟΪΟΝΤΟΣ: το τι
                απαντά και πού παραπέμπει είναι γραμμένο στις οδηγίες της
                (app/dashboard/components/assistantPersona.ts) και η ταυτότητα
                στο lib/assistant/identity.ts. Χωρίς άρθρο ως υποκείμενο. */}
            <H2 {...S.noa} />
            <p className="lg-p">
              {`Στα πακέτα με ${ASSISTANT_ACC}, από το «${PLANS.solo.name}» και πάνω, ο ιδιοκτήτης ρωτά για τα δικά του δεδομένα: τι εκκρεμεί, πόσα έδωσε σε συντηρήσεις, σε ποια καρτέλα βρίσκεται κάτι. ${ASSISTANT_NAME} απαντά από τα ακίνητα, τις δαπάνες και τις προθεσμίες του.`}
            </p>
            <p className="lg-p">
              {`Για φόρους, δηλώσεις και λογιστικά ζητήματα, ${ASSISTANT_NAME} παραπέμπει ρητά σε λογιστή ή φοροτεχνικό· για νομικά, σε δικηγόρο ή συμβολαιογράφο. Τα ποσά για φόρους είναι ενδεικτικά. Για ό,τι δεσμεύει, η απάντηση ανήκει σε επαγγελματία, όχι στην εφαρμογή.`}
            </p>

            {/* 7. Το πρόγραμμα συνεργατών, ΜΕ ΤΗ ΔΙΑΤΥΠΩΣΗ ΤΩΝ ΟΡΩΝ. Οι αριθμοί και
                τα πακέτα έρχονται από τη μηχανή του προγράμματος, όπως στο
                app/terms/page.tsx (ενότητα «Πρόγραμμα πρόσκλησης και
                συνεργατών»). Καμία προμήθεια σε μετρητά: δεν υπάρχει. */}
            <H2 {...S.partner} />
            <p className="lg-p">
              {'Με λογαριασμό επαγγελματία προσκαλείς τους πελάτες σου με προσωπικό σύνδεσμο. Ένας λογαριασμός μετρά όταν ενεργοποιηθεί, δηλαδή όταν ο νέος ιδιοκτήτης προσθέσει ακίνητο και σαρώσει ένα έγγραφο.'}
            </p>
            <ul className="lg-ul">
              <li><strong style={strong}>{'Μηνιαίος στόχος.'}</strong>{` Αν ενεργοποιηθούν ${PRO_PAID_TARGET} λογαριασμοί με συνδρομή σε οποιοδήποτε πακέτο μέσα στον ίδιο ημερολογιακό μήνα, κερδίζεις ${monthsAcc(PRO_PAID_BONUS_MONTHS)} «${PLANS.agency.name}». Η ανταμοιβή πιστώνεται όταν τη ζητήσεις από την οθόνη του προγράμματος.`}</li>
              <li><strong style={strong}>{'Ιδιότητα συνεργάτη.'}</strong>{` Αν πιάσεις τον στόχο ${STREAK_TARGET_MONTHS} συνεχόμενους ολοκληρωμένους μήνες, αποκτάς την ιδιότητα συνεργάτη. Με την απόκτησή της κερδίζεις ${monthsAcc(PARTNER_WELCOME_MONTHS)} «${PARTNER.fromOwner}» αν έχεις «${PLANS.solo.name}» ή «${PLANS.owner.name}», αλλιώς ${monthsAcc(PARTNER_WELCOME_MONTHS)} «${PARTNER.otherwise}».`}</li>
              <li><strong style={strong}>{'Από εκεί και πέρα,'}</strong>{` κάθε μήνας που πιάνει τον στόχο σού δίνει ${monthsAcc(PARTNER_MONTHLY_FREE_MONTHS)} συνδρομής χωρίς χρέωση, με προτεραιότητα στη σειρά διάθεσης των νέων δυνατοτήτων.`}</li>
            </ul>
            <p className="lg-p">
              {`${words.compMonths}${words.partnerTarget ? ` ${words.partnerTarget}` : ''} Ο προσκεκλημένος ξεκινά με τη δοκιμή των ${TRIAL_DAYS} ημερών, όπως κάθε νέος λογαριασμός· ο σύνδεσμος δεν του δίνει επιπλέον παροχή.`}
            </p>
            <p className="lg-p">
              <Link href="/terms#systaseis" className="lp-link po-tap" style={LINK_STYLE}>{'Οι όροι του προγράμματος'}</Link>
            </p>

            {/* Η ΕΠΟΜΕΝΗ ΚΙΝΗΣΗ: λογαριασμός, η λίστα για όποιον έχει ήδη, ή μια
                ερώτηση. Μία διεύθυνση, του μητρώου ταυτότητας· κανένα όνομα. */}
            <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
              <div style={box}>
                <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 680, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  {'Ξεκίνα με τον πρώτο σου πελάτη'}
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                  {'Φτιάξε λογαριασμό και επικόλλησε τον σύνδεσμο που σου έστειλε ο ιδιοκτήτης. Αν έχεις ήδη λογαριασμό, οι πελάτες σου είναι ένα πάτημα μακριά.'}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  <Link href="/signup" className="lp-cta lp-primary lp-press" style={cta}>{signupCta()}</Link>
                  <Link href="/accountant/workspace" className="lp-cta lp-press" style={{ ...cta, border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>Οι πελάτες σου</Link>
                </div>
                <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {'Για γραφείο με πολλούς πελάτες ή για μια ερώτηση πριν ξεκινήσεις, γράψε μας στο '}<MailLink to={IDENTITY.supportEmail} />{'.'}
                </p>
              </div>
            </section>
          </>)}

          <GuideFaq title="Ό,τι ρωτούν οι λογιστές" faq={FAQ} />

          <div className="lg-note lg-note-fine" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
            {hy('Τα ποσά είναι όπως τα καταχώρησε ο ιδιοκτήτης. Ο ενδεικτικός φόρος είναι διασταύρωση και όχι εκκαθαριστικό· τη δήλωση την ελέγχει και την υποβάλλει ο λογιστής.')}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
