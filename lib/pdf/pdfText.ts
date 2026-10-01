// ═══════════════════════════════════════════════════════════════════════════
// ΚΕΙΜΕΝΟ ΑΠΟ PDF, ΧΩΡΙΣ ΒΙΒΛΙΟΘΗΚΗ ΑΝΑΓΝΩΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το προσυμπληρωμένο Ε2 ο ιδιοκτήτης το έχει ως PDF: το
// «εκτύπωσε» από την εφαρμογή Ε1/Ε2 του myAADE. Το έργο έχει βιβλιοθήκες που
// ΓΡΑΦΟΥΝ PDF (pdfmake, pdfkit) και καμία που τα ΔΙΑΒΑΖΕΙ· ένα pdf.js θα ήταν
// μεγαβάιτ στον browser για ένα κουμπί. Ό,τι χρειάζεται εδώ είναι στενό: οι
// γραμμές ενός πίνακα, με τη σειρά που τυπώθηκαν.
//
// ΤΙ ΔΙΑΒΑΖΕΙ. Αντικείμενα και ροές αντικειμένων (PDF 1.5+), συμπίεση Flate
// (το `fflate` είναι ήδη εξάρτηση), γραμματοσειρές Type0/Identity-H με χάρτη
// ToUnicode (ό,τι βγάζει η «Αποθήκευση ως PDF» του Chrome και κάθε σύγχρονη
// γεννήτρια) και απλές γραμματοσειρές με WinAnsi ή Differences. Τοποθετεί κάθε
// κομμάτι κειμένου με τον πίνακα μετασχηματισμού και τα πλάτη των γλυφών, ώστε
// οι στήλες του πίνακα να βγαίνουν χωρισμένες με tab.
//
// ΤΙ ΔΕΝ ΔΙΑΒΑΖΕΙ, ΚΑΙ ΤΟ ΛΕΕΙ. Κρυπτογραφημένο αρχείο και σάρωση χωρίς
// κείμενο επιστρέφουν ρητή αιτία· ο καλών προτείνει επικόλληση ή χειροκίνητη
// καταχώρηση. Ποτέ «κενό» σαν να διαβάστηκε ένα άδειο έντυπο.
// ═══════════════════════════════════════════════════════════════════════════
import { unzlibSync, inflateSync } from 'fflate';

export interface PdfTextResult {
  /** Οι γραμμές του εγγράφου, σελίδα προς σελίδα. Στήλες χωρισμένες με tab. */
  lines: string[];
  pages: number;
  /** Γιατί δεν βγήκε κείμενο, όταν δεν βγήκε. */
  failure: 'encrypted' | 'no_text' | 'not_pdf' | null;
}

// ── Αναπαράσταση αντικειμένων ─────────────────────────────────────────────
type PdfVal = number | boolean | null | string | PdfName | PdfRef | PdfVal[] | PdfDict | PdfStr;
interface PdfName { n: string }
interface PdfRef { ref: number }
interface PdfStr { s: Uint8Array }
interface PdfDict { [k: string]: PdfVal }

const isName = (v: unknown): v is PdfName => !!v && typeof v === 'object' && 'n' in (v as object);
const isRef = (v: unknown): v is PdfRef => !!v && typeof v === 'object' && 'ref' in (v as object);
const isStr = (v: unknown): v is PdfStr => !!v && typeof v === 'object' && 's' in (v as object);
const isDict = (v: unknown): v is PdfDict =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !isName(v) && !isRef(v) && !isStr(v);

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

/** Ανάγνωση τιμών PDF από bytes (λεξικά, πίνακες, ονόματα, συμβολοσειρές). */
class Lexer {
  pos: number;
  constructor(readonly b: Uint8Array, start = 0, readonly end = b.length) { this.pos = start; }

