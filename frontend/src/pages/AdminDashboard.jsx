import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { useAuth } from "../App";

function fmt(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}

export default function AdminDashboard() {
  const { config } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [payments, setPayments] = useState([]);
  const [payPage, setPayPage] = useState(1);
  const [payPagination, setPayPagination] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [exporting, setExporting] = useState(false);

  const currency = config?.payment?.currency || "INR";

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (tab === "payments") loadPayments();
  }, [tab, payPage, searchTerm]);

  async function loadDashboard() {
    try {
      const res = await api.get("/admin/dashboard");
      setData(res);
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments() {
    try {
      const search = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : "";
      const res = await api.get(`/admin/payments?page=${payPage}&limit=20${search}`);
      setPayments(res.payments);
      setPayPagination(res.pagination);
    } catch (err) {
      console.error("Payments load failed:", err);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const token = localStorage.getItem("sp_token");
      const res = await fetch("/api/admin/export/csv", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-brand-700 rounded-full animate-spin-slow mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading dashboard...</p>
      </div>
    );
  }

  const s = data?.stats || {};

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Society payment overview & management</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn-secondary text-sm">
          {exporting ? "Exporting..." : "📥 Export CSV"}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Collected" value={fmt(s.totalCollected, currency)} accent="brand" />
        <StatCard label="This Month" value={fmt(s.monthlyCollected, currency)} sub={`${s.monthlyTransactions} txns`} accent="emerald" />
        <StatCard label="Surcharges Earned" value={fmt(s.totalSurcharges, currency)} accent="amber" />
        <StatCard label="Residents" value={s.totalResidents} sub={`${s.totalTransactions} total txns`} accent="blue" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {["overview", "payments"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize
              ${tab === t ? "bg-white text-brand-700 shadow" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Recent Payments */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Recent Payments</h3>
            <div className="space-y-2">
              {(data?.recentPayments || []).map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                  <div>
                    <div className="font-medium text-gray-900">{p.resident}</div>
                    <div className="text-xs text-gray-400">{p.paymentType}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-brand-700">{fmt(p.totalAmount, currency)}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.recentPayments || data.recentPayments.length === 0) && (
                <p className="text-gray-400 text-sm py-4 text-center">No payments yet</p>
              )}
            </div>
          </div>

          {/* Breakdowns */}
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">By Payment Type</h3>
              <div className="space-y-2">
                {(data?.breakdowns?.byType || []).map((b, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-1.5">
                    <span className="text-gray-600">{b.type} <span className="text-gray-400">({b.count})</span></span>
                    <span className="font-bold text-gray-900">{fmt(b.total, currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">By Payment Method</h3>
              <div className="space-y-2">
                {(data?.breakdowns?.byMethod || []).map((b, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-1.5">
                    <span className="text-gray-600 capitalize">{b.method?.replace("_", " ")} <span className="text-gray-400">({b.count})</span></span>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">{fmt(b.total, currency)}</span>
                      {b.surcharges > 0 && (
                        <span className="text-xs text-amber-600 ml-2">(+{fmt(b.surcharges, currency)} fees)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div>
          <div className="mb-4">
            <input
              type="text"
              className="input-field max-w-md"
              placeholder="Search by name, flat number, or transaction ID..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPayPage(1); }}
            />
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Transaction</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Resident</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.transactionId}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{p.user?.name}</div>
                        <div className="text-xs text-gray-400">{p.user?.wing ? p.user.wing + "-" : ""}{p.user?.flatNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.paymentType}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{p.paymentMethod?.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(p.totalAmount, currency)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold
                          ${p.status === "CAPTURED" ? "bg-green-100 text-green-800" : p.status === "FAILED" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-IN") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {payments.length === 0 && (
              <div className="p-8 text-center text-gray-400">No payments found</div>
            )}
          </div>

          {payPagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button disabled={payPage <= 1} onClick={() => setPayPage(payPage - 1)} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40">← Prev</button>
              <span className="text-sm text-gray-500">Page {payPagination.page} of {payPagination.pages}</span>
              <button disabled={payPage >= payPagination.pages} onClick={() => setPayPage(payPage + 1)} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent = "brand" }) {
  const colors = {
    brand: "from-brand-600 to-brand-700",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    blue: "from-blue-500 to-blue-600",
  };

  return (
    <div className={`rounded-2xl p-4 text-white bg-gradient-to-br ${colors[accent]} shadow-lg`}>
      <div className="text-xs font-medium text-white/75 mb-1">{label}</div>
      <div className="text-xl font-extrabold leading-tight">{value}</div>
      {sub && <div className="text-xs text-white/65 mt-0.5">{sub}</div>}
    </div>
  );
}
