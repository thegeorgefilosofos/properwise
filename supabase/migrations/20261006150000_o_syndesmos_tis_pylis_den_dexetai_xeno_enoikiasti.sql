-- ═══════════════════════════════════════════════════════════════════════════
-- Ο ΣΥΝΔΕΣΜΟΣ ΤΗΣ ΠΥΛΗΣ ΔΕΝ ΔΕΧΕΤΑΙ ΞΕΝΟ ΕΝΟΙΚΙΑΣΤΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΒΡΕΘΗΚΕ. Οι restrictive πολιτικές `parent_ins_portal_links` και
-- `parent_upd_portal_links` (20260810060000) ελέγχουν μόνο ότι το
-- `property_id` είναι δικό σου. Το `tenant_id` (20260804200000) δεν το
-- ελέγχει κανείς: η `own_portal_links` κοιτάζει μόνο το `user_id` και το
-- foreign key μόνο ότι ο ενοικιαστής υπάρχει κάπου. Δηλαδή ένας χρήστης
-- μπορεί να γράψει στον ΔΙΚΟ του σύνδεσμο το `tenant_id` ενός ενοικιαστή
-- ΑΛΛΟΥ λογαριασμού:
--
--     update portal_links set tenant_id = '<ενοικιαστής του θύματος>'
--      where property_id = '<δικό μου ακίνητο>';
--
-- Και η `get_portal_data` (SECURITY DEFINER, 20261003110000) διαβάζει τον
-- ενοικιαστή με `where id = v_link.tenant_id` χωρίς να ρωτήσει σε ποιο ακίνητο
-- ανήκει. Ανοίγοντας τον δικό του σύνδεσμο ο επιτιθέμενος βλέπει ονοματεπώνυμο,
-- μίσθωμα, εγγύηση, IBAN είσπραξης και τα απλήρωτα μισθώματα του ξένου
-- ενοικιαστή. Το uuid δεν μαντεύεται εύκολα, άρα το άνοιγμα θέλει διαρροή του
-- αναγνωριστικού· παραμένει όμως άνοιγμα.
--
-- ΤΙ ΜΕΤΡΗΘΗΚΕ ΣΤΗΝ ΠΑΡΑΓΩΓΗ (6/10/2026, μόνο ανάγνωση): 2 σύνδεσμοι, κανένας
-- με `tenant_id`· 0 σύνδεσμοι με ενοικιαστή άλλου ακινήτου ή άλλου χρήστη.
-- Δεν έχει διαρρεύσει τίποτα. Ο έλεγχος στο τέλος του αρχείου το ξαναμετρά
-- και σταματά αν βρει έστω έναν.
--
-- Η ΔΙΟΡΘΩΣΗ, ΣΕ ΔΥΟ ΣΗΜΕΙΑ.
--   1. Η ΕΙΣΟΔΟΣ. Οι δύο restrictive πολιτικές ζητούν επιπλέον ο ενοικιαστής
--      να είναι κενός ή να μένει στο ΙΔΙΟ ακίνητο με τον σύνδεσμο. Το ακίνητο
--      είναι ήδη δικό σου (`owns_parent_property`), άρα και ο ενοικιαστής
--      ανήκει στον ίδιο ιδιοκτήτη. Ο έλεγχος ζει σε βοηθό του `private` με
--      SECURITY DEFINER, ώστε ο συνεργάτης που δεν βλέπει τα οικονομικά
--      (`scope_fin_tenants`) να μπορεί ακόμη να δέσει τον σύνδεσμο στον
--      μισθωτή του ακινήτου που του ανατέθηκε. Ο βοηθός απαντά μόνο ναι ή όχι.
--   2. Η ΑΝΑΓΝΩΣΗ. Η `get_portal_data` φέρνει τον δεμένο ενοικιαστή μόνο όταν
--      μένει στο ακίνητο του συνδέσμου. Αλλιώς δεν φέρνει κανέναν: ΔΕΝ πέφτει
--      στον τρέχοντα ενοικιαστή του ακινήτου, γιατί ο σύνδεσμος ανήκει σε
--      πρόσωπο και αυτό ακριβώς απαγόρευσε η 20260804200000.
--
-- ΤΟ ΣΩΜΑ ΤΗΣ ΣΥΝΑΡΤΗΣΗΣ ΑΝΤΙΓΡΑΦΕΤΑΙ ΑΥΤΟΥΣΙΟ από το 20261003110000 (ίδιο με
-- το `pg_get_functiondef` της παραγωγής, 6/10/2026). Η μόνη διαφορά είναι το
-- `and property_id = v_link.property_id::uuid` στη δεμένη ανάγνωση. Το
-- `create or replace` κρατά υπογραφή, SECURITY DEFINER, search_path και
-- δικαιώματα.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ο βοηθός ─────────────────────────────────────────────────────────
-- Κενός ενοικιαστής περνά: ο σύνδεσμος χωρίς δέσιμο ακολουθεί τον τρέχοντα
-- ενοικιαστή του ακινήτου, όπως πριν.
create or replace function private.tenant_on_property(p_tenant uuid, p_property uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select p_tenant is null or exists (
    select 1 from tenants t
     where t.id = p_tenant and t.property_id = p_property
  )
$$;
alter function private.tenant_on_property(uuid, uuid) owner to postgres;

revoke execute on function private.tenant_on_property(uuid, uuid) from public, anon;
grant  execute on function private.tenant_on_property(uuid, uuid) to authenticated, service_role;

comment on function private.tenant_on_property(uuid, uuid) is
  'Μένει ο ενοικιαστής στο ακίνητο; Φράζει το δέσιμο συνδέσμου της πύλης σε ενοικιαστή άλλου ακινήτου ή λογαριασμού.';

-- ── 2. Οι πολιτικές της εισόδου ─────────────────────────────────────────
-- Ίδιο σχήμα με τις υπόλοιπες `parent_*`: μόνο WITH CHECK, χωρίς USING, ώστε
-- ορφανή γραμμή να μην κρύβεται από τον ιδιοκτήτη της.
drop policy if exists parent_ins_portal_links on public.portal_links;
create policy parent_ins_portal_links on public.portal_links as restrictive for insert
  with check (
    private.owns_parent_property(property_id)
    and private.tenant_on_property(tenant_id, property_id)
  );

drop policy if exists parent_upd_portal_links on public.portal_links;
create policy parent_upd_portal_links on public.portal_links as restrictive for update
  with check (
    private.owns_parent_property(property_id)
    and private.tenant_on_property(tenant_id, property_id)
  );

-- ── 3. Η ανάγνωση της πύλης ─────────────────────────────────────────────
create or replace function public.get_portal_data(p_token text, p_pin text default null)
returns json
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_gate text; v_link record; v_prop record; v_ten record; v_due json; v_total numeric;
begin
  v_gate := public.portal_pin_gate(p_token, p_pin);
  if v_gate = 'notfound' then return null; end if;
  if v_gate = 'locked' then return json_build_object('locked', true, 'rate_limited', true); end if;
  if v_gate = 'pin' then return json_build_object('locked', true); end if;

  select * into v_link from portal_links where token = p_token;

  select name, address, prop_type into v_prop from user_properties where id = v_link.property_id::uuid;

  -- Με δεμένο ενοικιαστή φέρνουμε ΕΚΕΙΝΟΝ: ο σύνδεσμος ανήκει σε πρόσωπο, όχι
  -- σε ακίνητο και ο προηγούμενος κάτοικος δεν επιτρέπεται να δει τον επόμενο.
  -- Και μόνο αν μένει στο ακίνητο του συνδέσμου: ξένος ενοικιαστής δεν φέρνει
  -- τίποτα, ούτε τον τρέχοντα.
  if v_link.tenant_id is not null then
    select id, monthly_rent, lease_start, lease_end, deposit_amount, full_name, rent_iban into v_ten
      from tenants where id = v_link.tenant_id and property_id = v_link.property_id::uuid;
  else
    select id, monthly_rent, lease_start, lease_end, deposit_amount, full_name, rent_iban into v_ten
      from tenants where id = public.current_tenant_of(v_link.property_id);
  end if;

  select coalesce(json_agg(json_build_object(
           'id', rp.id, 'year', rp.period_year, 'month', rp.period_month,
           'amount', rp.amount, 'due_date', rp.due_date, 'declared', rp.tenant_declared
         ) order by rp.period_year, rp.period_month), '[]'::json),
         coalesce(sum(rp.amount), 0)
    into v_due, v_total
    from rent_payments rp
    where rp.tenant_id = v_ten.id and rp.paid = false;
  return json_build_object(
    'property', json_build_object('name', v_prop.name, 'address', v_prop.address, 'type', v_prop.prop_type),
    'tenant',   json_build_object('name', v_ten.full_name, 'rent', v_ten.monthly_rent,
      'lease_start', v_ten.lease_start, 'lease_end', v_ten.lease_end, 'deposit', v_ten.deposit_amount,
      'rent_iban', v_ten.rent_iban),
    'payment_link', v_link.payment_link,
    'due',      v_due,
    'total_due', v_total
  );
end; $$;

-- ── 4. Απόδειξη ─────────────────────────────────────────────────────────
-- Καμία υπάρχουσα γραμμή δεν παραβιάζει τον νέο κανόνα. Αν βρεθεί έστω μία,
-- κάποιος έχει ήδη δέσει ξένο ενοικιαστή: σταματάμε για να το δει άνθρωπος,
-- αντί να το κρύψει σιωπηλά η νέα ανάγνωση.
do $chk$
declare n int;
begin
  select count(*) into n
    from public.portal_links pl
    left join public.tenants t on t.id = pl.tenant_id
   where pl.tenant_id is not null
     and (t.id is null or t.property_id is distinct from pl.property_id::uuid);
  if n <> 0 then
    raise exception 'portal_links: % σύνδεσμοι δεμένοι σε ενοικιαστή άλλου ακινήτου', n;
  end if;

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'portal_links'
     and policyname in ('parent_ins_portal_links', 'parent_upd_portal_links')
     and with_check like '%tenant_on_property%';
  if n <> 2 then
    raise exception 'portal_links: % από 2 πολιτικές εισόδου ελέγχουν τον ενοικιαστή', n;
  end if;
end
$chk$;
