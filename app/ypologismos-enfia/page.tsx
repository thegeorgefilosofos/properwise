// ═══════════════════════════════════════════════════════════════════════════
// ΔΩΡΕΑΝ ΥΠΟΛΟΓΙΣΤΗΣ ΕΝΦΙΑ — η δημόσια σελίδα
// ─────────────────────────────────────────────────────────────────────────
// Δεύτερο δωρεάν εργαλείο, ίδια λογική με τον υπολογιστή φόρου ενοικίων: το
// lib/billing/enfia.ts περιέχει ήδη τον πλήρη υπολογισμό με νομική παραπομπή ανά
// συντελεστή (ζώνη, όροφος, παλαιότητα, μειώσεις, προσαύξηση, Ενότητα Γ). Ήταν
// κλειδωμένο πίσω από τη σύνδεση.
//
// Ο ΕΝΦΙΑ είναι η ερώτηση που κάνει ΚΑΘΕ Έλληνας ιδιοκτήτης, κάθε χρόνο και
// συνήθως πανικόβλητος λίγο πριν τη λήξη της δόσης. Είναι η στιγμή που έχει
// μεγαλύτερη ανάγκη ένα εργαλείο οργάνωσης — και η στιγμή που δεν μας ξέρει.
//
// Κόστος λειτουργίας: μηδέν. Υπολογισμός στη συσκευή, καμία εγγραφή.
// ═══════════════════════════════════════════════════════════════════════════
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { T } from '@/components/tokens';
import { siteUrl } from '@/lib/core/site';
import { athensParts, athensToday } from '@/lib/core/time';
import { PublicHeader, PublicFooter, JsonLd, SectionHead, ToolLede, ToolSources, ToolCta, TOOL_PRIVACY_FAQ, WRAP, WRAP_PAD } from '../PublicChrome';
import { ToolGuides } from '../odigos/ToolGuides';
import { hy } from '@/components/Hyphen';
import { BackLink } from '../BackLink';
import { shareImage } from '../og/share';
import { publicMetadata } from '../publicMetadata';
import { EnfiaCalculator } from './EnfiaCalculator';
import { ToolLedger } from '../ToolParts';
import { smallSettlementRelief } from '@/lib/tools/enfiaRelief';
import { PAGE_UPDATED, limitsChecked } from '../pageUpdated';
import { ENFIA_AGE_BANDS, ENFIA_PRE_YEAR, ENFIA_CENTURY_YEARS, enfiaOldBuildingYears } from '@/lib/billing/enfia';
import { fe, fn, fpRate, feRate, feSigned, feWhole } from '@/lib/core/format';
import { AADE_DESTINATIONS } from '@/lib/tax/aade';
import { toolJsonLd, ToolByline, ToolOnwardLinks } from '../toolSeo';
import { enfiaH1, enfiaExamples } from './seo';
import { enfiaSignupHref } from '@/lib/tools/enfiaCarry';
import { SPEC } from './spec';

// ΤΟ ΕΤΟΣ ΤΟΥ ΤΙΤΛΟΥ ΕΙΝΑΙ ΤΟ ΕΤΟΣ ΤΟΥ ΥΠΟΛΟΓΙΣΜΟΥ. Ήταν γραμμένο «2026» με το
// χέρι, ενώ ο υπολογιστής και ο πίνακας των δόσεων ακολουθούν το τρέχον έτος:
// την 1.1.2027 ο τίτλος στη Google θα έλεγε 2026 πάνω από πίνακα του 2027.
const titleFor = (year: number) => `Υπολογισμός ΕΝΦΙΑ ${year} με τα δικά σου δεδομένα`;
const DESC =
  'Υπολόγισε τον ΕΝΦΙΑ του ακινήτου σου από τα τετραγωνικά, την τιμή ζώνης, τον όροφο '
  + 'και την παλαιότητα. Με τα δικά σου δεδομένα. Δωρεάν, χωρίς εγγραφή.';