  skip(): void {
    const { b } = this;
    while (this.pos < this.end) {
      const c = b[this.pos];
      if (WS.has(c)) { this.pos++; continue; }
      if (c === 0x25) { while (this.pos < this.end && b[this.pos] !== 0x0a && b[this.pos] !== 0x0d) this.pos++; continue; }
      break;
    }
  }

  /** Μία λέξη χωρίς διαχωριστικά: αριθμός, τελεστής, `true`, `R`. */
  word(): string {
    const { b } = this;
    const s = this.pos;
    while (this.pos < this.end && !WS.has(b[this.pos]) && !DELIM.has(b[this.pos])) this.pos++;
    let out = '';
    for (let i = s; i < this.pos; i++) out += String.fromCharCode(b[i]);
    return out;
  }

  literal(): PdfStr {
    const { b } = this;
    this.pos++; // (
    const out: number[] = [];
    let depth = 1;
    while (this.pos < this.end) {
      let c = b[this.pos++];
      if (c === 0x5c) {
        c = b[this.pos++];
        if (c === 0x6e) out.push(0x0a);
        else if (c === 0x72) out.push(0x0d);
        else if (c === 0x74) out.push(0x09);
        else if (c === 0x62) out.push(0x08);
        else if (c === 0x66) out.push(0x0c);
        else if (c >= 0x30 && c <= 0x37) {
          let v = c - 0x30;
          for (let k = 0; k < 2 && b[this.pos] >= 0x30 && b[this.pos] <= 0x37; k++) v = v * 8 + (b[this.pos++] - 0x30);
          out.push(v & 0xff);
        } else if (c === 0x0d) { if (b[this.pos] === 0x0a) this.pos++; }
        else if (c !== 0x0a) out.push(c);
        continue;
      }
      if (c === 0x28) depth++;
      if (c === 0x29 && --depth === 0) break;
      out.push(c);
    }
    return { s: Uint8Array.from(out) };
  }

  hex(): PdfStr {
    const { b } = this;
    this.pos++; // <
    let digits = '';
    while (this.pos < this.end && b[this.pos] !== 0x3e) {
      const c = b[this.pos++];
      if (!WS.has(c)) digits += String.fromCharCode(c);
    }
    this.pos++; // >
    if (digits.length % 2) digits += '0';
    const out = new Uint8Array(digits.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(digits.slice(i * 2, i * 2 + 2), 16) || 0;
    return { s: out };
  }

  name(): PdfName {
    this.pos++; // /
    const raw = this.word();
    return { n: raw.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) };
  }

  /** Μία τιμή. Το `undefined` σημαίνει τέλος ή κάτι που δεν είναι τιμή. */
  value(): PdfVal | undefined {
    this.skip();
    if (this.pos >= this.end) return undefined;
    const c = this.b[this.pos];
    if (c === 0x2f) return this.name();
    if (c === 0x28) return this.literal();
    if (c === 0x3c) {
      if (this.b[this.pos + 1] === 0x3c) { this.pos += 2; return this.dict(); }
      return this.hex();
    }
    if (c === 0x5b) {
      this.pos++;
      const arr: PdfVal[] = [];
      for (;;) {
        this.skip();
        if (this.pos >= this.end) return arr;
        if (this.b[this.pos] === 0x5d) { this.pos++; return arr; }
        const v = this.value();
        if (v === undefined) return arr;
        arr.push(v);
      }
    }
    const w = this.word();
    if (!w) { this.pos++; return undefined; }
    if (w === 'true') return true;
    if (w === 'false') return false;
    if (w === 'null') return null;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) {
      // Αναφορά «12 0 R»: κοιτάμε μπροστά χωρίς να καταναλώσουμε αν δεν είναι.
      if (/^\d+$/.test(w)) {
        const save = this.pos;
        this.skip();
        const g = this.word();
        if (/^\d+$/.test(g)) {
          this.skip();
          if (this.b[this.pos] === 0x52 && (this.pos + 1 >= this.end || WS.has(this.b[this.pos + 1]) || DELIM.has(this.b[this.pos + 1]))) {
            this.pos++;
            return { ref: Number(w) };
          }
        }
        this.pos = save;
      }
      return Number(w);
    }
    return w; // τελεστής ή λέξη-κλειδί
  }

  dict(): PdfDict {
    const d: PdfDict = {};
    for (;;) {
      this.skip();
      if (this.pos >= this.end) return d;
      if (this.b[this.pos] === 0x3e && this.b[this.pos + 1] === 0x3e) { this.pos += 2; return d; }
      const k = this.value();
      if (!isName(k)) { if (k === undefined) return d; continue; }
      const v = this.value();
      if (v === undefined) return d;
      d[k.n] = v;
    }
  }
}

