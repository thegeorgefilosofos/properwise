// npx tsx lib/energy/raaey.test.ts
//
// Η ΜΕΤΑΓΡΑΦΗ ΤΟΥ ΠΙΝΑΚΑ ΤΗΣ ΡΑΑΕΥ, ΓΡΑΜΜΗ ΠΡΟΣ ΓΡΑΜΜΗ
//
// Τρία πράγματα ελέγχονται εδώ:
//   1. ο αναγνώστης διαβάζει σωστά κάθε μορφή τιμής που γράφει η ΡΑΑΕΥ
//   2. το αντίγραφο της εφαρμογής (raaeyData.json) λέει ό,τι η μεταγραφή στο data/
//   3. κάθε τιμολόγιο του καταλόγου με `raaey` έχει ΑΚΡΙΒΩΣ τις τιμές της
//      γραμμής του, ή, όταν η ΡΑΑΕΥ δεν έχει ακόμη τιμή, κρατά την παλιά με
//      τον δικό της μήνα και δεν λέει ότι είναι του νέου
import { readFileSync } from 'node:fs';
import { parseRaaeyPrice, parseRaaeyFixed, parseRaaeyDuration, raaeyText, type RaaeyRow, type RaaeySheet } from './raaey';
import { RAAEY_COLUMNS, RAAEY_MONTH, RAAEY_READ_AT, RAAEY_ROWS } from './raaeyCatalogue';
import { RAAEY_MONTH_GEN, RAAEY_REJECTED, raaeyGasPrices, raaeyPrices, raaeyRows, type RaaeyCells } from './raaeyCatalogue';
import { PROVIDERS, ALL_TARIFFS, COMPARABLE_TARIFFS } from './catalogue';
import { GAS_PROVIDERS } from './gas';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
/** «power-residential:28» → η γραμμή. Λάθος σύνδεσμος πετά. */
function raaeyRow(ref: string): RaaeyCells {
  const [sheet, row] = ref.split(':');
  const r = raaeyRows(sheet as RaaeySheet).find(x => x.row === Number(row));
  if (!r) throw new Error(`Ο πίνακας της ΡΑΑΕΥ δεν έχει γραμμή ${ref}.`);
  return r;
}
const notCommerciallyAvailable = (r: Pick<RaaeyRow, 'notes'>) => /μη εμπορικά διαθέσιμο/i.test(r.notes);
function throws(name: string, f: () => unknown) {
  try { f(); fail++; console.error(`✗ ${name}: δεν πέταξε`); } catch { pass++; }
}

