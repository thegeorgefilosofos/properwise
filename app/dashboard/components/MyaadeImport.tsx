'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΟ myAADE: ΤΑ ΑΚΙΝΗΤΑ ΚΑΙ Ο ΕΝΦΙΑ ΑΠΟ ΕΝΑ PDF
// ─────────────────────────────────────────────────────────────────────────
// Ο χρήστης ανεβάζει την πράξη ΕΝΦΙΑ του myAADE. Το κείμενο βγαίνει ΣΤΗ
// ΣΥΣΚΕΥΗ του (lib/pdf/pdfText.ts) και το διαβάζει ο αναλυτής κανόνων
// (lib/myaade/enfiaAct.ts): χωρίς AI, χωρίς αποστολή του αρχείου πουθενά. Το
// PDF δεν αποθηκεύεται.
//
// ΤΙΠΟΤΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΡΙΝ ΤΟ ΔΕΙ Ο ΧΡΗΣΤΗΣ. Κάθε ακίνητο φαίνεται με την
// κατάστασή του («Νέο», «Υπάρχει ήδη», «Ίσως υπάρχει», «Εκτός πακέτου»), κάθε
// πεδίο διορθώνεται και κάθε γραμμή ξετσεκάρεται. Η καταχώρηση και η αναίρεση
// ζουν στο lib/myaade/commit.ts.
//
// ΤΟ ΟΡΙΟ ΤΟΥ ΠΑΚΕΤΟΥ (απόφαση ιδιοκτήτη 30/10/2026): φαίνονται όλα όσα
// βρέθηκαν, τσεκαρισμένα είναι όσα χωρούν και ο δρόμος για τα υπόλοιπα είναι
// το υπάρχον παράθυρο αναβάθμισης (UpgradeModal), μέσω του `onUpgrade`.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Undo2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Btn, Badge, InfoBanner, Modal, formGrid, fe, SelectBox } from '@/components/Theme';
import { AadeLink } from '@/components/AadeLink';
import { TextInput, NumberInput, CustomSelect } from './UIComponents';
import { notify, notifyError } from '@/components/Toast';
import { MAX_SCAN_MB } from './scanDoc';
import * as propertiesData from '@/lib/data/properties';
import { read } from '@/lib/data/read';
import { grDate } from '@/lib/core/format';
import { athensToday } from '@/lib/core/time';
import { plural } from '@/lib/core/greek';
import { atakDigits, isAtak, ATAK_DIGITS } from '@/lib/property/atak';
import { enfiaInstalments } from '@/lib/tools/enfiaSchedule';
import { track, PRODUCT_EVENTS } from '@/lib/analytics/events';
import { parseEnfiaAct } from '@/lib/myaade/enfiaAct';
import { matchProperty, type KnownProperty, type MatchResult } from '@/lib/myaade/match';
import { freeSlots, overLimit, excessOf } from '@/lib/myaade/planLimit';
import { commitImport, undoImport, lastUndoable, importsLeft, MYAADE_DAILY_IMPORTS, IMPORT_UNDO_HOURS, type ImportBatch } from '@/lib/myaade/commit';
import type { MyAadeImport } from '@/lib/myaade/types';

/** Μία γραμμή όπως τη διορθώνει ο χρήστης, μέχρι να αποθηκευτεί. */
interface Draft {
  key: number;
  include: boolean;
  match: MatchResult;
  /** «Ίσως υπάρχει»: ο χρήστης είπε ότι είναι το ίδιο (`true`) ή άλλο (`false`). */
  same: boolean | null;
  name: string;
  address: string;
  atak: string;
  sqm: string;
  pct: string;
  floor: string;
  municipality: string | null;
  kind: string | null;
  tax: number | null;
  check: boolean;
  /** Νέα γραμμή που δεν χώρεσε στο πακέτο όταν διαβάστηκε το αρχείο. */
  overPlan: boolean;
}

