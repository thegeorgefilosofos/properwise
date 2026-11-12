// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΟΡΟΙ ΧΡΗΣΗΣ ΣΤΑ ΑΓΓΛΙΚΑ: ΜΕΤΑΦΡΑΣΗ ΓΙΑ ΔΙΕΥΚΟΛΥΝΣΗ, ΟΧΙ ΝΕΟ ΚΕΙΜΕΝΟ
// ─────────────────────────────────────────────────────────────────────────
// Πιστή μετάφραση του app/terms/page.tsx, ενότητα προς ενότητα, με τις ίδιες
// πηγές για κάθε αριθμό (τιμές, ημέρες, όρια, στόχοι). Δεσμευτικό είναι το
// ελληνικό· η σύμβαση συνάπτεται στα ελληνικά και το κείμενο το λέει.
//
// ΣΚΟΠΙΜΕΣ ΑΠΟΚΛΙΣΕΙΣ ΔΙΑΤΥΠΩΣΗΣ, ΟΧΙ ΠΕΡΙΕΧΟΜΕΝΟΥ:
//   · «δωρεάν πακέτο» → «no-subscription plan» και «δωρεάν δοκιμή» → «trial»,
//     με τον κανόνα του προϊόντος για τη λέξη «free» δίπλα σε πακέτο ή τιμή·
//   · τα κουμπιά της υπαναχώρησης έχουν ελληνικά ονόματα στη (μόνο ελληνική)
//     φόρμα· εδώ αποδίδονται στα αγγλικά με τη σημείωση ότι η φόρμα είναι
//     στα ελληνικά.
// ═══════════════════════════════════════════════════════════════════════════
import type { LegalSection } from '@/app/legal-shell';
import { IDENTITY, identityIsPublished } from '@/lib/legal/identity';
import { PLANS, TRIAL_DAYS, PRIORITY_SUPPORT_LINE, firstPlanWith, type PlanId } from '@/lib/billing/plans';
import { SCAN_LIMITS, TRIAL_SCANS_PER_MONTH } from '@/lib/billing/aiLimits';
import { TRIAL_PLAN, EARLY_ACCESS_DAYS, PROFESSIONAL_MIN_PLAN } from '@/lib/billing/entitlements';
import { fmtFor } from '@/lib/core/format';
import { trialOfferEn } from '@/lib/billing/trialOffer';
import { billingWordsEn } from '@/lib/legal/billingWords';
import { WITHDRAWAL_PATH } from '@/lib/legal/withdrawalLabels';
import { enPathFor } from '@/lib/i18n/paths';
import { activeSubprocessors, plannedSubprocessors, type Subprocessor } from '@/lib/legal/subprocessors';
import { siteUrl } from '@/lib/core/site';
import { INVITE_LIMITS } from '@/lib/data/accountantInvites';
import { FIRM_ACCESS_LOG_MONTHS, FIRM_UNDO_DAYS } from '@/lib/legal/firms';
import {
  INDIV_VOLUME_TARGET, INDIV_VOLUME_BONUS_MONTHS, PRO_PAID_TARGET, PRO_PAID_BONUS_MONTHS,
  STREAK_TARGET_MONTHS, PARTNER_WELCOME_MONTHS, PARTNER_MONTHLY_FREE_MONTHS,
  REFERRER_SLOT_MONTHS, individualReferrerReward, partnerWelcomeTier,
} from '@/lib/referral/referral';
import { PLAN_COPY_EN } from '../plans';
import { identityPendingEn, subprocessorNameEn } from './common';

const fe = fmtFor('en').fe;
const name = (id: PlanId) => PLAN_COPY_EN[id].name;
const namesOf = (list: readonly Subprocessor[]): string => {
  const n = list.map(subprocessorNameEn);
  return n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
};
const propertiesFor = (id: PlanId): string => {
  const n = PLANS[id].maxProperties;
  if (!Number.isFinite(n)) return 'unlimited properties';
  return n === 1 ? 'one property' : `up to ${n} properties`;
};
const months = (n: number): string => (n === 1 ? 'one month' : `${n} months`);
const price = (id: PlanId) => `${fe(PLANS[id].priceMonthly)} a month or ${fe(PLANS[id].priceAnnual)} a year`;

