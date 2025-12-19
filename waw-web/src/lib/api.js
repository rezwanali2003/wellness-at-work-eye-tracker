// src/lib/api.js

/**
 * Utility to build auth headers.
 */
function authHeaders(token) {
  if (!token) throw new Error("No auth token");
  return { Authorization: `Bearer ${token}` };
}

/**
 * Perform a JSON POST request and return { ok, data?, error? }.
 * Never throws for 4xx so the UI can decide what to show.
 */
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    console.error("POST error:", url, res.status, text);

    // 1) Special-case 401 for auth: show friendly credentials message
    if (res.status === 401) {
      const msg =
        (parsed && parsed.detail) ||
        "Incorrect email or password. Please try again.";
      return { ok: false, error: msg };
    }

    // 2) Other statuses: use FastAPI "detail" if present
    const msg =
      (parsed && parsed.detail) || `Request failed: ${res.status}`;
    return { ok: false, error: msg };
  }

  return { ok: true, data: parsed };
}

// ---- Auth via backend proxy ----

/**
 * Login user and return either { token } or { error }.
 * Uses Next.js API route /api/backend?path=auth/login to avoid mixed content.
 */
export async function login(email, password) {
  const result = await postJson(`/api/backend?path=auth/login`, {
    email,
    password,
  });
  if (!result.ok) {
    return { error: result.error || "Login failed" };
  }
  console.log("Login API success:", result.data);
  return { token: result.data.access_token };
}

/**
 * Register a new user; returns either { user } or { error }.
 * Uses /api/backend?path=auth/register to avoid mixed content.
 * timezone is an IANA string, e.g. "Asia/Kolkata".
 */
export async function register(email, password, name, consent, timezone) {
  const result = await postJson(`/api/backend?path=auth/register`, {
    email,
    password,
    name,
    consent_given: consent,
    timezone,
  });

  if (!result.ok) {
    return {
      error:
        result.error ||
        "Registration failed. Please check your details and try again.",
    };
  }

  return { user: result.data };
}

// ---- Dashboard stats ----

export async function fetchDashboardStats(token) {
  const res = await fetch(`/api/backend?path=api/user/me/stats`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Stats API error:", res.status, text);
    throw new Error("Failed to fetch stats");
  }

  return res.json();
}

// ---- Blink history ----

export async function fetchBlinkData(token, params = {}) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const url = new URL("/api/backend", origin || "http://localhost");

  url.searchParams.set("path", "api/user/me/blinks");

  if (params.range) {
    url.searchParams.set("range_period", params.range);
    delete params.range;
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });

  console.log("Fetching blinks:", url.toString());

  const res = await fetch(url.toString(), {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Blink API error:", res.status, text);
    throw new Error("Failed to fetch blink data");
  }

  return res.json();
}

// ---- Trends ----

export async function fetchTrends(token, period = "week") {
  const backendPeriod = period === "all" ? "month" : period;

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const url = new URL("/api/backend", origin || "http://localhost");
  url.searchParams.set("path", "api/user/me/trends");
  url.searchParams.set("period", backendPeriod);

  const res = await fetch(url.toString(), {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Trends API error:", res.status, text);
    throw new Error("Failed to fetch trends");
  }

  return res.json();
}

// ---- CSV export ----

export async function exportBlinks(token, days = 30) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const url = new URL("/api/backend", origin || "http://localhost");
  url.searchParams.set("path", "api/user/me/blinks/export");
  url.searchParams.set("format_type", "csv");
  url.searchParams.set("days", days);

  const res = await fetch(url.toString(), {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Export API error:", res.status, text);
    throw new Error("Export failed");
  }

  return res.blob();
}
