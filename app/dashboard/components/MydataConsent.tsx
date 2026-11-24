'use client';
// ═══════════════════════════════════════════════════════════════════════════
// «Ο ΛΟΓΙΣΤΗΣ ΣΟΥ ΦΕΡΝΕΙ ΑΠΟ ΤΟ myDATA ΤΑ ΠΑΡΑΣΤΑΤΙΚΑ ΕΞΟΔΩΝ ΣΟΥ»
// ─────────────────────────────────────────────────────────────────────────
// Στα «Δεδομένα και απόρρητο», κάτω από την πρόσβαση λογιστή: ίδια ερώτηση,
// «ποιος βλέπει τι και πώς το κόβω». Εμφανίζεται ΜΟΝΟ σε όποιον έχει συνδέσει
// λογιστή μέσα στο PROPERWISE· χωρίς λογιστή δεν έχει τι να επιτρέψει.
//
// ΣΥΝΑΙΝΕΣΗ ΚΑΤΑ ΓΚΠΔ 7 ΚΑΙ 9§2(α). Ξεκινά κλειστό. Πριν από το «Επιτρέπω»
// φαίνεται ολόκληρο το κείμενο (lib/mydata/consentText.ts) και ένα ρητό τικ για
// πιθανά δεδομένα υγείας· χωρίς τικ δεν δίνεται άδεια. Η βάση κρατά έκδοση και
// αποτύπωμα του κειμένου (απόδειξη, 7§1). Η «Ανάκληση» είναι ένα πάτημα, όσο
// εύκολη όσο και η παροχή (7§3). Σβήνει ό,τι τραβήχτηκε και δεν καταχωρήθηκε.
//
// ΑΛΛΑΓΗ ΛΟΓΙΣΤΗ. Ενας λογιστής τη φορά. Πριν ανακληθεί ο προηγούμενος, ρητή
// επιβεβαίωση που λέει τι σβήνει (όσα δεν καταχωρήθηκαν) και τι μένει (οι
// δαπάνες). Θωράκιση 24/11/2026, Κ4 και Σ6 του νομικού ελέγχου.
//
// Η ΠΕΡΙΟΔΟΣ. Ο πρώτος συγχρονισμός φέρνει από 1/1 του τρέχοντος έτους ή και
// του προηγούμενου (για τη δήλωση που τρέχει ως τον Ιούλιο). Τίποτα παλιότερο.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Btn, ChipToggle, fd } from '@/components/Theme';
import { CustomSelect } from './UIComponents';
import { SetRow } from './SettingsKit';
import { confirmDialog } from '@/components/confirmBus';
import { notifyError } from '@/components/Toast';
import { athensToday } from '@/lib/core/time';
import { myAccountants } from '@/lib/data/accountant';
import * as mydata from '@/lib/data/mydata';
import { clientSyncedLine, athensStamp, LOG_ACTION } from '@/lib/mydata/status';
import { useBillingWords } from './useBillingWords';
import { MYDATA_CONSENT_TITLE, MYDATA_CONSENT_POINTS, MYDATA_HEALTH_CONSENT, MYDATA_PRIVACY_HREF } from '@/lib/mydata/consentText';

const GRANT_FAIL: Record<string, string> = {
  no_afm: 'Συμπλήρωσε πρώτα το ΑΦΜ σου στα «Στοιχεία τιμολόγησης».',
  not_linked: 'Ο λογιστής δεν είναι πια συνδεδεμένος. Στείλε του ξανά τον σύνδεσμο.',
  bad_period: 'Διάλεξε περίοδο ξανά.',
  // Το ΑΦΜ το επιβεβαιώνει ο λογιστής: κανείς δεν παίρνει τα παραστατικά άλλου.
  afm_unconfirmed: 'Ο λογιστής σου επιβεβαιώνει πρώτα το ΑΦΜ σου από τον δικό του χώρο. Ζήτησέ του το.',
  afm_mismatch: 'Το ΑΦΜ στα «Στοιχεία τιμολόγησης» δεν είναι αυτό που επιβεβαίωσε ο λογιστής σου. Έλεγξέ το μαζί του.',
  afm_taken: 'Αυτό το ΑΦΜ έχει ήδη άδεια myDATA από άλλον λογαριασμό.',
  health_unchecked: 'Σημείωσε πρώτα το τελευταίο πλαίσιο.',
  text_outdated: 'Το κείμενο άλλαξε. Ανανέωσε τη σελίδα και διάβασέ το ξανά.',
  plan_required: 'Η Σύνδεση myDATA θέλει μεγαλύτερο πακέτο.',
};

