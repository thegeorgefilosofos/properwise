// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΑΡΤΕΛΑ ΕΙΝΑΙ ΤΟΠΟΘΕΣΙΑ, ΟΧΙ ΚΑΤΑΣΤΑΣΗ.
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΡΟΒΛΗΜΑ
//
// Ο πίνακας κρατούσε την ενεργή καρτέλα σε `useState`. Ό,τι κι αν πατούσε ο
// χρήστης —Δαπάνες, Δάνειο, Ημερολόγιο, δέκα καρτέλες βαθιά— η διεύθυνση έμενε
// `/dashboard`. Συνέπειες, όλες καθημερινές:
//
//   · Το «πίσω» του περιηγητή ΔΕΝ γύριζε καρτέλα· έβγαζε από την εφαρμογή.
//     Στο κινητό, όπου το «πίσω» είναι χειρονομία και όχι κουμπί, αυτό σημαίνει
//     ότι η πιο φυσική κίνηση του χρήστη τον πετούσε έξω.
//   · Ανανέωση σελίδας γύριζε πάντα στην Επισκόπηση, χάνοντας τη θέση του.
//   · Δεν μπορούσε να στείλει σύνδεσμο «δες εδώ», ούτε να κρατήσει σελιδοδείκτη.
//
// Η ΛΥΣΗ ΚΑΙ ΓΙΑΤΙ ΜΕ HASH
//
// Το κομμάτι μετά το `#` δεν φτάνει ποτέ στον server: η αλλαγή καρτέλας δεν
// προκαλεί αίτημα, δεν ξαναφορτώνει δεδομένα και δεν χρειάζεται νέο route. Ο
// πίνακας είναι ΜΙΑ σελίδα με πολλά πάνελ — αυτό ακριβώς περιγράφει το hash.
// Με route ανά καρτέλα θα έπρεπε να ξαναστηθεί όλη η φόρτωση του ακινήτου σε
// κάθε κλικ, για μηδενικό όφελος.
//
// Το ακίνητο μπαίνει κι αυτό, γιατί «Δαπάνες» χωρίς «ποιου ακινήτου» δεν είναι
// τοποθεσία: `#finances/8f3a…`.
// ═══════════════════════════════════════════════════════════════════════════

import { readEnfiaCarry, ENFIA_ACTION, ENFIA_KEYS, type EnfiaCarry } from '@/lib/tools/enfiaCarry';

export interface NavLocation {
  tab: string;
  /** `null` όταν ο σύνδεσμος δεν ορίζει ακίνητο (μένει το τρέχον). */
  propertyId: string | null;
}

/** Επιτρεπτά αναγνωριστικά: γράμματα, αριθμοί, παύλα, κάτω παύλα. */
const SAFE = /^[a-zA-Z0-9_-]+$/;

/**
 * Διαβάζει `#tab/propertyId`. Ό,τι δεν αναγνωρίζεται δίνει το `fallback` — ποτέ
 * σφάλμα: το hash το γράφει ο χρήστης στη γραμμή διευθύνσεων και μπορεί να
 * περιέχει οτιδήποτε.
 */
