'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ ΑΠΟ ΤΟ myDATA: ΤΑ ΓΝΩΣΤΑ ΜΠΑΙΝΟΥΝ ΜΟΝΑ ΤΟΥΣ, ΤΑ ΑΛΛΑ ΜΕ ΕΝΑ ΠΑΤΗΜΑ
// ─────────────────────────────────────────────────────────────────────────
// Δίπλα στο «Ήρθαν με email» (InboundInbox.tsx), με τους ίδιους κανόνες: ΜΙΑ
// ανοιχτή κάρτα τη φορά, οι υπόλοιπες κλειστές σε μία σειρά· όταν δεν υπάρχει
// τίποτα, δεν φαίνεται τίποτα.
//
// ΤΑ ΤΡΙΑ ΕΠΙΠΕΔΑ (PR-Α2, supabase/functions/_shared/mydataClassify.ts):
//   · ΑΥΤΟΜΑΤΑ: πάροχος του μητρώου που ο χρήστης έχει επιβεβαιώσει, με ένα
//     ακίνητο. Δεν θέλει πάτημα· φαίνεται στο «Μπήκαν μόνα τους» με «Δεν είναι
//     σωστό» για αναίρεση.
//   · ΓΙΑ ΕΛΕΓΧΟ: η κάρτα έρχεται ΑΝΟΙΧΤΗ με την κατηγορία προσυμπληρωμένη και
//     μία πρόταση για τον λόγο. Ενα κουμπί: «Σωστό». Η επόμενη ανοίγει μόνη της.
//     Πάνω από το όριο του άρθρου 23 ΚΦΕ το κουμπί γίνεται η ερώτηση
//     «Πληρώθηκε με τράπεζα ή κάρτα;» (ναι ή μετρητά), πάλι ένα πάτημα.
//   · ΑΠΟΡΡΙΨΗ: ό,τι δεν αφορά ακίνητα δεν αποθηκεύτηκε. Φαίνεται μόνο πλήθος.
//
// ΤΟ ΠΟΣΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Το έδωσε η ΑΑΔΕ και καταχωρείται ΑΚΡΙΒΩΣ έτσι
// (μικτό και ΦΠΑ από τα λεπτά της βάσης)· η βάση δένει το παραστατικό μόνο αν
// η δαπάνη έχει αυτά τα ποσά.
//
// ΑΚΥΡΩΣΗ ΑΦΟΥ ΚΑΤΑΧΩΡΗΘΗΚΕ. Η δαπάνη δεν σβήνει μόνη της (μπορεί να έχει
// πάρει ακίνητο, σημειώσεις, πληρωμή): εμφανίζεται εδώ και ο ιδιοκτήτης
// διαλέγει «Σβήσε τη δαπάνη» ή «Κράτησέ τη».
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Card, SecHdr, Btn, fieldRow, fd } from '@/components/Theme';
import { CustomSelect } from './UIComponents';
import { CATEGORIES, BY_SLUG } from '@/lib/expenses/taxonomy';
import { notify, notifyError } from '@/components/Toast';
import * as mydata from '@/lib/data/mydata';
import { centsLabel } from '@/lib/mydata/status';
import { reviewLine, suggestedCategory, asksBankPayment, displayName } from '@/lib/mydata/review';
import { BANK_PAYMENT_LIMIT_CENTS } from '@/lib/mydata/limits';
import { fe } from '@/lib/core/format';
import { athensToday } from '@/lib/core/time';

interface Props {
  propertyId: string;
  userId: string;
  properties?: { id: string; name: string }[];
  onFiled?: () => void;
}

const dayMonth = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y === athensToday().slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
};

