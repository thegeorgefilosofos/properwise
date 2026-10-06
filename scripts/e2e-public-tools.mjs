#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// E2E ΣΕΝΑΡΙΑ ΓΙΑ ΤΑ ΔΗΜΟΣΙΑ ΕΡΓΑΛΕΙΑ
// ─────────────────────────────────────────────────────────────────────────
// Οδηγεί τον πραγματικό browser πάνω στις δύο δωρεάν σελίδες, όπως θα τις
// χρησιμοποιούσε επισκέπτης: γράφει στα πεδία, αλλάζει επιλογές και ελέγχει
// ότι ο αριθμός στην οθόνη είναι ΑΚΡΙΒΩΣ ο αναμενόμενος — υπολογισμένος στο χέρι.
//
// ΓΙΑΤΙ ΔΕΝ ΦΤΑΝΟΥΝ ΤΑ UNIT ΤΕΣΤ
// Το lib/billing/publicTools.test.ts ελέγχει τη ΣΥΝΘΕΣΗ των υπολογισμών. Δεν
// μπορεί όμως να πιάσει: πεδίο χωρίς ετικέτα, οριζόντια υπερχείλιση σε κινητό,
// NaN που φτάνει στην οθόνη, ή —το χειρότερο— middleware που ανακατευθύνει τη
// δωρεάν σελίδα σε σύνδεση. Το τελευταίο συνέβη ΠΡΑΓΜΑΤΙΚΑ: το build περνούσε
// καθαρό και η σελίδα γύριζε HTTP 307.
//
// ΔΕΝ ΤΡΕΧΕΙ ΣΤΟ CI: χρειάζεται ζωντανό server και browser. Τρέξε τοπικά:
//     npm run dev            (σε άλλο τερματικό)
//     node scripts/e2e-public-tools.mjs
//
// Χρειάζεται playwright-core (devDependency κατ' απαίτηση):
//     npm i -D playwright-core
// ═══════════════════════════════════════════════════════════════════════════
import { chromePath } from './lib/chrome.mjs';
import { plain } from './lib/plain-text.mjs';
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let pkg
try { pkg = require('playwright-core') }
catch { console.error('Λείπει το playwright-core. Τρέξε: npm i -D playwright-core'); process.exit(2) }
const { chromium } = pkg
const B = process.env.E2E_BASE || 'http://localhost:3000'
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromePath(), args:['--no-sandbox'] })
let pass=0, fail=0
const ok=(n,c)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+n) } }

async function page(ctx, path){ const p=await ctx.newPage(); await p.goto(B+path,{waitUntil:'networkidle'});
  await p.getByRole('button',{name:/κατάλαβα/i}).click().catch(()=>{}); await p.waitForTimeout(300); return p }
const num = t => Number(String(t).replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))

