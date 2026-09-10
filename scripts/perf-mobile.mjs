#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΣΟ ΑΡΓΕΙ ΣΕ ΚΙΝΗΤΟ ΜΕΣΑΙΑΣ ΚΑΤΗΓΟΡΙΑΣ, ΜΕ ΔΙΚΤΥΟ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΓΡΑΦΕΙΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ, ΓΡΑΜΜΕΝΟ ΧΩΡΙΣ ΩΡΑΙΟΠΟΙΗΣΗ. Το perf-budget.mjs ζυγίζει
// bytes — και το κάνει σωστά. Αλλά τα ανοίγει σε παράθυρο 1280×900, χωρίς
// καμία επιβράδυνση επεξεργαστή και πάνω από localhost, δηλαδή με μηδενική
// καθυστέρηση δικτύου. Δεν υπάρχει ούτε ένα `setViewport`, ούτε ένα
// `emulateNetworkConditions` σε ολόκληρο το αρχείο. Ενα βάρος 308 KB δεν λέει
// από μόνο του πόσο περιμένει ο άνθρωπος: τα ίδια bytes είναι στιγμή σε
// γραφείο και δεκαπέντε δευτερόλεπτα σε κινητό με μισή γραμμή.
//
// ΠΟΙΟΝ ΑΦΟΡΑ. Ο πελάτης του προϊόντος δεν κάθεται σε σταθμό εργασίας: είναι
// ιδιοκτήτης που ανοίγει το ταμπλό όρθιος, από κινητό, έξω από το σπίτι του.
// Αυτή η μέτρηση είναι η μόνη που τον περιγράφει.
//
// ═══ ΤΙ ΔΕΝ ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ═══════════════════════════════════════════
// ΔΕΝ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΗ ΣΥΣΚΕΥΗ. Είναι ΠΡΟΣΟΜΟΙΩΣΗ: ο επεξεργαστής του
// μηχανήματος επιβραδύνεται με πολλαπλασιαστή και το δίκτυο στραγγαλίζεται από
// τον περιηγητή. Τρία πράγματα που ΜΟΝΟ αληθινή συσκευή δείχνει, δεν τα βλέπει
// αυτό εδώ — είναι σημαντικό να μη νομίζει κανείς το αντίθετο:
//   · θερμικό στραγγάλισμα — το κινητό ζεσταίνεται κι κόβει συχνότητα
//   · η αληθινή GPU κι η σύνθεση των στρώσεων σε οθόνη αφής
//   · η μεταβλητότητα του κινητού δικτύου: αλλαγή κυψέλης, απώλεια πακέτων
// Ο,τι μετρηθεί εδώ είναι ΑΙΣΙΟΔΟΞΟ σε σχέση με το κινητό του πελάτη.
//
// ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ ΚΑΣΤΑΝΙΑ ΠΟΥ ΚΟΒΕΙ. Το scripts/lib/ratchet.mjs το
// γράφει ήδη για τον εαυτό του: «Οι καστάνιες που μετρώνται σε ΠΕΡΙΗΓΗΤΗ
// κουνιούνται κατά ένα εικονοστοιχείο ανάμεσα σε μηχανές. Εκεί το κάτω από το
// όριο είναι θόρυβος κι όχι βελτίωση· ένας φύλακας που κοκκινίζει από θόρυβο
// παρακάμπτεται.» Ο χρόνος κουνιέται πολύ περισσότερο από ένα εικονοστοιχείο:
// η επιβράδυνση είναι ΠΟΛΛΑΠΛΑΣΙΑΣΤΗΣ πάνω στον επεξεργαστή ΑΥΤΟΥ του
// μηχανήματος, άρα ο ίδιος κώδικας δίνει άλλο νούμερο σε άλλον δρομέα.
// Ενας τέτοιος φύλακας μέσα στο μπλοκάρισμα θα κοκκίνιζε τυχαία κι μέσα σε
// έναν μήνα κάποιος θα τον παρέκαμπτε — δηλαδή θα ήταν χειρότερος από
// ανύπαρκτος. Εδώ γράφεται ΑΝΑΦΟΡΑ με ρητή ένδειξη οπισθοδρόμησης, που τη
// διαβάζει άνθρωπος.
//
// ΠΡΟΫΠΟΘΕΣΗ: παραγωγικό build σε λειτουργία.
//     npm run build && npx next start -p 3100
//     node scripts/perf-mobile.mjs                (αναφορά)
//     node scripts/perf-mobile.mjs --write        (καταγραφή νέας βάσης)
// ═══════════════════════════════════════════════════════════════════════════
import { chromePath } from './lib/chrome.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASELINE = new URL('../docs/perf/mobile.json', import.meta.url).pathname;
const BASE = process.env.PERF_BASE || 'http://localhost:3100';
const WRITE = process.argv.includes('--write');

