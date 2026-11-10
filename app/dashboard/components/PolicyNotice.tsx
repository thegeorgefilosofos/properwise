'use client';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΝΗΜΕΡΩΣΗ ΓΙΑ ΤΟΥΣ ΟΡΟΥΣ, ΜΙΑ ΦΟΡΑ ΑΝΑ ΕΚΔΟΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Μία γραμμή, χωρίς έντονα χρώματα, κάτω από την κεφαλίδα της Επισκόπησης.
// Το κλείσιμο γράφεται στα στοιχεία του λογαριασμού (`policy_notice_seen`),
// ώστε να μη ζητηθεί ξανά σε άλλη συσκευή και να μένει ίχνος ότι η ενημέρωση
// δόθηκε. Το τοπικό αντίγραφο κρατά το πλαίσιο κλειστό αν η εγγραφή αργήσει.
// Ποιος τη βλέπει το κρίνει το lib/legal/policyNotice.ts.
//
// ΣΤΗΝ ΕΚΔΟΣΗ ΤΩΝ ΛΟΓΙΣΤΙΚΩΝ ΓΡΑΦΕΙΩΝ (ΑΠ-11) ο ιδιοκτήτης με λογαριασμό από
// πριν βλέπει στη θέση της γραμμής μια μικρή κάρτα: τίτλος, δύο προτάσεις,
// «Δες τι άλλαξε» και «Εντάξει». Ίδιος μηχανισμός, δικό της ίχνος
// (`firm_notice_seen`)· το «Εντάξει» κλείνει μόνο την κάρτα και, αν εκκρεμεί,
// εμφανίζεται μετά η γενική γραμμή της τρέχουσας έκδοσης.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, IconBtn, LinkBtn, Card, Btn } from '@/components/Theme';
import { POLICY_VERSION } from '@/lib/legal/identity';
import {
  POLICY_NOTICE_LEDE, POLICY_NOTICE_KEY, policyNoticeDue, policyNoticeCopy, type PolicyMeta, type PolicyNoticeCopy,
  FIRM_NOTICE_TITLE, FIRM_NOTICE_BODY, FIRM_NOTICE_HREF, FIRM_NOTICE_KEY, FIRM_NOTICE_VERSION, firmNoticeDue, type NoticeUser,
} from '@/lib/legal/policyNotice';