// ── ΦΟΡΟΣ ΕΝΟΙΚΙΩΝ, σαν χρήστης ────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport:{width:1280,height:1000}, locale:'el-GR' })
  const p = await page(ctx,'/ypologismos-forou-enoikion')
  const inputs = p.locator('input')
  const read = async () => {
    const txt = await p.locator('body').innerText().then(plain)
    const m = txt.match(/ΦΟΡΟΣ\s*\n\s*([\d.,]+)\s*€/); return m ? num(m[1]) : null
  }
  ok('αρχική κατάσταση δείχνει 1.026 € (600×12)', await read() === 1026)

  // ── Η ΧΡΟΝΙΑ ΤΟΥ ΕΙΣΟΔΗΜΑΤΟΣ ΑΛΛΑΖΕΙ ΤΗΝ ΚΛΙΜΑΚΑ ΚΑΙ Ο ΕΛΕΓΧΟΣ ΤΟ ΞΕΧΝΟΥΣΕ
  // Οι δύο επόμενοι έλεγχοι περίμεναν τα νούμερα του 2026 (15/25/35/45) ενώ η
  // σελίδα ξεκινά στο 2025 (15/35/45) — από τότε που προστέθηκε ο επιλογέας
  // χρονιάς. Δεν ήταν σφάλμα της σελίδας: ήταν έλεγχος που είχε μείνει πίσω και
  // κατηγορούσε σωστό κώδικα. Τώρα διαλέγει ΡΗΤΑ χρονιά και ελέγχει ΚΑΙ ΤΙΣ ΔΥΟ
  // κλίμακες, που είναι και το πιο επικίνδυνο σημείο του υπολογιστή.
  const year = async y => { await p.getByRole('button', { name: new RegExp('^' + y) }).click(); await p.waitForTimeout(250) }

  // Η ΠΡΟΕΠΙΛΟΓΗ ΒΓΑΙΝΕΙ ΠΛΕΟΝ ΑΠΟ ΤΗ ΣΗΜΕΡΙΝΗ ΗΜΕΡΟΜΗΝΙΑ (RentTaxCalculator,
  // `openingYear`): από τον Αύγουστο είναι το τρέχον έτος. Ο έλεγχος δεν
  // στηρίζεται σε αυτήν· διαλέγει ρητά το 2025 πριν από το πρώτο νούμερο.
  await year(2025)
  await inputs.nth(0).fill('1200'); await p.waitForTimeout(250)
  // 1.200 × 12 = 14.400 · φορολογητέο 13.680
  //   2025: 12.000×15% + 1.680×35% = 1.800 + 588 = 2.388
  //   2026: 12.000×15% + 1.680×25% = 1.800 + 420 = 2.220
  ok('1.200 €/μήνα με την κλίμακα 2025 → 2.388 €', await read() === 2388)
  await year(2026)
  ok('…και με την κλίμακα 2026 → 2.220 € (το ενδιάμεσο 25%)', await read() === 2220)
  await year(2025)

  await inputs.nth(1).fill('6'); await p.waitForTimeout(250)
  ok('…και για 6 μήνες → 1.026 € (ίδιο ετήσιο)', await read() === 1026)

  await inputs.nth(0).fill('0'); await p.waitForTimeout(250)
  ok('μηδενικό ενοίκιο → 0 €', await read() === 0)

  await inputs.nth(0).fill('δεν ξέρω'); await p.waitForTimeout(250)
  const junk = await read()
  ok('σκουπίδια στο πεδίο δεν σπάνε τη σελίδα', junk === 0)
  ok('…και δεν εμφανίζεται NaN', !(await p.locator('body').innerText().then(plain)).includes('NaN'))

  // Ρητά ΚΑΙ τα δύο πεδία: το πεδίο μηνών είχε μείνει στο 6 από το προηγούμενο
  // βήμα και η πρώτη εκδοχή αυτού του ελέγχου απέτυχε γι' αυτόν τον λόγο.
  // 1.250,50 × 12 = 15.006 · φορολογητέο 14.255,70
  //   2025: 12.000×15% + 2.255,70×35% = 1.800 + 789,50 = 2.589,50
  //   2026: 12.000×15% + 2.255,70×25% = 1.800 + 563,93 = 2.363,93
  await inputs.nth(0).fill('1.250,50'); await inputs.nth(1).fill('12'); await p.waitForTimeout(300)
  ok('ελληνική γραφή «1.250,50» → 2.589,50 € (κλίμακα 2025)', Math.abs((await read()) - 2589.50) < 0.02)
  await year(2026)
  ok('…και 2.363,93 € με την κλίμακα 2026', Math.abs((await read()) - 2363.93) < 0.02)

  ok('υπάρχει σύνδεσμος εγγραφής', await p.locator('a[href="/signup"]').count() > 0)
  await ctx.close()
}

