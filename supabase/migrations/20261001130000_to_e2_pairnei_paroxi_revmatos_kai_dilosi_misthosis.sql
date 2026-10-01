-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ Ε2 ΠΑΙΡΝΕΙ ΑΡΙΘΜΟ ΠΑΡΟΧΗΣ ΡΕΥΜΑΤΟΣ, ΑΡΙΘΜΟ ΔΗΛΩΣΗΣ ΜΙΣΘΩΣΗΣ ΚΑΙ ΣΥΝΙΔΙΟΚΤΗΤΕΣ
-- ─────────────────────────────────────────────────────────────────────────
-- ΓΙΑΤΙ ΑΓΓΙΖΕΤΑΙ ΤΟ supabase/migrations. Η πηγή είναι το επίσημο έντυπο Ε2
-- 2025 της ΑΑΔΕ, Φ-01.002 / Έκδοση 2026, «Οδηγίες για τη συμπλήρωση του
-- εντύπου»:
--
--   8. «Στη στήλη 18 συμπληρώνεται υποχρεωτικά ο αριθμός παροχής ΔΕΗ του
--      ακινήτου ακόμη και εάν έχει διακοπεί η ηλεκτροδότηση ή είναι κενό.»
--      Η κεφαλίδα της στήλης ζητά τα 9 πρώτα ψηφία.
--   9. «Στη στήλη 19 συμπληρώνεται ο αριθμός της Δήλωσης Πληροφοριακών
--      Στοιχείων Μίσθωσης Ακίνητης Περιουσίας.»
--  11. Τα «Συμπληρωματικά στοιχεία ακίνητης περιουσίας» (πίνακας I της
--      δεύτερης σελίδας) ζητούν για κάθε συνιδιοκτήτη ονοματεπώνυμο, ΑΦΜ,
--      διεύθυνση και ποσοστό (στήλες 7 έως 10).
--
-- Η εφαρμογή δεν είχε πού να κρατήσει κανένα από τα τρία: οι στήλες 18 και 19
-- έβγαιναν πάντα κενές και οι συνιδιοκτήτες ζούσαν ως σκέτα ονόματα ή μόνο στον
-- περιηγητή (OwnerSplit, localStorage), όπου δεν τους έβλεπε το έντυπο.
--
-- ΤΙ ΠΡΟΣΤΙΘΕΤΑΙ. ΜΟΝΟ ΠΡΟΣΘΕΤΙΚΑ ΚΑΙ ΜΕ ΦΥΛΑΞΗ ΓΙΑ ΔΕΥΤΕΡΟ ΤΡΕΞΙΜΟ:
--   1. `user_properties.power_supply_no`: ό,τι πληκτρολόγησε ο χρήστης. Το
--      έντυπο κρατά τα 9 πρώτα ψηφία κατά την εξαγωγή (lib/billing/e2.ts).
--   2. `tenants.aade_lease_decl_ref`: ο αριθμός της δήλωσης μίσθωσης ΑΥΤΗΣ της
--      μίσθωσης. Ήταν μόνο στο activity_log, ένας ανά ακίνητο, οπότε ακίνητο
--      με δύο μισθώσεις στο έτος έγραφε τον ίδιο αριθμό και στις δύο.
--   3. `user_properties.co_owners`: η ίδια στήλη jsonb, με αντικείμενα
--      [{name, afm, pct, address}] αντί για σκέτα ονόματα. Τα υπάρχοντα ονόματα
--      γίνονται {"name": …}, ώστε να μη χαθεί κανένα.
--   4. `e2_prefilled.power_supply_no`: η στήλη 18 όπως τη γράφει η ΑΑΔΕ, για
--      να τη συγκρίνει το lib/billing/e2Reconcile.ts. Η συνάρτηση αντικατάστασης
--      ξαναγράφεται με την ίδια υπογραφή και ένα πεδίο παραπάνω.
--
-- ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΙ. Καμία νέα πολιτική: οι στήλες ανήκουν σε πίνακες με RLS ανά
-- γραμμή και χωρίς δικαιώματα ανά στήλη, οπότε τις διαβάζει και τις γράφει
-- ακριβώς όποιος διαβάζει και γράφει τη γραμμή τους. Αποδεικνύεται στο
-- scripts/db/rls-probe.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ΣΤΗΛΗ 18: ΑΡΙΘΜΟΣ ΠΑΡΟΧΗΣ ΡΕΥΜΑΤΟΣ ────────────────────────────────
alter table public.user_properties add column if not exists power_supply_no text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_properties_power_supply_no_chk') then
    alter table public.user_properties add constraint user_properties_power_supply_no_chk
      check (power_supply_no is null or power_supply_no ~ '^[0-9]{1,40}$');
  end if;
