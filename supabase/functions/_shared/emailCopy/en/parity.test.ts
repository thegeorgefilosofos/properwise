// npx tsx supabase/functions/_shared/emailCopy/en/parity.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΑΓΓΛΙΚΟΣ ΚΑΤΑΛΟΓΟΣ EMAIL ΛΕΕΙ ΤΙΣ ΙΔΙΕΣ ΛΕΞΕΙΣ ΜΕ ΤΗΝ ΕΦΑΡΜΟΓΗ
// ─────────────────────────────────────────────────────────────────────────
// Το Deno δεν φτάνει στο lib/: τα ονόματα των πακέτων και η φράση ακύρωσης
// ζουν στο supabase/functions/_shared/emailCopy/en/kit.ts ως αντίγραφα. Εδώ
// συγκρίνονται με την πηγή τους (lib/i18n/en/plans.ts, lib/legal/billingWords.ts),
// ώστε μια αλλαγή εκεί να μη μείνει πίσω στα email.
// ═══════════════════════════════════════════════════════════════════════════
import { PLAN_COPY_EN } from '@/lib/i18n/en/plans';
import { CANCEL_ANYTIME_EN } from '@/lib/legal/billingWords';
import { ASSISTANT_NAME_EN } from '@/lib/i18n/en/noa';
import { PACKAGE_NAME_EN, FREE_PLAN_EN, NOTE } from './kit.ts';
import { PACKAGE_NAME } from '../../emailTemplates.ts';
import { CATALOG, DIGESTS } from '../../emailCopy.ts';
import { CATALOG_EN, DIGESTS_EN } from './index.ts';

let p = 0, f = 0;
const ok = (c: boolean, m: string) => { if (c) p++; else { f++; console.error('✗', m); } };

for (const k of Object.keys(PACKAGE_NAME) as (keyof typeof PACKAGE_NAME_EN)[]) {
  ok(PACKAGE_NAME_EN[k] === PLAN_COPY_EN[k].name, `πακέτο ${k}: «${PACKAGE_NAME_EN[k]}» όπως στο lib/i18n/en/plans.ts («${PLAN_COPY_EN[k].name}»)`);
}
ok(FREE_PLAN_EN === PLAN_COPY_EN.free.name, 'το πακέτο χωρίς συνδρομή λέγεται όπως στην εφαρμογή');
ok(NOTE.cancel === CANCEL_ANYTIME_EN, 'η φράση ακύρωσης είναι η CANCEL_ANYTIME_EN του billingWords');
ok(Object.keys(CATALOG).sort().join() === Object.keys(CATALOG_EN).sort().join(), 'ίδια αναγνωριστικά στον κατάλογο');
ok(Object.keys(DIGESTS).sort().join() === Object.keys(DIGESTS_EN).sort().join(), 'ίδια αναγνωριστικά στις συνόψεις');

// Η Νόα με το όνομά της, ποτέ «assistant».
const rich = { name: 'Maria', appUrl: 'https://properwise.gr', assistantSkill: 'x', discountPct: 10, discountCode: 'C', token: 'A'.repeat(43), acceptDays: 3, appointmentDate: '01/01/2027' };
for (const [id, fn] of Object.entries({ ...CATALOG_EN, ...DIGESTS_EN })) {
  const o = fn(rich);
  if (!o) continue;
  ok(!/\bassistant\b/i.test(o.subject + o.html), `${id}: η Νόα δεν λέγεται «assistant»`);
  if (/Noa/.test(o.html)) ok(o.html.includes(ASSISTANT_NAME_EN), `${id}: το όνομα της Νόας όπως στην εφαρμογή`);
}

console.log(`emailCopyEn — ${p} passed, ${f} failed`);
if (f) process.exit(1);