// ── ΕΝΦΙΑ, σαν χρήστης ─────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport:{width:1280,height:1000}, locale:'el-GR' })
  const p = await page(ctx,'/ypologismos-enfia')
  const read = async () => {
    const txt = await p.locator('body').innerText().then(plain)
    const m = txt.match(/ΕΝΦΙΑ ΕΤΗΣΙΩΣ\s*\n\s*([\d.,]+)\s*€/); return m ? num(m[1]) : null
  }
  ok('αρχική κατάσταση δείχνει 180,28 € (85τμ, ζώνη 1400)', Math.abs((await read()) - 180.28) < 0.02)

  const inputs = p.locator('input')
  await inputs.nth(0).fill('120'); await inputs.nth(1).fill('3200')
  // ΤΑ ΝΤΟΠΙΑ <select> ΕΦΥΓΑΝ ΑΠΟ ΟΛΗ ΤΗΝ ΕΦΑΡΜΟΓΗ: το λειτουργικό ζωγράφιζε τη
  // λίστα με δικά του χρώματα μέσα σε οθόνη με δικό της σύστημα πεδίων. Εδώ
  // οδηγείται πλέον το CustomSelect — άνοιγμα του combobox, κλικ στην επιλογή —
  // δηλαδή ακριβώς ό,τι κάνει ο χρήστης, με την ετικέτα και όχι με το κλειδί.
  const pick = async (i, optionLabel) => {
    await p.locator('[role="combobox"]').nth(i).click()
    await p.locator('[role="option"]', { hasText: optionLabel }).first().click()
    await p.waitForTimeout(150)
  }
  await pick(0, 'Ισόγειο')
  // ΤΟ ΚΛΕΙΔΙ ΑΛΛΑΞΕ ΟΤΑΝ Η ΚΛΙΜΑΚΑ ΠΗΡΕ ΤΗΝ ΕΚΤΗ ΖΩΝΗ. Ο νόμος έχει ΕΞΙ ζώνες
  // παλαιότητας· ο κώδικας είχε πέντε και χρέωνε τα κτίρια 15 ως 19 ετών με τον
  // συντελεστή της προηγούμενης ζώνης. Ο συντελεστής της πρώτης ζώνης (1,25)
  // δεν άλλαξε, άρα ούτε το αναμενόμενο ποσό.
  await pick(1, 'Έως 4 έτη')
  await p.waitForTimeout(300)
  ok('120τμ / ζώνη 3200 / ισόγειο / νεόδμητο → 1.026 €', Math.abs((await read()) - 1026) < 0.02)

  await inputs.nth(2).fill('50'); await p.waitForTimeout(300)
  const half = await read()
  ok('50% ιδιοκτησία μειώνει το ποσό', half < 1026)

  await inputs.nth(1).fill('0'); await p.waitForTimeout(300)
  const txt = await p.locator('body').innerText().then(plain)
  ok('χωρίς τιμή ζώνης δεν δείχνει ψεύτικο αποτέλεσμα', txt.includes('Συμπλήρωσε'))
  ok('πουθενά NaN', !txt.includes('NaN'))
  ok('υπάρχει σύνδεσμος προς τον άλλο υπολογιστή',
     await p.locator('a[href="/ypologismos-forou-enoikion"]').count() > 0)
  await ctx.close()
}

