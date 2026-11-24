'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureDpa } from '@/lib/legal/dpa';
import * as properties from '@/lib/data/properties';
import * as tenantStore from '@/lib/data/tenants';
import * as rentStore from '@/lib/data/rent';
import { syncInstalments } from './rentInstalments';
import {
  s,
  fmt,
  fmtD,
  daysLeft,
  calcEnd,
  ServicesEditor,
  serviceLinesFrom,
  LEASE_LABELS,
  LEASE_CATEGORY_LABELS,
  ID_DOCS,
  syncTenantSchedule,
  type TenantScheduleInput,
} from './TabTenantHelpers';
import type { LeaseType, LeaseCategory, IdDocType, PaymentFreq } from './TabTenantHelpers';
import {
  ToggleField,
  NumberInput,
  TextInput,
  Textarea,
  CustomSelect as SelectField,
  DatePicker,
} from './UIComponents';
import {
  T,
  PageTitle,
  InfoBanner,
  Badge,
  Btn,
  EmptyState,
  SecHdr,
  Modal,
  SideSheet,
  fe,
  fn,
  fp,
  Skeleton,
  SkeletonKPIs,
  IconBtn,
  ChipToggle,
  fixedCols,
  TT,
  RecordCard,
  StatStrip,
} from '@/components/Theme';
import {
  Users,
  SearchX,
  Search,
  ChevronRight,
  Trash2,
  Wallet,
  AlertTriangle,
  ShieldCheck,
  History,
} from 'lucide-react';
import {
  notify,
  notifyOk,
  notifyError,
} from '@/components/Toast';
import { saved } from '@/components/dbWrite';
import { propertyStatus } from '@/lib/facts/status';
import { showTool } from '@/lib/ui/thresholds';
import { confirmDialog } from '@/components/ConfirmDialog';
import LeaseModal from './LeaseModal';
import LeaseDeclaration from './LeaseDeclaration';
import { leaseDocKey, leaseDocPath } from './leaseFlow';
import { PeaLeaseNotice } from './PeaLeaseNotice';
import { downloadTableXlsx, csvDate } from './exportCsv';
import {
  useReportBranding,
} from '@/lib/reportBranding';
import { PRESUMPTIVE_DEDUCTION_RATE } from '@/lib/accounting/statement';
import {
  TENANT_FIELDS,
  formFields,
  missingCritical,
} from '@/lib/property/fields';
import { failed } from '@/lib/core/dbError';
// Το Αρχείο έχει ένα σπίτι: lib/data/documents.
import * as documents from '@/lib/data/documents';
import {
  PAYMENT_FREQ_LABELS,
  isPaymentFreq,
} from '@/lib/rent/frequency';
// Τα σχήματα και οι κανόνες τους ζουν χωριστά από τις οθόνες.
import {
  DEPOSIT_METHODS,
  FURNISHING_LABELS,
  isPastTenant,
  isIdDocType,
  todayISO,
  isFurnished,
  blank,
  hasMoreData,
  tenantDefaults,
  tenantFormProblem,
  tenantFieldId,
  type TenantFieldKey,
  type Tenant,
  type RentPayment,
  type TenantDamage,
  type RentComp,
  type MaintenanceReq,
  type TabTenantProps,
  type Furnishing,
} from './TabTenantTypes';
// Τα μικρά κομμάτια που ξαναχρησιμοποιούνται σε όλες τις οθόνες της καρτέλας.
import {
  SectionTitle,
  ChipRow,
  Chip,
  AlertBar,
  whyOf,
  labelOf,
  FilePickRow,
  MissingCriticalBar,
  tenantFieldCtx,
  filledTenantIds,
} from './TabTenantParts';
// Οι οθόνες της καρτέλας, χωρισμένες σε «χρήματα» και «όλα τα υπόλοιπα».
import {
  PaymentsView,
  DepositView,
  RenewalView,
} from './TabTenantMoney';
import { DashboardView, CommView, LegalTaxView, DamagesView, MaintenanceView } from './TabTenantCare';
import { usePropertyRentTax } from './usePropertyRentTax';
import { useLoad, type LoadTurn } from '@/app/hooks/useLoad';
import { plural } from '@/lib/core/greek';
import { ActionMenu } from '@/components/ActionMenu';
import { avatar } from './clients/Bits';
import { navLabel } from '@/lib/nav/labels';
import { cleanDigits } from '@/lib/property/powerSupply';
import { useAppEn } from '@/lib/i18n/appEn';
import type { TenantsEn } from '@/lib/i18n/en/app/tenants';

// ─── Design tokens, shared source of truth (components/Theme) ────────────────

// ─── HTML escaping for values interpolated into document.write() templates ────

// ─── Οριστική διαγραφή ενοικιαστή ─────────────────────────────────────────────
// ΤΟ ΑΜΕΤΑΚΛΗΤΟ ΠΑΕΙ ΤΕΛΕΥΤΑΙΟ. Η διαγραφή ήταν τέσσερα αιτήματα από τον
// περιηγητή: πρώτα το PDF του μισθωτηρίου, μετά οι δόσεις, οι φθορές και στο
// τέλος ο ενοικιαστής. Αν αποτύγχανε ένα από τα δύο τελευταία, ο ενοικιαστής
// έμενε χωρίς μισθωτήριο και χωρίς ιστορικό πληρωμών, που τροφοδοτεί το Ε2 και
// τα έσοδα της χρονιάς.
//
// Τώρα οι γραμμές φεύγουν ΟΛΕΣ ΜΑΖΙ ή καμία, στη `delete_tenant` της βάσης
// (20261007130000), με τα δικαιώματα του χρήστη. Τα αρχεία σβήνονται ΜΟΝΟ αφού
// πετύχει εκείνη· αν αποτύχει το σβήσιμό τους, μένει αρχείο χωρίς κάτοχο, όχι
// ενοικιαστής χωρίς ιστορικό και ο χρήστης το μαθαίνει.
type DbErr = { message: string; code?: string } | null;
export type TenantPurge =
  | { ok: false; error: string }
  | { ok: true; payments: number; damages: number; files: number; filesError: string | null };

const PURGE_REFUSED: Record<string, string> = {
  tenant_not_found: 'Ο ενοικιαστής δεν βρέθηκε. Ίσως διαγράφηκε ήδη ή δεν έχεις πρόσβαση σε αυτόν. Δεν διαγράφηκε τίποτα.',
  tenant_not_deletable: 'Δεν έχεις δικαίωμα να διαγράψεις αυτόν τον ενοικιαστή. Δεν διαγράφηκε τίποτα.',
  payments_not_deletable: 'Δεν έχεις δικαίωμα να διαγράψεις τις πληρωμές αυτού του ενοικιαστή, οπότε δεν διαγράφηκε τίποτα. Ζήτα τη διαγραφή από τον ιδιοκτήτη του λογαριασμού.',
  damages_not_deletable: 'Δεν έχεις δικαίωμα να διαγράψεις τις φθορές αυτού του ενοικιαστή, οπότε δεν διαγράφηκε τίποτα. Ζήτα τη διαγραφή από τον ιδιοκτήτη του λογαριασμού.',
};

export async function purgeTenant(io: {
  /** Η `delete_tenant`: γραμμές σε μία συναλλαγή, επιστρέφει τα αρχεία προς σβήσιμο. */
  deleteRows: () => PromiseLike<{ data: unknown; error: DbErr }>;
  /** Σβήσιμο από το `lease-documents`. Καλείται ΜΟΝΟ μετά την επιτυχία. */
  removeFiles: (paths: string[]) => PromiseLike<{ error: DbErr }>;
}, /** Τα μηνύματα στα αγγλικά· χωρίς αυτά, τα ελληνικά. */ en?: {
  refused: Record<string, string>; failed: (what: string, e: unknown) => string;
  notDeleted: string; nothingDeleted: string; filesLeft: string;
}): Promise<TenantPurge> {
  const { data, error } = await io.deleteRows();
  if (error) {
    const known = Object.keys(PURGE_REFUSED).find(k => error.message?.includes(k));
    if (en) return { ok: false, error: known ? (en.refused[known] ?? PURGE_REFUSED[known]) : `${en.failed(en.notDeleted, error)} ${en.nothingDeleted}` };
    return { ok: false, error: known ? PURGE_REFUSED[known] : `${failed('Ο ενοικιαστής δεν διαγράφηκε', error)} Δεν διαγράφηκε τίποτα.` };
  }
  const r = (data && typeof data === 'object' ? data : {}) as { paths?: unknown; payments?: unknown; damages?: unknown };
  const paths = Array.isArray(r.paths) ? r.paths.filter((p): p is string => typeof p === 'string' && p.length > 0) : [];
  let filesError: string | null = null;
  if (paths.length) {
    try {
      const { error: rmErr } = await io.removeFiles(paths);
      if (rmErr) filesError = en ? en.failed(en.filesLeft, rmErr) : failed('Ο ενοικιαστής διαγράφηκε, αλλά το μισθωτήριο δεν σβήστηκε από τα αρχεία', rmErr);
    } catch (e) {
      filesError = en ? en.failed(en.filesLeft, e) : failed('Ο ενοικιαστής διαγράφηκε, αλλά το μισθωτήριο δεν σβήστηκε από τα αρχεία', e);
    }
  }
  return { ok: true, payments: Number(r.payments) || 0, damages: Number(r.damages) || 0, files: paths.length, filesError };
}

// ─── Main Export ──────────────────────────────────────────────────────────────
type DossierTab='overview'|'lease'|'condition'|'legal'|'comm'|'docs';

