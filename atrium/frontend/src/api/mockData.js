/** Demo data used when the backend is not running */

export const MOCK_USERS = [
  { id: 1, name: "Sarah Johnson", email: "sarah@hillingdon.gov.uk", role: "resident", department: null },
  { id: 2, name: "James Okafor",  email: "james@hillingdon.gov.uk", role: "staff",    department: "Parks & Leisure" },
];

export const MOCK_SEARCH = (query) => ({
  intent: {
    extracted_summary: `You're looking for: ${query}. Atrium has matched the 3 most suitable council spaces across the borough.`,
    follow_up_question: null,
    purpose_summary: query,
    capacity: 80,
  },
  search_window: {
    start: new Date(Date.now() + 7 * 86400000).toISOString(),
    end:   new Date(Date.now() + 7 * 86400000 + 3 * 3600000).toISOString(),
  },
  matches: [
    {
      asset_id: 3,
      match_score: 94,
      reasoning: "Community hall in Hayes with ample capacity, on-site kitchen for catering, and full wheelchair accessibility. Ideal for large gatherings.",
      accessibility_match: "full",
      carbon_estimate_kg: 1.2,
      asset: {
        id: 3,
        name: "Hayes Community Hall",
        category: "Community Halls",
        ward: "Hayes Town",
        capacity: 150,
        hourly_rate: 40,
        parking: true,
        amenities: { kitchen: true, wifi: true, parking: true },
        accessibility: { wheelchair: true, hearing_loop: true },
      },
    },
    {
      asset_id: 5,
      match_score: 78,
      reasoning: "Also in Hayes with garden area and parking. Slightly smaller but very well equipped for community events and parties.",
      accessibility_match: "full",
      carbon_estimate_kg: 0.9,
      asset: {
        id: 5,
        name: "Barnhill Community Centre",
        category: "Community Halls",
        ward: "Barnhill",
        capacity: 100,
        hourly_rate: 32,
        parking: true,
        amenities: { kitchen: true, wifi: false, parking: true },
        accessibility: { wheelchair: true },
      },
    },
    {
      asset_id: 1,
      match_score: 58,
      reasoning: "Larger venue with a stage and full PA system but located in Ruislip rather than Hayes. Worth considering if date flexibility exists.",
      accessibility_match: "partial",
      carbon_estimate_kg: 2.1,
      asset: {
        id: 1,
        name: "Winston Churchill Hall",
        category: "Community Halls",
        ward: "Ruislip Manor",
        capacity: 200,
        hourly_rate: 65,
        parking: true,
        amenities: { kitchen: true, wifi: true, parking: true },
        accessibility: { wheelchair: true },
      },
    },
  ],
});

export const MOCK_HOLD = (data) => ({
  id: 999,
  reference: "HBC-2026-DEMO",
  asset_id: data.asset_id,
  user_id: data.user_id,
  start_time: data.start_time,
  end_time: data.end_time,
  status: "held",
  held_until: new Date(Date.now() + 60000).toISOString(),
  purpose: data.purpose,
  attendee_count: data.attendee_count,
});

export const MOCK_CONFIRM = () => ({
  id: 999,
  reference: "HBC-2026-DEMO",
  status: "confirmed",
  start_time: new Date(Date.now() + 7 * 86400000).toISOString(),
  end_time:   new Date(Date.now() + 7 * 86400000 + 3 * 3600000).toISOString(),
  purpose: "Community event — demo booking",
  attendee_count: 80,
  encouragement: "Great choice! Hayes Community Hall is one of our most popular venues. We hope your event goes brilliantly.",
  reminders_scheduled: 2,
});

export const MOCK_STAFF_DASHBOARD = () => ({
  principles: [
    "The agent suggests; the human decides.",
    "Every action is logged and auditable.",
    "Residents are always notified of changes with full transparency.",
    "Equity of access — no digital exclusion.",
  ],
  metrics: {
    weekly_bookings:              47,
    estimated_staff_hours_saved:  18.5,
    phone_calls_avoided:          63,
    interfaces_replaced:          17,
  },
  asset_utilisation: [
    { id: 1,  name: "Hayes Community Hall",          ward: "Hayes Town",       capacity: 150, weekly_bookings: 14, utilisation_pct: 93, colour: "amber" },
    { id: 2,  name: "Botwell Green Sports Centre",   ward: "Botwell",          capacity: 80,  weekly_bookings: 11, utilisation_pct: 82, colour: "green" },
    { id: 3,  name: "Uxbridge Civic Centre Room 4",  ward: "Uxbridge",         capacity: 30,  weekly_bookings:  8, utilisation_pct: 71, colour: "green" },
    { id: 4,  name: "Winston Churchill Hall",         ward: "Ruislip Manor",    capacity: 200, weekly_bookings:  3, utilisation_pct: 21, colour: "blue"  },
    { id: 5,  name: "Northwood Hills Library Room",  ward: "Northwood Hills",  capacity: 20,  weekly_bookings:  6, utilisation_pct: 60, colour: "green" },
    { id: 6,  name: "Barnhill Community Centre",     ward: "Barnhill",         capacity: 100, weekly_bookings:  9, utilisation_pct: 77, colour: "green" },
    { id: 7,  name: "Harefield Village Hall",         ward: "Harefield",        capacity: 120, weekly_bookings:  2, utilisation_pct: 14, colour: "blue"  },
  ],
  agent_feed: [
    { id: 1, action: "booking_confirmed",  reason: "Resident confirmed within hold window", ai_reasoning: "High-confidence match (94%). No conflicts detected.", created_at: new Date(Date.now() - 120000).toISOString() },
    { id: 2, action: "conflict_detected",  reason: "Double booking attempt on Room 4",      ai_reasoning: "Overlapping slot identified at 14:00. Resident offered alternative.", created_at: new Date(Date.now() - 380000).toISOString() },
    { id: 3, action: "swap_proposed",      reason: "Councillor requested Barnhill Hall",    ai_reasoning: "Lower-priority booking identified. Swap request sent with goodwill credit.", created_at: new Date(Date.now() - 900000).toISOString() },
    { id: 4, action: "booking_confirmed",  reason: "New booking — sports hall",             ai_reasoning: null, created_at: new Date(Date.now() - 1800000).toISOString() },
  ],
  demand_alerts: [
    { raw_query: "Swimming pool in Uxbridge on a Sunday",          results_count: 0 },
    { raw_query: "Large outdoor space for 300 people in Hayes",    results_count: 1 },
    { raw_query: "Recording studio or music rehearsal room",       results_count: 0 },
  ],
});
