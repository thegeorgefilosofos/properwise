// ═══════════════════════════════════════════════════════════════════════════
// ΗΜΕΡΟΛΟΓΙΑΚΗ ΑΡΙΘΜΗΤΙΚΗ ΤΗΣ ΠΡΟΣΤΑΣΙΑΣ ΙΔΙΟΚΤΗΤΗ, ΧΩΡΙΣ ΚΑΜΙΑ ΥΠΟΘΕΣΗ ΓΙΑ ΤΟ ΣΗΜΕΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Καθαρές συναρτήσεις πάνω σε ημερομηνίες «ΕΕΕΕ-ΜΜ-ΗΗ». Δεν διαβάζουν ρολόι
// (καμία κλήση χωρίς όρισμα στον κατασκευαστή ημερομηνίας) και δεν ξέρουν τίποτα για νόμους:
// ποιος αριθμός ημερών, ποια αφετηρία και αν μετρά ο Αύγουστος τα αποφασίζει
// το μητρώο κανόνων (rules.ts) και η μηχανή (engine.ts).
//
// ΟΙ ΑΡΓΙΕΣ ΕΡΧΟΝΤΑΙ ΑΠΟ ΕΝΑ ΜΕΡΟΣ. Μη εργάσιμη είναι ό,τι λέει το
// lib/calendar/greekHolidays.ts (Σαββατοκύριακο και εθνικές αργίες). Τοπικές
// αργίες και ημέρες κλειστών δικαστηρίων ΔΕΝ είναι μέσα· γι' αυτό η μηχανή
// δεν δίνει ποτέ μία ημερομηνία εκεί όπου μετρά εργάσιμες, μόνο εύρος.
// ═══════════════════════════════════════════════════════════════════════════
import { isNonWorkingDay } from '@/lib/calendar/greekHolidays';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Ελέγχει και επιστρέφει την ημερομηνία· πετά σε κάθε άλλη μορφή. */
export function assertIso(d: string): string {
  if (!ISO.test(d)) throw new Error(`enforcement/calc: «${d}» δεν είναι ΕΕΕΕ-ΜΜ-ΗΗ`);
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, day));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== day) {
    throw new Error(`enforcement/calc: «${d}» δεν υπάρχει στο ημερολόγιο`);
  }
  return d;
}

const toUtc = (d: string): number => {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
};
const fromUtc = (t: number): string => new Date(t).toISOString().slice(0, 10);

export function addDays(d: string, n: number): string {
  return fromUtc(toUtc(assertIso(d)) + n * 86400000);
}

/**
 * Ν μήνες μετά (ή πριν, για αρνητικό Ν): ίδια ημέρα του μήνα· αν δεν υπάρχει,
 * η τελευταία ημέρα του μήνα. Επιστρέφει και αν έγινε αυτή η προσαρμογή,
 * γιατί τότε ο κανόνας δεν είναι επαληθευμένος (σύμβαση C7) και η μηχανή
 * το λέει στον χρήστη αντί να το κρύψει.
 */
export function addMonthsDetail(d: string, n: number): { date: string; clamped: boolean } {
  const [y, m, day] = assertIso(d).split('-').map(Number);
  const idx = (m - 1) + n;
  const ty = y + Math.floor(idx / 12);
  const tm = ((idx % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const td = Math.min(day, last);
  return { date: fromUtc(Date.UTC(ty, tm, td)), clamped: td !== day };
}
export const addMonths = (d: string, n: number): string => addMonthsDetail(d, n).date;

export const isAugust = (d: string): boolean => assertIso(d).slice(5, 7) === '08';
export const isWorking = (d: string): boolean => !isNonWorkingDay(assertIso(d));

/** Η πρώτη εργάσιμη από το `d` και μετά (το ίδιο το `d` αν είναι εργάσιμη). */
export function rollForward(d: string): string {
  let x = assertIso(d);
  while (!isWorking(x)) x = addDays(x, 1);
  return x;
}
/** Η τελευταία εργάσιμη έως και το `d`. */
export function rollBack(d: string): string {
  let x = assertIso(d);
  while (!isWorking(x)) x = addDays(x, -1);
  return x;
}
/** Η επόμενη εργάσιμη ΜΕΤΑ το `d`. */
export const nextWorking = (d: string): string => rollForward(addDays(d, 1));

/**
 * Ν ημερολογιακές ημέρες μετά το `start`, με αφετηρία την επομένη (σύμβαση C1).
 * Με `skipAugust`, οι ημέρες 1 έως 31 Αυγούστου δεν μετρούν (ΚΠολΔ 147 §2).
 * Δεν μεταφέρει σε εργάσιμη· αυτό το κάνει ο καλών, για να φαίνεται.
 */
export function forwardCalendar(start: string, n: number, skipAugust: boolean): string {
  let d = assertIso(start);
  let k = 0;
  while (k < n) {
    d = addDays(d, 1);
    if (skipAugust && isAugust(d)) continue;
    k++;
  }
  return d;
}

/**
 * Η ν-οστή εργάσιμη ΠΡΙΝ από το `day`, χωρίς να μετρά το ίδιο το `day`
 * (σύμβαση C5, η αυστηρή ανάγνωση). Με `augustWorks = false`, οι εργάσιμες
 * του Αυγούστου δεν μετρούν (η άλλη ανάγνωση της C6).
 */
export function backWorking(day: string, n: number, augustWorks: boolean): string {
  let d = assertIso(day);
  let k = 0;
  while (k < n) {
    d = addDays(d, -1);
    if (!isWorking(d) || (!augustWorks && isAugust(d))) continue;
    k++;
  }
  return d;
}

/** Η Δευτέρα που προηγείται του `day` (όχι το ίδιο το `day`). */
export function mondayBefore(day: string): string {
  let d = addDays(day, -1);
  while (new Date(toUtc(d)).getUTCDay() !== 1) d = addDays(d, -1);
  return d;
}

/** Υπάρχει ημέρα Αυγούστου στο κλειστό διάστημα [a, b]; */
export function spansAugust(a: string, b: string): boolean {
  if (b < a) return spansAugust(b, a);
  for (let d = assertIso(a); d <= b; d = addDays(d, 1)) if (isAugust(d)) return true;
  return false;
}
