// npx tsx lib/tools/revma.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΔΗΜΟΣΙΑ ΣΥΓΚΡΙΣΗ ΤΙΜΟΛΟΓΙΩΝ ΡΕΥΜΑΤΟΣ: ΣΕΝΑΡΙΑ ΥΠΟΛΟΓΙΣΜΕΝΑ ΣΤΟ ΧΕΡΙ
// ─────────────────────────────────────────────────────────────────────────
// Μια λάθος τιμή σε δημόσια σύγκριση δεν είναι σφάλμα οθόνης: είναι λόγος να
// αλλάξει κάποιος πάροχο με δέσμευση δώδεκα μηνών. Δύο πράγματα φυλάγονται εδώ
// με αριθμούς: ότι το ποσό είναι ΤΟ ΙΔΙΟ με του πίνακα ελέγχου και ότι με
// παλιό κατάλογο η σελίδα ΔΕΝ ονομάζει φθηνότερο ούτε κατατάσσει.
// ═══════════════════════════════════════════════════════════════════════════
import { comparePower, rankUntil, POWER_COLOURS, type PowerInput } from './revma'
import { freshness } from '@/lib/energy/freshness'
import { TARIFFS_VERIFIED, TARIFFS_MAX_AGE_DAYS } from '@/lib/energy/catalogue'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }
const near = (a: number | null | undefined, b: number, tol = 0.005) => a != null && Math.abs(a - b) <= tol

const day = (s: string) => new Date(`${s}T12:00:00`)
const FRESH = day('2026-10-15')
const STALE = day('2026-11-15')
const BASE: PowerInput = { kwh: 300, period: 'month', nightPct: 0, ebill: true, colour: 'ola' }

// ═══ Α. ΤΟ ΠΟΣΟ ΤΟΥ myHome Enter, ΣΤΟ ΧΕΡΙ ══════════════════════════════════
// ΡΑΑΕΥ, Οκτώβριος 2026, «My Home Enter»: 0,1421 με πάγια εντολή, πάγιο 4,90.
// 300 kWh × 0,1421 = 42,63 · πάγιο 4,90 · προμήθεια 47,53
// ΕΤΜΕΑΡ 300 × 0,017 = 5,10 · ΦΠΑ 6% × 52,63 = 3,1578 · σύνολο 55,7878, στρογγυλεμένο 55,79
// Ετήσιο: 55,79 × 12 = 669,48
{
  const r = comparePower(BASE, FRESH)
  const enter = r.rows.find(x => x.t.id === 'dei_enter')
  ok('Α. το myHome Enter βγαίνει 55,79€ τον μήνα', near(enter?.monthly, 55.79))
  ok('Α. και 669,48€ τον χρόνο', near(enter?.annual, 669.48))
  ok('Α. ο πάροχος έρχεται από τον κατάλογο', enter?.t.providerLabel === 'ΔΕΗ')
  // Το πάγιο της ΡΑΑΕΥ είναι ήδη αυτό της προϋπόθεσης (πάγια εντολή) και δεν
  // υπάρχει δεύτερο πάγιο e-bill: χωρίς e-bill το ποσό δεν αλλάζει.
  const noBill = comparePower({ ...BASE, ebill: false }, FRESH).rows.find(x => x.t.id === 'dei_enter')
  ok('Α. χωρίς e-bill το ποσό μένει 55,79€', near(noBill?.monthly, 55.79))
}

// ═══ Β. ΕΤΗΣΙΑ ΚΑΤΑΝΑΛΩΣΗ = ΔΩΔΕΚΑ ΙΣΟΙ ΜΗΝΕΣ ═════════════════════════════
{
  const m = comparePower(BASE, FRESH)
  const y = comparePower({ ...BASE, kwh: 3600, period: 'year' }, FRESH)
  ok('Β. 3.600 τον χρόνο είναι 300 τον μήνα', y.kwhMonthly === 300)
  ok('Β. και δίνουν την ίδια σειρά με τα ίδια ποσά',
    JSON.stringify(m.rows.map(r => [r.t.id, r.monthly, r.rank])) === JSON.stringify(y.rows.map(r => [r.t.id, r.monthly, r.rank])))
}

