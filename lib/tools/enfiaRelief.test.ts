// ═══════════════════════════════════════════════════════════════════════════
// Η ΦΡΑΣΗ ΤΟΥ ΜΙΚΡΟΥ ΟΙΚΙΣΜΟΥ ΑΚΟΛΟΥΘΕΙ ΤΟ ΕΤΟΣ ΤΟΥ ΜΕΤΡΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Το μέτρο είναι μείωση 50% τον ΕΝΦΙΑ του 2026 και πλήρης απαλλαγή από το 2027
// (άρθρο 17 παρ. 3 ν.5219/2025). Πριν από το 2026 δεν υπήρχε και η σελίδα σωπαίνει.
// ═══════════════════════════════════════════════════════════════════════════
import { smallSettlementRelief } from './enfiaRelief'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

const in2026 = smallSettlementRelief(2026)
ok('το 2026 η μείωση αναφέρεται', in2026 !== null)
ok('με το ποσοστό του μέτρου', !!in2026 && in2026.includes('50%'))
ok('με τη χρονιά του', !!in2026 && in2026.includes('του 2026'))
ok('με το ανώτατο όριο αξίας', !!in2026 && in2026.includes('400.000€'))
const in2027 = smallSettlementRelief(2027)
ok('το 2027 γίνεται πλήρης απαλλαγή', !!in2027 && in2027.startsWith('πλήρης απαλλαγή του 2027'))
ok('με τα ίδια όρια', !!in2027 && in2027.includes('400.000€'))
ok('στην αιτιατική αλλάζει και το άρθρο', smallSettlementRelief(2027, true)!.startsWith('την πλήρη απαλλαγή')
  && smallSettlementRelief(2026, true)!.startsWith('τη μείωση 50%'))
ok('το 2025 δεν αναφέρεται', smallSettlementRelief(2025) === null)

console.log(`tools/enfiaRelief.test.ts: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
