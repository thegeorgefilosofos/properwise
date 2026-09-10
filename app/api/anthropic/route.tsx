import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sameOrigin, ORIGIN_DENIED } from '@/lib/api/origin';
import {
  MAX_PER_MINUTE, PLAN_RANK_ORDER,
  dailyLimitsByRank, monthlyLimitsByRank, FREE_POOL_PER_MONTH, TRIAL_LIMITS, TESTER_LIMITS,
  dailyExhaustedMessage, monthlyExhaustedMessage, poolExhaustedMessage,
} from '@/lib/billing/aiLimits';
import { ASSISTANT_NAME } from '@/lib/assistant/identity';
import {
  UPSTREAM_TIMEOUT_MS, upstreamFailure,
  TIMEOUT_FAILURE, NETWORK_FAILURE, UNREADABLE_FAILURE,
} from '@/lib/assistant/upstream';
import { refundAiUsage } from '@/lib/billing/aiRefund';

// Rate limiting: simple in-memory store (για production χρησιμοποίησε Redis)
// ΣΗΜ.: σε serverless/πολλαπλά instances αυτό είναι ανά-instance. Είναι φράγμα
// άμυνας σε βάθος· η οριστική λύση είναι κοινός μετρητής (Supabase RPC ή Redis).
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const dailyLimit = new Map<string, { count: number; day: number }>();
const MAX_REQUESTS_PER_MINUTE = MAX_PER_MINUTE;

/**
 * Οι κεφαλίδες υπολοίπου, γραμμένες σε ΕΝΑ σημείο.
 *
 * Ονόματα με πρόθεμα `x-ai-`: δεν είναι πρότυπο, είναι δικές μας και το
 * πρόθεμα το λέει. Τιμές ακέραιες, ώστε ο πελάτης να μη χρειάζεται μορφοποίηση
 * για να αποφασίσει τι θα δείξει.
 */
function quotaHeaders(q: { month: number; monthLimit: number; day: number; dayLimit: number } | null): Record<string, string> {
  if (!q) return {};
  return {
    'x-ai-month': String(q.month),
    'x-ai-month-limit': String(q.monthLimit),
    'x-ai-day': String(q.day),
    'x-ai-day-limit': String(q.dayLimit),
  };
}

// Το in-memory ημερήσιο φράγμα ΔΕΝ ξέρει το πλάνο του χρήστη (θα χρειαζόταν
// ερώτημα στη βάση πριν καν το φράγμα). Κρατά λοιπόν το ΜΕΓΑΛΥΤΕΡΟ όριο όλων
// των πλάνων: κόβει την προφανή κατάχρηση χωρίς ποτέ να κόψει άδικα συνδρομητή.
// Το πραγματικό, ανά-πλάνο όριο το επιβάλλει η bump_ai_usage παρακάτω, που
// είναι και η μόνη αυθεντική πηγή (ατομική, διαμοιραζόμενη, race-free).
const MAX_REQUESTS_PER_DAY = Math.max(...dailyLimitsByRank());

// ── Όρια εισόδου (κόστος/DoS) ────────────────────────────────────────────────
// Το input δεν έχει max_tokens· ένας συνδεδεμένος χρήστης θα μπορούσε να στείλει
// τεράστια payloads (πολλές εικόνες / 100σέλιδο PDF) και να φουσκώσει τον λογαριασμό
// του ANTHROPIC_API_KEY. Βάζουμε σκληρό όριο μεγέθους σώματος και πλήθους μηνυμάτων,
// και ΔΕΝ προωθούμε αυθαίρετα πεδία, μόνο μια λίστα επιτρεπτών.
const MAX_BODY_BYTES = 12 * 1024 * 1024; // ~12MB: αρκετό για φωτογραφία/PDF λογαριασμού
const MAX_MESSAGES   = 40;

