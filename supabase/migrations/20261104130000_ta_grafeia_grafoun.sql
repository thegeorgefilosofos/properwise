-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΑ ΓΡΑΦΕΙΑ ΓΡΑΦΟΥΝ ΜΟΝΟ ΟΣΟ ΤΟΥΣ ΕΠΙΤΡΕΠΕΙ Ο ΙΔΙΟΚΤΗΤΗΣ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΖΗΤΗΘΗΚΕ. Ο ιδιοκτήτης του προϊόντος (04/11/2026): ο πελάτης φέρνει στο
-- γραφείο χαρτιά (αποδείξεις, λογαριασμούς, δόσεις φόρων και δανείων, στοιχεία
-- μισθωτών) και το γραφείο τα περνά στον λογαριασμό του. Τρία επίπεδα, που τα
-- διαλέγει ο ιδιοκτήτης ανά γραφείο:
--
--   read    «Μόνο ανάγνωση» (προεπιλογή, όπως στο 20261104120000).
--   upload  «Ανέβασμα παραστατικών»: μόνο αρχεία στον φάκελο υπάρχοντος
--           ακινήτου. Η ανάγνωση της σάρωσης μένει πρόταση για τον ιδιοκτήτη.
--   keep    «Τήρηση για λογαριασμό μου»: παραστατικά, μισθωτές, πληρωμένοι
--           λογαριασμοί, εισπράξεις ενοικίου, δόσεις φόρων και δανείου
--           (σημείωση πληρωμής στη δόση του ημερολογίου, όπως το «Πλήρωσα»),
--           όλα σε ΥΠΑΡΧΟΝΤΑ ακίνητα.
--
-- ΜΙΑ ΠΟΡΤΑ, ΟΧΙ ΠΕΝΤΕ. Οι πολιτικές RLS του ιδιοκτήτη ΔΕΝ αλλάζουν και το
-- γραφείο δεν αποκτά ούτε ανάγνωση ούτε εγγραφή στους πίνακές του. Γράφει μόνο
-- από τις συναρτήσεις αυτού του αρχείου, γιατί:
--   · η RLS κρίνει γραμμές, όχι στήλες· εδώ χρειάζεται «μισθωτή ναι, ακίνητο
--     όχι», «πληρωμή σε λογαριασμό ναι, ποσό του λογαριασμού όχι»·
--   · κάθε αλλαγή γράφεται με το πριν και το μετά (`firm_record_log`), που
--     τροφοδοτεί τη σύνοψη της ημέρας και την «Αναίρεση όλων»·
--   · ο σύνδεσμος ανάγνωσης (`accountant_links`) δεν δίνει ποτέ εγγραφή: κάθε
--     συνάρτηση ζητά συνδεδεμένο μέλος, γραφείο, ρόλο, ανάθεση και επίπεδο.
--
-- ΣΕ ΚΑΘΕ ΕΠΙΠΕΔΟ ΑΠΑΓΟΡΕΥΕΤΑΙ: ακίνητο (νέο, διαγραφή, βασικά στοιχεία),
-- ρυθμίσεις, πακέτο, χρέωση, μέλη, προσβάσεις, σύνδεσμοι· αλλαγή ή διαγραφή
-- εγγραφών του ιδιοκτήτη ή άλλου γραφείου· νέο δάνειο ή νέα υποχρέωση (ο
-- λογαριασμός που γράφει το γραφείο είναι ΠΑΝΤΑ πληρωμένος, η δαπάνη ΠΑΝΤΑ
-- εξοφλημένη, χωρίς επανάληψη ή δόσεις)· έγγραφα προς τρίτους.
--
-- Ο ΣΥΝΕΡΓΑΤΗΣ ΜΕΝΕΙ ΣΤΗΝ ΑΝΑΓΝΩΣΗ σε κάθε επίπεδο: κάθε έλεγχος περνά από το
-- `private.firm_sees_owner(…, true)`, που ζητά ρόλο υπεύθυνου ή λογιστή.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ΤΟ ΕΠΙΠΕΔΟ, ΑΝΑ ΓΡΑΦΕΙΟ ──────────────────────────────────────────────
alter table public.accountant_clients add column if not exists access_level text not null default 'read';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accountant_clients_level_chk') then
    alter table public.accountant_clients add constraint accountant_clients_level_chk
      check (access_level in ('read', 'upload', 'keep'));
  end if;
end $$;

-- Το ιστορικό πρόσβασης μαθαίνει και την καταχώρηση («record»).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'firm_access_log_action_chk2') then
    alter table public.firm_access_log drop constraint if exists firm_access_log_action_chk;
    alter table public.firm_access_log add constraint firm_access_log_action_chk2
      check (action in ('open', 'export', 'request', 'upload', 'record'));
  end if;
end $$;

