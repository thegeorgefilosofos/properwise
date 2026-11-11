#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# ΕΝΤΟΛΗ ΠΑΝΩ ΣΤΗ ΒΑΣΗ ΤΗΣ ΠΑΡΑΓΩΓΗΣ, ΧΩΡΙΣ ΤΙΜΕΣ ΣΤΟ ΔΗΜΟΣΙΟ LOG
# ─────────────────────────────────────────────────────────────────────────
# ΓΙΑΤΙ. Τα logs των ροών αυτού του αποθετηρίου είναι δημόσια. Μια μετανάστευση
# που σκάει πάνω σε πραγματικά δεδομένα βγάζει από τον Postgres το
# `DETAIL: Key (στήλη)=(τιμή) already exists.` ή `Failing row contains (…)`. Και
# το CLI της Supabase τυπώνει επιπλέον την εντολή που απέτυχε. Δηλαδή μια τιμή
# πελάτη στο δημόσιο log. Το ίδιο έγινε με τη δοκιμή επαναφοράς (11/11/2026,
# scripts/guard-backup-logs.mjs): ο Postgres έγραψε ολόκληρες γραμμές στο log.
#
# ΤΙ ΚΑΝΕΙ. Τρέχει την εντολή με stdout και stderr σε αρχείο (umask 077) που δεν
# τυπώνεται ποτέ και σβήνεται στο τέλος. Ο κωδικός εξόδου μένει ίδιος. Στο log
# γράφει μόνο:
#   · τα ονόματα των αρχείων μετανάστευσης που ανέφερε (ΧΧΧΧΧΧΧΧΧΧΧΧΧΧ_όνομα.sql,
#     δηλαδή αρχεία του αποθετηρίου)
#   · σε αποτυχία: τη μετανάστευση που έτρεχε τελευταία, τους κωδικούς SQLSTATE
#     και την κατηγορία τους από σταθερό πίνακα. Ποτέ DETAIL, εντολή ή τιμή.
#     Χωρίς SQLSTATE, μια κατηγορία από σταθερό κατάλογο φράσεων του CLI.
#
# ΧΡΗΣΗ
#   bash scripts/ci/quiet-db.sh "<ετικέτα>" -- <εντολή …>
#   bash scripts/ci/quiet-db.sh "<ετικέτα>" --stdout -- <εντολή …>
#        (το stdout περνά στον καλούντα, π.χ. σε $( ); μόνο το stderr κρύβεται)
#
# Ο ΠΛΗΡΗΣ ΛΟΓΟΣ ΤΟΥ ΣΦΑΛΜΑΤΟΣ ΔΕΝ ΥΠΑΡΧΕΙ ΠΟΥΘΕΝΑ ΣΤΟ GITHUB, ούτε ως artifact
# (κι αυτά είναι δημόσια). Βρίσκεται τρέχοντας την ίδια εντολή τοπικά, ή στο
# Supabase → Logs → Postgres.
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

label=${1:?ετικέτα}
shift
pass_stdout=0
if [ "${1:-}" = "--stdout" ]; then pass_stdout=1; shift; fi
[ "${1:-}" = "--" ] && shift
[ $# -gt 0 ] || { echo "::error::quiet-db: λείπει η εντολή"; exit 2; }
# Το stdout περνά στον καλούντα ΜΟΝΟ για τη λίστα μεταναστεύσεων (εκδόσεις και
# ώρες). Κάθε άλλη εντολή μπορεί να γράψει γραμμές της βάσης στο stdout.
if [ "$pass_stdout" = 1 ] && ! [[ "$*" =~ ^supabase(\ --[^ ]+)*\ migration\ list(\ |$) ]]; then
  echo "::error::quiet-db: το --stdout επιτρέπεται μόνο για «supabase migration list»"
  exit 2
fi

umask 077
log=$(mktemp)
trap 'rm -f "$log"' EXIT

if [ "$pass_stdout" = 1 ]; then
  "$@" 2>"$log"
else
  "$@" >"$log" 2>&1
fi
rc=$?

# Τα δικά μας μηνύματα: στο stderr όταν το stdout ανήκει στον καλούντα.
if [ "$pass_stdout" = 1 ]; then exec 3>&2; else exec 3>&1; fi

# Μόνο ονόματα αρχείων μετανάστευσης ΠΟΥ ΥΠΑΡΧΟΥΝ στο supabase/migrations/: ό,τι
# μοιάζει με όνομα αλλά ήρθε από τιμή της βάσης δεν περνά.
migrations=$(grep -aoE '\b[0-9]{14}_[A-Za-z0-9_]+\.sql\b' "$log" | awk '!seen[$0]++' \
  | while read -r m; do [ -f "supabase/migrations/$m" ] && printf '%s\n' "$m"; done)

summary() { [ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf '%s\n' "$@" >> "$GITHUB_STEP_SUMMARY"; return 0; }

if [ "$rc" -eq 0 ]; then
  n=$(printf '%s' "$migrations" | grep -c . || true)
  echo "✓ $label (η έξοδος δεν τυπώνεται)" >&3
  if [ "$n" -gt 0 ]; then
    echo "  αρχεία μετανάστευσης στην έξοδο: $n" >&3
    printf '%s\n' "$migrations" | sed 's/^/  · /' >&3
  fi
  summary "✅ $label: πέτυχε ($n αρχεία μετανάστευσης στην έξοδο)."
  exit 0
fi

# Κωδικοί που τυπώνονται αυτούσιοι: σταθερός κατάλογος (PostgreSQL, Appendix A).
# Οποιοσδήποτε άλλος δίνει μόνο την κατηγορία του.
known_code() {
  case "$1" in
    23505|23503|23502|23514|23P01|42P01|42703|42883|42P07|42710|42701|42501|42601|42804|42P13|\
    22P02|22001|22003|22007|22008|40P01|40001|55P03|57014|28P01|28000|3D000|53300|08006|08001|\
    0A000|2BP01|25006|25P02|P0001|XX000) return 0 ;;
    *) return 1 ;;
  esac
}

