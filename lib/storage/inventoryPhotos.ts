// ═══════════════════════════════════════════════════════════════════════════
// ΦΩΤΟΓΡΑΦΙΕΣ ΑΠΟΓΡΑΦΗΣ ΚΑΙ ΠΑΡΑΔΟΣΗΣ: ΙΔΙΩΤΙΚΟ BUCKET, ΥΠΟΓΕΓΡΑΜΜΕΝΗ ΠΡΟΒΟΛΗ
// ─────────────────────────────────────────────────────────────────────────
// Το «inventory-photos» ήταν δημόσιο και στη βάση γραφόταν το μόνιμο δημόσιο
// URL. Οποιος έπαιρνε ένα τέτοιο URL, π.χ. από ένα προωθημένο πρωτόκολλο
// παράδοσης, έβλεπε για πάντα το εσωτερικό του σπιτιού: δεν έληγε και δεν
// ανακαλούνταν (έλεγχος ασφάλειας 10/11/2026). Από το migration
// 20261110140000 το bucket είναι ιδιωτικό.
//
// Αποθηκεύεται πλέον η ΔΙΑΔΡΟΜΗ «<uid όποιου ανεβάζει>/<ακίνητο>/…». Το
// ακίνητο στη διαδρομή κρίνει ποιος βλέπει (private.inventory_photo_visible):
// ο ιδιοκτήτης και τα μέλη του οργανισμού του που βλέπουν αυτό το ακίνητο.
// Η προβολή ζητά προσωρινό σύνδεσμο με μία κλήση δικτύου για όλες τις
// φωτογραφίες της οθόνης, όπως το lib/maintenance/photos.ts. Τον ανανεώνει
// πριν λήξει. Η εκτύπωση και η έκθεση ασφαλιστή υπογράφουν ξανά τη στιγμή που
// ανοίγουν (openReportAsync), ώστε να μη βγουν ποτέ με σπασμένες εικόνες.
//
// Παλιά εγγραφή με ολόκληρο δημόσιο URL αυτού του bucket μετατρέπεται σε
// διαδρομή και υπογράφεται κι αυτή. Στις 10/11/2026 το bucket είχε 0 αρχεία
// και καμία γραμμή δεν είχε φωτογραφία, όμως η ανοχή κοστίζει μία γραμμή.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { failed } from '@/lib/core/dbError';

export const INVENTORY_PHOTOS_BUCKET = 'inventory-photos';

/** Μία ώρα ζωή για κάθε σύνδεσμο. */
const SIGN_SECONDS = 3600;

/** Ανανέωση στα 50 λεπτά: δέκα λεπτά πριν λήξει ο σύνδεσμος που δείχνει η οθόνη. */
const REFRESH_MS = 50 * 60 * 1000;

/** Η διαδρομή μέσα στο bucket, από διαδρομή ή από παλιό δημόσιο URL του. */
export function inventoryPhotoPath(stored: string): string {
  const marker = `/${INVENTORY_PHOTOS_BUCKET}/`;
  const i = stored.indexOf(marker);
  return i >= 0 ? stored.slice(i + marker.length).split('?')[0] : stored;
}

/** Διεύθυνση άλλης πηγής (όχι αυτού του bucket): προβάλλεται όπως είναι. */
function isForeignUrl(stored: string): boolean {
  return /^(https?:|data:|blob:)/.test(stored) && !stored.includes(`/${INVENTORY_PHOTOS_BUCKET}/`);
}

export interface SignedInventoryPhotos {
  /** Αποθηκευμένη τιμή προς σύνδεσμο προβολής. */
  urls: Record<string, string>;
  /** Κενό όταν όλα πήγαν καλά· αλλιώς το «γιατί», έτοιμο για την οθόνη. */
  error: string;
}

/** Υπογράφει όλες τις φωτογραφίες με μία κλήση. Κενό αντικείμενο όταν δεν υπάρχει καμία. */
export async function signInventoryPhotos(supabase: SupabaseClient, stored: readonly string[]): Promise<SignedInventoryPhotos> {
  const urls: Record<string, string> = {};
  const toSign: string[] = [];
  for (const s of new Set(stored.filter(Boolean))) {
    if (isForeignUrl(s)) urls[s] = s; else toSign.push(s);
  }
  if (toSign.length === 0) return { urls, error: '' };
  const { data, error } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET)
    .createSignedUrls(toSign.map(inventoryPhotoPath), SIGN_SECONDS);
  if (error || !data) {
    console.error('[signInventoryPhotos] οι φωτογραφίες δεν υπογράφηκαν:', error);
    return { urls, error: failed('Οι φωτογραφίες δεν φορτώθηκαν', error) };
  }
  data.forEach((d, i) => { if (d.signedUrl) urls[toSign[i]] = d.signedUrl; });
  return { urls, error: '' };
}

/**
 * Οι σύνδεσμοι προβολής για ό,τι δείχνει η οθόνη. Ξαναζητά υπογραφή όταν
 * αλλάξει το σύνολο των φωτογραφιών και κάθε REFRESH_MS όσο η οθόνη μένει
 * ανοιχτή, ώστε μια καρτέλα ανοιχτή για ώρες να μη δείχνει σπασμένες εικόνες.
 */
export function useInventoryPhotoUrls(supabase: SupabaseClient, stored: readonly string[]): SignedInventoryPhotos {
  const key = useMemo(() => [...new Set(stored.filter(Boolean))].sort().join('\n'), [stored]);
  const [state, setState] = useState<SignedInventoryPhotos & { key: string }>({ urls: {}, error: '', key: '' });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const sign = () => { signInventoryPhotos(supabase, key.split('\n')).then(r => { if (alive) setState({ ...r, key }); }); };
    sign();
    const timer = setInterval(sign, REFRESH_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [supabase, key]);
  return key ? state : { urls: {}, error: '' };
}
