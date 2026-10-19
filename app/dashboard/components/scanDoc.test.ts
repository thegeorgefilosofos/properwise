// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΧΩΡΗΣΗ ΣΑΡΩΜΕΝΟΥ ΕΓΓΡΑΦΟΥ, ΑΠΟ ΑΚΡΗ ΣΕ ΑΚΡΗ (έλεγχος 18/10/2026)
// ─────────────────────────────────────────────────────────────────────────
// Τρέχει την ΠΡΑΓΜΑΤΙΚΗ `commitScannedDoc` πάνω σε βάση στη μνήμη: το `fetch`
// του Supabase απαντά από πίνακες εδώ μέσα, με τα φίλτρα του PostgREST. Κάθε
// σενάριο είναι ένα εύρημα του ελέγχου, με τα ίδια νούμερα:
//
//   APP-1  η απόδειξη πληρωμής σταματούσε ως «διπλοεγγραφή» του λογαριασμού της
//          και το «ούτως ή άλλως» έμπαινε σε βρόχο με την ερώτηση συμφωνίας
//   APP-3  το παλιό μισθωτήριο γύριζε πίσω ενοίκιο και έναρξη, με 36 δόσεις
//   APP-4  «ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ» δεν ήταν «Γεώργιος Παπαδόπουλος»· ΑΦΜ αγνοούνταν
//   APP-5  CSV, Excel και HEIC έφευγαν προς ανάγνωση και γύριζαν «η υπηρεσία δεν απαντά»
//   APP-6  τα κοινόχρηστα Σεπτεμβρίου έμπαιναν στον μήνα της σάρωσης
//   APP-7  αποτυχίες βημάτων χάνονταν πίσω από ένα «Καταχωρήθηκε»
//   PR402  παλαιότερο ΠΕΑ που ισχύει ακόμη γύριζε πίσω την κατηγορία
//
// Τρέξε: npx tsx app/dashboard/components/scanDoc.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  commitScannedDoc, withAnswer, scanDocument, scanMime, folderMime, notForFolder, unreadableFormat, SCAN_ACCEPT,
  openQuestion, failedNotice,
  type CommitInput, type CommitAnswers, type ReconcileQuestion,
} from './scanDoc';
import type { ScannedDoc } from '@/lib/billing/documents';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

// ── Η βάση στη μνήμη ───────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
/** Αιτήματα που αποτυγχάνουν επίτηδες: «POST bills», «GET bills_settings», «UPLOAD». */
const broken = new Set<string>();
const calls: string[] = [];
let seq = 0;

const reset = (tables: Record<string, Row[]> = {}) => {
  for (const k of Object.keys(db)) delete db[k];
  for (const [k, v] of Object.entries(tables)) db[k] = v.map(r => ({ ...r }));
  broken.clear(); calls.length = 0;
};
const table = (t: string) => (db[t] ||= []);

const unq = (v: string) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);
function matches(row: Row, filters: [string, string][]): boolean {
  return filters.every(([col, expr]) => {
    const dot = expr.indexOf('.');
    const op = expr.slice(0, dot), raw = expr.slice(dot + 1);
    const v = row[col];
    const s = v == null ? null : String(v);
    switch (op) {
      case 'eq': return s === raw;
      case 'neq': return s !== raw;
      case 'gte': return s != null && s >= raw;
      case 'lte': return s != null && s <= raw;
      case 'gt': return s != null && s > raw;
      case 'lt': return s != null && s < raw;
      case 'is': return raw === 'null' ? v == null : String(v) === raw;
      case 'in': return raw.replace(/^\(|\)$/g, '').split(',').map(unq).includes(String(v));
      case 'like': return s != null && new RegExp(`^${raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`).test(s);
      default: return true;
    }
  });
}
const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

