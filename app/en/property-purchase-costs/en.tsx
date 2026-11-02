'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό των εξόδων αγοράς.
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { BUY_EN, ledgerRowsEn, missingSentenceEn } from '@/lib/i18n/en/tools/buy';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { buy: { E: BUY_EN, ledgerRows: ledgerRowsEn, missing: missingSentenceEn } };

export default function BuyEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
