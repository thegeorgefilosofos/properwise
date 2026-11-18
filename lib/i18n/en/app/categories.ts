// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΚΑΤΗΓΟΡΙΕΣ ΔΑΠΑΝΩΝ ΣΤΑ ΑΓΓΛΙΚΑ (lib/expenses/taxonomy.ts)
// ─────────────────────────────────────────────────────────────────────────
// Ενα όνομα ανά `slug` της ταξινομίας. Η ταξινομία μένει η μία πηγή για το
// ποια κατηγορία είναι ποια· εδώ μόνο η αγγλική της ετικέτα. Τιμή που η
// ταξινομία δεν αναγνωρίζει (κάτι που έγραψε ο χρήστης) δείχνεται όπως είναι.
// ═══════════════════════════════════════════════════════════════════════════
import { resolveCategory } from '@/lib/expenses/taxonomy';

export const CATEGORY_EN: Record<string, string> = {
  electricity: 'Electricity',
  water: 'Water',
  gas: 'Natural gas',
  heating: 'Heating',
  internet: 'Internet and phone',
  common: 'Building charges',
  insurance: 'Insurance',
  security: 'Alarm',
  subscription: 'Subscriptions',
  plumber: 'Plumber',
  electrician: 'Electrician',
  cleaning: 'Cleaning',
  garden: 'Garden',
  elevator: 'Elevator',
  ac_service: 'Air conditioning',
  pool: 'Pool',
  pest: 'Pest control',
  repair: 'Repairs and maintenance',
  enfia: 'ENFIA',
  municipal: 'Municipal fees',
  notary: 'Notary and lawyer',
  engineer: 'Engineer',
  broker_fee: 'Agency fees',
  platform_fee: 'Platform commission',
  renovation: 'Renovation',
  appliance: 'Appliances',
  furniture: 'Furniture',
  other: 'Other',
};

/** Η αγγλική ετικέτα μιας κατηγορίας, από ό,τι κι αν είναι γραμμένο στη βάση. */
export function categoryEn(raw: unknown): string {
  const slug = resolveCategory(raw);
  if (slug) return CATEGORY_EN[slug] ?? slug;
  const s = String(raw ?? '').trim();
  return s || CATEGORY_EN.other;
}