const PATH = '/ypologismos-enfia';
const URL = siteUrl(PATH);

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΕΤΟΣ ΤΩΝ ΔΟΣΕΩΝ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ ΚΑΙ ΕΙΝΑΙ ΤΟ ΤΡΕΧΟΝ
// ─────────────────────────────────────────────────────────────────────────
// Ο πίνακας των δόσεων χρειάζεται χρονιά. Αν την υπολόγιζε ο υπολογιστής μέσα
// στην απόδοση, ο διακομιστής και ο περιηγητής θα μπορούσαν να διαφωνήσουν
// —ακριβώς την παραμονή της Πρωτοχρονιάς— και η ενυδάτωση θα έσπαγε. Ένα
// στήριγμα λύνει και τα δύο: υπολογίζεται μία φορά, στην ώρα Ελλάδας και ο
// πελάτης δεν ρωτά ποτέ τι μέρα είναι.
//
// Δεν χρειάζεται ρύθμιση επαναπροσδιορισμού: η ρίζα της εφαρμογής διαβάζει
// κεφαλίδα (nonce ασφαλείας) σε κάθε αίτημα, οπότε κάθε σελίδα αποδίδεται ήδη
// κατά παραγγελία και το έτος δεν παγώνει ποτέ στη στιγμή του build.
// ═══════════════════════════════════════════════════════════════════════════

// Ο τίτλος είναι απόλυτος και η εικόνα κοινοποίησης μπαίνει πάντα (publicMetadata).
export function generateMetadata(): Metadata {
  return publicMetadata({ title: titleFor(athensParts().year), description: DESC, url: URL, image: shareImage('ypologismos-enfia') });
}

const ageBand = (key: string) => ENFIA_AGE_BANDS.find(b => b.key === key)!;
const AGE_NEW = ageBand('y0_4'), AGE_25 = ageBand('y20_25'), AGE_26 = ageBand('y26_plus'), AGE_PRE = ageBand('pre1930'), AGE_OVER = ageBand('over100');

