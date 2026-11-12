-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΑΠΟΤΥΧΗΜΕΝΗ ΠΛΗΡΩΜΗ ΕΧΕΙ ΟΡΙΟ ΚΑΙ Η ΕΠΙΣΤΡΟΦΗ ΧΡΗΜΑΤΩΝ ΚΛΕΙΝΕΙ ΤΗΝ ΠΡΟΣΒΑΣΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ: έλεγχος ετοιμότητας πληρωμών της 12/11/2026 πριν ανοίξει το ταμείο
-- του Creem, «Λείπει (κώδικας)» 1 και 2. Δεν αλλάζει καμία τιμή, κανένας
-- φόρος, καμία πολιτική RLS.
--
-- ΤΑ ΔΥΟ ΚΕΝΑ.
--   1. Η κατάσταση `past_due` έδινε πρόσβαση χωρίς όριο χρόνου (η
--      `user_plan_rank` διάβαζε μόνο τη στήλη `plan`). Αν ο έμπορος αργούσε ή
--      δεν έστελνε ποτέ «unpaid», ο λογαριασμός κρατούσε το πακέτο για πάντα.
--   2. Η επιστροφή χρημάτων και η αμφισβήτηση έστελναν μόνο email· ο πελάτης
--      που πήρε πίσω τα χρήματά του κρατούσε το πακέτο ώσπου να ακυρώσει κάποιος
--      με το χέρι.
--
-- ΤΙ ΠΡΟΣΤΙΘΕΤΑΙ.
--   · `mor_past_due_at`: η ΠΡΩΤΗ αποτυχημένη χρέωση της τρέχουσας συνδρομής.
--     Τη γράφει ο webhook (lib/billing/morWebhook.ts) και τη σβήνει μόλις
--     περάσει πληρωμή.
--   · `mor_revoked_at`, `mor_revoked_reason`: πότε και γιατί (refund/dispute)
--     έκλεισε η πρόσβαση της καταγεγραμμένης συνδρομής. Ο webhook γράφει
--     επιπλέον `plan = 'free'` και `subscription_status = 'expired'`, οπότε η
--     `user_plan_rank` δεν χρειάζεται δεύτερη συνθήκη γι' αυτό.
--   · `public.past_due_grace_days()`: οι ημέρες χάριτος, ίδιες με το
--     `PAST_DUE_GRACE_DAYS` του lib/billing/subscription.ts (επιλογή
--     προϊόντος). Το db-replay ελέγχει ότι οι δύο αριθμοί συμφωνούν.
--
-- ΟΙ ΤΡΕΙΣ ΣΤΗΛΕΣ ΑΝΗΚΟΥΝ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ. Η `lock_billing_plan` τις
-- ξαναγράφει από την παλιά τιμή όταν τις στέλνει ο πελάτης, όπως όλες τις
-- `mor_*` (20261108153700). Αλλιώς ένας πελάτης σε καθυστέρηση θα μηδένιζε
-- μόνος του το ρολόι της χάρης.
--
-- ΞΑΝΑΤΡΕΧΕΙ ΧΩΡΙΣ ΣΦΑΛΜΑ: `add column if not exists`, `drop constraint if
-- exists` πριν από το `add constraint`, `create or replace` για τις συναρτήσεις.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.billing_profiles add column if not exists mor_past_due_at timestamptz;
alter table public.billing_profiles add column if not exists mor_revoked_at timestamptz;
alter table public.billing_profiles add column if not exists mor_revoked_reason text;

alter table public.billing_profiles drop constraint if exists billing_profiles_mor_revoked_reason_check;
alter table public.billing_profiles add constraint billing_profiles_mor_revoked_reason_check
  check (mor_revoked_reason is null or mor_revoked_reason in ('refund', 'dispute'));

comment on column public.billing_profiles.mor_past_due_at is
  'Η πρώτη αποτυχημένη χρέωση της τρέχουσας συνδρομής (past_due). Η πρόσβαση κρατά past_due_grace_days() ημέρες από εδώ. Γράφεται μόνο από τον webhook.';
comment on column public.billing_profiles.mor_revoked_at is
  'Πότε επιστροφή χρημάτων ή αμφισβήτηση έκλεισε την πρόσβαση της καταγεγραμμένης συνδρομής. Γράφεται μόνο από τον webhook.';
comment on column public.billing_profiles.mor_revoked_reason is
  'Γιατί έκλεισε η πρόσβαση: refund ή dispute. Γράφεται μόνο από τον webhook.';

create or replace function public.past_due_grace_days()
returns int language sql immutable
set search_path to 'public'
as $$ select 7 $$;

comment on function public.past_due_grace_days() is
  'Οι ημέρες χάριτος μετά την πρώτη αποτυχημένη χρέωση. Επιλογή προϊόντος· το db-replay επιβεβαιώνει ότι συμφωνούν με το PAST_DUE_GRACE_DAYS του lib/billing/subscription.ts.';

