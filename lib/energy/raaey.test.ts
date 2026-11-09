// npx tsx lib/energy/raaey.test.ts
//
// Η ΜΕΤΑΓΡΑΦΗ ΤΟΥ ΠΙΝΑΚΑ ΤΗΣ ΡΑΑΕΥ, ΓΡΑΜΜΗ ΠΡΟΣ ΓΡΑΜΜΗ
//
// Τρία πράγματα ελέγχονται εδώ:
//   1. ο αναγνώστης διαβάζει σωστά κάθε μορφή τιμής που γράφει η ΡΑΑΕΥ
//   2. τα αντίγραφα της εφαρμογής (raaeyData.json, ο πλήρης πίνακας και
//      raaeyUpdate.json, η αριθμομηχανή του μήνα) λένε ό,τι οι μεταγραφές στο
//      data/ και η αριθμομηχανή μπαίνει πάνω στον πίνακα ΜΟΝΟ με ίδιο πάροχο
//      και ίδιο όνομα
//   3. κάθε τιμολόγιο του καταλόγου με `raaey` έχει ΑΚΡΙΒΩΣ τις τιμές της
//      γραμμής του, ή, όταν η ΡΑΑΕΥ δεν έχει ακόμη τιμή, κρατά την παλιά με
//      τον δικό της μήνα και δεν λέει ότι είναι του νέου, εκτός αν φέρει
//      τιμή του παρόχου με το έγγραφό της (`providerPrice`, μόνο στο αέριο)
import { readFileSync } from 'node:fs';
import RAAEY_DATA from './raaeyData.json';
import { RAAEY_BADGE, parseRaaeyPrice, parseRaaeyFixed, parseRaaeyDuration, raaeyMonthGen, raaeyText, type RaaeyRow, type RaaeySheet } from './raaey';
import { RAAEY_BASE_MONTH, RAAEY_COLUMNS, RAAEY_MONTH, RAAEY_READ_AT, RAAEY_ROWS, RAAEY_UPDATE_COLUMNS, RAAEY_UPDATE_OFFSET, RAAEY_UPDATE_ROWS } from './raaeyCatalogue';
import { RAAEY_MONTH_GEN, RAAEY_REJECTED, raaeyBaseRows, raaeyGasPrices, raaeyKey, raaeyPrices, raaeyRows, raaeyUpdateRows, type RaaeyCells } from './raaeyCatalogue';
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
  eq('κείμενο: «€», τόνος και υποδιαστολή', raaeyText('Εκπτωση Συνέπειας 0.070 €/kWh'), 'Έκπτωση Συνέπειας 0,070€/kWh');
  eq('κείμενο: ποσοστό με υποδιαστολή', raaeyText('Έκπτωση συνέπειας 36.95%'), 'Έκπτωση συνέπειας 36,95%');
  eq('κείμενο: χιλιάδες και ημερομηνίες μένουν', raaeyText('έως 2.000€, από 14.03 - 31.03, έως 30.11.2026'), 'έως 2.000€, από 14.03 - 31.03, έως 30.11.2026');
  eq('κείμενο: kWh', raaeyText('0KWh - 150KWh / 0.11155 151KWh +'), '0 kWh - 150 kWh / 0,11155 151 kWh +');
  eq('κείμενο: λατινικό γράμμα σε ελληνική λέξη', raaeyText('H τιμή. Eπιπλέον δώρο'), 'Η τιμή. Επιπλέον δώρο');
  eq('κείμενο: η ίδια φράση δύο φορές', raaeyText('Πάγια εντολή πληρωμής Πάγια εντολή πληρωμής'), 'Πάγια εντολή πληρωμής');
  ok('μη εμπορικά διαθέσιμο', notCommerciallyAvailable({ notes: 'Από 10/04/2024 το προϊόν είναι μη εμπορικά διαθέσιμο' }));
}

