'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό του υπολογιστή ΕΝΦΙΑ.
// Το βάζει το view.tsx του φακέλου· βλ. lib/i18n/toolEn.ts.
import type { ReactNode } from 'react';
import { ENFIA_EN, ENFIA_FLOOR_EN, ENFIA_FLOOR_SHORT_EN, enfiaAgeChoicesEn, smallSettlementReliefEn } from '@/lib/i18n/en/tools/enfia';
import { ToolEnContext, type ToolEn } from '@/lib/i18n/toolEn';

const VALUE: ToolEn = {
  enfia: { E: ENFIA_EN, floor: ENFIA_FLOOR_EN, floorShort: ENFIA_FLOOR_SHORT_EN, ageChoices: enfiaAgeChoicesEn, smallRelief: smallSettlementReliefEn },
};

export default function EnfiaEn({ children }: { children: ReactNode }) {
  return <ToolEnContext.Provider value={VALUE}>{children}</ToolEnContext.Provider>;
}