// ── 1. Ο ΑΝΑΓΝΩΣΤΗΣ ─────────────────────────────────────────────────────────
{
  eq('απλή τιμή', parseRaaeyPrice('0.1421'), { day: 0.1421, tier2: null, night: null, hasNight: false, moreTiers: false, known: true });
  eq('άγνωστη τιμή', parseRaaeyPrice('Η τιμή δεν είναι ακόμα γνωστή').known, false);
  eq('άγνωστη τιμή: null, όχι μηδέν', parseRaaeyPrice('Η τιμή δεν είναι ακόμα γνωστή').day, null);

  // Enerwave Ειδικό: 0,179 οι πρώτες 100 kWh, 0,339 από την 101η.
  const enrw = parseRaaeyPrice('0KWh - 100KWh / 0.179 101KWh + / 0.339');
  eq('κλίμακα: πρώτη τιμή', enrw.day, 0.179);
  eq('κλίμακα: δεύτερη, πάνω από το όριο', enrw.tier2, { price: 0.339, threshold: 100, scope: 'above' });

  // ΔΕΗ Ειδικό: πάνω από τις 200 kWh η δεύτερη τιμή ισχύει από την 1η kWh.
  const dei = parseRaaeyPrice('0KWh - 200KWh / 0.15913 Εάν η κατανάλωση υπερβεί τις 200KWh η τιμή διαμορφώνεται σε 0.21997 από την 1η KWh Τελική Τιμή Προμήθειας Διζωνικής Κατανάλωσης / 0.1559');
  eq('από την 1η kWh: εμβέλεια', dei.tier2, { price: 0.21997, threshold: 200, scope: 'all' });
  eq('νυχτερινή μετά την κλίμακα', [dei.night, dei.hasNight, dei.known], [0.1559, true, true]);

  const half = parseRaaeyPrice('0KWh - 150KWh / 0.11155 151KWh + / Η τιμή δεν είναι ακόμα γνωστή');
  eq('γνωστή πρώτη, άγνωστη δεύτερη κλίμακα: όχι γνωστή', [half.day, half.tier2?.price, half.known], [0.11155, null, false]);

  throws('κλίμακες που δεν συνέχονται', () => parseRaaeyPrice('0KWh - 100KWh / 0.179 150KWh + / 0.339'));
  throws('κείμενο που δεν είναι τιμή', () => parseRaaeyPrice('περίπου 0,18'));

  eq('πάγιο απλό', parseRaaeyFixed('7.35'), { fixed: 7.35, tier2: null });
  eq('πάγιο με όριο', parseRaaeyFixed('0KWh - 500KWh / 5 501KWh + / 10'), { fixed: 5, tier2: { fixed: 10, threshold: 500 } });
  throws('πάγιο άγνωστο', () => parseRaaeyFixed('Η τιμή δεν είναι ακόμα γνωστή'));
  eq('διάρκεια', [parseRaaeyDuration('12'), parseRaaeyDuration('Αορίστου Διάρκειας')], [12, 0]);
  eq('άγνωστη και με τη γραφή της εφαρμογής', parseRaaeyPrice('Η τιμή δεν είναι ακόμη γνωστή').day, null);
  // Η τυπογραφία της εφαρμογής, χωρίς να αλλάζει αριθμός ή λέξη.
  eq('κείμενο: «&»', raaeyText('ebill & πάγια εντολή'), 'ebill και πάγια εντολή');
  eq('κείμενο: «ακόμα»', raaeyText('Η τιμή δεν είναι ακόμα γνωστή'), 'Η τιμή δεν είναι ακόμη γνωστή');
  eq('κείμενο: «€» και τόνος', raaeyText('Εκπτωση Συνέπειας 0.070 €/kWh'), 'Έκπτωση Συνέπειας 0.070€/kWh');
  ok('μη εμπορικά διαθέσιμο', notCommerciallyAvailable({ notes: 'Από 10/04/2024 το προϊόν είναι μη εμπορικά διαθέσιμο' }));
}

// ── 2. ΚΑΘΕ ΓΡΑΜΜΗ ΔΙΑΒΑΖΕΤΑΙ, ΤΟ ΑΝΤΙΓΡΑΦΟ ΣΥΜΦΩΝΕΙ ΜΕ ΤΗ ΜΕΤΑΓΡΑΦΗ ──────
const SHEETS: RaaeySheet[] = ['power-residential', 'power-business', 'gas-residential', 'gas-business'];
{
  const src = JSON.parse(readFileSync(`data/raaey/energycost-${RAAEY_MONTH}.json`, 'utf8')) as
    { month: string; readAt: string; source: string; sheets: Record<string, { rows: RaaeyRow[] }> };
  eq('μήνας', src.month, RAAEY_MONTH);
  eq('ημέρα ανάγνωσης', src.readAt, RAAEY_READ_AT);
  eq('πηγή', src.source, 'ΡΑΑΕΥ, energycost.gr');
  for (const s of SHEETS) {
    const full = src.sheets[s].rows, app = RAAEY_ROWS[s];
    eq(`${s}: ίδιο πλήθος γραμμών`, app.length, full.length);
    let same = true;
    full.forEach((r, i) => {
      const a = app[i];
      if (RAAEY_COLUMNS.some((c, j) => String(a[j]) !== String(r[c as keyof RaaeyRow]))) same = false;
      if ((a[RAAEY_COLUMNS.length] === 1) !== notCommerciallyAvailable(r)) same = false;
      if (`${r.year}-${r.month.padStart(2, '0')}` !== RAAEY_MONTH) same = false;
    });
    ok(`${s}: κάθε κελί ίδιο με τη μεταγραφή`, same);
    let parsed = 0;
    for (const r of raaeyRows(s)) {
      try { raaeyPrices(r); raaeyPrices(r, 'base'); parseRaaeyDuration(r.duration); parsed++; }
      catch (e) { console.error(`  ${s}:${r.row}: ${(e as Error).message}`); }
    }
    eq(`${s}: κάθε γραμμή διαβάζεται`, parsed, full.length);
  }
}

