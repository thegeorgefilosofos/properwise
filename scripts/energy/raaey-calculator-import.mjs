#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΡΙΘΜΟΜΗΧΑΝΗ ΤΗΣ ΡΑΑΕΥ ΩΣ ΜΕΡΙΚΗ ΕΝΗΜΕΡΩΣΗ ΜΗΝΑ
// ─────────────────────────────────────────────────────────────────────────
// ΧΡΗΣΗ:  node scripts/energy/raaey-calculator-import.mjs <φάκελος> <ΕΕΕΕ-ΜΜ> <ΕΕΕΕ-ΜΜ-ΗΗ>
//         π.χ. data/raaey/calculator-2026-11 2026-11 2026-11-09
//
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Τον Νοέμβριο 2026 ο ιδιοκτήτης δεν είχε το Excel των τεσσάρων
// πινάκων. Επικόλλησε την αριθμομηχανή «Το φθηνότερο τιμολόγιο για εμένα» του
// energycost.gr για 330 kWh: ρεύμα και αέριο, οικιακό και επαγγελματικό, η
// καθεμιά με και χωρίς το φίλτρο «Έκπτωση με Προϋποθέσεις». Οι οκτώ
// επικολλήσεις ζουν αυτούσιες στον φάκελο, με όνομα <φύλλο>-<discounted|base>.txt.
//
// Η αριθμομηχανή δείχνει περίπου το ένα τρίτο των γραμμών του πλήρους πίνακα
// (όχι τα παλιά προϊόντα) και δεν έχει χρώμα. Γι' αυτό:
//   · κάθε γραμμή παίρνει αριθμό με τη σειρά της στην επικόλληση «discounted»
//   · το χρώμα έρχεται από τη γραμμή του προηγούμενου πλήρους πίνακα με τον
//     ίδιο πάροχο και το ίδιο όνομα· αλλιώς είναι ΕΚΤΙΜΗΣΗ από το όνομα και τη
//     σημείωση και το πεδίο `colourFrom` το λέει σε κάθε γραμμή
//   · η πρώτη και η δεύτερη επικόλληση ταιριάζουν με πάροχο και όνομα και κάθε
//     σύνολο «Τελική Μηνιαία Χρέωση» ξαναϋπολογίζεται από τα κελιά: αν μία
//     γραμμή διαβάστηκε στραβά, το σύνολο δεν βγαίνει και το σενάριο σταματά.
//
// Γράφει το data/raaey/energycost-<μήνας>.json (κάθε κελί) και το
// lib/energy/raaeyUpdate.json (το αντίγραφο της εφαρμογής). Ο κατάλογος
// διαβάζει τον μήνα αυτό ΠΑΝΩ από τον πλήρη πίνακα (lib/energy/raaeyCatalogue.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs';

