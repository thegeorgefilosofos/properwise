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
  filterClients, logLine, type ClientLevel,
} from './firms';
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
}

// ── Το ημερολόγιο όπως το διαβάζει ο ιδιοκτήτης (20261104150000) ─────────
{
  eq('νέος λογαριασμός με ετικέτα', logLine({ kind: 'bill', action: 'insert', label: 'ΔΕΗ Μάρτιος', fields: null }), 'Λογαριασμός «ΔΕΗ Μάρτιος» · καταχωρήθηκε');
  eq('μισθωτής χωρίς ετικέτα', logLine({ kind: 'tenant', action: 'insert', label: null, fields: null }), 'Μισθωτής · καταχωρήθηκε');
  eq('αλλαγή δύο πεδίων, χωρίς κόμμα πριν από το «και»',
    logLine({ kind: 'bill', action: 'update', label: null, fields: ['amount', 'due_date'] }), 'Λογαριασμός · άλλαξε ποσό και λήξη');
  eq('τρία πεδία', logLine({ kind: 'expense', action: 'update', label: null, fields: ['amount', 'date', 'category'] }), 'Δαπάνη · άλλαξε ποσό, ημερομηνία και κατηγορία');
  eq('πεδία χωρίς όνομα', logLine({ kind: 'rent', action: 'update', label: null, fields: ['base_rent', 'services_charge'] }), 'Είσπραξη ενοικίου · άλλαξαν 2 πεδία');
  eq('πληρωμή δόσης', logLine({ kind: 'event', action: 'mark_paid', label: 'ΕΝΦΙΑ 3/5', fields: ['status'] }), 'Δόση «ΕΝΦΙΑ 3/5» · σημειώθηκε πληρωμένο');
  ok('καμία γραμμή χωρίς «βοηθός»', !/βοηθ/i.test(logLine({ kind: 'document', action: 'delete', label: null, fields: null })));
  const s = rotatedSentence({ at: '2026-11-04T10:00:00Z', reason: 'member_left' });
  ok('η ανανέωση λέει την ημερομηνία dd/mm/yyyy', s.includes('04/11/2026'));
  ok('η ανανέωση λέει τον λόγο', s.includes('αποχώρησε μέλος'));
  ok('η ανανέωση χωρίς κόμμα πριν από το «και»', !s.includes([',', 'και'].join(' ')));
}

console.log(`\nfirms: ${fail === 0 ? `✓ ${pass} έλεγχοι` : `✗ ${fail} απέτυχαν από ${pass + fail}`}`);
if (fail) { console.log(fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
