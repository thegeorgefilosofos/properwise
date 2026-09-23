// Σελίδα που ανοίγει με κρυπτογραφικό σύνδεσμο: εκτός ευρετηρίου, πάντα.
// Ο λόγος και η μία δήλωση ζουν στο lib/seo/noindex.ts.
import { noindexPage } from '@/lib/seo/noindex';

export const metadata = noindexPage('Επιβεβαίωση διεύθυνσης', 'Επιβεβαίωση της διεύθυνσης για τις υπενθυμίσεις του PROPERWISE.');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
