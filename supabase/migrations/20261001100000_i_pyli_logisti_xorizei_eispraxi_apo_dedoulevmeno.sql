-- ═══════════════════════════════════════════════════════════════════════════
-- Η ΠΥΛΗ ΤΟΥ ΛΟΓΙΣΤΗ ΕΛΕΓΕ «ΕΙΣΠΡΑΞΕΙΣ» ΓΙΑ ΠΟΣΑ ΠΟΥ ΔΕΝ ΕΙΣΠΡΑΧΘΗΚΑΝ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΑ ΣΦΑΛΜΑΤΑ. Η `get_accountant_data` (τελευταία μορφή στο
-- 20260925190000_idioktitis_dorean_noa_4_99.sql) έδινε τρία νούμερα που ο
-- λογιστής διάβαζε αλλιώς από ό,τι ήταν:
--
--   1. `rent_collected` άθροιζε ΟΛΕΣ τις περιόδους της χρήσης, πληρωμένες ή
--      όχι. Η οθόνη το τύπωνε ως «Εισπράξεις της χρήσης» και ο τύπος του
--      (app/accountant/statement.ts) το περιέγραφε ως «Εισπραχθέν». Ενας
--      μισθωτής που χρωστά έξι μήνες εμφανιζόταν ως πλήρως εξοφλημένος.
--
--   2. `rent_months` μετρούσε ΓΡΑΜΜΕΣ, όχι μήνες. Η τριμηνιαία δόση πιάνει
--      μία γραμμή για τρεις μήνες (lib/rent/frequency.ts), οπότε μια ολόκληρη
--      χρονιά τριμηνιαίου μισθώματος έβγαινε «4».
--
--   3. Οι διαμονές κρατιούνταν κατά έτος άφιξης και μετρούσαν ολόκληρες. Το
--      Ε2 τις μοιράζει με τις νύχτες (lib/tax/shortTermTax.ts, `yearShare`):
--      η διαμονή 28/12 έως 5/1 έδινε όλο το ποσό της στην πρώτη χρονιά στην
--      πύλη και το μισό στο έντυπο. Η δεύτερη χρονιά δεν την έβλεπε καθόλου.
--
-- ΤΙ ΑΛΛΑΖΕΙ.
--   · `rent_due`: ΝΕΟ. Ολες οι περίοδοι της χρήσης, ανεξάρτητα από την
--     είσπραξη. Είναι η βάση του Ε2 (δεδουλευμένα, lib/billing/e2.ts) και
--     αυτό το ποσό μπαίνει στα έσοδα της κατάστασης.
--   · `rent_collected`: ΜΟΝΟ όσα έχουν `paid = true`, η ίδια σημασία με το
--     `rentCollectedYear` της Λογιστικής και το `rentCollectionMode`.
--   · `rent_months`: διακριτοί ημερολογιακοί μήνες της χρήσης που καλύπτουν οι
--     περίοδοι, με το βήμα της συχνότητας του μισθωτή (`payment_frequency`).
--     Δόση Δεκεμβρίου έως Φεβρουαρίου μετρά Ιανουάριο και Φεβρουάριο στην
--     επόμενη χρήση.
--   · `rent_paid_with_method`, `rent_paid_cash`, `lease_via_bank`: ό,τι
--     χρειάζεται η οθόνη για να κρίνει την τεκμαρτή έκπτωση από τη χρήση 2027
--     με τον ΙΔΙΟ κανόνα της Λογιστικής (lib/tax/rentCollectionMode.ts). Είναι
--     πλήθη και ένα ναι ή όχι: καμία ταυτότητα τρίτου.
--   · `stays`: κάθε διαμονή που έχει έστω μία νύχτα μέσα στη χρήση. Το μερίδιο
--     το υπολογίζει η οθόνη με την ίδια `yearShare` του Ε2.
--
-- Η ΥΠΟΓΡΑΦΗ ΔΕΝ ΑΛΛΑΖΕΙ. Ιδια ορίσματα, ίδιο json, μόνο πεδία προστίθενται.
-- Το `set search_path` μένει· η συνάρτηση μένει στο scripts/db/anon-surface.sql.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.get_accountant_data(p_token text, p_year integer)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_link record; v_props json; v_owner text;
  v_from date; v_to date;