// ═══ Γ. ΦΡΕΣΚΟΣ ΚΑΤΑΛΟΓΟΣ: ΣΕΙΡΑ ΚΑΤΑ ΚΟΣΤΟΣ ════════════════════════════
{
  const r = comparePower(BASE, FRESH)
  const ranked = r.rows.filter(x => x.rank !== null)
  ok('Γ. κατατάσσει', r.recommend)
  ok('Γ. ονομάζει φθηνότερο και είναι η πρώτη θέση', r.cheapest !== null && r.cheapest === ranked[0] && ranked[0].rank === 1)
  ok('Γ. οι θέσεις είναι 1, 2, 3 … χωρίς κενά', ranked.every((x, i) => x.rank === i + 1))
  ok('Γ. σε αύξουσα σειρά κόστους', ranked.every((x, i) => i === 0 || (x.monthly ?? 0) >= (ranked[i - 1].monthly ?? 0)))
  ok('Γ. οι εκτός σειράς έρχονται μετά από όλες τις θέσεις',
    r.rows.findIndex(x => x.rank === null) === -1 || r.rows.slice(r.rows.findIndex(x => x.rank === null)).every(x => x.rank === null))
  ok('Γ. κάθε τιμολόγιο με θέση έχει ποσό', ranked.every(x => x.monthly !== null && x.monthly > 0))
}

// ═══ Δ. ΠΑΛΙΟΣ ΚΑΤΑΛΟΓΟΣ: ΚΑΝΕΝΑΣ ΝΙΚΗΤΗΣ, ΚΑΜΙΑ ΣΕΙΡΑ ═══════════════════
// Οι τιμές ενημερώθηκαν 05.10.2026 με κατώφλι 40 ημερών: στις 14.11 είναι
// ακόμη φρέσκες, στις 15.11 όχι. Και σε ΚΑΘΕ συνδυασμό εισόδων, με παλιό
// κατάλογο το «φθηνότερο» μένει κενό και καμία γραμμή δεν έχει θέση.
{
  ok('Δ. η κατάταξη ισχύει έως 14.11.2026', rankUntil() === '2026-11-14')
  ok('Δ. την 14.11 ο κατάλογος είναι φρέσκος', !freshness(TARIFFS_VERIFIED, day(rankUntil()), TARIFFS_MAX_AGE_DAYS).stale)
  ok('Δ. και την 15.11 όχι', freshness(TARIFFS_VERIFIED, STALE, TARIFFS_MAX_AGE_DAYS).stale)
  ok('Δ. την 14.11 η σελίδα ακόμη κατατάσσει', comparePower(BASE, day('2026-11-14')).recommend)

  const r = comparePower(BASE, STALE)
  ok('Δ. με παλιό κατάλογο δεν κατατάσσει', !r.recommend)
  ok('Δ. δεν ονομάζει φθηνότερο', r.cheapest === null)
  ok('Δ. καμία γραμμή δεν έχει θέση', r.rows.every(x => x.rank === null))
  ok('Δ. τα ποσά μένουν, ως ενδεικτικά', r.rows.some(x => x.monthly !== null))
  const names = r.rows.map(x => `${x.t.providerLabel} ${x.t.name}`)
  ok('Δ. η σειρά είναι αλφαβητική, κατά πάροχο', r.rows.every((x, i) => i === 0
    || r.rows[i - 1].t.providerLabel.localeCompare(x.t.providerLabel, 'el') <= 0))
  const fresh = comparePower(BASE, FRESH)
  ok('Δ. και όχι η σειρά του κόστους', JSON.stringify(names) !== JSON.stringify(fresh.rows.map(x => `${x.t.providerLabel} ${x.t.name}`)))
  ok('Δ. ίδια τιμολόγια με τη φρέσκη εκδοχή, απλώς χωρίς σειρά', r.rows.length === fresh.rows.length)

  let named = 0, placed = 0
  for (const colour of POWER_COLOURS.map(c => c.value)) {
    for (const kwh of [0, 50, 150, 300, 600, 1500]) {
      for (const nightPct of [0, 30, 100]) {
        for (const ebill of [true, false]) {
          for (const when of [STALE, day('2026-12-31'), day('2027-06-01')]) {
            const s = comparePower({ kwh, period: 'month', nightPct, ebill, colour }, when)
            if (s.cheapest !== null || s.recommend) named++
            placed += s.rows.filter(x => x.rank !== null).length
          }
        }
      }
    }
  }
  ok('Δ. σε κάθε συνδυασμό με παλιό κατάλογο, κανένα φθηνότερο', named === 0)
  ok('Δ. και καμία θέση', placed === 0)
}

