'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό της σύγκρισης ρεύματος.
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { POWER_EN } from '@/lib/i18n/en/tools/power';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { power: { E: POWER_EN } };

export default function PowerEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
