// npx tsx lib/onboarding/tour.test.ts
//
// Η περιήγηση είναι το πρώτο κείμενο που διαβάζει ο νέος χρήστης μετά τον
// φόρο του. Εδώ κλειδώνουν ο αριθμός των βημάτων, οι κανόνες γραφής και η
// θέση της κάρτας, που πρέπει να μένει μέσα στο παράθυρο από τα 320 και πάνω.
import { TOUR_STEPS, TOUR_TOP, placeCard, isVisibleRect } from './tour';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

ok('από τρία ως πέντε βήματα', TOUR_STEPS.length >= 3 && TOUR_STEPS.length <= 5);
ok('μοναδικά βήματα', new Set(TOUR_STEPS.map(s => s.id)).size === TOUR_STEPS.length);
ok('κάθε βήμα έχει στόχο', TOUR_STEPS.every(s => s.targets.length > 0));
const text = TOUR_STEPS.flatMap(s => [s.title, s.body]).join('\n');
ok('χωρίς μακριά παύλα', !/[—–]/.test(text));
ok('χωρίς κόμμα πριν από «και»', !/,\s*και(?!\p{L})/u.test(text));
ok('η Νόα δεν λέγεται «βοηθός»', !/βοηθ/i.test(text));
ok('η Νόα συστήνεται με το όνομά της', /Η Νόα απαντά/.test(TOUR_STEPS.find(s => s.id === 'assistant')!.body));
ok('ένας όρος για το έγγραφο: «παραστατικό», όχι «απόδειξη» ή «έγγραφο»', !/απόδειξ|έγγραφ/i.test(text) && /παραστατικ/.test(text));
ok('«Ημερολόγιο» με κεφαλαίο, ως όνομα καρτέλας', !/ημερολόγιο/.test(text));
ok('χωρίς «μόνες τους» ή «μόνη της»', !/μόν(ες|η|ος) (τους|της|του)/.test(text));
ok('κανένας αριθμός γραμμένος με το χέρι', !/\d/.test(text));
ok('τίτλος ως τρεις λέξεις', TOUR_STEPS.every(s => s.title.split(/\s+/).length <= 3));
ok('σώμα ως δεκατέσσερις λέξεις, μία πρόταση', TOUR_STEPS.every(s => s.body.split(/\s+/).length <= 14 && (s.body.match(/[.;]/g) || []).length === 1));
ok('χωρίς αποσιωπητικά ή θαυμαστικά', !/…|\.\.\.|!/.test(text));

const card = { width: 340, height: 220 };
for (const vw of [320, 375, 1280]) {
  const vh = vw < 640 ? 812 : 800;
  for (const t of [{ top: 10, left: 60, width: 160, height: 40 }, { top: 740, left: 100, width: 80, height: 56 }, { top: 300, left: 12, width: 230, height: 44 }, { top: 700, left: vw - 180, width: 160, height: 48 }]) {
    const p = placeCard(t, card, vw, vh);
    ok(`μέσα στο πλάτος ${vw}`, p.left >= 16 && p.left + p.width <= vw - 16 + 0.5);
    ok(`μέσα στο ύψος ${vw}`, p.top >= 16 && p.top + card.height <= vh - 16 + 0.5);
    ok(`κάτω από την μπάρα της κορυφής ${vw}`, p.top >= TOUR_TOP);
    if (vw < 640) ok(`στο κινητό δεν σκεπάζει τον στόχο ${vw}`, p.top + card.height <= t.top || p.top >= t.top + t.height);
    const near = p.caret.edge === 'bottom' ? t.top - (p.top + card.height) : p.caret.edge === 'top' ? p.top - (t.top + t.height) : p.caret.edge === 'right' ? t.left - (p.left + p.width) : p.left - (t.left + t.width);
    ok(`η κάρτα ακουμπά τον στόχο ${vw}`, near >= 0 && near <= 40);
    const axis = p.caret.edge === 'left' || p.caret.edge === 'right' ? card.height : p.width;
    // Η κάρτα δεν σκεπάζει ποτέ τον στόχο, σε κανένα πλάτος.
    const overlaps = p.left < t.left + t.width && p.left + p.width > t.left && p.top < t.top + t.height && p.top + card.height > t.top;
    ok(`δεν σκεπάζει τον στόχο ${vw}`, !overlaps);
    ok(`το βέλος μέσα στην κάρτα ${vw}`, p.caret.offset >= 20 && p.caret.offset <= axis - 20);
  }
}
{
  // Η κάρτα της πλαϊνής μπάρας ξεκινά 8 πάνω από τον στόχο και κατεβαίνει, ώστε
  // να μη σκεπάζει το ποσό της κορυφής (κριτική σχεδίασης r2, 13/11/2026).
  const t = { top: 300, left: 12, width: 230, height: 44 };
  const p = placeCard(t, card, 1280, 800);
  ok('πλαϊνή μπάρα: κορυφή κάρτας 8 πάνω από τον στόχο', p.top === t.top - 8);
  ok('πλαϊνή μπάρα: το βέλος στο κέντρο του στόχου', p.caret.offset === t.top + t.height / 2 - p.top);
}
ok('ο τίτλος της Νόας δεν επαναλαμβάνει το «Ρώτα τη Νόα»', !/Ρώτα/.test(TOUR_STEPS.find(s => s.id === 'assistant')!.title));
ok('στόχος της πλαϊνής μπάρας: η κάρτα δεξιά', placeCard({ top: 300, left: 12, width: 230, height: 44 }, card, 1280, 800).left > 242);
// Το κουμπί της Νόας κάτω δεξιά: η κάρτα στέκει αριστερά του, με βέλος δεξιά,
// και δεν κατεβαίνει πιο χαμηλά από τον πάτο του.
{
  const fab = { top: 724, left: 1090, width: 170, height: 56 };
  const p = placeCard(fab, card, 1280, 800);
  ok('Νόα κάτω δεξιά: η κάρτα αριστερά', p.caret.edge === 'right' && p.left + p.width <= fab.left);
  ok('Νόα κάτω δεξιά: η κάρτα δεν περνά κάτω από τον στόχο', p.top + card.height <= fab.top + fab.height + 0.5);
}
// Στόχος μέσα στην μπάρα της κορυφής, σε κινητό: η κάρτα από κάτω, όχι πάνω της.
{
  const p = placeCard({ top: 8, left: 300, width: 48, height: 48 }, card, 375, 812);
  ok('στόχος στην κορυφή: η κάρτα από κάτω του', p.caret.edge === 'top' && p.top >= TOUR_TOP);
}
ok('αόρατο στοιχείο: μηδενικές διαστάσεις', !isVisibleRect({ width: 0, height: 0, left: 0, right: 0 }, 375));
ok('αόρατο στοιχείο: έξω αριστερά', !isVisibleRect({ width: 200, height: 40, left: -260, right: -60 }, 375));
ok('ορατό στοιχείο', isVisibleRect({ width: 200, height: 40, left: 10, right: 210 }, 375));

console.log(`${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
