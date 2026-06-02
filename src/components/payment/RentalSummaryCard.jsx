// Right-rail "Rental Summary" card used on the Payment & Charges step in both
// the New Rider and Retain Rider wizards.
//
// All props are optional — missing rows are silently dropped.

import { FileText } from "lucide-react";

const formatINR = (n) => {
  const v = Number(n || 0);
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function Row({ label, value, valueClass = "" }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold text-evegah-text ${valueClass}`}>{value}</span>
    </div>
  );
}

export default function RentalSummaryCard({
  vehicle,
  battery,
  plan,
  planRate,
  expectedDuration,
  subTotal,
  gst,
  total,
}) {
  return (
    <div className="bg-white border border-evegah-border rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-evegah-primary" />
        <h3 className="text-sm font-bold text-evegah-text">Rental Summary</h3>
      </div>

      <div className="space-y-0.5">
        {vehicle ? <Row label="Vehicle" value={vehicle} /> : null}
        {battery ? <Row label="Battery" value={battery} /> : null}
        {plan ? <Row label="Plan" value={plan} /> : null}
        {planRate ? <Row label="Plan Rate (Daily)" value={planRate} /> : null}
        {expectedDuration ? <Row label="Expected Duration" value={expectedDuration} /> : null}
      </div>

      {subTotal != null || gst != null ? (
        <div className="mt-3 pt-3 border-t border-evegah-border space-y-0.5">
          {subTotal != null ? <Row label="Est. Sub Total" value={formatINR(subTotal)} /> : null}
          {gst != null ? <Row label="GST (18%)" value={formatINR(gst)} /> : null}
        </div>
      ) : null}

      {total != null ? (
        <div className="mt-3 pt-3 border-t border-evegah-border flex items-center justify-between">
          <span className="text-sm font-semibold text-evegah-text">Est. Total Payable</span>
          <span className="text-base font-bold text-evegah-primary">{formatINR(total)}</span>
        </div>
      ) : null}
    </div>
  );
}
