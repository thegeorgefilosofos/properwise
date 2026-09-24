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
import { LegalLayout, LegalShell, anchorOf } from './legal-shell';
import { SHY } from '@/lib/core/hyphenate';
import PrivacyPage from './privacy/page';
import TermsPage from './terms/page';

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

// ── ΚΑΙ Ο ΙΔΙΟΣ Ο ΕΛΕΓΧΟΣ ΑΠΟΔΕΙΚΝΥΕΙ ΟΤΙ ΜΠΟΡΕΙ ΝΑ ΚΟΚΚΙΝΙΣΕΙ ──────────────
// ΣΤΗΝ ΠΡΩΤΗ ΤΟΥ ΓΡΑΦΗ ΠΕΡΝΟΥΣΕ ΓΙΑ ΛΑΘΟΣ ΛΟΓΟ. Εψαχνε τη διαδρομή σε ΟΛΟΚΛΗΡΟ
// το HTML της σελίδας — και την έβρισκε στο υποσέλιδο, που δείχνει και στις
// τρεις. Δηλαδή το «δεν δείχνει στον εαυτό της» ήταν πάντα ψευδές και το «τις
// άλλες δύο» πάντα αληθές, ανεξάρτητα από το φίλτρο.
//
// Η ΑΠΟΔΕΙΞΗ ΕΙΝΑΙ ΜΙΑ ΓΡΑΜΜΗ: με διαδρομή που δεν ταιριάζει σε καμία σελίδα,
// το φίλτρο δεν κόβει τίποτα και η σειρά ΟΦΕΙΛΕΙ να έχει και τους τρεις. Αν
// αυτό πέσει, ο εξαγωγέας δεν βλέπει τη σειρά και οι τρεις έλεγχοι από πάνω
// δεν ελέγχουν τίποτα. Ο ίδιος κανόνας που έχει ο πάγκος μεταλλάξεων για τους
// φύλακες: μηδέν δεν σημαίνει τίποτα αν ο έλεγχος δεν μπορεί να κοκκινίσει.
ok('ο έλεγχος βλέπει ΤΗ ΣΕΙΡΑ και όχι όλη τη σελίδα', row('/καμία-τέτοια-σελίδα').length === 3);

// ═══ ΤΟ ΑΓΚΙΣΤΡΟ ΕΙΝΑΙ Ο ΤΙΤΛΟΣ, ΟΧΙ Η ΘΕΣΗ ════════════════════════════════
// Με «#s14» μία ενότητα παραπάνω έστελνε κάθε παλιό σύνδεσμο σε άλλο κείμενο.
ok('ο τίτλος γίνεται λατινικό άγκιστρο', anchorOf('Χρόνος διατήρησης') === 'chronos-diatirisis');
ok('χωρίς εισαγωγικά και παρενθέσεις', anchorOf('Πρόγραμμα Πρόσκλησης (συστάσεις)') === 'programma-prosklisis-systaseis');
{
  const two = (first: string) => html(createElement(LegalLayout, {
    self: '/terms', eyebrow: 'Νομικά', title: 'Τ', intro: 'Ι',
    blocks: [first, 'Χρόνος διατήρησης'].map(h => ({ h, body: createElement('p', null, 'κείμενο') })),
  }));
  ok('το άγκιστρο δεν αλλάζει όταν μπει ενότητα από πάνω',
    two('Ορισμοί').includes('id="chronos-diatirisis"') && two('Νέα ενότητα').includes('id="chronos-diatirisis"'));
  ok('και τα περιεχόμενα δείχνουν σε αυτό', two('Ορισμοί').includes('href="#chronos-diatirisis"'));
  const dup = html(createElement(LegalLayout, {
    self: '/terms', eyebrow: 'Νομικά', title: 'Τ', intro: 'Ι',
    blocks: ['Ίδιος', 'Ίδιος'].map(h => ({ h, body: createElement('p', null, 'κείμενο') })),
  }));
  ok('δύο ίδιοι τίτλοι δεν μοιράζονται άγκιστρο', dup.includes('id="idios"') && dup.includes('id="idios-2"'));
}

// ═══ ΚΑΘΕ EMAIL ΣΤΑ ΝΟΜΙΚΑ ΚΕΙΜΕΝΑ ΠΑΤΙΕΤΑΙ ═══════════════════════════════════
{
  // Χωρίς τα μαλακά ενωτικά του συλλαβιστή, για να συγκρίνεται το κείμενο.
  const out = html(createElement(LegalShell, {
    self: '/privacy', title: 'Τ', updated: 'Σ', intro: 'Ι',
    sections: [{ h: 'Επικοινωνία', p: ['Γράψε μας στο privacy@properwise.gr. Απαντάμε.'] }],
  })).split(SHY).join('');
  ok('η διεύθυνση γίνεται σύνδεσμος νέου μηνύματος', out.includes('href="mailto:privacy@properwise.gr"'));
  ok('χωρίς την τελεία της πρότασης', !out.includes('mailto:privacy@properwise.gr.'));
  ok('και το κείμενο γύρω της μένει', out.includes('Γράψε μας στο ') && out.includes('. Απαντάμε.'));
}

