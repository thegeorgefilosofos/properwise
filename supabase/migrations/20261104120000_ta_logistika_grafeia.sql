-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΑ ΛΟΓΙΣΤΙΚΑ ΓΡΑΦΕΙΑ: ΠΟΛΛΑ ΜΕΛΗ, ΜΙΑ ΑΔΕΙΑ ΑΝΑ ΠΕΛΑΤΗ, ΜΟΝΟ ΑΝΑΓΝΩΣΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΖΗΤΗΘΗΚΕ. Ο ιδιοκτήτης (04/11/2026): το λογιστικό ή φοροτεχνικό γραφείο
-- να έχει πολλούς χρήστες, συνδεδεμένους ταυτόχρονα, που βλέπουν τα δεδομένα
-- των πελατών του γραφείου μόνο για ανάγνωση.
--
-- ΤΙ ΥΠΗΡΧΕ. Η άδεια ήταν ΠΡΟΣΩΠΙΚΗ: μία γραμμή στο `accountant_clients` ανά
-- (λογιστής, ιδιοκτήτης). Ένας δεύτερος υπάλληλος του γραφείου δεν έβλεπε
-- τίποτα και, αν ο λογιστής έφευγε, ο ιδιοκτήτης έπρεπε να ξαναστείλει
-- σύνδεσμο στον αντικαταστάτη του.
--
-- ΤΙ ΑΛΛΑΖΕΙ, ΚΑΙ ΓΙΑΤΙ ΕΤΣΙ.
--
--   1. ΚΑΘΕ ΑΔΕΙΑ ΑΝΗΚΕΙ ΣΕ ΓΡΑΦΕΙΟ. Το `accountant_clients` αποκτά `firm_id`:
--      το γραφείο του προσώπου που διεκδίκησε τον σύνδεσμο ή δέχτηκε την
--      πρόσκληση. Δεν φτιάχνεται δεύτερος πίνακας αδειών: οι δύο υπάρχουσες
--      πόρτες (`accountant_claim`, `accountant_invite_answer`) και η ανάκληση
--      του ιδιοκτήτη (περιστροφή συνδέσμου ή διαγραφή γραμμής) μένουν όπως
--      είναι. Μία σκανδάλη συμπληρώνει το γραφείο στη γραμμή που γράφεται.
--
--   2. ΚΑΘΕ ΛΟΓΙΣΤΗΣ ΕΙΝΑΙ ΓΡΑΦΕΙΟ. Ο μεμονωμένος λογιστής είναι γραφείο ενός
--      μέλους. Δεν υπάρχει δεύτερος δρόμος «χωρίς γραφείο» να συντηρείται:
--      όταν προσλάβει συνεργάτη, δεν αλλάζει τίποτα στη δομή.
--
--   3. ΕΝΑΣ ΕΛΕΓΧΟΣ ΓΙΑ ΟΛΑ. Το `accountant_link_live` είναι ήδη το σημείο από
--      το οποίο περνά κάθε πρόσβαση λογιστή (λίστα πελατών, αιτήματα, αρχεία,
--      Ε2). Τώρα ρωτά: είσαι ενεργό μέλος του γραφείου που έχει την άδεια, με
--      ρόλο που ΕΝΕΡΓΕΙ (υπεύθυνος ή λογιστής) και, αν δεν είσαι υπεύθυνος,
--      σου έχει ανατεθεί ο πελάτης; Το `private.firm_reads_owner` κάνει την
--      ίδια ερώτηση για την ανάγνωση, όπου χωρά και ο συνεργάτης.
--
-- ΡΟΛΟΙ.
--   manager     Υπεύθυνος γραφείου: όλοι οι πελάτες, μέλη, αναθέσεις, ιστορικό.
--   accountant  Λογιστής: οι πελάτες που του ανατέθηκαν· ζητά έγγραφα,
--               ανεβάζει Ε2, κατεβάζει τον φάκελο.
--   associate   Συνεργάτης: οι πελάτες που του ανατέθηκαν, ΜΟΝΟ ανάγνωση —
--               ούτε αιτήματα, ούτε ανέβασμα, ούτε εξαγωγές.
--
-- ΤΙ ΔΕΝ ΚΑΝΕΙ ΚΑΝΕΝΑ ΜΕΛΟΣ. Δεν γράφει στα δεδομένα του ιδιοκτήτη. Δεν
-- υπάρχει ούτε μία πολιτική εγγραφής για μέλος σε πίνακα ιδιοκτήτη· οι νέοι
-- πίνακες γράφονται μόνο από τις συναρτήσεις αυτού του αρχείου.
--
-- ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Η χρέωση. Οι σύνδεσμοι ανάγνωσης (`accountant_links`,
-- `get_accountant_data`). Η ανάκληση από τον ιδιοκτήτη.
--
-- Ο ΚΑΤΑΛΟΓΟΣ ΠΡΟΣΒΑΣΗΣ (`firm_access_log`) καταγράφει όταν μέλος ανοίγει
-- πελάτη από τον χώρο του γραφείου (`firm_open_client`). Είναι ιστορικό για
-- τον υπεύθυνο και για τον ιδιοκτήτη, όχι μηχανισμός ασφάλειας: την ασφάλεια
-- την κρατά το `accountant_link_live`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ΤΟ ΓΡΑΦΕΙΟ ──────────────────────────────────────────────────────────
create table if not exists public.firms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  afm         text,
  kind        text not null default 'accounting',
  phone       text,
  address     text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'firms_kind_chk') then
    alter table public.firms add constraint firms_kind_chk check (kind in ('accounting', 'tax'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'firms_name_len') then
    alter table public.firms add constraint firms_name_len check (char_length(btrim(name)) between 1 and 160);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'firms_afm_digits') then
    alter table public.firms add constraint firms_afm_digits check (afm is null or afm ~ '^[0-9]{9}$');
  end if;
end $$;

alter table public.firms enable row level security;

drop trigger if exists firms_updated_at on public.firms;
create trigger firms_updated_at before update on public.firms
  for each row execute function public.update_updated_at_column();

