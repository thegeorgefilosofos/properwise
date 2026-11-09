'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ΠΡΙΝ ΑΠΟ ΤΟΝ ΠΡΩΤΟ ΠΕΛΑΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Η βάση αρνείται στο ενεργό μέλος γραφείου κάθε κλήση χωρίς `aal2`
// (20261104150000, `mfa_satisfied`): λίστα πελατών, φάκελος, καταχώρηση,
// αρχεία. Οποιος βλέπει δεδομένα πολλών ανθρώπων χωρίς δεύτερο παράγοντα είναι
// ανοιχτή πόρτα. Η οθόνη δεν το μαντεύει: εμφανίζεται μόνο όταν η ίδια η βάση
// απάντησε `mfa_required`.
//
// Ο ΙΔΙΟΣ ΜΗΧΑΝΙΣΜΟΣ ΜΕ ΤΙΣ ΡΥΘΜΙΣΕΙΣ. `mfa.enroll`, `mfa.challenge`,
// `mfa.verify` του Supabase, όπως η «Επαλήθευση δύο βημάτων» της Ασφάλειας
// (app/dashboard/components/SecuritySettings.tsx): ίδια συσκευή, ίδια
// εφαρμογή, ίδιο ιστορικό ασφαλείας. Ο λογαριασμός γραφείου δεν έχει πίνακα
// ιδιοκτήτη, οπότε η εγγραφή γίνεται εδώ, στη θέση της λίστας.
//
// ΔΥΟ ΠΕΡΙΠΤΩΣΕΙΣ. Χωρίς συσκευή: κωδικός QR και εξαψήφιος. Με συσκευή σε
// συνεδρία `aal1` (σπάνιο: ο διαμεσολαβητής τη στέλνει ήδη στη σύνδεση): μόνο ο
// εξαψήφιος.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, TT, Card, Btn, Skeleton } from '@/components/Theme';
import { TextInput } from '@/app/dashboard/components/UIComponents';
import { MFA_SAY } from '@/lib/auth/mfa';
import { logActivity } from '@/lib/activity';
import { PortalBar, PortalTitle, portalWrap } from '../Chrome';

type Step =
  | { kind: 'loading' }
  | { kind: 'enroll'; id: string; qr: string; secret: string }
  | { kind: 'challenge'; id: string }
  | { kind: 'unavailable' };

interface Factor { id: string; status: string }

/**
 * Το Supabase δίνει τον κωδικό ως `data:image/svg+xml;utf-8,<svg …>` με
 * εισαγωγικά μέσα. Σε `url("…")` θα έκλειναν τη συμβολοσειρά: το σώμα
 * ξανακωδικοποιείται ολόκληρο. Το base64 περνά όπως είναι.
 */
function cssDataUri(u: string): string {
  const i = u.indexOf(',');
  if (i < 0 || u.slice(0, i).includes('base64')) return u;
  let body = u.slice(i + 1);
  try { body = decodeURIComponent(body); } catch { /* ήταν ήδη ακατέργαστο */ }
  return `${u.slice(0, i)},${encodeURIComponent(body)}`;
}

const caption: React.CSSProperties = { ...TT.bodySm, color: 'var(--text-primary)', fontWeight: 600, margin: 0 };
const quiet: React.CSSProperties = { ...TT.bodySm, color: 'var(--text-tertiary)', margin: 0 };

