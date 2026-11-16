// npx tsx lib/core/cssZoom.test.ts
//
// ΣΥΝΤΕΤΑΓΜΕΝΕΣ ΚΑΤΩ ΑΠΟ ΤΟ ΜΕΓΑΛΟ ΚΕΙΜΕΝΟ. Με zoom 1,25 ο περιηγητής δίνει
// μετρήσεις σε εικονοστοιχεία οθόνης και ζωγραφίζει το `left/top` ×1,25. Εδώ
// κλειδώνει ότι το πλωτό κουμπί της Νόας, το σύρσιμό του και η αποθηκευμένη
// θέση του μένουν μέσα στην οθόνη. Χωρίς μεγέθυνση δεν αλλάζει τίποτα.
import { cssZoom, cssRect, cssViewW, cssViewH, toCssPx, clampBox } from './cssZoom';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };
const g = globalThis as unknown as Record<string, unknown>;

/** Στήνει ψεύτικο παράθυρο: οθόνη 400 × 800 και ρίζα με τη ζητούμενη μεγέθυνση. */
function stage(zoom: number) {
  g.document = { documentElement: { currentCSSZoom: zoom } };
  g.window = { innerWidth: 400, innerHeight: 800 };
}

ok('εκτός περιηγητή: συντελεστής 1', cssZoom() === 1);

stage(1);
ok('χωρίς μεγέθυνση: παράθυρο όπως είναι', cssViewW() === 400 && cssViewH() === 800);
ok('χωρίς μεγέθυνση: απόσταση δείκτη όπως είναι', toCssPx(40) === 40);

stage(1.25);
ok('μεγέθυνση 1,25: διαβάζεται', cssZoom() === 1.25);
ok('παράθυρο σε εικονοστοιχεία ρίζας', cssViewW() === 320 && cssViewH() === 640);
{
  // Στοιχείο που η οθόνη δείχνει στα 125 με πλάτος 62,5 είναι στα 100 και 50 στη ρίζα.
  const el = { getBoundingClientRect: () => ({ left: 125, top: 125, right: 187.5, bottom: 187.5, width: 62.5, height: 62.5 }) } as unknown as Element;
  const r = cssRect(el);
  ok('ορθογώνιο σε εικονοστοιχεία ρίζας', r.left === 100 && r.top === 100 && r.width === 50 && r.height === 50);
  ok('χωρίς στοιχείο: undefined', cssRect(null) === undefined);
}
ok('σύρσιμο 100 στην οθόνη = 80 στη ρίζα', toCssPx(100) === 80);
{
  // Το πλωτό κουμπί (52 × 52) σύρθηκε ως τη δεξιά κάτω γωνία της οθόνης.
  const p = clampBox(1000, 1000, 52, 52, cssViewW(), cssViewH());
  ok('το κουμπί μένει μέσα στη ρίζα', p.x === 320 - 52 - 8 && p.y === 640 - 52 - 8);
  ok('ζωγραφισμένο ×1,25, η δεξιά άκρη του μένει μέσα στην οθόνη', (p.x + 52) * 1.25 <= 400 && (p.y + 52) * 1.25 <= 800);
  // Αυτό που γινόταν πριν: περιορισμός με το `innerWidth` της οθόνης.
  const old = clampBox(1000, 1000, 52, 52, 400, 800);
  ok('ο παλιός περιορισμός έβγαζε το κουμπί έξω από την οθόνη', (old.x + 52) * 1.25 > 400);
}
{
  const p = clampBox(-20, 5, 52, 52, 320, 640);
  ok('αριστερά και πάνω: περιθώριο 8', p.x === 8 && p.y === 8);
}

console.log(`${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
