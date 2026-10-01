// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΙΚΟΝΕΣ ΤΟΥ ΚΑΤΑΣΤΗΜΑΤΟΣ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΑ ΙΔΙΑ ΤΑ ΠΑΚΕΤΑ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΠΑΡΑΓΟΝΤΑΙ ΚΑΙ ΔΕΝ ΣΧΕΔΙΑΖΟΝΤΑΙ ΜΙΑ ΦΟΡΑ. Το κατάστημα δείχνει τιμή,
// όριο ακινήτων, χαρακτηριστικά και πακέτο ερωτήσεων. Και τα τέσσερα ζουν ήδη
// στον κώδικα (lib/billing/plans.ts, aiLimits.ts) και αλλάζουν. Μια εικόνα
// φτιαγμένη με το χέρι θα έλεγε την παλιά τιμή την επομένη μιας αλλαγής, σε
// σελίδα όπου ο επισκέπτης βγάζει κάρτα. Ενα λάθος νούμερο εκεί δεν είναι
// αισθητικό θέμα.
//
// ΤΡΕΙΣ ΕΙΚΟΝΕΣ ΑΝΑ ΠΑΚΕΤΟ, ΤΡΕΙΣ ΔΙΑΦΟΡΕΤΙΚΕΣ ΕΡΩΤΗΣΕΙΣ:
//   1. «Τι είναι» — τετράγωνη, για τη μικρογραφία του προϊόντος.
//   2. «Τι περιλαμβάνει» — πλατιά, η λίστα καθαρή.
//   3. «Τι κοστίζει» — πλατιά, μήνας και χρόνος δίπλα δίπλα.
//
// ΤΟ ΣΥΣΤΗΜΑ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕ ΤΙΣ ΑΝΑΡΤΗΣΕΙΣ: ίδιο έδαφος, ίδιο μελάνι, ίδια
// γραμματοσειρά, ίδια υπογραφή κάτω αριστερά. Η σύνθεση αλλάζει ανά ερώτηση.
//
// ΧΡΗΣΗ:  npx tsx scripts/brand/store.ts
//
// ΚΑΜΙΑ ΔΟΚΙΜΗ ΣΤΙΣ ΣΕΛΙΔΕΣ ΤΟΥ ΕΜΠΟΡΟΥ (27.09.2026). Οι εικόνες και η περιγραφή
// έλεγαν «30 ημέρες δωρεάν δοκιμή». Η δοκιμή όμως τρέχει ΜΕΣΑ στην εφαρμογή, από
// την ημέρα του λογαριασμού και χωρίς κάρτα (trialState στο entitlements.ts)·
// στο ταμείο του εμπόρου η χρέωση ξεκινά την ίδια μέρα. Υπόσχεση δοκιμής πάνω
// από κουμπί πληρωμής που χρεώνει αμέσως είναι παραπλανητική.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { PLANS, PLAN_ORDER, type PlanId } from '../../lib/billing/plans';
import { aiLimitsFor } from '../../lib/billing/aiLimits';
import { fe, grUpper } from '../../lib/core/format';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { chromePath } = require('../lib/chrome.mjs');
const CHROME: string = chromePath();

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs/marketing/store');
mkdirSync(OUT, { recursive: true });

// ── Το σήμα διαβάζεται από το ΙΔΙΟ αρχείο που το ζωγραφίζει η εφαρμογή ──────
const markSrc = readFileSync(join(ROOT, 'components/BrandMark.tsx'), 'utf8');
const shapeBlock = markSrc.slice(markSrc.indexOf('const SHAPE = ['), markSrc.indexOf('];', markSrc.indexOf('const SHAPE = [')));
const SHAPE = [...shapeBlock.matchAll(/'([^']+)'/g)].map(m => m[1]);
const VIEWBOX = (markSrc.match(/BRAND_VIEWBOX = '([^']+)'/) || [])[1];
if (SHAPE.length !== 11 || !VIEWBOX) throw new Error('Το σήμα δεν διαβάστηκε από το BrandMark.tsx');
const mark = (px: number, color: string) =>
  `<svg width="${px}" height="${px}" viewBox="${VIEWBOX}" fill="${color}" fill-rule="nonzero">`
  + SHAPE.map(d => `<path d="${d}"/>`).join('') + '</svg>';

// Η ΓΡΑΜΜΑΤΟΣΕΙΡΑ ΜΠΑΙΝΕΙ ΜΕΣΑ ΣΤΟ ΑΡΧΕΙΟ. Με διεύθυνση `file://` ο περιηγητής
// δεν τη φόρτωνε (η σελίδα στήνεται με setContent, χωρίς βάση) και οι εικόνες
// του καταστήματος έβγαιναν σιωπηλά σε γραμματοσειρά συστήματος αντί για Inter.
// Ιδια λύση με το scripts/marketing/shell.ts.
const FONT_DIR = join(ROOT, 'public/fonts');
const font = (file: string) =>
  `url("data:font/woff2;base64,${readFileSync(join(FONT_DIR, file)).toString('base64')}") format("woff2")`;
const FACES = `
  @font-face{font-family:Inter;src:${font('inter-greek.woff2')};font-weight:100 900;font-display:block}
  @font-face{font-family:Inter;src:${font('inter-latin.woff2')};font-weight:100 900;font-display:block}`;

