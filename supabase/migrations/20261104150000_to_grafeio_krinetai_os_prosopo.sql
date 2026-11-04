-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΓΡΑΦΕΙΟ ΚΡΙΝΕΤΑΙ ΩΣ ΠΡΟΣΩΠΟ, ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΔΕΝ ΚΡΑΤΑ ΤΡΙΤΟΥΣ
-- ─────────────────────────────────────────────────────────────────────────
-- ΑΠΟ ΠΟΥ ΗΡΘΕ. Ανεξάρτητος έλεγχος των 20261104120000 και 20261104130000
-- (04/11/2026), πριν από την παραγωγή. Κάθε εύρημα έχει ενότητα στο
-- scripts/db/firm-security-probe.sql, που γράφτηκε ΠΡΩΤΟ και κοκκίνιζε πάνω
-- στον παλιό κώδικα. Οι δύο μεταναστεύσεις έχουν ήδη εφαρμοστεί στο staging,
-- οπότε δεν αλλάζουν: όλα εδώ.
--
-- 1. ΤΟ ΠΡΩΗΝ ΜΕΛΟΣ ΚΡΑΤΟΥΣΕ ΠΡΟΣΒΑΣΗ. Το `firm_open_client` έδινε στον
--    περιηγητή του μέλους το token του ιδιοκτήτη και το `get_accountant_data`
--    (που το καλεί και ο ανώνυμος) ζητά μόνο αυτό. Και ο λογιστής που
--    διεκδίκησε τον πελάτη το ήξερε έτσι κι αλλιώς: το επικόλλησε. Ούτε η
--    αφαίρεση μέλους ούτε η ανάκληση γραφείου άλλαζαν τον σύνδεσμο, άρα ο
--    πρώην διάβαζε ως τη λήξη του, ως 180 ημέρες.
--    Τώρα:
--    · το μέλος διαβάζει με `firm_client_data(owner, year)`, που κρίνει ΤΟ
--      ΠΡΟΣΩΠΟ σε κάθε κλήση (auth.uid, ενεργό μέλος, ρόλος, ανάθεση, ζωντανός
--      σύνδεσμος, δεύτερο βήμα). Το token δεν βγαίνει ποτέ από τη βάση: ούτε
--      το `firm_open_client` ούτε η λίστα πελατών το επιστρέφουν·
--    · κάθε έξοδος από το γραφείο (αφαίρεση, αποχώρηση, διαγραφή λογαριασμού
--      μέλους, ανάκληση από τον ιδιοκτήτη, αποδέσμευση πελάτη) περιστρέφει
--      τον σύνδεσμο των πελατών που αφορά. Οσοι άλλοι έχουν πρόσβαση με
--      λογαριασμό την κρατούν (το `claimed_token` τους δείχνει τον νέο)· μόνο
--      τα αντίγραφα του παλιού συνδέσμου παύουν να ανοίγουν.
--
-- 2. ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΚΡΑΤΟΥΣΕ ΟΛΟΚΛΗΡΗ ΤΗ ΓΡΑΜΜΗ ΤΟΥ ΜΙΣΘΩΤΗ (ΑΦΜ, ταυτότητα,
--    τηλέφωνο) ακόμη και μετά τη διαγραφή της, ορατή στο γραφείο ακόμη και
--    μετά την ανάκληση. Τώρα:
--    · το `firm_record_log` κρατά είδος, γραμμή, ενέργεια, ΠΟΙΑ πεδία άλλαξαν,
--      και για ό,τι δεν είναι πρόσωπο μια ετικέτα. Για μισθωτή ούτε αυτή.
--      Ποσό δεν κρατά: πίνακας με ποσό και ακίνητο θα ήθελε τον διακόπτη
--      οικονομικών (20260815180000) και το ποσό ζει ήδη στη γραμμή·
--    · το «πριν/μετά» που χρειάζεται η «Αναίρεση όλων των σημερινών» ζει στο
--      `public.firm_record_undo`, που δεν το διαβάζει κανένας ρόλος του API.
--      Σβήνει με τη γραμμή όταν τη σβήσει ο ιδιοκτήτης, με τον λογαριασμό του
--      και κάθε μέρα μετά από δύο ημέρες (η αναίρεση αφορά μόνο το σήμερα)·
--    · το γραφείο διαβάζει το ημερολόγιο μόνο όσο έχει ακόμη πρόσβαση.
--
-- 3. ΤΟ ΙΣΤΟΡΙΚΟ ΧΑΝΟΤΑΝ. Με το τελευταίο μέλος έφευγε το γραφείο και μαζί
--    (`on delete cascade`) ό,τι έβλεπε ο ιδιοκτήτης για τον λογαριασμό του.
--    Τώρα `on delete set null` και το όνομα γραφείου και μέλους γραμμένο ως
--    κείμενο τη στιγμή της κίνησης.
--
-- 4. ΔΕΥΤΕΡΟ ΒΗΜΑ ΥΠΟΧΡΕΩΤΙΚΟ ΓΙΑ ΜΕΛΗ ΓΡΑΦΕΙΟΥ. Το `mfa_satisfied` περνούσε
--    όποιον δεν είχε δηλώσει συσκευή. Οποιος βλέπει δεδομένα πολλών πελατών
--    χωρίς δεύτερο παράγοντα είναι ανοιχτή πόρτα: για ενεργό μέλος γραφείου
--    ζητά πια `aal2`, παντού όπου ρωτιέται (πολιτικές, RPC, αρχεία). Ο
--    ιδιοκτήτης χωρίς συσκευή δεν αλλάζει.
--
-- 5. Η ΕΞΑΓΩΓΗ. Το `export_my_data` έπιανε ήδη και τα δύο ημερολόγια για τον
--    ιδιοκτήτη (κάθε πίνακας με ξένο κλειδί προς `auth.users`). Επιανε όμως
--    και για το ΜΕΛΟΣ τις γραμμές του ημερολογίου με ό,τι έγραψε στον φάκελο
--    του πελάτη. Τώρα το μέλος εξάγει μόνο τι έκανε και πότε.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ §4. ΤΟ ΔΕΥΤΕΡΟ ΒΗΜΑ ═══════════════════════════════════════════════════
-- Η συνάρτηση είναι η πύλη όλων: πολιτικών restrictive, RPC και (από εδώ) των
-- αρχείων. Το ευρετήριο `firm_members_one_active_firm` κάνει την ερώτηση μία
-- αναζήτηση στο user_id.
create or replace function private.mfa_satisfied()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or (
        not exists (
          select 1
            from auth.mfa_factors f
           where f.user_id = auth.uid()
             and f.status = 'verified'
        )
        and not exists (
          select 1
            from public.firm_members m
           where m.user_id = auth.uid()
             and m.status = 'active'
        )
      )