// ── ΠΟΣΟ ΖΕΙ ΑΥΤΗ Η ΣΥΝΑΡΤΗΣΗ ────────────────────────────────────────────────
// Η διαδρομή ΔΕΝ δήλωνε όριο, οπότε ίσχυε η προεπιλογή της πλατφόρμας — ένα
// νούμερο που δεν φαίνεται πουθενά στον κώδικα και αλλάζει με το πακέτο
// φιλοξενίας. Δηλωμένο εδώ, το περιθώριο γίνεται μετρήσιμο: το UPSTREAM_TIMEOUT_MS
// κόβει τον πάροχο στα σαράντα πέντε δευτερόλεπτα και μένουν δεκαπέντε για την
// επιστροφή της χρέωσης και για την απάντηση σφάλματος. Το τεστ
// lib/assistant/upstream.test.ts κρατά τη σχέση των δύο νούμερων.
//
// ΠΡΟΣΟΧΗ ΣΤΟ ΠΑΚΕΤΟ ΦΙΛΟΞΕΝΙΑΣ: τα εξήντα δευτερόλεπτα πρέπει να τα επιτρέπει
// το πλάνο του Vercel. Αν δεν τα επιτρέπει, ΚΑΤΕΒΑΙΝΟΥΝ ΚΑΙ ΤΑ ΔΥΟ ΝΟΥΜΕΡΑ μαζί
// (εδώ και στο UPSTREAM_TIMEOUT_MS), ώστε το περιθώριο να μείνει.
export const maxDuration = 60;
// Καθαρίζουμε παλιές εγγραφές ρυθμού ώστε το Map να μη μεγαλώνει ασταμάτητα.
function sweepRateLimit(now: number) {
  if (rateLimit.size < 5000) return;
  for (const [k, v] of rateLimit) if (now >= v.resetAt) rateLimit.delete(k);
}

