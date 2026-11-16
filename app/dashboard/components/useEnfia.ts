'use client';

// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΝΦΙΑ ΤΗΣ ΛΟΓΙΣΤΙΚΗΣ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΡΙΑ ΠΟΣΑ ΣΤΗΝ ΙΔΙΑ ΟΘΟΝΗ. Η Κατάσταση Αποτελεσμάτων έγραφε «ΕΝΦΙΑ
// −108,78€» από δική της εκτίμηση (αξία και τετραγωνικά του ακινήτου). Λίγο πιο
// κάτω, ο Υπολογισμός ΕΝΦΙΑ έγραφε «ΕΝΦΙΑ τον χρόνο 428,00€ · Περσινό ποσό» και
// στο πλακίδιο της εκτίμησης 155,40€ από τη ΔΙΚΗ ΤΟΥ φόρμα. Ο πίνακας κρατούσε
// τις ρυθμίσεις του μόνος του και τίποτα από αυτές δεν έφτανε στην Κατάσταση:
// η πρόβλεψη φόρου αγνοούσε τα 428€ που ο ιδιοκτήτης είχε μόλις γράψει.
//
// ΤΩΡΑ Η ΑΠΑΝΤΗΣΗ ΒΓΑΙΝΕΙ ΕΔΩ ΚΑΙ ΟΙ ΔΥΟ ΤΗ ΔΙΑΒΑΖΟΥΝ. Η Λογιστική κρατά τις
// ρυθμίσεις (ένα `useBillsSettings`, όχι δύο αντίγραφα που θα απέκλιναν) και
// περνά στον πίνακα και τις ρυθμίσεις και το αποτέλεσμα. Η σειρά αξιοπιστίας
// είναι αυτή του `enfiaInUse`: φετινό, περσινό, εκτίμηση.
//
// ΜΙΑ ΕΚΤΙΜΗΣΗ, ΟΧΙ ΔΥΟ. Όταν ο ιδιοκτήτης έχει συμπληρώσει τη φόρμα του
// πίνακα (ζώνη, εμβαδόν, όροφος), η εκτίμηση βγαίνει από εκεί: είναι δικά του
// στοιχεία. Αλλιώς βγαίνει από τα στοιχεία της καρτέλας του ακινήτου με την
// `estimateENFIAFromFacts`. Το ίδιο νούμερο φαίνεται στο πλακίδιο της
// εκτίμησης και, όταν είναι αυτό σε χρήση, στην Κατάσταση.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useBillsSettings } from './BillsSettings';
import { createClient } from '@/lib/supabase/client';
import * as properties from '@/lib/data/properties';
import { readEnfiaCounts } from '@/lib/calendar/enfiaTotals';
import { ENFIA_DEFAULTS, type EnfiaSettings, type EnfiaNow } from '@/lib/facts/enfia';

// Ο ΕΝΦΙΑ του έτους είναι καθαρή συνάρτηση και ζει στο lib/facts/enfia.ts, ώστε
// να τον διαβάζουν και οθόνες χωρίς React (Νόα, αναφορές). Εδώ μένει μόνο η
// ανάγνωση των ρυθμίσεων.
export { ENFIA_UNKNOWN, ENFIA_DEFAULTS, enfiaForYear } from '@/lib/facts/enfia';
export type { EnfiaSettings, EnfiaFacts, EnfiaNow } from '@/lib/facts/enfia';

/** Οι ρυθμίσεις ΕΝΦΙΑ του ακινήτου: μία ανάγνωση για Κατάσταση και πίνακα. */
export function useEnfiaSettings(propertyId: string, userId: string) {
  return useBillsSettings(propertyId, userId, 'services', ENFIA_DEFAULTS);
}

/** Ό,τι χρειάζεται ο πίνακας ΕΝΦΙΑ από τον γονέα του. */
export interface EnfiaState {
  settings: EnfiaSettings;
  update: (patch: Partial<EnfiaSettings>) => void;
  loading: boolean;
  now: EnfiaNow;
}

const supabase = createClient();

/**
 * Έτος → πλήθος δόσεων του εκκαθαριστικού του φορολογούμενου στον οποίο ανήκει
 * το ακίνητο, από τα ΣΥΝΟΛΑ (lib/calendar/enfiaTotals.ts, ο ίδιος κανόνας με
 * το Ημερολόγιο). Χωρίς γνωστό σύνολο ή με σφάλμα ανάγνωσης: κενό, οπότε το
 * πλήθος βγαίνει από το ποσό του ακινήτου, όπως πριν.
 *
 * ΓΙΑΤΙ. Ο ΕΝΦΙΑ ανά ακίνητο (π.χ. ο φόρος της γραμμής της πράξης, 27€) θα
 * έβγαζε δύο δόσεις στην Επισκόπηση, ενώ το Ημερολόγιο γράφει δώδεκα από το
 * σύνολο του ΑΦΜ.
 */
export function useEnfiaInstalmentCounts(propertyId: string, userId: string): Readonly<Record<number, number>> | undefined {
  const key = propertyId && userId ? `${propertyId}|${userId}` : '';
  const [store, setStore] = useState<{ key: string; counts: Record<number, number> | undefined }>({ key: '', counts: undefined });
  useEffect(() => {
    if (!key) return;
    let live = true;
    void (async () => {
      const list = await properties.listWithError<{ id: string; client_id: string | null }>(supabase, userId, { columns: 'id,client_id' });
      if (list.error) return;
      const res = await readEnfiaCounts(supabase, userId, list.rows);
      if (live && !res.error) setStore({ key, counts: res.counts.get(propertyId) });
    })();
    return () => { live = false; };
  }, [key, propertyId, userId]);
  return store.key === key ? store.counts : undefined;
}