$$;

alter function private.mfa_satisfied() owner to postgres;
revoke all on function private.mfa_satisfied() from public, anon;
grant execute on function private.mfa_satisfied() to authenticated, service_role;

comment on function private.mfa_satisfied() is
  'Πέρασε ο καλών το δεύτερο βήμα, ή δεν έχει συσκευή να περάσει; Για ενεργό μέλος γραφείου μόνο το πρώτο (20261104150000).';

-- Τα αρχεία: η ίδια πύλη, με τον ίδιο κανόνα.
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
  -- Το δεύτερο βήμα και στα αρχεία: μέλος γραφείου χωρίς aal2 δεν περνά.
  if not private.mfa_satisfied() then return false; end if;
  if v_parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_owner := v_parts[1]::uuid;
  if v_owner = auth.uid() then return false; end if;      -- ο ιδιοκτήτης έχει ήδη τη δική του πολιτική
  if p_write and v_parts[2] <> 'aade-e2' then return false; end if;
  if not p_write and v_parts[2] not in ('aade-e2', 'accountant-pack') then return false; end if;
  if p_write then return public.accountant_link_live(auth.uid(), v_owner); end if;
  return private.firm_reads_owner(auth.uid(), v_owner);
end $$;

-- ═══ §1. ΤΟ ΠΡΟΣΩΠΟ, ΟΧΙ ΤΟ TOKEN ═════════════════════════════════════════
-- Νέος σύνδεσμος για τον ιδιοκτήτη. Οσες ενεργές άδειες στηρίζονταν στον
-- παλιό (άλλα γραφεία, το ίδιο το γραφείο όταν φεύγει μόνο ένα μέλος) τον
-- ακολουθούν· τα αντίγραφα του παλιού συνδέσμου παύουν να ανοίγουν. Ιδια
-- μορφή κλειδιού με την προεπιλογή του πίνακα.
-- ΤΟ ΓΙΑΤΙ ΓΡΑΦΕΤΑΙ ΣΤΟΝ ΣΥΝΔΕΣΜΟ. Ο ιδιοκτήτης βλέπει νέο σύνδεσμο που δεν
-- ζήτησε: η οθόνη του λέει «ο σύνδεσμος ανανεώθηκε επειδή αποχώρησε μέλος»
-- αντί να τον αφήσει να αναρωτιέται (απόφαση 04/11/2026).
alter table public.accountant_links add column if not exists rotated_at timestamptz;
alter table public.accountant_links add column if not exists rotated_reason text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accountant_links_rotated_reason_chk') then
    alter table public.accountant_links add constraint accountant_links_rotated_reason_chk
      check (rotated_reason is null or rotated_reason in ('member_left', 'firm_revoked', 'client_dropped'));
  end if;
