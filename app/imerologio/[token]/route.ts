// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΙΕΥΘΥΝΣΗ ΠΟΥ ΔΙΑΒΑΖΕΙ ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΤΟΥ ΤΗΛΕΦΩΝΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Καμία συνεδρία δεν φτάνει εδώ και δεν πρέπει: ο πελάτης είναι το Google
// Calendar ή το Ημερολόγιο του iPhone, που ζητά τη διεύθυνση κάθε λίγες ώρες
// χωρίς άνθρωπο μπροστά. Η ταυτότητα είναι το κουπόνι της διαδρομής — το ίδιο
// μοντέλο με την πύλη του μισθωτή και με τον σύνδεσμο του λογιστή.
//
// ── ΤΕΣΣΕΡΙΣ ΑΠΟΦΑΣΕΙΣ ───────────────────────────────────────────────────
//
// ΜΟΝΟ ΑΝΑΓΝΩΣΗ, ΠΟΤΕ ΓΡΑΦΗ. Οτι κι αν σταλεί σε αυτή τη διεύθυνση, τίποτα
// δεν αλλάζει στη βάση. Ενα κουπόνι που διέρρευσε κοστίζει ΑΝΑΓΝΩΣΗ των
// προθεσμιών — και ο ιδιοκτήτης το ακυρώνει μόνος του από τις Ρυθμίσεις.
//
// ΤΟ ΚΟΥΠΟΝΙ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ ΠΑΙΡΝΕΙ 404, ΧΩΡΙΣ ΕΞΗΓΗΣΗ. Μια απάντηση που
// ξεχωρίζει το «λάθος μορφή» από το «δεν βρέθηκε» λέει σε άγνωστο πόσο κοντά
// είναι.
//
// Η ΑΠΑΝΤΗΣΗ ΕΙΝΑΙ ΕΓΚΥΡΟ ΗΜΕΡΟΛΟΓΙΟ, ΑΚΟΜΗ ΚΑΙ ΑΔΕΙΟ, ΟΤΑΝ ΕΙΝΑΙ ΟΝΤΩΣ ΑΔΕΙΟ.
// Ενα άδειο ημερολόγιο από ΒΛΑΒΗ της βάσης είναι χειρότερο από σφάλμα: το
// Google και η Apple θεωρούν τη ροή αυθεντική και σβήνουν κάθε προθεσμία, για
// μία ώρα αποθήκευσης. Αν αποτύχει οποιαδήποτε ανάγνωση, απαντά 503 χωρίς
// αποθήκευση και ο πελάτης κρατά το προηγούμενο αντίγραφο.
//
// ΤΟ ΠΑΡΑΘΥΡΟ ΕΙΝΑΙ ΕΝΑΣ ΜΗΝΑΣ ΠΙΣΩ ΚΑΙ ΕΝΑΣ ΧΡΟΝΟΣ ΜΠΡΟΣΤΑ. Ο ένας μήνας
// πίσω κρατά ό,τι μόλις έληξε και δεν πληρώθηκε· πιο παλιά είναι ιστορία και
// η ιστορία δεν ανήκει σε ημερολόγιο υπενθυμίσεων.
// ═══════════════════════════════════════════════════════════════════════════

import { createServiceClient, serviceClientError, SERVICE_CLIENT_LOG } from '@/lib/supabase/service';
import * as feedStore from '@/lib/data/calendarFeed';
import * as properties from '@/lib/data/properties';
import * as calendar from '@/lib/data/calendar';
import * as checklist from '@/lib/data/checklist';
import * as bills from '@/lib/data/bills';
import * as rent from '@/lib/data/rent';
import { deadlineItems, type DeadlineProperty, type DeadlineEvent, type DeadlineTask, type DeadlineBill, type DeadlineRent } from '@/lib/calendar/deadlines';
import { buildCalendarFeed } from '@/lib/calendar/feed';
import { athensDatePlus } from '@/lib/core/time';
import { siteUrl } from '@/lib/core/site';

/** Πόσο πίσω και πόσο μπροστά κοιτά η συνδρομή. */
const DAYS_BACK = 30;
const DAYS_AHEAD = 365;

/** Το όνομα που θα δει ο χρήστης στη λίστα των ημερολογίων του. */
const CALENDAR_NAME = 'PROPERWISE · Προθεσμίες';

const log = (...parts: unknown[]) => console.info('[imerologio]', ...parts);

const notFound = () => new Response('Δεν βρέθηκε ημερολόγιο σε αυτή τη διεύθυνση.', {
  status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
});

