#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# ΤΟ ΚΛΕΙΔΙ ΤΟΥ SERVICE ROLE, ΧΩΡΙΣ ΝΕΟ SECRET
# ─────────────────────────────────────────────────────────────────────────
# Οι ροές των αντιγράφων γράφουν στο ιδιωτικό bucket ως service role. Αντί για
# νέο repo secret, το κλειδί ζητείται από το Management API της Supabase με το
# SUPABASE_ACCESS_TOKEN που ήδη χρησιμοποιεί η ροή του deploy.
#
# ΤΟ ΚΛΕΙΔΙ ΔΕΝ ΤΥΠΩΝΕΤΑΙ ΠΟΤΕ. Κρύβεται με `::add-mask::` πριν γραφτεί
# οπουδήποτε. Περνά στα επόμενα βήματα μόνο μέσω του $GITHUB_ENV. Τα logs
# αυτού του αποθετηρίου είναι δημόσια.
#
# Χρήση μέσα σε βήμα της ροής:  bash scripts/backup/service-key.sh
# Απαιτεί: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, GITHUB_ENV.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?λείπει το repo secret SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_PROJECT_REF:?λείπει το SUPABASE_PROJECT_REF}"

keys=$(curl -fsS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys?reveal=true") || {
  echo "::error::Το Management API δεν έδωσε κλειδιά. Έληξε ή άλλαξε το SUPABASE_ACCESS_TOKEN;"
  exit 1
}
key=$(printf '%s' "$keys" | jq -r '[.[] | select(.name == "service_role")][0].api_key // empty')
if [ -z "$key" ]; then
  key=$(printf '%s' "$keys" | jq -r '[.[] | select(.type == "secret")][0].api_key // empty')
fi
unset keys
if [ -z "$key" ] || [ "$key" = "null" ]; then
  echo "::error::Δεν βρέθηκε κλειδί service role στο έργο $SUPABASE_PROJECT_REF."
  exit 1
fi
echo "::add-mask::$key"
{
  echo "SUPABASE_URL=https://$SUPABASE_PROJECT_REF.supabase.co"
  echo "SUPABASE_SERVICE_KEY=$key"
} >> "$GITHUB_ENV"
echo "✓ κλειδί service role έτοιμο (κρυμμένο από τα logs)"
