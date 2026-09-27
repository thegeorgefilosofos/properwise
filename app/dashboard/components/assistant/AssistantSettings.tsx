'use client'
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΡΥΘΜΙΣΕΙΣ ΤΗΣ ΝΟΑΣ ΜΕΣΑ ΣΤΟ ΠΑΝΕΛ
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react'
import { T, TT, Btn, ChipToggle, LinkBtn } from '@/components/Theme'
import { type AssistantPrefs, type Memory, ADDRESS_OPTIONS } from '../assistantPersona'
import { settingsTitle } from '@/lib/assistant/identity'
// Ο διακόπτης ζει στο UIComponents, ένας για όλη την εφαρμογή.
import { Toggle } from '../UIComponents'

// ── Διακόπτης (toggle) ──────────────────────────────────────────────────────
// ── Ρυθμίσεις συμπεριφοράς ──────────────────────────────────────────────────
// ΤΟ ΟΝΟΜΑ ΚΑΙ ΤΟ ΦΥΛΟ ΕΦΥΓΑΝ ΑΠΟ ΕΔΩ. Δεν είναι απώλεια επιλογής: ο χρήστης
// δεν ζητούσε να «φτιάξει βοηθό», ζητούσε βοήθεια. Το ερώτημα «πώς να με λες;»
// μπροστά στην πρώτη του ερώτηση ήταν φόρος και το αποτέλεσμα ήταν ότι κανείς
// δεν μιλούσε στο ίδιο πρόσωπο. Μένουν οι ρυθμίσεις που αλλάζουν πραγματικά τη
// συμπεριφορά: προσφώνηση, μνήμη, σύγκριση ακινήτων.
export function AssistantSettings({ draft, onSave, onCancel, onClearMemory, hasMemory, facts, onForgetFact, onForgetAllFacts }: { draft: AssistantPrefs; onSave: (p: AssistantPrefs) => void; onCancel: () => void; onClearMemory: () => void; hasMemory: boolean; facts: Memory[]; onForgetFact: (id: string) => void; onForgetAllFacts: () => void }) {
  const [memory, setMemory] = useState(draft.memory);
  const [compare, setCompare] = useState(draft.compare);
  const [formal, setFormal] = useState(draft.formal);
  const row = { display: 'flex', alignItems: 'center', gap: 12 } as const;
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>
      <div>
        <div style={{ ...TT.h2, fontSize: 'var(--fs-base)' }}>{settingsTitle()}</div>
        <div style={{ ...TT.bodySm, marginTop: 4 }}>Πώς θέλεις να δουλεύει μαζί σου. Αλλάζει όποτε θες.</div>
      </div>

      <div>
        <div style={{ ...TT.label, fontSize: 'var(--fs-xs)', marginBottom: 4 }}>Πώς θέλεις να σου μιλάει;</div>
        <div style={{ ...TT.caption, marginBottom: 8 }}>Στον ενικό για πιο φιλική κουβέντα ή στον πληθυντικό για πιο επίσημο ύφος.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ADDRESS_OPTIONS.map(a => {
            const active = formal === a.value;
            return (
              <ChipToggle key={String(a.value)} on={active} onClick={() => setFormal(a.value)}>
                {a.label}<span style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, opacity: 0.8 }}>{a.hint}</span>
              </ChipToggle>
            );
          })}
        </div>
      </div>

      {/* Μνήμη & σύγκριση */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
        <div style={row}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.font.sans, fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Να θυμάται τις συζητήσεις</div>
            <div style={{ fontFamily: T.font.sans, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>Συνεχίζει από εκεί που μείναμε, ανά ακίνητο. Το ιστορικό μένει μόνο σε αυτή τη συσκευή.</div>
          </div>
          <Toggle on={memory} onChange={setMemory} ariaLabel="Να θυμάται τις συζητήσεις" />
        </div>
        {memory && hasMemory && (
          // Το περιτύλιγμα κρατά τη θέση με το alignSelf και την τυπογραφία που κληρονομεί το LinkBtn
          <span style={{ alignSelf: 'flex-start', fontFamily: T.font.sans, fontSize: 12, fontWeight: 600 }}>
            <LinkBtn tone="danger" onClick={onClearMemory}>Σβήσε τη μνήμη αυτού του ακινήτου</LinkBtn>
          </span>
        )}
        {memory && facts.length > 0 && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.inner, padding: '11px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div style={{ fontFamily: T.font.sans, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>Τι θυμάται για σένα</div>
              <span style={{ fontFamily: T.font.sans, fontSize: 'var(--fs-xs)', fontWeight: 600 }}><LinkBtn tone="quiet" onClick={onForgetAllFacts}>Ξέχασέ τα όλα</LinkBtn></span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {facts.map(f => (
                <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: T.radius.pill, padding: '5px 6px 5px 11px', fontFamily: T.font.sans, fontSize: 12, color: 'var(--text-primary)', maxWidth: '100%' }}>
                  <span className="po-elide" style={{ maxWidth: 220 }}>{f.text}</span>
                  <button onClick={() => onForgetFact(f.id)} aria-label="Ξέχασέ το" title="Ξέχασέ το" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, flexShrink: 0, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                    <svg aria-hidden="true" width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        <div style={row}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.font.sans, fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Σύγκριση μεταξύ ακινήτων</div>
            <div style={{ fontFamily: T.font.sans, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>Να βλέπει και τα άλλα σου ακίνητα για συγκρίσεις (ποιο αποδίδει καλύτερα).</div>
          </div>
          <Toggle on={compare} onChange={setCompare} ariaLabel="Σύγκριση μεταξύ ακινήτων" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Btn variant="secondary" size="lg" onClick={onCancel}>Ακύρωση</Btn>
        {/* Το flex: 1 μετακόμισε στο περιτύλιγμα και το `field` δίνει στο κουμπί όλο το πλάτος με ύψος πεδίου */}
        <div style={{ flex: 1 }}>
          <Btn variant="primary" field onClick={() => onSave({ memory, compare, formal })}>Αποθήκευση</Btn>
        </div>
      </div>
    </div>
  );
}
