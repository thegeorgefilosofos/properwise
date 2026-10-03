// npx tsx lib/seo/llms.test.ts
import { llmsText } from './llms'
import { PUBLIC_TOOLS } from '../core/publicTools'
import { GUIDES } from '../../app/odigos/guides'
import { PLANS, PLAN_ORDER } from '../billing/plans'
import { siteUrl } from '../core/site'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

const t = llmsText()
ok('αρχίζει με τον τίτλο της σύμβασης', t.startsWith('# PROPERWISE\n'))
ok('έχει περίληψη σε blockquote', /\n> .+\n/.test(t))
for (const tool of PUBLIC_TOOLS) ok(`εργαλείο ${tool.href}`, t.includes(`(${siteUrl(tool.href)})`))
for (const g of GUIDES) ok(`οδηγός ${g.href}`, t.includes(`[${g.title}](${siteUrl(g.href)})`))
for (const id of PLAN_ORDER) ok(`πακέτο ${id}`, t.includes(`- ${PLANS[id].name}:`))
ok('η σελίδα των λογιστών', t.includes(siteUrl('/logistes')))
ok('χωρίς «βοηθό» για τη Νόα', !/βοηθ/i.test(t))
ok('χωρίς «&» ή «→»', !/[&→]/.test(t))
ok('χωρίς κόμμα πριν από «και»', !/,\s*(και|κι)(?!\p{L})/u.test(t))

console.log(fail ? `✗ llms: ${fail} απέτυχαν από ${pass + fail}` : `✓ llms: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
