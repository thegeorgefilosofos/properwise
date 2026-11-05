-- ═══════════════════════════════════════════════════════════════════════════
--  ΤΑ ΗΜΕΡΟΛΟΓΙΑ ΤΩΝ ΓΡΑΦΕΙΩΝ ΚΡΑΤΙΟΥΝΤΑΙ ΟΣΟ ΛΕΕΙ ΤΟ ΟΡΙΟ (20261105090000)
-- ─────────────────────────────────────────────────────────────────────────
--  Σε συναλλαγή που αναιρείται: γραμμές λίγο πριν και λίγο μετά από κάθε
--  όριο, το καθάρισμα, και τι έμεινε. Και ότι ο λογαριασμός του ιδιοκτήτη
--  παίρνει μαζί του και τα δύο ημερολόγια.
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
begin;
do $probe$
declare
  o uuid := 'f4000000-0000-4000-8000-000000000001';
  m uuid := 'f4000000-0000-4000-8000-0000000000a1';
  f uuid := 'f4000000-0000-4000-8000-00000000ff01';
  r json;
  n int;
begin
  if private.firm_log_retention('access') <> interval '12 months' or private.firm_log_retention('record') <> interval '5 years' then
    raise exception 'ΔΙΑΤΗΡΗΣΗ: τα όρια άλλαξαν χωρίς να αλλάξει αυτός ο έλεγχος (docs/legal)';
  end if;
  insert into auth.users(id, email) values (o, 'o@retention.test'), (m, 'm@retention.test');
  insert into public.firms(id, name, created_by) values (f, 'Γραφείο Διατήρησης', m);
  insert into public.firm_access_log(firm_id, member_id, owner_id, action, at) values
    (f, m, o, 'open', now() - interval '12 months' - interval '1 day'),
    (f, m, o, 'open', now() - interval '12 months' + interval '1 day');
  insert into public.firm_record_log(firm_id, member_id, owner_id, kind, table_name, row_id, action, at) values
    (f, m, o, 'bill', 'bills', gen_random_uuid(), 'insert', now() - interval '5 years' - interval '1 day'),
    (f, m, o, 'bill', 'bills', gen_random_uuid(), 'insert', now() - interval '5 years' + interval '1 day'),
    (f, m, o, 'bill', 'bills', gen_random_uuid(), 'insert', now() - interval '13 months');

  r := private.firm_logs_prune();
  select count(*) into n from public.firm_access_log where owner_id = o;
  if n <> 1 then raise exception 'ΔΙΑΤΗΡΗΣΗ: το ιστορικό ανοίγματος κράτησε % γραμμές αντί για 1', n; end if;
  select count(*) into n from public.firm_record_log where owner_id = o;
  if n <> 2 then raise exception 'ΔΙΑΤΗΡΗΣΗ: το ημερολόγιο κινήσεων κράτησε % γραμμές αντί για 2', n; end if;
  raise notice 'probe: το καθάρισμα κρατά 12 μήνες ανοίγματα και 5 έτη κινήσεις, όχι λιγότερα ούτε περισσότερα';

  delete from auth.users where id = o;
  select count(*) into n from public.firm_record_log where owner_id = o;
  select n + count(*) into n from public.firm_access_log where owner_id = o;
  if n <> 0 then raise exception 'ΔΙΑΤΗΡΗΣΗ: % γραμμές ημερολογίου έμειναν μετά τον λογαριασμό του ιδιοκτήτη', n; end if;
  raise notice 'probe: τα ημερολόγια φεύγουν μαζί με τον λογαριασμό του ιδιοκτήτη';

  set local role authenticated;
  begin
    perform private.firm_logs_prune();
    raise exception 'ΑΝΟΙΧΤΗ ΠΟΡΤΑ: ο χρήστης του API τρέχει το καθάρισμα';
  exception when insufficient_privilege then
    raise notice 'probe: το καθάρισμα δεν τρέχει από το API';
  end;
end $probe$;
rollback;
