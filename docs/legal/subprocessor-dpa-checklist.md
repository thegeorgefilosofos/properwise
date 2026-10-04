# Πώς να υπογράψετε τα DPAs των υπεργολάβων — Checklist

> **ΑΡΧΙΚΟ ΣΧΕΔΙΟ, ΑΝΤΙΚΑΤΕΣΤΗΜΕΝΟ (σημείωση 04.10.2026).** Το κείμενο αυτό είναι
> το αρχικό σχέδιο v0.1 και δεν ισχύει. Ισχύουν οι σελίδες `/privacy`, `/terms` και
> `/trust` και τα μητρώα στο `lib/legal/*.ts` (ταυτότητα, υπεργολάβοι, λόγια της
> χρέωσης), από τα οποία διαβάζουν οι σελίδες. Όπου διαφέρουν, υπερισχύουν εκείνα.
> Στις 04.10.2026 διορθώθηκαν μόνο όσα ήταν συγκεκριμένα ανακριβή· τα πεδία
> `[ΣΥΜΠΛΗΡΩΣΤΕ ...]` μένουν ως έχουν.
> **Original draft, superseded (note of 04.10.2026).** Not in force. The live pages
> `/privacy`, `/terms` and `/trust` and the registries in `lib/legal/*.ts` prevail
> wherever they differ. Only concretely inaccurate statements were corrected.

> **DRAFT — v0.1 (2026-07-22).** Λειτουργικός οδηγός για να κλείσουν τα ☐ στο
> `docs/compliance/subprocessors.md`. Κάθε βασικός υπεργολάβος προσφέρει τυποποιημένο
> DPA με ενσωματωμένες SCCs — δεν χρειάζεται διαπραγμάτευση, μόνο **αποδοχή/υπογραφή,
> αρχειοθέτηση, ενημέρωση μητρώου**.

## Γενικά βήματα (για κάθε υπεργολάβο)
1. Συνδεθείτε με τον **λογαριασμό-οργανισμό** (όχι προσωπικό) που κατέχει τα production δεδομένα.
2. Συμπληρώστε τα **νομικά στοιχεία** (επωνυμία, ΑΦΜ, διεύθυνση, υπογράφων) — τα ίδια placeholders.
3. Αποδεχθείτε/υπογράψτε το DPA· βεβαιωθείτε ότι περιλαμβάνει **EU SCCs (Module 2, Controller→Processor)**.
4. **Κατεβάστε το PDF** σε `docs/legal/executed-dpas/<provider>.pdf` (ή ασφαλή αποθήκη).
5. Ενημερώστε το `subprocessors.md`: ☐ → ✅ με **ημερομηνία + έκδοση**.

## 1. Supabase — κρίσιμο, EU/Frankfurt
- [x] Dashboard → Organization → Legal/Compliance (ή supabase.com/legal/dpa) → υπογραφή DPA (SCCs). **Υπογράφηκε 23.09.2026** (`lib/legal/subprocessors.ts`, `TRANSFER_SAFEGUARDS`).
- [x] Επιβεβαίωση project **`eu-central-1`** (data residency ΕΕ).
- [ ] (Pro) managed backups/PITR όταν αναβαθμιστείτε.

## 2. Resend — email, ΗΠΑ (SCCs)
- [x] Settings → Legal/DPA → υπογραφή με **SCCs**. **Υπογράφηκε 23.09.2026.**
- [ ] Επιβεβαίωση ελαχιστοποίησης (μόνο email/όνομα/περιεχόμενο).

## 3. Anthropic — AI, ΗΠΑ (SCCs) — προσοχή στο no-training
- [x] Console → Data Processing Addendum → υπογραφή με **SCCs**. **Υπογράφηκε 23.09.2026.**
- [x] **Έγγραφη επιβεβαίωση όρων μη-εκπαίδευσης** (Commercial Terms §B, αρχειοθετημένοι).
- [ ] Καμία ειδική κατηγορία δεδομένων στα prompts.

