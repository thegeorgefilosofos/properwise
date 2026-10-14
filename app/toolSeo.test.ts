// npx tsx app/toolSeo.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΥΟ ΣΕΛΙΔΕΣ ΥΠΟΛΟΓΙΣΤΩΝ ΟΠΩΣ ΤΙΣ ΔΙΑΒΑΖΕΙ Η ΜΗΧΑΝΗ ΑΝΑΖΗΤΗΣΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΖΗΤΗΘΗΚΕ (13.10.2026). Ο φόρος ενοικίων και ο ΕΝΦΙΑ παίρνουν επικεφαλίδα με
// τη φράση που ψάχνει ο ιδιοκτήτης και τη χρονιά, λυμένα παραδείγματα από τον
// υπολογιστή, σύνδεσμο στην ΑΑΔΕ (και σε ΦΕΚ για τα ενοίκια), την ενότητα «Πώς
// δηλώνεται στο Ε2», σχήμα συχνών ερωτήσεων μόνο με όσα απαντά η σελίδα,
// κανονική διεύθυνση, σύνδεσμο στον υπολογιστή στεγαστικού και υπογραφή
// «Ομάδα Properwise».
//
// Ο ΕΛΕΓΧΟΣ ΑΠΟΔΙΔΕΙ ΤΙΣ ΣΕΛΙΔΕΣ ΚΑΙ ΞΑΝΑΫΠΟΛΟΓΙΖΕΙ ΑΝΕΞΑΡΤΗΤΑ. Δεν εισάγει
// τίποτα από τα αρχεία που φτιάχνουν τα παραδείγματα (seo.ts, toolSeo.tsx):
// ανοίγει τον σύνδεσμο κάθε παραδείγματος όπως θα τον άνοιγε ο υπολογιστής
// (`readTool` με το SPEC του) και τρέχει την ίδια μηχανή με τη φόρμα. Αν το
// ποσό του κειμένου και το ποσό της φόρμας διαφωνήσουν, κοκκινίζει εδώ.
//
// ΚΑΝΕΝΑΣ ΣΥΝΔΕΣΜΟΣ ΣΤΟΝ ΟΔΗΓΟ ΑΜΑ. Απόφαση της 13/10/2026, ώσπου να υπογράψει
// η Legal· ελέγχεται εδώ για τις δύο σελίδες και το κοινό τους κομμάτι.
//
// Τα ποσά που ελέγχονται με τιμή είναι όσα έδωσε ο ιδιοκτήτης με την πηγή τους:
// 12.000€ ενοίκιο του 2026 → 1.710€ φόρος (κλίμακα ν.5246/2025, τεκμαρτή
// έκπτωση άρθρο 39 ΚΦΕ) και κτίριο του 1925, 80 τ.μ. → 67,20€ ΕΝΦΙΑ 2026
// (συντελεστής 0,60, άρθρο 11 ν.5219/2025). Τα υπόλοιπα συγκρίνονται με τη μηχανή.
// ═══════════════════════════════════════════════════════════════════════════
import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { siteUrl } from '@/lib/core/site';
import { athensParts, athensToday } from '@/lib/core/time';
import { fe } from '@/lib/core/format';
import { parseAmount } from '@/lib/core/greek';
import { incomeYearFor } from '@/lib/core/declarationYear';
import { readTool } from '@/lib/tools/permalink';
import { rentalIncomeTax, rentalBracketsForYear, FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';
import { presumptiveDeductionRateForYear } from '@/lib/billing/presumptive';
import { estimateENFIA, zoneKeyFromPricePerSqm, enfiaAgeCoef } from '@/lib/billing/enfia';
import { AADE_DESTINATIONS } from '@/lib/tax/aade';
import { SPEC as RENT_SPEC } from './ypologismos-forou-enoikion/spec';
import { SPEC as ENFIA_SPEC } from './ypologismos-enfia/spec';
import * as rentPage from './ypologismos-forou-enoikion/page';
import * as enfiaPage from './ypologismos-enfia/page';

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name); } };

const AUTHOR = 'Ομάδα Properwise';
const MORTGAGE = '/ypologismos-stegastikou-daneiou';
// Το πρόθεμα της διαδρομής του οδηγού ΑΜΑ: πιάνει τον οδηγό και κάθε άγκυρά του.
const AMA = '/odigos/vraxyxronia-ama';

