import React, { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { api, getStoredUser, getToken, setAuth, clearAuth } from "./utils/api";
import Login from "./pages/Login";
import PaymentPortal from "./pages/PaymentPortal";
import PaymentHistory from "./pages/PaymentHistory";
import AdminDashboard from "./pages/AdminDashboard";
import Layout from "./components/Layout";

// ── Auth Context ────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch public config (society info, surcharges, payment types)
    api.get("/config/public")
      .then(setConfig)
      .catch((err) => console.error("Config fetch failed:", err))
      .finally(() => setLoading(false));
  }, []);

  function login(userData, token) {
    setAuth(userData, token);
    setUser(userData);
  }

  function logout() {
    clearAuth();
    setUser(null);
  }

  const isAdmin = user?.role === "ADMIN" || user?.role === "TREASURER";

  return (
    <AuthContext.Provider value={{ user, config, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Protected Route ─────────────────────────────────────────────────────────
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<PaymentPortal />} />
            <Route path="/history" element={<PaymentHistory />} />
            <Route
              path="/admin"
              element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
