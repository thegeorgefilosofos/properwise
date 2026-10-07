import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { reportEdgeError } from '../_shared/report.ts'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!

// Service client is used ONLY after we have verified, from the caller's JWT, that
// the requested property belongs to them. Identity always comes from the token —
// never from the request body (which an attacker controls).
const service = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Τα όρια AI ΔΕΝ ζουν εδώ ──────────────────────────────────────────────────
// Ως τις 05.10.2026 εδώ υπήρχε αντίγραφο του lib/billing/aiLimits.ts, που
// ταξίδευε ως ορίσματα στη bump_ai_usage. Από την 20261005150000 τα όρια τα
// ξέρει μόνο η βάση (`take_ai_unit`): η function στέλνει ποιος ρωτά και ένα
// κλειδί αιτήματος, τίποτα άλλο. Ένα αντίγραφο λιγότερο που μπορεί να αποκλίνει.

// ── Το «σήμερα» της Ελλάδας, μέσα σε Deno ───────────────────────────────────
// ΚΑΘΡΕΦΤΗΣ του lib/core/time.ts, για τον ίδιο λόγο με τα όρια AI: το Deno δεν
// φτάνει στο lib/. Το `toISOString().slice(0,10)` του τώρα γυρίζει UTC και
// στην Ελλάδα από τα μεσάνυχτα ως τις 02:00/03:00 δείχνει ΧΘΕΣ. Εδώ κοστίζει
// διπλά: με λάθος αφετηρία το μοντέλο δίνει και λάθος ημερομηνίες γεγονότων.
const athensToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── 1. Authenticate the caller from their JWT ─────────────────────────────
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized' }, 401)
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await authClient.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)
    const userId = userData.user.id

    // ── 2. The property_id must belong to the authenticated user ──────────────
    const { property_id } = await req.json().catch(() => ({}))
    if (!property_id) return json({ error: 'Missing property_id' }, 400)
    // «ΔΕΝ ΕΙΝΑΙ ΔΙΚΟ ΣΟΥ» ΚΑΙ «ΔΕΝ ΜΠΟΡΩ ΝΑ ΔΩ ΑΝ ΕΙΝΑΙ» ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ.
    // Χωρίς το `error`, μια αποτυχία ανάγνωσης έδινε `owned = null` και ο
    // ιδιοκτήτης έπαιρνε 403 για το ΔΙΚΟ του ακίνητο. Η άρνηση μένει άρνηση —
    // καμία πρόταση δεν παράγεται χωρίς επιβεβαιωμένη κυριότητα — αλλά ο
    // κωδικός λέει πια ποιο από τα δύο συνέβη.
    //
    // ΜΕ ΤΟ ΔΙΑΚΡΙΤΙΚΟ ΤΟΥ ΚΑΛΟΥΝΤΑ, ΟΧΙ ΜΕ ΤΟΝ ΡΟΛΟ ΥΠΗΡΕΣΙΑΣ. Έτσι η ανάγνωση
    // περνά από την RLS, μαζί και από την πύλη του δεύτερου βήματος
    // (20261003120000): συνεδρία «aal1» με δηλωμένη συσκευή δεν βλέπει το
    // ακίνητο και παίρνει 403 πριν ο ρόλος υπηρεσίας διαβάσει δαπάνες και
    // λογαριασμούς για να τα στείλει στο μοντέλο.
    const { data: owned, error: ownedErr } = await authClient
      .from('user_properties')
      .select('id, name, prop_type, sqm, value, target_rent, address, heating, pea_class')
      .eq('id', property_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (ownedErr) {
      console.error('[smart-suggestions] η κυριότητα δεν διαβάστηκε:', ownedErr)
      return json({ error: 'ownership_unverifiable', detail: ownedErr.message }, 503)
    }
    if (!owned) return json({ error: 'forbidden' }, 403)

    // ── 3. Το ΙΔΙΟ ταβάνι κόστους AI με την κύρια διαδρομή ────────────────────
    // Ο μετρητής είναι ΚΟΙΝΟΣ επίτηδες: μια πρόταση χρεώνεται στο ίδιο κλειδί με
    // μια ερώτηση στη Νόα, άρα μετράει στο ίδιο πακέτο. Ένα ταβάνι, ένας μετρητής.
    //
    // ΜΕ ΤΟ service, ΜΕΤΑ ΤΟ JWT. Η `take_ai_unit` (20261005150000) εκτελείται
    // μόνο από τον ρόλο υπηρεσίας και δέχεται ρητό χρήστη: το `userId` βγήκε
    // από το token στο βήμα 1, ποτέ από το σώμα. Όρια δεν στέλνονται· τα ξέρει
    // η βάση. Η άρνηση δεν γράφει τίποτα και η χρέωση γίνεται ΠΡΙΝ το μοντέλο.
    const requestId = crypto.randomUUID()
    const { data: usage, error: usageErr } = await service.rpc('take_ai_unit', {
      p_uid: userId,
      p_request_id: requestId,
    })
    // Ο μετρητής είναι ΓΡΑΨΙΜΟ: αν δεν απάντησε, δεν ξέρουμε πόσα έχει ξοδέψει ο
    // χρήστης. «Άσ' το να περάσει» σημαίνει ξανά απεριόριστη χρέωση.
    if (usageErr || usage == null) {
      return json({ error: 'Ο έλεγχος ορίου AI δεν είναι διαθέσιμος αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο.' }, 503)
    }
    const u = usage as { allowed?: boolean; reason?: string } | null
    // Κάθε απάντηση που δεν είναι ρητό «ναι» είναι άρνηση.
    if (u?.allowed !== true && u?.reason !== 'plan') {
      const when = u?.reason === 'day' ? 'Το όριο ανανεώνεται τα μεσάνυχτα.'
        : u?.reason === 'month' || u?.reason === 'pool' ? 'Ανοίγει ξανά την 1η του επόμενου μήνα.'
        : u?.reason === 'minute' ? 'Δοκίμασε ξανά σε ένα λεπτό.'
        : 'Δοκίμασε ξανά σε λίγο.'
      return json({
        error: `Οι προτάσεις μετρούν στο ίδιο όριο με τις ερωτήσεις προς τη Νόα, που τελείωσε για τώρα. ${when}`,
        reason: u?.reason,
      }, 429)
    }
    // Το δωρεάν πακέτο δεν έχει τη Νόα· οι προτάσεις της είναι μέρος της. Η
    // βάση αρνείται πριν μετρήσει, οπότε εδώ δεν υπάρχει «πότε ανοίγει ξανά».
    if (u?.allowed !== true) {
      return json({ error: 'Οι προτάσεις για το ακίνητο υπάρχουν από το πακέτο «Ιδιοκτήτης με Νόα».', reason: 'plan' }, 403)
    }

    // Η ΜΟΝΑΔΑ ΧΡΕΩΘΗΚΕ. Αν ο πάροχος δεν απαντήσει, γυρίζει πίσω με το ίδιο
    // κλειδί, μία φορά (η βάση δεν δέχεται δεύτερη επιστροφή).
    const giveBack = () => service.rpc('refund_ai_unit', { p_uid: userId, p_request_id: requestId, p_pool: true })
      .then(({ error }) => { if (error) console.error('[smart-suggestions] η επιστροφή μονάδας AI δεν έγινε:', error.message) },
            (err) => console.error('[smart-suggestions] η επιστροφή μονάδας AI δεν έγινε:', err))

    // ── 4. Read only this user's data for this property ───────────────────────
    const [eventsRes, billsRes, expensesRes] = await Promise.all([
      service.from('calendar_events').select('title,category,amount,event_time,recurring,status').eq('property_id', property_id).eq('user_id', userId),
      service.from('bills').select('name,amount,category,paid,due_date').eq('property_id', property_id).eq('user_id', userId),
      service.from('expenses').select('description,amount,category,date').eq('property_id', property_id).eq('user_id', userId).order('date', { ascending: false }).limit(30),
    ])
    const events   = eventsRes.data || []
    const bills    = billsRes.data || []
    const expenses = expensesRes.data || []

    // ── 5. Ask the model for missing calendar obligations ─────────────────────
    // Η ΑΓΚΥΡΑ ΧΡΟΝΟΥ ΕΛΕΙΠΕ ΕΝΤΕΛΩΣ. Το prompt ζητούσε «εποχικότητα» και
    // «ελληνική νομοθεσία» χωρίς να λέει ποια μέρα είναι σήμερα: το μοντέλο
    // υπέθετε και ο πελάτης πετούσε ούτως ή άλλως ό,τι έβγαινε, γιατί το
    // σχήμα δεν είχε πεδίο ημερομηνίας να γεμίσει.
    const todayIso = athensToday()
    const prompt = `Είσαι expert σύμβουλος διαχείρισης ακινήτων στην Ελλάδα. Ανάλυσε τα παρακάτω δεδομένα και πρότεινε 4-6 γεγονότα ημερολογίου που λείπουν ή χρειάζονται προσοχή.

ΣΗΜΕΡΑ: ${todayIso}

ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ:
${JSON.stringify(owned, null, 2)}

ΥΠΑΡΧΟΝΤΑ ΓΕΓΟΝΟΤΑ ΗΜΕΡΟΛΟΓΙΟΥ (${events.length}):
${JSON.stringify(events.slice(0, 20), null, 2)}

ΛΟΓΑΡΙΑΣΜΟΙ (${bills.length}):
${JSON.stringify(bills, null, 2)}

ΔΑΠΑΝΕΣ ΤΕΛΕΥΤΑΙΟΙ 30 (${expenses.length}):
${JSON.stringify(expenses, null, 2)}

ΚΑΝΟΝΕΣ:
1. Προτεινε ΜΟΝΟ γεγονότα που ΔΕΝ υπάρχουν ήδη στο ημερολόγιο
2. Βασίσου στα πραγματικά δεδομένα — π.χ. αν έχει κλιματιστικό στα bills/expenses, πρότεινε service
3. Λάβε υπόψη ελληνική νομοθεσία (ΕΝΦΙΑ, ΤΑΠ, πιστοποιητικά)
4. Αν το ακίνητο έχει ενοικιαστή, πρότεινε σχετικά γεγονότα
5. Λάβε υπόψη εποχικότητα (καλοκαίρι=κλιματιστικά, χειμώνας=θέρμανση)
6. Κάθε γεγονός παίρνει τη ΔΙΚΗ ΤΟΥ ημερομηνία, μέσα στους επόμενους 12 μήνες από το ΣΗΜΕΡΑ. Μη δίνεις σε δύο γεγονότα την ίδια, εκτός αν όντως συμπίπτουν.

Απάντησε ΜΟΝΟ με valid JSON array, χωρίς markdown, χωρίς εξηγήσεις:
[
  {
    "title": "τίτλος γεγονότος στα ελληνικά",
    "category": "financial|bills|maintenance|contract|tenant|reminder",
    "event_date": "YYYY-MM-DD, η πραγματική ημερομηνία της υποχρέωσης μέσα στους επόμενους 12 μήνες",
    "amount": 150,
    "recurring": true,
    "recurring_interval": "monthly|annual|quarterly|biannual",
    "priority": "low|medium|high|critical",
    "reason": "σύντομη εξήγηση γιατί είναι σημαντικό (max 10 λέξεις)"
  }
]`

    let aiRes: Response
    try {
      aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          // 1024 ήταν σφιχτό ήδη με έξι προτάσεις. Η ημερομηνία προσθέτει ~10
          // tokens σε καθεμία: με κομμένη απάντηση το `JSON.parse` αποτυγχάνει,
          // το `catch` γυρίζει άδειο array και ο χρήστης διαβάζει «δεν κατάφερα
          // να διαβάσω το ακίνητο» για ένα όριο, όχι για σφάλμα.
          max_tokens: 1536,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    } catch (err) {
      // Το αίτημα δεν έφτασε ή δεν γύρισε: ο πάροχος δεν παρήγαγε τίποτα.
      await giveBack()
      throw err
    }

    if (!aiRes.ok) {
      await giveBack()
      const err = await aiRes.text()
      // ΤΟ ΓΙΑΤΙ ΣΤΟ LOG, ΟΧΙ ΜΟΝΟ Ο ΚΩΔΙΚΟΣ. Στις 25.09.2026 η παραγωγή έγραφε
      // μόνο «Claude API error status 400» και δεν φαινόταν αν έφταιγε το
      // υπόλοιπο του λογαριασμού, το μοντέλο ή το αίτημα. Ο τύπος και το μήνυμα
      // του σφάλματος του API δεν κουβαλούν δεδομένα του χρήστη ούτε το κλειδί.
      let kind = '', message = ''
      try { const e = JSON.parse(err)?.error; kind = String(e?.type ?? ''); message = String(e?.message ?? '').slice(0, 200) } catch { /* όχι JSON */ }
      console.error('Claude API error status', aiRes.status, kind, message)
      return json({ error: 'AI error', details: err }, 500)
    }

    const aiData = await aiRes.json()
    const text   = aiData.content?.[0]?.text || '[]'
    const clean  = text.replace(/```json|```/g, '').trim()

    let suggestions = []
    try { suggestions = JSON.parse(clean) } catch { suggestions = [] }
    // Το μοντέλο μπορεί να απαντήσει με αντικείμενο αντί για array. Ο πελάτης
    // διάβαζε `data.suggestions?.length` και έβγαζε undefined, δηλαδή σφάλμα
    // χωρίς αιτία· και ο έλεγχος από κάτω θα έσκαγε σε 500.
    if (!Array.isArray(suggestions)) suggestions = []

    // ── 6. Η ημερομηνία του μοντέλου είναι είσοδος, όχι μέτρηση ───────────────
    // Ο ίδιος έλεγχος που κάνει ήδη ο πελάτης στην κατηγορία και στην
    // προτεραιότητα (canonicalCategory, eventPriority στο lib/data/calendar.ts).
    // Ο,τι δεν είναι πραγματική μέρα μέσα στους επόμενους 18 μήνες σβήνεται
    // εδώ, ώστε ο πελάτης να πέσει στην εφεδρική του ημερομηνία αντί να γράψει
    // στο ημερολόγιο μέρα που έχει περάσει, ή μέρα που δεν υπάρχει και ρίχνει
    // ολόκληρη την εγγραφή. Το ταβάνι είναι 18 μήνες και όχι 12: ο κανόνας 6
    // ζητά δωδεκάμηνο, αλλά μια υποχρέωση στην άκρη του δεν πρέπει να κόβεται
    // επειδή το μοντέλο μέτρησε τον μήνα με μισή διαφορά.
    const [ty, tm, td] = todayIso.split('-').map(Number)
    const limitIso = new Date(Date.UTC(ty, tm - 1 + 18, td)).toISOString().slice(0, 10)
    for (const s of suggestions) {
      if (!s || typeof s !== 'object') continue
      const d = typeof s.event_date === 'string' ? s.event_date.trim() : ''
      // Ο γύρος από `Date.UTC` κανονικοποιεί: η 31η Φεβρουαρίου γυρίζει 3
      // Μαρτίου και δεν ισούται με την είσοδο. Το `new Date('2027-02-31T…')`
      // θα ήταν Invalid Date και το `toISOString()` του πετάει RangeError,
      // δηλαδή 500 αντί για μία σβησμένη ημερομηνία.
      const [y, mo, day] = d.split('-').map(Number)
      const realDay = /^\d{4}-\d{2}-\d{2}$/.test(d)
        && new Date(Date.UTC(y, mo - 1, day)).toISOString().slice(0, 10) === d
      if (realDay && d >= todayIso && d <= limitIso) s.event_date = d
      else delete s.event_date
    }

    return json({ suggestions }, 200)
  } catch (err) {
    reportEdgeError('smart-suggestions', err)
    return json({ error: 'internal error' }, 500)
  }
})
