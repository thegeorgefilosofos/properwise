// ═══════════════════════════════════════════════════════════════════════════
// Η ΗΜΕΡΟΜΗΝΙΑ ΤΟΥ ΧΑΡΤΗ ΙΣΤΟΤΟΠΟΥ (/xartis), ΧΩΡΙΣ ΤΟΝ ΚΑΤΑΛΟΓΟ
// ─────────────────────────────────────────────────────────────────────────
// Η νεότερη από τις σελίδες που δείχνει ο χάρτης, όπως του /odigos από τους
// οδηγούς του: κάθε γραμμή του PAGE_UPDATED, ο κόμβος των εργαλείων, ο κόμβος
// των οδηγών (η νεότερη των οδηγών) και οι προθεσμίες. Ζει χωριστά από το
// app/siteCatalog.ts ώστε το /sitemap.xml να μην κουβαλά τα ονόματα και τις
// αγγλικές εκδοχές στη συνάρτησή του (docs/perf/server.json). Το
// app/siteCatalog.test.ts ελέγχει ότι είναι η νεότερη ημερομηνία του καταλόγου.
// ═══════════════════════════════════════════════════════════════════════════
import { PROTHESMIES_UPDATED } from '@/lib/seo/prothesmies';
import { GUIDES_UPDATED } from './odigos/guides';
import { PAGE_UPDATED, TOOLS_UPDATED } from './pageUpdated';
import { HUBS } from './thema/hubs';
import { hubUpdated, METHOD_UPDATED } from './thema/hubDates';

export const XARTIS_UPDATED: string = [...Object.values(PAGE_UPDATED), TOOLS_UPDATED, GUIDES_UPDATED, PROTHESMIES_UPDATED, METHOD_UPDATED, ...HUBS.map(hubUpdated)].sort().at(-1)!;
