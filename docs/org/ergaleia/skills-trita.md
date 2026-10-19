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
- **`brainstorming`**: «You MUST use this before any creative work» και τοπικός
  διακομιστής Node (`scripts/server.cjs`) για οπτικό σύντροφο. Ο διακομιστής φορτώνει
  λογότυπο από `primeradiant.com` με την έκδοση του superpowers (το README το
  ονομάζει telemetry, απενεργοποιείται με `SUPERPOWERS_DISABLE_TELEMETRY`).
- **`test-driven-development`**, **`writing-skills`**: «Write code before the test?
  Delete it. Start over.» Δεν ταιριάζει σε κείμενα, migrations ή αλλαγές με πηγή ΦΕΚ.
- **`finishing-a-development-branch`**: προτείνει push και άνοιγμα PR. Εδώ αυτά
  τα αποφασίζει ο ιδιοκτήτης.
- **`subagent-driven-development`**, **`executing-plans`**, **`writing-plans`**,
  **`using-git-worktrees`**, **`requesting-code-review`**: δική τους ροή με scripts
  (`sdd-workspace`, `task-brief`, `task-start`) και `rm -rf` του χώρου εργασίας.
  Εχουμε ήδη ροή worktree και αξιολόγηση από το Codex.
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
