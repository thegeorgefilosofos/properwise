// ═══════════════════════════════════════════════════════════════════════════
// ΠΕΑ: ΠΟΤΕ ΛΗΓΕΙ, ΠΟΤΕ ΤΟ ΘΥΜΙΖΟΥΜΕ ΚΑΙ ΤΙ ΛΕΜΕ ΣΤΗ ΜΙΣΘΩΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ. Το ακίνητο κρατούσε μόνο την ενεργειακή κατηγορία. Η σάρωση έβαζε
// ένα γεγονός «Λήξη ΠΕΑ» ΤΗΝ ΗΜΕΡΑ της λήξης, δηλαδή τη στιγμή που είναι ήδη
// αργά για νέο πιστοποιητικό. Και η ροή του ενοικιαστή δεν ήξερε αν το ΠΕΑ
// ισχύει στην έναρξη της μίσθωσης.
//
// Η ΝΟΜΙΚΗ ΒΑΣΗ, όπως διαβάστηκε στο κείμενο (ν. 4122/2013, ΦΕΚ Α΄ 42):
//   · άρθρο 12 παρ. 1 περ. δ΄ (όπως αντικαταστάθηκε με το άρθρο 65 του
//     ν. 4685/2020): η έκδοση ΠΕΑ είναι υποχρεωτική «κατά τη μίσθωση
//     (μακροχρόνια, βραχυχρόνια, υπεκμίσθωση) σε νέο ενοικιαστή»·
//   · άρθρο 12 παρ. 2: το ΠΕΑ επιδεικνύεται στον υποψήφιο ενοικιαστή και
//     παραδίδεται στον νέο·
//   · άρθρο 12 παρ. 8: ο αριθμός πρωτοκόλλου του ΠΕΑ μπαίνει υποχρεωτικά στη
//     δήλωση της μίσθωσης·
//   · άρθρο 11 παρ. 6 περ. β΄: ΠΕΑ σε ισχύ καλύπτει μίσθωση μέσα στο
//     διάστημα ισχύος του.
//
// ΤΙ ΔΕΝ ΚΑΝΕΙ, ΕΠΙΤΗΔΕΣ:
//   · Δεν συμπεραίνει τη λήξη από την έκδοση. Ο νόμος ορίζει ανώτατο όριο
//     ισχύος και το ΠΕΑ λήγει νωρίτερα σε ριζική ανακαίνιση (άρθρο 11 παρ. 6
//     περ. α΄): η μόνη ημερομηνία που ξέρουμε σίγουρα είναι αυτή που τυπώνεται.
//     Οι υπενθυμίσεις βγαίνουν ΜΟΝΟ από τη λήξη που έγραψε ο χρήστης ή διάβασε
//     η σάρωση.
//   · Δεν αναφέρει πρόστιμα. Η ειδοποίηση της μίσθωσης λέει τι χρειάζεται και
//     πού βρίσκεται, όχι τι κινδυνεύει.
//
// ΟΙ 90 ΚΑΙ 30 ΗΜΕΡΕΣ ΕΙΝΑΙ ΕΠΙΛΟΓΗ ΠΡΟΪΟΝΤΟΣ, ΟΧΙ ΝΟΜΟΥ: αρκετός χρόνος για
// να κλειστεί ενεργειακός επιθεωρητής πριν από τη λήξη. Τα email τα στέλνει η
// υπάρχουσα `send-reminders` από τα γεγονότα του ημερολογίου: ΕΝΑ για την κάθε
// υπενθύμιση, την ημέρα της, χωρίς σκάλα 7/3/1, χωρίς ληξιπρόθεσμο και χωρίς
// «Πλήρωσα» (lib/calendar/onceOnDay.ts), με τον διακόπτη «Ημέρα εκτέλεσης» των
// προτιμήσεων του χρήστη.
// ═══════════════════════════════════════════════════════════════════════════
import type { EventDraft } from '../data/calendar';
import { PEA_SOURCE_PREFIX } from '../calendar/onceOnDay';
import { isLandLike } from './types';
import { grDate } from '../core/format';
import { daysBetweenIso } from '../core/time';

/** Ο τίτλος του γεγονότος της ημέρας λήξης. Τον διαβάζει και ο φρουρός της σάρωσης. */
export const PEA_EXPIRY_TITLE = 'Λήξη ΠΕΑ';

/** Πόσες ημέρες πριν από τη λήξη μπαίνει υπενθύμιση. Η ημέρα λήξης μπαίνει πάντα. */
export const PEA_REMINDER_DAYS = [90, 30] as const;

/**
 * Το πρόθεμα της πηγής (`calendar_events.source`) των υπενθυμίσεων ΠΕΑ. Ζει στο
 * lib/calendar/onceOnDay.ts, που το διαβάζει και η send-reminders: με αυτό τα
 * email φεύγουν μία φορά, την ημέρα της κάθε υπενθύμισης.
 */
