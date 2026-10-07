'use client';

// ═══════════════════════════════════════════════════════════════════════════
// SecuritySettings, «Ασφάλεια». Πραγματικό, λειτουργικό block που μπαίνει BARE
// μέσα σε υπάρχουσα Card (ο γονέας δίνει <Card><SecHdr label="Ασφάλεια" />…).
// Τέσσερα αληθινά εργαλεία: αλλαγή κωδικού, επαλήθευση δύο βημάτων (2FA/TOTP
// μέσω Supabase MFA), στοιχεία τρέχουσας σύνδεσης, καθολική αποσύνδεση.
// Ίδια οπτική γλώσσα με το υπόλοιπο «Ρυθμίσεις» (σειρές, πεδία,
// tokens). Χωρίς notifyError(), χωρίς ψεύτικα κουμπιά.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, CSSProperties } from 'react';
import { leaveDevice } from '@/lib/localPrivacy';
import { createClient } from '@/lib/supabase/client';
import { hardNavigate } from '@/lib/core/navigate';
import { T, TT, Btn, settingsField, Spinner, ABSENT, ABSENT_DATE, fixedCols, InfoBanner } from '@/components/Theme';
import { SetList, SetRow, SetFact } from './SettingsKit';
import { logActivity } from '@/lib/activity';
import { checkPassword, PASSWORD_MIN_LABEL, PASSWORD_MSG } from '@/lib/auth/password';
import PasswordStrength from '@/components/PasswordStrength';
import PasswordEye from '@/app/PasswordEye';
import { failed } from '@/lib/core/dbError';

// Η γεωμετρία της γραμμής (περιθώρια, περιγράμματα) έρχεται από το SettingsKit
// και το `.po-settings`. Εδώ μένουν μόνο τα δύο που είναι ειδικά της ασφάλειας.
const fieldLabel: CSSProperties = { ...TT.bodySm, marginBottom: 6, display: 'block' };
const field: CSSProperties = settingsField;
const note: CSSProperties = { ...TT.bodySm, marginTop: 10 };
// Χώρος για το μάτι (44×44, στο δεξί άκρο), ώστε το κείμενο να μη χάνεται από κάτω του.
const pwField: CSSProperties = { ...field, paddingRight: 48 };

// ═══ ΑΛΛΑΓΗ ΚΩΔΙΚΟΥ: Ο ΤΡΕΧΩΝ ΚΩΔΙΚΟΣ ΤΟΝ ΕΛΕΓΧΕΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ ════════════
// ΤΟ ΕΥΡΗΜΑ (έλεγχος ασφαλείας 06.10). Η αλλαγή έκανε σκέτο
// `updateUser({ password })`: όποιος έβρισκε ξεκλείδωτο, συνδεδεμένο περιηγητή
// άλλαζε τον κωδικό χωρίς να ξέρει τον παλιό και κρατούσε τον λογαριασμό. Οι
// άλλες συνεδρίες έμεναν ανοιχτές, ενώ η επαναφορά τις έκλεινε.
//
// ΓΙΑΤΙ `current_password` ΚΑΙ ΟΧΙ `signInWithPassword`. Μια δοκιμαστική
// σύνδεση θα έφτιαχνε ΝΕΑ συνεδρία σε `aal1` και θα έριχνε τον χρήστη με δύο
// βήματα κάτω από το `aal2` που ζητά ο διαμεσολαβητής (lib/auth/mfa.ts). Το
// `current_password` στέλνεται μέσα στο ίδιο `PUT /user` και ο Supabase Auth
// το ελέγχει στον διακομιστή (internal/api/user.go), χωρίς νέα συνεδρία.
//
// ΙΣΧΥΕΙ ΜΟΝΟ ΜΕ ΤΗ ΡΥΘΜΙΣΗ ΑΝΟΙΧΤΗ. Ο διακομιστής ελέγχει τον τρέχοντα κωδικό
// μόνο όταν στο Supabase Dashboard είναι ενεργό το «Require current password
// when changing password» (Authentication → Sign In / Providers → Email·
// GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD). Με τη ρύθμιση
// κλειστή ο διακομιστής αγνοεί το πεδίο: η οθόνη το ζητά, αλλά ο έλεγχος δεν
// γίνεται. Δεν υπάρχει έλεγχος μόνο στον περιηγητή εδώ, γιατί θα ήταν ψεύτικη
// ασφάλεια: παρακάμπτεται με ένα αίτημα από την κονσόλα.
//
// ΟΙ ΑΡΝΗΣΕΙΣ ΠΟΥ ΔΙΟΡΘΩΝΕΙ Ο ΙΔΙΟΣ Ο ΧΡΗΣΤΗΣ λέγονται εδώ με το όνομά τους και
// δεν αναφέρονται ως σφάλματα: λάθος κωδικός δεν είναι βλάβη. Οι κωδικοί είναι
// του Supabase Auth (internal/api/apierrors/errorcode.go)· το κείμενό τους
// είναι ίδιο και για τα δύο πρώτα, οπότε κρίνει μόνο το `code`. Ο,τι άλλο
// περνά από το `failed()`.
const PW_REFUSED: Record<string, string> = {
  current_password_invalid: 'Ο τρέχων κωδικός δεν είναι σωστός.',
  current_password_required: 'Γράψε τον τρέχοντα κωδικό σου για να τον αλλάξεις.',
  same_password: 'Ο νέος κωδικός είναι ίδιος με τον τρέχοντα. Διάλεξε άλλον.',
  insufficient_aal: 'Η αλλαγή κωδικού θέλει και τον κωδικό της επαλήθευσης δύο βημάτων. Αποσυνδέσου, μπες ξανά και δοκίμασε πάλι.',
  reauthentication_needed: 'Για την αλλαγή κωδικού χρειάζεται πρόσφατη σύνδεση. Αποσυνδέσου, μπες ξανά και δοκίμασε πάλι.',
};

