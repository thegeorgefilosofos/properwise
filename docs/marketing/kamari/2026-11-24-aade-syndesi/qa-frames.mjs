// Ελεγχος στοίχισης και περιθωρίων ανά πλάνο, στα ίδια τα καρέ (εντολή ιδιοκτήτη: «ζυγισμένα στοιχισμένα»).
//
//   CHROMIUM_PATH=… node docs/marketing/kamari/2026-11-24-aade-syndesi/qa-frames.mjs; echo "κωδικός: $?"
//
// Για κάθε πλάνο αποδίδει ένα καρέ 0,3″ πριν από το τέλος του (χωρίς τα φωτεινά φόντα: ?qa=1) και μετρά:
//   1. αριστερή άκρη του περιεχομένου = 72 px (± 4) σε κάθε πλάνο: κοινός άξονας για κείμενα, ετικέτα, συσκευές και κοντινά·
//   2. δεξιά άκρη = 72 px (± 4) στα πλάνα με συσκευές ή κοντινό (ίσα περιθώρια)· στα πλάνα κειμένου το πολύ 72 − 4·
//   3. λεζάντα: ίδιο πάνω άκρο μελανιού σε όλα τα πλάνα (± 4).
// Αποτυγχάνει (κωδικός 1) αν ξεφύγει έστω ένα· τυπώνει όλες τις μετρήσεις.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'film.html'), 'utf8');
const TL = JSON.parse(/<script id="timeline" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1]);
const C = TL.cuts;
const GX = 72, TOL = 4, W = 1080;
const SHOTS = [
  ['αγκίστρι', 'text', 0, C[0]], ['Κάτι έρχεται', 'text', C[0], C[1]], ['τίτλος', 'text', C[1], C[2]],
  ['laptop και κινητό', 'wide', C[2], C[3]], ['Εισερχόμενα', 'wide', C[3], C[4]], ['ΜΑΡΚ', 'wide', C[4], C[5]],
  ['Ε9', 'wide', C[5], C[6]], ['Καταχώρηση', 'wide', C[6], C[7]], ['μήνυμα', 'text', C[7], C[8]], ['τέλος', 'text', C[8], TL.dur],
];
const tmp = mkdtempSync(join(tmpdir(), 'qa-frames-'));
let fails = 0;
for (const fmt of ['916', '45']) {
  const H = fmt === '45' ? 1350 : 1920, capZone = fmt === '45' ? 290 : 540;
  const capTops = [];
  console.log(`── ${fmt === '45' ? '4:5' : '9:16'} ──`);
  for (const [name, kind, a, b] of SHOTS) {
    const t = Math.max(a, b - 0.3), png = join(tmp, `${fmt}-${t}.png`);
    const r = spawnSync('node', [join(here, 'render.mjs'), 'stills', fmt, png, String(t), '1'], { env: { ...process.env, QA: '1' }, stdio: ['ignore', 'ignore', 'inherit'] });
    if (r.status !== 0) { console.log(`${name}: η απόδοση απέτυχε`); fails++; continue; }
    const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 64 << 20 }).stdout;
    let L = W, R = -1, capTop = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (raw[y * W + x] <= 22) continue;
      if (x < L) L = x; if (x > R) R = x;
      if (y < capZone && capTop < 0 && kind === 'wide') capTop = y;
    }
    const left = L, right = W - 1 - R;
    const okL = Math.abs(left - GX) <= TOL;
    const okR = kind === 'wide' ? Math.abs(right - GX) <= TOL : right >= GX - TOL;
    if (kind === 'wide') capTops.push(capTop);
    const bad = !okL || !okR;
    if (bad) fails++;
    console.log(`${bad ? '✗' : '✓'} ${name} (${t.toFixed(1)}″): αριστερά ${left} px · δεξιά ${right} px${kind === 'wide' ? ` · λεζάντα από y ${capTop}` : ''}`);
  }
  const lo = Math.min(...capTops), hi = Math.max(...capTops);
  const okCap = hi - lo <= TOL;
  if (!okCap) fails++;
  console.log(`${okCap ? '✓' : '✗'} λεζάντες: πάνω άκρο ${lo} έως ${hi} px (διαφορά ${hi - lo})`);
}
rmSync(tmp, { recursive: true, force: true });
if (fails) { console.log(`ΑΠΟΤΥΧΙΕΣ: ${fails}`); process.exit(1); }
console.log('✓ στοίχιση και περιθώρια εντός ±4 px');
