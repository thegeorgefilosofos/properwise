-- ═══════════════════════════════════════════════════════════════════════════
--  ΠΕΑ: ΟΙ ΣΤΗΛΕΣ ΤΟΥ ΑΚΙΝΗΤΟΥ ΚΑΙ Η ΛΗΞΗ ΠΟΥ ΗΞΕΡΕ ΤΟ ΗΜΕΡΟΛΟΓΙΟ
-- ─────────────────────────────────────────────────────────────────────────
--  1. Ο περιορισμός user_properties_pea_dates_chk κόβει έκδοση μετά τη λήξη.
--  2. Η μεταφορά (20261112161500) γράφει στη κενή `pea_expiry` την πιο πρόσφατη
--     «Λήξη ΠΕΑ» του ίδιου ακινήτου και χρήστη, δεν αγγίζει γεμάτη στήλη ούτε
--     ξένο γεγονός και ξανατρέχει χωρίς αλλαγή.
--  Ολα μέσα σε συναλλαγή που ακυρώνεται: η βάση μένει όπως ήταν.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP 1
begin;

do $probe$
declare
  u  uuid := '7e7e7e7e-0000-4000-8000-00000000a001';
  u2 uuid := '7e7e7e7e-0000-4000-8000-00000000a002';
  p1 uuid := '7e7e7e7e-0000-4000-8000-00000000b001';
  p2 uuid := '7e7e7e7e-0000-4000-8000-00000000b002';
  p3 uuid := '7e7e7e7e-0000-4000-8000-00000000b003';
begin
  insert into auth.users(id, email) values (u, 'pea@probe.test'), (u2, 'pea2@probe.test');
  insert into public.user_properties(id, user_id, name) values (p1, u, 'Χωρίς στήλη');
  insert into public.user_properties(id, user_id, name, pea_expiry) values (p2, u, 'Με στήλη', '2031-01-01');
  insert into public.user_properties(id, user_id, name) values (p3, u, 'Χωρίς γεγονός');
  insert into public.calendar_events(property_id, user_id, title, event_date) values
    (p1, u, 'Λήξη ΠΕΑ', '2029-05-01'),
    (p1, u, 'Λήξη ΠΕΑ', '2034-05-01'),
    (p1, u, 'Λήξη ασφάλισης', '2040-01-01'),
    (p2, u, 'Λήξη ΠΕΑ', '2035-01-01');

  begin
    update public.user_properties set pea_issued = '2032-01-01' where id = p2;
    raise exception 'ΣΧΗΜΑ: δέχτηκε έκδοση ΠΕΑ μετά τη λήξη';
  exception when check_violation then null;
  end;
  raise notice 'probe: η έκδοση του ΠΕΑ δεν περνά τη λήξη';
end $probe$;

\i supabase/migrations/20261112161500_i_lixi_pea_apo_to_imerologio.sql
\i supabase/migrations/20261112161500_i_lixi_pea_apo_to_imerologio.sql

do $probe$
declare v date;
begin
  select pea_expiry into v from public.user_properties where id = '7e7e7e7e-0000-4000-8000-00000000b001';
  if v is distinct from '2034-05-01'::date then raise exception 'ΜΕΤΑΦΟΡΑ: πήρε % αντί για 2034-05-01', v; end if;
  select pea_expiry into v from public.user_properties where id = '7e7e7e7e-0000-4000-8000-00000000b002';
  if v is distinct from '2031-01-01'::date then raise exception 'ΜΕΤΑΦΟΡΑ: άλλαξε γεμάτη στήλη σε %', v; end if;
  select pea_expiry into v from public.user_properties where id = '7e7e7e7e-0000-4000-8000-00000000b003';
  if v is not null then raise exception 'ΜΕΤΑΦΟΡΑ: έγραψε λήξη χωρίς γεγονός (%)', v; end if;
  raise notice 'probe: η λήξη ΠΕΑ του ημερολογίου περνά μόνο στην κενή στήλη, η πιο πρόσφατη';
end $probe$;

rollback;
