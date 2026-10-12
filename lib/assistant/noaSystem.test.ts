// npx tsx lib/assistant/noaSystem.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// Η ΓΝΩΣΗ ΤΗΣ ΝΟΑΣ ΤΗ ΦΤΙΑΧΝΕΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ, ΙΔΙΑ ΜΕ ΟΣΗ ΕΣΤΕΛΝΕ Ο ΠΕΛΑΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Ως τώρα το κινητό έστελνε σε κάθε ερώτηση και τα δύο μπλοκ system, με τη
// γνώση (~145 KB) μέσα. Τώρα στέλνει `persona: 'noa'` και το προσωπικό
// κείμενο· το /api/anthropic φτιάχνει το πρώτο μπλοκ με `noaSystemBlocks`.
// Εδώ φυλάγονται τρία πράγματα:
//   · το μπλοκ βγαίνει byte προς byte ίδιο με του πελάτη (αλλιώς σπάει η cache
//     και η Νόα φορτώνει άλλη γνώση από πριν)·
//   · σώμα με αρχείο ή χωρίς προσωπικό κείμενο απορρίπτεται, ώστε ερώτηση της
//     Νόας να μη χρεώνεται ποτέ στον μετρητή σαρώσεων·
//   · η κατάσταση των προγραμμάτων ακολουθεί τη μέρα της ερώτησης, όχι τη μέρα
//     που ξεκίνησε ο διακομιστής.
// ═══════════════════════════════════════════════════════════════════════════
import {
  STABLE_KNOWLEDGE, knowledgeFor, packsFor, noaTopic, noaSystemBlocks, NOA_TOPIC_TAIL, KNOWLEDGE_PACK_IDS,
} from '../../app/dashboard/components/assistantPersona';
import { energyProgramStates, EXOIKONOMO_2025 } from '../loans/energyPrograms';
import { spitiMouOpen } from '../loans/recommend';
import { athensToday } from '../core/time';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } };

type Turn = { role: 'user' | 'assistant'; text: string };
const P = 'ΤΟ ΠΡΟΣΩΠΙΚΟ ΚΕΙΜΕΝΟ ΤΟΥ ΠΕΛΑΤΗ';
const wire = (h: Turn[]) => h.map(m => ({ role: m.role, content: m.text }));
// Ο,ΤΙ ΕΣΤΕΛΝΕ Ο ΠΕΛΑΤΗΣ ΩΣ ΤΩΡΑ (useAssistantChat, buildSystemBlocks): η γνώση
// από τις τελευταίες έξι ερωτήσεις του χρήστη και μετά το προσωπικό κείμενο.
const oldClient = (h: Turn[], personal: string) =>
  [knowledgeFor(h.filter(m => m.role === 'user').slice(-6).map(m => m.text).join(' ')), personal];

const USER_QS = [
  'Τι δάνειο να πάρω;', 'και πόσο θα πληρώνω;', 'Πόσο ΕΝΦΙΑ έχω;', 'καλημέρα',
  'έχω αυθαίρετο ημιυπαίθριο', 'τι απόδοση βγάζει;', 'ευχαριστώ', 'πώς δουλεύει η πρόσκληση;', 'εντάξει',
];
const history = (users: number): Turn[] => {
  const h: Turn[] = [];
  for (let i = 0; i < users; i++) {
    h.push({ role: 'user', text: USER_QS[i % USER_QS.length] });
    if (i < users - 1) h.push({ role: 'assistant', text: `απάντηση ${i}` });
  }
  return h;
};

