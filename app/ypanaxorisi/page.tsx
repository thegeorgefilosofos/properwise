// ═══════════════════════════════════════════════════════════════════════════
// «ΥΠΑΝΑΧΩΡΗΣΗ ΑΠΟ ΤΗ ΣΥΜΒΑΣΗ ΕΔΩ»: Η ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ ΤΗΣ ΛΕΙΤΟΥΡΓΙΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Η υποχρέωση και οι πηγές: lib/legal/withdrawal.ts. Η σελίδα ανοίγει ΚΑΙ
// χωρίς σύνδεση (proxy.ts, PUBLIC): όποιος ξέχασε τον κωδικό του ή έσβησε την
// εφαρμογή έχει το ίδιο δικαίωμα με όποιον είναι μέσα. Με σύνδεση, η φόρμα
// έρχεται συμπληρωμένη από τον λογαριασμό και μένει διορθώσιμη: το άρθ. 11α
// ζητά ο καταναλωτής να ΔΙΝΕΙ Ή ΝΑ ΕΠΙΒΕΒΑΙΩΝΕΙ τα στοιχεία, όχι να τα μαντεύει.
//
// ΕΚΤΟΣ ΕΥΡΕΤΗΡΙΟΥ. Με σύνδεση η σελίδα τυπώνει όνομα και email του χρήστη·
// ό,τι δείχνει δεδομένα χρήστη μένει `noindex` (κανόνας ελέγχου του AGENTS.md).
// ═══════════════════════════════════════════════════════════════════════════
import { noindexPage } from '@/lib/seo/noindex';
import { createClient } from '@/lib/supabase/server';
import * as billing from '@/lib/data/billing';
import { PLANS, normalizePlan } from '@/lib/billing/plans';
import { billingWords } from '@/lib/legal/billingWords';
import { IDENTITY } from '@/lib/legal/identity';
import { WITHDRAWAL_DAYS, WITHDRAWAL_LABEL, WITHDRAWAL_CONFIRM_LABEL } from '@/lib/legal/withdrawal';
import { LegalLayout, MailLink, type LegalBlock } from '../legal-shell';
import Link from 'next/link';
import { LINK_STYLE } from '../linkStyle';
import WithdrawalForm from './WithdrawalForm';

export const metadata = noindexPage(
  'Υπαναχώρηση από τη σύμβαση · PROPERWISE',
  `Υπαναχώρηση από τη σύμβαση με το PROPERWISE μέσα σε ${WITHDRAWAL_DAYS} ημέρες, με επιβεβαίωση και αποδεικτικό στο email σου.`,
);

/** Τι σύμβαση έχει ο λογαριασμός, σε μία φράση για να την επιβεβαιώσει ο ίδιος. */
function contractOf(plan: string | null | undefined, cycle: string | null | undefined): string {
  const id = normalizePlan(plan || 'free');
  if (id === 'free') return `Λογαριασμός ${IDENTITY.tradeName}, δωρεάν πακέτο «${PLANS.free.name}»`;
  return `Συνδρομή ${IDENTITY.tradeName} «${PLANS[id].name}», ${cycle === 'annual' ? 'ετήσια' : 'μηνιαία'}`;
}

export default async function WithdrawalPage() {
  const words = billingWords();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let prefill = { name: '', email: '', contract: '' };
  if (user) {
    const p = await billing.profile<{ full_name: string | null; plan: string | null; billing_cycle: string | null }>(
      supabase, user.id, 'full_name, plan, billing_cycle');
    const meta = (user.user_metadata as Record<string, string> | undefined) || {};
    prefill = { name: (p?.full_name || meta.full_name || '').trim(), email: user.email || '', contract: contractOf(p?.plan, p?.billing_cycle) };
  }

  const blocks: LegalBlock[] = [
    {
      id: 'dilosi',
      h: 'Η δήλωσή σου',
      body: (
        <>
          <p className="lg-p">
            Συμπλήρωσε ή έλεγξε τα στοιχεία και πάτα «Συνέχεια». Στο επόμενο βήμα βλέπεις ολόκληρη τη δήλωση και την
            υποβάλλεις με το κουμπί «{WITHDRAWAL_CONFIRM_LABEL}». Τίποτα δεν στέλνεται πριν από αυτό.
          </p>
          <WithdrawalForm signedIn={!!user} prefill={prefill} />
        </>
      ),
    },
    {
      h: 'Τι γίνεται μετά',
      body: (
        <ul className="lg-ul">
          <li>Η δήλωση καταγράφεται τη στιγμή που την επιβεβαιώνεις, με ημερομηνία και ώρα. Αυτή η στιγμή κρίνει αν είναι εμπρόθεσμη.</li>
          <li>Λαμβάνεις αμέσως στο email σου αποδεικτικό με όλο το περιεχόμενο της δήλωσης και την ημερομηνία και ώρα υποβολής.</li>
          <li>Αν είσαι συνδεδεμένος και έχεις συνδρομή, την ακυρώνουμε αμέσως ώστε να μην ανανεωθεί. Χωρίς σύνδεση, τη βρίσκουμε από τα στοιχεία που έγραψες.</li>
          <li>{words.withdrawalTo
            ? 'Διαβιβάζουμε τη δήλωση στον πωλητή της συνδρομής, που εκτελεί την επιστροφή ολόκληρου του ποσού με τον ίδιο τρόπο πληρωμής.'
            : 'Αν έχεις πληρώσει συνδρομή, διαβιβάζουμε τη δήλωση στον πωλητή της, που εκτελεί την επιστροφή ολόκληρου του ποσού με τον ίδιο τρόπο πληρωμής.'}</li>
        </ul>
      ),
    },
    {
      h: 'Η προθεσμία και τα χρήματα',
      body: (
        <>
          <p className="lg-p">{`Ως καταναλωτής έχεις ${WITHDRAWAL_DAYS} ημέρες από τη σύναψη της σύμβασης για να υπαναχωρήσεις χωρίς αιτιολογία. Η προθεσμία τηρείται αν η δήλωση υποβληθεί πριν λήξει.`}</p>
          <p className="lg-p">{words.withdrawal}</p>
          <p className="lg-p">
            Η λειτουργία δέχεται τη δήλωση και μετά την προθεσμία: δεν κρίνει η φόρμα αν ισχύει, την εξετάζουμε με το παραστατικό.
          </p>
        </>
      ),
    },
    {
      h: 'Άλλοι τρόποι',
      body: (
        <p className="lg-p">
          Μπορείς επίσης να στείλεις τη δήλωση στο <MailLink to={IDENTITY.supportEmail} />{words.withdrawalVia ? ` ${words.withdrawalVia}` : ''}{' '}
          Το υπόδειγμα εντύπου υπαναχώρησης βρίσκεται στους <Link href="/terms#ypanachorisi" style={LINK_STYLE}>Όρους χρήσης</Link>.
        </p>
      ),
    },
  ];

  return (
    <LegalLayout
      self="/ypanaxorisi"
      eyebrow="Νομικά"
      title={WITHDRAWAL_LABEL.replace(/ εδώ$/, '')}
      intro={`Από εδώ υπαναχωρείς από τη σύμβασή σου με το ${IDENTITY.tradeName}, με ή χωρίς σύνδεση στον λογαριασμό σου.`}
      blocks={blocks}
    />
  );
}