-- ── 2. Η ΠΡΟΕΛΕΥΣΗ ΤΩΝ ΕΓΓΡΑΦΩΝ ─────────────────────────────────────────────
-- «Από <γραφείο> · <μέλος>». Τη γράφουν μόνο οι συναρτήσεις του αρχείου.
do $$
declare t text;
begin
  foreach t in array array['property_documents', 'tenants', 'bills', 'rent_payments', 'expenses'] loop
    execute format('alter table public.%I add column if not exists firm_id uuid references public.firms(id) on delete set null', t);
    execute format('alter table public.%I add column if not exists created_by_member uuid references auth.users(id) on delete set null', t);
    execute format('create index if not exists %I on public.%I (firm_id) where firm_id is not null', t || '_firm_idx', t);
    execute format('create index if not exists %I on public.%I (created_by_member) where created_by_member is not null', t || '_member_idx', t);
  end loop;
end $$;

/*
 * Κανένας πελάτης (ρόλος authenticated ή anon) δεν γράφει ούτε αλλάζει την
 * προέλευση. Μέσα σε SECURITY DEFINER ο `current_user` είναι ο ιδιοκτήτης της
 * συνάρτησης, οπότε μόνο οι συναρτήσεις του αρχείου περνούν. Το `set_config`
 * δεν φτάνει στον περιηγητή, άρα δεν υπάρχει διακόπτης να γυρίσει κανείς.
 */
create or replace function private.firm_provenance_guard()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.firm_id is not null or new.created_by_member is not null then
      raise exception 'firm_provenance' using errcode = '42501';
    end if;
  elsif new.firm_id is distinct from old.firm_id or new.created_by_member is distinct from old.created_by_member then
    raise exception 'firm_provenance' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['property_documents', 'tenants', 'bills', 'rent_payments', 'expenses'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_firm_provenance', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.firm_provenance_guard()', t || '_firm_provenance', t);
  end loop;
end $$;

-- ── 3. ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΤΩΝ ΚΙΝΗΣΕΩΝ ΤΟΥ ΓΡΑΦΕΙΟΥ ───────────────────────────
create table if not exists public.firm_record_log (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  member_id    uuid references auth.users(id) on delete set null,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  property_id  uuid,
  kind         text not null,
  table_name   text not null,
  row_id       uuid not null,
  action       text not null,
  before       jsonb,
  after        jsonb,
  at           timestamptz not null default now(),
  undone_at    timestamptz
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'firm_record_log_action_chk') then
    alter table public.firm_record_log add constraint firm_record_log_action_chk
      check (action in ('insert', 'update', 'delete', 'mark_paid', 'revert'));
  end if;
end $$;
create index if not exists firm_record_log_owner_idx  on public.firm_record_log (owner_id, at desc);
create index if not exists firm_record_log_firm_idx   on public.firm_record_log (firm_id, at desc);
create index if not exists firm_record_log_member_idx on public.firm_record_log (member_id);
create index if not exists firm_record_log_row_idx    on public.firm_record_log (table_name, row_id);

alter table public.firm_record_log enable row level security;

drop policy if exists firm_record_log_read on public.firm_record_log;
create policy firm_record_log_read on public.firm_record_log for select
  using (
    owner_id = (select auth.uid())
    or member_id = (select auth.uid())
    or (firm_id = (select private.firm_of((select auth.uid())))
        and (select private.firm_role((select auth.uid()), firm_id)) = 'manager')
  );
-- Κανείς δεν γράφει από τον περιηγητή: μόνο οι συναρτήσεις του αρχείου.
drop policy if exists parent_ins_firm_record_log on public.firm_record_log;
create policy parent_ins_firm_record_log on public.firm_record_log as restrictive for insert to authenticated
  with check (false);
drop policy if exists mfa_firm_record_log on public.firm_record_log;
create policy mfa_firm_record_log on public.firm_record_log as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ΟΙ ΕΛΕΓΧΟΙ
-- ═══════════════════════════════════════════════════════════════════════════

/* Το επίπεδο που έδωσε ο ιδιοκτήτης στο γραφείο του προσώπου, ή null αν το
   πρόσωπο δεν ενεργεί για τον ιδιοκτήτη (συνεργάτης, χωρίς ανάθεση, εκτός). */
create or replace function private.firm_level(p_user uuid, p_owner uuid)
returns text
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select case when private.firm_sees_owner(p_user, p_owner, true) then (
    select ac.access_level from public.accountant_clients ac
     where ac.owner_id = p_owner and ac.active and ac.firm_id = private.firm_of(p_user)
     order by case ac.access_level when 'keep' then 3 when 'upload' then 2 else 1 end desc
     limit 1)
  end;
$$;

