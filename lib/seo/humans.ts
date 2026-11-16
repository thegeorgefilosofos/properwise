// ═══════════════════════════════════════════════════════════════════════════
// /humans.txt: ΠΟΙΟΙ ΚΑΙ ΜΕ ΤΙ (humanstxt.org)
// ─────────────────────────────────────────────────────────────────────────
// Η ομάδα ως «Ομάδα Properwise», η ίδια υπογραφή με τους υπολογιστές και τους
// οδηγούς, χωρίς ονόματα προσώπων. Τίποτα γραμμένο δεύτερη φορά: η επικοινωνία
// από το lib/legal/identity.ts, οι εκδόσεις από το package.json και η
// ημερομηνία από τον χάρτη ιστότοπου (app/siteCatalog.ts), η νεότερη των
// δημόσιων σελίδων. Οι πάροχοι δεν γράφονται εδώ αλλά παραπέμπουν στην
// Πολιτική απορρήτου: όσοι είναι ενεργοί εξαρτώνται από τα κλειδιά της
// παραγωγής, που ένα στατικό αρχείο δεν βλέπει.
//
// ΣΤΑΤΙΚΟ ΑΡΧΕΙΟ, ΟΧΙ ΔΙΑΔΡΟΜΗ (16/11/2026). Κάθε διαδρομή του app/ ανεβαίνει ως
// δική της συνάρτηση (~6 MB, docs/perf/server.json). Το κείμενο γράφεται στο
// public/humans.txt με `npm run machine-files` και το app/siteCatalog.test.ts
// κοκκινίζει όταν το αρχείο μείνει πίσω από τον κώδικα.
// ═══════════════════════════════════════════════════════════════════════════
import pkg from '@/package.json';
import { SITE_HOST, siteUrl } from '@/lib/core/site';
import { grDate } from '@/lib/core/format';
import { IDENTITY } from '@/lib/legal/identity';
import { XARTIS_UPDATED } from '@/app/siteCatalog';

/** Η κύρια έκδοση μιας εξάρτησης, από το εύρος του package.json («^16.4.3» → «16»). */
const major = (range: string | undefined): string => /\d+/.exec(range ?? '')?.[0] ?? '';

const deps = pkg.dependencies as Record<string, string>;
const dev = pkg.devDependencies as Record<string, string>;

export function humansText(): string {
  const stack = [
    `Next.js ${major(deps.next)}`,
    `React ${major(deps.react)}`,
    `TypeScript ${major(dev.typescript ?? deps.typescript)}`,
    'Supabase (PostgreSQL)',
  ];
  return [
    '/* ΟΜΑΔΑ */',
    '',
    '  Ομάδα Properwise',
    `  Επικοινωνία: ${IDENTITY.supportEmail}`,
    `  Ασφάλεια: ${IDENTITY.securityEmail}`,
    `  Ιστότοπος: ${SITE_HOST}`,
    '  Τόπος: Ελλάδα',
    '',
    '/* ΙΣΤΟΤΟΠΟΣ */',
    '',
    `  Τελευταία ενημέρωση: ${grDate(XARTIS_UPDATED)}`,
    '  Γλώσσες: Ελληνικά, English',
    `  Λογισμικό: ${stack.join(', ')}`,
    '  Πρότυπα: HTML, CSS, WAI-ARIA, schema.org, RSS 2.0',
    '',
    '/* ΠΑΡΟΧΟΙ */',
    '',
    `  Οι πάροχοι και πού επεξεργάζονται δεδομένα: ${siteUrl('/privacy')}`,
    '',
    '/* ΓΙΑ ΤΙΣ ΜΗΧΑΝΕΣ */',
    '',
    `  Χάρτης ιστότοπου: ${siteUrl('/xartis')}`,
    `  Για εργαλεία AI: ${siteUrl('/llms.txt')}`,
    `  Ασφάλεια: ${siteUrl('/.well-known/security.txt')}`,
    '',
  ].join('\n');
}
