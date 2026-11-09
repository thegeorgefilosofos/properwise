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
import { MFA_SAY, MFA_NAME_CONFLICT, pendingTotpIds, totpFriendlyName } from '@/lib/auth/mfa';
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

const stepTitle: React.CSSProperties = { ...TT.h2, margin: 0 };
const stepText: React.CSSProperties = { ...TT.bodySm, color: 'var(--text-secondary)', margin: 0 };
const quiet: React.CSSProperties = { ...TT.bodySm, color: 'var(--text-tertiary)', margin: 0 };

/** Ο κύκλος του αριθμού: πλάτος από την κλίμακα, ύψος από την αναλογία. */
const MARK = T.sp.xxl + T.sp.xs;

/**
 * ΕΝΑ ΒΗΜΑ ΤΟΥ ΟΔΗΓΟΥ. Αριθμός αριστερά και γραμμή που τον ενώνει με το
 * επόμενο· δεξιά τίτλος, μία πρόταση και ό,τι χρειάζεται εκείνη τη στιγμή.
 * Ο λογιστής που δεν έχει ξαναστήσει δεύτερο βήμα κολλούσε στο «σάρωσε τον
 * κωδικό»: δεν ήξερε ποια εφαρμογή, ούτε πού είναι το «+».
 */
function Stage({ n, title, text, last, children }: { n: number; title: string; text: string; last?: boolean; children?: React.ReactNode }) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: `${MARK}px minmax(0, 1fr)`, columnGap: T.sp.lg }}>
      <div aria-hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ width: MARK, aspectRatio: '1 / 1', borderRadius: T.radius.pill, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', border: '1px solid var(--border-default)', ...TT.bodySm, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        {!last && <span style={{ flex: 1, width: 1, marginBlock: T.sp.sm, background: 'var(--border-default)' }} />}
      </div>
      <div style={{ display: 'grid', gap: T.sp.md, paddingBottom: last ? 0 : T.sp.xl, minWidth: 0 }}>
        <div style={{ display: 'grid', gap: T.sp.xs, paddingTop: T.sp.xs }}>
          <h2 style={stepTitle}>{title}</h2>
          <p style={stepText}>{text}</p>
        </div>
        {children}
      </div>
    </li>
  );
}

