// npx tsx lib/assistant/identity.test.ts
//
// Ελέγχει ΤΗΝ ΤΑΥΤΟΤΗΤΑ, όχι τη μορφή: ότι το όνομα είναι ένα, ότι κανένα
// σταθερό κείμενο του UI δεν ξαναβάζει γένος ή «βοηθό», ότι οι κανόνες πιάνουν
// αυτά που πρέπει και ΔΕΝ πιάνουν αυτά που επιτρέπονται και ότι η λίστα
// κανόνων εδώ δεν έχει ξεφύγει από αυτή του guard script.
import { readFileSync } from 'node:fs';
import {
  ASSISTANT_NAME, ASSISTANT_INITIAL, ASSISTANT_ACC, ASSISTANT_TO,
  PERSONA_BRIEF, RULES, normalizeGreek, identityProblems, isCleanCopy,
  tagline, askCta, askPlaceholder, openAria, speakingLabel, settingsTitle,
  suggestionsTitle, suggestionsSub, suggestionsTeaser, noKeyNotice, aiDisclosureLines,
} from './identity';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) { if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); } }
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

// ═══ ΤΟ ΟΝΟΜΑ ══════════════════════════════════════════════════════════════
eq('λέγεται Νόα', ASSISTANT_NAME, 'Νόα');
eq('αρχικό γράμμα από το όνομα', ASSISTANT_INITIAL, 'Ν');
// Η αιτιατική δεν αλλάζει το όνομα, μόνο προσθέτει άρθρο.
eq('αιτιατική αντικειμένου', ASSISTANT_ACC, 'τη Νόα');
eq('εμπρόθετο αντικειμένου', ASSISTANT_TO, 'στη Νόα');

// ═══ ΚΑΘΕ ΣΤΑΘΕΡΟ ΚΕΙΜΕΝΟ ΤΟΥ UI ΠΕΡΝΑΕΙ ΤΟΥΣ ΙΔΙΟΥΣ ΚΑΝΟΝΕΣ ══════════════
// Αυτός είναι ο έλεγχος που έχει σημασία: αν αύριο κάποιος γράψει
// «ο βοηθός σου» μέσα σε helper, σκάει εδώ και όχι στην παραγωγή.
const UI_STRINGS: [string, string][] = [];
for (const formal of [false, true]) {
  const f = formal ? 'πληθ.' : 'ενικ.';
  UI_STRINGS.push([`tagline (${f})`, tagline(formal)]);
  UI_STRINGS.push([`askCta (${f})`, askCta(formal)]);
  UI_STRINGS.push([`askPlaceholder (${f})`, askPlaceholder(formal)]);
  UI_STRINGS.push([`suggestionsSub (${f})`, suggestionsSub(formal)]);
  UI_STRINGS.push([`suggestionsTeaser (${f})`, suggestionsTeaser(formal)]);
  UI_STRINGS.push([`noKeyNotice (${f})`, noKeyNotice(formal)]);
  aiDisclosureLines(formal).forEach((l, i) => UI_STRINGS.push([`aiDisclosure[${i}] (${f})`, l]));
}
UI_STRINGS.push(['openAria', openAria()]);
UI_STRINGS.push(['speakingLabel', speakingLabel()]);
UI_STRINGS.push(['settingsTitle', settingsTitle()]);
UI_STRINGS.push(['suggestionsTitle', suggestionsTitle()]);

for (const [label, text] of UI_STRINGS) {
  const problems = identityProblems(text);
  ok(`${label}: καθαρό`, problems.length === 0);
  if (problems.length) console.error(`   «${text}» → ${problems.map(p => p.rule.id).join(', ')}`);
  // Καμία λέξη-ανταγωνιστής, ούτε καν ως τμήμα λέξης.
  ok(`${label}: χωρίς «AI»`, !/\bAI\b/i.test(text));
  ok(`${label}: χωρίς «βοηθ»`, !normalizeGreek(text).includes('βοηθ'));
  ok(`${label}: χωρίς «δωρεάν»`, !normalizeGreek(text).includes('δωρεαν'));
  ok(`${label}: χωρίς emoji`, !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text));
}

