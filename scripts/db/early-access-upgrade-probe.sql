-- ═══════════════════════════════════════════════════════════════════════════
--  Η ΜΕΤΑΒΑΣΗ 20261110134000 ΠΑΝΩ ΣΕ ΒΑΣΗ ΜΕ ΤΟ ΠΡΩΤΟ ΤΗΣ ΣΧΕΔΙΟ
-- ─────────────────────────────────────────────────────────────────────────
--  ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (10/11/2026). Το staging πήρε το πρώτο σχέδιο του
--  `support_inbox` από την ώθηση του κλαδιού. Η επόμενη ώθηση έσκασε με
--  «column "kept_for" does not exist»: το `create table if not exists` δεν
--  πρόσθετε στήλες. Εδώ στήνεται το πρώτο σχέδιο (πίνακας, κύματα, παλιές
--  συναρτήσεις) και ξανατρέχει η μετάβαση από πάνω. Σε συναλλαγή που
--  αναιρείται πάντα.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP 1
reset role;
begin;
drop table public.support_inbox cascade;
create table public.support_inbox (
  id uuid primary key default gen_random_uuid(),
  provider_id text unique,
  from_email text not null,
  subject text,
  kind text not null default 'support',
  plan_rank integer not null default 0,
  priority boolean not null default false,
  forwarded boolean not null default false,
  received_at timestamptz not null default now()
);
insert into public.support_inbox(provider_id, from_email) values ('em_old_shape', 'x@probe.test');
insert into public.support_inbox(provider_id, from_email, forwarded) values ('em_old_sent', 'y@probe.test', true);
drop table public.release_waves;
create table public.release_waves (
  feature text not null,
  wave text not null check (wave in ('priority', 'everyone')),
  started_at timestamptz not null default now(),
  primary key (feature, wave)
);
create function public.support_submit(p_subject text) returns json language sql as $$ select '{}'::json $$;
create function public.user_release_rank(p_uid uuid) returns integer language sql as $$ select 0 $$;
grant execute on function public.support_submit(text) to authenticated;

\ir ../../supabase/migrations/20261110134000_proteraiotita_kai_seira_diathesis.sql

do $probe$
declare
  missing text;
begin
  select string_agg(c, ', ') into missing from unnest(array[
    'user_id', 'kept_for', 'priority_claimed', 'sender_verified', 'forward_state', 'forwarded_at',
    'forward_subject', 'reply_to', 'forward_attempts', 'forward_gen', 'forward_uncertain',
    'next_attempt_at', 'forward_claimed_at', 'forward_error', 'dedupe_key']) c
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'support_inbox' and column_name = c);
  if missing is not null then
    raise exception 'ΑΝΑΒΑΘΜΙΣΗ: στο support_inbox του πρώτου σχεδίου λείπουν: %', missing;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'support_inbox' and column_name in ('priority', 'forwarded')) then
    raise exception 'ΑΝΑΒΑΘΜΙΣΗ: έμειναν στήλες του πρώτου σχεδίου';
  end if;
  if (select forward_state from public.support_inbox where provider_id = 'em_old_shape') <> 'pending' then
    raise exception 'ΑΝΑΒΑΘΜΙΣΗ: η παλιά γραμμή δεν μπήκε στην ουρά';
  end if;
  if (select forward_state from public.support_inbox where provider_id = 'em_old_sent') <> 'sent' then
    raise exception 'ΑΝΑΒΑΘΜΙΣΗ: μήνυμα που είχε ήδη προωθηθεί θα ξαναστελνόταν';
  end if;
  insert into public.release_waves(feature, wave) values ('probe_upgrade', 'first');
  if to_regprocedure('public.support_submit(text)') is not null or to_regprocedure('public.user_release_rank(uuid)') is not null then
    raise exception 'ΑΝΑΒΑΘΜΙΣΗ: έμειναν συναρτήσεις του πρώτου σχεδίου';
  end if;
  raise notice 'probe: η μετάβαση φτάνει στο ίδιο σχήμα πάνω από το πρώτο της σχέδιο';
end
$probe$;
rollback;
