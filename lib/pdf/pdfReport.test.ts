// npx tsx lib/pdf/pdfReport.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΧΑΡΤΙ ΠΟΥ ΦΕΥΓΕΙ ΑΠΟ ΤΑ ΧΕΡΙΑ ΤΟΥ ΧΡΗΣΤΗ ΔΕΝ ΕΙΧΕ ΚΑΝΕΝΑΝ ΕΛΕΓΧΟ
//
// Το `buildDocDefinition` είναι καθαρή συνάρτηση — μοντέλο μέσα, δομή pdfmake
// έξω — και το λέει ρητά το σχόλιό της («Ελέγξιμος και σε Node»). Παρ' όλα
// αυτά δεν υπήρχε ούτε ένας έλεγχος: η λευκή επωνυμία αγνοούσε το χρώμα του
// συνδρομητή για άγνωστο διάστημα και κανένα κόκκινο δεν το είπε.
// ═══════════════════════════════════════════════════════════════════════════
import { buildDocDefinition, type PdfReportModel } from './pdfReport';
import { INK } from '@/lib/print/ink';
import { DEFAULT_ACCENT, type ReportBranding } from '@/lib/reportBranding';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); } };

const base = (branding?: ReportBranding | null): PdfReportModel => ({
  branding,
  docType: 'Λογιστική αναφορά',
  title: 'Λογιστική αναφορά ακινήτου',
  meta: { id: 'PO-260908-TEST', issuedAt: '2026-09-08T09:00:00.000Z', verifyUrl: '' },
  sections: [{ type: 'note', text: 'δοκιμή' }],
  disclaimer: 'Ενδεικτικό.',
});

/** Ολα τα χρώματα που εμφανίζονται οπουδήποτε στο δέντρο, όσο βαθιά κι αν είναι. */
function colours(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) { node.forEach(n => colours(n, out)); return out; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if ((k === 'color' || k === 'lineColor') && typeof v === 'string') out.push(v.toLowerCase());
      else colours(v, out);
    }
  }
  return out;
}

const brand: ReportBranding = {
  enabled: true, companyName: 'Λογιστικό Γραφείο Α', logoUrl: '',
  accentColor: '#8b1e3f', phone: '', email: '',
};

// ── ΜΕ ΛΕΥΚΗ ΕΠΩΝΥΜΙΑ: ΤΟ ΧΡΩΜΑ ΤΟΥ ΣΥΝΔΡΟΜΗΤΗ ΦΤΑΝΕΙ ΣΤΟ ΧΑΡΤΙ ───────────
{
  const c = colours(buildDocDefinition(base(brand)));
  ok('το χρώμα επωνυμίας μπαίνει στο έγγραφο', c.includes('#8b1e3f'));
  ok('μπαίνει τουλάχιστον δύο φορές (επωνυμία + γραμμή)', c.filter(x => x === '#8b1e3f').length >= 2);
}

// ── ΧΩΡΙΣ ΛΕΥΚΗ ΕΠΩΝΥΜΙΑ: ΜΕΛΑΝΙ, ΟΧΙ ΓΑΛΑΖΙΟ ────────────────────────────
// Το `reportAccent` γυρίζει το προεπιλεγμένο μπλε όταν δεν έχει οριστεί χρώμα.
// Αν έμπαινε ανεξάρτητα από τη σημαία, κάθε βεβαίωση ενοικίου κάθε ιδιώτη θα
// έβγαινε με γαλάζια γραμμή που δεν είναι επωνυμία κανενός.
{
  const c = colours(buildDocDefinition(base(null)));
  ok('χωρίς επωνυμία δεν μπαίνει το προεπιλεγμένο μπλε', !c.includes(DEFAULT_ACCENT.toLowerCase()));
  ok('η βαριά γραμμή μένει μελάνι', c.includes(INK.toLowerCase()));
}
{
  const off: ReportBranding = { ...brand, enabled: false };
  const c = colours(buildDocDefinition(base(off)));
  ok('σβηστή επωνυμία → το χρώμα ΔΕΝ μπαίνει', !c.includes('#8b1e3f'));
}

console.log(fail === 0 ? `✓ pdfReport: ${pass} έλεγχοι πέρασαν` : `✗ pdfReport: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
