'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό της καθαρής απόδοσης.
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { YIELD_EN } from '@/lib/i18n/en/tools/yield';
import { rateScaleEn } from '@/lib/i18n/en/tools/rent';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { yield: { E: YIELD_EN, rateScale: rateScaleEn } };

export default function YieldEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
