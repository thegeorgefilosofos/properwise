# Προέλευση

Το skill `seo-elegxos` είναι δικό μας κείμενο, γραμμένο για το PROPERWISE. Πήρε ιδέες
και δομή από το **claude-seo** του AgriciDaniel:

- Αποθετήριο: https://github.com/AgriciDaniel/claude-seo
- Commit: `468ed5b0d9e3249394783710e54abb02837e326b` (15/11/2026)
- Ανάγνωση: 17/11/2026, σε κλώνο έξω από το έργο. Δεν εκτελέστηκε τίποτα από
  το αποθετήριο: κανένα script εγκατάστασης, hook, Python ή plugin.

## Τι πήραμε

- Το σχήμα της ενέργειας με «πώς θα ξέρεις ότι δούλεψε» και «πώς θα ξέρεις ότι απέτυχε» (`skills/seo/references/thinking-framework-validate-act.md`).
- Τη βαθμολόγηση E-E-A-T ανά διάσταση με συντελεστές 20/25/25/30, δηλωμένη ως ευρετική (`skills/seo/references/eeat-framework.md`).
- Τεχνικούς ελέγχους ανίχνευσης: canonical και noindex στο αρχικό HTML, κανένα rendering σε σελίδα εκτός 200, όριο 2 MB του Googlebot (`skills/seo-technical/SKILL.md`).
- Τις ημερομηνίες ενημερώσεων της Google (`data/google-updates.json`), στο `references/enimerosi-google.md`.

## Τι αφήσαμε έξω και γιατί

- Ολα τα scripts και τα Python εργαλεία (`scripts/claude-seo run …`), τα hooks
  και την εγκατάσταση ως plugin: κώδικας τρίτου που δεν ελέγχθηκε γραμμή γραμμή.
- Επεκτάσεις με πληρωμένο κλειδί ή κλήση προς υπηρεσία (DataForSEO, Ahrefs,
  SE Ranking, Profound, Firecrawl, PostHog, Matomo, παραγωγή εικόνων, Google APIs
  με διαπιστευτήρια).
- Την επέκταση Shopify (δεν είμαστε κατάστημα).
- Το υποσέλιδο κοινότητας, τους συνδέσμους προώθησης και κάθε άλλη αναφορά
  μάρκετινγκ του δημιουργού.
- Τα ελάχιστα πλήθη λέξεων ανά τύπο σελίδας: η Google δεν βαθμολογεί με πλήθος
  λέξεων.
- Στατιστικά τρίτων χωρίς πρωτογενή πηγή.

Ο κανόνας για ξένα skills: `docs/org/ergaleia/skills-trita.md`.

## Αδεια (MIT, πλήρες κείμενο)

```
MIT License

Copyright (c) 2026 agricidaniel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
