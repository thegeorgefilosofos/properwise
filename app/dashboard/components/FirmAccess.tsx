'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΓΡΑΦΕΙΑ ΠΟΥ ΒΛΕΠΟΥΝ ΤΟΝ ΙΔΙΟΚΤΗΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Ο ιδιοκτήτης βλέπει, για κάθε γραφείο: από πότε έχει πρόσβαση, ποια μέλη
// του τον βλέπουν πράγματι, πότε άνοιξαν τελευταία τον φάκελό του και τι
// επιτρέπεται να γράψουν. Το επίπεδο αλλάζει με το dropdown της εφαρμογής·
// η ανάκληση ζητά επιβεβαίωση.
//
// ΑΛΗΘΙΝΗ ΠΕΡΙΓΡΑΦΗ, ΟΧΙ ΔΙΑΒΕΒΑΙΩΣΗ. Κάθε επίπεδο λέει τι κάνει το γραφείο με
// μία πρόταση (LEVEL_HINT). Τίποτε περισσότερο δεν υπόσχεται.
//
// Η ΣΥΝΟΨΗ ΤΗΣ ΗΜΕΡΑΣ: μία πρόταση ανά γραφείο, όχι μία ειδοποίηση ανά
// εγγραφή, με «Δες» και «Αναίρεση όλων των σημερινών».
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Btn, Modal, LinkBtn, fd } from '@/components/Theme';
import { CustomSelect } from './UIComponents';
import { SetRow } from './SettingsKit';
import { notify, notifyError } from '@/components/Toast';
import { confirmDialog } from '@/components/confirmBus';
import { athensToday, athensTime } from '@/lib/core/time';
import {
  ownerFirms, setLevel, revokeFirm, firmDay, undoFirmDay, daySentence, reasonText, logLine,
  LEVELS, LEVEL_LABEL, LEVEL_HINT, ROLE_LABEL, KIND_LABEL,
  type OwnerFirm, type AccessLevel, type FirmDay, type LogEntry,
} from '@/lib/data/firms';