create or replace function private.firm_can_upload(p_user uuid, p_owner uuid)
returns boolean
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select coalesce(private.firm_level(p_user, p_owner) in ('upload', 'keep'), false);
$$;

/* Διαδρομή <ιδιοκτήτης>/<ακίνητο>/document/<αρχείο>, ακίνητο του ιδιοκτήτη,
   PDF/JPG/PNG, γραφείο με επίπεδο ≥ ανέβασμα. */
create or replace function private.firm_upload_path_ok(p_name text)
returns boolean
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_parts text[] := storage.foldername(p_name);
  v_uuid text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_owner uuid;
begin
  if auth.uid() is null or coalesce(array_length(v_parts, 1), 0) < 3 then return false; end if;
  if v_parts[1] !~ v_uuid or v_parts[2] !~ v_uuid or v_parts[3] <> 'document' then return false; end if;
  if lower(storage.extension(p_name)) not in ('pdf', 'jpg', 'jpeg', 'png') then return false; end if;
  v_owner := v_parts[1]::uuid;
  if v_owner = auth.uid() then return false; end if;
  return private.firm_can_upload(auth.uid(), v_owner)
     and exists (select 1 from public.user_properties up where up.id = v_parts[2]::uuid and up.user_id = v_owner);
end $$;

drop policy if exists property_files_firm_upload on storage.objects;
create policy property_files_firm_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'property-files' and private.firm_upload_path_ok(name));

-- Σβήνει μόνο ό,τι ανέβασε ο ίδιος: στο «ανέβασμα» για 24 ώρες (λάθος
-- ανέβασμα), στην «τήρηση» χωρίς όριο. Αρχεία του ιδιοκτήτη έχουν άλλο `owner`.
create or replace function private.firm_unupload_ok(p_name text, p_created timestamptz)
returns boolean
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select private.firm_upload_path_ok(p_name)
     and (private.firm_level(auth.uid(), (storage.foldername(p_name))[1]::uuid) = 'keep'
          or p_created > now() - interval '24 hours');
$$;

drop policy if exists property_files_firm_unupload on storage.objects;
create policy property_files_firm_unupload on storage.objects for delete to authenticated
  using (bucket_id = 'property-files'
         and owner = (select auth.uid())
         and private.firm_unupload_ok(name, created_at));

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ΤΑ ΕΙΔΗ ΚΑΤΑΧΩΡΗΣΗΣ: ΠΙΝΑΚΑΣ, ΕΠΙΤΡΕΠΤΕΣ ΣΤΗΛΕΣ, ΕΛΑΧΙΣΤΟ ΕΠΙΠΕΔΟ
-- ─────────────────────────────────────────────────────────────────────────
-- Ό,τι δεν είναι στη λίστα δεν γράφεται, ό,τι κι αν στείλει ο περιηγητής.
-- `user_id`, `property_id`, `firm_id`, `created_by_member` τα ορίζει η βάση.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function private.firm_kind_table(p_kind text)
returns text
language sql immutable
as $$
  select case p_kind
    when 'document' then 'property_documents'
    when 'tenant'   then 'tenants'
    when 'bill'     then 'bills'
    when 'rent'     then 'rent_payments'
    when 'expense'  then 'expenses'
  end;
$$;

create or replace function private.firm_kind_cols(p_kind text)
returns text[]
language sql immutable
as $$
  select case p_kind
    when 'document' then array['kind', 'category', 'title', 'notes', 'doc_date', 'file_path', 'file_name', 'mime',
                               'size_bytes', 'supplier', 'amount', 'provider_afm', 'period_from', 'period_to', 'issue_date']
    when 'tenant'   then array['full_name', 'nationality', 'profession', 'employer', 'phone', 'email', 'afm', 'id_number',
                               'lease_start', 'lease_end', 'monthly_rent', 'deposit', 'payment_day', 'contract_type',
                               'status', 'notes', 'aade_lease_decl_ref']
    when 'bill'     then array['type', 'amount', 'due_date', 'period', 'category', 'name', 'vat_rate', 'notes', 'kwh',
                               'ert', 'etmear', 'dimotika', 'paid_at', 'paid_by', 'share_percent', 'share_note']
    when 'rent'     then array['payment_date', 'amount', 'period', 'notes', 'method', 'due_date', 'base_rent',
                               'services_charge', 'tenant_id', 'period_year', 'period_month', 'paid_date']
    when 'expense'  then array['description', 'amount', 'category', 'date', 'expense_group', 'payment_method',
                               'vat_rate', 'vat_amount', 'store_vendor', 'notes', 'paid_by', 'dedup_hash']
  end;
$$;

