// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΧΩΝΙ ΤΩΝ ΠΕΝΤΕ ΒΗΜΑΤΩΝ: ΠΟΥ ΧΑΝΟΝΤΑΙ ΟΙ ΧΡΗΣΤΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Επίσκεψη → εγγραφή → πρώτο ακίνητο → πρώτη υπενθύμιση → «Πλήρωσα». Η βάση
// μετρά (public.metrics_funnel, μετανάστευση 20261031100000)· εδώ ζουν η
// ανάγνωση, τα ποσοστά από βήμα σε βήμα και ο πίνακας της αναφοράς.
//
// ΤΟ ΠΟΣΟΣΤΟ ΕΙΝΑΙ ΑΠΟ ΤΟ ΠΡΟΗΓΟΥΜΕΝΟ ΒΗΜΑ, ΟΧΙ ΑΠΟ ΤΗΝ ΚΟΡΥΦΗ. Η ερώτηση
// είναι «πού χάνονται»· το 20% «από την επίσκεψη» δεν λέει σε ποιο σκαλί έπεσαν.
//
// Η ΕΠΙΣΚΕΨΗ ΔΕΝ ΕΙΝΑΙ ΑΝΘΡΩΠΟΣ. Είναι ανώνυμο άνοιγμα της σελίδας εγγραφής·
// ο ίδιος επισκέπτης δύο φορές μετρά δύο. Γι' αυτό το πρώτο ποσοστό λέγεται
// «ανά άνοιγμα» και δεν συγκρίνεται με τα υπόλοιπα, που μετρούν λογαριασμούς.
// ═══════════════════════════════════════════════════════════════════════════
import { fn } from '../core/format';

export interface FunnelRow {
  week_start: string;
  visits: number;
  signups: number;
  with_property: number;
  reminded: number;
  paid_marked: number;
}

/** Τα βήματα με τη σειρά τους: κλειδί της βάσης και όνομα στον πίνακα. */
export const FUNNEL_STEPS = [
  { key: 'visits', label: 'Επισκέψεις' },
  { key: 'signups', label: 'Εγγραφές' },
  { key: 'with_property', label: 'Ακίνητο' },
  { key: 'reminded', label: 'Υπενθύμιση' },
  { key: 'paid_marked', label: 'Πλήρωσα' },
] as const satisfies readonly { key: keyof Omit<FunnelRow, 'week_start'>; label: string }[];

const count = (v: unknown): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

/** Οι γραμμές του PostgREST, ελεγμένες: μόνο ημερομηνία και μη αρνητικοί ακέραιοι. */
export function parseFunnelRows(raw: unknown): FunnelRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String((r as Record<string, unknown>).week_start)))
    .map(r => {
      const row = { week_start: String(r.week_start) } as FunnelRow;
      for (const s of FUNNEL_STEPS) row[s.key] = count(r[s.key]);
      return row;
    });
}

/** Το άθροισμα όλων των εβδομάδων: ένα χωνί για όλο το διάστημα. */
export function funnelTotals(rows: readonly FunnelRow[]): Omit<FunnelRow, 'week_start'> {
  const t = { visits: 0, signups: 0, with_property: 0, reminded: 0, paid_marked: 0 };
  for (const r of rows) for (const s of FUNNEL_STEPS) t[s.key] += r[s.key];
  return t;
}

/** «3 από 10 · 30%», ή «—» όταν το προηγούμενο βήμα είναι μηδέν. */
export function stepRate(n: number, prev: number): string {
  if (!prev) return '—';
  return `${fn((n / prev) * 100, 0)}%`;
}

/**
 * Το βήμα όπου χάνονται οι περισσότεροι, ανάμεσα στα βήματα των λογαριασμών
 * (από την εγγραφή και μετά). Κενό όταν δεν υπάρχει ακόμη εγγραφή.
 */
export function biggestDrop(t: Omit<FunnelRow, 'week_start'>): string {
  let worst = '', lost = -1;
  for (let i = 2; i < FUNNEL_STEPS.length; i++) {
    const prev = t[FUNNEL_STEPS[i - 1].key], cur = t[FUNNEL_STEPS[i].key];
    if (prev > 0 && prev - cur > lost) { lost = prev - cur; worst = `από «${FUNNEL_STEPS[i - 1].label}» σε «${FUNNEL_STEPS[i].label}»`; }
  }
  return worst;
}

const weekLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - [...s].length));

/** Ο πίνακας για το τερματικό: μία γραμμή ανά εβδομάδα και από κάτω το σύνολο. */
export function funnelTable(rows: readonly FunnelRow[]): string {
  const head = ['Εβδομάδα', ...FUNNEL_STEPS.map(s => s.label)];
  const cell = (r: Omit<FunnelRow, 'week_start'>, i: number) => {
    const k = FUNNEL_STEPS[i].key;
    if (i === 0) return String(r[k]);
    return `${r[k]} (${stepRate(r[k], r[FUNNEL_STEPS[i - 1].key])})`;
  };
  const body = rows.map(r => [weekLabel(r.week_start), ...FUNNEL_STEPS.map((_, i) => cell(r, i))]);
  const tot = funnelTotals(rows);
  const all = [head, ...body, ['Σύνολο', ...FUNNEL_STEPS.map((_, i) => cell(tot, i))]];
  const widths = head.map((_, i) => Math.max(...all.map(r => [...r[i]].length)));
  const line = (r: string[]) => r.map((c, i) => pad(c, widths[i])).join('  ').trimEnd();
  const rule = widths.map(w => '─'.repeat(w)).join('  ');
  return [line(head), rule, ...body.map(line), rule, line(all[all.length - 1])].join('\n');
}

/** Η ενότητα της αναφοράς: πίνακας, το βήμα με τη μεγαλύτερη απώλεια και οι ορισμοί. */
export function funnelText(rows: readonly FunnelRow[]): string {
  const drop = biggestDrop(funnelTotals(rows));
  return [
    'ΧΩΝΙ ΣΕ ΠΕΝΤΕ ΒΗΜΑΤΑ: ΕΠΙΣΚΕΨΗ, ΕΓΓΡΑΦΗ, ΑΚΙΝΗΤΟ, ΥΠΕΝΘΥΜΙΣΗ, «ΠΛΗΡΩΣΑ»',
    '',
    funnelTable(rows),
    '',
    drop ? `Οι περισσότεροι χάνονται ${drop}.` : 'Καμία εγγραφή ακόμη στο διάστημα.',
    '',
    'ΟΡΙΣΜΟΙ ΧΩΝΙΟΥ',
    '  Το ποσοστό σε παρένθεση είναι από το ΠΡΟΗΓΟΥΜΕΝΟ βήμα.',
    '  Επισκέψεις: ανοίγματα της σελίδας εγγραφής, ανώνυμα. Τις επισκέψεις όλου του site τις δείχνει το Vercel Analytics.',
    '  Εγγραφές: λογαριασμοί που δημιουργήθηκαν μέσα στην εβδομάδα. Ακίνητο, υπενθύμιση και «Πλήρωσα» μετρούν αυτούς, ως σήμερα.',
    '  Υπενθύμιση: στάλθηκε έστω μία. «Πλήρωσα»: σημείωσαν έστω μία προθεσμία ως πληρωμένη, από την υπενθύμιση ή την εφαρμογή.',
  ].join('\n');
}
