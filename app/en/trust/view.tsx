import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { IDENTITY, POLICY_VERSION } from '@/lib/legal/identity';
import { DISCLOSURE } from '@/lib/legal/disclosure';
import { subprocessors, ANTHROPIC_CONTRACT, BACKUP_RETENTION_DAYS } from '@/lib/legal/subprocessors';
import { billingWordsEn } from '@/lib/legal/billingWords';
import { siteUrl, SITE, ORG_ID, SOCIAL_PROFILES } from '@/lib/core/site';
import { breadcrumbJsonLd, HOME_CRUMB_EN } from '@/lib/seo/breadcrumbs';
import { subprocessorRowEn, TRANSFER_SAFEGUARDS_EN, identityPendingEn } from '@/lib/i18n/en/legal/common';
import { LEGAL_UI_EN, monthYearEn } from '@/lib/i18n/en/legal/ui';
import { ASSISTANT_NAME_EN } from '@/lib/i18n/en/noa';
import { LegalLayout, MailLink, type LegalBlock } from '../../legal-shell';
import { JsonLd } from '../../PublicChrome';
import { LINK_STYLE } from '../../linkStyle';
import { shareImage } from '../../og/share';
import { publicMetadata } from '../../publicMetadata';

// ═══════════════════════════════════════════════════════════════════════════
// «ΠΟΙΟΙ ΕΙΜΑΣΤΕ» ΣΤΑ ΑΓΓΛΙΚΑ (/en/trust, ζεύγος του /trust)
// ─────────────────────────────────────────────────────────────────────────
// Ιδιο κέλυφος (LegalLayout με locale), ίδιες ενότητες, ίδιες πηγές: η
// ταυτότητα από το lib/legal/identity.ts, οι πάροχοι από το μητρώο με την
// αγγλική τους διατύπωση (lib/i18n/en/legal/common.ts), η χρέωση από το
// billingWordsEn και οι προθεσμίες γνωστοποίησης από το DISCLOSURE.
// ═══════════════════════════════════════════════════════════════════════════
const PATH = '/en/trust';
const URL = siteUrl(PATH);
const TITLE = 'About us';
const DESC = 'Who we are, where your data is stored, who can see it and what we never do with it.';
const UPDATED = monthYearEn(POLICY_VERSION.slice(0, 7));

export const metadata: Metadata = publicMetadata({ title: `${TITLE} · PROPERWISE`, description: DESC, url: URL, image: shareImage('en-trust') });

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const P = { color: 'var(--text-primary)' } as const;
const STACK: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 };

