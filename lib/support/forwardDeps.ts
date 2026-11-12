// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΞΑΡΤΗΣΕΙΣ ΤΗΣ ΠΡΟΩΘΗΣΗΣ, ΔΕΜΕΝΕΣ ΣΤΗ ΒΑΣΗ ΚΑΙ ΣΤΟ ΠΕΡΙΒΑΛΛΟΝ
// ─────────────────────────────────────────────────────────────────────────
// Μία φορά, ώστε το inbound και το cron να στέλνουν με τον ίδιο τρόπο.
// Μόνο για διακομιστή: παίρνει τον πελάτη υπηρεσίας από τον καλούντα.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { FORWARD_ENV } from '@/lib/inbound/priority';
import { fetchBody, KEY_ENV } from '@/lib/inbound/fetchBody';
import { INBOUND_DOMAIN } from '@/lib/inbound/address';
import { MAIL_DOMAIN } from '@/lib/legal/identity';
import type { ForwardDeps } from '@/lib/support/forwarder';

export function forwardDeps(db: SupabaseClient): ForwardDeps {
  return {
    to: process.env[FORWARD_ENV],
    apiKey: process.env[KEY_ENV],
    ownDomains: [INBOUND_DOMAIN, MAIL_DOMAIN].filter(Boolean),
    fetchBody: id => fetchBody(id, process.env[KEY_ENV]),
    settle: async (id, outcome, code, uncertain) => {
      const { data, error } = await db.rpc('support_forward_settle', { p_id: id, p_outcome: outcome, p_code: code, p_uncertain: uncertain });
      return { state: typeof data === 'string' ? data : null, error };
    },
  };
}