// Τα ονόματα της φόρμας υπαναχώρησης, που είναι στα ελληνικά.
const WITHDRAW_EN = 'Withdraw from the contract here';
const WITHDRAW_CONFIRM_EN = 'Confirm withdrawal';

export const TERMS_EN = {
  title: 'Terms of use',
  metaTitle: 'Terms of use · PROPERWISE',
  description: `The terms of a PROPERWISE subscription: prices, the ${TRIAL_DAYS}-day trial, withdrawal, cancellation and your rights.`,
  intro: 'By creating an account you enter into a contract with us and accept these Terms. They are written as simply as possible, with respect for your rights as a consumer. We suggest you read them before you start.',
};

export function termsSectionsEn(): LegalSection[] {
  const words = billingWordsEn();
  const support = IDENTITY.supportEmail;
  const reward = {
    proOutcome: name(individualReferrerReward(false, 'agency').tier),
    indivVolume: name('owner'),
    proPaid: name('agency'),
    partnerFromOwner: name(partnerWelcomeTier('owner')),
    partnerElse: name(partnerWelcomeTier('office')),
  };
  return [
    { h: 'Definitions', part: 'A. Our agreement', labelled: true, list: [
      '“Service” or “PROPERWISE”: the property management app and all its features.',
      `“We”: the operator of the Service. You can contact us at ${IDENTITY.supportEmail}.`,
      '“You” or “User”: the natural or legal person using the Service.',
      '“Subscription”: paid access to a plan of the Service beyond the no-subscription plan, bought at checkout and charged at the moment of purchase.',
    ] },
    { h: 'When you are a “consumer” and when you are not', p: [
      'Greek Law 2251/1994 on consumer protection, together with the right of withdrawal and the conformity rights described below, covers only natural persons acting outside their trade or profession. An owner managing their own properties is covered.',
      'If you use the Service in the course of a professional activity, that is, if you manage third parties’ properties or invoice related services, the contract is a business contract and the consumer protection provisions do not apply. Everything else applies in full in both cases.',
    ] },
    { h: 'The Service', p: [
      'PROPERWISE is an app for organizing and managing property, for owners and small offices. It provides data entry, calculations (taxes, yields, costs), reports, provider comparison, lease management and Noa, which answers questions about your properties using artificial intelligence.',
      'The Service evolves continuously and some features may change, be added or be withdrawn. We change something included in your subscription only for a valid reason, at no extra cost to you. If the change affects you negatively more than minimally, we inform you in good time and clearly before it takes effect, and you can terminate the contract without charge.',
    ] },
    { h: 'Eligibility and account', p: [
      'To use the Service you must be at least 18 years old and have legal capacity. You declare that the details you enter are accurate and up to date.',
      'You are responsible for the security of your sign-in details and for every action taken from your account. Notify us immediately if you suspect unauthorized access.',
    ] },
    { h: 'How the contract is concluded', p: [
      `The Greek law on electronic commerce (Presidential Decree 131/2003) requires that you know in advance exactly how you become bound. ${words.contractSteps}`,
      'Before every submission you see what you entered and can correct it, by going back or correcting the field in place; every detail of your account remains correctable after sign-up as well. The contract is concluded in Greek; if this English translation differs, the Greek text prevails. It is stored by us and you can read it whenever you like on this page, and every material change to it is notified to you in advance. We have not subscribed to any industry code of conduct.',
    ] },
    { h: 'Subscription, prices and trial', part: 'B. Subscription and money', p: [
      `The “${name('free')}” plan is provided at no charge, without a subscription: ${propertiesFor('free')}, the tax tools, ${SCAN_LIMITS.free} document scans a month, without Noa. There are four subscriptions, with no minimum term: “${name('solo')}” for ${propertiesFor('solo')}, with Noa and scanning with no monthly limit (${price('solo')}), “${name('owner')}” for ${propertiesFor('owner')} (${price('owner')}), “${name('agency')}” for ${propertiesFor('agency')} with team management (${price('agency')}) and “${name('office')}” for ${propertiesFor('office')} (${price('office')}). The prices shown apply to consumers in Greece and include the applicable VAT; for customers outside Greece, VAT follows their country. In every case, you see the amount you will be charged at checkout before you confirm, and the VAT breakdown appears on the receipt.`,
      `${trialOfferEn(name(TRIAL_PLAN))} The trial is given once per account. The same limit and the same allowance apply to a partner while they have no months without charge in force. Months without charge from the referral programme and the prize-draw gift do not draw on the allowance: they have the limits of their plan. The plan you chose at sign-up applies from the activation of the subscription.`,
      words.planChange,
      words.afterTrial,
      `${words.paymentMethodAsked} No charge is ever made using details you have not given yourself for that purpose.`,
      'We reserve the right to adjust prices in the future. Any price change is notified to you by email before the renewal it applies to, in good time for you to decide whether to continue. The new price never applies to a period you have already paid for. Until the renewal you can cancel the subscription or terminate the contract without charge or penalty.',
      'Today there is no charge beyond the plan price. If an optional feature with its own cost is added, it will be switched on only by you, will appear as a separate line before you confirm, and will be listed here with its price before it becomes available.',
    ] },
    { h: 'Payments and billing', p: [
      words.chargingToday,
      ...(words.seller ? [`${words.seller.line} ${words.seller.termsLabel}: ${words.seller.termsUrl}`] : []),
      ...(words.contractParties ? [words.contractParties] : []),
      words.cardData,
      words.subscriptionPlace,
      words.renewal,
    ] },
    { h: 'Right of withdrawal', id: 'ypanachorisi', p: [
      'As a consumer you have the right to withdraw within 14 days of the conclusion of the contract, without giving a reason, under Greek Law 2251/1994 and Directive 2011/83/EU.',
      words.withdrawal,
      `The simplest way is the “${WITHDRAW_EN}” function on the page ${siteUrl(enPathFor(WITHDRAWAL_PATH) ?? WITHDRAWAL_PATH)}, which also appears in the footer of every page and in your Account, under Subscription. It works without signing in too. You fill in your name, your email and the contract, see the whole declaration and submit it with “${WITHDRAW_CONFIRM_EN}”. You immediately receive by email an acknowledgement with the content of the declaration and the date and time of submission. If you have a subscription and are signed in, its renewal is canceled immediately.`,
      `You can also send us a clear statement at ${support} before the period expires, preferably from your account’s email address so that we can find it immediately.${words.withdrawalVia ? ` ${words.withdrawalVia}` : ''} No reason or special form is needed. For example: “I withdraw from the PROPERWISE subscription contract I concluded on [date], with the account [email].” The deadline is met if the statement is sent before it expires, even if we read it later.`,
      'You can also use the model withdrawal form provided by law. Complete it and send it only if you wish to withdraw from the contract:',
    ], form: {
      label: 'Model withdrawal form',
      lines: [
        words.withdrawalTo
          ? `To: ${words.withdrawalTo}, or to ${IDENTITY.tradeName}, which forwards it: ${support}`
          : `To: ${identityIsPublished() ? `${IDENTITY.legalName}, ${IDENTITY.address}, ` : ''}${IDENTITY.tradeName}, ${support}`,
        '',
        'I hereby give notice that I withdraw from my contract for the provision of the following service: PROPERWISE subscription, plan […]',
        '',
        'Ordered on: […]',
        'Name of consumer: […]',
        'Address of consumer: […]',
        'Signature of consumer (only if this form is notified on paper): […]',
        'Date: […]',
      ],
    } },
    { h: 'Cancellation and refunds', p: [
      'You can cancel your subscription at any time from within the app, under subscription management in your Account, without needing to contact us. Cancellation applies from the next billing period and you keep access until the end of the period you have already paid for.',
      'Beyond the rights the law gives you (e.g. withdrawal, or your rights in case of defective performance) and the refund commitment for businesses in the section “Right of withdrawal”, paid periods are not refunded pro rata. If you run into a problem, contact us and we will deal with it in good faith.',
    ] },
    { h: 'Invitation and partner program', id: 'systaseis', part: 'C. Programs and benefits', p: [
      `The Service offers an invitation program: you share your personal link and, when a new owner starts and activates their account (adds a property and scans a document), you earn one extra property for ${months(REFERRER_SLOT_MONTHS)}, whatever plan you have. If the new user becomes a “${name('agency')}” subscriber, you earn instead ${months(individualReferrerReward(false, 'agency').months)} of “${reward.proOutcome}”. The new user starts with the ${TRIAL_DAYS}-day trial, like every new account; the link gives them no additional benefit.`,
      `Monthly targets. What counts is the accounts you invited that were activated within the same calendar month. As an individual, if ${INDIV_VOLUME_TARGET} individuals are activated within the month, you earn an extra ${months(INDIV_VOLUME_BONUS_MONTHS)} of “${reward.indivVolume}”. As a professional, if ${PRO_PAID_TARGET} accounts with a subscription to any plan are activated within the month, you earn ${months(PRO_PAID_BONUS_MONTHS)} of “${reward.proPaid}”. The target reward is credited when you claim it from the program screen.`,
      `Partner status. If, as a professional, you reach the target of ${PRO_PAID_TARGET} subscribers for ${STREAK_TARGET_MONTHS} consecutive completed months, you obtain partner status. On obtaining it you earn ${months(PARTNER_WELCOME_MONTHS)} of “${reward.partnerFromOwner}” if you have “${name('solo')}” or “${name('owner')}”, otherwise ${months(PARTNER_WELCOME_MONTHS)} of “${reward.partnerElse}”. After that, every month in which you reach the target gives you ${months(PARTNER_MONTHLY_FREE_MONTHS)} of subscription without charge. Partners also have priority in the release order of new features, as described in the next section.`,
      words.compMonths,
      'The program is intended for genuine referrals. Abusive use (self-referrals, fake or duplicate accounts, mass unsolicited promotion) is prohibited. We reserve the right to cancel rewards obtained abusively and to amend or terminate the program, with prior notice of material changes.',
    ] },
    { h: 'Priority for new features', p: [
      `Subscribers to “${name('owner')}”, “${name('agency')}” and “${name('office')}” have priority in the release order: every new feature or improvement is added to these plans first, with “${name('office')}” first of all. The mobile app has not been released yet; when it is (App Store and Google Play), these plans will get access ${EARLY_ACCESS_DAYS} days earlier than the others. Priority concerns the order of release, not different service content. Bug fixes, security updates and those needed for the Service to remain in conformity with the contract are released to all plans at the same time.`,
    ] },
    { h: 'Support', p: [
      `For any question or problem, write to ${support}. On the “${name(firstPlanWith(PRIORITY_SUPPORT_LINE))}” plan, “Priority email support” means that your messages to this address are answered before the others. We do not commit to a specific response time; for complaints, the deadline in the section “Complaints and out-of-court resolution” applies.`,
    ] },
    { h: 'Feedback prize draw', id: 'klirosi', p: [
      `For as long as the app announces it, the Service may ask for your opinion once a month and enter you in a prize draw for one year of “${name('agency')}” subscription. The draw may be stopped with prior notice within the app; entries already made count normally in the draw for their month. Taking part is optional and costs nothing: no purchase is required and not taking part does not affect your account in any way.`,
      `Every holder of an active account aged over 18 may take part, with one entry per account per month. The draw takes place at the end of each calendar month: the winner is chosen at random from all the month’s entries and is notified by email at their account address. If they do not reply within 14 days, the prize is drawn again. The value of the prize is ${fe(PLANS.agency.priceAnnual)}, equal to the annual “${name('agency')}” subscription.`,
      `The prize is product value, is credited to the winner’s account and cannot be exchanged for cash or transferred. Your answers are used to improve the Service; they are not published under your name without your explicit consent. Winners’ names are not published either; any participant may ask for confirmation that the draw took place at ${support}. We reserve the right to exclude entries from fake or duplicate accounts and to amend or terminate the draw, with prior notice.`,
    ] },
    { h: 'Acceptable use', part: 'D. What is allowed and who owns what', p: ['You agree not to use the Service to:'], list: [
      'breach laws or the rights of third parties, or enter their data without a legal basis,',
      'attempt unauthorized access, overloading or interference with the security of the systems,',
      'send requests for access to a file to people with whom you have no professional relationship, or to obtain information by deception,',
      'use access to a client’s account beyond the level or purpose for which it was granted, or after it has been revoked,',
      'copy, resell or exploit the Service beyond its intended use.',
    ], note: `Inviting clients by email (a request for access to their file) is available from the “${name(PROFESSIONAL_MIN_PLAN)}” plan (up to ${INVITE_LIMITS.paidPerDay} a day) and during the trial (up to ${INVITE_LIMITS.trialPerDay} a day and ${INVITE_LIMITS.trialTotal} in total). The message is sent with your account’s confirmed address as sender; abuse is a material breach (see “Suspension and termination”).` },
    { h: 'Accounting or tax firm account', id: 'grafeia', p: [
      'A firm account is an account through which an accounting or tax firm views and, where the client allows it, records data in its clients’ accounts. Its use is professional, so consumer protection provisions do not apply (see “When you are a “consumer” and when you are not”).',
      words.firmAccount,
    ], list: [
      'No properties of its own: a firm account does not record properties, tenants, expenses, documents, rents or stays as an owner. A member who has properties of their own uses another account for them.',
      'Members and roles: the firm has at least one Firm manager. The Firm manager invites members, sets roles and assigns clients. Each person belongs to only one active firm. Every active member can use the firm’s features only after a second authentication step.',
      'Responsibility for members: the firm is liable towards us and towards its clients for every action of its members within the Service as for its own. It gives a role and an assignment only to those who need them for their work, removes without delay a member who leaves or no longer needs access and notifies us immediately if it suspects unauthorized access.',
      'Confidentiality: the firm ensures that each of its members is bound to confidentiality, by contract or by professional duty, for whatever they see in clients’ accounts and that this obligation continues after they leave.',
      'Purpose: the firm uses what it sees only for the work the client has entrusted to it. It does not use it for advertising, does not sell it and does not disclose it to third parties beyond what the law requires.',
      'Records on the client’s behalf: at the “Upload receipts” and “Bookkeeping on my behalf” levels the firm records only what the client gave it or what concerns the work entrusted to it and is responsible for its accuracy. Each record bears the name of the firm and of the member and is written to the activity log, which the client sees. The client may correct or delete it, or undo all of a day’s records.',
      'Acceptance of the terms: before the firm sees any client, the Firm manager accepts the terms of this section within the app on behalf of the firm and each member accepts them on joining the firm. Acceptance is recorded with version and date. When the terms change, access to clients stops until the Firm manager and the member accept the new version.',
      'Responsibility for records: the firm is responsible for the accuracy of what it records. We do not check the content of the firm’s records and we are liable only if the Service did not record them as they were given. The client sees the firm’s records in the daily summary and can undo them. All of this is without prejudice to mandatory provisions of law: it does not exclude liability for intent or gross negligence (Article 332 of the Greek Civil Code) nor does it limit consumer rights (Greek Law 2251/1994).',
      'Members outside the EEA: the firm grants access only to members who process clients’ data within the European Economic Area or with the safeguards of Chapter V of Regulation (EU) 2016/679 and is responsible for this.',
      'Loss of licence or cessation: if the firm loses its licence to practise or ceases its activity, it must stop using the firm account for its clients and inform them. The client can revoke the firm’s access at any time from Settings.',
      'Special categories of data: neither the firm nor the client uploads or records special categories of data (Article 9 of Regulation (EU) 2016/679), such as health data, unless they are necessary for a legal tax obligation. When they are found without being needed, they are deleted: the client deletes the document or the record and the firm that finds them notifies the client without delay.',
      `Death of the client: the client’s heirs or legal representative may ask by email to ${support}, with a document proving their capacity, for the account to be closed and the firm’s access to be revoked.`,
      'Processor for the client: for what it records in the client’s account, the firm acts as a processor on the client’s behalf (Article 28 of Regulation (EU) 2016/679) and undertakes towards the client to record only what the level allows and what the client asked for, to bind its members to confidentiality, to notify the client without undue delay of a breach affecting the client’s data (Article 33(2)), to assist the client with data subjects’ requests and not to engage another processor for these records without the client’s permission. We do not become the firm’s processor; we remain the client’s processor.',
      'End of access: when the client revokes access or the firm removes a member, access stops immediately within the Service. The firm does not keep copies of what it saw beyond what the work entrusted to it or the law requires.',
      'Breach: misuse of access to a client’s account is a material breach (see “Suspension and termination”).',
    ] },
    { h: 'Obligations of the firm as a processor', id: 'grafeia-ekteloun', p: [
      'This section supplements the undertakings in the section “Accounting or tax firm account” for what the firm records in the client’s account as a processor (Article 28 GDPR). The firm takes on these obligations directly towards the client, who may rely on them independently. The firm:',
    ], list: [
      'takes appropriate technical and organisational security measures (Article 32 GDPR) for whatever it views, records or downloads from the client’s account, such as the second sign-in step for every member and the safekeeping of every file it downloads;',
      'assists the client, with the information available to it, with the obligations under Articles 32 to 36 GDPR: security of processing, notification and communication of a breach, impact assessment and prior consultation;',
      'does not engage another processor for these records without the client’s prior written authorisation. If the authorisation is general, it informs the client before adding or replacing one, so that the client can object. It binds anyone it engages by contract to the same data protection obligations and remains liable to the client for them;',
      'transfers client data outside the European Economic Area only as the section “Accounting or tax firm account” provides for members outside the EEA, with the safeguards of Chapter V GDPR;',
      'informs the client immediately if, in its opinion, an instruction infringes the GDPR or other data protection provisions;',
      `at the end of the access, what it recorded stays in the client’s account, which the client controls. It deletes copies it kept outside the Service, unless it needs them for the work it was given or the law requires them to be kept. Within the Service the firm continues to see only its own access history for the client, for ${FIRM_ACCESS_LOG_MONTHS} months from each action, not the activity log or the client’s data;`,
      'makes available to the client all information necessary to demonstrate compliance with Article 28 GDPR and allows audits by the client or an auditor the client appoints, at a reasonable time and with reasonable notice.',
    ] },
    { h: 'Your content and license', p: [
      'The data and files you enter remain yours. You grant us a limited, non-exclusive license to store and process them solely so that the Service works for you. You can export or delete them at any time.',
    ] },
    { h: 'Processing agreement for third-party data', id: 'epexergasia', p: [
      'When you enter details of third parties, such as a tenant’s name, tax number (AFM) or lease, you are the controller and we are the processor under Article 28 of the General Data Protection Regulation (Regulation (EU) 2016/679, “GDPR”). This section is the processing agreement between us.',
      'Its subject matter is storing and processing these details solely so that the Service works for you (lease records, installments, documents, declarations). Its duration is for as long as you keep an account and the details have not been deleted. The categories of data subjects are your tenants and partners; the categories of data are the identity, contact and lease details you enter.',
      'Acceptance is requested within the app before the first time such details are saved, and is recorded with version and date. Without acceptance the details are not saved. As processor we undertake to:',
    ], list: [
      'process the details only on your documented instructions, that is, those you give by using the Service. These include transfers to third countries, which take place only as described in the Privacy Policy (“International transfers”). If the law requires us to carry out other processing, we inform you before it, unless that law prohibits it. We inform you immediately if, in our opinion, an instruction of yours infringes the GDPR;',
      'bind anyone with access to them on our side to confidentiality; members of an accounting firm to which you grant access are bound by the firm itself (see “Accounting or tax firm account”);',
      'take the security measures of Article 32, such as encryption in transit and access control per account;',
      'engage other processors only as listed on the “About us” page. We bind them by contract to the data protection obligations of Article 28 GDPR and remain liable to you for them; the Privacy Policy (“International transfers”) states with whom a contract has been concluded and with whom it is pending. Before adding or replacing one we inform you by email, in good time for you to object. If you object on reasonable grounds and no solution is found, you may terminate the contract without charge;',
      'help you respond to data subjects’ requests, with export and deletion from within the app;',
      'assist you with the obligations of Articles 32 to 36 and inform you without undue delay of a personal data breach;',
      'delete the details when you delete them or close your account, except those the law requires to be kept;',
      'provide you with all information needed to demonstrate compliance with this agreement, and allow audits within a reasonable time.',
    ], after: [
      'When you grant access to an accounting or tax firm, the following also applies. Your choice of level (“Read only”, “Upload receipts”, “Bookkeeping on my behalf”) is your documented instruction to us to allow the firm what the level describes and nothing beyond it; you may change or revoke it at any time. For the records the firm makes in your account you remain the controller and the firm acts as a processor on your behalf, under the terms of the section “Accounting or tax firm account”. We remain your processor: we do not become the firm’s processor and we do not process your data on instructions from the firm that go beyond the level you set.',
      `We keep an access history and an activity log of the firm, so that you can check what happened and undo mistakes. The activity log records which fields changed, not their values; for a tenant it keeps none of their data. The copy of the record before and after the action, needed for the undo, is deleted together with the record and in any event after ${FIRM_UNDO_DAYS} days. The other retention periods are set out in the Privacy Policy, section “Accounting and tax firms”.`,
    ] },
    { h: 'Intellectual property', p: [
      'The Service, its design, code, trademarks and our content belong to us and are protected by intellectual property law. You acquire no right in them beyond the right to use the Service under these Terms.',
    ] },
    { h: 'Third-party services', p: [
      `The Service relies on third-party providers: ${namesOf(activeSubprocessors())}. Planned but processing no data today: ${namesOf(plannedSubprocessors())}. What each one does and where is on the “About us” page. For the providers we use, we are liable to you as for our own acts, in accordance with the law. We are not liable for third-party services that you choose and connect yourself, such as your Google account, which are governed by their own terms.`,
    ] },
    { h: 'Artificial intelligence, not professional advice', part: 'E. What we guarantee and our liability', p: [
      'Calculations (taxes, yields, costs) and the answers to your questions to Noa are supportive and indicative. They do not constitute tax, legal, accounting, insurance or investment advice. For binding decisions, always consult the appropriate professional (accountant, lawyer, notary, insurance or investment adviser) or the competent authority.',
      `The no-subscription plan does not include questions to Noa and has a monthly limit on document scans; on subscriptions, scanning has no monthly limit, apart from a per-minute limit against automated abuse. During the trial and in months without charge (months from the invitation program, partner status), scanning is limited to ${TRIAL_SCANS_PER_MONTH} documents a month. Each subscription includes a set number of questions to Noa per day and per month. The limit is in line with the subscription and is shown in the plan comparison within the app; accounts on trial, and those with a temporarily higher level without charge (months from the invitation program, partner status), have a lower limit. When it runs out, questions renew in the next cycle and all other features continue normally. We reserve the right to adjust the limits if the provider’s cost changes significantly, with prior notice. Reducing a limit is a change to the Service: the section “The Service” applies, including your right to terminate the contract without charge.`,
    ] },
    { h: 'Availability and maintenance', p: [
      'We make every reasonable effort to ensure high availability. There may be scheduled or unscheduled interruptions for maintenance or technical reasons; we announce scheduled ones in advance within the app where feasible.',
    ] },
    { h: 'Conformity of the Service and your remedies', p: [
      'Greek Law 4967/2022, which transposed Directive (EU) 2019/770 on contracts for the supply of digital content and digital services, sets out what we owe and what you are entitled to. We do not rely on an “as is” clause.',
      'We must provide a Service that matches its description, is fit for the purposes for which similar services are used, comes with the instructions and support you can reasonably expect, and is kept up to date so that it does not lose conformity for as long as your subscription lasts. These updates are part of the subscription and are not charged separately.',
      'If the Service is not in conformity, you first ask us to bring it into conformity, at no cost to you and within a reasonable time. If we do not, if that is impossible or if the lack of conformity recurs, you are entitled to a proportionate price reduction for the period in which the Service did not work properly, or to terminate the contract with a refund of the corresponding amount. In a serious lack of conformity you may terminate directly. On termination we return your data in a readable format, as the law requires and as you can already do yourself with one button.',
      'These guarantees concern the functioning of the Service. We do not guarantee the tax or financial outcome of your decisions, nor the content of calculations as advice: the section “Artificial intelligence, not professional advice” explains this.',
    ] },
    { h: 'Limitation of liability', p: [
      'We are liable for damage caused by our own fault, in accordance with the law. We keep a daily backup and, if data is lost through a fault of ours, we restore it from the latest one.',
      'If you use the Service as a professional, we are not liable for indirect or consequential loss or for loss of profit, except in cases of intent or gross negligence.',
      'No limitation in these Terms excludes or limits our liability for intent or gross negligence (Article 332 of the Greek Civil Code), or your rights as a consumer under Greek Laws 2251/1994 and 4967/2022. All limitations of liability in these Terms apply subject to mandatory law.',
    ] },
    { h: 'Indemnity', p: [
      'If you use the Service as a professional, you agree to indemnify us against third-party claims arising from unlawful or contract-breaching use of it, in particular from entering their data without a legal basis.',
    ] },
    { h: 'Transfer of the Service', p: [
      'In the future the Service may, in whole or in part, be transferred to another natural or legal person, by sale, contribution or another form of transfer. In that case your contract, your subscription and your data pass to the successor, which is bound by these Terms and by the Privacy Policy as in force at the time of the transfer.',
      'We will inform you in good time and in any case before the transfer takes effect in respect of your data, within the app and by message to your address. If you do not wish to continue with the successor, you can terminate the subscription and download all your data with one button, as you can today; any prepaid and unearned amount is refunded pro rata.',
      'You may not assign your contract or your account to a third party without our consent. The account is personal and is linked to the property data and third-party data you have entered.',
    ] },
    { h: 'Force majeure', p: [
      'We are not liable for failure to perform caused by an event that is unforeseeable and unavoidable even with the utmost care, such as a natural disaster, war, a general internet outage or an act of public authority. A failure of a provider we use is not in itself force majeure. If the failure continues, you may terminate the contract without charge and you are refunded the corresponding prepaid price for the period you did not use. All this applies subject to mandatory law and your rights as a consumer (Greek Law 2251/1994).',
    ] },
    { h: 'Complaints and out-of-court resolution', part: 'F. If something goes wrong', p: [
      `Before any other step, write to us at ${support}. We reply to every complaint without delay and within fourteen (14) days at the latest, with a reasoned position: what we found, what we propose and by when.`,
      'If we do not agree, as a consumer you can turn to the Hellenic Consumer Ombudsman (synigoroskatanaloti.gr), an independent authority that mediates at no cost to you. For a cross-border dispute, the European Consumer Centre Greece (eccgreece.gr) does the same.',
      'The European Online Dispute Resolution (ODR) platform, to which most websites used to refer, ceased operating on 20 July 2025 under Regulation (EU) 2024/3228.',
    ] },
    { h: 'Point of contact and notice of illegal content', id: 'anafora', p: [
      `The single point of contact, for authorities and for users, under Articles 11 and 12 of Regulation (EU) 2022/2065 on digital services, is ${IDENTITY.supportEmail}. You can write to us in Greek or in English.`,
      'If you find content in the Service that you consider illegal, write to us at the same address (Article 16 of the Regulation). Say exactly where the content is, why you consider it illegal, your name and email, and that the notice is made in good faith. We acknowledge receipt, examine the notice without undue delay and objectively, and inform you of our decision.',
      'We do not monitor the content users store in advance and we do not use automated means to review it or decide on it. If we restrict content or suspend an account, the statement of reasons in the section “Suspension and termination” applies.',
    ] },
    { h: 'Suspension and termination', p: [
      `We may suspend or terminate your account, or restrict content you stored, in the event of a material breach of the Terms or if the content is illegal, with prior notice where feasible. We send you by email, at the latest when the restriction takes effect, a clear and specific statement of reasons: what we restricted and for how long, the facts, the provision of the Terms or of the law we rely on, and whether the decision followed a notice from a third party. You can contest it by writing to ${IDENTITY.supportEmail}, without losing your right to go to court. You may also delete your account at any time.`,
      'Deleting your account also cancels your subscription: no further charge is made. The period you have already paid for is not refunded pro rata, beyond what the law provides and the refund commitment for businesses in the section “Right of withdrawal”.',
    ] },
    { h: 'Changes to the Terms', p: [
      'We may update the Terms. For material changes we notify you before they take effect and tell you what changes. If you do not agree, you terminate the contract at no cost, download your data and receive a refund of the corresponding amount for the period you did not use.',
    ] },
    { h: 'Governing law and jurisdiction', p: [
      'These Terms are governed by Greek law. The courts of Greece have jurisdiction over any dispute. As a consumer you keep the right to bring proceedings in the courts of your place of residence as well, where the law provides for it.',
    ] },
    { h: 'Other provisions', p: [
      'If any provision is held invalid, the rest remain in force. You may not assign your rights without our consent. These Terms, together with the Privacy Policy, constitute the entire agreement between us.',
    ] },
  ];
}

export const termsDisclaimerEn = (): string => identityIsPublished()
  ? 'Note: These Terms have been drawn up in accordance with Greek and European consumer protection law. The operator’s full details are on the “About us” page.'
  : `Note: These Terms have been drawn up in accordance with Greek and European consumer protection law. ${identityPendingEn()} They will be published on the “About us” page; until then, for any matter, write to ${IDENTITY.supportEmail}.`;
