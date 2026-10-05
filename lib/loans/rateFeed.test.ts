// Η διασταύρωση των επιτοκίων, με τους αριθμούς της παραγωγής (bank_rates, 02/09/2026).
import { fromRate, rangeOf, diffBank, decide, changeKey, HOLD_ABOVE, isOfficialSource, BANK_HOSTS, recomputeFixedMin, type CurrentBank } from './rateFeed';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

// Το μισό εκατοστό προς τα πάνω, όπως στο lib/core/money (αντίγραφο για το Deno).
ok('fromRate: 3,125 → 3,13', fromRate(3.125) === 3.13)
ok('fromRate: 2,115 → 2,12', fromRate(2.115) === 2.12)

// ── Το «από» ενός επιτοκίου ─────────────────────────────────────────────────
ok('εύρος «2.40-4.70» δίνει το χαμηλότερο', fromRate('2.40-4.70') === 2.4);
ok('μονή τιμή «3.40»', fromRate('3.40') === 3.4);
ok('ελληνικό δεκαδικό «3,50»', fromRate('3,50') === 3.5);
ok('αριθμός περνά ως έχει', fromRate(2.4) === 2.4 && fromRate(3) === 3);
ok('κενό → null', fromRate(null) === null && fromRate('—') === null);

// ── Η γραμμή της Πειραιώς όπως ζει στη βάση ────────────────────────────────
const piraeus: CurrentBank = {
  bank_id: 'piraeus', fixed_3yr: '2.40-4.70', fixed_5yr: '2.40-4.70', fixed_10yr: '2.40-4.70',
  fixed_15yr: '2.40-4.70', fixed_20yr: '2.40-4.70', variable_spread_min: 1.4, variable_spread_max: 2.45, max_ltv: 90,
};

ok('ίδιες τιμές: καμία αλλαγή', diffBank(piraeus, { fixed_5yr: 2.4, variable_spread_min: 1.4, max_ltv: 90 }).length === 0);
ok('ισότητα στο εκατοστό: 2,404 δεν είναι αλλαγή', diffBank(piraeus, { fixed_5yr: 2.404 }).length === 0);

const small = diffBank(piraeus, { fixed_5yr: 2.6 });
ok('μικρή άνοδος 2,40→2,60 καταγράφεται με δέλτα +0,20', small.length === 1 && small[0].delta === 0.2 && small[0].old === 2.4);
ok('…και εφαρμόζεται', decide(small, new Set()).apply.length === 1);

const big = diffBank(piraeus, { fixed_5yr: 4.9 });
ok('άλμα 2,40→4,90 κρατιέται στο πρώτο πέρασμα', decide(big, new Set()).hold.length === 1 && decide(big, new Set()).apply.length === 0);
ok('…και εφαρμόζεται όταν το δεύτερο πέρασμα επιστρέψει ΤΗΝ ΙΔΙΑ τιμή', decide(big, new Set([changeKey(big[0])])).apply.length === 1);
ok('…αλλά ΟΧΙ όταν το δεύτερο πέρασμα λέει άλλη τιμή', decide(diffBank(piraeus, { fixed_5yr: 4.8 }), new Set([changeKey(big[0])])).hold.length === 1);

// ── Πρώτη τιμή σε κενό πεδίο δεν είναι «μεταβολή» ──────────────────────────
const empty: CurrentBank = { ...piraeus, bank_id: 'x', fixed_20yr: null, variable_spread_max: null };
const first = diffBank(empty, { fixed_20yr: 4.5, variable_spread_max: 2.9 });
ok('κενό πεδίο: δέλτα null, εφαρμόζεται', first.length === 2 && first.every(c => c.delta === null) && decide(first, new Set()).apply.length === 2);

// ── Το LTV έχει δικό του κατώφλι ───────────────────────────────────────────
ok('LTV 90→80 (10 μονάδες) εφαρμόζεται, 90→75 κρατιέται',
  decide(diffBank(piraeus, { max_ltv: 80 }), new Set()).apply.length === 1
  && decide(diffBank(piraeus, { max_ltv: 75 }), new Set()).hold.length === 1);
ok('το κατώφλι του LTV είναι 10 και των επιτοκίων 1', HOLD_ABOVE.max_ltv === 10 && HOLD_ABOVE.fixed_5yr === 1);

// ── Το κλειδί είναι σταθερό στο εκατοστό ───────────────────────────────────
ok('changeKey στρογγυλεύει στο εκατοστό', changeKey({ bank_id: 'a', field: 'fixed_5yr', next: 3.4 }) === 'a:fixed_5yr:3.40');

// ── Η ΠΗΓΗ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΠΗΓΗ ─────────────────────────────────────────────
// Το κείμενο συστήματος του ενημερωτή έστελνε το μοντέλο σε δύο συγκριτικούς
// ιστότοπους και η τιμή τους έπαιρνε `verified_at` σαν να την είχε δει κανείς
// στην τράπεζα. Αυτοί οι έλεγχοι είναι το φράγμα.
ok('συγκριτικός ιστότοπος ΔΕΝ είναι επίσημη πηγή',
  !isOfficialSource('ethniki', 'https://www.vresdaneio.gr/stegastika')
  && !isOfficialSource('alpha', 'https://e-stegastiko.gr/alpha'));
