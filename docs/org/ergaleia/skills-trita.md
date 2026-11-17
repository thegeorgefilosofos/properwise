# Skills από τρίτους στο Claude Code

Τι πήραμε από δημόσια αποθετήρια, από ποιο commit και γιατί τα υπόλοιπα έμειναν
έξω. Ελεγχος 19/10/2026.

## Ο κανόνας

Ξένο skill μπαίνει **μόνο ως κείμενο** στο `.claude/skills/<όνομα>/`: το `SKILL.md`
και τα `.md` αναφοράς του, αυτούσια, με κεφαλίδα πηγής, άδειας και commit κάτω από
το frontmatter και το `LICENSE` του αποθετηρίου δίπλα. Κανένα script, hook,
`package.json`, MCP ή εξάρτηση. Κανένα plugin που ενημερώνεται μόνο του.

Γιατί όχι plugin marketplace στο `.claude/settings.json`:

1. **Δεν φορτώνει στις συνεδρίες cloud.** Η τεκμηρίωση του Claude Code (σελίδα
   «Configure cloud environments», ενότητα «What carries over from your setup»)
   λέει ότι μια συνεδρία cloud δεν εγκαθιστά τα plugins του `enabledPlugins` ούτε
   όσα δηλώνει το `extraKnownMarketplaces`. Το `.claude/skills/` του αποθετηρίου
   φορτώνει, γιατί είναι μέρος του κλώνου. Εμείς δουλεύουμε κυρίως σε cloud.
2. **Το marketplace δεν καρφιτσώνεται σε commit.** Η πηγή marketplace `github`
   δέχεται `ref` (κλάδο ή ετικέτα), όχι `sha`. Το `sha` υπάρχει μόνο στην πηγή του
   plugin και τα δύο αποθετήρια δηλώνουν το plugin ως `"source": "./"`, άρα
   ακολουθεί ό,τι έχει ο κλάδος εκείνη τη στιγμή.
3. **Το plugin φέρνει όλο το αποθετήριο.** Στο superpowers αυτό σημαίνει και
   hook SessionStart (βλ. παρακάτω).

## Τι υιοθετήθηκε

| Skill | Πηγή | Commit | Αρχεία |
|---|---|---|---|
| `systematic-debugging` | `obra/superpowers` | `bb92a77741419a4ab5f06e711a283343f1ada0c3` | `SKILL.md`, `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md` |
| `verification-before-completion` | `obra/superpowers` | `bb92a77741419a4ab5f06e711a283343f1ada0c3` | `SKILL.md` |
| `receiving-code-review` | `obra/superpowers` | `bb92a77741419a4ab5f06e711a283343f1ada0c3` | `SKILL.md` |
| `seo-audit` | `coreyhaines31/marketingskills` | `365b412152b9542499ca1439426f7fc3cc92bb65` | `SKILL.md`, `references/*.md` |
| `ai-seo` | `coreyhaines31/marketingskills` | `365b412152b9542499ca1439426f7fc3cc92bb65` | `SKILL.md`, `references/*.md` |
| `schema` | `coreyhaines31/marketingskills` | `365b412152b9542499ca1439426f7fc3cc92bb65` | `SKILL.md`, `references/*.md` |
| `competitors` | `coreyhaines31/marketingskills` | `365b412152b9542499ca1439426f7fc3cc92bb65` | `SKILL.md`, `references/*.md` |
| `site-architecture` | `coreyhaines31/marketingskills` | `365b412152b9542499ca1439426f7fc3cc92bb65` | `SKILL.md`, `references/*.md` |
| `programmatic-seo` | `coreyhaines31/marketingskills` | `365b412152b9542499ca1439426f7fc3cc92bb65` | `SKILL.md`, `references/*.md` |
| `customer-research` | `coreyhaines31/marketingskills` | `365b412152b9542499ca1439426f7fc3cc92bb65` | `SKILL.md`, `references/*.md` |

Αδεια και των δύο: MIT. Το κείμενό της είναι στο `LICENSE` κάθε φακέλου.

## Τι διασκευάστηκε (17/11/2026)

