// ΧΩΡΙΣ 'use client': καθαρή λογική φόρτωσης + χτισίματος βιβλίου, ώστε να τρέχει
// ΚΑΙ στον server (route /api/e2/export, πύλη πακέτου) ΚΑΙ στον browser (λήψη).
// Το `downloadWorkbook` αγγίζει `document` μόνο μέσα σε συνάρτηση, με έλεγχο.
import type { SupabaseClient } from '@supabase/supabase-js';
import * as propertyStore from '@/lib/data/properties';
import * as stayStore from '@/lib/data/stays';
import * as rentStore from '@/lib/data/rent';
import * as tenantStore from '@/lib/data/tenants';
import { XLSX, setCell, sheetFinish } from './xlsxStyle';
import { FMT, S, ROW, type Cell } from './sheetFormat';
import { E2_OFFICIAL_HEADERS, E2_NUM_COLS, e2OfficialRows, buildE2Row, buildE1Summary, type E2Stay, E1_HEADERS, E1_CODES_NOTE, E2_INSTRUCTIONS, type E1Summary, type E2Property, type E2Tenant, type E2Payment, type E2RowDetail } from '@/lib/billing/e2';
import { fe } from '@/lib/core/format';
import { afmGroups } from './e2Compare';

const NCOLS = E2_OFFICIAL_HEADERS.length; // 19
/** Η κεφαλίδα του φύλλου που μαζεύει τα ακίνητα χωρίς ΑΦΜ ιδιοκτήτη. */
const NO_AFM_HEADER = 'ΔΕΝ ΕΧΕΙ ΟΡΙΣΤΕΙ ΑΦΜ: όρισέ το στις ρυθμίσεις κάθε ακινήτου';
// Πλάτη στηλών (χαρακτήρες) — με αναδιπλωμένες επικεφαλίδες χωράνε άνετα δεδομένα+τίτλοι.
const WIDTHS = [5, 34, 13, 18, 10, 24, 15, 26, 15, 16, 12, 12, 8, 14, 13, 16, 17, 17, 15];
const numZ: Record<number, string> = {
  [E2_NUM_COLS.sqm]: FMT.dec2, [E2_NUM_COLS.months]: FMT.int, [E2_NUM_COLS.monthly]: FMT.eur, [E2_NUM_COLS.pct]: FMT.pct,
  [E2_NUM_COLS.gross13]: FMT.eur, [E2_NUM_COLS.gross14]: FMT.eur, [E2_NUM_COLS.gross15]: FMT.eur, [E2_NUM_COLS.gross16]: FMT.eur,
};
// Οι τέσσερις στήλες «ακαθάριστο εισόδημα» (στ.13–16) — αθροίζονται όλες στο ΣΥΝΟΛΟ.
const GROSS_COLS = [E2_NUM_COLS.gross13, E2_NUM_COLS.gross14, E2_NUM_COLS.gross15, E2_NUM_COLS.gross16];

/**
 * Το κύριο φύλλο ΕΝΟΣ υπόχρεου. Το Ε2 υποβάλλεται ανά ΑΦΜ: ακίνητα δύο
 * συζύγων ή ακίνητο σε άλλο όνομα δεν μπαίνουν στο ίδιο έντυπο.
 */
