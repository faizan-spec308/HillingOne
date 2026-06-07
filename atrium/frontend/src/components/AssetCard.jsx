import { MapPin, Users, Accessibility, Utensils, Wifi, Car, Leaf, ChevronRight, Star } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

const CATEGORY_EMOJI = {
  hall: "🏛️", community: "🏛️", sport: "⚽", gym: "🏋️", pitch: "⚽",
  meeting: "📋", office: "📋", park: "🌳", garden: "🌳", library: "📚",
  youth: "🎨", children: "🎨", equip: "🎤", registry: "📄", housing: "🏠",
};
function categoryEmoji(cat = "") {
  const key = Object.keys(CATEGORY_EMOJI).find((k) => cat.toLowerCase().includes(k));
  return CATEGORY_EMOJI[key] || "🏢";
}

const SCORE_CONFIG = (s) => {
  if (s >= 85) return { label: "Excellent match", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", bar: "#10b981", stars: 5 };
  if (s >= 65) return { label: "Good match",      color: "#d97706", bg: "#fffbeb", border: "#fcd34d", bar: "#f59e0b", stars: 4 };
  return               { label: "Possible match",  color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", bar: "#3b82f6", stars: 3 };
};

const AMENITY_CHIP = ({ icon: Icon, label, color }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border ${color}`}>
    <Icon size={10} />
    {label}
  </span>
);

export default function AssetCard({ match, onBook }) {
  const { t } = useLanguage();
  const asset  = match.asset || {};
  const score  = match.match_score ?? 0;
  const cfg    = SCORE_CONFIG(score);
  const price  = asset.hourly_rate > 0
    ? `£${Number(asset.hourly_rate).toFixed(2)}`
    : t("card_free");
  const amenities = asset.amenities || {};

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-civic-hover hover:-translate-y-0.5 fade-in-up">

      {/* Top accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${cfg.bar}, ${cfg.bar}99)` }} />

      <div className="p-5">
        <div className="flex gap-4">

          {/* Icon */}
          <div
            className="w-16 h-16 flex-shrink-0 rounded-2xl flex items-center justify-center text-[28px] shadow-sm"
            style={{ background: `linear-gradient(135deg, ${cfg.bg}, ${cfg.bg}aa)`, border: `1px solid ${cfg.border}` }}
          >
            {categoryEmoji(asset.category)}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                  {(asset.category || "").replace(/_/g, " ")}
                </p>
                <h3 className="font-display text-[17px] font-bold text-gray-900 leading-tight truncate">
                  {asset.name}
                </h3>
              </div>

              {/* Price badge */}
              <div className="flex-shrink-0 text-right">
                <div className="text-[18px] font-display font-black text-hillingdon-navy leading-none">
                  {price}
                </div>
                <div className="text-[10px] text-gray-400 font-medium mt-0.5">{t("card_per_hour")}</div>
              </div>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
              {asset.ward && (
                <span className="flex items-center gap-1 text-[13px] text-gray-500">
                  <MapPin size={11} className="text-gray-400" />
                  {asset.ward}
                </span>
              )}
              {asset.capacity && (
                <span className="flex items-center gap-1 text-[13px] text-gray-500">
                  <Users size={11} className="text-gray-400" />
                  Up to {asset.capacity}
                </span>
              )}
              {/* Score stars */}
              <span className="flex items-center gap-0.5 ml-auto">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={11}
                    fill={i < cfg.stars ? cfg.color : "none"}
                    stroke={i < cfg.stars ? cfg.color : "#d1d5db"}
                  />
                ))}
                <span className="text-[11px] font-semibold ml-1" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
              </span>
            </div>

            {/* Score bar */}
            <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${score}%`, background: `linear-gradient(90deg, ${cfg.bar}, ${cfg.bar}cc)` }}
              />
            </div>

            {/* AI reasoning */}
            {match.reasoning && (
              <p className="text-[13px] text-gray-500 leading-relaxed mb-3 italic border-l-2 border-gray-100 pl-3">
                {match.reasoning}
              </p>
            )}

            {/* Amenity chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {match.accessibility_match === "full" && (
                <AMENITY_CHIP icon={Accessibility} label="Fully accessible" color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              )}
              {match.accessibility_match === "partial" && (
                <AMENITY_CHIP icon={Accessibility} label="Partial access" color="bg-amber-50 text-amber-700 border-amber-200" />
              )}
              {amenities.kitchen && (
                <AMENITY_CHIP icon={Utensils} label={t("card_kitchen")} color="bg-orange-50 text-orange-700 border-orange-200" />
              )}
              {amenities.wifi && (
                <AMENITY_CHIP icon={Wifi} label={t("card_wifi")} color="bg-sky-50 text-sky-700 border-sky-200" />
              )}
              {(amenities.parking || asset.parking) && (
                <AMENITY_CHIP icon={Car} label={t("card_parking")} color="bg-violet-50 text-violet-700 border-violet-200" />
              )}
              {match.carbon_estimate_kg !== undefined && (
                <AMENITY_CHIP icon={Leaf} label={`${match.carbon_estimate_kg} kg CO₂`} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              )}
            </div>

            {/* CTA */}
            <button
              onClick={() => onBook(asset)}
              aria-label={`Book ${asset.name}`}
              className="btn-primary w-full justify-center"
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
