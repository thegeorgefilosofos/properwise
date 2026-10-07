'use client';

// ═══════════════════════════════════════════════════════════════════════════
// /verify/<id> — δημόσια σελίδα επαλήθευσης εγγράφου (χωρίς login).
// Ο αναγνώστης (τράπεζα, ΔΟΥ, φορέας) σκανάρει το QR του PDF και βλέπει τι
// γράφει το μητρώο: τύπος, αντικείμενο, περίοδος, ημ. έκδοσης, εκδότης όπως
// τον δήλωσε ο χρήστης, αποτύπωμα. Καμία ευαίσθητη πληροφορία/ποσά.
//
// ΤΙ ΒΕΒΑΙΩΝΕΙ ΚΑΙ ΤΙ ΟΧΙ. Η σελίδα έγραφε «Γνήσιο έγγραφο, εκδόθηκε από το
// PROPERWISE». Το PROPERWISE όμως δεν εκδίδει το περιεχόμενο: τα στοιχεία και
// την επωνυμία του εκδότη τα γράφει ο χρήστης. Αυτό που ξέρει το μητρώο, από
// την 20261007100000 (`verify_issued_document`), είναι ότι ο αριθμός εκδόθηκε από τον διακομιστή, πότε,
// με ποια δηλωμένη επωνυμία και (`intact`) ότι η καταχώρηση δεν άλλαξε από
// τότε. Η σελίδα λέει ακριβώς αυτά και λέει ρητά τι ΔΕΝ βεβαιώνει.
// ═══════════════════════════════════════════════════════════════════════════
import { TriangleAlert, CircleCheckBig } from 'lucide-react';
import { StandaloneCard, CARD_TITLE } from '@/app/StandaloneCard';
import { ABSENT, T } from '@/components/tokens';
import { Btn } from '@/components/Theme';
import { hy } from '@/components/Hyphen';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLoad } from '@/app/hooks/useLoad';
import { normalizeVerifyCode, fingerprintLabel } from '@/lib/documents/verifyCode';
import { grDate } from '@/lib/core/format';
import { athensToday, athensTime } from '@/lib/core/time';

interface Verified {
  id: string; doc_type: string; subject: string; period: string; issued_at: string; issuer: string;
  /** Το sha256 του μητρώου· στις παλιές γραμμές ένα checksum του περιηγητή. */
  checksum: string;
  /** Ταιριάζει ακόμη το αποτύπωμα με τη γραμμή; Το υπολογίζει η βάση σε κάθε ερώτηση. */
  intact: boolean;
}

/** Ημερομηνία και ώρα Ελλάδας, όπως τις γράφει όλη η εφαρμογή: «07/10/2026, 14:05». */
const issuedOn = (iso: string): { date: string; time: string } | null => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : { date: grDate(athensToday(d)), time: athensTime(d) };
};

const label: React.CSSProperties = { fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 };
const value: React.CSSProperties = { fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginTop: 4 };

