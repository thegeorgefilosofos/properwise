'use client'
// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΙΣΟΔΟΣ ΣΤΗΝ ΠΡΟΣΤΑΣΙΑ ΙΔΙΟΚΤΗΤΗ, ΜΕΣΑ ΣΤΟΝ ΟΔΗΓΟ ΔΑΝΕΙΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Μικρή κάρτα· το εργαλείο κατεβαίνει μόνο όταν πατηθεί (next/dynamic), ώστε ο
// Οδηγός να μη βαραίνει. Ανοίγει από το πακέτο που ορίζει το
// FEATURE_MIN_PLAN.foreclosure_protection (απόφαση ιδιοκτήτη 12/11/2026)· η
// πρόταση για το πακέτο έρχεται από το lib/legal/billingWords.ts μέσω του
// /api/billing/words, όπως κάθε δήλωση για πακέτα και χρέωση.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { T, Btn } from '@/components/Theme'
import { hasFeature } from '@/lib/billing/entitlements'
import type { PlanId } from '@/lib/billing/plans'
import { useBillingWords } from '../useBillingWords'

const Prostasia = dynamic(() => import('./Prostasia'), { ssr: false })

export default function ProstasiaEntry({ plan, userId }: { plan: PlanId; userId: string }) {
  const [open, setOpen] = useState(false)
  const allowed = hasFeature({ plan }, 'foreclosure_protection')
  const words = useBillingWords()
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: T.font.sans, margin: 0 }}>Έλαβα έγγραφο από δικαστικό επιμελητή, τράπεζα ή servicer</p>
      <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: T.font.sans, margin: 0 }}>
        Η Προστασία ιδιοκτήτη σε βοηθά να καταλάβεις τι έλαβες, ποιες προθεσμίες προκύπτουν από τον νόμο και ποιες επιλογές έχεις. Δεν αποθηκεύει τίποτα.
      </p>
      {allowed
        ? (open
          ? <Prostasia userId={userId}/>
          : <div><Btn variant="primary" onClick={() => setOpen(true)} expanded={false}>Άνοιξε την Προστασία ιδιοκτήτη</Btn></div>)
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {words?.prostasiaAccess && <p style={{ fontSize: 'var(--fs-note)', color: 'var(--text-secondary)', fontFamily: T.font.sans, margin: 0 }}>{words.prostasiaAccess}</p>}
            <div><Btn variant="secondary" href="/paketa">Δες τα πακέτα</Btn></div>
          </div>
        )}
    </div>
  )
}
