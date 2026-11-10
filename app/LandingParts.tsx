// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΚΟΜΜΑΤΙΑ ΤΗΣ ΑΡΧΙΚΗΣ: ΕΡΩΤΗΣΕΙΣ, Η ΝΟΑ, ΕΠΙΚΕΦΑΛΙΔΑ ΕΝΟΤΗΤΑΣ, ΚΑΡΤΕΣ ΠΑΚΕΤΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Server components, όπως και η σελίδα που τα αποδίδει (page.tsx).
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link'
import { PLANS, TRIAL_DAYS } from '@/lib/billing/plans'
import { aiLimitsFor, TRIAL_LIMITS, SCAN_LIMITS, TRIAL_SCANS_PER_MONTH } from '@/lib/billing/aiLimits'
import { fe } from '@/lib/core/format'
import { T } from '@/components/tokens'
import { hy } from '@/components/Hyphen'
import { ASSISTANT_NAME, ASSISTANT_ACC } from '@/lib/assistant/identity'
import { signupCta, signupCtaEn } from '@/lib/billing/trialOffer'
import type { Locale } from '@/lib/i18n/locale'
import { localHref } from '@/lib/i18n/paths'
import { PARTS_EN } from '@/lib/i18n/en/landing'
import { planCopy } from '@/lib/i18n/en/plans'
import { fmtFor } from '@/lib/core/format'
import { ACCENT, PANEL, TEXT, MUTED, FAINT, LINE, GAP, wrap, check } from './landingKit'
import { FaqPlus } from './FaqPlus'

/** Μία ερώτηση, ένα σχήμα. Οι δύο λίστες (ορατές και κρυμμένες) δεν επιτρέπεται
 *  να αποκλίνουν σε τυπογραφία ή σε συμπεριφορά: είναι η ίδια ενότητα.
 *
 *  Η ΓΡΑΜΜΗ ΖΕΙ ΣΤΟ CSS, ΟΧΙ ΕΔΩ. Ήταν inline και το inline δεν αναιρείται από
 *  φύλλο στυλ: στη ραφή των δύο ομάδων έπεφταν δύο γραμμές η μία πάνω στην
 *  άλλη και δεν υπήρχε τρόπος να σβήσει η μία χωρίς `!important`. */
export function FaqList({ list }: { list: { q: string; a: string }[] }) {
  return (
    <>
      {list.map((f) => (
        <details key={f.q} className="lp-faq">
          <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '19px 0', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            {f.q}<FaqPlus style={{ color: ACCENT }} />
          </summary>
          {/* ΠΕΡΑ-ΠΕΡΑ, ΓΙΑΤΙ ΕΙΝΑΙ ΔΥΟ ΓΡΑΜΜΕΣ.
          Το μέτρο των 680px υπήρχε για να μη χάνει το μάτι τη σειρά του σε
          παράγραφο δώδεκα γραμμών. Με απαντήσεις δύο γραμμών ο κίνδυνος δεν
          υπάρχει — και το στενό μέτρο έκανε τις ίδιες απαντήσεις πέντε και
          έξι σειρές, που είναι ο πραγματικός λόγος που δεν διαβάζονταν.

          ΑΡΙΣΤΕΡΗ ΣΤΟΙΧΙΣΗ, ΧΩΡΙΣ ΣΥΛΛΑΒΙΣΜΟ. Στοιχισμένες και συλλαβισμένες,
          οι απαντήσεις άνοιγαν κενά ανάμεσα στις λέξεις και έκοβαν λέξεις στη
          μέση («τρέ-χοντος») σε κάθε πλάτος κάτω από τον υπολογιστή. Ίδιος
          κανόνας με τις κάρτες και τις εισαγωγές της σελίδας. */}
          <p className="po-just" style={{ fontSize: 15, color: MUTED, lineHeight: 1.65, margin: '0 0 20px' }}>{hy(f.a)}</p>
        </details>
      ))}
    </>
  );
}


