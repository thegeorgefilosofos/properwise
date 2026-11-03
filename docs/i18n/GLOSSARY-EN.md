# PROPERWISE in English: glossary and house rules

The canonical English for everything the product says, harvested from the live
`/en` pages (`lib/i18n/en/**`, `app/en/**`, `app/og/shareEn.ts`,
`lib/legal/billingWords.ts`). Every new English screen, including the logged-in
app, follows this file. When a term here and a page disagree, the page is wrong.

Who reads us: an owner of property in Greece who does not read Greek. Often an
American or northern European investor, a foreign retiree, an expat landlord,
or a tenant or guest who received a link. They know property; they do not know
the Greek tax system. Every Greek term is explained once, then used plainly.

---

## 1. Voice

- **Plain, warm, precise.** Short sentences. One idea per sentence. Say what
  happens, not what the product "empowers" you to do.
- **Second person, active voice.** "You can pay in installments", not
  "Payment may be effected in installments".
- **Write it natively, never translate word by word.** Rebuild the Greek
  sentence the way a careful English writer would say it. Greek runs long and
  stacks clauses; English splits them. Greek says "η εφαρμογή σού επιτρέπει να";
  English says "you can".
- **Calm about risk, exact about money.** No alarm words ("urgent!",
  "don't miss out"), no hype ("revolutionary", "seamless", "effortless",
  "powerful", "cutting-edge"). State the deadline and the amount.
- **Say what we don't know.** "Not announced yet", "last year's date",
  "check with your accountant". Never round a guess into a fact.
- **No exclamation marks** in product copy. The one exception is a guest
  thank-you on a completed form, and even there one is the limit.
- **No emoji.** Not in copy, not in buttons, not in notifications.

### Words we never use

| Avoid | Use instead | Why |
|---|---|---|
| free (next to a price, plan, subscription or trial) | no subscription, at no cost, without charge | Billing rule; guarded by `scripts/guard-en-copy.mjs` |
| assistant, chatbot, AI assistant, bot | Noa | Noa has a name |
| she, he, her, his (for Noa) | Noa, or rephrase | Noa is genderless |
| seamless, effortless, powerful, revolutionary, robust, leverage, utilize, empower, unlock | say what it does | Marketing noise |
| simply, just, easy (for things that are not) | — | Condescending when it isn't |
| please (in labels and buttons) | — | Buttons are verbs |
| tax office (for AADE) | AADE, the Greek tax authority | AADE is one authority, not an office |
| tax bill / tax invoice (for εκκαθαριστικό) | assessment notice | See §4 |
| contract (for a lease) | lease | See §4 |
| landlord (for the user, in product UI) | owner | Our user owns property; "landlord" only in legal/tax prose about a lease |
| letting agent | property manager or agency | |
| Click here | describe the destination in the link | Accessibility |
| Log-in, Sign-in (hyphenated, as verbs) | log in (verb), login (noun only if unavoidable) | |
| e-mail | email | |
| Euro, EUR, € after the number | € before the number: €1,234.50 | `fmtFor('en')` |

---

## 2. Spelling and grammar

- **American spelling**, consistently: `-ize` (finalize, organize, authorize),
  `-or` (color, labor, favor), `-er` (center), `program`, `license` (noun and
  verb), `canceled`, `installment`, `fulfill`, `enroll`. The format locale is
  `en-US` (`lib/core/format.ts`) and Open Graph says `en_US`
  (`lib/i18n/locale.ts`); spelling follows them.
- **Dates are the one deliberate exception** — day before month, see §3.
- **Sentence case** for every heading, button, tab, label and title:
  "What each plan includes", not "What Each Plan Includes".
- **Curly quotes and apostrophes**: ’ “ ”. Never straight `'` or `"` in copy.
- **En dash for ranges** in tables (`€500 – €900`); in sentences prefer
  words: "from 1 April to 30 June".
- **Serial comma: no.** "ENFIA, rental tax and deadlines". Add one only when a
  list item itself contains "and".
- **Contractions are fine** in product copy and guides ("doesn’t", "you’ll");
  avoid them in legal text (terms, privacy, withdrawal).
- **Numbers in prose:** words for one to nine when they count things and stand
  alone ("two obligations a month"); digits with units, money, percentages,
  ages, years and anything that comes from code. Never start a sentence with a
  digit.
- **Ordinals:** 1st, 2nd, 3rd, 4th (the helper in `lib/i18n/en/deadlines.ts`).

---

## 3. Numbers, money, dates

Always through `fmtFor('en')` (`lib/core/format.ts`). Never format by hand.

