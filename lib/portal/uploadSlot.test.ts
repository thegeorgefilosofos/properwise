// npx tsx lib/portal/uploadSlot.test.ts
//
// ΤΙ ΦΥΛΑΓΕΤΑΙ. Η διαδρομή που υπογράφει ανεβάσματα για την πύλη είναι ο
// ΜΟΝΟΣ δρόμος προς το ιδιωτικό bucket των φωτογραφιών βλάβης. Αν υπογράψει
// πριν ρωτήσει τη βάση, ο κωδικός και το ταβάνι των είκοσι την ώρα δεν
// ισχύουν. Αν δεχτεί κουπόνι με «/», διαλέγει ο καλών φάκελο. Αν η διαδρομή
// του αρχείου βγει έξω από τον φάκελο του κουπονιού, ο ιδιοκτήτης δεν τη
// διαβάζει ποτέ. Ψεύτικος πελάτης: καταγράφει ΤΙ ζητήθηκε και με ΠΟΙΑ σειρά.
import { grantPortalUpload, photoPath, readUploadAsk, PHOTO_BUCKET, PHOTO_MAX_BYTES, type SlotClient, type UploadAsk } from './uploadSlot'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
const good = { token: TOKEN, pin: '4321', name: 'διαρροή μπάνιο.jpg', type: 'image/jpeg', size: 2_000_000 }

// ── 1. ΤΟ ΣΩΜΑ ΤΟΥ ΑΙΤΗΜΑΤΟΣ ────────────────────────────────────────────────
const isErr = (x: unknown) => !!x && typeof x === 'object' && 'error' in x
ok('δεκτό αίτημα', !isErr(readUploadAsk(good)))
ok('χωρίς σώμα: άρνηση', isErr(readUploadAsk(null)))
ok('κουπόνι με «/»: άρνηση', isErr(readUploadAsk({ ...good, token: `${TOKEN}/../allo` })))
ok('κουπόνι πολύ κοντό: άρνηση', isErr(readUploadAsk({ ...good, token: 'abc' })))
ok('PDF: άρνηση', isErr(readUploadAsk({ ...good, type: 'application/pdf' })))
ok('SVG: άρνηση (δεν είναι στα όρια του bucket)', isErr(readUploadAsk({ ...good, type: 'image/svg+xml' })))
ok('πάνω από 10 MB: άρνηση', isErr(readUploadAsk({ ...good, size: PHOTO_MAX_BYTES + 1 })))
ok('ακριβώς 10 MB: δεκτό', !isErr(readUploadAsk({ ...good, size: PHOTO_MAX_BYTES })))
ok('μέγεθος μηδέν ή κείμενο: άρνηση',
  isErr(readUploadAsk({ ...good, size: 0 })) && isErr(readUploadAsk({ ...good, size: '5' })))
{
  const a = readUploadAsk({ ...good, pin: '' }) as UploadAsk
  ok('κενός κωδικός γίνεται null', a.pin === null)
  const b = readUploadAsk({ ...good, pin: undefined }) as UploadAsk
  ok('χωρίς κωδικό: null', b.pin === null)
  const c = readUploadAsk({ ...good, type: 'IMAGE/PNG' }) as UploadAsk
  ok('ο τύπος διαβάζεται σε πεζά', c.type === 'image/png')
}

// ── 2. Η ΔΙΑΔΡΟΜΗ ΤΟΥ ΑΡΧΕΙΟΥ ───────────────────────────────────────────────
{
  const p = photoPath(TOKEN, '../../ξένος φάκελος/x.jpg', 1700000000000, 'r4nd0m00')
  ok('ο πρώτος φάκελος είναι το κουπόνι', p.split('/')[0] === TOKEN)
  ok('ένα μόνο επίπεδο κάτω από το κουπόνι', p.split('/').length === 2)
  ok('καμία «..» στη διαδρομή', !p.includes('..'))
  ok('χρόνος και τυχαίο κομμάτι στο όνομα', p.includes('1700000000000_r4nd0m00_'))
  ok('όνομα χωρίς χαρακτήρες: «photo»', photoPath(TOKEN, '///', 1, 'r').endsWith('_photo'))
}