/* Το ελάχιστο επίπεδο: τα αρχεία από το «ανέβασμα», όλα τα άλλα από την «τήρηση». */
create or replace function private.firm_kind_allowed(p_kind text, p_level text)
returns boolean
language sql immutable
as $$
  select case
    when p_kind = 'document' then p_level in ('upload', 'keep')
    when p_kind in ('tenant', 'bill', 'rent', 'expense', 'event') then p_level = 'keep'
    else false
  end;
$$;

/* Οι στήλες που θα γραφτούν: επιτρεπτές ∩ σταλμένες ∩ υπαρκτές στον πίνακα. */
create or replace function private.firm_cols_present(p_table text, p_allowed text[], p_row jsonb)
returns text[]
language sql stable
set search_path = 'public', 'pg_temp'
as $$
  select coalesce(array_agg(c.column_name::text order by c.ordinal_position), '{}')
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_table
     and c.column_name = any(p_allowed)
     and p_row ? c.column_name;
$$;

/*
 * Ελέγχει και διορθώνει τη γραμμή πριν γραφτεί. Εδώ ζουν οι κανόνες «καμία
 * νέα υποχρέωση»: ο λογαριασμός είναι πληρωμένος, η δαπάνη εξοφλημένη, η
 * είσπραξη εισπραγμένη, η δόση δανείου πέφτει σε υπάρχον δάνειο.
 */
create or replace function private.firm_shape_row(p_kind text, p_owner uuid, p_property uuid, p_row jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
declare r jsonb := coalesce(p_row, '{}'::jsonb);
begin
  if p_kind = 'document' then
    if coalesce(r->>'file_path', '') not like p_owner::text || '/' || p_property::text || '/document/%' then
      raise exception 'firm_record:path' using errcode = '22023';
    end if;
    if coalesce(r->>'mime', '') not in ('application/pdf', 'image/jpeg', 'image/png') then
      raise exception 'firm_record:type' using errcode = '22023';
    end if;
    if coalesce((r->>'size_bytes')::bigint, 0) <= 0 or (r->>'size_bytes')::bigint > 52428800 then
      raise exception 'firm_record:size' using errcode = '22023';
    end if;
    r := r || jsonb_build_object('kind', 'document');
  elsif p_kind = 'bill' then
    if r->>'paid_at' is null then raise exception 'firm_record:paid_at' using errcode = '22023'; end if;
    if coalesce(r->>'paid_by', 'owner') not in ('owner', 'tenant') then
      raise exception 'firm_record:paid_by' using errcode = '22023';
    end if;
    r := r || jsonb_build_object('paid', true, 'recurring', false);
  elsif p_kind = 'rent' then
    if r ? 'tenant_id' and r->>'tenant_id' is not null and not exists (
         select 1 from tenants t where t.id = (r->>'tenant_id')::uuid and t.user_id = p_owner and t.property_id = p_property) then
      raise exception 'firm_record:tenant' using errcode = '22023';
    end if;
    r := r || jsonb_build_object('status', 'paid', 'paid', true);
  elsif p_kind = 'expense' then
    -- Η δόση δανείου είναι δαπάνη της ομάδας «loan», όπως τη γράφει το
    -- «Πλήρωσα» της εφαρμογής (lib/reminders/payRedeem.ts). Μόνο σε ακίνητο που
    -- ΗΔΗ έχει δάνειο: το γραφείο πληρώνει δόση, δεν ανοίγει δάνειο.
    if coalesce(r->>'expense_group', '') = 'loan'
       and not exists (select 1 from loans l where l.property_id = p_property and l.user_id = p_owner) then
      raise exception 'firm_record:no_loan' using errcode = '22023';
    end if;
    if coalesce(r->>'paid_by', 'owner') not in ('owner', 'tenant') then
      raise exception 'firm_record:paid_by' using errcode = '22023';
    end if;
    r := r || jsonb_build_object('paid', true, 'is_recurring', false);
  end if;
  return r;
end $$;

/* Ο κοινός πρόλογος: ποιος, για ποιον, σε ποιο ακίνητο, με ποιο επίπεδο. */
create or replace function private.firm_write_gate(p_owner uuid, p_property uuid, p_kind text)
returns uuid
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_firm uuid := private.firm_of(auth.uid());
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if auth.uid() is null or v_firm is null then raise exception 'firm_record:anonymous' using errcode = '42501'; end if;
  if coalesce(p_kind, '') not in ('document', 'tenant', 'bill', 'rent', 'expense', 'event') then
    raise exception 'firm_record:kind' using errcode = '22023';
  end if;
  if not coalesce(private.firm_kind_allowed(p_kind, private.firm_level(auth.uid(), p_owner)), false) then
    raise exception 'firm_record:not_allowed' using errcode = '42501';
  end if;
  if p_property is null or not exists (select 1 from user_properties up where up.id = p_property and up.user_id = p_owner) then
    raise exception 'firm_record:property' using errcode = '42501';
  end if;
  return v_firm;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ΟΙ ΚΙΝΗΣΕΙΣ ΤΟΥ ΓΡΑΦΕΙΟΥ
-- ═══════════════════════════════════════════════════════════════════════════

/* Νέα καταχώρηση σε υπάρχον ακίνητο του πελάτη. */
create or replace function public.firm_record(p_owner uuid, p_property uuid, p_kind text, p_row jsonb)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_firm uuid;
  v_table text := private.firm_kind_table(p_kind);
  v_row jsonb;
  v_cols text[];
  v_list text;
  v_id uuid;
  v_after jsonb;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  v_firm := private.firm_write_gate(p_owner, p_property, p_kind);
  -- Γεγονός ημερολογίου δεν γράφεται: θα ήταν νέα υποχρέωση. Μόνο σημειώνεται πληρωμή.
  if v_table is null then raise exception 'firm_record:kind' using errcode = '22023'; end if;
  v_row := private.firm_shape_row(p_kind, p_owner, p_property, p_row);
  v_cols := private.firm_cols_present(v_table, private.firm_kind_cols(p_kind)
              || array['kind', 'paid', 'recurring', 'status', 'is_recurring'], v_row);
  v_row := v_row || jsonb_build_object('user_id', p_owner, 'property_id', p_property,
                                       'firm_id', v_firm, 'created_by_member', auth.uid());
  v_cols := v_cols || array['user_id', 'property_id', 'firm_id', 'created_by_member'];
  select string_agg(format('%I', c), ', ') into v_list from unnest(v_cols) c;

  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) returning id',
                 v_table, v_list, v_list, v_table)
     using v_row into v_id;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_table) using v_id into v_after;

  insert into firm_record_log (firm_id, member_id, owner_id, property_id, kind, table_name, row_id, action, after)
    values (v_firm, auth.uid(), p_owner, p_property, p_kind, v_table, v_id, 'insert', v_after);
  insert into firm_access_log (firm_id, user_id, owner_id, action)
    values (v_firm, auth.uid(), p_owner, case when p_kind = 'document' then 'upload' else 'record' end);
  return json_build_object('ok', true, 'id', v_id);
