// Οι τροφοδοσίες στον έλεγχο υγείας: μήνυμα στη μετάβαση. Στέλνει και στην
// πρώτη μέτρηση που βρίσκει σπασμένη τροφοδοσία.
// Τρέξε: npx tsx supabase/functions/_shared/feedAlert.test.ts
import { FEEDS, feedEntry, previousFeeds, feedAlert } from './feedAlert.mjs'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) {
  if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) }
}

const [bank, market] = FEEDS
// Η ΣΕΙΡΑ ΜΕΤΡΑ: οι έλεγχοι παρακάτω διαβάζουν τις δύο πρώτες κατά θέση.
ok('πρώτη η τροφοδοσία τραπεζών, δεύτερη της αγοράς', FEEDS[0].path === 'feed:bank' && FEEDS[1].path === 'feed:market')
const reference = FEEDS.find(f => f.path === 'feed:reference')
ok('τα δεδομένα αναφοράς παρακολουθούνται', !!reference && reference.rpc === 'reference_data_health')
const NO_CREDIT = 'το τελευταίο πέρασμα απέτυχε: anthropic 400: Your credit balance is too low to access the Anthropic API.'

// ── Η γραμμή από το RPC ──────────────────────────────────────────────────────
ok('υγιής τροφοδοσία', feedEntry(bank, { ok: true, reason: 'εντάξει' }, null).ok)
ok('σπασμένη τροφοδοσία κρατά την αιτία', feedEntry(bank, { ok: false, reason: NO_CREDIT }, null).why.includes('credit balance'))
ok('σφάλμα ανάγνωσης μετρά ως σπασμένη', !feedEntry(bank, null, { message: 'permission denied' }).ok)
ok('κενή απάντηση μετρά ως σπασμένη', !feedEntry(market, null, null).ok)
ok('μεγάλη αιτία κόβεται', feedEntry(bank, { ok: false, reason: 'x'.repeat(900) }, null).why.length <= 301)

// ── Η προηγούμενη κατάσταση ─────────────────────────────────────────────────
const prev = previousFeeds([{ path: '/', ok: true }, { path: 'feed:bank', ok: false }, { path: 'feed:market', ok: true }])
ok('διαβάζει μόνο τις τροφοδοσίες', prev.size === 2 && prev.get('feed:bank') === false && prev.get('feed:market') === true)
ok('παλιά γραμμή χωρίς τροφοδοσίες: τίποτα γνωστό', previousFeeds([{ path: '/', ok: true }]).size === 0)
ok('details που δεν είναι πίνακας: τίποτα γνωστό', previousFeeds(null).size === 0)

// ── Οι μεταβάσεις ───────────────────────────────────────────────────────────
const up = (f: typeof bank) => ({ path: f.path, ok: true, why: 'εντάξει' })
const down = (f: typeof bank, why = NO_CREDIT) => ({ path: f.path, ok: false, why })

ok('όλα υγιή, πρώτη φορά: σιωπή', feedAlert(new Map(), [up(bank), up(market)]) === null)
ok('σπασμένη στην πρώτη μέτρηση: στέλνει', feedAlert(new Map(), [down(bank), up(market)]) !== null)
ok('έμεινε σπασμένη: σιωπή', feedAlert(new Map([['feed:bank', false]]), [down(bank)]) === null)
ok('έμεινε υγιής: σιωπή', feedAlert(new Map([['feed:bank', true]]), [up(bank)]) === null)

const broke = feedAlert(new Map([['feed:bank', true], ['feed:market', true]]), [down(bank), up(market)])
ok('υγιής → σπασμένη: στέλνει', broke !== null)
ok('το θέμα ονομάζει την τροφοδοσία', /Επιτόκια τραπεζών/.test(broke?.subject ?? ''))
ok('χωρίς υπόλοιπο: λέει τι να κάνει', (broke?.lines ?? []).some(l => /Billing/.test(l)))