// ── ΚΑΘΑΡΗ ΑΠΟΔΟΣΗ, σαν χρήστης ───────────────────────────────────────────
// Ο τέταρτος υπολογιστής είναι ο μόνος που βγάζει ΠΟΣΟΣΤΟ και το ποσοστό
// είναι το πιο εύκολο νούμερο να βγει λάθος χωρίς να φανεί: ένα 3,60% και ένα
// 4,20% μοιάζουν και τα δύο εύλογα. Ελέγχονται και τα δύο, από τον browser.
{
  const ctx = await b.newContext({ viewport:{width:1280,height:1100}, locale:'el-GR' })
  const p = await page(ctx,'/kathari-apodosi')
  const pct = async label => {
    const txt = await p.locator('body').innerText().then(plain)
    const m = txt.match(new RegExp(label + '\\s*\\n\\s*([\\d.,]+)\\s*%'))
    return m ? num(m[1]) : null
  }
  const eur = async label => {
    const txt = await p.locator('body').innerText().then(plain)
    const m = txt.match(new RegExp(label + '\\s+[−-]?([\\d.,]+)\\s*€'))
    return m ? num(m[1]) : null
  }

  // Προεπιλογές: αξία 200.000, ενοίκιο 700, 12 μήνες, χωρίς ΕΝΦΙΑ και δαπάνες.
  // ακαθάριστο 8.400 · φορολογητέο 7.980 · φόρος 1.197 · καθαρά 7.203
  // μεικτή 4,20% · καθαρή 3,6015%
  ok('η μεικτή απόδοση ξεκινά στο 4,20%', Math.abs((await pct('ΜΕΙΚΤΗ ΑΠΟΔΟΣΗ')) - 4.20) < 0.01)
  // ΧΩΡΙΣ ΕΝΦΙΑ ΚΑΙ ΔΑΠΑΝΕΣ Η ΣΕΛΙΔΑ ΔΕΝ ΤΗΝ ΛΕΕΙ «ΚΑΘΑΡΗ». Αφαιρεί μόνο τον φόρο,
  // οπότε η ετικέτα γράφει ακριβώς αυτό (ApodosiCalculator, `netLabel`).
  const NET = 'ΑΠΟΔΟΣΗ ΜΕΤΑ ΤΟΝ ΦΟΡΟ'
  ok('η απόδοση μετά τον φόρο ξεκινά στο 3,60%', Math.abs((await pct(NET)) - 3.60) < 0.01)
  ok('και ο φόρος είναι 1.197,00 €', Math.abs((await eur('Φόρος εισοδήματος')) - 1197) < 0.02)

  // ── ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΚΑΝΕΝΑΣ ΑΛΛΟΣ ΔΕΝ ΚΑΝΕΙ ΣΩΣΤΑ ────────────────────────
  // Με άλλα 20.000 € ενοίκια, ο φόρος ΤΟΥ ΑΚΙΝΗΤΟΥ ανεβαίνει σε 2.293 €:
  // 26.980 φορολογητέο συνολικά μείον 19.000 χωρίς αυτό.
  const inputs = p.locator('input')
  await inputs.nth(5).fill('20000'); await p.waitForTimeout(300)
  ok('τα άλλα ενοίκια ανεβάζουν τον φόρο στα 2.293,00 €', Math.abs((await eur('Φόρος εισοδήματος')) - 2293) < 0.02)
  // καθαρά 8.400 − 2.293 = 6.107 · 6.107 / 200.000 = 3,0535%
  ok('και η απόδοση μετά τον φόρο πέφτει από 3,60% σε 3,05%', Math.abs((await pct(NET)) - 3.05) < 0.01)
  ok('η μεικτή δεν αλλάζει, γιατί δεν ξέρει τίποτα', Math.abs((await pct('ΜΕΙΚΤΗ ΑΠΟΔΟΣΗ')) - 4.20) < 0.01)
  await inputs.nth(5).fill('0'); await p.waitForTimeout(250)

  // ── ΧΩΡΙΣ ΑΞΙΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΟΣΟΣΤΟ ────────────────────────────────────
  await inputs.nth(0).fill('0'); await p.waitForTimeout(300)
  const body0 = await p.locator('body').innerText().then(plain)
  ok('χωρίς αξία δεν εμφανίζεται απόδοση', !body0.includes(NET) && !body0.includes('ΚΑΘΑΡΗ ΑΠΟΔΟΣΗ'))
  ok('…και δεν εμφανίζεται Infinity ή NaN', !/Infinity|NaN/.test(body0))
  await inputs.nth(0).fill('200000'); await p.waitForTimeout(250)

  // ── ΣΚΟΥΠΙΔΙΑ ΣΤΟ ΠΕΔΙΟ ────────────────────────────────────────────────
  await inputs.nth(1).fill('δεν ξέρω'); await p.waitForTimeout(300)
  const bodyJunk = await p.locator('body').innerText().then(plain)
  ok('σκουπίδια δεν σπάνε τη σελίδα', !/Infinity|NaN/.test(bodyJunk))
  ok('και το ακίνητο που δεν αποδίδει δεν βγάζει αρνητικά χρόνια', bodyJunk.includes('Δεν επιστρέφει'))

  ok('υπάρχει σύνδεσμος εγγραφής', await p.locator('a[href="/signup"]').count() > 0)
  await ctx.close()
}

