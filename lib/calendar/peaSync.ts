// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΥΠΕΝΘΥΜΙΣΕΙΣ ΛΗΞΗΣ ΠΕΑ ΕΧΟΥΝ ΕΝΑΝ ΓΡΑΦΕΑ
// ─────────────────────────────────────────────────────────────────────────
// Δύο αφορμές γράφουν τις ίδιες υπενθυμίσεις: η σάρωση του πιστοποιητικού και
// η αποθήκευση του ακινήτου με νέα λήξη. Και οι δύο περνούν από εδώ, ώστε η
// νεότερη λήξη να αντικαθιστά την παλιά αντί να μπαίνει δίπλα της.
//
// Η ΠΗΓΗ ΕΙΝΑΙ `pea:expiry:<ημέρες πριν>` (lib/property/peaExpiry.ts). Το
// `replaceSource` γράφει πρώτα τα νέα και μετά σβήνει τα παλιά: σε αποτυχία ο
// χρήστης βλέπει διπλό, ποτέ κενό.
//
// ΚΑΙ ΤΟ ΠΑΛΙΟ ΓΕΓΟΝΟΣ ΤΗΣ ΣΑΡΩΣΗΣ. Πριν από τις στήλες του ΠΕΑ η σάρωση έγραφε
// μία «Λήξη ΠΕΑ» με πηγή `scan`. Η λήξη ζει πια στο ακίνητο και οι υπενθυμίσεις
// της έχουν δική τους πηγή, οπότε εκείνο το γεγονός θα ήταν δεύτερη «Λήξη ΠΕΑ»
// δίπλα στη νέα. Σβήνεται ΜΕΤΑ την εγγραφή των νέων.
// ═══════════════════════════════════════════════════════════════════════════
import * as calendar from '@/lib/data/calendar';
import { PEA_EXPIRY_TITLE, PEA_SOURCE_PREFIX } from '@/lib/property/peaExpiry';

export async function syncPeaReminders(
  db: calendar.Db, scope: calendar.Scope, drafts: calendar.EventDraft[],
): Promise<calendar.Outcome> {
  const done = await calendar.replaceSource(db, scope, { prefix: PEA_SOURCE_PREFIX }, drafts);
  if (done.error) return done;
  return calendar.clearSource(db, scope, { source: 'scan', title: PEA_EXPIRY_TITLE });
}
