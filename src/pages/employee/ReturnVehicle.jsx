import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Battery,
  Bike,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  Hash,
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
  TimerReset,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import EmployeeLayout from "../../components/layouts/EmployeeLayout";
import { apiFetch } from "../../config/api";
import { formatRentalId } from "../../utils/entityId";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 1, title: "Search Rider" },
  { key: 2, title: "Vehicle Inspection" },
  { key: 3, title: "Settlement" },
  { key: 4, title: "Return Confirmation" },
];

const TOP_TABS = [
  { id: "extend", label: "Extend Ride", icon: TimerReset, route: "/employee/extend-ride" },
  { id: "return", label: "Return Vehicle", icon: RotateCw, route: "/employee/return-vehicle" },
  { id: "exchange", label: "Exchange Vehicle", icon: RefreshCw, route: "/employee/exchange-vehicle" },
];

const SEARCH_TABS = [
  { id: "mobile", label: "Mobile Number", icon: Phone },
  { id: "name", label: "Rider Name", icon: IdCard },
  { id: "vehicle", label: "Vehicle ID", icon: Bike },
];

const PHOTO_SLOTS = [
  { key: "front", label: "Front View" },
  { key: "left", label: "Left Side View" },
  { key: "right", label: "Right Side View" },
  { key: "rear", label: "Rear View" },
  { key: "odometer", label: "Odometer Photo" },
  { key: "battery", label: "Battery Photo" },
];

const CONDITION_GROUPS = [
  { key: "body", label: "Body Scratch / Damage", options: ["No Damage", "Minor", "Major"], default: "No Damage" },
  { key: "tyres", label: "Tyres Condition", options: ["Good", "Worn Out", "Damaged"], default: "Good" },
  { key: "cleanliness", label: "Vehicle Cleanliness", options: ["Clean", "Average", "Dirty"], default: "Clean" },
  { key: "battery", label: "Battery Condition", options: ["Good", "Issue Found"], default: "Good" },
];

