'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΥΠΟΣΤΗΡΙΞΗ ΑΠΟ ΜΕΣΑ ΑΠΟ ΤΗΝ ΕΦΑΡΜΟΓΗ
// ─────────────────────────────────────────────────────────────────────────
// Το email στο support@ δεν λέει με βεβαιότητα ποιος έγραψε· η φόρμα το λέει,
// γιατί στέλνει η συνεδρία. Γι' αυτό η προτεραιότητα του «Επαγγελματίας+»
// (Όροι, «Υποστήριξη») είναι εγγυημένη εδώ. Η διαδρομή: app/api/support.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { T, Btn } from '@/components/Theme';
import { notify } from '@/components/Toast';
import { PLANS, PLAN_ORDER, type PlanId } from '@/lib/billing/plans';
import { PRIORITY_FROM } from '@/lib/inbound/priority';
import { SUPPORT_SUBJECT_MAX, SUPPORT_MESSAGE_MAX, SUPPORT_MESSAGE_MIN } from '@/lib/support/form';

const field = (focused: boolean) => ({
  width: '100%', boxSizing: 'border-box' as const, padding: '10px 14px', borderRadius: T.radius.inner,
  border: `1px solid ${focused ? 'var(--accent)' : 'var(--border-control)'}`,
  boxShadow: focused ? '0 0 0 3px var(--accent-dim)' : 'none',
  background: 'var(--bg-surface)', color: 'var(--text-primary)',
  fontFamily: T.font.sans, fontSize: 'var(--fs-base)', lineHeight: 1.5, outline: 'none',
});

export default function SupportForm({ plan = 'free' }: { plan?: PlanId }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [focus, setFocus] = useState<'s' | 'm' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const priority = PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(PRIORITY_FROM);
  const ready = message.trim().length >= SUPPORT_MESSAGE_MIN && !busy;

  const send = async () => {
    if (!ready) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/support', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(data.error || 'Το μήνυμα δεν στάλθηκε.'); return; }
      setSent(true); setSubject(''); setMessage('');
      notify('Το μήνυμά σου στάλθηκε. Θα σου απαντήσουμε στο email του λογαριασμού.');
    } catch {
      setError('Το μήνυμα δεν στάλθηκε. Έλεγξε τη σύνδεσή σου και ξαναδοκίμασε.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: T.font.sans, letterSpacing: '-0.01em' }}>
        Υποστήριξη
      </div>
      <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.5, margin: '6px 0 0' }}>
        Η απάντηση έρχεται στο email του λογαριασμού σου.
        {priority && ` Με το «${PLANS[plan].name}» τα μηνύματα από εδώ απαντώνται κατά προτεραιότητα.`}
      </p>
      <input
        aria-label="Θέμα" value={subject} maxLength={SUPPORT_SUBJECT_MAX} placeholder="Θέμα (προαιρετικό)"
        onChange={e => { setSubject(e.target.value); if (error) setError(null); }}
        onFocus={() => setFocus('s')} onBlur={() => setFocus(null)}
        style={{ ...field(focus === 's'), marginTop: 12 }}
      />
      <textarea
        aria-label="Το μήνυμά σου" value={message} maxLength={SUPPORT_MESSAGE_MAX} rows={4}
        placeholder="Τι χρειάζεσαι;"
        onChange={e => { setMessage(e.target.value); if (error) setError(null); if (sent) setSent(false); }}
        onFocus={() => setFocus('m')} onBlur={() => setFocus(null)}
        style={{ ...field(focus === 'm'), marginTop: 8, resize: 'vertical', minHeight: 96 }}
      />
      {error && <div role="alert" style={{ fontSize: 12, color: 'var(--negative)', fontFamily: T.font.sans, marginTop: 6 }}>{error}</div>}
      {sent && !error && <div role="status" style={{ fontSize: 12, color: 'var(--positive)', fontFamily: T.font.sans, marginTop: 6 }}>Στάλθηκε.</div>}
      <div style={{ marginTop: 12 }}>
        <Btn variant="primary" onClick={() => { void send(); }} disabled={!ready}>{busy ? 'Αποστολή…' : 'Αποστολή'}</Btn>
      </div>
    </div>
  );
}