interface PdfObject { val: PdfVal; stream?: Uint8Array }

const latin1 = (b: Uint8Array, s = 0, e = b.length): string => {
  let out = '';
  const CH = 8192;
  for (let i = s; i < e; i += CH) out += String.fromCharCode(...b.subarray(i, Math.min(e, i + CH)));
  return out;
};

/** Αποσυμπίεση ροής. Οτι δεν ξέρουμε να αποκωδικοποιήσουμε, επιστρέφει null. */
function decodeStream(o: PdfObject, resolve: (v: PdfVal | undefined) => PdfVal | undefined): Uint8Array | null {
  if (!o.stream || !isDict(o.val)) return o.stream ?? null;
  const f = resolve(o.val.Filter);
  const filters = (Array.isArray(f) ? f : f ? [f] : []).map(x => (isName(x) ? x.n : ''));
  let data: Uint8Array = o.stream;
  for (const name of filters) {
    if (name === 'FlateDecode' || name === 'Fl') {
      try { data = unzlibSync(data); }
      catch {
        try { data = inflateSync(data.subarray(2)); } catch { return null; }
      }
      const parms = resolve(o.val.DecodeParms);
      const pred = isDict(parms) ? Number(resolve(parms.Predictor) ?? 1) : 1;
      if (pred >= 10 && isDict(parms)) data = pngUnpredict(data, Number(resolve(parms.Columns) ?? 1));
    } else {
      return null; // εικόνες (DCT, JBIG2) και ό,τι άλλο: δεν είναι κείμενο
    }
  }
  return data;
}

/** Η πρόβλεψη PNG που βάζουν οι γεννήτριες στις ροές xref. */
function pngUnpredict(data: Uint8Array, columns: number): Uint8Array {
  const row = columns + 1;
  const rows = Math.floor(data.length / row);
  const out = new Uint8Array(rows * columns);
  for (let r = 0; r < rows; r++) {
    const type = data[r * row];
    for (let c = 0; c < columns; c++) {
      const x = data[r * row + 1 + c];
      const up = r > 0 ? out[(r - 1) * columns + c] : 0;
      const left = c > 0 ? out[r * columns + c - 1] : 0;
      out[r * columns + c] = (type === 2 ? x + up : type === 1 ? x + left : x) & 0xff;
    }
  }
  return out;
}

