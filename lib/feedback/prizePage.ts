// Η ανάγνωση της σελίδας /doro/<διακριτικό>, με τον πελάτη υπηρεσίας μέσα στο lib/
// (όπως το lib/reminders/payPage.ts). ΠΟΤΕ 500: χωρίς ρυθμίσεις ή με πεσμένη
// βάση η σελίδα δείχνει «Δεν φορτώθηκε τώρα» και τον δρόμο μέσα από την εφαρμογή.
import { createServiceClient, serviceClientError } from '@/lib/supabase/service';
import { peekPrize, type PrizePeek } from './prize';

export async function peekPrizeForPage(token: string): Promise<PrizePeek> {
  if (serviceClientError(process.env)) return { ok: false, kind: 'error' };
  try {
    return await peekPrize(createServiceClient(), token);
  } catch {
    return { ok: false, kind: 'error' };
  }
}
