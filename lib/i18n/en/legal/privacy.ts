// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΟΛΙΤΙΚΗ ΑΠΟΡΡΗΤΟΥ ΣΤΑ ΑΓΓΛΙΚΑ: ΜΕΤΑΦΡΑΣΗ ΓΙΑ ΔΙΕΥΚΟΛΥΝΣΗ, ΟΧΙ ΝΕΟ ΚΕΙΜΕΝΟ
// ─────────────────────────────────────────────────────────────────────────
// Πιστή μετάφραση του app/privacy/page.tsx, ενότητα προς ενότητα και με την
// ίδια σειρά. Δεσμευτικό είναι το ελληνικό κείμενο και η σελίδα το λέει στην
// κορυφή. Οι αριθμοί (ημέρες, όρια, εκδόσεις) και οι πάροχοι έρχονται από τις
// ΙΔΙΕΣ πηγές με το ελληνικό, ώστε οι δύο εκδοχές να μη διαφωνήσουν ποτέ σε
// αριθμό. Δεν ζει στο docs/legal/** (προστατευμένο).
//
// ΜΙΑ ΣΚΟΠΙΜΗ ΑΠΟΚΛΙΣΗ ΔΙΑΤΥΠΩΣΗΣ: το ελληνικό «δωρεάν πακέτο» αποδίδεται
// «the no-subscription plan», με τον κανόνα του προϊόντος για τη λέξη «free»
// δίπλα σε πακέτο. Το περιεχόμενο είναι το ίδιο.
// ═══════════════════════════════════════════════════════════════════════════
import type { LegalSection } from '@/app/legal-shell';
import { IDENTITY, identityIsPublished, POLICY_VERSION } from '@/lib/legal/identity';
import { activeSubprocessors, plannedSubprocessors, BACKUP_RETENTION_DAYS } from '@/lib/legal/subprocessors';
import { SCAN_LIMITS, TRIAL_SCANS_PER_MONTH } from '@/lib/billing/aiLimits';
import { billingWordsEn } from '@/lib/legal/billingWords';
import { LIFETIME_DAYS as PORTAL_LINK_DAYS } from '@/lib/data/portal';
import { LIFETIME_DAYS as CHECKIN_LINK_DAYS } from '@/lib/data/checkinLink';
import { ACCOUNTANT_LINK_DAYS } from '@/lib/data/accountantLink';
import { ACCOUNTANT_INVITE_RETENTION_DAYS } from '@/supabase/functions/_shared/accountantInvite';
import { FIRM_ACCESS_LOG_MONTHS, FIRM_UNDO_DAYS } from '@/lib/legal/firms';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/i18n/locale';
import { identityPendingEn, subprocessorLineEn, subprocessorNameEn, TRANSFER_SAFEGUARDS_EN } from './common';

export const PRIVACY_EN = {
  title: 'Privacy Policy',
  metaTitle: 'Privacy Policy · PROPERWISE',
  description: 'What data PROPERWISE collects, why, where it is stored, who processes it and what rights you have.',
  intro: 'What data we collect, for what purpose, on what legal basis, who we share it with and what rights you have. Written under the General Data Protection Regulation (GDPR, Regulation (EU) 2016/679) and Greek Law 4624/2019.',
  version: POLICY_VERSION,
};