| What | Function | Output |
|---|---|---|
| Money, two decimals | `f.fe(n)` | €1,234.50 |
| Money, whole euros | `f.feWhole(n)` | €1,235 |
| Negative money | `f.feSigned(n)` | −€120.00 (true minus sign) |
| Unit price | `f.feRate(n)` | €0.12345 |
| Number | `f.fn(n, d)` | 1,234 · 2.5 |
| Percentage, two decimals | `f.fp(n)` | 12.00% |
| Rate, up to two decimals | `f.fpRate(n)` | 22% · 0.5% |
| Compact date | `f.date(iso)` | 2 Nov 2026 |
| Long date in prose | `longDateEn(iso)` (`lib/i18n/en/dates.ts`) | 30 November 2026 |
| Day and month in prose | `dayMonthEn(iso)` | 1 November |
| Month and year | `monthYearEn(key)` | November 2026 |

- **Day before month, always**: "2 Nov 2026" in tables and stamps,
  "30 November 2026" in sentences, "on 1 November" without the year. Never
  "11/02/2026" or "02/11/2026" — both are ambiguous to half our readers.
  Never "November 1, 2026": it would sit next to "2 Nov 2026" on the same page.
- **Citations keep their official form**: `Government Gazette B 5590/17.09.2026`,
  `Law 5222/2025`. That date is part of the reference, not prose.
- **No hand-typed figure** for tax, ENFIA, deadlines or prices. Every rate,
  threshold, date, count and amount comes from the constant that computes it
  (`lib/tax/**`, `lib/billing/**`, `lib/accounting/**`, `lib/loans/**`). A
  hand-typed digit there is a review finding (AGENTS.md).
- **Numbers render in Inter with tabular figures** (`T.font.num`), never in
  Roboto Mono.
- **Units**: m² (not sq m or sqm), km, MB. A space between number and unit
  except `%` and `€`.

---

## 4. Terms

### 4.1 Greek institutions, documents and systems

House rule: **English gloss first, then the Greek name or acronym in
parentheses on first use on a page**, then the short form. The Greek original
is written in Latin letters (ENFIA, AADE, AFM): English source files may not
contain Greek script (`scripts/guard-en-copy.mjs`). Names that appear in Greek
on the user’s screen (menu items on myAADE, file names in an export, data the
owner typed) are shown as they are, in Greek, with an English explanation.

| Greek | Canonical English | First use on a page | Notes |
|---|---|---|---|
| ΕΝΦΙΑ | ENFIA | ENFIA, Greece’s annual property tax | Never "the ENFIA tax" |
| ΑΑΔΕ | AADE | AADE, the Greek tax authority | Not "tax office", not "IAPR" |
| myAADE | myAADE | myAADE, AADE’s online portal | |
| myPROPERTY | myPROPERTY | myPROPERTY, the AADE platform for lease declarations and property transfers | |
| TAXISnet | TAXISnet | your TAXISnet credentials | "sign in to myAADE with your TAXISnet credentials" |
| myDATA | myDATA | myDATA, AADE’s electronic books | |
| ΑΦΜ | tax number (AFM) | your Greek tax number (AFM) | Then "tax number" |
| ΑΤΑΚ | ATAK | the ATAK (the property’s tax ID number) | |
| ΔΟΥ | tax office (DOY) | the local tax office (DOY) | Only for the physical office |
| εκκαθαριστικό (ΕΝΦΙΑ, φόρου) | assessment notice | the assessment notice | "the assessment" when short |
| εκκαθάριση | assessment | | |
| φορολογική δήλωση | tax return | the income tax return (form E1) | |
| Ε1 | form E1 | form E1, the Greek income tax return | |
| Ε2 | form E2 | form E2, the schedule of property income | "the E2" after first use |
| Ε9 | form E9 | form E9, your property register at AADE | |
| προσυμπληρωμένη δήλωση | pre-filled return | | |
| αυτόματη οριστικοποίηση | automatic filing | "filed automatically" | |
| οριστικοποίηση (πιστοποιητικού ΕΝΦΙΑ) | finalization | the notary finalizes it | |
| πιστοποιητικό ΕΝΦΙΑ | ENFIA certificate | | |
| δόση | installment | the 1st installment | Never "instalment" |
| ΦΕΚ | Government Gazette | Government Gazette (FEK) | In citations: `Government Gazette B 7200/31.12.2025` via `gazetteEn()` |
| ν. / νόμος | Law | Law 5222/2025 | via `lawEn()` |
| ΚΥΑ | Joint Ministerial Decision | Joint Ministerial Decision A.1153/2025 | via `kyaEn()` |
| απόφαση ΑΑΔΕ | AADE Decision | AADE Decision A.1187/2026 | Capital D, always "AADE Decision" |
| ΠΔ | Presidential Decree | Presidential Decree 34/1995 | |
| άρθρο 5 παρ. 2 | Article 5(2) | | via `articleEn()`; "Article 39(3)(a)" |
| ΚΦΕ | Income Tax Code | the Greek Income Tax Code (Law 4172/2013) | |
| ΚΦΔ | Tax Procedure Code | the Tax Procedure Code (Law 5104/2024) | |
| ΕΛΣΤΑΤ | ELSTAT | ELSTAT, Greece’s statistics authority | |
| ΔΤΚ | consumer price index (CPI) | ELSTAT’s consumer price index (CPI) | |
| Τράπεζα της Ελλάδος | Bank of Greece | | |
| ΕΑΤ | Hellenic Development Bank | the Hellenic Development Bank (HDB) | |
| ΔΥΠΑ | DYPA | DYPA, the Public Employment Service | |
| ΕΣΠΑ | NSRF | the EU-funded NSRF program (ESPA) | |
| Ταμείο Ανάκαμψης | Recovery and Resilience Facility | | "Recovery Fund" after first use |
| ΔΕΘ | Thessaloniki International Fair (TIF) | the Prime Minister’s speech at the Thessaloniki International Fair | |
| gov.gr | gov.gr | | |
| ΓΕΜΗ | business registry (GEMI) | | |
| ΠΕΑ | energy performance certificate (PEA) | | |
| Ηλεκτρονική Ταυτότητα Κτιρίου | Electronic Building ID | | |
| τιμή ζώνης | zone price | the zone price, the state’s reference price per m² | |
| αντικειμενική αξία | objective value | the objective value the state sets for each property | |