/** Ολα τα αντικείμενα του αρχείου, με σάρωση: δεν εμπιστευόμαστε τον πίνακα xref. */
function readObjects(b: Uint8Array): { objs: Map<number, PdfObject>; trailer: PdfDict } {
  const text = latin1(b);
  const objs = new Map<number, PdfObject>();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const num = Number(m[1]);
    const lx = new Lexer(b, m.index + m[0].length);
    const val = lx.value();
    if (val === undefined) continue;
    const o: PdfObject = { val };
    lx.skip();
    if (text.startsWith('stream', lx.pos)) {
      let s = lx.pos + 6;
      if (b[s] === 0x0d) s++;
      if (b[s] === 0x0a) s++;
      const len = isDict(val) && typeof val.Length === 'number' ? val.Length : -1;
      let e = len >= 0 && text.startsWith('endstream', skipWs(b, s + len)) ? s + len : text.indexOf('endstream', s);
      if (e < 0) e = b.length;
      else if (len < 0) { while (e > s && (b[e - 1] === 0x0a || b[e - 1] === 0x0d)) e--; }
      o.stream = b.subarray(s, e);
      re.lastIndex = e;
    }
    objs.set(num, o);
  }
  // Το trailer: είτε λεξικό μετά τη λέξη, είτε το λεξικό της ροής xref.
  let trailer: PdfDict = {};
  const t = text.lastIndexOf('trailer');
  if (t >= 0) {
    const v = new Lexer(b, t + 7).value();
    if (isDict(v)) trailer = v;
  }
  if (!trailer.Root) {
    for (const o of objs.values()) {
      if (isDict(o.val) && isName(o.val.Type) && o.val.Type.n === 'XRef') { trailer = o.val; }
    }
  }
  return { objs, trailer };
}

const skipWs = (b: Uint8Array, i: number): number => { while (i < b.length && WS.has(b[i])) i++; return i; };

/** Τα αντικείμενα που ζουν μέσα σε ροές αντικειμένων (PDF 1.5 και μετά). */
function expandObjectStreams(objs: Map<number, PdfObject>, resolve: (v: PdfVal | undefined) => PdfVal | undefined): void {
  for (const o of [...objs.values()]) {
    if (!isDict(o.val) || !isName(o.val.Type) || o.val.Type.n !== 'ObjStm') continue;
    const data = decodeStream(o, resolve);
    if (!data) continue;
    const n = Number(o.val.N) || 0;
    const first = Number(o.val.First) || 0;
    const head = new Lexer(data, 0, first);
    const pairs: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const num = head.value(); const off = head.value();
      if (typeof num !== 'number' || typeof off !== 'number') break;
      pairs.push([num, off]);
    }
    for (const [num, off] of pairs) {
      if (objs.has(num)) continue;
      const v = new Lexer(data, first + off).value();
      if (v !== undefined) objs.set(num, { val: v });
    }
  }
}

// ── Γραμματοσειρές ─────────────────────────────────────────────────────────
interface Font {
  /** Πόσα bytes έχει κάθε κωδικός γλυφής: 2 στις Type0/Identity-H. */
  bytes: 1 | 2;
  toUnicode: Map<number, string>;
  widths: Map<number, number>;
  defaultWidth: number;
}

/** Ονόματα γλυφών που φτάνουν για ελληνικά, αριθμούς και σημεία στίξης. */
const GLYPH: Record<string, string> = {
  space: ' ', period: '.', comma: ',', slash: '/', hyphen: '-', colon: ':', semicolon: ';', percent: '%',
  parenleft: '(', parenright: ')', zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', Euro: '€', numbersign: '#', ampersand: '&', underscore: '_',
  quotesingle: "'", quotedbl: '"', plus: '+', equal: '=', asterisk: '*', bullet: '•', endash: '–', emdash: '—',
  guillemotleft: '«', guillemotright: '»', middot: '·', periodcentered: '·',
};
const GREEK = 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho _ Sigma Tau Upsilon Phi Chi Psi Omega'.split(' ');
GREEK.forEach((g, i) => {
  if (g === '_') return;
  GLYPH[g] = String.fromCharCode(0x391 + i);
  GLYPH[g.toLowerCase()] = String.fromCharCode(0x3b1 + i);
});
Object.assign(GLYPH, {
  sigma1: 'ς', sigmafinal: 'ς', alphatonos: 'ά', epsilontonos: 'έ', etatonos: 'ή', iotatonos: 'ί', omicrontonos: 'ό',
  upsilontonos: 'ύ', omegatonos: 'ώ', Alphatonos: 'Ά', Epsilontonos: 'Έ', Etatonos: 'Ή', Iotatonos: 'Ί',
  Omicrontonos: 'Ό', Upsilontonos: 'Ύ', Omegatonos: 'Ώ', iotadieresis: 'ϊ', upsilondieresis: 'ϋ',
  iotadieresistonos: 'ΐ', upsilondieresistonos: 'ΰ', mu: 'μ',
});
const glyphToUnicode = (name: string): string | null => {
  if (GLYPH[name]) return GLYPH[name];
  const u = /^uni([0-9A-Fa-f]{4})$/.exec(name) || /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  if (u) return String.fromCodePoint(parseInt(u[1], 16));
  if (name.length === 1) return name;
  return null;
};