// ═══ ΚΑΘΕ ΠΑΡΑΠΟΜΠΗ ΠΑΤΙΕΤΑΙ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΔΕΙΧΝΕΙ ΣΤΟ ΚΕΝΟ ══════════════════
{
  const out = html(createElement(LegalShell, {
    self: '/privacy', title: 'Τ', updated: 'Σ', intro: 'Ι',
    sections: [
      { h: 'Δεδομένα τρίτων που καταχωρείς', p: ['κείμενο'] },
      { h: 'Άλλη', p: ['Βλ. ενότητα «Δεδομένα τρίτων που καταχωρείς». Και ενότητα «Ανύπαρκτη».', 'Στη σελίδα «Ποιοι είμαστε» και στην «Πολιτική απορρήτου».'] },
    ],
  })).split(SHY).join('');
  ok('η ενότητα γίνεται σύνδεσμος στο άγκιστρό της', out.includes('ενότητα «<a href="#dedomena-triton-pou-katachoreis"'));
  ok('ενότητα που δεν υπάρχει μένει κείμενο', out.includes('ενότητα «Ανύπαρκτη»'));
  ok('η άλλη σελίδα γίνεται σύνδεσμος', /«<a [^>]*href="\/trust"/.test(out));
  ok('η ίδια σελίδα όχι', !/«<a [^>]*href="\/privacy"/.test(out));
}

// ═══ Η ΕΤΙΚΕΤΑ ΤΗΣ ΓΡΑΜΜΗΣ, ΜΟΝΟ ΟΠΟΥ ΔΗΛΩΘΗΚΕ ══════════════════════════════
{
  const list = (labelled: boolean) => html(createElement(LegalShell, {
    self: '/privacy', title: 'Τ', updated: 'Σ', intro: 'Ι',
    sections: [{ h: 'Λίστα', labelled, list: ['Πρόσβαση: μαθαίνεις τι τηρούμε.', 'Μια μεγάλη πρόταση που συνεχίζει πολύ ώσπου να βρει άνω τελεία και να συνεχίσει ακόμη λίγο: εδώ.'] }],
  })).split(SHY).join('');
  ok('η ετικέτα γράφεται έντονα', list(true).includes('<strong>Πρόσβαση</strong>: μαθαίνεις'));
  ok('η μακριά φράση δεν κόβεται στα δύο', !list(true).includes('<strong>Μια μεγάλη'));
  ok('χωρίς δήλωση, καμία έντονη ετικέτα', !list(false).includes('<strong>'));
}

// ═══ ΤΟ ΕΝΤΥΠΟ ΑΝΤΙΓΡΑΦΕΤΑΙ ΚΑΘΑΡΟ ════════════════════════════════════════════
{
  const out = html(createElement(LegalShell, {
    self: '/terms', title: 'Τ', updated: 'Σ', intro: 'Ι',
    sections: [{ h: 'Υπαναχώρηση', p: ['κείμενο'], form: { label: 'Έντυπο', lines: ['Προς: PROPERWISE', 'Με το παρόν σας γνωστοποιώ ότι υπαναχωρώ'] } }],
  }));
  const pre = out.slice(out.indexOf('<pre'), out.indexOf('</pre>'));
  ok('το έντυπο είναι μπλοκ με γραμμές', pre.includes('Προς: PROPERWISE\nΜε το παρόν'));
  ok('χωρίς μαλακά ενωτικά μέσα του', !pre.includes(SHY));
}

// ═══ ΜΕΡΗ ΚΑΙ ΕΝΟΤΗΤΕΣ ΣΤΗΝ ΙΕΡΑΡΧΙΑ ΤΩΝ ΕΠΙΚΕΦΑΛΙΔΩΝ ═══════════════════════════
{
  const out = html(createElement(LegalLayout, {
    self: '/terms', eyebrow: 'Νομικά', title: 'Τ', intro: 'Ι', version: 'Έκδοση 2026-09',
    blocks: [{ part: 'Α. Μέρος', h: 'Ενότητα', body: createElement('p', null, 'κείμενο') }],
  })).split(SHY).join('');
  ok('το μέρος είναι h2', /<h2 class="lg-part[^"]*">Α. Μέρος<\/h2>/.test(out));
  ok('η ενότητα είναι h3', out.includes('<h3'));
  ok('ο αριθμός έχει τελεία για τον αναγνώστη', out.includes('1<span class="sr-only">. </span>'));
  ok('η έκδοση φαίνεται στην κορυφή', out.indexOf('Έκδοση 2026-09') > 0 && out.indexOf('Έκδοση 2026-09') < out.indexOf('lg-grid'));
}

// ═══ ΟΙ ΔΥΟ ΣΕΛΙΔΕΣ, ΟΠΩΣ ΤΙΣ ΒΛΕΠΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ ════════════════════════════
// Κάθε «ενότητα «Χ»» στην Πολιτική και στους Ορους δείχνει σε τίτλο που υπάρχει.
// Αλλάζει ένας τίτλος και μένει πίσω η παραπομπή: εδώ κοκκινίζει.
{
  const pages = [PrivacyPage, TermsPage];
  for (const [name, mod] of [['privacy', pages[0]], ['terms', pages[1]]] as const) {
    const out = html(createElement(mod)).split(SHY).join('');
    const refs = out.split('ενότητα «').length - 1;
    const linked = out.split('ενότητα «<a href="#').length - 1;
    ok(`${name}: κάθε παραπομπή σε ενότητα είναι σύνδεσμος (${linked}/${refs})`, refs > 0 && refs === linked);
    ok(`${name}: η έκδοση φαίνεται στην κορυφή`, out.includes('class="lg-version"'));
  }
}

console.log(`legal-shell: ✓ ${passed} · ✗ ${failed}`);
if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1); }