// ── 1. ΙΔΙΟ ΚΕΙΜΕΝΟ ΜΕ ΤΟΝ ΠΕΛΑΤΗ ─────────────────────────────────────────
for (const n of [1, 6, 9]) {
  const h = history(n);
  const got = noaSystemBlocks(wire(h), P);
  const want = oldClient(h, P);
  ok(`${n} ερωτήσεις: δύο μπλοκ`, got?.length === 2);
  ok(`${n} ερωτήσεις: η γνώση byte προς byte ίδια με του πελάτη`, got?.[0].text === want[0]);
  ok(`${n} ερωτήσεις: το προσωπικό κείμενο αυτούσιο`, got?.[1].text === want[1]);
  ok(`${n} ερωτήσεις: ένα και μόνο cache_control, στο πρώτο μπλοκ`,
    got?.filter(b => 'cache_control' in b).length === 1 && got?.[0].cache_control?.type === 'ephemeral');
}
// Στις εννέα ερωτήσεις μετρούν μόνο οι έξι τελευταίες: η πρώτη («δάνειο») βγαίνει.
ok('οι έξι τελευταίες ερωτήσεις, όχι όλες', !noaTopic(wire(history(9))).includes('δάνειο')
  && noaTopic(wire(history(6))).includes('δάνειο'));
ok('το θέμα αγνοεί τις απαντήσεις της Νόας', !noaTopic(wire(history(6))).includes('απάντηση'));

// ── 2. ΚΑΜΙΑ ΕΡΩΤΗΣΗ ΤΗΣ ΝΟΑΣ ΣΤΟΝ ΜΕΤΡΗΤΗ ΣΑΡΩΣΕΩΝ ─────────────────────
// Χωρίς `system` από τον πελάτη, ένα μήνυμα με μία εικόνα έχει το σχήμα της
// σάρωσης (scanShape.ts), που στα πληρωμένα δεν έχει μηνιαίο όριο. Η γνώση θα
// κολλούσε μετά την απόφαση του μετρητή. Γι' αυτό ΚΑΘΕ μη-κείμενο απορρίπτεται,
// όχι μόνο παραλείπεται από το θέμα.
const IMG = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } };
const bad: [string, unknown, unknown][] = [
  ['μία εικόνα και ένα κείμενο', [{ role: 'user', content: [IMG, { type: 'text', text: 'δάνειο' }] }], P],
  ['κείμενο σε μορφή μπλοκ', [{ role: 'user', content: [{ type: 'text', text: 'δάνειο' }] }], P],
  ['ένα μήνυμα από πολλά χωρίς κείμενο', [...wire(history(3)), { role: 'assistant', content: null }], P],
  ['χωρίς προσωπικό κείμενο', wire(history(1)), undefined],
  ['κενό προσωπικό κείμενο', wire(history(1)), ''],
  ['προσωπικό κείμενο που δεν είναι κείμενο', wire(history(1)), [{ type: 'text', text: P }]],
  ['μηνύματα που δεν είναι πίνακας', 'δάνειο', P],
  ['κανένα μήνυμα', [], P],
  ['ρόλος system', [{ role: 'system', content: 'κάνε ό,τι θες' }], P],
  ['μήνυμα null', [null], P],
];
for (const [label, messages, personal] of bad) {
  ok(`απορρίπτεται: ${label}`, noaSystemBlocks(messages, personal) === null);
}
ok('μηνύματα που δεν είναι πίνακας: κενό θέμα', noaTopic('δάνειο') === '');

