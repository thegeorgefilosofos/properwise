'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό του φόρου ενοικίων.
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { RENT_EN, filingNoteEn, rateScaleEn } from '@/lib/i18n/en/tools/rent';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { rent: { E: RENT_EN, filingNote: filingNoteEn, rateScale: rateScaleEn } };

export default function RentEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
