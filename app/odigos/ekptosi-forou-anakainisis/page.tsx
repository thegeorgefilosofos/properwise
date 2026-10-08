// ═══════════════════════════════════════════════════════════════════════════
// ΟΔΗΓΟΣ: ΕΚΠΤΩΣΗ ΦΟΡΟΥ ΓΙΑ ΑΝΑΚΑΙΝΙΣΗ (άρθρο 39Β ν.4172/2013), η δημόσια σελίδα
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο ιδιοκτήτης ακούει για «έκπτωση 40%» και υπολογίζει ένα
// όφελος δυόμισι φορές μικρότερο από αυτό που δικαιούται. Το 40% με μέγιστο
// 6.400€ ήταν ο κανόνας του αρχικού άρθρου 39Β, για δαπάνες 2020 έως 2022. Από
// 1.1.2024 το άρθρο αντικαταστάθηκε με τον ν.5073/2023: η μείωση του φόρου
// ΙΣΟΥΤΑΙ με την επιλέξιμη δαπάνη, έως 16.000€ συνολικά για όλα τα έτη,
// ισόποσα σε πέντε έτη. Το ίδιο λάθος το έκανε κάποτε και το δικό μας κείμενο
// (βλ. το σχόλιο της εγγραφής `renovation-39b` στο lib/accounting/updates2026.ts).
//
// ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ ΚΑΘΕ ΓΕΓΟΝΟΣ.
//   · Μείωση ίση με τη δαπάνη, όριο 16.000€ για όλα τα έτη, πέντε έτη, 3.200€
//     τον χρόνο, όχι πάνω από τον φόρο του έτους, υλικά έως το 1/3 των
//     υπηρεσιών, παράθυρο 01.01.2024 έως 31.12.2026: lib/accounting/renovation39b.ts,
//     με πηγές τον ν.5073/2023 και την ΚΥΑ Α.1153/2025 (ΦΕΚ Β΄ 5933/05.11.2025).
//     Οι αριθμοί της σελίδας βγαίνουν από τις σταθερές και τη `renovationCredit`.
//   · Ενεργειακή, λειτουργική και αισθητική αναβάθμιση: lib/accounting/advisory.ts
//     (`renovation-credit`) και lib/property/plan.ts (`tax-credit`).
//   · Μετρητά σημαίνει καμία έκπτωση, τιμολόγιο στο ΑΦΜ, αναλυτική προσφορά:
//     lib/property/plan.ts (`reno-rule-cash`, `reno-rule-quotes`, `tax-credit`).
//   · «Ανακαινίζω 2026» (δράση «Ανακαίνιση Κατοικίας») ως επιδότηση: ποσοστά,
//     όρια, ημερομηνίες και σύνδεσμος από το lib/accounting/anakainisi2026.ts
//     (ΚΥΑ 86272/ΕΞ2026, ΦΕΚ Β΄ 3058/02.06.2026)· η σειρά έγκριση πριν από
//     εργασία: lib/property/plan.ts (`anakainizo`, `reno-rule-order`).
//
// ΤΑ ΕΤΗ ΚΑΙ Η ΗΜΕΡΟΜΗΝΙΑ ΓΡΑΦΟΝΤΑΙ ΠΛΕΟΝ, ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΠΗΓΗ. Η προηγούμενη
// εκδοχή τα απέφευγε επειδή είχαν αλλάξει επανειλημμένα. Η ΚΥΑ Α.1153/2025 τα
// ορίζει ρητά· αν αλλάξουν ξανά, αλλάζουν στο renovation39b.ts.
//
// Server Component για SEO και ταχύτητα. Καμία εξάρτηση από 'use client'.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl, PRODUCT_NAME } from '@/lib/core/site';
import { REGULATORY_UPDATES_2026 } from '@/lib/accounting/updates2026';
import { feWhole } from '@/lib/core/format';
import { ANAK_NAME, ANAK_KYA, ANAK_KYA_AMEND, ANAK_KYA_AMEND2, ANAK_RATES_TEXT, ANAK_CAP_TEXT, ANAK_OTHER_TEXT, ANAK_SCOPE_TEXT, ANAK_OBLIGATION_TEXT, ANAK_STATUS_TEXT } from '@/lib/accounting/anakainisi2026';
import {
  renovationCredit, RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_PER_YEAR, RENO_39B_FROM, RENO_39B_TO,
  RENO_39B_LAW, RENO_39B_KYA, RENO_39B_OLD_RATE,
} from '@/lib/accounting/renovation39b';
import { PublicHeader, PublicFooter, JsonLd } from '../../PublicChrome';
import { shareImage } from '../../og/share';
import { publicMetadata } from '../../publicMetadata';
import { guideAt } from '../guides';
import {
  GuideMain, GuideUpdated, GuideH2 as H2, GuideToc, GuideSources, GuideCta, GuideFaq,
  RelatedGuides, guideJsonLd, LINK_STYLE, type GuideFaqItem,
} from '../GuideParts';