// Η κεφαλίδα κάθε ενότητας: λεπτή γραμμή που δηλώνει την τομή, ετικέτα με κουκκίδα,
// τίτλος, υπότιτλος. Και τα τέσσερα ξεκινούν από το ΙΔΙΟ αριστερό σημείο.
//
// ΓΙΑΤΙ ΟΧΙ ΔΙΠΛΑ: ο υπότιτλος σε δεύτερη στήλη έδινε πυκνότητα, αλλά έσπαγε τον
// άξονα. Όταν ο τίτλος έπιανε δύο γραμμές, ο υπότιτλος έπρεπε να ευθυγραμμιστεί με
// κάτι: με την κορυφή του τίτλου, με τη βάση του ή με το κέντρο. Καμία επιλογή δεν
// ήταν σωστή σε ΟΛΕΣ τις ενότητες, γιατί οι τίτλοι δεν έχουν ίδιο ύψος. Το
// αποτέλεσμα ήταν έξι ενότητες με έξι ελαφρώς διαφορετικές ισορροπίες.
//
// Από κάτω, υπάρχει ένας άξονας και μόνο ένας: ετικέτα, τίτλος, υπότιτλος, κάρτες.
// Κάθε γραμμή της σελίδας ξεκινά στο ίδιο x. Αυτή είναι η στοίχιση που διαβάζεται
// ως προσοχή στη λεπτομέρεια και είναι και η μόνη που δεν σπάει ποτέ.
// ═══ Η ΝΟΑ, ΜΕ ΔΙΚΗ ΤΗΣ ΕΝΟΤΗΤΑ ══════════════════════════════════════════
// ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΑ. Από τις 25.09.2026 ο βοηθός είναι το πράγμα που
// ΠΛΗΡΩΝΕΙΣ: τα φορολογικά ενός ακινήτου είναι δωρεάν. Ό,τι πουλιέται μόνο
// του θέλει δική του σκηνή, όπως οι μεγάλοι παρουσιάζουν ένα add-on: τι
// κάνει, με ποια παραδείγματα, πόσο κοστίζει, ένα κουμπί.
//
// ΔΕΝ ΞΑΝΑΔΕΙΧΝΕΙ ΣΥΝΟΜΙΛΙΑ. Η συνομιλία με απάντηση ζει στο «Πώς δουλεύει»
// (ScrollStory). Εδώ μπαίνουν ΕΡΩΤΗΣΕΙΣ χωρίς απαντήσεις: τι μπορείς να
// ρωτήσεις, ώστε ο επισκέπτης να δει τον εαυτό του στο παράδειγμα. Καμία δεν
// γράφει ποσό, οπότε καμία δεν μπορεί να ειπωθεί λάθος.
//
// ΤΑ ΝΟΥΜΕΡΑ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΗ ΜΗΧΑΝΗ: τιμή από το PLANS, ερωτήσεις από το
// aiLimits. Χωρίς JavaScript: είναι server component, όπως η υπόλοιπη αρχική.
/** Η σάρωση από το SCAN_LIMITS: `null` σημαίνει χωρίς μηνιαίο όριο. */
const scanLine = (n: number | null): string => n === null ? 'σάρωση χωρίς όριο' : `${n} σαρώσεις τον μήνα`;

/**
 * Η δοκιμή με τα δικά της όρια (TRIAL_LIMITS, TRIAL_SCANS_PER_MONTH), όχι με
 * του πακέτου. Κάθεται κάτω από το «σάρωση χωρίς όριο» του πληρωμένου: χωρίς
 * το ταβάνι της σάρωσης θα διαβαζόταν ότι και η δοκιμή σαρώνει απεριόριστα.
 */
const trialLine = (): string =>
  `Δοκιμή ${TRIAL_DAYS} ημερών: ${TRIAL_LIMITS.perMonth} ερωτήσεις, έως ${TRIAL_LIMITS.perDay} την ημέρα · ${scanLine(TRIAL_SCANS_PER_MONTH)}`;

/** Το όριο ακινήτων από τα PLANS, σε λέξεις για το ένα. */
const propertiesLine = (n: number): string => n === 1 ? 'Ένα ακίνητο' : `Έως ${n} ακίνητα`;

// ΤΑ ΙΔΙΑ ΣΤΙΣ ΔΥΟ ΓΛΩΣΣΕΣ. Τα ελληνικά αυτούσια· τα αγγλικά από το
// lib/i18n/en/landing.ts. Ιδιοι αριθμοί από τις ίδιες πηγές.
const PARTS_EL = {
  perMonth: '/μήνα',
  orYear: (amount: string) => `ή ${amount} τον χρόνο`,
  annual: (paid: number) => `Ετήσια: ${paid} μήνες αντί για 12`,
  includes: 'Περιλαμβάνει:',
  questions: (ai: number, day: number) => `${ai} ερωτήσεις τον μήνα, έως ${day} την ημέρα`,
  recommended: 'Προτεινόμενο',
  without: `Χωρίς ${ASSISTANT_NAME}`,
  with: `Με ${ASSISTANT_NAME}`,
  allTax: (props: number) => `${propertiesLine(props)}, όλα τα φορολογικά`,
  scanLine,
  trialLine,
}
const partsFor = (locale: Locale) => (locale === 'en' ? PARTS_EN : PARTS_EL)

