// Ο πίνακας του λογαριασμού είναι `'use client'` και δεν μπορεί να δηλώσει
// μεταδεδομένα· το layout του διακομιστή τα δίνει. Χωρίς αυτό η σελίδα
// κληρονομούσε από τη ρίζα ευρετηρίαση και `canonical: "/"`. Ο λόγος και η μία
// δήλωση ζουν στο lib/seo/noindex.ts. Χωρίς τίτλο, επίτηδες: η καρτέλα μένει
// όπως ήταν.
export { NOINDEX as metadata } from '@/lib/seo/noindex';

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