Οκτώ skills του `obra/superpowers`, στο commit `22f0b463e7a5e579904dd6211a520321035526f7`
(v7.0.2), ξαναγράφτηκαν στα ελληνικά με τους κανόνες του έργου. Δεν είναι αυτούσια:
κράτησαν τη μέθοδο, πήραν τους δικούς μας κανόνες (εντολές χωρίς σωλήνα, όχι rebase
ή force-push, guards πριν από push, καστάνιες μόνο προς τα κάτω, πηγή για
προστατευμένες διαδρομές, όχι `pkill`, έως τρεις-τέσσερις πράκτορες). Πηγή, αλλαγές
και πλήρες κείμενο άδειας στο `references/proeleusi.md` κάθε φακέλου.

| Skill | Πηγή στο superpowers |
|---|---|
| `sxedio` | `writing-plans` |
| `kokkini-dokimi` | `test-driven-development` |
| `paradosi` | `finishing-a-development-branch` |
| `anathesi` | `subagent-driven-development` |
| `parallila` | `dispatching-parallel-agents`, `using-git-worktrees` |
| `axiologisi` | `requesting-code-review` |
| `dexiotita` | `writing-skills` |
| `skepsi` | `brainstorming`, χωρίς τον οπτικό σύντροφο |

Τα τρία αυτούσια (`systematic-debugging`, `verification-before-completion`,
`receiving-code-review`) συγκρίθηκαν με το νέο commit: το κείμενό τους δεν άλλαξε,
οπότε μένουν ως έχουν.

Η κεφαλίδα κάθε `SKILL.md` λέει ότι υπερισχύουν το `AGENTS.md`, το `CLAUDE.md` και
τα δικά μας skills. Στα skills marketing προσθέτει τους κανόνες μας που
συγκρούονται με γενικές συμβουλές τους: αριθμοί φόρου, ΕΝΦΙΑ, προθεσμιών και
τιμών μόνο από τον κώδικα, στατιστική μόνο με πηγή, καμία ψεύτικη κριτική ή
βαθμολογία στο schema, κανένα εξωτερικό εργαλείο χωρίς έγκριση.

Τα τέσσερα της δεύτερης παρτίδας (έγκριση ιδιοκτήτη, 19/10/2026) έχουν και δικές
τους υπερισχύσεις στην κεφαλίδα, γιατί η πηγή διδάσκει πράγματα που εδώ δεν γίνονται:

- **`competitors`**: η πηγή χτίζει σελίδες «[Competitor] alternative» και «vs» με
  το όνομα του ανταγωνιστή σε τίτλο, διεύθυνση και footer. Εδώ: κανένας ισχυρισμός
  για ανταγωνιστή χωρίς URL και ημερομηνία ελέγχου, κανένα όνομα ανταγωνιστή σε
  διαφήμιση (κανόνας 12 του `docs/org/prompts/03-agora.md`), συγκριτική διαφήμιση
  μόνο κατά το άρθρο 9 του ν.2251/1994 και με νομικό έλεγχο. Οχι αστέρια, όχι
  μαρτυρίες χωρίς γραπτή συναίνεση, όχι εγγραφή σε προϊόν ανταγωνιστή χωρίς απόφαση.
  Μένει χρήσιμο για εσωτερική έρευνα και για τον έλεγχο παλιών ισχυρισμών (asset audit).
- **`site-architecture`**: τα παραδείγματα CTA («Start Free Trial») αντικαθίστανται
  από το `lib/legal/billingWords.ts`· όχι διευθύνσεις `/vs/` με όνομα ανταγωνιστή·
  `noindex` σε σελίδες με δεδομένα χρήστη· πλατφόρμα το δικό μας Next.js, οι
  «Verified Partners» της πηγής δεν είναι σύσταση.
- **`programmatic-seo`**: κάθε αριθμός σε σελίδα κλίμακας από `lib/tax/**`,
  `lib/billing/**`, `lib/facts/**`· όχι scraping· όχι «Profiles» προσώπων, όχι
  «best/top» και κατάλογοι με ονόματα ανταγωνιστών· όχι τοπικές σελίδες που αλλάζουν
  μόνο το όνομα της πόλης.
