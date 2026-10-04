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
// ΚΑΘΕ ΣΕΙΡΑ ΕΧΕΙ ΤΟ ΔΙΚΟ ΤΗΣ ΕΔΑΦΟΣ. Ο θεατής πρέπει να ξέρει από το χρώμα,
// πριν διαβάσει λέξη, ποια σειρά βλέπει: αυτό κάνει τη σειρά ραντεβού.
//   · Μακροχρόνια: σκούρα ελιά, το σπίτι που μένει
//   · Βραχυχρόνια: βαθύ Αιγαίο με ήλιο, η σεζόν
//   · Φόροι και προθεσμίες: χαρτί και σφραγίδα, το έντυπο της εφορίας. Η
//     μόνη φωτεινή σειρά, ώστε το προφίλ να μη μοιάζει με έναν σκούρο τοίχο.
// Γραμματοσειρές μόνο οι δικές μας (Inter, Roboto Mono), από το public/fonts.
// ═══════════════════════════════════════════════════════════════════════════
import { FACES, MONO_FACES, GRAIN, esc, ico, mark } from './igKit';

export type SeriesKey = 'makro' | 'vraxy' | 'foroi';
export type Format = 'story' | 'feed';

export interface Palette {
  name: string;
  /** Η μέρα της εβδομάδας που βγαίνει η σειρά. */
  day: string;
  light: boolean;
  ground: string; ground2: string; card: string; rule: string;
  ink: string; muted: string; faint: string;
  accent: string; onAccent: string; accent2: string;
  /** Το χρώμα του «φεύγει»: φόρος, προμήθεια, κόστος. */
  neg: string;
}