// ΟΙ ΕΡΩΤΗΣΕΙΣ ΘΕΛΟΥΝ ΤΗ ΧΡΟΝΙΑ. Η μείωση του μικρού οικισμού ισχύει μόνο για
// τον ΕΝΦΙΑ του 2026· η απάντηση για τις απαλλαγές την αναφέρει όσο ισχύει και
// σωπαίνει μόνη της μετά.
function faqFor(year: number): { q: string; a: string }[] {
  const small = smallSettlementRelief(year);
  return [
    {
      q: 'Πώς υπολογίζεται ο ΕΝΦΙΑ;',
      a: 'Ο κύριος φόρος κτίσματος προκύπτει από τα τετραγωνικά επί τον βασικό φόρο της ζώνης, '
       + 'επί τον συντελεστή ορόφου, επί τον συντελεστή παλαιότητας και επί το ποσοστό ιδιοκτησίας '
       + 'σου. Πάνω σε αυτό εφαρμόζονται μειώσεις ανάλογα με τη συνολική αξία της ακίνητης '
       + 'περιουσίας και προσαύξηση αν αυτή ξεπερνά τις 500.000€.',
    },
    {
      q: 'Πού βρίσκω την τιμή ζώνης;',
      a: 'Στο συμβόλαιο του ακινήτου, στη δήλωση Ε9, ή στον χάρτη αντικειμενικών αξιών της ΑΑΔΕ. '
       + 'Είναι η τιμή σε ευρώ ανά τετραγωνικό μέτρο για την περιοχή του ακινήτου.',
    },
    {
      // ΟΙ ΣΥΝΤΕΛΕΣΤΕΣ ΑΠΟ ΤΗ ΜΗΧΑΝΗ, ΟΧΙ ΑΠΟ ΤΟ ΧΕΡΙ (13.10.2026). Η απάντηση
      // έγραφε «1,25» και «1,00» ως κείμενο και σταματούσε στα 26 έτη, ενώ ο
      // νόμος έχει και 0,8 πριν από το 1930 και 0,60 άνω των 100 ετών (άρθρο 11
      // ν.5219/2025, πηγή στο lib/billing/enfia.ts). Το «έως 25% περισσότερο από
      // ένα παλιό» έπαυε να ισχύει μαζί.
      q: 'Γιατί τα νεότερα κτίρια επιβαρύνονται περισσότερο;',
      a: `Ο συντελεστής παλαιότητας μειώνεται όσο περνούν τα χρόνια: κτίσμα έως ${AGE_NEW.maxYears} ετών έχει `
       + `συντελεστή ${fn(AGE_NEW.coef, 2)} ενώ κτίσμα ${(AGE_25.maxYears ?? 0) + 1} ετών και άνω έχει ${fn(AGE_26.coef, 2)}. `
       + `Για τα παλιά κτίρια ο νόμος έχει δύο ακόμη: ${fn(AGE_PRE.coef, 2)} για όσα ανεγέρθηκαν πριν από `
       + `το ${ENFIA_PRE_YEAR} και ${fn(AGE_OVER.coef, 2)} για όσα έχουν πάνω από ${ENFIA_CENTURY_YEARS} χρόνια. `
       // ΔΥΟ ΑΦΕΤΗΡΙΕΣ (13.10.2026). Τα χρόνια μετρούν από τη νεότερη οικοδομική
       // άδεια (άρθρο 11 Ενότητα Α΄ παρ. 1 περ. ε΄ ν.5219/2025)· το «πριν από το
       // 1930» ο νόμος το κρίνει με το έτος ανέγερσης («ανεγέρθηκαν»).
       + `Τα χρόνια μετρούν από το έτος της νεότερης οικοδομικής άδειας ή, χωρίς άδεια, από το έτος κατασκευής `
       + `(για τον ΕΝΦΙΑ ${year}, πάνω από ${ENFIA_CENTURY_YEARS} χρόνια σημαίνει έως το ${enfiaOldBuildingYears(year).over100.to}). `
       + `Το «πριν από το ${ENFIA_PRE_YEAR}» κρίνεται από το έτος ανέγερσης, ακόμη κι αν υπάρχει νεότερη άδεια.`,
    },
    {
      q: 'Υπάρχουν απαλλαγές;',
      a: 'Ναι, με κριτήρια: μείωση 50% για χαμηλό εισόδημα σε κύρια κατοικία, 100% απαλλαγή για '
       + 'τρίτεκνους, πολύτεκνους και αναπηρία 80% και άνω, υπό εισοδηματικά και περιουσιακά όρια '
       + 'και έκπτωση 20% για ασφαλισμένη κατοικία. '
       + (small ? `Ισχύει και η ${small}. ` : '')
       + 'Ο υπολογιστής δεν τις εφαρμόζει, γιατί εξαρτώνται από στοιχεία που δεν του δίνεις. '
       + 'Αν πιστεύεις ότι δικαιούσαι κάποια από αυτές τις νόμιμες εκπτώσεις ή απαλλαγές, '
       + 'έλεγξέ το με τον λογιστή σου.',
    },
    {
      q: 'Το ποσό είναι ακριβώς αυτό που θα πληρώσω;',
      a: 'Όχι. Είναι εκτίμηση για ένα κτίσμα, με τη συνολική περιουσία να θεωρείται ίση με αυτό. '
       + 'Αν έχεις κι άλλα ακίνητα, οικόπεδα ή αποθήκες, αλλάζουν τόσο η μείωση όσο και η '
       + 'προσαύξηση. Το επίσημο ποσό βγαίνει από το εκκαθαριστικό της ΑΑΔΕ.',
    },
    TOOL_PRIVACY_FAQ,
  ];
}

// Ο ΕΝΦΙΑ ΣΤΟ myAADE, ΑΠΟ ΤΟ ΜΗΤΡΩΟ (lib/tax/aade.ts): πύλη και διαδρομή σε λέξεις.
const ENFIA_AADE = AADE_DESTINATIONS.enfia;
const LINK = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 } as const;
const PROSE = { fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 } as const;

