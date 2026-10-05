# Τιμές ΡΑΑΕΥ Οκτωβρίου, Euribor Σεπτεμβρίου και επιτόκια τραπεζών (05/10/2026)

Η αναφορά της αλλαγής: τι ενημερώθηκε, τι προστέθηκε, τι έμεινε, με πηγές.
Τα αριθμητικά στοιχεία βγήκαν από τον κώδικα (κατάλογος μετά την αλλαγή,
`compareTariffs` για τον νικητή), όχι με το χέρι.

Τρία μέρη σε ένα PR, όπως ζητήθηκε. **Όχι merge**, το κάνει άνθρωπος. Στο κλαδί είναι και τα commits των reels του ενός λεπτού (`scripts/marketing/reelSeires.ts`, `seiresData.ts`, `docs/marketing/instagram/SEIRES.md`).

## Μέρος 1. Ρεύμα και αέριο: τιμές ΡΑΑΕΥ Οκτωβρίου 2026

**Πηγή:** οι πίνακες της ΡΑΑΕΥ (energycost.gr), Οκτώβριος 2026, ανάγνωση 05/10/2026, τέσσερα φύλλα (ρεύμα και αέριο, οικιακό και επαγγελματικό). Το Excel **δεν** μπαίνει στο αποθετήριο. Μπαίνει η μεταγραφή του:
- `data/raaey/energycost-2026-10.json`: κάθε κελί αυτούσιο, με αριθμό γραμμής
- `lib/energy/raaeyData.json`: το αντίγραφο της εφαρμογής

Και τα δύο τα γράφει το `scripts/energy/raaey-import.mjs`. Στα `data/` μπαίνει η μεταγραφή και το `price-sources.json`, με οδηγία ιδιοκτήτη.

**Τι ισχύει τώρα**
- Ταίριασμα μόνο με πάροχο και ακριβές όνομα. Ό,τι δεν ήταν σίγουρο έμεινε αταίριαστο (λίστα πιο κάτω).
- Τιμές Οκτωβρίου μόνο από το Excel: πάγιο, πάγιο με έκπτωση, τελική τιμή χωρίς και με έκπτωση, προϋποθέσεις όπως τις γράφει η ΡΑΑΕΥ. Ετικέτα «ΡΑΑΕΥ, Οκτώβριος 2026».
- «Η τιμή δεν είναι ακόμη γνωστή» ή γραμμή που λείπει: `null`. Όπου υπήρχε παλιά τιμή, μένει με τον μήνα της και δεν μπαίνει στη σειρά. Καμία εκτίμηση.
- Κλίμακες όπως είναι. Ο υπολογισμός έμαθε το «από την 1η kWh» (`tier2_scope: 'all'`): ΔΕΗ Ειδικό πάνω από 200 kWh 0,21997 από την 1η, νύχτα 0,1559. Enerwave Ειδικό 0,179 ώς 100 kWh, 0,339 από την 101η.
- Τα «μη εμπορικά διαθέσιμα» δεν προτείνονται και δεν βγαίνουν ποτέ φθηνότερα (`COMPARABLE_TARIFFS`). Δεν προστέθηκε κανένα.
- Ο νικητής βγαίνει μόνο από τιμές Οκτωβρίου. Η κάρτα δείχνει μήνα και προϋπόθεση.
- Παντού «Τελευταία ενημέρωση: 05.10.2026» και πηγή «ΡΑΑΕΥ, energycost.gr». Τα «Αύγουστος 2026» έφυγαν από τα τιμολόγια που ενημερώθηκαν.
- **ΦΠΑ: καμία αλλαγή, καμία σύγκρουση.** Ο κατάλογος κρατά τις τιμές χωρίς ΦΠΑ και ο 6% μπαίνει στο `vat`. Οι τιμές Αυγούστου από την ίδια πηγή συμφωνούν ψηφίο προς ψηφίο με τον Οκτώβριο όπου δεν άλλαξαν (myHome Enter 0,1421).
- Το κείμενο της ΡΑΑΕΥ στην οθόνη περνά από το `raaeyText`, που αλλάζει μόνο τυπογραφία κατά τους φύλακες: «και» αντί «&», «ακόμη», «€» κολλητά, τόνος. Αριθμοί και λέξεις μένουν. Η μεταγραφή μένει αυτούσια.

**Αποφάσεις για έλεγχο από άνθρωπο**
1. **ΖΕΝΙΘ «Gas Business Save» (Αέριο Επαγγελματικό γρ. 44) δεν πέρασε.** Η τιμή χωρίς έκπτωση είναι άγνωστη και η τιμή με έκπτωση 0,009, δέκα φορές κάτω από κάθε τιμή αερίου του πίνακα. Μοιάζει λάθος της πηγής. Είναι δική μου κρίση, όχι οδηγία. Αν πρέπει να μπει, φεύγει από το `RAAEY_REJECTED` στο `lib/energy/raaeyCatalogue.ts`.
2. Η EFA «PLUS GAS EXTRA BUSINESS» (γρ. 2) δεν πέρασε, κατά την οδηγία.
3. Το `dei_online` συγκρίνεται με 0,142 και νύχτα 0,132, τη στήλη χωρίς έκπτωση. Το 0,115 της στήλης με έκπτωση φαίνεται χωριστά ως προωθητική τιμή, γιατί η λήξη της προσφοράς δεν είναι γνωστή. Ήταν ήδη η πολιτική του καταλόγου.
4. Το Γ1 Πράσινο και το Γ1Ν μοιράζονται τη γραμμή 136. Το Γ1 δεν παίρνει τη νυχτερινή τιμή.
5. Πέντε ταιριάσματα με ακριβές όνομα είχαν πριν τιμές άλλης εκδοχής: `dei_enter`, `dei_entertwo`, `dei_maxima`, `dei_plan`, `heron_blue_gen_max`. Το Volton Green Ειδικό πήγε από 0,0789 σε 0,27369.
6. Δύο νέοι πάροχοι υπάρχουν μόνο στη ΡΑΑΕΥ: OTE ESTATE και SOLAR ENERGY. Ο σύνδεσμός τους οδηγεί στο energycost.gr, γιατί η ΡΑΑΕΥ δεν δίνει τη σελίδα τους. Η αρχική γράφει πλέον 13 πάροχοι ρεύματος.

### Τι αλλάζει στον νικητή

Ίδιος τύπος (`compareTariffs`). Μόνο ό,τι μπαίνει στη σειρά, ρεύμα με ΦΠΑ και ΕΤΜΕΑΡ, αέριο μόνο προμήθεια χωρίς ΦΠΑ.

| Κατανάλωση | Πριν | Μετά |
|---|---|---|
| Ρεύμα οικιακό 200 kWh | Volton Green Ειδικό 25,52€ (0,0789) | Eunice Home Core 31,80€ |
| Ρεύμα οικιακό 300 kWh | Volton Green Ειδικό 35,69€ | Zenith Power Home Secure 5.0 43,88€ |
| Ρεύμα οικιακό 500 kWh | Zenith ZeΝergy XS 51,94€ (Αύγουστος) | Zenith Power Home Secure 5.0 66,14€ |
| Ρεύμα επαγγελματικό 1.000 kWh | Enerwave My Wave Daily 3€ 184,52€ (Αύγουστος) | Ήρων BLUE GENEROUS MAX BUSINESS 2 115,65€ |
| Αέριο οικιακό 500 kWh | Ήρων GAS MAX SHARE 22,86€ (Αύγουστος) | ελίν Gas On! Zero Fixed 22,45€ |
| Αέριο επαγγελματικό 2.000 kWh | Ήρων GAS MAX BUSINESS 106,22€ (Αύγουστος) | ελίν Gas On! Zero Fixed Business 85,80€ |

Το Enerwave Reward Saver ήταν δεύτερο στις 200 και 300 kWh με την τιμή Αυγούστου (0,129 χωρίς πάγιο, ώς 10/10/2026). Τώρα έχει την τιμή Οκτωβρίου: 0,219 με πάγιο 7,90.

### Τι ενημερώθηκε (114)

