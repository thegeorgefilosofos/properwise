// npx tsx supabase/functions/_shared/messageLang.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΜΗΝΥΜΑΤΑ ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ: ΤΑ ΕΛΛΗΝΙΚΑ ΜΕΝΟΥΝ ΙΔΙΑ ΩΣ ΤΟ BYTE
// ─────────────────────────────────────────────────────────────────────────
// Κάθε πρότυπο αποδίδεται με σταθερά δεδομένα δύο φορές:
//   · στα ελληνικά το αποτύπωμα (sha256) πρέπει να είναι ΑΚΡΙΒΩΣ αυτό που
//     έδινε ο κώδικας πριν μπουν τα αγγλικά (καταγράφηκε πάνω στο main πριν
//     αλλάξει γραμμή)·
//   · στα αγγλικά το ορατό κείμενο δεν έχει ελληνικό γράμμα, εκτός από τα
//     κύρια ονόματα που εξηγούνται δίπλα τους (ΕΝΦΙΑ κ.λπ.) και ό,τι έγραψε ο
//     ίδιος ο χρήστης (τίτλος γεγονότος, όνομα ακινήτου).
// Αν αλλάξει σκόπιμα ελληνικό κείμενο, το αποτύπωμα ξαναγράφεται στο ίδιο PR
// και η αλλαγή φαίνεται στη διαφορά.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto'
import { FIXTURES } from './messageFixtures.ts'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16)