// Τα χρώματα του σκοτεινού θέματος, όπως τα γράφει το app/globals.css.
const GROUND = '#070b12', INK = '#eef2f7', MUTED = '#bcc6d3', ACCENT = '#8ab4f8', RULE = '#223044';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ΤΟ «lang» ΔΕΝ ΕΙΝΑΙ ΤΥΠΙΚΟΤΗΤΑ ΕΔΩ, ΕΙΝΑΙ ΟΡΘΟΓΡΑΦΙΑ. Χωρίς αυτό ο Chromium
// δεν εφαρμόζει τους ελληνικούς κανόνες κεφαλαιοποίησης και το
// «Συνδρομή» βγαίνει «ΣΥΝΔΡΟΜΉ», με τόνο πάνω σε κεφαλαίο.
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΛΑΙΣΙΟ ΕΙΝΑΙ ΕΝΑ ΚΑΙ ΚΑΝΕΝΑ ΚΑΡΤΕΛΑΚΙ ΔΕΝ ΤΟ ΠΑΡΑΚΑΜΠΤΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΦΤΑΙΓΕ ΣΤΗΝ ΠΡΩΤΗ ΕΚΔΟΧΗ. Κάθε εικόνα στοίβαζε το περιεχόμενό της με
// «margin-top:auto», δηλαδή το κόλλαγε στο κάτω μέρος. Οσο άλλαζε το πλήθος
// των χαρακτηριστικών ανά πακέτο —πέντε στον Ιδιοκτήτη, δύο στον Ιδιοκτήτη+,
// έξι στον Επαγγελματία— άλλαζε και το κενό στη μέση. Δώδεκα εικόνες που
// κάθονται δίπλα δίπλα στο κατάστημα και καμία δεν ευθυγραμμιζόταν με την
// άλλη. Και οι δύο στήλες της λίστας γέμιζαν κατά ΓΡΑΜΜΗ, οπότε η αριστερή
// έβγαινε τέσσερα και η δεξιά τρία.
//
// Ο ΚΑΝΟΝΑΣ. Τρεις ζώνες με σταθερό ύψος και μία που τεντώνει:
//
//     ΚΕΦΑΛΙΔΑ   σταθερό ύψος 34   κατηγορία αριστερά, πακέτο δεξιά
//     ΠΕΡΙΕΧΟΜΕΝΟ  τεντώνει        πάντα οπτικά κεντραρισμένο
//     ΓΡΑΜΜΗ       1               στο ίδιο ύψος σε κάθε εικόνα
//     ΥΠΟΓΡΑΦΗ     σταθερό ύψος 40 σήμα και τομέας
//
// Ετσι η κεφαλίδα, η γραμμή και η υπογραφή πέφτουν στο ΙΔΙΟ εικονοστοιχείο σε
// κάθε εικόνα του ίδιου μεγέθους, ό,τι κι αν γράφει από πάνω τους. Το
// περιεχόμενο κεντράρεται, οπότε δύο γραμμές ή οκτώ δίνουν το ίδιο βάρος.
// Μετριέται στο τέλος: αν κάποια ζώνη μετακινηθεί, το βήμα κοκκινίζει.
// ═══════════════════════════════════════════════════════════════════════════

/** Το περιθώριο, το ίδιο και στα δύο μεγέθη: η ταυτότητα δεν αλλάζει με τον καμβά. */
const PAD = 80;
const HEAD_H = 34;
const SIG_H = 40;

/** Η κλίμακα τύπου. Πέντε μεγέθη, κανένα ενδιάμεσο αυθαίρετο. */
const TS = { eyebrow: 22, micro: 24, body: 30, sub: 36, h2: 56, kpi: 92, hero: 104 };