ok('η σελίδα της ίδιας της τράπεζας είναι',
  isOfficialSource('ethniki', 'https://www.nbg.gr/el/idiwtes/daneia/stegastika-daneia')
  && isOfficialSource('eurobank', 'https://www.eurobank.gr/-/media/eurobank/rates/x.pdf'));
ok('υποτομέας περνά, τομέας που απλώς ΠΕΡΙΕΧΕΙ το όνομα όχι',
  isOfficialSource('alpha', 'https://retail.alpha.gr/x')
  && !isOfficialSource('alpha', 'https://alpha.gr.example.com/x'));
ok('χωρίς διεύθυνση, χωρίς http ή με άγνωστη τράπεζα: όχι',
  !isOfficialSource('alpha', null)
  && !isOfficialSource('alpha', 'http://www.alpha.gr/x')
  && !isOfficialSource('agnosti', 'https://www.alpha.gr/x'));
ok('κάθε τράπεζα του χάρτη έχει τουλάχιστον έναν τομέα',
  Object.values(BANK_HOSTS).every(h => h.length > 0));

// ── Eurobank, 29.09.2026: τιμή μέσα στο εύρος και σελίδα συχνών ερωτήσεων ──
ok('εύρος «2.50-2.90» → [2,50, 2,90]', JSON.stringify(rangeOf('2.50-2.90')) === '[2.5,2.9]');
ok('μονή τιμή δεν είναι εύρος', rangeOf('3.40') === null && rangeOf(2.4) === null && rangeOf(null) === null);
const eurobank: CurrentBank = {
  bank_id: 'eurobank', fixed_3yr: '2.50-2.90', fixed_5yr: '3.40-3.50', fixed_10yr: '3.80-3.90',
  fixed_15yr: '4.10-4.20', fixed_20yr: '4.10-4.20', variable_spread_min: 0.8, variable_spread_max: 2.7, max_ltv: 90,
};
// Αυτό ακριβώς βρήκε η αναζήτηση: το πάνω άκρο κάθε εύρους. Δεν είναι αλλαγή.
ok('Eurobank: το πάνω άκρο κάθε εύρους δεν αλλάζει τίποτα',
  diffBank(eurobank, { fixed_3yr: 2.9, fixed_5yr: 3.5, fixed_10yr: 3.9, fixed_15yr: 4.2, fixed_20yr: 4.2 }).length === 0);
ok('Eurobank: τιμή έξω από το εύρος είναι αλλαγή',
  diffBank(eurobank, { fixed_3yr: 3.1 }).length === 1);
ok('Eurobank: τιμή ανάμεσα στα άκρα είναι αλλαγή του «από»',
  diffBank(eurobank, { fixed_3yr: 2.7 }).length === 1);
ok('σελίδα συχνών ερωτήσεων της ίδιας τράπεζας δεν είναι επίσημη πηγή',
  !isOfficialSource('eurobank', 'https://www.eurobank.gr/el/retail/proionta-upiresies/proionta/daneia/stegastika/stegastiko-daneio/suxnes-erotiseis')
  && !isOfficialSource('alpha', 'https://www.alpha.gr/el/faq/stegastika'));
ok('το δελτίο της ίδιας τράπεζας μένει επίσημο',
  isOfficialSource('eurobank', 'https://www.eurobank.gr/-/media/eurobank/rates/epitokia-daneiakon-proionton.pdf'));

// ── Το fixed_min του δελτίου δεν σβήνει σε πέρασμα χωρίς αλλαγή ─────────
// 05/10/2026: το πέρασμα της Δευτέρας έγραψε 2,90 πάνω στο 2,70 της Alpha (σταθερό
// 1 έτους, χωρίς στήλη), ενώ δεν είχε αλλάξει καμία στήλη.
const alphaCols = { fixed_3yr: '2.90', fixed_5yr: '3.50', fixed_10yr: '3.90', fixed_15yr: '4.20', fixed_20yr: '4.30' };
ok('πέρασμα χωρίς αλλαγή: το fixed_min μένει', recomputeFixedMin([], alphaCols) === null);
ok('αλλαγή μόνο σε περιθώριο: το fixed_min μένει', recomputeFixedMin([{ field: 'variable_spread_min' }], alphaCols) === null);
ok('αλλαγή σε στήλη σταθερού: ξαναϋπολογίζεται', recomputeFixedMin([{ field: 'fixed_3yr' }], { ...alphaCols, fixed_3yr: '2.80' }) === 2.8);
ok('εύρος: μετρά το «από»', recomputeFixedMin([{ field: 'fixed_5yr' }], { fixed_5yr: '2.40-4.70' }) === 2.4);
ok('χωρίς καμία στήλη: καμία τιμή', recomputeFixedMin([{ field: 'fixed_3yr' }], {}) === null);

console.log(fail ? `✗ rateFeed: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ rateFeed: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