function buildMainSheet(officialRows: (string | number)[][], ownerAfm: string, year: number, propertyCount: number): XLSX.WorkSheet {
  const headerRow = 9;
  const totalRow: (string | number)[] = Array(NCOLS).fill('');
  totalRow[0] = 'ΣΥΝΟΛΟ';
  const sumCol = (c: number) => officialRows.reduce((s, r) => s + (typeof r[c] === 'number' ? (r[c] as number) : 0), 0);
  // Άθροισε ΚΑΙ τις τέσσερις στήλες ακαθαρίστου (13–16) — αλλιώς δωρεάν παραχώρηση/ανείσπρακτα χάνονταν.
  for (const c of GROSS_COLS) totalRow[c] = sumCol(c);

  const aoa: (string | number)[][] = [
    [`ΑΝΑΛΥΤΙΚΗ ΚΑΤΑΣΤΑΣΗ ΜΙΣΘΩΜΑΤΩΝ ΑΚΙΝΗΤΗΣ ΠΕΡΙΟΥΣΙΑΣ · ΦΟΡΟΛΟΓΙΚΟ ΕΤΟΣ ${year}`],
    ['Έντυπο Ε2 · προσυμπληρωμένο από το PROPERWISE · συμπληρώστε τα πεδία στο myAADE (τα εκτιμώμενα ελέγχονται πριν την υποβολή)'],
    [],
    ['ΣΤΟΙΧΕΙΑ ΥΠΟΧΡΕΟΥ'],
    ['ΑΦΜ / Ονοματεπώνυμο', '', ownerAfm || NO_AFM_HEADER],
    ['Αριθμός υποβολής / Ημερομηνία', '', ''],
    ['Στοιχεία Λογιστή', '', ''],
    [],
    [`ΠΙΝΑΚΑΣ I · ΕΚΜΙΣΘΟΥΜΕΝΑ / ΛΟΙΠΑ ΑΚΙΝΗΤΑ (${propertyCount} ${propertyCount === 1 ? 'ακίνητο' : 'ακίνητα'}${officialRows.length !== propertyCount ? `, ${officialRows.length} γραμμές: μία ανά μίσθωση` : ''})`],
    [...E2_OFFICIAL_HEADERS],
    ...officialRows,
    totalRow,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const lastDataRow = headerRow + officialRows.length;
  const totalR = lastDataRow + 1;

  ws['!cols'] = WIDTHS.map(w => ({ wch: w }));
  // ΤΟ ΟΝΟΜΑ ΤΟΥ ΠΕΔΙΟΥ ΘΕΛΕΙ ΤΟΠΟ, ΑΛΛΙΩΣ ΚΟΒΕΤΑΙ ΠΑΝΩ ΣΤΟΝ ΑΡΙΘΜΟ.
  // Η πρώτη στήλη είναι πλάτους «α/α», δηλαδή έξι χαρακτήρες: το «ΑΦΜ /
  // Ονοματεπώνυμο» χωρούσε μόνο όσο η διπλανή στήλη ήταν άδεια. Με γεμάτο ΑΦΜ
  // το Excel το έκοβε και ο λογιστής διάβαζε «ΑΦΜ / Ο  987654321».
  // Δύο ζώνες λοιπόν: το όνομα του πεδίου στις δύο πρώτες στήλες, η τιμή στις
  // τρεις επόμενες, με τη γραμμή συμπλήρωσης να τρέχει σε ΟΛΟ το πλάτος τους.
  ws['!merges'] = [
    ...[0, 1, 3, 8].map(r => ({ s: { r, c: 0 }, e: { r, c: NCOLS - 1 } })),
    ...[4, 5, 6].flatMap(r => [
      { s: { r, c: 0 }, e: { r, c: 1 } },
      { s: { r, c: 2 }, e: { r, c: 4 } },
    ]),
  ];
  ws['!rows'] = [];
  ws['!rows'][1] = { hpt: 16 };
  ws['!rows'][3] = { hpt: 18 };
  ws['!rows'][8] = { hpt: 18 };
  ws['!rows'][headerRow] = { hpt: 58 }; // ψηλή επικεφαλίδα → πλήρως ορατοί αναδιπλωμένοι τίτλοι
  for (let r = headerRow + 1; r <= totalR; r++) ws['!rows'][r] = { hpt: 18 };
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: lastDataRow, c: NCOLS - 1 } }) };

  setCell(ws, 0, 0, { s: S.title });
  setCell(ws, 1, 0, { s: S.sub });
  setCell(ws, 3, 0, { s: S.section });
  setCell(ws, 8, 0, { s: S.section });
  for (let r = 4; r <= 6; r++) {
    setCell(ws, r, 0, { s: S.label });
    for (let c = 2; c <= 4; c++) setCell(ws, r, c, { s: S.field });
  }
  for (let c = 0; c < NCOLS; c++) setCell(ws, headerRow, c, { s: S.head });
  for (let r = headerRow + 1; r <= lastDataRow; r++) {
    for (let c = 0; c < NCOLS; c++) {
      const z = numZ[c];
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as Cell | undefined;
      const numeric = z !== undefined && cell && typeof cell.v === 'number';
      setCell(ws, r, c, { s: numeric ? S.num : S.txt, ...(numeric ? { t: 'n', z } : {}) });
    }
  }
  for (let c = 0; c < NCOLS; c++) {
    const z = numZ[c];
    const cell = ws[XLSX.utils.encode_cell({ r: totalR, c })] as Cell | undefined;
    const numeric = z !== undefined && cell && typeof cell.v === 'number';
    // Τα σύνολα ακαθαρίστου = ΖΩΝΤΑΝΑ SUM ώστε να μένουν σωστά μετά από χειροκίνητες αλλαγές.
    const isGross = GROSS_COLS.includes(c);
    const formula = isGross && officialRows.length
      ? `SUM(${XLSX.utils.encode_cell({ r: headerRow + 1, c })}:${XLSX.utils.encode_cell({ r: lastDataRow, c })})`
      : undefined;
    setCell(ws, totalR, c, { s: numeric ? S.totNum : S.totTxt, ...(numeric ? { t: 'n', z } : {}), ...(formula ? { f: formula } : {}) });
  }
  sheetFinish(ws, { freezeRows: headerRow + 1, brandMark: true });
  return ws;
}