- **`customer-research`**: η πηγή λέει να μη λέμε ότι κάνουμε έρευνα· εδώ ο σκοπός
  δηλώνεται (ΓΚΠΔ, άρθρα 13–14) και η καταγραφή θέλει ρητή συναίνεση. Αποσπάσματα
  χωρίς όνομα χρήστη ή προφίλ, κανένας κατάλογος ατόμων, όχι cookies, κλειστές ομάδες
  ή εργαλεία με κλειδί API (SparkToro) χωρίς έγκριση, καμία ανάγνωση της βάσης για
  στρατολόγηση, κανένα κίνητρο σε χρήματα χωρίς απόφαση ιδιοκτήτη.

Από κάθε φάκελο της πηγής δεν μπήκε το `evals/evals.json` (δοκιμές της πηγής, όχι
οδηγίες).

## AgriciDaniel/claude-seo (17/11/2026): γράφτηκαν δικά μας, δεν αντιγράφηκε τίποτα

Commit `468ed5b0d9e3249394783710e54abb02837e326b`, άδεια MIT. Αντί για ενσωμάτωση
αυτούσια, γράφτηκαν τέσσερα ελληνικά skills με τους κανόνες του έργου:
`seo-elegxos` (έλεγχος), `seo-onoma` (το όνομα της μάρκας), `seo-ai`
(παραθέσεις από μοντέλα και agents) και `seo-selida` (νέα δημόσια σελίδα). Η
προέλευση και η πλήρης άδεια είναι στο `references/proeleusi.md` καθενός. Τα
`seo-audit`, `ai-seo`, `schema`, `programmatic-seo`, `site-architecture` και
`competitors` μένουν ως βιβλιοθήκη· όπου διαφωνούν, ισχύουν τα νέα.

| Από το claude-seo | Απόφαση | Γιατί |
|---|---|---|
| `seo-technical`: canonical και noindex στο αρχικό HTML, κανένα rendering εκτός 200, όριο 2 MB | προσαρμογή, στο `seo-elegxos` | λείπει από το `seo-audit` και ταιριάζει σε Next με CSP ανά αίτημα |
| `seo-technical`: έλεγχος CVE στοίβας, κεφαλίδες ασφαλείας | απόρριψη | το καλύπτουν ήδη το `npm run security` και οι φύλακες |
| Βαθμολόγηση E-E-A-T με συντελεστές | προσαρμογή, στο `seo-elegxos` | δίνει σειρά· δηλώνεται ως ευρετική, με απόδειξη από το `lib/legal/validity.ts` |
| Σχέδιο ενεργειών με «πώς θα ξέρεις ότι απέτυχε» | προσαρμογή, πρότυπο στο `seo-elegxos` | το `seo-audit` δεν έχει μέτρηση επιτυχίας ανά ενέργεια |
| `data/google-updates.json` | προσαρμογή, πίνακας στο `seo-elegxos` | ημερομηνίες με πηγή Google· δεν ξαναελέγχθηκαν από εμάς |
| `seo-geo`: πίνακας σαρωτή ανά ισχυρισμό, «η γενετική αναζήτηση είναι SEO» | προσαρμογή, στο `seo-ai` | το `ai-seo` έχει τους σαρωτές αλλά όχι τον κανόνα ισχυρισμού |
| `seo-geo`: στατιστικά τρίτων και βάρη 25/20/15/20/20 | απόρριψη | αριθμοί χωρίς πρωτογενή πηγή |
| `seo-agentic`: σειρά προτεραιοτήτων και κανόνες ειλικρινούς αναφοράς | προσαρμογή, στο `seo-ai` | το `ai-seo` περιγράφει, δεν βάζει σειρά |
| `seo-agentic`: Lighthouse μέσω PSI, έλεγχος WAF με ξένα user-agent | απόρριψη | κλήσεις σε υπηρεσία και αιτήματα που υποδύονται τρίτους |
| `llms.txt` | κράτημα της στάσης «δεν είναι μοχλός» | το δικό μας ήδη χτίζεται από τον κατάλογο |
| `seo-hreflang` | προσαρμογή, στο `seo-selida` | καλύπτεται σχεδόν όλο από το `seo-audit`· μένουν οι έλεγχοι για το ζεύγος el/en |
| `seo-cluster`: σύνδεση κόμβου και μελών | προσαρμογή, στο `seo-elegxos` και `seo-selida` | ταιριάζει στους κόμβους θεμάτων |
| `quality-gates`: doorway pages, σελίδες κλίμακας | προσαρμογή, στο `seo-selida` | συμφωνεί με το `programmatic-seo` και την κεφαλίδα του |
| `quality-gates`: ελάχιστα πλήθη λέξεων | απόρριψη | η Google δεν βαθμολογεί με πλήθος λέξεων |
| `seo-local`, `seo-maps` | απόρριψη | δεν έχουμε φυσικό κατάστημα· τα maps θέλουν DataForSEO |
| `seo-backlinks`, `seo-dataforseo`, `seo-google`, `seo-drift` | απόρριψη | κλειδιά API, πληρωμένες υπηρεσίες ή αποθήκευση στοιχείων εκτός έργου |
| `seo-image-gen`, `seo-flow`, `seo-content-brief`, `seo-sxo`, `seo-plan` | απόρριψη | παραγωγή εικόνων με πληρωμένο API ή γενικό υλικό που καλύπτουν τα υπάρχοντα |
| `seo-ecommerce`, επέκταση Shopify | απόρριψη | δεν είμαστε κατάστημα |
| `extensions/*` (Ahrefs, SE Ranking, Profound, Firecrawl, PostHog, Matomo, Bing, Unlighthouse) | απόρριψη | κλήσεις σε τρίτους με κλειδί |
| `scripts/`, `hooks/`, `install.sh`, Python | απόρριψη | κώδικας τρίτου· δεν εκτελέστηκε |
| Υποσέλιδο κοινότητας, σύνδεσμοι skool.com, PDF «αναφοράς» | απόρριψη | διαφήμιση του δημιουργού |


