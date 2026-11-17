# Προέλευση

Το skill `paradosi` είναι **διασκευή** στα ελληνικά, με τους κανόνες του PROPERWISE, του
`skills/finishing-a-development-branch/SKILL.md` από το αποθετήριο [obra/superpowers](https://github.com/obra/superpowers).

- Commit πηγής: `22f0b463e7a5e579904dd6211a520321035526f7` (v7.0.2, 03/11/2026)
- Διασκευή: 17/11/2026, Ομάδα Properwise
- Μεταφέρθηκε μόνο η μέθοδος, ξαναγραμμένη. Κανένα script, hook, πρότυπο HTML,
  διακομιστής ή εξάρτηση. Καμία κλήση δικτύου, κανένα λογότυπο, κανένα telemetry.

## Τι άλλαξε σε σχέση με την πηγή

- Καμία επιλογή «συγχώνευση τοπικά» ή «απόρριψη»: η ροή καταλήγει πάντα σε PR, τη συγχώνευση την κάνει ο ιδιοκτήτης.
- guards, test, typecheck, lint πριν από κάθε push, χωρίς σωλήνα.
- Οχι rebase ή force-push· merge του `origin/main`· `bash scripts/rebranch.sh` μετά από squash.
- Γραμμές τέλους commit και υποσημείωση PR της συνεδρίας, πηγές για προστατευμένες διαδρομές.
- CI: PR χωρίς ελέγχους σημαίνει σύγκρουση· ακύρωση στο όριο χρόνου ξανατρέχει μία φορά.
- Οχι `pkill`.

## Αδεια της πηγής

```
MIT License

Copyright (c) 2025 Jesse Vincent

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

Το κείμενο της άδειας μένει σε κάθε αντίγραφο ή ουσιώδες τμήμα. Ο δημιουργός του
superpowers είναι ο Jesse Vincent (Prime Radiant).