// ── Η ΣΥΣΚΕΥΗ ─────────────────────────────────────────────────────────────
// 390×844 είναι το πλάτος που ήδη σαρώνεται σε είκοσι δύο συσκευές κι είναι
// το πιο κοινό μέγεθος κινητού. Ο πολλαπλασιαστής 4 στον επεξεργαστή είναι ο
// ΤΕΚΜΗΡΙΩΜΕΝΟΣ ορισμός «μεσαίας κατηγορίας Android» που χρησιμοποιεί το
// Lighthouse για τη φορητή του μέτρηση — διαλέγεται ΕΠΕΙΔΗ είναι δημοσιευμένος
// κι συγκρίσιμος, όχι επειδή μαντέψαμε εμείς έναν αριθμό.
const DEVICE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'el-GR',
  userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};
const CPU_SLOWDOWN = 4;

// ── ΤΟ ΔΙΚΤΥΟ ─────────────────────────────────────────────────────────────
// ΔΥΟ ΠΡΟΦΙΛ, ΓΙΑΤΙ ΕΝΑ ΛΕΕΙ ΤΑ ΜΙΣΑ. Το «αργό» είναι το τεκμηριωμένο Slow 4G
// του Lighthouse κι δείχνει τη χειρότερη ρεαλιστική περίπτωση: μετακίνηση,
// υπόγειο, γεμάτη κυψέλη. Το «καλό» δείχνει τι βλέπει ο ίδιος άνθρωπος με
// πλήρες σήμα. Η διαφορά των δύο είναι που λέει αν το πρόβλημα είναι το
// ΒΑΡΟΣ (τότε το αργό δίκτυο το τριπλασιάζει) ή ο ΚΩΔΙΚΑΣ (τότε τα δύο
// νούμερα είναι κοντά κι φταίει ο επεξεργαστής).
//
// Δεν εφευρίσκουμε «ελληνικά» νούμερα δικτύου: δεν έχουμε μέτρηση δικτύου
// παρόχου στα χέρια μας κι ένας αριθμός βγαλμένος από το μυαλό θα ήταν
// χειρότερος από κανέναν, επειδή θα φαινόταν ακριβής.
// Τα ονόματα των πεδίων είναι ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ (downloadThroughput σε bytes ανά
// δευτερόλεπτο, latency σε χιλιοστά) κι όχι δικά μας: γραμμένα αλλιώς, το CDP
// τα αγνοεί ΣΙΩΠΗΛΑ κι η μέτρηση βγαίνει χωρίς κανέναν στραγγαλισμό — δηλαδή
// ψεύτικη, με τον χειρότερο τρόπο, γιατί δείχνει γρήγορη.
const NETWORKS = {
  'αργό 4G': { downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, latency: 150 },
  'καλό 4G': { downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8, latency: 40 },
};

const ROUTES = [
  { path: '/', what: 'αρχική, η πρώτη οθόνη κάθε επισκέπτη' },
  { path: '/ypologismos-forou-enoikion', what: 'φόρος ενοικίων, το βαρύτερο δημόσιο εργαλείο' },
  { path: '/login', what: 'σύνδεση, η πύλη κάθε συνδρομητή' },
];

