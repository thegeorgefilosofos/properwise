'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό του οδηγού Ε2.
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { E2_EN } from '@/lib/i18n/en/tools/e2';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = { e2: { E: E2_EN } };

export default function E2En({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
