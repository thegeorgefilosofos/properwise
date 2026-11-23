// npx tsx app/publicFooter.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΥΠΟΣΕΛΙΔΟ: ΤΕΣΣΕΡΙΣ ΣΤΗΛΕΣ ΤΩΝ ΠΕΝΤΕ, ΚΑΝΕΝΑΣ ΣΥΝΔΕΣΜΟΣ ΔΥΟ ΦΟΡΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΑΡΑΠΟΝΟ (23/11/2026, ο ιδιοκτήτης με στιγμιότυπα στα 1440). Οι στήλες
// είχαν 5, 5 και «Επιπλέον εργαλεία +», 5 και «Επιπλέον οδηγοί +», 6. Το ίδιο
// θέμα εμφανιζόταν δύο φορές μέσα στο υποσέλιδο: «Έκπτωση φόρου ανακαίνισης»
// στους Υπολογισμούς και «Έκπτωση φόρου για ανακαίνιση» στους Οδηγούς, το ίδιο
// με τη φορολογία ενοικίων, την καθαρή απόδοση και τον ΕΝΦΙΑ. Το «Απόρρητο» της
// στήλης ξανάβγαινε ως «Πολιτική απορρήτου» στη γραμμή του τέλους. Ο ιδιοκτήτης:
// «ακριβώς 5 γραμμές, όχι παραπάνω» και «να μην επαναλαμβανόμαστε».
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ ΣΤΟ ΑΠΟΔΟΜΕΝΟ HTML ΚΑΙ ΣΤΙΣ ΔΥΟ ΓΛΩΣΣΕΣ:
//   1. Τέσσερις στήλες, η καθεμία με ΑΚΡΙΒΩΣ πέντε συνδέσμους και χωρίς
//      αναδιπλούμενο «Επιπλέον».
//   2. Κανένας σύνδεσμος και κανένα λεκτικό δύο φορές σε ολόκληρο το υποσέλιδο,
//      μαζί με τη γραμμή του τέλους.
//   3. Ο πέμπτος των Υπολογισμών είναι ο κόμβος τους, ο πέμπτος των Οδηγών ο
//      δικός τους: από εκεί φτάνει κανείς σε κάθε υπολογισμό και κάθε οδηγό.
//   4. Κανένας οδηγός του υποσέλιδου δεν είναι ο «δίδυμος» υπολογισμού που ήδη
//      φαίνεται: ο πρώτος οδηγός του καταλόγου που έχει τον υπολογισμό πρώτο
//      στα `tools` του (ΕΝΦΙΑ και «Πώς υπολογίζεται ο ΕΝΦΙΑ», κ.λπ.). Ούτε δύο
//      οδηγοί του υποσέλιδου με τον ίδιο κύριο υπολογισμό (Airbnb και ΑΜΑ).
//   5. Η ένδειξη της υπαναχώρησης φαίνεται, με το λεκτικό του νόμου.
// ═══════════════════════════════════════════════════════════════════════════
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicFooter } from './PublicChrome';
import { LISTED_GUIDES } from './odigos/guides';
import { PUBLIC_TOOLS, TOOLS_HUB } from '@/lib/core/publicTools';
import { enPathFor, elPathFor } from '@/lib/i18n/paths';
import { WITHDRAWAL_LABEL, WITHDRAWAL_PATH } from '@/lib/legal/withdrawalLabels';
import { CHROME_EN } from '@/lib/i18n/en/chrome';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