const [dir, month, readAt] = process.argv.slice(2);
if (!dir || !/^\d{4}-\d{2}$/.test(month ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(readAt ?? '')) {
  console.error('Χρήση: node scripts/energy/raaey-calculator-import.mjs <φάκελος> <ΕΕΕΕ-ΜΜ> <ΕΕΕΕ-ΜΜ-ΗΗ>');
  process.exit(1);
}
const BASE = JSON.parse(readFileSync('data/raaey/energycost-2026-10.json', 'utf8'));
const [Y, M] = month.split('-');
const KWH = 330;
/** Το όνομα χωρίς αριθμό έκδοσης: «Value Standard 2.0» → «value standard». */
const stem = n => n.replace(/^(Protergia )?Επαγγελματικό \d( & \d)? /i, '').replace(/ (for )?business( \d+)?$/i, '').replace(/[_\s]v\d+$/i, '').replace(/\s+\d+(\.\d+)?(?=\s|$)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const UNKNOWN = /^Η τιμή δεν είναι ακόμ[αη] γνωστή$/;
const NIGHT = 'Τελική Τιμή Προμήθειας Διζωνικής Κατανάλωσης';
const isNum = s => /^\d+(\.\d+)?$/.test(s);
const isValue = s => isNum(s) || UNKNOWN.test(s);
const isDuration = s => /^Αορίστου/.test(s) || (/^\d{1,2}$/.test(s) && Number(s) > 0);
const isTierHead = s => /^\d+KWh - \d+KWh$/.test(s);
const isTierLabel = s => /^\d+KWh \+$/.test(s);
const isTierText = s => /^Εάν η κατανάλωση υπερβεί/.test(s) || /^> \d+KWh: /.test(s);

/** Τα μπλοκ γραμμών του πίνακα της επικόλλησης. */
function blocks(text) {
  const L = text.split('\n');
  const h = L.findIndex(l => l.startsWith('Πάροχος\t'));
  if (h < 0) throw new Error('Δεν βρέθηκε η κεφαλίδα του πίνακα.');
  const head = L[h].split('\t');
  const out = [];
  let cur = null;
  for (const l of L.slice(h + 1)) {
    if (/^Όλες οι αναρτημένες/.test(l)) break;
    if (/^[^\t]+\t\d{4}\t\d{1,2}\t/.test(l)) { cur = [l]; out.push(cur); } else if (cur) cur.push(l);
  }
  return { head, rows: out.map(b => { while (b.length && b[b.length - 1].trim() === '') b.pop(); return b; }) };
}

/**
 * Ένα κελί τιμής ή παγίου: κλίμακες «0KWh - 150KWh / 0.139 151KWh + / 0.139»,
 * νύχτα « Τελική Τιμή … Κατανάλωσης / 0.149», όπως τα γράφει ο πλήρης πίνακας.
 */
function takePrice(t, i) {
  const parts = [];
  if (isTierHead(t[i])) {
    if (!isValue(t[i + 1])) throw new Error(`κλίμακα χωρίς τιμή: ${t.slice(i, i + 3).join(' | ')}`);
    parts.push(`${t[i]} / ${t[i + 1]}`); i += 2;
    for (;;) {
      if (isTierLabel(t[i]) && isValue(t[i + 1])) { parts.push(`${t[i]} / ${t[i + 1]}`); i += 2; }
      else if (isTierText(t[i] ?? '')) { parts.push(t[i]); i += 1; }
      else break;
    }
  } else if (isValue(t[i])) { parts.push(t[i]); i += 1; }
  else throw new Error(`αναμενόταν τιμή, βρέθηκε «${t[i]}»`);
  if (t[i] === NIGHT) {
    if (!isValue(t[i + 1])) throw new Error('νυχτερινή χωρίς τιμή');
    parts.push(`${NIGHT} / ${t[i + 1]}`); i += 2;
  }
  return [parts.join(' '), i];
}

/**
 * Μία γραμμή. Με «discounted» οι στήλες είναι πάγιο, προϋπόθεση παγίου, τιμή,
 * προϋπόθεση τιμής, διάρκεια, σημείωση, σύνολο· με «base» πάγιο, τιμή,
 * διάρκεια, σημείωση, σύνολο. Οι γραμμές χωρίς πολλαπλές γραμμές κελιού
 * διαβάζονται θέση προς θέση. Στις άλλες η επικόλληση χάνει τα κενά κελιά
 * και τα όρια των κελιών, οπότε διαβάζονται με τη μορφή κάθε κελιού: τιμή,
 * κλίμακα, διάρκεια· ό,τι κείμενο είναι πριν από την τιμή είναι προϋπόθεση
 * παγίου, ό,τι είναι μετά και πριν από τη διάρκεια προϋπόθεση τιμής, ό,τι
 * μετά τη διάρκεια σημείωση.
 */
function parseRow(block, view, ncol) {
  const first = block[0].split('\t');
  const [provider, year, mon, rawName] = first;
  const name = rawName.replace(/\\'/g, '\'').trim();
  if (block.length === 1 && first.length === ncol) {
    const c = first.slice(4);
    return view === 'discounted'
      ? { provider, year, month: mon, name, fixedDiscounted: c[0], fixedCondition: c[1], priceDiscounted: c[2], priceCondition: c[3], duration: c[4], notes: c[5], total: c[6] }
      : { provider, year, month: mon, name, fixed: c[0], price: c[1], duration: c[2], notes: c[3], total: c[4] };
  }
  const t = [...first.slice(4), ...block.slice(1)].join('\t').split(/\t|\n/).map(s => s.trim()).filter(s => s !== '');
  let i = 0;
  const [fixed, a] = takePrice(t, i); i = a;
  const cond1 = [];
  if (view === 'discounted') while (!(isValue(t[i]) || isTierHead(t[i])) || (t[i] === '0' && (isValue(t[i + 1]) || isTierHead(t[i + 1])))) cond1.push(t[i++]);
  const [price, b] = takePrice(t, i); i = b;
  const cond2 = [];
  while (i < t.length && !isDuration(t[i])) cond2.push(t[i++]);
  if (view === 'base' && cond2.length) throw new Error(`κείμενο πριν από τη διάρκεια χωρίς στήλη προϋπόθεσης: ${cond2.join(' | ')}`);
  const duration = t[i++];
  const total = t[t.length - 1];
  const notes = t.slice(i, t.length - 1).join(' ');
  if (!duration || !isDuration(duration)) throw new Error(`διάρκεια που δεν βρέθηκε: ${t.join(' | ')}`);
  return view === 'discounted'
    ? { provider, year, month: mon, name, fixedDiscounted: fixed, fixedCondition: cond1.join(' '), priceDiscounted: price, priceCondition: cond2.join(' '), duration, notes, total }
    : { provider, year, month: mon, name, fixed, price, duration, notes, total };
}

/** Το σύνολο της στήλης «Τελική Μηνιαία Χρέωση» για 330 kWh, από τα κελιά. `null`: δεν υπολογίζεται εδώ. */
function total(fixedText, priceText) {
  const ft = /^0KWh - (\d+)KWh \/ (\S+) (\d+)KWh \+ \/ (\S+)$/.exec(fixedText);
  const fixed = ft ? (KWH > Number(ft[1]) ? Number(ft[4]) : Number(ft[2])) : Number(fixedText);
  let p = priceText.split(` ${NIGHT}`)[0];
  if (isNum(p)) return fixed + KWH * Number(p);
  const above = /^0KWh - (\d+)KWh \/ (\S+) (\d+)KWh \+ \/ (\S+)$/.exec(p);
  if (above && isNum(above[2]) && isNum(above[4])) {
    const th = Number(above[1]);
    return fixed + Math.min(KWH, th) * Number(above[2]) + Math.max(0, KWH - th) * Number(above[4]);
  }
  const all = /^0KWh - (\d+)KWh \/ (\S+) Εάν η κατανάλωση υπερβεί τις (\d+)KWh η τιμή διαμορφώνεται σε (\S+) από την 1η KWh$/.exec(p);
  if (all) return fixed + KWH * Number(KWH > Number(all[1]) ? all[4] : all[2]);
  return null;
}

const SHEETS = ['power-residential', 'power-business', 'gas-residential', 'gas-business'];
const out = {
  source: 'ΡΑΑΕΥ, energycost.gr',
  note: `Πηγή: ΡΑΑΕΥ, energycost.gr, αριθμομηχανή «Το φθηνότερο τιμολόγιο για εμένα» για ${KWH} kWh, με και χωρίς «Έκπτωση με Προϋποθέσεις». Οκτώ επικολλήσεις του ιδιοκτήτη, ${readAt.split('-').reverse().join('/')}, αυτούσιες στο ${dir}. Μήνας δεδομένων: ${month}. ΜΕΡΙΚΟΣ ΠΙΝΑΚΑΣ: η αριθμομηχανή δεν δείχνει όλες τις γραμμές του πλήρους πίνακα και δεν δίνει χρώμα.`,
  month,
  readAt,
  scope: 'calculator',
  sheets: {},
};
const report = [];
for (const sheet of SHEETS) {
  const d = blocks(readFileSync(`${dir}/${sheet}-discounted.txt`, 'utf8'));
  const b = blocks(readFileSync(`${dir}/${sheet}-base.txt`, 'utf8'));
  const disc = d.rows.map(r => parseRow(r, 'discounted', d.head.length));
  const base = b.rows.map(r => parseRow(r, 'base', b.head.length));
  const key = r => `${r.provider}|${r.name}`;
  const dk = disc.map(key), bk = base.map(key);
  for (const [label, ks] of [['discounted', dk], ['base', bk]]) {
    const dup = ks.filter((k, i) => ks.indexOf(k) !== i);
    if (dup.length) throw new Error(`${sheet} ${label}: διπλό όνομα ${dup.join(', ')}`);
  }
  const onlyD = dk.filter(k => !bk.includes(k)), onlyB = bk.filter(k => !dk.includes(k));
  if (onlyD.length || onlyB.length) throw new Error(`${sheet}: οι δύο επικολλήσεις δεν έχουν τα ίδια τιμολόγια: ${[...onlyD, ...onlyB].join(', ')}`);
  const prev = BASE.sheets[sheet].rows;
  const rows = disc.map((r, i) => {
    const o = base.find(x => key(x) === key(r));
    if (`${r.year}-${r.month.padStart(2, '0')}` !== month || `${o.year}-${o.month.padStart(2, '0')}` !== month) throw new Error(`${sheet} ${r.name}: άλλος μήνας`);
    if (r.duration !== o.duration) throw new Error(`${sheet} ${r.name}: διάρκεια ${r.duration} ≠ ${o.duration}`);
    // Ο ΕΛΕΓΧΟΣ ΤΗΣ ΑΝΑΓΝΩΣΗΣ: το σύνολο της ΡΑΑΕΥ ξαναβγαίνει από τα κελιά.
    for (const [lab, f, p, tot] of [['με έκπτωση', r.fixedDiscounted, r.priceDiscounted, r.total], ['χωρίς έκπτωση', o.fixed, o.price, o.total]]) {
      const got = total(f, p);
      if (got == null) { if (isNum(tot)) report.push(`  ${sheet} «${r.name}» ${lab}: σύνολο ${tot} δεν ξαναϋπολογίζεται εδώ (μορφή τιμής)`); continue; }
      if (!isNum(tot) || Math.abs(got - Number(tot)) > 0.006) throw new Error(`${sheet} «${r.name}» ${lab}: σύνολο ${tot}, από τα κελιά ${got.toFixed(2)}`);
    }
    const same = prev.filter(x => x.provider === r.provider && x.name === r.name);
    const colours = [...new Set(same.map(x => x.colour))];
    // Η ΠΡΟΗΓΟΥΜΕΝΗ ΕΚΔΟΣΗ ΤΟΥ ΙΔΙΟΥ ΠΡΟΪΟΝΤΟΣ: «GasHome Win 2.0» είναι το
    // «GasHome Win» του πίνακα, «myHome4Student 08.26» το «myHome4Student».
    // Αν δεν υπάρχει στο ίδιο φύλλο, η ίδια σειρά στο άλλο τμήμα του ίδιου
    // καυσίμου: το «Επαγγελματικό 1 Value Standard 2.0» είναι το «Value Standard».
    const twin = sheet.replace(/residential|business/, m => (m === 'residential' ? 'business' : 'residential'));
    let fam = prev.filter(x => x.provider === r.provider && stem(x.name) === stem(r.name));
    if (!fam.length) fam = BASE.sheets[twin].rows.filter(x => x.provider === r.provider && stem(x.name) === stem(r.name));
    const famColours = [...new Set(fam.map(x => x.colour))];
    let colour, colourFrom;
    if (colours.length === 1) { colour = colours[0]; colourFrom = `πίνακας ${BASE.month}, γραμμή ${same.map(x => x.row).join(', ')}`; }
    else if (colours.length === 0 && famColours.length === 1) {
      colour = famColours[0];
      colourFrom = `εκτίμηση από την προηγούμενη έκδοση «${fam[0].name}» (πίνακας ${BASE.month}, ${prev.includes(fam[0]) ? '' : `φύλλο ${twin}, `}γραμμή ${fam.map(x => x.row).join(', ')})`;
    } else {
      if (colours.length > 1 || famColours.length > 1) report.push(`  ${sheet} «${r.name}»: ο πίνακας ${BASE.month} δίνει χρώματα ${[...colours, ...famColours].join('/')}`);
      const unknown = /δεν είναι ακόμ[αη] γνωστή/.test(`${r.priceDiscounted} ${o.price}`) || /ΜΤΑ|Μεσοσταθμική|ΜΤΑΗΕ|για τις καταναλώσεις [Α-Ωα-ωάέήίόύώ]+ \d{4}/.test(r.notes);
      colour = /^Ειδικό/.test(r.name) ? 'green' : unknown ? 'yellow' : 'blue';
      colourFrom = `εκτίμηση από ${/^Ειδικό/.test(r.name) ? 'το όνομα («Ειδικό»)' : unknown ? 'την τιμή ή τη σημείωση (τιμή ή έκπτωση που ορίζεται κάθε μήνα)' : 'την τιμή (γνωστή από την αρχή του μήνα)'}`;
    }
    return {
      row: i + 1, provider: r.provider, year: Y, month: String(Number(M)), name: r.name,
      fixed: o.fixed, price: o.price,
      fixedDiscounted: r.fixedDiscounted, fixedCondition: r.fixedCondition,
      priceDiscounted: r.priceDiscounted, priceCondition: r.priceCondition,
      duration: r.duration, notes: r.notes, colour, colourFrom,
      totalDiscounted: r.total, totalBase: o.total,
    };
  });
  out.sheets[sheet] = { title: `${sheet}: αριθμομηχανή`, rows };
  report.push(`${sheet}: ${rows.length} γραμμές (ο πίνακας ${BASE.month} είχε ${prev.length}), ${rows.filter(r => r.colourFrom.startsWith('εκτίμηση')).length} με χρώμα κατ' εκτίμηση`);
}
const path = `data/raaey/energycost-${month}.json`;
writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`);

// ── ΤΟ ΑΝΤΙΓΡΑΦΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ, ΟΠΩΣ ΤΟΥ raaey-import.mjs ──────────────────
const KEEP = ['row', 'provider', 'name', 'fixed', 'price', 'fixedDiscounted', 'fixedCondition', 'priceDiscounted', 'priceCondition', 'duration', 'colour'];
const app = {
  _source: `ΠΑΡΑΓΕΤΑΙ από το scripts/energy/raaey-calculator-import.mjs, από το ${path}. Μην το διορθώνεις με το χέρι.`,
  month,
  readAt,
  scope: 'calculator',
  columns: KEEP,
  gasNotes: Object.fromEntries(Object.entries(out.sheets).filter(([k]) => k.startsWith('gas-')).flatMap(([k, v]) => v.rows.filter(r => r.notes).map(r => [`${k}:${r.row}`, r.notes]))),
  rows: Object.fromEntries(Object.entries(out.sheets).map(([k, v]) => [k, v.rows.map(r => [...KEEP.map(f => r[f]), /μη εμπορικά διαθέσιμο/i.test(r.notes) ? 1 : 0])])),
};
const json = `{\n${Object.entries(app).map(([k, v]) => k === 'rows'
  ? ` "rows": {\n${Object.entries(v).map(([s, rs]) => `  ${JSON.stringify(s)}: [\n${rs.map(r => `   ${JSON.stringify(r)}`).join(',\n')}\n  ]`).join(',\n')}\n }`
  : ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`;
JSON.parse(json);
writeFileSync('lib/energy/raaeyUpdate.json', json);
console.log(`✓ ${path}\n✓ lib/energy/raaeyUpdate.json\n${report.join('\n')}`);
