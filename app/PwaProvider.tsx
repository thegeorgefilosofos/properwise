'use client';

// ═══════════════════════════════════════════════════════════════════════════
// PWA — καταχώρηση του service worker και ήπια πρόσκληση εγκατάστασης.
//
// ΔΥΟ ΚΑΝΟΝΕΣ ΕΥΓΕΝΕΙΑΣ:
//  1. Δεν ζητάμε εγκατάσταση σε κάποιον που μόλις μπήκε. Η πρόσκληση εμφανίζεται
//     μόνο αφού ο χρήστης έχει ήδη περάσει λίγη ώρα μέσα (δεύτερη επίσκεψη+),
//     και μόνο στην εφαρμογή — ποτέ στη landing.
//  2. Ένα «όχι» σημαίνει όχι. Το απορριφθέν banner δεν ξαναεμφανίζεται για 60
//     ημέρες. Κανένα dark pattern, καμία επανάληψη.
//
// Ο browser δίνει το `beforeinstallprompt` μόνο όταν πληρούνται τα δικά του
// κριτήρια (HTTPS, manifest, service worker). Στο iOS δεν υπάρχει καθόλου —
// εκεί η εγκατάσταση γίνεται από το «Κοινή χρήση → Προσθήκη στην οθόνη
// Αφετηρίας» και το λέμε με λόγια αντί να δείχνουμε κουμπί που δεν κάνει
// τίποτα. Ως τις 29.09.2026 το έλεγε μόνο αυτό το σχόλιο: η πρόσκληση άνοιγε
// αποκλειστικά με το γεγονός που το Safari δεν στέλνει, άρα κανένας χρήστης
// iPhone δεν την είδε ποτέ.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, type ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import { holdPrompt, runPrompt, isInstalled, needsManualInstall, markAdded, type BeforeInstallPromptEvent } from '@/lib/pwa/install';

// Το μήνυμα φορτώνεται μόνο όταν πρόκειται να φανεί (δες InstallBanner.tsx).
// Με σκέτο `import()` και όχι `next/dynamic`: ο φορτωτής του δεύτερου θα
// έμπαινε κι αυτός στην πρώτη φόρτωση κάθε σελίδας, για ένα μήνυμα.
type BannerProps = { mode: 'prompt' | 'ios'; onInstall: () => void; onDismiss: () => void };

const DISMISS_KEY = 'po_pwa_dismissed_at';
const VISITS_KEY = 'po_pwa_visits';
const DISMISS_DAYS = 60;
const MIN_VISITS = 2;

/** Είπε «όχι» τις τελευταίες 60 ημέρες; */
function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || '0');
    return !!at && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch { return false; /* private mode */ }
}

export default function PwaProvider() {
  const pathname = usePathname();
  const [mode, setMode] = useState<'prompt' | 'ios' | null>(null);
  const [Banner, setBanner] = useState<ComponentType<BannerProps> | null>(null);
  // Το layout είναι ΕΝΑ για όλο το site, οπότε χωρίς αυτόν τον έλεγχο το banner
  // εμφανιζόταν και στη landing και — χειρότερα — στις σελίδες ενοικιαστή/λογιστή
  // με token, ζητώντας από τρίτους να εγκαταστήσουν εφαρμογή που δεν τους αφορά.
  const inApp = !!pathname && pathname.startsWith('/dashboard');

  // Καταχώρηση του service worker. Μόνο σε production: στο dev ο SW κρύβει
  // αλλαγές πίσω από cache και τρελαίνει το hot reload.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => { /* δεν είναι κρίσιμο */ });
  }, []);

  useEffect(() => {
    let visits = 0;
    try {
      visits = Number(localStorage.getItem(VISITS_KEY) || '0') + 1;
      localStorage.setItem(VISITS_KEY, String(visits));
    } catch { /* private mode */ }
    const eligible = () => !isInstalled() && visits >= MIN_VISITS && !dismissedRecently();

    // iPhone/iPad: κανένα γεγονός δεν θα έρθει, η απόφαση παίρνεται εδώ. Με
    // λίγη καθυστέρηση: ένα μήνυμα πάνω στην πρώτη ζωγραφιά της οθόνης
    // σκεπάζει ό,τι ήρθε να δει ο χρήστης πριν προλάβει να το δει.
    const iosTimer = needsManualInstall() && eligible()
      ? window.setTimeout(() => setMode('ios'), 4000) : 0;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      // Η πρόσκληση κρατιέται ΠΑΝΤΑ ακόμη κι όταν το πλωτό μήνυμα δεν θα φανεί: το
      // κουμπί των Ρυθμίσεων την ανοίγει όποτε τη ζητήσει ο ίδιος ο χρήστης.
      holdPrompt(e as BeforeInstallPromptEvent);
      // ΚΑΜΙΑ απόφαση εδώ για τη διαδρομή: το event πυροδοτείται μία φορά ανά
      // έγγραφο, συνήθως όσο ο χρήστης είναι ακόμη στη landing. Αν κόβαμε εδώ,
      // το banner δεν θα εμφανιζόταν ΠΟΤΕ στη φυσιολογική ροή landing → login →
      // dashboard, που είναι client-side πλοήγηση μέσα στο ίδιο έγγραφο.
      if (eligible()) setMode('prompt');
    };
    // Εγκαταστάθηκε (από εδώ ή από το μενού του περιηγητή): τίποτα να προτείνει.
    const onInstalled = () => { holdPrompt(null); markAdded(); setMode(null); };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.clearTimeout(iosTimer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const remember = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
  };

  const install = async () => {
    setMode(null);
    // Άκυρο στο native παράθυρο = «όχι». Χωρίς αυτό, το banner ξαναεμφανιζόταν
    // στην επόμενη φόρτωση — ακριβώς η επανάληψη που υποσχεθήκαμε να μην κάνουμε.
    if (await runPrompt() === 'dismissed') remember();
  };

  const dismiss = () => { setMode(null); remember(); };

  // Το κομμάτι κατεβαίνει τη στιγμή που χρειάζεται, όχι πριν.
  useEffect(() => {
    if (!mode || !inApp || Banner) return;
    let alive = true;
    import('./InstallBanner').then(m => { if (alive) setBanner(() => m.default); }).catch(() => { /* χωρίς δίκτυο: χωρίς μήνυμα */ });
    return () => { alive = false; };
  }, [mode, inApp, Banner]);

  if (!mode || !inApp || !Banner) return null;
  return <Banner mode={mode} onInstall={install} onDismiss={dismiss} />;
}
