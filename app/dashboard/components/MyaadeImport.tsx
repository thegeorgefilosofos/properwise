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
import { useEffect, useId, useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Btn, Badge, Modal, formGrid, fe } from '@/components/Theme';
import { NumberInput, CustomSelect } from './UIComponents';
import { notify, notifyError } from '@/components/Toast';
import { MAX_SCAN_MB } from './scanDoc';
import * as propertiesData from '@/lib/data/properties';
import { read } from '@/lib/data/read';
import { grDate } from '@/lib/core/format';
import { athensToday } from '@/lib/core/time';
import { plural } from '@/lib/core/greek';
import { enfiaInstalments } from '@/lib/tools/enfiaSchedule';
import { track, PRODUCT_EVENTS } from '@/lib/analytics/events';
import { parseEnfiaAct } from '@/lib/myaade/enfiaAct';
import { readPdfText, PdfReadError } from '@/lib/myaade/readPdf';
import type { KnownProperty } from '@/lib/myaade/match';
import { freeSlots } from '@/lib/myaade/planLimit';
import { buildDrafts, deriveReview, commitRowOf, preselectOwner, toText, SELF_OWNER, type Draft, type KnownOwner } from '@/lib/myaade/review';
import { commitImport, undoImport, lastUndoable, importsLeft, undoUntilLabel, MYAADE_DAILY_IMPORTS, IMPORT_UNDO_HOURS, type ImportBatch } from '@/lib/myaade/commit';
import type { MyAadeImport } from '@/lib/myaade/types';
import { Callout, DoneView, DropZone, MyaadeSteps, PropertyRow, ReadProgress, SelectAll, MYAADE_CSS, type DoneSummary } from './MyaadeSteps';

