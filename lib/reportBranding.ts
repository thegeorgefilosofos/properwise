// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ πηγή αλήθειας για τη λευκή επωνυμία (white-label) των εκτυπώσιμων αναφορών.
// Δυνατότητα του πλάνου «Επαγγελματίας». Οι καθαρές συναρτήσεις (χωρίς DOM)
// χρησιμοποιούνται και από το statement.ts (που ΔΕΝ είναι 'use client'), γι' αυτό
// το μόνο React που εισάγεται εδώ είναι τα hooks, τα οποία καλούνται μόνο από
// client components. Ασφάλεια: το accent μπαίνει σε CSS και το logo σε src, οπότε
// καθαρίζονται αυστηρά κατά τη φόρτωση (sanitizeAccent/sanitizeLogo) — το escHtml
// από μόνο του ΔΕΝ αρκεί για αυτά τα δύο.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PAPER } from '@/lib/print/ink';
import { failed } from '@/lib/core/dbError';

export interface ReportBranding {
  enabled: boolean;
  companyName: string;
  logoUrl: string;
  accentColor: string;
  phone: string;
  email: string;
}

export const DEFAULT_ACCENT = '#1a73e8';

/** HTML-escape για ασφαλή παρεμβολή σε markup αναφορών. */
export function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Δέχεται μόνο έγκυρο 6ψήφιο hex (#rrggbb), αλλιώς επιστρέφει το προεπιλεγμένο. */
export function sanitizeAccent(c?: string | null): string {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : DEFAULT_ACCENT;
}

/** Δέχεται μόνο raster data-URL (png/jpg/webp/gif) έως ~700 KB· απορρίπτει SVG/εξωτερικά URL. */
export function sanitizeLogo(u?: string | null): string {
  if (!u) return '';
  if (u.length >= 700000) return '';
  return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(u) ? u : '';
}

/** Το χρώμα επωνυμίας (καθαρισμένο) ή το προεπιλεγμένο. */
export function reportAccent(b?: ReportBranding | null): string {
  return sanitizeAccent(b?.accentColor);
}

/** :root μεταβλητές που ορίζουν το --accent (αρκετές αναφορές το χρησιμοποιούν ήδη). */
export function brandRootVars(b?: ReportBranding | null): string {
  return `:root{--accent:${reportAccent(b)};--accent-text:${PAPER}}`;
}

/** <img> του λογοτύπου (αν υπάρχει έγκυρο), αλλιώς κενό string. */
export function brandLogoImg(b?: ReportBranding | null, px = 32): string {
  const logo = sanitizeLogo(b?.logoUrl);
  return logo ? `<img src="${logo}" alt="" style="height:${px}px;width:auto;max-width:${px * 5}px;object-fit:contain;display:block"/>` : '';
}

/** Επωνυμία (escaped) ή fallback (προεπιλογή «PROPERWISE»). */
export function brandName(b?: ReportBranding | null, fallback = 'PROPERWISE'): string {
  return escHtml(b?.companyName?.trim() || fallback);
}

/** Γραμμή επικοινωνίας «τηλέφωνο · email» (escaped), ή κενό. */
export function brandContactLine(b?: ReportBranding | null): string {
  return [b?.phone?.trim(), b?.email?.trim()].filter(Boolean).map(escHtml).join(' · ');
}

/** Το προφίλ ΚΑΙ η αιτία όταν δεν διαβάστηκε. */
export interface LoadedBranding {
  /** null όταν λείπει, όταν είναι enabled=false, ή όταν η ανάγνωση απέτυχε. */
  branding: ReportBranding | null;
  /** Κενό όταν όλα πήγαν καλά. Αλλιώς το «γιατί», έτοιμο για την οθόνη. */
  error: string;
}

/**
 * Φόρτωση προφίλ επωνυμίας ανά χρήστη.
 *
 * ═══ Η ΣΙΩΠΗ ΕΔΩ ΤΗ ΒΛΕΠΕΙ Ο ΠΕΛΑΤΗΣ ΤΟΥ ΣΥΝΔΡΟΜΗΤΗ ══════════════════════
 *
 * Η συνάρτηση γύριζε `null` και για τις ΤΡΕΙΣ περιπτώσεις: «δεν έχει ορίσει
 * επωνυμία», «την έχει σβηστή» και «δεν μπόρεσα να τη διαβάσω». Οι δύο πρώτες
 * είναι επιλογή του χρήστη· η τρίτη είναι βλάβη — και η μόνη με συνέπεια που
 * φεύγει από την εφαρμογή: η αναφορά εξάγεται ΧΩΡΙΣ το λογότυπο και τα
 * στοιχεία της επιχείρησης — και τη στέλνει ο συνδρομητής στον δικό του πελάτη.
 * Το λάθος δηλαδή δεν το βλέπει αυτός που μπορεί να το διορθώσει.
 *
 * Το `enabled === false` ΔΕΝ είναι σφάλμα: είναι «δεν τη θέλω». Μένει σιωπηλό.
 */
export async function loadReportBranding(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<LoadedBranding> {
  const { data, error } = await supabase
    .from('report_branding')
    .select('enabled, company_name, logo_url, accent_color, phone, email')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[loadReportBranding] η επωνυμία δεν διαβάστηκε:', error);
    return { branding: null, error: failed('Η επωνυμία των αναφορών δεν διαβάστηκε', error) };
  }
  if (!data || data.enabled === false) return { branding: null, error: '' };
  return {
    branding: {
      enabled: true,
      companyName: (data.company_name as string) || '',
      logoUrl: sanitizeLogo(data.logo_url as string),
      accentColor: sanitizeAccent(data.accent_color as string),
      phone: (data.phone as string) || '',
      email: (data.email as string) || '',
    },
    error: '',
  };
}

/**
 * ΜΙΑ ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΑΝΑ ΧΡΗΣΤΗ ΑΝΑ ΣΥΝΕΔΡΙΑ, ΟΧΙ ΜΙΑ ΑΝΑ ΟΘΟΝΗ. Το hook το
 * καλούν έντεκα καρτέλες· αν η βάση δεν απαντά, θα ειδοποιούσαν έντεκα φορές
 * για το ίδιο πράγμα. Η πρώτη λέει ό,τι υπάρχει να ειπωθεί.
 */
const brandingWarned = new Set<string>();

/**
 * Client hook: φορτώνει το προφίλ επωνυμίας εκ των προτέρων (για να είναι έτοιμο
 * πριν το window.open).
 *
 * Η ΥΠΟΓΡΑΦΗ ΤΟΥ ΔΕΝ ΑΛΛΑΞΕ ΚΑΙ ΕΙΝΑΙ ΣΚΟΠΙΜΟ. Οι έντεκα καρτέλες που το καλούν
 * περνούν το `branding` σε κοινό κατασκευαστή αναφοράς· καμία τους δεν έχει θέση
 * να δείξει σφάλμα φόρτωσης, ούτε πρέπει να αποκτήσει έντεκα φορές την ίδια. Η
 * αποτυχία λέγεται εκεί που ανήκει μια στιγμιαία βλάβη: στον κοινό δίαυλο του
 * toast, μία φορά.
 *
 * ΚΑΙ ΔΟΚΙΜΑΖΕΙ ΔΕΥΤΕΡΗ ΦΟΡΑ ΠΡΙΝ ΕΝΟΧΛΗΣΕΙ. Μια στιγμιαία διακοπή δικτύου δεν
 * αξίζει μήνυμα· μια επίμονη αξίζει. Η δεύτερη προσπάθεια ξεχωρίζει τις δύο.
 */
export function useReportBranding(userId?: string): ReportBranding | null {
  const [branding, setBranding] = useState<ReportBranding | null>(null);
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let alive = true;
    (async () => {
      let r = await loadReportBranding(supabase, userId);
      if (r.error) {
        await new Promise(res => setTimeout(res, 800));
        if (!alive) return;
        r = await loadReportBranding(supabase, userId);
      }
      if (!alive) return;
      setBranding(r.branding);
      if (r.error && !brandingWarned.has(userId)) {
        brandingWarned.add(userId);
        // Δυναμική εισαγωγή: ο δίαυλος του toast είναι client module ΚΑΙ αυτό το
        // αρχείο το εισάγει το statement.ts, που ΔΕΝ είναι 'use client'. Μέσα στο
        // effect τρέχει μόνο στον περιηγητή, οπότε η διαδρομή του διακομιστή μένει καθαρή.
        const { notifyError } = await import('@/components/toastBus');
        notifyError(`${r.error} Οι αναφορές θα βγουν χωρίς την επωνυμία σου.`);
      }
    })();
    return () => { alive = false; };
  }, [userId]);
  return branding;
}
