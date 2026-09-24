// Η σελίδα είναι `'use client'` και δεν μπορεί να δηλώσει μεταδεδομένα· το
// layout του διακομιστή τα δίνει. Εκτός ευρετηρίου: είναι φόρμα, όχι περιεχόμενο.
import { noindexPage } from '@/lib/seo/noindex';

export const metadata = noindexPage('Επαναφορά κωδικού', 'Όρισε νέο κωδικό για τον λογαριασμό σου στο PROPERWISE.');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
