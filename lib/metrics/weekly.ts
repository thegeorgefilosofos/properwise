// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΒΔΟΜΑΔΙΑΙΑ ΜΕΤΡΗΣΗ: ΕΓΓΡΑΦΕΣ, ΕΝΕΡΓΟΠΟΙΗΣΗ, ΕΠΙΣΤΡΟΦΗ, ΠΛΗΡΩΜΕΝΟΙ
// ─────────────────────────────────────────────────────────────────────────
// Η βάση μετρά (public.metrics_weekly και public.metrics_snapshot, μετανάστευση
// 20261020150000)· εδώ ζουν οι ορισμοί που διαβάζει ο άνθρωπος και η μορφή
// του πίνακα. Καθαρές συναρτήσεις: δοκιμάζονται χωρίς βάση (weekly.test.ts).
//
// ΤΑ ΠΑΡΑΘΥΡΑ ΓΡΑΦΟΝΤΑΙ ΔΥΟ ΦΟΡΕΣ, ΣΚΟΠΙΜΑ. Η SQL τα χρειάζεται μέσα στη
// συνάρτηση και η αναφορά τα τυπώνει στη λεζάντα. Το τεστ διαβάζει τη
// μετανάστευση και κοκκινίζει αν διαφέρουν: μια λεζάντα «25–35» πάνω από
// μέτρηση 28–32 θα ήταν ψέμα που κανείς δεν βλέπει.
//
// ΚΑΝΕΝΑ ΠΡΟΣΩΠΙΚΟ ΣΤΟΙΧΕΙΟ. Οι γραμμές είναι πλήθη ανά εβδομάδα. Ο τύπος δεν
// έχει θέση για αναγνωριστικό ή email. Η `parseWeeklyRows` πετά ό,τι δεν
// είναι αριθμός.
// ═══════════════════════════════════════════════════════════════════════════
import { fn } from '../core/format';

/** Οι μέρες μετά την εγγραφή (μέρα 0) όπου η επιστροφή μετρά. Ίδιες με την SQL. */
export const RETENTION_WINDOWS = {
  d1: { from: 1, to: 1 },
  d7: { from: 6, to: 8 },
  d30: { from: 25, to: 35 },
} as const;

export interface WeeklyRow {
  week_start: string;
  signups: number;
  activated: number;
  d1_eligible: number;
  d1_active: number;
  d7_eligible: number;
  d7_active: number;
  d30_eligible: number;
  d30_active: number;
  active_users: number;
  scans: number;
  new_paying: number;
}

export interface Snapshot {
  users: number;
  activated: number;
  active_7d: number;
  active_30d: number;
  paying_now: number;
}

const COUNT_KEYS = [
  'signups', 'activated', 'd1_eligible', 'd1_active', 'd7_eligible', 'd7_active',
  'd30_eligible', 'd30_active', 'active_users', 'scans', 'new_paying',
] as const;

const count = (v: unknown): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

/**
 * Οι γραμμές όπως τις δίνει το PostgREST, ελεγμένες. Μόνο ημερομηνία και
 * μη αρνητικοί ακέραιοι· οτιδήποτε άλλο δεν περνά στην αναφορά.
 */
export function parseWeeklyRows(raw: unknown): WeeklyRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String((r as Record<string, unknown>).week_start)))
    .map(r => {
      const row = { week_start: String(r.week_start) } as WeeklyRow;
      for (const k of COUNT_KEYS) row[k] = count(r[k]);
      return row;
    });
}

export function parseSnapshot(raw: unknown): Snapshot | null {
  const r = Array.isArray(raw) ? raw[0] : raw;
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  return {
    users: count(o.users), activated: count(o.activated), active_7d: count(o.active_7d),
    active_30d: count(o.active_30d), paying_now: count(o.paying_now),
  };
}

/** «1/2 · 50%», ή «—» όταν κανείς δεν είναι ακόμη μετρήσιμος. */
export function rate(active: number, eligible: number): string {
  if (!eligible) return '—';
  return `${active}/${eligible} · ${fn((active / eligible) * 100, 0)}%`;
}

