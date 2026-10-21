// ═══════════════════════════════════════════════════════════════════════════
// ΜΕΤΡΗΣΗ ΠΡΟΪΟΝΤΟΣ: ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΓΕΓΟΝΟΤΩΝ, ΣΕ ΕΝΑ ΣΗΜΕΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΣΤΑΘΕΡΟΣ ΤΥΠΟΣ ΚΑΙ ΟΧΙ ΣΚΕΤΟ `string`. Ενα τυπογραφικό λάθος σε κλήση
// («proprty_added») θα δημιουργούσε σιωπηλά ΝΕΟ γεγονός: η βάση θα το δεχόταν,
// κανένα σφάλμα δεν θα εμφανιζόταν πουθενά και η καμπύλη ενεργοποίησης θα
// έλεγε ψέματα προς τα κάτω για μήνες. Ο μεταγλωττιστής το πιάνει τώρα.
//
// ΤΑ ΓΕΓΟΝΟΤΑ ΑΠΑΝΤΟΥΝ ΜΙΑ ΕΡΩΤΗΣΗ: ΠΟΣΟΙ ΦΤΑΝΟΥΝ ΣΤΗΝ ΑΞΙΑ. Δεν είναι
// ημερολόγιο κάθε πατήματος. Καθένα από τα εννέα σκαλιά της αξίας είναι ένα
// σκαλί που, αν το ανέβει κάποιος, έχει πάρει κάτι πραγματικό από το προϊόν.
// Οτιδήποτε δεν είναι σκαλί δεν μπαίνει εδώ: ένα ταμπλό γεμάτο θόρυβο δεν
// διαβάζεται.
//
// ΚΑΙ ΤΕΣΣΕΡΑ ΣΚΑΛΙΑ ΤΗΣ ΥΠΟΔΟΧΗΣ (19/10/2026). Ανάμεσα στο `signed_up` και στο
// `property_added` δεν καταγραφόταν τίποτα: τέσσερις κάρτες καλωσορίσματος και
// ένας οδηγός πέντε βημάτων. Οι νέοι χρήστες χωρίς ακίνητο είχαν όλοι
// `welcomed=true` και κανείς δεν ήξερε αν έφυγαν με «Αργότερα» στην πρώτη
// κάρτα ή κλείνοντας τον οδηγό στο δεύτερο βήμα. Μια εβδομάδα με μηδέν
// ενεργοποίηση έλεγε μόνο «μηδέν». Τα τέσσερα λένε πού σταμάτησαν, με
// αριθμό κάρτας ή βήματος και μια σταθερή λέξη για την αφετηρία
// (`onboardingProps`).
//
// ΚΑΙ ΤΙ ΔΕΝ ΚΑΤΑΓΡΑΦΕΤΑΙ ΠΟΤΕ. Κανένα ποσό, κανένα όνομα, καμία διεύθυνση,
// κανένα ΑΦΜ, κανένα αναγνωριστικό ακινήτου. Το `props` κρατά ΜΟΝΟ αριθμούς
// και σταθερές λέξεις (πακέτο, πλήθος, πηγή). Ο κανόνας δεν είναι ευγένεια:
// ό,τι δεν αποθηκεύεται δεν διαρρέει και δεν ζητείται πίσω.
// ═══════════════════════════════════════════════════════════════════════════

import type { createClient } from '@/lib/supabase/client';
import { captureError } from '@/lib/observability/report';
type SupaClient = ReturnType<typeof createClient>;

/**
 * Τα σκαλιά, με τη σειρά που τα ανεβαίνει κανείς.
 *
 * Το ίδιο κείμενο περνά τον έλεγχο ονόματος της `log_event` στη βάση
 * (πεζά, αριθμοί, κάτω παύλα, τρεις ως σαράντα οκτώ χαρακτήρες).
 */
