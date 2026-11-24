'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ ΑΠΟ ΤΟ myDATA: ΕΛΕΓΧΟΣ ΜΕ ΕΝΑ ΠΑΤΗΜΑ
// ─────────────────────────────────────────────────────────────────────────
// Δίπλα στο «Ήρθαν με email» (InboundInbox.tsx), με τους ίδιους κανόνες: ΜΙΑ
// ανοιχτή κάρτα τη φορά, οι υπόλοιπες κλειστές σε μία σειρά· όταν δεν υπάρχει
// τίποτα, δεν φαίνεται τίποτα.
//
// ΤΑ ΤΡΙΑ ΕΠΙΠΕΔΑ (PR-Α2, supabase/functions/_shared/mydataClassify.ts):
//   · ΑΥΤΟΜΑΤΑ: πάροχος του μητρώου που έχει ελέγξει άνθρωπος και που ο
//     χρήστης έχει ήδη καταχωρήσει για το ίδιο ακίνητο, με ένα ακίνητο.
//     Φαίνεται στο «Καταχωρήθηκαν αυτόματα» με «Αναίρεση». Σήμερα (θωράκιση
//     24/11/2026) κανένας πάροχος δεν έχει ελεγχθεί, άρα όλα πάνε για έλεγχο.
//   · ΓΙΑ ΕΛΕΓΧΟ: η κάρτα έρχεται ΑΝΟΙΧΤΗ με την κατηγορία προσυμπληρωμένη και
//     μία πρόταση για τον λόγο. Ενα κουμπί: «Καταχώρηση». Η επόμενη ανοίγει μόνη
//     της. Οπου χρειάζεται, η κάρτα ρωτά ουδέτερα «Πώς πληρώθηκε;» (lib/mydata/
//     review.ts): σε κάθε ποσό για ανακαίνιση, αλλιώς πάνω από το όριο με
//     καθαρή αξία, ποτέ σε πιστωτικό. Καμία φορολογική κρίση στην οθόνη.
//     Αν ο χρήστης έχει ήδη περάσει την ίδια δαπάνη, η κάρτα ρωτά «Είναι η ίδια;».
//   · ΑΠΟΡΡΙΨΗ: ό,τι δεν αφορά ακίνητα δεν αποθηκεύτηκε. Φαίνεται μόνο πλήθος.
//     «Δεν αφορά ακίνητο» και «Πάντα αγνόησε» σβήνουν αμέσως εκδότη, ποσά και
//     ημερομηνία (μένει ο ΜΑΡΚ, για να μην ξανάρθει).
//
// ΤΟ ΠΟΣΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Το έδωσε η ΑΑΔΕ και καταχωρείται ΑΚΡΙΒΩΣ έτσι
// (μικτό και ΦΠΑ από τα λεπτά της βάσης)· η βάση δένει το παραστατικό μόνο αν
// η δαπάνη έχει αυτά τα ποσά.
//
// ΑΚΥΡΩΣΗ ΑΦΟΥ ΚΑΤΑΧΩΡΗΘΗΚΕ. Η δαπάνη δεν σβήνει μόνη της (μπορεί να έχει
// πάρει ακίνητο, σημειώσεις, πληρωμή): εμφανίζεται εδώ και ο ιδιοκτήτης
// διαλέγει «Σβήσε τη δαπάνη» ή «Κράτησέ τη». Αν το παραστατικό ήταν δεμένο με
// δαπάνη που πέρασε ο ίδιος, βλέπει «Θέλει έλεγχο» και η δαπάνη του δεν
// σβήνει ποτέ από εδώ. Επανέκδοση του ίδιου λογαριασμού δένεται στην ίδια
// δαπάνη από τη βάση, χωρίς ειδοποίηση.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Card, SecHdr, Btn, ChipToggle, fieldRow, fd } from '@/components/Theme';
import { CustomSelect, DatePicker } from './UIComponents';
import { CATEGORIES, BY_SLUG } from '@/lib/expenses/taxonomy';
import { notify, notifyError } from '@/components/Toast';
import * as mydata from '@/lib/data/mydata';
import { centsLabel, expiringSoon } from '@/lib/mydata/status';
import { MYDATA_EXPIRY_NOTICE_DAYS } from '@/lib/mydata/retention';
import { reviewLine, suggestedCategory, asksPayment, paymentFields, PAYMENT_CHOICES, displayName, type PaymentAnswer } from '@/lib/mydata/review';
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

interface Draft { slug: string; propertyId: string; pay: PaymentAnswer | null; paidOn: string }