### 4.2 Renting and tax

| Greek | Canonical English | Notes |
|---|---|---|
| μίσθωση / μισθωτήριο | lease | "the lease"; "commercial lease", "residential lease" |
| δήλωση μίσθωσης | lease declaration | filed on myAADE |
| εκμισθωτής | landlord | in legal/tax prose only; in UI the user is "the owner" |
| μισθωτής / ενοικιαστής | tenant | |
| ιδιοκτήτης | owner | the user |
| ενοίκιο / μίσθωμα | rent | |
| αναπροσαρμογή ενοικίου | rent increase (or rent adjustment, in legal prose) | "the clause" for όρος αναπροσαρμογής |
| εγγύηση | deposit | |
| επαγγελματική μίσθωση | commercial lease | |
| μίσθωση κατοικίας | residential lease | |
| βραχυχρόνια μίσθωση | short-term rental | noun; "rent out short-term" as verb |
| μακροχρόνια μίσθωση | long-term rental / long-term lease | |
| Μητρώο Ακινήτων Βραχυχρόνιας Διαμονής | Short-Term Rental Property Registry | |
| ΑΜΑ | registry number (AMA) | "the property registry number (AMA)"; then "the AMA" |
| ΤΑΚΚ, τέλος ανθεκτικότητας στην κλιματική κρίση | climate crisis resilience fee | First use exactly so (the official name); then "the climate fee". Never "climate resilience fee", never "tourist tax" |
| ειδική απόδειξη | special receipt | |
| τεκμαρτή έκπτωση | standard deduction | the rate in front of it always from `PRESUMPTIVE_DEDUCTION_RATE` |
| κλιμάκιο | bracket | "tax brackets", "the lowest bracket" |
| οριακός συντελεστής | marginal rate | |
| ακαθάριστο | gross | "gross rent" |
| φορολογητέο | taxable income | |
| συνιδιοκτησία | co-ownership | "your co-ownership share", "your share" |
| ποσοστό συνιδιοκτησίας | co-ownership share | |
| έκπτωση φόρου (39Β) | tax credit | "the renovation tax credit (Article 39B)" |
| επιχορήγηση | grant | "Anakainizo 2026" is a grant, not a tax credit |
| πλαφόν | cap | "the rent cap"; the rate always from `COMMERCIAL_RENT_CAP_2026` |
| ΦΠΑ | VAT | |
| χαρτόσημο | stamp duty | |
| Ψηφιακό Τέλος Συναλλαγής | Digital Transaction Duty | |
| εμβαδόν, τ.μ. | floor area, m² | |
| όροφος | floor | |
| παλαιότητα | building age | |
| μεταβίβαση | transfer | |
| γονική παροχή | parental gift | |
| κληρονομιά | inheritance | |
| τακτοποίηση (αυθαιρέτου) | legalization | |
| λογιστής | accountant | "your accountant"; "accountant or tax advisor" for λογιστής ή φοροτεχνικός |
| συμβολαιογράφος | notary | |
| εργάσιμη | working day | "moved to the next working day" |

