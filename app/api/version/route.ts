// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΙΑ ΕΚΔΟΣΗ ΤΡΕΧΕΙ ΤΩΡΑ Ο ΔΙΑΚΟΜΙΣΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Η εφαρμογή της αρχικής οθόνης μένει ανοιχτή στη μνήμη του τηλεφώνου για
// μέρες. Ό,τι κι αν ανεβάσουμε, εκείνη τρέχει τον κώδικα που φόρτωσε την
// τελευταία φορά που ξεκίνησε από την αρχή. Εδώ ρωτά «έχει αλλάξει κάτι;»
// (δες app/dashboard/components/UpdateWatcher.tsx).
//
// Το αναγνωριστικό είναι το ίδιο `NEXT_PUBLIC_BUILD_SHA` που γράφεται και στον
// κώδικα του περιηγητή κατά το build: αν τα δύο διαφέρουν, ο περιηγητής τρέχει
// παλιό build. Δεν είναι μυστικό· το δείχνει ήδη η οθόνη σφάλματος.
//
// ΖΗΤΑ ΣΥΝΕΔΡΙΑ ΟΠΩΣ ΚΑΘΕ ΔΙΑΔΡΟΜΗ (guard-api-auth). Τη ρωτά μόνο ο πίνακας
// ελέγχου, όπου ο χρήστης είναι συνδεδεμένος· χωρίς συνεδρία η απάντηση είναι
// 401 και ο ελεγκτής απλώς ξαναρωτά αργότερα.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Απαιτείται σύνδεση.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
