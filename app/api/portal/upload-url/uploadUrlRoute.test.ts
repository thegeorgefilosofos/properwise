// npx tsx app/api/portal/upload-url/uploadUrlRoute.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΥΛΗ ΓΡΑΦΕΙ ΜΟΝΟ ΜΕ ΤΟΝ ΚΩΔΙΚΟ ΚΑΙ ΟΙ ΦΩΤΟΓΡΑΦΙΕΣ ΜΟΝΟ ΜΕΣΑ ΑΠΟ ΤΗ ΔΙΑΔΡΟΜΗ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΕΛΕΓΧΕΤΑΙ ΚΕΙΜΕΝΟ ΚΑΙ ΟΧΙ ΣΥΜΠΕΡΙΦΟΡΑ. Η συμπεριφορά της άδειας
// (σειρά βάσης και υπογραφής, λόγοι άρνησης, διαδρομή αρχείου) δοκιμάζεται με
// ψεύτικο πελάτη στο lib/portal/uploadSlot.test.ts· η βάση δοκιμάζεται σε
// πραγματικό Postgres από το scripts/db/rls-probe.sql. Εδώ φυλάγεται η
// ΣΥΡΡΑΦΗ: ότι η διαδρομή ελέγχει προέλευση και σώμα πριν αγγίξει το κλειδί
// υπηρεσίας, ότι η σελίδα δεν ξαναγράφει απευθείας στο bucket και ότι οι δύο
// εγγραφές της στέλνουν τον κωδικό. Ενα από αυτά να λείψει και ο κωδικός
// της πύλης ξαναγίνεται διακοσμητικός για τις εγγραφές.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..', '..')
const ROUTE = readFileSync(join(HERE, 'route.ts'), 'utf8')
const PAGE = readFileSync(join(ROOT, 'app', 'portal', '[token]', 'page.tsx'), 'utf8')
const GUARD = readFileSync(join(ROOT, 'scripts', 'guard-api-auth.mjs'), 'utf8')
const MIGRATION = readFileSync(
  join(ROOT, 'supabase', 'migrations', '20261003110000_oi_eggrafes_tis_pylis_zitoun_ton_kodiko.sql'), 'utf8')

