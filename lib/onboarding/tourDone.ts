// Το τοπικό δίχτυ της περιήγησης (lib/onboarding/tour.ts): μόνο αν η εγγραφή
// του `onboarding_progress.completed` αποτύχει, ώστε η περιήγηση να μην
// ξανανοίξει στην ίδια συσκευή. Χωριστό αρχείο, γιατί το διαβάζει ο πίνακας σε
// κάθε φόρτωση και τα κείμενα της περιήγησης δεν χρειάζεται να ταξιδέψουν μαζί.
export const TOUR_DONE_KEY = 'pw_tour_done';

export function tourDoneLocally(): boolean {
  try { return localStorage.getItem(TOUR_DONE_KEY) === '1'; } catch { return false; }
}

export function markTourDoneLocally(): void {
  try { localStorage.setItem(TOUR_DONE_KEY, '1'); } catch { /* κλειστή αποθήκη */ }
}
