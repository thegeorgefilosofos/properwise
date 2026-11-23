// npx tsx lib/mydata/review.test.ts
//
// Η ΚΑΡΤΑ «ΓΙΑ ΕΛΕΓΧΟ»: ΜΙΑ ΠΡΟΤΑΣΗ, ΜΙΑ ΚΑΤΗΓΟΡΙΑ, ΕΝΑ ΚΟΥΜΠΙ.
//
// Ο κινητήρας δίνει κωδικούς (review_reasons)· εδώ γίνονται μία πρόταση με τη
// σειρά σημασίας και η πρόταση κατηγορίας (πρώτα ό,τι ξέρει το μητρώο, μετά
// η τελευταία επιλογή του χρήστη, μετά το όνομα του εκδότη).
import { reviewLine, suggestedCategory, asksBankPayment, displayName } from './review';
import { PROVIDERS, KIND_CATEGORY } from './providers';
import { BANK_PAYMENT_LIMIT_CENTS } from './limits';
import { fe } from '../core/format';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name); } };

const POWER = PROVIDERS.find(p => p.kind === 'electricity')!;

ok('όριο: η πρόταση γράφει το ποσό από τη σταθερά', (reviewLine(['over_limit']) ?? '').includes(fe(BANK_PAYMENT_LIMIT_CENTS / 100)));
ok('όριο: προηγείται του νέου παρόχου', (reviewLine(['new_provider', 'over_limit']) ?? '').includes(fe(BANK_PAYMENT_LIMIT_CENTS / 100)));
ok('όριο: η πρόταση λέει την πηγή', (reviewLine(['over_limit']) ?? '').includes('άρθρο 23 ΚΦΕ'));
ok('πιστωτικό: λέει ότι αφαιρείται', /αφαιρείται/.test(reviewLine(['credit']) ?? ''));
ok('νέος γνωστός πάροχος: οι επόμενοι μπαίνουν μόνοι τους', /μόνοι τους/.test(reviewLine(['new_provider']) ?? ''));
ok('άγνωστος: ρωτά αν αφορά ακίνητο', /ακίνητο/.test(reviewLine(['new_provider', 'unknown_provider']) ?? ''));
ok('άγνωστος: δεν υπόσχεται αυτόματο', !/μόνοι τους/.test(reviewLine(['new_provider', 'unknown_provider']) ?? ''));
ok('νέος πάροχος με δύο ακίνητα: δεν υπόσχεται αυτόματο', !/μόνοι τους/.test(reviewLine(['new_provider'], { manyProperties: true }) ?? ''));
ok('δύο ακίνητα: ζητά ακίνητο', /ακίνητο/.test(reviewLine(['pick_property']) ?? ''));
ok('ασυνήθιστο ποσό: διπλάσιο', /διπλάσιο/.test(reviewLine(['unusual_amount']) ?? ''));
ok('κανένας λόγος: καμία πρόταση', reviewLine([]) === null);
ok('άγνωστος κωδικός: αγνοείται', reviewLine(['drop_table']) === null);
for (const r of ['over_limit', 'credit', 'amounts', 'unusual_amount', 'doc_type', 'new_provider', 'unknown_provider', 'pick_property']) {
  const line = reviewLine([r]) ?? '';
  ok(`${r}: μία πρόταση`, line.length > 10 && line.length < 140);
  ok(`${r}: χωρίς κόμμα πριν από «και»`, !/,\sκαι\s/.test(line));
  ok(`${r}: χωρίς παύλα`, !/[—–]/.test(line));
}

ok('ερώτηση τράπεζας μόνο πάνω από το όριο', asksBankPayment(['over_limit']) && !asksBankPayment(['new_provider']));

ok('κατηγορία: από το μητρώο', suggestedCategory({ counterpart_afm: POWER.afm, counterpart_name: null, category: null }) === KIND_CATEGORY.electricity.slug);
ok('κατηγορία: από τη βάση (τελευταία επιλογή)', suggestedCategory({ counterpart_afm: '099000049', counterpart_name: null, category: 'plumber' }) === 'plumber');
ok('κατηγορία: η βάση πριν από το μητρώο', suggestedCategory({ counterpart_afm: POWER.afm, counterpart_name: null, category: 'repair' }) === 'repair');
ok('κατηγορία: από το όνομα του εκδότη', suggestedCategory({ counterpart_afm: '099000049', counterpart_name: 'Υδραυλικός Παπαδόπουλος', category: null }) === 'plumber');
ok('κατηγορία: άγνωστη κατηγορία της βάσης δεν περνά', suggestedCategory({ counterpart_afm: '099000049', counterpart_name: null, category: 'nope' }) === '');
ok('κατηγορία: τίποτα γνωστό: κενό', suggestedCategory({ counterpart_afm: '099000049', counterpart_name: null, category: null }) === '');

ok('όνομα: το μητρώο αντί για ΑΦΜ', displayName({ counterpart_afm: POWER.afm, counterpart_name: null }) === POWER.name);
ok('όνομα: η επωνυμία του εκδότη', displayName({ counterpart_afm: '099000049', counterpart_name: 'Υδραυλικές Εργασίες' }) === 'Υδραυλικές Εργασίες');
ok('όνομα: αλλιώς ΑΦΜ', displayName({ counterpart_afm: '099000049', counterpart_name: null }) === 'ΑΦΜ 099000049');

console.log(`mydata review: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
