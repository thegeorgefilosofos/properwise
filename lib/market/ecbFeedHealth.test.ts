// npx tsx lib/market/ecbFeedHealth.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΥΓΕΙΑ ΤΗΣ ΤΡΟΦΟΔΟΣΙΑΣ ΞΕΡΕΙ ΤΟΝ ΙΔΙΟ ΚΑΤΑΛΟΓΟ ΜΕ ΤΗΝ ΤΡΟΦΟΔΟΣΙΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ (18/10/2026). Η `market_feed_health()` μετρούσε τα κλειδιά της
// ταυτότητας και ζητούσε οκτώ. Η τροφοδοσία κρατά ό,τι δεν ήρθε, άρα τα
// κλειδιά δεν λιγοστεύουν ποτέ· και ο κατάλογος είχε πια δέκα σειρές, με τις
// δύο νέες να μην έχουν έρθει ποτέ. Η παραγωγή έλεγε «εντάξει, 8 από 8».
//
// Η βάση δεν μπορεί να εισαγάγει το `ECB_SERIES`, οπότε γράφει τα δέκα κλειδιά
// δίπλα στη συνάρτηση. Αυτό το αρχείο τα δένει: σειρά που μπαίνει ή βγαίνει
// από τον κατάλογο χωρίς μετανάστευση κοκκινίζει εδώ. Η συμπεριφορά δοκιμάζεται
// σε αληθινή Postgres, με γραμμές στο σχήμα της παραγωγής, από το
// scripts/db/market-feed-probe.sql μέσα στο scripts/db-replay.sh.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs'
import { ECB_SERIES } from '@/lib/market/ecb'

let pass = 0; const fail: string[] = []
const eq = (what: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return }
  fail.push(`${what}\n    περίμενα: ${JSON.stringify(want)}\n    πήρα:     ${JSON.stringify(got)}`)
}

const dir = 'supabase/migrations'
const head = 'create or replace function public.market_feed_health()'
const file = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
  .find(f => readFileSync(`${dir}/${f}`, 'utf8').includes(head))
if (!file) { console.error('✗ καμία μετανάστευση δεν ορίζει τη market_feed_health'); process.exit(1) }
const sql = readFileSync(`${dir}/${file}`, 'utf8')
const from = sql.indexOf(head)
// Το σώμα χωρίς τα σχόλια SQL: σχόλιο που περιγράφει το παλιό λάθος δεν είναι κώδικας.
const body = sql.slice(from, sql.indexOf('$$;', from) + 3).replace(/--.*$/gm, '')

const listed = (/unnest\(array\[([\s\S]*?)\]::text\[\]\)/.exec(body)?.[1] ?? '')
  .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
eq(`${file}: τα κλειδιά της βάσης είναι ο κατάλογος της τροφοδοσίας`, listed, ECB_SERIES.map(s => s.key))
eq('κανένα κλειδί δύο φορές', new Set(listed).size, listed.length)
eq('δεν μετρά πια σκέτα κλειδιά της ταυτότητας', /jsonb_object_keys/.test(body), false)
eq('ούτε ζητά σταθερό πλήθος οκτώ', /present\s*<\s*8|,\s*8\s*$/m.test(body), false)
eq('κρίνει πότε ήρθε κάθε τιμή', /'fetchedAt'/.test(body), true)
eq('με ανοχή μίας χαμένης μέρας', /interval '36 hours'/.test(body), true)
eq('και ονομάζει ό,τι λείπει', /λείπουν από την τροφοδοσία/.test(body), true)

if (fail.length) { console.error(`\n✗ υγεία τροφοδοσίας: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1) }
console.log(`✓ υγεία τροφοδοσίας: ${pass} έλεγχοι πέρασαν (${file})`)
