// npx tsx lib/seo/llms.test.ts
import { llmsText } from './llms'
import { PUBLIC_TOOLS } from '../core/publicTools'
import { GUIDES, LISTED_GUIDES } from '../../app/odigos/guides'
import { PLANS, PLAN_ORDER } from '../billing/plans'
import { siteUrl } from '../core/site'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

const t = llmsText()
ok('αρχίζει με τον τίτλο της σύμβασης', t.startsWith('# PROPERWISE\n'))
ok('έχει περίληψη σε blockquote', /\n> .+\n/.test(t))
for (const tool of PUBLIC_TOOLS) ok(`εργαλείο ${tool.href}`, t.includes(`(${siteUrl(tool.href)})`))
for (const g of LISTED_GUIDES) ok(`οδηγός ${g.href}`, t.includes(`[${g.title}](${siteUrl(g.href)})`))
// Ο οδηγός εκτός καταλόγου (`unlisted`, app/odigos/guides.ts) δεν παίρνει σύνδεσμο ούτε εδώ.
for (const g of GUIDES.filter(x => x.unlisted)) ok(`χωρίς τον οδηγό εκτός καταλόγου ${g.href}`, !t.includes(siteUrl(g.href)))
for (const id of PLAN_ORDER) ok(`πακέτο ${id}`, t.includes(`- ${PLANS[id].name}:`))
// ΟΧΙ «ΔΩΡΕΑΝ» ΔΙΠΛΑ ΣΕ ΤΙΜΗ ΠΑΚΕΤΟΥ (12/11/2026): η γραμμή του πακέτου
// χωρίς τιμή λέει ό,τι η αρχική, «0€ τον μήνα, χωρίς συνδρομή».
const planLines = t.split('\n').filter(l => PLAN_ORDER.some(id => l.startsWith(`- ${PLANS[id].name}:`)))
ok('καμία γραμμή πακέτου δεν γράφει «δωρεάν»', planLines.length === PLAN_ORDER.length && planLines.every(l => !/δωρεάν/i.test(l)))
ok('το πακέτο χωρίς τιμή: «0€ τον μήνα, χωρίς συνδρομή»', t.includes(`- ${PLANS.free.name}: 0€ τον μήνα, χωρίς συνδρομή,`))
ok('η σελίδα των λογιστών', t.includes(siteUrl('/logistes')))
ok('χωρίς «βοηθό» για τη Νόα', !/βοηθ/i.test(t))
ok('χωρίς «&» ή «→»', !/[&→]/.test(t))
ok('χωρίς κόμμα πριν από «και»', !/,\s*(και|κι)(?!\p{L})/u.test(t))

console.log(fail ? `✗ llms: ${fail} απέτυχαν από ${pass + fail}` : `✓ llms: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