// ── ΔΟΣΗ ΣΤΕΓΑΣΤΙΚΟΥ, σαν χρήστης ────────────────────────────────────────
// Το επιτόκιο δίνεται ΣΤΗ ΔΙΕΥΘΥΝΣΗ: η προεπιλογή του είναι το μέσο επιτόκιο
// της αγοράς όταν η βάση απαντά και κενό όταν δεν απαντά (τοπικό build). Τα
// αναμενόμενα δεν επιτρέπεται να εξαρτώνται από το τι έγραψε η ΕΚΤ τον μήνα.
//   150.000€, 3,5%, 25 έτη · r = 0,035/12 · (1+r)^300 ≈ 2,39588
//   δόση = 150.000 × r × 2,39588 / 1,39588 ≈ 750,94€ · τόκοι ≈ 75.280,61€
//   καθαρό 2.000€, πρώτη φορά: δόση έως 1.000€ · δάνειο έως ≈ 199.751€
{
  const ctx = await b.newContext({ viewport:{width:1280,height:1100}, locale:'el-GR' })
  const p = await page(ctx,'/ypologismos-stegastikou-daneiou?epitokio=3%2C5')
  const eur = async label => {
    const txt = await p.locator('body').innerText().then(plain)
    const m = txt.match(new RegExp(label + '\\s*\\n\\s*([\\d.,]+)\\s*€'))
    return m ? num(m[1]) : null
  }
  ok('δόση 150.000 € στο 3,5% για 25 έτη → 750,94 €', Math.abs((await eur('ΜΗΝΙΑΙΑ ΔΟΣΗ')) - 750.94) < 0.02)
  ok('…και τόκοι 75.280,61 €', Math.abs((await eur('ΣΥΝΟΛΟ ΤΟΚΩΝ')) - 75280.61) < 0.02)
  ok('καθαρό 2.000 € την πρώτη φορά → δάνειο έως 199.751 €', Math.abs((await eur('ΔΑΝΕΙΟ ΕΩΣ')) - 199751) < 0.02)
  ok('…με δόση έως 1.000 €', Math.abs((await eur('ΔΟΣΗ ΕΩΣ')) - 1000) < 0.02)

  // ── ΟΧΙ ΠΡΩΤΗ ΦΟΡΑ: ΤΟ ΟΡΙΟ ΠΕΦΤΕΙ ΣΤΟ 40% ─────────────────────────────
  await p.getByRole('button', { name: /^Όχι$/ }).click(); await p.waitForTimeout(250)
  ok('όχι πρώτη φορά → δόση έως 800 €', Math.abs((await eur('ΔΟΣΗ ΕΩΣ')) - 800) < 0.02)

  // ── ΚΥΜΑΙΝΟΜΕΝΟ: EURIBOR ΣΥΝ ΠΕΡΙΘΩΡΙΟ ──────────────────────────────────
  // 2,5 + 1 = 3,5%: η ίδια δόση με το σταθερό από πάνω.
  await p.getByRole('button', { name: /^Κυμαινόμενο$/ }).click(); await p.waitForTimeout(250)
  await p.getByLabel('Euribor', { exact: true }).fill('2,5')
  await p.getByLabel('Περιθώριο τράπεζας').fill('1'); await p.waitForTimeout(300)
  ok('κυμαινόμενο 2,5% + 1% → η ίδια δόση 750,94 €', Math.abs((await eur('ΜΗΝΙΑΙΑ ΔΟΣΗ')) - 750.94) < 0.02)
  const floating = await p.locator('body').innerText().then(plain)
  ok('…και λέει τι γίνεται αν ανέβει το Euribor', floating.includes('Αν ανέβει μία μονάδα'))

  // ── ΧΩΡΙΣ ΕΠΙΤΟΚΙΟ ΔΕΝ ΒΓΑΙΝΕΙ ΔΟΣΗ ΜΕ ΜΗΔΕΝ ────────────────────────────
  await p.getByLabel('Περιθώριο τράπεζας').fill(''); await p.waitForTimeout(300)
  const noRate = await p.locator('body').innerText().then(plain)
  ok('χωρίς περιθώριο δεν εμφανίζεται δόση', !noRate.includes('ΜΗΝΙΑΙΑ ΔΟΣΗ') && noRate.includes('Γράψε το Euribor'))
  await p.getByRole('button', { name: /^Σταθερό$/ }).click(); await p.waitForTimeout(250)

  // ── ΣΚΟΥΠΙΔΙΑ ───────────────────────────────────────────────────────────
  await p.getByLabel('Ποσό δανείου').fill('δεν ξέρω'); await p.waitForTimeout(300)
  const junk = await p.locator('body').innerText().then(plain)
  ok('σκουπίδια στο ποσό δεν σπάνε τη σελίδα', !/Infinity|NaN/.test(junk))
  ok('…και ζητούν ποσό', junk.includes('Η δόση χρειάζεται ποσό'))

  ok('η τιμή αγοράς ή η απουσία της λέγεται πάνω από τη φόρμα', junk.includes('ΜΕΣΟ ΕΠΙΤΟΚΙΟ ΑΓΟΡΑΣ') || junk.includes('Μέσο επιτόκιο αγοράς'))
  ok('υπάρχει σύνδεσμος εγγραφής', await p.locator('a[href="/signup"]').count() > 0)
  await ctx.close()
}

