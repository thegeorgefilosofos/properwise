import { roundHalfUp } from '../core/money';
import { propertyYield } from '../facts/yield'
// ═══════════════════════════════════════════════════════════════════════════
// ΣΥΓΚΕΝΤΡΩΤΙΚΗ ΑΠΟΔΟΣΗ ΧΑΡΤΟΦΥΛΑΚΙΟΥ — καθαρή συνάρτηση (χωρίς I/O).
// Σταθμισμένη μεικτή/καθαρή απόδοση, συνολική αξία & ετήσιο καθαρό, μόνο από
// τα ακίνητα που έχουν καταχωρημένη αξία ΚΑΙ είναι σε μίσθωση. Καμία εφεύρεση.
//
// ΓΙΑΤΙ ΜΟΝΟ ΣΕ ΜΙΣΘΩΣΗ: ακίνητο κενό, σε ιδιοχρησία ή προς πώληση δεν έχει
// ετήσιο ρυθμό εσόδων (lib/facts/income.ts τον μηδενίζει), έχει όμως αξία και
// δαπάνες. Μέσα στον σταθμισμένο μέσο έβγαζε «μεικτή 0,00% · καθαρή −1,70%»
// δίπλα σε θετικά έσοδα: η αξία και τα έξοδά του μετρούσαν, τα έσοδά του όχι.
// Απόδοση ενοικίου έχει μόνο ό,τι νοικιάζεται.
// ═══════════════════════════════════════════════════════════════════════════
const pos = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0)
const max0 = (n: number): number => Math.max(0, Number.isFinite(n) ? n : 0)
const round1 = (n: number): number => Math.round(n * 10) / 10
const round2 = (n: number): number => roundHalfUp(n, 2)

export interface PortfolioItem {
  value: number          // αξία ακινήτου
  annualRevenue: number  // ετήσια έσοδα (ή ετησιοποιημένα)
  annualExpenses: number // ετήσια έξοδα (ή ετησιοποιημένα)
  /** Σε μίσθωση (μακροχρόνια ή βραχυχρόνια). `false` → εκτός απόδοσης. Χωρίς
   *  τιμή μετρά, για όσους καλούντες δεν ξέρουν την κατάσταση. */
  leased?: boolean
}
export interface PortfolioReturns {
  count: number          // σύνολο ακινήτων
  valuedCount: number    // όσα έχουν αξία ΚΑΙ μίσθωση (μπαίνουν στις αποδόσεις)
  /** Η αξία πάνω στην οποία βγαίνουν οι αποδόσεις: μόνο των `valuedCount`. */
  yieldValue: number
  totalValue: number
  totalRevenue: number
  totalExpenses: number
  totalNet: number       // έσοδα − έξοδα (όλων)
  grossYield: number     // σταθμισμένη: Σεσόδων / Σαξιών (μόνο valued σε μίσθωση)
  netYield: number       // σταθμισμένη: Σκαθαρών / Σαξιών (μόνο valued σε μίσθωση)
}

/** Συγκεντρωτική απόδοση χαρτοφυλακίου. Οι αποδόσεις σταθμίζονται με την αξία και
 *  υπολογίζονται μόνο από ακίνητα με value>0 (αλλιώς η % δεν ορίζεται) που είναι
 *  σε μίσθωση (αλλιώς δεν υπάρχει ρυθμός εσόδων να μετρηθεί). */
export function portfolioReturns(items: PortfolioItem[]): PortfolioReturns {
  let totalValue = 0, totalRevenue = 0, totalExpenses = 0
  let vValue = 0, vRevenue = 0, vNet = 0, valuedCount = 0
  for (const it of items) {
    const v = pos(it.value), rev = max0(it.annualRevenue), exp = max0(it.annualExpenses)
    totalValue += v; totalRevenue += rev; totalExpenses += exp
    if (v > 0 && it.leased !== false) { vValue += v; vRevenue += rev; vNet += rev - exp; valuedCount++ }
  }
  return {
    count: items.length, valuedCount, yieldValue: round2(vValue),
    totalValue: round2(totalValue), totalRevenue: round2(totalRevenue),
    totalExpenses: round2(totalExpenses), totalNet: round2(totalRevenue - totalExpenses),
    // Ο τύπος του lib/facts/yield.ts, με τις σταθμισμένες τιμές. Καθαρή = προ φόρου.
    grossYield: round1(propertyYield({ annualIncome: vRevenue, value: vValue, annualExpenses: 0 }).gross),
    netYield: round1(propertyYield({ annualIncome: vRevenue, value: vValue, annualExpenses: vRevenue - vNet }).net_pre_tax),
  }
}
