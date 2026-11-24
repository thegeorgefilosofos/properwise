// npx tsx lib/legal/mydataJoint.test.ts
// Ε-1 (νομικός έλεγχος 24/11/2026, μοντέλο Γ): η έκδοση της ρύθμισης άρθρου 26
// ζει σε δύο μέρη: εδώ (τη στέλνει η κάρτα του λογιστή) και στη βάση
// (`private.mydata_joint_version()`), που αρνείται άντληση χωρίς αυτήν (Ε-2).
// Ελέγχεται η ΤΕΛΕΥΤΑΙΑ μετανάστευση που ορίζει τη συνάρτηση. Κ-16: οι
// προθεσμίες των Όρων είναι σταθερές, όχι ψηφία γραμμένα με το χέρι.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MYDATA_JOINT_VERSION, MYDATA_BREACH_NOTICE_HOURS, MYDATA_REQUEST_FORWARD_WORKDAYS, MYDATA_JOINT_HREF } from './mydataJoint';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

const dir = join(process.cwd(), 'supabase', 'migrations');
const defs = readdirSync(dir).filter(n => n.endsWith('.sql')).sort()
  .map(n => readFileSync(join(dir, n), 'utf8'))
  .map(sql => /function private\.mydata_joint_version\(\)[\s\S]*?select '([^']+)'::text/.exec(sql)?.[1])
  .filter((v): v is string => !!v);
ok(defs.length > 0, 'καμία μετανάστευση δεν ορίζει την private.mydata_joint_version()');
ok(defs.at(-1) === MYDATA_JOINT_VERSION, `η βάση λέει «${defs.at(-1)}», το lib/legal/mydataJoint.ts «${MYDATA_JOINT_VERSION}»`);
ok(/^\d{4}-\d{2}-\d{2}$/.test(MYDATA_JOINT_VERSION), 'η έκδοση έχει τη μορφή που δέχεται η βάση');
ok(MYDATA_BREACH_NOTICE_HOURS === 24, 'ειδοποίηση για περιστατικό αμέσως, το αργότερο σε 24 ώρες (Όροι Β.8)');
ok(MYDATA_REQUEST_FORWARD_WORKDAYS === 3, 'διαβίβαση αιτήματος υποκειμένου σε 3 εργάσιμες (Όροι Β.5)');
ok(MYDATA_JOINT_HREF === '/terms#mydata-grafeia', 'ο σύνδεσμος δείχνει την ενότητα των Όρων');

// Οι Όροι διαβάζουν τις σταθερές αντί να γράφουν τα ψηφία.
const terms = readFileSync('app/terms/page.tsx', 'utf8');
const sec = terms.slice(terms.indexOf("id: 'mydata-grafeia'") - 400);
ok(terms.includes("id: 'mydata-grafeia'"), 'οι Όροι έχουν την ενότητα «Σύνδεση myDATA»');
ok(sec.includes('MYDATA_BREACH_NOTICE_HOURS') && sec.includes('MYDATA_REQUEST_FORWARD_WORKDAYS') && sec.includes('BACKUP_RETENTION_DAYS'), 'η ενότητα διαβάζει τις προθεσμίες από σταθερές');
ok(sec.includes('MYDATA_JOINT_VERSION'), 'η ενότητα δείχνει την έκδοση από τη σταθερά');

console.log(`\nlegal/mydataJoint.ts — ${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
