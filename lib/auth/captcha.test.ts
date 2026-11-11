// npx tsx lib/auth/captcha.test.ts
//
// Ο έλεγχος κατά των bots ανοίγει ΜΟΝΟ με κλειδί. Χωρίς κλειδί οι φόρμες του
// λογαριασμού στέλνουν ακριβώς ό,τι έστελναν: κανένα `captchaToken`, καμία
// αναμονή, κανένα σενάριο τρίτου. Με κλειδί, χωρίς διακριτικό η υποβολή σταματά.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { captchaEnabled, captchaOptions, captchaFailedMessage, captchaBlockedMessage, waitForToken, TURNSTILE_SCRIPT } from './captcha'

// ── ΚΑΘΕ ΚΛΗΣΗ ΠΟΥ ΕΛΕΓΧΕΙ Η SUPABASE, ΟΧΙ ΤΡΕΙΣ ΓΝΩΣΤΕΣ ─────────────────────
// Με το Captcha ανοιχτό στη Supabase, το GoTrue ζητά διακριτικό στην εγγραφή,
// στη σύνδεση με κωδικό, στο OTP, στην ανώνυμη σύνδεση, στην επαναφορά κωδικού
// και στην ΕΠΑΝΑΠΟΣΤΟΛΗ. Οι δύο επαναποστολές (σύνδεση, εγγραφή) είχαν
// ξεχαστεί στην πρώτη έκδοση: με το κλειδί ενεργό θα απορρίπτονταν πάντα.
// Η σάρωση πιάνει και κάθε ΝΕΑ τέτοια κλήση που θα γραφτεί χωρίς διακριτικό.
const GUARDED = /\.auth\.(signUp|signInWithPassword|signInWithOtp|signInAnonymously|resetPasswordForEmail|resend)\(/g

/** Το κείμενο των ορισμάτων μιας κλήσης, ως την παρένθεση που την κλείνει. */
function argsAt(src: string, open: number): string {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')' && --depth === 0) return src.slice(open, i + 1)
  }
  return src.slice(open)
}

/** Οι κλήσεις του `src` που δεν στέλνουν διακριτικό. */
export function callsWithoutToken(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(GUARDED)) {
    const args = argsAt(src, (m.index ?? 0) + m[0].length - 1)
    if (!args.includes('captchaOptions(')) out.push(m[1])
  }
  return out
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sourceFiles(p, acc)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(p)
  }
  return acc
}

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

