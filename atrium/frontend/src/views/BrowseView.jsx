import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, X, Accessibility } from "lucide-react";
import AssetCard from "../components/AssetCard";
import AssetCalendar from "../components/AssetCalendar";
import { api } from "../api/client";

const CAP_OPTIONS = [
  { label: "Any size", value: 0 },
  { label: "10+ people", value: 10 },
  { label: "20+ people", value: 20 },
  { label: "50+ people", value: 50 },
  { label: "100+ people", value: 100 },
];

const SORTS = [
  { label: "Name (A–Z)", value: "name" },
  { label: "Price (low to high)", value: "price_asc" },
  { label: "Price (high to low)", value: "price_desc" },
  { label: "Capacity (largest)", value: "cap_desc" },
];

const titleCase = (s = "") => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* Manual browse — the conventional fallback when AI search isn't the right
   fit. Filters the full active inventory; Book/Calendar flow into the same
   hold → pay → confirm path as AI results. */
export default function BrowseView({ onBook, onBack }) {
  const [assets, setAssets]               = useState(null);
  const [error, setError]                 = useState(null);
  const [calendarAsset, setCalendarAsset] = useState(null);

  const [q, setQ]                         = useState("");
  const [ward, setWard]                   = useState("");
  const [category, setCategory]           = useState("");
  const [minCap, setMinCap]               = useState(0);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [sort, setSort]                   = useState("name");

  useEffect(() => {
    api.listAssets()
      .then(setAssets)
      .catch(() => setError("We couldn't load spaces right now. Please try again."));
  }, []);

  const wards = useMemo(
    () => (assets ? [...new Set(assets.map((a) => a.ward).filter(Boolean))].sort() : []),
    [assets],
  );
  const categories = useMemo(
    () => (assets ? [...new Set(assets.map((a) => a.category).filter(Boolean))].sort() : []),
    [assets],
  );

  const filtered = useMemo(() => {
    if (!assets) return [];
    const needle = q.trim().toLowerCase();
    const list = assets.filter((a) => {
      if (ward && a.ward !== ward) return false;
      if (category && a.category !== category) return false;
      if (minCap && (a.capacity || 0) < minCap) return false;
      if (accessibleOnly && !a.accessibility?.wheelchair_access) return false;
      if (needle && !`${a.name} ${a.ward} ${a.category}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    return list.sort((a, b) => {
      switch (sort) {
        case "price_asc":  return (a.hourly_rate || 0) - (b.hourly_rate || 0);
        case "price_desc": return (b.hourly_rate || 0) - (a.hourly_rate || 0);
        case "cap_desc":   return (b.capacity || 0) - (a.capacity || 0);
        default:           return a.name.localeCompare(b.name);
      }
    });
  }, [assets, q, ward, category, minCap, accessibleOnly, sort]);

  const hasFilters = q || ward || category || minCap || accessibleOnly;
  const clearFilters = () => {
    setQ(""); setWard(""); setCategory(""); setMinCap(0); setAccessibleOnly(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 fade-in-up">
      {calendarAsset && (
        <AssetCalendar
          asset={calendarAsset}
          onClose={() => setCalendarAsset(null)}
          onSelectSlot={(asset, s, e) => { setCalendarAsset(null); onBook(asset, s, e); }}
        />
      )}

      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] mb-6 transition font-medium hover:underline"
        style={{ color: "var(--text-2)" }}
      >
        <ArrowLeft size={14} /> Back to search
      </button>

      <div className="mb-6">
        <h1 className="t-h1">Browse all spaces</h1>
        <p className="t-body-sm mt-1">Filter the full list of bookable community spaces across Hillingdon.</p>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl p-4 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-3)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, ward or type…"
              aria-label="Search spaces"
              className="input-base"
              style={{ paddingLeft: 38 }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <select value={ward} onChange={(e) => setWard(e.target.value)} aria-label="Filter by ward" className="input-base">
              <option value="">All wards</option>
              {wards.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by type" className="input-base">
              <option value="">All types</option>
              {categories.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </select>
            <select value={minCap} onChange={(e) => setMinCap(Number(e.target.value))} aria-label="Filter by capacity" className="input-base">
              {CAP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort spaces" className="input-base">
              {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={() => setAccessibleOnly((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold transition"
              style={accessibleOnly
                ? { background: "var(--brand-tint)", color: "var(--brand)" }
                : { background: "var(--surface-2)", color: "var(--text-2)" }}
              aria-pressed={accessibleOnly}
            >
              <Accessibility size={13} /> Wheelchair accessible only
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline" style={{ color: "var(--text-3)" }}>
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Result count */}
      {assets && !error && (
        <p className="t-body-sm mb-4">
          {filtered.length} {filtered.length === 1 ? "space" : "spaces"}{hasFilters ? " match your filters" : " available"}
        </p>
      )}

      {/* States */}
      {error ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="t-body" style={{ color: "var(--text-1)" }}>{error}</p>
        </div>
      ) : !assets ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl p-12 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
            <Search size={26} strokeWidth={1.8} />
          </div>
          <h3 className="t-h3 mb-1">No spaces match those filters</h3>
          <p className="t-body-sm mb-5">Try widening your search or clearing some filters.</p>
          {hasFilters && <button onClick={clearFilters} className="btn-secondary">Clear filters</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((a) => (
            <AssetCard
              key={a.id}
              match={{ asset: a, accessibility_match: a.accessibility?.wheelchair_access ? "full" : undefined }}
              onBook={onBook}
              onViewCalendar={setCalendarAsset}
            />
          ))}
        </div>
      )}
    </div>
  );
}
