// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΣΕΣ ΔΟΣΕΙΣ ΕΧΕΙ ΤΟ ΕΚΚΑΘΑΡΙΣΤΙΚΟ ΕΝΦΙΑ ΚΑΘΕ ΦΟΡΟΛΟΓΟΥΜΕΝΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ (20.10.2026). Ο αυτόματος συγχρονισμός έγραφε δώδεκα υπενθυμίσεις
// ΕΝΦΙΑ σε κάθε ιδιοκτήτη ακόμη και σε όποιον χρωστά 27,44€ και πληρώνει σε δύο
// δόσεις. Ο νόμος θέλει κάθε δόση τουλάχιστον `ENFIA_MIN_INSTALMENT`, έως
// `ENFIA_INSTALMENTS` (lib/tools/enfiaSchedule.ts, με τις πηγές του).
//
// ΤΟ ΠΛΗΘΟΣ ΕΙΝΑΙ ΤΟΥ ΕΚΚΑΘΑΡΙΣΤΙΚΟΥ, ΟΧΙ ΤΟΥ ΑΚΙΝΗΤΟΥ. Ενα εκκαθαριστικό ανά
// ΑΦΜ, με όλα τα ακίνητα μέσα. Το μερίδιο ενός ακινήτου ΔΕΝ αρκεί: 27€ ενός
// διαμερίσματος από σύνολο 120€ είναι δώδεκα δόσεις, όχι δύο. Γι' αυτό
// μετράνε μόνο δύο πηγές· και οι δύο είναι ΣΥΝΟΛΑ:
//   · το σαρωμένο εκκαθαριστικό («ΕΝΦΙΑ 2026» στο Αρχείο, ποσό = σύνολο)·
//   · το «Σύνολο εκκαθαριστικού» που γράφει ο ίδιος στον Υπολογισμό ΕΝΦΙΑ
//     (ρυθμίσεις `services`: `enfiaStatementTotal`, `enfiaStatementYear`).
//
// ΠΟΙΑ ΑΚΙΝΗΤΑ ΕΙΝΑΙ ΤΟΥ ΙΔΙΟΥ ΑΦΜ. Ο κανόνας του lib/accounting/taxpayer.ts:
// ιδιώτης = ένας φορολογούμενος· επαγγελματίας = ανά καρτέλα «Ιδιοκτήτης»·
// επαγγελματίας χωρίς καρτέλες = κάθε ακίνητο μόνο του. Οταν ο τύπος
// λογαριασμού δεν διαβάζεται (π.χ. μέλος ομάδας), κάθε ακίνητο μόνο του.
//
// ΚΑΘΕ ΑΜΦΙΒΟΛΙΑ ΠΡΟΣ ΤΙΣ ΠΕΡΙΣΣΟΤΕΡΕΣ ΔΟΣΕΙΣ. Μια υπενθύμιση που περισσεύει
// κοστίζει ένα κλικ· μια που λείπει, πρόστιμο:
//   · δύο πηγές που διαφωνούν → το ΜΕΓΑΛΥΤΕΡΟ σύνολο·
//   · ενωμένα ακίνητα μόνο όταν ο κανόνας του φορολογούμενου είναι βέβαιος·
//   · άγνωστο σύνολο → κανένα πλήθος, δηλαδή δώδεκα με σημείωση (η μηχανή)·
//   · σφάλμα ανάγνωσης → ο συγχρονισμός ΔΕΝ γράφει τίποτα (taxSync), αντί να
//     ξαναγεννήσει τις δόσεις που είχε σβήσει.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbError } from '@/lib/supabase/writeResult';
import { enfiaInstalmentCount } from '@/lib/tools/enfiaSchedule';
import { taxpayerOf, type TaxpayerProperty } from '@/lib/accounting/taxpayer';
import { parseAmount } from '@/lib/core/greek';
import * as settings from '@/lib/data/settings';
import * as documents from '@/lib/data/documents';
import * as billing from '@/lib/data/billing';

/** Τα κλειδιά του «Σύνολο εκκαθαριστικού» στις ρυθμίσεις `services` του ακινήτου. */
export interface EnfiaTotalSettings { enfiaStatementTotal?: unknown; enfiaStatementYear?: unknown }

/** Ενα γνωστό σύνολο εκκαθαριστικού, όπου κι αν βρέθηκε. */
export interface EnfiaTotalFact { propertyId: string; year: number; amount: number }

/** Το σύνολο που έγραψε ο χρήστης σε ένα ακίνητο, αν έχει έτος και ποσό. */
export function enfiaTotalOfSettings(propertyId: string, s: EnfiaTotalSettings | null | undefined): EnfiaTotalFact | null {
  if (!s) return null;
  const year = Number(String(s.enfiaStatementYear ?? '').trim());
  const amount = parseAmount(String(s.enfiaStatementTotal ?? '')) ?? 0;
  if (!Number.isInteger(year) || year < 2000 || !(amount > 0)) return null;
  return { propertyId, year, amount };
}