// ═══ Ε. ΧΩΡΙΣ ΚΑΤΑΝΑΛΩΣΗ ΔΕΝ ΥΠΑΡΧΕΙ ΣΕΙΡΑ ════════════════════════════════
{
  const r = comparePower({ ...BASE, kwh: 0 }, FRESH)
  ok('Ε. μηδέν κιλοβατώρες: δεν κατατάσσει', !r.recommend && r.cheapest === null)
  const junk = comparePower({ ...BASE, kwh: Number.NaN, nightPct: Number.NaN }, FRESH)
  ok('Ε. σκουπίδια: ούτε NaN ούτε σειρά', !junk.recommend && junk.rows.every(x => x.monthly === null || Number.isFinite(x.monthly)))
}

// ═══ ΣΤ. ΟΣΑ ΔΕΝ ΜΠΑΙΝΟΥΝ ΣΕ ΣΕΙΡΑ, ΜΕ ΤΟΝ ΛΟΓΟ ΤΟΥΣ ══════════════════════
{
  const r = comparePower(BASE, FRESH)
  const by = (id: string) => r.rows.find(x => x.t.id === id)
  // Αναδρομική τιμή (ΜΔΚΑ): κανένα ποσό, καμία θέση.
  const retro = r.rows.filter(x => x.t.priceStatus === 'retro')
  ok('ΣΤ. τα αναδρομικά φαίνονται', retro.length > 0)
  ok('ΣΤ. χωρίς ποσό και χωρίς θέση', retro.every(x => x.monthly === null && x.rank === null && x.unranked === 'retro'))
  // Φωτοβολταϊκό: το ποσό υπάρχει, η προϋπόθεση όχι.
  ok('ΣΤ. το VNM μένει εκτός σειράς με ποσό', by('heron_ena')?.unranked === 'conditional' && by('heron_ena')?.rank === null && by('heron_ena')?.monthly !== null)
  // Πακέτο χωρίς δημοσιευμένο όριο.
  ok('ΣΤ. το ZeΝergy S δεν έχει δημοσιευμένο όριο', by('zen_zenergy_s')?.unranked === 'no-allowance' && by('zen_zenergy_s')?.monthly === null)
  // ZeΝergy XS: όριο 2.000 kWh τον χρόνο, χωρίς τιμή υπέρβασης. 300 × 12 = 3.600 > 2.100.
  ok('ΣΤ. το ZeΝergy XS ξεπερνιέται στις 300 τον μήνα', by('zen_zenergy_xs')?.unranked === 'over-allowance' && by('zen_zenergy_xs')?.monthly === null)
  // 150 × 12 = 1.800 < 2.100: μέσα στο όριο, το ποσό βγαίνει. 49,00 × 1,06 = 51,94.
  // Η τιμή του όμως είναι Αυγούστου (δεν υπάρχει στον πίνακα της ΡΑΑΕΥ του
  // Οκτωβρίου), οπότε μένει χωρίς θέση με το ποσό του.
  const low = comparePower({ ...BASE, kwh: 150 }, FRESH).rows.find(x => x.t.id === 'zen_zenergy_xs')
  ok('ΣΤ. στις 150 βγάζει 51,94€, χωρίς θέση γιατί η τιμή είναι Αυγούστου', low?.unranked === 'other-month' && low?.rank === null && near(low?.monthly, 51.94))
  // Picasso έχει τιμή υπέρβασης, οπότε έχει ποσό και όταν ξεπερνιέται· τιμή Αυγούστου, χωρίς θέση.
  ok('ΣΤ. πακέτο με καταγεγραμμένη υπέρβαση έχει ποσό, με τον μήνα του', by('prot_picasso_s1')?.unranked === 'other-month' && by('prot_picasso_s1')?.monthly !== null)
  // ΜΟΝΟ ΤΙΜΕΣ ΟΚΤΩΒΡΙΟΥ ΣΤΗ ΣΕΙΡΑ. Κάθε γραμμή με θέση έχει τιμή του μήνα του πίνακα.
  ok('ΣΤ. κάθε θέση είναι τιμή Οκτωβρίου 2026', r.rows.filter(x => x.rank !== null).every(x => x.t.priceMonth === 'Οκτωβρίου 2026'))
  ok('ΣΤ. και το φθηνότερο επίσης', r.cheapest?.t.priceMonth === 'Οκτωβρίου 2026')
  // Η ΡΑΑΕΥ γράφει «μη εμπορικά διαθέσιμο»: δεν φαίνεται ως επιλογή.
  ok('ΣΤ. κανένα μη εμπορικά διαθέσιμο', r.rows.every(x => !x.t.notAvailable) && !by('prot_flow'))
  // Ο κατάλογος ήδη κρατά έξω φοιτητικά, εκκαθάριση και δυναμικά.
  ok('ΣΤ. κανένα φοιτητικό', r.rows.every(x => !x.t.studentOnly))
  ok('ΣΤ. κανένα με εκκαθάριση', r.rows.every(x => !x.t.settled) && !by('dei_plan'))
  ok('ΣΤ. κανένα δυναμικό', r.rows.every(x => x.t.type !== 'dynamic'))
  ok('ΣΤ. μόνο οικιακά', r.rows.every(x => x.t.segment === 'residential'))
}