/**
 * Οι γραμμές Ε2 του χρήστη για το έτος, από τη βάση.
 *
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΑ: τις χρειάζεται και η εξαγωγή και ο ΕΛΕΓΧΟΣ του
 * προσυμπληρωμένου (E2ReconcileCard). Δύο φορτώσεις θα σήμαιναν δύο σύνολα που
 * μπορούν να διαφωνήσουν — ακριβώς το μοτίβο που παρήγαγε τις αντιφάσεις που
 * κατέγραψε ο έλεγχος του Ιουλίου.
 *
 * Το `rows` είναι ΕΝΑ ανά ακίνητο, στη σειρά του `properties` (ο έλεγχος του
 * προσυμπληρωμένου τα ζευγαρώνει κατά θέση). Οι γραμμές του εντύπου, μία ανά
 * μίσθωση, ζουν μέσα σε κάθε `rows[i].lines`.
 */
export async function loadE2Rows(
  supabase: SupabaseClient, userId: string, year: number,
): Promise<{ properties: E2Property[]; rows: E2RowDetail[];
            leasesByProp: Map<string, E2Tenant[]>; paymentsByProp: Map<string, E2Payment[]>;
            afmByProp: Map<string, string>; staysByProp: Map<string, E2Stay[]> }> {
  const properties = await propertyStore.list<E2Property>(supabase, userId, {
    columns: 'id, name, ama, atak, address, postal_code, ownership, prop_type, status_detail, rental_mode, target_rent, sqm, floor',
    orderBy: 'created_at',
  });
  if (!properties.length) {
    return { properties: [], rows: [], leasesByProp: new Map(), paymentsByProp: new Map(), afmByProp: new Map(), staysByProp: new Map() };
  }
  const ids = properties.map(p => p.id);
  const [tenants, payments, { data: settings }, stays] = await Promise.all([
    // ΟΙ ΜΙΣΘΩΣΕΙΣ ΤΟΥ ΕΤΟΥΣ, ΟΧΙ Ο ΣΗΜΕΡΙΝΟΣ ΜΙΣΘΩΤΗΣ. Με το `currentByProperty`
    // το Ε2 του 2025, βγαλμένο αφού ξεκίνησε νέα μίσθωση το 2026, έγραφε όνομα
    // και ΑΦΜ του νέου μισθωτή δίπλα στο ενοίκιο του παλιού.
    tenantStore.inYearByProperty<E2Tenant>(
      supabase, userId, year, 'id,property_id,afm,full_name,monthly_rent,lease_start,lease_end,lease_type,move_out_date,status,created_at'),
    // Το `paid` χωρίζει οφειλόμενο από εισπραγμένο (ανείσπρακτα του έτους). Το
    // `tenant_id` δένει τη δόση με τη μίσθωσή της. Τα `base_rent` και
    // `services_charge` χωρίζουν το μίσθωμα από τις υπηρεσίες της ίδιας δόσης.
    rentStore.ofProperties<E2Payment>(supabase, ids, 'property_id,tenant_id,amount,base_rent,services_charge,period_year,period_month,paid', userId, { year }),
    supabase.from('property_settings').select('property_id, owner_afm').in('property_id', ids).eq('user_id', userId),
    // ΟΙ ΔΙΑΜΟΝΕΣ ΕΙΝΑΙ ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΕΣΟΔΟ ΤΗΣ ΒΡΑΧΥΧΡΟΝΙΑΣ. Φιλτράρονται με
    // `in('property_id', ids)` και ομαδοποιούνται ΑΝΑ ΑΚΙΝΗΤΟ ακριβώς όπως
    // πληρωμές και μισθωτές: αν περνιόνταν ενιαία, κάθε ακίνητο θα δήλωνε τα
    // έσοδα ΟΛΟΥ του χαρτοφυλακίου.
    stayStore.ofProperties<E2Stay & { property_id: string }>(supabase, ids, `${stayStore.PORTFOLIO_COLUMNS},declared_at`, userId),
  ]);
  const leasesByProp = tenants.inYear;
  const paymentsByProp = new Map<string, E2Payment[]>();
  (payments || []).forEach((p: E2Payment) => { const a = paymentsByProp.get(p.property_id) || []; a.push(p); paymentsByProp.set(p.property_id, a); });
  const staysByProp = new Map<string, E2Stay[]>();
  (stays || []).forEach((st: E2Stay) => {
    const key = st.property_id; if (!key) return;   // διαμονή χωρίς ακίνητο δεν ανήκει σε καμία δήλωση
    const a = staysByProp.get(key) || []; a.push(st); staysByProp.set(key, a);
  });
  const afmByProp = new Map<string, string>();
  (settings || []).forEach((s: { property_id: string; owner_afm: string | null }) => {
    const afm = normAfm(s.owner_afm);
    if (afm) afmByProp.set(s.property_id, afm);
  });
  const rows = properties.map(p => buildE2Row(
    p, leasesByProp.get(p.id) || [], paymentsByProp.get(p.id) || [], afmByProp.get(p.id) || '', year,
    staysByProp.get(p.id) || [], { hasLeaseHistory: tenants.known.has(p.id) }));
  return { properties, rows, leasesByProp, paymentsByProp, afmByProp, staysByProp };
}