/** Τα αποτυπώματα των ελληνικών, από τον κώδικα πριν από τα αγγλικά. */
const EL_SHA: Record<string, string> = {
  'shell-default': '9e388bc251e41e01',
  'shell-unsub': '132a1c48fc98f7c4',
  'shell-footer': '22a4ec8a7d501cf9',
  'reminder-7days-1': '4acba30a0f7f085e',
  'reminder-7days-3': '9b5aaf8c1e8f55c8',
  'reminder-3days-1': '3f0cb23d3063191c',
  'reminder-3days-3': 'fe5e55eb67e3dddd',
  'reminder-1day-1': 'fdb5721f0a01cbda',
  'reminder-1day-3': 'fcc5b0a1344c5ab4',
  'reminder-today-1': '5838f741a4bef5ea',
  'reminder-today-3': 'c6d847e7c20f9324',
  'reminder-overdue-1': '21d3a1c94db3816c',
  'reminder-overdue-3': '3d5c4b7312f8e061',
  'dunning-1': '961b5ccb41d8f991',
  'dunning-2': 'd703ef3148a431f8',
  'dunning-3': '96fe596151c03257',
  'welcome-free': '25efdf2d1a3f97e8',
  'welcome-individual': '39b25fb6dcc05614',
  'welcome-professional': 'a5837f83c96fa5ac',
  'upgraded-solo': '8f68137f7f7081ce',
  'upgraded-owner': 'ee99725b1e98b902',
  'upgraded-agency': '8a8c9a408e5b38d6',
  'upgraded-office': 'bb60c91150b78913',
  'downgraded-free': '7f681cc779145366',
  'downgraded-owner': '6ebf7fba3188f1b8',
  'new-property': 'dc2e343ce7535787',
  'feedback': '4b7f0fd00f57328a',
  'mobile-launch': '65230bf96fdd4a8f',
  'referral': '5e895832e4aed51d',
  'upsell': 'd8dabc288181f470',
  'upsell-disc': '8ec84efad51b75f6',
  'legislation': 'b302f9dbd1b232c4',
  'seasonal': 'bb6bda879beef15e',
  'client-message': '19afea448e61dc7d',
  'client-message-anon': '413822d91f3f9bfc',
  // PR 2: οι υπόλοιπες συναρτήσεις άκρης και ο κατάλογος (από τον κώδικα πριν από τα αγγλικά).
  'welcome-free-en': '25efdf2d1a3f97e8',
  'welcome-individual-en': '39b25fb6dcc05614',
  'welcome-professional-en': 'a5837f83c96fa5ac',
  'upgraded-solo-en': '8f68137f7f7081ce',
  'upgraded-owner-en': 'ee99725b1e98b902',
  'upgraded-agency-en': '8a8c9a408e5b38d6',
  'upgraded-office-en': 'bb60c91150b78913',
  'downgraded-free-en': '6dd4e521c203e7bc',
  'downgraded-owner-en': '6ebf7fba3188f1b8',
  'new-property-en': 'b5bf493b9dbb5f94',
  'feedback-en': 'd552235ff390f516',
  'mobile-launch-en': '65230bf96fdd4a8f',
  'referral-en': '46529e933c30bca6',
  'upsell-en': '6483a535a810798a',
  'upsell-disc-en': 'dabee5b52ddb0e6e',
  'legislation-en': 'ab3e924f54c8c8e2',
  'seasonal-en': '67b94cdef3327b19',
  'client-message-en': '6d0fe44c0a137ad5',
  'catalog-account_lapse_warning': '1c81520f07061619',
  'catalog-account_lapse_warning-bare': '3a57cb592679b8b8',
  'catalog-accountant_invite': 'a92283c6b7117c23',
  'catalog-accountant_invite-bare': '8bca06415d12d58b',
  'catalog-accountant_request_answered': 'c95f8d07a7e98b3a',
  'catalog-accountant_request_answered-bare': '8eabe95ecfe1795c',
  'catalog-add_first_property': '537117fbb38b0c7a',
  'catalog-add_first_property-bare': '282d5602bc9e136e',
  'catalog-anniversary': 'ddcbdf94bd854530',
  'catalog-anniversary-bare': 'c111b3c836ebd359',
  'catalog-annual_discount': '8cb91f8906f4fb5c',
  'catalog-annual_discount-bare': 'e2a3875984ea4140',
  'catalog-appointment_missed': 'c2a6d38bd19cd60c',
  'catalog-appointment_missed-bare': 'ef803b5712a83127',
  'catalog-appointment_reminder': '7c3aee693b06830f',
  'catalog-appointment_reminder-bare': '6aff9ca7c18dbc0d',
  'catalog-assistant_showcase': '4f296fe4f72fde46',
  'catalog-assistant_showcase-bare': '95453fa603c7a4e6',
  'catalog-assistant_upgraded': '712053c3b02469fe',
  'catalog-assistant_upgraded-bare': '74234e98afe7498f',
  'catalog-best_practice_tip': 'b12b565dd06bcb34',
  'catalog-best_practice_tip-bare': '0e09f658dd686a63',
  'catalog-black_friday': '72cab473fd1af409',
  'catalog-black_friday-bare': '74234e98afe7498f',
  'catalog-card_expiring': 'c36ae6496cfef453',
  'catalog-card_expiring-bare': '91c0519b6103db33',
  'catalog-certificate_expiring': 'bce3068e4226af9a',
  'catalog-certificate_expiring-bare': '6e5d027a6ae33f26',
  'catalog-changelog_monthly': 'f600fd0b1fccf77e',
  'catalog-changelog_monthly-bare': '0d70864922765761',
  'catalog-charge_upcoming': '4235de0676208df8',
  'catalog-charge_upcoming-bare': 'fac7764b4e918051',
  'catalog-checkin_today': '8dd5738917d6d10b',
  'catalog-checkin_today-bare': 'fce2e746c0711688',
  'catalog-checkout_today': 'a42924134b7f701a',
  'catalog-checkout_today-bare': 'bf510e7ac1a67df0',
  'catalog-christmas': '4c562d412943066e',
  'catalog-christmas-bare': '72486e64f5dd701d',
  'catalog-churn_survey': 'eb301c92653fc48d',
  'catalog-churn_survey-bare': 'b8799c389ef2fbbd',
  'catalog-cleaning_scheduled': 'ef4a82bab76a97e5',
  'catalog-cleaning_scheduled-bare': '2dfef13ec4a46613',
  'catalog-connect_bank': '42dfdef8831004f9',
  'catalog-connect_bank-bare': '743f039cc31fc4d1',
  'catalog-connect_calendar': '50765329ce1f0fdf',
  'catalog-connect_calendar-bare': 'e2039a6d3e292ab7',
  'catalog-coowner_statement': '615a4338f53a56f4',
  'catalog-coowner_statement-bare': '168227eaa22c0e83',
  'catalog-cyber_monday': '86d3ff7a8a627f84',
  'catalog-cyber_monday-bare': '74234e98afe7498f',
  'catalog-data_retention_notice': '6c0d6395b83a8248',
  'catalog-data_retention_notice-bare': '017e80e0cccf13f7',
  'catalog-deposit_reminder': '53fa1348752fa100',
  'catalog-deposit_reminder-bare': 'c8b8e40210cab4ea',
  'catalog-digest_obligations': 'd4db0888e260e17c',
  'catalog-digest_obligations-bare': 'a3fd3699be76c54a',
  'catalog-digest_str_today': '7dd1e63c9fee9ab2',
  'catalog-digest_str_today-bare': 'ff17f110d1aa8bde',
  'catalog-digest_tax': 'e3e44bbe76c9148c',
  'catalog-digest_tax-bare': 'b01b0a4923c654ab',
  'catalog-document_pack': '69e7f267a468f6e6',
  'catalog-document_pack-bare': '6b54f164295edf00',
  'catalog-dunning_1': '94f3631092b030d6',
  'catalog-dunning_1-bare': '085cb1a67ea0bb38',
  'catalog-dunning_2': '2f8e975567c31df4',
  'catalog-dunning_2-bare': 'f6d4fd8dbfc858c7',
  'catalog-dunning_final': '4952a5d8a5c27a36',
  'catalog-dunning_final-bare': '211af651921dffcd',
  'catalog-energy_pulse': 'bab5d23ec358a13e',
  'catalog-energy_pulse-bare': 'e9e7427259445fbf',
  'catalog-energy_savings': '21822bfdbb487ec9',
  'catalog-energy_savings-bare': '7879a3672fa92a51',
  'catalog-enfia_installment_reminder': 'd58c058c18b78373',
  'catalog-enfia_installment_reminder-bare': '115d995cec40a88e',
  'catalog-feature_launch': '0686219e96a618b4',
  'catalog-feature_launch-bare': '4676e866c1bac69f',
  'catalog-feedback_lottery': 'ade4da7c5da33f4c',
  'catalog-feedback_lottery-bare': '9efeb0892c992231',
  'catalog-feedback_prize_won': '9e8ebe88dd57b058',
  'catalog-feedback_prize_won-bare': '74234e98afe7498f',
  'catalog-feedback_week1': '5df13a1c113fe5e9',
  'catalog-feedback_week1-bare': '621dcef6922d446b',
  'catalog-first_property_success': '02be0d1e9148ca1e',
  'catalog-first_property_success-bare': '1468dfaf932bc82d',
  'catalog-free_month_upgrade': '096cf601b40ea267',
  'catalog-free_month_upgrade-bare': '9563815ad0c24a96',
  'catalog-inactive_30': 'e81e4d219e57f6bc',
  'catalog-inactive_30-bare': '3260aacb8245fe48',
  'catalog-inactive_60': 'b95ae9934f9eaac5',
  'catalog-inactive_60-bare': 'daa9faf13bfb2725',
  'catalog-inspection_due': '3ffb7c82817a96a1',
  'catalog-inspection_due-bare': '9f53385073c445c7',
  'catalog-insurance_enfia': 'bd3d304791e346bd',
  'catalog-insurance_enfia-bare': '5515bc6f3c392ff0',
  'catalog-insurance_expiring': 'c4989dc10c1bac0d',
  'catalog-insurance_expiring-bare': 'f7a67d0782f79127',
  'catalog-lease_declaration_reminder': 'b57e3a78ce9bef24',
  'catalog-lease_declaration_reminder-bare': '2ecdccc36a5af9ce',
  'catalog-lease_ending': 'd69209a10ce0c8ce',
  'catalog-lease_ending-bare': 'd82c00490893b8ba',
  'catalog-lease_renewal_prompt': '1a3f223a967366b4',
  'catalog-lease_renewal_prompt-bare': 'a4aab4d7d7d67ddd',
  'catalog-legislation_update': 'fc225c0d54cb4f9f',
  'catalog-legislation_update-bare': 'bc123fff64697332',
  'catalog-limit_reached': 'da10305c89ccfa87',
  'catalog-limit_reached-bare': '2370ec9bb6be9fd1',
  'catalog-loan_costs': 'a0c6d0c701f7295f',
  'catalog-loan_costs-bare': '3e2ac50bf7258277',
  'catalog-loan_first_scenario': '0ec95bc245b2a2c5',
  'catalog-loan_first_scenario-bare': '1dee1ce9aea6044c',
  'catalog-maintenance_completed': '1e657e3b5bc1c321',
  'catalog-maintenance_completed-bare': '8c60779d5074fbc4',
  'catalog-maintenance_requested': '24ef92f9711d3219',
  'catalog-maintenance_requested-bare': '1f5b9244f1ebaf7e',
  'catalog-maintenance_scheduled': '0c4e0463cf05cd19',
  'catalog-maintenance_scheduled-bare': '7855751455ddc976',
  'catalog-market_digest': 'a07b10d8e3477001',
  'catalog-market_digest-bare': 'd0409f9713fd9c5b',
  'catalog-milestone_reached': '5c0c7d461d016427',
  'catalog-milestone_reached-bare': 'a7025eef6303683d',
  'catalog-mobile_launch': 'f6633778fe0e0ea1',
  'catalog-mobile_launch-bare': '13ed765fb93b696a',
  'catalog-monthly_statement': 'b7dab36a4b3c8fb1',
  'catalog-monthly_statement-bare': 'b0c69b63659637ba',
  'catalog-new_year': '6fb0796e447b812d',
  'catalog-new_year-bare': '74234e98afe7498f',
  'catalog-news_insurance_risk': '09d0388898fa2455',
  'catalog-news_insurance_risk-bare': '524f021d492cdf42',
  'catalog-news_market': 'c02b3f585f7cb188',
  'catalog-news_market-bare': '676f9d269ae792c5',
  'catalog-news_rate_move': '07a21afd48cef52c',
  'catalog-news_rate_move-bare': '1f6ce6a4a07f1d4b',
  'catalog-news_tax_change': '3844107d7f594bc2',
  'catalog-news_tax_change-bare': 'af6ef0f9c496118d',
  'catalog-news_utility_prices': '346af3af934f0dfb',
  'catalog-news_utility_prices-bare': 'eeae93457f15762c',
  'catalog-nps_survey': '94f551496822bef0',
  'catalog-nps_survey-bare': 'a65853415a830927',
  'catalog-occupancy_gap': 'bcde30fa5c322f2b',
  'catalog-occupancy_gap-bare': '3df3a0bf4a77bb55',
  'catalog-payment_failed': '44e958a358c82c87',
  'catalog-payment_failed-bare': 'f287df009e5ed908',
  'catalog-payout_received': 'ee10486e1d15ba68',
  'catalog-payout_received-bare': 'ed9ece1eb075e09e',
  'catalog-plan_changed': 'e80b4780a1e5336c',
  'catalog-plan_changed-bare': '62a76f0518d14e39',
  'catalog-plan_comparison': '11a7e8868bc434a7',
  'catalog-plan_comparison-bare': '090f0c5f4f893274',
  'catalog-portfolio_digest_nudge': 'ca0a02019ca51cb6',
  'catalog-portfolio_digest_nudge-bare': '2c02028750c35f28',
  'catalog-product_update': 'f10b6b78e40bd1bc',
  'catalog-product_update-bare': 'b2bb2818305fd236',
  'catalog-quarterly_review': '5666e4b20fa98aa1',
  'catalog-quarterly_review-bare': '6017406fe8885d24',
  'catalog-rate_alert': '23f75f7bbfcc2141',
  'catalog-rate_alert-bare': 'bc02191ce5fcd706',
  'catalog-reactivation_offer': 'a5701184b1ef547f',
  'catalog-reactivation_offer-bare': '74234e98afe7498f',
  'catalog-recap_week2': '2d59f3235e0b60b8',
  'catalog-recap_week2-bare': '43506e76d96d3c2b',
  'catalog-referral_friend_activated': '64e22d4a350d9139',
  'catalog-referral_friend_activated-bare': '165969272ea1d98c',
  'catalog-referral_invite': '0b14ea2385e9d2a9',
  'catalog-referral_invite-bare': 'fc645fa3b745a00c',
  'catalog-referral_reminder': 'a2f9ed48ca209ed0',
  'catalog-referral_reminder-bare': '856eb7b4726e6a06',
  'catalog-referral_reward': '668e30e76f1297d8',
  'catalog-referral_reward-bare': '4be0485d43ac14b7',
  'catalog-rent_benchmark_alert': '7b34e57b4c91a599',
  'catalog-rent_benchmark_alert-bare': '8dfe3da4ba6e22fd',
  'catalog-rent_pending': '4ba5f62eec49fe94',
  'catalog-rent_pending-bare': 'c3d335420d2cba10',
  'catalog-reply_ack': 'e5b5e0cbb41664d0',
  'catalog-reply_ack-bare': 'b86513b628bd722b',
  'catalog-review_request': 'd7f01a80cd3e9ffb',
  'catalog-review_request-bare': '28f90d72183931ed',
  'catalog-roadmap_preview': 'af61390c92e5957c',
  'catalog-roadmap_preview-bare': '019639b210499b18',
  'catalog-roi_proof': '4a45c80058dfd8ae',
  'catalog-roi_proof-bare': '656ff1bcc84f504c',
  'catalog-security_login': '89879276ca6c5828',
  'catalog-security_login-bare': '493180ac38fa6003',
  'catalog-social_proof': 'd93eb625c9f9590b',
  'catalog-social_proof-bare': '38b14d4e3e48ae49',
  'catalog-str_registration_reminder': '07f4cce5e45dfb2c',
  'catalog-str_registration_reminder-bare': '1eb2cff0f8a58ba0',
  'catalog-str_season_recap': '782a63c908ed21b1',
  'catalog-str_season_recap-bare': '82375d6b7b685839',
  'catalog-str_stay_tax': '77b952dac735202d',
  'catalog-str_stay_tax-bare': 'bc97abdfcf008220',
  'catalog-subscription_receipt': '7938d8a86aa53173',
  'catalog-subscription_receipt-bare': 'b961a8512861c7c0',
  'catalog-summer_str': '72aceb20848e2c3e',
  'catalog-summer_str-bare': '74234e98afe7498f',
  'catalog-takk_seasonal_rate_switch': '02fb9c1578e30d46',
  'catalog-takk_seasonal_rate_switch-bare': 'e7804cdfeac4bd17',
  'catalog-tax_e2': '0c5170dd1e926e6e',
  'catalog-tax_e2-bare': '580db156103d9df7',
  'catalog-tax_enfia': 'a3742811bdc02d62',
  'catalog-tax_enfia-bare': '1122388bb1fa0d57',
  'catalog-tax_installment': 'd693f680a1a31fdf',
  'catalog-tax_installment-bare': '36ecc2304f1cf9d9',
  'catalog-tax_season': 'b8d3dc86badc1c4c',
  'catalog-tax_season-bare': '10839a1d873a0c86',
  'catalog-tenant_rent_receipt': '25087f45a0a419e1',
  'catalog-tenant_rent_receipt-bare': 'de9fbf8bfc08c093',
  'catalog-tip_assistant': '7ba280a5cc2bbe52',
  'catalog-tip_assistant-bare': 'db48c5c3802b5689',
  'catalog-tip_reports': '2982e63c0ea621f3',
  'catalog-tip_reports-bare': 'cbc7259e7684839a',
  'catalog-trial_ending': '44a81d0e1395c1ac',
  'catalog-trial_ending-bare': '442d11e4d9316794',
  'catalog-trial_started': '135215dafed68a09',
  'catalog-trial_started-bare': '94e005d815a70cfa',
  'catalog-upsell_to_individual': '77425eb1ce9f570e',
  'catalog-upsell_to_individual-bare': '568d952353e932ec',
  'catalog-upsell_to_professional': '61c3f52209dc5320',
  'catalog-upsell_to_professional-bare': 'e2af61eaacb376b2',
  'catalog-utility_bill_due': '97cbd4e4262af571',
  'catalog-utility_bill_due-bare': '133f064cc3e16347',
  'catalog-value_left': '53a85456e2a69ba8',
  'catalog-value_left-bare': 'ac769e1742bf657b',
  'catalog-voice_entry': '338f6ad2b5fab1b0',
  'catalog-voice_entry-bare': 'ac0484712fdecefb',
  'catalog-webinar_invite': 'b579b864e983b01a',
  'catalog-webinar_invite-bare': '74234e98afe7498f',
  'catalog-welcome_free': 'dff00f4bf40d329b',
  'catalog-welcome_free-bare': '5b407c653dab41a8',
  'catalog-welcome_individual': '140aabe642c0c5d2',
  'catalog-welcome_individual-bare': 'f88e6a4339b7224a',
  'catalog-welcome_professional': '1b856044071f8991',
  'catalog-welcome_professional-bare': 'e516dffb62e3e049',
  'catalog-winback_downgrade': '11a91fcb3093c5f1',
  'catalog-winback_downgrade-bare': '5b8e0c1a9a95a3ac',
  'catalog-winback_offer': 'b0460889fa483b3f',
  'catalog-winback_offer-bare': '74234e98afe7498f',
  'catalog-year_end': '43c5e37aa5041c3c',
  'catalog-year_end-bare': '26568838944d2b38',
  'catalog-yield_boost': '74b0b14b7b5a6f90',
  'catalog-yield_boost-bare': 'a7c5d339f4ae90b0',
  'firm-invite': '5c5a41605ae7e1d1',
  'firm-invite-anon': 'df05e7dc763a82c8',
  'org-invite': 'cba9c32db6dd9ea6',
  'org-invite-anon': '027bdf94fb0fbcbb',
  'test-notification': '846c6a8be316982f',
  'confirm-address': 'bccd90d1b9a8da7c',
  'mobile-app-out': 'eb11b816faf067d8',
  'newsletter': '73fc5218ee941728',
  'statement': '3a98a0e3ed41f701',
  'market-digest': '24c7d098bf704670',
}

