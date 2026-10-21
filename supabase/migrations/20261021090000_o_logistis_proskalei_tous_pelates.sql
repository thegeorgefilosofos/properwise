-- ═══════════════════════════════════════════════════════════════════════════
-- Ο ΛΟΓΙΣΤΗΣ ΠΡΟΣΚΑΛΕΙ ΤΟΥΣ ΠΕΛΑΤΕΣ ΤΟΥ, ΟΛΟΥΣ ΜΑΖΙ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΥΠΗΡΧΕ. Ο δρόμος πήγαινε μόνο από τον ιδιοκτήτη προς τον λογιστή: ο πελάτης
-- βγάζει σύνδεσμο, τον στέλνει, ο λογιστής τον επικολλά (`accountant_claim`).
-- Λογιστής με ογδόντα πελάτες έπρεπε να πάρει ογδόντα τηλέφωνα για να του
-- στείλουν ογδόντα συνδέσμους.
--
-- ΤΙ ΚΑΝΕΙ ΑΥΤΗ Η ΜΕΤΑΝΑΣΤΕΥΣΗ (έγκριση ιδιοκτήτη για αλλαγές σχήματος,
-- 20/10/2026). Ο λογιστής δίνει λίστα διευθύνσεων. Κάθε διεύθυνση παίρνει ένα
-- μήνυμα από την υπάρχουσα ουρά (`email_outbox`, συναλλακτικό) που λέει ποιος
-- ζητά πρόσβαση. Ο πελάτης, όταν μπει στην εφαρμογή με ΑΥΤΗ τη διεύθυνση, βλέπει
-- την πρόσκληση και αποφασίζει. Μόνο η δική του αποδοχή γράφει τη σύνδεση στο
-- `accountant_clients`, με τον δικό του ενεργό σύνδεσμο: τον ίδιο έλεγχο
-- (`accountant_link_live`) που κρατά ήδη όλη την πύλη.
--
-- ΤΙΠΟΤΑ ΔΕΝ ΦΑΙΝΕΤΑΙ ΠΡΙΝ ΤΗΝ ΑΠΟΔΟΧΗ. Ο λογιστής βλέπει μόνο ό,τι έγραψε ο
-- ίδιος (τη διεύθυνση) και την κατάσταση της δικής του πρόσκλησης. Δεν μαθαίνει
-- αν η διεύθυνση έχει λογαριασμό: «στάλθηκε» γράφεται είτε έχει είτε όχι. Η
-- μόνη εξαίρεση είναι «ήδη πελάτης σου», για όποιον ΗΔΗ τον εξουσιοδότησε, όπου
-- δεν αποκαλύπτεται κάτι που δεν ξέρει.
--
-- ΟΡΙΑ. 100 διευθύνσεις ανά κλήση, 50 μηνύματα ανά 24 ώρες ανά λογιστή μέσα
-- από την `bump_send_quota` (είδος `accountant_invite`), ξανά στην ίδια
-- διεύθυνση όχι πριν περάσουν 7 ημέρες και ποτέ σε όποιον απάντησε «όχι». Το
-- κείμενο του μηνύματος είναι σταθερό· το μόνο που βάζει ο λογιστής είναι το
-- όνομά του (κομμένο στους 80 χαρακτήρες) και η διεύθυνσή του, ώστε ο πελάτης να
-- ξέρει ποιος ρωτά.
--
-- ΔΙΑΓΡΑΦΗ. Η γραμμή κρέμεται από τον λογιστή (`accountant_id`, on delete
-- cascade) και φεύγει με τον λογαριασμό του: ο έλεγχος πληρότητας του
-- 20260818100000 το αναγνωρίζει από τη στήλη. Και όταν ο ΠΡΟΣΚΕΚΛΗΜΕΝΟΣ σβήσει
-- τον δικό του λογαριασμό, η διεύθυνσή του σβήνει και από τις προσκλήσεις,
-- με σκανδάλη πάνω στο `auth.users`: η διεύθυνση είναι δικό του δεδομένο.
--
-- 2FA. Restrictive `mfa_accountant_invites` όπως στο 20261003120000 και η ίδια
-- πύλη, πρώτη εντολή, σε κάθε SECURITY DEFINER που φτάνει ο `authenticated`.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.accountant_invites (
  id            uuid primary key default gen_random_uuid(),
  accountant_id uuid not null references auth.users (id) on delete cascade,
  email         text not null,
  status        text not null default 'sent',
  created_at    timestamptz not null default now(),
  sent_at       timestamptz not null default now(),
  answered_at   timestamptz,
  unique (accountant_id, email)
);