/**
 * ΠΟΣΕΣ ΦΟΡΕΣ ΤΡΕΧΕΙ Η ΚΑΘΕ ΜΕΤΡΗΣΗ, ΚΑΙ ΓΙΑΤΙ ΚΡΑΤΑΜΕ ΤΗ ΔΙΑΜΕΣΟ.
 * Μία μέτρηση χρόνου δεν είναι μέτρηση: ένα σκουπίδι της μνήμης ή μια στιγμή
 * που ο δρομέας μοιράστηκε τον επεξεργαστή αλλάζει το νούμερο κατά διακόσια
 * χιλιοστά. Η διάμεσος τριών πετά τη μία ακραία εκτέλεση χωρίς να χρειάζεται
 * να αποφασίσουμε ποια ήταν «λάθος».
 */
const RUNS = 3;

const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ms = n => `${Math.round(n)}`.padStart(6) + ' ms';

/**
 * Οι μετρήσεις μιας φόρτωσης, από τον ΙΔΙΟ τον περιηγητή.
 *
 * ΓΙΑΤΙ PerformanceObserver ΚΑΙ ΟΧΙ ΡΟΛΟΪ ΤΟΥ NODE. Το ρολόι από έξω μετρά
 * πότε γύρισε το `goto`, δηλαδή δίκτυο συν απόδοση συν την ίδια τη γέφυρα του
 * αυτοματισμού. Ο περιηγητής ξέρει πότε ΖΩΓΡΑΦΙΣΕ — κι αυτό είναι που βλέπει
 * ο άνθρωπος. Το «μεγαλύτερο σχεδίασμα» κλείνει μόνο όταν σταματήσει να
 * αλλάζει, γι' αυτό διαβάζεται αφού ηρεμήσει το δίκτυο.
 */
async function metrics(page) {
  return page.evaluate(() => {
    const one = t => performance.getEntriesByType(t)[0];
    const paint = performance.getEntriesByName('first-contentful-paint')[0];
    const nav = one('navigation');
    // ΤΟ ΜΠΛΟΚΑΡΙΣΜΕΝΟ ΝΗΜΑ ΕΙΝΑΙ Ο ΧΡΟΝΟΣ ΠΟΥ Η ΟΘΟΝΗ ΔΕΝ ΑΠΑΝΤΑΕΙ. Μετρά
    // μόνο ό,τι ΞΕΠΕΡΝΑΕΙ τα 50 χιλιοστά σε κάθε μακρά εργασία: ώς εκεί ο
    // άνθρωπος δεν αντιλαμβάνεται καθυστέρηση στο πάτημα.
    const blocking = (window.__longTasks || [])
      .reduce((sum, d) => sum + Math.max(0, d - 50), 0);
    return {
      fcp: paint ? paint.startTime : 0,
      lcp: window.__lcp || 0,
      interactive: nav ? nav.domInteractive : 0,
      blocking,
    };
  });
}

/** Οι δύο παρατηρητές μπαίνουν ΠΡΙΝ από κάθε πλοήγηση, αλλιώς χάνουν τα συμβάντα. */
const OBSERVERS = `
  window.__lcp = 0; window.__longTasks = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
    .observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__longTasks.push(e.duration); })
    .observe({ type: 'longtask', buffered: true });
`;

