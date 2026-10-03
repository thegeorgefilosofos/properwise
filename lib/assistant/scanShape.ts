// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΣΧΗΜΑ ΜΙΑΣ ΣΑΡΩΣΗΣ (02.10.2026)
// ─────────────────────────────────────────────────────────────────────────
// Η σάρωση μετριέται στον δικό της μετρητή, που στα πληρωμένα πακέτα και στη
// δοκιμή δεν έχει μηνιαίο όριο. Το `/api/anthropic` την αναγνώριζε από το
// `kind: 'scan'` και ένα οποιοδήποτε αρχείο μέσα στα μηνύματα. Προωθούσε
// αυτούσια ό,τι άλλο έστελνε ο πελάτης: σαράντα μηνύματα, κείμενο εκατοντάδων
// χιλιάδων λέξεων, δικό του system prompt. Δηλαδή μια μικρή εικόνα άνοιγε
// απεριόριστη συνομιλία με το κλειδί μας, έξω από τα όρια της Νόας.
//
// Η εφαρμογή στέλνει σε κάθε σάρωση ΕΝΑ μήνυμα χρήστη με ένα αρχείο και μία
// σύντομη οδηγία (scanDoc.ts, TabContacts.tsx, LoanDocScan.tsx, ItemFormModal.tsx,
// useAssistantChat.ts, TabTenantMoney.tsx). Ό,τι ξεφεύγει από αυτό το σχήμα
// δεν είναι σάρωση και απορρίπτεται.
// ═══════════════════════════════════════════════════════════════════════════

/** Τα όρια, με περιθώριο πάνω από ό,τι στέλνει σήμερα η εφαρμογή. */
export const SCAN_SHAPE = {
  maxFiles: 2,
  maxTextChars: 2000,
  maxSystemChars: 10000,
  maxTokens: 1500,
} as const;

type Block = { type?: unknown; text?: unknown };

function systemChars(system: unknown): number {
  if (system == null) return 0;
  if (typeof system === 'string') return system.length;
  if (Array.isArray(system)) {
    return system.reduce((n, b) => n + (typeof (b as Block)?.text === 'string' ? ((b as Block).text as string).length : 0), 0);
  }
  return Infinity;
}

/**
 * Κενό αν το αίτημα έχει το σχήμα μιας σάρωσης της εφαρμογής, αλλιώς ο λόγος
 * της άρνησης (για το αρχείο καταγραφής, όχι για τον χρήστη).
 */
export function scanShapeError(body: { messages?: unknown; system?: unknown }): string {
  const msgs = body?.messages;
  if (!Array.isArray(msgs) || msgs.length !== 1) return 'messages';
  const m = msgs[0] as { role?: unknown; content?: unknown };
  if (m?.role !== 'user' || !Array.isArray(m.content)) return 'role';
  let files = 0, text = 0;
  for (const c of m.content as Block[]) {
    if (c?.type === 'image' || c?.type === 'document') files++;
    else if (c?.type === 'text' && typeof c.text === 'string') text += c.text.length;
    else return 'block';
  }
  if (files < 1 || files > SCAN_SHAPE.maxFiles) return 'files';
  if (text > SCAN_SHAPE.maxTextChars) return 'text';
  if (systemChars(body.system) > SCAN_SHAPE.maxSystemChars) return 'system';
  return '';
}
