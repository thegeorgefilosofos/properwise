#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΜΙΑ ΣΕΛΙΔΑ ΔΕΝ ΣΕΡΝΕΤΑΙ ΔΕΞΙΑ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΟΠΩΣ ΒΡΕΘΗΚΕ (16/09/2026). Η σελίδα των πακέτων σερνόταν
// οριζόντια σε ΚΑΘΕ πλάτος παραθύρου κάτω από τα 830: στα 320 κατά 489
// εικονοστοιχεία, στα 390 κατά 419, στα 820 κατά 10. Η σελίδα όπου ο
// επισκέπτης διαλέγει τι θα πληρώσει, να φεύγει δεξιά με το πρώτο άγγιγμα.
//
// ΚΑΙ ΔΕΚΑΤΕΣΣΕΡΙΣ ΣΑΡΩΤΕΣ ΔΕΝ ΤΟ ΕΙΔΑΝ, ΓΙΑ ΔΥΟ ΛΟΓΟΥΣ ΠΟΥ ΑΞΙΖΟΥΝ ΓΡΑΦΤΟΙ:
//
//   1. ΟΛΟΙ ΤΡΕΧΟΥΝ ΜΕ `isMobile: true`. Εκεί ο Chromium χωρίζει layout από
//      visual viewport κι ΑΠΟΡΡΟΦΑ την υπερχείλιση: το `window.scrollX` μένει
//      0 όσο κι αν ξεχειλίζει. Το ίδιο ακριβώς build, στο ίδιο πλάτος, χωρίς
//      `isMobile`, σέρνεται 419. Η προσομοίωση κινητού ΚΡΥΒΕΙ αυτό το σφάλμα.
//
//   2. ΤΟ `scrollWidth` ΛΕΕΙ ΨΕΜΑΤΑ ΚΑΙ ΠΡΟΣ ΤΙΣ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ. Στην ίδια
//      σελίδα έδινε 809 ΚΑΙ στα δύο περιβάλλοντα, ενώ μόνο στο ένα κυλούσε
//      στ' αλήθεια. Αυτός ο σαρωτής ΔΕΝ το ρωτά: προσπαθεί να κυλήσει, όπως
//      θα έσερνε το δάχτυλο — και ρωτά πού κατέληξε.
//
// ΠΟΥ ΤΟ ΒΛΕΠΕΙ Ο ΑΝΘΡΩΠΟΣ: μισή οθόνη, μικρό φορητό, δύο παράθυρα δίπλα
// δίπλα, iPad με δύο εφαρμογές. Οχι σπάνιο — συνηθισμένο.
//
// ΠΡΟΫΠΟΘΕΣΗ: παραγωγικό build σε λειτουργία στο BASE_URL.
// ═══════════════════════════════════════════════════════════════════════════
import pkg from 'playwright-core';
import { chromePath } from './lib/chrome.mjs';
import { PUBLIC, BASE } from './rendered/targets.mjs';
import { MODE } from './lib/bench-mode.mjs';
const { chromium } = pkg;

// Τα πλάτη όπου ζει ο κόσμος: τηλέφωνο, φάμπλετ, μισή οθόνη, ταμπλέτα, φορητός.
const WIDTHS = [320, 360, 390, 430, 540, 640, 768, 820, 1024, 1280];

try {
  const r = await fetch(BASE + '/', { redirect: 'manual' });
  if (!r.status) throw new Error('χωρίς κωδικό');
} catch (e) {
  console.error(`✗ ο διακομιστής δεν απαντά στο ${BASE} (${e.message})\n  Τρέξε: npm run build && npm run start`);
  process.exit(2);
}

const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
console.log(`  ${PUBLIC.length} σελίδες × ${WIDTHS.length} πλάτη · θέμα ${MODE === 'light' ? 'φωτεινό' : 'σκούρο'} · ΧΩΡΙΣ προσομοίωση κινητού`);

const findings = [];
let checked = 0;

for (const w of WIDTHS) {
  // ΣΚΟΠΙΜΑ ΧΩΡΙΣ `isMobile`. Δες τον λόγο 1 στην κεφαλίδα.
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addInitScript(m => {
    try { localStorage.setItem('pos_mode', m); } catch { /* κλειστή αποθήκη */ }
  }, MODE);
  const page = await ctx.newPage();
  for (const path of PUBLIC) {
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(150);
      checked++;
      const x = await page.evaluate(async () => {
        // Η ΜΟΝΗ ΕΡΩΤΗΣΗ ΠΟΥ ΜΕΤΡΑΕΙ: αν σπρώξω, φεύγει;
        window.scrollTo(9999, 0);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const sx = Math.round(window.scrollX);
        window.scrollTo(0, 0);
        return sx;
      });
      if (x > 0) findings.push({ w, path, x });
    } catch (e) {
      console.log(`  ! ${w}px ${path}: ${e.message.slice(0, 60)}`);
    }
  }
  await ctx.close();
}
await browser.close();

if (findings.length) {
  console.error(`\n✗ ${findings.length} από ${checked} συνδυασμοί σέρνονται οριζόντια:\n`);
  const byPath = new Map();
  for (const f of findings) { if (!byPath.has(f.path)) byPath.set(f.path, []); byPath.get(f.path).push(f); }
  for (const [path, list] of byPath) {
    console.error(`  ${path}`);
    for (const f of list) console.error(`     ${String(f.w).padStart(5)}px → σέρνεται ${f.x}px δεξιά`);
  }
  console.error(`
  ΠΡΩΤΟΣ ΥΠΟΠΤΟΣ: στοιχείο με \`position: absolute\` μέσα σε κυλιόμενο κουτί
  που είναι \`position: static\`. Τέτοιο στοιχείο ΔΕΝ το κόβει ο πρόγονος —
  ούτε καν με \`overflow: hidden\` — γιατί περιέκτης του γίνεται το \`body\`.
  Δώσε \`position: relative\` στον κυλιόμενο· η κλάση \`.po-scroll-x\` το έχει.

  ΔΕΥΤΕΡΟΣ: σταθερό πλάτος ή \`min-width\` σε στοιχείο εκτός κυλιόμενου κουτιού.`);
  process.exit(1);
}
console.log(`\n✅ Καμία από τις ${checked} σελίδες δεν σέρνεται οριζόντια.`);
