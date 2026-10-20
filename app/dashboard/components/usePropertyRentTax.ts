'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΦΟΡΟΣ ΕΝΟΙΚΙΩΝ ΤΟΥ ΑΚΙΝΗΤΟΥ, ΓΙΑ ΟΘΟΝΗ ΠΟΥ ΔΕΝ ΦΟΡΤΩΝΕΙ ΤΟ ΧΑΡΤΟΦΥΛΑΚΙΟ
// ─────────────────────────────────────────────────────────────────────────
// Το Ενοικιαστής → Νομικά και Φόρος έβγαζε φόρο από το μίσθωμα × 12 μόνο του,
// χωρίς τα άλλα ακίνητα του φορολογούμενου και χωρίς ποσοστό ιδιοκτησίας: τρίτη
// βάση για το ίδιο ακίνητο, δίπλα στην Επισκόπηση και στη Σύγκριση (έλεγχος
// 19/10/2026, #6). Εδώ φορτώνονται τα ίδια στοιχεία με τη Σύγκριση και ο φόρος
// βγαίνει από την ΙΔΙΑ `propertyRentTax` (lib/facts/rentTax.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as properties from '@/lib/data/properties';
import * as tenantStore from '@/lib/data/tenants';
import * as rentStore from '@/lib/data/rent';
import * as stayStore from '@/lib/data/stays';
import { type IncomeRent } from '@/lib/income/propertyIncome';
import type { StayAmountLike } from '@/lib/clients/stayAmounts';
import type { OtherPropertyIncome, TaxpayerPropInput } from '@/lib/accounting/taxpayerIncome';
import { taxpayerScope } from '@/lib/facts/taxpayer';
import { targetMonthlyOf } from '@/lib/facts/taxIncome';
import { propertyRentTax, type PropertyRentTax } from '@/lib/facts/rentTax';
import { athensToday } from '@/lib/core/time';
import { useLoad } from '@/app/hooks/useLoad';

type PropRow = TaxpayerPropInput & { target_rent: number | null };

/** `null` όσο φορτώνει ή όταν μια ανάγνωση απέτυχε: η οθόνη δεν δείχνει μισό φόρο. */
export function usePropertyRentTax(
  propertyId: string, userId: string, profileType: 'individual' | 'professional' | undefined,
): PropertyRentTax | null {
  const [result, setResult] = useState<{ key: string; tax: PropertyRentTax | null } | null>(null);
  const key = `${propertyId}|${userId}|${profileType ?? ''}`;

  const load = useCallback(async () => {
    const today = athensToday();
    const year = Number(today.slice(0, 4));
    const pro = profileType === 'professional';
    const supabase = createClient();
    try {
      const [props, tenants, rents, stays, rc, owners] = await Promise.all([
        properties.list<PropRow>(supabase, userId, { columns: 'id,target_rent,rental_mode,status_detail,client_id,ownership' }),
        tenantStore.currentByProperty<{ property_id: string; monthly_rent: number | null; e_payment: boolean | null }>(supabase, userId, 'monthly_rent,e_payment'),
        rentStore.ofUser<IncomeRent & { property_id: string }>(supabase, userId, `property_id,${rentStore.INCOME_COLUMNS}`, { year }),
        stayStore.ofUser<StayAmountLike & { property_id: string }>(supabase, userId, stayStore.PORTFOLIO_COLUMNS),
        supabase.from('rent_config').select('property_id,actual_rent,target_rent').eq('user_id', userId),
        pro ? supabase.from('clients').select('id').eq('user_id', userId).eq('type', 'owner') : Promise.resolve({ data: null, error: null }),
      ]);
      if (rc.error || owners.error) throw rc.error ?? owners.error;
      const rcById = new Map(((rc.data || []) as { property_id: string | null; actual_rent: number | null; target_rent: number | null }[])
        .filter(r => !!r.property_id).map(r => [r.property_id as string, r]));
      const income = new Map<string, OtherPropertyIncome>(props.map(p => {
        const t = tenants.get(p.id);
        return [p.id, {
          rents: rents.filter(r => r.property_id === p.id),
          stays: stays.filter(st => st.property_id === p.id),
          leaseMonthly: Number(t?.monthly_rent) || null,
          targetMonthly: targetMonthlyOf(rcById.get(p.id), p.target_rent),
          viaBank: t ? t.e_payment !== false : true,
        }];
      }));
      const ownerIds = owners.data ? new Set((owners.data as { id: string }[]).map(r => r.id)) : null;
      setResult({ key, tax: propertyRentTax({
        props, propertyId, ownerClientIds: taxpayerScope(profileType, ownerIds), income, year, today,
      }) });
    } catch {
      setResult({ key, tax: null });
    }
  }, [key, propertyId, userId, profileType]);

  useLoad(load);
  return result?.key === key ? result.tax : null;
}
