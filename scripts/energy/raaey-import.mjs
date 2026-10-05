#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΠΙΝΑΚΕΣ ΤΗΣ ΡΑΑΕΥ, ΑΠΟ ΤΟ EXCEL ΣΤΟ data/
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  node scripts/energy/raaey-import.mjs <αρχείο.xlsx> <ΕΕΕΕ-ΜΜ> <ΕΕΕΕ-ΜΜ-ΗΗ>
//         (μήνας δεδομένων, ημέρα ανάγνωσης)
//
// Γράφει το data/raaey/energycost-<μήνας>.json: κάθε γραμμή των τεσσάρων
// πινάκων (ρεύμα και αέριο, οικιακό και επαγγελματικό) με τον αριθμό της
// γραμμής του φύλλου και κάθε κελί ΑΥΤΟΥΣΙΟ, ως κείμενο. Τίποτα δεν
// ερμηνεύεται εδώ: «0KWh - 100KWh / 0.179 101KWh + / 0.339» μένει όπως είναι
// και το διαβάζει το lib/energy/raaey.ts, που έχει δοκιμές.
//
// ΤΟ EXCEL ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟ ΑΠΟΘΕΤΗΡΙΟ. Η μεταγραφή μπαίνει: διαβάζεται σε
// διαφορικό, ελέγχεται από δοκιμή και δεν σερβίρεται από το site.
//
// Χωρίς βιβλιοθήκη: το xlsx είναι zip με XML μέσα. Ο αναγνώστης του zip είναι
// είκοσι γραμμές πάνω στο zlib της Node.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const [file, month, readAt] = process.argv.slice(2);
if (!file || !/^\d{4}-\d{2}$/.test(month ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(readAt ?? '')) {
  console.error('Χρήση: node scripts/energy/raaey-import.mjs <αρχείο.xlsx> <ΕΕΕΕ-ΜΜ> <ΕΕΕΕ-ΜΜ-ΗΗ>');
  process.exit(2);
}

/** Τα αρχεία του zip, από τον κεντρικό κατάλογο στο τέλος του. */
function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Δεν είναι αρχείο zip.');
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    out[name] = (method === 8 ? inflateRawSync(raw) : raw).toString('utf8');
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = s => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => XML_ENT[e]).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
// Το κελί του Excel κρατά ό,τι είχε η σελίδα της ΡΑΑΕΥ, μαζί με οντότητες
// HTML που γράφτηκαν ως κείμενο («&gt; 25 kVA»). Ξεκλειδώνονται εδώ, μία φορά.
const unhtml = s => s.replace(/&(amp|lt|gt|quot);/g, (_, e) => XML_ENT[e]);
const text = x => unxml([...x.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''));

const files = unzip(readFileSync(file));
const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => text(m[1]));
// Τα γνωρίσματα ενός στοιχείου XML δεν έχουν σειρά: διαβάζονται με το όνομά τους.
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const rels = Object.fromEntries([...files['xl/_rels/workbook.xml.rels'].matchAll(/<Relationship\b[^>]*>/g)].map(([t]) => [attr(t, 'Id'), attr(t, 'Target')]));
const sheets = [...files['xl/workbook.xml'].matchAll(/<sheet\b[^>]*>/g)].map(([t]) => ({ name: unxml(attr(t, 'name')), path: `xl/${rels[attr(t, 'r:id')].replace(/^\/?xl\//, '')}` }));

const col = ref => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
function rows(xml) {
  const out = [];
  for (const r of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const c of r[2].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+\d+)"/.exec(c[1])[1], t = /t="([^"]+)"/.exec(c[1])?.[1], body = c[2] ?? '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      cells[col(ref)] = t === 's' ? shared[Number(v)] : t === 'inlineStr' ? text(body) : v == null ? '' : unxml(v);
    }
    out.push({ row: Number(r[1]), cells: Array.from(cells, x => unhtml(x ?? '')) });
  }
  return out;
}

// Τα τέσσερα φύλλα, με κλειδί που δεν εξαρτάται από τα ελληνικά του τίτλου.
const KEYS = {
  'Ρεύμα Οικιακό': 'power-residential',
  'Ρεύμα Επαγγελματικό': 'power-business',
  'Αέριο Οικιακό': 'gas-residential',
  'Αέριο Επαγγελματικό': 'gas-business',
};
const HEAD = ['Πάροχος', 'Έτος', 'Μήνας', 'Ονομασία Τιμολογίου', 'Πάγιο (€/μήνα)', 'Τελική Τιμή Προμήθειας (€/ΚWh)',
  'Πάγιο με Έκπτωση με προϋπόθεση (€/μήνα)', 'Προϋπόθεση Έκπτωσης Παγίου', 'Τελική Τιμή Προμήθειας με Έκπτωση με προϋπόθεση (€/ΚWh)',
  'Προϋπόθεση Έκπτωσης Βασικής Τιμής Προμήθειας', 'Διάρκεια Σύμβασης', 'Παρατηρήσεις', 'Χρώμα'];