end $$;

/* Αλλαγή ΔΙΚΗΣ του καταχώρησης. Μόνο επιτρεπτές στήλες, ποτέ ακίνητο ή ιδιοκτήτης. */
create or replace function public.firm_record_update(p_kind text, p_id uuid, p_row jsonb)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_table text := private.firm_kind_table(p_kind);
  v_before jsonb;
  v_after jsonb;
  v_firm uuid;
  v_cols text[];
  v_set text;
  v_row jsonb;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_table is null then raise exception 'firm_record:kind' using errcode = '22023'; end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_table) using p_id into v_before;
  if v_before is null then raise exception 'firm_record:not_found' using errcode = '42501'; end if;
  v_firm := private.firm_write_gate((v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind);
  if (v_before->>'firm_id') is distinct from v_firm::text then
    raise exception 'firm_record:not_ours' using errcode = '42501';
  end if;
  if p_kind = 'document' and private.firm_level(auth.uid(), (v_before->>'user_id')::uuid) <> 'keep' then
    raise exception 'firm_record:not_allowed' using errcode = '42501';
  end if;

  -- Ίδιοι κανόνες σχήματος με την εισαγωγή, πάνω στη νέα μορφή της γραμμής.
  v_row := private.firm_shape_row(p_kind, (v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid,
                                  v_before || coalesce(p_row, '{}'::jsonb));
  v_cols := private.firm_cols_present(v_table, private.firm_kind_cols(p_kind), coalesce(p_row, '{}'::jsonb));
  if coalesce(array_length(v_cols, 1), 0) = 0 then return json_build_object('ok', true, 'changed', 0); end if;
  select string_agg(format('%I = r.%I', c, c), ', ') into v_set from unnest(v_cols) c;

  execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2',
                 v_table, v_set, v_table)
     using v_row, p_id;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_table) using p_id into v_after;
  insert into firm_record_log (firm_id, member_id, owner_id, property_id, kind, table_name, row_id, action, before, after)
    values (v_firm, auth.uid(), (v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind, v_table, p_id,
            'update', v_before, v_after);
  return json_build_object('ok', true, 'changed', 1);
end $$;

/* Διαγραφή ΔΙΚΗΣ του καταχώρησης. Στο «ανέβασμα» μόνο για 24 ώρες. */
create or replace function public.firm_record_delete(p_kind text, p_id uuid)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_table text := private.firm_kind_table(p_kind);
  v_before jsonb;
  v_firm uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_table is null then raise exception 'firm_record:kind' using errcode = '22023'; end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_table) using p_id into v_before;
  if v_before is null then raise exception 'firm_record:not_found' using errcode = '42501'; end if;
  v_firm := private.firm_write_gate((v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind);
  if (v_before->>'firm_id') is distinct from v_firm::text then
    raise exception 'firm_record:not_ours' using errcode = '42501';
  end if;
  if private.firm_level(auth.uid(), (v_before->>'user_id')::uuid) <> 'keep'
     and (v_before->>'created_at')::timestamptz < now() - interval '24 hours' then
    raise exception 'firm_record:too_late' using errcode = '42501';
  end if;
  execute format('delete from public.%I where id = $1', v_table) using p_id;
  insert into firm_record_log (firm_id, member_id, owner_id, property_id, kind, table_name, row_id, action, before)
    values (v_firm, auth.uid(), (v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind, v_table, p_id,
            'delete', v_before);
  return json_build_object('ok', true, 'filePath', v_before->>'file_path');
end $$;

/*
 * Σημείωση πληρωμής σε ΥΠΑΡΧΟΥΣΑ εκκρεμότητα του ιδιοκτήτη, με τον ίδιο
 * μηχανισμό που χρησιμοποιεί η εφαρμογή:
 *   bill   λογαριασμός (`bills.paid`, `paid_at`)·
 *   rent   προγραμματισμένο ενοίκιο (`rent_payments.status`)·
 *   event  δόση στο ημερολόγιο: ΕΝΦΙΑ, φόρος εισοδήματος, δόση δανείου
 *          (`calendar_events.status`, όπως το «Πλήρωσα» του payRedeem.ts).
 * Αλλάζουν ΜΟΝΟ τα πεδία πληρωμής· ποσό, προθεσμία, όνομα μένουν. Η δαπάνη
 * της δόσης, αν ζητηθεί, γράφεται χωριστά με `firm_record('expense')` και το
 * ίδιο `dedup_hash` της εφαρμογής.
 */
create or replace function public.firm_mark_paid(p_kind text, p_id uuid, p_paid_on date, p_method text)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_table text;
  v_before jsonb;
  v_after jsonb;
  v_firm uuid;
  v_on date := coalesce(p_paid_on, current_date);
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if p_kind = 'bill' then v_table := 'bills';
  elsif p_kind = 'rent' then v_table := 'rent_payments';
  elsif p_kind = 'event' then v_table := 'calendar_events';
  else raise exception 'firm_record:kind' using errcode = '22023';
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_table) using p_id into v_before;
  if v_before is null then raise exception 'firm_record:not_found' using errcode = '42501'; end if;
  v_firm := private.firm_write_gate((v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind);
  if v_on > current_date then raise exception 'firm_record:future' using errcode = '22023'; end if;

  if p_kind = 'bill' then
    if coalesce((v_before->>'paid')::boolean, false) then raise exception 'firm_record:already_paid' using errcode = '22023'; end if;
    update bills set paid = true, paid_at = v_on::timestamptz where id = p_id;
  elsif p_kind = 'event' then
    -- Μία δόση, όχι σειρά: επαναλαμβανόμενο γεγονός δεν κλείνει ολόκληρο.
    if coalesce(v_before->>'status', 'pending') <> 'pending' or coalesce((v_before->>'recurring')::boolean, false)
       or v_before->>'amount' is null then
      raise exception 'firm_record:not_payable' using errcode = '22023';
    end if;
    update calendar_events set status = 'paid' where id = p_id;
  else
    if coalesce(v_before->>'status', '') = 'paid' and coalesce((v_before->>'paid')::boolean, true) then
      raise exception 'firm_record:already_paid' using errcode = '22023';
    end if;
    update rent_payments set status = 'paid', paid = true, paid_date = v_on, payment_date = v_on,
           method = coalesce(nullif(btrim(coalesce(p_method, '')), ''), method)
     where id = p_id;
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_table) using p_id into v_after;
  insert into firm_record_log (firm_id, member_id, owner_id, property_id, kind, table_name, row_id, action, before, after)
    values (v_firm, auth.uid(), (v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind, v_table, p_id,
            'mark_paid', v_before, v_after);
  insert into firm_access_log (firm_id, user_id, owner_id, action)
    values (v_firm, auth.uid(), (v_before->>'user_id')::uuid, 'record');
  return json_build_object('ok', true);
end $$;

/* Οι εκκρεμότητες του πελάτη στις οποίες το γραφείο μπορεί να σημειώσει πληρωμή. */
create or replace function public.firm_open_items(p_owner uuid)
returns json
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if coalesce(private.firm_level(auth.uid(), p_owner), '') <> 'keep' then return '[]'::json; end if;
  return coalesce((
    select json_agg(x order by x->>'due') from (
      select json_build_object('kind', 'bill', 'id', b.id, 'propertyId', b.property_id, 'property', up.name,
                               'name', coalesce(b.name, b.category, b.type), 'amount', b.amount, 'due', b.due_date) as x
        from bills b join user_properties up on up.id = b.property_id
       where b.user_id = p_owner and coalesce(b.paid, false) = false
      union all
      select json_build_object('kind', 'event', 'id', e.id, 'propertyId', e.property_id, 'property', up.name,
                               'name', e.title, 'amount', e.amount, 'due', e.event_date)
        from calendar_events e join user_properties up on up.id = e.property_id
       where e.user_id = p_owner and coalesce(e.status, 'pending') = 'pending'
         and coalesce(e.recurring, false) = false and e.amount is not null
      union all
      select json_build_object('kind', 'rent', 'id', r.id, 'propertyId', r.property_id, 'property', up.name,
                               'name', coalesce(r.period, 'Ενοίκιο'), 'amount', r.amount, 'due', coalesce(r.due_date, r.payment_date))
        from rent_payments r join user_properties up on up.id = r.property_id
       where r.user_id = p_owner and (coalesce(r.status, '') <> 'paid' or r.paid is false)
    ) s
  ), '[]'::json);
end $$;

/* Τα ακίνητα του πελάτη για το dropdown, με το αν έχουν δάνειο. Τίποτε άλλο. */
create or replace function public.firm_client_properties(p_owner uuid)
returns json
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if not private.firm_reads_owner(auth.uid(), p_owner) then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object('id', up.id, 'name', up.name,
             'hasLoan', exists (select 1 from loans l where l.property_id = up.id and l.user_id = p_owner))
           order by up.name)
      from user_properties up where up.user_id = p_owner
  ), '[]'::json);
