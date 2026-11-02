import Link from 'next/link';
import { noindexPage } from '@/lib/seo/noindex';
import { createClient } from '@/lib/supabase/server';
import * as billing from '@/lib/data/billing';
import { normalizePlan } from '@/lib/billing/plans';
import { billingWordsEn } from '@/lib/legal/billingWords';
import { IDENTITY } from '@/lib/legal/identity';
import { PLAN_COPY_EN } from '@/lib/i18n/en/plans';
import { WITHDRAWAL_EN, WITHDRAWAL_PAGE_EN as D } from '@/lib/i18n/en/legal/withdrawal';
import { LegalLayout, MailLink, type LegalBlock } from '../../legal-shell';
import { LINK_STYLE } from '../../linkStyle';
import { TranslationNotice } from '../../TranslationNotice';
import WithdrawalForm from '../../ypanaxorisi/WithdrawalForm';
import WithdrawalEn from './en';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΥΠΑΝΑΧΩΡΗΣΗ ΣΤΑ ΑΓΓΛΙΚΑ (/en/withdrawal, ζεύγος του /ypanaxorisi)
// ─────────────────────────────────────────────────────────────────────────
// Η ίδια φόρμα και η ίδια διαδρομή υποβολής (/api/withdrawal) με την ελληνική·
// η δήλωση καταγράφεται ίδια και το αποδεικτικό φεύγει στα ελληνικά. Πιστή
// μετάφραση, με τη σημείωση ότι δεσμευτικό είναι το ελληνικό κείμενο.
// noindex όπως η ελληνική: είναι λειτουργία, όχι απάντηση σε αναζήτηση.
// ═══════════════════════════════════════════════════════════════════════════
export const metadata = noindexPage(D.metaTitle, D.description);

/** Η σύμβαση του λογαριασμού σε μία φράση, όπως το `contractOf` της ελληνικής. */
function contractOf(plan: string | null | undefined, cycle: string | null | undefined): string {
  const id = normalizePlan(plan || 'free');
  if (id === 'free') return `${IDENTITY.tradeName} account, “${PLAN_COPY_EN.free.name}” plan with no subscription`;
  return `${IDENTITY.tradeName} “${PLAN_COPY_EN[id].name}” subscription, ${cycle === 'annual' ? 'annual' : 'monthly'}`;
}

export default async function WithdrawalPageEn() {
  const words = billingWordsEn();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let prefill = { name: '', email: '', contract: '' };
  if (user) {
    const p = await billing.profile<{ full_name: string | null; plan: string | null; billing_cycle: string | null }>(
      supabase, user.id, 'full_name, plan, billing_cycle');
    const meta = (user.user_metadata as Record<string, string> | undefined) || {};
    prefill = { name: (p?.full_name || meta.full_name || '').trim(), email: user.email || '', contract: contractOf(p?.plan, p?.billing_cycle) };
  }

  const blocks: LegalBlock[] = [
    {
      id: 'declaration',
      h: D.declaration,
      body: (
        <>
          <p className="lg-p">{D.declarationLead(WITHDRAWAL_EN.confirm)}</p>
          <WithdrawalEn><WithdrawalForm signedIn={!!user} prefill={prefill} /></WithdrawalEn>
        </>
      ),
    },
    {
      h: D.after,
      body: (
        <ul className="lg-ul">
          {D.afterItems.map(t => <li key={t}>{t}</li>)}
          <li>{words.withdrawalTo ? D.forwardSeller : D.forwardIfPaid}</li>
        </ul>
      ),
    },
    {
      h: D.deadline,
      body: (
        <>
          <p className="lg-p">{D.deadlineText}</p>
          <p className="lg-p">{words.withdrawal}</p>
          <p className="lg-p">{D.late}</p>
        </>
      ),
    },
    {
      h: D.other,
      body: (
        <p className="lg-p">
          {D.otherMail}<MailLink to={IDENTITY.supportEmail} />.{words.withdrawalVia ? ` ${words.withdrawalVia}` : ''}{' '}
          {D.otherForm}<Link href="/en/terms#ypanachorisi" className="lp-link" style={LINK_STYLE}>{D.terms}</Link>.
        </p>
      ),
    },
  ];

  return (
    <LegalLayout
      locale="en"
      self="/en/withdrawal"
      notice={<TranslationNotice greekHref="/ypanaxorisi" />}
      eyebrow="Legal"
      title={D.title}
      intro={D.intro(IDENTITY.tradeName)}
      blocks={blocks}
    />
  );
}
