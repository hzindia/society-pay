import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../App";
import { api } from "../utils/api";
import SurchargeBreakdown from "../components/SurchargeBreakdown";

const METHOD_META = {
  upi: { icon: "⚡", label: "UPI", desc: "Google Pay, PhonePe, Paytm" },
  debit_card: { icon: "💳", label: "Debit Card", desc: "Visa, Mastercard, RuPay" },
  credit_card: { icon: "🏦", label: "Credit Card", desc: "Visa, Mastercard, Amex" },
  net_banking: { icon: "🏛️", label: "Net Banking", desc: "All major banks" },
  wallet: { icon: "👛", label: "Wallet", desc: "Paytm, Amazon Pay" },
};

const TYPE_ICONS = {
  "Monthly Maintenance": "🏠", "Parking Charges": "🚗", "Water Charges": "💧",
  "Sinking Fund": "🔧", "Repair Fund": "🛠️", "Late Payment Penalty": "⚠️",
  "Event Contribution": "🎉", "Other": "📋",
};

function fmt(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}

export default function PaymentPortal() {
  const { user, config } = useAuth();

  const [step, setStep] = useState(1);
  const [paymentType, setPaymentType] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("");
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");

  const surcharges = config?.payment?.surcharges || {};
  const paymentTypes = config?.payment?.types || [];
  const currency = config?.payment?.currency || "INR";

  const baseAmount = parseFloat(amount) || 0;
  const surchargeRate = (surcharges[method] || 0) / 100;
  const surchargeAmount = Math.round(baseAmount * surchargeRate * 100) / 100;

  let gstOnSurcharge = 0;
  if (config?.gst?.enabled && surchargeAmount > 0) {
    gstOnSurcharge = Math.round(surchargeAmount * (config.gst.rate / 100) * 100) / 100;
  }

  const totalAmount = Math.round((baseAmount + surchargeAmount + gstOnSurcharge) * 100) / 100;

  const stepLabels = ["Payment", "Method", "Review", "Done"];

  function goNext() {
    if (step === 1 && (!paymentType || baseAmount <= 0)) {
      return setError("Please select a payment type and enter a valid amount");
    }
    if (step === 2 && !method) {
      return setError("Please select a payment method");
    }
    setError("");
    setStep(step + 1);
  }

  // ── Razorpay Checkout ───────────────────────────────────────────────────
  async function handlePay() {
    setProcessing(true);
    setError("");

    try {
      // 1. Create order on backend
      const { payment, razorpay: rpConfig, society } = await api.post("/payments/create-order", {
        baseAmount,
        paymentMethod: method,
        paymentType,
        description,
      });

      // 2. Open Razorpay checkout
      const options = {
        key: rpConfig.keyId,
        amount: rpConfig.amount,
        currency: rpConfig.currency,
        name: society.name,
        description: `${paymentType} — ${payment.transactionId}`,
        order_id: rpConfig.orderId,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone || "",
        },
        notes: {
          transactionId: payment.transactionId,
          flat: `${user.wing ? user.wing + "-" : ""}${user.flatNumber}`,
        },
        theme: { color: "#1a6b4a" },

        handler: async function (response) {
          // 3. Verify payment on backend
          try {
            const result = await api.post("/payments/verify", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            setReceipt(result.payment);
            setStep(4);
          } catch (err) {
            setError("Payment verification failed. If amount was deducted, it will be refunded within 5-7 days.");
          }
          setProcessing(false);
        },

        modal: {
          ondismiss: function () {
            setProcessing(false);
            setError("Payment was cancelled");
          },
        },
      };

      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        setProcessing(false);
        setError(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err) {
      setProcessing(false);
      setError(err.message || "Failed to initiate payment");
    }
  }

  function handleReset() {
    setStep(1);
    setPaymentType("");
    setAmount("");
    setDescription("");
    setMethod("");
    setReceipt(null);
    setError("");
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Stepper */}
      {step < 4 && (
        <div className="flex items-center justify-center gap-0 mb-8">
          {stepLabels.slice(0, 3).map((label, i) => (
            <React.Fragment key={i}>
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${i + 1 < step ? "bg-brand-700 text-white" : i + 1 === step ? "bg-brand-700 text-white ring-4 ring-brand-100" : "bg-gray-200 text-gray-400"}`}>
                  {i + 1 < step ? "✓" : i + 1}
                </div>
                <span className={`text-xs font-semibold hidden sm:inline ${i + 1 <= step ? "text-brand-700" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < 2 && <div className={`w-8 h-0.5 mx-2 rounded ${i + 1 < step ? "bg-brand-700" : "bg-gray-200"}`} />}
            </React.Fragment>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="animate-fade-up" key={step}>

        {/* ── STEP 1: Payment Type & Amount ──────────────────────────────── */}
        {step === 1 && (
          <div className="card p-6">
            <h2 className="font-display text-xl font-bold text-gray-900 mb-1">Make a Payment</h2>
            <p className="text-sm text-gray-500 mb-5">
              Hi {user?.name}, select the charge type and enter the amount
            </p>

            <label className="block text-sm font-semibold text-gray-700 mb-2">Payment For</label>
            <div className="flex flex-wrap gap-2 mb-5">
              {paymentTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => { setPaymentType(type); setError(""); }}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all
                    ${paymentType === type
                      ? "bg-brand-700 text-white border-brand-700 shadow-lg shadow-brand-700/20"
                      : "bg-white text-gray-700 border-gray-200 hover:border-brand-400 hover:shadow"
                    }`}
                >
                  <span className="mr-1">{TYPE_ICONS[type] || "📋"}</span> {type}
                </button>
              ))}
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (₹)</label>
            <input
              type="number" min="1" step="0.01"
              className="input-field text-2xl font-bold tracking-wide"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(""); }}
            />

            <label className="block text-sm font-semibold text-gray-700 mb-2 mt-4">
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text" className="input-field"
              placeholder="e.g. March 2026 maintenance"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <button onClick={goNext} className="btn-primary w-full mt-6">
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2: Payment Method ─────────────────────────────────────── */}
        {step === 2 && (
          <div className="card p-6">
            <h2 className="font-display text-xl font-bold text-gray-900 mb-1">Payment Method</h2>
            <p className="text-sm text-gray-500 mb-5">Choose how you'd like to pay</p>

            <div className="space-y-3">
              {Object.entries(METHOD_META).map(([key, meta]) => {
                const rate = surcharges[key] || 0;
                const isSelected = method === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setMethod(key); setError(""); }}
                    className={`w-full flex items-center gap-3.5 p-4 rounded-xl border-2 text-left transition-all
                      ${isSelected
                        ? "border-brand-700 bg-brand-50 shadow-md shadow-brand-700/10"
                        : "border-gray-200 bg-white hover:border-brand-300 hover:shadow"
                      }`}
                  >
                    <div className="text-2xl w-9 text-center">{meta.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900">{meta.label}</div>
                      <div className="text-xs text-gray-500">{meta.desc}</div>
                    </div>
                    <div className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap
                      ${rate > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                      {rate > 0 ? `${rate}% fee` : "No fee"}
                    </div>
                  </button>
                );
              })}
            </div>

            {method && (
              <SurchargeBreakdown
                baseAmount={baseAmount}
                surchargeRate={surchargeRate}
                surchargeAmount={surchargeAmount}
                gstOnSurcharge={gstOnSurcharge}
                totalAmount={totalAmount}
                currency={currency}
              />
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
              <button onClick={goNext} className="btn-primary flex-1">Continue →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="card overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="font-display text-xl font-bold text-gray-900 mb-1">Review & Pay</h2>
              <p className="text-sm text-gray-500 mb-5">Confirm your payment details</p>

              <div className="space-y-3 text-sm">
                <Row label="Flat No." value={`${user?.wing ? user.wing + "-" : ""}${user?.flatNumber}`} />
                <Row label="Member" value={user?.name} />
                <Row label="Payment For" value={`${TYPE_ICONS[paymentType] || ""} ${paymentType}`} />
                {description && <Row label="Description" value={description} />}
                <Row label="Method" value={`${METHOD_META[method]?.icon} ${METHOD_META[method]?.label}`} />
                <Row label="Base Amount" value={fmt(baseAmount, currency)} />
                {surchargeAmount > 0 && (
                  <Row label={`Surcharge (${(surchargeRate * 100).toFixed(1)}%)`} value={`+ ${fmt(surchargeAmount, currency)}`} valueClass="text-red-600" />
                )}
                {gstOnSurcharge > 0 && (
                  <Row label="GST on Surcharge" value={`+ ${fmt(gstOnSurcharge, currency)}`} valueClass="text-red-600" />
                )}
              </div>
            </div>

            <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-brand-700 to-emerald-600 text-white">
              <span className="font-semibold">Total Payable</span>
              <span className="text-2xl font-extrabold">{fmt(totalAmount, currency)}</span>
            </div>

            <div className="p-6 pt-4 flex gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1">← Back</button>
              <button
                onClick={handlePay}
                disabled={processing}
                className="btn-primary flex-1 text-base"
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                    Processing...
                  </span>
                ) : (
                  `Pay ${fmt(totalAmount, currency)}`
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Receipt ────────────────────────────────────────────── */}
        {step === 4 && receipt && (
          <div className="text-center">
            <div className="animate-check-pop inline-block mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-700 to-emerald-500 text-white
                              inline-flex items-center justify-center text-4xl font-bold shadow-xl shadow-brand-700/30">
                ✓
              </div>
            </div>
            <h2 className="font-display text-2xl font-bold text-brand-700 mb-1">Payment Successful!</h2>
            <p className="text-sm text-gray-500 mb-6">A confirmation email has been sent to {user?.email}</p>

            <div className="card overflow-hidden text-left">
              <div className="p-5 text-center border-b border-dashed border-gray-200">
                <div className="text-xl mb-1">🏘️</div>
                <div className="font-display font-bold text-brand-700">{config?.society?.shortName}</div>
                <div className="text-xs text-gray-400">Official Payment Receipt</div>
              </div>

              <div className="mx-5 my-3 p-3 rounded-xl bg-green-50 border border-green-200 text-center">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Transaction ID</div>
                <div className="font-mono text-lg font-bold text-gray-900 tracking-wide">{receipt.transactionId}</div>
              </div>

              <div className="px-5 space-y-2 text-sm">
                <Row label="Date" value={new Date(receipt.paidAt).toLocaleString("en-IN")} />
                <Row label="Flat No." value={`${user?.wing ? user.wing + "-" : ""}${user?.flatNumber}`} />
                <Row label="Payment For" value={receipt.paymentType} />
                <Row label="Method" value={METHOD_META[receipt.paymentMethod]?.label} />
                <Row label="Base Amount" value={fmt(receipt.baseAmount, currency)} />
                {receipt.surchargeAmount > 0 && (
                  <Row label={`Surcharge (${(receipt.surchargeRate * 100).toFixed(1)}%)`} value={`+ ${fmt(receipt.surchargeAmount, currency)}`} valueClass="text-red-600" />
                )}
                {receipt.gstOnSurcharge > 0 && (
                  <Row label="GST on Surcharge" value={`+ ${fmt(receipt.gstOnSurcharge, currency)}`} valueClass="text-red-600" />
                )}
              </div>

              <div className="flex justify-between items-center mx-5 mt-3 pt-3 pb-2 border-t-2 border-brand-700 text-brand-700 font-bold">
                <span>Total Paid</span>
                <span className="text-xl font-extrabold">{fmt(receipt.totalAmount, currency)}</span>
              </div>

              <div className="text-center py-3">
                <span className="inline-block px-5 py-1.5 rounded-full bg-green-100 text-green-800 text-sm font-bold">
                  ✓ {receipt.status}
                </span>
              </div>

              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center text-[11px] text-gray-400 leading-relaxed">
                This is a computer-generated receipt. No signature required.<br />
                {config?.society?.email && <>For queries: {config.society.email}</>}
                {config?.society?.regNo && <> | Reg: {config.society.regNo}</>}
              </div>
            </div>

            <button onClick={handleReset} className="btn-secondary mt-6">
              Make Another Payment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = "" }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold text-gray-900 text-right ${valueClass}`}>{value}</span>
    </div>
  );
}