export const PRODUCT_EVENTS = {
  /** Πάτησε το κουμπί εγγραφής. Η κορυφή του χωνιού μέσα στην εφαρμογή. */
  signed_up: 'signed_up',
  /** Έκλεισε την υποδοχή με «Αργότερα»· `card` η κάρτα (1 έως 4). */
  welcome_later: 'welcome_later',
  /** Άνοιξε ο οδηγός νέου ακινήτου· `from` από πού (`WIZARD_FROM`). */
  wizard_opened: 'wizard_opened',
  /** Έκλεισε ο οδηγός χωρίς αποθήκευση· `step` το βήμα (1 έως 4· ως τις 20/10/2026 ήταν πέντε, με τις «Επαφές» στο 4). */
  wizard_closed: 'wizard_closed',
  /** Άνοιξε η σάρωση εγγράφου. */
  scan_opened: 'scan_opened',
  /** Δημιουργήθηκε το πρώτο ακίνητο. Εδώ αρχίζει η αξία. */
  property_added: 'property_added',
  /** Δεύτερο ακίνητο. Το πιο δυνατό σημάδι ότι κάποιος έμεινε. */
  second_property_added: 'second_property_added',
  /** Πρώτη δαπάνη, με το χέρι ή από σάρωση. */
  expense_added: 'expense_added',
  /** Πρώτο ενοίκιο καταχωρημένο. */
  rent_recorded: 'rent_recorded',
  /**
   * Είδε τους επόμενους 12 μήνες (lib/home/forecast12.ts) στην Επισκόπηση. Μία
   * φορά ανά ακίνητο και άνοιγμα της οθόνης, όταν η κάρτα μπει στο οπτικό
   * πεδίο. Ρωτά αν η πρόβλεψη ξαναφέρνει τον χρήστη: πόσοι την ανοίγουν δύο
   * φορές σε τριάντα ημέρες. Φορτίο: `forecastProps`, τίποτε άλλο.
   */
  forecast_viewed: 'forecast_viewed',
  /** Εβγαλε αναφορά, δηλαδή πήρε κάτι που δίνεται σε τρίτον. */
  report_generated: 'report_generated',
  /** Ρώτησε τη βοηθό. Δείχνει ότι εμπιστεύτηκε το προϊόν με ερώτηση. */
  assistant_asked: 'assistant_asked',
  /** Ξεκίνησε δοκιμή. */
  trial_started: 'trial_started',
  /** Πλήρωσε. Το μόνο γεγονός που μετρά στο τέλος. */
  subscription_started: 'subscription_started',
} as const;

export type ProductEvent = typeof PRODUCT_EVENTS[keyof typeof PRODUCT_EVENTS];

/** Μετρήσιμα χαρακτηριστικά. Ποτέ προσωπικά δεδομένα, ποτέ ποσά. */
export type EventProps = Record<string, string | number | boolean>;

/** Οι αφετηρίες του οδηγού: υποδοχή, άδειος πίνακας, σάρωση από την υποδοχή, κάθε άλλο σημείο. */
export const WIZARD_FROM = ['welcome', 'empty', 'scan', 'other'] as const;
export type WizardFrom = typeof WIZARD_FROM[number];

/** Τα σκαλιά της υποδοχής με τα χαρακτηριστικά τους. Τίποτα άλλο δεν περνά. */
export type OnboardingStep =
  | { event: typeof PRODUCT_EVENTS.welcome_later; card: number }
  | { event: typeof PRODUCT_EVENTS.wizard_opened; from: WizardFrom }
  | { event: typeof PRODUCT_EVENTS.wizard_closed; step: number }
  | { event: typeof PRODUCT_EVENTS.scan_opened };

/** Οι καταστάσεις της κάρτας των 12 μηνών: χωρίς τίποτα ή με γραμμές. */
export const FORECAST_STATES = ['empty', 'filled'] as const;
export type ForecastState = typeof FORECAST_STATES[number];

/** Θετικός ακέραιος ως 99· οτιδήποτε άλλο γίνεται 0. Δεν χωρά κείμενο. */
const ordinal = (n: unknown): number => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 && v < 100 ? v : 0;
};

