'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό της έκπτωσης ανακαίνισης.
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { RENO_EN } from '@/lib/i18n/en/tools/reno';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { reno: { E: RENO_EN } };

export default function RenoEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
