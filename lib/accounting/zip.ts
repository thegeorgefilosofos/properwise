// ═══════════════════════════════════════════════════════════════════════════
// ΕΝΑΣ ΦΑΚΕΛΟΣ, ΟΧΙ ΕΝΝΙΑ ΑΡΧΕΙΑ.
//
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
// Ο λογιστής δεν θέλει επτά συνημμένα με ονόματα «export(3).xlsx». Θέλει έναν
// φάκελο που ανοίγει και ξέρει πού είναι το καθετί. Ο φάκελος στα Windows, στο
// macOS και στο Gmail είναι το ΖΙΡ — δεν υπάρχει άλλη κοινή γλώσσα.
//
// ΓΙΑΤΙ ΓΡΑΜΜΕΝΟ ΜΕ ΤΟ ΧΕΡΙ ΚΑΙ ΟΧΙ ΒΙΒΛΙΟΘΗΚΗ
// Το project δεν έχει εξάρτηση συμπίεσης και δεν αξίζει να αποκτήσει μία (και
// ~100KB javascript στον browser του χρήστη) για κάτι που είναι εκατό γραμμές:
// αποθήκευση ΧΩΡΙΣ συμπίεση (μέθοδος 0). Τα .xlsx μέσα είναι ήδη συμπιεσμένα,
// άρα η συμπίεση δεν θα κέρδιζε ουσιαστικά τίποτα.
//
// ΤΙ ΠΡΟΣΕΧΕΙ
//   • UTF-8 σημαία (bit 11). Χωρίς αυτήν τα ελληνικά ονόματα φακέλων γίνονται
//     «05_ÔÉ_ËÅÉÐÅÉ» στα Windows. Ο λογιστής θα το άνοιγε στα Windows.
//   • Οι υποφάκελοι δηλώνονται ΚΑΙ ρητά (εγγραφές που λήγουν σε «/»), γιατί
//     κάποιοι παλιοί extractors δεν τους δημιουργούν μόνοι τους από τη διαδρομή.
//   • Σταθερή ημερομηνία ανά κλήση: το ίδιο περιεχόμενο δίνει το ίδιο αρχείο.
// ═══════════════════════════════════════════════════════════════════════════

/** Πίνακας CRC-32 (πολυώνυμο 0xEDB88320) — χτίζεται μία φορά. */
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

/** CRC-32 του περιεχομένου, όπως το απαιτεί η προδιαγραφή του ZIP. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipFile {
  /** Διαδρομή μέσα στον φάκελο, π.χ. `02_ΕΣΟΔΑ/Εσοδα_2026.csv`. */
  path: string;
  /** Κείμενο (κωδικοποιείται UTF-8) ή έτοιμα bytes (π.χ. .xlsx). */
  data: Uint8Array | string;
}

const enc = new TextEncoder();
const bytesOf = (d: Uint8Array | string): Uint8Array => (typeof d === 'string' ? enc.encode(d) : d);

/** Ημερομηνία/ώρα σε μορφή MS-DOS, όπως τη γράφει το ZIP (2 δευτερόλεπτα ανάλυση). */
function dosStamp(d: Date): { time: number; date: number } {
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time, date };
}

/** Μικρός συσσωρευτής bytes με little-endian εγγραφές — ό,τι ακριβώς θέλει το ZIP. */
class Buf {
  private parts: Uint8Array[] = [];
  private len = 0;
  get length(): number { return this.len; }
  push(b: Uint8Array): void { this.parts.push(b); this.len += b.length; }
  u16(n: number): void { this.push(new Uint8Array([n & 0xff, (n >>> 8) & 0xff])); }
  u32(n: number): void { this.push(new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff])); }
  // ΤΟ `<ArrayBuffer>` ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΣΗ. Ο σκέτος `Uint8Array` σημαίνει
  // `Uint8Array<ArrayBufferLike>`, δηλαδή «ίσως και SharedArrayBuffer» — και ο
  // κατασκευαστής του `Blob` δεν δέχεται μοιραζόμενη μνήμη. Ο καλών το έλυνε με
  // `as unknown as BlobPart`, δηλαδή έσβηνε τον έλεγχο αντί να τον ικανοποιήσει.
  // Εδώ η μνήμη ΕΙΝΑΙ πάντα απλή: το `new Uint8Array(n)` δεσμεύει `ArrayBuffer`.
  // Ο τύπος το λέει και το cast στον καλούντα φεύγει.
  merge(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(this.len);
    let at = 0;
    for (const p of this.parts) { out.set(p, at); at += p.length; }
    return out;
  }
}

/**
 * Ο φάκελος, ως bytes.
 *
 * Οι υποφάκελοι προκύπτουν από τις διαδρομές: `02_ΕΣΟΔΑ/Εσοδα.csv` φτιάχνει τον
 * `02_ΕΣΟΔΑ`. Η σειρά των εγγραφών διατηρείται, γιατί οι περισσότεροι
 * extractors δείχνουν με αυτή τη σειρά και η αρίθμηση 01..05 πρέπει να διαβαστεί
 * από πάνω προς τα κάτω.
 */