// ── 3. Ο ΚΑΤΑΛΟΓΟΣ ΤΟΥ ΡΕΥΜΑΤΟΣ ─────────────────────────────────────────────
const power = PROVIDERS.flatMap(p => p.tariffs);
// ΟΙ ΔΥΟ ΓΝΩΣΤΕΣ ΕΞΑΙΡΕΣΕΙΣ, με τον λόγο τους στο catalogue.ts:
//   dei_online: η σύγκριση με την τιμή χωρίς την προωθητική έκπτωση, που
//     φαίνεται χωριστά (`promo_kwh_day`), γιατί η λήξη της δεν είναι γνωστή.
//   dei_prasino: το Γ1 μοιράζεται τη γραμμή με το Γ1Ν και δεν έχει νυχτερινή.
const BASE_PRICE = new Set(['dei_online']);
const NO_NIGHT = new Set(['dei_prasino']);
{
  let linked = 0;
  for (const t of power) {
    if (!t.raaey) continue;
    linked++;
    const r = raaeyRow(t.raaey);
    ok(`${t.id}: φύλλο ίδιου τμήματος`, r.sheet.endsWith(t.segment === 'business' ? 'business' : 'residential') && r.sheet.startsWith('power-'));
    ok(`${t.id}: ίδιο όνομα με τη γραμμή`, r.name.trim() !== '' && t.name.length > 0);
    const p = raaeyPrices(r, BASE_PRICE.has(t.id) ? 'base' : 'discounted');
    if (NO_NIGHT.has(t.id)) {
      p.kwh_night = null;
      const { night: _night, ...rest } = p.undiscounted as { night?: number };
      p.undiscounted = rest as typeof p.undiscounted;
    }
    if (BASE_PRICE.has(t.id)) {
      eq(`${t.id}: η προωθητική τιμή είναι η τιμή με έκπτωση`, t.promo_kwh_day, raaeyPrices(r).kwh_day);
      p.conditions = {};
    }
    if (t.raaeyUnknown) {
      // Η ΡΑΑΕΥ δεν έχει ακόμη τιμή: μένει η παλιά, με τον δικό της μήνα.
      ok(`${t.id}: άγνωστη στη ΡΑΑΕΥ`, !p.known);
      ok(`${t.id}: η παλιά τιμή δεν δείχνεται ως του νέου μήνα`, t.priceMonth !== RAAEY_MONTH_GEN);
      ok(`${t.id}: το κείμενο της ΡΑΑΕΥ`, t.priceText === p.priceText);
      continue;
    }
    eq(`${t.id}: τιμή ημέρας`, t.kwh_day, p.kwh_day);
    eq(`${t.id}: νυχτερινή`, t.kwh_night, p.kwh_night);
    eq(`${t.id}: κλίμακα`, [t.kwh_tier2, t.tier2_threshold, t.tier2_scope], [p.kwh_tier2, p.tier2_threshold, p.tier2_scope]);
    eq(`${t.id}: πάγιο`, t.fixed, p.fixed);
    eq(`${t.id}: χωρίς έκπτωση`, t.undiscounted, p.undiscounted);
    eq(`${t.id}: προϋποθέσεις`, t.conditions ?? {}, p.conditions);
    eq(`${t.id}: διάρκεια`, t.contract_months, parseRaaeyDuration(r.duration));
    if (p.known) eq(`${t.id}: μήνας`, t.priceMonth, RAAEY_MONTH_GEN);
    else ok(`${t.id}: χωρίς τιμή, όχι του νέου μήνα`, t.kwh_day == null && t.priceMonth !== RAAEY_MONTH_GEN);
    if (r.notAvailable) ok(`${t.id}: μη εμπορικά διαθέσιμο`, t.notAvailable === true);
  }
  ok('τιμολόγια ρεύματος συνδεδεμένα με τη ΡΑΑΕΥ', linked > 300);

  // Κανένα νέο τιμολόγιο από γραμμή εκτός αγοράς.
  const added = power.filter(t => t.id.startsWith('rx_'));
  ok('προστέθηκαν τιμολόγια ρεύματος', added.length > 0);
  ok('κανένα προστιθέμενο μη εμπορικά διαθέσιμο', added.every(t => !raaeyRow(t.raaey!).notAvailable));

  // Το μη εμπορικά διαθέσιμο δεν μπαίνει ποτέ στη σύγκριση.
  const nc = ALL_TARIFFS().filter(t => t.notAvailable).map(t => t.id);
  ok('υπάρχουν μη εμπορικά διαθέσιμα στον κατάλογο', nc.length > 0);
  ok('κανένα μη εμπορικά διαθέσιμο στη σύγκριση', COMPARABLE_TARIFFS().every(t => !nc.includes(t.id)));

  // Ο νέος μήνας μόνο όπου η ΡΑΑΕΥ δίνει τιμή.
  ok('ο νέος μήνας μόνο με τιμή', ALL_TARIFFS().every(t => !t.current || t.kwh_day != null || t.type === 'fixed_monthly'));
}

