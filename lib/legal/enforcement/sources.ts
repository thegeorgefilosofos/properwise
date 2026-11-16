// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΠΗΓΕΣ ΚΑΘΕ ΚΑΝΟΝΑ ΤΗΣ ΠΡΟΣΤΑΣΙΑΣ ΙΔΙΟΚΤΗΤΗ, ΜΕ ΤΟ ΑΥΤΟΥΣΙΟ ΑΠΟΣΠΑΣΜΑ
// ─────────────────────────────────────────────────────────────────────────
// Δύο πηγές ανά κανόνα: το ΕΠΙΣΗΜΟ κείμενο (το ΦΕΚ, όπως εξήχθη από το PDF που
// διαθέτει δημόσια η σελίδα του νόμου στο kodiko.gr) και μια ΑΝΕΞΑΡΤΗΤΗ πηγή
// (η σελίδα του άρθρου στο taxheaven.gr, με το κείμενο της διάταξης ή την
// κωδικοποίησή της). Το `excerpt` είναι λίστα τμημάτων· κάθε τμήμα υπάρχει
// αυτούσιο στο στιγμιότυπο του `snapshot` (docs/legal/enforcement-sources/).
//
// ΤΑ ΣΤΙΓΜΙΟΤΥΠΑ ΕΙΝΑΙ ΣΥΜΠΙΕΣΜΕΝΑ (.txt.gz) ΓΙΑ ΕΝΑΝ ΛΟΓΟ: είναι αυτούσιο κείμενο
// νόμου, με το κόμμα πριν από το «και» και τα ίσια εισαγωγικά του ΦΕΚ. Οι τυπογραφικοί φύλακες
// θα ζητούσαν να «διορθωθεί» και ένα διορθωμένο απόσπασμα νόμου δεν είναι πια
// απόσπασμα. Διαβάζονται με `gzip -dc <αρχείο>`.
//
// ΔΕΝ ΔΙΟΡΘΩΝΕΤΑΙ ΜΕ ΤΟ ΧΕΡΙ. Ο φύλακας scripts/guard-enforcement-rules.mjs
// κόβει απόσπασμα που δεν βρίσκεται στο στιγμιότυπό του. Αν άλλαξε ο νόμος,
// ξανακατεβαίνει η πηγή, ξαναγράφεται το στιγμιότυπο και ανεβαίνει το
// `version` του κανόνα.
//
// Λήψη και αντιπαραβολή: 12/11/2026, από την ομάδα (verifier 'properwise-team').
// Αυτό ΔΕΝ είναι έλεγχος δικηγόρου· εκείνος γράφεται χωριστά (`lawyerReviewed`).
// ═══════════════════════════════════════════════════════════════════════════
import type { RuleSource } from './types';