-- ── 2. ΤΑ ΜΕΛΗ ─────────────────────────────────────────────────────────────
create table if not exists public.firm_members (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'accountant',
  status      text not null default 'invited',
  invited_by  uuid references auth.users(id) on delete set null,
  invited_at  timestamptz not null default now(),
  joined_at   timestamptz,
  removed_at  timestamptz,
  -- Λογαριασμός ΜΟΝΟ γραφείου: δεν καταχωρεί ακίνητα ως ιδιοκτήτης (βλ. §6).
  firm_only   boolean not null default true
);
alter table public.firm_members add column if not exists firm_only boolean not null default true;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'firm_members_role_chk') then
    alter table public.firm_members add constraint firm_members_role_chk check (role in ('manager', 'accountant', 'associate'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'firm_members_status_chk') then
    alter table public.firm_members add constraint firm_members_status_chk check (status in ('invited', 'active', 'removed'));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'firm_members_active_has_user') then
    alter table public.firm_members add constraint firm_members_active_has_user check (status <> 'active' or user_id is not null);
  end if;
end $$;

-- Ένα πρόσωπο, ένα ενεργό γραφείο. Αλλιώς «ποιος σε βλέπει» δεν έχει απάντηση.
create unique index if not exists firm_members_one_active_firm
  on public.firm_members (user_id) where status = 'active';
-- Μία πρόσκληση ή συμμετοχή ανά διεύθυνση και γραφείο.
create unique index if not exists firm_members_email_once
  on public.firm_members (firm_id, lower(email)) where status <> 'removed';
create index if not exists firm_members_firm_idx on public.firm_members (firm_id, status);

alter table public.firm_members enable row level security;

-- ── 3. ΤΟ ΓΡΑΦΕΙΟ ΤΗΣ ΚΑΘΕ ΑΔΕΙΑΣ ─────────────────────────────────────────
alter table public.accountant_clients add column if not exists firm_id uuid references public.firms(id) on delete set null;
create index if not exists accountant_clients_firm_idx on public.accountant_clients (firm_id, owner_id);

