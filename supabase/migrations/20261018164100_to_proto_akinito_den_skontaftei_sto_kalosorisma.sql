-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ «ΠΡΟΣΘΕΣΕ ΤΟ ΠΡΩΤΟ ΣΟΥ ΑΚΙΝΗΤΟ» ΔΕΝ ΕΦΤΑΣΕ ΠΟΤΕ ΣΕ ΚΑΝΕΝΑΝ
-- ─────────────────────────────────────────────────────────────────────────
-- ΤΙ ΜΕΤΡΗΘΗΚΕ (παραγωγή, μόνο SELECT, 18/10/2026)
--
--   email_outbox, copy_id 'add_first_property': 9 γραμμές από ποτέ, 0 sent.
--   Οι 5 έληξαν ('expired' / 'stale'). Οι 4 έμειναν 'skipped' / 'frequency_cap'
--   (06/10 ώς 18/10) και οι 4 μπήκαν στην ουρά μία ημέρα (0,99 ώς 1,00) μετά το
--   τελευταίο εμπορικό μήνυμα του ίδιου παραλήπτη, δηλαδή μετά το welcome.
--   Οι 4 από τις 9 μπήκαν για χρήστες που είχαν ΗΔΗ ακίνητο πριν από την ουρά.
--   onboarding_progress: 8 γραμμές, first_property = true σε 0, με ακίνητο 5.
--   Trigger στο user_properties: μόνο το trg_enforce_property_limit, που δεν
--   αγγίζει το flag. Το first_property_success: 1 sent, 3 expired, 1 skipped
--   'frequency_cap', που μπήκε στην ουρά τη στιγμή που έφευγε το welcome.
--
-- ΔΥΟ ΣΦΑΛΜΑΤΑ
--
--   (α) ΤΟ ΟΡΙΟ. Η `can_send_marketing` κόβει κάθε εμπορικό μήνυμα για τρεις
--   ημέρες μετά το προηγούμενο. Το welcome φεύγει τις ημέρες 0 ώς 2. Το
--   add_first_property έμπαινε την ημέρα 2 και η ουρά το άδειαζε την ίδια μέρα:
--   μέσα στο τριήμερο, άρα 'skipped' για πάντα, γιατί το dedup_key δεν το
--   ξαναφήνει να μπει. Το ίδιο το first_property_success όταν το ακίνητο
--   μπαίνει μαζί με την εγγραφή: δύο γραμμές στο ίδιο πέρασμα, η δεύτερη
--   βρίσκει το όριο.
--
--   (β) ΤΟ FLAG. Η συνθήκη ήταν `coalesce(op.first_property, false) = false`.
--   Κανένας κώδικας και κανένα trigger δεν γράφει first_property = true (στα
--   app, lib, components υπάρχει μόνο ο τύπος του στο lib/supabase/tables.ts).
--   Αρα το μήνυμα θα έφευγε και σε όσους έχουν ήδη ακίνητο.
--
-- Η ΔΙΟΡΘΩΣΗ ΑΓΓΙΖΕΙ ΜΟΝΟ ΤΑ ΔΥΟ ΜΠΛΟΚ
--
--   · Το «έχει ακίνητο» ρωτιέται στο user_properties, εκεί που ζει.
--   · Το όριο ρωτιέται ΠΡΙΝ μπει η γραμμή στην ουρά: η γραμμή γεννιέται τη μέρα
--     που μπορεί να σταλεί, οπότε η drain δεν έχει λόγο να την κόψει.
--   · Τα παράθυρα φτάνουν ώς εκεί που λήγει σίγουρα το όριο. Το welcome φεύγει
--     ώς την ημέρα 2, το όριο κρατά 3 ημέρες και το cron (07:05 UTC) τρέχει
--     λίγα λεπτά πριν κλείσει το τριήμερο από την αποστολή, οπότε περνά μία
--     ημέρα ακόμη: 2 + 3 + 1 = 6. Δύο ημέρες περιθώριο για χαμένη εκτέλεση
--     δίνουν την ημέρα 8. Για το ακίνητο: μετά από οποιοδήποτε εμπορικό μήνυμα
--     το όριο λήγει το πολύ 4 ημέρες αργότερα, συν δύο περιθώριο, άρα 6.
--     Η αρχή μένει στην ημέρα 2: για όποιον πήρε welcome την ημέρα 0, η πρώτη
--     ημέρα που περνά το όριο είναι η 4η.
--
-- ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Το dedup_key (ίδιο κλειδί, μία φορά ανά χρήστη), η κατηγορία
-- 'marketing' (η διαγραφή από τα εμπορικά ισχύει όπως πριν), ο διακόπτης
-- emails_live (ζει στην drain_email_outbox, που δεν αγγίζεται). Το υπόλοιπο
-- σώμα είναι αυτούσιο εκείνο του 20260824130000.
--
-- ΤΙ ΔΕΝ ΚΑΝΕΙ. Οσοι έχουν ήδη γραμμή 'skipped' ή 'expired' δεν ξαναπαίρνουν
-- το μήνυμα: το dedup_key μένει ως έχει.
--
-- ΔΟΚΙΜΗ: scripts/db/email-activation-probe.sql (τρέχει στο scripts/db-replay.sh)
-- και scripts/test-email-activation.mjs, που δείχνει το σφάλμα στη βάση χωρίς
-- αυτή τη μετανάστευση και τη διόρθωση στη βάση με αυτήν.
--
-- ΜΕΤΑ ΤΟ DEPLOY:
--   select copy_id, status, count(*) from public.email_outbox
--    where copy_id in ('add_first_property', 'first_property_success')
--    group by 1, 2;
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.lifecycle_enqueue()
returns integer
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_before bigint;
  v_after  bigint;
  v_year   text := to_char(now(), 'YYYY');
  v_month  int  := extract(month from now())::int;
  v_day    int  := extract(day   from now())::int;
