// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΟ ΠΟΥ ΔΙΑΒΑΖΕΤΑΙ Η ΜΕΤΡΗΣΗ: ΤΟ ΚΛΕΙΔΙ ΥΠΗΡΕΣΙΑΣ, ΑΠΟ ΤΟ ΕΝΑ ΣΗΜΕΙΟ ΤΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Οι συναρτήσεις metrics_weekly και metrics_snapshot εκτελούνται μόνο από τον
// service_role (μετανάστευση 20261020150000). Ο πελάτης υπηρεσίας φτιάχνεται
// μόνο από το lib/supabase/service.ts, όπως ορίζει ο guard-service-role: εδώ
// δεν γράφεται ούτε το όνομα της μεταβλητής.
//
// Τρέχει μόνο σε διακομιστή ή τερματικό (scripts/metrics-report.ts). Κανένα
// αρχείο του περιηγητή δεν το εισάγει.
// ═══════════════════════════════════════════════════════════════════════════
import { createServiceClient, serviceClientError } from '@/lib/supabase/service';
import { parseWeeklyRows, parseSnapshot, type WeeklyRow, type Snapshot } from './weekly';

type Env = Record<string, string | undefined>;

/** Τι λείπει για να διαβαστεί η μέτρηση· κενό όταν δεν λείπει τίποτα. */
export function metricsUnavailable(env: Env): string {
  return serviceClientError(env);
}

/** Οι εβδομάδες και η σημερινή εικόνα. Πετά με τον κωδικό της βάσης, ποτέ με το κλειδί. */
export async function loadMetrics(weeks: number, env: Env): Promise<{ rows: WeeklyRow[]; snapshot: Snapshot | null }> {
  const db = createServiceClient(env);
  const [w, s] = await Promise.all([
    db.rpc('metrics_weekly', { p_weeks: weeks }),
    db.rpc('metrics_snapshot'),
  ]);
  if (w.error) throw new Error(`metrics_weekly: ${w.error.code ?? ''} ${w.error.message}`.trim());
  if (s.error) throw new Error(`metrics_snapshot: ${s.error.code ?? ''} ${s.error.message}`.trim());
  return { rows: parseWeeklyRows(w.data), snapshot: parseSnapshot(s.data) };
}
