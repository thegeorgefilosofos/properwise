// npx tsx lib/onboarding/tour.test.ts
//
// Η περιήγηση είναι το πρώτο κείμενο που διαβάζει ο νέος χρήστης μετά τον
// φόρο του. Εδώ κλειδώνουν ο αριθμός των βημάτων, οι κανόνες γραφής και η
// θέση της κάρτας, που πρέπει να μένει μέσα στο παράθυρο από τα 320 και πάνω.
import { TOUR_STEPS, placeCard, isVisibleRect } from './tour';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };

ok('από τρία ως πέντε βήματα', TOUR_STEPS.length >= 3 && TOUR_STEPS.length <= 5);
ok('μοναδικά βήματα', new Set(TOUR_STEPS.map(s => s.id)).size === TOUR_STEPS.length);
ok('κάθε βήμα έχει στόχο', TOUR_STEPS.every(s => s.targets.length > 0));
const text = TOUR_STEPS.flatMap(s => [s.title, s.body]).join('\n');
ok('χωρίς μακριά παύλα', !/[—–]/.test(text));
ok('χωρίς κόμμα πριν από «και»', !/,\s*και(?!\p{L})/u.test(text));
ok('η Νόα δεν λέγεται «βοηθός»', !/βοηθ/i.test(text));
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
    if (vw < 640) ok(`στο κινητό δεν σκεπάζει τον στόχο ${vw}`, p.top + card.height <= t.top || p.top >= t.top + t.height);
  }
}
ok('στόχος της πλαϊνής μπάρας: η κάρτα δεξιά', placeCard({ top: 300, left: 12, width: 230, height: 44 }, card, 1280, 800).left > 242);
ok('αόρατο στοιχείο: μηδενικές διαστάσεις', !isVisibleRect({ width: 0, height: 0, left: 0, right: 0 }, 375));
ok('αόρατο στοιχείο: έξω αριστερά', !isVisibleRect({ width: 200, height: 40, left: -260, right: -60 }, 375));
ok('ορατό στοιχείο', isVisibleRect({ width: 200, height: 40, left: 10, right: 210 }, 375));

console.log(`${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