// ── Ελάχιστοι τοπικοί τύποι για τα αποτελέσματα του Supabase MFA ──────────
interface MfaFactor { id: string; friendly_name?: string; factor_type: string; status: 'verified' | 'unverified' }
type MfaState = 'loading' | 'off' | 'enrolling' | 'on';

export default function SecuritySettings() {
  const supabase = createClient();

  // Κωδικός πρόσβασης
  const [currentPass, setCurrentPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  // ΛΟΓΑΡΙΑΣΜΟΣ ΧΩΡΙΣ ΚΩΔΙΚΟ ΔΕΝ ΕΧΕΙ «ΤΡΕΧΟΝΤΑ». Οποιος μπήκε μόνο με Google
  // δεν έχει ταυτότητα `email` και κανέναν κωδικό να γράψει: ο διακομιστής τον
  // εξαιρεί κι αυτός (`user.HasPassword()`). Ώσπου να διαβαστεί, το πεδίο
  // φαίνεται: η ασφαλής προεπιλογή. Αν ο διακομιστής ζητήσει τρέχοντα κωδικό
  // που η οθόνη δεν περίμενε, το πεδίο εμφανίζεται (`askCurrent`).
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [askCurrent, setAskCurrent] = useState(false);
  const needCurrent = hasPassword !== false || askCurrent;
  const [newPass, setNewPass] = useState('');
  const [leakedPw, setLeakedPw] = useState<string | null>(null);
  // ΤΟ ΕΥΡΗΜΑ ΔΙΑΡΡΟΗΣ ΦΤΑΝΕΙ ΩΣ ΤΗΝ ΥΠΟΒΟΛΗ. Πριν, ζούσε μόνο μέσα στο
  // PasswordStrength: η οθόνη προειδοποιούσε και μετά δεχόταν τον κωδικό.
  // Κρατιέται ο ΙΔΙΟΣ ο κωδικός, όχι σημαία, ώστε η φραγή να παύει μόνη της
  // μόλις ο χρήστης αλλάξει έστω έναν χαρακτήρα.
  const leaked = leakedPw !== null && leakedPw === newPass;
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Τρέχουσα σύνδεση
  const [email, setEmail] = useState('');
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  // Καθολική αποσύνδεση
  const [signingOut, setSigningOut] = useState(false);

  // Επαλήθευση δύο βημάτων (2FA / TOTP)
  const [mfaState, setMfaState] = useState<MfaState>('loading');
  const [enrollFactor, setEnrollFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaErr, setMfaErr] = useState<string | null>(null);
  const [identityErr, setIdentityErr] = useState('');
  const [mfaUnavailable, setMfaUnavailable] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      // «ΔΕΝ ΞΕΡΩ ΠΟΤΕ ΣΥΝΔΕΘΗΚΕΣ» ΔΕΝ ΓΡΑΦΕΤΑΙ «—». Σε οθόνη ασφαλείας η
      // παύλα διαβάζεται ως «καμία σύνδεση», που είναι το πιο καθησυχαστικό
      // ψέμα που μπορεί να πει αυτό το πεδίο.
      const { data, error: err } = await supabase.auth.getUser();
      if (!alive) return;
      if (err) { setIdentityErr(failed('Τα στοιχεία του λογαριασμού δεν διαβάστηκαν', err)); return; }
      setEmail(data.user?.email ?? '');
      setLastSignIn(data.user?.last_sign_in_at ?? null);
      const ids = data.user?.identities;
      if (ids) setHasPassword(ids.some(i => i.provider === 'email'));
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ανίχνευση κατάστασης 2FA στο mount + καθάρισμα τυχόν εκκρεμών factors.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const totp = (data?.totp ?? []) as MfaFactor[];
        // Καθάρισε ό,τι έμεινε «unverified» ώστε το enroll να μην σκάει αργότερα.
        for (const f of totp) {
          if (f.status === 'unverified') {
            try { await supabase.auth.mfa.unenroll({ factorId: f.id }); } catch { /* αγνόησε */ }
          }
        }
        if (!alive) return;
        const active = totp.some(f => f.status === 'verified');
        setMfaState(active ? 'on' : 'off');
      } catch {
        if (alive) setMfaState('off');
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setMfaBusy(true);
    setMfaErr(null);
    setMfaUnavailable(false);
    try {
      // Καθάρισε τυχόν εκκρεμείς factors, ώστε το enroll να μη βρει «factor already exists».
      // ΑΝ Η ΑΝΑΓΝΩΣΗ ΑΠΟΤΥΧΕΙ, ΤΟ ΚΑΘΑΡΙΣΜΑ ΔΕΝ ΕΓΙΝΕ. Χωρίς το `error`, ο
      // κατάλογος ερχόταν κενός, ο βρόχος δεν έτρεχε ποτέ και το enroll από κάτω
      // έσκαγε με «factor already exists» — μήνυμα που ο χρήστης διάβαζε ως δικό
      // του λάθος και ξαναπατούσε το ίδιο κουμπί για πάντα.
      const { data: list, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) { setMfaErr(failed('Η επαλήθευση δύο βημάτων δεν ενεργοποιήθηκε', listErr)); return; }
      const totp = (list?.totp ?? []) as MfaFactor[];
      for (const f of totp) {
        if (f.status === 'unverified') {
          try { await supabase.auth.mfa.unenroll({ factorId: f.id }); } catch { /* αγνόησε */ }
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'PROPERWISE' });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('disabled') || msg.includes('not enabled') || msg.includes('unsupported') || msg.includes('mfa')) {
          setMfaUnavailable(true);
        } else {
          setMfaErr(failed('Η επαλήθευση δύο βημάτων δεν ενεργοποιήθηκε', error));
        }
        return;
      }
      setEnrollFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode('');
      setMfaState('enrolling');
    } catch (e) {
      setMfaErr(failed('Η επαλήθευση δύο βημάτων δεν ενεργοποιήθηκε', e));
    } finally {
      setMfaBusy(false);
    }
  }

  async function verifyCode() {
    if (!enrollFactor) return;
    if (code.length !== 6) {
      setMfaErr('Ο κωδικός δεν είναι σωστός. Δοκίμασε ξανά.');
      return;
    }
    setMfaBusy(true);
    setMfaErr(null);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollFactor.id });
      if (chErr || !ch) {
        setMfaErr('Ο κωδικός δεν είναι σωστός. Δοκίμασε ξανά.');
        return;
      }
      const { error } = await supabase.auth.mfa.verify({ factorId: enrollFactor.id, challengeId: ch.id, code });
      if (error) {
        setMfaErr('Ο κωδικός δεν είναι σωστός. Δοκίμασε ξανά.');
        return;
      }
      setEnrollFactor(null);
      setCode('');
      setMfaState('on');
      void logActivity(supabase, 'mfa_enabled', 'security');
    } catch {
      setMfaErr('Ο κωδικός δεν είναι σωστός. Δοκίμασε ξανά.');
    } finally {
      setMfaBusy(false);
    }
  }

  async function cancelEnroll() {
    const pending = enrollFactor;
    setEnrollFactor(null);
    setCode('');
    setMfaErr(null);
    setMfaState('off');
    if (pending) {
      try { await supabase.auth.mfa.unenroll({ factorId: pending.id }); } catch { /* αγνόησε */ }
    }
  }

  async function disableMfa() {
    if (!confirmDisable) {
      setConfirmDisable(true);
      return;
    }
    setMfaBusy(true);
    setMfaErr(null);
    // ═══ Η ΟΘΟΝΗ ΕΛΕΓΕ «ΑΝΕΝΕΡΓΗ» ΧΩΡΙΣ ΝΑ ΤΟ ΕΧΕΙ ΚΑΝΕΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ ═══════
    // ΤΟ ΣΦΑΛΜΑ, ΩΣ ΑΛΥΣΙΔΑ. Η απαρίθμηση των factors αγνοούσε το `error`: μια
    // αποτυχία γύριζε `undefined`, το `?? []` το έκανε ΚΕΝΟ ΠΙΝΑΚΑ, ο βρόχος δεν
    // έτρεχε ποτέ — και το `setMfaState('off')` εκτελούνταν ΕΤΣΙ ΚΙ ΑΛΛΙΩΣ. Το
    // ίδιο και όταν η απεγγραφή ενός factor αποτύγχανε: το `catch` το κατάπινε.
    //
    // ΤΙ ΣΗΜΑΙΝΕΙ ΓΙΑ ΤΟΝ ΧΡΗΣΤΗ. Πιστεύει ότι έκλεισε τη δεύτερη επαλήθευση,
    // σβήνει την εφαρμογή αυθεντικοποίησης από το κινητό — και στην επόμενη
    // σύνδεση ο διακομιστής ζητά κωδικό που δεν μπορεί πια να παραγάγει.
    // Κλείδωμα έξω από τον ίδιο του τον λογαριασμό, από μήνυμα που έλεγε ψέματα.
    //
    // ΤΟ «ΑΝΕΝΕΡΓΗ» ΛΕΓΕΤΑΙ ΜΟΝΟ ΟΤΑΝ ΤΟ ΕΠΙΒΕΒΑΙΩΣΕΙ Ο ΔΙΑΚΟΜΙΣΤΗΣ: κάθε
    // απεγγραφή ελέγχεται και, αν έστω μία δεν πέρασε, η κατάσταση ΔΕΝ αλλάζει.
    try {
      const { data: list, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) {
        setMfaErr(failed('Η επαλήθευση δύο βημάτων δεν απενεργοποιήθηκε', listErr));
        return;
      }
      const totp = (list?.totp ?? []) as MfaFactor[];
      const stuck: string[] = [];
      for (const f of totp) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) { stuck.push(f.id); console.warn('mfa.unenroll', error); }
      }
      if (stuck.length) {
        setMfaErr('Η επαλήθευση δύο βημάτων δεν απενεργοποιήθηκε: ο διακομιστής κράτησε τη συσκευή σου. Μη σβήσεις την εφαρμογή επαλήθευσης και δοκίμασε ξανά.');
        return;
      }
      setMfaState('off');
      setConfirmDisable(false);
      void logActivity(supabase, 'mfa_disabled', 'security');
    } catch {
      setMfaErr('Δεν ήταν δυνατή η απενεργοποίηση. Δοκίμασε ξανά.');
    } finally {
      setMfaBusy(false);
    }
  }

  async function savePassword() {
    if (needCurrent && !currentPass) {
      setPwMsg({ ok: false, text: PW_REFUSED.current_password_required });
      return;
    }
    if (needCurrent && newPass === currentPass) {
      setPwMsg({ ok: false, text: PW_REFUSED.same_password });
      return;
    }
    if (leaked) {
      setPwMsg({ ok: false, text: PASSWORD_MSG.leaked });
      return;
    }
    if (!checkPassword(newPass).ok) {
      setPwMsg({ ok: false, text: PASSWORD_MSG.weak });
      return;
    }
    if (newPass !== confirm) {
      setPwMsg({ ok: false, text: 'Οι δύο κωδικοί δεν ταιριάζουν.' });
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    // Ο τρέχων κωδικός ταξιδεύει ΜΟΝΟ όταν η οθόνη τον ζήτησε. Το
    // `current_password` είναι το όνομα που διαβάζει ο διακομιστής και που
    // δηλώνει το `UserAttributes` του @supabase/auth-js 2.116: η βιβλιοθήκη
    // στέλνει τα πεδία αυτούσια, χωρίς μετονομασία.
    const { error } = await supabase.auth.updateUser(
      needCurrent ? { password: newPass, current_password: currentPass } : { password: newPass },
    );
    if (error) {
      setPwBusy(false);
      if (error.code === 'current_password_required') setAskCurrent(true);
      const refused = error.code ? PW_REFUSED[error.code] : undefined;
      setPwMsg({ ok: false, text: refused ?? failed('Ο κωδικός δεν άλλαξε', error) });
      return;
    }
    void logActivity(supabase, 'password_changed', 'security');
    // ═══ ΟΙ ΑΛΛΕΣ ΣΥΣΚΕΥΕΣ ΚΛΕΙΝΟΥΝ ΜΑΖΙ ΜΕ ΤΟΝ ΠΑΛΙΟ ΚΩΔΙΚΟ ═══════════════
    // Ίδιο με την επαναφορά (app/reset-password): όποιος αλλάζει κωδικό επειδή
    // υποψιάζεται διαρροή πρέπει να βγάλει έξω και όποιον κρατά ήδη συνεδρία.
    // Μένει ανοιχτή μόνο αυτή η συσκευή. Αν το κλείσιμο αποτύχει, το λέμε και
    // δείχνουμε το κουμπί που το κάνει, αντί να υποσχεθούμε κάτι που δεν έγινε.
    const { error: outError } = await supabase.auth.signOut({ scope: 'others' });
    setPwBusy(false);
    setCurrentPass('');
    setNewPass('');
    setConfirm('');
    setShowCurrent(false);
    setShowNew(false);
    setPwMsg({
      ok: true,
      text: outError
        ? 'Ο κωδικός ενημερώθηκε, αλλά οι άλλες συσκευές δεν αποσυνδέθηκαν. Κλείσ’ τες με την «Αποσύνδεση από όλες τις συσκευές», παρακάτω.'
        : 'Ο κωδικός ενημερώθηκε. Αποσυνδέσαμε κάθε άλλη συσκευή όπου ήταν ανοιχτός ο λογαριασμός σου.',
    });
  }

  async function signOutEverywhere() {
    setSigningOut(true);
    // Καταγραφή ΠΡΙΝ την καθολική αποσύνδεση (μετά χάνεται η συνεδρία).
    await logActivity(supabase, 'signed_out_all', 'security');
    await supabase.auth.signOut({ scope: 'global' });
    // Η καθολική αποσύνδεση κλείνει ΚΑΘΕ συνεδρία· η συσκευή που την πάτησε
    // δεν επιτρέπεται να είναι η μόνη που κρατά ονόματα και ΑΦΜ.
    leaveDevice();
    hardNavigate('/login');
  }

  const lastSignInText = lastSignIn
    ? new Date(lastSignIn).toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' })
    : ABSENT_DATE;

  return (
    <SetList>
      {identityErr && <InfoBanner tone="negative">{identityErr} Ανανέωσε τη σελίδα: ώσπου να διαβαστούν, τα στοιχεία σύνδεσης παρακάτω δεν είναι έγκυρα.</InfoBanner>}

      {/* 1. Κωδικός πρόσβασης */}
      <SetRow title="Κωδικός πρόσβασης"
        desc={`${PASSWORD_MIN_LABEL}, με πεζό, κεφαλαίο, αριθμό και σύμβολο.`}>
        {/* Ο τρέχων κωδικός στη δική του γραμμή, στο πλάτος μιας στήλης: είναι
            άλλη ερώτηση («ποιος είσαι») από τα δύο πεδία του νέου κωδικού. */}
        {needCurrent && (
          <div {...fixedCols(2, 12, 'start')}>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="sec-current-pass" style={fieldLabel}>Τρέχων κωδικός</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="sec-current-pass" type={showCurrent ? 'text' : 'password'} autoComplete="current-password" className="po-field"
                  required value={currentPass} onChange={e => setCurrentPass(e.target.value)} style={pwField}
                />
                <PasswordEye show={showCurrent} onToggle={() => setShowCurrent(s => !s)} />
              </div>
            </div>
          </div>
        )}
        <div {...fixedCols(2, 12, 'start')}>
          <div>
            <label htmlFor="sec-new-pass" style={fieldLabel}>Νέος κωδικός</label>
            <div style={{ position: 'relative' }}>
              <input
                id="sec-new-pass" type={showNew ? 'text' : 'password'} autoComplete="new-password" className="po-field"
                value={newPass} onChange={e => setNewPass(e.target.value)} style={pwField} aria-describedby="sec-pw-req"
              />
              <PasswordEye show={showNew} onToggle={() => setShowNew(s => !s)} />
            </div>
          </div>
          <div>
            <label htmlFor="sec-confirm-pass" style={fieldLabel}>Επιβεβαίωση</label>
            <input
              id="sec-confirm-pass" type={showNew ? 'text' : 'password'} autoComplete="new-password" className="po-field"
              value={confirm} onChange={e => setConfirm(e.target.value)} style={field}
            />
          </div>
        </div>
        {newPass && <PasswordStrength password={newPass} id="sec-pw-req" onLeaked={setLeakedPw} />}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={savePassword} disabled={pwBusy || !checkPassword(newPass).ok || leaked}>
            {pwBusy ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </Btn>
        </div>
        {pwMsg && (
          <div role={pwMsg.ok ? 'status' : 'alert'} style={{ ...note, color: pwMsg.ok ? 'var(--text-secondary)' : 'var(--negative)' }}>{pwMsg.text}</div>
        )}
      </SetRow>

      {/* 2. Επαλήθευση δύο βημάτων (2FA / TOTP)
          ΑΝΕΒΗΚΕ ΑΠΟ ΤΗΝ ΤΕΤΑΡΤΗ ΘΕΣΗ. Είναι το ισχυρότερο πράγμα που μπορεί να
          κάνει κάποιος για τον λογαριασμό του και ζούσε κάτω από ένα κουμπί
          αποσύνδεσης: η σειρά έλεγε ότι μετράει λιγότερο. Οι δύο ενέργειες που
          απλώς περιγράφουν ή κλείνουν τη συνεδρία πήγαν από κάτω. */}
      <SetRow title="Επαλήθευση δύο βημάτων"
        desc="Δεύτερο επίπεδο ασφάλειας, με οποιαδήποτε εφαρμογή επαλήθευσης (Google Authenticator, Authy, Microsoft Authenticator, 1Password).">

        {mfaState === 'loading' && (
          <Spinner size={18} label="Έλεγχος κατάστασης…" />
        )}

        {mfaUnavailable && (
          <div style={{ ...TT.bodySm, color: 'var(--text-tertiary)' }}>
            Η επαλήθευση δύο βημάτων δεν είναι διαθέσιμη αυτή τη στιγμή.
          </div>
        )}

        {/* OFF: όφελος + «Ενεργοποίηση» */}
        {mfaState === 'off' && !mfaUnavailable && (
          <div>
            <div style={{ ...TT.bodySm, marginBottom: 10 }}>
              Ακόμη κι αν διαρρεύσει ο κωδικός σου, κανείς δεν συνδέεται χωρίς τον προσωρινό κωδικό από τη δική σου εφαρμογή.
            </div>
            <div style={{ ...TT.bodySm, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              Αφορά μόνο τον λογαριασμό σου· κάθε μέλος ομάδας έχει δικό του λογαριασμό και δική του επαλήθευση, οπότε η ενεργοποίηση εδώ δεν επηρεάζει την πρόσβαση των υπολοίπων.
            </div>
            <Btn variant="primary" onClick={startEnroll} disabled={mfaBusy}>
              {mfaBusy ? 'Ενεργοποίηση…' : 'Ενεργοποίηση'}
            </Btn>
            {mfaErr && <div style={{ ...note, color: 'var(--negative)' }}>{mfaErr}</div>}
          </div>
        )}

        {/* ENROLLING: QR + secret + 6ψήφιος κωδικός */}
        {mfaState === 'enrolling' && enrollFactor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
            <div>
              <div style={{ ...TT.bodySm, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 10 }}>
                1. Σάρωσε τον κωδικό QR με την εφαρμογή επαλήθευσης
              </div>
              <div style={{ display: 'inline-flex', padding: 10, background: 'var(--bg-surface)', borderRadius: T.radius.inner, border: '1px solid var(--border-default)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrollFactor.qr} alt="Κωδικός QR επαλήθευσης" width={168} height={168} />
              </div>
              <div style={{ ...TT.bodySm, color: 'var(--text-tertiary)', marginTop: 12, marginBottom: 6 }}>
                ή καταχώρησε τον κωδικό χειροκίνητα
              </div>
              <div style={{ ...TT.mono, userSelect: 'all', wordBreak: 'break-all', padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: T.radius.inner }}>
                {enrollFactor.secret}
              </div>
            </div>
            <div>
              <label htmlFor="sec-mfa-code" style={{ ...TT.bodySm, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8, display: 'block' }}>
                2. Καταχώρησε τον εξαψήφιο κωδικό από την εφαρμογή
              </label>
              <input
                id="sec-mfa-code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" className="po-field"
                placeholder="123456"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ ...field, maxWidth: 200, fontFamily: T.font.mono, letterSpacing: '0.3em' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Btn variant="primary" onClick={verifyCode} disabled={mfaBusy}>
                  {mfaBusy ? 'Επιβεβαίωση…' : 'Επιβεβαίωση'}
                </Btn>
                <Btn variant="secondary" onClick={cancelEnroll} disabled={mfaBusy}>Ακύρωση</Btn>
              </div>
              {mfaErr && <div style={{ ...note, color: 'var(--negative)' }}>{mfaErr}</div>}
            </div>
          </div>
        )}

        {/* ON: η κατάσταση λέγεται ΜΙΑ φορά και είναι το κουμπί που την αλλάζει.
            Πριν, το ίδιο πράγμα γραφόταν τρεις φορές στη σειρά: ένα σήμα
            «Ενεργό», μια πρόταση «Η επαλήθευση δύο βημάτων είναι ενεργή» και
            από κάτω το κουμπί «Απενεργοποίηση» που το προϋποθέτει. */}
        {mfaState === 'on' && (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ ...TT.bodySm, color: 'var(--text-primary)', fontWeight: 700 }}>Ενεργή</span>
              <Btn variant="secondary" onClick={disableMfa} disabled={mfaBusy}>
                {mfaBusy ? 'Απενεργοποίηση…' : confirmDisable ? 'Επιβεβαίωση απενεργοποίησης' : 'Απενεργοποίηση'}
              </Btn>
              {confirmDisable && !mfaBusy && (
                <Btn variant="ghost" onClick={() => setConfirmDisable(false)}>Ακύρωση</Btn>
              )}
            </div>
            {confirmDisable && (
              <div style={{ ...note, color: 'var(--text-tertiary)' }}>
                Ο λογαριασμός σου θα προστατεύεται μόνο με τον κωδικό πρόσβασης.
              </div>
            )}
            {mfaErr && <div style={{ ...note, color: 'var(--negative)' }}>{mfaErr}</div>}
          </div>
        )}
      </SetRow>

      {/* 3. Τρέχουσα σύνδεση */}
      <SetRow title="Τρέχουσα σύνδεση">
        <SetList>
          <SetFact label="Ηλεκτρονικό ταχυδρομείο" value={email || ABSENT} muted={!email} />
          <SetFact label="Τελευταία σύνδεση" value={lastSignInText} muted={!lastSignIn} />
        </SetList>
      </SetRow>

      {/* 4. Καθολική αποσύνδεση */}
      <SetRow title="Καθολική αποσύνδεση"
        desc="Κλείνει τη σύνδεση σε κάθε συσκευή και περιηγητή. Θα χρειαστεί να συνδεθείς ξανά.">
        <Btn variant="secondary" onClick={signOutEverywhere} disabled={signingOut}>
          {signingOut ? 'Αποσύνδεση…' : 'Αποσύνδεση από όλες τις συσκευές'}
        </Btn>
      </SetRow>

    </SetList>
  );
}
