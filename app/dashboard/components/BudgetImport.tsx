'use client';

import { useEffect, useRef, useState } from 'react';
import { readSheetAsCsv, SheetError } from '@/lib/core/readSheet';
import { createClient } from '@/lib/supabase/client';
import * as expenses from '@/lib/data/expenses';
import { T, TT, feAuto, Btn, LinkBtn, SelectBox } from '@/components/Theme';
import { notify } from '@/components/Toast';
import { CustomSelect } from './UIComponents';
import { parseCSV } from '@/lib/billing/parse';
import { CATS } from './budget/model';
import { importRow } from './budget/plan';
import { bucketSlug } from '@/lib/expenses/taxonomy';

// ── Μαζική εισαγωγή δαπανών από αρχείο (CSV / Excel) ─────────────────────────
// Διαβάζει τραπεζικό αντίγραφο ή λίστα εξόδων, αναγνωρίζει αυτόματα ημερομηνία,
// ποσό και κατηγορία (μέσω του δοκιμασμένου parse.ts) και μετά από έλεγχο του
// χρήστη δημιουργεί εγγραφές δαπανών με τη σωστή κατηγορία και τον σωστό μήνα.
//
// ΖΕΙ ΜΕΣΑ ΣΤΟ «ΝΕΑ ΔΑΠΑΝΗ» (13/11/2026). Ηταν ενότητα στο κάτω άκρο του
// Προϋπολογισμού, δεύτερος δρόμος εισαγωγής δίπλα στη σάρωση και στην τράπεζα.
// Τώρα είναι ένα ακόμη πλακίδιο του ίδιου επιλογέα (DocumentScan).
//
// ΚΑΝΕΝΑΣ ΔΙΚΟΣ ΤΗΣ ΠΙΝΑΚΑΣ ΚΑΤΗΓΟΡΙΩΝ. Είχε έναν, γραμμένο πριν υπάρξει ο
// κουβάς «Συνδρομές», οπότε κάθε Netflix έπεφτε στην «Ασφάλεια». Περνά πλέον
// από το κοινό λεξιλόγιο (`importRow` → `resolveCategory` και `budgetBucket`).

// `catKey` είναι ο κουβάς της λίστας· `slug` η κατηγορία του λεξιλογίου που γράφεται στη βάση.
interface Row { id: string; date: string; description: string; amount: number; catKey: string; slug: string; selected: boolean }

interface Props {
  propertyId: string;
  userId?: string;
  /** Οι κατηγορίες της επιλογής. Χωρίς αυτές, οι βασικές του Προϋπολογισμού. */
  cats?: readonly { key: string; label: string }[];
  onImported?: (n: number) => void;
  /** Ανοίγει την επιλογή αρχείου μόλις εμφανιστεί: το πλακίδιο ήταν ήδη η απόφαση. */
  autoPick?: boolean;
  /** Υπάρχουν διαβασμένες γραμμές που δεν μπήκαν: ο γονέας ρωτά πριν κλείσει. */
  onDirtyChange?: (dirty: boolean) => void;
}

/** dd/mm/yyyy, όπως κάθε ημερομηνία της εφαρμογής. */
const dmy = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';

