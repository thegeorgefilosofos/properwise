// Βλ. app/signup/layout.tsx για τον λόγο: η σελίδα σύνδεσης είναι component
// πελάτη και δεν μπορεί να εξάγει μεταδεδομένα η ίδια.
//
// Η ΣΥΝΔΕΣΗ ΔΕΝ ΕΥΡΕΤΗΡΙΑΖΕΤΑΙ. Είναι στον χάρτη με προτεραιότητα 0,5 επειδή
// υπάρχει, όχι επειδή θέλουμε να τη βρίσκει κανείς από αναζήτηση: όποιος
// ψάχνει «PROPERWISE» πρέπει να φτάνει στην αρχική, όχι σε φόρμα εισόδου.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { siteUrl } from '@/lib/core/site';
import { publicMetadata } from '../publicMetadata';

// Δικό της og:url, όπως η εγγραφή: αλλιώς ένας σύνδεσμος σύνδεσης που
// κοινοποιείται δείχνει και ανοίγει την αρχική.
export const metadata: Metadata = {
  ...publicMetadata({
    title: 'Σύνδεση · PROPERWISE',
    description: 'Σύνδεση στον λογαριασμό σου στο PROPERWISE, με email ή με Google.',
    url: siteUrl('/login'),
  }),
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
