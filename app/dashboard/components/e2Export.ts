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
import { E2_OFFICIAL_HEADERS, E2_COLUMNS, E2_COLUMN_GROUPS, E2_SUPPL_I_COLUMNS, E2_SUPPL_II_COLUMNS, E2_NUM_COLS, e2OfficialRows, e2SupplementaryRows, e2AcquiredRows, buildE2Row, buildE1Summary, type E2Stay, E1_HEADERS, e1LineToCells, E1_CODES_NOTE, E2_INSTRUCTIONS, type E1Summary, type E2Property, type E2Tenant, type E2Payment, type E2RowDetail } from '@/lib/billing/e2';
import { fe } from '@/lib/core/format';
import { afmGroups } from './e2Compare';
import { myAccountants } from '@/lib/data/accountant';
import { declRefsByProperty } from '@/lib/data/e2Prefilled';
import { readCoOwners } from '@/lib/property/coOwners';

const NCOLS = E2_OFFICIAL_HEADERS.length; // 19
/** Η κεφαλίδα του φύλλου που μαζεύει τα ακίνητα χωρίς ΑΦΜ ιδιοκτήτη. */
const NO_AFM_HEADER = 'ΔΕΝ ΕΧΕΙ ΟΡΙΣΤΕΙ ΑΦΜ: όρισέ το στις ρυθμίσεις κάθε ακινήτου';
// Πλάτη στηλών (χαρακτήρες) — με αναδιπλωμένες επικεφαλίδες χωράνε άνετα δεδομένα+τίτλοι.
const WIDTHS = [5, 34, 12, 20, 10, 26, 15, 26, 12, 16, 11, 11, 8, 14, 11, 16, 16, 16, 16];
const numZ: Record<number, string> = {
  [E2_NUM_COLS.sqm]: FMT.dec2, [E2_NUM_COLS.months]: FMT.int, [E2_NUM_COLS.monthly]: FMT.eur, [E2_NUM_COLS.pct]: FMT.pct,
  [E2_NUM_COLS.gross13]: FMT.eur, [E2_NUM_COLS.gross14]: FMT.eur, [E2_NUM_COLS.gross15]: FMT.eur, [E2_NUM_COLS.gross16]: FMT.eur,
};
// Οι τέσσερις στήλες «ακαθάριστο εισόδημα» (στ.13–16) — αθροίζονται όλες στο ΣΥΝΟΛΟ.
const GROSS_COLS = [E2_NUM_COLS.gross13, E2_NUM_COLS.gross14, E2_NUM_COLS.gross15, E2_NUM_COLS.gross16];

/** Τα στοιχεία της κεφαλίδας του εντύπου για έναν υπόχρεο. */
export interface E2Declarant { afm: string; name: string; accountant: string }

/**
 * Το κύριο φύλλο ΕΝΟΣ υπόχρεου: η πρώτη σελίδα του Ε2, στήλη προς στήλη
 * (Φ-01.002/Έκδοση 2026). Το Ε2 υποβάλλεται ανά ΑΦΜ: ακίνητα δύο συζύγων ή
 * ακίνητο σε άλλο όνομα δεν μπαίνουν στο ίδιο έντυπο.
 *
 * ΟΠΩΣ ΤΟ ΕΝΤΥΠΟ: κεφαλίδα υπόχρεου (ΑΦΜ και ονοματεπώνυμο, αριθμός υποβολής
 * κενός, στοιχεία λογιστή), οι ομάδες στηλών, οι επικεφαλίδες, η σειρά με τους
 * αριθμούς των στηλών (1, 2, 3, 4, 5, 17, 18, 6, 7, 19, …) και το ΑΘΡΟΙΣΜΑ των
 * στηλών 13 έως 16 με ζωντανά SUM.
 */
