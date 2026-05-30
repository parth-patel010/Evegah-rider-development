import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
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
  CircleAlert,
  CreditCard,
  Edit3,
  FileCheck,
  Hash,
  IdCard,
  Info,
  LifeBuoy,
  Lightbulb,
  Phone,
  Receipt,
  RefreshCw,
  Search,
  Smartphone,
  User as UserIcon,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";

import EmployeeLayout from "../../components/layouts/EmployeeLayout";
import useAuth from "../../hooks/useAuth";
import { BATTERY_ID_OPTIONS } from "../../utils/batteryIds";
import {
  filterVehicleIdGroups,
  flattenVehicleIdGroups,
  getVehicleIdGroupsForModel,
  VEHICLE_MODEL_OPTIONS,
} from "../../utils/vehicleIds";
import { apiFetch, getPublicConfig } from "../../config/api";
import useAvailability from "../../hooks/useAvailability";
import { RiderFormProvider } from "./RiderFormContext";
import { useRiderForm } from "./useRiderForm";
import { downloadRiderReceiptPdf } from "../../utils/riderReceiptPdf";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 1, title: "Rider Search" },
  { key: 2, title: "Rental Details" },
  { key: 3, title: "Payment & Charges" },
  { key: 4, title: "Documents" },
  { key: 5, title: "Review & Confirm" },
];

const SEARCH_TABS = [
  { id: "mobile", label: "Mobile Number", icon: Phone },
  { id: "riderId", label: "Rider ID", icon: Hash },
  { id: "aadhaar", label: "Aadhaar Number", icon: IdCard },
  { id: "name", label: "Name", icon: UserIcon },
];

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI / QR Code", desc: "Pay using any UPI app", icon: Smartphone },
  { id: "card", label: "Debit / Credit Card", desc: "Pay using any card", icon: CreditCard },
  { id: "netbanking", label: "Net Banking", desc: "Pay using your bank account", icon: Wallet },
  { id: "wallet", label: "Wallet", desc: "Pay using wallet balance", icon: Wallet },
];

// Map UI payment method id → backend paymentMode value already supported.
const METHOD_TO_MODE = {
  upi: "online",
  card: "online",
  netbanking: "online",
  wallet: "online",
  cash: "cash",
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const sanitizeNumericInput = (value, maxLength) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, maxLength);

const toDateTimeLocal = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
  const pad = (v) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseMaybeJson = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
};