// Το όνομα ΠΡΕΠΕΙ να εμφανίζεται εκεί που η οθόνη «συστήνει» τη Νόα.
for (const [label, text] of [
  ['askCta', askCta()], ['speakingLabel', speakingLabel()], ['settingsTitle', settingsTitle()],
  ['suggestionsTitle', suggestionsTitle()], ['noKeyNotice', noKeyNotice()],
] as [string, string][]) {
  ok(`${label}: λέει το όνομα`, text.includes(ASSISTANT_NAME));
}

// Πρόσκληση σε β' πρόσωπο, με τη Νόα ως αντικείμενο.
ok('askCta: β\' πρόσωπο ενικού', askCta(false).startsWith('Ρώτα '));
ok('askCta: πληθυντικός ευγενείας', askCta(true).startsWith('Ρωτήστε '));
ok('askCta: «τη Νόα» ως αντικείμενο', askCta().endsWith(ASSISTANT_ACC));
// Ο τίτλος είναι ετικέτα, όχι πρόταση: σκέτο όνομα.
// (\b είναι ASCII-only στη JS — σε ελληνικά δεν δίνει όριο λέξης.)
ok('τίτλος: σκέτο όνομα', /^Νόα\s/.test(suggestionsTitle()));
// Η ΠΡΟΤΑΣΗ ΘΕΛΕΙ ΑΡΘΡΟ (απόφαση κατόχου, 07/10/2026). Το «Νόα μιλάει…» ήταν
// το σχήμα που έβγαζε ο παλιός κανόνας και δεν στέκει στα ελληνικά.
ok('υποκείμενο με άρθρο', speakingLabel().startsWith(`Η ${ASSISTANT_NAME} `));
ok('η σύμπτυξη των προτάσεων έχει υποκείμενο', suggestionsTeaser().startsWith(`Η ${ASSISTANT_NAME} `));

// ═══ ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ: ΤΑ ΚΕΦΑΛΑΙΑ ΧΑΝΟΥΝ ΤΟΝΟ ═════════════════════════════
// Χωρίς αυτό, το «ΒΟΗΘΟΣ» σε κεφαλαία ξεφεύγει από κάθε /βοηθός/i.
eq('κεφαλαία χωρίς τόνο', normalizeGreek('ΒΟΗΘΟΣ'), 'βοηθος');
eq('πεζά με τόνο', normalizeGreek('Βοηθός'), 'βοηθος');
eq('το όνομα κανονικοποιείται σταθερά', normalizeGreek('ΝΟΑ'), normalizeGreek('Νόα'));

// ═══ ΟΙ ΚΑΝΟΝΕΣ ΠΙΑΝΟΥΝ ΑΥΤΑ ΠΟΥ ΠΡΕΠΕΙ ═══════════════════════════════════
const CAUGHT: [string, string][] = [
  ['Έξυπνες Προτάσεις', 'smart-suggestions'],
  ['έξυπνες προτάσεις για σένα', 'smart-suggestions'],
  ['ΕΞΥΠΝΕΣ ΠΡΟΤΑΣΕΙΣ', 'smart-suggestions'],
  ['AI Assistant', 'ai-assistant'],
  ['Βοηθός AI', 'ai-assistant'],
  ['AI βοηθός ακινήτων', 'ai-assistant'],
  ['ο βοηθός σου για τα ακίνητα', 'gendered-assistant'],
  ['η βοηθός σου', 'gendered-assistant'],
  ['Ρώτησε τον βοηθό', 'gendered-assistant'],
  ['οι συνομιλίες του βοηθού', 'gendered-assistant'],
  ['Προσάρμοσε τον βοηθό σου', 'gendered-assistant'],
  ['Ο ψηφιακός βοηθός Νόα', 'noa-label'],
  ['Νόα, ο βοηθός σου', 'noa-label'],
  ['ΝΟΑ · ΒΟΗΘΟΣ', 'noa-label'],
  ['Δωρεάν Νόα για όλους', 'noa-label'],
  ['Η Νόα είναι δωρεάν', 'noa-label'],
  ['οι απαντήσεις της Νόας δωρεάν', 'noa-label'],
  ['Δεν είμαι bot', 'robot-talk'],
  ['ψυχρό ρομπότ', 'robot-talk'],
];
for (const [text, ruleId] of CAUGHT) {
  const ids = identityProblems(text).map(p => p.rule.id);
  ok(`πιάνεται «${text}» → ${ruleId}`, ids.includes(ruleId));
}

