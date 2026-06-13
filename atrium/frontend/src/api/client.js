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
  reschedule_too_late:         "Bookings cannot be changed within 24 hours of the start time.",
  reset_token_invalid:         "This reset link is invalid or has expired. Please request a new one.",
  payment_required:            "This booking needs to be paid for before it can be confirmed.",
  cannot_cancel_state:         "This booking has already been cancelled or completed.",
  cannot_cancel_past:          "This booking has already taken place and can no longer be cancelled.",
  cannot_cancel_in_progress:   "This booking is currently in progress and cannot be cancelled.",
  cannot_reschedule_to_past:   "You cannot move a booking into the past.",
  invalid_duration:            "Bookings must be between 30 minutes and 12 hours.",
  no_alternative_proposed:     "No alternative venue was proposed for this booking.",
  alternative_no_longer_available: "That alternative venue was just taken. Your original booking is unchanged — staff will find another option.",
  slot_unavailable_payment_refunded:
    "That time was just taken by someone else. Your payment has been refunded automatically.",
};

function getToken() {
  return localStorage.getItem("hillingone_token");
}

async function request(path, options = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    const error = new Error("We can't reach the server right now. Check your connection and try again.");
    error.status = 0;
    throw error;
  }
  if (!res.ok) {
    let detail = "";
    if (res.status === 429) {
      detail = "Too many attempts. Please wait a moment and try again.";
    } else {
      try {
        const b = await res.json();
        const raw = b.detail || JSON.stringify(b);
        if (typeof raw === "string" && raw.startsWith("exceeds_capacity_")) {
          detail = `This venue holds a maximum of ${raw.replace("exceeds_capacity_", "")} people.`;
        } else {
          detail = ERROR_MESSAGES[raw] || raw;
        }
      } catch {
        detail = res.statusText || "Something went wrong. Please try again.";
      }
    }
    const error = new Error(detail);
    error.status = res.status;
    throw error;
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

  rescheduleConfirm: (bookingId, paymentIntentId, startTime, endTime) =>
    request(`/api/bookings/${bookingId}/reschedule-confirm`, {
      method: "POST",
      body: JSON.stringify({ payment_intent_id: paymentIntentId, new_start: startTime, new_end: endTime }),
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
  decisionHistory: () => request("/api/staff/decision-history"),

  // Agent-first conflict resolution: runs the agent automatically, returns a verdict
  resolveConflict: (bookingId, prioritySummary) =>
    request("/api/staff/resolve-conflict", {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId, priority_request_summary: prioritySummary }),
    }),

  staffSearchBookings: (q = "") => request(`/api/staff/bookings?q=${encodeURIComponent(q)}`),

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
  listReminders: ()             => request("/api/reminders/all"),
  dueReminders:  ()             => request("/api/reminders/due"),
  dismissReminder: (id)         => request(`/api/reminders/${id}/dismiss`, { method: "POST" }),

  // Password reset
  forgotPassword: (email)       => request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword:  (token, new_password) => request("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, new_password }) }),

  // Payments
  createPaymentIntent: (bookingId) =>
    request(`/api/payments/create-intent?booking_id=${bookingId}`, { method: "POST" }),

  refundBooking: (bookingId) =>
    request(`/api/payments/refund/${bookingId}`, { method: "POST" }),
};