export default function MydataInbox({ propertyId, userId, properties = [], onFiled }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<mydata.PendingDoc[]>([]);
  const [alerts, setAlerts] = useState<mydata.PendingDoc[]>([]);
  const [auto, setAuto] = useState<mydata.PendingDoc[]>([]);
  const [notProperty, setNotProperty] = useState(0);
  // Χωρίς τίποτα για έλεγχο, όσα μπήκαν μόνα τους φαίνονται ανοιχτά.
  const [showAuto, setShowAuto] = useState<boolean | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  // «Είναι η ίδια με …;»: η υποψήφια δαπάνη της ανοιχτής κάρτας, ανά παραστατικό.
  const [match, setMatch] = useState<{ key: string; c: mydata.MatchCandidate | null } | null>(null);
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

  const many = properties.length > 1;
  const draftOf = (d: mydata.PendingDoc): Draft => drafts[d.id] ?? { slug: suggestedCategory({ counterpart_afm: d.counterpart_afm, counterpart_name: d.counterpart_name, category: d.category ?? null }), propertyId, pay: null, paidOn: '' };
  const patch = (d: mydata.PendingDoc, part: Partial<Draft>) =>
    setDrafts(x => ({ ...x, [d.id]: { ...draftOf(d), ...part } }));
  const openId = rows.some(r => r.id === open) ? open : rows[0]?.id;
  const openDoc = rows.find(r => r.id === openId) ?? null;
  const openDraft = openDoc ? draftOf(openDoc) : null;
  const openDocId = openDoc?.id ?? '';
  const openProp = openDraft?.propertyId || propertyId;
  const openLabel = openDraft?.slug ? BY_SLUG[openDraft.slug]?.label ?? '' : '';
  const matchKey = openDocId ? `${openDocId}|${openProp}|${openLabel}` : '';

  // Η ΥΠΟΨΗΦΙΑ ΔΑΠΑΝΗ ΤΗΣ ΑΝΟΙΧΤΗΣ ΚΑΡΤΑΣ: η βάση ψάχνει με τον ανεκτικό κανόνα
  // (ίδιο ακίνητο, ΑΦΜ ή κατηγορία, ±1€ ή ίδιος αριθμός, ±10 ημέρες).
  useEffect(() => {
    if (!openDocId) return;
    let live = true;
    mydata.matchDoc(supabase, openDocId, openProp, openLabel)
      .then(({ data }) => { if (live) setMatch({ key: matchKey, c: data }); });
    return () => { live = false; };
  }, [supabase, openDocId, openProp, openLabel, matchKey]);

  if (!rows.length && !alerts.length && !auto.length) return null;

  const gone = (id: string) => setRows(list => list.filter(x => x.id !== id));

  const file = async (d: mydata.PendingDoc) => {
    const dr = draftOf(d);
    const cat = dr.slug ? BY_SLUG[dr.slug] : null;
    if (!cat) return;
    const ask = asksPayment(d, dr.slug);
    if (ask && !dr.pay) return;
    setBusy(d.id);
    const payment = ask ? paymentFields(dr.pay, dr.paidOn) : undefined;
    const r = await mydata.fileDoc(supabase, d, { propertyId: dr.propertyId || propertyId, userId }, cat.label, displayName(d), { slug: cat.slug, payment });
    setBusy(null);
    if (!r.expenseId) { notifyError('Η δαπάνη δεν καταχωρήθηκε'); return; }
    if (!r.linked) notifyError('Η δαπάνη καταχωρήθηκε. Το παραστατικό θα ξαναφανεί εδώ.');
    gone(d.id);
    onFiled?.();
  };

  const same = async (d: mydata.PendingDoc, c: mydata.MatchCandidate) => {
    const dr = draftOf(d);
    setBusy(d.id);
    const r = await mydata.linkDoc(supabase, d.id, c.expenseId, dr.propertyId || propertyId, dr.slug ? BY_SLUG[dr.slug]?.label ?? '' : '');
    setBusy(null);
    if (!r.ok) { notifyError('Δεν δέθηκε. Η δαπάνη άλλαξε στο μεταξύ.'); setMatch(null); return; }
    notify('Δέθηκε με τη δαπάνη που είχες ήδη');
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

  const autoOpen = showAuto ?? !rows.length;
  // Κ-9: όσα περιμένουν απόφαση σβήνουν μετά από MYDATA_PENDING_DAYS· λέγεται πριν.
  const expiring = expiringSoon(rows.map(d => d.fetched_at ?? '').filter(Boolean));

  const summary = [
    rows.length ? plural(rows.length, 'για έλεγχο', 'για έλεγχο') : null,
    auto.length ? plural(auto.length, 'καταχωρήθηκε αυτόματα', 'καταχωρήθηκαν αυτόματα') : null,
    notProperty ? plural(notProperty, 'δεν αφορούσε ακίνητα', 'δεν αφορούσαν ακίνητα') : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card style={{ marginBottom: T.sp.lg }}>
      <SecHdr label="Από το myDATA" sub={summary} />
      {alerts.length > 0 && (
        <div role="region" aria-label="Ακυρώσεις από τον εκδότη" style={{ display: 'grid', gap: 10, marginBottom: rows.length || auto.length ? T.sp.md : 0 }}>
          {alerts.map(d => {
            // Δεμένο με δαπάνη που πέρασε ο ίδιος: η δαπάνη του δεν σβήνει από εδώ.
            const mine = d.needs_attention === 'cancelled_linked';
            return (
              <div key={d.id} style={{ display: 'grid', gap: 8, padding: '12px 14px', minWidth: 0, borderRadius: T.radius.card, background: 'var(--warning-soft)', border: '1px solid var(--warning-border)' }}>
                <span style={{ ...TT.body, fontWeight: 600, color: 'var(--warning-on-container)' }}>{mine ? 'Θέλει έλεγχο' : 'Ακυρώθηκε από τον εκδότη'}</span>
                <span style={{ ...TT.bodySm, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  {displayName(d)} · {d.title}{' '}· {fd(d.issue_date)} · {centsLabel(Number(d.gross_cents), d.is_credit)}.
                  {mine ? ' Ο εκδότης το ακύρωσε. Ήταν δεμένο με δαπάνη που πέρασες εσύ: έλεγξέ τη στις Δαπάνες.' : ' Την είχες καταχωρήσει ως δαπάνη.'}
                </span>
                <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {mine ? (
                    <Btn variant="secondary" onClick={() => void ack(d, false)} disabled={busy === d.id}>Το είδα</Btn>
                  ) : (
                    <>
                      <Btn variant="primary" onClick={() => void ack(d, true)} disabled={busy === d.id}>Σβήσε τη δαπάνη</Btn>
                      <Btn variant="secondary" onClick={() => void ack(d, false)} disabled={busy === d.id}>Κράτησέ τη</Btn>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {expiring > 0 && (
        <p role="note" style={{ ...TT.bodySm, margin: `0 0 ${T.sp.sm}px`, color: 'var(--warning-on-container)' }}>
          {expiring === 1 ? '1 παραστατικό σβήνει' : `${expiring} παραστατικά σβήνουν`} μέσα σε {MYDATA_EXPIRY_NOTICE_DAYS}{'\u00a0'}ημέρες, αν δεν αποφασίσεις. Το πρωτότυπο μένει στο myDATA.
        </p>
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
          const ask = asksPayment(d, dr.slug);
          const twin = match && match.key === matchKey ? match.c : null;
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
              {twin && (
                <div role="group" aria-label="Δαπάνη που μοιάζει" style={{ display: 'grid', gap: 8, padding: '10px 12px', borderRadius: T.radius.inner, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <p style={{ ...TT.bodySm, margin: 0, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    Μοιάζει με δαπάνη που έχεις ήδη: {twin.vendor || twin.description} · {fe(Number(twin.amount))} · {fd(twin.date)}
                  </p>
                  <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn variant="secondary" onClick={() => void same(d, twin)} disabled={busyHere}>Είναι η ίδια</Btn>
                  </div>
                </div>
              )}
              {ask && (
                <div role="group" aria-label="Πώς πληρώθηκε;" style={{ display: 'grid', gap: 8 }}>
                  <p style={{ ...TT.body, margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Πώς πληρώθηκε;</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {PAYMENT_CHOICES.map(c => (
                      <ChipToggle key={c.key} on={dr.pay === c.key} onClick={() => patch(d, { pay: c.key })}>{c.label}</ChipToggle>
                    ))}
                  </div>
                  {(dr.pay === 'bank' || dr.pay === 'cash') && (
                    <div style={{ maxWidth: 240 }}>
                      <DatePicker label="Ημερομηνία πληρωμής (προαιρετική)" value={dr.paidOn} onChange={v => patch(d, { paidOn: v })} />
                    </div>
                  )}
                </div>
              )}
              <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="primary" onClick={() => void file(d)} disabled={!dr.slug || (ask && !dr.pay) || busyHere}>{busyHere ? 'Καταχώρηση…' : 'Καταχώρηση'}</Btn>
                <Btn variant="ghost" onClick={() => void dismiss(d)} disabled={busyHere}>Δεν αφορά ακίνητο</Btn>
              </div>
              <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)' }}>
                <Btn variant="ghost" onClick={() => void ignore(d)} disabled={busyHere}>Πάντα αγνόησε αυτόν τον πάροχο</Btn>
              </div>
            </div>
          );
        })}
      </div>
      {auto.length > 0 && (
        <div style={{ marginTop: rows.length ? T.sp.md : 0 }}>
          <Btn variant="ghost" onClick={() => setShowAuto(!autoOpen)} expanded={autoOpen} controls="md-auto-list">
            {autoOpen ? 'Κρύψε όσα καταχωρήθηκαν αυτόματα' : `Καταχωρήθηκαν αυτόματα · ${auto.length.toLocaleString('el-GR')}`}
          </Btn>
          {autoOpen && (
            <ul id="md-auto-list" style={{ listStyle: 'none', margin: `${T.sp.sm}px 0 0`, padding: 0, display: 'grid', gap: 8 }}>
              {auto.map(d => (
                <li key={d.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', borderRadius: T.radius.card, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ ...TT.bodySm, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontWeight: 600 }}>{displayName(d)}</span> · {centsLabel(Number(d.gross_cents), d.is_credit)} · {dayMonth(d.issue_date)}
                    {d.category && BY_SLUG[d.category] ? ` · ${BY_SLUG[d.category].label}` : ''}
                  </span>
                  <Btn variant="ghost" onClick={() => void undo(d)} disabled={busy === d.id}>Αναίρεση</Btn>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
