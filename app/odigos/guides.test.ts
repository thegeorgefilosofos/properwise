// npx tsx app/odigos/guides.test.ts
//
// ΟΙ ΕΣΩΤΕΡΙΚΟΙ ΣΥΝΔΕΣΜΟΙ ΤΩΝ ΟΔΗΓΩΝ. Στις 05/10/2026 έξι από τους δέκα
// οδηγούς είχαν ένα ως τρία εσωτερικά λινκ και δύο εργαλεία κανέναν οδηγό. Ο
// έλεγχος κρατά ότι κάθε εργαλείο δείχνει τους οδηγούς του και ότι οι «Σχετικοί
// οδηγοί» μοιράζουν τους συνδέσμους, ώστε κανένας οδηγός να μη μένει ορφανός.
import { readFileSync } from 'node:fs';
import { GUIDES, LISTED_GUIDES, guidesForTool, relatedGuides } from './guides';
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
// Ο μηχανισμός μένει για την επόμενη φορά που ένας οδηγός θα πρέπει να
// σταματήσει να προτείνεται από ΜΙΑ σελίδα. Η πρώτη χρήση του (Airbnb → ΑΜΑ,
// 05.10.2026) έκλεισε στις 07/10/2026 και από 13/10/2026 ο ΑΜΑ είναι εκτός
// καταλόγου για όλο το site, οπότε η δοκιμή εξαιρεί τον πρώτο σχετικό του
// Airbnb, όποιος κι αν είναι.
{
  const AIRBNB = '/odigos/airbnb-takk-2026';
  const airbnb = GUIDES.find(g => g.href === AIRBNB)!;
  const first = relatedGuides(airbnb, 4)[0].href;
  const r = relatedGuides(airbnb, 4, [first]);
  ok(`exclude: ο ${first} λείπει`, r.every(x => x.href !== first));
  ok('exclude: πάλι τέσσερις', r.length === 4);
  ok('exclude: χωρίς διπλούς και όχι ο εαυτός του', new Set(r.map(x => x.href)).size === 4 && r.every(x => x.href !== AIRBNB));
}
// ── Ο οδηγός εκτός καταλόγου (`unlisted`) ────────────────────────────────
// Ο ΑΜΑ περιμένει την υπογραφή της Legal (13/10/2026): η σελίδα του μένει
// δημοσιευμένη, αλλά καμία άλλη δεν τον δείχνει. Οταν υπογραφεί, φεύγει το
// `unlisted` από τον κατάλογο και ο πρώτος έλεγχος εδώ μαζί του.
{
  const AMA = '/odigos/vraxyxronia-ama-prodiagrafes-2026';
  const hidden = GUIDES.filter(g => g.unlisted).map(g => g.href);
  ok('ο οδηγός ΑΜΑ είναι εκτός καταλόγου ώσπου να τον υπογράψει η Legal', hidden.includes(AMA));
  ok('ο κόμβος και το /llms.txt δεν τους έχουν', LISTED_GUIDES.every(g => !hidden.includes(g.href)));
  ok('ο κόμβος έχει όλους τους υπόλοιπους', LISTED_GUIDES.length === GUIDES.length - hidden.length);
  for (const t of TOOLS) ok(`${t}: δεν δείχνει οδηγό εκτός καταλόγου`, guidesForTool(t).every(g => !hidden.includes(g.href)));
  for (const h of hidden) ok(`${h}: κανένας οδηγός δεν τον προτείνει`, inbound.get(h) === 0);
}
const least = Math.min(...LISTED_GUIDES.map(g => inbound.get(g.href)!));
ok(`κανένας οδηγός του καταλόγου δεν παίρνει λιγότερους από 3 συνδέσμους από άλλους οδηγούς (ελάχιστο ${least})`, least >= 3);

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