-- ── 4. ΠΟΙΟΣ ΕΧΕΙ ΑΝΑΛΑΒΕΙ ΠΟΙΟΝ ΠΕΛΑΤΗ ───────────────────────────────────
create table if not exists public.firm_client_assignees (
  firm_id      uuid not null references public.firms(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  assigned_by  uuid references auth.users(id) on delete set null,
  assigned_at  timestamptz not null default now(),
  primary key (firm_id, owner_id, user_id)
);
create index if not exists firm_client_assignees_user_idx on public.firm_client_assignees (user_id, firm_id);

alter table public.firm_client_assignees enable row level security;

-- ── 5. ΤΟ ΙΣΤΟΡΙΚΟ ΠΡΟΣΒΑΣΗΣ ───────────────────────────────────────────────
create table if not exists public.firm_access_log (
  id        uuid primary key default gen_random_uuid(),
  firm_id   uuid not null references public.firms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  owner_id  uuid not null references auth.users(id) on delete cascade,
  action    text not null,
  at        timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'firm_access_log_action_chk') then
    alter table public.firm_access_log add constraint firm_access_log_action_chk check (action in ('open', 'export', 'request', 'upload'));
  end if;
end $$;
create index if not exists firm_access_log_firm_idx  on public.firm_access_log (firm_id, at desc);
create index if not exists firm_access_log_owner_idx on public.firm_access_log (owner_id, at desc);
create index if not exists firm_access_log_user_idx  on public.firm_access_log (user_id);
create index if not exists firm_client_assignees_owner_idx on public.firm_client_assignees (owner_id);
create index if not exists firm_client_assignees_by_idx    on public.firm_client_assignees (assigned_by);
create index if not exists firm_members_invited_by_idx on public.firm_members (invited_by);
create index if not exists firms_created_by_idx on public.firms (created_by);

alter table public.firm_access_log enable row level security;

-- ═══════════════════════════════════════════════════════════════════════════
-- ΟΙ ΒΟΗΘΟΙ (private): ΠΟΙΟ ΓΡΑΦΕΙΟ, ΠΟΙΟΣ ΡΟΛΟΣ, ΤΙ ΒΛΕΠΕΙ
-- ═══════════════════════════════════════════════════════════════════════════

/* Το ενεργό γραφείο ενός προσώπου, ή null. */
create or replace function private.firm_of(p_user uuid)
returns uuid
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select m.firm_id from public.firm_members m
   where m.user_id = p_user and m.status = 'active'
   limit 1;
$$;

/* Ο ρόλος ενός προσώπου στο γραφείο, ή null αν δεν είναι ενεργό μέλος. */
create or replace function private.firm_role(p_user uuid, p_firm uuid)
returns text
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select m.role from public.firm_members m
   where m.user_id = p_user and m.firm_id = p_firm and m.status = 'active'
   limit 1;
$$;

/*
 * Βλέπει το πρόσωπο τον ιδιοκτήτη μέσα από το γραφείο του;
 * `p_act`: απαιτείται ρόλος που ενεργεί (υπεύθυνος ή λογιστής).
 *
 * Η ΑΔΕΙΑ ΚΡΙΝΕΤΑΙ ΑΠΟ ΤΟΝ ΣΥΝΔΕΣΜΟ ΤΟΥ ΙΔΙΟΚΤΗΤΗ, όπως και πριν: ίδιο token
 * με αυτό που διεκδικήθηκε, ενεργό, μη ληγμένο. Ο ιδιοκτήτης που περιστρέφει
 * τον σύνδεσμο κόβει ολόκληρο το γραφείο με μία κίνηση.
 */
create or replace function private.firm_sees_owner(p_user uuid, p_owner uuid, p_act boolean)
returns boolean
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select p_user is not null and p_owner is not null and p_user <> p_owner and exists (
    select 1
      from public.accountant_clients ac
      join public.accountant_links al
        on al.user_id = ac.owner_id
       and al.active
       and al.token = ac.claimed_token
      join public.firm_members m
        on m.firm_id = ac.firm_id
       and m.user_id = p_user
       and m.status = 'active'
     where ac.owner_id = p_owner
       and ac.active
       and ac.firm_id is not null
       and (al.expires_at is null or al.expires_at > now())
       and (not p_act or m.role in ('manager', 'accountant'))
       and (m.role = 'manager' or exists (
             select 1 from public.firm_client_assignees fa
              where fa.firm_id = ac.firm_id and fa.owner_id = p_owner and fa.user_id = p_user))
  );
$$;

/* Ανάγνωση: κάθε ενεργό μέλος στο οποίο ανατέθηκε ο πελάτης, ή ο υπεύθυνος. */
create or replace function private.firm_reads_owner(p_user uuid, p_owner uuid)
returns boolean
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select private.firm_sees_owner(p_user, p_owner, false)
      or public.accountant_link_live(p_user, p_owner);
$$;

/*
 * Το προσωπικό γραφείο ενός λογιστή που δεν ανήκει ακόμη σε κανένα. Παίρνει
 * το όνομα του προφίλ χρέωσης, ώστε η πρώτη εικόνα του ιδιοκτήτη να λέει
 * ποιον βλέπει, όχι «Γραφείο».
 */
create or replace function private.firm_ensure(p_user uuid)
returns uuid
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_firm uuid := private.firm_of(p_user);
  v_name text;
  v_email text;
begin
  if v_firm is not null or p_user is null then return v_firm; end if;

  select coalesce(nullif(btrim(bp.owner_name), ''), nullif(btrim(bp.full_name), ''))
    into v_name from public.billing_profiles bp where bp.user_id = p_user;
  select lower(u.email) into v_email from auth.users u where u.id = p_user;

  insert into public.firms (name, created_by)
    values (left(coalesce(v_name, 'Λογιστικό γραφείο'), 160), p_user)
    returning id into v_firm;
  -- Όποιος έχει ήδη δικά του ακίνητα δεν κλειδώνεται: τα κρατά και συνεχίζει.
  insert into public.firm_members (firm_id, user_id, email, role, status, invited_by, joined_at, firm_only)
    values (v_firm, p_user, coalesce(v_email, ''), 'manager', 'active', p_user, now(),
            not exists (select 1 from public.user_properties up where up.user_id = p_user));
  return v_firm;
end $$;

-- ── Η ΣΚΑΝΔΑΛΗ: ΚΑΘΕ ΝΕΑ ΑΔΕΙΑ ΑΠΟΚΤΑ ΓΡΑΦΕΙΟ ─────────────────────────────
-- Και ο λογιστής που τη διεκδίκησε την αναλαμβάνει, αν δεν είναι υπεύθυνος:
-- αλλιώς θα διεκδικούσε πελάτη και δεν θα τον έβλεπε.
create or replace function private.accountant_clients_firm()
returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if new.firm_id is null then
    new.firm_id := private.firm_ensure(new.accountant_id);
  end if;
  return new;
end $$;

drop trigger if exists accountant_clients_firm on public.accountant_clients;
create trigger accountant_clients_firm
  before insert on public.accountant_clients
  for each row execute function private.accountant_clients_firm();

create or replace function private.accountant_clients_assign()
returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if new.firm_id is not null and coalesce(private.firm_role(new.accountant_id, new.firm_id), '') <> 'manager' then
    insert into public.firm_client_assignees (firm_id, owner_id, user_id, assigned_by)
      values (new.firm_id, new.owner_id, new.accountant_id, new.accountant_id)
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists accountant_clients_assign on public.accountant_clients;
create trigger accountant_clients_assign
  after insert on public.accountant_clients
  for each row execute function private.accountant_clients_assign();

-- ── ΤΟ ΓΡΑΦΕΙΟ ΧΩΡΙΣ ΕΝΕΡΓΑ ΜΕΛΗ ΔΕΝ ΜΕΝΕΙ ΠΙΣΩ ────────────────────────────
-- Όταν διαγράφεται ο λογαριασμός του τελευταίου ενεργού μέλους, φεύγει και το
-- γραφείο μαζί με τις εκκρεμείς προσκλήσεις του: διευθύνσεις email τρίτων δεν
-- κρατιούνται για γραφείο που δεν υπάρχει.
create or replace function private.firm_members_gone()
returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  delete from public.firms f
   where f.id = old.firm_id
     and not exists (select 1 from public.firm_members m where m.firm_id = f.id and m.status = 'active');
  return null;
end $$;

drop trigger if exists firm_members_gone on public.firm_members;
create trigger firm_members_gone
  after delete on public.firm_members
  for each row execute function private.firm_members_gone();

-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΜΕΤΑΦΟΡΑ ΤΩΝ ΥΠΑΡΧΟΝΤΩΝ: ΚΑΘΕ ΛΟΓΙΣΤΗΣ ΓΙΝΕΤΑΙ ΓΡΑΦΕΙΟ ΕΝΟΣ ΜΕΛΟΥΣ
-- ─────────────────────────────────────────────────────────────────────────
-- Καμία πρόσβαση δεν χάνεται: ο λογιστής γίνεται υπεύθυνος του δικού του
-- γραφείου, οπότε βλέπει όλους όσους έβλεπε. Ο ιδιοκτήτης δεν κάνει τίποτα.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare r record;
begin
  for r in select distinct accountant_id from public.accountant_clients where firm_id is null loop
    update public.accountant_clients
       set firm_id = private.firm_ensure(r.accountant_id)
     where accountant_id = r.accountant_id and firm_id is null;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Ο ΕΝΑΣ ΕΛΕΓΧΟΣ: accountant_link_live (ΡΟΛΟΣ ΠΟΥ ΕΝΕΡΓΕΙ)
-- ─────────────────────────────────────────────────────────────────────────
-- Ίδια υπογραφή, ίδιο νόημα για όσους την καλούν: «μπορεί ο λογιστής να
-- ενεργήσει για τον ιδιοκτήτη;». Ο παλιός δρόμος (η δική του γραμμή) μένει
-- μόνο για γραμμές χωρίς γραφείο, που μετά τη μεταφορά δεν υπάρχουν· κρατιέται
-- ώστε μια γραμμή που θα γραφόταν χωρίς τη σκανδάλη να μη χάσει πρόσβαση.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.accountant_link_live(p_accountant uuid, p_owner uuid)
returns boolean
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select exists (
    select 1
      from accountant_clients ac
      join accountant_links al
        on al.user_id = ac.owner_id
       and al.active
       and al.token = ac.claimed_token          -- ΙΔΙΟ link, όχι απλώς «κάποιο»
     where ac.accountant_id = p_accountant
       and ac.owner_id = p_owner
       and ac.firm_id is null
       and ac.active
       and (al.expires_at is null or al.expires_at > now())
  ) or private.firm_sees_owner(p_accountant, p_owner, true);
$$;

-- Τα αρχεία: ο συνεργάτης ΔΙΑΒΑΖΕΙ (φάκελος, Ε2), ΔΕΝ ανεβάζει.
create or replace function private.accountant_sees_file(p_name text, p_write boolean)
returns boolean
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_parts text[] := storage.foldername(p_name);
  v_owner uuid;
begin
  if auth.uid() is null or coalesce(array_length(v_parts, 1), 0) < 2 then return false; end if;
  if v_parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_owner := v_parts[1]::uuid;
  if v_owner = auth.uid() then return false; end if;      -- ο ιδιοκτήτης έχει ήδη τη δική του πολιτική
  if p_write and v_parts[2] <> 'aade-e2' then return false; end if;
  if not p_write and v_parts[2] not in ('aade-e2', 'accountant-pack') then return false; end if;
  if p_write then return public.accountant_link_live(auth.uid(), v_owner); end if;
  return private.firm_reads_owner(auth.uid(), v_owner);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΛΙΣΤΑ ΤΩΝ ΠΕΛΑΤΩΝ: ΤΟΥ ΓΡΑΦΕΙΟΥ, ΟΧΙ ΤΟΥ ΠΡΟΣΩΠΟΥ
-- ─────────────────────────────────────────────────────────────────────────
-- Μία γραμμή ανά ιδιοκτήτη, όσα μέλη κι αν έχουν διεκδικήσει τον ίδιο. Τα
-- αιτήματα του ΓΡΑΦΕΙΟΥ, όχι μόνο τα δικά μου: αλλιώς δύο συνάδελφοι θα
-- ζητούσαν το ίδιο εκκαθαριστικό. Νέα πεδία: `canAct` (μπορώ να ζητήσω ή να
-- ανεβάσω;) και `assignees` (ποιος τον έχει αναλάβει).
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.accountant_clients_overview(p_year integer)
returns json
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_firm uuid;
  v_rows json;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return '[]'::json; end if;
  v_firm := private.firm_of(v_me);

  select coalesce(json_agg(r order by r->>'name'), '[]'::json) into v_rows from (
    select json_build_object(
      'ownerId',      o.owner_id,
      'name',         coalesce(nullif(trim(bp.owner_name), ''), nullif(trim(bp.full_name), ''), 'Ιδιοκτήτης'),
      'afm',          bp.afm,
      'linkedAt',     o.linked_at,
      'canAct',       public.accountant_link_live(v_me, o.owner_id),
      'assignees',    coalesce((
        select json_agg(json_build_object('userId', fa.user_id, 'name',
                 coalesce(nullif(trim(abp.owner_name), ''), nullif(trim(abp.full_name), ''), m.email))
               order by fa.assigned_at)
          from firm_client_assignees fa
          join firm_members m on m.firm_id = fa.firm_id and m.user_id = fa.user_id and m.status = 'active'
          left join billing_profiles abp on abp.user_id = fa.user_id
         where fa.firm_id = v_firm and fa.owner_id = o.owner_id
      ), '[]'::json),
      'token',        (select al.token from accountant_links al
                        where al.user_id = o.owner_id
                          and coalesce(al.active, true)
                          and (al.expires_at is null or al.expires_at > now())
                        limit 1),
      'lastActivity', (
        select max(t) from (
          select max(e.created_at) as t from expenses e where e.user_id = o.owner_id
          union all
          select max(rp.created_at) from rent_payments rp where rp.user_id = o.owner_id
          union all
          select max(s.created_at) from client_stays s where s.user_id = o.owner_id
          union all
          select max(d.created_at) from property_documents d where d.user_id = o.owner_id
        ) moves
      ),
      'requests', coalesce((
        select json_agg(json_build_object(
          'id', ar.id, 'item', ar.item, 'note', ar.note, 'createdAt', ar.created_at
        ) order by ar.created_at)
        from accountant_requests ar
        where ar.owner_id = o.owner_id and ar.status = 'open'
          and (ar.accountant_id = v_me or ar.accountant_id in (
                select fm.user_id from firm_members fm where fm.firm_id = v_firm and fm.status = 'active'))
      ), '[]'::json),
      'properties',   (select count(*) from user_properties up where up.user_id = o.owner_id),
      'expenses',     (select count(*) from expenses e
                        where e.user_id = o.owner_id and extract(year from e.date) = p_year),
      'uncategorised',(select count(*) from expenses e
                        where e.user_id = o.owner_id and extract(year from e.date) = p_year
                          and coalesce(nullif(trim(e.category), ''), '') = ''),
      'noSupplierAfm',(select count(*) from expenses e
                        where e.user_id = o.owner_id and extract(year from e.date) = p_year
                          and coalesce(nullif(trim(e.supplier_afm), ''), '') = ''),
      'rentsUnpaid',  (select count(*) from rent_payments rp
                        where rp.user_id = o.owner_id and rp.period_year = p_year and rp.paid is not true),
      'stays',        (select count(*) from client_stays s
                        where s.user_id = o.owner_id
                          and extract(year from coalesce(s.check_in, s.check_out)) = p_year),
      'staysNoFee',   (select count(*) from client_stays s
                        where s.user_id = o.owner_id
                          and extract(year from coalesce(s.check_in, s.check_out)) = p_year
                          and s.channel in ('airbnb', 'booking')
                          and coalesce(s.platform_fee, 0) <= 0),
      'openRequests', (select count(*) from accountant_requests ar
                        where ar.owner_id = o.owner_id and ar.status = 'open'
                          and (ar.accountant_id = v_me or ar.accountant_id in (
                                select fm.user_id from firm_members fm where fm.firm_id = v_firm and fm.status = 'active'))),
      'e2', json_build_object(
        'aadeRows',      (select count(*) from e2_prefilled ep
                           where ep.user_id = o.owner_id and ep.tax_year = p_year),
        'aadeChangedAt', (select max(ep.updated_at) from e2_prefilled ep
                           where ep.user_id = o.owner_id and ep.tax_year = p_year),
        'packs', coalesce((
          select json_agg(json_build_object(
            'ownerAfm', pk.owner_afm,
            'differences', pk.aade_differences,
            'checkedAt', pk.aade_checked_at,
            'missingCount', pk.missing_count,
            'missingTop', pk.missing_top,
            'filePath', pk.file_path,
            'sizeBytes', pk.size_bytes,
            'sharedAt', pk.shared_at
          ) order by pk.owner_afm)
          from accountant_packs pk
          where pk.user_id = o.owner_id and pk.tax_year = p_year
        ), '[]'::json)
      )
    ) as r
    from (
      select ac.owner_id, min(ac.linked_at) as linked_at
        from accountant_clients ac
       where (ac.accountant_id = v_me or (v_firm is not null and ac.firm_id = v_firm))
       group by ac.owner_id
    ) o
    left join billing_profiles bp on bp.user_id = o.owner_id
    where private.firm_reads_owner(v_me, o.owner_id)
      -- Η ΚΛΕΙΔΑΡΙΑ ΤΟΥ ΒΑΘΜΟΥ 1 ΕΦΥΓΕ ΜΑΖΙ ΜΕ ΤΗΣ `get_accountant_data`
      -- (20260925190000): κάθε πακέτο ιδιοκτήτη στέλνει τον φάκελο στον λογιστή.
  ) sub;

  return v_rows;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΠΛΕΥΡΑ ΤΟΥ ΙΔΙΟΚΤΗΤΗ: ΠΟΙΟ ΓΡΑΦΕΙΟ, ΠΟΙΑ ΜΕΛΗ
-- ─────────────────────────────────────────────────────────────────────────
-- Τα παλιά κλειδιά μένουν (accountantId, name, linkedAt) για όποιον τα
-- διαβάζει. Προστίθενται το γραφείο και τα μέλη που βλέπουν πράγματι τον
-- ιδιοκτήτη: ο υπεύθυνος και όσοι τον έχουν αναλάβει.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.my_accountants()
returns json
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_me uuid := auth.uid();
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object(
      'accountantId', ac.accountant_id,
      'name', coalesce(nullif(trim(bp.owner_name), ''), nullif(trim(bp.full_name), ''), 'Ο λογιστής σου'),
      'linkedAt', ac.linked_at,
      'firmId', f.id,
      'firmName', f.name,
      'firmKind', f.kind,
      'members', coalesce((
        select json_agg(json_build_object(
          'userId', m.user_id,
          'name', coalesce(nullif(trim(mbp.owner_name), ''), nullif(trim(mbp.full_name), ''), m.email),
          'role', m.role
        ) order by m.role, m.joined_at)
          from firm_members m
          left join billing_profiles mbp on mbp.user_id = m.user_id
         where m.firm_id = f.id and m.status = 'active'
           and (m.role = 'manager' or exists (
                 select 1 from firm_client_assignees fa
                  where fa.firm_id = f.id and fa.owner_id = v_me and fa.user_id = m.user_id))
      ), '[]'::json),
      'lastOpenedAt', (select max(l.at) from firm_access_log l where l.firm_id = f.id and l.owner_id = v_me)
    ) order by ac.linked_at)
    -- Ένα γραφείο, μία γραμμή: όσα μέλη κι αν διεκδίκησαν τον ίδιο σύνδεσμο.
    from (
      select distinct on (coalesce(x.firm_id::text, x.accountant_id::text)) x.*
        from accountant_clients x
       where x.owner_id = v_me and x.active
       order by coalesce(x.firm_id::text, x.accountant_id::text), x.linked_at
    ) ac
    left join billing_profiles bp on bp.user_id = ac.accountant_id
    left join firms f on f.id = ac.firm_id
  ), '[]'::json);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ΟΙ ΠΟΛΙΤΙΚΕΣ ΑΝΑΓΝΩΣΗΣ ΤΩΝ ΝΕΩΝ ΠΙΝΑΚΩΝ
