import Link from 'next/link';
import type { Metadata } from 'next';
import { BrandLogo } from '@/components/BrandMark';
import { T } from '@/components/tokens';
import { PLANS } from '@/lib/billing/plans';
import { aiLimitsFor } from '@/lib/billing/aiLimits';
import { signupCtaEn, trialOfferEn } from '@/lib/billing/trialOffer';
import { TRIAL_PLAN } from '@/lib/billing/entitlements';
import { FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';
import { fmtFor } from '@/lib/core/format';
import { athensParts } from '@/lib/core/time';
import { SITE, ORG_ID, SOCIAL_PROFILES, siteUrl } from '@/lib/core/site';
import { IDENTITY } from '@/lib/legal/identity';
import { billingWordsEn, PRICES_VAT_EN, NO_COMMITMENT_EN } from '@/lib/legal/billingWords';
import { createClient } from '@/lib/supabase/server';
import { localHref } from '@/lib/i18n/paths';
import { PLAN_COPY_EN } from '@/lib/i18n/en/plans';
import {
  LANDING_EN, HOW_EN, featuresEn, FEATURES_HEAD_EN, WORKS_EN, CALC_HEAD_EN, SECURITY_EN, WHY_EN,
  PRICING_HEAD_EN, FAQ_HEAD_EN, FINAL_EN, FAQ_PRICE_Q_EN, faqEn, PARTS_EN,
} from '@/lib/i18n/en/landing';
import { statsEn } from '@/lib/i18n/en/landingStats';
import LandingCalculator from '../LandingCalculator';
import LandingCalcEn from './landingEn';
import Spotlight from '../Spotlight';
import FaqMore from '../FaqMore';
import { FaqPlus } from '../FaqPlus';
import { PublicFooter, PublicNav, JsonLd } from '../PublicChrome';
import { publicMetadata } from '../publicMetadata';
import { shareImage } from '../og/share';
import { ACCENT, PANEL, TEXT, MUTED, FAINT, LINE, GAP, CARD_GAP, wrap, ic } from '../landingKit';
import { LANDING_PLANS, FEATURED_PLAN } from '../landingContent';
import { FaqList, NoaFeature, SectionHead, OwnerPlanCard, PlanCard } from '../LandingParts';
import { LandingStyles } from '../LandingStyles';

// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΡΧΙΚΗ ΣΤΑ ΑΓΓΛΙΚΑ
// ─────────────────────────────────────────────────────────────────────────
// Ιδια δομή, ίδια συστατικά και ίδιο ύφος με την ελληνική (app/page.tsx). Το
// κείμενο ζει στο lib/i18n/en/landing.ts· τα συστατικά παίρνουν `locale`.
//
// ΤΙ ΛΕΙΠΕΙ ΣΚΟΠΙΜΑ. Η βιτρίνα της εφαρμογής (LandingShowcase, ScrollStory)
// δείχνει την ίδια την εφαρμογή, που είναι ελληνική: στα αγγλικά τη θέση της
// παίρνουν τρία βήματα σε κείμενο, για να μη δει ο αναγνώστης ένα αγγλικό
// περιβάλλον που δεν υπάρχει. Η ενότητα συστάσεων φαίνεται μόνο όταν ανοίξει
// η χρέωση και θα μεταφερθεί τότε.
//
// ΧΩΡΙΣ ΣΥΛΛΑΒΙΣΜΟ ΚΑΙ ΧΩΡΙΣ ΠΛΗΡΗ ΣΤΟΙΧΙΣΗ. Το `hy()` κόβει ελληνικές
// συλλαβές· το αγγλικό κείμενο στοιχίζεται αριστερά, όπως το γράφουν η Apple
// και η Stripe.
// ═══════════════════════════════════════════════════════════════════════════

const PATH = '/en';
// Η ΣΤΑΘΜΗ ΤΩΝ ΕΝΟΤΗΤΩΝ ΠΑΝΩ ΑΠΟ ΤΗΝ ΑΤΜΟΣΦΑΙΡΑ, γραμμένη μία φορά.
const LAYER = { position: 'relative', zIndex: 1 } as const;
export const metadata: Metadata = publicMetadata({
  title: `${LANDING_EN.title} · PROPERWISE`,
  description: LANDING_EN.description,
  url: siteUrl(PATH),
  image: shareImage('en-home'),
});

export default async function LandingEn() {
  let loggedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    loggedIn = !!user;
  } catch { /* the visitor simply sees “Log in” */ }
  const words = billingWordsEn();
  const year = athensParts().year;
  const money = fmtFor('en').fe;
  const faq = faqEn();
  const visible = 5;
  const signup = localHref('en', '/signup');
  // Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ ΕΛΛΗΝΙΚΟΣ: πλήρης πλοήγηση (σκέτο <a>), ώστε η ρίζα να
  // ξαναγράψει το `<html lang>`.
  const dashboard = (cls: string, style: React.CSSProperties, label: string) =>
    <a href="/dashboard" className={cls} style={style}>{label}</a>;

  return (
    <div className="lp-root min-h-dvh" data-mode="dark" style={{ color: TEXT, fontFamily: T.font.sans, overflowX: 'clip', position: 'relative' }}>
      <LandingStyles />
      <a href="#main" className="skip-link">{LANDING_EN.skip}</a>
      <div className="lp-readbar" aria-hidden="true" />
      <div className="lp-atmos" aria-hidden="true" />

      <header className="lp-head" style={{ position: 'sticky', top: 0, zIndex: 50, paddingTop: 'env(safe-area-inset-top, 0px)', background: 'color-mix(in srgb, var(--bg-base) 78%, transparent)', borderBottom: `1px solid ${LINE}` }}>
        <nav style={{ ...wrap, height: 64, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <BrandLogo />
          </div>
          <PublicNav locale="en" signedIn={loggedIn && dashboard('lp-cta lp-primary', { textDecoration: 'none', fontSize: 14, fontWeight: 700, padding: '9px 18px', borderRadius: T.radius.pill, whiteSpace: 'nowrap' }, LANDING_EN.dashboard)} />
        </nav>
      </header>

      <main id="main">
      <Spotlight>

      <section className="lp-hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ ...wrap, ...LAYER, paddingTop: 'clamp(40px, 5.5vw, 68px)', paddingBottom: GAP, textAlign: 'center' }}>
          <Link href="#pricing" className="lp-rise lp-news">
            <span className="lp-news-tag">{LANDING_EN.news.tag}</span>
            <span>{LANDING_EN.news.text}</span>
            <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
          <h1 className="lp-rise" style={{ fontSize: 'clamp(32px, 5.2vw, 60px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.15, margin: '0 auto 20px', maxWidth: 1120, color: 'var(--text-primary)', textWrap: 'balance' }}>
            <span className="lp-h1-line">{LANDING_EN.titleLines[0]}</span>{' '}
            <span className="lp-h1-line lp-h1-accent">{LANDING_EN.titleLines[1]}</span>
          </h1>
          {/* ΑΡΙΣΤΕΡΗ ΣΤΟΙΧΙΣΗ ΤΟΥ ΑΓΓΛΙΚΟΥ, ΙΣΟΡΡΟΠΗΜΕΝΕΣ ΓΡΑΜΜΕΣ. Η ελληνική
              στοιχίζει δύο ισομήκεις προτάσεις πέρα πέρα (.lp-lede-line)· οι
              αγγλικές δεν είναι ισομήκεις και η πρώτη άνοιγε κενά ανάμεσα στις
              λέξεις. Μία παράγραφος με `balance`, όπως γράφει η Apple. */}
          <p className="lp-rise-2" data-nohy="" style={{ fontSize: 'clamp(15px, 1.75vw, 17px)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 auto 28px', maxWidth: 720, textWrap: 'balance' }}>
            {LANDING_EN.lede[0]}{' '}{LANDING_EN.lede[1]}
          </p>
          <div className="lp-rise-3 lp-hero-ctas" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {loggedIn ? dashboard('lp-cta lp-primary', { textDecoration: 'none', fontSize: 15, fontWeight: 700, padding: '14px 28px', borderRadius: T.radius.pill }, LANDING_EN.dashboard) : (<>
              <Link href={signup} className="lp-cta lp-primary" style={{ textDecoration: 'none', fontSize: 15, fontWeight: 700, padding: '14px 28px', borderRadius: T.radius.pill }}>{signupCtaEn()}</Link>
              <Link href={localHref('en', '/login')} style={{ background: 'transparent', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 15, fontWeight: 600, padding: '14px 28px', borderRadius: T.radius.pill, border: '1px solid var(--border-strong)', transition: 'border-color .15s, background .15s' }}>{LANDING_EN.haveAccount}</Link>
            </>)}
          </div>
          <ul className="lp-rise-4 lp-facts" aria-label={LANDING_EN.factsLabel}>
            {LANDING_EN.facts.map(f => <li key={f}>{f}</li>)}
          </ul>
          <p className="lp-rise-4" style={{ margin: '14px 0 0', fontSize: 13, color: FAINT }}>{LANDING_EN.appLanguage}</p>
        </div>
      </section>

      <section className="lp-reveal" style={{ ...wrap, ...LAYER, paddingBottom: GAP }}>
        <div className="lp-stats" data-nohy="" style={{ gap: CARD_GAP }}>
          {statsEn().map(s => (
            <div key={s.u} className="lp-stat" style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: T.radius.card }}>
              <div className="lp-stat-n">{s.n}</div>
              <div className="lp-stat-u">{s.u}</div>
              <p className="lp-stat-l">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="lp-reveal" style={{ ...wrap, ...LAYER, paddingBottom: GAP, scrollMarginTop: 72 }}>
        <SectionHead over={HOW_EN.over} title={HOW_EN.title} sub={HOW_EN.sub} />
        {/* Τρεις κάρτες που δεν κόβουν το κείμενό τους: το .lp-feat κρατά τις
            λεζάντες σε δύο γραμμές στο κινητό, τα βήματα θέλουν όλη τη φράση. */}
        {/* ΤΡΕΙΣ Ή ΜΙΑ, ΠΟΤΕ ΔΥΟ ΚΑΙ ΜΙΑ. Με `auto-fit` και ελάχιστο 260 τα τρία
            βήματα έπεφταν 2+1 στα 768–834 (e2e:layout, ορφανό πλακίδιο): κάτω από
            τα 3 × 220 του περιεχομένου η στήλη παίρνει όλο το πλάτος. */}
        <ol style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, max(calc((100% - ${2 * CARD_GAP}px) / 3), (${3 * 220 + 2 * CARD_GAP}px - 100%) * 999)), 1fr))`, gap: CARD_GAP, listStyle: 'none', margin: 0, padding: 0 }}>
          {HOW_EN.steps.map((s, i) => (
            <li key={s.t} className="lp-card" style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: T.radius.card, padding: 'clamp(20px, 2.2vw, 24px)' }}>
              <div aria-hidden="true" style={{ width: 38, aspectRatio: '1', borderRadius: T.radius.popup, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: T.sp.lg, fontSize: 15, fontWeight: 700, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>{s.t}</h3>
              <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, margin: 0, textWrap: 'pretty' }}>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-reveal" style={{ ...wrap, ...LAYER, paddingBottom: GAP }}>
        <SectionHead {...FEATURES_HEAD_EN(FIRST_YEAR_NEW_BRACKETS)} />
        <div className="lp-feat" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: CARD_GAP }}>
          {featuresEn(year).map(f => (
            <div key={f.t} className="lp-card" style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: T.radius.card, padding: 'clamp(20px, 2.2vw, 24px)' }}>
              <div style={{ width: 38, aspectRatio: '1', borderRadius: T.radius.popup, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: T.sp.lg }}>{ic(f.i)}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>{f.t}</h3>
              <p className="lp-feat-d" style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, margin: 0, textWrap: 'pretty' }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-reveal" style={{ ...wrap, ...LAYER, paddingBottom: GAP }}>
        <SectionHead over={WORKS_EN.over} title={WORKS_EN.title} sub={WORKS_EN.sub} />
        <div className="lp-works">
          {WORKS_EN.items.map(w => (
            <div key={w.t}>
              <div className="lp-works-t" style={{ fontSize: 15, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em', marginBottom: 4 }}>{w.t}</div>
              <div className="lp-works-d" style={{ fontSize: 14, color: FAINT, lineHeight: 1.5 }}>{w.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-reveal" style={{ ...wrap, ...LAYER, paddingBottom: GAP }}>
        <SectionHead {...CALC_HEAD_EN(FIRST_YEAR_NEW_BRACKETS)} />
        <LandingCalcEn><LandingCalculator cta={signupCtaEn()} locale="en" /></LandingCalcEn>
      </section>

      <section className="lp-reveal" style={{ ...wrap, ...LAYER, paddingBottom: GAP }}>
        <SectionHead over={SECURITY_EN.over} title={SECURITY_EN.title} sub={SECURITY_EN.sub} />
        <div className="lp-sec" style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: T.radius.card, padding: 'clamp(24px, 3vw, 38px)' }}>
          <p className="lp-sec-lede">{SECURITY_EN.lede}</p>
          <div className="lp-sec-grid">
            {SECURITY_EN.items.map(s => (
              <div key={s.t} className="lp-sec-item">
                <div className="lp-sec-ico" aria-hidden="true">
                  <svg aria-hidden="true" width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{s.i.split('M').filter(Boolean).map((p, j) => <path key={j} d={'M' + p} />)}</svg>
                </div>
                <div>
                  <div className="lp-even" data-nohy="" style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4, letterSpacing: '-0.01em' }}>{s.t}</div>
                  <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.55 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          {localHref('en', '/trust') !== '/trust' && (
            <p className="lp-sec-fine">
              {SECURITY_EN.fine}{' '}
              <Link href={localHref('en', '/trust')} className="lp-link po-tap-inline" style={{ color: ACCENT, textDecoration: 'none' }}>{SECURITY_EN.fineLink}</Link>.
            </p>
          )}
        </div>
      </section>

      <section className="lp-reveal" style={{ ...wrap, ...LAYER, paddingBottom: GAP }}>
        <SectionHead over={WHY_EN.over} title={WHY_EN.title} />
        <div className="lp-why">
          {WHY_EN.body.map(p => <p key={p}>{p}</p>)}
        </div>
        <p style={{ fontSize: 'clamp(17px, 1.9vw, 21px)', lineHeight: 1.45, color: 'var(--text-primary)', letterSpacing: '-0.015em',
          margin: 'clamp(26px, 3.2vw, 40px) 0 0', textWrap: 'balance' }}>
          {WHY_EN.close}
        </p>
        {localHref('en', '/trust') !== '/trust' && (
          <div style={{ marginTop: 14, textWrap: 'balance' }}>
            <Link href={localHref('en', '/trust')} className="lp-link po-tap" style={{ color: ACCENT, textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>
              {WHY_EN.about}
            </Link>
          </div>
        )}
      </section>

      <NoaFeature locale="en" />

      <section id="pricing" className="lp-reveal" style={{ ...wrap, ...LAYER, paddingBottom: GAP }}>
        <SectionHead over={PRICING_HEAD_EN.over} title={PRICING_HEAD_EN.title} sub={PRICING_HEAD_EN.sub} />
        {words.pricingNotice && (
          <div role="note" style={{ padding: '14px 16px', marginBottom: 16, borderRadius: T.radius.popup, background: PANEL, border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', fontSize: 14, lineHeight: 1.55, color: MUTED }}>
            <strong style={{ color: TEXT, fontWeight: 700 }}>{words.pricingNotice.title}</strong>{' '}{words.pricingNotice.body}
          </div>
        )}
        <div className="lp-plans" style={{ display: 'grid', gridTemplateColumns: `repeat(${LANDING_PLANS.length}, minmax(0, 1fr))`, gap: CARD_GAP, alignItems: 'stretch' }}>
          {LANDING_PLANS.map((id, i) => {
            if (id === 'solo') return <OwnerPlanCard key={id} billingLive={words.live} locale="en" />;
            const plan = PLANS[id], copy = PLAN_COPY_EN[id];
            const prev = i > 0 ? PLAN_COPY_EN[LANDING_PLANS[i - 1]] : null;
            const paidMonths = Math.round(plan.priceAnnual / plan.priceMonthly);
            return (
              <PlanCard
                key={id}
                locale="en"
                name={copy.name}
                nameColor={id === FEATURED_PLAN ? ACCENT : TEXT}
                sub={copy.tagline}
                price={money(plan.priceMonthly)}
                per={PARTS_EN.perMonth}
                note={<>or <strong style={{ color: TEXT }}>{money(plan.priceAnnual)} a year</strong></>}
                annual={words.live ? PARTS_EN.annual(paidMonths) : undefined}
                inherits={prev ? PARTS_EN.inherits(prev.name) : PARTS_EN.includes}
                planId={id}
                ai={aiLimitsFor(id).perMonth}
                aiDay={aiLimitsFor(id).perDay}
                items={copy.features}
                cta={signupCtaEn(id)}
                ctaGhost={id !== FEATURED_PLAN}
                featured={id === FEATURED_PLAN}
              />
            );
          })}
        </div>
        <p className="fineprint" style={{ fontSize: 'var(--fs-base)', lineHeight: 1.6, color: FAINT, margin: '22px 0 0', textWrap: 'pretty' }}>
          {trialOfferEn(PLAN_COPY_EN[TRIAL_PLAN].name)}{words.live && <> {words.firstCharge}</>}
          {' '}{PRICES_VAT_EN} {NO_COMMITMENT_EN}
          {' '}{words.moneyBack}
        </p>
        <div style={{ marginTop: 10 }}>
          <Link href={localHref('en', '/paketa')} className="lp-link po-tap" style={{ color: ACCENT, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            {PRICING_HEAD_EN.more}
          </Link>
        </div>
      </section>

      <section id="faq" className="lp-reveal" style={{ ...wrap, ...LAYER, paddingBottom: 0 }}>
        <SectionHead over={FAQ_HEAD_EN.over} title={FAQ_HEAD_EN.title} sub={FAQ_HEAD_EN.sub} />
        <div style={{ borderBottom: `1px solid ${LINE}` }}>
          <FaqList list={faq.slice(0, visible)} />
        </div>
        <FaqMore>
          <summary style={{ cursor: 'pointer', listStyle: 'none', fontSize: 14, fontWeight: 600, color: ACCENT, alignItems: 'center', gap: 8 }}>
            <span className="lp-more-open">{FAQ_HEAD_EN.more}</span>
            <span className="lp-more-shut">{FAQ_HEAD_EN.less}</span>
            <FaqPlus />
          </summary>
          <div style={{ borderBottom: `1px solid ${LINE}` }}>
            <FaqList list={faq.slice(visible)} />
          </div>
        </FaqMore>
      </section>

      <section className="lp-hero lp-reveal lp-final" style={{ position: 'relative', overflow: 'hidden', borderBottom: 'none' }}>
        <div style={{ ...wrap, ...LAYER, textAlign: 'center', paddingTop: GAP, paddingBottom: GAP }}>
          <h2 style={{ fontSize: 'clamp(28px, 4.6vw, 46px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.1, margin: '0 auto 16px', maxWidth: 720, color: 'var(--text-primary)', textWrap: 'balance' }}>{FINAL_EN.title}</h2>
          <p data-nohy="" style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 auto 30px', maxWidth: 640, textWrap: 'balance' }}>
            {FINAL_EN.lines[0]}{' '}{FINAL_EN.lines[1]}
          </p>
          {loggedIn
            ? dashboard('lp-cta lp-primary lp-final-cta', { display: 'inline-block', textDecoration: 'none', fontSize: 15, fontWeight: 700, padding: '14px 30px', borderRadius: T.radius.pill }, LANDING_EN.dashboard)
            : <Link href={signup} className="lp-cta lp-primary lp-final-cta" style={{ display: 'inline-block', textDecoration: 'none', fontSize: 15, fontWeight: 700, padding: '14px 30px', borderRadius: T.radius.pill }}>{signupCtaEn()}</Link>}
        </div>
      </section>

      </Spotlight>
      </main>

      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': ORG_ID,
            name: IDENTITY.tradeName,
            url: SITE,
            email: IDENTITY.supportEmail,
            logo: `${SITE}/icons/icon-192.png`,
            areaServed: 'GR',
            sameAs: [...SOCIAL_PROFILES],
          },
          {
            '@type': 'WebPage',
            '@id': `${siteUrl(PATH)}#webpage`,
            url: siteUrl(PATH),
            name: LANDING_EN.title,
            inLanguage: 'en',
            isPartOf: { '@id': `${SITE}/#website` },
          },
          {
            '@type': 'SoftwareApplication',
            name: IDENTITY.tradeName,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            url: siteUrl(PATH),
            inLanguage: 'el',
            description: LANDING_EN.description,
            publisher: { '@id': ORG_ID },
          },
          {
            '@type': 'FAQPage',
            inLanguage: 'en',
            mainEntity: faq.map(f => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.q === FAQ_PRICE_Q_EN && words.pricingNotice ? `${f.a} ${words.pricingNotice.title}` : f.a },
            })),
          },
        ],
      }} />
      <div style={{ ...LAYER }}><PublicFooter locale="en" /></div>
    </div>
  );
}
