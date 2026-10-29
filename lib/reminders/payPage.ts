// Η ανάγνωση της σελίδας /plirosa/<διακριτικό>, με τον πελάτη υπηρεσίας μέσα στο lib/.
import { createServiceClient, serviceClientError } from '@/lib/supabase/service';
import { peekPayToken, type PayPeek } from './payRedeem';

export async function peekForPage(token: string, now: Date): Promise<PayPeek> {
  if (serviceClientError(process.env)) return { ok: false, kind: 'error' };
  return peekPayToken(createServiceClient(), token, now);
}