| id | Πάροχος | Τιμολόγιο | Παλιά τιμή (μήνας) | Νέα τιμή (μήνας) | Γραμμή Excel |
|---|---|---|---|---|---|
| `dei_enter` | ΔΕΗ | myHome Enter | 0,1421, πάγιο 7,35 (Αυγούστου 2026) | 0,1421, πάγιο 4,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 137 |
| `dei_entertwo` | ΔΕΗ | myHome EnterTwo | 0,1421, νύχτα 0,1029, πάγιο 8,82 (Αυγούστου 2026) | 0,145, νύχτα 0,095, πάγιο 8 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 139 |
| `dei_online` | ΔΕΗ | myHome Online | 0,142, πάγιο 3,5 (Αυγούστου 2026) | 0,142, νύχτα 0,132, πάγιο 3,5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 147 |
| `dei_maxima` | ΔΕΗ | myHome Maxima | 0,13818 / 0,12642 πάνω από 600, πάγιο 13,23 (Αυγούστου 2026) | 0,132 / 0,122 πάνω από 600, πάγιο 12,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 142 |
| `dei_plan` | ΔΕΗ | myHome Plan | 0, πάγιο 0 (Αυγούστου 2026) | 0,145, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 140 |
| `dei_4all` | ΔΕΗ | myHome 4All | 0,15135 / 0,19482 πάνω από 500, πάγιο 4,9 (Αυγούστου 2026) | 0,243 / 0,29788 πάνω από 500, νύχτα 0,21752, πάγιο 4,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 149 |
| `dei_4students` | ΔΕΗ | myHome 4Students | 0,11155 / 0,185 πάνω από 150, πάγιο 2,91 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Οικιακό γρ. 150 |
| `dei_prasino` | ΔΕΗ | Γ1 Πράσινο | 0,15913 / 0,21997 πάνω από 200, πάγιο 5 (Οκτωβρίου 2026) | 0,15913 / 0,21997 από 1η kWh πάνω από 200, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 136 |
| `dei_prasino_n` | ΔΕΗ | Γ1Ν Πράσινο Νυχτερινό | 0,15913 / 0,21997 πάνω από 200, νύχτα 0,1559, πάγιο 5 (Οκτωβρίου 2026) | 0,15913 / 0,21997 από 1η kWh πάνω από 200, νύχτα 0,1559, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 136 |
| `dei_biz_4all` | ΔΕΗ | MyBussiness4ALL | 0,16863, πάγιο 4,9 (Αυγούστου 2026) | 0,25476, πάγιο 4,9 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 122 |
| `dei_biz_g21` | ΔΕΗ | Ειδικό Γ21 | 0,172, πάγιο 5 (Αυγούστου 2026) | 0,25437, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 118 |
| `heron_blue_gen_max` | Ήρων | Blue Generous Max Home | 0,144, πάγιο 11,9 (Αυγούστου 2026) | 0,0945, πάγιο 9,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 210 |
| `heron_blue_gen` | Ήρων | Blue Generous Home | 0,153, πάγιο 10,9 (Αυγούστου 2026) | 0,0936, πάγιο 9,5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 208 |
| `heron_blue_simple` | Ήρων | Blue Simple Home | 0,158, πάγιο 15,9 (Αυγούστου 2026) | 0,158, πάγιο 15,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 220 |
| `heron_yellow_one` | Ήρων | Yellow One Home | 0,17798, πάγιο 5 (Αυγούστου 2026) | 0,24382, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 227 |
| `heron_yellow_free` | Ήρων | Yellow Free Home | 0,084, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Οικιακό γρ. 226 |
| `heron_yellow_student` | Ήρων | Yellow Free Student | 0,084, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Οικιακό γρ. 228 |
| `heron_basic` | Ήρων | Basic Home (Γ1 Πράσινο) | 0,1476, πάγιο 5 (Οκτωβρίου 2026) | 0,1476, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 207 |
| `heron_blue_smart_biz` | Ήρων | Blue Smart BUSINESS 2 | 0,158, πάγιο 7,95 (Αυγούστου 2026) | 0,158 / 0,158 πάνω από 150, πάγιο 7,95 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 167 |
| `heron_blue_gen_max_biz` | Ήρων | Blue Generous Max BUSINESS 4 | 0,165, πάγιο 13,9 (Αυγούστου 2026) | 0,165, πάγιο 13,9 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 166 |
| `heron_protect_biz_s` | Ήρων | PROTECT 4 BUSINESS S | 0, πάγιο 5,5 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Επαγγελματικό γρ. 177 |
| `heron_yellow_one_biz` | Ήρων | Yellow One Business S 2 | 0,19558, πάγιο 5 (Αυγούστου 2026) | 0,26142, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 182 |
| `heron_basic_biz_s` | Ήρων | BASIC BUSINESS S | 0,1778, πάγιο 3 (Αυγούστου 2026) | 0,1778, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 154 |
| `prot_flow` | Protergia | Value Flow | 0,13767, πάγιο 5 (Αυγούστου 2026) | 0,21914, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 90 |
| `prot_sure_18` | Protergia | Value Sure 18M 2.0 | 0,145, πάγιο 5 (Αυγούστου 2026) | 0,145, πάγιο 11,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 75 |
| `prot_standard` | Protergia | Value Standard | 0,159, πάγιο 5 (Αυγούστου 2026) | 0,1985, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 83 |
| `prot_value_special` | Protergia | Value Special | 0,184, πάγιο 5 (Οκτωβρίου 2026) | 0,184, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 69 |
| `prot_lite2` | Protergia | Value Lite 2.0 | 0,16267, πάγιο 0 (Αυγούστου 2026) | 0,24414, πάγιο 0 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 92 |
| `prot_simple_biz1` | Protergia | Επαγγελματικό 1 Value Simple 2.0 | 0,17804, πάγιο 5 (Αυγούστου 2026) | 0,2191, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 79 |
| `prot_sure_biz1` | Protergia | Επαγγελματικό 1 Value Sure 12Μ 3.0 | 0,1699, πάγιο 13,9 (Αυγούστου 2026) | 0,169, πάγιο 13,9 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 72 |
| `prot_sure_biz2` | Protergia | Επαγγελματικό 2 και 3 Value Sure 12Μ 2.0 | 0,1999, πάγιο 0 (Αυγούστου 2026) | 0,1999, πάγιο 0 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 70 |
| `nrg_special` | NRG | Ειδικό Τιμολόγιο nrg | 0,259, πάγιο 5 (Οκτωβρίου 2026) | 0,259, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 41 |
| `nrg_adjust` | NRG | NRG adjust 1.0 | 0,158, πάγιο 9,9 (Αυγούστου 2026) | 0,138 / 0,138 πάνω από 150, πάγιο 7,95 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 51 |
| `nrg_simple_biz` | NRG | nrg simple 1.0 BUSINESS1 | 0,199, πάγιο 9,9 (Αυγούστου 2026) | 0,256, πάγιο 9,9 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 56 |
| `zen_pair` | Zenith | Power Home Pair | 0,138, πάγιο 11,9 (Αυγούστου 2026) | 0,138, πάγιο 14,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 187 |
| `zen_select` | Zenith | Power Home Select | 0,149, πάγιο 5 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Οικιακό γρ. 197 |
| `zen_save30` | Zenith | Power Home Save 3.0 | 0,153, πάγιο 4 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Οικιακό γρ. 204 |
| `zen_light` | Zenith | Power Home Light | 0,156, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Οικιακό γρ. 205 |
| `zen_student` | Zenith | Power Home Student | 0,095, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Οικιακό γρ. 196 |
| `zen_start` | Zenith | Power Home Start (Ειδικό) | 0,225 / 0,347 πάνω από 100, πάγιο 5 (Οκτωβρίου 2026) | 0,22501 / 0,34701 πάνω από 100, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 171 |
| `zen_biz_start` | Zenith | Power Business Direct | 0,208, πάγιο 1 (Αυγούστου 2026) | 0,208, πάγιο 1 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 146 |
| `elin_power_green` | Elin | Power On! Home Green | 0,22536, πάγιο 5 (Σεπτεμβρίου 2026) | 0,25265, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 152 |
| `volton_green` | Volton | Volton Green Ειδικό | 0,0789, πάγιο 4,9 (Οκτωβρίου 2026) | 0,27369, πάγιο 4,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 99 |
| `volton_blue` | Volton | Volton Blue Flat 18M | 0,152, πάγιο 9,9 (Αυγούστου 2026) | 0,14501, πάγιο 9,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 112 |
| `volton_yellow_biz` | Volton | Volton Yellow Simple Business 21 v3 | 0, πάγιο 6,9 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Επαγγελματικό γρ. 96 |
| `volton_blue_biz` | Volton | Volton Blue Flat 18M Business 21 v2 | 0,15902, πάγιο 9,9 (Αυγούστου 2026) | 0,15902, πάγιο 9,9 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 94 |
| `volton_green_biz` | Volton | Ειδικό Business | 0,19979, πάγιο 4,9 (Αυγούστου 2026) | 0,27369, πάγιο 4,9 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 87 |
| `enrw_saver` | Enerwave | Reward Saver | 0,129, πάγιο 0 (Αυγούστου 2026) | 0,219, πάγιο 7,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 28 |
| `enrw_stable_zero` | Enerwave | Reward Stable Zero 12M | 0,189, πάγιο 0 (Αυγούστου 2026) | 0,189, πάγιο 0 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 17 |
| `enrw_smart` | Enerwave | Smart | 0,14504, πάγιο 5 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Οικιακό γρ. 20 |
| `enrw_smart_zero` | Enerwave | Smart Zero | 0,15914, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Ρεύμα Οικιακό γρ. 22 |
| `enrw_night` | Enerwave | Reward Night Saver | 0,14, νύχτα 0,065, πάγιο 5 (Αυγούστου 2026) | 0,249, νύχτα 0,139, πάγιο 7,9 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 29 |
| `enrw_special` | Enerwave | Ειδικό Οικιακό | 0,179 / 0,339 πάνω από 100, πάγιο 5 (Οκτωβρίου 2026) | 0,179 / 0,339 πάνω από 100, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 2 |
| `enrw_saver_biz` | Enerwave | Reward Saver for Business | 0,179, πάγιο 0 (Αυγούστου 2026) | 0,259, πάγιο 0 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 30 |
| `enrw_stable_biz` | Enerwave | Reward Stable 2.0 for Business Γ21 | 0,149, πάγιο 14,9 (Αυγούστου 2026) | 0,149, πάγιο 14,9 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 20 |
| `enrw_special_biz` | Enerwave | Ειδικό Γ21 | 0,159 / 0,27021 πάνω από 100, πάγιο 5 (Αυγούστου 2026) | 0,179 / 0,339 πάνω από 100, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 2 |
| `eun_home_core` | Eunice Power | Home Core | 0,098, πάγιο 7 (Αυγούστου 2026) | 0,098, πάγιο 7 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 33 |
| `eun_home_special` | Eunice Power | Ειδικό Τιμολόγιο Home | 0,16, πάγιο 5 (Αυγούστου 2026) | 0,25652, πάγιο 5 (Οκτωβρίου 2026) | Ρεύμα Οικιακό γρ. 30 |
| `eun_biz_secure` | Eunice Power | Small Business Secure | 0,165, πάγιο 4 (Αυγούστου 2026) | 0,165, πάγιο 4 (Οκτωβρίου 2026) | Ρεύμα Επαγγελματικό γρ. 39 |
| `nrg_ontime` | nrg (Motor Oil) | nrg on time GAS | 0,06707, πάγιο 1,8 (Αυγούστου 2026) | 0,09117, πάγιο 1,8 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 30 |
| `nrg_adapt` | nrg (Motor Oil) | nrg adapt GAS | 0,06837, πάγιο 1,8 (Αυγούστου 2026) | 0,09247, πάγιο 1,8 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 32 |
| `nrg_prime` | nrg (Motor Oil) | nrg prime GAS | 0,06767, πάγιο 2,5 (Αυγούστου 2026) | 0,09177, πάγιο 2,5 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 31 |
| `nrg_ontime_biz` | nrg (Motor Oil) | nrg on time GAS 4BUSINESS | 0,06527, πάγιο 0 (Αυγούστου 2026) | 0,08937, πάγιο 0 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 14 |
| `nrg_adapt_biz` | nrg (Motor Oil) | nrg adapt GAS 4BUSINESS | 0,06617, πάγιο 0 (Αυγούστου 2026) | 0,09027, πάγιο 0 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 16 |
| `nrg_prime_biz` | nrg (Motor Oil) | nrg prime GAS 4BUSINESS | 0,06767, πάγιο 4 (Αυγούστου 2026) | 0,09177, πάγιο 4 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 15 |
| `zen_central_easy` | ZeniΘ | Gas Central Easy | 0,06928, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Οικιακό γρ. 91 |
| `zen_central_save` | ZeniΘ | Gas Central Save | 0,0798, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Οικιακό γρ. 92 |
| `zen_home_now` | ZeniΘ | Gas Home Now | 0,06872, πάγιο 4 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Οικιακό γρ. 87 |
| `zen_home_pulse` | ZeniΘ | Gas Home Pulse | 0,07315, πάγιο 4,5 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Οικιακό γρ. 100 |
| `zen_home_save` | ZeniΘ | Gas Home Save | 0,0798, πάγιο 4,5 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Οικιακό γρ. 86 |
| `zen_home_pair` | ZeniΘ | Gas Home Pair | 0,049, πάγιο 9,9 (Αυγούστου 2026) | 0,049, πάγιο 9,9 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 85 |
| `zen_biz_easy2` | ZeniΘ | Gas Business Easy 2 | 0,06928, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Επαγγελματικό γρ. 43 |
| `zen_biz_save_p` | ZeniΘ | Gas Business Save + | 0,0798, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Επαγγελματικό γρ. 45 |
| `zen_biz_easy1` | ZeniΘ | Gas Business Easy 1 | 0,06676, πάγιο 5 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Επαγγελματικό γρ. 42 |
| `elin_home_easy` | ελίν (ΕΛΙΝΟΙΛ) | Gas On! Home Easy | 0,05634, πάγιο 4,5 (Αυγούστου 2026) | 0,07825, πάγιο 4,5 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 80 |
| `elin_koin_easy` | ελίν (ΕΛΙΝΟΙΛ) | Gas On! Κοινόχρηστο Easy | 0,05634, πάγιο 5 (Αυγούστου 2026) | 0,07825, πάγιο 5 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 82 |
| `elin_f12_dual` | ελίν (ΕΛΙΝΟΙΛ) | Gas On! Fixed 12M Αυτόνομη Θέρμανση Dual | 0,0589, πάγιο 4,9 (Αυγούστου 2026) | 0,0589, πάγιο 4,9 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 79 |
| `elin_relax` | ελίν (ΕΛΙΝΟΙΛ) | Gas On! Relax | 0,05734, πάγιο 6 (Αυγούστου 2026) | 0,07925, πάγιο 6 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 81 |
| `elin_f12` | ελίν (ΕΛΙΝΟΙΛ) | Gas On! Fixed 12M Αυτόνομη Θέρμανση | 0,0589, πάγιο 9,9 (Αυγούστου 2026) | 0,0589, πάγιο 9,9 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 78 |
| `elin_biz_easy` | ελίν (ΕΛΙΝΟΙΛ) | Gas On! Business Easy | 0,05634, πάγιο 5 (Αυγούστου 2026) | 0,07825, πάγιο 5 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 41 |
| `fae_pliris` | Φυσικό αέριο ΕΕΕ (ΔΕΠΑ) | Αέριο Οικιακό Πλήρες | 0,06879, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Οικιακό γρ. 114 |
| `fae_kouzina` | Φυσικό αέριο ΕΕΕ (ΔΕΠΑ) | Αέριο Οικιακό Κουζίνα | 0,06879, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Οικιακό γρ. 115 |
| `fae_extra` | Φυσικό αέριο ΕΕΕ (ΔΕΠΑ) | Αέριο Οικιακό Πλήρες Extra | 0,06279, πάγιο 4,5 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Οικιακό γρ. 113 |
| `fae_biz` | Φυσικό αέριο ΕΕΕ (ΔΕΠΑ) | Αέριο Επαγγελματικό | 0,06579, πάγιο 0 (Αυγούστου 2026) | null στη ΡΑΑΕΥ, μένει η παλιά (Αυγούστου 2026) | Αέριο Επαγγελματικό γρ. 48 |
| `dei_gas_bld_benefit` | ΔΕΗ | myBuildingGasBenefit | 0,06294, πάγιο 0 (Αυγούστου 2026) | 0,08551, πάγιο 0 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 72 |
| `dei_gas_bld_control` | ΔΕΗ | myΒuildingGasControl | 0,049, πάγιο 5 (Αυγούστου 2026) | 0,049, πάγιο 5 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 70 |
| `dei_gas_benefit` | ΔΕΗ | myHomeGasBenefit | 0,05894, πάγιο 5 (Αυγούστου 2026) | 0,08151, πάγιο 5 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 71 |
| `dei_gas_control` | ΔΕΗ | myHomeGasControl | 0,042, πάγιο 7 (Αυγούστου 2026) | 0,052, πάγιο 14,9 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 69 |
| `dei_gas_biz` | ΔΕΗ | myBusinessGasBenefit | 0,06387, πάγιο 5 (Αυγούστου 2026) | 0,086, πάγιο 5 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 39 |
| `prot_auton_plus` | Protergia (Metlen) | Οικιακό Αυτόνομο Plus | 0,06334, πάγιο 1 (Αυγούστου 2026) | 0,08525, πάγιο 1 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 39 |
| `prot_koin_plus` | Protergia (Metlen) | Οικιακό Κοινόχρηστο Plus | 0,06334, πάγιο 1 (Αυγούστου 2026) | 0,08525, πάγιο 1 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 46 |
| `prot_auton_double` | Protergia (Metlen) | Οικιακό Αυτόνομο Double Value | 0,05634, πάγιο 5 (Αυγούστου 2026) | 0,07825, πάγιο 5 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 41 |
| `prot_auton_single` | Protergia (Metlen) | Οικιακό Αυτόνομο Single Value | 0,05834, πάγιο 5 (Αυγούστου 2026) | 0,08025, πάγιο 5 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 43 |
| `prot_gas_sure` | Protergia (Metlen) | Οικιακό Αυτόνομο Value Gas Sure | 0,0399, πάγιο 9,9 (Αυγούστου 2026) | 0,0399, πάγιο 9,9 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 38 |
| `prot_biz_plus` | Protergia (Metlen) | Εμπορικό Plus | 0,06334, πάγιο 1 (Αυγούστου 2026) | 0,08525, πάγιο 1 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 20 |
| `prot_biz_double` | Protergia (Metlen) | Εμπορικό Double Reward | 0,05634, πάγιο 5 (Αυγούστου 2026) | 0,07825, πάγιο 5 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 21 |
| `heron_gas_share` | ΗΡΩΝ | GAS MAX SHARE | 0,04571, πάγιο 0 (Αυγούστου 2026) | 0,08299, πάγιο 0 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 106 |
| `heron_gas_pass` | ΗΡΩΝ | GAS PASS | 0,04718, πάγιο 3,4 (Αυγούστου 2026) | 0,10625, πάγιο 3,4 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 104 |
| `heron_gas_max_home` | ΗΡΩΝ | GAS MAX HOME 2 | 0,0401, πάγιο 4,3 (Αυγούστου 2026) | 0,07137, πάγιο 4,3 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 107 |
| `heron_gas_blue_max` | ΗΡΩΝ | GAS BLUE MAX HOME | 0,0398, πάγιο 7,4 (Αυγούστου 2026) | 0,0398, πάγιο 7,4 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 102 |
| `heron_gas_biz` | ΗΡΩΝ | GAS MAX BUSINESS | 0,05311, πάγιο 0 (Αυγούστου 2026) | 0,08099, πάγιο 0 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 46 |
| `enw_bld_win` | enerwave (πρώην Elpedison) | GasBuilding Win | 0,06367, πάγιο 0 (Αυγούστου 2026) | 0,08487, πάγιο 0 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 22 |
| `enw_home_win` | enerwave (πρώην Elpedison) | GasHome Win | 0,06007, πάγιο 4,9 (Αυγούστου 2026) | 0,08127, πάγιο 4,9 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 21 |
| `enw_bright_up` | enerwave (πρώην Elpedison) | GasHome Bright Up | 0,0449, πάγιο 9,9 (Αυγούστου 2026) | 0,0449, πάγιο 9,9 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 20 |
| `enw_biz_win` | enerwave (πρώην Elpedison) | GasBusiness Win | 0,06367, πάγιο 0 (Αυγούστου 2026) | 0,08487, πάγιο 0 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 8 |
| `efa_go_central` | EFA ENERGY | GO GAS EXTRA CENTRAL | 0,0609, πάγιο 0 (Αυγούστου 2026) | 0,0825, πάγιο 0 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 6 |
| `efa_plus_central` | EFA ENERGY | PLUS GAS EXTRA CENTRAL | 0,07289, πάγιο 0 (Αυγούστου 2026) | 0,09665, πάγιο 0 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 4 |
| `efa_go_home` | EFA ENERGY | GO GAS EXTRA HOME | 0,0599, πάγιο 4,96 (Αυγούστου 2026) | 0,0815, πάγιο 4,8 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 5 |
| `efa_plus_home` | EFA ENERGY | PLUS GAS EXTRA HOME | 0,06809, πάγιο 5 (Αυγούστου 2026) | 0,09185, πάγιο 5 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 3 |
| `efa_my_gas` | EFA ENERGY | MY GAS HOME | 0,0539, πάγιο 8,33 (Αυγούστου 2026) | 0,0755, πάγιο 8,33 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 2 |
| `efa_go_biz` | EFA ENERGY | GO GAS EXTRA BUSINESS | 0,0599, πάγιο 0 (Αυγούστου 2026) | 0,0815, πάγιο 0 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 3 |
| `vol_stay_home` | Volton | Volton Stay & Win v2 | Αυτόνομες | 0,08699, πάγιο 6,9 (Αυγούστου 2026) | 0,11464, πάγιο 6,9 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 66 |
| `vol_stay_koin` | Volton | Volton Stay & Win v2 | Κοινόχρηστες | 0,08699, πάγιο 8,9 (Αυγούστου 2026) | 0,11464, πάγιο 8,9 (Οκτωβρίου 2026) | Αέριο Οικιακό γρ. 67 |
| `vol_stay_biz` | Volton | Volton Stay & Win v2 | Επαγγελματικές | 0,08699, πάγιο 6,9 (Αυγούστου 2026) | 0,11464, πάγιο 6,9 (Οκτωβρίου 2026) | Αέριο Επαγγελματικό γρ. 38 |

