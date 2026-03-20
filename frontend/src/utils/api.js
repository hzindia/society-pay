const API_BASE = "/api";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem("sp_token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 — auto logout
  if (res.status === 401) {
    localStorage.removeItem("sp_token");
    localStorage.removeItem("sp_user");
    window.location.href = "/login";
    throw new ApiError("Session expired", 401);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(data?.error || "Request failed", res.status);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export { ApiError };

// ── Auth helpers ─────────────────────────────────────────────────────────────
export function getStoredUser() {
  try {
    const raw = localStorage.getItem("sp_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem("sp_token");
}

export function setAuth(user, token) {
  localStorage.setItem("sp_user", JSON.stringify(user));
  localStorage.setItem("sp_token", token);
}

export function clearAuth() {
  localStorage.removeItem("sp_user");
  localStorage.removeItem("sp_token");
}
