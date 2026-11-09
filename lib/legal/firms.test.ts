// npx tsx lib/legal/firms.test.ts
// Η έκδοση των όρων του γραφείου ζει σε δύο μέρη: εδώ, που τη στέλνει η οθόνη
// και στη βάση, που αρνείται πελάτες χωρίς αυτήν (20261108090000). Αν
// αποκλίνουν, κανένα γραφείο δεν μπορεί να αποδεχτεί και κανένας πελάτης δεν
// φαίνεται. Ελέγχεται η ΤΕΛΕΥΤΑΙΑ μετανάστευση που ορίζει τη συνάρτηση.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIRM_TERMS_VERSION } from './firms';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

const dir = join(process.cwd(), 'supabase', 'migrations');
const defs = readdirSync(dir).filter(n => n.endsWith('.sql')).sort()
  .map(n => readFileSync(join(dir, n), 'utf8'))
  .map(sql => /function private\.firm_terms_version\(\)[\s\S]*?select '([^']+)'::text/.exec(sql)?.[1])
  .filter((v): v is string => !!v);
ok(defs.length > 0, 'καμία μετανάστευση δεν ορίζει την private.firm_terms_version()');
ok(defs.at(-1) === FIRM_TERMS_VERSION, `η βάση λέει «${defs.at(-1)}», το lib/legal/firms.ts «${FIRM_TERMS_VERSION}»`);

console.log(`\nlegal/firms.ts — ${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
console.log('όλα πέρασαν');
