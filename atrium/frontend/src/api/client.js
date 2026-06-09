const BASE = import.meta.env.VITE_API_BASE || "";

const ERROR_MESSAGES = {
  slot_unavailable:            "This slot was just taken. Please choose another time.",
  hold_expired:                "Your hold timed out. Please search again.",
  invalid_credentials:         "Incorrect email or password.",
  account_locked:              "Too many failed attempts. Your account is locked for 15 minutes.",
  email_exists:                "An account with this email already exists.",
  booking_not_found:           "Booking not found.",
  not_booking_owner:           "You are not authorised to modify this booking.",
  cannot_book_past_slot:       "You cannot book a slot in the past.",
  minimum_booking_30_minutes:  "Bookings must be at least 30 minutes long.",
  maximum_booking_12_hours:    "Bookings cannot exceed 12 hours.",
  not_authenticated:           "Please sign in to continue.",
  not_swap_pending:            "This booking is no longer awaiting a swap decision.",
  cannot_reschedule:           "This booking cannot be rescheduled in its current state.",
};

function getToken() {
  return localStorage.getItem("hillingone_token");
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
    if (res.status === 429) throw new Error("429: Too many attempts. Please wait a moment and try again.");
    let detail = "";
    try {
      const b = await res.json();
      const raw = b.detail || JSON.stringify(b);
      detail = ERROR_MESSAGES[raw] || raw;
    } catch {
      detail = res.statusText;
    }
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

  logout: () => request("/api/auth/logout", { method: "POST" }),

  me: () => request("/api/auth/me"),

  updateProfile: (name, email, ward) =>
    request("/api/auth/me", { method: "PATCH", body: JSON.stringify({ name, email, ward }) }),

  changePassword: (current_password, new_password) =>
    request("/api/auth/password", { method: "PATCH", body: JSON.stringify({ current_password, new_password }) }),

  // Search
  search: (query, userId = null) =>
    request("/api/search", { method: "POST", body: JSON.stringify({ query, user_id: userId }) }),

  // Bookings
  hold: (data) =>
    request("/api/bookings/hold", { method: "POST", body: JSON.stringify(data) }),

  confirm: (bookingId, enableReminders = true) =>
    request(`/api/bookings/${bookingId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ enable_reminders: enableReminders }),
    }),

  cancelBooking: (bookingId) =>
    request(`/api/bookings/${bookingId}`, { method: "DELETE" }),

  rescheduleBooking: (bookingId, startTime, endTime) =>
    request(`/api/bookings/${bookingId}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify({ start_time: startTime, end_time: endTime }),
    }),

  acceptSwap: (bookingId) =>
    request(`/api/bookings/${bookingId}/swap-accept`, {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId, accept: true }),
    }),

  declineSwap: (bookingId) =>
    request(`/api/bookings/${bookingId}/swap-decline`, {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId, accept: false }),
    }),

  getBooking: (bookingId) => request(`/api/bookings/${bookingId}`),

  listUserBookings: (page = 1) => request(`/api/bookings?page=${page}&page_size=20`),

  downloadBookingsCsv: async (params = {}) => {
    const token = localStorage.getItem("hillingone_token");
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE}/api/staff/export${qs ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hillingone-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadIcs: async (bookingId, reference) => {
    const token = localStorage.getItem("hillingone_token");
    const res = await fetch(`${BASE}/api/bookings/${bookingId}/ics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to download calendar file");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hillingone-${reference || bookingId}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Agent
  triggerAgent:    (data) => request("/api/agent/conflict-resolution", { method: "POST", body: JSON.stringify(data) }),
  recentAgentRuns: ()     => request("/api/agent/runs/recent"),

  // Staff
  staffDashboard: () => request("/api/staff/dashboard"),
  staffOverride:  (data) => request("/api/staff/override", { method: "POST", body: JSON.stringify(data) }),
  decisionQueue:  () => request("/api/staff/decision-queue"),

  // Assets (public)
  listAssets: () => request("/api/assets"),
  getAssetAvailability: (assetId, fromDate, toDate) =>
    request(`/api/assets/${assetId}/bookings?from_date=${fromDate}&to_date=${toDate}`),

  // Asset management (staff)
  staffListAssets:   ()           => request("/api/staff/assets"),
  staffCreateAsset:  (data)       => request("/api/staff/assets", { method: "POST", body: JSON.stringify(data) }),
  staffUpdateAsset:  (id, data)   => request(`/api/staff/assets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  staffToggleAsset:  (id)         => request(`/api/staff/assets/${id}/toggle`, { method: "PATCH" }),

  // Reminders
  listReminders: () => request("/api/reminders/all"),

  // Payments
  createPaymentIntent: (bookingId) =>
    request(`/api/payments/create-intent?booking_id=${bookingId}`, { method: "POST" }),

  refundBooking: (bookingId) =>
    request(`/api/payments/refund/${bookingId}`, { method: "POST" }),
};
