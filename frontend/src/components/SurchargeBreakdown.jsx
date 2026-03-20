import React from "react";

function fmt(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}

export default function SurchargeBreakdown({ baseAmount, surchargeRate, surchargeAmount, gstOnSurcharge = 0, totalAmount, currency = "INR" }) {
  if (!surchargeRate || surchargeRate === 0) return null;

  return (
    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
      <div className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
        💡 Surcharge Breakdown
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-gray-700">
          <span>Base Amount</span>
          <span>{fmt(baseAmount, currency)}</span>
        </div>
        <div className="flex justify-between text-gray-700">
          <span>Surcharge ({(surchargeRate * 100).toFixed(1)}%)</span>
          <span className="text-red-600 font-semibold">+ {fmt(surchargeAmount, currency)}</span>
        </div>
        {gstOnSurcharge > 0 && (
          <div className="flex justify-between text-gray-700">
            <span>GST on Surcharge</span>
            <span className="text-red-600 font-semibold">+ {fmt(gstOnSurcharge, currency)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 mt-1 border-t-2 border-amber-300">
          <span className="font-bold text-gray-900">Total Payable</span>
          <span className="font-extrabold text-brand-700 text-base">{fmt(totalAmount, currency)}</span>
        </div>
      </div>
    </div>
  );
}
