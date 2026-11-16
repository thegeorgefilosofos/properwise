// npx tsx lib/data/firms.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΓΡΑΦΕΙΑ: ΟΙ ΛΕΞΕΙΣ, ΤΑ ΦΙΛΤΡΑ ΚΑΙ Η ΣΥΝΟΨΗ ΤΗΣ ΗΜΕΡΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Η βάση αποφασίζει τι επιτρέπεται. Εδώ ελέγχεται ότι η οθόνη λέει το ίδιο:
// ότι ο συνεργάτης δεν βλέπει κουμπί που η βάση θα αρνιόταν, ότι το μενού
// «Καταχώρηση» έχει μόνο ό,τι δίνει το επίπεδο και ότι η σύνοψη διαβάζεται.
// ═══════════════════════════════════════════════════════════════════════════
import {
  ROLE_LABEL, LEVEL_LABEL, KIND_LABEL, canAct, canManage, entryKinds, daySentence, reasonOf, reasonText,
  filterClients, logLine, undoRecord, itemsFor, undoDaysFrom, inAthensDay, undoFirmDay,
  sendInviteEmail, inviteOutcome, type ClientLevel, type OpenItem,
} from './firms';
import { readdirSync, readFileSync } from 'node:fs';
import { FIRM_UNDO_DAYS } from '@/lib/legal/firms';
import { athensToday } from '@/lib/core/time';
import type { SupabaseClient } from '@supabase/supabase-js';
import { rotatedSentence } from './accountantLink';

let pass = 0, fail = 0;
const fails: string[] = [];
const eq = (n: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; fails.push(`${n} — got ${g}, want ${w}`); }
};
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; fails.push(n); } };

// ── Οι λέξεις που όρισε ο ιδιοκτήτης ───────────────────────────────────────
eq('υπεύθυνος', ROLE_LABEL.manager, 'Υπεύθυνος γραφείου');
eq('λογιστής', ROLE_LABEL.accountant, 'Λογιστής');
eq('συνεργάτης', ROLE_LABEL.associate, 'Συνεργάτης');
ok('ποτέ «βοηθός»', !Object.values(ROLE_LABEL).some(l => /βοηθ/i.test(l)));
eq('τα τρία επίπεδα', Object.values(LEVEL_LABEL), ['Μόνο ανάγνωση', 'Ανέβασμα παραστατικών', 'Τήρηση για λογαριασμό μου']);
eq('τα είδη γραφείου', Object.values(KIND_LABEL), ['Λογιστικό γραφείο', 'Φοροτεχνικό γραφείο']);

// ── Ο ρόλος κρίνει το κουμπί ───────────────────────────────────────────────
ok('ο συνεργάτης δεν ενεργεί', !canAct('associate'));
ok('ο λογιστής ενεργεί', canAct('accountant'));
ok('ο λογιστής δεν διοικεί', !canManage('accountant'));
ok('ο υπεύθυνος διοικεί', canManage('manager'));
ok('χωρίς ρόλο τίποτα', !canAct(null) && !canManage(undefined));

// ── Το μενού «Καταχώρηση» έχει μόνο ό,τι δίνει το επίπεδο ─────────────────
eq('μόνο ανάγνωση: άδειο', entryKinds('read'), []);
eq('ανέβασμα: μόνο παραστατικό', entryKinds('upload'), ['document']);
eq('τήρηση: τα έξι, με τη σειρά', entryKinds('keep'), ['document', 'bill', 'rent', 'tax', 'loan', 'tenant']);
eq('χωρίς επίπεδο (συνεργάτης): άδειο', entryKinds(null), []);

// ── Η σύνοψη της ημέρας ────────────────────────────────────────────────────
eq('3 πληρωμές και 1 μισθωτής',
  daySentence({ firmId: 'f', firmName: 'Παπαδόπουλος', total: 4, counts: { bill: 2, event: 1, tenant: 1 } }),
  '«Παπαδόπουλος»: σήμερα καταχώρησε 3 πληρωμές και 1 μισθωτή.');
eq('ένα μόνο είδος, ενικός',
  daySentence({ firmId: 'f', firmName: 'Α', total: 1, counts: { document: 1 } }),
  '«Α»: σήμερα καταχώρησε 1 παραστατικό.');
