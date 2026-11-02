// npx tsx lib/i18n/en/plans.test.ts
// Τα αγγλικά πακέτα μένουν σε βήμα με τα ελληνικά: ίδιο πλήθος γραμμών, ίδια
// θέση της σάρωσης, κανένας αριθμός που δεν βγαίνει από το plans.ts.
import { PLANS, PLAN_ORDER } from '@/lib/billing/plans'
import { PLAN_COPY_EN, planCopy } from './plans'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

for (const id of PLAN_ORDER) {
  const el = PLANS[id].features, en = PLAN_COPY_EN[id].features
  ok(`${id}: ίδιο πλήθος γραμμών`, el.length === en.length)
  el.forEach((line, i) => {
    ok(`${id}#${i}: η σάρωση στην ίδια θέση`, line.startsWith('Σάρωση') === /scans/i.test(en[i]))
    const digits = (s: string) => (s.match(/\d+/g) ?? []).join(',')
    ok(`${id}#${i}: ίδιοι αριθμοί («${line}» / «${en[i]}»)`, digits(line) === digits(en[i]))
  })
  ok(`${id}: ελληνικά αυτούσια`, planCopy('el', id).name === PLANS[id].name)
  ok(`${id}: χωρίς ελληνικούς χαρακτήρες`, !/[Ͱ-Ͽἀ-῿]/.test(JSON.stringify(PLAN_COPY_EN[id])))
  ok(`${id}: καμία λέξη «free»`, !/\bfree\b/i.test(JSON.stringify(PLAN_COPY_EN[id])))
}

console.log(fail === 0 ? `✓ en plans: ${pass} έλεγχοι πέρασαν` : `✗ en plans: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
