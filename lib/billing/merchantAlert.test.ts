// npx tsx lib/billing/merchantAlert.test.ts
//
// Επιστροφή χρημάτων ή αμφισβήτηση στον έμπορο πρέπει να φτάνει σε άνθρωπο:
// χωρίς ακύρωση της συνδρομής, η επόμενη ανανέωση ξαναχρεώνει τον ίδιο.
import { alertFor, sendMerchantAlert } from './merchantAlert';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

(async () => {
  const refund = alertFor({
    eventType: 'refund.created',
    object: { id: 'ref_1', refund_amount: 499, refund_currency: 'eur', subscription: { id: 'sub_9' }, customer: { email: 'a@b.gr' } },
  });
  ok('η επιστροφή γεννά ειδοποίηση', refund !== null);
  ok('το θέμα λέει τι να γίνει', !!refund && refund.subject.includes('ακύρωσε τη συνδρομή'));
  ok('το σώμα ονομάζει τη συνδρομή', !!refund && refund.text.includes('sub_9'));
  ok('και το ποσό σε ευρώ', !!refund && refund.text.includes('4.99 EUR'));
  ok('κανένα email πελάτη στο μήνυμα', !!refund && !refund.text.includes('a@b.gr'));

  const dispute = alertFor({ eventType: 'dispute.created', object: { id: 'dsp_1', transaction: { subscription: 'sub_7', amount: 990, currency: 'EUR' } } });
  ok('η αμφισβήτηση γεννά ειδοποίηση', !!dispute && dispute.subject.includes('Αμφισβήτηση'));
  ok('και βρίσκει τη συνδρομή μέσα από τη συναλλαγή', !!dispute && dispute.text.includes('sub_7'));

  ok('γεγονός συνδρομής δεν ειδοποιεί', alertFor({ eventType: 'subscription.active', object: {} }) === null);
  ok('άγνωστο σχήμα δεν πετά', alertFor(null) === null && alertFor('x') === null);

  // Η ΑΠΟΣΤΟΛΗ ΔΕΝ ΠΕΤΑ ΠΟΤΕ.
  let sent: Record<string, unknown> = {};
  const good: typeof fetch = async (_u, init) => { sent = JSON.parse(String(init?.body || '{}')); return new Response('{}', { status: 200 }); };
  ok('στέλνει με κλειδί', await sendMerchantAlert(refund!, 'k', good));
  ok('στο γραμματοκιβώτιο της υποστήριξης', String(sent.to).startsWith('support@'));
  ok('χωρίς κλειδί δεν στέλνει', !(await sendMerchantAlert(refund!, '', good)));
  const down: typeof fetch = async () => { throw new Error('δίκτυο'); };
  ok('σφάλμα δικτύου γυρίζει false, δεν πετά', !(await sendMerchantAlert(refund!, 'k', down)));

  console.log(`billing/merchantAlert — ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
  console.log('✓ όλα πέρασαν');
})();