// ── 2. ΚΑΘΕ ΓΡΑΜΜΗ ΔΙΑΒΑΖΕΤΑΙ, ΤΟ ΑΝΤΙΓΡΑΦΟ ΣΥΜΦΩΝΕΙ ΜΕ ΤΗ ΜΕΤΑΓΡΑΦΗ ──────
const SHEETS: RaaeySheet[] = ['power-residential', 'power-business', 'gas-residential', 'gas-business'];
type Source = { month: string; readAt: string; source: string; scope?: string; sheets: Record<string, { rows: (RaaeyRow & { colourFrom?: string })[] }> };
for (const [label, month, readAt, columns, rows, scope] of [
  ['πίνακας', RAAEY_BASE_MONTH, RAAEY_DATA.readAt, RAAEY_COLUMNS, RAAEY_ROWS, undefined],
  ['αριθμομηχανή', RAAEY_MONTH, RAAEY_READ_AT, RAAEY_UPDATE_COLUMNS, RAAEY_UPDATE_ROWS, 'calculator'],
] as const) {
  const src = JSON.parse(readFileSync(`data/raaey/energycost-${month}.json`, 'utf8')) as Source;
  eq(`${label}: μήνας`, src.month, month);
  eq(`${label}: ημέρα ανάγνωσης`, src.readAt, readAt);
  eq(`${label}: πηγή`, src.source, 'ΡΑΑΕΥ, energycost.gr');
  eq(`${label}: εύρος`, src.scope, scope);
  for (const s of SHEETS) {
    const full = src.sheets[s].rows, app = rows[s];
    eq(`${label} ${s}: ίδιο πλήθος γραμμών`, app.length, full.length);
    let same = true;
    full.forEach((r, i) => {
      const a = app[i];
      if (columns.some((c, j) => String(a[j]) !== String(r[c as keyof RaaeyRow]))) same = false;
      if ((a[columns.length] === 1) !== notCommerciallyAvailable(r)) same = false;
      if (`${r.year}-${r.month.padStart(2, '0')}` !== month) same = false;
      if (!RAAEY_BADGE[r.colour]) same = false;
      // Η αριθμομηχανή δεν δίνει χρώμα: κάθε γραμμή λέει από πού ήρθε.
      if (scope && !r.colourFrom?.trim()) same = false;
    });
    ok(`${label} ${s}: κάθε κελί ίδιο με τη μεταγραφή`, same);
  }
}