// Ο σύνδεσμος του προγράμματος ζει σε ένα σημείο, στη βάση γνώσης. Αν η εγγραφή
// χαθεί, το build σπάει εδώ αντί να βγει σελίδα με νεκρό σύνδεσμο.
const ANAKAINIZO_HREF = REGULATORY_UPDATES_2026.find(u => u.id === 'anakainizo-2026')?.sourceHref;
if (!ANAKAINIZO_HREF) throw new Error('Λείπει ο σύνδεσμος της εγγραφής anakainizo-2026 στο updates2026.ts');

const CAP = feWhole(RENO_39B_CAP);
const PER_YEAR = feWhole(RENO_39B_PER_YEAR);
// Τα δύο παραδείγματα, υπολογισμένα από τον ίδιο κανόνα που διαβάζει η εφαρμογή.
const EX1 = { services: 12000, materials: 4000 };
const EX2 = { services: 9000, materials: 5000 };
const R1 = renovationCredit(EX1);
const R2 = renovationCredit(EX2);
// Η δαπάνη πάνω από το όριο: 25.000€ επιλέξιμα δίνουν κι αυτά το όριο.
const OVER = 25000;
const R_OVER = renovationCredit({ services: OVER, materials: 0 });
// Ο κανόνας του 2020, μόνο για τη σύγκριση που κάνει ο αναγνώστης.
const OLD_RATE = RENO_39B_OLD_RATE;

const H1 = `Έκπτωση φόρου για ανακαίνιση: έως ${CAP} σε ${RENO_39B_YEARS} έτη`;
const TITLE = H1;
// Κάτω από 160 χαρακτήρες: τόσα δείχνει η σελίδα αποτελεσμάτων πριν κόψει.
const DESC =
  `Η μείωση φόρου για ανακαίνιση ισούται με τη δαπάνη, έως ${CAP} σε ${RENO_39B_YEARS} έτη, `
  + `για δαπάνες έως ${RENO_39B_TO}. Προϋποθέσεις και παράδειγμα.`;
const GUIDE = guideAt('/odigos/ekptosi-forou-anakainisis');
const URL = siteUrl(GUIDE.href);

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESC, url: URL, type: 'article', image: shareImage('odigos-ekptosi-forou-anakainisis') });

