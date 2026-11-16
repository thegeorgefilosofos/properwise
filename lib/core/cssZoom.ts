// ═══════════════════════════════════════════════════════════════════════════
// ΣΥΝΤΕΤΑΓΜΕΝΕΣ ΚΑΤΩ ΑΠΟ ΤΟ ΜΕΓΑΛΟ ΚΕΙΜΕΝΟ
// ─────────────────────────────────────────────────────────────────────────
// Το «Μέγεθος κειμένου» μεγεθύνει τη ρίζα με `zoom` (app/globals.css). Από
// τον Chrome 128 το `zoom` είναι πρότυπο και έχει δύο συνέπειες για όποιον
// στήνει αναδυόμενο με JavaScript, μετρημένες στον πάγκο με zoom 1,25:
//
//   · το `getBoundingClientRect()` δίνει εικονοστοιχεία ΟΘΟΝΗΣ (125 για
//     στοιχείο στα 100), ενώ το `left: 100px` ενός `position: fixed` μέσα στη
//     μεγεθυμένη ρίζα πολλαπλασιάζεται ξανά (ζωγραφίζεται στα 125)·
//   · το `innerWidth` είναι της οθόνης (400), το `clientWidth` της ρίζας (320).
//
// Ενα αναδυόμενο που έγραφε τη μέτρηση αυτούσια έπεφτε 25% πιο δεξιά και πιο
// κάτω από το κουμπί του και το μενού έβγαινε από τη δεξιά άκρη. Εδώ όλα
// μεταφράζονται στα εικονοστοιχεία της ρίζας, που είναι αυτά που γράφει το CSS.
// Χωρίς μεγέθυνση ο συντελεστής είναι 1 και τίποτα δεν αλλάζει.
// ═══════════════════════════════════════════════════════════════════════════

/** Ο συντελεστής μεγέθυνσης της ρίζας (1 χωρίς «Μέγεθος κειμένου»). */
export function cssZoom(): number {
  if (typeof document === 'undefined') return 1
  const el = document.documentElement as HTMLElement & { currentCSSZoom?: number }
  let z = el.currentCSSZoom
  if (z == null) {
    try { z = parseFloat(getComputedStyle(el).zoom) } catch { z = 1 }
  }
  return z && Number.isFinite(z) && z > 0 ? z : 1
}

export interface CssRect { left: number; top: number; right: number; bottom: number; width: number; height: number }

/** Το ορθογώνιο ενός στοιχείου σε εικονοστοιχεία της ρίζας, έτοιμο για `left`/`top`. */
export function cssRect(el: Element): CssRect
export function cssRect(el: Element | null | undefined): CssRect | undefined
export function cssRect(el: Element | null | undefined): CssRect | undefined {
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  const z = cssZoom()
  return { left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z }
}

/** Πλάτος και ύψος του παραθύρου σε εικονοστοιχεία της ρίζας. */
export const cssViewW = (): number => (typeof window === 'undefined' ? 0 : window.innerWidth / cssZoom())
export const cssViewH = (): number => (typeof window === 'undefined' ? 0 : window.innerHeight / cssZoom())

/**
 * Σημείο ή μήκος από εικονοστοιχεία οθόνης (δείκτης, `visualViewport`) σε
 * εικονοστοιχεία της ρίζας.
 */
export const toCssPx = (screenPx: number, z = cssZoom()): number => screenPx / z

/**
 * Κράτα ένα κουτί μέσα σε ένα παράθυρο, με περιθώριο. Καθαρή συνάρτηση: όλα
 * τα μήκη στον ίδιο χώρο (της ρίζας), ώστε να δοκιμάζεται χωρίς περιηγητή.
 */
export function clampBox(x: number, y: number, w: number, h: number, vw: number, vh: number, m = 8): { x: number; y: number } {
  return {
    x: Math.max(m, Math.min(x, vw - w - m)),
    y: Math.max(m, Math.min(y, vh - h - m)),
  }
}