// ── ΣΥΓΚΡΙΣΗ ΤΙΜΟΛΟΓΙΩΝ ΡΕΥΜΑΤΟΣ, σαν χρήστης ─────────────────────────────
// Τα ποσά αλλάζουν με κάθε έλεγχο του καταλόγου, οπότε εδώ ΔΕΝ γράφονται
// καρφωτά: ελέγχεται ότι η οθόνη συμφωνεί με τον εαυτό της (η κορυφή με την
// πρώτη γραμμή, ο χρόνος με δώδεκα μήνες, το ετήσιο με το μηνιαίο). Τα ποσά τα
// φυλάει στο χέρι το lib/tools/revma.test.ts. Και, το κρισιμότερο, ότι με παλιό
// κατάλογο η σελίδα ΔΕΝ ονομάζει φθηνότερο, με το ρολόι του περιηγητή μετά το
// κατώφλι: η απόφαση κρίνεται στη συσκευή, όχι στο build.
{
  const POWER = '/sygkrisi-timologion-revmatos'
  const HERO = /ΦΘΗΝΟΤΕΡΟ ΤΟΝ ΜΗΝΑ\s*\n\s*([\d.,]+)\s*€/
  const YEAR = /ΤΟΝ ΧΡΟΝΟ\s*\n\s*([\d.,]+)\s*€/
  const STALE = 'Οι τιμές μπορεί να έχουν αλλάξει'
  const text = async p => p.locator('body').innerText().then(plain)
  const rowAmounts = async p => (await p.locator('li.tariff-row').allInnerTexts())
    .map(t => { const m = plain(t).match(/([\d.,]+)€\s*\n\s*([\d.,]+)€ τον χρόνο/); return m ? [num(m[1]), num(m[2])] : null })
    .filter(Boolean)

  const ctx = await b.newContext({ viewport:{width:1280,height:1100}, locale:'el-GR' })
  const p = await page(ctx, POWER)
  const t0 = await text(p)
  // Από 05/10/2026 η σελίδα γράφει την ημέρα και την πηγή όπως σε όλη την
  // εφαρμογή: «Τελευταία ενημέρωση: 05/10/2026. Πηγή: ΡΑΑΕΥ, energycost.gr» (ηη/μμ/εεεε, `grDate`).
  ok('ρεύμα: λέει πότε ελέγχθηκαν οι τιμές', /Τελευταία ενημέρωση: \d{2}\/\d{2}\/\d{4}/.test(t0))
  ok('ρεύμα: λέει την πηγή των τιμών', /Πηγή: ΡΑΑΕΥ, energycost\.gr/.test(t0))
  ok('ρεύμα: λέει τον μήνα των τιμών', /Τιμές \S+ \d{4}, εκτός όπου γράφεται άλλος μήνας/.test(t0))
  const stale = t0.includes(STALE)
  if (stale) {
    // Ο κατάλογος έχει ήδη παλιώσει τη μέρα που τρέχει ο έλεγχος: ισχύει η
    // ενδεικτική εκδοχή και αυτή ελέγχεται.
    ok('ρεύμα (παλιός κατάλογος): κανένα φθηνότερο', !HERO.test(t0))
  } else {
    const hero = Number(t0.match(HERO)?.[1] ? num(t0.match(HERO)[1]) : NaN)
    const year = Number(t0.match(YEAR)?.[1] ? num(t0.match(YEAR)[1]) : NaN)
    const rows = await rowAmounts(p)
    ok('ρεύμα: η κορυφή δείχνει φθηνότερο τον μήνα', Number.isFinite(hero) && hero > 0)
    ok('ρεύμα: και είναι το ποσό της πρώτης γραμμής', rows.length > 0 && Math.abs(rows[0][0] - hero) < 0.005)
    ok('ρεύμα: ο χρόνος είναι δώδεκα μήνες', Math.abs(year - Math.round(hero * 12 * 100) / 100) < 0.011)
    ok('ρεύμα: κάθε γραμμή, ετήσιο = 12 × μηνιαίο', rows.every(([m, y]) => Math.abs(y - Math.round(m * 1200) / 100) < 0.011))
    ok('ρεύμα: σε αύξουσα σειρά', rows.every(([m], i) => i === 0 || m >= rows[i - 1][0]))

    // 3.600 τον χρόνο είναι 300 τον μήνα: ίδια κορυφή.
    await p.getByRole('button', { name: 'Τον χρόνο' }).click()
    await p.locator('input').first().fill('3600'); await p.waitForTimeout(300)
    const t1 = await text(p)
    ok('ρεύμα: 3.600 τον χρόνο δίνουν την ίδια κορυφή με 300 τον μήνα', num(t1.match(HERO)?.[1] ?? 'x') === hero)
    await p.getByRole('button', { name: 'Τον μήνα' }).click()
    await p.locator('input').first().fill('300'); await p.waitForTimeout(250)

    // Το χρώμα φιλτράρει: στα σταθερά, μόνο ΜΠΛΕ.
    await p.locator('[role="combobox"]').first().click()
    await p.locator('[role="option"]', { hasText: 'Σταθερά (μπλε)' }).first().click()
    await p.waitForTimeout(250)
    const badges = await p.locator('li.tariff-row span[title]').allInnerTexts()
    ok('ρεύμα: τα σταθερά δείχνουν μόνο μπλε', badges.length > 0 && badges.every(x => x.trim() === 'ΜΠΛΕ'))
  }

  await p.locator('input').first().fill('0'); await p.waitForTimeout(300)
  const tz = await text(p)
  ok('ρεύμα: χωρίς κατανάλωση ζητά τον αριθμό', tz.includes('Γράψε την κατανάλωσή σου'))
  await p.locator('input').first().fill('δεν ξέρω'); await p.waitForTimeout(300)
  ok('ρεύμα: σκουπίδια χωρίς NaN ή Infinity', !/NaN|Infinity/.test(await text(p)))
  ok('ρεύμα: υπάρχει σύνδεσμος εγγραφής', await p.locator('a[href="/signup"]').count() > 0)
  await ctx.close()

  // ── ΤΟ ΡΟΛΟΙ ΜΕΤΑ ΤΟ ΚΑΤΩΦΛΙ: ΚΑΝΕΝΑ ΟΝΟΜΑ, ΚΑΜΙΑ ΣΕΙΡΑ ───────────────────
  // Ενα έτος μετά τον έλεγχο του καταλόγου ο κατάλογος είναι παλιός, όποια κι αν
  // είναι η μέρα του build. Η κορυφή δεν ονομάζει φθηνότερο, καμία γραμμή δεν
  // έχει αριθμό θέσης και ο σύνδεσμος της ΡΑΑΕΥ είναι εκεί.
  const late = await b.newContext({ viewport:{width:1280,height:1100}, locale:'el-GR' })
  const lp = await late.newPage()
  await lp.clock.setFixedTime(new Date('2027-10-01T10:00:00'))
  await lp.goto(B + POWER, { waitUntil: 'networkidle' })
  await lp.getByRole('button',{name:/κατάλαβα/i}).click().catch(()=>{}); await lp.waitForTimeout(400)
  const ts = await text(lp)
  ok('ρεύμα, παλιός κατάλογος: λέει ότι οι τιμές μπορεί να άλλαξαν', ts.includes(STALE))
  ok('ρεύμα, παλιός κατάλογος: δεν ονομάζει φθηνότερο', !HERO.test(ts) && !ts.includes('από το φθηνότερο'))
  const ranks = await lp.locator('li.tariff-row > span:first-child').allInnerTexts()
  ok('ρεύμα, παλιός κατάλογος: καμία γραμμή με θέση', ranks.length > 0 && ranks.every(x => x.trim() === ''))
  ok('ρεύμα, παλιός κατάλογος: σύνδεσμος προς τη ΡΑΑΕΥ', await lp.locator('a[href*="gov.gr"]').count() > 0)
  await late.close()
}

