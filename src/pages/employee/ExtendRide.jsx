import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  IdCard,
  Info,
  LifeBuoy,
  MessageCircle,
  Phone,
  QrCode,
  Receipt,
  RefreshCw,
  RotateCw,
  Search,
  Smartphone,
  TimerReset,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import EmployeeLayout from "../../components/layouts/EmployeeLayout";
import { apiFetch } from "../../config/api";
import { formatRentalId } from "../../utils/entityId";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 1, title: "Search Rider" },
  { key: 2, title: "Extend Details" },
  { key: 3, title: "Payment & Confirm" },
];

const TOP_TABS = [
  { id: "extend", label: "Extend Ride", icon: TimerReset, route: "/employee/extend-ride" },
  { id: "return", label: "Return Vehicle", icon: RotateCw, route: "/employee/return-vehicle" },
  { id: "exchange", label: "Exchange Vehicle", icon: RefreshCw, route: "/employee/exchange-vehicle" },
];

const SEARCH_TABS = [
  { id: "mobile", label: "Mobile Number", icon: Phone },
  { id: "name", label: "Rider Name", icon: IdCard },
  { id: "vehicle", label: "Vehicle ID", icon: Receipt },
];

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI", desc: "Pay using any UPI app", icon: Smartphone },
  { id: "cash", label: "Cash", desc: "Accept cash payment", icon: Wallet },
  { id: "wallet", label: "Wallet", desc: "Deduct from rider wallet", icon: CreditCard },
  { id: "deposit", label: "Deposit Adjust", desc: "Adjust from deposit", icon: BadgeCheck },
];

// Daily rates per plan (used when rental_amount isn't a usable per-day number).
const PLAN_DAILY_FALLBACK = { hourly: 200, daily: 600, weekly: 500, monthly: 400 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sanitizeNumericInput = (value, maxLength) =>
  String(value || "").replace(/\D/g, "").slice(0, maxLength);

const formatINR = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const formatDurationMs = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalMin = Math.round(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 1440) / 60);
  const mins = totalMin - days * 1440 - hours * 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(" ");
};