export const SERIES: Record<SeriesKey, Palette> = {
  makro: {
    name: 'Μακροχρόνια', day: 'Δευτέρα', light: false,
    ground: '#0d1a15', ground2: '#16291f', card: '#132219', rule: '#27392f',
    ink: '#eef3ec', muted: '#bccabf', faint: '#8a9c90',
    accent: '#c9e36b', onAccent: '#13200f', accent2: '#8fd3a7', neg: '#ff9d86',
  },
  vraxy: {
    name: 'Βραχυχρόνια', day: 'Τετάρτη', light: false,
    ground: '#061a2e', ground2: '#0b2d4f', card: '#0b2540', rule: '#1d3b5a',
    ink: '#eef5fb', muted: '#b6cadc', faint: '#8199b0',
    accent: '#ffc94a', onAccent: '#241703', accent2: '#5fd0c5', neg: '#ff8f7a',
  },
  foroi: {
    name: 'Φόροι και προθεσμίες', day: 'Παρασκευή', light: true,
    ground: '#eef1f5', ground2: '#e2e7ee', card: '#ffffff', rule: '#cfd6e0',
    ink: '#0f1a2a', muted: '#3a485c', faint: '#66748a',
    accent: '#d33f29', onAccent: '#ffffff', accent2: '#2456c9', neg: '#c2391f',
  },
};

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
  const glow = s.light
    ? `radial-gradient(1100px 800px at 100% 0%, ${s.accent2}14, transparent 70%), linear-gradient(180deg, ${s.ground} 0%, ${s.ground2} 100%)`
    : `radial-gradient(1000px 760px at 90% 6%, ${s.accent}24, transparent 68%), radial-gradient(1100px 900px at 0% 100%, ${s.accent2}1c, transparent 70%), linear-gradient(180deg, ${s.ground2} 0%, ${s.ground} 62%)`;
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${FACES}${MONO_FACES}
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--h1:${story ? 132 : 112}px;--h2:${story ? 96 : 84}px;--h3:${story ? 64 : 56}px;--body:${story ? 30 : 28}px}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{font-family:Inter,system-ui,sans-serif;color:${s.ink};background:${s.ground};position:relative;
    -webkit-font-smoothing:antialiased;font-feature-settings:"cv11","ss01"}
  .bg{position:absolute;inset:0;background:${glow}}
  .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:${s.light ? '.035' : '.05'};mix-blend-mode:${s.light ? 'multiply' : 'overlay'}}
  .epno{position:absolute;right:-60px;bottom:${story ? 260 : 60}px;font-size:${story ? 820 : 640}px;font-weight:900;line-height:.8;letter-spacing:-.07em;
    color:transparent;-webkit-text-stroke:3px ${s.light ? s.ink + '10' : s.ink + '0d'};font-variant-numeric:tabular-nums}
  .wrap{position:absolute;left:0;right:0;top:${top}px;height:${foot - top - 24}px;padding:0 ${story ? 84 : 88}px;display:flex;flex-direction:column}
  .stamp{display:flex;align-items:center;justify-content:space-between;font-family:'Roboto Mono',monospace;font-size:${story ? 23 : 21}px;letter-spacing:.14em;font-weight:500}
  .stamp b{display:flex;align-items:center;gap:14px;font-weight:600;color:${s.ink}}
  .stamp b i{width:16px;height:16px;border-radius:50%;background:${s.accent};box-shadow:0 0 0 6px ${s.accent}2e}
  .stamp span{color:${s.faint}}
  .dots{display:flex;gap:8px}
  .dots i{width:30px;height:5px;border-radius:5px;background:${s.rule}}
  .dots i.on{background:${s.accent}}
  h1,h2{font-weight:800;letter-spacing:-.045em;line-height:.96;text-wrap:balance}
  .acc{color:${s.accent}}
  .acc2{color:${s.accent2}}
  .lead{color:${s.muted};font-size:${story ? 40 : 36}px;line-height:1.36;letter-spacing:-.012em;text-wrap:pretty}
  .mono{font-family:'Roboto Mono',monospace;letter-spacing:.08em}
  .num{font-variant-numeric:tabular-nums;letter-spacing:-.025em}
  .src{font-family:'Roboto Mono',monospace;font-size:${story ? 21 : 19}px;letter-spacing:.04em;color:${s.faint};line-height:1.5}
  .ex{display:inline-flex;align-items:center;gap:10px;font-family:'Roboto Mono',monospace;font-size:${story ? 19 : 18}px;letter-spacing:.14em;color:${s.faint}}
  .ex::before{content:"";width:9px;height:9px;border-radius:50%;background:${s.faint}}
  .card{background:${s.card};border:1.5px solid ${s.rule};border-radius:36px;
    box-shadow:${s.light ? `0 30px 80px -40px ${s.ink}40` : '0 1px 0 #ffffff0d inset, 0 50px 120px -40px #000000c0'}}
  /* Η λωρίδα του αυτοκόλλητου: άδεια και αόρατη, αλλιώς φαίνεται κάτω από αυτό. */
  .slot{flex:none}
  .foot{position:absolute;left:${story ? 84 : 88}px;right:${story ? 84 : 88}px;top:${foot}px;display:flex;align-items:center;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:14px}
  .brand b{font-size:${story ? 27 : 25}px;font-weight:800;letter-spacing:.02em}
  .brand small{display:block;font-size:${story ? 20 : 19}px;color:${s.faint};margin-top:2px}
  .swipe{display:flex;align-items:center;gap:10px;font-family:'Roboto Mono',monospace;font-size:21px;letter-spacing:.12em;color:${s.faint}}
  ${css}
  </style></head><body>
  <div class="bg"></div><div class="grain"></div>
  <div class="epno">${pad2(ep.no)}</div>
  <div class="wrap">
    <div class="stamp"><b><i></i>${esc(s.name.toLocaleUpperCase('el').normalize('NFD').replace(/[́̈]/g, '').normalize('NFC'))}</b><span>ΕΠΕΙΣΟΔΙΟ ${pad2(ep.no)}</span></div>
    ${body}
  </div>
  <div class="foot">
    <div class="brand">${mark(40, s.ink)}<div><b>PROPERWISE</b><small>properwise.gr</small></div></div>
    ${story ? `<div class="dots">${Array.from({ length: n }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>` : (i < n - 1 ? `<div class="swipe">ΣΥΡΕ ${ico.arrow(s.faint, 24)}</div>` : `<div class="swipe">${i + 1} / ${n}</div>`)}
  </div>
  </body></html>`;
}

/** Το εξώφυλλο του Highlight: ένα σύμβολο στο κέντρο, μέσα στον κύκλο που κόβει το Instagram. */
export function highlight(s: Palette, glyph: string): string {
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><style>${FACES}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1920px;overflow:hidden}
  body{background:${s.ground};display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif}
  /* Το Instagram κόβει κύκλο στο κέντρο και βάζει δικό του δαχτυλίδι: το σύμβολο
     γεμίζει τον κύκλο, χωρίς δικό μας περίγραμμα που θα διπλασίαζε το δικό του. */
  .c{width:1080px;height:1080px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 35% 30%, ${s.ground2}, ${s.ground} 70%)}
  </style></head><body><div class="c">${glyph}</div></body></html>`;
}
