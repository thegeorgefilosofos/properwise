// npx tsx lib/analytics/pageUrl.test.ts
//
// ΤΑ UTM ΠΕΡΝΟΥΝ, ΤΙΠΟΤΑ ΑΛΛΟ. Το app/VercelAnalytics.tsx έκοβε όλο το query
// string, μαζί και τα utm: καμία ανάρτηση δεν συνδεόταν με επίσκεψη. Εδώ
// κλειδώνει και η άλλη πλευρά: token, code, email και κάθε άγνωστο κλειδί δεν
// φεύγουν ποτέ και οι σελίδες με μυστικό στη διαδρομή δεν μετρώνται.
import { readFileSync } from 'node:fs';
import { analyticsUrl, UTM_KEYS } from './pageUrl';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${extra ? ` (${extra})` : ''}`); }
};
const O = 'https://properwise.gr';

ok('τα πέντε κλειδιά, ακριβώς', JSON.stringify(UTM_KEYS) === JSON.stringify(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']));

{
  const got = analyticsUrl(`${O}/ypologismos-enfia?utm_source=linkedin&utm_medium=social&utm_campaign=enfia_1910&utm_content=reel&utm_term=enfia`);
  ok('ανάρτηση LinkedIn: τα utm μένουν', got === `${O}/ypologismos-enfia?utm_source=linkedin&utm_medium=social&utm_campaign=enfia_1910&utm_content=reel&utm_term=enfia`, String(got));
}
ok('χωρίς query: σκέτο μονοπάτι', analyticsUrl(`${O}/odigos`) === `${O}/odigos`);
ok('token και code κόβονται, τα utm μένουν',
  analyticsUrl(`${O}/signup?token=abc123&code=xyz&utm_source=meta&email=a%40b.gr`) === `${O}/signup?utm_source=meta`);
ok('μόνο άγνωστα κλειδιά: κανένα «?»', analyticsUrl(`${O}/pricing?next=%2Fdashboard&ref=x`) === `${O}/pricing`);
ok('κεφαλαίο UTM_SOURCE δεν είναι το κλειδί', analyticsUrl(`${O}/?UTM_SOURCE=x`) === `${O}/`);
ok('το hash δεν φεύγει', analyticsUrl(`${O}/odigos#access_token=secret&utm_source=x`) === `${O}/odigos`);
ok('κενή τιμή utm δεν φεύγει', analyticsUrl(`${O}/?utm_source=`) === `${O}/`);
ok('τιμή πάνω από 100 χαρακτήρες δεν φεύγει', analyticsUrl(`${O}/?utm_content=${'a'.repeat(101)}&utm_source=x`) === `${O}/?utm_source=x`);

// Σελίδες με μυστικό στη διαδρομή: ολόκληρο το γεγονός απορρίπτεται ακόμη και με utm.
for (const p of ['/portal/tok', '/checkin/tok', '/verify/abc', '/unsubscribe/abc', '/accountant/tok', '/auth/callback', '/plirosa/tok', '/imerologio/tok', '/epivevaiosi-email/tok'])
  ok(`${p}: δεν μετριέται`, analyticsUrl(`${O}${p}?utm_source=x`) === null);

ok('διεύθυνση που δεν διαβάζεται: δεν φεύγει', analyticsUrl('not a url?token=abc') === null);

// Η σελίδα στέλνει μόνο ό,τι επιστρέφει η analyticsUrl.
{
  const src = readFileSync('app/VercelAnalytics.tsx', 'utf8');
  ok('το VercelAnalytics περνά από την analyticsUrl', /beforeSend=\{\(event\)\s*=>\s*\{\s*const url = analyticsUrl\(event\.url\)/.test(src));
  ok('και δεν επιστρέφει ποτέ το γεγονός όπως ήταν', !/return event;/.test(src));
}

console.log(fail ? `✗ pageUrl: ${fail} απέτυχαν από ${pass + fail}` : `✓ pageUrl: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
