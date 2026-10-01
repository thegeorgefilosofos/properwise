-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ Ε2 ΤΗΣ ΑΑΔΕ ΜΕΝΕΙ, ΚΑΙ Ο ΦΑΚΕΛΟΣ ΦΤΑΝΕΙ ΣΤΟΝ ΛΟΓΙΣΤΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΓΙΑΤΙ ΑΓΓΙΖΕΤΑΙ ΤΟ supabase/migrations. Ζητήθηκε ρητά η λειτουργία «σύγκριση
-- με το προσυμπληρωμένο Ε2 και ένας φάκελος ανά ΑΦΜ και έτος για τον λογιστή».
-- Χωρίς αυτούς τους δύο πίνακες η σύγκριση γίνεται με ποσά που πληκτρολογούνται
-- και χάνονται όταν κλείσει η οθόνη (E2ReconcileCard: αποθηκευόταν μόνο ο ΑΤΑΚ)
-- και ο λογιστής δεν βλέπει ποτέ αν ο πελάτης του έχει έτοιμο φάκελο.
--
-- ΤΙ ΠΡΟΣΤΙΘΕΤΑΙ. ΜΟΝΟ ΠΡΟΣΘΕΤΙΚΑ: δύο πίνακες, δύο βοηθοί πολιτικής, μία
-- συνάρτηση αντικατάστασης γραμμών, δύο πολιτικές αποθήκευσης για τον λογιστή
-- και πεδία παραπάνω στη λίστα πελατών του. Τίποτα υπάρχον δεν σβήνεται.
--
--   1. `e2_prefilled`: οι γραμμές του Πίνακα I όπως τις έδειξε η ΑΑΔΕ, ανά
--      ιδιοκτήτη, φορολογικό έτος και ΑΦΜ υπόχρεου. Τις ανεβάζει ο ιδιοκτήτης
--      ή ο λογιστής του. Το `uploaded_by` το γράφει η βάση, όχι ο πελάτης.
--   2. `accountant_packs`: η κατάσταση του φακέλου ανά ΑΦΜ και έτος (πόσες
--      διαφορές έχει η σύγκριση, τι λείπει) και, όταν ο ιδιοκτήτης τον στείλει,
--      το αρχείο του. Ο λογιστής δεν διαβάζει τα δεδομένα του ιδιοκτήτη: παίρνει
--      ΜΟΝΟ τον φάκελο που ο ιδιοκτήτης έφτιαξε και έστειλε ο ίδιος.
--
-- ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΙ. Ο ιδιοκτήτης τα δικά του. Ο λογιστής ΜΟΝΟ όσο ισχύει η
-- σύνδεσή του (`accountant_link_live`, 20260818090000): η περιστροφή του
-- συνδέσμου από τον ιδιοκτήτη τον κόβει και από εδώ. Ο ανώνυμος τίποτα: ούτε
-- πίνακας, ούτε συνάρτηση, ούτε αρχείο. Αποδεικνύεται στο scripts/db/rls-probe.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ΟΙ ΓΡΑΜΜΕΣ ΤΟΥ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟΥ ────────────────────────────────────
create table if not exists public.e2_prefilled (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  tax_year         integer not null check (tax_year between 2000 and 2100),
  owner_afm        text not null check (owner_afm ~ '^[0-9]{9}$'),
  row_no           integer check (row_no is null or row_no > 0),
  atak             text check (atak is null or atak ~ '^[0-9]{11}$'),
  address          text check (address is null or char_length(address) <= 300),
  category         text check (category is null or char_length(category) <= 120),
  tenant_name      text check (tenant_name is null or char_length(tenant_name) <= 200),
  -- Το ΑΦΜ του μισθωτή όπως το γράφει η ΑΑΔΕ, ΚΑΙ όταν το ψηφίο ελέγχου δεν
  -- ταιριάζει: η σύγκριση πρέπει να μπορεί να πει «το ΑΦΜ στο myAADE είναι λάθος».
  tenant_afm       text check (tenant_afm is null or tenant_afm ~ '^[0-9]{9}$'),
  lease_from       date,
  lease_to         date,
  months           smallint check (months is null or months between 0 and 12),
  monthly_rent     numeric(12,2) check (monthly_rent is null or monthly_rent >= 0),
  ownership_pct    numeric(5,2) check (ownership_pct is null or (ownership_pct > 0 and ownership_pct <= 100)),
  gross            numeric(12,2) not null default 0 check (gross >= 0),
  -- Σε ποια στήλη του εντύπου είναι το ποσό: 13 εκμίσθωση, 14 δωρεάν
  -- παραχώρηση, 15 ιδιοχρησιμοποίηση, 16 ανείσπρακτα.
  income_column    smallint not null default 13 check (income_column in (13, 14, 15, 16)),
  lease_decl_ref   text check (lease_decl_ref is null or char_length(lease_decl_ref) <= 40),
  source           text not null check (source in ('pdf', 'paste', 'manual')),
  uploaded_by      text not null default 'owner' check (uploaded_by in ('owner', 'accountant')),
  uploaded_by_user uuid references auth.users(id) on delete set null,
  -- Το πρωτότυπο αρχείο, στον φάκελο του ιδιοκτήτη: <ιδιοκτήτης>/aade-e2/<έτος>/…
  source_file      text check (source_file is null or char_length(source_file) <= 400),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint e2_prefilled_period_chk check (lease_from is null or lease_to is null or lease_from <= lease_to)
);

