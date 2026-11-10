// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΣΤΥΛ ΤΟΥ ΑΡΧΕΙΟΥ ΖΟΥΝ ΕΔΩ, ΟΧΙ ΣΤΟ globals.css (04/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Το globals.css φορτώνει σε κάθε σελίδα, μαζί με τις δημόσιες, όπου οι
// φάκελοι δεν εμφανίζονται ποτέ. Εδώ τα αποδίδει μόνο το Αρχείο
// (TabDocuments), με ένα <style>.
// Οι κλάσεις: .fb-* οι φάκελοι, .af-* τα φίλτρα, .ad-* η γραμμή εργαλείων.
// ═══════════════════════════════════════════════════════════════════════════
export const ARCHIVE_CSS = String.raw`
/* ═══ ΑΡΧΕΙΟ: ΦΑΚΕΛΟΙ (archive/FolderBrowser.tsx) ════════════════════════
   Στήλες στον υπολογιστή, λίστα με τρίγωνα, μία λίστα τη φορά στο κινητό.
   Λεπτές γραμμές αντί για κάρτες μέσα σε κάρτες· ίδιο ύψος γραμμής (34)
   παντού στις στήλες, 52 στο κινητό. Νούμερα σε ίσα ψηφία. */
.fb-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 0 2px 10px; }
.fb-head .fb-crumbs { padding: 0; }
.fb-card { border: 1px solid var(--border-subtle); border-radius: 14px; background: var(--bg-surface); padding: 12px 12px 0; overflow: hidden; }
.fb-card .fb-table { border: none; border-radius: 0; margin: 0 -12px; }
.fb-count {
  flex-shrink: 0; min-width: 22px; padding: 1px 6px; border-radius: 100px; text-align: center;
  font-size: 11px; font-weight: 600; color: var(--text-secondary); background: var(--bg-overlay); font-variant-numeric: tabular-nums;
}
.fb-row[aria-selected="true"] .fb-count { background: var(--bg-surface); }
.fb-seg {
  display: inline-flex; padding: 2px; gap: 2px; border-radius: 9px;
  background: var(--bg-overlay); border: 1px solid var(--border-subtle);
}
.fb-seg-btn {
  min-height: 30px; padding: 0 12px; border: none; border-radius: 6px; background: none; cursor: pointer;
  font-family: inherit; font-size: var(--fs-xs); font-weight: 600; color: var(--text-secondary);
}
.fb-seg-btn[aria-pressed="true"] { background: var(--bg-surface); color: var(--text-primary); box-shadow: var(--elev-1); }
.fb-seg-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.fb-seg-small { align-self: flex-start; margin: 4px 0 12px; }

/* Εικονογραφία: ο φάκελος με την καρτέλα του, στο χρώμα της εφαρμογής. */
.fb-folder { flex-shrink: 0; }
.fb-folder-back { fill: var(--accent); opacity: .55; }
.fb-folder-front { fill: var(--accent); opacity: .22; }
.fb-folder-glyph { color: var(--accent); }
.fb-file { position: relative; display: inline-flex; flex-shrink: 0; }
.fb-file-page { fill: var(--bg-surface); stroke: var(--border-default); stroke-width: 1.2; }
.fb-file-fold { fill: none; stroke: var(--border-default); stroke-width: 1.2; }
.fb-file-tag {
  position: absolute; left: -4px; bottom: 14%; padding: 1px 5px; border-radius: 3px;
  font-size: 11px; font-weight: 700; letter-spacing: .02em; line-height: 1.3;
  color: var(--accent-text); background: var(--accent);
}
.fb-file-tag[data-small] { left: -2px; bottom: 16%; width: 60%; height: 4px; padding: 0; border-radius: 2px; }
.fb-file-tag[data-ext="PDF"] { background: var(--negative); }
.fb-year-dot { width: 18px; height: 18px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
.fb-year-dot::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--text-tertiary); }

/* Γραμμή διαδρομής: κάθε κομμάτι πατήσιμο. */
.fb-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 0 2px 10px; font-size: var(--fs-xs); }
.fb-crumb-wrap { display: inline-flex; align-items: center; gap: 2px; }
.fb-crumb {
  border: none; background: none; padding: 4px 6px; border-radius: 6px; font-family: inherit;
  font-size: var(--fs-xs); color: var(--text-secondary); cursor: pointer; min-height: 32px;
}
button.fb-crumb:hover { background: var(--bg-overlay); color: var(--text-primary); }
button.fb-crumb:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
span.fb-crumb { display: inline-flex; align-items: center; color: var(--text-primary); font-weight: 600; cursor: default; }
button.fb-crumb { display: inline-flex; align-items: center; }
.fb-crumb-sep { color: var(--text-tertiary); }

/* ── Στήλες ── */
.fb-columns-wrap { border: 1px solid var(--border-subtle); border-radius: 14px; background: var(--bg-surface); padding: 14px 14px 0; }
/* Τέσσερις θέσεις πάντα, όπως στο Finder: οι στήλες δεν αλλάζουν πλάτος
   καθώς προχωράς· η προεπισκόπηση προστίθεται δεξιά. */
/* Το ύψος ακολουθεί το περιεχόμενο: από 360 ώς 70% της οθόνης, με κύλιση
   ανά στήλη. Ήταν σταθερό κουτί 340+ που έμενε άδειο με λίγα αρχεία. */
.fb-columns {
  display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, .9fr) minmax(0, 1.35fr);
  border-top: 1px solid var(--border-subtle); min-height: 360px; max-height: 70vh;
}
.fb-columns[data-preview="true"] { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, .9fr) minmax(0, 1.3fr) minmax(260px, 1.15fr); }
.fb-col-files { grid-column: 4; }
.fb-preview { grid-column: 5; }
.fb-col { display: flex; flex-direction: column; gap: 2px; padding: 10px 8px 14px; border-right: 1px solid var(--border-subtle); min-width: 0; overflow-y: auto; }
.fb-col-files { border-right: none; }
.fb-col-head {
  margin: 0 0 4px; padding: 0 8px; font-size: var(--fs-base); font-weight: 600; color: var(--text-secondary);
}
.fb-row {
  display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 0 8px; border-radius: 8px;
  cursor: pointer; color: var(--text-primary); font-size: var(--fs-xs); user-select: none;
}
.fb-row:hover { background: var(--bg-overlay); }
.fb-row[aria-selected="true"] { background: var(--accent-soft); font-weight: 600; }
.fb-row:focus { outline: none; }
.fb-row:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
/* Τα ονόματα αναδιπλώνονται, δεν κόβονται: το κοινό όνομα κρατά έτος και
   ποσό στο τέλος του, ακριβώς εκεί που θα έπεφτε το αποσιωπητικό. */
.fb-row { padding-block: 6px; }
.fb-row-name { flex: 1; min-width: min-content; line-height: 1.35; }
/* Μόνο τα κοινά ονόματα αρχείων σπάνε οπουδήποτε· τα ονόματα φακέλων σπάνε
   μόνο στα κενά («2026» έσπαγε σε τέσσερις γραμμές). */
.fb-file-row .fb-row-name { min-width: 0; overflow-wrap: anywhere; }
.fb-row-meta { flex-shrink: 0; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
/* Πλήθος και ποσό στην ίδια στοίχιση σε κάθε στήλη: σταθερό πλάτος ποσού. */
.fb-row-sum { flex-shrink: 0; width: 74px; color: var(--text-secondary); font-variant-numeric: tabular-nums; text-align: right; }
.fb-row-date { flex-shrink: 0; width: 76px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; text-align: right; }
.fb-row-chev { flex-shrink: 0; color: var(--text-tertiary); }
.fb-row[aria-selected="true"] .fb-row-chev { color: var(--accent); }
.fb-file-row { align-items: flex-start; }
.fb-file-row .fb-file, .fb-file-row .fb-thumb-sm { margin-top: 2px; }
.fb-file-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.fb-file-meta { display: flex; justify-content: space-between; gap: 8px; color: var(--text-secondary); font-variant-numeric: tabular-nums; font-weight: 400; }
.fb-thumb-sm { width: 18px; height: 22px; object-fit: cover; border-radius: 3px; flex-shrink: 0; border: 1px solid var(--border-subtle); }

/* Πάνελ προεπισκόπησης. */
.fb-preview { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px 16px; border-left: 1px solid var(--border-subtle); min-width: 0; overflow-y: auto; }
.fb-preview-media {
  display: flex; align-items: center; justify-content: center; height: 150px; border-radius: 10px;
  background: var(--bg-overlay); overflow: hidden;
}
.fb-preview-img { width: 100%; height: 100%; object-fit: cover; }
.fb-preview-name { margin: 0; font-size: var(--fs-base); font-weight: 700; color: var(--text-primary); overflow-wrap: anywhere; }
.fb-preview-dl { margin: 0; display: flex; flex-direction: column; }
.fb-preview-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-top: 1px solid var(--border-subtle); font-size: var(--fs-xs); }
.fb-preview-row dt { color: var(--text-secondary); flex-shrink: 0; }
.fb-preview-row dd { margin: 0; color: var(--text-primary); text-align: right; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.fb-preview-actions { display: flex; gap: 8px; flex-wrap: wrap; }

/* ── Λίστα με τρίγωνα ── */
.fb-table { border: 1px solid var(--border-subtle); border-radius: 14px; background: var(--bg-surface); overflow: hidden; }
.fb-tr {
  display: grid; grid-template-columns: minmax(0, 1fr) 110px 100px 80px; align-items: center;
  min-height: 36px; border-top: 1px solid var(--border-subtle); font-size: var(--fs-xs);
}
.fb-tr:first-child { border-top: none; }
.fb-th { min-height: 32px; background: var(--bg-overlay); color: var(--text-tertiary); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.fb-td-name { min-width: 0; padding-left: 10px; }
.fb-th .fb-td-name { padding-left: 14px; }
.fb-tr[data-depth="1"] .fb-td-name { padding-left: 30px; }
.fb-tr[data-depth="2"] .fb-td-name { padding-left: 50px; }
.fb-tr[data-depth="3"] .fb-td-name { padding-left: 74px; }
.fb-td-num, .fb-td-date, .fb-td-size { padding-right: 14px; text-align: right; color: var(--text-secondary); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fb-disclose, .fb-file-open {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 36px; padding: 0 4px; border: none;
  background: none; cursor: pointer; font-family: inherit; font-size: var(--fs-xs); color: var(--text-primary); text-align: left;
}
.fb-file-open:disabled { cursor: default; }
.fb-tr:hover { background: var(--bg-overlay); }
.fb-file-open:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 6px; }
.fb-tri { flex-shrink: 0; color: var(--text-tertiary); transition: transform .15s; }
.fb-disclose[aria-expanded="true"] .fb-tri { transform: rotate(90deg); }
.fb-disclose .fb-row-name { font-weight: 600; }

/* ── Κινητό ── */
.fb-phone { border: 1px solid var(--border-subtle); border-radius: 14px; background: var(--bg-surface); padding: 6px 12px 12px; overflow: hidden; }
.fb-back {
  display: inline-flex; align-items: center; gap: 2px; min-height: 44px; padding: 0 4px 0 0; border: none; background: none;
  font-family: inherit; font-size: var(--fs-base); color: var(--accent); cursor: pointer; max-width: 100%;
}
.fb-back:focus-visible { outline: 2px solid var(--accent); border-radius: 8px; }
.fb-phone-head { padding: 4px 0 10px; }
.fb-phone-title { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -.01em; color: var(--text-primary); overflow-wrap: anywhere; }
.fb-phone-sub { margin: 2px 0 0; font-size: var(--fs-xs); color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
.fb-phone-list { list-style: none; margin: 0; padding: 0; }
.fb-phone-list li + li { border-top: 1px solid var(--border-subtle); }
.fb-phone-row {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 6px 2px; border: none; background: none;
  font-family: inherit; text-align: left; color: var(--text-primary); cursor: pointer;
}
.fb-phone-row:active { background: var(--bg-overlay); }
.fb-phone-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 8px; }
.fb-phone-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.fb-phone-name { font-size: var(--fs-base); font-weight: 600; overflow-wrap: anywhere; }
.fb-phone-name.fb-wrap { white-space: normal; overflow-wrap: anywhere; font-size: var(--fs-xs); }
.fb-phone-meta { font-size: var(--fs-xs); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.fb-phone-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.fb-phone-tile {
  display: flex; flex-direction: column; gap: 6px; width: 100%; padding: 0 0 8px; border: 1px solid var(--border-subtle);
  border-radius: 12px; background: var(--bg-elevated); font-family: inherit; text-align: left; color: var(--text-primary); cursor: pointer; overflow: hidden;
}
.fb-phone-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.fb-phone-thumb { display: flex; align-items: center; justify-content: center; height: 96px; background: var(--bg-overlay); }
.fb-phone-tile-name {
  padding: 0 10px; font-size: var(--fs-xs); font-weight: 600; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
}
.fb-phone-tile .fb-phone-meta { padding: 0 10px; }
.fb-phone-pane { animation: fb-in .22s cubic-bezier(.2,0,0,1); }
.fb-phone-pane[data-dir="out"] { animation-name: fb-out; }
@keyframes fb-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes fb-out { from { transform: translateX(-24px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .fb-phone-pane { animation: none; } .fb-tri { transition: none; } }

/* Κενή κατάσταση. */
.fb-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; text-align: center;
  border: 1px solid var(--border-subtle); border-radius: 14px; background: var(--bg-surface);
}
.fb-empty-title { margin: 6px 0 0; font-size: var(--fs-base); font-weight: 700; color: var(--text-primary); }
.fb-empty-hint { margin: 0 0 8px; max-width: 420px; font-size: var(--fs-xs); color: var(--text-secondary); }

/* Το κοινό όνομα είναι μακρύ (Ασφαλιστήριο_Ασφάλειες Ελλάς_2026_06_240,00.pdf)
   και η κάτω παύλα δεν είναι σημείο αλλαγής γραμμής: σε στενή κάρτα κοβόταν
   στο «Ασφάλειες Ελλ…» και χανόταν ακριβώς το έτος και το ποσό. Δύο γραμμές,
   σπάσιμο οπουδήποτε, ολόκληρο στο «title«. */
.arc-filename {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
  overflow: hidden; overflow-wrap: anywhere;
}

/* ═══ ΑΡΧΕΙΟ: ΣΥΝΟΨΗ, ΓΡΑΜΜΗ ΕΡΓΑΛΕΙΩΝ, ΦΙΛΤΡΑ (TabDocuments, ArchiveFilters) ═
   Μία διακριτική γραμμή σύνοψης, μία γραμμή εργαλείων και τα ενεργά φίλτρα
   ως ετικέτες. Τα φίλτρα είναι dropdown (≥768) ή φύλλο από κάτω (<768). */
.ad-summary { margin: 0 0 10px; font-size: var(--fs-xs); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.ad-summary-count { font-weight: 700; color: var(--text-primary); }
.ad-summary-num { font-weight: 600; color: var(--text-primary); }
.ad-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.ad-search { position: relative; flex: 1 1 260px; min-width: 200px; }
.ad-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); pointer-events: none; }
.ad-search-input {
  width: 100%; height: 40px; box-sizing: border-box; padding: 0 36px; border-radius: 100px;
  border: 1px solid var(--border-control); background: var(--bg-elevated); color: var(--text-primary);
  font-family: inherit; font-size: var(--fs-xs);
}
.ad-search-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.ad-search-clear { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); }
.ad-toggles { display: flex; gap: 8px; flex-wrap: wrap; }
@media (max-width: 1279px) { .ad-wide-only { display: none !important; } }

.af-wide { display: flex; gap: 8px; flex-wrap: wrap; }
.af-dd { position: relative; }
.af-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 12px; border-radius: 10px;
  border: 1px solid var(--border-subtle); background: var(--bg-surface); color: var(--text-primary);
  font-family: inherit; font-size: var(--fs-xs); font-weight: 600; cursor: pointer; white-space: nowrap; max-width: 260px;
}
.af-btn:hover { background: var(--bg-overlay); }
.af-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.af-btn[data-active] { border-color: var(--accent-border); background: var(--accent-soft); color: var(--accent); }
.af-btn-label { overflow: hidden; text-overflow: ellipsis; }
.af-btn:disabled { opacity: .5; cursor: default; }
/* Μετά το .af-btn, ώστε το display του να μη νικά. */
.af-btn.af-narrow { display: none; }
.af-pop {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 60; width: 280px; max-height: 360px;
  display: flex; flex-direction: column; border-radius: 12px; border: 1px solid var(--border-subtle);
  background: var(--bg-surface); box-shadow: var(--elev-3); overflow: hidden;
}
.af-list-wrap { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.af-search {
  margin: 10px 10px 4px; height: 34px; padding: 0 10px; border-radius: 8px; box-sizing: border-box;
  border: 1px solid var(--border-control); background: var(--bg-elevated); color: var(--text-primary);
  font-family: inherit; font-size: var(--fs-xs);
}
.af-list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; }
.af-opt {
  display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 0 8px; border-radius: 8px;
  font-size: var(--fs-xs); color: var(--text-primary); cursor: pointer;
}
.af-opt:hover { background: var(--bg-overlay); }
.af-check-input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.af-check {
  width: 16px; height: 16px; flex-shrink: 0; border-radius: 3px; border: 1.5px solid var(--border-default);
  display: inline-flex; align-items: center; justify-content: center; color: var(--accent-text);
}
.af-check-input:checked + .af-check { background: var(--accent); border-color: var(--accent); }
.af-check-input:focus-visible + .af-check { outline: 2px solid var(--accent); outline-offset: 2px; }
.af-opt-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.af-opt-count { flex-shrink: 0; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.af-none { padding: 10px 8px; font-size: var(--fs-xs); color: var(--text-secondary); }
.af-pop-foot { display: flex; justify-content: flex-end; padding: 6px 10px 10px; border-top: 1px solid var(--border-subtle); }
.af-link {
  border: none; background: none; padding: 6px 4px; font-family: inherit; font-size: var(--fs-xs); font-weight: 600;
  color: var(--accent); cursor: pointer; min-height: 32px;
}
.af-link:focus-visible { outline: 2px solid var(--accent); border-radius: 6px; }

.af-tags { display: flex; align-items: center; gap: 6px; margin: -4px 0 12px; overflow-x: auto; scrollbar-width: none; }
.af-tags::-webkit-scrollbar { display: none; }
.af-tag {
  display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0; height: 28px; padding: 0 2px 0 10px; border-radius: 100px;
  background: var(--accent-soft); color: var(--accent); font-size: var(--fs-xs); font-weight: 600;
}
.af-tag-x {
  width: 24px; height: 24px; border: none; background: none; border-radius: 50%; color: inherit; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.af-tag-x:hover { background: var(--bg-surface); }
.af-tag-x:focus-visible { outline: 2px solid var(--accent); }

/* Φύλλο από κάτω (κινητό). */
.af-sheet-scrim { position: fixed; inset: 0; z-index: 1300; background: var(--scrim-media); display: flex; align-items: flex-end; }
.af-sheet {
  width: 100%; max-height: 82dvh; display: flex; flex-direction: column; border-radius: 18px 18px 0 0;
  background: var(--bg-surface); box-shadow: var(--elev-3); outline: none;
  padding-bottom: env(safe-area-inset-bottom); animation: af-up .22s cubic-bezier(.2,0,0,1);
}
@keyframes af-up { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .af-sheet { animation: none; } }
.af-sheet-grip { width: 36px; height: 4px; border-radius: 2px; background: var(--border-default); margin: 8px auto 4px; }
.af-sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 16px 8px; }
.af-sheet-title { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary); }
.af-sheet-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 16px; }
.af-acc + .af-acc { border-top: 1px solid var(--border-subtle); }
.af-acc-head {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 52px; border: none; background: none; padding: 0;
  font-family: inherit; font-size: var(--fs-base); font-weight: 600; color: var(--text-primary); cursor: pointer; text-align: left;
}
.af-acc-label { flex: 1; }
.af-acc-on { min-width: 22px; padding: 1px 7px; border-radius: 100px; background: var(--accent); color: var(--accent-text); font-size: 11px; text-align: center; }
.af-acc-chev { color: var(--text-secondary); transition: transform .15s; display: inline-flex; }
.af-acc-head[aria-expanded="true"] .af-acc-chev { transform: rotate(180deg); }
.af-acc .af-list { padding: 0 0 8px; }
.af-sheet-foot { padding: 12px 16px 16px; border-top: 1px solid var(--border-subtle); }
.af-primary {
  width: 100%; height: 48px; border: none; border-radius: 12px; background: var(--accent); color: var(--accent-text);
  font-family: inherit; font-size: var(--fs-base); font-weight: 700; cursor: pointer;
}
.af-primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

@media (max-width: 767px) {
  .ad-search { flex-basis: 100%; }
  .af-wide { display: none; }
  .af-btn.af-narrow { display: inline-flex; }
}
`;
