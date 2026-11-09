import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newsDecided, newsFromParam, newsMeta, newsParam, pendingNews } from './signupNews';

// Δύο συγκαταθέσεις, μία για κάθε σκοπό (νομικός έλεγχος 09/11/2026, Π-5).
// Ό,τι δεν τσεκαρίστηκε δεν ανοίγει ποτέ, ούτε αν αποτύχει το επόμενο βήμα.

test('η διεύθυνση επιστροφής κρατά την επιλογή και αγνοεί τα άγνωστα', () => {
  for (const c of [{ product: false, market: false }, { product: true, market: false }, { product: false, market: true }, { product: true, market: true }])
    assert.deepEqual(newsFromParam(newsParam(c)), c);
  assert.deepEqual(newsFromParam(null), { product: false, market: false });
  assert.deepEqual(newsFromParam('1'), { product: false, market: false });
});

test('μόνο τα δύο τσεκαρισμένα αφήνουν τις προεπιλογές της βάσης', () => {
  assert.equal(newsMeta({ product: true, market: true }).marketing_opt_out, undefined);
  assert.equal(newsMeta({ product: true, market: false }).marketing_opt_out, true);
  assert.equal(newsMeta({ product: false, market: true }).marketing_opt_out, true);
  assert.equal(newsMeta({ product: false, market: false }).marketing_opt_out, true);
});

test('εκκρεμεί μόνο ό,τι δεν το λένε ήδη οι προεπιλογές και μόνο μία φορά', () => {
  assert.equal(pendingNews(newsMeta({ product: true, market: true })), null);
  assert.deepEqual(pendingNews(newsMeta({ product: true, market: false })), { product: true, market: false });
  assert.deepEqual(pendingNews(newsMeta({ product: false, market: false })), { product: false, market: false });
  assert.equal(pendingNews({ ...newsMeta({ product: false, market: true }), consent_news_applied_at: 'x' }), null);
});

test('οι παλιοί λογαριασμοί δεν αγγίζονται', () => {
  assert.equal(pendingNews({ consent_terms_accepted_at: 'x' }), null);
  assert.equal(pendingNews({ marketing_opt_out: true }), null);
  assert.equal(newsDecided({ marketing_opt_out: true }), true);
  assert.equal(newsDecided({}), false);
});
