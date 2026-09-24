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

import { PLANS, type PlanId } from '@/lib/billing/plans';
import { aiLimitsFor } from '@/lib/billing/aiLimits';
import { ASSISTANT_NAME } from '@/lib/assistant/identity';
import { FEATURE_LABEL, FEATURE_MIN_PLAN, planAtLeast, type Feature } from '@/lib/billing/entitlements';
import { T, fn } from '@/components/tokens';
import { fe } from '@/lib/core/format';
import { Btn } from '@/components/Theme';

export type ComparedPlan = Extract<PlanId, 'solo' | 'owner' | 'agency' | 'office'>;
export const COMPARED: ComparedPlan[] = ['solo', 'owner', 'agency', 'office'];

type CellValue = boolean | string;
interface FeatureRow { label: string; values: Record<ComparedPlan, CellValue> }

/** Το όριο ακινήτων γράφεται ΠΑΝΤΑ από τα PLANS, ποτέ με το χέρι. */
const limitLabel = (id: ComparedPlan): string => {
  const n = PLANS[id].maxProperties;
  if (!Number.isFinite(n)) return 'Απεριόριστα';
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

// ΟΙ ΤΙΜΕΣ ΜΠΗΚΑΝ ΣΤΟΝ ΠΙΝΑΚΑ, ΑΠΟ ΤΗΝ ΙΔΙΑ ΠΗΓΗ. Η σελίδα /paketa απαντούσε
// «τι παίρνω» χωρίς να λέει «πόσο»: ο επισκέπτης γύριζε στην αρχική για την
// τιμή. Διαβάζονται από τα PLANS, όπως και οι κάρτες της αρχικής, οπότε δύο
// σελίδες με τιμές δεν μπορούν να διαφωνήσουν.
const priceRow = (label: string, of: (id: ComparedPlan) => number): FeatureRow => ({
  label, values: Object.fromEntries(COMPARED.map(p => [p, fe(of(p))])) as Record<ComparedPlan, CellValue>,
});

export const MATRIX: FeatureRow[] = [
  priceRow('Τιμή τον μήνα', id => PLANS[id].priceMonthly),
  priceRow('Τιμή τον χρόνο', id => PLANS[id].priceAnnual),
  { label: 'Ακίνητα', values: Object.fromEntries(COMPARED.map(p => [p, limitLabel(p)])) as Record<ComparedPlan, CellValue> },
  { label: `Ερωτήσεις στη ${ASSISTANT_NAME} τον μήνα`,
    values: Object.fromEntries(COMPARED.map(p => [p, fn(aiLimitsFor(p).perMonth)])) as Record<ComparedPlan, CellValue> },
  forAll('Σάρωση εγγράφων και φωνητική καταχώρηση'),
  forAll('Αποδόσεις, δαπάνες, ενέργεια και φόρος 2026'),
  forAll('Ειδοποιήσεις και υπενθυμίσεις'),
  gated('e2_export'),
  gated('rent_collection'),
  gated('multi_property'),
  gated('comparison'),
  gated('accounting_journal'),
  gated('bank_import'),
  gated('early_access'),
  gated('clients'),
  gated('portfolio'),
  gated('report_branding'),
  gated('investment_analysis'),
];

// ΣΤΟ ΤΗΛΕΦΩΝΟ ΤΑ ΚΟΙΝΑ ΛΕΓΟΝΤΑΙ ΜΙΑ ΦΟΡΑ. Τέσσερις κάρτες με όλες τις
// γραμμές η καθεμιά έβγαζαν σελίδα 4.400 εικονοστοιχείων, με τις μισές γραμμές
// να επαναλαμβάνουν το ίδιο τικ τέσσερις φορές. Οι γραμμές που ισχύουν για όλα
// τα πακέτα πάνε σε μία κάρτα «Κοινά σε όλα» και κάθε πακέτο δείχνει μόνο όσα
// το ξεχωρίζουν. Παράγεται από τα ίδια δεδομένα: αν μια γραμμή πάψει να είναι
// κοινή, μετακομίζει μόνη της.
const COMMON = MATRIX.filter(row => COMPARED.every(p => row.values[p] === true));
const DISTINCT = MATRIX.filter(row => !COMMON.includes(row));

/** Η ενέργεια κάθε στήλης: εγγραφή με το πακέτο ήδη επιλεγμένο, όπως στην αρχική. */
const TrialCta = ({ id }: { id: ComparedPlan }) => (
  <Btn variant="primary" href={`/signup?plan=${id}&cycle=monthly`}>Ξεκίνα τη δοκιμή</Btn>
);

function Tick() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2.4}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Ο πίνακας μόνος του, χωρίς κάρτα και χωρίς επικεφαλίδα: τα βάζει ο καλών.
 *
 * Το `highlight` δίνει έμφαση στη στήλη του τρέχοντος πακέτου, όταν υπάρχει
 * τρέχον πακέτο. Στη δημόσια σελίδα δεν υπάρχει, οπότε καμία στήλη δεν
 * ξεχωρίζει: ο επισκέπτης δεν έχει ακόμη λόγο να προτιμήσει μία.
 */
