// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΕΓΓΡΑΦΗ ΜΕ ΕΝΑ ΠΑΤΗΜΑ, ΑΠΟ ΤΟ ΠΡΟΓΡΑΜΜΑ ΑΛΛΗΛΟΓΡΑΦΙΑΣ (RFC 8058)
// ─────────────────────────────────────────────────────────────────────────
// Τα εμπορικά email στέλνουν πλέον τις κεφαλίδες `List-Unsubscribe` και
// `List-Unsubscribe-Post`. Το Gmail και το Yahoo τις ζητούν από μαζικούς
// αποστολείς και δείχνουν δικό τους κουμπί «Απεγγραφή» δίπλα στον αποστολέα.
// Το πάτημα εκεί ΔΕΝ ανοίγει σελίδα: ο πάροχος στέλνει ένα POST σε αυτή τη
// διεύθυνση με σώμα `List-Unsubscribe=One-Click` και περιμένει 2xx.
//
// ΓΙΑΤΙ ΑΠΕΓΓΡΑΦΗ ΑΠΟ ΟΛΑ. Το πρότυπο δεν έχει τρόπο να ρωτήσει «από τι»· ο
// παραλήπτης πάτησε «σταμάτα να μου στέλνεις». Τα λειτουργικά email
// (υπενθυμίσεις, αποδείξεις) δεν επηρεάζονται, όπως και στη σελίδα.
//
// Η ΔΙΑΔΡΟΜΗ ΕΙΝΑΙ ΔΗΜΟΣΙΑ ΑΠΟ ΤΟ proxy.ts (/unsubscribe/…): η πρόσβαση
// ελέγχεται από το κουπόνι, όπως στη σελίδα της απεγγραφής.
// ═══════════════════════════════════════════════════════════════════════════
import { createServiceClient, serviceClientError, SERVICE_CLIENT_LOG } from '@/lib/supabase/service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (!UUID.test(token)) return text('Άκυρος σύνδεσμος απεγγραφής.', 404);

  const missing = serviceClientError(process.env);
  if (missing) {
    console.info('[unsubscribe]', SERVICE_CLIENT_LOG, missing);
    return text('Η απεγγραφή δεν είναι διαθέσιμη αυτή τη στιγμή.', 503);
  }
  const { data, error } = await createServiceClient().rpc('unsubscribe_email', { p_token: token, p_kind: 'all' });
  if (error) {
    console.info('[unsubscribe] η απεγγραφή απέτυχε:', error.message);
    return text('Η απεγγραφή δεν ολοκληρώθηκε.', 503);
  }
  return data ? text('Απεγγράφηκες από τα ενημερωτικά email.', 200) : text('Άκυρος σύνδεσμος απεγγραφής.', 404);
}

/**
 * Πρόγραμμα αλληλογραφίας χωρίς RFC 8058 ανοίγει την ίδια διεύθυνση στον
 * περιηγητή. Εκεί ο άνθρωπος βλέπει τη σελίδα των προτιμήσεων, όχι σφάλμα.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  return Response.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url), 303);
}
