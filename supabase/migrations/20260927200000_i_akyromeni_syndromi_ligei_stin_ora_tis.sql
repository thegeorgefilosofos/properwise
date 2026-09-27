-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΑΚΥΡΩΜΕΝΗ ΣΥΝΔΡΟΜΗ ΛΗΓΕΙ ΣΤΗΝ ΩΡΑ ΤΗΣ, ΟΧΙ ΟΤΑΝ ΦΤΑΣΕΙ ΓΕΓΟΝΟΣ
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ: έλεγχος χρέωσης της 27.09.2026 πριν από το ζωντανό κλειδί του Creem,
-- εύρημα D1.
--
-- ΤΟ ΣΦΑΛΜΑ. Το επίπεδο πρόσβασης διάβαζε ΜΟΝΟ τη στήλη `plan`. Η στήλη
-- γράφεται από τον webhook τη στιγμή που φτάνει ένα γεγονός και κανείς δεν την
-- ξανακοιτά. Μια συνδρομή «ακυρωμένη με ισχύ ώς τη λήξη» γράφει `plan` =
-- το πακέτο που πληρώθηκε και `mor_ends_at` = το τέλος της περιόδου. Αν το
-- τελευταίο γεγονός στη λήξη δεν φτάσει ποτέ (εξαντλημένες επαναλήψεις, 5xx,
-- ή απλώς ο πάροχος δεν το στέλνει), το πακέτο μένει ανοιχτό για πάντα, ενώ η
-- κάρτα της οθόνης γράφει «έληξε».
--
-- Η ΔΙΟΡΘΩΣΗ. Η `user_plan_rank` κρίνει την ίδια την ημερομηνία: κατάσταση
-- `cancelled` με `mor_ends_at` που πέρασε μετρά ως `free`. Το ίδιο κάνει η
-- `livePlan` στο lib/billing/entitlements.ts για την οθόνη. Κανένα γεγονός δεν
-- χρειάζεται να φτάσει για να κλείσει μια πρόσβαση που τελείωσε.
--
-- ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Ολο το υπόλοιπο σώμα είναι αυτό της
-- 20260820230000_i_ypovathmisi_perimenei_tin_ananeosi.sql. Η κράτηση
-- υποβάθμισης κρίνεται πλέον από το ίδιο `v_plan`, οπότε ακολουθεί χωρίς
-- δεύτερη συνθήκη.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.user_plan_rank(p_uid uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_plan text; v_comp_plan text; v_comp_until timestamptz;
  v_hold_plan text; v_hold_until timestamptz;
  v_status text; v_ends timestamptz;
  v_trial_used timestamptz; v_created timestamptz; v_rank int := 0;
begin
  select plan, comp_plan, comp_until, trial_used_at, hold_plan, hold_until,
         subscription_status, mor_ends_at
    into v_plan, v_comp_plan, v_comp_until, v_trial_used, v_hold_plan, v_hold_until,
         v_status, v_ends
    from billing_profiles where user_id = p_uid;

  -- ΑΚΥΡΩΜΕΝΗ ΚΑΙ ΛΗΓΜΕΝΗ: ΔΕΝ ΔΙΝΕΙ ΤΙΠΟΤΑ, ΟΣΟ ΚΙ ΑΝ ΓΡΑΦΕΙ Η ΣΤΗΛΗ.
  if v_status = 'cancelled' and v_ends is not null and v_ends <= now() then
    v_plan := 'free';
  end if;

  v_rank := greatest(v_rank, public.plan_rank(v_plan));

  -- Δωρεάν μήνες (π.χ. από σύσταση φίλου).
  if v_comp_until is not null and v_comp_until > now() then
    v_rank := greatest(v_rank, public.plan_rank(v_comp_plan));
  end if;

  -- ΥΠΟΒΑΘΜΙΣΗ ΠΟΥ ΠΕΡΙΜΕΝΕΙ ΤΗΝ ΑΝΑΝΕΩΣΗ. Μόνο όσο η συνδρομή ζει.
  if coalesce(v_plan, 'free') <> 'free'
     and v_hold_until is not null and v_hold_until > now() then
    v_rank := greatest(v_rank, public.plan_rank(v_hold_plan));
  end if;

  -- ΤΟΠΙΚΗ ΔΟΚΙΜΗ, ΜΟΝΟ ΓΙΑ ΟΠΟΙΟΝ ΔΕΝ ΠΗΡΕ ΠΟΤΕ ΔΟΚΙΜΗ ΑΠΟ ΤΟΝ ΕΜΠΟΡΟ.
  if v_trial_used is null then
    select created_at into v_created from auth.users where id = p_uid;
    if v_created is not null and v_created > now() - (public.trial_days() || ' days')::interval then
      v_rank := greatest(v_rank, public.plan_rank('owner'));
    end if;
  end if;

  -- Συνεργάτης → πάντα «Επαγγελματίας».
  if exists (select 1 from referral_partners rp where rp.user_id = p_uid) then
    v_rank := greatest(v_rank, public.plan_rank('agency'));
  end if;

  return v_rank;
end;
$$;

comment on function public.user_plan_rank(uuid) is
  'Το επίπεδο πρόσβασης ενός λογαριασμού. Ακυρωμένη συνδρομή με mor_ends_at που πέρασε μετρά ως free, χωρίς να περιμένει γεγονός. Η τοπική δοκιμή ισχύει ΜΟΝΟ όσο δεν έχει σφραγιστεί το trial_used_at. Η κράτηση υποβάθμισης ανεβάζει μόνο λογαριασμό με ζωντανή συνδρομή.';