export function FirmAccess() {
  const supabase = useMemo(() => createClient(), []);
  const [firms, setFirms] = useState<OwnerFirm[] | null>(null);

  const load = useCallback(async () => {
    const r = await ownerFirms(supabase);
    setFirms(r.ok ? r.data.filter(f => f.firmId) : []);
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    ownerFirms(supabase).then(r => { if (alive) setFirms(r.ok ? r.data.filter(f => f.firmId) : []); });
    return () => { alive = false; };
  }, [supabase]);

  const change = async (f: OwnerFirm, level: AccessLevel) => {
    const r = await setLevel(supabase, f.firmId as string, level);
    if (!r.ok) { notifyError(reasonText(r.reason)); return; }
    notify(`${f.firmName}: ${LEVEL_LABEL[level]}.`);
    await load();
  };

  const revoke = async (f: OwnerFirm) => {
    if (!await confirmDialog({
      title: `Ανάκληση πρόσβασης: ${f.firmName}`,
      message: 'Από αυτή τη στιγμή κανένα μέλος του γραφείου δεν βλέπει τα στοιχεία σου. Ο σύνδεσμός σου ανανεώνεται, ώστε κανένα αντίγραφο του παλιού να μην ανοίγει. Ό,τι έχει ήδη καταχωρήσει το γραφείο μένει στον λογαριασμό σου.',
      confirmLabel: 'Ανάκληση του γραφείου', tone: 'negative',
    })) return;
    const r = await revokeFirm(supabase, f.firmId as string);
    if (!r.ok) { notifyError(reasonText(r.reason)); return; }
    notify('Η πρόσβαση ανακλήθηκε.');
    await load();
  };

  if (!firms || firms.length === 0) return null;

  return (
    <>
      {firms.map(f => (
        <SetRow key={f.firmId} title={f.firmName ?? f.name}
          desc={
            <>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {`${f.firmKind ? KIND_LABEL[f.firmKind] : 'Λογιστής'} · από ${fd(f.linkedAt)}`}
                {f.lastOpenedAt ? ` · άνοιξε τον φάκελό σου ${fd(f.lastOpenedAt)}` : ''}
              </span>
              {f.members.length > 0 && (
                <span style={{ display: 'block', marginTop: 2 }}>
                  {`Σε βλέπουν: ${f.members.map(m => `${m.name} (${ROLE_LABEL[m.role]})`).join(', ')}`}
                </span>
              )}
            </>
          }>
          {/* ΤΟ ΕΠΙΠΕΔΟ ΚΑΤΕΒΑΙΝΕΙ ΚΑΤΩ ΑΠΟ ΤΗΝ ΠΕΡΙΓΡΑΦΗ, ΟΧΙ ΔΙΠΛΑ ΤΗΣ. Ενα
              dropdown 264 px δεξιά άφηνε στα 390 μια στήλη λίγων γραμμάτων για
              το όνομα του γραφείου και τα μέλη του (SettingsKit: φόρμα από κάτω). */}
          <div style={{ display: 'grid', gap: T.sp.sm }}>
            <div style={{ maxWidth: 320 }}>
              <CustomSelect ariaLabel={`Τι επιτρέπεται στο ${f.firmName}`} value={f.accessLevel}
                onChange={v => void change(f, v as AccessLevel)}
                options={LEVELS.map(l => ({ value: l, label: LEVEL_LABEL[l] }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: T.sp.lg, flexWrap: 'wrap' }}>
              <span style={{ ...TT.bodySm, color: 'var(--text-secondary)', flex: '1 1 260px' }}>{LEVEL_HINT[f.accessLevel]}</span>
              <LinkBtn tone="danger" onClick={() => void revoke(f)}>Ανάκληση του γραφείου</LinkBtn>
            </div>
          </div>
        </SetRow>
      ))}
    </>
  );
}

/** Από πότε ψάχνουμε: δύο μέρες πίσω καλύπτουν κάθε «σήμερα» στην ώρα Αθήνας. */
const sinceTwoDays = () => new Date(Date.now() - 2 * 86_400_000).toISOString();

export function FirmDaySummary() {
  const supabase = useMemo(() => createClient(), []);
  const today = athensToday();
  const [days, setDays] = useState<FirmDay[]>([]);
  const [seeing, setSeeing] = useState<{ firm: FirmDay; rows: LogEntry[] } | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const r = await firmDay(supabase, today);
    setDays(r.ok ? r.data : []);
  }, [supabase, today]);

  useEffect(() => {
    let alive = true;
    firmDay(supabase, today).then(r => { if (alive) setDays(r.ok ? r.data : []); });
    return () => { alive = false; };
  }, [supabase, today]);

  const see = async (d: FirmDay) => {
    // ΟΛΑ ΟΣΑ ΘΑ ΑΓΓΙΞΕΙ Η «ΑΝΑΙΡΕΣΗ ΟΛΩΝ»: νέες, αλλαγές, αφαιρέσεις,
    // πληρωμές. Το ημερολόγιο κρατά ποια πεδία άλλαξαν, όχι τις τιμές τους
    // (20261104150000)· τις τιμές τις βλέπει ο ιδιοκτήτης στις καρτέλες του.
    const { data, error } = await supabase.from('firm_record_log')
      .select('id,kind,action,label,fields,member_name,at').eq('firm_id', d.firmId).is('undone_at', null)
      .in('action', ['insert', 'update', 'delete', 'mark_paid']).gte('at', sinceTwoDays()).order('at', { ascending: false });
    // «Δεν διαβάστηκε» δεν είναι «δεν καταχώρησε τίποτα».
    if (error) { notifyError('Οι σημερινές καταχωρήσεις δεν διαβάστηκαν. Δοκίμασε ξανά.'); return; }
    const rows = ((data ?? []) as LogEntry[]).filter(r => athensToday(new Date(r.at)) === today);
    setSeeing({ firm: d, rows });
  };

  const undo = async (d: FirmDay) => {
    if (!await confirmDialog({
      title: 'Αναίρεση όλων των σημερινών καταχωρήσεων',
      message: `Ό,τι καταχώρησε σήμερα το γραφείο ${d.firmName} φεύγει και οι πληρωμές που σημείωσε ξανανοίγουν. Ό,τι άλλαξες εσύ στο μεταξύ μένει.`,
      confirmLabel: 'Αναίρεση όλων', tone: 'negative',
    })) return;
    setBusy(d.firmId);
    const r = await undoFirmDay(supabase, d.firmId, today);
    setBusy('');
    if (!r.ok) { notifyError(reasonText(r.reason)); return; }
    setSeeing(null);
    notify('Οι σημερινές καταχωρήσεις του γραφείου αναιρέθηκαν.');
    await load();
  };

  if (days.length === 0) return null;

  return (
    <div style={{ margin: '16px 0 0', paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: T.sp.md }}>
      {days.map(d => (
        <div key={d.firmId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: T.sp.md, flexWrap: 'wrap' }}>
          <span style={{ ...TT.body, color: 'var(--text-primary)', flex: '1 1 260px', fontVariantNumeric: 'tabular-nums' }}>{daySentence(d)}</span>
          <div style={{ display: 'flex', gap: T.sp.sm }}>
            <Btn variant="secondary" onClick={() => void see(d)}>Δες</Btn>
            <Btn variant="ghost" onClick={() => void undo(d)} disabled={busy === d.firmId}>Αναίρεση όλων</Btn>
          </div>
        </div>
      ))}
      <Modal open={!!seeing} onClose={() => setSeeing(null)} title={seeing?.firm.firmName ?? ''}
        subtitle={`Σήμερα, ${fd(today)}${seeing ? ` · ${seeing.rows.length === 1 ? '1 κίνηση' : `${seeing.rows.length} κινήσεις`}` : ''}`} size="sm"
        footer={seeing ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: T.sp.sm }}>
            <Btn variant="ghost" onClick={() => void undo(seeing.firm)}>Αναίρεση όλων</Btn>
            <Btn variant="primary" onClick={() => setSeeing(null)}>Εντάξει</Btn>
          </div>
        ) : undefined}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {(seeing?.rows ?? []).map((r, i) => (
            <li key={r.id} style={{ padding: `${T.sp.sm}px 0`, borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
              <span style={{ ...TT.bodySm, color: 'var(--text-primary)', display: 'block', overflowWrap: 'anywhere' }}>{logLine(r)}</span>
              <span style={{ ...TT.bodySm, color: 'var(--text-tertiary)', display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                {`${r.member_name || 'Μέλος του γραφείου'} · ${athensTime(new Date(r.at))}`}
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
