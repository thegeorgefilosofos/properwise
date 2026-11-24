'use client';
// ═══════════════════════════════════════════════════════════════════════════
// «ΣΥΝΔΕΣΗ myDATA»: ΤΑ ΠΑΡΑΣΤΑΤΙΚΑ ΤΩΝ ΠΕΛΑΤΩΝ ΠΟΥ ΤΟ ΕΠΕΤΡΕΨΑΝ, ΧΩΡΙΣ ΛΗΨΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// ΕΝΑ ΣΗΜΕΙΟ ΕΣΤΙΑΣΗΣ ΑΝΑ ΟΨΗ. Χωρίς σύνδεση: μία πρόταση και η φόρμα. Με
// σύνδεση: η γραμμή κατάστασης και το «Συγχρονισμός τώρα». Ο πίνακας των
// πελατών από κάτω, για όποιον θέλει τη λεπτομέρεια.
//
// ΟΙ ΟΨΕΙΣ (lib/mydata/status.ts, cardPhase): χωρίς σύνδεση · κλειδί που
// απορρίφθηκε · συγχρονισμός σε εξέλιξη (με πρόοδο «Πελάτης 3 από 12 · 148
// παραστατικά») · έτοιμη. Η επιτυχία, το μερικό αποτέλεσμα και η ΑΑΔΕ που δεν
// απαντά λέγονται στη γραμμή κατάστασης και στη γραμμή κάθε πελάτη, με λύση.
//
// ΤΟ ΚΛΕΙΔΙ. Φεύγει μία φορά προς τη συνάρτηση άκρου και δεν ξαναγυρίζει: μετά
// τη σύνδεση η οθόνη δείχνει μόνο τελείες, γιατί δεν το ξέρει. Η μορφή του
// ελέγχεται αμέσως, όσο γράφεται, πριν φύγει οτιδήποτε.
//
// ΔΕΥΤΕΡΟ ΒΗΜΑ ΓΙΑ ΚΑΘΕ ΕΝΕΡΓΕΙΑ (θωράκιση 24/11/2026, Σ1 νομικού ελέγχου). Η
// βάση αρνείται αποθήκευση κλειδιού, προβολή πελατών και συγχρονισμό χωρίς
// `aal2`, και στον λογιστή που δουλεύει μόνος του. Η κάρτα το λέει με μία
// πρόταση και ανοίγει το ίδιο «Δεύτερο βήμα» με τον χώρο του γραφείου.
//
// ΖΩΝΤΑΝΑ. Συνδρομή Realtime στη σύνδεση και στις άδειες (ίδια RLS): η γραμμή
// και ο πίνακας αλλάζουν όσο τρέχει ο συγχρονισμός, χωρίς ανανέωση. Ανοίγοντας
// τον χώρο, αν ο τελευταίος συγχρονισμός είναι 12 ώρες πίσω, ξεκινά μόνος του.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { T, TT, Card, Btn, SecHdr } from '@/components/Theme';
import { TextInput, CustomSelect } from '@/app/dashboard/components/UIComponents';
import { confirmDialog } from '@/components/confirmBus';
import { notify, notifyError } from '@/components/Toast';
import * as mydata from '@/lib/data/mydata';
import {
  cardPhase, syncedLine, progressLine, rowState, sortRows, filterRows, attention, manualWaitMinutes, keyShape, groupRows,
  runReason, connectReason, athensStamp, aadeDownLine, newCount, type ClientRow, type Connection, type SortKey,
} from '@/lib/mydata/status';
import { shouldAutoSync } from '@/lib/mydata/autoSync';

/** Από πόσους πελάτες και πάνω εμφανίζονται αναζήτηση και ταξινόμηση. */
const TOOLS_FROM = 8;

const KEY_HINT: Record<ReturnType<typeof keyShape>, string> = {
  empty: 'Το βρίσκεις στην εγγραφή σου στο myDATA REST API της ΑΑΔΕ.',
  short: 'Το κλειδί έχει 16 έως 200 χαρακτήρες.',
  chars: 'Μόνο λατινικά γράμματα και ψηφία, χωρίς κενά.',
  ok: 'Η μορφή είναι σωστή. Ο έλεγχος στην ΑΑΔΕ γίνεται με τη «Σύνδεση».',
};

const TONE_COLOR: Record<string, string> = {
  ok: 'var(--text-secondary)', wait: 'var(--text-secondary)', warn: 'var(--warning-on-container)', off: 'var(--text-tertiary)',
};

