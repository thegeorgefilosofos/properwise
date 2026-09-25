// Ενδιάμεσος σταθμός προς τον έμπορο, με πακέτο και κύκλο στη διεύθυνση:
// τίποτα να ευρετηριαστεί. Ο λόγος και η μία δήλωση ζουν στο lib/seo/noindex.
import { noindexPage } from '@/lib/seo/noindex';

// Με σκέτο NOINDEX η καρτέλα έγραφε μόνο «PROPERWISE», χωρίς να λέει πού είσαι.
export const metadata = noindexPage('Ταμείο', 'Ενεργοποίηση συνδρομής στο PROPERWISE.');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
