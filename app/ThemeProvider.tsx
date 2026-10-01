'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { THEME_COLOR } from '@/lib/core/themeColor';

type Mode  = 'dark' | 'light';

// ΤΟ `data-theme` (midnight / obsidian / violet) ΕΦΥΓΕ. Γραφόταν στο <html> σε
// κάθε φόρτωση και αποθηκευόταν στο pos_theme, αλλά κανένας κανόνας CSS δεν
// το διάβαζε: τρεις «παλέτες» που ήταν η ίδια παλέτα. Το θέμα είναι ένα
// (ναυτικό) σε δύο καταστάσεις και αυτό είναι όλο το context.
interface ThemeContextType {
  mode:  Mode;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark', toggleMode: () => {},
});

// Η αρχική τιμή διαβάζεται από το ΙΔΙΟ το DOM, που το έχει ήδη γράψει το script
// του app/layout.tsx πριν το πρώτο paint.
//
// ΓΙΑΤΙ ΟΧΙ useState('dark') ΚΑΙ ΑΝΑΓΝΩΣΗ ΣΕ useEffect, ΟΠΩΣ ΠΡΙΝ: το useEffect
// τρέχει ΜΕΤΑ το paint. Όποιος είχε διαλέξει φωτεινό έβλεπε τη σειρά
//   σωστό (από το script) → σκούρο (αρχική τιμή React) → φωτεινό (μετά το effect)
// δηλαδή ένα σκούρο αναβοσβήσιμο σε κάθε φόρτωση. Με lazy initializer η React
// ξεκινά ήδη συμφωνημένη με την οθόνη και δεν υπάρχει ενδιάμεση κατάσταση.
//
// Ο server δεν έχει DOM· εκεί επιστρέφει το προεπιλεγμένο σκούρο, που είναι και
// η βάση του :root στο globals.css, άρα το markup συμφωνεί με το πρώτο paint.
const readAttr = <V extends string>(attr: string, fallback: V, valid: readonly V[]): V => {
  if (typeof document === 'undefined') return fallback;
  const v = document.documentElement.getAttribute(attr) as V | null;
  return v && valid.includes(v) ? v : fallback;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode,  setMode]       = useState<Mode>(() =>
    readAttr('data-mode', 'dark', ['dark', 'light'] as const));

  useEffect(() => {
    document.documentElement.setAttribute('data-mode',  mode);
    // Η ΜΠΑΡΑ ΤΟΥ ΚΙΝΗΤΟΥ ΑΚΟΛΟΥΘΕΙ ΤΟ ΘΕΜΑ. Εμενε #070b12 και στο φωτεινό:
    // μαύρη λωρίδα πάνω από λευκή εφαρμογή. Το Next γράφει ένα meta από το
    // `viewport`· αν λείπει (σελίδα σφάλματος), το φτιάχνουμε.
    let bar = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!bar) { bar = document.createElement('meta'); bar.name = 'theme-color'; document.head.appendChild(bar); }
    bar.content = THEME_COLOR[mode];
    localStorage.setItem('pos_mode',  mode);
  }, [mode]);

  const toggleMode = () => setMode(m => m === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// ΣΗΜΕΙΩΣΗ: εδώ ζούσε και ένας ThemeSwitcher με τρεις χρωματικές παλέτες
// (midnight/obsidian/violet) κι ένα δεύτερο κουμπί εναλλαγής. Δεν τον απέδιδε
// καμία οθόνη και καμία από τις τρεις παλέτες δεν είχε κανόνα CSS. Η εναλλαγή
// γίνεται από ΕΝΑ σημείο, τις Ρυθμίσεις, μέσω του ThemeToggle.
