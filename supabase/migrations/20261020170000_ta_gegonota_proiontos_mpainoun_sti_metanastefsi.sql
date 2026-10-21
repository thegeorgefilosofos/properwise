-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΑ ΓΕΓΟΝΟΤΑ ΠΡΟΪΟΝΤΟΣ ΜΠΑΙΝΟΥΝ ΣΤΗ ΜΕΤΑΝΑΣΤΕΥΣΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΟ ΚΕΝΟ (το βρήκε το #413). Ο πίνακας `public.product_events`, οι δύο πόρτες
-- του (`log_event`, `log_event_for`) και οι δύο όψεις του (`product_activation`,
-- `product_retention`) στήθηκαν στην παραγωγή από το SQL Editor, με το
-- scripts/db/product-events.sql. Καμία μετανάστευση δεν τα έφτιαχνε. Ενα
-- staging που ξαναχτίζεται ή ένα replay έμενε χωρίς αυτά: η `log_event` δεν
-- υπήρχε (το lib/analytics/events.ts έπαιρνε 404 από το PostgREST) και η
-- `metrics_weekly` του 20261020150000 σήκωνε «λείπει ο πίνακας».
--
-- ΑΠΟ ΠΟΥ ΒΓΗΚΕ ΚΑΘΕ ΓΡΑΜΜΗ. Από τον κατάλογο της παραγωγής (aromvduuxtcrzmwwvnej),
-- μόνο SELECT σε information_schema και pg_catalog, 20/10/2026, καμία γραμμή
-- δεδομένων:
--   · στήλες: id uuid not null default gen_random_uuid(), user_id uuid not null,
--     event text not null, props jsonb not null default '{}', created_at
--     timestamptz not null default now()·
--   · περιορισμοί: product_events_pkey (id), product_events_user_id_fkey →
--     auth.users(id) on delete cascade·
--   · ευρετήρια: product_events_user_time_idx (user_id, created_at desc),
--     product_events_event_time_idx (event, created_at desc),
--     product_events_signup_once_idx unique (user_id) where event = 'signed_up'·
--   · RLS ενεργό (όχι force), ΚΑΜΙΑ πολιτική· δικαιώματα μόνο postgres και
--     service_role, τίποτα σε anon και authenticated·
--   · log_event(text, jsonb): security definer, search_path public, pg_temp,
--     execute σε authenticated και service_role· log_event_for(uuid, text,
--     jsonb): security definer, execute μόνο σε service_role·
--   · όψεις product_activation και product_retention, ιδιοκτήτης postgres,
--     δικαιώματα μόνο postgres και service_role.
--
-- Η RESTRICTIVE ΠΟΛΙΤΙΚΗ mfa_ ΛΕΙΠΕΙ ΑΠΟ ΤΗΝ ΠΑΡΑΓΩΓΗ ΚΑΙ ΠΡΟΣΤΙΘΕΤΑΙ ΕΔΩ. Είναι
-- η ΜΟΝΗ αλλαγή που φέρνει αυτό το αρχείο στην παραγωγή· δεν αλλάζει
-- συμπεριφορά: ο πίνακας δεν έχει καμία permissive πολιτική ούτε δικαίωμα για
-- τον `authenticated`, οπότε είναι ήδη κλειστός (γι' αυτό το 20261003120000
-- άφηνε έξω τους πίνακες μόνο υπηρεσίας). Μπαίνει για να μην ανοίξει αύριο
-- μια permissive πολιτική τον πίνακα σε συνεδρία «aal1» με δηλωμένη συσκευή.
--
-- Η `log_event` ΜΕΝΕΙ ΧΩΡΙΣ ΠΥΛΗ, ΟΠΩΣ ΣΤΗΝ ΠΑΡΑΓΩΓΗ. Δεν διαβάζει τίποτα του
-- καλούντα· γράφει μία γραμμή μέτρησης στο όνομά του, όπως οι μετρητές
-- `bump_*`. Γράφεται ονομαστικά στο `mfa_open_functions` του
-- scripts/db/rls-probe.sql με τον λόγο της.
--
-- ΤΑ ΥΠΟΛΟΙΠΑ ΔΕΝ ΑΛΛΑΖΟΥΝ ΤΙΠΟΤΑ ΣΤΗΝ ΠΑΡΑΓΩΓΗ. Πίνακας και ευρετήρια με `if not exists`.
-- Οι συναρτήσεις και οι όψεις γράφονται ΜΟΝΟ αν λείπουν (`to_regprocedure`,
-- `to_regclass`): ένα `create or replace` θα ξανάγραφε τα σώματα της παραγωγής
-- (που έχουν CRLF από το SQL Editor) με άλλα bytes. Το `enable row level
-- security`, τα `revoke` και τα `grant` ξαναλένε ό,τι ισχύει ήδη. Ιδιοδύναμη:
-- ξανατρέχει χωρίς σφάλμα (scripts/db-replay.sh).
--
-- ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ. Το ξένο κλειδί κάνει cascade από το auth.users: η
-- διαγραφή του χρήστη παίρνει μαζί και τα γεγονότα του, όπως στην παραγωγή.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.product_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event       text not null,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists product_events_user_time_idx
  on public.product_events (user_id, created_at desc);
create index if not exists product_events_event_time_idx
  on public.product_events (event, created_at desc);
create unique index if not exists product_events_signup_once_idx
  on public.product_events (user_id)
  where event = 'signed_up';

alter table public.product_events enable row level security;
revoke all on public.product_events from anon, authenticated;
grant all on public.product_events to service_role;

drop policy if exists mfa_product_events on public.product_events;
create policy mfa_product_events on public.product_events as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- ── Η ΠΡΩΤΗ ΠΟΡΤΑ: ο χρήστης από το auth.uid(), ποτέ από παράμετρο ─────────
do $do$
begin
  if to_regprocedure('public.log_event(text, jsonb)') is null then
    execute $fn$
create function public.log_event(p_event text, p_props jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  -- Ανώνυμος καλών δεν καταγράφεται. Δεν είναι σφάλμα: η δημόσια επιφάνεια
  -- δεν μετριέται από εδώ και μια σιωπηλή επιστροφή δεν σπάει τίποτα.
  if v_user is null then
    return;
  end if;

  -- ΤΟ ΟΝΟΜΑ ΕΛΕΓΧΕΤΑΙ, ΓΙΑΤΙ ΑΛΛΙΩΣ Ο ΠΙΝΑΚΑΣ ΓΕΜΙΖΕΙ ΣΚΟΥΠΙΔΙΑ. Ενα
  -- τυπογραφικό λάθος σε κλήση («proprty_added») θα δημιουργούσε σιωπηλά νέο
  -- γεγονός και η μέτρηση θα έλεγε ψέματα προς τα κάτω για μήνες, χωρίς
  -- κανένα σφάλμα πουθενά. Πεζά, αριθμοί και κάτω παύλα, ώς 48 χαρακτήρες.
  if p_event !~ '^[a-z][a-z0-9_]{2,47}$' then
    raise exception 'άκυρο όνομα γεγονότος: %', p_event;
  end if;

  -- Το φορτίο μένει μικρό επίτηδες. Δεν είναι χώρος για δεδομένα του χρήστη:
  -- είναι για μετρήσιμα χαρακτηριστικά (πακέτο, πλήθος, πηγή).
  if pg_column_size(p_props) > 2048 then
    raise exception 'πολύ μεγάλο φορτίο γεγονότος';
  end if;

  insert into public.product_events (user_id, event, props)
  values (v_user, p_event, coalesce(p_props, '{}'::jsonb))
  on conflict do nothing;
end;
$$
$fn$;
  end if;
end
$do$;

revoke all on function public.log_event(text, jsonb) from public, anon;
grant execute on function public.log_event(text, jsonb) to authenticated, service_role;

-- ── Η ΔΕΥΤΕΡΗ ΠΟΡΤΑ: μόνο ο διακομιστής, με τον χρήστη ρητά ───────────────
do $do$
begin
  if to_regprocedure('public.log_event_for(uuid, text, jsonb)') is null then
    execute $fn$
create function public.log_event_for(p_user uuid, p_event text, p_props jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null then
    return;
  end if;
  if p_event !~ '^[a-z][a-z0-9_]{2,47}$' then
    raise exception 'άκυρο όνομα γεγονότος: %', p_event;
  end if;
  if pg_column_size(p_props) > 2048 then
    raise exception 'πολύ μεγάλο φορτίο γεγονότος';
  end if;
  insert into public.product_events (user_id, event, props)
  values (p_user, p_event, coalesce(p_props, '{}'::jsonb))
  on conflict do nothing;
end;
$$
$fn$;
  end if;
end
$do$;

revoke all on function public.log_event_for(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_event_for(uuid, text, jsonb) to service_role;

-- ── ΟΙ ΔΥΟ ΟΨΕΙΣ: χωνί και διατήρηση, μόνο για υπηρεσία και SQL Editor ────
do $do$
begin
  if to_regclass('public.product_activation') is null then
    execute $v$
create view public.product_activation as
with first_seen as (
  select user_id, min(created_at) as joined_at
  from public.product_events
  group by user_id
)
select
  date_trunc('week', f.joined_at)::date                                     as εβδομάδα,
  count(distinct f.user_id)                                                 as χρήστες,
  count(distinct f.user_id) filter (where e.event = 'property_added')        as με_ακίνητο,
  count(distinct f.user_id) filter (where e.event = 'second_property_added') as με_δεύτερο,
  count(distinct f.user_id) filter (where e.event = 'expense_added')         as με_δαπάνη,
  count(distinct f.user_id) filter (where e.event = 'report_generated')      as με_αναφορά,
  count(distinct f.user_id) filter (where e.event = 'trial_started')         as σε_δοκιμή,
  count(distinct f.user_id) filter (where e.event = 'subscription_started')  as πλήρωσαν
from first_seen f
left join public.product_events e on e.user_id = f.user_id
group by 1
order by 1 desc
$v$;
  end if;
  if to_regclass('public.product_retention') is null then
    execute $v$
create view public.product_retention as
select
  user_id                                                   as χρήστης,
  min(created_at)::date                                     as πρώτη_μέρα,
  max(created_at)::date                                     as τελευταία_μέρα,
  count(distinct created_at::date)                          as ενεργές_μέρες,
  (max(created_at)::date - min(created_at)::date)           as διάρκεια_ημέρες,
  count(*)                                                  as γεγονότα
from public.product_events
group by user_id
order by τελευταία_μέρα desc
$v$;
  end if;
end
$do$;

revoke all on public.product_activation from anon, authenticated;
revoke all on public.product_retention from anon, authenticated;
grant all on public.product_activation to service_role;
grant all on public.product_retention to service_role;