### Τι προστέθηκε (389)

Το id λέει τη γραμμή: `rx_pr_32` είναι η γραμμή 32 του φύλλου Ρεύμα Οικιακό (`pb` Ρεύμα Επαγγελματικό, `gr`/`gb` Αέριο). Η μορφή είναι τιμή/κλίμακα>όριο, ν νύχτα, +πάγιο. Το «(1η)» σημαίνει από την 1η kWh.

<details><summary>Όλη η λίστα</summary>

**Ρεύμα οικιακό (171)**

- `rx_pr_138` ΔΕΗ, My Home Online 06.26: 0,142 ν0,132 +3,5€
- `rx_pr_141` ΔΕΗ, myHomeEnter 03.26: 0,1421 +5€
- `rx_pr_143` ΔΕΗ, myHome EnterTwo 06.26: 0,1421 ν0,1029 +8,82€
- `rx_pr_144` ΔΕΗ, myHome Enter 06.26: 0,1421 +7,35€
- `rx_pr_145` ΔΕΗ, myHome Maxima 06.26: 0,13818/0,12642>600 +13,23€
- `rx_pr_146` ΔΕΗ, myHome Plan 06.26: 0,1421 +7,35€
- `rx_pr_148` ΔΕΗ, myHome Enter 07.26: 0,1421 +7,35€
- `rx_pr_151` ΔΕΗ, myHome4All OneRate: null
- `rx_pr_209` Ήρων, BLUE GENEROUS HOME 3: 0,11025 +9,9€
- `rx_pr_211` Ήρων, BLUE GENEROUS HOME 4: 0,09845 +9,9€
- `rx_pr_212` Ήρων, BLUE GENEROUS HOME 5: 0,10945 +9,9€
- `rx_pr_213` Ήρων, BLUE GENEROUS HOME 6: 0,10945 +9,9€
- `rx_pr_214` Ήρων, BLUE GENEROUS MAX HOME 2: 0,0945 +9,9€
- `rx_pr_215` Ήρων, BLUE GENEROUS MAX HOME 3: 0,1152 +9,9€
- `rx_pr_216` Ήρων, BLUE GENEROUS HOME 7: 0,119 +9,9€
- `rx_pr_217` Ήρων, Blue Generous HOME 8: 0,153 +10,9€
- `rx_pr_218` Ήρων, Blue Generous Max HOME 4: 0,144 +11,9€
- `rx_pr_219` Ήρων, Blue Smart HOME 2: 0,138/0,138>150 +7,95€
- `rx_pr_221` Ήρων, DOUBLE GENEROUS HOME: null
- `rx_pr_222` Ήρων, ECO GENEROUS HOME: null
- `rx_pr_223` Ήρων, GENEROUS GUARANTEE HOME: null
- `rx_pr_224` Ήρων, SIMPLY GENEROUS HOME: null
- `rx_pr_225` Ήρων, SOLAR GENEROUS HOME: null
- `rx_pr_229` Ήρων, PROTECT 4 HOME: null
- `rx_pr_230` Ήρων, YELLOW BENEFIT HOME: null
- `rx_pr_231` Ήρων, YELLOW PLUS HOME: null
- `rx_pr_232` Ήρων, Yellow One Home 2: 0,24382 +5€
- `rx_pr_233` Ήρων, HAPPY HOUR FOR ALL HOME: null
- `rx_pr_234` Ήρων, Yellow free HOME 2: null
- `rx_pr_235` Ήρων, Yellow Value HOME: null
- `rx_pr_70` Protergia, Value Safe More: 0,125 +9,9€
- `rx_pr_71` Protergia, Value Secure 12 Μήνες: 0,099 +9,9€
- `rx_pr_72` Protergia, Value 4FAMILY: 0,141 ν0,089 +9,9€
- `rx_pr_73` Protergia, Value Sure: 0,124 +6,9€
- `rx_pr_74` Protergia, Value Sure 18M: 0,119 +9,9€
- `rx_pr_76` Protergia, Value Sure 12M 2.0: 0,154 +9,9€
- `rx_pr_77` Protergia, Value Sure 12M 3.0: 0,154 +9,9€
- `rx_pr_78` Protergia, Value Sure 18M 3.0: 0,145 +11,9€
- `rx_pr_80` Protergia, Helios Value: 0,20737 +0€
- `rx_pr_93` Protergia, Value Student Plan: 0,001/0,23914>115 +9,9€
- `rx_pr_42` NRG, nrg fixed 4U 12M: 0,115 +14,9€
- `rx_pr_43` NRG, nrg fixed on time: 0,1078 +9,9€
- `rx_pr_44` NRG, nrg fixed on time advanced 1.0: 0,099 +9,9€
- `rx_pr_45` NRG, nrg fixed on time advanced promo: 0,099 +9,9€
- `rx_pr_46` NRG, nrg fixed on time advanced 2.0: 0,119 +9,9€
- `rx_pr_47` NRG, nrg fixed on time 18M: 0,114 +9,9€
- `rx_pr_48` NRG, nrg fixed on time 1.0 18M: 0,144 +11,9€
- `rx_pr_49` NRG, nrg fixed on time advanced 3.0: 0,153 +10,9€
- `rx_pr_50` NRG, nrg fixed 12M: 0,158 +15,9€
- `rx_pr_52` NRG, nrg prime 4U: null
- `rx_pr_53` NRG, nrg on time 4U: null
- `rx_pr_54` NRG, nrg @ cost+: null
- `rx_pr_55` NRG, nrg hybrid: null
- `rx_pr_56` NRG, nrg hybrid 1.0: null
- `rx_pr_57` NRG, nrg hybrid 2.0: null
- `rx_pr_58` NRG, nrg hybrid 50-50: null
- `rx_pr_59` NRG, nrg simple: 0,256 +3,5€
- `rx_pr_60` NRG, nrg simple 1.0: 0,256 +3,5€
- `rx_pr_61` NRG, nrg simple 2.0: 0,256 +3,5€
- `rx_pr_62` NRG, nrg simple 3.0: 0,256 +5€
- `rx_pr_63` NRG, nrg 100: 0,18182 +0€
- `rx_pr_64` NRG, nrg 50: 0,15909 +5€
- `rx_pr_65` NRG, nrg free: null
- `rx_pr_66` NRG, nrg smart start: 0,119 +9,9€
- `rx_pr_67` NRG, nrg free hybrid: null
- `rx_pr_174` Zenith, Power Home Secure 3.0: 0,106 +9,9€
- `rx_pr_175` Zenith, Power Home Secure Night 2.0: 0,139 +9,9€
- `rx_pr_176` Zenith, Power Home Secure 4.0: 0,099 +9,9€
- `rx_pr_177` Zenith, Power Home Secure Summer: 0,09901 +9,9€
- `rx_pr_178` Zenith, Power Home Secure 5.0: 0,088 +9,9€
- `rx_pr_179` Zenith, Power Home Secure 6.0: 0,098 +9,9€
- `rx_pr_180` Zenith, Power Home Control: 0,09804 +9,9€
- `rx_pr_183` Zenith, Power Home Balance: 0,129 +9,9€
- `rx_pr_184` Zenith, Power Home Click: 0,139 +0,99€
- `rx_pr_185` Zenith, Power Home Trust: 0,14502 +11,9€
- `rx_pr_188` Zenith, Power Home Special: null
- `rx_pr_189` Zenith, Power Home Now: null
- `rx_pr_190` Zenith, My Pet My Home: null
- `rx_pr_191` Zenith, Power Home More: null
- `rx_pr_194` Zenith, Power Home Smart Night: null
- `rx_pr_195` Zenith, Power Home Go Electric Plus: null
- `rx_pr_198` Zenith, Power Home Comfort: null
- `rx_pr_199` Zenith, Power Home Smart Night - Promo -40%: null
- `rx_pr_200` Zenith, Power Home Save: null
- `rx_pr_201` Zenith, Power Home Save 2.0: null
- `rx_pr_203` Zenith, Power Home Care: null
- `rx_pr_206` Zenith, Power Home Student Go: null
- `rx_pr_153` Elin, Power on! Blue Day: 0,149 +5€
- `rx_pr_154` Elin, Power On! Blue 12M Οικιακό: 0,1249 +9,9€
- `rx_pr_155` Elin, Power On! Blue 24M Οικιακό: 0,1149 +9,9€
- `rx_pr_156` Elin, Power On! Blue Benefit Οικιακό: 0,125 +7,5€
- `rx_pr_157` Elin, Power On! Blue Day & Night: 0,149 ν0,139 +5€
- `rx_pr_158` Elin, Power On! Blue Now 12Μ Οικιακό: 0,1139 +4,9€
- `rx_pr_159` Elin, Power On! Blue Now 12Μ+ Οικιακό: 0,0939 +9,9€
- `rx_pr_160` Elin, Power On! Blue Now 18Μ Οικιακό: 0,1119 +4,9€
- `rx_pr_161` Elin, Power On! Blue Now 18Μ+ Οικιακό: 0,0919 +9,9€
- `rx_pr_162` Elin, Power On! Blue Now 24Μ: 0,1099 +4,9€
- `rx_pr_163` Elin, Power On! Blue Now 24Μ+: 0,0899 +9,9€
- `rx_pr_164` Elin, Power On! Blue Home 12M: 0,1599 +8,9€
- `rx_pr_165` Elin, Power On! Home: null
- `rx_pr_166` Elin, Power On! Home Easy: null
- `rx_pr_167` Elin, Power On! Home Zero: null
- `rx_pr_168` Elin, Power On! Hybrid 100: null
- `rx_pr_169` Elin, Power On! Hybrid 150: null
- `rx_pr_170` Elin, Power On! Hybrid 200: null
- `rx_pr_107` Volton, Volton Blue Fixed Plus: 0,115 +14,5€
- `rx_pr_110` Volton, Volton Blue Flat v3: 0,15202 +9,9€
- `rx_pr_113` Volton, Volton Blue Flat 18M v2: 0,13902 +9,9€
- `rx_pr_114` Volton, Volton Blue Student: 0,129 +5€
- `rx_pr_115` Volton, Volton Yellow Standard: null
- `rx_pr_116` Volton, Volton Yellow Simple_v3: null
- `rx_pr_118` Volton, Volton Yellow Protect _6.9: null
- `rx_pr_121` Volton, Volton Yellow Zero: null
- `rx_pr_122` Volton, Volton Stay & Win_v2: null
- `rx_pr_123` Volton, VOLTON YELLOW SIMPLE PROTECT: null
- `rx_pr_124` Volton, Volton Smart 350: null
- `rx_pr_126` Volton, Volton Smart 250: null
- `rx_pr_127` Volton, Volton Smart 150: null
- `rx_pr_130` Volton, Volton Yellow Protect_4.9: null
- `rx_pr_132` Volton, Volton Yellow Flat v2: null
- `rx_pr_133` Volton, VOLTON YELLOW SIMPLE 50 €: null
- `rx_pr_134` Volton, Volton Smart 550: null
- `rx_pr_135` Volton, Volton Smart 450: null
- `rx_pr_6` Enerwave, Bright Home: 0,1299 +12,9€
- `rx_pr_11` Enerwave, Reward Prime: 0,121 +6,9€
- `rx_pr_12` Enerwave, Reward Prime Plus: 0,099 +13,9€
- `rx_pr_13` Enerwave, Reward Fee Free: 0,149 +0€
- `rx_pr_14` Enerwave, Reward Stable 12M: 0,159 +9,9€
- `rx_pr_15` Enerwave, Reward Stable 18M: 0,149 +9,9€
- `rx_pr_16` Enerwave, Reward Stable Max 12M: 0,139 +13,9€
- `rx_pr_18` Enerwave, Reward Stable 12M 2.0: 0,139 +9,9€
- `rx_pr_19` Enerwave, Reward Stable Max 12M 2.0: 0,119 +15,9€
- `rx_pr_21` Enerwave, ELPEDISON Smart Up: null
- `rx_pr_23` Enerwave, ELPEDISON Win: null
- `rx_pr_24` Enerwave, ELPEDISON Flex: null
- `rx_pr_25` Enerwave, ELPEDISON Win More: null
- `rx_pr_26` Enerwave, ELPEDISON Win More 2: null
- `rx_pr_31` Eunice Power, EUNICE Home Fair II: 0,16 +4€
- `rx_pr_32` Eunice Power, Eunice Home EDGE: 0,098 +7€
- `rx_pr_34` Eunice Power, EUNICE UNIQUE HOME: 0,1109 +11€
- `rx_pr_35` Eunice Power, EUNICE HOME FIX: 0,1445 +0€
- `rx_pr_36` Eunice Power, HOME SAFETY: 0,1515 +0€
- `rx_pr_37` Eunice Power, Home Secure: 0,159 +5€
- `rx_pr_38` Eunice Power, Home Flex: null
- `rx_pr_39` Eunice Power, Home Balance: null
- `rx_pr_40` Eunice Power, EUNICE Basic Home III: null
- `rx_pr_236` Φυσικό αέριο Ελλάδος, Ειδικό: 0,239 +5€
- `rx_pr_237` Φυσικό αέριο Ελλάδος, Home Fixed: 0,139 +9,9€
- `rx_pr_238` Φυσικό αέριο Ελλάδος, Ρεύμα Blue Friday: 0,089 +9,9€
- `rx_pr_239` Φυσικό αέριο Ελλάδος, Ρεύμα Home Fixed Super Plus: 0,094 +14,9€
- `rx_pr_240` Φυσικό αέριο Ελλάδος, MAXI Home Energy Save: 0,174 +10,9€
- `rx_pr_241` Φυσικό αέριο Ελλάδος, MAXI Home Energy Reward: null
- `rx_pr_242` Φυσικό αέριο Ελλάδος, MAXI Home Safe: 0,149/0,189>700(1η) +13,9€
- `rx_pr_243` Φυσικό αέριο Ελλάδος, MAXI Home: null
- `rx_pr_244` Φυσικό αέριο Ελλάδος, MAXI Home Super: null
- `rx_pr_245` Φυσικό αέριο Ελλάδος, Ρεύµα MAXI Home 10: null
- `rx_pr_246` Φυσικό αέριο Ελλάδος, MAXI Home Super+: null
- `rx_pr_247` Φυσικό αέριο Ελλάδος, Maxi Home Super Save: null
- `rx_pr_248` Φυσικό αέριο Ελλάδος, Ρεύμα MAXI Home Super Save+: null
- `rx_pr_249` Φυσικό αέριο Ελλάδος, Ρεύμα MAXI Home Super Save+ Oct: null
- `rx_pr_250` Φυσικό αέριο Ελλάδος, Ρεύμα MAXI Home Economy: null
- `rx_pr_251` Φυσικό αέριο Ελλάδος, Ρεύμα MAXI Home Economy XL: null
- `rx_pr_252` Φυσικό αέριο Ελλάδος, MAXI Home Super Save 30: null
- `rx_pr_253` Φυσικό αέριο Ελλάδος, Ρεύμα MAXI Home 150: null
- `rx_pr_254` Φυσικό αέριο Ελλάδος, Ρεύμα MAXI Home 200: null
- `rx_pr_68` OTE ESTATE, Ειδικό: 0,216 +5€
- `rx_pr_94` SOLAR ENERGY, Ειδικό: 0,23458 +5€
- `rx_pr_95` SOLAR ENERGY, Οικιακό FIXED: 0,36 +10€
- `rx_pr_96` SOLAR ENERGY, Οικιακό S1: null
- `rx_pr_97` SOLAR ENERGY, Οικιακό S1+: null
- `rx_pr_98` SOLAR ENERGY, Οικιακό S1Ν: null