-- ── ΟΙ ΝΕΕΣ ΣΤΗΛΕΣ ΣΤΗ ΣΚΑΝΔΑΛΗ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ─────────────────────────────
-- Ολόκληρη η σκανδάλη της 20261108153700, γιατί η `create or replace` δεν
-- δέχεται προσθήκη γραμμής. Οι τρεις νέες γραμμές στο τέλος κάθε σκέλους.
create or replace function public.lock_billing_plan() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan := 'free';
      new.comp_plan := null;
      new.comp_until := null;
      new.comp_months_granted := 0;
      new.comp_started_at := null;
      new.extra_properties := 0;
      new.bonus_properties := 0;
      new.bonus_properties_until := null;
      new.subscription_status := null;
      new.mor_customer_id := null;
      new.mor_subscription_id := null;
      new.mor_variant_id := null;
      new.mor_renews_at := null;
      new.mor_ends_at := null;
      new.mor_event_at := null;
      new.trial_used_at := null;
      new.tester_since := null;
      new.hold_plan := null;
      new.hold_until := null;
      new.billing_cycle := 'monthly';
      new.lapsed_at := null;
      new.mor_past_due_at := null;
      new.mor_revoked_at := null;
      new.mor_revoked_reason := null;
    else
      if new.plan is distinct from old.plan then new.plan := old.plan; end if;
      new.comp_plan          := old.comp_plan;
      new.comp_until         := old.comp_until;
      new.comp_months_granted := old.comp_months_granted;
      new.comp_started_at    := old.comp_started_at;
      new.extra_properties   := old.extra_properties;
      new.bonus_properties   := old.bonus_properties;
      new.bonus_properties_until := old.bonus_properties_until;
      new.subscription_status := old.subscription_status;
      new.mor_customer_id    := old.mor_customer_id;
      new.mor_subscription_id := old.mor_subscription_id;
      new.mor_variant_id     := old.mor_variant_id;
      new.mor_renews_at      := old.mor_renews_at;
      new.mor_ends_at        := old.mor_ends_at;
      new.mor_event_at       := old.mor_event_at;
      new.trial_used_at      := old.trial_used_at;
      new.tester_since       := old.tester_since;
      new.hold_plan          := old.hold_plan;
      new.hold_until         := old.hold_until;
      new.billing_cycle      := old.billing_cycle;
      new.lapsed_at          := old.lapsed_at;
      new.mor_past_due_at    := old.mor_past_due_at;
      new.mor_revoked_at     := old.mor_revoked_at;
      new.mor_revoked_reason := old.mor_revoked_reason;
    end if;
  end if;
  return new;
end;
$$;

-- ── ΤΟ ΕΠΙΠΕΔΟ ΠΡΟΣΒΑΣΗΣ ΚΡΙΝΕΙ ΚΑΙ ΤΗ ΧΑΡΗ ───────────────────────────────
-- Ολο το υπόλοιπο σώμα είναι αυτό της
-- 20260927200000_i_akyromeni_syndromi_ligei_stin_ora_tis.sql. Προστίθεται
-- μόνο το μπλοκ του `past_due`: ίδιος κανόνας με τη `livePlan` και την
-- `isEntitled` της εφαρμογής, χωρίς να περιμένει γεγονός. Χωρίς ώρα πρώτης
-- αποτυχίας (γραμμή παλαιότερη από τη στήλη) η χάρη δεν λήγει: δεν
-- εφευρίσκουμε ημερομηνία για να κόψουμε πρόσβαση.
create or replace function public.user_plan_rank(p_uid uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_plan text; v_comp_plan text; v_comp_until timestamptz;
  v_hold_plan text; v_hold_until timestamptz;
  v_status text; v_ends timestamptz; v_past_due timestamptz;
  v_trial_used timestamptz; v_created timestamptz; v_rank int := 0;
begin
  select plan, comp_plan, comp_until, trial_used_at, hold_plan, hold_until,
         subscription_status, mor_ends_at, mor_past_due_at
    into v_plan, v_comp_plan, v_comp_until, v_trial_used, v_hold_plan, v_hold_until,
         v_status, v_ends, v_past_due
    from billing_profiles where user_id = p_uid;

  -- ΑΚΥΡΩΜΕΝΗ ΚΑΙ ΛΗΓΜΕΝΗ: ΔΕΝ ΔΙΝΕΙ ΤΙΠΟΤΑ, ΟΣΟ ΚΙ ΑΝ ΓΡΑΦΕΙ Η ΣΤΗΛΗ.
  if v_status = 'cancelled' and v_ends is not null and v_ends <= now() then
    v_plan := 'free';
  end if;

  -- ΑΠΟΤΥΧΗΜΕΝΗ ΠΛΗΡΩΜΗ ΠΕΡΑ ΑΠΟ ΤΗ ΧΑΡΗ: ΟΥΤΕ ΑΥΤΗ ΔΙΝΕΙ ΤΙΠΟΤΑ.
  if v_status = 'past_due' and v_past_due is not null
     and v_past_due + make_interval(days => public.past_due_grace_days()) <= now() then
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
  'Το επίπεδο πρόσβασης ενός λογαριασμού. Ακυρωμένη συνδρομή με mor_ends_at που πέρασε και past_due με mor_past_due_at παλαιότερο από past_due_grace_days() μετρούν ως free, χωρίς να περιμένουν γεγονός. Η τοπική δοκιμή ισχύει ΜΟΝΟ όσο δεν έχει σφραγιστεί το trial_used_at. Η κράτηση υποβάθμισης ανεβάζει μόνο λογαριασμό με ζωντανή συνδρομή.';