const PDF_FAILURE: Record<'encrypted' | 'no_text' | 'not_pdf', { title: string; text: string }> = {
  not_pdf: { title: 'Το αρχείο δεν είναι PDF', text: 'Διάλεξε την πράξη ΕΝΦΙΑ όπως την αποθήκευσες από το myAADE.' },
  encrypted: { title: 'Το PDF είναι κλειδωμένο', text: 'Κατέβασέ το ξανά από το myAADE, χωρίς κωδικό.' },
  no_text: { title: 'Είναι φωτογραφία ή σάρωση', text: 'Χρειαζόμαστε το αρχείο που δίνει το myAADE, όχι φωτογραφία του. Ακολούθησε τα βήματα από πάνω.' },
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
  const [failure, setFailure] = useState<{ title: string; text: string } | null>(null);
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
      if (list.error) { setFailure({ title: 'Τα ακίνητά σου δεν διαβάστηκαν', text: 'Κλείσε το παράθυρο και δοκίμασε ξανά.' }); setKnown([]); }
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
  const review = deriveReview({ rows, year, total, slots, left, owners: ownerChoices, ownerId, dailyLimit: MYAADE_DAILY_IMPORTS });

  // ── ΑΠΟ ΤΟ PDF ΣΤΗΝ ΠΡΟΕΠΙΣΚΟΠΗΣΗ ──────────────────────────────────────
  const applyDoc = (d: MyAadeImport) => {
    setRows(buildDrafts(d, known ?? [], slots));
    setDoc(d);
    setYear(d.year ? String(d.year) : '');
    setTotal(toText(d.total));
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
    if (f.size > MAX_SCAN_MB * 1024 * 1024) { setFailure({ title: 'Το αρχείο είναι πολύ μεγάλο', text: `Η πράξη του myAADE είναι λίγες σελίδες· δεχόμαστε έως ${MAX_SCAN_MB} MB.` }); return; }
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
        setFailure({ title: parsed.kind === 'e9' ? 'Αυτό είναι το Ε9' : 'Δεν το αναγνωρίσαμε', text: parsed.reason + (parsed.kind === 'e9' ? '' : ' Βεβαιώσου ότι είναι η πράξη ΕΝΦΙΑ από το myAADE.') });
        setStep('pick'); return;
      }
      applyDoc(parsed.doc);
    } catch (e) {
      // Μόνο το είδος της αποτυχίας: τίποτα από το περιεχόμενο δεν καταγράφεται.
      setFailure({ title: 'Το PDF δεν διαβάστηκε', text: e instanceof PdfReadError ? e.message : 'Κατέβασέ το ξανά από το myAADE και ξαναδοκίμασε.' });
      setStep('pick');
    }
  };

  const patch = (key: number, p: Partial<Draft>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p, check: false } : r)));
  const rowDomId = (key: number) => `mya-row-${key}`;

  /** Πηγαίνει τον χρήστη εκεί που θέλει απάντηση: το πρώτο εμπόδιο. */
  const showBlocker = () => {
    const first = review.blockers[0];
    if (!first) return;
    const target = first.id === 'maybe' ? rowDomId(review.chosen.find(r => r.match.status === 'maybe' && r.same === null)?.key ?? -1)
      : first.id === 'owner' ? 'mya-owner' : first.id === 'excess' ? 'mya-plan' : first.id === 'total' || first.id === 'year' ? 'mya-act' : null;
    const el = target ? document.getElementById(target) : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el?.querySelector('button, input') as HTMLElement | null)?.focus({ preventScroll: true });
    setStatus(first.text);
  };

  const save = async () => {
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
      undoUntil: null,
    });
    setStep('done'); setStatus('Η εισαγωγή ολοκληρώθηκε.');
    await onSaved();
    loadContext();
  };

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

  return (
    <Modal open onClose={requestClose} size="lg" icon={<FileUp size={19} />}
      title="Εισαγωγή από το myAADE"
      subtitle="Τα ακίνητα και ο ΕΝΦΙΑ σου από την πράξη ΕΝΦΙΑ, χωρίς πληκτρολόγηση"
      footerInfo={reason ? <span id={reasonId}>{reason}</span> : undefined}
      footer={step === 'review' || step === 'saving' ? (
        <>
          <Btn variant="secondary" onClick={() => { setStep('pick'); setDoc(null); setRows([]); setStatus(''); }} disabled={busy}>Άλλο αρχείο</Btn>
          <Btn variant="primary" onClick={() => void save()} disabled={step === 'saving'} describedBy={reason ? reasonId : undefined}>
            {step === 'saving' ? 'Αποθήκευση…' : review.newCount ? `Πρόσθεσε ${review.newCount} ${plural(review.newCount, 'ακίνητο', 'ακίνητα')}` : 'Αποθήκευση'}
          </Btn>
        </>
      ) : step === 'done' ? (
        <>
          <Btn variant="secondary" onClick={onClose}>Τέλος</Btn>
          {summary?.enfia && onOpenCalendar && <Btn variant="primary" onClick={onOpenCalendar}>Δες τις δόσεις στο ημερολόγιο</Btn>}
        </>
      ) : undefined}>
      <style>{MYAADE_CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
        {/* Η πρόοδος και κάθε αλλαγή κατάστασης ανακοινώνονται· η εστίαση μένει όπου είναι. */}
        <p role="status" aria-live="polite" className="sr-only">{status}</p>

        {step === 'pick' && (
          <>
            {undoable && (
              <Callout tone="info" title="Η τελευταία εισαγωγή αναιρείται ακόμη" action={{ label: 'Αναίρεση', onClick: () => void undo(undoable) }}>
                {`Έγινε στις ${grDate(undoable.created_at)}. Η αναίρεση ισχύει έως ${undoUntilLabel(undoable.created_at)}.`}
              </Callout>
            )}
            <MyaadeSteps />
            {failure && <Callout tone="negative" title={failure.title} action={{ label: 'Διάλεξε άλλο αρχείο', onClick: () => document.getElementById(inputId)?.click() }}>{failure.text}</Callout>}
            {left === 0
              ? <Callout tone="warning" title="Έφτασες το όριο της ημέρας">{`Χωρούν ${MYAADE_DAILY_IMPORTS} εισαγωγές σε 24\u00a0ώρες. Δοκίμασε αργότερα.`}</Callout>
              : <DropZone onFile={f => void readFile(f)} disabled={known === null} inputId={inputId} />}
          </>
        )}

        {step === 'reading' && <ReadProgress page={progress.page} pages={progress.pages} label={status} />}

        {(step === 'review' || step === 'saving') && doc && (
          <>
            {/* Η ΕΠΙΚΕΦΑΛΙΔΑ ΑΠΟ ΤΑ ΜΕΤΡΗΜΕΝΑ: κανένα ψηφίο δεν γράφεται με το χέρι. */}
            <h3 style={{ ...TT.h2, margin: 0 }}>
              {`Βρήκαμε ${rows.length} ${plural(rows.length, 'ακίνητο', 'ακίνητα')}`}
              {review.writesTotal ? ` και ΕΝΦΙΑ ${review.yearN}: ${fe(review.totalN as number)}` : ''}
            </h3>

            <section id="mya-act" aria-label="Η πράξη ΕΝΦΙΑ" style={{ border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: T.sp.lg, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
              <div style={{ display: 'flex', gap: T.sp.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ ...TT.body, fontWeight: 600 }}>Η πράξη ΕΝΦΙΑ</span>
                {doc.corrective && <Badge tone="info">Διορθωτική</Badge>}
              </div>
              <div style={formGrid(160, 220)}>
                <NumberInput label="Έτος" value={year} onChange={setYear} min={2014} max={2100} />
                <NumberInput label="Ποσό για καταβολή" suffix="€" value={total} onChange={setTotal} />
              </div>
              {ownerChoices.length > 1 && (
                <div id="mya-owner" style={formGrid(200, 360)}>
                  <CustomSelect label="Ποιου ιδιοκτήτη είναι η πράξη;" value={ownerId ?? ''} onChange={v => { setOwnerId(v || null); setOwnerFromAfm(false); }}
                    options={ownerChoices.map(o => ({ value: o.id, label: o.name }))} />
                </div>
              )}
              {ownerFromAfm && <span style={{ ...TT.caption }}>Ο ιδιοκτήτης προτάθηκε από τον ΑΦΜ της πράξης.</span>}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: T.sp.xs }}>
                {schedule.length > 0 && <li style={{ ...TT.caption }}>{`${schedule.length} ${plural(schedule.length, 'δόση', 'δόσεις')}, η πρώτη έως ${grDate(schedule[0].date)}. Οι υπενθυμίσεις και το «Πλήρωσα» ενημερώνονται μόνα τους.`}</li>}
                {doc.paymentRef && <li style={{ ...TT.caption }}>{'Ταυτότητα οφειλής '}<span style={{ fontFamily: T.font.num }}>{doc.paymentRef}</span>. Δεν αποθηκεύεται.</li>}
                <li style={{ ...TT.caption }}>Το ποσό αντικαθιστά κάθε άλλο σύνολο ΕΝΦΙΑ του ίδιου έτους στην εφαρμογή.</li>
              </ul>
            </section>

            {afmClash && (
              <Callout tone="warning" title="Η πράξη είναι σε άλλο ΑΦΜ">
                Ο ΑΦΜ της πράξης δεν είναι κανενός ιδιοκτήτη που έχεις στην εφαρμογή. Αν είναι δική σου, συνιδιοκτήτη ή πελάτη σου, συνέχισε. Αλλιώς διάλεξε άλλο αρχείο.
              </Callout>
            )}
            {doc.warnings.map(w => <Callout key={w} tone="warning">{w}</Callout>)}
            {(review.excess > 0 || review.leftOut > 0) && Number.isFinite(slots) && (
              <Callout id="mya-plan" tone={review.excess > 0 ? 'warning' : 'info'} action={{ label: 'Δες τα πακέτα', onClick: onUpgrade }}>
                {review.excess > 0
                  ? review.blockers.find(b => b.id === 'excess')?.text
                  : `${review.leftOut} ${plural(review.leftOut, 'ακίνητο μένει εκτός, γιατί το πακέτο σου δεν το χωρά', 'ακίνητα μένουν εκτός, γιατί το πακέτο σου δεν τα χωρά')}.`}
              </Callout>
            )}

            <SelectAll total={rows.length} chosen={review.chosen.length} onAll={on => setRows(rs => rs.map(r => ({ ...r, include: on })))} />
            <ul aria-label="Ακίνητα της πράξης" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
              {rows.map((r, i) => (
                <PropertyRow key={r.key} row={r} index={i} overPlan={r.overPlan} known={known ?? []} rowId={rowDomId(r.key)}
                  onToggle={() => setRows(rs => rs.map(x => (x.key === r.key ? { ...x, include: !x.include } : x)))}
                  onPatch={p => patch(r.key, p)} />
              ))}
            </ul>
          </>
        )}

        {/* Η ΠΡΟΘΕΣΜΙΑ ΤΗΣ ΑΝΑΙΡΕΣΗΣ ΑΠΟ ΤΗΝ ΚΑΤΑΓΡΑΦΗ ΤΗΣ ΒΑΣΗΣ, όχι από το ρολόι του περιηγητή. */}
        {step === 'done' && summary && <DoneView s={{ ...summary, undoUntil: undoable ? undoUntilLabel(undoable.created_at) : null }}
          onUpgrade={onUpgrade} onUndo={() => void undo(undoable)} busy={busy} />}
      </div>
    </Modal>
  );
}
