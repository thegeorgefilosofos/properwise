'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ Ε2 ΜΠΑΙΝΕΙ ΜΙΑ ΦΟΡΑ ΚΑΙ ΜΕΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΥΠΗΡΧΕ. Ενα πεδίο ανά ακίνητο, «Το έντυπο λέει», που κρατούσε ένα νούμερο
// μέχρι να κλείσει η οθόνη. Η σύγκριση ξαναγινόταν από την αρχή κάθε φορά και ο
// λογιστής δεν την έβλεπε ποτέ.
//
// ΤΙ ΚΑΝΕΙ ΤΩΡΑ. Τρεις δρόμοι για το ίδιο αποτέλεσμα: το PDF που τύπωσε ο
// χρήστης από το myAADE, ο πίνακας αντιγραμμένος από τη σελίδα, ή καταχώρηση με
// το χέρι με τους ΑΤΑΚ της εφαρμογής ήδη στη θέση τους. ΚΑΘΕ γραμμή φαίνεται
// πριν αποθηκευτεί, με ό,τι δεν στέκει γραμμένο από κάτω της. Τίποτα δεν
// μπαίνει στη βάση επειδή «έτσι το διάβασε η μηχανή».
//
// ΤΟ ΙΔΙΟ ΠΑΡΑΘΥΡΟ ΓΙΑ ΙΔΙΟΚΤΗΤΗ ΚΑΙ ΛΟΓΙΣΤΗ. Η βάση γράφει ποιος ανέβασε και
// αρνείται τον λογιστή που δεν έχει πια σύνδεση· η οθόνη δεν χρειάζεται να ξέρει.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useRef, useState } from 'react';
import { FileUp, Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Btn, IconBtn, Badge, InfoBanner, Modal, formGrid, fe } from '@/components/Theme';
import { TextInput, NumberInput, Textarea, SegmentControl, CustomSelect } from './UIComponents';
import { notify, notifyError } from '@/components/Toast';
import { parseAadeE2, validateAadeRow, blockingProblem, type AadeE2Row, type E2IncomeColumn, type ParsedE2Row } from '@/lib/tax/aadeE2';
import { replacePrefilled, uploadAadeOriginal, type StoredE2Row } from '@/lib/data/e2Prefilled';
import { isValidAfm, afmDigits } from '@/lib/core/greek';
import { atakDigits } from '@/lib/property/atak';

type Source = 'pdf' | 'paste' | 'manual';

/** Μία γραμμή όπως τη διορθώνει ο χρήστης: κείμενο, μέχρι να αποθηκευτεί. */
interface Draft {
  id: number;
  rowNo: number | null;
  atak: string;
  tenantAfm: string;
  tenantName: string;
  address: string;
  category: string;
  from: string | null;
  to: string | null;
  months: string;
  monthly: string;
  pct: string;
  gross: string;
  column: E2IncomeColumn;
  decl: string;
  /** Σημαδεμένη από την ανάγνωση: κάποιο πεδίο βγήκε από τη θέση του. */
  check: boolean;
  /** Ο χρήστης την κοίταξε και την άλλαξε: η σημαία της ανάγνωσης σβήνει. */
  touched: boolean;
}

const str = (n: number | null | undefined): string => (n == null ? '' : String(n));
const numOrNull = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

let seq = 0;
const toDraft = (r: AadeE2Row, check = false): Draft => ({
  id: ++seq, rowNo: r.rowNo, atak: r.atak ?? '', tenantAfm: r.tenantAfm ?? '', tenantName: r.tenantName ?? '',
  address: r.address ?? '', category: r.category ?? '', from: r.from, to: r.to,
  months: str(r.months), monthly: str(r.monthlyRent), pct: str(r.ownershipPct), gross: str(r.gross || null),
  column: r.incomeColumn, decl: r.leaseDeclRef ?? '', check, touched: false,
});
const fromDraft = (d: Draft, i: number): AadeE2Row => ({
  rowNo: d.rowNo ?? i + 1,
  atak: atakDigits(d.atak) || null,
  address: d.address.trim() || null,
  category: d.category.trim() || null,
  tenantName: d.tenantName.trim() || null,
  tenantAfm: afmDigits(d.tenantAfm) || null,
  from: d.from, to: d.to,
  months: numOrNull(d.months),
  monthlyRent: numOrNull(d.monthly),
  ownershipPct: numOrNull(d.pct),
  gross: numOrNull(d.gross) ?? 0,
  incomeColumn: d.column,
  leaseDeclRef: d.decl.replace(/\s/g, '') || null,
});

