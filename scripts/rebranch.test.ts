// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ scripts/rebranch.sh ΔΕΝ ΑΝΑΙΡΕΙ ΟΣΑ ΜΠΗΚΑΝ ΣΤΟ main ΣΤΟ ΜΕΤΑΞΥ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (29/10/2026). Το σενάριο υπολόγιζε τη διαφορά με δύο τελείες,
// `git diff origin/main HEAD`. Οταν το main είχε προχωρήσει μετά τη βάση του
// κλαδιού, το patch έσβηνε σιωπηλά ό,τι είχε μπει στο main: εκείνη τη μέρα
// περίπου 1.200 γραμμές των #451/#452.
//
// Κάθε σενάριο στήνει πραγματικό αποθετήριο σε προσωρινό φάκελο, με ένα «origin»
// και έναν κλώνο, όπου τρέχει το ΙΔΙΟ το σενάριο του αποθετηρίου.
// ═══════════════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SCRIPT = resolve('scripts/rebranch.sh')
const ROOT = mkdtempSync(join(tmpdir(), 'rebranch-'))
// Απομόνωση από τις ρυθμίσεις του μηχανήματος (υπογραφές, hooks, ονόματα).
writeFileSync(join(ROOT, 'gitconfig'), '[user]\n\tname = Δοκιμή\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n')
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: join(ROOT, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1', LC_ALL: 'C.UTF-8' }

let failures = 0
let n = 0

function sh(cwd: string, cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { cwd, env: ENV, encoding: 'utf8' })
  return { code: r.status ?? -1, out: (r.stdout || '') + (r.stderr || '') }
}
function git(cwd: string, ...args: string[]) {
  const r = sh(cwd, 'git', args)
  if (r.code !== 0) throw new Error(`git ${args.join(' ')} → ${r.code}\n${r.out}`)
  return r.out.trim()
}
const write = (dir: string, f: string, s: string) => writeFileSync(join(dir, f), s)
const read = (dir: string, f: string) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : null)
function commit(dir: string, msg: string) { git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', msg) }
const rebranch = (dir: string) => sh(dir, 'bash', [SCRIPT])

/** Ενα «origin» με ένα commit στο main. Ο κλώνος του δουλεύει σε κλαδί εργασίας. */
function setup(name: string) {
  const origin = join(ROOT, name + '-origin.git')
  const seed = join(ROOT, name + '-seed')
  const work = join(ROOT, name + '-work')
  git(ROOT, 'init', '-q', '--bare', origin)
  git(ROOT, 'init', '-q', seed)
  write(seed, 'a.txt', 'ένα\nδύο\nτρία\n')
  commit(seed, 'βάση')
  git(seed, 'remote', 'add', 'origin', origin)
  git(seed, 'push', '-q', 'origin', 'main')
  git(ROOT, 'clone', '-q', origin, work)
  git(work, 'checkout', '-q', '-b', 'ergasia')
  return { seed, work }
}
/** Κάποιος άλλος συγχωνεύει στο main (μέσω του seed). */
function landOnMain(seed: string, f: string, s: string, msg: string) {
  git(seed, 'pull', '-q', '--ff-only', 'origin', 'main')
  write(seed, f, s)
  commit(seed, msg)
  git(seed, 'push', '-q', 'origin', 'main')
}

function scenario(title: string, fn: () => void) {
  n++
  try { fn(); console.log(`  ✓ ${title}`) }
  catch (e) { failures++; console.error(`  ✗ ${title}\n    ${String((e as Error).message).split('\n').join('\n    ')}`) }
}
function expect(cond: boolean, msg: string) { if (!cond) throw new Error(msg) }

console.log('scripts/rebranch.sh')

scenario('το main προχώρησε μετά τη βάση: η δουλειά του main μένει, η δουλειά του κλαδιού μπαίνει', () => {
  const { seed, work } = setup('s1')
  write(work, 'b.txt', 'δουλειά του κλαδιού\n')
  commit(work, 'κλαδί')
  landOnMain(seed, 'c.txt', 'μπήκε στο main στο μεταξύ (#451)\n', 'άλλο PR')
  landOnMain(seed, 'a.txt', 'ένα\nδύο αλλαγμένο στο main\nτρία\n', 'κι άλλο PR')
  const r = rebranch(work)
  expect(r.code === 0, `κωδικός ${r.code}\n${r.out}`)
  expect(read(work, 'c.txt') === 'μπήκε στο main στο μεταξύ (#451)\n', 'ΑΝΑΙΡΕΘΗΚΕ το c.txt του main')
  expect(read(work, 'a.txt') === 'ένα\nδύο αλλαγμένο στο main\nτρία\n', 'ΑΝΑΙΡΕΘΗΚΕ η αλλαγή του main στο a.txt')
  expect(read(work, 'b.txt') === 'δουλειά του κλαδιού\n', 'χάθηκε η δουλειά του κλαδιού')
  expect(git(work, 'rev-parse', 'HEAD') === git(work, 'rev-parse', 'origin/main'), 'το κλαδί δεν ξεκινά από το origin/main')
  const staged = git(work, 'diff', '--cached', '--name-only')
  expect(staged === 'b.txt', `σταδιασμένα: «${staged}», αναμενόταν μόνο b.txt`)
})

scenario('μετά από squash, νέα δουλειά στις ίδιες γραμμές: χωρίς ψεύτικη σύγκρουση, χωρίς αναίρεση', () => {
  const { seed, work } = setup('s2')
  write(work, 'a.txt', 'ένα\nδύο από το PR\nτρία\n')
  commit(work, 'PR πρώτο μέρος')
  // Το PR μπαίνει με squash: ΝΕΟ commit στο main, ίδιο περιεχόμενο.
  landOnMain(seed, 'a.txt', 'ένα\nδύο από το PR\nτρία\n', 'squash του PR (#1)')
  landOnMain(seed, 'd.txt', 'άλλο PR μετά το squash\n', 'άλλο PR (#2)')
  write(work, 'a.txt', 'ένα\nδύο από το PR, διορθωμένο\nτρία\n')
  commit(work, 'PR δεύτερο μέρος')
  const r = rebranch(work)
  expect(r.code === 0, `κωδικός ${r.code}\n${r.out}`)
  expect(read(work, 'd.txt') === 'άλλο PR μετά το squash\n', 'ΑΝΑΙΡΕΘΗΚΕ το d.txt του main')
  expect(read(work, 'a.txt') === 'ένα\nδύο από το PR, διορθωμένο\nτρία\n', `λάθος a.txt: ${read(work, 'a.txt')}`)
  const staged = git(work, 'diff', '--cached', '--name-only')
  expect(staged === 'a.txt', `σταδιασμένα: «${staged}», αναμενόταν μόνο a.txt`)
})

scenario('όλη η δουλειά έχει μπει με squash: το κλαδί ξαναστήνεται στο main, χωρίς διαφορά', () => {
  const { seed, work } = setup('s3')
  write(work, 'b.txt', 'β\n')
  commit(work, 'κλαδί')
  landOnMain(seed, 'b.txt', 'β\n', 'squash (#3)')
  landOnMain(seed, 'e.txt', 'ε\n', 'άλλο PR (#4)')
  const r = rebranch(work)
  expect(r.code === 0, `κωδικός ${r.code}\n${r.out}`)
  expect(git(work, 'rev-parse', 'HEAD') === git(work, 'rev-parse', 'origin/main'), 'το κλαδί δεν είναι στο origin/main')
  expect(git(work, 'status', '--porcelain') === '', 'έμειναν αλλαγές')
})

scenario('πραγματική σύγκρουση: σταματά με 1 και δεν αγγίζει τίποτα', () => {
  const { seed, work } = setup('s4')
  write(work, 'a.txt', 'ένα\nδύο από το κλαδί\nτρία\n')
  commit(work, 'κλαδί')
  landOnMain(seed, 'a.txt', 'ένα\nδύο από άλλον\nτρία\n', 'άλλος')
  const before = git(work, 'rev-parse', 'HEAD')
  const r = rebranch(work)
  expect(r.code === 1, `κωδικός ${r.code}, αναμενόταν 1\n${r.out}`)
  expect(git(work, 'rev-parse', 'HEAD') === before, 'το HEAD μετακινήθηκε')
  expect(git(work, 'rev-parse', '--abbrev-ref', 'HEAD') === 'ergasia', 'άλλαξε κλαδί')
  expect(git(work, 'status', '--porcelain') === '', 'το δέντρο εργασίας πειράχθηκε')
  expect(read(work, 'a.txt') === 'ένα\nδύο από το κλαδί\nτρία\n', 'άλλαξε το a.txt')
})

rmSync(ROOT, { recursive: true, force: true })
console.log(`\n${n - failures}/${n} σενάρια`)
if (failures) process.exit(1)