export function parseNavHash(hash: string | null | undefined, fallback: string): NavLocation {
  // ΠΡΩΤΑ ΤΑ ΚΕΝΑ, ΜΕΤΑ Η ΔΙΕΣΗ. Ανάποδα, το «  #tenant» δεν ταίριαζε στο
  // `^#` και έφτανε στον έλεγχο ως «#tenant» — με τη δίεση μέσα, άρα άκυρο,
  // άρα ο χρήστης έπεφτε στην Επισκόπηση από έναν σύνδεσμο που ήταν σωστός.
  const raw = (hash || '').trim().replace(/^#/, '').trim();
  if (!raw) return { tab: fallback, propertyId: null };
  const [tabRaw, propRaw] = raw.split('/');
  const tab = SAFE.test(tabRaw || '') ? tabRaw : fallback;
  const propertyId = propRaw && SAFE.test(propRaw) ? propRaw : null;
  return { tab, propertyId };
}

/**
 * Γράφει το hash. Χωρίς ακίνητο γράφει μόνο την καρτέλα, ώστε ο σύνδεσμος να
 * μένει σύντομος όταν δεν χρειάζεται περισσότερα.
 */
export function formatNavHash(loc: NavLocation): string {
  const tab = SAFE.test(loc.tab) ? loc.tab : '';
  if (!tab) return '';
  return loc.propertyId && SAFE.test(loc.propertyId) ? `#${tab}/${loc.propertyId}` : `#${tab}`;
}

/**
 * Πρέπει να γραφτεί νέα εγγραφή στο ιστορικό;
 *
 * ΟΧΙ ΟΤΑΝ ΤΙΠΟΤΑ ΔΕΝ ΑΛΛΑΞΕ. Χωρίς αυτόν τον έλεγχο, κάθε render που καλεί
 * `setNav` με την ΙΔΙΑ τιμή —και υπάρχουν τέτοια, π.χ. `setNav('overview')`
 * μετά από διαγραφή ακινήτου— θα πρόσθετε εγγραφή. Ο χρήστης θα έπρεπε να
 * πατήσει «πίσω» πέντε φορές για να φύγει από μία οθόνη.
 */
export function shouldPush(from: NavLocation, to: NavLocation): boolean {
  return formatNavHash(from) !== formatNavHash(to);
}

/** Τι ζήτησε η διεύθυνση εκκίνησης, αφού μεταφραστεί σε γλώσσα του πίνακα. */
export interface LaunchShortcut {
  /** Το hash που πρέπει να ισχύσει, ή `null` όταν το ερώτημα δεν όριζε καρτέλα. */
  hash: string | null;
  /** Ζητήθηκε η γρήγορη προσθήκη με σάρωση. */
  scan: boolean;
  /**
   * Η εκτίμηση του δημόσιου υπολογιστή ΕΝΦΙΑ (`?action=enfia&…`), ελεγμένη
   * απέναντι στο SPEC του (lib/tools/enfiaCarry.ts)· `null` όταν δεν ζητήθηκε
   * ή όταν κάποια τιμή δεν περνά τον έλεγχο.
   */
  enfia: EnfiaCarry | null;
  /** Το ερώτημα που ΜΕΝΕΙ, με τα καταναλωμένα κλειδιά αφαιρεμένα. */
  search: string;
  /** Καταναλώθηκε κάτι· αλλιώς η διεύθυνση δεν αγγίζεται καθόλου. */
  consumed: boolean;
}

/**
 * Μεταφράζει τις συντομεύσεις του εικονιδίου (`?tab=`, `?action=`) σε hash και
 * σε σημαία σάρωσης.
 *
 * ΓΙΑΤΙ ΜΕΤΑΦΡΑΣΗ ΚΑΙ ΟΧΙ ΑΝΑΓΝΩΣΗ ΕΠΙ ΤΟΠΟΥ. Η καρτέλα ζει στο hash· αν το
 * `?tab=` έμενε ως έχει, θα υπήρχαν δύο διευθύνσεις για την ίδια οθόνη και το
 * «πίσω» θα κολλούσε στη συντόμευση σε κάθε ανανέωση.
 *
 * ΤΑ ΑΛΛΑ ΚΛΕΙΔΙΑ ΤΟΥ ΕΡΩΤΗΜΑΤΟΣ ΕΠΙΖΟΥΝ. Το να σβηστεί ολόκληρο το ερώτημα
 * θα έπαιρνε μαζί και ό,τι δεν μας αφορά, π.χ. σήμανση καμπάνιας.
 */
export function readLaunchShortcut(
  search: string,
  hash: string,
  known: readonly string[],
): LaunchShortcut {
  const q = new URLSearchParams(search || '');
  const tab = q.get('tab');
  const action = q.get('action');
  const consumed = tab !== null || action !== null;
  // Η ΕΚΤΙΜΗΣΗ ΕΝΦΙΑ ΔΙΑΒΑΖΕΤΑΙ ΠΡΙΝ ΣΒΗΣΤΟΥΝ ΤΑ ΚΛΕΙΔΙΑ ΤΗΣ. Μόνο τα κλειδιά
  // του SPEC και μόνο με το `action=enfia`: χωρίς αυτό, ένα «tm» άλλου νοήματος
  // στη διεύθυνση μένει όπως ήταν.
  const enfia = action === ENFIA_ACTION ? readEnfiaCarry(q) : null;
  if (action === ENFIA_ACTION) for (const k of ENFIA_KEYS) q.delete(k);
  q.delete('tab');
  q.delete('action');
  const rest = q.toString();
  // Μόνο γνωστές καρτέλες. Η διεύθυνση γράφεται και με το χέρι.
  const next = tab && known.includes(tab)
    ? formatNavHash({ tab, propertyId: parseNavHash(hash, '').propertyId })
    : '';
  return { hash: next || null, scan: action === 'scan', enfia, search: rest ? `?${rest}` : '', consumed };
}

// ═══ ΤΟ «ΠΙΣΩ» ΓΥΡΝΑ ΑΠΟ ΟΠΟΥ ΗΡΘΕΣ (feedback χρήστη #1, 23/11/2026) ════════
//
// Το κουμπί «‹ Επισκόπηση» στεκόταν πάνω από τον τίτλο κάθε καρτέλας, ενώ η
// πλαϊνή μπάρα έδειχνε ήδη τον ίδιο δρόμο. Και εκεί όπου χρειαζόταν, έκανε
// λάθος: Ημερολόγιο → «Εκκρεμότητες» → «Πίσω» έβγαζε στην Επισκόπηση, ενώ το
// πλήκτρο του περιηγητή γύριζε στο Ημερολόγιο. Δύο «πίσω» με δύο προορισμούς.
//
// Τώρα το κουμπί μένει μόνο στις οθόνες που ΔΕΝ έχουν γραμμή στην πλαϊνή μπάρα
// (SUB_SCREEN_PARENT) και γυρνά εκεί που γυρνά και ο περιηγητής: στην καρτέλα
// της προηγούμενης εγγραφής. Ο γονέας μένει μόνο για την ψυχρή είσοδο (σύνδεσμος,
// ανανέωση χωρίς ιστορικό), όπου δεν υπάρχει προηγούμενη οθόνη της εφαρμογής.

/** Οθόνες χωρίς γραμμή στην πλαϊνή μπάρα και η οθόνη από την οποία ανοίγουν. */
export const SUB_SCREEN_PARENT: Readonly<Record<string, string>> = {
  checklist: 'overview',
  inventory: 'documents',
};

/** Το κλειδί που γράφει ο πίνακας στην κατάσταση κάθε εγγραφής ιστορικού. */
const FROM = 'pwNavFrom';

/** Η κατάσταση της εγγραφής που γράφει το `setNav`: από ποια καρτέλα ήρθε. */
export function navState(fromTab: string): Record<string, string> {
  return { [FROM]: fromTab };
}

export interface BackTarget {
  tab: string;
  /** `true`: η προηγούμενη εγγραφή είναι αυτή η καρτέλα, άρα `history.back()`. */
  history: boolean;
}

/**
 * Πού πάει το «πίσω» της οθόνης `tab`, με την κατάσταση της τρέχουσας εγγραφής
 * (`history.state`). `null`: η οθόνη έχει γραμμή στην πλαϊνή μπάρα, άρα κουμπί
 * δεν χρειάζεται.
 */
export function backTarget(tab: string, state: unknown): BackTarget | null {
  const parent = SUB_SCREEN_PARENT[tab];
  if (!parent) return null;
  const from = state && typeof state === 'object' ? (state as Record<string, unknown>)[FROM] : undefined;
  if (typeof from === 'string' && SAFE.test(from) && from !== tab) return { tab: from, history: true };
  return { tab: parent, history: false };
}