begin
  select * into v_link from accountant_links where token = p_token and active = true and (expires_at is null or expires_at > now());
  if not found then return null; end if;
  v_from := make_date(p_year, 1, 1);
  v_to   := make_date(p_year + 1, 1, 1);

  -- Η ΚΛΕΙΔΑΡΙΑ ΤΟΥ ΒΑΘΜΟΥ 1 ΕΦΥΓΕ (20260925190000): ο δωρεάν «Ιδιοκτήτης»
  -- έχει το Ε2 και την πύλη. Η απόφαση μένει ίδια σε αυτή τη γραφή.

  select coalesce(nullif(trim(owner_name), ''), full_name) into v_owner from billing_profiles where user_id = v_link.user_id;
  select json_agg(sub.row) into v_props from (
    select json_build_object(
      'name', p.name, 'atak', p.atak, 'address', p.address, 'prop_type', p.prop_type,
      'sqm', p.sqm,
      'ownership', p.ownership,
      -- ΤΟ ΕΝΟΙΚΙΟ ΤΗΣ ΧΡΗΣΗΣ, ΟΠΩΣ ΣΤΟ Ε2: όλες οι περίοδοι, ανεξάρτητα από την είσπραξη.
      'rent_due', coalesce((
        select sum(rp.amount) from rent_payments rp
        where rp.property_id = p.id and rp.user_id = v_link.user_id and rp.period_year = p_year
      ), 0),
      -- ΟΣΑ ΟΝΤΩΣ ΕΙΣΠΡΑΧΘΗΚΑΝ από τις περιόδους της χρήσης.
      'rent_collected', coalesce((
        select sum(rp.amount) from rent_payments rp
        where rp.property_id = p.id and rp.user_id = v_link.user_id and rp.period_year = p_year
          and rp.paid is true
      ), 0),
      -- ΜΗΝΕΣ, ΟΧΙ ΓΡΑΜΜΕΣ. Κάθε περίοδος απλώνεται στους μήνες που καλύπτει.
      'rent_months', (
        select count(distinct cov.m) from rent_payments rp
        left join tenants t on t.id = rp.tenant_id
        cross join lateral generate_series(0,
          case t.payment_frequency when 'quarterly' then 2 when 'bimonthly' then 1 else 0 end) k
        cross join lateral (
          select (make_date(rp.period_year, rp.period_month, 1) + make_interval(months => k))::date as m
        ) cov
        where rp.property_id = p.id and rp.user_id = v_link.user_id
          and rp.period_year between p_year - 1 and p_year
          and rp.period_month between 1 and 12
          and cov.m >= v_from and cov.m < v_to
      ),
      -- Ο ΤΡΟΠΟΣ ΕΙΣΠΡΑΞΗΣ, ΣΕ ΠΛΗΘΗ. Ιδιο φίλτρο με το `rentCollectionMode`.
      'rent_paid_with_method', (
        select count(*) from rent_payments rp
        where rp.property_id = p.id and rp.user_id = v_link.user_id and rp.period_year = p_year
          and rp.paid is true and coalesce(trim(rp.method), '') <> ''
      ),
      'rent_paid_cash', (
        select count(*) from rent_payments rp
        where rp.property_id = p.id and rp.user_id = v_link.user_id and rp.period_year = p_year
          and rp.paid is true and trim(rp.method) = 'Μετρητά'
      ),
      -- Η ΠΡΟΘΕΣΗ ΤΗΣ ΜΙΣΘΩΣΗΣ, μόνο όταν δεν υπάρχει απόδειξη. Κενό χωρίς μισθωτή.
      'lease_via_bank', (
        select t.e_payment is not false from tenants t where t.id = public.current_tenant_of(p.id)
      ),
      -- Συμφραζόμενο, ΟΧΙ έσοδο: τι νοικιάζεται σήμερα.
      'rent_monthly', (
        select t.monthly_rent from tenants t where t.id = public.current_tenant_of(p.id)
      ),
      'expenses', coalesce((
        select json_agg(json_build_object('category', e.category, 'amount', e.amount, 'date', e.date))
        from expenses e
        where e.property_id = p.id and e.user_id = v_link.user_id and extract(year from e.date) = p_year
      ), '[]'::json),
      -- ΚΑΘΕ ΔΙΑΜΟΝΗ ΜΕ ΝΥΧΤΑ ΜΕΣΑ ΣΤΗ ΧΡΗΣΗ. Χωρίς αναχώρηση, το έτος άφιξης.
      'stays', coalesce((
        select json_agg(json_build_object(
          'check_in', s.check_in, 'check_out', s.check_out, 'nights', s.nights,
          'total', s.total,
          'gross_guest_paid', s.gross_guest_paid,
          'climate_levy', s.climate_levy,
          'platform_fee', s.platform_fee,
          'amount_basis', s.amount_basis) order by s.check_in)
        from client_stays s
        where s.property_id = p.id and s.user_id = v_link.user_id
          and (
            (s.check_in is not null and s.check_out is not null and s.check_out > s.check_in
              and s.check_in < v_to and s.check_out > v_from)
            or extract(year from coalesce(s.check_in, s.check_out)) = p_year
          )
      ), '[]'::json)
    ) as row
    from user_properties p where p.user_id = v_link.user_id order by p.name
  ) sub;
  return json_build_object('owner', v_owner, 'year', p_year, 'properties', coalesce(v_props, '[]'::json));
end; $function$;

grant execute on function public.get_accountant_data(text, integer) to anon, authenticated, service_role;
revoke execute on function public.get_accountant_data(text, integer) from public;

comment on function public.get_accountant_data(text, integer) is
  'Η εικόνα της χρήσης για τον λογιστή. Επιστρέφει null αν ο σύνδεσμος δεν '
  'είναι ενεργός. rent_due: δεδουλευμένο της χρήσης, η βάση του Ε2. '
  'rent_collected: μόνο οι πληρωμένες περίοδοι. rent_months: μήνες που καλύπτονται, '
  'όχι γραμμές. Οι διαμονές δίνονται με την ανάλυση ποσού τους και μοιράζονται '
  'στην οθόνη με τις νύχτες, όπως στο Ε2. Καμία ταυτότητα τρίτου.';
