// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΛΟΓΙΑ ΤΗΣ ΧΡΕΩΣΗΣ, ΓΙΑ ΤΙΣ ΟΘΟΝΕΣ ΠΟΥ ΖΟΥΝ ΣΤΟΝ ΠΕΡΙΗΓΗΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ `billingWords()` ΔΙΑΒΑΖΕΙ ΜΕΤΑΒΛΗΤΕΣ ΠΕΡΙΒΑΛΛΟΝΤΟΣ, ΟΠΟΤΕ ΤΡΕΧΕΙ ΜΟΝΟ ΕΔΩ.
// Ο πίνακας ελέγχου αποδίδεται ολόκληρος στον περιηγητή και δύο οθόνες του
// έγραφαν την κατάσταση της χρέωσης με το χέρι: το μπάνερ της δοκιμής («τα
// δεδομένα σου ανέπαφα», ενώ με ενεργή χρέωση οι Οροι λένε διαγραφή μετά την
// περίοδο χάριτος) και οι στόχοι των συνεργατών, που μετρούν συνδρομητές όσο
// κανείς δεν μπορεί να γίνει συνδρομητής.
//
// Η διαδρομή δίνει ΜΟΝΟ τα πεδία που χρειάζονται αυτές οι οθόνες, στις ίδιες
// ακριβώς λέξεις με τους Ορους. Καμία άλλη πηγή, καμία απόκλιση.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { billingWords } from '@/lib/legal/billingWords';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Απαιτείται σύνδεση.' }, { status: 401 });

  const w = billingWords();
  return NextResponse.json(
    { live: w.live, afterTrialShort: w.afterTrialShort, partnerTarget: w.partnerTarget },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
}
