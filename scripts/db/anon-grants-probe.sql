-- ═══════════════════════════════════════════════════════════════════════════
-- Ο ANON ΔΕΝ ΕΧΕΙ ΔΙΚΑΙΩΜΑ ΣΕ ΠΙΝΑΚΑ ΧΡΗΣΤΗ, ΟΥΤΕ ΣΗΜΕΡΑ ΟΥΤΕ ΣΕ ΑΥΡΙΑΝΟ ΠΙΝΑΚΑ
-- ─────────────────────────────────────────────────────────────────────────
-- Ως τις 10/11/2026 ο anon είχε SELECT/INSERT/UPDATE/DELETE σε περίπου 70
-- πίνακες (tenants, bank_transactions, billing_profiles, app_admins…), την
-- προεπιλογή της Supabase. Τους έφραζε ΜΟΝΟ η RLS. Το migration
-- 20261110140000 τα αφαίρεσε. Αυτός ο έλεγχος κρατά την κατάσταση: κοκκινίζει
-- αν ένα migration ξαναδώσει δικαίωμα στον anon, αν οι μελλοντικοί πίνακες
-- ξαναγεννιούνται ανοιχτοί ή αν το bucket των φωτογραφιών ξαναγίνει δημόσιο.
--
-- Τρέχει ΠΡΙΝ από το rls-probe.sql, που δίνει σκόπιμα GRANT σε όλους τους
-- πίνακες για να δοκιμάσει την RLS μόνη της (scripts/db-replay.sh).
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

do $probe$
declare bad text;
begin
  -- 1. Μόνο SELECT, μόνο στα δεδομένα αναφοράς που διαβάζουν οι δημόσιες σελίδες.
  select string_agg(format('%s(%s)', c.relname, pr), ', ' order by c.relname) into bad
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) pr
   where n.nspname = 'public' and c.relkind in ('r','p','v','m')
     and has_table_privilege('anon', c.oid, pr)
     and not (pr = 'SELECT' and c.relname in
       ('bank_rates','energy_tariffs','loan_programs','market_rates','product_updates','active_loan_programs'));
  if bad is not null then
    raise exception E'ΕΚΘΕΣΗ ANON: δικαιώματα σε πίνακες χρηστών: %\n  Ο anon διαβάζει μόνο δεδομένα αναφοράς. Αν πίνακας πρέπει να είναι δημόσιος, πρόσθεσέ τον εδώ με τον λόγο.', bad;
  end if;
  raise notice 'probe: ο anon διαβάζει μόνο τα έξι δημόσια δεδομένα αναφοράς';

  -- 2. Ο πίνακας του αύριο γεννιέται κλειστός.
  create table public.__anon_default_probe (id int);
  if has_table_privilege('anon', 'public.__anon_default_probe', 'SELECT') then
    drop table public.__anon_default_probe;
    raise exception 'ΕΚΘΕΣΗ ANON: νέος πίνακας στο public γεννιέται ανοιχτός στον anon (alter default privileges)';
  end if;
  drop table public.__anon_default_probe;
  raise notice 'probe: νέος πίνακας γεννιέται κλειστός στον anon';

  -- 3. Συναρτήσεις: λειτουργικά μόνο σε admin, σχέσεις οργανισμού μόνο σε συνδεδεμένους.
  if has_function_privilege('anon', 'public.bank_feed_held()', 'EXECUTE') then
    raise exception 'ΕΚΘΕΣΗ ANON: ο anon εκτελεί την bank_feed_held';
  end if;
  select string_agg(f, ', ') into bad from unnest(array[
    'private.is_active_org_member(uuid,uuid)', 'private.is_org_owner(uuid,uuid)',
    'private.org_owner_ids(uuid)', 'private.org_editor_owner_ids(uuid)']) f
   where has_function_privilege('anon', f::regprocedure, 'EXECUTE')
      or not has_function_privilege('authenticated', f::regprocedure, 'EXECUTE');
  if bad is not null then
    raise exception 'ΕΚΘΕΣΗ ANON: συναρτήσεις οργανισμού με λάθος δικαίωμα (anon ναι ή authenticated όχι): %', bad;
  end if;
  raise notice 'probe: οι συναρτήσεις οργανισμού είναι μόνο για συνδεδεμένους';

  -- 4. Οι φωτογραφίες απογραφής δεν σερβίρονται δημόσια.
  if to_regclass('storage.buckets') is not null then
    if exists (select 1 from storage.buckets where id = 'inventory-photos' and public) then
      raise exception 'ΕΚΘΕΣΗ ANON: το bucket inventory-photos είναι ξανά δημόσιο';
    end if;
    raise notice 'probe: το inventory-photos είναι ιδιωτικό';
  end if;
end $probe$;
