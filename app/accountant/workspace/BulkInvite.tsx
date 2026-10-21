'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΠΡΟΣΚΛΗΣΗ ΠΕΛΑΤΩΝ, ΟΛΩΝ ΜΑΖΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΥΠΗΡΧΕ. Ο πελάτης έστελνε σύνδεσμο και ο λογιστής τον επικολλούσε, ένας
// ένας. Με ογδόντα πελάτες αυτό ήταν ογδόντα τηλέφωνα.
//
// ΤΙ ΚΑΝΕΙ. Ο λογιστής επικολλά τη λίστα του (ή ανεβάζει το CSV που βγάζει το
// λογιστικό του πρόγραμμα). Η βάση στέλνει σε κάθε διεύθυνση ένα μήνυμα και
// απαντά με μία κατάσταση ανά γραμμή: στάλθηκε, διπλή, άκυρη, ήδη πελάτης,
// όριο. Ο πελάτης αποφασίζει ο ίδιος, στη Λογιστική του· ο λογιστής δεν βλέπει
// τίποτα δικό του πριν πει «ναι».
//
// ΜΟΝΟ Ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ ΣΤΕΛΝΕΙ (20261021120000). Μήνυμα από το δικό μας domain
// που ζητά πρόσβαση σε ΑΦΜ και μισθωτήρια είναι ακριβώς ό,τι θέλει όποιος
// ψαρεύει. Η βάση ανοίγει την αποστολή στο πακέτο του επαγγελματία και με
// επιβεβαιωμένη διεύθυνση αποστολέα· εδώ λέγεται ο λόγος όταν αρνηθεί.
//
// ΚΛΕΙΣΤΟ ΑΠΟ ΠΡΟΕΠΙΛΟΓΗ. Η λίστα των πελατών είναι η δουλειά της ημέρας· η
// πρόσκληση γίνεται μία φορά τον χρόνο. Μένει μία γραμμή με ένα κουμπί ώσπου
// να τη χρειαστεί.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { T, Card, Btn, fd } from '@/components/Theme';
import { Textarea } from '@/app/dashboard/components/UIComponents';
import { notifyError } from '@/components/Toast';
import { PLANS } from '@/lib/billing/plans';
import { PROFESSIONAL_MIN_PLAN } from '@/lib/billing/entitlements';
import {
  parseEmailList, uniqueCount, inviteClients, myInvitesSent, withdrawInvite,
  INVITE_STATUS_LABEL, type InviteResult, type SentInvite,
} from '@/lib/data/accountantInvites';

/** Πόσες από τις προηγούμενες προσκλήσεις φαίνονται πριν το «και Ν ακόμη». */
const HISTORY_ROWS = 12;

/** Το μήνυμα της άρνησης, ανά λόγο. Το πακέτο από τη μηχανή, όχι γραμμένο εδώ. */
const REFUSAL = {
  plan: `Η πρόσκληση με email ανοίγει στο πακέτο «${PLANS[PROFESSIONAL_MIN_PLAN].name}» και πάνω.`,
  unverified: 'Επιβεβαίωσε πρώτα τη διεύθυνσή σου: αυτή βλέπει ο πελάτης ως αποστολέα.',
  error: 'Οι προσκλήσεις δεν στάλθηκαν. Δοκίμασε ξανά σε λίγο.',
} as const;

const small: React.CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)', margin: 0, fontFamily: T.font.sans, lineHeight: 1.5 };