// ── 4. Ο ΚΑΤΑΛΟΓΟΣ ΤΟΥ ΑΕΡΙΟΥ ───────────────────────────────────────────────
const gas = GAS_PROVIDERS.flatMap(p => p.tariffs);
{
  for (const t of gas) {
    if (!t.raaey) continue;
    const r = raaeyRow(t.raaey);
    ok(`${t.id}: φύλλο αερίου ίδιου τμήματος`, r.sheet === `gas-${t.segment}`);
    const p = raaeyGasPrices(r);
    if (t.raaeyUnknown) {
      ok(`${t.id}: άγνωστη στη ΡΑΑΕΥ`, !p.known);
      ok(`${t.id}: η παλιά τιμή με τον δικό της μήνα`, !!t.priceMonth && t.priceMonth !== RAAEY_MONTH_GEN);
      continue;
    }
    eq(`${t.id}: τιμή`, t.kwh, p.kwh);
    eq(`${t.id}: πάγιο`, t.fixed, p.fixed);
    eq(`${t.id}: χωρίς έκπτωση`, t.undiscounted, p.undiscounted);
    eq(`${t.id}: προϋποθέσεις`, t.conditions ?? {}, p.conditions ?? {});
    if (p.known) eq(`${t.id}: μήνας`, t.priceMonth, RAAEY_MONTH_GEN);
    else ok(`${t.id}: χωρίς τιμή, όχι του νέου μήνα`, t.kwh == null && t.priceMonth !== RAAEY_MONTH_GEN);
    if (r.notAvailable) ok(`${t.id}: μη εμπορικά διαθέσιμο`, t.notAvailable === true);
  }
  const added = gas.filter(t => t.id.startsWith('rx_'));
  ok('προστέθηκαν τιμολόγια αερίου', added.length > 0);
  ok('κανένα προστιθέμενο αερίου μη εμπορικά διαθέσιμο', added.every(t => !raaeyRow(t.raaey!).notAvailable));
}

// ── 5. ΟΙ ΓΡΑΜΜΕΣ ΠΟΥ ΔΕΝ ΠΕΡΝΟΥΝ ─────────────────────────────────────────
{
  // EFA ENERGY «PLUS GAS EXTRA BUSINESS»: οδηγία ιδιοκτήτη 05.10.2026.
  const efa = raaeyRow('gas-business:2');
  eq('η γραμμή EFA είναι αυτή που λέει η οδηγία', [efa.provider, efa.name, efa.price, efa.priceDiscounted], ['EFA ENERGY', 'PLUS GAS EXTRA BUSINESS', '0.01191', '0.09665']);
  for (const ref of Object.keys(RAAEY_REJECTED)) {
    ok(`${ref}: δεν είναι στον κατάλογο`, ![...power, ...gas].some(t => t.raaey === ref));
  }
}

console.log(`${fail ? '✗' : '✓'} ΡΑΑΕΥ: ${pass} έλεγχοι πέρασαν${fail ? `, ${fail} απέτυχαν` : ''}`);
if (fail) process.exit(1);
