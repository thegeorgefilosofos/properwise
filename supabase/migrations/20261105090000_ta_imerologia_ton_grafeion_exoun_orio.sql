-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΑ ΔΥΟ ΗΜΕΡΟΛΟΓΙΑ ΤΩΝ ΓΡΑΦΕΙΩΝ ΕΧΟΥΝ ΟΡΙΟ ΔΙΑΤΗΡΗΣΗΣ
-- ─────────────────────────────────────────────────────────────────────────
-- ΑΠΟΦΑΣΗ ΙΔΙΟΚΤΗΤΗ ΤΟΥ ΠΡΟΪΟΝΤΟΣ (05/11/2026):
--   · `firm_access_log` (ποιος άνοιξε, πότε): 12 μήνες·
--   · `firm_record_log` (τι καταχώρησε το γραφείο στον λογαριασμό του
--     ιδιοκτήτη, ως εκτελών την επεξεργασία): όσο υπάρχει ο λογαριασμός του
--     ιδιοκτήτη (ήδη: `owner_id … on delete cascade`, 20261104130000) και το
--     πολύ όσο το όριο διατήρησης φορολογικών και λογιστικών στοιχείων.
--
-- ΤΑ ΟΡΙΑ ΖΟΥΝ ΣΕ ΕΝΑ ΣΗΜΕΙΟ: `private.firm_log_retention`. Πηγή: δες
-- docs/legal. Οι αρχικές τιμές (12 μήνες, 5 έτη) ισχύουν ΜΕΧΡΙ να τις
-- επιβεβαιώσει ο νομικός έλεγχος· αν βγει άλλος αριθμός, αλλάζει μόνο εδώ, με
-- νέα μετανάστευση που ξαναγράφει αυτή τη συνάρτηση.
--
-- ΤΟ ΚΑΘΑΡΙΣΜΑ: κάθε μέρα, με τον ίδιο τρόπο όπως το `firm-record-undo-prune`
-- (20261104150000). Το `firm_record_undo` φεύγει μαζί με τη γραμμή του
-- ημερολογίου (`on delete cascade`).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function private.firm_log_retention(p_log text)
returns interval
language sql immutable
set search_path = ''
as $$
  -- Πηγή: δες docs/legal. Αρχικές τιμές ως την επιβεβαίωση (05/11/2026).
  select case p_log
    when 'access' then interval '12 months'
    when 'record' then interval '5 years'
  end;
$$;

comment on function private.firm_log_retention(text) is
  'Πόσο κρατιούνται τα ημερολόγια των γραφείων. ΕΝΑ σημείο· πηγή: δες docs/legal (20261105090000).';

create or replace function private.firm_logs_prune()
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_access int;
  v_record int;
begin
  delete from public.firm_access_log where at < now() - private.firm_log_retention('access');
  get diagnostics v_access = row_count;
  delete from public.firm_record_log where at < now() - private.firm_log_retention('record');
  get diagnostics v_record = row_count;
  return json_build_object('access', v_access, 'record', v_record);
end $$;

alter function private.firm_log_retention(text) owner to postgres;
alter function private.firm_logs_prune() owner to postgres;
revoke all on function private.firm_log_retention(text) from public, anon, authenticated;
revoke all on function private.firm_logs_prune() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron δεν είναι ενεργό: το καθάρισμα των ημερολογίων δεν προγραμματίζεται';
    return;
  end if;
  -- firm-logs-prune: κάθε μέρα 03:41 UTC, μακριά από το :00 και από το 03:17.
  if exists (select 1 from cron.job where jobname = 'firm-logs-prune') then
    perform cron.unschedule('firm-logs-prune');
  end if;
  perform cron.schedule('firm-logs-prune', '41 3 * * *', 'select private.firm_logs_prune()');
end $$;
