// ═══════════════════════════════════════════════════════════════════════════
// SHORTS · Η ΜΟΡΦΗ ΕΝΟΣ SHORT, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Ένα short (YouTube Shorts, Instagram Reels, TikTok) γράφεται ΜΙΑ φορά ως
// προδιαγραφή (`ShortSpec`) και η μηχανή βγάζει από αυτήν: τη σελίδα που
// κινείται, τη μουσική, τους ελέγχους, το βίντεο και τα κείμενα κάθε πλατφόρμας.
//
// ΚΑΝΕΝΑ ΨΗΦΙΟ ΣΤΗΝ ΠΡΟΔΙΑΓΡΑΦΗ. Τα κείμενα γράφουν `{id}` και η μηχανή βάζει
// στη θέση του το κείμενο ενός γεγονότος (`Fact`), που το έβγαλε συνάρτηση από
// τον κώδικα της εφαρμογής (lib/tax, lib/billing, app/odigos). Ο έλεγχος
// `gateDigits` (qa.ts) σταματά την παραγωγή αν βρει ψηφίο έξω από `{…}`,
// εκτός από ημερομηνίες και διαδρομές.
//
// Οι κοινές βάσεις (igKit, reelKit, synth) ΔΕΝ αλλάζουν: άλλα reels τις
// χρησιμοποιούν. Εδώ μόνο τις καλούμε.
// ═══════════════════════════════════════════════════════════════════════════
import { C, esc } from '../igKit';
import { SEG } from '../rentFacts';
import { SERIES as IG_SERIES } from '../seiresKit';

export { esc };

// ── Το κάδρο ─────────────────────────────────────────────────────────────
export const W = 1080, H = 1920, FPS = 30;
/**
 * ΟΙ ΖΩΝΕΣ ΤΩΝ ΤΡΙΩΝ ΠΛΑΤΦΟΡΜΩΝ. Κάτω το ~20% (τίτλος, λεζάντα, ήχος, κουμπί
 * ακολούθησης), δεξιά το ~12% (καρδιά, σχόλια, αποστολή) και πάνω οι καρτέλες
 * του TikTok («Following · For You») και το «Reels» του Instagram.
 */
export const SAFE = { top: 160, bottom: Math.round(H * 0.8), right: Math.round(W * 0.88), left: 64 } as const;
/** Η στήλη κάθε σκηνής: μία αριστερή ακμή, μία δεξιά, μέσα στις ζώνες. */
// Η στήλη φτάνει ως το 1488: από κάτω, ως το 1536 (η κάτω ζώνη των πλατφορμών), κάθεται μόνο η
// υποσημείωση «παράδειγμα». Ζύγιση (07/10/2026): η σκηνή κεντράρεται σε όλο το ωφέλιμο ύψος.
export const COL = { L: 90, R: 934, top: 270, bottom: 1488 } as const;
export const CW = COL.R - COL.L;
/** Από τον τίτλο ως το περιεχόμενο, σε κάθε σκηνή. */
export const GAP_HEAD = 48;
/** Το ελάχιστο μέγεθος γραμμάτων (ο έλεγχος `gateType`). */
export const MIN_TEXT = 26;

// ── Τα χρώματα: ΜΟΝΟ αυτά ───────────────────────────────────────────────
/**
 * ΤΟ ΣΥΜΦΩΝΗΜΕΝΟ ΣΥΝΟΛΟ (07/10/2026). Το έδαφος και οι τόνοι της μάρκας όπως
 * στο igKit `C`, τα τέσσερα χρώματα κατηγορίας του carousel (rentFacts.SEG:
 * φόρος, ΕΝΦΙΑ, έξοδα, καθαρά = το μπλε της μάρκας) και τίποτα άλλο. Διαφάνεια
 * επιτρέπεται (`K.x + 'aa'`), καινούριο χρώμα όχι: ο έλεγχος `gateColors` σαρώνει
 * τα υπολογισμένα στυλ της σελίδας και σταματά σε ό,τι δεν είναι εδώ.
 */
export const K = {
  ground: C.ground, panel: C.panel, lift: C.lift, rule: C.rule,
  ink: C.ink, muted: C.muted, faint: C.faint,
  accent: C.accent, onAccent: C.onAccent, ok: C.ok, paper: C.paper, paperInk: C.paperInk,
  tax: SEG.tax, enfia: SEG.enfia, other: SEG.other,
} as const;
export type Token = keyof typeof K;