end $$;

/* Για τον χώρο του γραφείου: ανά πελάτη, τι επίπεδο έδωσε και αν τον έχω αναλάβει. */
create or replace function public.firm_client_levels()
returns json
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_me uuid := auth.uid(); v_firm uuid := private.firm_of(auth.uid());
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null or v_firm is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object(
      'ownerId', o.owner_id,
      'level', o.level,
      'mine', exists (select 1 from firm_client_assignees fa where fa.firm_id = v_firm and fa.owner_id = o.owner_id and fa.user_id = v_me),
      'myLevel', private.firm_level(v_me, o.owner_id)))
      from (select ac.owner_id,
                   (array_agg(ac.access_level order by case ac.access_level when 'keep' then 3 when 'upload' then 2 else 1 end desc))[1] as level
              from accountant_clients ac
             where ac.firm_id = v_firm and ac.active
             group by ac.owner_id) o
     where private.firm_reads_owner(v_me, o.owner_id)
  ), '[]'::json);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Η ΠΛΕΥΡΑ ΤΟΥ ΙΔΙΟΚΤΗΤΗ
-- ═══════════════════════════════════════════════════════════════════════════

/* Ο ιδιοκτήτης ορίζει το επίπεδο ενός γραφείου. */
create or replace function public.owner_set_firm_level(p_firm uuid, p_level text)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_me uuid := auth.uid(); v_n int;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if coalesce(p_level, '') not in ('read', 'upload', 'keep') then return json_build_object('ok', false, 'reason', 'level'); end if;
  update accountant_clients set access_level = p_level where owner_id = v_me and firm_id = p_firm;
  get diagnostics v_n = row_count;
  if v_n = 0 then return json_build_object('ok', false, 'reason', 'invalid'); end if;
  return json_build_object('ok', true);