const plural = (n: number) => (n === 1 ? '1 παραστατικό' : `${n.toLocaleString('el-GR')} παραστατικά`);

/**
 * `allowed`: το πακέτο του χρήστη έχει τη Σύνδεση myDATA (`hasFeature(…,
 * 'mydata_sync')`, από το «Ιδιοκτήτης+»). Η βάση το ξαναελέγχει στην άδεια και
 * σε κάθε σελίδα της άντλησης· εδώ λέγεται πριν πατηθεί οτιδήποτε.
 */
export default function MydataConsent({ userId, allowed = false }: { userId: string; allowed?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const words = useBillingWords();
  const [accountants, setAccountants] = useState<{ accountantId: string; name: string }[] | null>(null);
  const [consent, setConsent] = useState<mydata.MyConsent | null>(null);
  const [log, setLog] = useState<mydata.LogRow[]>([]);
  const [pick, setPick] = useState('');
  const year = Number(athensToday().slice(0, 4));
  const [fromYear, setFromYear] = useState(year - 1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [health, setHealth] = useState(false);
  // Η φόρμα της άδειας ανοιχτή για αλλαγή λογιστή, ενώ υπάρχει ήδη άδεια.
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    const [a, c, l] = await Promise.all([myAccountants(supabase), mydata.myConsent(supabase), mydata.accessLog(supabase, userId)]);
    setAccountants(a);
    if (!c.error) setConsent(c.data);
    if (!l.error) setLog(l.rows);
  }, [supabase, userId]);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => { if (alive) void load(); });
    return () => { alive = false; };
  }, [load]);

  if (!accountants || accountants.length === 0) return null;

  // ΧΩΡΙΣ ΤΟ ΠΑΚΕΤΟ ΚΑΙ ΧΩΡΙΣ ΑΔΕΙΑ: μόνο από ποιο πακέτο ανοίγει.
  if (!allowed && !consent) return (
    <SetRow title="myDATA από τον λογιστή" desc={MYDATA_CONSENT_TITLE}>
      {words?.mydataAccess && <p style={{ ...TT.bodySm, margin: `0 0 ${T.sp.sm}px`, color: 'var(--text-secondary)' }}>{words.mydataAccess}</p>}
      <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn variant="secondary" href="/paketa">Δες τα πακέτα</Btn>
      </div>
    </SetRow>
  );

  const holder = consent ? accountants.find(a => a.accountantId === consent.accountantId) : null;
  // Στην αλλαγή, ο τωρινός λογιστής δεν είναι επιλογή.
  const choices = switching && consent ? accountants.filter(a => a.accountantId !== consent.accountantId) : accountants;
  const chosen = choices.some(a => a.accountantId === pick) ? pick : choices[0]?.accountantId ?? '';
  const chosenName = choices.find(a => a.accountantId === chosen)?.name ?? 'τον νέο λογιστή';

  const allow = async () => {
    if (!health || !chosen) return;
    setBusy(true); setNote('');
    let r = await mydata.grant(supabase, chosen, fromYear, { health });
    if (!r.error && !r.ok && r.reason === 'switch_confirm') {
      setBusy(false);
      if (!await confirmDialog({
        title: 'Αλλαγή λογιστή;',
        message: `${holder?.name ?? 'Ο τωρινός λογιστής'} σταματά αμέσως να φέρνει παραστατικά και δεν βλέπει πια τίποτα από το myDATA. `
          + (r.pending ? `Σβήνουν ${plural(r.pending)} που δεν καταχώρησες. ` : '')
          + `Οι δαπάνες που καταχώρησες μένουν στον λογαριασμό σου. Από εδώ και πέρα τα φέρνει ${chosenName}.`,
        confirmLabel: 'Αλλαγή', tone: 'negative',
      })) return;
      setBusy(true);
      r = await mydata.grant(supabase, chosen, fromYear, { health, switchConfirmed: true });
    }
    setBusy(false);
    if (r.error) { notifyError('Η άδεια δεν δόθηκε'); return; }
    if (!r.ok) { setNote(GRANT_FAIL[r.reason ?? ''] ?? 'Η άδεια δεν δόθηκε. Δοκίμασε ξανά.'); return; }
    setSwitching(false); setHealth(false);
    if (r.deleted) setNote(`Ο λογιστής άλλαξε. Σβήστηκαν ${plural(r.deleted)} που δεν είχες καταχωρήσει.`);
    await load();
  };

  const stop = async () => {
    if (!consent) return;
    if (!await confirmDialog({
      title: 'Ανάκληση άδειας myDATA;',
      message: 'Ο λογιστής σταματά να φέρνει παραστατικά. Τα παραστατικά που ήρθαν με την άδεια σβήνουν· οι δαπάνες σου μένουν.',
      confirmLabel: 'Ανάκληση', tone: 'negative',
    })) return;
    setBusy(true);
    const r = await mydata.revoke(supabase, consent.accountantId);
    setBusy(false);
    if (!r.ok) { notifyError('Η άδεια δεν ανακλήθηκε'); return; }
    setNote(r.deleted ? `Ανακλήθηκε. Σβήστηκαν ${r.deleted === 1 ? '1 παραστατικό' : `${r.deleted} παραστατικά`}.` : 'Ανακλήθηκε.');
    await load();
  };

  // Η ΚΑΤΑΣΤΑΣΗ ΣΕ ΜΙΑ ΠΡΟΤΑΣΗ, ΜΕ ΤΗ ΛΥΣΗ ΟΤΑΝ ΚΑΤΙ ΔΕΝ ΠΗΓΕ ΚΑΛΑ.
  const state = !consent ? ''
    : !allowed ? 'Το πακέτο σου δεν περιλαμβάνει πια τη Σύνδεση myDATA. Δεν έρχονται νέα παραστατικά και τίποτα δεν σβήνει.'
    : consent.status === 'paused' ? 'Ο σύνδεσμος με τον λογιστή χρειάζεται ανανέωση. Ως τότε δεν έρχονται νέα παραστατικά και τίποτα δεν σβήνει.'
    : consent.status === 'forbidden' ? 'Η ΑΑΔΕ δεν δίνει παραστατικά για το ΑΦΜ σου μέσω λογιστή. Έλεγξε την εξουσιοδότηση του λογιστή σου στο myAADE.'
    // Ε2: καμία αυτόματη νέα προσπάθεια· ξαναδοκιμάζει ο λογιστής.
    : consent.status === 'error' && consent.error !== 'no_afm' ? 'Η ΑΑΔΕ δεν απάντησε στην τελευταία άντληση. Ο λογιστής σου ξαναδοκιμάζει από τον χώρο του.'
    : consent.status === 'error' && consent.error === 'no_afm' ? GRANT_FAIL.no_afm
    : clientSyncedLine(consent.lastSyncAt);

  // ΤΟ ΚΕΙΜΕΝΟ ΤΗΣ ΣΥΝΑΙΝΕΣΗΣ, ΠΡΙΝ ΑΠΟ ΤΟ «ΕΠΙΤΡΕΠΩ». Ιδιο με την έκδοση που
  // στέλνει το `grant` (lib/mydata/consentText.ts).
  const form = (
    <>
      <ul style={{ ...TT.bodySm, margin: `0 0 ${T.sp.md}px`, paddingLeft: 20, display: 'grid', gap: 6, color: 'var(--text-secondary)' }}>
        {MYDATA_CONSENT_POINTS.map(t => <li key={t}>{t}</li>)}
      </ul>
      {/* Στόχος αφής 44, όπως το «Ιστορικό πρόσβασης» πιο κάτω. */}
      <p style={{ ...TT.bodySm, margin: `0 0 ${T.sp.sm}px` }}>
        <a href={MYDATA_PRIVACY_HREF} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'var(--accent)', textDecorationLine: 'underline', textUnderlineOffset: 2, fontWeight: 600 }}>Τι κρατάμε, για πόσο και ποιος είναι υπεύθυνος</a>
      </p>
      {choices.length > 1 && (
        <div style={{ maxWidth: 360, marginBottom: T.sp.sm }}>
          <CustomSelect label="Λογιστής" value={chosen} onChange={setPick}
            options={choices.map(a => ({ value: a.accountantId, label: a.name }))} />
        </div>
      )}
      <div role="group" aria-label="Από πότε" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ChipToggle on={fromYear === year - 1} onClick={() => setFromYear(year - 1)}>Από 01/01/{year - 1}</ChipToggle>
        <ChipToggle on={fromYear === year} onClick={() => setFromYear(year)}>Από 01/01/{year}</ChipToggle>
      </div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', minHeight: 44, marginTop: T.sp.md }}>
        <input type="checkbox" checked={health} onChange={e => setHealth(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ ...TT.bodySm, lineHeight: 1.6, color: 'var(--text-primary)' }}>{MYDATA_HEALTH_CONSENT}</span>
      </label>
      <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: T.sp.md }}>
        <Btn variant="primary" onClick={() => void allow()} disabled={busy || !health || !chosen}>{busy ? 'Επιτρέπω…' : 'Επιτρέπω'}</Btn>
        {switching && <Btn variant="ghost" onClick={() => { setSwitching(false); setHealth(false); }} disabled={busy}>Άκυρο</Btn>}
      </div>
    </>
  );

  return (
    <SetRow title="myDATA από τον λογιστή" desc={MYDATA_CONSENT_TITLE}>
      {consent && !switching ? (
        <>
          <p style={{ ...TT.bodySm, margin: 0, color: 'var(--text-secondary)' }}>
            {holder?.name ?? 'Ο λογιστής σου'} · από {fd(consent.windowFrom)}
          </p>
          <p role="status" aria-live="polite" style={{ ...TT.bodySm, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums',
            color: consent.status === 'forbidden' ? 'var(--warning-on-container)' : 'var(--text-secondary)' }}>{state}</p>
          <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: T.sp.md }}>
            <Btn variant="secondary" onClick={() => void stop()} disabled={busy}>{busy ? 'Ανάκληση…' : 'Ανάκληση'}</Btn>
            {accountants.length > 1 && (
              <Btn variant="ghost" onClick={() => { setSwitching(true); setNote(''); }} disabled={busy}>Αλλαγή λογιστή</Btn>
            )}
          </div>
        </>
      ) : form}
      {note && <p aria-live="polite" style={{ ...TT.bodySm, margin: `${T.sp.sm}px 0 0`, color: 'var(--text-secondary)' }}>{note}</p>}
      {log.length > 0 && (
        <details style={{ marginTop: T.sp.md }}>
          {/* Στόχος αφής 44, ο ίδιος σταθερός πάτος με την `.po-disclosure` (με μόνο
              γέμισμα έβγαινε 43,x). Το `list-item` κρατά το εγγενές βέλος. */}
          <summary style={{ ...TT.bodySm, cursor: 'pointer', color: 'var(--text-secondary)', display: 'list-item', minHeight: 44, lineHeight: '44px', width: 'fit-content' }}>Ιστορικό πρόσβασης</summary>
          <ul style={{ listStyle: 'none', padding: 0, margin: `${T.sp.xs}px 0 0`, display: 'grid', gap: 4 }}>
            {log.map(l => (
              <li key={`${l.at}${l.action}`} style={{ ...TT.bodySm, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                {athensStamp(l.at)} · {LOG_ACTION[l.action] ?? l.action}{l.action === 'sync_fetch' && l.n ? ` (${l.n})` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </SetRow>
  );
}