/** ΑΦΜ χωρίς κενά, για να μη γίνουν δύο ομάδες ο ίδιος άνθρωπος. */
const normAfm = (v: string | null | undefined): string => String(v ?? '').replace(/\s+/g, '');


/** Όνομα φύλλου μοναδικό και ως 31 χαρακτήρες (όριο του Excel). */
function sheetName(wanted: string, taken: Set<string>): string {
  let name = wanted.slice(0, 31), n = 2;
  while (taken.has(name)) name = `${wanted.slice(0, 27)} (${n++})`;
  taken.add(name);
  return name;
}

/** Το φύλλο «Σύνοψη Ε1» ενός υπόχρεου. */
function buildE1Sheet(e1: E1Summary, ownerAfm: string): XLSX.WorkSheet {
  const who = ownerAfm ? `ΑΦΜ ${ownerAfm}` : 'ΧΩΡΙΣ ΑΦΜ ΙΔΙΟΚΤΗΤΗ';
  const e1aoa: (string | number)[][] = [
    [`ΣΥΝΟΨΗ Ε1 (Πίνακας 4Δ) · ${who} · ακαθάριστο εκμίσθωσης ανά κωδικό`], [],
    // Αριθμητικά ποσά (όχι κείμενο) → ομοιόμορφη μορφή ευρώ, ίδια με το σύνολο.
    [...E1_HEADERS],
    ...e1.lines.map(l => [l.unmapped ? 'Χωρίς κωδικό' : l.code, l.label, l.category, l.amount]),
    ['Σύνολο ακαθάριστου εκμίσθωσης', '', '', e1.totalGross],
    [],
    ...(e1.ownUse > 0 ? [['Εκτός κωδικού εκμίσθωσης', 'Ιδιοχρησιμοποίηση (Ε2 στ. 15): δεν είναι μίσθωμα', '', e1.ownUse], []] : []),
    [e1.note],
  ];
  const e1ws = XLSX.utils.aoa_to_sheet(e1aoa);
  e1ws['!cols'] = [{ wch: 22 }, { wch: 60 }, { wch: 24 }, { wch: 20 }];
  e1ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  e1ws['!rows'] = []; e1ws['!rows'][2] = { hpt: 30 };
  const hr = 2, last = 3 + e1.lines.length;
  setCell(e1ws, 0, 0, { s: S.title });
  for (let c = 0; c < 4; c++) setCell(e1ws, hr, c, { s: S.head });
  for (let r = hr + 1; r <= last; r++) {
    for (let c = 0; c < 4; c++) {
      const isTot = r === last, isNum = c === 3;
      const cell = e1ws[XLSX.utils.encode_cell({ r, c })] as Cell | undefined;
      const numeric = isNum && cell && typeof cell.v === 'number';
      // Το σύνολο ακαθαρίστου = ΖΩΝΤΑΝΟ SUM της στήλης ποσού.
      const formula = isTot && isNum && e1.lines.length
        ? `SUM(${XLSX.utils.encode_cell({ r: hr + 1, c: 3 })}:${XLSX.utils.encode_cell({ r: last - 1, c: 3 })})`
        : undefined;
      setCell(e1ws, r, c, { s: isTot ? (isNum ? S.totNum : S.totTxt) : (isNum ? S.num : S.txt), ...(numeric ? { t: 'n', z: FMT.eur } : {}), ...(formula ? { f: formula } : {}) });
    }
  }
  if (e1.ownUse > 0) {
    const r = last + 2;
    for (let c = 0; c < 4; c++) setCell(e1ws, r, c, { s: c === 3 ? S.num : S.txt, ...(c === 3 ? { t: 'n', z: FMT.eur } : {}) });
  }
  sheetFinish(e1ws, { brandMark: true });
  return e1ws;
}

