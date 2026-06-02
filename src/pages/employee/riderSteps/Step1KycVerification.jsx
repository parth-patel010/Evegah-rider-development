// Step 1 — KYC Verification choice screen.
//
// Lets the employee pick one of three paths before falling into the rider
// details form:
//
//   • Verify with DigiLocker     → opens the existing manual form, scrolled to
//                                  the DigiLocker section (which is already
//                                  integrated in `Step1RiderDetails`).
//   • Enter Manually             → opens the same manual form.
//   • Do KYC Later               → marks `kycDeferred=true` on the draft and
//                                  jumps straight to Step 2 (Rental Details).
//
// Once the user is "in manual mode", the rest of the rider details form
// renders inline below a small breadcrumb that lets them return to this
// choice screen.

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Info,
  Pencil,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

import { useRiderForm } from "../useRiderForm";
import Step1RiderDetails from "./Step1RiderDetails";
import aadhaarImage from "../../../assets/adharimge.png";

// ---------------------------------------------------------------------------
// Choice screen
// ---------------------------------------------------------------------------

function ChoiceScreen({ onPickManual, onPickDigiLocker, onPickLater, kycDeferred }) {
  return (
    <div className="space-y-5">
      {/* Subtitle + DigiLocker badge row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-gray-500">
          Verify rider identity to ensure a safe and compliant onboarding.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            Powered by <span className="font-bold text-evegah-text">DigiLocker</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold px-2 py-0.5">
            <CheckCircle2 size={12} /> Verified
          </span>
        </div>
      </div>

      {/* Green "Recommended" banner */}
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-start gap-3">
        <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-800">
            Use DigiLocker to verify instantly (Recommended)
          </p>
          <p className="text-xs text-emerald-700/90 mt-0.5">
            Secure, fast and paperless verification. Details are auto-fetched and cannot be edited.
          </p>
        </div>
      </div>

      {/* Two option cards: DigiLocker | Manual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DigiLocker card (recommended) */}
        <div className="relative rounded-2xl border-2 border-evegah-primary/40 bg-brand-light/20 p-5 flex flex-col">
          <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5">
            Recommended
          </span>

          <div className="flex items-start gap-3 mb-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-evegah-primary text-white shadow-card shrink-0">
              <ShieldCheck size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-evegah-text">Verify Now with DigiLocker</p>
            </div>
          </div>

          <ul className="space-y-1.5 text-xs text-gray-700 flex-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-evegah-primary shrink-0" />
              Auto fetch Aadhaar and Driving License
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-evegah-primary shrink-0" />
              Secure &amp; government verified
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-evegah-primary shrink-0" />
              Faster onboarding
            </li>
          </ul>

          {/* Decorative aadhaar mockup */}
          <img
            src={aadhaarImage}
            alt="Aadhaar card preview"
            className="absolute right-4 bottom-20 hidden sm:block w-28 opacity-90 pointer-events-none"
          />

          <button
            type="button"
            onClick={onPickDigiLocker}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-evegah-primary text-white px-4 py-2.5 text-sm font-bold hover:opacity-95"
          >
            <Sparkles size={14} className="text-yellow-300" />
            Verify with DigiLocker
          </button>
          <p className="mt-2 text-[11px] text-gray-500 text-center">
            You will be redirected to DigiLocker to fetch your documents
          </p>
        </div>

        {/* Manual entry card */}
        <div className="rounded-2xl border border-evegah-border bg-white p-5 flex flex-col">
          <div className="flex items-start gap-3 mb-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100 text-gray-600 shrink-0">
              <Edit3 size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-evegah-text">Enter Details Manually</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Fill rider details and upload documents manually.
              </p>
            </div>
          </div>

          <ul className="space-y-1.5 text-xs text-gray-600 flex-1">
            <li className="flex items-center gap-2">
              <Pencil size={12} className="text-gray-500 shrink-0" />
              Enter details manually
            </li>
            <li className="flex items-center gap-2">
              <Upload size={12} className="text-gray-500 shrink-0" />
              Upload documents
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck size={12} className="text-gray-500 shrink-0" />
              Verification will be done later
            </li>
          </ul>

          <button
            type="button"
            onClick={onPickManual}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-bold hover:bg-gray-50"
          >
            Enter Manually
          </button>
        </div>
      </div>

      {/* Do KYC Later banner */}
      <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
          <Info size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">Do KYC Later</p>
          <p className="text-xs text-amber-800/90 mt-0.5">
            You can skip KYC verification now and do it later. However, ride will be activated only after successful KYC verification.
          </p>
        </div>
        <button
          type="button"
          onClick={onPickLater}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold whitespace-nowrap ${
            kycDeferred
              ? "border-emerald-300 bg-emerald-100 text-emerald-700"
              : "border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
          }`}
        >
          {kycDeferred ? <><CheckCircle2 size={14} /> KYC Deferred</> : "Do KYC Later"}
        </button>
      </div>

      {/* Note */}
      <div className="rounded-2xl border border-evegah-border bg-evegah-bg/50 px-4 py-3 flex items-start gap-3">
        <Info size={14} className="text-gray-400 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-600">
          <span className="font-semibold text-evegah-text">Note:</span> KYC verification is mandatory before ride activation as per company policy and government regulations.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual mode breadcrumb — small banner that appears above the rider details
// form when the user has chosen a path.
// ---------------------------------------------------------------------------

function KycModeBreadcrumb({ mode, kycDeferred, onBack }) {
  let label = "";
  let tintClass = "";
  if (mode === "digilocker") {
    label = "Verify via DigiLocker";
    tintClass = "border-evegah-primary/30 bg-brand-light/30 text-evegah-primary";
  } else if (mode === "manual") {
    label = "Manual KYC Entry";
    tintClass = "border-evegah-border bg-evegah-bg/70 text-evegah-text";
  } else {
    label = kycDeferred ? "KYC Deferred" : "KYC Pending";
    tintClass = "border-amber-200 bg-amber-50 text-amber-800";
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border px-4 py-3 ${tintClass}`}>
      <span className="inline-flex items-center gap-2 text-xs font-semibold">
        <ShieldCheck size={14} /> {label}
      </span>
      <span className="flex-1 text-[11px] text-gray-500">
        You can change the verification mode at any time before submitting.
      </span>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-semibold rounded-lg border border-evegah-border bg-white px-3 py-1.5 text-evegah-text hover:bg-gray-50"
      >
        <ArrowLeft size={12} /> Back to KYC Choice
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Step 1 component
// ---------------------------------------------------------------------------

export default function Step1KycVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { formData, updateForm } = useRiderForm();

  // `view` is the local UI state; `formData.kycMode` persists the user's pick.
  const persistedMode = formData?.kycMode || (formData?.aadhaarVerified ? "digilocker" : null);
  const [view, setView] = useState(persistedMode ? "manual" : "choice");

  // Keep view in sync with persisted choice (e.g., after coming back from a
  // later step via the stepper).
  useEffect(() => {
    if (persistedMode && view !== "manual") setView("manual");
  }, [persistedMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToRentalDetails = () => {
    const stepTwoPath = location.pathname.replace(/\/step-\d+\b.*$/, "/step-2");
    navigate(stepTwoPath || "step-2");
  };

  const handlePickDigiLocker = () => {
    updateForm({ kycMode: "digilocker", kycDeferred: false });
    setView("manual");
    // Scroll to the DigiLocker section if the form has one.
    window.setTimeout(() => {
      const el = document.querySelector("[data-section='digilocker'], #digilocker-section");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handlePickManual = () => {
    updateForm({ kycMode: "manual", kycDeferred: false });
    setView("manual");
  };

  const handlePickLater = () => {
    updateForm({ kycMode: "later", kycDeferred: true });
    goToRentalDetails();
  };

  const handleBackToChoice = () => {
    setView("choice");
  };

  if (view === "manual") {
    return (
      <div className="space-y-5">
        <KycModeBreadcrumb
          mode={formData?.kycMode || "manual"}
          kycDeferred={Boolean(formData?.kycDeferred)}
          onBack={handleBackToChoice}
        />
        <Step1RiderDetails />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ChoiceScreen
        onPickDigiLocker={handlePickDigiLocker}
        onPickManual={handlePickManual}
        onPickLater={handlePickLater}
        kycDeferred={Boolean(formData?.kycDeferred)}
      />

      {/* Footer action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-evegah-border">
        <button
          type="button"
          onClick={() => navigate("/employee/dashboard")}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled
          aria-disabled
          title="Pick a verification option above"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary/40 text-white px-5 py-2.5 text-sm font-semibold cursor-not-allowed"
        >
          Continue to Rental Details
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
