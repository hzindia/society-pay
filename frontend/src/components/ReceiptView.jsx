import React from "react";

/**
 * ReceiptView — Printable receipt component
 * Can be used standalone or as part of the payment flow.
 */
export default function ReceiptView({ receipt, society, user, currency = "INR" }) {
  if (!receipt) return null;

  function fmt(amount) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
  }

  function handlePrint() {
    window.print();
  }

  async function handleDownload() {
    try {
      const token = localStorage.getItem("sp_token");
      const res = await fetch(`/api/payments/receipt/${receipt.transactionId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${receipt.transactionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback to print
      handlePrint();
    }
  }

  return (
    <div>
      {/* Action buttons — hidden when printing */}
      <div className="flex gap-2 justify-center mb-4 print:hidden">
        <button
          onClick={handleDownload}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-brand-700 text-white hover:bg-brand-800 transition-all"
        >
          📥 Download PDF
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 text-sm font-semibold rounded-xl border-2 border-gray-200 text-gray-700 hover:border-brand-700 transition-all"
        >
          🖨️ Print
        </button>
      </div>

      {/* Receipt card — print-friendly */}
      <div className="card overflow-hidden print:shadow-none print:border print:border-gray-300" id="receipt-print">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-700 to-emerald-600 p-5 text-center text-white print:bg-brand-700">
          <div className="text-2xl mb-1">🏘️</div>
          <div className="font-display font-bold text-lg">{society?.name || "Housing Society"}</div>
          <div className="text-xs text-white/80">Official Payment Receipt</div>
        </div>

        {/* Society Info */}
        {(society?.address || society?.email || society?.regNo) && (
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 text-center text-xs text-gray-500 space-y-0.5">
            {society.address && <div>{society.address}</div>}
            <div>
              {society.email && <span>Email: {society.email}</span>}
              {society.phone && <span className="ml-3">Phone: {society.phone}</span>}
            </div>
            {society.regNo && <div>Reg No: {society.regNo}</div>}
          </div>
        )}

        {/* Transaction ID */}
        <div className="mx-5 mt-4 mb-3 p-3 rounded-xl bg-green-50 border border-green-200 text-center">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Transaction ID</div>
          <div className="font-mono text-lg font-bold text-gray-900 tracking-wide">{receipt.transactionId}</div>
        </div>

        {/* Details */}
        <div className="px-5 space-y-0">
          <DetailRow label="Date & Time" value={receipt.paidAt ? new Date(receipt.paidAt).toLocaleString("en-IN") : "-"} />
          <DetailRow label="Flat No." value={`${user?.wing ? user.wing + "-" : ""}${user?.flatNumber}`} />
          <DetailRow label="Member Name" value={user?.name} />
          <DetailRow label="Payment For" value={receipt.paymentType} />
          <DetailRow label="Payment Method" value={receipt.paymentMethod?.replace(/_/g, " ").toUpperCase()} />

          <div className="border-t border-gray-200 my-2" />

          <DetailRow label="Base Amount" value={fmt(receipt.baseAmount)} />
          {receipt.surchargeAmount > 0 && (
            <DetailRow
              label={`Surcharge (${(receipt.surchargeRate * 100).toFixed(1)}%)`}
              value={`+ ${fmt(receipt.surchargeAmount)}`}
              valueClass="text-red-600"
            />
          )}
          {receipt.gstOnSurcharge > 0 && (
            <DetailRow
              label="GST on Surcharge"
              value={`+ ${fmt(receipt.gstOnSurcharge)}`}
              valueClass="text-red-600"
            />
          )}
        </div>

        {/* Total */}
        <div className="flex justify-between items-center mx-5 mt-3 pt-3 border-t-2 border-brand-700">
          <span className="font-bold text-brand-700">Total Paid</span>
          <span className="text-xl font-extrabold text-brand-700">{fmt(receipt.totalAmount)}</span>
        </div>

        {/* Status */}
        <div className="text-center py-3">
          <span className="inline-block px-5 py-1.5 rounded-full bg-green-100 text-green-800 text-sm font-bold">
            ✓ {receipt.status}
          </span>
        </div>

        {/* Razorpay ID */}
        {receipt.razorpayPaymentId && (
          <div className="text-center pb-2">
            <span className="text-xs text-gray-400 font-mono">Ref: {receipt.razorpayPaymentId}</span>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center text-[11px] text-gray-400 leading-relaxed">
          This is a computer-generated receipt. No signature required.
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, valueClass = "" }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold text-gray-900 text-right ${valueClass}`}>{value}</span>
    </div>
  );
}