// ── Προσβασιμότητα & responsive και στα δύο ───────────────────────────────
for (const path of ['/ypologismos-forou-enoikion','/ypologismos-enfia','/kathari-apodosi','/vraxyxronia-i-makroxronia','/ypologismos-stegastikou-daneiou','/sygkrisi-timologion-revmatos']) {
  for (const w of [360, 390, 768, 1440]) {
    const ctx = await b.newContext({ viewport:{width:w,height:900}, locale:'el-GR', isMobile:w<700 })
    const p = await page(ctx, path)
    const m = await p.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      // Μαζί με τα input, ελέγχονται και τα combobox του CustomSelect: όταν τα
      // ντόπια <select> έφυγαν, ο έλεγχος προσβασιμότητας θα σταματούσε σιωπηλά
      // να κοιτάζει πεδία επιλογής — δηλαδή θα περνούσε επειδή δεν βρίσκει τίποτα.
      unlabelled: [...document.querySelectorAll('input,select,[role="combobox"]')].filter(el =>
        !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')
        && !document.querySelector(`label[for="${el.id}"]`)).length,
      h1: document.querySelectorAll('h1').length,
      jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
    }))
    ok(`${path} @${w}: χωρίς οριζόντια υπερχείλιση`, !m.overflow)
    ok(`${path} @${w}: κάθε πεδίο έχει ετικέτα`, m.unlabelled === 0)
    if (w===1440){ ok(`${path}: ακριβώς ένα h1`, m.h1===1); ok(`${path}: δομημένο σχήμα`, m.jsonld===1) }
    await ctx.close()
  }
}

// ── Το middleware δεν ζητά σύνδεση ────────────────────────────────────────
for (const path of ['/ypologismos-forou-enoikion','/ypologismos-enfia','/kathari-apodosi','/vraxyxronia-i-makroxronia','/ypologismos-stegastikou-daneiou','/sygkrisi-timologion-revmatos']) {
  const res = await fetch(B+path, { redirect:'manual' })
  ok(`${path}: δημόσιο (HTTP ${res.status})`, res.status === 200)
}

console.log(`\nE2E: ${pass} passed, ${fail} failed`)
await b.close()
process.exit(fail?1:0)