// ═══════════════════════════════════════════════════════════════════════════
// ΔΥΟ ΠΡΟΪΟΝΤΑ ΑΝΑ ΠΑΚΕΤΟ, ΔΥΟ ΟΨΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// Το κατάστημα έχει ΞΕΧΩΡΙΣΤΟ προϊόν για τη μηνιαία και για την ετήσια χρέωση.
// Με τις ίδιες εικόνες και στα δύο, ο αγοραστής έβλεπε δύο πανομοιότυπες
// μικρογραφίες και έπρεπε να διαβάσει το όνομα για να καταλάβει ποια είναι
// ποια. Η ετήσια παίρνει τρία σημάδια που η μηνιαία δεν έχει: γαλάζια λωρίδα
// στην κορυφή, πιο ζεστό φως από πάνω και το «μήνες δωρεάν» σε καψούλα. Το
// πλαίσιο (κεφαλίδα, γραμμή, υπογραφή) μένει το ίδιο: είναι η ίδια μάρκα.
// ═══════════════════════════════════════════════════════════════════════════
const shell = (w: number, h: number, body: string, yearly = false) => `<!doctype html><html lang="el"><meta charset="utf-8"><style>
  ${FACES}
  *{box-sizing:border-box;margin:0}
  /* ΤΟ ΒΑΘΟΣ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕ ΤΗΣ ΕΦΑΡΜΟΓΗΣ: μια πολύ ήπια ακτινική κλίση από
     πάνω δίνει στην επιφάνεια κατεύθυνση φωτός, όπως στις κάρτες του πίνακα
     ελέγχου. Στην ετήσια το φως είναι διπλάσιο. */
  body{width:${w}px;height:${h}px;color:${INK};padding:${PAD}px;position:relative;
       background:radial-gradient(120% 90% at 50% -12%, rgba(138,180,248,${yearly ? 0.15 : 0.07}) 0%, rgba(138,180,248,0) 62%), ${GROUND};
       font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;
       display:flex;flex-direction:column}
  ${yearly ? `body::before{content:"";position:absolute;left:0;right:0;top:0;height:8px;background:linear-gradient(90deg, ${ACCENT}, #aecbfa)}` : ''}
  .head{height:${HEAD_H}px;display:flex;align-items:center;justify-content:space-between;flex:0 0 auto}
  .eyebrow{color:${ACCENT};font-size:${TS.eyebrow}px;font-weight:800;letter-spacing:0.16em;line-height:1}
  .tag{color:${MUTED};font-size:${TS.eyebrow}px;font-weight:800;letter-spacing:0.16em;line-height:1}
  .pill{color:${ACCENT};font-size:20px;font-weight:800;letter-spacing:0.14em;line-height:1;
        padding:7px 16px;border-radius:100px;background:rgba(138,180,248,0.14);border:1px solid rgba(138,180,248,0.45)}
  .zone{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;min-height:0}
  .zone.spread{justify-content:space-between;padding:34px 0}
  .rule{height:1px;background:${RULE};flex:0 0 auto}
  .sig{height:${SIG_H}px;display:flex;align-items:center;gap:14px;color:${MUTED};
       font-size:${TS.micro}px;letter-spacing:0.02em;flex:0 0 auto}
  .sig b{color:${INK};font-weight:800;letter-spacing:0.05em}
  .num{font-variant-numeric:tabular-nums;letter-spacing:-0.035em;font-weight:800}
  .strike{text-decoration:line-through;text-decoration-thickness:3px;text-decoration-color:rgba(188,198,211,0.7)}
</style>${body}`;

/**
 * Η μόνη πόρτα προς τον καμβά. Οποιος γράψει αύριο τέταρτη μορφή, θα πάρει
 * αναγκαστικά την ίδια κεφαλίδα, την ίδια γραμμή και την ίδια υπογραφή.
 * Η δεξιά ετικέτα της ετήσιας γίνεται καψούλα.
 */
const card = (w: number, h: number, left: string, right: string, zone: string, spread = false, yearly = false) =>
  shell(w, h, `
    <div class="head"><span class="eyebrow">${left}</span><span class="${yearly ? 'pill' : 'tag'}">${right}</span></div>
    <div class="zone${spread ? ' spread' : ''}">${zone}</div>
    <div class="rule foot" style="margin-bottom:26px"></div>
    <div class="sig">${mark(30, INK)}<span><b>PROPERWISE</b> · properwise.gr</span></div>`, yearly);

/** Η τιμή γράφεται μία φορά, από τη μία πηγή, με ελληνικό κόμμα. */
// Το `fe` της εφαρμογής κολλά το € στον αριθμό (στοίχιση σε στήλες). Το κείμενο
// του καταστήματος ακολουθεί τον κανόνα της γραφής: «4,99 €», με κενό.
const price = (n: number) => fe(n).replace(/€$/, '\u00a0€');

/** Το τσεκάκι, ίδιο σε κάθε γραμμή κάθε λίστας. */
const tick = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ACCENT}" stroke-width="3"
  stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto;margin-top:5px"><path d="M20 6 9 17l-5-5"/></svg>`;

type Shot = { file: string; w: number; h: number; html: string };

const PAID = PLAN_ORDER.filter(p => p !== 'free') as PlanId[];
const prevOf = (id: PlanId) => { const i = PAID.indexOf(id); return i > 0 ? PLANS[PAID[i - 1]] : null; };
const capOf = (id: PlanId) => { const m = PLANS[id].maxProperties;
  return m === Infinity ? 'Ακίνητα χωρίς όριο' : `${m} ${m === 1 ? 'ακίνητο' : 'ακίνητα'}`; };
/**
 * Η ΛΙΣΤΑ ΕΙΝΑΙ ΜΙΑ, ΓΙΑ ΕΙΚΟΝΑ ΚΑΙ ΠΕΡΙΓΡΑΦΗ. Ο «Ιδιοκτήτης με Νόα» χτίζει
 * πάνω στον δωρεάν «Ιδιοκτήτη», οπότε παίρνει και τις γραμμές εκείνου (εκτός
 * από τη σάρωση, που εδώ δεν έχει όριο). Τα ακριβότερα λένε μόνο τι προσθέτουν
 * και το «ό,τι έχει ο …» το γράφει το κείμενο δίπλα.
 */
const listFor = (id: PlanId): string[] => {
  const p = PLANS[id];
  const inherited = id === 'solo' ? PLANS.free.features.filter(f => !f.startsWith('Σάρωση')) : [];
  return [capOf(id), ...inherited, ...p.features.filter(f => !/^Έως \d|^Ακίνητα χωρίς όριο|^Απεριόριστα ακίνητα/.test(f))];
};
/** Το ένα σημείο που ξεχωρίζει κάθε πακέτο, για το τετράγωνο. */
const HIGHLIGHT: Record<string, string> = {
  solo: 'Ε2 έτοιμο για τον λογιστή',
  owner: 'Σύγκριση απόδοσης ανά ακίνητο',
  agency: 'Ομάδα με ρόλους, χωρίς όριο',
  office: 'Πρώτο στη σειρά διάθεσης',
};
const shots: Shot[] = [];

/** Τα λεφτά της ετήσιας, από την ίδια πηγή με τις τιμές. */
const round2 = (n: number) => Math.round(n * 100) / 100;
const yearMath = (id: PlanId) => {
  const p = PLANS[id];
  const freeMonths = 12 - Math.round(p.priceAnnual / p.priceMonthly);
  return {
    freeMonths,
    freeLabel: `${freeMonths} ${freeMonths === 1 ? 'μήνας' : 'μήνες'} δωρεάν`,
    perMonth: round2(p.priceAnnual / 12),
    twelve: round2(p.priceMonthly * 12),
    save: round2(p.priceMonthly * 12 - p.priceAnnual),
  };
};
const CYCLES = [
  { key: 'miniaio', yearly: false },
  { key: 'etisio', yearly: true },
] as const;
const line = (t: string) => `<div style="display:flex;align-items:flex-start;gap:16px;font-size:${TS.body}px;line-height:1.35">${tick}<span>${esc(t)}</span></div>`;

for (const id of PAID) for (const cyc of CYCLES) {
  const p = PLANS[id];
  const ai = aiLimitsFor(id).perMonth;
  const cap = capOf(id);
  const y = yearMath(id);
  const yearly = cyc.yearly;
  // Κεφαλαία ΧΩΡΙΣ τόνους: το toUpperCase() κρατά τον τόνο («ΑΚΊΝΗΤΟ»).
  const NAME = grUpper(p.name);
  const KIND = yearly ? 'ΕΤΗΣΙΑ ΣΥΝΔΡΟΜΗ' : 'ΜΗΝΙΑΙΑ ΣΥΝΔΡΟΜΗ';
  const FREE = grUpper(y.freeLabel);
  const f = (n: string) => `${id}-${cyc.key}-${n}.png`;

  // ── 1. ΤΙ ΕΙΝΑΙ. Ονομα, τρία σημεία, τιμή: τρεις ζώνες, ίδιες σε κάθε πακέτο.
  // Η ΜΕΣΗ ΗΤΑΝ ΑΔΕΙΑ. Ονομα πάνω και τιμή κάτω με σκέτο κενό ανάμεσα: σε
  // μικρογραφία του καταστήματος διαβαζόταν ως μισοτελειωμένη εικόνα. Τώρα
  // εκεί μπαίνουν τα τρία πράγματα που ξεχωρίζουν το πακέτο, πάντα τρία, ώστε
  // οι τέσσερις μικρογραφίες να έχουν το ίδιο σχήμα η μία δίπλα στην άλλη.
  const top3 = [cap, `${ai} ερωτήσεις στη Νόα τον μήνα`, HIGHLIGHT[id]];
  shots.push({
    file: f('1-tetragono'), w: 1200, h: 1200,
    html: card(1200, 1200, KIND, yearly ? FREE : grUpper(cap), `
      <div>
        <div data-k="bar" style="width:120px;height:4px;background:${ACCENT};margin-bottom:40px"></div>
        <div data-k="onoma" style="font-size:${TS.hero}px;font-weight:800;letter-spacing:-0.035em;line-height:1.02">${esc(p.name)}</div>
        <div data-k="ypotitlos" style="margin-top:20px;font-size:${TS.sub}px;color:${MUTED};line-height:1.35">${esc(p.tagline)}</div>
      </div>
      <div data-k="simeia" style="display:flex;flex-direction:column;gap:22px">${top3.map(line).join('')}</div>
      <div>
        <div class="rule" style="margin-bottom:40px"></div>
        <div data-k="timi" style="display:flex;align-items:baseline;gap:16px">
          <span class="num" style="font-size:${TS.kpi}px">${price(yearly ? p.priceAnnual : p.priceMonthly)}</span>
          <span style="font-size:${TS.sub}px;color:${MUTED}">${yearly ? 'τον χρόνο' : 'τον μήνα'}</span>
        </div>
        <div data-k="dokimi" style="margin-top:18px;font-size:${TS.body}px;color:${ACCENT};font-weight:700">${yearly
          ? `${price(y.perMonth)} τον μήνα · κερδίζεις ${price(y.save)}`
          : 'Ακυρώνεις όποτε θέλεις'}</div>
      </div>`, true, yearly),
  });

  // ── 2. ΤΙ ΠΕΡΙΛΑΜΒΑΝΕΙ. Αριστερά το πακέτο, δεξιά ΟΛΗ η λίστα. ─────────────
  // Η λίστα είναι η ΙΔΙΑ με της περιγραφής (listFor) και η αριστερή στήλη λέει
  // από πού ξεκινά το πακέτο και τι κοστίζει στη χρέωση αυτού του προϊόντος.
  const items = [...listFor(id), `${ai} ερωτήσεις στη Νόα τον μήνα`];
  const prev = prevOf(id);
  // Η ΑΛΛΑΓΗ ΓΡΑΜΜΗΣ ΕΙΝΑΙ ΕΠΙΛΟΓΗ: αλλιώς το «και επιπλέον:» έσπαγε όπου τύχαινε.
  const lead = prev ? `Ό,τι έχει ο «${esc(prev.name)}»<br>και επιπλέον:` : `Όλα όσα χρειάζεται ένα ακίνητο,<br>με τη Νόα δίπλα σου.`;
  shots.push({
    file: f('2-perilamvanei'), w: 1600, h: 900,
    html: card(1600, 900, 'ΤΙ ΠΕΡΙΛΑΜΒΑΝΕΙ', yearly ? `${NAME} · ΕΤΗΣΙΑ` : `${NAME} · ΜΗΝΙΑΙΑ`, `
      <div style="display:grid;grid-template-columns:520px 1fr;gap:0 80px;align-items:center">
        <div data-k="aristera">
          <div style="width:96px;height:4px;background:${ACCENT};margin-bottom:32px"></div>
          <div style="font-size:${TS.h2}px;font-weight:800;letter-spacing:-0.03em;line-height:1.05">${esc(p.name)}</div>
          <div style="margin-top:22px;font-size:${TS.body}px;color:${MUTED};line-height:1.45">${lead}</div>
          <div style="margin-top:36px;display:flex;align-items:baseline;gap:12px">
            <span class="num" style="font-size:${TS.h2}px;line-height:1">${price(yearly ? p.priceAnnual : p.priceMonthly)}</span>
            <span style="font-size:${TS.body}px;color:${MUTED}">${yearly ? 'τον χρόνο' : 'τον μήνα'}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:${items.length > 7 ? 16 : 22}px;padding-left:56px;border-left:1px solid ${RULE}">
          ${items.map(line).join('')}
        </div>
      </div>`, false, yearly),
  });

  // ── 3. ΤΙ ΚΟΣΤΙΖΕΙ. Η μηνιαία δείχνει τον μήνα και δίπλα την ετήσια ως ──────
  // επιλογή. Η ετήσια δείχνει τον χρόνο και δίπλα ΤΟΝ ΛΟΓΑΡΙΑΣΜΟ: δώδεκα
  // μηνιαίες διαγραμμένες, η ετήσια από κάτω, η διαφορά σε ευρώ. Ο αριθμός που
  // κερδίζεις πείθει περισσότερο από τη λέξη «έκπτωση».
  const big = (label: string, value: number, unit: string, note: string) => `
    <div data-k="kyrio" style="display:flex;flex-direction:column;align-items:flex-start">
      <div style="font-size:${TS.micro}px;color:${MUTED};letter-spacing:0.14em;font-weight:700">${label}</div>
      <div style="margin-top:14px;display:flex;align-items:baseline;gap:14px">
        <span class="num" style="font-size:${TS.kpi}px;line-height:1">${price(value)}</span>
        <span style="font-size:${TS.body}px;color:${MUTED}">${unit}</span>
      </div>
      <div style="margin-top:18px;font-size:${TS.body}px;color:${ACCENT};font-weight:700">${note}</div>
    </div>`;
  const side = yearly ? `
    <div data-k="plai" style="display:flex;flex-direction:column;gap:18px;font-size:${TS.body}px">
      <div style="font-size:${TS.micro}px;color:${MUTED};letter-spacing:0.14em;font-weight:700">Ο ΛΟΓΑΡΙΑΣΜΟΣ</div>
      <div style="display:flex;justify-content:space-between;gap:24px;color:${MUTED}"><span>12 × ${price(p.priceMonthly)}</span><span class="num strike" style="font-weight:700">${price(y.twelve)}</span></div>
      <div style="display:flex;justify-content:space-between;gap:24px"><span>Ετήσια</span><span class="num" style="font-weight:800">${price(p.priceAnnual)}</span></div>
      <div style="height:1px;background:${RULE}"></div>
      <div style="display:flex;justify-content:space-between;gap:24px;color:${ACCENT};font-weight:700"><span>Κερδίζεις</span><span class="num">${price(y.save)}</span></div>
    </div>` : `
    <div data-k="plai" style="display:flex;flex-direction:column;align-items:flex-start">
      <div style="font-size:${TS.micro}px;color:${MUTED};letter-spacing:0.14em;font-weight:700">Ή ΕΤΗΣΙΑ</div>
      <div style="margin-top:14px;display:flex;align-items:baseline;gap:12px">
        <span class="num" style="font-size:${TS.h2}px;line-height:1">${price(p.priceAnnual)}</span>
        <span style="font-size:${TS.body}px;color:${MUTED}">τον χρόνο</span>
      </div>
      <div style="margin-top:18px;font-size:${TS.body}px;color:${ACCENT};font-weight:700">${esc(y.freeLabel)}</div>
    </div>`;
  shots.push({
    file: f('3-timi'), w: 1600, h: 900,
    html: card(1600, 900, 'ΤΙΜΗ', yearly ? FREE : NAME, `
      <div style="display:grid;grid-template-columns:1fr 1px 1fr;align-items:center;gap:0 64px">
        ${yearly
          ? big('ΕΤΗΣΙΑ ΣΥΝΔΡΟΜΗ', p.priceAnnual, 'τον χρόνο', `${price(y.perMonth)} τον μήνα`)
          : big('ΜΗΝΙΑΙΑ ΣΥΝΔΡΟΜΗ', p.priceMonthly, 'τον μήνα', 'Ακυρώνεις όποτε θέλεις')}
        <div style="width:1px;height:220px;background:${RULE}"></div>
        ${side}
      </div>
      <div data-k="psila" style="margin-top:56px;padding-top:32px;border-top:1px solid ${RULE};font-size:${TS.micro}px;color:${MUTED};line-height:1.6">
        ${yearly ? 'Χρέωση μία φορά τον χρόνο.' : 'Χρέωση κάθε μήνα.'} Ακυρώνεις όποτε θέλεις και η πρόσβαση μένει ως το τέλος της περιόδου που πλήρωσες.<br>
        Οι τιμές αφορούν καταναλωτές στην Ελλάδα και περιλαμβάνουν ΦΠΑ.
      </div>`, false, yearly),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΙ ΤΑ ΛΕΚΤΙΚΑ, ΑΠΟ ΤΗΝ ΙΔΙΑ ΠΗΓΗ
// ─────────────────────────────────────────────────────────────────────────
// Η περιγραφή του καταστήματος λέει τιμή, όριο ακινήτων και τι περιλαμβάνεται.
// Γραμμένη με το χέρι, θα έλεγε την παλιά τιμή την επομένη μιας αλλαγής. Εδώ
// η πρόταση είναι σταθερή και τα νούμερα μπαίνουν από τα PLANS.
//
// ΤΙ ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΟΥΘΕΝΑ: «δωρεάν για πάντα», «απεριόριστο» εκεί που υπάρχει
// όριο, ούτε δυνατότητα που δεν έχει κυκλοφορήσει. Το κατάστημα είναι το
// σημείο όπου ο επισκέπτης βγάζει κάρτα: ό,τι υπόσχεται πρέπει να το βρει.
// ═══════════════════════════════════════════════════════════════════════════
const PITCH: Record<string, string> = {
  solo: 'Ένα ακίνητο με τα φορολογικά του σε τάξη και έναν βοηθό να ρωτάς. Το Ε2 βγαίνει έτοιμο για τον λογιστή, η δήλωση μίσθωσης ελέγχεται πριν τη στείλεις και βλέπεις τον ΕΝΦΙΑ μαζί με τις εκπτώσεις που δικαιούσαι. Ρωτάς τη Νόα με απλά λόγια και η απάντηση βγαίνει από τα δικά σου στοιχεία, όχι από γενικές συμβουλές.',
  owner: 'Από το δεύτερο ακίνητο η ερώτηση αλλάζει: ποιο σου αποδίδει και ποιο σου κοστίζει. Εδώ τα έως τρία ακίνητά σου μπαίνουν στην ίδια εικόνα και συγκρίνονται με νούμερα, ένα προς ένα. Οι νέες δυνατότητες ανοίγουν σε σένα πριν από τους υπόλοιπους.',
  agency: 'Για όσους διαχειρίζονται ακίνητα άλλων. Πελατολόγιο και χαρτοφυλάκιο σε ένα σημείο, ομάδα με ρόλους ώστε ο καθένας να βλέπει ό,τι του αναλογεί και αναφορές προς τους πελάτες σου με τη δική σου επωνυμία. Για κάθε επένδυση υπολογίζονται IRR, NPV και DSCR.',
  office: 'Για το γραφείο που μεγαλώνει και δεν θέλει να μετρά ακίνητα. Βάζεις όσα διαχειρίζεσαι, χωρίς όριο και χωρίς χρέωση ανά ακίνητο. Οι νέες δυνατότητες φτάνουν πρώτα σε σένα και έχεις άμεση επικοινωνία μαζί μας.',
};

/** Το σημείωμα παράδοσης, ίδιο σε κάθε προϊόν: η πρόσβαση ανοίγει στον λογαριασμό. */
const NOTE_TITLE = 'Πρόσβαση στο PROPERWISE';
const NOTE_BODY = [
  'Η συνδρομή σου είναι ενεργή. Συνδέσου στο https://properwise.gr/login με το email που χρησιμοποίησες στην αγορά και το πακέτο σου θα είναι ήδη ανοιχτό.',
  '',
  'Για απορίες, αλλαγή πακέτου ή ακύρωση γράψε μας στο support@properwise.gr.',
].join('\n');

/**
 * Η ΛΙΣΤΑ ΤΟΥ ΚΑΤΑΣΤΗΜΑΤΟΣ ΔΙΑΒΑΖΕΤΑΙ ΧΩΡΙΣ ΤΗΝ ΕΙΚΟΝΑ ΔΙΠΛΑ. Οι γραμμές των
 * πακέτων είναι γραμμένες για κάρτα με τικ· εδώ στέκουν μόνες τους. Το «3
 * ακίνητα» διαβάζεται ως «περιλαμβάνει τρία», ενώ είναι ταβάνι. Ο βοηθός και
 * το πακέτο ερωτήσεών του λέγονται σε μία γραμμή αντί για δύο.
 */
const STORE_WORDS: Record<string, string> = {
  'Σάρωση χωρίς όριο': 'Σάρωση εγγράφων χωρίς όριο',
  'Λογιστικό ημερολόγιο, τράπεζα': 'Λογιστικό ημερολόγιο και κινήσεις τράπεζας',
  'Πρώτο στη σειρά διάθεσης': 'Πρώτος στη σειρά για κάθε νέα δυνατότητα',
};
function storeList(id: PlanId, ai: number): string[] {
  const m = PLANS[id].maxProperties;
  const cap = m === Infinity ? 'Ακίνητα χωρίς όριο' : m === 1 ? '1 ακίνητο' : `Έως ${m} ακίνητα`;
  const noa = `Ψηφιακός βοηθός Νόα: ${ai} ερωτήσεις τον μήνα`;
  const rest = listFor(id).slice(1).filter(f => f !== 'Ψηφιακός βοηθός Νόα').map(f => STORE_WORDS[f] ?? f);
  return [cap, ...rest, noa];
}

function descriptionFor(id: PlanId, yearly: boolean): string {
  const p = PLANS[id];
  const prev = prevOf(id);
  const ai = aiLimitsFor(id).perMonth;
  const y = yearMath(id);
  // ΤΟ ΟΡΙΟ ΑΚΙΝΗΤΩΝ ΛΕΓΕΤΑΙ ΜΙΑ ΦΟΡΑ, ΩΣ ΚΟΥΚΚΙΔΑ. Και η κλίμακα λέγεται: στο
  // κατάστημα κάθε προϊόν στέκει ΜΟΝΟ του, οπότε χωρίς το «ό,τι έχει το …» ο
  // αγοραστής του «Ιδιοκτήτης+» θα διάβαζε λιγότερα από του φθηνότερου.
  const intro = prev ? `Όλα όσα έχει το πακέτο «${prev.name}». Επιπλέον:` : 'Περιλαμβάνει:';
  const money = yearly
    ? [
        `Ετήσια συνδρομή: ${price(p.priceAnnual)} τον χρόνο, με ΦΠΑ. Βγαίνει ${price(y.perMonth)} τον μήνα αντί για ${price(p.priceMonthly)}: κερδίζεις ${price(y.save)} τον χρόνο (${y.freeLabel}).`,
        'Μία χρέωση τον χρόνο. Ακυρώνεις όποτε θέλεις και η πρόσβαση μένει ως το τέλος της χρονιάς που πλήρωσες.',
      ]
    : [
        `Μηνιαία συνδρομή: ${price(p.priceMonthly)} τον μήνα, με ΦΠΑ. Χωρίς δέσμευση: ακυρώνεις όποτε θέλεις και η πρόσβαση μένει ως το τέλος του μήνα που πλήρωσες.`,
        `Αν προτιμάς ετήσια: ${price(p.priceAnnual)} τον χρόνο (${y.freeLabel}).`,
      ];
  return [
    PITCH[id], '',
    intro,
    ...storeList(id, ai).map(f => `- ${f}`), '',
    ...money, '',
    'Οι τιμές αφορούν καταναλωτές στην Ελλάδα.',
  ].join('\n');
}

function copyMarkdown(): string {
  const out: string[] = [
    '# Τα 8 προϊόντα στο κατάστημα',
    '',
    'Παράγεται από το `scripts/brand/store.ts`. Μην το γράψεις με το χέρι: τα',
    'νούμερα βγαίνουν από το `lib/billing/plans.ts` και το `aiLimits.ts`, οπότε',
    'μια αλλαγή τιμής ενημερώνει και το κείμενο και τις εικόνες. Ξανατρέξε το',
    'βήμα και αντίγραψε από εδώ.',
    '',
    '## Ίδια σε όλα τα προϊόντα',
    '',
    '- **Delivery:** μόνο **Private note** (σβήνεις License key και File download).',
    `  - Description: \`${NOTE_TITLE}\``,
    '  - Note:',
    '',
    '```',
    NOTE_BODY,
    '```',
    '',
    '- **Pricing:** Subscription · Currency **EUR** · Usage-based charges: τίποτα · Trial period: **κλειστό** · Tax included in price: **ανοιχτό** · Tax category: **SaaS**',
    '- **Checkout:** Custom fields: κανένα · Return URL: `https://properwise.gr/dashboard` · Abandoned cart recovery: κλειστό · Automatic affiliate enrollment: κλειστό',
    '',
  ];
  let n = 0;
  for (const id of PAID) for (const cyc of CYCLES) {
    n++;
    const p = PLANS[id];
    const yearly = cyc.yearly;
    const label = yearly ? 'Ετήσιο' : 'Μηνιαίο';
    const amount = (yearly ? p.priceAnnual : p.priceMonthly).toFixed(2);
    out.push(
      `## ${n} · PROPERWISE ${p.name} · ${label}`, '',
      `- **Images** (με αυτή τη σειρά): \`${id}-${cyc.key}-1-tetragono.png\`, \`${id}-${cyc.key}-2-perilamvanei.png\`, \`${id}-${cyc.key}-3-timi.png\``,
      `- **Name:** \`PROPERWISE ${p.name} · ${label}\``,
      `- **Price:** \`${amount}\` · **Billing period:** ${yearly ? 'Yearly' : 'Monthly'}`,
      `- **CREEM_PRODUCTS:** \`prod_…:${id}:${yearly ? 'annual' : 'monthly'}\``,
      '- **Description:**', '',
      '```', descriptionFor(id, yearly), '```', '',
    );
  }
  return out.join('\n');
}

// Το tsx μεταγλωττίζει σε cjs, όπου το await στο ανώτατο επίπεδο δεν υπάρχει.
// ═══════════════════════════════════════════════════════════════════════════
// Η ΟΜΟΙΟΜΟΡΦΙΑ ΜΕΤΡΙΕΤΑΙ, ΔΕΝ ΔΗΛΩΝΕΤΑΙ
// ─────────────────────────────────────────────────────────────────────────
// «Ιδιο πλαίσιο παντού» είναι ισχυρισμός. Ενα μονό `margin` σε μια μορφή αρκεί
// για να τον ακυρώσει και κανείς δεν θα το δει στη μεμονωμένη εικόνα: φαίνεται
// μόνο όταν οι δώδεκα μπουν δίπλα δίπλα στο κατάστημα, δηλαδή μπροστά στον
// πελάτη. Εδώ οι θέσεις των τεσσάρων ζωνών διαβάζονται από τον περιηγητή, ανά
// μέγεθος καμβά και πρέπει να ταυτίζονται στο εικονοστοιχείο.
// ═══════════════════════════════════════════════════════════════════════════
type Frame = { head: number; ruleY: number; sig: number; left: number } & Record<string, number>;
const frames = new Map<string, { file: string; f: Frame }[]>();

// ΤΙ ΣΥΓΚΡΙΝΕΤΑΙ ΜΕ ΤΙ ΚΑΙ ΓΙΑΤΙ ΟΧΙ ΤΑ ΠΑΝΤΑ ΜΕ ΟΛΑ.
// Οι τρεις μορφές έχουν διαφορετική σύνθεση: το τετράγωνο δεν οφείλει να
// στοιχίζεται με την πλατιά. Η σύγκριση γίνεται ΑΝΑ ΜΟΡΦΗ, ανάμεσα στα
// τέσσερα πακέτα: εκεί το περιεχόμενο είναι ίδιου είδους και κάθε απόκλιση
// είναι σφάλμα.
//
// ΚΑΙ ΔΕΝ ΑΡΚΕΙ ΤΟ ΠΛΑΙΣΙΟ. Πρώτη εκδοχή μετρούσε μόνο κεφαλίδα, γραμμή,
// υπογραφή και τα όρια της ζώνης. Δοκιμάστηκε με ένα μονό περιθώριο 62 αντί
// για 40 σε ΕΝΑ πακέτο και πέρασε πράσινη: η ζώνη έχει σταθερό ύψος, οπότε τα
// όριά της δεν κουνιούνται όταν μετακινηθεί κάτι ΜΕΣΑ της. Ελεγχος που δεν
// κοκκινίζει με το σφάλμα μπροστά του δεν είναι έλεγχος.
//
// Τώρα κάθε στοιχείο που οφείλει να πέφτει στο ίδιο ύψος φέρει «data-k» και
// μετριέται ονομαστικά.
//
// ΜΙΑ ΕΞΑΙΡΕΣΗ ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΗ. Η λίστα έχει άλλο πλήθος γραμμών ανά πακέτο
// (τέσσερις στον Ιδιοκτήτη+, οκτώ στον Επαγγελματία) και κεντράρεται, οπότε το
// ύψος εκκίνησής της ΟΦΕΙΛΕΙ να διαφέρει. Εκεί συγκρίνεται μόνο το πλαίσιο
// και ελέγχεται χωριστά αυτό που πρέπει να ισχύει μέσα στην ΙΔΙΑ εικόνα: οι
// δύο στήλες ξεκινούν στο ίδιο ύψος.
const FRAME_ONLY = /2-perilamvanei\.png$/;

async function main(): Promise<void> {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    await pg.setContent(s.html, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    // ΧΩΡΙΣ ΕΣΩΤΕΡΙΚΗ ΣΥΝΑΡΤΗΣΗ ΜΕΣΑ ΣΤΟ evaluate. Το esbuild κρατά τα ονόματα
    // με μια βοηθητική «__name», που δεν υπάρχει στον περιηγητή: το αποτέλεσμα
    // είναι «ReferenceError: __name is not defined» τη στιγμή της μέτρησης.
    const f: Frame = await pg.evaluate(`(function () {
      var q = document.querySelector.bind(document);
      var out = {
        head: Math.round(q('.head').getBoundingClientRect().top),
        ruleY: Math.round(q('.rule.foot').getBoundingClientRect().top),
        sig: Math.round(q('.sig').getBoundingClientRect().top),
        left: Math.round(q('.eyebrow').getBoundingClientRect().left)
      };
      var marked = document.querySelectorAll('[data-k]');
      for (var i = 0; i < marked.length; i++) {
        var b = marked[i].getBoundingClientRect();
        out['πάνω:' + marked[i].getAttribute('data-k')] = Math.round(b.top);
        out['αριστερά:' + marked[i].getAttribute('data-k')] = Math.round(b.left);
      }
      return out;
    })()`);
    const key = s.file.replace(/^[a-z]+-/, ''); // «miniaio-1-tetragono.png»: ανά χρέωση και μορφή
    if (!frames.has(key)) frames.set(key, []);
    frames.get(key)!.push({ file: s.file, f });
    await pg.screenshot({ path: join(OUT, s.file) });
    await ctx.close();
    console.log(`  ✓ ${s.file}  ${key}`);
  }
  await browser.close();
  writeFileSync(join(OUT, 'README.md'), copyMarkdown());

  let drift = 0;
  for (const [key, rows] of frames) {
    const base = rows[0];
    const keys = FRAME_ONLY.test(key)
      ? ['head', 'ruleY', 'sig', 'left']
      : Object.keys(base.f);
    for (const row of rows.slice(1)) {
      for (const k of keys) {
        if (row.f[k] !== base.f[k]) {
          console.error(`✗ ${row.file}: ${k} στο ${row.f[k]} ενώ το ${base.file} στο ${base.f[k]}`);
          drift++;
        }
      }
    }
    console.log(`  ${key}: ${keys.length} θέσεις ίδιες σε ${rows.length} πακέτα `
      + `(κεφαλίδα ${base.f.head}, γραμμή ${base.f.ruleY}, υπογραφή ${base.f.sig})`);
  }
  // Οι δύο στήλες της λίστας, μέσα στην ίδια εικόνα.
  for (const rows of frames.values())
    for (const row of rows) {
      const a = row.f['πάνω:stili-a'], b = row.f['πάνω:stili-b'];
      if (a !== undefined && a !== b) {
        console.error(`✗ ${row.file}: οι δύο στήλες ξεκινούν σε ${a} και ${b}`);
        drift++;
      }
    }
  if (drift) { console.error(`\n✗ ${drift} αποκλίσεις πλαισίου.`); process.exit(1); }
  console.log(`✓ ${shots.length} εικόνες και τα λεκτικά στο docs/marketing/store/`);
}

void main();
