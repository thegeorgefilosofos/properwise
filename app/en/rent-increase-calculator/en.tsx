'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό της αναπροσαρμογής.
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { RAISE_EN } from '@/lib/i18n/en/tools/raise';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { raise: { E: RAISE_EN } };

export default function RaiseEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
