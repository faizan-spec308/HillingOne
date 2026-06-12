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

        {/* Category icon — tinted by match quality */}
        <div
          className="w-14 h-14 flex-shrink-0 rounded-2xl flex items-center justify-center"
          style={{ background: `var(--${sc.key}-bg)`, color: `var(--${sc.key})` }}
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

          {/* Match score — single, clear representation */}
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

          {/* AI reasoning */}
          {match.reasoning && (
            <p className="t-body-sm mt-3 pl-3" style={{ borderLeft: "2px solid var(--border)" }}>
              {match.reasoning}
            </p>
          )}

          {/* Amenities — uniform, monochrome chips (icons carry the meaning) */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {match.accessibility_match === "full" && (
              <span className="chip"><Accessibility size={11} />Fully accessible</span>
            )}
            {match.accessibility_match === "partial" && (
              <span className="chip"><Accessibility size={11} />Partial access</span>
            )}
            {amenities.kitchen && <span className="chip"><Utensils size={11} />{t("card_kitchen")}</span>}
            {amenities.wifi && <span className="chip"><Wifi size={11} />{t("card_wifi")}</span>}
            {(amenities.parking || asset.parking) && <span className="chip"><Car size={11} />{t("card_parking")}</span>}
            {match.carbon_estimate_kg !== undefined && (
              <span className="chip"><Leaf size={11} />{match.carbon_estimate_kg} kg CO₂</span>
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
              <span className="ml-auto font-semibold" style={{ color: "var(--brand)" }}>Edit time</span>
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