do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'accountant_invites_email_shape') then
    alter table public.accountant_invites add constraint accountant_invites_email_shape
      check (email = lower(btrim(email)) and length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accountant_invites_status_known') then
    alter table public.accountant_invites add constraint accountant_invites_status_known
      check (status in ('sent', 'accepted', 'declined'));
  end if;
end $c$;

create index if not exists accountant_invites_email_idx on public.accountant_invites (email);

alter table public.accountant_invites enable row level security;

-- Ο λογιστής βλέπει τις δικές του. Καμία εγγραφή ή ενημέρωση απευθείας: όλα
-- περνούν από τις συναρτήσεις, που κρατούν όριο και κανόνες.
drop policy if exists accountant_invites_own on public.accountant_invites;
create policy accountant_invites_own on public.accountant_invites
  for select to authenticated using (accountant_id = (select auth.uid()));

-- Παίρνει πίσω πρόσκληση που δεν απαντήθηκε. Η αποδεκτή μένει ως ίχνος: η
-- σύνδεση ζει στο `accountant_clients` και αφαιρείται από εκεί.
drop policy if exists accountant_invites_withdraw on public.accountant_invites;
create policy accountant_invites_withdraw on public.accountant_invites
  for delete to authenticated using (accountant_id = (select auth.uid()) and status <> 'accepted');

drop policy if exists mfa_accountant_invites on public.accountant_invites;
create policy mfa_accountant_invites on public.accountant_invites as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

revoke all on public.accountant_invites from anon;
grant select, delete on public.accountant_invites to authenticated;

comment on table public.accountant_invites is
  'Οι προσκλήσεις που έστειλε ο λογιστής σε πελάτες του. Μόνο διεύθυνση και κατάσταση: κανένα δεδομένο του πελάτη πριν την αποδοχή.';

-- ── ΤΟ ΟΡΙΟ ΤΩΝ ΜΗΝΥΜΑΤΩΝ, ΣΤΟ ΙΔΙΟ ΣΗΜΕΙΟ ΜΕ ΤΑ ΑΛΛΑ ──────────────────────
-- Ολόκληρος ο κατάλογος, γιατί η τελευταία γραφή είναι η ισχύουσα.
create or replace function public.send_quota_rule(p_kind text)
returns table (max_units int, window_span interval)
language sql immutable set search_path = public as $$
  select t.max_units, t.window_span
    from (values
      ('client_email',      3000, interval '24 hours'),
      ('org_invite',          20, interval '24 hours'),
      ('accountant_invite',   50, interval '24 hours'),
      ('test_notification',   10, interval '24 hours'),
      ('tester_code',          5, interval '24 hours'),
      ('ical_preview',        60, interval  '1 hour')
    ) as t(kind, max_units, window_span)
   where t.kind = btrim(coalesce(p_kind, ''))
$$;

alter function public.send_quota_rule(text) owner to postgres;
revoke all     on function public.send_quota_rule(text) from public, anon;
grant  execute on function public.send_quota_rule(text) to authenticated, service_role;

-- ── 1. Η ΠΡΟΣΚΛΗΣΗ ──────────────────────────────────────────────────────────
-- Μία κατάσταση ανά γραμμή, με τη σειρά που δόθηκαν:
--   sent            στάλθηκε μήνυμα (και όταν η διεύθυνση δεν έχει λογαριασμό)
--   already_invited στάλθηκε τις τελευταίες 7 ημέρες· δεν ξαναστέλνεται
--   already_client  σε έχει ήδη εξουσιοδοτήσει
--   declined        απάντησε «όχι»· δεν ξαναστέλνεται
--   duplicate       ίδια διεύθυνση πιο πάνω στη λίστα
--   invalid         δεν είναι διεύθυνση email
--   self            η δική σου διεύθυνση
--   rate_limited    έφτασες το όριο των 24 ωρών
--   over_limit      πάνω από 100 στη μία φορά
create or replace function public.accountant_invite_clients(p_emails text[])
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_me     uuid := auth.uid();
  v_self   text := lower(btrim(coalesce(auth.email(), '')));
  v_name   text;
  v_raw    text;
  v_email  text;
  v_seen   text[] := '{}';
  v_out    json[] := '{}';
  v_inv    record;
  v_quota  json;
  v_id     uuid;
  v_sent   timestamptz;
  v_n      int := 0;
  v_status text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return '[]'::json; end if;

  select left(coalesce(nullif(btrim(bp.owner_name), ''), nullif(btrim(bp.full_name), ''), ''), 80)
    into v_name from billing_profiles bp where bp.user_id = v_me;

  foreach v_raw in array coalesce(p_emails, '{}'::text[]) loop
    v_email := lower(btrim(coalesce(v_raw, '')));
    if v_email = '' then continue; end if;
    v_n := v_n + 1;
    v_sent := null;

    if v_n > 100 then
      v_status := 'over_limit';
    elsif length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_status := 'invalid';
    elsif v_email = any (v_seen) then
      v_status := 'duplicate';
    elsif v_email = v_self then
      v_status := 'self';
    elsif exists (
      select 1 from accountant_clients ac join auth.users u on u.id = ac.owner_id
       where ac.accountant_id = v_me and ac.active and lower(btrim(u.email)) = v_email
         and public.accountant_link_live(v_me, ac.owner_id)
    ) then
      v_status := 'already_client';
    else
      select * into v_inv from accountant_invites where accountant_id = v_me and email = v_email;
      if found and v_inv.status = 'declined' then
        v_status := 'declined';
      elsif found and v_inv.status = 'sent' and v_inv.sent_at > now() - interval '7 days' then
        v_status := 'already_invited'; v_sent := v_inv.sent_at;
      else
        v_quota := public.bump_send_quota('accountant_invite', 1, 50, interval '24 hours');
        if coalesce((v_quota ->> 'allowed')::boolean, false) is not true then
          v_status := 'rate_limited';
        else
          insert into accountant_invites (accountant_id, email, status, sent_at, answered_at)
            values (v_me, v_email, 'sent', now(), null)
          on conflict (accountant_id, email)
            do update set status = 'sent', sent_at = now(), answered_at = null
          returning id, sent_at into v_id, v_sent;

          insert into email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
          values ('accountant_invite', v_email, null,
                  jsonb_build_object(
                    'accountantName', nullif(v_name, ''),
                    'accountantEmail', nullif(v_self, '')),
                  'transactional',
                  'accountant_invite:' || v_id::text || ':' || extract(epoch from v_sent)::bigint::text,
                  now())
          on conflict (dedup_key) do nothing;
          v_status := 'sent';
        end if;
      end if;
    end if;

    if v_status <> 'over_limit' and v_status <> 'invalid' then v_seen := v_seen || v_email; end if;
    v_out := v_out || json_build_object('email', v_email, 'status', v_status, 'sentAt', v_sent);
  end loop;

  return array_to_json(v_out);
end $$;

alter function public.accountant_invite_clients(text[]) owner to postgres;
revoke all     on function public.accountant_invite_clients(text[]) from public, anon;
grant  execute on function public.accountant_invite_clients(text[]) to authenticated;

comment on function public.accountant_invite_clients(text[]) is
  'Ο λογιστής στέλνει πρόσκληση σε λίστα διευθύνσεων. Μία κατάσταση ανά γραμμή, με όριο, χωρίς διπλά και χωρίς να αποκαλύπτει ποια διεύθυνση έχει λογαριασμό.';

-- ── 2. Η ΠΛΕΥΡΑ ΤΟΥ ΠΕΛΑΤΗ ──────────────────────────────────────────────────
-- Οι προσκλήσεις προς τη ΔΙΚΗ μου διεύθυνση, με το όνομα του λογιστή που ρωτά.
create or replace function public.my_accountant_invites()
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_me    uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.email(), '')));
  v_rows  json;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null or v_email = '' then return '[]'::json; end if;

  select coalesce(json_agg(json_build_object(
           'id', i.id,
           'name', coalesce(nullif(btrim(bp.owner_name), ''), nullif(btrim(bp.full_name), ''), 'Λογιστής'),
           'email', lower(btrim(u.email)),
           'sentAt', i.sent_at
         ) order by i.sent_at desc), '[]'::json)
    into v_rows
    from accountant_invites i
    join auth.users u on u.id = i.accountant_id
    left join billing_profiles bp on bp.user_id = i.accountant_id
   where i.email = v_email and i.status = 'sent' and i.accountant_id <> v_me;

  return v_rows;
