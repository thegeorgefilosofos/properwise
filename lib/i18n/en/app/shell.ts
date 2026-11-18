// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΕΛΥΦΟΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΣΤΑ ΑΓΓΛΙΚΑ (app/dashboard/page.tsx και γύρω του)
// ─────────────────────────────────────────────────────────────────────────
// Πλαϊνή μπάρα, πάνω μπάρα, επιλογέας ακινήτου, κάτω μπάρα του κινητού,
// αναζήτηση (⌘K), κατάσταση ακινήτου, η κενή οθόνη του νέου λογαριασμού και
// τα μηνύματα του κελύφους. Οροι από το docs/i18n/GLOSSARY-EN.md.
//
// ΦΤΑΝΕΙ ΜΟΝΟ ΣΤΟΝ ΧΡΗΣΤΗ ΠΟΥ ΔΙΑΛΕΞΕ ΑΓΓΛΙΚΑ, με δυναμικό import()
// (lib/i18n/appEn.tsx). Ο Ελληνας χρήστης δεν το κατεβάζει ποτέ.
// ═══════════════════════════════════════════════════════════════════════════
import type { PropertyStatus } from '@/lib/property/status';
import { ASSISTANT_NAME_EN } from '@/lib/i18n/en/noa';

export const SHELL_EN = {
  loading: 'Loading…',
  account: 'Account',
  /** Τα ονόματα των καρτελών, ένα ανά κωδικό (lib/nav/labels.ts). */
  nav: {
    portfolio: 'Portfolio',
    overview: 'Overview',
    calendar: 'Calendar',
    finances: 'Expenses',
    accounting: 'Accounting',
    loan: 'Loan',
    tenant: 'Tenants',
    pricing: 'Short-term rental',
    clients: 'Guests',
    inventory: 'Furniture and equipment',
    documents: 'Property File',
    contacts: 'Contacts',
    checklist: 'To-dos',
    roi: 'Returns',
    plan: 'Planning',
    referral: 'Invitation program',
    settings: 'Account',
  } as Record<string, string>,
  partnerProgram: 'Partner program',
  /** Η κατάσταση του ακινήτου, με την εξήγησή της (lib/property/status.ts). */
  status: {
    rent_long: ['Long-term rental', 'A tenant with a lease and monthly rent'],
    rent_short: ['Short-term rental', 'Airbnb, Booking, stays by the night'],
    vacant: ['Vacant', 'Not earning right now'],
    own_use: ['Own use', 'You or someone close to you lives there'],
    renovation: ['Renovation', 'Under works, not rented out'],
    for_sale: ['For sale', 'In the process of being sold'],
    disputed: ['Disputed', 'A legal matter or dispute is open'],
  } as Record<PropertyStatus, readonly [string, string]>,
  statusHead: 'Status',
  statusTitle: 'Property status and tools (edit, delete)',
  toolsHead: 'Property tools',
  editDetails: 'Edit details',
  deleteProperty: 'Delete property',
  goTo: (tab: string) => `Go to ${tab}`,
  scanTitle: {
    property: 'Take a photo of any document or upload it: a bill, a payment receipt, a lease, an insurance policy',
    bulk: 'Several properties at once, from form E9 or the ENFIA assessment',
    none: 'Add a property first',
  },
  scanLabel: 'Scan a document',
  scanModal: 'Scan a document',
  lockedTab: 'Available on a higher plan',
  fewerTabs: 'Fewer tabs',
  fewerTabsTitle: 'Hides the tabs you don’t need right now. Nothing is lost: they come back with one click.',
  allTabs: 'All tabs',
  allTabsTitle: 'The app shows what you need now first. The other tabs appear once they make sense, or now with one click.',
  accountTitle: 'Account and settings',
  signOut: 'Log out',
  menu: 'Menu',
  menuUnknown: 'Menu, to-dos could not be checked: reload the page',
  menuPending: (n: number) => `Menu, ${n} ${n === 1 ? 'to-do' : 'to-dos'}`,
  pendingUnknownTitle: 'To-dos could not be checked. Reload the page.',
  searchTitle: (kbd: string) => `Search and quick actions (${kbd})`,
  search: 'Search',
  noPropertyYet: 'No property yet',
  loadFailed: {
    title: 'Your properties didn’t load',
    body: 'Your data is safe. The connection is usually the cause.',
    retry: 'Try again',
  },
  empty: {
    title: 'Start with one property',
    body: 'The type, the status and a name are enough, for example “Downtown apartment”. You can fill in the rest whenever you like.',
    steps: [
      ['The basics', 'Type, status and a name.'],
      ['One bill', 'Take a photo, check the amounts and it is filed under the property.'],
      ['Your ENFIA', 'An estimate of Greece’s annual property tax, with what is still missing for your accountant.'],
    ] as readonly (readonly [string, string])[],
    add: 'Add your property',
    fromE9: 'From form E9 or ENFIA',
    example: 'See an example',
  },
  back: (tab: string) => `Back: ${tab}`,
  mainNav: 'Main navigation',
  activeProperty: (name: string) => `Active property: ${name}`,
  /** Η αναζήτηση (⌘K). */
  cmdk: {
    goHint: 'Go to',
    navGroup: 'Navigation',
    propertyHint: 'Property',
    propertiesGroup: 'Properties',
    actionHint: 'Action',
    ask: `Ask ${ASSISTANT_NAME_EN}`,
    add: 'Add a property',
    bulk: 'Add many from form E9 or ENFIA',
    language: 'Language: Ελληνικά',
    signOut: 'Log out',
    recent: 'Recent',
    suggested: 'Suggested',
    quick: 'Quick jump',
    dialog: 'Search and go to',
    input: 'Search or go to',
    placeholder: 'Search or go to… (property, tab, action)',
    none: (q: string) => `No results for “${q}”`,
  },
  /** Ο επιλογέας ακινήτου της πάνω μπάρας. */
  switcher: {
    change: 'Switch property',
    properties: 'Properties',
    filter: 'Name or address',
    filterLabel: 'Search properties',
    noMatch: 'No property matches.',
    add: 'Add a property',
  },
  /** Η καρτέλα που δεν φόρτωσε (TabBoundary). */
  boundary: {
    title: 'This section didn’t load',
    body: 'The other sections work as usual and your data is safe. Try again or carry on from the menu.',
    copy: 'Click to copy',
    retry: 'Try again',
  },
  update: { text: 'A new version of PROPERWISE is available.', action: 'Reload' },
  /** Οι επιβεβαιώσεις του κελύφους. */
  confirmDelete: (name: string, mine: boolean) =>
    `Delete the property “${name}” for good?\n\n`
    + `Everything linked to it will be deleted (income, expenses, bills, tenant, loans, inventory, documents, stays), together with the history of your conversations with ${ASSISTANT_NAME_EN} about it. This can’t be undone.`
    + (mine ? '' : '\n\nThe property isn’t yours: it belongs to the owner who added you to the team. The deletion is written to their log under your name.'),
  confirmDeleteLabel: 'Delete for good',
  unsavedScan: 'The scan is done and its details haven’t been saved yet.',
  /** Τα κουμπιά των διαλόγων (components/confirmBus.ts) όταν τα ζητά το κέλυφος. */
  dialog: {
    confirmTitle: 'Confirm',
    cancel: 'Cancel',
    discardTitle: 'Discard your changes?',
    discardConfirm: 'Close without saving',
    discardCancel: 'Continue',
  },
  signOutConfirm: {
    title: 'Log out?',
    message: (tab: string) => `There are scans in “${tab}” that haven’t been saved. They are lost when you log out.`,
    confirm: 'Log out without saving',
    cancel: 'Continue',
  },
};

/** Η μορφή του λεξικού: τα ελληνικά του κελύφους έχουν το ίδιο σχήμα. */
export type ShellEn = typeof SHELL_EN;