async function run() {
  ok('χωρίς κλειδί: ανενεργό', !captchaEnabled(''))
  ok('με κλειδί: ενεργό', captchaEnabled('0x4AAA'))
  ok('χωρίς διακριτικό: καμία επιλογή στην κλήση', JSON.stringify(captchaOptions(undefined)) === '{}')
  ok('με διακριτικό: captchaToken', captchaOptions('t')?.captchaToken === 't')

  ok('ανενεργό: undefined χωρίς αναμονή', (await waitForToken(() => null, false, 50)) === undefined)
  ok('ενεργό και έτοιμο: το διακριτικό', (await waitForToken(() => 'tok', true, 50)) === 'tok')
  ok('ενεργό χωρίς διακριτικό: null μετά τη λήξη', (await waitForToken(() => null, true, 30, 10)) === null)
  let n = 0
  ok('ενεργό, έρχεται αργότερα: το διακριτικό', (await waitForToken(() => (++n > 3 ? 'late' : null), true, 1000, 5)) === 'late')

  ok('μήνυμα στα ελληνικά χωρίς «bot»', captchaFailedMessage('el').startsWith('Ο έλεγχος ασφαλείας') && !/bot/i.test(captchaFailedMessage('el')))
  ok('μήνυμα στα αγγλικά', captchaFailedMessage('en').startsWith('The security check'))
  ok('ρητή απόδοση του σεναρίου', TURNSTILE_SCRIPT.startsWith('https://challenges.cloudflare.com/') && TURNSTILE_SCRIPT.includes('render=explicit'))

  ok('δεν φόρτωσε: λέει ποια διεύθυνση να επιτραπεί', captchaBlockedMessage('el') === 'Ο έλεγχος ασφαλείας δεν φόρτωσε. Έλεγξε τη σύνδεσή σου ή, αν έχεις επέκταση αποκλεισμού, επίτρεψε το challenges.cloudflare.com.')
  // Ακριβής σύγκριση, όχι `includes` με όνομα host (CodeQL: incomplete URL substring sanitization).
  ok('δεν φόρτωσε, στα αγγλικά: σύνδεση και διεύθυνση', captchaBlockedMessage('en') === "The security check didn't load. Check your connection or, if you use a blocking extension, allow challenges.cloudflare.com.")
  ok('δεν φόρτωσε: η αναμονή σταματά αμέσως', await (async () => { const t0 = Date.now(); const r = await waitForToken(() => null, true, 5000, 10, () => true); return r === null && Date.now() - t0 < 1000 })())

  // Σάρωση όλου του κώδικα: καμία κλήση που ελέγχει η Supabase χωρίς διακριτικό.
  const files = ['app', 'components', 'lib'].flatMap(d => sourceFiles(d))
  let calls = 0
  const offenders: string[] = []
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    calls += [...src.matchAll(GUARDED)].length
    for (const m of callsWithoutToken(src)) offenders.push(`${f}: ${m}`)
  }
  ok(`κλήσεις Auth χωρίς captchaOptions: ${offenders.join(' · ') || 'καμία'}`, offenders.length === 0)
  // signUp, signInWithPassword, resetPasswordForEmail και δύο resend.
  ok(`βρέθηκαν όλες οι κλήσεις (${calls})`, calls >= 5)
  for (const [f, n] of [['app/login/page.tsx', 2], ['app/signup/page.tsx', 2], ['app/reset-password/page.tsx', 1]] as const) {
    const src = readFileSync(f, 'utf8')
    ok(`${f}: ${n} κλήσεις με διακριτικό`, [...src.matchAll(GUARDED)].length === n && callsWithoutToken(src).length === 0)
    ok(`${f}: χωρίς διακριτικό σταματά, όσες φορές καλεί`, (src.match(/captchaToken === null/g) ?? []).length === n)
    ok(`${f}: νέος έλεγχος μετά από κάθε κλήση`, (src.match(/captcha\.reset\(\)/g) ?? []).length === n)
  }
  ok('signup: το πλαίσιο υπάρχει και στην οθόνη «Άνοιξε το email σου»', (readFileSync('app/signup/page.tsx', 'utf8').match(/\{captcha\.slot\}/g) ?? []).length === 2)

  // ΜΕΤΑΛΛΑΞΕΙΣ: η σάρωση πρέπει να κοκκινίζει σε νέα κλήση χωρίς διακριτικό.
  ok('μετάλλαξη: resend χωρίς διακριτικό πιάνεται', callsWithoutToken("await s.auth.resend({ type: 'signup', email, options: { emailRedirectTo: x } })").join() === 'resend')
  ok('μετάλλαξη: signInWithOtp χωρίς διακριτικό πιάνεται', callsWithoutToken('s.auth.signInWithOtp({ email })').join() === 'signInWithOtp')
  ok('μετάλλαξη: φωλιασμένες παρενθέσεις δεν κρύβουν την έλλειψη', callsWithoutToken('s.auth.signUp({ email: f(a), options: { data: g(b) } }); x(captchaOptions(t))').join() === 'signUp')
  ok('μετάλλαξη: με διακριτικό περνά', callsWithoutToken('s.auth.resend({ type, email, options: { ...captchaOptions(t) } })').length === 0)

  // Κάθε κλήση της Auth από φόρμα περνά το διακριτικό και σταματά χωρίς αυτό.
  const sites: [string, RegExp][] = [
    ['app/signup/page.tsx', /signUp\(\{[\s\S]*?\.\.\.captchaOptions\(captchaToken\)/],
    ['app/login/page.tsx', /signInWithPassword\(\{ email, password, options: captchaOptions\(captchaToken\) \}\)/],
    ['app/reset-password/page.tsx', /resetPasswordForEmail\(email\.trim\(\), \{ redirectTo, \.\.\.captchaOptions\(captchaToken\) \}\)/],
  ]
  for (const [f, re] of sites) {
    const src = readFileSync(f, 'utf8')
    ok(`${f}: το διακριτικό φτάνει στην Auth`, re.test(src))
  }

  // ΧΩΡΙΣ ΚΛΕΙΔΙ Ο ΚΩΔΙΚΑΣ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟ ΠΑΚΕΤΟ (perf:budget του /signup, 11/11/2026).
  // Δύο προϋποθέσεις: η μεταβλητή ορίζεται ΠΑΝΤΑ στο next.config (αλλιώς, όταν
  // λείπει, μένει `process.env.X` και η συνθήκη δεν διπλώνεται) και η επιλογή
  // του hook γίνεται με τη γυμνή συνθήκη, όχι μέσα από συνάρτηση.
  const cfg = readFileSync('next.config.ts', 'utf8')
  ok('next.config: η μεταβλητή ορίζεται πάντα, κενή χωρίς κλειδί', /NEXT_PUBLIC_TURNSTILE_SITE_KEY: \(process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY \?\? ""\)\.trim\(\)/.test(cfg))
  const hook = readFileSync('app/useCaptcha.tsx', 'utf8')
  ok('useCaptcha: επιλογή στο build με γυμνή συνθήκη', /process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY \? useCaptchaLive : useCaptchaOff/.test(hook))
  ok('useCaptcha: το σβηστό δεν αποδίδει τίποτα', /slot: null, token: async \(\) => undefined/.test(hook))

  // Η CSP ανοίγει στη Cloudflare ΜΟΝΟ με κλειδί. (κυριολεκτικό-πρότυπο: ψάχνουμε το κείμενο της πηγής)
  const proxy = readFileSync('proxy.ts', 'utf8')
  ok('CSP: Turnstile μόνο με κλειδί', /TURNSTILE_ORIGIN = \(process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY/.test(proxy)
    && /'strict-dynamic'\$\{TURNSTILE_ORIGIN\}`/.test(proxy) && /frame-src 'self' https:\/\/\*\.supabase\.co\$\{TURNSTILE_ORIGIN\}`/.test(proxy))
}

run().then(() => {
  console.log(fail ? `✗ auth/captcha: ${fail} απέτυχαν από ${pass + fail}` : `✓ auth/captcha: ${pass} έλεγχοι πέρασαν`)
  if (fail) process.exit(1)
})
