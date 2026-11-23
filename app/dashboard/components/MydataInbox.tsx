'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ ΑΠΟ ΤΟ myDATA: ΕΤΟΙΜΕΣ ΔΑΠΑΝΕΣ, ΓΙΑ ΕΛΕΓΧΟ
// ─────────────────────────────────────────────────────────────────────────
// Δίπλα στο «Ήρθαν με email» (InboundInbox.tsx), με τους ίδιους κανόνες: ΜΙΑ
// ανοιχτή γραμμή τη φορά, οι υπόλοιπες κλειστές σε μία σειρά· όταν δεν υπάρχει
// τίποτα, δεν φαίνεται τίποτα.
//
// ΤΟ ΠΟΣΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Το έδωσε η ΑΑΔΕ και καταχωρείται ΑΚΡΙΒΩΣ έτσι
// (μικτό και ΦΠΑ από τα λεπτά της βάσης)· η βάση δένει το παραστατικό μόνο αν
// η δαπάνη έχει αυτά τα ποσά. Ο ιδιοκτήτης διαλέγει ακίνητο και κατηγορία.
//
// ΟΧΙ ΟΛΑ ΑΦΟΡΟΥΝ ΤΟ ΑΚΙΝΗΤΟ. Ενα σούπερ μάρκετ θα ερχόταν κι αυτό: γι' αυτό
// τίποτα δεν καταχωρείται μόνο του (σε αυτή τη φάση) και υπάρχουν το «Δεν
// είναι δαπάνη» και το «Πάντα αγνόησε αυτόν τον πάροχο».
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Card, SecHdr, Btn, fieldRow, fd } from '@/components/Theme';
import { CustomSelect } from './UIComponents';
import { CATEGORIES, BY_SLUG } from '@/lib/expenses/taxonomy';
import { notify, notifyError } from '@/components/Toast';
import * as mydata from '@/lib/data/mydata';
import { centsLabel } from '@/lib/mydata/status';
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

/** Ο πάροχος: το όνομα αν το έστειλε ο εκδότης, αλλιώς «ΑΦΜ …». */
const who = (d: mydata.PendingDoc): string => d.counterpart_name || `ΑΦΜ ${d.counterpart_afm}`;

export default function MydataInbox({ propertyId, userId, properties = [], onFiled }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<mydata.PendingDoc[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { slug: string; propertyId: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    mydata.pendingDocs(supabase, userId).then(({ rows: found }) => { if (live) setRows(found); });
    // Ο νυχτερινός συγχρονισμός ή το «Συγχρονισμός τώρα» του λογιστή φέρνει νέα: τα δείχνει χωρίς ανανέωση.
    const ch = supabase.channel(`mydata_inbox_${userId}_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mydata_docs', filter: `client_id=eq.${userId}` }, () => { if (live) setNonce(n => n + 1); })
      .subscribe();
    return () => { live = false; void supabase.removeChannel(ch); };
  }, [supabase, userId, nonce]);

  if (!rows.length) return null;

  const many = properties.length > 1;
  const draftOf = (id: string) => drafts[id] ?? { slug: '', propertyId };
  const patch = (id: string, part: Partial<{ slug: string; propertyId: string }>) =>
    setDrafts(d => ({ ...d, [id]: { ...draftOf(id), ...part } }));
  const openId = rows.some(r => r.id === open) ? open : rows[0]?.id;
  const gone = (id: string) => setRows(list => list.filter(x => x.id !== id));

  const file = async (d: mydata.PendingDoc) => {
    const dr = draftOf(d.id);
    const cat = dr.slug ? BY_SLUG[dr.slug] : null;
    if (!cat) return;
    setBusy(d.id);
    const r = await mydata.fileDoc(supabase, d, { propertyId: dr.propertyId || propertyId, userId }, cat.label, who(d));
    setBusy(null);
    if (!r.expenseId) { notifyError('Η δαπάνη δεν καταχωρήθηκε'); return; }
    if (!r.linked) notifyError('Η δαπάνη καταχωρήθηκε. Το παραστατικό θα ξαναφανεί εδώ.');
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
    notify(`Δεν θα έρχεται τίποτα από ${who(d)}`);
  };

  return (
    <Card style={{ marginBottom: T.sp.lg }}>
      <SecHdr label="Από το myDATA" sub="Για έλεγχο. Καταχωρείς ό,τι αφορά το ακίνητο." />
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map(d => {
          const amount = centsLabel(Number(d.gross_cents), d.is_credit);
          if (d.id !== openId) return (
            <button key={d.id} type="button" className="inbound-row" onClick={() => setOpen(d.id)} aria-expanded={false}
              aria-label={`Άνοιγμα: ${who(d)}, ${amount}`}>
              <span className="inbound-who po-elide" style={{ ...TT.body, textWrap: undefined, fontWeight: 600, color: 'var(--text-primary)' }}>{who(d)}</span>
              <span className="inbound-what po-elide" style={{ ...TT.bodySm, textWrap: undefined, color: 'var(--text-secondary)' }}>{d.title}</span>
              <span style={{ ...TT.bodySm, textWrap: undefined, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flex: '0 0 auto', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{dayMonth(d.issue_date)}</span>
              <span className="inbound-sum" style={{ ...TT.bodySm, textWrap: undefined, fontWeight: 600, color: 'var(--text-primary)' }}>{amount}</span>
            </button>
          );
          const dr = draftOf(d.id);
          return (
            <div key={d.id} style={{ display: 'grid', gap: 10, padding: '12px 14px', minWidth: 0, borderRadius: T.radius.card, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ ...TT.body, fontWeight: 600, color: 'var(--text-primary)' }}>{who(d)}</span>
                <span style={{ ...TT.body, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{amount}</span>
              </div>
              <div style={{ ...TT.bodySm, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {d.title}{"\u00a0"}· {fd(d.issue_date)}
              </div>
              <div style={{ ...TT.bodySm, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                Καθαρό {centsLabel(Number(d.net_cents), d.is_credit)} · ΦΠΑ {centsLabel(Number(d.vat_cents), d.is_credit)} · ΜΑΡΚ <span translate="no">{d.mark}</span>
              </div>
              <div {...fieldRow(180)}>
                {many && (
                  <CustomSelect label="Ακίνητο" value={dr.propertyId} onChange={v => patch(d.id, { propertyId: v })}
                    options={properties.map(p => ({ value: p.id, label: p.name }))} />
                )}
                <CustomSelect label="Κατηγορία" value={dr.slug} onChange={v => patch(d.id, { slug: v })} placeholder="Διάλεξε κατηγορία"
                  options={CATEGORIES.map(c => ({ value: c.slug, label: c.label }))} />
              </div>
              <div className="act-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="primary" onClick={() => void file(d)} disabled={!dr.slug || busy === d.id}>{busy === d.id ? 'Καταχώρηση…' : 'Καταχώρηση'}</Btn>
                <Btn variant="secondary" onClick={() => void dismiss(d)} disabled={busy === d.id}>Δεν είναι δαπάνη</Btn>
                <Btn variant="ghost" onClick={() => void ignore(d)} disabled={busy === d.id}>Πάντα αγνόησε αυτόν τον πάροχο</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