// ── Οι σειρές ────────────────────────────────────────────────────────────
// Το έδαφος και το μπλε της μάρκας είναι ίδια σε όλες (seiresKit: «δεν είναι
// στα χρώματά μας» για κάθε άλλο έδαφος). Η σειρά παίρνει ΕΝΑ δεύτερο χρώμα
// από τα ήδη εγκεκριμένα του carousel (rentFacts.SEG): κεχριμπάρι για τις
// προθεσμίες, λιλά για τη βραχυχρόνια, πράσινο για τη μακροχρόνια.
export type SeriesKey = 'foroi' | 'vraxy' | 'makro';
export interface Series {
  key: SeriesKey;
  name: string;
  glyph: string;
  /** Το χρώμα της σειράς: τόνος στους τίτλους, στους μεγάλους αριθμούς, στις διαρροές φωτός. */
  accent: string;
  /** Το μουσικό μοτίβο: χτύποι το λεπτό, κλίμακα και φράση. */
  bpm: number;
  motif: { root: string; prog: string[][]; lead: number[]; feel: 'tick' | 'pluck' | 'pulse' };
}
export const SERIES: Record<SeriesKey, Series> = {
  foroi: {
    key: 'foroi', name: IG_SERIES.foroi.name, glyph: IG_SERIES.foroi.glyph, accent: SEG.enfia, bpm: 124,
    motif: { root: 'D', prog: [['D3', 'A3', 'C4', 'F4'], ['A#2', 'F3', 'A3', 'D4'], ['G2', 'D3', 'A#3', 'F4'], ['A2', 'E3', 'A3', 'C#4']], lead: [0, 3, 7, 10, 7, 3, 5, 2], feel: 'tick' },
  },
  vraxy: {
    key: 'vraxy', name: IG_SERIES.vraxy.name, glyph: IG_SERIES.vraxy.glyph, accent: SEG.other, bpm: 108,
    motif: { root: 'A', prog: [['F2', 'C3', 'A3', 'E4'], ['C3', 'G3', 'B3', 'E4'], ['G2', 'D3', 'B3', 'D4'], ['A2', 'E3', 'G3', 'C4']], lead: [7, 9, 12, 11, 7, 4, 5, 7], feel: 'pluck' },
  },
  makro: {
    key: 'makro', name: IG_SERIES.makro.name, glyph: IG_SERIES.makro.glyph, accent: C.ok, bpm: 116,
    motif: { root: 'C', prog: [['C3', 'G3', 'B3', 'E4'], ['A2', 'E3', 'G3', 'C4'], ['F2', 'C3', 'A3', 'E4'], ['G2', 'D3', 'B3', 'F4']], lead: [0, 4, 7, 11, 9, 7, 4, 2], feel: 'pulse' },
  },
};

// ── Τα γεγονότα ──────────────────────────────────────────────────────────
/**
 * Ένα γεγονός: η τιμή του, το κείμενο όπως φαίνεται (από τον μορφοποιητή της
 * εφαρμογής) και από πού ήρθε. Το `validity` δείχνει την εγγραφή του
 * lib/legal/validity.ts που ορίζει ως πότε ισχύει (η «ημερομηνία θανάτου»).
 */
export interface Fact {
  id: string;
  value: number | string;
  text: string;
  source: string;
  validity?: string;
  /** Ημερομηνία ή διαδρομή: τα ψηφία της δεν μετράνε ως ποσό. */
  kind?: 'number' | 'money' | 'date' | 'text';
}
export type Facts = Record<string, Fact>;

/** Κατασκευαστής γεγονότων: κάθε κλήση ζει μέσα σε συνάρτηση που διαβάζει τον κώδικα. */
export const fact = (id: string, value: number | string, text: string, source: string, o: { validity?: string; kind?: Fact['kind'] } = {}): Fact =>
  ({ id, value, text, source, ...o });

/** Κείμενο προδιαγραφής: ελληνικά με `{id}` γεγονότων και `**τόνο**` της σειράς. */
export type Txt = string;

const PH = /\{([a-zA-Z0-9_.]+)\}/g;
/** Βάζει τα γεγονότα στη θέση τους. Άγνωστο `{id}` σταματά την παραγωγή. */
export function fill(s: Txt, f: Facts): string {
  return s.replace(PH, (_, id: string) => {
    const x = f[id];
    if (!x) throw new Error(`Το κείμενο «${s}» ζητά γεγονός «${id}» που δεν υπάρχει.`);
    return x.text;
  });
}
/**
 * ΤΟΝΟΙ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΣΕΙΡΑ. Το `**…**` παίρνει το χρώμα της σειράς· όπου η σειρά
 * είναι και σειρά δεδομένων (το λιλά = Airbnb στα γραφήματα), ο τόνος σε έννοια της
 * άλλης πλευράς διαβάζεται λάθος. `__…__` = πράσινο (ενοικιαστής), `~~…~~` = το μπλε
 * της μάρκας (ουδέτερο: όρια, πληρότητα, διαφορά).
 */
