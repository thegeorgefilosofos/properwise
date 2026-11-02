// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΠΑΡΑΠΟΜΠΕΣ ΤΩΝ ΟΔΗΓΩΝ ΣΤΑ ΑΓΓΛΙΚΑ, ΑΠΟ ΤΙΣ ΙΔΙΕΣ ΣΤΑΘΕΡΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Οι ελληνικοί οδηγοί διαβάζουν ΦΕΚ, νόμους και αποφάσεις από σταθερές (π.χ.
// lib/market/greekMarket.ts: «ΦΕΚ Β΄ 7200/31.12.2025», «ν.5313/2026»). Εδώ
// γράφονται στα αγγλικά με τον ίδιο κανόνα του TOOL_SOURCES_EN («Law
// 5246/2025», «Government Gazette B 7200/31.12.2025») και τους ΙΔΙΟΥΣ αριθμούς,
// που διαβάζονται από τη σταθερά· δεν ξαναγράφεται κανένας με το χέρι.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Η σειρά του ΦΕΚ (Α, Β, Γ, Δ) με λατινικό γράμμα, από τη θέση του γράμματος
 * στο ελληνικό αλφάβητο (U+0391 = 1). Το αγγλικό αρχείο δεν γράφει ελληνικά.
 */
const seriesOf = (c: string): string => {
  const n = (c.codePointAt(0) ?? 0) - 0x0390;
  return n >= 1 && n <= 4 ? 'ABCD'[n - 1] : '';
};

/** «ΦΕΚ Β΄ 7200/31.12.2025» → «Government Gazette B 7200/31.12.2025». */
export function gazetteEn(fek: string): string {
  const num = /(\d+\/[\d.]+)\s*$/.exec(fek)?.[1] ?? '';
  const series = [...fek].map(seriesOf).find(Boolean) ?? '';
  return `Government Gazette ${series ? series + ' ' : ''}${num}`.trim();
}

/** «ν.5313/2026» → «Law 5313/2026». */
export const lawEn = (law: string): string => `Law ${/(\d+\/\d+)/.exec(law)?.[1] ?? law}`;

/** «ΚΥΑ 225563 ΕΞ 2025» → «Joint Ministerial Decision 225563/2025». */
export function kyaEn(kya: string): string {
  const n = kya.match(/\d+/g) ?? [];
  return `Joint Ministerial Decision ${n.length >= 2 ? `${n[0]}/${n[n.length - 1]}` : n[0] ?? kya}`;
}

/** «5 παρ. 2» → «Article 5(2)». */
export function articleEn(a: string): string {
  const n = a.match(/\d+/g) ?? [];
  return n.length >= 2 ? `Article ${n[0]}(${n[1]})` : `Article ${n[0] ?? a}`;
}

const WORDS: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' };
/** 2 → «two». */
export const countEn = (n: number): string => WORDS[n] ?? String(n);