end $$;

alter function public.my_accountant_invites() owner to postgres;
revoke all     on function public.my_accountant_invites() from public, anon;
grant  execute on function public.my_accountant_invites() to authenticated;

comment on function public.my_accountant_invites() is
  'Ποιοι λογιστές ζήτησαν πρόσβαση στη διεύθυνση του συνδεδεμένου χρήστη και δεν έχουν πάρει ακόμη απάντηση.';

-- «Ναι» ή «όχι». Το «ναι» απαιτεί ΖΩΝΤΑΝΟ σύνδεσμο του ίδιου του πελάτη: η
-- σύνδεση γράφεται με αυτόν, ώστε ανάκληση και περιστροφή να την κόβουν όπως
-- κάθε άλλη (`accountant_link_live`). Χωρίς σύνδεσμο απαντά `no_link` και η
-- οθόνη τον βγάζει πρώτα.
create or replace function public.accountant_invite_answer(p_id uuid, p_accept boolean)
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_me    uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.email(), '')));
  v_inv   record;
  v_token text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null or v_email = '' then return json_build_object('ok', false, 'reason', 'anonymous'); end if;

  select * into v_inv from accountant_invites
   where id = p_id and email = v_email and status = 'sent'
   for update;
  if not found then return json_build_object('ok', false, 'reason', 'invalid'); end if;
  if v_inv.accountant_id = v_me then return json_build_object('ok', false, 'reason', 'self'); end if;

  if not coalesce(p_accept, false) then
    update accountant_invites set status = 'declined', answered_at = now() where id = v_inv.id;
    return json_build_object('ok', true, 'status', 'declined');
  end if;

  select token into v_token from accountant_links
   where user_id = v_me and active = true and (expires_at is null or expires_at > now());
  if v_token is null then return json_build_object('ok', false, 'reason', 'no_link'); end if;

  -- Η ΑΠΟΔΟΧΗ ΕΙΝΑΙ ΡΗΤΗ ΣΥΓΚΑΤΑΘΕΣΗ ΤΟΥ ΠΕΛΑΤΗ. Ακόμη κι αν είχε κόψει
  -- κάποτε αυτόν τον λογιστή (`active = false`), εδώ τον ξαναδέχεται ο ίδιος.
  insert into accountant_clients (accountant_id, owner_id, claimed_token)
    values (v_inv.accountant_id, v_me, v_token)
  on conflict (accountant_id, owner_id)
    do update set active = true, linked_at = now(), claimed_token = excluded.claimed_token;

  update accountant_invites set status = 'accepted', answered_at = now() where id = v_inv.id;
  return json_build_object('ok', true, 'status', 'accepted');