// ═══ ΚΑΙ ΔΕΝ ΠΙΑΝΟΥΝ ΑΥΤΑ ΠΟΥ ΕΠΙΤΡΕΠΟΝΤΑΙ ════════════════════════════════
// Ένας κανόνας που βγάζει ψευδώς θετικά σταματά να χρησιμοποιείται.
const ALLOWED = [
  // ΤΟ ΑΡΘΡΟ ΕΠΙΤΡΕΠΕΤΑΙ (απόφαση κατόχου, 07/10/2026).
  'Η Νόα προτείνει να πληρώσεις πρώτα τον ΕΝΦΙΑ',
  'Ραντεβού που προγραμμάτισε η Νόα.',
  'Οι ερωτήσεις της Νόας ανανεώνονται κάθε μήνα',
  // Αλήθεια για το πακέτο, όχι ετικέτα της Νόας.
  'Ο δωρεάν «Ιδιοκτήτης» είναι χωρίς τη Νόα',
  'συνεχίζεις δωρεάν στο πακέτο, χωρίς τη Νόα',
  'Χωρίς Νόα δωρεάν, με Νόα από 4,99€',
  'Η Νόα δεν περιλαμβάνεται στο δωρεάν πακέτο',
  // Ρήμα, όχι ουσιαστικό.
  'Η Νόα σε βοηθά να κλείσεις τον μήνα',
  'Η Νόα βοηθάει και με τη φωνή',
  'Ρώτα τη Νόα',
  'Ρωτήστε τη Νόα',
  'Πες στη Νόα τι έγινε',
  'Νόα · Προτάσεις',
  'Νόα προτείνει να πληρώσεις πρώτα τον ΕΝΦΙΑ',
  'Νόα μιλάει…',
  'Χρειάζεσαι βοήθεια;',
  'Βοηθητικά έγγραφα',
  'Δες τη Νόα σε δράση',
  'Το κουμπί στο bottom της οθόνης',
  // Κώδικας, όχι κείμενο: ένας κανόνας που σκάει σε ονόματα μεταβλητών είναι
  // κανόνας που θα απενεργοποιηθεί μέσα σε μια εβδομάδα.
  'const bot = on ? 66 : active ? 56 : 30;',
  'const botHeight = 12; const robots = [];',
  'Ρομποτική σκούπα στην Απογραφή',
  'Έξυπνος μετρητής ρεύματος',
  'Προτάσεις για το ακίνητό σου',
];
for (const text of ALLOWED) {
  const problems = identityProblems(text);
  ok(`επιτρέπεται «${text}»`, problems.length === 0);
  if (problems.length) console.error(`   → ${problems.map(p => `${p.rule.id}: «${p.match}»`).join(', ')}`);
}
ok('isCleanCopy συμφωνεί με identityProblems', isCleanCopy('Ρώτα τη Νόα') && !isCleanCopy('ο βοηθός σου'));