eq('τρία είδη: κόμμα ανάμεσα, «και» χωρίς κόμμα στο τέλος',
  daySentence({ firmId: 'f', firmName: 'Α', total: 6, counts: { expense: 1, rent: 2, document: 3 } }),
  '«Α»: σήμερα καταχώρησε 1 πληρωμή, 2 εισπράξεις και 3 παραστατικά.');
eq('τίποτα: καμία πρόταση', daySentence({ firmId: 'f', firmName: 'Α', total: 0, counts: {} }), '');
const COMMA_KAI = new RegExp(',\\s' + 'και');
ok('ποτέ κόμμα πριν από το «και»', !COMMA_KAI.test(daySentence({ firmId: 'f', firmName: 'Α', total: 9, counts: { bill: 1, rent: 1, tenant: 1, document: 1 } })));

// ── Τα σφάλματα της βάσης γίνονται φράσεις ─────────────────────────────────
eq('firm_record:no_loan', reasonOf('firm_record:no_loan'), 'no_loan');
eq('2FA', reasonOf('mfa_required'), 'mfa_required');
eq('ακίνητο από λογαριασμό γραφείου', reasonOf('firm_account'), 'firm_account');
eq('άγνωστο', reasonOf('κάτι άλλο'), 'error');
ok('κάθε λόγος έχει φράση με τελεία', ['not_allowed', 'property', 'type', 'size', 'no_loan', 'already_paid', 'future',
  'not_payable', 'paid_at', 'too_late', 'not_ours', 'mfa_required', 'not_manager', 'last_manager', 'email', 'afm', 'name',
  'in_other_firm', 'owner_account', 'error'].every(r => /\.$/.test(reasonText(r)) && !COMMA_KAI.test(reasonText(r))));

// ── Τα φίλτρα ──────────────────────────────────────────────────────────────
{
  const rows = [
    { ownerId: 'a', assignees: [{ userId: 'u1' }], blocking: true },
    { ownerId: 'b', assignees: [{ userId: 'u2' }], blocking: false },
    { ownerId: 'c', assignees: [], blocking: false },
  ];
  const meta = new Map<string, ClientLevel>([
    ['a', { ownerId: 'a', level: 'read', mine: true, myLevel: null }],
    ['b', { ownerId: 'b', level: 'keep', mine: false, myLevel: 'keep' }],
    ['c', { ownerId: 'c', level: 'read', mine: false, myLevel: null }],
  ]);
  const ids = (s: Parameters<typeof filterClients>[2]) => filterClients(rows, meta, s).map(r => r.ownerId);
  eq('όλοι', ids({ scope: 'all', assignee: '', status: 'all' }), ['a', 'b', 'c']);
  eq('οι πελάτες μου', ids({ scope: 'mine', assignee: '', status: 'all' }), ['a']);
  eq('υπεύθυνος u2', ids({ scope: 'all', assignee: 'u2', status: 'all' }), ['b']);
  eq('χωρίς υπεύθυνο', ids({ scope: 'all', assignee: '-', status: 'all' }), ['c']);
  eq('με εκκρεμότητες', ids({ scope: 'all', assignee: '', status: 'blocked' }), ['a']);
  eq('έτοιμοι', ids({ scope: 'all', assignee: '', status: 'ready' }), ['b', 'c']);
  // Ο «Σχεδόν έτοιμος» (κενά χωρίς μπλοκάρισμα) δεν είναι «Έτοιμος»: ίδιο μέτρο με τη σύνοψη.
  const almost = rows.map(r => ({ ...r, complete: r.ownerId === 'c' }));
  eq('έτοιμοι = όσοι δεν έχουν κανένα κενό', filterClients(almost, meta, { scope: 'all', assignee: '', status: 'ready' }).map(r => r.ownerId), ['c']);
}

