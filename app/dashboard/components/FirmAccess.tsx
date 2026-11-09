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
// εγγραφή, για σήμερα και χθες, με «Δες» και «Αναίρεση όλων» ανά μέρα.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Btn, Modal, LinkBtn, fd } from '@/components/Theme';
import { CustomSelect } from './UIComponents';
import { SetRow } from './SettingsKit';
import { notify, notifyError } from '@/components/Toast';
import { confirmDialog } from '@/components/confirmBus';
import { athensToday, athensTime } from '@/lib/core/time';
import { FIRMS_CHANGED } from '@/lib/data/accountantLink';
import {
  ownerFirms, setLevel, revokeFirm, firmDay, undoFirmDay, undoDaysFrom, inAthensDay, daySentence, reasonText, logLine,
  LEVELS, LEVEL_LABEL, LEVEL_HINT, ROLE_LABEL, KIND_LABEL,
  type OwnerFirm, type AccessLevel, type FirmDay, type LogEntry, type UndoDay,
} from '@/lib/data/firms';

export function FirmAccess() {
  const supabase = useMemo(() => createClient(), []);
  const [firms, setFirms] = useState<OwnerFirm[] | null>(null);
  // «ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ» ΔΕΝ ΕΙΝΑΙ «ΚΑΝΕΝΑ ΓΡΑΦΕΙΟ». Η αποτυχία έκρυβε όλη την
  // ενότητα μαζί με την «Ανάκληση του γραφείου»: ο ιδιοκτήτης δεν είχε πού
  // να κόψει την πρόσβαση τη στιγμή που ίσως το ήθελε.
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const r = await ownerFirms(supabase);
    setFailed(!r.ok);
    setFirms(r.ok ? r.data.filter(f => f.firmId) : []);
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    ownerFirms(supabase).then(r => { if (!alive) return; setFailed(!r.ok); setFirms(r.ok ? r.data.filter(f => f.firmId) : []); });
    // Η ανάκληση του συνδέσμου λογιστή (TabSettings) κόβει και τα γραφεία.
    const again = () => { void load(); };
    window.addEventListener(FIRMS_CHANGED, again);
    return () => { alive = false; window.removeEventListener(FIRMS_CHANGED, again); };
  }, [supabase, load]);

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

  if (failed) {
    return (
      <SetRow title="Λογιστικά γραφεία" desc="Τα γραφεία που σε βλέπουν δεν διαβάστηκαν. Η πρόσβασή τους δεν άλλαξε.">
        <div style={{ marginTop: T.sp.md }}>
          <Btn variant="secondary" onClick={() => void load()}>Δοκίμασε ξανά</Btn>
        </div>
      </SetRow>
    );
  }
  if (!firms || firms.length === 0) return null;

  return (
    <>
      {firms.map(f => (
        <SetRow key={f.firmId} title={f.firmName ?? f.name}
          desc={
            <>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {`${f.firmKind ? KIND_LABEL[f.firmKind] : 'Λογιστής'} · από ${fd(f.linkedAt)}`}
                {f.lastOpenedAt ? ` · άνοιξε τον φάκελό σου στις ${fd(f.lastOpenedAt)}` : ''}
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

/**
 * Από πότε ψάχνουμε στο ημερολόγιο: τρεις μέρες πίσω καλύπτουν πάντα την αρχή
 * του «χθες» στην ώρα Αθήνας (ως 48 ώρες πριν, συν τη θερινή ώρα). Το φίλτρο
 * της μέρας γίνεται μετά, με `inAthensDay`.
 */
const sinceThreeDays = () => new Date(Date.now() - 3 * 86_400_000).toISOString();

interface DayGroup extends UndoDay { firms: FirmDay[] }

/**
 * ΣΗΜΕΡΑ ΚΑΙ ΧΘΕΣ, ΟΠΩΣ ΤΑ ΥΠΟΣΧΕΤΑΙ Η ΠΟΛΙΤΙΚΗ. Η Πολιτική απορρήτου (#grafeia)
 * λέει ότι ο ιδιοκτήτης βλέπει τη σύνοψη κάθε ημέρας και αναιρεί μέσα σε
 * `FIRM_UNDO_DAYS` ημέρες. Η οθόνη έδειχνε μόνο το σήμερα: ό,τι καταχώρησε το
 * γραφείο στις 23:50 χανόταν από την οθόνη δέκα λεπτά μετά, ενώ η αναίρεσή του
 * ήταν ακόμη δυνατή. Κάθε μέρα έχει τις δικές της γραμμές και τη δική της
 * «Αναίρεση όλων»· η βάση ελέγχει ξανά ότι η μέρα είναι μέσα στο παράθυρο.
 */
export function FirmDaySummary() {
  const supabase = useMemo(() => createClient(), []);
  const today = athensToday();
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [seeing, setSeeing] = useState<{ firm: FirmDay; when: UndoDay; rows: LogEntry[] } | null>(null);
  const [busy, setBusy] = useState('');

  const fetchAll = useCallback(async (): Promise<DayGroup[]> => {
    const days = undoDaysFrom(today);
    const read = await Promise.all(days.map(d => firmDay(supabase, d.day)));
    return days.map((d, i) => ({ ...d, firms: read[i].ok ? read[i].data : [] }));
  }, [supabase, today]);

  const load = useCallback(async () => { setGroups(await fetchAll()); }, [fetchAll]);

  useEffect(() => {
    let alive = true;
    fetchAll().then(g => { if (alive) setGroups(g); });
    return () => { alive = false; };
  }, [fetchAll]);

  const see = async (d: FirmDay, when: UndoDay) => {
    // ΟΛΑ ΟΣΑ ΘΑ ΑΓΓΙΞΕΙ Η «ΑΝΑΙΡΕΣΗ ΟΛΩΝ»: νέες, αλλαγές, αφαιρέσεις,
    // πληρωμές. Το ημερολόγιο κρατά ποια πεδία άλλαξαν, όχι τις τιμές τους
    // (20261104150000)· τις τιμές τις βλέπει ο ιδιοκτήτης στις καρτέλες του.
    const { data, error } = await supabase.from('firm_record_log')
      .select('id,kind,action,label,fields,member_name,at').eq('firm_id', d.firmId).is('undone_at', null)
      .in('action', ['insert', 'update', 'delete', 'mark_paid']).gte('at', sinceThreeDays()).order('at', { ascending: false });
    // «Δεν διαβάστηκε» δεν είναι «δεν καταχώρησε τίποτα».
    if (error) { notifyError('Οι καταχωρήσεις δεν διαβάστηκαν. Δοκίμασε ξανά.'); return; }
    const rows = ((data ?? []) as LogEntry[]).filter(r => inAthensDay(r.at, when.day));
    setSeeing({ firm: d, when, rows });
  };

  const undo = async (d: FirmDay, when: UndoDay) => {
    const adj = when.lower === 'σήμερα' ? 'σημερινές' : when.lower === 'χθες' ? 'χθεσινές' : `της ${fd(when.day)}`;
    if (!await confirmDialog({
      title: `Αναίρεση όλων: ${when.lower}, ${fd(when.day)}`,
      message: `Ό,τι καταχώρησε ${when.lower} το γραφείο ${d.firmName} φεύγει και οι πληρωμές που σημείωσε ξανανοίγουν. Ό,τι άλλαξες εσύ στο μεταξύ μένει.`,
      confirmLabel: 'Αναίρεση όλων', tone: 'negative',
    })) return;
    const key = `${d.firmId}:${when.day}`;
    setBusy(key);
    const r = await undoFirmDay(supabase, d.firmId, when.day);
    setBusy('');
    if (!r.ok) { notifyError(reasonText(r.reason)); return; }
    setSeeing(null);
    notify(`Οι ${adj} καταχωρήσεις του γραφείου αναιρέθηκαν.`);
    await load();
  };

  const shown = groups.filter(g => g.firms.length > 0);
  if (shown.length === 0) return null;

  return (
    <div style={{ margin: '16px 0 0', paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: T.sp.lg }}>
      {shown.map(g => (
        <section key={g.day} aria-label={`${g.word}, ${fd(g.day)}`} style={{ display: 'grid', gap: T.sp.md }}>
          <h3 style={{ ...TT.label, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {g.word}<span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>{` · ${fd(g.day)}`}</span>
          </h3>
          {g.firms.map(d => (
            <div key={d.firmId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: T.sp.md, flexWrap: 'wrap' }}>
              <span style={{ ...TT.body, color: 'var(--text-primary)', flex: '1 1 260px', fontVariantNumeric: 'tabular-nums' }}>
                {daySentence(d, g.lower)}
                {/* ΑΡΘΡΟ 14 ΓΚΠΔ: ο μισθωτής ενημερώνεται από τον ιδιοκτήτη, όποιος κι αν τον καταχώρησε (Πολιτική #grafeia). */}
                {(d.counts.tenant ?? 0) > 0 && (
                  <span style={{ ...TT.bodySm, color: 'var(--text-secondary)', display: 'block', marginTop: T.sp.xs }}>
                    Το γραφείο πρόσθεσε μισθωτή. Ενημέρωσε τον μισθωτή για την επεξεργασία των στοιχείων του.
                  </span>
                )}
              </span>
              <div className="act-row" style={{ display: 'flex', gap: T.sp.sm }}>
                <Btn variant="secondary" onClick={() => void see(d, g)}>Δες</Btn>
                <Btn variant="secondary" className="po-btn-keep" onClick={() => void undo(d, g)} disabled={busy === `${d.firmId}:${g.day}`}>Αναίρεση όλων</Btn>
              </div>
            </div>
          ))}
        </section>
      ))}
      <Modal open={!!seeing} onClose={() => setSeeing(null)} title={seeing?.firm.firmName ?? ''}
        subtitle={seeing ? `${seeing.when.word}, ${fd(seeing.when.day)} · ${seeing.rows.length === 1 ? '1 κίνηση' : `${seeing.rows.length} κινήσεις`}` : ''} size="sm"
        footer={seeing ? (
          <>
            <Btn variant="secondary" className="po-btn-keep" onClick={() => void undo(seeing.firm, seeing.when)} disabled={busy === `${seeing.firm.firmId}:${seeing.when.day}`}>Αναίρεση όλων</Btn>
            <Btn variant="primary" onClick={() => setSeeing(null)}>Εντάξει</Btn>
          </>
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
