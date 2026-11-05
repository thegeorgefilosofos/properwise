-- ═══════════════════════════════════════════════════════════════════════════
-- ΤΟ ΑΡΧΕΙΟ ΘΕΛΕΙ ΣΥΜΒΑΣΗ ΟΠΩΣ Η ΚΑΤΑΧΩΡΗΣΗ· Η ΔΙΑΓΡΑΦΗ ΟΧΙ
-- ─────────────────────────────────────────────────────────────────────────
-- Το 20261105090000 έβαλε τη σύμβαση επεξεργασίας στο `firm_write_gate`. Δύο
-- κενά έμειναν:
--
-- 1. ΤΟ ΑΡΧΕΙΟ ΑΝΕΒΑΙΝΕ ΠΡΙΝ ΑΠΟ ΤΟΝ ΕΛΕΓΧΟ. Το «Παραστατικό» ανεβάζει πρώτα
--    στο storage (`property_files_firm_upload`) και μετά καλεί `firm_record`.
--    Χωρίς σύμβαση η καταχώρηση κοβόταν, αλλά το αρχείο είχε ήδη μπει στον
--    φάκελο του ιδιοκτήτη. Τώρα η ίδια η πολιτική ζητά την τρέχουσα σύμβαση.
--
-- 2. Η ΔΙΑΓΡΑΦΗ ΚΟΒΟΤΑΝ ΚΙ ΑΥΤΗ. Το `firm_record_delete` περνά από την ίδια
--    πύλη, οπότε το γραφείο δεν μπορούσε να σβήσει ούτε το δικό του λάθος. Η
--    διαγραφή ΜΕΙΩΝΕΙ την επεξεργασία, δεν την αυξάνει: επιτρέπεται και χωρίς
--    τρέχουσα αποδοχή, με όλους τους άλλους ελέγχους (ρόλος, επίπεδο, δική του
--    εγγραφή, 24 ώρες στο «ανέβασμα»). Το ίδιο ισχύει ήδη για το σβήσιμο
--    αρχείου (`property_files_firm_unupload`), που δεν αλλάζει.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Η πύλη, με τη σύμβαση ως επιλογή ──────────────────────────────────────
create or replace function private.firm_gate(p_owner uuid, p_property uuid, p_kind text, p_need_dpa boolean)
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
  if p_need_dpa and not private.owner_dpa_current(p_owner) then
    raise exception 'firm_record:dpa' using errcode = '42501',
      hint = 'Ο πελάτης πρέπει πρώτα να αποδεχτεί τους όρους επεξεργασίας.';
  end if;
  if p_property is null or not exists (select 1 from user_properties up where up.id = p_property and up.user_id = p_owner) then
    raise exception 'firm_record:property' using errcode = '42501';
  end if;
  return v_firm;
end $$;

-- Η εγγραφή (`firm_record`, `firm_record_update`, `firm_mark_paid`): με σύμβαση.
create or replace function private.firm_write_gate(p_owner uuid, p_property uuid, p_kind text)
returns uuid
language sql stable security definer
set search_path = 'public', 'pg_temp'
as $$ select private.firm_gate(p_owner, p_property, p_kind, true) $$;

-- Η διαγραφή: όπως στο 20261104150000, με την πύλη χωρίς τη σύμβαση.
create or replace function public.firm_record_delete(p_kind text, p_id uuid)
returns json
language plpgsql security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_table text := private.firm_kind_table(p_kind);
  v_before jsonb;
  v_firm uuid;
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if v_table is null then raise exception 'firm_record:kind' using errcode = '22023'; end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_table) using p_id into v_before;
  if v_before is null then raise exception 'firm_record:not_found' using errcode = '42501'; end if;
  v_firm := private.firm_gate((v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind, false);  -- η διαγραφή μειώνει την επεξεργασία: χωρίς σύμβαση
  if (v_before->>'firm_id') is distinct from v_firm::text then
    raise exception 'firm_record:not_ours' using errcode = '42501';
  end if;
  if private.firm_level(auth.uid(), (v_before->>'user_id')::uuid) <> 'keep'
     and (v_before->>'created_at')::timestamptz < now() - interval '24 hours' then
    raise exception 'firm_record:too_late' using errcode = '42501';
  end if;
  execute format('delete from public.%I where id = $1', v_table) using p_id;
  perform private.firm_log(v_firm, (v_before->>'user_id')::uuid, (v_before->>'property_id')::uuid, p_kind, v_table, p_id,
                           'delete', v_before, null);
  return json_build_object('ok', true, 'filePath', v_before->>'file_path');
end $$;

-- ── Το αρχείο: η πολιτική ζητά την τρέχουσα σύμβαση ───────────────────────
-- plpgsql ώστε η μετατροπή σε uuid να γίνεται ΜΟΝΟ αφού περάσει η διαδρομή.
create or replace function private.firm_upload_ok(p_name text)
returns boolean
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if not private.firm_upload_path_ok(p_name) then return false; end if;
  return private.owner_dpa_current((storage.foldername(p_name))[1]::uuid);
end $$;

drop policy if exists property_files_firm_upload on storage.objects;
create policy property_files_firm_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'property-files' and private.firm_upload_ok(name));

-- ── Για την οθόνη: ρωτά ΠΡΙΝ από το ανέβασμα ─────────────────────────────
-- Η άρνηση της πολιτικής storage είναι γενική («row-level security»)· το
-- γραφείο πρέπει να διαβάσει τον λόγο. Απαντά μόνο σε όποιον βλέπει τον
-- πελάτη· κανένα στοιχείο του πέρα από το ναι ή όχι.
create or replace function public.firm_owner_dpa_ok(p_owner uuid)
returns boolean
language plpgsql stable security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if not private.mfa_satisfied() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if auth.uid() is null or p_owner is null or not private.firm_reads_owner(auth.uid(), p_owner) then return null; end if;
  return private.owner_dpa_current(p_owner);
end $$;

do $$
declare f text;
begin
  foreach f in array array['private.firm_gate(uuid, uuid, text, boolean)', 'private.firm_write_gate(uuid, uuid, text)',
                           'private.firm_upload_ok(text)', 'public.firm_record_delete(text, uuid)', 'public.firm_owner_dpa_ok(uuid)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
  end loop;
  execute 'grant execute on function public.firm_record_delete(text, uuid) to authenticated';
  execute 'grant execute on function public.firm_owner_dpa_ok(uuid) to authenticated';
  -- Η πολιτική τρέχει ως ο χρήστης του API.
  execute 'grant execute on function private.firm_upload_ok(text) to authenticated';
end $$;
