// npx tsx app/ypologismos-stegastikou-daneiou/faq.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ ΣΤΕΓΑΣΤΙΚΟΥ ΑΠΑΝΤΑ «ΠΟΤΕ ΑΝΟΙΓΕΙ ΤΟ ΣΠΙΤΙ ΜΟΥ ΙΙΙ;»
// ─────────────────────────────────────────────────────────────────────────
// Οι Συχνές ερωτήσεις ρωτούσαν μόνο για το ΙΙ, ενώ ο κόσμος ψάχνει «Σπίτι μου 3»
// και την απάντηση τη βρίσκει στον Τύπο, με όρια σαν να ήταν κλειδωμένα. Η
// απάντηση πρέπει να είναι η ίδια πρόταση με του καταλόγου και της Νόας: στη
// σελίδα και στο FAQPage που διαβάζει η μηχανή αναζήτησης.
//
// Χωρίς μεταβλητές της βάσης η σελίδα αποδίδεται χωρίς τιμές αγοράς (NO_MARKET):
// οι Συχνές ερωτήσεις δεν εξαρτώνται από αυτές.
// ═══════════════════════════════════════════════════════════════════════════
import { renderToStaticMarkup } from 'react-dom/server';
import { SPITI_MOU_3, spitiMou3Line } from '@/lib/loans/recommend';
import Page from './page';

let pass = 0; const fail: string[] = [];
const ok = (what: string, cond: boolean) => { if (cond) pass++; else fail.push(what); };

const plain = (s: string) => s.replace(/[­⁠]/g, '');
const ENTITY: Record<string, string> = { amp: '&', quot: '"', '#x27': "'", lt: '<', gt: '>' };
const unescape = (s: string) => s.replace(/&(amp|quot|#x27|lt|gt);/g, (_, e: string) => ENTITY[e]);

type Q = { '@type': string; name: string; acceptedAnswer: { text: string } };

(async () => {
  const html = plain(renderToStaticMarkup(await Page()));
  const q = `Πότε ανοίγει το «${SPITI_MOU_3.name}»;`;
  ok('η ερώτηση στις Συχνές ερωτήσεις της σελίδας', unescape(html).includes(q));
  ok('...με την πρόταση της σταθεράς', unescape(html).includes(spitiMou3Line()));

  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => JSON.parse(unescape(m[1])) as { '@graph'?: { '@type': string; mainEntity?: Q[] }[] });
  const faq = ld.flatMap(x => x['@graph'] ?? []).find(n => n['@type'] === 'FAQPage');
  const item = faq?.mainEntity?.find(e => e.name === q);
  ok('η ίδια ερώτηση στο FAQPage', !!item);
  ok('...με απάντηση από την spitiMou3Line', !!item && item.acceptedAnswer.text.startsWith(spitiMou3Line()));
  ok('...χωρίς όρια ή όφελος του Τύπου', !!item && !/€|%|άτοκ|επιδότ|230\.000|300\.000/.test(item.acceptedAnswer.text));

  if (fail.length) { console.error(`\n✗ stegastiko faq: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1); }
  console.log(`✓ stegastiko faq: ${pass} έλεγχοι πέρασαν`);
})();