/** WinAnsi: όσα διαφέρουν από το Latin-1 στο 0x80–0x9F. */
const WIN_ANSI_HIGH: Record<number, string> = { 0x80: '€', 0x85: '…', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—' };

const utf16 = (s: Uint8Array): string => {
  let out = '';
  for (let i = 0; i + 1 < s.length; i += 2) out += String.fromCharCode((s[i] << 8) | s[i + 1]);
  return out;
};
const bytesToInt = (s: Uint8Array): number => s.reduce((v, x) => v * 256 + x, 0);

/** Ο χάρτης ToUnicode: bfchar και bfrange, σε όποια μορφή κι αν γράφτηκε. */
function parseCMap(data: Uint8Array): { map: Map<number, string>; bytes: 1 | 2 } {
  const map = new Map<number, string>();
  let bytes: 1 | 2 = 1;
  const lx = new Lexer(data);
  const pending: PdfVal[] = [];
  let mode: 'char' | 'range' | 'space' | null = null;
  for (;;) {
    const v = lx.value();
    if (v === undefined) { if (lx.pos >= data.length) break; continue; }
    if (typeof v === 'string') {
      if (v === 'begincodespacerange') { mode = 'space'; pending.length = 0; }
      else if (v === 'beginbfchar') { mode = 'char'; pending.length = 0; }
      else if (v === 'beginbfrange') { mode = 'range'; pending.length = 0; }
      else if (v.startsWith('end')) mode = null;
      continue;
    }
    if (!mode) continue;
    pending.push(v);
    if (mode === 'space' && pending.length === 2) {
      if (isStr(pending[0]) && pending[0].s.length >= 2) bytes = 2;
      pending.length = 0;
    } else if (mode === 'char' && pending.length === 2) {
      const [src, dst] = pending;
      if (isStr(src) && isStr(dst)) { map.set(bytesToInt(src.s), utf16(dst.s)); if (src.s.length >= 2) bytes = 2; }
      pending.length = 0;
    } else if (mode === 'range' && pending.length === 3) {
      const [lo, hi, dst] = pending;
      if (isStr(lo) && isStr(hi)) {
        if (lo.s.length >= 2) bytes = 2;
        const a = bytesToInt(lo.s), z = Math.min(bytesToInt(hi.s), a + 65535);
        if (isStr(dst)) {
          const base = utf16(dst.s);
          const head = base.slice(0, -1), last = base.charCodeAt(base.length - 1);
          for (let c = a; c <= z; c++) map.set(c, head + String.fromCharCode(last + (c - a)));
        } else if (Array.isArray(dst)) {
          dst.forEach((d, i) => { if (isStr(d)) map.set(a + i, utf16(d.s)); });
        }
      }
      pending.length = 0;
    }
  }
  return { map, bytes };
}

function loadFont(fd: PdfDict, get: (v: PdfVal | undefined) => PdfVal | undefined, getObj: (v: PdfVal | undefined) => PdfObject | undefined): Font {
  const subtype = isName(fd.Subtype) ? fd.Subtype.n : '';
  const font: Font = { bytes: subtype === 'Type0' ? 2 : 1, toUnicode: new Map(), widths: new Map(), defaultWidth: subtype === 'Type0' ? 1000 : 500 };
  const tu = getObj(fd.ToUnicode);
  if (tu) {
    const data = decodeStream(tu, get);
    if (data) { const cm = parseCMap(data); font.toUnicode = cm.map; if (subtype !== 'Type0') font.bytes = 1; }
  }
  if (subtype === 'Type0') {
    const descendants = get(fd.DescendantFonts);
    const cid = Array.isArray(descendants) ? get(descendants[0]) : undefined;
    if (isDict(cid)) {
      if (typeof get(cid.DW) === 'number') font.defaultWidth = get(cid.DW) as number;
      const w = get(cid.W);
      if (Array.isArray(w)) {
        for (let i = 0; i < w.length;) {
          const first = get(w[i]) as number;
          const next = get(w[i + 1]);
          if (Array.isArray(next)) { next.forEach((x, k) => font.widths.set(first + k, Number(get(x)) || 0)); i += 2; }
          else { const last = Number(next), width = Number(get(w[i + 2])) || 0; for (let c = first; c <= last && c - first < 65536; c++) font.widths.set(c, width); i += 3; }
        }
      }
    }
  } else {
    const first = Number(get(fd.FirstChar)) || 0;
    const ws = get(fd.Widths);
    if (Array.isArray(ws)) ws.forEach((x, i) => font.widths.set(first + i, Number(get(x)) || 0));
    // Χωρίς ToUnicode: η κωδικοποίηση και οι Differences με ονόματα γλυφών.
    if (font.toUnicode.size === 0) {
      for (let c = 32; c < 256; c++) font.toUnicode.set(c, WIN_ANSI_HIGH[c] ?? String.fromCharCode(c));
      const enc = get(fd.Encoding);
      const diffs = isDict(enc) ? get(enc.Differences) : undefined;
      if (Array.isArray(diffs)) {
        let code = 0;
        for (const d of diffs) {
          const v = get(d);
          if (typeof v === 'number') code = v;
          else if (isName(v)) { const u = glyphToUnicode(v.n); if (u) font.toUnicode.set(code, u); code++; }
        }
      }
    }
  }
  return font;
}

// ── Ο μετασχηματισμός ─────────────────────────────────────────────────────
type M = [number, number, number, number, number, number];
const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];
const ID: M = [1, 0, 0, 1, 0, 0];

