'use client';

// ═══════════════════════════════════════════════════════════════════════════
// useBillingWords — η κατάσταση της χρέωσης, στις λέξεις των Ορων
// ─────────────────────────────────────────────────────────────────────────
// Οι λέξεις γράφονται μία φορά στο lib/legal/billingWords.ts και διαβάζονται
// στον διακομιστή (app/api/billing/words). Εδώ μόνο φτάνουν στην οθόνη.
//
// ΜΙΑ ΕΡΩΤΗΣΗ ΑΝΑ ΦΟΡΤΩΣΗ ΣΕΛΙΔΑΣ. Η απάντηση αλλάζει μόνο με νέα διάταξη
// του διακομιστή, οπότε κρατιέται στη μνήμη της σελίδας· μια αποτυχία δεν
// κρατιέται, ώστε η επόμενη οθόνη να ξαναρωτήσει.
//
// `null` σημαίνει «δεν ξέρουμε». Καμία οθόνη δεν μαντεύει στη θέση του
// διακομιστή: χωρίς απάντηση, δεν λέγεται τίποτα για τη χρέωση.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

export interface ClientBillingWords {
  live: boolean;
  afterTrialShort: string;
  partnerTarget: string | null;
}

let pending: Promise<ClientBillingWords | null> | null = null;

function load(): Promise<ClientBillingWords | null> {
  if (!pending) {
    pending = fetch('/api/billing/words')
      .then(r => (r.ok ? (r.json() as Promise<ClientBillingWords>) : null))
      .catch(() => null)
      .then(w => {
        if (!w || typeof w.live !== 'boolean') { pending = null; return null; }
        return w;
      });
  }
  return pending;
}

export function useBillingWords(): ClientBillingWords | null {
  const [words, setWords] = useState<ClientBillingWords | null>(null);
  useEffect(() => {
    let alive = true;
    load().then(w => { if (alive) setWords(w); });
    return () => { alive = false; };
  }, []);
  return words;
}
