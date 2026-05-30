import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Battery,
  BatteryCharging,
  Bike,
  Check,
  CheckCircle2,
  ChevronRight,
  IdCard,
  Info,
  LifeBuoy,
  Phone,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Wallet,
  Zap,
  X,
} from "lucide-react";

import EmployeeLayout from "../../components/layouts/EmployeeLayout";
import useAuth from "../../hooks/useAuth";
import { apiFetch } from "../../config/api";
import useAvailability from "../../hooks/useAvailability";
import { BATTERY_ID_OPTIONS } from "../../utils/batteryIds";
import { formatRentalId } from "../../utils/entityId";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 1, title: "Find Vehicle" },
  { key: 2, title: "Swap Details" },
  { key: 3, title: "Confirm & Submit" },
];

const SEARCH_TABS = [
  { id: "mobile", label: "Mobile Number", icon: Phone },
  { id: "vehicle", label: "Vehicle ID", icon: Bike },
  { id: "name", label: "Rider Name", icon: IdCard },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sanitizeNumericInput = (value, maxLength) =>
  String(value || "").replace(/\D/g, "").slice(0, maxLength);

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const timeAgo = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return `${Math.floor(diff / 86_400_000)} d ago`;
};

const initialsFrom = (name) => {
  const parts = String(name || "").trim().split(/\s+/);
  if (!parts[0]) return "??";
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

const normalizeIdForCompare = (value) =>
  String(value || "").replace(/[^a-z0-9]+/gi, "").toUpperCase();

const planLabel = (p) => (p ? `${String(p).charAt(0).toUpperCase()}${String(p).slice(1)} Plan` : "—");

// ---------------------------------------------------------------------------
// Shell pieces
// ---------------------------------------------------------------------------

const statusFor = (current, key) => (key < current ? "completed" : key === current ? "in_progress" : "pending");
const STATUS_TEXT = { completed: "Completed", in_progress: "In Progress", pending: "Pending" };
const STATUS_COLOR = { completed: "text-emerald-600", in_progress: "text-evegah-primary", pending: "text-gray-400" };

function HorizontalStepper({ current, onStepClick }) {
  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-1">
      {STEPS.map((s, idx) => {
        const status = statusFor(current, s.key);
        const isComplete = status === "completed";
        const isActive = status === "in_progress";
        const showConnector = idx < STEPS.length - 1;
        const nextStatus = idx < STEPS.length - 1 ? statusFor(current, STEPS[idx + 1].key) : null;
        const connectorActive = isComplete || (isActive && nextStatus !== "pending");
        const circleClass = isComplete || isActive
          ? "bg-evegah-primary text-white border-evegah-primary"
          : "bg-white text-gray-400 border-gray-200";
        const labelClass = isComplete || isActive ? "text-evegah-text" : "text-gray-400";
        return (
          <div key={s.key} className="flex items-start gap-2 min-w-0 flex-1">
            <button type="button" onClick={() => onStepClick?.(s.key)} className="flex items-start gap-3 text-left min-w-0 group">
              <span className={`h-9 w-9 rounded-full border-2 grid place-items-center text-sm font-bold shrink-0 transition-colors ${circleClass}`}>
                {isComplete ? <Check size={16} /> : s.key}
              </span>
              <span className="flex flex-col min-w-0 leading-tight">
                <span className={`text-sm font-semibold ${labelClass} group-hover:text-evegah-primary truncate`}>{s.title}</span>
                <span className={`text-xs ${STATUS_COLOR[status]} inline-flex items-center gap-1`}>
                  {STATUS_TEXT[status]}{isComplete ? <Check size={11} /> : null}
                </span>
              </span>
            </button>
            {showConnector ? (
              <div className="flex-1 pt-[18px] min-w-[24px]">
                <div className={`h-[2px] w-full rounded-full ${connectorActive ? "bg-evegah-primary" : "bg-gray-200"}`} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value, valueClass = "text-evegah-text" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold text-right ${valueClass}`}>{value ?? "—"}</span>
    </div>
  );
}

function NeedHelpCard() {
  return (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 text-center">
      <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-evegah-primary text-white">
        <LifeBuoy size={18} />
      </div>
      <p className="text-sm font-semibold text-evegah-text">Need Help?</p>
      <p className="mt-1 text-xs text-gray-500">Trouble with battery swap?</p>
      <Link
        to="/employee/support"
        className="mt-3 inline-flex items-center justify-center w-full rounded-xl border border-evegah-primary px-3 py-2 text-xs font-semibold text-evegah-primary hover:bg-brand-light/40"
      >
        Contact Support
      </Link>
    </div>
  );
}

function HelperCard({ title, icon: Icon, tint = "purple", children }) {
  const palette = tint === "amber"
    ? { border: "border-amber-200", bg: "bg-amber-50/70", iconBg: "bg-amber-100 text-amber-600" }
    : { border: "border-evegah-border", bg: "bg-white", iconBg: "bg-brand-light text-evegah-primary" };
  return (
    <div className={`border ${palette.border} ${palette.bg} rounded-2xl shadow-card p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-9 w-9 grid place-items-center rounded-xl ${palette.iconBg}`}><Icon size={16} /></span>
        <h3 className="text-sm font-bold text-evegah-text">{title}</h3>
      </div>
      <div className="space-y-2 text-xs text-gray-600">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function BatterySwap() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Wizard
  const [currentStep, setCurrentStep] = useState(1);

  // Search
  const [activeSearchTab, setActiveSearchTab] = useState("mobile");
  const [searchValue, setSearchValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [rental, setRental] = useState(null);
  const [rentalDisplayId, setRentalDisplayId] = useState("");

  // Swap details
  const [batteryOut, setBatteryOut] = useState("");
  const [batteryIn, setBatteryIn] = useState("");
  const [notes, setNotes] = useState("");

  const [batteryInDropdownOpen, setBatteryInDropdownOpen] = useState(false);
  const [batteryInQuery, setBatteryInQuery] = useState("");
  const batteryInRef = useRef(null);
  const batteryInQueryRef = useRef(null);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("upi"); // 'upi' | 'cash' | 'wallet'
  const [swapAmount, setSwapAmount] = useState("");
  const [iciciQrData, setIciciQrData] = useState(null);
  const [iciciQrLoading, setIciciQrLoading] = useState(false);
  const [iciciQrError, setIciciQrError] = useState("");
  const [iciciTxnStatus, setIciciTxnStatus] = useState("");
  const [iciciTxnError, setIciciTxnError] = useState("");
  const [iciciTxnVerified, setIciciTxnVerified] = useState(false);
  const [iciciMerchantTranId, setIciciMerchantTranId] = useState(null);

  // Submission
  const [confirmAccepted, setConfirmAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [savedSwap, setSavedSwap] = useState(null);

  // Recent swaps
  const [recentSwaps, setRecentSwaps] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const { unavailableBatteryIds } = useAvailability({ pollMs: 30000 });
  const unavailableBatterySet = useMemo(
    () => new Set((unavailableBatteryIds || []).map(normalizeIdForCompare).filter(Boolean)),
    [unavailableBatteryIds]
  );

  const iciciEnabled = String(import.meta.env.VITE_ICICI_ENABLED || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .toLowerCase() === "true";

  const numericSwapAmount = Number(swapAmount) || 0;
  const isPaid = numericSwapAmount > 0;
  const requiresIciciVerification = iciciEnabled && isPaid && paymentMethod === "upi";
  const paymentReady = !isPaid || !requiresIciciVerification || iciciTxnVerified;

  // Fetch recent swaps for the employee
  const fetchRecent = async () => {
    const uid = user?.uid;
    if (!uid) return;
    setLoadingRecent(true);
    try {
      const rows = await apiFetch(`/api/battery-swaps?employeeUid=${encodeURIComponent(uid)}`);
      setRecentSwaps(Array.isArray(rows) ? rows.slice(0, 5) : []);
    } catch {
      setRecentSwaps([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => { fetchRecent(); }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill batteryOut once rental is loaded
  useEffect(() => {
    if (!rental) return;
    const current = String(rental.current_battery_id || rental.battery_id || "").trim();
    if (current) setBatteryOut(current);
  }, [rental?.id, rental?.current_battery_id, rental?.battery_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rental display ID
  useEffect(() => {
    const riderId = rental?.rider_id;
    const rentalId = rental?.id;
    if (!riderId || !rentalId) { setRentalDisplayId(""); return; }
    let alive = true;
    apiFetch(`/api/riders/${encodeURIComponent(riderId)}/rentals`)
      .then((rows) => {
        if (!alive) return;
        const list = Array.isArray(rows) ? rows : [];
        const sorted = [...list].sort((a, b) => Date.parse(a?.start_time || "") - Date.parse(b?.start_time || ""));
        const idx = sorted.findIndex((r) => String(r?.id || "") === String(rentalId));
        if (idx >= 0) setRentalDisplayId(`EVR-${idx === 0 ? "NR" : "RR"}_${idx + 1}`);
      })
      .catch(() => { if (alive) setRentalDisplayId(""); });
    return () => { alive = false; };
  }, [rental?.rider_id, rental?.id]);

  // Click-outside for battery dropdown
  useEffect(() => {
    if (!batteryInDropdownOpen) return;
    const onMouseDown = (e) => {
      if (batteryInRef.current && !batteryInRef.current.contains(e.target)) setBatteryInDropdownOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [batteryInDropdownOpen]);

  // Generate ICICI QR when on step 2 with UPI selected and an amount entered.
  useEffect(() => {
    if (!requiresIciciVerification || currentStep < 2 || !rental?.id) {
      return;
    }
    let cancelled = false;
    const debounceId = window.setTimeout(async () => {
      setIciciQrLoading(true); setIciciQrError("");
      try {
        const merchantTranId = `EVB${Date.now()}${Math.random().toString(16).slice(2, 6)}`.slice(0, 35);
        const response = await apiFetch("/api/payments/icici/qr", {
          method: "POST",
          body: {
            amount: numericSwapAmount,
            transactionType: "BATTERY_SWAP",
            rentalId: rental?.id || null,
            riderId: rental?.rider_id || null,
            merchantTranId,
            billNumber: `EVB-${Date.now()}`.slice(0, 50),
          },
        });
        if (cancelled) return;
        setIciciQrData(response);
        const m = String(response?.merchantTranId || response?.merchant_tran_id || merchantTranId).trim();
        setIciciMerchantTranId(m || null);
        setIciciTxnVerified(false); setIciciTxnStatus("");
      } catch (error) {
        if (cancelled) return;
        const details = String(error?.data?.details || "").trim();
        setIciciQrError(details ? `${String(error?.message || error)} (${details})` : String(error?.message || error));
        setIciciQrData(null); setIciciMerchantTranId(null);
      } finally { if (!cancelled) setIciciQrLoading(false); }
    }, 600);
    return () => { cancelled = true; window.clearTimeout(debounceId); };
  }, [requiresIciciVerification, numericSwapAmount, currentStep, rental?.id, rental?.rider_id]);

  // Poll ICICI status until SUCCESS / FAILURE.
  useEffect(() => {
    if (!requiresIciciVerification || !iciciMerchantTranId || savedSwap) {
      return;
    }
    let cancelled = false; let intervalId = null; let attempts = 0; const maxAttempts = 60;
    const poll = async () => {
      attempts += 1;
      try {
        const decoded = await apiFetch("/api/payments/icici/status", {
          method: "POST", body: { merchantTranId: iciciMerchantTranId },
        });
        const raw = String(decoded?.status || decoded?.Status || "").trim();
        const next = raw ? raw.toUpperCase() : "";
        if (!cancelled) { setIciciTxnStatus(next); setIciciTxnError(""); }
        if (next === "SUCCESS") {
          if (!cancelled) setIciciTxnVerified(true);
          if (intervalId) window.clearInterval(intervalId);
        } else if (next === "FAILURE" || next === "FAILED") {
          if (!cancelled) setIciciTxnVerified(false);
          if (intervalId) window.clearInterval(intervalId);
        } else if (attempts >= maxAttempts && intervalId) {
          window.clearInterval(intervalId);
        }
      } catch (e) {
        if (!cancelled) setIciciTxnError(String(e?.message || e || "Unable to check payment status"));
      }
    };
    poll();
    intervalId = window.setInterval(poll, 5000);
    return () => { cancelled = true; if (intervalId) window.clearInterval(intervalId); };
  }, [requiresIciciVerification, iciciMerchantTranId, savedSwap]);

  // Reset payment state when method switches away from UPI or amount cleared.
  useEffect(() => {
    if (!requiresIciciVerification) {
      setIciciQrData(null); setIciciMerchantTranId(null);
      setIciciTxnStatus(""); setIciciTxnVerified(false); setIciciQrError("");
    }
  }, [requiresIciciVerification]);

  // Filter available batteries (exclude unavailable + currently installed)
  const filteredBatteryIds = useMemo(() => {
    const q = batteryInQuery.trim().toUpperCase();
    const out = normalizeIdForCompare(batteryOut);
    return BATTERY_ID_OPTIONS.filter((id) => {
      const n = normalizeIdForCompare(id);
      if (q && !id.toUpperCase().includes(q)) return false;
      if (out && n === out) return false; // can't swap into the same battery
      return true;
    });
  }, [batteryInQuery, batteryOut]);

  // ---------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------

  const handleSearch = async () => {
    setSearchError(""); setSubmitError(""); setSavedSwap(null);
    const v = String(searchValue || "").trim();
    if (!v) { setSearchError("Enter a search value."); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (activeSearchTab === "mobile") params.set("mobile", sanitizeNumericInput(v, 10));
      else if (activeSearchTab === "vehicle") params.set("vehicle", v);
      else params.set("name", v);
      const found = await apiFetch(`/api/rentals/active?${params.toString()}`);
      if (!found) { setSearchError("No active rental found for the given details."); setRental(null); return; }
      setRental(found);
    } catch (e) {
      setSearchError(String(e?.message || e || "Unable to search active rental"));
      setRental(null);
    } finally { setSearching(false); }
  };

  const handleSelectRental = () => setCurrentStep(2);

  const handleChangeRider = () => {
    setRental(null); setBatteryOut(""); setBatteryIn(""); setNotes("");
    setSwapAmount(""); setPaymentMethod("upi");
    setIciciQrData(null); setIciciMerchantTranId(null);
    setIciciTxnStatus(""); setIciciTxnVerified(false); setIciciQrError("");
    setConfirmAccepted(false); setSavedSwap(null); setSubmitError("");
    setCurrentStep(1);
  };

  // ---------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------

  const handleSubmitSwap = async () => {
    setSubmitError("");
    if (!rental?.id) return setSubmitError("Select a rental first.");
    if (!batteryOut.trim()) return setSubmitError("Enter the current battery ID.");
    if (!batteryIn.trim()) return setSubmitError("Pick the new battery.");
    if (normalizeIdForCompare(batteryOut) === normalizeIdForCompare(batteryIn)) {
      return setSubmitError("The new battery must differ from the current one.");
    }
    if (requiresIciciVerification && !iciciTxnVerified) {
      return setSubmitError("UPI payment is not yet verified. Wait for the SUCCESS status or switch to Cash.");
    }
    if (!confirmAccepted) return setSubmitError("Please confirm before submitting.");

    setSubmitting(true);
    try {
      const saved = await apiFetch("/api/battery-swaps", {
        method: "POST",
        body: {
          employee_uid: user?.uid || user?.email || "system",
          employee_email: user?.email || null,
          vehicle_number: rental.vehicle_number || rental.bike_id || "",
          battery_out: batteryOut.trim(),
          battery_in: batteryIn.trim(),
          swapped_at: new Date().toISOString(),
          notes: notes.trim() || null,
          swap_amount: isPaid ? numericSwapAmount : 0,
          payment_method: isPaid ? paymentMethod : null,
          meta: {
            payment: {
              amount: numericSwapAmount,
              method: isPaid ? paymentMethod : "none",
              status: isPaid
                ? (paymentMethod === "upi" ? (iciciTxnVerified ? "SUCCESS" : "PENDING") : "COLLECTED")
                : "NA",
              iciciMerchantTranId: iciciMerchantTranId || null,
              merchantTranId: iciciMerchantTranId || null,
            },
          },
        },
      });
      setSavedSwap(saved);
      // refresh recents
      fetchRecent();
    } catch (e) {
      setSubmitError(String(e?.message || e || "Unable to record battery swap"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwapAnother = () => {
    setBatteryOut(""); setBatteryIn(""); setNotes("");
    setSwapAmount(""); setPaymentMethod("upi");
    setIciciQrData(null); setIciciMerchantTranId(null);
    setIciciTxnStatus(""); setIciciTxnVerified(false); setIciciQrError("");
    setConfirmAccepted(false); setSavedSwap(null); setSubmitError("");
    setRental(null); setSearchValue("");
    setCurrentStep(1);
  };

  // ---------------------------------------------------------------------
  // Right rail
  // ---------------------------------------------------------------------

  const RiderSummary = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={16} className="text-evegah-primary" />
        <h3 className="text-sm font-bold text-evegah-text">Rider Summary</h3>
      </div>
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-full bg-brand-light text-evegah-primary grid place-items-center text-sm font-bold shrink-0">
          {initialsFrom(rental?.rider_full_name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-evegah-text inline-flex items-center gap-1.5">
            {rental?.rider_full_name || "—"}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5">
              <BadgeCheck size={10} /> KYC Verified
            </span>
          </p>
          <p className="text-xs text-gray-500 inline-flex items-center gap-1">
            <Phone size={11} /> +91 {rental?.rider_mobile || rental?.mobile || "—"}
          </p>
          {rental?.rider_code ? <p className="text-xs text-gray-500">Rider ID: {rental.rider_code}</p> : null}
        </div>
      </div>
      <div className="space-y-1.5 pt-3 border-t border-evegah-border">
        <SummaryRow label="Vehicle" value={rental?.vehicle_number || rental?.bike_id || "—"} />
        <SummaryRow label="Plan" value={planLabel(rental?.rental_package)} />
        <SummaryRow label="Ride Start" value={formatDateTime(rental?.start_time)} />
        <SummaryRow label="Expected Return" value={formatDateTime(rental?.rental_end)} />
      </div>
    </div>
  );

  const SwapSummary = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BatteryCharging size={16} className="text-evegah-primary" />
        <h3 className="text-sm font-bold text-evegah-text">Swap Summary</h3>
      </div>
      <div className="space-y-2">
        <SummaryRow label="Vehicle" value={rental?.vehicle_number || rental?.bike_id || "—"} />
        <SummaryRow label="Old Battery" value={batteryOut || "—"} valueClass="text-rose-600" />
        <SummaryRow label="New Battery" value={batteryIn || "—"} valueClass="text-emerald-700" />
        <SummaryRow label="When" value={savedSwap ? formatDateTime(savedSwap.swapped_at || savedSwap.created_at) : "Now (on confirm)"} />
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-evegah-border">
          <span className="text-sm text-gray-500">Status</span>
          <span className={`inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 ${savedSwap ? "bg-emerald-100 text-emerald-700" : "bg-brand-light text-evegah-primary"}`}>
            {savedSwap ? "Swapped" : "Pending"}
          </span>
        </div>
      </div>
    </div>
  );

  const RecentSwapsCard = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-evegah-primary" />
          <h3 className="text-sm font-bold text-evegah-text">Recent Swaps</h3>
        </div>
        <button type="button" onClick={fetchRecent} className="text-xs font-semibold text-gray-500 hover:text-evegah-primary inline-flex items-center gap-1">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      {loadingRecent ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : recentSwaps.length === 0 ? (
        <p className="text-xs text-gray-500">No swaps yet today.</p>
      ) : (
        <ul className="space-y-2.5">
          {recentSwaps.map((s) => (
            <li key={s.id} className="rounded-xl border border-evegah-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-evegah-text truncate">{s.vehicle_number}</p>
                <span className="text-[10px] text-gray-400">{timeAgo(s.swapped_at || s.created_at)}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                <span className="text-rose-600 font-semibold">{s.battery_out}</span>
                <span className="mx-1 text-gray-400">→</span>
                <span className="text-emerald-700 font-semibold">{s.battery_in}</span>
              </p>
              <p className="text-[11px] text-gray-400 truncate">{s.rider_full_name || "—"}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderRightRail = () => {
    if (currentStep === 1 && !rental) {
      return (
        <>
          <HelperCard title="Why swap batteries?" icon={BatteryCharging} tint="purple">
            {[
              "Keeps the rider on the road without delay",
              "Records the change for audit",
              "Pairs the new battery with the active rental",
            ].map((t) => (
              <div key={t} className="flex items-start gap-2">
                <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" /><span>{t}</span>
              </div>
            ))}
          </HelperCard>
          <RecentSwapsCard />
          <NeedHelpCard />
        </>
      );
    }
    return (
      <>
        <RiderSummary />
        <SwapSummary />
        <RecentSwapsCard />
        <NeedHelpCard />
      </>
    );
  };

  // ---------------------------------------------------------------------
  // Step bodies
  // ---------------------------------------------------------------------

  const renderRiderBanner = () => {
    if (!rental) return null;
    return (
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-brand-light text-evegah-primary grid place-items-center text-sm font-bold">
              {initialsFrom(rental.rider_full_name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-evegah-text inline-flex items-center gap-1.5">
                {rental.rider_full_name || "—"}
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5">
                  <BadgeCheck size={10} /> KYC Verified
                </span>
              </p>
              <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                <Phone size={11} /> +91 {rental.rider_mobile || "—"}{rental.rider_code ? ` · Rider ID: ${rental.rider_code}` : ""}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs flex-1">
            <SummaryRow label="Ride ID" value={rentalDisplayId || formatRentalId(rental.id)} />
            <SummaryRow label="Vehicle" value={rental.vehicle_number || rental.bike_id || "—"} />
            <SummaryRow label="Current Battery" value={rental.current_battery_id || rental.battery_id || "—"} valueClass="text-rose-600" />
            <SummaryRow label="Ride Start" value={formatDateTime(rental.start_time)} />
            <SummaryRow label="Expected Return" value={formatDateTime(rental.rental_end)} />
            <SummaryRow
              label="Status"
              value={<span className="inline-flex items-center rounded-full bg-brand-light text-evegah-primary text-[11px] font-semibold px-2 py-0.5">Active</span>}
            />
          </div>
          <button
            type="button"
            onClick={handleChangeRider}
            className="inline-flex items-center gap-1 rounded-lg border border-evegah-border px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            <X size={12} /> Change Rider
          </button>
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Find Vehicle</h2>
          <p className="text-sm text-gray-500">Search the rider's active rental to swap their battery.</p>
        </div>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-xl border border-evegah-primary text-evegah-primary px-3 py-2 text-xs font-semibold hover:bg-brand-light/40">
          <QrCode size={14} /> Scan QR Code
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Search By</p>
        <div className="grid grid-cols-3 gap-2 max-w-md">
          {SEARCH_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeSearchTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setActiveSearchTab(t.id); setSearchValue(""); setSearchError(""); }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "border-evegah-primary text-evegah-primary bg-brand-light/30"
                    : "border-evegah-border text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {activeSearchTab === "mobile" ? (
          <div className="flex flex-1 items-stretch rounded-xl border border-evegah-border overflow-hidden bg-white">
            <span className="inline-flex items-center gap-1 px-3 bg-evegah-bg text-sm text-gray-600 border-r border-evegah-border">
              <span className="text-base">🇮🇳</span> +91
            </span>
            <input
              type="tel" placeholder="98765 43210" inputMode="numeric" maxLength={10}
              className="flex-1 px-3 py-3 text-sm outline-none"
              value={searchValue}
              onChange={(e) => setSearchValue(sanitizeNumericInput(e.target.value, 10))}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
        ) : (
          <input
            type="text"
            placeholder={activeSearchTab === "vehicle" ? "EVM1024012" : "Enter rider name"}
            className="flex-1 px-4 py-3 text-sm rounded-xl border border-evegah-border bg-white outline-none focus:border-evegah-primary"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        )}
        <button
          type="button" onClick={handleSearch} disabled={searching}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-evegah-primary text-white px-6 py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
        >
          <Search size={16} /> {searching ? "Searching…" : "Find Rental"}
        </button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 inline-flex items-start gap-2">
        <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
        The rider must have an active rental at the swap time. Returned rides are ineligible.
      </div>

      {searchError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{searchError}</div>
      ) : null}

      {rental ? (
        <div className="rounded-2xl border border-evegah-border bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex items-center gap-3 min-w-0 lg:w-56">
              <div className="h-12 w-12 rounded-full bg-brand-light text-evegah-primary grid place-items-center text-sm font-bold">
                {initialsFrom(rental.rider_full_name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-evegah-text inline-flex items-center gap-1.5">
                  {rental.rider_full_name}
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5">
                    <BadgeCheck size={10} /> KYC Verified
                  </span>
                </p>
                <p className="text-xs text-gray-500 inline-flex items-center gap-1"><Phone size={11} /> +91 {rental.rider_mobile || "—"}</p>
                <p className="text-xs text-gray-500">Rider ID: {rental.rider_code || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 text-xs">
              <div>
                <p className="text-gray-500 font-semibold mb-0.5">Vehicle</p>
                <p className="text-evegah-text font-semibold">{rental.bike_model || "—"}</p>
                <p className="text-gray-500">{rental.vehicle_number || rental.bike_id || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 font-semibold mb-0.5">Current Battery</p>
                <p className="text-rose-600 font-bold">{rental.current_battery_id || rental.battery_id || "—"}</p>
                <p className="text-gray-500 mt-2">Plan</p>
                <p className="text-evegah-text">{planLabel(rental.rental_package)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-semibold mb-0.5">Ride Start</p>
                <p className="text-evegah-text">{formatDateTime(rental.start_time)}</p>
                <p className="text-gray-500 font-semibold mt-2">Expected Return</p>
                <p className="text-evegah-text">{formatDateTime(rental.rental_end)}</p>
              </div>
            </div>
          </div>
          <button
            type="button" onClick={handleSelectRental}
            className="mt-4 w-full rounded-xl border-2 border-evegah-primary text-evegah-primary text-sm font-bold py-3 hover:bg-brand-light/40"
          >
            Continue to Swap Details
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      {renderRiderBanner()}

      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Swap Details</h2>
          <p className="text-sm text-gray-500">Confirm the old battery and pick the replacement.</p>
        </div>

        {/* Old → New */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
          {/* Old battery */}
          <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-600"><Battery size={16} /></span>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-rose-600">Old Battery (Out)</p>
                <p className="text-xs text-gray-500">Currently installed</p>
              </div>
            </div>
            <input
              type="text"
              placeholder="Battery ID"
              value={batteryOut}
              onChange={(e) => setBatteryOut(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-base font-bold text-evegah-text outline-none focus:border-evegah-primary"
            />
            <p className="mt-2 text-[11px] text-gray-500">Auto-filled from the active rental. Edit if it's different.</p>
          </div>

          {/* Arrow */}
          <div className="hidden md:grid place-items-center pt-12">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-light text-evegah-primary">
              <ArrowRight size={18} />
            </span>
          </div>

          {/* New battery */}
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-600"><BatteryCharging size={16} /></span>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">New Battery (In)</p>
                <p className="text-xs text-gray-500">Replacement battery</p>
              </div>
            </div>
            <div ref={batteryInRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setBatteryInDropdownOpen((v) => {
                    const next = !v;
                    if (!v && next) setTimeout(() => batteryInQueryRef.current?.focus(), 0);
                    return next;
                  });
                }}
                className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-base font-bold text-left flex items-center justify-between"
              >
                <span className={batteryIn ? "text-evegah-text" : "text-gray-400"}>{batteryIn || "Select battery ID"}</span>
                <span className="text-gray-400">▾</span>
              </button>
              {batteryInDropdownOpen ? (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-evegah-border bg-white shadow-lg p-2">
                  <input
                    ref={batteryInQueryRef}
                    className="w-full rounded-lg border border-evegah-border bg-white px-3 py-2 text-sm mb-2 outline-none focus:border-evegah-primary"
                    placeholder="Search battery id…"
                    value={batteryInQuery}
                    onChange={(e) => setBatteryInQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setBatteryInDropdownOpen(false); }
                      if (e.key === "Enter" && filteredBatteryIds.length === 1) {
                        setBatteryIn(filteredBatteryIds[0]);
                        setBatteryInDropdownOpen(false);
                        setBatteryInQuery("");
                      }
                    }}
                  />
                  <div className="max-h-56 overflow-y-auto">
                    {filteredBatteryIds.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-gray-500">No matching battery id.</p>
                    ) : (
                      filteredBatteryIds.map((id) => {
                        const unavailable = unavailableBatterySet.has(normalizeIdForCompare(id));
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={unavailable}
                            onClick={() => {
                              if (unavailable) return;
                              setBatteryIn(id);
                              setBatteryInDropdownOpen(false);
                              setBatteryInQuery("");
                            }}
                            className={`w-full text-left rounded-lg px-2 py-2 text-sm flex items-center justify-between gap-2 ${unavailable ? "text-gray-400 cursor-not-allowed" : "hover:bg-gray-50"} ${id === batteryIn ? "bg-brand-light" : ""}`}
                          >
                            <span>{id}</span>
                            <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-1.5 py-0.5 ${unavailable ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {unavailable ? "In use" : "Available"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] text-gray-500">Showing only available batteries.</p>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (Optional)</label>
          <textarea
            rows={3}
            maxLength={300}
            placeholder="Reason for swap, location, condition observations…"
            className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-gray-400 text-right">{notes.length} / 300</p>
        </div>

        {/* Payment */}
        <div className="rounded-2xl border border-evegah-border bg-evegah-bg/40 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-evegah-primary"><Wallet size={16} /></span>
            <div>
              <h3 className="text-sm font-bold text-evegah-text">Swap Payment</h3>
              <p className="text-[11px] text-gray-500">Optional — leave amount as 0 for a free swap.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Swap Charge (₹)</label>
              <input
                type="number" min="0" step="1" inputMode="numeric"
                placeholder="0"
                className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-base font-bold outline-none focus:border-evegah-primary"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("upi")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${paymentMethod === "upi" ? "border-evegah-primary text-evegah-primary bg-brand-light/40" : "border-evegah-border text-gray-600 hover:bg-gray-50"}`}
                >
                  <QrCode size={12} /> UPI / QR
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${paymentMethod === "cash" ? "border-evegah-primary text-evegah-primary bg-brand-light/40" : "border-evegah-border text-gray-600 hover:bg-gray-50"}`}
                >
                  <Wallet size={12} /> Cash
                </button>
              </div>
            </div>
          </div>

          {isPaid && paymentMethod === "upi" ? (
            iciciEnabled ? (
              <div className="rounded-xl border border-evegah-border bg-white p-4 flex flex-col sm:flex-row gap-4 items-center">
                <div className="shrink-0">
                  {iciciQrLoading ? (
                    <div className="h-44 w-44 rounded-xl border border-evegah-border bg-evegah-bg grid place-items-center text-xs text-gray-500">Generating QR…</div>
                  ) : iciciQrData?.qrImage || iciciQrData?.qr_image ? (
                    <img
                      src={iciciQrData.qrImage || iciciQrData.qr_image}
                      alt="ICICI Payment QR"
                      className="h-44 w-44 rounded-xl border border-evegah-border bg-white p-2"
                    />
                  ) : iciciQrData?.qrString ? (
                    <div className="rounded-xl border border-evegah-border bg-white p-2">
                      <QRCodeCanvas value={iciciQrData.qrString} size={170} />
                    </div>
                  ) : (
                    <div className="h-44 w-44 rounded-xl border border-dashed border-evegah-border bg-evegah-bg/60 grid place-items-center text-xs text-gray-400 px-3 text-center">
                      Enter an amount to generate the QR
                    </div>
                  )}
                </div>
                <div className="flex-1 text-sm space-y-2 min-w-0">
                  <p className="font-bold text-evegah-text">Scan to pay ₹{numericSwapAmount.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-gray-500">Ask the rider to scan with any UPI app. The swap will be unlocked once the bank confirms the payment.</p>
                  {iciciMerchantTranId ? (
                    <p className="text-[11px] text-gray-500">Ref: <span className="font-mono">{iciciMerchantTranId}</span></p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Status:</span>
                    {iciciTxnVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2 py-0.5">
                        <CheckCircle2 size={11} /> SUCCESS
                      </span>
                    ) : iciciTxnStatus ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5">{iciciTxnStatus}</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold px-2 py-0.5">Waiting for payment…</span>
                    )}
                  </div>
                  {iciciQrError ? <p className="text-xs text-rose-600">{iciciQrError}</p> : null}
                  {iciciTxnError ? <p className="text-xs text-rose-600">{iciciTxnError}</p> : null}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 inline-flex items-start gap-2">
                <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                ICICI gateway is disabled. Set <span className="font-mono">VITE_ICICI_ENABLED=true</span> in <span className="font-mono">.env</span> to enable live UPI QR.
              </div>
            )
          ) : null}

          {isPaid && paymentMethod === "cash" ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 inline-flex items-start gap-2">
              <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
              Collect ₹{numericSwapAmount.toLocaleString("en-IN")} in cash from the rider. The swap will be marked as paid.
            </div>
          ) : null}
        </div>

        {submitError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{submitError}</div>
        ) : null}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5">
      {renderRiderBanner()}

      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Confirm &amp; Submit</h2>
          <p className="text-sm text-gray-500">Review the swap details and confirm.</p>
        </div>

        {/* Swap card */}
        <div className="rounded-2xl border border-evegah-border p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 rounded-xl bg-rose-50 border border-rose-200 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider font-bold text-rose-600">Old Battery</p>
              <p className="text-xl font-bold text-rose-700 mt-1">{batteryOut || "—"}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-light text-evegah-primary shrink-0">
              <ArrowRight size={18} />
            </span>
            <div className="flex-1 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">New Battery</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{batteryIn || "—"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 mt-5 text-sm">
            <SummaryRow label="Vehicle" value={rental?.vehicle_number || rental?.bike_id || "—"} />
            <SummaryRow label="Rider" value={rental?.rider_full_name || "—"} />
            <SummaryRow label="Swap Time" value={formatDateTime(new Date())} />
            <SummaryRow label="Ride ID" value={rentalDisplayId || (rental?.id ? formatRentalId(rental.id) : "—")} />
            <SummaryRow label="Performed By" value={user?.displayName || user?.email || "—"} />
            <SummaryRow label="Notes" value={notes ? notes : "—"} />
          </div>

          {/* Payment summary */}
          <div className="mt-5 rounded-xl border border-evegah-border bg-evegah-bg/40 p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-evegah-primary"><Wallet size={14} /></span>
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-gray-500">Payment</p>
                  <p className="text-base font-bold text-evegah-text">
                    {isPaid ? `₹${numericSwapAmount.toLocaleString("en-IN")}` : "Free swap"}
                    {isPaid ? <span className="ml-2 text-xs font-semibold text-gray-500">via {paymentMethod === "upi" ? "UPI" : "Cash"}</span> : null}
                  </p>
                </div>
              </div>
              {isPaid ? (
                paymentMethod === "upi" ? (
                  iciciTxnVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2 py-0.5">
                      <CheckCircle2 size={11} /> PAYMENT VERIFIED
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5">
                      {iciciTxnStatus || "PAYMENT PENDING"}
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2 py-0.5">CASH COLLECTED</span>
                )
              ) : null}
            </div>
          </div>
        </div>

        <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <input
            type="checkbox" className="mt-0.5 accent-evegah-primary"
            checked={confirmAccepted}
            disabled={Boolean(savedSwap)}
            onChange={(e) => setConfirmAccepted(e.target.checked)}
          />
          <span className="text-sm text-amber-800">
            I confirm the new battery is physically installed on the vehicle and the old battery has been returned to inventory.
          </span>
        </label>

        {submitError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{submitError}</div>
        ) : null}

        {savedSwap ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-wrap items-center gap-3">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-800">
              Battery swap recorded successfully.
              <span className="block text-xs text-emerald-700 mt-0.5">
                {savedSwap.battery_out} → {savedSwap.battery_in} · {formatDateTime(savedSwap.swapped_at || savedSwap.created_at)}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSwapAnother}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-evegah-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-95"
            >
              <Plus size={14} /> Swap Another
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------

  const goPrev = () => setCurrentStep((s) => Math.max(1, s - 1));
  const goNext = () => {
    if (currentStep === 1 && !rental) { setSearchError("Select a rental to continue."); return; }
    if (currentStep === 2) {
      if (!batteryOut.trim()) { setSubmitError("Enter the current battery ID."); return; }
      if (!batteryIn.trim()) { setSubmitError("Pick the new battery."); return; }
      if (normalizeIdForCompare(batteryOut) === normalizeIdForCompare(batteryIn)) {
        setSubmitError("The new battery must differ from the current one.");
        return;
      }
      if (requiresIciciVerification && !iciciTxnVerified) {
        setSubmitError("Waiting for UPI payment confirmation. Ask the rider to complete the QR payment or switch to Cash.");
        return;
      }
      setSubmitError("");
    }
    setCurrentStep((s) => Math.min(3, s + 1));
  };

  const handleStepClick = (n) => {
    if (n === 1) return setCurrentStep(1);
    if (!rental) return;
    if (n === 2) return setCurrentStep(2);
    if (n === 3 && batteryIn && batteryOut && paymentReady) return setCurrentStep(3);
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <EmployeeLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <Link to="/employee/dashboard" className="hover:text-evegah-primary inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Home
          </Link>
          <ChevronRight size={12} className="text-gray-400" />
          <span>Operations</span>
          <ChevronRight size={12} className="text-gray-400" />
          <span className="text-evegah-primary">Battery Swap</span>
        </nav>

        {/* Title */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-evegah-text">Battery Swap</h1>
            <p className="text-sm text-gray-500">Swap a vehicle's battery and log the change against the active rental.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-2xl border border-evegah-border bg-white px-4 py-2 text-sm font-semibold text-evegah-primary hover:bg-evegah-bg whitespace-nowrap"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>

        {/* Stepper */}
        <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-4 sm:p-5">
          <HorizontalStepper current={currentStep} onStepClick={handleStepClick} />
        </div>

        {/* Main + rail */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="min-w-0 space-y-5">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            {/* Bottom action bar */}
            <div className="bg-white border border-evegah-border rounded-2xl shadow-card px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={currentStep === 1 ? () => navigate("/employee/dashboard") : goPrev}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
              >
                <ArrowLeft size={14} /> Back
              </button>

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={currentStep === 1 && !rental}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  {currentStep === 1 ? "Continue" : "Next: Confirm & Submit"} <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitSwap}
                  disabled={submitting || Boolean(savedSwap) || !confirmAccepted}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  <Check size={14} /> {submitting ? "Submitting…" : savedSwap ? "Swap Recorded" : "Confirm Swap"}
                </button>
              )}
            </div>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24">
            {renderRightRail()}
          </aside>
        </div>
      </div>
    </EmployeeLayout>
  );
}
