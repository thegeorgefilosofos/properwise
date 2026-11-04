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
import { T, Btn, Modal, Skeleton, fe, fd, formGrid } from '@/components/Theme';
import { TextInput, CustomSelect, NumberInput, DatePicker } from '@/app/dashboard/components/UIComponents';
import { notify } from '@/components/Toast';
import { isValidAfm, parseAmount } from '@/lib/core/greek';
import { athensToday } from '@/lib/core/time';
import {
  record, markPaid, removeRecord, openItems, clientProperties, reasonText, ENTRY_LABEL,
  type OpenItem, type ClientProperty,
} from '@/lib/data/firms';

export type EntryKind = keyof typeof ENTRY_LABEL;

const note: React.CSSProperties = { fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', margin: 0, fontFamily: T.font.sans, lineHeight: 1.6 };
const MAX_BYTES = 52428800;
const TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Η διαδρομή της σάρωσης της εφαρμογής: <ιδιοκτήτης>/<ακίνητο>/document/<χρόνος>_<όνομα>. */
function docPath(ownerId: string, propertyId: string, name: string): string {
  return `${ownerId}/${propertyId}/document/${Date.now()}_${name.replace(/[^\w.\-]+/g, '_')}`;
}

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

export default function FirmEntry({ db, ownerId, ownerName, kind, onClose }: {
  db: SupabaseClient; ownerId: string; ownerName: string; kind: EntryKind; onClose: () => void;
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
      const path = docPath(ownerId, property, file.name);
      const up = await db.storage.from('property-files').upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) return fail('not_allowed');
      const r = await record(db, ownerId, property, 'document', {
        file_path: path, file_name: file.name, mime: file.type, size_bytes: file.size,
        title: title.trim() || file.name, doc_date: docDate || null,
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
        full_name: t.full_name.trim(), afm: t.afm || null, phone: t.phone || null, email: t.email || null,
        lease_start: t.lease_start || null, lease_end: t.lease_end || null,
        monthly_rent: rent && rent > 0 ? rent : null, status: 'active',
      });
      if (!r.ok) return fail(r.reason);
      done('Ο μισθωτής καταχωρήθηκε.', 'tenant', String(r.data?.id ?? ''));
      return;
    }
    // Πληρωμή: σε εκκρεμότητα, ή νέος πληρωμένος λογαριασμός.
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
      if (!amount || amount <= 0) return fail('error');
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
  // αμέσως, χωρίς να ψάξει κανείς την εγγραφή.
  const done = (msg: string, k?: 'document' | 'tenant' | 'bill', id?: string) => {
    setBusy(false);
    notify(msg, k && id ? { action: { label: 'Αναίρεση', onClick: () => { void removeRecord(db, k, id); } } } : undefined);
    onClose();
  };

  const canSave = !busy && (
    kind === 'document' ? !!file && !!property
    : kind === 'tenant' ? !!property && !!t.full_name.trim()
    : (!!itemId && itemId !== NEW) || (kind === 'bill' && newOne && !!property && !!newBill.name.trim() && !!newBill.amount.trim()));

  return (
    <Modal open onClose={onClose} title={ENTRY_LABEL[kind]} subtitle={ownerName} size="sm"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: T.sp.sm }}>
          <Btn variant="ghost" onClick={onClose}>Άκυρο</Btn>
          <Btn variant="primary" onClick={() => void save()} disabled={!canSave}>{busy ? 'Αποθήκευση…' : 'Καταχώρηση'}</Btn>
        </div>
      }>
      {props === null ? <Skeleton h={120} /> : propList.length === 0 ? (
        <p style={note}>{kind === 'loan' ? 'Κανένα ακίνητο του πελάτη δεν έχει δάνειο.' : 'Ο πελάτης δεν έχει ακόμη ακίνητο. Ακίνητα καταχωρεί ο ιδιοκτήτης.'}</p>
      ) : (
        <div style={{ display: 'grid', gap: T.sp.lg }}>
          <CustomSelect label="Ακίνητο" value={property} onChange={v => { setProperty(v); setItemId(''); }}
            placeholder="Διάλεξε ακίνητο"
            options={propList.map(p => ({ value: p.id, label: p.name }))} />

          {kind === 'document' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: T.sp.xs + 2, fontFamily: T.font.sans }} htmlFor="firm-entry-file">Αρχείο</label>
                <input id="firm-entry-file" type="file" accept="application/pdf,image/jpeg,image/png"
                  onChange={e => { setFile(e.target.files?.[0] ?? null); setErr(''); }}
                  style={{ fontSize: 13, fontFamily: T.font.sans, color: 'var(--text-secondary)', maxWidth: '100%' }} />
                <p style={{ ...note, marginTop: T.sp.xs }}>PDF, JPG ή PNG, έως 50 MB.</p>
              </div>
              <TextInput label="Τίτλος" value={title} onChange={setTitle} placeholder="Λογαριασμός ΔΕΗ Οκτωβρίου" />
              <DatePicker label="Ημερομηνία παραστατικού" value={docDate} onChange={setDocDate} />
            </>
          )}

          {payKind && (
            items === null ? <Skeleton h={44} /> : (
              <>
                {choices.length > 0 ? (
                  <CustomSelect label={ITEM_LABEL[kind] ?? 'Εκκρεμότητα'} value={itemId} onChange={setItemId}
                    placeholder="Διάλεξε"
                    options={[
                      ...choices.map(i => ({ value: i.id, label: `${i.name} · ${fe(i.amount)} · ${fd(i.due)}` })),
                      ...(kind === 'bill' ? [{ value: NEW, label: 'Άλλος λογαριασμός, πληρωμένος' }] : []),
                    ]} />
                ) : (
                  <p style={note}>{kind === 'bill' ? 'Καμία ανοιχτή εκκρεμότητα. Γράψε τον λογαριασμό που πληρώθηκε και το ποσό του.' : 'Καμία ανοιχτή εκκρεμότητα σε αυτό το ακίνητο.'}</p>
                )}
                {kind === 'bill' && newOne && (
                  <div style={{ ...formGrid(160, 240), gap: T.sp.lg }}>
                    <TextInput label="Λογαριασμός" value={newBill.name} onChange={v => setNewBill(s => ({ ...s, name: v }))} placeholder="ΔΕΗ" />
                    <NumberInput label="Ποσό" value={newBill.amount} onChange={v => setNewBill(s => ({ ...s, amount: v }))} suffix="€" />
                  </div>
                )}
                <DatePicker label="Ημερομηνία πληρωμής" value={paidOn} onChange={setPaidOn} />
              </>
            )
          )}

          {kind === 'tenant' && (
            <div style={{ ...formGrid(180, 240), gap: T.sp.lg }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <TextInput label="Ονοματεπώνυμο" value={t.full_name} onChange={v => setT(s => ({ ...s, full_name: v }))} />
              </div>
              <TextInput label="ΑΦΜ" value={t.afm} onChange={v => setT(s => ({ ...s, afm: v.replace(/\D/g, '').slice(0, 9) }))} inputMode="numeric" mono />
              <NumberInput label="Μηνιαίο ενοίκιο" value={t.monthly_rent} onChange={v => setT(s => ({ ...s, monthly_rent: v }))} suffix="€" />
              <TextInput label="Τηλέφωνο" type="tel" inputMode="tel" value={t.phone} onChange={v => setT(s => ({ ...s, phone: v }))} />
              <TextInput label="Ηλεκτρονικό ταχυδρομείο" type="email" inputMode="email" value={t.email} onChange={v => setT(s => ({ ...s, email: v }))} />
              <DatePicker label="Έναρξη μίσθωσης" value={t.lease_start} onChange={v => setT(s => ({ ...s, lease_start: v }))} />
              <DatePicker label="Λήξη μίσθωσης" value={t.lease_end} onChange={v => setT(s => ({ ...s, lease_end: v }))} />
            </div>
          )}

          {err && <p role="alert" style={{ ...note, color: 'var(--negative)' }}>{err}</p>}
        </div>
      )}
    </Modal>
  );
}
