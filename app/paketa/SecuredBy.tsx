// ═══════════════════════════════════════════════════════════════════════════
// «ΠΛΗΡΩΜΕΣ ΜΕ ΑΣΦΑΛΕΙΑ ΜΕΣΩ …»: ΤΟ ΣΗΜΑ, ΧΩΡΙΣ ΤΗΝ ΠΗΓΗ ΤΟΥ ΚΕΙΜΕΝΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Καθαρή απόδοση, ώστε να το δείχνει και το ταμείο, που είναι στοιχείο
// πελάτη. Το κείμενο και ο σύνδεσμος έρχονται από τον διακομιστή
// (`billingWords().securedBy`, `merchant().site`)· το `billingWords` δεν
// μπαίνει στο πακέτο του περιηγητή.
//
// ΣΥΝΔΕΣΜΟΣ, ΟΠΩΣ ΤΟ ΣΗΜΑ ΤΟΥ ΕΜΠΟΡΟΥ (28.09.2026). Ο έμπορος δίνει έτοιμο HTML
// με σύνδεσμο προς τον ιστότοπό του. Κρατάμε τον σύνδεσμο (ο επισκέπτης βλέπει
// ποιος χρεώνει, σε νέα καρτέλα) και όχι την εμφάνιση: εκείνη είναι ανοιχτό
// κουτί με σταθερά χρώματα που δεν ακολουθούν το σκούρο θέμα, στα αγγλικά. Η
// δική μας κρατά τα tokens, τη γλώσσα και το λουκέτο.
// ═══════════════════════════════════════════════════════════════════════════
import { LockKeyhole } from 'lucide-react';
import { T } from '@/components/tokens';

export function SecuredBy({ text, href }: { text: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="po-secured" style={{
      display: 'inline-flex', alignItems: 'center', gap: T.sp.sm,
      marginTop: T.sp.md, padding: `${T.sp.xs}px ${T.sp.md}px`,
      border: '1px solid var(--border-subtle)', borderRadius: T.radius.pill,
      fontSize: 13, lineHeight: 1.4, color: 'var(--text-secondary)', textDecoration: 'none',
    }}>
      <LockKeyhole size={14} strokeWidth={2} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span>{text}</span>
    </a>
  );
}