export default function Page() {
  const { year } = athensParts();
  const FAQ = faqFor(year);
  const examples = enfiaExamples(year);
  // Μία πηγή για σελίδα και σχήμα: το `FAQPage` είναι ο ίδιος πίνακας που
  // αποδίδουν οι «Συχνές ερωτήσεις» από κάτω (app/toolSeo.tsx).
  const jsonLd = toolJsonLd({ name: `Υπολογισμός ΕΝΦΙΑ ${year}`, url: URL, description: DESC, faq: FAQ });

  return (
    <div className="po-tool-page" data-mode="dark" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: T.font.sans }}>
      <JsonLd data={jsonLd} />

      <PublicHeader />

      <main style={{ ...WRAP, padding: `clamp(28px,4vw,44px) ${WRAP_PAD} clamp(56px,7vw,88px)` }}>
        <BackLink />
        <div className="lp-eyebrow">Υπολογιστής</div>
        {/* Η ΕΠΙΚΕΦΑΛΙΔΑ ΛΕΕΙ ΤΗ ΦΡΑΣΗ ΠΟΥ ΨΑΧΝΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ (13.10.2026): «ΕΝΦΙΑ
            {έτος} υπολογισμός», με το έτος του υπολογισμού, όπως ο τίτλος. */}
        <h1 style={{ fontSize: 'clamp(28px,4.4vw,42px)', fontWeight: 680, letterSpacing: '-0.035em',
          lineHeight: 1.1, margin: '0 0 14px', textWrap: 'balance' }}>
          {enfiaH1(year)}
        </h1>
        {/* Ίδια δομή με τον υπολογιστή φόρου ενοικίων και για τον ίδιο λόγο:
            η υπόσχεση κλείνει με την άνω τελεία της, η εγγύηση απορρήτου πιάνει
            δική της σειρά και η υποσημείωση ακολουθεί στο τέλος της. Δύο υπολογιστές με την ίδια δουλειά δεν επιτρέπεται να έχουν
            δύο διατάξεις. */}
        <ToolLede>Καθορίζεται από τα τετραγωνικά, την τιμή ζώνης, τον όροφο και την παλαιότητα.</ToolLede>

        {/* Ο ΥΠΟΛΟΓΙΣΤΗΣ ΔΙΑΒΑΖΕΙ ΤΗ ΔΙΕΥΘΥΝΣΗ, ΑΡΑ ΘΕΛΕΙ ΟΡΙΟ ΑΝΑΜΟΝΗΣ. Το
            `useSearchParams` σε προαποδοσμένη διαδρομή αναγκάζει απόδοση στον
            πελάτη μέχρι το πλησιέστερο <Suspense>· χωρίς αυτό, ολόκληρη η
            σελίδα —τίτλος, κείμενο, συχνές ερωτήσεις— θα έβγαινε από τη
            στατική απόδοση και θα έχανε το SEO για το οποίο υπάρχει. Με το
            όριο εδώ, μόνο η φόρμα περιμένει τον πελάτη.
            Η εφεδρεία έχει το ΙΔΙΟ ύψος με τη φόρμα, ώστε το κείμενο από κάτω
            να μην αναπηδήσει μόλις φορτώσει. */}
        <Suspense fallback={<div style={{ minHeight: 420 }} aria-hidden/>}>
          <EnfiaCalculator year={year} today={athensToday()} cta={
            <ToolCta
              // Η εγγραφή συνεχίζει στον πίνακα με τον οδηγό ανοιχτό. Από πάνω
              // γράφει ο υπολογιστής τα πεδία που άλλαξε ο επισκέπτης (ToolCtaHref).
              href={enfiaSignupHref(SPEC)}
              title="Έχεις περισσότερα από ένα ακίνητα;"
              body="Το PROPERWISE εκτιμά τον ΕΝΦΙΑ για όλα σου τα ακίνητα μαζί, με τη μείωση που αντιστοιχεί στη συνολική περιουσία και σου θυμίζει κάθε δόση πριν λήξει."
            />
          }/>
        </Suspense>

        <ToolSources kind="enfia" checked={limitsChecked('/ypologismos-enfia')} updated={PAGE_UPDATED['/ypologismos-enfia']} />

        {/* ── ΔΥΟ ΠΑΡΑΔΕΙΓΜΑΤΑ ΑΠΟ ΤΟΝ ΥΠΟΛΟΓΙΣΤΗ (13.10.2026) ──────────────────
            Τα ποσά βγαίνουν από την ίδια κλήση της μηχανής με τη φόρμα (seo.ts)
            και γράφονται με την ίδια ανάλυση (`ToolLedger`), με τις ίδιες
            ετικέτες και τους ίδιους μορφοποιητές: ο σύνδεσμος κάτω από κάθε
            παράδειγμα ανοίγει τη φόρμα με τα ίδια στοιχεία και το ίδιο ποσό. Το
            δεύτερο είναι το κτίριο του 1925 του Μέρους 2, με τον συντελεστή
            0,60 των κτιρίων άνω των 100 ετών. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(44px,6vw,72px)' }}>
          <SectionHead over={`Παραδείγματα ΕΝΦΙΑ ${year}`} title="Δύο ακίνητα, βήμα βήμα" />
          <p className="po-just" style={PROSE}>{hy(
            'Με πλήρη ιδιοκτησία και χωρίς βοηθητικούς χώρους. Η αξία είναι εκτίμηση, τετραγωνικά επί την τιμή ζώνης, όπως στον υπολογιστή.')}</p>
          {examples.map((e, i) => (
            <div key={e.built}>
              <h3 style={EG}>{`Παράδειγμα ${i + 1}: ${e.name} του ${e.built}`}</h3>
              <ToolLedger rows={[
                { k: 'Τετραγωνικά', v: `${fn(e.sqm)} τ.μ.`, kind: 'param' },
                { k: 'Τιμή ζώνης', v: `${fe(e.zonePrice)}/τ.μ.`, kind: 'param' },
                { k: 'Όροφος', v: e.floorLabel, kind: 'param' },
                { k: 'Παλαιότητα', v: e.ageLabel, kind: 'param' },
                { k: 'Αντικειμενική αξία ακινήτου (εκτίμηση)', v: fe(e.value) },
                { k: 'Βασικός φόρος ζώνης', v: `${feRate(e.zoneTax)}/τ.μ.`, kind: 'param' },
                { k: 'Συντελεστής ορόφου', v: fn(e.floorCoef, 2), kind: 'param' },
                { k: 'Συντελεστής παλαιότητας', v: fn(e.ageCoef, 2), kind: 'param' },
                { k: 'Κύριος φόρος κτίσματος', v: fe(e.ledger.basic) },
                e.reductionPct > 0 && {
                  k: `Αυτόματη μείωση ${fpRate(e.reductionPct)}${e.bracket ? ` (περιουσία έως ${feWhole(e.bracket)})` : ''}`,
                  v: feSigned(-e.ledger.reduction),
                },
                { k: 'ΕΝΦΙΑ ετησίως', v: fe(e.annual), kind: 'total' },
              ]}/>
              <p style={{ margin: '10px 0 0', fontSize: 14 }}>
                {/* Αυτοτελής σύνδεσμος, όχι λέξη σε πρόταση: 44 στην αφή (`.po-tap`).
                    Το e2e:rendered του PR 401 τον έπιασε στα 17. */}
                <Link href={e.href} className="lp-link po-tap" style={LINK}>{`Άνοιξε το παράδειγμα ${i + 1} στον υπολογιστή`}</Link>
              </p>
            </div>
          ))}
          <p className="po-just" style={{ ...PROSE, marginTop: 20 }}>{hy(<>
            Το επίσημο ποσό είναι στο εκκαθαριστικό της ΑΑΔΕ. Στο{' '}
            <a href={ENFIA_AADE.url} target="_blank" rel="noopener noreferrer" className="lp-link" style={LINK}>{ENFIA_AADE.portal}</a>
            {ENFIA_AADE.login ? ', με τους κωδικούς TAXISnet' : ''}: {ENFIA_AADE.steps.join(' · ')}.
          </>)}</p>
        </section>

        {/* ── Συχνές ερωτήσεις ──────────────────────────────────────────────
               ΗΤΑΝ ΠΕΝΤΕ ΚΟΥΤΙΑ ΜΕ ΠΕΡΙΓΡΑΜΜΑ ΚΑΙ ΤΟ ΒΕΛΑΚΙ ΤΟΥ ΠΕΡΙΗΓΗΤΗ, ενώ ο
               αδελφός υπολογιστής δίπλα λύνει το ίδιο πρόβλημα με λεπτές γραμμές
               και έναν σταυρό που γυρίζει. Δύο εργαλεία της ίδιας σελίδας δεν
               επιτρέπεται να έχουν δύο διαφορετικά σχήματα για την ίδια λίστα. */}
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
            δίνει το ποσό· όποιος θέλει να δει από πού βγαίνει κάθε συντελεστής
            έχει έναν αναλυτικό οδηγό, με πηγές και παράδειγμα σε ευρώ. Ο
            σύνδεσμος στέκει εδώ ώστε ο επισκέπτης να τον βρίσκει τη στιγμή της
            ερώτησης, όχι μόνο μέσα από μηχανή αναζήτησης. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Ο αναλυτικός οδηγός" title="Από πού βγαίνει κάθε συντελεστής" />
          <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{hy(<>
            Ο υπολογιστής δίνει το ποσό· ο οδηγός{' '}
            <Link href="/odigos/pos-ypologizetai-o-enfia" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              πώς υπολογίζεται ο ΕΝΦΙΑ
            </Link>{' '}εξηγεί τον τύπο, τους συντελεστές (ζώνη, παλαιότητα, όροφος) και τις αυτόματες μειώσεις, με παράδειγμα σε ευρώ.
          </>)}</p>
        </section>

        {/* Ο ΔΕΥΤΕΡΟΣ ΥΠΟΛΟΓΙΣΤΗΣ ΕΙΝΑΙ ΤΟ ΕΠΟΜΕΝΟ ΒΗΜΑ, ΟΧΙ ΥΠΟΣΗΜΕΙΩΣΗ. Ο
            ιδιοκτήτης που μόλις βρήκε τον ΕΝΦΙΑ του και νοικιάζει το ακίνητο
            έχει ακριβώς μία ακόμη ερώτηση. */}
        <section className="po-tool-more" style={{ marginTop: 'clamp(40px,5vw,60px)' }}>
          <SectionHead over="Και μετά" title="Ο φόρος των ενοικίων υπολογίζεται χωριστά" />
          <p className="po-just" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{hy(<>
            Ο ΕΝΦΙΑ είναι φόρος <strong style={{ color: 'var(--text-primary)' }}>κατοχής</strong> και δεν
            αφαιρείται από το εισόδημα των ενοικίων: τα δύο ποσά αθροίζονται, δεν συμψηφίζονται. Αν
            νοικιάζεις το ακίνητο, δες και τον{' '}
            <Link href="/ypologismos-forou-enoikion" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              υπολογισμό φόρου ενοικίων
            </Link>· και αν σκέφτεσαι τη βραχυχρόνια μίσθωση, τη{' '}
            <Link href="/vraxyxronia-i-makroxronia" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              σύγκριση βραχυχρόνιας και μακροχρόνιας
            </Link>. Και αν η ερώτηση είναι αν το ακίνητο αξίζει όσα σου κοστίζει, η{' '}
            <Link href="/kathari-apodosi" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              καθαρή απόδοση
            </Link>{' '}βάζει τον φόρο, τον ΕΝΦΙΑ και τις δαπάνες στην ίδια σελίδα.
          </>)}</p>
          <ToolOnwardLinks />
        </section>
        <ToolByline />
        <ToolGuides tool="/ypologismos-enfia" />
      </main>

      <PublicFooter />
    </div>
  );
}

// Ο τίτλος κάθε παραδείγματος, όπως στους οδηγούς (app/odigos/forologia-enoikion-2026).
const EG = {
  fontSize: 16, fontWeight: 680, letterSpacing: '-0.01em', color: 'var(--text-primary)',
  margin: '22px 0 10px',
} as const;
