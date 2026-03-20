import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../App";

export default function Layout() {
  const { user, config, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const societyName = config?.society?.shortName || "SocietyPay";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const navLinks = [
    { to: "/", label: "Pay Now", icon: "💳" },
    { to: "/history", label: "History", icon: "📋" },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: "⚙️" }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-500 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl backdrop-blur-sm">
              🏘️
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-tight">{societyName}</div>
              <div className="text-xs text-white/80">Payment Portal</div>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <span className="mr-1.5">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold leading-tight">{user?.name}</div>
              <div className="text-xs text-white/75">
                {user?.wing ? `${user.wing}-` : ""}{user?.flatNumber}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-semibold bg-white/15 rounded-lg
                         hover:bg-white/25 transition-all backdrop-blur-sm"
            >
              Logout
            </button>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-1.5 rounded-lg hover:bg-white/15"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/15 px-4 py-2 flex gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex-1 text-center px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive ? "bg-white/25" : "text-white/80 hover:bg-white/10"
                  }`
                }
              >
                <span className="mr-1">{link.icon}</span>{link.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400 font-body">
        {config?.society?.name} — Powered by SocietyPay (Open Source)
        {config?.society?.regNo && <span className="ml-2">| Reg: {config.society.regNo}</span>}
      </footer>
    </div>
  );
}