**Ρεύμα επαγγελματικό (151)**

- `rx_pb_115` ΔΕΗ, Ειδικό - ΦΟΠ: 0,27507 +5€
- `rx_pb_116` ΔΕΗ, Ειδικό - Αγροτικό: 0,23437 +5€
- `rx_pb_117` ΔΕΗ, Ειδικό - Γ23: 0,29137 ν0,21137 +5€
- `rx_pb_119` ΔΕΗ, My Business Enter: 0,14602 +5,88€
- `rx_pb_120` ΔΕΗ, myBusinessEnter 02.26: 0,14798 +5,88€
- `rx_pb_121` ΔΕΗ, myBusinessEnter 06.26: 0,1617 +8,82€
- `rx_pb_123` ΔΕΗ, MyBusiness4All+: 0,24398 +4,9€
- `rx_pb_155` Ήρων, BASIC BUSINESS L: 0,17941 +5€
- `rx_pb_156` Ήρων, BLUE GENEROUS BUSINESS: 0,1144 +9,5€
- `rx_pb_157` Ήρων, BLUE GENEROUS BUSINESS 3: 0,12675 +9,9€
- `rx_pb_158` Ήρων, BLUE GENEROUS MAX BUSINESS: 0,1188 +12,9€
- `rx_pb_159` Ήρων, BLUE GENEROUS BUSINESS 4: 0,11635 +12,9€
- `rx_pb_160` Ήρων, BLUE GENEROUS BUSINESS 5: 0,1393 +9,9€
- `rx_pb_161` Ήρων, BLUE GENEROUS BUSINESS 6: 0,1393 +9,9€
- `rx_pb_162` Ήρων, BLUE GENEROUS MAX BUSINESS 2: 0,0792 +12,9€
- `rx_pb_163` Ήρων, BLUE GENEROUS MAX BUSINESS 3: 0,1287 +12,9€
- `rx_pb_164` Ήρων, BLUE GENEROUS BUSINESS 7: 0,128 +9,9€
- `rx_pb_165` Ήρων, Blue Generous BUSINESS 8: 0,168 +13,9€
- `rx_pb_168` Ήρων, DOUBLE GENEROUS BUSINESS S: null
- `rx_pb_169` Ήρων, ECO GENEROUS BUSINESS S: null
- `rx_pb_170` Ήρων, DOUBLE GENEROUS BUSINESS L: null
- `rx_pb_171` Ήρων, ECO GENEROUS BUSINESS L: null
- `rx_pb_172` Ήρων, GENEROUS GUARANTEE BUSINESS S: null
- `rx_pb_173` Ήρων, SIMPLY GENEROUS BUSINESS S: null
- `rx_pb_175` Ήρων, Yellow Free BUSINESS: null
- `rx_pb_176` Ήρων, YELLOW ONE BUSINESS S: 0,26142 +5€
- `rx_pb_178` Ήρων, PROTECT 4 BUSINESS L: null
- `rx_pb_179` Ήρων, YELLOW BENEFIT BUSINESS S: null
- `rx_pb_180` Ήρων, YELLOW PLUS BUSINESS S: null
- `rx_pb_181` Ήρων, YELLOW PLUS BUSINESS L: null
- `rx_pb_183` Ήρων, HAPPY HOUR FOR ALL BUSINESS: null
- `rx_pb_184` Ήρων, Yellow Free BUSINESS 2: null
- `rx_pb_59` Protergia, Protergia Επαγγελματικό 1 Value Special: 0,239 +5€
- `rx_pb_60` Protergia, Protergia Επαγγελματικό 3 Value Special: 0,239 ν0,237 +5€
- `rx_pb_61` Protergia, Protergia Επαγγελματικό 1 Value Safe Business: 0,159 +0€
- `rx_pb_62` Protergia, Protergia Επαγγελματικό 2 Value Safe Business: 0,159 +0€
- `rx_pb_63` Protergia, Protergia Επαγγελματικό 3 Value Safe Business: 0,159 +0€
- `rx_pb_64` Protergia, Value Safe More Επαγγελματικό 1: 0,1379 +9,9€
- `rx_pb_65` Protergia, Επαγγελματικό 1 Value Secure 12M: 0,119 +9,9€
- `rx_pb_66` Protergia, Επαγγελματικό 2 Value Secure 12M: 0,149 +0€
- `rx_pb_67` Protergia, Επαγγελματικό 3 Value Secure 12M: 0,119 +9,9€
- `rx_pb_68` Protergia, Value Sure Επαγγελματικό 1 & 3: 0,129 +9,9€
- `rx_pb_69` Protergia, Value Sure Επαγγελματικό 2: 0,159 +0€
- `rx_pb_71` Protergia, Επαγγελματικό 1 Value Sure 12Μ 2.0: 0,1699 +13,9€
- `rx_pb_75` Protergia, Value Standard Επαγγελματικό 1: 0,2145 +5€
- `rx_pb_76` Protergia, Value Standard Επαγγελματικό 3: 0,2145 ν0,2095 +5€
- `rx_pb_78` Protergia, Value Seasonal Επαγγελματικό 1 (2026): 0,1449 +11,9€
- `rx_pb_80` Protergia, Επαγγελματικό 3 Value Simple 2.0: 0,2291 +5€
- `rx_pb_44` NRG, Ειδικό (≤ 25 kVA): 0,274 +5€
- `rx_pb_45` NRG, Ειδικό (> 25 kVA): 0,279 +5€
- `rx_pb_46` NRG, nrg fixed on time advanced BUSINESS 1.0 (≤25 kVA): 0,119 +9,9€
- `rx_pb_47` NRG, nrg fixed on time advanced 2.0 Business1: 0,128 +9,9€
- `rx_pb_48` NRG, nrg fixed on time BUSINESS 18M: 0,124 +9,9€
- `rx_pb_49` NRG, nrg adjust 1.0 BUSINESS: 0,158/0,158>150 +7,95€
- `rx_pb_50` NRG, nrg fixed on time advanced 3.0 BUSINESS: 0,168 +13,9€
- `rx_pb_51` NRG, nrg fixed on time 1.0 18M BUSINESS: 0,165 +13,9€
- `rx_pb_52` NRG, nrg on time 4U Business1 (≤ 25 kVA): null
- `rx_pb_53` NRG, nrg prime 4U Business1 (≤25 kVA): null
- `rx_pb_54` NRG, nrg @ cost+ BUSINESS1 (≤ 25 kVA): null
- `rx_pb_55` NRG, nrg simple BUSINESS1: 0,256 +6,9€
- `rx_pb_57` NRG, nrg free BUSINESS1 (≤ 25 kVA): null
- `rx_pb_145` Zenith, Ειδικό: 0,299 +1€
- `rx_pb_148` Zenith, Power Business Basic 2.0: null
- `rx_pb_149` Zenith, Power Business Basic: null
- `rx_pb_150` Zenith, Power Business Basic 3.0: null
- `rx_pb_151` Zenith, Power Business Smart: null
- `rx_pb_153` Zenith, Power Business More is Less: null
- `rx_pb_124` Elin, Ειδικό: 0,27565 +0€
- `rx_pb_125` Elin, Power on! Blue Bussiness 21: 0,149 +5€
- `rx_pb_126` Elin, Power on! Blue Bussiness 23: 0,159 +0€
- `rx_pb_127` Elin, Power on! Blue Business 22: 0,159 +0€
- `rx_pb_128` Elin, Power On! Blue 12M Επαγγελματικό 1: 0,1299 +12,9€
- `rx_pb_129` Elin, Power On! Blue 12M Επαγγελματικό 2: 0,1599 +12,9€
- `rx_pb_130` Elin, Power On! Blue 12M Επαγγελματικό 3: 0,1299 +12,9€
- `rx_pb_131` Elin, Power On! Blue 24M Επαγγελματικό 1: 0,1199 +12,9€
- `rx_pb_132` Elin, Power On! Blue Benefit Γ21: 0,125 +9,5€
- `rx_pb_133` Elin, Power On! Blue 12M Επαγγελματικό 1+: 0,129 +9,9€
- `rx_pb_134` Elin, Power On! Blue 12M Επαγγελματικό 2+: 0,149 +9,9€
- `rx_pb_135` Elin, Power On! Blue 12M Επαγγελματικό 3+: 0,129 +9,9€
- `rx_pb_136` Elin, Power On! Blue 24M Επαγγελματικό 1+: 0,1199 +9,9€
- `rx_pb_137` Elin, Power On! Blue 12Μ Επαγγελματικό 22: 0,165 +9,9€
- `rx_pb_138` Elin, Power On! Blue Business 12M <35kVA: 0,199 +10,9€
- `rx_pb_139` Elin, Power On! Business Easy: null
- `rx_pb_140` Elin, Power On! Business 21: null
- `rx_pb_141` Elin, Power On! Business 23: null
- `rx_pb_142` Elin, Power On! Business 1 Zero: null
- `rx_pb_143` Elin, Power On! Business 3 Zero: null
- `rx_pb_144` Elin, Power On! Business Hybrid 200: null
- `rx_pb_89` Volton, Volton Blue Fixed Plus Business 21: 0,132 +19,5€
- `rx_pb_93` Volton, Volton Blue Flat Business 21 v2: 0,169 +9,9€
- `rx_pb_97` Volton, Volton Yellow Simple Business 23_v3: null
- `rx_pb_100` Volton, Volton Stay & Win Business 21: null
- `rx_pb_101` Volton, Volton Yellow Simple Protect Business 21_6.9: null
- `rx_pb_103` Volton, Volton Yellow Protect Business 21_6.9: null
- `rx_pb_105` Volton, Volton Stay & Win Business 23: null
- `rx_pb_106` Volton, Volton Stay & Win Business 21_v2: null
- `rx_pb_107` Volton, Volton Stay & Win Business 23_v2: null
- `rx_pb_108` Volton, Volton Yellow Flat Business 21 v3: null
- `rx_pb_110` Volton, Volton Yellow Flat Business 21 v2: null
- `rx_pb_111` Volton, Volton Yellow Protect Business 21_8.9: null
- `rx_pb_112` Volton, Volton Yellow Standard Business 21: null
- `rx_pb_114` Volton, Volton Yellow Zero Business 21: null
- `rx_pb_3` Enerwave, Ειδικό Γ23: 0,339 +5€
- `rx_pb_13` Enerwave, Bright Power for Business Γ22-Γ23: 0,229 +0€
- `rx_pb_15` Enerwave, Bright Power for Business Γ21: 0,1449 +12,9€
- `rx_pb_16` Enerwave, Reward Fee Free for Business Γ21: 0,149 +0€
- `rx_pb_17` Enerwave, Reward Prime for Business Γ21: 0,1149 +13,9€
- `rx_pb_18` Enerwave, Reward Stable for Business Γ21: 0,169 +12,9€
- `rx_pb_19` Enerwave, Reward Stable for Business Γ22-Γ23: 0,195 +0€
- `rx_pb_21` Enerwave, Reward Stable Zero for Business Γ21: 0,189 +0€
- `rx_pb_22` Enerwave, ELPEDISON Smart for Business Γ21: null
- `rx_pb_23` Enerwave, ELPEDISON Smart for Business Γ23: null
- `rx_pb_24` Enerwave, Smart Zero for Business Γ21: null
- `rx_pb_25` Enerwave, ELPEDISON Win for Business: null
- `rx_pb_26` Enerwave, ELPEDISON Flex for business: null
- `rx_pb_27` Enerwave, ELPEDISON Win More for business: null
- `rx_pb_28` Enerwave, ELPEDISON Win More 2 for business: null
- `rx_pb_29` Enerwave, Smart Zero for Business Γ23: null
- `rx_pb_31` Eunice Power, Ειδικό: 0,25652 +5€
- `rx_pb_32` Eunice Power, Eunice Business Fair II (21,22,23): 0,16 +4€
- `rx_pb_33` Eunice Power, EUNICE Business Fair III (21,22,23): 0,149 +4€
- `rx_pb_34` Eunice Power, Eunice Business EDGE: 0,125 +0€
- `rx_pb_35` Eunice Power, EUNICE BUSINESS CORE: 0,125 +9,9€
- `rx_pb_36` Eunice Power, EUNICE FAIR IV: 0,146 +5€
- `rx_pb_37` Eunice Power, EUNICE BUSINESS FIX 21,22: 0,1455 +0€
- `rx_pb_38` Eunice Power, BUSINESS SAFETY: 0,1555 +0€
- `rx_pb_40` Eunice Power, Eunice Business Flex: null
- `rx_pb_41` Eunice Power, Eunice Small Business Balance: null
- `rx_pb_42` Eunice Power, Eunice Large Business Balance: null
- `rx_pb_43` Eunice Power, EUNICE Basic Business III: null
- `rx_pb_185` Φυσικό αέριο Ελλάδος, Ειδικό - Επαγγελματικό 1: 0,23862 +5€
- `rx_pb_186` Φυσικό αέριο Ελλάδος, Ειδικό - ΦΟΠ: 0,23862 +5€
- `rx_pb_187` Φυσικό αέριο Ελλάδος, Ειδικό - Επαγγελματικό 2: 0,23817 +5€
- `rx_pb_188` Φυσικό αέριο Ελλάδος, Ειδικό - Επαγγελματικό Νυχτερινό: 0,23817 +5€
- `rx_pb_189` Φυσικό αέριο Ελλάδος, Ειδικό - Αγροτικό: 0,23817 +5€
- `rx_pb_190` Φυσικό αέριο Ελλάδος, MAXI Business 1 Secure: 0,173 +12,9€
- `rx_pb_191` Φυσικό αέριο Ελλάδος, MAXI Business 24/7 Fixed: 0,199 +0€
- `rx_pb_192` Φυσικό αέριο Ελλάδος, MAXI Business 1: null
- `rx_pb_193` Φυσικό αέριο Ελλάδος, MAXI Business 2: null
- `rx_pb_194` Φυσικό αέριο Ελλάδος, MAXI Business Night: null
- `rx_pb_195` Φυσικό αέριο Ελλάδος, MAXI Αγροτικό: null
- `rx_pb_196` Φυσικό αέριο Ελλάδος, MAXI Φωτισμού: null
- `rx_pb_197` Φυσικό αέριο Ελλάδος, Ρεύμα MAXI Business 1 Economy: null
- `rx_pb_198` Φυσικό αέριο Ελλάδος, MAXI Business 1 Save: null
- `rx_pb_58` OTE ESTATE, Ειδικό: 0,216 +5€
- `rx_pb_81` SOLAR ENERGY, Ειδικό: 0,24068 +5€
- `rx_pb_82` SOLAR ENERGY, Επαγγελματικό FIXED: 0,36 +10€
- `rx_pb_83` SOLAR ENERGY, Επαγγελματικό S21: null
- `rx_pb_84` SOLAR ENERGY, Επαγγελματικό S21+: null
- `rx_pb_85` SOLAR ENERGY, Επαγγελματικό S23: null
- `rx_pb_86` SOLAR ENERGY, Επαγγελματικό S22: null