const other = feedAlert(new Map([['feed:market', true]]), [down(market, 'σιωπή 40 ωρών')])
ok('άλλη αιτία: χωρίς οδηγία για υπόλοιπο', !(other?.lines ?? []).some(l => /Billing/.test(l)))

const healed = feedAlert(new Map([['feed:bank', false]]), [up(bank)])
ok('σπασμένη → υγιής: στέλνει', /δουλεύει ξανά/.test(healed?.subject ?? ''))

// ── Τα δεδομένα αναφοράς: δική τους φράση, όχι των τιμών ─────────────────────
const LAST = /τελευταίες επιβεβαιωμένες τιμές/
const refAlert = reference ? feedAlert(new Map(), [down(reference, 'ζωντανά προγράμματα χωρίς προθεσμία ή επαλήθευση 60 ημερών: x')]) : null
ok('αναφορά σπασμένη: στέλνει', refAlert !== null)
ok('το θέμα ονομάζει την καρτέλα Δάνεια', /Προγράμματα της καρτέλας Δάνεια/.test(refAlert?.subject ?? ''))
ok('λέει πώς κλείνει η γραμμή', (refAlert?.lines ?? []).some(l => l.includes('status = ended')))
ok('δεν λέει ότι δείχνονται «επιβεβαιωμένες τιμές»', !(refAlert?.lines ?? []).some(l => LAST.test(l)))

const both = feedAlert(new Map(), [down(bank, 'σιωπή'), down(market, 'σιωπή')])
ok('τράπεζες και αγορά σπασμένες: η φράση μία φορά', (both?.lines ?? []).filter(l => LAST.test(l)).length === 1)
const bankOnly = feedAlert(new Map(), [down(bank, 'σιωπή')])
ok('μόνο τράπεζες σπασμένες: η φράση μία φορά', (bankOnly?.lines ?? []).filter(l => LAST.test(l)).length === 1)

// ── Αποτυχία ανάγνωσης: δεν στέλνει τον χειριστή να αλλάξει δεδομένα ────────
// Οι συναρτήσεις άκρου ανεβαίνουν πριν από το `supabase db push`· αν αυτό
// αργήσει ή αποτύχει, το RPC λείπει και κανένα πρόγραμμα δεν έχει λήξει.
const MISSING = { message: 'Could not find the function public.reference_data_health without parameters in the schema cache' }
const refUnread = reference ? feedAlert(new Map(), [feedEntry(reference, null, MISSING)]) : null
ok('αναφορά αδιάβαστη: στέλνει', refUnread !== null)
ok('αδιάβαστη: δεν λέει να κλείσει γραμμή', !(refUnread?.lines ?? []).some(l => l.includes('status = ended')))
ok('αδιάβαστη: δεν λέει ότι το πρόγραμμα φαίνεται ενεργό', !(refUnread?.lines ?? []).some(l => /ως ενεργό/.test(l)))
ok('αδιάβαστη: λέει να ελεγχθεί η μετανάστευση', (refUnread?.lines ?? []).some(l => /supabase db push/.test(l)))
const bankUnread = feedAlert(new Map(), [feedEntry(bank, null, { message: 'permission denied' })])
ok('τράπεζες αδιάβαστες: κρατά τις επιβεβαιωμένες τιμές', (bankUnread?.lines ?? []).some(l => LAST.test(l)))
ok('και λέει να ελεγχθεί η μετανάστευση', (bankUnread?.lines ?? []).some(l => /supabase db push/.test(l)))
const emptyRow = reference ? feedAlert(new Map(), [feedEntry(reference, null, null)]) : null
ok('κενή απάντηση: ίδια μεταχείριση', !(emptyRow?.lines ?? []).some(l => l.includes('status = ended')))

const all = [broke, other, healed, refAlert, refUnread, bankUnread].flatMap(a => a ? [a.subject, ...a.lines] : []).join('\n')
ok('κανένα κόμμα πριν από «και»', !/, κ(αι|ι) /.test(all))

console.log(`\nfeedAlert: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
