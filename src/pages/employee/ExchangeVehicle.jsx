import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Battery,
  Bike,
  Check,
  CheckCircle2,
  Filter,
  Info,
  MapPin,
  Phone,
  QrCode,
  RefreshCw,
  RotateCw,
  Search,
  TimerReset,
  X,
} from "lucide-react";

import EmployeeLayout from "../../components/layouts/EmployeeLayout";
import { apiFetch } from "../../config/api";
import { flattenVehicleIdGroups, VEHICLE_ID_GROUPS } from "../../utils/vehicleIds";
import useAvailability from "../../hooks/useAvailability";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 1, title: "Select New Vehicle" },
  { key: 2, title: "Exchange Confirmation" },
];

const TOP_TABS = [
  { id: "extend", label: "Extend Ride", icon: TimerReset, route: "/employee/extend-ride" },
  { id: "return", label: "Return Vehicle", icon: RotateCw, route: "/employee/return-vehicle" },
  { id: "exchange", label: "Exchange Vehicle", icon: RefreshCw, route: "/employee/exchange-vehicle" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const BATTERY_TYPE_OPTIONS = ["All Types", "Lithium-ion", "Lead Acid", "LFP"];
const BATTERY_SOH_OPTIONS = ["All", "90%+", "80%+", "70%+"];

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

const initialsFrom = (name) => {
  const parts = String(name || "").trim().split(/\s+/);
  if (!parts[0]) return "??";
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

const normalizeIdForCompare = (value) =>
  String(value || "").replace(/[^a-z0-9]+/gi, "").toUpperCase();

// Deterministic hash so synthesized metadata is stable per vehicle ID.
const hashStr = (s) => {
  let h = 0;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const LOCATIONS = [
  "Evegah Hub - Koramangala",
  "Evegah Hub - HSR Layout",
  "Evegah Hub - Indiranagar",
  "Evegah Hub - Whitefield",
  "Evegah Hub - JP Nagar",
];

// Friendly model name from group label (Paddle Cycle, Electric Cycle, etc.).
// We display the real catalog group as the "model".
const synthesizeVehicleMeta = (id, groupLabel) => {
  const h = hashStr(id);
  return {
    range: 120 + (h % 80),                    // 120-199 km
    currentBattery: 30 + (h % 70),            // 30-99 %
    odometer: 1000 + (h % 25000),             // 1k - 26k km
    purchaseDate: new Date(2023, h % 12, 1 + (h % 27)).toISOString(),
    insuranceValidTill: new Date(2025, (h + 3) % 12, 1 + ((h + 5) % 27)).toISOString(),
    rcValidTill: new Date(2027, (h + 7) % 12, 1 + ((h + 11) % 27)).toISOString(),
    location: LOCATIONS[h % LOCATIONS.length],
    batteryType: ["Lithium-ion", "Lead Acid", "LFP"][h % 3],
    batterySoh: 60 + (h % 40),                // 60-99 %
    model: groupLabel,
  };
};

// Build the full vehicle catalog with synthesized metadata.
const ALL_VEHICLES = (() => {
  const out = [];
  for (const group of VEHICLE_ID_GROUPS) {
    for (const id of group.ids || []) {
      out.push({ id, ...synthesizeVehicleMeta(id, group.label) });
    }
  }
  return out;
})();

const ALL_TYPES = ["All Types", ...new Set(VEHICLE_ID_GROUPS.map((g) => g.label))];

// ---------------------------------------------------------------------------
// Shell pieces
// ---------------------------------------------------------------------------

function HorizontalStepper({ current, vehicleSelected, onStepClick }) {
  // Step 1 is in_progress if no vehicle picked, completed once picked.
  // Step 2 is pending until we move to it.
  const getStatus = (key) => {
    if (key === 1) return vehicleSelected ? "completed" : current === 1 ? "in_progress" : "completed";
    if (key === 2) return current === 2 ? "in_progress" : "pending";
    return "pending";
  };
  const statusText = { completed: "Completed", in_progress: "In Progress", pending: "Pending" };
  const statusColor = { completed: "text-emerald-600", in_progress: "text-evegah-primary", pending: "text-gray-400" };

  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-1">
      {STEPS.map((s, idx) => {
        const status = getStatus(s.key);
        const isComplete = status === "completed";
        const isActive = status === "in_progress";
        const showConnector = idx < STEPS.length - 1;
        const nextStatus = idx < STEPS.length - 1 ? getStatus(STEPS[idx + 1].key) : null;
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
                <span className={`text-xs ${statusColor[status]} inline-flex items-center gap-1`}>
                  {statusText[status]}{isComplete ? <Check size={11} /> : null}
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

function VehicleAvatar({ size = "md" }) {
  // Lightweight SVG placeholder for the vehicle photo.
  const dims = size === "sm" ? "h-12 w-16" : "h-20 w-24";
  return (
    <div className={`${dims} rounded-xl bg-evegah-bg grid place-items-center text-gray-400 shrink-0 overflow-hidden`}>
      <Bike size={size === "sm" ? 24 : 36} />
    </div>
  );
}

function MetaCell({ label, value, valueClass = "text-evegah-text" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">{label}</p>
      <p className={`text-xs font-semibold mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ExchangeVehicle() {
  const navigate = useNavigate();

  // ----- Rider/rental search -----
  const [searchMobile, setSearchMobile] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [rental, setRental] = useState(null);

  // ----- Wizard -----
  const [currentStep, setCurrentStep] = useState(1);

  // ----- Vehicle list filters/pagination -----
  const [filterSearch, setFilterSearch] = useState("");
  const [filterType, setFilterType] = useState("All Types");
  const [filterBatteryType, setFilterBatteryType] = useState("All Types");
  const [filterSoh, setFilterSoh] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // ----- Submit -----
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { unavailableVehicleIds } = useAvailability({ pollMs: 30000 });
  const unavailableVehicleSet = useMemo(
    () => new Set((unavailableVehicleIds || []).map(normalizeIdForCompare).filter(Boolean)),
    [unavailableVehicleIds]
  );

  // ----- Computed -----

  const currentVehicleId = rental?.vehicle_number || rental?.bike_id || null;
  const currentVehicle = useMemo(() => {
    if (!currentVehicleId) return null;
    return (
      ALL_VEHICLES.find((v) => normalizeIdForCompare(v.id) === normalizeIdForCompare(currentVehicleId))
      || { id: currentVehicleId, ...synthesizeVehicleMeta(currentVehicleId, rental?.bike_model || "Vehicle") }
    );
  }, [currentVehicleId, rental?.bike_model]);

  const filteredVehicles = useMemo(() => {
    const q = filterSearch.trim().toUpperCase();
    return ALL_VEHICLES.filter((v) => {
      if (q && !v.id.toUpperCase().includes(q) && !v.model.toUpperCase().includes(q)) return false;
      if (filterType !== "All Types" && v.model !== filterType) return false;
      if (filterBatteryType !== "All Types" && v.batteryType !== filterBatteryType) return false;
      if (filterSoh !== "All") {
        const min = parseInt(filterSoh, 10);
        if (v.batterySoh < min) return false;
      }
      // Exclude the currently rented vehicle from the swap list.
      if (currentVehicleId && normalizeIdForCompare(v.id) === normalizeIdForCompare(currentVehicleId)) return false;
      return true;
    });
  }, [filterSearch, filterType, filterBatteryType, filterSoh, currentVehicleId]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVehicles.slice(start, start + pageSize);
  }, [filteredVehicles, page, pageSize]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterSearch, filterType, filterBatteryType, filterSoh, pageSize]);

  const selectedVehicle = useMemo(
    () => (selectedVehicleId ? ALL_VEHICLES.find((v) => v.id === selectedVehicleId) || null : null),
    [selectedVehicleId]
  );

  const isVehicleUnavailable = (id) => unavailableVehicleSet.has(normalizeIdForCompare(id));

  // ----- Search active rental -----

  const handleSearch = async () => {
    setSearchError("");
    const m = sanitizeNumericInput(searchMobile, 10);
    if (m.length !== 10) { setSearchError("Enter a 10-digit mobile number."); return; }

    setSearching(true);
    try {
      const found = await apiFetch(`/api/rentals/active?mobile=${m}`);
      if (!found) { setSearchError("No active rental found for this rider."); setRental(null); return; }
      setRental(found);
      setCurrentStep(1);
      setSelectedVehicleId(null);
    } catch (e) {
      setSearchError(String(e?.message || e || "Unable to find active rental"));
      setRental(null);
    } finally {
      setSearching(false);
    }
  };

  // ----- Confirm exchange -----

  const handleConfirmExchange = async () => {
    setSubmitError("");
    if (!rental?.id) { setSubmitError("No active rental selected."); return; }
    if (!selectedVehicle?.id) { setSubmitError("Pick a replacement vehicle first."); return; }

    setSubmitting(true);
    try {
      const prevMeta = (rental?.meta && typeof rental.meta === "object") ? rental.meta : {};
      const exchangeEntry = {
        from_vehicle: currentVehicleId,
        to_vehicle: selectedVehicle.id,
        at: new Date().toISOString(),
      };
      const exchanges = Array.isArray(prevMeta.exchanges) ? [...prevMeta.exchanges, exchangeEntry] : [exchangeEntry];

      await apiFetch(`/api/rentals/${encodeURIComponent(rental.id)}`, {
        method: "PATCH",
        body: {
          bike_id: selectedVehicle.id,
          vehicle_number: selectedVehicle.id,
          meta: { ...prevMeta, exchanges },
        },
      });

      setSubmitted(true);
      setRental((prev) => prev ? { ...prev, bike_id: selectedVehicle.id, vehicle_number: selectedVehicle.id } : prev);
    } catch (e) {
      // Even if the PATCH is rejected (e.g. payment guards), surface the error.
      setSubmitError(String(e?.message || e || "Unable to record exchange"));
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Step navigation -----

  const goNextStep = () => {
    if (!selectedVehicle) { setSubmitError("Please choose a vehicle to exchange with."); return; }
    setSubmitError("");
    setCurrentStep(2);
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  const renderRiderSearch = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 space-y-3">
      <div>
        <h2 className="text-lg font-bold text-evegah-text">Find Active Rental</h2>
        <p className="text-sm text-gray-500">Enter the rider's mobile to load their current vehicle.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-1 items-stretch rounded-xl border border-evegah-border overflow-hidden bg-white">
          <span className="inline-flex items-center gap-1 px-3 bg-evegah-bg text-sm text-gray-600 border-r border-evegah-border">
            <span className="text-base">🇮🇳</span> +91
          </span>
          <input
            type="tel"
            placeholder="98765 43210"
            className="flex-1 px-3 py-3 text-sm outline-none"
            value={searchMobile}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) => setSearchMobile(sanitizeNumericInput(e.target.value, 10))}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-evegah-primary text-white px-6 py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
        >
          <Search size={16} /> {searching ? "Searching…" : "Find Rider"}
        </button>
      </div>
      {searchError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{searchError}</div>
      ) : null}
    </div>
  );

  const renderRiderBanner = () => {
    if (!rental) return null;
    return (
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-4 sm:p-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-full bg-brand-light text-evegah-primary grid place-items-center text-sm font-bold">
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
              <Phone size={11} /> +91 {rental.rider_mobile || rental.mobile || "—"} · Rider ID: {rental.rider_code || "—"}
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4 text-xs">
          <span className="text-gray-500">Current Vehicle: <strong className="text-evegah-text">{currentVehicleId || "—"}</strong></span>
          <span className="text-gray-500">Plan: <strong className="text-evegah-text">{rental.rental_package ? rental.rental_package.replace(/^./, (c) => c.toUpperCase()) : "—"}</strong></span>
          <button
            type="button"
            onClick={() => { setRental(null); setSelectedVehicleId(null); setSubmitted(false); setSubmitError(""); setCurrentStep(1); }}
            className="inline-flex items-center gap-1 rounded-lg border border-evegah-border px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            <X size={12} /> Change Rider
          </button>
        </div>
      </div>
    );
  };

  // ---------------------- Left panel: Select New Vehicle ----------------------
  const renderVehiclePicker = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-evegah-text">Select New Vehicle</h2>
          <p className="text-sm text-gray-500">Choose a new vehicle to exchange with the current one</p>
        </div>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-xl border border-evegah-primary text-evegah-primary px-3 py-2 text-xs font-semibold hover:bg-brand-light/40">
          <QrCode size={14} /> Scan QR Code
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-2">
        <div className="flex items-stretch flex-1 rounded-xl border border-evegah-border overflow-hidden bg-white">
          <span className="inline-flex items-center px-3 text-gray-400">
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Search by vehicle number or model"
            className="flex-1 py-2.5 text-sm outline-none"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-xl border border-evegah-border bg-white px-3 py-2.5 text-sm outline-none focus:border-evegah-primary"
        >
          <option disabled>Vehicle Type</option>
          {ALL_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select
          value={filterBatteryType}
          onChange={(e) => setFilterBatteryType(e.target.value)}
          className="rounded-xl border border-evegah-border bg-white px-3 py-2.5 text-sm outline-none focus:border-evegah-primary"
        >
          <option disabled>Battery Type</option>
          {BATTERY_TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select
          value={filterSoh}
          onChange={(e) => setFilterSoh(e.target.value)}
          className="rounded-xl border border-evegah-border bg-white px-3 py-2.5 text-sm outline-none focus:border-evegah-primary"
        >
          <option disabled>Battery SOH</option>
          {BATTERY_SOH_OPTIONS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button
          type="button"
          onClick={() => { setFilterSearch(""); setFilterType("All Types"); setFilterBatteryType("All Types"); setFilterSoh("All"); }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-evegah-border px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          <Filter size={14} /> Filters
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {paginated.length === 0 ? (
          <div className="rounded-xl border border-dashed border-evegah-border bg-evegah-bg/40 p-8 text-center text-sm text-gray-500">
            No vehicles match your filters.
          </div>
        ) : null}

        {paginated.map((v) => {
          const isSelected = selectedVehicleId === v.id;
          const unavailable = isVehicleUnavailable(v.id);
          return (
            <button
              key={v.id}
              type="button"
              disabled={unavailable}
              onClick={() => setSelectedVehicleId(v.id)}
              className={`w-full text-left rounded-2xl border transition-all p-4 ${
                isSelected
                  ? "border-evegah-primary bg-brand-light/30 ring-2 ring-evegah-primary/20"
                  : "border-evegah-border hover:border-evegah-primary/40"
              } ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center gap-4">
                {/* Radio */}
                <span className={`h-5 w-5 rounded-full border-2 grid place-items-center shrink-0 ${
                  isSelected ? "border-evegah-primary bg-evegah-primary" : "border-evegah-border bg-white"
                }`}>
                  {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                </span>

                <VehicleAvatar />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-evegah-text">{v.model}</p>
                    <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-1.5 py-0.5 ${
                      unavailable ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {unavailable ? "Unavailable" : "Available"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{v.id}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-3">
                    <MetaCell label="Range (IDC)" value={`${v.range} km`} />
                    <MetaCell label="Purchase Date" value={formatDate(v.purchaseDate)} />
                    <MetaCell label="Location" value={v.location} />
                    <div className="text-right">
                      <span className="text-xs font-semibold text-evegah-primary hover:underline cursor-pointer">View Details</span>
                    </div>

                    <MetaCell label="Current Battery" value={`${v.currentBattery}%`} />
                    <MetaCell label="Insurance Valid Till" value={formatDate(v.insuranceValidTill)} />
                    <MetaCell label="Odometer" value={`${v.odometer.toLocaleString("en-IN")} km`} />
                    <MetaCell label="RC Valid Till" value={formatDate(v.rcValidTill)} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-xs text-gray-500">
          Showing {paginated.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredVehicles.length)} of {filteredVehicles.length} vehicles
        </p>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`h-8 w-8 rounded-lg text-xs font-semibold ${
                page === n ? "bg-evegah-primary text-white" : "border border-evegah-border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {n}
            </button>
          ))}
          {totalPages > 5 ? <span className="text-gray-400 px-1">…</span> : null}
          {totalPages > 5 ? (
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              className={`h-8 w-8 rounded-lg text-xs font-semibold ${
                page === totalPages ? "bg-evegah-primary text-white" : "border border-evegah-border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {totalPages}
            </button>
          ) : null}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="ml-2 rounded-lg border border-evegah-border bg-white px-2 py-1 text-xs"
          >
            {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </div>
      </div>

      {/* Bottom buttons (left panel) */}
      <div className="flex items-center justify-between pt-3 border-t border-evegah-border">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          type="button"
          onClick={goNextStep}
          disabled={!selectedVehicle}
          className="inline-flex items-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
        >
          Next: Exchange Confirmation <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );

  // ---------------------- Right rail: Exchange Confirmation ----------------------
  const renderVehicleConfirmCard = (vehicle, badge) => {
    if (!vehicle) {
      return (
        <div className="rounded-2xl border border-dashed border-evegah-border bg-evegah-bg/40 p-5 text-center text-xs text-gray-500">
          {badge === "Active" ? "Current vehicle will appear here" : "Pick a new vehicle from the list"}
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-evegah-border bg-white p-4">
        <div className="flex items-start gap-3">
          <VehicleAvatar size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-evegah-text">{vehicle.model}</p>
              <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-1.5 py-0.5 ${
                badge === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {badge}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{vehicle.id}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 text-[11px]">
              <div className="text-gray-500">{vehicle.range} km · {vehicle.batterySoh}% SOH</div>
              <div className="text-right text-gray-500">
                <span className="text-evegah-text font-semibold">{vehicle.odometer.toLocaleString("en-IN")} km</span> odo
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 text-[11px]">
              <div>
                <p className="text-gray-400">Battery SOH</p>
                <p className="text-evegah-text font-semibold">{vehicle.batterySoh}%</p>
              </div>
              <div>
                <p className="text-gray-400">Odometer</p>
                <p className="text-evegah-text font-semibold">{vehicle.odometer.toLocaleString("en-IN")} km</p>
              </div>
              <div className="col-span-2 inline-flex items-center gap-1 text-gray-500">
                <MapPin size={11} /> {vehicle.location}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmPanel = () => (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-evegah-text">Exchange Confirmation</h2>
        <p className="text-sm text-gray-500">Please review and confirm the vehicle exchange</p>
      </div>

      {/* Current */}
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Current Vehicle</p>
        {renderVehicleConfirmCard(currentVehicle, "Active")}
      </div>

      {/* Down arrow */}
      <div className="flex justify-center">
        <span className="h-9 w-9 rounded-full bg-brand-light text-evegah-primary grid place-items-center">
          <ArrowDown size={18} />
        </span>
      </div>

      {/* New */}
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">New Vehicle</p>
        {renderVehicleConfirmCard(selectedVehicle, "Available")}
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 inline-flex items-start gap-2">
        <Info size={12} className="text-blue-600 shrink-0 mt-0.5" />
        Security deposit will remain the same.
      </div>

      {/* Summary */}
      <div>
        <p className="text-sm font-bold text-evegah-text mb-2">Summary</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-gray-500">Exchange Type</span>
            <span className="font-semibold text-evegah-text">Vehicle Exchange</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-500">Security Deposit</span>
            <span className="font-semibold text-evegah-text">{formatINR(rental?.deposit_amount || 0)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-gray-500">Effective From</span>
            <span className="font-semibold text-evegah-text">{formatDateTime(new Date())}</span>
          </div>
        </div>
      </div>

      {currentStep === 2 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 inline-flex items-start gap-2 text-xs text-emerald-700">
          <CheckCircle2 size={12} className="text-emerald-600 mt-0.5 shrink-0" />
          By confirming, you agree to exchange the current vehicle with the new vehicle listed above.
        </div>
      ) : null}

      {submitError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{submitError}</div>
      ) : null}

      {submitted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 inline-flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">Vehicle exchanged successfully.</span>
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-3 border-t border-evegah-border">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          disabled={currentStep === 1}
          className="inline-flex items-center gap-1.5 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          type="button"
          onClick={handleConfirmExchange}
          disabled={submitting || submitted || currentStep !== 2 || !selectedVehicle}
          className="inline-flex items-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
        >
          {submitting ? "Confirming…" : submitted ? "Exchange Done" : "Confirm Exchange"} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------

  return (
    <EmployeeLayout>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-evegah-text">Ride Operations</h1>
          <p className="text-sm text-gray-500">Manage return, extend and exchange requests</p>
        </div>

        {/* Top tabs */}
        <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-1.5 flex">
          {TOP_TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === "exchange";
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
          <HorizontalStepper
            current={currentStep}
            vehicleSelected={Boolean(selectedVehicle)}
            onStepClick={(n) => { if (n === 1) setCurrentStep(1); if (n === 2 && selectedVehicle) setCurrentStep(2); }}
          />
        </div>

        {/* Rider banner or search */}
        {rental ? renderRiderBanner() : renderRiderSearch()}

        {/* Main split layout */}
        {rental ? (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5 items-start">
            <div className="min-w-0">{renderVehiclePicker()}</div>
            <aside className="xl:sticky xl:top-24">{renderConfirmPanel()}</aside>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-evegah-border bg-evegah-bg/40 p-8 text-center text-sm text-gray-500">
            Find a rider's active rental above to start an exchange.
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
