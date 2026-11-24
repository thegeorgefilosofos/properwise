'use client';
// ═══════════════════════════════════════════════════════════════════════════
// «ΣΥΝΔΕΣΗ myDATA»: ΤΑ ΠΑΡΑΣΤΑΤΙΚΑ ΤΩΝ ΠΕΛΑΤΩΝ ΠΟΥ ΤΟ ΕΠΕΤΡΕΨΑΝ, ΧΩΡΙΣ ΛΗΨΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// ΕΝΑ ΣΗΜΕΙΟ ΕΣΤΙΑΣΗΣ ΑΝΑ ΟΨΗ. Πρώτα η ρύθμιση άρθρου 26 με τις δηλώσεις του
// γραφείου (Ε-1). Μετά η γραμμή κατάστασης, τα user id και κλειδί και το
// «Φέρε τώρα». Ο πίνακας των πελατών από κάτω, για όποιον θέλει τη λεπτομέρεια.
//
// ΟΙ ΟΨΕΙΣ (lib/mydata/status.ts, cardPhase): ρύθμιση · κλειδί που απορρίφθηκε
// · άντληση σε εξέλιξη (με πρόοδο «Πελάτης 3 από 12 · 148 παραστατικά») ·
// έτοιμη. Η επιτυχία, το μερικό αποτέλεσμα και η ΑΑΔΕ που δεν απαντά λέγονται
// στη γραμμή κατάστασης και στη γραμμή κάθε πελάτη, με λύση.
//
// Ε2 (απόφαση ιδιοκτήτη 24/11/2026): ΤΟ ΚΛΕΙΔΙ ΔΕΝ ΦΥΛΑΣΣΕΤΑΙ ΠΟΥΘΕΝΑ. Ζει
// μόνο σε `useRef` αυτής της καρτέλας, ώσπου να κλείσει ή να πατηθεί «Ξέχνα το
// κλειδί». Φεύγει στο σώμα κάθε «Φέρε τώρα». Ποτέ σε localStorage,
// sessionStorage, βάση ή log (scripts/guard-mydata-key.mjs). Η άντληση γίνεται
// μόνο όταν την ξεκινά ο λογιστής: κανένα αυτόματο τρέξιμο στο άνοιγμα. Οσο η
// συνάρτηση απαντά `partial`, η κάρτα ξαναπατά με το ίδιο κλειδί.
//
// ΔΕΥΤΕΡΟ ΒΗΜΑ ΓΙΑ ΚΑΘΕ ΕΝΕΡΓΕΙΑ (θωράκιση 24/11/2026, Σ1 νομικού ελέγχου). Η
// βάση αρνείται αποδοχή, προβολή πελατών και άντληση χωρίς `aal2` ακόμη και
// στον λογιστή που δουλεύει μόνος του.
//
// ΖΩΝΤΑΝΑ. Συνδρομή Realtime στη σύνδεση και στις άδειες (ίδια RLS): η γραμμή
// και ο πίνακας αλλάζουν όσο τρέχει η άντληση, χωρίς ανανέωση.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { T, TT, Card, Btn, SecHdr } from '@/components/Theme';
import { TextInput, CustomSelect } from '@/app/dashboard/components/UIComponents';
import { notify, notifyError } from '@/components/Toast';
import { downloadCsv } from '@/lib/core/download';
import * as mydata from '@/lib/data/mydata';
import {
  cardPhase, syncedLine, progressLine, rowState, sortRows, filterRows, attention, manualWaitMinutes, keyShape, groupRows,
  runReason, athensStamp, aadeDownLine, newCount, accessLogCsv, type ClientRow, type Connection, type SortKey,
} from '@/lib/mydata/status';
import { MYDATA_JOINT_DECLARATIONS, MYDATA_JOINT_HREF, MYDATA_REQUEST_FORWARD_WORKDAYS } from '@/lib/legal/mydataJoint';
import { IDENTITY } from '@/lib/legal/identity';

/** Από πόσους πελάτες και πάνω εμφανίζονται αναζήτηση και ταξινόμηση. */
const TOOLS_FROM = 8;

/** Πόσες φορές ξαναπατά μόνη της η κάρτα όσο η άντληση απαντά `partial`. */
const MAX_ROUNDS = 12;

