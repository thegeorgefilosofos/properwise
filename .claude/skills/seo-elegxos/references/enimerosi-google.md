# Αλλαγές της Google που αφορούν τον έλεγχο

Από το ημερολόγιο `data/google-updates.json` του claude-seo, commit
`468ed5b0d9e3249394783710e54abb02837e326b`, με `last_verified` 2026-11-10. Κάθε
γραμμή εκεί παραπέμπει σε σελίδα της Google. **Εμείς δεν τις ξαναδιαβάσαμε**
(17/11/2026): πριν γράψεις μία από αυτές σε αναφορά ή σε PR ως γεγονός, άνοιξε
την πηγή της.

Οταν πέφτει η κίνηση, κοίτα πρώτα αν η ημερομηνία συμπίπτει με ενημέρωση εδώ,
μετά με δική μας ανάπτυξη (`git log --since`). Μόνο μετά ψάξε αλλού.

| Ημερομηνία | Τι | Γιατί μας αφορά | Πηγή |
|---|---|---|---|
| 2025-12-11 | Ενημέρωση πυρήνα Δεκεμβρίου 2025 | σύγκριση πτώσεων | status.search.google.com |
| 2026-03-24 | Ενημέρωση spam Μαρτίου 2026 | | status.search.google.com |
| 2026-03-27 | Ενημέρωση πυρήνα Μαρτίου 2026 | | status.search.google.com |
| 2026-04-13 | Πολιτική για το κλείδωμα του κουμπιού «Πίσω» | κανένα `history.pushState` που εμποδίζει την επιστροφή | developers.google.com/search/blog/2026/04/back-button-hijacking |
| 2026-05-07 | Τέλος των FAQ rich results για όλους | το `FAQPage` της αρχικής μένει (δεν βλάπτει) αλλά δεν φέρνει εμφάνιση | developers.google.com/search/updates |
| 2026-05-15 | Οδηγός της Google για τη γενετική αναζήτηση | «η βελτιστοποίηση για AI είναι SEO»· το `llms.txt` δεν βοηθά ούτε βλάπτει στη Google | developers.google.com/search/docs/fundamentals/ai-optimization-guide |
| 2026-05-21 | Ενημέρωση πυρήνα Μαΐου 2026 | | status.search.google.com |
| 2026-06-24 | Ενημέρωση spam Ιουνίου 2026 | | status.search.google.com |
| 2026-08-18 | Ενημέρωση spam Αυγούστου 2026 | | status.search.google.com |
| 2026-08-28 | Η επιβολή για site reputation abuse διαφέρει μέσα στον ΕΟΧ | η Ελλάδα είναι στον ΕΟΧ | developers.google.com/search/blog/2026/08/update-site-reputation-policy |
| 2026-08-31 | Ρύθμιση «Search generative AI» στο Search Console για κάθε ιστότοπο | ελέγχει τη συμμετοχή σε AI Overviews και AI Mode· αφήνεται στην προεπιλογή (συμμετοχή) | support.google.com/webmasters/answer/16908024 |
| 2026-09-24 | Ενημέρωση spam Σεπτεμβρίου 2026 | | status.search.google.com |

Η Google κάνει πλέον και μικρότερες, ανακοίνωτες ενημερώσεις πυρήνα ανάμεσα στις
μεγάλες (changelog 2025-12-09, κατά το claude-seo). Μια καλύτερη σελίδα δεν
περιμένει την επόμενη ανακοίνωση.