end $$;

-- Οταν ο ιδιοκτήτης αλλάξει μόνος του τον σύνδεσμο, ο παλιός λόγος σβήνει: η
-- οθόνη δεν λέει «αποχώρησε μέλος» για κάτι που έκανε ο ίδιος.
create or replace function private.accountant_link_reason_clear()
returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if new.token is distinct from old.token and new.rotated_at is not distinct from old.rotated_at then
    new.rotated_at := null;
    new.rotated_reason := null;
  end if;
  return new;
end $$;

drop trigger if exists accountant_links_reason_clear on public.accountant_links;
create trigger accountant_links_reason_clear before update on public.accountant_links
  for each row execute function private.accountant_link_reason_clear();

drop function if exists private.firm_rotate_link(uuid);
create or replace function private.firm_rotate_link(p_owner uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_old text;
  v_new text := replace(gen_random_uuid()::text, '-', '');
begin
  select al.token into v_old from accountant_links al where al.user_id = p_owner for update;
  if v_old is null then return; end if;
  update accountant_links set token = v_new, rotated_at = now(), rotated_reason = p_reason where user_id = p_owner;
  update accountant_clients set claimed_token = v_new
   where owner_id = p_owner and claimed_token = v_old and active;
end $$;

/*
 * Ο φάκελος του πελάτη για μέλος γραφείου. Ιδια εικόνα με τον σύνδεσμο
 * (`get_accountant_data`), αλλά η άδεια κρίνεται από το ΠΡΟΣΩΠΟ σε κάθε κλήση.
 * Το token το βρίσκει η βάση και δεν το επιστρέφει. Κενό όταν δεν επιτρέπεται.
 */
create or replace function public.firm_client_data(p_owner uuid, p_year integer)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_token text;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_me is null or p_owner is null or not private.firm_reads_owner(v_me, p_owner) then return null; end if;
  select al.token into v_token from accountant_links al
   where al.user_id = p_owner and al.active and (al.expires_at is null or al.expires_at > now())
   limit 1;
  if v_token is null then return null; end if;
  return public.get_accountant_data(v_token, p_year);
end $$;

-- Ανοίγει πελάτη και γράφει ποιος. Δεν επιστρέφει πια token.
create or replace function public.firm_open_client(p_owner uuid)
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
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  if not private.firm_reads_owner(v_me, p_owner) then
    return json_build_object('ok', false, 'reason', 'not_linked');
  end if;
  if not exists (select 1 from accountant_links al
                  where al.user_id = p_owner and al.active and (al.expires_at is null or al.expires_at > now())) then
    return json_build_object('ok', false, 'reason', 'no_link');
  end if;
  if v_firm is not null then
    insert into firm_access_log (firm_id, member_id, owner_id, action) values (v_firm, v_me, p_owner, 'open');
  end if;
  return json_build_object('ok', true);
end $$;

-- Η λίστα πελατών: ίδια, χωρίς token.
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
      -- ΤΟ TOKEN ΔΕΝ ΦΕΥΓΕΙ ΑΠΟ ΤΗ ΒΑΣΗ (20261104150000). Το κλειδί μένει, για
      -- όποιον το διαβάζει, πάντα κενό: ο φάκελος ανοίγει με `firm_client_data`.
      'token',        null::text,
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

-- Η ανάκληση από τον ιδιοκτήτη και η αποδέσμευση από το γραφείο περιστρέφουν.
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
  -- Ο σύνδεσμος που ήξερε το γραφείο πεθαίνει· όσοι άλλοι έχουν πρόσβαση την κρατούν.
  perform private.firm_rotate_link(v_me, 'firm_revoked');
  return json_build_object('ok', true);
end $$;

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
  perform private.firm_rotate_link(p_owner, 'client_dropped');
  return json_build_object('ok', true);
end $$;

-- Κάθε μέλος που παύει να είναι ενεργό (αφαίρεση, αποχώρηση, διαγραφή
-- λογαριασμού) περιστρέφει τον σύνδεσμο των πελατών του γραφείου. Ολων, όχι
-- μόνο όσων διεκδίκησε: το παλιό `firm_open_client` έδινε το token σε όποιον
-- άνοιγε πελάτη· στη διαγραφή λογαριασμού οι αναθέσεις έχουν ήδη φύγει.
-- Το όνομα ξεκινά από «e» ώστε να τρέξει ΠΡΙΝ από το `firm_members_gone`, που
-- σβήνει το άδειο γραφείο και θα άφηνε τις άδειες χωρίς `firm_id`.
create or replace function private.firm_member_exit()
returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare o uuid;
begin
  if old.status <> 'active' or (tg_op = 'UPDATE' and new.status = 'active') then return null; end if;
  for o in select distinct ac.owner_id from accountant_clients ac where ac.firm_id = old.firm_id and ac.active loop
    perform private.firm_rotate_link(o, 'member_left');
  end loop;
  return null;
end $$;

drop trigger if exists firm_members_exit on public.firm_members;
create trigger firm_members_exit
  after update of status or delete on public.firm_members
  for each row execute function private.firm_member_exit();

-- ═══ §3. ΤΟ ΙΣΤΟΡΙΚΟ ΜΕΝΕΙ ΣΤΟΝ ΙΔΙΟΚΤΗΤΗ ═════════════════════════════════
-- ΤΟ ΜΕΛΟΣ ΓΡΑΦΕΤΑΙ ΣΤΟ `member_id`, ΟΧΙ ΣΤΟ `user_id`. Το `erase_account`
-- σβήνει κάθε γραμμή του public με `user_id` ίσο με τον λογαριασμό που φεύγει:
-- εδώ το `user_id` ήταν το μέλος, οπότε η διαγραφή ενός λογιστή έσβηνε το
-- ιστορικό ΤΟΥ ΙΔΙΟΚΤΗΤΗ. Ιδιο όνομα με το `firm_record_log`.
-- ΓΙΑΤΙ ΟΧΙ `rename column`: το 20261104120000 πρέπει να αντέχει δεύτερη
-- εκτέλεση (db-replay) και γράφει ευρετήριο και πολιτική πάνω στο `user_id`.
-- Η στήλη μένει πάντα κενή και κανείς δεν τη γράφει πια.
alter table public.firm_access_log add column if not exists member_id uuid;
alter table public.firm_access_log alter column user_id drop not null;
update public.firm_access_log set member_id = user_id, user_id = null where user_id is not null;
comment on column public.firm_access_log.user_id is
  'Αποσύρθηκε (20261104150000): πάντα κενό. Το μέλος είναι στο member_id, ώστε η διαγραφή λογαριασμού μέλους να μη σβήνει το ιστορικό του ιδιοκτήτη.';
create index if not exists firm_access_log_member_idx on public.firm_access_log (member_id);
alter table public.firm_access_log add column if not exists firm_name text;
alter table public.firm_access_log add column if not exists member_name text;
alter table public.firm_access_log alter column firm_id drop not null;
alter table public.firm_access_log drop constraint if exists firm_access_log_firm_id_fkey;
alter table public.firm_access_log add constraint firm_access_log_firm_id_fkey
  foreign key (firm_id) references public.firms(id) on delete set null;
alter table public.firm_access_log drop constraint if exists firm_access_log_user_id_fkey;
alter table public.firm_access_log add constraint firm_access_log_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
alter table public.firm_access_log drop constraint if exists firm_access_log_member_id_fkey;
alter table public.firm_access_log add constraint firm_access_log_member_id_fkey
  foreign key (member_id) references auth.users(id) on delete set null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'firm_access_log_user_id_retired') then
    alter table public.firm_access_log add constraint firm_access_log_user_id_retired check (user_id is null);
  end if;
