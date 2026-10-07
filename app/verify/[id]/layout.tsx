// Σελίδα που ανοίγει με κρυπτογραφικό σύνδεσμο: εκτός ευρετηρίου, πάντα.
// Ο λόγος και η μία δήλωση ζουν στο lib/seo/noindex.ts.
import { noindexPage } from '@/lib/seo/noindex';

export const metadata = noindexPage('Επαλήθευση εγγράφου', 'Έλεγχος ότι ένα έγγραφο είναι καταχωρημένο στο μητρώο του PROPERWISE και δεν άλλαξε από την έκδοση.');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