/** Η απάντηση για έγγραφο που βρέθηκε στο μητρώο. */
function RegisteredDoc({ doc }: { doc: Verified }) {
  const on = issuedOn(doc.issued_at);
  const fingerprint = fingerprintLabel(doc.checksum);
  // ΤΡΕΙΣ ΑΠΑΝΤΗΣΕΙΣ, ΟΧΙ ΔΥΟ. Άθικτη καταχώρηση· παλιά καταχώρηση, από πριν
  // σφραγίσει το μητρώο, που ούτε βεβαιώνεται ούτε κατηγορείται· και
  // σφραγισμένη που δεν ταιριάζει πια με το αποτύπωμά της. Το τρίτο δεν πρέπει
  // να συμβεί ποτέ (trigger, 20261007100000)· αν συμβεί, λέγεται καθαρά.
  const verdict: 'intact' | 'legacy' | 'changed' = doc.intact ? 'intact' : fingerprint ? 'changed' : 'legacy';
  const tone = verdict === 'intact'
    ? { bg: 'var(--positive-soft)', border: 'var(--positive-border)', ink: 'var(--positive)' }
    : verdict === 'changed'
      ? { bg: 'var(--warning-soft)', border: 'var(--warning-border)', ink: 'var(--warning)' }
      : { bg: 'var(--bg-elevated)', border: 'var(--border-default)', ink: 'var(--text-primary)' };
  const Icon = verdict === 'intact' ? CircleCheckBig : TriangleAlert;
  return (
    <div style={{ paddingTop: T.sp.xl }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 10, padding: '11px 14px' }}>
        {/* Ίδιο μέγεθος, ίδιο πάχος γραμμής, ίδια θέση με το πλακίδιο από
            πάνω. Ένα «✓» ως χαρακτήρας κειμένου δίπλα σε ένα εικονίδιο
            γραμμής δεν κάθεται στο ίδιο οπτικό ύψος και έχει άλλο βάρος. */}
        <Icon size={18} strokeWidth={2.5} style={{ color: verdict === 'legacy' ? 'var(--text-secondary)' : tone.ink, flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontSize: 14, fontWeight: 600, color: tone.ink }}>
          {verdict === 'intact' ? 'Καταχωρημένο έγγραφο, χωρίς αλλαγές από την έκδοση'
            : verdict === 'changed' ? 'Η καταχώρηση δεν ταιριάζει με το αποτύπωμά της'
            : 'Καταχωρημένο έγγραφο παλαιότερης μορφής'}
        </span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 16 }}>
        Εκδόθηκε μέσω PROPERWISE{on ? <> στις {on.date}</> : null} από τον εκδότη «{doc.issuer}», όπως δήλωσε ο ίδιος.{' '}
        {verdict === 'intact' && <>Η καταχώρηση δεν έχει αλλάξει από τότε. Σύγκρινε το αποτύπωμα παρακάτω με αυτό που είναι τυπωμένο στο κάτω μέρος του εγγράφου.</>}
        {verdict === 'changed' && <>Τα στοιχεία της καταχώρησης δεν συμφωνούν πια με το αποτύπωμα που γράφτηκε στην έκδοση. Μη βασιστείς σε αυτό το έγγραφο χωρίς επιβεβαίωση από τον εκδότη.</>}
        {verdict === 'legacy' && <>Καταχωρήθηκε πριν το μητρώο αποκτήσει αποτύπωμα από τον διακομιστή, οπότε δεν μπορούμε να βεβαιώσουμε ότι δεν άλλαξε από τότε.</>}
      </p>

      <div style={{ display: 'grid', gap: 16, marginTop: T.sp.xl }}>
        <div><div style={label}>Τύπος εγγράφου</div><div style={value}>{doc.doc_type}</div></div>
        {doc.subject && <div><div style={label}>Αντικείμενο</div><div style={value}>{doc.subject}</div></div>}
        {doc.period && <div><div style={label}>Περίοδος</div><div style={value}>{doc.period}</div></div>}
        <div><div style={label}>Ημερομηνία έκδοσης</div><div style={value}>{on ? `${on.date}, ${on.time}` : ABSENT}</div></div>
        <div><div style={label}>Εκδότης, όπως δηλώθηκε</div><div style={value}>{doc.issuer}</div></div>
        <div><div style={label}>Αριθμός εγγράφου</div><div style={{ ...value, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}>{doc.id}</div></div>
        {fingerprint && <div><div style={label}>Αποτύπωμα</div><div style={{ ...value, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}>{fingerprint}</div></div>}
      </div>

      {/* ΤΑ ΨΙΛΑ ΓΡΑΜΜΑΤΑ ΤΗΣ ΕΠΑΛΗΘΕΥΣΗΣ ΚΛΕΙΝΟΥΝ ΚΑΙ ΔΕΞΙΑ. Η κάρτα κόβει στα
          460 κι το γέμισμα των 30 αφήνει 400 στο κείμενο. Σε δημόσια σελίδα
          που κρίνει ένα χαρτί, η ριγμένη άκρη είναι το μόνο σημείο που δεν
          μοιάζει με χαρτί. Η στοίχιση πάει μαζί με τον συλλαβισμό — αλλιώς
          τεντώνει τα κενά. Το «PROPERWISE» είναι λατινικό: μένει ακέραιο.

          ΤΙ ΔΕΝ ΒΕΒΑΙΩΝΕΙ Η ΣΕΛΙΔΑ, ΓΡΑΜΜΕΝΟ ΡΗΤΑ. Την επωνυμία του εκδότη
          τη γράφει ο χρήστης: μπορεί να γράψει οποιοδήποτε όνομα. Και τα
          ποσά δεν φαίνονται εδώ, οπότε ένα χαρτί με αλλαγμένα ποσά θα
          ταίριαζε με την ίδια καταχώρηση. Ο αναγνώστης πρέπει να το ξέρει. */}
      <p className="po-just" style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6, marginTop: 24, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
        {hy(<>Το περιεχόμενο του εγγράφου και η επωνυμία του εκδότη είναι δηλώσεις του εκδότη. Το PROPERWISE καταγράφει την έκδοση και δεν βεβαιώνει την ακρίβεια των στοιχείων ούτε την ταυτότητα του εκδότη.
        Η σελίδα δεν δείχνει ποσά ή ευαίσθητα στοιχεία: αν το χαρτί που κρατάς γράφει ποσά, επιβεβαίωσέ τα με τον εκδότη.</>)}
      </p>
    </div>
  );
}

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export default function VerifyDocument() {
  const params = useParams();
  // Ο κωδικός από τη διεύθυνση περνά από την ίδια κανονικοποίηση με τη φόρμα:
  // όποιος τον πληκτρολόγησε στη γραμμή διεύθυνσης με ελληνικό «ΡΟ» βρίσκει
  // κι αυτός το έγγραφο.
  const id = normalizeVerifyCode(safeDecode(String(params?.id || '')));
  const supabase = createClient();
  // Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΟΘΟΝΗΣ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟ ΑΠΟΤΕΛΕΣΜΑ, ΔΕΝ ΓΡΑΦΕΤΑΙ ΔΙΠΛΑ ΤΟΥ.
  // Ηταν δύο καταστάσεις με `setState('loading')` σύγχρονα μέσα σε effect: μία
  // περιττή απόδοση και δύο πηγές αλήθειας που μπορούσαν να διαφωνήσουν. Τώρα
  // υπάρχει ΕΝΑ αποτέλεσμα, με σφραγίδα του εγγράφου που ελέγχθηκε· η
  // κατάσταση διαβάζεται από αυτό.
  // ═══ «ΔΕΝ ΑΠΑΝΤΗΣΕ Ο ΔΙΑΚΟΜΙΣΤΗΣ» ΔΕΝ ΕΙΝΑΙ «ΔΕΝ ΥΠΑΡΧΕΙ ΤΟ ΕΓΓΡΑΦΟ» ══════
  //
  // Εδώ γραφόταν `doc: error || !row ? null : row`: το σφάλμα της κλήσης και το
  // «καμία τέτοια γραμμή» κατέληγαν στην ίδια απάντηση· η οθόνη είχε μόνο
  // τρεις καταστάσεις. Υπάλληλος τράπεζας ή ΔΟΥ που σαρώνει το QR μιας ΓΝΗΣΙΑΣ
  // βεβαίωσης από γκισέ με κακό σήμα διάβαζε «Δεν βρέθηκε έγγραφο με αυτόν τον
  // κωδικό» και «δεν αντιστοιχεί σε έγγραφο που εκδόθηκε από το PROPERWISE».
  //
  // Είναι η μία σελίδα ολόκληρου του προϊόντος που υπάρχει για να πει αν κάτι
  // είναι αληθινό. Το να λέει «όχι» επειδή έπεσε το δίκτυο δεν είναι ατέλεια
  // εμφάνισης: είναι λάθος απάντηση στη μόνη ερώτηση που της κάνουν.
  const [result, setResult] = useState<{ id: string; doc: Verified | null; failed: boolean } | null>(null);
  const doc = result?.id === id ? result.doc : null;
  const state: 'loading' | 'ok' | 'notfound' | 'error' =
    result?.id !== id ? 'loading' : result.failed ? 'error' : result.doc ? 'ok' : 'notfound';

  const check = useCallback(async () => {
    const { data, error } = await supabase.rpc('verify_issued_document', { p_id: id });
    const row = Array.isArray(data) ? data[0] : data;
    setResult({ id, doc: error || !row ? null : (row as Verified), failed: !!error });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useLoad(check);

  // Ο ΚΩΔΙΚΟΣ ΜΕΤΑΚΟΜΙΖΕΙ ΟΛΟΚΛΗΡΟΣ ΣΤΗΝ ΕΠΟΜΕΝΗ ΓΡΑΜΜΗ. Στα 390 έσπαγε στο
  // ενωτικό του («PW-» και από κάτω το υπόλοιπο), δηλαδή διαβαζόταν ως δύο
  // κωδικοί. Ως inline-block τυλίγεται μέσα του μόνο αν δεν χωρά σε μία γραμμή.
  const codeInline: React.CSSProperties = { color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em', display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere' };

  return (
    <StandaloneCard>
        {/* Ο ΤΙΤΛΟΣ ΤΗΣ ΣΕΛΙΔΑΣ ΕΙΝΑΙ ΑΥΤΗ Η ΓΡΑΜΜΗ, ΟΧΙ ΤΟ ΟΝΟΜΑ ΤΗΣ ΕΦΑΡΜΟΓΗΣ.
            Η σελίδα δεν είχε καμία επικεφαλίδα και ο αναγνώστης οθόνης την
            ανακοίνωνε χωρίς όνομα. Η κάρτα είναι η κοινή του ταμείου και της
            φόρμας επαλήθευσης (app/StandaloneCard.tsx): ίδιο λογότυπο, ίδιος
            τίτλος, ίδιο πλάτος. Πριν, εδώ ο τίτλος ήταν 16 και στο ταμείο 24. */}
        <h1 style={CARD_TITLE}>Επαλήθευση εγγράφου</h1>

        {state === 'loading' && (
          <div style={{ padding: '34px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Έλεγχος εγγράφου…</div>
        )}

        {/* ΟΙ ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ ΜΙΛΟΥΣΑΝ ΔΙΑΦΟΡΕΤΙΚΗ ΓΛΩΣΣΑ. Το «γνήσιο» ήταν
            πλακίδιο με περίγραμμα, φόντο και σύμβολο 18 εικονοστοιχείων· το «δεν
            βρέθηκε» ήταν ένα emoji ⚠️ σαράντα εικονοστοιχείων, ασύνδετο, πάνω
            από τον τίτλο.

            Δύο πράγματα ταυτόχρονα και τα δύο μετράνε σε ΑΥΤΗ τη σελίδα:

            • Ο κανόνας του έργου λέει «χωρίς emoji — ένα εργαλείο που
              διαχειρίζεται τη φορολογία σου δεν κλείνει το μάτι». Η σελίδα όπου
              κάποιος ελέγχει αν ένα έγγραφο είναι γνήσιο είναι το χειρότερο
              σημείο για να το σπάσει: υπονομεύει ακριβώς την αξιοπιστία που
              υπάρχει για να στήσει. Και το emoji αποδίδεται από το ΛΕΙΤΟΥΡΓΙΚΟ
              του θεατή — άλλο σχήμα σε Windows, άλλο σε iPhone, άλλο σε Android.
            • Δύο καταστάσεις της ίδιας ερώτησης πρέπει να έχουν την ίδια
              γεωμετρία. Αλλιώς ο αναγνώστης δεν συγκρίνει· ξαναμαθαίνει.

            Ίδιο πλακίδιο, άλλος τόνος. Το «δεν βρέθηκε» ΔΕΝ είναι κόκκινο: δεν
            σημαίνει πλαστό, σημαίνει ότι δεν βρέθηκε — μπορεί να σαρώθηκε λάθος
            ο κωδικός. Η διάκριση την κάνουν οι λέξεις, όχι ο συναγερμός. */}
        {state === 'notfound' && (
          <div style={{ paddingTop: T.sp.xl }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', borderRadius: 10, padding: '11px 14px' }}>
              <TriangleAlert size={18} strokeWidth={2.5} style={{ color: 'var(--warning)', flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)' }}>Δεν βρέθηκε έγγραφο με αυτόν τον κωδικό</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 16 }}>
              Ο κωδικός <strong style={codeInline}>{id || ABSENT}</strong> δεν αντιστοιχεί σε έγγραφο καταχωρημένο στο μητρώο του PROPERWISE.
              Έλεγξε ότι σάρωσες σωστά το QR ή ζήτησε νέο αντίγραφο από τον εκδότη.
            </p>
          </div>
        )}

        {/* Ο ΤΟΝΟΣ ΕΙΝΑΙ ΟΥΔΕΤΕΡΟΣ ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ. Η αποτυχία δεν λέει
            τίποτα για το έγγραφο: ούτε «γνήσιο» ούτε «άγνωστο». Χρώμα
            προειδοποίησης εδώ θα έριχνε υποψία σε χαρτί που κανείς δεν
            εξέτασε. Και υπάρχει κουμπί: η μόνη σωστή ενέργεια είναι να
            ξαναρωτήσεις, όχι να φύγεις με απάντηση που δεν πήρες. */}
        {state === 'error' && (
          <div style={{ paddingTop: T.sp.xl }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '11px 14px' }}>
              <TriangleAlert size={18} strokeWidth={2.5} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Ο έλεγχος δεν ολοκληρώθηκε</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 16 }}>
              Δεν λάβαμε απάντηση για τον κωδικό <strong style={codeInline}>{id || ABSENT}</strong>.
              Αυτό δεν λέει τίποτα για το έγγραφο: δεν προλάβαμε να το ελέγξουμε.
            </p>
            <div style={{ marginTop: 16 }}>
              <Btn onClick={() => { setResult(null); void check(); }}>Νέα προσπάθεια</Btn>
            </div>
          </div>
        )}

        {state === 'ok' && doc && <RegisteredDoc doc={doc} />}

        {/* Δημόσια σελίδα που ανοίγει άνθρωπος χωρίς λογαριασμό: ο δρόμος προς
            το τι κρατάμε και γιατί υπάρχει σε κάθε κατάσταση, όχι μόνο στην επιτυχία. */}
        <p style={{ fontSize: 12, lineHeight: 1.6, margin: '20px 0 0' }}>
          <Link href="/privacy" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Πολιτική απορρήτου</Link>
        </p>
    </StandaloneCard>
  );
}
