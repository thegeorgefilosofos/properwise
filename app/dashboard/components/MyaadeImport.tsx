'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΟ myAADE: ΤΑ ΑΚΙΝΗΤΑ ΚΑΙ Ο ΕΝΦΙΑ ΑΠΟ ΕΝΑ PDF
// ─────────────────────────────────────────────────────────────────────────
// Ο χρήστης ανεβάζει την πράξη ΕΝΦΙΑ του myAADE. Το κείμενο βγαίνει ΣΤΗ
// ΣΥΣΚΕΥΗ του, σε Web Worker (lib/myaade/readPdf.ts). Το διαβάζει ο
// αναλυτής κανόνων (lib/myaade/enfiaAct.ts): χωρίς AI, χωρίς αποστολή του
// αρχείου πουθενά. Το PDF δεν αποθηκεύεται.
//
// ΤΙΠΟΤΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΡΙΝ ΤΟ ΔΕΙ Ο ΧΡΗΣΤΗΣ. Κάθε ακίνητο φαίνεται σε μία
// συμπαγή γραμμή με την κατάστασή του· τα πεδία ανοίγουν με «Επεξεργασία». Η
// καταχώρηση και η αναίρεση ζουν στο lib/myaade/commit.ts, οι έλεγχοι στο
// lib/myaade/review.ts και οι οθόνες στο MyaadeSteps.tsx.
//
// ΤΟ ΚΟΥΜΠΙ ΔΕΝ ΣΒΗΝΕΙ ΧΩΡΙΣ ΛΟΓΟ. Είναι πάντα το κανονικό κύριο κουμπί. Όσο
// κάτι λείπει, ο λόγος γράφεται δίπλα του (aria-describedby) και το πάτημα
// οδηγεί στο σημείο που θέλει απάντηση.
//
// ΤΟ ΟΡΙΟ ΤΟΥ ΠΑΚΕΤΟΥ (απόφαση ιδιοκτήτη 30/10/2026): φαίνονται όλα όσα
// βρέθηκαν, τσεκαρισμένα είναι όσα χωρούν και ο δρόμος για τα υπόλοιπα είναι
// το υπάρχον παράθυρο αναβάθμισης, μέσω του `onUpgrade`.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Btn, Badge, Modal, fe } from '@/components/Theme';
import { NumberInput, CustomSelect } from './UIComponents';
import { notify, notifyError } from '@/components/Toast';
import { MAX_SCAN_MB } from './scanDoc';
import * as propertiesData from '@/lib/data/properties';
import { read } from '@/lib/data/read';
import { grDate } from '@/lib/core/format';
import { athensToday, athensParts } from '@/lib/core/time';
import { plural } from '@/lib/core/greek';
import { enfiaInstalments } from '@/lib/tools/enfiaSchedule';
import { track, PRODUCT_EVENTS } from '@/lib/analytics/events';
import { parseEnfiaAct } from '@/lib/myaade/enfiaAct';
import { readPdfText, PdfReadError } from '@/lib/myaade/readPdf';
import type { KnownProperty } from '@/lib/myaade/match';
import { freeSlots } from '@/lib/myaade/planLimit';
import { buildDrafts, deriveReview, commitRowOf, preselectOwner, toMoneyText, singleFlight, SELF_OWNER, type Draft, type KnownOwner } from '@/lib/myaade/review';
import { commitImport, undoImport, lastUndoable, importsLeft, undoUntilLabel, MYAADE_DAILY_IMPORTS, IMPORT_UNDO_HOURS, type ImportBatch } from '@/lib/myaade/commit';
import type { MyAadeImport } from '@/lib/myaade/types';
import { CenterState, DoneView, DropZone, MyaadeSteps, Note, PropertyRow, ReadProgress, SelectAll, MYAADE_CSS, type DoneSummary } from './MyaadeSteps';

// Κάθε αποτυχία: τίτλος μιας γραμμής στην οθόνη, η εξήγηση πίσω από το ⓘ.
// ΜΙΑ ΠΡΟΤΑΣΗ ΣΤΗΝ ΟΘΟΝΗ, Η ΕΞΗΓΗΣΗ ΣΤΟ ⓘ.
type Failure = { title: string; hint: string; info?: string };
const WANT_ACT = 'Χρειαζόμαστε την πράξη ΕΝΦΙΑ, όπως την αποθηκεύεις από το myAADE.';
const PDF_FAILURE: Record<'encrypted' | 'no_text' | 'not_pdf', Failure> = {
  not_pdf: { title: 'Δεν είναι PDF', hint: WANT_ACT },
  encrypted: { title: 'Το PDF είναι κλειδωμένο', hint: 'Κατέβασέ το ξανά από το myAADE, χωρίς κωδικό.' },
  no_text: { title: 'Είναι εικόνα, όχι το PDF', hint: 'Χρειαζόμαστε το PDF του myAADE, όχι φωτογραφία ή σάρωση.' },
};

