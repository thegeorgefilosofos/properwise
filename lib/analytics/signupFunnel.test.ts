// npx tsx lib/analytics/signupFunnel.test.ts
//
// ΤΟ ΧΩΝΙ ΤΗΣ ΕΓΓΡΑΦΗΣ. Δύο πράγματα κρίνονται εδώ: ότι η πηγή βγαίνει σωστά
// από στοιχεία που δεν ταυτοποιούν κανέναν και ότι οι κατάλογοι της εφαρμογής
// είναι ΑΚΡΙΒΩΣ οι κατάλογοι της βάσης. Βήμα που λείπει από τη βάση δεν
// μετριέται ποτέ και κανείς δεν το βλέπει, γιατί η συνάρτηση σωπαίνει.
import { readFileSync, readdirSync } from 'node:fs'
import { SIGNUP_STEPS, SIGNUP_SOURCES, signupSource, isMobileUa, landingQuery } from './signupFunnel'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.30.94'
const LI = 'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36 [LinkedInApp]/9.30.1'
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'
const HOST = 'properwise.gr'

// ── Η ΠΗΓΗ ──────────────────────────────────────────────────────────────────
ok('η εφαρμογή κερδίζει κάθε άλλο σήμα', signupSource(IG, '?utm_source=google', 'https://www.google.com/', HOST) === 'instagram')
ok('LinkedIn από την εφαρμογή του', signupSource(LI, '', '', HOST) === 'linkedin')
ok('utm_source των δικών μας συνδέσμων', signupSource(SAFARI, '?utm_source=instagram&utm_medium=bio', '', HOST) === 'instagram')
ok('utm_source άγνωστο: other, όχι ελεύθερο κείμενο', signupSource(SAFARI, '?utm_source=kati-allo', '', HOST) === 'other')
ok('YouTube από utm_source', signupSource(SAFARI, '?utm_source=youtube&utm_medium=shorts', '', HOST) === 'youtube')
ok('YouTube από referrer youtu.be', signupSource(SAFARI, '', 'https://youtu.be/abc', HOST) === 'youtube')
ok('referrer Google', signupSource(DESKTOP, '', 'https://www.google.com/', HOST) === 'google')
ok('referrer Bing: αναζήτηση', signupSource(DESKTOP, '', 'https://www.bing.com/search?q=x', HOST) === 'search')
ok('από την αρχική μας: internal', signupSource(DESKTOP, '', 'https://properwise.gr/paketa', HOST) === 'internal')
ok('και με www μπροστά', signupSource(DESKTOP, '', 'https://www.properwise.gr/', HOST) === 'internal')
ok('χωρίς referrer: direct', signupSource(DESKTOP, '', '', HOST) === 'direct')
ok('χαλασμένος referrer: other', signupSource(DESKTOP, '', 'όχι διεύθυνση', HOST) === 'other')
ok('άγνωστος τομέας: other', signupSource(DESKTOP, '', 'https://example.com/a', HOST) === 'other')
ok('η πηγή είναι πάντα λέξη του καταλόγου', [IG, LI, SAFARI, DESKTOP].every(ua =>
  ['', '?utm_source=x', '?utm_source=facebook'].every(q =>
    (SIGNUP_SOURCES as readonly string[]).includes(signupSource(ua, q, 'https://t.co/abc', HOST)))))

