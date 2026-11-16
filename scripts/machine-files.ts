// ═══════════════════════════════════════════════════════════════════════════
// ΓΡΑΦΕΙ ΤΑ ΣΤΑΤΙΚΑ ΑΡΧΕΙΑ ΓΙΑ ΜΗΧΑΝΕΣ: public/humans.txt, public/odigos/feed.xml
// ─────────────────────────────────────────────────────────────────────────
// Δεν φυλάει, ΓΡΑΦΕΙ. Οτι τα αρχεία συμφωνούν με τον κώδικα (lib/seo/humans.ts,
// lib/seo/feed.ts) το φυλάει το app/siteCatalog.test.ts. Στατικά και όχι
// διαδρομές του app/, γιατί κάθε διαδρομή ανεβαίνει ως δική της συνάρτηση
// (scripts/server-weight.mjs, docs/perf/server.json).
//   npx tsx scripts/machine-files.ts
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs';
import { humansText } from '../lib/seo/humans';
import { guidesFeed } from '../lib/seo/feed';

const MACHINE_FILES = { 'public/humans.txt': humansText, 'public/odigos/feed.xml': guidesFeed } as const;

mkdirSync('public/odigos', { recursive: true });
for (const [path, make] of Object.entries(MACHINE_FILES)) {
  writeFileSync(path, make());
  console.log(`✓ ${path}`);
}