// ── 3. ΠΡΩΤΑ Η ΒΑΣΗ, ΜΕΤΑ Η ΥΠΟΓΡΑΦΗ ───────────────────────────────────────
type Slot = { data: unknown; error: { code?: string; message: string } | null }
function fake(slot: Slot, sign: 'ok' | 'fail' = 'ok') {
  const log: string[] = []
  const rpcArgs: Record<string, unknown>[] = []
  const signed: { bucket: string; path: string }[] = []
  const client: SlotClient = {
    rpc(fn, args) { log.push('rpc:' + fn); rpcArgs.push(args); return Promise.resolve(slot) },
    storage: {
      from(bucket) {
        return {
          async createSignedUploadUrl(path: string) {
            log.push('sign'); signed.push({ bucket, path })
            return sign === 'ok'
              ? { data: { signedUrl: `https://x.supabase.co/sign/${path}?token=T`, token: 'T', path }, error: null }
              : { data: null, error: { message: 'storage down' } }
          },
        }
      },
    },
  }
  return { client, log, rpcArgs, signed }
}
const ask = readUploadAsk(good) as UploadAsk

const main = async () => {
  {
    const f = fake({ data: { ok: true }, error: null })
    const r = await grantPortalUpload(f.client, ask, 1700000000000, 'abcd1234')
    ok('δεκτό: 200', r.status === 200)
    ok('ρωτά την portal_upload_slot πριν την υπογραφή', f.log.join(',') === 'rpc:portal_upload_slot,sign')
    ok('στέλνει κουπόνι και κωδικό', f.rpcArgs[0].p_token === TOKEN && f.rpcArgs[0].p_pin === '4321')
    ok('υπογράφει στο maintenance-photos', f.signed[0]?.bucket === PHOTO_BUCKET && PHOTO_BUCKET === 'maintenance-photos')
    ok('η διαδρομή είναι μέσα στον φάκελο του κουπονιού', f.signed[0]?.path.startsWith(TOKEN + '/'))
    ok('επιστρέφει διαδρομή και κουπόνι ανεβάσματος',
      r.body.path === f.signed[0]?.path && r.body.uploadToken === 'T')
  }
  for (const [reason, status] of [['pin', 403], ['locked', 429], ['rate_limited', 429], ['notfound', 404]] as const) {
    const f = fake({ data: { ok: false, reason }, error: null })
    const r = await grantPortalUpload(f.client, ask, 1, 'r')
    ok(`${reason}: ${status}`, r.status === status)
    ok(`${reason}: ο λόγος φτάνει στη σελίδα`, r.body.reason === reason)
    ok(`${reason}: καμία υπογραφή`, f.signed.length === 0)
  }
  {
    const f = fake({ data: { ok: false, reason: 'kati-allo' }, error: null })
    const r = await grantPortalUpload(f.client, ask, 1, 'r')
    ok('άγνωστος λόγος: 404 και καμία υπογραφή', r.status === 404 && f.signed.length === 0)
  }
  {
    const f = fake({ data: null, error: null })
    const r = await grantPortalUpload(f.client, ask, 1, 'r')
    ok('κενή απάντηση της βάσης: καμία υπογραφή', r.status !== 200 && f.signed.length === 0)
  }
  {
    // Η μετανάστευση δεν έχει τρέξει ακόμη: η συνάρτηση δεν υπάρχει.
    const f = fake({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
    const r = await grantPortalUpload(f.client, ask, 1, 'r')
    ok('η βάση δεν απάντησε: 503', r.status === 503)
    ok('η βάση δεν απάντησε: καμία υπογραφή', f.signed.length === 0)
  }
  {
    const f = fake({ data: { ok: true }, error: null }, 'fail')
    const r = await grantPortalUpload(f.client, ask, 1, 'r')
    ok('η υπογραφή απέτυχε: 502 χωρίς κουπόνι ανεβάσματος', r.status === 502 && !('uploadToken' in r.body))
  }

  console.log(fail === 0 ? `✓ portal upload slot: ${pass} έλεγχοι πέρασαν` : `✗ portal upload slot: ${fail} απέτυχαν από ${pass + fail}`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
