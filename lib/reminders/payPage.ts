// Η ανάγνωση της σελίδας /plirosa/<διακριτικό>, με τον πελάτη υπηρεσίας μέσα στο lib/.
// ΠΟΤΕ 500: χωρίς ρυθμίσεις, με πεσμένη βάση ή πριν υπάρξει ο πίνακας
// `reminder_pay_tokens`, η σελίδα δείχνει «Δεν φορτώθηκε τώρα» και τον δρόμο
// μέσα από την εφαρμογή.
import { createServiceClient, serviceClientError } from '@/lib/supabase/service';
import { peekPayToken, type PayPeek } from './payRedeem';

export async function peekForPage(token: string, now: Date): Promise<PayPeek> {
  if (serviceClientError(process.env)) return { ok: false, kind: 'error' };
  try {
    return await peekPayToken(createServiceClient(), token, now);
  } catch {
    return { ok: false, kind: 'error' };
  }
}
