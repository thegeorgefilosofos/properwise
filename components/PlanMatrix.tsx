'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΠΕΡΙΛΑΜΒΑΝΕΙ ΚΑΘΕ ΠΑΚΕΤΟ — Ο ΠΙΝΑΚΑΣ, ΣΕ ΔΙΚΗ ΤΟΥ ΣΕΛΙΔΑ
//
// ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΙΣ ΡΥΘΜΙΣΕΙΣ. Δεκαέξι γραμμές επί τέσσερις στήλες, δηλαδή
// εξήντα τέσσερα κελιά, κάθονταν μόνιμα ανοιχτά κάτω από τον τιμοκατάλογο. Ο
// συνδρομητής που μπήκε στις Ρυθμίσεις για να αλλάξει τη διεύθυνση τιμολόγησης
// κυλούσε από πάνω τους κάθε φορά. Ενας πίνακας δυνατοτήτων διαβάζεται ΜΙΑ φορά
// στη ζωή του λογαριασμού, τη στιγμή που διαλέγεις πακέτο.
//
// ΚΑΙ ΓΙΑΤΙ ΣΕ ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ. Η ίδια ερώτηση («τι παίρνω με τι») είναι η πρώτη
// που κάνει και ο επισκέπτης που δεν έχει λογαριασμό. Κλειδωμένη πίσω από τη
// σύνδεση, η απάντηση δεν βρισκόταν ούτε από μηχανή αναζήτησης.
//
// ΜΙΑ ΠΗΓΗ. Κάθε κελί βγαίνει από τα `lib/billing`: τα όρια ακινήτων από τα
// `PLANS`, οι ερωτήσεις από το `aiLimitsFor` και οι κλειδωμένες γραμμές από το
// ΙΔΙΟ μητρώο `FEATURE_MIN_PLAN` που κρίνει και την πραγματική πρόσβαση. Ο
// πίνακας δεν μπορεί να διαφωνήσει με τον κώδικα, γιατί τον διαβάζει.
// ═══════════════════════════════════════════════════════════════════════════