interface Item { x: number; y: number; end: number; size: number; text: string }

/** Τα κομμάτια κειμένου μιας ροής περιεχομένου, με θέση και πλάτος. */
function runContent(data: Uint8Array, fonts: Map<string, Font>, xobjects: (name: string) => { data: Uint8Array; fonts: Map<string, Font>; matrix: M } | null, depth = 0, base: M = ID): Item[] {
  const items: Item[] = [];
  const lx = new Lexer(data);
  const ops: PdfVal[] = [];
  let ctm: M = base;
  const stack: M[] = [];
  let tm: M = ID, tlm: M = ID;
  let font: Font | undefined, size = 10, leading = 0, cs = 0, wsp = 0, hs = 1, rise = 0;

  const show = (s: Uint8Array) => {
    if (!font) return;
    let text = '';
    const start = mul([size * hs, 0, 0, size, 0, rise], mul(tm, ctm));
    for (let i = 0; i < s.length; i += font.bytes) {
      const code = font.bytes === 2 ? (s[i] << 8) | (s[i + 1] ?? 0) : s[i];
      const u = font.toUnicode.get(code) ?? '';
      text += u;
      const w = (font.widths.get(code) ?? font.defaultWidth) / 1000;
      const tx = (w * size + cs + (u === ' ' && font.bytes === 1 ? wsp : 0)) * hs;
      tm = mul([1, 0, 0, 1, tx, 0], tm);
    }
    const endM = mul([size * hs, 0, 0, size, 0, rise], mul(tm, ctm));
    const scale = Math.hypot(start[2], start[3]) || size;
    if (text) items.push({ x: start[4], y: start[5], end: endM[4], size: scale, text });
  };

  for (;;) {
    const v = lx.value();
    if (v === undefined) { if (lx.pos >= data.length) break; continue; }
    if (typeof v !== 'string') { ops.push(v); continue; }
    const num = (i: number) => Number(ops[ops.length - i]) || 0;
    switch (v) {
      case 'q': stack.push(ctm); break;
      case 'Q': ctm = stack.pop() ?? base; break;
      case 'cm': ctm = mul([num(6), num(5), num(4), num(3), num(2), num(1)], ctm); break;
      case 'BT': tm = ID; tlm = ID; break;
      case 'Tf': { const f = ops[ops.length - 2]; font = isName(f) ? fonts.get(f.n) : undefined; size = num(1); break; }
      case 'TL': leading = num(1); break;
      case 'Tc': cs = num(1); break;
      case 'Tw': wsp = num(1); break;
      case 'Tz': hs = num(1) / 100; break;
      case 'Ts': rise = num(1); break;
      case 'Td': tlm = mul([1, 0, 0, 1, num(2), num(1)], tlm); tm = tlm; break;
      case 'TD': leading = -num(1); tlm = mul([1, 0, 0, 1, num(2), num(1)], tlm); tm = tlm; break;
      case 'Tm': tlm = [num(6), num(5), num(4), num(3), num(2), num(1)]; tm = tlm; break;
      case 'T*': tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm; break;
      case 'Tj': { const s = ops[ops.length - 1]; if (isStr(s)) show(s.s); break; }
      case "'": { tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm; const s = ops[ops.length - 1]; if (isStr(s)) show(s.s); break; }
      case '"': { wsp = num(3); cs = num(2); tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm; const s = ops[ops.length - 1]; if (isStr(s)) show(s.s); break; }
      case 'TJ': {
        const arr = ops[ops.length - 1];
        if (Array.isArray(arr)) {
          for (const el of arr) {
            if (isStr(el)) show(el.s);
            else if (typeof el === 'number') tm = mul([1, 0, 0, 1, (-el / 1000) * size * hs, 0], tm);
          }
        }
        break;
      }
      case 'Do': {
        const n = ops[ops.length - 1];
        if (isName(n) && depth < 4) {
          const x = xobjects(n.n);
          if (x) items.push(...runContent(x.data, x.fonts, xobjects, depth + 1, mul(x.matrix, ctm)));
        }
        break;
      }
      case 'BI': {
        // Ενσωματωμένη εικόνα: προσπερνάμε τα bytes μέχρι το EI.
        const rest = latin1(data, lx.pos);
        const k = rest.search(/\sEI(\s|$)/);
        lx.pos = k < 0 ? data.length : lx.pos + k + 3;
        break;
      }
      default: break;
    }
    ops.length = 0;
  }
  return items;
}