create index if not exists e2_prefilled_owner_year_idx on public.e2_prefilled (user_id, tax_year, owner_afm);
-- Το ξένο κλειδί θέλει ευρετήριο: η διαγραφή χρήστη το σαρώνει (ON DELETE SET NULL).
create index if not exists e2_prefilled_uploaded_by_user_idx on public.e2_prefilled (uploaded_by_user);

comment on table public.e2_prefilled is
  'Οι γραμμές του Πίνακα I του προσυμπληρωμένου Ε2 της ΑΑΔΕ, ανά ιδιοκτήτη, φορολογικό έτος και ΑΦΜ υπόχρεου. Τις ανεβάζει ο ιδιοκτήτης ή ο συνδεδεμένος λογιστής του (PDF, επικόλληση ή χειροκίνητα) και τις συγκρίνει το lib/billing/e2Reconcile.ts με το Ε2 της εφαρμογής.';
comment on column public.e2_prefilled.uploaded_by is
  'owner | accountant. Το γράφει η σκανδάλη από το auth.uid(), όχι ο πελάτης.';

-- ── 2. Ο ΦΑΚΕΛΟΣ ΑΝΑ ΑΦΜ ΚΑΙ ΕΤΟΣ ────────────────────────────────────────
create table if not exists public.accountant_packs (
  user_id          uuid not null references auth.users(id) on delete cascade,
  tax_year         integer not null check (tax_year between 2000 and 2100),
  owner_afm        text not null check (owner_afm ~ '^[0-9]{9}$'),
  -- Η σύγκριση με το προσυμπληρωμένο: null = δεν έχει γίνει ακόμη.
  aade_differences integer check (aade_differences is null or aade_differences >= 0),
  aade_checked_at  timestamptz,
  -- «Τι λείπει»: πόσα και τα πρώτα πέντε, όπως τα λέει ο φάκελος.
  missing_count    integer not null default 0 check (missing_count >= 0),
  missing_top      text[] not null default '{}' check (cardinality(missing_top) <= 5),
  -- Το αρχείο που έστειλε ο ιδιοκτήτης: <ιδιοκτήτης>/accountant-pack/<έτος>/…
  file_path        text check (file_path is null or char_length(file_path) <= 400),
  size_bytes       bigint check (size_bytes is null or size_bytes >= 0),
  shared_at        timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (user_id, tax_year, owner_afm)
);

comment on table public.accountant_packs is
  'Ο φάκελος για τον λογιστή ανά ΑΦΜ και φορολογικό έτος: διαφορές με το προσυμπληρωμένο, τι λείπει και, όταν σταλεί, το αρχείο του. Ο λογιστής το βλέπει μόνο μέσω της accountant_clients_overview.';

-- ── 3. ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΟΝ ΙΔΙΟΚΤΗΤΗ ─────────────────────────────────────────
-- Βοηθοί πολιτικής: στο `private`, όπου δεν φτάνει διαδρομή HTTP (20260812160000).
create schema if not exists private;

