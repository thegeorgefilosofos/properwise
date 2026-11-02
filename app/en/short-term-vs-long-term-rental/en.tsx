'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό του «βραχυχρόνια ή μακροχρόνια».
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { SHORT_EN } from '@/lib/i18n/en/tools/short';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { short: { E: SHORT_EN } };

export default function ShortEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
