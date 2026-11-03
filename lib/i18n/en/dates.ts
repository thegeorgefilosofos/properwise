// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΗΜΕΡΟΜΗΝΙΕΣ ΤΟΥ ΑΓΓΛΙΚΟΥ ΚΕΙΜΕΝΟΥ, ΜΙΑ ΓΡΑΦΗ (docs/i18n/GLOSSARY-EN.md §3)
// ─────────────────────────────────────────────────────────────────────────
// Το `fmtFor('en').date` γράφει «2 Nov 2026» για πίνακες και σφραγίδες. Μέσα
// σε πρόταση οι οδηγοί έγραφαν «November 1, 2026», με δικό τους πίνακα μηνών
// ο καθένας: ο ίδιος αναγνώστης διάβαζε δύο σειρές ημέρας και μήνα στην ίδια
// σελίδα. Εδώ η μία γραφή της πρότασης, με την ημέρα πρώτη όπως το `f.date`:
// «30 November 2026», «1 November», «November 2026».
// ═══════════════════════════════════════════════════════════════════════════

export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const parts = (iso: string): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/** «2026-11-30» → «30 November 2026». */
export function longDateEn(iso: string): string {
  const p = parts(iso);
  return p ? `${p[2]} ${MONTHS_EN[p[1] - 1]} ${p[0]}` : iso;
}

/** «2026-11-01» → «1 November». */
export function dayMonthEn(iso: string): string {
  const p = parts(iso);
  return p ? `${p[2]} ${MONTHS_EN[p[1] - 1]}` : iso;
}

/** Ο μήνας από το 1: 11 → «November». */
export const monthNameEn = (month1: number): string => MONTHS_EN[month1 - 1] ?? '';

/** «2026-11» ή «2026-11-30» → «November 2026». */
export function monthYearEn(key: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(key);
  return m ? `${MONTHS_EN[Number(m[2]) - 1]} ${m[1]}` : key;
}

/** «01/01/2024» (η γραφή `ηη/μμ/εεεε` των σταθερών) → «2024-01-01». */
export function isoOfDmy(s: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}
