// Booking times are UK local wall-clock. The backend stores them naive (no
// timezone) and returns them naive, so the browser must send them the same way.
// Date.prototype.toISOString() converts to UTC — using it shifts every time by
// the local offset (e.g. -1h during British Summer Time), which made bookings
// display an hour off and reschedules look like they hadn't applied. These
// helpers format a Date using its LOCAL components, with no conversion.

const p = (n) => String(n).padStart(2, "0");

// "2026-10-10T14:30:00" — a naive local wall-clock timestamp to send to the API.
export function toLocalNaiveIso(d) {
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// "2026-10-10" — a local calendar date (safe near midnight, unlike toISOString).
export function toLocalDateIso(d) {
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