function buildMainSheet(officialRows: (string | number)[][], who: E2Declarant, year: number, propertyCount: number): XLSX.WorkSheet {
  const groupRow = 11, headerRow = 12, numberRow = 13;
  const firstData = numberRow + 1;
  const totalRow: (string | number)[] = Array(NCOLS).fill('');
  totalRow[0] = 'ΑΘΡΟΙΣΜΑ';
  const sumCol = (c: number) => officialRows.reduce((s, r) => s + (typeof r[c] === 'number' ? (r[c] as number) : 0), 0);
  // Και οι τέσσερις στήλες ακαθαρίστου (13 έως 16): αλλιώς δωρεάν παραχώρηση και ανείσπρακτα χάνονταν.
  for (const c of GROSS_COLS) totalRow[c] = sumCol(c);
  const groups: (string | number)[] = Array(NCOLS).fill('');
  for (const g of E2_COLUMN_GROUPS) groups[g.from] = g.label;

  const aoa: (string | number)[][] = [
    [`ΑΝΑΛΥΤΙΚΗ ΚΑΤΑΣΤΑΣΗ ΜΙΣΘΩΜΑΤΩΝ ΑΚΙΝΗΤΗΣ ΠΕΡΙΟΥΣΙΑΣ · ΦΟΡΟΛΟΓΙΚΟ ΕΤΟΣ ${year}`],
    [`Έντυπο Ε2 (Φ-01.002/Έκδοση 2026) · προσυμπληρωμένο από το PROPERWISE · τα εκτιμώμενα ελέγχονται πριν την υποβολή στο myAADE`],
    [],
    ['ΣΤΟΙΧΕΙΑ ΥΠΟΧΡΕΟΥ ΦΥΣΙΚΟΥ Ή ΝΟΜΙΚΟΥ ΠΡΟΣΩΠΟΥ Ή ΝΟΜΙΚΗΣ ΟΝΤΟΤΗΤΑΣ'],
    ['ΑΦΜ / Ονοματεπώνυμο-Πατρ. / Επωνυμία', '', who.afm ? [who.afm, who.name].filter(Boolean).join(' / ') : NO_AFM_HEADER],
    ['Αρ. υποβολής / Ημερομηνία', '', ''],
    ['Στοιχεία λογιστή', '', who.accountant],
    ['Από / Έως', '', `01/01/${year} / 31/12/${year}`],
    [],
    [`ΑΝΑΛΥΤΙΚΗ ΚΑΤΑΣΤΑΣΗ (${propertyCount} ${propertyCount === 1 ? 'ακίνητο' : 'ακίνητα'}${officialRows.length !== propertyCount ? `, ${officialRows.length} γραμμές: μία ανά μίσθωση` : ''})`],
    [],
    groups,
    [...E2_OFFICIAL_HEADERS],
    E2_COLUMNS.map(c => c.no),
    ...officialRows,
    totalRow,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const lastDataRow = numberRow + officialRows.length;
  const totalR = lastDataRow + 1;

  ws['!cols'] = WIDTHS.map(w => ({ wch: w }));
  // ΤΟ ΟΝΟΜΑ ΤΟΥ ΠΕΔΙΟΥ ΘΕΛΕΙ ΤΟΠΟ, ΑΛΛΙΩΣ ΚΟΒΕΤΑΙ ΠΑΝΩ ΣΤΟΝ ΑΡΙΘΜΟ.
  // Η πρώτη στήλη είναι πλάτους «α/α»: το όνομα του πεδίου πιάνει τις δύο
  // πρώτες στήλες και η τιμή τις επόμενες, με τη γραμμή συμπλήρωσης σε όλο
  // το πλάτος τους.
  ws['!merges'] = [
    ...[0, 1, 3, 9].map(r => ({ s: { r, c: 0 }, e: { r, c: NCOLS - 1 } })),
    ...[4, 5, 6, 7].flatMap(r => [
      { s: { r, c: 0 }, e: { r, c: 1 } },
      { s: { r, c: 2 }, e: { r, c: 8 } },
    ]),
    ...E2_COLUMN_GROUPS.map(g => ({ s: { r: groupRow, c: g.from }, e: { r: groupRow, c: g.to } })),
    // Το ΑΘΡΟΙΣΜΑ πιάνει όσο πλάτος έχουν οι στήλες πριν από τη 13, όπως στο έντυπο.
    { s: { r: totalR, c: 0 }, e: { r: totalR, c: GROSS_COLS[0] - 1 } },
  ];
  ws['!rows'] = [];
  ws['!rows'][1] = { hpt: 16 };
  ws['!rows'][3] = { hpt: 18 };
  ws['!rows'][9] = { hpt: 18 };
  ws['!rows'][groupRow] = { hpt: 30 };
  ws['!rows'][headerRow] = { hpt: 72 }; // ψηλή επικεφαλίδα: οι τίτλοι του εντύπου φαίνονται ολόκληροι
  ws['!rows'][numberRow] = { hpt: 15 };
  for (let r = firstData; r <= totalR; r++) ws['!rows'][r] = { hpt: 18 };
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: lastDataRow, c: NCOLS - 1 } }) };

  setCell(ws, 0, 0, { s: S.title });
  setCell(ws, 1, 0, { s: S.sub });
  setCell(ws, 3, 0, { s: S.section });
  setCell(ws, 9, 0, { s: S.section });
  for (let r = 4; r <= 7; r++) {
    setCell(ws, r, 0, { s: S.label });
    for (let c = 2; c <= 8; c++) setCell(ws, r, c, { s: S.field });
  }
  for (let c = 0; c < NCOLS; c++) {
    setCell(ws, groupRow, c, { s: S.head });
    setCell(ws, headerRow, c, { s: S.head });
    setCell(ws, numberRow, c, { s: S.head, t: 'n', z: FMT.int });
  }
  for (let r = firstData; r <= lastDataRow; r++) {
    for (let c = 0; c < NCOLS; c++) {
      const z = numZ[c];
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as Cell | undefined;
      const numeric = z !== undefined && cell && typeof cell.v === 'number';
      setCell(ws, r, c, { s: numeric ? S.num : S.txt, ...(numeric ? { t: 'n', z } : {}) });
    }
  }
  for (let c = 0; c < NCOLS; c++) {
    // Τα σύνολα ακαθαρίστου = ΖΩΝΤΑΝΑ SUM, ώστε να μένουν σωστά μετά από χειροκίνητες
    // αλλαγές· η τιμή τους μένει αποθηκευμένη ως αριθμός για όποιον δεν ξαναϋπολογίζει.
    const isGross = GROSS_COLS.includes(c);
    const formula = isGross && officialRows.length
      ? `SUM(${XLSX.utils.encode_cell({ r: firstData, c })}:${XLSX.utils.encode_cell({ r: lastDataRow, c })})`
      : undefined;
    setCell(ws, totalR, c, { s: isGross ? S.totNum : S.totTxt, ...(isGross ? { t: 'n', z: FMT.eur } : {}), ...(formula ? { f: formula } : {}) });
  }
  sheetFinish(ws, { freezeRows: firstData, brandMark: true });
  return ws;
}