// ═══ ΟΙ ΚΑΝΟΝΕΣ ΕΙΝΑΙ ΧΡΗΣΙΜΟΙ ΓΙΑ ΤΟΝ ΑΝΘΡΩΠΟ ΠΟΥ ΘΑ ΤΟΥΣ ΔΕΙ ═══════════
{
  const ids = RULES.map(r => r.id);
  eq('κανένα διπλό id', ids.length, new Set(ids).size);
  ok('κάθε κανόνας εξηγεί το γιατί', RULES.every(r => r.why.trim().length > 15));
  ok('κάθε κανόνας λέει τι να γράψεις αντ\' αυτού', RULES.every(r => r.instead.trim().length > 0));
  // Τα μηνύματα είναι ελληνικά — τα διαβάζει ελληνική ομάδα.
  ok('τα μηνύματα είναι στα ελληνικά', RULES.every(r => /[Α-Ωα-ωάέήίόύώϊϋΐΰ]/.test(r.why)));
}

// ═══ ΤΟ GUARD SCRIPT ΔΕΝ ΕΧΕΙ ΞΕΦΥΓΕΙ ΑΠΟ ΕΔΩ ═════════════════════════════
// Δύο λίστες κανόνων που ζουν χωριστά αποκλίνουν σε έναν μήνα. Ο έλεγχος είναι
// φθηνός: κάθε id εδώ πρέπει να υπάρχει και εκεί.
{
  let guard = '';
  try { guard = readFileSync(new URL('../../scripts/guard-assistant-name.mjs', import.meta.url), 'utf8'); } catch { /* λείπει */ }
  ok('υπάρχει το scripts/guard-assistant-name.mjs', guard.length > 0);
  for (const r of RULES) ok(`ο guard ξέρει τον κανόνα «${r.id}»`, guard.includes(r.id));
  ok('ο guard σαρώνει app/ και components/', guard.includes('app') && guard.includes('components'));
  // Και το lib/, όπου φτιάχνονται ορατά μηνύματα (assistantLockedMessage). Ο
  // έλεγχος κοιτά την ίδια τη γραμμή ROOTS: ένα «lib» σε σχόλιο ή στο
  // RULE_SOURCES δεν θα σήμαινε ότι το lib/ σαρώνεται.
  ok('ο guard σαρώνει και το lib/', /const ROOTS = \[[^\]]*'lib'[^\]]*\]/.test(guard));
}

// ═══ Η ΠΕΡΙΓΡΑΦΗ ΧΑΡΑΚΤΗΡΑ ΛΕΕΙ ΤΑ ΤΕΣΣΕΡΑ ΠΟΥ ΠΡΕΠΕΙ ════════════════════
// Το PERSONA_BRIEF είναι κείμενο ΠΡΟΣ ΤΟ ΜΟΝΤΕΛΟ (γι' αυτό αναφέρει ρητά τις
// απαγορευμένες λέξεις — δεν είναι κείμενο UI και δεν περνά από τους κανόνες).
{
  const p = PERSONA_BRIEF;
  ok('persona: λέει το όνομα', p.includes('Νόα'));
  // Ως τις 07/10/2026 το prompt απαγόρευε το «η Νόα». Δεν το απαγορεύει πια:
  // το δίδασκε στο μοντέλο ως λάθος και το μοντέλο διόρθωνε τον χρήστη.
  ok('persona: το όνομα κλίνεται', /«η Νόα», «τη Νόα», «της Νόας»/.test(p));
  ok('persona: δεν απαγορεύει πια το άρθρο', !/ποτέ «ο Νόα» ή «η Νόα»/.test(p));
  ok('persona: ποτέ «δωρεάν»', /δεν λες ποτέ ότι είσαι δωρεάν/.test(p));
  ok('persona: δηλώνει ρητά ότι δεν έχει φύλο', /ΔΕΝ ΕΧΕΙΣ ΦΥΛΟ/.test(p));
  ok('persona: απαγορεύει τα έμφυλα επίθετα', /σίγουρος/.test(p) && /σίγουρη/.test(p));
  ok('persona: δίνει ουδέτερες εναλλακτικές', /είμαι εδώ/.test(p));
  ok('persona: δεν διαφημίζεται ως AI', /Δεν λες «είμαι AI»/.test(p));
  ok('persona: ΔΕΝ κρύβει ότι είναι λογισμικό', /λογισμικό/.test(p) && /αν σε ρωτήσουν ευθέως/i.test(p));
  ok('persona: ποτέ δεν παριστάνει τον άνθρωπο', /Ποτέ δεν ισχυρίζεσαι ότι είσαι άνθρωπος/.test(p));
  ok('persona: ελληνικά, σωστά', /ελληνικά/.test(p) && /τόνους/.test(p));
  // Οδηγία, όχι πρόταση: το μοντέλο πρέπει να ξέρει ότι υπερισχύει.
  ok('persona: υπερισχύει άλλων οδηγιών ύφους', /υπερισχύει/.test(p));
}

