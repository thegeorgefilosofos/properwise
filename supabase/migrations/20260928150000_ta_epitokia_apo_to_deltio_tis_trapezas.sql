-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΑ ΕΠΙΤΟΚΙΑ ΑΠΟ ΤΟ ΔΕΛΤΙΟ ΤΗΣ ΚΑΘΕ ΤΡΑΠΕΖΑΣ, ΜΕ ΤΗΝ ΗΜΕΡΟΜΗΝΙΑ ΤΟΥ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΕΙΧΕ Η ΒΑΣΗ (SELECT στην παραγωγή, 28/09/2026). Και οι έξι ενεργές
-- τράπεζες έγραφαν `source_url = 'https://vresdaneio.gr'` και
-- `verified_at = 2026-09-17`. Ένας συγκριτικός ιστότοπος, όχι η τράπεζα. Και η
-- τροφοδοσία που θα τα ξαναέλεγχε δεν είχε πετύχει ούτε ένα πέρασμα από τις
-- 03/09 (bank_rate_checks: 23 αποτυχίες, καμία επιτυχία).
--
-- ΠΟΙΟΣ ΕΛΕΓΞΕ ΚΑΙ ΠΟΥ. Η ομάδα Grok, στο ops.handoffs a41bd5b2 (28/09/2026,
-- στοιχείο P1-2/P1-3), διάβασε το επίσημο δελτίο ή τη σελίδα επιτοκίων κάθε
-- τράπεζας. Ο ιδιοκτήτης έδωσε εντολή να εμπιστευτούμε τους αριθμούς όπου
-- υπάρχει πηγή: ο διαμεσολαβητής δικτύου εδώ μπλοκάρει τους ιστότοπους των
-- τραπεζών, οπότε η διασταύρωση δεν μπορούσε να γίνει ξανά από αυτό το
-- περιβάλλον. Κάθε τιμή που αλλάζει γράφεται παρακάτω με την πηγή της, την
-- ημερομηνία του εγγράφου και την παλιά τιμή.
--
-- ΤΙ ΠΡΟΣΤΙΘΕΤΑΙ ΣΤΟ ΣΧΗΜΑ.
--   source_doc_date  η ημερομηνία ισχύος του δελτίου, όπως τη γράφει η τράπεζα.
--                    Κενή όταν η πηγή δεν έχει ημερομηνία (Εθνική) ή δεν
--                    υπάρχει επίσημη πηγή (Credia). Δεν τη συμπληρώνουμε εμείς.
--   rate_index       ο δείκτης του κυμαινόμενου: '1M' ή '3M'. Η Πειραιώς
--                    τιμολογεί σε Euribor μηνός, οι άλλες σε τριμήνου.
--
-- ΠΕΔΙΟ ΠΟΥ Η ΠΗΓΗ ΔΕΝ ΔΗΜΟΣΙΕΥΕΙ ΓΙΝΕΤΑΙ null, ΟΧΙ ΕΚΤΙΜΗΣΗ: το 3ετές της
-- Optima και το ανώτατο περιθώριο της Εθνικής.
--
-- ΤΟ ΙΔΙΟ ΣΤΟ app/dashboard/components/TabLoanData.tsx (BANKS), που είναι η
-- εφεδρική εκδοχή του ίδιου πίνακα: η οθόνη συμπληρώνει από εκεί ό,τι λείπει
-- από τη βάση, οπότε οι δύο πρέπει να λένε τα ίδια.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.bank_rates add column if not exists source_doc_date date;
alter table public.bank_rates add column if not exists rate_index text;

alter table public.bank_rates drop constraint if exists bank_rates_rate_index_check;
alter table public.bank_rates add constraint bank_rates_rate_index_check
  check (rate_index is null or rate_index in ('1M', '3M'));

comment on column public.bank_rates.source_doc_date is
  'Ημερομηνία ισχύος του επίσημου δελτίου της τράπεζας στο source_url. Κενή όταν η πηγή δεν γράφει ημερομηνία.';
comment on column public.bank_rates.rate_index is
  'Ο δείκτης Euribor του κυμαινόμενου: 1M ή 3M, όπως τον δημοσιεύει η τράπεζα.';

