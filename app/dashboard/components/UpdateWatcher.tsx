'use client'

// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΓΚΑΤΕΣΤΗΜΕΝΗ ΕΦΑΡΜΟΓΗ ΑΚΟΛΟΥΘΕΙ ΚΑΘΕ ΝΕΑ ΕΚΔΟΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ρωτά τον διακομιστή ποιο build τρέχει (app/api/version) όταν η εφαρμογή
// ξαναβγαίνει μπροστά και κάθε μισή ώρα όσο είναι ανοιχτή. Τι κάνει όταν
// διαφέρει το αποφασίζει η `decideUpdate` (lib/pwa/update.ts): ανανέωση μόνη
// της μόνο όταν δεν χάνεται τίποτα, αλλιώς μήνυμα με κουμπί.
//
// ΠΡΩΤΑ Ο SERVICE WORKER, ΜΕΤΑ Η ΣΕΛΙΔΑ. Το `update()` φέρνει το νέο sw.js αν
// άλλαξε· με το `skipWaiting` του αναλαμβάνει αμέσως, οπότε η ανανέωση που
// ακολουθεί φορτώνει ολόκληρη τη νέα έκδοση και όχι μισή.
//
// Ζει στον πίνακα ελέγχου και όχι στο ριζικό layout: οι δημόσιες σελίδες
// φορτώνονται από την αρχή σε κάθε επίσκεψη και δεν έχουν περιθώριο βάρους.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react'
import { notify } from '@/components/Toast'
import { decideUpdate, POLL_MS, MIN_GAP_MS } from '@/lib/pwa/update'

const MINE = process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev'

/** Γράφει κάτι ή έχει ανοιχτό παράθυρο: τότε καμία ανανέωση χωρίς ερώτηση. */
function busy(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return true
  return !!document.querySelector('[aria-modal="true"], dialog[open]')
}

async function reloadFresh() {
  try { await (await navigator.serviceWorker?.getRegistration())?.update() } catch { /* ανανεώνεται έτσι κι αλλιώς */ }
  window.location.reload()
}

export default function UpdateWatcher() {
  useEffect(() => {
    if (MINE === 'dev') return
    let lastCheck = 0
    let hiddenAt = document.hidden ? Date.now() : 0
    let offered = ''

    const check = async (awayMs: number) => {
      if (Date.now() - lastCheck < MIN_GAP_MS) return
      lastCheck = Date.now()
      let live: string | null = null
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (res.ok) live = ((await res.json()) as { build?: string }).build ?? null
      } catch { /* χωρίς δίκτυο: ξαναρωτά την επόμενη φορά */ }
      const action = decideUpdate(MINE, live, awayMs, busy())
      if (action === 'reload') { void reloadFresh(); return }
      if (action === 'offer' && live && offered !== live) {
        offered = live
        notify('Υπάρχει νέα έκδοση του PROPERWISE.', {
          duration: 0,
          action: { label: 'Ανανέωση', onClick: () => { void reloadFresh() } },
        })
      }
    }

    const onVisibility = () => {
      if (document.hidden) { hiddenAt = Date.now(); return }
      const away = hiddenAt ? Date.now() - hiddenAt : 0
      hiddenAt = 0
      void check(away)
    }
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(() => { if (!document.hidden) void check(0) }, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [])
  return null
}