const MARKS: [RegExp, string][] = [[/__(.+?)__/g, 'ok'], [/~~(.+?)~~/g, 'kb']];
/** Ως HTML: διαφυγή και γεγονότα. Το `**…**` γίνεται τόνος (και τα MARKS). */
export function html(s: Txt, f: Facts, cls = 'a'): string {
  return MARKS.reduce((h, [re, c]) => h.replace(re, `<span class="${c}">$1</span>`), esc(fill(s, f)).replace(/\*\*(.+?)\*\*/g, `<span class="${cls}">$1</span>`));
}
/** Χωρίς σήμανση: για εναλλακτικό κείμενο, λεζάντες και ελέγχους. */
export const plain = (s: Txt, f: Facts) => MARKS.reduce((h, [re]) => h.replace(re, '$1'), fill(s, f).replace(/\*\*(.+?)\*\*/g, '$1'));

/** Κεφαλαία χωρίς τόνους, όπως γράφονται στα ελληνικά. */
export const UP = (t: string) => t.toLocaleUpperCase('el').normalize('NFD').replace(/[́̈]/g, '').normalize('NFC');
export const attr = (s: string) => esc(s).replace(/"/g, '&quot;');

// ── Η κίνηση σε στοιχείο ─────────────────────────────────────────────────
/** Μία κίνηση: `A('up', 2.4)`. Πολλές: `A('up', 2.4, .6, 'out', 5, .3)`. Χρόνοι απόλυτοι. */
export const A = (...xs: (string | number)[]) => {
  const out: string[] = [];
  for (let i = 0; i < xs.length;) {
    const type = xs[i++] as string, t = xs[i++] as number;
    const d = typeof xs[i] === 'number' ? (xs[i++] as number) : 0.6;
    out.push(`${type},${+t.toFixed(3)},${d}`);
  }
  return `data-a="${out.join('|')}"`;
};
/** Μετρητής: τα βήματα γράφονται ΕΔΩ από τον μορφοποιητή της εφαρμογής. */
export type Seg = { a: number; b: number; s: string[]; l?: 1 };
export const seg = (a: number, b: number, from: number, to: number, fmt: (x: number) => string, dec = 0, finalText?: string): Seg => {
  const q = Math.pow(10, dec), N = 30;
  const s = Array.from({ length: N + 1 }, (_, k) => (k === N ? (finalText ?? fmt(to)) : fmt(Math.round((from + (to - from) * k / N) * q) / q)));
  return { a, b, s };
};
/**
 * Το «€» ενός μεγάλου ποσού, σε δικό του κουτί: με τη σφιχτή αραίωση των ηρώων η
 * οριζόντια γραμμή του έπεφτε πάνω στο τελευταίο ψηφίο («64€» στο αγκίστρι της 08/10).
 */
export const EU = '<span class="eu">€</span>';
/** Ποσό σε HTML, με το τελικό «€» στο δικό του κουτί. */
export const amt = (s: string) => esc(s).replace(/€$/, EU);
export const counter = (segs: Seg[], cls = '', extra = '') => {
  const eu = segs.every(g => g.s.every(x => /€$/.test(x)));
  const sg = eu ? segs.map(g => ({ ...g, s: g.s.map(x => x.slice(0, -1)) })) : segs;
  const json = JSON.stringify(sg);
  if (json.includes("'")) throw new Error('Ο μετρητής έχει απόστροφο.');
  return `<span class="ct ${cls}" data-seg='${json}'${extra}>${esc(sg[sg.length - 1].s[sg[sg.length - 1].s.length - 1])}</span>${eu ? EU : ''}`;
};
/** Κείμενο που γράφεται γράμμα γράμμα, με δρομέα. */
export const tw = (text: string, t0: number, cps = 32, cls = '') => `<span class="tw ${cls}" data-tw="${t0},${cps}" data-full="${attr(text)}">${esc(text)}</span>`;

/** Γραμμικό εικονίδιο (κουτί 24×24), από σώμα SVG. */
export const glyph = (g: string, c: string, px: number, sw = 1.9) =>
  `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${g}</svg>`;
/** Σχεδιασμένο εικονίδιο: κάθε γραμμή χαράζεται από `a` ως `b`. */
export const drawn = (g: string, c: string, px: number, sw: number, a: number, b: number) =>
  glyph(g.replace(/<(path|rect|circle|line|polyline)/g, `<$1 pathLength="1" stroke-dasharray="1" style="stroke-dashoffset:1" data-draw="${a},${b}"`), c, px, sw);

export const ICON = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  save: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  pin: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12"/><circle cx="12" cy="10" r="2.5"/>',
  quote: '<path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  calc: '<path d="M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M8 5h8v4H8z"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
};

export { C };
