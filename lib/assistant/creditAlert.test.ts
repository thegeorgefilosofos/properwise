// Η ειδοποίηση για το τέλος του υπολοίπου: φεύγει μία φορά, με όριο έξι ωρών.
import { makeCreditAlerter, CREDIT_ALERT, CREDIT_ALERT_EVERY_MS } from './creditAlert'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

async function main() {
  const sent: string[] = []
  const send = async (a: { subject: string }) => { sent.push(a.subject); return true }
  const alertOutOfCredit = makeCreditAlerter(send)
  const t0 = 1_000_000
  ok('η πρώτη αποτυχία στέλνει', await alertOutOfCredit('k', t0))
  ok('δεύτερη μέσα στο εξάωρο δεν στέλνει', !(await alertOutOfCredit('k', t0 + 60_000)))
  ok('μετά το εξάωρο ξαναστέλνει', await alertOutOfCredit('k', t0 + CREDIT_ALERT_EVERY_MS))
  ok('στάλθηκαν ακριβώς δύο', sent.length === 2)

  const boom = makeCreditAlerter(async () => { throw new Error('δίκτυο') })
  ok('σφάλμα αποστολής δεν πετά', (await boom('k', t0)) === false)

  ok('το θέμα λέει τι χάλασε', /Νόα/.test(CREDIT_ALERT.subject))
  ok('το κείμενο λέει τι να κάνει ο ιδιοκτήτης', /Billing/.test(CREDIT_ALERT.text))
  ok('κανένα κόμμα πριν από «και»', !/, κ(αι|ι) /.test(CREDIT_ALERT.subject + CREDIT_ALERT.text))

  console.log(fail === 0 ? `✓ creditAlert: ${pass} έλεγχοι πέρασαν` : `✗ creditAlert: ${fail} απέτυχαν από ${pass + fail}`)
  if (fail > 0) process.exit(1)
}
main()
