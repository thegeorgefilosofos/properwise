'use client';

// ═══════════════════════════════════════════════════════════════════════════
// /epivevaiosi-email/<token> — δημόσια επιβεβαίωση της διεύθυνσης υπενθυμίσεων.
//
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ: η διεύθυνση στην οποία στέλνονται οι υπενθυμίσεις είναι
// ελεύθερο κείμενο που γράφει ο ιδιοκτήτης. Μπορεί να είναι οποιουδήποτε. Χωρίς
// αυτό το βήμα, το προϊόν στέλνει μηνύματα από το δικό του domain, με το δικό
// του λογότυπο, σε ανθρώπους που δεν το ζήτησαν ποτέ — δηλαδή είναι
// αναμεταδότης, όσο ευγενικό κι αν είναι το περιεχόμενο.
//
// ΧΩΡΙΣ LOGIN, ΕΠΙΤΗΔΕΣ: αυτός που επιβεβαιώνει είναι ο ΠΑΡΑΛΗΠΤΗΣ και ο
// παραλήπτης συνήθως δεν έχει λογαριασμό. Το διακριτικό είναι uuid, λήγει σε 48
// ώρες και καίγεται με την πρώτη επιτυχία: ο ίδιος σύνδεσμος δεν ξαναδουλεύει
// αν διαρρεύσει από τα εισερχόμενα.
//
// Η ΣΥΝΑΙΝΕΣΗ ΘΕΛΕΙ ΠΑΤΗΜΑ, ΟΧΙ ΑΝΟΙΓΜΑ. Η επιβεβαίωση γινόταν μόλις φόρτωνε η
// σελίδα. Οι σαρωτές ασφαλείας των εισερχομένων ανοίγουν κάθε σύνδεσμο σε
// αόρατο περιηγητή και θα «συναινούσαν» για τον παραλήπτη, καίγοντας το
// διακριτικό πριν τον δει άνθρωπος. Τώρα η σελίδα ρωτά και η κλήση φεύγει μόνο
// με το κουμπί.
// ═══════════════════════════════════════════════════════════════════════════
import BrandMark from '@/components/BrandMark';
import { T } from '@/components/tokens';
import { Btn } from '@/components/Theme';
import { hy } from '@/components/Hyphen';
import Link from 'next/link';
import { CircleCheckBig } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ConfirmReminderEmail() {
  const token = String(useParams()?.token || '');
  const supabase = createClient();
  // ═══ Η ΠΤΩΣΗ ΔΙΚΤΥΟΥ ΕΛΕΓΕ «Ο ΣΥΝΔΕΣΜΟΣ ΔΕΝ ΕΙΝΑΙ ΕΓΚΥΡΟΣ» ═══════════════
  // `setState(!error && data === true ? 'ok' : 'invalid')`: το σφάλμα της
  // κλήσης και η απόρριψη του κουπονιού κατέληγαν στην ίδια οθόνη. Ο χρήστης
  // που πάτησε τον σύνδεσμο από το email του, με στιγμιαία πτώση, διάβαζε ότι
  // ο σύνδεσμος «έληξε ή χρησιμοποιήθηκε ήδη» — και δεν ξαναπατούσε, γιατί του
  // είπαμε ότι δεν έχει νόημα. Η διεύθυνσή του έμενε ανεπιβεβαίωτη και οι
  // υπενθυμίσεις δεν έφταναν ποτέ.
  //
  // Οι αδελφές σελίδες /checkin και /portal έχουν ήδη ξεχωριστή κατάσταση
  // «offline»· εδώ έλειπε.
  const [state, setState] = useState<'ask' | 'loading' | 'ok' | 'invalid' | 'offline'>('ask');

  /** Η επιβεβαίωση, πάντα από πάτημα: πρώτη φορά και κάθε δεύτερη προσπάθεια. */
  const confirm = async () => {
    setState('loading');
    const { data, error } = await supabase.rpc('confirm_reminder_email', { p_token: token });
    setState(error ? 'offline' : data === true ? 'ok' : 'invalid');
  };

  const wrap: React.CSSProperties = { minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, system-ui, Arial, sans-serif', color: 'var(--text-primary)' };
  const card: React.CSSProperties = { width: '100%', maxWidth: 440, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.card, padding: '30px 28px', boxShadow: 'var(--elev-1)' };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: T.sp.xl, borderBottom: '1px solid var(--border-subtle)' }}>
          <BrandMark size={34} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>PROPERWISE</div>
            {/* Ο ΤΙΤΛΟΣ ΤΗΣ ΣΕΛΙΔΑΣ ΕΙΝΑΙ ΑΥΤΗ Η ΓΡΑΜΜΗ, ΟΧΙ ΤΟ ΟΝΟΜΑ ΤΗΣ
                ΕΦΑΡΜΟΓΗΣ. Το «PROPERWISE» από πάνω είναι σήμα, όχι επικεφαλίδα.
                Η σελίδα δεν είχε καμία: ο αναγνώστης οθόνης την ανακοίνωνε
                χωρίς όνομα, σε δημόσιο σύνδεσμο που ανοίγει άνθρωπος ο οποίος
                μπορεί να μη μας έχει ξανασυναντήσει. Και ΦΑΙΝΕΤΑΙ ως τίτλος: ήταν
                11px γκρι κάτω από το σήμα, ενώ η ερώτηση από κάτω ήταν σώμα
                κειμένου, δηλαδή ιεραρχία ανάποδα. Τώρα το σήμα είναι μικρή
                ετικέτα και ο τίτλος 16px. */}
            <h1 style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.3, margin: '2px 0 0', textWrap: 'balance' }}>Επιβεβαίωση διεύθυνσης υπενθυμίσεων</h1>
          </div>
        </div>

        {state === 'ask' && (
          <div style={{ paddingTop: T.sp.xl }}>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
              Θέλεις να λαμβάνεις τις υπενθυμίσεις του PROPERWISE σε αυτή τη διεύθυνση;
            </p>
            {/* ΠΟΙΟΣ ΕΔΩΣΕ ΤΗ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΠΟΥ ΛΕΓΕΤΑΙ ΤΙ ΚΡΑΤΑΜΕ. Ο παραλήπτης δεν
                τη μοιράστηκε ο ίδιος: τη γράφει ένας χρήστης. Οταν τα στοιχεία
                δεν συλλέγονται από το υποκείμενο, το άρθρο 14 GDPR ζητά να
                μάθει την πηγή τους και πού διαβάζει την ενημέρωση. */}
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '12px 0 0' }}>
              Αυτή τη διεύθυνση την όρισε χρήστης του PROPERWISE για να λαμβάνεις υπενθυμίσεις. Δες την{' '}
              <Link href="/privacy" className="lp-link" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>Πολιτική απορρήτου</Link>.
            </p>
            <div style={{ marginTop: 16 }}><Btn variant="primary" onClick={confirm}>Ναι, επιβεβαιώνω</Btn></div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '16px 0 0' }}>
              Αν δεν το ζήτησες, κλείσε τη σελίδα. Δεν θα λάβεις τίποτα.
            </p>
          </div>
        )}

        {state === 'loading' && (
          <div style={{ padding: '34px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Γίνεται επιβεβαίωση…</div>
        )}

        {state === 'ok' && (
          <div style={{ paddingTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--positive-soft)', border: '1px solid var(--positive-border)', borderRadius: 10, padding: '11px 14px', marginBottom: T.sp.lg }}>
              {/* Το εικονίδιο της αδελφής /verify: ένα «✓» κειμένου δεν κάθεται
                  στο ίδιο οπτικό ύψος με τη γραμμή και αλλάζει ανά γραμματοσειρά. */}
              <CircleCheckBig size={18} strokeWidth={2.5} aria-hidden="true" style={{ color: 'var(--positive)', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--positive)' }}>Η διεύθυνση επιβεβαιώθηκε.</span>
            </div>
            {/* ΤΕΣΣΕΡΙΣ ΓΡΑΜΜΕΣ ΜΕ ΤΥΧΑΙΑ ΤΕΛΗ, ΣΕ ΚΑΡΤΑ 384. Η κάρτα είναι 440
                μείον 2×28 γέμισμα, δηλαδή μέτρο ~58 χαρακτήρων στα 13 — στενή
                στήλη, όπου η ριγμένη δεξιά άκρη φαίνεται σε κάθε γραμμή. Στοίχιση
                πέρα πέρα με δικά μας μαλακά ενωτικά: χωρίς αυτά η ίδια στοίχιση
                θα τέντωνε τα κενά αντί να σπάσει λέξη. */}
            <p className="po-just" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {hy(<>Από εδώ και πέρα οι υπενθυμίσεις για λογαριασμούς, ενοίκια και γεγονότα του ημερολογίου θα φτάνουν σε αυτή τη διεύθυνση. Αν θέλεις να σταματήσουν, η διεύθυνση αλλάζει ή σβήνεται από τον λογαριασμό που την όρισε.</>)}
            </p>
          </div>
        )}

        {/* Τρεις γραμμές στην ίδια κάρτα των 384 (μέτρο ~58 χαρακτήρων στα 13).
            Ιδια μεταχείριση με το μήνυμα επιτυχίας από πάνω: οι δύο καταστάσεις
            της σελίδας διαβάζονται η μία στη θέση της άλλης, οπότε δεν έχει
            νόημα η μία να κλείνει δεξιά κι η άλλη όχι. */}
        {state === 'invalid' && (
          <p className="po-just" style={{ paddingTop: T.sp.xl, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {hy(<>Ο σύνδεσμος δεν είναι έγκυρος, έχει λήξει ή χρησιμοποιήθηκε ήδη. Νέα επιβεβαίωση στέλνεται από τον λογαριασμό που όρισε αυτή τη διεύθυνση, στις Ειδοποιήσεις.</>)}
          </p>
        )}

        {/* Ο σύνδεσμος δεν κρίθηκε. Το λέμε έτσι ακριβώς, με κουμπί: η μόνη
            σωστή ενέργεια είναι να ξαναρωτήσεις. */}
        {state === 'offline' && (
          <div style={{ paddingTop: T.sp.xl }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Δεν λάβαμε απάντηση, οπότε ο σύνδεσμος δεν ελέγχθηκε. Μπορεί να είναι έγκυρος.
            </p>
            <div style={{ marginTop: 16 }}><Btn onClick={confirm}>Δοκιμή ξανά</Btn></div>
          </div>
        )}
      </div>
    </div>
  );
}