/**
 * Ακίνητο → (έτος → πλήθος δόσεων). Καθαρή συνάρτηση.
 *
 * @param scope `null` = ένας φορολογούμενος (ιδιώτης)· σύνολο καρτελών
 *        «Ιδιοκτήτης» για τον επαγγελματία· κενό σύνολο = κάθε ακίνητο μόνο του.
 */
export function enfiaCountsByProperty(
  props: readonly TaxpayerProperty[], scope: ReadonlySet<string> | null, facts: readonly EnfiaTotalFact[],
): Map<string, Record<number, number>> {
  const out = new Map<string, Record<number, number>>();
  for (const [id, byYear] of enfiaTotalsByProperty(props, scope, facts)) {
    const counts: Record<number, number> = {};
    for (const [year, total] of Object.entries(byYear)) {
      const n = enfiaInstalmentCount(total);
      if (n > 0) counts[Number(year)] = n;
    }
    out.set(id, counts);
  }
  return out;
}

/**
 * Ακίνητο → (έτος → ΣΥΝΟΛΟ εκκαθαριστικού ΕΝΦΙΑ του φορολογούμενου του).
 * Ο ίδιος κανόνας φορολογούμενου με την `enfiaCountsByProperty`: δύο ακίνητα
 * του ίδιου ανθρώπου μοιράζονται ένα εκκαθαριστικό, όχι δύο. Από αυτό βγαίνει
 * το ποσό κάθε δόσης στις υπενθυμίσεις (`enfiaInstalments`, 29/10/2026).
 */
export function enfiaTotalsByProperty(
  props: readonly TaxpayerProperty[], scope: ReadonlySet<string> | null, facts: readonly EnfiaTotalFact[],
): Map<string, Record<number, number>> {
  const keyOf = (p: TaxpayerProperty) => !scope ? '' : scope.size === 0 ? `p:${p.id}` : taxpayerOf(p, scope);
  const key = new Map(props.map(p => [p.id, keyOf(p)]));
  // Φορολογούμενος → έτος → το μεγαλύτερο γνωστό σύνολο.
  const totals = new Map<string, Map<number, number>>();
  for (const f of facts) {
    const k = key.get(f.propertyId);
    if (k === undefined) continue;
    const byYear = totals.get(k) ?? new Map<number, number>();
    byYear.set(f.year, Math.max(byYear.get(f.year) ?? 0, f.amount));
    totals.set(k, byYear);
  }
  const out = new Map<string, Record<number, number>>();
  for (const p of props) out.set(p.id, Object.fromEntries(totals.get(key.get(p.id) as string) ?? []));
  return out;
}

/**
 * Διαβάζει ό,τι χρειάζεται η `enfiaCountsByProperty` για τα ακίνητα ενός
 * ιδιοκτήτη. Οποιο σφάλμα ανάγνωσης επιστρέφεται: ο καλών δεν γράφει τίποτα.
 */
export async function readEnfiaCounts(
  db: SupabaseClient, ownerId: string, props: readonly TaxpayerProperty[],
): Promise<{ counts: Map<string, Record<number, number>>; totals: Map<string, Record<number, number>>; error: DbError | null }> {
  const empty = new Map<string, Record<number, number>>();
  if (!props.length) return { counts: empty, totals: empty, error: null };
  const ids = props.map(p => p.id);
  const [prof, conf, docs] = await Promise.all([
    billing.profileOutcome<{ profile_type: string | null }>(db, ownerId, 'profile_type'),
    settings.acrossPropertiesWithError<EnfiaTotalSettings>(db, ids, 'services', ownerId),
    documents.enfiaStatementsWithError(db, ids, ownerId),
  ]);
  const error = (prof.error as DbError | null) ?? conf.error ?? docs.error;
  if (error) return { counts: empty, totals: empty, error };

  // Ο τύπος λογαριασμού που δεν διαβάστηκε δεν ενώνει τίποτα.
  let scope: ReadonlySet<string> | null = new Set<string>();
  if (prof.data && prof.data.profile_type !== 'professional') scope = null;
  else if (prof.data?.profile_type === 'professional') {
    const owners = await db.from('clients').select('id').eq('user_id', ownerId).eq('type', 'owner');
    if (owners.error) return { counts: empty, totals: empty, error: owners.error };
    scope = new Set(((owners.data ?? []) as { id: string }[]).map(r => r.id));
  }

  const facts: EnfiaTotalFact[] = [
    ...docs.statements,
    ...ids.map(id => enfiaTotalOfSettings(id, conf.data[id])).filter((f): f is EnfiaTotalFact => !!f),
  ];
  return { counts: enfiaCountsByProperty(props, scope, facts), totals: enfiaTotalsByProperty(props, scope, facts), error: null };
}
