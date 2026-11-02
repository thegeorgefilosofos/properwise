'use client';
// Το μόνο component πελάτη που εισάγει τα αγγλικά της φόρμας υπαναχώρησης.
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { WITHDRAWAL_EN } from '@/lib/i18n/en/legal/withdrawal';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { withdrawal: { E: WITHDRAWAL_EN } };

export default function WithdrawalEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