if (process.argv.includes('--print')) {
  for (const f of FIXTURES) console.log(`  '${f.name}': '${sha(f.el())}',`)
  process.exit(0)
}

for (const f of FIXTURES) ok(`ελληνικά ίδια: ${f.name}`, EL_SHA[f.name] === sha(f.el()))

// ── Τα αγγλικά: ορατό κείμενο χωρίς ελληνικό γράμμα ──────────────────────
// Ορατό = ό,τι μένει χωρίς <style>, σχόλια (υποθετικά του Outlook) και ετικέτες.
// Σάρωση με θέσεις, όχι με regex που κόβει ετικέτες (CodeQL).
const GREEK = /[\p{Script=Greek}]/u
const cut = (html: string, open: string, close: string) => {
  let res = '', i = 0
  for (;;) {
    const a = html.indexOf(open, i)
    if (a < 0) return res + html.slice(i)
    const b = html.indexOf(close, a + open.length)
    res += html.slice(i, a) + ' '
    if (b < 0) return res
    i = b + close.length
  }
}
const visible = (html: string) => cut(cut(cut(html, '<style', '</style>'), '<!--', '-->'), '<', '>')
/** Κύρια ονόματα που μένουν ελληνικά και εξηγούνται δίπλα τους. Κανένα ακόμη στα πρότυπα αυτά. */
const GLOSSED: string[] = []
const english = FIXTURES.filter(f => f.en)
ok('υπάρχουν αγγλικά πρότυπα', english.length >= 250)
// ΚΑΘΕ ΜΗΝΥΜΑ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΕΧΕΙ ΑΓΓΛΙΚΟ ΔΙΔΥΜΟ: νέο ελληνικό χωρίς αγγλικό δεν περνά.
for (const f of FIXTURES) if (f.name.startsWith('catalog-')) ok(`αγγλικό δίδυμο: ${f.name}`, !!f.en)
for (const f of english) {
  const en = f.en!()
  let text = visible(en)
  for (const g of GLOSSED) text = text.split(g).join('')
  const m = GREEK.exec(text)
  ok(`αγγλικά χωρίς ελληνικό γράμμα: ${f.name}${m ? ` («${text.slice(Math.max(0, m.index - 30), m.index + 30).trim()}»)` : ''}`, !m)
  // Μήνυμα που δεν στέλνεται χωρίς τα δεδομένα του (`null`) είναι `null` και στις δύο.
  if (en !== 'null') ok(`αγγλικά διαφέρουν: ${f.name}`, en !== f.el())
  else ok(`και τα αγγλικά δεν στέλνονται: ${f.name}`, f.el() === 'null')
  // Ολόκληρο έγγραφο (το κέλυφος, με τα xmlns του Outlook): δηλώνει τη γλώσσα του.
  if (en.includes('xmlns:v=')) ok(`lang="en": ${f.name}`, en.includes('lang="en" dir="ltr"'))
}

// ── Τα γεγονότα μένουν ίδια: ποσά και ημερομηνίες σε ελληνική μορφή ───────
const r3 = FIXTURES.find(f => f.name === 'reminder-7days-3')!
ok('ίδια ποσά και στις δύο γλώσσες', ['123,45€', '1.234,50€', '1.357,95€', '30/11/2026', '01/12/2026'].every(x => r3.el().includes(x) && r3.en!().includes(x)))
ok('η φορολογική προθεσμία παίρνει τίτλο από το είδος της', r3.en!().includes('ENFIA: 4th installment'))
ok('ο τίτλος του χρήστη μένει όπως τον έγραψε', r3.en!().includes('Boiler service'))
const d2 = FIXTURES.find(f => f.name === 'dunning-2')!.en!()
ok('η όχληση λέει τη σειρά της', d2.includes('Second reminder') && d2.includes('notice no. 2') && d2.includes('1.650,50€'))

console.log(`messageLang: ${pass} ✓ · ${fail} ✗`)
if (fail) process.exit(1)
