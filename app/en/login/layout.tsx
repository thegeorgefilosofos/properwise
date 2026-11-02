import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { siteUrl } from '@/lib/core/site';
import { T } from '@/components/tokens';
import { AUTH_EN, ASIDE_EN } from '@/lib/i18n/en/auth';
import { publicMetadata } from '../../publicMetadata';
import AuthAside from '../../AuthAside';

// Η είσοδος στα αγγλικά: ίδια οθόνη (app/login/page.tsx), ίδιο noindex.
export const metadata: Metadata = {
  ...publicMetadata({ title: AUTH_EN.login.metaTitle, description: AUTH_EN.login.metaDescription, url: siteUrl('/en/login') }),
  robots: { index: false, follow: true },
};

export default function LoginLayoutEn({ children }: { children: ReactNode }) {
  const a = ASIDE_EN.login;
  return (
    <div data-mode="dark" className="auth-split" style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', fontFamily: T.font.sans }}>
      <a href="#main" className="skip-link">{ASIDE_EN.skip}</a>
      <AuthAside headline={a.headline} accent={a.accent} sub={a.sub} pillars={a.pillars()} foot={ASIDE_EN.foot} />
      {children}
    </div>
  );
}