end $$;

-- Η ανάγνωση, με το νέο όνομα: ο ιδιοκτήτης για τον εαυτό του, το μέλος τις
-- δικές του κινήσεις, ο υπεύθυνος του γραφείου όλες του γραφείου.
drop policy if exists firm_access_log_read on public.firm_access_log;
create policy firm_access_log_read on public.firm_access_log for select
  using (
    owner_id = (select auth.uid())
    or member_id = (select auth.uid())
    or (firm_id = (select private.firm_of((select auth.uid())))
        and (select private.firm_role((select auth.uid()), firm_id)) = 'manager')
  );

alter table public.firm_record_log add column if not exists firm_name text;
alter table public.firm_record_log add column if not exists member_name text;
alter table public.firm_record_log alter column firm_id drop not null;
alter table public.firm_record_log drop constraint if exists firm_record_log_firm_id_fkey;
alter table public.firm_record_log add constraint firm_record_log_firm_id_fkey
  foreign key (firm_id) references public.firms(id) on delete set null;

-- Το ιστορικό του υπεύθυνου, με το νέο όνομα της στήλης.
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
        'member', coalesce(nullif(trim(mbp.owner_name), ''), nullif(trim(mbp.full_name), ''), m.email, l.member_name),
        'owner', coalesce(nullif(trim(obp.owner_name), ''), nullif(trim(obp.full_name), ''), 'Ιδιοκτήτης')
      ) as x
        from firm_access_log l
        left join firm_members m on m.firm_id = l.firm_id and m.user_id = l.member_id
        left join billing_profiles mbp on mbp.user_id = l.member_id
        left join billing_profiles obp on obp.user_id = l.owner_id
       where l.firm_id = v_firm
       order by l.at desc
       limit least(greatest(coalesce(p_limit, 200), 1), 500)
    ) s
  ), '[]'::json);