import { PLANS, TEAM_LINE, PRIORITY_SUPPORT_LINE, firstPlanWith, type PlanId } from '@/lib/billing/plans';
import { aiLimitsFor, SCAN_LIMITS } from '@/lib/billing/aiLimits';
import { ASSISTANT_TO, ASSISTANT_NAME } from '@/lib/assistant/identity';
import { FEATURE_LABEL, FEATURE_MIN_PLAN, planAtLeast, type Feature } from '@/lib/billing/entitlements';
import { fn } from '@/components/tokens';
import { fe } from '@/lib/core/format';
import { Btn } from '@/components/Theme';
import { signupCta } from '@/lib/billing/trialOffer';
import { FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';

export type ComparedPlan = Extract<PlanId, 'solo' | 'owner' | 'agency' | 'office'>;
export const COMPARED: ComparedPlan[] = ['solo', 'owner', 'agency', 'office'];

type CellValue = boolean | string;
interface FeatureRow { label: string; values: Record<ComparedPlan, CellValue> }

/** Το όριο ακινήτων γράφεται ΠΑΝΤΑ από τα PLANS, ποτέ με το χέρι. */
const limitLabel = (id: ComparedPlan): string => {
  const n = PLANS[id].maxProperties;
  if (!Number.isFinite(n)) return 'Χωρίς όριο';
  return n === 1 ? '1' : `Έως ${n}`;
};

// ── Ο ΠΙΝΑΚΑΣ ΔΕΝ ΞΑΝΑΛΕΕΙ ΤΟΥΣ ΚΑΝΟΝΕΣ· ΤΟΥΣ ΔΙΑΒΑΖΕΙ ────────────────────
// Οι γραμμές ήταν γραμμένες με το χέρι ως booleans ανά πλάνο και είχαν ήδη
// αποκλίνει από αυτό που ΕΠΙΒΑΛΛΕΙ ο κώδικας:
//
//   · «Εξαγωγή Ε2» έλεγε ότι θέλει «Ιδιοκτήτης». Το `FEATURE_MIN_PLAN` το
//     ξεκλειδώνει από το «Ένα ακίνητο», που κοστίζει πολλαπλάσια λιγότερο.
//   · Το ίδιο και η «Διαχείριση ενοικιαστών & εισπράξεις».
//
// Δηλαδή ο πίνακας τιμών έλεγε στον χρήστη να αγοράσει ακριβότερο πλάνο από όσο
// χρειαζόταν. Δεν είναι θέμα αισθητικής· είναι λάθος τιμολόγηση στην οθόνη που
// ζητά την κάρτα του. Τώρα κάθε κλειδωμένη γραμμή παράγεται από το ίδιο μητρώο
// που κρίνει και την πρόσβαση — δεν μπορούν να διαφωνήσουν.
const gated = (f: Feature): FeatureRow => ({
  label: FEATURE_LABEL[f],
  values: Object.fromEntries(COMPARED.map(p => [p, planAtLeast(p, FEATURE_MIN_PLAN[f])])) as Record<ComparedPlan, CellValue>,
});
const forAll = (label: string): FeatureRow => ({
  label, values: Object.fromEntries(COMPARED.map(p => [p, true])) as Record<ComparedPlan, CellValue>,
});

// ΟΣΑ ΠΟΥΛΑΕΙ Η ΚΑΡΤΑ ΤΗΣ ΑΡΧΙΚΗΣ, Ο ΠΙΝΑΚΑΣ ΤΑ ΛΕΕΙ ΚΙ ΑΥΤΟΣ. Η ομάδα με
// ρόλους και η υποστήριξη με προτεραιότητα δεν έχουν κλείδωμα στο `FEATURE_MIN_PLAN`·
// είναι γραμμές του `PLANS[…].features`. Η γραμμή ισχύει από το πρώτο πακέτο
// που τη γράφει και πάνω, όπως λέει και το «Όλα του … και:» της κάρτας. Αν
// λείψει από το plans.ts, το `firstPlanWith` πετά και η σελίδα δεν χτίζεται,
// αντί να δείξει σιωπηλά «Όχι» σε όλα.
const fromPlanLine = (label: string, line: string): FeatureRow => {
  const first = firstPlanWith(line);
  return {
    label,
    values: Object.fromEntries(COMPARED.map(p => [p, planAtLeast(p, first)])) as Record<ComparedPlan, CellValue>,
  };
};

// ΟΙ ΤΙΜΕΣ ΔΕΝ ΕΙΝΑΙ ΓΡΑΜΜΗ ΤΟΥ ΠΙΝΑΚΑ, ΕΙΝΑΙ Η ΚΕΦΑΛΗ ΤΗΣ ΣΤΗΛΗΣ (01.10.2026).
// Μπήκαν πρώτα ως δύο γραμμές («Τιμή τον μήνα», «Τιμή τον χρόνο») με το ίδιο
// βάρος 13px με το «Έως 3» και το «Χωρίς όριο» από κάτω τους: η απάντηση στο
// «πόσο» δεν ξεχώριζε από είκοσι άλλες γραμμές. Τώρα ζουν στο `PlanPrice`, στην
// κορυφή κάθε στήλης και κάθε κάρτας, πάντα από τα PLANS όπως και η αρχική.
// ═══ Η ΠΡΩΤΗ ΣΤΗΛΗ ΕΙΝΑΙ ΔΥΟ ΠΑΚΕΤΑ, ΟΠΩΣ ΚΑΙ Η ΚΑΡΤΑ ΤΗΣ ΑΡΧΙΚΗΣ ══════════
// Από 25.09.2026 ο «Ιδιοκτήτης» είναι δωρεάν (`free`) και με τη Νόα γίνεται
// `solo`, 4,99€. Τέσσερις στήλες μένουν τέσσερις: η στήλη `solo` λέγεται
// «Ιδιοκτήτης» και όπου τα δύο διαφέρουν γράφει και τα δύο, πρώτα το δωρεάν.
// Οι γραμμές με ναι/όχι δεν αλλάζουν: ό,τι έχει ο δωρεάν το έχει και ο με Νόα.
const WITH_NOA = `με ${ASSISTANT_NAME}`;
const both = (free: string, noa: string) => `${free} · ${noa} ${WITH_NOA}`;
export const columnName = (id: ComparedPlan): string => id === 'solo' ? PLANS.free.name : PLANS[id].name;
// Η ΣΤΗΛΗ ΛΕΓΕΤΑΙ ΟΠΩΣ Ο ΔΙΑΚΟΠΤΗΣ ΤΗΣ ΑΡΧΙΚΗΣ. Η κάρτα εκεί γράφει «Χωρίς Νόα»
// και «Με Νόα»· εδώ ο αναγνώστης οθόνης άκουγε σκέτο «Ιδιοκτήτης» για στήλη
// που περιέχει και το πληρωμένο πακέτο.
const columnLabel = (id: ComparedPlan): string =>
  id === 'solo' ? `${PLANS.free.name}, δωρεάν ή ${WITH_NOA}` : PLANS[id].name;
const withSolo = (row: FeatureRow, solo: string): FeatureRow => ({ ...row, values: { ...row.values, solo } });

const MATRIX: FeatureRow[] = [
  { label: 'Ακίνητα', values: Object.fromEntries(COMPARED.map(p => [p, limitLabel(p)])) as Record<ComparedPlan, CellValue> },
  { label: `Ερωτήσεις ${ASSISTANT_TO} τον μήνα`,
    values: { ...Object.fromEntries(COMPARED.map(p => [p, fn(aiLimitsFor(p).perMonth)])) as Record<ComparedPlan, CellValue>,
      // «30 με Νόα» μόνο του διαβαζόταν σαν 30 ερωτήσεις στο δωρεάν. Πρώτα το
      // «Όχι» του δωρεάν, από κάτω όσα δίνει η Νόα, όπως και στη φωνή.
      solo: both('Όχι', fn(aiLimitsFor('solo').perMonth)) } },
  // ΤΟ ΗΜΕΡΗΣΙΟ ΟΡΙΟ ΛΕΓΕΤΑΙ ΠΡΙΝ ΤΗΝ ΑΓΟΡΑ. Μέσα σε ένα απόγευμα δεσμεύει
  // σχεδόν πάντα αυτό και όχι το μηνιαίο (βλ. `remainingLine` στο aiLimits).
  { label: `Ερωτήσεις ${ASSISTANT_TO} την ημέρα`,
    values: { ...Object.fromEntries(COMPARED.map(p => [p, fn(aiLimitsFor(p).perDay)])) as Record<ComparedPlan, CellValue>,
      solo: both('Όχι', fn(aiLimitsFor('solo').perDay)) } },
  // Η ΣΑΡΩΣΗ ΜΕΤΡΑΕΙ ΧΩΡΙΣΤΑ (SCAN_LIMITS): πέντε τον μήνα στο δωρεάν, χωρίς
  // όριο σε όλα τα πληρωμένα.
  { label: 'Σάρωση εγγράφων τον μήνα',
    values: { ...Object.fromEntries(COMPARED.map(p => [p, 'Χωρίς όριο'])) as Record<ComparedPlan, CellValue>,
      solo: both(fn(SCAN_LIMITS.free ?? 0), 'χωρίς όριο') } },
  // Η ΦΩΝΗ ΖΕΙ ΜΕΣΑ ΣΤΗ ΝΟΑ (PropertyAssistant): στο δωρεάν πακέτο δεν υπάρχει.
  withSolo(forAll('Φωνητική καταχώρηση'), both('Όχι', 'Ναι')),
  // Η ΧΡΟΝΙΑ ΕΙΝΑΙ ΤΗΣ ΚΛΙΜΑΚΑΣ, ΟΧΙ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ. Ηταν «φόρος 2026» με το
  // χέρι και την 1η Ιανουαρίου 2027 θα διαβαζόταν σαν πέρσινο εργαλείο. Η
  // κλίμακα του ν.5246/2025 ισχύει από το `FIRST_YEAR_NEW_BRACKETS` και η
  // σελίδα είναι στατική: μια «τρέχουσα χρονιά» εδώ θα πάγωνε στο χτίσιμο.
  forAll(`Αποδόσεις, δαπάνες, ενέργεια και φόρος με την κλίμακα ${FIRST_YEAR_NEW_BRACKETS}`),
  forAll('Ειδοποιήσεις και υπενθυμίσεις'),
  gated('e2_export'),
  gated('rent_collection'),
  // Χωρίς `multi_property`: το «Περισσότερα ακίνητα» ξανάλεγε τη γραμμή
  // «Ακίνητα» τρεις σειρές πιο πάνω, με τικ αντί για αριθμό.
  gated('comparison'),
  gated('accounting_journal'),
  gated('bank_import'),
  gated('early_access'),
  gated('clients'),
  gated('portfolio'),
  gated('report_branding'),
  gated('investment_analysis'),
  fromPlanLine('Ομάδα με ρόλους', TEAM_LINE),
  fromPlanLine(PRIORITY_SUPPORT_LINE, PRIORITY_SUPPORT_LINE),
];

// ΣΤΟ ΤΗΛΕΦΩΝΟ ΤΑ ΚΟΙΝΑ ΛΕΓΟΝΤΑΙ ΜΙΑ ΦΟΡΑ. Τέσσερις κάρτες με όλες τις
// γραμμές η καθεμιά έβγαζαν σελίδα 4.400 εικονοστοιχείων, με τις μισές γραμμές
// να επαναλαμβάνουν το ίδιο τικ τέσσερις φορές. Οι γραμμές που ισχύουν για όλα
// τα πακέτα πάνε σε μία κάρτα «Κοινά σε όλα» και κάθε πακέτο δείχνει μόνο όσα
// το ξεχωρίζουν. Παράγεται από τα ίδια δεδομένα: αν μια γραμμή πάψει να είναι
// κοινή, μετακομίζει μόνη της.
const COMMON = MATRIX.filter(row => COMPARED.every(p => row.values[p] === true));
const DISTINCT = MATRIX.filter(row => !COMMON.includes(row));

// ── ΤΑ ΟΡΙΑ ΕΙΝΑΙ ΙΔΙΕΣ ΓΡΑΜΜΕΣ ΣΕ ΚΑΘΕ ΚΑΡΤΑ, ΣΤΗΝ ΙΔΙΑ ΣΕΙΡΑ ─────────────────
// Όσες γραμμές έχουν αριθμό ή κείμενο σε κάποιο πακέτο (τιμή, ακίνητα,
// ερωτήσεις, σάρωση, φωνή) εμφανίζονται σε ΟΛΕΣ τις κάρτες. Ετσι στην ταμπλέτα
// δύο γειτονικές κάρτες μοιράζονται τις ίδιες σειρές (subgrid στο globals.css)
// και η «Τιμή τον χρόνο» του ενός στέκεται δίπλα στην «Τιμή τον χρόνο» του
// άλλου. Οι γραμμές ναι/όχι μένουν μόνο όπου ισχύουν.
const LIMITS = DISTINCT.filter(row => COMPARED.some(p => typeof row.values[p] === 'string'));
const FEATURES = DISTINCT.filter(row => !LIMITS.includes(row));

/**
 * «5 · χωρίς όριο με Νόα» σε δύο γραμμές: το δωρεάν πάνω, η Νόα από κάτω σε
 * δεύτερο τόνο. Σε μία γραμμή η τιμή έτρωγε το πλάτος και η ετικέτα δίπλα της
 * έσπαγε σε τρεις σειρές («Σάρωση / εγγράφων τον / μήνα»).
 *
 * ΤΟ «ΟΧΙ» ΔΕΝ ΕΙΝΑΙ ΤΙΜΗ. Στο «Όχι · ναι με Νόα» το πρώτο μέρος έβγαινε λευκό
 * και έντονο, όπως το «Έως 3» από πάνω του, δηλαδή διαβαζόταν ως κάτι που
 * περιλαμβάνεται. Παίρνει τον τόνο κάθε άλλου «Όχι» του πίνακα. Το ίδιο
 * στοιχείο τρέφει κάρτα και πίνακα, ώστε οι δύο όψεις να λένε το ίδιο.
 */
function CellText({ v }: { v: string }) {
  const [main, ...rest] = v.split(' · ');
  const head = main === 'Όχι' ? <span className="plan-card-no">{main}</span> : main;
  return rest.length
    ? <span className="plan-card-num">{head}<span className="plan-card-alt">{rest.join(' · ')}</span></span>
    : <span className="plan-card-num">{head}</span>;
}

/** «Εξαγωγή Ε2» μέσα σε πρόταση: πεζό μόνο το πρώτο γράμμα, τα αρκτικόλεξα μένουν. */
const inSentence = (label: string) => label.charAt(0).toLocaleLowerCase('el-GR') + label.slice(1);

/**
 * Η ενέργεια κάθε στήλης: εγγραφή με το πακέτο ήδη επιλεγμένο, όπως στην αρχική.
 *
 * ΕΝΑ ΓΕΜΑΤΟ ΚΟΥΜΠΙ, ΟΧΙ ΤΕΣΣΕΡΑ. Με τέσσερα ίδια κύρια κουμπιά ο πίνακας δεν
 * πρότεινε τίποτα, ενώ η αρχική προτείνει ρητά ένα πακέτο. Το προτεινόμενο
 * κρατά το γεμάτο, τα υπόλοιπα γίνονται δευτερεύοντα.
 *
 * ΙΔΙΟ ΛΕΚΤΙΚΟ ΣΕ ΚΑΘΕ ΠΛΑΤΟΣ (01.10.2026). Ο πίνακας έγραφε σκέτο «Ξεκίνα»
 * και οι κάρτες «Ξεκίνα δωρεάν» ή «Ξεκίνα τη δοκιμή»: ο ίδιος επισκέπτης που
 * γύριζε το τηλέφωνο έβλεπε άλλο κουμπί για το ίδιο πάτημα. Τώρα και οι δύο
 * όψεις λένε ό,τι λέει και η αρχική. Ο αναγνώστης οθόνης ακούει και το πακέτο,
 * ώστε τα τέσσερα να μην ακούγονται ίδια.
 */
// Ο «Ιδιοκτήτης» ξεκινά ΔΩΡΕΑΝ, χωρίς πακέτο στη διεύθυνση: η εγγραφή δίνει τη
// δοκιμή και μετά συνεχίζει στο δωρεάν. Όποιος θέλει τη Νόα τη διαλέγει μετά.
const TrialCta = ({ id, recommended }: { id: ComparedPlan; recommended?: PlanId }) => (
  id === 'solo'
    ? <Btn variant="secondary" field href="/signup">
        {signupCta('free')}<span className="sr-only"> με το πακέτο «{PLANS.free.name}»</span>
      </Btn>
    : <Btn variant={id === recommended ? 'primary' : 'secondary'} field href={`/signup?plan=${id}&cycle=monthly`}>
        {/* Το λεκτικό ανά πακέτο το λέει ο κανόνας του trialOffer.ts· κανένα
            δεν υπόσχεται πια δωρεάν πακέτο με τιμή. */}
        {signupCta(id)}<span className="sr-only">{` με το πακέτο «${PLANS[id].name}»`}</span>
      </Btn>
);

/** Η ετικέτα της προτεινόμενης στήλης, ίδια με την κορδέλα της αρχικής. */
const RecommendedChip = () => <span className="plan-rec">Προτεινόμενο</span>;

/**
 * Η ΤΙΜΗ ΕΙΝΑΙ ΤΟ ΠΡΩΤΟ ΠΟΥ ΔΙΑΒΑΖΕΤΑΙ ΣΕ ΚΑΘΕ ΠΑΚΕΤΟ.
 *
 * Μεγάλος αριθμός με ψηφία ίσου πλάτους, ώστε τα τέσσερα ποσά να στοιχίζονται
 * στο μάτι, «/μήνα» δίπλα του σε δεύτερο τόνο και από κάτω η εναλλακτική: η
 * ετήσια για τα πληρωμένα, η Νόα για το δωρεάν. Ιδια κάρτα και ίδια στήλη.
 */
function PlanPrice({ id }: { id: ComparedPlan }) {
  const free = id === 'solo';
  return (
    <div className="plan-price">
      <span className="plan-price-num">{fe(free ? PLANS.free.priceMonthly : PLANS[id].priceMonthly)}</span>
      <span className="plan-price-per">/μήνα</span>
      <span className="plan-price-alt">
        {/* ΤΟ ΙΔΙΟ ΖΕΥΓΑΡΙ ΜΕ ΤΗΝ ΑΡΧΙΚΗ. Η αρχική έγραφε για τη Νόα 4,99€ τον
            μήνα ή 54,90€ τον χρόνο· εδώ φαινόταν μόνο το μηνιαίο.
            ΚΑΙ ΟΙ ΔΥΟ ΓΡΑΜΜΕΣ ΛΕΝΕ «ΜΕ ΝΟΑ». Η δεύτερη έγραφε σκέτο «τον χρόνο»
            κάτω από το μηδενικό του δωρεάν, οπότε η ετήσια διαβαζόταν σαν τιμή
            του δωρεάν πακέτου. */}
        {free
          ? <>{`ή ${fe(PLANS.solo.priceMonthly)}/μήνα ${WITH_NOA}`}<br />{`ή ${fe(PLANS.solo.priceAnnual)} τον χρόνο ${WITH_NOA}`}</>
          : `ή ${fe(PLANS[id].priceAnnual)} τον χρόνο`}
      </span>
    </div>
  );
}

function Tick() {
  return (
    <svg className="plan-tick" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2.4}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Ο πίνακας μόνος του, χωρίς κάρτα και χωρίς επικεφαλίδα: τα βάζει ο καλών.
 *
 * Το `highlight` δίνει έμφαση στη στήλη του τρέχοντος πακέτου, όταν υπάρχει
 * τρέχον πακέτο. Το `recommended` σημαδεύει το πακέτο που προτείνουμε σε όποιον
 * δεν έχει διαλέξει, με την ίδια ετικέτα που έχει η αρχική.
 *
 * Το `headingLevel` είναι το επίπεδο των τίτλων στις κάρτες του κινητού. Στο
 * /paketa κάθονται αμέσως κάτω από τον <h1>, οπότε είναι <h2>· ένα <h3> εκεί
 * πηδούσε επίπεδο και ο αναγνώστης οθόνης έχανε τη δομή της σελίδας.
 */
export function PlanMatrix({ highlight, recommended, headingLevel = 3 }: { highlight?: PlanId; recommended?: PlanId; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <>
    {/* ═══ ΣΕ ΤΗΛΕΦΩΝΟ: ΚΑΡΤΕΣ ΑΝΑ ΠΑΚΕΤΟ, ΟΧΙ ΠΙΝΑΚΑΣ ΠΟΥ ΚΥΛΑ ════════════════
        ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ. Πέντε στήλες ελληνικών ονομάτων ΔΕΝ χωρούν σε 390:
        ο πίνακας κυλούσε οριζόντια και φαινόταν σχεδόν μόνο η πρώτη στήλη
        («Ιδιοκτήτης»). Σε σελίδα τιμών, μια στήλη που δεν φαίνεται είναι πακέτο
        που δεν πουλιέται. Κάτω από 1024 κάθε πακέτο γίνεται μια κάρτα με όσα
        περιλαμβάνει, στοιβαγμένα κάθετα — τίποτα δεν κρύβεται, τίποτα δεν
        κυλά. Από εκεί και πάνω μένει ο πίνακας, που συγκρίνει καλύτερα δίπλα
        δίπλα. Ίδια δεδομένα (MATRIX/COMPARED) και στις δύο όψεις: δεν μπορούν
        να αποκλίνουν. Καθεμιά είναι ορατή στον αναγνώστη οθόνης μόνο στο πλάτος
        της (η άλλη είναι `display:none`, άρα εκτός δέντρου προσβασιμότητας). */}
    <div className="plan-cmp-cards">
      <section className="plan-card plan-card-common" aria-label="Κοινά σε όλα τα πακέτα">
        <H className="plan-card-name">Κοινά σε όλα τα πακέτα</H>
        <dl className="plan-card-list">
          {COMMON.map(row => (
            <div key={row.label} className="plan-card-row">
              <dt>{row.label}</dt>
              <dd><Tick /><span className="sr-only">Ναι</span></dd>
            </div>
          ))}
        </dl>
      </section>
      {/* ΚΑΘΕ ΚΑΡΤΑ ΛΕΕΙ ΤΙ ΕΧΕΙ ΚΑΙ ΜΙΑ ΓΡΑΜΜΗ ΤΙ ΔΕΝ ΕΧΕΙ. Η κάρτα του
          φθηνότερου πακέτου ήταν εννέα «Όχι» στη σειρά: σε σελίδα τιμών αυτό
          παρουσιάζει το πακέτο ως λίστα ελλείψεων και διπλασιάζει την κύλιση.
          Οι ίδιες γραμμές μαζεύονται στο τέλος σε μία πρόταση. */}
      {/* ΤΙΤΛΟΣ, ΤΙΜΗ, ΚΟΥΜΠΙ, ΟΡΙΑ ΚΑΙ ΜΕΤΑ Ο,ΤΙ ΔΙΑΦΕΡΕΙ (01.10.2026). Οι ζώνες
          που υπάρχουν σε ΚΑΘΕ κάρτα (τίτλος, τιμή, κουμπί, γραμμές ορίων)
          μοιράζονται σειρές με τη γειτονική κάρτα στην ταμπλέτα. Οι δυνατότητες
          και το «δεν περιλαμβάνει» διαφέρουν σε μήκος από πακέτο σε πακέτο:
          ως δικές τους κοινές σειρές άνοιγαν τρύπες 50 ως 100 εικονοστοιχείων
          ΜΕΣΑ στην κοντύτερη κάρτα, ανάμεσα σε περιεχόμενο. Τώρα ρέουν μαζί σε
          μία τελευταία ζώνη και ό,τι περισσεύει μένει κάτω, εκεί που τελειώνει
          η κάρτα. Το κουμπί ανέβηκε κάτω από την τιμή, όπου παίρνεται η απόφαση. */}
      {COMPARED.map(id => {
        const lacks = DISTINCT.filter(row => row.values[id] === false).map(row => inSentence(row.label));
        const has = FEATURES.filter(row => row.values[id] === true);
        const rec = id === recommended;
        return (
          <section key={id} className={rec ? 'plan-card plan-card-plan is-rec' : 'plan-card plan-card-plan'} aria-label={columnLabel(id)}
            style={{ ['--plan-limits' as string]: LIMITS.length }}>
            <div className="plan-card-head">
              <H className="plan-card-name" style={{ color: id === highlight ? 'var(--accent)' : undefined }}>{columnName(id)}</H>
              {rec && <RecommendedChip />}
            </div>
            <PlanPrice id={id} />
            <div className="plan-card-cta"><TrialCta id={id} recommended={recommended} /></div>
            <dl className="plan-card-list plan-card-limits">
              {LIMITS.map(row => {
                const v = row.values[id];
                return (
                  <div key={row.label} className="plan-card-row">
                    <dt>{row.label}</dt>
                    <dd>
                      {typeof v === 'string'
                        ? <CellText v={v} />
                        : v
                          ? <><Tick /><span className="sr-only">Ναι</span></>
                          : <span className="plan-card-no">Όχι</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <div className="plan-card-rest">
              {has.length > 0 && (
                <dl className="plan-card-list plan-card-feats">
                  {has.map(row => (
                    <div key={row.label} className="plan-card-row">
                      <dt>{row.label}</dt>
                      <dd><Tick /><span className="sr-only">Ναι</span></dd>
                    </div>
                  ))}
                </dl>
              )}
              {lacks.length > 0 && <p className="plan-card-lacks" data-nohy="">Δεν περιλαμβάνει: {lacks.join(', ')}.</p>}
            </div>
          </section>
        );
      })}
    </div>

    <div className="plan-cmp-table">
    {/* ═══ ΠΙΝΑΚΑΣ, ΟΧΙ ΠΛΕΓΜΑ ΑΠΟ divs ══════════════════════════════════════
       ΤΙ ΗΤΑΝ. Δεκαεπτά γραμμές επί πέντε στήλες, χτισμένες με `display: grid`
       και `<div>`: εξήντα οκτώ κελιά που ΜΟΙΑΖΑΝ πίνακας χωρίς να είναι. Τα
       τέσσερα πινακάκια των δωρεάν εργαλείων πέρασαν στο `.po-table` και το
       διάβασαν σωστά· αυτό εδώ γράφτηκε αλλού και έμεινε πίσω.

       ΤΙ ΚΕΡΔΙΖΕΙ ΚΑΙ ΔΕΝ ΦΑΙΝΕΤΑΙ. Ενα πλέγμα από divs ΔΕΝ έχει γραμμές και
       στήλες για τον αναγνώστη οθόνης: ακούγεται σαν εξήντα οκτώ ασύνδετα
       κείμενα, χωρίς «Λογιστικό ημερολόγιο, Ιδιοκτήτης: όχι». Με `<th
       scope="row">` και `<th scope="col">` κάθε κελί ανακοινώνεται με τους δύο
       τίτλους του — δηλαδή ο πίνακας τιμών γίνεται διαβάσιμος από κάποιον που
       δεν τον βλέπει, στην οθόνη που ζητά την κάρτα του.

       ΚΑΙ ΤΙ ΦΑΙΝΕΤΑΙ: το `.po-table` φέρνει τις ίδιες τρίχες διαχωρισμού, την
       ίδια κεφαλίδα σε κεφαλαία και τα ίδια γεμίσματα με κάθε άλλο πίνακα του
       προϊόντος. Πριν, οι αποστάσεις ήταν γραμμένες στο χέρι («13px 12px 13px
       2px») και δεν συμφωνούσαν με καμία άλλη.

       ΤΟ `caption` ΕΙΝΑΙ Η ΤΑΙΝΙΑ ΤΙΤΛΟΥ ΤΟΥ ΚΟΥΤΙΟΥ, όχι διακόσμηση: δίνει
       στον πίνακα όνομα και για το μάτι και για τη βοηθητική τεχνολογία.

       Η `po-scroll-x` μένει: χωρίς αυτήν η σάρωση που φτάνει στο τέρμα του
       πίνακα συνεχίζει ως χειρονομία «πίσω» του iOS Safari και ο επισκέπτης
       που σέρνει τη σύγκριση βγαίνει από τη σελίδα. */}
    <div className="po-table-box">
      <div className="po-scroll-x plan-matrix">
        {/* ΤΟ ΕΛΑΧΙΣΤΟ ΠΛΑΤΟΣ ΒΓΑΙΝΕΙ ΑΠΟ ΜΕΤΡΗΣΗ, ΟΧΙ ΑΠΟ ΕΚΤΙΜΗΣΗ. Ηταν 560 και
            στα 390 η κεφαλίδα έσπαγε ΜΕΣΑ ΣΤΗ ΛΕΞΗ: «ΙΔΙΟΚΤΗΤ / ΗΣ». Μετρημένο
            στον περιηγητή, το μακρύτερο λεκτικό —«Επαγγελματίας+»— θέλει 135
            εικονοστοιχεία κειμένου· με το γέμισμα της στήλης, 155. Τέσσερις
            στήλες θέλουν 620 και η στήλη των ονομάτων 224 για να χωρά σε δύο
            γραμμές η «Σάρωση εγγράφων και φωνητική καταχώρηση». Σύνολο 844.

            ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΡΟΒΛΗΜΑ ΠΟΥ ΔΕΝ ΧΩΡΑΕΙ ΣΕ ΤΗΛΕΦΩΝΟ. Πέντε στήλες με
            ελληνικά ονόματα πακέτων ΔΕΝ χωρούν σε 390 και καμία ρύθμιση δεν τις
            χωράει· ό,τι «χωράει» είναι σπασμένες λέξεις. Ο πίνακας κυλά — η
            πρώτη στήλη μένει καρφωμένη ώστε ο επισκέπτης να ξέρει πάντα ποια
            γραμμή διαβάζει. */}
        <table className="po-table tbl-fixed" style={{ ['--tbl-min' as string]: '860px' }}>
          {/* Η ΛΕΖΑΝΤΑ ΔΕΝ ΕΠΑΝΑΛΑΜΒΑΝΕΙ ΤΟΝ ΤΙΤΛΟ. Στη σελίδα /paketa ο <h1>
              λέει ήδη «Τι περιλαμβάνει κάθε πακέτο»· η ίδια φράση ως ορατή
              λεζάντα ακριβώς από κάτω διαβαζόταν ως λάθος αντιγραφής. Εδώ η
              λεζάντα λέει ΤΙ ΕΙΝΑΙ ο πίνακας — σύγκριση ανά δυνατότητα — και
              κρατά την προσβάσιμη ονομασία του χωρίς διπλό τίτλο. */}
          <caption>Σύγκριση πακέτων ανά δυνατότητα</caption>
          <colgroup>
            <col style={{ width: '22%' }} />
            {COMPARED.map(id => <col key={id} style={{ width: `${78 / COMPARED.length}%` }} />)}
          </colgroup>
          <thead>
            <tr>
              {/* Το κενό κελί της γωνίας: υπάρχει για τη δομή, δεν λέει τίποτα. */}
              <th scope="col"><span className="sr-only">Δυνατότητα</span></th>
              {/* Η ΚΕΦΑΛΗ ΤΗΣ ΣΤΗΛΗΣ ΕΙΝΑΙ ΤΟ ΠΑΚΕΤΟ, ΟΧΙ ΛΕΖΑΝΤΑ (01.10.2026). Ηταν
                  κεφαλαία των 11px σε τρίτο τόνο: το όνομα του πακέτου ζύγιζε
                  λιγότερο από κάθε «Όχι» από κάτω του. Τώρα όνομα στο μέγεθος
                  τίτλου, τιμή και ετήσια. Η θέση της ετικέτας «Προτεινόμενο»
                  υπάρχει σε κάθε στήλη ώστε τα τέσσερα ονόματα να στέκονται στην
                  ίδια ευθεία. Η κεφαλή μένει καρφωμένη όσο κυλούν οι γραμμές. */}
              {COMPARED.map(id => (
                <th key={id} scope="col" className={id === recommended ? 'plan-th is-rec' : 'plan-th'}>
                  <span className="plan-th-flag">{id === recommended && <RecommendedChip />}</span>
                  <span className="plan-th-name" style={{ color: id === highlight ? 'var(--accent)' : undefined }}>{columnName(id)}</span>
                  <PlanPrice id={id} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map(row => (
              <tr key={row.label}>
                <th scope="row" style={{ color: 'var(--text-secondary)' }}>{row.label}</th>
                {COMPARED.map(id => {
                  const v = row.values[id];
                  return (
                    <td key={id} className={id === recommended ? 'is-rec' : undefined} style={{ textAlign: 'center' }}>
                      {typeof v === 'string'
                        ? <CellText v={v} />
                        : v === true
                          ? <><Tick /><span className="sr-only">Ναι</span></>
                          : <span className="plan-card-no">Όχι</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="plan-cta-row">
              <th scope="row"><span className="sr-only">Εγγραφή</span></th>
              {COMPARED.map(id => (
                <td key={id} className={id === recommended ? 'is-rec' : undefined} style={{ textAlign: 'center' }}><TrialCta id={id} recommended={recommended} /></td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </div>
    </>
  );
}