// Η ΑΡΙΘΜΟΜΗΧΑΝΗ ΠΑΝΩ ΣΤΟΝ ΠΙΝΑΚΑ. Ίδιος πάροχος και ίδιο όνομα: τα κελιά του
// μήνα, ο αριθμός και το χρώμα της γραμμής του πίνακα. Αλλιώς τα κελιά του
// πίνακα με τον μήνα τους. Οι γραμμές της αριθμομηχανής που δεν ταιριάζουν
// μπαίνουν μετά το 1000 και καμία δεν χάνεται.
const CELLS = ['provider', 'name', 'fixed', 'price', 'fixedDiscounted', 'fixedCondition', 'priceDiscounted', 'priceCondition', 'duration', 'notAvailable'] as const;
const sameCells = (a: RaaeyCells, b: RaaeyCells) => CELLS.every(c => a[c] === b[c]);
for (const s of SHEETS) {
  const merged = raaeyRows(s), base = raaeyBaseRows(s), upd = raaeyUpdateRows(s);
  const byKey = new Map(upd.map(u => [raaeyKey(u), u]));
  let overlay = true;
  for (const b of base) {
    const m = merged.find(x => x.row === b.row)!, u = byKey.get(raaeyKey(b));
    if (u) { if (!sameCells(m, u) || m.month !== RAAEY_MONTH || m.colour !== b.colour || m.update !== u.row) overlay = false; }
    else if (!sameCells(m, b) || m.month !== RAAEY_BASE_MONTH || m.update !== undefined) overlay = false;
  }
  ok(`${s}: η αριθμομηχανή μπαίνει μόνο σε ίδιο πάροχο και όνομα`, overlay);
  const added = merged.filter(m => m.row >= RAAEY_UPDATE_OFFSET);
  ok(`${s}: οι νέες γραμμές δεν υπάρχουν στον πίνακα`, added.every(m => !base.some(b => raaeyKey(b) === raaeyKey(m)) && m.row === RAAEY_UPDATE_OFFSET + (m.update as number)));
  eq(`${s}: καμία γραμμή της αριθμομηχανής δεν χάνεται`, [...new Set(merged.filter(m => m.update != null).map(m => m.update))].sort((a, b) => (a as number) - (b as number)), upd.map(u => u.row));
  ok(`${s}: ο πίνακας ήταν μεγαλύτερος από την αριθμομηχανή`, base.length > upd.length);
  let parsed = 0;
  for (const r of merged) {
    try { raaeyPrices(r); raaeyPrices(r, 'base'); parseRaaeyDuration(r.duration); parsed++; }
    catch (e) { console.error(`  ${s}:${r.row}: ${(e as Error).message}`); }
  }
  eq(`${s}: κάθε γραμμή διαβάζεται`, parsed, merged.length);
}
eq('η αντιστοίχιση: «Blue Generous Max HOME 5» είναι νέα γραμμή, όχι η HOME 4',
  raaeyRows('power-residential').filter(r => r.name === 'Blue Generous Max HOME 5').map(r => r.row >= RAAEY_UPDATE_OFFSET), [true]);

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
      ok(`${t.id}: η παλιά τιμή δεν δείχνεται ως του μήνα της γραμμής`, t.priceMonth !== raaeyMonthGen(r.month));
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
    if (p.known) eq(`${t.id}: μήνας`, t.priceMonth, raaeyMonthGen(r.month));
    else ok(`${t.id}: χωρίς τιμή, όχι του μήνα της γραμμής`, t.kwh_day == null && t.priceMonth !== raaeyMonthGen(r.month));
    if (r.notAvailable) ok(`${t.id}: μη εμπορικά διαθέσιμο`, t.notAvailable === true);
  }
  ok('τιμολόγια ρεύματος συνδεδεμένα με τη ΡΑΑΕΥ', linked > 300);

  // ΟΣΑ ΔΕΝ ΕΙΝΑΙ ΣΤΗΝ ΑΡΙΘΜΟΜΗΧΑΝΗ ΔΕΝ ΚΑΤΑΤΑΣΣΟΝΤΑΙ. Η αριθμομηχανή δείχνει
  // όσα διατίθενται τον μήνα του καταλόγου· μια γραμμή του πίνακα που λείπει
  // από αυτήν κρατά τιμή άλλου μήνα και μένει εκτός σειράς.
  const rowOf = (t: { raaey?: string }) => (t.raaey ? raaeyRow(t.raaey) : null);
  eq('καμία τιμή γραμμής εκτός αριθμομηχανής στη σειρά',
    ALL_TARIFFS().filter(t => t.current && rowOf(t) && rowOf(t)!.month !== RAAEY_MONTH).map(t => t.id), []);
  ok('υπάρχουν τιμολόγια ρεύματος που έμειναν στον προηγούμενο μήνα', ALL_TARIFFS().some(t => rowOf(t)?.month === RAAEY_BASE_MONTH && t.priceMonth === raaeyMonthGen(RAAEY_BASE_MONTH)));
  ok('και τιμολόγια ρεύματος του μήνα στη σύγκριση', COMPARABLE_TARIFFS().filter(t => t.current).length >= 40);

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
    // ΤΟ ΧΡΩΜΑ ΕΙΝΑΙ ΤΗΣ ΡΑΑΕΥ ΑΚΟΜΗ ΚΙ ΟΤΑΝ ΔΕΝ ΕΧΕΙ ΤΙΜΗ. Δώδεκα γραμμές ήταν
    // ΜΠΛΕ («σταθερή τιμή για όλη τη διάρκεια») ενώ ο πίνακας του Οκτωβρίου
    // τις γράφει «yellow» (έλεγχος 12/10/2026): ο έλεγχος κοιτούσε μόνο τιμές.
    eq(`${t.id}: χρώμα και τύπος της ΡΑΑΕΥ`, [t.badge, t.type], [RAAEY_BADGE[r.colour]?.badge, RAAEY_BADGE[r.colour]?.type]);
    const p = raaeyGasPrices(r);
    if (t.raaeyUnknown) {
      ok(`${t.id}: άγνωστη στη ΡΑΑΕΥ`, !p.known);
      if (t.providerPrice) {
        // Η ΤΙΜΗ ΤΟΥ ΠΑΡΟΧΟΥ ΓΙΑ ΤΟΝ ΜΗΝΑ ΤΟΥ ΠΙΝΑΚΑ: γράφει τον νέο μήνα, έχει
        // διαβαστεί όχι πριν από τον πίνακα και ό,τι γράφει η ΡΑΑΕΥ (πάγιο,
        // διάρκεια) μένει όπως το γράφει. Η ΤΙΜΗ ΔΕΝ ΣΥΓΚΡΙΝΕΤΑΙ ΕΔΩ: η γραμμή
        // της ΡΑΑΕΥ δεν έχει τιμή. Την ελέγχει το gas.test.ts απέναντι στο
        // κελί του εγγράφου (`providerPrice.cell`), μαζί με την πηγή.
        ok(`${t.id}: τιμή παρόχου του μήνα της γραμμής`, t.priceMonth === raaeyMonthGen(r.month) && r.month === RAAEY_MONTH);
        ok(`${t.id}: διαβάστηκε όχι πριν από τον πίνακα`, t.providerPrice.readAt >= RAAEY_READ_AT);
        eq(`${t.id}: πάγιο της ΡΑΑΕΥ`, t.fixed, p.fixed);
        eq(`${t.id}: διάρκεια της ΡΑΑΕΥ`, t.contract_months, parseRaaeyDuration(r.duration));
        continue;
      }
      ok(`${t.id}: η παλιά τιμή με τον δικό της μήνα`, !!t.priceMonth && t.priceMonth !== raaeyMonthGen(r.month));
      continue;
    }
    ok(`${t.id}: τιμή παρόχου μόνο όπου η ΡΑΑΕΥ δεν έχει τιμή`, !t.providerPrice);
    eq(`${t.id}: τιμή`, t.kwh, p.kwh);
    eq(`${t.id}: πάγιο`, t.fixed, p.fixed);
    eq(`${t.id}: χωρίς έκπτωση`, t.undiscounted, p.undiscounted);
    eq(`${t.id}: προϋποθέσεις`, t.conditions ?? {}, p.conditions ?? {});
    if (p.known) eq(`${t.id}: μήνας`, t.priceMonth, raaeyMonthGen(r.month));
    else ok(`${t.id}: χωρίς τιμή, όχι του μήνα της γραμμής`, t.kwh == null && t.priceMonth !== raaeyMonthGen(r.month));
    if (r.notAvailable) ok(`${t.id}: μη εμπορικά διαθέσιμο`, t.notAvailable === true);
  }
  eq('αέριο: καμία τιμή γραμμής εκτός αριθμομηχανής με τον μήνα του καταλόγου',
    gas.filter(t => t.raaey && t.priceMonth === RAAEY_MONTH_GEN && raaeyRow(t.raaey).month !== RAAEY_MONTH).map(t => t.id), []);
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
  // Η γραμμή της ZeniΘ απορρίφθηκε για την τιμή, όχι για το χρώμα: το
  // `zen_biz_save` κρατά το χρώμα της (έλεγχος 12/10/2026).
  const zs = raaeyRow('gas-business:44'), zt = gas.find(t => t.id === 'zen_biz_save');
  eq('zen_biz_save: όνομα, χρώμα και τύπος της gas-business:44',
    [zt?.name, zt?.badge, zt?.type], [zs.name, RAAEY_BADGE[zs.colour]?.badge, RAAEY_BADGE[zs.colour]?.type]);
}

console.log(`${fail ? '✗' : '✓'} ΡΑΑΕΥ: ${pass} έλεγχοι πέρασαν${fail ? `, ${fail} απέτυχαν` : ''}`);
if (fail) process.exit(1);
