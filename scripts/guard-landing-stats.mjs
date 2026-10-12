// ═══════════════════════════════════════════════════════════════════════════
// Η ΖΩΝΗ ΜΕΤΡΗΣΕΩΝ ΤΗΣ ΑΡΧΙΚΗΣ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΛΕΕΙ ΨΕΜΑΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Τέσσερα νούμερα, γραμμένα με το χέρι μέσα στο app/page.tsx, που περιγράφουν
// τέσσερις καταλόγους οι οποίοι ζουν αλλού και μεγαλώνουν μόνοι τους. Όποιος
// προσθέσει τον δωδέκατο πάροχο ρεύματος ή τη δέκατη έβδομη ασφαλιστική δεν
// έχει κανέναν λόγο να ανοίξει την αρχική σελίδα: το νούμερο θα έμενε πίσω
// σιωπηλά και ο επισκέπτης θα διάβαζε λάθος μέγεθος.
//
// Ο φρουρός ξαναμετρά τους καταλόγους από την ΠΗΓΗ τους και τους αντιπαραβάλλει
// με τη σελίδα. Δεν διορθώνει, δηλώνει.
//
// ΕΛΕΓΧΟΣ ΟΤΙ Ο ΙΔΙΟΣ Ο ΦΡΟΥΡΟΣ ΜΕΤΡΑΕΙ ΚΑΤΙ: αν κάποιο μοτίβο σταματήσει να
// ταιριάζει (μετακίνηση αρχείου, αλλαγή γραφής), το πλήθος γίνεται μηδέν και
// ένας φρουρός που μετράει μηδέν περνά «πράσινος» χωρίς να έχει ελέγξει τίποτα.
// Γι' αυτό κάθε μέτρηση απαιτεί ρητά θετικό πλήθος πριν συγκριθεί.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const fails = [];
const fail = (m) => fails.push(m);

