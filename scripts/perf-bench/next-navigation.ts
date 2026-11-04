// ═══════════════════════════════════════════════════════════════════════════
// Ο ΔΡΟΜΟΛΟΓΗΤΗΣ ΤΟΥ NEXT, ΓΙΑ ΤΟΝ ΠΑΓΚΟ
// ─────────────────────────────────────────────────────────────────────────
// Ο πάγκος δεν τρέχει μέσα στην εφαρμογή του Next, οπότε το `useRouter` έριχνε
// «expected app router to be mounted» και η σκηνή έβγαινε ΚΕΝΗ. Εδώ οι ίδιες
// συναρτήσεις, χωρίς πλοήγηση: ο σαρωτής μετρά την οθόνη, δεν πατά συνδέσμους.
// ═══════════════════════════════════════════════════════════════════════════
const router = { push: () => {}, replace: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => {} };
export const useRouter = () => router;
export const usePathname = () => location.pathname;
export const useSearchParams = () => new URLSearchParams(location.search);
export const useParams = () => ({});
export const redirect = () => {};
export const notFound = () => {};