-- ── Eurobank ─────────────────────────────────────────────────────────────
-- ΠΗΓΗ: https://www.eurobank.gr/-/media/eurobank/rates/epitokia-daneiakon-proionton.pdf
-- Ημερομηνία εγγράφου 27/07/2026 (ανάγνωση Grok 28/09/2026).
--   Κυμαινόμενο Euribor 3M + 0,80% έως 2,70%
--     variable_spread_min  0.60        → 0.80
--     variable_spread_max  2.45        → 2.70
--   Σταθερό: 3ε 2,90 · 5ε 3,50 · 10ε 3,90 · 15ε 4,20 · 20ε 4,20· πρώτη κατοικία
--   −0,40 στο 3ετές (2,50) και −0,10 στα υπόλοιπα.
--     fixed_3yr   '2.50-2.90'  αμετάβλητο
--     fixed_5yr   '2.50-2.90'  → '3.40-3.50'
--     fixed_10yr  '3.40-3.90'  → '3.80-3.90'
--     fixed_15yr  '3.40-3.90'  → '4.10-4.20'
--     fixed_20yr  '4.10-4.20'  αμετάβλητο
--     fixed_min   2.50         αμετάβλητο
--   Το χαρακτηριστικό «Spread από 1,45%» φεύγει: έλεγε αριθμό σε ελεύθερο
--   κείμενο που δεν συμφωνούσε ούτε με το πεδίο ούτε με το δελτίο.
update public.bank_rates set
  variable_spread_min = 0.80,
  variable_spread_max = 2.70,
  fixed_3yr  = '2.50-2.90',
  fixed_5yr  = '3.40-3.50',
  fixed_10yr = '3.80-3.90',
  fixed_15yr = '4.10-4.20',
  fixed_20yr = '4.10-4.20',
  fixed_min  = 2.50,
  features   = array_remove(features, 'Spread από 1,45%'),
  rate_index = '3M',
  source_url = 'https://www.eurobank.gr/-/media/eurobank/rates/epitokia-daneiakon-proionton.pdf',
  source_doc_date = date '2026-07-27',
  verified_at = date '2026-09-28'
where bank_id = 'eurobank';

-- ── Alpha Bank ───────────────────────────────────────────────────────────
-- ΠΗΓΗ: https://www.alpha.gr/-/media/AlphaGr/pdf-files/diafora-sunodeutika-pdf/xrisima-eggrafa/oroi-sunallagon-epitokia-katatheseon-xorigiseon.pdf
-- και https://www.alpha.gr/el/idiotes/daneia/stegastika-daneia/stegastiko-daneio-alpha-proti-katoikia
-- Ημερομηνία εγγράφου 21/09/2026, τιμές για νέες αιτήσεις από 01/06/2026.
--   Κυμαινόμενο Euribor 3M + 1,80% έως 2,20%: ΣΩΣΤΟ, δεν αλλάζει.
--   Σταθερό Alpha Κατοικία: 3ε 2,90 · 5ε 3,50 · 10ε 3,90 · 15ε 4,20 · 20ε 4,30.
--   Alpha Πρώτη Κατοικία: 2,50 για 3 έτη.
--     fixed_3yr   '2.80-3.40'  → '2.50-2.90'
--     fixed_5yr   '2.80-3.40'  → '3.50'
--     fixed_10yr  '3.80-4.10'  → '3.90'
--     fixed_15yr  '3.80-4.10'  → '4.20'
--     fixed_20yr  '4.20'       → '4.30'
--     fixed_min   2.50         αμετάβλητο (το 3ετές της Πρώτης Κατοικίας)
update public.bank_rates set
  fixed_3yr  = '2.50-2.90',
  fixed_5yr  = '3.50',
  fixed_10yr = '3.90',
  fixed_15yr = '4.20',
  fixed_20yr = '4.30',
  fixed_min  = 2.50,
  rate_index = '3M',
  source_url = 'https://www.alpha.gr/-/media/AlphaGr/pdf-files/diafora-sunodeutika-pdf/xrisima-eggrafa/oroi-sunallagon-epitokia-katatheseon-xorigiseon.pdf',
  source_doc_date = date '2026-09-21',
  verified_at = date '2026-09-28'