void (async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || chromePath(),
    args: ['--no-sandbox'],
  });

  const measured = {};
  for (const [netName, net] of Object.entries(NETWORKS)) {
    for (const r of ROUTES) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        // ΚΑΘΕ ΕΚΤΕΛΕΣΗ ΣΕ ΑΔΕΙΑ ΜΝΗΜΗ. Με κοινή μνήμη η δεύτερη φόρτωση δεν
        // κατεβάζει τίποτα κι ο χρόνος που θα κρατούσαμε δεν θα ήταν κανενός
        // πρωτοεμφανιζόμενου επισκέπτη — που είναι ακριβώς ο επισκέπτης που
        // αποφασίζει αν θα μείνει.
        const ctx = await browser.newContext(DEVICE);
        const page = await ctx.newPage();
        await page.addInitScript(OBSERVERS);
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

        const resp = await page.goto(BASE + r.path, { waitUntil: 'networkidle', timeout: 120000 });
        const landed = new URL(page.url()).pathname;
        if (landed !== r.path) {
          console.error(`✗ Το ${r.path} κατέληξε στο ${landed} (HTTP ${resp?.status()}).`);
          console.error('  Δεν είναι δημόσια διαδρομή, άρα ο χρόνος θα ήταν άλλης σελίδας.');
          process.exit(1);
        }
        runs.push(await metrics(page));
        await ctx.close();
      }
      const key = `${netName} · ${r.path}`;
      measured[key] = {
        fcp: Math.round(median(runs.map(x => x.fcp))),
        lcp: Math.round(median(runs.map(x => x.lcp))),
        interactive: Math.round(median(runs.map(x => x.interactive))),
        blocking: Math.round(median(runs.map(x => x.blocking))),
        what: r.what,
      };
      const m = measured[key];
      console.log(`${key.padEnd(46)} FCP ${ms(m.fcp)} · LCP ${ms(m.lcp)} · μπλοκ ${ms(m.blocking)}`);
    }
  }
  await browser.close();

  if (WRITE) {
    mkdirSync(new URL('../docs/perf/', import.meta.url).pathname, { recursive: true });
    writeFileSync(BASELINE, JSON.stringify({
      σημείωση: 'ΠΡΟΣΟΜΟΙΩΣΗ κινητού, ΟΧΙ αληθινή συσκευή: επεξεργαστής /4 κι '
        + 'στραγγαλισμένο δίκτυο, σε παραγωγικό build. Τα νούμερα εξαρτώνται από '
        + 'τον επεξεργαστή του μηχανήματος που μετράει, γι΄ αυτό η σύγκριση είναι '
        + 'ΑΝΑΦΟΡΑ προς άνθρωπο κι όχι φύλακας που κόβει. Διάμεσος τριών εκτελέσεων.',
      device: { ...DEVICE.viewport, cpuSlowdown: CPU_SLOWDOWN },
      routes: measured,
    }, null, 2) + '\n');
    console.log(`\n✍  Γράφτηκε η βάση στο ${BASELINE}`);
    process.exit(0);
  }

  // ── Η ΣΥΓΚΡΙΣΗ ──────────────────────────────────────────────────────────
  let base;
  try { base = JSON.parse(readFileSync(BASELINE, 'utf8')); }
  catch {
    console.log('\nΔεν υπάρχει βάση ακόμη. Τρέξε ξανά με --write για να καταγραφεί.');
    process.exit(0);
  }
  // Το περιθώριο είναι ΜΕΓΑΛΟ επίτηδες: μετράμε χρόνο σε μηχάνημα που το
  // μοιράζεται με άλλους. Κάτω από αυτό δεν ξεχωρίζει η οπισθοδρόμηση από τον
  // θόρυβο — μια ένδειξη που χτυπά από θόρυβο παύει να διαβάζεται.
  const SLACK = 0.30;
  let worse = 0;
  for (const [key, m] of Object.entries(measured)) {
    const b = base.routes?.[key];
    if (!b) { console.log(`• νέα διαδρομή, χωρίς βάση: ${key}`); continue; }
    for (const metric of ['fcp', 'lcp', 'blocking']) {
      if (b[metric] > 0 && m[metric] > b[metric] * (1 + SLACK)) {
        console.error(`✗ ${key} — ${metric}: ${m[metric]} ms, βάση ${b[metric]} ms`);
        worse++;
      }
    }
  }
  console.log(worse === 0
    ? '\n✓ Καμία οπισθοδρόμηση πάνω από τον θόρυβο.'
    : `\n✗ ${worse} μετρήσεις χειρότερες πάνω από το περιθώριο. Δες τι μπήκε.`);
  process.exit(0);
})();