/** Οι λόγοι που θέλουν προσοχή, όχι απλή επιβεβαίωση. */
const WARN = new Set(['over_limit', 'credit', 'amounts', 'unusual_amount']);

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n.toLocaleString('el-GR')} ${many}`);

export default function MydataInbox({ propertyId, userId, properties = [], onFiled }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<mydata.PendingDoc[]>([]);
  const [alerts, setAlerts] = useState<mydata.PendingDoc[]>([]);
  const [auto, setAuto] = useState<mydata.PendingDoc[]>([]);
  const [notProperty, setNotProperty] = useState(0);
  const [showAuto, setShowAuto] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { slug: string; propertyId: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    mydata.pendingDocs(supabase, userId).then(({ rows: found }) => { if (live) setRows(found); });
    mydata.attentionDocs(supabase, userId).then(({ rows: found }) => { if (live) setAlerts(found); });
    mydata.autoDocs(supabase, userId).then(({ rows: found }) => { if (live) setAuto(found); });
    mydata.notPropertyCount(supabase, userId).then(({ n }) => { if (live) setNotProperty(n); });
    // Ο νυχτερινός συγχρονισμός ή το «Συγχρονισμός τώρα» του λογιστή φέρνει νέα: τα δείχνει χωρίς ανανέωση.
    const ch = supabase.channel(`mydata_inbox_${userId}_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mydata_docs', filter: `client_id=eq.${userId}` }, () => { if (live) setNonce(n => n + 1); })
      .subscribe();
    return () => { live = false; void supabase.removeChannel(ch); };
  }, [supabase, userId, nonce]);

  if (!rows.length && !alerts.length && !auto.length) return null;

  const many = properties.length > 1;
  const draftOf = (d: mydata.PendingDoc) => drafts[d.id] ?? { slug: suggestedCategory({ counterpart_afm: d.counterpart_afm, counterpart_name: d.counterpart_name, category: d.category ?? null }), propertyId };
  const patch = (d: mydata.PendingDoc, part: Partial<{ slug: string; propertyId: string }>) =>
    setDrafts(x => ({ ...x, [d.id]: { ...draftOf(d), ...part } }));
  const openId = rows.some(r => r.id === open) ? open : rows[0]?.id;
  const gone = (id: string) => setRows(list => list.filter(x => x.id !== id));

  const file = async (d: mydata.PendingDoc, payment?: mydata.Payment) => {
    const dr = draftOf(d);
    const cat = dr.slug ? BY_SLUG[dr.slug] : null;
    if (!cat) return;
    setBusy(d.id);
    const r = await mydata.fileDoc(supabase, d, { propertyId: dr.propertyId || propertyId, userId }, cat.label, displayName(d), { slug: cat.slug, payment });
    setBusy(null);
    if (!r.expenseId) { notifyError('Η δαπάνη δεν καταχωρήθηκε'); return; }
    if (!r.linked) notifyError('Η δαπάνη καταχωρήθηκε. Το παραστατικό θα ξαναφανεί εδώ.');
    else if (payment?.method === 'Μετρητά') notify(`Καταχωρήθηκε. Με μετρητά πάνω από ${fe(BANK_PAYMENT_LIMIT_CENTS / 100)} δεν εκπίπτει.`);
    gone(d.id);
    onFiled?.();
  };

  const dismiss = async (d: mydata.PendingDoc) => {
    setBusy(d.id);
    const { error } = await mydata.dismissDoc(supabase, d.id);
    setBusy(null);
    if (error) { notifyError('Το παραστατικό δεν αφαιρέθηκε'); return; }
    gone(d.id);
  };

  const ignore = async (d: mydata.PendingDoc) => {
    setBusy(d.id);
    const r = await mydata.ignoreProvider(supabase, d.counterpart_afm);
    setBusy(null);
    if (r.error) { notifyError('Ο κανόνας δεν γράφτηκε'); return; }
    setRows(list => list.filter(x => x.counterpart_afm !== d.counterpart_afm));
    notify(`Δεν θα έρχεται τίποτα από ${displayName(d)}`);
  };

  const ack = async (d: mydata.PendingDoc, remove: boolean) => {
    setBusy(d.id);
    const r = await mydata.cancelAck(supabase, d.id, remove);
    setBusy(null);
    if (!r.ok) { notifyError('Η απόφαση δεν γράφτηκε'); return; }
    setAlerts(list => list.filter(x => x.id !== d.id));
    if (remove) { notify('Η δαπάνη σβήστηκε'); onFiled?.(); }
  };

  const undo = async (d: mydata.PendingDoc) => {
    setBusy(d.id);
    const r = await mydata.undoAuto(supabase, d.id);
    setBusy(null);
    if (!r.ok) { notifyError('Η αναίρεση δεν έγινε'); return; }
    setAuto(list => list.filter(x => x.id !== d.id));
    setRows(list => [{ ...d, tier: 'review' }, ...list]);
    setOpen(d.id);
    onFiled?.();
  };

  const summary = [
    rows.length ? plural(rows.length, 'για έλεγχο', 'για έλεγχο') : null,
    auto.length ? plural(auto.length, 'μπήκε μόνο του', 'μπήκαν μόνα τους') : null,
    notProperty ? plural(notProperty, 'δεν αφορούσε ακίνητα', 'δεν αφορούσαν ακίνητα') : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card style={{ marginBottom: T.sp.lg }}>
      <SecHdr label="Από το myDATA" sub={summary} />
      {alerts.length > 0 && (
        <div role="region" aria-label="Ακυρώσεις από τον εκδότη" style={{ display: 'grid', gap: 10, marginBottom: rows.length || auto.length ? T.sp.md : 0 }}>
          {alerts.map(d => (
            <div key={d.id} style={{ display: 'grid', gap: 8, padding: '12px 14px', minWidth: 0, borderRadius: T.radius.card, background: 'var(--warning-soft)', border: '1px solid var(--warning-border)' }}>
              <span style={{ ...TT.body, fontWeight: 600, color: 'var(--warning-on-container)' }}>Ακυρώθηκε από τον εκδότη</span>
              <span style={{ ...TT.bodySm, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {displayName(d)} · {d.title}{' '}· {fd(d.issue_date)} · {centsLabel(Number(d.gross_cents), d.is_credit)}. Την είχες καταχωρήσει ως δαπάνη.
              </span>
              <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="primary" onClick={() => void ack(d, true)} disabled={busy === d.id}>Σβήσε τη δαπάνη</Btn>
                <Btn variant="secondary" onClick={() => void ack(d, false)} disabled={busy === d.id}>Κράτησέ τη</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map(d => {
          const amount = centsLabel(Number(d.gross_cents), d.is_credit);
          const name = displayName(d);
          if (d.id !== openId) return (
            <button key={d.id} type="button" className="inbound-row md-row md-row-2" onClick={() => setOpen(d.id)} aria-expanded={false}
              aria-label={`Άνοιγμα: ${name}, ${amount}`}>
              <span className="md-row-who" style={{ ...TT.body, textWrap: undefined, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
              <span className="inbound-sum" style={{ ...TT.bodySm, textWrap: undefined, fontWeight: 600, color: 'var(--text-primary)' }}>{amount}</span>
              <span className="md-row-what" style={{ ...TT.bodySm, textWrap: undefined, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {d.title}{' '}· {dayMonth(d.issue_date)}
              </span>
            </button>
          );
          const dr = draftOf(d);
          const reasons = d.review_reasons ?? [];
          const why = reviewLine(reasons, { manyProperties: many });
          const warn = reasons.some(r => WARN.has(r));
          const bank = asksBankPayment(reasons);
          const busyHere = busy === d.id;
          return (
            <div key={d.id} style={{ display: 'grid', gap: 10, padding: '12px 14px', minWidth: 0, borderRadius: T.radius.card, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ ...TT.body, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                <span style={{ ...TT.body, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{amount}</span>
              </div>
              <div style={{ ...TT.bodySm, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {d.title}{' '}· {fd(d.issue_date)}
              </div>
              <div style={{ ...TT.bodySm, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                Καθαρό {centsLabel(Number(d.net_cents), d.is_credit)} · ΦΠΑ {centsLabel(Number(d.vat_cents), d.is_credit)} · ΜΑΡΚ <span translate="no">{d.mark}</span>
              </div>
              {why && (
                <p style={{ ...TT.bodySm, margin: 0, color: warn ? 'var(--warning-on-container)' : 'var(--text-secondary)', fontWeight: warn ? 600 : 400 }}>{why}</p>
              )}
              <div {...fieldRow(180)}>
                {many && (
                  <CustomSelect label="Ακίνητο" value={dr.propertyId} onChange={v => patch(d, { propertyId: v })}
                    options={properties.map(p => ({ value: p.id, label: p.name }))} />
                )}
                <CustomSelect label="Κατηγορία" value={dr.slug} onChange={v => patch(d, { slug: v })} placeholder="Διάλεξε κατηγορία"
                  options={CATEGORIES.map(c => ({ value: c.slug, label: c.label }))} />
              </div>
              {bank && (
                <p style={{ ...TT.body, margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Πληρώθηκε με τράπεζα ή κάρτα;</p>
              )}
              <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {bank ? (
                  <>
                    <Btn variant="primary" onClick={() => void file(d, { method: 'Ηλεκτρονική πληρωμή' })} disabled={!dr.slug || busyHere}>
                      {busyHere ? 'Καταχώρηση…' : 'Ναι, σωστό'}
                    </Btn>
                    <Btn variant="secondary" onClick={() => void file(d, { method: 'Μετρητά' })} disabled={!dr.slug || busyHere}>Μετρητά</Btn>
                  </>
                ) : (
                  <Btn variant="primary" onClick={() => void file(d)} disabled={!dr.slug || busyHere}>{busyHere ? 'Καταχώρηση…' : 'Σωστό'}</Btn>
                )}
                <Btn variant="ghost" onClick={() => void dismiss(d)} disabled={busyHere}>Δεν αφορά ακίνητο</Btn>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
                <Btn variant="ghost" onClick={() => void ignore(d)} disabled={busyHere}>Πάντα αγνόησε αυτόν τον πάροχο</Btn>
              </div>
            </div>
          );
        })}
      </div>
      {auto.length > 0 && (
        <div style={{ marginTop: rows.length ? T.sp.md : 0 }}>
          <Btn variant="ghost" onClick={() => setShowAuto(v => !v)} expanded={showAuto} controls="md-auto-list">
            {showAuto ? 'Κρύψε όσα μπήκαν μόνα τους' : `Μπήκαν μόνα τους · ${auto.length.toLocaleString('el-GR')}`}
          </Btn>
          {showAuto && (
            <ul id="md-auto-list" style={{ listStyle: 'none', margin: `${T.sp.sm}px 0 0`, padding: 0, display: 'grid', gap: 8 }}>
              {auto.map(d => (
                <li key={d.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', borderRadius: T.radius.card, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ ...TT.bodySm, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontWeight: 600 }}>{displayName(d)}</span> · {centsLabel(Number(d.gross_cents), d.is_credit)} · {dayMonth(d.issue_date)}
                    {d.category && BY_SLUG[d.category] ? ` · ${BY_SLUG[d.category].label}` : ''}
                  </span>
                  <Btn variant="ghost" onClick={() => void undo(d)} disabled={busy === d.id}>Δεν είναι σωστό</Btn>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