## 4. GitHub — κώδικας/CI/backups, ΗΠΑ (SCCs)
- [x] Αποδοχή Microsoft/GitHub DPA. **Υπογράφηκε** (επιβεβαίωση ιδιοκτήτη 25.09.2026, `lib/legal/subprocessors.ts`). Μένει το PDF στο αρχείο.
- [x] **Backup artifacts κρυπτογραφημένα** (`BACKUP_PASSPHRASE` set).

## 5. Creem — χρέωση συνδρομών (merchant of record)
- [x] Settings → Legal → DPA· η κάρτα μένει στο PCI scope της Creem, που πουλά ως merchant of record και αποδίδει τον ΦΠΑ κάθε χώρας. **Αποδεκτή στις 23.09.2026** (πηγή: δήλωση του ιδιοκτήτη, 27.09.2026).
- [x] Αντίγραφο PDF της αποδεκτής DPA σε ασφαλή αποθήκη εκτός αποθετηρίου (πηγή: δήλωση του ιδιοκτήτη, 27.09.2026).

## 6. Vercel — φιλοξενία, ΗΠΑ
- [ ] Σύμβαση επεξεργασίας: **δεν έχει υπογραφεί**. Το πακέτο φιλοξενίας που χρησιμοποιείται
      σήμερα δεν την προβλέπει· εκκρεμεί μαζί με τη μετάβαση σε επαγγελματικό πακέτο, έπειτα
      αρχειοθέτηση του PDF.

## Μελλοντικοί (πριν το go-live)
- [ ] **Google/Apple/Mozilla/Microsoft (υπηρεσίες push των περιηγητών)**: ενεργοποιούνται μόλις
      μπουν τα κλειδιά VAPID. Παραδίδουν κρυπτογραφημένο περιεχόμενο (RFC 8291) και
      βλέπουν μόνο τη διεύθυνση της συσκευής· η ειδοποίηση όμως εμφανίζεται σε οθόνη
      κλειδώματος, οπότε ο κανόνας «τίποτα που δεν θα άντεχε δημόσιο βλέμμα» ισχύει.
- [ ] **Viber/WhatsApp(Meta)/Apple(APNs)**: DPA κάθε παρόχου **πριν** τις
      πολυκαναλικές ειδοποιήσεις· κανόνας «χωρίς ποσά/ονόματα στην οθόνη κλειδώματος».

## Μετά την υπογραφή όλων
- [ ] `subprocessors.md`: όλα τα ☐ → ✅ με ημερομηνίες.
- [ ] **Δημοσίευση περίληψης** καταλόγου υπεργολάβων στον ιστότοπο (28(3)(δ)).
- [ ] **Διαδικασία ειδοποίησης πελατών** για αλλαγές (με δικαίωμα εναντίωσης, §8 DPA).
- [ ] Καταγραφή εκδόσεων/ημερομηνιών SCC (due diligence αγοραστή).

---

## English quick reference
Each core subprocessor offers a **standard, click-to-accept DPA with EU SCCs (Module 2,
Controller→Processor)** — accept/sign, save the PDF, update the register.
1. **Supabase** — Org → Legal; sign DPA (SCCs); confirm `eu-central-1`. Signed 23.09.2026.
2. **Resend** — Settings → DPA (SCCs). Signed 23.09.2026.
3. **Anthropic** — Console → DPA (SCCs); **confirm no-training in writing**; no special-
   category data in prompts. Signed 23.09.2026.
4. **GitHub** — accept Microsoft/GitHub DPA; confirm **encrypted** backups. Signed (owner, 25.09.2026).
5. **Creem** — Settings → Legal → DPA; card stays in Creem PCI scope; they are the merchant of record.
6. **Vercel** — hosting; DPA **not signed**, pending the move to a professional plan.
Then flip every ☐→✅ with dates; publish a subprocessor summary; set up customer change-
notification; log SCC versions. Store signed PDFs in `docs/legal/executed-dpas/`.