export function privacySectionsEn(): LegalSection[] {
  const words = billingWordsEn();
  const mail = IDENTITY.privacyEmail;
  return [
    { h: 'Data controller', part: 'A. Who we are', p: [
      identityIsPublished()
        ? `The controller of the data described here is ${IDENTITY.legalName}, at ${IDENTITY.address}, tax number (AFM) ${IDENTITY.afm}, which operates the “${IDENTITY.tradeName}” service (“we” or “the Service”). Full identity details are published on the “About us” page.`
        : `The controller of the data described here is the operator of PROPERWISE (“we” or “the Service”). ${identityPendingEn()} They will be published on the “About us” page; until then, for any personal data matter, write to ${mail}.`,
      `For any matter about your personal data, or to exercise your rights, write to us at ${mail}. Where your data is stored and who processes it is also set out on the “About us” page.`,
      `We have not appointed a Data Protection Officer (DPO). Article 37 GDPR requires one where the core activity consists of large-scale systematic monitoring or the processing of special categories of data, and neither describes the Service. If that changes, we will appoint a DPO and publish their details here. Until then, the point of contact for any personal data matter is ${mail}.`,
    ] },
    { h: 'What data we collect', part: 'B. What we collect and why', labelled: true, p: ['We collect the data needed to provide the Service, in the following categories:'], list: [
      'Account details: email address, full name and password in encrypted (hashed) form, through the authentication provider Supabase Auth. We never see your password in plain text.',
      'Property data you enter: property details (address, floor area, value), expenses, bills, tenant details, leases, and documents and photos you upload. Some of these (e.g. a tenant’s tax number (AFM), lease details) may concern third parties; see the section “Third-party data you enter”.',
      'Billing details in your Account, optional: document type, country, full name, business name, tax number (AFM) or EU VAT number, and phone. They are used to show the VAT treatment that applies to you and to prefill the owner’s details when you add a property. The details for the subscription receipt are given at checkout.',
      `Subscription payment details: ${words.cardData}`,
      'Data you give to Noa, the app’s artificial intelligence: the questions you type or dictate and the documents or photos you scan, so that you get an answer or an automatic entry (see the section “Artificial intelligence (AI)”).',
      'Notification details: your browser’s notification subscription (a device identifier), if you turn on “Notifications on this device”.',
      'Security activity log: password changes, enabling two-step verification, sign-outs, changes to team members. You can see it yourself in your Account.',
      'Contribution to community data: only if you turn it on yourself under “Account” · “Data and privacy”, basic figures about your properties (area, type, floor area, price) contribute anonymously to aggregate market statistics. The switch is off by default; we record when you turned it on, so that consent can be demonstrated (Article 7(1) GDPR), and you can turn it off whenever you like.',
      'Technical and usage data: the sign-in session cookies (Supabase), preferences kept in your browser’s local storage (localStorage) and basic technical logs for security and stability (see the section “Cookies and similar technologies”).',
    ] },
    { h: 'Which details are mandatory', p: [
      'Article 13(2)(e) GDPR requires that you know which data you must provide and what happens if you don’t. Mandatory, in the sense that the contract cannot be performed without them, are only your email address and password: without them there is no account.',
      'Everything else you provide because it serves you, and declining has no consequence beyond the corresponding feature having nothing to work with: without a property there is no yield, without a lease there are no reminders, without a question there is no answer from Noa. Your account stays active and your data accessible in every case.',
    ] },
    { h: 'Purposes of processing and legal basis', labelled: true, p: ['We process your data for the following purposes, on the corresponding legal bases of Article 6 GDPR:'], list: [
      'Providing the Service and managing your account: performance of a contract (Article 6(1)(b)).',
      'Billing and collecting subscriptions: performance of a contract and compliance with a legal obligation (Article 6(1)(b) and 6(1)(c)).',
      'Security, fraud prevention, stability and improvement of the Service: legitimate interest (Article 6(1)(f)).',
      'Artificial intelligence (Noa, document scanning): performance of a contract, because you use them at your own request (Article 6(1)(b)).',
      'Updates about PROPERWISE features: consent (Article 6(1)(a) GDPR). You receive them only if you tick their own box at sign-up, which starts unticked and is separate from the market newsletter. You can stop them at any time from the unsubscribe link in every message. We do not send third-party advertising messages.',
      'Property market newsletter: consent (Article 6(1)(a) GDPR), with its own separate box at sign-up, which starts unticked. You can stop it from the unsubscribe link in every message, separately from the feature updates.',
      'Market statistics from community data: consent (Article 6(1)(a)), only if you have turned on your contribution.',
      'Cookie-free traffic measurement: legitimate interest in improving the Service (Article 6(1)(f)). Details in the section “Cookies and similar technologies”.',
      'Recording your account’s key steps and sign-in dates, for aggregate weekly counts: legitimate interest in knowing whether the Service is useful (Article 6(1)(f)). Details in the section “Cookies and similar technologies”.',
      'Access and records of an accounting firm you authorized: performance of a contract (Article 6(1)(b)). Access history and activity log of the firm: legitimate interest (Article 6(1)(f)).',
      'Daily encrypted backups: legitimate interest in the availability and integrity of the Service (Article 6(1)(f)), so that your data is not lost through a fault or a mistake.',
    ] },
    { h: 'Third-party data you enter', p: [
      'When you enter details of third parties (e.g. tenants or partners), you act as the party responsible for collecting them lawfully. You must have a legal basis and, where required, have informed those persons. We process this data solely on your behalf, so that the Service works. The terms of this processing are the “Processing agreement for third-party data” in the Terms of use, which you accept before the first time you save a tenant’s details.',
    ] },
    { h: 'Public portals (tenant, guest, accountant)', labelled: true, p: [
      'The Service provides “portal” links that need no account, which you create and share yourself:',
    ], list: [
      'Tenant portal: a link you give your tenant, with a PIN if you set one. The tenant sees the rent due and the payment method you set, reports a payment and sends a maintenance request, with photos if they wish. Only you see what they send. You are the controller towards them; we act on your behalf.',
      'Guest pre-arrival portal (pre-check-in): your guest fills in their stay details (full name, ID card or passport number, nationality, date of birth) and, if they wish, phone and email. The details the law requires for the stay declaration are requested by you as host, to fulfil your legal obligation (Article 6(1)(c) GDPR). Phone and email are optional and are given with the guest’s consent (Article 6(1)(a)), for communication about the booking. Their confirmation is recorded with a timestamp and only you see the details. You are the controller towards the guest; we act on your behalf.',
      'Accountant portal: a read-only link you give your accountant. It shows, by property and by year, itemised expenses (category, amount, date), stays (dates, nights, turnover), the current monthly rent, the address and the ATAK property number. It does not expose names or contact details of tenants, clients or guests. If your accountant has a firm account, see also “Accounting and tax firms”.',
      'Calendar link: a private address you add yourself to the calendar on your phone or computer. It shows, read-only, the deadlines of your properties (events, bills falling due, rent installments, pending items). Anyone with the address sees these deadlines, without being able to change anything.',
      `You can revoke the accountant link and the calendar link at any time from within the app; the old one stops working immediately. Each link also expires automatically: tenant portal ${PORTAL_LINK_DAYS} days, guest check-in ${CHECKIN_LINK_DAYS} days, accountant ${ACCOUNTANT_LINK_DAYS} days; the calendar link also expires automatically, after a longer period. To revoke a check-in or tenant portal link immediately, write to us.`,
    ], note: 'Each link has a unique code that cannot be guessed and shows only the data for its purpose, nothing from other accounts.' },
    { h: 'Invitation program (referrals)', p: [
      'The Service offers an optional invitation program. You get a personal link and code and, if you wish, share it with other owners or with your clients. You only share a link: you do not give us, and we do not store, third parties’ contact details on your behalf.',
    ], list: [
      'When someone signs up through your link, we record the “who referred whom” relationship and when the new account was activated (added a property and scanned a document), so that the reward is credited correctly and abuse is prevented.',
      'As the referrer, you see only an anonymous progress view: how many of your invitations are pending and how many were activated. You do not see a name or email, or whether a specific person became a paying subscriber or a professional. Any detailed figures are shown only in aggregate, with no link to a specific person.',
      'Legal basis: performance of a contract for crediting the reward (Article 6(1)(b)) and legitimate interest in preventing abuse (Article 6(1)(f)). The legitimate interest assessment is documented in the record of processing activities we keep.',
      'You can export your own referral data to an Excel sheet from the program’s tab. Deleting your account deletes it too; if the account of the person who referred you is deleted, the link to you is disconnected.',
    ], note: 'Rewards are subscription months or extra property slots without charge, not an automated decision with legal effects (Article 22 GDPR). The QR code for your link is generated locally on your device, with no external call or data transfer.' },
    { h: 'Access requests from an accountant or other professional', labelled: true, p: [
      'A professional with an account on the Service (usually an accountant) can send, through the Service, a request for access to the property file of people they know, by entering their email address. If you received such a message, the following applies:',
    ], list: [
      'What we keep: the email address the sender entered, who entered it, when, and the status of the request (pending, accepted, “No”, withdrawn). Nothing else about you. The sender does not learn whether you have an account and sees none of your data before you accept.',
      'Purpose and legal basis: sending the request and keeping your answer, based on the sender’s legitimate interest in contacting you about your property file (Article 6(1)(f)).',
      `Retention: if you do not reply, your address is erased from invitations after ${ACCOUNTANT_INVITE_RETENTION_DAYS} days. If you answer “No” from an account, we keep it so that you do not receive another request from the same sender, until you delete your account.`,
      `Objection without an account (Article 21): reply to the message or write to ${IDENTITY.supportEmail} or ${mail}. From then on you will not receive a request from any sender. Your address is erased from invitations and the message queue, and we keep only a cryptographic fingerprint of it (SHA-256). The fingerprint is pseudonymised personal data (not anonymous) and we keep it indefinitely as proof of your objection, so that we can honour it (Articles 17(3) and 21).`,
      'If you accept: the sender and their firm see your file at the level you set, which starts at “Read only”, and you can revoke access whenever you like (see “Accounting and tax firms”).',
    ] },
    // Μετάφραση των ενοτήτων «Λογιστικά και φοροτεχνικά γραφεία» και «Αν είσαι
    // μέλος…» του app/privacy/page.tsx. Ιδιες σταθερές (lib/legal/firms.ts).
    { h: 'Accounting and tax firms', id: 'grafeia', labelled: true, p: [
      'Your accounting or tax firm may hold a firm account on the Service with several members. It can view or record anything in your account only if you grant it access (through the accountant link or by accepting its request) and only at the level you choose. The following applies:',
    ], list: [
      'Who sees your data: a firm has three roles. The Firm manager sees all the firm’s clients. The Accountant and the Associate see only the clients the Firm manager has assigned to them. The Associate can only read, at every level. Every firm member can use the firm’s features only after completing a second authentication step. Under “Account” you can see which firm has access, which of its members actually see you, at what level and when you were last opened.',
      'What the firm sees: everything the “Accountant portal” shows (see “Public portals”) plus your full name and tax number (AFM) from your billing details, how many expenses, receipts and stays you have per year, document requests and the E2 packages.',
      'Three levels, which you set for each firm: “Read only”, which applies if you choose nothing. “Upload receipts”: the firm uploads PDF files or images (JPG, PNG) to the folder of a property you already have. “Bookkeeping on my behalf”: the firm may also record tenants, paid bills, rent receipts and expenses and mark instalments that already exist as paid, always on properties you already have. At no level can the firm add or delete a property, change your settings or subscription, or touch records made by you or by another firm. Each record made by the firm shows which firm and which member it came from.',
      'What we log: so that you know who saw and who changed what, we keep two logs. The access history: which firm and which member, which action (opening, export, request, upload, record) and when. The activity log: every new record, change, deletion or payment mark made by the firm, with its type, which fields changed and a short title of the record. It does not keep the values of the fields or any amounts; for a tenant it does not keep even a title. When you delete a record, its title is also removed from the log. The names of the firm and the member are written as they were at the time of the action. No one can alter the logs through the app.',
      'Who sees the logs: you, for your own account. A member sees their own entries and the Firm manager sees all of the firm’s entries. The firm sees the activity log only while it still has access to you; it continues to see the access history after revocation. Both are included in the “Export everything” of your account.',
      `Undo: you see a summary of each day per firm and can undo, in one step, all of a firm’s records for a given day. Anything you changed in the meantime stays as you left it. For the undo we keep each record as it was before and after each action, in storage that no one can read through the app. That copy is deleted together with the record or your account and in any event after ${FIRM_UNDO_DAYS} days, so the undo is available within that period.`,
      `When access ends: immediately, when you revoke the firm, when you deactivate or renew the accountant link, when the link expires (after ${ACCOUNTANT_LINK_DAYS} days), when the firm removes the member or your assignment and when it removes you from its clients. Every read checks, at that moment, the person, the role, the assignment and the link. When you revoke a firm or a member leaves, the accountant link is renewed automatically: others who have access through an account keep it, while copies of the old link stop opening. Records made by the firm remain in your account, with their origin, until you change or delete them yourself.`,
      `How long we keep the logs: the access history for ${FIRM_ACCESS_LOG_MONTHS} months from the action. The activity log for as long as your account exists. Both are deleted when you delete your account. They are not deleted if the firm closes or the member’s account is deleted, so that you always know who did what in your account.`,
      'Tenant details entered by the firm: your firm may also enter your tenants’ details, as a processor on your behalf. Even then you remain the controller and you inform the tenant about the processing (Article 14 GDPR). You see every tenant the firm added in the daily summary.',
      'Special categories of data: neither you nor the firm uploads or records special categories of data (Article 9 GDPR), such as health data, unless they are necessary for a legal tax obligation. When they are found without being needed, they are deleted: you delete the document or the record and the firm that finds them notifies you without delay.',
      'Legal basis: the firm’s access and its records happen because you asked for them, through a feature of the Service: performance of a contract (Article 6(1)(b)). The logs are kept so that you can check what happened in your account and undo mistakes and for the security of the Service: legitimate interest (Article 6(1)(f)). For your tenants’ data you remain the controller; for what it records in your account, the firm acts as a processor on your behalf (see “Processing agreement for third-party data” in the Terms of Use).',
    ] },
    { h: 'If you are a member of an accounting or tax firm', labelled: true, list: [
      'What we keep about you: your account details, as for any user. The firm you belong to, your role, when you were invited, when you joined and when you left. Which clients were assigned to you. The access history and the activity log described above.',
      'Who sees it: the members of your firm see your name, email and role. The Firm manager also sees the whole access history and all the firm’s actions. A client sees your name and role if you have taken on their file and whatever you did in their account. You see your own history and your own actions.',
      'Acceptance of the terms: before you see any client, you accept the terms of the section “Accounting or tax firm account” of the Terms of use. We keep the version and date of your acceptance; for the Firm manager, also of the acceptance on behalf of the firm.',
      'Second step: while you are an active firm member, the firm’s features and clients’ files open only after you complete the second authentication step.',
      'One firm at a time: you belong to only one active firm at any time. A firm account holds no properties of your own; if you have some, you join the firm with a different email address.',
      'Leaving: you may leave the firm whenever you like, unless you are its only Firm manager, in which case you first appoint another.',
      'Legal basis: for your account, performance of a contract (Article 6(1)(b)). For logging what you viewed and recorded in a client’s account, the legitimate interest of the client in checking who has access to their data and of the firm in checking the work done in its name (Article 6(1)(f)). You may object (Article 21) on grounds relating to your particular situation.',
      'Deleting your account: your account details, your membership of the firm and your assignments are deleted. Your name remains in clients’ logs as it was at the time of each action, for as long as those logs are kept, so that the client knows who did what in their account.',
      'Export: with “Export everything” you receive what you did and when, without what you wrote in clients’ files, which belongs to them.',
    ] },
    { h: 'Artificial intelligence (AI)', p: [
      'When you use Noa or automatic document reading, we send the AI provider (Anthropic, United States):',
    ], list: [
      'your question',
      'the financial and technical details of your properties, itemised expenses and rents',
      'up to 50 of your clients or guests, with full name, stay history, revenue, damage, budget, needs and the note from the last stay',
      'the name and trade of up to 60 of your contacts (technicians, providers)',
      'the documents and photos you scan',
    ], after: [
      'The myAADE import (adding properties in bulk from the E9 or the ENFIA assessment) reads the PDF file only on your device. The file is not sent and not stored. If you upload a photo of the document instead of the PDF, the photo is sent through our server to the AI provider, as with document scanning, so that the properties can be read; the photo is not stored. We keep only the details you confirm (properties and, from the assessment, the ENFIA amount). The tax number (AFM) on the document is not stored. To support undo and the daily limit, we keep the fact that the import happened, with nothing from the file’s content.',
      'The phone numbers and tax numbers (AFM) of your clients and contacts are not sent to the AI provider; the provider sees only whether they exist. If you type a number in your question yourself, it goes with the question, and the app sends only the name of the person it matches. This is also third-party data; if you do not want it transferred, do not use Noa or document scanning.',
      'We do not use your data to train models. The AI provider is contractually bound not to train models.',
      'AI answers are supportive and indicative. No automated decisions producing legal effects for you, within the meaning of Article 22 GDPR, are made; every action stays under your control and you can correct it.',
      `Each subscription includes a set number of questions to Noa per day and per month, in line with the subscription; the no-subscription plan does not include them and accounts on trial have a lower limit. Document scans are counted separately: ${SCAN_LIMITS.free} a month on the no-subscription plan, ${TRIAL_SCANS_PER_MONTH} a month on the trial and in months without charge (months from the invitation program, partner status), with no monthly limit on paid subscriptions. When the limit runs out, the app tells you and questions renew in the next cycle. Depending on the question, a different model from the same provider is used: the choice concerns speed and cost, not which data is transferred.`,
    ] },
    { h: 'Recipients and processors', part: 'C. Where it goes, how long it stays, how it is protected', p: [
      'We do not sell your data. We share it only with the providers below, and the role of each is stated. A processor acts only on our behalf and on our instructions. An independent controller decides for itself about the data it receives, and its own privacy policy applies to that data.',
    ], list: [
      ...[...activeSubprocessors()].sort((a, b) => Number(a.role !== 'processor') - Number(b.role !== 'processor')).map(subprocessorLineEn),
      `Planned but not active today, meaning they process no data: ${plannedSubprocessors().map(subprocessorNameEn).join(', ')}.`,
      'No external service for QR codes: every QR (payment link, contact card, inventory label) is generated locally on your device.',
    ], after: [
      'Before we add a new provider, we notify you by email.',
    ], note: 'The same list appears on the “About us” page. We may also disclose data where required by law, a competent authority or a court.' },
    { h: 'International transfers', p: [
      'The system of record (database, authentication, files) is inside the European Union, in Frankfurt. However, Supabase’s contracting entity, which runs it, is a company based in Singapore (Supabase Pte. Ltd), so its access to the database for operation and technical support may take place outside the European Economic Area. Some providers also process data in the United States: the encrypted backup, questions to Noa, sending email, and hosting and delivering the app.',
      TRANSFER_SAFEGUARDS_EN,
      `Article 13(1)(f) GDPR gives you the right to see the safeguards themselves, not just to learn that they exist. Ask for them at ${mail} and we will send you a copy of the Clauses for each provider, redacting only commercial terms that do not concern the protection of your data.`,
    ] },
    { h: 'Retention', labelled: true, p: ['We keep your data only for as long as necessary:'], list: [
      'Account and property data: for as long as your account exists.',
      words.lapsedRetention,
      `After your account is deleted: the data is deleted from the database immediately. The encrypted backups that contain it are deleted automatically within ${BACKUP_RETENTION_DAYS} days.`,
      'Guest check-in details: for as long as the property they belong to exists; they are deleted with the property or with your account.',
      'Maintenance requests from the tenant portal: for as long as the property exists; they are deleted with it or with your account.',
      'Security activity log: at the latest until your account is deleted.',
      'Email preferences and unsubscribes: for as long as your account exists, so that we do not send you again what you stopped; they are deleted with it.',
      'Data needed for tax and accounting records: kept for as long as tax law requires.',
      'Invitation program data (the “who referred whom” relationship, rewards): for as long as your account exists, and deleted with it.',
      `Access requests from a professional: the address of anyone who did not reply is erased after ${ACCOUNTANT_INVITE_RETENTION_DAYS} days; the fingerprint of an objection stays as proof of it (see the section “Access requests from an accountant or other professional”).`,
      `Accounting firms: the access history for ${FIRM_ACCESS_LOG_MONTHS} months from the action and the activity log for as long as the client’s account exists; the undo’s before/after copy for at most ${FIRM_UNDO_DAYS} days. The membership of a member who left or was removed (email, role, dates) is kept at most for as long as the firm exists and is deleted earlier if the member deletes their account (see “Accounting and tax firms”).`,
    ] },
    { h: 'Data security', p: [
      'We apply appropriate technical and organizational measures: encryption in transit (TLS), data isolation through Row Level Security at the level of the database itself, so that each account sees only its own data (and, if you work with a team, only what you have explicitly shared with its members; likewise for an accounting firm, which sees and writes only what the level you set allows, with the check made in the database itself), access control and regular backups. Although no method is completely invulnerable, we work continuously to protect your data.',
    ] },
    { h: 'Data breaches', p: [
      'If a personal data breach occurs, we notify the Hellenic Data Protection Authority (HDPA) without undue delay and, where feasible, within 72 hours of becoming aware of it, unless the breach is unlikely to result in a risk to your rights and freedoms. If it is likely to result in a high risk, we also inform you without undue delay (Articles 33 and 34 GDPR).',
    ] },
    { h: 'Your rights', part: 'D. What you can do', labelled: true, p: ['Under the GDPR you have the following rights:'], list: [
      'Access: you learn what data we hold about you and how we process it.',
      'Rectification: you correct inaccurate or incomplete data yourself. Your full name can be changed once a month, for security reasons; if you need a correction sooner, write to us and we will make it without delay.',
      'Erasure (“right to be forgotten”): under the conditions of the law, by permanently deleting your account from within the app.',
      `Restriction of processing: write to us at ${mail} and we will reply within one month at the latest.`,
      'Portability: you download all your records in one JSON file at any time from “Account” · “Data and privacy” · “Export everything”. Most tabs also offer an Excel export, and you download uploaded files from the Property File.',
      'Objection (Article 21 GDPR): you may object, on grounds relating to your particular situation, to processing based on our legitimate interest (security and improvement of the Service, traffic measurement, backups, preventing abuse of the invitation program, access requests from a professional, access history and activity log of an accounting firm). Newsletters rely on consent, which you can always withdraw without giving a reason: the unsubscribe link in every message is enough.',
      'Withdrawal of consent: where processing relies on it, with no retroactive effect. Contribution to community data is off by default and only you turn it on, with a switch under “Account” · “Data and privacy”, where you can also turn it off whenever you like. We record when you turned it on, so that it can be shown that consent was given by you.',
    ], note: 'You exercise access, portability, rectification, erasure and withdrawal of consent yourself, under “Account” · “Data and privacy”. For anything else write to us: we reply without delay and within one month at the latest, as Article 12(3) GDPR requires.' },
    { h: 'Right to lodge a complaint with the HDPA', p: [
      'If you believe that the processing of your data breaches the law, you have the right to lodge a complaint with the HDPA (Article 77 GDPR): 1-3 Kifisias Avenue, 115 23 Athens, Greece, tel. +30 210 6475600, website www.dpa.gr.',
    ] },
    { h: 'Cookies and similar technologies', part: 'E. Details you should know', p: [
      `We use only cookies that are necessary for what you ask for. If you change language with the language switcher, a “${LOCALE_COOKIE}” cookie stores your choice (Greek or English); it expires after ${LOCALE_COOKIE_MAX_AGE / 86400} days and is read only by our own server, to show you the language you chose.`,
      'The rest are the sign-in session cookies, prefixed “sb-”. They are set by the authentication provider (Supabase), keep you signed in, are deleted when you sign out or the session expires, and are not read by third parties. The session may be split across more than one cookie because of its size, and signing in with Google adds a temporary one, for the security of the return. They are strictly necessary for the service you request, so Article 4(5) of Greek Law 3471/2006 does not require consent: without them you cannot stay signed in.',
      'Your browser’s local storage (localStorage) also holds: display and screen preferences (e.g. light or dark theme), the optional history and memory of your conversations with Noa, recent searches, calculation drafts, which reminders you dismissed, a visit counter for the app install prompt and the indication that you have seen this notice. They do not leave the device. We do not use third-party advertising cookies or pixels, analytics cookies or any marketing tracking. That is why the notice you see on your first visit does not ask you to choose: it informs you and closes, because there is nothing to reject.',
      'To know what works and what doesn’t, we measure traffic with Vercel Web Analytics. It works without cookies and stores nothing on your device. To tell apart visits on the same day, the provider forms a hash from details of your browser’s request, which is valid only for that day and is then discarded, so your visit is not linked to other days or other websites. We see only aggregate figures (how many views a page had, from which country or device, from which link the visitor arrived), never who you are. The legal basis is our legitimate interest in improving the Service (Article 6(1)(f) GDPR) and you can object (see “Your rights”). In our assessment, because the measurement neither stores nor reads information on your device, Article 4(5) of Greek Law 3471/2006 does not require consent. Pages with a secret in their address (tenant, accountant or document verification links) are excluded from measurement entirely. From the address, only the page is sent and, where present, the five utm_ campaign parameters (which post the visitor came from); no other parameter. On the sign-up page we additionally keep, in our own database, only daily counters: how many times each sign-up step happened, from which source category (e.g. Instagram, search), from inside an app or not, and from a phone or not. We keep no row per visitor, IP address, identifier or cookie, so no number can be linked to a person.',
      'To know whether the Service is useful, we record in our own database which key steps your account took (e.g. added a property, produced a report) and when you signed in, without amounts, names or other content. We use them only in aggregate, as weekly counts. Legal basis: legitimate interest (Article 6(1)(f) GDPR). They are deleted with your account.',
    ] },
    { h: 'Minors', p: [
      'The Service is intended for adult property owners and small offices. The Terms of use require an age of at least 18 and legal capacity, so we do not create accounts for minors.',
      'An exception you should know about: the guest pre-arrival form may record details of minors accompanying the guest, as the stay declaration requires them. The host who created the link is responsible for its lawfulness.',
    ] },
    { h: 'Business transfer', p: [
      'If the Service is transferred to another natural or legal person (by sale, contribution or another form of transfer), the personal data we hold forms part of the transferred assets and passes to the successor. The legal basis is our legitimate interest in the continuity of the business and of the Service we provide to you (Article 6(1)(f) GDPR).',
      'The successor is bound to comply with this Policy for the data it receives. It may not use the data for a purpose incompatible with the one for which it was collected without informing you again and, where required, obtaining your new consent.',
      'You will be informed before the transfer takes effect in respect of your data, within the app and by message to your address. Until then, and at any time, you can download all your data or permanently delete your account with one button from your Account.',
    ] },
    { h: 'Changes to this policy', p: [
      'We may update this Policy. Every change updates the version and the date at the top of this page. For material changes we inform you before they take effect and tell you what changes.',
    ] },
    { h: 'Contact', p: [
      `For questions about this Policy or the processing of your data, write to us at ${mail}. Your messages are read and answered by a person.`,
    ] },
  ];
}
