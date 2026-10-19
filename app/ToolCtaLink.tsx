'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΣΥΝΔΕΣΜΟΣ ΤΟΥ «ΞΕΚΙΝΑ» ΜΕ Ο,ΤΙ ΕΓΡΑΨΕ Ο ΕΠΙΣΚΕΠΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Το `ToolCta` αποδίδεται στη σελίδα (app/PublicChrome.tsx), ενώ τα πεδία του
// υπολογιστή ζουν στον πελάτη. Ο σύνδεσμος λοιπόν διαβάζει τη διεύθυνσή του από
// τον υπολογιστή που τον περιέχει όταν εκείνος τη δίνει (`ToolCtaHref`)· αλλιώς
// κρατά τη σταθερή της σελίδας. Ετσι οι υπόλοιποι υπολογιστές μένουν
// όπως ήταν και ο ΕΝΦΙΑ περνά τα πεδία του στην εγγραφή (lib/tools/enfiaCarry.ts).
// ═══════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';

/** Η διεύθυνση που δίνει ο υπολογιστής στο «Ξεκίνα» του· `null` = η σταθερή. */
export const ToolCtaHref = createContext<string | null>(null);

export function ToolCtaLink({ href, className, style, children }: {
  href: string; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  const live = useContext(ToolCtaHref);
  return <Link href={live ?? href} className={className} style={style}>{children}</Link>;
}