const unavailable = () => new Response('Το ημερολόγιο δεν είναι διαθέσιμο.', {
  status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
});

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  // Η διεύθυνση τελειώνει σε `.ics` ώστε οι πελάτες ημερολογίου να την
  // αναγνωρίζουν ως αρχείο. Το κουπόνι είναι ό,τι μένει.
  const raw = (await params).token.replace(/\.ics$/i, '').toLowerCase();
  // ΔΥΟ ΜΗΚΗ, ΜΙΑ ΜΟΡΦΗ. Τα κουπόνια του πίνακα είναι 64 δεκαεξαδικά ψηφία (δύο
  // uuid); ο έλεγχος δέχεται και μικρότερα ώστε να μη σπάσει αν αλλάξει η
  // προεπιλογή, αλλά ΤΙΠΟΤΑ που δεν είναι δεκαεξαδικό δεν φτάνει στη βάση.
  if (!/^[0-9a-f]{16,64}$/.test(raw)) return notFound();

  const missing = serviceClientError(process.env);
  if (missing) {
    log(SERVICE_CLIENT_LOG, missing);
    return unavailable();
  }
  const db = createServiceClient();

  const { row: owner, error } = await feedStore.ownerOfToken(db, raw);
  if (error) {
    log('η αναζήτηση της συνδρομής απέτυχε:', error.message);
    return unavailable();
  }
  // ΤΟ ΛΗΓΜΕΝΟ ΚΟΥΠΟΝΙ ΕΙΝΑΙ ΑΓΝΩΣΤΟ ΚΟΥΠΟΝΙ, ΚΑΙ ΑΠΑΝΤΑ ΤΟ ΙΔΙΟ. Μια
  // ξεχωριστή απάντηση «έληξε» θα έλεγε σε όποιον το βρήκε ότι κάποτε ίσχυε.
  if (!owner || feedStore.feedExpired(owner)) return notFound();

  const from = athensDatePlus(-DAYS_BACK);
  const to = athensDatePlus(DAYS_AHEAD);
  const userId = owner.user_id;

  const [props, events, tasks, unpaidBills, dues] = await Promise.all([
    properties.listWithError<DeadlineProperty>(db, userId, { columns: 'id,name' }),
    calendar.ofUserInRangeWithError<DeadlineEvent>(db, userId, from, to, 'id,property_id,title,event_date,amount,notes,status'),
    checklist.openOfUserWithError<DeadlineTask>(db, userId, 'id,property_id,description,due_date,note'),
    // ΤΟ ΑΠΛΗΡΩΤΟ ΚΑΙ ΜΕΣΑ ΣΤΟ ΠΑΡΑΘΥΡΟ ΤΟ ΚΡΙΝΕΙ Η ΒΑΣΗ. Ο χάρτης παρακάτω
    // ξαναελέγχει τα ίδια — και σωστά, γιατί είναι καθαρή συνάρτηση και δεν
    // ξέρει ποιος τη φώναξε — αλλά το ταξίδι των γραμμών γίνεται μία φορά.
    bills.ofUserWithError<DeadlineBill>(db, userId, 'id,property_id,name,type,amount,due_date,paid',
      { unpaid: true, dueFrom: from, dueTo: to }),
    rent.ofUserWithError<DeadlineRent>(db, userId, 'id,property_id,amount,due_date,paid,period_year,period_month',
      { unpaid: true, dueFrom: from, dueTo: to }),
  ]);
  const failedRead = [props, events, tasks, unpaidBills, dues].find(r => r.error)?.error;
  if (failedRead) {
    log('η ανάγνωση των προθεσμιών απέτυχε:', failedRead.message);
    return unavailable();
  }

  const items = deadlineItems({
    properties: props.rows, events: events.rows, tasks: tasks.rows,
    bills: unpaidBills.rows, rent: dues.rows, from, to,
  });

  const ics = buildCalendarFeed(items, { name: CALENDAR_NAME, now: new Date(), link: siteUrl('/dashboard?tab=calendar') });
  log(`${items.length} προθεσμίες, ${from} ώς ${to}`);

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="properwise.ics"',
      // Μία ώρα: αρκετά ώστε να μη ρωτούν συνέχεια, αρκετά λίγο ώστε μια
      // προθεσμία που μόλις μπήκε να φανεί την ίδια μέρα.
      'Cache-Control': 'private, max-age=3600',
      // Το robots.txt κρατά έξω τις μηχανές που το τιμούν· η κεφαλίδα λέει και
      // σε όποια βρει τη διεύθυνση αλλού ότι οι προθεσμίες δεν ευρετηριάζονται.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
