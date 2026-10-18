// npx tsx app/dashboard/components/insurance/catalog.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΑΤΑΛΟΓΟΣ ΑΣΦΑΛΕΙΑΣ: ΚΑΜΙΑ ΤΙΜΗ ΧΩΡΙΣ ΠΗΓΗ, ΚΑΝΕΝΑ «0€» ΣΤΗ ΣΥΓΚΡΙΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (12/10/2026). Η ανάγνωση της ομάδας στις σελίδες και στα
// IPID των εταιρειών βρήκε περίπου σαράντα ποσά του καταλόγου που δεν τα
// δημοσίευε καμία εταιρεία, ονόματα προγραμμάτων που δεν υπάρχουν σε επτά
// εταιρείες και τη Magenta μετρημένη ως δεύτερη εταιρεία δίπλα στη Hellas
// Direct, της οποίας πουλά τα προγράμματα. Εδώ φυλάσσονται:
//   1. τα αναγνωριστικά που μπορεί να είναι αποθηκευμένα στις ρυθμίσεις χρηστών,
//   2. καμία τιμή χωρίς ποσό, μονάδα, σενάριο, ημερομηνία ανάγνωσης και πηγή,
//   3. πρόγραμμα χωρίς τιμή δεν κατατάσσεται και δεν «κοστίζει 0»,
//   4. Magenta και Hellas Direct μετρούν ως μία εταιρεία,
//   5. η σημαία ΕΝΦΙΑ μόνο με σεισμό, πυρκαγιά και πλημμύρα μαζί, σε
//      πρόγραμμα κατοικίας χωρίς σήμανση,
//   6. ημερομηνίες και σημάνσεις που λένε την αλήθεια, μαζί και για τις
//      καλύψεις που δεν καταγράφηκαν,
//   8. ό,τι γράφει η οθόνη της Ασφάλειας από τον κατάλογο: η τιμή στη μονάδα
//      της εταιρείας, ο επιλογέας χωρίς ανύπαρκτα προγράμματα, η γραμμή ΕΝΦΙΑ
//      με τους τρεις κινδύνους, το «δεν καλύπτει» χωρίς τα προαιρετικά, η ίδια
//      εταιρεία ξανά χωρίς σβήσιμο, το πλήθος των επιχειρήσεων (στην αρχική
//      μόνο όσες διαβάστηκαν) και το σύνολο. Οι κανόνες ελέγχονται εδώ και η
//      8θ διαβάζει το BillsInsurance.tsx ότι τους καλεί.
// Με τον κατάλογο και την οθόνη πριν από την αλλαγή, κοκκινίζουν οι ενότητες
// 2 έως 6 και 8.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import {
  INSURANCE_COMPANIES, INSURANCE_VERIFIED, INSURANCE_PRICE_CAVEAT, distinctInsurers,
  computeLiveQuotes, pricedQuotes, insuranceSwitchFinding, deriveCoverages,
  countInsurers, planOptionLabel, pickablePlans, coverBasis, COVER_BASIS_NOTE,
  showsEnfiaPerils, insuranceMonthly, insuranceTotalNote, CONTENTS_ONLY_NOTE,
  READ_INSURERS, coverWarning, companyChange,
} from './catalog';
import { insuranceCoversEnfiaPerils } from '../EnfiaPanel';
import * as catalogModule from './catalog';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.error(`✗ ${name}`, extra ?? ''); }
};

const plans = INSURANCE_COMPANIES.flatMap(c => c.plans.map(p => ({ c, p })));
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Ίδιο περιεχόμενο, ανεξάρτητα από τη σειρά των κλειδιών. */
const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const fireOf = (covers: string[] | undefined) => deriveCoverages(covers ?? [], false, false, false)[0].ok;

// ── 1. Τα αναγνωριστικά που μπορεί να είναι αποθηκευμένα ───────────────────
// Το `insProvider` και το `insPlanId` ζουν στο bills_settings (section
// insurance) κάθε ακινήτου. Αυτή είναι η λίστα πριν από τις 12/10/2026: κανένα
// δεν σβήνεται και κανένα δεν αλλάζει εταιρεία.
const STORED: Record<string, string[]> = {
  hellas_direct: ['hd_ktirio', 'hd_perieh', 'hd_full', 'hd_full_eq'],
  interamerican: ['im_basic', 'im_extra', 'im_comfort', 'im_total'],
  anytime:       ['any_eco', 'any_val', 'any_prem'],
  eurolife:      ['el_ess', 'el_plus', 'el_total'],
  generali:      ['gen_basic', 'gen_plus', 'gen_prem'],
  axa:           ['axa_basic', 'axa_plus', 'axa_prem'],
  ethniki:       ['eth_fh_basic', 'eth_fh_extra', 'eth_fh_advance', 'eth_fh_max'],
  allianz:       ['al_comp', 'al_comf', 'al_plus'],
  ergo:          ['ergo_basic', 'ergo_plus', 'ergo_prem'],
  groupama:      ['grp_basic', 'grp_conf', 'grp_allr'],
  cosmote_ins:   ['ci_basic', 'ci_plus', 'ci_total'],
  interlife:     ['il_basic', 'il_plus', 'il_prem'],
  metlife:       ['ml_prot', 'ml_comf'],
  atlantiki:     ['at_class', 'at_extra', 'at_prem'],
  intesaloniki:  ['is_vasi', 'is_plir'],
  aig:           ['aig_allr', 'aig_plus'],
  other:         ['other_custom'],
};
for (const [company, ids] of Object.entries(STORED)) {
  const c = INSURANCE_COMPANIES.find(x => x.value === company);
  ok(`${company}: η εταιρεία μένει`, !!c);
  for (const id of ids) ok(`${company}/${id}: το αναγνωριστικό μένει, στην ίδια εταιρεία`, !!c?.plans.some(p => p.id === id));
}
ok('κανένα αναγνωριστικό προγράμματος δύο φορές', new Set(plans.map(x => x.p.id)).size === plans.length);

// ── 2. Καμία τιμή χωρίς πηγή, ημερομηνία και σενάριο ───────────────────────
type Price = { amount: number; unit: string; from?: boolean; scenario?: string; checkedAt?: string; source?: string; url?: string };
const priceOk = (pr: Price | undefined) => !!pr && pr.amount > 0
  && (pr.unit === 'month' || pr.unit === 'year')
  && !!pr.scenario?.trim() && ISO.test(pr.checkedAt ?? '')
  && /^https:\/\//.test(pr.url ?? '') && !!pr.source?.trim();