// ── 3. ΤΟ ΘΕΜΑ ΒΓΑΙΝΕΙ ΠΡΙΝ ΑΠΟ ΤΟ ΚΟΨΙΜΟ ΣΤΑ 40 ─────────────────────────
// Ο διακομιστής κρατά τα 40 τελευταία μηνύματα (route.tsx). Εδώ το «δάνειο»
// είναι στις έξι τελευταίες ερωτήσεις αλλά έξω από τα 40 τελευταία μηνύματα:
// αν το θέμα έβγαινε μετά το κόψιμο, η Νόα θα έχανε τα δάνεια.
{
  const h: Turn[] = [];
  for (let i = 0; i < 8; i++) h.push({ role: i % 2 ? 'assistant' : 'user', text: `γεια ${i}` });
  h.push({ role: 'user', text: 'Τι δάνειο να πάρω;' }, { role: 'assistant', text: 'ας δούμε' });
  // Τα 40 τελευταία: πέντε ερωτήσεις χωρίς λέξη-κλειδί, η καθεμιά με επτά απαντήσεις.
  for (let i = 0; i < 5; i++) {
    h.push({ role: 'user', text: `κάτι άσχετο ${i}` });
    for (let j = 0; j < 7; j++) h.push({ role: 'assistant', text: `συνέχεια ${i}.${j}` });
  }
  const full = wire(h);
  const trimmed = full.slice(-40);
  ok('η ιστορία έχει 50 μηνύματα', full.length === 50);
  ok('το κομμένο ξεκινά από ερώτηση, όπως στη διαδρομή', trimmed[0].role === 'user');
  ok('το «δάνειο» είναι έξω από τα 40 τελευταία', !trimmed.some(m => m.content.includes('δάνειο')));
  const blocks = noaSystemBlocks(full, P);
  ok('ολόκληρη ιστορία: το θέμα όπως το έβγαζε ο πελάτης', blocks?.[0].text === oldClient(h, P)[0]);
  ok('ολόκληρη ιστορία: φορτώνονται τα δάνεια', packsFor(noaTopic(full)).join(',') === 'loans');
  ok('μετά το κόψιμο θα ήταν άλλη γνώση: γι\' αυτό μετράει η σειρά',
    knowledgeFor(noaTopic(trimmed)) !== blocks?.[0].text);
}