const NOA_ASKS = [
  'Πόσα έδωσα σε κοινόχρηστα φέτος;',
  'Ποιος ενοικιαστής μου χρωστά ακόμη;',
  'Τι λήγει αυτόν τον μήνα;',
] as const;

export function NoaFeature({ locale = 'el' }: { locale?: Locale } = {}) {
  const noa = PLANS.solo, ai = aiLimitsFor('solo');
  const en = locale === 'en', P = partsFor(locale), N = PARTS_EN.noa, money = fmtFor(locale).fe;
  const does = [
    ...(en ? N.does : [{ t: 'Ρωτάς όπως μιλάς', d: 'Γραπτά ή με τη φωνή σου, στα ελληνικά.' },
    { t: 'Απαντά με τα δικά σου', d: 'Βασίζεται στις καταχωρήσεις σου, όχι σε γενικές συμβουλές.' },
    { t: 'Σε πάει εκεί που πρέπει', d: 'Ανοίγει την οθόνη που χρειάζεσαι για το επόμενο βήμα.' },
  ]),
  ];
  return (
    <section className="lp-reveal" aria-labelledby="noa-title" style={{ ...wrap, position: 'relative', zIndex: 1, paddingBottom: GAP }}>
      <hr className="lp-hair" />
      <div className="nf-band">
        <div className="nf-copy">
          <div className="lp-eyebrow">{en ? N.over : 'Στα ελληνικά'}</div>
          <h2 id="noa-title" className="nf-title">
            <span className="nf-mono" aria-hidden="true">N</span>
            {en ? N.title : <>Γνώρισε {ASSISTANT_ACC}.</>}
          </h2>
          <p className="nf-lead po-just">{hy(en ? N.lead : 'Ρωτάς για το ακίνητό σου στα ελληνικά και απαντά με τα δικά σου νούμερα. Ό,τι θα ρωτούσες τον λογιστή, πριν τον πάρεις τηλέφωνο.')}</p>
          <ul className="nf-does">
            {does.map(x => (
              <li key={x.t}><strong>{x.t}</strong><span>{hy(x.d)}</span></li>
            ))}
          </ul>
          <div className="nf-offer">
            <div className="nf-price">
              <span className="nf-amount">{money(noa.priceMonthly)}<span className="nf-per" style={{ marginLeft: 2, letterSpacing: 0, fontWeight: 400 }}>{P.perMonth}</span></span>
              <span className="nf-per">{P.orYear(money(noa.priceAnnual))}</span>
            </div>
            {/* ΤΟ ΠΑΚΕΤΟ ΚΑΙ Η ΔΟΚΙΜΗ ΕΧΟΥΝ ΑΛΛΑ ΟΡΙΑ. Η γραμμή έλεγε τις ερωτήσεις
                του πληρωμένου δίπλα στο «δοκιμή 30 ημερών» και κάτω από το κουμπί
                της δοκιμής· η δοκιμή όμως μετρά με τα TRIAL_LIMITS (effectiveAiLimits).
                Η πρώτη γραμμή είναι το πακέτο, δίπλα στην τιμή του· η δεύτερη η δοκιμή. */}
            <div className="nf-terms">{en ? `${ai.perMonth} questions a month` : <>{ai.perMonth} ερωτήσεις τον μήνα</>} · {P.scanLine(SCAN_LIMITS.solo)}</div>
            <div className="nf-terms">{P.trialLine()}</div>
            {en && <div className="nf-terms">{N.disclosure}</div>}
          </div>
          <div className="nf-cta">
            <Link href={localHref(locale, '/signup?plan=solo&cycle=monthly')} className="lp-cta lp-primary lp-press" style={{ textDecoration: 'none', fontSize: 15, fontWeight: 700, padding: '13px 24px', borderRadius: T.radius.pill }}>{en ? N.cta : <>Δοκίμασε {ASSISTANT_ACC}</>}</Link>
            <span className="nf-free">{en ? N.noSub : `Ο «${PLANS.free.name}» χωρίς ${ASSISTANT_ACC} δεν θέλει συνδρομή.`}</span>
          </div>
        </div>
        <div className="nf-stage" aria-label={en ? N.stage : `Παραδείγματα ερωτήσεων προς ${ASSISTANT_ACC}`}>
          <div className="nf-card">
            <div className="nf-head">
              <span className="nf-avatar" aria-hidden="true">N</span>
              <span><strong>{en ? N.name : ASSISTANT_NAME}</strong><small>{en ? N.sub : 'Για τα ακίνητά σου'}</small></span>
            </div>
            <ul className="nf-asks">
              {(en ? N.asks : NOA_ASKS).map(q => <li key={q}>{q}</li>)}
            </ul>
            <div className="nf-input" aria-hidden="true">
              <span>{en ? N.input : 'Ρώτα κάτι για το ακίνητό σου…'}</span>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>
            </div>
          </div>
          {en && <p style={{ position: 'relative', margin: '12px 0 0', fontSize: 12, color: FAINT, textAlign: 'center' }}>{N.asksNote}</p>}
        </div>
      </div>
    </section>
  );
}