const FIELDS = ['provider', 'year', 'month', 'name', 'fixed', 'price', 'fixedDiscounted', 'fixedCondition', 'priceDiscounted', 'priceCondition', 'duration', 'notes', 'colour'];

const summary = rows(files[sheets.find(s => s.name === 'Σύνοψη').path]);
const out = {
  source: 'ΡΑΑΕΥ, energycost.gr',
  note: summary[0].cells[0],
  month,
  readAt,
  sheets: {},
};
for (const s of sheets) {
  const key = KEYS[s.name];
  if (!key) continue;
  const [head, ...body] = rows(files[s.path]);
  if (JSON.stringify(head.cells.slice(0, HEAD.length)) !== JSON.stringify(HEAD)) throw new Error(`Το φύλλο «${s.name}» άλλαξε στήλες.`);
  const url = summary.find(r => r.cells[0] === s.name)?.cells[4] ?? '';
  out.sheets[key] = {
    title: s.name,
    url,
    rows: body.map(r => ({ row: r.row, ...Object.fromEntries(FIELDS.map((f, i) => [f, (r.cells[i] ?? '').trim()])) })),
  };
  const bad = out.sheets[key].rows.filter(r => `${r.year}-${r.month.padStart(2, '0')}` !== month);
  if (bad.length) throw new Error(`Το φύλλο «${s.name}» έχει γραμμές άλλου μήνα: ${bad.map(r => r.row).join(', ')}`);
}
mkdirSync('data/raaey', { recursive: true });
const path = `data/raaey/energycost-${month}.json`;
writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`);
console.log(`✓ ${path}: ${Object.entries(out.sheets).map(([k, v]) => `${k} ${v.rows.length}`).join(', ')}`);

// ── ΤΟ ΑΝΤΙΓΡΑΦΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ─────────────────────────────────────────
// Η οθόνη δεν διαβάζει JSON από το data/ (δεν σερβίρεται και δεν πρέπει να
// μπει στο πακέτο του περιηγητή ολόκληρο). Παίρνει τα κελιά που χρειάζεται,
// χωρίς τις Παρατηρήσεις, που είναι το μισό μέγεθος· από αυτές κρατά μόνο αν
// το τιμολόγιο είναι μη εμπορικά διαθέσιμο. Το raaey.test.ts ελέγχει ότι τα
// δύο αρχεία λένε το ίδιο.
//
// JSON και όχι .ts: τα κελιά μένουν ΑΥΤΟΥΣΙΑ, με το «&» και το «ακόμα» της
// ΡΑΑΕΥ. Είναι πηγή, όχι κείμενο οθόνης· ό,τι φτάνει στην οθόνη περνά από το
// raaeyText (lib/energy/raaey.ts) και από τους φύλακες του κειμένου.
const KEEP = ['row', 'provider', 'name', 'fixed', 'price', 'fixedDiscounted', 'fixedCondition', 'priceDiscounted', 'priceCondition', 'duration', 'colour'];
const compact = Object.fromEntries(Object.entries(out.sheets).map(([k, v]) => [k, v.rows.map(r => [...KEEP.map(f => r[f]), /μη εμπορικά διαθέσιμο/i.test(r.notes) ? 1 : 0])]));
const app = {
  _source: `ΠΑΡΑΓΕΤΑΙ από το scripts/energy/raaey-import.mjs, από το ${path}. Μην το διορθώνεις με το χέρι.`,
  month,
  readAt,
  urls: Object.fromEntries(Object.entries(out.sheets).map(([k, v]) => [k, v.url])),
  columns: KEEP,
  // Οι σημειώσεις της ΡΑΑΕΥ για το αέριο: είναι η περιγραφή του τιμολογίου
  // στον κατάλογο του αερίου («Αφορά Οικιακές Αυτόνομες Συνδέσεις»).
  gasNotes: Object.fromEntries(Object.entries(out.sheets).filter(([k]) => k.startsWith('gas-')).flatMap(([k, v]) => v.rows.filter(r => r.notes).map(r => [`${k}:${r.row}`, r.notes]))),
  rows: compact,
};
const json = `{\n${Object.entries(app).map(([k, v]) => k === 'rows'
  ? ` "rows": {\n${Object.entries(v).map(([s, rs]) => `  ${JSON.stringify(s)}: [\n${rs.map(r => `   ${JSON.stringify(r)}`).join(',\n')}\n  ]`).join(',\n')}\n }`
  : ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`;
JSON.parse(json);
writeFileSync('lib/energy/raaeyData.json', json);
console.log(`✓ lib/energy/raaeyData.json: ${(json.length / 1024).toFixed(0)} KB`);