(globalThis as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(String(input instanceof Request ? input.url : input), 'http://local');
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (url.pathname.startsWith('/storage/v1/object/')) {
    calls.push('UPLOAD');
    return broken.has('UPLOAD') ? json({ statusCode: '500', error: 'down', message: 'down' }, 500) : json({ Key: url.pathname });
  }
  if (!url.pathname.startsWith('/rest/v1/')) { calls.push(`${method} ${url.pathname}`); return json({ error: 'no' }, 500); }
  const t = url.pathname.slice('/rest/v1/'.length);
  calls.push(`${method} ${t}`);
  if (broken.has(`${method} ${t}`)) return json({ message: 'boom', code: 'XX000' }, 500);
  const filters: [string, string][] = [];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    filters.push([k, v]);
  }
  const single = (headers.get('Accept') || '').includes('vnd.pgrst.object');
  const prefer = headers.get('Prefer') || '';
  const out = (rows: Row[]) => (prefer.includes('return=representation') || method === 'GET'
    ? json(single ? (rows[0] ?? null) : rows, method === 'POST' ? 201 : 200)
    : new Response(null, { status: 204 }));
  if (method === 'GET') {
    let rows = table(t).filter(r => matches(r, filters));
    const limit = Number(url.searchParams.get('limit') || 0);
    if (limit) rows = rows.slice(0, limit);
    return out(rows);
  }
  if (method === 'PATCH') {
    const patch = JSON.parse(String(init.body || '{}'));
    const rows = table(t).filter(r => matches(r, filters));
    rows.forEach(r => Object.assign(r, patch));
    return out(rows);
  }
  if (method === 'POST') {
    const body = JSON.parse(String(init.body || '[]'));
    const list: Row[] = Array.isArray(body) ? body : [body];
    const conflict = (url.searchParams.get('on_conflict') || '').split(',').filter(Boolean);
    const done: Row[] = [];
    for (const r of list) {
      const twin = conflict.length ? table(t).find(x => conflict.every(c => String(x[c]) === String(r[c]))) : undefined;
      if (twin) {
        if (prefer.includes('ignore-duplicates')) continue;
        Object.assign(twin, r); done.push(twin); continue;
      }
      const row = { id: `${t}-${++seq}`, ...r };
      table(t).push(row); done.push(row);
    }
    return out(done);
  }
  return json({ message: 'method' }, 405);
}) as typeof fetch;

const P = 'p1', U = 'u1', TODAY = '2026-10-18';
const file = () => new File(['x'], 'scan.jpg', { type: 'image/jpeg' });
const commit = (doc: Partial<ScannedDoc>, extra: Partial<CommitInput> = {}) =>
  commitScannedDoc({ doc: doc as ScannedDoc, propertyId: P, userId: U, today: TODAY, file: file(), ...extra });