// ═══ Ζ. ΤΟ ΧΡΩΜΑ ΦΙΛΤΡΑΡΕΙ ΠΡΙΝ ΤΗ ΣΕΙΡΑ ═══════════════════════════════════
{
  for (const c of POWER_COLOURS) {
    if (!c.badge) continue
    const r = comparePower({ ...BASE, colour: c.value }, FRESH)
    ok(`Ζ. ${c.label}: μόνο ${c.badge}`, r.rows.length > 0 && r.rows.every(x => x.t.badge === c.badge))
    ok(`Ζ. ${c.label}: οι θέσεις ξεκινούν από το 1`, r.cheapest === null || r.cheapest.rank === 1)
  }
  const blue = comparePower({ ...BASE, colour: 'mple' }, FRESH)
  ok('Ζ. το VNM εμφανίζεται μόνο στα «Όλα»', !blue.rows.some(x => x.t.id === 'heron_ena'))
}

// ═══ Η. Η ΝΥΧΤΕΡΙΝΗ ΖΩΝΗ ΜΕΤΡΑ ΜΟΝΟ ΟΠΟΥ ΥΠΑΡΧΕΙ ═══════════════════════════
// ΡΑΑΕΥ, Οκτώβριος 2026, «myHomeEnterTwo»: ημέρα 0,145, νύχτα 0,095, πάγιο 8,00.
// 300 kWh, 30% νύχτα: 210 × 0,145 + 90 × 0,095 = 30,45 + 8,55 = 39,00
// + 8,00 = 47,00 · + 5,10 = 52,10 · × 1,06 = 55,226, στρογγυλεμένο 55,23
{
  const r = comparePower({ ...BASE, nightPct: 30 }, FRESH)
  ok('Η. το EnterTwo με 30% νύχτα βγαίνει 55,23€', near(r.rows.find(x => x.t.id === 'dei_entertwo')?.monthly, 55.23))
  ok('Η. το Enter, χωρίς νυχτερινή, δεν αλλάζει', near(r.rows.find(x => x.t.id === 'dei_enter')?.monthly, 55.79))
}

// ═══ Θ. ΚΛΙΜΑΚΙΟ «ΑΠΟ ΤΗΝ 1η kWh» ═════════════════════════════════════════
// ΡΑΑΕΥ, Οκτώβριος 2026, ΔΕΗ Ειδικό (Γ1): 0,15913 έως 200 kWh· πάνω από τις
// 200 «η τιμή διαμορφώνεται σε 0,21997 από την 1η KWh». Πάγιο 5,00.
//   200 kWh: 200 × 0,15913 = 31,826 + 5 = 36,826 · + 3,40 = 40,226 · × 1,06 = 42,63956 → 42,64
//   300 kWh: 300 × 0,21997 = 65,991 + 5 = 70,991 · + 5,10 = 76,091 · × 1,06 = 80,65646 → 80,66
// Με κλίμακα μόνο για όσες ξεπερνούν το όριο θα έβγαινε 200 × 0,15913 + 100 ×
// 0,21997 = 53,823 και σύνολο 68,08: δώδεκα ευρώ κάτω από την πραγματικότητα.
{
  const at = (kwh: number) => comparePower({ ...BASE, kwh }, FRESH).rows.find(x => x.t.id === 'dei_prasino')?.monthly
  ok('Θ. στις 200 kWh μετρά η πρώτη τιμή: 42,64€', near(at(200), 42.64))
  ok('Θ. στις 300 kWh η δεύτερη τιμή για όλες: 80,66€', near(at(300), 80.66))
}

console.log(`revma: ✓ ${passed} · ✗ ${failed}`)
if (failed) process.exit(1)