const RETURNED_ITEMS = [
  { key: "charger", label: "Charger Returned" },
  { key: "helmet", label: "Helmet Returned" },
  { key: "key", label: "Key Returned" },
  { key: "documents", label: "Documents Returned" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sanitizeNumericInput = (value, maxLength) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, maxLength);

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
  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const mins = totalMinutes - days * 60 * 24 - hours * 60;
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

const statusFor = (current, step) => {
  if (step < current) return "completed";
  if (step === current) return "in_progress";
  return "pending";
};
const STATUS_TEXT = { completed: "Completed", in_progress: "In Progress", pending: "Pending" };
const STATUS_COLOR = {
  completed: "text-emerald-600",
  in_progress: "text-evegah-primary",
  pending: "text-gray-400",
};

// ---------------------------------------------------------------------------
// Shell pieces
// ---------------------------------------------------------------------------

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
            <button
              type="button"
              onClick={() => onStepClick?.(s.key)}
              className="flex items-start gap-3 text-left min-w-0 group"
            >
              <span className={`h-9 w-9 rounded-full border-2 grid place-items-center text-sm font-bold shrink-0 transition-colors ${circleClass}`}>
                {isComplete ? <Check size={16} /> : s.key}
              </span>
              <span className="flex flex-col min-w-0 leading-tight">
                <span className={`text-sm font-semibold ${labelClass} group-hover:text-evegah-primary truncate`}>
                  {s.title}
                </span>
                <span className={`text-xs ${STATUS_COLOR[status]} inline-flex items-center gap-1`}>
                  {STATUS_TEXT[status]}
                  {isComplete ? <Check size={11} /> : null}
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

function NeedHelpCard() {
  return (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 text-center">
      <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-evegah-primary text-white">
        <LifeBuoy size={18} />
      </div>
      <p className="text-sm font-semibold text-evegah-text">Need Help?</p>
      <p className="mt-1 text-xs text-gray-500">Facing issues with return?</p>
      <Link
        to="/employee/support"
        className="mt-3 inline-flex items-center justify-center w-full rounded-xl border border-evegah-primary px-3 py-2 text-xs font-semibold text-evegah-primary hover:bg-brand-light/40"
      >
        Contact Support
      </Link>
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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ReturnVehicle() {
  const navigate = useNavigate();

  // Wizard step
  const [currentStep, setCurrentStep] = useState(1);

  // --- Search ---
  const [activeSearchTab, setActiveSearchTab] = useState("mobile");
  const [searchValue, setSearchValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [rental, setRental] = useState(null);
  const [rentalDisplayId, setRentalDisplayId] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);

  // --- Inspection ---
  const [photos, setPhotos] = useState({}); // { front: File[], left: File[], ... }
  const [extraPhotos, setExtraPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const [condition, setCondition] = useState({
    body: "No Damage",
    tyres: "Good",
    cleanliness: "Clean",
    battery: "Good",
  });
  const [returnedItems, setReturnedItems] = useState({
    charger: true,
    helmet: true,
    key: true,
    documents: true,
  });
  const [inspectionNotes, setInspectionNotes] = useState("");

  // --- Settlement ---
  const [chargeScratch, setChargeScratch] = useState(0);
  const [chargeCleaning, setChargeCleaning] = useState(0);
  const [chargeOther, setChargeOther] = useState(0);
  const [refundMethod, setRefundMethod] = useState("upi"); // 'upi' | 'bank'
  const [refundUpiId, setRefundUpiId] = useState("");
  const [refundBankAccount, setRefundBankAccount] = useState("");
  const [refundBankIFSC, setRefundBankIFSC] = useState("");
  const [refundVerified, setRefundVerified] = useState(false);
  const [settlementNotes, setSettlementNotes] = useState("");

  // --- Confirmation ---
  const [confirmAccepted, setConfirmAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // --- Auto-calc overdue charge ---
  const [overdueCharge, setOverdueCharge] = useState(0);
  const [overdueMinutes, setOverdueMinutes] = useState(0);

  // Active rental → load rentalDisplayId
  useEffect(() => {
    const riderId = rental?.rider_id;
    const rentalId = rental?.id;
    if (!riderId || !rentalId) { setRentalDisplayId(""); return; }
    let mounted = true;
    apiFetch(`/api/riders/${encodeURIComponent(riderId)}/rentals`)
      .then((rows) => {
        if (!mounted) return;
        const list = Array.isArray(rows) ? rows : [];
        const sorted = [...list].sort((a, b) => Date.parse(a?.start_time || "") - Date.parse(b?.start_time || ""));
        const index = sorted.findIndex((r) => String(r?.id || "") === String(rentalId));
        if (index >= 0) {
          const seq = index + 1;
          const type = seq === 1 ? "NR" : "RR";
          setRentalDisplayId(`EVR-${type}_${seq}`);
        }
      })
      .catch(() => { if (mounted) setRentalDisplayId(""); });
    return () => { mounted = false; };
  }, [rental?.rider_id, rental?.id]);

  // ---------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------

  const rentalEndDate = rental?.rental_end ? new Date(rental.rental_end) : null;
  const rentalStartDate = rental?.start_time ? new Date(rental.start_time) : null;
  const actualReturnDate = useMemo(() => new Date(), [rental?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const isOverdue = rentalEndDate ? actualReturnDate > rentalEndDate : false;
  const rideDuration = rentalStartDate ? formatDurationMs(actualReturnDate - rentalStartDate) : "—";
  const delayDuration = isOverdue ? formatDurationMs(actualReturnDate - rentalEndDate) : "—";

  const depositAmount = Number(rental?.deposit_amount ?? 0);
  const totalDeductions = Number(overdueCharge) + Number(chargeScratch) + Number(chargeCleaning) + Number(chargeOther);
  const refundAmount = Math.max(0, depositAmount - totalDeductions);
  const adjustmentToDeposit = Math.min(totalDeductions, depositAmount);

  // ---------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------

  const handleSearch = async () => {
    setSearchError("");
    setSubmitError("");

    const value = String(searchValue || "").trim();
    if (!value) { setSearchError(`Enter a ${activeSearchTab === "mobile" ? "mobile number" : activeSearchTab === "name" ? "rider name" : "vehicle ID"} to search.`); return; }

    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (activeSearchTab === "mobile") params.set("mobile", sanitizeNumericInput(value, 10));
      else if (activeSearchTab === "vehicle") params.set("vehicle", value);
      else params.set("name", value);

      const found = await apiFetch(`/api/rentals/active?${params.toString()}`);
      if (!found) { setSearchError("No active rental found for the given details."); setRental(null); return; }
      setRental(found);

      // overdue
      const now = new Date();
      const end = found.rental_end ? new Date(found.rental_end) : null;
      let mins = 0; let charge = 0;
      if (end && now > end) {
        mins = Math.ceil((now - end) / (1000 * 60));
        charge = Math.max(10, Math.ceil(mins / 10) * 10);
      }
      setOverdueMinutes(mins);
      setOverdueCharge(charge);

      // recent searches
      setRecentSearches((prev) => {
        const entry = {
          name: found.rider_full_name || "Rider",
          mobile: found.rider_mobile || found.mobile || "",
          riderCode: found.rider_code || "—",
          vehicleId: found.vehicle_number || found.bike_id || "—",
          when: Date.now(),
        };
        const dedup = prev.filter((e) => e.mobile !== entry.mobile || e.vehicleId !== entry.vehicleId);
        return [entry, ...dedup].slice(0, 5);
      });
    } catch (e) {
      setSearchError(String(e?.message || e || "Unable to search active rental"));
      setRental(null);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectRental = () => {
    setCurrentStep(2);
  };

  const handleRecentSearchClick = (entry) => {
    if (entry.mobile) {
      setActiveSearchTab("mobile");
      setSearchValue(entry.mobile);
    } else if (entry.vehicleId && entry.vehicleId !== "—") {
      setActiveSearchTab("vehicle");
      setSearchValue(entry.vehicleId);
    } else {
      setActiveSearchTab("name");
      setSearchValue(entry.name);
    }
    setTimeout(() => handleSearch(), 0);
  };

  // ---------------------------------------------------------------------
  // Photos
  // ---------------------------------------------------------------------

  const filePreview = (file) => {
    try { return URL.createObjectURL(file); } catch { return ""; }
  };

  const pickPhotoForSlot = (slotKey) => (event) => {
    setPhotoError("");
    const f = event.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setPhotoError("Each image must be 10MB or less."); return; }
    setPhotos((prev) => ({ ...prev, [slotKey]: f }));
    event.target.value = "";
  };

  const pickExtraPhotos = (event) => {
    setPhotoError("");
    const files = Array.from(event.target.files || []);
    const tooLarge = files.find((f) => f.size > 10 * 1024 * 1024);
    if (tooLarge) { setPhotoError("Each image must be 10MB or less."); return; }
    setExtraPhotos((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  const slotInputs = useRef({});
  const extraInput = useRef(null);

  const photosCount = Object.values(photos).filter(Boolean).length + extraPhotos.length;

  // ---------------------------------------------------------------------
  // Refund verification
  // ---------------------------------------------------------------------

  const handleVerifyRefund = () => {
    if (refundMethod === "upi") {
      const v = String(refundUpiId || "").trim();
      const ok = /^[\w.\-]{2,256}@[\w]{2,64}$/i.test(v);
      setRefundVerified(ok);
      if (!ok) setSubmitError("Invalid UPI ID format.");
      else setSubmitError("");
    } else {
      const acc = String(refundBankAccount || "").replace(/\D/g, "");
      const ifsc = String(refundBankIFSC || "").trim().toUpperCase();
      const ok = acc.length >= 9 && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
      setRefundVerified(ok);
      if (!ok) setSubmitError("Enter a valid account number and IFSC.");
      else setSubmitError("");
    }
  };

  // Reset verification when refund details change
  useEffect(() => { setRefundVerified(false); }, [refundMethod, refundUpiId, refundBankAccount, refundBankIFSC]);

  // ---------------------------------------------------------------------
  // Submit return
  // ---------------------------------------------------------------------

  const handleSubmitReturn = async () => {
    setSubmitError("");
    if (!rental?.id) { setSubmitError("No active rental selected."); return; }

    if (photosCount === 0) { setSubmitError("Add at least one return photo."); return; }
    if (!confirmAccepted) { setSubmitError("Please confirm you have verified all returned items and details."); return; }

    // Build readable condition + items summary
    const itemsLine = RETURNED_ITEMS.map(({ key, label }) => `${label}: ${returnedItems[key] ? "Yes" : "No"}`).join(", ");
    const condLine = CONDITION_GROUPS.map(({ key, label }) => `${label}: ${condition[key]}`).join(", ");
    const conditionPayload = `${condLine}. ${itemsLine}.${inspectionNotes ? ` Notes: ${inspectionNotes}` : ""}`;

    const refundLine =
      refundMethod === "upi"
        ? `UPI: ${refundUpiId || "—"} (${refundVerified ? "verified" : "unverified"})`
        : `Bank: ${refundBankAccount || "—"} / ${refundBankIFSC || "—"} (${refundVerified ? "verified" : "unverified"})`;
    const feedbackPayload = `Refund: ${formatINR(refundAmount)} via ${refundLine}.${settlementNotes ? ` Notes: ${settlementNotes}` : ""}`;

    // Sum the manual charges into extraPayment (overdue stays separate).
    const extraPayment = Number(chargeScratch) + Number(chargeCleaning) + Number(chargeOther);

    // Photos array — all slots + extras
    const allPhotos = [...Object.values(photos).filter(Boolean), ...extraPhotos];

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("rentalId", rental.id);
      form.set("conditionNotes", conditionPayload);
      form.set("feedback", feedbackPayload);
      form.set("depositReturned", refundAmount > 0 ? "true" : "false");
      form.set("overdueCharge", String(overdueCharge));
      form.set("extraPayment", String(extraPayment));
      form.set("finalDepositRefund", String(refundAmount));
      allPhotos.forEach((file) => form.append("photos", file));

      await apiFetch("/api/returns/submit", { method: "POST", body: form });
      setSubmitted(true);
    } catch (e) {
      setSubmitError(String(e?.message || e || "Unable to submit return"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!rental?.id) return;
    // Open a simple receipt page or print a stub
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Return Receipt</title>
      <style>body{font-family:system-ui;padding:24px;max-width:520px;margin:0 auto}h1{font-size:18px}
      table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #eee;font-size:14px}
      td:last-child{text-align:right;font-weight:600}</style></head><body>
      <h1>Vehicle Return Receipt</h1>
      <p>Rider: ${rental.rider_full_name || "—"} (${rental.rider_mobile || "—"})</p>
      <p>Rental: ${rentalDisplayId || formatRentalId(rental.id)}</p>
      <p>Vehicle: ${rental.vehicle_number || rental.bike_id || "—"}</p>
      <table>
        <tr><td>Ride Start</td><td>${formatDateTime(rental.start_time)}</td></tr>
        <tr><td>Expected Return</td><td>${formatDateTime(rental.rental_end)}</td></tr>
        <tr><td>Actual Return</td><td>${formatDateTime(actualReturnDate)}</td></tr>
        <tr><td>Total Duration</td><td>${rideDuration}</td></tr>
        <tr><td>Security Deposit</td><td>${formatINR(depositAmount)}</td></tr>
        <tr><td>Delay Charge</td><td>${formatINR(overdueCharge)}</td></tr>
        <tr><td>Vehicle Scratch</td><td>${formatINR(chargeScratch)}</td></tr>
        <tr><td>Cleaning Fee</td><td>${formatINR(chargeCleaning)}</td></tr>
        <tr><td>Other Charges</td><td>${formatINR(chargeOther)}</td></tr>
        <tr><td>Total Deductions</td><td>${formatINR(totalDeductions)}</td></tr>
        <tr><td><strong>Refund Amount</strong></td><td><strong>${formatINR(refundAmount)}</strong></td></tr>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#666">Issued by Evegah</p>
      </body></html>`);
    w.document.close();
    w.focus();
  };

  // ---------------------------------------------------------------------
  // Navigation guards
  // ---------------------------------------------------------------------

  const goPrev = () => setCurrentStep((s) => Math.max(1, s - 1));
  const goNext = () => {
    if (currentStep === 1 && !rental) { setSearchError("Search and select a rental to continue."); return; }
    if (currentStep === 2 && photosCount === 0) { setPhotoError("Add at least one return photo."); return; }
    if (currentStep === 3) {
      if (refundAmount > 0 && !refundVerified) { setSubmitError("Verify the refund method before continuing."); return; }
      setSubmitError("");
    }
    setCurrentStep((s) => Math.min(4, s + 1));
  };

  const handleStepClick = (n) => {
    if (n === 1) return setCurrentStep(1);
    if (!rental) return;
    if (n >= 2) setCurrentStep(n);
  };

  // ---------------------------------------------------------------------
  // Right rail content
  // ---------------------------------------------------------------------

  const RiderSummary = () => {
    const totalRides = rental?.total_rides ?? rental?.rider_total_rides ?? "—";
    const completedRides = rental?.completed_rides ?? "—";
    const pendingRides = rental?.pending_rides ?? "—";
    const plan = rental?.rental_package ? rental.rental_package.replace(/^./, (c) => c.toUpperCase()) + " Plan" : "—";

    return (
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
            {rental?.rider_code ? (
              <p className="text-xs text-gray-500">Rider ID: {rental.rider_code}</p>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5 pt-3 border-t border-evegah-border">
          <SummaryRow label="Total Rides" value={totalRides} />
          <SummaryRow label="Completed Rides" value={completedRides} />
          <SummaryRow label="Pending Rides" value={pendingRides} />
          <SummaryRow label="Rental Plan" value={plan} />
          <SummaryRow label="Security Deposit" value={formatINR(depositAmount)} />
        </div>
      </div>
    );
  };

  const CurrentRideOverview = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={16} className="text-evegah-primary" />
        <h3 className="text-sm font-bold text-evegah-text">Current Ride Overview</h3>
      </div>
      <div className="space-y-2">
        <SummaryRow label="Ride Start" value={formatDateTime(rental?.start_time)} />
        <SummaryRow label="Expected Return" value={formatDateTime(rental?.rental_end)} />
        <SummaryRow label="Plan" value={rental?.rental_package ? rental.rental_package.replace(/^./, (c) => c.toUpperCase()) + " Plan" : "—"} />
        <SummaryRow label="Current Vehicle" value={`${rental?.vehicle_number || rental?.bike_id || "—"}${rental?.bike_model ? ` (${rental.bike_model})` : ""}`} />
        <SummaryRow label="Odometer" value={rental?.odometer_km ? `${rental.odometer_km} km` : "—"} />
        <SummaryRow label="Battery SOH" value={rental?.battery_soh ? `${rental.battery_soh}%` : "—"} />
        <SummaryRow label="Security Deposit" value={formatINR(depositAmount)} />
      </div>
    </div>
  );

  const RideSummaryCard = ({ status = "active" }) => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={16} className="text-evegah-primary" />
        <h3 className="text-sm font-bold text-evegah-text">Ride Summary</h3>
      </div>
      <div className="space-y-2">
        <SummaryRow label="Ride Start" value={formatDateTime(rental?.start_time)} />
        <SummaryRow label="Expected Return" value={formatDateTime(rental?.rental_end)} />
        <SummaryRow
          label="Actual Return"
          value={status === "active" ? "—" : formatDateTime(actualReturnDate)}
          valueClass={status === "active" ? "text-gray-400" : isOverdue ? "text-rose-600" : "text-evegah-text"}
        />
        <SummaryRow label="Ride Duration" value={rideDuration} />
        <SummaryRow label="Plan" value={rental?.rental_package ? rental.rental_package.replace(/^./, (c) => c.toUpperCase()) + " Plan" : "—"} />
        <SummaryRow label="Security Deposit" value={formatINR(depositAmount)} />
        {status === "completed" || currentStep >= 3 ? (
          <SummaryRow
            label="Refund Amount"
            value={formatINR(refundAmount)}
            valueClass="text-emerald-700"
          />
        ) : null}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-evegah-border">
          <span className="text-sm text-gray-500">Status</span>
          <span className={`inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 ${
            status === "completed" ? "bg-brand-light text-evegah-primary" : "bg-brand-light text-evegah-primary"
          }`}>
            {status === "completed" ? "Completed" : "Active"}
          </span>
        </div>
      </div>
    </div>
  );

  const QuickActionsCard = ({ withReceipt = false }) => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={16} className="text-evegah-primary" />
        <h3 className="text-sm font-bold text-evegah-text">Quick Actions</h3>
      </div>
      <div className="space-y-2">
        {withReceipt ? (
          <button type="button" onClick={handleDownloadReceipt} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-evegah-primary text-evegah-primary px-3 py-2.5 text-sm font-semibold hover:bg-brand-light/40">
            <Download size={14} /> Download Return Receipt
          </button>
        ) : null}
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
          target="_blank"
          rel="noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-evegah-border text-evegah-text px-3 py-2.5 text-sm font-semibold hover:bg-gray-50"
        >
          <MessageCircle size={14} /> Chat with Rider
        </a>
      </div>
    </div>
  );

  const renderRightRail = () => {
    if (currentStep === 1) {
      return (
        <>
          {rental ? <RiderSummary /> : (
            <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 text-center">
              <p className="text-sm font-semibold text-evegah-text">Rider Summary</p>
              <p className="mt-1 text-xs text-gray-500">Search a rider to see their summary here.</p>
            </div>
          )}
          {rental ? <CurrentRideOverview /> : null}
          {rental ? <QuickActionsCard /> : null}
          <NeedHelpCard />
        </>
      );
    }
    if (currentStep === 4) {
      return (
        <>
          <RiderSummary />
          <RideSummaryCard status="completed" />
          <QuickActionsCard withReceipt />
          <NeedHelpCard />
        </>
      );
    }
    // Step 2 + 3
    return (
      <>
        <RiderSummary />
        <RideSummaryCard status={currentStep >= 3 ? "active" : "active"} />
        <QuickActionsCard />
        <NeedHelpCard />
      </>
    );
  };

  // ---------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------

  const renderStep1 = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Search Rider</h2>
          <p className="text-sm text-gray-500">Search for a rider using the details below</p>
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

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">
          {activeSearchTab === "mobile" ? "Mobile Number" : activeSearchTab === "name" ? "Rider Name" : "Vehicle ID"}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {activeSearchTab === "mobile" ? (
            <div className="flex flex-1 items-stretch rounded-xl border border-evegah-border overflow-hidden bg-white">
              <span className="inline-flex items-center gap-1 px-3 bg-evegah-bg text-sm text-gray-600 border-r border-evegah-border">
                <span className="text-base">🇮🇳</span> +91
              </span>
              <input
                type="tel"
                placeholder="98765 43210"
                className="flex-1 px-3 py-3 text-sm outline-none"
                value={searchValue}
                inputMode="numeric"
                maxLength={10}
                onChange={(e) => setSearchValue(sanitizeNumericInput(e.target.value, 10))}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              {searchValue ? (
                <button type="button" onClick={() => setSearchValue("")} className="px-3 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              ) : null}
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
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-evegah-primary text-white px-6 py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
          >
            <Search size={16} />
            {searching ? "Searching…" : "Search Rider"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 inline-flex items-start gap-2">
        <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
        Make sure the rider has an active return request or the vehicle is eligible for return.
      </div>

      {searchError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {searchError}
        </div>
      ) : null}

      {/* Result card */}
      {rental ? (
        <div className="rounded-2xl border border-evegah-border bg-white p-4 space-y-4">
          <div>
            <p className="text-sm font-bold text-evegah-text">Search Results</p>
            <p className="text-xs text-gray-500">Showing 1 matching rider</p>
          </div>
          <div className="rounded-xl border border-evegah-border p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
              <div className="flex items-center gap-3 min-w-0 lg:w-56">
                <div className="h-12 w-12 rounded-full bg-brand-light text-evegah-primary grid place-items-center text-sm font-bold shrink-0">
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
                    <Phone size={11} /> +91 {rental.rider_mobile || rental.mobile || "—"}
                  </p>
                  <p className="text-xs text-gray-500">Rider ID: {rental.rider_code || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 text-xs">
                <div>
                  <p className="text-gray-500 font-semibold mb-0.5">Vehicle</p>
                  <p className="text-evegah-text font-semibold">{rental.bike_model || "—"}</p>
                  <p className="text-gray-500">{rental.vehicle_number || rental.bike_id || "—"}</p>
                  <span className="mt-1 inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5">Active</span>
                </div>
                <div>
                  <p className="text-gray-500 font-semibold mb-0.5">Ride Start</p>
                  <p className="text-evegah-text">{formatDateTime(rental.start_time)}</p>
                  <p className="text-gray-500 font-semibold mt-2">Expected Return</p>
                  <p className="text-evegah-text">{formatDateTime(rental.rental_end)}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-semibold mb-0.5">Plan</p>
                  <p className="text-evegah-text">{rental.rental_package ? rental.rental_package.replace(/^./, (c) => c.toUpperCase()) + " Plan" : "—"}</p>
                  <p className="text-gray-500 font-semibold mt-2">Security Deposit</p>
                  <p className="text-evegah-text font-bold">{formatINR(depositAmount)}</p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSelectRental}
            className="w-full rounded-xl border-2 border-evegah-primary text-evegah-primary text-sm font-bold py-3 hover:bg-brand-light/40"
          >
            Select This Rider
          </button>
        </div>
      ) : null}

      {/* Recent searches */}
      {recentSearches.length > 0 ? (
        <div>
          <p className="text-sm font-bold text-evegah-text mb-2">Recent Searches</p>
          <div className="overflow-x-auto rounded-2xl border border-evegah-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 bg-evegah-bg/60">
                  <th className="px-4 py-2 font-semibold">Rider Name</th>
                  <th className="px-4 py-2 font-semibold">Mobile Number</th>
                  <th className="px-4 py-2 font-semibold">Rider ID</th>
                  <th className="px-4 py-2 font-semibold">Vehicle ID</th>
                  <th className="px-4 py-2 font-semibold">Last Activity</th>
                  <th className="px-4 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentSearches.map((r, idx) => (
                  <tr key={`${r.mobile}-${idx}`} className="border-t border-evegah-border">
                    <td className="px-4 py-2.5 text-evegah-text font-semibold">{r.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">+91 {r.mobile || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.riderCode}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.vehicleId}</td>
                    <td className="px-4 py-2.5 text-gray-500">{Math.max(0, Math.floor((Date.now() - r.when) / 60000))} mins ago</td>
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => handleRecentSearchClick(r)} className="text-xs font-semibold text-evegah-primary hover:underline">
                        Search Again
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      {/* Rider banner */}
      {rental ? (
        <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs flex-1">
              <SummaryRow label="Ride ID" value={rentalDisplayId || formatRentalId(rental.id)} />
              <SummaryRow label="Ride Start" value={formatDateTime(rental.start_time)} />
              <SummaryRow label="Plan" value={rental.rental_package ? rental.rental_package.replace(/^./, (c) => c.toUpperCase()) + " Plan" : "—"} />
              <SummaryRow label="Vehicle" value={rental.vehicle_number || rental.bike_id || "—"} />
              <SummaryRow label="Expected Return" value={formatDateTime(rental.rental_end)} />
              <SummaryRow label="Security Deposit" value={formatINR(depositAmount)} />
              <SummaryRow label="Battery" value={rental.current_battery_id || rental.battery_id || "—"} />
              <SummaryRow
                label="Ride Status"
                value={<span className="inline-flex items-center rounded-full bg-brand-light text-evegah-primary text-[11px] font-semibold px-2 py-0.5">Active</span>}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Return Inspection */}
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Return Inspection</h2>
          <p className="text-sm text-gray-500">Please inspect the vehicle and add required images</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {PHOTO_SLOTS.map((slot) => {
            const file = photos[slot.key];
            return (
              <div key={slot.key} className="space-y-1.5">
                <p className="text-xs text-gray-600 font-semibold inline-flex items-center gap-1">
                  {slot.label} {file ? <CheckCircle2 size={11} className="text-emerald-500" /> : null}
                </p>
                <button
                  type="button"
                  onClick={() => slotInputs.current[slot.key]?.click()}
                  className="relative w-full aspect-square rounded-xl overflow-hidden border border-evegah-border bg-evegah-bg/40 hover:border-evegah-primary transition-colors group"
                >
                  {file ? (
                    <img src={filePreview(file)} alt={slot.label} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-gray-400">
                      <Camera size={20} />
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-white/95 border border-evegah-border grid place-items-center text-gray-600 group-hover:text-evegah-primary">
                    <Camera size={12} />
                  </span>
                </button>
                <input
                  ref={(el) => { slotInputs.current[slot.key] = el; }}
                  type="file" accept="image/*" capture="environment"
                  className="hidden"
                  onChange={pickPhotoForSlot(slot.key)}
                />
              </div>
            );
          })}

          {/* Add More */}
          <div className="space-y-1.5">
            <p className="text-xs text-gray-600 font-semibold">Add More</p>
            <button
              type="button"
              onClick={() => extraInput.current?.click()}
              className="w-full aspect-square rounded-xl border-2 border-dashed border-evegah-border bg-evegah-bg/40 hover:border-evegah-primary text-gray-400 grid place-items-center"
            >
              <Camera size={20} />
            </button>
            <input
              ref={extraInput}
              type="file" accept="image/*" multiple
              className="hidden"
              onChange={pickExtraPhotos}
            />
          </div>
        </div>

        {extraPhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {extraPhotos.map((f, idx) => (
              <div key={`${f.name}-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-evegah-border">
                <img src={filePreview(f)} alt="extra" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setExtraPhotos((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/95 border border-evegah-border grid place-items-center text-gray-600 hover:text-rose-600"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {photoError ? <p className="text-xs text-rose-600">{photoError}</p> : null}

        {/* Vehicle Condition */}
        <div>
          <h3 className="text-sm font-bold text-evegah-text mb-3">Vehicle Condition</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CONDITION_GROUPS.map((g) => (
              <div key={g.key}>
                <p className="text-xs font-semibold text-gray-600 mb-2">{g.label}</p>
                <div className="space-y-1.5">
                  {g.options.map((opt) => {
                    const checked = condition[g.key] === opt;
                    const isGood = (opt === "No Damage" || opt === "Good" || opt === "Clean") && checked;
                    return (
                      <label key={opt} className="inline-flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name={`cond-${g.key}`}
                          checked={checked}
                          onChange={() => setCondition((p) => ({ ...p, [g.key]: opt }))}
                          className="accent-evegah-primary"
                        />
                        <span className={`${isGood ? "text-emerald-600 font-semibold" : "text-evegah-text"}`}>
                          {isGood ? <CheckCircle2 size={12} className="inline mr-1 text-emerald-500" /> : null}
                          {opt}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Returned items column */}
            <div className="lg:col-span-1">
              <div className="space-y-2.5">
                {RETURNED_ITEMS.map((it) => (
                  <label key={it.key} className="flex items-center justify-between gap-2 cursor-pointer text-sm">
                    <span className="inline-flex items-center gap-1.5 text-evegah-text">
                      <CheckCircle2 size={12} className={returnedItems[it.key] ? "text-emerald-500" : "text-gray-300"} />
                      {it.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReturnedItems((p) => ({ ...p, [it.key]: !p[it.key] }))}
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${returnedItems[it.key] ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}
                    >
                      {returnedItems[it.key] ? "Yes" : "No"}
                    </button>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Notes (Optional)</label>
          <textarea
            rows={3}
            maxLength={300}
            placeholder="Write any additional notes about the vehicle condition…"
            className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
            value={inspectionNotes}
            onChange={(e) => setInspectionNotes(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-gray-400 text-right">{inspectionNotes.length} / 300</p>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5">
      {/* Rider banner with Actual Return + Delay (red) */}
      {rental ? (
        <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs flex-1">
              <SummaryRow label="Ride ID" value={rentalDisplayId || formatRentalId(rental.id)} />
              <SummaryRow label="Ride Start" value={formatDateTime(rental.start_time)} />
              <SummaryRow label="Plan" value={rental.rental_package ? rental.rental_package.replace(/^./, (c) => c.toUpperCase()) + " Plan" : "—"} />
              <SummaryRow label="Vehicle" value={rental.vehicle_number || rental.bike_id || "—"} />
              <SummaryRow label="Expected Return" value={formatDateTime(rental.rental_end)} />
              <SummaryRow label="Security Deposit" value={formatINR(depositAmount)} />
              <SummaryRow
                label="Actual Return"
                value={formatDateTime(actualReturnDate)}
                valueClass={isOverdue ? "text-rose-600" : "text-evegah-text"}
              />
              <SummaryRow
                label="Delay"
                value={isOverdue ? <span className="text-rose-600 font-bold">{delayDuration}</span> : "—"}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Settlement Summary</h2>
          <p className="text-sm text-gray-500">Review charges, deposit adjustment and refund (if any)</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Charges Breakdown */}
          <div className="rounded-2xl border border-evegah-border p-4 space-y-3">
            <h3 className="text-sm font-bold text-evegah-text">Charges Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-600">Delay Charge {overdueMinutes > 0 ? `(${formatDurationMs(overdueMinutes * 60000)})` : ""}</span>
                <span className="font-semibold text-evegah-text">{formatINR(overdueCharge)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-600">Vehicle Scratch</span>
                <input
                  type="number" min="0"
                  value={chargeScratch}
                  onChange={(e) => setChargeScratch(Number(e.target.value || 0))}
                  className="w-24 rounded-lg border border-evegah-border px-2 py-1 text-sm text-right outline-none focus:border-evegah-primary"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-600">Cleaning Fee</span>
                <input
                  type="number" min="0"
                  value={chargeCleaning}
                  onChange={(e) => setChargeCleaning(Number(e.target.value || 0))}
                  className="w-24 rounded-lg border border-evegah-border px-2 py-1 text-sm text-right outline-none focus:border-evegah-primary"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-600">Other Charges</span>
                <input
                  type="number" min="0"
                  value={chargeOther}
                  onChange={(e) => setChargeOther(Number(e.target.value || 0))}
                  className="w-24 rounded-lg border border-evegah-border px-2 py-1 text-sm text-right outline-none focus:border-evegah-primary"
                />
              </div>
              <div className="pt-2 border-t border-evegah-border flex items-center justify-between">
                <span className="text-evegah-text font-bold">Total Deductions</span>
                <span className="text-rose-600 font-bold">{formatINR(totalDeductions)}</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 inline-flex items-center gap-1"><Info size={11} /> Charges are calculated as per policy</p>
          </div>

          {/* Deposit Adjustment */}
          <div className="rounded-2xl border border-evegah-border p-4 space-y-3">
            <h3 className="text-sm font-bold text-evegah-text">Deposit Adjustment</h3>
            <SummaryRow label="Security Deposit" value={formatINR(depositAmount)} />
            <SummaryRow label="Total Deductions" value={`- ${formatINR(adjustmentToDeposit)}`} valueClass="text-rose-600" />
            <div className="pt-2 border-t border-evegah-border">
              <SummaryRow label="Refund Amount" value={formatINR(refundAmount)} valueClass="text-emerald-700 text-base" />
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 inline-flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 size={12} /> {formatINR(adjustmentToDeposit)} will be deducted from deposit
            </div>
          </div>

          {/* Refund Details */}
          <div className="rounded-2xl border border-evegah-border p-4 space-y-3">
            <h3 className="text-sm font-bold text-evegah-text">Refund Details</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Refund Amount</span>
              <span className="text-base font-bold text-emerald-700">{formatINR(refundAmount)}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Refund Method</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "upi", label: "UPI", icon: Wallet },
                  { id: "bank", label: "Bank Transfer", icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  const active = refundMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setRefundMethod(m.id)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                        active ? "border-evegah-primary text-evegah-primary bg-brand-light/30" : "border-evegah-border text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={12} /> {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {refundMethod === "upi" ? (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">UPI ID</p>
                <div className="flex items-stretch rounded-xl border border-evegah-border overflow-hidden">
                  <input
                    type="text"
                    placeholder="amitkumar@upi"
                    className="flex-1 px-3 py-2 text-sm outline-none"
                    value={refundUpiId}
                    onChange={(e) => setRefundUpiId(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyRefund}
                    className="px-3 text-xs font-bold text-evegah-primary border-l border-evegah-border bg-evegah-bg hover:bg-brand-light/30"
                  >
                    Verify
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Account Number</p>
                  <input
                    type="text"
                    placeholder="9999 9999 9999"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-evegah-border outline-none focus:border-evegah-primary"
                    value={refundBankAccount}
                    onChange={(e) => setRefundBankAccount(e.target.value)}
                  />
                </div>
                <div className="flex items-stretch rounded-xl border border-evegah-border overflow-hidden">
                  <input
                    type="text"
                    placeholder="IFSC (e.g. HDFC0001234)"
                    className="flex-1 px-3 py-2 text-sm outline-none uppercase"
                    value={refundBankIFSC}
                    onChange={(e) => setRefundBankIFSC(e.target.value.toUpperCase())}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyRefund}
                    className="px-3 text-xs font-bold text-evegah-primary border-l border-evegah-border bg-evegah-bg hover:bg-brand-light/30"
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}

            {refundVerified ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 inline-flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 size={12} /> {refundMethod === "upi" ? "UPI ID verified successfully" : "Bank details verified successfully"}
              </div>
            ) : refundAmount === 0 ? (
              <div className="rounded-lg bg-gray-50 border border-evegah-border px-3 py-2 text-xs text-gray-500">
                No refund due — full deposit adjusted to deductions.
              </div>
            ) : null}
          </div>
        </div>

        {/* Additional notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Notes (Optional)</label>
          <textarea
            rows={3}
            maxLength={300}
            placeholder="Write any additional notes about the settlement…"
            className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
            value={settlementNotes}
            onChange={(e) => setSettlementNotes(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-gray-400 text-right">{settlementNotes.length} / 300</p>
        </div>

        {submitError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{submitError}</div>
        ) : null}
      </div>
    </div>
  );

  const renderStep4 = () => {
    const totalDistance = rental?.total_distance_km ? `${rental.total_distance_km} km` : "—";

    return (
      <div className="space-y-5">
        {/* All set banner */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-emerald-800">All set to complete the return</p>
            <p className="text-xs text-emerald-700">Please review the summary and confirm to close this return.</p>
          </div>
        </div>

        {/* Rider summary banner */}
        {rental ? (
          <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
            <div className="flex flex-wrap items-center gap-4 lg:gap-6">
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs flex-1">
                <SummaryRow label="Ride ID" value={rentalDisplayId || formatRentalId(rental.id)} />
                <SummaryRow label="Ride Start" value={formatDateTime(rental.start_time)} />
                <SummaryRow label="Plan" value={rental.rental_package ? rental.rental_package.replace(/^./, (c) => c.toUpperCase()) + " Plan" : "—"} />
                <SummaryRow label="Vehicle" value={rental.vehicle_number || rental.bike_id || "—"} />
                <SummaryRow label="Actual Return" value={formatDateTime(actualReturnDate)} valueClass={isOverdue ? "text-rose-600" : "text-evegah-text"} />
                <SummaryRow label="Security Deposit" value={formatINR(depositAmount)} />
                <SummaryRow label="Total Duration" value={rideDuration} />
                <SummaryRow label="Total Distance" value={totalDistance} />
                <SummaryRow label="Refund" value={formatINR(refundAmount)} valueClass="text-emerald-700" />
              </div>
            </div>
          </div>
        ) : null}

        {/* Return Summary */}
        <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-evegah-text">Return Summary</h2>
            <p className="text-sm text-gray-500">Review the full breakdown before confirming.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Deductions */}
            <div className="rounded-2xl border border-evegah-border p-4 space-y-2">
              <h3 className="text-sm font-bold text-evegah-text">Deductions</h3>
              <SummaryRow label={`Delay Charge${overdueMinutes ? ` (${formatDurationMs(overdueMinutes * 60000)})` : ""}`} value={formatINR(overdueCharge)} />
              <SummaryRow label="Vehicle Scratch" value={formatINR(chargeScratch)} />
              <SummaryRow label="Cleaning Fee" value={formatINR(chargeCleaning)} />
              <SummaryRow label="Other Charges" value={formatINR(chargeOther)} />
              <div className="pt-2 border-t border-evegah-border">
                <SummaryRow label="Total Deductions" value={formatINR(totalDeductions)} valueClass="text-rose-600" />
              </div>
            </div>

            {/* Deposits & Refunds */}
            <div className="rounded-2xl border border-evegah-border p-4 space-y-2">
              <h3 className="text-sm font-bold text-evegah-text">Deposits &amp; Refunds</h3>
              <SummaryRow label="Security Deposit" value={formatINR(depositAmount)} />
              <SummaryRow label="Total Deductions" value={`- ${formatINR(adjustmentToDeposit)}`} valueClass="text-rose-600" />
              <div className="pt-2 border-t border-evegah-border">
                <SummaryRow label="Refund Amount" value={formatINR(refundAmount)} valueClass="text-emerald-700" />
              </div>
            </div>

            {/* Returned Items */}
            <div className="rounded-2xl border border-evegah-border p-4 space-y-1.5">
              <h3 className="text-sm font-bold text-evegah-text">Returned Items</h3>
              {[
                { key: "vehicle", label: "Vehicle", returned: true },
                { key: "battery", label: "Battery", returned: true },
                ...RETURNED_ITEMS.map((it) => ({ key: it.key, label: it.label.replace(/ Returned$/, ""), returned: !!returnedItems[it.key] })),
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between text-sm">
                  <span className="text-evegah-text">{item.label}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${item.returned ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                    {item.returned ? "Returned" : "Missing"}
                  </span>
                </div>
              ))}
            </div>

            {/* Payment to Rider */}
            <div className="rounded-2xl border border-evegah-border p-4 space-y-2">
              <h3 className="text-sm font-bold text-evegah-text">Payment to Rider</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Refund Amount</span>
                <span className="text-base font-bold text-emerald-700">{formatINR(refundAmount)}</span>
              </div>
              <SummaryRow label="Payment Method" value={refundMethod === "upi" ? "UPI" : "Bank Transfer"} />
              <SummaryRow label={refundMethod === "upi" ? "UPI ID" : "Account"} value={refundMethod === "upi" ? (refundUpiId || "—") : (refundBankAccount || "—")} />
              {refundAmount > 0 ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 inline-flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Refund {refundVerified ? "ready to be paid" : "pending verification"}
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 border border-evegah-border px-3 py-2 text-xs text-gray-500">
                  No refund — full deposit adjusted.
                </div>
              )}
            </div>
          </div>

          {/* Confirmation */}
          <label className={`flex items-start gap-2 rounded-xl border px-4 py-3 ${submitted ? "border-emerald-200 bg-emerald-50" : "border-evegah-border bg-white"}`}>
            <input
              type="checkbox"
              className="mt-0.5 accent-evegah-primary"
              checked={confirmAccepted}
              disabled={submitted}
              onChange={(e) => setConfirmAccepted(e.target.checked)}
            />
            <span className="text-sm text-evegah-text">
              I have verified all returned items and details are correct.
              <span className="block text-xs text-gray-500 mt-0.5">By confirming, the return will be closed and refund (if any) will be processed.</span>
            </span>
          </label>

          {submitError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{submitError}</div>
          ) : null}

          {submitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-wrap items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">Return completed successfully.</span>
              <button type="button" onClick={handleDownloadReceipt} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-evegah-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-95">
                <Download size={14} /> Download Receipt
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------

  const isLastStep = currentStep === 4;

  return (
    <EmployeeLayout>
      <div className="w-full space-y-5">
        {/* Top "Ride Operations" header (matches reference subtitle) */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-evegah-text">Ride Operations</h1>
          <p className="text-sm text-gray-500">Manage return, extend and exchange requests</p>
        </div>

        {/* Top tabs */}
        <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-1.5 flex">
          {TOP_TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === "return";
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
          <HorizontalStepper current={currentStep} onStepClick={handleStepClick} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div className="min-w-0 space-y-5">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}

            {/* Bottom action bar */}
            <div className="bg-white border border-evegah-border rounded-2xl shadow-card px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={currentStep === 1 ? () => navigate("/employee/dashboard") : goPrev}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
              >
                <ArrowLeft size={14} /> {currentStep === 1 ? "Back" : "Back"}
              </button>

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={currentStep === 1 && !rental}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  Next: {STEPS[currentStep]?.title || "Continue"} <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitReturn}
                  disabled={submitting || submitted || !confirmAccepted}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  <Check size={14} /> {submitting ? "Closing Ride…" : submitted ? "Return Completed" : "Confirm Return & Close Ride"}
                </button>
              )}
            </div>
          </div>

          {/* Right rail */}
          <aside className="space-y-5 xl:sticky xl:top-24">
            {renderRightRail()}
          </aside>
        </div>
      </div>
    </EmployeeLayout>
  );
}