// ── Το ημερολόγιο όπως το διαβάζει ο ιδιοκτήτης (20261104150000) ─────────
{
  eq('νέος λογαριασμός με ετικέτα', logLine({ kind: 'bill', action: 'insert', label: 'ΔΕΗ Μάρτιος', fields: null }), 'Λογαριασμός «ΔΕΗ Μάρτιος» · καταχωρήθηκε');
  eq('μισθωτής χωρίς ετικέτα', logLine({ kind: 'tenant', action: 'insert', label: null, fields: null }), 'Μισθωτής · καταχωρήθηκε');
  eq('αλλαγή δύο πεδίων, χωρίς κόμμα πριν από το «και»',
    logLine({ kind: 'bill', action: 'update', label: null, fields: ['amount', 'due_date'] }), 'Λογαριασμός · άλλαξε ποσό και λήξη');
  eq('τρία πεδία', logLine({ kind: 'expense', action: 'update', label: null, fields: ['amount', 'date', 'category'] }), 'Δαπάνη · άλλαξε ποσό, ημερομηνία και κατηγορία');
  eq('πεδία χωρίς όνομα', logLine({ kind: 'rent', action: 'update', label: null, fields: ['base_rent', 'services_charge'] }), 'Είσπραξη ενοικίου · άλλαξαν 2 πεδία');
  eq('πληρωμή δόσης', logLine({ kind: 'event', action: 'mark_paid', label: 'ΕΝΦΙΑ 3/5', fields: ['status'] }), 'Δόση «ΕΝΦΙΑ 3/5» · σημειώθηκε η πληρωμή');
  ok('η πληρωμή χωρίς επίθετο που δεν συμφωνεί σε γένος', !/πληρωμέν/.test(logLine({ kind: 'bill', action: 'mark_paid', label: null, fields: null })));
  ok('η άρνηση της σύμβασης λέει τι να γίνει', reasonText(reasonOf('firm_record:dpa')).startsWith('Ο πελάτης πρέπει πρώτα να αποδεχτεί τους όρους επεξεργασίας'));
  ok('μηδενικό ποσό: λέει τι λείπει, όχι «δοκίμασε ξανά»', reasonText('amount') === 'Γράψε το ποσό που πληρώθηκε.');
  ok('καμία γραμμή χωρίς «βοηθός»', !/βοηθ/i.test(logLine({ kind: 'document', action: 'delete', label: null, fields: null })));
  const s = rotatedSentence({ at: '2026-11-04T10:00:00Z', reason: 'member_left' });
  ok('η ανανέωση λέει την ημερομηνία dd/mm/yyyy', s.includes('04/11/2026'));
  ok('η ανανέωση λέει τον λόγο', s.includes('αποχώρησε μέλος'));
  ok('η ανανέωση χωρίς κόμμα πριν από το «και»', !s.includes([',', 'και'].join(' ')));
}

// ── Ποια εκκρεμότητα πάει σε ποιο είδος του μενού ─────────────────────────
{
  const it = (kind: OpenItem['kind'], name: string): OpenItem => ({ kind, id: name, propertyId: 'p', property: 'Π', name, amount: 10, due: '2026-11-30' });
  const all = [
    it('event', 'ΕΝΦΙΑ, 9η δόση'), it('event', 'Φόρος εισοδήματος, 2η δόση'), it('bill', 'Δόση φόρου ακινήτων'),
    it('event', 'Δάνειο Εθνικής, δόση Νοεμβρίου'), it('rent', 'Ενοίκιο Νοεμβρίου'),
    it('bill', 'ΔΕΗ Οκτωβρίου'), it('bill', 'Προμήθεια πλατφόρμας'), it('bill', 'Μεταφορά επίπλων'), it('bill', 'Διαφορά κοινοχρήστων'),
  ];
  const names = (k: string) => itemsFor(k, all).map(i => i.name);
  eq('δόσεις φόρου', names('tax'), ['ΕΝΦΙΑ, 9η δόση', 'Φόρος εισοδήματος, 2η δόση', 'Δόση φόρου ακινήτων']);
  eq('λογαριασμοί: η «πλατφόρμα», η «μεταφορά» και η «διαφορά» δεν είναι φόρος', names('bill'), ['ΔΕΗ Οκτωβρίου', 'Προμήθεια πλατφόρμας', 'Μεταφορά επίπλων', 'Διαφορά κοινοχρήστων']);
  eq('δόσεις δανείου', names('loan'), ['Δάνειο Εθνικής, δόση Νοεμβρίου']);
  eq('ενοίκια', names('rent'), ['Ενοίκιο Νοεμβρίου']);
}