const initialsFrom = (name) => {
  const parts = String(name || "").trim().split(/\s+/);
  if (!parts[0]) return "??";
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

const toDateInput = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (v) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const toTimeInput = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

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
            <button
              type="button"
              onClick={() => onStepClick?.(s.key)}
              className="flex items-start gap-3 text-left min-w-0 group"
            >
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
      <p className="mt-1 text-xs text-gray-500">Facing issues with extend ride?</p>
      <Link
        to="/employee/support"
        className="mt-3 inline-flex items-center justify-center w-full rounded-xl border border-evegah-primary px-3 py-2 text-xs font-semibold text-evegah-primary hover:bg-brand-light/40"
      >
        Contact Support
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ExtendRide() {
  const navigate = useNavigate();

  // --- Wizard ---
  const [currentStep, setCurrentStep] = useState(1);

  // --- Search ---
  const [activeSearchTab, setActiveSearchTab] = useState("mobile");
  const [searchValue, setSearchValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [rental, setRental] = useState(null);
  const [rentalDisplayId, setRentalDisplayId] = useState("");

  // --- Extension details ---
  const [newReturnDate, setNewReturnDate] = useState("");
  const [newReturnTime, setNewReturnTime] = useState("");

  // --- Payment ---
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [paymentUpiId, setPaymentUpiId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentCollected, setPaymentCollected] = useState(false);
  const [paymentTime, setPaymentTime] = useState(null);

  // --- Submit ---
  const [confirmAccepted, setConfirmAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Load rentalDisplayId once we have a rental
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
        const index = sorted.findIndex((r) => String(r?.id || "") === String(rentalId));
        if (index >= 0) setRentalDisplayId(`EVR-${index === 0 ? "NR" : "RR"}_${index + 1}`);
      })
      .catch(() => { if (alive) setRentalDisplayId(""); });
    return () => { alive = false; };
  }, [rental?.rider_id, rental?.id]);

  // Default new return date/time when rental loads
  useEffect(() => {
    if (!rental) return;
    const baseRaw = rental.rental_end || rental.expected_end_time || rental.start_time;
    const base = baseRaw ? new Date(baseRaw) : new Date();
    const def = new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 days
    setNewReturnDate(toDateInput(def));
    setNewReturnTime(toTimeInput(base));
  }, [rental?.id, rental?.rental_end]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Computed ---
  const currentExpectedReturn = rental?.rental_end || rental?.expected_end_time || null;
  const currentExpectedReturnMs = currentExpectedReturn ? new Date(currentExpectedReturn).getTime() : null;

  const newReturnAt = useMemo(() => {
    if (!newReturnDate || !newReturnTime) return null;
    const d = new Date(`${newReturnDate}T${newReturnTime}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [newReturnDate, newReturnTime]);

  const extensionMs = (newReturnAt && currentExpectedReturnMs)
    ? Math.max(0, newReturnAt.getTime() - currentExpectedReturnMs)
    : 0;

  const extensionDays = Math.max(0, Math.ceil(extensionMs / (24 * 60 * 60 * 1000)));

  const dailyRate = useMemo(() => {
    const rentalAmount = Number(rental?.rental_amount || 0);
    const plan = String(rental?.rental_package || "daily").toLowerCase();
    if (rentalAmount > 0) {
      if (plan === "monthly") return Math.round(rentalAmount / 30);
      if (plan === "weekly") return Math.round(rentalAmount / 7);
      if (plan === "daily") return rentalAmount;
      if (plan === "hourly") return rentalAmount * 12; // crude
    }
    return PLAN_DAILY_FALLBACK[plan] || 600;
  }, [rental?.rental_amount, rental?.rental_package]);

  const extraChargesPreTax = extensionDays * dailyRate;
  const gst = Math.round(extraChargesPreTax * 0.18);
  const extraChargesInclTax = extraChargesPreTax + gst;

  // Late fee — overdue from current expected return up to now
  const now = useMemo(() => new Date(), [rental?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const lateMins = (currentExpectedReturnMs && now.getTime() > currentExpectedReturnMs)
    ? Math.ceil((now.getTime() - currentExpectedReturnMs) / 60000)
    : 0;
  const lateFee = lateMins > 0 ? Math.max(10, Math.ceil(lateMins / 10) * 10) : 0;

  const totalPayable = extraChargesInclTax + lateFee;

  // ---------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------

  const handleSearch = async () => {
    setSearchError(""); setSubmitError(""); setSubmitted(false);
    const v = String(searchValue || "").trim();
    if (!v) { setSearchError("Enter a search value."); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (activeSearchTab === "mobile") params.set("mobile", sanitizeNumericInput(v, 10));
      else if (activeSearchTab === "vehicle") params.set("vehicle", v);
      else params.set("name", v);
      const found = await apiFetch(`/api/rentals/active?${params.toString()}`);
      if (!found) { setSearchError("No active rental found."); setRental(null); return; }
      setRental(found);
    } catch (e) {
      setSearchError(String(e?.message || e || "Unable to search active rental"));
      setRental(null);
    } finally { setSearching(false); }
  };

  const handleSelectRental = () => setCurrentStep(2);

  // ---------------------------------------------------------------------
  // Step nav
  // ---------------------------------------------------------------------

  const goPrev = () => setCurrentStep((s) => Math.max(1, s - 1));

  const handleCollectPayment = () => {
    setSubmitError("");
    if (!rental?.id) return setSubmitError("No active rental selected.");
    if (!newReturnAt) return setSubmitError("Pick a valid new return date and time.");
    if (extensionMs <= 0) return setSubmitError("New return time must be after the current expected return.");
    if (totalPayable > 0) {
      if (paymentMethod === "upi") {
        if (!paymentUpiId.trim()) return setSubmitError("Enter the UPI ID used for payment.");
        if (!transactionId.trim()) return setSubmitError("Enter the UPI transaction ID.");
      }
    }
    setPaymentCollected(true);
    setPaymentTime(new Date());
    setCurrentStep(3);
  };

  const handleConfirmExtension = async () => {
    setSubmitError("");
    if (!rental?.id || !newReturnAt) return;
    if (!confirmAccepted) return setSubmitError("Confirm you've collected payment.");
    setSubmitting(true);
    try {
      const prevMeta = (rental?.meta && typeof rental.meta === "object") ? rental.meta : {};
      const extensionEntry = {
        previous_expected_return: currentExpectedReturn,
        new_expected_return: newReturnAt.toISOString(),
        extension_days: extensionDays,
        extra_charges_incl_tax: extraChargesInclTax,
        late_fee: lateFee,
        total_payable: totalPayable,
        payment_method: paymentMethod,
        ...(paymentMethod === "upi" ? { upi_id: paymentUpiId, transaction_id: transactionId } : {}),
        collected_at: paymentTime?.toISOString() || new Date().toISOString(),
      };
      const extensions = Array.isArray(prevMeta.extensions) ? [...prevMeta.extensions, extensionEntry] : [extensionEntry];

      await apiFetch(`/api/rentals/${encodeURIComponent(rental.id)}`, {
        method: "PATCH",
        body: {
          expected_end_time: newReturnAt.toISOString(),
          meta: { ...prevMeta, extensions },
        },
      });

      setSubmitted(true);
      setRental((prev) => prev ? { ...prev, rental_end: newReturnAt.toISOString(), expected_end_time: newReturnAt.toISOString() } : prev);
    } catch (e) {
      setSubmitError(String(e?.message || e || "Unable to apply extension"));
    } finally { setSubmitting(false); }
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
        <SummaryRow label="Total Rides" value={rental?.total_rides ?? "—"} />
        <SummaryRow label="Completed Rides" value={rental?.completed_rides ?? "—"} />
        <SummaryRow label="Pending Rides" value={rental?.pending_rides ?? "—"} />
        <SummaryRow label="Rental Plan" value={planLabel(rental?.rental_package)} />
      </div>
    </div>
  );

  const RideSummaryCard = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={16} className="text-evegah-primary" />
        <h3 className="text-sm font-bold text-evegah-text">Ride Summary</h3>
      </div>
      <div className="space-y-2">
        <SummaryRow label="Ride Start" value={formatDateTime(rental?.start_time)} />
        <SummaryRow label={submitted ? "New Expected Return" : "Current Expected Return"} value={formatDateTime(submitted ? newReturnAt : currentExpectedReturn)} />
        {currentStep >= 2 && !submitted ? <SummaryRow label="New Expected Return" value={formatDateTime(newReturnAt)} valueClass="text-evegah-primary" /> : null}
        <SummaryRow label="Ride Duration" value={rental?.start_time && (submitted ? newReturnAt : currentExpectedReturn) ? formatDurationMs((submitted ? newReturnAt.getTime() : (currentExpectedReturnMs || Date.now())) - new Date(rental.start_time).getTime()) : "—"} />
        {currentStep >= 2 && extensionDays > 0 ? <SummaryRow label="Extension Duration" value={`${extensionDays} Day${extensionDays === 1 ? "" : "s"}`} /> : null}
        <SummaryRow label="Plan" value={planLabel(rental?.rental_package)} />
        <SummaryRow label="Security Deposit" value={formatINR(rental?.deposit_amount || 0)} />
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-evegah-border">
          <span className="text-sm text-gray-500">Status</span>
          <span className="inline-flex items-center rounded-full bg-brand-light text-evegah-primary text-[11px] font-semibold px-2 py-0.5">
            {submitted ? "Extended" : "Active"}
          </span>
        </div>
      </div>
    </div>
  );

  const QuickActionsCard = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={16} className="text-evegah-primary" />
        <h3 className="text-sm font-bold text-evegah-text">Quick Actions</h3>
      </div>
      <div className="space-y-2">
        <button type="button" className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-evegah-border text-evegah-text px-3 py-2.5 text-sm font-semibold hover:bg-gray-50">
          <Eye size={14} /> View Ride Details
        </button>
        <a
          href={rental?.rider_mobile ? `tel:${rental.rider_mobile}` : "#"}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-evegah-border text-evegah-text px-3 py-2.5 text-sm font-semibold hover:bg-gray-50"
        >
          <Phone size={14} /> Call Rider
        </a>
        <a
          href={rental?.rider_mobile ? `https://wa.me/91${String(rental.rider_mobile).replace(/\D/g, "")}` : "#"}
          target="_blank" rel="noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-evegah-border text-evegah-text px-3 py-2.5 text-sm font-semibold hover:bg-gray-50"
        >
          <MessageCircle size={14} /> Chat with Rider
        </a>
      </div>
    </div>
  );

  const renderRightRail = () => {
    if (!rental) {
      return (
        <>
          <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 text-center">
            <p className="text-sm font-semibold text-evegah-text">Rider Summary</p>
            <p className="mt-1 text-xs text-gray-500">Search a rider to see their summary here.</p>
          </div>
          <NeedHelpCard />
        </>
      );
    }
    return (
      <>
        <RiderSummary />
        <RideSummaryCard />
        <QuickActionsCard />
        <NeedHelpCard />
      </>
    );
  };

  // ---------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------

  const renderRiderInfoCard = () => {
    if (!rental) return null;
    return (
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Rider Information</p>
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
              <p className="text-xs text-gray-500 inline-flex items-center gap-1"><Phone size={11} /> +91 {rental.rider_mobile || "—"}</p>
              <p className="text-xs text-gray-500">Rider ID: {rental.rider_code || "—"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs flex-1">
            <SummaryRow label="Ride ID" value={rentalDisplayId || formatRentalId(rental.id)} />
            <SummaryRow label="Ride Start Time" value={formatDateTime(rental.start_time)} />
            <SummaryRow label="Current Plan" value={planLabel(rental.rental_package)} />
            <SummaryRow label="Vehicle" value={rental.vehicle_number || rental.bike_id || "—"} />
            <SummaryRow label="Expected Return" value={formatDateTime(currentExpectedReturn)} />
            <SummaryRow label="Deposit Amount" value={formatINR(rental.deposit_amount || 0)} />
            <SummaryRow label="Battery" value={rental.current_battery_id || rental.battery_id || "—"} />
            <SummaryRow
              label="Ride Status"
              value={<span className="inline-flex items-center rounded-full bg-brand-light text-evegah-primary text-[11px] font-semibold px-2 py-0.5">Active</span>}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Search Rider</h2>
          <p className="text-sm text-gray-500">Find an active rental to extend.</p>
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
          <Search size={16} /> {searching ? "Searching…" : "Search Rider"}
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
                <p className="text-gray-500 font-semibold mb-0.5">Ride Start</p>
                <p className="text-evegah-text">{formatDateTime(rental.start_time)}</p>
                <p className="text-gray-500 font-semibold mt-2">Expected Return</p>
                <p className="text-evegah-text">{formatDateTime(currentExpectedReturn)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-semibold mb-0.5">Plan</p>
                <p className="text-evegah-text">{planLabel(rental.rental_package)}</p>
                <p className="text-gray-500 font-semibold mt-2">Security Deposit</p>
                <p className="text-evegah-text font-bold">{formatINR(rental.deposit_amount || 0)}</p>
              </div>
            </div>
          </div>
          <button
            type="button" onClick={handleSelectRental}
            className="mt-4 w-full rounded-xl border-2 border-evegah-primary text-evegah-primary text-sm font-bold py-3 hover:bg-brand-light/40"
          >
            Select This Rider
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      {renderRiderInfoCard()}

      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Extend Ride Details</h2>
          <p className="text-sm text-gray-500">Update the new return date and time.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Current Expected Return</label>
            <div className="rounded-xl border border-evegah-border bg-evegah-bg/40 px-4 py-3 text-sm text-evegah-text inline-flex items-center gap-2 w-full">
              <Calendar size={14} className="text-gray-400" />
              {formatDateTime(currentExpectedReturn)}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">New Expected Return Date *</label>
            <div className="flex items-center rounded-xl border border-evegah-border bg-white overflow-hidden">
              <span className="px-3 text-gray-400"><Calendar size={14} /></span>
              <input
                type="date" className="flex-1 px-1 py-3 text-sm outline-none"
                value={newReturnDate}
                onChange={(e) => setNewReturnDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">New Expected Return Time *</label>
            <div className="flex items-center rounded-xl border border-evegah-border bg-white overflow-hidden">
              <span className="px-3 text-gray-400"><Clock size={14} /></span>
              <input
                type="time" className="flex-1 px-1 py-3 text-sm outline-none"
                value={newReturnTime}
                onChange={(e) => setNewReturnTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 inline-flex items-start gap-2">
          <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
          Extension will be applied from the current expected return time.
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-evegah-border p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Extension Duration</p>
            <p className="text-xl font-bold text-evegah-text mt-1">{extensionDays} {extensionDays === 1 ? "Day" : "Days"}</p>
          </div>
          <div className="rounded-2xl border border-evegah-border p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Extra Charges (Incl. tax)</p>
            <p className="text-xl font-bold text-evegah-text mt-1">{formatINR(extraChargesInclTax)}</p>
          </div>
          <div className="rounded-2xl border border-evegah-border p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Late Fee Pending</p>
            <p className={`text-xl font-bold mt-1 ${lateFee > 0 ? "text-rose-600" : "text-evegah-text"}`}>{formatINR(lateFee)}</p>
          </div>
          <div className="rounded-2xl border-2 border-evegah-primary bg-brand-light/30 p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-evegah-primary">Total Payable</p>
            <p className="text-xl font-bold text-evegah-primary mt-1">{formatINR(totalPayable)}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-evegah-text mb-2">Payment Method</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {PAYMENT_METHODS.map((m) => {
              const Icon = m.icon;
              const active = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`relative text-left rounded-2xl border p-3 transition-colors ${
                    active ? "border-evegah-primary bg-brand-light/30 shadow-card" : "border-evegah-border hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-evegah-primary text-white" : "bg-brand-light text-evegah-primary"}`}>
                      <Icon size={16} />
                    </span>
                    <p className="text-sm font-semibold text-evegah-text">{m.label}</p>
                  </div>
                  <p className="text-[11px] text-gray-500">{m.desc}</p>
                  {active ? <CheckCircle2 size={14} className="absolute top-2 right-2 text-evegah-primary" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* UPI payment details (visible when UPI is selected and total > 0) */}
        {paymentMethod === "upi" && totalPayable > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Rider UPI ID</label>
              <input
                type="text" placeholder="amitkumar@upi"
                className="w-full px-4 py-3 text-sm rounded-xl border border-evegah-border bg-white outline-none focus:border-evegah-primary"
                value={paymentUpiId}
                onChange={(e) => setPaymentUpiId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">UPI Transaction ID</label>
              <input
                type="text" placeholder="UPI13456789012"
                className="w-full px-4 py-3 text-sm rounded-xl border border-evegah-border bg-white outline-none focus:border-evegah-primary"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {submitError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{submitError}</div>
        ) : null}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5">
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Payment &amp; Confirmation</h2>
          <p className="text-sm text-gray-500">Review payment details and confirm the extension.</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 inline-flex items-start gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          Extension details updated. Please collect payment and confirm the extension.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Payment Breakup */}
          <div className="rounded-2xl border border-evegah-border p-4">
            <h3 className="text-sm font-bold text-evegah-text mb-3">Payment Breakup</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-gray-600">Extra Charges ({extensionDays} {extensionDays === 1 ? "Day" : "Days"})</span>
                <span className="font-semibold text-evegah-text">{formatINR(extraChargesInclTax)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-gray-600">Late Fee Pending</span>
                <span className={`font-semibold ${lateFee > 0 ? "text-rose-600" : "text-evegah-text"}`}>{formatINR(lateFee)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-gray-600">Discount</span>
                <span className="font-semibold text-evegah-text">{formatINR(0)}</span>
              </div>
              <div className="pt-2 border-t border-evegah-border flex items-baseline justify-between">
                <span className="font-bold text-evegah-text">Total Payable</span>
                <span className="font-bold text-evegah-primary text-base">{formatINR(totalPayable)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method confirmation */}
          <div className="rounded-2xl border border-evegah-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-evegah-text">Payment Method</h3>
              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2 py-0.5">Paid</span>
            </div>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Method" value={(PAYMENT_METHODS.find((m) => m.id === paymentMethod) || {}).label || paymentMethod.toUpperCase()} />
              {paymentMethod === "upi" ? (
                <>
                  <SummaryRow label="UPI ID" value={paymentUpiId || "—"} />
                  <SummaryRow label="Transaction ID" value={transactionId || "—"} />
                </>
              ) : null}
              <SummaryRow label="Payment Date & Time" value={formatDateTime(paymentTime || new Date())} />
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center justify-between mt-2">
                <span className="text-sm text-emerald-800 inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" /> Payment Successful
                </span>
                <span className="text-sm font-bold text-emerald-700">{formatINR(totalPayable)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Extension confirmation card */}
        <div className="rounded-2xl border border-evegah-border p-4">
          <h3 className="text-sm font-bold text-evegah-text mb-3">Extension Confirmation</h3>
          <p className="text-xs text-gray-500 mb-3">Please confirm to apply extension for the ride.</p>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-emerald-800 inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" /> Extension will be applied for the following:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <SummaryRow label="New Expected Return" value={formatDateTime(newReturnAt)} />
              <SummaryRow label="Extension Duration" value={`${extensionDays} ${extensionDays === 1 ? "Day" : "Days"}`} />
              <SummaryRow label="Total Payable" value={formatINR(totalPayable)} />
              <SummaryRow label="Payment Status" value="Paid" valueClass="text-emerald-700" />
            </div>
          </div>
        </div>

        <label className="flex items-start gap-2 rounded-xl border border-evegah-border bg-white px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 accent-evegah-primary"
            checked={confirmAccepted}
            onChange={(e) => setConfirmAccepted(e.target.checked)}
          />
          <span className="text-sm text-evegah-text">I have collected the payment and confirmed the extension details.</span>
        </label>

        {submitError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{submitError}</div>
        ) : null}

        {submitted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 inline-flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-800">
              Extension applied. New return time: {formatDateTime(newReturnAt)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------

  return (
    <EmployeeLayout>
      <div className="w-full space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-evegah-text">Ride Operations</h1>
          <p className="text-sm text-gray-500">Manage return, extend and exchange requests</p>
        </div>

        {/* Top tabs */}
        <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-1.5 flex">
          {TOP_TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === "extend";
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => !active && navigate(t.route)}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-brand-light/30 text-evegah-primary border-b-2 border-evegah-primary"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Stepper */}
        <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-4 sm:p-5">
          <HorizontalStepper current={currentStep} onStepClick={(n) => { if (n === 1) return setCurrentStep(1); if (!rental) return; if (n <= 2 || paymentCollected) setCurrentStep(n); }} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div className="min-w-0 space-y-5">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            <div className="bg-white border border-evegah-border rounded-2xl shadow-card px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={currentStep === 1 ? () => navigate(-1) : goPrev}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
              >
                <ArrowLeft size={14} /> Back
              </button>

              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={() => rental ? handleSelectRental() : handleSearch()}
                  disabled={searching}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  {rental ? "Next: Extend Details" : (searching ? "Searching…" : "Search")} <ArrowRight size={14} />
                </button>
              ) : currentStep === 2 ? (
                <button
                  type="button"
                  onClick={handleCollectPayment}
                  disabled={!newReturnAt || extensionMs <= 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  Collect Payment <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmExtension}
                  disabled={submitting || submitted || !confirmAccepted}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  <Check size={14} /> {submitting ? "Confirming…" : submitted ? "Extension Applied" : "Confirm Extension"}
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
