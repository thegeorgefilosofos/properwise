// Ο δρομολογητής του Next για τον πάγκο: η σύνδεση τον χρειάζεται μόνο για να
// πάει στον πίνακα μετά την είσοδο, που ο πάγκος δεν κάνει.
export function useRouter() {
  return { push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} }
}