export default function PolicyNotice() {
  const supabase = createClient();
  const [show, setShow] = useState(false);
  const [firm, setFirm] = useState(false);
  const [line, setLine] = useState(false);
  const [open, setOpen] = useState(false);
  // Τι λέει η γραμμή: εξαρτάται από το τι έχει ήδη δει ο χρήστης (lib/legal/policyNotice.ts).
  const [copy, setCopy] = useState<PolicyNoticeCopy | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let local: string | null = null;
        let localFirm: string | null = null;
        try { local = localStorage.getItem(POLICY_NOTICE_KEY); localFirm = localStorage.getItem(FIRM_NOTICE_KEY); } catch { /* ιδιωτικό παράθυρο */ }
        if (local === POLICY_VERSION && localFirm === FIRM_NOTICE_VERSION) return;
        // Χωρίς απάντηση για τον λογαριασμό δεν κρίνεται τίποτα: το πλαίσιο
        // μένει κλειστό και ξαναρωτά στην επόμενη φόρτωση.
        const { data, error } = await supabase.auth.getUser();
        if (error || !alive) return;
        const card = firmNoticeDue(data.user as NoticeUser | null, localFirm);
        const meta = data.user?.user_metadata as PolicyMeta | undefined;
        const due = policyNoticeDue(meta, local);
        setFirm(card); setLine(due); setCopy(policyNoticeCopy(meta, local));
        if (card || due) setShow(true);
      } catch { /* σιωπηλά: χωρίς λογαριασμό δεν υπάρχει ενημέρωση */ }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show || !copy) return null;

  const dismiss = () => {
    try { localStorage.setItem(POLICY_NOTICE_KEY, POLICY_VERSION); } catch { /* noop */ }
    setShow(false);
    void supabase.auth.updateUser({ data: { policy_notice_seen: POLICY_VERSION, policy_notice_seen_at: new Date().toISOString() } })
      .catch(() => { /* το τοπικό αντίγραφο αρκεί ως την επόμενη φορά */ });
  };

  // Η κάρτα κλείνει μόνο τον εαυτό της· η γενική γραμμή, αν εκκρεμεί, ακολουθεί.
  const dismissFirm = () => {
    try { localStorage.setItem(FIRM_NOTICE_KEY, FIRM_NOTICE_VERSION); } catch { /* noop */ }
    setFirm(false);
    if (!line) setShow(false);
    void supabase.auth.updateUser({ data: { firm_notice_seen: FIRM_NOTICE_VERSION, firm_notice_seen_at: new Date().toISOString() } })
      .catch(() => { /* το τοπικό αντίγραφο αρκεί ως την επόμενη φορά */ });
  };

  if (firm) return (
    // ΚΑΡΤΑ, ΟΧΙ ΑΝΑΔΥΟΜΕΝΟ. Κάθεται στη θέση της γραμμής, κάτω από την
    // κεφαλίδα και δεν σταματά τίποτα: η Επισκόπηση δουλεύει από κάτω.
    <Card gap={false} style={{ marginBottom: T.sp.lg }}>
      <section aria-labelledby="firm-notice-title">
        <h2 id="firm-notice-title" style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans, lineHeight: 1.4, margin: 0 }}>
          {FIRM_NOTICE_TITLE}
        </h2>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', fontFamily: T.font.sans, lineHeight: 1.5, margin: `${T.sp.xs}px 0 0`, maxWidth: '72ch' }}>
          {FIRM_NOTICE_BODY}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: T.sp.sm, marginTop: T.sp.md }}>
          <Btn variant="secondary" onClick={dismissFirm}>Εντάξει</Btn>
          <Btn variant="ghost" href={FIRM_NOTICE_HREF} newTab>Δες τι άλλαξε</Btn>
        </div>
      </section>
    </Card>
  );

  return (
    // ΜΙΑ ΓΡΑΜΜΗ ΚΑΙ ΤΟ «×» (20/10/2026): η γραμμή λέει τι άλλαξε (Όροι και
    // Απόρρητο, ή μόνο Απόρρητο), το «Τι άλλαξε» ανοίγει από κάτω την πλήρη
    // πρόταση, την περίληψη και τον σύνδεσμο στο κείμενο. Ούτε κρυμμένη ούτε τρεις γραμμές
    // πάνω από το ποσό: κάθεται κάτω από την κεφαλίδα της Επισκόπησης.
    <section aria-label="Τι άλλαξε στους όρους χρήσης" style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: T.radius.card, padding: '12px 16px', marginBottom: 16,
    }}>
      {/* Το κέντρο της πρώτης γραμμής: (ύψος γραμμής − 6) / 2, με το ύψος γραμμής
          1,5 × --fs-base όπως η παράγραφος δίπλα της. */}
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: T.radius.pill, background: 'var(--text-tertiary)', flexShrink: 0, marginTop: 'calc((1.5 * var(--fs-base) - 6px) / 2)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', fontFamily: T.font.sans, lineHeight: 1.5, margin: 0 }}>
          <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{copy.short}</strong>{' '}
          {/* `po-tap-inline`: μέσα σε πρόταση, άρα τα 44 της αφής από ψευδοστοιχείο
              και όχι από δάπεδο ύψους που θα άνοιγε τη γραμμή (app/globals.css). */}
          <LinkBtn className="po-tap-inline" onClick={() => setOpen(o => !o)}>{open ? 'Απόκρυψη' : 'Τι άλλαξε'}</LinkBtn>
        </p>
        {open && (
          <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-tertiary)', fontFamily: T.font.sans, lineHeight: 1.6, margin: '8px 0 0', maxWidth: '78ch' }}>
            {copy.headline} {POLICY_NOTICE_LEDE} {copy.summary}{' '}
            <a href={copy.href} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecorationLine: 'underline', textUnderlineOffset: 3, textDecorationThickness: 1 }}>{copy.hrefLabel}</a>
          </p>
        )}
      </div>
      {/* Το «×» κεντράρεται κι αυτό στην πρώτη γραμμή, με αρνητικό περιθώριο
          ίσο με τη διαφορά των υψών: το κουμπί κρατά τα 32 (44 στην αφή) χωρίς
          να ψηλώνει το πλαίσιο. */}
      <IconBtn label="Το κατάλαβα" onClick={dismiss}
        style={{ marginBlock: 'calc((1.5 * var(--fs-base) - var(--h-sm)) / 2)' }}>
        <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </IconBtn>
    </section>
  );
}