// ── Τι λέει η σελίδα ────────────────────────────────────────────────────────
const page = read('app/page.tsx');
const block = page.match(/const STATS = \[([\s\S]*?)\n\];/);
if (!block) { console.error('✗ ΖΩΝΗ ΜΕΤΡΗΣΕΩΝ: δεν βρέθηκε ο πίνακας STATS στο app/page.tsx'); process.exit(1); }
const said = {};
for (const m of block[1].matchAll(/\{\s*n:\s*'(\d+)',\s*u:\s*'([^']+)'/g)) said[m[2]] = Number(m[1]);
if (Object.keys(said).length !== 4) {
  console.error(`✗ ΖΩΝΗ ΜΕΤΡΗΣΕΩΝ: διαβάστηκαν ${Object.keys(said).length} μετρήσεις αντί για 4`);
  process.exit(1);
}

// ── Τι λένε οι πηγές ────────────────────────────────────────────────────────
// 1. Είδη εγγράφων: όσα αναγνωρίζει η σάρωση, χωρίς το «other» που δεν είναι είδος.
const docs = read('lib/billing/documents.ts');
const docBlock = docs.match(/export const DOC_TYPES: DocTypeMeta\[\] = \[([\s\S]*?)\n\];/);
const docIds = docBlock ? [...docBlock[1].matchAll(/\{\s*id:\s*'([a-z]+)'/g)].map(m => m[1]) : [];
const docKinds = docIds.filter(id => id !== 'other').length;

// 2. Πάροχοι ρεύματος: κάθε ομάδα του καταλόγου.
const cat = read('lib/energy/catalogue.ts');
const catBlock = cat.match(/export const PROVIDERS: ProviderGroup\[\] = \[([\s\S]*?)\n\];/);
const providers = catBlock ? [...catBlock[1].matchAll(/^ {4}value: '/gm)].length : 0;

// 3. Ασφαλιστικές: όσες έχουν πραγματική διεύθυνση. Το «Άλλη Ασφαλιστική» είναι
//    πεδίο εισαγωγής, όχι εταιρεία και γι' αυτό έχει κενό url.
//
//    ΜΕΤΡΟΥΣΕ ΜΑΡΚΕΣ ΚΑΙ Η ΑΡΧΙΚΗ ΕΓΡΑΦΕ 16. Το Anytime είναι το ψηφιακό κανάλι
//    της Interamerican και η Magenta πουλά τα προγράμματα της Hellas Direct
//    (https://www.magentainsurance.gr/home, ανάγνωση 12/10/2026). Ο κατάλογος
//    τις μετρά στη μητρική τους με το `BRAND_PARENT` (`countInsurers`)· εδώ ο
//    ίδιος κανόνας, διαβασμένος από το ίδιο αρχείο.
//
//    ΚΑΙ ΜΕΤΡΟΥΣΕ ΕΤΑΙΡΕΙΕΣ ΠΟΥ Η ΣΕΛΙΔΑ ΤΟΥΣ ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ. Έξι εταιρείες του
//    καταλόγου έχουν `checkedAt: null` από την ανάγνωση της 12/10/2026: κανένα
//    πρόγραμμά τους δεν προσφέρεται και οι καλύψεις τους δεν έχουν πηγή, ενώ η
//    λεζάντα λέει «σύγκριση ανά κάλυψη». Μετρούν μόνο όσες διαβάστηκαν
//    (`READ_INSURERS`). Μπλοκ εταιρείας χωρίς `checkedAt` που να διαβάζεται
//    σημαίνει ότι η γραφή άλλαξε και κοκκινίζει, αντί να μετρηθεί σιωπηλά.
const ins = read('app/dashboard/components/insurance/catalog.ts');
const starts = [...ins.matchAll(/^ {2}\{ value: '([a-z_]+)',\s+label: '[^']+',\s+url: '(https:\/\/)?/gm)];
const companies = starts.map((m, i) => {
  const body = ins.slice(m.index, starts[i + 1]?.index ?? ins.length);
  return { value: m[1], hasUrl: !!m[2], checkedAt: /^\s*checkedAt:\s*(null|REVIEWED_AT|'\d{4}-\d{2}-\d{2}'),/m.exec(body)?.[1] };
});
const unread = companies.filter(c => c.checkedAt === undefined).map(c => c.value);
if (unread.length) fail(`«ασφαλιστικές»: δεν διαβάστηκε το \`checkedAt\` των ${unread.join(', ')} (app/dashboard/components/insurance/catalog.ts). Ο φρουρός θα μετρούσε και εταιρείες χωρίς ανάγνωση.`);
const brands = companies.filter(c => c.hasUrl).map(c => c.value);
const readBrands = companies.filter(c => c.hasUrl && c.checkedAt !== undefined && c.checkedAt !== 'null').map(c => c.value);
const parentBlock = ins.match(/const BRAND_PARENT: Record<string, string> = \{([\s\S]*?)\n\};/);
const parent = Object.fromEntries([...(parentBlock?.[1] ?? '').matchAll(/^\s*([a-z_]+):\s*'([a-z_]+)',/gm)].map(m => [m[1], m[2]]));
// Μητρική που διαβάστηκε μηδέν φορές, ή μάρκα/μητρική που δεν είναι εταιρεία
// του καταλόγου, σημαίνει ότι η γραφή άλλαξε και ο κανόνας δεν εφαρμόζεται.
const parentOk = Object.keys(parent).length > 0
  && Object.entries(parent).every(([b, p]) => brands.includes(b) && brands.includes(p));
if (!parentOk) fail('«ασφαλιστικές»: το BRAND_PARENT δεν διαβάστηκε ή δείχνει εταιρεία που δεν υπάρχει (app/dashboard/components/insurance/catalog.ts). Ο φρουρός θα μετρούσε μάρκες.');
const insurers = parentOk && !unread.length ? new Set(readBrands.map(b => parent[b] ?? b)).size : 0;

// 4. Κλιμάκια της κλίμακας ενοικίων που ισχύει από το 2026.
const tax = read('lib/billing/greekTax.ts');
const taxBlock = tax.match(/export const RENTAL_TAX_BRACKETS_2026[^=]*=\s*\[([\s\S]*?)\n\];/);
const brackets = taxBlock ? [...taxBlock[1].matchAll(/\{\s*from:/g)].length : 0;

const checks = [
  ['είδη εγγράφων',     docKinds,  'DOC_TYPES χωρίς το «other» (lib/billing/documents.ts)'],
  ['πάροχοι ρεύματος',  providers, 'PROVIDERS (lib/energy/catalogue.ts)'],
  ['ασφαλιστικές',      insurers,  'εταιρείες με διεύθυνση και διαβασμένη σελίδα, η μάρκα στη μητρική της (READ_INSURERS, app/dashboard/components/insurance/catalog.ts)'],
  ['κλιμάκια φόρου',     brackets,  'RENTAL_TAX_BRACKETS_2026 (lib/billing/greekTax.ts)'],
];

for (const [unit, actual, source] of checks) {
  if (!(actual > 0)) { fail(`«${unit}»: η πηγή μέτρησε 0. Άλλαξε γραφή ή θέση το ${source} και ο φρουρός σταμάτησε να ελέγχει.`); continue; }
  if (!(unit in said)) { fail(`«${unit}»: η ζώνη μετρήσεων δεν το αναφέρει πια. Πηγή: ${source}.`); continue; }
  if (said[unit] !== actual) fail(`«${unit}»: η αρχική λέει ${said[unit]}, η πηγή έχει ${actual}. Πηγή: ${source}.`);
}

// Οι λεζάντες γράφτηκαν για ΔΥΟ γραμμές σε κελί 213 εικονοστοιχείων (τέσσερις
// στήλες στα 1440), δηλαδή περίπου τριάντα χαρακτήρες τη γραμμή. Πάνω από
// εξήντα κατεβαίνει τρίτη γραμμή και τότε τα τέσσερα κελιά παύουν να ζυγίζουν.
// Μετρημένο σε πραγματικό Chromium, όχι εκτιμημένο.
// ΚΑΙ Η ΜΟΝΑΔΑ ΕΧΕΙ ΔΙΚΟ ΤΗΣ ΜΕΤΡΟ, ΓΙΑΤΙ ΚΟΣΤΙΖΕΙ ΣΕ ΟΛΑ ΤΑ ΚΕΛΙΑ ΜΑΖΙ.
// Στα 390 η ζώνη γίνεται δύο στήλες των 138px και η μονάδα τυπώνεται κεφαλαία
// με letter-spacing: χωρούν ΔΕΚΑΕΞΙ γράμματα. Το δέκατο έβδομο πιάνει δεύτερη
// γραμμή — και επειδή οι τρεις σειρές του κελιού είναι subgrid, ψηλώνει τη
// σειρά της μονάδας και στα ΤΕΣΣΕΡΑ κελιά, αφήνοντας κενό κάτω από τις κοντές.
// Μια λέξη παραπάνω σε ένα κελί χαλάει τη ζυγαριά ολόκληρης της ζώνης.
// Και η λεζάντα σε `…`, όταν ο συντελεστής βγαίνει από σταθερά: το κείμενο της
// πηγής είναι μακρύτερο από το τυπωμένο, άρα το όριο μένει από την ασφαλή πλευρά.
for (const m of block[1].matchAll(/u:\s*'([^']+)',\s*l:\s*['`]([^'`]+)['`]/g)) {
  if (m[1].length > 16) fail(`«${m[1]}»: μονάδα ${m[1].length} χαρακτήρων, όριο 16. Στα 390 πιάνει δεύτερη γραμμή και ψηλώνει και τα τέσσερα κελιά.`);
  if (m[2].length > 60) fail(`«${m[1]}»: λεζάντα ${m[2].length} χαρακτήρων, όριο 60. Σε αυτό το μήκος πιάνει τρίτη γραμμή στα 1440.`);
}

if (fails.length) {
  console.error('✗ ΖΩΝΗ ΜΕΤΡΗΣΕΩΝ ΑΡΧΙΚΗΣ');
  for (const f of fails) console.error('  ' + f);
  process.exit(1);
}
console.log(`✓ Ζώνη μετρήσεων αρχικής: ${checks.length} νούμερα ταιριάζουν με την πηγή τους`);