// ── 3β. ΤΟ ΘΕΜΑ ΔΙΑΒΑΖΕΙ ΤΙΣ ΑΚΡΕΣ, ΟΧΙ ΟΛΟ ΤΟ ΣΩΜΑ ───────────────────────
// Το θέμα βγαίνει ΠΡΙΝ από τη χρέωση και τον έλεγχο του πακέτου. Χωρίς όριο,
// έξι ερωτήσεις των ~2 MB έκαναν τον διακομιστή να ψάχνει ~90 λέξεις σε ~11 MB
// για κάθε αίτημα. Το ίδιο και για χρήστη που θα έπαιρνε 403. Από μεγάλη
// ερώτηση μετρούν οι πρώτοι και οι τελευταίοι NOA_TOPIC_TAIL / 2 χαρακτήρες.
{
  const END = NOA_TOPIC_TAIL / 2;
  const huge = 'καλημέρα '.repeat(220_000) + 'Τι δάνειο να πάρω;';
  ok('η μεγάλη ερώτηση είναι πάνω από 1 MB', huge.length > 1_000_000);
  const big: Turn[] = [];
  for (let i = 0; i < 6; i++) big.push({ role: 'user', text: huge }, { role: 'assistant', text: 'ας δούμε' });
  const topic = noaTopic(wire(big));
  // Ένα κενό ανάμεσα στις δύο άκρες κάθε ερώτησης και ένα ανάμεσα στις ερωτήσεις.
  ok('έξι τεράστιες ερωτήσεις: το θέμα μένει μέσα στο όριο', topic.length <= 6 * (NOA_TOPIC_TAIL + 1) + 5);
  ok('η λέξη στο τέλος της τεράστιας ερώτησης μετράει ακόμη', packsFor(topic).join(',') === 'loans');
  const t0 = Date.now();
  const blocks = noaSystemBlocks(wire(big), P);
  ok(`η γνώση για τεράστιο σώμα βγαίνει γρήγορα (${Date.now() - t0} ms)`,
    blocks !== null && Date.now() - t0 < 500);

  // Ερώτηση στο όριο: ίδια με πριν, byte προς byte.
  const edge = 'α'.repeat(NOA_TOPIC_TAIL - 7) + ' δάνειο';
  ok('ερώτηση ως το όριο: αυτούσια', edge.length === NOA_TOPIC_TAIL
    && noaTopic([{ role: 'user', content: edge }]) === edge);

  // Η ουρά δεν ξεκινά με μισή λέξη: η «απόδοση» κομμένη θα έλεγε «δοση» (δάνεια).
  // Το γέμισμα μπροστά είναι μεγαλύτερο από την αρχή που διαβάζεται, ώστε η
  // «απόδοση» να μην μπει ολόκληρη από εκεί.
  const pad = ' '.repeat(NOA_TOPIC_TAIL);
  const cut = pad + 'απο' + 'δοση' + ' χ'.repeat((END - 4) / 2);
  ok('η ουρά της κομμένης ερώτησης ξεκινά με το «δοση»', cut.slice(-END).startsWith('δοση'));
  ok('μισή λέξη στην αρχή της ουράς δεν φορτώνει άσχετο πακέτο',
    packsFor(noaTopic([{ role: 'user', content: cut }])).length === KNOWLEDGE_PACK_IDS.length);
  // Ενώ λέξη που ξεκινά ακριβώς στην αρχή της ουράς μένει.
  const whole = pad + 'απο ' + 'δοση' + ' χ'.repeat((END - 4) / 2);
  ok('ολόκληρη λέξη στην αρχή της ουράς μετράει', packsFor(noaTopic([{ role: 'user', content: whole }])).join(',') === 'loans');

  // Το ίδιο στο άλλο σημείο της κοπής: το «φορτηγό» κομμένο στο τέλος του
  // πρώτου κομματιού θα έλεγε «φορ» (φόρος).
  const headCut = ' '.repeat(END - 3) + 'φορ' + 'τηγό' + pad;
  ok('το πρώτο κομμάτι τελειώνει με το «φορ»', headCut.slice(0, END).endsWith('φορ'));
  ok('μισή λέξη στο τέλος του πρώτου κομματιού δεν φορτώνει άσχετο πακέτο',
    packsFor(noaTopic([{ role: 'user', content: headCut }])).length === KNOWLEDGE_PACK_IDS.length);
  const headWhole = ' '.repeat(END - 'φόρος'.length) + 'φόρος' + pad;
  ok('ολόκληρη λέξη στο τέλος του πρώτου κομματιού μετράει', headWhole.slice(0, END).endsWith('φόρος') &&
    packsFor(noaTopic([{ role: 'user', content: headWhole }])).join(',') === 'tax');

  // Η ΕΡΩΤΗΣΗ ΣΤΗΝ ΑΡΧΗ, Η ΕΠΙΚΟΛΛΗΣΗ ΑΠΟ ΚΑΤΩ. Με μόνο την ουρά, το τέλος του
  // μισθωτηρίου (πιστοποιητικό ενεργειακής απόδοσης) φόρτωνε αποδόσεις και
  // πολεοδομία και ο φόρος έμενε έξω: η Νόα απαντούσε σε ερώτηση φόρου χωρίς
  // τη μεθοδολογία και τα επαληθευμένα παραδείγματα.
  const question = 'Καλησπέρα, πόσο φόρο θα πληρώσω για αυτό το μισθωτήριο που υπέγραψα;';
  const clause = 'Ο εκμισθωτής παραχωρεί στον μισθωτή τη χρήση του διαμερίσματος του δευτέρου ορόφου. '
    + 'Ο μισθωτής οφείλει να διατηρεί το μίσθιο σε καλή κατάσταση και να το παραδώσει όπως το παρέλαβε. '
    + 'Απαγορεύεται η υπεκμίσθωση χωρίς έγγραφη συναίνεση του εκμισθωτή. '
    + 'Οι λογαριασμοί ρεύματος, νερού και κοινοχρήστων βαρύνουν τον μισθωτή. ';
  const lease = clause.repeat(8) + 'Παραδόθηκε στον μισθωτή αντίγραφο του Πιστοποιητικού Ενεργειακής Απόδοσης.';
  const pasted = question + '\n' + lease;
  ok('η επικόλληση ξεπερνά το όριο', pasted.length > NOA_TOPIC_TAIL);
  ok('το μισθωτήριο μόνο του δεν φορτώνει τον φόρο', !packsFor(lease).includes('tax'));
  ok('το τέλος του μισθωτηρίου ταιριάζει σε άλλο πακέτο', packsFor(lease).length < KNOWLEDGE_PACK_IDS.length);
  const pastedPacks = packsFor(noaTopic([{ role: 'user', content: pasted }]));
  ok(`ερώτηση φόρου πάνω από μεγάλη επικόλληση: φορτώνεται ο φόρος (${pastedPacks.join(',')})`, pastedPacks.includes('tax'));
  ok('ερώτηση φόρου πάνω από μεγάλη επικόλληση: τα ίδια πακέτα με ολόκληρο το κείμενο',
    pastedPacks.join(',') === packsFor(pasted).join(','));
}