end $$;

-- Τα ονόματα γράφονται τη στιγμή της κίνησης: όπως ήταν τότε.
create or replace function private.firm_log_names()
returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_user uuid;
begin
  v_user := new.member_id;
  if new.firm_name is null then
    select f.name into new.firm_name from firms f where f.id = new.firm_id;
  end if;
  if new.member_name is null and v_user is not null then
    select coalesce(nullif(btrim(bp.owner_name), ''), nullif(btrim(bp.full_name), ''), m.email, u.email)
      into new.member_name
      from auth.users u
      left join billing_profiles bp on bp.user_id = u.id
      left join firm_members m on m.user_id = u.id and m.firm_id = new.firm_id
     where u.id = v_user
     limit 1;
  end if;
  return new;
end $$;

drop trigger if exists firm_access_log_names on public.firm_access_log;
create trigger firm_access_log_names before insert on public.firm_access_log
  for each row execute function private.firm_log_names();
drop trigger if exists firm_record_log_names on public.firm_record_log;
create trigger firm_record_log_names before insert on public.firm_record_log
  for each row execute function private.firm_log_names();

-- Οι γραμμές που υπάρχουν ήδη (μόνο στο staging) παίρνουν τα ονόματα τώρα.
update public.firm_access_log l set firm_name = f.name from public.firms f where f.id = l.firm_id and l.firm_name is null;
update public.firm_record_log l set firm_name = f.name from public.firms f where f.id = l.firm_id and l.firm_name is null;
update public.firm_access_log l set member_name = coalesce(m.email, u.email)
  from auth.users u left join public.firm_members m on m.user_id = u.id
 where u.id = l.member_id and l.member_name is null;
update public.firm_record_log l set member_name = coalesce(m.email, u.email)
  from auth.users u left join public.firm_members m on m.user_id = u.id
 where u.id = l.member_id and l.member_name is null;