export function buildZip(files: readonly ZipFile[], now: Date = new Date()): Uint8Array<ArrayBuffer> {
  const { time, date } = dosStamp(now);

  type Entry = { name: Uint8Array; body: Uint8Array; crc: number; offset: number; dir: boolean };
  const entries: Entry[] = [];
  const body = new Buf();

  const write = (path: string, data: Uint8Array, isDir: boolean) => {
    const name = enc.encode(path);
    const crc = isDir ? 0 : crc32(data);
    const offset = body.length;
    body.u32(0x04034b50);            // υπογραφή τοπικής κεφαλίδας
    body.u16(20);                    // απαιτούμενη έκδοση (2.0)
    body.u16(0x0800);                // σημαίες: bit 11 = ονόματα σε UTF-8
    body.u16(0);                     // μέθοδος 0 = αποθήκευση, χωρίς συμπίεση
    body.u16(time); body.u16(date);
    body.u32(crc); body.u32(data.length); body.u32(data.length);
    body.u16(name.length); body.u16(0);
    body.push(name);
    if (data.length) body.push(data);
    entries.push({ name, body: data, crc, offset, dir: isDir });
  };

  // Ο φάκελος γράφεται ΑΚΡΙΒΩΣ με τη σειρά που δόθηκε και κάθε υποφάκελος
  // δηλώνεται λίγο πριν το πρώτο του αρχείο — ώστε ο κατάλογος να διαβάζεται
  // 00, 01, 02… από πάνω προς τα κάτω, όπως γράφτηκε.
  const seen = new Set<string>();
  for (const f of files) {
    const parts = f.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/') + '/';
      if (!seen.has(dir)) { seen.add(dir); write(dir, new Uint8Array(0), true); }
    }
    write(f.path, bytesOf(f.data), false);
  }

  // ── Κεντρικός κατάλογος ──────────────────────────────────────────────────
  const central = new Buf();
  for (const e of entries) {
    central.u32(0x02014b50);
    central.u16(20);                 // έκδοση δημιουργού
    central.u16(20);                 // απαιτούμενη έκδοση
    central.u16(0x0800);
    central.u16(0);
    central.u16(time); central.u16(date);
    central.u32(e.crc); central.u32(e.body.length); central.u32(e.body.length);
    central.u16(e.name.length); central.u16(0); central.u16(0);
    central.u16(0); central.u16(0);
    // Εξωτερικά χαρακτηριστικά: 0x10 = φάκελος (MS-DOS directory bit).
    central.u32(e.dir ? 0x10 : 0);
    central.u32(e.offset);
    central.push(e.name);
  }

  const out = new Buf();
  const bodyBytes = body.merge();
  const centralBytes = central.merge();
  out.push(bodyBytes);
  out.push(centralBytes);
  out.u32(0x06054b50);               // τέλος κεντρικού καταλόγου
  out.u16(0); out.u16(0);
  out.u16(entries.length); out.u16(entries.length);
  out.u32(centralBytes.length); out.u32(bodyBytes.length);
  out.u16(0);
  return out.merge();
}

/**
 * ΕΝΑ ΑΡΧΕΙΟ ΑΠΟ ΦΑΚΕΛΟ ΠΟΥ ΕΓΡΑΨΕ Η `buildZip`.
 *
 * Ο λογιστής θέλει συχνά μόνο το φύλλο κωδικών, όχι όλο τον φάκελο με τα
 * παραστατικά. Ο φάκελος όμως είναι αυτός που ΕΣΤΕΙΛΕ ο πελάτης και ο χώρος
 * του λογιστή δεν φτιάχνει δικό του από τα δεδομένα του πελάτη. Οπότε το φύλλο
 * βγαίνει από το ίδιο zip, εδώ, στον περιηγητή.
 *
 * ΜΟΝΟ ΑΠΟΘΗΚΕΥΣΗ (μέθοδος 0), όπως γράφει η `buildZip`. Ένα συμπιεσμένο
 * αρχείο δεν διαβάζεται εδώ και επιστρέφει `null`, όπως και ένα αρχείο που
 * λείπει ή που χάλασε (λάθος CRC): «δεν το βρήκα» και ποτέ μισά bytes.
 */
export function readZipEntry(zip: Uint8Array, path: string): Uint8Array | null {
  const u16 = (at: number) => zip[at] | (zip[at + 1] << 8);
  const u32 = (at: number) => (zip[at] | (zip[at + 1] << 8) | (zip[at + 2] << 16) | (zip[at + 3] << 24)) >>> 0;
  // Το τέλος του κεντρικού καταλόγου: 22 bytes, ίσως με σχόλιο ως 64KB.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (u32(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = u16(eocd + 10);
  let at = u32(eocd + 16);
  const want = enc.encode(path);
  const dec = (a: number, n: number) => zip.subarray(a, a + n);
  for (let k = 0; k < count && at + 46 <= zip.length; k++) {
    if (u32(at) !== 0x02014b50) return null;
    const method = u16(at + 10);
    const crc = u32(at + 16);
    const size = u32(at + 20);
    const nameLen = u16(at + 28), extraLen = u16(at + 30), commentLen = u16(at + 32);
    const local = u32(at + 42);
    const name = dec(at + 46, nameLen);
    if (name.length === want.length && name.every((b, i) => b === want[i])) {
      if (method !== 0 || u32(local) !== 0x04034b50) return null;
      const start = local + 30 + u16(local + 26) + u16(local + 28);
      if (start + size > zip.length) return null;
      const body = zip.slice(start, start + size);
      return crc32(body) === crc ? body : null;
    }
    at += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
