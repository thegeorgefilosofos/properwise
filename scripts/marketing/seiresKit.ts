// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΣΕΙΡΕΣ ΤΟΥ INSTAGRAM: ΤΟ ΚΑΔΡΟ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Κάθε επεισόδιο γράφεται ΜΙΑ φορά ως διαφάνειες και βγαίνει σε δύο μορφές:
//   · story 1080×1920, με τις ζώνες του Instagram άδειες (πάνω η μπάρα
//     προόδου, κάτω το πεδίο απάντησης) και χώρο για τα αυτοκόλλητα
//   · carousel 1080×1440, το 3:4 που δείχνει πλέον το πλέγμα του προφίλ
// Γραμμένες δύο φορές, οι δύο μορφές θα έλεγαν διαφορετικά πράγματα στην
// πρώτη διόρθωση.
//
// ΤΑ ΧΡΩΜΑΤΑ ΕΙΝΑΙ ΤΗΣ ΜΑΡΚΑΣ, ΣΕ ΚΑΘΕ ΣΕΙΡΑ. Η πρώτη εκδοχή έδινε σε κάθε
// σειρά δικό της έδαφος (ελιά, Αιγαίο, χαρτί) και ο ιδιοκτήτης την απέρριψε:
// «δεν είναι στα χρώματά μας». Το προφίλ πρέπει να μοιάζει με μία μάρκα, ίδια
// με τα stories και το carousel που έχουν ήδη ανέβει (igKit, rentFacts.SEG).
// Η σειρά ξεχωρίζει από το σύμβολο και το όνομά της στη σφραγίδα, όχι από
// το χρώμα. Γραμματοσειρές μόνο οι δικές μας (Inter, Roboto Mono).
// ═══════════════════════════════════════════════════════════════════════════
import { C, FACES, MONO_FACES, GRAIN, esc, ico, mark } from './igKit';
import { SEG } from './rentFacts';

export type SeriesKey = 'makro' | 'vraxy' | 'foroi';
export type Format = 'story' | 'feed';

export interface Palette {
  name: string;
  /** Η μέρα της εβδομάδας που βγαίνει η σειρά. */
  day: string;
  /** Το σύμβολο της σειράς (σώμα SVG σε κουτί 24×24), στη σφραγίδα και στο Highlight. */
  glyph: string;
  ground: string; panel: string; lift: string; card: string; rule: string;
  ink: string; muted: string; faint: string;
  accent: string; onAccent: string;
  /** Το «μένει» και το «έγινε»: καθαρά, μακροχρόνια. */
  ok: string;
  /** Το «φεύγει»: φόρος, προμήθεια, κόστος. Το ίδιο σομόν με το carousel. */
  neg: string;
  /** Ο ΕΝΦΙΑ και ό,τι είναι προθεσμία: το κεχριμπαρένιο του carousel. */
  warm: string;
}

const BRAND = {
  ground: C.ground, panel: C.panel, lift: C.lift, card: C.panel, rule: C.rule,
  ink: C.ink, muted: C.muted, faint: C.faint, accent: C.accent, onAccent: C.onAccent,
  ok: C.ok, neg: SEG.tax, warm: SEG.enfia,
};

export const SERIES: Record<SeriesKey, Palette> = {
  makro: { ...BRAND, name: 'Μακροχρόνια', day: 'Δευτέρα',
    glyph: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>' },
  vraxy: { ...BRAND, name: 'Βραχυχρόνια', day: 'Τετάρτη',
    glyph: '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M5 12h14"/>' },
  foroi: { ...BRAND, name: 'Φόροι και προθεσμίες', day: 'Παρασκευή',
    glyph: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 10h16"/><path d="M9 15l2 2 4-4"/>' },
};

/** Το σύμβολο ως SVG, σε όποιο μέγεθος και χρώμα. */
export const glyph = (g: string, c: string, px: number, sw = 1.8) =>
  `<svg width="${px}" height="${px}" viewBox="0 0 24 24" style="color:${c}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${g}</svg>`;

export const SIZE: Record<Format, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1440 },
};