-- ─────────────────────────────────────────────────────────────────────────
-- Καμία πολιτική εγγραφής: γράφουν μόνο οι συναρτήσεις παρακάτω, που
-- ελέγχουν ρόλο. Πίνακας με RLS και χωρίς πολιτική εγγραφής είναι κλειστός.
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists firms_read on public.firms;
create policy firms_read on public.firms for select
  using (id = (select private.firm_of((select auth.uid()))));

drop policy if exists firm_members_read on public.firm_members;
create policy firm_members_read on public.firm_members for select
  using (
    firm_id = (select private.firm_of((select auth.uid())))
    or user_id = (select auth.uid())
    or (status = 'invited' and lower(email) = lower(coalesce((select auth.email()), '')))
  );

drop policy if exists firm_client_assignees_read on public.firm_client_assignees;
create policy firm_client_assignees_read on public.firm_client_assignees for select
  using (
    firm_id = (select private.firm_of((select auth.uid())))
    or owner_id = (select auth.uid())
  );

-- Το ιστορικό το βλέπει ο υπεύθυνος του γραφείου και ο ιδιοκτήτης για τον
-- εαυτό του. Ο λογιστής βλέπει μόνο τις δικές του κινήσεις.
drop policy if exists firm_access_log_read on public.firm_access_log;
create policy firm_access_log_read on public.firm_access_log for select
  using (
    owner_id = (select auth.uid())
    or user_id = (select auth.uid())
    or (firm_id = (select private.firm_of((select auth.uid())))
        and (select private.firm_role((select auth.uid()), firm_id)) = 'manager')
  );