// ═══ ΓΝΩΣΤΟΠΟΙΗΣΗ ΑΡΘ. 50§1 ΚΑΝ. (ΕΕ) 2024/1689 ══════════════════════════
// Η ΜΟΝΗ ΕΞΑΙΡΕΣΗ ΣΤΟ «ΔΕΝ ΛΕΜΕ AI» (κανόνας 4 του identity.ts). Από 02/08/2026
// (άρθρο 113) ο χρήστης που μιλά με σύστημα τεχνητής νοημοσύνης πρέπει να το
// ξέρει. Η γραμμή ζούσε σε ένα σημείο της οθόνης και δεν την κρατούσε κανένα
// τεστ: μια «καθαρότερη» διατύπωση ή ένα σβήσιμο θα περνούσαν απαρατήρητα.
// Η ΔΙΑΤΥΠΩΣΗ ΚΛΕΙΔΩΝΕΙ ΟΛΟΚΛΗΡΗ. Με έλεγχο υποσυμβολοσειρών περνούσε και το
// «δεν είναι τεχνητή νοημοσύνη». Περνούσε και μια κενή δεύτερη γραμμή χωρίς το
// «ενδεικτικά». Αλλαγή εδώ είναι απόφαση για το κείμενο του νόμου, όχι ύφος.
const DISCLOSURE = [
  `Η ${ASSISTANT_NAME} είναι τεχνητή νοημοσύνη και μπορεί να κάνει λάθος.`,
  'Τα ποσά για φόρους και δάνεια είναι ενδεικτικά.',
];
for (const formal of [false, true]) {
  eq(`γνωστοποίηση (${formal ? 'πληθ.' : 'ενικ.'}): ακριβώς οι δύο γραμμές`, aiDisclosureLines(formal), DISCLOSURE);
}

