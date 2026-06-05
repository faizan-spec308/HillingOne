const BASE = import.meta.env.VITE_API_BASE || "";

function getToken() {
  return localStorage.getItem("atrium_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
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

export const api = {
  // Auth
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  register: (name, email, password, ward) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password, ward }) }),

  me: () => request("/api/auth/me"),

  // Search
  search: (query, userId = null) =>
    request("/api/search", { method: "POST", body: JSON.stringify({ query, user_id: userId }) }),

  // Bookings
  hold: (data) =>
    request("/api/bookings/hold", { method: "POST", body: JSON.stringify(data) }),

  confirm: (bookingId, userId, enableReminders = true) =>
    request(`/api/bookings/${bookingId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, enable_reminders: enableReminders }),
    }),

  cancelBooking: (bookingId, userId) =>
    request(`/api/bookings/${bookingId}?user_id=${userId}`, { method: "DELETE" }),

  rescheduleBooking: (bookingId, userId, startTime, endTime) =>
    request(`/api/bookings/${bookingId}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: userId, start_time: startTime, end_time: endTime }),
    }),

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

  listUserBookings: (userId) => request(`/api/bookings?user_id=${userId}`),

  icsUrl: (bookingId) => `${BASE}/api/bookings/${bookingId}/ics`,

  // Agent
  triggerAgent:    (data) => request("/api/agent/conflict-resolution", { method: "POST", body: JSON.stringify(data) }),
  recentAgentRuns: ()     => request("/api/agent/runs/recent"),

  // Staff
  staffDashboard: () => request("/api/staff/dashboard"),
  staffOverride:  (data) => request("/api/staff/override", { method: "POST", body: JSON.stringify(data) }),
  decisionQueue:  () => request("/api/staff/decision-queue"),

  // Assets
  listAssets: () => request("/api/assets"),

  // Reminders
  listReminders: (userId) =>
    request(userId ? `/api/reminders/all?user_id=${userId}` : "/api/reminders/all"),

  // Payments
  createPaymentIntent: (bookingId) =>
    request(`/api/payments/create-intent?booking_id=${bookingId}`, { method: "POST" }),

  refundBooking: (bookingId) =>
    request(`/api/payments/refund/${bookingId}`, { method: "POST" }),
};