// Οι ερωτήσεις τροφοδοτούν ΚΑΙ την ορατή λίστα ΚΑΙ το δομημένο σχήμα: μία πηγή.
const FAQ: GuideFaqItem[] = [
  {
    q: 'Η έκπτωση είναι 40%;',
    a: `Όχι πια. Το 40% ίσχυε για δαπάνες 2020 έως 2022. Για δαπάνες από ${RENO_39B_FROM} έως ${RENO_39B_TO} `
     + `η μείωση φόρου ισούται με την επιλέξιμη δαπάνη, έως ${CAP} συνολικά για όλα τα έτη.`,
  },
  {
    q: 'Σε πόσα χρόνια μοιράζεται η μείωση;',
    a: `Ισόποσα σε ${RENO_39B_YEARS} έτη, δηλαδή το πολύ ${PER_YEAR} τον χρόνο. Σε κάθε έτος η μείωση `
     + 'δεν ξεπερνά τον φόρο που αναλογεί· ό,τι περισσεύει δεν επιστρέφεται.',
  },
  {
    q: 'Μετράει δαπάνη που πλήρωσα με μετρητά;',
    a: 'Όχι. Η δαπάνη πληρώνεται ηλεκτρονικά (κάρτα, έμβασμα ή άμεση πληρωμή) και συνοδεύεται '
     + 'από τιμολόγιο στο ΑΦΜ σου. Πληρωμή με μετρητά σημαίνει καμία έκπτωση, όσο σωστό κι αν είναι το παραστατικό.',
  },
  {
    q: 'Πόσα υλικά μετράνε;',
    a: 'Η αξία των υλικών λαμβάνεται έως το ένα τρίτο της αξίας των υπηρεσιών. Με εργασία '
     + `${feWhole(EX2.services)} μετράνε έως ${feWhole(R2.materialsCounted)} υλικά· ό,τι περισσεύει μένει εκτός επιλέξιμης δαπάνης.`,
  },
  {
    q: 'Είναι το ίδιο με το «Ανακαινίζω 2026»;',
    a: `Όχι. Το «Ανακαινίζω 2026» (δράση ${ANAK_NAME}) είναι επιχορήγηση ${ANAK_RATES_TEXT}, `
     + `${ANAK_CAP_TEXT}. ${ANAK_STATUS_TEXT}. Η έκπτωση του άρθρου 39Β μειώνει τον φόρο εισοδήματος.`,
  },
];

// Οι πηγές και η νομική βάση, ορατές όπως στα εργαλεία (E-E-A-T).
const SOURCES: string[] = [
  `Έκπτωση φόρου δαπανών ανακαίνισης: ${RENO_39B_LAW}, ισχύς από ${RENO_39B_FROM} · μείωση φόρου ίση με την επιλέξιμη δαπάνη · ανώτατο ${CAP} για όλα τα έτη, ισόποσα σε ${RENO_39B_YEARS} έτη · υλικά έως το 1/3 της αξίας των υπηρεσιών · ηλεκτρονική πληρωμή και παραστατικά στο ΑΦΜ του ιδιοκτήτη.`,
  `${RENO_39B_KYA}: εφαρμογή της διάταξης για δαπάνες από ${RENO_39B_FROM} έως ${RENO_39B_TO}, προϋποθέσεις παρόχων και παραστατικών, αποκλεισμός της ίδιας δαπάνης ως επιχειρηματικής.`,
  `${ANAK_NAME} («Ανακαινίζω 2026»): ${ANAK_KYA}, όπως τροποποιήθηκε με την ${ANAK_KYA_AMEND} και την ${ANAK_KYA_AMEND2} · επιχορήγηση ${ANAK_RATES_TEXT} · η επιχορήγηση φτάνει ${ANAK_CAP_TEXT}, ${ANAK_OTHER_TEXT}.`,
];

// Οι ενότητες τροφοδοτούν ΚΑΙ τις κεφαλίδες ΚΑΙ τα περιεχόμενα: μία πηγή.
const S = {
  what: { id: 'ti-einai', over: '1. Η έκπτωση', title: 'Τι μειώνει το άρθρο 39Β' },
  limit: { id: 'orio', over: '2. Το όριο', title: 'Ένα όριο για δαπάνη και μείωση' },
  terms: { id: 'proypotheseis', over: '3. Προϋποθέσεις', title: 'Πληρωμή, τιμολόγια, υλικά' },
  example: { id: 'paradeigma', over: '4. Παράδειγμα', title: 'Δύο ανακαινίσεις, βήμα βήμα' },
  confirm: { id: 'ti-allazei', over: '5. Τι επιβεβαιώνεις', title: 'Παράθυρο και φόρος που φτάνει' },
  grant: { id: 'anakainizo', over: '6. Μην το μπερδέψεις', title: 'Η διαφορά από το «Ανακαινίζω»' },
} as const;