for (const { c, p } of plans) {
  const pr: Price | undefined = p.price;
  if (!(p.monthly > 0 || pr || p.priceFact)) continue;
  const where = `${c.value}/${p.id}`;
  ok(`${where}: τιμή μόνο με ποσό, μονάδα, σενάριο, ημερομηνία και πηγή`, priceOk(pr), pr);
  ok(`${where}: η γραμμή της οθόνης έχει διεύθυνση και ημερομηνία`, /^https:\/\//.test(p.priceFact?.url ?? '') && ISO.test(p.priceFact?.checkedAt ?? ''));
  ok(`${where}: η γραμμή της οθόνης γράφει το σενάριο`, !!pr?.scenario && (p.priceFact?.label ?? '').includes(pr.scenario));
  ok(`${where}: πρόγραμμα με σήμανση δεν έχει τιμή`, !p.status);
  // ΕΤΗΣΙΟ ΔΕΝ ΔΙΑΙΡΕΙΤΑΙ ΜΕ ΤΟ 12. Το `monthly` της οθόνης είναι το ποσό μόνο
  // όταν η εταιρεία το δίνει ανά μήνα.
  ok(`${where}: το μηνιαίο της οθόνης μόνο από μηνιαία τιμή`, p.monthly === (pr?.unit === 'month' ? pr.amount : 0), { monthly: p.monthly, pr });
}
for (const c of INSURANCE_COMPANIES) {
  if (!c.fromPrice) continue;
  ok(`${c.value}: το «από» με σενάριο, ημερομηνία και πηγή`, priceOk(c.fromPrice) && c.fromPrice.from === true, c.fromPrice);
}

// ΤΑ ΔΗΜΟΣΙΕΥΜΕΝΑ ΠΟΣΑ, ΟΝΟΜΑΣΤΙΚΑ. Νέα τιμή μπαίνει εδώ συνειδητά, με την
// πηγή της στον κατάλογο· ποσό που εμφανίζεται χωρίς να γραφτεί εδώ κοκκινίζει.
// Ανάγνωση 12/10/2026: Εθνική, Anytime με Κωτσόβολος, Magenta, ERGO.
const PUBLISHED: Record<string, [number, string]> = {
  eth_fh_advance: [15, 'month'],
  any_kots_3k: [19, 'year'], any_kots_10k: [39, 'year'],
  mg_basic_b: [47, 'year'], mg_basic_bc: [60, 'year'],
  mg_eq_b: [115, 'year'], mg_eq_bc: [141, 'year'],
  mg_full_b: [146, 'year'], mg_full_bc: [185, 'year'],
};
const priced = Object.fromEntries(plans.filter(x => x.p.price).map(x => [x.p.id, [x.p.price!.amount, x.p.price!.unit]]));
ok('τα ποσά του καταλόγου είναι ακριβώς τα δημοσιευμένα', same(priced, PUBLISHED), priced);
const FROM: Record<string, [number, string]> = { ergo: [12, 'month'], cosmote_ins: [81, 'year'] };
const froms = Object.fromEntries(INSURANCE_COMPANIES.filter(c => c.fromPrice).map(c => [c.value, [c.fromPrice!.amount, c.fromPrice!.unit]]));
ok('τα «από» είναι ακριβώς τα δημοσιευμένα', same(froms, FROM), froms);

// ── 3. Χωρίς τιμή: ούτε κατάταξη ούτε «0€» ─────────────────────────────────
const pool = pricedQuotes(80, 150000, 0, 'second', 'y10_14');
const eligible = plans.filter(x => x.c.value !== 'other' && x.p.kind === 'home' && !x.p.status && x.p.price?.unit === 'month');
ok('στην κατάταξη μπαίνουν μόνο προγράμματα κατοικίας με δημοσιευμένη μηνιαία τιμή',
  pool.length === eligible.length && pool.every(q => eligible.some(e => e.p.id === q.plan)), pool.map(q => q.plan));
ok('καμία εκτίμηση χωρίς πηγή', pool.every(q => /^https:\/\//.test(q.priceFact?.url ?? '')));
ok('καμία εκτίμηση μηδέν', pool.every(q => q.monthlyEstimate > 0 && q.annualEstimate > 0));
for (const { c, p } of plans) {
  if (p.price) continue;
  const where = `${c.value}/${p.id}`;
  ok(`${where}: χωρίς τιμή δεν κατατάσσεται`, !pool.some(q => q.plan === p.id));
  ok(`${where}: χωρίς τιμή η οθόνη δεν παίρνει ποσό ούτε γραμμή πηγής`, p.monthly === 0 && !p.priceFact);
  // Το «τι πληρώνεις» δεν βγαίνει από πρόγραμμα χωρίς τιμή: χωρίς ποσό από τον
  // ίδιο τον χρήστη δεν υπάρχει σύγκριση ούτε ειδοποίηση.
  ok(`${where}: χωρίς τιμή και χωρίς ποσό του χρήστη, καμία ειδοποίηση`,
    insuranceSwitchFinding({ insProvider: c.value, insPlanId: p.id, insSqm: '80', insPropValue: '150000' }) === null);
}
// Το σενάριο της πηγής δίνει ακριβώς το ποσό της πηγής.
ok('Εθνική: 80 τ.μ. δίνουν τα 15€ της σελίδας', pool.find(q => q.plan === 'eth_fh_advance')?.monthlyEstimate === 15);
// ΣΥΓΚΡΙΣΗ ΜΕ ΜΙΑ ΕΤΑΙΡΕΙΑ ΔΕΝ ΕΙΝΑΙ ΣΥΓΚΡΙΣΗ: η πύλη του computeLiveQuotes.
const live = computeLiveQuotes(80, 150000, 0, 'second', 'y10_14');
ok('σύγκριση μόνο με δύο εταιρείες και πάνω',
  distinctInsurers(pool.map(q => q.company)) >= 2 ? live.length === pool.length : live.length === 0, { pool: pool.length, live: live.length });

// ── 4. Magenta και Hellas Direct: μία εταιρεία ─────────────────────────────
ok('Magenta και Hellas Direct μετρούν ως μία', distinctInsurers(['hellas_direct', 'cosmote_ins']) === 1);
ok('Anytime και Interamerican μετρούν ως μία', distinctInsurers(['interamerican', 'anytime']) === 1);
const brands = INSURANCE_COMPANIES.filter(c => /^https:\/\//.test(c.url)).map(c => c.value);
ok('οι μάρκες του καταλόγου είναι δύο περισσότερες από τις εταιρείες', distinctInsurers(brands) === brands.length - 2, { brands: brands.length, insurers: distinctInsurers(brands) });

// ── 5. ΕΝΦΙΑ: σεισμός, πυρκαγιά και πλημμύρα μαζί ──────────────────────────
// ΚΑΛΥΨΕΙΣ ΧΩΡΙΣ ΠΗΓΗ ΔΕΝ ΒΕΒΑΙΩΝΟΥΝ ΤΙΠΟΤΑ: πρόγραμμα `legacy` ή `unverified`
// δεν παίρνει τη σημαία ΕΝΦΙΑ, ούτε πρόγραμμα μόνο περιεχομένου.
for (const { c, p } of plans) {
  const where = `${c.value}/${p.id}`;
  const want = !p.status && p.kind === 'home' && p.coversRecorded && !!p.earthquake && !!p.flood && fireOf(p.covers);
  ok(`${where}: σημαία ΕΝΦΙΑ μόνο με σεισμό, πυρκαγιά και πλημμύρα`, p.enfiaRisks === want, { enfia: p.enfiaRisks, want });
  if (p.status) ok(`${where}: πρόγραμμα με σήμανση, καμία σημαία ΕΝΦΙΑ`, p.enfiaRisks === false);
  // Η οθόνη άναβε τη μείωση με σεισμό και πλημμύρα μόνο. Ο κανόνας μένει:
  // πρόγραμμα με τις δύο σημαίες και χωρίς πυρκαγιά είναι λάθος καταγραφή.
  if (p.earthquake && p.flood) ok(`${where}: σεισμός και πλημμύρα χωρίς πυρκαγιά`, fireOf(p.covers));
}
// ΠΡΟΑΙΡΕΤΙΚΟΣ ΣΕΙΣΜΟΣ ΔΕΝ ΜΕΤΡΑ: κατά τα IPID της 12/10/2026 ο σεισμός
// προστίθεται με επιπλέον ασφάλιστρο σε αυτά. Η οθόνη δεν μπορεί να πει «μόνο
// αν τον προσθέσεις», οπότε δεν τον δείχνει και δεν τάζει μείωση.
const QUAKE_OPTIONAL = [
  'eth_fh_basic', 'eth_fh_extra', 'eth_fh_advance', 'eth_fh_max',
  'im_classic', 'im_extra', 'im_total',
  'any_eco', 'any_val', 'any_prem',
  'ergo_simple_plus', 'ergo_advanced_plus', 'ergo_total_plus', 'ergo_superior_plus',
];
for (const id of QUAKE_OPTIONAL) {
  const p = plans.find(x => x.p.id === id)?.p;
  ok(`${id}: προαιρετικός σεισμός, όχι σημαία ούτε ΕΝΦΙΑ`, !!p && p.earthquake === false && p.enfiaRisks === false && (p.optional ?? []).includes('Σεισμός'), p);
}
const flag = (id: string) => plans.find(x => x.p.id === id)?.p.enfiaRisks;
ok('ERGO Domus: σεισμός χωρίς πλημμύρα, όχι ΕΝΦΙΑ', flag('ergo_domus') === false);
ok('ERGO Domus Plus: ΕΝΦΙΑ', flag('ergo_domus_plus') === true);
ok('Magenta Βασικό + Σεισμός: ΕΝΦΙΑ, όπως το σημειώνει η σελίδα', flag('mg_eq_b') === true && flag('mg_eq_bc') === true);
ok('Magenta Βασικό: χωρίς σεισμό, όχι ΕΝΦΙΑ', flag('mg_basic_b') === false);
// Τα έντεκα που έβγαιναν ΕΝΦΙΑ με καλύψεις χωρίς πηγή, ονομαστικά.
for (const id of ['el_total', 'gen_prem', 'al_plus', 'ergo_prem', 'grp_allr', 'ci_total', 'axa_prem', 'il_prem', 'ml_comf', 'at_prem', 'aig_plus']) {
  ok(`${id}: καλύψεις χωρίς πηγή, όχι ΕΝΦΙΑ`, flag(id) === false);
}

// ── 6. Ονόματα, σημάνσεις, ημερομηνίες ─────────────────────────────────────
const REAL: Record<string, string[]> = {
  interamerican: ['Classic', 'Extra', 'Total'],
  anytime:       ['Home Economic', 'Home Value', 'Home Premium'],
  ergo:          ['Simple Plus', 'Advanced Plus', 'Total Plus', 'Superior Plus', 'Domus', 'Domus Plus'],
  generali:      ['Home On', 'Home Style'],
  allianz:       ['Sweet House', 'Safe Home Πλήρες', 'Safe Home Exclusive'],
  eurolife:      ['My Home First Standard', 'My Home First Plus'],
  groupama:      ['Maison Eco', 'Maison Value', 'Maison Plus'],
  ethniki:       ['Full Home Basic', 'Full Home Extra', 'Full Home Advance', 'Full Home Max', 'Κατά Παντός Κινδύνου'],
};
for (const [company, names] of Object.entries(REAL)) {
  const c = INSURANCE_COMPANIES.find(x => x.value === company);
  for (const n of names) ok(`${company}: «${n}» υπάρχει χωρίς σήμανση`, !!c?.plans.some(p => p.productName === n && !p.status && p.name.startsWith(n)));
}

// ΚΑΛΥΨΕΙΣ ΠΟΥ ΔΕΝ ΚΑΤΑΓΡΑΦΗΚΑΝ ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΩΣ «ΟΧΙ» ΧΩΡΙΣ ΛΕΞΗ. Η ανάγνωση
// της 12/10/2026 βρήκε αυτά τα προγράμματα χωρίς τις καλύψεις τους· τα
// πλακίδια θα έλεγαν «Όχι» σε όλα, μαζί και στην πυρκαγιά. Νέο πρόγραμμα χωρίς
// καλύψεις μπαίνει εδώ συνειδητά.
// Οι τέσσερις της Hellas Direct είχαν καλύψεις του παλιού καταλόγου, όχι του
// IPID· τα δύο «Πλήρες» της Magenta δανείζονταν τις καλύψεις του «Βασικό».
const UNRECORDED = [
  'hd_ktirio', 'hd_perieh', 'hd_full', 'hd_full_eq', 'mg_full_b', 'mg_full_bc',
  'el_mhf_standard', 'el_mhf_plus', 'gen_home_on', 'gen_home_style',
  'al_sweet_house', 'al_safe_home_full', 'al_safe_home_exclusive',
  'grp_maison_eco', 'grp_maison_value', 'grp_maison_plus',
  'any_kots_3k', 'any_kots_10k',
];
ok('οι καλύψεις λείπουν ακριβώς από τα γνωστά προγράμματα',
  same(Object.fromEntries(plans.filter(x => !x.p.coversRecorded).map(x => [x.p.id, 1])), Object.fromEntries(UNRECORDED.map(id => [id, 1]))),
  plans.filter(x => !x.p.coversRecorded).map(x => x.p.id));
for (const { c, p } of plans) {
  const where = `${c.value}/${p.id}`;
  if (!p.coversRecorded) {
    ok(`${where}: χωρίς καλύψεις, το όνομα το λέει`, p.name === `${p.productName} (καλύψεις δεν καταγράφηκαν, 12/10/2026)`, p.name);
    ok(`${where}: χωρίς καλύψεις, καμία σημαία`, p.covers.length === 0 && !p.earthquake && !p.flood && !p.natural && !p.enfiaRisks);
  }
  // Κενές καλύψεις χωρίς σημαία σημαίνουν «δεν καταγράφηκαν», εκτός από το
  // «Προσαρμοσμένο», που το γεμίζει ο χρήστης.
  if (p.id !== 'other_custom' && p.covers.length === 0 && !p.earthquake && !p.flood && !p.natural) {
    ok(`${where}: κενές καλύψεις μόνο ως «δεν καταγράφηκαν»`, !p.coversRecorded);
  }
}
ok('Allianz: η ελληνική σελίδα', INSURANCE_COMPANIES.find(c => c.value === 'allianz')?.url === 'https://www.allianz.com.gr/el/asfaleia-spitiou');
ok('Eurolife: η σελίδα του My Home First', INSURANCE_COMPANIES.find(c => c.value === 'eurolife')?.url === 'https://www.eurolife.gr/el-GR/proionta/idiotes/katoikia/my-home-first');

for (const c of INSURANCE_COMPANIES) {
  if (c.value === 'other') continue;
  ok(`${c.value}: ημερομηνία ανάγνωσης ή ρητό null`, c.checkedAt === null || ISO.test(c.checkedAt ?? ''), c.checkedAt);
  // Το πρώτο πρόγραμμα επιλέγεται μόλις αλλάξει η εταιρεία: ποτέ ανύπαρκτο.
  ok(`${c.value}: το πρώτο πρόγραμμα δεν είναι ανύπαρκτο`, c.plans[0]?.status !== 'legacy');
  for (const p of c.plans) {
    if (c.checkedAt === null) ok(`${c.value}/${p.id}: εταιρεία χωρίς ανάγνωση, πρόγραμμα με σήμανση`, p.status === 'unverified');
    else ok(`${c.value}/${p.id}: εταιρεία με ανάγνωση, κανένα «μη επαληθευμένο»`, p.status !== 'unverified');
    if (p.status === 'legacy') ok(`${c.value}/${p.id}: το ανύπαρκτο το λέει στο όνομα`, p.name.includes('δεν βρέθηκε στη σελίδα της εταιρείας'));
    if (p.status === 'unverified') ok(`${c.value}/${p.id}: το μη επαληθευμένο το λέει στο όνομα`, p.name.includes('μη επαληθευμένο'));
  }
}

// Η ΗΜΕΡΟΜΗΝΙΑ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΕΙΝΑΙ Η ΠΑΛΑΙΟΤΕΡΗ ΔΗΜΟΣΙΕΥΜΕΝΗ ΤΙΜΗ. Η πύλη
// φρεσκάδας της πρότασης την κοιτάζει· μια πιο φρέσκια θα κρατούσε ζωντανή
// πρόταση πάνω σε τιμή που έχει ήδη παλιώσει.
const readDates = [
  ...plans.filter(x => x.p.price).map(x => x.p.price!.checkedAt),
  ...INSURANCE_COMPANIES.filter(c => c.fromPrice).map(c => c.fromPrice!.checkedAt),
].sort();
ok('η ημερομηνία του καταλόγου είναι της παλαιότερης τιμής', readDates.length > 0 && INSURANCE_VERIFIED === readDates[0], { INSURANCE_VERIFIED, oldest: readDates[0] });

// Ζευγάρι με το data/price-sources.json: ίδιες εταιρείες, ίδιες σελίδες, ίδιες μέρες.
const json = JSON.parse(readFileSync('data/price-sources.json', 'utf8')) as {
  insurance: { checkedAt: string; providerChecks?: { key?: string; url: string; checkedAt: string | null }[] };
};
const checks = json.insurance.providerChecks ?? [];
const companies = INSURANCE_COMPANIES.filter(c => c.value !== 'other');
ok('price-sources: μία εγγραφή ανά εταιρεία', checks.length === companies.length && new Set(checks.map(k => k.key)).size === checks.length, checks.length);
for (const c of companies) {
  const k = checks.find(x => x.key === c.value);
  ok(`price-sources ${c.value}: ίδια σελίδα`, k?.url === c.url, k?.url);
  ok(`price-sources ${c.value}: ίδια ημερομηνία ανάγνωσης`, k !== undefined && k.checkedAt === c.checkedAt, k?.checkedAt);
}

// ── 8. Η οθόνη της Ασφάλειας ───────────────────────────────────────────────
const byId = (id: string) => plans.find(x => x.p.id === id)!;
const label = (id: string) => planOptionLabel(byId(id).p);

// 8α. Ο ΕΠΙΛΟΓΕΑΣ ΓΡΑΦΕΙ ΤΗΝ ΤΙΜΗ ΣΤΗ ΜΟΝΑΔΑ ΤΗΣ ΕΤΑΙΡΕΙΑΣ. Έγραφε «· Χειροκίνητο»
// για κάθε πρόγραμμα χωρίς μηνιαίο ποσό, μαζί και για τα ετήσια της Magenta.
ok('Magenta Βασικό: 47€ τον χρόνο, όχι διαιρεμένο', label('mg_basic_b') === 'Βασικό, κτίριο · 47€ τον χρόνο', label('mg_basic_b'));
ok('Εθνική Advance: 15€ τον μήνα', label('eth_fh_advance') === 'Full Home Advance · 15€ τον μήνα', label('eth_fh_advance'));
ok('Εθνική Basic: τιμή μόνο με προσφορά', label('eth_fh_basic') === 'Full Home Basic · τιμή μόνο με προσφορά', label('eth_fh_basic'));
ok('Κωτσόβολος: «μόνο περιεχόμενο» μία φορά, με την ετήσια τιμή',
  label('any_kots_3k').split('μόνο περιεχόμενο').length === 2 && label('any_kots_3k').endsWith(' · 19€ τον χρόνο'), label('any_kots_3k'));
ok('Hellas Direct Περιεχόμενο: λέει ότι είναι μόνο περιεχόμενο', label('hd_perieh').includes('μόνο περιεχόμενο'), label('hd_perieh'));
ok('Προσαρμοσμένο: χωρίς τιμή στην επιλογή', label('other_custom') === 'Προσαρμοσμένο');
for (const { c, p } of plans) {
  const l = planOptionLabel(p);
  const where = `${c.value}/${p.id}`;
  ok(`${where}: καμία επιλογή «Χειροκίνητο»`, !l.includes('Χειροκίνητο'), l);
  if (p.price) {
    const unit = p.price.unit === 'month' ? 'τον μήνα' : 'τον χρόνο';
    ok(`${where}: η τιμή στη μονάδα της εταιρείας`, l.includes(unit) && (p.priceFact?.label ?? '').includes(unit), l);
    // Ετήσιο ποσό δεν γίνεται μηνιαίο πουθενά: ούτε στην επιλογή ούτε στο «τι πληρώνεις».
    if (p.price.unit === 'year') {
      ok(`${where}: ετήσιο, ούτε «τον μήνα» ούτε δωδέκατο`, !l.includes('τον μήνα') && insuranceMonthly('', p) === 0, l);
    }
  }
  if (p.kind === 'contents') ok(`${where}: μόνο περιεχόμενο, το λέει η επιλογή`, l.includes('μόνο περιεχόμενο'), l);
  if (p.status) ok(`${where}: με σήμανση, χωρίς τιμή στην επιλογή`, l === p.name, l);
}
// Το «από» της εταιρείας, με σενάριο, ημερομηνία και πηγή.
for (const c of INSURANCE_COMPANIES) {
  if (!c.fromPrice) { ok(`${c.value}: χωρίς «από», χωρίς γραμμή`, !c.fromFact); continue; }
  const unit = c.fromPrice.unit === 'month' ? 'τον μήνα' : 'τον χρόνο';
  ok(`${c.value}: η γραμμή του «από» με μονάδα, σενάριο και πηγή`,
    !!c.fromFact && c.fromFact.label.includes(`από `) && c.fromFact.label.includes(unit)
    && c.fromFact.label.includes(c.fromPrice.scenario) && c.fromFact.url === c.fromPrice.url && ISO.test(c.fromFact.checkedAt ?? ''), c.fromFact);
}
ok('ERGO: «από 12€ τον μήνα»', !!INSURANCE_COMPANIES.find(c => c.value === 'ergo')?.fromFact?.label.includes('από 12€ τον μήνα'));

// 8β. ΚΑΝΕΝΑ ΑΝΥΠΑΡΚΤΟ Ή ΜΗ ΕΠΑΛΗΘΕΥΜΕΝΟ ΩΣ ΝΕΑ ΕΠΙΛΟΓΗ. Ο επιλογέας έδινε κάθε
// πρόγραμμα του καταλόγου. Το αποθηκευμένο μένει ορατό σε όποιον το έχει.
for (const c of INSURANCE_COMPANIES) {
  const fresh = pickablePlans(c, '');
  ok(`${c.value}: νέα επιλογή μόνο χωρίς σήμανση`, fresh.every(p => !p.status), fresh.map(p => p.id));
  ok(`${c.value}: όλα τα πραγματικά προγράμματα προσφέρονται`, fresh.length === c.plans.filter(p => !p.status).length);
  for (const p of c.plans.filter(x => x.status)) {
    const kept = pickablePlans(c, p.id);
    ok(`${c.value}/${p.id}: αποθηκευμένο, μένει στον επιλογέα`, kept.some(x => x.id === p.id) && kept.filter(x => x.status).length === 1);
  }
}
ok('ΑΧΑ: κανένα πρόγραμμα προς επιλογή', pickablePlans(INSURANCE_COMPANIES.find(c => c.value === 'axa'), '').length === 0);
ok('χωρίς εταιρεία, κανένα πρόγραμμα', pickablePlans(undefined, 'al_plus').length === 0);

// 8γ. «ΔΕΝ ΚΑΛΥΠΤΕΙ» ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΓΕΓΟΝΟΣ. Η ειδοποίηση της οθόνης βγαίνει
// μόνο με `own` ή `catalog`· τα υπόλοιπα έχουν γραμμή που λέει γιατί.
ok('Hellas Direct: καλύψεις που δεν καταγράφηκαν', ['hd_ktirio', 'hd_perieh', 'hd_full', 'hd_full_eq'].every(id => coverBasis(byId(id).p, false) === 'unrecorded'));
ok('Magenta Πλήρες: καλύψεις που δεν καταγράφηκαν', ['mg_full_b', 'mg_full_bc'].every(id => coverBasis(byId(id).p, false) === 'unrecorded'));
ok('Εθνική Advance: καλύψεις του IPID', coverBasis(byId('eth_fh_advance').p, false) === 'catalog');
ok('MeinHaus Plus: καλύψεις χωρίς πηγή', coverBasis(byId('al_plus').p, false) === 'unsourced');
ok('Προσαρμοσμένο πριν πατηθεί κάτι: άγνωστες', coverBasis(byId('other_custom').p, false) === 'unrecorded');
ok('χωρίς πρόγραμμα: άγνωστες', coverBasis(undefined, false) === 'none');
ok('με δικές σου καλύψεις: δικές σου, σε κάθε πρόγραμμα', plans.every(x => coverBasis(x.p, true) === 'own') && coverBasis(undefined, true) === 'own');
for (const b of ['none', 'unrecorded', 'unsourced'] as const) ok(`γραμμή για «${b}»`, !!COVER_BASIS_NOTE[b]?.includes('Πάτησε όσες'));
ok('καμία γραμμή όταν οι καλύψεις είναι γεγονός', !COVER_BASIS_NOTE.own && !COVER_BASIS_NOTE.catalog);

// 8δ. Η ΓΡΑΜΜΗ ΕΝΦΙΑ ΤΗΣ ΑΣΦΑΛΕΙΑΣ ΘΕΛΕΙ ΚΑΙ ΤΟΥΣ ΤΡΕΙΣ. Ο παλιός κανόνας ήταν
// σεισμός και πλημμύρα, χωρίς πυρκαγιά και χωρίς πηγή.
const oldBadge = (eq: boolean, fl: boolean) => eq && fl;
for (const { c, p } of plans) {
  const where = `${c.value}/${p.id}`;
  ok(`${where}: γραμμή ΕΝΦΙΑ μόνο με τη σημαία του καταλόγου`, showsEnfiaPerils(p, null) === p.enfiaRisks);
  ok(`${where}: ίδια απάντηση με τον πίνακα ΕΝΦΙΑ`,
    showsEnfiaPerils(p, null) === insuranceCoversEnfiaPerils({ insProvider: c.value, insPlanId: p.id }, catalogModule));
}
const own = (covers: string[], earthquake: boolean, flood: boolean) => ({ covers, earthquake, flood, natural: false });
ok('δικές σου: σεισμός και πλημμύρα χωρίς πυρκαγιά, όχι', !showsEnfiaPerils(undefined, own(['Κλοπή'], true, true)) && oldBadge(true, true));
ok('δικές σου: και οι τρεις, ναι', showsEnfiaPerils(undefined, own(['Πυρκαγιά'], true, true)));
ok('δικές σου: χωρίς σεισμό, όχι', !showsEnfiaPerils(byId('eth_fh_advance').p, own(['Πυρκαγιά', 'Πλημμύρα'], false, true)));
ok('μόνο περιεχόμενο: ποτέ, ούτε με τους τρεις', !showsEnfiaPerils(byId('hd_perieh').p, own(['Πυρκαγιά'], true, true)));
ok('MeinHaus Plus: όχι, ενώ ο παλιός κανόνας ναι', !showsEnfiaPerils(byId('al_plus').p, null) && oldBadge(!!byId('al_plus').p.earthquake, !!byId('al_plus').p.flood));
ok('Hellas Direct + Σεισμός: όχι', !showsEnfiaPerils(byId('hd_full_eq').p, null));
ok('Magenta Βασικό + Σεισμός: ναι', showsEnfiaPerils(byId('mg_eq_b').p, null));
// Ίδιος κανόνας με τον πίνακα ΕΝΦΙΑ και για δικές σου καλύψεις.
for (const [covers, eq, fl] of [[['Πυρκαγιά'], true, true], [['Κλοπή'], true, true], [['Πλήρης Κάλυψη'], true, true], [['Πυρκαγιά', 'Πλημμύρα'], true, false], [['Πυρκαγιά'], false, true]] as const) {
  for (const id of ['eth_fh_advance', 'hd_perieh', 'al_plus']) {
    const x = byId(id);
    ok(`${id} με [${covers.join(', ')}] σεισμός ${eq} πλημμύρα ${fl}: ίδια απάντηση με τον πίνακα ΕΝΦΙΑ`,
      showsEnfiaPerils(x.p, own([...covers], eq, fl)) === insuranceCoversEnfiaPerils({
        insProvider: x.c.value, insPlanId: id, insEditCovers: true, insCustomCovers: covers.join(', '),
        insCustomEarthquake: eq, insCustomFlood: fl, insCustomNatural: false,
      }, catalogModule));
  }
}

// 8ε. ΕΠΙΧΕΙΡΗΣΕΙΣ, ΟΧΙ ΜΑΡΚΕΣ. Η οθόνη μετρούσε τις επιλογές του μενού και η
// αρχική τις εταιρείες με διεύθυνση: 16, με τη Magenta και το Anytime δεύτερη φορά.
ok('το «Άλλη Ασφαλιστική» δεν μετρά και η μάρκα μετρά στη μητρική',
  countInsurers([{ value: 'hellas_direct', url: 'https://a' }, { value: 'cosmote_ins', url: 'https://b' }, { value: 'other', url: '' }]) === 1);
ok('ο κατάλογος: δύο επιχειρήσεις λιγότερες από τις μάρκες με διεύθυνση',
  countInsurers(INSURANCE_COMPANIES) === INSURANCE_COMPANIES.filter(c => /^https:\/\//.test(c.url)).length - 2);
// ΣΤΗΝ ΑΡΧΙΚΗ ΜΟΝΟ ΟΣΕΣ ΔΙΑΒΑΣΤΗΚΑΝ. Η αρχική και τα reels έγραφαν «16
// ασφαλιστικές · … σύγκριση ανά κάλυψη» και μετρούσαν και τις έξι εταιρείες που
// η σελίδα τους δεν διαβάστηκε (12/10/2026): χωρίς κανένα πρόγραμμα να
// διαλέξεις και με καλύψεις χωρίς πηγή.
const readCompanies = INSURANCE_COMPANIES.filter(c => c.checkedAt !== null);
ok('μετρούν όσες διαβάστηκαν, η μάρκα στη μητρική', READ_INSURERS === countInsurers(readCompanies) && READ_INSURERS > 0, READ_INSURERS);
ok('οι εταιρείες χωρίς ανάγνωση δεν μετρούν', READ_INSURERS < countInsurers(INSURANCE_COMPANIES), { read: READ_INSURERS, all: countInsurers(INSURANCE_COMPANIES) });
for (const c of INSURANCE_COMPANIES.filter(x => /^https:\/\//.test(x.url))) {
  ok(`${c.value}: μετρά στην αρχική μόνο αν έχει πρόγραμμα να διαλέξεις`, (c.checkedAt !== null) === (pickablePlans(c, '').length > 0), c.checkedAt);
}
{
  const page = readFileSync('app/page.tsx', 'utf8');
  const said = Number(/\{\s*n:\s*'(\d+)',\s*u:\s*'ασφαλιστικές'/.exec(page)?.[1]);
  ok('η αρχική γράφει όσες ασφαλιστικές διαβάστηκαν', said === READ_INSURERS, { said, read: READ_INSURERS });
  for (const reel of ['scripts/marketing/reelTaxi.ts', 'scripts/marketing/reelSeires.ts']) {
    const src = readFileSync(reel, 'utf8');
    ok(`${reel}: το πλήθος από το READ_INSURERS`, /^\s*const (N_INSURERS|NINS) = READ_INSURERS;/m.test(src) && !/countInsurers\(|INSURANCE_COMPANIES\.filter/.test(src));
  }
}

// 8στ. ΤΟ ΣΥΝΟΛΟ ΛΕΕΙ ΟΤΙ ΛΕΙΠΕΙ Η ΑΣΦΑΛΕΙΑ. Χωρίς ποσό τον μήνα η ασφάλεια
// έφευγε από την ανάλυση χωρίς λέξη.
ok('ασφάλεια χωρίς ποσό: η γραμμή το λέει', !!insuranceTotalNote(true, insuranceMonthly('', byId('mg_basic_b').p)));
ok('ασφάλεια με δικό σου ποσό: καμία γραμμή', insuranceTotalNote(true, insuranceMonthly('9', byId('mg_basic_b').p)) === null && insuranceMonthly('9', byId('mg_basic_b').p) === 9);
ok('ασφάλεια με δημοσιευμένη μηνιαία τιμή: καμία γραμμή', insuranceTotalNote(true, insuranceMonthly('', byId('eth_fh_advance').p)) === null);
ok('χωρίς ασφάλεια: καμία γραμμή', insuranceTotalNote(false, 0) === null);

// 8ζ. ΠΡΟΑΙΡΕΤΙΚΟ ΔΕΝ ΕΙΝΑΙ «ΔΕΝ ΚΑΛΥΠΤΕΙ». Η ειδοποίηση έγραφε «Το πρόγραμμά
// σου δεν καλύπτει σεισμό» για κάθε πρόγραμμα χωρίς τη σημαία, μαζί και όπου το
// IPID τον δίνει με επιπλέον ασφάλιστρο.
const oldWarning = (eq: boolean, fl: boolean) =>
  eq && fl ? null : !eq && !fl ? 'Το πρόγραμμά σου δεν καλύπτει σεισμό ούτε πλημμύρα.' : !eq ? 'Το πρόγραμμά σου δεν καλύπτει σεισμό.' : 'Το πρόγραμμά σου δεν καλύπτει πλημμύρα.';
const warnOf = (id: string) => { const p = byId(id).p; return coverWarning(p, coverBasis(p, false), !!p.earthquake, !!p.flood); };
{
  const w = warnOf('eth_fh_advance');
  ok('Full Home Advance: ο σεισμός με επιπλέον ασφάλιστρο, όχι «δεν καλύπτει»',
    !!w && !w.includes('δεν καλύπτει') && w.includes('Full Home Advance') && w.includes('επιπλέον ασφάλιστρο') && w.includes('«Σεισμός»')
    && oldWarning(false, true) === 'Το πρόγραμμά σου δεν καλύπτει σεισμό.', w);
}
{
  const w = warnOf('any_eco');
  ok('Home Economic: σεισμός και πλημμύρα με επιπλέον ασφάλιστρο, όχι «δεν καλύπτει»',
    !!w && !w.includes('δεν καλύπτει') && w.includes('ο σεισμός και η πλημμύρα μπαίνουν') && w.includes('«Πλημμύρα»'), w);
}
{
  const w = warnOf('eth_fh_basic');
  ok('Full Home Basic: πλημμύρα που λείπει, σεισμός με επιπλέον ασφάλιστρο',
    !!w && w.startsWith('Το πρόγραμμά σου δεν καλύπτει πλημμύρα.') && !w.includes('δεν καλύπτει σεισμό') && w.includes('ο σεισμός μπαίνει μόνο με επιπλέον ασφάλιστρο'), w);
}
ok('ERGO Domus: πλημμύρα που λείπει, χωρίς προαιρετικά', warnOf('ergo_domus') === 'Το πρόγραμμά σου δεν καλύπτει πλημμύρα. Σκέψου αναβάθμιση της κάλυψης.', warnOf('ergo_domus'));
ok('Magenta Βασικό: σεισμός που λείπει', warnOf('mg_basic_b') === 'Το πρόγραμμά σου δεν καλύπτει σεισμό. Σκέψου αναβάθμιση της κάλυψης.', warnOf('mg_basic_b'));
ok('ERGO Domus Plus: καλύπτει και τα δύο, καμία ειδοποίηση', warnOf('ergo_domus_plus') === null);
ok('Hellas Direct: καλύψεις που δεν καταγράφηκαν, καμία ειδοποίηση', warnOf('hd_full') === null);
ok('MeinHaus Compact: καλύψεις χωρίς πηγή, καμία ειδοποίηση', warnOf('al_comp') === null);
ok('Προσαρμοσμένο πριν πατηθεί κάτι: καμία ειδοποίηση', warnOf('other_custom') === null);
ok('δικές σου, χωρίς σεισμό και πλημμύρα: γεγονός ακόμη και στο Advance',
  coverWarning(byId('eth_fh_advance').p, 'own', false, false) === 'Το πρόγραμμά σου δεν καλύπτει σεισμό ούτε πλημμύρα. Σκέψου αναβάθμιση της κάλυψης.');
ok('δικές σου, με σεισμό και πλημμύρα: καμία ειδοποίηση', coverWarning(byId('eth_fh_advance').p, 'own', true, true) === null);
for (const { c, p } of plans) {
  const w = warnOf(p.id);
  const where = `${c.value}/${p.id}`;
  for (const peril of (p.optional ?? []).filter(x => x === 'Σεισμός' || x === 'Πλημμύρα')) {
    const word = peril === 'Σεισμός' ? 'σεισμό' : 'πλημμύρα';
    ok(`${where}: προαιρετικό «${peril}», όχι «δεν καλύπτει ${word}»`, !(w ?? '').match(new RegExp(`δεν καλύπτει (\\S+ ούτε )?${word}`)), w);
  }
}

// 8η. Η ΙΔΙΑ ΕΤΑΙΡΕΙΑ ΞΑΝΑ ΔΕΝ ΣΒΗΝΕΙ ΤΙΠΟΤΑ. Ο επιλογέας καλεί το `onChange` και
// για την τρέχουσα επιλογή· η οθόνη γύριζε το πρόγραμμα στο πρώτο και έσβηνε τις
// δικές σου καλύψεις.
ok('ίδια εταιρεία: καμία αλλαγή', companyChange('allianz', 'allianz') === null && companyChange('axa', 'axa') === null);
ok('άλλη εταιρεία: το πρώτο πρόγραμμα του επιλογέα, χωρίς δικές σου καλύψεις',
  JSON.stringify(companyChange('axa', 'ethniki')) === JSON.stringify({ insProvider: 'ethniki', insEditCovers: false, insPlanId: 'eth_fh_basic' }), companyChange('axa', 'ethniki'));
ok('εταιρεία χωρίς πρόγραμμα να διαλέξεις: κανένα', companyChange('allianz', 'axa')?.insPlanId === '');
for (const c of INSURANCE_COMPANIES) {
  const id = companyChange('', c.value)?.insPlanId ?? '';
  ok(`${c.value}: με αλλαγή εταιρείας, ποτέ πρόγραμμα με σήμανση`, id === '' || !c.plans.find(p => p.id === id)?.status, id);
}

// 8θ. Η ΟΘΟΝΗ ΚΑΛΕΙ ΤΟΥΣ ΚΑΝΟΝΕΣ. Οι κανόνες πιο πάνω δεν λένε τίποτα αν το
// BillsInsurance.tsx γράφει ακόμη τους παλιούς δίπλα τους. Διαβάζεται ο κώδικας
// χωρίς τα σχόλια, που περιγράφουν και τους παλιούς.
{
  const screen = readFileSync('app/dashboard/components/BillsInsurance.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const has = (name: string, re: RegExp) => ok(`οθόνη: ${name}`, re.test(screen), re);
  const not = (name: string, re: RegExp) => ok(`οθόνη: ${name}`, !re.test(screen), re);
  has('το πλήθος του μηνύματος από τις επιχειρήσεις', /\{countInsurers\(relevantCompanies\)\}/);
  not('όχι από τις επιλογές του μενού', /insOptions\.length/);
  has('ο επιλογέας από το pickablePlans', /pickablePlans\(insCompany, insPlanId\)/);
  has('η επιλογή από το planOptionLabel', /label: planOptionLabel\(p\)/);
  not('καμία επιλογή «Χειροκίνητο»', /Χειροκίνητο/);
  has('η αλλαγή εταιρείας από το companyChange', /companyChange\(insProvider, v\)/);
  not('καμία άλλη αλλαγή εταιρείας', /insProvider: v\b/);
  has('η ειδοποίηση από το coverWarning', /coverWarning\(insPlan, basis, effectiveEarthquake, effectiveFloodState\)/);
  not('κανένα «δεν καλύπτει» γραμμένο στην οθόνη', /δεν καλύπτει/);
  has('η γραμμή των καλύψεων από το coverBasis', /coverBasis\(insPlan, !!insEditCovers\)/);
  has('η γραμμή κάτω από τα πλακίδια', /\{COVER_BASIS_NOTE\[basis\]\}/);
  has('η γραμμή ΕΝΦΙΑ από το showsEnfiaPerils', /\{showsEnfiaPerils\(insPlan,/);
  not('η γραμμή ΕΝΦΙΑ όχι με σεισμό και πλημμύρα μόνο', /\{effectiveEarthquake && effectiveFloodState && \(/);
  has('το κόστος από το insuranceMonthly', /const insCost\s*= insuranceMonthly\(insCustomPrice, insPlan\)/);
  has('το τρέχον κόστος της σύγκρισης από το insuranceMonthly', /currentMonthly = insuranceMonthly\(insCustomPrice,/);
  not('κανένα monthly του καταλόγου απευθείας', /insPlan\?\.monthly|\)\?\.monthly|\bp\.monthly/);
  has('η τιμή με την πηγή της', /insPlan\?\.priceFact \?\? insCompany\?\.fromFact/);
  has('η γραμμή «μόνο περιεχόμενο»', /\{CONTENTS_ONLY_NOTE\}/);
  has('η επιφύλαξη των τιμών', /\{INSURANCE_PRICE_CAVEAT\}/);
  has('η γραμμή του συνόλου', /\{insuranceTotalNote\(!!insCompany, insCost\) && \(/);
  has('η σημείωση του ημερολογίου με το όνομα του προϊόντος', /\?\.productName \?\? ''\}\. Σύγκρινε/);
  not('όχι με το όνομα με τη σήμανση', /\?\.name \?\? ''\}\. Σύγκρινε/);
}

// ── 7. Το κείμενο που βλέπει ο χρήστης ─────────────────────────────────────
const visible = [
  INSURANCE_PRICE_CAVEAT,
  ...INSURANCE_COMPANIES.flatMap(c => [c.label, c.note, c.agent_label]),
  ...plans.flatMap(x => [x.p.name, x.p.priceFact?.label ?? '', planOptionLabel(x.p)]),
  ...INSURANCE_COMPANIES.map(c => c.fromFact?.label ?? ''),
  ...Object.values(COVER_BASIS_NOTE), CONTENTS_ONLY_NOTE, insuranceTotalNote(true, 0) ?? '',
  ...plans.map(x => warnOf(x.p.id) ?? ''), coverWarning(undefined, 'own', false, false) ?? '',
].filter(Boolean);
for (const s of visible) {
  ok(`κείμενο χωρίς κόμμα πριν από «και»: «${s.slice(0, 50)}»`, !/,\s+(και|κι)\s/.test(s));
  ok(`κείμενο με κολλητό €: «${s.slice(0, 50)}»`, !/\d\s+€/.test(s));
  ok(`κείμενο χωρίς ISO ημερομηνία: «${s.slice(0, 50)}»`, !/\d{4}-\d{2}-\d{2}/.test(s));
  ok(`κείμενο χωρίς «#123»: «${s.slice(0, 50)}»`, !/#\d/.test(s));
  // Η ασφάλιση κατοικίας ΔΕΝ είναι υποχρεωτική για ιδιώτες· κανένα κείμενο του
  // καταλόγου δεν μιλά για υποχρέωση.
  ok(`κείμενο χωρίς «υποχρεωτικ»: «${s.slice(0, 50)}»`, !/υποχρεωτ/i.test(s));
  ok(`κείμενο χωρίς «δωρεάν»: «${s.slice(0, 50)}»`, !/δωρε[άα]ν/i.test(s));
}

// ── Τα κλειδιά των παλιών κτιρίων του ΕΝΦΙΑ (13.10.2026) ──────────────────
// Ο ΕΝΦΙΑ χώρισε από το «26 έτη και άνω» τα κτίρια πριν από το 1930 και τα άνω
// των 100 ετών. Ο κίνδυνος της ασφάλισης δεν πέφτει σιωπηλά στο 1,00 για αυτά.
{
  const at = (age: string) => pricedQuotes(80, 150000, 0, 'second', age).map(q => q.monthlyEstimate).join();
  ok('άνω των 100 ετών: ίδιος κίνδυνος με το 26 έτη και άνω', at('over100') === at('y26_plus'));
  ok('πριν από το 1930: ίδιος κίνδυνος με το 26 έτη και άνω', at('pre1930') === at('y26_plus'));
  ok('και όχι ο κίνδυνος των 10 ετών', at('over100') !== at('y10_14'));
}

console.log(fail ? `✗ insurance catalog: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ insurance catalog: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
