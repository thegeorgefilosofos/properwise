// npx tsx supabase/functions/_shared/clientMessage.test.ts
//
// Το μήνυμα προς πελάτες το γράφει ο διακομιστής από ΚΕΙΜΕΝΟ. Εδώ φυλάγεται
// ότι κανένα HTML του αιτήματος δεν φτάνει στον παραλήπτη, ότι οι σύνδεσμοι
// είναι μόνο https χωρίς τρόπο να σπάσει το href και ότι ο αποστολέας
// ονομάζεται στο υποσέλιδο.
import {
  clientMessageBody, clientMessageEmail, fillClientHtml,
} from './emailTemplates.ts'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

// ── Τίποτα από το αίτημα δεν μένει HTML ──────────────────────────────────
const evil = clientMessageBody('<script>alert(1)</script>\n<form action="https://x.example"><input name=card></form>')
ok('το <script> διαφεύγεται', !evil.includes('<script') && evil.includes('&lt;script&gt;'))
ok('η φόρμα διαφεύγεται', !evil.includes('<form') && !evil.includes('<input'))

// ── Παράγραφοι και αλλαγές γραμμής ───────────────────────────────────────
const two = clientMessageBody('Γεια σου {{name}},\nκαλή χρονιά.\n\nΜε εκτίμηση')
ok('δύο παράγραφοι', (two.match(/<p /g) || []).length === 2)
ok('η μονή αλλαγή γίνεται <br>', two.includes('Γεια σου {{name}},<br>καλή χρονιά.'))

// ── Σύνδεσμοι: μόνο https και χωρίς σπάσιμο του href ─────────────────────
const link = clientMessageBody('Δες εδώ: https://properwise.gr/a?b=1&c=2.')
ok('το https γίνεται σύνδεσμος', link.includes('href="https://properwise.gr/a?b=1&amp;c=2"'))
ok('η τελεία μένει έξω από τη διεύθυνση', link.includes('</a>.'))
ok('με rel και target', link.includes('rel="noopener noreferrer nofollow"') && link.includes('target="_blank"'))
const quote = clientMessageBody('https://x.example/"onmouseover="alert(1)')
ok('το εισαγωγικό κόβει τη διεύθυνση', quote.includes('href="https://x.example/"') && quote.includes('</a>"onmouseover'))
ok('το http δεν γίνεται σύνδεσμος', !clientMessageBody('http://x.example').includes('<a '))
ok('το javascript: δεν γίνεται σύνδεσμος', !clientMessageBody('javascript:alert(1)').includes('<a '))

// ── Ο αποστολέας στο υποσέλιδο ───────────────────────────────────────────
const full = clientMessageEmail({ text: 'Καλημέρα', senderEmail: 'owner@example.com' })
ok('το υποσέλιδο ονομάζει τον λογαριασμό', full.includes('owner@example.com μέσω PROPERWISE'))
ok('στο κοινό κέλυφος (κεφαλίδα με το λογότυπο)', full.includes('class="logo-light"'))
ok('χωρίς διεύθυνση, γενικό υποσέλιδο',
  clientMessageEmail({ text: 'x', senderEmail: null }).includes('χρήστης του PROPERWISE'))

// ── Η εξατομίκευση διαφεύγει την τιμή ────────────────────────────────────
const filled = fillClientHtml('<p>{{name}}</p><a href="https://x.example/{{email}}">', { name: '<b>"Χ"</b>', email: 'a"b@c.d' })
ok('το όνομα διαφεύγεται', filled.includes('&lt;b&gt;&quot;Χ&quot;&lt;/b&gt;'))
ok('το email διαφεύγεται μέσα στο href', filled.includes('x.example/a&quot;b@c.d"'))

console.log(fail === 0 ? `✓ μήνυμα προς πελάτες: ${pass} έλεγχοι πέρασαν` : `✗ μήνυμα προς πελάτες: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