-- Το δεύτερο βήμα (20261003120000) φυλάει και τους νέους πίνακες.
drop policy if exists mfa_firms on public.firms;
create policy mfa_firms on public.firms as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_firm_members on public.firm_members;
create policy mfa_firm_members on public.firm_members as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_firm_client_assignees on public.firm_client_assignees;
create policy mfa_firm_client_assignees on public.firm_client_assignees as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));
drop policy if exists mfa_firm_access_log on public.firm_access_log;
create policy mfa_firm_access_log on public.firm_access_log as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- ═══════════════════════════════════════════════════════════════════════════
-- ΟΙ ΚΙΝΗΣΕΙΣ ΤΟΥ ΓΡΑΦΕΙΟΥ
-- ═══════════════════════════════════════════════════════════════════════════

/* Το γραφείο μου, ο ρόλος μου και τα μέλη. */
create or replace function public.my_firm()
returns json
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_firm uuid;
  v_role text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return null; end if;
  v_firm := private.firm_of(v_me);
  if v_firm is null then return null; end if;
  v_role := private.firm_role(v_me, v_firm);
  return (
    select json_build_object(
      'id', f.id, 'name', f.name, 'afm', f.afm, 'kind', f.kind,
      'phone', f.phone, 'address', f.address, 'role', v_role,
      'firmOnly', (select m.firm_only from firm_members m where m.firm_id = f.id and m.user_id = v_me and m.status = 'active'),
      'members', coalesce((
        select json_agg(json_build_object(
          'id', m.id, 'userId', m.user_id, 'email', m.email, 'role', m.role, 'status', m.status,
          'name', coalesce(nullif(trim(bp.owner_name), ''), nullif(trim(bp.full_name), '')),
          'invitedAt', m.invited_at, 'joinedAt', m.joined_at,
          'clients', (select count(*) from firm_client_assignees fa where fa.firm_id = f.id and fa.user_id = m.user_id)
        ) order by (m.status = 'invited'), m.role, coalesce(m.joined_at, m.invited_at))
          from firm_members m
          left join billing_profiles bp on bp.user_id = m.user_id
         where m.firm_id = f.id and m.status <> 'removed'
      ), '[]'::json)
    )
    from firms f where f.id = v_firm
  );