const COLUMN_OPTIONS = [
  { value: '13', label: 'Στ. 13 · Εκμίσθωση' },
  { value: '14', label: 'Στ. 14 · Δωρεάν παραχώρηση' },
  { value: '15', label: 'Στ. 15 · Ιδιοχρησιμοποίηση' },
  { value: '16', label: 'Στ. 16 · Ανείσπρακτα' },
];

const PDF_FAILURE: Record<'encrypted' | 'no_text' | 'not_pdf', string> = {
  encrypted: 'Το PDF είναι κλειδωμένο με κωδικό και δεν διαβάζεται. Αντέγραψε τον πίνακα από το myAADE και επικόλλησέ τον.',
  no_text: 'Το PDF δεν έχει κείμενο: είναι σάρωση ή φωτογραφία. Αντέγραψε τον πίνακα από το myAADE ή συμπλήρωσε τις γραμμές με το χέρι.',
  not_pdf: 'Το αρχείο δεν είναι PDF.',
};

export interface KnownProperty { atak: string | null; name: string }

export default function E2PrefilledImport({ ownerId, year, afms, initialAfm, known, existing, onClose, onSaved }: {
  ownerId: string;
  year: number;
  /** Τα ΑΦΜ υπόχρεων που ξέρει η εφαρμογή για αυτόν τον ιδιοκτήτη. */
  afms: readonly string[];
  initialAfm?: string;
  /** Τα ακίνητα της εφαρμογής, για να ξεκινά η χειροκίνητη καταχώρηση με τους ΑΤΑΚ τους. */
  known: readonly KnownProperty[];
  /** Οι αποθηκευμένες γραμμές του επιλεγμένου ΑΦΜ, για διόρθωση. */
  existing?: readonly StoredE2Row[];
  onClose: () => void;
  onSaved: (count: number, ownerAfm: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<'pick' | 'review' | 'saving'>('pick');
  const [source, setSource] = useState<Source>('pdf');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Draft[]>([]);
  const [afm, setAfm] = useState(initialAfm ?? afms[0] ?? '');
  const [detected, setDetected] = useState<{ afm: string | null; year: number | null; unread: number }>({ afm: null, year: null, unread: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  // ── ΑΠΟ ΤΟ ΚΕΙΜΕΝΟ ΣΤΙΣ ΓΡΑΜΜΕΣ ──────────────────────────────────────────
  const fromText = (raw: string) => {
    const r = parseAadeE2(raw);
    if (!r.rows.length) {
      setError(r.unread.length
        ? `Βρέθηκαν ${r.unread.length} γραμμές με ποσά, αλλά καμία με ΑΤΑΚ, ΑΦΜ μισθωτή ή ημερομηνίες. Δοκίμασε την καταχώρηση με το χέρι.`
        : 'Δεν βρέθηκε πίνακας Ε2 στο κείμενο. Αντέγραψε ολόκληρο τον πίνακα, μαζί με τις επικεφαλίδες.');
      return;
    }
    setError('');
    setDetected({ afm: r.ownerAfm, year: r.year, unread: r.unread.length });
    if (r.ownerAfm && afms.includes(r.ownerAfm)) setAfm(r.ownerAfm);
    else if (r.ownerAfm && !afm) setAfm(r.ownerAfm);
    setRows(r.rows.map((x: ParsedE2Row) => toDraft(x, x.check)));
    setStep('review');
  };

  const readPdf = async (f: File) => {
    setReading(true); setError(''); setFile(f);
    try {
      const { extractPdfText } = await import('@/lib/pdf/pdfText');
      const res = extractPdfText(new Uint8Array(await f.arrayBuffer()));
      if (res.failure) { setError(PDF_FAILURE[res.failure]); return; }
      fromText(res.lines.join('\n'));
    } catch (e) {
      console.error('[E2PrefilledImport] PDF:', e);
      setError('Το PDF δεν διαβάστηκε. Αντέγραψε τον πίνακα από το myAADE και επικόλλησέ τον.');
    } finally { setReading(false); }
  };

  const startManual = () => {
    setError('');
    setDetected({ afm: null, year: null, unread: 0 });
    const base = existing?.length
      ? existing.map(r => toDraft(r))
      : known.filter(k => k.atak).map(k => ({ ...toDraft({ rowNo: null, atak: k.atak, address: k.name, category: null, tenantName: null, tenantAfm: null, from: null, to: null, months: null, monthlyRent: null, ownershipPct: null, gross: 0, incomeColumn: 13, leaseDeclRef: null }) }));
    setRows(base.length ? base : [toDraft({ rowNo: null, atak: null, address: null, category: null, tenantName: null, tenantAfm: null, from: null, to: null, months: null, monthlyRent: null, ownershipPct: null, gross: 0, incomeColumn: 13, leaseDeclRef: null })]);
    setFile(null);
    setStep('review');
  };

  const patch = (id: number, p: Partial<Draft>) => setRows(rs => rs.map(r => (r.id === id ? { ...r, ...p, touched: true } : r)));
  const remove = (id: number) => setRows(rs => rs.filter(r => r.id !== id));
  const addRow = () => setRows(rs => [...rs, toDraft({ rowNo: null, atak: null, address: null, category: null, tenantName: null, tenantAfm: null, from: null, to: null, months: null, monthlyRent: null, ownershipPct: null, gross: 0, incomeColumn: 13, leaseDeclRef: null })]);

  // ── ΕΛΕΓΧΟΙ ΠΡΙΝ ΤΗΝ ΑΠΟΘΗΚΕΥΣΗ ──────────────────────────────────────────
  const finals = rows.map(fromDraft);
  const blocking = finals.map(blockingProblem);
  const firstBlocking = blocking.findIndex(Boolean);
  const afmOk = isValidAfm(afm);
  const yearClash = detected.year != null && detected.year !== year;
  const afmClash = !!detected.afm && afmOk && detected.afm !== afm;
  const canSave = rows.length > 0 && firstBlocking < 0 && afmOk && !yearClash && step === 'review';

  const save = async () => {
    if (!canSave) return;
    setStep('saving');
    let filePath: string | null = null;
    if (file && source === 'pdf') {
      const up = await uploadAadeOriginal(supabase, ownerId, year, file, file.name);
      // ΤΟ ΠΡΩΤΟΤΥΠΟ ΕΙΝΑΙ ΤΕΚΜΗΡΙΟ, ΟΧΙ ΠΡΟΫΠΟΘΕΣΗ. Αν δεν ανέβει, οι γραμμές
      // αποθηκεύονται και ο χρήστης μαθαίνει ότι το αρχείο έμεινε στη συσκευή του.
      if ('error' in up) notifyError('Το PDF δεν ανέβηκε· οι γραμμές αποθηκεύονται χωρίς το πρωτότυπο.');
      else filePath = up.path;
    }
    const res = await replacePrefilled(supabase, { ownerId, year, ownerAfm: afm, source, file: filePath, rows: finals });
    if (!res.ok) {
      setStep('review');
      notifyError(res.reason === 'not_linked'
        ? 'Η σύνδεση με τον ιδιοκτήτη δεν ισχύει πια. Ζήτησε νέο σύνδεσμο.'
        : 'Οι γραμμές δεν αποθηκεύτηκαν. Δοκίμασε ξανά.');
      return;
    }
    notify(`Αποθηκεύτηκαν ${res.count} ${res.count === 1 ? 'γραμμή' : 'γραμμές'} του προσυμπληρωμένου ${year}`);
    onSaved(res.count, afm);
  };

  const requestClose = () => { if (step !== 'saving') onClose(); };
  const checkCount = rows.filter(r => r.check && !r.touched).length;

  return (
    <Modal open onClose={requestClose} size="lg"
      icon={<FileUp size={19} />}
      title={`Προσυμπληρωμένο Ε2 · ${year}`}
      subtitle="Οι γραμμές του Πίνακα I όπως τις δείχνει το myAADE, για σύγκριση με την εφαρμογή"
      footer={step === 'pick' ? (
        source === 'paste'
          ? <Btn variant="primary" disabled={!text.trim()} onClick={() => fromText(text)}>Ανάλυση</Btn>
          : source === 'manual'
            ? <Btn variant="primary" onClick={startManual}>Συνέχεια</Btn>
            : undefined
      ) : (
        <>
          <Btn variant="secondary" onClick={() => setStep('pick')} disabled={step === 'saving'}>Πίσω</Btn>
          <Btn variant="primary" onClick={() => void save()} disabled={!canSave}>
            {step === 'saving' ? 'Αποθήκευση…' : `Αποθήκευση ${rows.length} ${rows.length === 1 ? 'γραμμής' : 'γραμμών'}`}
          </Btn>
        </>
      )}>

      {step === 'pick' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
          <SegmentControl ariaLabel="Από πού έρχεται το προσυμπληρωμένο" value={source} onChange={v => { setSource(v as Source); setError(''); }}
            options={[{ value: 'pdf', label: 'PDF' }, { value: 'paste', label: 'Επικόλληση' }, { value: 'manual', label: 'Με το χέρι' }]} />

          {source === 'pdf' && (
            <div>
              <p style={{ ...TT.bodySm, margin: '0 0 12px' }}>
                Στο myAADE, στην εφαρμογή Ε1 και Ε2, άνοιξε το Ε2 του {year} και τύπωσέ το σε PDF. Ανέβασε εδώ το αρχείο: το πρωτότυπο μένει στον φάκελό σου.
              </p>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) void readPdf(f); e.currentTarget.value = ''; }} />
              <Btn variant="primary" onClick={() => fileRef.current?.click()} disabled={reading}>
                <FileUp size={15} />{reading ? 'Διαβάζεται…' : 'Διάλεξε το PDF'}
              </Btn>
            </div>
          )}

          {source === 'paste' && (
            <div>
              <p style={{ ...TT.bodySm, margin: '0 0 12px' }}>
                Στο myAADE επίλεξε ολόκληρο τον πίνακα του Ε2, μαζί με τις επικεφαλίδες, αντέγραψέ τον και επικόλλησέ τον εδώ.
              </p>
              <Textarea label="Ο πίνακας του προσυμπληρωμένου" value={text} onChange={setText} rows={8}
                placeholder={'Α/Α\tΑ.Τ.ΑΚ.\tΑΦΜ μισθωτή\tΜήνες\tΑκαθάριστο\n1\t01234567890\t123456783\t12\t7.200,00'} />
            </div>
          )}

          {source === 'manual' && (
            <p style={{ ...TT.bodySm, margin: 0 }}>
              {known.some(k => k.atak)
                ? `Ξεκινάς με ${known.filter(k => k.atak).length === 1 ? 'τον ΑΤΑΚ του ακινήτου' : `τους ${known.filter(k => k.atak).length} ΑΤΑΚ των ακινήτων`} της εφαρμογής. Γράψε δίπλα σε καθέναν ό,τι δείχνει το myAADE.`
                : 'Γράψε μία γραμμή για κάθε γραμμή του Πίνακα I που δείχνει το myAADE.'}
            </p>
          )}

          {error && <p role="alert" style={{ ...TT.bodySm, color: 'var(--negative)', margin: 0 }}>{error}</p>}
        </div>
      )}

      {step !== 'pick' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
          {/* Ο ΥΠΟΧΡΕΟΣ. Το Ε2 είναι ένα ανά ΑΦΜ: γραμμές χωρίς ΑΦΜ δεν συγκρίνονται με τίποτα. */}
          <div style={formGrid(200, 280)}>
            {afms.length > 1
              ? <CustomSelect label="ΑΦΜ υπόχρεου" value={afm} onChange={setAfm} options={afms.map(a => ({ value: a, label: a }))} />
              : <TextInput label="ΑΦΜ υπόχρεου" value={afm} onChange={v => setAfm(afmDigits(v).slice(0, 9))} placeholder="9 ψηφία" />}
          </div>
          {!afmOk && <InfoBanner tone="negative">Γράψε το ΑΦΜ του υπόχρεου του Ε2: 9 ψηφία, με σωστό ψηφίο ελέγχου.</InfoBanner>}
          {afmClash && <InfoBanner tone="warning">Το αρχείο γράφει ΑΦΜ υπόχρεου {detected.afm}. Οι γραμμές θα αποθηκευτούν στο {afm}: έλεγξε ότι είναι το σωστό έντυπο.</InfoBanner>}
          {yearClash && <InfoBanner tone="negative">Το αρχείο είναι του {detected.year}. Εδώ αποθηκεύεται το {year}: άλλαξε έτος και ξαναδοκίμασε.</InfoBanner>}
          {detected.unread > 0 && <InfoBanner tone="warning">{detected.unread === 1 ? 'Μία γραμμή με ποσό δεν αναγνωρίστηκε' : `${detected.unread} γραμμές με ποσά δεν αναγνωρίστηκαν`}. Αν λείπει γραμμή από κάτω, πρόσθεσέ τη με το χέρι.</InfoBanner>}
          {checkCount > 0 && <InfoBanner tone="warning">{checkCount === 1 ? 'Μία γραμμή θέλει' : `${checkCount} γραμμές θέλουν`} έλεγχο: κάποιο πεδίο διαβάστηκε από τη θέση του και όχι από επικεφαλίδα.</InfoBanner>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((d, i) => {
              const r = finals[i];
              const issues = validateAadeRow(r, year);
              const block = blocking[i];
              return (
                <div key={d.id} style={{
                  border: `1px solid ${block ? 'var(--negative-border)' : d.check && !d.touched ? 'var(--warning)' : 'var(--border-subtle)'}`,
                  borderRadius: T.radius.inner, padding: T.sp.lg, background: 'var(--bg-elevated)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ ...TT.body, fontWeight: 600, flex: 1, minWidth: 0 }} className="po-elide">
                      {`Γραμμή ${i + 1}`}{d.address ? ` · ${d.address}` : ''}{d.tenantName ? ` · ${d.tenantName}` : ''}
                    </span>
                    {d.check && !d.touched && <Badge tone="warning">Έλεγξε</Badge>}
                    <IconBtn label={`Αφαίρεση γραμμής ${i + 1}`} onClick={() => remove(d.id)}><X size={15} /></IconBtn>
                  </div>
                  <div style={formGrid(140, 200)}>
                    <TextInput label="ΑΤΑΚ" value={d.atak} onChange={v => patch(d.id, { atak: atakDigits(v) })} placeholder="11 ψηφία" />
                    <TextInput label="ΑΦΜ μισθωτή" value={d.tenantAfm} onChange={v => patch(d.id, { tenantAfm: afmDigits(v).slice(0, 9) })} placeholder="9 ψηφία" />
                    <NumberInput label="Μήνες" value={d.months} onChange={v => patch(d.id, { months: v })} max={12} />
                    <NumberInput label="Μηνιαίο μίσθωμα" suffix="€" value={d.monthly} onChange={v => patch(d.id, { monthly: v })} />
                    <NumberInput label="Ποσοστό" suffix="%" value={d.pct} onChange={v => patch(d.id, { pct: v })} max={100} />
                    <NumberInput label="Ακαθάριστο" suffix="€" value={d.gross} onChange={v => patch(d.id, { gross: v })} />
                    <CustomSelect label="Στήλη ποσού" value={String(d.column)} onChange={v => patch(d.id, { column: Number(v) as E2IncomeColumn })} options={COLUMN_OPTIONS} />
                    <TextInput label="Αρ. δήλωσης μίσθωσης" value={d.decl} onChange={v => patch(d.id, { decl: v })} />
                  </div>
                  {(block || issues.length > 0) && (
                    <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                      {block && <li style={{ ...TT.caption, color: 'var(--negative)' }}>{block}</li>}
                      {issues.filter(x => x !== block).map(x => <li key={x} style={{ ...TT.caption }}>{x}</li>)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <Btn variant="ghost" onClick={addRow}><Plus size={15} />Πρόσθεσε γραμμή</Btn>
          </div>
          <p style={{ ...TT.caption, margin: 0 }}>
            Σύνολο γραμμών: {fe(finals.reduce((s, r) => s + r.gross, 0))}. Η αποθήκευση αντικαθιστά ό,τι είχε ανέβει για το ΑΦΜ {afm || 'του υπόχρεου'} και το {year}.
          </p>
        </div>
      )}
    </Modal>
  );
}