/** Ήσυχος δείκτης δίπλα στη γραμμή κατάστασης· ίδιο ύψος με το κείμενο, χωρίς μετατόπιση. */
function Busy() {
  return (
    <span aria-hidden="true" style={{
      display: 'inline-block', width: 12, height: 12, marginRight: 8, verticalAlign: '-1px', borderRadius: T.radius.pill,
      border: '2px solid var(--border-subtle)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite',
    }} />
  );
}

export default function MydataCard({ db, userId, onSecondStep }: { db: SupabaseClient; userId: string; onSecondStep?: () => void }) {
  const [conn, setConn] = useState<Connection | null>(null);
  const [needStep, setNeedStep] = useState(false);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [aadeUser, setAadeUser] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'connect' | 'sync' | 'remove' | null>(null);
  const [say, setSay] = useState('');
  const [find, setFind] = useState('');
  const [sort, setSort] = useState<SortKey>('status');
  const [now, setNow] = useState(() => new Date());
  // «Επιβεβαίωση ΑΦΜ»: ο λογιστής το γράφει ο ίδιος, χωρίς προσυμπλήρωση. Η άδεια
  // του πελάτη δίνεται μόνο αν συμφωνεί με το προφίλ του.
  const [afmFor, setAfmFor] = useState<string | null>(null);
  const [afmVal, setAfmVal] = useState('');
  const [afmSay, setAfmSay] = useState('');
  const autoTried = useRef(false);
  const hintId = useId();

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([mydata.connection(db, userId), mydata.clientsStatus(db)]);
    setNeedStep(r.secondStep);
    if (!c.error) setConn(c.data);
    if (!r.error) setRows(r.rows);
    setLoaded(true);
  }, [db, userId]);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => { if (alive) void load(); });
    // ΖΩΝΤΑΝΑ: κάθε αλλαγή στη σύνδεση ή σε άδεια του λογιστή ξαναδιαβάζει.
    const ch = db.channel(`mydata_${userId}_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mydata_connections', filter: `accountant_id=eq.${userId}` }, () => { if (alive) void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mydata_consents', filter: `accountant_id=eq.${userId}` }, () => { if (alive) void load(); })
      .subscribe();
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => { alive = false; clearInterval(tick); void db.removeChannel(ch); };
  }, [db, userId, load]);

  const phase = cardPhase(conn, now);

  const runSync = useCallback(async (kind: 'manual' | 'auto') => {
    setBusy('sync');
    if (kind === 'manual') setSay('');
    const r = await mydata.sync(db, kind);
    setBusy(null);
    await load();
    if (kind === 'auto' && (r.ok || r.reason === 'fresh' || r.reason === 'busy')) return;
    if (!r.ok) setSay(runReason(r.reason));
    else if (r.partial) setSay('Ο συγχρονισμός συνεχίζει μόνος του σε λίγα λεπτά.');
  }, [db, load]);

  // Ο ΚΑΝΟΝΑΣ ΤΩΝ 12 ΩΡΩΝ, ΜΙΑ ΦΟΡΑ ΑΝΑ ΑΝΟΙΓΜΑ. Η βάση τον ξαναελέγχει: δύο
  // καρτέλες ανοιχτές δεν φέρνουν δύο συγχρονισμούς.
  useEffect(() => {
    if (autoTried.current || needStep || phase !== 'ready' || !conn) return;
    autoTried.current = true;
    if (shouldAutoSync(conn.last_sync_at)) Promise.resolve().then(() => runSync('auto'));
  }, [phase, conn, runSync, needStep]);

  const shape = keyShape(key);
  const connect = async () => {
    if (busy || shape !== 'ok' || !aadeUser.trim()) return;
    setBusy('connect'); setSay('Έλεγχος στην ΑΑΔΕ…');
    const r = await mydata.connect(db, aadeUser, key);
    setBusy(null);
    if (!r.ok) { setSay(connectReason(r.reason)); return; }
    setKey('');
    setSay(r.verified ? '' : 'Η ΑΑΔΕ δεν απάντησε τώρα· το κλειδί φυλάχτηκε και ελέγχεται στον πρώτο συγχρονισμό.');
    notify('Η σύνδεση myDATA έγινε');
    await load();
    void runSync('manual');
  };

  const remove = async () => {
    if (!await confirmDialog({
      title: 'Αφαίρεση κλειδιού;',
      message: 'Σβήνει από το PROPERWISE και οι συγχρονισμοί σταματούν. Ό,τι έχει ήδη έρθει μένει στους πελάτες.',
      confirmLabel: 'Αφαίρεση', tone: 'negative',
    })) return;
    setBusy('remove');
    const r = await mydata.removeKey(db);
    setBusy(null);
    if (!r.ok) { notifyError('Το κλειδί δεν αφαιρέθηκε'); return; }
    setSay('');
    await load();
  };

  const saveAfm = async (ownerId: string, name: string) => {
    if (busy) return;
    const r = await mydata.confirmAfm(db, ownerId, afmVal);
    if (!r.ok) {
      setAfmSay(r.reason === 'bad_afm' ? 'Το ΑΦΜ δεν είναι σωστό. Έλεγξε τα 9 ψηφία.'
        : r.reason === 'afm_taken' ? 'Αυτό το ΑΦΜ το έχεις ήδη επιβεβαιώσει για άλλον πελάτη. Έλεγξέ το στο myAADE σου.'
        : 'Δεν αποθηκεύτηκε. Ξαναδοκίμασε.');
      return;
    }
    setAfmFor(null); setAfmVal(''); setAfmSay('');
    setSay(`Το ΑΦΜ του πελάτη ${name} επιβεβαιώθηκε. Μπορεί τώρα να πατήσει «Επιτρέπω».`);
    await load();
  };

  const wait = manualWaitMinutes(conn?.last_manual_at ?? null, now);
  const consented = rows.filter(r => r.consent).length;
  const shown = useMemo(() => sortRows(filterRows(rows, find), sort), [rows, find, sort]);
  const issues = attention(rows);
  const groups = useMemo(() => groupRows(shown), [shown]);
  // Η ΑΑΔΕ εκτός για όλους: η ώρα λέγεται μία φορά, στη γραμμή κατάστασης, όχι σε κάθε γραμμή.
  const allDown = aadeDownLine(rows) !== null;

  // ── Η ΓΡΑΜΜΗ ΚΑΤΑΣΤΑΣΗΣ: ΜΙΑ, ΠΑΝΤΑ ΣΤΗΝ ΙΔΙΑ ΘΕΣΗ ─────────────────────
  const status = phase === 'syncing' && conn?.lease_at
    ? progressLine(conn.lease_at, rows)
    : phase === 'ready' && conn && aadeDownLine(rows)
      ? aadeDownLine(rows)!
    : phase === 'ready' && conn
      ? `${syncedLine(conn.last_sync_at, conn.last_sync_new)}${issues ? ` · ${issues === 1 ? '1 πελάτης θέλει' : `${issues}\u00a0πελάτες θέλουν`} προσοχή` : ''}`
      : phase === 'rejected' ? 'Η ΑΑΔΕ δεν δέχεται το κλειδί. Βάλε νέο για να συνεχίσουν οι συγχρονισμοί.'
      : 'Φέρνει από το myDATA όσα παραστατικά έχουν διαβιβαστεί για τους πελάτες που πατούν «Επιτρέπω», χωρίς λήψεις και ανεβάσματα.';

  // Το «Επιβεβαίωση ΑΦΜ» της γραμμής: ίδιο στον πίνακα και στις ομάδες του τηλεφώνου.
  const afmControl = (r: ClientRow) => (
    <>
      {!r.consent && afmFor !== r.ownerId && (
        <Btn variant="ghost" onClick={() => { setAfmFor(r.ownerId); setAfmVal(''); setAfmSay(''); }}>
          {r.afmConfirmed ? 'Αλλαγή ΑΦΜ' : 'Επιβεβαίωση ΑΦΜ'}
        </Btn>
      )}
      {!r.consent && afmFor === r.ownerId && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 8, marginTop: 6 }}>
          <div style={{ maxWidth: 240 }}>
            <TextInput label="ΑΦΜ από το myAADE σου" value={afmVal} inputMode="numeric" mono
              onChange={v => { setAfmVal(v); setAfmSay(''); }}
              onKeyDown={e => { if (e.key === 'Enter') void saveAfm(r.ownerId, r.name); if (e.key === 'Escape') setAfmFor(null); }} />
          </div>
          <p style={{ ...TT.bodySm, margin: 0, flexBasis: '100%', color: 'var(--text-tertiary)' }}>
            Γράψε το από τις εξουσιοδοτήσεις σου στο myAADE, όχι από το προφίλ του πελάτη.
          </p>
          <Btn variant="primary" onClick={() => void saveAfm(r.ownerId, r.name)} disabled={!afmVal.trim()}>Αποθήκευση</Btn>
          <Btn variant="ghost" onClick={() => setAfmFor(null)}>Άκυρο</Btn>
          {afmSay && <p role="alert" style={{ ...TT.bodySm, margin: 0, flexBasis: '100%', color: 'var(--warning-on-container)' }}>{afmSay}</p>}
        </div>
      )}
    </>
  );

  if (!loaded) return null;

  if (needStep) return (
    <Card style={{ marginBottom: T.sp.lg }}>
      <SecHdr label="Σύνδεση myDATA" />
      <p role="status" style={{ ...TT.body, margin: `0 0 ${T.sp.sm}px`, color: 'var(--text-primary)' }}>
        Η σύνδεση myDATA θέλει δεύτερο βήμα ταυτοποίησης.
      </p>
      <p style={{ ...TT.bodySm, margin: `0 0 ${T.sp.md}px`, color: 'var(--text-secondary)' }}>
        Το κλειδί σου ανοίγει στην ΑΑΔΕ όλους τους πελάτες σου. Γι' αυτό η αποθήκευση κλειδιού, η λίστα πελατών και ο συγχρονισμός γίνονται μόνο μετά το δεύτερο βήμα, ακόμη κι αν δουλεύεις χωρίς γραφείο.
      </p>
      {onSecondStep && (
        <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={onSecondStep}>Δεύτερο βήμα</Btn>
        </div>
      )}
    </Card>
  );

  const form = phase === 'none' || phase === 'rejected';

  return (
    <Card style={{ marginBottom: T.sp.lg }}>
      <SecHdr label="Σύνδεση myDATA" />
      <p role="status" aria-live="polite" style={{ ...TT.body, margin: `0 0 ${T.sp.md}px`, minHeight: '1.5em', color: phase === 'rejected' ? 'var(--warning-on-container)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {(phase === 'syncing' || busy === 'sync') && <Busy />}
        {status}
      </p>

      {form && (
        <>
          <div className="form-row form-row-2" style={{ gap: T.sp.sm, alignItems: 'start' }}>
            <TextInput label="User id ΑΑΔΕ" value={aadeUser} onChange={v => { setAadeUser(v); setSay(''); }}
              placeholder={conn?.aade_user_id ?? ''} />
            <div>
              <TextInput label="Subscription key" type="password" value={key} mono
                onChange={v => { setKey(v); setSay(''); }}
                onKeyDown={e => { if (e.key === 'Enter') void connect(); }} />
              <p id={hintId} aria-live="polite" style={{ ...TT.bodySm, margin: '6px 0 0', color: shape === 'ok' ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                {KEY_HINT[shape]}
              </p>
            </div>
          </div>
          <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: T.sp.md }}>
            <Btn variant="primary" onClick={() => void connect()} disabled={busy === 'connect' || shape !== 'ok' || !aadeUser.trim()} describedBy={hintId}>
              {busy === 'connect' ? 'Έλεγχος…' : 'Σύνδεση'}
            </Btn>
          </div>
        </>
      )}

      {!form && conn && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: T.sp.sm }}>
          <p style={{ ...TT.bodySm, margin: 0, color: 'var(--text-tertiary)' }}>
            <span translate="no">{conn.aade_user_id}</span> · κλειδί <span aria-label="κρυμμένο">••••••••</span>
          </p>
          <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="primary" onClick={() => void runSync('manual')} disabled={busy !== null || phase === 'syncing' || wait > 0}
              title={wait > 0 ? 'Ένας συγχρονισμός ανά 5\u00a0λεπτά' : undefined}>
              {phase === 'syncing' || busy === 'sync' ? 'Συγχρονισμός…' : wait > 0 ? `Ξανά σε ${wait}′` : 'Συγχρονισμός τώρα'}
            </Btn>
            <Btn variant="ghost" onClick={() => void remove()} disabled={busy !== null}>Αφαίρεση κλειδιού</Btn>
          </div>
        </div>
      )}

      {say && <p aria-live="polite" style={{ ...TT.bodySm, margin: `${T.sp.sm}px 0 0`, color: 'var(--text-secondary)' }}>{say}</p>}

      {!form && rows.length > 0 && (
        <section aria-label="Πελάτες myDATA" style={{ marginTop: T.sp.lg }}>
          {rows.length >= TOOLS_FROM && (
            <div className="form-row form-row-2" style={{ gap: T.sp.sm, marginBottom: T.sp.sm }}>
              <TextInput ariaLabel="Αναζήτηση πελάτη" value={find} onChange={setFind} placeholder="Αναζήτηση πελάτη" />
              <CustomSelect ariaLabel="Ταξινόμηση" value={sort} onChange={v => setSort(v as SortKey)}
                options={[{ value: 'status', label: 'Πρώτα όσοι θέλουν κάτι' }, { value: 'name', label: 'Αλφαβητικά' }, { value: 'last', label: 'Πιο πρόσφατος συγχρονισμός' }]} />
            </div>
          )}
          <style>{`
            .md-box { max-height: 520px; overflow-y: auto; }
            .md-table { width: 100%; }
            .md-table td.md-num, .md-table th.md-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
            .md-table .md-when, .md-table .md-nw { white-space: nowrap; font-variant-numeric: tabular-nums; }
            .md-table .md-when-inline { display: none; }
            .md-table .md-new-inline { display: none; }
            @media (max-width: 560px) { .md-table .md-when-col { display: none; } .md-table .md-when-inline { display: block; } }
            @media (max-width: 400px) { .md-table .md-new-col { display: none; } .md-table .md-new-inline { display: inline; } }
            .md-groups { display: none; }
            .md-group + .md-group { margin-top: ${T.sp.md}px; padding-top: ${T.sp.md}px; border-top: 1px solid var(--border-subtle); }
            .md-group .md-nw { white-space: nowrap; }
            .md-group ul { list-style: none; margin: ${T.sp.sm}px 0 0; padding: 0; display: grid; gap: 10px; }
            @media (max-width: 560px) { .md-wide { display: none; } .md-groups { display: block; } }
          `}</style>
          {/* ΣΤΟ ΤΗΛΕΦΩΝΟ: ομάδες ανά κατάσταση, η εξήγηση μία φορά (Α2). */}
          <div className="md-box md-groups" tabIndex={0} aria-label={`${consented} από ${rows.length} πελάτες με άδεια, ανά κατάσταση`}>
            {groups.map(g => (
              <section key={g.key} className="md-group" aria-label={`${g.label} · ${g.rows.length}`}>
                <h3 style={{ ...TT.body, margin: 0, fontWeight: 600, color: g.tone === 'warn' ? 'var(--warning-on-container)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {g.label} · {g.rows.length.toLocaleString('el-GR')}
                </h3>
                {g.fix && !(allDown && g.tone === 'wait') && <p style={{ ...TT.bodySm, margin: '4px 0 0', color: 'var(--text-secondary)' }}>{g.fix}</p>}
                <ul>
                  {g.rows.map(r => (
                    <li key={r.ownerId}>
                      <span style={{ ...TT.body, display: 'block', fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                      {r.lastSyncAt && (
                        <span style={{ ...TT.bodySm, display: 'block', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                          <span className="md-nw">{athensStamp(r.lastSyncAt)}</span>{r.consent ? <> · <span className="md-nw">{newCount(r.lastNew)}</span></> : null}
                        </span>
                      )}
                      {afmControl(r)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {shown.length === 0 && <p style={{ ...TT.bodySm, margin: 0, color: 'var(--text-tertiary)' }}>Κανένας πελάτης με αυτό το όνομα.</p>}
          </div>
          <div className="md-box md-wide po-table-box" tabIndex={0} aria-label={`${consented} από ${rows.length} πελάτες με άδεια`}>
            <table className="po-table tbl-sticky md-table">
              <thead>
                <tr>
                  <th scope="col">Πελάτης</th>
                  <th scope="col">Κατάσταση</th>
                  <th scope="col" className="md-when-col">Τελευταίος</th>
                  <th scope="col" className="md-num md-new-col">Νέα</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const st = rowState(r);
                  return (
                    <tr key={r.ownerId}>
                      <th scope="row" style={{ fontWeight: 600 }}>
                        {r.name}
                        {r.lastSyncAt && (
                          <span className="md-when-inline" style={{ ...TT.bodySm, fontWeight: 400, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                            <span className="md-nw">{athensStamp(r.lastSyncAt).slice(0, 10)}</span> <span className="md-nw">{athensStamp(r.lastSyncAt).slice(11)}</span>
                            <span className="md-new-inline"> · <span className="md-nw">{newCount(r.lastNew)}</span></span>
                          </span>
                        )}
                      </th>
                      <td>
                        <span style={{ color: TONE_COLOR[st.tone], fontWeight: st.tone === 'warn' ? 600 : 400 }}>{st.label}</span>
                        {st.fix && !(allDown && st.tone === 'wait') && <span style={{ ...TT.bodySm, display: 'block', color: 'var(--text-tertiary)' }}>{st.fix}</span>}
                        {afmControl(r)}
                      </td>
                      <td className="md-when-col md-when">{r.lastSyncAt ? athensStamp(r.lastSyncAt) : ''}</td>
                      <td className="md-num md-new-col">{r.consent && r.lastSyncAt ? r.lastNew.toLocaleString('el-GR') : ''}</td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr><td colSpan={4} style={{ color: 'var(--text-tertiary)' }}>Κανένας πελάτης με αυτό το όνομα.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Card>
  );
}
