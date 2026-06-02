import { useMemo, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
  useParams,
  Link,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  LifeBuoy,
  Save,
  ShieldCheck,
} from "lucide-react";

import EmployeeLayout from "../../components/layouts/EmployeeLayout";
import { RiderFormProvider } from "./RiderFormContext";
import { useRiderForm } from "./useRiderForm";
import useAuth from "../../hooks/useAuth";
import RentalSummaryCard from "../../components/payment/RentalSummaryCard";

import Step1KycVerification from "./riderSteps/Step1KycVerification";
import Step2Identity from "./riderSteps/Step2Identity";
import Step3Agreement from "./riderSteps/Step3Agreement";
import Step4Photos from "./riderSteps/Step4Photos";
import Step5Payment from "./riderSteps/Step5Payment";

// ---------------------------------------------------------------------------
// Step definitions (re-labeled to match the new reference design)
// ---------------------------------------------------------------------------

const STEPS = [
  { path: "step-1", title: "KYC Verification" },
  { path: "step-2", title: "Rental Details" },
  { path: "step-3", title: "Agreement" },
  { path: "step-4", title: "Documents" },
  { path: "step-5", title: "Payment & Charges" },
];

// Per-step helper card shown in the right rail.
const STEP_HELPERS = {
  "step-1": {
    title: "Why KYC is Important?",
    icon: ShieldCheck,
    tint: "purple",
    items: [
      "Ensures rider identity authenticity",
      "Helps prevent fraud and misuse",
      "Complies with government regulations",
      "Ensures a safe experience for everyone",
    ],
  },
  "step-2": {
    title: "Important Note",
    icon: Info,
    tint: "amber",
    items: [
      "Plan and rates are subject to change as per company policy.",
      "Actual charges may vary based on the final return time.",
    ],
  },
  "step-3": {
    title: "Before You Sign",
    icon: ShieldCheck,
    tint: "purple",
    items: [
      "Confirm all rider details are accurate.",
      "Read the full Rider Terms & Conditions.",
      "Signature must match the ID on record.",
    ],
  },
  "step-4": {
    title: "Document Tips",
    icon: FileText,
    tint: "purple",
    items: [
      "Use well-lit, clear photos with no glare.",
      "Capture vehicle from all required angles.",
      "Accepted formats: JPG, PNG, PDF (max 5MB each).",
    ],
  },
  "step-5": {
    title: "Important Note",
    icon: Info,
    tint: "amber",
    items: [
      "Plan and rates are subject to change as per company policy.",
      "Actual charges may vary based on the final return time.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers / small components
// ---------------------------------------------------------------------------

function statusForStep(index, currentIndex) {
  if (index < currentIndex) return "completed";
  if (index === currentIndex) return "in_progress";
  return "pending";
}

const STATUS_TEXT = {
  completed: "Completed",
  in_progress: "In Progress",
  pending: "Pending",
};

const STATUS_TEXT_COLOR = {
  completed: "text-emerald-600",
  in_progress: "text-evegah-primary",
  pending: "text-gray-400",
};

function HorizontalStepper({ currentIndex, onStepClick }) {
  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-1">
      {STEPS.map((step, index) => {
        const status = statusForStep(index, currentIndex);
        const isComplete = status === "completed";
        const isActive = status === "in_progress";
        const showConnector = index < STEPS.length - 1;
        const nextStatus = index < STEPS.length - 1 ? statusForStep(index + 1, currentIndex) : null;
        const connectorActive = isComplete || (isActive && nextStatus !== "pending");

        const circleClass = isComplete
          ? "bg-evegah-primary text-white border-evegah-primary"
          : isActive
          ? "bg-evegah-primary text-white border-evegah-primary"
          : "bg-white text-gray-400 border-gray-200";

        const labelClass = isComplete || isActive ? "text-evegah-text" : "text-gray-400";

        return (
          <div key={step.path} className="flex items-start gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onStepClick?.(index)}
              className="flex items-start gap-3 text-left min-w-0 group"
            >
              <span
                className={`h-9 w-9 rounded-full border-2 grid place-items-center text-sm font-bold shrink-0 transition-colors ${circleClass}`}
              >
                {isComplete ? <Check size={16} /> : index + 1}
              </span>
              <span className="flex flex-col min-w-0 leading-tight">
                <span className={`text-sm font-semibold ${labelClass} group-hover:text-evegah-primary truncate`}>
                  {step.title}
                </span>
                <span className={`text-xs ${STATUS_TEXT_COLOR[status]}`}>
                  {STATUS_TEXT[status]}
                </span>
              </span>
            </button>

            {showConnector ? (
              <div className="flex-1 pt-[18px] min-w-[24px]">
                <div
                  className={`h-[2px] w-full rounded-full ${
                    connectorActive ? "bg-evegah-primary" : "bg-gray-200"
                  }`}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ProgressPanel({ currentIndex, onStepClick }) {
  return (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <h3 className="text-sm font-bold text-evegah-text">Progress</h3>
      <ol className="mt-4 space-y-3">
        {STEPS.map((step, index) => {
          const status = statusForStep(index, currentIndex);
          const isComplete = status === "completed";
          const isActive = status === "in_progress";
          const circleClass = isComplete
            ? "bg-evegah-primary text-white"
            : isActive
            ? "bg-evegah-primary text-white"
            : "bg-gray-100 text-gray-400";
          return (
            <li key={step.path}>
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                className="w-full flex items-start gap-3 text-left group"
              >
                <span
                  className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${circleClass}`}
                >
                  {isComplete ? <Check size={14} /> : index + 1}
                </span>
                <span className="flex flex-col min-w-0 leading-tight">
                  <span
                    className={`text-sm font-semibold ${
                      isActive ? "text-evegah-primary" : isComplete ? "text-evegah-text" : "text-gray-500"
                    } group-hover:text-evegah-primary truncate`}
                  >
                    {step.title}
                  </span>
                  <span className={`text-xs ${STATUS_TEXT_COLOR[status]}`}>
                    {STATUS_TEXT[status]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepHelperCard({ stepPath }) {
  const helper = STEP_HELPERS[stepPath];
  if (!helper) return null;

  const tint =
    helper.tint === "amber"
      ? {
          iconBg: "bg-amber-100 text-amber-600",
          border: "border-amber-200",
          bg: "bg-amber-50/60",
          text: "text-amber-800",
          bullet: "bg-amber-500",
        }
      : {
          iconBg: "bg-brand-light text-evegah-primary",
          border: "border-evegah-border",
          bg: "bg-white",
          text: "text-gray-600",
          bullet: "bg-evegah-primary",
        };

  const Icon = helper.icon;

  return (
    <div className={`border ${tint.border} ${tint.bg} rounded-2xl shadow-card p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-9 w-9 grid place-items-center rounded-xl ${tint.iconBg}`}>
          <Icon size={16} />
        </span>
        <h3 className="text-sm font-bold text-evegah-text">{helper.title}</h3>
      </div>
      <ul className="space-y-2">
        {helper.items.map((item) => (
          <li key={item} className={`flex items-start gap-2 text-xs ${tint.text}`}>
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${tint.bullet}`} />
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
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
      <p className="mt-1 text-xs text-gray-500">Facing issues with the form?</p>
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
// Shell — wraps the form with breadcrumb, stepper, right rail
// ---------------------------------------------------------------------------

function RiderShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { formData, saveDraft, resetForm } = useRiderForm();
  const [actionNote, setActionNote] = useState(null);

  const match = location.pathname.match(/\/(step-\d+)\b/);
  const stepPath = match?.[1] || "step-1";
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.path === stepPath));
  const currentStep = STEPS[currentIndex];

  const basePath = location.pathname.replace(/\/(step-\d+)\b.*$/, "");
  const normalizedBasePath = basePath.replace(/\/+$/, "");
  const buildStepPath = (step) =>
    normalizedBasePath ? `${normalizedBasePath}/${step}` : `/${step}`;

  const showActionNote = (type, message) => {
    setActionNote({ type, message });
    window.clearTimeout(showActionNote._t);
    showActionNote._t = window.setTimeout(() => setActionNote(null), 3000);
  };

  const handleStepClick = (index) => {
    const step = STEPS[index];
    if (!step) return;
    navigate(buildStepPath(step.path));
  };

  const handleSaveDraft = async () => {
    if (!formData?.name && !formData?.phone && !formData?.aadhaar) {
      showActionNote("warning", "Add rider details before saving a draft.");
      return;
    }
    try {
      await saveDraft({
        stepLabel: currentStep?.title || `Step ${currentIndex + 1}`,
        stepPath: currentStep?.path || "step-1",
      });
      showActionNote("success", "Draft saved.");
    } catch (e) {
      showActionNote(
        "error",
        e?.message ? `Unable to save draft: ${e.message}` : "Unable to save draft."
      );
    }
  };

  const handleClearForm = () => {
    resetForm();
    navigate(buildStepPath("step-1"), { replace: true });
    showActionNote("info", "Form cleared.");
  };

  const noteColor = useMemo(
    () => ({
      success: "text-emerald-600",
      error: "text-rose-600",
      warning: "text-amber-700",
      info: "text-sky-600",
    }),
    []
  );

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
        <Link to="/employee/dashboard" className="hover:text-evegah-primary inline-flex items-center gap-1">
          <ArrowLeft size={12} />
          Home
        </Link>
        <ChevronRight size={12} className="text-gray-400" />
        <span>Rides / Rentals</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-evegah-primary">New Ride Registration</span>
      </nav>

      {/* Title + back-to-rides */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-evegah-text">New Ride Registration</h1>
          <p className="text-sm text-gray-500">Register a new ride for the rider.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/employee/dashboard")}
          className="self-start sm:self-auto inline-flex items-center gap-2 rounded-2xl border border-evegah-border bg-white px-4 py-2 text-sm font-semibold text-evegah-primary hover:bg-evegah-bg whitespace-nowrap"
        >
          <ArrowLeft size={16} />
          Back to Rides
        </button>
      </div>

      {/* Top stepper */}
      <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-4 sm:p-5">
        <HorizontalStepper currentIndex={currentIndex} onStepClick={handleStepClick} />
        {actionNote ? (
          <p className={`mt-3 text-xs text-center font-medium ${noteColor[actionNote.type] || "text-gray-600"}`}>
            {actionNote.message}
          </p>
        ) : null}
      </div>

      {/* Main + right rail */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        {/* Main area */}
        <div className="min-w-0 space-y-6">
          <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5 sm:p-6">
            {/* The actual step body renders here (each step has its own form + nav buttons) */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-evegah-primary">
                  Step {currentIndex + 1}
                </p>
                <h2 className="text-xl font-bold text-evegah-text">{currentStep?.title || ""}</h2>
              </div>
              <div className="flex items-center gap-2">
                {currentStep?.path !== "step-5" ? (
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-evegah-border px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-evegah-bg"
                  >
                    Clear Form
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-evegah-primary text-evegah-primary px-3 py-1.5 text-xs font-semibold hover:bg-brand-light/40"
                >
                  <Save size={14} />
                  Save Draft
                </button>
              </div>
            </div>

            <Routes>
              <Route path="/" element={<Navigate to="step-1" replace />} />
              <Route path="step-1" element={<Step1KycVerification />} />
              <Route path="step-2" element={<Step2Identity />} />
              <Route path="step-3" element={<Step3Agreement />} />
              <Route path="step-4" element={<Step4Photos />} />
              <Route path="step-5" element={<Step5Payment />} />
            </Routes>
          </div>
        </div>

        {/* Right rail */}
        <aside className="space-y-5 xl:sticky xl:top-24">
          {stepPath === "step-5" ? (
            <RentalSummaryCard
              vehicle={formData?.bikeModel ? `Evegah ${formData.bikeModel}` : formData?.bikeId || "Evegah E1"}
              battery={formData?.batteryId || "Evegah 60V 30Ah"}
              plan={
                formData?.rentalPackage
                  ? `${formData.rentalPackage.replace(/^./, (c) => c.toUpperCase())} Plan`
                  : "Daily Plan"
              }
              planRate={`₹${Number(formData?.rentalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              expectedDuration={
                formData?.rentalPackage
                  ? `1 ${formData.rentalPackage.replace(/s$/, "")}`
                  : "1 Day"
              }
              subTotal={Number(formData?.rentalAmount || 0)}
              gst={Number(((Number(formData?.rentalAmount || 0)) * 0.18).toFixed(2))}
              total={
                Number(formData?.rentalAmount || 0) +
                Number(((Number(formData?.rentalAmount || 0)) * 0.18).toFixed(2))
              }
            />
          ) : (
            <ProgressPanel currentIndex={currentIndex} onStepClick={handleStepClick} />
          )}
          <StepHelperCard stepPath={stepPath} />
          <NeedHelpCard />
        </aside>
      </div>

      {/* Footer pager hint (purely decorative; the active step renders its own Save & Continue button) */}
      <div className="text-[11px] text-gray-400 flex items-center justify-end gap-2">
        <span>Step {currentIndex + 1} of {STEPS.length}</span>
        {currentIndex < STEPS.length - 1 ? (
          <>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              Next: {STEPS[currentIndex + 1].title}
              <ArrowRight size={11} />
            </span>
          </>
        ) : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// Silence unused-import warnings: HelpCircle is referenced by potential future
// helper cards. Re-export via no-op to keep the import working.
void HelpCircle;

export default function RiderForm() {
  const { user, loading } = useAuth();
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
  const quickRideMode = ["1", "true", "yes"].includes(
    String(searchParams.get("quick") || "").toLowerCase()
  );

  if (loading) return null;

  return (
    <EmployeeLayout>
      <RiderFormProvider
        user={user}
        initialDraftId={draftId || null}
        initialQuickRideMode={quickRideMode}
      >
        <div className="w-full space-y-5">
          <RiderShell />
        </div>
      </RiderFormProvider>
    </EmployeeLayout>
  );
}