export { PEA_SOURCE_PREFIX };

/** Η πηγή μιας υπενθύμισης: `pea:expiry:90`, `pea:expiry:30`, `pea:expiry:0`. */
export const peaSource = (daysBefore: number): string => `${PEA_SOURCE_PREFIX}${daysBefore}`;

/** Ο νόμος, όπως τον γράφει η ειδοποίηση. */
export const PEA_LAW = 'ν. 4122/2013, άρθρο 12';

/** Το μητρώο του ΥΠΕΝ, μόνο ως αναφορά για όποιον θέλει να το δει. */
export const PEA_REGISTRY_URL = 'https://www.buildingcert.gr/';
export const PEA_REGISTRY_LABEL = 'Αρχείο Επιθεώρησης Κτιρίων (buildingcert.gr)';

/** Οσο μπορεί να είναι ο αριθμός του ΠΕΑ (ίδιο όριο με τον έλεγχο της βάσης). */
export const PEA_NUMBER_MAX = 40;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Η ημερομηνία ως `YYYY-MM-DD` αν υπάρχει στο ημερολόγιο, αλλιώς κενό. Δέχεται σφραγίδα χρόνου. */
export function isoDay(v: string | null | undefined): string {
  const s = String(v ?? '').slice(0, 10);
  const m = ISO.exec(s);
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? s : '';
}

/** Η ημερομηνία μετακινημένη κατά `days` ημερολογιακές ημέρες (σε UTC, χωρίς θερινή ώρα). */
export function shiftIso(iso: string, days: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + days));
  return d.toISOString().slice(0, 10);
}

/** Ο αριθμός όπως θα αποθηκευτεί: χωρίς κενά στις άκρες, κομμένος στο όριο, ή `null`. */
export function cleanPeaNumber(v: string | null | undefined): string | null {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, PEA_NUMBER_MAX).trim();
  return s || null;
}

/**
 * Οι υπενθυμίσεις λήξης: η ίδια η λήξη και από μία 90 και 30 ημέρες πριν.
 *
 * Ό,τι έχει ήδη περάσει στις `today` δεν μπαίνει: μια υπενθύμιση στο παρελθόν
 * θα γινόταν «ληξιπρόθεσμο» email για κάτι που δεν μπορεί πια να γίνει εγκαίρως.
 * Ληγμένο ΠΕΑ δεν παίρνει κανένα γεγονός· το λέει η ειδοποίηση της μίσθωσης.
 * Η πρώτη γραμμή είναι πάντα η ημέρα λήξης, με τον τίτλο που διαβάζει ο φρουρός.
 */
export function peaReminderDrafts(
  expiry: string | null | undefined, today: string, extraNote?: string | null,
): EventDraft[] {
  const exp = isoDay(expiry);
  const t = isoDay(today);
  if (!exp || !t || exp < t) return [];
  const tail = extraNote ? ` ${extraNote}` : '';
  const out: EventDraft[] = [{
    title: PEA_EXPIRY_TITLE, category: 'contract', event_date: exp, amount: null, priority: 'high',
    notes: `Σήμερα λήγει το πιστοποιητικό ενεργειακής απόδοσης. Για νέα μίσθωση ή πώληση χρειάζεται ΠΕΑ σε ισχύ (${PEA_LAW}).${tail}`,
    source: peaSource(0),
  }];
  for (const days of PEA_REMINDER_DAYS) {
    const date = shiftIso(exp, -days);
    if (date < t) continue;
    out.push({
      title: `Το ΠΕΑ λήγει σε ${days} ημέρες`, category: 'contract', event_date: date, amount: null, priority: 'medium',
      notes: `Το πιστοποιητικό ενεργειακής απόδοσης λήγει στις ${grDate(exp)}. Αν θα χρειαστεί για νέα μίσθωση ή πώληση, κλείσε έγκαιρα ραντεβού με ενεργειακό επιθεωρητή.${tail}`,
      source: peaSource(days),
    });
  }
  return out;
}

export type PeaState = 'missing' | 'expired' | 'valid';

/** Τι ισχύει στην ημερομηνία `on`. Η ημέρα της λήξης μετρά ακόμη ως ισχύουσα. */
export function peaStateOn(expiry: string | null | undefined, on: string): PeaState {
  const exp = isoDay(expiry);
  if (!exp) return 'missing';
  return exp < isoDay(on) ? 'expired' : 'valid';
}

/** Πόσες ημέρες μένουν ως τη λήξη (αρνητικό αν πέρασε), ή `null` χωρίς λήξη. */
export function peaDaysLeft(expiry: string | null | undefined, today: string): number | null {
  const exp = isoDay(expiry), t = isoDay(today);
  return exp && t ? daysBetweenIso(t, exp) : null;
}

