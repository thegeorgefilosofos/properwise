# Το χωνί της εγγραφής

Η σελίδα `/signup` μετρά ανώνυμα οκτώ βήματα στον πίνακα
`public.signup_funnel`. Κάθε γραμμή είναι ένας μετρητής ανά ημέρα, βήμα,
κατηγορία πηγής, «μέσα σε εφαρμογή» και «από κινητό». Δεν υπάρχει γραμμή ανά
επισκέπτη, cookie, διεύθυνση IP ή User-Agent.

| Βήμα | Τι σημαίνει |
|---|---|
| `view` | άνοιξε η σελίδα εγγραφής |
| `app_note` | είδε την οδηγία της εφαρμογής (Instagram κ.ά.) αντί για το κουμπί της Google |
| `chrome` | πάτησε «Άνοιγμα στον Chrome» |
| `google` | πάτησε «Συνέχισε με Google» |
| `invalid` | η φόρμα τον σταμάτησε: Όροι, κωδικός (μετριέται κάθε φορά) |
| `submit` | η φόρμα email έφυγε προς τη βάση |
| `sent` | η βάση δέχτηκε την εγγραφή και έστειλε το email επιβεβαίωσης |
| `error` | η βάση απέρριψε την εγγραφή (μετριέται κάθε φορά) |

Τα υπόλοιπα βήματα μετριούνται μία φορά ανά φόρτωση σελίδας. Η επιβεβαίωση του
email δεν είναι εδώ: φαίνεται στο `auth.users.email_confirmed_at`.

## Η ανάγνωση

Μόνο ανάγνωση, από το SQL editor της Supabase ή με `service_role`:

```sql
select step, source, in_app, mobile, sum(n) as n
from public.signup_funnel
where day >= current_date - 7
group by 1, 2, 3, 4
order by array_position(
  array['view','app_note','chrome','google','invalid','submit','sent','error'], step),
  n desc;
```

Ανά ημέρα, μόνο τα κύρια βήματα:

```sql
select day,
  sum(n) filter (where step = 'view')   as view,
  sum(n) filter (where step = 'google') as google,
  sum(n) filter (where step = 'submit') as submit,
  sum(n) filter (where step = 'sent')   as sent
from public.signup_funnel
group by day order by day desc;
```

## Τι να προσέξεις

- Πολλά `view` από `instagram` με `in_app = true` και λίγα `submit`: η
  οδηγία της εφαρμογής δεν αρκεί.
- `invalid` πολύ πάνω από το `submit`: η φόρμα κουράζει (κωδικός ή Όροι).
- `submit` χωρίς `sent`: σφάλμα της βάσης ή του email, δες τα `error`.
- Ταβάνι 1.000 ανά γραμμή και ημέρα, για να μη φουσκώνει από script.
