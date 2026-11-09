'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΤΑΧΩΡΗΣΗ ΤΟΥ ΓΡΑΦΕΙΟΥ ΓΙΑ ΛΟΓΑΡΙΑΣΜΟ ΤΟΥ ΠΕΛΑΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Ο πελάτης φέρνει χαρτιά στο γραφείο. Ένα παράθυρο, ένα ακίνητο από dropdown,
// μία ενέργεια. Ό,τι γράφεται περνά από τη βάση (firm_record, firm_mark_paid),
// που ελέγχει επίπεδο, ρόλο, ανάθεση και ακίνητο· εδώ δεν κρίνεται τίποτα.
//
// ΠΛΗΡΩΜΗ ΣΕ ΚΑΤΙ ΠΟΥ ΥΠΑΡΧΕΙ. Οι δόσεις φόρου και δανείου και τα ενοίκια
// διαλέγονται από τις εκκρεμότητες του πελάτη: το γραφείο σημειώνει πληρωμή,
// δεν ανοίγει υποχρέωση. Ο λογαριασμός ρεύματος που πληρώθηκε και δεν
// υπήρχε ως εκκρεμότητα γράφεται ως ΠΛΗΡΩΜΕΝΟΣ, με την απόδειξή του.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { T, TT, Btn, Modal, Skeleton, fe, fd, fieldRow } from '@/components/Theme';
import { TextInput, CustomSelect, NumberInput, DatePicker } from '@/app/dashboard/components/UIComponents';
import { notify, notifyError } from '@/components/Toast';
import { DropZone } from '@/app/dashboard/components/DropZone';
import { fmtBytes } from '@/lib/core/bytes';
import { isValidAfm, parseAmount } from '@/lib/core/greek';
import { athensToday } from '@/lib/core/time';
import {
  record, markPaid, undoRecord, openItems, clientProperties, reasonText, ENTRY_LABEL,
  type OpenItem, type ClientProperty,
} from '@/lib/data/firms';

export type EntryKind = keyof typeof ENTRY_LABEL;

const note: React.CSSProperties = { ...TT.bodySm, color: 'var(--text-tertiary)', margin: 0 };
const MAX_BYTES = 52428800;
const TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Η διαδρομή της σάρωσης της εφαρμογής: <ιδιοκτήτης>/<ακίνητο>/document/<χρόνος>_<όνομα>. */
function docPath(ownerId: string, propertyId: string, name: string): string {
  return `${ownerId}/${propertyId}/document/${Date.now()}_${name.replace(/[^\w.\-]+/g, '_')}`;
}

/**
 * ΤΟ ΚΕΝΟ ΓΙΝΕΤΑΙ null, ΟΧΙ ''. Η Postgres απορρίπτει το '' ως ημερομηνία ή
 * αριθμό και στο κείμενο δεν λέει τίποτα παραπάνω από το null. Ιδια λογική με
 * το `settingsRow` του οδηγού νέου ακινήτου: κόβεται στις άκρες, το κενό φεύγει.
 */
const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

/** Η ετικέτα του dropdown των εκκρεμοτήτων, ανά είδος. */
const ITEM_LABEL: Partial<Record<EntryKind, string>> = { bill: 'Λογαριασμός', rent: 'Ενοίκιο', tax: 'Δόση φόρου', loan: 'Δόση δανείου' };

/** Ποια εκκρεμότητα ανήκει σε ποιο είδος του μενού. */
const isTax = (i: OpenItem) => /ΕΝΦΙΑ|ενφια|φόρ|φορ/i.test(i.name);
const isLoan = (i: OpenItem) => /δάνει|δανει/i.test(i.name);
function itemsFor(kind: EntryKind, all: OpenItem[]): OpenItem[] {
  if (kind === 'rent') return all.filter(i => i.kind === 'rent');
  if (kind === 'tax') return all.filter(i => i.kind !== 'rent' && isTax(i));
  if (kind === 'loan') return all.filter(i => i.kind === 'event' && isLoan(i));
  if (kind === 'bill') return all.filter(i => i.kind === 'bill' && !isTax(i));
  return [];
}