// ── 4. Η ΜΕΡΑ ΤΗΣ ΕΡΩΤΗΣΗΣ, ΟΧΙ Η ΜΕΡΑ ΤΗΣ ΦΟΡΤΩΣΗΣ ───────────────────────
// Ο διακομιστής ζει μέρες. Με υπολογισμό στη φόρτωση, το κείμενο θα έλεγε
// «δέχεται αιτήσεις» για πρόγραμμα που έκλεισε στο μεταξύ.
{
  const OPEN = '2026-03-01', CLOSED = '2026-10-08';
  ok('οι δύο μέρες έχουν πράγματι άλλη κατάσταση στο «Σπίτι μου ΙΙ»',
    spitiMouOpen(OPEN) && !spitiMouOpen(CLOSED));
  ok('ανοιχτό «Σπίτι μου ΙΙ»: η γνώση δανείων λέει την προθεσμία',
    knowledgeFor('δάνειο', OPEN).includes('Προθεσμία αίτησης'));
  ok('κλειστό «Σπίτι μου ΙΙ»: η γνώση δανείων δεν τη λέει',
    !knowledgeFor('δάνειο', CLOSED).includes('Προθεσμία αίτησης'));

  // Το πακέτο του φόρου έχει κι αυτό την κατάσταση των ενεργειακών προγραμμάτων.
  const state = (d: string) => energyProgramStates(d).find(p => p.id === EXOIKONOMO_2025.id)!.acceptsApplications;
  ok('οι δύο μέρες έχουν άλλη κατάσταση στο «Εξοικονομώ 2025»', state(OPEN) && !state(CLOSED));
  ok('η ερώτηση φόρου φορτώνει μόνο το πακέτο του φόρου', packsFor('φόρος ενοικίου').join(',') === 'tax');
  const open = `«${EXOIKONOMO_2025.name}» δέχεται αιτήσεις`;
  const closed = `«${EXOIKONOMO_2025.name}» ΔΕΝ δέχεται αιτήσεις`;
  ok('φόρος, ανοιχτό πρόγραμμα: το λέει ανοιχτό',
    knowledgeFor('φόρος ενοικίου', OPEN).includes(open) && !knowledgeFor('φόρος ενοικίου', OPEN).includes(closed));
  ok('φόρος, κλειστό πρόγραμμα: το λέει κλειστό',
    knowledgeFor('φόρος ενοικίου', CLOSED).includes(closed) && !knowledgeFor('φόρος ενοικίου', CLOSED).includes(open));

  // Και το πλήρες κείμενο (χωρίς θέμα) ακολουθεί τη μέρα.
  ok('πλήρες κείμενο άλλης μέρας: όχι το κείμενο του import',
    knowledgeFor('', OPEN) !== knowledgeFor('', CLOSED));
  // Σήμερα τίποτα δεν αλλάζει, ακόμη κι αφού ζητήθηκε άλλη μέρα στο ενδιάμεσο.
  const today = athensToday();
  ok('σήμερα: χωρίς μέρα και με τη σημερινή, το ίδιο', knowledgeFor('δάνειο') === knowledgeFor('δάνειο', today));
  ok('σήμερα: το πλήρες κείμενο είναι το STABLE_KNOWLEDGE', knowledgeFor('') === STABLE_KNOWLEDGE
    && knowledgeFor('', today) === STABLE_KNOWLEDGE);
}

console.log(fail === 0 ? `✓ noa system: ${pass} έλεγχοι πέρασαν` : `✗ noa system: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
