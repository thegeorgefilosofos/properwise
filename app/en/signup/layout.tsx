import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { siteUrl } from '@/lib/core/site';
import { PLAN_ORDER } from '@/lib/billing/plans';
import { TRIAL_PLAN } from '@/lib/billing/entitlements';
import { signupCtaEn } from '@/lib/billing/trialOffer';
import { billingWordsEn } from '@/lib/legal/billingWords';
import { T } from '@/components/tokens';
import { AUTH_EN, ASIDE_EN } from '@/lib/i18n/en/auth';
import { PLAN_COPY_EN } from '@/lib/i18n/en/plans';
import { publicMetadata } from '../../publicMetadata';
import { PlanTermsProvider, type SignupCtas } from '../../signup/PlanTerms';
import AuthAside from '../../AuthAside';

// Η εγγραφή στα αγγλικά: η ίδια οθόνη (app/signup/page.tsx) με τα αγγλικά
// λόγια χρέωσης (billingWordsEn) και τα αγγλικά κουμπιά. Και μία ήσυχη γραμμή:
// η εφαρμογή μετά την εγγραφή είναι ελληνική.
export function generateMetadata(): Metadata {
  return publicMetadata({
    title: AUTH_EN.signup.metaTitle,
    description: AUTH_EN.signup.metaDescription(PLAN_COPY_EN.free.name, PLAN_COPY_EN[TRIAL_PLAN].name),
    url: siteUrl('/en/signup'),
  });
}

const ctas = Object.fromEntries([
  ['none', signupCtaEn(null)],
  ...PLAN_ORDER.map(id => [id, signupCtaEn(id)]),
]) as SignupCtas;

export default function SignupLayoutEn({ children }: { children: ReactNode }) {
  const words = billingWordsEn();
  const a = ASIDE_EN.signup;
  return (
    <PlanTermsProvider value={{ planTerms: words.signupPlanTerms, trialBadge: words.trialBadge, ctas }}>
      <div data-mode="dark" className="auth-split auth-top" style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', fontFamily: T.font.sans }}>
        <a href="#main" className="skip-link">{ASIDE_EN.skip}</a>
        <AuthAside headline={a.headline} accent={a.accent} oneLine sub={a.sub} pillars={ASIDE_EN.login.pillars()} foot={ASIDE_EN.foot} />
        {children}
      </div>
    </PlanTermsProvider>
  );
}