/** Απαντήσεις που σημαίνουν ότι το κλειδί της μνήμης δεν κάνει: ξεχνιέται. */
const DROP_KEY = new Set(['auth', 'key_rejected', 'bad_key_shape', 'bad_user', 'no_key']);

const KEY_HINT: Record<ReturnType<typeof keyShape>, string> = {
  empty: 'Το βρίσκεις στην εγγραφή σου στο myDATA REST API της ΑΑΔΕ.',
  short: 'Το κλειδί έχει 16 έως 200 χαρακτήρες.',
  chars: 'Μόνο λατινικά γράμματα και ψηφία, χωρίς κενά.',
  ok: 'Η μορφή είναι σωστή. Ο έλεγχος στην ΑΑΔΕ γίνεται με το «Φέρε τώρα».',
};

const TONE_COLOR: Record<string, string> = {
  ok: 'var(--text-secondary)', wait: 'var(--text-secondary)', warn: 'var(--warning-on-container)', off: 'var(--text-tertiary)',
};

const LINK = { display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'var(--accent)', textDecorationLine: 'underline', textUnderlineOffset: 2, fontWeight: 600 } as const;

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
  const [busy, setBusy] = useState<'accept' | 'sync' | 'log' | null>(null);
  const [say, setSay] = useState('');
  const [find, setFind] = useState('');
  const [sort, setSort] = useState<SortKey>('status');
  const [now, setNow] = useState(() => new Date());
  const [agreed, setAgreed] = useState(false);
  // «Επιβεβαίωση ΑΦΜ»: ο λογιστής το γράφει ο ίδιος, χωρίς προσυμπλήρωση. Η άδεια
  // του πελάτη δίνεται μόνο αν συμφωνεί με το προφίλ του.
  const [afmFor, setAfmFor] = useState<string | null>(null);
  const [afmVal, setAfmVal] = useState('');
  const [afmSay, setAfmSay] = useState('');
  // Ε2: ΤΟ ΚΛΕΙΔΙ ΜΟΝΟ ΣΤΗ ΜΝΗΜΗ ΤΗΣ ΚΑΡΤΕΛΑΣ. Το `held` λέει στην οθόνη ότι
  // υπάρχει, χωρίς να το ξέρει.
  const creds = useRef<mydata.Creds | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const hintId = useId();
  const agreeId = useId();

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
    // Το κλειδί δεν επιζεί της κάρτας.
    const held = creds;
    return () => { alive = false; held.current = null; clearInterval(tick); void db.removeChannel(ch); };
  }, [db, userId, load]);

  const phase = cardPhase(conn, now);

  const forget = useCallback(() => { creds.current = null; setHeld(null); }, []);

  // «ΦΕΡΕ ΤΩΡΑ». Πρώτα παίρνει το κλειδί από τη φόρμα (μία φορά ανά καρτέλα),
  // μετά ξαναπατά όσο η άντληση απαντά `partial`, με το ίδιο κλειδί.
  const fetchNow = async () => {
    if (busy) return;
    if (!creds.current) {
      if (keyShape(key) !== 'ok' || !aadeUser.trim()) return;
      creds.current = { aadeUserId: aadeUser.trim(), key: key.trim() };
      setHeld(aadeUser.trim());
      setKey('');
    }
    setBusy('sync'); setSay('');
    let msg = '';
    for (let round = 0; round < MAX_ROUNDS && creds.current; round++) {
      const r = await mydata.sync(db, creds.current);
      if (!r.ok) {
        if (r.reason && DROP_KEY.has(r.reason)) forget();
        msg = runReason(r.reason);
        break;
      }
      if (!r.partial) { msg = ''; break; }
      msg = 'Η άντληση έχει κι άλλο. Πάτα ξανά «Φέρε τώρα» για να συνεχίσει.';
      setSay('Η άντληση συνεχίζει…');
      await load();
    }
    setBusy(null);
    setSay(msg);
    await load();
  };

  const accept = async () => {
    if (busy || !agreed) return;
    setBusy('accept');
    const r = await mydata.acceptJoint(db);
    setBusy(null);
    if (!r.ok) { setSay(runReason(r.reason)); return; }
    setAgreed(false); setSay('');
    notify('Η ρύθμιση έγινε δεκτή');
    await load();
  };

  // Ε-9: το αρχείο πρόσβασης για τους πελάτες του, ως CSV.
  const exportLog = async () => {
    if (busy) return;
    setBusy('log');
    const r = await mydata.accountantAccessLog(db, userId);
    setBusy(null);
    if (r.error) { notifyError('Το αρχείο πρόσβασης δεν κατέβηκε'); return; }
    downloadCsv(accessLogCsv(r.rows), 'mydata-arxeio-prosvasis.csv');
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

  const wait = conn?.last_partial ? 0 : manualWaitMinutes(conn?.last_manual_at ?? null, now);
  const consented = rows.filter(r => r.consent).length;
  const shown = useMemo(() => sortRows(filterRows(rows, find), sort), [rows, find, sort]);
  const issues = attention(rows);
  const groups = useMemo(() => groupRows(shown), [shown]);
  // Η ΑΑΔΕ εκτός για όλους: λέγεται μία φορά, στη γραμμή κατάστασης, όχι σε κάθε γραμμή.
  const allDown = aadeDownLine(rows) !== null;

  // ── Η ΓΡΑΜΜΗ ΚΑΤΑΣΤΑΣΗΣ: ΜΙΑ, ΠΑΝΤΑ ΣΤΗΝ ΙΔΙΑ ΘΕΣΗ ─────────────────────
  const status = phase === 'terms'
    ? (conn?.joint_version ? 'Η ρύθμιση για τη Σύνδεση myDATA άλλαξε. Η άντληση σταματά ώσπου να την αποδεχτείς ξανά.'
      : 'Πριν από την πρώτη άντληση, αποδέξου τη ρύθμιση από κοινού υπευθύνων με το PROPERWISE.')
    : phase === 'syncing' && conn?.lease_at
      ? progressLine(conn.lease_at, rows)
    : phase === 'rejected' ? 'Η ΑΑΔΕ δεν δέχτηκε το κλειδί στην τελευταία άντληση. Δώσε user id και κλειδί ξανά.'
    : aadeDownLine(rows) ?? `${syncedLine(conn?.last_sync_at ?? null, conn?.last_sync_new ?? 0)}${issues ? ` · ${issues === 1 ? '1 πελάτης θέλει' : `${issues}\u00a0πελάτες θέλουν`} προσοχή` : ''}`;

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
        Το κλειδί σου ανοίγει στην ΑΑΔΕ όλους τους πελάτες σου. Γι’ αυτό η αποδοχή της ρύθμισης, η λίστα πελατών και η άντληση γίνονται μόνο μετά το δεύτερο βήμα, ακόμη κι αν δουλεύεις χωρίς γραφείο.
      </p>
      {onSecondStep && (
        <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={onSecondStep}>Δεύτερο βήμα</Btn>
        </div>
      )}
    </Card>
  );

  // ── Ε-1: Η ΡΥΘΜΙΣΗ ΑΡΘΡΟΥ 26, ΠΡΙΝ ΑΠΟ ΤΗΝ ΠΡΩΤΗ ΑΝΤΛΗΣΗ ──────────────────
  if (phase === 'terms') return (
    <Card style={{ marginBottom: T.sp.lg }}>
      <SecHdr label="Σύνδεση myDATA" />
      <p role="status" aria-live="polite" style={{ ...TT.body, margin: `0 0 ${T.sp.sm}px`, color: 'var(--text-primary)' }}>{status}</p>
      <p style={{ ...TT.bodySm, margin: `0 0 ${T.sp.sm}px`, color: 'var(--text-secondary)' }}>
        Για την άντληση από την ΑΑΔΕ είμαστε από κοινού υπεύθυνοι επεξεργασίας (άρθρο 26 ΓΚΠΔ). Το κλειδί σου δεν το φυλάμε: το δίνεις όταν ξεκινάς άντληση. Δηλώνεις ότι:
      </p>
      <ul style={{ ...TT.bodySm, margin: `0 0 ${T.sp.sm}px`, paddingLeft: 20, display: 'grid', gap: 6, color: 'var(--text-secondary)' }}>
        {MYDATA_JOINT_DECLARATIONS.map(t => <li key={t}>{t}</li>)}
      </ul>
      <p style={{ ...TT.bodySm, margin: `0 0 ${T.sp.sm}px` }}>
        <a href={MYDATA_JOINT_HREF} target="_blank" rel="noreferrer" style={LINK}>Ολόκληρη η ρύθμιση στους Όρους</a>
      </p>
      <label htmlFor={agreeId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', minHeight: 44 }}>
        <input id={agreeId} type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ ...TT.bodySm, color: 'var(--text-primary)' }}>Αποδέχομαι τη ρύθμιση και τις δηλώσεις</span>
      </label>
      <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: T.sp.md }}>
        <Btn variant="primary" onClick={() => void accept()} disabled={busy !== null || !agreed}>{busy === 'accept' ? 'Αποδοχή…' : 'Αποδοχή'}</Btn>
      </div>
      {say && <p aria-live="polite" style={{ ...TT.bodySm, margin: `${T.sp.sm}px 0 0`, color: 'var(--text-secondary)' }}>{say}</p>}
    </Card>
  );

  const form = !held;
  const shape = keyShape(key);
  const fetchLabel = phase === 'syncing' || busy === 'sync' ? 'Άντληση…' : 'Φέρε τώρα';

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
            <TextInput label="User id ΑΑΔΕ" value={aadeUser} onChange={v => { setAadeUser(v); setSay(''); }} />
            <div>
              <TextInput label="Subscription key" type="password" value={key} mono
                onChange={v => { setKey(v); setSay(''); }}
                onKeyDown={e => { if (e.key === 'Enter') void fetchNow(); }} />
              <p id={hintId} aria-live="polite" style={{ ...TT.bodySm, margin: '6px 0 0', color: shape === 'ok' ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                {KEY_HINT[shape]}
              </p>
            </div>
          </div>
          <p style={{ ...TT.bodySm, margin: `${T.sp.sm}px 0 0`, color: 'var(--text-tertiary)' }}>
            Το κλειδί δεν αποθηκεύεται. Μένει μόνο σε αυτή την καρτέλα, ώσπου να την κλείσεις.
          </p>
        </>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: T.sp.sm, marginTop: form ? T.sp.md : 0 }}>
        {held && (
          <p style={{ ...TT.bodySm, margin: 0, color: 'var(--text-tertiary)' }}>
            <span translate="no">{held}</span> · κλειδί <span aria-label="κρυμμένο">••••••••</span> μόνο σε αυτή την καρτέλα
          </p>
        )}
        <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={() => void fetchNow()} describedBy={form ? hintId : undefined}
            disabled={busy !== null || phase === 'syncing' || wait > 0 || (form && (shape !== 'ok' || !aadeUser.trim()))}
            title={wait > 0 ? 'Μία άντληση ανά 5\u00a0λεπτά' : undefined}>
            {wait > 0 && fetchLabel === 'Φέρε τώρα' ? `Ξανά σε ${wait}′` : fetchLabel}
          </Btn>
          {held && <Btn variant="ghost" onClick={forget} disabled={busy === 'sync'}>Ξέχνα το κλειδί</Btn>}
        </div>
      </div>

      {say && <p aria-live="polite" style={{ ...TT.bodySm, margin: `${T.sp.sm}px 0 0`, color: 'var(--text-secondary)' }}>{say}</p>}

      {/* Ε-5, Ε-9: ό,τι χρειάζεται το γραφείο ως από κοινού υπεύθυνος. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: T.sp.sm, marginTop: T.sp.md }}>
        <Btn variant="ghost" onClick={() => void exportLog()} disabled={busy !== null}>{busy === 'log' ? 'Ετοιμάζεται…' : 'Αρχείο πρόσβασης (CSV)'}</Btn>
        <p style={{ ...TT.bodySm, margin: 0, color: 'var(--text-tertiary)' }}>
          Αίτημα πελάτη για τα δεδομένα της άντλησης; Στείλ’ το μας μέσα σε {MYDATA_REQUEST_FORWARD_WORKDAYS}{'\u00a0'}εργάσιμες: <a href={`mailto:${IDENTITY.privacyEmail}?subject=${encodeURIComponent('Αίτημα πελάτη για τα δεδομένα myDATA')}`} style={LINK}>{IDENTITY.privacyEmail}</a>
        </p>
      </div>

      {rows.length > 0 && (
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