export default function Page() {
  const jsonLd = guideJsonLd({
    guide: GUIDE, headline: H1, description: DESC, faq: FAQ,
    about: 'Έκπτωση φόρου για ανακαίνιση: άρθρο 39Β ν.4172/2013, ανώτατο όριο, προϋποθέσεις',
  });

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />
      <PublicHeader current="odigos" />

      <GuideMain rail={{ sections: Object.values(S), cta: { href: '/kathari-apodosi', action: 'Δες πώς αλλάζει η καθαρή απόδοση' } }}>
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
          {`Το άρθρο 39Β του Κώδικα Φορολογίας Εισοδήματος (ν.4172/2013) μειώνει τον φόρο κατά ποσό ίσο με την επιλέξιμη δαπάνη για ανακαίνιση, έως ${CAP} συνολικά. Κυκλοφορεί ακόμη το «40%»: ήταν ο κανόνας για δαπάνες 2020 έως 2022 και δίνει όφελος δυόμισι φορές μικρότερο από το σημερινό.`}
        </p>
        <p className="lg-p">
          {`Ο οδηγός δείχνει πώς υπολογίζεται η μείωση, ποιες προϋποθέσεις τηρούνται πριν πληρώσεις το πρώτο τιμολόγιο και τι επιβεβαιώνεις πριν από τις ${RENO_39B_TO}.`}
        </p>

        {/* 1. Τι είναι */}
        <H2 {...S.what} />
        <p className="lg-p">
          {`Η διάταξη αφορά δαπάνες ενεργειακής, λειτουργικής και αισθητικής αναβάθμισης κτιρίων που γίνονται από ${RENO_39B_FROM} έως ${RENO_39B_TO}. Δεν αφαιρεί τη δαπάνη από το εισόδημα: μειώνει τον ίδιο τον φόρο κατά ποσό ίσο με την επιλέξιμη δαπάνη. Η μείωση δεν δίνεται μονομιάς· κατανέμεται ισόποσα σε ${RENO_39B_YEARS} έτη και σε κάθε έτος δεν ξεπερνά τον φόρο που αναλογεί.`}
        </p>

        {/* 2. Το όριο */}
        <H2 {...S.limit} />
        <p className="lg-p">
          {`Τα ${CAP} είναι ταυτόχρονα η μέγιστη επιλέξιμη δαπάνη και η μέγιστη μείωση φόρου, για όλα τα έτη μαζί. Μοιρασμένα σε ${RENO_39B_YEARS} έτη κάνουν το πολύ ${PER_YEAR} τον χρόνο. Όποιος υπολογίζει με το παλιό 40% βλέπει το πολύ ${feWhole(RENO_39B_CAP * OLD_RATE)}, δηλαδή δυόμισι φορές λιγότερα από όσα δικαιούται.`}
        </p>
        <p className="lg-p">
          {`Δαπάνη πάνω από το όριο δεν αυξάνει τη μείωση. Μια ανακαίνιση με επιλέξιμη δαπάνη ${feWhole(OVER)} δίνει κι αυτή το πολύ ${feWhole(R_OVER.total)}. Ούτε η μείωση ενός έτους ξεπερνά τον φόρο του: με ετήσιο φόρο κάτω από ${PER_YEAR}, η μείωση του έτους κόβεται στο ύψος του φόρου.`}
        </p>

        {/* 3. Προϋποθέσεις */}
        <H2 {...S.terms} />
        <ul className="lg-ul">
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Ηλεκτρονική πληρωμή.'}</strong>{' Κάρτα, έμβασμα ή άμεση πληρωμή. Δαπάνη που πληρώθηκε με μετρητά δεν μετρά, όσο σωστό κι αν είναι το παραστατικό.'}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Παραστατικά στο όνομά σου.'}</strong>{' Τιμολόγιο στο ΑΦΜ σου για κάθε εργασία και κάθε αγορά υλικών.'}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Πάροχος με έδρα στην Ελλάδα.'}</strong>{' Το συνεργείο ή ο προμηθευτής έχει φορολογική κατοικία ή μόνιμη εγκατάσταση στην Ελλάδα.'}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Υλικά έως το 1/3 των υπηρεσιών.'}</strong>{' Η αξία των υλικών λαμβάνεται υπόψη μόνο έως το ένα τρίτο της αξίας των υπηρεσιών. Ό,τι περισσεύει μένει εκτός.'}</li>
        </ul>
        <p className="lg-p">
          {'Κράτα τιμολόγια και αποδεικτικά πληρωμής ανά ακίνητο από την πρώτη μέρα. Αυτά ζητά ο λογιστής όταν φτάσει η δήλωση.'}
        </p>

        {/* 4. Παράδειγμα */}
        <H2 {...S.example} />
        <p className="lg-p">
          {`Ανακαίνιση διαμερίσματος με ${feWhole(EX1.services)} εργασία και ${feWhole(EX1.materials)} υλικά, όλα πληρωμένα ηλεκτρονικά και τιμολογημένα στο ΑΦΜ του ιδιοκτήτη.`}
        </p>
        <ul className="lg-ul">
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Όριο υλικών:'}</strong>{` ${feWhole(EX1.services)} / 3 = ${feWhole(EX1.services / 3)}. Τα υλικά είναι ${feWhole(EX1.materials)}, άρα μετράνε ολόκληρα.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Επιλέξιμη δαπάνη:'}</strong>{` ${feWhole(EX1.services)} + ${feWhole(R1.materialsCounted)} = ${feWhole(R1.eligible)}, ακριβώς στο όριο.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{`Μείωση φόρου: ${feWhole(R1.total)},`}</strong>{` δηλαδή ${feWhole(R1.perYear)} τον χρόνο για ${RENO_39B_YEARS} έτη, εφόσον ο φόρος κάθε έτους φτάνει.`}</li>
        </ul>
        <p className="lg-p">
          {`Τώρα άλλη αναλογία: ${feWhole(EX2.services)} εργασία και ${feWhole(EX2.materials)} υλικά, σύνολο ${feWhole(EX2.services + EX2.materials)}.`}
        </p>
        <ul className="lg-ul">
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Όριο υλικών:'}</strong>{` ${feWhole(EX2.services)} / 3 = ${feWhole(R2.materialsCounted)}. Τα υλικά είναι ${feWhole(EX2.materials)}, άρα μετράνε μόνο τα ${feWhole(R2.materialsCounted)}.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{'Επιλέξιμη δαπάνη:'}</strong>{` ${feWhole(EX2.services)} + ${feWhole(R2.materialsCounted)} = ${feWhole(R2.eligible)}. Τα ${feWhole(EX2.materials - R2.materialsCounted)} υλικών πάνω από το όριο δεν μετράνε.`}</li>
          <li><strong style={{ color: 'var(--text-primary)' }}>{`Μείωση φόρου: ${feWhole(R2.total)},`}</strong>{` δηλαδή ${feWhole(R2.perYear)} τον χρόνο για ${RENO_39B_YEARS} έτη, αντί για ${feWhole(EX2.services + EX2.materials)} αν μετρούσαν όλα τα υλικά.`}</li>
        </ul>

        <div className="lg-note lg-note-tip" style={{ marginTop: 16 }}>
          {'Η αναλογία φαίνεται ήδη στην προσφορά. Ζήτα από το συνεργείο αναλυτική προσφορά που χωρίζει την εργασία από τα υλικά.'}
        </div>

        {/* 5. Τι επιβεβαιώνεις */}
        <H2 {...S.confirm} />
        <p className="lg-p">
          {`Ο κανόνας ισχύει για δαπάνες από ${RENO_39B_FROM} έως ${RENO_39B_TO}, με την ${RENO_39B_KYA}. Πριν αναθέσεις την εργασία, επιβεβαίωσε με τον λογιστή σου δύο πράγματα:`}
        </p>
        <ul className="lg-ul">
          <li>{`Ότι η δική σου δαπάνη πέφτει μέσα στο παράθυρο. Μετρά η ημερομηνία του τιμολογίου και της πληρωμής· εργασία που τιμολογείται μετά τις ${RENO_39B_TO} μένει εκτός, εκτός αν δοθεί νέα παράταση.`}</li>
          <li>{`Ότι ο φόρος σου φτάνει για να απορροφήσει έως ${PER_YEAR} τον χρόνο. Η μείωση δεν ξεπερνά τον φόρο κάθε έτους και ό,τι περισσεύει δεν επιστρέφεται.`}</li>
        </ul>
        <p className="lg-p">
          {'Για όσους νοικιάζουν ως επιχείρηση: η ίδια δαπάνη δεν εκπίπτει ταυτόχρονα ως επιχειρηματική δαπάνη και ως μείωση φόρου του άρθρου 39Β.'}
        </p>

        {/* 6. Ανακαινίζω */}
        <H2 {...S.grant} />
        <p className="lg-p">
          {`Το «Ανακαινίζω 2026», δηλαδή η δράση ${ANAK_NAME}, είναι επιδότηση, όχι μείωση φόρου. Καλύπτει ${ANAK_SCOPE_TEXT}. Η επιχορήγηση είναι ${ANAK_RATES_TEXT}. Φτάνει ${ANAK_CAP_TEXT}, ${ANAK_OTHER_TEXT}. ${ANAK_OBLIGATION_TEXT}.`}
        </p>
        <p className="lg-p">
          {`${ANAK_STATUS_TEXT}. Στα επιδοτούμενα προγράμματα οι δαπάνες πριν από την ένταξη συνήθως δεν είναι επιλέξιμες, οπότε πρώτα η έγκριση και μετά η εργασία. Οι όροι μετρούν όπως τους γράφουν τα ΦΕΚ της ενότητας 7· τις ανακοινώσεις για το δεύτερο στάδιο τις βλέπεις στη `}
          <a href={ANAKAINIZO_HREF} target="_blank" rel="noopener noreferrer" className="lp-link" style={LINK_STYLE}>{'σελίδα της δράσης στο stegasi.gov.gr'}</a>
          {'.'}
        </p>

        {/* 7. Πηγές / νομική βάση */}
        <GuideSources over="7. Τεκμηρίωση" sources={SOURCES} />

        <GuideCta title="Η ανακαίνιση μέσα στην απόδοση" href="/kathari-apodosi" action="Δες πώς αλλάζει η καθαρή απόδοση">
          {`Στον υπολογισμό καθαρής απόδοσης βάζεις ενοίκιο, ΕΝΦΙΑ και δαπάνες του δικού σου ακινήτου και βλέπεις τι μένει μετά τον φόρο, όπως στον πίνακα ελέγχου του ${PRODUCT_NAME}.`}
        </GuideCta>

        {/* Συχνές ερωτήσεις */}
        <GuideFaq title="Ό,τι ρωτούν για την έκπτωση ανακαίνισης" faq={FAQ} />

        <RelatedGuides current={GUIDE} />

        {/* Αποποίηση */}
        <div className="lg-note lg-note-fine" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          {'Ο παρών οδηγός είναι ενημερωτικός. Η μείωση εξαρτάται από τη διάταξη που ισχύει την ημέρα της δαπάνης, από τον φόρο σου κάθε έτους και από τα δικά σου παραστατικά. Δεν αποτελεί επίσημη γνωμάτευση ούτε υποκαθιστά λογιστή ή φοροτεχνικό.'}
        </div>
      </GuideMain>

      <PublicFooter />
    </div>
  );
}