begin
  select count(*) into v_before from public.email_outbox;

  -- Base audience: confirmed, non-deleted users with their plan + tenure.
  drop table if exists _aud;
  create temporary table _aud on commit drop as
  select u.id::uuid                                   as uid,
         lower(trim(u.email))                         as email,
         coalesce(nullif(trim(bp.owner_name), ''),
                  nullif(trim(bp.full_name), ''))     as name,
         -- ΤΟ ΠΕΔΙΟ ΕΙΝΑΙ Ο ΤΥΠΟΣ ΠΡΟΦΙΛ, ΟΧΙ ΤΟ ΠΑΚΕΤΟ ΧΡΕΩΣΗΣ.
         -- Διαβαζόταν το `bp.plan`, που παίρνει free/solo/owner/agency/office,
         -- και συγκρινόταν με 'individual'/'professional' — τιμές του
         -- `profile_type`. Η σύγκριση δεν πετύχαινε ΠΟΤΕ, οπότε κάθε χρήστης
         -- έπεφτε στο 'free': όλοι έπαιρναν welcome_free και το
         -- `upsell_to_individual` στόχευε και συνδρομητές. Δύο λεξιλόγια με
         -- ένα όνομα· τα πρότυπα (welcome_individual / welcome_professional)
         -- ήταν ΠΑΝΤΑ του τύπου προφίλ, όπως δείχνουν τα ονόματά τους.
         case coalesce(bp.profile_type, 'individual')
           when 'professional' then 'professional'
           else 'individual'
         end                                          as profile,
         -- Και το πακέτο χωριστά, με το ΔΙΚΟ του λεξιλόγιο. Χρησιμοποιείται
         -- ΜΟΝΟ ως φίλτρο στην προτροπή αναβάθμισης, που αφορά χρέωση. ΔΕΝ
         -- μπαίνει ποτέ στα `params`: εκεί το `plan` το διαβάζει το
         -- `PLAN_LABEL` (emailTemplates.ts:35), που έχει κλειδιά
         -- free|individual|professional — πάλι λεξιλόγιο προφίλ. Ενα
         -- 'solo' εκεί θα τύπωνε «undefined» μέσα σε επιστολή.
         coalesce(bp.plan, 'free')                     as plan,
         u.created_at                                 as signup,
         (current_date - u.created_at::date)          as age_days
    from auth.users u
    left join public.billing_profiles bp on bp.user_id = u.id
   where u.email is not null and trim(u.email) <> ''
     and u.email_confirmed_at is not null
     and u.deleted_at is null;

  -- ── 1) Onboarding drip ────────────────────────────────────────────────────
  -- welcome_{plan} once, in the first days after signup.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'welcome_'||a.profile, a.email, a.name,
         jsonb_build_object('plan', a.profile, 'name', a.name),
         'marketing', 'welcome:'||a.uid, now()
    from _aud a
   where a.age_days between 0 and 2
  on conflict (dedup_key) do nothing;

  -- ── ΟΙ ΔΥΟ ΕΠΙΣΤΟΛΕΣ ΕΝΕΡΓΟΠΟΙΗΣΗΣ ΓΕΝΝΙΟΥΝΤΑΙ ΤΗ ΜΕΡΑ ΠΟΥ ΜΠΟΡΟΥΝ ΝΑ ΦΥΓΟΥΝ ──
  -- Η `drain_email_outbox` σημαδεύει 'skipped' ό,τι εμπορικό βρει μέσα στο
  -- τριήμερο της `can_send_marketing` και το dedup_key δεν το αφήνει να
  -- ξαναμπεί ποτέ. Γι' αυτό το όριο ρωτιέται ΕΔΩ, πριν από την εισαγωγή: η ίδια
  -- συνάρτηση, συν καμία άλλη εμπορική γραμμή σε αναμονή για τον ίδιο
  -- παραλήπτη (το welcome του ίδιου περάσματος μπαίνει λίγες γραμμές πιο πάνω).
  -- Οσο το όριο κρατά δεν μπαίνει τίποτα· το αυριανό πέρασμα ξαναρωτά.

  -- Add your first property: ημέρες 2 ώς 8, μόνο σε όποιον δεν έχει ακίνητο.
  -- Το «έχει ακίνητο» ρωτιέται στο user_properties. Το onboarding_progress.
  -- first_property δεν το γράφει κανείς, οπότε ήταν πάντα false.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'add_first_property', a.email, a.name,
         jsonb_build_object('name', a.name, 'plan', a.profile),
         'marketing', 'add_first_property:'||a.uid, now()
    from _aud a
   where a.age_days between 2 and 8
     and not exists (select 1 from public.user_properties p where p.user_id = a.uid)
     and public.can_send_marketing(a.email)
     and not exists (
       select 1 from public.email_outbox o
        where o.to_email = a.email and o.category = 'marketing' and o.status = 'pending'
     )
  on conflict (dedup_key) do nothing;

  -- Celebrate the first property: όσο το πρώτο ακίνητο είναι ως 6 ημερών.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'first_property_success', a.email, a.name,
         jsonb_build_object('name', a.name, 'propertyName', p.name),
         'marketing', 'first_property_success:'||a.uid, now()
    from _aud a
    join lateral (
      select name, created_at
        from public.user_properties
       where user_id = a.uid
       order by created_at asc
       limit 1
    ) p on true
   where p.created_at >= now() - interval '6 days'
     and public.can_send_marketing(a.email)
     and not exists (
       select 1 from public.email_outbox o
        where o.to_email = a.email and o.category = 'marketing' and o.status = 'pending'
     )
  on conflict (dedup_key) do nothing;

  -- ── 2) Obligations / expiry (operational — must be seen) ──────────────────
  -- Lease ending within 30 days.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'lease_ending', a.email, a.name,
         jsonb_build_object('tenantName', t.full_name, 'propertyName', pr.name,
                            'leaseEndDate', to_char(t.lease_end, 'DD/MM/YYYY')),
         'operational', 'lease_ending:'||t.id||':'||to_char(t.lease_end,'YYYYMMDD'), now()
    from public.tenants t
    join _aud a on a.uid = t.user_id
    left join public.user_properties pr on pr.id = t.property_id
   where t.lease_end is not null
     and t.lease_end between current_date and current_date + 30
     and coalesce(t.status, 'active') not in ('ended', 'moved_out')
  on conflict (dedup_key) do nothing;

  -- Insurance policy expiring within 30 days.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'insurance_expiring', a.email, a.name,
         jsonb_build_object('propertyName', p.name, 'insurerName', p.insurance_company,
                            'policyEndDate', to_char(p.insurance_expiry, 'DD/MM/YYYY')),
         'operational', 'insurance_expiring:'||p.id||':'||to_char(p.insurance_expiry,'YYYYMMDD'), now()
    from public.user_properties p
    join _aud a on a.uid = p.user_id
   where p.insurance_expiry between current_date and current_date + 30
  on conflict (dedup_key) do nothing;

  -- ── 3) Seasonality (marketing, gated per month, one per user per season) ──
  -- Black Friday (20-30 Nov).
  if v_month = 11 and v_day between 20 and 30 then
    insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
    select 'black_friday', a.email, a.name, jsonb_build_object('name', a.name, 'plan', a.profile),
           'marketing', 'black_friday:'||a.uid||':'||v_year, now()
      from _aud a
    on conflict (dedup_key) do nothing;
  end if;

  -- Christmas (15-26 Dec).
  if v_month = 12 and v_day between 15 and 26 then
    insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
    select 'christmas', a.email, a.name, jsonb_build_object('name', a.name),
           'marketing', 'christmas:'||a.uid||':'||v_year, now()
      from _aud a
    on conflict (dedup_key) do nothing;
  end if;

  -- Tax season nudge (March–May: income-tax + ENFIA planning).
  if v_month between 3 and 5 and v_day between 1 and 10 then
    insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
    select 'tax_season', a.email, a.name, jsonb_build_object('name', a.name, 'plan', a.profile),
           'marketing', 'tax_season:'||a.uid||':'||v_year, now()
      from _aud a
    on conflict (dedup_key) do nothing;
  end if;

  -- Summer short-term-rental prep (May).
  if v_month = 5 and v_day between 1 and 10 then
    insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
    select 'summer_str', a.email, a.name, jsonb_build_object('name', a.name),
           'marketing', 'summer_str:'||a.uid||':'||v_year, now()
      from _aud a
    on conflict (dedup_key) do nothing;
  end if;

  -- September student-demand: nudge owners of a VACANT property to list/adjust.
  if v_month = 9 and v_day between 1 and 15 then
    insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
    select 'rent_benchmark_alert', a.email, a.name,
           jsonb_build_object('name', a.name, 'propertyName', p.name, 'marketRent', p.target_rent),
           'marketing', 'sept_vacant:'||p.id||':'||v_year, now()
      from public.user_properties p
      join _aud a on a.uid = p.user_id
     where p.status_detail = 'vacant'
    on conflict (dedup_key) do nothing;
  end if;

  -- ── 4) Tenure / growth (marketing) ────────────────────────────────────────
  -- Anniversary (each completed year, within 2 days of the date).
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'anniversary', a.email, a.name,
         jsonb_build_object('name', a.name, 'anniversaryYears', (a.age_days / 365)),
         'marketing', 'anniversary:'||a.uid||':'||(a.age_days / 365)::text, now()
    from _aud a
   where a.age_days >= 365
     and (a.age_days % 365) < 2
  on conflict (dedup_key) do nothing;

  -- Referral reminder: has a code, no successful referral yet, settled in (>30d).
  -- Once per quarter.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'referral_reminder', a.email, a.name,
         jsonb_build_object('name', a.name, 'referralCode', rc.code, 'plan', a.profile),
         'marketing', 'referral_reminder:'||a.uid||':'||to_char(now(),'YYYY-Q'), now()
    from _aud a
    join public.referral_codes rc on rc.user_id = a.uid
   where a.age_days > 30
     and not exists (
       select 1 from public.referrals r
        where r.referrer_user_id = a.uid and r.activated_at is not null
     )
  on conflict (dedup_key) do nothing;

  -- Upgrade nudge: free plan carrying real load (2+ properties). Once per quarter.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'upsell_to_individual', a.email, a.name,
         jsonb_build_object('name', a.name, 'properties', pc.n, 'toPlan', 'individual'),
         'marketing', 'upsell_individual:'||a.uid||':'||to_char(now(),'YYYY-Q'), now()
    from _aud a
    join lateral (
      select count(*)::int as n from public.user_properties where user_id = a.uid
    ) pc on true
   where a.plan = 'free' and a.profile <> 'professional' and pc.n >= 2
  on conflict (dedup_key) do nothing;


  -- ═══════════════════════════════════════════════════════════════════════
  -- ΕΞΙ ΚΕΙΜΕΝΑ ΠΟΥ ΥΠΗΡΧΑΝ ΚΑΙ ΔΕΝ ΤΑ ΕΣΤΕΛΝΕ ΚΑΝΕΙΣ
  -- ═══════════════════════════════════════════════════════════════════════

  -- ── Αδράνεια 30 ημερών ────────────────────────────────────────────────
  -- ΤΟ ΚΛΕΙΔΙ ΚΡΑΤΑ ΤΗΝ ΗΜΕΡΟΜΗΝΙΑ ΤΗΣ ΤΕΛΕΥΤΑΙΑΣ ΕΙΣΟΔΟΥ, ΟΧΙ ΤΟΝ ΧΡΗΣΤΗ.
  -- Με σκέτο το uid, όποιος γύριζε και ξαναχανόταν δεν θα ξανάπαιρνε ποτέ
  -- υπενθύμιση. Με την ημερομηνία, κάθε ΝΕΑ σιωπή μετράει ξεχωριστά και μέσα
  -- στην ίδια σιωπή το μήνυμα φεύγει μία φορά όσο κι αν τρέξει ο σαρωτής.
  -- Το παράθυρο των δεκαπέντε ημερών υπάρχει για τη χαμένη εκτέλεση του cron.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'inactive_30', a.email, a.name,
         jsonb_build_object('name', a.name, 'plan', a.profile),
         'marketing', 'inactive_30:'||a.uid||':'||to_char(u.last_sign_in_at, 'YYYYMMDD'), now()
    from _aud a
    join auth.users u on u.id = a.uid
   where u.last_sign_in_at is not null
     and u.last_sign_in_at::date between current_date - 44 and current_date - 30
  on conflict (dedup_key) do nothing;

  -- ── Αδράνεια 60 ημερών ────────────────────────────────────────────────
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'inactive_60', a.email, a.name,
         jsonb_build_object('name', a.name, 'plan', a.profile),
         'marketing', 'inactive_60:'||a.uid||':'||to_char(u.last_sign_in_at, 'YYYYMMDD'), now()
    from _aud a
    join auth.users u on u.id = a.uid
   where u.last_sign_in_at is not null
     and u.last_sign_in_at::date between current_date - 74 and current_date - 60
  on conflict (dedup_key) do nothing;

  -- ── Καλωσόρισμα ενοικιαστή ────────────────────────────────────────────
  -- ΠΑΕΙ ΣΤΟΝ ΕΝΟΙΚΙΑΣΤΗ, ΟΧΙ ΣΤΟΝ ΙΔΙΟΚΤΗΤΗ, ΚΑΙ ΕΙΝΑΙ ΛΕΙΤΟΥΡΓΙΚΟ.
  -- Ο ενοικιαστής δεν έδωσε ποτέ συγκατάθεση για εμπορικά μηνύματα και δεν
  -- επιτρέπεται να πάρει κανένα. Αυτό αφορά τη ΔΙΚΗ του μίσθωση: πώς θα
  -- πληρώνει, τι αποδείξεις θα παίρνει, πού θα δηλώνει βλάβη.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'tenant_welcome', lower(trim(t.email)), t.full_name,
         jsonb_build_object('name', t.full_name, 'propertyName', pr.name, 'amount', t.monthly_rent),
         'operational', 'tenant_welcome:'||t.id, now()
    from public.tenants t
    join _aud a on a.uid = t.user_id
    left join public.user_properties pr on pr.id = t.property_id
   where t.email is not null and trim(t.email) <> ''
     and t.lease_start is not null
     and t.lease_start between current_date - 2 and current_date
     and coalesce(t.status, 'active') not in ('ended', 'moved_out')
  on conflict (dedup_key) do nothing;

  -- ── Κλείσιμο χρήσης, μέσα Δεκεμβρίου ──────────────────────────────────
  -- Οχι στις 31: όποιος το διαβάσει τότε δεν προλαβαίνει να κάνει τίποτα.
  if v_month = 12 and v_day between 5 and 15 then
    insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
    select 'year_end', a.email, a.name,
           jsonb_build_object('name', a.name, 'plan', a.profile, 'period', v_year),
           'marketing', 'year_end:'||a.uid||':'||v_year, now()
      from _aud a
     where exists (select 1 from public.user_properties p where p.user_id = a.uid)
    on conflict (dedup_key) do nothing;
  end if;

  -- ── Τριμηνιαία ανασκόπηση ─────────────────────────────────────────────
  -- ΧΩΡΙΣ ΝΟΥΜΕΡΑ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΕΠΙΛΟΓΗ. Το κείμενο δέχεται έσοδα και
  -- καθαρό αποτέλεσμα, αλλά τα δύο αυτά βγαίνουν από υπολογισμό που ζει στην
  -- εφαρμογή, όχι σε μία στήλη. Ενα πρόχειρο άθροισμα εδώ θα έστελνε ποσό
  -- που ΔΕΝ συμφωνεί με την οθόνη. Το κείμενο έχει ήδη διαδρομή χωρίς
  -- νούμερα («Η εικόνα του τριμήνου σε περιμένει») και αυτή χρησιμοποιείται.
  if v_month in (1, 4, 7, 10) and v_day between 1 and 5 then
    insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
    select 'quarterly_review', a.email, a.name,
           jsonb_build_object('name', a.name, 'plan', a.profile,
             'period', (case extract(quarter from now() - interval '1 month')::int
                          when 1 then 'Α΄ τρίμηνο ' when 2 then 'Β΄ τρίμηνο '
                          when 3 then 'Γ΄ τρίμηνο ' else 'Δ΄ τρίμηνο ' end)
                       || to_char(now() - interval '1 month', 'YYYY')),
           'marketing', 'quarterly_review:'||a.uid||':'||to_char(now() - interval '1 month', 'YYYY-Q'), now()
      from _aud a
     where exists (select 1 from public.user_properties p where p.user_id = a.uid)
    on conflict (dedup_key) do nothing;
  end if;

  -- ── Σύνδεση ημερολογίου, μόνο σε όποιον το χρειάζεται ─────────────────
  -- Εχει βραχυχρόνιο ακίνητο και καμία πηγή ημερολογίου. Μία φορά: αν το
  -- αγνόησε, δεύτερο μήνυμα δεν προσθέτει τίποτα εκτός από ενόχληση.
  insert into public.email_outbox (copy_id, to_email, to_name, params, category, dedup_key, scheduled_for)
  select 'connect_calendar', a.email, a.name,
         jsonb_build_object('name', a.name, 'plan', a.profile),
         'marketing', 'connect_calendar:'||a.uid, now()
    from _aud a
   where a.age_days >= 7
     and exists (select 1 from public.user_properties p
                  where p.user_id = a.uid and p.rental_mode = 'short_term')
     and not exists (select 1 from public.ical_feeds f where f.user_id = a.uid)
  on conflict (dedup_key) do nothing;

  select count(*) into v_after from public.email_outbox;
  return (v_after - v_before)::int;
end;
$$;

revoke all on function public.lifecycle_enqueue() from public, anon, authenticated;

comment on function public.lifecycle_enqueue() is
  'Το ημερήσιο πέρασμα που γεμίζει την ουρά email. Κάθε κείμενο του emailCopy.ts είτε ζητιέται από εδώ, είτε από άλλο χρονόμετρο, είτε δηλώνεται χειροκίνητο στον scripts/guard-email-senders.mjs.';
