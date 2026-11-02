'use client';
// Το μόνο component πελάτη που εισάγει τα αγγλικά του υπολογιστή της αρχικής.
// Το βάζει το app/en/view.tsx· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { PARTS_EN } from '@/lib/i18n/en/landingParts';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { landing: { C: PARTS_EN.calc } };

export default function LandingEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