end $$;

/* Η σύνοψη της ημέρας: ανά γραφείο, πόσα από κάθε είδος. */
create or replace function public.owner_firm_day(p_day date)
returns json
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_me uuid := auth.uid(); v_day date := coalesce(p_day, current_date);
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object('firmId', s.firm_id, 'firmName', f.name, 'counts', s.counts, 'total', s.total)
           order by f.name)
      from (
        select l.firm_id, sum(l.n)::int as total, json_object_agg(l.kind, l.n) as counts
          from (select firm_id, kind, count(*)::int as n
                  from firm_record_log
                 where owner_id = v_me and undone_at is null and action in ('insert', 'mark_paid')
                   and (at at time zone 'Europe/Athens')::date = v_day
                 group by firm_id, kind) l
         group by l.firm_id
      ) s join firms f on f.id = s.firm_id
  ), '[]'::json);
end $$;

/*
 * «Αναίρεση όλων των σημερινών καταχωρήσεων του γραφείου». Σε αντίστροφη
 * σειρά: ό,τι μπήκε σβήνεται, ό,τι άλλαξε γυρίζει στο «πριν», ό,τι σβήστηκε
 * ξαναμπαίνει. Αν ο ιδιοκτήτης έχει ήδη αλλάξει μόνος του μια γραμμή, η δική
 * του αλλαγή μένει: η αναίρεση αγγίζει μόνο γραμμές όπως τις άφησε το γραφείο.
 */
