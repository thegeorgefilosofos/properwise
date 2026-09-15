// npx tsx app/legal-shell.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΣΥΛΛΑΒΙΣΜΟΣ ΤΩΝ ΝΟΜΙΚΩΝ ΣΕΛΙΔΩΝ ΣΤΑΜΑΤΑ ΣΤΟΝ ΠΙΝΑΚΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΓΙΝΕ. Οι τρεις σελίδες εμπιστοσύνης στοιχίζονται πλήρως· η πλήρης
// στοίχιση χωρίς συλλαβισμό αφήνει ποτάμια κενού ανάμεσα στις λέξεις. Ο
// συλλαβιστής μπήκε στην απόδοση και έκλεισε τα κενά — αλλά διέσχιζε ΟΛΟ το
// δέντρο της ενότητας, οπότε έβαζε μαλακά ενωτικά και μέσα στα κελιά των
// πινάκων. Μετρημένο στα 1.280 στο «Ποιοι είμαστε»: «Ευρωπαϊ-κή Ένωση» στη
// στήλη του τόπου, «Ενερ-γοποιείται», «στοι-χεία», «ταξι-δεύει» στη διπλανή.
//
// Ο ΚΑΝΟΝΑΣ. Ο συλλαβισμός είναι εργαλείο της πλήρους στοίχισης: υπάρχει για
// να κλείνει τα κενά μιας παραγράφου. Το κελί πίνακα δεν στοιχίζεται πλήρως,
// άρα δεν έχει κενά να κλείσει — και το μόνο που του μένει είναι τα σπασίματα.
//
// ΓΙΑΤΙ ΕΛΕΓΧΟΣ ΚΑΙ ΟΧΙ ΜΟΝΟ ΚΑΝΟΝΑΣ CSS. Το `hyphens: none` του φύλλου στυλ
// κρύβει το ενωτικό από το μάτι· ΔΕΝ το βγάζει από το κείμενο. Ο,τι φτάνει σε
// αντιγραφή-επικόλληση, σε αναγνώστη οθόνης ή σε εύρεση στη σελίδα είναι το
// κείμενο, όχι η εικόνα του. Το ενωτικό δεν πρέπει να μπει καθόλου.
// ═══════════════════════════════════════════════════════════════════════════
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hy } from '../components/Hyphen';
import { LegalLayout } from './legal-shell';
import { SHY } from '@/lib/core/hyphenate';

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name); } };

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

// ── Η παράγραφος ΣΥΛΛΑΒΙΖΕΤΑΙ ───────────────────────────────────────────────
const para = createElement('p', null, 'Η επεξεργασία των δεδομένων σου γίνεται σε διακομιστές εντός Ευρωπαϊκής Ένωσης.');
ok('η παράγραφος παίρνει μαλακά ενωτικά', html(hy(para)).includes(SHY));

// ── Το ΚΕΛΙ ΟΧΙ ────────────────────────────────────────────────────────────
const table = createElement('table', null,
  createElement('tbody', null,
    createElement('tr', null,
      createElement('th', { scope: 'row' }, 'Sentry'),
      createElement('td', null, 'Καταγραφή σφαλμάτων της εφαρμογής. Ενεργοποιείται μόνο αν οριστεί κλειδί.'),
      createElement('td', null, 'ΗΠΑ ή Ευρωπαϊκή Ένωση'))));
ok('ο πίνακας μένει ασυλλάβιστος', !html(hy(table)).includes(SHY));

// ── Και ΟΤΑΝ Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ ΜΕΣΑ ΣΕ ΕΝΟΤΗΤΑ με κείμενο γύρω του ────────────
// Η ενότητα είναι ακριβώς η περίπτωση της σελίδας: κείμενο, πίνακας, κείμενο.
// Ο συλλαβιστής πρέπει να πιάσει τα δύο και να προσπεράσει τον έναν.
const section = createElement('div', null, para, table, para);
const out = html(hy(section));
ok('στην ενότητα, το κείμενο συλλαβίζεται', out.split('<table>')[0].includes(SHY));
ok('στην ενότητα, ο πίνακας δεν συλλαβίζεται',
  !out.slice(out.indexOf('<table>'), out.indexOf('</table>')).includes(SHY));

// ── Η δομή δεν αλλάζει ──────────────────────────────────────────────────────
const bare = html(table);
ok('ο πίνακας επιστρέφει απαράλλαχτος', html(hy(table)) === bare);

// ═══ ΚΑΜΙΑ ΣΕΛΙΔΑ ΔΕΝ ΔΕΙΧΝΕΙ ΣΤΟΝ ΕΑΥΤΟ ΤΗΣ ═══════════════════════════════
// Και οι τρεις τύπωναν και τους τρεις συνδέσμους: στο «Ποιοι είμαστε» το πρώτο
// πράγμα κάτω από το κείμενο ήταν ένα «Ποιοι είμαστε» που ξαναφόρτωνε την ίδια
// σελίδα. Ο έλεγχος κρατά και τα δύο σκέλη — ότι ο εαυτός φεύγει ΚΑΙ ότι οι
// άλλοι δύο μένουν — γιατί ένα φίλτρο που κόβει τα πάντα περνά το μισό.
const row = (self: string) => {
  const out = html(createElement(LegalLayout, {
    self, eyebrow: 'Νομικά', title: 'Τ', intro: 'Ι',
    blocks: [{ h: 'Μία', body: createElement('p', null, 'κείμενο') }],
  }));
  // ΜΟΝΟ Η ΣΕΙΡΑ, ΟΧΙ ΟΛΗ Η ΣΕΛΙΔΑ: το υποσέλιδο δείχνει και στις τρεις.
  const i = out.indexOf('class="lg-siblings"');
  const seg = out.slice(i, out.indexOf('</div>', i));
  return ['/trust', '/privacy', '/terms'].filter(h => seg.includes(`href="${h}"`));
};
for (const [self, other1, other2] of [
  ['/trust', '/privacy', '/terms'],
  ['/privacy', '/trust', '/terms'],
  ['/terms', '/trust', '/privacy'],
]) {
  const hrefs = row(self);
  ok(`${self}: δεν δείχνει στον εαυτό της`, !hrefs.includes(self));
  ok(`${self}: δείχνει στις άλλες δύο`, hrefs.includes(other1) && hrefs.includes(other2));
}

console.log(`legal-shell: ✓ ${passed} · ✗ ${failed}`);
if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1); }
