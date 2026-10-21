// npx tsx lib/data/accountantInvites.test.ts
//
// Η λίστα του λογιστή έρχεται από όπου έρχεται: επικόλληση από Excel, CSV του
// λογιστικού προγράμματος, «Όνομα <διεύθυνση>» από το ταχυδρομείο. Κρατιέται ό,τι
// μοιάζει με διεύθυνση· τα διπλά και τα άκυρα τα λέει η βάση γραμμή γραμμή.
import { parseEmailList, uniqueCount, INVITE_STATUS_LABEL, INVITE_BATCH } from './accountantInvites';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

eq('μία ανά γραμμή', parseEmailList('a@x.gr\nb@y.gr\r\n\nc@z.gr'), ['a@x.gr', 'b@y.gr', 'c@z.gr']);
eq('κόμμα και ερωτηματικό', parseEmailList('a@x.gr, b@y.gr;c@z.gr'), ['a@x.gr', 'b@y.gr', 'c@z.gr']);
eq('CSV με ΑΦΜ και όνομα: μόνο η διεύθυνση', parseEmailList('ΑΦΜ;Όνομα;Email\n094014201;Γ. Παπαδόπουλος;gp@x.gr\n123456783;"Μ. Ιωάννου";mi@y.gr'), ['gp@x.gr', 'mi@y.gr']);
eq('«Όνομα <διεύθυνση>» και mailto:', parseEmailList('Γιώργος <g@x.gr>, mailto:m@y.gr.'), ['g@x.gr', 'm@y.gr']);
eq('τα διπλά μένουν, τα κρίνει η βάση', parseEmailList('a@x.gr A@X.gr'), ['a@x.gr', 'A@X.gr']);
eq('μοναδικές χωρίς διάκριση πεζών', uniqueCount(['a@x.gr', 'A@X.gr', 'b@x.gr']), 2);
eq('άδειο', parseEmailList(''), []);
eq('κάθε κατάσταση έχει λόγια', Object.values(INVITE_STATUS_LABEL).every(s => s.length > 3), true);
eq('το όριο ανά λίστα στο κείμενο', INVITE_STATUS_LABEL.over_limit.includes(String(INVITE_BATCH)), true);

console.log(fail === 0 ? `✓ accountantInvites: ${pass} έλεγχοι πέρασαν` : `✗ accountantInvites: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