const formatINR = (value) => {
  const n = Number(value || 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₹${n.toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTimeShort = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const maskAadhaar = (value) => {
  const s = String(value || "").replace(/\D/g, "");
  if (!s) return "—";
  if (s.length <= 4) return `XXXX XXXX ${s}`;
  return `XXXX XXXX ${s.slice(-4)}`;
};

const initialsFrom = (name) => {
  const parts = String(name || "").trim().split(/\s+/);
  if (!parts[0]) return "??";
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
};

const statusFor = (current, step) => {
  if (step < current) return "completed";
  if (step === current) return "in_progress";
  return "pending";
};

const STATUS_TEXT = { completed: "Completed", in_progress: "In Progress", pending: "Pending" };
const STATUS_TEXT_COLOR = {
  completed: "text-emerald-600",
  in_progress: "text-evegah-primary",
  pending: "text-gray-400",
};

// ---------------------------------------------------------------------------
// Reusable shell pieces
// ---------------------------------------------------------------------------

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
                <span className={`text-sm font-semibold ${labelClass} group-hover:text-evegah-primary truncate`}>
                  {s.title}
                </span>
                <span className={`text-xs ${STATUS_TEXT_COLOR[status]}`}>{STATUS_TEXT[status]}</span>
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
      <p className="mt-1 text-xs text-gray-500">Facing issues with this step?</p>
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
        <span className={`h-9 w-9 grid place-items-center rounded-xl ${palette.iconBg}`}>
          <Icon size={16} />
        </span>
        <h3 className="text-sm font-bold text-evegah-text">{title}</h3>
      </div>
      <div className="space-y-2 text-xs text-gray-600">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value, valueClass = "text-evegah-text" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold text-right ${valueClass}`}>{value || "—"}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

function RetainRiderInner() {
  const { formData, updateForm, resetForm } = useRiderForm();
  const { user } = useAuth();

  // Wizard step
  const [currentStep, setCurrentStep] = useState(1);

  // Search state
  const [activeSearchTab, setActiveSearchTab] = useState("mobile");
  const [searchValue, setSearchValue] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Selected rider snapshot
  const [selectedRiderSnapshot, setSelectedRiderSnapshot] = useState(null);
  const [activeRideExpectedEnd, setActiveRideExpectedEnd] = useState("");
  const [activeRideStart, setActiveRideStart] = useState("");

  // Rental Details extras
  const [purpose, setPurpose] = useState("Personal Use");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Payment Method UI selection (separate from backend paymentMode)
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [applyDeposit, setApplyDeposit] = useState(true);

  // Vehicle / battery dropdowns
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [batteryDropdownOpen, setBatteryDropdownOpen] = useState(false);
  const [batteryQuery, setBatteryQuery] = useState("");
  const vehicleDropdownRef = useRef(null);
  const vehicleQueryRef = useRef(null);
  const batteryDropdownRef = useRef(null);
  const batteryQueryRef = useRef(null);

  // Photo preview (kept for documents step)
  const [imagePreview, setImagePreview] = useState(null);
  const preRidePhotosInputRef = useRef(null);

  // Submission
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [retainSuccess, setRetainSuccess] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [registration, setRegistration] = useState(null);

  // WhatsApp / receipt
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsAppStatus, setWhatsAppStatus] = useState("");
  const [whatsAppStatusType, setWhatsAppStatusType] = useState("");
  const [whatsAppFallback, setWhatsAppFallback] = useState(null);

  // Confirmation checkbox (Step 5)
  const [confirmAccepted, setConfirmAccepted] = useState(false);

  const { unavailableVehicleIds, unavailableBatteryIds } = useAvailability({ pollMs: 15000 });

  const normalizeIdForCompare = (value) =>
    String(value || "").replace(/[^a-z0-9]+/gi, "").toUpperCase();

  const unavailableVehicleSet = useMemo(
    () => new Set((Array.isArray(unavailableVehicleIds) ? unavailableVehicleIds : []).map(normalizeIdForCompare).filter(Boolean)),
    [unavailableVehicleIds]
  );
  const unavailableBatterySet = useMemo(
    () => new Set((Array.isArray(unavailableBatteryIds) ? unavailableBatteryIds : []).map(normalizeIdForCompare).filter(Boolean)),
    [unavailableBatteryIds]
  );

  const DEFAULT_BATTERY_MODELS = new Set([
    "paddle cycle", "electric cycle", "ev kick scooter", "electric scooter",
    "kids ev car", "kids paddle scooter", "double seat cycle",
  ]);
  const isDefaultBatteryModel = DEFAULT_BATTERY_MODELS.has(
    String(formData.bikeModel || "").trim().toLowerCase()
  );

  useEffect(() => {
    if (isDefaultBatteryModel) {
      if (formData.batteryId !== "Default") updateForm({ batteryId: "Default" });
      setBatteryDropdownOpen(false);
      setBatteryQuery("");
      return;
    }
    if (formData.batteryId === "Default") updateForm({ batteryId: "" });
  }, [isDefaultBatteryModel, formData.batteryId, updateForm]);

  const ACCESSORY_OPTIONS = [
    { key: "helmet", label: "Helmet" },
    { key: "charger", label: "Charger" },
    { key: "mobile_holder", label: "Mobile Holder" },
    { key: "rain_cover", label: "Rain Cover" },
  ];

  const toggleAccessory = (key) => {
    const current = Array.isArray(formData.accessories) ? formData.accessories : [];
    updateForm({
      accessories: current.includes(key)
        ? current.filter((x) => x !== key)
        : [...current, key],
    });
  };

  const selected = Boolean(formData.isRetainRider && formData.existingRiderId);

  // Set default rentalStart on rider selection
  useEffect(() => {
    if (selected && !formData.rentalStart) {
      updateForm({ rentalStart: toDateTimeLocal(new Date()) });
    }
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------

  const handleSearch = async () => {
    setSearchError("");
    const value = String(searchValue || "").trim();
    if (!value) {
      setSearchError(`Enter a ${activeSearchTab} to search.`);
      return;
    }

    setSearchLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "20");
      params.set("search", value);
      const result = await apiFetch(`/api/riders?${params.toString()}`);
      const rows = Array.isArray(result?.data) ? result.data : [];
      setResults(rows);
      if (rows.length === 0) {
        setSearchError("No rider found for the given search.");
      }
    } catch (e) {
      setSearchError(String(e?.message || e || "Unable to search riders"));
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const prefillFromLastRental = async (riderId, { preferZone } = {}) => {
    if (!riderId) return;
    try {
      const rentals = await apiFetch(`/api/riders/${encodeURIComponent(riderId)}/rentals`);
      const last = Array.isArray(rentals) ? rentals[0] : null;
      if (!last) return;

      const rentalMeta = parseMaybeJson(last?.meta) || {};
      const vehicleId = String(last.bike_id || "").trim();
      const batteryId = String(last.battery_id || "").trim();
      const next = {};
      if (preferZone && rentalMeta?.zone) next.operationalZone = String(rentalMeta.zone || "").trim();
      if (vehicleId && !unavailableVehicleSet.has(normalizeIdForCompare(vehicleId))) next.bikeId = vehicleId;
      if (batteryId && !unavailableBatterySet.has(normalizeIdForCompare(batteryId))) next.batteryId = batteryId;
      if (Object.keys(next).length > 0) updateForm(next);
    } catch {
      // ignore
    }
  };

  const prefillFromActiveRental = async ({ mobileDigits }) => {
    if (!mobileDigits) return null;
    try {
      return await apiFetch(`/api/rentals/active?mobile=${encodeURIComponent(mobileDigits)}`);
    } catch { return null; }
  };

  const handleSelectRider = async (r) => {
    const name = r?.full_name || r?.name || "";
    const phone = sanitizeNumericInput(r?.mobile || r?.phone || "", 10);
    const aadhaar = sanitizeNumericInput(r?.aadhaar || "", 12);
    const gender = r?.gender || "";
    const dobRaw = r?.dob || r?.date_of_birth || "";
    const dob = dobRaw ? String(dobRaw).slice(0, 10) : "";
    const riderMeta = parseMaybeJson(r?.meta) || {};
    const riderCode = String(r?.rider_code || riderMeta?.rider_code || riderMeta?.riderCode || "").trim();
    const permanentAddress = r?.permanent_address || r?.permanentAddress || "";
    const temporaryAddress = r?.temporary_address || r?.temporaryAddress || "";
    const reference = r?.reference || "";
    const inferredZone = String(riderMeta?.zone || r?.operationalZone || r?.zone || "").trim() || "";
    const preferZoneFromRentals = !inferredZone;

    updateForm({
      name, phone, aadhaar, gender, dob, reference,
      permanentAddress, temporaryAddress, operationalZone: inferredZone,
      riderCode, aadhaarVerified: Boolean(aadhaar),
      isRetainRider: true,
      existingRiderId: r?.id || null,
      activeRentalId: null,
    });

    setSelectedRiderSnapshot({
      name, phone, aadhaar, gender, dob, reference,
      permanentAddress, temporaryAddress, operationalZone: inferredZone,
      rider_code: riderCode, riderCode,
      existingRiderId: r?.id || null,
      photoUrl: r?.photo_url || r?.photoUrl || null,
      lastRideAt: r?.last_ride_at || r?.last_rental_end || r?.updated_at || null,
      totalRides: r?.total_rides ?? null,
      lastVehicleNumber: r?.last_vehicle_number || r?.vehicle_number || null,
      kycVerifiedAt: r?.kyc_verified_at || r?.kyc_at || (aadhaar ? r?.updated_at : null),
    });
    setResults([]);
    setSearchError("");

    const active = await prefillFromActiveRental({ mobileDigits: phone });
    if (active?.id) {
      const activeMeta = parseMaybeJson(active?.meta) || {};
      const expectedEnd = active?.expected_end_time || activeMeta?.expected_end_time || "";
      updateForm({
        activeRentalId: active.id,
        rentalStart: toDateTimeLocal(active.start_time),
        rentalPackage: active.rental_package || formData.rentalPackage || "daily",
        bikeId: String(active.bike_id || "").trim() || formData.bikeId,
        batteryId: String(active.current_battery_id || active.battery_id || "").trim() || formData.batteryId,
        operationalZone:
          inferredZone || (preferZoneFromRentals ? String(activeMeta?.zone || "").trim() : "") || "",
      });
      setActiveRideExpectedEnd(expectedEnd);
      setActiveRideStart(active?.start_time || "");
    } else {
      setActiveRideExpectedEnd("");
      setActiveRideStart("");
      await prefillFromLastRental(r?.id, { preferZone: preferZoneFromRentals });
    }

    // Auto-advance to Step 2 after selecting a rider
    setCurrentStep(2);
  };

  const handleChangeRider = () => {
    resetForm();
    setSelectedRiderSnapshot(null);
    setResults([]);
    setHasSearched(false);
    setSearchValue("");
    setActiveRideExpectedEnd("");
    setActiveRideStart("");
    setCurrentStep(1);
    setRetainSuccess(false);
    setCompleted(false);
    setConfirmAccepted(false);
  };

  // ---------------------------------------------------------------------
  // Vehicle / battery dropdown plumbing
  // ---------------------------------------------------------------------

  const filteredVehicleGroups = useMemo(
    () => filterVehicleIdGroups(vehicleQuery, getVehicleIdGroupsForModel(formData.bikeModel)),
    [vehicleQuery, formData.bikeModel]
  );
  const filteredVehicleIds = useMemo(() => flattenVehicleIdGroups(filteredVehicleGroups), [filteredVehicleGroups]);
  const filteredBatteryIds = useMemo(() => {
    const q = String(batteryQuery || "").trim().toUpperCase();
    return q ? BATTERY_ID_OPTIONS.filter((id) => id.includes(q)) : BATTERY_ID_OPTIONS;
  }, [batteryQuery]);

  useEffect(() => {
    if (!vehicleDropdownOpen && !batteryDropdownOpen) return;
    const onMouseDown = (e) => {
      const root = vehicleDropdownRef.current;
      const batteryRoot = batteryDropdownRef.current;
      if (vehicleDropdownOpen && root && !root.contains(e.target)) setVehicleDropdownOpen(false);
      if (batteryDropdownOpen && batteryRoot && !batteryRoot.contains(e.target)) setBatteryDropdownOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [vehicleDropdownOpen, batteryDropdownOpen]);

  const selectVehicleId = (id) => {
    updateForm({ bikeId: id });
    setVehicleDropdownOpen(false);
    setVehicleQuery("");
  };
  const selectBatteryId = (id) => {
    updateForm({ batteryId: id });
    setBatteryDropdownOpen(false);
    setBatteryQuery("");
  };

  // ---------------------------------------------------------------------
  // Payment + ICICI
  // ---------------------------------------------------------------------

  const [publicConfig, setPublicConfig] = useState({ upiId: null, payeeName: "Evegah" });
  useEffect(() => { getPublicConfig().then(setPublicConfig); }, []);

  const configuredUpiId = import.meta.env.VITE_EVEGAH_UPI_ID || publicConfig.upiId;
  const defaultUpiId = "temp.evegah@okaxis";
  const effectiveUpiId = configuredUpiId || defaultUpiId;
  const payeeName = import.meta.env.VITE_EVEGAH_PAYEE_NAME || publicConfig.payeeName || "Evegah";
  const iciciEnabled =
    String(import.meta.env.VITE_ICICI_ENABLED || "")
      .trim().replace(/^"+|"+$/g, "").toLowerCase() === "true";

  const rentalAmount = Number(formData.rentalAmount || 0);
  const securityDeposit = Number(formData.securityDeposit || 0);
  const accessoryAmount = (Array.isArray(formData.accessories) ? formData.accessories.length : 0) * 25;
  const gstAmount = Math.round(rentalAmount * 0.18);
  const totalBeforeDeposit = rentalAmount + accessoryAmount + gstAmount + (formData.batteryRent || 0);

  // Final payable: total minus deposit (deposit applied as credit)
  const depositAdjustment = applyDeposit ? securityDeposit : 0;
  const finalPayable = Math.max(0, totalBeforeDeposit - depositAdjustment);

  // Keep formData totals in sync so handleComplete uses the right numbers.
  useEffect(() => {
    updateForm({ totalAmount: finalPayable });
  }, [finalPayable]); // eslint-disable-line react-hooks/exhaustive-deps

  const paymentMode = METHOD_TO_MODE[paymentMethod] || "cash";
  useEffect(() => {
    updateForm({
      paymentMode,
      cashAmount: paymentMode === "cash" ? finalPayable : 0,
      onlineAmount: paymentMode === "online" ? finalPayable : 0,
    });
  }, [paymentMode, finalPayable]); // eslint-disable-line react-hooks/exhaustive-deps

  const qrAmount = paymentMode === "online" ? finalPayable : 0;
  const shouldShowQR = paymentMode === "online" && qrAmount > 0;

  const upiPayload = useMemo(() => {
    if (!effectiveUpiId || !shouldShowQR) return "";
    const params = new URLSearchParams({
      pa: effectiveUpiId, pn: payeeName, am: String(qrAmount), cu: "INR",
    });
    return `upi://pay?${params.toString()}`;
  }, [effectiveUpiId, payeeName, qrAmount, shouldShowQR]);

  const [iciciQrData, setIciciQrData] = useState(null);
  const [iciciQrLoading, setIciciQrLoading] = useState(false);
  const [iciciQrError, setIciciQrError] = useState("");
  const [iciciTxnStatus, setIciciTxnStatus] = useState("");
  const [iciciTxnError, setIciciTxnError] = useState("");
  const [iciciTxnVerified, setIciciTxnVerified] = useState(false);

  const iciciMerchantTranId = useMemo(() => {
    const v = formData?.iciciMerchantTranId || formData?.merchantTranId
      || iciciQrData?.merchantTranId || iciciQrData?.merchant_tran_id || null;
    return String(v || "").trim() || null;
  }, [formData?.iciciMerchantTranId, formData?.merchantTranId, iciciQrData]);

  useEffect(() => {
    if (!iciciEnabled || !shouldShowQR || !qrAmount || !formData.name) {
      setIciciQrData(null); setIciciQrError(""); return;
    }
    let cancelled = false;
    (async () => {
      setIciciQrLoading(true); setIciciQrError("");
      try {
        const response = await apiFetch("/api/payments/icici/qr", {
          method: "POST",
          body: {
            amount: qrAmount, transactionType: "RETAIN_RIDER",
            riderId: formData.existingRiderId || null,
            rentalId: formData.activeRentalId || null,
            merchantTranId: `EVG${Date.now()}${Math.random().toString(16).slice(2, 6)}`.slice(0, 35),
            billNumber: `EVG-${Date.now()}`.slice(0, 50),
          },
        });
        if (cancelled) return;
        setIciciQrData(response);
        const m = String(response?.merchantTranId || response?.merchant_tran_id || "").trim();
        const p = String(response?.paymentTransactionId || response?.payment_transaction_id || "").trim();
        updateForm({
          ...(m ? { iciciMerchantTranId: m, merchantTranId: m } : {}),
          ...(p ? { paymentTransactionId: p } : {}),
        });
      } catch (error) {
        if (!cancelled) {
          const details = String(error?.data?.details || "").trim();
          setIciciQrError(details ? `${String(error?.message || error)} (${details})` : String(error?.message || error));
        }
      } finally { if (!cancelled) setIciciQrLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [iciciEnabled, shouldShowQR, qrAmount, formData.name, formData.existingRiderId, formData.activeRentalId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!iciciEnabled || !shouldShowQR) {
      setIciciTxnStatus(""); setIciciTxnError(""); setIciciTxnVerified(false); return;
    }
    if (!iciciMerchantTranId || retainSuccess || paymentMode === "cash") {
      setIciciTxnStatus(""); setIciciTxnError(""); setIciciTxnVerified(false); return;
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
        if (next === "SUCCESS") { if (!cancelled) setIciciTxnVerified(true); if (intervalId) window.clearInterval(intervalId); }
        else if (next === "FAILURE" || next === "FAILED") { if (!cancelled) setIciciTxnVerified(false); if (intervalId) window.clearInterval(intervalId); }
        else if (attempts >= maxAttempts) { if (intervalId) window.clearInterval(intervalId); }
      } catch (e) { if (!cancelled) setIciciTxnError(String(e?.message || e || "Unable to check payment status")); }
    };
    poll();
    intervalId = window.setInterval(poll, 5000);
    return () => { cancelled = true; if (intervalId) window.clearInterval(intervalId); };
  }, [iciciEnabled, shouldShowQR, iciciMerchantTranId, retainSuccess, paymentMode]);

  // ---------------------------------------------------------------------
  // Documents (pre-ride photos)
  // ---------------------------------------------------------------------

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const getImageDataUrl = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && typeof value.dataUrl === "string") return value.dataUrl;
    return "";
  };
  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Unable to read file"));
      reader.readAsDataURL(file);
    });
  const validateImageFile = (file) => {
    if (!file) return "No file selected";
    if (!String(file.type || "").startsWith("image/")) return "Please select an image file";
    if (file.size > MAX_IMAGE_BYTES) return "Image must be 5MB or smaller";
    return "";
  };
  const handlePreRidePhotosPick = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const current = Array.isArray(formData.preRidePhotos) ? formData.preRidePhotos : [];
    const remainingSlots = Math.max(0, 8 - current.length);
    if (remainingSlots === 0) { setPaymentError("You can upload up to 8 pre-ride photos."); return; }
    const picked = list.slice(0, remainingSlots);
    try {
      const uploads = await Promise.all(picked.map(async (file) => {
        const v = validateImageFile(file);
        if (v) throw new Error(v);
        const dataUrl = await readFileAsDataUrl(file);
        return { name: file.name, type: file.type, size: file.size, dataUrl, updatedAt: new Date().toISOString() };
      }));
      updateForm({ preRidePhotos: [...current, ...uploads] });
    } catch (e) { setPaymentError(String(e?.message || e || "Unable to upload pre-ride photos")); }
  };

  // ---------------------------------------------------------------------
  // Submit (handleComplete)
  // ---------------------------------------------------------------------

  const handleComplete = async () => {
    setPaymentError(""); setRetainSuccess(false);
    if (!formData.existingRiderId) return setPaymentError("Select a rider before completing payment.");
    if (!String(formData.name || "").trim()) return setPaymentError("Rider name is missing. Re-select the rider.");
    if (String(formData.phone || "").replace(/\D/g, "").slice(0, 10).length !== 10) return setPaymentError("Valid 10-digit mobile number is required.");
    if (!formData.rentalStart) return setPaymentError("Rental start date & time is required.");

    const isUpdatingActiveRental = Boolean(formData.activeRentalId);
    const startMs = formData.rentalStart ? new Date(formData.rentalStart).getTime() : NaN;
    const activeStartMs = activeRideStart ? new Date(activeRideStart).getTime() : NaN;
    const activeEndMs = activeRideExpectedEnd ? new Date(activeRideExpectedEnd).getTime() : NaN;
    const canScheduleAfterActive = isUpdatingActiveRental && Number.isFinite(startMs) && Number.isFinite(activeEndMs) && startMs >= activeEndMs;
    const creatingNewBooking = !isUpdatingActiveRental || canScheduleAfterActive;

    if (isUpdatingActiveRental && !creatingNewBooking) {
      if (Number.isFinite(activeEndMs) && Number.isFinite(startMs)) {
        if (Number.isFinite(activeStartMs) && startMs !== activeStartMs && startMs < activeEndMs) {
          return setPaymentError("Retain ride start must be after the current active ride end time.");
        }
      }
    }

    if (iciciEnabled && paymentMode !== "cash") {
      if (!iciciMerchantTranId) return setPaymentError("ICICI payment reference not found. Generate the QR and complete payment.");
      if (!iciciTxnVerified) {
        try {
          const decoded = await apiFetch("/api/payments/icici/status", {
            method: "POST", body: { merchantTranId: iciciMerchantTranId },
          });
          const raw = String(decoded?.status || decoded?.Status || "").trim().toUpperCase();
          setIciciTxnStatus(raw);
          if (raw !== "SUCCESS") return setPaymentError(`Payment not completed. Current status: ${raw || "PENDING"}.`);
          setIciciTxnVerified(true);
        } catch (e) { return setPaymentError(String(e?.message || e || "Unable to verify payment.")); }
      }
    }

    if (creatingNewBooking) {
      if (!Array.isArray(formData.preRidePhotos) || formData.preRidePhotos.length === 0) {
        return setPaymentError("Upload at least one pre-ride vehicle photo in the Documents step.");
      }
      if (formData.bikeId && unavailableVehicleSet.has(normalizeIdForCompare(formData.bikeId))) return setPaymentError("Selected vehicle is unavailable.");
      if (!isDefaultBatteryModel && formData.batteryId && unavailableBatterySet.has(normalizeIdForCompare(formData.batteryId))) return setPaymentError("Selected battery is unavailable.");
    }

    setSavingPayment(true);
    try {
      const startIso = new Date(formData.rentalStart).toISOString();
      const endIso = formData.rentalEnd ? new Date(formData.rentalEnd).toISOString() : null;
      const issuedByName = (formData.issuedByName || user?.displayName || user?.email || "Employee").trim();

      const iciciMTI = String(formData?.iciciMerchantTranId || formData?.merchantTranId || "").trim() || null;
      const paymentTransactionId = String(formData?.paymentTransactionId || "").trim() || null;

      let savedRental = null;
      if (isUpdatingActiveRental && !creatingNewBooking) {
        savedRental = await apiFetch(`/api/rentals/${encodeURIComponent(formData.activeRentalId)}`, {
          method: "PATCH",
          body: {
            rental_package: formData.rentalPackage || null,
            rental_amount: Number(formData.rentalAmount || 0),
            deposit_amount: Number(formData.securityDeposit || 0),
            total_amount: Number(finalPayable || 0),
            payment_mode: paymentMode,
            bike_model: formData.bikeModel || null,
            expected_end_time: endIso,
            meta: {
              issued_by_name: issuedByName,
              purpose,
              additional_notes: additionalNotes || null,
              paymentBreakdown: { cash: paymentMode === "cash" ? finalPayable : 0, online: paymentMode === "online" ? finalPayable : 0 },
              ...(iciciMTI ? { iciciMerchantTranId: iciciMTI, merchantTranId: iciciMTI } : {}),
              ...(paymentTransactionId ? { paymentTransactionId } : {}),
            },
          },
        });
      } else {
        savedRental = await apiFetch("/api/rentals", {
          method: "POST",
          body: {
            rider_id: formData.existingRiderId,
            start_time: startIso, end_time: endIso,
            vehicle_number: formData.vehicleNumber || formData.bikeId || null,
            rental_package: formData.rentalPackage || null,
            rental_amount: Number(formData.rentalAmount || 0),
            deposit_amount: Number(formData.securityDeposit || 0),
            total_amount: Number(finalPayable || 0),
            payment_mode: paymentMode,
            bike_model: formData.bikeModel || null,
            bike_id: formData.bikeId || null,
            battery_id: formData.batteryId || null,
            accessories: Array.isArray(formData.accessories) ? formData.accessories : [],
            other_accessories: additionalNotes || null,
            meta: {
              zone: formData.operationalZone || null,
              issued_by_name: issuedByName,
              purpose,
              additional_notes: additionalNotes || null,
              employee_uid: user?.uid || null,
              employee_email: user?.email || null,
              paymentBreakdown: { cash: paymentMode === "cash" ? finalPayable : 0, online: paymentMode === "online" ? finalPayable : 0 },
              ...(iciciMTI ? { iciciMerchantTranId: iciciMTI, merchantTranId: iciciMTI } : {}),
              ...(paymentTransactionId ? { paymentTransactionId } : {}),
            },
            documents: {
              preRidePhotos: Array.isArray(formData.preRidePhotos) ? formData.preRidePhotos : [],
            },
          },
        });
      }

      setCompleted(true);
      setRegistration({
        id: formData.existingRiderId,
        rentalId: savedRental?.id || formData.activeRentalId || null,
        ...(iciciMTI ? { merchantTranId: iciciMTI, iciciMerchantTranId: iciciMTI } : {}),
        ...(paymentTransactionId ? { paymentTransactionId } : {}),
      });
      setRetainSuccess(true);
    } catch (e) {
      setPaymentError(String(e?.message || e || "Unable to save payment"));
    } finally {
      setSavingPayment(false);
    }
  };

  // ---------------------------------------------------------------------
  // Receipt / WhatsApp (unchanged from previous logic)
  // ---------------------------------------------------------------------

  const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Unable to read file"));
      reader.readAsDataURL(blob);
    });
  const fetchUrlAsDataUrl = async (url) => {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Unable to fetch file (HTTP ${res.status})`);
    return blobToDataUrl(await res.blob());
  };
  const hydrateReceiptPayload = async ({ riderId, basePayload }) => {
    const next = { ...(basePayload || {}) };
    if (!next.riderCode) {
      const candidate = String(selectedRiderSnapshot?.rider_code || selectedRiderSnapshot?.riderCode || formData?.riderCode || "").trim();
      if (candidate) next.riderCode = candidate;
    }
    if (!next.riderSignature || !String(next.riderSignature).startsWith("data:image/")) {
      try {
        if (riderId) {
          const docs = await apiFetch(`/api/riders/${encodeURIComponent(riderId)}/documents`);
          const rows = Array.isArray(docs) ? docs : [];
          const sig = rows.find((d) => String(d?.kind || "").toLowerCase() === "rider_signature" && d?.url);
          if (sig?.url) {
            const dataUrl = await fetchUrlAsDataUrl(String(sig.url));
            if (dataUrl?.startsWith("data:image/")) {
              next.riderSignature = dataUrl;
              if (!next.agreementAccepted) next.agreementAccepted = true;
              if (!next.agreementDate && sig.created_at) next.agreementDate = sig.created_at;
            }
          }
        }
      } catch { /* ignore */ }
    }
    return next;
  };
  const buildReceiptPayload = (snapshot) => ({
    fullName: snapshot?.fullName || snapshot?.name || "",
    name: snapshot?.name || snapshot?.fullName || "",
    phone: snapshot?.phone || "",
    mobile: snapshot?.mobile || snapshot?.phone || "",
    aadhaar: snapshot?.aadhaar || "",
    dob: snapshot?.dob || null,
    gender: snapshot?.gender || "",
    reference: snapshot?.reference || "",
    permanentAddress: snapshot?.permanentAddress || "",
    temporaryAddress: snapshot?.temporaryAddress || "",
    operationalZone: snapshot?.operationalZone || snapshot?.zone || "",
    agreementAccepted: Boolean(snapshot?.agreementAccepted),
    agreementDate: snapshot?.agreementDate || null,
    issuedByName: snapshot?.issuedByName || null,
    rentalStart: snapshot?.rentalStart || null,
    rentalEnd: snapshot?.rentalEnd || null,
    rentalPackage: snapshot?.rentalPackage || null,
    bikeModel: snapshot?.bikeModel || null,
    bikeId: snapshot?.bikeId || null,
    batteryId: snapshot?.batteryId || null,
    vehicleNumber: snapshot?.vehicleNumber || snapshot?.bikeId || null,
    accessories: Array.isArray(snapshot?.accessories) ? snapshot.accessories : [],
    otherAccessories: snapshot?.otherAccessories || null,
    paymentMode: snapshot?.paymentMode || null,
    rentalAmount: snapshot?.rentalAmount ?? null,
    securityDeposit: snapshot?.securityDeposit ?? null,
    totalAmount: snapshot?.totalAmount ?? null,
    amountPaid: snapshot?.amountPaid ?? snapshot?.paidAmount ?? snapshot?.totalAmount ?? null,
    merchantTranId: snapshot?.merchantTranId || snapshot?.iciciMerchantTranId || null,
    iciciMerchantTranId: snapshot?.iciciMerchantTranId || snapshot?.merchantTranId || null,
    paymentTransactionId: snapshot?.paymentTransactionId || null,
    riderSignature: typeof snapshot?.riderSignature === "string" ? snapshot.riderSignature : null,
  });

  const handleDownloadReceipt = async () => {
    setWhatsAppStatus(""); setWhatsAppStatusType(""); setWhatsAppFallback(null);
    try {
      const snapshot = { ...(selectedRiderSnapshot || {}), ...(formData || {}) };
      const base = buildReceiptPayload(snapshot);
      const hydrated = await hydrateReceiptPayload({ riderId: snapshot?.existingRiderId || formData?.existingRiderId, basePayload: base });
      const reg = { ...(registration || {}), riderCode: String(hydrated?.riderCode || registration?.riderCode || "").trim() || undefined };
      await downloadRiderReceiptPdf({ formData: hydrated, registration: reg });
    } catch (e) {
      setWhatsAppStatusType("error");
      setWhatsAppStatus(e?.message ? `Unable to generate receipt: ${e.message}` : "Unable to generate receipt.");
    }
  };

  const handleSendWhatsApp = async () => {
    setWhatsAppStatus(""); setWhatsAppStatusType(""); setWhatsAppFallback(null);
    const snapshot = { ...(selectedRiderSnapshot || {}), ...(formData || {}) };
    const phoneDigits = String(snapshot?.phone || "").replace(/\D/g, "").slice(0, 10);
    if (phoneDigits.length !== 10) {
      setWhatsAppStatusType("error");
      setWhatsAppStatus("Valid 10-digit mobile number is required.");
      return;
    }
    const receiptPayload = buildReceiptPayload(snapshot);
    setSendingWhatsApp(true);
    try {
      const res = await apiFetch("/api/whatsapp/send-receipt", {
        method: "POST",
        body: { to: phoneDigits, formData: receiptPayload, registration },
      });
      if (res?.sent) { setWhatsAppStatusType("success"); setWhatsAppStatus("Receipt sent to rider successfully."); }
      else if (res?.mediaUrl) {
        setWhatsAppFallback({ phoneDigits, mediaUrl: res.mediaUrl });
        setWhatsAppStatusType("error");
        setWhatsAppStatus(String(res?.reason || res?.error || "Failed to send receipt on WhatsApp."));
      } else {
        setWhatsAppStatusType("error");
        setWhatsAppStatus(String(res?.reason || res?.error || "Failed to send receipt on WhatsApp."));
      }
    } catch (e) {
      setWhatsAppStatusType("error");
      setWhatsAppStatus(String(e?.message || e || "Failed to send receipt on WhatsApp."));
    } finally { setSendingWhatsApp(false); }
  };

  // ---------------------------------------------------------------------
  // Navigation guards between steps
  // ---------------------------------------------------------------------

  const canGoToStep = (n) => {
    if (n <= 1) return true;
    if (!selected) return false;
    if (n >= 3 && !formData.bikeId) return false;
    return true;
  };

  const goPrev = () => setCurrentStep((s) => Math.max(1, s - 1));
  const goNext = () => {
    if (currentStep === 1 && !selected) { setSearchError("Select a rider before continuing."); return; }
    if (currentStep === 2) {
      if (!formData.rentalStart) { setPaymentError("Set ride start date & time."); return; }
      if (!formData.bikeId) { setPaymentError("Select a vehicle."); return; }
      setPaymentError("");
    }
    if (currentStep === 4) {
      if (!Array.isArray(formData.preRidePhotos) || formData.preRidePhotos.length === 0) {
        setPaymentError("Upload at least one vehicle photo.");
        return;
      }
      setPaymentError("");
    }
    setCurrentStep((s) => Math.min(5, s + 1));
  };

  const handleStepClick = (n) => {
    if (canGoToStep(n)) setCurrentStep(n);
  };

  // ---------------------------------------------------------------------
  // Right rail content per step
  // ---------------------------------------------------------------------

  const RiderSummaryCard = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={16} className="text-evegah-primary" />
        <h3 className="text-sm font-bold text-evegah-text">Rider Summary</h3>
      </div>
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-full bg-brand-light text-evegah-primary grid place-items-center text-sm font-bold shrink-0">
          {initialsFrom(formData.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-evegah-text truncate flex items-center gap-1.5">
            {formData.name || "—"}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5">
              <BadgeCheck size={10} /> KYC Verified
            </span>
          </p>
          <p className="text-xs text-gray-500 inline-flex items-center gap-1">
            <Phone size={11} /> +91 {formData.phone || "—"}
          </p>
          {selectedRiderSnapshot?.rider_code ? (
            <p className="text-xs text-gray-500">Rider ID: {selectedRiderSnapshot.rider_code}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5 pt-3 border-t border-evegah-border">
        <SummaryRow label="Last Ride" value={formatDate(selectedRiderSnapshot?.lastRideAt)} />
        <SummaryRow label="Total Rides" value={selectedRiderSnapshot?.totalRides ?? "—"} />
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
        <SummaryRow label="Ride Start" value={formatDateTimeShort(formData.rentalStart)} />
        <SummaryRow label="Expected Return" value={formatDateTimeShort(formData.rentalEnd)} />
        <SummaryRow label="Rental Plan" value={formData.rentalPackage ? formData.rentalPackage.replace(/^./, (c) => c.toUpperCase()) : "—"} />
        {formData.bikeId ? <SummaryRow label="Vehicle" value={`${formData.bikeId}${formData.bikeModel ? ` (${formData.bikeModel})` : ""}`} /> : null}
        {formData.batteryId ? <SummaryRow label="Battery" value={formData.batteryId} /> : null}
        <SummaryRow label="Purpose" value={purpose} />
      </div>
    </div>
  );

  const PaymentSummaryCard = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={16} className="text-evegah-primary" />
        <h3 className="text-sm font-bold text-evegah-text">Payment Summary</h3>
      </div>
      <div className="space-y-2">
        <SummaryRow label="Total Amount" value={formatINR(totalBeforeDeposit)} />
        {applyDeposit && securityDeposit > 0 ? (
          <SummaryRow label="Deposit Applied" value={`- ${formatINR(securityDeposit)}`} valueClass="text-emerald-600" />
        ) : null}
        <div className="pt-2 border-t border-evegah-border">
          <SummaryRow label="Final Amount Payable" value={formatINR(finalPayable)} valueClass="text-evegah-primary text-base" />
        </div>
      </div>
    </div>
  );

  const renderRightRail = () => {
    if (currentStep === 1) {
      return (
        <>
          <HelperCard title="Why search existing rider?" icon={Search} tint="purple">
            {[
              "Faster registration process",
              "No need to re-enter KYC details",
              "View previous ride history",
              "Track dues and wallet balance",
            ].map((t) => (
              <div key={t} className="flex items-start gap-2">
                <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </HelperCard>
          <NeedHelpCard />
        </>
      );
    }
    if (currentStep === 2) {
      return (
        <>
          <RiderSummaryCard />
          <HelperCard title="Tips" icon={Lightbulb} tint="amber">
            <p>• Select the right vehicle and battery based on availability.</p>
            <p>• Ensure expected return date &amp; time is correct.</p>
            <p>• You can add accessories if required.</p>
          </HelperCard>
          <NeedHelpCard />
        </>
      );
    }
    if (currentStep === 3) {
      return (
        <>
          <RiderSummaryCard />
          <RideSummaryCard />
          <NeedHelpCard />
        </>
      );
    }
    if (currentStep === 4) {
      return (
        <>
          <RiderSummaryCard />
          <RideSummaryCard />
          <NeedHelpCard />
        </>
      );
    }
    return (
      <>
        <RideSummaryCard />
        <PaymentSummaryCard />
        <HelperCard title="Please Confirm" icon={CircleAlert} tint="amber">
          {[
            "All details are correct.",
            "Documents are verified.",
            "Payment is reviewed.",
            "I have read and agree to the terms & conditions.",
          ].map((t) => (
            <div key={t} className="flex items-start gap-2">
              <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
              <span>{t}</span>
            </div>
          ))}
        </HelperCard>
        <NeedHelpCard />
      </>
    );
  };

  // ---------------------------------------------------------------------
  // Step bodies
  // ---------------------------------------------------------------------

  const renderStep1 = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-evegah-text">Search Existing Rider</h2>
        <p className="text-sm text-gray-500">Search by any one of the following</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-evegah-border">
        <div className="flex flex-wrap gap-2 -mb-px">
          {SEARCH_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeSearchTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveSearchTab(t.id);
                  setSearchValue("");
                  setSearchError("");
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-evegah-primary text-evegah-primary"
                    : "border-transparent text-gray-500 hover:text-evegah-text"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search input */}
      <div className="flex flex-col sm:flex-row gap-3">
        {activeSearchTab === "mobile" ? (
          <div className="flex flex-1 items-stretch rounded-xl border border-evegah-border overflow-hidden bg-white">
            <span className="inline-flex items-center px-3 bg-evegah-bg text-sm text-gray-600 border-r border-evegah-border">+91</span>
            <input
              type="tel"
              placeholder="Enter 10 digit mobile number"
              className="flex-1 px-3 py-3 text-sm outline-none"
              value={searchValue}
              inputMode="numeric"
              maxLength={10}
              onChange={(e) => setSearchValue(sanitizeNumericInput(e.target.value, 10))}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
        ) : (
          <input
            type={activeSearchTab === "aadhaar" ? "tel" : "text"}
            placeholder={
              activeSearchTab === "riderId" ? "Enter Rider ID (e.g. RDR00124)" :
              activeSearchTab === "aadhaar" ? "Enter 12 digit Aadhaar number" :
              "Enter rider name"
            }
            className="flex-1 px-4 py-3 text-sm rounded-xl border border-evegah-border bg-white outline-none focus:border-evegah-primary"
            value={searchValue}
            onChange={(e) => setSearchValue(activeSearchTab === "aadhaar" ? sanitizeNumericInput(e.target.value, 12) : e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        )}
        <button
          type="button"
          onClick={handleSearch}
          disabled={searchLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-evegah-primary text-white px-6 py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
        >
          <Search size={16} />
          {searchLoading ? "Searching…" : "Search"}
        </button>
      </div>

      {searchError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {searchError}
        </div>
      ) : null}

      {/* Selected banner */}
      {selected ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-emerald-600 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Rider selected: {formData.name}</p>
            <p className="text-xs text-emerald-700">Tap "Save & Continue" to proceed, or change rider below.</p>
          </div>
          <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline" onClick={handleChangeRider}>
            Change Rider
          </button>
        </div>
      ) : null}

      {/* Results */}
      {results.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-evegah-text">Search Results</h3>
              <span className="inline-flex items-center rounded-full bg-brand-light text-evegah-primary text-[11px] font-semibold px-2 py-0.5">
                {results.length} {results.length === 1 ? "Rider" : "Riders"} Found
              </span>
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-evegah-text rounded-lg border border-evegah-border px-2.5 py-1.5"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          <div className="space-y-2">
            {results.map((r) => {
              const name = r?.full_name || r?.name || "—";
              const phone = r?.mobile || r?.phone || "—";
              const aadhaar = r?.aadhaar;
              const lastAt = r?.last_ride_at || r?.last_rental_end || r?.updated_at;
              const lastVehicle = r?.last_vehicle_number || r?.vehicle_number || "—";
              const riderCode = r?.rider_code || parseMaybeJson(r?.meta)?.rider_code || "—";

              return (
                <div key={r.id} className="rounded-2xl border border-evegah-border bg-white p-4 hover:border-evegah-primary/50 transition-colors">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-full bg-brand-light text-evegah-primary grid place-items-center text-sm font-bold shrink-0">
                        {initialsFrom(name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-evegah-text truncate">{name}</p>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5">
                            Returning Rider
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">Rider ID: {riderCode}</p>
                        {aadhaar ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-light text-evegah-primary text-[10px] font-semibold px-1.5 py-0.5 mt-1">
                            <BadgeCheck size={10} /> KYC Verified
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                      <div className="space-y-0.5">
                        <p className="inline-flex items-center gap-1.5"><Phone size={12} className="text-evegah-primary" /> +91 {phone}</p>
                        <p className="inline-flex items-center gap-1.5"><IdCard size={12} className="text-evegah-primary" /> Aadhaar: {maskAadhaar(aadhaar)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="inline-flex items-center gap-1.5"><Calendar size={12} className="text-evegah-primary" /> Last Ride: {formatDate(lastAt)}</p>
                        <p className="inline-flex items-center gap-1.5"><Bike size={12} className="text-evegah-primary" /> Vehicle: {lastVehicle}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectRider(r)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-4 py-2.5 text-sm font-semibold hover:opacity-95"
                    >
                      Select Rider <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
            <span>Showing 1 to {results.length} of {results.length} riders</span>
          </div>
        </div>
      ) : null}

      {!hasSearched && !selected ? (
        <div className="rounded-2xl border border-dashed border-evegah-border bg-evegah-bg p-8 text-center text-sm text-gray-500">
          Search for an existing rider using one of the options above to begin.
        </div>
      ) : null}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      {/* Selected rider banner */}
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Selected Rider</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-brand-light text-evegah-primary grid place-items-center text-sm font-bold shrink-0">
            {initialsFrom(formData.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-evegah-text">{formData.name}</p>
            <p className="text-xs text-gray-500">+91 {formData.phone} · Rider ID: {selectedRiderSnapshot?.rider_code || formData.riderCode || "—"}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2 py-0.5">
            <BadgeCheck size={12} /> KYC Verified
          </span>
          <div className="ml-auto flex items-center gap-5 text-xs text-gray-600">
            <div className="inline-flex items-center gap-1.5"><Calendar size={14} className="text-evegah-primary" /> Last Ride: {formatDate(selectedRiderSnapshot?.lastRideAt)}</div>
            <div className="inline-flex items-center gap-1.5"><Hash size={14} className="text-evegah-primary" /> Total Rides: {selectedRiderSnapshot?.totalRides ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* Rental Details */}
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-bold text-evegah-text">Rental Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Ride Start Date &amp; Time *</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
              value={formData.rentalStart || ""}
              onChange={(e) => updateForm({ rentalStart: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Rental Plan *</label>
            <select
              className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
              value={formData.rentalPackage || "daily"}
              onChange={(e) => updateForm({ rentalPackage: e.target.value })}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Return Date &amp; Time *</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
              value={formData.rentalEnd || ""}
              onChange={(e) => updateForm({ rentalEnd: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Purpose of Ride (Optional)</label>
            <select
              className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            >
              <option>Personal Use</option>
              <option>Commercial Use</option>
              <option>Food Delivery</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        {/* Vehicle + Battery selectors as cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vehicle */}
          <div className="rounded-2xl border border-evegah-border p-4">
            <p className="text-sm font-bold text-evegah-text mb-1">Select Vehicle *</p>
            <p className="text-xs text-gray-500 mb-3">Choose a vehicle for this ride</p>
            <div ref={vehicleDropdownRef} className="relative">
              <button
                type="button"
                className="w-full rounded-xl border border-evegah-border bg-evegah-bg/40 p-3 flex items-center gap-3 hover:border-evegah-primary"
                onClick={() => {
                  setVehicleDropdownOpen((v) => {
                    const next = !v;
                    if (!v && next) setTimeout(() => vehicleQueryRef.current?.focus(), 0);
                    return next;
                  });
                }}
              >
                <div className="h-10 w-10 rounded-lg bg-white grid place-items-center text-evegah-primary border border-evegah-border">
                  <Bike size={18} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-evegah-text truncate">{formData.bikeId || "Select vehicle"}</p>
                  <p className="text-xs text-gray-500 truncate">{formData.bikeModel || "Choose model"}</p>
                </div>
                {formData.bikeId ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5">Available</span>
                ) : null}
                <span className="text-gray-400">▾</span>
              </button>

              {vehicleDropdownOpen ? (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-evegah-border bg-white shadow-lg p-2">
                  <select
                    className="w-full rounded-lg border border-evegah-border bg-white px-3 py-2 text-sm mb-2"
                    value={formData.bikeModel || ""}
                    onChange={(e) => updateForm({ bikeModel: e.target.value })}
                  >
                    <option value="">Select model</option>
                    {VEHICLE_MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input
                    ref={vehicleQueryRef}
                    className="w-full rounded-lg border border-evegah-border bg-white px-3 py-2 text-sm mb-2"
                    placeholder="Search vehicle id…"
                    value={vehicleQuery}
                    onChange={(e) => setVehicleQuery(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto">
                    {filteredVehicleIds.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-gray-500">No matching vehicle id.</p>
                    ) : (
                      filteredVehicleGroups.map((group) => (
                        <div key={group.label}>
                          <p className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">{group.label}</p>
                          {(group.ids || []).map((id) => {
                            const unavailable = unavailableVehicleSet.has(normalizeIdForCompare(id));
                            return (
                              <button
                                key={id} type="button" disabled={unavailable}
                                className={`w-full text-left rounded-lg px-2 py-1.5 text-xs ${unavailable ? "text-gray-400 cursor-not-allowed" : "hover:bg-gray-50"} ${id === formData.bikeId ? "bg-brand-light" : ""}`}
                                onClick={() => !unavailable && selectVehicleId(id)}
                              >
                                {id}{unavailable ? " (Unavailable)" : ""}
                              </button>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Battery */}
          <div className="rounded-2xl border border-evegah-border p-4">
            <p className="text-sm font-bold text-evegah-text mb-1">Select Battery *</p>
            <p className="text-xs text-gray-500 mb-3">Choose a battery for this ride</p>
            <div ref={batteryDropdownRef} className="relative">
              <button
                type="button"
                disabled={isDefaultBatteryModel}
                className={`w-full rounded-xl border border-evegah-border bg-evegah-bg/40 p-3 flex items-center gap-3 ${isDefaultBatteryModel ? "opacity-60 cursor-not-allowed" : "hover:border-evegah-primary"}`}
                onClick={() => {
                  if (isDefaultBatteryModel) return;
                  setBatteryDropdownOpen((v) => {
                    const next = !v;
                    if (!v && next) setTimeout(() => batteryQueryRef.current?.focus(), 0);
                    return next;
                  });
                }}
              >
                <div className="h-10 w-10 rounded-lg bg-white grid place-items-center text-evegah-primary border border-evegah-border">
                  <Battery size={18} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-evegah-text truncate">
                    {isDefaultBatteryModel ? "Default" : (formData.batteryId || "Select battery")}
                  </p>
                  <p className="text-xs text-gray-500">{isDefaultBatteryModel ? "Non-removable" : "Portable Battery"}</p>
                </div>
                {formData.batteryId ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5">Available</span>
                ) : null}
                {!isDefaultBatteryModel ? <span className="text-gray-400">▾</span> : null}
              </button>

              {batteryDropdownOpen && !isDefaultBatteryModel ? (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-evegah-border bg-white shadow-lg p-2">
                  <input
                    ref={batteryQueryRef}
                    className="w-full rounded-lg border border-evegah-border bg-white px-3 py-2 text-sm mb-2"
                    placeholder="Search battery id…"
                    value={batteryQuery}
                    onChange={(e) => setBatteryQuery(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto">
                    {filteredBatteryIds.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-gray-500">No matching battery id.</p>
                    ) : (
                      filteredBatteryIds.map((id) => {
                        const unavailable = unavailableBatterySet.has(normalizeIdForCompare(id));
                        return (
                          <button
                            key={id} type="button" disabled={unavailable}
                            className={`w-full text-left rounded-lg px-2 py-1.5 text-xs ${unavailable ? "text-gray-400 cursor-not-allowed" : "hover:bg-gray-50"} ${id === formData.batteryId ? "bg-brand-light" : ""}`}
                            onClick={() => !unavailable && selectBatteryId(id)}
                          >
                            {id}{unavailable ? " (Unavailable)" : ""}
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

        {/* Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Rental Amount</label>
            <input
              type="number" min="0"
              className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
              value={formData.rentalAmount ?? ""}
              onChange={(e) => updateForm({ rentalAmount: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Security Deposit</label>
            <input
              type="number" min="0"
              className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
              value={formData.securityDeposit ?? ""}
              onChange={(e) => updateForm({ securityDeposit: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Issued By (Name) *</label>
            <input
              className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
              placeholder="Enter your name"
              value={formData.issuedByName || ""}
              onChange={(e) => updateForm({ issuedByName: e.target.value })}
            />
          </div>
        </div>

        {/* Accessories */}
        <div>
          <label className="block text-sm font-bold text-evegah-text mb-3">Accessories (Optional)</label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {ACCESSORY_OPTIONS.map((a) => {
              const checked = (Array.isArray(formData.accessories) ? formData.accessories : []).includes(a.key);
              return (
                <label
                  key={a.key}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                    checked ? "border-evegah-primary bg-brand-light/30" : "border-evegah-border hover:bg-gray-50"
                  }`}
                >
                  <input type="checkbox" className="accent-evegah-primary" checked={checked} onChange={() => toggleAccessory(a.key)} />
                  <span className="text-sm text-evegah-text">{a.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Additional notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Notes (Optional)</label>
          <textarea
            rows={3}
            maxLength={200}
            placeholder="Enter any additional information…"
            className="w-full rounded-xl border border-evegah-border bg-white px-4 py-3 text-sm outline-none focus:border-evegah-primary"
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-gray-400 text-right">{additionalNotes.length} / 200</p>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-evegah-text">Payment &amp; Charges</h2>
        <p className="text-sm text-gray-500">Review charges, apply deposit (if any) and proceed to payment.</p>
      </div>

      {/* Charges Breakdown */}
      <div className="rounded-2xl border border-evegah-border overflow-hidden">
        <div className="bg-evegah-bg/60 px-4 py-3 border-b border-evegah-border">
          <h3 className="text-sm font-bold text-evegah-text">Charges Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-evegah-border">
              <th className="px-4 py-2 w-12">#</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-evegah-border">
              <td className="px-4 py-3 text-gray-500">1</td>
              <td className="px-4 py-3 text-evegah-text">Vehicle Rent ({formData.rentalPackage ? formData.rentalPackage.replace(/^./, (c) => c.toUpperCase()) : "Daily"})</td>
              <td className="px-4 py-3 text-right font-semibold">{formatINR(rentalAmount)}</td>
            </tr>
            <tr className="border-b border-evegah-border">
              <td className="px-4 py-3 text-gray-500">2</td>
              <td className="px-4 py-3 text-evegah-text">Battery Rent</td>
              <td className="px-4 py-3 text-right font-semibold">{formatINR(0)}</td>
            </tr>
            <tr className="border-b border-evegah-border">
              <td className="px-4 py-3 text-gray-500">3</td>
              <td className="px-4 py-3 text-evegah-text">Accessories</td>
              <td className="px-4 py-3 text-right font-semibold">{formatINR(accessoryAmount)}</td>
            </tr>
            <tr className="border-b border-evegah-border">
              <td className="px-4 py-3 text-gray-500">4</td>
              <td className="px-4 py-3 text-evegah-text">GST (18%)</td>
              <td className="px-4 py-3 text-right font-semibold">{formatINR(gstAmount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="px-4 py-3" />
              <td className="px-4 py-3 font-bold text-evegah-text">Total Amount</td>
              <td className="px-4 py-3 text-right font-bold text-evegah-primary text-base">{formatINR(totalBeforeDeposit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Deposit toggle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-evegah-border p-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-light text-evegah-primary">
            <Wallet size={18} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-evegah-text">Deposit (If Applicable)</p>
            <p className="text-xs text-gray-500">Security Deposit on File</p>
            <p className="text-sm font-bold text-evegah-text mt-0.5">{formatINR(securityDeposit)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-evegah-border p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-evegah-text">Apply Deposit to this Ride</p>
            <p className="text-xs text-gray-500">Deposit will be adjusted from total amount</p>
          </div>
          <button
            type="button"
            onClick={() => setApplyDeposit((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${applyDeposit ? "bg-evegah-primary" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${applyDeposit ? "left-5" : "left-0.5"}`} />
          </button>
          {applyDeposit && securityDeposit > 0 ? (
            <span className="text-sm font-bold text-emerald-600">- {formatINR(securityDeposit)}</span>
          ) : null}
        </div>
      </div>

      {/* Final payable */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
          <Receipt size={18} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-800">Final Amount Payable</p>
          <p className="text-2xl font-bold text-emerald-700">{formatINR(finalPayable)}</p>
        </div>
        {applyDeposit && securityDeposit > 0 ? (
          <span className="inline-flex items-center rounded-full bg-white text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-semibold">
            Deposit Applied: {formatINR(securityDeposit)}
          </span>
        ) : null}
      </div>

      {/* Payment method tiles */}
      <div>
        <h3 className="text-sm font-bold text-evegah-text mb-3">Payment Method</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            const active = paymentMethod === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`text-left rounded-2xl border p-3 transition-colors ${
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
              </button>
            );
          })}
        </div>
      </div>

      {/* QR area for online */}
      {paymentMethod === "upi" && shouldShowQR ? (
        <div className="rounded-2xl border border-evegah-border p-5 flex flex-col items-center gap-3">
          {iciciEnabled ? (
            <>
              {iciciQrLoading ? <p className="text-sm text-gray-500">Generating QR…</p> : null}
              {iciciQrError ? <p className="text-sm text-rose-600">ICICI QR generation failed: {iciciQrError}</p> : null}
              {iciciQrData?.qrCode ? (
                <img
                  src={iciciQrData.qrCode.startsWith("data:") || iciciQrData.qrCode.startsWith("http") ? iciciQrData.qrCode : `data:image/png;base64,${iciciQrData.qrCode}`}
                  alt="ICICI Payment QR"
                  className="h-44 w-44 rounded-xl border border-evegah-border bg-white p-2"
                />
              ) : iciciQrData?.qrString ? (
                <div className="rounded-xl border border-evegah-border bg-white p-2"><QRCodeCanvas value={iciciQrData.qrString} size={180} /></div>
              ) : !iciciQrLoading && !iciciQrError ? (
                <p className="text-sm text-gray-500">ICICI QR not available.</p>
              ) : null}
              {iciciMerchantTranId ? (
                <p className="text-xs text-gray-500">
                  Status: {iciciTxnVerified ? <span className="text-emerald-600 font-semibold">SUCCESS</span> : (iciciTxnStatus || "Waiting…")}
                </p>
              ) : null}
            </>
          ) : upiPayload ? (
            <div className="rounded-xl border border-evegah-border bg-white p-2"><QRCodeCanvas value={upiPayload} size={180} /></div>
          ) : (
            <p className="text-sm text-rose-600">UPI is not configured.</p>
          )}
        </div>
      ) : null}

      {paymentError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">
          {paymentError}
        </div>
      ) : null}
    </div>
  );

  const renderStep4 = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-evegah-text">Documents</h2>
        <p className="text-sm text-gray-500">Review uploaded documents and update if required.</p>
      </div>

      {/* KYC Status */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <BadgeCheck size={16} />
          KYC Status: Verified
        </div>
        {selectedRiderSnapshot?.kycVerifiedAt ? (
          <span className="text-xs text-emerald-700">Verified on: {formatDate(selectedRiderSnapshot.kycVerifiedAt)}</span>
        ) : null}
      </div>

      {/* Vehicle Photos */}
      <div className="rounded-2xl border border-evegah-border overflow-hidden">
        <div className="px-4 py-3 border-b border-evegah-border flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-evegah-primary">
              <Camera size={16} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-evegah-text">Vehicle Photo</h3>
              <p className="text-[11px] text-gray-500">
                {Array.isArray(formData.preRidePhotos) && formData.preRidePhotos.length > 0
                  ? `${formData.preRidePhotos.length} photo${formData.preRidePhotos.length === 1 ? "" : "s"} uploaded`
                  : "No photos uploaded yet"}
              </p>
            </div>
          </div>
          {Array.isArray(formData.preRidePhotos) && formData.preRidePhotos.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2 py-0.5">
              <FileCheck size={12} /> Verified
            </span>
          ) : null}
        </div>

        <div className="p-4 space-y-3">
          <input
            ref={preRidePhotosInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { handlePreRidePhotosPick(e.target.files); e.target.value = ""; }}
          />

          {Array.isArray(formData.preRidePhotos) && formData.preRidePhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {formData.preRidePhotos.map((p, idx) => (
                <div key={`${p?.name || "photo"}-${idx}`} className="relative rounded-xl overflow-hidden border border-evegah-border bg-white">
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => setImagePreview({ src: getImageDataUrl(p), title: "Vehicle Photo" })}
                  >
                    <img src={getImageDataUrl(p)} alt="Vehicle" className="h-32 w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    className="absolute top-1 right-1 h-7 w-7 rounded-full bg-white/95 border border-evegah-border grid place-items-center text-gray-600 hover:text-rose-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = [...formData.preRidePhotos];
                      next.splice(idx, 1);
                      updateForm({ preRidePhotos: next });
                    }}
                    aria-label="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => preRidePhotosInputRef.current?.click()}
            className="w-full border-2 border-dashed border-evegah-border rounded-xl py-4 text-sm font-semibold text-evegah-primary hover:bg-brand-light/30"
          >
            {Array.isArray(formData.preRidePhotos) && formData.preRidePhotos.length > 0 ? "Add more photos" : "Click to upload vehicle photos"}
            <p className="mt-1 text-[11px] text-gray-500 font-normal">PNG / JPG, max 5MB each (up to 8)</p>
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
        <Info size={12} /> All documents are secure and encrypted.
      </p>

      {paymentError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">
          {paymentError}
        </div>
      ) : null}
    </div>
  );

  const renderStep5 = () => {
    const accessoryLabels = (Array.isArray(formData.accessories) ? formData.accessories : [])
      .map((k) => ACCESSORY_OPTIONS.find((a) => a.key === k)?.label || k);

    return (
      <div className="space-y-5">
        <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-evegah-text">Review &amp; Confirm</h2>
            <p className="text-sm text-gray-500">Please review all the details carefully before final submission.</p>
          </div>

          {/* 1. Rider Details */}
          <div className="rounded-2xl border border-evegah-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-evegah-text inline-flex items-center gap-2">
                <UserCheck size={14} className="text-evegah-primary" /> 1. Rider Details
              </h3>
              <button type="button" onClick={() => setCurrentStep(1)} className="inline-flex items-center gap-1 text-xs font-semibold text-evegah-primary hover:underline">
                <Edit3 size={12} /> Edit
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-brand-light text-evegah-primary grid place-items-center text-sm font-bold">
                {initialsFrom(formData.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-evegah-text inline-flex items-center gap-2">
                  {formData.name}
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5">
                    <BadgeCheck size={10} /> KYC Verified
                  </span>
                </p>
                <p className="text-xs text-gray-500">+91 {formData.phone} · Rider ID: {selectedRiderSnapshot?.rider_code || formData.riderCode || "—"}</p>
              </div>
              <div className="ml-auto flex items-center gap-5 text-xs text-gray-600">
                <div className="inline-flex items-center gap-1"><Calendar size={12} /> Last Ride: {formatDate(selectedRiderSnapshot?.lastRideAt)}</div>
                <div className="inline-flex items-center gap-1"><Hash size={12} /> Total Rides: {selectedRiderSnapshot?.totalRides ?? "—"}</div>
              </div>
            </div>
          </div>

          {/* 2. Ride Details */}
          <div className="rounded-2xl border border-evegah-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-evegah-text inline-flex items-center gap-2">
                <Calendar size={14} className="text-evegah-primary" /> 2. Ride Details
              </h3>
              <button type="button" onClick={() => setCurrentStep(2)} className="inline-flex items-center gap-1 text-xs font-semibold text-evegah-primary hover:underline">
                <Edit3 size={12} /> Edit
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
              <SummaryRow label="Ride Start" value={formatDateTimeShort(formData.rentalStart)} />
              <SummaryRow label="Purpose" value={purpose} />
              <SummaryRow label="Vehicle" value={`${formData.bikeId || "—"}${formData.bikeModel ? ` (${formData.bikeModel})` : ""}`} />
              <SummaryRow label="Expected Return" value={formatDateTimeShort(formData.rentalEnd)} />
              <SummaryRow label="Rental Plan" value={formData.rentalPackage ? formData.rentalPackage.replace(/^./, (c) => c.toUpperCase()) : "—"} />
              <SummaryRow label="Battery" value={formData.batteryId || "—"} />
            </div>
          </div>

          {/* 3. Charges Summary */}
          <div className="rounded-2xl border border-evegah-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-evegah-text inline-flex items-center gap-2">
                <Receipt size={14} className="text-evegah-primary" /> 3. Charges Summary
              </h3>
              <button type="button" onClick={() => setCurrentStep(3)} className="inline-flex items-center gap-1 text-xs font-semibold text-evegah-primary hover:underline">
                <Edit3 size={12} /> Edit
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-sm">
                <SummaryRow label="Vehicle Rent" value={formatINR(rentalAmount)} />
                <SummaryRow label="Battery Rent" value={formatINR(0)} />
                <SummaryRow label="Accessories" value={formatINR(accessoryAmount)} />
                <SummaryRow label="GST (18%)" value={formatINR(gstAmount)} />
                <div className="pt-2 border-t border-evegah-border">
                  <SummaryRow label="Total Amount" value={formatINR(totalBeforeDeposit)} />
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col justify-center">
                {applyDeposit && securityDeposit > 0 ? (
                  <SummaryRow label="Deposit Applied" value={formatINR(securityDeposit)} valueClass="text-emerald-700" />
                ) : null}
                <p className="text-xs text-gray-600 mt-2">Final Amount Payable</p>
                <p className="text-2xl font-bold text-emerald-700">{formatINR(finalPayable)}</p>
              </div>
            </div>
          </div>

          {/* 4. Documents */}
          <div className="rounded-2xl border border-evegah-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-evegah-text inline-flex items-center gap-2">
                <FileCheck size={14} className="text-evegah-primary" /> 4. Documents
              </h3>
              <button type="button" onClick={() => setCurrentStep(4)} className="inline-flex items-center gap-1 text-xs font-semibold text-evegah-primary hover:underline">
                <Edit3 size={12} /> Edit
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {["KYC", "Vehicle Photo"].map((label) => (
                <div key={label} className="rounded-xl border border-evegah-border px-3 py-2 inline-flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-light text-evegah-primary">
                    <FileCheck size={14} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-evegah-text">{label}</p>
                    <p className="text-[10px] text-emerald-600 font-semibold">Verified</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Accessories */}
          {accessoryLabels.length > 0 ? (
            <div className="rounded-2xl border border-evegah-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-evegah-text inline-flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-evegah-primary" /> 5. Accessories Included
                </h3>
                <button type="button" onClick={() => setCurrentStep(2)} className="inline-flex items-center gap-1 text-xs font-semibold text-evegah-primary hover:underline">
                  <Edit3 size={12} /> Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {accessoryLabels.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 rounded-full bg-brand-light text-evegah-primary text-xs font-semibold px-3 py-1">
                    <Check size={12} /> {l}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <input
              type="checkbox"
              className="mt-0.5 accent-evegah-primary"
              checked={confirmAccepted}
              onChange={(e) => setConfirmAccepted(e.target.checked)}
            />
            <span className="text-sm text-amber-800">
              I confirm all the above details are correct.
            </span>
          </label>

          {paymentError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">
              {paymentError}
            </div>
          ) : null}

          {retainSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <p className="text-sm font-bold text-emerald-700 inline-flex items-center gap-2">
                <CheckCircle2 size={16} /> Rider retained successfully. Ride started.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleSendWhatsApp} disabled={sendingWhatsApp} className="inline-flex items-center gap-1.5 rounded-xl bg-evegah-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60">
                  {sendingWhatsApp ? "Sending…" : "Send Receipt on WhatsApp"}
                </button>
                <button type="button" onClick={handleDownloadReceipt} className="inline-flex items-center gap-1.5 rounded-xl border border-evegah-primary text-evegah-primary px-4 py-2 text-sm font-semibold hover:bg-brand-light/40">
                  Download Receipt
                </button>
              </div>
              {whatsAppStatus ? (
                <p className={`text-xs ${whatsAppStatusType === "success" ? "text-emerald-700" : "text-rose-600"}`}>{whatsAppStatus}</p>
              ) : null}
              {whatsAppFallback ? (
                <p className="text-xs text-gray-600">
                  <button type="button" onClick={() => {
                    const text = encodeURIComponent(`EVegah Receipt (PDF): ${whatsAppFallback.mediaUrl}`);
                    window.open(`https://wa.me/91${whatsAppFallback.phoneDigits}?text=${text}`, "_self");
                  }} className="text-evegah-primary font-semibold hover:underline">Open WhatsApp manually</button>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // Final layout
  // ---------------------------------------------------------------------

  const isLastStep = currentStep === 5;
  const isSubmitDisabled = savingPayment || !confirmAccepted || (iciciEnabled && paymentMode !== "cash" && !iciciTxnVerified);

  return (
    <EmployeeLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <Link to="/employee/dashboard" className="hover:text-evegah-primary inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Home
          </Link>
          <ChevronRight size={12} className="text-gray-400" />
          <span>Rides / Rentals</span>
          <ChevronRight size={12} className="text-gray-400" />
          <span className="text-evegah-primary">Retain Ride Registration</span>
        </nav>

        {/* Title + back */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-evegah-text">Retain Ride Registration</h1>
            <p className="text-sm text-gray-500">Search and select an existing rider to create a new ride.</p>
          </div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-2xl border border-evegah-border bg-white px-4 py-2 text-sm font-semibold text-evegah-primary hover:bg-evegah-bg whitespace-nowrap"
          >
            <ArrowLeft size={16} /> Back to Rides
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
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}

            {/* Bottom action bar */}
            <div className="bg-white border border-evegah-border rounded-2xl shadow-card px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={goPrev}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
                  >
                    <ArrowLeft size={14} /> Previous
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleChangeRider}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-evegah-border bg-white text-gray-600 px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
                  >
                    <X size={14} /> Cancel
                  </button>
                )}
              </div>

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={currentStep === 1 && !selected}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  {currentStep === 1 ? "Save & Continue" : currentStep === 3 ? "Proceed to Next" : "Save & Continue"} <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={isSubmitDisabled}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  {savingPayment ? "Starting Ride…" : "Confirm & Start Ride"} <ArrowRight size={14} />
                </button>
              )}
            </div>

            {isLastStep ? (
              <p className="text-[11px] text-gray-400 text-right">
                By confirming, the ride will be started and an agreement will be generated.
              </p>
            ) : null}
          </div>

          {/* Right rail */}
          <aside className="space-y-5 xl:sticky xl:top-24">
            {renderRightRail()}
          </aside>
        </div>
      </div>

      {/* Image preview modal */}
      {imagePreview?.src ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" onClick={() => setImagePreview(null)}>
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-evegah-border bg-white shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-evegah-border px-4 py-3">
              <div className="text-sm font-semibold text-evegah-text truncate">{imagePreview.title || "Preview"}</div>
              <button type="button" className="h-9 w-9 rounded-xl border border-evegah-border bg-white text-gray-600 hover:bg-gray-50" onClick={() => setImagePreview(null)} aria-label="Close preview">
                <X size={16} />
              </button>
            </div>
            <div className="bg-black/5 p-3">
              <img src={imagePreview.src} alt={imagePreview.title || "Preview"} className="max-h-[75vh] w-full object-contain rounded-xl bg-white" />
            </div>
          </div>
        </div>
      ) : null}
    </EmployeeLayout>
  );
}

export default function RetainRider() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <RiderFormProvider user={user}>
      <RetainRiderInner />
    </RiderFormProvider>
  );
}