// ── 1. Η ΔΙΑΔΡΟΜΗ: ΠΡΟΕΛΕΥΣΗ, ΣΩΜΑ, ΚΛΕΙΔΙ, ΑΔΕΙΑ, ΜΕ ΑΥΤΗ ΤΗ ΣΕΙΡΑ ────────
const iOrigin = ROUTE.indexOf('sameOrigin(request.headers)')
const iAsk = ROUTE.indexOf('readUploadAsk(')
const iKey = ROUTE.indexOf('createServiceClient()')
const iGrant = ROUTE.indexOf('grantPortalUpload(')
ok('ελέγχει προέλευση', iOrigin >= 0)
ok('διαβάζει το σώμα με το readUploadAsk', iAsk >= 0)
ok('φτιάχνει πελάτη υπηρεσίας', iKey >= 0)
ok('ζητά άδεια με το grantPortalUpload', iGrant >= 0)
ok('προέλευση πριν από όλα', iOrigin < iAsk && iOrigin < iKey)
ok('σώμα πριν το κλειδί υπηρεσίας', iAsk < iKey)
ok('το κλειδί υπηρεσίας μόνο για την άδεια', iKey < iGrant)
ok('μόνο POST', /export async function POST\(request: Request\)/.test(ROUTE) && !/export async function (GET|PUT|PATCH|DELETE)/.test(ROUTE))
ok('η διαδρομή δεν υπογράφει μόνη της, χωρίς τη βάση', !ROUTE.includes('createSignedUploadUrl'))
ok('δεν είναι αρχείο πελάτη', !/^\s*['"]use client['"]/m.test(ROUTE.slice(0, 400)))
ok('ο guard-api-auth αναγνωρίζει την πύλη ως ταυτότητα', GUARD.includes("needle: 'grantPortalUpload('"))

// ── 2. Η ΣΕΛΙΔΑ: ΚΑΜΙΑ ΑΠΕΥΘΕΙΑΣ ΕΓΓΡΑΦΗ ΣΤΟ BUCKET ───────────────────────
ok('η σελίδα δεν ανεβάζει πια απευθείας στο bucket', !/\.upload\(/.test(PAGE))
ok('ζητά άδεια από τη διαδρομή', PAGE.includes("fetch('/api/portal/upload-url'"))
ok('ανεβάζει στη διεύθυνση που υπογράφηκε', PAGE.includes('uploadToSignedUrl('))
ok('στέλνει τον κωδικό και στη διαδρομή', /JSON\.stringify\(\{\s*token,\s*pin: okPin/.test(PAGE))

// ── 3. Η ΣΕΛΙΔΑ: ΟΙ ΔΥΟ ΕΓΓΡΑΦΕΣ ΣΤΕΛΝΟΥΝ ΤΟΝ ΚΩΔΙΚΟ ──────────────────────
for (const fn of ['declare_rent_payment', 'submit_maintenance_request']) {
  ok(`${fn}: όχι απευθείας supabase.rpc, μόνο μέσω callPortalWrite`, !PAGE.includes(`rpc('${fn}'`))
  const at = PAGE.indexOf(`callPortalWrite(rpc, '${fn}'`)
  ok(`${fn}: καλείται με callPortalWrite`, at >= 0)
  const call = at >= 0 ? PAGE.slice(at, PAGE.indexOf(');', at)) : ''
  ok(`${fn}: με τον κωδικό που δέχτηκε η βάση`, /okPin\s*$/.test(call.trim()))
}
ok('ο κωδικός κρατιέται μόλις τον δεχτεί η βάση', /applyData\(d\);\s*setOkPin\(pin\);/.test(PAGE))
ok('ο κωδικός δεν πάει σε αποθήκευση του περιηγητή', !/(localStorage|sessionStorage)[\s\S]{0,80}(pin|Pin)/.test(PAGE))

// ── 4. Η ΜΕΤΑΝΑΣΤΕΥΣΗ ────────────────────────────────────────────────────
ok('σβήνει την παλιά δήλωση χωρίς κωδικό',
  /drop function if exists public\.declare_rent_payment\(text, uuid, text\);/.test(MIGRATION))
ok('σβήνει το παλιό αίτημα χωρίς κωδικό',
  /drop function if exists public\.submit_maintenance_request\(text, text, text, text, jsonb\);/.test(MIGRATION))
ok('σβήνει την ανώνυμη εισαγωγή στο bucket', /drop policy if exists "maint_photos_insert" on storage\.objects;/.test(MIGRATION))
ok('δεν ξαναφτιάχνει πολιτική εισαγωγής', !/create policy "maint_photos_insert"/.test(MIGRATION))
ok('η άδεια φωτογραφίας κλείνει στον πελάτη',
  /revoke execute on function public\.portal_upload_slot\(text, text\) from public, anon, authenticated;/.test(MIGRATION))
ok('ο έλεγχος κωδικού κλείνει στον πελάτη',
  /revoke execute on function public\.portal_pin_gate\(text, text\) from public, anon, authenticated;/.test(MIGRATION))
ok('οι νέες εγγραφές ανοιχτές στον ανώνυμο',
  /grant\s+execute on function public\.declare_rent_payment\(text, uuid, text, text\) to anon, authenticated, service_role;/.test(MIGRATION)
  && /grant\s+execute on function public\.submit_maintenance_request\(text, text, text, text, jsonb, text\) to anon, authenticated, service_role;/.test(MIGRATION))
ok('είκοσι φωτογραφίες την ώρα', /allow_public_submit\('photo', p_token, 20, interval '1 hour'\)/.test(MIGRATION))
ok('δέκα δηλώσεις την ώρα', /allow_public_submit\('declare', p_token, 10, interval '1 hour'\)/.test(MIGRATION))

console.log(fail === 0 ? `✓ portal upload route: ${pass} έλεγχοι πέρασαν` : `✗ portal upload route: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
