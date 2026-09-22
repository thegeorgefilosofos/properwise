-- ═══════════════════════════════════════════════════════════════════════════
-- ΚΑΘΑΡΙΣΜΑ ΔΙΠΛΩΝ INDEX
-- ─────────────────────────────────────────────────────────────────────────
-- Ο performance advisor της Supabase βρήκε τέσσερα ζευγάρια ΠΑΝΟΜΟΙΟΤΥΠΩΝ index
-- (ίδιος πίνακας, ίδια στήλη, ίδιος τύπος). Ενα διπλό index δεν βοηθά κανένα
-- ερώτημα — απλώς κοστίζει χώρο και επιβραδύνει ΚΑΘΕ εγγραφή, γιατί η βάση
-- συντηρεί δύο δέντρα εκεί που αρκεί ένα.
--
-- ΠΟΙΟ ΚΡΑΤΑΜΕ. Σε κάθε ζευγάρι κρατάμε αυτό που ΔΗΜΙΟΥΡΓΕΙ ρητά μια migration
-- (idx_airbnb_bookings_property, idx_expenses_contact, idx_rent_payments_tenant,
-- idx_tenant_comm_log_tenant) και ρίχνουμε το δίδυμό του. Τα τρία με κατάληξη
-- `_id` δεν τα φτιάχνει καμία migration — ήταν drift στην παραγωγή· η πτώση τους
-- ευθυγραμμίζει ξανά τη βάση με τα αρχεία. Το `airbnb_bookings_property_idx` το
-- έφτιαξε η 20260814090000 ως δεύτερο, πανομοιότυπο με το προϋπάρχον.
--
-- `IF EXISTS`: σε καθαρή βάση (staging, χτισμένη μόνο από migrations) τα `_id`
-- δεν υπάρχουν, οπότε η εντολή είναι αβλαβές no-op· στην παραγωγή ρίχνει το
-- διπλό. Καμία απώλεια κάλυψης: το δίδυμο index μένει σε κάθε περίπτωση.
-- ═══════════════════════════════════════════════════════════════════════════

drop index if exists public.airbnb_bookings_property_idx;   -- μένει: idx_airbnb_bookings_property
drop index if exists public.idx_expenses_contact_id;        -- μένει: idx_expenses_contact
drop index if exists public.idx_rent_payments_tenant_id;    -- μένει: idx_rent_payments_tenant
drop index if exists public.idx_tenant_comm_log_tenant_id;  -- μένει: idx_tenant_comm_log_tenant