end $$;

/*
 * Δημιουργεί ή συμπληρώνει το γραφείο μου. Αν έχω ήδη γραφείο (το προσωπικό
 * της μεταφοράς ή ένα που έστησα), το ενημερώνει — μόνο ο υπεύθυνος.
 */
create or replace function public.firm_save(p_name text, p_afm text, p_kind text, p_phone text, p_address text)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_firm uuid;
  v_name text := left(btrim(coalesce(p_name, '')), 160);
  v_afm text := nullif(regexp_replace(coalesce(p_afm, ''), '\D', '', 'g'), '');
  v_kind text := coalesce(nullif(btrim(p_kind), ''), 'accounting');
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if v_name = '' then return json_build_object('ok', false, 'reason', 'name'); end if;
  if v_afm is not null and v_afm !~ '^[0-9]{9}$' then return json_build_object('ok', false, 'reason', 'afm'); end if;
  if v_kind not in ('accounting', 'tax') then return json_build_object('ok', false, 'reason', 'kind'); end if;

  v_firm := private.firm_of(v_me);
  if v_firm is null then
    v_firm := private.firm_ensure(v_me);
  elsif private.firm_role(v_me, v_firm) <> 'manager' then
    return json_build_object('ok', false, 'reason', 'not_manager');
  end if;

  update firms set name = v_name, afm = v_afm, kind = v_kind,
         phone = left(nullif(btrim(coalesce(p_phone, '')), ''), 40),
         address = left(nullif(btrim(coalesce(p_address, '')), ''), 240),
         updated_at = now()
   where id = v_firm;
  return json_build_object('ok', true, 'id', v_firm);
end $$;

/* Πρόσκληση μέλους με email. Μόνο ο υπεύθυνος. */
create or replace function public.firm_invite(p_email text, p_role text)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_firm uuid := private.firm_of(auth.uid());
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role text := coalesce(nullif(btrim(p_role), ''), 'accountant');
  v_id uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if v_firm is null or private.firm_role(v_me, v_firm) <> 'manager' then
    return json_build_object('ok', false, 'reason', 'not_manager');
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return json_build_object('ok', false, 'reason', 'email'); end if;
  if v_role not in ('manager', 'accountant', 'associate') then return json_build_object('ok', false, 'reason', 'role'); end if;

  select id into v_id from firm_members
   where firm_id = v_firm and lower(email) = v_email and status <> 'removed';
  if v_id is not null then return json_build_object('ok', true, 'id', v_id, 'existing', true); end if;

  insert into firm_members (firm_id, email, role, status, invited_by)
    values (v_firm, v_email, v_role, 'invited', v_me)
    returning id into v_id;
  return json_build_object('ok', true, 'id', v_id, 'existing', false);
end $$;

/*
 * Ο προσκεκλημένος απαντά. Αν είναι ήδη ενεργός σε άλλο γραφείο που έχει
 * πελάτες ή άλλα μέλη, η αποδοχή σταματά: οι άδειες εκείνων των ιδιοκτητών
 * δόθηκαν στο άλλο γραφείο και δεν μεταφέρονται σιωπηλά. Ένα προσωπικό
 * γραφείο χωρίς πελάτες και χωρίς άλλα μέλη απλώς κλείνει.
 */
