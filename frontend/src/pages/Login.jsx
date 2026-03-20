import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAuth } from "../utils/api";
import { useAuth } from "../App";

export default function Login() {
  const { user, login, config } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: "", password: "", name: "", flatNumber: "", wing: "", phone: "",
  });

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister
        ? form
        : { email: form.email, password: form.password };

      const data = await api.post(endpoint, body);
      login(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const societyName = config?.society?.name || "SocietyPay";

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 text-3xl">
            🏘️
          </div>
          <h1 className="font-display text-2xl font-bold text-white">{societyName}</h1>
          <p className="text-white/80 text-sm mt-1">Resident Payment Portal</p>
        </div>

        {/* Form Card */}
        <div className="card p-8">
          <h2 className="text-xl font-bold text-gray-900 font-display mb-1">
            {isRegister ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isRegister ? "Register as a society member" : "Login to your account"}
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                  <input
                    type="text" required className="input-field"
                    placeholder="Your full name"
                    value={form.name} onChange={(e) => update("name", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Flat No.</label>
                    <input
                      type="text" required className="input-field"
                      placeholder="e.g. 204"
                      value={form.flatNumber} onChange={(e) => update("flatNumber", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Wing</label>
                    <input
                      type="text" className="input-field"
                      placeholder="e.g. A (optional)"
                      value={form.wing} onChange={(e) => update("wing", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
                  <input
                    type="tel" className="input-field"
                    placeholder="+91-XXXXXXXXXX (optional)"
                    value={form.phone} onChange={(e) => update("phone", e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email" required className="input-field"
                placeholder="you@example.com"
                value={form.email} onChange={(e) => update("email", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password" required minLength={8} className="input-field"
                placeholder={isRegister ? "Min 8 characters" : "Your password"}
                value={form.password} onChange={(e) => update("password", e.target.value)}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                  {isRegister ? "Creating Account..." : "Logging in..."}
                </span>
              ) : (
                isRegister ? "Create Account" : "Login"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-sm text-brand-700 font-semibold hover:underline"
            >
              {isRegister ? "Already have an account? Login" : "New member? Create account"}
            </button>
          </div>
        </div>

        <p className="text-center text-white/60 text-xs mt-6">
          🔒 Secured with Razorpay Payment Gateway
        </p>
      </div>
    </div>
  );
}