where bank_id = 'alpha';

-- ── Optima Bank ──────────────────────────────────────────────────────────
-- ΠΗΓΗ: https://www.optimabank.gr/media/1kgfzcio/anx241_pinakas_epitokion_xorigitikon_proionton.pdf
-- Ημερομηνία εγγράφου 24/11/2025 (ANX241.12). Παλιό έγγραφο· γι' αυτό η
-- ημερομηνία του αποθηκεύεται και φαίνεται.
--   Κυμαινόμενο Euribor 3M + 2,00% έως 3,00%: ΣΩΣΤΟ, δεν αλλάζει.
--   Σταθερό: 3ετές δεν δημοσιεύεται · 5ε 3,50–4,00 · 10ε 3,90–4,40 ·
--   15ε 4,30–4,80 · 20ε 4,30–4,80.
--     fixed_3yr   '3.50-3.90'  → null (δεν δημοσιεύεται)
--     fixed_5yr   '3.50-3.90'  → '3.50-4.00'
--     fixed_10yr  '3.40-3.90'  → '3.90-4.40'
--     fixed_15yr  '3.40-3.90'  → '4.30-4.80'
--     fixed_20yr  '4.30-4.80'  αμετάβλητο
--     fixed_min   3.40         → 3.50
update public.bank_rates set
  fixed_3yr  = null,
  fixed_5yr  = '3.50-4.00',
  fixed_10yr = '3.90-4.40',
  fixed_15yr = '4.30-4.80',
  fixed_20yr = '4.30-4.80',
  fixed_min  = 3.50,
  rate_index = '3M',
  source_url = 'https://www.optimabank.gr/media/1kgfzcio/anx241_pinakas_epitokion_xorigitikon_proionton.pdf',
  source_doc_date = date '2025-11-24',
  verified_at = date '2026-09-28'
where bank_id = 'optima';

-- ── Τράπεζα Πειραιώς ─────────────────────────────────────────────────────
-- ΠΗΓΗ: https://www.piraeusbank.gr/el/support/epitokia-deltia-timwn/
-- Ημερομηνία εγγράφου 20/02/2026.
--   Σταθερό 3 έως 30 έτη από 2,40% έως 4,70%, κυμαινόμενο Euribor 1M + 1,40%
--   έως 2,45%, πράσινο 1M + 1,25% έως 2,30%. Τα περιθώρια και το ελάχιστο
--   σταθερό ΣΥΜΦΩΝΟΥΝ με τη βάση και δεν αλλάζουν.
--   Η σελίδα ΔΕΝ σπάει το σταθερό ανά διάρκεια: δίνει ένα εύρος για 3 έως 30
--   έτη. Τα ανά διάρκεια εύρη της βάσης δεν τα έγραφε η πηγή, οπότε κάθε
--   στήλη παίρνει το δημοσιευμένο εύρος των 3–30 ετών.
--     fixed_3yr   '2.40-3.60'  → '2.40-4.70'
--     fixed_5yr   '2.40-3.60'  → '2.40-4.70'
--     fixed_10yr  '3.80-4.50'  → '2.40-4.70'
--     fixed_15yr  '3.80-4.50'  → '2.40-4.70'
--     fixed_20yr  '4.50-4.70'  → '2.40-4.70'
--     rate_index  → '1M'
update public.bank_rates set
  fixed_3yr  = '2.40-4.70',
  fixed_5yr  = '2.40-4.70',
  fixed_10yr = '2.40-4.70',
  fixed_15yr = '2.40-4.70',
  fixed_20yr = '2.40-4.70',
  variable_spread_min = 1.40,
  variable_spread_max = 2.45,
  fixed_min  = 2.40,
  note       = 'Σταθερό 3 έως 30 ετών σε ενιαίο εύρος, όπως το δημοσιεύει η τράπεζα',
  rate_index = '1M',
  source_url = 'https://www.piraeusbank.gr/el/support/epitokia-deltia-timwn/',
  source_doc_date = date '2026-02-20',
  verified_at = date '2026-09-28'
where bank_id = 'piraeus';