// ── Σήμερα και χθες, ημερολογιακές μέρες Αθήνας ─────────────────────────
// Η Πολιτική υπόσχεται αναίρεση μέσα σε FIRM_UNDO_DAYS ημέρες· η οθόνη δείχνει
// τόσες μέρες, με τη μέρα της Αθήνας και όχι του UTC ή του περιηγητή.
{
  const undoDays = (now = new Date()) => undoDaysFrom(athensToday(now));
  const days = (iso: string) => undoDays(new Date(iso)).map(d => `${d.word}:${d.day}`);
  eq('όσες μέρες λέει η Πολιτική', undoDays().length, FIRM_UNDO_DAYS);
  eq('χειμώνας 23:59:59 Αθήνας: ακόμη η ίδια μέρα', days('2026-11-08T21:59:59Z'), ['Σήμερα:2026-11-08', 'Χθες:2026-11-07']);
  eq('χειμώνας 00:00 Αθήνας: νέα μέρα, ενώ στο UTC είναι ακόμη χθες', days('2026-11-08T22:00:00Z'), ['Σήμερα:2026-11-09', 'Χθες:2026-11-08']);
  eq('χειμώνας 01:59 Αθήνας', days('2026-11-08T23:59:00Z'), ['Σήμερα:2026-11-09', 'Χθες:2026-11-08']);
  eq('καλοκαίρι 23:59 Αθήνας (UTC+3)', days('2026-07-31T20:59:00Z'), ['Σήμερα:2026-07-31', 'Χθες:2026-07-30']);
  eq('καλοκαίρι 00:00 Αθήνας: αλλάζει και ο μήνας', days('2026-07-31T21:00:00Z'), ['Σήμερα:2026-08-01', 'Χθες:2026-07-31']);
  eq('πρωτοχρονιά 00:00 Αθήνας: χθες είναι πέρσι', days('2026-12-31T22:00:00Z'), ['Σήμερα:2027-01-01', 'Χθες:2026-12-31']);
  eq('1η Μαρτίου μη δίσεκτου έτους', days('2027-02-28T22:30:00Z'), ['Σήμερα:2027-03-01', 'Χθες:2027-02-28']);
  eq('μέρα αλλαγής σε θερινή ώρα (29/03/2026)', days('2026-03-28T22:30:00Z'), ['Σήμερα:2026-03-29', 'Χθες:2026-03-28']);
  eq('μέρα επιστροφής στη χειμερινή ώρα (25/10/2026), 23:30 Αθήνας', days('2026-10-25T21:30:00Z'), ['Σήμερα:2026-10-25', 'Χθες:2026-10-24']);
  eq('από το «σήμερα» σε κείμενο', undoDaysFrom('2026-03-01').map(d => d.day), ['2026-03-01', '2026-02-28']);
  ok('στιγμή 23:59 Αθήνας ανήκει στο χθες', inAthensDay('2026-11-08T21:59:00Z', '2026-11-08'));
  ok('στιγμή 00:01 Αθήνας ανήκει στο σήμερα', inAthensDay('2026-11-08T22:01:00Z', '2026-11-09') && !inAthensDay('2026-11-08T22:01:00Z', '2026-11-08'));
  eq('η πρόταση του χθες', daySentence({ firmId: 'f', firmName: 'Α', total: 1, counts: { rent: 1 } }, 'χθες'), '«Α»: χθες καταχώρησε 1 είσπραξη.');
  eq('ο λόγος «window»', reasonText('window'), 'Η αναίρεση γίνεται για σήμερα και χθες. Ανανέωσε τη σελίδα.');

  // Η ΒΑΣΗ ΚΡΑΤΑ ΤΟ ΙΔΙΟ ΠΑΡΑΘΥΡΟ. Η τελευταία μετανάστευση που ορίζει την
  // owner_undo_firm_day πρέπει να αρνείται ό,τι είναι πριν από FIRM_UNDO_DAYS - 1
  // μέρες και να κρίνει με τη μέρα της Αθήνας.
  const dir = 'supabase/migrations';
  const last = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
    .filter(f => /create or replace function public\.owner_undo_firm_day/.test(readFileSync(`${dir}/${f}`, 'utf8'))).pop() ?? '';
  const sql = readFileSync(`${dir}/${last}`, 'utf8');
  const body = sql.slice(sql.indexOf('create or replace function public.owner_undo_firm_day'));
  ok('η βάση: παράθυρο FIRM_UNDO_DAYS', body.includes(`v_day < v_today - ${FIRM_UNDO_DAYS - 1}`));
  ok('η βάση: χωρίς current_date', !/current_date/.test(body.slice(0, body.indexOf('end $$'))));
}