create or replace function private.sees_owner(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select p_owner is not null and (
    p_owner = auth.uid()
    or public.accountant_link_live(auth.uid(), p_owner)
  );
$$;

comment on function private.sees_owner(uuid) is
  'Ο ίδιος ο ιδιοκτήτης ή λογιστής με ζωντανή σύνδεση μαζί του. Ενας κανόνας για τον πίνακα του προσυμπληρωμένου και για τα αρχεία του.';

-- Το αρχείο του φακέλου: μόνο οι δύο υποφάκελοι που δημιουργεί αυτή η
-- λειτουργία, ποτέ τα υπόλοιπα έγγραφα του ιδιοκτήτη (μισθωτήρια, ταυτότητες).
create or replace function private.accountant_sees_file(p_name text, p_write boolean)
returns boolean
language plpgsql
stable
security definer
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
  return public.accountant_link_live(auth.uid(), v_owner);
end $$;

revoke all on function private.sees_owner(uuid) from public;
revoke all on function private.accountant_sees_file(text, boolean) from public;
grant execute on function private.sees_owner(uuid) to anon, authenticated, service_role;
grant execute on function private.accountant_sees_file(text, boolean) to anon, authenticated, service_role;

-- ── 4. RLS ──────────────────────────────────────────────────────────────
alter table public.e2_prefilled enable row level security;
alter table public.accountant_packs enable row level security;

drop policy if exists e2_prefilled_read on public.e2_prefilled;
create policy e2_prefilled_read on public.e2_prefilled for select to authenticated
  using (private.sees_owner(user_id));
drop policy if exists e2_prefilled_insert on public.e2_prefilled;
create policy e2_prefilled_insert on public.e2_prefilled for insert to authenticated
  with check (private.sees_owner(user_id));
drop policy if exists e2_prefilled_update on public.e2_prefilled;
create policy e2_prefilled_update on public.e2_prefilled for update to authenticated
  using (private.sees_owner(user_id)) with check (private.sees_owner(user_id));
drop policy if exists e2_prefilled_delete on public.e2_prefilled;
create policy e2_prefilled_delete on public.e2_prefilled for delete to authenticated
  using (private.sees_owner(user_id));

-- Ο φάκελος είναι του ιδιοκτήτη. Ο λογιστής τον βλέπει μέσα από τη λίστα του.
drop policy if exists accountant_packs_own on public.accountant_packs;
create policy accountant_packs_own on public.accountant_packs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.e2_prefilled from anon;
revoke all on table public.accountant_packs from anon;
grant select, insert, update, delete on table public.e2_prefilled to authenticated;
grant select, insert, update, delete on table public.accountant_packs to authenticated;
grant all on table public.e2_prefilled to service_role;
grant all on table public.accountant_packs to service_role;

-- ── 5. ΤΟ uploaded_by ΤΟ ΓΡΑΦΕΙ Η ΒΑΣΗ ───────────────────────────────────
create or replace function public.e2_prefilled_stamp()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  if auth.uid() is not null then
    new.uploaded_by_user := auth.uid();
    new.uploaded_by := case when new.user_id = auth.uid() then 'owner' else 'accountant' end;
  end if;
  return new;
end $$;

revoke all on function public.e2_prefilled_stamp() from public, anon, authenticated;

drop trigger if exists e2_prefilled_stamp on public.e2_prefilled;
create trigger e2_prefilled_stamp before insert or update on public.e2_prefilled
  for each row execute function public.e2_prefilled_stamp();

drop trigger if exists e2_prefilled_updated_at on public.e2_prefilled;
create trigger e2_prefilled_updated_at before update on public.e2_prefilled
  for each row execute function public.update_updated_at_column();
drop trigger if exists accountant_packs_updated_at on public.accountant_packs;
create trigger accountant_packs_updated_at before update on public.accountant_packs
  for each row execute function public.update_updated_at_column();

-- ── 6. ΑΝΤΙΚΑΤΑΣΤΑΣΗ ΟΛΟΚΛΗΡΗΣ ΤΗΣ ΚΑΤΑΣΤΑΣΗΣ, ΣΕ ΜΙΑ ΣΥΝΑΛΛΑΓΗ ────────────
-- Ενα νέο ανέβασμα ΑΝΤΙΚΑΘΙΣΤΑ τις γραμμές του ίδιου ΑΦΜ και έτους. Σβήσιμο
-- και εισαγωγή από τον browser σε δύο κλήσεις θα άφηναν, σε αποτυχία της
-- δεύτερης, το προσυμπληρωμένο ΑΔΕΙΟ, που η σύγκριση θα διάβαζε «δεν
-- ανέβηκε». Εδώ είναι όλα ή τίποτα. SECURITY INVOKER: ισχύουν οι πολιτικές
-- από πάνω, οπότε ο λογιστής χωρίς ζωντανή σύνδεση δεν γράφει τίποτα.
create or replace function public.e2_prefilled_replace(
  p_owner uuid, p_year integer, p_owner_afm text, p_source text, p_file text, p_rows jsonb
)
returns integer
language plpgsql
security invoker
set search_path = 'public', 'pg_temp'
as $$
declare
  v_n integer;
begin
  if not private.sees_owner(p_owner) then
    raise exception 'not_linked' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'bad_rows' using errcode = '22023';
  end if;

  delete from e2_prefilled where user_id = p_owner and tax_year = p_year and owner_afm = p_owner_afm;

  insert into e2_prefilled (
    user_id, tax_year, owner_afm, row_no, atak, address, category, tenant_name, tenant_afm,
    lease_from, lease_to, months, monthly_rent, ownership_pct, gross, income_column,
    lease_decl_ref, source, source_file
  )
  select p_owner, p_year, p_owner_afm, r.row_no, nullif(r.atak, ''), nullif(r.address, ''),
         nullif(r.category, ''), nullif(r.tenant_name, ''), nullif(r.tenant_afm, ''),
         r.lease_from, r.lease_to, r.months, r.monthly_rent, r.ownership_pct,
         coalesce(r.gross, 0), coalesce(r.income_column, 13), nullif(r.lease_decl_ref, ''),
         p_source, nullif(p_file, '')
    from jsonb_to_recordset(p_rows) as r(
      row_no integer, atak text, address text, category text, tenant_name text, tenant_afm text,
      lease_from date, lease_to date, months smallint, monthly_rent numeric, ownership_pct numeric,
      gross numeric, income_column smallint, lease_decl_ref text
    );
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.e2_prefilled_replace(uuid, integer, text, text, text, jsonb) from public, anon;
grant execute on function public.e2_prefilled_replace(uuid, integer, text, text, text, jsonb) to authenticated;

comment on function public.e2_prefilled_replace(uuid, integer, text, text, text, jsonb) is
  'Αντικαθιστά σε μία συναλλαγή τις γραμμές του προσυμπληρωμένου ενός ΑΦΜ για ένα έτος. Τρέχει με τα δικαιώματα του καλούντα: ιδιοκτήτης ή λογιστής με ζωντανή σύνδεση.';

-- ── 7. ΤΑ ΑΡΧΕΙΑ: Ο ΛΟΓΙΣΤΗΣ ΑΝΕΒΑΖΕΙ ΤΟ PDF ΤΗΣ ΑΑΔΕ, ΔΙΑΒΑΖΕΙ ΤΟΝ ΦΑΚΕΛΟ ──
-- Ο ιδιοκτήτης έχει ήδη τον φάκελό του (00000000000001_platform_storage).
drop policy if exists property_files_accountant_read on storage.objects;
create policy property_files_accountant_read on storage.objects for select to authenticated
  using (bucket_id = 'property-files' and private.accountant_sees_file(name, false));
drop policy if exists property_files_accountant_upload on storage.objects;
create policy property_files_accountant_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'property-files' and private.accountant_sees_file(name, true));

