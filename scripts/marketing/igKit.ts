// ═══════════════════════════════════════════════════════════════════════════
// Η ΤΑΥΤΟΤΗΤΑ ΤΩΝ ΕΙΚΟΝΩΝ ΤΟΥ INSTAGRAM, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Stories (stories.ts) και carousel (carousel.ts) μοιράζονται παλέτα,
// γραμματοσειρά, σήμα, εικονίδια και κόκκο. Γραμμένα δύο φορές, θα
// απομακρύνονταν μεταξύ τους στην πρώτη αλλαγή και η σελίδα του λογαριασμού
// θα έμοιαζε με δύο διαφορετικές μάρκες.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_PATHS, BRAND_VIEWBOX } from '../../components/BrandMark';

const ROOT = process.cwd();

// ── Η παλέτα του shell.ts, με ένα πράσινο μόνο για το «έγινε» ──────────────
export const C = {
  ground: '#070b12', panel: '#0e1522', lift: '#131c2c', ink: '#eef2f7', muted: '#bcc6d3', faint: '#8795a8',
  accent: '#8ab4f8', onAccent: '#08111f', rule: '#223044', ok: '#7fd8a8', paper: '#f3f5f9', paperInk: '#1a2332',
};

const FONT_DIR = join(ROOT, 'public/fonts');
const font = (file: string) =>
  `url("data:font/woff2;base64,${readFileSync(join(FONT_DIR, file)).toString('base64')}") format("woff2")`;
export const FACES = `
  @font-face{font-family:Inter;src:${font('inter-greek.woff2')};font-weight:100 900;font-display:block}
  @font-face{font-family:Inter;src:${font('inter-latin.woff2')};font-weight:100 900;font-display:block}`;

/** Η δεύτερη φωνή: Roboto Mono για ετικέτες, κλίμακες και αρίθμηση. */
export const MONO_FACES = `
  @font-face{font-family:'Roboto Mono';src:${font('robotomono-greek.woff2')};font-weight:100 700;font-display:block}
  @font-face{font-family:'Roboto Mono';src:${font('robotomono-latin.woff2')};font-weight:100 700;font-display:block}`;

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Εικονίδια, γραμμένα εδώ ώστε να μη χρειάζεται βιβλιοθήκη ─────────────
export const ico = {
  check: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>`,
  doc: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>`,
  folder: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 13l2.5 2.5L16 10"/></svg>`,
  down: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`,
  arrow: (c: string, px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
};
export const mark = (px: number, fill: string) =>
  `<svg width="${px}" height="${px}" viewBox="${BRAND_VIEWBOX}" fill="${fill}" aria-hidden="true">${BRAND_PATHS.shape.map((d: string) => `<path d="${d}"/>`).join('')}</svg>`;

// Κόκκος: ένα φύλλο θορύβου στο 5%. Χωρίς αυτόν οι λάμψεις του φόντου
// σκαλώνουν σε λωρίδες όταν το Instagram ξανασυμπιέζει την εικόνα.
export const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;

