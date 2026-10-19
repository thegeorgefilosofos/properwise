---
name: programmatic-seo
description: When the user wants to create SEO-driven pages at scale using templates and data. Also use when the user mentions "programmatic SEO," "template pages," "pages at scale," "directory pages," "location pages," "[keyword] + [city] pages," "comparison pages," "integration pages," "building many pages for SEO," "pSEO," "generate 100 pages," "data-driven pages," "templated landing pages," or "which CMS for pSEO." Use this whenever someone wants to create many similar pages targeting different keywords or locations. For auditing existing SEO issues, see seo-audit. For content strategy planning, see content-strategy.
metadata:
  version: 2.1.0
---

> **Ξένο skill, ενσωματωμένο αυτούσιο.** Πηγή: `coreyhaines31/marketingskills` στο commit `365b412152b9542499ca1439426f7fc3cc92bb65`, αρχείο `skills/programmatic-seo/SKILL.md`.
> Άδεια MIT, © 2025 Corey Haines (πλήρες κείμενο στο `LICENSE` δίπλα). Ενσωμάτωση 19/10/2026 από την Ομάδα Properwise.
> Μπήκαν μόνο τα αρχεία κειμένου· κανένα script, hook ή εξάρτηση. Ενημέρωση μόνο χειροκίνητα: `docs/org/ergaleia/skills-trita.md`.
>
> **Προτεραιότητα:** το `AGENTS.md`, το `CLAUDE.md` και τα skills `anartisi`, `fylakas`, `kastania`, `zitima-grok` υπερισχύουν αυτού του κειμένου όπου διαφωνούν.
> Ό,τι ακολουθεί είναι μέθοδος, όχι άδεια για push, PR, merge ή εγκατάσταση πακέτων.
>
> **Κανόνες μας που υπερισχύουν σε κάθε πρόταση αυτού του skill:** κανένας αριθμός φόρου, ΕΝΦΙΑ, προθεσμίας ή τιμής γραμμένος με το χέρι (βγαίνει από τον κώδικα)· καμία στατιστική χωρίς πηγή· καμία ψεύτικη κριτική, βαθμολογία (`AggregateRating`/`Review`) ή μαρτυρία· κανένα υπερθετικό χωρίς μέτρηση· η Νόα χωρίς φύλο. Εργαλεία που προτείνονται εδώ (`npx ...`, εξωτερικές υπηρεσίες, κλειδιά API) δεν εκτελούνται ούτε συνδέονται χωρίς έγκριση του ιδιοκτήτη. Αναφορές σε άλλα skills της συλλογής που δεν μεταφέρθηκαν δεν ισχύουν εδώ.
>
> **Υπερισχύσεις για αυτό το skill:**
> - **Αριθμοί σε σελίδες κλίμακας:** κάθε ποσό φόρου, ΕΝΦΙΑ, προθεσμίας, τιμής ή αγοράς σε σελίδα ανά περιοχή, ποσό ή περίπτωση βγαίνει από τον κώδικα (`lib/tax/**`, `lib/billing/**`, `lib/facts/**`), ποτέ από πρότυπο κειμένου ή CSV γραμμένο με το χέρι. Το `data/**` είναι προστατευμένη διαδρομή: αλλαγή μόνο με πηγή (ΦΕΚ, νόμος, απόφαση ΑΑΔΕ) στην περιγραφή του PR.
> - **Πηγές δεδομένων:** όχι scraping. Μόνο δικά μας δεδομένα, δημόσια δεδομένα με άδεια επαναχρήσης και πηγή, ή αδειοδοτημένα με απόφαση ιδιοκτήτη. Δεδομένα χρηστών («product-derived») μόνο συγκεντρωτικά, ανώνυμα και με έγκριση· ποτέ σελίδα για συγκεκριμένο χρήστη ή ακίνητο.
> - **Playbooks που δεν εφαρμόζονται:** «Profiles» φυσικών προσώπων· «Comparisons», «Curation» («best», «top 10») και «Directory» με ονόματα ανταγωνιστών (κανόνες για υπερθετικά και για ανταγωνιστές, βλ. κεφαλίδα του `competitors`)· μαρτυρίες σε «Personas» χωρίς γραπτή συναίνεση.
> - **Τοπικές σελίδες** μόνο με πραγματικά τοπικά δεδομένα και πηγή· σελίδα που αλλάζει μόνο το όνομα της πόλης είναι doorway και δεν φτιάχνεται.
> - **Πλατφόρμα:** το δικό μας Next.js (`AGENTS.md`). Webflow, Framer, Ploy ◆ και τα υπόλοιπα της πηγής δεν είναι σύσταση. Κάθε παρτίδα σελίδων μπαίνει με PR, ξεκινώντας από λίγες σελίδες.

# Programmatic SEO

You are an expert in programmatic SEO—building SEO-optimized pages at scale using templates and data. Your goal is to create pages that rank, provide value, and avoid thin content penalties.

## Initial Assessment

**Check for product marketing context first:**
If `.agents/product-marketing.md` exists (or `.claude/product-marketing.md`, or the legacy `product-marketing-context.md` filename, in older setups), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Before designing a programmatic SEO strategy, understand:

1. **Business Context**
   - What's the product/service?
   - Who is the target audience?
   - What's the conversion goal for these pages?

2. **Opportunity Assessment**
   - What search patterns exist?
   - How many potential pages?
   - What's the search volume distribution?

3. **Competitive Landscape**
   - Who ranks for these terms now?
   - What do their pages look like?
   - Can you realistically compete?

---

## Core Principles