export default function SecondStep({ onDone }: { onDone: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: list, error: listErr } = await supabase.auth.mfa.listFactors();
      if (!alive) return;
      if (listErr) { setStep({ kind: 'unavailable' }); return; }
      const totp = (list?.totp ?? []) as Factor[];
      const verified = totp.find(f => f.status === 'verified');
      if (verified) { setStep({ kind: 'challenge', id: verified.id }); return; }
      // Ο,ΤΙ ΕΜΕΙΝΕ ΜΙΣΟ ΦΕΥΓΕΙ ΠΡΩΤΑ. Αλλιώς το `enroll` σκάει με «factor
      // already exists» και ο άνθρωπος ξαναπατά για πάντα (όπως στις Ρυθμίσεις).
      for (const f of totp) {
        if (f.status !== 'verified') { try { await supabase.auth.mfa.unenroll({ factorId: f.id }); } catch { /* αγνόησε */ } }
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'PROPERWISE' });
      if (!alive) return;
      if (error || !data) { setStep({ kind: 'unavailable' }); return; }
      setStep({ kind: 'enroll', id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => { alive = false; };
  }, [supabase, tries]);

  const verify = async () => {
    if (step.kind !== 'enroll' && step.kind !== 'challenge') return;
    if (code.length !== 6) { setErr(MFA_SAY.wrong); return; }
    setBusy(true); setErr('');
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: step.id });
    const { error } = ch && !chErr
      ? await supabase.auth.mfa.verify({ factorId: step.id, challengeId: ch.id, code })
      : { error: chErr ?? new Error('challenge') };
    setBusy(false);
    // ΕΝΑ ΜΗΝΥΜΑ ΓΙΑ ΚΑΘΕ ΑΠΟΤΥΧΙΑ: «λάθος κωδικός» και «έληξε η πρόκληση»
    // δεν ξεχωρίζουν από έξω (app/login/page.tsx).
    if (error) { setErr(MFA_SAY.wrong); setCode(''); return; }
    if (step.kind === 'enroll') void logActivity(supabase, 'mfa_enabled', 'security');
    onDone();
  };

  const enrolling = step.kind === 'enroll';

  return (
    <div className="po-floor" style={{ background: 'var(--bg-base)', minHeight: '100vh', paddingBottom: 72 }}>
      <PortalBar />
      <main style={portalWrap}>
        <PortalTitle
          over={enrolling ? 'Πριν από τον πρώτο πελάτη' : 'Δεύτερο βήμα'}
          title="Επαλήθευση δύο βημάτων"
          meta={enrolling
            ? 'Το γραφείο βλέπει φακέλους άλλων ανθρώπων. Γι’ αυτό κάθε μέλος μπαίνει με τον κωδικό του και με την εφαρμογή επαλήθευσης στο κινητό.'
            : MFA_SAY.ask}
        />

        {step.kind === 'loading' && <Card><Skeleton h={168} /></Card>}

        {step.kind === 'unavailable' && (
          <Card>
            <p style={{ ...TT.body, color: 'var(--text-secondary)', margin: '0 0 14px' }}>{MFA_SAY.stuck}</p>
            <Btn onClick={() => { setStep({ kind: 'loading' }); setTries(t => t + 1); }}>Δοκίμασε ξανά</Btn>
          </Card>
        )}

        {(step.kind === 'enroll' || step.kind === 'challenge') && (
          <Card>
            {/* ΔΥΟ ΣΤΗΛΕΣ ΣΤΗΝ ΟΘΟΝΗ, ΜΙΑ ΣΤΟ ΚΙΝΗΤΟ. Ο κωδικός QR αριστερά, τα
                βήματα δεξιά: το μάτι διαβάζει «σάρωσε, γράψε, συνέχισε» με
                τη σειρά που γίνονται. */}
            <div style={{ display: 'flex', gap: T.sp.xl, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {step.kind === 'enroll' && (
                <div style={{ flex: '0 0 auto', display: 'grid', gap: T.sp.sm }}>
                  <p style={caption}>1. Σάρωσε τον κωδικό QR</p>
                  <div style={{ display: 'inline-flex', padding: 10, background: 'var(--bg-surface)', borderRadius: T.radius.inner, border: '1px solid var(--border-default)', width: 'fit-content' }}>
                    {/* Ο ΚΩΔΙΚΟΣ ΕΙΝΑΙ data: URI ΤΟΥ SUPABASE, όχι εικόνα για βελτιστοποίηση:
                        φόντο αντί για <img>, χωρίς σίγαση του ESLint. */}
                    <span role="img" aria-label="Κωδικός QR για την εφαρμογή επαλήθευσης"
                      style={{ display: 'block', width: 168, height: 168, backgroundImage: `url("${cssDataUri(step.qr)}")`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }} />
                  </div>
                </div>
              )}
              <div style={{ flex: '1 1 280px', minWidth: 0, display: 'grid', gap: T.sp.lg }}>
                {step.kind === 'enroll' && (
                  <div style={{ display: 'grid', gap: T.sp.sm }}>
                    <p style={quiet}>Δεν σαρώνεται; Γράψε στην εφαρμογή αυτόν τον κωδικό:</p>
                    {/* ΣΕ ΤΕΤΡΑΔΕΣ, ΟΠΩΣ ΤΟΝ ΔΕΙΧΝΕΙ Η ΙΔΙΑ Η ΕΦΑΡΜΟΓΗ ΕΠΑΛΗΘΕΥΣΗΣ. Με
                        `break-all` στα 360 ο κωδικός έσπαγε όπου έτυχε και άφηνε ένα
                        γράμμα μόνο του στη δεύτερη γραμμή. Τα κενά δεν πειράζουν: οι
                        εφαρμογές τα αγνοούν. */}
                    <div style={{ ...TT.mono, userSelect: 'all', overflowWrap: 'anywhere', letterSpacing: '0.04em', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner }}>
                      {step.secret.replace(/(.{4})(?=.)/g, '$1 ')}
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gap: T.sp.sm }}>
                  <p style={caption}>{step.kind === 'enroll' ? '2. Γράψε τον εξαψήφιο κωδικό της εφαρμογής' : 'Ο εξαψήφιος κωδικός της εφαρμογής'}</p>
                  <div style={{ display: 'flex', gap: T.sp.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: '0 1 200px', minWidth: 160 }}>
                      <TextInput ariaLabel="Εξαψήφιος κωδικός" inputMode="numeric" mono placeholder="123456"
                        value={code} onChange={v => { setCode(v.replace(/\D/g, '').slice(0, 6)); setErr(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') void verify(); }} />
                    </div>
                    <Btn variant="primary" size="lg" onClick={() => void verify()} disabled={busy || code.length !== 6}>
                      {busy ? 'Επιβεβαίωση…' : step.kind === 'enroll' ? 'Ενεργοποίηση' : 'Συνέχεια'}
                    </Btn>
                  </div>
                  {err && <p role="alert" style={{ ...TT.bodySm, color: 'var(--negative)', margin: 0 }}>{err}</p>}
                </div>
                {step.kind === 'enroll' && (
                  <p style={quiet}>Από εδώ και πέρα, κάθε σύνδεση θα ζητά και τον εξαψήφιο κωδικό.</p>
                )}
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
