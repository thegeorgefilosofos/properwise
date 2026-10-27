// npx tsx lib/seo/breadcrumbs.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΙΑΔΡΟΜΗ ΤΗΣ ΣΕΛΙΔΑΣ: ΕΓΚΥΡΟ ΣΧΗΜΑ, ΑΠΟΛΥΤΕΣ ΔΙΕΥΘΥΝΣΕΙΣ, ΚΑΘΕ ΥΠΟΛΟΓΙΣΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// (α) Η συνάρτηση δίνει `BreadcrumbList` όπως το ζητά η schema.org και η Google:
//     θέσεις από το 1, όνομα και απόλυτο `item` με τον κανονικό host σε κάθε
//     κρίκο, η αρχική πρώτη.
// (β) Κάθε δημόσιος υπολογιστής του καταλόγου (lib/core/publicTools.ts) δηλώνει
//     τη διαδρομή του: είτε μέσα από το `toolJsonLd` είτε με `toolBreadcrumb`
//     για τη δική του διαδρομή. Ως 27/10/2026 κανένας δεν τη δήλωνε.
// (γ) Οι οδηγοί και το /logistes παίρνουν τη διαδρομή από την ίδια συνάρτηση,
//     όχι από δικό τους αντίγραφο του σχήματος.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { SITE } from '@/lib/core/site'
import { PUBLIC_TOOLS } from '@/lib/core/publicTools'
import { breadcrumbJsonLd, crumbUrl, HOME_CRUMB } from './breadcrumbs'
import { toolBreadcrumb } from '@/app/toolSeo'

let passed = 0, failed = 0
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; console.log('  ✗ ' + name) } }

type Item = { '@type': string; position: number; name: string; item: string }

// ── (α) ΤΟ ΣΧΗΜΑ ────────────────────────────────────────────────────────────
{
  const b = breadcrumbJsonLd([{ name: 'Οδηγοί', path: '/odigos' }, { name: 'Οδηγός', path: '/odigos/x' }])
  const items = b.itemListElement as Item[]
  ok('τύπος BreadcrumbList', b['@type'] === 'BreadcrumbList')
  ok('η αρχική μπαίνει πρώτη', items[0].name === HOME_CRUMB.name && items[0].item === SITE)
  ok('τρεις κρίκοι', items.length === 3)
  ok('θέσεις 1, 2, 3', items.map(i => i.position).join() === '1,2,3')
  ok('κάθε κρίκος είναι ListItem', items.every(i => i['@type'] === 'ListItem'))
  ok('κάθε κρίκος έχει απόλυτο item με τον κανονικό host', items.every(i => i.item.startsWith('https://') && i.item.startsWith(SITE)))
  ok('ο τελευταίος κρίκος είναι η σελίδα', items[2].item === `${SITE}/odigos/x`)
  ok('κανένα διπλό κάθετο', items.every(i => !i.item.slice('https://'.length).includes('//')))
  const again = breadcrumbJsonLd([HOME_CRUMB, { name: 'Σ', path: '/s' }]).itemListElement as Item[]
  ok('η αρχική δεν μπαίνει δύο φορές', again.length === 2 && again[0].item === SITE)
  ok('η αρχική γράφεται όπως στο canonical και στον χάρτη', crumbUrl('/') === SITE)
}

// ── (β) ΚΑΘΕ ΥΠΟΛΟΓΙΣΤΗΣ ────────────────────────────────────────────────────
for (const t of PUBLIC_TOOLS) {
  const items = toolBreadcrumb(t.href).itemListElement as Item[]
  ok(`${t.href}: Αρχική › ${t.label}`, items.length === 2 && items[1].name === t.label && items[1].item === SITE + t.href)
  const src = readFileSync(`app${t.href}/page.tsx`, 'utf8')
  ok(`${t.href}: η σελίδα δηλώνει τη διαδρομή της`,
    src.includes(`toolBreadcrumb('${t.href}')`) || /toolJsonLd\(/.test(src))
}
{
  let threw = false
  try { toolBreadcrumb('/den-yparxei') } catch { threw = true }
  ok('άγνωστος υπολογιστής είναι σφάλμα', threw)
}

// ── (γ) ΜΙΑ ΣΥΝΑΡΤΗΣΗ ───────────────────────────────────────────────────────
for (const f of ['app/odigos/GuideParts.tsx', 'app/logistes/page.tsx', 'app/odigos/page.tsx', 'app/toolSeo.tsx']) {
  const src = readFileSync(f, 'utf8')
  ok(`${f}: χωρίς δικό του BreadcrumbList`, !src.includes("'BreadcrumbList'"))
  ok(`${f}: από το breadcrumbJsonLd`, src.includes('breadcrumbJsonLd('))
}

console.log(`${failed ? '✗' : '✓'} breadcrumbs: ${passed} πέρασαν${failed ? `, ${failed} απέτυχαν` : ''}`)
if (failed) process.exit(1)
