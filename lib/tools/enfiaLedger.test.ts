// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΘΕ ΓΡΑΜΜΗ ΠΟΥ ΤΥΠΩΝΕΙ Ο ΥΠΟΛΟΓΙΣΤΗΣ ΕΝΦΙΑ ΑΘΡΟΙΖΕΙ ΣΤΟ ΕΤΗΣΙΟ
// ─────────────────────────────────────────────────────────────────────────
// Ο αναγνώστης που κάνει την αφαίρεση στο χαρτί πρέπει να βρει ακριβώς το
// ποσό της τελευταίας γραμμής· αλλιώς κρίνει όλο τον υπολογισμό από το λεπτό
// που περισσεύει.
// ═══════════════════════════════════════════════════════════════════════════
import { estimateENFIA, zoneKeyFromPricePerSqm, ENFIA_FLOOR_COEF, ENFIA_AGE_BANDS } from '@/lib/billing/enfia'
import { enfiaLedger, enfiaWealthBracketLimit } from './enfiaLedger'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

const cents = (n: number) => Math.round(n * 100)

// ── Η ΠΡΟΕΠΙΛΟΓΗ ΤΗΣ ΣΕΛΙΔΑΣ: 85 τ.μ., 1.400€/τ.μ., 2ος, 26+ έτη ─────────────
{
  const zone = zoneKeyFromPricePerSqm(1400)!
  const value = 85 * 1400
  const r = estimateENFIA({ sqm: 85, zone, floor: 'second', age: 'y26_plus', ownership: 100, totalValue: value, propertyValue: value })!
  const l = enfiaLedger(r)
  ok('οι γραμμές της προεπιλογής αθροίζουν στο ετήσιο',
     cents(l.basic) + cents(l.extra) + cents(l.supplementary) - cents(l.reduction) === cents(r.annual))
  ok('η μείωση είναι το 25% του στρογγυλού κύριου φόρου, στρογγυλεμένο σωστά',
     cents(l.reduction) === Math.round(r.basic * 25 + 1e-9))
  ok('ο κύριος φόρος μένει αυτός της μηχανής', l.basic === r.basic)
}

// ── ΣΕ ΚΑΘΕ ΣΥΝΔΥΑΣΜΟ, ΟΧΙ ΜΟΝΟ ΣΤΗΝ ΠΡΟΕΠΙΛΟΓΗ ────────────────────────────
{
  let broken = 0, cases = 0
  for (const sqm of [23, 48.5, 85, 112, 300]) {
    for (const price of [650, 1400, 2150, 3000, 5200]) {
      for (const floor of Object.keys(ENFIA_FLOOR_COEF)) {
        for (const age of ENFIA_AGE_BANDS.map(a => a.key)) {
          for (const own of [100, 50, 33]) {
            const zone = zoneKeyFromPricePerSqm(price)
            if (!zone) continue
            const value = sqm * price
            const r = estimateENFIA({ sqm, zone, floor, age, ownership: own, totalValue: value * own / 100, propertyValue: value })
            if (!r) continue
            cases++
            const l = enfiaLedger(r)
            const sum = cents(l.basic) + cents(l.extra) + cents(l.supplementary) - cents(l.reduction)
            // Και καμία γραμμή δεν απομακρύνεται πάνω από ένα λεπτό από τη μηχανή.
            const drift = Math.abs(cents(l.basic) - cents(r.basic)) + Math.abs(cents(l.extra) - cents(r.extra))
              + Math.abs(cents(l.supplementary) - cents(r.supplementary))
            if (sum !== cents(r.annual) || drift > 1 || l.reduction < 0) broken++
          }
        }
      }
    }
  }
  ok(`κανένας από τους ${cases} συνδυασμούς δεν αφήνει λεπτό που περισσεύει (βρέθηκαν ${broken})`, cases > 100 && broken === 0)
}

// ── ΤΟ ΟΡΙΟ ΤΟΥ ΚΛΙΜΑΚΙΟΥ ΤΗΣ ΑΥΤΟΜΑΤΗΣ ΜΕΙΩΣΗΣ ────────────────────────────
ok('119.000€ πέφτουν στο κλιμάκιο έως 150.000€', enfiaWealthBracketLimit(119_000) === 150_000)
ok('ακριβώς 100.000€ μένουν στο πρώτο κλιμάκιο', enfiaWealthBracketLimit(100_000) === 100_000)
ok('πάνω από 400.000€ δεν υπάρχει μείωση, άρα ούτε όριο', enfiaWealthBracketLimit(450_000) === null)

console.log(`tools/enfiaLedger.test.ts: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