## Ενημέρωση, μόνο χειροκίνητα

1. Κλωνοποίησε το αποθετήριο σε άδειο φάκελο έξω από το έργο:
   `git clone --depth 1 https://github.com/<owner>/<repo> <φάκελος>`.
   Μην τρέξεις τίποτα από μέσα του.
2. Γράψε το νέο commit: `git -C <φάκελος> rev-parse HEAD`.
3. Δες τι άλλαξε στα αρχεία που κρατάμε:
   `git -C <φάκελος> diff <παλιό-commit> HEAD -- skills/<όνομα>`
   (χρειάζεται `--depth` αρκετό ή πλήρη κλώνο). Διάβασε όλη τη διαφορά. Ψάξε για
   νέες εντολές εκτέλεσης, εγκαταστάσεις, διευθύνσεις δικτύου, «MUST use» σε κάθε
   αίτημα και οδηγίες που ζητούν να αγνοηθούν οι κανόνες του έργου.
4. Αντέγραψε μόνο τα `.md`, κράτα την κεφαλίδα και άλλαξε σε αυτήν το commit.
5. `npm run guards` με κωδικό εξόδου 0 και PR με το παλιό και το νέο commit στην
   περιγραφή.

## Τι απορρίφθηκε και γιατί

### obra/superpowers (το υπόλοιπο)

- **Hook SessionStart** (`hooks/hooks.json`, `hooks/session-start`): σε κάθε
  εκκίνηση, `clear` και `compact` εισάγει στο πλαίσιο το `using-superpowers` μέσα
  σε `<EXTREMELY_IMPORTANT>`. Εκείνο λέει ότι αν υπάρχει «1% πιθανότητα» να ταιριάζει
  ένα skill, η χρήση του είναι υποχρεωτική πριν από κάθε απάντηση ή ερώτηση και ότι
  πριν από plan mode προηγείται brainstorming. Επιβάλλει ξένη ροή σε κάθε αίτημα.
- **`brainstorming`, ο οπτικός σύντροφος** (`visual-companion.md`, `scripts/server.cjs`):
  τοπικός διακομιστής Node που φορτώνει λογότυπο από `primeradiant.com` με την έκδοση
  του superpowers (το README το ονομάζει telemetry). Το υπόλοιπο `brainstorming`
  διασκευάστηκε ως `skepsi`, χωρίς το «You MUST use this before any creative work».