Program names keep their Greek name, transliterated, with a gloss:
"Spiti mou II (“My Home II”), the state-backed home loan program";
"Anakainizo 2026 (“I Renovate 2026”), officially Home Renovation". After first
use, the transliterated name alone.

### 4.3 The product

| Greek | Canonical English | Notes |
|---|---|---|
| PROPERWISE | PROPERWISE | Always capitals |
| Νόα | Noa | No article, no pronoun, never "assistant". Disclosure, once, where Noa is introduced: `AI_DISCLOSURE_EN` (“Noa is an AI tool.”) |
| πίνακας ελέγχου | dashboard | |
| Φάκελος Ακινήτου | Property File | Capitalized: it is a screen |
| Λογιστική | Accounting | tab name |
| Ημερολόγιο | Calendar | tab name |
| Λογαριασμός | Account | screen name; "your Account" |
| σάρωση | scan | "Scan a document", "scans a month" |
| πύλη ενοικιαστή | tenant portal | |
| πύλη λογιστή / σύνδεσμος λογιστή | accountant link | read-only, no account needed |
| χώρος λογιστή | accountant workspace | |
| φάκελος λογιστή | accountant’s file | the export for the accountant |
| εκκρεμότητες | to-dos | |
| υπενθυμίσεις | reminders | |
| πρόσκληση / σύσταση | invitation (program) | "invitation program" |
| συνεργάτης | partner | "partner status" |
| δοκιμή | trial | wording only from `billingWordsEn` |
| συνδρομή | subscription | |
| πακέτο | plan | |
| εγγραφή | sign-up (noun), sign up (verb) | |
| σύνδεση | log in (verb), "Log in" (button) | For third-party portals: "sign in to myAADE" |

**Plans** — names only from `PLAN_COPY_EN` (`lib/i18n/en/plans.ts`), in
quotes when named inside a sentence:

| Id | English name | Tagline |
|---|---|---|
| free | Owner | One property, no subscription |
| solo | Owner with Noa | Ask Noa, in Greek |
| owner | Owner+ | Up to N properties, one view |
| agency | Professional | Team, roles and accountability |
| office | Professional+ | Professional portfolio |

Billing, trial, card and charge wording comes **only** from
`billingWordsEn()` and the `*_EN` constants in `lib/legal/billingWords.ts`.
The no-subscription plan is "no subscription", never "free". Signup buttons:
`signupCtaEn()` — "Get started", "Start your trial", "Sign up".

---

## 5. Interface patterns

| Situation | Pattern | Example |
|---|---|---|
| Primary button | verb + object | "Calculate your tax", "Send request" |
| Busy button | verb + ellipsis | "Sending…", "Checking…" |
| Loading | "Loading…" | |
| Network failure | say it was us or the network, not the user | "The page didn’t load. We got no response just now, so we don’t know yet whether the link is valid. Try again in a moment." |
| Invalid link | what happened + what to do | "This link wasn’t found or has expired. Ask the owner for an updated link." |
| Success | past tense, plain | "Request sent." |
| Retry | "Try again" | |
| Optional field | "(optional)" after the label | "Phone (optional)" |
| Empty value | `—` (em dash) or say why | "Not filled in yet" |
| Units in labels | in parentheses | "Floor area (m²)" |

- Errors say what didn’t happen and why, in that order, and never blame the
  reader. No error codes in the sentence.
- A disclaimer is one calm sentence, not a block of capitals.

---

## 6. Legal and official text

- Greek is the binding language. English legal pages say so, once, at the top
  (`LEGAL_EN` in `lib/i18n/en/legal/common.ts`).
- Legal citations come from code constants through
  `lib/i18n/en/guides/cite.ts` (`gazetteEn`, `lawEn`, `kyaEn`, `articleEn`).
  When a Greek page itself types a law number by hand, the English page mirrors
  it and the gap is listed for the owner; we never invent a number.
- Consent and privacy notices shown to third parties (guests, tenants,
  recipients of reminders) are translated faithfully and marked for a lawyer’s
  review before they are relied on.

---

## 7. URLs and links

- English pages live under `/en` with English slugs
  (`/en/guides/greek-rental-income-tax-2026`), registered in `PAGE_PAIRS`
  (`lib/i18n/paths.ts`).
- Pages opened from a private link (tenant portal, guest check-in, “I paid”,
  unsubscribe, email confirmation, document verification, offline) keep the
  same URL in both languages: the language comes from the `pw_lang` cookie,
  otherwise from the browser’s languages, and the switcher flips it in place.
- A link to a page that has no English version yet stays Greek
  (`localHref`); never link to a page that doesn’t exist.
- Links to Greek-only official sources carry `hrefLang="el"`.
