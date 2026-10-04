'use client';

// ═══════════════════════════════════════════════════════════════════════════
// PWA — καταχώρηση του service worker και ήπια πρόσκληση εγκατάστασης.
//
// ΔΥΟ ΚΑΝΟΝΕΣ ΕΥΓΕΝΕΙΑΣ:
//  1. Δεν ζητάμε εγκατάσταση σε κάποιον που μόλις μπήκε. Η πρόσκληση εμφανίζεται
//     μόνο αφού ο χρήστης έχει ήδη περάσει λίγη ώρα μέσα (δεύτερη επίσκεψη+),
//     και μόνο στην εφαρμογή — ποτέ στη landing. ΕΞΑΙΡΕΣΗ ΤΟ iPhone (04.10.2026):
//     εκεί οι ειδοποιήσεις φτάνουν ΜΟΝΟ από την αρχική οθόνη, οπότε η οδηγία
//     έρχεται από την πρώτη είσοδο στον πίνακα, τέσσερα δευτερόλεπτα μετά.
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
type BannerMode = 'prompt' | 'ios' | 'notify';
type BannerProps = { mode: BannerMode; onInstall: () => void; onDismiss: () => void; note?: string; busy?: boolean };

const DISMISS_KEY = 'po_pwa_dismissed_at';
const VISITS_KEY = 'po_pwa_visits';
const DISMISS_DAYS = 60;
const MIN_VISITS = 2;
/** Στο iPhone η αρχική οθόνη είναι η μόνη πόρτα για τις ειδοποιήσεις: από την πρώτη επίσκεψη. */
const MIN_VISITS_IOS = 1;
/** «Όχι τώρα» στις ειδοποιήσεις μετά την εγκατάσταση: ξεχωριστό από το «όχι» στην εγκατάσταση. */
const NOTIFY_DISMISS_KEY = 'po_push_ask_dismissed_at';

/**
 * Τρέχει από την αρχική οθόνη, στέλνει ειδοποιήσεις και δεν έχει ερωτηθεί ακόμη.
 * Ο,τι χρειάζεται γράφεται εδώ και όχι από το lib/push/client: το layout το
 * κατεβάζει κάθε σελίδα και ένα ολόκληρο κομμάτι για τρεις ελέγχους δεν αξίζει.
 */
function shouldAskNotify(): boolean {
  if (!isInstalled()) return false;
  if (typeof Notification === 'undefined' || !('PushManager' in window) || !('serviceWorker' in navigator)) return false;
  if (!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim()) return false;
  if (Notification.permission !== 'default') return false;
  try {
    const at = Number(localStorage.getItem(NOTIFY_DISMISS_KEY) || '0');
    if (at && Date.now() - at < DISMISS_DAYS * 86400000) return false;
  } catch { /* private mode */ }
  return true;
}

/** Είπε «όχι» τις τελευταίες 60 ημέρες; */
function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || '0');
    return !!at && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch { return false; /* private mode */ }
}