**Αέριο οικιακό (48)**

- `rx_gr_28` nrg (Motor Oil), nrg fixed GAS: 0,047 +3,5€
- `rx_gr_29` nrg (Motor Oil), nrg fixed on time GAS: 0,0375 +9,99€
- `rx_gr_33` nrg (Motor Oil), GAS 4U (έως 02.2021): 0,11957 +4€
- `rx_gr_34` nrg (Motor Oil), GAS 4U (από 03.2021): 0,11693 +4,4€
- `rx_gr_83` ZeniΘ, Gas Home Secure: 0,041 +9,9€
- `rx_gr_84` ZeniΘ, Gas Home Secure 2.0: 0,031 +9,9€
- `rx_gr_89` ZeniΘ, Gas Home Plus: null
- `rx_gr_93` ZeniΘ, T2: null
- `rx_gr_94` ZeniΘ, T3: null
- `rx_gr_95` ZeniΘ, Gas Home Easy: null
- `rx_gr_96` ZeniΘ, Gas Home Star: null
- `rx_gr_97` ZeniΘ, Τ1: null
- `rx_gr_98` ZeniΘ, Gas Home Now SE: null
- `rx_gr_99` ZeniΘ, Gas Home Flex: null
- `rx_gr_73` ελίν (ΕΛΙΝΟΙΛ), Gas On! Fixed Now 24Μ Αυτόνομο: 0,0359 +7,9€
- `rx_gr_74` ελίν (ΕΛΙΝΟΙΛ), Gas On! Fixed Now 18Μ Αυτόνομο: 0,0359 +7,9€
- `rx_gr_75` ελίν (ΕΛΙΝΟΙΛ), Gas On! Fixed Now 12Μ Αυτόνομο: 0,0359 +7,9€
- `rx_gr_76` ελίν (ΕΛΙΝΟΙΛ), Gas On! Zero Fixed Αυτόνομο: 0,0449 +0€
- `rx_gr_77` ελίν (ΕΛΙΝΟΙΛ), Gas On! Zero Fixed Κοινόχρηστο: 0,0449 +0€
- `rx_gr_111` Φυσικό αέριο ΕΕΕ (ΔΕΠΑ), Gas Home Fixed: 0,037 +9,9€
- `rx_gr_51` Protergia (Metlen), Οικιακό Αυτόνομο/Κοινόχρηστο Value Gas Flex: 0,08025 +7€
- `rx_gr_52` Protergia (Metlen), Οικιακό Αυτόνομο/Κοινόχρηστο Value Gas Standard: 0,09025 +5€
- `rx_gr_101` ΗΡΩΝ, GAS BLUE HOME: 0,0369 +9,5€
- `rx_gr_103` ΗΡΩΝ, GAS MAX HOME: 0,08157 +3,4€
- `rx_gr_108` ΗΡΩΝ, DOUBLE HOME FLEX: 0,09591 +3,4€
- `rx_gr_109` ΗΡΩΝ, DOUBLE HOME FX: 0,08047 +3,4€
- `rx_gr_110` ΗΡΩΝ, GAS SHARE FLEX: 0,09811 +0€
- `rx_gr_13` enerwave (πρώην Elpedison), GasHome Fix: 0,055 +5€
- `rx_gr_14` enerwave (πρώην Elpedison), GasBuilding Fix | Κεντρικές Παροχές: 0,055 +5€
- `rx_gr_23` enerwave (πρώην Elpedison), GasHome | Αυτονομία: null
- `rx_gr_24` enerwave (πρώην Elpedison), GasHome Smart: null
- `rx_gr_25` enerwave (πρώην Elpedison), GasHome | Κεντρικές παροχές: null
- `rx_gr_26` enerwave (πρώην Elpedison), GasHome Flex: 0,0875 +5€
- `rx_gr_27` enerwave (πρώην Elpedison), GasHome Flex 2021: 0,1145 +5,5€
- `rx_gr_7` EFA ENERGY, go GAS Home: 0,0815 +4,8€
- `rx_gr_8` EFA ENERGY, go GAS central: 0,0839 +0€
- `rx_gr_53` Volton, Volton Gas Simple | Αυτόνομες Εγκαταστάσεις: 0,1003 +4,9€
- `rx_gr_54` Volton, Volton Gas Home: 0,07008 +4€
- `rx_gr_55` Volton, Volton Gas Home Dual: 0,0876 +4€
- `rx_gr_56` Volton, Volton Gas Central: 0,07248 +4€
- `rx_gr_57` Volton, Volton Gas Home Free: 0,08199 +4€
- `rx_gr_58` Volton, Volton Gas Central Free: 0,08607 +4€
- `rx_gr_59` Volton, KEN Gas Home Dual: 0,0876 +4€
- `rx_gr_60` Volton, KEN Gas Home Free: 0,08199 +4€
- `rx_gr_61` Volton, KEN Gas Central: 0,07248 +4€
- `rx_gr_62` Volton, KEN Gas Central Dual: 0,05285 +4€
- `rx_gr_63` Volton, KEN Gas Central Free: 0,08607 +4€
- `rx_gr_68` Volton, Volton Stay & Win v2 | Κοινόχρηστες Εγκαταστάσεις: 0,1003 +5,5€

