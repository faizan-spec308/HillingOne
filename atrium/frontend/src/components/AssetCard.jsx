import {
  MapPin, Users, Accessibility, Utensils, Wifi, Car, Leaf, ChevronRight, Clock, CalendarDays,
  Building2, Dumbbell, Trees, BookOpen, Briefcase, Palette, Mic, FileText, Home,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

/* Category → lucide icon (replaces emoji for a consistent, premium look) */
const CATEGORY_ICON = [
  [/(hall|communit)/, Building2],
  [/(sport|gym|pitch)/, Dumbbell],
  [/(park|garden)/, Trees],
  [/library/, BookOpen],
  [/(meeting|office)/, Briefcase],
  [/(youth|children)/, Palette],
  [/equip/, Mic],
  [/registry/, FileText],
  [/housing/, Home],
];
function categoryIcon(cat = "") {
  const c = cat.toLowerCase();
  const hit = CATEGORY_ICON.find(([re]) => re.test(c));
  return hit ? hit[1] : Building2;
}

/* Match quality → one semantic key. Score is shown ONCE (bar + label),
   not triple-encoded as it was before (stars + bar + label). */
function scoreConfig(s) {
  if (s >= 85) return { label: "Excellent match", key: "success" };
  if (s >= 65) return { label: "Good match",      key: "warning" };
  return { label: "Possible match", key: "info" };
}

/* Colour-coded amenity chip — tones map to semantic tokens, so each
   feature is highlighted with its own colour and still adapts to dark. */
const CHIP_TONE = {
  success: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
  info:    { bg: "var(--info-bg)",    fg: "var(--info-fg)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  brand:   { bg: "var(--brand-tint)", fg: "var(--brand)" },
};
function AmenityChip({ icon: Icon, label, tone = "brand" }) {
  const c = CHIP_TONE[tone] || CHIP_TONE.brand;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full"
      style={{ background: c.bg, color: c.fg }}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}

export default function AssetCard({ match, onBook, onViewCalendar, searchWindow }) {
  const { t } = useLanguage();
  const asset = match.asset || {};
  const score = match.match_score ?? 0;
  const sc    = scoreConfig(score);
  const Icon  = categoryIcon(asset.category);
  const price = asset.hourly_rate > 0 ? `£${Number(asset.hourly_rate).toFixed(2)}` : t("card_free");
  const amenities = asset.amenities || {};

  return (
    <div className="civic-card fade-in-up p-5">
      <div className="flex gap-4">

        {/* Category icon — brand-tinted (category identity; match quality
            lives in the badge + bar below, not here) */}
        <div
          className="w-14 h-14 flex-shrink-0 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
        >
          <Icon size={24} strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">

          {/* Title + price */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="t-overline mb-0.5">{(asset.category || "").replace(/_/g, " ")}</p>
              <h3 className="t-h3 truncate">{asset.name}</h3>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="font-display font-extrabold text-[18px] leading-none" style={{ color: "var(--brand)" }}>
                {price}
              </div>
              <div className="t-caption mt-0.5">{t("card_per_hour")}</div>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {asset.ward && (
              <span className="t-body-sm inline-flex items-center gap-1.5">
                <MapPin size={12} style={{ color: "var(--text-3)" }} />{asset.ward}
              </span>
            )}
            {asset.capacity && (
              <span className="t-body-sm inline-flex items-center gap-1.5">
                <Users size={12} style={{ color: "var(--text-3)" }} />Up to {asset.capacity}
              </span>
            )}
          </div>

          {/* Match score — single, clear representation. Only shown for AI
              search results; manual browse passes no score. */}
          {match.match_score != null && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`badge badge-${sc.key}`}>{sc.label}</span>
                <span className="t-caption t-num" style={{ color: `var(--${sc.key})`, fontWeight: 700 }}>{score}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${score}%`, background: `var(--${sc.key})`, transition: "width 0.7s var(--ease)" }}
                />
              </div>
            </div>
          )}

          {/* AI reasoning (search) — or the venue description (browse) */}
          {match.reasoning ? (
            <p className="t-body-sm mt-3 pl-3 italic" style={{ borderLeft: "2px solid var(--border)" }}>
              {match.reasoning}
            </p>
          ) : asset.description ? (
            <p
              className="t-body-sm mt-3"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {asset.description}
            </p>
          ) : null}

          {/* Amenities — colour-coded by type */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {match.accessibility_match === "full" && (
              <AmenityChip icon={Accessibility} label="Fully accessible" tone="success" />
            )}
            {match.accessibility_match === "partial" && (
              <AmenityChip icon={Accessibility} label="Partial access" tone="warning" />
            )}
            {amenities.kitchen && <AmenityChip icon={Utensils} label={t("card_kitchen")} tone="warning" />}
            {amenities.wifi && <AmenityChip icon={Wifi} label={t("card_wifi")} tone="info" />}
            {(amenities.parking || asset.parking) && <AmenityChip icon={Car} label={t("card_parking")} tone="brand" />}
            {match.carbon_estimate_kg !== undefined && (
              <AmenityChip icon={Leaf} label={`${match.carbon_estimate_kg} kg CO₂`} tone="success" />
            )}
          </div>

          {/* Proposed time window */}
          {searchWindow?.start && (
            <div
              className="flex items-center gap-2 t-caption rounded-xl px-3 py-2 mt-3"
              style={{ background: "var(--surface-2)" }}
            >
              <Clock size={11} style={{ color: "var(--text-3)" }} className="flex-shrink-0" />
              <span>
                {new Date(searchWindow.start).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                {" · "}
                {new Date(searchWindow.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                {" – "}
                {new Date(searchWindow.end).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button
                type="button"
                onClick={() => onBook(asset)}
                className="ml-auto font-semibold hover:underline"
                style={{ color: "var(--brand)" }}
              >
                Edit time
              </button>
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-2 mt-4">
            {onViewCalendar && (
              <button
                onClick={() => onViewCalendar(asset)}
                aria-label={`View ${asset.name} availability`}
                className="btn-secondary btn-sm flex-shrink-0"
                title="View availability calendar"
              >
                <CalendarDays size={14} />
              </button>
            )}
            <button
              onClick={() => onBook(asset)}
              aria-label={`Book ${asset.name}`}
              className="btn-primary flex-1"
            >
              {t("card_book")}
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