-- ── Εθνική Τράπεζα ───────────────────────────────────────────────────────
-- ΠΗΓΗ: https://www.nbg.gr/el/idiwtes/daneia/stegastika-daneia
-- Η σελίδα δεν γράφει ημερομηνία τιμολογίου (ανάγνωση Grok 28/09/2026), οπότε
-- το source_doc_date μένει κενό.
--   ΕΣΤΙΑ Σταθερό: από 2,90% για 3/5/10/15/20/25/30 έτη.
--   ΕΣΤΙΑ Προνόμιο: Euribor 3M + από 1,60%.
--   ΕΣΤΙΑ Πράσινη: Euribor 3M + από 1,35% ή σταθερό από 2,80%.
--   «το Πρώτο μου Σπίτι»: σταθερό από 2,5%, αιτήσεις έως 31/12/2026.
--   Τα ανά διάρκεια εύρη της βάσης ΔΕΝ επιβεβαιώνονται από τη σελίδα: κάθε
--   διάρκεια γίνεται «από 2,90», χωρίς ανώτατο όριο.
--     fixed_3yr   '2.50-2.80'  → '2.90'
--     fixed_5yr   '2.50-2.80'  → '2.90'
--     fixed_10yr  '3.40-3.80'  → '2.90'
--     fixed_15yr  '3.40-3.80'  → '2.90'
--     fixed_20yr  '4.10-4.20'  → '2.90'
--     fixed_min   2.50         αμετάβλητο («το Πρώτο μου Σπίτι»)
--     variable_spread_min  1.50 → 1.60
--     variable_spread_max  2.30 → null (δεν δημοσιεύεται)
--   Τα χαρακτηριστικά «Ενεργειακή έκπτωση -0,25%» και «Τρίτεκνοι: +50%
--   επιδότηση» φεύγουν: το δεύτερο αφορούσε το «Σπίτι μου ΙΙ» που έκλεισε.
--   Μπαίνουν η ΕΣΤΙΑ Πράσινη και «το Πρώτο μου Σπίτι», από την ίδια σελίδα.
--   Ο πίνακας γράφεται ολόκληρος και όχι με προσθήκη, ώστε η δεύτερη εκτέλεση
--   να μη διπλασιάζει γραμμές.
update public.bank_rates set
  fixed_3yr  = '2.90',
  fixed_5yr  = '2.90',
  fixed_10yr = '2.90',
  fixed_15yr = '2.90',
  fixed_20yr = '2.90',
  fixed_min  = 2.50,
  variable_spread_min = 1.60,
  variable_spread_max = null,
  features   = array['Έως 90% της αξίας', 'Σταθερό 3 έως 30 έτη', 'Χωρίς έξοδα αίτησης',
                     'ΕΣΤΙΑ Πράσινη: περιθώριο από 1,35% ή σταθερό από 2,80%',
                     '«το Πρώτο μου Σπίτι»: σταθερό από 2,50%, αιτήσεις έως 31/12/2026'],
  rate_index = '3M',
  source_url = 'https://www.nbg.gr/el/idiwtes/daneia/stegastika-daneia',
  source_doc_date = null,
  verified_at = date '2026-09-28'
where bank_id = 'ethniki';

-- ── CrediaBank ───────────────────────────────────────────────────────────
-- ΚΑΜΙΑ ΕΠΙΣΗΜΗ ΠΗΓΗ δεν βρέθηκε (ops.handoffs a41bd5b2, «ΜΗ ΕΠΑΛΗΘΕΥΜΕΝΟ»).
-- Οι τιμές ΔΕΝ αλλάζουν. Το source_url έδειχνε τον συγκριτικό ιστότοπο και
-- σβήνεται· η σημείωση το λέει στην οθόνη. Το χαρακτηριστικό «Σπίτι μου ΙΙ»
-- φεύγει: το πρόγραμμα έκλεισε για νέες αιτήσεις στις 31/05/2026.
update public.bank_rates set
  features   = array_remove(features, 'Σπίτι μου ΙΙ'),
  note       = 'Μη επαληθευμένο από επίσημη πηγή της τράπεζας',
  source_url = null,
  source_doc_date = null
where bank_id = 'credia';