export default function PwaProvider() {
  const pathname = usePathname();
  const [mode, setMode] = useState<BannerMode | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
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
    const eligible = (min: number) => !isInstalled() && visits >= min && !dismissedRecently();

    // iPhone/iPad: κανένα γεγονός δεν θα έρθει, η απόφαση παίρνεται εδώ. Με
    // λίγη καθυστέρηση: ένα μήνυμα πάνω στην πρώτη ζωγραφιά της οθόνης
    // σκεπάζει ό,τι ήρθε να δει ο χρήστης πριν προλάβει να το δει.
    // ΜΕΣΑ ΣΕ INSTAGRAM, FACEBOOK Κ.Α. ΔΕΝ ΥΠΑΡΧΕΙ «ΠΡΟΣΘΗΚΗ ΣΤΗΝ ΑΡΧΙΚΗ ΟΘΟΝΗ»:
    // η οδηγία θα έστελνε τον χρήστη να ψάχνει κουμπί που δεν υπάρχει. Ο
    // έλεγχος φορτώνεται μόνο στο iPhone, ώστε να μη βαραίνει κάθε σελίδα.
    let iosTimer = 0;
    let alive = true;
    if (needsManualInstall() && eligible(MIN_VISITS_IOS)) {
      import('@/lib/core/inAppBrowser').then(({ inAppBrowser }) => {
        if (alive && inAppBrowser(navigator.userAgent) === null) iosTimer = window.setTimeout(() => setMode('ios'), 4000);
      }).catch(() => { /* χωρίς δίκτυο: χωρίς μήνυμα */ });
    } else if (shouldAskNotify()) {
      // ΠΡΩΤΗ ΦΟΡΑ ΑΠΟ ΤΗΝ ΑΡΧΙΚΗ ΟΘΟΝΗ: το τελευταίο βήμα. Χωρίς αυτό ο χρήστης
      // έβαζε το εικονίδιο και οι ειδοποιήσεις έμεναν κλειστές, γιατί ο διακόπτης
      // ζούσε μόνο μέσα στις Ρυθμίσεις.
      iosTimer = window.setTimeout(() => setMode('notify'), 2500);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      // Η πρόσκληση κρατιέται ΠΑΝΤΑ ακόμη κι όταν το πλωτό μήνυμα δεν θα φανεί: το
      // κουμπί των Ρυθμίσεων την ανοίγει όποτε τη ζητήσει ο ίδιος ο χρήστης.
      holdPrompt(e as BeforeInstallPromptEvent);
      // ΚΑΜΙΑ απόφαση εδώ για τη διαδρομή: το event πυροδοτείται μία φορά ανά
      // έγγραφο, συνήθως όσο ο χρήστης είναι ακόμη στη landing. Αν κόβαμε εδώ,
      // το banner δεν θα εμφανιζόταν ΠΟΤΕ στη φυσιολογική ροή landing → login →
      // dashboard, που είναι client-side πλοήγηση μέσα στο ίδιο έγγραφο.
      if (eligible(MIN_VISITS)) setMode('prompt');
    };
    // Εγκαταστάθηκε (από εδώ ή από το μενού του περιηγητή): τίποτα να προτείνει.
    const onInstalled = () => { holdPrompt(null); markAdded(); setMode(null); };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      alive = false;
      window.clearTimeout(iosTimer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const remember = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
  };

  const install = async () => {
    if (mode === 'notify') {
      // Η άδεια ζητιέται ΜΕΣΑ στο πάτημα: το Safari αρνείται όποια ζήτηση δεν
      // ξεκινά από χειρονομία. Ο κώδικας φορτώνεται μόνο τώρα.
      setBusy(true); setNote('');
      const [{ enableDevicePush, ENABLE_REASONS }, { authClient }] = await Promise.all([
        import('@/lib/push/enable'), import('@/lib/supabase/lazy'),
      ]);
      const outcome = await enableDevicePush(await authClient());
      setBusy(false);
      if (outcome.ok) { setMode(null); return; }
      setNote(ENABLE_REASONS[outcome.reason]);
      return;
    }
    setMode(null);
    // Άκυρο στο native παράθυρο = «όχι». Χωρίς αυτό, το banner ξαναεμφανιζόταν
    // στην επόμενη φόρτωση — ακριβώς η επανάληψη που υποσχεθήκαμε να μην κάνουμε.
    if (await runPrompt() === 'dismissed') remember();
  };

  const dismiss = () => {
    if (mode === 'notify') {
      try { localStorage.setItem(NOTIFY_DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
      setMode(null); return;
    }
    setMode(null); remember();
  };

  // Το κομμάτι κατεβαίνει τη στιγμή που χρειάζεται, όχι πριν.
  useEffect(() => {
    if (!mode || !inApp || Banner) return;
    let alive = true;
    import('./InstallBanner').then(m => { if (alive) setBanner(() => m.default); }).catch(() => { /* χωρίς δίκτυο: χωρίς μήνυμα */ });
    return () => { alive = false; };
  }, [mode, inApp, Banner]);

  if (!mode || !inApp || !Banner) return null;
  return <Banner mode={mode} onInstall={install} onDismiss={dismiss} note={note} busy={busy} />;
}
