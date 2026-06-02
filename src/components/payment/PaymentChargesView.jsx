// Reusable "Payment & Charges" body matching the agreed design.
//
// Used by both the New Rider wizard (Step 5 - Payment) and the Retain Rider
// wizard (Step 3 - Payment) so the visual treatment stays in lockstep.
//
// The component is presentational — the host owns the data and submit logic
// and passes everything in via props.
//
// Props
//   paymentMethod        currently selected method ("upi" | "card" | "cash" | "wallet")
//   onPaymentMethodChange(id)
//   methodInputValue     value of the per-method input (UPI id / card number / wallet number)
//   onMethodInputChange(value)
//   methodVerified       boolean — shows the green Verified badge + banner
//
//   summary { plan, deposit, accessories, gst, total }
//                        all numbers in INR. Each label is rendered as is.
//   summaryNote          optional string under the summary (e.g. refund note)
//
//   breakdown {          right-column charges breakdown
//     plan, vehicle, battery, planRate, expectedDuration
//   }
//   includes             string[] of bullet items in the "Includes" sub-section
//
//   couponCode           controlled value
//   onCouponCodeChange(value)
//   couponStatus { type: "success"|"error", message }   optional
//   onApplyCoupon()
//
//   qrSlot               optional ReactNode rendered below the method input
//                        (used to host the live UPI QR + status when UPI is
//                        selected and the host wants to show it)
//   extraSlot            optional ReactNode rendered at the very end (e.g.
//                        success/error banners controlled by the host)

import { CheckCircle2, CreditCard, HandCoins, Info, ShieldCheck, Smartphone, Sparkles, Wallet } from "lucide-react";

const PAYMENT_METHOD_TILES = [
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "cash", label: "Cash", icon: HandCoins },
  { id: "wallet", label: "Wallet", icon: Wallet },
];