const ROWS = 5;
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();
const anchors = (s: string) => [...s.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
  .map(m => ({ tag: m[1], href: /href="([^"]+)"/.exec(m[1])?.[1] ?? '', text: decode(m[2]) }));

/** Η ελληνική διαδρομή κάθε συνδέσμου, ώστε οι κανόνες να γράφονται μία φορά. */
const el = (href: string) => elPathFor(href.split('#')[0]) ?? href.split('#')[0];

const TWIN = new Map<string, string>();
for (const g of LISTED_GUIDES) if (g.tools[0] && !TWIN.has(g.tools[0])) TWIN.set(g.tools[0], g.href);
const LISTED = new Set(LISTED_GUIDES.map(g => g.href));
const toolsOf = new Map(LISTED_GUIDES.map(g => [g.href, g.tools[0]]));

for (const locale of ['el', 'en'] as const) {
  const html = renderToStaticMarkup(PublicFooter({ locale }));
  const at = `[${locale}]`;
  const cols = html.split('class="lp-footcol"').slice(1).map(c => {
    const label = decode(/<p class="lp-foothead lp-foot-wide">([\s\S]*?)<\/p>/.exec(c)?.[1] ?? '');
    const body = c.split('class="lp-footlinks"')[1]?.split('</details>')[0] ?? '';
    return { label, links: anchors(body), more: /lp-footmore/.test(c) };
  });

  ok(`${at} τέσσερις στήλες (${cols.length})`, cols.length === 4);
  for (const c of cols) {
    ok(`${at} «${c.label}»: ακριβώς ${ROWS} σύνδεσμοι (${c.links.length})`, c.links.length === ROWS, c.links.map(l => l.text).join(' · '));
    ok(`${at} «${c.label}»: χωρίς «Επιπλέον»`, !c.more);
    ok(`${at} «${c.label}»: κάθε σύνδεσμος έχει λεκτικό`, c.links.every(l => l.text.length > 0));
  }

  // Όλοι οι σύνδεσμοι κειμένου του υποσέλιδου: στήλες και γραμμή του τέλους.
  // Το σήμα της μάρκας μένει έξω: είναι εικόνα που οδηγεί στην αρχική σε κάθε
  // ιστότοπο, όχι γραμμή λίστας· δεν διαβάζεται ως δεύτερο «Αρχική». Το ίδιο
  // ο επιλογέας γλώσσας (hrefLang): δείχνει την ίδια σελίδα σε άλλη γλώσσα.
  const all = anchors(html).filter(a => !/^https?:/.test(a.href) && !/lp-brand|hrefLang=/.test(a.tag));
  const dupHref = all.map(a => a.href).filter((h, i, a) => a.indexOf(h) !== i);
  const dupText = all.map(a => a.text).filter(t => t).filter((t, i, a) => a.indexOf(t) !== i);
  ok(`${at} κανένας σύνδεσμος δύο φορές`, dupHref.length === 0, dupHref.join(', '));
  ok(`${at} κανένα λεκτικό δύο φορές`, dupText.length === 0, dupText.join(', '));

  const tools = cols[1]?.links ?? [];
  const guides = cols[2]?.links ?? [];
  ok(`${at} ο πέμπτος των υπολογισμών είναι ο κόμβος τους`, el(tools.at(-1)?.href ?? '') === TOOLS_HUB.href, tools.at(-1)?.href);
  ok(`${at} ο πέμπτος των οδηγών είναι ο κόμβος τους`, el(guides.at(-1)?.href ?? '') === '/odigos', guides.at(-1)?.href);

  const toolHrefs = tools.slice(0, -1).map(l => el(l.href));
  for (const h of toolHrefs) ok(`${at} ${h}: υπολογισμός του καταλόγου`, PUBLIC_TOOLS.some(t => t.href === h));
  const guideHrefs = guides.slice(0, -1).map(l => el(l.href));
  for (const h of guideHrefs) {
    ok(`${at} ${h}: δημοσιευμένος οδηγός`, LISTED.has(h));
    const twinOf = toolHrefs.find(t => TWIN.get(t) === h);
    ok(`${at} ${h}: δεν είναι ο οδηγός υπολογισμού που ήδη φαίνεται`, !twinOf, twinOf);
  }
  const mains = guideHrefs.map(h => toolsOf.get(h));
  ok(`${at} κάθε οδηγός του υποσέλιδου σε άλλο θέμα`, new Set(mains).size === mains.length, mains.join(', '));

  const withdraw = locale === 'el' ? WITHDRAWAL_LABEL : CHROME_EN.foot.withdraw;
  const wPath = locale === 'el' ? WITHDRAWAL_PATH : enPathFor(WITHDRAWAL_PATH);
  ok(`${at} η υπαναχώρηση φαίνεται με το λεκτικό του νόμου`, all.some(a => a.href === wPath && a.text === withdraw));
}

console.log(fail ? `✗ publicFooter: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ publicFooter: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