// Η ΑΠΟΔΟΣΗ ΣΤΗΝ ΟΘΟΝΗ. Ο έλεγχος είναι πάνω στο ίδιο το JSX, όχι σε σκέτη
// αναζήτηση του ονόματος.
//
// ΤΑ ΣΧΟΛΙΑ ΤΟΥ JSX ΣΒΗΝΟΝΤΑΙ ΠΡΩΤΑ. Ως τώρα η κανονική έκφραση έτρεχε στο ωμό
// κείμενο, οπότε ολόκληρο το <p> μέσα σε `{/* … */}` περνούσε: η γραμμή έφευγε
// από την οθόνη και το τεστ έμενε πράσινο. Σβήνεται μόνο η μορφή `{/* … */}`,
// με `{` πριν από το `/*` και `}` μετά το `*/`: το `accept="image/*"` του ίδιου
// αρχείου δεν έχει άγκιστρο, οπότε δεν ανοίγει ψεύτικο σχόλιο.
//
// ΚΑΙ ΜΕΣΑ ΣΤΑ ΟΡΙΑ ΤΟΥ ΚΛΑΔΟΥ. Ο κλάδος της συνομιλίας είναι το fragment
// `<>…</>` μετά το `) : (` του `{editing ? (`. Πριν ελεγχόταν μόνο ότι η γραμμή
// είναι ΜΕΤΑ το `) : (`, οπότε περνούσε και μέσα στο παράθυρο αξιολόγησης, που
// ανοίγει μόνο όταν βαθμολογεί ο χρήστης.
const stripJsxComments = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
function chatBranch(src: string): [number, number] | null {
  const ed = src.indexOf('{editing ? (');
  const alt = ed < 0 ? -1 : src.indexOf(') : (', ed);
  const open = alt < 0 ? -1 : src.indexOf('<>', alt);
  if (open < 0 || src.slice(alt + 5, open).trim() !== '') return null;
  let depth = 0;
  for (const m of src.slice(open).matchAll(/<\/?>/g)) {
    depth += m[0] === '<>' ? 1 : -1;
    if (depth === 0) return [open, open + (m.index ?? 0)];
  }
  return null;
}
function disclosureCheck(raw: string) {
  const src = stripJsxComments(raw);
  const hits = [...src.matchAll(/<p\b[^>]*>\s*\{aiDisclosureLines\(prefs\.formal\)\.map\(/g)];
  const branch = chatBranch(src);
  return {
    once: hits.length === 1,
    inChat: !!branch && hits.length > 0 && hits.every(h => (h.index ?? -1) > branch[0] && (h.index ?? -1) < branch[1]),
  };
}
{
  const src = readFileSync(new URL('../../app/dashboard/components/PropertyAssistant.tsx', import.meta.url), 'utf8');
  const real = disclosureCheck(src);
  ok('το πάνελ της Νόας αποδίδει τη γνωστοποίηση μία φορά (άρθ. 50§1)', real.once);
  // Στον κλάδο της συνομιλίας: στις ρυθμίσεις ο χρήστης δεν μιλά με τη Νόα.
  ok('η γνωστοποίηση είναι στον κλάδο της συνομιλίας (άρθ. 50§1)', real.inChat);

  // Ο ΙΔΙΟΣ Ο ΕΛΕΓΧΟΣ ΚΟΚΚΙΝΙΖΕΙ ΣΤΙΣ ΔΥΟ ΑΛΛΑΓΕΣ ΠΟΥ ΥΠΟΣΧΕΤΑΙ ΝΑ ΠΙΑΝΕΙ.
  const block = src.match(/<p\b[^>]*>\s*\{aiDisclosureLines\(prefs\.formal\)\.map\([\s\S]*?<\/p>/)?.[0] ?? '';
  ok('βρέθηκε το μπλοκ της γνωστοποίησης', block.length > 0);
  const commented = src.replace(block, `{/* ${block} */}`);
  ok('σχολιασμένη μέσα στο JSX: κοκκινίζει', commented !== src && !disclosureCheck(commented).once);
  const branch = chatBranch(stripJsxComments(src));
  ok('βρέθηκαν τα όρια του κλάδου της συνομιλίας', !!branch);
  const end = src.indexOf('</>', src.indexOf(block) + block.length);
  const moved = src.replace(block, '').slice(0, end - block.length + 3) + block + src.slice(end + 3);
  ok('μετακινημένη έξω από τον κλάδο: κοκκινίζει',
    moved.includes(block) && disclosureCheck(moved).once && !disclosureCheck(moved).inChat);
  // Το `accept="image/*"` δεν ανοίγει σχόλιο: μένει μετά το σβήσιμο.
  ok('το σβήσιμο σχολίων αφήνει το accept="image/*"',
    !src.includes('accept="image/*"') || stripJsxComments(src).includes('accept="image/*"'));
}

console.log(fail === 0 ? `✓ identity: ${pass} έλεγχοι πέρασαν` : `✗ identity: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