end $$;

alter function public.accountant_invite_answer(uuid, boolean) owner to postgres;
revoke all     on function public.accountant_invite_answer(uuid, boolean) from public, anon;
grant  execute on function public.accountant_invite_answer(uuid, boolean) to authenticated;

comment on function public.accountant_invite_answer(uuid, boolean) is
  'Ο πελάτης δέχεται ή αρνείται πρόσκληση λογιστή. Η αποδοχή γράφει τη σύνδεση με τον ζωντανό σύνδεσμο του ίδιου του πελάτη.';

-- ── 3. Η ΔΙΕΥΘΥΝΣΗ ΦΕΥΓΕΙ ΜΕ ΤΟΝ ΠΡΟΣΚΕΚΛΗΜΕΝΟ ──────────────────────────────
create or replace function private.accountant_invites_forget_email()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $$
begin
  if old.email is not null and btrim(old.email) <> '' then
    delete from public.accountant_invites where email = lower(btrim(old.email));
  end if;
  return old;
end $$;

alter function private.accountant_invites_forget_email() owner to postgres;
revoke all on function private.accountant_invites_forget_email() from public, anon, authenticated;

drop trigger if exists accountant_invites_forget_email on auth.users;
create trigger accountant_invites_forget_email
  before delete on auth.users
  for each row execute function private.accountant_invites_forget_email();

comment on function private.accountant_invites_forget_email() is
  'Όταν διαγράφεται λογαριασμός, η διεύθυνσή του σβήνει και από τις προσκλήσεις λογιστών που τη γράφουν.';