end $$;
comment on column public.user_properties.power_supply_no is
  'Αριθμός παροχής ρεύματος (ΔΕΗ), μόνο ψηφία, όπως τον έγραψε ο χρήστης. Το Ε2 (στήλη 18, οδηγία 8 του Φ-01.002/Έκδοση 2026) κρατά τα 9 πρώτα.';

-- ── 2. ΣΤΗΛΗ 19: ΑΡΙΘΜΟΣ ΔΗΛΩΣΗΣ ΜΙΣΘΩΣΗΣ, ΑΝΑ ΜΙΣΘΩΣΗ ──────────────────
alter table public.tenants add column if not exists aade_lease_decl_ref text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_aade_lease_decl_ref_chk') then
    alter table public.tenants add constraint tenants_aade_lease_decl_ref_chk
      check (aade_lease_decl_ref is null or aade_lease_decl_ref ~ '^[0-9]{1,40}$');
  end if;
end $$;
comment on column public.tenants.aade_lease_decl_ref is
  'Αριθμός Δήλωσης Πληροφοριακών Στοιχείων Μίσθωσης Ακίνητης Περιουσίας της ΑΑΔΕ, μόνο ψηφία. Στήλη 19 του Ε2 (οδηγία 9 του Φ-01.002/Έκδοση 2026).';

-- ── 3. ΣΥΝΙΔΙΟΚΤΗΤΕΣ ΜΕ ΑΦΜ, ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΠΟΣΟΣΤΟ ──────────────────────
-- Τα σκέτα ονόματα γίνονται αντικείμενα. Δεύτερο τρέξιμο δεν βρίσκει πια
-- κείμενο μέσα στον πίνακα, οπότε δεν αλλάζει τίποτα.
update public.user_properties
   set co_owners = (
     select coalesce(jsonb_agg(
       case when jsonb_typeof(e) = 'string' then jsonb_build_object('name', e #>> '{}') else e end
       order by ord), '[]'::jsonb)
       from jsonb_array_elements(co_owners) with ordinality as x(e, ord)
   )
 where jsonb_typeof(co_owners) = 'array'
   and exists (select 1 from jsonb_array_elements(co_owners) e where jsonb_typeof(e) = 'string');

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_properties_co_owners_array_chk') then
    alter table public.user_properties add constraint user_properties_co_owners_array_chk
      check (co_owners is null or (jsonb_typeof(co_owners) = 'array' and jsonb_array_length(co_owners) <= 99));
  end if;
end $$;
comment on column public.user_properties.co_owners is
  'Οι ΑΛΛΟΙ συνιδιοκτήτες του ακινήτου, jsonb [{name, afm, pct, address}]. Τους γράφουν ο οδηγός ακινήτου και η Κατανομή σε συνιδιοκτήτες· τους διαβάζει το Ε2 (Συμπληρωματικά στοιχεία, πίνακας I, στήλες 7 έως 10).';

-- ── 4. Η ΣΤΗΛΗ 18 ΤΟΥ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΟΥ ───────────────────────────────────
alter table public.e2_prefilled add column if not exists power_supply_no text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'e2_prefilled_power_supply_no_chk') then
    alter table public.e2_prefilled add constraint e2_prefilled_power_supply_no_chk
      check (power_supply_no is null or power_supply_no ~ '^[0-9]{1,40}$');
  end if;
end $$;

-- Ίδια υπογραφή με το 20261001120000: το `create or replace` κρατά δικαιώματα
-- και σχόλιο. Η μόνη αλλαγή είναι το `power_supply_no` στη λίστα πεδίων.
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
    lease_decl_ref, power_supply_no, source, source_file
  )
  select p_owner, p_year, p_owner_afm, r.row_no, nullif(r.atak, ''), nullif(r.address, ''),
         nullif(r.category, ''), nullif(r.tenant_name, ''), nullif(r.tenant_afm, ''),
         r.lease_from, r.lease_to, r.months, r.monthly_rent, r.ownership_pct,
         coalesce(r.gross, 0), coalesce(r.income_column, 13), nullif(r.lease_decl_ref, ''),
         nullif(r.power_supply_no, ''), p_source, nullif(p_file, '')
    from jsonb_to_recordset(p_rows) as r(
      row_no integer, atak text, address text, category text, tenant_name text, tenant_afm text,
      lease_from date, lease_to date, months smallint, monthly_rent numeric, ownership_pct numeric,
      gross numeric, income_column smallint, lease_decl_ref text, power_supply_no text
    );
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.e2_prefilled_replace(uuid, integer, text, text, text, jsonb) from public, anon;
grant execute on function public.e2_prefilled_replace(uuid, integer, text, text, text, jsonb) to authenticated;
