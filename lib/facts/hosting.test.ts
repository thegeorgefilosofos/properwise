// npx tsx lib/facts/hosting.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΛΑΚΙΔΙΟ «ΕΙΣΠΡΑΞΕΙΣ ΦΙΛΟΞΕΝΙΑΣ» ΣΤΟ ΜΙΣΟ ΠΛΑΤΟΣ (07.10.2026)
// ─────────────────────────────────────────────────────────────────────────
// Στα 390 η γραμμή «δηλωτέο 4.250,00€ · 31 διανυκτερεύσεις · επόμενη άφιξη
// 12 Οκτ» έσπαγε σε τέσσερις γραμμές. Ίδια λύση με τις «Δαπάνες έτους»: στο
// πλακίδιο το σύντομο (πρώτα το ποσό), στην εξήγηση το πλήρες.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { hostingParts, hostingPartsShort, HOSTING_LABELS, HOSTING_SHORT_LABELS } from './index';
import { fe } from '@/lib/core/format';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, got?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`); }
};

const h = { declarable: 4250, nights: 31 };
const fd = (d: string) => d.split('-').reverse().join('/');
const short = hostingPartsShort(h, fe);
const full = hostingParts(h, '2026-10-12', fe, fd);

ok('σύντομο: πρώτα το ποσό, μετά η λέξη', short === `${fe(4250)} ${HOSTING_SHORT_LABELS.declarable} · 31 ${HOSTING_SHORT_LABELS.nights}`, short);
ok('σύντομο: χωρίς την επόμενη άφιξη', !short.includes(HOSTING_LABELS.next));
ok('σύντομο: το πολύ το μισό μήκος του πλήρους', short.length * 2 <= full.length, `${short.length} / ${full.length}`);
// Στα 390 ένα μισό πλακίδιο χωρά περίπου 22 χαρακτήρες στη γραμμή της
// εξήγησης· το σύντομο πρέπει να χωρά σε δύο γραμμές.
ok('σύντομο: χωρά σε δύο γραμμές μισού πλακιδίου', short.length <= 30, short.length);
ok('πλήρες: ίδια ποσά με το σύντομο', full.includes(fe(4250)) && full.includes('31 '), full);
ok('πλήρες: με την επόμενη άφιξη', full.endsWith(`${HOSTING_LABELS.next} 12/10/2026`), full);
ok('χωρίς νύχτες: μόνο το ποσό', hostingPartsShort({ declarable: 0, nights: 0 }, fe) === `${fe(0)} ${HOSTING_SHORT_LABELS.declarable}`);
ok('χωρίς επόμενη άφιξη: το πλήρες τελειώνει στις νύχτες', hostingParts(h, null, fe, fd).endsWith(`31 ${HOSTING_LABELS.nights}`));

const ov = readFileSync('app/dashboard/components/OverviewTab.tsx', 'utf8');
ok('η Επισκόπηση γράφει το σύντομο στο πλακίδιο', /sub: hostingPartsShort\(hosting, fmtEur\)/.test(ov));
ok('η Επισκόπηση κρατά το πλήρες στην εξήγηση', /hostingParts\(\{ declarable: hosting\.declarable, nights: hostingNights \}, nextArrival, fmtEur, fd\)/.test(ov));
ok('δεν έμεινε το παλιό κείμενο στο πλακίδιο', !/`δηλωτέο \$\{fmtEur\(hosting\.declarable\)\}`/.test(ov));

console.log(fail ? `✗ hosting: ${fail} απέτυχαν από ${pass + fail}` : `✓ hosting: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