-- ═══ §2. ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΧΩΡΙΣ ΤΡΙΤΟΥΣ ══════════════════════════════════════
create table if not exists public.firm_record_undo (
  log_id     uuid primary key references public.firm_record_log(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  table_name text not null,
  row_id     uuid not null,
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);
create index if not exists firm_record_undo_owner_idx on public.firm_record_undo (owner_id);
create index if not exists firm_record_undo_row_idx   on public.firm_record_undo (table_name, row_id);
create index if not exists firm_record_undo_at_idx    on public.firm_record_undo (at);
-- ΚΑΝΕΝΑΣ ΡΟΛΟΣ ΤΟΥ API ΔΕΝ ΤΟ ΔΙΑΒΑΖΕΙ ΟΥΤΕ ΤΟ ΓΡΑΦΕΙ: μόνο οι συναρτήσεις
-- του αρχείου (security definer). RLS, πολιτικές που αρνούνται τα πάντα και
-- κανένα δικαίωμα: τρία στρώματα, όπως στο `parent_ins_firm_record_log`.
alter table public.firm_record_undo enable row level security;
revoke all on public.firm_record_undo from public, anon, authenticated;
drop policy if exists firm_record_undo_none on public.firm_record_undo;
create policy firm_record_undo_none on public.firm_record_undo as restrictive for all to authenticated, anon
  using (false) with check (false);
drop policy if exists mfa_firm_record_undo on public.firm_record_undo;
create policy mfa_firm_record_undo on public.firm_record_undo as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

alter table public.firm_record_log add column if not exists label text;
alter table public.firm_record_log add column if not exists fields text[];
-- Τα παλιά «πριν/μετά» (μόνο staging) περνούν στην αναίρεση και φεύγουν από εδώ.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'firm_record_log' and column_name = 'before') then
    execute $q$
      insert into public.firm_record_undo (log_id, owner_id, table_name, row_id, before, after, at)
        select id, owner_id, table_name, row_id, before, after, at from public.firm_record_log
         where at > now() - interval '2 days'
      on conflict do nothing$q$;
    execute 'alter table public.firm_record_log drop column before';
    execute 'alter table public.firm_record_log drop column after';
  end if;
end $$;

/*
 * Μία κίνηση του γραφείου. Στο ημερολόγιο: τι, πού, ποια πεδία και, για ό,τι
 * δεν είναι πρόσωπο μια ετικέτα. Στην αναίρεση: το πριν και το
 * μετά, για όσο χρειάζεται.
 */
create or replace function private.firm_log(
  p_firm uuid, p_owner uuid, p_property uuid, p_kind text, p_table text, p_row uuid,
  p_action text, p_before jsonb, p_after jsonb)
returns uuid
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_id uuid;
  v_shown jsonb := coalesce(p_after, p_before, '{}'::jsonb);
  v_fields text[];
begin
  if p_before is not null and p_after is not null then
    select array_agg(k order by k) into v_fields
      from jsonb_object_keys(p_after) k
     where p_after -> k is distinct from p_before -> k and k not in ('updated_at');
  end if;
  insert into firm_record_log (firm_id, member_id, owner_id, property_id, kind, table_name, row_id, action,
                               label, fields)
    values (p_firm, auth.uid(), p_owner, p_property, p_kind, p_table, p_row, p_action,
            case when p_kind = 'tenant' then null
                 else left(nullif(btrim(coalesce(v_shown->>'title', v_shown->>'name', v_shown->>'description', '')), ''), 120) end,
            v_fields)
    returning id into v_id;
  insert into public.firm_record_undo (log_id, owner_id, table_name, row_id, before, after)
    values (v_id, p_owner, p_table, p_row, p_before, p_after);
  return v_id;
end $$;