// Ο συλλαβιστής βάζει μαλακά ενωτικά και ενωτήρες λέξεων· η σύγκριση κειμένου τα αγνοεί.
const plain = (s: string) => s.replace(/[\u00AD\u2060]/g, '');
// ΣΕ ΕΝΑ ΠΕΡΑΣΜΑ: με αλυσίδα από replace το «&amp;lt;» γινόταν «<» αντί για «&lt;»
// (CodeQL στο PR 401). Το ίδιο και για το <script>: με κάθε γραφή του, όχι μόνο πεζά.
const ENTITY: Record<string, string> = { amp: '&', quot: '"', '#x27': "'", lt: '<', gt: '>' };
const unescape = (s: string) => s.replace(/&(amp|quot|#x27|lt|gt);/g, (_, e: string) => ENTITY[e]);
const text = (html: string) =>
  unescape(plain(html.split(/<script\b[^>]*>[\s\S]*?<\/script[^>]*>/i).join(' ').split(/<[^>]+>/).join(' '))).replace(/\s+/g, ' ');
const amount = (s: string) => Math.max(0, parseAmount(s) ?? 0);
// Ο κώδικας χωρίς σχόλια: ένα ποσό σε σχόλιο τεκμηριώνει, στο κείμενο θα ήταν γραμμένο με το χέρι.
const code = (file: string) => !existsSync(file) ? '' : readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

interface Rendered { html: string; text: string; ld: { '@graph'?: Record<string, unknown>[] }[] }
function render(el: Parameters<typeof renderToStaticMarkup>[0]): Rendered {
  const html = renderToStaticMarkup(el);
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  return { html, text: text(html), ld };
}

/** Οι κοινοί κανόνες των δύο σελίδων. */
function common(name: string, page: Rendered, path: string, meta: Meta) {
  const h1s = page.html.match(/<h1[\s>]/g) ?? [];
  ok(`${name}: ακριβώς ένα h1`, h1s.length === 1);
  ok(`${name}: ακριβώς ένα δομημένο σχήμα (e2e-public-tools)`, page.ld.length === 1);
  ok(`${name}: κανονική διεύθυνση η διεύθυνση της σελίδας`, meta.alternates?.canonical === siteUrl(path));

  const graph = page.ld[0]?.['@graph'] ?? [];
  const app = graph.find(n => n['@type'] === 'WebApplication') as { author?: { name?: string } } | undefined;
  ok(`${name}: συντάκτης στο σχήμα «${AUTHOR}»`, app?.author?.name === AUTHOR);
  ok(`${name}: ορατή υπογραφή «${AUTHOR}»`, page.text.includes(AUTHOR));

  // ΤΟ FAQPage ΛΕΕΙ ΜΟΝΟ Ο,ΤΙ ΔΙΑΒΑΖΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ: κάθε ερώτηση είναι μία
  // <summary> της σελίδας και κάθε απάντηση είναι ορατό κείμενο.
  const faq = graph.find(n => n['@type'] === 'FAQPage') as { mainEntity?: { name: string; acceptedAnswer: { text: string } }[] } | undefined;
  const qs = faq?.mainEntity ?? [];
  // Μόνο οι συχνές ερωτήσεις (`lp-faq`): το μενού της κεφαλίδας είναι κι αυτό <summary>.
  const summaries = [...page.html.matchAll(/<details class="lp-faq"[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>/g)]
    .map(m => text(m[1]).replace(/\+\s*$/, '').trim());
  ok(`${name}: υπάρχουν συχνές ερωτήσεις στο σχήμα`, qs.length > 0);
  ok(`${name}: οι ερωτήσεις του σχήματος είναι οι ορατές, με την ίδια σειρά`,
    JSON.stringify(qs.map(q => plain(q.name).trim())) === JSON.stringify(summaries));
  for (const q of qs) ok(`${name}: η απάντηση «${q.name.slice(0, 40)}…» είναι ορατή`, page.text.includes(plain(q.acceptedAnswer.text).replace(/\s+/g, ' ')));

  // Οι σύνδεσμοι του ΚΕΙΜΕΝΟΥ: το μενού και το υποσέλιδο δείχνουν ήδη όλους τους υπολογιστές.
  const main = /<main[\s>][\s\S]*<\/main>/.exec(page.html)?.[0] ?? '';
  ok(`${name}: σύνδεσμος στον υπολογιστή στεγαστικού μέσα στο κείμενο`, main.includes(`href="${MORTGAGE}"`));
  ok(`${name}: κανένας σύνδεσμος στον οδηγό ΑΜΑ (απόφαση 13/10)`, !page.html.includes(AMA));
  ok(`${name}: σύνδεσμος στην ΑΑΔΕ από το μητρώο μέσα στο κείμενο`, Object.values(AADE_DESTINATIONS).some(d => main.includes(`href="${d.url}"`)));
}

/** Τα παραδείγματα μιας σελίδας: ο σύνδεσμος του καθενός και το κείμενο που τον προηγείται. */
function examples(html: string, path: string): { href: string; before: string }[] {
  const re = new RegExp(`<a[^>]*href="(${path.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')}\\?[^"]*)"[^>]*>([\\s\\S]*?)</a>`, 'g');
  const out: { href: string; before: string }[] = [];
  let last = 0;
  for (const m of html.matchAll(re)) {
    if (!text(m[2]).includes('Άνοιξε το παράδειγμα')) continue;
    out.push({ href: unescape(m[1]), before: text(html.slice(last, m.index)) });
    last = (m.index ?? 0) + m[0].length;
  }
  return out;
}
const params = (href: string) => new URLSearchParams(href.slice(href.indexOf('?') + 1));
// Τα μεταδεδομένα, στατικά ή από `generateMetadata`: η κανονική διεύθυνση μετρά και στα δύο.
type Meta = { title?: unknown; description?: unknown; alternates?: { canonical?: unknown } | null };
const metaOf = (mod: object): Meta => {
  const m = mod as { metadata?: Meta; generateMetadata?: () => Meta };
  return m.generateMetadata ? m.generateMetadata() : m.metadata ?? {};
};

// ═══ ΦΟΡΟΣ ΕΝΟΙΚΙΩΝ ═════════════════════════════════════════════════════════
{
  const PATH = '/ypologismos-forou-enoikion';
  const today = athensToday();
  // Η χρονιά με την οποία ανοίγει η φόρμα (`openingYear` του RentTaxCalculator.tsx).
  const year = incomeYearFor('', today, FIRST_YEAR_NEW_BRACKETS - 1);
  const page = render(rentPage.default());
  common('φόρος ενοικίων', page, PATH, metaOf(rentPage));

  const h1 = text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(page.html)?.[1] ?? '').toLowerCase();
  ok(`φόρος ενοικίων: η επικεφαλίδα λέει «φόρος ενοικίων ${year}» και «υπολογισμός» (βρέθηκε: ${h1})`,
    h1.includes(`φόρος ενοικίων ${year}`) && h1.includes('υπολογισμός'));
  ok('φόρος ενοικίων: ο τίτλος έχει τη χρονιά της φόρμας', JSON.stringify(metaOf(rentPage).title).includes(String(year)));
  // Η ΠΕΡΙΓΡΑΦΗ ΜΕ ΤΗΝ ΙΔΙΑ ΧΡΟΝΙΑ ΜΕ ΤΟΝ ΤΙΤΛΟ. Ήταν σταθερή «κλίμακα του 2026»:
  // από τον Αύγουστο του 2027 ο τίτλος θα έλεγε άλλη χρονιά από την περιγραφή.
  const desc = String(metaOf(rentPage).description ?? '');
  ok(`φόρος ενοικίων: η περιγραφή λέει «κλίμακα του ${year}» (βρέθηκε: ${desc})`, desc.includes(`κλίμακα του ${year}`));
  ok('φόρος ενοικίων: η περιγραφή δεν γράφει χρονιά με το χέρι',
    !/κλίμακα του 20\d\d/.test(code('app/ypologismos-forou-enoikion/page.tsx') + code('app/ypologismos-forou-enoikion/seo.ts')));

  // ΤΟ ΛΥΜΕΝΟ ΠΑΡΑΔΕΙΓΜΑ, ΑΝΟΙΓΜΕΝΟ ΣΤΟΝ ΥΠΟΛΟΓΙΣΤΗ.
  const ex = examples(page.html, PATH);
  ok('φόρος ενοικίων: ένα λυμένο παράδειγμα με σύνδεσμο στη φόρμα', ex.length === 1);
  for (const e of ex) {
    const v = readTool(RENT_SPEC, params(e.href));
    const y = incomeYearFor(v.etos, today, FIRST_YEAR_NEW_BRACKETS - 1);
    const gross = amount(v.enoikio) * Math.min(12, Math.round(amount(v.mines)));
    const tax = rentalIncomeTax(gross * (1 - presumptiveDeductionRateForYear(y, v.trapeza !== '0')), rentalBracketsForYear(y));
    ok(`φόρος ενοικίων: το παράδειγμα είναι της χρονιάς της σελίδας (${y})`, y === year);
    ok('φόρος ενοικίων: 12.000€ ενοίκιο τον χρόνο, όπως το ζήτησε ο ιδιοκτήτης', gross === 12_000);
    ok(`φόρος ενοικίων: ο φόρος της φόρμας (${fe(tax)}) είναι ο φόρος του κειμένου`,
      e.before.includes(`${fe(gross)} ενοίκιο τον χρόνο, ${fe(tax)} φόρος`) && e.before.includes(`Φόρος εισοδήματος ${fe(tax)}`));
    // Ο ΦΟΡΟΣ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΓΙΑ ΤΟ 2026: 12.000€ − 5% = 11.400€ στο 15% = 1.710€.
    if (y === 2026) ok('φόρος ενοικίων: 12.000€ το 2026 δίνουν 1.710€ φόρο', Math.abs(tax - 1_710) < 0.005);
    for (const f of ['app/ypologismos-forou-enoikion/page.tsx', 'app/ypologismos-forou-enoikion/seo.ts']) {
      const src = code(f);
      ok(`φόρος ενοικίων: το ποσό ${fe(tax)} δεν είναι γραμμένο με το χέρι στο ${f}`,
        ![fe(tax).replace('€', ''), String(tax), fe(gross).replace(',00€', '')].some(s => src.includes(s)));
    }
  }

  ok('φόρος ενοικίων: ενότητα «Πώς δηλώνεται στο Ε2»', page.text.includes('Πώς δηλώνεται στο Ε2'));
  ok('φόρος ενοικίων: η διαδρομή του myAADE για τη δήλωση από το μητρώο',
    page.text.includes(AADE_DESTINATIONS.income.steps.join(' · ')));
  // Ο ΣΥΝΔΕΣΜΟΣ ΣΕ ΦΕΚ ΕΙΝΑΙ ΔΙΕΥΘΥΝΣΗ ΠΟΥ ΤΟ ΑΠΟΘΕΤΗΡΙΟ ΗΔΗ ΧΡΗΣΙΜΟΠΟΙΕΙ (οδηγός Airbnb).
  const fek = [...page.html.matchAll(/href="(https:\/\/api\.et\.gr\/[^"]+)"/g)].map(m => m[1]);
  ok('φόρος ενοικίων: σύνδεσμος σε ΦΕΚ', fek.length > 0);
  const airbnb = readFileSync('app/odigos/airbnb-takk-2026/page.tsx', 'utf8');
  ok('φόρος ενοικίων: κάθε σύνδεσμος ΦΕΚ υπάρχει ήδη στο αποθετήριο', fek.every(u => airbnb.includes(`'${u}'`)));
}

// ═══ ΕΝΦΙΑ ═════════════════════════════════════════════════════════════════
{
  const PATH = '/ypologismos-enfia';
  const { year } = athensParts();
  const page = render(enfiaPage.default());
  common('ΕΝΦΙΑ', page, PATH, metaOf(enfiaPage));

  const h1 = text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(page.html)?.[1] ?? '');
  ok(`ΕΝΦΙΑ: η επικεφαλίδα λέει «ΕΝΦΙΑ ${year}» και «υπολογισμός» (βρέθηκε: ${h1})`,
    h1.includes(`ΕΝΦΙΑ ${year}`) && h1.toLowerCase().includes('υπολογισμός'));

  const ex = examples(page.html, PATH);
  ok('ΕΝΦΙΑ: δύο παραδείγματα με σύνδεσμο στη φόρμα', ex.length === 2);
  const annuals: number[] = [];
  for (const [i, e] of ex.entries()) {
    // Ίδια ανάγνωση και ίδια κλήση με το EnfiaCalculator.tsx.
    const v = readTool(ENFIA_SPEC, params(e.href));
    const sqm = amount(v.tm), price = amount(v.zoni), zone = zoneKeyFromPricePerSqm(price);
    const own = Math.min(100, Math.max(1, amount(v.pososto) || 100));
    const value = sqm * price;
    const r = zone ? estimateENFIA({ sqm, auxSqm: amount(v.voith), zone, floor: v.orofos, age: v.palaiotita, ownership: own,
      totalValue: value * (own / 100), propertyValue: value }) : null;
    ok(`ΕΝΦΙΑ: το παράδειγμα ${i + 1} υπολογίζεται στη φόρμα`, !!r);
    if (!r) continue;
    annuals.push(r.annual);
    ok(`ΕΝΦΙΑ: το ετήσιο της φόρμας (${fe(r.annual)}) είναι το ετήσιο του παραδείγματος ${i + 1}`,
      e.before.includes(`ΕΝΦΙΑ ετησίως ${fe(r.annual)}`));
    // Ο ΚΑΝΟΝΑΣ ΤΟΥ ΜΕΡΟΥΣ 2 ΠΟΥ ΖΗΤΗΣΕ Ο ΙΔΙΟΚΤΗΤΗΣ: κτίριο του 1925, 80 τ.μ.
    if (v.palaiotita === 'over100' && sqm === 80 && v.orofos === 'ground' && year === 2026) {
      ok('ΕΝΦΙΑ: το κτίριο άνω των 100 ετών παίρνει 0,60', enfiaAgeCoef(v.palaiotita) === 0.6);
      ok(`ΕΝΦΙΑ: 80 τ.μ. του 1925 δίνουν 67,20€ (βρέθηκε ${fe(r.annual)})`, Math.abs(r.annual - 67.2) < 0.005);
    }
  }
  ok('ΕΝΦΙΑ: το ένα παράδειγμα είναι το κτίριο άνω των 100 ετών', ex.some(e => readTool(ENFIA_SPEC, params(e.href)).palaiotita === 'over100'));
  for (const f of ['app/ypologismos-enfia/page.tsx', 'app/ypologismos-enfia/seo.ts']) {
    const src = code(f);
    ok(`ΕΝΦΙΑ: κανένα ετήσιο ποσό γραμμένο με το χέρι στο ${f}`,
      annuals.every(a => ![fe(a).replace('€', ''), String(a)].some(s => src.includes(s))));
  }
  ok('ΕΝΦΙΑ: η διαδρομή του εκκαθαριστικού στο myAADE από το μητρώο',
    page.text.includes(AADE_DESTINATIONS.enfia.steps.join(' · ')));
  // ΔΥΟ ΑΦΕΤΗΡΙΕΣ ΓΙΑ ΤΑ ΠΑΛΙΑ ΚΤΙΡΙΑ (άρθρο 11 Ενότητα Α΄ ν.5219/2025): τα χρόνια
  // του 0,60 από τη νεότερη άδεια (περ. ε΄), το 0,8 από το έτος ανέγερσης
  // («ανεγέρθηκαν προ του 1930»). Η απάντηση έγραφε «χτισμένα έως το …» για το
  // 0,60 και η υπόδειξη του πεδίου έβαζε την άδεια και για το 0,8.
  ok('ΕΝΦΙΑ: οι ερωτήσεις λένε από πού μετρά το καθένα',
    page.text.includes('από το έτος της νεότερης οικοδομικής άδειας') && page.text.includes('κρίνεται από το έτος ανέγερσης'));
  ok('ΕΝΦΙΑ: η υπόδειξη της παλαιότητας χωρίζει τις δύο αφετηρίες',
    /hint=\{`Τα έτη μετρούν από τη νεότερη οικοδομική άδεια[^`]*κρίνεται από το έτος ανέγερσης/.test(code('app/ypologismos-enfia/EnfiaCalculator.tsx')));
}

// ═══ ΤΟ ΚΟΙΝΟ ΚΟΜΜΑΤΙ ═══════════════════════════════════════════════════════
ok('κανένας σύνδεσμος στον οδηγό ΑΜΑ στο κοινό κομμάτι των σελίδων', !code('app/toolSeo.tsx').includes(AMA));

console.log(`toolSeo: ✓ ${passed} · ✗ ${failed}`);
if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1); }
