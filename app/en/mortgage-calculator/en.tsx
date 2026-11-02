'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό του στεγαστικού δανείου.
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { MORTGAGE_EN } from '@/lib/i18n/en/tools/mortgage';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { mortgage: { E: MORTGAGE_EN } };

export default function MortgageEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
