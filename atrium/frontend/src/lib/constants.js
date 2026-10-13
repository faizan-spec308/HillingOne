// Shared reference data so wards/categories never drift between
// registration, settings, staff management and browse filters.

// Must match the wards that assets actually live in (Asset.ward), otherwise
// filtering/search by a listed ward returns nothing.
export const WARDS = [
  "Botwell", "Eastcote", "Harlington", "Hayes Town", "Hillingdon East",
  "Ickenham", "Manor", "Northwood", "Ruislip", "South Ruislip",
  "Uxbridge", "Yeading", "Yiewsley",
];

export const CATEGORIES = [
  "community_centre", "meeting_room", "sports_hall", "library_space",
  "office", "outdoor_space", "studio", "youth_centre", "other",
];