export default function SecondStep({ onDone }: { onDone: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tries, setTries] = useState(0);
  const [copied, setCopied] = useState(false);

  const copySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Χωρίς άδεια στο πρόχειρο ο κωδικός μένει ορατός και επιλέξιμος.
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: list, error: listErr } = await supabase.auth.mfa.listFactors();
      if (!alive) return;
      if (listErr) { setStep({ kind: 'unavailable' }); return; }
      const totp = (list?.totp ?? []) as Factor[];
      const verified = totp.find(f => f.status === 'verified');
      if (verified) { setStep({ kind: 'challenge', id: verified.id }); return; }
      // Ο,ΤΙ ΕΜΕΙΝΕ ΜΙΣΟ ΦΕΥΓΕΙ ΠΡΩΤΑ, από το `all` (lib/auth/mfa.ts,
      // pendingTotpIds). Αν το σβήσιμο δεν πέτυχε, το όνομα παίρνει χρονοσφραγίδα
      // αντί να κολλήσει ο άνθρωπος στο «δοκίμασε ξανά».
      for (const id of pendingTotpIds(list)) {
        try { await supabase.auth.mfa.unenroll({ factorId: id }); } catch { /* αγνόησε */ }
      }
      let { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: totpFriendlyName(false) });
      if (error?.code === MFA_NAME_CONFLICT) {
        ({ data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: totpFriendlyName(true) }));
      }
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

  const codeRow = (
    <div style={{ display: 'grid', gap: T.sp.sm }}>
      {/* ΣΤΟ ΚΙΝΗΤΟ ΤΟ ΚΟΥΜΠΙ ΠΕΦΤΕΙ ΑΠΟ ΚΑΤΩ ΣΕ ΟΛΟ ΤΟ ΠΛΑΤΟΣ. Πεδίο και κουμπί
          δίπλα δίπλα δεν χωρούσαν στα 390 και το κουμπί έβγαινε έξω από την κάρτα. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: T.sp.sm, alignItems: 'center', maxWidth: 420 }}>
        <div style={{ flex: '999 1 180px', minWidth: 0 }}>
          <TextInput ariaLabel="Εξαψήφιος κωδικός" inputMode="numeric" mono placeholder="123456"
            value={code} onChange={v => { setCode(v.replace(/\D/g, '').slice(0, 6)); setErr(''); }}
            onKeyDown={e => { if (e.key === 'Enter') void verify(); }} />
        </div>
        <div style={{ flex: '1 1 auto', display: 'grid' }}>
          <Btn variant="primary" size="lg" onClick={() => void verify()} disabled={busy || code.length !== 6}>
            {busy ? 'Επιβεβαίωση…' : step.kind === 'enroll' ? 'Ενεργοποίηση' : 'Συνέχεια'}
          </Btn>
        </div>
      </div>
      {err && <p role="alert" style={{ ...TT.bodySm, color: 'var(--negative)', margin: 0 }}>{err}</p>}
    </div>
  );

  const enrolling = step.kind === 'enroll';

  return (
    <div className="po-floor" style={{ background: 'var(--bg-base)', minHeight: '100vh', paddingBottom: 72 }}>
      <PortalBar />
      <main style={portalWrap}>
        {/* ΕΝΑ ΠΛΑΤΟΣ ΓΙΑ ΟΛΗ ΤΗ ΣΕΛΙΔΑ. Τίτλος, εξήγηση και κάρτα τελειώνουν στην
            ίδια δεξιά άκρη· η εξήγηση δεν σέρνεται πέρα από την κάρτα. */}
        <div style={{ maxWidth: 640 }}>
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

        {step.kind === 'challenge' && <Card>{codeRow}</Card>}

        {step.kind === 'enroll' && (
          <div>
            <Card>
              {/* ΤΡΙΑ ΒΗΜΑΤΑ ΣΕ ΜΙΑ ΣΤΗΛΗ, ΣΤΗ ΣΕΙΡΑ ΠΟΥ ΓΙΝΟΝΤΑΙ: εφαρμογή, σάρωση,
                  εξαψήφιος. Το ίδιο πλάτος σε οθόνη και κινητό, ώστε τα κείμενα να
                  μη σέρνονται σε όλη την οθόνη ούτε να σπάνε σε λέξη μόνη της. */}
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                <Stage n={1} title="Κατέβασε την εφαρμογή"
                  text="Google Authenticator ή Microsoft Authenticator, στο κινητό σου." />
                <Stage n={2} title="Σάρωσε τον κωδικό QR"
                  text="Στην εφαρμογή πάτα «+» και στόχευσε τον κωδικό.">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: T.sp.lg, alignItems: 'center' }}>
                    <div style={{ display: 'inline-flex', padding: T.sp.sm, background: 'var(--bg-surface)', borderRadius: T.radius.inner, border: '1px solid var(--border-default)' }}>
                      {/* Ο ΚΩΔΙΚΟΣ ΕΙΝΑΙ data: URI ΤΟΥ SUPABASE, όχι εικόνα για βελτιστοποίηση:
                          φόντο αντί για <img>, χωρίς σίγαση του ESLint. */}
                      <span role="img" aria-label="Κωδικός QR για την εφαρμογή επαλήθευσης"
                        style={{ display: 'block', width: 152, aspectRatio: '1 / 1', backgroundImage: `url("${cssDataUri(step.qr)}")`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }} />
                    </div>
                    <div style={{ flex: '1 1 200px', minWidth: 0, display: 'grid', gap: T.sp.sm }}>
                      <p style={quiet}>Από το ίδιο κινητό; Αντίγραψε τον κωδικό και επικόλλησέ τον στην εφαρμογή.</p>
                      {/* ΤΕΣΣΕΡΙΣ ΤΕΤΡΑΔΕΣ ΑΝΑ ΣΕΙΡΑ. Ο κωδικός είναι 32 χαρακτήρες: σε
                          ελεύθερη ροή έβγαιναν επτά τετράδες και μία μόνη της από κάτω.
                          Τα κενά δεν πειράζουν: οι εφαρμογές τα αγνοούν. */}
                      {/* ΚΩΔΙΚΟΣ ΚΑΙ ΚΟΥΜΠΙ ΣΤΟ ΙΔΙΟ ΠΛΑΤΟΣ: μία στήλη `inline-grid`, ώστε οι
                          δύο ακμές να πέφτουν η μία κάτω από την άλλη. */}
                      <div style={{ display: 'inline-grid', gap: T.sp.sm, width: 'fit-content', maxWidth: '100%' }}>
                      <div style={{ ...TT.mono, userSelect: 'all', display: 'grid', gridTemplateColumns: 'repeat(4, max-content)', columnGap: T.sp.md, rowGap: T.sp.xs, letterSpacing: '0.04em', padding: `${T.sp.sm}px ${T.sp.md}px`, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner }}>
                        {(step.secret.match(/.{1,4}/g) ?? []).map((g, i) => <span key={i}>{g}</span>)}
                      </div>
                      <Btn variant="secondary" onClick={() => void copySecret(step.secret)}>{copied ? 'Αντιγράφηκε' : 'Αντιγραφή κωδικού'}</Btn>
                      </div>
                    </div>
                  </div>
                </Stage>
                <Stage n={3} last title="Γράψε τον εξαψήφιο κωδικό"
                  text="Αυτόν που δείχνει τώρα η εφαρμογή.">
                  {codeRow}
                  <p style={quiet}>Από εδώ και πέρα, κάθε σύνδεση θα ζητά και τον εξαψήφιο κωδικό.</p>
                </Stage>
              </ol>
            </Card>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
