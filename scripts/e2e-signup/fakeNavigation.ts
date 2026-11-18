// Ο δρομολογητής του Next για τον πάγκο: η σύνδεση τον χρειάζεται μόνο για να
// πάει στον πίνακα μετά την είσοδο, που ο πάγκος δεν κάνει.
export function useRouter() {
  return { push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} }
}

// Η διαδρομή της σελίδας: το `useLocale` τη διαβάζει για να ξέρει αν σερβίρεται
// κάτω από το /en. Ο πάγκος δείχνει την ελληνική εγγραφή.
export function usePathname() {
  return '/signup'
}