export async function POST(req: NextRequest) {
  // ── ΑΠΟ ΠΟΥ ΗΡΘΕ ────────────────────────────────────────────
  // ΑΥΤΗ Η ΔΙΑΔΡΟΜΗ ΞΟΔΕΥΕΙ ΧΡΗΜΑΤΑ ΣΕ ΚΑΘΕ ΚΛΗΣΗ. Το φράγμα κόστους μετρά
  // ανά χρήστη (`bump_ai_usage`), οπότε χωρίς έλεγχο προέλευσης μια ξένη
  // σελίδα άδειαζε το μηνιαίο υπόλοιπο κάθε συνδεδεμένου επισκέπτη της με το
  // cookie του — και ο λογαριασμός του παρόχου AI τον πληρώνει ο ιδιοκτήτης.
  if (!sameOrigin(req.headers)) {
    return NextResponse.json({ error: ORIGIN_DENIED }, { status: 403 });
  }

  // ── Auth check ──────────────────────────────────────────────
  // Έλεγχος πραγματικής συνεδρίας Supabase (μέσω cookies), δουλεύει και σε dev
  // και σε production, χωρίς να χρειάζεται ο client να στέλνει header.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Απαιτείται σύνδεση.' }, { status: 401 });
  }

  // ── Rate limiting (ανά χρήστη) ───────────────────────────────
  const ip = user.id;
  const now = Date.now();
  sweepRateLimit(now);
  const rl  = rateLimit.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= MAX_REQUESTS_PER_MINUTE) {
      return NextResponse.json(
        { error: 'Πολλές αιτήσεις. Δοκίμασε σε 1 λεπτό.' },
        { status: 429 }
      );
    }
    rl.count++;
  } else {
    rateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  // ── Ημερήσιο ταβάνι ανά χρήστη (κατά της κατάχρησης κόστους) ──
  const today = Math.floor(now / 86_400_000);
  const dl = dailyLimit.get(ip);
  if (dl && dl.day === today) {
    if (dl.count >= MAX_REQUESTS_PER_DAY) {
      return NextResponse.json(
        { error: 'Έφτασες το ημερήσιο όριο αιτήσεων AI. Δοκίμασε ξανά αύριο.' },
        { status: 429 }
      );
    }
    dl.count++;
  } else {
    dailyLimit.set(ip, { count: 1, day: today });
  }

  // ── Durable, cross-instance cap (authoritative) ──────────────
  // Οι χάρτες στη μνήμη από πάνω ζουν ΑΝΑ ΣΤΙΓΜΙΟΤΥΠΟ: σε serverless, κάθε νέα
  // εκτέλεση ξεκινά με άδειους. Ο ατομικός μετρητής στο Supabase είναι το
  // πραγματικό φράγμα — αυτό που δεν παρακάμπτεται χτυπώντας άλλο στιγμιότυπο.
  // Ανοίγει μόνο αν σφάλει η ΙΔΙΑ η κλήση (ο φρουρός της μνήμης μένει σε ισχύ).
  //
  // Τα όρια περνούν ως πίνακες [δωρεάν, ιδιοκτήτης, επαγγελματίας]. Η ΑΝΑΓΝΩΡΙΣΗ
  // του πλάνου γίνεται μέσα στη βάση (public.user_plan_rank), ώστε να μη χρειάζεται
  // δεύτερο ερώτημα εδώ και να μην μπορεί να δηλωθεί πλάνο από τον client.
  /** Πόσες ερωτήσεις έχει κάνει και πόσες δικαιούται. Μπαίνει σε κεφαλίδες. */
  let quota: { month: number; monthLimit: number; day: number; dayLimit: number } | null = null;
  try {
    const { data: usage, error: usageError } = await supabase.rpc('bump_ai_usage', {
      p_max_min: MAX_REQUESTS_PER_MINUTE,
      p_day:     dailyLimitsByRank(),
      p_month:   monthlyLimitsByRank(),
      p_pool:    FREE_POOL_PER_MONTH,
      // ΤΟ ΠΑΚΕΤΟ ΤΗΣ ΔΟΚΙΜΗΣ. Χωρίς αυτό, κάθε ανυψωμένο αλλά μη πληρωμένο
      // επίπεδο (δοκιμή, δωρεάν μήνες, Συνεργάτης) έπαιρνε τα όρια του πακέτου
      // στο οποίο ανυψώθηκε — δυόμισι φορές περισσότερα από όσα δικαιούται ο
      // συνδρομητής που πληρώνει το φθηνότερο.
      p_trial_day:   TRIAL_LIMITS.perDay,
      p_trial_month: TRIAL_LIMITS.perMonth,
      // ΚΑΙ ΤΟ ΠΑΚΕΤΟ ΤΟΥ ΔΟΚΙΜΑΣΤΗ. Η ιδιότητα δοκιμαστή δίνει οποιοδήποτε
      // πακέτο δωρεάν, οπότε ο λογαριασμός περνούσε ως πληρωμένος συνδρομητής
      // και έπαιρνε 483 ερωτήσεις τον μήνα: 16,76 $ που δεν πληρώνει κανείς.
      p_tester_day:   TESTER_LIMITS.perDay,
      p_tester_month: TESTER_LIMITS.perMonth,
    });
    // ΤΟ supabase-js ΔΕΝ ΠΕΤΑΕΙ ΣΕ ΣΦΑΛΜΑ RPC — ΤΟ ΕΠΙΣΤΡΕΦΕΙ. Το `catch` από
    // κάτω δεν έπιανε ποτέ τίποτα, άρα ένα σφάλμα δικαιωμάτων, ένα timeout ή
    // μια στιγμή ασυμφωνίας υπογραφής κατά το deploy έβγαζε `usage = null`, το
    // `u.allowed === false` ήταν ψευδές και το αίτημα ΠΡΟΧΩΡΟΥΣΕ στον πάροχο
    // χωρίς κανένα ανθεκτικό φράγμα. Ο μοναδικός φρουρός που έμενε ήταν ο
    // χάρτης στη μνήμη, που το ίδιο το migration περιγράφει ως παρακάμψιμο.
    //
    // Ένας μετρητής κόστους που ανοίγει όταν χαλάσει δεν είναι μετρητής.
    if (usageError || usage == null) {
      return NextResponse.json(
        { error: `Η ${ASSISTANT_NAME} δεν είναι διαθέσιμη αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο.` },
        { status: 503 },
      );
    }
    const u = usage as {
      allowed?: boolean; reason?: string; rank?: number;
      month?: number; month_limit?: number; day?: number; day_limit?: number;
    } | null;
    // ΤΑ ΝΟΥΜΕΡΑ ΤΟΥ ΥΠΟΛΟΙΠΟΥ ΤΑ ΕΠΕΣΤΡΕΦΕ ΗΔΗ Η ΒΑΣΗ ΚΑΙ ΤΑ ΠΕΤΑΓΑΜΕ. Ο χρήστης
    // μάθαινε ότι υπάρχει όριο μόνο τη στιγμή που το χτυπούσε — δηλαδή πάντα ως
    // έκπληξη και συνήθως στη μέση μιας δουλειάς. Ταξιδεύουν ως κεφαλίδες και
    // όχι μέσα στο σώμα, γιατί το σώμα είναι αυτούσια η απάντηση του παρόχου και
    // δεν επιτρέπεται να του προσθέσουμε πεδία που δεν του ανήκουν.
    if (u && typeof u.month === 'number' && typeof u.month_limit === 'number') {
      quota = { month: u.month, monthLimit: u.month_limit, day: u.day ?? 0, dayLimit: u.day_limit ?? 0 };
    }
    if (u && u.allowed === false) {
      // Το μήνυμα λέει το ΠΡΑΓΜΑΤΙΚΟ νούμερο του πλάνου του χρήστη. Ένα γενικό
      // «έφτασες το όριο» αφήνει τον χρήστη να μαντεύει πόσο είναι το όριο και
      // πότε επιστρέφει — και αυτό είναι που τον κάνει να νομίζει ότι χάλασε κάτι.
      const plan = PLAN_RANK_ORDER[u.rank ?? 0] ?? 'free';
      const error =
        u.reason === 'pool'   ? poolExhaustedMessage()
        : u.reason === 'month' ? monthlyExhaustedMessage(plan)
        : u.reason === 'day'   ? dailyExhaustedMessage(plan)
        : 'Πολλές ερωτήσεις μαζί. Δοκίμασε ξανά σε ένα λεπτό.';
      return NextResponse.json({ error, reason: u.reason, plan }, { status: 429 });
    }
  } catch {
    // Δικτυακή αποτυχία προς τη βάση: η ίδια απόφαση με το παραπάνω. Κλειστά.
    return NextResponse.json(
      { error: `Η ${ASSISTANT_NAME} δεν είναι διαθέσιμη αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο.` },
      { status: 503 },
    );
  }

  // ── Η ΜΟΝΑΔΑ ΕΧΕΙ ΗΔΗ ΧΡΕΩΘΕΙ ────────────────────────────────
  // Η bump_ai_usage χρέωσε παραπάνω. Από εδώ και κάτω, κάθε έξοδος που ΔΕΝ
  // είναι απάντηση του μοντέλου οφείλει να τη γυρίσει πίσω: αλλιώς ο
  // συνδρομητής πληρώνει ερώτηση που δεν πήρε, ενώ η οθόνη τον καλεί να
  // ξαναδοκιμάσει — δηλαδή να χάσει άλλη μία.
  //
  // ΜΙΑ ΦΟΡΑ ΚΑΙ ΜΟΝΟ ΜΙΑ. Η refund_ai_usage είναι αφαίρεση, όχι idempotent
  // εγγραφή: δύο κλήσεις για την ίδια αποτυχία θα χάριζαν δεύτερη ερώτηση. Η
  // εγγύηση ζει εδώ, σε μία σημαία και σε ΕΝΑ σημείο κλήσης.
  //
  // ΔΕΝ ΠΕΤΑΕΙ. Καλείται πάντα μέσα σε χειρισμό σφάλματος· μια εξαίρεση εδώ θα
  // σκέπαζε την αρχική αιτία και ο χρήστης θα διάβαζε λάθος εξήγηση.
  let refunded = false;
  const giveBack = async (pool: boolean) => {
    if (refunded) return;
    refunded = true;
    if (!(await refundAiUsage(user.id, pool))) return;
    // ΚΑΙ ΟΙ ΚΕΦΑΛΙΔΕΣ ΛΕΝΕ ΤΟ ΥΠΟΛΟΙΠΟ ΜΕΤΑ ΤΗΝ ΕΠΙΣΤΡΟΦΗ. Ο πελάτης διαβάζει
    // τις x-ai-* ΚΑΙ στις αποτυχημένες απαντήσεις (PropertyAssistant.readQuota):
    // αν έμεναν όπως τις έγραψε η χρέωση, η μπάρα θα έδειχνε μία ερώτηση
    // λιγότερη από όσες πράγματι έχει ο χρήστης.
    if (quota) quota = { ...quota, month: Math.max(quota.month - 1, 0), day: Math.max(quota.day - 1, 0) };
  };

  // ── Anthropic API call ───────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await giveBack(true);
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY δεν έχει οριστεί στο .env.local' },
      { status: 500, headers: quotaHeaders(quota) }
    );
  }

  try {
    // Διαβάζουμε πρώτα ως κείμενο για να επιβάλουμε σκληρό όριο μεγέθους (το
    // Content-Length μπορεί να λείπει/να είναι πλαστό, μετράμε τα πραγματικά bytes).
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      await giveBack(true);
      return NextResponse.json(
        { error: 'Το αρχείο είναι πολύ μεγάλο. Δοκίμασε μικρότερη φωτογραφία ή PDF.' },
        { status: 413, headers: quotaHeaders(quota) }
      );
    }
    const body = JSON.parse(raw);

    // Ασφάλεια: κλείδωμα μοντέλου + max_tokens. Το 'claude-sonnet-4-6' ΗΤΑΝ ΑΚΥΡΟ
    // (κάθε κλήση απέτυχε). Σωστό ID: claude-sonnet-5 (ικανό για vision/PDF).
    const ALLOWED = new Set(['claude-sonnet-5', 'claude-haiku-4-5-20251001']);

    // Δεν προωθούμε ΟΛΟ το body του client (θα ήταν γενικός proxy Claude με χρέωση
    // δική μας). Δεχόμαστε μόνο μια λίστα επιτρεπτών πεδίων και ελέγχουμε τα μηνύματα.
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      await giveBack(true);
      return NextResponse.json(
        { error: 'Λείπουν μηνύματα.' },
        { status: 400, headers: quotaHeaders(quota) }
      );
    }
    // ΚΟΒΟΥΜΕ, ΔΕΝ ΑΠΟΡΡΙΠΤΟΥΜΕ. Πριν, στο 40ό μήνυμα (≈20ή ερώτηση) ο χρήστης
    // έπαιρνε 413 «Πολύ μεγάλη συνομιλία» και η συνεδρία ΣΠΑΓΕ: κάθε επόμενη
    // ερώτηση απέτυχε, χωρίς τρόπο ανάκαμψης πέρα από ανανέωση σελίδας. Ο σκοπός
    // του ορίου είναι να φράξει το κόστος, όχι να τιμωρήσει όποιον μιλά πολύ.
    //
    // Κρατάμε τα ΤΕΛΕΥΤΑΙΑ μηνύματα (η πρόσφατη συνομιλία είναι που μετράει) και
    // φροντίζουμε να ξεκινά από 'user': το Anthropic API απορρίπτει ιστορικό που
    // αρχίζει με 'assistant'.
    if (body.messages.length > MAX_MESSAGES) {
      let trimmed = body.messages.slice(-MAX_MESSAGES);
      while (trimmed.length && trimmed[0]?.role !== 'user') trimmed = trimmed.slice(1);
      body.messages = trimmed.length ? trimmed : body.messages.slice(-1);
    }
    const safeBody: Record<string, unknown> = {
      model:      ALLOWED.has(body.model) ? body.model : 'claude-sonnet-5', // ποτέ opus
      max_tokens: Math.min(Number(body.max_tokens) || 1000, 2000),
      messages:   body.messages,
    };
    // ── PROMPT CACHING: η μεγαλύτερη μείωση κόστους που υπάρχει εδώ ──────────
    // Το system prompt είναι 72.598 χαρακτήρες (~33.000 tokens) και προσαρτάται
    // αυτούσιο σε ΚΑΘΕ μήνυμα. Το caching είναι αντιστοίχιση ΠΡΟΘΕΜΑΤΟΣ και
    // κοστίζει write 1,25× · read 0,10×.
    //
    // Ο βοηθός στέλνει πλέον ΔΥΟ μπλοκ (assistantPersona.buildSystemBlocks):
    // πρώτα το σταθερό (γνώση, κανόνες, πλάνα — ίδιο για κάθε χρήστη, το 97,5%
    // του κειμένου) και μετά το προσωπικό. Έτσι η cache είναι ΚΟΙΝΗ για όλους
    // τους χρήστες του ίδιου κλειδιού. Το κόστος πέφτει από ~0,130 $ σε
    // ~0,052 $ ανά ερώτηση, χωρίς να αλλάξει λέξη στο prompt.
    //
    // Το TTL των 5 λεπτών ανανεώνεται ΔΩΡΕΑΝ σε κάθε hit, άρα η κίνηση κρατά
    // την cache ζεστή χωρίς δεύτερη χρέωση write. Γι' αυτό δεν χρησιμοποιούμε
    // το 1ωρο TTL, που κοστίζει 2× αντί 1,25×.
    //
    // ΤΟ `cache_control` ΤΟ ΒΑΖΕΙ Ο SERVER, ΠΟΤΕ Ο CLIENT: κάθε breakpoint είναι
    // χρεώσιμη εγγραφή, οπότε αν το εμπιστευόμασταν στον client, ένας χρήστης θα
    // μπορούσε να ζητήσει τέσσερα breakpoints σε κάθε αίτημα και να πολλαπλασιάσει
    // τον λογαριασμό. Το καθαρίζουμε και το βάζουμε μόνοι μας, στο πρώτο μπλοκ.
    const asBlock = (b: unknown) =>
      b && typeof b === 'object' && typeof (b as { text?: unknown }).text === 'string'
        ? { type: 'text' as const, text: (b as { text: string }).text }
        : null;
    if (typeof body.system === 'string' && body.system.length > 0) {
      safeBody.system = [{ type: 'text', text: body.system, cache_control: { type: 'ephemeral' } }];
    } else if (Array.isArray(body.system)) {
      const blocks = body.system.map(asBlock).filter(Boolean) as { type: 'text'; text: string }[];
      if (blocks.length) {
        safeBody.system = blocks.map((b, i) =>
          i === 0 ? { ...b, cache_control: { type: 'ephemeral' } } : b);
      }
    }
    // ΣΚΟΠΙΜΑ ΔΕΝ ΠΡΟΩΘΕΙΤΑΙ το `temperature`. Το Claude Sonnet 5 απορρίπτει με 400
    // κάθε μη-προεπιλεγμένη τιμή σε temperature/top_p/top_k. Κανένας από τους
    // caller δεν το στέλνει σήμερα, οπότε η γραμμή ήταν νάρκη: θα έσπαγε αθόρυβα
    // την πρώτη φορά που κάποιος θα το πρόσθετε, με σφάλμα που δεν παραπέμπει
    // πουθενά. Αν χρειαστεί ποτέ έλεγχος δημιουργικότητας, γίνεται στο prompt.

    // ── ΧΡΟΝΙΚΟ ΟΡΙΟ ───────────────────────────────────────────────────────
    // Χωρίς αυτό, ένα κολλημένο αίτημα κρατούσε τη συνάρτηση ώς το ταβάνι της
    // πλατφόρμας: πληρωμένος χρόνος εκτέλεσης για απάντηση που δεν έρχεται
    // ποτέ και — χειρότερα — μονάδα χρεωμένη που δεν επιστρέφεται ποτέ, γιατί
    // ο κώδικας της επιστροφής δεν προλαβαίνει καν να τρέξει.
    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body:   JSON.stringify(safeBody),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (err) {
      // ΤΟ ΧΡΟΝΙΚΟ ΟΡΙΟ ΞΕΧΩΡΙΖΕΙ ΑΠΟ ΤΗΝ ΠΤΩΣΗ ΔΙΚΤΥΟΥ. Το AbortSignal.timeout
      // πετάει DOMException με name 'TimeoutError' (μετρημένο σε Node 22)· ό,τι
      // άλλο σημαίνει ότι το αίτημα δεν έφυγε ή δεν έφτασε. Η διαφορά κρίνει
      // ΜΟΝΟ τη δεξαμενή: στο χρονικό όριο ο πάροχος πιθανότατα παρήγαγε ήδη
      // tokens που θα χρεωθούν.
      const timedOut = (err as { name?: string } | null)?.name === 'TimeoutError';
      const f = timedOut ? TIMEOUT_FAILURE : NETWORK_FAILURE;
      console.error('Anthropic fetch:', timedOut ? 'timeout' : err);
      await giveBack(f.pool);
      return NextResponse.json({ error: f.message }, { status: f.status, headers: quotaHeaders(quota) });
    }

    // ── ΤΟ ΣΩΜΑ ΔΙΑΒΑΖΕΤΑΙ ΩΣ ΚΕΙΜΕΝΟ ΠΡΩΤΑ ───────────────────────────────
    // Το .json() έτρεχε ΠΡΙΝ τον έλεγχο response.ok. Μια πύλη ή ένας
    // εξισορροπητής που απαντά με HTML («502 Bad Gateway») έκανε το .json() να
    // πετάξει, η εξαίρεση έπεφτε στο γενικό catch και ο χρήστης διάβαζε
    // «Εσωτερικό σφάλμα»: δηλαδή «φταίμε εμείς» για βλάβη που δεν είναι δική
    // μας και που λύνεται με μια δεύτερη προσπάθεια.
    const text = await response.text().catch(() => '');
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!response.ok) {
      // Η ΩΜΗ ΑΙΤΙΑ ΠΑΕΙ ΣΤΑ ΑΡΧΕΙΑ ΚΑΤΑΓΡΑΦΗΣ, ΟΧΙ ΣΤΗΝ ΟΘΟΝΗ. Το μήνυμα του
      // παρόχου είναι αγγλικά με ορολογία API και ΤΕΣΣΕΡΙΣ οθόνες το έδειχναν
      // αυτούσιο: TabTenantMoney:670, TabClients:548, LoanDocScan:213 και
      // ClientCompose:118.
      const upstream = (data as { error?: { message?: string } } | null)?.error?.message;
      console.error('Anthropic API error:', response.status, upstream ?? text.slice(0, 300));
      const f = upstreamFailure(response.status);
      await giveBack(f.pool);
      return NextResponse.json({ error: f.message }, { status: f.status, headers: quotaHeaders(quota) });
    }

    // Απάντηση 200 με σώμα που δεν είναι JSON: ο πάροχος χρέωσε, ο χρήστης δεν
    // πήρε τίποτα. Το πακέτο γυρίζει, η δεξαμενή όχι.
    if (data === null) {
      console.error('Anthropic API: μη αναγνώσιμο σώμα', response.status, text.slice(0, 300));
      await giveBack(UNREADABLE_FAILURE.pool);
      return NextResponse.json(
        { error: UNREADABLE_FAILURE.message },
        { status: UNREADABLE_FAILURE.status, headers: quotaHeaders(quota) }
      );
    }

    return NextResponse.json(data, { headers: quotaHeaders(quota) });
  } catch (err) {
    // ΕΔΩ ΦΤΑΝΕΙ ΜΟΝΟ ΔΙΚΟ ΜΑΣ ΣΦΑΛΜΑ: χαλασμένο JSON στο σώμα του αιτήματος ή
    // απρόβλεπτη εξαίρεση. Ο πάροχος δεν παρήγαγε τίποτα, οπότε γυρίζει και η
    // μονάδα της δεξαμενής.
    console.error('Route error:', err);
    await giveBack(true);
    return NextResponse.json(
      { error: `${ASSISTANT_NAME}: το αίτημα δεν ολοκληρώθηκε. Δοκίμασε ξανά σε λίγο.` },
      { status: 500, headers: quotaHeaders(quota) }
    );
  }
}

// Μόνο POST· κάθε άλλη μέθοδος απαντά 405.
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}