export default function BudgetImport({ propertyId, userId = '', cats = CATS, onImported, autoPick, onDirtyChange }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fileName, setFileName] = useState('');

  const catOptions = cats.map(c => ({ value: c.key, label: c.label }));
  // ΕΝΑ ΠΑΤΗΜΑ ΛΙΓΟΤΕΡΟ. Το «Κινήσεις τράπεζας» και μετά «Διάλεξε αρχείο»
  // ζητούσαν δύο φορές το ίδιο. Η επιλογή ανοίγει μέσα στο ίδιο άγγιγμα· αν ο
  // περιηγητής την αρνηθεί, το κουμπί από κάτω μένει.
  useEffect(() => { if (autoPick) fileRef.current?.click(); }, [autoPick]);
  const dirty = !!rows && rows.length > 0;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);

  const handleFile = async (file: File) => {
    setErr(''); setBusy(true); setFileName(file.name);
    try {
      // ΤΟ ΞΕΝΟ ΦΥΛΛΟ ΔΙΑΒΑΖΕΤΑΙ ΣΕ ΑΛΛΟ ΔΩΜΑΤΙΟ (lib/core/readSheet.ts).
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      const text = isExcel ? await readSheetAsCsv(file) : await file.text();
      const parsed = parseCSV(text).filter(t => t.debit);   // μόνο έξοδα (όχι πιστώσεις/έσοδα)
      const mapped: Row[] = parsed.map(t => {
        const r = importRow(t.category);
        return { id: t.id, date: t.date, description: t.description, amount: t.amount, catKey: r.bucket || 'other', slug: r.slug || 'other', selected: r.bucket !== '' };
      });
      // Ενα σφάλμα, χωρίς το αντιφατικό «0 εγγραφές αναγνωρίστηκαν» από κάτω.
      if (!mapped.length) { setErr('Δεν βρήκαμε δαπάνες στο αρχείο. Χρειάζονται στήλες ημερομηνίας, ποσού και περιγραφής.'); setRows(null); return; }
      setRows(mapped);
    } catch (e) {
      setErr(e instanceof SheetError ? e.message : 'Δεν διαβάστηκε το αρχείο. Δοκίμασε CSV ή Excel (.xlsx).');
      setRows(null);
    } finally { setBusy(false); }
  };

  const selected = rows?.filter(r => r.selected) ?? [];
  const selectedTotal = selected.reduce((s, r) => s + Math.round(r.amount * 100), 0) / 100;

  const doImport = async () => {
    if (!rows || !selected.length) return;
    setBusy(true); setErr('');
    try {
      // Μόνο γραμμές με έγκυρη ISO ημερομηνία φτάνουν στη βάση.
      const valid = selected.filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date));
      if (!valid.length) { setErr('Καμία γραμμή δεν έχει έγκυρη ημερομηνία.'); return; }
      const payload = valid.map(r => ({
        property_id: propertyId, user_id: userId || null,
        amount: r.amount, date: r.date, description: r.description.slice(0, 200),
        category: r.slug, expense_group: r.catKey === 'maintenance' ? 'maintenance' : 'other',
        bill_id: null,
      }));
      const { error } = await expenses.insert(supabase, payload);
      if (error) { setErr('Η εισαγωγή δεν έγινε. Δοκίμασε ξανά.'); return; }
      setRows(null); setFileName('');
      notify(valid.length === 1 ? 'Μπήκε 1 δαπάνη' : `Μπήκαν ${valid.length} δαπάνες`);
      onImported?.(valid.length);
    } finally { setBusy(false); }
  };

  const reset = () => { setRows(null); setErr(''); setFileName(''); };
  const pick = () => fileRef.current?.click();

  return (
    <div className="bud-import">
      <style>{`
        .bud-imp-row { display: grid; grid-template-columns: 28px 96px minmax(0,1fr) 220px 88px; align-items: center; column-gap: 12px; }
        .bud-imp-check { height: 24px; display: inline-flex; align-items: center; }
        .bud-imp-row .bud-imp-date { grid-column: 2; }
        .bud-imp-row .bud-imp-desc { grid-column: 3; }
        .bud-imp-row .bud-imp-cat { grid-column: 4; }
        .bud-imp-row .bud-imp-amt { grid-column: 5; }
        @media (max-width: 560px) {
          .bud-imp-row { grid-template-columns: 28px minmax(0,1fr) auto; row-gap: 4px; }
          .bud-imp-row .bud-imp-desc { grid-column: 2; grid-row: 1; }
          .bud-imp-row .bud-imp-amt { grid-column: 3; grid-row: 1; }
          .bud-imp-row .bud-imp-date { grid-column: 2 / 4; grid-row: 2; }
          .bud-imp-row .bud-imp-cat { grid-column: 2 / 4; grid-row: 3; }
          .bud-imp-check { grid-row: 1 / span 3; align-self: start; }
        }
      `}</style>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt,text/csv" aria-label="Αρχείο κινήσεων" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ''; }} />

      {!rows && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: T.sp.md }}>
          <p style={{ ...TT.bodySm, color: 'var(--text-secondary)', margin: 0 }}>
            Ανέβασε αντίγραφο κινήσεων από την τράπεζα ή μια λίστα δαπανών. Αναγνωρίζουμε ημερομηνία, ποσό και κατηγορία και ελέγχεις πριν μπει οτιδήποτε.
          </p>
          {err && <div role="alert" style={{ ...TT.bodySm, color: 'var(--negative)' }}>{err}</div>}
          <Btn variant={err ? 'secondary' : 'primary'} onClick={pick} disabled={busy}>
            {busy ? 'Ανάγνωση…' : err ? 'Δοκίμασε άλλο αρχείο' : 'Διάλεξε αρχείο CSV ή Excel'}
          </Btn>
        </div>
      )}

      {rows && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.md, marginBottom: T.sp.md, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ ...TT.bodySm, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
              <div style={{ ...TT.caption }}>{rows.length === 1 ? '1 κίνηση' : `${rows.length} κινήσεις`} · {selected.length} επιλεγμένες</div>
            </div>
            <LinkBtn tone="quiet" onClick={reset}>Άλλο αρχείο</LinkBtn>
          </div>

          {err && <div role="alert" style={{ ...TT.bodySm, color: 'var(--negative)', marginBottom: T.sp.md }}>{err}</div>}

          <div role="list" aria-label="Κινήσεις του αρχείου" style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-subtle)' }}>
            {rows.map(r => (
              <div role="listitem" key={r.id} className="bud-imp-row"
                style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', opacity: r.selected ? 1 : 0.62 }}>
                <span className="bud-imp-check">
                  <SelectBox checked={r.selected} label={`Εισαγωγή «${r.description}»`}
                    onChange={() => setRows(rs => rs!.map(x => x.id === r.id ? { ...x, selected: !x.selected } : x))} />
                </span>
                <span className="bud-imp-date" style={{ ...TT.caption, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums' }}>{dmy(r.date) || 'Χωρίς ημερομηνία'}</span>
                <span className="bud-imp-desc" style={{ ...TT.bodySm, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{r.description}</span>
                <div className="bud-imp-cat" style={{ minWidth: 0 }}>
                  <CustomSelect ariaLabel={`Κατηγορία για «${r.description}»`} value={r.catKey} onChange={v => setRows(rs => rs!.map(x => x.id === r.id ? { ...x, catKey: v, slug: bucketSlug(v) } : x))} options={catOptions} />
                </div>
                <span className="bud-imp-amt" style={{ ...TT.bodySm, fontWeight: 700, fontFamily: T.font.num, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', textAlign: 'right', whiteSpace: 'nowrap' }}>{feAuto(r.amount)}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.md, marginTop: T.sp.lg, flexWrap: 'wrap' }}>
            <Btn variant="primary" onClick={doImport} disabled={busy || !selected.length}>
              {busy ? 'Εισαγωγή…' : (selected.length === 1 ? 'Πρόσθεσε 1 δαπάνη' : `Πρόσθεσε ${selected.length} δαπάνες`)}
            </Btn>
            {selected.length > 0 && <span style={{ ...TT.caption }}>Σύνολο <span style={{ fontFamily: T.font.num, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{feAuto(selectedTotal)}</span></span>}
          </div>
        </div>
      )}
    </div>
  );
}
