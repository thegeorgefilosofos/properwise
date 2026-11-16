// ═══════════════════════════════════════════════════════════════════════════
// /humans.txt: ΠΟΙΟΙ ΚΑΙ ΜΕ ΤΙ (humanstxt.org)
// ─────────────────────────────────────────────────────────────────────────
// Η ομάδα ως «Ομάδα Properwise», η ίδια υπογραφή με τους υπολογιστές και τους
// οδηγούς, χωρίς ονόματα προσώπων. Τίποτα γραμμένο δεύτερη φορά: η επικοινωνία
// από το lib/legal/identity.ts, οι εκδόσεις από το package.json, οι πάροχοι
// από το μητρώο εκτελούντων (lib/legal/subprocessors.ts, όσοι επεξεργάζονται
// δεδομένα σήμερα, όπως στην Πολιτική απορρήτου) και η ημερομηνία από τον
// χάρτη ιστότοπου (app/siteCatalog.ts), η νεότερη των δημόσιων σελίδων.
// ═══════════════════════════════════════════════════════════════════════════
import pkg from '@/package.json';
import { SITE_HOST, siteUrl } from '@/lib/core/site';
import { grDate } from '@/lib/core/format';
import { IDENTITY } from '@/lib/legal/identity';
import { activeSubprocessors } from '@/lib/legal/subprocessors';
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
    ...activeSubprocessors().map(s => `  ${s.name} (${s.where}): ${s.short}`),
    '',
    '/* ΓΙΑ ΤΙΣ ΜΗΧΑΝΕΣ */',
    '',
    `  Χάρτης ιστότοπου: ${siteUrl('/xartis')}`,
    `  Για εργαλεία AI: ${siteUrl('/llms.txt')}`,
    `  Ασφάλεια: ${siteUrl('/.well-known/security.txt')}`,
    '',
  ].join('\n');
}