-- Οταν σβήνει μια γραμμή, σβήνει και κάθε αντίγραφό της στην αναίρεση και η
-- ετικέτα της στο ημερολόγιο. Μένει μόνο ότι κάποτε υπήρξε κίνηση.
create or replace function private.firm_record_forget()
returns trigger
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  delete from public.firm_record_undo where table_name = tg_table_name and row_id = old.id;
  update firm_record_log set label = null
   where table_name = tg_table_name and row_id = old.id and label is not null;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['property_documents', 'tenants', 'bills', 'rent_payments', 'expenses', 'calendar_events'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_firm_forget', t);
    execute format('create trigger %I after delete on public.%I for each row execute function private.firm_record_forget()', t || '_firm_forget', t);
  end loop;
end $$;

-- Κάθε μέρα: η αναίρεση αφορά μόνο το σήμερα, τα αντίγραφα δεν κρατιούνται.
create or replace function private.firm_record_undo_prune()
returns void
language sql security definer
set search_path = 'public', 'pg_temp'
as $$
  delete from public.firm_record_undo where at < now() - interval '2 days';
$$;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron δεν είναι ενεργό: το σκούπισμα της αναίρεσης δεν προγραμματίζεται';
    return;
  end if;
  -- firm-record-undo-prune: κάθε μέρα 03:17 UTC, μακριά από το :00.
  if exists (select 1 from cron.job where jobname = 'firm-record-undo-prune') then
    perform cron.unschedule('firm-record-undo-prune');
  end if;
  perform cron.schedule('firm-record-undo-prune', '17 3 * * *', 'select private.firm_record_undo_prune()');
end $$;

-- Το γραφείο διαβάζει το ημερολόγιο μόνο όσο έχει πρόσβαση στον πελάτη.
drop policy if exists firm_record_log_read on public.firm_record_log;
create policy firm_record_log_read on public.firm_record_log for select
  using (
    owner_id = (select auth.uid())
    or (
      (member_id = (select auth.uid())
       or (firm_id = (select private.firm_of((select auth.uid())))
           and (select private.firm_role((select auth.uid()), firm_id)) = 'manager'))
      and private.firm_reads_owner((select auth.uid()), owner_id)
    )
  );

-- Οι συναρτήσεις που γράφουν, ίδιες με του 20261104130000 εκτός από το πού
-- πάει το «πριν/μετά».
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

  perform private.firm_log(v_firm, p_owner, p_property, p_kind, v_table, v_id, 'insert', null, v_after);
  insert into firm_access_log (firm_id, member_id, owner_id, action)
    values (v_firm, auth.uid(), p_owner, case when p_kind = 'document' then 'upload' else 'record' end);
  return json_build_object('ok', true, 'id', v_id);
end $$;

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
  perform private.firm_log(v_firm, (v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind, v_table, p_id,
                           'update', v_before, v_after);
  return json_build_object('ok', true, 'changed', 1);
end $$;

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
  perform private.firm_log(v_firm, (v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind, v_table, p_id,
                           'delete', v_before, null);
  return json_build_object('ok', true, 'filePath', v_before->>'file_path');
end $$;

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
  perform private.firm_log(v_firm, (v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind, v_table, p_id,
                           'mark_paid', v_before, v_after);
  insert into firm_access_log (firm_id, member_id, owner_id, action)
    values (v_firm, auth.uid(), (v_before->>'user_id')::uuid, 'record');
  return json_build_object('ok', true);
end $$;

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
    -- ΤΟ ΓΡΑΦΕΙΟ ΠΟΥ ΕΦΥΓΕ ΜΕΝΕΙ ΜΕ ΤΟ ΟΝΟΜΑ ΤΟΥ (20261104150000).
    select json_agg(json_build_object('firmId', s.firm_id, 'firmName', coalesce(f.name, s.firm_name),
                                      'counts', s.counts, 'total', s.total)
           order by coalesce(f.name, s.firm_name))
      from (
        select l.firm_id, max(l.firm_name) as firm_name, sum(l.n)::int as total, json_object_agg(l.kind, l.n) as counts
          from (select firm_id, max(firm_name) as firm_name, kind, count(*)::int as n
                  from firm_record_log
                 where owner_id = v_me and undone_at is null and action in ('insert', 'mark_paid')
                   and (at at time zone 'Europe/Athens')::date = v_day
                 group by firm_id, kind) l
         group by l.firm_id
      ) s left join firms f on f.id = s.firm_id
  ), '[]'::json);
end $$;

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

  -- ΤΑ «ΠΡΙΝ» ΚΑΙ «ΜΕΤΑ» ΖΟΥΝ ΣΤΟ public.firm_record_undo (20261104150000).
  -- Οπου λείπουν (σβήστηκε η γραμμή ή πέρασε η μέρα), η κίνηση δεν αναιρείται.
  for l in
    select fl.id, fl.table_name, fl.row_id, fl.action, u.before, u.after, (u.log_id is not null) as has_undo
      from firm_record_log fl
      left join public.firm_record_undo u on u.log_id = fl.id
     where fl.owner_id = v_me and fl.firm_id = p_firm and fl.undone_at is null
       and fl.action in ('insert', 'update', 'delete', 'mark_paid')
       and (fl.at at time zone 'Europe/Athens')::date = v_day
     order by fl.at desc, fl.id desc
     for update of fl
  loop
    if not l.has_undo then v_skipped := v_skipped + 1; continue; end if;
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
    delete from public.firm_record_undo where log_id = l.id;
  end loop;
  return json_build_object('ok', true, 'undone', v_n, 'skipped', v_skipped);
end $$;

-- ═══ §5. Η ΕΞΑΓΩΓΗ ════════════════════════════════════════════════════════
create or replace function public.export_my_data()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_uid  uuid  := auth.uid();
  v_out  jsonb := '{}'::jsonb;
  v_rows jsonb;
  v_acct jsonb;
  r      record;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  for r in
    select w.tbl,
           string_agg(format('t.%I::text = $1', w.col), ' or ' order by w.col) as pred
      from (
        select c.table_name::text as tbl, c.column_name::text as col
          from information_schema.columns c
          join information_schema.tables t
            on t.table_schema = c.table_schema and t.table_name = c.table_name
         where c.table_schema = 'public'
           and c.column_name  = 'user_id'
           and t.table_type   = 'BASE TABLE'
        union
        select cl.relname::text, a.attname::text
          from pg_constraint k
          join pg_class     cl on cl.oid = k.conrelid
          join pg_namespace n  on n.oid  = cl.relnamespace
          join pg_attribute a  on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
         where k.contype   = 'f'
           and k.confrelid = 'auth.users'::regclass
           and n.nspname   = 'public'
           and cl.relkind in ('r', 'p')
           and cardinality(k.conkey) = 1
      ) w
     group by w.tbl
     order by w.tbl
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t where %s',
      r.tbl, r.pred
    )
    into v_rows
    using v_uid::text;

    if v_rows <> '[]'::jsonb then
      v_out := v_out || jsonb_build_object(r.tbl, v_rows);
    end if;
  end loop;

  select to_jsonb(u) into v_acct
    from (
      select email, phone, created_at, last_sign_in_at
        from auth.users where id = v_uid
    ) u;

  -- ΤΑ ΗΜΕΡΟΛΟΓΙΑ ΤΩΝ ΓΡΑΦΕΙΩΝ (20261104150000). Ο ιδιοκτήτης παίρνει τις
  -- γραμμές του ολόκληρες. Το μέλος παίρνει ΤΙ έκανε και ΠΟΤΕ, όχι τι έγραψε
  -- στον φάκελο του πελάτη: εκείνα είναι δεδομένα του πελάτη, όχι δικά του.
  if v_out ? 'firm_record_log' then
    v_out := jsonb_set(v_out, '{firm_record_log}', (
      select coalesce(jsonb_agg(case when x->>'owner_id' = v_uid::text then x
               else jsonb_build_object('id', x->'id', 'firm_name', x->'firm_name', 'kind', x->'kind',
                                       'action', x->'action', 'at', x->'at') end), '[]'::jsonb)
        from jsonb_array_elements(v_out->'firm_record_log') x));
  end if;
  if v_out ? 'firm_access_log' then
    v_out := jsonb_set(v_out, '{firm_access_log}', (
      select coalesce(jsonb_agg(case when x->>'owner_id' = v_uid::text then x
               else jsonb_build_object('id', x->'id', 'firm_name', x->'firm_name',
                                       'action', x->'action', 'at', x->'at') end), '[]'::jsonb)
        from jsonb_array_elements(v_out->'firm_access_log') x));
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'user_id',     v_uid,
    'account',     coalesce(v_acct, 'null'::jsonb),
    'data',        v_out
  );
end;
$$;

-- ═══ ΔΙΚΑΙΩΜΑΤΑ ══════════════════════════════════════════════════════════
do $$
declare f text;
begin
  foreach f in array array[
    'public.firm_client_data(uuid, integer)',
    'public.firm_access_history(integer)',
    'public.firm_open_client(uuid)',
    'public.accountant_clients_overview(integer)',
    'public.owner_revoke_firm(uuid)',
    'public.firm_drop_client(uuid)',
    'public.firm_record(uuid, uuid, text, jsonb)',
    'public.firm_record_update(text, uuid, jsonb)',
    'public.firm_record_delete(text, uuid)',
    'public.firm_mark_paid(text, uuid, date, text)',
    'public.owner_firm_day(date)',
    'public.owner_undo_firm_day(uuid, date)',
    'public.export_my_data()'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'private.firm_rotate_link(uuid, text)',
    'private.accountant_link_reason_clear()',
    'private.firm_member_exit()',
    'private.firm_log_names()',
    'private.firm_log(uuid, uuid, uuid, text, text, uuid, text, jsonb, jsonb)',
    'private.firm_record_forget()',
    'private.firm_record_undo_prune()',
    'private.accountant_sees_file(text, boolean)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
  end loop;
end $$;
