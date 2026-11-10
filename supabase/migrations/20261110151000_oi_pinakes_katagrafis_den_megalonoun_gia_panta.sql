-- ═══════════════════════════════════════════════════════════════════════════
-- ΟΙ ΠΙΝΑΚΕΣ ΚΑΤΑΓΡΑΦΗΣ ΔΕΝ ΜΕΓΑΛΩΝΟΥΝ ΓΙΑ ΠΑΝΤΑ
-- ─────────────────────────────────────────────────────────────────────────
-- ΑΠΟ ΤΟΝ ΕΛΕΓΧΟ ΚΛΙΜΑΚΑΣ (10/11/2026). Μετρημένο στην παραγωγή την ίδια μέρα:
--   · cron.job_run_details   85.876 γραμμές από 08/06, 34 MB, κανένα καθάρισμα·
--                            ερωτήματα πάνω του κάνουν ήδη 1,5–4 s.
--   · public.health_checks   5.148 γραμμές, ~96 τη μέρα, κανένα καθάρισμα.
--   · public.email_outbox    κανένα καθάρισμα· η Πολιτική απορρήτου (docs/legal/
--                            privacy-policy.md §6) λέει «Απεσταλμένα για έλεγχο·
--                            ληγμένα εκκαθαρίζονται» και τα ληγμένα δεν
--                            εκκαθαρίζονταν ποτέ.
--   · public.notification_log κανένα καθάρισμα· με 50.000 χρήστες 5–20 εκατ.
--                            γραμμές τον χρόνο.
--
-- ΤΙ ΚΡΑΤΙΕΤΑΙ ΚΑΙ ΓΙΑΤΙ — κάθε διάρκεια ελέγχθηκε απέναντι σε όποιον διαβάζει:
--
-- 1. cron.job_run_details: 14 ημέρες. Το διαβάζουν μόνο άνθρωποι (docs/infra/
--    runbook.md) για τις πρόσφατες εκτελέσεις· η watch_health γράφει εκεί, δεν
--    διαβάζει ιστορικό.
--
-- 2. health_checks: 30 ημέρες. Η health_status() και η health-check διαβάζουν
--    ΜΟΝΟ την τελευταία γραμμή (order by ran_at desc limit 1).
--
-- 3. email_outbox, ΔΥΟ ΒΗΜΑΤΑ, ΠΟΤΕ σε pending ή dispatched:
--    α) 90 ημέρες μετά: σβήνουν το περιεχόμενο (params) και το όνομα (to_name)
--       από κάθε γραμμή σε τελική κατάσταση (sent, expired, skipped, failed).
--       Η γραμμή ΔΕΝ σβήνεται, γιατί το dedup_key της είναι αυτό που εμποδίζει
--       το ίδιο email να ξαναφύγει. Μετρημένο: τα welcome:<id>, trial_ending:<id>,
--       add_first_property:<id>, first_property_success:<id>, connect_calendar:<id>
--       είναι ΜΙΑΣ ΦΟΡΑΣ ανά λογαριασμό και η lifecycle_enqueue τα ξαναβάζει
--       στην ουρά με `on conflict (dedup_key) do nothing` αν λείπει η γραμμή.
--       Μένουν μόνο το to_email και το dedup_key: όσα χρειάζονται για να μη
--       σταλεί δεύτερη φορά. Σβήνουν ολόκληρα με τον λογαριασμό (erase_account).
--    β) 400 ημέρες μετά: σβήνει ολόκληρη η γραμμή ΜΟΝΟ όταν το dedup_key είναι
--       κενό ή δεμένο σε περίοδο που έχει περάσει: έτος (`:2026`), τρίμηνο ή
--       μήνας (`:2026-3`), μέρα (`:2026-11-09`). Μετά από 400 ημέρες κάθε τέτοια
--       περίοδος έχει κλείσει, άρα η lifecycle_enqueue γράφει άλλο κλειδί και
--       το παλιό δεν ξαναζωντανεύει. Τα 8ψήφια κλειδιά (`inactive_30:<id>:20260827`)
--       ΔΕΝ μπαίνουν εδώ: η ημερομηνία τους είναι η τελευταία δραστηριότητα, όχι
--       περίοδος· με τον χρήστη ακόμη ανενεργό θα ξανάβγαιναν ίδια.
--    Το όριο συχνότητας (can_send_marketing) κοιτά 3 ημέρες πίσω· δεν αγγίζεται.
--
-- 4. notification_log: 13 μήνες, ΜΕ ΤΡΕΙΣ ΕΞΑΙΡΕΣΕΙΣ.
--    · `overdue`: μένει όσο το γεγονός του ημερολογίου είναι ακόμη pending.
--      Αλλιώς η send-reminders θα το έβρισκε ανειδοποίητο και θα ξανάστελνε.
--    · `rent_overdue`: μένει όσο η δόση είναι ακόμη απλήρωτη. Η send-reminders
--      μετρά τις προηγούμενες οχλήσεις ανά δόση (priorCount) για να κλιμακώσει.
--    · η ΠΡΩΤΗ γραμμή κάθε χρήστη μένει πάντα. Η metrics_funnel ρωτά «υπήρξε
--      ποτέ υπενθύμιση» (`exists … notification_log where user_id`) για κοόρτες
--      έως 104 εβδομάδων (scripts/metrics-report.ts)· μία γραμμή ανά χρήστη
--      αρκεί για να μείνει ακριβής.
--    Το κλειδί της μηνιαίας κατάστασης αφορά τον μήνα του· 13 μήνες το
--    καλύπτουν με περιθώριο.
--
-- ΣΕ ΠΑΡΤΙΔΕΣ. Κάθε πίνακας σβήνει το πολύ `p_batch` γραμμές ανά γύρο και το
-- πολύ `p_rounds` γύρους ανά εκτέλεση· ό,τι μείνει πάει στην επόμενη μέρα.
-- Οι παλιές γραμμές δεν τις αγγίζει κανείς άλλος, άρα δεν υπάρχει αναμονή σε
-- κλειδαριά με την εφαρμογή.
-- ═══════════════════════════════════════════════════════════════════════════

