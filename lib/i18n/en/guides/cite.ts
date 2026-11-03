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

/**
 * Ελληνικό κεφαλαίο γράμμα θέσης (Α έως Η) στο λατινικό της ίδιας θέσης: το
 * «39Β» ενός άρθρου γίνεται «39B», η ενεργειακή κατηγορία «Γ» γίνεται «C»
 * (ίδια σειρά με την ευρωπαϊκή κλίμακα A έως G). Αλλιώς κενό.
 */
export function greekLetterEn(c: string): string {
  const n = (c.codePointAt(0) ?? 0) - 0x0390;
  return n >= 1 && n <= 7 ? 'ABCDEFG'[n - 1] : '';
}

/** Ολοι οι αριθμοί νόμων μιας παραπομπής, με τη σειρά: «ν.4172/2013 … ν.5073/2023» → «Law 4172/2013», «Law 5073/2023». */
export const lawsIn = (s: string): string[] => (s.match(/\d+\/\d{4}(?!\d)/g) ?? []).map(n => `Law ${n}`);

/** Το πρώτο άρθρο μιας παραπομπής με το γράμμα του: «άρθρο 39Β ΚΦΕ …» → «Article 39B». */
export function firstArticleEn(s: string): string {
  const m = /(\d+)(\S?)/.exec(s);
  return m ? `Article ${m[1]}${greekLetterEn(m[2] ?? '')}` : '';
}

/** «ΦΕΚ Β΄ 7200/31.12.2025» → «Government Gazette B 7200/31.12.2025». */
export function gazetteEn(fek: string): string {
  const num = /(\d+\/[\d.]+)\s*$/.exec(fek)?.[1] ?? '';
  const series = [...fek].map(seriesOf).find(Boolean) ?? '';
  return `Government Gazette ${series ? series + ' ' : ''}${num}`.trim();
}

/** «ν.5313/2026» → «Law 5313/2026». */
export const lawEn = (law: string): string => `Law ${/(\d+\/\d+)/.exec(law)?.[1] ?? law}`;

/**
 * «ΚΥΑ 225563 ΕΞ 2025» → «Joint Ministerial Decision 225563/2025»· «ΚΥΑ
 * Α.1153/2025» → «Joint Ministerial Decision A.1153/2025» (το «Α.» της ΑΑΔΕ
 * μένει). Ο αριθμός και το έτος διαβάζονται ΠΡΙΝ από την παρένθεση του ΦΕΚ.
 */
export function kyaEn(kya: string): string {
  const head = kya.split('(')[0];
  const n = head.match(/\d+/g) ?? [];
  const pre = /\u0391\.\s*\d/.test(head) ? 'A.' : '';
  return `Joint Ministerial Decision ${pre}${n.length >= 2 ? `${n[0]}/${n[n.length - 1]}` : n[0] ?? kya}`;
}

/** «ΚΥΑ 86272/ΕΞ2026 (ΦΕΚ Β΄ 3058/02.06.2026)» → «Joint Ministerial Decision 86272/2026 (Government Gazette B 3058/02.06.2026)». */
export function kyaWithGazetteEn(kya: string): string {
  const fek = /\(([^)]*)\)/.exec(kya)?.[1];
  return fek ? `${kyaEn(kya)} (${gazetteEn(fek)})` : kyaEn(kya);
}

/** «5 παρ. 2» → «Article 5(2)». */
export function articleEn(a: string): string {
  const n = a.match(/\d+/g) ?? [];
  return n.length >= 2 ? `Article ${n[0]}(${n[1]})` : `Article ${n[0] ?? a}`;
}

const WORDS: Record<number, string> = {
  1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve',
};
/** 2 → «two». */
export const countEn = (n: number): string => WORDS[n] ?? String(n);
