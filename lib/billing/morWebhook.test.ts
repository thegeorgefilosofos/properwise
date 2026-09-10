// npx tsx lib/billing/morWebhook.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΑΠΟΦΑΣΕΙΣ ΤΟΥ WEBHOOK ΤΟΥ ΕΜΠΟΡΟΥ
//
// Εδώ κρίνεται αν ένας πληρωμένος λογαριασμός θα έχει το πακέτο του. Το αρχείο
// δεν είχε κανέναν έλεγχο· οι τρεις κρίσεις που ελέγχονται παρακάτω είναι
// ακριβώς εκείνες όπου ένα λάθος ΔΕΝ φαίνεται πουθενά: δεν σκάει τίποτα, απλώς
// ο πελάτης χάνει ό,τι αγόρασε — ή κρατά ό,τι ακύρωσε.
//
// ΤΑ WEBHOOK ΔΕΝ ΦΤΑΝΟΥΝ ΜΕ ΣΕΙΡΑ. Είναι η μόνη υπόθεση που πρέπει να κρατά
// κανείς σταθερά στο μυαλό του διαβάζοντας αυτό το αρχείο.
// ═══════════════════════════════════════════════════════════════════════════
import { isStaleEvent, trialStamp, profileTypeToWrite } from './morWebhook';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) { pass++ } else { fail++; console.error('✗ ' + name) } };
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++ } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
};

// ── ΣΕΙΡΑ ΓΕΓΟΝΟΤΩΝ ───────────────────────────────────────────────────────
const T1 = '2026-09-01T10:00:00.000Z';
const T2 = '2026-09-01T11:00:00.000Z';

ok('παλαιότερο από το καταγεγραμμένο → παλιό', isStaleEvent(T1, T2));
ok('νεότερο → εφαρμόζεται', !isStaleEvent(T2, T1));
ok('ίδια ώρα → εφαρμόζεται', !isStaleEvent(T1, T1));

// ΧΩΡΙΣ ΩΡΑ, ΕΦΑΡΜΟΖΕΤΑΙ. Δεν εφευρίσκουμε ώρα για να δικαιολογήσουμε
// απόρριψη: ένας έμπορος που δεν στέλνει χρονοσφραγίδα δεν πρέπει να χάνει
// γεγονότα.
ok('γεγονός χωρίς ώρα → εφαρμόζεται', !isStaleEvent(null, T2));
ok('καμία προηγούμενη ώρα → εφαρμόζεται', !isStaleEvent(T1, null));
ok('κανένα από τα δύο → εφαρμόζεται', !isStaleEvent(undefined, undefined));
ok('κενή συμβολοσειρά → εφαρμόζεται', !isStaleEvent('', T2));

// ΩΡΑ ΠΟΥ ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ ΔΕΝ ΚΡΙΝΕΙ. Ενα `new Date('τζίβα') < new Date(x)`
// είναι `false` κατά τύχη, όχι κατά σχέδιο — και η τύχη αλλάζει.
ok('ώρα που δεν διαβάζεται → εφαρμόζεται', !isStaleEvent('τζίβα', T2));
ok('καταγεγραμμένη ώρα που δεν διαβάζεται → εφαρμόζεται', !isStaleEvent(T1, 'τζίβα'));

// Το σενάριο που κοστίζει: καθυστερημένη ακύρωση πάνω από νεότερη ανανέωση.
ok('καθυστερημένη ακύρωση δεν πατά νεότερη ανανέωση', isStaleEvent('2026-09-01T09:59:00.000Z', T2));

// ── Η ΣΦΡΑΓΙΔΑ ΤΗΣ ΔΟΚΙΜΗΣ ───────────────────────────────────────────────
eq('πρώτη δοκιμή: σφραγίζεται με την ώρα του γεγονότος', trialStamp(null, 'on_trial', T1), T1);
eq('υπάρχουσα σφραγίδα ΔΕΝ μετακινείται', trialStamp(T1, 'on_trial', T2), T1);
eq('υπάρχουσα σφραγίδα μένει και σε ανανέωση', trialStamp(T1, 'active', T2), T1);
eq('ενεργή συνδρομή χωρίς προηγούμενη δοκιμή: τίποτα', trialStamp(null, 'active', T1), null);
eq('ακυρωμένη χωρίς δοκιμή: τίποτα', trialStamp(undefined, 'cancelled', T1), null);
eq('δοκιμή χωρίς ώρα γεγονότος: τίποτα να γραφτεί', trialStamp(null, 'on_trial', null), null);

// ΤΟ ΣΕΝΑΡΙΟ ΠΟΥ ΓΕΝΝΗΣΕ ΤΟ `??`: τρία γεγονότα στη σειρά. Χωρίς αυτό, η
// σφραγίδα θα κυλούσε ώς το τελευταίο και η δοκιμή θα φαινόταν «φρέσκια».
{
  let stamp: string | null = null;
  for (const [status, at] of [['on_trial', T1], ['active', T2], ['active', '2026-10-01T00:00:00.000Z']] as const) {
    stamp = trialStamp(stamp, status, at);
  }
  eq('μετά από τρία γεγονότα, η σφραγίδα είναι η ΠΡΩΤΗ', stamp, T1);
}

// ── Ο ΤΥΠΟΣ ΠΡΟΦΙΛ ────────────────────────────────────────────────────────
// Η δήλωση του χρήστη δεν ξαναγράφεται από webhook· όταν λείπει, τη
// συμπληρώνει αυτό που ΑΓΟΡΑΣΕ.
eq('δηλωμένος τύπος δεν αγγίζεται', profileTypeToWrite('individual', 'agency'), null);
eq('ούτε ο επαγγελματίας', profileTypeToWrite('professional', 'solo'), null);
ok('τύπος που λείπει συμπληρώνεται', profileTypeToWrite(null, 'agency') !== null);
ok('κενή συμβολοσειρά μετράει ως «λείπει»', profileTypeToWrite('', 'agency') !== null);
ok('μόνο κενά μετράει ως «λείπει»', profileTypeToWrite('   ', 'agency') !== null);

// ΚΑΙ ΤΟ ΠΑΚΕΤΟ ΚΡΙΝΕΙ ΤΟΝ ΤΥΠΟ. Οποιος πλήρωσε «Γραφείο» δεν πρέπει να βρει
// κλειδωμένες τις καρτέλες που μόλις αγόρασε.
eq('«agency» → επαγγελματίας', profileTypeToWrite(null, 'agency'), 'professional');
eq('«office» → επαγγελματίας', profileTypeToWrite(null, 'office'), 'professional');
eq('«owner» → ιδιώτης', profileTypeToWrite(null, 'owner'), 'individual');
eq('«solo» → ιδιώτης', profileTypeToWrite(null, 'solo'), 'individual');

console.log(fail === 0 ? `✓ morWebhook: ${pass} έλεγχοι πέρασαν` : `✗ morWebhook: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