/** Γραμμές από κομμάτια: ίδιο ύψος, κατά x. Μεγάλο κενό γίνεται tab (στήλη). */
function toLines(items: Item[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Item[][] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - it.y) <= Math.max(1.5, row[0].size * 0.35)) row.push(it);
    else rows.push([it]);
  }
  return rows.map(row => {
    row.sort((a, b) => a.x - b.x);
    let out = '', prevEnd = -Infinity;
    for (const it of row) {
      const gap = it.x - prevEnd;
      if (out) {
        if (gap > it.size * 1.4) out += '\t';
        else if (gap > it.size * 0.18 && !out.endsWith(' ') && !it.text.startsWith(' ')) out += ' ';
      }
      out += it.text;
      prevEnd = Math.max(prevEnd, it.end);
    }
    return out.replace(/[ ]+\t/g, '\t').replace(/\t[ ]+/g, '\t').replace(/[ ]{2,}/g, ' ').trim();
  }).filter(Boolean);
}

/** Το κείμενο ενός PDF, γραμμή προς γραμμή. */
export function extractPdfText(bytes: Uint8Array): PdfTextResult {
  if (latin1(bytes, 0, Math.min(bytes.length, 1024)).indexOf('%PDF') < 0) return { lines: [], pages: 0, failure: 'not_pdf' };
  const { objs, trailer } = readObjects(bytes);
  const get = (v: PdfVal | undefined, hop = 0): PdfVal | undefined => (isRef(v) && hop < 32 ? get(objs.get(v.ref)?.val, hop + 1) : v);
  const getObj = (v: PdfVal | undefined): PdfObject | undefined => (isRef(v) ? objs.get(v.ref) : undefined);
  if (trailer.Encrypt) return { lines: [], pages: 0, failure: 'encrypted' };
  expandObjectStreams(objs, get);

  // Οι σελίδες με τη σειρά του δέντρου· αν λείπει ρίζα, με τη σειρά του αρχείου.
  const pages: PdfDict[] = [];
  const walk = (node: PdfVal | undefined, inherited: PdfVal | undefined, seen: Set<PdfDict>) => {
    const d = get(node);
    if (!isDict(d) || seen.has(d)) return;
    seen.add(d);
    const res = d.Resources ?? inherited;
    const type = isName(d.Type) ? d.Type.n : '';
    if (type === 'Pages' || Array.isArray(get(d.Kids))) {
      for (const k of (get(d.Kids) as PdfVal[] | undefined) ?? []) walk(k, res, seen);
    } else if (type === 'Page' || d.Contents) {
      pages.push(res && !d.Resources ? { ...d, Resources: res } : d);
    }
  };
  const root = get(trailer.Root);
  if (isDict(root)) walk(root.Pages, undefined, new Set());
  if (!pages.length) {
    for (const o of objs.values()) if (isDict(o.val) && isName(o.val.Type) && o.val.Type.n === 'Page') pages.push(o.val);
  }

  const fontCache = new Map<PdfDict, Font>();
  const fontsOf = (resources: PdfVal | undefined): Map<string, Font> => {
    const map = new Map<string, Font>();
    const res = get(resources);
    const fd = isDict(res) ? get(res.Font) : undefined;
    if (isDict(fd)) {
      for (const [name, ref] of Object.entries(fd)) {
        const f = get(ref);
        if (!isDict(f)) continue;
        let font = fontCache.get(f);
        if (!font) { font = loadFont(f, get, getObj); fontCache.set(f, font); }
        map.set(name, font);
      }
    }
    return map;
  };

  const lines: string[] = [];
  for (const page of pages) {
    const fonts = fontsOf(page.Resources);
    const res = get(page.Resources);
    const xo = isDict(res) ? get(res.XObject) : undefined;
    const xobjects = (name: string) => {
      if (!isDict(xo)) return null;
      const o = getObj(xo[name]);
      if (!o || !isDict(o.val) || !isName(o.val.Subtype) || o.val.Subtype.n !== 'Form') return null;
      const data = decodeStream(o, get);
      if (!data) return null;
      const m = get(o.val.Matrix);
      const matrix: M = Array.isArray(m) && m.length === 6 ? (m.map(x => Number(get(x)) || 0) as M) : ID;
      const own = fontsOf(o.val.Resources);
      return { data, fonts: own.size ? own : fonts, matrix };
    };
    const contents = get(page.Contents);
    const parts = Array.isArray(contents) ? contents : [page.Contents];
    const chunks: Uint8Array[] = [];
    for (const p of parts) {
      const o = getObj(p);
      const data = o ? decodeStream(o, get) : null;
      if (data) chunks.push(data, Uint8Array.of(0x0a));
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const joined = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { joined.set(c, at); at += c.length; }
    lines.push(...toLines(runContent(joined, fonts, xobjects)));
  }
  if (!lines.length) return { lines: [], pages: pages.length, failure: 'no_text' };
  return { lines, pages: pages.length, failure: null };
}