**Αέριο επαγγελματικό (19)**

- `rx_gb_17` nrg (Motor Oil), GAS 4BUSINESS (έως 02.2021): 0,12701 +4€
- `rx_gb_18` nrg (Motor Oil), GAS 4BUSINESS (από 03.2021): 0,12516 +4,4€
- `rx_gb_40` ελίν (ΕΛΙΝΟΙΛ), Gas On! Zero Fixed Business: 0,0429 +0€
- `rx_gb_25` Protergia (Metlen), Επαγγελματικό Value Gas Standard: 0,09025 +5€
- `rx_gb_26` Protergia (Metlen), Επαγγελματικό Value Gas Flex: 0,08125 +7€
- `rx_gb_47` ΗΡΩΝ, GAS BUSINESS FLEX: 0,09702 +0€
- `rx_gb_6` enerwave (πρώην Elpedison), GasBusiness Fix: 0,055 +5€
- `rx_gb_9` enerwave (πρώην Elpedison), GasBusiness Smart: null
- `rx_gb_10` enerwave (πρώην Elpedison), GasBusiness: null
- `rx_gb_11` enerwave (πρώην Elpedison), GasBusiness Flex: 0,1145 +0€
- `rx_gb_12` enerwave (πρώην Elpedison), GasBusiness Pro1: 0,09 +0€
- `rx_gb_13` enerwave (πρώην Elpedison), GasBusiness Pro2: 0,092 +5€
- `rx_gb_4` EFA ENERGY, go GAS business: 0,0827 +0€
- `rx_gb_31` Volton, Volton Gas Business: 0,08199 +0€
- `rx_gb_32` Volton, Volton Gas Business Dual: 0,07767 +0€
- `rx_gb_33` Volton, Volton Gas Business Free: 0,0863 +0€
- `rx_gb_34` Volton, Ken Gas Business: 0,08199 +0€
- `rx_gb_35` Volton, KEN Gas Business Dual: 0,07767 +0€
- `rx_gb_36` Volton, KEN Business Free: 0,0863 +0€