export default function TabTenant({ propertyId, userId, onStartHandover, plan='free', profileType }:TabTenantProps) {
  const supabase=createClient();
  // Τα αγγλικά της καρτέλας και του κελύφους, ή `null` στα ελληνικά.
  const E=useAppEn('tenants');
  const S=useAppEn('shell');
  const X=useAppEn('errors');
  /** Γραφή στη βάση με το σφάλμα στη γλώσσα της οθόνης. */
  const sv=(el:string,k:string,q:Parameters<typeof saved>[1])=>saved(el,q,X&&E?(e:unknown)=>X.failed(E.err[k]??el,e):undefined);
  const fail=(el:string,k:string,e:unknown)=>X&&E?X.failed(E.err[k]??el,e):failed(el,e);
  /** Ημερομηνία πίνακα· η απουσία της στα αγγλικά. */
  const fD=(d:string|null)=>E&&!d?E.noDate:fmtD(d);
  /** Ονομα και «γιατί» ενός πεδίου του μητρώου. */
  const lab=(id:string)=>E?.fields[id]?.[0]??labelOf(id);
  const why=(id:string)=>(E?E.fields[id]?.[1]:undefined)??whyOf(id);
  // Ο φόρος του ακινήτου για το «Νομικά και Φόρος», με την ίδια βάση και την
  // ίδια ενοποίηση με την Επισκόπηση (lib/facts/rentTax.ts).
  const rentTax=usePropertyRentTax(propertyId,userId,profileType);
  const branding=useReportBranding(userId);
  // Ψηφιακό μισθωτήριο: σύνταξη, υπογραφή και των δύο μερών, επαληθεύσιμο PDF.
  const [leaseOpen,setLeaseOpen]=useState(false);
  const [declOpen,setDeclOpen]=useState(false);
  // Η υπενθύμιση «Λήξη σύμβασης μίσθωσης» (Υποχρεώσεις) ανοίγει το μισθωτήριο
  // κατευθείαν για ανανέωση — ίδιο μοτίβο event με τον βοηθό.
  useEffect(()=>{
    const open=()=>setLeaseOpen(true);
    window.addEventListener('pos:lease',open);
    return ()=>window.removeEventListener('pos:lease',open);
  },[]);
  const [tenants,setTenants]=useState<Tenant[]>([]);
  const [payments,setPayments]=useState<RentPayment[]>([]);
  const [damages,setDamages]=useState<TenantDamage[]>([]);
  const [comps,setComps]=useState<RentComp[]>([]);
  const [maint,setMaint]=useState<MaintenanceReq[]>([]);
  // Τα τ.μ. ΤΟΥ ΔΙΚΟΥ ΜΑΣ ακινήτου και πόσα ακίνητα έχει ο χρήστης. Το πρώτο κρίνει
  // αν υπάρχει πρόταση αγοράς, το δεύτερο αν ο φόρος ανά ακίνητο είναι υποεκτίμηση.
  const [propSqm,setPropSqm]=useState<number|null>(null);
  // Η λήξη του ΠΕΑ του ακινήτου: κρίνει την ειδοποίηση «Χρειάζεται ΠΕΑ σε ισχύ» στη νέα μίσθωση.
  const [propPeaExpiry,setPropPeaExpiry]=useState<string|null>(null);
  const [propType,setPropType]=useState<string|null>(null);
  // Ό,τι ξέρει ήδη το ακίνητο για τον επόμενο ενοικιαστή (tenantDefaults).
  const [propDefaults,setPropDefaults]=useState<ReturnType<typeof tenantDefaults>>({});
  const [propertyCount,setPropertyCount]=useState(1);
  // Ο ΔΕΙΚΤΗΣ ΦΟΡΤΩΣΗΣ ΔΕΝ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΗ ΚΑΤΑΣΤΑΣΗ, ΕΙΝΑΙ ΕΡΩΤΗΣΗ. Ηταν
  // `setLoading(true)` στην πρώτη γραμμή της φόρτωσης: σύγχρονη γραφή μέσα σε
  // effect, δηλαδή δεύτερη απόδοση πριν καν φύγει το αίτημα. Η ερώτηση που ΟΝΤΩΣ
  // απαντά είναι «τα δεδομένα που κρατώ είναι αυτού του ακινήτου;» και απαντιέται
  // κατά την απόδοση, χωρίς καμία γραφή. Με την αλλαγή ακινήτου γίνεται αληθής
  // ΑΜΕΣΩΣ, οπότε δεν υπάρχει καρέ με τα νούμερα του προηγούμενου.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const loading = loadedFor !== propertyId
  const [saving,setSaving]=useState(false);
  // ΚΛΕΙΔΑΡΙΑ ΣΤΗΝ ΕΙΣΟΔΟ ΤΟΥ save(). Το `saving` γίνεται true ΜΕΤΑ το
  // `await ensureDpa()`, οπότε δύο γρήγορα πατήματα στο «Προσθήκη ενοικιαστή»
  // περνούσαν και τα δύο και έγραφαν δύο ίδιους ενοικιαστές. Η ref αλλάζει
  // αμέσως, χωρίς να περιμένει απόδοση.
  const saveLock=useRef(false);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  // ΤΟ ΣΦΑΛΜΑ ΤΟΥ ΠΕΔΙΟΥ ΖΕΙ ΔΙΠΛΑ ΣΤΟ ΠΕΔΙΟ (17/11/2026). Το γενικό μήνυμα
  // έβγαινε στο τέλος της φόρμας εκτός οθόνης και το «Προσθήκη ενοικιαστή»
  // έμοιαζε να μην κάνει τίποτα. Τώρα γράφεται κάτω από το πεδίο που φταίει και
  // το πεδίο έρχεται στο κέντρο της οθόνης.
  const [fieldErr,setFieldErr]=useState<{ field:TenantFieldKey; msg:string }|null>(null);
  useEffect(()=>{
    if(!fieldErr) return;
    const el=document.getElementById(tenantFieldId(fieldErr.field));
    el?.scrollIntoView({ block:'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth' });
    el?.querySelector<HTMLElement>('input,[role="combobox"],[tabindex="0"]')?.focus({ preventScroll:true });
  },[fieldErr]);
  // Και το γενικό σφάλμα αποθήκευσης έρχεται στην οθόνη, για τον ίδιο λόγο.
  const errorRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{ if(error) errorRef.current?.scrollIntoView({ block:'nearest', behavior:'smooth' }); },[error]);
  // Το in-flow banner επιτυχίας (state + helper + JSX) αφαιρέθηκε υπέρ του κοινού
  // toast: ήταν ΠΑΝΤΑ πράσινο, ακόμη και για ουδέτερα («Διαγράφηκε») ή για σφάλματα
  // επικύρωσης και έσπρωχνε το περιεχόμενο προς τα κάτω κάθε φορά που εμφανιζόταν.

  const [search,setSearch]=useState('');
  const [segment,setSegment]=useState<'current'|'past'|'overdue'|'all'>('current');

  // Φόρμα (modal)
  const [isForm,setIsForm]=useState(false);
  const [editId,setEditId]=useState<string|null>(null);
  const [form,setForm]=useState(blank());
  // ΤΙ ΕΚΡΥΒΕ ΤΟ `(k:string,v:any)`: ΚΑΙ τα δύο ορίσματα. Ένα `sf('lease_ends',…)`
  // πρόσθετε σιωπηλά νέο κλειδί στη φόρμα αντί να γράψει το υπάρχον και ένα
  // `sf('custom_lease_days','365')` έβαζε κείμενο σε αριθμητικό πεδίο. Τώρα το
  // κλειδί πρέπει να ανήκει στη φόρμα και η τιμή στον τύπο ΕΚΕΙΝΟΥ του πεδίου.
  type TenantForm=ReturnType<typeof blank>;
  const fieldNote=(k:TenantFieldKey)=>fieldErr?.field===k
    ? <div role="alert" style={{ marginTop:6, color:'var(--negative)', fontSize:'var(--fs-base)', fontFamily:T.font.sans, fontWeight:500, lineHeight:1.45 }}>{fieldErr.msg}</div>
    : null;
  const sf=<K extends keyof TenantForm>(k:K,v:TenantForm[K])=>{ setForm(f=>({...f,[k]:v})); if(fieldErr?.field===k) setFieldErr(null); };
  // Έγγραφα που ανέβηκαν μέσα από τη φόρμα (property-files + property_documents).
  const [formDocs,setFormDocs]=useState<{id:string;file_name:string;tag:'id'|'lease'}[]>([]);
  const [docBusy,setDocBusy]=useState(false);
  // «Περισσότερα»: ΚΛΕΙΣΤΟ εξ ορισμού. Κλειδωμένο δεν είναι — μόνο μαζεμένο.
  const [moreOpen,setMoreOpen]=useState(false);

  // Ντοσιέ (drawer)
  const [openId,setOpenId]=useState<string|null>(null);
  const [dossierTab,setDossierTab]=useState<DossierTab>('overview');

  // Η ΛΗΞΗ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗΝ ΕΝΑΡΞΗ ΚΑΙ ΤΟΝ ΤΥΠΟ, ΚΑΤΑ ΤΗΝ ΑΠΟΔΟΣΗ. Ηταν effect:
  // ο χρήστης που διάλεγε «τριετία» έβλεπε για ένα καρέ την ΠΑΛΙΑ ημερομηνία
  // λήξης δίπλα στον νέο τύπο, σε φόρμα που καταλήγει σε συμφωνητικό.
  const leaseKey=`${form.lease_start}|${form.lease_type}|${form.custom_lease_days}`;
  const [leaseSeen,setLeaseSeen]=useState(leaseKey);
  if(leaseKey!==leaseSeen){
    setLeaseSeen(leaseKey);
    if(form.lease_start&&form.lease_type&&form.lease_type!=='custom')
      sf('lease_end',calcEnd(form.lease_start,form.lease_type as LeaseType,form.custom_lease_days));
  }

  // Η ΠΑΛΙΑ ΑΠΑΝΤΗΣΗ ΔΕΝ ΓΡΑΦΕΙ. Με αλλαγή ακινήτου ή δύο ανανεώσεις στη σειρά,
  // η φόρτωση του προηγούμενου μπορούσε να απαντήσει ΤΕΛΕΥΤΑΙΑ και να γράψει
  // τους ενοικιαστές του κάτω από το νέο ακίνητο. Το `turn` το λέει.
  const fetch_=useCallback(async(turn:LoadTurn)=>{
    const list=await tenantStore.ofProperty<Tenant>(supabase,propertyId,'*',userId);
    if(!turn.isLatest()) return;
    const[pd,{data:dd},{data:cd},{data:md},own,pc]=await Promise.all([
      rentStore.ofProperty<RentPayment>(supabase,propertyId,'*',userId),
      supabase.from('tenant_damages').select('*').eq('property_id',propertyId).eq('user_id',userId).order('occurred_on',{ascending:false}),
      supabase.from('rent_comparables').select('id,property_id,title,area,sqm,rent,rent_per_sqm,listing_type,source,url').eq('property_id',propertyId),
      supabase.from('maintenance_requests').select('*').eq('user_id',userId).eq('property_id',propertyId).order('created_at',{ascending:false}),
      properties.one<{ sqm: number; pea_expiry: string | null; prop_type: string | null; status_detail: string | null; rental_mode: string | null; target_rent: number | null }>(supabase, propertyId, 'sqm,pea_expiry,prop_type,status_detail,rental_mode,target_rent', userId),
      // ΤΟ ΠΛΗΘΟΣ ΑΚΙΝΗΤΩΝ ΚΡΙΝΕΙ ΦΟΡΟΛΟΓΙΚΗ ΠΡΟΕΙΔΟΠΟΙΗΣΗ. Με τον ανύπαρκτο
      // πίνακα το count γύριζε null → propertyCount πάντα 1 → ο ιδιοκτήτης με
      // τρία ακίνητα ΔΕΝ έβλεπε ποτέ ότι ο φόρος είναι προοδευτικός στο
      // ΑΘΡΟΙΣΜΑ και ότι το ποσό εδώ είναι μικρότερο από το πραγματικό.
      properties.count(supabase, userId),
    ]);
    if(!turn.isLatest()) return;
    setTenants(list); setPayments(pd); setDamages((dd||[]) as TenantDamage[]); setComps((cd||[]) as RentComp[]); setMaint((md||[]) as MaintenanceReq[]);
    const sq=Number((own as {sqm?:number|null}|null)?.sqm);
    setPropPeaExpiry((own as {pea_expiry?:string|null}|null)?.pea_expiry ?? null);
    setPropType((own as {prop_type?:string|null}|null)?.prop_type ?? null);
    {
      const o=own as {prop_type?:string|null;status_detail?:string|null;rental_mode?:string|null;target_rent?:number|null}|null;
      setPropDefaults(tenantDefaults(o?{ propType:o.prop_type, status:propertyStatus(o), targetRent:o.target_rent }:null));
    }
    setPropSqm(Number.isFinite(sq)&&sq>0?sq:null);
    setPropertyCount(Math.max(1, pc||1));
    setLoadedFor(propertyId);
  },[propertyId,userId,supabase]);

  // Κάθε ανανέωση περνά από τον ίδιο δρόμο, ώστε να μετρά στην αρίθμηση.
  const reload=useLoad(fetch_);
  const refresh=useCallback(()=>reload({immediate:true}),[reload]);

  // Συγχρονισμός ημερολογίου/εργασιών για τους τρέχοντες ενοικιαστές (idempotent).
  // Η ΣΗΜΑΙΑ ΚΡΑΤΑΕΙ ΤΟ ΑΚΙΝΗΤΟ, ΟΧΙ ΕΝΑ ΝΑΙ. Ήταν `useRef(false)` που γινόταν
  // `true` μία φορά και δεν επανερχόταν ποτέ: ο συγχρονισμός έτρεχε για το πρώτο
  // ακίνητο της συνεδρίας και για κανένα άλλο. Ο ιδιοκτήτης δύο ακινήτων έβλεπε
  // τις δόσεις ενοικίου του ενός στο ημερολόγιο και του άλλου πουθενά, ώσπου να
  // ανανεώσει τη σελίδα με ανοιχτό το δεύτερο.
  const syncedFor=React.useRef<string|null>(null);
  useEffect(()=>{
    if(loading||syncedFor.current===propertyId) return;
    syncedFor.current=propertyId;
    tenants.filter(t=>!isPastTenant(t)&&t.id).forEach(t=>{
      syncTenantSchedule(supabase,t,propertyId,userId,'open',{rentDueDay:t.rent_due_day??1});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loading,propertyId]);

  // ── Παράγωγα ────────────────────────────────────────────────────────────────
  const todayS=todayISO();
  const overdueByTenant=useMemo(()=>{
    const m=new Map<string,{count:number;amount:number}>();
    payments.filter(p=>!p.paid&&p.due_date&&p.due_date<todayS).forEach(p=>{
      const e=m.get(p.tenant_id)||{count:0,amount:0}; e.count++; e.amount+=p.amount; m.set(p.tenant_id,e);
    });
    return m;
  },[payments,todayS]);
  // Δηλωμένες-από-μισθωτή πληρωμές ανά ενοικιαστή (αναμένουν επιβεβαίωση είσπραξης).
  const declaredByTenant=useMemo(()=>{
    const m=new Map<string,number>();
    payments.filter(p=>!p.paid&&p.tenant_declared).forEach(p=>m.set(p.tenant_id,(m.get(p.tenant_id)||0)+1));
    return m;
  },[payments]);

  const currentTenants=useMemo(()=>tenants.filter(t=>!isPastTenant(t)),[tenants]);
  const pastTenants=useMemo(()=>tenants.filter(isPastTenant),[tenants]);

  // Τα νούμερα της σύνοψης. Τα γράφει η `TenantSummary` πιο κάτω.
  const summary=useMemo(()=>({
    rent:currentTenants.reduce((a,t)=>a+(t.monthly_rent||0),0),
    leases:currentTenants.length,
    arrears:[...overdueByTenant.values()].reduce((a,e)=>a+e.amount,0),
    arrearsCount:[...overdueByTenant.values()].reduce((a,e)=>a+e.count,0),
    deposits:currentTenants.filter(t=>!t.deposit_returned).reduce((a,t)=>a+(t.deposit_amount||0),0),
    past:pastTenants.length,
  }),[currentTenants,pastTenants,overdueByTenant]);

  // ═══ ΕΝΑΣ ΜΙΣΘΩΤΗΣ, ΜΙΑ ΚΑΡΤΑ (Μ8, αξιολόγηση 23/11/2026) ══════════════
  // Με έναν ενοικιαστή η οθόνη έδειχνε σύνοψη που ξανάγραφε ένα προς ένα τα
  // ποσά της μοναδικής κάρτας (450 / 0 / 1.350), πεδίο αναζήτησης και τριπλό
  // φίλτρο για ένα άτομο. Η σύνοψη και το φίλτρο εμφανίζονται από δύο
  // μισθώσεις, η αναζήτηση από οκτώ (lib/ui/thresholds.ts, ο κανόνας των
  // Επαφών και του Αρχείου). Ό,τι δεν φαίνεται ΔΕΝ φιλτράρει: ένας μόνος
  // προηγούμενος ενοικιαστής δεν κρύβεται πίσω από το «Τρέχοντες».
  const segOn=showTool('filter',tenants.length), searchOn=showTool('search',tenants.length);
  const filtered=useMemo(()=>{
    const q=searchOn?search.trim().toLowerCase():'';
    const seg=segOn?segment:'all';
    return tenants.filter(t=>{
      if(seg==='current'&&isPastTenant(t)) return false;
      if(seg==='past'&&!isPastTenant(t)) return false;
      if(seg==='overdue'&&!overdueByTenant.has(t.id)) return false;
      if(q){
        const hay=`${t.full_name} ${t.afm||''} ${t.phone||''}`.toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
  },[tenants,search,segment,overdueByTenant,segOn,searchOn]);

  // ── Φόρμα ────────────────────────────────────────────────────────────────────
  const openAdd=()=>{ setForm({ ...blank(), ...propDefaults }); setFieldErr(null); setEditId(null); setFormDocs([]); setMoreOpen(false); setError(null); setIsForm(true); };
  // Κλείσιμο φόρμας με προστασία από ακούσια απώλεια δεδομένων.
  // Έγινε async γιατί ο κοινός διάλογος επιστρέφει Promise. Μετά τη μετατροπή σε
  // κοινό Modal δένεται σε ΤΕΣΣΕΡΑ σημεία: κλικ στο φόντο, το «×» της κεφαλίδας,
  // το Escape και το κουμπί «Ακύρωση» του υποσέλιδου. Κανένα δεν περιμένει
  // σύγχρονη επιστροφή, οπότε η υπογραφή είναι ασφαλής. Ο ConfirmHost ζει στη
  // ρίζα του layout με z-index 10000: δεν είναι απόγονος αυτού του φόντου, άρα
  // κανένα κλικ του δεν ξαναπυροδοτεί το closeForm και ο δίαυλος έτσι κι αλλιώς
  // απορρίπτει δεύτερη ταυτόχρονη ερώτηση.
  //
  // ΜΗ ΚΛΕΙΣΕΙΣ ΟΣΟ ΑΠΟΘΗΚΕΥΕΙ. Το χειρόγραφο παράθυρο είχε μία μόνο έξοδο που
  // δεν φρουρούνταν (κλικ στο φόντο). Το Modal πρόσθεσε δύο ακόμη — Escape και
  // «×» — και το Escape είναι ακριβώς το πλήκτρο που πατάει κανείς όσο περιμένει.
  // Η αποθήκευση κάνει ΤΡΕΙΣ διαδοχικές εγγραφές (ενοικιαστής, σύνδεση εγγράφων,
  // συγχρονισμός ημερολογίου)· αν η φόρμα φύγει στη μέση, ο χρήστης δεν βλέπει
  // ποτέ το μήνυμα σφάλματος αν κάποια αποτύχει και νομίζει ότι ακύρωσε.
  const closeForm=async()=>{
    if(saving) return;
    const dirty = !!(form.full_name.trim()||form.afm||form.phone||form.email||form.monthly_rent);
    if(dirty && !(await (E?confirmDialog(E.ask(E.toast.closeUnsaved)):confirmDialog('Κλείσιμο χωρίς αποθήκευση; Τα στοιχεία που συμπλήρωσες θα χαθούν.')))) return;
    setError(null); setFieldErr(null); setIsForm(false);
  };

  // ── ΚΛΕΙΣΙΜΟ ΝΤΟΣΙΕ ──────────────────────────────────────────────────────────
  // ΤΟ ΝΤΟΣΙΕ ΔΕΝ ΚΛΕΙΝΕΙ ΟΤΑΝ ΕΧΕΙ ΑΛΛΗ ΕΠΙΚΑΛΥΨΗ ΑΠΟ ΠΑΝΩ ΤΟΥ.
  // Το χειρόγραφο πλαϊνό φύλλο ΔΕΝ άκουγε Escape, όπως δεν άκουγαν και τα
  // παράθυρα που ανοίγουν μέσα του («Σήμανση ως πληρωμένο», «Αίτημα πληρωμής»,
  // «Σάρωση απόδειξης» της PaymentsView και η φόρμα ενοικιαστή). Τώρα ακούν
  // ΟΛΑ και ο listener του καθενός κρέμεται στο ίδιο `document`: ένα Escape
  // πάνω στο «Σήμανση ως πληρωμένο» έκλεινε ΚΑΙ το παράθυρο ΚΑΙ ολόκληρο το
  // ντοσιέ, πετώντας τον χρήστη πίσω στη λίστα ενοικιαστών.
  //
  // Ο listener του ντοσιέ στήνεται ΠΡΩΤΟΣ (προσαρτάται πρώτο), άρα τρέχει πριν
  // από του παραθύρου — ένα stopPropagation από μέσα δεν θα προλάβαινε. Μετράμε
  // λοιπόν πόσες επικαλύψεις είναι ανοιχτές τη στιγμή του συμβάντος: το ίδιο το
  // SideSheet γράφει role="dialog", όπως και κάθε Modal, ενώ ο ConfirmHost
  // γράφει role="alertdialog". Πάνω από μία σημαίνει ότι το Escape ανήκει στην
  // επάνω επικάλυψη, όχι σε εμάς. Το React δεν έχει προλάβει να αποδώσει, οπότε
  // η μέτρηση δείχνει ακόμη την πραγματική στοίβα.
  //
  // Καλύπτει και τις άλλες δύο εξόδους του SideSheet (κλικ στο φόντο, «×»):
  // εκεί δεν αλλάζει τίποτα, γιατί μια ανοιχτή επικάλυψη τα σκεπάζει ούτως ή
  // άλλως και το κλικ δεν φτάνει ποτέ σε αυτά.
  const closeDossier=()=>{
    if(isForm) return;
    if(document.querySelectorAll('[role="dialog"],[role="alertdialog"]').length>1) return;
    setOpenId(null);
  };
  const openEditForm=(t:Tenant)=>{
    const n=(v:number|null)=>v?.toString()||'';
    const f:ReturnType<typeof blank>={
      full_name:t.full_name||'',email:t.email||'',phone:t.phone||'',
      profession:t.profession||'',afm:t.afm||'',
      id_doc_type:(t.id_doc_type as IdDocType)||'',id_doc_number:t.id_doc_number||'',iban:t.iban||'',notes:t.notes||'',
      lease_type:t.lease_type||'annual',lease_category:t.lease_category||'',lease_start:t.lease_start?.split('T')[0]||'',lease_end:t.lease_end?.split('T')[0]||'',custom_lease_days:t.custom_lease_days||365,
      monthly_rent:n(t.monthly_rent),payment_frequency:t.payment_frequency||'monthly',rent_due_day:String(Math.min(Math.max(1,t.rent_due_day||1),28)),rent_iban:t.rent_iban||'',e_payment:t.e_payment??true,
      furnishing:(t.furnishing as Furnishing)||'',
      deposit_amount:n(t.deposit_amount),deposit_method:t.deposit_method||'',deposit_paid_on:t.deposit_paid_on?.split('T')[0]||'',deposit_returned:t.deposit_returned||false,deposit_return_date:t.deposit_return_date?.split('T')[0]||'',
      // Οι παλιές στήλες `streaming`/`cleaning` διαβάζονται και γίνονται γραμμές.
      services:serviceLinesFrom(t.streaming,t.cleaning),
      parking_included:t.parking_included||false,parking_extra:t.parking_extra||false,parking_extra_price:n(t.parking_extra_price),
      extra_perks:t.extra_perks||'',
      lease_doc_external_url:t.lease_doc_external_url||'',
      aade_lease_decl_ref:t.aade_lease_decl_ref||'',
    };
    // «Περισσότερα» ανοίγει μόνο αν ο χρήστης έχει όντως δεδομένα εκεί μέσα.
    setForm(f); setFieldErr(null); setFormDocs([]); setMoreOpen(hasMoreData(f));
    setEditId(t.id); setIsForm(true);
    // Επαναφόρτωση των εγγράφων που έχουν ήδη ανέβει για ΑΥΤΟΝ τον ενοικιαστή
    // (ταυτότητα, μισθωτήρια — και προηγούμενα με τον ίδιο ενοικιαστή).
    documents.ofSupplier<{id:string;file_name:string|null;title:string|null}>(supabase,propertyId,'tenant:'+t.id,'id,file_name,title',userId)
      .then(rows=>{ setFormDocs(rows.map(d=>({ id:d.id, file_name:d.file_name||'έγγραφο', tag:(d.title||'').startsWith('Έγγραφο ταυτοποίησης')?'id':'lease' as 'id'|'lease' }))); });
  };

  // Ανέβασμα εγγράφου φόρμας (ταυτοποίηση ή μισθωτήριο) — ίδιο μοτίβο με το
  // property-files/property_documents που χρησιμοποιείται στη σάρωση/αρχειοθέτηση.
  const uploadFormDoc=async(file:File,tag:'id'|'lease')=>{
    // Νέος ενοικιαστής: η ταυτότητα ανέβαινε πριν ζητηθεί η σύμβαση στο save()
    // και έμενε στο Αρχείο ακόμη κι αν ο χρήστης έλεγε «Όχι τώρα».
    if(!editId && !(await ensureDpa(supabase))){setError(E?E.toast.docNeedsDpa:'Το έγγραφο δεν ανέβηκε: χρειάζεται αποδοχή της σύμβασης επεξεργασίας.');return;}
    setDocBusy(true); setError(null);
    try{
      const safe=file.name.replace(/[^\w.\-]+/g,'_');
      const path=`${userId}/${propertyId}/document/${Date.now()}_${safe}`;
      const{error:upErr}=await supabase.storage.from('property-files').upload(path,file,{upsert:false,contentType:file.type||undefined});
      if(upErr){ setError(fail('Το αρχείο δεν ανέβηκε','fileNotUploaded', upErr)); setDocBusy(false); return; }
      const label=tag==='id'?'Έγγραφο ταυτοποίησης':'Μισθωτήριο / έγγραφο';
      const title=`${label} · ${form.full_name.trim()||file.name}`.slice(0,200);
      const ins=await documents.add(supabase,propertyId,userId,{kind:'document',category:'tenant',supplier:editId?('tenant:'+editId):null,title,doc_date:todayISO(),file_path:path,file_name:file.name,mime:file.type||null,size_bytes:file.size});
      if(ins.error){ setError(fail('Το έγγραφο δεν καταχωρήθηκε','docNotFiled', ins.error)); setDocBusy(false); return; }
      if(ins.id) setFormDocs(prev=>[...prev,{id:ins.id as string,file_name:file.name,tag}]);
      notifyOk(E?E.toast.docUploaded:'Το έγγραφο ανέβηκε');
    }catch{ setError(E?E.toast.docFailed:'Το έγγραφο δεν ανέβηκε. Δοκίμασε ξανά.'); }
    setDocBusy(false);
  };

  /** Η γραμμή που επεξεργάζεται, για όσα δεν ζουν στη φόρμα (εκκρεμής αναπροσαρμογή). */
  const editRow=editId?tenants.find(t=>t.id===editId):undefined;

  const save=async()=>{
    if(saveLock.current) return;
    saveLock.current=true;
    try{ await saveUnlocked(); } finally { saveLock.current=false; }
  };
  const saveUnlocked=async()=>{
    const problem=tenantFormProblem(form);
    if(problem){ setError(null); setFieldErr(E?{ ...problem, msg:E.form.errors[problem.field]??problem.msg }:problem); return; }
    setFieldErr(null);
    const declRef=cleanDigits(form.aade_lease_decl_ref);
    if(declRef.error){setError(E?E.toast.declRef(declRef.error):`Αριθμός δήλωσης μίσθωσης: ${declRef.error}`);setMoreOpen(true);return;}
    // Νέος ενοικιαστής: πρώτα η σύμβαση επεξεργασίας (lib/legal/dpa.ts).
    if(!editId && !(await ensureDpa(supabase))){setError(E?E.toast.saveNeedsDpa:'Τα στοιχεία δεν αποθηκεύτηκαν: χρειάζεται αποδοχή της σύμβασης επεξεργασίας.');return;}
    setSaving(true);setError(null);
    const n=(v:string)=>v?Math.max(0,parseFloat(v)):null;
    const dueDay=Math.min(Math.max(1,parseInt(form.rent_due_day)||1),28);
    // Οι γραμμές υπηρεσιών γράφονται στην ΥΠΑΡΧΟΥΣΑ στήλη `streaming` (καμία
    // μετάπτωση σχήματος) και η παλιά `cleaning` καθαρίζεται, ώστε να μη διαβαστεί
    // δεύτερη φορά ως χωριστή γραμμή «Καθαρισμός».
    const svcLines=(form.services||[]).filter(l=>l.name.trim()).map(l=>({ name:l.name.trim(), cost:Math.max(0,l.cost||0), payer:l.payer }));
    const payload={
      property_id:propertyId,user_id:userId,full_name:form.full_name.trim(),
      email:form.email||null,phone:form.phone||null,
      profession:form.profession||null,afm:form.afm||null,
      id_doc_type:form.id_doc_type||null,id_doc_number:form.id_doc_number||null,iban:form.iban||null,notes:form.notes||null,
      lease_type:form.lease_type||null,lease_category:form.lease_category||null,lease_start:form.lease_start||null,lease_end:form.lease_end||null,custom_lease_days:form.custom_lease_days||null,
      monthly_rent:n(form.monthly_rent),payment_frequency:form.payment_frequency||null,rent_due_day:dueDay,rent_iban:form.rent_iban?.trim()||null,
      furnishing:form.furnishing||null,
      deposit_amount:n(form.deposit_amount),deposit_method:form.deposit_method||null,deposit_paid_on:form.deposit_paid_on||null,deposit_returned:form.deposit_returned,deposit_return_date:form.deposit_return_date||null,
      e_payment:form.e_payment,streaming:svcLines,cleaning:null,extra_perks:form.extra_perks||null,
      parking_included:form.parking_included,parking_extra:form.parking_extra,parking_extra_price:n(form.parking_extra_price),
      lease_doc_external_url:form.lease_doc_external_url||null,
      aade_lease_decl_ref:declRef.value,
      // ΤΟ ΧΕΡΙ ΥΠΕΡΙΣΧΥΕΙ ΤΟΥ ΡΑΝΤΕΒΟΥ. Με εκκρεμή αναπροσαρμογή και χειροκίνητη
      // αλλαγή του ενοικίου, οι δύο τιμές συγκρούονται: αφημένο το ραντεβού θα
      // επανέγραφε τη νέα τιμή μια νύχτα, χωρίς να το έχει ζητήσει κανείς. Το
      // πεδίο το γράφει ο ίδιος που υπέγραψε την ειδοποίηση και η οθόνη το λέει
      // δίπλα στο πεδίο πριν πατηθεί η αποθήκευση.
      ...(editRow?.pending_rent!=null && n(form.monthly_rent)!==editRow.monthly_rent
        ? { pending_rent:null, pending_rent_from:null } : {}),
    };
    const{data:savedRow,error:err}=await(editId
      ?tenantStore.updateReturning(supabase,editId,payload)
      :tenantStore.addReturning(supabase,propertyId,userId,payload));
    if(err){
      const msg=err.message||(E?E.toast.unknown:'Άγνωστο σφάλμα');
      // Μετάφραση των συχνών αιτιών σε σαφές ελληνικό μήνυμα.
      //
      // ΤΟ ΜΗΝΥΜΑ ΤΟ ΔΙΑΒΑΖΕΙ ΙΔΙΟΚΤΗΤΗΣ ΑΚΙΝΗΤΟΥ, ΟΧΙ ΠΡΟΓΡΑΜΜΑΤΙΣΤΗΣ.
      //
      // Εδώ έγραφε «Τρέξε το τελευταίο SQL (SETUP_ALL.sql) στο Supabase και
      // δοκίμασε ξανά»: οδηγία που ο χρήστης δεν μπορεί να εκτελέσει, για αρχείο
      // που ήταν ρητά παρωχημένο και πλέον δεν υπάρχει καθόλου. Το ίδιο και η
      // επόμενη γραμμή, που του ζητούσε να «τρέξει τις πολιτικές ασφαλείας».
      //
      // Ενα σφάλμα σχήματος ή δικαιωμάτων είναι ΔΙΚΟ ΜΑΣ λάθος. Το λέμε, λέμε
      // ότι τα στοιχεία του δεν χάθηκαν και κρατάμε την τεχνική λεπτομέρεια για
      // όποιον μπορεί να κάνει κάτι μ’ αυτήν.
      const friendly=E
        ? (/column|schema cache|does not exist/i.test(msg) ? E.toast.ourSchema(msg) : /row-level security|violates row-level/i.test(msg) ? E.toast.ourRls(msg) : E.toast.saveFailed(msg))
        : /column|schema cache|does not exist/i.test(msg)
        ? `Η αποθήκευση απέτυχε από δικό μας σφάλμα, όχι από κάτι που έκανες. Τα στοιχεία που έγραψες μένουν στην οθόνη. Τεχνική λεπτομέρεια: ${msg}`
        : /row-level security|violates row-level/i.test(msg)
        ? `Η αποθήκευση απέτυχε λόγω δικαιωμάτων, από δικό μας σφάλμα. Τα στοιχεία που έγραψες μένουν στην οθόνη. Τεχνική λεπτομέρεια: ${msg}`
        : `Η αποθήκευση απέτυχε: ${msg}`;
      setError(friendly);setSaving(false);return;
    }
    // Ο ενοικιαστής αποθηκεύτηκε. Οι επόμενες δευτερεύουσες ενέργειες (σύνδεση
    // εγγράφων, συγχρονισμός ημερολογίου) δεν πρέπει ΠΟΤΕ να μπλοκάρουν το κλείσιμο
    // της φόρμας ή την ανανέωση — αλλιώς η καρτέλα θα «κολλούσε» με το ρελ. να γυρίζει.
    const savedTenant=(savedRow||null) as unknown as (TenantScheduleInput&{rent_due_day?:number|null})|null;
    if(savedTenant?.id && !editId && formDocs.length){
      await sv('Τα έγγραφα δεν συνδέθηκαν με τον ενοικιαστή','docsNotLinked',
        documents.update(supabase,formDocs.map(d=>d.id),{supplier:'tenant:'+savedTenant.id}));
    }
    if(savedTenant?.id) await syncTenantSchedule(supabase,savedTenant,propertyId,userId,'save',{rentDueDay:dueDay});
    // ── ΚΑΙ ΟΙ ΔΟΣΕΙΣ, ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΠΡΑΓΜΑ ─────────────────────
    // Το `syncTenantSchedule` από πάνω γεμίζει ΗΜΕΡΟΛΟΓΙΟ και εκκρεμότητες.
    // Οι ίδιες οι δόσεις — ο πίνακας από τον οποίο βγαίνει η ταμειακή θέση, η
    // οφειλή, η Πύλη ενοικιαστή και το Ε2 — γεννιούνταν ΜΟΝΟ μέσα στην οθόνη
    // των εισπράξεων. Οποιος καταχωρούσε ενοικιαστή και γύριζε στην Επισκόπηση
    // έβλεπε μηδέν, χωρίς κανένα σφάλμα να το εξηγεί.
    if(savedRow){
      const { error:instErr } = await syncInstalments(supabase, savedRow as unknown as Tenant, propertyId, userId);
      // ΤΟ ΣΦΑΛΜΑ ΛΕΓΕΤΑΙ, ΑΛΛΑ ΔΕΝ ΑΚΥΡΩΝΕΙ ΤΗΝ ΑΠΟΘΗΚΕΥΣΗ: ο ενοικιαστής
      // έχει ήδη γραφτεί και μια σιωπηλή αποτυχία εδώ είναι ακριβώς το
      // μηδενικό που δεν εξηγείται.
      if(instErr) notifyError(E?E.toast.noInstallments(instErr):`Ο ενοικιαστής αποθηκεύτηκε, αλλά οι δόσεις ενοικίου δεν δημιουργήθηκαν. ${instErr}`);
    }
    setSaving(false);setIsForm(false);
    notifyOk(E?(editId?E.toast.saved:E.toast.added):editId?'Αποθηκεύτηκε':'Ο ενοικιαστής προστέθηκε');
    await refresh();
  };

  const markMovedOut=async(t:Tenant)=>{
    if(!(await (E?confirmDialog(E.ask(E.toast.moveOut(t.full_name))):confirmDialog(`Σήμανση αποχώρησης για «${t.full_name}»; Θα μεταφερθεί στους προηγούμενους ενοικιαστές.`)))) return;
    if(!await sv('Η αποχώρηση δεν καταχωρήθηκε','moveOutNotRecorded', tenantStore.markPast(supabase,t.id,todayISO()))) return;
    notify(E?E.toast.movedOut:'Ο ενοικιαστής μεταφέρθηκε στο ιστορικό'); void refresh();
  };
  const delTenant=async(t:Tenant)=>{
    if(!(await (E?confirmDialog(E.ask(E.toast.del(t.full_name),E.toast.delLabel,true)):confirmDialog(`Οριστική διαγραφή «${t.full_name}»; Διαγράφονται μαζί οι πληρωμές του, που μετρούν στα έσοδα, οι φθορές και το μισθωτήριο που ανέβηκε.`,{tone:'negative',confirmLabel:'Οριστική διαγραφή'})))) return;
    // ΟΛΑ Ή ΤΙΠΟΤΑ ΚΑΙ ΤΟ ΑΜΕΤΑΚΛΗΤΟ ΤΕΛΕΥΤΑΙΟ (βλ. `purgeTenant`). Οι γραμμές
    // φεύγουν σε μία συναλλαγή· το PDF του μισθωτηρίου, με όνομα, ΑΦΜ και
    // διεύθυνση, σβήνεται μόνο αφού εκείνη πετύχει.
    const res=await purgeTenant({
      deleteRows:()=>supabase.rpc('delete_tenant',{p_tenant_id:t.id}),
      removeFiles:paths=>supabase.storage.from('lease-documents').remove(paths),
    }, E&&X?{ refused:E.toast.purge, failed:X.failed, notDeleted:E.toast.notDeleted, nothingDeleted:E.toast.nothingDeleted, filesLeft:E.toast.filesLeft }:undefined);
    if(!res.ok){notifyError(res.error);return;}
    if(openId===t.id) setOpenId(null);
    if(res.filesError) notifyError(res.filesError);
    else notify(E?E.toast.deleted:'Ο ενοικιαστής διαγράφηκε');
    void refresh();
  };

  // ── Έγγραφο μισθωτηρίου (PDF) ────────────────────────────────────────────────
  // ΤΟ ΟΝΟΜΑ ΤΟΥ ΑΡΧΕΙΟΥ ΔΕΝ ΕΙΝΑΙ ΚΛΕΙΔΙ. Το ωμό `file.name` έμπαινε στη
  // διαδρομή και ένα «Μισθωτήριο Παπαδόπουλος.pdf» δεν ανέβαινε καθόλου. Το
  // κλειδί βγαίνει πλέον από το uploadPath() (leaseDocKey) και γράφεται στο
  // `lease_doc_url`· το `lease_doc_name` κρατά το όνομα για την οθόνη. Τα παλιά
  // αρχεία, χωρίς `lease_doc_url`, ανοίγουν όπως πριν (leaseDocPath).
  const uploadPDF=async(t:Tenant,file:File)=>{
    setUploading(true);
    const path=leaseDocKey(userId,t.id,file.name);
    const prev=leaseDocPath(userId,t);
    const{error:upErr}=await supabase.storage.from('lease-documents').upload(path,file,{upsert:false,contentType:file.type||undefined});
    if(upErr){setError(fail('Το αρχείο δεν ανέβηκε','fileNotUploaded', upErr));setUploading(false);return;}
    // Το αρχείο ανέβηκε ήδη. Αν δεν καταγραφεί το όνομά του, ο ενοικιαστής δεν
    // έχει συμβόλαιο πουθενά στην οθόνη — και το αρχείο υπάρχει, αόρατο.
    if(!await sv('Το συμβόλαιο ανέβηκε, αλλά δεν συνδέθηκε με τον ενοικιαστή','leaseNotLinked',tenantStore.update(supabase,t.id,{lease_doc_name:file.name,lease_doc_url:path}))){setUploading(false);return;}
    // Το προηγούμενο PDF δεν το δείχνει πια καμία γραμμή. Πριν το έσβηνε το
    // `upsert` (ίδιο όνομα, ίδιο κλειδί)· τώρα κάθε ανέβασμα έχει δικό του.
    if(prev && prev!==path) await supabase.storage.from('lease-documents').remove([prev]);
    setUploading(false);notifyOk(E?E.toast.pdfUploaded:'Το PDF ανέβηκε');void refresh();
  };
  const openLeaseDoc=async(t:Tenant)=>{
    const path=leaseDocPath(userId,t);
    if(!path) return;
    const{data,error:e}=await supabase.storage.from('lease-documents').createSignedUrl(path,60*60);
    if(e||!data?.signedUrl){setError(E?E.toast.pdfNotOpened:'Το PDF δεν άνοιξε. Δοκίμασε ξανά.');return;}
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  };

  // ── Εξαγωγή μητρώου μισθωτών ────────────────────────────────────────────────
  // Το ενοίκιο και η εγγύηση περνούσαν από τη `csvEur()` και έφταναν ως κείμενο:
  // το μητρώο δεν αθροιζόταν σε καμία στήλη.
  const exportRoster=()=>{
    downloadTableXlsx(`Μητρώο ενοικιαστών ${todayISO()}`, {
      title: 'Μητρώο ενοικιαστών',
      headers: ['Ονοματεπώνυμο','Κατάσταση','ΑΦΜ','Τηλέφωνο','Ηλεκτρονικό ταχυδρομείο','Είδος μίσθωσης','Έναρξη','Λήξη','Αποχώρηση','Ημέρα πληρωμής','Μηνιαίο ενοίκιο (€)','Εγγύηση (€)','Τρόπος εγγύησης','Ημερομηνία καταβολής εγγύησης','Επεστράφη'],
      rows: [...tenants].map(t=>[
        t.full_name, isPastTenant(t)?'Προηγούμενος':'Τρέχων', t.afm||'', t.phone||'', t.email||'',
        t.lease_category?LEASE_CATEGORY_LABELS[t.lease_category]:'', csvDate(t.lease_start), csvDate(t.lease_end), csvDate(t.move_out_date),
        t.rent_due_day||'', t.monthly_rent ?? '', t.deposit_amount ?? '', t.deposit_method||'', csvDate(t.deposit_paid_on), t.deposit_returned?'ΝΑΙ':'',
      ]),
    });
  };

  // Σκελετός αντί για spinner: η οθόνη έχει γνωστό σχήμα (σειρά KPIs + πλέγμα καρτών
  // ενοικιαστών), οπότε ο χώρος δεσμεύεται από την αρχή αντί να «πέφτει» μέσα ξαφνικά.
  if(loading) return (
    <>
      <SkeletonKPIs n={4} />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap:14 }}>
        {[0,1,2].map(i=><Skeleton key={i} h={210} r={14}/>)}
      </div>
    </>
  );

  const dc=openId?tenants.find(t=>t.id===openId)||null:null;
  const dcPayments=dc?payments.filter(p=>p.tenant_id===dc.id):[];
  const dcDamages=dc?damages.filter(d=>d.tenant_id===dc.id):[];
  const dcMaint=dc?maint.filter(m=>m.tenant_id===dc.id):[];
  const dcOverdue=dc?(overdueByTenant.get(dc.id)||{count:0,amount:0}):{count:0,amount:0};

  // Ιστορικό ενοικιαστών: πορεία ενοικίου στον χρόνο (χρονολογικά).
  const rentHistory=[...tenants].filter(t=>t.monthly_rent).sort((a,b)=>(a.lease_start||'').localeCompare(b.lease_start||''));

  const statusBadge=(t:Tenant)=>{
    if(overdueByTenant.has(t.id)) return <Badge tone="negative">{E?E.badge.overdue:'Ληξιπρόθεσμο'}</Badge>;
    if(isPastTenant(t)) return <Badge tone="neutral">{E?E.badge.past:'Προηγούμενος'}</Badge>;
    const d=daysLeft(t.lease_end);
    if(d!=null&&d<0) return <Badge tone="warning">{E?E.badge.ended:'Έληξε'}</Badge>;
    return <Badge tone="positive">{E?E.badge.current:'Τρέχων'}</Badge>;
  };

  const DTABS:{id:DossierTab;label:string;badge?:number}[]=dc?[
    {id:'overview',label:'Επισκόπηση'},
    {id:'lease',label:'Μίσθωση και εγγύηση',badge:(dcOverdue.count+(declaredByTenant.get(dc.id)||0))||undefined},
    {id:'condition',label:'Φθορές και βλάβες',badge:(dcDamages.filter(d=>!d.repaired).length+dcMaint.filter(m=>m.status!=='done').length)||undefined},
    {id:'legal',label:'Νομικά και φόρος'},
    {id:'comm',label:'Επικοινωνία'},
    {id:'docs',label:'Έγγραφα'},
  ].map(tb=>E?{ ...tb, label:E.dossier.tabs[tb.id] }:tb) as {id:DossierTab;label:string;badge?:number}[]:[];

  // ── ΠΟΙΑ ΠΕΔΙΑ ΒΛΕΠΕΙ Η ΦΟΡΜΑ, ΤΩΡΑ ────────────────────────────────────────
  // Μία κλήση στο μητρώο, τρία επίπεδα: `core` φαίνεται, `more` πίσω από κουμπί,
  // `hidden` δεν υπάρχει. Η μόνη είσοδος που αλλάζει ζωντανά είναι η επίπλωση.
  const formCtx=tenantFieldCtx(isFurnished(form.furnishing), propertyCount);
  const formPlan=formFields(TENANT_FIELDS, formCtx);
  const coreIds=new Set(formPlan.core.map(d=>d.id));
  const moreIds=new Set(formPlan.more.map(d=>d.id));
  const show=(id:string)=>coreIds.has(id);
  const more=(id:string)=>moreIds.has(id);
  const moreFields=formPlan.more;
  const formMissing=missingCritical(TENANT_FIELDS, formCtx, filledTenantIds({
    full_name:form.full_name.trim()||null, afm:form.afm||null, lease_category:form.lease_category||null,
    lease_start:form.lease_start||null, monthly_rent:form.monthly_rent?parseFloat(form.monthly_rent):null,
    rent_iban:form.rent_iban||null,
  }));

  return (
    <div style={{ fontFamily:T.font.sans, color:'var(--text-primary)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {error&&<div style={{ background:'var(--negative-dim)', border:'1px solid var(--negative-border)', borderLeft:'3px solid var(--negative)', borderRadius:T.radius.inner, padding:'11px 18px', marginBottom:14, color:'var(--negative)', fontSize: 'var(--fs-base)', fontFamily:T.font.sans, fontWeight:500, display:'flex', justifyContent:'space-between', alignItems:'center' }}><span>{error}</span><IconBtn label={E?E.closeError:'Κλείσιμο μηνύματος σφάλματος'} tone="danger" onClick={()=>setError(null)}><span style={{ fontSize:18, lineHeight:1 }}>×</span></IconBtn></div>}

      {/* Ο ΤΙΤΛΟΣ ΕΙΝΑΙ ΤΟ ΟΝΟΜΑ ΤΟΥ ΜΕΝΟΥ. Ηταν «Ενοικιαστής» με το χέρι, πάνω
          από λίστα με φίλτρα «Όλοι», «Τρέχοντες», «Προηγούμενοι». */}
      <PageTitle title={S?S.nav.tenant:navLabel('tenant')}
        right={tenants.length>0?<div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {/* ΜΙΑ ΚΥΡΙΑ ΕΝΕΡΓΕΙΑ ΚΑΙ ΕΝΑ ΜΕΝΟΥ, ΟΠΩΣ ΣΤΙΣ ΕΠΑΦΕΣ. Τέσσερα ισοβαρή
              κουμπιά έβγαιναν πλέγμα 2×2 στο κινητό, με το «Σύνταξη μισθωτηρίου»
              σε δύο σειρές δίπλα σε κουμπί μίας. Η ίδια ενέργεια λεγόταν κάποτε
              «Μισθωτήριο» εδώ και «Σύνταξη μισθωτηρίου» στην κενή κατάσταση: το
              όνομα μένει ένα. */}
          <ActionMenu label={E?E.more:'Περισσότερα'} items={[
            { key:'lease', label:'Σύνταξη μισθωτηρίου', description:'Ιδιωτικό συμφωνητικό, με υπογραφή και των δύο μερών.', onClick:()=>setLeaseOpen(true) },
            { key:'decl', label:'Δήλωση μίσθωσης', description:'Τα πεδία της δήλωσης στην ΑΑΔΕ, ελεγμένα και έτοιμα για αντιγραφή.', onClick:()=>setDeclOpen(true) },
            { key:'xlsx', label:'Εξαγωγή Excel', description:'Όλοι οι ενοικιαστές σε υπολογιστικό φύλλο.', onClick:exportRoster },
          ].map(it=>E?{ ...it, label:E.menu[it.key][0], description:E.menu[it.key][1] }:it)}/>
          <Btn variant="primary" onClick={openAdd}>{E?E.newTenant:'Νέος ενοικιαστής'}</Btn>
        </div>:undefined}/>

      {segOn&&<TenantSummary {...summary} en={E?.summary}/>}

      {/* ═══ ΑΝΑΖΗΤΗΣΗ ΚΑΙ ΦΙΛΤΡΟ, ΟΠΩΣ ΣΤΟ ΑΡΧΕΙΟ (16.11.2026) ═══════════════
          Ηταν πεδίο χωρίς εικονίδιο με γωνίες 10 και, δίπλα, τρία ανεξάρτητα
          πλακίδια με δικό τους περίγραμμα το καθένα. Στα 390 τα πλακίδια
          έπεφταν σε δεύτερη σειρά με πλάτη 54, 86 και 108 και ογδόντα κενά
          δεξιά: τρία κουμπιά που έμοιαζαν τρία άσχετα πράγματα, ενώ είναι ΜΙΑ
          ερώτηση με τρεις απαντήσεις. Τώρα: ίδιο πεδίο με το Αρχείο (εικονίδιο,
          σχήμα χαπιού) και τμηματικός επιλογέας σε ράγα, που στο τηλέφωνο
          πιάνει όλο το πλάτος με τρία ίσα κομμάτια. Η υπόδειξη λέει ΤΙ
          ψάχνεται· το «Αναζήτηση» ζει στην ετικέτα του αναγνώστη οθόνης. */}
      {segOn&&<div className="po-tools">
        {searchOn&&<div className="po-search">
          <Search size={15} aria-hidden="true" className="po-search-icon"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} type="search"
            className="po-search-input" aria-label={E?E.searchLabel:'Αναζήτηση ενοικιαστή'} placeholder={E?E.searchHint:'Όνομα, ΑΦΜ ή τηλέφωνο'}/>
        </div>}
        {/* «Όλοι», «Τρέχοντες», «Προηγούμενοι»: πληθυντικοί, γιατί φιλτράρουν
            ΛΙΣΤΑ. Το «Τρέχων» μένει στη σήμανση ΕΝΟΣ ενοικιαστή. */}
        <div role="group" aria-label={E?E.segLabel:'Ποιοι ενοικιαστές φαίνονται'} className="po-rail">
          {([['all','Όλοι'],['current','Τρέχοντες'],['past','Προηγούμενοι']] as [typeof segment,string][]).map(([v,l])=>(
            <ChipToggle key={v} shape="seg" on={segment===v} onClick={()=>setSegment(v)}>{E?E.segs[v]:l}</ChipToggle>
          ))}
        </div>
      </div>}

      {tenants.length===0?(
        <EmptyState icon={<Users size={20}/>} title={E?E.empty[0]:'Κανένας ενοικιαστής ακόμη'} hint={E?E.empty[1]:'Πρόσθεσε τον ενοικιαστή του ακινήτου για πλήρη παρακολούθηση μίσθωσης, ενοικίων, εγγύησης, φθορών και ανανέωσης.'} action={<div className="act-center" style={{ display:'flex', gap:8, flexWrap:'wrap' as const, justifyContent:'center' }}><Btn variant="primary" onClick={openAdd}>{E?E.newTenant:'Νέος ενοικιαστής'}</Btn><Btn variant="secondary" onClick={()=>setLeaseOpen(true)}>{E?E.menu.lease[0]:'Σύνταξη μισθωτηρίου'}</Btn></div>}/>
      ):(
        <>
          {filtered.length===0?(
            <EmptyState icon={<SearchX size={20}/>} title={E?E.noMatch[0]:'Δεν βρέθηκαν ενοικιαστές'} hint={E?E.noMatch[1]:'Άλλαξε φίλτρο ή αναζήτηση.'}/>
          ):(
            // `auto-fill`, ΟΧΙ `auto-fit`: με έναν ενοικιαστή η κάρτα τεντωνόταν σε
            // όλα τα 1.392 της σειράς και τα τρία ποσά της λωρίδας απείχαν 450
            // το ένα από το άλλο. Τώρα κρατά πλάτος κάρτας και η σειρά γεμίζει
            // όσο προστίθενται ενοικιαστές. `data-list`: εγγραφές του χρήστη.
            <div data-list style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap:14 }}>
              {filtered.map(t=>{
                const od=overdueByTenant.get(t.id);
                const d=daysLeft(t.lease_end);
                return (
                  <RecordCard key={t.id} onOpen={()=>{setOpenId(t.id);setDossierTab('overview');}}
                    openLabel={E?E.openCard(t.full_name):`Άνοιγμα καρτέλας: ${t.full_name}`}
                    lead={avatar(t.full_name, 42)}
                    title={t.full_name}
                    sub={<>
                      <span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily:T.font.sans }}>{E?(t.lease_start||t.lease_end?E.period(fD(t.lease_start),fD(t.lease_end)):E.noPeriod):t.lease_start||t.lease_end?`${fmtD(t.lease_start)} έως ${fmtD(t.lease_end)}`:'χωρίς περίοδο μίσθωσης'}</span>
                      {t.afm&&<span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily:T.font.num, fontVariantNumeric:'tabular-nums' }}>{E?E.afm(t.afm):<>ΑΦΜ {t.afm}</>}</span>}
                    </>}
                    badges={<>
                      {/* ΤΟ ΚΟΚΚΙΝΟ ΛΕΓΕΤΑΙ ΜΙΑ ΦΟΡΑ (Μ8). Ηταν σήμα «Ληξιπρόθεσμο»,
                          κόκκινο περίγραμμα και κόκκινο ποσό στην ίδια κάρτα. Μένει
                          το ποσό, κάτω από τη λέξη «Ληξιπρόθεσμα»: λέει και πόσα. */}
                      {!od&&statusBadge(t)}
                      {(declaredByTenant.get(t.id)||0)>0&&<Badge tone="accent">{E?E.badge.declared:'Δηλωμένη πληρωμή'}</Badge>}
                    </>}
                    actions={
                      // ΤΟ ΦΡΕΝΟ ΤΗΣ ΑΝΑΔΥΣΗΣ ΜΕΝΕΙ ΣΤΟ ΔΟΧΕΙΟ. Ολη η κάρτα είναι κουμπί
                      // ανοίγματος· χωρίς αυτό, η διαγραφή θα άνοιγε ΚΑΙ το ντοσιέ. Το
                      // `IconBtn` δέχεται ενέργεια χωρίς συμβάν, οπότε το φρένο ζει έξω του.
                      <div onClick={e=>e.stopPropagation()} style={{ display:'flex' }}>
                        {/* ΣΤΟ «⋯», ΟΧΙ ΚΟΚΚΙΝΟΣ ΚΑΔΟΣ ΣΤΗ ΓΩΝΙΑ (16.11.2026). Ο κάδος ήταν
                            το μόνο χρώμα της κάρτας εκτός από την οφειλή: το πιο
                            ορατό πράγμα σε κάθε ενοικιαστή ήταν η μη αναστρέψιμη
                            ενέργεια. Οπως στους Πελάτες και στην Απογραφή, οι
                            σπάνιες ενέργειες ζουν σε ήσυχο μενού· η διαγραφή μένει
                            κόκκινη ΜΕΣΑ του με κάδο και με το όνομα στο λεκτικό
                            και ζητά επιβεβαίωση όπως πριν. */}
                        <ActionMenu iconOnly label={E?E.actionsFor(t.full_name):`Ενέργειες για ${t.full_name}`} items={[
                          { key:'del', label:E?E.deleteTenant:`Διαγραφή ενοικιαστή`, description:t.full_name, danger:true, icon:<Trash2 size={15} aria-hidden="true"/>, onClick:()=>delTenant(t) },
                        ]}/>
                      </div>
                    }>
                    {/* ΜΙΑ ΛΕΞΗ ΑΝΑ ΚΕΛΙ. «Μηνιαίο ενοίκιο» και «Ληξιπρόθεσμη οφειλή»
                        έσπαγαν σε δύο σειρές στα 390 ΚΑΙ στην κάρτα των 455 του
                        υπολογιστή και τα ποσά της ίδιας λωρίδας έπεφταν σε δύο
                        ύψη. Το «μηνιαίο» το λέει ήδη ο δείκτης στην κορυφή· το
                        «Ληξιπρόθεσμα» είναι η λέξη της καρτέλας Πληρωμών. */}
                    <StatStrip items={[
                      { label:E?E.strip.rent:'Ενοίκιο', value:fmt(t.monthly_rent), strong:true },
                      { label:E?E.strip.deposit:'Εγγύηση', value:fmt(t.deposit_amount) },
                      { label:E?E.strip.overdue:'Ληξιπρόθεσμα', value:fmt(od?od.amount:0), tone:od?'negative':undefined },
                    ]} />
                    {/* ΤΟ ΡΑΝΤΕΒΟΥ ΤΗΣ ΑΝΑΠΡΟΣΑΡΜΟΓΗΣ ΛΕΓΕΤΑΙ. Το «Μηνιαίο ενοίκιο» από
                        πάνω δείχνει το ποσό που ΙΣΧΥΕΙ σήμερα· χωρίς αυτή τη γραμμή, η
                        υπογεγραμμένη ειδοποίηση θα ζούσε μόνο σε ένα PDF και η αλλαγή
                        θα εμφανιζόταν μια νύχτα χωρίς εξήγηση. */}
                    {!isPastTenant(t)&&t.pending_rent!=null&&t.pending_rent_from&&<div style={{ fontSize: 'var(--fs-xs)', color:'var(--text-secondary)', fontFamily:T.font.sans }}>{E?E.pendingRent(fmt(t.pending_rent),fD(t.pending_rent_from)):<>Αναπροσαρμογή σε {fmt(t.pending_rent)} από {fmtD(t.pending_rent_from)}</>}</div>}
                    {!isPastTenant(t)&&d!=null&&d>=0&&d<=60&&<div style={{ fontSize: 'var(--fs-xs)', color:'var(--warning)', fontFamily:T.font.sans }}>{E?E.endsIn(d):<>Λήξη μίσθωσης σε {fn(d)} ημέρες</>}</div>}
                  </RecordCard>
                );
              })}
            </div>
          )}

          {/* Ιστορικό ενοικιαστών: πορεία ενοικίου ανά μίσθωση */}
          {(segment==='past'||segment==='all')&&rentHistory.length>=2&&(
            <div style={{ marginTop:24 }}>
              <SecHdr label={E?E.history[0]:'Ιστορικό ενοικιαστών'} sub={E?E.history[1]:'Πορεία μηνιαίου ενοικίου ανά μίσθωση'}/>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {rentHistory.map((t,i)=>{
                  const prev=i>0?rentHistory[i-1].monthly_rent||0:0;
                  const cur=t.monthly_rent||0;
                  const diff=prev>0?cur-prev:0;
                  return (
                    <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:T.radius.inner, padding:'10px 14px', flexWrap:'wrap' as const }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize: 'var(--fs-base)', fontWeight:600, color:'var(--text-primary)', fontFamily:T.font.sans }}>{t.full_name}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily:T.font.sans }}>{E?E.period(fD(t.lease_start),fD(t.move_out_date||t.lease_end)):<>{fmtD(t.lease_start)} έως {fmtD(t.move_out_date||t.lease_end)}</>}</div>
                      </div>
                      <div style={{ textAlign:'right' as const }}>
                        <span style={{ fontSize:14, fontWeight:700, fontFamily:T.font.num, fontVariantNumeric:'tabular-nums', color:'var(--text-primary)' }}>{fmt(cur)}</span>
                        {diff!==0&&<span style={{ marginLeft:8, fontSize: 'var(--fs-xs)', fontFamily:T.font.num, fontVariantNumeric:'tabular-nums', color:'var(--text-secondary)' }}>{diff>0?'+':''}{fmt(diff)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Ντοσιέ — κοινό SideSheet ───────────────────────────────────────────
          Ήταν χειρόγραφο πλαϊνό φύλλο: δικό του scrim, δικό του πλάτος 980, δικό
          του «‹ Πίσω» πάνω αριστερά (τα άλλα δύο ντοσιέ της εφαρμογής είχαν «×»
          πάνω δεξιά) και ούτε Escape ούτε κλείδωμα κύλισης του φόντου. Το
          κουμπί επιστροφής ΔΕΝ χάθηκε — το «×» του SideSheet κάνει ακριβώς την
          ίδια δουλειά (setOpenId(null)) στη θέση που το έχουν και τα υπόλοιπα.

          ΟΙ ΚΑΡΤΕΛΕΣ ΜΕΝΟΥΝ ΣΤΗΝ ΚΕΦΑΛΙΔΑ. Στο χειρόγραφο ήταν τρίτη σταθερή
          λωρίδα με flexShrink:0· το SideSheet έχει δύο σταθερές ζώνες (κεφαλίδα,
          υποσέλιδο) και μία που κυλά. Μέσα στο `children` οι έξι καρτέλες θα
          έφευγαν προς τα πάνω με την κύλιση — γι' αυτό μπαίνουν στο `header`.

          zIndex: ήταν 900 ενώ η φόρμα 950. Τώρα και τα δύο είναι 1000 από τα
          primitives, αλλά η φόρμα αποδίδεται ΜΕΤΑ σε αυτό το ίδιο επίπεδο, άρα
          εξακολουθεί να ζωγραφίζεται από πάνω.

          ΓΙΑΤΙ ΤΟ onClose ΕΙΝΑΙ ΦΡΟΥΡΗΜΕΝΟ: βλέπε `closeDossier` παραπάνω. Η
          φόρμα ΔΕΝ είναι η μόνη επικάλυψη που ανοίγει πάνω στο ντοσιέ — τα τρία
          παράθυρα της PaymentsView («Σήμανση ως πληρωμένο», «Αίτημα πληρωμής»,
          «Σάρωση απόδειξης») ζουν κι αυτά μέσα του και ένας φρουρός μόνο για
          το `isForm` θα άφηνε ένα Escape πάνω τους να κλείσει ολόκληρο το
          ντοσιέ. */}
      {dc&&(
        <SideSheet open onClose={closeDossier} size="xl"
          ariaLabel={E?E.dossier.aria(dc.full_name):`Ντοσιέ ενοικιαστή: ${dc.full_name}`}
          header={<>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap' as const }}>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' as const }}>
                  <span style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>{dc.full_name}</span>
                  {statusBadge(dc)}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop: 4, flexWrap:'wrap' as const }}>
                  {dc.profession&&<span style={{ fontSize:12, color:'var(--text-tertiary)' }}>{dc.profession}</span>}
                  {dc.email&&<span style={{ fontSize:12, color:'var(--text-secondary)' }}>{dc.email}</span>}
                  {dc.phone&&<span style={{ fontSize:12, color:'var(--text-secondary)' }}>{dc.phone}</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' as const, justifyContent:'flex-end' }}>
                <Btn variant="secondary" onClick={()=>openEditForm(dc)}>{E?E.dossier.edit:'Επεξεργασία'}</Btn>
                {onStartHandover&&<Btn variant="secondary" onClick={()=>onStartHandover(dc.full_name||'', dc.phone||'', isPastTenant(dc)?'check_out':'check_in')}>{E?E.dossier.handover:'Πρωτόκολλο παράδοσης'}</Btn>}
                {!isPastTenant(dc)&&<Btn variant="secondary" onClick={()=>markMovedOut(dc)}>{E?E.dossier.movedOut:'Αποχώρησε'}</Btn>}
              </div>
            </div>

            {/* Καρτέλες ενότητας */}
            <div style={{ display:'flex', marginTop:12, marginBottom:-18, overflowX:'auto' as const, scrollbarWidth:'none' as const }}>
              {DTABS.map(tb=>(
                <button key={tb.id} onClick={()=>setDossierTab(tb.id)} style={{ ...s.tabBtn(dossierTab===tb.id), display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  {tb.label}
                  {(tb.badge??0)>0&&<span style={{ minWidth:18, height:18, borderRadius: T.radius.chip, background:'var(--negative)', color:'var(--text-inverse)', fontSize: 'var(--fs-xs)', fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{tb.badge}</span>}
                </button>
              ))}
            </div>
          </>}>
          {dossierTab==='overview'&&(
            <>
              {isPastTenant(dc)&&<InfoBanner tone="neutral">{E?E.dossier.pastNote(dc.move_out_date?fD(dc.move_out_date):null):<>Προηγούμενος ενοικιαστής{dc.move_out_date?`: αποχώρηση ${fmtD(dc.move_out_date)}`:''}. Ο φάκελος διατηρείται για το ιστορικό του ακινήτου.</>}</InfoBanner>}
              <DashboardView tenant={dc} payments={dcPayments} propertyCount={propertyCount}/>
            </>
          )}
          {dossierTab==='lease'&&(
            <div style={{ display:'flex', flexDirection:'column' }}>
              <div>
                {E?(()=>{ const w=E.dossier.dueDay(Math.min(Math.max(1,dc.rent_due_day||1),28)); return <InfoBanner tone="info">{w[0]}<strong>{w[1]}</strong>{w[2]}</InfoBanner>; })()
                :<InfoBanner tone="info">Περιμένεις το ενοίκιο κάθε μήνα την <strong>{fn(Math.min(Math.max(1,dc.rent_due_day||1),28))}η</strong> ημέρα. Οι μηνιαίες δόσεις δημιουργούνται αυτόματα από την έναρξη της μίσθωσης.</InfoBanner>}
                <PaymentsView tenant={dc} propertyId={propertyId} userId={userId} payments={dcPayments} onRefresh={refresh} plan={plan}/>
              </div>
              <div style={{ borderTop:'1px solid var(--border-subtle)', marginTop:28, paddingTop:28 }}><DepositView tenant={dc} payments={dcPayments} damages={dcDamages} onReturned={refresh}/></div>
              <div style={{ borderTop:'1px solid var(--border-subtle)', marginTop:28, paddingTop:28 }}><RenewalView tenant={dc} userId={userId} comps={comps} sqm={propSqm}/></div>
            </div>
          )}
          {dossierTab==='condition'&&(
            <div style={{ display:'flex', flexDirection:'column' }}>
              <DamagesView tenant={dc} propertyId={propertyId} userId={userId} damages={dcDamages} onRefresh={refresh}/>
              <div style={{ borderTop:'1px solid var(--border-subtle)', marginTop:28, paddingTop:28 }}><MaintenanceView tenant={dc} propertyId={propertyId} userId={userId} requests={dcMaint} others={dc?maint.filter(m=>m.tenant_id!==dc.id):maint} onRefresh={refresh}/></div>
            </div>
          )}
          {dossierTab==='legal'&&<LegalTaxView tenant={dc} propertyCount={propertyCount} rentTax={rentTax}/>}
          {dossierTab==='comm'&&<CommView tenant={dc} propertyId={propertyId} userId={userId}/>}
          {dossierTab==='docs'&&(
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap:16 }}>
              <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:T.radius.card, padding:24 }}>
                <SectionTitle>{E?E.dossier.leasePdf:'Μισθωτήριο (PDF)'}</SectionTitle>
                {dc.lease_doc_name?(
                  <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-accent)', borderRadius:T.radius.inner, padding:20 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, gap:10 }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize: 'var(--fs-base)', fontWeight:600, color:'var(--text-primary)', fontFamily:T.font.sans, overflow:'hidden', textOverflow:'ellipsis' }}>{dc.lease_doc_name}</div>
                        <div style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', fontFamily:T.font.sans }}>{E?E.dossier.uploaded:'Ανεβασμένο συμβόλαιο'}</div>
                      </div>
                      <button style={s.btnDng} onClick={async()=>{const docPath=leaseDocPath(userId,dc);if(!docPath)return;await supabase.storage.from('lease-documents').remove([docPath]);if(!await sv('Το συμβόλαιο δεν αποσυνδέθηκε','leaseNotUnlinked',tenantStore.update(supabase,dc.id,{lease_doc_url:null,lease_doc_name:null})))return;notify(E?E.toast.pdfDeleted:'PDF διαγράφηκε');void refresh();}}>{E?E.dossier.remove:'Διαγραφή'}</button>
                    </div>
                    {/* Το κάτω περιθώριο είναι θέση μέσα στη στήλη, όχι όψη του κουμπιού. */}
                    <div style={{ marginBottom:10 }}><Btn variant="primary" onClick={()=>openLeaseDoc(dc)}>{E?E.dossier.openPdf:'Άνοιγμα PDF'}</Btn></div>
                    <div style={{ marginTop:10 }}>
                      <label style={{ ...s.btnSm, cursor:'pointer', display:'inline-block' }}>
                        {E?(uploading?E.dossier.uploading:E.dossier.replacePdf):uploading?'Ανέβασμα…':'Αντικατάσταση PDF'}
                        <input type="file" accept=".pdf" style={{ display:'none' }} onChange={e=>{const f=e.target.files?.[0];if(f)uploadPDF(dc,f);}} disabled={uploading}/>
                      </label>
                    </div>
                  </div>
                ):(
                  <div style={{ border:'2px dashed var(--border-default)', borderRadius:T.radius.inner, padding:'40px 28px', textAlign:'center' as const }}>
                    <div style={{ fontSize: 'var(--fs-base)', color:'var(--text-secondary)', fontFamily:T.font.sans, marginBottom:T.sp.lg }}>{E?E.dossier.uploadHint:'Ανέβασε το μισθωτήριο σε μορφή PDF'}</div>
                    <label style={{ ...s.btnGold, cursor:'pointer', display:'inline-block', padding:'11px 28px' }}>
                      {E?(uploading?E.dossier.uploading:E.dossier.pickPdf):uploading?'Ανέβασμα…':'Επιλογή PDF'}
                      <input type="file" accept=".pdf" style={{ display:'none' }} onChange={e=>{const f=e.target.files?.[0];if(f)uploadPDF(dc,f);}} disabled={uploading}/>
                    </label>
                  </div>
                )}
              </div>
              <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:T.radius.card, padding:24 }}>
                <SectionTitle>{E?E.dossier.external:'Εξωτερικός σύνδεσμος'}</SectionTitle>
                {dc.lease_doc_external_url?(
                  <div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:T.font.sans, marginBottom:14, wordBreak:'break-all' as const, lineHeight:1.6 }}>{dc.lease_doc_external_url}</div>
                    <a href={dc.lease_doc_external_url} target="_blank" rel="noopener noreferrer" style={{ ...s.btnGold, display:'inline-block', textDecoration:'none' }}>{E?E.dossier.openLink:'Άνοιγμα συνδέσμου'}</a>
                  </div>
                ):(
                  <div style={{ fontSize: 'var(--fs-base)', color:'var(--text-tertiary)', fontFamily:T.font.sans, lineHeight:1.7 }}>{E?E.dossier.noExternal:'Δεν έχει οριστεί εξωτερικός σύνδεσμος. Πρόσθεσέ τον από την «Επεξεργασία», στα «Έγγραφα» (Google Drive, Dropbox κ.ά.).'}</div>
                )}
              </div>
            </div>
          )}
        </SideSheet>
      )}

      {/* ── Φόρμα — κοινό Modal ───────────────────────────────────────────────
          Ήταν χειρόγραφο: το ίδιο το φόντο κυλούσε (alignItems:'flex-start' +
          overflowY στο overlay), οπότε ο τίτλος «Νέος ενοικιαστής» και το κουμπί
          αποθήκευσης έφευγαν από την οθόνη μόλις άνοιγες τα «Περισσότερα». Το
          Modal κυλά ΜΟΝΟ το σώμα (maxHeight 92dvh): κεφαλίδα και ενέργειες
          μένουν πάντα στη θέση τους.
          Το «Ακύρωση» ΔΕΝ χάθηκε — μετακόμισε από την κεφαλίδα στο υποσέλιδο,
          δίπλα στην αποθήκευση, όπου στέκουν οι δύο ενέργειες μαζί· η κεφαλίδα
          έχει πλέον το «×» του Modal, που καλεί το ίδιο closeForm (άρα και την
          ίδια προστασία από ακούσια απώλεια δεδομένων). */}
      {isForm&&(
        <Modal open onClose={closeForm} size="lg"
          title={E?(editId?E.form.edit:E.form.add):editId?'Επεξεργασία ενοικιαστή':'Νέος ενοικιαστής'}
          subtitle={E?E.form.sub:'Ζητάμε μόνο ό,τι έχει νόημα για αυτή τη μίσθωση. Κάθε πεδίο λέει γιατί.'}
          footer={<>
            {/* Και τα δύο κουμπιά κλειδώνουν όσο γράφει: το «Ακύρωση» δεν
                επιτρέπεται να εξαφανίσει τη φόρμα στη μέση της αποθήκευσης
                (ίδιος φρουρός με το closeForm, ώστε να μη μοιάζει ενεργό). */}
            <Btn variant="secondary" onClick={closeForm} disabled={saving}>{E?E.form.cancel:'Ακύρωση'}</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{E?(saving?E.form.saving:editId?E.form.saveChanges:E.form.addTenant):saving?'Αποθήκευση…':editId?'Αποθήκευση αλλαγών':'Προσθήκη ενοικιαστή'}</Btn>
          </>}>
          {/* ΕΝΑ παιδί, όχι τριάντα. Το σώμα του Modal είναι flex column με
              gap 20· η φόρμα έχει ~30 αδέλφια πρώτου επιπέδου με δικά τους,
              ρυθμισμένα περιθώρια (6/12/16 και τα `s.divider`), οπότε το gap θα
              πρόσθετε ~600px κενού και θα διέλυε τον ρυθμό των ενοτήτων. */}
          <div>
            {/* ── ΤΙ ΛΕΙΠΕΙ ΓΙΑ ΤΗ ΔΗΛΩΣΗ ─────────────────────────────────── */}
            <MissingCriticalBar missing={formMissing} en={E?{ head:E.missing, fields:E.fields }:undefined}/>

            {/* ── ΠΟΙΟΣ ΕΙΝΑΙ ────────────────────────────────────────────── */}
            <SectionTitle>{E?E.form.who:'Ποιος είναι ο ενοικιαστής'}</SectionTitle>
            <div className="form-row form-row-3">
              {show('tenant.full_name')&&<div id={tenantFieldId('full_name')}><TextInput label={`${lab('tenant.full_name')} *`} labelInfo={why('tenant.full_name')} value={form.full_name} onChange={v=>sf('full_name',v)}/>{fieldNote('full_name')}</div>}
              {show('tenant.afm')&&<TextInput label={lab('tenant.afm')} labelInfo={why('tenant.afm')} value={form.afm} onChange={v=>sf('afm',v)}/>}
              {show('tenant.phone')&&<TextInput label={lab('tenant.phone')} labelInfo={why('tenant.phone')} value={form.phone} onChange={v=>sf('phone',v)}/>}
            </div>

            <div style={s.divider}/>
            {/* ── Η ΜΙΣΘΩΣΗ ────────────────────────────────────────────────── */}
            {/* ══ Ο ΑΣΤΕΡΙΣΚΟΣ ΗΤΑΝ ΚΟΚΚΙΝΟΣ ΚΑΙ ΔΕΝ ΕΔΕΙΧΝΕ ΠΟΥΘΕΝΑ ═══════════
                Καθόταν πάνω στον τίτλο μιας ενότητας με πέντε χειριστήρια, οπότε
                δεν έλεγε ΠΟΙΟ είναι υποχρεωτικό. Και η μπάρα στην κορυφή τα
                ονομάζει ήδη ένα προς ένα, με τη διατύπωση του μητρώου: το ίδιο
                μήνυμα δύο φορές, η μία χωρίς περιεχόμενο. Το χρώμα ήταν και
                παράβαση του κανόνα: κόκκινο σημαίνει σφάλμα, όχι «συμπλήρωσέ το». */}
            <SectionTitle>{E?E.form.lease:'Η μίσθωση'}</SectionTitle>
            {/* ══ ΕΙΔΟΣ ΚΑΙ ΔΙΑΡΚΕΙΑ ΣΤΗΝ ΙΔΙΑ ΕΥΘΕΙΑ ══════════════════════════
                Ηταν δύο σειρές κουμπιών, η μία κάτω από την άλλη, με εννιά κουμπιά
                συνολικά και δύο ολόκληρα πλάτη οθόνης. Οι επτά διάρκειες ειδικά
                δεν είναι επιλογή που θέλει να φαίνεται ολόκληρη: διαλέγεις μία και
                δεν την ξανακοιτάς. Ως πτυσσόμενη λίστα πιάνει ένα πεδίο και
                αφήνει τη διπλανή στήλη στο είδος, με λεπτή γραμμή ανάμεσα.

                Η ΛΕΠΤΗ ΓΡΑΜΜΗ ΕΙΝΑΙ Η `cl-split`, που υπάρχει ήδη: περίγραμμα
                αριστερά σε κάθε κελί εκτός του πρώτου· φεύγει κάτω από τα 600
                όπου τα κελιά στοιβάζονται. */}
            {/* ΤΟ ΔΕΥΤΕΡΟ ΣΤΥΛ ΣΒΗΝΕΙ ΤΟ ΠΡΩΤΟ ΚΑΙ ΤΟ ΕΚΑΝΕ ΕΔΩ. Ο βοηθός
                διάταξης επιστρέφει className ΚΑΙ στυλ με τις μεταβλητές των
                στηλών. Χωρίς άπλωμα, το δικό μας στυλ τις αντικαθιστούσε όλες και
                η σειρά έβγαινε ΤΡΕΙΣ στήλες με την προεπιλογή του CSS αντί για
                δύο. Μετρημένο στον πάγκο: 228 επί τρία. Το άπλωμα μπαίνει πρώτο,
                όπως το γράφουν και τα άλλα δεκατρία σημεία της εφαρμογής. */}
            {/* ══ Η ΜΙΣΘΩΣΗ ΕΙΝΑΙ ΜΙΑ ΕΡΩΤΗΣΗ ΜΕ ΤΕΣΣΕΡΑ ΣΚΕΛΗ, ΟΧΙ ΔΥΟ ΣΕΙΡΕΣ ══
                Το είδος και η διάρκεια κάθονταν σε μία σειρά δύο στηλών, η
                έναρξη και η λήξη σε δεύτερη σειρά τριών — δηλαδή τέσσερα πεδία
                που απαντιούνται μαζί, σπασμένα σε δύο γραμμές με διαφορετικό
                αριθμό στηλών, άρα και διαφορετικά πλάτη κουτιών. Ο αναγνώστης
                άλλαζε ρυθμό στη μέση μιας ερώτησης.

                Τώρα μία σειρά τεσσάρων: τι μίσθωση, για πόσο, από πότε, ως πότε.
                Η `form-row-4` πέφτει σε δύο στήλες κάτω από τα 1.000 και σε μία
                στο τηλέφωνο, οπότε δεν στριμώχνεται πουθενά. */}
            <div className="form-row form-row-4" style={{ marginBottom: 12 }}>
              {/* ══ ΤΑ ΚΟΥΜΠΑΚΙΑ ΔΕΝ ΧΩΡΑΝΕ ΣΕ ΤΕΤΑΡΤΟ ΤΟΥ ΠΑΡΑΘΥΡΟΥ ══════════════
                  Μετρημένο: η σειρά της φόρμας είναι 710 εικονοστοιχεία, άρα η
                  στήλη 169· και τα δύο κουμπάκια θέλουν 211 («Κατοικία» 83,
                  «Επαγγελματική» 122, με το κενό τους). Στοιβάζονταν το ένα πάνω
                  στο άλλο και η σειρά ψήλωνε για να χωρέσει ένα χειριστήριο που
                  δίπλα του είχε τρία μονόγραμμα.

                  Μία επιλογή από δύο σε λίστα δεν χάνει τίποτα και κερδίζει το
                  ίδιο ιδίωμα με τη «Διάρκεια» ακριβώς δίπλα της: δύο λίστες και
                  δύο ημερομηνίες, ίδιο ύψος, ίδιο πλάτος, μία γραμμή. */}
              {show('tenant.lease_category')&&(
                <div id={tenantFieldId('lease_category')}>
                <SelectField label={lab('tenant.lease_category')} labelInfo={why('tenant.lease_category')}
                  value={form.lease_category} onChange={v=>sf('lease_category',v as LeaseCategory)} placeholder={E?E.choose:'Επιλογή…'}
                  options={(Object.keys(LEASE_CATEGORY_LABELS) as LeaseCategory[]).map(lc=>({ value:lc, label:E?.leaseCategories[lc]??LEASE_CATEGORY_LABELS[lc] }))}/>
                {fieldNote('lease_category')}
                </div>
              )}
              {show('tenant.lease_type')&&(
                <SelectField label={lab('tenant.lease_type')} labelInfo={why('tenant.lease_type')}
                  value={form.lease_type} onChange={v=>sf('lease_type',v as LeaseType)}
                  options={(Object.keys(LEASE_LABELS) as LeaseType[]).map(lt=>({ value:lt, label:E?.leaseTypes[lt]??LEASE_LABELS[lt] }))}/>
              )}
              {show('tenant.lease_start')&&<DatePicker label={lab('tenant.lease_start')} labelInfo={why('tenant.lease_start')} value={form.lease_start} onChange={v=>sf('lease_start',v)}/>}
              {/* Η ΛΗΞΗ ΕΙΧΕ ΤΟ «ΓΙΑΤΙ» ΤΗΣ ΕΝΑΡΞΗΣ. Δύο πεδία δίπλα δίπλα, το
                  ίδιο κείμενο πίσω από τα δύο κυκλάκια· το ένα από τα δύο
                  έλεγε πράγμα που δεν αφορούσε το πεδίο του. */}
              {show('tenant.lease_end')&&<DatePicker label={lab('tenant.lease_end')} labelInfo={why('tenant.lease_end')} value={form.lease_end} onChange={v=>sf('lease_end',v)}/>}
              {/* Η ΣΥΝΤΟΜΟΓΡΑΦΙΑ ΔΕΝ ΕΙΝΑΙ ΕΛΛΗΝΙΚΑ. Το «ημ.» απέφευγε την ερώτηση «ένα ή
                   πολλά;» και διαβαζόταν ως σύμβολο. Και η ετικέτα έλεγε ήδη «Ημέρες»,
                   δηλαδή η ίδια λέξη δύο φορές στο ίδιο πεδίο. */}
              {form.lease_type==='custom'&&<NumberInput label={E?E.form.duration:'Διάρκεια'} value={String(form.custom_lease_days)} onChange={v=>sf('custom_lease_days',parseInt(v)||0)} suffix={E?E.form.dayUnit(form.custom_lease_days):plural(form.custom_lease_days,'ημέρα','ημέρες')}/>}
            </div>
            {/* Ο ΝΕΟΣ ΕΝΟΙΚΙΑΣΤΗΣ ΘΕΛΕΙ ΠΕΑ ΣΕ ΙΣΧΥ (ν. 4122/2013, άρθρο 12). Μόνο στη
                νέα μίσθωση: η επεξεργασία παλιάς δεν είναι η στιγμή να το θυμίσουμε. */}
            {!editId&&<div style={{ marginTop:14 }}><PeaLeaseNotice peaExpiry={propPeaExpiry} propType={propType} leaseStart={form.lease_start} en={E?.pea}/></div>}

            <div style={s.divider}/>
            {/* ── ΤΟ ΕΝΟΙΚΙΟ ───────────────────────────────────────────────── */}
            <SectionTitle>{E?E.form.rentTitle:'Το ενοίκιο'}</SectionTitle>
            {/* Τεσσερα πεδία που απαντιούνται μαζί: πόσο, πότε, πώς και πού. Το
                IBAN καθόταν σε δική του σειρά από κάτω, δηλαδή η ίδια ερώτηση
                σπασμένη σε δύο γραμμές με μια τρύπα δίπλα της. */}
            <div className="form-row form-row-4">
              {show('tenant.rent')&&<NumberInput label={lab('tenant.rent')} labelInfo={why('tenant.rent')} value={form.monthly_rent} onChange={v=>sf('monthly_rent',v)} suffix="€"/>}
              {show('tenant.rent_due_day')&&<SelectField label={lab('tenant.rent_due_day')} labelInfo={why('tenant.rent_due_day')} value={form.rent_due_day} onChange={v=>sf('rent_due_day',v)} options={Array.from({length:28},(_,i)=>({value:String(i+1),label:E?E.form.dueDay(i+1):`${i+1}η`}))}/>}
              {/* Ο ΔΙΑΚΟΠΤΗΣ ΗΤΑΝ ΑΛΛΟΥ ΚΑΙ ΜΕ ΑΛΛΗ ΕΤΙΚΕΤΑ. Καθόταν δίπλα στο
                  IBAN με ΚΕΦΑΛΑΙΑ ετικέτα, στημένος με το χέρι, ανάμεσα σε πεδία
                  με πεζή. Εδώ είναι το τρίτο πεδίο της σειράς του ενοικίου, με
                  το ίδιο `ToggleField` που χρησιμοποιεί η υπόλοιπη εφαρμογή. */}
              {/* ΤΟ IBAN ΠΡΙΝ ΤΟΝ ΔΙΑΚΟΠΤΗ. Η σειρά διαβάζεται «πόσο, πότε, πού,
                  πώς»: ο λογαριασμός είναι στοιχείο που γράφεις, ο διακόπτης
                  είναι η επιβεβαίωση ότι έτσι εισπράττεις. Ο διακόπτης πρώτος
                  ρωτούσε «πώς;» πριν υπάρχει το «πού;» — και ο διακόπτης, που
                  είναι το πιο μικρό χειριστήριο της σειράς, καθόταν ανάμεσα σε
                  δύο πεδία κόβοντας τη ροή τους. Τελευταίος, κλείνει τη σειρά. */}
              {show('tenant.rent_iban')&&<TextInput label={lab('tenant.rent_iban')} value={form.rent_iban} onChange={v=>sf('rent_iban',v)} placeholder="GR..."/>}
              {show('tenant.rent_iban')&&<ToggleField label={E?E.form.viaBank:'Μέσω τράπεζας'} labelInfo={why('tenant.rent_iban')} on={form.e_payment} onChange={v=>sf('e_payment',v)}/>}
            </div>
            {/* Ο,τι θα συμβεί μόνο του, λέγεται πριν συμβεί — και μαζί τι το ακυρώνει. */}
            {editRow?.pending_rent!=null&&editRow.pending_rent_from&&(
              <div style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:T.font.sans, lineHeight:1.55, marginBottom:6 }}>
                {E?E.form.pending(fmt(editRow.pending_rent),fD(editRow.pending_rent_from)):<>Εκκρεμεί αναπροσαρμογή σε {fmt(editRow.pending_rent)} από {fmtD(editRow.pending_rent_from)}, από υπογεγραμμένη ειδοποίηση. Αλλαγή του ενοικίου εδώ την ακυρώνει.</>}
              </div>
            )}
            {show('tenant.rent_iban')&&!form.e_payment&&(
              <div style={{ marginTop:12 }}>
                <AlertBar level="warning" text={E?E.form.cash(fp((PRESUMPTIVE_DEDUCTION_RATE*100))):`Με είσπραξη σε μετρητά χάνεται η τεκμαρτή έκπτωση ${fp((PRESUMPTIVE_DEDUCTION_RATE*100))} και ο φόρος υπολογίζεται στο 100% των ακαθάριστων.`}/>
              </div>
            )}

            <div style={s.divider}/>
            {/* ══ ΕΓΓΥΗΣΗ ΚΑΙ ΕΠΙΠΛΩΣΗ ΣΤΗΝ ΙΔΙΑ ΕΥΘΕΙΑ ══════════════════════
                Ηταν δύο ενότητες με δικό τους τίτλο και δική τους γραμμή, η μία
                κάτω από την άλλη, με ΕΝΑ χειριστήριο η καθεμία: ένα πεδίο ποσού
                σε πλάτος ενός τρίτου, με δύο τρύπες δεξιά του· από κάτω τρία
                κουμπάκια. Τρεις γραμμές τίτλων και δύο οριζόντιες γραμμές για
                δύο ερωτήσεις που απαντιούνται σε δέκα δευτερόλεπτα.

                Ο τίτλος ενότητας έγινε ετικέτα πεδίου, που είναι ό,τι ήταν
                εξαρχής: το όνομα του ΕΝΟΣ χειριστηρίου από κάτω του. Το χώρισμα
                ανάμεσά τους είναι η λεπτή κάθετη γραμμή της `cl-split`. */}
            <div {...fixedCols(2, 20, 'end', 'cl-split')}>
              {show('tenant.deposit')&&(
                <NumberInput label={lab('tenant.deposit')} labelInfo={why('tenant.deposit')} value={form.deposit_amount} onChange={v=>sf('deposit_amount',v)} suffix="€"/>
              )}
              {/* ══ ΤΡΙΑ ΚΟΥΜΠΑΚΙΑ ΓΙΑ ΜΙΑ ΕΠΙΛΟΓΗ ΕΓΙΝΑΝ ΛΙΣΤΑ ══════════════════
                  Το «Turn Key (όλα μέσα)» θέλει διπλάσιο πλάτος από τα άλλα δύο,
                  οπότε η σειρά έβγαινε άνιση δίπλα σε ένα πεδίο ποσού με σταθερό
                  κουτί. Και η επιλογή είναι ΜΙΑ από τρεις, δηλαδή ακριβώς αυτό
                  που κάνει μια λίστα. Τα κουμπάκια αξίζουν όταν οι επιλογές
                  είναι δύο και κοντές («Κατοικία» ή «Επαγγελματική») και τις
                  βλέπεις χωρίς να ανοίξεις τίποτα· στις τρεις με μακρύ όνομα
                  κοστίζουν πλάτος χωρίς να κερδίζουν πάτημα. */}
              <SelectField label={lab('tenant.furnishing')} labelInfo={why('tenant.furnishing')}
                value={form.furnishing} onChange={v=>sf('furnishing',v as Furnishing)} placeholder={E?E.choose:'Επιλογή…'}
                options={(Object.keys(FURNISHING_LABELS) as Furnishing[]).map(fv=>({ value:fv, label:E?.furnishing[fv]??FURNISHING_LABELS[fv] }))}/>
            </div>

            {/* Οι παρεχόμενες υπηρεσίες υπάρχουν ΜΟΝΟ σε επιπλωμένο — το λέει το μητρώο */}
            {show('tenant.services')&&(
              <div style={{ marginTop:T.sp.lg }}>
                <SectionTitle info={why('tenant.services')}>{E?lab('tenant.services'):'Τι πληρώνεις εσύ, τι ο ενοικιαστής'}</SectionTitle>
                <ServicesEditor value={form.services} onChange={v=>sf('services',v)} en={E?{ ...E.services, payer:E.payer }:undefined}/>
              </div>
            )}
            {!isFurnished(form.furnishing)&&(form.services||[]).length>0&&(
              <div style={{ marginTop:14 }}>
                <AlertBar level="info" text={E?E.form.oldServices((form.services||[]).length):`Έχεις ${(form.services||[]).length} καταχωρημένες γραμμές υπηρεσιών από προηγούμενη ρύθμιση. Δεν εμφανίζονται σε γυμνό διαμέρισμα, αλλά διατηρούνται· άλλαξε την επίπλωση σε «Επιπλωμένο» για να τις δεις.`}/>
              </div>
            )}

            <div style={s.divider}/>
            {/* ── ΧΑΡΤΙΑ ───────────────────────────────────────────────────── */}
            <SectionTitle info={why('tenant.lease_doc')}>{lab('tenant.lease_doc')}</SectionTitle>
            <div className="form-row form-row-3" style={{ marginBottom:14 }}>
              <div className="form-span-2">
                <TextInput label={E?E.form.externalLink:'Εξωτερικός σύνδεσμος'} value={form.lease_doc_external_url} onChange={v=>sf('lease_doc_external_url',v)} placeholder="drive.google.com/…"/>
              </div>
            </div>
            <FilePickRow en={E?.file} label={E?E.form.signedLease:'Υπογεγραμμένο μισθωτήριο'} hint={E?E.form.signedLeaseHint:'PDF ή εικόνα, αποθηκεύεται στον χώρο εγγράφων του ακινήτου'}
              busy={docBusy} onPick={f=>uploadFormDoc(f,'lease')} docs={formDocs.filter(d=>d.tag==='lease')}/>

            {/* ── ΠΕΡΙΣΣΟΤΕΡΑ: σπάνια αλλά υπαρκτά, κλειστά εξ ορισμού ─────── */}
            {moreFields.length>0&&(
              <>
                <div style={s.divider}/>
                {/* ΤΟ ΑΝΟΙΓΜΑ ΕΙΧΕ ΔΙΚΟ ΤΟΥ ΣΧΗΜΑ ΚΑΙ ΗΤΑΝ ΤΟ ΜΟΝΑΔΙΚΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ.
                    Κουμπί σε όλο το πλάτος, με περίγραμμα σαν πεδίο· δεξιά
                    ένα «+» ή «−» αντί για το βελάκι που ανοίγει κάθε άλλη λίστα
                    σε δώδεκα οθόνες. Και από κάτω μια πρόταση που εξηγούσε τι
                    είναι μέσα, μόνιμα ορατή μόλις άνοιγε. Πλέον είναι η ΙΔΙΑ
                    γραμμή που ανοίγει με παντού: ετικέτα, μέτρημα, βελάκι — και
                    η εξήγηση στο κυκλάκι της. */}
                <button type="button" onClick={()=>setMoreOpen(o=>!o)} aria-expanded={moreOpen} aria-label={E?E.form.moreFields:'Περισσότερα πεδία'}
                  className="acc-toggle acc-row" style={{ minHeight: 44 }}>
                  {/* ΚΟΥΜΠΙ ΜΕΣΑ ΣΕ ΚΟΥΜΠΙ. Η κουκκίδα επεξήγησης είναι `<button>` και
                      καθόταν μέσα σε αυτό το `<button>`: άκυρη HTML, δύο στόχοι στο
                      ίδιο σημείο και ο αναγνώστης οθόνης άκουγε ένα χειριστήριο μέσα
                      σε άλλο. Το μόνο που έλεγε ήταν «δεν είναι υποχρεωτικά»· το λέει
                      πλέον η ίδια η μέτρηση, «3 προαιρετικά πεδία». */}
                  <span style={{ ...TT.label, fontSize: 'var(--fs-xs)', color:'var(--text-secondary)', flex:1, minWidth:0, display:'flex', alignItems:'center' }}>
                    {E?E.form.moreLabel:'Περισσότερα'}
                  </span>
                  <span style={{ ...TT.caption, color:'var(--text-tertiary)', fontFamily:T.font.num, fontVariantNumeric:'tabular-nums' }}>{fn(moreFields.length)} {E?E.form.optional(moreFields.length):moreFields.length===1?'προαιρετικό πεδίο':'προαιρετικά πεδία'}</span>
                  <ChevronRight aria-hidden size={15} style={{ flexShrink:0, color:'var(--text-tertiary)', transform:moreOpen?'rotate(90deg)':'none', transition:'transform .18s' }}/>
                </button>
                {moreOpen&&(
                  <div style={{ marginTop:14 }}>

                    {/* ΕΝΤΕΚΑ ΠΕΔΙΑ, ΕΝΤΕΚΑ ΠΛΗΡΗ ΠΛΑΤΗ, ΤΟ ΕΝΑ ΚΑΤΩ ΑΠΟ ΤΟ ΑΛΛΟ.
                        Κάθε πεδίο εδώ ήταν τυλιγμένο σε δικό του `<div>` με
                        `marginBottom:16`, δηλαδή μία στήλη σε όλο το πλάτος του
                        παραθύρου για να δεχτεί ένα επάγγελμα ή μια συχνότητα.
                        Μετρημένο στο παράθυρο: 1.030 εικονοστοιχεία πλάτος για
                        πεδία που ζητούν 200· ύψος που ξεπερνούσε τρεις
                        οθόνες. Πλέον είναι οι ΙΔΙΕΣ σειρές τριών στηλών με την
                        υπόλοιπη φόρμα: ίδια πλάτη, ίδιες αφετηρίες, ίδια
                        απόσταση. Το «Περισσότερα» έπαψε να είναι άλλη φόρμα. */}
                    {/* ΤΡΙΑ ΚΑΙ ΤΡΙΑ, ΟΧΙ ΤΕΣΣΕΡΑ ΚΑΙ ΔΥΟ. Τα τέσσερα πρώτα πεδία
                        ήταν σε ΜΙΑ σειρά τριών στηλών, οπότε το τέταρτο («Συχνότητα
                        εξόφλησης») έπεφτε μόνο του σε δεύτερη σειρά με δύο τρύπες
                        δίπλα του· ο τύπος με τον αριθμό εγγράφου έμεναν δύο σε
                        τρεις στήλες. Οι σειρές γράφονται πλέον ΓΕΜΑΤΕΣ: τρία και
                        τρία, το ίδιο σχήμα δύο φορές. */}
                    <div className="form-row form-row-3" style={{ marginBottom:14 }}>
                      {more('tenant.email')&&<TextInput label={lab('tenant.email')} labelInfo={why('tenant.email')} value={form.email} onChange={v=>sf('email',v)} type="email"/>}
                      {more('tenant.profession')&&<TextInput label={lab('tenant.profession')} labelInfo={why('tenant.profession')} value={form.profession} onChange={v=>sf('profession',v)} placeholder={E?E.form.professionHint:'Μηχανικός'}/>}
                      {more('tenant.iban')&&<TextInput label={lab('tenant.iban')} labelInfo={why('tenant.iban')} value={form.iban} onChange={v=>sf('iban',v)} placeholder="GR00 0000 0000…"/>}
                    </div>

                    <div className="form-row form-row-3" style={{ marginBottom:14 }}>
                      {more('tenant.payment_frequency')&&<SelectField label={lab('tenant.payment_frequency')} labelInfo={why('tenant.payment_frequency')} value={form.payment_frequency} onChange={v=>{ if(isPaymentFreq(v)) sf('payment_frequency',v); }} options={(Object.keys(PAYMENT_FREQ_LABELS) as PaymentFreq[]).map(k=>({value:k,label:E?.frequencies[k]??PAYMENT_FREQ_LABELS[k]}))}/>}
                      {more('tenant.id_doc')&&<SelectField label={E?E.form.idDocType:'Τύπος εγγράφου'} labelInfo={why('tenant.id_doc')} value={form.id_doc_type} onChange={v=>{ if(isIdDocType(v)) sf('id_doc_type',v); }} options={ID_DOCS.map((d,i)=>({value:d,label:E?.idDocs[i]??d}))} placeholder={E?E.choose:'Επιλογή…'}/>}
                      {more('tenant.id_doc')&&<TextInput label={E?E.form.idDocNumber:'Αριθμός εγγράφου'} value={form.id_doc_number} onChange={v=>sf('id_doc_number',v)}/>}
                    </div>

                    {/* Ε2 στήλη 19. Ψηφία μόνο· τον γράφει και η Δήλωση μίσθωσης
                        όταν σημειωθεί ότι υποβλήθηκε. */}
                    {more('tenant.aade_lease_decl_ref')&&(
                      <div className="form-row form-row-3" style={{ marginBottom:14 }}>
                        <TextInput label={lab('tenant.aade_lease_decl_ref')} labelInfo={why('tenant.aade_lease_decl_ref')} value={form.aade_lease_decl_ref} onChange={v=>sf('aade_lease_decl_ref',v)}/>
                      </div>
                    )}

                    {more('tenant.id_doc')&&(
                      <FilePickRow en={E?.file} label={E?E.form.idScan:'Σαρωμένη ταυτότητα ή διαβατήριο'} hint={E?E.form.idScanHint:'PDF ή εικόνα'} busy={docBusy} onPick={f=>uploadFormDoc(f,'id')} docs={formDocs.filter(d=>d.tag==='id')}/>
                    )}

                    {/* Η ΕΠΙΣΤΡΟΦΗ ΕΙΝΑΙ ΤΕΤΑΡΤΟ ΠΕΔΙΟ ΚΑΙ ΓΙ᾽ ΑΥΤΟ ΠΑΙΡΝΕΙ ΔΙΚΗ
                        ΤΗΣ ΣΕΙΡΑ. Μέσα στην τριάδα της καταβολής έκανε «3+1» μόλις
                        άναβε ο διακόπτης: μία ημερομηνία μόνη της κάτω από τρία
                        πεδία, με δύο τρύπες δεξιά της. */}
                    <div className="form-row form-row-3" style={{ marginBottom:14 }}>
                      {more('tenant.deposit_method')&&<SelectField label={lab('tenant.deposit_method')} labelInfo={why('tenant.deposit_method')} value={form.deposit_method} onChange={v=>sf('deposit_method',v)} options={DEPOSIT_METHODS.map((m,i)=>({value:m,label:E?.payMethods[i]??m}))} placeholder={E?E.choose:'Επιλογή…'}/>}
                      {more('tenant.deposit_paid_on')&&<DatePicker label={lab('tenant.deposit_paid_on')} labelInfo={why('tenant.deposit_paid_on')} value={form.deposit_paid_on} onChange={v=>sf('deposit_paid_on',v)}/>}
                      {more('tenant.deposit_returned')&&<ToggleField label={lab('tenant.deposit_returned')} labelInfo={why('tenant.deposit_returned')} on={form.deposit_returned} onChange={v=>sf('deposit_returned',v)}/>}
                    </div>
                    {more('tenant.deposit_returned')&&form.deposit_returned&&(
                      <div className="form-row form-row-3" style={{ marginBottom:14 }}>
                        <DatePicker label={E?E.form.returnDate:'Ημερομηνία επιστροφής'} placeholder={E?E.choose:undefined} value={form.deposit_return_date} onChange={v=>sf('deposit_return_date',v)}/>
                      </div>
                    )}

                    {/* ══ ΔΥΟ ΓΡΑΜΜΕΣ ΓΙΑ ΜΙΑ ΕΡΩΤΗΣΗ ΚΑΙ ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ ΠΟΥ ΔΕΝ
                            ΜΠΟΡΟΥΝ ΝΑ ΙΣΧΥΟΥΝ ΜΑΖΙ ═══════════════════════════════
                        Η ετικέτα «Χώρος στάθμευσης» έπιανε ολόκληρη τη δική της
                        γραμμή και οι δύο διακόπτες την επόμενη: δύο γραμμές για
                        μία ερώτηση με μία απάντηση.

                        ΚΑΙ ΗΤΑΝ ΔΥΟ ΑΝΕΞΑΡΤΗΤΟΙ ΔΙΑΚΟΠΤΕΣ. Ο χρήστης μπορούσε να
                        ανάψει και τους δύο, δηλαδή να δηλώσει ότι το πάρκινγκ
                        ΠΕΡΙΛΑΜΒΑΝΕΤΑΙ στο ενοίκιο ΚΑΙ χρεώνεται ξεχωριστά. Δύο
                        ισχυρισμοί που αναιρούν ο ένας τον άλλο, αποθηκευμένοι
                        μαζί στη βάση, χωρίς κανένα σφάλμα πουθενά.

                        Είναι μία επιλογή από δύο, άρα κουμπάκια: το πάτημα του
                        ενός σβήνει το άλλο και το δεύτερο πάτημα το αποεπιλέγει,
                        για την περίπτωση που δεν υπάρχει καθόλου στάθμευση. Η
                        ετικέτα μπαίνει στη σειρά, δίπλα στα κουμπάκια. */}
                    {more('tenant.parking')&&(
                      <div className="form-row form-row-2" style={{ marginBottom:14 }}>
                        <ChipRow flush label={lab('tenant.parking')} info={why('tenant.parking')}>
                          <Chip on={form.parking_included} onClick={()=>{ const on=!form.parking_included; sf('parking_included',on); if(on) sf('parking_extra',false); }}>{E?E.form.parkingIncluded:'Στο ενοίκιο'}</Chip>
                          <Chip on={form.parking_extra} onClick={()=>{ const on=!form.parking_extra; sf('parking_extra',on); if(on) sf('parking_included',false); }}>{E?E.form.parkingExtra:'Χρεώνεται ξεχωριστά'}</Chip>
                        </ChipRow>
                        {form.parking_extra&&<NumberInput label={E?E.form.parkingPrice:'Μηνιαία τιμή'} value={form.parking_extra_price} onChange={v=>sf('parking_extra_price',v)} suffix="€"/>}
                      </div>
                    )}

                    {/* ΔΥΟ ΠΛΑΙΣΙΑ ΕΛΕΥΘΕΡΟΥ ΚΕΙΜΕΝΟΥ, ΤΟ ΕΝΑ ΚΑΤΩ ΑΠΟ ΤΟ ΑΛΛΟ, ΣΕ
                        ΠΛΗΡΕΣ ΠΛΑΤΟΣ: τριακόσια εικονοστοιχεία ύψος στο τέλος μιας
                        φόρμας που μόλις μαζεύτηκε. Είναι το ίδιο είδος πεδίου με το
                        ίδιο ύψος, οπότε στέκονται δίπλα δίπλα και το κάτω άκρο της
                        φόρμας γίνεται μία ευθεία. Σε στενή οθόνη ξαναπέφτουν το ένα
                        κάτω από το άλλο, όπως κάθε άλλη σειρά. */}
                    <div className="form-row form-row-2">
                      {/* ΔΥΟ ΓΡΑΜΜΕΣ ΑΝΤΙ ΓΙΑ ΤΡΕΙΣ. Τα πλαίσια άνοιγαν με `rows=3`,
                          δηλαδή ζητούσαν 110 εικονοστοιχεία το καθένα στο τέλος
                          μιας φόρμας που μόλις μαζεύτηκε — και για περιεχόμενο που
                          σπάνια ξεπερνά μία πρόταση («Αποθήκη, κήπος»). Ο χρήστης
                          που γράφει περισσότερα το τραβά από τη γωνία του. */}
                      {more('tenant.extra_perks')&&(
                        <Textarea dictation rows={2} label={lab('tenant.extra_perks')} labelInfo={why('tenant.extra_perks')} value={form.extra_perks} onChange={v=>sf('extra_perks',v)} placeholder={E?E.form.perksHint:'Αποθήκη, κήπος…'}/>
                      )}
                      {more('tenant.notes')&&(
                        <Textarea dictation rows={2} label={lab('tenant.notes')} labelInfo={why('tenant.notes')} value={form.notes} onChange={v=>sf('notes',v)}/>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {/* Σφάλμα αποθήκευσης — ΜΕΣΑ στη φόρμα, ώστε να είναι πάντα ορατό (η
                φόρμα είναι overlay· ένα σφάλμα στο body από κάτω δεν θα φαινόταν). */}
            {error&&(
              <div ref={errorRef} role="alert" style={{ marginTop:24, background:'var(--negative-dim)', border:'1px solid var(--negative-border)', borderLeft:'3px solid var(--negative)', borderRadius:T.radius.inner, padding:'12px 16px', color:'var(--negative)', fontSize: 'var(--fs-base)', fontFamily:T.font.sans, fontWeight:500, display:'flex', gap:12, alignItems:'flex-start', justifyContent:'space-between' }}>
                <span style={{ lineHeight:1.55, wordBreak:'break-word' as const }}>{error}</span>
                <IconBtn label={E?E.closeError:'Κλείσιμο μηνύματος σφάλματος'} tone="danger" onClick={()=>setError(null)}><span style={{ fontSize:18, lineHeight:1 }}>×</span></IconBtn>
              </div>
            )}
            {/* ΜΙΑ φόρμα, χωρίς βήματα: όσα πεδία έμειναν χωρούν σε μία οθόνη και
                τα σπάνια είναι πίσω από το «Περισσότερα». Οι δύο καρτέλες υπήρχαν
                επειδή τα 88 πεδία δεν χωρούσαν αλλιώς.
                Οι δύο ενέργειες («Ακύρωση», αποθήκευση) ζουν πλέον στο υποσέλιδο
                του Modal, που δεν κυλά μαζί με τα πεδία. */}
          </div>
        </Modal>
      )}

      <LeaseDeclaration open={declOpen} onClose={()=>setDeclOpen(false)} propertyId={propertyId} userId={userId} supabase={supabase} />
      {/* Προσαρτάται μόνο ανοιχτό: κάθε άνοιγμα ξεκινά καθαρό (βλ. LeaseModal). */}
      {leaseOpen && <LeaseModal open onClose={()=>setLeaseOpen(false)} onSaved={()=>void refresh()} userId={userId} supabase={supabase} branding={branding} propertyId={propertyId} />}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΥΝΟΨΗ ΤΩΝ ΜΙΣΘΩΣΕΩΝ, ΜΙΑ ΚΑΡΤΑ ΑΝΤΙ ΓΙΑ ΤΕΣΣΕΡΑ ΠΛΑΚΙΔΙΑ (16.11.2026)
// ─────────────────────────────────────────────────────────────────────────
// Ηταν τέσσερα ίσα πλακίδια, ίδιο γκρι, ίδιο βάρος: το ενοίκιο, η οφειλή, οι
// εγγυήσεις και ένα «Προηγούμενοι 0». Στα 390 έπιαναν δύο σειρές και μισή
// οθόνη και τίποτα δεν έλεγε ποιο από τα τέσσερα θέλει κίνηση. Τώρα, όπως στον
// Προϋπολογισμό: ΕΝΑΣ κύριος αριθμός (τι μπαίνει κάθε μήνα) και από κάτω
// γραμμές με εικονίδιο, όπου η οφειλή φοράει το χρώμα κινδύνου σε απαλό φόντο
// μόνο όταν υπάρχει. Οι προηγούμενοι ενοικιαστές εμφανίζονται μόνο όταν
// υπάρχουν: ένα μηδέν εκεί δεν απαντά σε καμία ερώτηση. Ολα τα χρώματα είναι
// τα tokens του θέματος (globals.css, `.tn-sum`), σε φωτεινό και σκούρο.
// ═══════════════════════════════════════════════════════════════════════════
export function TenantSummary({ rent, leases, arrears, arrearsCount, deposits, past, en: W }: {
  rent:number; leases:number; arrears:number; arrearsCount:number; deposits:number; past:number;
  /** Τα αγγλικά της σύνοψης, ή τίποτα στα ελληνικά. */
  en?: TenantsEn['summary'];
}) {
  return (
    <section className="tn-sum" aria-label={W?W.aria:'Σύνοψη μισθώσεων'}>
      <div className="tn-sum-hero">
        <div className="tn-sum-label"><Wallet size={15} aria-hidden="true"/>{W?W.rent:'Μηνιαίο ενοίκιο'}</div>
        <div className="tn-sum-big">{fe(rent)}</div>
        <div className="tn-sum-sub">{W?W.leases(leases):<>{fn(leases)} {leases===1?'ενεργή μίσθωση':'ενεργές μισθώσεις'}</>}</div>
      </div>
      <div className="tn-sum-rows">
        <div className="tn-sum-row" data-tone={arrears>0?'negative':undefined}>
          <span className="tn-sum-ico"><AlertTriangle size={15} aria-hidden="true"/></span>
          <span className="tn-sum-name">{W?W.overdue:'Ληξιπρόθεσμα'}<small>{W?(arrearsCount>0?W.installments(arrearsCount):W.nothingOwed):arrearsCount>0?`${fn(arrearsCount)} ${arrearsCount===1?'δόση':'δόσεις'}`:'καμία οφειλή'}</small></span>
          <span className="tn-sum-val">{fe(arrears)}</span>
        </div>
        <div className="tn-sum-row">
          <span className="tn-sum-ico"><ShieldCheck size={15} aria-hidden="true"/></span>
          <span className="tn-sum-name">{W?W.deposits:'Εγγυήσεις σε κατοχή'}</span>
          <span className="tn-sum-val">{fe(deposits)}</span>
        </div>
        {past>0&&(
          <div className="tn-sum-row">
            <span className="tn-sum-ico"><History size={15} aria-hidden="true"/></span>
            <span className="tn-sum-name">{W?W.past:'Προηγούμενοι ενοικιαστές'}</span>
            <span className="tn-sum-val">{fn(past)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