const PDF_FAILURE: Record<'encrypted' | 'no_text' | 'not_pdf', string> = {
  not_pdf: 'Το αρχείο δεν είναι PDF.',
  encrypted: 'Το PDF είναι κλειδωμένο. Κατέβασέ το ξανά από το myAADE.',
  no_text: 'Είναι φωτογραφία ή σάρωση, όχι το αρχείο του myAADE. Κατέβασε την πράξη από το myAADE.',
};

const str = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));
const num = (s: string): number | null => {
  const t = s.trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const suggestName = (kind: string | null, address: string | null, floor: string | null, i: number) =>
  [kind || 'Ακίνητο', address || `από το myAADE ${i + 1}`].join(', ') + (floor ? ` (όροφος ${floor})` : '');

const isNew = (d: Draft) => d.match.status === 'new' || (d.match.status === 'maybe' && d.same === false);
const existingIdOf = (d: Draft) => (d.match.status === 'exists' || (d.match.status === 'maybe' && d.same === true) ? d.match.id : null);

export default function MyaadeImport({ userId, limit, onUpgrade, onClose, onSaved }: {
  userId: string;
  /** Το όριο ακινήτων του πακέτου (`propertyLimit`). */
  limit: number;
  /** Ανοίγει το υπάρχον παράθυρο αναβάθμισης. */
  onUpgrade: () => void;
  onClose: () => void;
  /** Μετά την καταχώρηση ή την αναίρεση: ξαναφορτώνει τα ακίνητα. */
  onSaved: () => void | Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<'pick' | 'review' | 'saving' | 'done'>('pick');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [doc, setDoc] = useState<MyAadeImport | null>(null);
  const [rows, setRows] = useState<Draft[]>([]);
  const [year, setYear] = useState('');
  const [total, setTotal] = useState('');
  const [known, setKnown] = useState<KnownProperty[] | null>(null);
  const [ownerAfms, setOwnerAfms] = useState<string[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [undoable, setUndoable] = useState<ImportBatch | null>(null);
  const [summary, setSummary] = useState('');
  const [skipped, setSkipped] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── ΤΙ ΞΕΡΕΙ ΗΔΗ Η ΕΦΑΡΜΟΓΗ ────────────────────────────────────────────
  // Ξαναδιαβάζεται με το άνοιγμα και μετά από κάθε καταχώρηση ή αναίρεση.
  const [contextTick, setContextTick] = useState(0);
  const loadContext = () => setContextTick(t => t + 1);
  useEffect(() => {
    let live = true;
    void Promise.all([
      propertiesData.listWithError<KnownProperty>(supabase, userId, { columns: 'id,name,address,atak,sqm,ownership,floor' }),
      read<{ owner_afm: string | null }>(supabase.from('property_settings').select('owner_afm').eq('user_id', userId)),
      importsLeft(supabase, userId),
      lastUndoable(supabase, userId),
    ]).then(([list, afms, n, last]) => {
      if (!live) return;
      if (list.error) { setError('Τα ακίνητά σου δεν διαβάστηκαν. Δοκίμασε ξανά.'); setKnown([]); }
      else setKnown(list.rows);
      setOwnerAfms([...new Set(afms.rows.map(r => (r.owner_afm ?? '').trim()).filter(Boolean))]);
      setLeft(n);
      setUndoable(last);
    });
    return () => { live = false; };
  }, [supabase, userId, contextTick]);

  const currentCount = known?.length ?? 0;
  const slots = freeSlots(limit, currentCount);

  // ── ΑΠΟ ΤΟ PDF ΣΤΗΝ ΠΡΟΕΠΙΣΚΟΠΗΣΗ ──────────────────────────────────────
  const readPdf = async (f: File) => {
    setError(''); setSummary('');
    if (f.size > MAX_SCAN_MB * 1024 * 1024) { setError(`Το αρχείο ξεπερνά τα ${MAX_SCAN_MB} MB.`); return; }
    setStatus('Διαβάζεται το PDF στη συσκευή σου…');
    try {
      // Ο αναγνώστης φορτώνεται μόνο τώρα: δεν βαραίνει την αρχική σελίδα.
      const { extractPdfText } = await import('@/lib/pdf/pdfText');
      const res = extractPdfText(new Uint8Array(await f.arrayBuffer()));
      if (res.failure) { setError(PDF_FAILURE[res.failure]); return; }
      setStatus('Αναγνωρίζονται τα στοιχεία της πράξης…');
      const parsed = parseEnfiaAct(res.lines);
      if (parsed.status === 'unrecognized') { setError(parsed.reason); return; }
      const d = parsed.doc;
      const base = known ?? [];
      const drafts: Draft[] = d.properties.map((p, i) => ({
        key: i, include: true, match: matchProperty(p, base), same: null,
        name: suggestName(p.kind, p.address, p.floor, i), address: p.address ?? '', atak: p.atak ?? '',
        sqm: str(p.sqm), pct: str(p.ownershipPct), floor: p.floor ?? '',
        municipality: p.municipality, kind: p.kind, tax: p.tax, check: p.check, overPlan: false,
      }));
      // Οι νέες πέρα από το όριο ξεκινούν ξετσεκαρισμένες. Το «Ίσως υπάρχει» δεν
      // πιάνει θέση ώσπου να απαντήσει ο χρήστης.
      const over = new Set(overLimit(drafts.filter(r => r.match.status === 'new').map(r => r.key), slots));
      setRows(drafts.map(r => (over.has(r.key) ? { ...r, include: false, overPlan: true } : r)));
      setDoc(d);
      setYear(d.year ? String(d.year) : '');
      setTotal(str(d.total));
      setStep('review');
    } catch {
      // Μόνο το είδος της αποτυχίας: τίποτα από το περιεχόμενο του αρχείου δεν καταγράφεται.
      setError('Το PDF δεν διαβάστηκε. Κατέβασέ το ξανά από το myAADE και ξαναδοκίμασε.');
    } finally { setStatus(''); }
  };

  const pick = (f: File | undefined) => { if (f) void readPdf(f); };

  const patch = (key: number, p: Partial<Draft>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p, check: false } : r)));

  // ── ΕΛΕΓΧΟΙ ΠΡΙΝ ΤΗΝ ΑΠΟΘΗΚΕΥΣΗ ─────────────────────────────────────────
  const chosen = rows.filter(r => r.include);
  const unanswered = chosen.filter(r => r.match.status === 'maybe' && r.same === null).length;
  const newCount = chosen.filter(isNew).length;
  const excess = excessOf(newCount, slots);
  const notIncludedNew = rows.filter(r => !r.include && isNew(r)).length;
  const badAtak = chosen.some(r => r.atak.trim() !== '' && !isAtak(r.atak));
  const noName = chosen.some(r => isNew(r) && !r.name.trim());
  const totalN = num(total);
  const yearN = Number(year);
  const yearOk = Number.isInteger(yearN) && yearN >= 2014 && yearN <= 2100;
  const totalBad = total.trim() !== '' && !(totalN && totalN > 0);
  const writesTotal = !!(totalN && totalN > 0 && yearOk);
  const nothing = chosen.length === 0;
  const blocked = left === 0 || excess > 0 || unanswered > 0 || badAtak || noName || totalBad || (!!totalN && !yearOk) || nothing;
  const afmClash = !!doc?.afm && ownerAfms.length > 0 && !ownerAfms.includes(doc.afm);
  const schedule = writesTotal ? enfiaInstalments(totalN as number, yearN) : [];

  const save = async () => {
    if (blocked || step !== 'review' || !doc) return;
    setStep('saving');
    setStatus('Αποθηκεύονται τα ακίνητα και ο ΕΝΦΙΑ…');
    const res = await commitImport(supabase, {
      userId, year: yearOk ? yearN : null, total: writesTotal ? totalN : null, foundCount: rows.length,
      rows: chosen.map(r => ({
        existingId: existingIdOf(r), name: r.name, address: r.address || null, atak: isAtak(r.atak) ? atakDigits(r.atak) : null,
        sqm: num(r.sqm), ownershipPct: num(r.pct), floor: r.floor || null,
      })),
      known: known ?? [], docDate: doc.issueDate ?? athensToday(),
    });
    setStatus('');
    if (!res.ok) {
      setStep('review');
      if (res.reason === 'daily_limit') { setLeft(0); notifyError(`Έφτασες τις ${MYAADE_DAILY_IMPORTS} εισαγωγές των τελευταίων 24 ωρών. Δοκίμασε αργότερα.`); }
      else notifyError('Η εισαγωγή δεν αποθηκεύτηκε. Δοκίμασε ξανά.');
      return;
    }
    for (const f of res.failures) notifyError(f);
    if (res.created.length) {
      void (async () => {
        const n = await propertiesData.count(supabase, userId);
        void track(supabase, n >= 2 ? PRODUCT_EVENTS.second_property_added : PRODUCT_EVENTS.property_added, { count: n });
      })();
    }
    const parts = [
      res.created.length ? `${plural(res.created.length, 'Προστέθηκε', 'Προστέθηκαν')} ${res.created.length} ${plural(res.created.length, 'ακίνητο', 'ακίνητα')}` : '',
      res.filled ? `${plural(res.filled, 'συμπληρώθηκε', 'συμπληρώθηκαν')} ${res.filled} ${plural(res.filled, 'υπάρχον', 'υπάρχοντα')}` : '',
      res.statement === 'inserted' || res.statement === 'updated' ? `ο ΕΝΦΙΑ ${yearN} είναι ${fe(totalN as number)}` : '',
    ].filter(Boolean);
    setSummary(parts.length ? `${parts.join(' · ')}.` : 'Όλα ήταν ήδη στην εφαρμογή. Δεν άλλαξε τίποτα.');
    setSkipped(notIncludedNew);
    setStep('done');
    await onSaved();
    loadContext();
  };

  const undo = async (batch: ImportBatch) => {
    setStatus('Αναιρείται η εισαγωγή…');
    const res = await undoImport(supabase, userId, batch);
    setStatus('');
    if (!res.ok) {
      notifyError(res.reason === 'expired' ? `Η αναίρεση ισχύει ${IMPORT_UNDO_HOURS}\u00a0ώρες από την εισαγωγή.` : 'Η αναίρεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.');
      loadContext();
      return;
    }
    notify(res.kept
      ? `Αναιρέθηκε. ${res.kept} ${plural(res.kept, 'ακίνητο έμεινε', 'ακίνητα έμειναν')}, γιατί έχουν ήδη δικά σου στοιχεία.`
      : 'Η εισαγωγή αναιρέθηκε.');
    await onSaved();
    loadContext();
    setStep('pick'); setDoc(null); setRows([]); setSummary('');
  };

  const busy = step === 'saving' || !!status;
  const requestClose = () => { if (!busy) onClose(); };
  const found = rows.length;

  return (
    <Modal open onClose={requestClose} size="lg" icon={<FileUp size={19} />}
      title="Εισαγωγή από το myAADE"
      subtitle="Τα ακίνητα και ο ΕΝΦΙΑ σου από την πράξη ΕΝΦΙΑ, χωρίς πληκτρολόγηση"
      footer={step === 'review' || step === 'saving' ? (
        <>
          <Btn variant="secondary" onClick={() => { setStep('pick'); setDoc(null); setRows([]); }} disabled={busy}>Άλλο αρχείο</Btn>
          <Btn variant="primary" onClick={() => void save()} disabled={blocked || busy}>
            {step === 'saving' ? 'Αποθήκευση…' : newCount ? `Πρόσθεσε ${newCount} ${plural(newCount, 'ακίνητο', 'ακίνητα')}` : 'Αποθήκευση'}
          </Btn>
        </>
      ) : step === 'done' ? (
        <>
          {undoable && <Btn variant="secondary" onClick={() => void undo(undoable)} disabled={busy}><Undo2 size={15} />Αναίρεση</Btn>}
          <Btn variant="primary" onClick={onClose} disabled={busy}>Τέλος</Btn>
        </>
      ) : undefined}>

      {/* Η πρόοδος ανακοινώνεται στους αναγνώστες οθόνης· η εστίαση μένει όπου είναι. */}
      <p role="status" aria-live="polite" style={{ ...TT.bodySm, margin: status ? `0 0 ${T.sp.md}px` : 0, minHeight: 0 }}>{status}</p>

      {step === 'pick' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
          {undoable && (
            <InfoBanner tone="info">
              <span>Η τελευταία εισαγωγή σου ({grDate(undoable.created_at)}) αναιρείται για {IMPORT_UNDO_HOURS}{'\u00a0'}ώρες.</span>{' '}
              <Btn variant="ghost" onClick={() => void undo(undoable)} disabled={busy}><Undo2 size={15} />Αναίρεση</Btn>
            </InfoBanner>
          )}
          <div>
            <p style={{ ...TT.bodySm, margin: '0 0 8px' }}>Στο myAADE άνοιξε τον ΕΝΦΙΑ του έτους και αποθήκευσε την πράξη ως PDF:</p>
            <AadeLink action="enfia" emphasis />
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]); }}
            style={{
              border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--border-default)'}`, borderRadius: T.radius.inner,
              background: dragOver ? 'var(--accent-soft)' : 'var(--bg-elevated)', padding: T.sp.lg,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: T.sp.md, textAlign: 'center',
            }}>
            <label htmlFor="myaade-pdf" style={{ ...TT.body, fontWeight: 600 }}>Σύρε εδώ το PDF ή διάλεξε αρχείο</label>
            <input id="myaade-pdf" ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only"
              onChange={e => { pick(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            <Btn variant="primary" onClick={() => fileRef.current?.click()} disabled={busy || left === 0 || known === null}>
              <FileUp size={15} />{busy ? 'Διαβάζεται…' : 'Διάλεξε το PDF'}
            </Btn>
            <span style={{ ...TT.caption }}>Διαβάζεται στη συσκευή σου και δεν αποθηκεύεται. Αποθηκεύονται μόνο όσα επιβεβαιώσεις.</span>
          </div>

          {left === 0 && <InfoBanner tone="negative">Έφτασες τις {MYAADE_DAILY_IMPORTS} εισαγωγές των τελευταίων 24 ωρών. Δοκίμασε αργότερα.</InfoBanner>}
          {error && <p role="alert" style={{ ...TT.bodySm, color: 'var(--negative)', margin: 0 }}>{error}</p>}
        </div>
      )}

      {(step === 'review' || step === 'saving') && doc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
          {/* Η ΕΠΙΚΕΦΑΛΙΔΑ ΑΠΟ ΤΑ ΜΕΤΡΗΜΕΝΑ: κανένα ψηφίο δεν γράφεται με το χέρι. */}
          <h3 style={{ ...TT.h2, margin: 0 }}>
            {`Βρήκαμε ${found} ${plural(found, 'ακίνητο', 'ακίνητα')}`}
            {writesTotal ? ` και ΕΝΦΙΑ ${yearN}: ${fe(totalN as number)}` : ''}
          </h3>

          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: T.sp.lg, background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ ...TT.body, fontWeight: 600 }}>Η πράξη ΕΝΦΙΑ</span>
              {doc.corrective && <Badge tone="info">Διορθωτική</Badge>}
            </div>
            <div style={formGrid(160, 220)}>
              <NumberInput label="Έτος" value={year} onChange={setYear} min={2014} max={2100} />
              <NumberInput label="Ποσό για καταβολή" suffix="€" value={total} onChange={setTotal} />
            </div>
            {schedule.length > 0 && (
              <p style={{ ...TT.caption, margin: '10px 0 0' }}>
                {`${schedule.length} ${plural(schedule.length, 'δόση', 'δόσεις')}, η πρώτη έως ${grDate(schedule[0].date)}. Οι υπενθυμίσεις και το «Πλήρωσα» ενημερώνονται μόνα τους.`}
              </p>
            )}
            {doc.paymentRef && <p style={{ ...TT.caption, margin: '6px 0 0' }}>{'Ταυτότητα οφειλής '}<span style={{ fontFamily: T.font.num }}>{doc.paymentRef}</span>. Δεν αποθηκεύεται.</p>}
            <p style={{ ...TT.caption, margin: '6px 0 0' }}>Το ποσό αντικαθιστά κάθε άλλο σύνολο ΕΝΦΙΑ του ίδιου έτους στην εφαρμογή.</p>
          </div>

          {afmClash && <InfoBanner tone="warning">Η πράξη είναι άλλου ΑΦΜ από αυτό των ακινήτων σου. Συνέχισε μόνο αν είναι δική σου ή του πελάτη σου.</InfoBanner>}
          {doc.warnings.map(w => <InfoBanner key={w} tone="warning">{w}</InfoBanner>)}
          {totalBad && <InfoBanner tone="negative">Το ποσό δεν διαβάζεται. Γράψε το ποσό για καταβολή όπως το δείχνει η πράξη, με κόμμα στα δεκαδικά.</InfoBanner>}
          {!!totalN && !yearOk && <InfoBanner tone="negative">Διάλεξε το έτος της πράξης.</InfoBanner>}
          {excess > 0 && (
            <InfoBanner tone="warning">
              <span>{`Το πακέτο σου χωρά ${slots === 0 ? 'κανένα νέο ακίνητο' : `ακόμη ${slots} ${plural(slots, 'νέο ακίνητο', 'νέα ακίνητα')}`}. Ξετσέκαρε ${excess} ή δες τα πακέτα.`}</span>{' '}
              <Btn variant="ghost" onClick={onUpgrade}>Δες τα πακέτα</Btn>
            </InfoBanner>
          )}
          {excess === 0 && notIncludedNew > 0 && Number.isFinite(slots) && (
            <InfoBanner tone="info">
              <span>{`${notIncludedNew} ${plural(notIncludedNew, 'ακίνητο μένει εκτός, γιατί το πακέτο σου δεν το χωρά', 'ακίνητα μένουν εκτός, γιατί το πακέτο σου δεν τα χωρά')}.`}</span>{' '}
              <Btn variant="ghost" onClick={onUpgrade}>Δες τα πακέτα</Btn>
            </InfoBanner>
          )}

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Ακίνητα της πράξης">
            {rows.map((r, i) => {
              const tag = r.match.status === 'exists' ? <Badge tone="positive">Υπάρχει ήδη</Badge>
                : r.match.status === 'maybe' ? <Badge tone="warning">Ίσως υπάρχει</Badge>
                : r.overPlan && !r.include ? <Badge tone="neutral">Εκτός πακέτου</Badge>
                : <Badge tone="accent">Νέο</Badge>;
              const target = r.match.status !== 'new' ? (known ?? []).find(k => k.id === (r.match as { id: string }).id) : undefined;
              const atakBad = r.atak.trim() !== '' && !isAtak(r.atak);
              return (
                <li key={r.key} style={{
                  border: `1px solid ${atakBad ? 'var(--negative-border)' : r.check ? 'var(--warning)' : 'var(--border-subtle)'}`,
                  borderRadius: T.radius.inner, padding: T.sp.lg, background: 'var(--bg-elevated)', opacity: r.include ? 1 : 0.72,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: r.include ? 12 : 0, flexWrap: 'wrap' }}>
                    <SelectBox checked={r.include} onChange={() => setRows(rs => rs.map(x => (x.key === r.key ? { ...x, include: !x.include } : x)))}
                      label={`Να μπει: ${r.address || r.atak || `ακίνητο ${i + 1}`}`} />
                    <span style={{ ...TT.body, fontWeight: 600, flex: 1, minWidth: 0 }} className="po-elide">
                      {r.address || `Ακίνητο ${i + 1}`}{r.municipality ? ` · ${r.municipality}` : ''}
                    </span>
                    {tag}
                    {r.check && <Badge tone="warning">Έλεγξέ το</Badge>}
                  </div>
                  {r.include && (
                    <>
                      {r.match.status === 'maybe' && (
                        <div style={{ ...formGrid(200, 320), marginBottom: 12 }}>
                          <CustomSelect label="Είναι ακίνητο που έχεις ήδη;" value={r.same === null ? '' : r.same ? 'same' : 'other'}
                            onChange={v => patch(r.key, { same: v === 'same' ? true : v === 'other' ? false : null })}
                            options={[{ value: 'same', label: `Είναι το «${target?.name ?? ''}»` }, { value: 'other', label: 'Είναι άλλο ακίνητο' }]} />
                        </div>
                      )}
                      {existingIdOf(r) && <p style={{ ...TT.caption, margin: '0 0 12px' }}>{`Συμπληρώνονται μόνο τα κενά πεδία του «${target?.name ?? ''}».`}</p>}
                      <div style={formGrid(140, 200)}>
                        {isNew(r) && <TextInput label="Όνομα" value={r.name} onChange={v => patch(r.key, { name: v })} />}
                        <TextInput label="Διεύθυνση" value={r.address} onChange={v => patch(r.key, { address: v })} />
                        <TextInput label="ΑΤΑΚ" value={r.atak} onChange={v => patch(r.key, { atak: atakDigits(v) })} placeholder={`${ATAK_DIGITS} ψηφία`} mono inputMode="numeric" />
                        <NumberInput label="Επιφάνεια" suffix="τ.μ." value={r.sqm} onChange={v => patch(r.key, { sqm: v })} />
                        <NumberInput label="Ποσοστό" suffix="%" value={r.pct} onChange={v => patch(r.key, { pct: v })} max={100} />
                        <TextInput label="Όροφος" value={r.floor} onChange={v => patch(r.key, { floor: v })} />
                      </div>
                      {(r.kind || r.tax != null) && (
                        <p style={{ ...TT.caption, margin: '10px 0 0' }}>
                          {[r.kind, r.tax != null ? `φόρος ακινήτου ${fe(r.tax)}` : ''].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {atakBad && <p style={{ ...TT.caption, color: 'var(--negative)', margin: '8px 0 0' }}>{`Ο ΑΤΑΚ είναι ${ATAK_DIGITS} ψηφία.`}</p>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {unanswered > 0 && <p style={{ ...TT.caption, margin: 0 }}>{`Απάντησε για ${unanswered} ${plural(unanswered, 'ακίνητο', 'ακίνητα')} αν υπάρχει ήδη.`}</p>}
        </div>
      )}

      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
          <h3 style={{ ...TT.h2, margin: 0 }}>Έτοιμο</h3>
          <p style={{ ...TT.body, margin: 0 }}>{summary}</p>
          {skipped > 0 && (
            <InfoBanner tone="info">
              <span>{`${skipped} ${plural(skipped, 'ακίνητο δεν μπήκε, γιατί το πακέτο σου δεν το χωρά', 'ακίνητα δεν μπήκαν, γιατί το πακέτο σου δεν τα χωρά')}.`}</span>{' '}
              <Btn variant="ghost" onClick={onUpgrade}>Δες τα πακέτα</Btn>
            </InfoBanner>
          )}
          {undoable && <p style={{ ...TT.caption, margin: 0 }}>{`Η εισαγωγή αναιρείται για ${IMPORT_UNDO_HOURS}\u00a0ώρες, εδώ ή από το ίδιο παράθυρο.`}</p>}
        </div>
      )}
    </Modal>
  );
}
