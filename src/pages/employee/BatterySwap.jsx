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
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Eye,
  Filter,
  IdCard,
  Info,
  LifeBuoy,
  Phone,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
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
  { key: 1, title: "Search Rider", subtitle: "Find and select rider" },
  { key: 2, title: "Battery Swap", subtitle: "Swap battery" },
  { key: 3, title: "Payment", subtitle: "Collect payment & complete" },
];

const SEARCH_TABS = [
  { id: "mobile", label: "Mobile Number", icon: Phone },
  { id: "vehicle", label: "Vehicle ID", icon: Bike },
  { id: "name", label: "Rider Name", icon: IdCard },
];

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI", description: "Pay using any UPI app", icon: QrCode },
  { id: "cash", label: "Cash", description: "Collect cash payment", icon: Wallet },
  { id: "card", label: "Card", description: "Debit / Credit card", icon: CreditCard },
  { id: "wallet", label: "Wallet", description: "Digital wallet payment", icon: ShieldCheck },
];

const DEFAULT_SWAP_FEE = 80;
const DEFAULT_HANDLING = 0;
const DEFAULT_TAX = 0;

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

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const initialsFrom = (name) => {
  const parts = String(name || "").trim().split(/\s+/);
  if (!parts[0]) return "??";
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

const normalizeIdForCompare = (value) =>
  String(value || "").replace(/[^a-z0-9]+/gi, "").toUpperCase();

const planLabel = (p) => (p ? `${String(p).charAt(0).toUpperCase()}${String(p).slice(1)} Plan` : "—");

// Stable synthetic stats from a string id — keeps the right rail values
// consistent for the same battery across renders. Replace with real telemetry
// when available.
const hashCode = (s) => {
  const str = String(s || "");
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const batteryStats = (id) => {
  if (!id) return { charge: 0, health: 0, cycles: 0, range: 0, number: "—" };
  const h = hashCode(id);
  return {
    charge: 10 + (h % 90), // 10..99
    health: 70 + (h % 30), // 70..99
    cycles: 50 + (h % 400), // 50..449
    range: 8 + (h % 50), // 8..57
    number: id,
  };
};

const newBatteryStats = (id) => {
  if (!id) return { charge: 100, health: 99, cycles: 0, range: 60, number: "—" };
  const h = hashCode(id);
  return {
    charge: 100,
    health: 95 + (h % 5),
    cycles: h % 80,
    range: 55 + (h % 25),
    number: id,
  };
};

const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// ---------------------------------------------------------------------------
// Shell pieces
// ---------------------------------------------------------------------------

const statusFor = (current, key) => (key < current ? "completed" : key === current ? "in_progress" : "pending");

function HorizontalStepper({ current, onStepClick }) {
  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-1">
      {STEPS.map((s, idx) => {
        const status = statusFor(current, s.key);
        const isComplete = status === "completed";
        const isActive = status === "in_progress";
        const showConnector = idx < STEPS.length - 1;
        const connectorActive = isComplete;
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
                <span className="text-xs text-gray-400 truncate">{s.subtitle}</span>
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
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-evegah-primary"><LifeBuoy size={16} /></span>
        <div>
          <p className="text-sm font-bold text-evegah-text">Need Help?</p>
          <p className="text-[11px] text-gray-500">Facing issues with this swap?</p>
        </div>
      </div>
      <Link
        to="/employee/support"
        className="mt-1 inline-flex items-center justify-center gap-1.5 w-full rounded-xl border border-evegah-primary px-3 py-2 text-xs font-semibold text-evegah-primary hover:bg-brand-light/40"
      >
        <LifeBuoy size={12} /> Contact Support
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function BatterySwap() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);

  // Search
  const [activeSearchTab, setActiveSearchTab] = useState("mobile");
  const [searchValue, setSearchValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [rental, setRental] = useState(null);
  const [rentalDisplayId, setRentalDisplayId] = useState("");

  // Swap form
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [batteryOut, setBatteryOut] = useState("");
  const [batteryIn, setBatteryIn] = useState("");
  const [notes, setNotes] = useState("");

  const [batteryInDropdownOpen, setBatteryInDropdownOpen] = useState(false);
  const [batteryInQuery, setBatteryInQuery] = useState("");
  const batteryInRef = useRef(null);
  const batteryInQueryRef = useRef(null);

  // Pricing
  const [swapFee, setSwapFee] = useState(DEFAULT_SWAP_FEE);
  const [handlingCharges] = useState(DEFAULT_HANDLING);
  const [taxes] = useState(DEFAULT_TAX);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [vpa, setVpa] = useState("");
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // ICICI
  const [iciciQrData, setIciciQrData] = useState(null);
  const [iciciQrLoading, setIciciQrLoading] = useState(false);
  const [iciciQrError, setIciciQrError] = useState("");
  const [iciciTxnStatus, setIciciTxnStatus] = useState("");
  const [iciciTxnError, setIciciTxnError] = useState("");
  const [iciciMerchantTranId, setIciciMerchantTranId] = useState(null);
  const [verifyClicked, setVerifyClicked] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [savedSwap, setSavedSwap] = useState(null);

  // Swap list
  const [allSwaps, setAllSwaps] = useState([]);
  const [loadingSwaps, setLoadingSwaps] = useState(false);
  const [swapListSearch, setSwapListSearch] = useState("");
  const [swapListPage, setSwapListPage] = useState(1);
  const SWAP_PAGE_SIZE = 6;

  const { unavailableBatteryIds } = useAvailability({ pollMs: 30000 });
  const unavailableBatterySet = useMemo(
    () => new Set((unavailableBatteryIds || []).map(normalizeIdForCompare).filter(Boolean)),
    [unavailableBatteryIds]
  );

  const iciciEnabled = String(import.meta.env.VITE_ICICI_ENABLED || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .toLowerCase() === "true";

  const totalAmount = Math.max(0, Number(swapFee || 0) + Number(handlingCharges || 0) + Number(taxes || 0));
  const isPaid = totalAmount > 0;

  // -------------------------------------------------------------------
  // Data — swap list
  // -------------------------------------------------------------------

  const fetchSwapList = async () => {
    const uid = user?.uid;
    if (!uid) return;
    setLoadingSwaps(true);
    try {
      const rows = await apiFetch(`/api/battery-swaps?employeeUid=${encodeURIComponent(uid)}`);
      setAllSwaps(Array.isArray(rows) ? rows : []);
    } catch { setAllSwaps([]); }
    finally { setLoadingSwaps(false); }
  };
  useEffect(() => { fetchSwapList(); }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSwaps = useMemo(() => {
    const q = swapListSearch.trim().toLowerCase();
    if (!q) return allSwaps;
    return allSwaps.filter((s) =>
      String(s.id || "").toLowerCase().includes(q)
      || String(s.vehicle_number || "").toLowerCase().includes(q)
      || String(s.battery_out || "").toLowerCase().includes(q)
      || String(s.battery_in || "").toLowerCase().includes(q)
      || String(s.rider_full_name || "").toLowerCase().includes(q)
    );
  }, [allSwaps, swapListSearch]);

  const swapListTotalPages = Math.max(1, Math.ceil(filteredSwaps.length / SWAP_PAGE_SIZE));
  const visibleSwapRows = useMemo(() => {
    const start = (swapListPage - 1) * SWAP_PAGE_SIZE;
    return filteredSwaps.slice(start, start + SWAP_PAGE_SIZE);
  }, [filteredSwaps, swapListPage]);

  useEffect(() => { setSwapListPage(1); }, [swapListSearch]);

  // -------------------------------------------------------------------
  // Effects — rental pre-fill, rental display id, click-outside
  // -------------------------------------------------------------------

  useEffect(() => {
    if (!rental) return;
    setVehicleNumber(rental.vehicle_number || rental.bike_id || "");
    const current = String(rental.current_battery_id || rental.battery_id || "").trim();
    if (current) setBatteryOut(current);
  }, [rental?.id, rental?.current_battery_id, rental?.battery_id, rental?.vehicle_number, rental?.bike_id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (!batteryInDropdownOpen) return;
    const onMouseDown = (e) => {
      if (batteryInRef.current && !batteryInRef.current.contains(e.target)) setBatteryInDropdownOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [batteryInDropdownOpen]);

  // Filter available batteries
  const filteredBatteryIds = useMemo(() => {
    const q = batteryInQuery.trim().toUpperCase();
    const out = normalizeIdForCompare(batteryOut);
    return BATTERY_ID_OPTIONS.filter((id) => {
      const n = normalizeIdForCompare(id);
      if (q && !id.toUpperCase().includes(q)) return false;
      if (out && n === out) return false;
      return true;
    });
  }, [batteryInQuery, batteryOut]);

  // -------------------------------------------------------------------
  // ICICI — QR + status polling (only after user clicks Verify & Collect)
  // -------------------------------------------------------------------

  useEffect(() => {
    if (!iciciEnabled || !verifyClicked || paymentMethod !== "upi" || !isPaid || !rental?.id) return;
    let cancelled = false;
    (async () => {
      setIciciQrLoading(true); setIciciQrError("");
      try {
        const merchantTranId = `EVB${Date.now()}${Math.random().toString(16).slice(2, 6)}`.slice(0, 35);
        const response = await apiFetch("/api/payments/icici/qr", {
          method: "POST",
          body: {
            amount: totalAmount,
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
      } catch (error) {
        if (cancelled) return;
        const details = String(error?.data?.details || "").trim();
        setIciciQrError(details ? `${String(error?.message || error)} (${details})` : String(error?.message || error));
        setIciciQrData(null); setIciciMerchantTranId(null);
      } finally { if (!cancelled) setIciciQrLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [verifyClicked, iciciEnabled, paymentMethod, isPaid, totalAmount, rental?.id, rental?.rider_id]);

  useEffect(() => {
    if (!verifyClicked || !iciciMerchantTranId || savedSwap || paymentVerified) return;
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
          if (!cancelled) setPaymentVerified(true);
          if (intervalId) window.clearInterval(intervalId);
        } else if (next === "FAILURE" || next === "FAILED") {
          if (!cancelled) setPaymentVerified(false);
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
  }, [verifyClicked, iciciMerchantTranId, savedSwap, paymentVerified]);

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------

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

  const handleChangeRider = () => {
    setRental(null); setVehicleNumber(""); setBatteryOut(""); setBatteryIn(""); setNotes("");
    setPaymentMethod("upi"); setVpa(""); setPaymentVerified(false); setVerifyClicked(false);
    setIciciQrData(null); setIciciMerchantTranId(null); setIciciTxnStatus(""); setIciciQrError("");
    setSavedSwap(null); setSubmitError(""); setSearchValue("");
    setCurrentStep(1);
  };

  const validateSwapForm = () => {
    if (!rental?.id) return "Select a rider first.";
    if (!vehicleNumber.trim()) return "Vehicle number is required.";
    if (!batteryOut.trim()) return "Old battery ID is required.";
    if (!batteryIn.trim()) return "Pick the new battery.";
    if (normalizeIdForCompare(batteryOut) === normalizeIdForCompare(batteryIn)) {
      return "The new battery must differ from the old one.";
    }
    return null;
  };

  const handleSaveSwapAndGoPayment = () => {
    const err = validateSwapForm();
    if (err) { setSubmitError(err); return; }
    setSubmitError("");
    setCurrentStep(3);
  };

  const handleVerifyAndCollect = () => {
    setPaymentError(""); setIciciQrError(""); setIciciTxnError("");
    if (!isPaid) { setPaymentVerified(true); return; }
    if (paymentMethod === "upi") {
      if (!iciciEnabled) {
        setPaymentError("ICICI gateway is disabled. Switch to Cash or set VITE_ICICI_ENABLED=true.");
        return;
      }
      setVerifyClicked(true); // triggers QR generation effect
      return;
    }
    // Cash / Card / Wallet — mark collected immediately (no online verification)
    setPaymentVerified(true);
  };

  const handleConfirmPaymentAndComplete = async () => {
    setSubmitError("");
    const err = validateSwapForm();
    if (err) { setSubmitError(err); return; }
    if (isPaid && !paymentVerified) {
      setSubmitError("Verify the payment first using 'Verify & Collect'.");
      return;
    }
    setSubmitting(true);
    try {
      const saved = await apiFetch("/api/battery-swaps", {
        method: "POST",
        body: {
          employee_uid: user?.uid || user?.email || "system",
          employee_email: user?.email || null,
          vehicle_number: vehicleNumber.trim(),
          battery_out: batteryOut.trim(),
          battery_in: batteryIn.trim(),
          swapped_at: new Date().toISOString(),
          notes: notes.trim() || null,
          swap_amount: isPaid ? totalAmount : 0,
          payment_method: isPaid ? paymentMethod : null,
          meta: {
            payment: {
              amount: totalAmount,
              fee: swapFee,
              handling: handlingCharges,
              taxes,
              method: isPaid ? paymentMethod : "none",
              vpa: paymentMethod === "upi" ? vpa.trim() || null : null,
              status: isPaid
                ? (paymentMethod === "upi" ? (paymentVerified ? "SUCCESS" : "PENDING") : "COLLECTED")
                : "NA",
              iciciMerchantTranId: iciciMerchantTranId || null,
              merchantTranId: iciciMerchantTranId || null,
            },
          },
        },
      });
      setSavedSwap(saved);
      fetchSwapList();
    } catch (e) {
      setSubmitError(String(e?.message || e || "Unable to record battery swap"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwapAnother = () => {
    setVehicleNumber(""); setBatteryOut(""); setBatteryIn(""); setNotes("");
    setPaymentMethod("upi"); setVpa(""); setPaymentVerified(false); setVerifyClicked(false);
    setIciciQrData(null); setIciciMerchantTranId(null); setIciciTxnStatus(""); setIciciQrError("");
    setSavedSwap(null); setSubmitError("");
    setRental(null); setSearchValue("");
    setCurrentStep(1);
  };

  const handleStepClick = (n) => {
    if (n === 1) return setCurrentStep(1);
    if (!rental) return;
    if (n === 2) return setCurrentStep(2);
    if (n === 3 && !validateSwapForm()) return setCurrentStep(3);
  };

  // -------------------------------------------------------------------
  // Right rail
  // -------------------------------------------------------------------

  const outStats = batteryStats(batteryOut);
  const inStats = newBatteryStats(batteryIn);

  const RiderSummaryCard = ({ variant = "default" }) => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-evegah-primary"><Receipt size={16} /></span>
        <h3 className="text-sm font-bold text-evegah-text">Rider Summary</h3>
      </div>
      {variant === "payment" ? (
        <div className="space-y-2">
          <SummaryRow label="Rider ID" value={rental?.rider_code || "—"} />
          <SummaryRow label="Mobile Number" value={rental?.rider_mobile ? `+91 ${rental.rider_mobile}` : "—"} />
          <SummaryRow
            label="KYC Status"
            value={
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5">
                <BadgeCheck size={10} /> Verified
              </span>
            }
          />
          <SummaryRow label="Security Deposit" value={formatINR(rental?.security_deposit || 500)} />
          <SummaryRow label="Wallet Balance" value={formatINR(rental?.wallet_balance || 120)} valueClass="text-evegah-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          <SummaryRow label="Total Rentals" value={rental?.total_rentals || 12} />
          <SummaryRow label="Completed Rentals" value={rental?.completed_rentals || 8} />
          <SummaryRow label="Active Rental" value="1" />
          <SummaryRow label="Security Deposit" value={formatINR(rental?.security_deposit || 500)} />
        </div>
      )}
    </div>
  );

  const CurrentBatteryCard = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-600"><Battery size={16} /></span>
        <h3 className="text-sm font-bold text-evegah-text">Current Battery Details</h3>
      </div>
      <div className="space-y-2">
        <SummaryRow label="Battery Number" value={outStats.number} />
        <SummaryRow label="Battery ID" value={outStats.number !== "—" ? `${outStats.number} (60V 30Ah)` : "—"} />
        <SummaryRow label="Charge" value={outStats.charge ? `${outStats.charge}%` : "—"} valueClass={outStats.charge < 25 ? "text-rose-600" : "text-evegah-text"} />
        <SummaryRow label="Battery Health" value={outStats.health ? `${outStats.health}%` : "—"} />
        <SummaryRow label="Battery Cycles" value={outStats.cycles || "—"} />
        <SummaryRow label="Estimated Range" value={outStats.range ? `${outStats.range} km` : "—"} />
        {outStats.charge && outStats.charge < 25 ? (
          <div className="pt-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5">
              <Zap size={10} /> Low Battery
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  const RideOverviewCard = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-evegah-primary"><Calendar size={16} /></span>
        <h3 className="text-sm font-bold text-evegah-text">Current Ride Overview</h3>
      </div>
      <div className="space-y-2">
        <SummaryRow label="Plan" value={planLabel(rental?.rental_package)} />
        <SummaryRow label="Ride Start" value={formatDateTime(rental?.start_time)} />
        <SummaryRow label="Current Vehicle" value={`${rental?.bike_model || "—"}${rental?.vehicle_number ? ` (${rental.vehicle_number})` : ""}`} />
        <SummaryRow label="Odometer" value={rental?.odometer ? `${rental.odometer} km` : "12,345 km"} />
        <SummaryRow label="Last Swap" value={allSwaps[0] ? formatDateTime(allSwaps[0].swapped_at || allSwaps[0].created_at) : "—"} />
      </div>
    </div>
  );

  const PriceBreakdownCard = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-evegah-primary"><Calendar size={16} /></span>
        <h3 className="text-sm font-bold text-evegah-text">Swap Price Breakdown</h3>
      </div>
      <div className="space-y-2">
        <SummaryRow label="Swap Service Fee" value={formatINR(swapFee)} />
        <SummaryRow label="Handling Charges" value={formatINR(handlingCharges)} />
        <SummaryRow label="Taxes" value={formatINR(taxes)} />
        <div className="pt-2 border-t border-evegah-border mt-2">
          <SummaryRow label="Total Amount" value={<span className="text-base text-evegah-primary">{formatINR(totalAmount)}</span>} />
        </div>
      </div>
    </div>
  );

  const PaymentHistoryCard = () => {
    const rentalIdStr = String(rental?.id || "");
    const history = useMemo(() => {
      const list = Array.isArray(allSwaps) ? allSwaps : [];
      const filtered = rentalIdStr
        ? list.filter((s) => String(s.rental_id || "") === rentalIdStr)
        : list;
      return filtered.slice(0, 4);
    }, [rentalIdStr]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-evegah-primary"><Calendar size={16} /></span>
            <h3 className="text-sm font-bold text-evegah-text">Payment History</h3>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-gray-500">No previous battery swap payments.</p>
        ) : (
          <ul className="space-y-2.5">
            {history.map((s) => {
              const meta = s.meta || {};
              const payment = meta.payment || {};
              const ok = String(payment.status || "").toUpperCase() === "SUCCESS"
                || String(payment.status || "").toUpperCase() === "COLLECTED";
              return (
                <li key={s.id} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 grid h-6 w-6 place-items-center rounded-full ${ok ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                    {ok ? <Check size={11} /> : <Info size={11} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-evegah-text leading-tight">{formatDateTime(s.swapped_at || s.created_at)}</p>
                    <p className="text-[11px] text-gray-500 leading-tight">
                      {(payment.method || "UPI").toUpperCase()} · {ok ? "Successful" : (payment.status || "Pending")}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-evegah-text">{formatINR(payment.amount || 0)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  const renderRightRail = () => {
    if (currentStep === 1 && !rental) {
      return (
        <>
          <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-evegah-primary"><BatteryCharging size={16} /></span>
              <h3 className="text-sm font-bold text-evegah-text">Why swap batteries?</h3>
            </div>
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" /><span>Keeps the rider on the road without delay</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" /><span>Logged against the active rental for audit</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" /><span>Pair the new battery with the same vehicle</span></li>
            </ul>
          </div>
          <NeedHelpCard />
        </>
      );
    }
    if (currentStep === 3) {
      return (
        <>
          <RiderSummaryCard variant="payment" />
          <PriceBreakdownCard />
          <PaymentHistoryCard />
          <NeedHelpCard />
        </>
      );
    }
    return (
      <>
        <RiderSummaryCard />
        <CurrentBatteryCard />
        <RideOverviewCard />
        <NeedHelpCard />
      </>
    );
  };

  // -------------------------------------------------------------------
  // Step 1 — Search Rider
  // -------------------------------------------------------------------

  const renderStep1 = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Find Rider</h2>
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
            const Icon = t.icon; const active = activeSearchTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setActiveSearchTab(t.id); setSearchValue(""); setSearchError(""); }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  active ? "border-evegah-primary text-evegah-primary bg-brand-light/30" : "border-evegah-border text-gray-600 hover:bg-gray-50"
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
            <span className="inline-flex items-center gap-1 px-3 bg-evegah-bg text-sm text-gray-600 border-r border-evegah-border">+91</span>
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
          <Search size={16} /> {searching ? "Searching…" : "Find Rider"}
        </button>
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
            type="button" onClick={() => setCurrentStep(2)}
            className="mt-4 w-full rounded-xl border-2 border-evegah-primary text-evegah-primary text-sm font-bold py-3 hover:bg-brand-light/40"
          >
            Continue to Battery Swap
          </button>
        </div>
      ) : null}
    </div>
  );

  // -------------------------------------------------------------------
  // Step 2 — New Battery Swap form + Swap List
  // -------------------------------------------------------------------

  const StatusPill = ({ status }) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed" || s === "success" || s === "successful") {
      return <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5">Completed</span>;
    }
    if (s === "pending") {
      return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5">Pending</span>;
    }
    if (s === "cancelled" || s === "failed" || s === "failure") {
      return <span className="inline-flex items-center rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold px-2 py-0.5">Cancelled</span>;
    }
    return <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5">Completed</span>;
  };

  const swapListRows = useMemo(() => visibleSwapRows.map((s, idx) => {
    const meta = s.meta || {}; const payment = meta.payment || {};
    const swapNo = `SWP${String(filteredSwaps.length - ((swapListPage - 1) * SWAP_PAGE_SIZE) - idx).padStart(5, "0")}`;
    const outPct = batteryStats(s.battery_out)?.charge || 0;
    const inPct = newBatteryStats(s.battery_in)?.charge || 100;
    return { ...s, swapNo, outPct, inPct, fee: payment.amount || DEFAULT_SWAP_FEE };
  }), [visibleSwapRows, filteredSwaps.length, swapListPage]);

  const renderStep2 = () => (
    <div className="space-y-5">
      {/* New Battery Swap form */}
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">New Battery Swap</h2>
          <p className="text-sm text-gray-500">Select a rider to auto-fill vehicle &amp; battery details.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Rider */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Select Rider <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleChangeRider}
              className="w-full inline-flex items-center justify-between gap-2 rounded-xl border border-evegah-border bg-white px-3 py-2.5 text-sm hover:border-evegah-primary"
            >
              <span className={rental ? "text-evegah-text font-semibold truncate" : "text-gray-400"}>
                {rental?.rider_full_name || "Select rider"}
              </span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>
            {rental ? (
              <p className="mt-1 text-[10px] text-gray-500 truncate">+91 {rental.rider_mobile || "—"}</p>
            ) : null}
          </div>

          {/* Vehicle */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Vehicle Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text" placeholder="Select E-bike ID"
              className="w-full rounded-xl border border-evegah-border bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-evegah-primary disabled:bg-gray-50"
              value={vehicleNumber}
              disabled={!rental}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            />
          </div>

          {/* Battery OUT */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Battery REMOVE <span className="text-rose-500">*</span>
            </label>
            <input
              type="text" placeholder="Select battery out"
              className="w-full rounded-xl border border-evegah-border bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-evegah-primary disabled:bg-gray-50"
              value={batteryOut}
              disabled={!rental}
              onChange={(e) => setBatteryOut(e.target.value.toUpperCase())}
            />
          </div>

          {/* Battery IN */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Battery ADD <span className="text-rose-500">*</span>
            </label>
            <div ref={batteryInRef} className="relative">
              <button
                type="button"
                disabled={!rental}
                onClick={() => {
                  setBatteryInDropdownOpen((v) => {
                    const next = !v;
                    if (!v && next) setTimeout(() => batteryInQueryRef.current?.focus(), 0);
                    return next;
                  });
                }}
                className="w-full inline-flex items-center justify-between gap-2 rounded-xl border border-evegah-border bg-white px-3 py-2.5 text-sm hover:border-evegah-primary disabled:bg-gray-50"
              >
                <span className={batteryIn ? "text-evegah-text font-semibold" : "text-gray-400"}>{batteryIn || "Select battery in"}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              {batteryInDropdownOpen ? (
                <div className="absolute z-30 mt-2 w-full rounded-xl border border-evegah-border bg-white shadow-lg p-2">
                  <input
                    ref={batteryInQueryRef}
                    className="w-full rounded-lg border border-evegah-border bg-white px-3 py-2 text-sm mb-2 outline-none focus:border-evegah-primary"
                    placeholder="Search battery id…"
                    value={batteryInQuery}
                    onChange={(e) => setBatteryInQuery(e.target.value)}
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
                              setBatteryIn(id); setBatteryInDropdownOpen(false); setBatteryInQuery("");
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
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (Optional)</label>
          <textarea
            rows={2}
            maxLength={300}
            placeholder="Type any notes here…"
            className="w-full rounded-xl border border-evegah-border bg-white px-3 py-2.5 text-sm outline-none focus:border-evegah-primary"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {submitError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{submitError}</div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveSwapAndGoPayment}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-6 py-2.5 text-sm font-semibold hover:opacity-95"
          >
            Save Swap <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Battery Swap List */}
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-evegah-text">Battery Swap List</h2>
            <p className="text-sm text-gray-500">View and manage all battery swap transactions.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search by rider, battery ID or vehicle…"
                value={swapListSearch}
                onChange={(e) => setSwapListSearch(e.target.value)}
                className="w-full sm:w-72 rounded-xl border border-evegah-border bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-evegah-primary"
              />
            </div>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl border border-evegah-border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Filter size={14} /> Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-evegah-border">
                <th className="px-5 sm:px-6 py-3">Swap ID</th>
                <th className="px-3 py-3">Date &amp; Time</th>
                <th className="px-3 py-3">Rider</th>
                <th className="px-3 py-3">Vehicle</th>
                <th className="px-3 py-3">Battery Out</th>
                <th className="px-3 py-3">Battery In</th>
                <th className="px-3 py-3">Swap Fee</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-5 sm:px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingSwaps ? (
                <tr><td colSpan={9} className="px-5 sm:px-6 py-10 text-center text-gray-500">Loading swaps…</td></tr>
              ) : swapListRows.length === 0 ? (
                <tr><td colSpan={9} className="px-5 sm:px-6 py-10 text-center text-gray-500">No battery swaps yet.</td></tr>
              ) : (
                swapListRows.map((row) => (
                  <tr key={row.id} className="border-b border-evegah-border/70 hover:bg-evegah-bg/40">
                    <td className="px-5 sm:px-6 py-3 font-mono text-xs text-gray-700">{row.swapNo}</td>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(row.swapped_at || row.created_at)}</td>
                    <td className="px-3 py-3 text-evegah-text font-semibold">{row.rider_full_name || "—"}</td>
                    <td className="px-3 py-3">
                      <p className="text-evegah-text font-semibold">{row.vehicle_number || "—"}</p>
                      <p className="text-[10px] text-gray-500">{row.bike_model || "—"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="font-mono font-semibold text-evegah-text">{row.battery_out}</span>
                        <span className={`inline-flex items-center rounded-full text-[10px] font-bold px-1.5 py-0.5 ${row.outPct < 25 ? "bg-rose-100 text-rose-700" : row.outPct < 60 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{row.outPct}%</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="font-mono font-semibold text-evegah-text">{row.battery_in}</span>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5">{row.inPct}%</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-evegah-text">{formatINR(row.fee)}</td>
                    <td className="px-3 py-3"><StatusPill status="completed" /></td>
                    <td className="px-5 sm:px-6 py-3 text-right">
                      <button type="button" className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-evegah-border text-gray-600 hover:bg-evegah-bg">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredSwaps.length > 0 ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
            <p className="text-xs text-gray-500">
              Showing {((swapListPage - 1) * SWAP_PAGE_SIZE) + 1} to {Math.min(filteredSwaps.length, swapListPage * SWAP_PAGE_SIZE)} of {filteredSwaps.length} entries
            </p>
            <div className="flex items-center gap-1">
              <button type="button" disabled={swapListPage <= 1} onClick={() => setSwapListPage((p) => Math.max(1, p - 1))} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-evegah-border text-gray-600 hover:bg-evegah-bg disabled:opacity-50">
                <ChevronRight size={14} className="rotate-180" />
              </button>
              {Array.from({ length: Math.min(5, swapListTotalPages) }).map((_, i) => {
                const n = i + 1;
                return (
                  <button key={n} type="button" onClick={() => setSwapListPage(n)} className={`h-8 w-8 inline-flex items-center justify-center rounded-lg text-sm font-semibold border ${swapListPage === n ? "bg-evegah-primary text-white border-evegah-primary" : "border-evegah-border text-gray-700 hover:bg-evegah-bg"}`}>
                    {n}
                  </button>
                );
              })}
              <button type="button" disabled={swapListPage >= swapListTotalPages} onClick={() => setSwapListPage((p) => Math.min(swapListTotalPages, p + 1))} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-evegah-border text-gray-600 hover:bg-evegah-bg disabled:opacity-50">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 inline-flex items-start gap-2">
        <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
        Please ensure the battery is securely locked before swap. Swap fee includes service and handling charges.
      </div>
    </div>
  );

  // -------------------------------------------------------------------
  // Step 3 — Payment
  // -------------------------------------------------------------------

  const swapDisplayId = useMemo(() => `SWP${String(hashCode(rental?.id || "new") % 100000).padStart(5, "0")}`, [rental?.id]);

  const renderStep3 = () => (
    <div className="space-y-5">
      {/* Swap Summary */}
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-evegah-text">Swap Summary</h2>
          <span className="inline-flex items-center rounded-full bg-brand-light text-evegah-primary text-[11px] font-bold px-2.5 py-1">{swapDisplayId}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
          <div><p className="text-[11px] text-gray-500 font-semibold mb-0.5">Rider</p><p className="text-sm font-bold text-evegah-text">{rental?.rider_full_name || "—"}</p></div>
          <div><p className="text-[11px] text-gray-500 font-semibold mb-0.5">Vehicle</p><p className="text-sm font-bold text-evegah-text">{rental?.bike_model || "—"} {rental?.vehicle_number ? `(${rental.vehicle_number})` : ""}</p></div>
          <div><p className="text-[11px] text-gray-500 font-semibold mb-0.5">Swap Date &amp; Time</p><p className="text-sm font-bold text-evegah-text inline-flex items-center gap-1"><Calendar size={12} className="text-evegah-primary" /> {formatDate(new Date())}, {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</p></div>
          <div><p className="text-[11px] text-gray-500 font-semibold mb-0.5">Station Operator</p><p className="text-sm font-bold text-evegah-text">{user?.displayName || user?.email || "—"}</p></div>
        </div>

        {/* Battery visual */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
          <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-600"><Battery size={22} /></span>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-rose-600">OUT (Removed)</p>
                <p className="text-base font-bold text-evegah-text">{batteryOut || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div><p className="text-[10px] text-gray-500 font-semibold">Charge</p><p className={`text-sm font-bold ${outStats.charge < 25 ? "text-rose-600" : "text-evegah-text"}`}>{outStats.charge}%</p></div>
              <div><p className="text-[10px] text-gray-500 font-semibold">Health</p><p className="text-sm font-bold text-evegah-text">{outStats.health}%</p></div>
              <div><p className="text-[10px] text-gray-500 font-semibold">Cycles</p><p className="text-sm font-bold text-evegah-text">{outStats.cycles}</p></div>
            </div>
          </div>

          <div className="hidden md:grid place-items-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-light text-evegah-primary"><ArrowRight size={18} /></span>
          </div>

          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><BatteryCharging size={22} /></span>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">IN (Installed)</p>
                <p className="text-base font-bold text-evegah-text">{batteryIn || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div><p className="text-[10px] text-gray-500 font-semibold">Charge</p><p className="text-sm font-bold text-emerald-700">{inStats.charge}%</p></div>
              <div><p className="text-[10px] text-gray-500 font-semibold">Health</p><p className="text-sm font-bold text-evegah-text">{inStats.health}%</p></div>
              <div><p className="text-[10px] text-gray-500 font-semibold">Cycles</p><p className="text-sm font-bold text-evegah-text">{inStats.cycles}</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Details */}
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-bold text-evegah-text">Payment Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-brand-light bg-brand-light/30 p-4">
            <div className="flex items-center gap-2 mb-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-evegah-primary"><Wallet size={14} /></span><p className="text-sm font-semibold text-evegah-text">Swap Fee</p></div>
            <p className="text-2xl font-bold text-evegah-text">{formatINR(swapFee)}</p>
            <p className="text-[11px] text-gray-500 mt-1">Includes service &amp; handling charges</p>
          </div>
          <div className="rounded-2xl border border-evegah-border bg-evegah-bg/40 p-4">
            <div className="flex items-center gap-2 mb-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-evegah-primary"><Receipt size={14} /></span><p className="text-sm font-semibold text-evegah-text">Taxes &amp; Charges</p></div>
            <p className="text-2xl font-bold text-evegah-text">{formatINR(taxes + handlingCharges)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{taxes + handlingCharges === 0 ? "No additional taxes" : "GST inclusive"}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 mb-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-emerald-600"><BadgeCheck size={14} /></span><p className="text-sm font-semibold text-evegah-text">Total Amount</p></div>
            <p className="text-2xl font-bold text-evegah-text">{formatINR(totalAmount)}</p>
            <p className="text-[11px] text-gray-500 mt-1">Amount to be collected</p>
          </div>
        </div>

        {/* Method tiles */}
        <div>
          <p className="text-sm font-bold text-evegah-text mb-3">Select Payment Method</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PAYMENT_METHODS.map((m) => {
              const Icon = m.icon; const active = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m.id); setPaymentVerified(false); setVerifyClicked(false);
                    setIciciQrData(null); setIciciMerchantTranId(null); setIciciTxnStatus("");
                  }}
                  className={`relative rounded-2xl border p-3 text-left transition-colors ${active ? "border-evegah-primary bg-brand-light/30 shadow-sm" : "border-evegah-border bg-white hover:bg-gray-50"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-evegah-primary text-white" : "bg-brand-light text-evegah-primary"}`}>
                      <Icon size={14} />
                    </span>
                    <div>
                      <p className={`text-sm font-bold ${active ? "text-evegah-primary" : "text-evegah-text"}`}>{m.label}</p>
                      <p className="text-[10px] text-gray-500">{m.description}</p>
                    </div>
                  </div>
                  {active ? <span className="absolute top-2 right-2 grid h-5 w-5 place-items-center rounded-full bg-evegah-primary text-white"><Check size={12} /></span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment input area per method */}
        {paymentMethod === "upi" ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">UPI ID / VPA</label>
                <input
                  type="text"
                  placeholder="Enter UPI ID (e.g., amit@paytm, 9876543210@ybl)"
                  className="w-full rounded-xl border border-evegah-border bg-white px-4 py-2.5 text-sm outline-none focus:border-evegah-primary"
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value)}
                />
              </div>
              <div className="self-end">
                <button
                  type="button"
                  onClick={handleVerifyAndCollect}
                  disabled={paymentVerified || (isPaid && verifyClicked && !paymentVerified && iciciQrLoading)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60 whitespace-nowrap"
                >
                  {paymentVerified ? <><CheckCircle2 size={14} /> Payment Verified</> : <><Sparkles size={14} /> Verify &amp; Collect</>}
                </button>
              </div>
            </div>

            {/* QR + Status */}
            {verifyClicked ? (
              <div className="rounded-xl border border-evegah-border bg-evegah-bg/40 p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="shrink-0">
                  {iciciQrLoading ? (
                    <div className="h-40 w-40 rounded-xl border border-evegah-border bg-white grid place-items-center text-xs text-gray-500">Generating QR…</div>
                  ) : iciciQrData?.qrImage || iciciQrData?.qr_image ? (
                    <img src={iciciQrData.qrImage || iciciQrData.qr_image} alt="ICICI Payment QR" className="h-40 w-40 rounded-xl border border-evegah-border bg-white p-2" />
                  ) : iciciQrData?.qrString ? (
                    <div className="rounded-xl border border-evegah-border bg-white p-2"><QRCodeCanvas value={iciciQrData.qrString} size={150} /></div>
                  ) : (
                    <div className="h-40 w-40 rounded-xl border border-dashed border-evegah-border bg-white grid place-items-center text-xs text-gray-400 px-3 text-center">QR not available</div>
                  )}
                </div>
                <div className="flex-1 text-sm space-y-2 min-w-0">
                  <p className="font-bold text-evegah-text">Scan to pay {formatINR(totalAmount)}</p>
                  <p className="text-xs text-gray-500">Ask the rider to scan with any UPI app. The swap will be unlocked once the bank confirms the payment.</p>
                  {iciciMerchantTranId ? <p className="text-[11px] text-gray-500">Ref: <span className="font-mono">{iciciMerchantTranId}</span></p> : null}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Status:</span>
                    {paymentVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5"><CheckCircle2 size={11} /> SUCCESS</span>
                    ) : iciciTxnStatus ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5">{iciciTxnStatus}</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold px-2 py-0.5">Waiting for payment…</span>
                    )}
                  </div>
                  {iciciQrError ? <p className="text-xs text-rose-600">{iciciQrError}</p> : null}
                  {iciciTxnError ? <p className="text-xs text-rose-600">{iciciTxnError}</p> : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex flex-wrap items-center gap-3">
            <Info size={14} className="text-blue-600 shrink-0" />
            <span className="flex-1">
              {paymentMethod === "cash"
                ? `Collect ${formatINR(totalAmount)} in cash from the rider.`
                : paymentMethod === "card"
                  ? `Collect ${formatINR(totalAmount)} via the card terminal.`
                  : `Charge ${formatINR(totalAmount)} to the rider's wallet.`}
            </span>
            <button
              type="button"
              onClick={handleVerifyAndCollect}
              disabled={paymentVerified}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-4 py-2 text-xs font-semibold hover:opacity-95 disabled:opacity-60"
            >
              {paymentVerified ? <><CheckCircle2 size={12} /> Collected</> : <>Mark as Collected</>}
            </button>
          </div>
        )}

        {paymentError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{paymentError}</div>
        ) : null}

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 inline-flex items-start gap-2">
          <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
          After successful payment, the battery swap will be marked as completed.
        </div>
      </div>

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
          <button type="button" onClick={handleSwapAnother} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-evegah-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-95">
            <Plus size={14} /> Swap Another
          </button>
        </div>
      ) : null}
    </div>
  );

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <EmployeeLayout>
      <div className="w-full space-y-5">
        {/* Title */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-evegah-text">
              {currentStep === 3 ? "Payment" : "Battery Swap"}
            </h1>
            <p className="text-sm text-gray-500">
              {currentStep === 3
                ? "Collect payment and complete the battery swap."
                : "Create and complete a battery swap request."}
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-4 sm:p-5">
          <HorizontalStepper current={currentStep} onStepClick={handleStepClick} />
        </div>

        {/* Main + rail */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div className="min-w-0 space-y-5">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            {/* Bottom action bar — only on step 3 (steps 1 & 2 have their own CTAs) */}
            {currentStep === 3 ? (
              <div className="bg-white border border-evegah-border rounded-2xl shadow-card px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <button
                  type="button"
                  onClick={handleConfirmPaymentAndComplete}
                  disabled={submitting || Boolean(savedSwap) || (isPaid && !paymentVerified)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : savedSwap ? "Completed" : <>Confirm Payment &amp; Complete <CheckCircle2 size={14} /></>}
                </button>
              </div>
            ) : currentStep === 2 ? (
              <div className="bg-white border border-evegah-border rounded-2xl shadow-card px-5 py-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveSwapAndGoPayment}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95"
                >
                  Continue to Payment <ArrowRight size={14} />
                </button>
              </div>
            ) : null}
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24">
            {renderRightRail()}
          </aside>
        </div>
      </div>
    </EmployeeLayout>
  );
}
