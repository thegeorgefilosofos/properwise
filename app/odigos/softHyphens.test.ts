// npx tsx app/odigos/softHyphens.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΝΕΝΑ ΜΑΛΑΚΟ ΕΝΩΤΙΚΟ (U+00AD) ΣΤΟ ΚΕΙΜΕΝΟ ΤΩΝ ΟΔΗΓΩΝ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (13.10.2026). Το HTML κάθε οδηγού είχε 285 ως 1.080 μαλακά
// ενωτικά μέσα στις λέξεις («αν\u00ADθε\u00ADκτι\u00ADκό\u00ADτη\u00ADτας») και ο κόμβος /odigos 12. Δεν
// φαίνονταν: οι οδηγοί στοιχίζονται αριστερά με `hyphens: none` από τις
// 07.10.2026. Ζούσαν όμως στο κείμενο: η αντιγραφή έφερνε τη λέξη με αόρατους
// χαρακτήρες και η αναζήτηση φράσης δεν έβρισκε ό,τι έβλεπε ο αναγνώστης. Δύο
// πηγές τα έβαζαν: το `hy()` στην απόδοση (`GuideMain`, `GuideSources`, η
// εισαγωγή του κόμβου) και ο στοιχειοθέτης στον περιηγητή (lib/ui/typeset.ts,
// από το components/JustifyPolish.tsx σε κάθε `main`).
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ.
//   1. Κάθε οδηγός του καταλόγου και ο κόμβος, αποδομένοι: κανένα U+00AD.
//   2. Το `main` τους φορά `data-nohy` και ο στοιχειοθέτης το σέβεται. Αλλιώς τα
//      ενωτικά ξαναμπαίνουν στο DOM μετά τη φόρτωση, όπου η απόδοση εδώ δεν φτάνει.
//   3. Ο καθαριστής της αντιγραφής στη ρίζα γράφει το ενωτικό ως διαφυγή, όχι
//      ως χαρακτήρα, ώστε το HTML της σελίδας να μην έχει κανένα.
//   4. Ο συλλαβισμός μένει δουλειά του περιηγητή: `lang="el"` στη ρίζα και
//      `hyphens: auto` με αριστερή στοίχιση στη στήλη του οδηγού.
// ═══════════════════════════════════════════════════════════════════════════
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { hy } from '@/components/Hyphen';
import { GUIDES } from './guides';

const SHY = '\u00AD';
const SHY_ENTITY = /&shy;|&#173;|&#x0*ad;/i;

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

/** Πού βρίσκεται το πρώτο ενωτικό, για να λέει η αποτυχία τι να ψάξεις. */
function around(html: string): string {
  const i = html.indexOf(SHY);
  return i < 0 ? '' : ` — «${html.slice(Math.max(0, i - 40), i + 20).split(/<[^>]+>/).join(' ').replace(SHY, '[U+00AD]')}»`;
}

async function main() {
  // Ο ΕΛΕΓΧΟΣ ΒΛΕΠΕΙ ΟΝΤΩΣ ΤΑ ΕΝΩΤΙΚΑ. Χωρίς αυτό, ένα λάθος στη σταθερά θα
  // περνούσε κάθε σελίδα ως «καθαρή».
  ok('το `hy()` βάζει ακόμη μαλακά ενωτικά (ο έλεγχος δεν είναι κενός)',
    renderToStaticMarkup(createElement('p', null, hy('Το τέλος ανθεκτικότητας στην κλιματική κρίση.'))).includes(SHY));

  const routes = [{ href: '/odigos', file: './page' }, ...GUIDES.map(g => ({ href: g.href, file: `.${g.href.slice('/odigos'.length)}/page` }))];
  let seen = 0;
  for (const r of routes) {
    const mod = await import(r.file) as { default: () => ReactElement };
    const html = renderToStaticMarkup(createElement(mod.default));
    seen++;
    const n = html.split(SHY).length - 1;
    ok(`${r.href}: κανένα U+00AD στο HTML (βρέθηκαν ${n})${around(html)}`, n === 0);
    ok(`${r.href}: κανένα &shy; ως οντότητα`, !SHY_ENTITY.test(html));
    ok(`${r.href}: το <main> φορά data-nohy, ώστε να μη συλλαβίσει ο στοιχειοθέτης`, /<main\b[^>]*\bdata-nohy=/.test(html));
  }
  ok(`αποδόθηκαν όλοι οι οδηγοί και ο κόμβος (${seen} από ${GUIDES.length + 1})`, seen === GUIDES.length + 1);

  // ── Ο ΣΤΟΙΧΕΙΟΘΕΤΗΣ ΣΕΒΕΤΑΙ ΤΟ data-nohy ───────────────────────────────────
  const typeset = readFileSync('lib/ui/typeset.ts', 'utf8');
  const skip = /const SKIP = '([^']*)'/.exec(typeset)?.[1] ?? '';
  ok('ο στοιχειοθέτης παραλείπει ό,τι είναι μέσα σε [data-nohy]', skip.split(',').includes('[data-nohy]'));
  ok('και το κρίνει για το μπλοκ (SKIP_BLOCK από SKIP)', /const SKIP_BLOCK = SKIP\b/.test(typeset) && /el\.closest\(SKIP_BLOCK\)/.test(typeset));

  // ── ΟΥΤΕ ΣΤΟ ΣΕΝΑΡΙΟ ΤΗΣ ΡΙΖΑΣ ─────────────────────────────────────────────
  // Ο καθαριστής της αντιγραφής (app/layout.tsx) μπαίνει σε ΚΑΘΕ σελίδα. Με
  // `\u00AD` στο template literal κουβαλούσε τον ίδιο τον χαρακτήρα: τέσσερα
  // U+00AD στο HTML κάθε οδηγού, που η απόδοση της σελίδας εδώ δεν βλέπει.
  const layout = readFileSync('app/layout.tsx', 'utf8');
  const copyScript = /const copyPlainScript = `([\s\S]*?)`;/.exec(layout)?.[1] ?? '';
  ok('ο καθαριστής της αντιγραφής βρέθηκε στη ρίζα', copyScript.includes("addEventListener('copy'"));
  ok('και γράφει το ενωτικό ως διαφυγή (\\u00AD), όχι ως χαρακτήρα',
    !copyScript.includes(SHY) && !/(^|[^\\])\\u00AD/i.test(copyScript));

  // ── Ο ΣΥΛΛΑΒΙΣΜΟΣ ΤΟΝ ΚΑΝΕΙ Ο ΠΕΡΙΗΓΗΤΗΣ ──────────────────────────────────
  ok('η ρίζα δηλώνει lang="el"', /<html\b[^>]*\blang="el"/.test(layout));
  const css = readFileSync('app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const prose = /\.gd \.lg-p, \.gd \.lg-ul li \{([^}]*hyphens[^}]*)\}/.exec(css)?.[1] ?? '';
  ok('η στήλη του οδηγού συλλαβίζεται από τον περιηγητή (hyphens: auto)', /hyphens\s*:\s*auto/.test(prose));
  // Πέρα πέρα χωρίς ελληνικό λεξικό (Firefox, Safari) ανοίγει ποτάμια λευκού.
  ok('και στοιχίζεται αριστερά, όχι πέρα πέρα', /text-align\s*:\s*start/.test(prose) && !/justify/.test(prose));

  console.log(fail ? `✗ softHyphens: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ softHyphens: ${pass} έλεγχοι πέρασαν`);
  if (fail) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
