import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { noindexPage } from '@/lib/seo/noindex';
import { T } from '@/components/tokens';
import { AUTH_EN, ASIDE_EN } from '@/lib/i18n/en/auth';
import AuthAside from '../../AuthAside';

// Η επαναφορά κωδικού στα αγγλικά: ίδια οθόνη, ίδιο noindex με το ελληνικό.
export const metadata: Metadata = noindexPage(AUTH_EN.reset.metaTitle, AUTH_EN.reset.metaDescription);

export default function ResetLayoutEn({ children }: { children: ReactNode }) {
  const a = ASIDE_EN.reset;
  return (
    <div data-mode="dark" className="auth-split" style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', fontFamily: T.font.sans }}>
      <a href="#main" className="skip-link">{ASIDE_EN.skip}</a>
      <AuthAside headline={a.headline} accent={a.accent} sub={a.sub} pillars={a.pillars} foot={ASIDE_EN.foot} />
      {children}
    </div>
  );
}