create or replace function public.firm_invite_answer(p_id uuid, p_accept boolean)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.email(), '')));
  v_inv record;
  v_old uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null or v_email = '' then return json_build_object('ok', false, 'reason', 'anonymous'); end if;

  select * into v_inv from firm_members
   where id = p_id and status = 'invited' and lower(email) = v_email
   for update;
  if not found then return json_build_object('ok', false, 'reason', 'invalid'); end if;

  if not coalesce(p_accept, false) then
    update firm_members set status = 'removed', removed_at = now() where id = v_inv.id;
    return json_build_object('ok', true, 'status', 'declined');
  end if;

  -- Ο λογαριασμός γραφείου δεν κρατά ακίνητα ιδιοκτήτη. Όποιος έχει, μπαίνει
  -- στο γραφείο με άλλη διεύθυνση και κρατά αυτόν τον λογαριασμό για τα δικά του.
  if exists (select 1 from user_properties up where up.user_id = v_me) then
    return json_build_object('ok', false, 'reason', 'owner_account');
  end if;

  v_old := private.firm_of(v_me);
  if v_old is not null and v_old <> v_inv.firm_id then
    if exists (select 1 from accountant_clients where firm_id = v_old)
       or exists (select 1 from firm_members where firm_id = v_old and status = 'active' and user_id <> v_me) then
      return json_build_object('ok', false, 'reason', 'in_other_firm');
    end if;
    update firm_members set status = 'removed', removed_at = now()
     where firm_id = v_old and user_id = v_me and status = 'active';
    delete from firms where id = v_old
       and not exists (select 1 from firm_members where firm_id = v_old and status <> 'removed');
  end if;

  update firm_members set user_id = v_me, status = 'active', joined_at = now(), firm_only = true where id = v_inv.id;
  return json_build_object('ok', true, 'status', 'accepted', 'firmId', v_inv.firm_id);
end $$;

/* Οι προσκλήσεις που περιμένουν εμένα. */
create or replace function public.my_firm_invites()
returns json
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_email text := lower(btrim(coalesce(auth.email(), '')));
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if auth.uid() is null or v_email = '' then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object('id', m.id, 'firmName', f.name, 'role', m.role, 'invitedAt', m.invited_at)
           order by m.invited_at)
      from firm_members m join firms f on f.id = m.firm_id
     where m.status = 'invited' and lower(m.email) = v_email
  ), '[]'::json);
end $$;

/*
 * Αλλαγή ρόλου ή αφαίρεση μέλους. Μόνο ο υπεύθυνος. Ο τελευταίος υπεύθυνος δεν
 * υποβιβάζεται ούτε αφαιρείται: ένα γραφείο χωρίς υπεύθυνο δεν διοικείται.
 * Ο καθένας μπορεί να αποχωρήσει ο ίδιος, με τον ίδιο περιορισμό.
 */
create or replace function public.firm_member_update(p_id uuid, p_role text, p_remove boolean)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_m record;
  v_managers int;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;

  select * into v_m from firm_members where id = p_id and status <> 'removed' for update;
  if not found then return json_build_object('ok', false, 'reason', 'invalid'); end if;
  if private.firm_role(v_me, v_m.firm_id) is distinct from 'manager'
     and not (coalesce(p_remove, false) and v_m.user_id = v_me) then
    return json_build_object('ok', false, 'reason', 'not_manager');
  end if;

  select count(*) into v_managers from firm_members
   where firm_id = v_m.firm_id and status = 'active' and role = 'manager';

  if coalesce(p_remove, false) then
    if v_m.role = 'manager' and v_m.status = 'active' and v_managers <= 1 then
      return json_build_object('ok', false, 'reason', 'last_manager');
    end if;
    update firm_members set status = 'removed', removed_at = now() where id = v_m.id;
    delete from firm_client_assignees where firm_id = v_m.firm_id and user_id = v_m.user_id;
    return json_build_object('ok', true, 'status', 'removed');
  end if;

  if coalesce(p_role, '') not in ('manager', 'accountant', 'associate') then
    return json_build_object('ok', false, 'reason', 'role');
  end if;
  if v_m.role = 'manager' and p_role <> 'manager' and v_m.status = 'active' and v_managers <= 1 then
    return json_build_object('ok', false, 'reason', 'last_manager');
  end if;
  update firm_members set role = p_role where id = v_m.id;
  return json_build_object('ok', true, 'status', 'updated');
end $$;

/* Ανάθεση πελατών σε μέλος, ή αφαίρεση ανάθεσης. Μόνο ο υπεύθυνος. */
create or replace function public.firm_assign(p_owners uuid[], p_user uuid, p_on boolean)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_firm uuid := private.firm_of(auth.uid());
  v_n int := 0;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if v_firm is null or private.firm_role(v_me, v_firm) <> 'manager' then
    return json_build_object('ok', false, 'reason', 'not_manager');
  end if;
  if private.firm_role(p_user, v_firm) is null then
    return json_build_object('ok', false, 'reason', 'not_member');
  end if;

  if coalesce(p_on, false) then
    insert into firm_client_assignees (firm_id, owner_id, user_id, assigned_by)
      select v_firm, o, p_user, v_me
        from unnest(coalesce(p_owners, '{}'::uuid[])) as o
       where exists (select 1 from accountant_clients ac where ac.firm_id = v_firm and ac.owner_id = o)
    on conflict do nothing;
    get diagnostics v_n = row_count;
  else
    delete from firm_client_assignees
     where firm_id = v_firm and user_id = p_user and owner_id = any(coalesce(p_owners, '{}'::uuid[]));
    get diagnostics v_n = row_count;
  end if;
  return json_build_object('ok', true, 'changed', v_n);
end $$;

/*
 * Ανοίγει πελάτη από τον χώρο του γραφείου: επιστρέφει το τρέχον token της
 * κατάστασης και γράφει στο ιστορικό ποιος το άνοιξε.
 */
create or replace function public.firm_open_client(p_owner uuid)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_firm uuid := private.firm_of(auth.uid());
  v_token text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if not private.firm_reads_owner(v_me, p_owner) then
    return json_build_object('ok', false, 'reason', 'not_linked');
  end if;
  select al.token into v_token from accountant_links al
   where al.user_id = p_owner and al.active and (al.expires_at is null or al.expires_at > now())
   limit 1;
  if v_token is null then return json_build_object('ok', false, 'reason', 'no_link'); end if;
  if v_firm is not null then
    insert into firm_access_log (firm_id, user_id, owner_id, action) values (v_firm, v_me, p_owner, 'open');
  end if;
  return json_build_object('ok', true, 'token', v_token);