/** «2026-10-12» → «12/10/2026», η Δευτέρα της εβδομάδας. */
const weekLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - [...s].length));

export const COLUMNS = ['Εβδομάδα', 'Εγγραφές', 'Με ακίνητο', 'D1', 'D7', 'D30', 'Ενεργοί', 'Σαρώσεις', 'Νέοι πληρωμένοι'] as const;

/** Ο πίνακας για το τερματικό: μία γραμμή ανά εβδομάδα, η νεότερη πρώτη. */
export function weeklyTable(rows: readonly WeeklyRow[]): string {
  const body = rows.map(r => [
    weekLabel(r.week_start), String(r.signups), String(r.activated),
    rate(r.d1_active, r.d1_eligible), rate(r.d7_active, r.d7_eligible), rate(r.d30_active, r.d30_eligible),
    String(r.active_users), String(r.scans), String(r.new_paying),
  ]);
  const all = [[...COLUMNS], ...body];
  const widths = COLUMNS.map((_, i) => Math.max(...all.map(r => [...r[i]].length)));
  const line = (r: string[]) => r.map((c, i) => pad(c, widths[i])).join('  ').trimEnd();
  return [line(all[0]), widths.map(w => '─'.repeat(w)).join('  '), ...body.map(line)].join('\n');
}

/** Η κεφαλίδα και οι ορισμοί, για να διαβάζεται ο πίνακας χωρίς τη μετανάστευση. */
export function reportText(rows: readonly WeeklyRow[], snap: Snapshot | null, today: string): string {
  const w = RETENTION_WINDOWS;
  const total = rows.reduce((a, r) => ({
    s: a.s + r.signups, act: a.act + r.activated,
    e30: a.e30 + r.d30_eligible, a30: a.a30 + r.d30_active,
  }), { s: 0, act: 0, e30: 0, a30: 0 });
  const out = [
    `ΜΕΤΡΗΣΗ PROPERWISE · ${today} (ώρα Ελλάδας)`,
    '',
  ];
  if (snap) {
    out.push(
      `Σήμερα: ${snap.users} χρήστες · ${snap.activated} με ακίνητο · ${snap.active_7d} ενεργοί 7 ημερών · ${snap.active_30d} ενεργοί 30 ημερών · ${snap.paying_now} πληρώνουν τώρα`,
      '',
    );
  }
  out.push(
    weeklyTable(rows),
    '',
    `Στις ${rows.length} εβδομάδες: ${total.s} εγγραφές, ${total.act} με ακίνητο, επιστροφή 30 ημερών ${rate(total.a30, total.e30)}.`,
    '',
    'ΟΡΙΣΜΟΙ',
    '  Εβδομάδα: Δευτέρα ως Κυριακή, ώρα Ελλάδας· η γραμμή είναι οι λογαριασμοί που δημιουργήθηκαν μέσα της.',
    '  Με ακίνητο: έχουν βάλει έστω ένα ακίνητο (ως σήμερα).',
    `  D1 / D7 / D30: ενεργοί τη μέρα ${w.d1.from}, μία από τις μέρες ${w.d7.from} έως ${w.d7.to}, μία από τις μέρες ${w.d30.from} έως ${w.d30.to} μετά την εγγραφή.`,
    '  Μετρούν μόνο όσοι έχουν κλείσει το παράθυρο («ενεργοί/μετρήσιμοι»). Η παύλα σημαίνει: κανείς μετρήσιμος ακόμη.',
    '  Ενεργός: γεγονός προϊόντος, δική του ενέργεια ή άνοιγμα της εφαρμογής με σύνδεση. Κάτω όριο.',
    '  Ενεργοί, σαρώσεις, νέοι πληρωμένοι: όσα έγιναν ΜΕΣΑ στην εβδομάδα, από όλους τους χρήστες.',
    '  Έξω από κάθε μέτρηση οι λογαριασμοί του app_admins. Μόνο πλήθη, κανένα στοιχείο προσώπου.',
  );
  return out.join('\n');
}
