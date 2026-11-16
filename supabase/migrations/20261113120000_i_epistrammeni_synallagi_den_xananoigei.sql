-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΣΥΝΑΛΛΑΓΗ ΠΟΥ ΕΠΙΣΤΡΑΦΗΚΕ ΔΕΝ ΞΑΝΑΝΟΙΓΕΙ ΠΡΟΣΒΑΣΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΠΗΓΗ: έλεγχος του PR 558, γύρος 3, εύρημα LOW «τίποτα δεν θυμάται ότι το
-- `mor_last_transaction_id` επιστράφηκε». Δεν αλλάζει καμία τιμή, κανένας
-- φόρος, καμία πολιτική RLS, ούτε οι ημέρες χάριτος.
--
-- ΤΟ ΚΕΝΟ. Η σκανδάλη `keep_mor_revocation` (20261112190000) κρατά την
-- ανάκληση μόνο όσο υπάρχει `mor_revoked_at`. Δύο δρόμοι τη σβήνουν χωρίς νέα
-- πληρωμή:
--   · νεότερη συνδρομή που γίνεται δεκτή από το `created_at` της
--     (lib/billing/morWebhook.ts)·
--   · το SQL της υποστήριξης στο docs/ops/creem-vercel-odigos.md, Ζ4.4.
-- Από εκεί και πέρα ένα `subscription.update` «active» της συνδρομής που
-- επιστράφηκε, με την ίδια επιστραμμένη συναλλαγή, ξανάνοιγε το πακέτο.
--
-- ΤΙ ΠΡΟΣΤΙΘΕΤΑΙ.
--   · `mor_revoked_tx`: η συναλλαγή που έκλεισε η τελευταία ανάκληση. Τη
--     γράφει μόνο η `revoke_mor_access` και ΔΕΝ τη σβήνει κανείς: ούτε νέα
--     πληρωμή ούτε νέα συνδρομή ούτε η υποστήριξη. Ο webhook αρνείται
--     πρόσβαση σε κάθε γεγονός που φέρνει αυτήν ως τελευταία πληρωμένη.
--   · η `lock_billing_plan` κλειδώνει και αυτήν: ο πελάτης που θα την
--     άδειαζε θα ξανάνοιγε μόνος του το πακέτο που επιστράφηκε.
--
-- ΟΙ ΔΥΟ ΣΥΝΑΡΤΗΣΕΙΣ ΕΙΝΑΙ ΟΙ ΤΗΣ 20261112190000, με μία γραμμή η καθεμία.
-- Ιδια δικαιώματα, ίδιο search_path.
--
-- ΞΑΝΑΤΡΕΧΕΙ ΧΩΡΙΣ ΣΦΑΛΜΑ: `add column if not exists`, `create or replace`.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.billing_profiles add column if not exists mor_revoked_tx text;

comment on column public.billing_profiles.mor_revoked_tx is
  'Η συναλλαγή που επιστράφηκε ή αμφισβητήθηκε και έκλεισε την πρόσβαση. Μένει και όταν σβήσει το mor_revoked_at, ώστε γεγονός με αυτήν ως τελευταία πληρωμένη να μην ξανανοίγει το πακέτο. Γράφεται μόνο από τη revoke_mor_access.';

-- ── Η ΝΕΑ ΣΤΗΛΗ ΣΤΗ ΣΚΑΝΔΑΛΗ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ ───────────────────────────────
-- Ολόκληρη η σκανδάλη της 20261112190000· μία νέα γραμμή στο τέλος κάθε σκέλους.
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
      new.mor_revoked_tx := null;
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
      new.mor_revoked_tx     := old.mor_revoked_tx;
    end if;
  end if;
  return new;
end;
$$;

-- ── Η ΑΝΑΚΛΗΣΗ ΘΥΜΑΤΑΙ ΤΗ ΣΥΝΑΛΛΑΓΗ ────────────────────────────────────────
-- Ιδιο σώμα με την 20261112190000· το UPDATE γράφει και `mor_revoked_tx`.
-- Η συνθήκη και οι απαντήσεις δεν αλλάζουν.
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
         mor_revoked_at = p_at, mor_revoked_reason = p_reason, mor_revoked_ref = p_reference,
         mor_revoked_tx = p_transaction
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
  if v_row.mor_revoked_ref is not distinct from p_reference then
    return jsonb_build_object('outcome', 'already_same_ref');
  end if;
  if v_row.mor_revoked_at is not null then
    return jsonb_build_object('outcome', 'already');
  end if;
  return jsonb_build_object('outcome', 'not_latest');
end $$;

revoke all on function public.revoke_mor_access(text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.revoke_mor_access(text, text, text, text, timestamptz) to service_role;

comment on function public.revoke_mor_access(text, text, text, text, timestamptz) is
  'Κλείνει την πρόσβαση μετά από ολόκληρη επιστροφή ή αμφισβήτηση της ΤΕΛΕΥΤΑΙΑΣ πληρωμένης συναλλαγής με ένα υπό όρους UPDATE και κρατά τη συναλλαγή στο mor_revoked_tx. Μόνο ο webhook (service_role).';