### 1. Unique Value Per Page
- Every page must provide value specific to that page
- Not just swapped variables in a template
- Maximize unique content—the more differentiated, the better

### 2. Proprietary Data Wins
Hierarchy of data defensibility:
1. Proprietary (you created it)
2. Product-derived (from your users)
3. User-generated (your community)
4. Licensed (exclusive access)
5. Public (anyone can use—weakest)

### 3. Clean URL Structure
**Use subfolders, not subdomains** — subfolders consolidate domain authority while subdomains split it:
- Good: `yoursite.com/templates/resume/`
- Bad: `templates.yoursite.com/resume/`

### 4. Genuine Search Intent Match
Pages must actually answer what people are searching for.

### 5. Quality Over Quantity
Better to have 100 great pages than 10,000 thin ones.

### 6. Avoid Google Penalties
- No doorway pages
- No keyword stuffing
- No duplicate content
- Genuine utility for users

---

## The 12 Playbooks (Overview)

| Playbook | Pattern | Example |
|----------|---------|---------|
| Templates | "[Type] template" | "resume template" |
| Curation | "best [category]" | "best website builders" |
| Conversions | "[X] to [Y]" | "$10 USD to GBP" |
| Comparisons | "[X] vs [Y]" | "webflow vs wordpress" |
| Examples | "[type] examples" | "landing page examples" |
| Locations | "[service] in [location]" | "dentists in austin" |
| Personas | "[product] for [audience]" | "crm for real estate" |
| Integrations | "[product A] [product B] integration" | "slack asana integration" |
| Glossary | "what is [term]" | "what is pSEO" |
| Translations | Content in multiple languages | Localized content |
| Directory | "[category] tools" | "ai copywriting tools" |
| Profiles | "[entity name]" | "stripe ceo" |

**For detailed playbook implementation**: See [references/playbooks.md](references/playbooks.md)

---

## Choosing Your Playbook

| If you have... | Consider... |
|----------------|-------------|
| Proprietary data | Directories, Profiles |
| Product with integrations | Integrations |
| Design/creative product | Templates, Examples |
| Multi-segment audience | Personas |
| Local presence | Locations |
| Tool or utility product | Conversions |
| Content/expertise | Glossary, Curation |
| Competitor landscape | Comparisons |

You can layer multiple playbooks (e.g., "Best coworking spaces in San Diego").

---

## Implementation Framework

### 1. Keyword Pattern Research

**Identify the pattern:**
- What's the repeating structure?
- What are the variables?
- How many unique combinations exist?

**Validate demand:**
- Aggregate search volume
- Volume distribution (head vs. long tail)
- Trend direction

### 2. Data Requirements

**Identify data sources:**
- What data populates each page?
- Is it first-party, scraped, licensed, public?
- How is it updated?

### 3. Template Design

**Page structure:**
- Header with target keyword
- Unique intro (not just variables swapped)
- Data-driven sections
- Related pages / internal links
- CTAs appropriate to intent

**Ensuring uniqueness:**
- Each page needs unique value
- Conditional content based on data
- Original insights/analysis per page

### 4. Internal Linking Architecture

**Hub and spoke model:**
- Hub: Main category page
- Spokes: Individual programmatic pages
- Cross-links between related spokes

**Avoid orphan pages:**
- Every page reachable from main site
- XML sitemap for all pages
- Breadcrumbs with structured data

### 5. Indexation Strategy

- Prioritize high-volume patterns
- Noindex very thin variations
- Manage crawl budget thoughtfully
- Separate sitemaps by page type

### 6. Choose the Build Platform

Check that the platform can hold the page count, refresh the data, render server-side HTML, branch on data for conditional sections, and control indexation per page. Prefer the existing site's CMS if it can; otherwise serve the set on a subpath of the main domain. Options and tradeoffs: [references/implementation-platforms.md](references/implementation-platforms.md).

---

## Quality Checks

### Pre-Launch Checklist

**Content quality:**
- [ ] Each page provides unique value
- [ ] Answers search intent
- [ ] Readable and useful

**Technical SEO:**
- [ ] Unique titles and meta descriptions
- [ ] Proper heading structure
- [ ] Schema markup implemented
- [ ] Page speed acceptable

**Internal linking:**
- [ ] Connected to site architecture
- [ ] Related pages linked
- [ ] No orphan pages

**Indexation:**
- [ ] In XML sitemap
- [ ] Crawlable
- [ ] No conflicting noindex

### Post-Launch Monitoring

Track: Indexation rate, Rankings, Traffic, Engagement, Conversion

Watch for: Thin content warnings, Ranking drops, Manual actions, Crawl errors

---

## Common Mistakes

- **Thin content**: Just swapping city names in identical content
- **Keyword cannibalization**: Multiple pages targeting same keyword
- **Over-generation**: Creating pages with no search demand
- **Poor data quality**: Outdated or incorrect information
- **Ignoring UX**: Pages exist for Google, not users

---

## Output Format

### Strategy Document
- Opportunity analysis
- Implementation plan
- Content guidelines

### Page Template
- URL structure
- Title/meta templates
- Content outline
- Schema markup

---

## Task-Specific Questions

1. What keyword patterns are you targeting?
2. What data do you have (or can acquire)?
3. How many pages are you planning?
4. What does your site authority look like?
5. Who currently ranks for these terms?
6. What's your technical stack?

---

## Related Skills

- **seo-audit**: For auditing programmatic pages after launch
- **schema**: For adding structured data
- **site-architecture**: For page hierarchy, URL structure, and internal linking
- **competitors**: For comparison page frameworks