</details>

### Αταίριαστα τιμολόγια του καταλόγου (41)

Μένουν με τη δική τους τιμή και τον μήνα της, εκτός σειράς.

`dei_dynamic` ΔΕΗ myHome Dynamic (Αυγούστου 2026) · `heron_blue_smart` Ήρων Blue Smart Home (Αυγούστου 2026) · `heron_protect` Ήρων Protect Home (Αυγούστου 2026) · `heron_happy_hour` Ήρων Happy Hour Home (Αυγούστου 2026) · `heron_ena` Ήρων Ε.ΝΑ (Virtual Net Metering) (Αυγούστου 2026) · `prot_sure_12` Protergia Value Sure 12M (Αυγούστου 2026) · `prot_dynamic` Protergia Dynamic One Home (Αυγούστου 2026) · `prot_picasso_s1` Protergia Picasso Small, 1.325 kWh/έτος (Αυγούστου 2026) · `prot_picasso_s2` Protergia Picasso Small, 1.875 kWh/έτος (Αυγούστου 2026) · `prot_picasso_s3` Protergia Picasso Small, 2.700 kWh/έτος (Αυγούστου 2026) · `prot_picasso_m1` Protergia Picasso Medium, 3.550 kWh/έτος (Αυγούστου 2026) · `prot_picasso_m2` Protergia Picasso Medium, 4.600 kWh/έτος (Αυγούστου 2026) · `prot_picasso_m3` Protergia Picasso Medium, 6.000 kWh/έτος (Αυγούστου 2026) · `prot_picasso_l1` Protergia Picasso Large, 11.000 kWh/έτος (Αυγούστου 2026) · `prot_picasso_l2` Protergia Picasso Large, 15.300 kWh/έτος (Αυγούστου 2026) · `prot_picasso_l3` Protergia Picasso Large, 20.200 kWh/έτος (Αυγούστου 2026) · `prot_picasso_student` Protergia Picasso Student (Αυγούστου 2026) · `nrg_now` NRG NRG Now Οικιακό (Αυγούστου 2026) · `nrg_adjust_biz` NRG nrg adjust 1.0 BUSINESS promo (Αυγούστου 2026) · `zen_fixed_1y` Zenith Power Home Fixed 1Y (Αυγούστου 2026) · `zen_fixed_24` Zenith Power Home Fixed 24 (Αυγούστου 2026) · `zen_sure_plus` Zenith Power Home Sure Plus (Αυγούστου 2026) · `zen_zenergy_xs` Zenith ZeΝergy XS, έως 2.000 kWh/έτος (Αυγούστου 2026) · `zen_zenergy_s` Zenith ZeΝergy S (Αυγούστου 2026) · `zen_zenergy_m` Zenith ZeΝergy M (Αυγούστου 2026) · `zen_zenergy_l` Zenith ZeΝergy L (Αυγούστου 2026) · `zen_zenergy_xl` Zenith ZeΝergy XL, έως 12.000 kWh/έτος (Αυγούστου 2026) · `elin_blue` Elin Home Blue Fixed (Αυγούστου 2026) · `enrw_stable_max` Enerwave Reward Stable Max (Αυγούστου 2026) · `enrw_stable` Enerwave Reward Stable (Αυγούστου 2026) · `enrw_wave_1` Enerwave My Wave Daily 1€/ημέρα, έως 1.920 kWh/έτος (Αυγούστου 2026) · `enrw_wave_15` Enerwave My Wave Daily 1,5€/ημέρα, έως 3.000 kWh/έτος (Αυγούστου 2026) · `enrw_wave_2` Enerwave My Wave Daily 2€/ημέρα, έως 4.200 kWh/έτος (Αυγούστου 2026) · `enrw_wave_25` Enerwave My Wave Daily 2,5€/ημέρα, έως 5.400 kWh/έτος (Αυγούστου 2026) · `enrw_wave_3` Enerwave My Wave Daily 3€/ημέρα, έως 6.600 kWh/έτος (Αυγούστου 2026) · `wv_home_standard` Watt+Volt (πλέον Protergia) Home Standard (Αυγούστου 2026) · `wv_home_blue` Watt+Volt (πλέον Protergia) Home Blue Σταθερό 12M (Αυγούστου 2026) · `wv_home_special` Watt+Volt (πλέον Protergia) Home Ειδικό (Γ1) (Αυγούστου 2026) · `fa_oikia` Φυσικό αέριο Ελλάδος Oikia Green (Αυγούστου 2026) · `zen_biz_save` ZeniΘ Gas Business Save (Αυγούστου 2026) · `efa_plus_biz` EFA ENERGY PLUS GAS EXTRA BUSINESS (Αυγούστου 2026)

### Γραμμές χωρίς τιμή Οκτωβρίου

Υπήρχαν ήδη, η ΡΑΑΕΥ δεν έχει τιμή Οκτωβρίου, μένει η παλιά με τον μήνα της, εκτός σειράς (23): `dei_4students` (Αυγούστου 2026), `heron_yellow_free` (Αυγούστου 2026), `heron_yellow_student` (Αυγούστου 2026), `heron_protect_biz_s` (Αυγούστου 2026), `zen_select` (Αυγούστου 2026), `zen_save30` (Αυγούστου 2026), `zen_light` (Αυγούστου 2026), `zen_student` (Αυγούστου 2026), `volton_yellow_biz` (Αυγούστου 2026), `enrw_smart` (Αυγούστου 2026), `enrw_smart_zero` (Αυγούστου 2026), `zen_central_easy` (Αυγούστου 2026), `zen_central_save` (Αυγούστου 2026), `zen_home_now` (Αυγούστου 2026), `zen_home_pulse` (Αυγούστου 2026), `zen_home_save` (Αυγούστου 2026), `zen_biz_easy2` (Αυγούστου 2026), `zen_biz_save_p` (Αυγούστου 2026), `zen_biz_easy1` (Αυγούστου 2026), `fae_pliris` (Αυγούστου 2026), `fae_kouzina` (Αυγούστου 2026), `fae_extra` (Αυγούστου 2026), `fae_biz` (Αυγούστου 2026)

Χωρίς τιμή, null (153): `rx_pr_151`, `rx_pr_221`, `rx_pr_222`, `rx_pr_223`, `rx_pr_224`, `rx_pr_225`, `rx_pr_229`, `rx_pr_230`, `rx_pr_231`, `rx_pr_233`, `rx_pr_234`, `rx_pr_235`, `rx_pb_168`, `rx_pb_169`, `rx_pb_170`, `rx_pb_171`, `rx_pb_172`, `rx_pb_173`, `rx_pb_175`, `rx_pb_178`, `rx_pb_179`, `rx_pb_180`, `rx_pb_181`, `rx_pb_183`, `rx_pb_184`, `rx_pr_52`, `rx_pr_53`, `rx_pr_54`, `rx_pr_55`, `rx_pr_56`, `rx_pr_57`, `rx_pr_58`, `rx_pr_65`, `rx_pr_67`, `rx_pb_52`, `rx_pb_53`, `rx_pb_54`, `rx_pb_57`, `rx_pr_188`, `rx_pr_189`, `rx_pr_190`, `rx_pr_191`, `rx_pr_194`, `rx_pr_195`, `rx_pr_198`, `rx_pr_199`, `rx_pr_200`, `rx_pr_201`, `rx_pr_203`, `rx_pr_206`, `rx_pb_148`, `rx_pb_149`, `rx_pb_150`, `rx_pb_151`, `rx_pb_153`, `rx_pr_165`, `rx_pr_166`, `rx_pr_167`, `rx_pr_168`, `rx_pr_169`, `rx_pr_170`, `rx_pb_139`, `rx_pb_140`, `rx_pb_141`, `rx_pb_142`, `rx_pb_143`, `rx_pb_144`, `rx_pr_115`, `rx_pr_116`, `rx_pr_118`, `rx_pr_121`, `rx_pr_122`, `rx_pr_123`, `rx_pr_124`, `rx_pr_126`, `rx_pr_127`, `rx_pr_130`, `rx_pr_132`, `rx_pr_133`, `rx_pr_134`, `rx_pr_135`, `rx_pb_97`, `rx_pb_100`, `rx_pb_101`, `rx_pb_103`, `rx_pb_105`, `rx_pb_106`, `rx_pb_107`, `rx_pb_108`, `rx_pb_110`, `rx_pb_111`, `rx_pb_112`, `rx_pb_114`, `rx_pr_21`, `rx_pr_23`, `rx_pr_24`, `rx_pr_25`, `rx_pr_26`, `rx_pb_22`, `rx_pb_23`, `rx_pb_24`, `rx_pb_25`, `rx_pb_26`, `rx_pb_27`, `rx_pb_28`, `rx_pb_29`, `rx_pr_38`, `rx_pr_39`, `rx_pr_40`, `rx_pb_40`, `rx_pb_41`, `rx_pb_42`, `rx_pb_43`, `rx_pr_241`, `rx_pr_243`, `rx_pr_244`, `rx_pr_245`, `rx_pr_246`, `rx_pr_247`, `rx_pr_248`, `rx_pr_249`, `rx_pr_250`, `rx_pr_251`, `rx_pr_252`, `rx_pr_253`, `rx_pr_254`, `rx_pb_192`, `rx_pb_193`, `rx_pb_194`, `rx_pb_195`, `rx_pb_196`, `rx_pb_197`, `rx_pb_198`, `rx_pr_96`, `rx_pr_97`, `rx_pr_98`, `rx_pb_83`, `rx_pb_84`, `rx_pb_85`, `rx_pb_86`, `rx_gr_89`, `rx_gr_93`, `rx_gr_94`, `rx_gr_95`, `rx_gr_96`, `rx_gr_97`, `rx_gr_98`, `rx_gr_99`, `rx_gr_23`, `rx_gr_24`, `rx_gr_25`, `rx_gb_9`, `rx_gb_10`

## Μέρος 2. Στεγαστικά και Euribor