function DataTable({ caption, rows }: { caption: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="po-table-box" style={{ marginTop: 14 }}>
      <table className="po-table lg-kv" style={{ '--tbl-fs': '14px' }}>
        <caption>{caption}</caption>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="po-kv-val" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {MAIL.test(r.value) ? <MailLink to={r.value} /> : r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Point({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }} aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
      <div style={{ maxWidth: '72ch' }}>
        <div className="lg-point-t" style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function Never({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }} aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      <div>{children}</div>
    </div>
  );
}

type Row = ReturnType<typeof subprocessorRowEn>;

function SubprocessorCard({ s }: { s: Row }) {
  return (
    <li className="lg-sp-card">
      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
      {s.entity && <div className="lg-sp-entity">{s.entity}</div>}
      <dl><dt>What it does</dt><dd>{s.what}</dd><dt>Where</dt><dd>{s.where}</dd></dl>
    </li>
  );
}

export default function TrustPageEn() {
  const words = billingWordsEn();
  const rows = subprocessors().map(subprocessorRowEn);
  const fields: { label: string; value: string | null }[] = [
    { label: IDENTITY.kind === 'natural' ? 'Full name' : 'Company name', value: IDENTITY.legalName },
    { label: 'Trade name', value: IDENTITY.tradeName },
    { label: IDENTITY.kind === 'natural' ? 'Address' : 'Registered office', value: IDENTITY.address },
    { label: 'Tax number (AFM)', value: IDENTITY.afm },
    { label: 'Tax office (DOY)', value: IDENTITY.doy },
    ...(IDENTITY.kind === 'company' || IDENTITY.gemi ? [{ label: 'Business registry (GEMI)', value: IDENTITY.gemi }] : []),
    { label: 'Phone', value: IDENTITY.phone },
    { label: 'Support', value: IDENTITY.supportEmail },
  ];
  const known = fields.filter(f => f.value && f.value.trim());
  const pending = fields.filter(f => !f.value || !f.value.trim());

  const blocks: LegalBlock[] = [
    {
      part: 'A. Who we are',
      h: 'Our details',
      body: (
        <>
          <DataTable caption="Operator details" rows={known.map(r => ({ label: r.label, value: r.value as string }))} />
          {pending.length > 0 && (
            <p className="lg-note">
              {identityPendingEn()} They will be added here once finalized. Until then, write to <MailLink to={IDENTITY.supportEmail} /> about anything.
            </p>
          )}
          {words.saleClosedReason && <p className="lg-note">{words.saleClosedReason}</p>}
        </>
      ),
    },
    {
      part: 'B. Where it goes, how it is protected, who touches it',
      h: 'Where your data is stored',
      body: (
        <>
          <p className="lg-p">
            The system of record (the database, sign-in credentials and the files you upload) sits on servers <strong>in the
            European Union, in Frankfurt</strong>. Traffic to and from the app is encrypted with TLS. Encryption at rest is provided by
            the hosting provider’s infrastructure (Supabase): we don’t control it and we don’t present it to you as our own guarantee.
          </p>
          <p className="lg-p">
            One exception to TLS, because you choose it: if you connect a booking calendar (iCal) that its provider serves over{' '}
            <code style={{ fontSize: 13 }}>http://</code>, syncing happens as that provider serves it, unencrypted. And not everything
            stays in the EU; we would rather you read it here than discover it:
          </p>
          <ul className="lg-ul">
            <li><strong>The backup key</strong> is kept on US infrastructure, in GitHub Secrets. The backup itself is encrypted with AES-256 and kept in a private Supabase storage space, in Frankfurt like the database, for {BACKUP_RETENTION_DAYS} days. It can’t be read without the key.</li>
            <li><strong>{`Your questions to ${ASSISTANT_NAME_EN}`}</strong>{`, together with a summary of your property, tenant, client and contact data (names and history, without phone numbers or tax numbers), and any document or photo you upload to be read (Anthropic: contract with ${ANTHROPIC_CONTRACT}, processing in the US).`}</li>
            <li><strong>The emails the service sends</strong> (reminders, notifications, monthly statements). They contain tenant names and amounts and pass through the sending provider (Resend, US).</li>
            <li><strong>The app itself</strong> is served from a global network (Vercel, US), so each of your requests passes through it on the way to the database.</li>
          </ul>
        </>
      ),
    },
    {
      h: 'How it is protected',
      body: (
        <div className="lg-stack" style={STACK}>
          <Point title="You see your own data, and only what you choose to share">
            Every row in the database is governed by access rules at the level of the database itself (Row Level Security), not only by
            the app. Even if someone sent a request by hand, the database would return only what belongs to them. Your data is
            accessible only to people you choose: your team members, if you work with a team, and anyone with a portal link you created.
          </Point>
          <Point title="Your documents in a private space, with one exception we tell you about">
            Leases, documents and receipts you upload sit in a private, isolated space per user. The exception: your avatar, logo and
            inventory photos are stored in a public space; only you can upload or delete them, but anyone with the link can view them
            without signing in. Don’t upload anything there you wouldn’t show.
          </Point>
          <Point title="Daily backup">
            The process runs every day and encrypts the backup with AES-256 before it is stored. It is designed to <strong style={P}>fail
            rather than upload an unencrypted file</strong>: an encrypted backup or none. A second automated check confirms every day
            that the backup really happened and really is encrypted, because a backup that stopped silently is as good as none.
          </Point>
          <Point title="Two-step verification">
            You can turn on two-step verification (TOTP) from your Account, with any authenticator app.
          </Point>
          <Point title="Security activity log">
            Actions that affect your account’s security (password change, turning two-step verification on or off, signing out of all
            devices, team membership changes) are logged and you can see them yourself in your Account.
          </Point>
        </div>
      ),
    },
    {
      h: 'Who else is involved',
      body: (
        <>
          <p className="lg-p">
            These providers process data with us. “Processors” act on our behalf; “independent controllers” decide for themselves about
            the data they receive. Each one’s role is set out in the <Link href="/en/privacy" className="lp-link" style={LINK_STYLE}>Privacy Policy</Link>.
          </p>
          <p className="lg-note">{TRANSFER_SAFEGUARDS_EN}</p>
          <p className="lg-p" style={{ marginTop: 12 }}>Before we add a new provider, we tell you by email.</p>
          <div className="po-table-box lg-sp-table" style={{ marginTop: 16 }}>
            <div className="po-scroll-x" style={{ overflowX: 'auto' }}>
              <table className="po-table tbl-fixed" style={{ '--tbl-fs': '14px', '--tbl-min': '660px' }}>
                <caption className="sr-only">Providers that process data</caption>
                <colgroup>
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '56%' }} />
                  <col style={{ width: '22%' }} />
                </colgroup>
                <thead><tr><th scope="col">Provider</th><th scope="col">What it does</th><th scope="col">Where</th></tr></thead>
                {[false, true].map(planned => (
                  <tbody key={String(planned)} className={planned ? 'lg-sp-planned' : undefined}>
                    {planned && rows.some(s => s.planned) && (
                      <tr className="lg-sp-group"><th scope="rowgroup" colSpan={3}>Planned, not active today</th></tr>
                    )}
                    {rows.filter(s => s.planned === planned).map(s => (
                      <tr key={s.name}>
                        <th scope="row">
                          <span className="lg-sp-name">{s.name}</span>
                          {s.entity && <span className="lg-sp-entity">{s.entity}</span>}
                        </th>
                        <td className="lg-cell-prose">{s.what}</td>
                        <td className="lg-place">{s.where}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
          <div className="lg-sp-cards">
            <ul className="lg-sp-list">{rows.filter(s => !s.planned).map(s => <SubprocessorCard key={s.name} s={s} />)}</ul>
            {rows.some(s => s.planned) && (
              <details className="lg-sp-more">
                <summary>{`Planned, not active today (${rows.filter(s => s.planned).length})`}</summary>
                <ul className="lg-sp-list">{rows.filter(s => s.planned).map(s => <SubprocessorCard key={s.name} s={s} />)}</ul>
              </details>
            )}
          </div>
        </>
      ),
    },
    {
      part: 'C. What we don’t do, what you can do, how to reach us',
      h: 'What we never do',
      body: (
        <div className="lg-stack" style={STACK}>
          <Never><strong style={P}>We don’t sell your data.</strong> We don’t rent it out or give it to advertising networks. {words.howWeArePaid}</Never>
          <Never><strong style={P}>We don’t store card details.</strong> {words.cardData}</Never>
          <Never><strong style={P}>We don’t open your files.</strong> There is no internal tool for browsing customer data. Access happens only at your own support request or where the law requires it.</Never>
          <Never><strong style={P}>{`We don’t send your whole database to ${ASSISTANT_NAME_EN}.`}</strong>{` We do send quite a lot, and we would rather you know: a summary of your properties, tenant, clients and contacts (names and history; phone numbers and tax numbers stay in our database and are not sent to the AI provider, unless you type them into your question), and any document or photo you upload to be read. This is also other people’s data; if you don’t want that, don’t use ${ASSISTANT_NAME_EN} or document scanning.`}</Never>
          <Never><strong style={P}>We don’t train models on your data.</strong> The AI provider is contractually bound not to train models on it.</Never>
          <Never><strong style={P}>We don’t lock you in.</strong> You download all your records as one JSON file with a single button, download uploaded files separately from the Property File, and delete your account without having to write to us.</Never>
        </div>
      ),
    },
    {
      h: 'Your rights, in practice',
      body: (
        <>
          <p className="lg-p">
            You exercise most GDPR rights yourself from <strong>Account · Data and privacy</strong>; for the rest, write to{' '}
            <MailLink to={IDENTITY.privacyEmail} />.
          </p>
          <ul className="lg-ul">
            <li><strong>Access and portability:</strong> you download all your records as a JSON file any program can read. Documents you uploaded are downloaded from the Property File.</li>
            <li><strong>Correction:</strong> you correct every field yourself, without a request. The only exception is your full name, which can change once a month for security reasons; if you need it corrected sooner, write to us and we do it without delay.</li>
            <li><strong>Erasure:</strong> permanent deletion of your account and data, from the app itself.</li>
            <li><strong>Withdrawing consent:</strong> “Contribute to community data” is off by default; only you turn it on, with one switch, and turn it off whenever you like.</li>
            <li><strong>Objection and restriction:</strong> write to us and we reply within one month at the latest.</li>
          </ul>
          <p className="lg-p">
            You also have the right to lodge a complaint with the Hellenic Data Protection Authority (
            <a href="https://www.dpa.gr" target="_blank" rel="noopener noreferrer" className="lp-link" style={LINK_STYLE}>dpa.gr</a>).
          </p>
        </>
      ),
    },
    {
      id: 'epikoinonia',
      h: 'How to reach us',
      body: (
        <>
          <p className="lg-p">A person reads and answers your messages. If something doesn’t work, or something here seems unclear, write to us.</p>
          <DataTable caption="Contact addresses" rows={[
            { label: 'Support', value: IDENTITY.supportEmail },
            { label: 'Personal data', value: IDENTITY.privacyEmail },
            { label: 'Security vulnerability reports', value: IDENTITY.securityEmail },
          ]} />
          <p className="lg-note">
            {`Found a security gap? Write to us and give us ${DISCLOSURE.embargoDays} days before you make it public. We confirm receipt within ${DISCLOSURE.ackBusinessDays} business days, reply with an assessment within ${DISCLOSURE.triageBusinessDays}, keep you updated every ${DISCLOSURE.updateEveryDays} days while it is open and credit you by name once it is fixed, if you wish. We commit not to take legal action against a researcher who acts in good faith and doesn’t access other people’s data. The full terms, including what is in and out of scope, are in our `}
            <a href="/.well-known/security.txt" className="lp-link" style={LINK_STYLE}>vulnerability disclosure policy</a>.
          </p>
        </>
      ),
    },
  ];

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', '@id': ORG_ID, name: IDENTITY.tradeName, url: SITE,
            logo: { '@type': 'ImageObject', url: siteUrl('/icons/icon-512.png'), width: 512, height: 512 }, sameAs: [...SOCIAL_PROFILES] },
          { '@type': 'AboutPage', '@id': `${URL}#webpage`, url: URL, name: TITLE, description: DESC, inLanguage: 'en',
            dateModified: POLICY_VERSION, isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': ORG_ID }, publisher: { '@id': ORG_ID } },
          breadcrumbJsonLd([{ name: TITLE, path: PATH }], HOME_CRUMB_EN),
        ],
      }} />
      <LegalLayout
        locale="en"
        guideHeads
        self={PATH}
        eyebrow="Trust"
        title={TITLE}
        meta={LEGAL_UI_EN.updated(UPDATED)}
        version={LEGAL_UI_EN.version(POLICY_VERSION, UPDATED)}
        intro="We ask for your tax number, your leases and your income. There is no reason to trust us with them unless you know who we are, where they go and what we don’t do with them. Here we say it as openly as we can, with no small print, including the exceptions that don’t flatter us."
        blocks={blocks}
      />
    </>
  );
}