/**
 * Η δεύτερη σελίδα του εντύπου, «Συμπληρωματικά στοιχεία ακίνητης περιουσίας»,
 * σε δύο φύλλα: πίνακας I (συνιδιοκτήτες) και πίνακας II (κτήσεις και
 * μεταβιβάσεις του έτους). Κάθε φύλλο λέει από πάνω σε ποιο Ε2 ανήκει.
 */
function buildSupplementarySheet(
  title: string, head: readonly string[], numbers: readonly (number | null)[] | null,
  rows: (string | number)[][], who: E2Declarant, year: number, empty: string, note: string, widths: number[],
  zOf: Record<number, string> = {},
): XLSX.WorkSheet {
  const n = head.length;
  const numbered = rows.map((r, i) => [i + 1, ...r.slice(1)]);
  const aoa: (string | number)[][] = [
    [`Ε2 ${year} / ΑΦΜ: ${who.afm || 'δεν έχει οριστεί'} / ΑΡ. ΥΠΟΒΟΛΗΣ:`],
    ['ΣΥΜΠΛΗΡΩΜΑΤΙΚΑ ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΗΣ ΠΕΡΙΟΥΣΙΑΣ'],
    [title],
    [...head],
    ...(numbers ? [numbers.map(x => (x == null ? '' : x))] : []),
    ...(numbered.length ? numbered : [[empty]]),
    [],
    [note],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const headR = 3, firstData = headR + (numbers ? 2 : 1);
  const lastData = firstData + Math.max(1, numbered.length) - 1;
  const noteR = aoa.length - 1;
  ws['!cols'] = widths.map(w => ({ wch: w }));
  ws['!merges'] = [
    ...[0, 1, 2, noteR].map(r => ({ s: { r, c: 0 }, e: { r, c: n - 1 } })),
    ...(numbered.length ? [] : [{ s: { r: firstData, c: 0 }, e: { r: firstData, c: n - 1 } }]),
  ];
  ws['!rows'] = [];
  ws['!rows'][headR] = { hpt: 58 };
  ws['!rows'][noteR] = { hpt: Math.max(30, Math.ceil(note.length / 150) * 15 + 6) };
  setCell(ws, 0, 0, { s: S.sub });
  setCell(ws, 1, 0, { s: S.title });
  setCell(ws, 2, 0, { s: S.section });
  for (let c = 0; c < n; c++) {
    setCell(ws, headR, c, { s: S.head });
    if (numbers) setCell(ws, headR + 1, c, { s: S.head });
  }
  for (let r = firstData; r <= lastData; r++) {
    for (let c = 0; c < n; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as Cell | undefined;
      const numeric = cell && typeof cell.v === 'number';
      setCell(ws, r, c, { s: numeric ? S.num : S.txtWrap, ...(numeric ? { t: 'n', ...(zOf[c] ? { z: zOf[c] } : {}) } : {}) });
    }
  }
  setCell(ws, noteR, 0, { s: S.txtWrap });
  sheetFinish(ws, { brandMark: true });
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
            afmByProp: Map<string, string>; staysByProp: Map<string, E2Stay[]>;
            nameByAfm: Map<string, string>; accountant: string; leaseHistory?: Set<string> }> {
  const properties = await propertyStore.list<E2Property>(supabase, userId, {
    columns: 'id, name, ama, atak, address, postal_code, ownership, prop_type, status_detail, rental_mode, target_rent, sqm, floor, power_supply_no, co_owners, purchase_date',
    orderBy: 'created_at',
  });
  if (!properties.length) {
    return { properties: [], rows: [], leasesByProp: new Map(), paymentsByProp: new Map(), afmByProp: new Map(), staysByProp: new Map(), nameByAfm: new Map(), accountant: '' };
  }
  const ids = properties.map(p => p.id);
  const [tenants, payments, { data: settings }, stays, accountants] = await Promise.all([
    // ΟΙ ΜΙΣΘΩΣΕΙΣ ΤΟΥ ΕΤΟΥΣ, ΟΧΙ Ο ΣΗΜΕΡΙΝΟΣ ΜΙΣΘΩΤΗΣ. Με το `currentByProperty`
    // το Ε2 του 2025, βγαλμένο αφού ξεκίνησε νέα μίσθωση το 2026, έγραφε όνομα
    // και ΑΦΜ του νέου μισθωτή δίπλα στο ενοίκιο του παλιού.
    tenantStore.inYearByProperty<E2Tenant>(
      supabase, userId, year, 'id,property_id,afm,full_name,monthly_rent,lease_start,lease_end,lease_type,lease_category,aade_lease_decl_ref,move_out_date,status,created_at'),
    // Το `paid` χωρίζει οφειλόμενο από εισπραγμένο (ανείσπρακτα του έτους). Το
    // `tenant_id` δένει τη δόση με τη μίσθωσή της. Τα `base_rent` και
    // `services_charge` χωρίζουν το μίσθωμα από τις υπηρεσίες της ίδιας δόσης.
    rentStore.ofProperties<E2Payment>(supabase, ids, 'property_id,tenant_id,amount,base_rent,services_charge,period_year,period_month,paid', userId, { year }),
    supabase.from('property_settings').select('property_id, owner_afm, owner_name').in('property_id', ids).eq('user_id', userId),
    // ΟΙ ΔΙΑΜΟΝΕΣ ΕΙΝΑΙ ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΕΣΟΔΟ ΤΗΣ ΒΡΑΧΥΧΡΟΝΙΑΣ. Φιλτράρονται με
    // `in('property_id', ids)` και ομαδοποιούνται ΑΝΑ ΑΚΙΝΗΤΟ ακριβώς όπως
    // πληρωμές και μισθωτές: αν περνιόνταν ενιαία, κάθε ακίνητο θα δήλωνε τα
    // έσοδα ΟΛΟΥ του χαρτοφυλακίου.
    stayStore.ofProperties<E2Stay & { property_id: string }>(supabase, ids, `${stayStore.PORTFOLIO_COLUMNS},declared_at`, userId),
    // «Στοιχεία λογιστή» της κεφαλίδας: ο λογιστής με ζωντανή σύνδεση, αν
    // υπάρχει. Αποτυχία εδώ αφήνει απλώς το πεδίο κενό, όπως στο έντυπο.
    myAccountants(supabase).catch(() => []),
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
  const nameByAfm = new Map<string, string>();
  (settings || []).forEach((s: { property_id: string; owner_afm: string | null; owner_name?: string | null }) => {
    const afm = normAfm(s.owner_afm);
    if (afm) afmByProp.set(s.property_id, afm);
    const name = (s.owner_name || '').trim();
    if (afm && name && !nameByAfm.has(afm)) nameByAfm.set(afm, name);
  });
  // Το όνομα που δίνει η βάση όταν ο λογιστής δεν έχει γράψει το δικό του δεν
  // είναι «στοιχεία λογιστή»· τότε το πεδίο μένει κενό για να το γράψει ο ίδιος.
  const accountant = accountants.map(a => a.name).filter(n => n && n !== 'Ο λογιστής σου').join(', ');
  const rows = properties.map(p => buildE2Row(
    p, leasesByProp.get(p.id) || [], paymentsByProp.get(p.id) || [], afmByProp.get(p.id) || '', year,
    staysByProp.get(p.id) || [], { hasLeaseHistory: tenants.known.has(p.id) }));
  // ΑΡΙΘΜΟΣ ΔΗΛΩΣΗΣ ΣΤΗ ΣΤΗΛΗ 19 (02.10.2026). Ο αριθμός που κατέγραψε ο
  // ιδιοκτήτης στη «Δήλωση μίσθωσης» ζούσε μόνο στο ιστορικό ενεργειών και η
  // στήλη έμενε κενή όταν το μισθωτήριο δεν τον είχε. Μπαίνει στην πιο πρόσφατη
  // γραμμή με μισθωτή που δεν έχει ήδη δικό της.
  const declRefs = await declRefsByProperty(supabase, userId).catch(() => new Map<string, string>());
  properties.forEach((p, i) => {
    const ref = declRefs.get(p.id);
    if (!ref) return;
    const withTenant = rows[i].lines.filter(l => l.tenantName);
    const last = withTenant[withTenant.length - 1];
    if (last && !last.declRef) last.declRef = ref.replace(/\D/g, '');
  });
  return { properties, rows, leasesByProp, paymentsByProp, afmByProp, staysByProp, nameByAfm, accountant, leaseHistory: tenants.known };
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

/** Το φύλλο «Ε1 πίνακας 4Δ2» ενός υπόχρεου: κωδικός υπόχρεου, κωδικός συζύγου, ποσό. */
function buildE1Sheet(e1: E1Summary, ownerAfm: string): XLSX.WorkSheet {
  const who = ownerAfm ? `ΑΦΜ ${ownerAfm}` : 'ΧΩΡΙΣ ΑΦΜ ΙΔΙΟΚΤΗΤΗ';
  const N = E1_HEADERS.length, AMT = N - 1;
  const blank = (): (string | number)[] => Array(N).fill('');
  const at = (cells: [number, string | number][]) => { const r = blank(); for (const [i, v] of cells) r[i] = v; return r; };
  const e1aoa: (string | number)[][] = [
    [`Ε1 · ΠΙΝΑΚΑΣ 4Δ2 «ΕΙΣΟΔΗΜΑ ΑΠΟ ΑΚΙΝΗΤΗ ΠΕΡΙΟΥΣΙΑ» · ${who}`], [],
    [...E1_HEADERS],
    // Αριθμητικά ποσά (όχι κείμενο) → ομοιόμορφη μορφή ευρώ, ίδια με το σύνολο.
    ...e1.lines.map(e1LineToCells),
    at([[0, 'Σύνολο'], [AMT, e1.totalGross]]),
    [],
    ...(e1.ownUse > 0 ? [at([[0, 'Χωρίς κωδικό'], [2, 'Ιδιοχρησιμοποίηση κατοικίας: ο πίνακας 4Δ2 δεν έχει γραμμή'], [AMT, e1.ownUse]]), []] : []),
    [e1.note],
  ];
  const e1ws = XLSX.utils.aoa_to_sheet(e1aoa);
  e1ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 64 }, { wch: 30 }, { wch: 20 }];
  e1ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: AMT } }, { s: { r: e1aoa.length - 1, c: 0 }, e: { r: e1aoa.length - 1, c: AMT } }];
  e1ws['!rows'] = []; e1ws['!rows'][2] = { hpt: 30 };
  const hr = 2, last = 3 + e1.lines.length;
  setCell(e1ws, 0, 0, { s: S.title });
  for (let c = 0; c < N; c++) setCell(e1ws, hr, c, { s: S.head });
  for (let r = hr + 1; r <= last; r++) {
    for (let c = 0; c < N; c++) {
      const isTot = r === last, isNum = c === AMT;
      const cell = e1ws[XLSX.utils.encode_cell({ r, c })] as Cell | undefined;
      const numeric = isNum && cell && typeof cell.v === 'number';
      // Το σύνολο = ΖΩΝΤΑΝΟ SUM της στήλης ποσού.
      const formula = isTot && isNum && e1.lines.length
        ? `SUM(${XLSX.utils.encode_cell({ r: hr + 1, c: AMT })}:${XLSX.utils.encode_cell({ r: last - 1, c: AMT })})`
        : undefined;
      const wrap = c === 2 && !isTot;
      setCell(e1ws, r, c, { s: isTot ? (isNum ? S.totNum : S.totTxt) : (isNum ? S.num : wrap ? S.txtWrap : S.txt), ...(numeric ? { t: 'n', z: FMT.eur } : {}), ...(formula ? { f: formula } : {}) });
    }
    if (r < last) e1ws['!rows']![r] = { hpt: 30 };
  }
  if (e1.ownUse > 0) {
    const r = last + 2;
    for (let c = 0; c < N; c++) setCell(e1ws, r, c, { s: c === AMT ? S.num : S.txt, ...(c === AMT ? { t: 'n', z: FMT.eur } : {}) });
  }
  setCell(e1ws, e1aoa.length - 1, 0, { s: S.txtWrap });
  e1ws['!rows']![e1aoa.length - 1] = { hpt: 32 };
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
  const { properties: baseProps, rows: baseRows, afmByProp } = loaded;
  const whoOf = (afm: string): E2Declarant => ({ afm, name: loaded.nameByAfm?.get(afm) ?? '', accountant: loaded.accountant ?? '' });
  const supplements: { afm: string; idx: number[] }[] = [];
  if (!baseProps.length) return null;

  const wb = XLSX.utils.book_new();
  const taken = new Set<string>();
  // Η ΟΜΑΔΟΠΟΙΗΣΗ ΕΙΝΑΙ ΚΟΙΝΗ ΜΕ ΤΗ ΣΥΓΚΡΙΣΗ: ίδιο ΑΦΜ, ίδια ακίνητα, ίδια σειρά.
  const groups = afmGroups({ properties: baseProps, afmByProp });

  // ═══ ΕΝΑ ΦΥΛΛΟ ΑΝΑ ΑΦΜ ΚΑΙ ΓΙΑ ΤΟΝ ΣΥΝΙΔΙΟΚΤΗΤΗ (02.10.2026) ═══════════════
  // Το Ε2 υποβάλλεται από κάθε υπόχρεο για το δικό του ποσοστό. Ο συνιδιοκτήτης
  // με ΑΦΜ εμφανιζόταν μόνο στα Συμπληρωματικά Ι του ιδιοκτήτη και το δικό του
  // μερίδιο δεν είχε φύλλο. Τώρα παίρνει γραμμές με το ποσοστό του, στο φύλλο
  // του ΑΦΜ του, με τον ίδιο υπολογισμό.
  const properties: E2Property[] = [...baseProps];
  const e2rows: E2RowDetail[] = [...baseRows];
  const coGroups = new Map<string, number[]>();
  baseProps.forEach(p => {
    const own = afmByProp.get(p.id) || '';
    for (const c of readCoOwners(p.co_owners)) {
      const afm = normAfm(c.afm);
      const pct = Number(c.pct ?? 0);
      if (!afm || afm === own || !(pct > 0)) continue;
      // Στα Συμπληρωματικά Ι του δικού του φύλλου, οι «άλλοι» είναι ο ιδιοκτήτης
      // και οι υπόλοιποι συνιδιοκτήτες, όχι ο ίδιος.
      const others = [
        ...(own ? [{ name: loaded.nameByAfm?.get(own) ?? '', afm: own, pct: Number(p.ownership ?? 100), address: null }] : []),
        ...readCoOwners(p.co_owners).filter(o => o !== c),
      ];
      const q = { ...p, ownership: pct, co_owners: others } as E2Property;
      properties.push(q);
      e2rows.push(buildE2Row(q, loaded.leasesByProp.get(p.id) || [], loaded.paymentsByProp.get(p.id) || [], afm, year,
        loaded.staysByProp.get(p.id) || [], { hasLeaseHistory: loaded.leaseHistory?.has(p.id) ?? false }));
      const idx = coGroups.get(afm) || [];
      idx.push(properties.length - 1);
      coGroups.set(afm, idx);
    }
  });
  for (const [afm, idx] of coGroups) {
    const g = groups.find(x => x.afm === afm);
    if (g) g.idx.push(...idx); else groups.push({ afm, idx });
  }
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
    XLSX.utils.book_append_sheet(wb, buildMainSheet(officialRows, whoOf(g.afm), year, g.idx.length), name);
    supplements.push({ afm: g.afm, idx: g.idx });
    e1ByGroup.push({ afm: g.afm, e1: buildE1Summary(g.idx.map(i => e2rows[i])) });
  }

  // ═══ Η ΔΕΥΤΕΡΗ ΣΕΛΙΔΑ: ΣΥΜΠΛΗΡΩΜΑΤΙΚΑ Ι ΚΑΙ ΙΙ, ΑΝΑ ΥΠΟΧΡΕΟ ═════════════════
  for (const g of supplements) {
    const who = whoOf(g.afm);
    const suffix = single ? '' : ` ${label(g.afm)}`;
    const missingCo = g.idx.filter(i => e2rows[i].ownershipPct < 100 && !e2SupplementaryRows(properties[i], e2rows[i]).length);
    const supI = g.idx.flatMap(i => e2SupplementaryRows(properties[i], e2rows[i]));
    XLSX.utils.book_append_sheet(wb, buildSupplementarySheet(
      'I. ΕΚΜΙΣΘΩΜΕΝΑ ΚΤΛ. ΑΚΙΝΗΤΑ: ΣΥΝΙΔΙΟΚΤΗΤΕΣ, ΣΥΝΕΠΙΚΑΡΠΩΤΕΣ, ΑΝΗΛΙΚΑ ΤΕΚΝΑ, ΥΠΕΚΜΙΣΘΩΣΕΙΣ',
      E2_SUPPL_I_COLUMNS.map(c => c.label), E2_SUPPL_I_COLUMNS.map(c => c.no), supI, who, year,
      'Κανένα ακίνητο με καταχωρημένους συνιδιοκτήτες.',
      [
        'Συμπληρώνεται όταν υπάρχει συνιδιοκτησία, συνεπικαρπία, ακίνητο ανήλικου τέκνου ή υπεκμίσθωση (οδηγία 11). Οι συνιδιοκτήτες έρχονται από την Κατανομή σε συνιδιοκτήτες. Η στήλη 11 (μίσθωμα υπεκμίσθωσης) δεν καταγράφεται στην εφαρμογή.',
        ...(missingCo.length ? [`Χωρίς στοιχεία συνιδιοκτητών, ενώ το ποσοστό είναι κάτω από 100%: ${missingCo.map(i => properties[i].address || properties[i].name || 'ακίνητο').join(', ')}.`] : []),
      ].join(' '),
      [5, 30, 9, 16, 9, 24, 14, 28, 12, 26, 10, 14],
      { 4: FMT.dec2, 10: FMT.pct },
    ), sheetName(`Συμπληρωματικά Ι${suffix}`, taken));
    const supII = g.idx.flatMap(i => e2AcquiredRows(properties[i], year));
    XLSX.utils.book_append_sheet(wb, buildSupplementarySheet(
      `II. ΑΚΙΝΗΤΗ ΠΕΡΙΟΥΣΙΑ ΠΟΥ ΤΟ ΦΟΡΟΛΟΓΙΚΟ ΕΤΟΣ ${year} ΕΙΝΑΙ ΗΜΙΤΕΛΗΣ Ή ΜΕΤΑΒΙΒΑΣΤΗΚΕ Ή ΑΠΟΚΤΗΘΗΚΕ`,
      E2_SUPPL_II_COLUMNS, null, supII, who, year,
      `Κανένα ακίνητο με ημερομηνία αγοράς μέσα στο ${year}.`,
      `Η εφαρμογή ξέρει μόνο την ημερομηνία αγοράς κάθε ακινήτου. Μεταβιβάσεις, κληρονομιές, δωρεές, γονικές παροχές και ημιτελή στις 31/12/${year} δεν καταγράφονται και συμπληρώνονται από τον λογιστή.`,
      [5, 60, 16, 70],
    ), sheetName(`Συμπληρωματικά ΙΙ${suffix}`, taken));
  }

  // ═══ ΤΟ ΑΤΑΚ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟΝ ΠΙΝΑΚΑ I ΚΑΙ ΜΠΑΙΝΕΙ ΕΔΩ ═══════════════════
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
  // Από τις γραμμές των ιδιοκτητών μόνο: του συνιδιοκτήτη είναι το ίδιο ποσό ξανά.
  const services = baseRows.reduce((s, r) => s + r.servicesExcluded, 0);
  const notes: string[] = [
    E1_CODES_NOTE,
    'Στήλη 16 (ανείσπρακτα): η εφαρμογή δεν καταγράφει αν για τα ανείσπρακτα έχει εκδοθεί διαταγή πληρωμής ή ασκηθεί αγωγή, οπότε τα αφήνει στη στ. 13. Όπου υπάρχει τέτοια ενέργεια, τα μεταφέρει ο λογιστής στη στ. 16.',
    ...(services > 0 ? [`Υπηρεσίες ${fe(services)} που χρεώθηκαν στους μισθωτές μαζί με το ενοίκιο δεν μπήκαν στο ακαθάριστο: δεν είναι μίσθωμα.`] : []),
    ...(groups.length > 1 ? [`Το βιβλίο έχει ${groups.length} φύλλα Ε2: ένα ανά ΑΦΜ ιδιοκτήτη${groups.some(g => !g.afm) ? ' και ένα για τα ακίνητα χωρίς ΑΦΜ' : ''}. Κάθε φύλλο υποβάλλεται στη δήλωση του δικού του υπόχρεου.`] : []),
    ...(groups.some(g => !g.afm) ? ['Ακίνητα χωρίς ΑΦΜ ιδιοκτήτη μπήκαν σε χωριστό φύλλο. Όρισε το ΑΦΜ στις ρυθμίσεις κάθε ακινήτου πριν την υποβολή.'] : []),
    ...(coGroups.size ? ['Οι συνιδιοκτήτες με ΑΦΜ έχουν δικό τους φύλλο Ε2, με το ποσοστό τους και τις ίδιες μισθώσεις.'] : []),
    'Στήλη 17 (είδος μίσθωσης και χρήση): γράφεται περιγραφικά, όπως η οδηγία 7. Στο myAADE διαλέγεται η αντίστοιχη τιμή από τη λίστα του εντύπου, μαζί με τις νέες επιλογές του 2026 (π.χ. κενή κατοικία, Μητρώο Βραχυχρόνιας Διαμονής).',
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
  const gAoa: (string | number)[][] = [['ΟΔΗΓΙΕΣ ΓΙΑ ΤΗ ΣΥΜΠΛΗΡΩΣΗ ΤΟΥ ΕΝΤΥΠΟΥ Ε2'], [], ...E2_INSTRUCTIONS.map(t => [t]), [], ['Πηγή: Ε2, Φ-01.002/Έκδοση 2026. Οι στήλες του βιβλίου ακολουθούν το έντυπο με την αρίθμησή του.']];
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

  // ── Ε1 πίνακας 4Δ2, ένα φύλλο ανά ΑΦΜ ──────────────────────────────────────
  for (const { afm, e1 } of e1ByGroup) {
    if (!e1.lines.length && !(e1.ownUse > 0)) continue;
    XLSX.utils.book_append_sheet(wb, buildE1Sheet(e1, afm), sheetName(single ? 'Ε1 πίνακας 4Δ2' : `Ε1 4Δ2 ${label(afm)}`, taken));
  }

  return wb;
}