export default function FirmEntry({ db, ownerId, ownerName, kind, onClose, onUndone }: {
  db: SupabaseClient; ownerId: string; ownerName: string; kind: EntryKind; onClose: () => void;
  /** Μετά από επιτυχή αναίρεση: η λίστα των πελατών ξαναδιαβάζεται. */
  onUndone?: () => void;
}) {
  const today = athensToday();
  const [props, setProps] = useState<ClientProperty[] | null>(null);
  const [items, setItems] = useState<OpenItem[] | null>(null);
  const [property, setProperty] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Παραστατικό
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [docDate, setDocDate] = useState(today);
  // Πληρωμή
  const [itemId, setItemId] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  const [newBill, setNewBill] = useState({ name: '', amount: '' });
  // Μισθωτής
  const [t, setT] = useState({ full_name: '', afm: '', phone: '', email: '', lease_start: '', lease_end: '', monthly_rent: '' });

  const payKind = kind === 'bill' || kind === 'rent' || kind === 'tax' || kind === 'loan';
  // Λογαριασμός που δεν ήταν εκκρεμότητα: γράφεται ως πληρωμένος, με το ποσό του.
  const NEW = 'new';

  useEffect(() => {
    let alive = true;
    clientProperties(db, ownerId).then(r => {
      if (!alive) return;
      const list = r.ok ? r.data : [];
      setProps(list);
      if (list.length === 1) setProperty(list[0].id);
    });
    if (payKind) openItems(db, ownerId).then(r => { if (alive) setItems(r.ok ? r.data : []); });
    return () => { alive = false; };
  }, [db, ownerId, payKind]);

  const choices = useMemo(() => {
    const own = itemsFor(kind, items ?? []);
    return property ? own.filter(i => i.propertyId === property) : own;
  }, [kind, items, property]);

  const newOne = itemId === NEW || (items !== null && choices.length === 0);
  const propList = useMemo(() => kind === 'loan' ? (props ?? []).filter(p => p.hasLoan) : (props ?? []), [kind, props]);

  const fail = (reason: string) => { setErr(reasonText(reason)); setBusy(false); };

  const save = async () => {
    setErr(''); setBusy(true);
    if (kind === 'document') {
      if (!file || !property) return fail('error');
      if (!TYPES.includes(file.type)) return fail('type');
      if (file.size > MAX_BYTES) return fail('size');
      // Η ΣΥΜΒΑΣΗ ΠΡΙΝ ΑΠΟ ΤΟ ΑΝΕΒΑΣΜΑ (20261105100000): η πολιτική του storage
      // αρνείται έτσι κι αλλιώς, αλλά με γενικό μήνυμα. Εδώ λέγεται ο λόγος.
      const dpa = await db.rpc('firm_owner_dpa_ok', { p_owner: ownerId });
      if (!dpa.error && dpa.data === false) return fail('dpa');
      const path = docPath(ownerId, property, file.name);
      const up = await db.storage.from('property-files').upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) return fail('not_allowed');
      const r = await record(db, ownerId, property, 'document', {
        file_path: path, file_name: file.name, mime: file.type, size_bytes: file.size,
        title: title.trim() || file.name, doc_date: orNull(docDate),
      });
      if (!r.ok) { await db.storage.from('property-files').remove([path]); return fail(r.reason); }
      done('Το παραστατικό αποθηκεύτηκε στο Αρχείο του πελάτη.', 'document', String(r.data?.id ?? ''));
      return;
    }
    if (kind === 'tenant') {
      if (!property || !t.full_name.trim()) return fail('error');
      if (t.afm && !isValidAfm(t.afm)) return fail('afm');
      const rent = parseAmount(t.monthly_rent);
      const r = await record(db, ownerId, property, 'tenant', {
        full_name: t.full_name.trim(), afm: orNull(t.afm), phone: orNull(t.phone), email: orNull(t.email),
        lease_start: orNull(t.lease_start), lease_end: orNull(t.lease_end),
        monthly_rent: rent && rent > 0 ? rent : null, status: 'active',
      });
      if (!r.ok) return fail(r.reason);
      done('Ο μισθωτής καταχωρήθηκε.', 'tenant', String(r.data?.id ?? ''));
      return;
    }
    // Πληρωμή: σε εκκρεμότητα, ή νέος πληρωμένος λογαριασμός. Χωρίς ημερομηνία
    // δεν φεύγει τίποτα: η βάση θα έπαιρνε '' ως ημερομηνία πληρωμής.
    if (!orNull(paidOn)) return fail('paid_at');
    if (itemId && itemId !== NEW) {
      const it = choices.find(i => i.id === itemId);
      if (!it) return fail('error');
      const r = await markPaid(db, it.kind, it.id, paidOn, null);
      if (!r.ok) return fail(r.reason);
      done('Η πληρωμή σημειώθηκε.');
      return;
    }
    if (kind === 'bill' && (itemId === NEW || choices.length === 0) && property && newBill.name.trim()) {
      const amount = parseAmount(newBill.amount);
      // Το κενό ποσό γίνεται «0» μόλις φύγει η εστίαση (NumberInput): το «Δοκίμασε
      // ξανά» δεν θα πετύχαινε ποτέ. Λέγεται τι λείπει.
      if (!amount || amount <= 0) return fail('amount');
      const r = await record(db, ownerId, property, 'bill', {
        type: newBill.name.trim(), name: newBill.name.trim(), amount, due_date: paidOn, paid_at: paidOn,
      });
      if (!r.ok) return fail(r.reason);
      done('Ο πληρωμένος λογαριασμός καταχωρήθηκε.', 'bill', String(r.data?.id ?? ''));
      return;
    }
    fail('error');
  };

  // Η ΑΝΑΙΡΕΣΗ ΣΤΟ ΙΔΙΟ ΤΟ ΜΗΝΥΜΑ. Λάθος ακίνητο ή λάθος αρχείο διορθώνεται
  // αμέσως, χωρίς να ψάξει κανείς την εγγραφή. Το αποτέλεσμα λέγεται: πριν,
  // μια αναίρεση που απέτυχε (π.χ. η πρόσβαση ανακλήθηκε στο μεταξύ) δεν έλεγε
  // τίποτα και η εγγραφή έμενε, ενώ ο λογιστής νόμιζε ότι έφυγε.
  const undo = async (k: 'document' | 'tenant' | 'bill', id: string) => {
    const r = await undoRecord(db, k, id);
    if (!r.ok) { notifyError(reasonText(r.reason)); return; }
    notify('Η καταχώρηση αναιρέθηκε.');
    onUndone?.();
  };
  const done = (msg: string, k?: 'document' | 'tenant' | 'bill', id?: string) => {
    setBusy(false);
    notify(msg, k && id ? { action: { label: 'Αναίρεση', onClick: () => { void undo(k, id); } } } : undefined);
    onClose();
  };

  const canSave = !busy && (
    kind === 'document' ? !!file && !!property
    : kind === 'tenant' ? !!property && !!t.full_name.trim()
    : (!!itemId && itemId !== NEW) || (kind === 'bill' && newOne && !!property && !!newBill.name.trim() && !!newBill.amount.trim()));

  return (
    <Modal open onClose={onClose} title={ENTRY_LABEL[kind]} subtitle={ownerName} size="sm"
      /* ΤΑ ΚΟΥΜΠΙΑ ΚΑΤΕΥΘΕΙΑΝ ΣΤΟ ΥΠΟΣΕΛΙΔΟ, ΟΧΙ ΣΕ ΔΙΚΟ ΤΟΥΣ ΚΟΥΤΙ. Το Modal τα
         μοιράζει ίσα στο τηλέφωνο (`.act-row`)· τυλιγμένα σε ένα `<div>` γίνονταν
         «μοναδικό παιδί» και κάθονταν δεξιά με το πλάτος του λεκτικού τους. */
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Ακύρωση</Btn>
          <Btn variant="primary" onClick={() => void save()} disabled={!canSave}>{busy ? 'Αποθήκευση…' : 'Καταχώρηση'}</Btn>
        </>
      }>
      {props === null ? <Skeleton h={120} /> : propList.length === 0 ? (
        <p style={note}>{kind === 'loan' ? 'Κανένα ακίνητο του πελάτη δεν έχει δάνειο.' : 'Ο πελάτης δεν έχει ακόμη ακίνητα. Τα ακίνητα τα προσθέτει ο ίδιος.'}</p>
      ) : (
        // ΜΙΑ ΣΤΗΛΗ ΠΟΥ ΔΕΝ ΦΑΡΔΑΙΝΕΙ ΑΠΟ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΤΗΣ. Χωρίς `minmax(0, 1fr)`
        // το πλέγμα έπαιρνε το ελάχιστο πλάτος του φαρδύτερου παιδιού και τα πεδία
        // έβγαιναν 36 εικονοστοιχεία έξω από το παράθυρο στα 390.
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: T.sp.lg }}>
          <CustomSelect label="Ακίνητο" value={property} onChange={v => { setProperty(v); setItemId(''); }}
            placeholder="Διάλεξε ακίνητο"
            options={propList.map(p => ({ value: p.id, label: p.name }))} />

          {kind === 'document' && (
            <>
              <DropZone inputId="firm-entry-file" disabled={busy}
                onFile={f => { if (f) { setFile(f); setErr(''); } }}
                title="Διάλεξε το αρχείο" hint="PDF, JPG ή PNG, έως 50 MB" accept="application/pdf,image/jpeg,image/png"
                inputLabel="Το αρχείο του παραστατικού"
                picked={file ? `${file.name} · ${fmtBytes(file.size)}` : null} />
              <TextInput label="Τίτλος" value={title} onChange={setTitle} placeholder="ΔΕΗ Οκτωβρίου" />
              <DatePicker label="Ημερομηνία παραστατικού" value={docDate} onChange={setDocDate} />
            </>
          )}

          {payKind && (
            items === null ? <Skeleton h={44} /> : (
              <>
                {choices.length > 0 ? (
                  <CustomSelect label={ITEM_LABEL[kind] ?? 'Εκκρεμότητα'} value={itemId} onChange={setItemId}
                    placeholder="Διάλεξε εκκρεμότητα"
                    options={[
                      ...choices.map(i => ({ value: i.id, label: `${i.name} · ${fe(i.amount)} · ${fd(i.due)}` })),
                      ...(kind === 'bill' ? [{ value: NEW, label: 'Άλλος λογαριασμός, ήδη πληρωμένος' }] : []),
                    ]} />
                ) : (
                  <p style={note}>{kind === 'bill' ? 'Καμία ανοιχτή εκκρεμότητα. Γράψε τον λογαριασμό που πληρώθηκε και το ποσό του.' : 'Καμία ανοιχτή εκκρεμότητα σε αυτό το ακίνητο.'}</p>
                )}
                {kind === 'bill' && newOne && (
                  <div {...fieldRow(160, T.sp.lg)}>
                    <TextInput label="Λογαριασμός" value={newBill.name} onChange={v => setNewBill(s => ({ ...s, name: v }))} placeholder="ΔΕΗ" />
                    <NumberInput label="Ποσό" value={newBill.amount} onChange={v => setNewBill(s => ({ ...s, amount: v }))} suffix="€" />
                  </div>
                )}
                <DatePicker label="Ημερομηνία πληρωμής" value={paidOn} onChange={setPaidOn} />
              </>
            )
          )}

          {kind === 'tenant' && (
            // Η ΣΕΙΡΑ ΓΕΜΙΖΕΙ ΤΟ ΠΛΑΤΟΣ. Το `formGrid(180, 240)` έκοβε κάθε πεδίο στα
            // 240: στο τηλέφωνο έμεναν 68 εικονοστοιχεία κενά δεξιά κάθε κουτιού, με
            // μόνο το «Ακίνητο» από πάνω να φτάνει ως την άκρη.
            <div {...fieldRow(180, T.sp.lg)}>
              <div style={{ flexBasis: '100%' }}>
                <TextInput label="Ονοματεπώνυμο" value={t.full_name} onChange={v => setT(s => ({ ...s, full_name: v }))} />
              </div>
              <TextInput label="ΑΦΜ" value={t.afm} onChange={v => setT(s => ({ ...s, afm: v.replace(/\D/g, '').slice(0, 9) }))} inputMode="numeric" mono />
              <NumberInput label="Μηνιαίο ενοίκιο" value={t.monthly_rent} onChange={v => setT(s => ({ ...s, monthly_rent: v }))} suffix="€" />
              <TextInput label="Τηλέφωνο" type="tel" inputMode="tel" value={t.phone} onChange={v => setT(s => ({ ...s, phone: v }))} />
              <TextInput label="Ηλεκτρονικό ταχυδρομείο" type="email" inputMode="email" value={t.email} onChange={v => setT(s => ({ ...s, email: v }))} />
              <DatePicker label="Έναρξη μίσθωσης" value={t.lease_start} onChange={v => setT(s => ({ ...s, lease_start: v }))} />
              <DatePicker label="Λήξη μίσθωσης" value={t.lease_end} onChange={v => setT(s => ({ ...s, lease_end: v }))} />
              {/* ΑΡΘΡΟ 14 ΓΚΠΔ: υπεύθυνος μένει ο ιδιοκτήτης, το γραφείο εκτελεί (Πολιτική #grafeia). */}
              <p style={{ ...note, flexBasis: '100%' }}>Ο ιδιοκτήτης ενημερώνει τον μισθωτή για την επεξεργασία.</p>
            </div>
          )}

          {err && <p role="alert" style={{ ...note, color: 'var(--negative)' }}>{err}</p>}
        </div>
      )}
    </Modal>
  );
}
