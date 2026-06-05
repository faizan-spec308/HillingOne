import { MapPin, Users, Accessibility, Utensils, Wifi, Car, Leaf, ChevronRight } from "lucide-react";

/* Confidence score → visual config */
function confConfig(score) {
  if (score >= 85) return {
    label: "Excellent match",
    fg: "#059669", bg: "#ECFDF5", border: "#A7F3D0",
    leftBorder: "border-l-emerald-500",
    barColor: "bg-emerald-500",
  };
  if (score >= 65) return {
    label: "Good match",
    fg: "#D97706", bg: "#FFFBEB", border: "#FCD34D",
    leftBorder: "border-l-amber-400",
    barColor: "bg-amber-400",
  };
  return {
    label: "Possible match",
    fg: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE",
    leftBorder: "border-l-blue-400",
    barColor: "bg-blue-400",
  };
}

const CATEGORY_EMOJI = {
  hall:       "🏛️",
  community:  "🏛️",
  sport:      "⚽",
  gym:        "🏋️",
  pitch:      "⚽",
  meeting:    "📋",
  office:     "📋",
  park:       "🌳",
  garden:     "🌳",
  library:    "📚",
  youth:      "🎨",
  children:   "🎨",
  equip:      "🎤",
  registry:   "📄",
  housing:    "🏠",
  benefit:    "💷",
};

function categoryEmoji(cat = "") {
  const key = Object.keys(CATEGORY_EMOJI).find((k) => cat.toLowerCase().includes(k));
  return CATEGORY_EMOJI[key] || "🏢";
}

const ACCESS_STYLE = {
  full:    { label: "Fully accessible",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { label: "Partially accessible",cls: "bg-amber-50   text-amber-700   border-amber-200"   },
  none:    { label: "Limited access",      cls: "bg-gray-100   text-gray-500    border-gray-200"     },
};

export default function AssetCard({ match, onBook }) {
  const asset     = match.asset || {};
  const amenities = asset.amenities || {};
  const score     = match.match_score ?? 0;
  const conf      = confConfig(score);
  const access    = ACCESS_STYLE[match.accessibility_match] || ACCESS_STYLE.none;

  return (
    <div
      className={`bg-white border border-l-4 border-gray-200 ${conf.leftBorder} rounded-2xl p-5 transition-all duration-200 hover:shadow-civic-hover fade-in-up`}
      style={{ animationFillMode: "both" }}
    >
      <div className="flex gap-4">

        {/* Icon / thumbnail */}
        <div
          className="w-[72px] h-[72px] flex-shrink-0 rounded-xl flex items-center justify-center text-3xl"
          style={{ background: "linear-gradient(135deg, #EBF4FF 0%, #DBEAFE 100%)" }}
        >
          {categoryEmoji(asset.category)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                {(asset.category || "").replace(/_/g, " ")}
              </div>
              <h3 className="text-[16px] font-bold text-gray-900 leading-tight">
                {asset.name}
              </h3>
            </div>

            {/* Confidence badge */}
            <div
              className="flex-shrink-0 text-center px-3 py-1.5 rounded-xl border min-w-[72px]"
              style={{ background: conf.bg, borderColor: conf.border }}
            >
              <div className="text-[22px] font-black leading-none" style={{ color: conf.fg }}>
                {score}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wide leading-tight mt-0.5" style={{ color: conf.fg }}>
                {conf.label}
              </div>
            </div>
          </div>

          {/* Score bar */}
          <div className="h-1 bg-gray-100 rounded-full mb-3 overflow-hidden">
            <div
              className={`h-full ${conf.barColor} rounded-full transition-all`}
              style={{ width: `${score}%` }}
            />
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-gray-500 mb-2.5">
            {asset.ward && (
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-gray-400" />
                {asset.ward}
              </span>
            )}
            {asset.capacity && (
              <span className="flex items-center gap-1">
                <Users size={12} className="text-gray-400" />
                Up to {asset.capacity}
              </span>
            )}
            <span className="font-bold text-hillingdon-navy">
              {asset.hourly_rate > 0 ? `£${Number(asset.hourly_rate).toFixed(2)}/hr` : "Free"}
            </span>
          </div>

          {/* Reasoning */}
          <p className="text-[13px] text-gray-600 leading-relaxed mb-3 italic">
            {match.reasoning}
          </p>

          {/* Amenity chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {match.accessibility_match && match.accessibility_match !== "none" && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-full border ${access.cls}`}>
                <Accessibility size={10} />
                {access.label}
              </span>
            )}
            {amenities.kitchen && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-full border bg-orange-50 text-orange-700 border-orange-200">
                <Utensils size={10} /> Kitchen
              </span>
            )}
            {amenities.wifi && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-full border bg-sky-50 text-sky-700 border-sky-200">
                <Wifi size={10} /> WiFi
              </span>
            )}
            {(amenities.parking || asset.parking) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                <Car size={10} /> Parking
              </span>
            )}
            {match.carbon_estimate_kg !== undefined && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                <Leaf size={10} /> {match.carbon_estimate_kg} kg CO₂
              </span>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={() => onBook(asset)}
            className="btn-primary"
          >
            Book this space
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