- **`executing-plans`**: καλύπτεται από `sxedio`, `anathesi` και `parallila`· τα scripts
  του (`task-start`, `task-done`) δεν χρειάζονται.
- **Τα scripts** των `subagent-driven-development` και `executing-plans` (`sdd-workspace`,
  `task-brief`, `review-package`, `sdd-repo`) και το `rm -rf` του χώρου εργασίας τους.
- **`diagnosing-superpowers`**: αφορά μόνο το ίδιο το superpowers.

### coreyhaines31/marketingskills (τα υπόλοιπα 43)

- Το plugin είναι η ρίζα του αποθετηρίου, άρα φέρνει και τα `tools/clis/*.js`
  (Google Ads, GA4, Klaviyo, Apollo κ.λπ. με κλειδιά API). Τα skills τα καλούν.
- `offers`, `popups`, `marketing-psychology`, `launch`: σπανιότητα, αντίστροφη
  μέτρηση και επείγον ως τακτικές. Ακόμη κι όταν γράφουν «μόνο αν είναι αληθινό»,
  δεν ταιριάζουν με τους κανόνες μας για χρέωση και ύφος.
- `ad-creative`, `video`, `image`, `social`: προτείνουν εργαλεία παραγωγής εικόνας,
  βίντεο και φωνής. Εχουμε κανόνα χωρίς συνθετική φωνή που υποδύεται άνθρωπο.
  Αναρτήσεις γράφονται με το `anartisi`.
- `cold-email`, `prospecting`, `sms`, `emails`: μαζική εξερχόμενη επικοινωνία με
  προσωπικά δεδομένα. Θέλει χωριστή απόφαση και νομικό έλεγχο.
- `copywriting`, `copy-editing`: γραμμένα για αγγλικό κείμενο. Το `anartisi` καλύπτει
  τα ελληνικά σημάδια κειμένου μηχανής.
- `competitor-profiling`: scraping ιστοτόπων ανταγωνιστών (Firecrawl) και δεδομένα
  SEO μέσω MCP με κλειδιά API (DataForSEO, Ahrefs, Semrush). Η έρευνα για
  ανταγωνιστές γίνεται με το `competitors` και τους κανόνες της κεφαλίδας του.

### Panniantong/agent-reach (ολόκληρο)

Δεν είναι skill. Είναι πακέτο Python (`agent-reach`) που εγκαθίσταται από
`https://github.com/Panniantong/agent-reach/archive/main.zip` χωρίς καρφίτσωμα και
με `--system` εγκαθιστά καθολικά `mcporter`, OpenCLI, twitter-cli, bili-cli, rdt-cli
και yt-dlp. Γράφει δικό του skill στο `~/.claude/skills/agent-reach` που λέει «MUST
USE» για κάθε έρευνα στο διαδίκτυο και ζητά από το μοντέλο να προτείνει ενημέρωση
από το `main`.

Τι θα χρειαζόταν: cookies λογαριασμών X, Reddit, Facebook, Instagram ή XiaoHongShu
(εξαγωγή με Cookie-Editor ή ανάγνωση από το Chrome με `browser-cookie3`/`rookiepy`).
Ενα cookie δίνει πλήρη πρόσβαση στον λογαριασμό. Η ανάγνωση σελίδων περνά από το
`r.jina.ai` και η αναζήτηση από το `mcp.exa.ai`, δηλαδή κάθε διεύθυνση που διαβάζουμε
φεύγει σε τρίτο. Η συλλογή με cookies από X, Reddit, Facebook και Instagram έρχεται
σε αντίθεση με τους όρους χρήσης τους.

Τι έχουμε ήδη: `WebSearch` και `WebFetch` στο Claude Code, το Grok για το X
(`docs/org/ergaleia/grok.md`, παράδοση μέσω `ops.handoffs`) και το `gh` για το GitHub.

Αν ο ιδιοκτήτης το θέλει παρ' όλα αυτά: δεύτερος λογαριασμός ανά πλατφόρμα, μηχάνημα
εκτός του έργου, πακέτο καρφιτσωμένο σε commit και καμία πρόσβαση στο αποθετήριο ή
στη Supabase από εκείνο το μηχάνημα.

Ομάδα Properwise