// ── Η ΠΡΩΤΗ ΕΠΑΦΗ ΤΗΣ ΦΟΡΤΩΣΗΣ ─────────────────────────────────────────────
// Ο σύνδεσμος του Short οδηγεί σε σελίδα εργαλείου, που οδηγεί στο /signup με
// ήπια πλοήγηση: εκεί η διεύθυνση δεν έχει utm και ο referrer μπορεί να λείπει.
ok('το utm της άφιξης, με κομμένο referrer', signupSource(SAFARI, '', '', HOST, '?utm_source=youtube&utm_medium=short&utm_campaign=x') === 'youtube')
ok('το utm της άφιξης, από υπολογιστή', signupSource(DESKTOP, '', '', HOST, '?utm_source=instagram') === 'instagram')
ok('το utm της τρέχουσας διεύθυνσης κερδίζει της άφιξης', signupSource(SAFARI, '?utm_source=linkedin', '', HOST, '?utm_source=youtube') === 'linkedin')
ok('το utm της άφιξης κερδίζει τον referrer', signupSource(DESKTOP, '', 'https://www.google.com/', HOST, '?utm_source=youtube') === 'youtube')
ok('η εφαρμογή κερδίζει και το utm της άφιξης', signupSource(IG, '', '', HOST, '?utm_source=youtube') === 'instagram')
ok('άγνωστο utm άφιξης: other, όχι ελεύθερο κείμενο', signupSource(SAFARI, '', '', HOST, '?utm_source=kati-allo') === 'other')
ok('κενή άφιξη: όλα όπως πριν', [IG, LI, SAFARI, DESKTOP].every(ua =>
  ['', '?utm_source=x', '?utm_source=youtube'].every(q =>
    ['', 'https://www.google.com/', 'https://properwise.gr/', 'όχι διεύθυνση'].every(r =>
      signupSource(ua, q, r, HOST, '') === signupSource(ua, q, r, HOST)))))
ok('με άφιξη, η πηγή είναι πάντα λέξη του καταλόγου', [IG, LI, SAFARI, DESKTOP].every(ua =>
  ['', '?utm_source=x', '?utm_source=%E2%9C%93', '?utm_source=youtube'].every(l =>
    (SIGNUP_SOURCES as readonly string[]).includes(signupSource(ua, '', 'https://t.co/abc', HOST, l)))))

// Η διεύθυνση άφιξης από την καταγραφή πλοήγησης. Οτιδήποτε λείπει ή σπάει: ''.
const perf = (entries: unknown) => ({ getEntriesByType: () => entries as PerformanceEntryList })
ok('η άφιξη από την καταγραφή πλοήγησης',
  landingQuery(perf([{ name: 'https://properwise.gr/kathari-apodosi?utm_source=youtube&utm_campaign=c' }])).includes('utm_source=youtube'))
ok('χωρίς καταγραφή: κενό', landingQuery(perf([])) === '')
ok('χωρίς performance: κενό', landingQuery(undefined) === '')
ok('αν σπάσει: κενό', landingQuery({ getEntriesByType: () => { throw new Error('όχι') } }) === '')
ok('κενό όνομα: κενό', landingQuery(perf([{ name: '' }])) === '')

// ΤΟ ΟΡΙΟ ΤΗΣ ΙΔΙΩΤΙΚΟΤΗΤΑΣ (/privacy: «κανένας αριθμός δεν μπορεί να
// συνδεθεί με πρόσωπο»). Η πηγή δεν κουβαλά καμπάνια και δεν αποθηκεύεται.
const funnelSrc = readFileSync('lib/analytics/signupFunnel.ts', 'utf8')
ok('το χωνί δεν διαβάζει καμπάνια ούτε αποθηκεύει στη συσκευή',
  !['utm_campaign', 'localStorage', 'sessionStorage', 'document.cookie'].some(w => funnelSrc.includes(w)))