export function PlanMatrix({ highlight }: { highlight?: PlanId }) {
  return (
    <>
    {/* ═══ ΣΕ ΤΗΛΕΦΩΝΟ: ΚΑΡΤΕΣ ΑΝΑ ΠΑΚΕΤΟ, ΟΧΙ ΠΙΝΑΚΑΣ ΠΟΥ ΚΥΛΑ ════════════════
        ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ. Πέντε στήλες ελληνικών ονομάτων ΔΕΝ χωρούν σε 390:
        ο πίνακας κυλούσε οριζόντια και φαινόταν σχεδόν μόνο η πρώτη στήλη
        («Ιδιοκτήτης»). Σε σελίδα τιμών, μια στήλη που δεν φαίνεται είναι πακέτο
        που δεν πουλιέται. Κάτω από 768 κάθε πακέτο γίνεται μια κάρτα με ΟΛΕΣ τις
        δυνατότητές του, στοιβαγμένες κάθετα — τίποτα δεν κρύβεται, τίποτα δεν
        κυλά. Από tablet και πάνω μένει ο πίνακας, που συγκρίνει καλύτερα δίπλα
        δίπλα. Ίδια δεδομένα (MATRIX/COMPARED) και στις δύο όψεις: δεν μπορούν
        να αποκλίνουν. Καθεμιά είναι ορατή στον αναγνώστη οθόνης μόνο στο πλάτος
        της (η άλλη είναι `display:none`, άρα εκτός δέντρου προσβασιμότητας). */}
    <div className="plan-cmp-cards">
      <section className="plan-card" aria-label="Κοινά σε όλα τα πακέτα">
        <h3 className="plan-card-name">Κοινά σε όλα τα πακέτα</h3>
        <dl className="plan-card-list">
          {COMMON.map(row => (
            <div key={row.label} className="plan-card-row">
              <dt>{row.label}</dt>
              <dd><Tick /><span className="sr-only">Ναι</span></dd>
            </div>
          ))}
        </dl>
      </section>
      {COMPARED.map(id => (
        <section key={id} className="plan-card" aria-label={PLANS[id].name}>
          <h3 className="plan-card-name" style={{ color: id === highlight ? 'var(--accent)' : undefined }}>{PLANS[id].name}</h3>
          <dl className="plan-card-list">
            {DISTINCT.map(row => {
              const v = row.values[id];
              return (
                <div key={row.label} className="plan-card-row">
                  <dt>{row.label}</dt>
                  <dd>
                    {typeof v === 'string'
                      ? <span className="plan-card-num">{v}</span>
                      : v === true
                        ? <><Tick /><span className="sr-only">Ναι</span></>
                        : <span className="plan-card-no">Όχι</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
          <div style={{ display: 'grid', padding: '8px 0' }}><TrialCta id={id} /></div>
        </section>
      ))}
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
            <col style={{ width: '26%' }} />
            {COMPARED.map(id => <col key={id} style={{ width: `${74 / COMPARED.length}%` }} />)}
          </colgroup>
          <thead>
            <tr>
              {/* Το κενό κελί της γωνίας: υπάρχει για τη δομή, δεν λέει τίποτα. */}
              <th scope="col"><span className="sr-only">Δυνατότητα</span></th>
              {COMPARED.map(id => (
                <th key={id} scope="col" style={{ textAlign: 'center', color: id === highlight ? 'var(--accent)' : undefined }}>
                  {PLANS[id].name}
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
                    <td key={id} style={{ textAlign: 'center' }}>
                      {typeof v === 'string'
                        ? <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                        : v === true
                          ? <><Tick /><span className="sr-only">Ναι</span></>
                          : <span style={{ color: 'var(--text-tertiary)' }}>Όχι</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row"><span className="sr-only">Εγγραφή</span></th>
              {COMPARED.map(id => (
                <td key={id} style={{ textAlign: 'center' }}><TrialCta id={id} /></td>
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
