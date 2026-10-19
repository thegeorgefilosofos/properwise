// Το μέγεθος αρχείου με ελληνική υποδιαστολή (έλεγχος 18/10/2026, APP-8).
// Τρέξε: npx tsx lib/core/bytes.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fmtBytes } from './bytes';

let pass = 0, fail = 0;
const eq = (n: string, a: unknown, b: unknown) => { if (a === b) pass++; else { fail++; console.error(`✗ ${n}: πήρα ${JSON.stringify(a)}, ήθελα ${JSON.stringify(b)}`); } };

eq('9,5 MB με κόμμα και κενό', fmtBytes(9.5 * 1048576), '9,5 MB');
eq('14,2 MB', fmtBytes(Math.round(14.2 * 1048576)), '14,2 MB');
eq('KB χωρίς δεκαδικά', fmtBytes(300 * 1024), '300 KB');
eq('μικρό αρχείο σε B', fmtBytes(512), '512 B');
eq('μηδέν: τίποτα', fmtBytes(0), '');
eq('αρνητικό: τίποτα', fmtBytes(-5), '');

// Τα τρία σημεία που έγραφαν «9.5MB» με το χέρι περνούν πλέον από εδώ.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
for (const p of ['app/dashboard/components/DocumentScan.tsx', 'app/dashboard/components/contacts/modals.tsx', 'app/dashboard/components/clients/model.ts']) {
  eq(`${p}: κανένα toFixed δίπλα σε MB`, /toFixed\(\d\)\}?\s*MB/.test(read(p)), false);
}

console.log(`bytes: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