type Step = 'pick' | 'reading' | 'review' | 'saving' | 'done';

export default function MyaadeImport({ userId, limit, onUpgrade, onClose, onSaved, onOpenCalendar, initialDoc }: {
  userId: string;
  /** Το όριο ακινήτων του πακέτου (`propertyLimit`). */
  limit: number;
  /** Ανοίγει το υπάρχον παράθυρο αναβάθμισης. */
  onUpgrade: () => void;
  onClose: () => void;
  /** Μετά την καταχώρηση ή την αναίρεση: ξαναφορτώνει τα ακίνητα. */
  onSaved: () => void | Promise<void>;
  /** «Δες τις δόσεις στο ημερολόγιο». */
  onOpenCalendar?: () => void;
  /**
   * Πράξη ήδη διαβασμένη: το παράθυρο ανοίγει στην προεπισκόπηση. Τη δίνει ο
   * πάγκος διάταξης (scripts/perf-bench/mobile.tsx), ώστε οι σαρωτές να
   * περνούν από ΑΥΤΟ το component και όχι από αντίγραφό του.
   */
  initialDoc?: MyAadeImport;
}) {
  const supabase = useMemo(() => createClient(), []);
  const inputId = useId();
  const reasonId = useId();
  const [step, setStep] = useState<Step>('pick');
  const [progress, setProgress] = useState({ page: 0, pages: 0 });
  const [status, setStatus] = useState('');
  const [failure, setFailure] = useState<Failure | null>(null);
  const [doc, setDoc] = useState<MyAadeImport | null>(null);
  const [rows, setRows] = useState<Draft[]>([]);
  const [year, setYear] = useState('');
  const [total, setTotal] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerFromAfm, setOwnerFromAfm] = useState(false);
  const [known, setKnown] = useState<KnownProperty[] | null>(null);
  const [owners, setOwners] = useState<KnownOwner[]>([]);
  const [ownerAfms, setOwnerAfms] = useState<string[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [undoable, setUndoable] = useState<ImportBatch | null>(null);
  const [summary, setSummary] = useState<DoneSummary | null>(null);

  // ── ΤΙ ΞΕΡΕΙ ΗΔΗ Η ΕΦΑΡΜΟΓΗ ────────────────────────────────────────────
  // Ξαναδιαβάζεται με το άνοιγμα και μετά από κάθε καταχώρηση ή αναίρεση.
  const [contextTick, setContextTick] = useState(0);
  const loadContext = () => setContextTick(t => t + 1);
  useEffect(() => {
    let live = true;
    void Promise.all([
      propertiesData.listWithError<KnownProperty>(supabase, userId, { columns: 'id,name,address,atak,sqm,ownership,floor' }),
      read<{ owner_afm: string | null }>(supabase.from('property_settings').select('owner_afm').eq('user_id', userId)),
      read<{ id: string; full_name: string; afm: string | null }>(supabase.from('clients').select('id,full_name,afm').eq('user_id', userId).eq('type', 'owner')),
      importsLeft(supabase, userId),
      lastUndoable(supabase, userId),
    ]).then(([list, afms, cards, n, last]) => {
      if (!live) return;
      if (list.error) { setFailure({ title: 'Τα ακίνητά σου δεν φόρτωσαν', hint: 'Κλείσε το παράθυρο και δοκίμασε ξανά.', info: 'Χωρίς αυτά δεν ξέρουμε ποια υπάρχουν ήδη.' }); setKnown([]); }
      else setKnown(list.rows);
      setOwnerAfms([...new Set(afms.rows.map(r => (r.owner_afm ?? '').trim()).filter(Boolean))]);
      setOwners(cards.rows.map(c => ({ id: c.id, name: c.full_name, afm: c.afm })));
      setLeft(n);
      setUndoable(last);
    });
    return () => { live = false; };
  }, [supabase, userId, contextTick]);

  const slots = freeSlots(limit, known?.length ?? 0);
  // Με ιδιοκτήτες στο Πελατολόγιο, η επιλογή «δικά μου» στέκει δίπλα τους.
  const ownerChoices = owners.length > 1 ? [...owners, { id: SELF_OWNER, name: 'Δικά μου ακίνητα', afm: null }] : owners;
  const review = deriveReview({ rows, year, total, slots, left, owners: ownerChoices, ownerId, dailyLimit: MYAADE_DAILY_IMPORTS, currentYear: athensParts().year });

  // ── ΑΠΟ ΤΟ PDF ΣΤΗΝ ΠΡΟΕΠΙΣΚΟΠΗΣΗ ──────────────────────────────────────
  const applyDoc = (d: MyAadeImport) => {
    setRows(buildDrafts(d, known ?? [], slots));
    setDoc(d);
    setYear(d.year ? String(d.year) : '');
    setTotal(toMoneyText(d.total));
    const pre = preselectOwner(owners, d.afm);
    setOwnerId(pre); setOwnerFromAfm(!!pre);
    setStep('review');
    setStatus(`Βρέθηκαν ${d.properties.length} ${plural(d.properties.length, 'ακίνητο', 'ακίνητα')}.`);
  };
  // Η πράξη που δόθηκε έτοιμη μπαίνει μόλις φορτωθούν τα ακίνητα: το ταίριασμα θέλει να τα ξέρει.
  const [initialApplied, setInitialApplied] = useState(false);
  if (initialDoc && !initialApplied && known !== null) { setInitialApplied(true); applyDoc(initialDoc); }

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setFailure(null);
    if (f.size > MAX_SCAN_MB * 1024 * 1024) { setFailure({ title: 'Πολύ μεγάλο αρχείο', hint: `Δεχόμαστε έως ${MAX_SCAN_MB} MB.`, info: 'Η πράξη του myAADE είναι λίγες σελίδες.' }); return; }
    setStep('reading'); setProgress({ page: 0, pages: 0 }); setStatus('Ανοίγω το PDF…');
    try {
      const res = await readPdfText(f, (page, pages) => {
        setProgress({ page, pages });
        setStatus(`Διαβάζω τη σελίδα ${page} από ${pages}…`);
      });
      if (res.failure) { setFailure(PDF_FAILURE[res.failure]); setStep('pick'); return; }
      setStatus('Αναγνωρίζω τα στοιχεία της πράξης…');
      const parsed = parseEnfiaAct(res.lines);
      if (parsed.status === 'unrecognized') {
        setFailure({ title: parsed.kind === 'e9' ? 'Αυτό είναι το Ε9' : 'Δεν το αναγνωρίσαμε', hint: parsed.kind === 'e9' ? 'Χρειαζόμαστε την πράξη ΕΝΦΙΑ, όχι το Ε9.' : WANT_ACT, info: parsed.reason });
        setStep('pick'); return;
      }
      applyDoc(parsed.doc);
    } catch (e) {
      // Μόνο το είδος της αποτυχίας: τίποτα από το περιεχόμενο δεν καταγράφεται.
      setFailure({ title: 'Το PDF δεν διαβάστηκε', hint: 'Κατέβασέ το ξανά από το myAADE και ξαναδοκίμασε.', info: e instanceof PdfReadError ? e.message : undefined });
      setStep('pick');
    }
  };

  const patch = (key: number, p: Partial<Draft>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p, check: false } : r)));
  const rowDomId = (key: number) => `mya-row-${key}`;

  /** Πηγαίνει τον χρήστη εκεί που θέλει απάντηση: το πρώτο εμπόδιο. */
  const [openKey, setOpenKey] = useState<number | null>(null);
  const showBlocker = () => {
    const first = review.blockers[0];
    if (!first) return;
    if (first.id === 'maybe') setOpenKey(review.chosen.find(r => r.match.status === 'maybe' && r.same === null)?.key ?? null);
    const target = first.id === 'maybe' ? rowDomId(review.chosen.find(r => r.match.status === 'maybe' && r.same === null)?.key ?? -1)
      : first.id === 'owner' ? 'mya-owner' : first.id === 'excess' ? 'mya-plan' : first.id === 'total' || first.id === 'year' ? 'mya-act' : null;
    const el = target ? document.getElementById(target) : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Το ίδιο το πεδίο, όχι το ⓘ της ετικέτας του (που είναι το πρώτο κουμπί).
    (el?.querySelector('input, button:not([aria-label="Επεξήγηση"])') as HTMLElement | null)?.focus({ preventScroll: true });
    setStatus(first.text);
  };

  const doSave = async () => {
    if (step !== 'review' || !doc) return;
    if (review.blockers.length) { showBlocker(); return; }
    setStep('saving'); setStatus('Αποθηκεύονται τα ακίνητα και ο ΕΝΦΙΑ…');
    const res = await commitImport(supabase, {
      userId, year: review.yearN, total: review.writesTotal ? review.totalN : null, foundCount: rows.length,
      rows: review.chosen.map(commitRowOf), known: known ?? [], docDate: doc.issueDate ?? athensToday(),
      clientId: ownerId && ownerId !== SELF_OWNER ? ownerId : null,
    });
    if (!res.ok) {
      setStep('review'); setStatus('');
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
    const wrote = res.statement === 'inserted' || res.statement === 'updated' || res.statement === 'same';
    setSummary({
      created: res.created.length, filled: res.filled,
      enfia: wrote && review.writesTotal ? { year: review.yearN as number, total: review.totalN as number, instalments: enfiaInstalments(review.totalN as number, review.yearN as number).length } : null,
      leftOut: review.leftOut,
    });
    setStep('done'); setStatus('Η εισαγωγή ολοκληρώθηκε.');
    await onSaved();
    loadContext();
  };

  // ΕΝΑ ΠΑΤΗΜΑ, ΜΙΑ ΚΑΤΑΧΩΡΗΣΗ. Το `step` αλλάζει στην επόμενη απόδοση· δύο
  // κλικ στο ίδιο καρέ το βλέπουν και τα δύο «review». Το `singleFlight` κρατά
  // τη δεύτερη πάνω στην πρώτη. Η πιο πρόσφατη `doSave` ζει σε ref· η πύλη
  // στήνεται στο πρώτο πάτημα, όχι στην απόδοση.
  const latestSave = useRef(doSave);
  useEffect(() => { latestSave.current = doSave; });
  const gate = useRef<(() => Promise<void>) | null>(null);
  const save = () => (gate.current ??= singleFlight(() => latestSave.current()))();

  const undo = async (batch: ImportBatch | null) => {
    if (!batch) return;
    setStatus('Αναιρείται η εισαγωγή…');
    const res = await undoImport(supabase, userId, batch);
    setStatus('');
    if (!res.ok) {
      notifyError(res.reason === 'expired' ? `Η αναίρεση ισχύει ${IMPORT_UNDO_HOURS} ώρες από την εισαγωγή.` : 'Η αναίρεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.');
      loadContext();
      return;
    }
    notify(res.kept
      ? `Αναιρέθηκε. ${res.kept} ${plural(res.kept, 'ακίνητο έμεινε', 'ακίνητα έμειναν')}, γιατί έχουν ήδη δικά σου στοιχεία.`
      : 'Η εισαγωγή αναιρέθηκε.');
    await onSaved();
    loadContext();
    setStep('pick'); setDoc(null); setRows([]); setSummary(null);
  };

  const busy = step === 'saving' || step === 'reading' || status.startsWith('Αναιρείται');
  const requestClose = () => { if (!busy) onClose(); };
  const schedule = review.writesTotal ? enfiaInstalments(review.totalN as number, review.yearN as number) : [];
  const afmClash = !!doc?.afm && ownerAfms.length > 0 && !ownerAfms.includes(doc.afm) && !ownerFromAfm;
  const reason = step === 'review' && review.blockers.length ? review.blockers[0].text : null;
  const pickFile = () => document.getElementById(inputId)?.click();
  // Το κουμπί λέει τι θα γίνει: πόσα νέα, πόσα υπάρχοντα.
  const commitLabel = (() => {
    const parts = [
      review.newCount ? `${review.newCount} ${plural(review.newCount, 'νέο', 'νέα')}` : '',
      review.filledCount ? `${review.filledCount} ${plural(review.filledCount, 'υπάρχον', 'υπάρχοντα')}` : '',
    ].filter(Boolean);
    return parts.length ? `Καταχώρηση · ${parts.join(' · ')}` : 'Καταχώρηση';
  })();
  const notFit = review.excess || review.leftOut;

  return (
    <Modal open onClose={requestClose} size="md" title="Εισαγωγή από το myAADE"
      footerInfo={step === 'review' && reason ? <span id={reasonId}>{reason}</span>
        : step === 'done' && undoable ? `Αναίρεση έως ${undoUntilLabel(undoable.created_at)}` : undefined}
      footer={step === 'review' || step === 'saving' ? (
        <Btn variant="primary" onClick={() => void save()} disabled={step === 'saving'} describedBy={reason ? reasonId : undefined}>
          {step === 'saving' ? 'Καταχώρηση…' : commitLabel}
        </Btn>
      ) : step === 'done' ? (
        <>
          {undoable && <Btn variant="ghost" onClick={() => void undo(undoable)} disabled={busy}>Αναίρεση</Btn>}
          {summary?.enfia && onOpenCalendar
            ? <><Btn variant="secondary" onClick={onClose}>Τέλος</Btn><Btn variant="primary" onClick={onOpenCalendar}>Δες τις δόσεις</Btn></>
            : <Btn variant="primary" onClick={onClose}>Τέλος</Btn>}
        </>
      ) : undefined}>
      <style>{MYAADE_CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
        {/* Η πρόοδος και κάθε αλλαγή κατάστασης ανακοινώνονται· η εστίαση μένει όπου είναι. */}
        <p role="status" aria-live="polite" className="sr-only">{status}</p>

        {step === 'pick' && (failure ? (
          <CenterState tone="negative" title={failure.title} info={failure.info} action={{ label: 'Δοκίμασε άλλο αρχείο', onClick: pickFile }}>
            <span style={{ ...TT.body, color: 'var(--text-secondary)' }}>{failure.hint}</span>
          </CenterState>
        ) : left === 0 ? (
          <CenterState tone="warning" title="Έφτασες το όριο της ημέρας" info={`Χωρούν ${MYAADE_DAILY_IMPORTS} εισαγωγές σε 24 ώρες, μετρημένες στον διακομιστή. Δοκίμασε αργότερα.`} />
        ) : (
          <>
            {undoable && (
              <Note tone="info" info={`Σβήνει όσα ακίνητα δημιούργησε και δεν έχεις αλλάξει από τότε και επαναφέρει το προηγούμενο ποσό ΕΝΦΙΑ. Ισχύει έως ${undoUntilLabel(undoable.created_at)}.`}
                action={{ label: 'Αναίρεση', onClick: () => void undo(undoable) }}>
                {`Τελευταία εισαγωγή: ${grDate(undoable.created_at)}`}
              </Note>
            )}
            <MyaadeSteps />
          </>
        ))}
        {/* Το πεδίο του αρχείου ζει και στο σφάλμα: το «Δοκίμασε άλλο αρχείο» το ανοίγει. */}
        {step === 'pick' && left !== 0 && (failure ? <input id={inputId} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-label="Η πράξη ΕΝΦΙΑ σε PDF" onChange={e => { void readFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          : <DropZone onFile={f => void readFile(f)} disabled={known === null} inputId={inputId} />)}

        {step === 'reading' && <ReadProgress page={progress.page} pages={progress.pages} label={status} />}

        {(step === 'review' || step === 'saving') && doc && (
          <>
            {/* Η ΕΠΙΚΕΦΑΛΙΔΑ ΑΠΟ ΤΑ ΜΕΤΡΗΜΕΝΑ: κανένα ψηφίο δεν γράφεται με το χέρι. */}
            <h3 style={{ ...TT.h2, margin: 0 }}>
              {`Βρήκαμε ${rows.length} ${plural(rows.length, 'ακίνητο', 'ακίνητα')}`}
              {review.writesTotal ? ` και ΕΝΦΙΑ ${review.yearN}: ${fe(review.totalN as number)}` : ''}
            </h3>

            <section id="mya-act" aria-label="Η πράξη ΕΝΦΙΑ" style={{ border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: T.sp.lg, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
              <div style={{ display: 'flex', gap: T.sp.sm, alignItems: 'center' }}>
                <span style={{ ...TT.bodySm, fontWeight: 600, color: 'var(--text-primary)' }}>Η πράξη ΕΝΦΙΑ</span>
                {doc.corrective && <Badge tone="info">Διορθωτική</Badge>}
                {/* ΤΟ ΥΠΟΣΕΛΙΔΟ ΚΡΑΤΑ ΜΙΑ ΕΝΕΡΓΕΙΑ: με δύο κουμπιά η υπόδειξη έπεφτε σε δική της γραμμή. */}
                <span style={{ marginLeft: 'auto' }}><Btn variant="ghost" className="mya-disclose" onClick={() => { setStep('pick'); setDoc(null); setRows([]); setStatus(''); }} disabled={busy}>Άλλο αρχείο</Btn></span>
              </div>
              {/* ΕΝΑ ΠΛΕΓΜΑ, ΙΣΕΣ ΣΤΗΛΕΣ: έτος, ποσό και ιδιοκτήτης έχουν το ίδιο πλάτος. */}
              <div className={ownerChoices.length > 1 ? 'mya-fields mya-act mya-fields-3' : 'mya-fields mya-act'}>
                <NumberInput label="Έτος" value={year} onChange={setYear} min={2014} max={2100} />
                <NumberInput label="Ποσό για καταβολή" suffix="€" value={total} onChange={setTotal}
                  labelInfo={`Από αυτό βγαίνουν οι δόσεις, οι υπενθυμίσεις και το «Πλήρωσα». Αντικαθιστά κάθε άλλο σύνολο ΕΝΦΙΑ του ίδιου έτους στην εφαρμογή.${doc.paymentRef ? ` Ταυτότητα οφειλής: ${doc.paymentRef} (δεν αποθηκεύεται).` : ''}`} />
                {ownerChoices.length > 1 && (
                  <div id="mya-owner" className="mya-span">
                    <CustomSelect label="Ιδιοκτήτης" value={ownerId ?? ''} onChange={v => { setOwnerId(v || null); setOwnerFromAfm(false); }}
                      labelInfo={ownerFromAfm ? 'Προτάθηκε από τον ΑΦΜ της πράξης.' : 'Σε ποιον ιδιοκτήτη του Πελατολογίου ανήκει η πράξη. Τα νέα ακίνητα μπαίνουν στην καρτέλα του.'}
                      options={ownerChoices.map(o => ({ value: o.id, label: o.name }))} />
                  </div>
                )}
              </div>
              <span style={{ ...TT.caption, fontVariantNumeric: 'tabular-nums' }}>
                {schedule.length > 0 ? `${schedule.length} ${plural(schedule.length, 'δόση', 'δόσεις')} · πρώτη ${grDate(schedule[0].date)}`
                  : review.noDebt ? 'Χωρίς ποσό για πληρωμή · καμία δόση' : 'Χωρίς ποσό · καμία δόση'}
              </span>
            </section>

            {review.otherYear && review.yearN != null && (
              <Note tone="info" info={`Οι δόσεις μπαίνουν με τις ημερομηνίες του ${review.yearN}. Για τον φετινό ΕΝΦΙΑ, κατέβασε την πράξη του ${athensParts().year}.`}>
                {`Η πράξη είναι του ${review.yearN}.`}
              </Note>
            )}
            {afmClash && (
              <Note tone="warning" info="Ο ΑΦΜ της πράξης δεν είναι κανενός ιδιοκτήτη που έχεις στην εφαρμογή. Αν είναι δική σου, συνιδιοκτήτη ή πελάτη σου, συνέχισε. Αλλιώς διάλεξε άλλο αρχείο.">
                Η πράξη είναι σε άλλο ΑΦΜ.
              </Note>
            )}
            {doc.warnings.length > 0 && (
              <Note tone="warning" info={doc.warnings.join(' ')}>
                {`Έλεγξε ${doc.warnings.length} ${plural(doc.warnings.length, 'σημείο', 'σημεία')} της πράξης.`}
              </Note>
            )}
            {notFit > 0 && Number.isFinite(slots) && (
              <Note id="mya-plan" tone={review.excess > 0 ? 'warning' : 'info'} action={{ label: 'Δες τα πακέτα', onClick: onUpgrade }}>
                {`${notFit} ${plural(notFit, 'ακίνητο δεν χωρά', 'ακίνητα δεν χωρούν')} στο πακέτο σου.`}
              </Note>
            )}

            <SelectAll total={rows.length} chosen={review.chosen.length} onAll={on => setRows(rs => rs.map(r => ({ ...r, include: on })))} />
            <ul aria-label="Ακίνητα της πράξης" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
              {rows.map((r, i) => (
                <PropertyRow key={r.key} row={r} index={i} known={known ?? []} rowId={rowDomId(r.key)} forceOpen={openKey === r.key}
                  onToggle={() => setRows(rs => rs.map(x => (x.key === r.key ? { ...x, include: !x.include } : x)))}
                  onPatch={p => patch(r.key, p)} />
              ))}
            </ul>
          </>
        )}

        {step === 'done' && summary && <DoneView s={summary} onUpgrade={onUpgrade} />}
      </div>
    </Modal>
  );
}