-- ── 8. Η ΛΙΣΤΑ ΤΟΥ ΛΟΓΙΣΤΗ ΜΑΘΑΙΝΕΙ ΤΟΝ ΦΑΚΕΛΟ ΚΑΙ ΤΗ ΣΥΓΚΡΙΣΗ ──────────────
-- Η τελευταία γραφή ήταν στο 20260925190000_idioktitis_dorean_noa_4_99.sql.
-- Ιδια πεδία, ίδια φίλτρα, συν το `e2`: πόσες γραμμές του προσυμπληρωμένου
-- υπάρχουν, πότε άλλαξαν τελευταία και ο φάκελος ανά ΑΦΜ. Ποσά δεν φεύγουν.
create or replace function public.accountant_clients_overview(p_year integer)
returns json
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_rows json;
begin
  if v_me is null then return '[]'::json; end if;

  select coalesce(json_agg(r order by r->>'name'), '[]'::json) into v_rows from (
    select json_build_object(
      'ownerId',      ac.owner_id,
      'name',         coalesce(nullif(trim(bp.owner_name), ''), nullif(trim(bp.full_name), ''), 'Ιδιοκτήτης'),
      'afm',          bp.afm,
      'linkedAt',     ac.linked_at,
      'token',        (select al.token from accountant_links al
                        where al.user_id = ac.owner_id
                          and coalesce(al.active, true)
                          and (al.expires_at is null or al.expires_at > now())
                        limit 1),
      'lastActivity', (
        select max(t) from (
          select max(e.created_at) as t from expenses e where e.user_id = ac.owner_id
          union all
          select max(rp.created_at) from rent_payments rp where rp.user_id = ac.owner_id
          union all
          select max(s.created_at) from client_stays s where s.user_id = ac.owner_id
          union all
          select max(d.created_at) from property_documents d where d.user_id = ac.owner_id
        ) moves
      ),
      'requests', coalesce((
        select json_agg(json_build_object(
          'id', ar.id, 'item', ar.item, 'note', ar.note, 'createdAt', ar.created_at
        ) order by ar.created_at)
        from accountant_requests ar
        where ar.owner_id = ac.owner_id and ar.accountant_id = v_me and ar.status = 'open'
      ), '[]'::json),
      'properties',   (select count(*) from user_properties up where up.user_id = ac.owner_id),
      'expenses',     (select count(*) from expenses e
                        where e.user_id = ac.owner_id and extract(year from e.date) = p_year),
      'uncategorised',(select count(*) from expenses e
                        where e.user_id = ac.owner_id and extract(year from e.date) = p_year
                          and coalesce(nullif(trim(e.category), ''), '') = ''),
      'noSupplierAfm',(select count(*) from expenses e
                        where e.user_id = ac.owner_id and extract(year from e.date) = p_year
                          and coalesce(nullif(trim(e.supplier_afm), ''), '') = ''),
      'rentsUnpaid',  (select count(*) from rent_payments rp
                        where rp.user_id = ac.owner_id and rp.period_year = p_year and rp.paid is not true),
      'stays',        (select count(*) from client_stays s
                        where s.user_id = ac.owner_id
                          and extract(year from coalesce(s.check_in, s.check_out)) = p_year),
      'staysNoFee',   (select count(*) from client_stays s
                        where s.user_id = ac.owner_id
                          and extract(year from coalesce(s.check_in, s.check_out)) = p_year
                          and s.channel in ('airbnb', 'booking')
                          and coalesce(s.platform_fee, 0) <= 0),
      'openRequests', (select count(*) from accountant_requests ar
                        where ar.owner_id = ac.owner_id and ar.accountant_id = v_me and ar.status = 'open'),
      -- ΤΟ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟ ΚΑΙ Ο ΦΑΚΕΛΟΣ. Πλήθη, ημερομηνίες και η διαδρομή του
      -- αρχείου που έστειλε ο ίδιος ο ιδιοκτήτης. Κανένα ποσό, κανένας μισθωτής.
      'e2', json_build_object(
        'aadeRows',      (select count(*) from e2_prefilled ep
                           where ep.user_id = ac.owner_id and ep.tax_year = p_year),
        'aadeChangedAt', (select max(ep.updated_at) from e2_prefilled ep
                           where ep.user_id = ac.owner_id and ep.tax_year = p_year),
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
          where pk.user_id = ac.owner_id and pk.tax_year = p_year
        ), '[]'::json)
      )
    ) as r
    from accountant_clients ac
    left join billing_profiles bp on bp.user_id = ac.owner_id
    -- Η αξίωση ισχύει μόνο όσο το token με το οποίο δόθηκε είναι ακόμη ο
    -- ενεργός σύνδεσμος του ιδιοκτήτη (20260818090000).
    where ac.accountant_id = v_me
      and public.accountant_link_live(v_me, ac.owner_id)
      -- Η ΚΛΕΙΔΑΡΙΑ ΤΟΥ ΒΑΘΜΟΥ 1 ΕΦΥΓΕ ΜΑΖΙ ΜΕ ΤΗΣ `get_accountant_data`: ο
      -- δωρεάν «Ιδιοκτήτης» στέλνει κι αυτός τον φάκελο στον λογιστή του.
  ) sub;

  return v_rows;
end;
$$;

alter function public.accountant_clients_overview(integer) owner to postgres;
revoke all    on function public.accountant_clients_overview(integer) from public, anon;
grant execute on function public.accountant_clients_overview(integer) to authenticated;

comment on function public.accountant_clients_overview(integer) is
  'Οι πελάτες του λογιστή για μια χρήση: οι μετρητές που δείχνουν τι λείπει, το τρέχον αναγνωριστικό της κατάστασης, πότε κινήθηκε τελευταία φορά ο φάκελος, τα ανοιχτά αιτήματα ολόκληρα και η κατάσταση του προσυμπληρωμένου Ε2 και του φακέλου ανά ΑΦΜ.';
