// ═══════════════════════════════════════════════════════════════════════════
// Η ΦΡΑΣΗ ΤΟΥ ΜΙΚΡΟΥ ΟΙΚΙΣΜΟΥ ΑΚΟΛΟΥΘΕΙ ΤΟ ΕΤΟΣ ΤΟΥ ΜΕΤΡΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Το μέτρο ψηφίστηκε για τον ΕΝΦΙΑ του 2026 και μόνο. Η δημόσια σελίδα που το
// αναφέρει οφείλει να το αναφέρει τότε και να σωπάσει μετά.
// ═══════════════════════════════════════════════════════════════════════════
import { smallSettlementRelief } from './enfiaRelief'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

const in2026 = smallSettlementRelief(2026)
ok('το 2026 η μείωση αναφέρεται', in2026 !== null)
ok('με το ποσοστό του μέτρου', !!in2026 && in2026.includes('50%'))
ok('με τη χρονιά του', !!in2026 && in2026.includes('του 2026'))
ok('με το ανώτατο όριο αξίας', !!in2026 && in2026.includes('400.000€'))
ok('το 2027 δεν αναφέρεται πια', smallSettlementRelief(2027) === null)

console.log(`tools/enfiaRelief.test.ts: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