export interface LeasePeaNotice {
  kind: 'missing' | 'expired';
  /** Πάντα «Χρειάζεται ΠΕΑ σε ισχύ». */
  title: string;
  /** Τι ξέρουμε για το ΠΕΑ του ακινήτου. */
  body: string;
  /** Γιατί, με την πηγή. */
  why: string;
  /** Τι μπορεί να κάνει ο χρήστης. */
  action: string;
}

export const LEASE_PEA_TITLE = 'Χρειάζεται ΠΕΑ σε ισχύ';

/**
 * Η ήπια ειδοποίηση της μίσθωσης: εμφανίζεται μόνο όταν το ακίνητο δεν έχει
 * καταχωρημένη λήξη ΠΕΑ ή η λήξη πέφτει πριν από την έναρξη της μίσθωσης.
 *
 * Χωρίς έναρξη (η φόρμα δεν τη ζήτησε ακόμη) κρίνεται με τη σημερινή ημέρα.
 * `null` όταν δεν υπάρχει τίποτα να ειπωθεί.
 */
export function leasePeaNotice(
  prop: { pea_expiry?: string | null; prop_type?: string | null } | null | undefined,
  leaseStart: string | null | undefined,
  today: string,
): LeasePeaNotice | null {
  // Οικόπεδο, θέση στάθμευσης, αποθήκη: ο οδηγός ακινήτου δεν ζητά ΠΕΑ για
  // αυτούς τους τύπους (lib/property/types.ts), ούτε λοιπόν η ειδοποίηση.
  if (isLandLike(prop?.prop_type)) return null;
  const start = isoDay(leaseStart);
  const on = start || isoDay(today);
  if (!on) return null;
  const state = peaStateOn(prop?.pea_expiry, on);
  if (state === 'valid') return null;
  const why = `Σε νέα μίσθωση το ΠΕΑ επιδεικνύεται και παραδίδεται στον ενοικιαστή και ο αριθμός του μπαίνει στη δήλωση μίσθωσης (${PEA_LAW}).`;
  if (state === 'missing') {
    return {
      kind: 'missing', title: LEASE_PEA_TITLE, why,
      body: 'Δεν έχουμε καταχωρημένη λήξη ΠΕΑ για αυτό το ακίνητο.',
      action: 'Αν το έχεις ήδη, γράψε αριθμό και λήξη στα στοιχεία του ακινήτου ή σάρωσε το πιστοποιητικό.',
    };
  }
  const exp = grDate(isoDay(prop?.pea_expiry));
  return {
    kind: 'expired', title: LEASE_PEA_TITLE, why,
    body: start
      ? `Το ΠΕΑ που έχουμε καταχωρημένο λήγει στις ${exp}, πριν από την έναρξη της μίσθωσης.`
      : `Το ΠΕΑ που έχουμε καταχωρημένο έληξε στις ${exp}.`,
    action: 'Αν έχεις ήδη νεότερο, γράψε τη νέα λήξη στα στοιχεία του ακινήτου ή σάρωσε το πιστοποιητικό.',
  };
}

/** Η γραμμή του ΠΕΑ στη δήλωση μίσθωσης, στο σχήμα των πεδίων της (lib/tax/leaseDeclaration.ts). */
export interface PeaDeclField {
  key: 'pea_number';
  label: string;
  value: string;
  status: 'ok' | 'missing';
  required: false;
  hint?: string;
  fixIn?: 'property';
}

/**
 * Ο αριθμός πρωτοκόλλου του ΠΕΑ ως πεδίο της δήλωσης μίσθωσης (ν. 4122/2013,
 * άρθρο 12 παρ. 8). Μπαίνει ΣΤΑ ΠΕΔΙΑ της δήλωσης και όχι δίπλα τους, ώστε να
 * τον έχουν και η αντιγραφή και το φύλλο εκτύπωσης. `null` σε οικόπεδο, θέση
 * στάθμευσης ή αποθήκη. Δεν είναι υποχρεωτικό για την ετοιμότητα: η δήλωση
 * κρίνεται από τον builder της, που δεν αλλάζει εδώ.
 */
export function peaDeclField(peaNumber: string | null | undefined, propType?: string | null): PeaDeclField | null {
  if (isLandLike(propType)) return null;
  const n = cleanPeaNumber(peaNumber);
  return n
    ? { key: 'pea_number', label: 'Αριθμός πρωτοκόλλου ΠΕΑ', value: n, status: 'ok', required: false }
    : {
      key: 'pea_number', label: 'Αριθμός πρωτοκόλλου ΠΕΑ', value: '', status: 'missing', required: false, fixIn: 'property',
      hint: `Τυπώνεται στο πιστοποιητικό ενεργειακής απόδοσης. Μπαίνει στη δήλωση (${PEA_LAW} παρ. 8).`,
    };
}
