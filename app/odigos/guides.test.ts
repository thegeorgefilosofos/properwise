// npx tsx app/odigos/guides.test.ts
//
// ΟΙ ΕΣΩΤΕΡΙΚΟΙ ΣΥΝΔΕΣΜΟΙ ΤΩΝ ΟΔΗΓΩΝ. Στις 05/10/2026 έξι από τους δέκα
// οδηγούς είχαν ένα ως τρία εσωτερικά λινκ και δύο εργαλεία κανέναν οδηγό. Ο
// έλεγχος κρατά ότι κάθε εργαλείο δείχνει τους οδηγούς του και ότι οι «Σχετικοί
// οδηγοί» μοιράζουν τους συνδέσμους, ώστε κανένας οδηγός να μη μένει ορφανός.
import { readFileSync } from 'node:fs';
import { GUIDES, guidesForTool, relatedGuides } from './guides';
import { PUBLIC_TOOLS } from '@/lib/core/publicTools';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

const TOOLS = PUBLIC_TOOLS.map(t => t.href);
for (const g of GUIDES) {
  ok(`${g.href}: ανήκει σε τουλάχιστον ένα εργαλείο`, g.tools.length > 0);
  for (const t of g.tools) ok(`${g.href}: το εργαλείο ${t} υπάρχει`, TOOLS.includes(t));
}
for (const t of TOOLS) {
  ok(`${t}: έχει οδηγό`, guidesForTool(t).length > 0);
  // Και η σελίδα του εργαλείου τους δείχνει: το κομμάτι μπαίνει με τη διαδρομή του.
  const page = readFileSync(`app${t}/page.tsx`, 'utf8');
  ok(`${t}: η σελίδα δείχνει τους οδηγούς του`, page.includes(`<ToolGuides tool="${t}" />`));
}

// ── Οι «Σχετικοί οδηγοί» ─────────────────────────────────────────────────
const inbound = new Map(GUIDES.map(g => [g.href, 0]));
for (const g of GUIDES) {
  const r = relatedGuides(g, 4);
  ok(`${g.href}: τέσσερις σχετικοί`, r.length === Math.min(4, GUIDES.length - 1));
  ok(`${g.href}: όχι ο εαυτός του`, r.every(x => x.href !== g.href));
  ok(`${g.href}: χωρίς διπλούς`, new Set(r.map(x => x.href)).size === r.length);
  for (const x of r) inbound.set(x.href, inbound.get(x.href)! + 1);
}
// ── Το `exclude` ─────────────────────────────────────────────────────────
// Ο οδηγός Airbnb δεν δείχνει τον οδηγό ΑΜΑ όσο εκείνος έχει ανοιχτό P0 (η
// σελίδα του περνά `exclude`, examples.test.ts). Η θέση γεμίζει από τον
// επόμενο του κύκλου και ο οδηγός ΑΜΑ δεν μένει ορφανός.
{
  const AIRBNB = '/odigos/airbnb-takk-2026', AMA = '/odigos/vraxyxronia-ama-prodiagrafes-2026';
  const airbnb = GUIDES.find(g => g.href === AIRBNB)!;
  ok('χωρίς exclude ο οδηγός Airbnb θα έδειχνε τον ΑΜΑ (αλλιώς η εξαίρεση δεν κάνει τίποτα)',
    relatedGuides(airbnb, 4).some(x => x.href === AMA));
  const r = relatedGuides(airbnb, 4, [AMA]);
  ok('exclude: ο ΑΜΑ λείπει', r.every(x => x.href !== AMA));
  ok('exclude: πάλι τέσσερις', r.length === 4);
  ok('exclude: χωρίς διπλούς και όχι ο εαυτός του', new Set(r.map(x => x.href)).size === 4 && r.every(x => x.href !== AIRBNB));
  // Οι εισερχόμενοι όπως τους βλέπει ο αναγνώστης: με την εξαίρεση μέσα.
  const before = relatedGuides(airbnb, 4);
  for (const x of before) inbound.set(x.href, inbound.get(x.href)! - 1);
  for (const x of r) inbound.set(x.href, inbound.get(x.href)! + 1);
}
const least = Math.min(...inbound.values());
ok(`κανένας οδηγός δεν παίρνει λιγότερους από 3 συνδέσμους από άλλους οδηγούς (ελάχιστο ${least})`, least >= 3);

// ── Κεφαλίδα και υποσέλιδο ───────────────────────────────────────────────
const chrome = readFileSync('app/PublicChrome.tsx', 'utf8');
ok('η κεφαλίδα έχει «Οδηγοί»', /href="\/odigos"[^>]*>Οδηγοί<\/Link>/.test(chrome));
ok('το υποσέλιδο έχει τον κόμβο των οδηγών', chrome.includes("['/odigos', 'Όλοι οι οδηγοί']"));
// Το κέλυφος φορτώνεται και σε κομμάτια του πελάτη: ο κατάλογος δεν μπαίνει
// εκεί (έφερνε ~6 KB gzip σε κάθε δημόσια σελίδα, perf:budget 05/10/2026).
ok('το κέλυφος δεν εισάγει τον κατάλογο των οδηγών', !/from '\.\/odigos\/guides'/.test(chrome));

console.log(fail ? `✗ guides: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ guides: ${pass} έλεγχοι πέρασαν`);
if (process.env.SHOW) console.log([...inbound].map(([h, n]) => `${n}  ${h}`).join('\n'));
if (fail) process.exit(1);