(async () => {
  // ══ APP-1 · Η απόδειξη του λογαριασμού που ήδη σαρώθηκε ═════════════════
  {
    reset();
    // Βήμα 1: ο λογαριασμός ΔΕΗ σαρώνεται και καταχωρείται, απλήρωτος.
    const bill = await commit({ doc_type: 'bill', category: 'electricity', provider: 'ΔΕΗ', amount: 84.5, issue_date: '2026-10-01', due_date: '2026-10-20', period: 'Σεπτέμβριος 2026' });
    ok('APP-1: ο λογαριασμός γράφτηκε', bill.saved.includes('Λογαριασμοί') && table('bills').length === 1);
    const debt = table('expenses')[0];
    ok('APP-1: η δαπάνη του είναι απλήρωτη και δεμένη', debt?.paid === false && debt?.bill_id === table('bills')[0].id);
    // Βήμα 2: η απόδειξη πληρωμής του, δύο μέρες πριν από τη λήξη.
    const pay = await commit({ doc_type: 'payment', category: 'electricity', provider: 'ΔΕΗ', amount: 84.5, issue_date: '2026-10-18', due_date: '2026-10-20' });
    ok(`APP-1: η απόδειξη ΔΕΝ είναι «διπλοεγγραφή» του χρέους της (πήρα ${JSON.stringify(pay.duplicate || '')})`, !pay.duplicate);
    ok('APP-1: ο λογαριασμός σημειώθηκε εξοφλημένος', table('bills')[0].paid === true && pay.saved.includes('Λογαριασμός εξοφλήθηκε'));
    ok('APP-1: η ίδια δαπάνη έγινε πληρωμένη, όχι δεύτερη γραμμή', table('expenses').length === 1 && table('expenses')[0].paid === true);
    // Η ίδια απόδειξη δεύτερη φορά: ΑΥΤΟ είναι διπλοεγγραφή και ρωτάμε.
    const again = await commit({ doc_type: 'payment', category: 'electricity', provider: 'ΔΕΗ', amount: 84.5, issue_date: '2026-10-18', due_date: '2026-10-20' });
    ok('APP-1: η δεύτερη σάρωση της ίδιας απόδειξης ρωτά', !!again.duplicate && table('expenses').length === 1);
  }
  {
    // Το χρέος βγαίνει από τον έλεγχο ΜΟΝΟ για λογαριασμό που η απόδειξη μπορεί
    // να εξοφλεί. Απόδειξη Protergia δεν κλείνει λογαριασμό ΔΕΗ (το ταίριασμα
    // τον απορρίπτει): η ομοιότητα με το χρέος του λέγεται, αλλιώς θα γραφόταν
    // δεύτερη δαπάνη δίπλα σε λογαριασμό που μένει απλήρωτος.
    reset();
    await commit({ doc_type: 'bill', category: 'electricity', provider: 'ΔΕΗ', amount: 84.5, issue_date: '2026-10-01', due_date: '2026-10-20', period: 'Σεπτέμβριος 2026' });
    const other = await commit({ doc_type: 'payment', category: 'electricity', provider: 'Protergia', amount: 84.5, issue_date: '2026-10-19' });
    ok('APP-1: απόδειξη άλλου παρόχου: ρωτά για την παρόμοια δαπάνη', !!other.duplicate && table('expenses').length === 1);
    ok('APP-1: και δεν αγγίζει τον λογαριασμό ΔΕΗ', table('bills')[0].paid === false);
  }
  {
    // Ο βρόχος: πραγματικά παρόμοια δαπάνη ΚΑΙ δύο υποψήφιοι λογαριασμοί.
    reset({
      bills: [
        { id: 'b15', property_id: P, user_id: U, category: 'electricity', name: 'ΔΕΗ — Αύγουστος 2026', period: 'Αύγουστος 2026', amount: 84.5, due_date: '2026-10-15', paid: false, created_at: '2026-09-25' },
        { id: 'b20', property_id: P, user_id: U, category: 'electricity', name: 'ΔΕΗ — Σεπτέμβριος 2026', period: 'Σεπτέμβριος 2026', amount: 84.5, due_date: '2026-10-20', paid: false, created_at: '2026-10-01' },
      ],
      expenses: [
        // Πληρωμή που ο ιδιοκτήτης πέρασε με το χέρι, χωρίς λογαριασμό.
        { id: 'm1', property_id: P, user_id: U, description: 'ΔΕΗ', amount: 84.5, category: 'Ρεύμα', date: '2026-10-18', store_vendor: 'ΔΕΗ', bill_id: null, paid: true },
      ],
    });
    const doc = { doc_type: 'payment', category: 'electricity', provider: 'ΔΕΗ', amount: 84.5, issue_date: '2026-10-19' } as const;
    let answers: CommitAnswers = {};
    const r1 = await commit(doc, answers);
    ok('APP-1 βρόχος: πρώτα η παρόμοια δαπάνη', !!r1.duplicate && !r1.ask);
    answers = withAnswer(answers, 'duplicate');
    const r2 = await commit(doc, answers);
    ok('APP-1 βρόχος: «ούτως ή άλλως» φέρνει την ερώτηση συμφωνίας', !!r2.ask && r2.ask.about === 'bill' && !r2.duplicate);
    // Η παλιά απάντηση της οθόνης: μόνο η επιλογή, χωρίς το «ούτως ή άλλως».
    const old = await commit(doc, { reconcileChoice: 'b20' });
    ok('APP-1 βρόχος: χωρίς το allowDuplicate ξαναρωτά (αυτό έκανε η οθόνη)', !!old.duplicate);
    answers = withAnswer(answers, r2.ask!, 'b20');
    ok('APP-1 βρόχος: οι απαντήσεις κρατούν και τις δύο', answers.allowDuplicate === true && answers.reconcileChoice === 'b20');
    const r3 = await commit(doc, answers);
    ok('APP-1 βρόχος: με όλες τις απαντήσεις καταχωρείται', !r3.duplicate && !r3.ask && r3.saved.includes('Λογαριασμός εξοφλήθηκε'));
    ok('APP-1 βρόχος: εξοφλήθηκε ο λογαριασμός που διάλεξε ο χρήστης', table('bills').find(b => b.id === 'b20')?.paid === true && table('bills').find(b => b.id === 'b15')?.paid === false);
  }

  // ══ APP-3 · Το παλιό μισθωτήριο δεν γυρίζει πίσω τη μίσθωση ═════════════
  const tenantNow = { id: 't1', property_id: P, user_id: U, full_name: 'Γιώργος Παπαδόπουλος', monthly_rent: 550, lease_start: '2026-01-01', lease_end: '2028-12-31', rent_due_day: 5, status: 'active', move_out_date: null, afm: null, notes: 'κλειδιά: 2' };
  {
    reset({ tenants: [tenantNow] });
    const r = await commit({ doc_type: 'lease', title: 'Μισθωτήριο κατοικίας', tenant_name: 'Γιώργος Παπαδόπουλος', monthly_rent: 500, lease_start: '2023-01-01', lease_end: '2025-12-31', rent_due_day: 5 });
    const t = table('tenants')[0];
    ok(`APP-3: το ενοίκιο μένει 550 (πήρα ${t.monthly_rent})`, t.monthly_rent === 550);
    ok(`APP-3: η έναρξη μένει 2026-01-01 (πήρα ${t.lease_start})`, t.lease_start === '2026-01-01' && t.lease_end === '2028-12-31');
    ok(`APP-3: καμία δόση από την παλιά έναρξη (γράφτηκαν ${table('rent_payments').length})`, table('rent_payments').length === 0);
    ok('APP-3: η αναφορά λέει ότι ισχύει νεότερο', r.saved.some(s => /νεότερο μισθωτήριο/.test(s)));
    ok('APP-3: οι σημειώσεις του ιδιοκτήτη δεν σβήνουν', t.notes === 'κλειδιά: 2');
  }
  {
    // Η ανανέωση: νεότερο χαρτί, νέοι όροι. Το όνομα μένει όπως το γράφει η εφαρμογή.
    // ΑΛΛΑ ΟΧΙ ΣΙΩΠΗΛΑ: ενοίκιο και έναρξη που ισχύουν αλλάζουν μόνο με «ναι».
    reset({ tenants: [tenantNow] });
    const renewal = { doc_type: 'lease', tenant_name: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΙΩΡΓΟΣ', afm: '094014201', monthly_rent: 600, lease_start: '2029-01-01', lease_end: '2031-12-31', rent_due_day: 5 } as const;
    const q = await commit(renewal);
    ok('APP-3: νεότερο μισθωτήριο με άλλο ενοίκιο: ρωτά πριν αλλάξει', q.ask?.about === 'lease' && table('tenants')[0].monthly_rent === 550 && !calls.includes('UPLOAD'));
    ok(`APP-3: η ερώτηση λέει τι αλλάζει (${JSON.stringify(q.ask?.options[0]?.reasons)})`,
      JSON.stringify(q.ask?.options[0]?.reasons) === JSON.stringify(['Ενοίκιο από 550,00€ σε 600,00€', 'Έναρξη από 01/01/2026 σε 01/01/2029']));
    await commit(renewal, withAnswer({}, q.ask!, 'update'));
    const t = table('tenants')[0];
    ok('APP-3: με «ναι» αλλάζουν οι όροι', t.monthly_rent === 600 && t.lease_start === '2029-01-01' && t.lease_end === '2031-12-31');
    ok('APP-3: το όνομα δεν ξαναγράφεται με κεφαλαία', t.full_name === 'Γιώργος Παπαδόπουλος');
    ok('APP-3: κανένας δεύτερος ενοικιαστής', table('tenants').length === 1);
  }
  {
    reset({ tenants: [tenantNow] });
    const renewal = { doc_type: 'lease', tenant_name: 'Γιώργος Παπαδόπουλος', afm: '094014201', monthly_rent: 600, lease_start: '2029-01-01', lease_end: '2031-12-31' } as const;
    const q = await commit(renewal);
    const r = await commit(renewal, withAnswer({}, q.ask!, null));
    const t = table('tenants')[0];
    ok('APP-3: με «όχι» μένουν ενοίκιο και ημερομηνίες', t.monthly_rent === 550 && t.lease_start === '2026-01-01' && t.lease_end === '2028-12-31');
    ok('APP-3: με «όχι» συμπληρώνεται μόνο ό,τι λείπει και το χαρτί αρχειοθετείται', t.afm === '094014201' && r.saved.includes('Φάκελος ακινήτου'));
  }
  {
    // Η παράταση (ίδια έναρξη, ίδιο ενοίκιο, νέα λήξη) δεν ρωτά: δεν αλλάζει τα χρήματα κάθε μήνα.
    reset({ tenants: [tenantNow] });
    const r = await commit({ doc_type: 'lease', tenant_name: 'Γιώργος Παπαδόπουλος', monthly_rent: 550, lease_start: '2026-01-01', lease_end: '2029-12-31' });
    ok('APP-3: παράταση χωρίς ερώτηση', !r.ask && table('tenants')[0].lease_end === '2029-12-31');
  }
  {
    // Η ερώτηση ενοικιαστή και η ερώτηση όρων έρχονται μία μία· η πρώτη απάντηση κρατιέται.
    reset({ tenants: [tenantNow] });
    const paper = { doc_type: 'lease', tenant_name: 'Γ. Παπαδόπουλος', monthly_rent: 600, lease_start: '2029-01-01', lease_end: '2031-12-31' } as const;
    let a: CommitAnswers = {};
    const q1 = await commit(paper, a);
    ok('APP-4/APP-3: πρώτα ποιος', q1.ask?.about === 'tenant');
    a = withAnswer(a, q1.ask!, 't1');
    const q2 = await commit(paper, a);
    ok('APP-4/APP-3: μετά οι όροι, χωρίς να ξαναρωτήσει ποιος', q2.ask?.about === 'lease');
    a = withAnswer(a, q2.ask!, 'update');
    const r = await commit(paper, a);
    ok('APP-4/APP-3: με τις δύο απαντήσεις καταχωρείται', !r.ask && table('tenants').length === 1 && table('tenants')[0].monthly_rent === 600);
  }

  // ══ APP-4 · Ποιον ενοικιαστή αφορά ═════════════════════════════════════
  {
    reset({ tenants: [{ ...tenantNow, full_name: 'Γεώργιος Παπαδόπουλος' }] });
    const r = await commit({ doc_type: 'lease', tenant_name: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ', afm: '094014201', monthly_rent: 550, lease_start: '2026-01-01', lease_end: '2028-12-31' });
    ok('APP-4: αντίστροφη σειρά λέξεων και κεφαλαία: ο ίδιος', !r.ask && table('tenants').length === 1);
    ok('APP-4: συμπληρώθηκε το ΑΦΜ που έλειπε', table('tenants')[0].afm === '094014201' && r.saved.includes('Ενοικιαστές'));
  }
  {
    // Το ΑΦΜ βρίσκει τον άνθρωπο ακόμη κι όταν το όνομα γράφεται εντελώς αλλιώς.
    reset({ tenants: [{ ...tenantNow, full_name: 'Τζόρτζ', afm: '094014201' }] });
    const r = await commit({ doc_type: 'lease', tenant_name: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ', afm: '094014201', monthly_rent: 550, lease_start: '2026-01-01', deposit: 1100 });
    ok('APP-4: ταίριασμα με ΑΦΜ', !r.ask && table('tenants').length === 1 && table('tenants')[0].deposit_amount === 1100);
  }
  {
    reset({ tenants: [tenantNow] });
    const r = await commit({ doc_type: 'lease', tenant_name: 'Νίκος Αλεξίου', monthly_rent: 500, lease_start: '2026-01-01' });
    ok('APP-4: άλλο όνομα με τρέχοντα ενοικιαστή: ρωτά', r.ask?.about === 'tenant' && r.ask.options[0]?.id === 't1');
    ok('APP-4: η ερώτηση δεν γράφει τίποτα, ούτε Φάκελο', table('tenants').length === 1 && !calls.includes('UPLOAD') && !calls.includes('POST tenants'));
    ok('APP-4: η τελευταία επιλογή λέει «Νέος ενοικιαστής»', r.ask?.none.label === 'Νέος ενοικιαστής');
    const same = await commit({ doc_type: 'lease', tenant_name: 'Νίκος Αλεξίου', monthly_rent: 500, lease_start: '2026-01-01', afm: '094014201' }, withAnswer({}, r.ask!, 't1'));
    ok('APP-4: «ο ίδιος» ενημερώνει τον τρέχοντα', !same.ask && table('tenants').length === 1 && table('tenants')[0].afm === '094014201');
    const fresh = await commit({ doc_type: 'lease', tenant_name: 'Νίκος Αλεξίου', monthly_rent: 500, lease_start: '2026-01-01' }, withAnswer({}, r.ask!, null));
    // Χωρίς αποδεκτή σύμβαση επεξεργασίας (εδώ: χωρίς συνεδρία) δεν γράφεται· και το λέει.
    ok('APP-4: «νέος» περνά από τη σύμβαση και η αποτυχία φαίνεται', !fresh.ask && (fresh.failed || []).includes('Ενοικιαστές'));
  }
  {
    // Δύο συνονόματοι με διαφορετικό ΑΦΜ δεν είναι ένας.
    reset({ tenants: [{ ...tenantNow, afm: '094014201' }] });
    const r = await commit({ doc_type: 'lease', tenant_name: 'Γιώργος Παπαδόπουλος', afm: '090000045', monthly_rent: 500, lease_start: '2026-01-01' });
    ok('APP-4: ίδιο όνομα, άλλο ΑΦΜ: ρωτά', r.ask?.about === 'tenant');
  }
  {
    // Αποτυχημένη ανάγνωση ενοικιαστών δεν σημαίνει «κανένας»: δεν γράφεται δεύτερος.
    reset({ tenants: [tenantNow] });
    broken.add('GET tenants');
    const r = await commit({ doc_type: 'lease', tenant_name: 'Νίκος Αλεξίου', monthly_rent: 500, lease_start: '2026-01-01' });
    ok('APP-4: χωρίς ανάγνωση, κανένας νέος ενοικιαστής', !calls.includes('POST tenants') && (r.failed || []).includes('Ενοικιαστές'));
  }

  // ══ APP-6 · Ο μήνας των κοινοχρήστων ═════════════════════════════════════
  {
    reset({ bills_settings: [{ id: 's1', property_id: P, user_id: U, section: 'common', data: { history: ['', '', '', '', '', '', '', '', '', '90', '', ''] } }] });
    await commit({ doc_type: 'bill', category: 'common', provider: 'Διαχείριση πολυκατοικίας', amount: 120, issue_date: '2026-10-05', period_from: '2026-09-01', period_to: '2026-09-30' });
    const h = (table('bills_settings')[0].data as { history: string[] }).history;
    ok(`APP-6: Σεπτέμβριος στη θέση του Σεπτεμβρίου (πήρα ${JSON.stringify(h)})`, h[8] === '120');
    ok('APP-6: ο Οκτώβριος δεν πατήθηκε', h[9] === '90');
  }
  {
    reset({ bills_settings: [{ id: 's1', property_id: P, user_id: U, section: 'common', data: { history: Array(12).fill('') } }] });
    await commit({ doc_type: 'bill', category: 'common', provider: 'Διαχείριση', amount: 140, issue_date: '2026-01-07', period_from: '2025-12-01', period_to: '2025-12-31' }, { today: '2027-01-10' });
    const h = (table('bills_settings')[0].data as { history: string[] }).history;
    ok('APP-6: ο Δεκέμβριος που σαρώνεται τον Ιανουάριο δεν μπαίνει στον Ιανουάριο', h.every(v => v === ''));
  }
  {
    // Αποτυχημένη ανάγνωση της ενότητας: καμία εγγραφή, αλλιώς σβήνουν οι έντεκα μήνες.
    const kept = ['10', '20', '30', '40', '50', '60', '70', '80', '', '', '', ''];
    reset({ bills_settings: [{ id: 's1', property_id: P, user_id: U, section: 'common', data: { history: kept } }] });
    broken.add('GET bills_settings');
    const r = await commit({ doc_type: 'bill', category: 'common', provider: 'Διαχείριση', amount: 120, period_from: '2026-09-01', period_to: '2026-09-30' });
    ok('APP-6: χωρίς ανάγνωση το Ιστορικό μένει ανέπαφο', JSON.stringify((table('bills_settings')[0].data as { history: string[] }).history) === JSON.stringify(kept));
    ok('APP-6: και η αναφορά το λέει', (r.failed || []).includes('Κοινόχρηστα'));
  }

  // ══ APP-7 · Ό,τι δεν γράφτηκε λέγεται ════════════════════════════════════
  {
    reset();
    broken.add('UPLOAD');
    const r = await commit({ doc_type: 'bill', category: 'electricity', provider: 'ΔΕΗ', amount: 61.2, due_date: '2026-11-02' });
    ok('APP-7: αποτυχία ανεβάσματος: ο Φάκελος στα failed', r.saved.includes('Λογαριασμοί') && (r.failed || []).includes('Φάκελος ακινήτου'));
  }
  {
    reset();
    broken.add('POST bills');
    const r = await commit({ doc_type: 'bill', category: 'electricity', provider: 'ΔΕΗ', amount: 61.2, due_date: '2026-11-02' });
    ok('APP-7: αποτυχία λογαριασμού: στα failed', (r.failed || []).includes('Λογαριασμοί') && !r.saved.includes('Λογαριασμοί'));
  }
  {
    reset({ tenants: [{ ...tenantNow, lease_start: null, lease_end: null, monthly_rent: null }] });
    broken.add('POST rent_payments');
    const r = await commit({ doc_type: 'lease', tenant_name: 'Γιώργος Παπαδόπουλος', monthly_rent: 500, lease_start: '2026-01-01', rent_due_day: 5 });
    ok('APP-7: αποτυχία δόσεων: χωρίς ετικέτα «Δόσεις ενοικίου»', !r.saved.includes('Δόσεις ενοικίου') && (r.failed || []).includes('Δόσεις ενοικίου'));
  }
  {
    reset();
    const r = await commit({ doc_type: 'bill', category: 'electricity', provider: 'ΔΕΗ', amount: 61.2, due_date: '2026-11-02' });
    ok('APP-7: όταν όλα πετυχαίνουν, κανένα failed', r.failed === undefined && r.saved.length > 0);
  }

  // ══ PR402 · Το παλαιότερο ΠΕΑ δεν γυρίζει πίσω την κατηγορία ═════════════
  {
    reset({
      // Η κατηγορία γράφεται με λατινικά (peaClassOf): «Β» → «B».
      user_properties: [{ id: P, user_id: U, pea_class: 'B' }],
      calendar_events: [{ id: 'c1', property_id: P, user_id: U, title: 'Λήξη ΠΕΑ', event_date: '2036-05-01', category: 'contract' }],
    });
    await commit({ doc_type: 'government', subtype: 'pea', title: 'ΠΕΑ', pea_class: 'Δ', expiry_date: '2030-01-01' });
    ok(`PR402: η κατηγορία μένει B (πήρα ${table('user_properties')[0].pea_class})`, table('user_properties')[0].pea_class === 'B');
    ok('PR402: καμία δεύτερη υπενθύμιση λήξης για το παλιό', table('calendar_events').length === 1);
    await commit({ doc_type: 'government', subtype: 'pea', title: 'ΠΕΑ', pea_class: 'Α', expiry_date: '2037-02-01' });
    ok('PR402: νεότερο ΠΕΑ αντικαθιστά', table('user_properties')[0].pea_class === 'A' && table('calendar_events').length === 2);
    await commit({ doc_type: 'government', subtype: 'pea', title: 'ΠΕΑ', pea_class: 'Α', expiry_date: '2037-02-01' });
    ok('PR402: το ίδιο ΠΕΑ δεύτερη φορά: καμία δεύτερη υπενθύμιση', table('calendar_events').length === 2 && table('user_properties')[0].pea_class === 'A');
  }

  // ══ APP-5 · Ό,τι δεν διαβάζεται σταματά πριν φύγει ═════════════════════
  {
    reset();
    for (const f of [
      new File(['a;b'], 'kiniseis.csv', { type: 'text/csv' }),
      new File(['x'], 'fyllo.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' }),
    ]) {
      const r = await scanDocument(f);
      ok(`APP-5: ${f.name} → format (πήρα ${r.error})`, r.error === 'format' && !!r.errorText);
    }
    ok('APP-5: καμία κλήση προς την ανάγνωση', !calls.some(c => c.includes('/api/anthropic')));
    ok('APP-5: το HEIC λέει τι να κάνεις', /HEIC/.test(unreadableFormat({ type: 'image/heic', name: 'a.heic' })));
    ok('APP-5: JPEG, PNG, PDF διαβάζονται', ['image/jpeg', 'image/png', 'application/pdf'].every(t => scanMime({ type: t }) === t));
    ok('APP-5: χωρίς δηλωμένο τύπο κρίνει η κατάληξη', scanMime({ type: '', name: 'λογαριασμός.PDF' }) === 'application/pdf' && scanMime({ type: '', name: 'a.heic' }) === '');
    ok('APP-5: το accept δεν προσφέρει Excel ή CSV', !/csv|xls|ods|heic/i.test(SCAN_ACCEPT));
    const src = readFileSync(join(process.cwd(), 'app/dashboard/components/DocumentScan.tsx'), 'utf8');
    ok('APP-5: η σάρωση παίρνει το accept από τη μία λίστα', src.includes('accept={SCAN_ACCEPT}') && !/accept="image\/\*,\.pdf,\.csv/.test(src));
    ok('APP-5: το πλακίδιο δεν υπόσχεται Excel', !/JPG · PNG · PDF · Excel/.test(src));
    // Ο κάδος `property-files` δέχεται JPEG, PNG, WEBP, HEIC, HEIF, PDF (SELECT
    // στην παραγωγή, 19/10/2026). Η σάρωση αρχειοθετεί το πρωτότυπο: ό,τι
    // διαβάζει πρέπει και να χωρά.
    ok('APP-5: το GIF δεν σαρώνεται (ο Φάκελος δεν το κρατά)', scanMime({ type: 'image/gif' }) === '' && folderMime({ type: 'image/gif' }) === '');
    ok('APP-5: ό,τι διαβάζεται χωρά στον Φάκελο', ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].every(t => !!scanMime({ type: t }) && !!folderMime({ type: t })));
    ok('APP-5: το HEIC δεν διαβάζεται αλλά αρχειοθετείται', !scanMime({ type: 'image/heic' }) && folderMime({ type: 'image/heic' }) === 'image/heic' && folderMime({ type: '', name: 'IMG_1.HEIF' }) === 'image/heif');
    ok('APP-5: Word και Excel σταματούν με λόγο', !!notForFolder({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'misthotirio.docx' })
      && !!notForFolder({ type: 'text/csv', name: 'kiniseis.csv' }) && notForFolder({ type: 'application/pdf' }) === '');
    const tab = readFileSync(join(process.cwd(), 'app/dashboard/components/TabDocuments.tsx'), 'utf8');
    ok('APP-5: το Αρχείο παίρνει το accept από τον Φάκελο', tab.includes('accept={FOLDER_ACCEPT}') && !/\.docx|\.xlsx|\.csv/.test(tab));
    ok('APP-5: το Αρχείο δεν υπόσχεται Word ή Excel', !/Word ή Excel/.test(tab));
    ok('APP-5: το Αρχείο σταματά ό,τι δεν χωρά πριν από την ανάγνωση', /notForFolder\(d\.file\)[\s\S]{0,400}scanFile\(d\.file\)/.test(tab));
  }

  // ══ Οι τρεις οθόνες: ίδιες απαντήσεις, μία κάρτα κάθε φορά ═════════════
  {
    const q: ReconcileQuestion = { about: 'bill', question: 'Ποιον;', note: '', options: [], none: { label: 'Κανέναν από αυτούς', hint: '' } };
    ok('APP-1: η ερώτηση κλείνει την κάρτα διπλοεγγραφής', openQuestion({ saved: [], ask: q }).duplicate === '' && openQuestion({ saved: [], ask: q }).ask === q);
    ok('APP-1: η διπλοεγγραφή κλείνει την ερώτηση', openQuestion({ saved: [], duplicate: 'x' }).ask === null);
    ok('APP-7: μία αποτυχία σε μία πρόταση', failedNotice(['Φάκελος ακινήτου']) === 'Δεν ενημερώθηκε: Φάκελος ακινήτου. Δοκίμασε ξανά από την αντίστοιχη καρτέλα.');
    ok('APP-7: τίποτα να πει όταν δεν απέτυχε τίποτα', failedNotice(undefined) === '' && failedNotice([]) === '');
    const read = (f: string) => readFileSync(join(process.cwd(), 'app/dashboard/components', f), 'utf8');
    const scan = read('DocumentScan.tsx'), archive = read('TabDocuments.tsx'), noa = read('assistant/useAssistantActions.ts');
    ok('APP-1: η σάρωση στέλνει τις απαντήσεις μαζί (όχι save(o.id) σκέτο)', scan.includes('save(withAnswer(answers, ask, o.id))') && !scan.includes('save(o.id)'));
    ok('APP-1: η σάρωση κρατά μία κάρτα κάθε φορά', scan.includes('openQuestion(r)'));
    ok('APP-2: το Αρχείο ξεχωρίζει τη διπλοεγγραφή από την αποτυχία', archive.includes('openQuestion(r)') && archive.includes('Καταχώρησέ το ούτως ή άλλως'));
    ok('APP-2: η Νόα λέει ότι βρέθηκε παρόμοια δαπάνη και ρωτά', noa.includes('r.duplicate') && noa.includes('allowDuplicate: true'));
    ok('APP-7: η οθόνη επιτυχίας λέει τι δεν γράφτηκε', scan.includes('failedNotice(failedInfo)'));
  }

  console.log(`scanDoc (καταχώρηση): ${pass} ✓ · ${fail} ✗`);
  if (fail) process.exit(1);
})();
