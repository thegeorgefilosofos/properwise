'use client';
// Το μόνο component πελάτη που εισάγει το αγγλικό λεξικό της εισόδου. Το βάζουν
// τα layouts του /en/login, /en/signup και /en/reset-password· βλ. lib/i18n/authEn.ts.
import type { ReactNode } from 'react';
import { AUTH_EN, authFailedEn } from '@/lib/i18n/en/auth';
import { PLAN_COPY_EN } from '@/lib/i18n/en/plans';
import { AuthEnContext, type AuthEn } from '@/lib/i18n/authEn';

const VALUE: AuthEn = { ...AUTH_EN, failed: authFailedEn, plans: PLAN_COPY_EN };

export default function AuthEnProvider({ children }: { children: ReactNode }) {
  return <AuthEnContext.Provider value={VALUE}>{children}</AuthEnContext.Provider>;
}