export default function BulkInvite({ db, label }: { db: SupabaseClient; label: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const [history, setHistory] = useState<SentInvite[] | null>(null);

  const emails = parseEmailList(text);
  const count = uniqueCount(emails);

  const loadHistory = useCallback(async () => {
    const r = await myInvitesSent(db);
    if (r.failed) { notifyError('Οι προηγούμενες προσκλήσεις δεν διαβάστηκαν'); return; }
    setHistory(r.rows);
  }, [db]);

  const openPanel = () => { setOpen(true); void loadHistory(); };

  const send = async () => {
    if (!emails.length) return;
    setBusy(true);
    const r = await inviteClients(db, emails);
    setBusy(false);
    if (r.failed) { notifyError(REFUSAL[r.refusal ?? 'error']); return; }
    setResults(r.rows);
    // Ό,τι στάλθηκε φεύγει από το πεδίο· ό,τι δεν στάλθηκε μένει, για διόρθωση.
    const keep = r.rows.filter(x => x.status === 'invalid' || x.status === 'rate_limited' || x.status === 'over_limit').map(x => x.email);
    setText(keep.join('\n'));
    void loadHistory();
  };

  const withdraw = async (id: string) => {
    if (await withdrawInvite(db, id)) void loadHistory();
    else notifyError('Η πρόσκληση δεν αποσύρθηκε');
  };

  const readFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setText(t => [t.trim(), String(r.result || '')].filter(Boolean).join('\n'));
    r.readAsText(f);
  };

  const sentCount = results?.filter(x => x.status === 'sent').length ?? 0;
  const waiting = history?.filter(h => h.status === 'sent') ?? [];

  return (
    <Card style={{ marginTop: 10 }} className="po-noprint">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <p style={label}>Πρόσκληση πελατών</p>
          <p style={{ ...small, marginTop: 6 }}>
            {`Στείλε σε όλους μαζί ένα μήνυμα με αποστολέα τη διεύθυνσή σου. Ο καθένας αποφασίζει ο ίδιος· δεν βλέπεις τίποτα δικό του πριν πει «ναι». Για πακέτο «${PLANS[PROFESSIONAL_MIN_PLAN].name}» και πάνω.`}
          </p>
        </div>
        {!open && <Btn variant="secondary" onClick={openPanel}>Πρόσκληση με email</Btn>}
      </div>

      {open && (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <Textarea
            label="Διευθύνσεις email, μία ανά γραμμή"
            value={text}
            onChange={v => { setText(v); setResults(null); }}
            placeholder={'pelatis@example.gr\nΓ. Παπαδόπουλος <gp@example.gr>'}
            rows={4}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: 'var(--accent)', cursor: 'pointer', fontFamily: T.font.sans }}>
              Από αρχείο CSV
              <input type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }}
                onChange={e => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => { setOpen(false); setResults(null); }}>Κλείσιμο</Btn>
              <Btn variant="primary" onClick={() => void send()} disabled={busy || count === 0}>
                {busy ? 'Αποστολή…' : count === 0 ? 'Στείλε' : count === 1 ? 'Στείλε σε 1' : `Στείλε σε ${count}`}
              </Btn>
            </div>
          </div>
          <p style={small}>Έως 50 μηνύματα ανά 24 ώρες. Η ίδια διεύθυνση ξαναπαίρνει μήνυμα μετά από 7 ημέρες· όποιος απάντησε «όχι» δεν ξαναπαίρνει.</p>

          {results && (
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <p style={label}>{sentCount === 1 ? 'Στάλθηκε 1' : `Στάλθηκαν ${sentCount}`} από {results.length}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 0 }}>
                {results.map((r, i) => (
                  <li key={`${r.email}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: T.font.sans, overflowWrap: 'anywhere' }}>{r.email}</span>
                    <span style={{ fontSize: 12, fontFamily: T.font.sans, color: r.status === 'sent' ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontWeight: r.status === 'sent' ? 600 : 400 }}>
                      {INVITE_STATUS_LABEL[r.status]}{r.status === 'already_invited' && r.sentAt ? ` (${fd(r.sentAt)})` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {history && history.length > 0 && (
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <p style={label}>{waiting.length === 1 ? '1 περιμένει απάντηση' : `${waiting.length} περιμένουν απάντηση`} · {history.length} συνολικά</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 0 }}>
                {history.slice(0, HISTORY_ROWS).map(h => (
                  <li key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 0', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: T.font.sans, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                      {h.email}
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        {h.status === 'sent' ? ` · στάλθηκε ${fd(h.sentAt)}` : ` · ${INVITE_STATUS_LABEL[h.status]} ${fd(h.answeredAt ?? h.sentAt)}`}
                      </span>
                    </span>
                    {h.status === 'sent' && <Btn variant="ghost" onClick={() => void withdraw(h.id)}>Πάρ᾽ την πίσω</Btn>}
                  </li>
                ))}
              </ul>
              {history.length > HISTORY_ROWS && (
                <p style={{ ...small, marginTop: 6 }}>{history.length - HISTORY_ROWS === 1 ? 'Και 1 ακόμη.' : `Και ${history.length - HISTORY_ROWS} ακόμη.`}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