/**
 * Χτίζει το βιβλίο Ε2 από ΗΔΗ φορτωμένα δεδομένα. Καθαρή συνάρτηση — τρέχει και
 * σε server (η πύλη `/api/e2/export`) και σε browser (λήψη). Επιστρέφει null όταν
 * δεν υπάρχει ακίνητο· ο καλών αποφασίζει τι δείχνει.
 *
 * ΕΝΑ Ε2 ΑΝΑ ΑΦΜ. Το `owner_afm` αποθηκεύεται ανά ακίνητο, αλλά το βιβλίο έπαιρνε
 * το πρώτο που έβρισκε και το έγραφε στην κεφαλίδα ΟΛΩΝ: ακίνητα της συζύγου
 * δηλώνονταν στο έντυπο του συζύγου. Τώρα κάθε ΑΦΜ έχει δικό του φύλλο Ε2 με
 * δική του κεφαλίδα και δική του σύνοψη Ε1. Τα ακίνητα χωρίς ΑΦΜ πάνε σε
 * χωριστό φύλλο που το λέει στην κεφαλίδα.
 */
export function buildE2Workbook(
  loaded: Awaited<ReturnType<typeof loadE2Rows>>, year: number,
): XLSX.WorkBook | null {
  const { properties, rows: e2rows, afmByProp } = loaded;
  if (!properties.length) return null;

  const wb = XLSX.utils.book_new();
  const taken = new Set<string>();
  // Η ΟΜΑΔΟΠΟΙΗΣΗ ΕΙΝΑΙ ΚΟΙΝΗ ΜΕ ΤΗ ΣΥΓΚΡΙΣΗ: ίδιο ΑΦΜ, ίδια ακίνητα, ίδια σειρά.
  const groups = afmGroups({ properties, afmByProp });
  const single = groups.length === 1;
  const label = (afm: string) => (afm ? `ΑΦΜ ${afm}` : 'χωρίς ΑΦΜ');
  /** Για το φύλλο ελέγχου: σε ποιο φύλλο και σε ποιο α/α βρίσκεται κάθε ακίνητο. */
  const where = new Map<number, { sheet: string; n: number }>();
  const e1ByGroup: { afm: string; e1: E1Summary }[] = [];

  for (const g of groups) {
    const name = sheetName(single ? `Ε2 ${year}` : `Ε2 ${year} ${label(g.afm)}`, taken);
    const officialRows: (string | number)[][] = [];
    for (const i of g.idx) {
      where.set(i, { sheet: name, n: officialRows.length + 1 });
      officialRows.push(...e2OfficialRows(properties[i], e2rows[i], officialRows.length + 1));
    }
    XLSX.utils.book_append_sheet(wb, buildMainSheet(officialRows, g.afm, year, g.idx.length), name);
    e1ByGroup.push({ afm: g.afm, e1: buildE1Summary(g.idx.map(i => e2rows[i])) });
  }

  // ═══ ΤΟ ΑΤΑΚ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟΝ ΠΙΝΑΚΑ I, ΚΑΙ ΜΠΑΙΝΕΙ ΕΔΩ ═══════════════════
  // Ο Πίνακας I του Ε2 έχει ΑΡΙΘΜΗΜΕΝΕΣ στήλες, από τη στήλη 2 ως τη 19 και η
  // αρίθμηση είναι του εντύπου, όχι δική μας. Μια στήλη παραπάνω —όσο χρήσιμη κι
  // αν είναι— μετατοπίζει όσες ακολουθούν και το φύλλο παύει να αντιστοιχεί σε
  // αυτό που ζητά το myAADE. Το ΑΤΑΚ ΔΕΝ υπάρχει στο επίσημο έντυπο.
  //
  // Το χρειάζεται όμως ο λογιστής: είναι το μόνο κλειδί που δένει το ακίνητο του
  // Ε2 με τη γραμμή του στο Ε9. Μπαίνει λοιπόν στο ΔΙΚΟ ΜΑΣ φύλλο ελέγχου, δίπλα
  // στο φύλλο και στο α/α. Και όπου λείπει, το φύλλο το λέει.
  //
  // Το φύλλο υπάρχει ΠΑΝΤΑ: εκτός από τις επισημάνσεις ανά ακίνητο, κρατά τις
  // σημειώσεις που ισχύουν για όλο το βιβλίο (κωδικοί Ε1, στήλη 16, υπηρεσίες).
  const checks = properties
    .map((p, i) => ({
      sheet: where.get(i)?.sheet ?? '',
      n: where.get(i)?.n ?? i + 1,
      loc: p.address || `Ακίνητο ${i + 1}`,
      atak: (p.atak || '').trim(),
      flags: e2rows[i].flags,
    }))
    .filter(x => x.flags.length > 0 || !x.atak);
  const services = e2rows.reduce((s, r) => s + r.servicesExcluded, 0);
  const notes: string[] = [
    E1_CODES_NOTE,
    'Στήλη 16 (ανείσπρακτα): η εφαρμογή δεν καταγράφει αν για τα ανείσπρακτα έχει εκδοθεί διαταγή πληρωμής ή ασκηθεί αγωγή, οπότε τα αφήνει στη στ. 13. Όπου υπάρχει τέτοια ενέργεια, τα μεταφέρει ο λογιστής στη στ. 16.',
    ...(services > 0 ? [`Υπηρεσίες ${fe(services)} που χρεώθηκαν στους μισθωτές μαζί με το ενοίκιο δεν μπήκαν στο ακαθάριστο: δεν είναι μίσθωμα.`] : []),
    ...(groups.length > 1 ? [`Το βιβλίο έχει ${groups.length} φύλλα Ε2: ένα ανά ΑΦΜ ιδιοκτήτη${groups.some(g => !g.afm) ? ' και ένα για τα ακίνητα χωρίς ΑΦΜ' : ''}. Κάθε φύλλο υποβάλλεται στη δήλωση του δικού του υπόχρεου.`] : []),
    ...(groups.some(g => !g.afm) ? ['Ακίνητα χωρίς ΑΦΜ ιδιοκτήτη μπήκαν σε χωριστό φύλλο. Όρισε το ΑΦΜ στις ρυθμίσεις κάθε ακινήτου πριν την υποβολή.'] : []),
  ];
  const fAoa: (string | number)[][] = [
    ['ΕΛΕΓΧΟΣ ΠΡΙΝ ΤΗΝ ΥΠΟΒΟΛΗ'],
    ['Το ΑΤΑΚ δεν είναι στήλη του εντύπου Ε2. Μπαίνει εδώ για να διασταυρώνεται κάθε ακίνητο με τη γραμμή του στο Ε9.'],
    [],
    ['ΣΗΜΕΙΩΣΕΙΣ ΓΙΑ ΟΛΟ ΤΟ ΒΙΒΛΙΟ'],
    ...notes.map(t => [t]),
    [],
    ['Φύλλο', 'Α/Α', 'Ακίνητο', 'ΑΤΑΚ', 'Επισημάνσεις'],
    ...checks.map(x => [
      x.sheet,
      x.n,
      x.loc,
      x.atak || 'Δεν έχει οριστεί',
      x.flags.length ? x.flags.join(' · ') : 'Χωρίς ΑΤΑΚ δεν γίνεται διασταύρωση με το Ε9.',
    ]),
  ];
  const fws = XLSX.utils.aoa_to_sheet(fAoa);
  const notesStart = 4, headR = notesStart + notes.length + 1;
  fws['!cols'] = [{ wch: 24 }, { wch: 6 }, { wch: 34 }, { wch: 16 }, { wch: 72 }];
  fws['!merges'] = [
    ...[0, 1, 3].map(r => ({ s: { r, c: 0 }, e: { r, c: 4 } })),
    ...notes.map((_, i) => ({ s: { r: notesStart + i, c: 0 }, e: { r: notesStart + i, c: 4 } })),
  ];
  fws['!rows'] = []; fws['!rows'][1] = { hpt: ROW.sub };
  setCell(fws, 0, 0, { s: S.title });
  setCell(fws, 1, 0, { s: S.sub });
  setCell(fws, 3, 0, { s: S.section });
  notes.forEach((t, i) => {
    setCell(fws, notesStart + i, 0, { s: S.txtWrap });
    fws['!rows']![notesStart + i] = { hpt: Math.max(18, Math.ceil(t.length / 130) * 15 + 6) };
  });
  for (let c = 0; c < 5; c++) setCell(fws, headR, c, { s: S.head });
  checks.forEach((x, i) => {
    const r = headR + 1 + i;
    setCell(fws, r, 0, { s: S.txt });
    setCell(fws, r, 1, { s: S.num });
    setCell(fws, r, 2, { s: S.txt });
    setCell(fws, r, 3, { s: S.txt });
    setCell(fws, r, 4, { s: S.txtWrap });
    const note = x.flags.length ? x.flags.join(' · ') : '';
    fws['!rows']![r] = { hpt: Math.max(18, Math.ceil(note.length / 66) * 15 + 6) };
  });
  sheetFinish(fws, { brandMark: true });
  XLSX.utils.book_append_sheet(wb, fws, sheetName('Έλεγχος και ΑΤΑΚ', taken));

  // ── Οδηγίες συμπλήρωσης ─────────────────────────────────────────────────────
  const gAoa: (string | number)[][] = [['ΟΔΗΓΙΕΣ ΣΥΜΠΛΗΡΩΣΗΣ ΕΝΤΥΠΟΥ Ε2'], [], ...E2_INSTRUCTIONS.map(t => [t]), [], ['Σημείωση: οι στήλες ακολουθούν το επίσημο έντυπο Ε2. Επιβεβαιώστε τυχόν ετήσιες αλλαγές στο myAADE.']];
  const guide = XLSX.utils.aoa_to_sheet(gAoa);
  guide['!cols'] = [{ wch: 118 }];
  guide['!rows'] = [];
  setCell(guide, 0, 0, { s: S.title });
  for (let i = 0; i < E2_INSTRUCTIONS.length; i++) {
    const r = 2 + i;
    setCell(guide, r, 0, { s: S.txtWrap });
    (guide['!rows'] as { hpt: number }[])[r] = { hpt: Math.max(28, Math.ceil(E2_INSTRUCTIONS[i].length / 95) * 15 + 12) };
  }
  sheetFinish(guide, { brandMark: true });
  XLSX.utils.book_append_sheet(wb, guide, sheetName('Οδηγίες συμπλήρωσης', taken));

  // ── Σύνοψη Ε1 (Πίνακας 4Δ), μία ανά ΑΦΜ ─────────────────────────────────────
  for (const { afm, e1 } of e1ByGroup) {
    if (!e1.lines.length && !(e1.ownUse > 0)) continue;
    XLSX.utils.book_append_sheet(wb, buildE1Sheet(e1, afm), sheetName(single ? 'Σύνοψη Ε1' : `Σύνοψη Ε1 ${label(afm)}`, taken));
  }

  return wb;
}
