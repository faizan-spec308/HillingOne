import {
  MOCK_USERS,
  MOCK_SEARCH,
  MOCK_HOLD,
  MOCK_CONFIRM,
  MOCK_STAFF_DASHBOARD,
} from "./mockData";

const BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = "";
    try { const b = await res.json(); detail = b.detail || JSON.stringify(b); }
    catch { detail = res.statusText; }
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.headers.get("content-type")?.includes("application/json")) return res.json();
  return res;
}

/** Try the real API; if unreachable fall back to mock data silently. */
async function withFallback(path, options, mockFn) {
  try {
    return await request(path, options);
  } catch {
    return typeof mockFn === "function" ? mockFn() : mockFn;
  }
}

export const api = {
  // Users
  demoUsers: () =>
    withFallback("/api/demo/users", {}, () => MOCK_USERS),

  // Search
  search: (query, userId = null) =>
    withFallback(
      "/api/search",
      { method: "POST", body: JSON.stringify({ query, user_id: userId }) },
      () => {
        // Simulate a short delay so the loading skeleton is visible
        return new Promise((r) => setTimeout(() => r(MOCK_SEARCH(query)), 1200));
      }
    ),

  // Bookings
  hold: (data) =>
    withFallback(
      "/api/bookings/hold",
      { method: "POST", body: JSON.stringify(data) },
      () => MOCK_HOLD(data)
    ),

  confirm: (bookingId, userId, enableReminders = true) =>
    withFallback(
      `/api/bookings/${bookingId}/confirm`,
      { method: "POST", body: JSON.stringify({ user_id: userId, enable_reminders: enableReminders }) },
      () => MOCK_CONFIRM()
    ),

  cancelBooking: (bookingId, userId) =>
    request(`/api/bookings/${bookingId}?user_id=${userId}`, { method: "DELETE" }),

  acceptSwap: (bookingId, userId) =>
    request(`/api/bookings/${bookingId}/swap-accept`, {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId, user_id: userId, accept: true }),
    }),

  declineSwap: (bookingId, userId) =>
    request(`/api/bookings/${bookingId}/swap-decline`, {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId, user_id: userId, accept: false }),
    }),

  getBooking: (bookingId) => request(`/api/bookings/${bookingId}`),

  icsUrl: (bookingId) => `${BASE}/api/bookings/${bookingId}/ics`,

  // Agent
  triggerAgent:   (data) => request("/api/agent/conflict-resolution", { method: "POST", body: JSON.stringify(data) }),
  recentAgentRuns: ()    => request("/api/agent/runs/recent"),

  // Staff
  staffDashboard: () =>
    withFallback("/api/staff/dashboard", {}, () => MOCK_STAFF_DASHBOARD()),

  staffOverride: (data) =>
    request("/api/staff/override", { method: "POST", body: JSON.stringify(data) }),

  decisionQueue: () => request("/api/staff/decision-queue"),

  // Assets
  listAssets: () => request("/api/assets"),

  // Reminders
  listReminders: (userId) =>
    request(userId ? `/api/reminders/all?user_id=${userId}` : "/api/reminders/all"),

  // Demo scenarios
  runScenarioAgentSwap: () =>
    request("/api/demo/scenario/agent-swap-request", { method: "POST" }),

  runScenarioOverride: () =>
    request("/api/demo/scenario/legitimate-override", { method: "POST" }),

  resetDemo: () => request("/api/demo/reset", { method: "POST" }),
};