end $$;

/* Το ιστορικό του γραφείου, για τον υπεύθυνο. Τα τελευταία 200. */
create or replace function public.firm_access_history(p_limit int default 200)
returns json
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_firm uuid := private.firm_of(auth.uid());
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null or v_firm is null or private.firm_role(v_me, v_firm) <> 'manager' then return '[]'::json; end if;
  return coalesce((
    select json_agg(x order by (x->>'at') desc) from (
      select json_build_object(
        'at', l.at, 'action', l.action, 'ownerId', l.owner_id,
        'member', coalesce(nullif(trim(mbp.owner_name), ''), nullif(trim(mbp.full_name), ''), m.email),
        'owner', coalesce(nullif(trim(obp.owner_name), ''), nullif(trim(obp.full_name), ''), 'Ιδιοκτήτης')
      ) as x
        from firm_access_log l
        left join firm_members m on m.firm_id = l.firm_id and m.user_id = l.user_id
        left join billing_profiles mbp on mbp.user_id = l.user_id
        left join billing_profiles obp on obp.user_id = l.owner_id
       where l.firm_id = v_firm
       order by l.at desc
       limit least(greatest(coalesce(p_limit, 200), 1), 500)
    ) s
  ), '[]'::json);
end $$;

/*
 * Ο υπεύθυνος βγάζει πελάτη από τη λίστα του γραφείου (τακτοποίηση, όχι
 * ανάκληση: η ανάκληση ανήκει στον ιδιοκτήτη). Σβήνει τις άδειες του
 * γραφείου για αυτόν τον ιδιοκτήτη και τις αναθέσεις του.
 */
create or replace function public.firm_drop_client(p_owner uuid)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_firm uuid := private.firm_of(auth.uid());
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null or v_firm is null or private.firm_role(v_me, v_firm) <> 'manager' then
    return json_build_object('ok', false, 'reason', 'not_manager');
  end if;
  delete from accountant_clients where firm_id = v_firm and owner_id = p_owner;
  delete from firm_client_assignees where firm_id = v_firm and owner_id = p_owner;
  return json_build_object('ok', true);
end $$;

/*
 * Ο ιδιοκτήτης κόβει ΕΝΑ γραφείο χωρίς να περιστρέψει τον σύνδεσμό του (που
 * θα έκοβε και όλα τα άλλα). Οι αναθέσεις φεύγουν μαζί.
 */
create or replace function public.owner_revoke_firm(p_firm uuid)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_me uuid := auth.uid();
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  delete from accountant_clients where owner_id = v_me and firm_id = p_firm;
  delete from firm_client_assignees where owner_id = v_me and firm_id = p_firm;
  return json_build_object('ok', true);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §6. Ο ΛΟΓΑΡΙΑΣΜΟΣ ΓΡΑΦΕΙΟΥ ΔΕΝ ΚΑΤΑΧΩΡΕΙ ΑΚΙΝΗΤΑ
-- ─────────────────────────────────────────────────────────────────────────
-- Απόφαση του ιδιοκτήτη (04/11/2026): «δεν μπορούν να καταχωρούν με τον
-- λογαριασμό αυτό ακίνητα ως γραφείο». Επιβάλλεται εδώ, όχι στην οθόνη: μία
-- σκανδάλη πριν από κάθε εισαγωγή στα δεδομένα ιδιοκτήτη. Ο ιδιοκτήτης δεν
-- αγγίζεται (δεν είναι μέλος γραφείου). Ο λογιστής που είχε ήδη δικά του
-- ακίνητα στη μεταφορά έχει `firm_only = false` και συνεχίζει όπως πριν.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function private.is_firm_only(p_user uuid)
returns boolean
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select p_user is not null and exists (
    select 1 from public.firm_members m
     where m.user_id = p_user and m.status = 'active' and m.firm_only);
$$;

create or replace function private.firm_only_blocks_owner_data()
returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if private.is_firm_only(new.user_id) then
    raise exception 'firm_account' using errcode = '42501',
      hint = 'Ο λογαριασμός γραφείου βλέπει τους πελάτες του. Ακίνητα καταχωρεί ο ιδιοκτήτης.';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['user_properties', 'tenants', 'expenses', 'property_documents', 'rent_payments', 'client_stays'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_firm_only', t);
      execute format('create trigger %I before insert on public.%I for each row execute function private.firm_only_blocks_owner_data()', t || '_firm_only', t);
    end if;
  end loop;
end $$;

-- ── ΔΙΚΑΙΩΜΑΤΑ ─────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.my_firm()',
    'public.firm_save(text, text, text, text, text)',
    'public.firm_invite(text, text)',
    'public.firm_invite_answer(uuid, boolean)',
    'public.my_firm_invites()',
    'public.firm_member_update(uuid, text, boolean)',
    'public.firm_assign(uuid[], uuid, boolean)',
    'public.firm_open_client(uuid)',
    'public.firm_access_history(int)',
    'public.firm_drop_client(uuid)',
    'public.owner_revoke_firm(uuid)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  foreach f in array array[
    'private.firm_of(uuid)',
    'private.firm_role(uuid, uuid)',
    'private.firm_sees_owner(uuid, uuid, boolean)',
    'private.firm_reads_owner(uuid, uuid)',
    'private.firm_ensure(uuid)',
    'private.accountant_clients_firm()',
    'private.accountant_clients_assign()',
    'private.firm_members_gone()',
    'private.is_firm_only(uuid)',
    'private.firm_only_blocks_owner_data()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
  end loop;
  execute 'grant execute on function private.firm_of(uuid) to authenticated';
  execute 'grant execute on function private.firm_role(uuid, uuid) to authenticated';
  execute 'grant execute on function private.firm_reads_owner(uuid, uuid) to authenticated';
end $$;