/**
 * Τα χαρακτηριστικά ενός σκαλιού της υποδοχής: μόνο αριθμοί και λέξεις του
 * `WIZARD_FROM`. Ο τύπος το λέει ήδη· η συνάρτηση το εγγυάται και όταν ο καλών
 * περάσει κάτι άλλο με `as`, γιατί ό,τι γραφτεί στη βάση δεν ξεγράφεται.
 */
export function onboardingProps(s: OnboardingStep): EventProps {
  switch (s.event) {
    case 'welcome_later': return { card: ordinal(s.card) };
    case 'wizard_opened': return { from: (WIZARD_FROM as readonly string[]).includes(s.from) ? s.from : 'other' };
    case 'wizard_closed': return { step: ordinal(s.step) };
    default: return {};
  }
}

/**
 * Το φορτίο του `forecast_viewed`: ΜΟΝΟ πόσοι μήνες έχουν γραμμή (0 ως 12),
 * πόσα «κενό;» ή «λείπει» (0 ως 99) και μία λέξη του `FORECAST_STATES`. Κανένα
 * ποσό, κανένας μήνας με όνομα: ο πιο σφιχτός μήνας του χρήστη δεν είναι
 * μέτρηση προϊόντος, είναι δική του υπόθεση.
 */
export function forecastProps(p: { months: number; gaps: number; state: ForecastState }): EventProps {
  const months = ordinal(p.months);
  return {
    months: months <= 12 ? months : 0,
    gaps: ordinal(p.gaps),
    state: (FORECAST_STATES as readonly string[]).includes(p.state) ? p.state : 'empty',
  };
}

/** Καταγράφει ένα σκαλί της υποδοχής. Όπως η `track`: δεν πετάει, καλείται με `void`. */
export function trackOnboarding(supabase: SupaClient, s: OnboardingStep): Promise<void> {
  return track(supabase, s.event, onboardingProps(s));
}

/**
 * Καταγράφει ένα σκαλί. ΠΟΤΕ δεν πετάει και ΠΟΤΕ δεν μπλοκάρει την πράξη: η
 * μέτρηση είναι δευτερεύουσα και δεν επιτρέπεται να χαλάσει την πράξη που
 * μετρά. Ο πελάτης την καλεί με `void`. Η υπόσχεση τελειώνει όταν φύγει και η
 * αναφορά σφάλματος, ώστε ο διακομιστής που την περιμένει να μην τη χάνει.
 *
 * Σφάλμα που ΕΠΙΣΤΡΕΦΕΙ η βάση (λείπει η συνάρτηση, αφαιρέθηκε το δικαίωμα,
 * απορρίφθηκε το όνομα) αναφέρεται στο captureError, δεν πετιέται. Ως τώρα
 * χανόταν: το supabase δεν πετάει, επιστρέφει `{ error }` που κανείς δεν
 * διάβαζε. Αναφέρεται μόνο με κωδικό: η αποτυχία δικτύου έρχεται χωρίς κωδικό
 * και θα γέμιζε την αναφορά από κάθε ασταθή σύνδεση. Ποτέ το φορτίο, ποτέ το
 * μήνυμα του σφάλματος: μόνο όνομα γεγονότος και κωδικός.
 *
 * Ο χρήστης ΔΕΝ περνιέται ως παράμετρος. Τον ορίζει η βάση από το `auth.uid()`,
 * ώστε κανείς να μη γράφει γεγονότα στο όνομα άλλου.
 */
export async function track(
  supabase: SupaClient, event: ProductEvent, props: EventProps = {},
): Promise<void> {
  try {
    const res = await supabase.rpc('log_event', { p_event: event, p_props: props });
    const code = res?.error?.code;
    // ΠΕΡΙΜΕΝΕΙ ΤΗΝ ΑΝΑΦΟΡΑ. Στον διακομιστή (app/auth/callback) μια συνάρτηση
    // που απαντά πριν φύγει ο φάκελος τον χάνει. Το captureError δεν
    // απορρίπτεται ποτέ και οι κλήσεις του πελάτη είναι `void track(...)`.
    if (code) await captureError(new Error(`log_event ${event}: ${code}`), { event, code });
  } catch { /* σιωπηλά, όπως και το logActivity */ }
}
