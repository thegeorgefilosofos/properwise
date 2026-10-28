// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΠΕΔΙΑ ΤΩΝ ΕΞΟΔΩΝ ΑΓΟΡΑΣ, ΟΠΩΣ ΤΑΞΙΔΕΥΟΥΝ ΣΤΗ ΔΙΕΥΘΥΝΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Σε δικό τους αρχείο, ώστε να τα διαβάζουν και η σελίδα (για το λυμένο
// παράδειγμα) και ο υπολογιστής, χωρίς η σελίδα να φορτώνει τον πελάτη.
//
// Η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ ΠΑΡΑΔΕΙΓΜΑ ΚΑΙ ΤΟ ΛΕΕΙ. Τίμημα 200.000€ με δάνειο
// 150.000€: το ίδιο ποσό δανείου με την προεπιλογή του υπολογιστή στεγαστικού,
// ώστε ο σύνδεσμος από το ένα εργαλείο στο άλλο να συνεχίζει το ίδιο σενάριο.
// Κτηματολόγιο, μεσίτης, συμβολαιογράφος, δικηγόρος και λοιπά ξεκινούν από
// μηδέν: δεν έχουν
// επαληθευμένη επίσημη πηγή, οπότε ο υπολογιστής δεν γράφει δικό του ποσό.
// ═══════════════════════════════════════════════════════════════════════════
import { parseAmount } from '@/lib/core/greek';
import type { BuyKind, PurchaseInput } from '@/lib/tools/exodaAgoras';

export const SPEC = {
  timi: '200000', antikeimeniki: '', neodmito: 'oxi', anastoli: 'nai',
  proti: 'oxi', gamos: 'oxi', paidia: '0',
  ktimatologio: '0', mesitis: '0', symvolaiografos: '0', dikigoros: '0', alla: '0',
  daneio: '150000',
} as const;

export const PATH = '/exoda-agoras-akinitou';

const amount = (s: string): number => Math.max(0, parseAmount(s) ?? 0);

/**
 * Από τα πεδία της φόρμας στην είσοδο της μηχανής. Μία συνάρτηση για τη φόρμα
 * και για το λυμένο παράδειγμα της σελίδας: τα δύο δεν μπορούν να διαβάσουν
 * τα ίδια πεδία με άλλον τρόπο.
 */
export function purchaseInputOf(v: Readonly<Record<keyof typeof SPEC, string>>): PurchaseInput {
  const kind: BuyKind = v.neodmito !== 'nai' ? 'resale' : v.anastoli === 'oxi' ? 'newVat' : 'newSuspended';
  return {
    price: amount(v.timi), objective: amount(v.antikeimeniki), kind,
    firstHome: v.proti === 'nai', married: v.gamos === 'nai', children: Math.floor(amount(v.paidia)),
    cadastre: amount(v.ktimatologio), agentPct: amount(v.mesitis), notaryNet: amount(v.symvolaiografos), lawyerNet: amount(v.dikigoros),
    other: amount(v.alla), loan: amount(v.daneio),
  };
}