-- Η «πρώτη γραμμή κάθε χρήστη» ψάχνεται ανά user_id με σειρά χρόνου.
create index if not exists notification_log_user_created_idx
  on public.notification_log (user_id, created_at);

create or replace function private.prune_logs(p_batch int default 5000, p_rounds int default 20)
returns jsonb
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_jrd int := 0; v_hc int := 0; v_scrub int := 0; v_outbox int := 0; v_nl int := 0;
  v_n int; i int;
begin
  -- 1. cron.job_run_details, 14 ημέρες (μόνο όπου υπάρχει το pg_cron)
  if to_regclass('cron.job_run_details') is not null then
    for i in 1..p_rounds loop
      execute format(
        'delete from cron.job_run_details where runid in (
           select runid from cron.job_run_details
            where end_time < now() - interval ''14 days'' limit %s)', p_batch);
      get diagnostics v_n = row_count;
      v_jrd := v_jrd + v_n;
      exit when v_n < p_batch;
    end loop;
  end if;

  -- 2. health_checks, 30 ημέρες
  for i in 1..p_rounds loop
    delete from public.health_checks
     where id in (select id from public.health_checks
                   where ran_at < now() - interval '30 days' limit p_batch);
    get diagnostics v_n = row_count;
    v_hc := v_hc + v_n;
    exit when v_n < p_batch;
  end loop;

  -- 3α. email_outbox: περιεχόμενο και όνομα σβήνουν στις 90 ημέρες
  for i in 1..p_rounds loop
    update public.email_outbox
       set params = '{}'::jsonb, to_name = null
     where id in (select id from public.email_outbox
                   where status in ('sent', 'expired', 'skipped', 'failed')
                     and scheduled_for < now() - interval '90 days'
                     and (params is distinct from '{}'::jsonb or to_name is not null)
                   limit p_batch);
    get diagnostics v_n = row_count;
    v_scrub := v_scrub + v_n;
    exit when v_n < p_batch;
  end loop;

  -- 3β. email_outbox: ολόκληρη η γραμμή στις 400 ημέρες, μόνο για κλειδιά περιόδου
  for i in 1..p_rounds loop
    delete from public.email_outbox
     where id in (select id from public.email_outbox
                   where status in ('sent', 'expired', 'skipped', 'failed')
                     and scheduled_for < now() - interval '400 days'
                     and (dedup_key is null
                          or dedup_key ~ ':[0-9]{4}(-[0-9]{1,2})?$'
                          or dedup_key ~ ':[0-9]{4}-[0-9]{2}-[0-9]{2}$')
                   limit p_batch);
    get diagnostics v_n = row_count;
    v_outbox := v_outbox + v_n;
    exit when v_n < p_batch;
  end loop;

  -- 4. notification_log, 13 μήνες, με τις τρεις εξαιρέσεις
  for i in 1..p_rounds loop
    delete from public.notification_log
     where id in (
       select n.id from public.notification_log n
        where n.created_at < now() - interval '13 months'
          -- η πρώτη γραμμή του χρήστη μένει (metrics_funnel)
          and exists (select 1 from public.notification_log f
                       where f.user_id = n.user_id and f.created_at < n.created_at)
          -- όχληση γεγονότος που είναι ακόμη ανοιχτό
          and not (n.reminder_type = 'overdue' and exists (
                select 1 from public.calendar_events e
                 where e.id = n.event_id and e.status = 'pending'))
          -- όχληση δόσης που είναι ακόμη απλήρωτη
          and not (n.reminder_type = 'rent_overdue' and exists (
                select 1 from public.rent_payments r
                 where r.id = n.event_id and coalesce(r.paid, false) = false))
        limit p_batch);
    get diagnostics v_n = row_count;
    v_nl := v_nl + v_n;
    exit when v_n < p_batch;
  end loop;

  return jsonb_build_object(
    'job_run_details', v_jrd, 'health_checks', v_hc,
    'outbox_scrubbed', v_scrub, 'outbox_deleted', v_outbox,
    'notification_log', v_nl);
end $$;

revoke all on function private.prune_logs(int, int) from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron δεν είναι ενεργό: το καθάρισμα των πινάκων καταγραφής δεν προγραμματίζεται';
    return;
  end if;
  -- logs-retention-prune: κάθε μέρα 02:29 UTC (04:29 Αθήνα τον χειμώνα), ώρα
  -- χαμηλής κίνησης, μακριά από το :00 και από τα άλλα καθαρίσματα (03:17,
  -- 03:41, 04:41).
  if exists (select 1 from cron.job where jobname = 'logs-retention-prune') then
    perform cron.unschedule('logs-retention-prune');
  end if;
  perform cron.schedule('logs-retention-prune', '29 2 * * *', 'select private.prune_logs()');
end $$;