/**
 * ΑΡΙΘΜΟΣ ΚΑΙ ΜΟΝΑΔΑ ΔΕΝ ΧΩΡΙΖΟΝΤΑΙ ΣΕ ΑΛΛΑΓΗ ΓΡΑΜΜΗΣ. Στις στήλες των 210
 * εικονοστοιχείων το «15» έμενε στο τέλος της μιας σειράς και τα «ακίνητα» στην
 * αρχή της επόμενης· η κάρτα ψήλωνε κατά μία σειρά για ένα κενό.
 */
const glue = (t: string) => t.replace(/(\d+)\s+(?=\S)/g, '$1\u00A0');

export function SectionHead({ over, title, sub }: { over?: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 'clamp(24px, 3.4vw, 40px)' }}>
      <hr className="lp-hair" />
      {/* Χωρίς ετικέτα όταν θα επαναλάμβανε τον τίτλο (έλεγχος UX 09/11/2026). */}
      {over && <div className="lp-eyebrow">{over}</div>}
      <h2 style={{ fontSize: 'clamp(25px, 3.4vw, 40px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0, textWrap: 'balance' }}>{title}</h2>
      {/* Ο υπότιτλος παίρνει όλο το πλάτος της στήλης και ΚΑΘΕ κείμενο κόπηκε ώστε
          να χωρά σε μία γραμμή. Δύο γραμμές υπότιτλου κάτω από μονόγραμμο τίτλο
          δίνουν βαρύ, ασύμμετρο μπλοκ· μία και μία διαβάζονται ως ζευγάρι.

          ΣΤΟ ΚΙΝΗΤΟ ΓΙΝΕΤΑΙ ΔΙΣΤΙΧΟ ΚΑΙ ΤΟ ΔΙΣΤΙΧΟ ΔΕΝ ΣΤΟΙΧΙΖΕΤΑΙ (01.10.2026).
          Με πλήρη στοίχιση και συλλαβισμό, η πρώτη από δύο γραμμές τεντωνόταν
          και η λέξη κοβόταν ακριβώς κάτω από τον τίτλο. Είναι κείμενο οθόνης,
          όχι παράγραφος: αριστερά, χωρίς ενωτικά, με `pretty` για να μη μείνει
          μία λέξη μόνη στη δεύτερη γραμμή. */}
      {sub && <p data-nohy="" style={{ fontSize: 16, color: MUTED, lineHeight: 1.55, margin: '13px 0 0', textWrap: 'pretty' }}>{sub}</p>}
    </div>
  );
}