create or replace function public.owner_undo_firm_day(p_firm uuid, p_day date)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_day date := coalesce(p_day, current_date);
  l record;
  v_now jsonb;
  v_n int := 0;
  v_skipped int := 0;
  v_cols text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;

  for l in
    select * from firm_record_log
     where owner_id = v_me and firm_id = p_firm and undone_at is null
       and action in ('insert', 'update', 'delete', 'mark_paid')
       and (at at time zone 'Europe/Athens')::date = v_day
     order by at desc, id desc
     for update
  loop
    execute format('select to_jsonb(t) from public.%I t where t.id = $1', l.table_name) using l.row_id into v_now;
    if l.action = 'delete' then
      if v_now is null then
        select string_agg(format('%I', k), ', ') into v_cols from jsonb_object_keys(l.before) k
         where exists (select 1 from information_schema.columns c
                        where c.table_schema = 'public' and c.table_name = l.table_name and c.column_name = k);
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
                       l.table_name, v_cols, v_cols, l.table_name) using l.before;
        v_n := v_n + 1;
      else v_skipped := v_skipped + 1;
      end if;
    elsif v_now is null then
      v_skipped := v_skipped + 1;                           -- ήδη σβησμένη
    elsif v_now is distinct from l.after then
      v_skipped := v_skipped + 1;                           -- ο ιδιοκτήτης την άλλαξε στο μεταξύ
    elsif l.action = 'insert' then
      execute format('delete from public.%I where id = $1', l.table_name) using l.row_id;
      v_n := v_n + 1;
    else
      select string_agg(format('%I = r.%I', k, k), ', ') into v_cols from jsonb_object_keys(l.before) k
       where k not in ('id', 'user_id', 'property_id', 'firm_id', 'created_by_member', 'created_at')
         and exists (select 1 from information_schema.columns c
                      where c.table_schema = 'public' and c.table_name = l.table_name and c.column_name = k);
      execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2',
                     l.table_name, v_cols, l.table_name) using l.before, l.row_id;
      v_n := v_n + 1;
    end if;
    update firm_record_log set undone_at = now() where id = l.id;
  end loop;
  return json_build_object('ok', true, 'undone', v_n, 'skipped', v_skipped);
end $$;

-- ── Ο ιδιοκτήτης μαθαίνει και το επίπεδο κάθε γραφείου ────────────────────
-- Η τελευταία γραφή είναι στο 20261104120000. Ίδια πεδία, συν `accessLevel`.
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
      'accessLevel', ac.access_level,
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
    from (
      select distinct on (coalesce(x.firm_id::text, x.accountant_id::text)) x.*
        from accountant_clients x
       where x.owner_id = v_me and x.active
       order by coalesce(x.firm_id::text, x.accountant_id::text),
                case x.access_level when 'keep' then 3 when 'upload' then 2 else 1 end desc, x.linked_at
    ) ac
    left join billing_profiles bp on bp.user_id = ac.accountant_id
    left join firms f on f.id = ac.firm_id
  ), '[]'::json);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. ΔΙΚΑΙΩΜΑΤΑ
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare f text;
begin
  foreach f in array array[
    'public.firm_record(uuid, uuid, text, jsonb)',
    'public.firm_record_update(text, uuid, jsonb)',
    'public.firm_record_delete(text, uuid)',
    'public.firm_mark_paid(text, uuid, date, text)',
    'public.firm_open_items(uuid)',
    'public.firm_client_properties(uuid)',
    'public.firm_client_levels()',
    'public.owner_set_firm_level(uuid, text)',
    'public.owner_firm_day(date)',
    'public.owner_undo_firm_day(uuid, date)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  foreach f in array array[
    'private.firm_provenance_guard()',
    'private.firm_level(uuid, uuid)',
    'private.firm_can_upload(uuid, uuid)',
    'private.firm_upload_path_ok(text)',
    'private.firm_unupload_ok(text, timestamptz)',
    'private.firm_kind_table(text)',
    'private.firm_kind_cols(text)',
    'private.firm_kind_allowed(text, text)',
    'private.firm_cols_present(text, text[], jsonb)',
    'private.firm_shape_row(text, uuid, uuid, jsonb)',
    'private.firm_write_gate(uuid, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
  end loop;
  -- Οι πολιτικές του storage τις καλούν με τον ρόλο του χρήστη.
  execute 'grant execute on function private.firm_upload_path_ok(text) to authenticated';
  execute 'grant execute on function private.firm_unupload_ok(text, timestamptz) to authenticated';
  execute 'grant execute on function private.firm_can_upload(uuid, uuid) to authenticated';
  execute 'grant execute on function private.firm_level(uuid, uuid) to authenticated';
end $$;
