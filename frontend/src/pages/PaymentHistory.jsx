import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { useAuth } from "../App";

const STATUS_COLORS = {
  CAPTURED: "bg-green-100 text-green-800",
  CREATED: "bg-yellow-100 text-yellow-800",
  FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-blue-100 text-blue-800",
};

function fmt(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}

export default function PaymentHistory() {
  const { config } = useAuth();
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  const currency = config?.payment?.currency || "INR";

  useEffect(() => {
    loadPayments();
  }, [page]);

  async function loadPayments() {
    setLoading(true);
    try {
      const data = await api.get(`/payments/history?page=${page}&limit=15`);
      setPayments(data.payments);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading && payments.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-brand-700 rounded-full animate-spin-slow mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading payment history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">Payment History</h1>
      <p className="text-sm text-gray-500 mb-6">All your past transactions</p>

      {payments.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500 font-medium">No payments yet</p>
          <p className="text-gray-400 text-sm mt-1">Your transactions will appear here after your first payment</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="card overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}
            >
              <div className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg
                  ${p.status === "CAPTURED" ? "bg-green-100" : p.status === "FAILED" ? "bg-red-100" : "bg-yellow-100"}`}>
                  {p.status === "CAPTURED" ? "✅" : p.status === "FAILED" ? "❌" : "⏳"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{p.paymentType}</div>
                  <div className="text-xs text-gray-400 font-mono">{p.transactionId}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{fmt(p.totalAmount, currency)}</div>
                  <div className="text-xs text-gray-400">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Pending"}
                  </div>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded === p.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {expanded === p.id && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50">
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm py-3">
                    <div className="text-gray-500">Base Amount</div>
                    <div className="font-medium text-right">{fmt(p.baseAmount, currency)}</div>
                    {p.surchargeAmount > 0 && (
                      <>
                        <div className="text-gray-500">Surcharge</div>
                        <div className="font-medium text-right text-red-600">+ {fmt(p.surchargeAmount, currency)}</div>
                      </>
                    )}
                    {p.gstOnSurcharge > 0 && (
                      <>
                        <div className="text-gray-500">GST on Surcharge</div>
                        <div className="font-medium text-right text-red-600">+ {fmt(p.gstOnSurcharge, currency)}</div>
                      </>
                    )}
                    <div className="text-gray-500">Method</div>
                    <div className="font-medium text-right capitalize">{p.paymentMethod?.replace("_", " ")}</div>
                    <div className="text-gray-500">Status</div>
                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500 font-medium">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            disabled={page >= pagination.pages}
            onClick={() => setPage(page + 1)}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