// ═══ Η ΚΑΡΤΑ ΤΟΥ «ΙΔΙΟΚΤΗΤΗ», ΜΕ ΤΟΝ ΔΙΑΚΟΠΤΗ ΤΗΣ ΝΟΑΣ ═════════════════════
// ΔΥΟ ΠΑΚΕΤΑ ΣΕ ΜΙΑ ΚΑΡΤΑ, ΧΩΡΙΣ JAVASCRIPT. Δύο κουμπιά επιλογής (radio) και
// ο συνδυαστής `~` του CSS: η αρχική δεν φορτώνει κώδικα για να αλλάξει μια
// τιμή (το νήμα της είχε μετρηθεί μπλοκαρισμένο 550ms σε μεσαίο Android). Τα
// δύο σώματα, `.pc-off` και `.pc-on`, είναι αδέρφια των κουμπιών· το κρυμμένο
// έχει `display: none`, άρα ούτε ο αναγνώστης οθόνης το διαβάζει.
//
// ΤΑ ΝΟΥΜΕΡΑ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΗ ΜΗΧΑΝΗ: τιμή από το PLANS, ερωτήσεις από το
// aiLimits, σαρώσεις από το SCAN_LIMITS. Καμία γραμμή δεν γράφεται δεύτερη φορά.
export function OwnerPlanCard({ billingLive, locale = 'el' }: { billingLive: boolean; locale?: Locale }) {
  const P = partsFor(locale), money = fmtFor(locale).fe, whole = fmtFor(locale).feWhole;
  const freeCopy = planCopy(locale, 'free'), noaCopy = planCopy(locale, 'solo');
  const free = PLANS.free, noa = PLANS.solo;
  const ai = aiLimitsFor('solo');
  const paidMonths = Math.round(noa.priceAnnual / noa.priceMonthly);
  const line = (t: string, k: number) => (
    <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>{check}<span className="lp-even" style={{ fontSize: 13, color: TEXT, lineHeight: 1.45 }}>{glue(t)}</span></div>
  );
  // Οι γραμμές του δωρεάν, με τη σάρωση στη θέση της· στη «Νόα» η ίδια θέση
  // λέει «χωρίς όριο», ώστε το μάτι να βλέπει τι αλλάζει στο ίδιο σημείο.
  // Η ΣΑΡΩΣΗ ΒΡΙΣΚΕΤΑΙ ΑΠΟ ΤΗΝ ΕΛΛΗΝΙΚΗ ΓΡΑΜΜΗ ΚΑΙ ΠΑΙΡΝΕΙ ΤΗ ΘΕΣΗ ΤΗΣ: η αγγλική
  // λίστα έχει την ίδια σειρά (lib/i18n/en/plans.test.ts).
  const isScan = (f: string) => f.startsWith('Σάρωση');
  const shared = freeCopy.features.filter((_, i) => !isScan(free.features[i]));
  const freeScan = freeCopy.features[free.features.findIndex(isScan)] ?? '';
  const noaScan = noaCopy.features[noa.features.findIndex(isScan)] ?? '';
  const noaMark = (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M4 3 H8.5 L15.5 14.5 V3 H20 V21 H15.5 L8.5 9.5 V21 H4 Z" /></svg>
  );
  const bubble = (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="po-lead-ico"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.2A8 8 0 1 1 21 12" /></svg>
  );
  const price = (amount: string, per: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(24px, 2.4vw, 29px)', fontWeight: 700, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1 }}>{amount}</span>
      <span style={{ fontSize: 13, color: MUTED }}>{per}</span>
    </div>
  );
  const cta = (href: string, label: string) => (
    <Link href={href} className="lp-ghost lp-press" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, textAlign: 'center', background: 'var(--bg-elevated)', color: TEXT, textDecoration: 'none', fontSize: 13, fontWeight: 700, padding: '10px', borderRadius: T.radius.pill, border: '1px solid var(--border-default)' }}>{label}</Link>
  );
  return (
    <div className="lp-card pc-card" style={{ position: 'relative', background: PANEL, border: `1px solid ${LINE}`, borderRadius: T.radius.card, padding: 'clamp(16px, 1.6vw, 20px)' }}>
      <input type="radio" name="pc-noa" id="pc-noa-off" className="pc-radio" defaultChecked />
      <input type="radio" name="pc-noa" id="pc-noa-on" className="pc-radio" />
      <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT, margin: '0 0 4px' }}>{freeCopy.name}</h3>
      {/* ΥΠΟΤΙΤΛΟΣ ΚΑΙ ΔΙΑΚΟΠΤΗΣ ΣΕ ΜΙΑ ΓΡΑΜΜΗ ΤΟΥ SUBGRID. Οι κάρτες του
          `.lp-plans` μοιράζονται επτά γραμμές (τίτλος, υπότιτλος, τιμή,
          σημείωση, λίστα, κουμπί, ετήσια)· ο διακόπτης ως χωριστό παιδί έσπρωχνε
          όλη την υπόλοιπη κάρτα σε μία γραμμή και οι τρεις διπλανές άνοιγαν
          κενό μισής οθόνης. Τα `.pc-off`/`.pc-on` είναι `display: contents`,
          οπότε τα παιδιά τους πιάνουν τις ίδιες γραμμές με τις άλλες κάρτες.

          Ο ΔΙΑΚΟΠΤΗΣ. Δύο ετικέτες για τα δύο κουμπιά· το πάτημα οπουδήποτε στην
          ετικέτα αλλάζει επιλογή και τα βέλη του πληκτρολογίου κάνουν το ίδιο. */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: FAINT, marginBottom: 12, lineHeight: 1.35 }}>{freeCopy.tagline}</div>
        <div className="pc-seg" role="presentation">
          {/* ΙΔΙΑ ΛΕΞΗ ΜΕ ΤΟ ΠΑΚΕΤΟ ΚΑΙ ΜΕ ΤΟΝ ΠΙΝΑΚΑ. Το πακέτο λέγεται «Ιδιοκτήτης
              με Νόα» και ο πίνακας του /paketa γράφει «με Νόα»· ο διακόπτης
              έγραφε άλλο όνομα στο κάθε κουμπί, δηλαδή τρία ονόματα για το ίδιο. */}
          <label htmlFor="pc-noa-off">{P.without}</label>
          <label htmlFor="pc-noa-on"><span className="pc-mark">{noaMark}</span>{P.with}</label>
        </div>
      </div>
      <div className="pc-off">
        {/* Στη διαφήμιση το μηδέν γράφεται «0€»: δεκαδικά σε μηδέν διαβάζονται ως
            λογιστικό φύλλο. Η τιμή και το όριο όμως από τα PLANS, όπως σε κάθε
            άλλη κάρτα. */}
        {/* ΙΔΙΑ ΜΟΝΑΔΑ ΜΕ ΚΑΘΕ ΑΛΛΗ ΤΙΜΗ (02.11.2026). Εγραφε «0€ χωρίς συνδρομή»
            εδώ και «0,00€/μήνα» στο /paketa: δύο όψεις για το ίδιο μηδέν. Τώρα
            «0€/μήνα» και στα δύο, το «χωρίς συνδρομή» το λέει ο υπότιτλος. */}
        {price(free.priceMonthly === 0 ? whole(free.priceMonthly) : money(free.priceMonthly), P.perMonth)}
        <div style={{ fontSize: 12, color: FAINT, marginTop: 4 }}>{P.allTax(free.maxProperties)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', margin: '14px 0 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.01em' }}>{P.includes}</div>
          {[...shared, freeScan].map(line)}
        </div>
        {cta(localHref(locale, '/signup'), locale === 'en' ? signupCtaEn() : signupCta())}
      </div>
      <div className="pc-on">
        {price(money(noa.priceMonthly), P.perMonth)}
        <div style={{ fontSize: 12, color: FAINT, marginTop: 4 }}>{locale === 'en' ? <>or <strong style={{ color: TEXT }}>{money(noa.priceAnnual)} a year</strong></> : <>ή <strong style={{ color: TEXT }}>{fe(noa.priceAnnual)} τον χρόνο</strong></>}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', margin: '14px 0 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.01em' }}>{P.includes}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: ACCENT }}>{bubble}<span className="lp-even" style={{ fontSize: 13, color: TEXT, lineHeight: 1.45 }}>{glue(P.questions(ai.perMonth, ai.perDay))}</span></div>
          {[...shared, noaScan].map(line)}
          {/* Ακριβώς πάνω από το κουμπί της δοκιμής, τα όρια της δοκιμής: οι
              ερωτήσεις στην κορυφή της λίστας είναι του πληρωμένου πακέτου.
              Μέσα στη λίστα και όχι δίπλα της, για να μη γίνει όγδοη γραμμή
              του subgrid που μοιράζονται οι κάρτες. */}
          <div style={{ fontSize: 12, color: FAINT, lineHeight: 1.4, marginTop: 2 }}>{P.trialLine()}</div>
        </div>
        {cta(localHref(locale, `/signup?plan=solo&cycle=monthly`), locale === 'en' ? signupCtaEn('solo') : signupCta('solo'))}
        {billingLive && <Link href={localHref(locale, '/signup?plan=solo&cycle=annual')} className="lp-link" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 44, marginTop: 2, color: TEXT, textDecoration: 'underline', textUnderlineOffset: 3, fontSize: 13, lineHeight: 1.35, whiteSpace: 'nowrap' }}>{P.annual(paidMonths)}</Link>}
      </div>
    </div>
  );
}

