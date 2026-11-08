-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΓΡΑΦΕΙΟ ΑΠΟΔΕΧΕΤΑΙ ΤΟΥΣ ΟΡΟΥΣ ΕΠΕΞΕΡΓΑΣΙΑΣ ΠΡΙΝ ΔΕΙ ΠΕΛΑΤΗ
-- ─────────────────────────────────────────────────────────────────────────
-- Για όσα καταχωρεί στον λογαριασμό του ιδιοκτήτη το γραφείο είναι εκτελών
-- (Οροι `#grafeia`). Η σχέση εκτελούντος θέλει σύμβαση με το περιεχόμενο του
-- άρθρου 28§3 ΓΚΠΔ. Ο όρος των Όρων χρήσης μόνος του δεν αποδεικνύει ότι το
-- γραφείο τον δέχτηκε: εδώ γράφεται ρητή αποδοχή, με έκδοση και ημερομηνία.
--
-- ΔΥΟ ΑΠΟΔΟΧΕΣ, ΚΑΙ ΟΙ ΔΥΟ ΣΤΗΝ ΤΡΕΧΟΥΣΑ ΕΚΔΟΣΗ:
--   · του γραφείου (`firms.terms_*`): τη δίνει ο Υπεύθυνος, στη δημιουργία ή
--     όταν αλλάξει η έκδοση·
--   · του μέλους (`firm_members.terms_*`): τη δίνει κάθε μέλος, στην αποδοχή
--     της πρόσκλησης ή όταν αλλάξει η έκδοση.
-- Οσο λείπει μία από τις δύο, το μέλος ΔΕΝ βλέπει κανέναν πελάτη: ούτε
-- φάκελο (`firm_client_data`), ούτε εγγραφή (`firm_write_gate`), ούτε αρχεία
-- (storage). Ολα περνούν από το `private.firm_sees_owner`, οπότε ο έλεγχος
-- μπαίνει εκεί, μία φορά.
--
-- ΚΑΜΙΑ ΑΠΟΔΟΧΗ ΔΕΝ ΣΥΜΠΛΗΡΩΝΕΤΑΙ ΑΠΟ ΤΗ ΜΕΤΑΝΑΣΤΕΥΣΗ. Τα γραφεία που έφτιαξε
-- η μεταφορά του 20261104120000 δεν έχουν δεχτεί τίποτα· η πρώτη τους
-- επίσκεψη στον χώρο του λογιστή τους ζητά την αποδοχή.
--
-- Η ΕΚΔΟΣΗ ΕΙΝΑΙ ΤΟ `FIRM_TERMS_VERSION` του lib/legal/firms.ts. Το
-- lib/legal/firms.test.ts ελέγχει ότι οι δύο λένε το ίδιο.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.firms add column if not exists terms_version text;
alter table public.firms add column if not exists terms_accepted_at timestamptz;
alter table public.firms add column if not exists terms_accepted_by uuid references auth.users(id) on delete set null;
create index if not exists firms_terms_accepted_by_idx on public.firms (terms_accepted_by);
alter table public.firm_members add column if not exists terms_version text;
alter table public.firm_members add column if not exists terms_accepted_at timestamptz;

create or replace function private.firm_terms_version()
returns text
language sql immutable
set search_path = ''
as $$
  select '2026-11'::text;  -- FIRM_TERMS_VERSION, lib/legal/firms.ts
$$;

/* Εχουν το γραφείο ΚΑΙ το μέλος δεχτεί την τρέχουσα έκδοση; */
create or replace function private.firm_terms_ok(p_user uuid)
returns boolean
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select p_user is not null and exists (
    select 1 from public.firm_members m join public.firms f on f.id = m.firm_id
     where m.user_id = p_user and m.status = 'active'
       and m.terms_version = private.firm_terms_version()
       and f.terms_version = private.firm_terms_version());
$$;

-- ── Ο ΕΝΑΣ ΕΛΕΓΧΟΣ ΠΟΥ ΠΕΡΝΟΥΝ ΟΛΑ ─────────────────────────────────────────
-- Ιδιο με το 20261104120000, με την αποδοχή των όρων.
create or replace function private.firm_sees_owner(p_user uuid, p_owner uuid, p_act boolean)
returns boolean
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select p_user is not null and p_owner is not null and p_user <> p_owner
     and private.firm_terms_ok(p_user)
     and exists (
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

-- Η παλιά διαδρομή χωρίς γραφείο (γραμμή με `firm_id is null`) δεν παρακάμπτει
-- τον έλεγχο: θέλει κι αυτή αποδοχή, άρα ενεργό μέλος γραφείου.
create or replace function public.accountant_link_live(p_accountant uuid, p_owner uuid)
returns boolean
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$
  select (private.firm_terms_ok(p_accountant) and exists (
    select 1
      from accountant_clients ac
      join accountant_links al
        on al.user_id = ac.owner_id
       and al.active
       and al.token = ac.claimed_token
     where ac.accountant_id = p_accountant
       and ac.owner_id = p_owner
       and ac.firm_id is null
       and ac.active
       and (al.expires_at is null or al.expires_at > now())
  )) or private.firm_sees_owner(p_accountant, p_owner, true);
$$;

-- ── Η ΑΠΟΔΟΧΗ ──────────────────────────────────────────────────────────────
-- Η οθόνη στέλνει την έκδοση που ΕΔΕΙΞΕ. Αν δεν είναι η τρέχουσα, η αποδοχή
-- δεν γράφεται: κανείς δεν δέχεται κείμενο που δεν είδε.
create or replace function public.firm_accept_terms(p_version text)
returns json
language plpgsql security definer
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
  if v_me is null then return json_build_object('ok', false, 'reason', 'anonymous'); end if;
  v_firm := private.firm_of(v_me);
  if v_firm is null then return json_build_object('ok', false, 'reason', 'no_firm'); end if;
  if p_version is distinct from private.firm_terms_version() then
    return json_build_object('ok', false, 'reason', 'terms_version');
  end if;
  v_role := private.firm_role(v_me, v_firm);
  update firm_members set terms_version = p_version, terms_accepted_at = now()
   where firm_id = v_firm and user_id = v_me and status = 'active';
  if v_role = 'manager' then
    update firms set terms_version = p_version, terms_accepted_at = now(), terms_accepted_by = v_me
     where id = v_firm;
  end if;
  return json_build_object('ok', true, 'firm', (select f.terms_version = p_version from firms f where f.id = v_firm));
end $$;

-- ── Το γραφείο μου: ίδιο με το 20261104120000, με τις δύο αποδοχές ─────────
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
      'termsVersion', f.terms_version,
      'myTermsVersion', (select m.terms_version from firm_members m where m.firm_id = f.id and m.user_id = v_me and m.status = 'active'),
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

do $$
declare f text;
begin
  foreach f in array array[
    'private.firm_terms_version()', 'private.firm_terms_ok(uuid)', 'private.firm_sees_owner(uuid, uuid, boolean)',
    'public.accountant_link_live(uuid, uuid)', 'public.firm_accept_terms(text)', 'public.my_firm()'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
  end loop;
  -- Την καλεί μόνο άλλη SQL (anon-surface.sql).
  revoke all on function public.accountant_link_live(uuid, uuid) from authenticated;
  -- Οι βοηθοί τρέχουν μέσα σε SECURITY DEFINER· στο API μόνο η αποδοχή και το γραφείο μου.
  execute 'grant execute on function public.firm_accept_terms(text) to authenticated';
  execute 'grant execute on function public.my_firm() to authenticated';
end $$;
