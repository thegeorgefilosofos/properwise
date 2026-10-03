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
const FRESH = day('2026-09-15')
const STALE = day('2026-10-11')
const BASE: PowerInput = { kwh: 300, period: 'month', nightPct: 0, ebill: true, colour: 'ola' }

// ═══ Α. ΤΟ ΠΟΣΟ ΤΟΥ myHome Enter, ΣΤΟ ΧΕΡΙ ══════════════════════════════════
// 300 kWh × 0,1421 = 42,63 · πάγιο με e-bill 3,50 · προμήθεια 46,13
// ΕΤΜΕΑΡ 300 × 0,017 = 5,10 · ΦΠΑ 6% × 51,23 = 3,0738 · σύνολο 54,3038, στρογγυλεμένο 54,30
// Ετήσιο: 54,30 × 12 = 651,60
{
  const r = comparePower(BASE, FRESH)
  const enter = r.rows.find(x => x.t.id === 'dei_enter')
  ok('Α. το myHome Enter βγαίνει 54,30€ τον μήνα', near(enter?.monthly, 54.30))
  ok('Α. και 651,60€ τον χρόνο', near(enter?.annual, 651.60))
  ok('Α. ο πάροχος έρχεται από τον κατάλογο', enter?.t.providerLabel === 'ΔΕΗ')
  // Χωρίς e-bill το πάγιο είναι 7,35: προμήθεια 49,98 · +5,10 · ×1,06 = 58,3848, στρογγυλεμένο 58,38
  const noBill = comparePower({ ...BASE, ebill: false }, FRESH).rows.find(x => x.t.id === 'dei_enter')
  ok('Α. χωρίς e-bill το πάγιο ανεβαίνει και το ποσό γίνεται 58,38€', near(noBill?.monthly, 58.38))
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
// Ο κατάλογος ελέγχθηκε 31.08.2026 με κατώφλι 40 ημερών: στις 10.10 είναι
// ακόμη φρέσκος, στις 11.10 όχι. Και σε ΚΑΘΕ συνδυασμό εισόδων, με παλιό
// κατάλογο το «φθηνότερο» μένει κενό και καμία γραμμή δεν έχει θέση.
{
  ok('Δ. η κατάταξη ισχύει έως 10.10.2026', rankUntil() === '2026-10-10')
  ok('Δ. την 10.10 ο κατάλογος είναι φρέσκος', !freshness(TARIFFS_VERIFIED, day(rankUntil()), TARIFFS_MAX_AGE_DAYS).stale)
  ok('Δ. και την 11.10 όχι', freshness(TARIFFS_VERIFIED, STALE, TARIFFS_MAX_AGE_DAYS).stale)
  ok('Δ. την 10.10 η σελίδα ακόμη κατατάσσει', comparePower(BASE, day('2026-10-10')).recommend)

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
  // 150 × 12 = 1.800 < 2.100: μέσα στο όριο, μπαίνει κανονικά. 49,00 × 1,06 = 51,94.
  const low = comparePower({ ...BASE, kwh: 150 }, FRESH).rows.find(x => x.t.id === 'zen_zenergy_xs')
  ok('ΣΤ. και μπαίνει στη σειρά στις 150, με 51,94€', low?.unranked === null && low?.rank !== null && near(low?.monthly, 51.94))
  // Picasso έχει τιμή υπέρβασης, οπότε μένει στη σειρά ακόμη κι όταν ξεπερνιέται.
  ok('ΣΤ. πακέτο με καταγεγραμμένη υπέρβαση μένει στη σειρά', by('prot_picasso_s1')?.unranked === null && by('prot_picasso_s1')?.rank !== null)
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
// myHome EnterTwo: ημέρα 0,1421, νύχτα 0,1029, πάγιο με e-bill 3,50.
// 300 kWh, 30% νύχτα: 210 × 0,1421 + 90 × 0,1029 = 29,841 + 9,261 = 39,102
// + 3,50 = 42,602 · + 5,10 = 47,702 · × 1,06 = 50,5641, στρογγυλεμένο 50,56
{
  const r = comparePower({ ...BASE, nightPct: 30 }, FRESH)
  ok('Η. το EnterTwo με 30% νύχτα βγαίνει 50,56€', near(r.rows.find(x => x.t.id === 'dei_entertwo')?.monthly, 50.56))
  ok('Η. το Enter, χωρίς νυχτερινή, δεν αλλάζει', near(r.rows.find(x => x.t.id === 'dei_enter')?.monthly, 54.30))
}

console.log(`revma: ✓ ${passed} · ✗ ${failed}`)
if (failed) process.exit(1)
