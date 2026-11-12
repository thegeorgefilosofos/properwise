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
--   · `mor_last_transaction_id`: η τελευταία πληρωμένη συναλλαγή της
--     συνδρομής, από τα γεγονότα `subscription.*`. Μόνο αυτήν μπορεί να κλείσει
--     μια επιστροφή: η επιστροφή του πρώτου μήνα αφού πληρώθηκε ο δεύτερος
--     δεν κόβει πελάτη που πληρώνει (έλεγχος του PR 558, M1).
--   · `mor_revoked_ref`: η επιστροφή ή η αμφισβήτηση που έκλεισε την
--     πρόσβαση. Μένει και μετά από νέα χρέωση, ώστε η ίδια επιστροφή που
--     ξαναστέλνεται να μην ξανακόψει (L4).
--   · `public.past_due_grace_days()`: οι ημέρες χάριτος, ίδιες με το
--     `PAST_DUE_GRACE_DAYS` του lib/billing/subscription.ts (επιλογή
--     προϊόντος, εκκρεμεί έγκριση ιδιοκτήτη). Το db-replay ελέγχει ότι οι δύο
--     αριθμοί συμφωνούν.
--   · `public.revoke_mor_access(...)`: η ανάκληση σε ΕΝΑ υπό όρους UPDATE, μόνο
--     για τον ρόλο υπηρεσίας (L3).
--   · σκανδάλη `keep_mor_revocation`: ταυτόχρονο γεγονός συνδρομής από τον
--     webhook δεν αναιρεί την ανάκληση· μόνο νέα συνδρομή ή νέα πληρωμένη
--     συναλλαγή τη σηκώνει (L3).
--
-- ΟΙ ΣΤΗΛΕΣ ΑΝΗΚΟΥΝ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ. Η `lock_billing_plan` τις
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
alter table public.billing_profiles add column if not exists mor_revoked_ref text;
alter table public.billing_profiles add column if not exists mor_last_transaction_id text;

alter table public.billing_profiles drop constraint if exists billing_profiles_mor_revoked_reason_check;
alter table public.billing_profiles add constraint billing_profiles_mor_revoked_reason_check
  check (mor_revoked_reason is null or mor_revoked_reason in ('refund', 'dispute'));

comment on column public.billing_profiles.mor_past_due_at is
  'Η πρώτη αποτυχημένη χρέωση της τρέχουσας συνδρομής (past_due). Η πρόσβαση κρατά past_due_grace_days() ημέρες από εδώ. Γράφεται μόνο από τον webhook.';
comment on column public.billing_profiles.mor_revoked_at is
  'Πότε επιστροφή χρημάτων ή αμφισβήτηση έκλεισε την πρόσβαση της καταγεγραμμένης συνδρομής. Γράφεται μόνο από τον webhook.';
comment on column public.billing_profiles.mor_revoked_reason is
  'Γιατί έκλεισε η πρόσβαση: refund ή dispute. Γράφεται μόνο από τον webhook.';
comment on column public.billing_profiles.mor_revoked_ref is
  'Η επιστροφή ή η αμφισβήτηση που έκλεισε την πρόσβαση. Μένει και μετά από νέα χρέωση, ώστε η ίδια να μη μετρήσει δεύτερη φορά.';
comment on column public.billing_profiles.mor_last_transaction_id is
  'Η τελευταία πληρωμένη συναλλαγή της συνδρομής στον έμπορο. Μόνο επιστροφή ή αμφισβήτηση αυτής κλείνει πρόσβαση.';

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
      new.mor_revoked_ref := null;
      new.mor_last_transaction_id := null;
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
      new.mor_revoked_ref    := old.mor_revoked_ref;
      new.mor_last_transaction_id := old.mor_last_transaction_id;
    end if;
  end if;
  return new;
end;
$$;

-- ── Η ΑΝΑΚΛΗΣΗ ΣΕ ΕΝΑ ΒΗΜΑ ─────────────────────────────────────────────────
-- Ελέγχει και γράφει με ΕΝΑ υπό όρους UPDATE: συνδρομή, τελευταία πληρωμένη
-- συναλλαγή, όχι ήδη κλειστή, όχι η ίδια αναφορά. Καμία ανάγνωση που να
-- παλιώνει ανάμεσα. Όταν δεν γράφει, λέει γιατί: `already`, `not_latest`,
-- `unmatched`. Το `mor_event_at` δεν αγγίζεται: η επιστροφή δεν είναι
-- γεγονός συνδρομής.
create or replace function public.revoke_mor_access(
  p_subscription text, p_transaction text, p_reference text, p_reason text, p_at timestamptz
) returns jsonb
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_user uuid;
  v_row record;