// ── Η «Αναίρεση» του μηνύματος σβήνει και το αρχείο ───────────────────────
// Η firm_record_delete σβήνει τη γραμμή και επιστρέφει το `filePath`. Πριν, το
// PDF του παραστατικού έμενε στον φάκελο του πελάτη μετά την αναίρεση.
void (async () => {
  const fake = (answer: { data?: unknown; error?: { message: string } | null }) => {
    const removed: string[][] = [];
    const db = {
      rpc: async () => ({ data: answer.data ?? null, error: answer.error ?? null }),
      storage: { from: () => ({ remove: async (p: string[]) => { removed.push(p); return { data: null, error: null }; } }) },
    } as unknown as SupabaseClient;
    return { db, removed };
  };
  const doc = fake({ data: { ok: true, filePath: 'o/p/document/1_a.pdf' } });
  const r1 = await undoRecord(doc.db, 'document', 'id-1');
  ok('αναίρεση παραστατικού: πετυχαίνει', r1.ok);
  eq('αναίρεση παραστατικού: σβήνει και το αρχείο', doc.removed, [['o/p/document/1_a.pdf']]);
  const ten = fake({ data: { ok: true, filePath: null } });
  await undoRecord(ten.db, 'tenant', 'id-2');
  eq('αναίρεση μισθωτή: δεν αγγίζει αρχεία', ten.removed, []);
  const late = fake({ error: { message: 'firm_record:not_allowed' } });
  const r3 = await undoRecord(late.db, 'document', 'id-3');
  eq('αναίρεση που αρνείται η βάση: λέει τον λόγο', r3.ok ? null : r3.reason, 'not_allowed');
  eq('αναίρεση που αρνείται η βάση: το αρχείο μένει', late.removed, []);

  // Η «Αναίρεση όλων» της μέρας: με τη βάση του 20261109100000 σβήνει και τα
  // αρχεία· με την παλιά (χωρίς `filePaths`) αναιρεί όπως πριν, χωρίς σφάλμα.
  const day = fake({ data: { ok: true, undone: 2, skipped: 0, filePaths: ['o/p/document/a.pdf', 'o/p/document/b.pdf'] } });
  const d1 = await undoFirmDay(day.db, 'f1', '2026-11-08');
  ok('αναίρεση μέρας: πετυχαίνει', d1.ok);
  eq('αναίρεση μέρας: σβήνει τα αρχεία των παραστατικών', day.removed, [['o/p/document/a.pdf', 'o/p/document/b.pdf']]);
  const old = fake({ data: { ok: true, undone: 1, skipped: 0 } });
  ok('αναίρεση μέρας, παλιά βάση: πετυχαίνει', (await undoFirmDay(old.db, 'f1', '2026-11-08')).ok);
  eq('αναίρεση μέρας, παλιά βάση: δεν αγγίζει αρχεία', old.removed, []);
  const none = fake({ data: { ok: true, undone: 1, skipped: 0, filePaths: [] } });
  await undoFirmDay(none.db, 'f1', '2026-11-08');
  eq('αναίρεση μέρας χωρίς παραστατικά: καμία κλήση στο storage', none.removed, []);
  const win = fake({ data: { ok: false, reason: 'window' } });
  const d4 = await undoFirmDay(win.db, 'f1', '2026-11-01');
  eq('αναίρεση έξω από το παράθυρο: ο λόγος', d4.ok ? null : d4.reason, 'window');
  eq('αναίρεση έξω από το παράθυρο: κανένα αρχείο', win.removed, []);

  // ── Το email της πρόσκλησης: «στάλθηκε» μόνο όταν όντως στάλθηκε ──
  const fn = (answer: { data?: unknown; error?: unknown; throws?: boolean }) => {
    const calls: unknown[] = [];
    const db = { functions: { invoke: async (name: string, o: unknown) => {
      calls.push([name, o]);
      if (answer.throws) throw new Error('δίκτυο');
      return { data: answer.data ?? null, error: answer.error ?? null };
    } } } as unknown as SupabaseClient;
    return { db, calls };
  };
  const sent = fn({ data: { sent: true } });
  eq('email: στάλθηκε', await sendInviteEmail(sent.db, 'a@b.gr'), 'sent');
  eq('email: καλεί τη σωστή συνάρτηση με τη διεύθυνση', sent.calls, [['send-firm-invite', { body: { email: 'a@b.gr' } }]]);
  eq('email: άρνηση της συνάρτησης (403/404/429/502) = δεν στάλθηκε', await sendInviteEmail(fn({ error: { message: 'Edge Function returned a non-2xx status code' } }).db, 'a@b.gr'), 'failed');
  eq('email: πεσμένο δίκτυο = δεν στάλθηκε', await sendInviteEmail(fn({ throws: true }).db, 'a@b.gr'), 'failed');
  eq('email: απάντηση χωρίς sent = δεν στάλθηκε', await sendInviteEmail(fn({ data: {} }).db, 'a@b.gr'), 'failed');

  const off = fn({ error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'no_resend_key' }) } } });
  eq('email: χωρίς πάροχο = ανενεργή αποστολή', await sendInviteEmail(off.db, 'a@b.gr'), 'off');
  const P = 'properwise.gr/accountant/workspace';
  const base = { existing: false, member: false, email: 'a@b.gr', portal: P };
  eq('οθόνη: νέα πρόσκληση με email', inviteOutcome({ ...base, mail: 'sent' }),
    'Η πρόσκληση καταχωρήθηκε. Στάλθηκε email στο a@b.gr.');
  const noMail = inviteOutcome({ ...base, mail: 'failed' });
  ok('οθόνη: χωρίς email δεν λέει «στάλθηκε email»', !/Στάλθηκε/.test(noMail));
  eq('οθόνη: αποτυχία email λέει πού και με ποια διεύθυνση μπαίνει', noMail,
    `Η πρόσκληση καταχωρήθηκε. Το email δεν στάλθηκε. Για να την αποδεχτεί, το μέλος συνδέεται στο ${P} με τη διεύθυνση a@b.gr.`);
  const offMail = inviteOutcome({ ...base, mail: 'off' });
  ok('οθόνη: ανενεργή αποστολή δεν λέει «στάλθηκε email»', !/Στάλθηκε/.test(offMail) && offMail.includes('Η αποστολή email δεν είναι ενεργή.') && offMail.includes(P));
  eq('οθόνη: ξανά σε εκκρεμή πρόσκληση', inviteOutcome({ ...base, existing: true, mail: 'sent' }),
    'Η διεύθυνση είχε ήδη πρόσκληση. Στάλθηκε ξανά email στο a@b.gr.');
  ok('οθόνη: ξανά χωρίς email λέει πού μπαίνει', inviteOutcome({ ...base, existing: true, mail: 'failed' }).startsWith('Η διεύθυνση είχε ήδη πρόσκληση. Το email δεν στάλθηκε.'));
  eq('οθόνη: ενεργό μέλος, κανένα email', inviteOutcome({ ...base, existing: true, member: true, mail: null }),
    'Η διεύθυνση ανήκει ήδη σε μέλος του γραφείου.');
  ok('οθόνη: κανένα κόμμα πριν από «και»', (['sent', 'failed', 'off'] as const).every(m => !/,\s+και\s/.test(inviteOutcome({ ...base, mail: m }))));

  console.log(`\nfirms: ${fail === 0 ? `✓ ${pass} έλεγχοι` : `✗ ${fail} απέτυχαν από ${pass + fail}`}`);
  if (fail) { console.log(fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
})();