**Καμία από τις σελίδες δεν άνοιξε από εδώ** (λίστα πιο κάτω). Οι τιμές είναι από την οδηγία με τις πηγές της. Η βάση διαβάστηκε μόνο για ανάγνωση και έχει ήδη τον μέσο όρο Σεπτεμβρίου («ΕΚΤ, μέσος όρος μήνα 01/09/2026»: 3M 2,6350455, 1M 2,4143636) και τα νέα στεγαστικά 3,39 Αυγούστου. Η ετικέτα πηγής δεν άλλαξε. Η τιμή ημέρας 2/10 της Τράπεζας της Φινλανδίας δεν μπαίνει πουθενά.

| id | Μήνας | Παλιά | Νέα | URL |
|---|---|---|---|---|
| `MARKET_FALLBACK.euribor_3m`, `RATES_FALLBACK.euribor_3m` | Σεπ 2026 (μέσος) | 2,513 (Αύγ) | 2,635 | https://data.ecb.europa.eu/data/datasets/FM/FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA |
| `MARKET_FALLBACK.euribor_1m`, `RATES_FALLBACK.euribor_1m` | Σεπ 2026 (μέσος) | 2,221 (Αύγ) | 2,414 | https://data.ecb.europa.eu/data/datasets/FM/FM.M.U2.EUR.RT.MM.EURIBOR1MD_.HSTA |
| `RATES_FALLBACK.euribor_6m` / `euribor_12m` | Σεπ 2026 (μέσος) | 2,713 / 2,954 | 2,922 / 3,247 | ίδια σειρά ΕΚΤ, όπως στη βάση |
| `RATES_FALLBACK.bog_housing_new` | Αύγ 2026 | 3,56 (Ιούν) | 3,39 | https://data.ecb.europa.eu/data/datasets/MIR/MIR.M.GR.B.A2C.F.R.A.2250.EUR.N |
| `RATES_FALLBACK.bog_housing_stock` | Αύγ 2026 | 3,01 | 2,90 | όπως στη βάση |
| `EURIBOR_HISTORY` | Σεπ 2026 | (δεν υπήρχε) | 2,635 | https://data.ecb.europa.eu/data/datasets/FM/FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA |
| `alpha.note` | 21.9.2026 | «Alpha Κατοικία: σταθερό 1 έτους 2,70% και 3 ετών 2,90%» | + Euribor 3M + 1,80% άνω 300.000€ έως 60% της αξίας, Alpha Δέσμευση χωριστά (3M + 1,00% ή σταθερό 5 ετών 2,90%), νέες αιτήσεις από 1.6.2026 | https://www.alpha.gr/-/media/AlphaGr/pdf-files/diafora-sunodeutika-pdf/xrisima-eggrafa/oroi-sunallagon-epitokia-katatheseon-xorigiseon.pdf |
| `alpha.features` | 21.9.2026 | (δεν υπήρχε) | Εισφορά ν.128/75 0,12% (0,60% για μη οικιστικά) | https://www.alpha.gr/-/media/AlphaGr/pdf-files/diafora-sunodeutika-pdf/xrisima-eggrafa/oroi-sunallagon-epitokia-katatheseon-xorigiseon.pdf |
| `eurobank.note` | 27.07.2026 | «Ανταγωνιστικοί όροι» | έκπτωση 0,40% για 3 έτη χωριστά από το σταθερό 2,90%, χωρίς αφαίρεση | https://www.eurobank.gr/-/media/eurobank/rates/epitokia-daneiakon-proionton.pdf |
| `piraeus.note` | 20.02.2026 | «Σταθερό 3 έως 30 ετών σε ενιαίο εύρος» | + εύρος 2,40% έως 4,70%, Σπίτι 25 (2,20% έως 2,75% 4 έτη, 2,90% έως 3,70% το 5ο), cash collateral 1M + 1,00% ώς 31/12/2026, ενέχυρο 105% | https://www.piraeusbank.gr/el/support/epitokia-deltia-timwn/ · https://www.piraeusbank.gr/el/idiwtes/proionta-upiresies/stegastika-daneia/stegastiko-daneio-me-eksasfalisi-katatheseon-cash-collateral |
| `ethniki.note` | χωρίς ημερομηνία | «Υψηλότερο δάνειο προς αξία 90%» | ΕΣΤΙΑ σταθερό από 2,90% μετά 3M + από 1,75%, κυμαινόμενο από 1,60%, ΕΣΤΙΑ Πράσινη 1,35% ή 2,80% | https://www.nbg.gr/el/idiwtes/daneia/stegastika-daneia |
| `optima.note` | 24.11.2025 | «Προνομιακή εξυπηρέτηση» | σταθερό 5 ετών 3,50% έως 4,00%, χωρίς 3ετές | https://www.optimabank.gr/media/1kgfzcio/anx241_pinakas_epitokion_xorigitikon_proionton.pdf |
| `BANKS_VERIFIED` | | 2026-09-17 | 2026-09-28 (η παλαιότερη επίσημη, Optima) | |

**Ήταν ήδη σωστά στο main (#369, 04/10)**
- Eurobank: 3M + 0,80% έως 2,70%, σταθερό 3 ετών 2,90%, χωρίς το 2,50 της υπερημερίας.
- Credia First Home: σταθερό από 2,15%, περιθώριο από 1,60%, 3M, εισφορά 0,12%, χωρίς ημερομηνία δελτίου. Το 2,293 δεν αποθηκεύεται.
- Πειραιώς: 1M + 1,40% έως 2,45%, σταθερό 2,40% έως 4,70%.
- Optima: χωρίς 3ετές, σταθερό 5 ετών 3,50% έως 4,00%.
- Εθνική: κανένα προϊόν δεν ονομάζεται για το 2,50.
- Alpha: το 2,50 έφυγε.

**Δεν έγιναν: χρειάζονται απόφαση ιδιοκτήτη** (η άδεια για αλλαγή κοινόχρηστων πόρων δεν δόθηκε σε αυτή τη συνεδρία)
1. **Μετανάστευση για το `bank_rates`.** Η κάρτα δείχνει το `note` της βάσης. Οι σημειώσεις αυτού του PR ισχύουν μόνο στην εφεδρική λίστα, ώσπου να μπουν και στη βάση.
2. **Το `fixed_min` της Alpha στη βάση είναι 2,9 από σήμερα, όχι 2,70.** Αιτία το `supabase/functions/bank-rates-updater/index.ts` (γρ. ~320). Η εβδομαδιαία ενημέρωση της Δευτέρας ξαναϋπολογίζει το `fixed_min` ως το μικρότερο των στηλών 3 έως 20 ετών σε κάθε πέρασμα. Έτσι έσβησε το σταθερό 1 έτους 2,70% της Alpha, που δεν έχει στήλη. Το ίδιο θα πάθει το 2,50 της Εθνικής, όταν βρει επίσημη πηγή. Η διόρθωση: ξαναϋπολογισμός μόνο όταν αλλάζει στήλη σταθερού. Η αλλαγή στον κώδικα δεν έγινε.
3. **Σημείο 20.** Το PDF της Εθνικής (Ενημέρωση 01/10/2026) δεν άνοιξε, οπότε το «σταθερό για 3 έτη 2,50%» δεν δένεται με «ΤΟ ΠΡΩΤΟ ΜΟΥ ΣΠΙΤΙ» ή «ΕΣΤΙΑ ΠΡΟΝΟΜΙΟ ΜΕ ΕΞΑΣΦΑΛΙΣΗ ΚΙΝΗΤΕΣ ΑΞΙΕΣ». Μένει χωρίς όνομα προϊόντος. Το ΕΣΤΙΑ «από 2,90%» δεν άλλαξε.
4. Η Alpha Δέσμευση και το cash collateral της Πειραιώς μπήκαν ως **χωριστή γραμμή στη σημείωση της κάρτας**. Δεν έγιναν δεύτερη σειρά στη σύγκριση, γιατί δεν υπάρχουν στοιχεία για LTV, ποσά και διάρκεια. Αν θέλετε δική τους σειρά στον πίνακα, χρειάζονται αυτά τα πεδία.

## Μέρος 3. Vodafone

**Καμία αλλαγή.** Το `app/dashboard/components/BillsProviders.tsx` έχει ήδη (#369, 04/10):
- Full Fiber 300 Plus 24,22€ / 500 Plus 28,35€ / 1 Gbps Plus 31,33€ χωρίς κινητή Vodafone
- 22,80€ / 26,90€ / 29,90€ με κινητή Vodafone
- ΦΠΑ 24% μέσα
- και τις δύο διατυπώσεις: 24μηνο συμβόλαιο για νέους πελάτες και 12 πρώτοι μήνες με αναπροσαρμογή έως 3€ για αιτήσεις από 01/05/26

Δεν υπάρχει τιμή 13ου μήνα και τα «3 πάγια δώρο» δεν μπαίνουν στη μηνιαία τιμή. Τα υπόλοιπα (24/50, TV, Nova, Cosmote, μέσος όρος 22,50€, Εθνική Ασφαλιστική, φόροι, πακέτα, προγράμματα) δεν άλλαξαν.

## Σελίδες που δεν άνοιξαν

Όλες, από αυτό το περιβάλλον: ο διαμεσολαβητής δικτύου τις μπλοκάρει (`EGRESS_BLOCKED`, curl 000).
- https://www.alpha.gr/-/media/AlphaGr/pdf-files/diafora-sunodeutika-pdf/xrisima-eggrafa/oroi-sunallagon-epitokia-katatheseon-xorigiseon.pdf
- https://www.eurobank.gr/-/media/eurobank/rates/epitokia-daneiakon-proionton.pdf
- https://www.crediabank.com/idiotes/daneia/stegastika/stegastiko-daneio-crediabank-first-home/
- https://www.piraeusbank.gr/el/support/epitokia-deltia-timwn/
- https://www.piraeusbank.gr/el/idiwtes/proionta-upiresies/stegastika-daneia/stegastiko-daneio-me-eksasfalisi-katatheseon-cash-collateral
- https://www.nbg.gr/el/idiwtes/daneia/stegastika-daneia
- https://www.nbg.gr/-/jssmedia/Files/Timologio/web_portal_elliniko_epitokia-timologio_daneiwn.pdf
- https://www.optimabank.gr/individuals/daneia/stegastiko-daneio/
- https://www.optimabank.gr/media/1kgfzcio/anx241_pinakas_epitokion_xorigitikon_proionton.pdf
- https://www.vodafone.gr/statheri-internet-programmata/fiber-to-the-home
- `data-api.ecb.europa.eu` (σειρές Euribor). Η βάση τις έχει ήδη από την πρωινή τροφοδοσία.

## Προστατευμένες διαδρομές
- `data/raaey/energycost-2026-10.json`: νέο, μεταγραφή του πίνακα της ΡΑΑΕΥ (energycost.gr, Οκτώβριος 2026, ανάγνωση 05/10/2026)
- `data/price-sources.json`: `checkedAt` 2026-10-05, ετικέτα «Οκτώβριος 2026», σύνδεσμος στον πίνακα, ίδια πηγή

## Έλεγχοι
- `npm run guards`: 141 από 141
- `npm test`: 313 από 313 σουίτες, μαζί με το νέο `lib/energy/raaey.test.ts` (4.506 έλεγχοι). Ελέγχει κάθε συνδεδεμένο τιμολόγιο κελί προς κελί με τη γραμμή του, όπως και ότι δεν μπήκε κανένα μη εμπορικά διαθέσιμο ή απορριφθέν.
- `tsc --noEmit`: καθαρό