# Η κατηγορία ενός SQLSTATE από τα δύο πρώτα σύμβολα (PostgreSQL, Appendix A).
class_of() {
  case "${1:0:2}" in
    08) echo 'connection_exception' ;;
    0A) echo 'feature_not_supported' ;;
    22) echo 'data_exception' ;;
    23) echo 'integrity_constraint_violation' ;;
    25) echo 'invalid_transaction_state' ;;
    28) echo 'invalid_authorization_specification' ;;
    2B) echo 'dependent_privilege_descriptors_still_exist' ;;
    3D) echo 'invalid_catalog_name' ;;
    3F) echo 'invalid_schema_name' ;;
    40) echo 'transaction_rollback' ;;
    42) echo 'syntax_error_or_access_rule_violation' ;;
    53) echo 'insufficient_resources' ;;
    54) echo 'program_limit_exceeded' ;;
    55) echo 'object_not_in_prerequisite_state' ;;
    57) echo 'operator_intervention' ;;
    58) echo 'system_error' ;;
    P0) echo 'plpgsql_error' ;;
    XX) echo 'internal_error' ;;
    *) echo 'άλλη κατηγορία' ;;
  esac
}

last=$(printf '%s\n' "$migrations" | grep . | tail -1)
# Ο SQLSTATE βγαίνει ΜΟΝΟ από τη γραμμή σφάλματος του ίδιου του CLI ή της
# σύνδεσης: αρχή γραμμής `ERROR:`/`FATAL:`/`Error:`/`failed to connect`, τέλος
# γραμμής `(SQLSTATE xxxxx)`. Ποτέ από DETAIL, από τιμή ή από την εντολή SQL.
states=$(grep -aE '^[[:space:]]*(ERROR|FATAL|Error|error|failed to connect|unexpected error)\b.*\(SQLSTATE [0-9A-Z]{5}\)\)*[[:space:].]*$' "$log" \
  | grep -aoE '\(SQLSTATE [0-9A-Z]{5}\)\)*[[:space:].]*$' | grep -aoE '[0-9A-Z]{5}' | awk '!seen[$0]++')

echo "::error::$label απέτυχε (κωδικός $rc). Η έξοδος δεν τυπώνεται: τα logs είναι δημόσια." >&3
[ -n "$last" ] && echo "  τελευταία μετανάστευση στην έξοδο: $last" >&3
if [ -n "$states" ]; then
  # Η κατηγορία πάντα από σταθερό πίνακα· ο κωδικός μόνο αν είναι στον κατάλογο.
  for s in $states; do
    c=$(class_of "$s")
    if known_code "$s"; then echo "  SQLSTATE $s ($c)" >&3; else echo "  SQLSTATE κατηγορίας: $c" >&3; fi
  done
else
  # Σταθερές φράσεις του CLI, χωρίς τιμές: μόνο η κατηγορία τυπώνεται.
  kind='άγνωστη (δες Supabase → Logs → Postgres)'
  if grep -aqiE 'password authentication failed|invalid (access )?token|unauthorized|status 401|HTTP 401|\b401 Unauthorized\b' "$log"; then kind='ταυτοποίηση'
  elif grep -aqiE 'connection refused|i/o timeout|timed out|no such host|network is unreachable|ECONNREFUSED' "$log"; then kind='σύνδεση'
  elif grep -aqiE 'Remote migration versions not found' "$log"; then kind='ιστορικό μεταναστεύσεων'
  elif grep -aqiE 'include-all' "$log"; then kind='σειρά μεταναστεύσεων'
  fi
  echo "  κατηγορία: $kind" >&3
fi
summary "❌ $label: απέτυχε (κωδικός $rc)${last:+, μετανάστευση \`$last\`}. Λεπτομέρειες: Supabase → Logs → Postgres."
exit "$rc"
