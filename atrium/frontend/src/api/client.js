const BASE = import.meta.env.VITE_API_BASE || "";

const ERROR_MESSAGES = {
  slot_unavailable:            "This slot was just taken. Please choose another time.",
  hold_expired:                "Your hold timed out. Please search again.",
  invalid_credentials:         "Incorrect email or password.",
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

  me: () => request("/api/auth/me"),

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

  listUserBookings: () => request("/api/bookings"),

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
  listReminders: () => request("/api/reminders/all"),

  // Payments
  createPaymentIntent: (bookingId) =>
    request(`/api/payments/create-intent?booking_id=${bookingId}`, { method: "POST" }),

  refundBooking: (bookingId) =>
    request(`/api/payments/refund/${bookingId}`, { method: "POST" }),
};