begin
  if p_reason is null or p_reason not in ('refund', 'dispute') then
    raise exception 'bad_reason' using errcode = '22023';
  end if;
  update public.billing_profiles
     set plan = 'free', subscription_status = 'expired',
         mor_renews_at = null, mor_ends_at = p_at, mor_past_due_at = null,
         hold_plan = null, hold_until = null,
         mor_revoked_at = p_at, mor_revoked_reason = p_reason, mor_revoked_ref = p_reference
   where mor_subscription_id = p_subscription
     and mor_last_transaction_id = p_transaction
     and mor_revoked_at is null
     and mor_revoked_ref is distinct from p_reference
  returning user_id into v_user;
  if v_user is not null then
    return jsonb_build_object('outcome', 'revoked', 'user_id', v_user);
  end if;
  select mor_revoked_at, mor_revoked_ref into v_row
    from public.billing_profiles where mor_subscription_id = p_subscription limit 1;
  if not found then return jsonb_build_object('outcome', 'unmatched'); end if;
  if v_row.mor_revoked_at is not null or v_row.mor_revoked_ref is not distinct from p_reference then
    return jsonb_build_object('outcome', 'already');
  end if;
  return jsonb_build_object('outcome', 'not_latest');
end $$;

revoke all on function public.revoke_mor_access(text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.revoke_mor_access(text, text, text, text, timestamptz) to service_role;

comment on function public.revoke_mor_access(text, text, text, text, timestamptz) is
  'Κλείνει την πρόσβαση μετά από ολόκληρη επιστροφή ή αμφισβήτηση της ΤΕΛΕΥΤΑΙΑΣ πληρωμένης συναλλαγής, σε ένα υπό όρους UPDATE. Μόνο ο webhook (service_role).';

-- ── ΤΑΥΤΟΧΡΟΝΟ ΓΕΓΟΝΟΣ ΣΥΝΔΡΟΜΗΣ ΔΕΝ ΑΝΑΙΡΕΙ ΤΗΝ ΑΝΑΚΛΗΣΗ ──────────────────
-- Ο webhook διαβάζει την καταγεγραμμένη συνδρομή και μετά γράφει. Ενα
-- `subscription.update` που διάβασε ΠΡΙΝ από την ανάκληση θα έγραφε μετά από
-- αυτήν `plan` και `mor_revoked_at = null`. Η σκανδάλη κρατά την ανάκληση όσο
-- η γραμμή μένει στην ίδια συνδρομή ΚΑΙ στην ίδια τελευταία συναλλαγή. Μόνο
-- για τον ρόλο υπηρεσίας: ο πελάτης φυλάγεται ήδη από τη `lock_billing_plan`
-- και η υποστήριξη (postgres) λύνει με το χέρι όταν χρειαστεί.
create or replace function public.keep_mor_revocation() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if current_user = 'service_role'
     and old.mor_revoked_at is not null
     and new.mor_subscription_id is not distinct from old.mor_subscription_id
     and new.mor_last_transaction_id is not distinct from old.mor_last_transaction_id then
    new.plan := 'free';
    new.subscription_status := old.subscription_status;
    new.mor_ends_at := old.mor_ends_at;
    new.mor_renews_at := old.mor_renews_at;
    new.mor_past_due_at := old.mor_past_due_at;
    new.hold_plan := old.hold_plan;
    new.hold_until := old.hold_until;
    new.mor_revoked_at := old.mor_revoked_at;
    new.mor_revoked_reason := old.mor_revoked_reason;
    new.mor_revoked_ref := old.mor_revoked_ref;
  end if;
  return new;
end $$;

revoke all on function public.keep_mor_revocation() from public, anon, authenticated;

drop trigger if exists billing_profiles_keep_mor_revocation on public.billing_profiles;
create trigger billing_profiles_keep_mor_revocation
  before update on public.billing_profiles
  for each row execute function public.keep_mor_revocation();

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
