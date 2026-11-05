-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΙΣΤΟΡΙΚΟ ΑΝΟΙΓΜΑΤΟΣ ΚΡΑΤΙΕΤΑΙ 12 ΜΗΝΕΣ· ΤΟ ΓΡΑΦΕΙΟ ΓΡΑΦΕΙ ΜΟΝΟ ΜΕ ΣΥΜΒΑΣΗ
-- ─────────────────────────────────────────────────────────────────────────
-- ΑΠΟ ΤΟΝ ΝΟΜΙΚΟ ΕΛΕΓΧΟ (#486), δύο σημεία που μπλοκάρουν την παραγωγή:
--
-- 1. Η σελίδα υπόσχεται ότι το `firm_access_log` (ποιος άνοιξε τον φάκελο,
--    πότε) κρατιέται 12 μήνες· η βάση το κρατούσε για πάντα. Τώρα καθημερινό
--    καθάρισμα στο pg_cron, όπως το `firm-record-undo-prune` (20261104150000).
--    Το `firm_record_log` μένει όσο υπάρχει ο λογαριασμός του ιδιοκτήτη
--    (`owner_id … on delete cascade`, 20261104130000)· καμία άλλη διάρκεια.
--
-- 2. Το γραφείο καταχωρεί στον λογαριασμό του ιδιοκτήτη ως ΕΚΤΕΛΩΝ την
--    επεξεργασία (απόφαση 05/11/2026). Χωρίς αποδεκτή την ΤΡΕΧΟΥΣΑ σύμβαση
--    επεξεργασίας από τον ιδιοκτήτη, καμία εγγραφή του γραφείου: το
--    `firm_write_gate`, από όπου περνούν `firm_record`, `firm_record_update`,
--    `firm_record_delete` και `firm_mark_paid`, σηκώνει `firm_record:dpa`. Η
--    αποδοχή ζει εκεί όπου τη γράφει η εφαρμογή: `user_metadata.dpa_version`
--    (app/dashboard/components/DpaModal.tsx, lib/legal/dpa.ts).
--
-- ΟΙ ΔΥΟ ΑΡΙΘΜΟΙ ΖΟΥΝ ΣΕ ΕΝΑ ΣΗΜΕΙΟ ΕΔΩ ΚΑΙ ΑΚΟΛΟΥΘΟΥΝ ΤΟΝ ΚΩΔΙΚΑ:
--   · 12 μήνες = `FIRM_ACCESS_LOG_MONTHS` στο lib/legal/firms.ts (#486)·
--   · '2026-11' = `DPA_VERSION` στο lib/legal/dpa.ts (#486).
-- Αν αλλάξει εκεί, αλλάζει εδώ με νέα μετανάστευση που ξαναγράφει τη
-- συνάρτηση. Πηγή: δες docs/legal.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Η ΔΙΑΤΗΡΗΣΗ ─────────────────────────────────────────────────────────
create or replace function private.firm_access_log_months()
returns int
language sql immutable
set search_path = ''
as $$
  select 12;  -- FIRM_ACCESS_LOG_MONTHS, lib/legal/firms.ts. Πηγή: δες docs/legal.
$$;

create or replace function private.firm_access_log_prune()
returns int
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_n int;
begin
  delete from public.firm_access_log
   where at < now() - make_interval(months => private.firm_access_log_months());
  get diagnostics v_n = row_count;
  return v_n;
end $$;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron δεν είναι ενεργό: το καθάρισμα του ιστορικού ανοίγματος δεν προγραμματίζεται';
    return;
  end if;
  -- firm-access-log-prune: κάθε μέρα 03:41 UTC, μακριά από το :00 και το 03:17.
  if exists (select 1 from cron.job where jobname = 'firm-access-log-prune') then
    perform cron.unschedule('firm-access-log-prune');
  end if;
  perform cron.schedule('firm-access-log-prune', '41 3 * * *', 'select private.firm_access_log_prune()');
end $$;

-- ── 2. Η ΣΥΜΒΑΣΗ ΕΠΕΞΕΡΓΑΣΙΑΣ ──────────────────────────────────────────────
create or replace function private.firm_dpa_version()
returns text
language sql immutable
set search_path = ''
as $$
  select '2026-11'::text;  -- DPA_VERSION, lib/legal/dpa.ts. Πηγή: δες docs/legal.
$$;

create or replace function private.owner_dpa_current(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select u.raw_user_meta_data ->> 'dpa_version' from auth.users u where u.id = p_owner)
                  = private.firm_dpa_version(), false);
$$;

-- Ιδια πύλη με το 20261104130000, με τη σύμβαση πριν από κάθε άλλο έλεγχο
-- του πελάτη: ο λόγος της άρνησης είναι αυτός που μπορεί να διορθωθεί.
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
  if not private.owner_dpa_current(p_owner) then
    raise exception 'firm_record:dpa' using errcode = '42501',
      hint = 'Ο πελάτης πρέπει πρώτα να αποδεχτεί τους όρους επεξεργασίας.';
  end if;
  if p_property is null or not exists (select 1 from user_properties up where up.id = p_property and up.user_id = p_owner) then
    raise exception 'firm_record:property' using errcode = '42501';
  end if;
  return v_firm;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'private.firm_access_log_months()', 'private.firm_access_log_prune()',
    'private.firm_dpa_version()', 'private.owner_dpa_current(uuid)', 'private.firm_write_gate(uuid, uuid, text)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
  end loop;
  -- Η πύλη καλείται μέσα από τις SECURITY DEFINER του γραφείου, όχι από το API.
  revoke all on function private.firm_access_log_prune() from authenticated;
end $$;
