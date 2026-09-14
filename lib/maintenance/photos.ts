// ═══════════════════════════════════════════════════════════════════════════
// ΦΩΤΟΓΡΑΦΙΕΣ ΑΙΤΗΜΑΤΩΝ ΒΛΑΒΗΣ: ΜΙΑ ΥΠΟΓΡΑΦΗ, ΔΥΟ ΟΘΟΝΕΣ.
//
// Το bucket «maintenance-photos» είναι ιδιωτικό, οπότε στο
// maintenance_requests.photos αποθηκεύεται ΔΙΑΔΡΟΜΗ, όχι διεύθυνση. Το
// PortalShare την περνούσε ωμή σε <img src>: ο περιηγητής τη διάβαζε ως
// σχετικό URL πάνω στο /dashboard, ζητούσε /<token>/<αρχείο>, έπαιρνε 404 και
// ο ιδιοκτήτης έβλεπε δύο τετράγωνα 44 επί 44 με το εικονίδιο σπασμένης
// εικόνας σε κάθε αίτημα που είχε φωτογραφίες.
//
// Η υπογραφή υπήρχε ήδη και δούλευε, αλλά ζούσε κλειδωμένη μέσα στο
// MaintenanceView του TabTenantCare. Μετακόμισε εδώ αυτούσια, με το ίδιο
// bucket, την ίδια διάρκεια και την ίδια μεταχείριση των παλιών εγγραφών,
// ώστε οι δύο οθόνες που δείχνουν τα ΙΔΙΑ αιτήματα να μη μπορούν να
// αποκλίνουν.
// ═══════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js';
import { failed } from '@/lib/core/dbError';

/** Το ιδιωτικό bucket όπου ανεβάζει η πύλη τις φωτογραφίες του ενοικιαστή. */
const BUCKET = 'maintenance-photos';

/** 7 ημέρες, όσο και πριν: αρκετό ώστε να ζήσει ένας σύνδεσμος προς συνεργείο. */
const SIGN_SECONDS = 604800;

/** Ο,τι χρειάζεται η υπογραφή: ταυτότητα αιτήματος και αποθηκευμένες διαδρομές. */
export interface PhotoRequest { id: string; photos?: string[] | null }

// Από παλιές εγγραφές μπορεί να έχει μείνει ολόκληρο public URL. Κρατάμε ό,τι
// ακολουθεί το «/maintenance-photos/» ώστε να υπογράφεται κι εκείνο σωστά.
function maintPhotoPath(stored: string): string {
  const marker = `/${BUCKET}/`;
  const i = stored.indexOf(marker);
  return i >= 0 ? stored.slice(i + marker.length) : stored;
}

/**
 * Κλειδί για τις εξαρτήσεις του effect. Αλλάζει μόνο όταν αλλάξει αίτημα ή
 * φωτογραφία: κάθε φόρτωση φτιάχνει νέο πίνακα, οπότε ο πίνακας ως εξάρτηση
 * θα ξαναζητούσε υπογραφή σε κάθε απόδοση.
 */
export function photosKey(list: PhotoRequest[]): string {
  return list.map(r => `${r.id}:${(r.photos || []).join(',')}`).join('|');
}

/** Ο χάρτης των υπογραφών ΚΑΙ η αιτία όταν δεν βγήκαν. */
export interface SignedPhotos {
  /** id αιτήματος προς λίστα προσωρινών URL. Κενό όταν δεν υπάρχει φωτογραφία. */
  map: Record<string, string[]>;
  /** Κενό όταν όλα πήγαν καλά. Αλλιώς το «γιατί», έτοιμο για την οθόνη. */
  error: string;
}

/**
 * Προσωρινά URL ανά αίτημα (id προς λίστα). Μία κλήση δικτύου για όλες τις
 * φωτογραφίες όλων των αιτημάτων, κενό αντικείμενο όταν δεν υπάρχει καμία.
 * Η ανάγνωση περνά από την πολιτική owns_portal_token του storage.objects,
 * που ο ιδιοκτήτης την περνά ήδη στην ίδια συνεδρία.
 *
 * ═══ «ΚΑΜΙΑ ΦΩΤΟΓΡΑΦΙΑ» ΚΑΙ «ΔΕΝ ΜΠΟΡΩ ΝΑ ΤΙΣ ΔΕΙΞΩ» ══════════════════════
 *
 * Η συνάρτηση γύριζε ΜΟΝΟ τον χάρτη και το `if (!data) return {}` έκρυβε την
 * αποτυχία μέσα στο ίδιο κενό αντικείμενο που σημαίνει «δεν ανέβασε κανείς
 * φωτογραφία». Ο ιδιοκτήτης άνοιγε μια βλάβη που ΕΙΧΕ φωτογραφίες και έβλεπε
 * κάρτα χωρίς καμία — δηλαδή έκρινε αίτημα επισκευής με λιγότερα στοιχεία απ'
 * όσα του είχε στείλει ο ενοικιαστής, χωρίς να το ξέρει.
 *
 * Οι φωτογραφίες μιας βλάβης ΕΙΝΑΙ η βλάβη: πάνω τους αποφασίζεται αν θα πάει
 * τεχνίτης. Η σιωπή εδώ δεν είναι ατέλεια εμφάνισης· είναι έλλειψη στοιχείων
 * σε απόφαση που κοστίζει.
 */
export async function signMaintenancePhotos(
  supabase: SupabaseClient,
  list: PhotoRequest[],
): Promise<SignedPhotos> {
  const items: { id: string; path: string }[] = [];
  for (const r of list) {
    if (!Array.isArray(r.photos)) continue;
    for (const ph of r.photos) { if (ph) items.push({ id: r.id, path: maintPhotoPath(ph) }); }
  }
  if (items.length === 0) return { map: {}, error: '' };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(items.map(i => i.path), SIGN_SECONDS);
  if (error || !data) {
    console.error('[signMaintenancePhotos] οι φωτογραφίες δεν υπογράφηκαν:', error);
    return { map: {}, error: failed('Οι φωτογραφίες των βλαβών δεν φορτώθηκαν', error) };
  }
  const map: Record<string, string[]> = {};
  data.forEach((d, i) => { if (d.signedUrl) (map[items[i].id] ||= []).push(d.signedUrl); });
  return { map, error: '' };
}
