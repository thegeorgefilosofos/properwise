'use client';
// ═══════════════════════════════════════════════════════════════════════════
// «Ο ΛΟΓΙΣΤΗΣ ΣΟΥ ΜΠΟΡΕΙ ΝΑ ΦΕΡΝΕΙ ΑΥΤΟΜΑΤΑ ΤΑ ΠΑΡΑΣΤΑΤΙΚΑ ΣΟΥ ΑΠΟ ΤΟ myDATA»
// ─────────────────────────────────────────────────────────────────────────
// Στα «Δεδομένα και απόρρητο», κάτω από την πρόσβαση λογιστή: ίδια ερώτηση,
// «ποιος βλέπει τι και πώς το κόβω». Εμφανίζεται ΜΟΝΟ σε όποιον έχει συνδέσει
// λογιστή μέσα στο PROPERWISE· χωρίς λογιστή δεν έχει τι να επιτρέψει.
//
// ΣΥΝΑΙΝΕΣΗ ΚΑΤΑ ΓΚΠΔ 7. Ξεκινά κλειστό. Το «Επιτρέπω» γράφει γραμμή με
// χρονοσήμανση (απόδειξη, 7§1)· η «Ανάκληση» είναι ένα πάτημα, όσο εύκολη όσο
// και η παροχή (7§3). Σβήνει ό,τι τραβήχτηκε και δεν καταχωρήθηκε.
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
import { clientSyncedLine, athensStamp, athensClock, LOG_ACTION } from '@/lib/mydata/status';

const GRANT_FAIL: Record<string, string> = {
  no_afm: 'Συμπλήρωσε πρώτα το ΑΦΜ σου στα «Στοιχεία τιμολόγησης».',
  not_linked: 'Ο λογιστής δεν είναι πια συνδεδεμένος. Στείλε του ξανά τον σύνδεσμο.',
  bad_period: 'Διάλεξε περίοδο ξανά.',
  // Το ΑΦΜ το επιβεβαιώνει ο λογιστής: κανείς δεν παίρνει τα παραστατικά άλλου.
  afm_unconfirmed: 'Ο λογιστής σου επιβεβαιώνει πρώτα το ΑΦΜ σου από τον δικό του χώρο. Ζήτησέ του το.',
  afm_mismatch: 'Το ΑΦΜ στα «Στοιχεία τιμολόγησης» δεν είναι αυτό που επιβεβαίωσε ο λογιστής σου. Έλεγξέ το μαζί του.',
  afm_taken: 'Αυτό το ΑΦΜ έχει ήδη άδεια myDATA από άλλον λογαριασμό.',
};

export default function MydataConsent({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [accountants, setAccountants] = useState<{ accountantId: string; name: string }[] | null>(null);
  const [consent, setConsent] = useState<mydata.MyConsent | null>(null);
  const [log, setLog] = useState<mydata.LogRow[]>([]);
  const [pick, setPick] = useState('');
  const year = Number(athensToday().slice(0, 4));
  const [fromYear, setFromYear] = useState(year - 1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

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

  const chosen = pick || accountants[0].accountantId;
  const holder = consent ? accountants.find(a => a.accountantId === consent.accountantId) : null;

  const allow = async () => {
    setBusy(true); setNote('');
    const r = await mydata.grant(supabase, chosen, fromYear);
    setBusy(false);
    if (r.error) { notifyError('Η άδεια δεν δόθηκε'); return; }
    if (!r.ok) { setNote(GRANT_FAIL[r.reason ?? ''] ?? 'Η άδεια δεν δόθηκε. Δοκίμασε ξανά.'); return; }
    await load();
  };

  const stop = async () => {
    if (!consent) return;
    if (!await confirmDialog({
      title: 'Ανάκληση άδειας myDATA;',
      message: 'Ο λογιστής σταματά να φέρνει παραστατικά. Όσα ήρθαν και δεν καταχώρησες σβήνουν· οι δαπάνες σου μένουν.',
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
    : consent.status === 'paused' ? 'Ο σύνδεσμος με τον λογιστή χρειάζεται ανανέωση. Ως τότε δεν έρχονται νέα παραστατικά και τίποτα δεν σβήνει.'
    : consent.status === 'forbidden' ? 'Η ΑΑΔΕ αρνείται την πρόσβαση. Όρισε ξανά τον λογιστή σου στο myAADE.'
    : consent.status === 'error' && consent.nextRetryAt ? `Η ΑΑΔΕ δεν απαντά. Νέα προσπάθεια στις ${athensClock(consent.nextRetryAt)}.`
    : consent.status === 'error' && consent.error === 'no_afm' ? GRANT_FAIL.no_afm
    : clientSyncedLine(consent.lastSyncAt, consent.lastNew);

  return (
    <SetRow title="myDATA από τον λογιστή" desc="Ο λογιστής σου μπορεί να φέρνει αυτόματα τα παραστατικά σου από το myDATA.">
      {consent ? (
        <>
          <p style={{ ...TT.bodySm, margin: 0, color: 'var(--text-secondary)' }}>
            {holder?.name ?? 'Ο λογιστής σου'} · από {fd(consent.windowFrom)}
          </p>
          <p role="status" aria-live="polite" style={{ ...TT.bodySm, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums',
            color: consent.status === 'forbidden' ? 'var(--warning-on-container)' : 'var(--text-secondary)' }}>{state}</p>
          <div style={{ marginTop: T.sp.md }}>
            <Btn variant="secondary" onClick={() => void stop()} disabled={busy}>{busy ? 'Ανάκληση…' : 'Ανάκληση'}</Btn>
          </div>
        </>
      ) : (
        <>
          {accountants.length > 1 && (
            <div style={{ maxWidth: 360, marginBottom: T.sp.sm }}>
              <CustomSelect label="Λογιστής" value={chosen} onChange={setPick}
                options={accountants.map(a => ({ value: a.accountantId, label: a.name }))} />
            </div>
          )}
          <div role="group" aria-label="Από πότε" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ChipToggle on={fromYear === year - 1} onClick={() => setFromYear(year - 1)}>Από 01/01/{year - 1}</ChipToggle>
            <ChipToggle on={fromYear === year} onClick={() => setFromYear(year)}>Από 01/01/{year}</ChipToggle>
          </div>
          <div style={{ marginTop: T.sp.md }}>
            <Btn variant="primary" onClick={() => void allow()} disabled={busy}>{busy ? 'Επιτρέπω…' : 'Επιτρέπω'}</Btn>
          </div>
        </>
      )}
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