export function PlanCard({ planId, name, nameColor, sub, price, per, note, annual, inherits, ai, aiDay, items, cta, ctaGhost, featured, locale = 'el' }: {
  locale?: Locale;
  planId: string; name: string; nameColor: string; sub: string; price: string; per: string; note: React.ReactNode; annual?: string; inherits?: string; ai: number; aiDay: number; items: string[]; cta: string; ctaGhost?: boolean; featured: boolean;
}) {
  return (
    <div className="lp-card" style={{ position: 'relative', background: PANEL, border: featured ? `1.5px solid color-mix(in srgb, var(--accent) 50%, transparent)` : `1px solid ${LINE}`, borderRadius: T.radius.card, padding: 'clamp(16px, 1.6vw, 20px)', boxShadow: featured ? '0 24px 60px -30px color-mix(in srgb, var(--shadow-ink) 60%, transparent)' : 'none' }}>
      {featured && <span style={{ position: 'absolute', top: -9, left: 16, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: PANEL, border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: T.radius.pill, padding: '2px 9px', whiteSpace: 'nowrap' }}>{partsFor(locale).recommended}</span>}
      {/* Τίτλος, για να πηγαίνει ο αναγνώστης οθόνης από πακέτο σε πακέτο. */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: nameColor, margin: '0 0 4px' }}>{name}</h3>
      <div style={{ fontSize: 12, color: FAINT, marginBottom: 14, lineHeight: 1.35 }}>{sub}</div>
      {/* ΤΟ ΠΟΣΟ ΚΑΙ Η ΠΕΡΙΟΔΟΣ ΕΙΝΑΙ ΕΝΑ ΠΡΑΓΜΑ: «3,90€ τον μήνα» διαβάζεται
          σαν φράση, όχι σαν αριθμός με λεζάντα από κάτω. Το `baseline` τα
          στοιχίζει στη γραμμή γραφής, οπότε το μικρό «τον μήνα» κάθεται πάνω
          στη βάση του μεγάλου ποσού αντί να αιωρείται στο κέντρο του.

          Το `nowrap` είναι απαραίτητο, όχι διακοσμητικό: χωρίς αυτό το «τον
          μήνα» έπεφτε κάτω από το «29,90€» και «79,90€» —τα δύο μεγαλύτερα
          ποσά— και οι λίστες ξεκινούσαν σε διαφορετικό ύψος σε κάθε κάρτα. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(24px, 2.4vw, 29px)', fontWeight: 700, letterSpacing: '-0.03em', color: TEXT, lineHeight: 1.1 }}>{price}</span>
        <span style={{ fontSize: 13, color: MUTED }}>{per}</span>
      </div>
      <div style={{ fontSize: 12, color: FAINT, marginTop: 4 }}>{note}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', margin: '14px 0 16px' }}>
        {inherits && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.01em', marginBottom: 1 }}>{inherits}</div>}
        {/* ΤΟ ΠΑΚΕΤΟ ΕΡΩΤΗΣΕΩΝ ΜΕ ΝΟΥΜΕΡΟ, ΟΧΙ ΜΕ ΕΠΙΘΕΤΟ. Οι λίστες έλεγαν
            «διπλάσιο πακέτο ερωτήσεων» και «το μεγαλύτερο πακέτο ερωτήσεων»:
            διπλάσιο από τι και μεγαλύτερο από τι, δεν το έλεγε κανείς — και
            στο φθηνότερο πακέτο δεν γραφόταν τίποτα, οπότε διαβαζόταν ως «δεν
            τον έχει». Ο αριθμός υπάρχει και είναι ακριβής (aiLimits.ts): μπαίνει.
            Διαφορετικό εικονίδιο επίτηδες — είναι η μία γραμμή που έχουν ΟΛΑ τα
            πακέτα και το μάτι πρέπει να τη βρίσκει στην ίδια θέση σε κάθε κάρτα. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {/* Το ΞΕΧΩΡΙΣΤΟ εικονίδιο εξυπηρετεί το μάτι, που το βρίσκει στην ίδια
              θέση σε κάθε κάρτα. Δεν κουβαλά όμως πληροφορία που δεν λέει η
              διπλανή γραμμή, γι’ αυτό μένει έξω από το προσβάσιμο δέντρο. */}
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="po-lead-ico"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.2A8 8 0 1 1 21 12" /></svg>
          {/* ΚΑΙ ΤΟ ΗΜΕΡΗΣΙΟ, ΠΡΙΝ ΤΗΝ ΑΓΟΡΑ. Μέσα σε ένα απόγευμα δεσμεύει αυτό
              και όχι το μηνιαίο· το να το μάθει κανείς τη στιγμή που το χτυπά
              είναι η έκπληξη που ακυρώνει συνδρομές. */}
          <span className="lp-even" style={{ fontSize: 13, color: TEXT, lineHeight: 1.45 }}>{glue(partsFor(locale).questions(ai, aiDay))}</span>
        </div>
        {items.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>{check}<span className="lp-even" style={{ fontSize: 13, color: TEXT, lineHeight: 1.45 }}>{glue(t)}</span></div>
        ))}
      </div>
      {/* ══ Η ΕΠΙΛΟΓΗ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ ΜΕ ΤΟ ΚΛΙΚ ΚΑΙ ΟΙ ΕΠΙΛΟΓΕΣ ΕΙΝΑΙ ΔΥΟ ══
          Και οι τέσσερις κάρτες οδηγούσαν στο ίδιο γυμνό «/signup», οπότε η
          επιλογή πακέτου —η μόνη απόφαση που παίρνει ο επισκέπτης σε αυτή τη
          σελίδα— χανόταν στη μετάβαση.

          ΚΑΙ Ο ΚΥΚΛΟΣ ΤΑΞΙΔΕΥΕΙ ΤΩΡΑ ΜΑΖΙ ΤΟΥ. Το δώρο της ετήσιας ήταν μια
          κονκάρδα που δεν πατιόταν: ο επισκέπτης που πείθεται από τους δύο
          δωρεάν μήνες κατέληγε στην ίδια ΜΗΝΙΑΙΑ εγγραφή με όποιον δεν τους
          πρόσεξε καν — και μετά την επιβεβαίωση του email πήγαινε κατευθείαν
          στο ταμείο, όπου ο κύκλος δεν ξαναρωτιέται. Δηλαδή η μισή απόφαση
          και η ακριβότερη, χανόταν σε μια ταμπέλα. Τώρα είναι δρόμος.

          ΓΙΑΤΙ ΔΕΥΤΕΡΟΣ ΣΥΝΔΕΣΜΟΣ ΚΑΙ ΟΧΙ ΔΙΑΚΟΠΤΗΣ ΣΤΗΝ ΚΟΡΥΦΗ: ο διακόπτης
          θα έκρυβε τη μία από τις δύο τιμές και η σύγκριση των τεσσάρων
          πακέτων γίνεται με το μάτι, σε μία σάρωση. Εδώ φαίνονται και οι δύο.

          ΚΑΙ ΓΙΑΤΙ Ο ΣΥΝΔΕΣΜΟΣ ΔΕΝ ΞΑΝΑΓΡΑΦΕΙ ΤΗΝ ΕΤΗΣΙΑ ΤΙΜΗ: τη λέει ήδη η
          γραμμή κάτω από τη μηνιαία. Μετρημένο σε πραγματικό Chromium: με το
          ποσό μέσα, το κείμενο έσπαγε σε δύο γραμμές από τις 1000 ως τις 1160
          και μόνο σε τρεις από τις τέσσερις κάρτες — τέσσερα κουμπιά με άνισο
          «πόδι». Χωρίς αυτό, μία γραμμή σε κάθε πλάτος και σε κάθε πακέτο. */}
      {/* ΤΡΙΑ ΑΠΟ ΤΑ ΤΕΣΣΕΡΑ ΚΟΥΜΠΙΑ ΔΕΝ ΔΕΙΧΝΑΝ ΚΟΥΜΠΙΑ. Το δευτερεύον ήταν
          διάφανο πάνω σε διάφανο με περίγραμμα --border-subtle: πάνω στο σκούρο
          θέμα η γραμμή σχεδόν εξαφανίζεται και ό,τι μένει είναι κεντραρισμένο
          κείμενο. Δίπλα στο γεμάτο μπλε του προτεινόμενου, τα άλλα τρία
          διαβάζονταν ως ταμπέλες.

          Η ιεραρχία μένει: γεμάτο μπλε για το προτεινόμενο, ανασηκωμένη
          επιφάνεια για τα υπόλοιπα. Δεν μπαίνει δεύτερο χρώμα, μπαίνει ΥΨΟΣ:
          το --bg-elevated είναι ένα σκαλί πάνω από την κάρτα και το
          --border-default μια γραμμή που φαίνεται. Και τα τέσσερα πιάνουν 44
          εικονοστοιχεία ύψος, όσο ζητά το δάχτυλο. */}
      <Link href={localHref(locale, `/signup?plan=${planId}&cycle=monthly`)} className={ctaGhost ? 'lp-ghost lp-press' : 'lp-cta lp-primary lp-press'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, textAlign: 'center', background: ctaGhost ? 'var(--bg-elevated)' : undefined, color: ctaGhost ? TEXT : undefined, textDecoration: 'none', fontSize: 13, fontWeight: 700, padding: '10px', borderRadius: T.radius.pill, border: ctaGhost ? '1px solid var(--border-default)' : 'none' }}>{cta}</Link>
      {/* ΣΥΝΔΕΣΜΟΣ ΠΟΥ ΜΟΙΑΖΕΙ ΣΥΝΔΕΣΜΟΣ. Γκρι, δώδεκα εικονοστοιχεία, χωρίς
          υπογράμμιση: διαβαζόταν ως λεζάντα και όχι ως επιλογή. */}
      {annual && <Link href={localHref(locale, `/signup?plan=${planId}&cycle=annual`)} className="lp-link" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 44, marginTop: 2, color: TEXT, textDecoration: 'underline', textUnderlineOffset: 3, fontSize: 13, lineHeight: 1.35, whiteSpace: 'nowrap' }}>{annual}</Link>}
    </div>
  );
}
