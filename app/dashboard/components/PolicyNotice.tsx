'use client';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΝΗΜΕΡΩΣΗ ΓΙΑ ΤΟΥΣ ΟΡΟΥΣ, ΜΙΑ ΦΟΡΑ ΑΝΑ ΕΚΔΟΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ίδια μορφή με την υπενθύμιση τιμολόγησης: μία γραμμή, χωρίς έντονα χρώματα.
// Το κλείσιμο γράφεται στα στοιχεία του λογαριασμού (`policy_notice_seen`),
// ώστε να μη ζητηθεί ξανά σε άλλη συσκευή και να μένει ίχνος ότι η ενημέρωση
// δόθηκε. Το τοπικό αντίγραφο κρατά το πλαίσιο κλειστό αν η εγγραφή αργήσει.
// Ποιος τη βλέπει το κρίνει το lib/legal/policyNotice.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, IconBtn } from '@/components/Theme';
import { POLICY_VERSION } from '@/lib/legal/identity';
import { POLICY_CHANGE_SUMMARY, POLICY_NOTICE_KEY, policyNoticeDue, type PolicyMeta } from '@/lib/legal/policyNotice';

export default function PolicyNotice() {
  const supabase = createClient();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let local: string | null = null;
        try { local = localStorage.getItem(POLICY_NOTICE_KEY); } catch { /* ιδιωτικό παράθυρο */ }
        if (local === POLICY_VERSION) return;
        // Χωρίς απάντηση για τον λογαριασμό δεν κρίνεται τίποτα: το πλαίσιο
        // μένει κλειστό και ξαναρωτά στην επόμενη φόρτωση.
        const { data, error } = await supabase.auth.getUser();
        if (error) return;
        if (alive && policyNoticeDue(data.user?.user_metadata as PolicyMeta | undefined, local)) setShow(true);
      } catch { /* σιωπηλά: χωρίς λογαριασμό δεν υπάρχει ενημέρωση */ }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(POLICY_NOTICE_KEY, POLICY_VERSION); } catch { /* noop */ }
    setShow(false);
    void supabase.auth.updateUser({ data: { policy_notice_seen: POLICY_VERSION, policy_notice_seen_at: new Date().toISOString() } })
      .catch(() => { /* το τοπικό αντίγραφο αρκεί ως την επόμενη φορά */ });
  };

  return (
    <section aria-label="Τι άλλαξε στους όρους χρήσης" style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: T.radius.card, padding: '12px 16px', marginBottom: 16,
    }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: T.radius.pill, background: 'var(--text-tertiary)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans }}>
          Ενημερώσαμε τους Όρους
        </div>
        {/* Παράγραφος, όχι div: ο σύνδεσμος είναι λέξη της πρότασης, όπως στο
            πλαίσιο των cookies, άρα δεν μετρά ως χωριστό χειριστήριο αφής. */}
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.5, margin: '2px 0 0' }}>
          {POLICY_CHANGE_SUMMARY}{' '}
          <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecorationLine: 'underline', textUnderlineOffset: 2 }}>Δες τους Όρους</a>
        </p>
      </div>
      <IconBtn label="Το κατάλαβα" onClick={dismiss}>
        <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </IconBtn>
    </section>
  );
}
