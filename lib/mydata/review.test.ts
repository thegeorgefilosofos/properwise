// npx tsx lib/mydata/review.test.ts
//
// Η ΚΑΡΤΑ «ΓΙΑ ΕΛΕΓΧΟ»: ΜΙΑ ΠΡΟΤΑΣΗ, ΜΙΑ ΚΑΤΗΓΟΡΙΑ, ΕΝΑ ΚΟΥΜΠΙ.
//
// Ο κινητήρας δίνει κωδικούς (review_reasons)· εδώ γίνονται μία πρόταση με τη
// σειρά σημασίας και η πρόταση κατηγορίας (πρώτα ό,τι ξέρει το μητρώο, μετά
// η τελευταία επιλογή του χρήστη, μετά το όνομα του εκδότη).
import { reviewLine, suggestedCategory, asksPayment, paymentFields, PAYMENT_CHOICES, displayName } from './review';
import { PROVIDERS, KIND_CATEGORY } from './providers';
import { BANK_PAYMENT_LIMIT_CENTS } from './limits';
import { fe } from '../core/format';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name); } };

const POWER = PROVIDERS.find(p => p.kind === 'electricity')!;

ok('όριο: η πρόταση γράφει το ποσό από τη σταθερά', (reviewLine(['over_limit']) ?? '').includes(fe(BANK_PAYMENT_LIMIT_CENTS / 100)));
ok('όριο: προηγείται του νέου παρόχου', (reviewLine(['new_provider', 'over_limit']) ?? '').includes(fe(BANK_PAYMENT_LIMIT_CENTS / 100)));
ok('ανεπιβεβαίωτος πάροχος: δική του πρόταση', /επιβεβαιωθεί/.test(reviewLine(['provider_unchecked']) ?? ''));
// Θωράκιση 24/11/2026 (Κ1 λογιστικού, Μ6 νομικού): καμία φορολογική κρίση.
ok('όριο: χωρίς «εκπίπτει» και χωρίς άρθρο', !/εκπίπτ|άρθρο/i.test(reviewLine(['over_limit']) ?? ''));
ok('όριο: λέει ότι μετριέται η καθαρή αξία', /καθαρ/i.test(reviewLine(['over_limit']) ?? ''));
ok('πιστωτικό: προηγείται του ορίου', /αφαιρείται/.test(reviewLine(['over_limit', 'credit']) ?? ''));
ok('πιστωτικό: λέει ότι αφαιρείται', /αφαιρείται/.test(reviewLine(['credit']) ?? ''));
// Σ1 λογιστικού: η επιβεβαίωση μίας φοράς δεν υπόσχεται πια αυτόματο.
ok('νέος γνωστός πάροχος: καμία υπόσχεση αυτόματου', !/μόνοι τους|αυτόματα|Σωστό/.test(reviewLine(['new_provider']) ?? ''));
ok('άγνωστος: ρωτά αν αφορά ακίνητο', /ακίνητο/.test(reviewLine(['new_provider', 'unknown_provider']) ?? ''));
ok('άγνωστος: δεν υπόσχεται αυτόματο', !/μόνοι τους/.test(reviewLine(['new_provider', 'unknown_provider']) ?? ''));
ok('νέος πάροχος με δύο ακίνητα: δεν υπόσχεται αυτόματο', !/μόνοι τους/.test(reviewLine(['new_provider'], { manyProperties: true }) ?? ''));
ok('δύο ακίνητα: ζητά ακίνητο', /ακίνητο/.test(reviewLine(['pick_property']) ?? ''));
ok('ασυνήθιστο ποσό: διπλάσιο', /διπλάσιο/.test(reviewLine(['unusual_amount']) ?? ''));
ok('κανένας λόγος: καμία πρόταση', reviewLine([]) === null);
ok('άγνωστος κωδικός: αγνοείται', reviewLine(['drop_table']) === null);
for (const r of ['over_limit', 'credit', 'amounts', 'unusual_amount', 'doc_type', 'new_provider', 'provider_unchecked', 'unknown_provider', 'pick_property']) {
  const line = reviewLine([r]) ?? '';
  ok(`${r}: μία πρόταση`, line.length > 10 && line.length < 140);
  ok(`${r}: χωρίς κόμμα πριν από «και»`, !/,\sκαι\s/.test(line));
  ok(`${r}: χωρίς παύλα`, !/[—–]/.test(line));
  ok(`${r}: χωρίς «εκπίπτει»`, !/εκπίπτ/i.test(line));
}

// «Πώς πληρώθηκε;» (Κ1 και Σ4 λογιστικού): σε κάθε ποσό για ανακαίνιση, αλλιώς
// με καθαρή αξία (προ ΦΠΑ) πάνω από το όριο· ποτέ σε πιστωτικό.
const L = BANK_PAYMENT_LIMIT_CENTS;
ok('πληρωμή: ανακαίνιση 10,00€: ρωτά', asksPayment({ is_credit: false, net_cents: 1000 }, 'renovation'));
ok('πληρωμή: ρεύμα με καθαρό στο όριο: δεν ρωτά', !asksPayment({ is_credit: false, net_cents: L }, 'electricity'));
ok('πληρωμή: ρεύμα με καθαρό ένα λεπτό πάνω: ρωτά', asksPayment({ is_credit: false, net_cents: L + 1 }, 'electricity'));
ok('πληρωμή: πιστωτικό πάνω από το όριο: δεν ρωτά', !asksPayment({ is_credit: true, net_cents: L * 3 }, 'electricity'));
ok('πληρωμή: πιστωτικό ανακαίνισης: δεν ρωτά', !asksPayment({ is_credit: true, net_cents: 1000 }, 'renovation'));
ok('πληρωμή: τρεις επιλογές με τη σειρά', PAYMENT_CHOICES.map(c => c.key).join() === 'bank,cash,unpaid');
ok('πληρωμή: καμία επιλογή δεν λέει «εκπίπτει»', PAYMENT_CHOICES.every(c => !/εκπίπτ/i.test(c.label)));
{
  const bank = paymentFields('bank', '');
  ok('πληρωμή: τράπεζα χωρίς ημερομηνία: πληρωμένη, ημερομηνία κενή', bank.paid === true && bank.payment_method === 'Ηλεκτρονική πληρωμή' && bank.paid_on === null);
  const cash = paymentFields('cash', '2026-11-30');
  ok('πληρωμή: μετρητά με ημερομηνία του χρήστη', cash.paid === true && cash.payment_method === 'Μετρητά' && cash.paid_on === '2026-11-30');
  const unpaid = paymentFields('unpaid', '2026-11-30');
  ok('πληρωμή: δεν πληρώθηκε: τίποτα πληρωμένο, καμία ημερομηνία', unpaid.paid === false && unpaid.payment_method === null && unpaid.paid_on === null);
  ok('πληρωμή: χωρίς απάντηση: όχι πληρωμένη', paymentFields(null, '').paid === false);
  ok('πληρωμή: άκυρη ημερομηνία δεν περνά', paymentFields('bank', '30/11/2026').paid_on === null);
}

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