const formatINR = (n) => {
  const v = Number(n || 0);
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function SectionTitle({ index, children, action }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="text-sm font-bold text-evegah-text">
        <span className="text-evegah-text">{index}. </span>
        {children}
      </h3>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function SummaryRow({ label, value, valueClass = "" }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold text-evegah-text ${valueClass}`}>{value}</span>
    </div>
  );
}

export default function PaymentChargesView({
  paymentMethod = "upi",
  onPaymentMethodChange,
  methodInputValue = "",
  onMethodInputChange,
  methodVerified = false,
  summary = {},
  summaryNote,
  breakdown = {},
  includes = [],
  couponCode = "",
  onCouponCodeChange,
  couponStatus,
  onApplyCoupon,
  qrSlot,
  extraSlot,
}) {
  const planAmount = Number(summary.plan || 0);
  const depositAmount = Number(summary.deposit || 0);
  const accessoryAmount = Number(summary.accessories || 0);
  const gstAmount = Number(summary.gst || 0);
  const totalAmount = Number(summary.total || planAmount + depositAmount + accessoryAmount + gstAmount);

  const methodInputConfig = (() => {
    switch (paymentMethod) {
      case "upi":
        return {
          label: "UPI ID / Number",
          placeholder: "name@upi",
          type: "text",
        };
      case "card":
        return {
          label: "Card Number",
          placeholder: "1234 5678 9012 3456",
          type: "text",
        };
      case "wallet":
        return {
          label: "Wallet Number",
          placeholder: "Linked mobile / wallet id",
          type: "text",
        };
      case "cash":
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-5">
      {/* Two-column main */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT COLUMN -------------------------------------------------- */}
        <div className="space-y-5">
          {/* 1. Select Payment Method */}
          <div>
            <SectionTitle index="1">Select Payment Method</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_METHOD_TILES.map((m) => {
                const Icon = m.icon;
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onPaymentMethodChange?.(m.id)}
                    className={`group flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-xs font-semibold transition-colors ${
                      active
                        ? "border-evegah-primary bg-brand-light/30 text-evegah-primary shadow-card"
                        : "border-evegah-border bg-white text-evegah-text hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-xl ${
                        active
                          ? "bg-evegah-primary text-white"
                          : "bg-gray-100 text-gray-500 group-hover:bg-evegah-primary/10 group-hover:text-evegah-primary"
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Method-specific input + verification (hidden for Cash) */}
          {methodInputConfig ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-evegah-text inline-flex items-center gap-1">
                {methodInputConfig.label}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={methodInputConfig.type}
                  value={methodInputValue || ""}
                  onChange={(e) => onMethodInputChange?.(e.target.value)}
                  placeholder={methodInputConfig.placeholder}
                  className="w-full rounded-xl border border-evegah-border bg-white pl-3 pr-24 py-2.5 text-sm outline-none focus:border-evegah-primary"
                />
                {methodVerified ? (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold px-2 py-0.5">
                    Verified <CheckCircle2 size={12} />
                  </span>
                ) : null}
              </div>
              {methodVerified ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-3 py-2 inline-flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Payment method verified successfully.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-evegah-border bg-evegah-bg/50 text-xs text-gray-600 px-3 py-3 inline-flex items-center gap-2">
              <HandCoins size={14} className="text-evegah-primary" />
              Cash payment selected. Collect the amount in person before issuing the vehicle.
            </div>
          )}

          {/* QR (UPI live QR) — host-supplied */}
          {qrSlot}

          {/* 2. Payment Summary */}
          <div>
            <SectionTitle index="2">Payment Summary</SectionTitle>
            <div className="rounded-2xl border border-evegah-border bg-white p-4">
              <SummaryRow
                label={`Plan Charges${breakdown.expectedDuration ? ` (${breakdown.expectedDuration})` : ""}`}
                value={formatINR(planAmount)}
              />
              <SummaryRow label="Security Deposit" value={formatINR(depositAmount)} />
              <SummaryRow
                label={
                  <span className="inline-flex items-center gap-1">
                    Accessories
                    <Info size={11} className="text-gray-400" />
                  </span>
                }
                value={formatINR(accessoryAmount)}
              />
              <SummaryRow label="Taxes (18% GST)" value={formatINR(gstAmount)} />
              <div className="mt-2 pt-3 border-t border-evegah-border flex items-center justify-between">
                <span className="text-sm font-bold text-evegah-text">Total Amount</span>
                <span className="text-lg font-bold text-evegah-primary">{formatINR(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Refund note */}
          {summaryNote !== false ? (
            <div className="rounded-xl bg-brand-light/30 border border-brand-light text-evegah-primary text-xs px-3 py-2.5 inline-flex items-center gap-2">
              <ShieldCheck size={14} className="shrink-0" />
              <span>
                {summaryNote ||
                  "Security deposit is refundable after the vehicle is returned in good condition."}
              </span>
            </div>
          ) : null}
        </div>

        {/* RIGHT COLUMN ------------------------------------------------- */}
        <div className="space-y-5">
          {/* 3. Apply Coupon */}
          <div>
            <SectionTitle index="3">
              Apply Coupon <span className="font-normal text-gray-500">(Optional)</span>
            </SectionTitle>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode || ""}
                onChange={(e) => onCouponCodeChange?.(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                className="flex-1 rounded-xl border border-evegah-border bg-white px-3 py-2.5 text-sm outline-none focus:border-evegah-primary"
              />
              <button
                type="button"
                onClick={onApplyCoupon}
                disabled={!couponCode}
                className="inline-flex items-center justify-center rounded-xl bg-evegah-primary text-white px-4 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
            {couponStatus?.message ? (
              <p
                className={`mt-2 text-xs font-semibold inline-flex items-center gap-1 ${
                  couponStatus.type === "error" ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {couponStatus.type === "error" ? null : <Sparkles size={12} />} {couponStatus.message}
              </p>
            ) : null}
          </div>

          {/* Charges Breakdown */}
          <div className="rounded-2xl border border-evegah-border bg-white p-4">
            <h4 className="text-sm font-bold text-evegah-text mb-3">Charges Breakdown</h4>
            <div className="space-y-1">
              {breakdown.plan ? <SummaryRow label="Plan" value={breakdown.plan} /> : null}
              {breakdown.vehicle ? <SummaryRow label="Vehicle" value={breakdown.vehicle} /> : null}
              {breakdown.battery ? <SummaryRow label="Battery" value={breakdown.battery} /> : null}
              {breakdown.planRate ? <SummaryRow label="Plan Rate (Daily)" value={breakdown.planRate} /> : null}
              {breakdown.expectedDuration ? (
                <SummaryRow label="Expected Duration" value={breakdown.expectedDuration} />
              ) : null}
            </div>

            {includes.length > 0 ? (
              <div className="mt-4 pt-3 border-t border-evegah-border">
                <p className="text-xs font-semibold text-evegah-text mb-2">Includes</p>
                <ul className="space-y-1.5">
                  {includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {extraSlot}
        </div>
      </div>
    </div>
  );
}

export { formatINR, PAYMENT_METHOD_TILES };
