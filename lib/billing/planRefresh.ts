// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΑΚΕΤΟ ΜΕΤΑ ΤΟ ΤΑΜΕΙΟ
// ─────────────────────────────────────────────────────────────────────────
// Ο πάροχος γυρίζει τον αγοραστή στο `/dashboard?checkout=ok` (η διαδρομή του
// ταμείου, app/api/billing/checkout). Το πακέτο όμως ΔΕΝ το γράφει η επιστροφή:
// το γράφει ο webhook, με ρόλο υπηρεσίας, όταν ο πάροχος τον ειδοποιήσει. Η
// σειρά των δύο δεν είναι εγγυημένη. Ο webhook μπορεί να έχει έρθει πριν
// φορτώσει η σελίδα ή δέκα δευτερόλεπτα αργότερα.
//
// ΤΙ ΓΙΝΟΤΑΝ (έλεγχος 12.11.2026, εύρημα 5). Την παράμετρο δεν τη διάβαζε
// κανείς. Ο πίνακας διάβαζε το προφίλ μία φορά στη φόρτωση· αν ο webhook
// αργούσε, ο πελάτης που μόλις πλήρωσε έβλεπε τις καρτέλες κλειδωμένες ως την
// επόμενη ανανέωση και χωρίς καμία εξήγηση.
//
// ΕΔΩ ΖΕΙ Η ΛΟΓΙΚΗ ΧΩΡΙΣ REACT: η ανάγνωση της παραμέτρου και η αναμονή με
// όριο. Ο πίνακας (useDashboard) δίνει μόνο την ανάγνωση του προφίλ.
// ═══════════════════════════════════════════════════════════════════════════

import { isEntitled, isMorStatus } from './subscription';
import { livePlan } from './entitlements';

/** Η παράμετρος που βάζει η διαδρομή του ταμείου στη διεύθυνση επιστροφής. */
export const CHECKOUT_PARAM = 'checkout';

/**
 * Γύρισε ο χρήστης από το ταμείο; Και η διεύθυνση χωρίς την παράμετρο, ώστε
 * μια ανανέωση της σελίδας να μην ξαναξεκινά την αναμονή.
 */
export function takeCheckoutReturn(search: string): { returned: boolean; search: string } {
  const q = new URLSearchParams(search || '');
  const returned = q.get(CHECKOUT_PARAM) === 'ok';
  if (!q.has(CHECKOUT_PARAM)) return { returned, search: search || '' };
  q.delete(CHECKOUT_PARAM);
  const rest = q.toString();
  return { returned, search: rest ? `?${rest}` : '' };
}

/** Οσα στοιχεία του προφίλ χρειάζεται η κρίση «ήρθε η συνδρομή;». */
export interface PlanRow {
  plan?: string | null;
  subscription_status?: string | null;
  mor_ends_at?: string | null;
  /**
   * Η πρώτη αποτυχημένη ανανέωση. Χωρίς αυτήν η `livePlan` και η `isEntitled`
   * δεν βλέπουν πότε τελειώνει η χάρη του `past_due` και η οθόνη έδειχνε
   * ανοιχτό πακέτο που η βάση (`user_plan_rank`) έχει ήδη κλείσει (PR 558).
   */
  mor_past_due_at?: string | null;
}

// ── ΤΙ ΔΙΑΒΑΖΕΤΑΙ ΚΑΙ ΤΙ ΖΗΤΙΕΤΑΙ ΕΙΝΑΙ ΕΝΑ ΚΑΙ ΤΟ ΑΥΤΟ ───────────────────
// Οι Ρυθμίσεις ζητούσαν από τη βάση οκτώ στήλες και διάβαζαν δέκα: οι θέσεις
// ακινήτων από προσκλήσεις (`bonus_properties`, `bonus_properties_until`)
// δεν ζητούνταν ποτέ, οπότε το όριο εκεί έβγαινε πάντα χωρίς αυτές ενώ ο
// πίνακας τις μετρούσε (έλεγχος 12.11.2026, εύρημα 8). Η λίστα των στηλών και
// η ανάγνωσή τους ζουν πλέον εδώ, δίπλα δίπλα και ο έλεγχος
// (planRefresh.test.ts) κόβει κάθε πεδίο που διαβάζεται χωρίς να ζητηθεί.

/** Οι στήλες του `billing_profiles` που κρίνουν το πακέτο. */
export const PLAN_COLUMNS =
  'plan, comp_plan, comp_until, trial_used_at, hold_plan, hold_until, bonus_properties, bonus_properties_until, subscription_status, mor_ends_at, mor_past_due_at';

export interface PlanProfileRow extends PlanRow {
  comp_plan?: string | null;
  comp_until?: string | null;
  trial_used_at?: string | null;
  hold_plan?: string | null;
  hold_until?: string | null;
  bonus_properties?: number | null;
  bonus_properties_until?: string | null;
}

/** Τα πεδία του πακέτου όπως τα κρατά η οθόνη (EntitlementInput, χωρίς τα δικά της). */
export interface PlanFields {
  plan: string;
  compPlan: string | null;
  compUntil: string | null;
  trialUsedAt: string | null;
  holdPlan: string | null;
  holdUntil: string | null;
  bonusProperties: number | null;
  bonusUntil: string | null;
}

/**
 * Γράφεται στην οθόνη αυτή η ανάγνωση;
 *
 * «ΔΕΝ ΥΠΑΡΧΕΙ ΠΡΟΦΙΛ» ΚΑΙ «Η ΑΝΑΓΝΩΣΗ ΑΠΕΤΥΧΕ» ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ. Το πρώτο
 * σημαίνει δωρεάν πακέτο και γράφεται. Το δεύτερο σημαίνει ότι δεν ξέρουμε:
 * αν γραφόταν ως «δωρεάν», ένα σφάλμα δικτύου στην ανανέωση ή στην αναμονή
 * μετά το ταμείο θα κλείδωνε τις καρτέλες πελάτη που πληρώνει. Τότε μένει
 * ό,τι ήδη δείχνει η οθόνη.
 */
