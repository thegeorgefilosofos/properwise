// npx tsx lib/assistant/scanShape.test.ts
import { scanShapeError, SCAN_SHAPE } from './scanShape'

let pass = 0, fail = 0
const eq = (n: string, a: unknown, b: unknown) => { if (a === b) pass++; else { fail++; console.error(`✗ ${n}: πήρα ${JSON.stringify(a)}, περίμενα ${JSON.stringify(b)}`) } }

const img = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }
const ok1 = { system: 'x'.repeat(4918), messages: [{ role: 'user', content: [img, { type: 'text', text: 'Αναγνώρισε και ανάλυσε αυτό το έγγραφο.' }] }] }
eq('η σάρωση της εφαρμογής περνά', scanShapeError(ok1), '')
eq('χωρίς system περνά', scanShapeError({ messages: ok1.messages }), '')
eq('system σε blocks περνά', scanShapeError({ system: [{ type: 'text', text: 'σύντομο' }], messages: ok1.messages }), '')

// Η κατάχρηση που έκλεινε: μια μικρή εικόνα και τεράστιο κείμενο ή συνομιλία.
eq('τεράστιο κείμενο δίπλα στην εικόνα', scanShapeError({ messages: [{ role: 'user', content: [img, { type: 'text', text: 'λ'.repeat(SCAN_SHAPE.maxTextChars + 1) }] }] }), 'text')
eq('συνομιλία πολλών μηνυμάτων', scanShapeError({ messages: [ok1.messages[0], { role: 'assistant', content: 'ok' }, ok1.messages[0]] }), 'messages')
eq('τεράστιο system prompt', scanShapeError({ system: 's'.repeat(SCAN_SHAPE.maxSystemChars + 1), messages: ok1.messages }), 'system')
eq('χωρίς αρχείο', scanShapeError({ messages: [{ role: 'user', content: [{ type: 'text', text: 'γεια' }] }] }), 'files')
eq('τρία αρχεία', scanShapeError({ messages: [{ role: 'user', content: [img, img, img] }] }), 'files')
eq('άγνωστο block', scanShapeError({ messages: [{ role: 'user', content: [img, { type: 'tool_result' }] }] }), 'block')
eq('ρόλος assistant', scanShapeError({ messages: [{ role: 'assistant', content: [img] }] }), 'role')

console.log(fail === 0 ? `✓ scanShape: ${pass} έλεγχοι πέρασαν` : `✗ scanShape: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