export const SOURCES: Record<string, readonly RuleSource[]> = {
  'regime-126-7': [
    {
      kind: 'official',
      title: "ν. 5221/2025, ΦΕΚ Α' 133/28.07.2025 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1205557/nomos-5221-2025",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2025/a/fek_a_133_2025.pdf&t=5cd568ed2538948ba3f412600d41264a",
      excerpt: ["Οι διατάξεις του παρόντος για την αναγκαστική εκτέλεση εφαρμόζονται για όσες επιταγές προς εκτέλεση επιδοθούν από την 1η.1.2026."],
      snapshot: "docs/legal/enforcement-sources/fek-a-133-2025--regime-126-7.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5221/2025 άρθρο 126",
      url: "https://www.taxheaven.gr/law/5221/2025/arthro/126",
      excerpt: ["Οι διατάξεις του παρόντος για την αναγκαστική εκτέλεση εφαρμόζονται για όσες επιταγές προς εκτέλεση επιδοθούν από την 1η.1.2026."],
      snapshot: "docs/legal/enforcement-sources/th-5221-2025-126.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'aug-147-2': [
    {
      kind: 'official',
      title: "ν. 5282/2026, ΦΕΚ Α' 30/27.02.2026 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1290222/nomos-5282-2026",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2026/a/fek_a_30_2026.pdf&t=0f9d4237b48ad3c19cdee376d46ad171",
      excerpt: ["Το χρονικό διάστημα από 1 έως 31 Αυγούστου δεν υπολογίζεται για τις προθεσμίες των άρθρων", "926 παρ. 2, 934 παρ. 1 στοιχ. Α’ και β’", "973, 974"],
      snapshot: "docs/legal/enforcement-sources/fek-a-30-2026--aug-147-2.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5282/2026 άρθρο 15",
      url: "https://www.taxheaven.gr/law/5282/2026/arthro/15",
      excerpt: ["Το χρονικό διάστημα από 1 έως 31 Αυγούστου δεν υπολογίζεται για τις προθεσμίες των άρθρων", "926 παρ. 2, 934 παρ. 1 στοιχ. Α’ και β’", "973, 974"],
      snapshot: "docs/legal/enforcement-sources/th-5282-2026-15.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'an-934a-new': [
    {
      kind: 'official',
      title: "ν. 5221/2025, ΦΕΚ Α' 133/28.07.2025 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1205557/nomos-5221-2025",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2025/a/fek_a_133_2025.pdf&t=5cd568ed2538948ba3f412600d41264a",
      excerpt: ["μέσα σε σαράντα πέντε (45) ημέρες από την ημέρα της κατάσχεσης"],
      snapshot: "docs/legal/enforcement-sources/fek-a-133-2025--an-934a-new.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5221/2025 άρθρο 105",
      url: "https://www.taxheaven.gr/law/5221/2025/arthro/105",
      excerpt: ["μέσα σε σαράντα πέντε (45) ημέρες από την ημέρα της κατάσχεσης"],
      snapshot: "docs/legal/enforcement-sources/th-5221-2025-105.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'ka-993-window': [
    {
      kind: 'official',
      title: "ν. 4842/2021, ΦΕΚ Α' 190/13.10.2021 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/753061/nomos-4842-2021",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2021/a/fek_a_190_2021.pdf&t=2342564544ce02fb5f3e192c1404185d",
      excerpt: ["ορίζεται υποχρεωτικά σε επτά (7) μήνες από την ημερομηνία περάτωσης της κατάσχεσης και πάντως όχι μετά την παρέλευση οκτώ (8) μηνών από την ημερομηνία αυτή", "Εάν η παραπάνω προθεσμία συμπληρώνεται τον μήνα Αύγουστο, τότε για τον υπολογισμό της λαμβάνεται υπόψη ο επόμενος μήνας"],
      snapshot: "docs/legal/enforcement-sources/fek-a-190-2021--ka-993-window.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 4842/2021 άρθρο 76",
      url: "https://www.taxheaven.gr/law/4842/2021/arthro/76",
      excerpt: ["ορίζεται υποχρεωτικά σε επτά (7) μήνες από την ημερομηνία περάτωσης της κατάσχεσης και πάντως όχι μετά την παρέλευση οκτώ (8) μηνών από την ημερομηνία αυτή", "Εάν η παραπάνω προθεσμία συμπληρώνεται τον μήνα Αύγουστο, τότε για τον υπολογισμό της λαμβάνεται υπόψη ο επόμενος μήνας"],
      snapshot: "docs/legal/enforcement-sources/th-4842-2021-76.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'ka-954-2e-movable': [
    {
      kind: 'official',
      title: "ν. 5282/2026, ΦΕΚ Α' 30/27.02.2026 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1290222/nomos-5282-2026",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2026/a/fek_a_30_2026.pdf&t=0f9d4237b48ad3c19cdee376d46ad171",
      excerpt: ["η οποία ορίζεται υποχρεωτικά σε πέντε (5) μήνες από την ημέρα περάτωσης της κατάσχεσης", "και όχι πάντως μετά την παρέλευση έξι (6) μηνών"],
      snapshot: "docs/legal/enforcement-sources/fek-a-30-2026--ka-954-2e-movable.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5282/2026 άρθρο 37",
      url: "https://www.taxheaven.gr/law/5282/2026/arthro/37",
      excerpt: ["η οποία ορίζεται υποχρεωτικά σε πέντε (5) μήνες από την ημέρα περάτωσης της κατάσχεσης", "και όχι πάντως μετά την παρέλευση έξι (6) μηνών"],
      snapshot: "docs/legal/enforcement-sources/th-5282-2026-37.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'ka-954-4-new': [
    {
      kind: 'official',
      title: "ν. 5221/2025, ΦΕΚ Α' 133/28.07.2025 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1205557/nomos-5221-2025",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2025/a/fek_a_133_2025.pdf&t=5cd568ed2538948ba3f412600d41264a",
      excerpt: ["Η ανακοπή είναι απαράδεκτη, αν δεν κατατεθεί το αργότερο τριάντα (30) εργάσιμες ημέρες πριν από την ημέρα του πλειστηριασμού."],
      snapshot: "docs/legal/enforcement-sources/fek-a-133-2025--ka-954-4-new.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5221/2025 άρθρο 111",
      url: "https://www.taxheaven.gr/law/5221/2025/arthro/111",
      excerpt: ["Η ανακοπή είναι απαράδεκτη, αν δεν κατατεθεί το αργότερο τριάντα (30) εργάσιμες ημέρες πριν από την ημέρα του πλειστηριασμού."],
      snapshot: "docs/legal/enforcement-sources/th-5221-2025-111.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'ka-954-4-old': [
    {
      kind: 'official',
      title: "ν. 4842/2021, ΦΕΚ Α' 190/13.10.2021 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/753061/nomos-4842-2021",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2021/a/fek_a_190_2021.pdf&t=2342564544ce02fb5f3e192c1404185d",
      excerpt: ["Η ανακοπή είναι απαράδεκτη, αν δεν κατατεθεί το αργότερο δεκαπέντε (15) εργάσιμες ημέρες πριν από την ημέρα του πλειστηριασμού."],
      snapshot: "docs/legal/enforcement-sources/fek-a-190-2021--ka-954-4-old.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 4842/2021 άρθρο 63",
      url: "https://www.taxheaven.gr/law/4842/2021/arthro/63",
      excerpt: ["Η ανακοπή είναι απαράδεκτη, αν δεν κατατεθεί το αργότερο δεκαπέντε (15) εργάσιμες ημέρες πριν από την ημέρα του πλειστηριασμού."],
      snapshot: "docs/legal/enforcement-sources/th-4842-2021-63.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'as-938-4-new': [
    {
      kind: 'official',
      title: "ν. 5221/2025, ΦΕΚ Α' 133/28.07.2025 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1205557/nomos-5221-2025",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2025/a/fek_a_133_2025.pdf&t=5cd568ed2538948ba3f412600d41264a",
      excerpt: ["Η αίτηση με την οποία ζητείται η αναστολή πλειστηριασμού είναι απαράδεκτη, αν δεν κατατεθεί το αργότερο δεκαπέντε (15) εργάσιμες ημέρες πριν από την ημέρα του πλειστηριασμού.", "Η απόφαση πρέπει να δημοσιεύεται έως τις 12.00 το μεσημέρι της Δευτέρας που προηγείται του πλειστηριασμού."],
      snapshot: "docs/legal/enforcement-sources/fek-a-133-2025--as-938-4-new.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5221/2025 άρθρο 107",
      url: "https://www.taxheaven.gr/law/5221/2025/arthro/107",
      excerpt: ["Η αίτηση με την οποία ζητείται η αναστολή πλειστηριασμού είναι απαράδεκτη, αν δεν κατατεθεί το αργότερο δεκαπέντε (15) εργάσιμες ημέρες πριν από την ημέρα του πλειστηριασμού.", "Η απόφαση πρέπει να δημοσιεύεται έως τις 12.00 το μεσημέρι της Δευτέρας που προηγείται του πλειστηριασμού."],
      snapshot: "docs/legal/enforcement-sources/th-5221-2025-107.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'as-938-4-old': [
    {
      kind: 'official',
      title: "ν. 4842/2021, ΦΕΚ Α' 190/13.10.2021 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/753061/nomos-4842-2021",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2021/a/fek_a_190_2021.pdf&t=2342564544ce02fb5f3e192c1404185d",
      excerpt: ["Η αίτηση με την οποία ζητείται η αναστολή πλειστηριασμού είναι απαράδεκτη, αν δεν κατατεθεί το αργότερο πέντε (5) εργάσιμες ημέρες πριν από την ημέρα του πλειστηριασμού."],
      snapshot: "docs/legal/enforcement-sources/fek-a-190-2021--as-938-4-old.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5221/2025 άρθρο 107",
      url: "https://www.taxheaven.gr/law/5221/2025/arthro/107",
      excerpt: ["οι λέξεις «πέντε (5)» αντικαθίστανται από τις λέξεις «δεκαπέντε (15)»"],
      snapshot: "docs/legal/enforcement-sources/th-5221-2025-107.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'ka-998-2': [
    {
      kind: 'official',
      title: "ν. 5221/2025, ΦΕΚ Α' 133/28.07.2025 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1205557/nomos-5221-2025",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2025/a/fek_a_133_2025.pdf&t=5cd568ed2538948ba3f412600d41264a",
      excerpt: ["Ο πλειστηριασμός δεν μπορεί να γίνει από την 1η έως και τις 31 Αυγούστου"],
      snapshot: "docs/legal/enforcement-sources/fek-a-133-2025--ka-998-2.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5221/2025 άρθρο 119",
      url: "https://www.taxheaven.gr/law/5221/2025/arthro/119",
      excerpt: ["Ο πλειστηριασμός δεν μπορεί να γίνει από την 1η έως και τις 31 Αυγούστου"],
      snapshot: "docs/legal/enforcement-sources/th-5221-2025-119.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'ka-998-6': [
    {
      kind: 'official',
      title: "ν. 5221/2025, ΦΕΚ Α' 133/28.07.2025 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1205557/nomos-5221-2025",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2025/a/fek_a_133_2025.pdf&t=5cd568ed2538948ba3f412600d41264a",
      excerpt: ["εβδομήντα τοις εκατό (70%) της αρχικώς ορισθείσας τιμής πρώτης προσφοράς"],
      snapshot: "docs/legal/enforcement-sources/fek-a-133-2025--ka-998-6.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5221/2025 άρθρο 119",
      url: "https://www.taxheaven.gr/law/5221/2025/arthro/119",
      excerpt: ["εβδομήντα τοις εκατό (70%) της αρχικώς ορισθείσας τιμής πρώτης προσφοράς"],
      snapshot: "docs/legal/enforcement-sources/th-5221-2025-119.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'as-973-window': [
    {
      kind: 'official',
      title: "ν. 5221/2025, ΦΕΚ Α' 133/28.07.2025 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1205557/nomos-5221-2025",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2025/a/fek_a_133_2025.pdf&t=5cd568ed2538948ba3f412600d41264a",
      excerpt: ["δύο (2) μήνες από την ημέρα της δήλωσης και όχι πάντως μετά την παρέλευση τριών (3) μηνών"],
      snapshot: "docs/legal/enforcement-sources/fek-a-133-2025--as-973-window.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5221/2025 άρθρο 115",
      url: "https://www.taxheaven.gr/law/5221/2025/arthro/115",
      excerpt: ["δύο (2) μήνες από την ημέρα της δήλωσης και όχι πάντως μετά την παρέλευση τριών (3) μηνών"],
      snapshot: "docs/legal/enforcement-sources/th-5221-2025-115.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'ex-18-cutoff': [
    {
      kind: 'official',
      title: "ν. 4738/2020, ΦΕΚ Α' 207/27.10.2020 (αρχικό κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/647304/nomos-4738-2020",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2020/a/fek_a_207_2020.pdf&t=a74a99a64e5e3c1887ec7cca4ff6be32",
      excerpt: ["Η αναστολή της παρούσας δεν καταλαμβάνει την διενέργεια πλειστηριασμού", "έχει προγραμματισθεί εντός τριών (3) μηνών από την ημερομηνία"],
      snapshot: "docs/legal/enforcement-sources/fek-a-207-2020--ex-18-cutoff.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 4738/2020 άρθρο 18 (κωδικοποίηση)",
      url: "https://www.taxheaven.gr/law/4738/2020/arthro/18",
      excerpt: ["Η αναστολή της παρούσας δεν καταλαμβάνει την διενέργεια πλειστηριασμού", "έχει προγραμματισθεί εντός τριών (3) μηνών από την ημερομηνία οριστικής υποβολής της αίτησης"],
      snapshot: "docs/legal/enforcement-sources/th-4738-2020-18.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'sv-182': [
    {
      kind: 'official',
      title: "ν. 5354/2026, ΦΕΚ Α' 184/09.11.2026 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1363462/nomos-5354-2026",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2026/a/fek_a_184_2026.pdf&t=9d1add8a50c999710d3cc830f52415c1",
      excerpt: ["τρεις (3) τουλάχιστον μήνες πριν από τη διενέργεια του πλειστηριασμού", "Η υποχρέωση αυτή προκύπτει άπαξ για πλειστηριασμό που επισπεύδεται το πρώτον", "δεν αφορά τους επαναλαμβανόμενους πλειστηριασμούς", "δεν υφίσταται, αν ο οφειλέτης δεν έχει εγγραφεί στο σύστημα προσωποποιημένης πληροφόρησης", "και αν δεν έχει ανταποκριθεί σε αίτημα του πιστωτή για την παροχή των στοιχείων οικονομικής και περιουσιακής κατάστασης"],
      snapshot: "docs/legal/enforcement-sources/fek-a-184-2026--sv-182.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5354/2026 άρθρο 17",
      url: "https://www.taxheaven.gr/law/5354/2026/arthro/17",
      excerpt: ["τρεις (3) τουλάχιστον μήνες πριν από τη διενέργεια του πλειστηριασμού", "Η υποχρέωση αυτή προκύπτει άπαξ για πλειστηριασμό που επισπεύδεται το πρώτον", "δεν αφορά τους επαναλαμβανόμενους πλειστηριασμούς", "δεν υφίσταται, αν ο οφειλέτης δεν έχει εγγραφεί στο σύστημα προσωποποιημένης πληροφόρησης", "και αν δεν έχει ανταποκριθεί σε αίτημα του πιστωτή για την παροχή των στοιχείων οικονομικής και περιουσιακής κατάστασης"],
      snapshot: "docs/legal/enforcement-sources/th-5354-2026-17.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'sv-37a': [
    {
      kind: 'official',
      title: "ν. 5354/2026, ΦΕΚ Α' 184/09.11.2026 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1363462/nomos-5354-2026",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2026/a/fek_a_184_2026.pdf&t=9d1add8a50c999710d3cc830f52415c1",
      excerpt: ["εντός σαράντα πέντε (45) ημερών", "η απαίτηση δεν παράγει συμβατικούς τόκους ή τόκους υπερημερίας"],
      snapshot: "docs/legal/enforcement-sources/fek-a-184-2026--sv-37a.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5354/2026 άρθρο 13",
      url: "https://www.taxheaven.gr/law/5354/2026/arthro/13",
      excerpt: ["εντός σαράντα πέντε (45) ημερών", "η απαίτηση δεν παράγει συμβατικούς τόκους ή τόκους υπερημερίας"],
      snapshot: "docs/legal/enforcement-sources/th-5354-2026-13.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'sv-37g': [
    {
      kind: 'official',
      title: "ν. 5354/2026, ΦΕΚ Α' 184/09.11.2026 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1363462/nomos-5354-2026",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2026/a/fek_a_184_2026.pdf&t=9d1add8a50c999710d3cc830f52415c1",
      excerpt: ["η επίσπευση ή συνέχιση πλειστηριασμού"],
      snapshot: "docs/legal/enforcement-sources/fek-a-184-2026--sv-37g.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5354/2026 άρθρο 15",
      url: "https://www.taxheaven.gr/law/5354/2026/arthro/15",
      excerpt: ["η επίσπευση ή συνέχιση πλειστηριασμού"],
      snapshot: "docs/legal/enforcement-sources/th-5354-2026-15.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'sv-63a': [
    {
      kind: 'official',
      title: "ν. 5354/2026, ΦΕΚ Α' 184/09.11.2026 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1363462/nomos-5354-2026",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2026/a/fek_a_184_2026.pdf&t=9d1add8a50c999710d3cc830f52415c1",
      excerpt: ["Αίτηση που υποβάλλεται εντός τριών (3) μηνών από την ημερομηνία κατά την οποία έχει προγραμματισθεί πλειστηριασμός, δεν αναστέλλει τον πλειστηριασμό."],
      snapshot: "docs/legal/enforcement-sources/fek-a-184-2026--sv-63a.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'official',
      title: "ν. 5354/2026, ΦΕΚ Α' 184/09.11.2026 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1363462/nomos-5354-2026",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2026/a/fek_a_184_2026.pdf&t=9d1add8a50c999710d3cc830f52415c1",
      excerpt: ["Η ισχύς των άρθρων 18 έως 34 και 39 έως 41 αρχίζει τρεις (3) μήνες από τη δημοσίευση του παρόντος."],
      snapshot: "docs/legal/enforcement-sources/fek-a-184-2026--sv-63a-2.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5354/2026 άρθρο 19",
      url: "https://www.taxheaven.gr/law/5354/2026/arthro/19",
      excerpt: ["Αίτηση που υποβάλλεται εντός τριών (3) μηνών από την ημερομηνία κατά την οποία έχει προγραμματισθεί πλειστηριασμός, δεν αναστέλλει τον πλειστηριασμό."],
      snapshot: "docs/legal/enforcement-sources/th-5354-2026-19.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5354/2026 άρθρο 392",
      url: "https://www.taxheaven.gr/law/5354/2026/arthro/392",
      excerpt: ["Η ισχύς των άρθρων 18 έως 34 και 39 έως 41 αρχίζει τρεις (3) μήνες από τη δημοσίευση του παρόντος."],
      snapshot: "docs/legal/enforcement-sources/th-5354-2026-392.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'ds-120-aade': [
    {
      kind: 'official',
      title: "ν. 5354/2026, ΦΕΚ Α' 184/09.11.2026 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1363462/nomos-5354-2026",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2026/a/fek_a_184_2026.pdf&t=9d1add8a50c999710d3cc830f52415c1",
      excerpt: ["σε έως και εκατόν είκοσι (120) μηνιαίες δόσεις", "οι λέξεις \"εβδομήντα δύο (72)\" αντικαθίστανται από τις λέξεις \"εκατόν είκοσι (120)\"", "υποβάλλεται ηλεκτρονικά στη φορολογική διοίκηση μέχρι την 30ή.6.2027"],
      snapshot: "docs/legal/enforcement-sources/fek-a-184-2026--ds-120-aade.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5354/2026 άρθρο 35",
      url: "https://www.taxheaven.gr/law/5354/2026/arthro/35",
      excerpt: ["σε έως και εκατόν είκοσι (120) μηνιαίες δόσεις", "οι λέξεις \"εβδομήντα δύο (72)\" αντικαθίστανται από τις λέξεις \"εκατόν είκοσι (120)\"", "υποβάλλεται ηλεκτρονικά στη φορολογική διοίκηση μέχρι την 30ή.6.2027"],
      snapshot: "docs/legal/enforcement-sources/th-5354-2026-35.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'ds-120-efka': [
    {
      kind: 'official',
      title: "ν. 5354/2026, ΦΕΚ Α' 184/09.11.2026 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1363462/nomos-5354-2026",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2026/a/fek_a_184_2026.pdf&t=9d1add8a50c999710d3cc830f52415c1",
      excerpt: ["οι λέξεις \"εβδομήντα δύο (72)\" αντικαθίστανται από τις λέξεις \"εκατόν είκοσι (120)\"", "μέχρι την 30ή.6.2027"],
      snapshot: "docs/legal/enforcement-sources/fek-a-184-2026--ds-120-efka.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5354/2026 άρθρο 36",
      url: "https://www.taxheaven.gr/law/5354/2026/arthro/36",
      excerpt: ["οι λέξεις \"εβδομήντα δύο (72)\" αντικαθίστανται από τις λέξεις \"εκατόν είκοσι (120)\"", "μέχρι την 30ή.6.2027"],
      snapshot: "docs/legal/enforcement-sources/th-5354-2026-36.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'ex-3pct': [
    {
      kind: 'official',
      title: "ν. 5354/2026, ΦΕΚ Α' 184/09.11.2026 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/1363462/nomos-5354-2026",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2026/a/fek_a_184_2026.pdf&t=9d1add8a50c999710d3cc830f52415c1",
      excerpt: ["τρία τοις εκατό (3%) ετησίως", "για καταβολές από την 1η.12.2026"],
      snapshot: "docs/legal/enforcement-sources/fek-a-184-2026--ex-3pct.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 5354/2026 άρθρο 366",
      url: "https://www.taxheaven.gr/law/5354/2026/arthro/366",
      excerpt: ["τρία τοις εκατό (3%) ετησίως", "για καταβολές από την 1η.12.2026"],
      snapshot: "docs/legal/enforcement-sources/th-5354-2026-366.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
  'regime-4842-2022': [
    {
      kind: 'official',
      title: "ν. 4842/2021, ΦΕΚ Α' 190/13.10.2021 (κείμενο του ΦΕΚ)",
      url: "https://www.kodiko.gr/nomothesia/document/753061/nomos-4842-2021",
      fileUrl: "https://www.kodiko.gr/nomologia/download_fek?f=fek/2021/a/fek_a_190_2021.pdf&t=2342564544ce02fb5f3e192c1404185d",
      excerpt: ["Το άρθρο 938 του Κώδικα Πολιτικής Δικονομίας, όπως προστίθεται με το άρθρο 60 του παρόντος, εφαρμόζεται όταν η επίδοση της επιταγής προς εκτέλεση", "Η ισχύς του Μέρους Α’ και των άρθρων 116 και 119 του Μέρους Δ’ αρχίζει την 1η.1.2022."],
      snapshot: "docs/legal/enforcement-sources/fek-a-190-2021--regime-4842-2022.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 4842/2021 άρθρο 116",
      url: "https://www.taxheaven.gr/law/4842/2021/arthro/116",
      excerpt: ["Το άρθρο 938 του Κώδικα Πολιτικής Δικονομίας, όπως προστίθεται με το άρθρο 60 του παρόντος, εφαρμόζεται όταν η επίδοση της επιταγής προς εκτέλεση"],
      snapshot: "docs/legal/enforcement-sources/th-4842-2021-116.txt.gz",
      checkedAt: '2026-11-12',
    },
    {
      kind: 'independent',
      title: "taxheaven: ν. 4842/2021 άρθρο 120",
      url: "https://www.taxheaven.gr/law/4842/2021/arthro/120",
      excerpt: ["Η ισχύς του Μέρους Α’ και των άρθρων 116 και 119 του Μέρους Δ’ αρχίζει την 1η.1.2022."],
      snapshot: "docs/legal/enforcement-sources/th-4842-2021-120.txt.gz",
      checkedAt: '2026-11-12',
    },
  ],
};