/** Οι ζώνες του story που καλύπτει το ίδιο το Instagram. */
export const STORY_SAFE = { top: 220, bottom: 1920 - 250, side: 40 };

export interface Slide {
  /** Τι λέει η διαφάνεια, για το εναλλακτικό κείμενο. */
  alt: string;
  /** Το σώμα της διαφάνειας. Παίρνει τη μορφή, ώστε να προσαρμόζει μεγέθη. */
  body: (f: Format) => string;
  /** Μόνο για story: ποιο αυτοκόλλητο μπαίνει και πού. Κενό αν κανένα. */
  sticker?: string;
  /** Μόνο σε μία από τις δύο μορφές. */
  only?: Format;
}

export interface Episode {
  series: SeriesKey;
  no: number;
  /** Ο τίτλος του επεισοδίου, όπως γράφεται στο «Επόμενο επεισόδιο». */
  title: string;
  /** Πού καταλήγει: οδηγός ή υπολογιστής του site. */
  link: { url: string; label: string };
  slides: Slide[];
  /** Η λεζάντα του carousel, παραγόμενη: τα ψηφία της βγαίνουν από κώδικα. */
  caption: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Το κοινό κάδρο. Πάνω η σφραγίδα της σειράς και ο αριθμός επεισοδίου,
 * πίσω ο αριθμός σε τεράστιο περίγραμμα, κάτω το σήμα. Ίδιες θέσεις σε
 * κάθε διαφάνεια, ώστε η σειρά να διαβάζεται ως ένα πράγμα.
 */
export function shell(f: Format, s: Palette, ep: { no: number }, i: number, n: number, body: string, css: string): string {
  const { w, h } = SIZE[f];
  const story = f === 'story';
  const top = story ? 236 : 88;
  const foot = story ? 1560 : h - 128;
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${FACES}${MONO_FACES}
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--h1:${story ? 132 : 112}px;--h2:${story ? 96 : 84}px;--h3:${story ? 64 : 56}px;--body:${story ? 30 : 28}px}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{font-family:Inter,system-ui,sans-serif;color:${s.ink};background:${s.ground};position:relative;
    -webkit-font-smoothing:antialiased;font-feature-settings:"cv11","ss01"}
  /* Το έδαφος των stories που έχουν ήδη ανέβει (stories.ts, frame). */
  .bg{position:absolute;inset:0;background:
    radial-gradient(900px 700px at 85% 10%, ${s.accent}2e, transparent 70%),
    radial-gradient(1000px 800px at 0% 92%, #3d5fa033, transparent 72%),
    linear-gradient(180deg, #0a1120 0%, ${s.ground} 55%)}
  .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.05;mix-blend-mode:overlay}
  .ghost{position:absolute;right:-170px;bottom:${story ? 120 : -40}px;opacity:.035}
  .wrap{position:absolute;left:0;right:0;top:${top}px;height:${foot - top - 24}px;padding:0 ${story ? 84 : 88}px;display:flex;flex-direction:column}
  .stamp{display:flex;align-items:center;justify-content:space-between;font-family:'Roboto Mono',monospace;font-size:${story ? 23 : 21}px;letter-spacing:.14em;font-weight:500}
  .stamp b{display:flex;align-items:center;gap:14px;font-weight:600;color:${s.ink}}
  .stamp b i{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:14px;background:${s.accent}1f;border:1.5px solid ${s.accent}55}
  .stamp span{color:${s.faint}}
  .dots{display:flex;gap:8px}
  .dots i{width:30px;height:5px;border-radius:5px;background:${s.rule}}
  .dots i.on{background:${s.accent}}
  h1,h2{font-weight:800;letter-spacing:-.045em;line-height:.96;text-wrap:balance}
  .acc{color:${s.accent}}
  .ok{color:${s.ok}}
  .lead{color:${s.muted};font-size:${story ? 40 : 36}px;line-height:1.36;letter-spacing:-.012em;text-wrap:pretty}
  .mono{font-family:'Roboto Mono',monospace;letter-spacing:.08em}
  .num{font-variant-numeric:tabular-nums;letter-spacing:-.025em}
  .src{font-family:'Roboto Mono',monospace;font-size:${story ? 21 : 19}px;letter-spacing:.04em;color:${s.faint};line-height:1.5}
  .ex{display:inline-flex;align-items:center;gap:10px;font-family:'Roboto Mono',monospace;font-size:${story ? 19 : 18}px;letter-spacing:.14em;color:${s.faint}}
  .ex::before{content:"";width:9px;height:9px;border-radius:50%;background:${s.faint}}
  .card{background:linear-gradient(180deg, ${s.lift}f2, ${s.panel}f2);border:1.5px solid ${s.rule};border-radius:36px;
    box-shadow:0 1px 0 #ffffff0d inset, 0 50px 120px -40px #000000cc}
  /* Η λωρίδα του αυτοκόλλητου: άδεια και αόρατη, αλλιώς φαίνεται κάτω από αυτό. */
  .slot{flex:none}
  /* Η Νόα: το ίδιο τετράγωνο με το αρχικό της, όπως στην καμπάνια. */
  .noa-av{flex:none;display:flex;align-items:center;justify-content:center;border-radius:22%;background:${s.accent};color:${s.onAccent};font-weight:800;letter-spacing:-.04em}
  .foot{position:absolute;left:${story ? 84 : 88}px;right:${story ? 84 : 88}px;top:${foot}px;display:flex;align-items:center;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:14px}
  .brand b{font-size:${story ? 27 : 25}px;font-weight:800;letter-spacing:.02em}
  .brand small{display:block;font-size:${story ? 20 : 19}px;color:${s.faint};margin-top:2px}
  .swipe{display:flex;align-items:center;gap:10px;font-family:'Roboto Mono',monospace;font-size:21px;letter-spacing:.12em;color:${s.faint}}
  ${css}
  </style></head><body>
  <div class="bg"></div><div class="grain"></div>
  <div class="ghost">${mark(story ? 760 : 640, s.ink)}</div>
  <div class="wrap">
    <div class="stamp"><b><i>${glyph(s.glyph, s.accent, 26, 2)}</i>${esc(s.name.toLocaleUpperCase('el').normalize('NFD').replace(/[́̈]/g, '').normalize('NFC'))}</b><span>ΕΠΕΙΣΟΔΙΟ ${pad2(ep.no)}</span></div>
    ${body}
  </div>
  <div class="foot">
    <div class="brand">${mark(40, s.ink)}<div><b>PROPERWISE</b><small>properwise.gr</small></div></div>
    ${story ? `<div class="dots">${Array.from({ length: n }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>` : (i < n - 1 ? `<div class="swipe">ΣΥΡΕ ${ico.arrow(s.faint, 24)}</div>` : `<div class="swipe">${i + 1} / ${n}</div>`)}
  </div>
  </body></html>`;
}

/** Το εξώφυλλο του Highlight: το σύμβολο στο κέντρο, μέσα στον κύκλο που κόβει το Instagram. */
export function highlight(g: string): string {
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${FACES}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1920px;overflow:hidden}
  body{background:${C.ground};display:flex;align-items:center;justify-content:center}
  /* Το Instagram κόβει κύκλο στο κέντρο και βάζει δικό του δαχτυλίδι: το σύμβολο
     γεμίζει τον κύκλο, χωρίς δικό μας περίγραμμα που θα διπλασίαζε το δικό του. */
  .c{width:1080px;height:1080px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 35% 30%, ${C.accent}33, ${C.ground} 68%)}
  </style></head><body><div class="c">${glyph(g, C.accent, 520, 1.6)}</div></body></html>`;
}
