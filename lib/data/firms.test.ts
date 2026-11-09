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
  filterClients, logLine, undoRecord, itemsFor, type ClientLevel, type OpenItem,
} from './firms';
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

  console.log(`\nfirms: ${fail === 0 ? `✓ ${pass} έλεγχοι` : `✗ ${fail} απέτυχαν από ${pass + fail}`}`);
  if (fail) { console.log(fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
})();