// ── Η ΕΓΓΡΑΦΗ ΜΕ GOOGLE ΜΕΤΡΑ ΣΤΟΝ ΠΑΡΟΝΟΜΑΣΤΗ ────────────────────────────
// Η Google γυρίζει στο /signup, όχι στο /auth/callback: εκεί πρέπει να γραφτεί.
const page = readFileSync('app/signup/page.tsx', 'utf8')
const helper = /const countSignup = [\s\S]*?\n\]\)/.exec(page)?.[0] ?? ''
ok('το signed_up γράφεται από τη σελίδα εγγραφής', /PRODUCT_EVENTS\.signed_up\s*\)/.test(helper))
ok('χωρίς φορτίο: ούτε πηγή ούτε καμπάνια', !/signed_up\s*,/.test(page))
ok('με όριο χρόνου, ώστε να μην καθυστερεί την άφιξη', /Promise\.race/.test(helper) && /setTimeout/.test(helper))
const oauth1 = page.slice(page.indexOf("if (oauth === '1')"), page.indexOf('async function acceptOauthConsent'))
const accept = page.slice(page.indexOf('async function acceptOauthConsent'), page.indexOf('async function declineOauthConsent'))
const gated = (block: string, who: string) => new RegExp(`if \\(${who}[^\n]*created_at[^\n]*FRESH_MS\\) await countSignup\\(`).test(block)
ok('μετρά στον κλάδο oauth=1, μόνο για νέο λογαριασμό', gated(oauth1, 'u\\.created_at'))
ok('μετρά μετά την αποδοχή, από το created_at και όχι από το freshAccount',
  gated(accept, 'data\\.user\\?\\.created_at') && !/freshAccount[^\n]*countSignup/.test(accept))

ok('κινητό iPhone', isMobileUa(SAFARI))
ok('κινητό Android', isMobileUa(LI))
ok('υπολογιστής όχι', !isMobileUa(DESKTOP))

// ── ΟΙ ΚΑΤΑΛΟΓΟΙ ΕΙΝΑΙ ΟΙ ΙΔΙΟΙ ΜΕ ΤΗΣ ΒΑΣΗΣ ──────────────────────────────────
const dir = 'supabase/migrations'
// Οι μεταναστεύσεις του χωνιού με τη σειρά τους· ισχύει ο τελευταίος ορισμός.
const files = readdirSync(dir).filter(f => f.includes('choni_tis_eggrafis')).sort()
const sql = files.map(f => readFileSync(`${dir}/${f}`, 'utf8')).join('\n')
const last = <T,>(xs: T[]) => xs[xs.length - 1]
ok('υπάρχει το migration του χωνιού', sql.includes('count_signup_step'))
const quoted = (block: string) => new Set([...block.matchAll(/'([a-z_]+)'/g)].map(m => m[1]))
const stepsInSql = quoted(/step\s+text\s+not null check \(step in \(([^)]*)\)/.exec(sql)?.[1] ?? '')
const sourcesInSql = quoted(last([...sql.matchAll(/check \(source in \(([^)]*)\)/g)])?.[1] ?? '')
const steps = Object.values(SIGNUP_STEPS)
ok('κάθε βήμα της εφαρμογής υπάρχει στη βάση', steps.every(s => stepsInSql.has(s)))
ok('και η βάση δεν έχει βήμα που η εφαρμογή δεν στέλνει', stepsInSql.size === steps.length)
ok('κάθε πηγή της εφαρμογής υπάρχει στη βάση', SIGNUP_SOURCES.every(s => sourcesInSql.has(s)))
ok('και η βάση δεν έχει πηγή που η εφαρμογή δεν στέλνει', sourcesInSql.size === SIGNUP_SOURCES.length)
// Η συνάρτηση ελέγχει ξανά τους ίδιους καταλόγους: ανοιχτή στον ανώνυμο, δεν δέχεται ελεύθερο κείμενο.
const fn = sql.slice(sql.lastIndexOf('create or replace function public.count_signup_step'))
ok('η συνάρτηση ελέγχει κάθε βήμα', steps.every(s => fn.includes(`'${s}'`)))
ok('η συνάρτηση ελέγχει κάθε πηγή', SIGNUP_SOURCES.every(s => fn.includes(`'${s}'`)))
ok('και κλειδώνει το search_path', /set search_path = public, pg_temp/.test(fn))

console.log(`${fail ? '✗' : '✓'} χωνί εγγραφής: ${pass} περνούν${fail ? `, ${fail} αποτυγχάνουν` : ''}`)
if (fail) process.exit(1)