export function planReadApplies(outcome: { error: unknown }): boolean {
  return !outcome.error;
}

/** Η γραμμή του προφίλ στα πεδία της οθόνης. Χωρίς προφίλ: δωρεάν, χωρίς τίποτα. */
export function planFieldsFromRow(row: PlanProfileRow | null | undefined, now: number = Date.now()): PlanFields {
  return {
    plan: livePlan(row, now),
    compPlan: row?.comp_plan || null,
    compUntil: row?.comp_until || null,
    trialUsedAt: row?.trial_used_at || null,
    holdPlan: row?.hold_plan || null,
    holdUntil: row?.hold_until || null,
    bonusProperties: typeof row?.bonus_properties === 'number' ? row.bonus_properties : null,
    bonusUntil: row?.bonus_properties_until || null,
  };
}

/**
 * Υπάρχει ζωντανή συνδρομή στο προφίλ;
 *
 * ΚΡΙΝΕΤΑΙ ΑΠΟ ΤΗΝ ΚΑΤΑΣΤΑΣΗ ΚΑΙ ΟΧΙ ΑΠΟ ΣΥΓΚΡΙΣΗ ΜΕ ΤΟ ΠΡΙΝ. Αν ο webhook
 * πρόλαβε τη φόρτωση, το «πριν» είναι ήδη το «μετά» και μια σύγκριση θα
 * περίμενε αλλαγή που έχει ήδη γίνει. Το ταμείο ανοίγει μόνο για όποιον δεν
 * έχει ζωντανή συνδρομή (409 αλλιώς), άρα η ύπαρξή της είναι η απάντηση.
 */
export function subscriptionArrived(row: PlanRow | null | undefined, now: number = Date.now()): boolean {
  const status = (row?.subscription_status || '').trim();
  if (!isMorStatus(status)) return false;
  if (!isEntitled({ status, endsAt: row?.mor_ends_at ?? null, pastDueSince: row?.mor_past_due_at ?? null }, new Date(now).toISOString())) return false;
  return livePlan(row, now) !== 'free';
}

/**
 * Οι παύσεις ανάμεσα στις αναγνώσεις, σε χιλιοστά. Επτά αναγνώσεις, περίπου
 * σαράντα δευτερόλεπτα συνολικά: αρκετά για έναν webhook που αργεί, λίγα
 * ώστε η σελίδα να μη ρωτά τη βάση επ’ αόριστον.
 */
export const PLAN_POLL_DELAYS_MS: readonly number[] = [1500, 2500, 4000, 6000, 8000, 8000, 10000];

export interface PollOptions<T> {
  /** Μία ανάγνωση του προφίλ. `null` όταν η ανάγνωση απέτυχε. */
  read: () => Promise<T | null>;
  /** Ηρθε αυτό που περιμένουμε; */
  done: (row: T | null) => boolean;
  delays?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** Σταματά την αναμονή (π.χ. η σελίδα έκλεισε). */
  cancelled?: () => boolean;
  /**
   * Η πρώτη ανάγνωση έχει ήδη γίνει αλλού (η φόρτωση της σελίδας): περίμενε
   * πρώτα. Αλλιώς η πρώτη ανάγνωση γίνεται αμέσως.
   */
  waitFirst?: boolean;
}

export interface PollResult<T> {
  arrived: boolean;
  row: T | null;
  /** Πόσες αναγνώσεις έγιναν. */
  reads: number;
}

const realSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Διαβάζει ώσπου να ισχύσει το `done` ή να τελειώσουν οι παύσεις. Δεν ρίχνει
 * ποτέ: μια αποτυχημένη ανάγνωση μετρά ως «όχι ακόμη». Οι αναγνώσεις είναι
 * το πολύ `delays.length + 1` (ή `delays.length` με `waitFirst`).
 */
export async function pollUntil<T>(opts: PollOptions<T>): Promise<PollResult<T>> {
  const delays = opts.delays ?? PLAN_POLL_DELAYS_MS;
  const sleep = opts.sleep ?? realSleep;
  let row: T | null = null;
  let reads = 0;
  const steps = opts.waitFirst ? delays.length : delays.length + 1;
  for (let i = 0; i < steps; i++) {
    const pause = opts.waitFirst ? delays[i] : i > 0 ? delays[i - 1] : 0;
    if (pause > 0) await sleep(pause);
    if (opts.cancelled?.()) return { arrived: false, row, reads };
    try { row = await opts.read(); } catch { row = null; }
    reads++;
    if (opts.done(row)) return { arrived: true, row, reads };
  }
  return { arrived: false, row, reads };
}

/** Τα μηνύματα της επιστροφής. Δεν λένε τίποτα για χρέωση: αυτό το λέει ο πάροχος. */
export const CHECKOUT_RETURN_SAY = {
  waiting: 'Γύρισες από το ταμείο. Ενημερώνουμε το πακέτο σου…',
  arrived: (planName: string) => `Το πακέτο σου είναι πλέον «${planName}».`,
  late: 'Ο πάροχος δεν μας έχει ενημερώσει ακόμη. Το πακέτο θα αλλάξει μόλις έρθει η ειδοποίησή του· ξαναφόρτωσε τη σελίδα σε λίγα λεπτά. Αν δεν αλλάξει, γράψε μας από τις Ρυθμίσεις.',
} as const;
